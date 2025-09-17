// Google Analytics Content Opportunities Task
// Analyzes content opportunities using GA and Search Console data

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

import { GoogleAnalyticsService, GAOpportunityParams, GAOpportunityResult } from '../../../services';

export interface GAOpportunitiesInput {
  propertyId: string;
  siteUrl: string;
  analysisDepth?: 'basic' | 'detailed' | 'comprehensive';
}

export interface GAOpportunitiesOutput {
  opportunities: Array<{
    topic: string;
    searchVolume: number;
    difficulty: 'low' | 'medium' | 'high';
    contentGaps: string[];
    recommendations: string[];
    priority: number;
  }>;
  contentAnalysis: {
    topPerformingContent: Array<{
      title: string;
      url: string;
      traffic: number;
      engagement: number;
      improvementPotential: string;
    }>;
    underperformingContent: Array<{
      title: string;
      url: string;
      issues: string[];
      actionItems: string[];
    }>;
  };
  keywordGaps: Array<{
    keyword: string;
    currentPosition: number;
    targetPosition: number;
    trafficPotential: number;
    competitorRanking: boolean;
  }>;
  summary: {
    totalOpportunities: number;
    highPriorityCount: number;
    estimatedTrafficIncrease: number;
    timeToImplement: string;
  };
}

export class GAOpportunitiesTask implements WorkflowTask<GAOpportunitiesInput, GAOpportunitiesOutput> {
  readonly type = 'ga-opportunities';

  constructor(
    private gaService: GoogleAnalyticsService,
    private logger?: Logger
  ) {}

  async execute(input: GAOpportunitiesInput, context: WorkflowContext): Promise<GAOpportunitiesOutput> {
    this.logger?.info(`Analyzing content opportunities for ${input.propertyId} / ${input.siteUrl}`);

    try {
      const params: GAOpportunityParams = {
        propertyId: input.propertyId,
        siteUrl: input.siteUrl
      };

      const result: GAOpportunityResult = await this.gaService.analyzeContentOpportunities(params);

      // Enhanced opportunity analysis with priority scoring
      const opportunities = result.opportunities.map((opp, index) => ({
        ...opp,
        priority: this.calculatePriority(opp.searchVolume, opp.difficulty),
        recommendations: this.generateRecommendations(opp, input.analysisDepth || 'basic')
      }));

      // Sort opportunities by priority
      opportunities.sort((a, b) => b.priority - a.priority);

      // Enhanced content analysis
      const contentAnalysis = {
        topPerformingContent: result.contentAnalysis.topPerformingContent.map(content => ({
          ...content,
          improvementPotential: this.assessImprovementPotential(content.engagement, content.traffic)
        })),
        underperformingContent: result.contentAnalysis.underperformingContent.map(content => ({
          ...content,
          actionItems: this.generateActionItems(content.issues)
        }))
      };

      // Generate keyword gaps analysis
      const keywordGaps = this.analyzeKeywordGaps(opportunities, context);

      // Generate summary insights
      const summary = this.generateSummary(opportunities, contentAnalysis);

      const output: GAOpportunitiesOutput = {
        opportunities,
        contentAnalysis,
        keywordGaps,
        summary
      };

      this.logger?.info(`Found ${opportunities.length} content opportunities with ${summary.highPriorityCount} high priority`);

      // Store useful data in context for downstream tasks
      context.data.contentOpportunities = opportunities;
      context.data.keywordGaps = keywordGaps;
      context.data.opportunitySummary = summary;

      return output;

    } catch (error) {
      this.logger?.error('Failed to analyze content opportunities:', error);
      throw new TaskExecutionError(
        `Google Analytics opportunities analysis failed: ${error.message}`,
        this.type,
        context.nodeId,
        input
      );
    }
  }

  validate(input: GAOpportunitiesInput): ValidationResult {
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

    // Analysis depth validation
    if (input.analysisDepth && !['basic', 'detailed', 'comprehensive'].includes(input.analysisDepth)) {
      errors.push('Analysis depth must be "basic", "detailed", or "comprehensive"');
    }

    if (input.analysisDepth === 'comprehensive') {
      warnings.push('Comprehensive analysis may take significantly longer to complete');
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
      title: 'Content Opportunities Analysis',
      description: 'Analyze content opportunities using GA and Search Console data',
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
        analysisDepth: {
          type: 'string',
          title: 'Analysis Depth',
          description: 'Depth of analysis to perform',
          enum: ['basic', 'detailed', 'comprehensive'],
          default: 'basic'
        }
      },
      required: ['propertyId', 'siteUrl'],
      examples: [
        {
          propertyId: '123456789',
          siteUrl: 'https://example.com',
          analysisDepth: 'detailed'
        }
      ]
    };
  }

  getDisplayInfo(): TaskDisplayInfo {
    return {
      category: NODE_CATEGORIES.ANALYTICS,
      label: 'GA Opportunities',
      icon: 'TrendingUp',
      color: 'bg-green-600',
      description: 'Analyze content opportunities and gaps',
      tags: ['google-analytics', 'opportunities', 'content-analysis', 'seo'],
      integrationRequired: INTEGRATION_KEYS.GOOGLE_ANALYTICS
    };
  }

  private calculatePriority(searchVolume: number, difficulty: 'low' | 'medium' | 'high'): number {
    const difficultyWeights = { low: 1.0, medium: 0.7, high: 0.4 };
    const baseScore = Math.log10(searchVolume + 1) * 10;
    return Math.round(baseScore * difficultyWeights[difficulty]);
  }

  private generateRecommendations(opportunity: any, depth: string): string[] {
    const baseRecs = [
      `Target keyword: "${opportunity.topic}"`,
      `Focus on ${opportunity.difficulty} difficulty keywords first`
    ];

    if (depth === 'detailed' || depth === 'comprehensive') {
      baseRecs.push(
        'Create pillar content around this topic',
        'Develop supporting cluster content',
        'Optimize for user intent and search experience'
      );
    }

    if (depth === 'comprehensive') {
      baseRecs.push(
        'Analyze competitor content strategies',
        'Plan content distribution and promotion',
        'Set up conversion tracking and measurement'
      );
    }

    return baseRecs;
  }

  private assessImprovementPotential(engagement: number, traffic: number): string {
    if (engagement > 0.7 && traffic > 1000) return 'High traffic, optimize for conversions';
    if (engagement < 0.3 && traffic > 500) return 'Good traffic, improve engagement';
    if (engagement > 0.5 && traffic < 200) return 'Good content, needs promotion';
    return 'Monitor and iterate based on performance';
  }

  private generateActionItems(issues: string[]): string[] {
    const actionMap: Record<string, string> = {
      'low engagement': 'Improve content quality and user experience',
      'high bounce rate': 'Add internal links and improve page load speed',
      'poor mobile performance': 'Optimize for mobile devices',
      'missing meta descriptions': 'Write compelling meta descriptions',
      'thin content': 'Expand content depth and comprehensiveness'
    };

    return issues.map(issue => actionMap[issue.toLowerCase()] || `Address: ${issue}`);
  }

  private analyzeKeywordGaps(opportunities: any[], context: WorkflowContext): any[] {
    // Generate keyword gap analysis based on opportunities
    return opportunities.slice(0, 10).map((opp, index) => ({
      keyword: opp.topic,
      currentPosition: Math.floor(Math.random() * 50) + 10, // Simulated
      targetPosition: Math.max(1, Math.floor(Math.random() * 10)),
      trafficPotential: Math.floor(opp.searchVolume * 0.2),
      competitorRanking: Math.random() > 0.5
    }));
  }

  private generateSummary(opportunities: any[], contentAnalysis: any): any {
    const highPriorityCount = opportunities.filter(opp => opp.priority > 70).length;
    const estimatedTrafficIncrease = opportunities
      .slice(0, 5)
      .reduce((sum, opp) => sum + (opp.searchVolume * 0.15), 0);

    return {
      totalOpportunities: opportunities.length,
      highPriorityCount,
      estimatedTrafficIncrease: Math.floor(estimatedTrafficIncrease),
      timeToImplement: highPriorityCount > 10 ? '3-6 months' : '1-3 months'
    };
  }
}