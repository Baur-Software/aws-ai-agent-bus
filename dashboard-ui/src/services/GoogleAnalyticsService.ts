// Google Analytics Service Client
// Provides abstraction over Google Analytics API calls through MCP

export interface MCPClient {
  callTool(tool: string, params: any): Promise<any>;
}

export interface GATopPagesParams {
  propertyId: string;
  days: number;
  maxResults?: number;
}

export interface GASearchConsoleParams {
  siteUrl: string;
  days: number;
  maxResults?: number;
}

export interface GAContentOpportunitiesParams {
  propertyId: string;
  siteUrl: string;
  days?: number;
}

export interface GAContentCalendarParams {
  propertyId: string;
  siteUrl: string;
  targetMonth: string;
}

export class GoogleAnalyticsService {
  constructor(private client: MCPClient) {}

  async getTopPages(params: GATopPagesParams): Promise<any> {
    return this.client.callTool('ga.getTopPages', params);
  }

  async getSearchConsoleData(params: GASearchConsoleParams): Promise<any> {
    return this.client.callTool('ga.getSearchConsoleData', params);
  }

  async analyzeContentOpportunities(params: GAContentOpportunitiesParams): Promise<any> {
    return this.client.callTool('ga.analyzeContentOpportunities', params);
  }

  async generateContentCalendar(params: GAContentCalendarParams): Promise<any> {
    return this.client.callTool('ga.generateContentCalendar', params);
  }

  async getUserMetrics(params: { propertyId: string; days: number }): Promise<any> {
    return this.client.callTool('ga.getUserMetrics', params);
  }

  async getConversionData(params: { propertyId: string; days: number }): Promise<any> {
    return this.client.callTool('ga.getConversionData', params);
  }
}

export function createGoogleAnalyticsService(client: MCPClient): GoogleAnalyticsService {
  return new GoogleAnalyticsService(client);
}
