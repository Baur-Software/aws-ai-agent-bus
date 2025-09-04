import { GoogleAnalyticsService } from '../../../services/google-analytics.js';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import EventsHandler from './events.js';

/**
 * Handler for Google Analytics API operations in the MCP server.
 * Provides tools for retrieving analytics data, search console data,
 * content opportunities analysis, and content calendar generation.
 * 
 * @class GoogleAnalyticsHandler
 * @example
 * // Get top pages data
 * const result = await GoogleAnalyticsHandler.getTopPages({
 *   propertyId: 'properties/123456789',
 *   days: 30
 * });
 */
export class GoogleAnalyticsHandler {
  /** @type {GoogleAnalyticsService|null} Singleton Google Analytics service instance */
  static gaService = null;
  
  /** @type {SecretsManagerClient} AWS Secrets Manager client for credential retrieval */
  static secretsClient = new SecretsManagerClient({});

  /**
   * Initialize Google Analytics service with credentials from AWS Secrets Manager.
   * Uses singleton pattern to avoid repeated initialization calls.
   * 
   * @static
   * @async
   * @returns {Promise<GoogleAnalyticsService>} Initialized Google Analytics service
   * @throws {Error} If credentials cannot be retrieved or service initialization fails
   * @example
   * const service = await GoogleAnalyticsHandler.initialize();
   */
  static async initialize() {
    if (this.gaService) return this.gaService;

    try {
      const command = new GetSecretValueCommand({
        SecretId: 'spalding-content-pipeline/google-analytics'
      });
      
      const response = await this.secretsClient.send(command);
      const credentials = JSON.parse(response.SecretString);
      
      this.gaService = new GoogleAnalyticsService();
      await this.gaService.initialize(credentials);
      
      return this.gaService;
    } catch (error) {
      throw new Error(`Failed to initialize Google Analytics: ${error.message}`);
    }
  }

  /**
   * Get top performing pages from Google Analytics for content analysis.
   * Returns page performance metrics including sessions, pageviews, and engagement data.
   * 
   * @static
   * @async
   * @param {Object} params - Parameters for the request
   * @param {string} params.propertyId - GA4 property ID (required)
   * @param {number} [params.days=30] - Number of days to analyze (default: 30)
   * @returns {Promise<Object>} Response object with success flag, data array, and metadata
   * @throws {Error} If propertyId is missing or API call fails
   * @example
   * const result = await GoogleAnalyticsHandler.getTopPages({
   *   propertyId: 'properties/123456789',
   *   days: 30
   * });
   * console.log(result.data); // Array of top performing pages
   */
  static async getTopPages({ propertyId, days = 30 } = {}) {
    if (!propertyId) {
      throw new Error('propertyId is required');
    }

    const service = await this.initialize();
    const data = await service.getTopPages(propertyId, days);
    
    // Send event to notify other agents (skip in test environment)
    if (process.env.NODE_ENV !== 'test') {
      try {
        await EventsHandler.send({
          detailType: 'GoogleAnalytics.TopPages.Retrieved',
          detail: {
            propertyId,
            days,
            pageCount: data.length,
            timestamp: new Date().toISOString()
          }
        });
      } catch (error) {
        // Don't fail the request if event sending fails
        console.warn('Failed to send event:', error.message);
      }
    }

    return {
      success: true,
      data,
      metadata: {
        propertyId,
        days,
        retrievedAt: new Date().toISOString()
      }
    };
  }

  /**
   * Get Search Console keyword data for SEO analysis.
   * Returns search query performance including clicks, impressions, CTR, and position.
   * 
   * @static
   * @async
   * @param {Object} params - Parameters for the request
   * @param {string} params.siteUrl - Website URL registered in Search Console (required)
   * @param {number} [params.days=30] - Number of days to analyze (default: 30)
   * @returns {Promise<Object>} Response object with success flag, keyword data array, and metadata
   * @throws {Error} If siteUrl is missing or API call fails
   * @example
   * const result = await GoogleAnalyticsHandler.getSearchConsoleData({
   *   siteUrl: 'https://example.com',
   *   days: 30
   * });
   * console.log(result.data); // Array of search console keyword data
   */
  static async getSearchConsoleData({ siteUrl, days = 30 } = {}) {
    if (!siteUrl) {
      throw new Error('siteUrl is required');
    }

    const service = await this.initialize();
    const data = await service.getSearchConsoleData(siteUrl, days);
    
    // Send event to notify other agents (skip in test environment)
    if (process.env.NODE_ENV !== 'test') {
      try {
        await EventsHandler.send({
          detailType: 'SearchConsole.Keywords.Retrieved',
          detail: {
            siteUrl,
            days,
            keywordCount: data.length,
            timestamp: new Date().toISOString()
          }
        });
      } catch (error) {
        // Don't fail the request if event sending fails
        console.warn('Failed to send event:', error.message);
      }
    }

    return {
      success: true,
      data,
      metadata: {
        siteUrl,
        days,
        retrievedAt: new Date().toISOString()
      }
    };
  }

  /**
   * Run a custom GA4 report with specified dimensions and metrics.
   * Allows for flexible analytics queries beyond the standard methods.
   * 
   * @static
   * @async
   * @param {Object} params - Parameters for the request
   * @param {string} params.propertyId - GA4 property ID (required)
   * @param {Object} params.reportRequest - GA4 report request object (required)
   * @returns {Promise<Object>} Response object with success flag, report data, and metadata
   * @throws {Error} If required parameters are missing or API call fails
   * @example
   * const result = await GoogleAnalyticsHandler.runReport({
   *   propertyId: 'properties/123456789',
   *   reportRequest: {
   *     dimensions: [{ name: 'pagePath' }],
   *     metrics: [{ name: 'sessions' }]
   *   }
   * });
   */
  static async runReport({ propertyId, reportRequest } = {}) {
    if (!propertyId || !reportRequest) {
      throw new Error('propertyId and reportRequest are required');
    }

    const service = await this.initialize();
    const data = await service.runReport(propertyId, reportRequest);
    
    return {
      success: true,
      data,
      metadata: {
        propertyId,
        reportType: 'custom',
        retrievedAt: new Date().toISOString()
      }
    };
  }

  /**
   * Analyze content opportunities by combining GA and Search Console data.
   * Main function for monthly content strategy automation. Identifies high-performing
   * content, keyword opportunities, content gaps, and seasonal trends.
   * 
   * @static
   * @async
   * @param {Object} params - Parameters for the request
   * @param {string} params.propertyId - GA4 property ID (required)
   * @param {string} params.siteUrl - Website URL registered in Search Console (required)
   * @returns {Promise<Object>} Response with insights including content opportunities and recommendations
   * @throws {Error} If required parameters are missing or analysis fails
   * @example
   * const result = await GoogleAnalyticsHandler.analyzeContentOpportunities({
   *   propertyId: 'properties/123456789',
   *   siteUrl: 'https://example.com'
   * });
   * console.log(result.insights.topPerformingContent);
   * console.log(result.insights.keywordOpportunities);
   */
  static async analyzeContentOpportunities({ propertyId, siteUrl } = {}) {
    if (!propertyId || !siteUrl) {
      throw new Error('propertyId and siteUrl are required');
    }

    const service = await this.initialize();
    const insights = await service.analyzeContentOpportunities(propertyId, siteUrl);
    
    // Send comprehensive event for content calendar generation (skip in test environment)
    if (process.env.NODE_ENV !== 'test') {
      try {
        await EventsHandler.send({
          detailType: 'ContentAnalysis.Opportunities.Generated',
          detail: {
            propertyId,
            siteUrl,
            insights: {
              topContentCount: insights.topPerformingContent?.length || 0,
              keywordOpportunityCount: insights.keywordOpportunities?.length || 0,
              contentGapCount: insights.contentGaps?.length || 0
            },
            timestamp: new Date().toISOString()
          }
        });
      } catch (error) {
        // Don't fail the request if event sending fails
        console.warn('Failed to send event:', error.message);
      }
    }

    return {
      success: true,
      insights,
      metadata: {
        propertyId,
        siteUrl,
        analysisDate: new Date().toISOString(),
        nextAnalysisRecommended: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      }
    };
  }

  /**
   * Generate a monthly content calendar based on analytics insights.
   * Creates actionable content recommendations with due dates, priorities,
   * and content types based on performance data and opportunities.
   * 
   * @static
   * @async
   * @param {Object} params - Parameters for the request
   * @param {string} params.propertyId - GA4 property ID (required)
   * @param {string} params.siteUrl - Website URL registered in Search Console (required)
   * @param {string} [params.targetMonth] - Target month in YYYY-MM format (optional, defaults to next month)
   * @returns {Promise<Object>} Response with generated content calendar and metadata
   * @throws {Error} If required parameters are missing or calendar generation fails
   * @example
   * const result = await GoogleAnalyticsHandler.generateContentCalendar({
   *   propertyId: 'properties/123456789',
   *   siteUrl: 'https://example.com',
   *   targetMonth: '2024-09'
   * });
   * console.log(result.calendar.items); // Array of content calendar items
   */
  static async generateContentCalendar({ propertyId, siteUrl, targetMonth } = {}) {
    if (!propertyId || !siteUrl) {
      throw new Error('propertyId and siteUrl are required');
    }

    // Get content opportunities
    const { insights } = await this.analyzeContentOpportunities({ propertyId, siteUrl });
    
    // Generate content calendar structure
    const calendar = this.buildContentCalendar(insights, targetMonth);
    
    // Send event to trigger Trello board updates (skip in test environment)
    if (process.env.NODE_ENV !== 'test') {
      try {
        await EventsHandler.send({
          detailType: 'ContentCalendar.Generated',
          detail: {
            propertyId,
            siteUrl,
            targetMonth,
            contentItems: calendar.items.length,
            calendar,
            timestamp: new Date().toISOString()
          }
        });
      } catch (error) {
        // Don't fail the request if event sending fails
        console.warn('Failed to send event:', error.message);
      }
    }

    return {
      success: true,
      calendar,
      metadata: {
        generatedAt: new Date().toISOString(),
        targetMonth,
        basedOnInsights: true
      }
    };
  }

  /**
   * Build content calendar structure from analytics insights.
   * Creates pillar content, social media posts, and blog posts based on
   * performance data, keyword opportunities, and content gaps.
   * 
   * @static
   * @private
   * @param {Object} insights - Analytics insights from analyzeContentOpportunities
   * @param {string} [targetMonth] - Target month in YYYY-MM format
   * @returns {Object} Content calendar with month, year, and sorted items array
   * @example
   * const calendar = GoogleAnalyticsHandler.buildContentCalendar(insights, '2024-09');
   * // Returns: { month: 9, year: 2024, items: [...] }
   */
  static buildContentCalendar(insights, targetMonth) {
    const currentDate = new Date();
    let month, year;
    
    if (targetMonth) {
      // Parse targetMonth format like "2024-03"
      const [yearStr, monthStr] = targetMonth.split('-');
      year = parseInt(yearStr);
      month = parseInt(monthStr);
    } else {
      month = currentDate.getMonth() + 1;
      year = currentDate.getFullYear();
    }
    
    const items = [];
    
    // Add pillar content based on top performing themes
    if (insights.topPerformingContent) {
      insights.topPerformingContent.slice(0, 4).forEach((content, index) => {
        items.push({
          type: 'pillar',
          title: `Expand on: ${content.pageTitle}`,
          description: `Create comprehensive content based on high-performing page`,
          dueDate: new Date(year, month - 1, Math.min((index + 1) * 7, 28)).toISOString(),
          keywords: ['high-performing', 'expansion'],
          priority: 'high'
        });
      });
    }

    // Add keyword opportunity content
    if (insights.keywordOpportunities) {
      insights.keywordOpportunities.slice(0, 8).forEach((keyword, index) => {
        items.push({
          type: 'social',
          title: `Target keyword: ${keyword.query}`,
          description: `Create social content targeting this keyword opportunity`,
          dueDate: new Date(year, month - 1, Math.min(3 + (index * 3), 28)).toISOString(),
          keywords: [keyword.query],
          priority: 'medium',
          platform: index % 2 === 0 ? 'linkedin' : 'facebook'
        });
      });
    }

    // Add content gap filling
    if (insights.contentGaps) {
      insights.contentGaps.slice(0, 6).forEach((gap, index) => {
        items.push({
          type: 'blog',
          title: `Address content gap: ${gap.query}`,
          description: `Create content to fill identified gap in search coverage`,
          dueDate: new Date(year, month - 1, Math.min(10 + (index * 3), 28)).toISOString(),
          keywords: [gap.query],
          priority: 'medium'
        });
      });
    }

    return {
      month,
      year,
      items: items.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
    };
  }
}

export default GoogleAnalyticsHandler;