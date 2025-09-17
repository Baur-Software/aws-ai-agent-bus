// Artifacts List Task Tests
// Tests for ArtifactsListTask with mocked MCP service

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ArtifactsListTask } from '../../../src/workflow/tasks/mcp/ArtifactsListTask';
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
  nodeId: 'artifacts-list-1',
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

describe('ArtifactsListTask', () => {
  let task: ArtifactsListTask;
  let mockMCPService: MockMCPService;
  let mockLogger: MockLogger;
  let mockContext: WorkflowContext;

  beforeEach(() => {
    mockMCPService = new MockMCPService();
    mockLogger = new MockLogger();
    task = new ArtifactsListTask(mockMCPService, mockLogger);
    mockContext = createMockContext();
  });

  describe('task metadata', () => {
    it('should have correct task type', () => {
      expect(task.type).toBe('artifacts-list');
    });

    it('should have correct display info', () => {
      const displayInfo = task.getDisplayInfo();

      expect(displayInfo).toEqual({
        category: NODE_CATEGORIES.MCP_TOOLS,
        label: 'List Artifacts',
        icon: 'FileText',
        color: 'bg-purple-600',
        description: 'List stored artifacts with optional prefix filter',
        tags: ['mcp', 'artifacts', 'list', 'storage']
      });
    });

    it('should have correct schema', () => {
      const schema = task.getSchema();

      expect(schema.title).toBe('List Artifacts');
      expect(schema.properties.prefix).toBeDefined();
      expect(schema.required).toEqual([]);
    });
  });

  describe('input validation', () => {
    it('should validate valid input with prefix', () => {
      const input = {
        prefix: 'reports/'
      };

      const validation = task.validate(input);

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toEqual([]);
    });

    it('should validate empty input (no prefix)', () => {
      const input = {};

      const validation = task.validate(input);

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toEqual([]);
    });

    it('should reject prefix that is too long', () => {
      const input = {
        prefix: 'x'.repeat(513) // Over 512 character limit
      };

      const validation = task.validate(input);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Prefix cannot exceed 512 characters');
    });

    it('should accept prefix at maximum length', () => {
      const input = {
        prefix: 'x'.repeat(512) // Exactly 512 characters
      };

      const validation = task.validate(input);

      expect(validation.isValid).toBe(true);
    });

    it('should accept empty prefix', () => {
      const input = {
        prefix: ''
      };

      const validation = task.validate(input);

      expect(validation.isValid).toBe(true);
    });
  });

  describe('task execution', () => {
    const mockArtifactsList = [
      {
        key: 'reports/monthly-2024-01.json',
        lastModified: '2024-01-31T23:59:59.000Z',
        size: 1024,
        contentType: 'application/json'
      },
      {
        key: 'reports/weekly-2024-w05.pdf',
        lastModified: '2024-02-02T12:00:00.000Z',
        size: 2048,
        contentType: 'application/pdf'
      },
      {
        key: 'templates/email-template.html',
        lastModified: '2024-01-15T09:30:00.000Z',
        size: 512,
        contentType: 'text/html'
      }
    ];

    it('should execute successfully with prefix filter', async () => {
      const filteredList = mockArtifactsList.filter(item => item.key.startsWith('reports/'));
      mockMCPService.artifactsList.mockResolvedValue(filteredList);

      const input = {
        prefix: 'reports/'
      };

      const result = await task.execute(input, mockContext);

      expect(mockMCPService.artifactsList).toHaveBeenCalledWith('reports/');
      
      expect(result).toEqual({
        artifacts: filteredList,
        count: 2,
        prefix: 'reports/',
        timestamp: expect.any(String)
      });

      expect(mockContext.data.artifactsList).toEqual(filteredList);
      expect(mockContext.data.artifactsCount).toBe(2);
    });

    it('should execute successfully without prefix (list all)', async () => {
      mockMCPService.artifactsList.mockResolvedValue(mockArtifactsList);

      const input = {};

      const result = await task.execute(input, mockContext);

      expect(mockMCPService.artifactsList).toHaveBeenCalledWith('');
      
      expect(result).toEqual({
        artifacts: mockArtifactsList,
        count: 3,
        prefix: '',
        timestamp: expect.any(String)
      });

      expect(mockContext.data.artifactsList).toEqual(mockArtifactsList);
      expect(mockContext.data.artifactsCount).toBe(3);
    });

    it('should handle empty results', async () => {
      mockMCPService.artifactsList.mockResolvedValue([]);

      const input = {
        prefix: 'nonexistent/'
      };

      const result = await task.execute(input, mockContext);

      expect(result.artifacts).toEqual([]);
      expect(result.count).toBe(0);
      expect(result.prefix).toBe('nonexistent/');
    });

    it('should log execution progress', async () => {
      mockMCPService.artifactsList.mockResolvedValue(mockArtifactsList);

      const input = { prefix: 'reports/' };
      await task.execute(input, mockContext);

      expect(mockLogger.info).toHaveBeenCalledWith('Listing artifacts with prefix: reports/');
      expect(mockLogger.info).toHaveBeenCalledWith('Found 3 artifacts');
    });

    it('should log when no prefix is provided', async () => {
      mockMCPService.artifactsList.mockResolvedValue(mockArtifactsList);

      const input = {};
      await task.execute(input, mockContext);

      expect(mockLogger.info).toHaveBeenCalledWith('Listing all artifacts');
    });

    it('should throw TaskExecutionError on service failure', async () => {
      const serviceError = new Error('Artifacts service unavailable');
      mockMCPService.artifactsList.mockRejectedValue(serviceError);

      const input = { prefix: 'test/' };

      await expect(task.execute(input, mockContext)).rejects.toThrow(TaskExecutionError);
      await expect(task.execute(input, mockContext)).rejects.toThrow(
        'MCP artifacts list failed: Artifacts service unavailable'
      );

      expect(mockLogger.error).toHaveBeenCalledWith('Failed to list artifacts:', serviceError);
    });
  });

  describe('artifact data handling', () => {
    it('should handle artifacts with missing metadata', async () => {
      const incompleteArtifacts = [
        {
          key: 'minimal-artifact.txt'
          // Missing lastModified, size, contentType
        },
        {
          key: 'partial-artifact.json',
          size: 256
          // Missing lastModified, contentType
        }
      ];

      mockMCPService.artifactsList.mockResolvedValue(incompleteArtifacts);

      const input = {};
      const result = await task.execute(input, mockContext);

      expect(result.artifacts).toEqual(incompleteArtifacts);
      expect(result.count).toBe(2);
    });

    it('should handle large artifact lists efficiently', async () => {
      const largeArtifactsList = Array.from({ length: 10000 }, (_, i) => ({
        key: `artifact-${i}.txt`,
        lastModified: new Date().toISOString(),
        size: i * 100,
        contentType: 'text/plain'
      }));

      mockMCPService.artifactsList.mockResolvedValue(largeArtifactsList);

      const start = Date.now();
      const input = {};
      const result = await task.execute(input, mockContext);
      const duration = Date.now() - start;

      expect(result.count).toBe(10000);
      expect(duration).toBeLessThan(2000); // Should handle large lists efficiently
    });

    it('should handle special characters in artifact keys', async () => {
      const specialArtifacts = [
        {
          key: 'files/report with spaces.pdf',
          lastModified: '2024-01-01T00:00:00.000Z',
          size: 1024,
          contentType: 'application/pdf'
        },
        {
          key: 'files/chinese-文档.txt',
          lastModified: '2024-01-01T00:00:00.000Z',
          size: 512,
          contentType: 'text/plain'
        },
        {
          key: 'files/special-chars-@#$%.json',
          lastModified: '2024-01-01T00:00:00.000Z',
          size: 256,
          contentType: 'application/json'
        }
      ];

      mockMCPService.artifactsList.mockResolvedValue(specialArtifacts);

      const input = {};
      const result = await task.execute(input, mockContext);

      expect(result.artifacts).toEqual(specialArtifacts);
      expect(result.count).toBe(3);
    });
  });

  describe('prefix filtering behavior', () => {
    it('should handle nested prefix paths', async () => {
      const nestedArtifacts = [
        { key: 'a/b/c/deep-file.txt' },
        { key: 'a/b/shallow-file.txt' },
        { key: 'a/top-file.txt' }
      ];

      mockMCPService.artifactsList.mockResolvedValue(nestedArtifacts);

      const input = { prefix: 'a/b/c/' };
      const result = await task.execute(input, mockContext);

      expect(mockMCPService.artifactsList).toHaveBeenCalledWith('a/b/c/');
      expect(result.artifacts).toEqual(nestedArtifacts);
      expect(result.prefix).toBe('a/b/c/');
    });

    it('should handle prefix without trailing slash', async () => {
      const artifacts = [
        { key: 'temp1.txt' },
        { key: 'temp2.txt' },
        { key: 'temporary.txt' }
      ];

      mockMCPService.artifactsList.mockResolvedValue(artifacts);

      const input = { prefix: 'temp' };
      await task.execute(input, mockContext);

      expect(mockMCPService.artifactsList).toHaveBeenCalledWith('temp');
    });
  });

  describe('integration with workflow context', () => {
    it('should work without logger', () => {
      const taskWithoutLogger = new ArtifactsListTask(mockMCPService);
      expect(taskWithoutLogger.type).toBe('artifacts-list');
    });

    it('should preserve existing context data', async () => {
      mockMCPService.artifactsList.mockResolvedValue([]);

      const contextWithExistingData = createMockContext({
        data: { existingKey: 'existing value' }
      });

      const input = {};
      await task.execute(input, contextWithExistingData);

      expect(contextWithExistingData.data.existingKey).toBe('existing value');
      expect(contextWithExistingData.data.artifactsList).toEqual([]);
    });

    it('should handle concurrent executions', async () => {
      mockMCPService.artifactsList
        .mockResolvedValueOnce([{ key: 'file1.txt' }])
        .mockResolvedValueOnce([{ key: 'file2.txt' }]);

      const context1 = createMockContext({ nodeId: 'node-1' });
      const context2 = createMockContext({ nodeId: 'node-2' });

      const [result1, result2] = await Promise.all([
        task.execute({ prefix: 'prefix1/' }, context1),
        task.execute({ prefix: 'prefix2/' }, context2)
      ]);

      expect(result1.artifacts).toEqual([{ key: 'file1.txt' }]);
      expect(result2.artifacts).toEqual([{ key: 'file2.txt' }]);
      expect(mockMCPService.artifactsList).toHaveBeenCalledTimes(2);
    });
  });
});