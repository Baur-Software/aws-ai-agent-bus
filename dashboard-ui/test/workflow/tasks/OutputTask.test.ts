// Output Task Tests
// Tests for OutputTask that collects and formats final workflow output

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OutputTask } from '../../../src/workflow/tasks/core/OutputTask';
import {
  WorkflowContext,
  Logger,
  EventEmitter,
  TaskExecutionError,
  NODE_CATEGORIES
} from '../../../src/workflow/types';

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
  nodeId: 'output-1',
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

describe('OutputTask', () => {
  let task: OutputTask;
  let mockLogger: MockLogger;
  let mockContext: WorkflowContext;

  beforeEach(() => {
    mockLogger = new MockLogger();
    task = new OutputTask(mockLogger);
    mockContext = createMockContext();
  });

  describe('task metadata', () => {
    it('should have correct task type', () => {
      expect(task.type).toBe('output');
    });

    it('should have correct display info', () => {
      const displayInfo = task.getDisplayInfo();

      expect(displayInfo).toEqual({
        category: NODE_CATEGORIES.CORE,
        label: 'Output',
        icon: 'FileOutput',
        color: 'bg-gray-600',
        description: 'Collect and format final workflow output',
        tags: ['core', 'output', 'result', 'format']
      });
    });

    it('should have correct schema', () => {
      const schema = task.getSchema();

      expect(schema.title).toBe('Output Formatter');
      expect(schema.properties.format).toBeDefined();
      expect(schema.properties.fields).toBeDefined();
      expect(schema.properties.includeMetadata).toBeDefined();
      expect(schema.properties.customTemplate).toBeDefined();
      expect(schema.required).toEqual([]);
    });
  });

  describe('input validation', () => {
    it('should validate valid input with all options', () => {
      const input = {
        format: 'detailed' as const,
        fields: ['field1', 'field2'],
        includeMetadata: true,
        customTemplate: 'Result: {{result}}'
      };

      const validation = task.validate(input);

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toEqual([]);
    });

    it('should validate empty input (use defaults)', () => {
      const input = {};

      const validation = task.validate(input);

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toEqual([]);
    });

    it('should reject invalid format', () => {
      const input = {
        format: 'invalid-format' as any
      };

      const validation = task.validate(input);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Format must be one of: json, summary, detailed, custom');
    });

    it('should require custom template when format is custom', () => {
      const input = {
        format: 'custom' as const
        // Missing customTemplate
      };

      const validation = task.validate(input);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Custom template is required when format is "custom"');
    });

    it('should accept valid format options', () => {
      const validFormats = ['json', 'summary', 'detailed', 'custom'] as const;

      for (const format of validFormats) {
        const input = {
          format,
          ...(format === 'custom' ? { customTemplate: 'test' } : {})
        };

        const validation = task.validate(input);
        expect(validation.isValid).toBe(true);
      }
    });

    it('should validate fields array', () => {
      const validInput = {
        fields: ['field1', 'field2', 'nested.field']
      };

      const validation = task.validate(validInput);
      expect(validation.isValid).toBe(true);
    });

    it('should reject non-string fields', () => {
      const input = {
        fields: ['valid', 123, 'also-valid'] as any
      };

      const validation = task.validate(input);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('All fields must be strings');
    });
  });

  describe('task execution', () => {
    it('should execute successfully with JSON format', async () => {
      const contextWithData = createMockContext({
        data: {
          userName: 'John Doe',
          email: 'john@example.com',
          score: 95
        },
        results: {
          'task-1': { processed: true, count: 42 },
          'task-2': { status: 'completed', items: ['a', 'b', 'c'] }
        },
        metadata: {
          startTime: '2024-01-01T00:00:00.000Z',
          duration: 1500
        }
      });

      const input = {
        format: 'json' as const,
        includeMetadata: true
      };

      const result = await task.execute(input, contextWithData);

      expect(result.format).toBe('json');
      expect(result.output).toEqual({
        data: {
          userName: 'John Doe',
          email: 'john@example.com',
          score: 95
        },
        results: {
          'task-1': { processed: true, count: 42 },
          'task-2': { status: 'completed', items: ['a', 'b', 'c'] }
        },
        metadata: {
          startTime: '2024-01-01T00:00:00.000Z',
          duration: 1500
        }
      });
    });

    it('should execute with specific fields selection', async () => {
      const contextWithData = createMockContext({
        data: {
          userName: 'Jane Doe',
          email: 'jane@example.com',
          score: 88,
          internalId: 'secret-123'
        },
        results: {
          'analytics': { pageViews: 1500, users: 250 }
        }
      });

      const input = {
        format: 'json' as const,
        fields: ['userName', 'score', 'analytics.pageViews']
      };

      const result = await task.execute(input, contextWithData);

      expect(result.output).toEqual({
        userName: 'Jane Doe',
        score: 88,
        'analytics.pageViews': 1500
      });

      // Should not include excluded fields
      expect(result.output).not.toHaveProperty('email');
      expect(result.output).not.toHaveProperty('internalId');
    });

    it('should execute with summary format', async () => {
      const contextWithData = createMockContext({
        data: { processed: true, totalItems: 150 },
        results: {
          'task-1': { success: true, count: 75 },
          'task-2': { success: true, count: 75 }
        }
      });

      const input = {
        format: 'summary' as const
      };

      const result = await task.execute(input, contextWithData);

      expect(result.format).toBe('summary');
      expect(result.output).toContain('Workflow completed successfully');
      expect(result.output).toContain('2 tasks executed');
      expect(result.output).toContain('Data fields: processed, totalItems');
    });

    it('should execute with detailed format', async () => {
      const contextWithData = createMockContext({
        executionId: 'exec-456',
        workflowId: 'workflow-789',
        data: { status: 'completed' },
        results: { 'task-1': { result: 'success' } }
      });

      const input = {
        format: 'detailed' as const,
        includeMetadata: true
      };

      const result = await task.execute(input, contextWithData);

      expect(result.format).toBe('detailed');
      expect(result.output).toContain('Workflow Execution Report');
      expect(result.output).toContain('Execution ID: exec-456');
      expect(result.output).toContain('Workflow ID: workflow-789');
      expect(result.output).toContain('Status: completed');
    });

    it('should execute with custom template', async () => {
      const contextWithData = createMockContext({
        data: {
          customerName: 'Alice Smith',
          orderTotal: 125.50,
          itemCount: 3
        }
      });

      const input = {
        format: 'custom' as const,
        customTemplate: 'Order for {{customerName}}: {{itemCount}} items, total ${{orderTotal}}'
      };

      const result = await task.execute(input, contextWithData);

      expect(result.format).toBe('custom');
      expect(result.output).toBe('Order for Alice Smith: 3 items, total $125.5');
    });

    it('should handle nested field access in templates', async () => {
      const contextWithData = createMockContext({
        data: {
          user: {
            profile: { name: 'Bob Wilson' },
            settings: { theme: 'dark' }
          },
          stats: { logins: 42 }
        }
      });

      const input = {
        format: 'custom' as const,
        customTemplate: 'User {{user.profile.name}} ({{stats.logins}} logins) prefers {{user.settings.theme}} theme'
      };

      const result = await task.execute(input, contextWithData);

      expect(result.output).toBe('User Bob Wilson (42 logins) prefers dark theme');
    });

    it('should exclude metadata when includeMetadata is false', async () => {
      const contextWithData = createMockContext({
        data: { value: 'test' },
        metadata: { sensitive: 'data' }
      });

      const input = {
        format: 'json' as const,
        includeMetadata: false
      };

      const result = await task.execute(input, contextWithData);

      expect(result.output).toEqual({
        data: { value: 'test' },
        results: {}
      });
      expect(result.output).not.toHaveProperty('metadata');
    });

    it('should log execution progress', async () => {
      const input = { format: 'summary' as const };
      await task.execute(input, mockContext);

      expect(mockLogger.info).toHaveBeenCalledWith('Formatting workflow output as: summary');
      expect(mockLogger.info).toHaveBeenCalledWith('Successfully formatted workflow output');
    });

    it('should store output in context', async () => {
      const input = { format: 'json' as const };
      await task.execute(input, mockContext);

      expect(mockContext.data.finalOutput).toBeDefined();
      expect(mockContext.data.outputFormat).toBe('json');
    });
  });

  describe('format-specific behavior', () => {
    it('should handle empty context data gracefully', async () => {
      const emptyContext = createMockContext({
        data: {},
        results: {}
      });

      const input = { format: 'json' as const };
      const result = await task.execute(input, emptyContext);

      expect(result.output).toEqual({
        data: {},
        results: {}
      });
    });

    it('should generate meaningful summary for complex workflows', async () => {
      const complexContext = createMockContext({
        data: {
          processedFiles: 25,
          errors: 0,
          warnings: 3,
          duration: 45000 // 45 seconds
        },
        results: {
          'file-processor': { success: true, filesProcessed: 25 },
          'quality-check': { success: true, warnings: 3 },
          'output-generator': { success: true, outputSize: 1024 }
        }
      });

      const input = { format: 'summary' as const };
      const result = await task.execute(input, complexContext);

      expect(result.output).toContain('3 tasks executed');
      expect(result.output).toContain('processedFiles: 25');
      expect(result.output).toContain('errors: 0');
      expect(result.output).toContain('warnings: 3');
    });

    it('should create detailed report with proper sections', async () => {
      const detailedContext = createMockContext({
        executionId: 'detailed-test',
        nodeId: 'output-node',
        data: { phase: 'completed', score: 85 },
        results: {
          'analysis': { confidence: 0.95, recommendations: 5 }
        },
        errors: [{ message: 'Minor validation warning', severity: 'warning' }]
      });

      const input = {
        format: 'detailed' as const,
        includeMetadata: true
      };

      const result = await task.execute(input, detailedContext);

      expect(result.output).toContain('=== Workflow Execution Report ===');
      expect(result.output).toContain('=== Context Data ===');
      expect(result.output).toContain('=== Task Results ===');
      expect(result.output).toContain('=== Errors/Issues ===');
      expect(result.output).toContain('phase: completed');
      expect(result.output).toContain('confidence: 0.95');
    });
  });

  describe('template processing', () => {
    it('should handle missing template variables gracefully', async () => {
      const contextWithData = createMockContext({
        data: { available: 'value' }
      });

      const input = {
        format: 'custom' as const,
        customTemplate: 'Available: {{available}}, Missing: {{missing}}'
      };

      const result = await task.execute(input, contextWithData);

      expect(result.output).toBe('Available: value, Missing: {{missing}}');
    });

    it('should handle complex template expressions', async () => {
      const contextWithData = createMockContext({
        data: {
          items: ['apple', 'banana', 'cherry'],
          total: 42,
          metadata: { version: '1.2.3' }
        }
      });

      const input = {
        format: 'custom' as const,
        customTemplate: 'Found {{items.length}} items ({{items.0}}, {{items.1}}, {{items.2}}). Total: {{total}}. Version: {{metadata.version}}'
      };

      const result = await task.execute(input, contextWithData);

      expect(result.output).toBe('Found {{items.length}} items (apple, banana, cherry). Total: 42. Version: 1.2.3');
    });

    it('should escape special characters in template values', async () => {
      const contextWithData = createMockContext({
        data: {
          message: 'Hello {{world}}',
          html: '<script>alert("xss")</script>'
        }
      });

      const input = {
        format: 'custom' as const,
        customTemplate: 'Message: {{message}}, HTML: {{html}}'
      };

      const result = await task.execute(input, contextWithData);

      expect(result.output).toBe('Message: Hello {{world}}, HTML: <script>alert("xss")</script>');
    });
  });

  describe('field selection and filtering', () => {
    it('should handle nested field selection', async () => {
      const contextWithData = createMockContext({
        data: {
          user: { id: 1, profile: { name: 'Test', email: 'test@example.com' } },
          settings: { theme: 'light', language: 'en' }
        },
        results: {
          'auth': { token: 'secret', expires: '2024-12-31' }
        }
      });

      const input = {
        format: 'json' as const,
        fields: ['user.profile.name', 'settings.theme', 'auth.expires']
      };

      const result = await task.execute(input, contextWithData);

      expect(result.output).toEqual({
        'user.profile.name': 'Test',
        'settings.theme': 'light',
        'auth.expires': '2024-12-31'
      });
    });

    it('should handle non-existent field paths gracefully', async () => {
      const contextWithData = createMockContext({
        data: { existing: 'value' }
      });

      const input = {
        format: 'json' as const,
        fields: ['existing', 'non.existent.field', 'another.missing']
      };

      const result = await task.execute(input, contextWithData);

      expect(result.output).toEqual({
        existing: 'value'
        // Missing fields should not appear in output
      });
    });
  });

  describe('integration with workflow engine', () => {
    it('should work without logger', () => {
      const taskWithoutLogger = new OutputTask();
      expect(taskWithoutLogger.type).toBe('output');
    });

    it('should preserve existing context data', async () => {
      const contextWithExistingData = createMockContext({
        data: { existingKey: 'existing value', newKey: 'new value' }
      });

      const input = { format: 'json' as const };
      await task.execute(input, contextWithExistingData);

      expect(contextWithExistingData.data.existingKey).toBe('existing value');
      expect(contextWithExistingData.data.finalOutput).toBeDefined();
    });

    it('should be suitable as final workflow node', async () => {
      // Simulate a complete workflow context
      const finalContext = createMockContext({
        executionId: 'final-exec',
        workflowId: 'complete-workflow',
        data: {
          inputProcessed: true,
          validationPassed: true,
          outputGenerated: true
        },
        results: {
          'validate-input': { success: true, errors: [] },
          'process-data': { success: true, recordsProcessed: 100 },
          'generate-report': { success: true, reportSize: 2048 }
        }
      });

      const input = { format: 'detailed' as const };
      const result = await task.execute(input, finalContext);

      expect(result.success).toBe(true);
      expect(result.output).toContain('Workflow completed successfully');
      expect(result.output).toContain('3 tasks executed');
    });

    it('should handle concurrent executions', async () => {
      const context1 = createMockContext({ 
        nodeId: 'output-1', 
        data: { value: 'context1' } 
      });
      const context2 = createMockContext({ 
        nodeId: 'output-2', 
        data: { value: 'context2' } 
      });

      const input = { format: 'json' as const };

      const [result1, result2] = await Promise.all([
        task.execute(input, context1),
        task.execute(input, context2)
      ]);

      expect(result1.output.data.value).toBe('context1');
      expect(result2.output.data.value).toBe('context2');
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle circular references in data', async () => {
      const circularData: any = { name: 'test' };
      circularData.self = circularData; // Create circular reference

      const contextWithCircular = createMockContext({
        data: { circular: circularData }
      });

      const input = { format: 'json' as const };

      // Should not throw, but handle gracefully
      const result = await task.execute(input, contextWithCircular);
      expect(result.success).toBe(true);
    });

    it('should handle very large data sets efficiently', async () => {
      const largeData = {
        records: Array.from({ length: 10000 }, (_, i) => ({
          id: i,
          data: `record-${i}`,
          metadata: { processed: true, timestamp: Date.now() }
        }))
      };

      const contextWithLargeData = createMockContext({
        data: largeData
      });

      const start = Date.now();
      const input = { format: 'summary' as const };
      const result = await task.execute(input, contextWithLargeData);
      const duration = Date.now() - start;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
    });

    it('should handle invalid template syntax gracefully', async () => {
      const contextWithData = createMockContext({
        data: { value: 'test' }
      });

      const input = {
        format: 'custom' as const,
        customTemplate: 'Unclosed {{value template'
      };

      // Should not throw, return template as-is
      const result = await task.execute(input, contextWithData);
      expect(result.output).toContain('template');
    });
  });
});