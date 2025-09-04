import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';

/**
 * Service for interacting with Google Analytics Data API v1beta and Search Console API.
 * Supports both OAuth2 and Service Account authentication methods.
 * 
 * @class GoogleAnalyticsService
 * @example
 * const service = new GoogleAnalyticsService();
 * await service.initialize(credentials);
 * 
 * const topPages = await service.getTopPages('properties/123456789', 30);
 * const keywords = await service.getSearchConsoleData('https://example.com', 30);
 */
export class GoogleAnalyticsService {
  /**
   * Create a new Google Analytics service instance.
   */
  constructor() {
    /** @type {Object|null} Google Analytics Data API client */
    this.analytics = null;
    
    /** @type {Object|null} Google Search Console API client */
    this.searchconsole = null;
    
    /** @type {Object|null} Authentication client (OAuth2 or GoogleAuth) */
    this.auth = null;
  }

  /**
   * Initialize Google Analytics and Search Console API clients.
   * Automatically detects credential type and sets up appropriate authentication.
   * 
   * @async
   * @param {Object} credentials - Google API credentials
   * @param {string} [credentials.client_id] - OAuth2 client ID
   * @param {string} [credentials.client_secret] - OAuth2 client secret
   * @param {string} [credentials.access_token] - OAuth2 access token
   * @param {string} [credentials.refresh_token] - OAuth2 refresh token
   * @param {string} [credentials.type] - Service account type ('service_account')
   * @param {string} [credentials.private_key] - Service account private key
   * @param {string} [credentials.client_email] - Service account email
   * @returns {Promise<boolean>} True if initialization succeeded
   * @throws {Error} If credentials are invalid or API initialization fails
   * @example
   * // OAuth2 credentials
   * await service.initialize({
   *   client_id: 'your-client-id',
   *   client_secret: 'your-secret',
   *   access_token: 'access-token',
   *   refresh_token: 'refresh-token'
   * });
   * 
   * // Service account credentials
   * await service.initialize({
   *   type: 'service_account',
   *   private_key: '-----BEGIN PRIVATE KEY-----...',
   *   client_email: 'service@project.iam.gserviceaccount.com'
   * });
   */
  async initialize(credentials) {
    try {
      // Handle OAuth2 credentials (with access_token/refresh_token)
      if (credentials.access_token || credentials.refresh_token) {
        const { OAuth2Client } = await import('google-auth-library');
        this.auth = new OAuth2Client(
          credentials.client_id,
          credentials.client_secret,
          credentials.redirect_uris?.[0] || 'https://www.myapp.com'
        );
        
        // Set credentials if we have tokens
        if (credentials.access_token || credentials.refresh_token) {
          this.auth.setCredentials({
            access_token: credentials.access_token,
            refresh_token: credentials.refresh_token,
            scope: 'https://www.googleapis.com/auth/analytics.readonly https://www.googleapis.com/auth/webmasters.readonly',
            token_type: 'Bearer'
          });
        }
      } else {
        // Handle Service Account credentials
        this.auth = new GoogleAuth({
          credentials,
          scopes: [
            'https://www.googleapis.com/auth/analytics.readonly',
            'https://www.googleapis.com/auth/webmasters.readonly'
          ]
        });
      }

      this.analytics = google.analyticsdata({ version: 'v1beta', auth: this.auth });
      this.searchconsole = google.searchconsole({ version: 'v1', auth: this.auth });
      
      return true;
    } catch (error) {
      throw new Error(`Failed to initialize Google Analytics: ${error.message}`);
    }
  }

  /**
   * Get GA4 property metadata and configuration details.
   * Useful for validating property access and understanding available dimensions/metrics.
   * 
   * @async
   * @param {string} propertyId - GA4 property ID (without 'properties/' prefix)
   * @returns {Promise<Object>} Property metadata including dimensions and metrics
   * @throws {Error} If property doesn't exist or access is denied
   * @example
   * const metadata = await service.getPropertyDetails('123456789');
   * console.log(metadata.dimensions); // Available dimensions
   */
  async getPropertyDetails(propertyId) {
    try {
      const response = await this.analytics.properties.getMetadata({
        name: `properties/${propertyId}/metadata`
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get property details: ${error.message}`);
    }
  }

  /**
   * Run a custom GA4 analytics report with specified dimensions and metrics.
   * Provides flexible querying capabilities for advanced analytics needs.
   * 
   * @async
   * @param {string} propertyId - GA4 property ID (without 'properties/' prefix)
   * @param {Object} reportRequest - Report configuration object
   * @param {Array} [reportRequest.dimensions] - Dimensions to group by
   * @param {Array} [reportRequest.metrics] - Metrics to aggregate
   * @param {Array} [reportRequest.dateRanges] - Date ranges for the report
   * @param {Array} [reportRequest.dimensionFilter] - Filters to apply
   * @param {number} [reportRequest.limit] - Maximum number of rows to return
   * @returns {Promise<Array>} Formatted report data as array of objects
   * @throws {Error} If report request fails or property access is denied
   * @example
   * const report = await service.runReport('123456789', {
   *   dimensions: [{ name: 'pagePath' }],
   *   metrics: [{ name: 'sessions' }, { name: 'pageviews' }],
   *   dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }]
   * });
   */
  async runReport(propertyId, reportRequest) {
    try {
      const defaultRequest = {
        property: `properties/${propertyId}`,
        dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
        ...reportRequest
      };

      const response = await this.analytics.properties.runReport({
        property: `properties/${propertyId}`,
        requestBody: defaultRequest
      });

      return this.formatReportData(response.data);
    } catch (error) {
      throw new Error(`Failed to run GA4 report: ${error.message}`);
    }
  }

  /**
   * Get top performing pages from GA4 for content analysis.
   * Returns pages with highest engagement metrics including sessions, pageviews, and user engagement.
   * 
   * @async
   * @param {string} propertyId - GA4 property ID (without 'properties/' prefix)
   * @param {number} [days=30] - Number of days to analyze from today backwards
   * @returns {Promise<Array>} Array of page performance objects with metrics
   * @throws {Error} If report request fails or property access is denied
   * @example
   * const topPages = await service.getTopPages('123456789', 30);
   * console.log(topPages[0]); // { pagePath: '/blog/post', sessions: 1500, pageviews: 2100, ... }
   */
  async getTopPages(propertyId, days = 30) {
    const reportRequest = {
      dimensions: [
        { name: 'pagePath' },
        { name: 'pageTitle' }
      ],
      metrics: [
        { name: 'sessions' },
        { name: 'pageviews' },
        { name: 'averageSessionDuration' },
        { name: 'bounceRate' }
      ],
      dateRanges: [{ 
        startDate: `${days}daysAgo`, 
        endDate: 'today' 
      }],
      orderBys: [{ 
        metric: { metricName: 'sessions' }, 
        desc: true 
      }],
      limit: 50
    };

    return await this.runReport(propertyId, reportRequest);
  }

  /**
   * Get Search Console data for keyword analysis
   * @param {string} siteUrl - Website URL in Search Console
   * @param {number} days - Number of days to analyze
   */
  async getSearchConsoleData(siteUrl, days = 30) {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const request = {
        siteUrl,
        requestBody: {
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          dimensions: ['query', 'page'],
          rowLimit: 1000,
          startRow: 0
        }
      };

      const response = await this.searchconsole.searchanalytics.query(request);
      return this.formatSearchConsoleData(response.data);
    } catch (error) {
      throw new Error(`Failed to get Search Console data: ${error.message}`);
    }
  }

  /**
   * Analyze content opportunities based on GA and Search Console data
   * @param {string} propertyId - GA4 property ID
   * @param {string} siteUrl - Search Console site URL
   */
  async analyzeContentOpportunities(propertyId, siteUrl) {
    try {
      const [topPages, searchData] = await Promise.all([
        this.getTopPages(propertyId, 90), // 3 months of data
        this.getSearchConsoleData(siteUrl, 90)
      ]);

      return this.generateContentInsights(topPages, searchData);
    } catch (error) {
      throw new Error(`Failed to analyze content opportunities: ${error.message}`);
    }
  }

  /**
   * Format GA4 report data for easier consumption
   * @private
   */
  formatReportData(data) {
    if (!data.rows) return [];

    return data.rows.map(row => {
      const result = {};
      
      // Map dimensions
      if (data.dimensionHeaders && row.dimensionValues) {
        data.dimensionHeaders.forEach((header, index) => {
          result[header.name] = row.dimensionValues[index].value;
        });
      }

      // Map metrics
      if (data.metricHeaders && row.metricValues) {
        data.metricHeaders.forEach((header, index) => {
          result[header.name] = parseFloat(row.metricValues[index].value) || 0;
        });
      }

      return result;
    });
  }

  /**
   * Format Search Console data
   * @private
   */
  formatSearchConsoleData(data) {
    if (!data.rows) return [];

    return data.rows.map(row => ({
      query: row.keys[0],
      page: row.keys[1],
      clicks: row.clicks || 0,
      impressions: row.impressions || 0,
      ctr: row.ctr || 0,
      position: row.position || 0
    }));
  }

  /**
   * Generate content insights from analytics data
   * @private
   */
  generateContentInsights(gaData, searchData) {
    const insights = {
      topPerformingContent: gaData.slice(0, 10),
      keywordOpportunities: searchData
        .filter(item => item.position > 10 && item.impressions > 50)
        .slice(0, 20),
      contentGaps: this.identifyContentGaps(gaData, searchData),
      seasonalTrends: this.analyzeSeasonalPatterns(gaData)
    };

    return insights;
  }

  /**
   * Identify content gaps based on search queries vs existing content
   * @private
   */
  identifyContentGaps(gaData, searchData) {
    const existingPages = new Set(gaData.map(page => page.pagePath));
    
    return searchData
      .filter(item => item.impressions > 100 && item.ctr < 0.05)
      .filter(item => !existingPages.has(item.page))
      .slice(0, 15);
  }

  /**
   * Analyze seasonal patterns in traffic data
   * @private
   */
  analyzeSeasonalPatterns(gaData) {
    // This would require time-series data to be meaningful
    // For now, return placeholder for seasonal analysis
    return {
      message: "Seasonal analysis requires historical time-series data",
      recommendation: "Consider running monthly reports to build seasonal patterns"
    };
  }
}