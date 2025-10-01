// Google Analytics Content Calendar Task
// Generates content calendar based on analytics insights

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

import { GoogleAnalyticsService, GACalendarParams, GACalendarResult } from '../../../services';

export interface GACalendarInput {
  propertyId: string;
  siteUrl: string;
  targetMonth?: string;
  contentTypes?: string[];
  priority?: 'high' | 'medium' | 'low' | 'all';
}

export interface GACalendarOutput {
  month: string;
  contentPlan: Array<{
    date: string;
    type: 'blog' | 'social' | 'video' | 'email' | 'landing-page';
    title: string;
    description: string;
    keywords: string[];
    priority: 'high' | 'medium' | 'low';
    estimatedTraffic: number;
    resourcesRequired: string[];
    publishingChannel: string;
  }>;
  keywordTargets: Array<{
    keyword: string;
    volume: number;
    difficulty: number;
    contentType: string;
    targetDate: string;
  }>;
  publishingSchedule: {
    weeklyGoals: Array<{
      week: string;
      contentCount: number;
      focusAreas: string[];
    }>;
    milestones: Array<{
      date: string;
      milestone: string;
      deliverables: string[];
    }>;
  };
  performanceTargets: {
    totalContentPieces: number;
    targetKeywords: number;
    estimatedTrafficIncrease: number;
    engagementGoals: Record<string, number>;
  };
}

export class GACalendarTask implements WorkflowTask<GACalendarInput, GACalendarOutput> {
  readonly type = 'ga-calendar';

  constructor(
    private gaService: GoogleAnalyticsService,
    private logger?: Logger
  ) {}

  async execute(input: GACalendarInput, context: WorkflowContext): Promise<GACalendarOutput> {
    const targetMonth = input.targetMonth || this.getCurrentMonth();
    this.logger?.info(`Generating content calendar for ${targetMonth} (${input.propertyId})`);

    try {
      const params: GACalendarParams = {
        propertyId: input.propertyId,
        siteUrl: input.siteUrl,
        targetMonth
      };

      const result: GACalendarResult = await this.gaService.generateContentCalendar(params);

      // Enhanced content planning with resource allocation
      const enhancedContentPlan = result.contentPlan.map(item => ({
        ...item,
        estimatedTraffic: this.estimateTrafficPotential(item.keywords, context),
        resourcesRequired: this.calculateResourcesNeeded(item.type, item.priority),
        publishingChannel: this.determinePublishingChannel(item.type)
      }));

      // Filter by content types if specified
      const filteredContentPlan = input.contentTypes
        ? enhancedContentPlan.filter(item => input.contentTypes!.includes(item.type))
        : enhancedContentPlan;

      // Filter by priority if specified
      const priorityFilteredPlan = input.priority && input.priority !== 'all'
        ? filteredContentPlan.filter(item => item.priority === input.priority)
        : filteredContentPlan;

      // Generate publishing schedule
      const publishingSchedule = this.generatePublishingSchedule(priorityFilteredPlan, targetMonth);

      // Calculate performance targets
      const performanceTargets = this.calculatePerformanceTargets(
        priorityFilteredPlan,
        result.keywordTargets
      );

      const output: GACalendarOutput = {
        month: targetMonth,
        contentPlan: priorityFilteredPlan,
        keywordTargets: result.keywordTargets.map(target => ({
          ...target,
          targetDate: this.assignTargetDate(target, priorityFilteredPlan)
        })),
        publishingSchedule,
        performanceTargets
      };

      this.logger?.info(`Generated ${priorityFilteredPlan.length} content pieces for ${targetMonth}`);

      // Store useful data in context for downstream tasks
      context.data.contentCalendar = priorityFilteredPlan;
      context.data.keywordTargets = result.keywordTargets;
      context.data.publishingSchedule = publishingSchedule;
      context.data.performanceTargets = performanceTargets;

      return output;

    } catch (error) {
      this.logger?.error('Failed to generate content calendar:', error);
      throw new TaskExecutionError(
        `Google Analytics content calendar generation failed: ${error.message}`,
        this.type,
        context.nodeId,
        input
      );
    }
  }

  validate(input: GACalendarInput): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields
    if (!input.propertyId || input.propertyId.trim().length === 0) {
      errors.push('Property ID is required');
    }

    if (!input.siteUrl || input.siteUrl.trim().length === 0) {
      errors.push('Site URL is required');
    }

    // Property ID format validation
    if (input.propertyId && !input.propertyId.match(/^\d+$/)) {
      errors.push('Property ID must be a numeric string');
    }

    // Site URL validation
    if (input.siteUrl) {
      try {
        new URL(input.siteUrl);
      } catch {
        errors.push('Site URL must be a valid URL');
      }
    }

    // Target month validation
    if (input.targetMonth) {
      const monthPattern = /^\d{4}-\d{2}$/;
      if (!monthPattern.test(input.targetMonth)) {
        errors.push('Target month must be in YYYY-MM format');
      } else {
        const [year, month] = input.targetMonth.split('-');
        const targetDate = new Date(parseInt(year), parseInt(month) - 1);
        const currentDate = new Date();
        const maxFutureDate = new Date();
        maxFutureDate.setMonth(maxFutureDate.getMonth() + 6);

        if (targetDate < currentDate) {
          warnings.push('Target month is in the past');
        }
        if (targetDate > maxFutureDate) {
          warnings.push('Target month is more than 6 months in the future');
        }
      }
    }

    // Content types validation
    if (input.contentTypes) {
      const validTypes = ['blog', 'social', 'video', 'email', 'landing-page'];
      const invalidTypes = input.contentTypes.filter(type => !validTypes.includes(type));
      if (invalidTypes.length > 0) {
        errors.push(`Invalid content types: ${invalidTypes.join(', ')}`);
      }
    }

    // Priority validation
    if (input.priority && !['high', 'medium', 'low', 'all'].includes(input.priority)) {
      errors.push('Priority must be "high", "medium", "low", or "all"');
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
      title: 'Content Calendar Generator',
      description: 'Generate monthly content calendar based on analytics insights',
      properties: {
        propertyId: {
          type: 'string',
          title: 'GA4 Property ID',
          description: 'Google Analytics 4 property ID (numeric string)'
        },
        siteUrl: {
          type: 'string',
          title: 'Site URL',
          description: 'Website URL in Search Console',
          format: 'uri'
        },
        targetMonth: {
          type: 'string',
          title: 'Target Month',
          description: 'Month to generate calendar for (YYYY-MM format)',
          format: 'string'
        },
        contentTypes: {
          type: 'array',
          title: 'Content Types',
          description: 'Types of content to include in calendar',
          items: {
            type: 'string',
            title: 'Content Type',
            description: 'Type of content',
            enum: ['blog', 'social', 'video', 'email', 'landing-page']
          }
        },
        priority: {
          type: 'string',
          title: 'Priority Filter',
          description: 'Filter content by priority level',
          enum: ['high', 'medium', 'low', 'all'],
          default: 'all'
        }
      },
      required: ['propertyId', 'siteUrl'],
      examples: [
        {
          propertyId: '123456789',
          siteUrl: 'https://example.com',
          targetMonth: '2024-02',
          contentTypes: ['blog', 'social'],
          priority: 'high'
        }
      ]
    };
  }

  getDisplayInfo(): TaskDisplayInfo {
    return {
      category: NODE_CATEGORIES.ANALYTICS,
      label: 'GA Calendar',
      icon: 'Calendar',
      color: 'bg-green-600',
      description: 'Generate content calendar from analytics',
      tags: ['google-analytics', 'content-calendar', 'planning', 'seo'],
      integrationRequired: INTEGRATION_KEYS.GOOGLE_ANALYTICS
    };
  }

  private getCurrentMonth(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    return `${year}-${month}`;
  }

  private estimateTrafficPotential(keywords: string[], context: WorkflowContext): number {
    // Use keyword data from context if available from previous tasks
    const keywordData = context.data.keywordTargets || context.data.searchQueries || [];
    
    let totalPotential = 0;
    keywords.forEach(keyword => {
      const keywordInfo = keywordData.find((k: any) => 
        k.keyword === keyword || k.query === keyword
      );
      if (keywordInfo) {
        totalPotential += (keywordInfo.volume || keywordInfo.impressions || 100) * 0.1;
      } else {
        totalPotential += 50; // Default estimate
      }
    });

    return Math.floor(totalPotential);
  }

  private calculateResourcesNeeded(contentType: string, priority: string): string[] {
    const baseResources: Record<string, string[]> = {
      'blog': ['Writer', 'Editor', 'Designer (images)'],
      'social': ['Social Media Manager', 'Graphic Designer'],
      'video': ['Video Creator', 'Editor', 'Thumbnail Designer'],
      'email': ['Email Marketer', 'Copywriter', 'Designer'],
      'landing-page': ['Web Developer', 'UX Designer', 'Copywriter']
    };

    const resources = [...(baseResources[contentType] || ['Content Creator'])];

    if (priority === 'high') {
      resources.push('SEO Specialist', 'QA Reviewer');
    }

    return resources;
  }

  private determinePublishingChannel(contentType: string): string {
    const channelMap: Record<string, string> = {
      'blog': 'Website Blog',
      'social': 'Social Media Platforms',
      'video': 'YouTube / Website',
      'email': 'Email Newsletter',
      'landing-page': 'Website'
    };

    return channelMap[contentType] || 'Website';
  }

  private generatePublishingSchedule(contentPlan: any[], targetMonth: string): any {
    const [year, month] = targetMonth.split('-');
    const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate();
    const weeksInMonth = Math.ceil(daysInMonth / 7);

    const weeklyGoals = [];
    for (let week = 1; week <= weeksInMonth; week++) {
      const weekContent = contentPlan.filter(item => {
        const itemDate = new Date(item.date);
        const weekStart = (week - 1) * 7 + 1;
        const weekEnd = Math.min(week * 7, daysInMonth);
        const day = itemDate.getDate();
        return day >= weekStart && day <= weekEnd;
      });

      weeklyGoals.push({
        week: `Week ${week}`,
        contentCount: weekContent.length,
        focusAreas: [...new Set(weekContent.map(item => item.type))]
      });
    }

    const milestones = [
      {
        date: `${targetMonth}-07`,
        milestone: 'Week 1 Review',
        deliverables: ['First week content published', 'Performance metrics reviewed']
      },
      {
        date: `${targetMonth}-15`,
        milestone: 'Mid-Month Assessment',
        deliverables: ['Content performance analysis', 'Calendar adjustments if needed']
      },
      {
        date: `${targetMonth}-30`,
        milestone: 'Month-End Wrap-up',
        deliverables: ['Monthly performance report', 'Next month planning']
      }
    ];

    return { weeklyGoals, milestones };
  }

  private calculatePerformanceTargets(contentPlan: any[], keywordTargets: any[]): any {
    const totalContentPieces = contentPlan.length;
    const targetKeywords = keywordTargets.length;
    const estimatedTrafficIncrease = contentPlan.reduce(
      (sum, item) => sum + item.estimatedTraffic, 0
    );

    const engagementGoals = {
      'blog': 300, // avg time on page (seconds)
      'social': 50, // engagement rate (%)
      'video': 60, // view completion rate (%)
      'email': 25, // click-through rate (%)
      'landing-page': 5 // conversion rate (%)
    };

    return {
      totalContentPieces,
      targetKeywords,
      estimatedTrafficIncrease,
      engagementGoals
    };
  }

  private assignTargetDate(target: any, contentPlan: any[]): string {
    // Find content piece that targets this keyword
    const relatedContent = contentPlan.find(item =>
      item.keywords.includes(target.keyword)
    );

    return relatedContent?.date || this.getCurrentMonth() + '-15';
  }
}