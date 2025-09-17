// Events Send Task Tests
// Tests for EventsSendTask with mocked MCP service

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventsSendTask } from '../../../src/workflow/tasks/mcp/EventsSendTask';
import {
  WorkflowContext,
  Logger,
  EventEmitter,
  TaskExecutionError,
  NODE_CATEGORIES
} from '../../../src/workflow/types';
import { MCPService } from '../../../src/services';

// Mock MCP Service
class MockMCPService implements MCPService {
  kvGet = vi.fn();
  kvSet = vi.fn();
  artifactsList = vi.fn();
  artifactsGet = vi.fn();
  artifactsPut = vi.fn();
  eventsSend = vi.fn();
  workflowStart = vi.fn();
  workflowStatus = vi.fn();
}

// Mock Logger
class MockLogger implements Logger {
  debug = vi.fn();
  info = vi.fn();
  warn = vi.fn();
  error = vi.fn();
}

// Helper to create mock workflow context
const createMockContext = (overrides: Partial<WorkflowContext> = {}): WorkflowContext => ({
  executionId: 'test-execution-123',
  nodeId: 'events-send-1',
  workflowId: 'test-workflow',
  logger: new MockLogger(),
  eventEmitter: { emit: vi.fn(), on: vi.fn(), off: vi.fn() } as any,
  data: {},
  results: {},
  errors: [],
  metadata: {},
  getPreviousResult: vi.fn(),
  storeResult: vi.fn(),
  addError: vi.fn(),
  emit: vi.fn(),
  ...overrides
});

describe('EventsSendTask', () => {
  let task: EventsSendTask;
  let mockMCPService: MockMCPService;
  let mockLogger: MockLogger;
  let mockContext: WorkflowContext;

  beforeEach(() => {
    mockMCPService = new MockMCPService();
    mockLogger = new MockLogger();
    task = new EventsSendTask(mockMCPService, mockLogger);
    mockContext = createMockContext();

    // Default successful mock
    mockMCPService.eventsSend.mockResolvedValue({ eventId: 'event-123', success: true });
  });

  describe('task metadata', () => {
    it('should have correct task type', () => {
      expect(task.type).toBe('events-send');
    });

    it('should have correct display info', () => {
      const displayInfo = task.getDisplayInfo();

      expect(displayInfo).toEqual({
        category: NODE_CATEGORIES.MCP_TOOLS,
        label: 'Send Event',
        icon: 'Send',
        color: 'bg-orange-600',
        description: 'Send an event to the event bus',
        tags: ['mcp', 'events', 'send', 'eventbridge']
      });
    });

    it('should have correct schema', () => {
      const schema = task.getSchema();

      expect(schema.title).toBe('Send Event');
      expect(schema.properties.detailType).toBeDefined();
      expect(schema.properties.detail).toBeDefined();
      expect(schema.properties.source).toBeDefined();
      expect(schema.properties.useContextData).toBeDefined();
      expect(schema.properties.contextKey).toBeDefined();
      expect(schema.required).toEqual(['detailType']);
    });
  });

  describe('input validation', () => {
    it('should validate valid input with direct detail', () => {
      const input = {
        detailType: 'User Registration',
        detail: { userId: '123', email: 'user@example.com' },
        source: 'workflow-engine'
      };

      const validation = task.validate(input);

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toEqual([]);
    });

    it('should reject missing detailType', () => {
      const input = {
        detail: { data: 'test' }
      };

      const validation = task.validate(input);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Detail type is required');
    });

    it('should reject empty detailType', () => {
      const input = {
        detailType: '',
        detail: { data: 'test' }
      };

      const validation = task.validate(input);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Detail type is required');
    });

    it('should reject detailType that is too long', () => {
      const input = {
        detailType: 'x'.repeat(257), // Over 256 character limit
        detail: { data: 'test' }
      };

      const validation = task.validate(input);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Detail type cannot exceed 256 characters');
    });

    it('should require detail when not using context data', () => {
      const input = {
        detailType: 'Test Event',
        useContextData: false
        // No detail provided
      };

      const validation = task.validate(input);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Detail is required when not using context data');
    });

    it('should allow missing detail when using context data', () => {
      const input = {
        detailType: 'Test Event',
        useContextData: true
      };

      const validation = task.validate(input);

      expect(validation.isValid).toBe(true);
    });

    it('should warn about missing context key', () => {
      const input = {
        detailType: 'Test Event',
        useContextData: true
        // No contextKey specified
      };

      const validation = task.validate(input);

      expect(validation.isValid).toBe(true);
      expect(validation.warnings).toContain('No context key specified, will use "previousResult"');
    });

    it('should validate source format', () => {
      const validInput = {
        detailType: 'Test Event',
        detail: { test: true },
        source: 'my.custom.source'
      };

      const validation = task.validate(validInput);
      expect(validation.isValid).toBe(true);
    });
  });

  describe('task execution', () => {
    it('should execute successfully with direct detail', async () => {
      const input = {
        detailType: 'Order Processed',
        detail: { orderId: 'ORD-123', amount: 99.99, customerId: 'CUST-456' },
        source: 'e-commerce-system'
      };

      const result = await task.execute(input, mockContext);

      expect(mockMCPService.eventsSend).toHaveBeenCalledWith(
        'Order Processed',
        { orderId: 'ORD-123', amount: 99.99, customerId: 'CUST-456' },
        'e-commerce-system'
      );

      expect(result).toEqual({
        detailType: 'Order Processed',
        eventId: 'event-123',
        success: true,
        source: 'e-commerce-system',
        timestamp: expect.any(String)
      });

      expect(mockContext.data.eventId).toBe('event-123');
      expect(mockContext.data.eventDetailType).toBe('Order Processed');
    });

    it('should execute successfully with context data', async () => {
      const contextWithData = createMockContext({
        data: { previousResult: { processedData: 'workflow output', status: 'completed' } }
      });

      const input = {
        detailType: 'Workflow Completed',
        useContextData: true
      };

      const result = await task.execute(input, contextWithData);

      expect(mockMCPService.eventsSend).toHaveBeenCalledWith(
        'Workflow Completed',
        { processedData: 'workflow output', status: 'completed' },
        'mcp-client' // Default source
      );

      expect(result.detailType).toBe('Workflow Completed');
      expect(result.success).toBe(true);
    });

    it('should use custom context key', async () => {
      const contextWithData = createMockContext({
        data: { customEventData: { action: 'user_login', userId: '789' } }
      });

      const input = {
        detailType: 'User Action',
        useContextData: true,
        contextKey: 'customEventData',
        source: 'authentication-service'
      };

      await task.execute(input, contextWithData);

      expect(mockMCPService.eventsSend).toHaveBeenCalledWith(
        'User Action',
        { action: 'user_login', userId: '789' },
        'authentication-service'
      );
    });

    it('should use default source when not specified', async () => {
      const input = {
        detailType: 'Default Source Event',
        detail: { test: true }
      };

      await task.execute(input, mockContext);

      expect(mockMCPService.eventsSend).toHaveBeenCalledWith(
        'Default Source Event',
        { test: true },
        'mcp-client'
      );
    });

    it('should handle different detail data types', async () => {
      const testCases = [
        { detail: { object: 'data' }, description: 'object' },
        { detail: 'string data', description: 'string' },
        { detail: 42, description: 'number' },
        { detail: true, description: 'boolean' },
        { detail: [1, 2, 3], description: 'array' },
        { detail: null, description: 'null' }
      ];

      for (const testCase of testCases) {
        const input = {
          detailType: `Test ${testCase.description}`,
          detail: testCase.detail
        };

        const result = await task.execute(input, mockContext);

        expect(result.success).toBe(true);
        expect(mockMCPService.eventsSend).toHaveBeenCalledWith(
          `Test ${testCase.description}`,
          testCase.detail,
          'mcp-client'
        );
      }
    });

    it('should log execution progress', async () => {
      const input = {
        detailType: 'Test Event',
        detail: { test: true }
      };

      await task.execute(input, mockContext);

      expect(mockLogger.info).toHaveBeenCalledWith('Sending event: Test Event');
      expect(mockLogger.info).toHaveBeenCalledWith('Successfully sent event: event-123');
    });

    it('should throw error when context key is missing', async () => {
      const contextWithoutData = createMockContext({
        data: {} // Empty data
      });

      const input = {
        detailType: 'Test Event',
        useContextData: true,
        contextKey: 'missingKey'
      };

      await expect(task.execute(input, contextWithoutData)).rejects.toThrow(
        "Context data key 'missingKey' not found"
      );
    });

    it('should throw TaskExecutionError on service failure', async () => {
      const serviceError = new Error('EventBridge service unavailable');
      mockMCPService.eventsSend.mockRejectedValue(serviceError);

      const input = {
        detailType: 'Failing Event',
        detail: { test: true }
      };

      await expect(task.execute(input, mockContext)).rejects.toThrow(TaskExecutionError);
      await expect(task.execute(input, mockContext)).rejects.toThrow(
        'MCP events send failed: EventBridge service unavailable'
      );

      expect(mockLogger.error).toHaveBeenCalledWith('Failed to send event:', serviceError);
    });
  });

  describe('event detail handling', () => {
    it('should handle complex nested event details', async () => {
      const complexDetail = {
        user: {
          id: '123',
          profile: {
            name: 'John Doe',
            preferences: {
              theme: 'dark',
              notifications: true
            }
          }
        },
        action: {
          type: 'profile_update',
          timestamp: new Date().toISOString(),
          changes: ['theme', 'notifications']
        },
        metadata: {
          sessionId: 'sess-789',
          userAgent: 'Chrome/91.0',
          ipAddress: '192.168.1.1'
        }
      };

      const input = {
        detailType: 'Profile Updated',
        detail: complexDetail,
        source: 'user-management'
      };

      const result = await task.execute(input, mockContext);

      expect(result.success).toBe(true);
      expect(mockMCPService.eventsSend).toHaveBeenCalledWith(
        'Profile Updated',
        complexDetail,
        'user-management'
      );
    });

    it('should handle large event details efficiently', async () => {
      const largeDetail = {
        items: Array.from({ length: 1000 }, (_, i) => ({
          id: i,
          name: `Item ${i}`,
          properties: { active: true, score: Math.random() }
        }))
      };

      const start = Date.now();
      const input = {
        detailType: 'Bulk Operation',
        detail: largeDetail
      };

      const result = await task.execute(input, mockContext);
      const duration = Date.now() - start;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(1000); // Should handle large details efficiently
    });

    it('should preserve event detail structure', async () => {
      const detailWithSpecialValues = {
        date: new Date('2024-01-01').toISOString(),
        nullValue: null,
        undefinedValue: undefined,
        emptyString: '',
        zeroNumber: 0,
        falseBoolean: false,
        emptyArray: [],
        emptyObject: {}
      };

      const input = {
        detailType: 'Special Values Event',
        detail: detailWithSpecialValues
      };

      await task.execute(input, mockContext);

      expect(mockMCPService.eventsSend).toHaveBeenCalledWith(
        'Special Values Event',
        detailWithSpecialValues,
        'mcp-client'
      );
    });
  });

  describe('source validation and handling', () => {
    it('should handle various source formats', async () => {
      const testCases = [
        'simple-source',
        'my.dotted.source',
        'hyphen-ated-source',
        'mixed.source-format_123',
        'UPPERCASE-SOURCE'
      ];

      for (const source of testCases) {
        const input = {
          detailType: 'Source Test',
          detail: { test: true },
          source: source
        };

        const result = await task.execute(input, mockContext);

        expect(result.success).toBe(true);
        expect(result.source).toBe(source);
      }
    });

    it('should trim whitespace from source', async () => {
      const input = {
        detailType: 'Source Trim Test',
        detail: { test: true },
        source: '  my-source  '
      };

      await task.execute(input, mockContext);

      expect(mockMCPService.eventsSend).toHaveBeenCalledWith(
        'Source Trim Test',
        { test: true },
        'my-source'
      );
    });
  });

  describe('integration with workflow context', () => {
    it('should work without logger', () => {
      const taskWithoutLogger = new EventsSendTask(mockMCPService);
      expect(taskWithoutLogger.type).toBe('events-send');
    });

    it('should preserve existing context data', async () => {
      const contextWithExistingData = createMockContext({
        data: { existingKey: 'existing value' }
      });

      const input = {
        detailType: 'Context Test',
        detail: { test: true }
      };

      await task.execute(input, contextWithExistingData);

      expect(contextWithExistingData.data.existingKey).toBe('existing value');
      expect(contextWithExistingData.data.eventId).toBe('event-123');
    });

    it('should handle concurrent executions', async () => {
      mockMCPService.eventsSend
        .mockResolvedValueOnce({ eventId: 'event-1', success: true })
        .mockResolvedValueOnce({ eventId: 'event-2', success: true });

      const context1 = createMockContext({ nodeId: 'node-1' });
      const context2 = createMockContext({ nodeId: 'node-2' });

      const input1 = { detailType: 'Event 1', detail: { data: 1 } };
      const input2 = { detailType: 'Event 2', detail: { data: 2 } };

      const [result1, result2] = await Promise.all([
        task.execute(input1, context1),
        task.execute(input2, context2)
      ]);

      expect(result1.eventId).toBe('event-1');
      expect(result2.eventId).toBe('event-2');
      expect(mockMCPService.eventsSend).toHaveBeenCalledTimes(2);
    });
  });

  describe('error scenarios', () => {
    it('should handle service returning non-success response', async () => {
      mockMCPService.eventsSend.mockResolvedValue({ eventId: null, success: false, error: 'Validation failed' });

      const input = {
        detailType: 'Invalid Event',
        detail: { invalid: true }
      };

      const result = await task.execute(input, mockContext);

      expect(result.success).toBe(false);
      expect(result.eventId).toBe(null);
    });

    it('should handle missing eventId in response', async () => {
      mockMCPService.eventsSend.mockResolvedValue({ success: true }); // Missing eventId

      const input = {
        detailType: 'Missing ID Event',
        detail: { test: true }
      };

      const result = await task.execute(input, mockContext);

      expect(result.success).toBe(true);
      expect(result.eventId).toBeUndefined();
    });
  });
});