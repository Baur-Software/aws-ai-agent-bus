// KV Get Task Tests
// Tests for KVGetTask with mocked MCP service

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { KVGetTask } from '../../../src/workflow/tasks/mcp/KVGetTask';
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
  nodeId: 'kv-get-1',
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

describe('KVGetTask', () => {
  let task: KVGetTask;
  let mockMCPService: MockMCPService;
  let mockLogger: MockLogger;
  let mockContext: WorkflowContext;

  beforeEach(() => {
    mockMCPService = new MockMCPService();
    mockLogger = new MockLogger();
    task = new KVGetTask(mockMCPService, mockLogger);
    mockContext = createMockContext();
  });

  describe('task metadata', () => {
    it('should have correct task type', () => {
      expect(task.type).toBe('kv-get');
    });

    it('should have correct display info', () => {
      const displayInfo = task.getDisplayInfo();

      expect(displayInfo).toEqual({
        category: NODE_CATEGORIES.MCP_TOOLS,
        label: 'KV Get',
        icon: 'Search',
        color: 'bg-blue-600',
        description: 'Retrieve a value from key-value storage',
        tags: ['mcp', 'kv', 'storage', 'retrieve']
      });
    });

    it('should have correct schema', () => {
      const schema = task.getSchema();

      expect(schema.title).toBe('Get Key-Value Pair');
      expect(schema.properties.key).toBeDefined();
      expect(schema.properties.defaultValue).toBeDefined();
      expect(schema.required).toEqual(['key']);
    });
  });

  describe('input validation', () => {
    it('should validate valid input', () => {
      const input = {
        key: 'user-settings',
        defaultValue: { theme: 'light' }
      };

      const validation = task.validate(input);

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toEqual([]);
    });

    it('should reject missing key', () => {
      const input = {};

      const validation = task.validate(input);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Key is required');
    });

    it('should reject empty key', () => {
      const input = {
        key: ''
      };

      const validation = task.validate(input);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Key is required');
    });

    it('should reject key that is too long', () => {
      const input = {
        key: 'x'.repeat(1025) // Over 1024 character limit
      };

      const validation = task.validate(input);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Key cannot exceed 1024 characters');
    });

    it('should accept key at maximum length', () => {
      const input = {
        key: 'x'.repeat(1024) // Exactly 1024 characters
      };

      const validation = task.validate(input);

      expect(validation.isValid).toBe(true);
    });

    it('should accept optional default value', () => {
      const input = {
        key: 'test-key'
        // No default value
      };

      const validation = task.validate(input);

      expect(validation.isValid).toBe(true);
    });
  });

  describe('task execution', () => {
    it('should execute successfully when key exists', async () => {
      const mockValue = { theme: 'dark', language: 'en' };
      mockMCPService.kvGet.mockResolvedValue(mockValue);

      const input = {
        key: 'user-settings'
      };

      const result = await task.execute(input, mockContext);

      expect(mockMCPService.kvGet).toHaveBeenCalledWith('user-settings');
      
      expect(result).toEqual({
        key: 'user-settings',
        value: mockValue,
        found: true,
        timestamp: expect.any(String)
      });

      expect(mockContext.data.kvKey).toBe('user-settings');
      expect(mockContext.data.kvValue).toBe(mockValue);
      expect(mockContext.data.kvFound).toBe(true);
    });

    it('should return default value when key not found', async () => {
      mockMCPService.kvGet.mockResolvedValue(null);

      const input = {
        key: 'missing-key',
        defaultValue: 'fallback-value'
      };

      const result = await task.execute(input, mockContext);

      expect(mockMCPService.kvGet).toHaveBeenCalledWith('missing-key');
      
      expect(result).toEqual({
        key: 'missing-key',
        value: 'fallback-value',
        found: false,
        timestamp: expect.any(String)
      });

      expect(mockContext.data.kvValue).toBe('fallback-value');
      expect(mockContext.data.kvFound).toBe(false);
    });

    it('should return null when key not found and no default', async () => {
      mockMCPService.kvGet.mockResolvedValue(null);

      const input = {
        key: 'missing-key'
      };

      const result = await task.execute(input, mockContext);

      expect(result.value).toBe(null);
      expect(result.found).toBe(false);
    });

    it('should handle different data types', async () => {
      const testCases = [
        { value: 'string-value', description: 'string' },
        { value: 42, description: 'number' },
        { value: true, description: 'boolean' },
        { value: { nested: 'object' }, description: 'object' },
        { value: [1, 2, 3], description: 'array' }
      ];

      for (const testCase of testCases) {
        mockMCPService.kvGet.mockResolvedValue(testCase.value);

        const input = { key: `test-${testCase.description}` };
        const result = await task.execute(input, mockContext);

        expect(result.value).toEqual(testCase.value);
        expect(result.found).toBe(true);
      }
    });

    it('should log execution progress', async () => {
      mockMCPService.kvGet.mockResolvedValue('test-value');

      const input = { key: 'test-key' };
      await task.execute(input, mockContext);

      expect(mockLogger.info).toHaveBeenCalledWith('Getting KV value for key: test-key');
      expect(mockLogger.info).toHaveBeenCalledWith('Successfully retrieved KV value for key: test-key (found: true)');
    });

    it('should log when key not found', async () => {
      mockMCPService.kvGet.mockResolvedValue(null);

      const input = { key: 'missing-key' };
      await task.execute(input, mockContext);

      expect(mockLogger.info).toHaveBeenCalledWith('Successfully retrieved KV value for key: missing-key (found: false)');
    });

    it('should throw TaskExecutionError on service failure', async () => {
      const serviceError = new Error('Storage service unavailable');
      mockMCPService.kvGet.mockRejectedValue(serviceError);

      const input = { key: 'failing-key' };

      await expect(task.execute(input, mockContext)).rejects.toThrow(TaskExecutionError);
      await expect(task.execute(input, mockContext)).rejects.toThrow(
        'MCP KV get failed: Storage service unavailable'
      );

      expect(mockLogger.error).toHaveBeenCalledWith('Failed to get KV value:', serviceError);
    });
  });

  describe('edge cases and special values', () => {
    it('should handle null values from storage', async () => {
      mockMCPService.kvGet.mockResolvedValue(null);

      const input = { key: 'null-key' };
      const result = await task.execute(input, mockContext);

      expect(result.value).toBe(null);
      expect(result.found).toBe(false);
    });

    it('should handle undefined values from storage', async () => {
      mockMCPService.kvGet.mockResolvedValue(undefined);

      const input = { key: 'undefined-key' };
      const result = await task.execute(input, mockContext);

      expect(result.value).toBe(null);
      expect(result.found).toBe(false);
    });

    it('should handle empty string values', async () => {
      mockMCPService.kvGet.mockResolvedValue('');

      const input = { key: 'empty-string-key' };
      const result = await task.execute(input, mockContext);

      expect(result.value).toBe('');
      expect(result.found).toBe(true);
    });

    it('should handle zero values', async () => {
      mockMCPService.kvGet.mockResolvedValue(0);

      const input = { key: 'zero-key' };
      const result = await task.execute(input, mockContext);

      expect(result.value).toBe(0);
      expect(result.found).toBe(true);
    });

    it('should handle false boolean values', async () => {
      mockMCPService.kvGet.mockResolvedValue(false);

      const input = { key: 'false-key' };
      const result = await task.execute(input, mockContext);

      expect(result.value).toBe(false);
      expect(result.found).toBe(true);
    });
  });

  describe('integration with workflow context', () => {
    it('should work without logger', () => {
      const taskWithoutLogger = new KVGetTask(mockMCPService);
      expect(taskWithoutLogger.type).toBe('kv-get');
    });

    it('should preserve existing context data', async () => {
      mockMCPService.kvGet.mockResolvedValue('new-value');

      const contextWithExistingData = createMockContext({
        data: { existingKey: 'existing value' }
      });

      const input = { key: 'new-key' };
      await task.execute(input, contextWithExistingData);

      expect(contextWithExistingData.data.existingKey).toBe('existing value');
      expect(contextWithExistingData.data.kvKey).toBe('new-key');
    });

    it('should handle concurrent executions', async () => {
      mockMCPService.kvGet
        .mockResolvedValueOnce('value-1')
        .mockResolvedValueOnce('value-2');

      const context1 = createMockContext({ nodeId: 'node-1' });
      const context2 = createMockContext({ nodeId: 'node-2' });

      const input1 = { key: 'key-1' };
      const input2 = { key: 'key-2' };

      const [result1, result2] = await Promise.all([
        task.execute(input1, context1),
        task.execute(input2, context2)
      ]);

      expect(result1.value).toBe('value-1');
      expect(result2.value).toBe('value-2');
      expect(mockMCPService.kvGet).toHaveBeenCalledTimes(2);
    });
  });

  describe('performance considerations', () => {
    it('should handle large values efficiently', async () => {
      const largeValue = { data: 'x'.repeat(100000) }; // 100KB object

      mockMCPService.kvGet.mockResolvedValue(largeValue);

      const start = Date.now();
      const input = { key: 'large-value' };
      await task.execute(input, mockContext);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(1000); // Should complete quickly
    });

    it('should handle complex nested objects', async () => {
      const complexValue = {
        level1: {
          level2: {
            level3: {
              data: Array.from({ length: 1000 }, (_, i) => ({ id: i, name: `Item ${i}` }))
            }
          }
        }
      };

      mockMCPService.kvGet.mockResolvedValue(complexValue);

      const input = { key: 'complex-data' };
      const result = await task.execute(input, mockContext);

      expect(result.value).toEqual(complexValue);
      expect(result.found).toBe(true);
    });
  });
});