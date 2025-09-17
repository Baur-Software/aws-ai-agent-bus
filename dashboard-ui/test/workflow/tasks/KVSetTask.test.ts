// KV Set Task Tests
// Tests for KVSetTask with mocked MCP service

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { KVSetTask } from '../../../src/workflow/tasks/mcp/KVSetTask';
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
  nodeId: 'kv-set-1',
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

describe('KVSetTask', () => {
  let task: KVSetTask;
  let mockMCPService: MockMCPService;
  let mockLogger: MockLogger;
  let mockContext: WorkflowContext;

  beforeEach(() => {
    mockMCPService = new MockMCPService();
    mockLogger = new MockLogger();
    task = new KVSetTask(mockMCPService, mockLogger);
    mockContext = createMockContext();

    // Default successful mock
    mockMCPService.kvSet.mockResolvedValue(undefined);
  });

  describe('task metadata', () => {
    it('should have correct task type', () => {
      expect(task.type).toBe('kv-set');
    });

    it('should have correct display info', () => {
      const displayInfo = task.getDisplayInfo();

      expect(displayInfo).toEqual({
        category: NODE_CATEGORIES.MCP_TOOLS,
        label: 'KV Set',
        icon: 'Database',
        color: 'bg-purple-600',
        description: 'Store key-value data in AWS',
        tags: ['storage', 'kv', 'database', 'aws', 'mcp']
      });
    });

    it('should have correct schema', () => {
      const schema = task.getSchema();

      expect(schema.title).toBe('Store Key-Value Pair');
      expect(schema.properties.key).toBeDefined();
      expect(schema.properties.value).toBeDefined();
      expect(schema.properties.ttl_hours).toBeDefined();
      expect(schema.required).toEqual(['key']);
    });
  });

  describe('input validation', () => {
    it('should validate valid input', () => {
      const input = {
        key: 'test-key',
        value: 'test-value',
        ttl_hours: 24
      };

      const validation = task.validate(input);

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toEqual([]);
    });

    it('should reject missing key', () => {
      const input = {
        value: 'test-value'
      };

      const validation = task.validate(input);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Key is required');
    });

    it('should reject empty key', () => {
      const input = {
        key: '',
        value: 'test-value'
      };

      const validation = task.validate(input);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Key is required');
    });

    it('should reject key that is too long', () => {
      const input = {
        key: 'x'.repeat(251), // Over 250 character limit
        value: 'test-value'
      };

      const validation = task.validate(input);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Key must be 250 characters or less');
    });

    it('should accept key at maximum length', () => {
      const input = {
        key: 'x'.repeat(1024), // Exactly 1024 characters
        value: 'test-value'
      };

      const validation = task.validate(input);

      expect(validation.isValid).toBe(true);
    });

    it('should require value when not using context data', () => {
      const input = {
        key: 'test-key',
        useContextData: false
        // No value provided
      };

      const validation = task.validate(input);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Value is required when not using context data');
    });

    it('should allow missing value when using context data', () => {
      const input = {
        key: 'test-key',
        useContextData: true
      };

      const validation = task.validate(input);

      expect(validation.isValid).toBe(true);
    });

    it('should warn about missing context key', () => {
      const input = {
        key: 'test-key',
        useContextData: true
        // No contextKey specified
      };

      const validation = task.validate(input);

      expect(validation.isValid).toBe(true);
      expect(validation.warnings).toContain('No context key specified, will use "previousResult"');
    });
  });

  describe('task execution', () => {
    it('should execute successfully with direct value', async () => {
      const input = {
        key: 'user-settings',
        value: { theme: 'dark', language: 'en' },
        ttl: 48
      };

      const result = await task.execute(input, mockContext);

      expect(mockMCPService.kvSet).toHaveBeenCalledWith(
        'user-settings',
        { theme: 'dark', language: 'en' },
        48
      );

      expect(result).toEqual({
        key: 'user-settings',
        success: true,
        timestamp: expect.any(String)
      });

      expect(mockContext.data.kvKey).toBe('user-settings');
    });

    it('should execute successfully with context data', async () => {
      const contextWithData = createMockContext({
        data: { previousResult: { name: 'John', age: 30 } }
      });

      const input = {
        key: 'user-data',
        useContextData: true
      };

      const result = await task.execute(input, contextWithData);

      expect(mockMCPService.kvSet).toHaveBeenCalledWith(
        'user-data',
        { name: 'John', age: 30 },
        24 // Default TTL
      );

      expect(result.key).toBe('user-data');
      expect(result.success).toBe(true);
    });

    it('should use custom context key', async () => {
      const contextWithData = createMockContext({
        data: { customData: 'custom value' }
      });

      const input = {
        key: 'custom-key',
        useContextData: true,
        contextKey: 'customData'
      };

      await task.execute(input, contextWithData);

      expect(mockMCPService.kvSet).toHaveBeenCalledWith(
        'custom-key',
        'custom value',
        24
      );
    });

    it('should use default TTL when not specified', async () => {
      const input = {
        key: 'test-key',
        value: 'test-value'
      };

      await task.execute(input, mockContext);

      expect(mockMCPService.kvSet).toHaveBeenCalledWith(
        'test-key',
        'test-value',
        24
      );
    });

    it('should stringify JSON objects when stringifyJSON is true', async () => {
      const input = {
        key: 'json-data',
        value: { complex: 'object', nested: { value: 123 } },
        stringifyJSON: true
      };

      await task.execute(input, mockContext);

      const expectedValue = JSON.stringify({ complex: 'object', nested: { value: 123 } }, null, 2);
      expect(mockMCPService.kvSet).toHaveBeenCalledWith(
        'json-data',
        expectedValue,
        24
      );
    });

    it('should not stringify when stringifyJSON is false', async () => {
      const input = {
        key: 'object-data',
        value: { keep: 'as object' },
        stringifyJSON: false
      };

      await task.execute(input, mockContext);

      expect(mockMCPService.kvSet).toHaveBeenCalledWith(
        'object-data',
        { keep: 'as object' },
        24
      );
    });

    it('should handle string values', async () => {
      const input = {
        key: 'string-key',
        value: 'simple string value'
      };

      await task.execute(input, mockContext);

      expect(mockMCPService.kvSet).toHaveBeenCalledWith(
        'string-key',
        'simple string value',
        24
      );
    });

    it('should log execution progress', async () => {
      const input = {
        key: 'test-key',
        value: 'test-value'
      };

      await task.execute(input, mockContext);

      expect(mockLogger.info).toHaveBeenCalledWith('Setting KV pair: test-key');
      expect(mockLogger.info).toHaveBeenCalledWith('Successfully set KV pair: test-key');
    });

    it('should store result in context', async () => {
      const input = {
        key: 'context-test',
        value: 'context-value'
      };

      await task.execute(input, mockContext);

      expect(mockContext.data.kvKey).toBe('context-test');
      expect(mockContext.data.kvValue).toBe('context-value');
    });

    it('should throw error when context key is missing', async () => {
      const contextWithoutData = createMockContext({
        data: {} // Empty data
      });

      const input = {
        key: 'test-key',
        useContextData: true,
        contextKey: 'missingKey'
      };

      await expect(task.execute(input, contextWithoutData)).rejects.toThrow(
        "Context data key 'missingKey' not found"
      );
    });

    it('should throw TaskExecutionError on service failure', async () => {
      const serviceError = new Error('Storage service unavailable');
      mockMCPService.kvSet.mockRejectedValue(serviceError);

      const input = {
        key: 'failing-key',
        value: 'failing-value'
      };

      await expect(task.execute(input, mockContext)).rejects.toThrow(TaskExecutionError);
      await expect(task.execute(input, mockContext)).rejects.toThrow(
        'MCP KV set failed: Storage service unavailable'
      );

      expect(mockLogger.error).toHaveBeenCalledWith('Failed to set KV pair:', serviceError);
    });
  });

  describe('edge cases and data types', () => {
    it('should handle null values', async () => {
      const input = {
        key: 'null-key',
        value: null
      };

      await task.execute(input, mockContext);

      expect(mockMCPService.kvSet).toHaveBeenCalledWith('null-key', null, 24);
    });

    it('should handle undefined values', async () => {
      const input = {
        key: 'undefined-key',
        value: undefined
      };

      await task.execute(input, mockContext);

      expect(mockMCPService.kvSet).toHaveBeenCalledWith('undefined-key', undefined, 24);
    });

    it('should handle boolean values', async () => {
      const input = {
        key: 'boolean-key',
        value: true
      };

      await task.execute(input, mockContext);

      expect(mockMCPService.kvSet).toHaveBeenCalledWith('boolean-key', true, 24);
    });

    it('should handle numeric values', async () => {
      const input = {
        key: 'number-key',
        value: 42
      };

      await task.execute(input, mockContext);

      expect(mockMCPService.kvSet).toHaveBeenCalledWith('number-key', 42, 24);
    });

    it('should handle array values', async () => {
      const input = {
        key: 'array-key',
        value: [1, 2, 3, 'test']
      };

      await task.execute(input, mockContext);

      expect(mockMCPService.kvSet).toHaveBeenCalledWith('array-key', [1, 2, 3, 'test'], 24);
    });

    it('should handle deeply nested objects', async () => {
      const complexObject = {
        level1: {
          level2: {
            level3: {
              data: 'deep value',
              numbers: [1, 2, 3],
              nested: { even: 'deeper' }
            }
          }
        }
      };

      const input = {
        key: 'complex-key',
        value: complexObject
      };

      await task.execute(input, mockContext);

      expect(mockMCPService.kvSet).toHaveBeenCalledWith('complex-key', complexObject, 24);
    });

    it('should handle empty objects', async () => {
      const input = {
        key: 'empty-object',
        value: {}
      };

      await task.execute(input, mockContext);

      expect(mockMCPService.kvSet).toHaveBeenCalledWith('empty-object', {}, 24);
    });

    it('should handle empty arrays', async () => {
      const input = {
        key: 'empty-array',
        value: []
      };

      await task.execute(input, mockContext);

      expect(mockMCPService.kvSet).toHaveBeenCalledWith('empty-array', [], 24);
    });
  });

  describe('integration with workflow context', () => {
    it('should work without logger', () => {
      const taskWithoutLogger = new KVSetTask(mockMCPService);
      expect(taskWithoutLogger.type).toBe('kv-set');
    });

    it('should preserve existing context data', async () => {
      const contextWithExistingData = createMockContext({
        data: { existingKey: 'existing value' }
      });

      const input = {
        key: 'new-key',
        value: 'new-value'
      };

      await task.execute(input, contextWithExistingData);

      expect(contextWithExistingData.data.existingKey).toBe('existing value');
      expect(contextWithExistingData.data.kvKey).toBe('new-key');
    });

    it('should handle concurrent executions with different contexts', async () => {
      const context1 = createMockContext({ nodeId: 'node-1' });
      const context2 = createMockContext({ nodeId: 'node-2' });

      const input1 = { key: 'key-1', value: 'value-1' };
      const input2 = { key: 'key-2', value: 'value-2' };

      await Promise.all([
        task.execute(input1, context1),
        task.execute(input2, context2)
      ]);

      expect(mockMCPService.kvSet).toHaveBeenCalledWith('key-1', 'value-1', 24);
      expect(mockMCPService.kvSet).toHaveBeenCalledWith('key-2', 'value-2', 24);
      expect(mockMCPService.kvSet).toHaveBeenCalledTimes(2);
    });
  });

  describe('performance considerations', () => {
    it('should handle large values efficiently', async () => {
      const largeValue = 'x'.repeat(100000); // 100KB string

      const input = {
        key: 'large-value',
        value: largeValue
      };

      const start = Date.now();
      await task.execute(input, mockContext);
      const duration = Date.now() - start;

      expect(mockMCPService.kvSet).toHaveBeenCalledWith('large-value', largeValue, 24);
      expect(duration).toBeLessThan(1000); // Should complete quickly
    });

    it('should handle complex JSON serialization', async () => {
      const complexValue = {
        users: Array.from({ length: 1000 }, (_, i) => ({
          id: i,
          name: `User ${i}`,
          metadata: { created: new Date().toISOString() }
        }))
      };

      const input = {
        key: 'complex-data',
        value: complexValue,
        stringifyJSON: true
      };

      const start = Date.now();
      await task.execute(input, mockContext);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(2000); // Should handle complex serialization efficiently
    });
  });
});