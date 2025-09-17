import { jest } from '@jest/globals';

// Mock AWS SDK
const mockSend = jest.fn();

jest.unstable_mockModule('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn().mockImplementation(() => ({
    send: mockSend,
  })),
  ScanCommand: jest.fn(),
}));

jest.unstable_mockModule('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: mockSend,
  })),
  ListObjectsV2Command: jest.fn(),
  HeadBucketCommand: jest.fn(),
}));

jest.unstable_mockModule('@aws-sdk/util-dynamodb', () => ({
  unmarshall: jest.fn().mockImplementation(item => item),
}));

let MetricsAggregator;

describe('Metrics Aggregator (Dashboard Server)', () => {
  beforeAll(async () => {
    const metricsModule = await import('../../src/services/metrics.js');
    MetricsAggregator = metricsModule.MetricsAggregator;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should get KV metrics from DynamoDB', async () => {
    const mockDynamoDB = { send: mockSend };
    const mockS3 = { send: jest.fn() };
    const aggregator = new MetricsAggregator(mockDynamoDB, mockS3);

    mockSend.mockResolvedValue({
      Items: [
        {
          key: { S: 'KV#test-key-1' },
          value: { S: 'test-value-1' },
          expires_at: { N: String(Math.floor(Date.now() / 1000) + 3600) }
        },
        {
          key: { S: 'KV#test-key-2' },
          value: { S: 'test-value-2' },
          expires_at: { N: String(Math.floor(Date.now() / 1000) + 3600) }
        }
      ]
    });

    const result = await aggregator.getKVMetrics();

    expect(result.totalKeys).toBe(2);
    expect(result.totalSize).toBeGreaterThan(0);
  });

  test('should get artifacts metrics from S3', async () => {
    const mockDynamoDB = { send: jest.fn() };
    const mockS3 = { send: mockSend };
    const aggregator = new MetricsAggregator(mockDynamoDB, mockS3);

    // Mock successful bucket check
    mockSend.mockResolvedValueOnce({});

    // Mock objects list
    mockSend.mockResolvedValueOnce({
      Contents: [
        { Key: 'file1.txt', Size: 1024 },
        { Key: 'file2.txt', Size: 2048 }
      ]
    });

    const result = await aggregator.getArtifactsMetrics();

    expect(result.totalFiles).toBe(2);
    expect(result.totalSize).toBe(3); // (1024 + 2048) / 1024 = 3KB
  });

  test('should handle bucket not accessible', async () => {
    const mockDynamoDB = { send: jest.fn() };
    const mockS3 = { send: mockSend };
    const aggregator = new MetricsAggregator(mockDynamoDB, mockS3);

    mockSend.mockRejectedValue(new Error('AccessDenied'));

    const result = await aggregator.getArtifactsMetrics();

    expect(result.totalFiles).toBe(0);
    expect(result.totalSize).toBe(0);
  });

  test('should get all metrics', async () => {
    const mockDynamoDB = { send: jest.fn() };
    const mockS3 = { send: jest.fn() };
    const aggregator = new MetricsAggregator(mockDynamoDB, mockS3);

    // Mock KV metrics
    mockDynamoDB.send.mockResolvedValue({ Items: [] });

    // Mock S3 metrics
    mockS3.send.mockResolvedValueOnce({}); // Head bucket
    mockS3.send.mockResolvedValueOnce({ Contents: [] }); // List objects

    const result = await aggregator.getAllMetrics();

    expect(result).toHaveProperty('kv');
    expect(result).toHaveProperty('artifacts');
    expect(result).toHaveProperty('lastUpdated');
  });
});