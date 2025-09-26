import { createContext, useContext, createSignal, createEffect, onMount, onCleanup, JSX, ParentComponent } from 'solid-js';
import { useAuth } from './AuthContext';

interface DashboardServerContextValue {
  // Connection state
  isConnected: () => boolean;
  connectionStatus: () => 'connecting' | 'connected' | 'disconnected' | 'error';

  // Authentication
  authenticate: (userId?: string) => Promise<void>;
  logout: () => void;

  // Organizations
  switchOrganization: (orgId: string) => Promise<boolean>;
  createOrganization: (name: string, description?: string) => Promise<any>;

  // Real-time updates
  subscribeToEvents: (eventTypes: string[]) => void;

  // Raw WebSocket access for custom messages
  sendMessage: (message: any) => void;

  // MCP tool calls with promise-based responses
  callMCPTool: (tool: string, params?: any) => Promise<any>;
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

  // Event handlers
  onOrganizationSwitched: (callback: (data: any) => void) => () => void;
  onMetricsUpdate: (callback: (data: any) => void) => () => void;
  onActivityUpdate: (callback: (data: any) => void) => () => void;

  // State and utilities
  loading: () => boolean;
  error: () => string | null;
  clearError: () => void;
  refresh: () => void;
}

interface DashboardServerProviderProps {
  children: JSX.Element;
  serverUrl?: string;
  userId?: string;
}

const DashboardServerContext = createContext<DashboardServerContextValue>();

export const DashboardServerProvider: ParentComponent<DashboardServerProviderProps> = (props) => {
  const { user, isAuthenticated } = useAuth();
  const serverUrl = () => props.serverUrl || 'ws://localhost:3001';
  const userId = () => user()?.userId || 'anonymous';

  const [ws, setWs] = createSignal<WebSocket | null>(null);
  const [isConnected, setIsConnected] = createSignal(false);
  const [connectionStatus, setConnectionStatus] = createSignal<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  // Event listeners
  const [orgSwitchCallbacks, setOrgSwitchCallbacks] = createSignal<((data: any) => void)[]>([]);
  const [metricsUpdateCallbacks, setMetricsUpdateCallbacks] = createSignal<((data: any) => void)[]>([]);
  const [activityUpdateCallbacks, setActivityUpdateCallbacks] = createSignal<((data: any) => void)[]>([]);

  // MCP response handlers
  const pendingRequests = new Map<string, { resolve: (value: any) => void; reject: (error: any) => void; timeout: number }>();

  let reconnectTimer: number | null = null;
  let reconnectAttempts = 0;
  const maxReconnectAttempts = 5;

  const connect = () => {
    if (ws() && ws()!.readyState !== WebSocket.CLOSED) {
      return;
    }

    setConnectionStatus('connecting');
    console.log('🔌 Connecting to dashboard server:', serverUrl());

    try {
      const websocket = new WebSocket(`${serverUrl()}?userId=${userId()}`);

      websocket.onopen = () => {
        console.log('✅ Dashboard server connected');
        setWs(websocket);
        setIsConnected(true);
        setConnectionStatus('connected');
        reconnectAttempts = 0;

        // Send initial authentication
        sendMessage({
          type: 'ping',
          userId: userId(),
          timestamp: new Date().toISOString()
        });

        // Subscribe to default events
        sendMessage({
          type: 'subscribe_events',
          eventTypes: ['metrics_update', 'activity_update', 'organization_switched']
        });
      };

      websocket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          handleMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      websocket.onerror = (error) => {
        console.error('❌ Dashboard server WebSocket error:', error);
        setConnectionStatus('error');
      };

      websocket.onclose = (event) => {
        console.log('📴 Dashboard server connection closed:', event.code, event.reason);
        setWs(null);
        setIsConnected(false);
        setConnectionStatus('disconnected');

        // Attempt to reconnect
        if (reconnectAttempts < maxReconnectAttempts) {
          reconnectAttempts++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
          console.log(`⏳ Reconnecting to dashboard server in ${delay}ms (attempt ${reconnectAttempts}/${maxReconnectAttempts})`);

          reconnectTimer = window.setTimeout(() => {
            connect();
          }, delay);
        } else {
          console.error('❌ Max reconnection attempts reached. Dashboard server connection failed.');
        }
      };

    } catch (error) {
      console.error('❌ Failed to create dashboard server WebSocket connection:', error);
      setConnectionStatus('error');
    }
  };

  const disconnect = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }

    const websocket = ws();
    if (websocket) {
      websocket.close();
      setWs(null);
      setIsConnected(false);
      setConnectionStatus('disconnected');
    }
  };

  const sendMessage = (message: any) => {
    const websocket = ws();
    if (websocket && websocket.readyState === WebSocket.OPEN) {
      websocket.send(JSON.stringify({
        ...message,
        id: message.id || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: userId()
      }));
    } else {
      console.warn('⚠️ Cannot send message: Dashboard server WebSocket not connected');
    }
  };

  const handleMessage = (message: any) => {
    console.log('📨 Dashboard server message:', message.type, message);

    // Handle MCP tool responses first
    if (message.id && pendingRequests.has(message.id)) {
      const request = pendingRequests.get(message.id)!;
      clearTimeout(request.timeout);
      pendingRequests.delete(message.id);

      if (message.error) {
        request.reject(new Error(message.error));
      } else {
        request.resolve(message.result || message);
      }
      return;
    }

    switch (message.type) {
      case 'pong':
        // Keep-alive response
        break;

      case 'organization_switched':
      case 'context_switched':
        // Notify organization switch callbacks
        orgSwitchCallbacks().forEach(callback => {
          try {
            callback(message.data);
          } catch (error) {
            console.error('Error in organization switch callback:', error);
          }
        });
        break;

      case 'metrics_update':
        // Notify metrics update callbacks
        metricsUpdateCallbacks().forEach(callback => {
          try {
            callback(message.data);
          } catch (error) {
            console.error('Error in metrics update callback:', error);
          }
        });
        break;

      case 'activity_update':
        // Notify activity update callbacks
        activityUpdateCallbacks().forEach(callback => {
          try {
            callback(message.data);
          } catch (error) {
            console.error('Error in activity update callback:', error);
          }
        });
        break;

      case 'initial_data':
        // Handle initial data load
        if (message.data.metrics) {
          metricsUpdateCallbacks().forEach(callback => {
            try {
              callback(message.data.metrics);
            } catch (error) {
              console.error('Error in initial metrics callback:', error);
            }
          });
        }
        if (message.data.activity) {
          activityUpdateCallbacks().forEach(callback => {
            try {
              callback(message.data.activity);
            } catch (error) {
              console.error('Error in initial activity callback:', error);
            }
          });
        }
        break;

      default:
        console.log('🔍 Unhandled dashboard server message type:', message.type);
    }
  };

  // API methods
  const authenticate = async (userIdOverride?: string) => {
    // Only connect if user is authenticated
    if (!isAuthenticated()) {
      console.log('🔐 User not authenticated - skipping WebSocket connection');
      return;
    }

    const effectiveUserId = userIdOverride || userId();
    console.log('🔐 Authenticating WebSocket for user:', effectiveUserId);
    connect();
  };

  const logout = () => {
    disconnect();
  };

  const switchOrganization = async (orgId: string): Promise<boolean> => {
    try {
      // Make HTTP request to switch organization
      const response = await fetch(`http://localhost:3001/api/auth/switch-organization`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId()
        },
        body: JSON.stringify({ organizationId: orgId })
      });

      if (response.ok) {
        const result = await response.json();
        return result.success;
      } else {
        console.error('Failed to switch organization:', response.statusText);
        return false;
      }
    } catch (error) {
      console.error('Error switching organization:', error);
      return false;
    }
  };

  const createOrganization = async (name: string, description?: string) => {
    try {
      const response = await fetch(`http://localhost:3001/api/auth/organizations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId()
        },
        body: JSON.stringify({ name, description })
      });

      if (response.ok) {
        return await response.json();
      } else {
        throw new Error(`Failed to create organization: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error creating organization:', error);
      throw error;
    }
  };

  const subscribeToEvents = (eventTypes: string[]) => {
    sendMessage({
      type: 'subscribe_events',
      eventTypes
    });
  };

  const callMCPTool = (tool: string, params: any = {}): Promise<any> => {
    return new Promise((resolve, reject) => {
      const messageId = `mcp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Set up timeout
      const timeout = setTimeout(() => {
        pendingRequests.delete(messageId);
        reject(new Error(`MCP tool call '${tool}' timed out`));
      }, 10000);

      // Store the pending request
      pendingRequests.set(messageId, { resolve, reject, timeout });

      // Send the message
      sendMessage({
        id: messageId,
        type: 'mcp_call',
        tool,
        arguments: params
      });
    });
  };

  // Tool execution with loading state
  const executeTool = async (name: string, args: Record<string, any> = {}): Promise<any> => {
    setLoading(true);
    setError(null);

    try {
      const result = await callMCPTool(name, args);
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
    getTopPages: (args?: Record<string, any>) => executeToolSafely('mcp__aws__ga_getTopPages', args),
    getSearchConsoleData: (args?: Record<string, any>) => executeToolSafely('mcp__aws__ga_getSearchConsoleData', args),
    analyzeContentOpportunities: (args?: Record<string, any>) => executeToolSafely('mcp__aws__ga_analyzeContentOpportunities', args),
    generateContentCalendar: (args?: Record<string, any>) => executeToolSafely('mcp__aws__ga_generateContentCalendar', args),
  };

  // KV Store methods
  const kvStore = {
    get: (key: string) => executeToolSafely('mcp__aws__kv_get', { key }),
    set: (key: string, value: any, ttlHours: number = 24) => executeToolSafely('mcp__aws__kv_set', { key, value, ttl_hours: ttlHours }),
  };

  // Artifacts methods
  const artifacts = {
    list: (prefix: string = '') => executeToolSafely('mcp__aws__artifacts_list', { prefix }),
    get: (key: string) => executeToolSafely('mcp__aws__artifacts_get', { key }),
    put: (key: string, content: string, contentType: string = 'text/plain') => executeToolSafely('mcp__aws__artifacts_put', { key, content, content_type: contentType }),
  };

  // Workflows methods
  const workflows = {
    start: (name: string, input: Record<string, any> = {}) => executeToolSafely('mcp__aws__workflow_start', { name, input }),
    getStatus: (executionArn: string) => executeToolSafely('mcp__aws__workflow_status', { executionArn }),
  };

  // Events methods
  const events = {
    send: (detailType: string, detail: Record<string, any>, source: string = 'dashboard') => executeToolSafely('mcp__aws__events_send', { detailType, detail, source }),
  };

  // Agent delegation methods
  const agents = {
    processRequest: (userId: string, sessionId: string, request: string, context?: Record<string, any>) =>
      executeToolSafely('mcp__aws__agent_processRequest', { userId, sessionId, request, context }),
    delegateToAgent: (agentType: string, prompt: string, userId: string, sessionId: string, context?: Record<string, any>) =>
      executeToolSafely('mcp__aws__agent_delegateToAgent', { agentType, prompt, userId, sessionId, context }),
    listAvailableAgents: () => executeToolSafely('mcp__aws__agent_listAvailableAgents', {}),
    getTaskStatus: (taskId: string) => executeToolSafely('mcp__aws__agent_getTaskStatus', { taskId }),
  };

  // Event subscription methods
  const onOrganizationSwitched = (callback: (data: any) => void) => {
    setOrgSwitchCallbacks(prev => [...prev, callback]);
    return () => {
      setOrgSwitchCallbacks(prev => prev.filter(cb => cb !== callback));
    };
  };

  const onMetricsUpdate = (callback: (data: any) => void) => {
    setMetricsUpdateCallbacks(prev => [...prev, callback]);
    return () => {
      setMetricsUpdateCallbacks(prev => prev.filter(cb => cb !== callback));
    };
  };

  const onActivityUpdate = (callback: (data: any) => void) => {
    setActivityUpdateCallbacks(prev => [...prev, callback]);
    return () => {
      setActivityUpdateCallbacks(prev => prev.filter(cb => cb !== callback));
    };
  };

  // Auto-connect when user authentication state changes
  createEffect(() => {
    if (isAuthenticated() && user()) {
      console.log('🔐 User authenticated - connecting to WebSocket');
      authenticate();
    } else if (!isAuthenticated()) {
      console.log('🔐 User not authenticated - disconnecting WebSocket');
      disconnect();
    }
  });

  // Cleanup on unmount
  onCleanup(() => {
    disconnect();
  });

  // Utility methods
  const clearError = () => setError(null);
  const refresh = () => {
    try {
      // Clear any existing errors and attempt to reconnect
      clearError();
      if (!isConnected()) {
        authenticate();
      }
      console.log('Dashboard server context refresh triggered');
    } catch (error) {
      console.warn('Failed to refresh dashboard server connection:', error);
    }
  };

  const contextValue: DashboardServerContextValue = {
    // Connection state
    isConnected,
    connectionStatus,

    // Authentication
    authenticate,
    logout,

    // Organizations
    switchOrganization,
    createOrganization,

    // Real-time updates
    subscribeToEvents,

    // Raw WebSocket access
    sendMessage,

    // MCP tool calls
    callMCPTool,
    executeTool,

    // Domain-specific APIs
    analytics,
    kvStore,
    artifacts,
    workflows,
    events,
    agents,

    // Event handlers
    onOrganizationSwitched,
    onMetricsUpdate,
    onActivityUpdate,

    // State and utilities
    loading,
    error,
    clearError,
    refresh
  };

  return (
    <DashboardServerContext.Provider value={contextValue}>
      {props.children}
    </DashboardServerContext.Provider>
  );
};

export function useDashboardServer(): DashboardServerContextValue {
  const context = useContext(DashboardServerContext);
  if (!context) {
    throw new Error('useDashboardServer must be used within a DashboardServerProvider');
  }
  return context;
}

export default DashboardServerContext;