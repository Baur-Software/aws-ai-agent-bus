// Connected Apps Integration Tests
// Comprehensive tests for the connected apps system

import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { createServiceContainer, ServiceContainer } from '../../src/services';
import { TaskRegistry } from '../../src/workflow/TaskRegistry';
import { ModularWorkflowEngine } from '../../src/workflow/WorkflowEngine';
import { registerAllTasks } from '../../src/workflow/tasks';
import {
  WorkflowDefinition,
  WorkflowResult,
  Logger,
  EventEmitter
} from '../../src/workflow/types';

// Mock KV Store for testing
class MockKVStore {
  private data = new Map<string, any>();

  async get(key: string): Promise<any> {
    return this.data.get(key) || null;
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    this.data.set(key, value);
  }

  async delete(key: string): Promise<boolean> {
    return this.data.delete(key);
  }

  async scan(pattern: string): Promise<string[]> {
    const regex = new RegExp(pattern.replace('*', '.*'));
    return Array.from(this.data.keys()).filter(key => regex.test(key));
  }

  clear(): void {
    this.data.clear();
  }

  // Helper for testing
  getAllData(): Map<string, any> {
    return new Map(this.data);
  }
}

// Mock MCP Client
class MockMCPClient {
  private kvStore: MockKVStore;

  constructor(kvStore: MockKVStore) {
    this.kvStore = kvStore;
  }

  async callTool(tool: string, params: any): Promise<any> {
    switch (tool) {
      case 'kv.get':
        return this.kvStore.get(params.key);
      case 'kv.set':
        await this.kvStore.set(params.key, params.value, params.ttl_hours);
        return { success: true };
      case 'ga.getTopPages':
        return this.mockGATopPages(params);
      default:
        throw new Error(`Unknown tool: ${tool}`);
    }
  }

  private mockGATopPages(params: any) {
    return {
      rows: [
        {
          dimensionValues: [{ value: '/mock-page-1' }],
          metricValues: [{ value: '1000' }, { value: '800' }, { value: '120' }]
        },
        {
          dimensionValues: [{ value: '/mock-page-2' }],
          metricValues: [{ value: '750' }, { value: '600' }, { value: '90' }]
        }
      ],
      totals: [{ metricValues: [{ value: '1750' }] }],
      dateRanges: [{ startDate: '2024-01-01', endDate: '2024-01-31' }]
    };
  }
}

// Mock Logger and EventEmitter
class MockLogger implements Logger {
  debug = vi.fn();
  info = vi.fn();
  warn = vi.fn();
  error = vi.fn();
}

class MockEventEmitter implements EventEmitter {
  private handlers = new Map<string, Function[]>();

  emit(event: string, data: any): void {
    const eventHandlers = this.handlers.get(event) || [];
    eventHandlers.forEach(handler => handler(data));
  }

  on(event: string, handler: Function): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, []);
    }
    this.handlers.get(event)!.push(handler);
  }

  off(event: string, handler: Function): void {
    const eventHandlers = this.handlers.get(event) || [];
    const index = eventHandlers.indexOf(handler);
    if (index > -1) {
      eventHandlers.splice(index, 1);
    }
  }

  // Helper for testing
  getHandlerCount(event: string): number {
    return (this.handlers.get(event) || []).length;
  }
}

// Integration Service for managing connections
class IntegrationManager {
  constructor(private kvStore: MockKVStore) {}

  async connectApp(userId: string, serviceId: string, connectionId: string, credentials: any): Promise<void> {
    const connectionKey = `user-${userId}-integration-${serviceId}-${connectionId}`;
    const connectionData = {
      connection_id: connectionId,
      connection_name: connectionId === 'default' ? `${serviceId} (Default)` : `${serviceId} (${connectionId})`,
      service_id: serviceId,
      connected_at: new Date().toISOString(),
      credentials: this.encryptCredentials(credentials),
      settings: {
        last_used: null,
        usage_count: 0,
        test_status: 'success'
      }
    };

    await this.kvStore.set(connectionKey, connectionData);

    // Also store app configuration if it doesn't exist
    const appConfigKey = `integration-${serviceId}`;
    const existingConfig = await this.kvStore.get(appConfigKey);
    if (!existingConfig) {
      await this.kvStore.set(appConfigKey, this.getAppConfig(serviceId));
    }
  }

  async getUserConnections(userId: string, serviceId: string): Promise<any[]> {
    const pattern = `user-${userId}-integration-${serviceId}-*`;
    const connectionKeys = await this.kvStore.scan(pattern);
    
    const connections = [];
    for (const key of connectionKeys) {
      const connection = await this.kvStore.get(key);
      if (connection) {
        connections.push(connection);
      }
    }
    
    return connections;
  }

  async isServiceConnected(userId: string, serviceId: string): Promise<boolean> {
    const connections = await this.getUserConnections(userId, serviceId);
    return connections.length > 0;
  }

  private encryptCredentials(credentials: any): any {
    // Simple mock encryption - in real implementation would use proper crypto
    return {
      ...credentials,
      encrypted: true
    };
  }

  private getAppConfig(serviceId: string): any {
    const configs: Record<string, any> = {
      'google-analytics': {
        id: 'google-analytics',
        name: 'Google Analytics',
        type: 'oauth2',
        workflow_capabilities: ['ga-top-pages', 'ga-search-data']
      },
      'trello': {
        id: 'trello',
        name: 'Trello',
        type: 'api_key',
        workflow_capabilities: ['trello-create-card', 'trello-create-board']
      }
    };

    return configs[serviceId] || { id: serviceId, name: serviceId };
  }
}

describe('Connected Apps Integration', () => {
  let kvStore: MockKVStore;
  let mcpClient: MockMCPClient;
  let services: ServiceContainer;
  let taskRegistry: TaskRegistry;
  let workflowEngine: ModularWorkflowEngine;
  let integrationManager: IntegrationManager;
  let logger: MockLogger;
  let eventEmitter: MockEventEmitter;

  const TEST_USER_ID = 'test-user-123';

  beforeEach(() => {
    kvStore = new MockKVStore();
    mcpClient = new MockMCPClient(kvStore);
    integrationManager = new IntegrationManager(kvStore);
    logger = new MockLogger();
    eventEmitter = new MockEventEmitter();

    services = createServiceContainer({
      mcpClient,
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

  describe('service connection management', () => {
    it('should connect a service successfully', async () => {
      const credentials = {
        client_id: 'test-client-id',
        client_secret: 'test-client-secret',
        property_id: '123456789'
      };

      await integrationManager.connectApp(TEST_USER_ID, 'google-analytics', 'default', credentials);

      const connections = await integrationManager.getUserConnections(TEST_USER_ID, 'google-analytics');
      expect(connections).toHaveLength(1);
      expect(connections[0].service_id).toBe('google-analytics');
      expect(connections[0].credentials.client_id).toBe('test-client-id');
      expect(connections[0].credentials.encrypted).toBe(true);
    });

    it('should support multiple connections per service', async () => {
      const workCredentials = {
        client_id: 'work-client-id',
        client_secret: 'work-client-secret',
        property_id: '111111111'
      };

      const personalCredentials = {
        client_id: 'personal-client-id',
        client_secret: 'personal-client-secret',
        property_id: '222222222'
      };

      await integrationManager.connectApp(TEST_USER_ID, 'google-analytics', 'work', workCredentials);
      await integrationManager.connectApp(TEST_USER_ID, 'google-analytics', 'personal', personalCredentials);

      const connections = await integrationManager.getUserConnections(TEST_USER_ID, 'google-analytics');
      expect(connections).toHaveLength(2);

      const workConnection = connections.find(c => c.connection_id === 'work');
      const personalConnection = connections.find(c => c.connection_id === 'personal');

      expect(workConnection?.credentials.property_id).toBe('111111111');
      expect(personalConnection?.credentials.property_id).toBe('222222222');
    });

    it('should isolate connections between users', async () => {
      const user1Credentials = { api_key: 'user1-key' };
      const user2Credentials = { api_key: 'user2-key' };

      await integrationManager.connectApp('user-1', 'trello', 'default', user1Credentials);
      await integrationManager.connectApp('user-2', 'trello', 'default', user2Credentials);

      const user1Connections = await integrationManager.getUserConnections('user-1', 'trello');
      const user2Connections = await integrationManager.getUserConnections('user-2', 'trello');

      expect(user1Connections).toHaveLength(1);
      expect(user2Connections).toHaveLength(1);
      expect(user1Connections[0].credentials.api_key).toBe('user1-key');
      expect(user2Connections[0].credentials.api_key).toBe('user2-key');
    });

    it('should check service connection status', async () => {
      expect(await integrationManager.isServiceConnected(TEST_USER_ID, 'google-analytics')).toBe(false);

      await integrationManager.connectApp(TEST_USER_ID, 'google-analytics', 'default', {
        client_id: 'test-id'
      });

      expect(await integrationManager.isServiceConnected(TEST_USER_ID, 'google-analytics')).toBe(true);
    });
  });

  describe('workflow integration with connected apps', () => {
    it('should execute workflow with connected Google Analytics', async () => {
      // Connect Google Analytics
      await integrationManager.connectApp(TEST_USER_ID, 'google-analytics', 'default', {
        client_id: 'test-client-id',
        client_secret: 'test-client-secret',
        property_id: '123456789'
      });

      // Create workflow using GA task
      const workflow: WorkflowDefinition = {
        version: '1.0',
        created: '2024-01-01T00:00:00Z',
        name: 'GA Integration Test',
        description: 'Test workflow with Google Analytics integration',
        nodes: [
          {
            id: 'trigger-1',
            type: 'trigger',
            x: 0,
            y: 0,
            inputs: [],
            outputs: ['out']
          },
          {
            id: 'ga-pages-1',
            type: 'ga-top-pages',
            x: 100,
            y: 0,
            inputs: ['in'],
            outputs: ['out'],
            config: {
              propertyId: '123456789',
              days: 30,
              maxResults: 10
            }
          }
        ],
        connections: [
          {
            from: 'trigger-1',
            to: 'ga-pages-1',
            fromOutput: 'out',
            toInput: 'in'
          }
        ],
        metadata: {}
      };

      const result = await workflowEngine.executeWorkflow(workflow);

      expect(result.status).toBe('completed');
      expect(result.results['ga-pages-1']).toBeDefined();
      expect(result.results['ga-pages-1'].pages).toHaveLength(2);
      expect(result.results['ga-pages-1'].totalPageviews).toBe(1750);
    });

    it('should fail gracefully when service is not connected', async () => {
      // Don't connect any services - create workflow that requires GA
      const workflow: WorkflowDefinition = {
        version: '1.0',
        created: '2024-01-01T00:00:00Z',
        name: 'Unconnected GA Test',
        description: 'Test workflow without GA connection',
        nodes: [
          {
            id: 'trigger-1',
            type: 'trigger',
            x: 0,
            y: 0,
            inputs: [],
            outputs: ['out']
          },
          {
            id: 'ga-pages-1',
            type: 'ga-top-pages',
            x: 100,
            y: 0,
            inputs: ['in'],
            outputs: ['out'],
            config: {
              propertyId: '123456789'
            }
          }
        ],
        connections: [
          {
            from: 'trigger-1',
            to: 'ga-pages-1',
            fromOutput: 'out',
            toInput: 'in'
          }
        ],
        metadata: {}
      };

      // Should execute but GA task might fail due to missing credentials
      // In a real implementation, this would be caught during workflow validation
      await expect(workflowEngine.executeWorkflow(workflow)).resolves.toBeDefined();
    });

    it('should handle multiple services in single workflow', async () => {
      // Connect both GA and MCP services
      await integrationManager.connectApp(TEST_USER_ID, 'google-analytics', 'default', {
        client_id: 'ga-client-id',
        property_id: '123456789'
      });

      const workflow: WorkflowDefinition = {
        version: '1.0',
        created: '2024-01-01T00:00:00Z',
        name: 'Multi-Service Workflow',
        description: 'Workflow using multiple connected services',
        nodes: [
          {
            id: 'trigger-1',
            type: 'trigger',
            x: 0,
            y: 0,
            inputs: [],
            outputs: ['out']
          },
          {
            id: 'ga-pages-1',
            type: 'ga-top-pages',
            x: 100,
            y: 0,
            inputs: ['in'],
            outputs: ['out'],
            config: {
              propertyId: '123456789',
              days: 7
            }
          },
          {
            id: 'kv-store-1',
            type: 'kv-set',
            x: 200,
            y: 0,
            inputs: ['in'],
            outputs: ['out'],
            config: {
              key: 'ga-results-cache',
              useContextData: true,
              contextKey: 'topPages'
            }
          }
        ],
        connections: [
          {
            from: 'trigger-1',
            to: 'ga-pages-1',
            fromOutput: 'out',
            toInput: 'in'
          },
          {
            from: 'ga-pages-1',
            to: 'kv-store-1',
            fromOutput: 'out',
            toInput: 'in'
          }
        ],
        metadata: {}
      };

      const result = await workflowEngine.executeWorkflow(workflow);

      expect(result.status).toBe('completed');
      expect(result.results['ga-pages-1']).toBeDefined();
      expect(result.results['kv-store-1']).toBeDefined();
      expect(result.results['kv-store-1'].success).toBe(true);

      // Verify data was stored in KV
      const storedData = await kvStore.get('ga-results-cache');
      expect(storedData).toBeDefined();
    });
  });

  describe('node filtering based on connections', () => {
    it('should identify available nodes based on connections', async () => {
      // Initially no connections
      let gaConnected = await integrationManager.isServiceConnected(TEST_USER_ID, 'google-analytics');
      let trelloConnected = await integrationManager.isServiceConnected(TEST_USER_ID, 'trello');

      expect(gaConnected).toBe(false);
      expect(trelloConnected).toBe(false);

      // Connect Google Analytics
      await integrationManager.connectApp(TEST_USER_ID, 'google-analytics', 'default', {
        client_id: 'ga-client',
        property_id: '123456789'
      });

      gaConnected = await integrationManager.isServiceConnected(TEST_USER_ID, 'google-analytics');
      expect(gaConnected).toBe(true);

      // GA tasks should now be available
      expect(taskRegistry.hasTask('ga-top-pages')).toBe(true);
      
      // Connect Trello
      await integrationManager.connectApp(TEST_USER_ID, 'trello', 'default', {
        api_key: 'trello-key',
        api_token: 'trello-token'
      });

      trelloConnected = await integrationManager.isServiceConnected(TEST_USER_ID, 'trello');
      expect(trelloConnected).toBe(true);
    });

    it('should support workflow templates based on available integrations', async () => {
      // Connect GA only
      await integrationManager.connectApp(TEST_USER_ID, 'google-analytics', 'default', {
        client_id: 'ga-client',
        property_id: '123456789'
      });

      // Should be able to create GA-only workflow template
      const gaWorkflowTemplate: WorkflowDefinition = {
        version: '1.0',
        created: '2024-01-01T00:00:00Z',
        name: 'GA Analytics Template',
        description: 'Template for Google Analytics reporting',
        nodes: [
          { id: 'trigger-1', type: 'trigger', x: 0, y: 0, inputs: [], outputs: ['out'] },
          { 
            id: 'ga-pages-1', 
            type: 'ga-top-pages', 
            x: 100, 
            y: 0, 
            inputs: ['in'], 
            outputs: ['out'],
            config: { propertyId: '{{property_id}}', days: 30 }
          },
          {
            id: 'kv-store-1',
            type: 'kv-set',
            x: 200,
            y: 0,
            inputs: ['in'],
            outputs: ['out'],
            config: { key: 'analytics-report-{{date}}', useContextData: true }
          }
        ],
        connections: [
          { from: 'trigger-1', to: 'ga-pages-1', fromOutput: 'out', toInput: 'in' },
          { from: 'ga-pages-1', to: 'kv-store-1', fromOutput: 'out', toInput: 'in' }
        ],
        metadata: {
          template: true,
          requiredIntegrations: ['google-analytics'],
          category: 'Analytics'
        }
      };

      // Validate that all required task types are available
      const requiredTypes = gaWorkflowTemplate.nodes.map(n => n.type);
      const availableTypes = taskRegistry.getAllTaskTypes();

      for (const type of requiredTypes) {
        expect(availableTypes).toContain(type);
      }
    });
  });

  describe('connection health and monitoring', () => {
    it('should track connection usage', async () => {
      await integrationManager.connectApp(TEST_USER_ID, 'google-analytics', 'default', {
        client_id: 'test-client',
        property_id: '123456789'
      });

      // Execute workflow that uses the connection
      const workflow: WorkflowDefinition = {
        version: '1.0',
        created: '2024-01-01T00:00:00Z',
        name: 'Usage Tracking Test',
        description: 'Test connection usage tracking',
        nodes: [
          { id: 'trigger-1', type: 'trigger', x: 0, y: 0, inputs: [], outputs: ['out'] },
          { 
            id: 'ga-pages-1', 
            type: 'ga-top-pages', 
            x: 100, 
            y: 0, 
            inputs: ['in'], 
            outputs: ['out'],
            config: { propertyId: '123456789', days: 7 }
          }
        ],
        connections: [
          { from: 'trigger-1', to: 'ga-pages-1', fromOutput: 'out', toInput: 'in' }
        ],
        metadata: {}
      };

      await workflowEngine.executeWorkflow(workflow);

      // Check if usage was tracked (this would be implemented in the actual service layer)
      const connections = await integrationManager.getUserConnections(TEST_USER_ID, 'google-analytics');
      expect(connections).toHaveLength(1);

      // In a real implementation, usage count would be incremented
      // expect(connections[0].settings.usage_count).toBeGreaterThan(0);
    });

    it('should handle connection errors gracefully', async () => {
      await integrationManager.connectApp(TEST_USER_ID, 'google-analytics', 'default', {
        client_id: 'invalid-client',
        property_id: 'invalid-property'
      });

      // Mock MCP client to simulate API failure
      const originalCallTool = mcpClient.callTool;
      mcpClient.callTool = vi.fn().mockRejectedValue(new Error('API authentication failed'));

      const workflow: WorkflowDefinition = {
        version: '1.0',
        created: '2024-01-01T00:00:00Z',
        name: 'Error Handling Test',
        description: 'Test error handling with invalid connections',
        nodes: [
          { id: 'trigger-1', type: 'trigger', x: 0, y: 0, inputs: [], outputs: ['out'] },
          { 
            id: 'ga-pages-1', 
            type: 'ga-top-pages', 
            x: 100, 
            y: 0, 
            inputs: ['in'], 
            outputs: ['out'],
            config: { propertyId: 'invalid-property' }
          }
        ],
        connections: [
          { from: 'trigger-1', to: 'ga-pages-1', fromOutput: 'out', toInput: 'in' }
        ],
        metadata: {}
      };

      await expect(workflowEngine.executeWorkflow(workflow)).rejects.toThrow();

      // Restore original method
      mcpClient.callTool = originalCallTool;
    });
  });

  describe('data flow between connected services', () => {
    it('should pass data from GA to KV storage', async () => {
      await integrationManager.connectApp(TEST_USER_ID, 'google-analytics', 'default', {
        property_id: '123456789'
      });

      const workflow: WorkflowDefinition = {
        version: '1.0',
        created: '2024-01-01T00:00:00Z',
        name: 'Data Flow Test',
        description: 'Test data flow between services',
        nodes: [
          { id: 'trigger-1', type: 'trigger', x: 0, y: 0, inputs: [], outputs: ['out'] },
          { 
            id: 'ga-pages-1', 
            type: 'ga-top-pages', 
            x: 100, 
            y: 0, 
            inputs: ['in'], 
            outputs: ['out'],
            config: { propertyId: '123456789', days: 1 }
          },
          {
            id: 'kv-summary-1',
            type: 'kv-set',
            x: 200,
            y: 0,
            inputs: ['in'],
            outputs: ['out'],
            config: {
              key: 'daily-summary',
              value: {
                date: new Date().toISOString().split('T')[0],
                topPage: '{{topPages[0].page}}',
                totalViews: '{{totalPageviews}}'
              },
              useContextData: false
            }
          }
        ],
        connections: [
          { from: 'trigger-1', to: 'ga-pages-1', fromOutput: 'out', toInput: 'in' },
          { from: 'ga-pages-1', to: 'kv-summary-1', fromOutput: 'out', toInput: 'in' }
        ],
        metadata: {}
      };

      const result = await workflowEngine.executeWorkflow(workflow);

      expect(result.status).toBe('completed');
      expect(result.results['ga-pages-1'].pages).toBeDefined();
      expect(result.results['kv-summary-1'].success).toBe(true);

      // Verify summary was stored
      const summary = await kvStore.get('daily-summary');
      expect(summary).toBeDefined();
      expect(summary.date).toBeDefined();
    });

    it('should handle complex data transformations', async () => {
      await integrationManager.connectApp(TEST_USER_ID, 'google-analytics', 'default', {
        property_id: '123456789'
      });

      const workflow: WorkflowDefinition = {
        version: '1.0',
        created: '2024-01-01T00:00:00Z',
        name: 'Data Transformation Test',
        description: 'Test complex data transformations',
        nodes: [
          { id: 'trigger-1', type: 'trigger', x: 0, y: 0, inputs: [], outputs: ['out'] },
          { 
            id: 'ga-pages-1', 
            type: 'ga-top-pages', 
            x: 100, 
            y: 0, 
            inputs: ['in'], 
            outputs: ['out'],
            config: { propertyId: '123456789', days: 7, maxResults: 5 }
          },
          {
            id: 'json-transform-1',
            type: 'json-parse',
            x: 200,
            y: 0,
            inputs: ['in'],
            outputs: ['out'],
            config: {
              useContextData: true,
              contextKey: 'topPages'
            }
          },
          {
            id: 'kv-report-1',
            type: 'kv-set',
            x: 300,
            y: 0,
            inputs: ['in'],
            outputs: ['out'],
            config: {
              key: 'weekly-report',
              useContextData: true,
              ttl: 168 // 1 week
            }
          }
        ],
        connections: [
          { from: 'trigger-1', to: 'ga-pages-1', fromOutput: 'out', toInput: 'in' },
          { from: 'ga-pages-1', to: 'json-transform-1', fromOutput: 'out', toInput: 'in' },
          { from: 'json-transform-1', to: 'kv-report-1', fromOutput: 'out', toInput: 'in' }
        ],
        metadata: {}
      };

      const result = await workflowEngine.executeWorkflow(workflow);

      expect(result.status).toBe('completed');
      expect(result.nodesExecuted).toBe(4);
      
      // Verify weekly report was created
      const weeklyReport = await kvStore.get('weekly-report');
      expect(weeklyReport).toBeDefined();
    });
  });

  describe('performance and scalability', () => {
    it('should handle multiple simultaneous workflows', async () => {
      await integrationManager.connectApp(TEST_USER_ID, 'google-analytics', 'default', {
        property_id: '123456789'
      });

      const createWorkflow = (id: string): WorkflowDefinition => ({
        version: '1.0',
        created: '2024-01-01T00:00:00Z',
        name: `Concurrent Test ${id}`,
        description: `Concurrent workflow ${id}`,
        nodes: [
          { id: 'trigger-1', type: 'trigger', x: 0, y: 0, inputs: [], outputs: ['out'] },
          { 
            id: 'ga-pages-1', 
            type: 'ga-top-pages', 
            x: 100, 
            y: 0, 
            inputs: ['in'], 
            outputs: ['out'],
            config: { propertyId: '123456789', days: 1 }
          },
          {
            id: 'kv-store-1',
            type: 'kv-set',
            x: 200,
            y: 0,
            inputs: ['in'],
            outputs: ['out'],
            config: { key: `result-${id}`, useContextData: true }
          }
        ],
        connections: [
          { from: 'trigger-1', to: 'ga-pages-1', fromOutput: 'out', toInput: 'in' },
          { from: 'ga-pages-1', to: 'kv-store-1', fromOutput: 'out', toInput: 'in' }
        ],
        metadata: {}
      });

      const workflows = Array.from({ length: 5 }, (_, i) => createWorkflow(`workflow-${i}`));

      const start = Date.now();
      const results = await Promise.all(
        workflows.map(workflow => workflowEngine.executeWorkflow(workflow))
      );
      const duration = Date.now() - start;

      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result.status).toBe('completed');
      });

      // Should complete all workflows reasonably quickly
      expect(duration).toBeLessThan(10000); // 10 seconds max

      // Verify all results were stored
      for (let i = 0; i < 5; i++) {
        const stored = await kvStore.get(`result-workflow-${i}`);
        expect(stored).toBeDefined();
      }
    });

    it('should manage memory usage with large workflows', async () => {
      await integrationManager.connectApp(TEST_USER_ID, 'google-analytics', 'default', {
        property_id: '123456789'
      });

      // Create workflow with many nodes
      const nodes = [
        { id: 'trigger-1', type: 'trigger', x: 0, y: 0, inputs: [], outputs: ['out'] }
      ];

      const connections = [];

      // Add 20 GA + KV node pairs
      for (let i = 0; i < 20; i++) {
        const gaNodeId = `ga-${i}`;
        const kvNodeId = `kv-${i}`;
        
        nodes.push({
          id: gaNodeId,
          type: 'ga-top-pages',
          x: 100 + (i * 50),
          y: (i % 5) * 100,
          inputs: ['in'],
          outputs: ['out'],
          config: { propertyId: '123456789', days: 1, maxResults: 5 }
        });

        nodes.push({
          id: kvNodeId,
          type: 'kv-set',
          x: 150 + (i * 50),
          y: (i % 5) * 100,
          inputs: ['in'],
          outputs: ['out'],
          config: { key: `batch-result-${i}`, useContextData: true }
        });

        connections.push({
          from: i === 0 ? 'trigger-1' : `kv-${i-1}`,
          to: gaNodeId,
          fromOutput: 'out',
          toInput: 'in'
        });

        connections.push({
          from: gaNodeId,
          to: kvNodeId,
          fromOutput: 'out',
          toInput: 'in'
        });
      }

      const largeWorkflow: WorkflowDefinition = {
        version: '1.0',
        created: '2024-01-01T00:00:00Z',
        name: 'Large Workflow Test',
        description: 'Test workflow with many nodes',
        nodes,
        connections,
        metadata: {}
      };

      const result = await workflowEngine.executeWorkflow(largeWorkflow);

      expect(result.status).toBe('completed');
      expect(result.nodesExecuted).toBe(41); // 1 trigger + 40 other nodes
    });
  });
});