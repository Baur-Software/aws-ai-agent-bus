// HTTP Get Task Tests
// Tests for HTTPGetTask with mocked HTTP service

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HTTPGetTask } from '../../../src/workflow/tasks/http/HTTPGetTask';
import {
  WorkflowContext,
  Logger,
  EventEmitter,
  TaskExecutionError,
  NODE_CATEGORIES
} from '../../../src/workflow/types';
import { HTTPService } from '../../../src/services';

// Mock HTTP Service
class MockHTTPService implements HTTPService {
  get = vi.fn();
  post = vi.fn();
  put = vi.fn();
  delete = vi.fn();
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
  nodeId: 'http-get-1',
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

describe('HTTPGetTask', () => {
  let task: HTTPGetTask;
  let mockHTTPService: MockHTTPService;
  let mockLogger: MockLogger;
  let mockContext: WorkflowContext;

  beforeEach(() => {
    mockHTTPService = new MockHTTPService();
    mockLogger = new MockLogger();
    task = new HTTPGetTask(mockHTTPService, mockLogger);
    mockContext = createMockContext();

    // Default successful mock
    mockHTTPService.get.mockResolvedValue({
      status: 200,
      statusText: 'OK',
      data: { message: 'Success' },
      headers: { 'content-type': 'application/json' }
    });
  });

  describe('task metadata', () => {
    it('should have correct task type', () => {
      expect(task.type).toBe('http-get');
    });

    it('should have correct display info', () => {
      const displayInfo = task.getDisplayInfo();

      expect(displayInfo).toEqual({
        category: NODE_CATEGORIES.HTTP,
        label: 'HTTP GET',
        icon: 'Download',
        color: 'bg-indigo-600',
        description: 'Make HTTP GET request to retrieve data',
        tags: ['http', 'get', 'request', 'api']
      });
    });

    it('should have correct schema', () => {
      const schema = task.getSchema();

      expect(schema.title).toBe('HTTP GET Request');
      expect(schema.properties.url).toBeDefined();
      expect(schema.properties.headers).toBeDefined();
      expect(schema.properties.timeout).toBeDefined();
      expect(schema.properties.useContextUrl).toBeDefined();
      expect(schema.properties.contextUrlKey).toBeDefined();
      expect(schema.required).toEqual([]);
    });
  });

  describe('input validation', () => {
    it('should validate valid input with direct URL', () => {
      const input = {
        url: 'https://api.example.com/data',
        headers: { 'Authorization': 'Bearer token123' },
        timeout: 5000
      };

      const validation = task.validate(input);

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toEqual([]);
    });

    it('should validate input with context URL', () => {
      const input = {
        useContextUrl: true,
        contextUrlKey: 'apiEndpoint'
      };

      const validation = task.validate(input);

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toEqual([]);
    });

    it('should reject when neither URL nor context URL is provided', () => {
      const input = {};

      const validation = task.validate(input);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Either URL or context URL must be provided');
    });

    it('should reject invalid URL format', () => {
      const input = {
        url: 'not-a-valid-url'
      };

      const validation = task.validate(input);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('URL must be a valid URL');
    });

    it('should accept various valid URL formats', () => {
      const validUrls = [
        'https://api.example.com',
        'http://localhost:3000/api',
        'https://subdomain.example.com/v1/users',
        'https://api.example.com/data?param=value&other=test'
      ];

      for (const url of validUrls) {
        const input = { url };
        const validation = task.validate(input);
        expect(validation.isValid).toBe(true);
      }
    });

    it('should reject invalid timeout values', () => {
      const tooLowInput = {
        url: 'https://api.example.com',
        timeout: 0
      };

      const tooHighInput = {
        url: 'https://api.example.com',
        timeout: 120000 // 2 minutes
      };

      expect(task.validate(tooLowInput).isValid).toBe(false);
      expect(task.validate(tooLowInput).errors).toContain('Timeout must be at least 1000ms');

      expect(task.validate(tooHighInput).isValid).toBe(false);
      expect(task.validate(tooHighInput).errors).toContain('Timeout cannot exceed 60000ms');
    });

    it('should warn about missing context URL key', () => {
      const input = {
        useContextUrl: true
        // No contextUrlKey specified
      };

      const validation = task.validate(input);

      expect(validation.isValid).toBe(true);
      expect(validation.warnings).toContain('No context URL key specified, will use "apiUrl"');
    });

    it('should validate headers format', () => {
      const validInput = {
        url: 'https://api.example.com',
        headers: {
          'Authorization': 'Bearer token',
          'Content-Type': 'application/json',
          'X-Custom-Header': 'custom-value'
        }
      };

      const validation = task.validate(validInput);
      expect(validation.isValid).toBe(true);
    });
  });

  describe('task execution', () => {
    it('should execute successfully with direct URL', async () => {
      const mockResponse = {
        status: 200,
        statusText: 'OK',
        data: { users: [{ id: 1, name: 'John' }], total: 1 },
        headers: { 'content-type': 'application/json' }
      };

      mockHTTPService.get.mockResolvedValue(mockResponse);

      const input = {
        url: 'https://api.example.com/users',
        headers: { 'Authorization': 'Bearer token123' },
        timeout: 10000
      };

      const result = await task.execute(input, mockContext);

      expect(mockHTTPService.get).toHaveBeenCalledWith(
        'https://api.example.com/users',
        {
          headers: { 'Authorization': 'Bearer token123' },
          timeout: 10000
        }
      );

      expect(result).toEqual({
        url: 'https://api.example.com/users',
        status: 200,
        statusText: 'OK',
        data: { users: [{ id: 1, name: 'John' }], total: 1 },
        headers: { 'content-type': 'application/json' },
        success: true,
        timestamp: expect.any(String)
      });

      expect(mockContext.data.httpResponse).toEqual(mockResponse.data);
      expect(mockContext.data.httpStatus).toBe(200);
    });

    it('should execute successfully with context URL', async () => {
      const contextWithUrl = createMockContext({
        data: { apiEndpoint: 'https://api.service.com/data' }
      });

      const input = {
        useContextUrl: true,
        contextUrlKey: 'apiEndpoint'
      };

      await task.execute(input, contextWithUrl);

      expect(mockHTTPService.get).toHaveBeenCalledWith(
        'https://api.service.com/data',
        {
          headers: {},
          timeout: 30000 // Default timeout
        }
      );
    });

    it('should use default context URL key when not specified', async () => {
      const contextWithUrl = createMockContext({
        data: { apiUrl: 'https://default.api.com/endpoint' }
      });

      const input = {
        useContextUrl: true
      };

      await task.execute(input, contextWithUrl);

      expect(mockHTTPService.get).toHaveBeenCalledWith(
        'https://default.api.com/endpoint',
        expect.any(Object)
      );
    });

    it('should use default timeout when not specified', async () => {
      const input = {
        url: 'https://api.example.com/test'
      };

      await task.execute(input, mockContext);

      expect(mockHTTPService.get).toHaveBeenCalledWith(
        'https://api.example.com/test',
        {
          headers: {},
          timeout: 30000
        }
      );
    });

    it('should handle different response data types', async () => {
      const testCases = [
        { data: 'plain text response', description: 'string' },
        { data: { object: 'response' }, description: 'object' },
        { data: [1, 2, 3], description: 'array' },
        { data: 42, description: 'number' },
        { data: true, description: 'boolean' },
        { data: null, description: 'null' }
      ];

      for (const testCase of testCases) {
        mockHTTPService.get.mockResolvedValue({
          status: 200,
          statusText: 'OK',
          data: testCase.data,
          headers: {}
        });

        const input = { url: `https://api.example.com/${testCase.description}` };
        const result = await task.execute(input, mockContext);

        expect(result.data).toEqual(testCase.data);
        expect(result.success).toBe(true);
      }
    });

    it('should log execution progress', async () => {
      const input = { url: 'https://api.example.com/test' };
      await task.execute(input, mockContext);

      expect(mockLogger.info).toHaveBeenCalledWith('Making HTTP GET request to: https://api.example.com/test');
      expect(mockLogger.info).toHaveBeenCalledWith('HTTP GET request completed successfully (200)');
    });

    it('should throw error when context URL key is missing', async () => {
      const contextWithoutUrl = createMockContext({
        data: {} // Empty data
      });

      const input = {
        useContextUrl: true,
        contextUrlKey: 'missingUrlKey'
      };

      await expect(task.execute(input, contextWithoutUrl)).rejects.toThrow(
        "Context URL key 'missingUrlKey' not found"
      );
    });

    it('should throw TaskExecutionError on HTTP service failure', async () => {
      const serviceError = new Error('Network timeout');
      mockHTTPService.get.mockRejectedValue(serviceError);

      const input = { url: 'https://api.example.com/failing' };

      await expect(task.execute(input, mockContext)).rejects.toThrow(TaskExecutionError);
      await expect(task.execute(input, mockContext)).rejects.toThrow(
        'HTTP GET request failed: Network timeout'
      );

      expect(mockLogger.error).toHaveBeenCalledWith('HTTP GET request failed:', serviceError);
    });
  });

  describe('HTTP status code handling', () => {
    it('should handle successful status codes (2xx)', async () => {
      const successCodes = [200, 201, 202, 204];

      for (const status of successCodes) {
        mockHTTPService.get.mockResolvedValue({
          status,
          statusText: 'Success',
          data: { status: 'ok' },
          headers: {}
        });

        const input = { url: 'https://api.example.com/test' };
        const result = await task.execute(input, mockContext);

        expect(result.success).toBe(true);
        expect(result.status).toBe(status);
      }
    });

    it('should handle client error status codes (4xx)', async () => {
      const clientErrors = [
        { status: 400, statusText: 'Bad Request' },
        { status: 401, statusText: 'Unauthorized' },
        { status: 403, statusText: 'Forbidden' },
        { status: 404, statusText: 'Not Found' }
      ];

      for (const errorCase of clientErrors) {
        mockHTTPService.get.mockResolvedValue({
          status: errorCase.status,
          statusText: errorCase.statusText,
          data: { error: 'Client error' },
          headers: {}
        });

        const input = { url: 'https://api.example.com/test' };
        const result = await task.execute(input, mockContext);

        expect(result.success).toBe(false);
        expect(result.status).toBe(errorCase.status);
        expect(result.statusText).toBe(errorCase.statusText);
      }
    });

    it('should handle server error status codes (5xx)', async () => {
      mockHTTPService.get.mockResolvedValue({
        status: 500,
        statusText: 'Internal Server Error',
        data: { error: 'Server error' },
        headers: {}
      });

      const input = { url: 'https://api.example.com/test' };
      const result = await task.execute(input, mockContext);

      expect(result.success).toBe(false);
      expect(result.status).toBe(500);
    });
  });

  describe('headers and authentication', () => {
    it('should send custom headers correctly', async () => {
      const customHeaders = {
        'Authorization': 'Bearer jwt-token-123',
        'X-API-Key': 'api-key-456',
        'Content-Type': 'application/json',
        'User-Agent': 'WorkflowEngine/1.0'
      };

      const input = {
        url: 'https://api.example.com/protected',
        headers: customHeaders
      };

      await task.execute(input, mockContext);

      expect(mockHTTPService.get).toHaveBeenCalledWith(
        'https://api.example.com/protected',
        {
          headers: customHeaders,
          timeout: 30000
        }
      );
    });

    it('should handle case-insensitive headers', async () => {
      const input = {
        url: 'https://api.example.com/test',
        headers: {
          'authorization': 'bearer token', // lowercase
          'Content-TYPE': 'application/json', // mixed case
          'X-Custom-Header': 'value'
        }
      };

      await task.execute(input, mockContext);

      expect(mockHTTPService.get).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({
          headers: expect.objectContaining({
            'authorization': 'bearer token',
            'Content-TYPE': 'application/json'
          })
        })
      );
    });

    it('should handle empty headers object', async () => {
      const input = {
        url: 'https://api.example.com/test',
        headers: {}
      };

      await task.execute(input, mockContext);

      expect(mockHTTPService.get).toHaveBeenCalledWith(
        'https://api.example.com/test',
        {
          headers: {},
          timeout: 30000
        }
      );
    });
  });

  describe('response data handling', () => {
    it('should handle large response payloads efficiently', async () => {
      const largeData = {
        records: Array.from({ length: 10000 }, (_, i) => ({
          id: i,
          name: `Record ${i}`,
          data: 'x'.repeat(100) // 100 chars per record
        }))
      };

      mockHTTPService.get.mockResolvedValue({
        status: 200,
        statusText: 'OK',
        data: largeData,
        headers: { 'content-length': '1000000' }
      });

      const start = Date.now();
      const input = { url: 'https://api.example.com/large-dataset' };
      const result = await task.execute(input, mockContext);
      const duration = Date.now() - start;

      expect(result.data.records).toHaveLength(10000);
      expect(duration).toBeLessThan(2000); // Should handle large data efficiently
    });

    it('should handle binary response data', async () => {
      const binaryData = Buffer.from([0x89, 0x50, 0x4E, 0x47]); // PNG header

      mockHTTPService.get.mockResolvedValue({
        status: 200,
        statusText: 'OK',
        data: binaryData,
        headers: { 'content-type': 'image/png' }
      });

      const input = { url: 'https://api.example.com/image.png' };
      const result = await task.execute(input, mockContext);

      expect(result.data).toBe(binaryData);
      expect(result.headers['content-type']).toBe('image/png');
    });

    it('should handle malformed JSON responses gracefully', async () => {
      // HTTP service returns string instead of parsed JSON
      mockHTTPService.get.mockResolvedValue({
        status: 200,
        statusText: 'OK',
        data: '{"malformed": json response', // Invalid JSON string
        headers: { 'content-type': 'application/json' }
      });

      const input = { url: 'https://api.example.com/malformed' };
      const result = await task.execute(input, mockContext);

      expect(result.data).toBe('{"malformed": json response');
      expect(result.success).toBe(true); // Still successful HTTP request
    });
  });

  describe('URL construction and context integration', () => {
    it('should handle URLs with query parameters', async () => {
      const input = {
        url: 'https://api.example.com/search?q=test&limit=10&page=1'
      };

      await task.execute(input, mockContext);

      expect(mockHTTPService.get).toHaveBeenCalledWith(
        'https://api.example.com/search?q=test&limit=10&page=1',
        expect.any(Object)
      );
    });

    it('should handle URLs with fragments', async () => {
      const input = {
        url: 'https://api.example.com/docs#section-1'
      };

      await task.execute(input, mockContext);

      expect(mockHTTPService.get).toHaveBeenCalledWith(
        'https://api.example.com/docs#section-1',
        expect.any(Object)
      );
    });

    it('should handle context URLs with special characters', async () => {
      const contextWithSpecialUrl = createMockContext({
        data: { 
          apiUrl: 'https://api.example.com/search?q=test query&special=chars!@#' 
        }
      });

      const input = { useContextUrl: true };
      await task.execute(input, contextWithSpecialUrl);

      expect(mockHTTPService.get).toHaveBeenCalledWith(
        'https://api.example.com/search?q=test query&special=chars!@#',
        expect.any(Object)
      );
    });
  });

  describe('integration with workflow context', () => {
    it('should work without logger', () => {
      const taskWithoutLogger = new HTTPGetTask(mockHTTPService);
      expect(taskWithoutLogger.type).toBe('http-get');
    });

    it('should preserve existing context data', async () => {
      const contextWithExistingData = createMockContext({
        data: { existingKey: 'existing value' }
      });

      const input = { url: 'https://api.example.com/test' };
      await task.execute(input, contextWithExistingData);

      expect(contextWithExistingData.data.existingKey).toBe('existing value');
      expect(contextWithExistingData.data.httpResponse).toBeDefined();
    });

    it('should handle concurrent executions', async () => {
      mockHTTPService.get
        .mockResolvedValueOnce({
          status: 200,
          statusText: 'OK',
          data: { result: 'first' },
          headers: {}
        })
        .mockResolvedValueOnce({
          status: 200,
          statusText: 'OK',
          data: { result: 'second' },
          headers: {}
        });

      const context1 = createMockContext({ nodeId: 'node-1' });
      const context2 = createMockContext({ nodeId: 'node-2' });

      const [result1, result2] = await Promise.all([
        task.execute({ url: 'https://api.example.com/first' }, context1),
        task.execute({ url: 'https://api.example.com/second' }, context2)
      ]);

      expect(result1.data.result).toBe('first');
      expect(result2.data.result).toBe('second');
      expect(mockHTTPService.get).toHaveBeenCalledTimes(2);
    });
  });

  describe('timeout handling', () => {
    it('should respect custom timeout values', async () => {
      const input = {
        url: 'https://api.example.com/slow',
        timeout: 5000
      };

      await task.execute(input, mockContext);

      expect(mockHTTPService.get).toHaveBeenCalledWith(
        'https://api.example.com/slow',
        expect.objectContaining({
          timeout: 5000
        })
      );
    });

    it('should handle timeout errors from HTTP service', async () => {
      const timeoutError = new Error('Request timeout');
      timeoutError.name = 'TimeoutError';
      mockHTTPService.get.mockRejectedValue(timeoutError);

      const input = {
        url: 'https://api.example.com/timeout',
        timeout: 1000
      };

      await expect(task.execute(input, mockContext)).rejects.toThrow(TaskExecutionError);
      await expect(task.execute(input, mockContext)).rejects.toThrow(
        'HTTP GET request failed: Request timeout'
      );
    });
  });
});