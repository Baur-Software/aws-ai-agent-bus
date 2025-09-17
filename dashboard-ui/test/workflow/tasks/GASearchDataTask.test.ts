// Google Analytics Search Console Data Task Tests
// Tests for GASearchDataTask with mocked Google Analytics service

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GASearchDataTask } from '../../../src/workflow/tasks/analytics/GASearchDataTask';
import {
  WorkflowContext,
  Logger,
  EventEmitter,
  TaskExecutionError,
  NODE_CATEGORIES,
  INTEGRATION_KEYS
} from '../../../src/workflow/types';
import { GoogleAnalyticsService, GASearchDataParams, GASearchDataResult } from '../../../src/services';

// Mock Google Analytics Service
class MockGoogleAnalyticsService implements GoogleAnalyticsService {
  getTopPages = vi.fn();
  getSearchConsoleData = vi.fn();
  analyzeContentOpportunities = vi.fn();
  generateContentCalendar = vi.fn();
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
  nodeId: 'ga-search-data-1',
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

describe('GASearchDataTask', () => {
  let task: GASearchDataTask;
  let mockGAService: MockGoogleAnalyticsService;
  let mockLogger: MockLogger;
  let mockContext: WorkflowContext;

  beforeEach(() => {
    mockGAService = new MockGoogleAnalyticsService();
    mockLogger = new MockLogger();
    task = new GASearchDataTask(mockGAService, mockLogger);
    mockContext = createMockContext();
  });

  describe('task metadata', () => {
    it('should have correct task type', () => {
      expect(task.type).toBe('ga-search-data');
    });

    it('should have correct display info', () => {
      const displayInfo = task.getDisplayInfo();

      expect(displayInfo).toEqual({
        category: NODE_CATEGORIES.ANALYTICS,
        label: 'GA Search Data',
        icon: 'Search',
        color: 'bg-green-600',
        description: 'Get Search Console keyword data from Google Analytics',
        tags: ['google-analytics', 'search-console', 'keywords', 'seo'],
        integrationRequired: INTEGRATION_KEYS.GOOGLE_ANALYTICS
      });
    });

    it('should have correct schema', () => {
      const schema = task.getSchema();

      expect(schema.title).toBe('Google Analytics Search Console Data');
      expect(schema.properties.siteUrl).toBeDefined();
      expect(schema.properties.days).toBeDefined();
      expect(schema.properties.maxResults).toBeDefined();
      expect(schema.required).toEqual(['siteUrl']);
    });
  });

  describe('input validation', () => {
    it('should validate valid input', () => {
      const input = {
        siteUrl: 'https://example.com',
        days: 30,
        maxResults: 25
      };

      const validation = task.validate(input);

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toEqual([]);
    });

    it('should reject missing site URL', () => {
      const input = {
        days: 30,
        maxResults: 25
      };

      const validation = task.validate(input);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Site URL is required');
    });

    it('should reject empty site URL', () => {
      const input = {
        siteUrl: '',
        days: 30
      };

      const validation = task.validate(input);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Site URL is required');
    });

    it('should reject invalid URL format', () => {
      const input = {
        siteUrl: 'not-a-valid-url',
        days: 30
      };

      const validation = task.validate(input);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Site URL must be a valid URL');
    });

    it('should accept various valid URL formats', () => {
      const validUrls = [
        'https://example.com',
        'http://example.com',
        'https://www.example.com',
        'https://subdomain.example.com',
        'https://example.com/path'
      ];

      for (const siteUrl of validUrls) {
        const input = { siteUrl };
        const validation = task.validate(input);
        expect(validation.isValid).toBe(true);
      }
    });

    it('should reject invalid days range', () => {
      const tooLowInput = {
        siteUrl: 'https://example.com',
        days: 0
      };

      const tooHighInput = {
        siteUrl: 'https://example.com',
        days: 400
      };

      expect(task.validate(tooLowInput).isValid).toBe(false);
      expect(task.validate(tooLowInput).errors).toContain('Days must be at least 1');

      expect(task.validate(tooHighInput).isValid).toBe(false);
      expect(task.validate(tooHighInput).errors).toContain('Days cannot exceed 365');
    });

    it('should reject invalid max results range', () => {
      const tooLowInput = {
        siteUrl: 'https://example.com',
        maxResults: 0
      };

      const tooHighInput = {
        siteUrl: 'https://example.com',
        maxResults: 150
      };

      expect(task.validate(tooLowInput).isValid).toBe(false);
      expect(task.validate(tooLowInput).errors).toContain('Max results must be at least 1');

      expect(task.validate(tooHighInput).isValid).toBe(false);
      expect(task.validate(tooHighInput).errors).toContain('Max results cannot exceed 100');
    });

    it('should provide warnings for large date ranges', () => {
      const input = {
        siteUrl: 'https://example.com',
        days: 150
      };

      const validation = task.validate(input);

      expect(validation.isValid).toBe(true);
      expect(validation.warnings).toContain('Large date ranges may take longer to process');
    });
  });

  describe('task execution', () => {
    const mockSearchResult: GASearchDataResult = {
      rows: [
        {
          keys: ['seo tips'],
          clicks: 150,
          impressions: 2500,
          ctr: 0.06,
          position: 12.5
        },
        {
          keys: ['content marketing'],
          clicks: 89,
          impressions: 1800,
          ctr: 0.049,
          position: 15.2
        },
        {
          keys: ['analytics tutorial'],
          clicks: 65,
          impressions: 900,
          ctr: 0.072,
          position: 8.7
        }
      ],
      totals: {
        clicks: 304,
        impressions: 5200,
        ctr: 0.058,
        position: 12.1
      },
      responseAggregationType: 'byQuery',
      dateRange: {
        startDate: '2024-01-01',
        endDate: '2024-01-31'
      }
    };

    it('should execute successfully with valid input', async () => {
      mockGAService.getSearchConsoleData.mockResolvedValue(mockSearchResult);

      const input = {
        siteUrl: 'https://example.com',
        days: 30,
        maxResults: 25
      };

      const result = await task.execute(input, mockContext);

      expect(mockGAService.getSearchConsoleData).toHaveBeenCalledWith({
        siteUrl: 'https://example.com',
        days: 30,
        maxResults: 25
      });

      expect(result.queries).toHaveLength(3);
      expect(result.queries[0]).toEqual({
        query: 'seo tips',
        clicks: 150,
        impressions: 2500,
        ctr: 0.06,
        position: 12.5
      });

      expect(result.totals).toEqual({
        clicks: 304,
        impressions: 5200,
        ctr: 0.058,
        position: 12.1
      });

      expect(result.siteUrl).toBe('https://example.com');
      expect(result.requestedDays).toBe(30);
    });

    it('should use default values for optional parameters', async () => {
      mockGAService.getSearchConsoleData.mockResolvedValue(mockSearchResult);

      const input = {
        siteUrl: 'https://example.com'
      };

      await task.execute(input, mockContext);

      expect(mockGAService.getSearchConsoleData).toHaveBeenCalledWith({
        siteUrl: 'https://example.com',
        days: 30,
        maxResults: 25
      });
    });

    it('should store data in context', async () => {
      mockGAService.getSearchConsoleData.mockResolvedValue(mockSearchResult);

      const input = {
        siteUrl: 'https://example.com',
        days: 7
      };

      await task.execute(input, mockContext);

      expect(mockContext.data.searchQueries).toBeDefined();
      expect(mockContext.data.totalClicks).toBe(304);
      expect(mockContext.data.totalImpressions).toBe(5200);
    });

    it('should handle missing totals data gracefully', async () => {
      const resultWithoutTotals: GASearchDataResult = {
        rows: [
          {
            keys: ['test query'],
            clicks: 10,
            impressions: 100,
            ctr: 0.1,
            position: 5.0
          }
        ],
        responseAggregationType: 'byQuery',
        dateRange: { startDate: '2024-01-01', endDate: '2024-01-31' }
        // No totals field
      };

      mockGAService.getSearchConsoleData.mockResolvedValue(resultWithoutTotals);

      const input = { siteUrl: 'https://example.com' };
      const result = await task.execute(input, mockContext);

      // Should calculate totals from rows
      expect(result.totals.clicks).toBe(10);
      expect(result.totals.impressions).toBe(100);
      expect(result.totals.ctr).toBeCloseTo(0.1);
      expect(result.totals.position).toBe(5.0);
    });

    it('should handle missing date range', async () => {
      const resultWithoutDateRange: GASearchDataResult = {
        rows: [],
        totals: { clicks: 0, impressions: 0, ctr: 0, position: 0 },
        responseAggregationType: 'byQuery'
        // No dateRange field
      };

      mockGAService.getSearchConsoleData.mockResolvedValue(resultWithoutDateRange);

      const input = { siteUrl: 'https://example.com', days: 7 };
      const result = await task.execute(input, mockContext);

      expect(result.dateRange.startDate).toBeDefined();
      expect(result.dateRange.endDate).toBeDefined();
      // Should generate date range based on input days
    });

    it('should log execution progress', async () => {
      mockGAService.getSearchConsoleData.mockResolvedValue(mockSearchResult);

      const input = { siteUrl: 'https://example.com' };
      await task.execute(input, mockContext);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Getting search console data for https://example.com')
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Retrieved 3 search queries')
      );
    });

    it('should throw TaskExecutionError on service failure', async () => {
      const serviceError = new Error('Search Console API quota exceeded');
      mockGAService.getSearchConsoleData.mockRejectedValue(serviceError);

      const input = { siteUrl: 'https://example.com' };

      await expect(task.execute(input, mockContext)).rejects.toThrow(TaskExecutionError);
      await expect(task.execute(input, mockContext)).rejects.toThrow(
        'Google Analytics search console data request failed: Search Console API quota exceeded'
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to get GA search console data:',
        serviceError
      );
    });

    it('should handle empty results', async () => {
      const emptyResult: GASearchDataResult = {
        rows: [],
        totals: { clicks: 0, impressions: 0, ctr: 0, position: 0 },
        responseAggregationType: 'byQuery',
        dateRange: { startDate: '2024-01-01', endDate: '2024-01-31' }
      };

      mockGAService.getSearchConsoleData.mockResolvedValue(emptyResult);

      const input = { siteUrl: 'https://example.com' };
      const result = await task.execute(input, mockContext);

      expect(result.queries).toEqual([]);
      expect(result.totals.clicks).toBe(0);
    });

    it('should handle malformed API response', async () => {
      const malformedResult: GASearchDataResult = {
        rows: [
          {
            keys: [], // Missing query
            clicks: 10,
            impressions: 100,
            ctr: 0.1,
            position: 5.0
          },
          {
            keys: ['valid query'],
            // Missing metrics
            clicks: undefined as any,
            impressions: undefined as any,
            ctr: undefined as any,
            position: undefined as any
          }
        ],
        totals: { clicks: 10, impressions: 100, ctr: 0.1, position: 5.0 },
        responseAggregationType: 'byQuery',
        dateRange: { startDate: '2024-01-01', endDate: '2024-01-31' }
      };

      mockGAService.getSearchConsoleData.mockResolvedValue(malformedResult);

      const input = { siteUrl: 'https://example.com' };
      const result = await task.execute(input, mockContext);

      expect(result.queries).toHaveLength(2);
      expect(result.queries[0].query).toBe('Unknown'); // Default for missing query
      expect(result.queries[1].clicks).toBe(0); // Default for missing metrics
    });
  });

  describe('data processing and aggregation', () => {
    it('should correctly process search console data with multiple queries', async () => {
      const largeResult: GASearchDataResult = {
        rows: Array.from({ length: 50 }, (_, i) => ({
          keys: [`query ${i + 1}`],
          clicks: 100 - i,
          impressions: 1000 - (i * 10),
          ctr: (100 - i) / (1000 - (i * 10)),
          position: 5 + (i * 0.1)
        })),
        totals: { clicks: 2525, impressions: 27500, ctr: 0.092, position: 7.45 },
        responseAggregationType: 'byQuery',
        dateRange: { startDate: '2024-01-01', endDate: '2024-01-31' }
      };

      mockGAService.getSearchConsoleData.mockResolvedValue(largeResult);

      const input = { siteUrl: 'https://example.com', maxResults: 50 };
      const result = await task.execute(input, mockContext);

      expect(result.queries).toHaveLength(50);
      expect(result.queries[0].clicks).toBe(100); // Highest first
      expect(result.queries[49].clicks).toBe(51); // Lowest last
    });

    it('should calculate correct aggregated metrics', async () => {
      const testResult: GASearchDataResult = {
        rows: [
          { keys: ['query1'], clicks: 30, impressions: 300, ctr: 0.1, position: 3.0 },
          { keys: ['query2'], clicks: 20, impressions: 500, ctr: 0.04, position: 8.0 },
          { keys: ['query3'], clicks: 50, impressions: 200, ctr: 0.25, position: 2.0 }
        ],
        // Missing totals - should be calculated
        responseAggregationType: 'byQuery',
        dateRange: { startDate: '2024-01-01', endDate: '2024-01-31' }
      };

      mockGAService.getSearchConsoleData.mockResolvedValue(testResult);

      const input = { siteUrl: 'https://example.com' };
      const result = await task.execute(input, mockContext);

      expect(result.totals.clicks).toBe(100); // 30 + 20 + 50
      expect(result.totals.impressions).toBe(1000); // 300 + 500 + 200
      expect(result.totals.ctr).toBeCloseTo(0.1); // 100/1000
      expect(result.totals.position).toBeCloseTo(4.33); // Weighted average
    });
  });

  describe('integration with workflow engine', () => {
    it('should work without logger', () => {
      const taskWithoutLogger = new GASearchDataTask(mockGAService);
      expect(taskWithoutLogger.type).toBe('ga-search-data');
    });

    it('should be compatible with task registry', () => {
      const displayInfo = task.getDisplayInfo();
      const schema = task.getSchema();

      expect(displayInfo.category).toBeDefined();
      expect(displayInfo.integrationRequired).toBe(INTEGRATION_KEYS.GOOGLE_ANALYTICS);
      expect(schema.properties).toBeDefined();
      expect(schema.required).toBeDefined();
    });

    it('should handle context data properly', async () => {
      mockGAService.getSearchConsoleData.mockResolvedValue(mockSearchResult);

      const contextWithData = createMockContext({
        data: { existingData: 'test' },
        results: { 'previous-task': { value: 'previous result' } }
      });

      const input = { siteUrl: 'https://example.com' };
      await task.execute(input, contextWithData);

      // Should preserve existing context data
      expect(contextWithData.data.existingData).toBe('test');
      // Should add new data
      expect(contextWithData.data.searchQueries).toBeDefined();
      expect(contextWithData.data.totalClicks).toBeDefined();
    });
  });

  describe('performance and edge cases', () => {
    it('should handle large datasets efficiently', async () => {
      // Create large mock result with 100 queries
      const largeResult: GASearchDataResult = {
        rows: Array.from({ length: 100 }, (_, i) => ({
          keys: [`long query with multiple terms ${i}`],
          clicks: Math.floor(Math.random() * 100),
          impressions: Math.floor(Math.random() * 1000),
          ctr: Math.random() * 0.1,
          position: Math.random() * 20
        })),
        totals: { clicks: 5000, impressions: 50000, ctr: 0.1, position: 10.0 },
        responseAggregationType: 'byQuery',
        dateRange: { startDate: '2024-01-01', endDate: '2024-01-31' }
      };

      mockGAService.getSearchConsoleData.mockResolvedValue(largeResult);

      const start = Date.now();
      const input = { siteUrl: 'https://example.com', maxResults: 100 };
      const result = await task.execute(input, mockContext);
      const duration = Date.now() - start;

      expect(result.queries).toHaveLength(100);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle concurrent executions', async () => {
      mockGAService.getSearchConsoleData.mockResolvedValue(mockSearchResult);

      const input = { siteUrl: 'https://example.com' };
      const context1 = createMockContext({ nodeId: 'node-1' });
      const context2 = createMockContext({ nodeId: 'node-2' });

      const [result1, result2] = await Promise.all([
        task.execute(input, context1),
        task.execute(input, context2)
      ]);

      expect(result1.queries).toEqual(result2.queries);
      expect(mockGAService.getSearchConsoleData).toHaveBeenCalledTimes(2);
    });

    it('should handle special characters in queries', async () => {
      const specialResult: GASearchDataResult = {
        rows: [
          { keys: ['café français'], clicks: 10, impressions: 100, ctr: 0.1, position: 5.0 },
          { keys: ['münchen hotel'], clicks: 15, impressions: 200, ctr: 0.075, position: 8.0 },
          { keys: ['tokyo 東京'], clicks: 8, impressions: 80, ctr: 0.1, position: 6.0 }
        ],
        totals: { clicks: 33, impressions: 380, ctr: 0.087, position: 6.33 },
        responseAggregationType: 'byQuery',
        dateRange: { startDate: '2024-01-01', endDate: '2024-01-31' }
      };

      mockGAService.getSearchConsoleData.mockResolvedValue(specialResult);

      const input = { siteUrl: 'https://example.com' };
      const result = await task.execute(input, mockContext);

      expect(result.queries[0].query).toBe('café français');
      expect(result.queries[1].query).toBe('münchen hotel');
      expect(result.queries[2].query).toBe('tokyo 東京');
    });
  });
});