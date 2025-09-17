// Google Analytics Service Client
// Provides clean abstraction over Google Analytics API calls

export interface GATopPagesParams {
  propertyId: string;
  days?: number;
  maxResults?: number;
}

export interface GATopPagesResult {
  rows: GAPageRow[];
  totals?: GATotal[];
  dateRanges?: GADateRange[];
}

export interface GAPageRow {
  dimensionValues: { value: string }[];
  metricValues: { value: string }[];
}

export interface GATotal {
  metricValues: { value: string }[];
}

export interface GADateRange {
  startDate: string;
  endDate: string;
}

export interface GASearchParams {
  siteUrl: string;
  days?: number;
  maxResults?: number;
}

export interface GASearchResult {
  rows: GASearchRow[];
  totals?: GATotal[];
}

export interface GASearchRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GAOpportunityParams {
  propertyId: string;
  siteUrl: string;
}

export interface GAOpportunityResult {
  contentOpportunities: ContentOpportunity[];
  performanceInsights: PerformanceInsight[];
}

export interface ContentOpportunity {
  topic: string;
  searchVolume: number;
  difficulty: 'low' | 'medium' | 'high';
  currentRank?: number;
  potentialTraffic: number;
}

export interface PerformanceInsight {
  page: string;
  recommendation: string;
  impact: 'high' | 'medium' | 'low';
  currentMetrics: Record<string, number>;
}

export interface GACalendarParams {
  propertyId: string;
  siteUrl: string;
  targetMonth?: string;
}

export interface GACalendarResult {
  month: string;
  contentSuggestions: ContentSuggestion[];
  keywordTargets: KeywordTarget[];
  publishingSchedule: PublishingSchedule[];
}

export interface ContentSuggestion {
  title: string;
  topic: string;
  targetKeywords: string[];
  priority: number;
  estimatedTraffic: number;
}

export interface KeywordTarget {
  keyword: string;
  searchVolume: number;
  difficulty: number;
  currentPosition?: number;
}

export interface PublishingSchedule {
  date: string;
  contentType: string;
  topic: string;
  targetAudience: string;
}

export class GoogleAnalyticsService {
  private mcpClient: any; // Will be injected

  constructor(mcpClient: any) {
    this.mcpClient = mcpClient;
  }

  async getTopPages(params: GATopPagesParams): Promise<GATopPagesResult> {
    try {
      const result = await this.mcpClient.callTool('mcp__aws__ga_getTopPages', {
        propertyId: params.propertyId,
        days: params.days || 30
      });

      // Transform MCP response to our interface
      return {
        rows: result.rows || [],
        totals: result.totals || [],
        dateRanges: result.dateRanges || []
      };
    } catch (error) {
      throw new GoogleAnalyticsError(`Failed to get top pages: ${error.message}`, 'GET_TOP_PAGES', params);
    }
  }

  async getSearchConsoleData(params: GASearchParams): Promise<GASearchResult> {
    try {
      const result = await this.mcpClient.callTool('mcp__aws__ga_getSearchConsoleData', {
        siteUrl: params.siteUrl,
        days: params.days || 30
      });

      return {
        rows: result.rows || [],
        totals: result.totals || []
      };
    } catch (error) {
      throw new GoogleAnalyticsError(`Failed to get search console data: ${error.message}`, 'GET_SEARCH_DATA', params);
    }
  }

  async analyzeContentOpportunities(params: GAOpportunityParams): Promise<GAOpportunityResult> {
    try {
      const result = await this.mcpClient.callTool('mcp__aws__ga_analyzeContentOpportunities', {
        propertyId: params.propertyId,
        siteUrl: params.siteUrl
      });

      return {
        contentOpportunities: result.contentOpportunities || [],
        performanceInsights: result.performanceInsights || []
      };
    } catch (error) {
      throw new GoogleAnalyticsError(`Failed to analyze content opportunities: ${error.message}`, 'ANALYZE_OPPORTUNITIES', params);
    }
  }

  async generateContentCalendar(params: GACalendarParams): Promise<GACalendarResult> {
    try {
      const result = await this.mcpClient.callTool('mcp__aws__ga_generateContentCalendar', {
        propertyId: params.propertyId,
        siteUrl: params.siteUrl,
        targetMonth: params.targetMonth
      });

      return {
        month: result.month || params.targetMonth || new Date().toISOString().substring(0, 7),
        contentSuggestions: result.contentSuggestions || [],
        keywordTargets: result.keywordTargets || [],
        publishingSchedule: result.publishingSchedule || []
      };
    } catch (error) {
      throw new GoogleAnalyticsError(`Failed to generate content calendar: ${error.message}`, 'GENERATE_CALENDAR', params);
    }
  }

  // Utility methods for common operations
  async validateCredentials(): Promise<boolean> {
    try {
      // Try a simple API call to validate credentials
      await this.getTopPages({ propertyId: 'test', days: 1 });
      return true;
    } catch (error) {
      return false;
    }
  }

  formatDateRange(days: number): { startDate: string; endDate: string } {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    };
  }
}

export class GoogleAnalyticsError extends Error {
  constructor(
    message: string,
    public operation: string,
    public params: any
  ) {
    super(message);
    this.name = 'GoogleAnalyticsError';
  }
}

// Factory function for easy instantiation
export function createGoogleAnalyticsService(mcpClient: any): GoogleAnalyticsService {
  return new GoogleAnalyticsService(mcpClient);
}