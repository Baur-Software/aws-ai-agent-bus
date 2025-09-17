// Service Layer Tests with Mocked External APIs
// Tests for service abstractions with comprehensive API mocking

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  createServiceContainer,
  MCPService,
  GoogleAnalyticsService,
  TrelloService,
  HTTPService
} from '../../src/services';

// Mock MCP Client for testing service layer
class MockMCPClient {
  private responses = new Map<string, any>();
  private errors = new Map<string, Error>();
  private callHistory: Array<{ tool: string; params: any; timestamp: string }> = [];

  setResponse(tool: string, response: any): void {
    this.responses.set(tool, response);
  }

  setError(tool: string, error: Error): void {
    this.errors.set(tool, error);
  }

  async callTool(tool: string, params: any): Promise<any> {
    this.callHistory.push({
      tool,
      params: { ...params },
      timestamp: new Date().toISOString()
    });

    if (this.errors.has(tool)) {
      throw this.errors.get(tool);
    }

    if (this.responses.has(tool)) {
      return this.responses.get(tool);
    }

    throw new Error(`No mock response configured for tool: ${tool}`);
  }

  getCallHistory(): Array<{ tool: string; params: any; timestamp: string }> {
    return [...this.callHistory];
  }

  clear(): void {
    this.responses.clear();
    this.errors.clear();
    this.callHistory = [];
  }
}

// Mock HTTP Client for testing HTTP service
class MockHTTPClient {
  private responses = new Map<string, any>();
  private errors = new Map<string, Error>();
  private requests: Array<{ method: string; url: string; data?: any; options?: any }> = [];

  setResponse(url: string, response: any): void {
    this.responses.set(url, response);
  }

  setError(url: string, error: Error): void {
    this.errors.set(url, error);
  }

  private async makeRequest(method: string, url: string, data?: any, options?: any): Promise<any> {
    this.requests.push({ method, url, data, options });

    if (this.errors.has(url)) {
      throw this.errors.get(url);
    }

    if (this.responses.has(url)) {
      const response = this.responses.get(url);
      return {
        status: 200,
        statusText: 'OK',
        data: response,
        headers: { 'content-type': 'application/json' }
      };
    }

    throw new Error(`No mock response configured for URL: ${url}`);
  }

  async get(url: string, options?: any): Promise<any> {
    return this.makeRequest('GET', url, undefined, options);
  }

  async post(url: string, data: any, options?: any): Promise<any> {
    return this.makeRequest('POST', url, data, options);
  }

  async put(url: string, data: any, options?: any): Promise<any> {
    return this.makeRequest('PUT', url, data, options);
  }

  async delete(url: string, options?: any): Promise<any> {
    return this.makeRequest('DELETE', url, undefined, options);
  }

  getRequests(): Array<{ method: string; url: string; data?: any; options?: any }> {
    return [...this.requests];
  }

  clear(): void {
    this.responses.clear();
    this.errors.clear();
    this.requests = [];
  }
}

describe('Service Layer with Mocked APIs', () => {
  let mockMCPClient: MockMCPClient;
  let mockHTTPClient: MockHTTPClient;
  let mcpService: MCPService;
  let googleAnalyticsService: GoogleAnalyticsService;
  let trelloService: TrelloService;
  let httpService: HTTPService;

  const TEST_USER_ID = 'service-test-user';

  beforeEach(() => {
    mockMCPClient = new MockMCPClient();
    mockHTTPClient = new MockHTTPClient();

    const services = createServiceContainer({
      mcpClient: mockMCPClient,
      httpClient: mockHTTPClient,
      userId: TEST_USER_ID
    });

    mcpService = services.mcp;
    googleAnalyticsService = services.googleAnalytics;
    trelloService = services.trello;
    httpService = services.http;
  });

  afterEach(() => {
    mockMCPClient.clear();
    mockHTTPClient.clear();
  });

  describe('MCP Service Layer', () => {
    it('should handle KV operations correctly', async () => {
      // Mock KV responses
      mockMCPClient.setResponse('kv.set', { success: true });
      mockMCPClient.setResponse('kv.get', { name: 'test', value: 42 });

      // Test KV set
      await mcpService.kvSet('test-key', { name: 'test', value: 42 }, 24);

      // Test KV get
      const result = await mcpService.kvGet('test-key');

      expect(result).toEqual({ name: 'test', value: 42 });

      // Verify MCP calls
      const history = mockMCPClient.getCallHistory();
      expect(history).toHaveLength(2);
      expect(history[0].tool).toBe('kv.set');
      expect(history[0].params).toEqual({
        key: 'test-key',
        value: { name: 'test', value: 42 },
        ttl_hours: 24
      });
      expect(history[1].tool).toBe('kv.get');
      expect(history[1].params).toEqual({ key: 'test-key' });
    });

    it('should handle artifacts operations', async () => {
      mockMCPClient.setResponse('artifacts.list', [
        { key: 'file1.txt', size: 100, lastModified: '2024-01-01T00:00:00.000Z' },
        { key: 'file2.json', size: 200, lastModified: '2024-01-02T00:00:00.000Z' }
      ]);

      mockMCPClient.setResponse('artifacts.get', 'file content');
      mockMCPClient.setResponse('artifacts.put', { success: true });

      // Test list
      const list = await mcpService.artifactsList('test/');
      expect(list).toHaveLength(2);

      // Test get
      const content = await mcpService.artifactsGet('file1.txt');
      expect(content).toBe('file content');

      // Test put
      await mcpService.artifactsPut('new-file.txt', 'new content', 'text/plain');

      const history = mockMCPClient.getCallHistory();
      expect(history).toHaveLength(3);
      expect(history[0].tool).toBe('artifacts.list');
      expect(history[1].tool).toBe('artifacts.get');
      expect(history[2].tool).toBe('artifacts.put');
    });

    it('should handle events operations', async () => {
      mockMCPClient.setResponse('events.send', {
        eventId: 'evt-123',
        success: true
      });

      const result = await mcpService.eventsSend(
        'Test Event',
        { message: 'test' },
        'test-source'
      );

      expect(result.eventId).toBe('evt-123');
      expect(result.success).toBe(true);

      const history = mockMCPClient.getCallHistory();
      expect(history).toHaveLength(1);
      expect(history[0].tool).toBe('events.send');
      expect(history[0].params).toEqual({
        detailType: 'Test Event',
        detail: { message: 'test' },
        source: 'test-source'
      });
    });

    it('should handle workflow operations', async () => {
      mockMCPClient.setResponse('workflow.start', {
        executionArn: 'arn:aws:states:us-west-2:123456789012:execution:workflow:exec-123',
        startDate: '2024-01-01T00:00:00.000Z'
      });

      mockMCPClient.setResponse('workflow.status', {
        status: 'SUCCEEDED',
        output: '{"result": "success"}'
      });

      // Test workflow start
      const startResult = await mcpService.workflowStart('test-workflow', { input: 'data' });
      expect(startResult.executionArn).toContain('exec-123');

      // Test workflow status
      const statusResult = await mcpService.workflowStatus(startResult.executionArn);
      expect(statusResult.status).toBe('SUCCEEDED');

      const history = mockMCPClient.getCallHistory();
      expect(history).toHaveLength(2);
      expect(history[0].tool).toBe('workflow.start');
      expect(history[1].tool).toBe('workflow.status');
    });

    it('should handle MCP service errors gracefully', async () => {
      mockMCPClient.setError('kv.get', new Error('KV store unavailable'));

      await expect(mcpService.kvGet('failing-key')).rejects.toThrow('KV store unavailable');
    });
  });

  describe('Google Analytics Service Layer', () => {
    it('should get top pages data correctly', async () => {
      mockMCPClient.setResponse('ga.getTopPages', {
        rows: [
          {
            dimensionValues: [{ value: '/analytics-tutorial' }],
            metricValues: [{ value: '2500' }, { value: '2000' }, { value: '180' }]
          },
          {
            dimensionValues: [{ value: '/seo-guide' }],
            metricValues: [{ value: '1800' }, { value: '1500' }, { value: '220' }]
          }
        ],
        totals: [{ metricValues: [{ value: '4300' }] }],
        dateRanges: [{ startDate: '2024-01-01', endDate: '2024-01-31' }]
      });

      const result = await googleAnalyticsService.getTopPages({
        propertyId: '123456789',
        days: 30,
        maxResults: 10
      });

      expect(result.rows).toHaveLength(2);
      expect(result.totals[0].metricValues[0].value).toBe('4300');

      const history = mockMCPClient.getCallHistory();
      expect(history).toHaveLength(1);
      expect(history[0].tool).toBe('ga.getTopPages');
      expect(history[0].params).toEqual({
        propertyId: '123456789',
        days: 30,
        maxResults: 10
      });
    });

    it('should get search console data correctly', async () => {
      mockMCPClient.setResponse('ga.getSearchConsoleData', {
        rows: [
          {
            keys: ['analytics tutorial'],
            clicks: 150,
            impressions: 2500,
            ctr: 0.06,
            position: 12.5
          }
        ],
        totals: {
          clicks: 150,
          impressions: 2500,
          ctr: 0.06,
          position: 12.5
        },
        responseAggregationType: 'byQuery',
        dateRange: { startDate: '2024-01-01', endDate: '2024-01-31' }
      });

      const result = await googleAnalyticsService.getSearchConsoleData({
        siteUrl: 'https://example.com',
        days: 30,
        maxResults: 25
      });

      expect(result.rows).toHaveLength(1);
      expect(result.totals.clicks).toBe(150);

      const history = mockMCPClient.getCallHistory();
      expect(history).toHaveLength(1);
      expect(history[0].tool).toBe('ga.getSearchConsoleData');
    });

    it('should analyze content opportunities', async () => {
      mockMCPClient.setResponse('ga.analyzeContentOpportunities', {
        opportunities: [
          {
            keyword: 'content marketing',
            currentPosition: 15.2,
            potentialClicks: 200,
            difficulty: 'medium',
            priority: 'high'
          }
        ],
        summary: {
          totalOpportunities: 1,
          estimatedTrafficIncrease: 200
        }
      });

      const result = await googleAnalyticsService.analyzeContentOpportunities({
        propertyId: '123456789',
        siteUrl: 'https://example.com'
      });

      expect(result.opportunities).toHaveLength(1);
      expect(result.summary.totalOpportunities).toBe(1);
    });

    it('should generate content calendar', async () => {
      mockMCPClient.setResponse('ga.generateContentCalendar', {
        calendar: [
          {
            date: '2024-02-01',
            contentType: 'blog-post',
            topic: 'Advanced Analytics Techniques',
            keywords: ['analytics', 'data analysis'],
            estimatedImpact: 'high'
          }
        ],
        metadata: {
          totalPosts: 1,
          resourceAllocation: 'medium'
        }
      });

      const result = await googleAnalyticsService.generateContentCalendar({
        propertyId: '123456789',
        siteUrl: 'https://example.com',
        targetMonth: '2024-02'
      });

      expect(result.calendar).toHaveLength(1);
      expect(result.metadata.totalPosts).toBe(1);
    });

    it('should handle GA API errors', async () => {
      mockMCPClient.setError('ga.getTopPages', new Error('GA API quota exceeded'));

      await expect(googleAnalyticsService.getTopPages({
        propertyId: '123456789',
        days: 30,
        maxResults: 10
      })).rejects.toThrow('GA API quota exceeded');
    });
  });

  describe('HTTP Service Layer', () => {
    it('should handle GET requests correctly', async () => {
      mockHTTPClient.setResponse('https://api.example.com/users', {
        users: [{ id: 1, name: 'John' }],
        total: 1
      });

      const result = await httpService.get('https://api.example.com/users', {
        headers: { 'Authorization': 'Bearer token' },
        timeout: 5000
      });

      expect(result.status).toBe(200);
      expect(result.data.users).toHaveLength(1);

      const requests = mockHTTPClient.getRequests();
      expect(requests).toHaveLength(1);
      expect(requests[0].method).toBe('GET');
      expect(requests[0].url).toBe('https://api.example.com/users');
      expect(requests[0].options.headers['Authorization']).toBe('Bearer token');
    });

    it('should handle POST requests correctly', async () => {
      mockHTTPClient.setResponse('https://api.example.com/users', {
        id: 2,
        name: 'Jane',
        created: true
      });

      const userData = { name: 'Jane', email: 'jane@example.com' };
      const result = await httpService.post('https://api.example.com/users', userData, {
        headers: { 'Content-Type': 'application/json' }
      });

      expect(result.status).toBe(200);
      expect(result.data.created).toBe(true);

      const requests = mockHTTPClient.getRequests();
      expect(requests).toHaveLength(1);
      expect(requests[0].method).toBe('POST');
      expect(requests[0].data).toEqual(userData);
    });

    it('should handle PUT and DELETE requests', async () => {
      mockHTTPClient.setResponse('https://api.example.com/users/1', {
        id: 1,
        name: 'John Updated',
        updated: true
      });

      mockHTTPClient.setResponse('https://api.example.com/users/2', {
        deleted: true
      });

      // Test PUT
      const putResult = await httpService.put('https://api.example.com/users/1', {
        name: 'John Updated'
      });

      expect(putResult.data.updated).toBe(true);

      // Test DELETE
      const deleteResult = await httpService.delete('https://api.example.com/users/2');
      expect(deleteResult.data.deleted).toBe(true);

      const requests = mockHTTPClient.getRequests();
      expect(requests).toHaveLength(2);
      expect(requests[0].method).toBe('PUT');
      expect(requests[1].method).toBe('DELETE');
    });

    it('should handle HTTP errors correctly', async () => {
      mockHTTPClient.setError('https://api.example.com/failing', new Error('Network timeout'));

      await expect(httpService.get('https://api.example.com/failing')).rejects.toThrow('Network timeout');
    });

    it('should handle different response status codes', async () => {
      // Mock a 404 response
      mockHTTPClient.setResponse('https://api.example.com/notfound', null);
      const notFoundError = new Error('Not Found');
      (notFoundError as any).response = { status: 404 };
      mockHTTPClient.setError('https://api.example.com/notfound', notFoundError);

      await expect(httpService.get('https://api.example.com/notfound')).rejects.toThrow('Not Found');
    });
  });

  describe('Trello Service Layer', () => {
    it('should create cards correctly', async () => {
      // Mock Trello API calls through MCP
      mockMCPClient.setResponse('trello.createCard', {
        id: 'card-123',
        name: 'Test Card',
        desc: 'Test Description',
        idList: 'list-456',
        url: 'https://trello.com/c/card-123'
      });

      const result = await trelloService.createCard({
        listId: 'list-456',
        name: 'Test Card',
        description: 'Test Description',
        position: 'top'
      });

      expect(result.id).toBe('card-123');
      expect(result.name).toBe('Test Card');

      const history = mockMCPClient.getCallHistory();
      expect(history).toHaveLength(1);
      expect(history[0].tool).toBe('trello.createCard');
      expect(history[0].params).toEqual({
        listId: 'list-456',
        name: 'Test Card',
        description: 'Test Description',
        position: 'top'
      });
    });

    it('should create boards correctly', async () => {
      mockMCPClient.setResponse('trello.createBoard', {
        id: 'board-789',
        name: 'Test Board',
        desc: 'Test Board Description',
        url: 'https://trello.com/b/board-789'
      });

      const result = await trelloService.createBoard({
        name: 'Test Board',
        description: 'Test Board Description',
        visibility: 'private'
      });

      expect(result.id).toBe('board-789');
      expect(result.name).toBe('Test Board');

      const history = mockMCPClient.getCallHistory();
      expect(history).toHaveLength(1);
      expect(history[0].tool).toBe('trello.createBoard');
    });

    it('should handle Trello API errors', async () => {
      mockMCPClient.setError('trello.createCard', new Error('Trello API authentication failed'));

      await expect(trelloService.createCard({
        listId: 'invalid-list',
        name: 'Test Card'
      })).rejects.toThrow('Trello API authentication failed');
    });
  });

  describe('Service Integration and Error Handling', () => {
    it('should handle service timeouts', async () => {
      const timeoutError = new Error('Request timeout');
      timeoutError.name = 'TimeoutError';
      
      mockHTTPClient.setError('https://api.slow.com/endpoint', timeoutError);

      await expect(httpService.get('https://api.slow.com/endpoint', {
        timeout: 1000
      })).rejects.toThrow('Request timeout');
    });

    it('should handle network connectivity issues', async () => {
      const networkError = new Error('Network unreachable');
      networkError.name = 'NetworkError';
      
      mockMCPClient.setError('kv.get', networkError);

      await expect(mcpService.kvGet('test-key')).rejects.toThrow('Network unreachable');
    });

    it('should handle malformed API responses', async () => {
      // Mock response that doesn't match expected format
      mockMCPClient.setResponse('ga.getTopPages', {
        // Missing required fields
        invalid: 'response'
      });

      // Service should handle gracefully or throw appropriate error
      const result = await googleAnalyticsService.getTopPages({
        propertyId: '123456789',
        days: 30,
        maxResults: 10
      });

      // Should return the raw response even if malformed
      expect(result.invalid).toBe('response');
    });

    it('should handle concurrent service calls', async () => {
      // Set up multiple responses
      mockMCPClient.setResponse('kv.get', 'value1');
      mockHTTPClient.setResponse('https://api.example.com/data1', { data: 'response1' });

      const [kvResult, httpResult] = await Promise.all([
        mcpService.kvGet('key1'),
        httpService.get('https://api.example.com/data1')
      ]);

      expect(kvResult).toBe('value1');
      expect(httpResult.data.data).toBe('response1');

      // Verify both calls were made
      const mcpHistory = mockMCPClient.getCallHistory();
      const httpRequests = mockHTTPClient.getRequests();
      
      expect(mcpHistory).toHaveLength(1);
      expect(httpRequests).toHaveLength(1);
    });

    it('should handle rate limiting', async () => {
      const rateLimitError = new Error('API rate limit exceeded');
      (rateLimitError as any).response = { status: 429 };
      
      mockHTTPClient.setError('https://api.example.com/limited', rateLimitError);

      await expect(httpService.get('https://api.example.com/limited')).rejects.toThrow('API rate limit exceeded');
    });
  });

  describe('Service Performance and Monitoring', () => {
    it('should track service call performance', async () => {
      mockMCPClient.setResponse('kv.set', { success: true });

      const start = Date.now();
      await mcpService.kvSet('perf-test', { data: 'performance test' });
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(1000); // Should complete quickly with mocks

      const history = mockMCPClient.getCallHistory();
      expect(history[0].timestamp).toBeDefined();
    });

    it('should handle large payloads efficiently', async () => {
      const largeData = {
        records: Array.from({ length: 10000 }, (_, i) => ({
          id: i,
          data: `record-${i}`,
          metadata: { created: new Date().toISOString() }
        }))
      };

      mockMCPClient.setResponse('artifacts.put', { success: true });

      const start = Date.now();
      await mcpService.artifactsPut('large-dataset.json', largeData, 'application/json');
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(2000); // Should handle large data efficiently

      const history = mockMCPClient.getCallHistory();
      expect(history[0].params.content).toEqual(largeData);
    });

    it('should maintain service call isolation', async () => {
      // Set up different responses for different services
      mockMCPClient.setResponse('kv.get', 'mcp-value');
      mockHTTPClient.setResponse('https://api.example.com/test', { source: 'http' });

      // Make calls to different services
      const mcpResult = await mcpService.kvGet('test-key');
      const httpResult = await httpService.get('https://api.example.com/test');

      // Results should be isolated
      expect(mcpResult).toBe('mcp-value');
      expect(httpResult.data.source).toBe('http');

      // Call histories should be separate
      const mcpHistory = mockMCPClient.getCallHistory();
      const httpRequests = mockHTTPClient.getRequests();

      expect(mcpHistory).toHaveLength(1);
      expect(httpRequests).toHaveLength(1);
    });
  });
});