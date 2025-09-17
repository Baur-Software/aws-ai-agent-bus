// Google Analytics Top Pages Task Tests
// Tests for GATopPagesTask with mocked Google Analytics service

import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { GATopPagesTask } from '../../../src/workflow/tasks/analytics/GATopPagesTask';
import {
  WorkflowContext,
  Logger,
  EventEmitter,
  TaskExecutionError,
  NODE_CATEGORIES,
  INTEGRATION_KEYS
} from '../../../src/workflow/types';
import { GoogleAnalyticsService, GATopPagesParams, GATopPagesResult } from '../../../src/services';

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

// Mock EventEmitter
class MockEventEmitter implements EventEmitter {
  emit = vi.fn();
  on = vi.fn();
  off = vi.fn();
}

// Helper to create mock workflow context
const createMockContext = (overrides: Partial<WorkflowContext> = {}): WorkflowContext => ({
  executionId: 'test-execution-123',
  nodeId: 'ga-top-pages-1',
  workflowId: 'test-workflow',
  logger: new MockLogger(),
  eventEmitter: new MockEventEmitter(),
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

describe('GATopPagesTask', () => {
  let task: GATopPagesTask;
  let mockGAService: MockGoogleAnalyticsService;
  let mockLogger: MockLogger;
  let mockContext: WorkflowContext;

  beforeEach(() => {
    mockGAService = new MockGoogleAnalyticsService();
    mockLogger = new MockLogger();
    task = new GATopPagesTask(mockGAService, mockLogger);
    mockContext = createMockContext();
  });

  describe('task metadata', () => {
    it('should have correct task type', () => {
      expect(task.type).toBe('ga-top-pages');
    });

    it('should have correct display info', () => {
      const displayInfo = task.getDisplayInfo();

      expect(displayInfo).toEqual({
        category: NODE_CATEGORIES.ANALYTICS,
        label: 'GA Top Pages',
        icon: 'BarChart3',
        color: 'bg-green-600',
        description: 'Get top performing pages from Google Analytics',
        tags: ['google-analytics', 'pages', 'traffic', 'analytics'],
        integrationRequired: INTEGRATION_KEYS.GOOGLE_ANALYTICS
      });
    });

    it('should have correct schema', () => {
      const schema = task.getSchema();

      expect(schema.title).toBe('Google Analytics Top Pages');
      expect(schema.properties.propertyId).toBeDefined();
      expect(schema.properties.days).toBeDefined();
      expect(schema.properties.maxResults).toBeDefined();
      expect(schema.required).toEqual(['propertyId']);
    });
  });

  describe('input validation', () => {
    it('should validate valid input', () => {
      const input = {
        propertyId: '123456789',
        days: 30,
        maxResults: 10
      };

      const validation = task.validate(input);

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toEqual([]);
    });

    it('should reject missing property ID', () => {
      const input = {
        days: 30,
        maxResults: 10
      };

      const validation = task.validate(input);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Property ID is required');
    });

    it('should reject empty property ID', () => {
      const input = {
        propertyId: '',
        days: 30
      };

      const validation = task.validate(input);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Property ID is required');
    });

    it('should reject non-numeric property ID', () => {
      const input = {
        propertyId: 'invalid-property-id',
        days: 30
      };

      const validation = task.validate(input);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Property ID must be a numeric string');
    });

    it('should reject invalid days range', () => {
      const tooLowInput = {
        propertyId: '123456789',
        days: 0
      };

      const tooHighInput = {
        propertyId: '123456789',
        days: 400
      };

      expect(task.validate(tooLowInput).isValid).toBe(false);
      expect(task.validate(tooLowInput).errors).toContain('Days must be at least 1');

      expect(task.validate(tooHighInput).isValid).toBe(false);
      expect(task.validate(tooHighInput).errors).toContain('Days cannot exceed 365');
    });

    it('should reject invalid max results range', () => {
      const tooLowInput = {
        propertyId: '123456789',
        maxResults: 0
      };

      const tooHighInput = {
        propertyId: '123456789',
        maxResults: 150
      };

      expect(task.validate(tooLowInput).isValid).toBe(false);
      expect(task.validate(tooLowInput).errors).toContain('Max results must be at least 1');

      expect(task.validate(tooHighInput).isValid).toBe(false);
      expect(task.validate(tooHighInput).errors).toContain('Max results cannot exceed 100');
    });

    it('should provide warnings for large date ranges', () => {
      const input = {
        propertyId: '123456789',
        days: 120
      };

      const validation = task.validate(input);

      expect(validation.isValid).toBe(true);
      expect(validation.warnings).toContain('Large date ranges may take longer to process');
    });
  });

  describe('task execution', () => {
    const mockGAResult: GATopPagesResult = {
      rows: [
        {
          dimensionValues: [{ value: '/blog/seo-tips' }],
          metricValues: [
            { value: '1500' }, // pageviews
            { value: '1200' }, // unique pageviews
            { value: '180' }   // avg time on page
          ]
        },
        {
          dimensionValues: [{ value: '/products/analytics' }],
          metricValues: [
            { value: '1200' },
            { value: '1000' },
            { value: '150' }
          ]
        }
      ],
      totals: [{
        metricValues: [{ value: '2700' }]
      }],
      dateRanges: [{
        startDate: '2024-01-01',
        endDate: '2024-01-31'
      }]
    };

    it('should execute successfully with valid input', async () => {
      mockGAService.getTopPages.mockResolvedValue(mockGAResult);

      const input = {
        propertyId: '123456789',
        days: 30,
        maxResults: 10
      };

      const result = await task.execute(input, mockContext);

      expect(mockGAService.getTopPages).toHaveBeenCalledWith({
        propertyId: '123456789',
        days: 30,
        maxResults: 10
      });

      expect(result.pages).toHaveLength(2);
      expect(result.pages[0]).toEqual({
        page: '/blog/seo-tips',
        pageviews: 1500,
        uniquePageviews: 1200,
        avgTimeOnPage: 180
      });

      expect(result.totalPageviews).toBe(2700);
      expect(result.propertyId).toBe('123456789');
      expect(result.requestedDays).toBe(30);
    });

    it('should use default values for optional parameters', async () => {
      mockGAService.getTopPages.mockResolvedValue(mockGAResult);

      const input = {
        propertyId: '123456789'
      };

      await task.execute(input, mockContext);

      expect(mockGAService.getTopPages).toHaveBeenCalledWith({
        propertyId: '123456789',
        days: 30,
        maxResults: 10
      });
    });

    it('should store data in context', async () => {
      mockGAService.getTopPages.mockResolvedValue(mockGAResult);

      const input = {
        propertyId: '123456789',
        days: 7
      };

      await task.execute(input, mockContext);

      expect(mockContext.data.topPages).toBeDefined();
      expect(mockContext.data.totalPageviews).toBe(2700);
    });

    it('should handle missing totals data gracefully', async () => {
      const resultWithoutTotals: GATopPagesResult = {
        rows: [
          {
            dimensionValues: [{ value: '/page1' }],
            metricValues: [{ value: '100' }, { value: '90' }, { value: '60' }]
          }
        ],
        // No totals field
        dateRanges: [{ startDate: '2024-01-01', endDate: '2024-01-31' }]
      };

      mockGAService.getTopPages.mockResolvedValue(resultWithoutTotals);

      const input = { propertyId: '123456789' };
      const result = await task.execute(input, mockContext);

      expect(result.totalPageviews).toBe(100); // Sum of individual pages
    });

    it('should handle missing date ranges', async () => {
      const resultWithoutDateRanges: GATopPagesResult = {
        rows: [],
        totals: [{ metricValues: [{ value: '0' }] }]
        // No dateRanges field
      };

      mockGAService.getTopPages.mockResolvedValue(resultWithoutDateRanges);

      const input = { propertyId: '123456789', days: 7 };
      const result = await task.execute(input, mockContext);

      expect(result.dateRange.startDate).toBeDefined();
      expect(result.dateRange.endDate).toBeDefined();
      // Should generate date range based on input days
    });

    it('should log execution progress', async () => {
      mockGAService.getTopPages.mockResolvedValue(mockGAResult);

      const input = { propertyId: '123456789' };
      await task.execute(input, mockContext);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Getting top pages for property 123456789')
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Retrieved 2 top pages')
      );
    });

    it('should throw TaskExecutionError on service failure', async () => {
      const serviceError = new Error('API rate limit exceeded');
      mockGAService.getTopPages.mockRejectedValue(serviceError);

      const input = { propertyId: '123456789' };

      await expect(task.execute(input, mockContext)).rejects.toThrow(TaskExecutionError);
      await expect(task.execute(input, mockContext)).rejects.toThrow(
        'Google Analytics top pages request failed: API rate limit exceeded'
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to get GA top pages:',
        serviceError
      );
    });

    it('should handle empty results', async () => {
      const emptyResult: GATopPagesResult = {
        rows: [],
        totals: [{ metricValues: [{ value: '0' }] }],
        dateRanges: [{ startDate: '2024-01-01', endDate: '2024-01-31' }]
      };

      mockGAService.getTopPages.mockResolvedValue(emptyResult);

      const input = { propertyId: '123456789' };
      const result = await task.execute(input, mockContext);

      expect(result.pages).toEqual([]);
      expect(result.totalPageviews).toBe(0);
    });

    it('should handle malformed API response', async () => {
      const malformedResult: GATopPagesResult = {
        rows: [
          {
            dimensionValues: [], // Missing dimension value
            metricValues: [{ value: '100' }]
          },
          {
            dimensionValues: [{ value: '/page2' }],
            metricValues: [] // Missing metric values
          }
        ],
        totals: [{ metricValues: [{ value: '100' }] }],
        dateRanges: [{ startDate: '2024-01-01', endDate: '2024-01-31' }]
      };

      mockGAService.getTopPages.mockResolvedValue(malformedResult);

      const input = { propertyId: '123456789' };
      const result = await task.execute(input, mockContext);

      expect(result.pages).toHaveLength(2);
      expect(result.pages[0].page).toBe('Unknown'); // Default for missing dimension
      expect(result.pages[1].pageviews).toBe(0);   // Default for missing metrics
    });
  });

  describe('integration with workflow engine', () => {
    it('should work without logger', () => {
      const taskWithoutLogger = new GATopPagesTask(mockGAService);
      expect(taskWithoutLogger.type).toBe('ga-top-pages');
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
      mockGAService.getTopPages.mockResolvedValue(mockGAResult);

      const contextWithData = createMockContext({
        data: { existingData: 'test' },
        results: { 'previous-task': { value: 'previous result' } }
      });

      const input = { propertyId: '123456789' };
      await task.execute(input, contextWithData);

      // Should preserve existing context data
      expect(contextWithData.data.existingData).toBe('test');
      // Should add new data
      expect(contextWithData.data.topPages).toBeDefined();
      expect(contextWithData.data.totalPageviews).toBeDefined();
    });
  });

  describe('performance and edge cases', () => {
    it('should handle large datasets efficiently', async () => {
      // Create large mock result
      const largeResult: GATopPagesResult = {
        rows: Array.from({ length: 100 }, (_, i) => ({
          dimensionValues: [{ value: `/page-${i}` }],
          metricValues: [
            { value: String(1000 - i) },
            { value: String(800 - i) },
            { value: String(120 + i) }
          ]
        })),
        totals: [{ metricValues: [{ value: '55000' }] }],
        dateRanges: [{ startDate: '2024-01-01', endDate: '2024-01-31' }]
      };

      mockGAService.getTopPages.mockResolvedValue(largeResult);

      const start = Date.now();
      const input = { propertyId: '123456789', maxResults: 100 };
      const result = await task.execute(input, mockContext);
      const duration = Date.now() - start;

      expect(result.pages).toHaveLength(100);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle concurrent executions', async () => {
      mockGAService.getTopPages.mockResolvedValue(mockGAResult);

      const input = { propertyId: '123456789' };
      const context1 = createMockContext({ nodeId: 'node-1' });
      const context2 = createMockContext({ nodeId: 'node-2' });

      const [result1, result2] = await Promise.all([
        task.execute(input, context1),
        task.execute(input, context2)
      ]);

      expect(result1.pages).toEqual(result2.pages);
      expect(mockGAService.getTopPages).toHaveBeenCalledTimes(2);
    });
  });
});