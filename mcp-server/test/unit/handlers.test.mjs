import { jest } from '@jest/globals';

// Mock AWS SDK first
const mockS3Send = jest.fn();
const mockSFNSend = jest.fn();
const mockEventBridgeSend = jest.fn();

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: mockS3Send,
  })),
  GetObjectCommand: jest.fn(),
  PutObjectCommand: jest.fn(),
  ListObjectsV2Command: jest.fn(),
}));

jest.mock('@aws-sdk/client-sfn', () => ({
  SFNClient: jest.fn().mockImplementation(() => ({
    send: mockSFNSend,
  })),
  StartExecutionCommand: jest.fn(),
  DescribeExecutionCommand: jest.fn(),
}));

jest.mock('@aws-sdk/client-eventbridge', () => ({
  EventBridgeClient: jest.fn().mockImplementation(() => ({
    send: mockEventBridgeSend,
  })),
  PutEventsCommand: jest.fn(),
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://signed-url.example.com'),
}));

// Now import handlers after mocking
const WorkflowHandler = (await import('../../src/modules/mcp/handlers/workflow.js')).default;
const EventsHandler = (await import('../../src/modules/mcp/handlers/events.js')).default;


describe('Workflow Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should start workflow', async () => {
    const mockExecution = {
      executionArn: 'arn:aws:states:us-east-1:123456789012:execution:MyWorkflow:test-123',
      startDate: new Date(),
      stateMachineArn: 'arn:aws:states:us-east-1:123456789012:stateMachine:MyWorkflow',
      status: 'RUNNING',
    };

    mockSFNSend.mockResolvedValue({ executionArn: mockExecution.executionArn });
    mockSFNSend.mockResolvedValueOnce({ executionArn: mockExecution.executionArn })
              .mockResolvedValueOnce(mockExecution);

    const result = await WorkflowHandler.start({ name: 'test-workflow', input: { key: 'value' } });

    expect(mockSFNSend).toHaveBeenCalledTimes(2); // Start + Describe
    expect(result.executionArn).toBe(mockExecution.executionArn);
    expect(result.status).toBe('RUNNING');
  });

  test('should get workflow status', async () => {
    const mockExecution = {
      executionArn: 'arn:aws:states:us-east-1:123456789012:execution:MyWorkflow:test-123',
      status: 'SUCCEEDED',
      startDate: new Date(),
      stopDate: new Date(),
      input: { key: 'value' },
      output: { result: 'success' },
    };

    mockSFNSend.mockResolvedValue(mockExecution);

    const result = await WorkflowHandler.getStatus({ 
      executionArn: 'arn:aws:states:us-east-1:123456789012:execution:MyWorkflow:test-123' 
    });

    expect(mockSFNSend).toHaveBeenCalled();
    expect(result.status).toBe('SUCCEEDED');
    expect(result.input).toEqual({ key: 'value' });
  });

  test('should throw error when workflow name is missing', async () => {
    await expect(WorkflowHandler.start({})).rejects.toThrow('Workflow name is required');
  });

  test('should throw error when execution ARN is missing', async () => {
    await expect(WorkflowHandler.getStatus({})).rejects.toThrow('Execution ARN is required');
  });
});

describe('Events Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should send event', async () => {
    mockEventBridgeSend.mockResolvedValue({
      Entries: [{ EventId: 'event-123' }],
      FailedEntryCount: 0,
    });

    const result = await EventsHandler.send({
      detailType: 'Test Event',
      detail: { message: 'test' },
      source: 'test-source',
    });

    expect(mockEventBridgeSend).toHaveBeenCalled();
    expect(result.eventId).toBe('event-123');
    expect(result.success).toBe(true);
  });

  test('should send batch events', async () => {
    mockEventBridgeSend
      .mockResolvedValueOnce({
        Entries: [{ EventId: 'event-1' }],
        FailedEntryCount: 0,
      })
      .mockResolvedValueOnce({
        Entries: [{ EventId: 'event-2' }],
        FailedEntryCount: 0,
      });

    const events = [
      { detailType: 'Event 1', detail: { id: 1 } },
      { detailType: 'Event 2', detail: { id: 2 } },
    ];

    const result = await EventsHandler.sendBatch(events);

    expect(result.success).toBe(true);
    expect(result.results).toHaveLength(2);
    expect(result.results[0].success).toBe(true);
    expect(result.results[1].success).toBe(true);
  });

  test('should throw error when detailType or detail is missing', async () => {
    await expect(EventsHandler.send({ detailType: 'test' })).rejects.toThrow('detailType and detail are required');
    await expect(EventsHandler.send({ detail: {} })).rejects.toThrow('detailType and detail are required');
  });

  test('should throw error for empty batch', async () => {
    await expect(EventsHandler.sendBatch([])).rejects.toThrow('Events array is required and cannot be empty');
  });
});