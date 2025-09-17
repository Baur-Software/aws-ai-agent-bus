// Google Analytics Top Pages Task
// Clean task implementation using the GoogleAnalyticsService

import {
  WorkflowTask,
  WorkflowContext,
  ValidationResult,
  TaskConfigSchema,
  TaskDisplayInfo,
  Logger,
  TaskExecutionError,
  NODE_CATEGORIES,
  INTEGRATION_KEYS
} from '../../types';

import { GoogleAnalyticsService, GATopPagesParams, GATopPagesResult } from '../../../services';

export interface GATopPagesInput {
  propertyId: string;
  days?: number;
  maxResults?: number;
}

export interface GATopPagesOutput {
  pages: Array<{
    page: string;
    pageviews: number;
    uniquePageviews: number;
    avgTimeOnPage: number;
  }>;
  totalPageviews: number;
  dateRange: {
    startDate: string;
    endDate: string;
  };
  propertyId: string;
  requestedDays: number;
}

export class GATopPagesTask implements WorkflowTask<GATopPagesInput, GATopPagesOutput> {
  readonly type = 'ga-top-pages';

  constructor(
    private gaService: GoogleAnalyticsService,
    private logger?: Logger
  ) {}

  async execute(input: GATopPagesInput, context: WorkflowContext): Promise<GATopPagesOutput> {
    this.logger?.info(`Getting top pages for property ${input.propertyId} (${input.days || 30} days)`);

    try {
      const params: GATopPagesParams = {
        propertyId: input.propertyId,
        days: input.days || 30,
        maxResults: input.maxResults || 10
      };

      const result: GATopPagesResult = await this.gaService.getTopPages(params);

      // Transform the GA API response to our standardized format
      const pages = result.rows.map(row => ({
        page: row.dimensionValues[0]?.value || 'Unknown',
        pageviews: parseInt(row.metricValues[0]?.value || '0', 10),
        uniquePageviews: parseInt(row.metricValues[1]?.value || '0', 10),
        avgTimeOnPage: parseFloat(row.metricValues[2]?.value || '0')
      }));

      const totalPageviews = result.totals?.[0]?.metricValues?.[0]?.value
        ? parseInt(result.totals[0].metricValues[0].value, 10)
        : pages.reduce((sum, page) => sum + page.pageviews, 0);

      const dateRange = result.dateRanges?.[0] || {
        startDate: this.formatDate(new Date(Date.now() - (params.days * 24 * 60 * 60 * 1000))),
        endDate: this.formatDate(new Date())
      };

      const output: GATopPagesOutput = {
        pages,
        totalPageviews,
        dateRange,
        propertyId: input.propertyId,
        requestedDays: params.days
      };

      this.logger?.info(`Retrieved ${pages.length} top pages with ${totalPageviews} total pageviews`);

      // Store useful data in context for downstream tasks
      context.data.topPages = pages;
      context.data.totalPageviews = totalPageviews;

      return output;

    } catch (error) {
      this.logger?.error('Failed to get GA top pages:', error);
      throw new TaskExecutionError(
        `Google Analytics top pages request failed: ${error.message}`,
        this.type,
        context.nodeId,
        input
      );
    }
  }

  validate(input: GATopPagesInput): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields
    if (!input.propertyId || input.propertyId.trim().length === 0) {
      errors.push('Property ID is required');
    }

    // Property ID format validation
    if (input.propertyId && !input.propertyId.match(/^\d+$/)) {
      errors.push('Property ID must be a numeric string');
    }

    // Days validation
    if (input.days !== undefined) {
      if (input.days < 1) {
        errors.push('Days must be at least 1');
      }
      if (input.days > 365) {
        errors.push('Days cannot exceed 365');
      }
      if (input.days > 90) {
        warnings.push('Large date ranges may take longer to process');
      }
    }

    // Max results validation
    if (input.maxResults !== undefined) {
      if (input.maxResults < 1) {
        errors.push('Max results must be at least 1');
      }
      if (input.maxResults > 100) {
        errors.push('Max results cannot exceed 100');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  getSchema(): TaskConfigSchema {
    return {
      type: 'object',
      title: 'Google Analytics Top Pages',
      description: 'Retrieve top performing pages from Google Analytics',
      properties: {
        propertyId: {
          type: 'string',
          title: 'GA4 Property ID',
          description: 'Google Analytics 4 property ID (numeric string)',
          format: 'string'
        },
        days: {
          type: 'number',
          title: 'Time Range (Days)',
          description: 'Number of days to analyze',
          default: 30,
          minimum: 1,
          maximum: 365
        },
        maxResults: {
          type: 'number',
          title: 'Max Results',
          description: 'Maximum number of pages to return',
          default: 10,
          minimum: 1,
          maximum: 100
        }
      },
      required: ['propertyId'],
      examples: [
        {
          propertyId: '123456789',
          days: 30,
          maxResults: 10
        },
        {
          propertyId: '987654321',
          days: 7,
          maxResults: 25
        }
      ]
    };
  }

  getDisplayInfo(): TaskDisplayInfo {
    return {
      category: NODE_CATEGORIES.ANALYTICS,
      label: 'GA Top Pages',
      icon: 'BarChart3',
      color: 'bg-green-600',
      description: 'Get top performing pages from Google Analytics',
      tags: ['google-analytics', 'pages', 'traffic', 'analytics'],
      integrationRequired: INTEGRATION_KEYS.GOOGLE_ANALYTICS
    };
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }
}