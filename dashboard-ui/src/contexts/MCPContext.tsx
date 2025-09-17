import { createContext, useContext, createSignal, createResource, createMemo, onMount, onCleanup, JSX, Resource } from 'solid-js';

// Types
export interface MCPTool {
  name: string;
  description?: string;
  inputSchema?: any;
}

export interface MCPResponse {
  jsonrpc: string;
  id: number | string;
  result?: any;
  error?: {
    code: number;
    message: string;
  };
}

export interface ServerInfo {
  name: string;
  version: string;
  description?: string;
}

export interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
}

export interface MCPContextValue {
  // Client and connection
  client: () => MCPClient;
  isConnected: () => boolean;
  serverVersion: () => string | undefined;
  availableTools: () => MCPTool[];
  
  // State
  loading: () => boolean;
  error: () => string | null;
  
  // Resources
  serverInfo: Resource<ServerInfo>;
  health: Resource<HealthStatus>;
  tools: Resource<MCPTool[]>;
  
  // Methods
  executeTool: (name: string, args?: Record<string, any>) => Promise<any>;
  
  // Domain-specific APIs
  analytics: {
    getTopPages: (args?: Record<string, any>) => Promise<any>;
    getSearchConsoleData: (args?: Record<string, any>) => Promise<any>;
    analyzeContentOpportunities: (args?: Record<string, any>) => Promise<any>;
    generateContentCalendar: (args?: Record<string, any>) => Promise<any>;
  };
  kvStore: {
    get: (key: string) => Promise<any>;
    set: (key: string, value: any, ttlHours?: number) => Promise<any>;
  };
  artifacts: {
    list: (prefix?: string) => Promise<any>;
    get: (key: string) => Promise<any>;
    put: (key: string, content: string, contentType?: string) => Promise<any>;
  };
  workflows: {
    start: (name: string, input?: Record<string, any>) => Promise<any>;
    getStatus: (executionArn: string) => Promise<any>;
  };
  events: {
    send: (detailType: string, detail: Record<string, any>, source?: string) => Promise<any>;
  };
  agents: {
    processRequest: (userId: string, sessionId: string, request: string, context?: Record<string, any>) => Promise<any>;
    delegateToAgent: (agentType: string, prompt: string, userId: string, sessionId: string, context?: Record<string, any>) => Promise<any>;
    listAvailableAgents: () => Promise<any>;
    getTaskStatus: (taskId: string) => Promise<any>;
  };

  // Utilities
  clearError: () => void;
  refresh: () => void;
}

const MCPContext = createContext<MCPContextValue>();

// MCP API client
export class MCPClient {
  private baseURL: string;

  constructor(baseURL: string = import.meta.env.VITE_MCP_SERVER_URL || 'http://localhost:3002') {
    this.baseURL = baseURL;
  }

  async callTool(name: string, args: Record<string, any> = {}): Promise<any> {
    const response = await fetch(`${this.baseURL}/mcp/call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        arguments: args
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error);
    }

    return data;
  }

  async listTools(): Promise<MCPTool[]> {
    const response = await fetch(`${this.baseURL}/mcp/tools`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data.tools;
  }

  async getServerInfo(): Promise<ServerInfo> {
    const response = await fetch(`${this.baseURL}/health`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const healthData = await response.json();
    return {
      name: healthData.service || 'MCP Server',
      version: healthData.version || '1.0.0',
      description: 'MCP HTTP Bridge'
    };
  }

  async getHealth(): Promise<HealthStatus> {
    const response = await fetch(`${this.baseURL}/health`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = await response.json();
    return {
      status: data.status === 'healthy' ? 'healthy' : 'unhealthy',
      timestamp: data.timestamp
    };
  }
}

interface MCPProviderProps {
  children: JSX.Element;
}

export function MCPProvider(props: MCPProviderProps) {
  const [client] = createSignal(new MCPClient());
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [healthTrigger, setHealthTrigger] = createSignal(0);

  // Server info resource
  const [serverInfo] = createResource(() => client().getServerInfo());
  
  // Health state management with reduced polling frequency
  const [healthData, setHealthData] = createSignal<HealthStatus | null>(null);
  const [toolsData, setToolsData] = createSignal<MCPTool[]>([]);

  // Connection status based on cached health data
  const isConnected = createMemo(() => healthData()?.status === 'healthy');
  const serverVersion = createMemo(() => serverInfo.latest?.version);
  const availableTools = createMemo(() => toolsData());

  // Smart health checking that only updates on status changes
  const checkHealth = async () => {
    try {
      const newHealth = await client().getHealth();
      const currentHealth = healthData();

      // Only update if status actually changed or it's the first check
      if (!currentHealth || currentHealth.status !== newHealth.status) {
        setHealthData(newHealth);

        // Also refresh tools when connection status changes
        if (newHealth.status === 'healthy') {
          try {
            const newTools = await client().listTools();
            setToolsData(newTools);
          } catch (error) {
            console.warn('Failed to fetch tools:', error);
          }
        }
      }
    } catch (error) {
      const currentHealth = healthData();
      const newHealth = { status: 'unhealthy', timestamp: new Date().toISOString() } as HealthStatus;

      // Only update if status changed to unhealthy
      if (!currentHealth || currentHealth.status !== 'unhealthy') {
        console.warn('Health check failed:', error);
        setHealthData(newHealth);
      }
    }
  };

  // Health and tools as resources for compatibility with existing code
  const [health] = createResource(() => healthData());
  const [tools] = createResource(() => toolsData());

  // Set up periodic health checking with longer intervals
  onMount(() => {
    // Initial health check
    checkHealth();

    // Set up periodic health checks every 30 seconds (reduced from 5 seconds)
    const interval = setInterval(checkHealth, 30000);

    onCleanup(() => {
      clearInterval(interval);
    });
  });

  // Tool execution with loading state
  const executeTool = async (name: string, args: Record<string, any> = {}): Promise<any> => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await client().callTool(name, args);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Helper function for safe tool execution
  const executeToolSafely = async (toolName: string, args?: Record<string, any>): Promise<any> => {
    try {
      return await executeTool(toolName, args);
    } catch (error) {
      // Only log errors that aren't expected infrastructure issues
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (!errorMessage.includes('bucket does not exist') &&
          !errorMessage.includes('table does not exist') &&
          !errorMessage.includes('Could not load credentials')) {
        console.error(`Error executing ${toolName}:`, error);
      } else {
        console.warn(`Infrastructure not available for ${toolName}:`, errorMessage);
      }
      return null;
    }
  };

  // Analytics specific methods
  const analytics = {
    getTopPages: (args?: Record<string, any>) => executeToolSafely('ga.getTopPages', args),
    getSearchConsoleData: (args?: Record<string, any>) => executeToolSafely('ga.getSearchConsoleData', args),
    analyzeContentOpportunities: (args?: Record<string, any>) => executeToolSafely('ga.analyzeContentOpportunities', args),
    generateContentCalendar: (args?: Record<string, any>) => executeToolSafely('ga.generateContentCalendar', args),
  };

  // KV Store methods
  const kvStore = {
    get: (key: string) => executeToolSafely('kv.get', { key }),
    set: (key: string, value: any, ttlHours: number = 24) => executeToolSafely('kv.set', { key, value, ttl_hours: ttlHours }),
  };

  // Artifacts methods
  const artifacts = {
    list: (prefix: string = '') => executeToolSafely('artifacts.list', { prefix }),
    get: (key: string) => executeToolSafely('artifacts.get', { key }),
    put: (key: string, content: string, contentType: string = 'text/plain') => executeToolSafely('artifacts.put', { key, content, content_type: contentType }),
  };

  // Workflows methods
  const workflows = {
    start: (name: string, input: Record<string, any> = {}) => executeToolSafely('workflow.start', { name, input }),
    getStatus: (executionArn: string) => executeToolSafely('workflow.status', { executionArn }),
  };

  // Events methods
  const events = {
    send: (detailType: string, detail: Record<string, any>, source: string = 'dashboard') => executeToolSafely('events.send', { detailType, detail, source }),
  };

  // Agent delegation methods
  const agents = {
    processRequest: (userId: string, sessionId: string, request: string, context?: Record<string, any>) =>
      executeToolSafely('agent.processRequest', { userId, sessionId, request, context }),
    delegateToAgent: (agentType: string, prompt: string, userId: string, sessionId: string, context?: Record<string, any>) =>
      executeToolSafely('agent.delegateToAgent', { agentType, prompt, userId, sessionId, context }),
    listAvailableAgents: () => executeToolSafely('agent.listAvailableAgents', {}),
    getTaskStatus: (taskId: string) => executeToolSafely('agent.getTaskStatus', { taskId }),
  };

  const contextValue: MCPContextValue = {
    // Client and connection
    client,
    isConnected,
    serverVersion,
    availableTools,
    
    // State
    loading,
    error,
    
    // Resources
    serverInfo,
    health,
    tools,
    
    // Methods
    executeTool,
    
    // Domain-specific APIs
    analytics,
    kvStore,
    artifacts,
    workflows,
    events,
    agents,
    
    // Utilities
    clearError: () => setError(null),
    refresh: () => {
      try {
        // Trigger manual health check which will also refresh tools
        checkHealth();
        console.log('Manual refresh triggered');
      } catch (error) {
        console.warn('Failed to refresh MCP resources:', error);
      }
    }
  };

  return (
    <MCPContext.Provider value={contextValue}>
      {props.children}
    </MCPContext.Provider>
  );
}

export function useMCP(): MCPContextValue {
  const context = useContext(MCPContext);
  if (!context) {
    throw new Error('useMCP must be used within a MCPProvider');
  }
  return context;
}