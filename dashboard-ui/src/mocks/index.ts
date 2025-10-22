// Centralized mock data for development and testing

export interface MockUser {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

export interface MockOrganization {
  id: string;
  name: string;
  memberCount: number;
  plan: 'free' | 'pro' | 'enterprise';
}

export interface MockWorkflow {
  workflowId: string;
  name: string;
  description?: string;
  contextId: string;
  requiredApps: string[];
  sharedWith: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  definition?: string;
}

export interface MockContext {
  contextId: string;
  contextName: string;
  organizationId: string;
  permissions: string[];
  oauthGrants: string[];
  workflows: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface MockOAuthToken {
  tokenId: string;
  appType: string;
  connectionName: string;
  scopes: string[];
  expiresAt: number;
  createdAt: string;
}

export interface MockMCPTool {
  name: string;
  description: string;
  category: 'data' | 'communication' | 'analytics' | 'storage' | 'ai' | 'automation' | 'integration' | 'utility';
  inputSchema: any;
  outputSchema?: any;
  version?: string;
  provider: string;
  isAvailable: boolean;
  requiredPermissions?: string[];
  examples?: {
    name: string;
    description: string;
    inputExample: any;
  }[];
  documentation?: string;
  tags: string[];
}

export interface MockWorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  author: {
    id: string;
    name: string;
    avatar?: string;
    organizationName?: string;
  };
  stats: {
    starCount: number;
    forkCount: number;
    usageCount: number;
    rating: number;
    reviewCount: number;
  };
  metadata: {
    version: string;
    createdAt: string;
    updatedAt: string;
    lastUsed?: string;
    complexity: 'beginner' | 'intermediate' | 'advanced';
    estimatedTime: string;
    requiredIntegrations: string[];
  };
  preview: {
    thumbnail?: string;
    nodeCount: number;
    connectionCount: number;
    hasScreenshots: boolean;
  };
  isOfficial: boolean;
  isFeatured: boolean;
  context: 'public' | 'organization' | 'user';
}

export interface MockRealtimeEvent {
  id: string;
  timestamp: string;
  detailType: string;
  source: string;
  detail: any;
  priority: 'low' | 'medium' | 'high' | 'critical';
  organizationId: string;
  tags: string[];
}

// Mock Data Generators
export class MockDataGenerator {
  static users: MockUser[] = [
    {
      id: 'demo-user-123',
      name: 'Demo User',
      email: 'demo@example.com',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=demo'
    },
    {
      id: 'john-doe-456',
      name: 'John Doe',
      email: 'john@techcorp.com',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=john'
    },
    {
      id: 'jane-smith-789',
      name: 'Jane Smith',
      email: 'jane@contentcorp.com',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=jane'
    }
  ];

  static organizations: MockOrganization[] = [
    {
      id: 'demo-org-456',
      name: 'Demo Organization',
      memberCount: 12,
      plan: 'pro'
    },
    {
      id: 'techcorp-789',
      name: 'TechCorp',
      memberCount: 45,
      plan: 'enterprise'
    },
    {
      id: 'contentcorp-101',
      name: 'ContentCorp',
      memberCount: 8,
      plan: 'pro'
    }
  ];

  static contexts: MockContext[] = [
    {
      contextId: 'context-default-123',
      contextName: 'Default Context',
      organizationId: 'demo-org-456',
      permissions: ['mcp:*'],
      oauthGrants: ['slack'],
      workflows: ['workflow-slack-automation-456'],
      createdBy: 'demo-user-123',
      createdAt: '2024-01-15T10:00:00Z',
      updatedAt: '2024-03-10T14:30:00Z'
    },
    {
      contextId: 'context-marketing-456',
      contextName: 'Marketing Context',
      organizationId: 'demo-org-456',
      permissions: ['mcp:analytics', 'mcp:content'],
      oauthGrants: ['linkedin', 'twitter'],
      workflows: ['workflow-content-calendar-789'],
      createdBy: 'jane-smith-789',
      createdAt: '2024-02-01T16:20:00Z',
      updatedAt: '2024-03-05T11:45:00Z'
    }
  ];

  static workflows: MockWorkflow[] = [
    {
      workflowId: 'workflow-slack-automation-456',
      name: 'Incident Response Workflow',
      description: 'Automated incident detection, notification, and response coordination',
      contextId: 'context-default-123',
      requiredApps: ['slack', 'monitoring', 'email'],
      sharedWith: [],
      createdBy: 'john-doe-456',
      createdAt: '2024-01-20T09:15:00Z',
      updatedAt: '2024-03-05T11:45:00Z',
      definition: JSON.stringify({
        nodes: [
          { id: 'monitor', type: 'webhook', config: { endpoint: '/incident' } },
          { id: 'alert', type: 'slack-message', config: { channel: '#incidents' } },
          { id: 'escalate', type: 'conditional', config: { severity: 'high' } }
        ],
        connections: [
          { from: 'monitor', to: 'alert' },
          { from: 'alert', to: 'escalate' }
        ]
      })
    },
    {
      workflowId: 'workflow-content-calendar-789',
      name: 'AI Content Generation Pipeline',
      description: 'Generate, review, and publish content using AI with human approval workflow',
      contextId: 'context-marketing-456',
      requiredApps: ['openai', 'slack', 'cms'],
      sharedWith: ['demo-user-123'],
      createdBy: 'jane-smith-789',
      createdAt: '2024-02-01T16:20:00Z',
      updatedAt: '2024-03-10T08:30:00Z',
      definition: JSON.stringify({
        nodes: [
          { id: 'trigger', type: 'schedule', config: { interval: 'daily' } },
          { id: 'generate', type: 'agent-content', config: { model: 'claude-3-sonnet' } },
          { id: 'review', type: 'slack-approval', config: { channel: '#content-review' } },
          { id: 'publish', type: 'cms-publish', config: { site: 'main' } }
        ],
        connections: [
          { from: 'trigger', to: 'generate' },
          { from: 'generate', to: 'review' },
          { from: 'review', to: 'publish' }
        ]
      })
    }
  ];

  static oauthTokens: MockOAuthToken[] = [
    {
      tokenId: 'token-slack-456',
      appType: 'slack',
      connectionName: 'Team Workspace',
      scopes: ['chat:write', 'channels:read'],
      expiresAt: Date.now() + (30 * 24 * 60 * 60 * 1000), // 30 days
      createdAt: '2024-03-05T14:30:00Z'
    }
  ];

  static mcpTools: MockMCPTool[] = [
    {
      name: 'kv_get',
      description: 'Retrieve a value from the key-value store',
      category: 'data',
      inputSchema: {
        type: 'object',
        properties: {
          key: { type: 'string', description: 'The key to retrieve' }
        },
        required: ['key']
      },
      provider: 'KV Store',
      isAvailable: true,
      tags: ['storage', 'database', 'retrieval'],
      examples: [{
        name: 'Get user preference',
        description: 'Retrieve user preferences from storage',
        inputExample: { key: 'user-123-preferences' }
      }]
    },
    {
      name: 'events_send',
      description: 'Send an event to the event bus',
      category: 'communication',
      inputSchema: {
        type: 'object',
        properties: {
          detailType: { type: 'string', description: 'The event type' },
          detail: { type: 'object', description: 'The event details' },
          source: { type: 'string', description: 'The event source' }
        },
        required: ['detailType', 'detail']
      },
      provider: 'Event Bus',
      isAvailable: true,
      tags: ['events', 'messaging', 'integration', 'notification'],
      examples: [{
        name: 'Workflow completion',
        description: 'Send workflow completion event',
        inputExample: {
          detailType: 'WorkflowCompleted',
          detail: { workflowId: 'wf-123', status: 'success' }
        }
      }]
    }
  ];

  static workflowTemplates: MockWorkflowTemplate[] = [
    {
      id: 'slack-incident-response',
      name: 'Incident Response Workflow',
      description: 'Automated incident detection, notification, and response coordination',
      category: 'automation',
      tags: ['incident', 'slack', 'monitoring', 'automation'],
      author: {
        id: 'user-456',
        name: 'DevOps Team',
        organizationName: 'TechCorp'
      },
      stats: {
        starCount: 180,
        forkCount: 65,
        usageCount: 890,
        rating: 4.6,
        reviewCount: 45
      },
      metadata: {
        version: '1.8.2',
        createdAt: '2024-01-20T09:15:00Z',
        updatedAt: '2024-03-05T11:45:00Z',
        complexity: 'intermediate',
        estimatedTime: '15-20 minutes',
        requiredIntegrations: ['slack', 'monitoring', 'email']
      },
      preview: {
        nodeCount: 15,
        connectionCount: 22,
        hasScreenshots: true
      },
      isOfficial: false,
      isFeatured: true,
      context: 'public'
    }
  ];

  static realtimeEvents: MockRealtimeEvent[] = [
    {
      id: 'event-1',
      timestamp: new Date(Date.now() - 30000).toISOString(),
      detailType: 'WorkflowStarted',
      source: 'workflow-engine',
      detail: {
        workflowId: 'workflow-slack-automation-456',
        userId: 'demo-user-123',
        trigger: 'schedule'
      },
      priority: 'medium',
      organizationId: 'demo-org-456',
      tags: ['workflow', 'analytics']
    },
    {
      id: 'event-2',
      timestamp: new Date(Date.now() - 120000).toISOString(),
      detailType: 'MCPToolCalled',
      source: 'mcp-server',
      detail: {
        toolName: 'kv_get',
        userId: 'demo-user-123',
        duration: 1250,
        success: true
      },
      priority: 'low',
      organizationId: 'demo-org-456',
      tags: ['mcp', 'analytics', 'tool-call']
    },
    {
      id: 'event-3',
      timestamp: new Date(Date.now() - 300000).toISOString(),
      detailType: 'UserLogin',
      source: 'auth-service',
      detail: {
        userId: 'john-doe-456',
        method: 'oauth',
        provider: 'google'
      },
      priority: 'low',
      organizationId: 'demo-org-456',
      tags: ['auth', 'login']
    }
  ];

  // Helper methods for testing
  static getRandomUser(): MockUser {
    return this.users[Math.floor(Math.random() * this.users.length)];
  }

  static getRandomOrganization(): MockOrganization {
    return this.organizations[Math.floor(Math.random() * this.organizations.length)];
  }

  static getRandomWorkflow(): MockWorkflow {
    return this.workflows[Math.floor(Math.random() * this.workflows.length)];
  }

  static generateRealtimeEvent(overrides?: Partial<MockRealtimeEvent>): MockRealtimeEvent {
    const baseEvent = {
      id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      detailType: 'TestEvent',
      source: 'test-source',
      detail: { test: true },
      priority: 'low' as const,
      organizationId: 'demo-org-456',
      tags: ['test']
    };

    return { ...baseEvent, ...overrides };
  }

  // Data state management for development
  static isDevelopmentMode(): boolean {
    return import.meta.env.DEV || import.meta.env.VITE_USE_MOCK_DATA === 'true';
  }

  static shouldUseMockData(featureName?: string): boolean {
    if (!this.isDevelopmentMode()) return false;

    // Allow feature-specific mock data control
    if (featureName) {
      const envVar = `VITE_MOCK_${featureName.toUpperCase()}`;
      const featureMock = import.meta.env[envVar];
      if (featureMock !== undefined) {
        return featureMock === 'true';
      }
    }

    return true;
  }
}

// Export commonly used mock data
export const mockUsers = MockDataGenerator.users;
export const mockOrganizations = MockDataGenerator.organizations;
export const mockWorkflows = MockDataGenerator.workflows;
export const mockContexts = MockDataGenerator.contexts;
export const mockOAuthTokens = MockDataGenerator.oauthTokens;
export const mockMCPTools = MockDataGenerator.mcpTools;
export const mockWorkflowTemplates = MockDataGenerator.workflowTemplates;
export const mockRealtimeEvents = MockDataGenerator.realtimeEvents;