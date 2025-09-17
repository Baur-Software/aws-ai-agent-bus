// End-to-End Workflow Execution Tests
// Comprehensive tests for complete workflow scenarios

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createServiceContainer, ServiceContainer } from '../../src/services';
import { TaskRegistry } from '../../src/workflow/TaskRegistry';
import { ModularWorkflowEngine } from '../../src/workflow/WorkflowEngine';
import { registerAllTasks } from '../../src/workflow/tasks';
import {
  WorkflowDefinition,
  WorkflowResult,
  Logger,
  EventEmitter,
  NODE_CATEGORIES
} from '../../src/workflow/types';

// Mock External Services
class MockMCPClient {
  private kvStore = new Map<string, any>();
  private artifacts = new Map<string, any>();
  private sentEvents: any[] = [];

  async callTool(tool: string, params: any): Promise<any> {
    switch (tool) {
      case 'kv.get':
        return this.kvStore.get(params.key) || null;
      
      case 'kv.set':
        this.kvStore.set(params.key, params.value);
        return { success: true };
      
      case 'artifacts.list':
        const prefix = params.prefix || '';
        const matchingKeys = Array.from(this.artifacts.keys()).filter(k => k.startsWith(prefix));
        return matchingKeys.map(key => ({
          key,
          lastModified: '2024-01-01T00:00:00.000Z',
          size: JSON.stringify(this.artifacts.get(key)).length,
          contentType: 'application/json'
        }));
      
      case 'artifacts.get':
        return this.artifacts.get(params.key) || null;
      
      case 'artifacts.put':
        this.artifacts.set(params.key, params.content);
        return { success: true };
      
      case 'events.send':
        const event = {
          eventId: `event-${Date.now()}`,
          detailType: params.detailType,
          detail: params.detail,
          source: params.source || 'test',
          timestamp: new Date().toISOString()
        };
        this.sentEvents.push(event);
        return { eventId: event.eventId, success: true };
      
      case 'ga.getTopPages':
        return this.mockGATopPages(params);
      
      case 'ga.getSearchConsoleData':
        return this.mockGASearchData(params);
      
      default:
        throw new Error(`Unknown MCP tool: ${tool}`);
    }
  }

  private mockGATopPages(params: any) {
    const pages = [
      { page: '/analytics-guide', pageviews: 2500, uniquePageviews: 2000, avgTimeOnPage: 180 },
      { page: '/seo-tips', pageviews: 1800, uniquePageviews: 1500, avgTimeOnPage: 220 },
      { page: '/content-marketing', pageviews: 1200, uniquePageviews: 1000, avgTimeOnPage: 160 }
    ];

    return {
      rows: pages.slice(0, params.maxResults || 10).map(page => ({
        dimensionValues: [{ value: page.page }],
        metricValues: [
          { value: String(page.pageviews) },
          { value: String(page.uniquePageviews) },
          { value: String(page.avgTimeOnPage) }
        ]
      })),
      totals: [{ metricValues: [{ value: '5500' }] }],
      dateRanges: [{
        startDate: new Date(Date.now() - (params.days || 30) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0]
      }]
    };
  }

  private mockGASearchData(params: any) {
    const queries = [
      { query: 'analytics tutorial', clicks: 150, impressions: 2500, ctr: 0.06, position: 12.5 },
      { query: 'seo best practices', clicks: 89, impressions: 1800, ctr: 0.049, position: 15.2 },
      { query: 'content strategy', clicks: 65, impressions: 900, ctr: 0.072, position: 8.7 }
    ];

    return {
      rows: queries.map(q => ({
        keys: [q.query],
        clicks: q.clicks,
        impressions: q.impressions,
        ctr: q.ctr,
        position: q.position
      })),
      totals: {
        clicks: queries.reduce((sum, q) => sum + q.clicks, 0),
        impressions: queries.reduce((sum, q) => sum + q.impressions, 0),
        ctr: 0.058,
        position: 12.1
      },
      responseAggregationType: 'byQuery',
      dateRange: {
        startDate: new Date(Date.now() - (params.days || 30) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0]
      }
    };
  }

  // Test helpers
  getKVData(): Map<string, any> {
    return new Map(this.kvStore);
  }

  getArtifacts(): Map<string, any> {
    return new Map(this.artifacts);
  }

  getSentEvents(): any[] {
    return [...this.sentEvents];
  }

  clear(): void {
    this.kvStore.clear();
    this.artifacts.clear();
    this.sentEvents = [];
  }
}

class MockHTTPClient {
  private responses = new Map<string, any>();

  setResponse(url: string, response: any): void {
    this.responses.set(url, response);
  }

  async get(url: string, options?: any): Promise<any> {
    const response = this.responses.get(url);
    if (!response) {
      throw new Error(`No mock response configured for URL: ${url}`);
    }

    return {
      status: 200,
      statusText: 'OK',
      data: response,
      headers: { 'content-type': 'application/json' }
    };
  }

  async post(url: string, data: any, options?: any): Promise<any> {
    return this.get(url, options);
  }

  async put(url: string, data: any, options?: any): Promise<any> {
    return this.get(url, options);
  }

  async delete(url: string, options?: any): Promise<any> {
    return this.get(url, options);
  }

  clear(): void {
    this.responses.clear();
  }
}

// Mock Logger and EventEmitter
class MockLogger implements Logger {
  private logs: Array<{ level: string; message: string; data?: any }> = [];

  debug(message: string, ...data: any[]): void {
    this.logs.push({ level: 'debug', message, data });
  }

  info(message: string, ...data: any[]): void {
    this.logs.push({ level: 'info', message, data });
  }

  warn(message: string, ...data: any[]): void {
    this.logs.push({ level: 'warn', message, data });
  }

  error(message: string, ...data: any[]): void {
    this.logs.push({ level: 'error', message, data });
  }

  getLogs(): Array<{ level: string; message: string; data?: any }> {
    return [...this.logs];
  }

  clear(): void {
    this.logs = [];
  }
}

class MockEventEmitter implements EventEmitter {
  private events: Array<{ event: string; data: any; timestamp: string }> = [];

  emit(event: string, data: any): void {
    this.events.push({
      event,
      data,
      timestamp: new Date().toISOString()
    });
  }

  on(event: string, handler: Function): void {
    // For testing, we don't need to maintain handlers
  }

  off(event: string, handler: Function): void {
    // For testing, we don't need to maintain handlers
  }

  getEvents(): Array<{ event: string; data: any; timestamp: string }> {
    return [...this.events];
  }

  clear(): void {
    this.events = [];
  }
}

describe('End-to-End Workflow Execution', () => {
  let mcpClient: MockMCPClient;
  let httpClient: MockHTTPClient;
  let services: ServiceContainer;
  let taskRegistry: TaskRegistry;
  let workflowEngine: ModularWorkflowEngine;
  let logger: MockLogger;
  let eventEmitter: MockEventEmitter;

  const TEST_USER_ID = 'e2e-test-user';

  beforeEach(() => {
    mcpClient = new MockMCPClient();
    httpClient = new MockHTTPClient();
    logger = new MockLogger();
    eventEmitter = new MockEventEmitter();

    services = createServiceContainer({
      mcpClient,
      httpClient,
      userId: TEST_USER_ID
    });

    taskRegistry = new TaskRegistry();
    registerAllTasks(taskRegistry, {
      googleAnalytics: services.googleAnalytics,
      trello: services.trello,
      mcp: services.mcp,
      http: services.http,
      logger
    });

    workflowEngine = new ModularWorkflowEngine(taskRegistry, logger, eventEmitter);
  });

  afterEach(() => {
    mcpClient.clear();
    httpClient.clear();
    logger.clear();
    eventEmitter.clear();
  });

  describe('simple linear workflows', () => {
    it('should execute a basic analytics reporting workflow', async () => {
      const workflow: WorkflowDefinition = {
        version: '1.0',
        created: '2024-01-01T00:00:00Z',
        name: 'Basic Analytics Report',
        description: 'Get top pages and store summary',
        nodes: [
          {
            id: 'start',
            type: 'trigger',
            x: 0,
            y: 0,
            inputs: [],
            outputs: ['out']
          },
          {
            id: 'get-pages',
            type: 'ga-top-pages',
            x: 100,
            y: 0,
            inputs: ['in'],
            outputs: ['out'],
            config: {
              propertyId: '123456789',
              days: 7,
              maxResults: 5
            }
          },
          {
            id: 'store-summary',
            type: 'kv-set',
            x: 200,
            y: 0,
            inputs: ['in'],
            outputs: ['out'],
            config: {
              key: 'weekly-summary',
              useContextData: true,
              contextKey: 'topPages'
            }
          },
          {
            id: 'send-event',
            type: 'events-send',
            x: 300,
            y: 0,
            inputs: ['in'],
            outputs: ['out'],
            config: {
              detailType: 'Analytics Report Generated',
              detail: {
                reportType: 'weekly-summary',
                timestamp: new Date().toISOString(),
                pageCount: 5
              }
            }
          }
        ],
        connections: [
          { from: 'start', to: 'get-pages', fromOutput: 'out', toInput: 'in' },
          { from: 'get-pages', to: 'store-summary', fromOutput: 'out', toInput: 'in' },
          { from: 'store-summary', to: 'send-event', fromOutput: 'out', toInput: 'in' }
        ],
        metadata: {}
      };

      const result = await workflowEngine.executeWorkflow(workflow);

      expect(result.status).toBe('completed');
      expect(result.nodesExecuted).toBe(4);
      expect(result.results['get-pages']).toBeDefined();
      expect(result.results['store-summary']).toBeDefined();
      expect(result.results['send-event']).toBeDefined();

      // Verify data was stored in KV
      const storedData = mcpClient.getKVData().get('weekly-summary');
      expect(storedData).toBeDefined();
      expect(Array.isArray(storedData)).toBe(true);
      expect(storedData).toHaveLength(3);

      // Verify event was sent
      const events = mcpClient.getSentEvents();
      expect(events).toHaveLength(1);
      expect(events[0].detailType).toBe('Analytics Report Generated');
    });

    it('should handle HTTP data fetching workflow', async () => {
      httpClient.setResponse('https://api.example.com/config', {
        apiKey: 'test-key-123',
        endpoint: 'https://api.example.com/data',
        settings: { retries: 3, timeout: 5000 }
      });

      httpClient.setResponse('https://api.example.com/data', {
        users: [
          { id: 1, name: 'John Doe', active: true },
          { id: 2, name: 'Jane Smith', active: false }
        ],
        total: 2
      });

      const workflow: WorkflowDefinition = {
        version: '1.0',
        created: '2024-01-01T00:00:00Z',
        name: 'HTTP Data Pipeline',
        description: 'Fetch config, then data, then store results',
        nodes: [
          {
            id: 'start',
            type: 'trigger',
            x: 0,
            y: 0,
            inputs: [],
            outputs: ['out']
          },
          {
            id: 'get-config',
            type: 'http-get',
            x: 100,
            y: 0,
            inputs: ['in'],
            outputs: ['out'],
            config: {
              url: 'https://api.example.com/config'
            }
          },
          {
            id: 'get-data',
            type: 'http-get',
            x: 200,
            y: 0,
            inputs: ['in'],
            outputs: ['out'],
            config: {
              useContextUrl: true,
              contextUrlKey: 'httpResponse.endpoint'
            }
          },
          {
            id: 'store-artifact',
            type: 'artifacts-put',
            x: 300,
            y: 0,
            inputs: ['in'],
            outputs: ['out'],
            config: {
              key: 'api-data.json',
              useContextData: true,
              contextKey: 'httpResponse',
              contentType: 'application/json',
              stringifyJSON: true
            }
          }
        ],
        connections: [
          { from: 'start', to: 'get-config', fromOutput: 'out', toInput: 'in' },
          { from: 'get-config', to: 'get-data', fromOutput: 'out', toInput: 'in' },
          { from: 'get-data', to: 'store-artifact', fromOutput: 'out', toInput: 'in' }
        ],
        metadata: {}
      };

      const result = await workflowEngine.executeWorkflow(workflow);

      expect(result.status).toBe('completed');
      expect(result.nodesExecuted).toBe(4);

      // Verify artifact was stored
      const artifacts = mcpClient.getArtifacts();
      expect(artifacts.has('api-data.json')).toBe(true);
      
      const storedData = JSON.parse(artifacts.get('api-data.json'));
      expect(storedData.users).toHaveLength(2);
      expect(storedData.total).toBe(2);
    });
  });

  describe('parallel and branching workflows', () => {
    it('should execute parallel analytics branches', async () => {
      const workflow: WorkflowDefinition = {
        version: '1.0',
        created: '2024-01-01T00:00:00Z',
        name: 'Parallel Analytics Processing',
        description: 'Process GA data in parallel branches',
        nodes: [
          { id: 'start', type: 'trigger', x: 0, y: 100, inputs: [], outputs: ['out'] },
          
          // Top branch - Top Pages
          { 
            id: 'ga-pages', 
            type: 'ga-top-pages', 
            x: 100, 
            y: 50, 
            inputs: ['in'], 
            outputs: ['out'],
            config: { propertyId: '123456789', days: 30, maxResults: 10 }
          },
          { 
            id: 'store-pages', 
            type: 'kv-set', 
            x: 200, 
            y: 50, 
            inputs: ['in'], 
            outputs: ['out'],
            config: { key: 'top-pages-monthly', useContextData: true, contextKey: 'topPages' }
          },
          
          // Bottom branch - Search Data
          { 
            id: 'ga-search', 
            type: 'ga-search-data', 
            x: 100, 
            y: 150, 
            inputs: ['in'], 
            outputs: ['out'],
            config: { siteUrl: 'https://example.com', days: 30, maxResults: 25 }
          },
          { 
            id: 'store-search', 
            type: 'kv-set', 
            x: 200, 
            y: 150, 
            inputs: ['in'], 
            outputs: ['out'],
            config: { key: 'search-queries-monthly', useContextData: true, contextKey: 'searchQueries' }
          },
          
          // Convergence - Combined Report
          { 
            id: 'create-report', 
            type: 'artifacts-put', 
            x: 300, 
            y: 100, 
            inputs: ['pages', 'search'], 
            outputs: ['out'],
            config: {
              key: 'monthly-analytics-report.json',
              content: {
                reportDate: new Date().toISOString(),
                topPages: '{{topPages}}',
                searchQueries: '{{searchQueries}}',
                summary: 'Monthly analytics compilation'
              },
              stringifyJSON: true
            }
          }
        ],
        connections: [
          { from: 'start', to: 'ga-pages', fromOutput: 'out', toInput: 'in' },
          { from: 'start', to: 'ga-search', fromOutput: 'out', toInput: 'in' },
          { from: 'ga-pages', to: 'store-pages', fromOutput: 'out', toInput: 'in' },
          { from: 'ga-search', to: 'store-search', fromOutput: 'out', toInput: 'in' },
          { from: 'store-pages', to: 'create-report', fromOutput: 'out', toInput: 'pages' },
          { from: 'store-search', to: 'create-report', fromOutput: 'out', toInput: 'search' }
        ],
        metadata: {}
      };

      const result = await workflowEngine.executeWorkflow(workflow);

      expect(result.status).toBe('completed');
      expect(result.nodesExecuted).toBe(6);

      // Verify parallel branches executed
      expect(result.results['ga-pages']).toBeDefined();
      expect(result.results['ga-search']).toBeDefined();
      expect(result.results['store-pages']).toBeDefined();
      expect(result.results['store-search']).toBeDefined();
      expect(result.results['create-report']).toBeDefined();

      // Verify KV storage
      const kvData = mcpClient.getKVData();
      expect(kvData.has('top-pages-monthly')).toBe(true);
      expect(kvData.has('search-queries-monthly')).toBe(true);

      // Verify artifact creation
      const artifacts = mcpClient.getArtifacts();
      expect(artifacts.has('monthly-analytics-report.json')).toBe(true);
    });

    it('should handle complex conditional workflows', async () => {
      // Set up HTTP responses for different conditions
      httpClient.setResponse('https://api.example.com/status', { 
        maintenance: false, 
        version: '2.0',
        features: ['analytics', 'reporting']
      });

      const workflow: WorkflowDefinition = {
        version: '1.0',
        created: '2024-01-01T00:00:00Z',
        name: 'Conditional Processing Workflow',
        description: 'Different processing based on system status',
        nodes: [
          { id: 'start', type: 'trigger', x: 0, y: 100, inputs: [], outputs: ['out'] },
          
          // Check system status
          { 
            id: 'check-status', 
            type: 'http-get', 
            x: 100, 
            y: 100, 
            inputs: ['in'], 
            outputs: ['out'],
            config: { url: 'https://api.example.com/status' }
          },
          
          // Store status for reference
          { 
            id: 'store-status', 
            type: 'kv-set', 
            x: 200, 
            y: 100, 
            inputs: ['in'], 
            outputs: ['out'],
            config: { 
              key: 'system-status', 
              useContextData: true, 
              contextKey: 'httpResponse'
            }
          },
          
          // Production processing branch
          { 
            id: 'prod-analytics', 
            type: 'ga-top-pages', 
            x: 300, 
            y: 50, 
            inputs: ['in'], 
            outputs: ['out'],
            config: { propertyId: '123456789', days: 1, maxResults: 20 }
          },
          
          // Maintenance mode branch
          { 
            id: 'maintenance-event', 
            type: 'events-send', 
            x: 300, 
            y: 150, 
            inputs: ['in'], 
            outputs: ['out'],
            config: {
              detailType: 'System Maintenance Mode',
              detail: { message: 'System in maintenance, workflow paused' }
            }
          },
          
          // Final output formatting
          { 
            id: 'format-output', 
            type: 'output', 
            x: 400, 
            y: 100, 
            inputs: ['prod', 'maint'], 
            outputs: ['out'],
            config: { format: 'detailed', includeMetadata: true }
          }
        ],
        connections: [
          { from: 'start', to: 'check-status', fromOutput: 'out', toInput: 'in' },
          { from: 'check-status', to: 'store-status', fromOutput: 'out', toInput: 'in' },
          { from: 'store-status', to: 'prod-analytics', fromOutput: 'out', toInput: 'in' },
          { from: 'store-status', to: 'maintenance-event', fromOutput: 'out', toInput: 'in' },
          { from: 'prod-analytics', to: 'format-output', fromOutput: 'out', toInput: 'prod' },
          { from: 'maintenance-event', to: 'format-output', fromOutput: 'out', toInput: 'maint' }
        ],
        metadata: {}
      };

      const result = await workflowEngine.executeWorkflow(workflow);

      expect(result.status).toBe('completed');
      expect(result.nodesExecuted).toBe(6);

      // Verify system status was stored
      const kvData = mcpClient.getKVData();
      expect(kvData.has('system-status')).toBe(true);
      expect(kvData.get('system-status').maintenance).toBe(false);

      // Verify both branches executed
      expect(result.results['prod-analytics']).toBeDefined();
      expect(result.results['maintenance-event']).toBeDefined();
      expect(result.results['format-output']).toBeDefined();
    });
  });

  describe('data transformation workflows', () => {
    it('should transform and aggregate data across multiple sources', async () => {
      const workflow: WorkflowDefinition = {
        version: '1.0',
        created: '2024-01-01T00:00:00Z',
        name: 'Data Transformation Pipeline',
        description: 'Collect, transform, and aggregate data from multiple sources',
        nodes: [
          { id: 'start', type: 'trigger', x: 0, y: 100, inputs: [], outputs: ['out'] },
          
          // Collect GA data
          { 
            id: 'collect-pages', 
            type: 'ga-top-pages', 
            x: 100, 
            y: 50, 
            inputs: ['in'], 
            outputs: ['out'],
            config: { propertyId: '123456789', days: 7, maxResults: 10 }
          },
          { 
            id: 'collect-search', 
            type: 'ga-search-data', 
            x: 100, 
            y: 150, 
            inputs: ['in'], 
            outputs: ['out'],
            config: { siteUrl: 'https://example.com', days: 7, maxResults: 10 }
          },
          
          // Transform pages data
          { 
            id: 'transform-pages', 
            type: 'json-parse', 
            x: 200, 
            y: 50, 
            inputs: ['in'], 
            outputs: ['out'],
            config: { 
              useContextData: true, 
              contextKey: 'topPages',
              cleanupMode: true 
            }
          },
          
          // Store transformed data
          { 
            id: 'store-pages-json', 
            type: 'artifacts-put', 
            x: 300, 
            y: 50, 
            inputs: ['in'], 
            outputs: ['out'],
            config: {
              key: 'processed/pages-data.json',
              useContextData: true,
              contentType: 'application/json',
              stringifyJSON: true
            }
          },
          
          // Store search data
          { 
            id: 'store-search-json', 
            type: 'artifacts-put', 
            x: 300, 
            y: 150, 
            inputs: ['in'], 
            outputs: ['out'],
            config: {
              key: 'processed/search-data.json',
              useContextData: true,
              contextKey: 'searchQueries',
              contentType: 'application/json',
              stringifyJSON: true
            }
          },
          
          // Aggregate final report
          { 
            id: 'aggregate-report', 
            type: 'artifacts-put', 
            x: 400, 
            y: 100, 
            inputs: ['pages', 'search'], 
            outputs: ['out'],
            config: {
              key: 'reports/weekly-aggregate.json',
              content: {
                reportId: `weekly-${Date.now()}`,
                generatedAt: new Date().toISOString(),
                dataSource: 'google-analytics',
                period: 'weekly',
                metrics: {
                  topPagesCount: '{{topPages.length}}',
                  searchQueriesCount: '{{searchQueries.length}}',
                  totalPageviews: '{{totalPageviews}}',
                  totalClicks: '{{totalClicks}}'
                }
              },
              stringifyJSON: true
            }
          },
          
          // Send completion notification
          { 
            id: 'notify-complete', 
            type: 'events-send', 
            x: 500, 
            y: 100, 
            inputs: ['in'], 
            outputs: ['out'],
            config: {
              detailType: 'Weekly Report Generated',
              useContextData: true,
              contextKey: 'artifactKey'
            }
          }
        ],
        connections: [
          { from: 'start', to: 'collect-pages', fromOutput: 'out', toInput: 'in' },
          { from: 'start', to: 'collect-search', fromOutput: 'out', toInput: 'in' },
          { from: 'collect-pages', to: 'transform-pages', fromOutput: 'out', toInput: 'in' },
          { from: 'transform-pages', to: 'store-pages-json', fromOutput: 'out', toInput: 'in' },
          { from: 'collect-search', to: 'store-search-json', fromOutput: 'out', toInput: 'in' },
          { from: 'store-pages-json', to: 'aggregate-report', fromOutput: 'out', toInput: 'pages' },
          { from: 'store-search-json', to: 'aggregate-report', fromOutput: 'out', toInput: 'search' },
          { from: 'aggregate-report', to: 'notify-complete', fromOutput: 'out', toInput: 'in' }
        ],
        metadata: {}
      };

      const result = await workflowEngine.executeWorkflow(workflow);

      expect(result.status).toBe('completed');
      expect(result.nodesExecuted).toBe(8);

      // Verify all transformations occurred
      expect(result.results['collect-pages']).toBeDefined();
      expect(result.results['collect-search']).toBeDefined();
      expect(result.results['transform-pages']).toBeDefined();
      expect(result.results['store-pages-json']).toBeDefined();
      expect(result.results['store-search-json']).toBeDefined();
      expect(result.results['aggregate-report']).toBeDefined();
      expect(result.results['notify-complete']).toBeDefined();

      // Verify artifacts were created
      const artifacts = mcpClient.getArtifacts();
      expect(artifacts.has('processed/pages-data.json')).toBe(true);
      expect(artifacts.has('processed/search-data.json')).toBe(true);
      expect(artifacts.has('reports/weekly-aggregate.json')).toBe(true);

      // Verify event notification
      const events = mcpClient.getSentEvents();
      expect(events).toHaveLength(1);
      expect(events[0].detailType).toBe('Weekly Report Generated');
    });
  });

  describe('error handling and recovery', () => {
    it('should handle task failures gracefully', async () => {
      // Configure HTTP client to fail on specific URL
      httpClient.setResponse('https://api.example.com/working', { status: 'ok' });
      
      const workflow: WorkflowDefinition = {
        version: '1.0',
        created: '2024-01-01T00:00:00Z',
        name: 'Error Handling Test',
        description: 'Test workflow error handling',
        nodes: [
          { id: 'start', type: 'trigger', x: 0, y: 100, inputs: [], outputs: ['out'] },
          
          // This should work
          { 
            id: 'working-request', 
            type: 'http-get', 
            x: 100, 
            y: 50, 
            inputs: ['in'], 
            outputs: ['out'],
            config: { url: 'https://api.example.com/working' }
          },
          
          // This should fail
          { 
            id: 'failing-request', 
            type: 'http-get', 
            x: 100, 
            y: 150, 
            inputs: ['in'], 
            outputs: ['out'],
            config: { url: 'https://api.example.com/nonexistent' }
          },
          
          // Store success result
          { 
            id: 'store-success', 
            type: 'kv-set', 
            x: 200, 
            y: 50, 
            inputs: ['in'], 
            outputs: ['out'],
            config: { 
              key: 'success-result',
              useContextData: true,
              contextKey: 'httpResponse'
            }
          },
          
          // This should not execute due to failed dependency
          { 
            id: 'store-failure', 
            type: 'kv-set', 
            x: 200, 
            y: 150, 
            inputs: ['in'], 
            outputs: ['out'],
            config: { 
              key: 'failure-result',
              value: 'should not store'
            }
          }
        ],
        connections: [
          { from: 'start', to: 'working-request', fromOutput: 'out', toInput: 'in' },
          { from: 'start', to: 'failing-request', fromOutput: 'out', toInput: 'in' },
          { from: 'working-request', to: 'store-success', fromOutput: 'out', toInput: 'in' },
          { from: 'failing-request', to: 'store-failure', fromOutput: 'out', toInput: 'in' }
        ],
        metadata: {}
      };

      // This should not completely fail - partial execution should be allowed
      await expect(workflowEngine.executeWorkflow(workflow)).rejects.toThrow();

      // Verify logs contain error information
      const logs = logger.getLogs();
      const errorLogs = logs.filter(log => log.level === 'error');
      expect(errorLogs.length).toBeGreaterThan(0);
    });

    it('should timeout long-running workflows', async () => {
      // Create a workflow with a task that would timeout
      const workflow: WorkflowDefinition = {
        version: '1.0',
        created: '2024-01-01T00:00:00Z',
        name: 'Timeout Test',
        description: 'Test workflow timeout',
        nodes: [
          { id: 'start', type: 'trigger', x: 0, y: 0, inputs: [], outputs: ['out'] },
          { 
            id: 'slow-request', 
            type: 'http-get', 
            x: 100, 
            y: 0, 
            inputs: ['in'], 
            outputs: ['out'],
            config: { 
              url: 'https://api.example.com/slow',
              timeout: 1 // Very short timeout
            }
          }
        ],
        connections: [
          { from: 'start', to: 'slow-request', fromOutput: 'out', toInput: 'in' }
        ],
        metadata: {}
      };

      // Should throw timeout error
      await expect(workflowEngine.executeWorkflow(workflow)).rejects.toThrow();
    });
  });

  describe('performance and scalability', () => {
    it('should handle workflows with many nodes efficiently', async () => {
      // Create a workflow with many KV operations
      const nodes = [
        { id: 'start', type: 'trigger', x: 0, y: 0, inputs: [], outputs: ['out'] }
      ];
      const connections = [];

      // Add 50 KV set operations
      for (let i = 0; i < 50; i++) {
        const nodeId = `kv-${i}`;
        nodes.push({
          id: nodeId,
          type: 'kv-set',
          x: (i % 10) * 50,
          y: Math.floor(i / 10) * 50,
          inputs: ['in'],
          outputs: ['out'],
          config: {
            key: `batch-item-${i}`,
            value: { index: i, data: `item-${i}`, timestamp: Date.now() }
          }
        });

        connections.push({
          from: i === 0 ? 'start' : `kv-${i-1}`,
          to: nodeId,
          fromOutput: 'out',
          toInput: 'in'
        });
      }

      const largeWorkflow: WorkflowDefinition = {
        version: '1.0',
        created: '2024-01-01T00:00:00Z',
        name: 'Large Workflow Performance Test',
        description: 'Test performance with many nodes',
        nodes,
        connections,
        metadata: {}
      };

      const start = Date.now();
      const result = await workflowEngine.executeWorkflow(largeWorkflow);
      const duration = Date.now() - start;

      expect(result.status).toBe('completed');
      expect(result.nodesExecuted).toBe(51); // 1 trigger + 50 KV operations
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds

      // Verify all KV items were stored
      const kvData = mcpClient.getKVData();
      expect(kvData.size).toBe(50);
      
      for (let i = 0; i < 50; i++) {
        expect(kvData.has(`batch-item-${i}`)).toBe(true);
      }
    });

    it('should handle concurrent workflow executions', async () => {
      const createSimpleWorkflow = (id: string): WorkflowDefinition => ({
        version: '1.0',
        created: '2024-01-01T00:00:00Z',
        name: `Concurrent Workflow ${id}`,
        description: `Test concurrent execution ${id}`,
        nodes: [
          { id: 'start', type: 'trigger', x: 0, y: 0, inputs: [], outputs: ['out'] },
          { 
            id: 'store-data', 
            type: 'kv-set', 
            x: 100, 
            y: 0, 
            inputs: ['in'], 
            outputs: ['out'],
            config: { key: `concurrent-${id}`, value: { workflowId: id, timestamp: Date.now() } }
          },
          { 
            id: 'send-event', 
            type: 'events-send', 
            x: 200, 
            y: 0, 
            inputs: ['in'], 
            outputs: ['out'],
            config: { 
              detailType: 'Workflow Completed', 
              detail: { workflowId: id } 
            }
          }
        ],
        connections: [
          { from: 'start', to: 'store-data', fromOutput: 'out', toInput: 'in' },
          { from: 'store-data', to: 'send-event', fromOutput: 'out', toInput: 'in' }
        ],
        metadata: {}
      });

      // Create 10 concurrent workflows
      const workflows = Array.from({ length: 10 }, (_, i) => 
        createSimpleWorkflow(`workflow-${i}`)
      );

      const start = Date.now();
      const results = await Promise.all(
        workflows.map(workflow => workflowEngine.executeWorkflow(workflow))
      );
      const duration = Date.now() - start;

      // All workflows should complete successfully
      expect(results).toHaveLength(10);
      results.forEach((result, i) => {
        expect(result.status).toBe('completed');
        expect(result.nodesExecuted).toBe(3);
      });

      // Should complete concurrently (faster than sequential)
      expect(duration).toBeLessThan(5000); // Much faster than 10x single workflow

      // Verify all data was stored correctly
      const kvData = mcpClient.getKVData();
      expect(kvData.size).toBe(10);

      for (let i = 0; i < 10; i++) {
        expect(kvData.has(`concurrent-workflow-${i}`)).toBe(true);
      }

      // Verify all events were sent
      const events = mcpClient.getSentEvents();
      expect(events).toHaveLength(10);
    });
  });

  describe('workflow metadata and monitoring', () => {
    it('should track comprehensive execution metrics', async () => {
      const workflow: WorkflowDefinition = {
        version: '1.0',
        created: '2024-01-01T00:00:00Z',
        name: 'Metrics Tracking Test',
        description: 'Test execution metrics tracking',
        nodes: [
          { id: 'start', type: 'trigger', x: 0, y: 0, inputs: [], outputs: ['out'] },
          { 
            id: 'get-analytics', 
            type: 'ga-top-pages', 
            x: 100, 
            y: 0, 
            inputs: ['in'], 
            outputs: ['out'],
            config: { propertyId: '123456789', days: 1, maxResults: 3 }
          },
          { 
            id: 'store-data', 
            type: 'kv-set', 
            x: 200, 
            y: 0, 
            inputs: ['in'], 
            outputs: ['out'],
            config: { key: 'metrics-test', useContextData: true }
          }
        ],
        connections: [
          { from: 'start', to: 'get-analytics', fromOutput: 'out', toInput: 'in' },
          { from: 'get-analytics', to: 'store-data', fromOutput: 'out', toInput: 'in' }
        ],
        metadata: {
          category: 'Analytics',
          priority: 'high',
          tags: ['testing', 'metrics']
        }
      };

      const result = await workflowEngine.executeWorkflow(workflow);

      // Verify execution metadata
      expect(result.status).toBe('completed');
      expect(result.nodesExecuted).toBe(3);
      expect(result.executionTime).toBeGreaterThan(0);
      expect(result.startTime).toBeDefined();
      expect(result.endTime).toBeDefined();

      // Verify individual node results have timing information
      Object.values(result.results).forEach(nodeResult => {
        expect(nodeResult.timestamp).toBeDefined();
      });

      // Verify events were emitted during execution
      const events = eventEmitter.getEvents();
      const workflowEvents = events.filter(e => 
        e.event.startsWith('workflow.') || e.event.startsWith('node.')
      );
      expect(workflowEvents.length).toBeGreaterThan(0);

      // Verify logs were generated
      const logs = logger.getLogs();
      expect(logs.length).toBeGreaterThan(0);
      expect(logs.some(log => log.message.includes('Starting workflow execution'))).toBe(true);
      expect(logs.some(log => log.message.includes('Workflow execution completed'))).toBe(true);
    });
  });
});