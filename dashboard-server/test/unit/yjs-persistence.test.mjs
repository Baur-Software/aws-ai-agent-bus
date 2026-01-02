import { vi, describe, it, expect, beforeEach, beforeAll } from 'vitest';
import * as Y from 'yjs';

// Mock AWS SDK clients
const mockS3Send = vi.fn();
const mockDynamoDBSend = vi.fn();

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn().mockImplementation(() => ({
    send: mockS3Send,
  })),
  GetObjectCommand: vi.fn().mockImplementation((params) => ({ type: 'GetObject', ...params })),
  PutObjectCommand: vi.fn().mockImplementation((params) => ({ type: 'PutObject', ...params })),
  DeleteObjectCommand: vi.fn().mockImplementation((params) => ({ type: 'DeleteObject', ...params })),
  HeadObjectCommand: vi.fn().mockImplementation((params) => ({ type: 'HeadObject', ...params })),
}));

vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: vi.fn().mockImplementation(() => ({
    send: mockDynamoDBSend,
  })),
  GetItemCommand: vi.fn().mockImplementation((params) => ({ type: 'GetItem', ...params })),
  PutItemCommand: vi.fn().mockImplementation((params) => ({ type: 'PutItem', ...params })),
  DeleteItemCommand: vi.fn().mockImplementation((params) => ({ type: 'DeleteItem', ...params })),
  ScanCommand: vi.fn().mockImplementation((params) => ({ type: 'Scan', ...params })),
}));

vi.mock('@aws-sdk/util-dynamodb', () => ({
  marshall: vi.fn((obj) => obj),
  unmarshall: vi.fn((obj) => obj),
}));

let YjsPersistenceService;
let s3Client;
let dynamodbClient;

describe('YjsPersistenceService', () => {
  beforeAll(async () => {
    // Create mock clients
    const { S3Client } = await import('@aws-sdk/client-s3');
    const { DynamoDBClient } = await import('@aws-sdk/client-dynamodb');
    s3Client = new S3Client({});
    dynamodbClient = new DynamoDBClient({});

    // Import the service
    const module = await import('../../src/services/YjsPersistenceService.js');
    YjsPersistenceService = module.YjsPersistenceService;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('persistDocument', () => {
    it('should persist document state to S3 and metadata to DynamoDB', async () => {
      const service = new YjsPersistenceService({
        dynamodb: dynamodbClient,
        s3: s3Client,
        tableName: 'test-table',
        bucketName: 'test-bucket',
        debounceMs: 0, // No debounce for tests
      });

      // Create a Yjs document with some data
      const doc = new Y.Doc();
      const nodes = doc.getMap('nodes');
      nodes.set('node1', { id: 'node1', type: 'agent' });

      mockS3Send.mockResolvedValueOnce({});
      mockDynamoDBSend.mockResolvedValueOnce({ Item: null }); // getMetadata returns null
      mockDynamoDBSend.mockResolvedValueOnce({}); // putItem succeeds

      await service.persistDocument('workflow-123', doc);

      // Verify S3 put was called
      expect(mockS3Send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'PutObject',
          Bucket: 'test-bucket',
          Key: 'yjs-documents/workflow-123.yjs',
        })
      );

      // Verify DynamoDB put was called
      expect(mockDynamoDBSend).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'PutItem',
          TableName: 'test-table',
        })
      );
    });
  });

  describe('loadDocument', () => {
    it('should load document from S3 and return a Y.Doc', async () => {
      const service = new YjsPersistenceService({
        dynamodb: dynamodbClient,
        s3: s3Client,
      });

      // Create a mock Yjs document and encode it
      const originalDoc = new Y.Doc();
      const nodes = originalDoc.getMap('nodes');
      nodes.set('node1', { id: 'node1', type: 'agent' });
      const encodedState = Y.encodeStateAsUpdate(originalDoc);

      // Mock S3 response with async iterator
      mockS3Send.mockResolvedValueOnce({
        Body: {
          [Symbol.asyncIterator]: async function* () {
            yield encodedState;
          },
        },
      });

      const loadedDoc = await service.loadDocument('workflow-123');

      expect(loadedDoc).toBeInstanceOf(Y.Doc);
      expect(loadedDoc.getMap('nodes').get('node1')).toEqual({ id: 'node1', type: 'agent' });
    });

    it('should return null when document does not exist', async () => {
      const service = new YjsPersistenceService({
        dynamodb: dynamodbClient,
        s3: s3Client,
      });

      // Mock S3 404 response
      const error = new Error('Not found');
      error.name = 'NoSuchKey';
      mockS3Send.mockRejectedValueOnce(error);

      const result = await service.loadDocument('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('schedulePersist', () => {
    it('should track pending writes in stats', () => {
      const service = new YjsPersistenceService({
        dynamodb: dynamodbClient,
        s3: s3Client,
        debounceMs: 10000, // Long debounce to prevent auto-flush
      });

      const doc = new Y.Doc();
      service.schedulePersist('workflow-123', doc);
      service.schedulePersist('workflow-456', doc);

      const stats = service.getStats();
      expect(stats.pendingWrites).toBe(2);
      expect(stats.documents).toContain('workflow-123');
      expect(stats.documents).toContain('workflow-456');
    });
  });

  describe('flushPendingWrites', () => {
    it('should immediately write all pending documents', async () => {
      const service = new YjsPersistenceService({
        dynamodb: dynamodbClient,
        s3: s3Client,
        debounceMs: 10000, // Long debounce
      });

      const doc1 = new Y.Doc();
      const doc2 = new Y.Doc();

      mockS3Send.mockResolvedValue({});
      mockDynamoDBSend.mockResolvedValue({ Item: null });

      service.schedulePersist('workflow-1', doc1);
      service.schedulePersist('workflow-2', doc2);

      expect(mockS3Send).not.toHaveBeenCalled();

      await service.flushPendingWrites();

      // Both documents should be persisted
      expect(mockS3Send).toHaveBeenCalledTimes(2);

      // Stats should show no pending writes
      const stats = service.getStats();
      expect(stats.pendingWrites).toBe(0);
    });
  });

  describe('documentExists', () => {
    it('should return true when document exists', async () => {
      const service = new YjsPersistenceService({
        dynamodb: dynamodbClient,
        s3: s3Client,
      });

      mockS3Send.mockResolvedValueOnce({});

      const exists = await service.documentExists('workflow-123');
      expect(exists).toBe(true);
    });

    it('should return false when document does not exist', async () => {
      const service = new YjsPersistenceService({
        dynamodb: dynamodbClient,
        s3: s3Client,
      });

      const error = new Error('Not found');
      error.name = 'NotFound';
      mockS3Send.mockRejectedValueOnce(error);

      const exists = await service.documentExists('non-existent');
      expect(exists).toBe(false);
    });
  });

  describe('deleteDocument', () => {
    it('should delete from both S3 and DynamoDB', async () => {
      const service = new YjsPersistenceService({
        dynamodb: dynamodbClient,
        s3: s3Client,
        tableName: 'test-table',
        bucketName: 'test-bucket',
      });

      mockS3Send.mockResolvedValueOnce({});
      mockDynamoDBSend.mockResolvedValueOnce({});

      await service.deleteDocument('workflow-123');

      expect(mockS3Send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'DeleteObject',
          Key: 'yjs-documents/workflow-123.yjs',
        })
      );

      expect(mockDynamoDBSend).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'DeleteItem',
        })
      );
    });

    it('should cancel pending writes when deleting', async () => {
      const service = new YjsPersistenceService({
        dynamodb: dynamodbClient,
        s3: s3Client,
        debounceMs: 10000,
      });

      const doc = new Y.Doc();
      service.schedulePersist('workflow-123', doc);

      expect(service.getStats().pendingWrites).toBe(1);

      mockS3Send.mockResolvedValueOnce({});
      mockDynamoDBSend.mockResolvedValueOnce({});

      await service.deleteDocument('workflow-123');

      expect(service.getStats().pendingWrites).toBe(0);
    });
  });

  describe('listDocuments', () => {
    it('should return all persisted document metadata', async () => {
      const service = new YjsPersistenceService({
        dynamodb: dynamodbClient,
        s3: s3Client,
      });

      mockDynamoDBSend.mockResolvedValueOnce({
        Items: [
          {
            key: 'yjs#workflow-1',
            workflowId: 'workflow-1',
            lastModified: 1234567890,
            size: 1024,
            stateVectorHash: 'abc123',
            version: 1,
          },
          {
            key: 'yjs#workflow-2',
            workflowId: 'workflow-2',
            lastModified: 1234567891,
            size: 2048,
            stateVectorHash: 'def456',
            version: 2,
          },
        ],
        LastEvaluatedKey: undefined,
      });

      const documents = await service.listDocuments();

      expect(documents).toHaveLength(2);
      expect(documents[0].workflowId).toBe('workflow-1');
      expect(documents[1].workflowId).toBe('workflow-2');
    });
  });

  describe('getMetadata', () => {
    it('should return metadata from DynamoDB', async () => {
      const service = new YjsPersistenceService({
        dynamodb: dynamodbClient,
        s3: s3Client,
      });

      mockDynamoDBSend.mockResolvedValueOnce({
        Item: {
          key: 'yjs#workflow-123',
          workflowId: 'workflow-123',
          lastModified: 1234567890,
          size: 1024,
          stateVectorHash: 'abc123',
          version: 5,
        },
      });

      const metadata = await service.getMetadata('workflow-123');

      expect(metadata).toEqual({
        workflowId: 'workflow-123',
        lastModified: 1234567890,
        size: 1024,
        stateVectorHash: 'abc123',
        version: 5,
      });
    });

    it('should return null when metadata does not exist', async () => {
      const service = new YjsPersistenceService({
        dynamodb: dynamodbClient,
        s3: s3Client,
      });

      mockDynamoDBSend.mockResolvedValueOnce({ Item: null });

      const metadata = await service.getMetadata('non-existent');

      expect(metadata).toBeNull();
    });
  });
});
