import { jest } from '@jest/globals';

// Mock MCP SDK before all other imports
jest.unstable_mockModule('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: jest.fn().mockImplementation(() => ({
    setRequestHandler: jest.fn(),
    connect: jest.fn().mockResolvedValue({}),
  })),
}));

jest.unstable_mockModule('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: jest.fn(),
}));

// Mock AWS SDK
const mockDynamoSend = jest.fn();

jest.unstable_mockModule('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn().mockImplementation(() => ({
    send: mockDynamoSend,
  })),
  GetItemCommand: jest.fn(),
  PutItemCommand: jest.fn(),
  QueryCommand: jest.fn(),
}));

jest.unstable_mockModule('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: jest.fn(),
  })),
  GetObjectCommand: jest.fn(),
  PutObjectCommand: jest.fn(),
  ListObjectsV2Command: jest.fn(),
}));

jest.unstable_mockModule('@aws-sdk/client-sfn', () => ({
  SFNClient: jest.fn().mockImplementation(() => ({
    send: jest.fn(),
  })),
  StartExecutionCommand: jest.fn(),
  DescribeExecutionCommand: jest.fn(),
}));

jest.unstable_mockModule('@aws-sdk/client-eventbridge', () => ({
  EventBridgeClient: jest.fn().mockImplementation(() => ({
    send: jest.fn(),
  })),
  PutEventsCommand: jest.fn(),
}));

jest.unstable_mockModule('@aws-sdk/util-dynamodb', () => ({
  marshall: jest.fn((obj) => obj),
  unmarshall: jest.fn((obj) => obj),
}));

jest.unstable_mockModule('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://signed-url.example.com'),
}));

// Mock DynamoDB service
const mockGetItem = jest.fn();
const mockPutItem = jest.fn();

jest.unstable_mockModule('../../src/modules/aws/dynamodb.js', () => ({
  default: {
    getItem: mockGetItem,
    putItem: mockPutItem,
  }
}));

// Now import after mocking
const { default: AgentMeshMCPServer } = await import('../../src/modules/mcp/server.js');
const { default: KVHandler } = await import('../../src/modules/mcp/handlers/kv.js');

describe('MCP Server', () => {
  let server;

  beforeEach(() => {
    jest.clearAllMocks();
    server = new AgentMeshMCPServer();
  });

  test('should create a server instance', () => {
    expect(server).toBeInstanceOf(AgentMeshMCPServer);
    expect(server.server).toBeDefined();
  });

  test('should have setupToolHandlers method', () => {
    expect(typeof server.setupToolHandlers).toBe('function');
  });

  test('should be able to run server', async () => {
    const result = await server.run();
    expect(result).toBeDefined();
  });
});

describe('KV Handler (Unit Tests)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should handle KV get operation with existing item', async () => {
    const mockItem = {
      value: 'test-value',
      expires_at: Math.floor(Date.now() / 1000) + 3600 // 1 hour from now
    };
    
    mockGetItem.mockResolvedValue(mockItem);

    const result = await KVHandler.get({ key: 'test-key' });
    
    expect(mockGetItem).toHaveBeenCalledWith({ key: 'KV#test-key' });
    expect(result).toEqual({ value: 'test-value' });
  });

  test('should handle KV get operation with non-existent item', async () => {
    mockGetItem.mockResolvedValue(null);

    const result = await KVHandler.get({ key: 'non-existent-key' });
    
    expect(result).toEqual({ value: null });
  });

  test('should handle KV set operation', async () => {
    mockPutItem.mockResolvedValue({});

    const result = await KVHandler.set({ 
      key: 'test-key', 
      value: 'test-value',
      ttl_hours: 24 
    });
    
    expect(mockPutItem).toHaveBeenCalled();
    expect(result).toEqual({ success: true });
  });

  test('should throw error when key is missing for get operation', async () => {
    await expect(KVHandler.get({})).rejects.toThrow('Key is required');
  });

  test('should throw error when key or value is missing for set operation', async () => {
    await expect(KVHandler.set({ key: 'test' })).rejects.toThrow('Key and value are required');
    await expect(KVHandler.set({ value: 'test' })).rejects.toThrow('Key and value are required');
  });

  test('should handle expired items', () => {
    const expiredItem = {
      value: 'test-value',
      expires_at: Math.floor(Date.now() / 1000) - 3600 // 1 hour ago
    };
    
    expect(KVHandler.isExpired(expiredItem)).toBe(true);
    
    const validItem = {
      value: 'test-value',
      expires_at: Math.floor(Date.now() / 1000) + 3600 // 1 hour from now
    };
    
    expect(KVHandler.isExpired(validItem)).toBe(false);
  });
});