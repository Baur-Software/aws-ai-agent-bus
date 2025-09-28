import { vi, describe, it, expect, beforeEach, beforeAll } from 'vitest';

// Mock AWS SDK
const mockSend = vi.fn();

vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: vi.fn().mockImplementation(() => ({
    send: mockSend,
  })),
  ScanCommand: vi.fn(),
  QueryCommand: vi.fn(),
}));

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn().mockImplementation(() => ({
    send: mockSend,
  })),
  ListObjectsV2Command: vi.fn(),
  HeadBucketCommand: vi.fn(),
}));

vi.mock('@aws-sdk/util-dynamodb', () => ({
  unmarshall: vi.fn().mockImplementation(item => item),
}));

let MetricsAggregator;

describe('Metrics Aggregator (Dashboard Server)', () => {
  beforeAll(async () => {
    const metricsModule = await import('../../src/services/metrics');
    MetricsAggregator = metricsModule.MetricsAggregator;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should get KV metrics from DynamoDB', async () => {
    const mockDynamoDB = { send: mockSend };
    const mockS3 = { send: vi.fn() };
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

  it('should get artifacts metrics from S3', async () => {
    const mockDynamoDB = { send: vi.fn() };
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

  it('should handle bucket not accessible', async () => {
    const mockDynamoDB = { send: vi.fn() };
    const mockS3 = { send: mockSend };
    const aggregator = new MetricsAggregator(mockDynamoDB, mockS3);

    mockSend.mockRejectedValue(new Error('AccessDenied'));

    const result = await aggregator.getArtifactsMetrics();

    expect(result.totalFiles).toBe(0);
    expect(result.totalSize).toBe(0);
  });

  it('should get all metrics', async () => {
    const mockDynamoDB = { send: vi.fn() };
    const mockS3 = { send: vi.fn() };
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