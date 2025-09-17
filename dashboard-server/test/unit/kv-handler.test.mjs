import { jest } from '@jest/globals';

// Mock AWS SDK
const mockGetItem = jest.fn();
const mockPutItem = jest.fn();

jest.unstable_mockModule('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn().mockImplementation(() => ({
    send: jest.fn(),
  })),
  GetItemCommand: jest.fn(),
  PutItemCommand: jest.fn(),
}));

// Mock DynamoDB service
jest.unstable_mockModule('../../src/aws/dynamodb.js', () => ({
  default: {
    getItem: mockGetItem,
    putItem: mockPutItem,
  }
}));

let KVHandler;

describe('KV Handler (Dashboard Server)', () => {
  beforeAll(async () => {
    const kvModule = await import('../../src/handlers/kv.js');
    KVHandler = kvModule.default;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should handle KV get operation with existing item', async () => {
    const mockItem = {
      value: 'test-value',
      expires_at: Math.floor(Date.now() / 1000) + 3600 // 1 hour from now
    };

    mockGetItem.mockResolvedValue({ item: mockItem, tableUnavailable: false });

    const result = await KVHandler.get({ key: 'test-key' });

    expect(mockGetItem).toHaveBeenCalledWith('KV#test-key');
    expect(result).toEqual({ value: 'test-value' });
  });

  test('should handle KV get operation with non-existent item', async () => {
    mockGetItem.mockResolvedValue({ item: null, tableUnavailable: false });

    const result = await KVHandler.get({ key: 'non-existent-key' });

    expect(result).toEqual({ value: null });
  });

  test('should handle KV set operation', async () => {
    mockPutItem.mockResolvedValue({ success: true, tableUnavailable: false });

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

  test('should handle table unavailable gracefully', async () => {
    mockGetItem.mockResolvedValue({
      item: null,
      tableUnavailable: true,
      warning: 'DynamoDB table not accessible'
    });

    const result = await KVHandler.get({ key: 'test-key' });

    expect(result).toEqual({
      value: null,
      warning: 'DynamoDB table not accessible'
    });
  });
});