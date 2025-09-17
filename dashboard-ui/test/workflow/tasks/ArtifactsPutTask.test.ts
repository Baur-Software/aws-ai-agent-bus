// Artifacts Put Task Tests  
// Tests for ArtifactsPutTask with mocked MCP service

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ArtifactsPutTask } from '../../../src/workflow/tasks/mcp/ArtifactsPutTask';
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
  nodeId: 'artifacts-put-1',
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

describe('ArtifactsPutTask', () => {
  let task: ArtifactsPutTask;
  let mockMCPService: MockMCPService;
  let mockLogger: MockLogger;
  let mockContext: WorkflowContext;

  beforeEach(() => {
    mockMCPService = new MockMCPService();
    mockLogger = new MockLogger();
    task = new ArtifactsPutTask(mockMCPService, mockLogger);
    mockContext = createMockContext();

    // Default successful mock
    mockMCPService.artifactsPut.mockResolvedValue({ success: true });
  });

  describe('task metadata', () => {
    it('should have correct task type', () => {
      expect(task.type).toBe('artifacts-put');
    });

    it('should have correct display info', () => {
      const displayInfo = task.getDisplayInfo();

      expect(displayInfo).toEqual({
        category: NODE_CATEGORIES.MCP_TOOLS,
        label: 'Store Artifact',
        icon: 'Upload',
        color: 'bg-purple-600',
        description: 'Store content as an artifact',
        tags: ['mcp', 'artifacts', 'put', 'upload', 'store']
      });
    });

    it('should have correct schema', () => {
      const schema = task.getSchema();

      expect(schema.title).toBe('Store Artifact');
      expect(schema.properties.key).toBeDefined();
      expect(schema.properties.content).toBeDefined();
      expect(schema.properties.contentType).toBeDefined();
      expect(schema.properties.useContextData).toBeDefined();
      expect(schema.properties.contextKey).toBeDefined();
      expect(schema.properties.stringifyJSON).toBeDefined();
      expect(schema.required).toEqual(['key']);
    });
  });

  describe('input validation', () => {
    it('should validate valid input with direct content', () => {
      const input = {
        key: 'reports/monthly-report.json',
        content: { month: 'January', sales: 15000 },
        contentType: 'application/json'
      };

      const validation = task.validate(input);

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toEqual([]);
    });

    it('should reject missing key', () => {
      const input = {
        content: 'test content'
      };

      const validation = task.validate(input);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Key is required');
    });

    it('should reject empty key', () => {
      const input = {
        key: '',
        content: 'test content'
      };

      const validation = task.validate(input);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Key is required');
    });

    it('should reject key that is too long', () => {
      const input = {
        key: 'x'.repeat(1025), // Over 1024 character limit
        content: 'test content'
      };

      const validation = task.validate(input);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Key cannot exceed 1024 characters');
    });

    it('should require content when not using context data', () => {
      const input = {
        key: 'test-artifact',
        useContextData: false
        // No content provided
      };

      const validation = task.validate(input);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Content is required when not using context data');
    });

    it('should allow missing content when using context data', () => {
      const input = {
        key: 'test-artifact',
        useContextData: true
      };

      const validation = task.validate(input);

      expect(validation.isValid).toBe(true);
    });

    it('should warn about missing context key', () => {
      const input = {
        key: 'test-artifact',
        useContextData: true
        // No contextKey specified
      };

      const validation = task.validate(input);

      expect(validation.isValid).toBe(true);
      expect(validation.warnings).toContain('No context key specified, will use "previousResult"');
    });

    it('should validate content type format', () => {
      const validInput = {
        key: 'test-artifact',
        content: 'test',
        contentType: 'text/plain'
      };

      const validation = task.validate(validInput);
      expect(validation.isValid).toBe(true);
    });
  });

  describe('task execution', () => {
    it('should execute successfully with direct content', async () => {
      const input = {
        key: 'documents/readme.txt',
        content: 'This is a README file',
        contentType: 'text/plain'
      };

      const result = await task.execute(input, mockContext);

      expect(mockMCPService.artifactsPut).toHaveBeenCalledWith(
        'documents/readme.txt',
        'This is a README file',
        'text/plain'
      );

      expect(result).toEqual({
        key: 'documents/readme.txt',
        success: true,
        size: 19,
        contentType: 'text/plain',
        timestamp: expect.any(String)
      });

      expect(mockContext.data.artifactKey).toBe('documents/readme.txt');
      expect(mockContext.data.artifactContent).toBe('This is a README file');
    });

    it('should execute successfully with context data', async () => {
      const contextWithData = createMockContext({
        data: { previousResult: { report: 'Monthly data', total: 5000 } }
      });

      const input = {
        key: 'reports/context-report.json',
        useContextData: true,
        contentType: 'application/json'
      };

      const result = await task.execute(input, contextWithData);

      expect(mockMCPService.artifactsPut).toHaveBeenCalledWith(
        'reports/context-report.json',
        { report: 'Monthly data', total: 5000 },
        'application/json'
      );

      expect(result.key).toBe('reports/context-report.json');
      expect(result.success).toBe(true);
    });

    it('should use custom context key', async () => {
      const contextWithData = createMockContext({
        data: { customData: 'custom content' }
      });

      const input = {
        key: 'custom-artifact.txt',
        useContextData: true,
        contextKey: 'customData'
      };

      await task.execute(input, contextWithData);

      expect(mockMCPService.artifactsPut).toHaveBeenCalledWith(
        'custom-artifact.txt',
        'custom content',
        'text/plain' // Default content type
      );
    });

    it('should use default content type when not specified', async () => {
      const input = {
        key: 'test-file',
        content: 'test content'
      };

      await task.execute(input, mockContext);

      expect(mockMCPService.artifactsPut).toHaveBeenCalledWith(
        'test-file',
        'test content',
        'text/plain'
      );
    });

    it('should stringify JSON objects when stringifyJSON is true', async () => {
      const input = {
        key: 'config/settings.json',
        content: { theme: 'dark', notifications: true },
        contentType: 'application/json',
        stringifyJSON: true
      };

      await task.execute(input, mockContext);

      const expectedContent = JSON.stringify({ theme: 'dark', notifications: true }, null, 2);
      expect(mockMCPService.artifactsPut).toHaveBeenCalledWith(
        'config/settings.json',
        expectedContent,
        'application/json'
      );
    });

    it('should not stringify when stringifyJSON is false', async () => {
      const input = {
        key: 'data/raw-object.json',
        content: { keep: 'as object' },
        stringifyJSON: false
      };

      await task.execute(input, mockContext);

      expect(mockMCPService.artifactsPut).toHaveBeenCalledWith(
        'data/raw-object.json',
        { keep: 'as object' },
        'text/plain'
      );
    });

    it('should calculate content size correctly for different types', async () => {
      const testCases = [
        { content: 'hello', expectedSize: 5 },
        { content: { key: 'value' }, expectedSize: 15 }, // JSON.stringify length
        { content: [1, 2, 3], expectedSize: 7 }, // JSON.stringify length
        { content: Buffer.from('binary'), expectedSize: 6 }
      ];

      for (const testCase of testCases) {
        const input = { key: 'test', content: testCase.content };
        const result = await task.execute(input, mockContext);

        expect(result.size).toBe(testCase.expectedSize);
      }
    });

    it('should log execution progress', async () => {
      const input = {
        key: 'test-artifact.txt',
        content: 'test content'
      };

      await task.execute(input, mockContext);

      expect(mockLogger.info).toHaveBeenCalledWith('Storing artifact: test-artifact.txt');
      expect(mockLogger.info).toHaveBeenCalledWith('Successfully stored artifact: test-artifact.txt (12 bytes)');
    });

    it('should throw error when context key is missing', async () => {
      const contextWithoutData = createMockContext({
        data: {} // Empty data
      });

      const input = {
        key: 'test-artifact',
        useContextData: true,
        contextKey: 'missingKey'
      };

      await expect(task.execute(input, contextWithoutData)).rejects.toThrow(
        "Context data key 'missingKey' not found"
      );
    });

    it('should throw TaskExecutionError on service failure', async () => {
      const serviceError = new Error('Storage quota exceeded');
      mockMCPService.artifactsPut.mockRejectedValue(serviceError);

      const input = {
        key: 'large-file.txt',
        content: 'x'.repeat(1000000) // Large content
      };

      await expect(task.execute(input, mockContext)).rejects.toThrow(TaskExecutionError);
      await expect(task.execute(input, mockContext)).rejects.toThrow(
        'MCP artifacts put failed: Storage quota exceeded'
      );

      expect(mockLogger.error).toHaveBeenCalledWith('Failed to store artifact:', serviceError);
    });
  });

  describe('content type handling', () => {
    it('should auto-detect content type for common file extensions', async () => {
      const testCases = [
        { key: 'file.json', expectedType: 'application/json' },
        { key: 'file.xml', expectedType: 'application/xml' },
        { key: 'file.html', expectedType: 'text/html' },
        { key: 'file.css', expectedType: 'text/css' },
        { key: 'file.js', expectedType: 'application/javascript' },
        { key: 'file.pdf', expectedType: 'application/pdf' },
        { key: 'file.png', expectedType: 'image/png' },
        { key: 'file.jpg', expectedType: 'image/jpeg' },
        { key: 'unknown.xyz', expectedType: 'text/plain' } // Unknown extension
      ];

      for (const testCase of testCases) {
        const input = { key: testCase.key, content: 'test' };
        await task.execute(input, mockContext);

        expect(mockMCPService.artifactsPut).toHaveBeenCalledWith(
          testCase.key,
          'test',
          testCase.expectedType
        );
      }
    });

    it('should override auto-detection when contentType is explicitly provided', async () => {
      const input = {
        key: 'file.json', // Would normally be application/json
        content: 'not json content',
        contentType: 'text/plain'
      };

      await task.execute(input, mockContext);

      expect(mockMCPService.artifactsPut).toHaveBeenCalledWith(
        'file.json',
        'not json content',
        'text/plain'
      );
    });
  });

  describe('edge cases and data types', () => {
    it('should handle different data types correctly', async () => {
      const testCases = [
        { content: 'string content', description: 'string' },
        { content: 42, description: 'number' },
        { content: true, description: 'boolean' },
        { content: null, description: 'null' },
        { content: undefined, description: 'undefined' },
        { content: { object: 'data' }, description: 'object' },
        { content: [1, 2, 3], description: 'array' },
        { content: Buffer.from('binary'), description: 'buffer' }
      ];

      for (const testCase of testCases) {
        const input = { key: `test-${testCase.description}`, content: testCase.content };
        const result = await task.execute(input, mockContext);

        expect(result.success).toBe(true);
        expect(mockMCPService.artifactsPut).toHaveBeenCalledWith(
          `test-${testCase.description}`,
          testCase.content,
          'text/plain'
        );
      }
    });

    it('should handle empty content', async () => {
      const input = {
        key: 'empty-file.txt',
        content: ''
      };

      const result = await task.execute(input, mockContext);

      expect(result.size).toBe(0);
      expect(result.success).toBe(true);
    });

    it('should handle large content efficiently', async () => {
      const largeContent = 'x'.repeat(1000000); // 1MB content

      const input = {
        key: 'large-file.txt',
        content: largeContent
      };

      const start = Date.now();
      const result = await task.execute(input, mockContext);
      const duration = Date.now() - start;

      expect(result.size).toBe(1000000);
      expect(duration).toBeLessThan(2000); // Should handle large content efficiently
    });

    it('should handle complex nested objects', async () => {
      const complexObject = {
        metadata: {
          created: new Date().toISOString(),
          author: 'system'
        },
        data: Array.from({ length: 100 }, (_, i) => ({
          id: i,
          name: `Item ${i}`,
          properties: { active: i % 2 === 0, score: Math.random() }
        }))
      };

      const input = {
        key: 'complex-data.json',
        content: complexObject,
        stringifyJSON: true
      };

      const result = await task.execute(input, mockContext);

      expect(result.success).toBe(true);
      expect(mockMCPService.artifactsPut).toHaveBeenCalledWith(
        'complex-data.json',
        JSON.stringify(complexObject, null, 2),
        'text/plain'
      );
    });
  });

  describe('integration with workflow context', () => {
    it('should work without logger', () => {
      const taskWithoutLogger = new ArtifactsPutTask(mockMCPService);
      expect(taskWithoutLogger.type).toBe('artifacts-put');
    });

    it('should preserve existing context data', async () => {
      const contextWithExistingData = createMockContext({
        data: { existingKey: 'existing value' }
      });

      const input = {
        key: 'new-artifact.txt',
        content: 'new content'
      };

      await task.execute(input, contextWithExistingData);

      expect(contextWithExistingData.data.existingKey).toBe('existing value');
      expect(contextWithExistingData.data.artifactKey).toBe('new-artifact.txt');
    });

    it('should handle concurrent executions', async () => {
      const context1 = createMockContext({ nodeId: 'node-1' });
      const context2 = createMockContext({ nodeId: 'node-2' });

      const input1 = { key: 'file1.txt', content: 'content 1' };
      const input2 = { key: 'file2.txt', content: 'content 2' };

      await Promise.all([
        task.execute(input1, context1),
        task.execute(input2, context2)
      ]);

      expect(mockMCPService.artifactsPut).toHaveBeenCalledWith('file1.txt', 'content 1', 'text/plain');
      expect(mockMCPService.artifactsPut).toHaveBeenCalledWith('file2.txt', 'content 2', 'text/plain');
      expect(mockMCPService.artifactsPut).toHaveBeenCalledTimes(2);
    });
  });
});