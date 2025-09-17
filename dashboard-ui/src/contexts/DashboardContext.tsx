import { createContext, useContext, createSignal, JSX } from 'solid-js';
import {
  MockDataGenerator,
  mockWorkflows,
  mockContexts,
  mockOAuthTokens,
  mockMCPTools
} from '../mocks';

// Types for dashboard server API
export interface WorkflowSummary {
  workflowId: string;
  name: string;
  description?: string;
  contextId: string;
  requiredApps: string[];
  sharedWith: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface MCPContext {
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

export interface OAuthToken {
  tokenId: string;
  appType: string;
  connectionName: string;
  scopes: string[];
  expiresAt: number;
  createdAt: string;
}

export interface DashboardContextValue {
  // Workflow management
  workflows: {
    getAll: () => Promise<WorkflowSummary[]>;
    getByContext: (contextId: string) => Promise<WorkflowSummary[]>;
    create: (workflow: Partial<WorkflowSummary>) => Promise<WorkflowSummary>;
  };

  // Context management
  contexts: {
    getAll: () => Promise<MCPContext[]>;
    getById: (contextId: string) => Promise<MCPContext>;
    create: (context: Partial<MCPContext>) => Promise<MCPContext>;
  };

  // OAuth management
  oauth: {
    getTokens: () => Promise<OAuthToken[]>;
    storeToken: (token: Partial<OAuthToken>) => Promise<OAuthToken>;
  };

  // MCP tool proxy
  mcp: {
    callTool: (name: string, args?: Record<string, any>) => Promise<any>;
    listTools: () => Promise<any[]>;
  };

  // State
  loading: () => boolean;
  error: () => string | null;
  clearError: () => void;
}

const DashboardContext = createContext<DashboardContextValue>();

// Dashboard API client
export class DashboardClient {
  private baseURL: string;
  private defaultHeaders: Record<string, string>;

  constructor(baseURL: string = 'http://localhost:3001') {
    this.baseURL = baseURL;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      'x-user-id': 'demo-user-123', // TODO: Get from auth
      'x-organization-id': 'demo-org-456', // TODO: Get from auth
    };
  }

  private async request(path: string, options: RequestInit = {}): Promise<any> {
    const response = await fetch(`${this.baseURL}${path}`, {
      ...options,
      headers: {
        ...this.defaultHeaders,
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  // Workflow API methods
  async getWorkflows(): Promise<WorkflowSummary[]> {
    // Use mock data in development mode
    if (MockDataGenerator.shouldUseMockData('workflows')) {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 300));
      return mockWorkflows;
    }

    const data = await this.request('/api/workflows');
    return data.workflows || [];
  }

  async getWorkflowsByContext(contextId: string): Promise<WorkflowSummary[]> {
    const data = await this.request(`/api/workflows/${contextId}`);
    return data.workflows || [];
  }

  async createWorkflow(workflow: Partial<WorkflowSummary>): Promise<WorkflowSummary> {
    return this.request('/api/workflows', {
      method: 'POST',
      body: JSON.stringify(workflow),
    });
  }

  // Context API methods
  async getContexts(): Promise<MCPContext[]> {
    // Use mock data in development mode
    if (MockDataGenerator.shouldUseMockData('contexts')) {
      await new Promise(resolve => setTimeout(resolve, 200));
      return mockContexts;
    }

    const data = await this.request('/api/workflows/contexts');
    return data.contexts || [];
  }

  async getContext(contextId: string): Promise<MCPContext> {
    const data = await this.request(`/api/workflows/contexts/${contextId}`);
    return data.context;
  }

  async createContext(context: Partial<MCPContext>): Promise<MCPContext> {
    return this.request('/api/workflows/contexts', {
      method: 'POST',
      body: JSON.stringify(context),
    });
  }

  // OAuth API methods
  async getOAuthTokens(): Promise<OAuthToken[]> {
    const data = await this.request('/api/workflows/oauth');
    return data.tokens || [];
  }

  async storeOAuthToken(token: Partial<OAuthToken>): Promise<OAuthToken> {
    return this.request('/api/workflows/oauth', {
      method: 'POST',
      body: JSON.stringify(token),
    });
  }

  // MCP proxy methods
  async callMCPTool(name: string, args: Record<string, any> = {}): Promise<any> {
    // Use mock responses in development mode
    if (MockDataGenerator.shouldUseMockData('mcp')) {
      await new Promise(resolve => setTimeout(resolve, 500));
      return {
        success: true,
        result: { mock: true, tool: name, args },
        timestamp: new Date().toISOString()
      };
    }

    return this.request('/mcp/call', {
      method: 'POST',
      body: JSON.stringify({ name, arguments: args }),
    });
  }

  async listMCPTools(): Promise<any[]> {
    // Use mock data in development mode
    if (MockDataGenerator.shouldUseMockData('mcp')) {
      await new Promise(resolve => setTimeout(resolve, 150));
      return mockMCPTools;
    }

    const data = await this.request('/mcp/tools');
    return data.tools || [];
  }
}

interface DashboardProviderProps {
  children: JSX.Element;
}

export function DashboardProvider(props: DashboardProviderProps) {
  const [client] = createSignal(new DashboardClient());
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  // Helper function for safe API calls
  const executeCall = async <T extends unknown>(fn: () => Promise<T>): Promise<T> => {
    setLoading(true);
    setError(null);

    try {
      const result = await fn();
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Workflow management
  const workflows = {
    getAll: () => executeCall(() => client().getWorkflows()),
    getByContext: (contextId: string) => executeCall(() => client().getWorkflowsByContext(contextId)),
    create: (workflow: Partial<WorkflowSummary>) => executeCall(() => client().createWorkflow(workflow)),
  };

  // Context management
  const contexts = {
    getAll: () => executeCall(() => client().getContexts()),
    getById: (contextId: string) => executeCall(() => client().getContext(contextId)),
    create: (context: Partial<MCPContext>) => executeCall(() => client().createContext(context)),
  };

  // OAuth management
  const oauth = {
    getTokens: () => executeCall(() => client().getOAuthTokens()),
    storeToken: (token: Partial<OAuthToken>) => executeCall(() => client().storeOAuthToken(token)),
  };

  // MCP tool proxy
  const mcp = {
    callTool: (name: string, args?: Record<string, any>) => executeCall(() => client().callMCPTool(name, args)),
    listTools: () => executeCall(() => client().listMCPTools()),
  };

  const contextValue: DashboardContextValue = {
    workflows,
    contexts,
    oauth,
    mcp,
    loading,
    error,
    clearError: () => setError(null),
  };

  return (
    <DashboardContext.Provider value={contextValue}>
      {props.children}
    </DashboardContext.Provider>
  );
}

export function useDashboard(): DashboardContextValue {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
}