/**
 * Yjs Persistence Service
 * Provides durable storage for Yjs documents using DynamoDB (metadata) and S3 (document state)
 *
 * Architecture:
 * - DynamoDB: Stores document metadata (workflowId, lastModified, stateVector hash, size)
 * - S3: Stores full Yjs document state as binary blob
 * - Debounced writes: Prevents excessive writes on rapid updates
 */

import { DynamoDBClient, GetItemCommand, PutItemCommand, DeleteItemCommand, ScanCommand } from '@aws-sdk/client-dynamodb';
import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import * as Y from 'yjs';

interface PersistenceConfig {
  dynamodb: DynamoDBClient;
  s3: S3Client;
  tableName?: string;
  bucketName?: string;
  debounceMs?: number;
}

interface DocumentMetadata {
  workflowId: string;
  lastModified: number;
  size: number;
  stateVectorHash: string;
  version: number;
}

export class YjsPersistenceService {
  private dynamodb: DynamoDBClient;
  private s3: S3Client;
  private tableName: string;
  private bucketName: string;
  private debounceMs: number;

  // Debounce timers for each document
  private pendingWrites = new Map<string, NodeJS.Timeout>();
  private pendingDocs = new Map<string, Y.Doc>();

  constructor(config: PersistenceConfig) {
    this.dynamodb = config.dynamodb;
    this.s3 = config.s3;
    this.tableName = config.tableName || process.env.AGENT_MESH_KV_TABLE || 'agent-mesh-dev-kv';
    this.bucketName = config.bucketName || process.env.AGENT_MESH_ARTIFACTS_BUCKET || 'agent-mesh-artifacts';
    this.debounceMs = config.debounceMs || 2000; // 2 second debounce by default
  }

  /**
   * Get the S3 key for a workflow document
   */
  private getS3Key(workflowId: string): string {
    return `yjs-documents/${workflowId}.yjs`;
  }

  /**
   * Get the DynamoDB key for a workflow document
   */
  private getDynamoKey(workflowId: string): string {
    return `yjs#${workflowId}`;
  }

  /**
   * Generate a hash of the state vector for version tracking
   */
  private hashStateVector(stateVector: Uint8Array): string {
    // Simple hash - sum of bytes mod large prime
    let hash = 0;
    for (let i = 0; i < stateVector.length; i++) {
      hash = (hash * 31 + stateVector[i]) % 2147483647;
    }
    return hash.toString(36);
  }

  /**
   * Schedule a debounced write for a document
   * Prevents excessive writes on rapid updates
   */
  schedulePersist(workflowId: string, doc: Y.Doc): void {
    // Clear any existing timer
    const existingTimer = this.pendingWrites.get(workflowId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Store the doc reference
    this.pendingDocs.set(workflowId, doc);

    // Schedule new write
    const timer = setTimeout(async () => {
      const pendingDoc = this.pendingDocs.get(workflowId);
      if (pendingDoc) {
        try {
          await this.persistDocument(workflowId, pendingDoc);
          console.log(`[YjsPersistence] Persisted document: ${workflowId}`);
        } catch (error) {
          console.error(`[YjsPersistence] Failed to persist document ${workflowId}:`, error);
        } finally {
          this.pendingWrites.delete(workflowId);
          this.pendingDocs.delete(workflowId);
        }
      }
    }, this.debounceMs);

    this.pendingWrites.set(workflowId, timer);
  }

  /**
   * Immediately persist a document (used before garbage collection)
   */
  async persistDocument(workflowId: string, doc: Y.Doc): Promise<void> {
    // Cancel any pending debounced write
    const existingTimer = this.pendingWrites.get(workflowId);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.pendingWrites.delete(workflowId);
      this.pendingDocs.delete(workflowId);
    }

    // Encode document state
    const state = Y.encodeStateAsUpdate(doc);
    const stateVector = Y.encodeStateVector(doc);

    // Upload to S3
    await this.s3.send(new PutObjectCommand({
      Bucket: this.bucketName,
      Key: this.getS3Key(workflowId),
      Body: state,
      ContentType: 'application/octet-stream',
      Metadata: {
        'workflow-id': workflowId,
        'yjs-version': '13',
        'persisted-at': new Date().toISOString()
      }
    }));

    // Save metadata to DynamoDB
    const metadata: DocumentMetadata = {
      workflowId,
      lastModified: Date.now(),
      size: state.length,
      stateVectorHash: this.hashStateVector(stateVector),
      version: (await this.getMetadata(workflowId))?.version || 0 + 1
    };

    await this.dynamodb.send(new PutItemCommand({
      TableName: this.tableName,
      Item: marshall({
        key: this.getDynamoKey(workflowId),
        ...metadata,
        type: 'yjs-document'
      })
    }));
  }

  /**
   * Load a document from persistent storage
   * Returns null if document doesn't exist
   */
  async loadDocument(workflowId: string): Promise<Y.Doc | null> {
    try {
      // Check if document exists in S3
      const response = await this.s3.send(new GetObjectCommand({
        Bucket: this.bucketName,
        Key: this.getS3Key(workflowId)
      }));

      if (!response.Body) {
        return null;
      }

      // Read the binary data
      const chunks: Uint8Array[] = [];
      const reader = response.Body as AsyncIterable<Uint8Array>;
      for await (const chunk of reader) {
        chunks.push(chunk);
      }

      // Combine chunks
      const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const state = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        state.set(chunk, offset);
        offset += chunk.length;
      }

      // Create and apply state to new document
      const doc = new Y.Doc();
      Y.applyUpdate(doc, state);

      console.log(`[YjsPersistence] Loaded document: ${workflowId} (${state.length} bytes)`);
      return doc;
    } catch (error: any) {
      if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
        console.log(`[YjsPersistence] No persisted document found for: ${workflowId}`);
        return null;
      }
      throw error;
    }
  }

  /**
   * Get document metadata from DynamoDB
   */
  async getMetadata(workflowId: string): Promise<DocumentMetadata | null> {
    try {
      const response = await this.dynamodb.send(new GetItemCommand({
        TableName: this.tableName,
        Key: marshall({ key: this.getDynamoKey(workflowId) })
      }));

      if (!response.Item) {
        return null;
      }

      const item = unmarshall(response.Item);
      return {
        workflowId: item.workflowId,
        lastModified: item.lastModified,
        size: item.size,
        stateVectorHash: item.stateVectorHash,
        version: item.version
      };
    } catch (error) {
      console.error(`[YjsPersistence] Failed to get metadata for ${workflowId}:`, error);
      return null;
    }
  }

  /**
   * Check if a document exists in persistent storage
   */
  async documentExists(workflowId: string): Promise<boolean> {
    try {
      await this.s3.send(new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: this.getS3Key(workflowId)
      }));
      return true;
    } catch (error: any) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Delete a document from persistent storage
   */
  async deleteDocument(workflowId: string): Promise<void> {
    // Cancel any pending write
    const existingTimer = this.pendingWrites.get(workflowId);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.pendingWrites.delete(workflowId);
      this.pendingDocs.delete(workflowId);
    }

    // Delete from S3
    try {
      await this.s3.send(new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: this.getS3Key(workflowId)
      }));
    } catch (error: any) {
      if (error.name !== 'NoSuchKey') {
        throw error;
      }
    }

    // Delete metadata from DynamoDB
    try {
      await this.dynamodb.send(new DeleteItemCommand({
        TableName: this.tableName,
        Key: marshall({ key: this.getDynamoKey(workflowId) })
      }));
    } catch (error) {
      console.error(`[YjsPersistence] Failed to delete metadata for ${workflowId}:`, error);
    }

    console.log(`[YjsPersistence] Deleted document: ${workflowId}`);
  }

  /**
   * List all persisted documents
   */
  async listDocuments(): Promise<DocumentMetadata[]> {
    const documents: DocumentMetadata[] = [];
    let lastEvaluatedKey: Record<string, any> | undefined;

    do {
      const response = await this.dynamodb.send(new ScanCommand({
        TableName: this.tableName,
        FilterExpression: 'begins_with(#key, :prefix)',
        ExpressionAttributeNames: { '#key': 'key' },
        ExpressionAttributeValues: marshall({ ':prefix': 'yjs#' }),
        ExclusiveStartKey: lastEvaluatedKey
      }));

      if (response.Items) {
        for (const item of response.Items) {
          const data = unmarshall(item);
          documents.push({
            workflowId: data.workflowId,
            lastModified: data.lastModified,
            size: data.size,
            stateVectorHash: data.stateVectorHash,
            version: data.version
          });
        }
      }

      lastEvaluatedKey = response.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    return documents;
  }

  /**
   * Flush all pending writes (call during shutdown)
   */
  async flushPendingWrites(): Promise<void> {
    const promises: Promise<void>[] = [];

    this.pendingWrites.forEach((timer, workflowId) => {
      clearTimeout(timer);
      const doc = this.pendingDocs.get(workflowId);
      if (doc) {
        promises.push(
          this.persistDocument(workflowId, doc).catch(error => {
            console.error(`[YjsPersistence] Failed to flush ${workflowId}:`, error);
          })
        );
      }
    });

    await Promise.all(promises);
    this.pendingWrites.clear();
    this.pendingDocs.clear();

    console.log(`[YjsPersistence] Flushed ${promises.length} pending writes`);
  }

  /**
   * Get persistence statistics
   */
  getStats(): { pendingWrites: number; documents: string[] } {
    return {
      pendingWrites: this.pendingWrites.size,
      documents: Array.from(this.pendingDocs.keys())
    };
  }
}

export default YjsPersistenceService;
