// Google Analytics Search Console Data Task
// Retrieves search console data from Google Analytics

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

import { GoogleAnalyticsService, GASearchParams, GASearchResult } from '../../../services';

export interface GASearchDataInput {
  siteUrl: string;
  days?: number;
  maxResults?: number;
}

export interface GASearchDataOutput {
  queries: Array<{
    query: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>;
  totalClicks: number;
  totalImpressions: number;
  averageCTR: number;
  averagePosition: number;
  dateRange: {
    startDate: string;
    endDate: string;
  };
  siteUrl: string;
  requestedDays: number;
}

export class GASearchDataTask implements WorkflowTask<GASearchDataInput, GASearchDataOutput> {
  readonly type = 'ga-search-data';

  constructor(
    private gaService: GoogleAnalyticsService,
    private logger?: Logger
  ) {}

  async execute(input: GASearchDataInput, context: WorkflowContext): Promise<GASearchDataOutput> {
    this.logger?.info(`Getting search console data for site: ${input.siteUrl} (${input.days || 30} days)`);

    try {
      const params: GASearchParams = {
        siteUrl: input.siteUrl,
        days: input.days || 30,
        maxResults: input.maxResults || 50
      };

      const result: GASearchResult = await this.gaService.getSearchConsoleData(params);

      // Transform search console data to our standardized format
      const queries = result.rows.map(row => ({
        query: row.keys[0] || 'Unknown',
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: row.position
      }));

      // Calculate totals and averages
      const totalClicks = queries.reduce((sum, q) => sum + q.clicks, 0);
      const totalImpressions = queries.reduce((sum, q) => sum + q.impressions, 0);
      const averageCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
      const averagePosition = queries.length > 0 
        ? queries.reduce((sum, q) => sum + q.position, 0) / queries.length 
        : 0;

      const dateRange = {
        startDate: this.formatDate(new Date(Date.now() - (params.days * 24 * 60 * 60 * 1000))),
        endDate: this.formatDate(new Date())
      };

      const output: GASearchDataOutput = {
        queries,
        totalClicks,
        totalImpressions,
        averageCTR,
        averagePosition,
        dateRange,
        siteUrl: input.siteUrl,
        requestedDays: params.days
      };

      this.logger?.info(`Retrieved ${queries.length} search queries with ${totalClicks} total clicks`);

      // Store useful data in context for downstream tasks
      context.data.searchQueries = queries;
      context.data.totalClicks = totalClicks;
      context.data.totalImpressions = totalImpressions;

      return output;

    } catch (error) {
      this.logger?.error('Failed to get search console data:', error);
      throw new TaskExecutionError(
        `Google Search Console data request failed: ${error.message}`,
        this.type,
        context.nodeId,
        input
      );
    }
  }

  validate(input: GASearchDataInput): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields
    if (!input.siteUrl || input.siteUrl.trim().length === 0) {
      errors.push('Site URL is required');
    }

    // Site URL format validation
    if (input.siteUrl) {
      try {
        new URL(input.siteUrl);
      } catch {
        errors.push('Site URL must be a valid URL');
      }
    }

    // Days validation
    if (input.days !== undefined) {
      if (input.days < 1) {
        errors.push('Days must be at least 1');
      }
      if (input.days > 90) {
        errors.push('Days cannot exceed 90 for Search Console data');
      }
      if (input.days > 30) {
        warnings.push('Large date ranges may take longer to process');
      }
    }

    // Max results validation
    if (input.maxResults !== undefined) {
      if (input.maxResults < 1) {
        errors.push('Max results must be at least 1');
      }
      if (input.maxResults > 1000) {
        errors.push('Max results cannot exceed 1000');
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
      title: 'Google Search Console Data',
      description: 'Retrieve search performance data from Google Search Console',
      properties: {
        siteUrl: {
          type: 'string',
          title: 'Site URL',
          description: 'Website URL in Search Console (e.g., https://example.com)',
          format: 'uri'
        },
        days: {
          type: 'number',
          title: 'Time Range (Days)',
          description: 'Number of days to analyze',
          default: 30,
          minimum: 1,
          maximum: 90
        },
        maxResults: {
          type: 'number',
          title: 'Max Results',
          description: 'Maximum number of search queries to return',
          default: 50,
          minimum: 1,
          maximum: 1000
        }
      },
      required: ['siteUrl'],
      examples: [
        {
          siteUrl: 'https://example.com',
          days: 30,
          maxResults: 50
        },
        {
          siteUrl: 'https://blog.example.com',
          days: 7,
          maxResults: 100
        }
      ]
    };
  }

  getDisplayInfo(): TaskDisplayInfo {
    return {
      category: NODE_CATEGORIES.ANALYTICS,
      label: 'GA Search Data',
      icon: 'Search',
      color: 'bg-green-600',
      description: 'Get search performance data from Search Console',
      tags: ['google-search-console', 'search', 'queries', 'analytics'],
      integrationRequired: INTEGRATION_KEYS.GOOGLE_SEARCH_CONSOLE
    };
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }
}