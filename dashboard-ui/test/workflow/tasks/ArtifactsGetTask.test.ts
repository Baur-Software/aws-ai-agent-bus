// Artifacts Get Task Tests
// Tests for ArtifactsGetTask with mocked MCP service

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ArtifactsGetTask } from '../../../src/workflow/tasks/mcp/ArtifactsGetTask';
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
  nodeId: 'artifacts-get-1',
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

describe('ArtifactsGetTask', () => {
  let task: ArtifactsGetTask;
  let mockMCPService: MockMCPService;
  let mockLogger: MockLogger;
  let mockContext: WorkflowContext;

  beforeEach(() => {
    mockMCPService = new MockMCPService();
    mockLogger = new MockLogger();
    task = new ArtifactsGetTask(mockMCPService, mockLogger);
    mockContext = createMockContext();
  });

  describe('task metadata', () => {
    it('should have correct task type', () => {
      expect(task.type).toBe('artifacts-get');
    });

    it('should have correct display info', () => {
      const displayInfo = task.getDisplayInfo();

      expect(displayInfo).toEqual({
        category: NODE_CATEGORIES.MCP_TOOLS,
        label: 'Get Artifact',
        icon: 'Download',
        color: 'bg-purple-600',
        description: 'Retrieve an artifact by key',
        tags: ['mcp', 'artifacts', 'get', 'download']
      });
    });

    it('should have correct schema', () => {
      const schema = task.getSchema();

      expect(schema.title).toBe('Get Artifact');
      expect(schema.properties.key).toBeDefined();
      expect(schema.properties.parseJSON).toBeDefined();
      expect(schema.required).toEqual(['key']);
    });
  });

  describe('input validation', () => {
    it('should validate valid input', () => {
      const input = {
        key: 'reports/monthly-report.json',
        parseJSON: true
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

    it('should accept optional parseJSON parameter', () => {
      const input = {
        key: 'test-artifact.json'
        // parseJSON not specified - should default to false
      };

      const validation = task.validate(input);

      expect(validation.isValid).toBe(true);
    });
  });

  describe('task execution', () => {
    it('should execute successfully and retrieve text content', async () => {
      const mockContent = 'This is a text file content';
      mockMCPService.artifactsGet.mockResolvedValue(mockContent);

      const input = {
        key: 'documents/readme.txt'
      };

      const result = await task.execute(input, mockContext);

      expect(mockMCPService.artifactsGet).toHaveBeenCalledWith('documents/readme.txt');
      
      expect(result).toEqual({
        key: 'documents/readme.txt',
        content: mockContent,
        contentType: 'text',
        size: mockContent.length,
        timestamp: expect.any(String)
      });

      expect(mockContext.data.artifactKey).toBe('documents/readme.txt');
      expect(mockContext.data.artifactContent).toBe(mockContent);
    });

    it('should parse JSON content when parseJSON is true', async () => {
      const mockJSONString = '{"name": "test", "value": 42, "active": true}';
      const expectedJSON = { name: 'test', value: 42, active: true };
      mockMCPService.artifactsGet.mockResolvedValue(mockJSONString);

      const input = {
        key: 'config/settings.json',
        parseJSON: true
      };

      const result = await task.execute(input, mockContext);

      expect(result.content).toEqual(expectedJSON);
      expect(result.contentType).toBe('json');
      expect(mockContext.data.artifactContent).toEqual(expectedJSON);
    });

    it('should handle malformed JSON gracefully when parseJSON is true', async () => {
      const malformedJSON = '{"name": "test", "value": 42'; // Missing closing brace
      mockMCPService.artifactsGet.mockResolvedValue(malformedJSON);

      const input = {
        key: 'broken.json',
        parseJSON: true
      };

      await expect(task.execute(input, mockContext)).rejects.toThrow(TaskExecutionError);
      await expect(task.execute(input, mockContext)).rejects.toThrow(
        'Failed to parse JSON content'
      );
    });

    it('should not parse JSON when parseJSON is false', async () => {
      const jsonString = '{"name": "test"}';
      mockMCPService.artifactsGet.mockResolvedValue(jsonString);

      const input = {
        key: 'data.json',
        parseJSON: false
      };

      const result = await task.execute(input, mockContext);

      expect(result.content).toBe(jsonString); // Should remain as string
      expect(result.contentType).toBe('text');
    });

    it('should handle binary content', async () => {
      const binaryContent = Buffer.from([0x89, 0x50, 0x4E, 0x47]); // PNG header
      mockMCPService.artifactsGet.mockResolvedValue(binaryContent);

      const input = {
        key: 'images/logo.png'
      };

      const result = await task.execute(input, mockContext);

      expect(result.content).toBe(binaryContent);
      expect(result.contentType).toBe('binary');
    });

    it('should log execution progress', async () => {
      mockMCPService.artifactsGet.mockResolvedValue('test content');

      const input = { key: 'test-file.txt' };
      await task.execute(input, mockContext);

      expect(mockLogger.info).toHaveBeenCalledWith('Getting artifact: test-file.txt');
      expect(mockLogger.info).toHaveBeenCalledWith('Successfully retrieved artifact: test-file.txt (12 bytes)');
    });

    it('should log JSON parsing when enabled', async () => {
      mockMCPService.artifactsGet.mockResolvedValue('{"test": true}');

      const input = { key: 'test.json', parseJSON: true };
      await task.execute(input, mockContext);

      expect(mockLogger.info).toHaveBeenCalledWith('Parsing JSON content for artifact: test.json');
    });

    it('should throw TaskExecutionError on service failure', async () => {
      const serviceError = new Error('Artifact not found');
      mockMCPService.artifactsGet.mockRejectedValue(serviceError);

      const input = { key: 'missing-file.txt' };

      await expect(task.execute(input, mockContext)).rejects.toThrow(TaskExecutionError);
      await expect(task.execute(input, mockContext)).rejects.toThrow(
        'MCP artifacts get failed: Artifact not found'
      );

      expect(mockLogger.error).toHaveBeenCalledWith('Failed to get artifact:', serviceError);
    });
  });

  describe('content type detection', () => {
    it('should detect different content types correctly', async () => {
      const testCases = [
        { content: 'plain text', expectedType: 'text' },
        { content: Buffer.from('binary data'), expectedType: 'binary' },
        { content: { object: 'data' }, expectedType: 'object' },
        { content: [1, 2, 3], expectedType: 'array' },
        { content: 42, expectedType: 'number' },
        { content: true, expectedType: 'boolean' },
        { content: null, expectedType: 'null' }
      ];

      for (const testCase of testCases) {
        mockMCPService.artifactsGet.mockResolvedValue(testCase.content);

        const input = { key: `test-${testCase.expectedType}` };
        const result = await task.execute(input, mockContext);

        expect(result.contentType).toBe(testCase.expectedType);
      }
    });

    it('should override content type to json when parsing JSON', async () => {
      mockMCPService.artifactsGet.mockResolvedValue('{"data": "test"}');

      const input = { key: 'test.json', parseJSON: true };
      const result = await task.execute(input, mockContext);

      expect(result.contentType).toBe('json');
    });
  });

  describe('large content handling', () => {
    it('should handle large text files efficiently', async () => {
      const largeContent = 'x'.repeat(1000000); // 1MB text
      mockMCPService.artifactsGet.mockResolvedValue(largeContent);

      const start = Date.now();
      const input = { key: 'large-file.txt' };
      const result = await task.execute(input, mockContext);
      const duration = Date.now() - start;

      expect(result.size).toBe(1000000);
      expect(duration).toBeLessThan(2000); // Should handle large files efficiently
    });

    it('should handle large JSON files when parsing', async () => {
      const largeObject = {
        data: Array.from({ length: 10000 }, (_, i) => ({ id: i, name: `Item ${i}` }))
      };
      const largeJSONString = JSON.stringify(largeObject);
      mockMCPService.artifactsGet.mockResolvedValue(largeJSONString);

      const input = { key: 'large-data.json', parseJSON: true };
      const result = await task.execute(input, mockContext);

      expect(result.content).toEqual(largeObject);
      expect(result.contentType).toBe('json');
    });
  });

  describe('edge cases', () => {
    it('should handle empty content', async () => {
      mockMCPService.artifactsGet.mockResolvedValue('');

      const input = { key: 'empty-file.txt' };
      const result = await task.execute(input, mockContext);

      expect(result.content).toBe('');
      expect(result.size).toBe(0);
    });

    it('should handle null content', async () => {
      mockMCPService.artifactsGet.mockResolvedValue(null);

      const input = { key: 'null-content' };
      const result = await task.execute(input, mockContext);

      expect(result.content).toBe(null);
      expect(result.contentType).toBe('null');
    });

    it('should handle whitespace-only JSON', async () => {
      mockMCPService.artifactsGet.mockResolvedValue('   \n  \t  ');

      const input = { key: 'whitespace.json', parseJSON: true };

      await expect(task.execute(input, mockContext)).rejects.toThrow(TaskExecutionError);
    });
  });

  describe('integration with workflow context', () => {
    it('should work without logger', () => {
      const taskWithoutLogger = new ArtifactsGetTask(mockMCPService);
      expect(taskWithoutLogger.type).toBe('artifacts-get');
    });

    it('should preserve existing context data', async () => {
      mockMCPService.artifactsGet.mockResolvedValue('test content');

      const contextWithExistingData = createMockContext({
        data: { existingKey: 'existing value' }
      });

      const input = { key: 'test-file.txt' };
      await task.execute(input, contextWithExistingData);

      expect(contextWithExistingData.data.existingKey).toBe('existing value');
      expect(contextWithExistingData.data.artifactKey).toBe('test-file.txt');
    });

    it('should handle concurrent executions', async () => {
      mockMCPService.artifactsGet
        .mockResolvedValueOnce('content 1')
        .mockResolvedValueOnce('content 2');

      const context1 = createMockContext({ nodeId: 'node-1' });
      const context2 = createMockContext({ nodeId: 'node-2' });

      const [result1, result2] = await Promise.all([
        task.execute({ key: 'file1.txt' }, context1),
        task.execute({ key: 'file2.txt' }, context2)
      ]);

      expect(result1.content).toBe('content 1');
      expect(result2.content).toBe('content 2');
      expect(mockMCPService.artifactsGet).toHaveBeenCalledTimes(2);
    });
  });
});