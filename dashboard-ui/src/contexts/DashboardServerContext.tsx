import { createContext, useContext, createSignal, createEffect, onMount, onCleanup, JSX, ParentComponent } from 'solid-js';
import { useAuth } from './AuthContext';
import { useNotifications } from './NotificationContext';

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
  sendMessageWithResponse: (message: any) => Promise<any>;

  // MCP tool calls with promise-based responses
  callMCPTool: (tool: string, params?: any) => Promise<any>;
  executeTool: (name: string, args?: Record<string, any>) => Promise<any>;

  // Core MCP APIs (6 tools)
  kvStore: {
    get: (key: string) => Promise<any>;
    set: (key: string, value: any, ttlHours?: number) => Promise<any>;
  };
  artifacts: {
    list: (prefix?: string) => Promise<any>;
    get: (key: string) => Promise<any>;
    put: (key: string, content: string, contentType?: string) => Promise<any>;
  };
  events: {
    send: (detailType: string, detail: Record<string, any>, source?: string) => Promise<any>;
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
  const notifications = useNotifications();
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

  // Error handling helper
  const handleCategorizedError = (error: any, context: string = '') => {
    const category = error.category || 'system_error';
    const message = error.message || 'An unexpected error occurred';
    const shouldRetry = error.shouldRetry || false;

    // Determine notification type based on category
    const notificationTypeMap: Record<string, 'error' | 'warning' | 'info'> = {
      'infrastructure': 'warning',
      'user_error': 'error',
      'authentication': 'warning',
      'business_logic': 'error',
      'external_service': 'warning',
      'system_error': 'error'
    };

    const notificationType = notificationTypeMap[category] || 'error';

    // Show user-friendly notification
    if (notificationType === 'error') {
      notifications.error(message, {
        title: context ? `${context} Error` : 'Error',
        duration: shouldRetry ? 6000 : 8000
      });
    } else if (notificationType === 'warning') {
      notifications.warning(message, {
        title: context ? `${context} Notice` : 'Notice',
        duration: 5000
      });
    } else {
      notifications.info(message, {
        title: context,
        duration: 4000
      });
    }

    // Log for debugging (but don't show infrastructure details to user)
    if (category === 'infrastructure') {
      console.warn(`Infrastructure issue (${category}):`, error);
    } else {
      console.error(`Application error (${category}):`, error);
    }
  };

  let reconnectTimer: number | null = null;
  let reconnectAttempts = 0;
  const maxReconnectAttempts = 5;
  let isConnecting = false; // Prevent multiple simultaneous connection attempts

  const connect = () => {
    if (ws() && ws()!.readyState !== WebSocket.CLOSED) {
      return;
    }

    // Prevent multiple simultaneous connection attempts
    if (isConnecting) {
      console.log('🔄 Connection attempt already in progress, skipping...');
      return;
    }

    isConnecting = true;
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
        isConnecting = false; // Reset connection flag

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
        isConnecting = false; // Reset connection flag on error
      };

      websocket.onclose = (event) => {
        console.log('📴 Dashboard server connection closed:', event.code, event.reason);
        setWs(null);
        setIsConnected(false);
        setConnectionStatus('disconnected');
        isConnecting = false; // Reset connection flag

        // Only attempt to reconnect if we're still authenticated and haven't hit max attempts
        if (isAuthenticated() && reconnectAttempts < maxReconnectAttempts) {
          reconnectAttempts++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
          console.log(`⏳ Reconnecting to dashboard server in ${delay}ms (attempt ${reconnectAttempts}/${maxReconnectAttempts})`);

          reconnectTimer = window.setTimeout(() => {
            // Double-check authentication before reconnecting
            if (isAuthenticated()) {
              connect();
            }
          }, delay);
        } else {
          if (!isAuthenticated()) {
            console.log('🔐 User no longer authenticated - stopping reconnection attempts');
          } else {
            console.error('❌ Max reconnection attempts reached. Dashboard server connection failed.');
          }
        }
      };

    } catch (error) {
      console.error('❌ Failed to create dashboard server WebSocket connection:', error);
      setConnectionStatus('error');
      isConnecting = false; // Reset connection flag on error
    }
  };

  const disconnect = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }

    isConnecting = false; // Reset connection flag
    reconnectAttempts = 0; // Reset reconnection attempts

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

  // Promise-based sendMessage for request/response patterns
  const sendMessageWithResponse = (message: any): Promise<any> => {
    return new Promise((resolve, reject) => {
      const websocket = ws();
      if (!websocket || websocket.readyState !== WebSocket.OPEN) {
        reject(new Error('Dashboard server WebSocket not connected'));
        return;
      }

      const messageId = message.id || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Set up timeout
      const timeout = setTimeout(() => {
        pendingRequests.delete(messageId);
        reject(new Error(`Request '${message.type}' timed out`));
      }, 15000); // 15 second timeout

      // Store the pending request
      pendingRequests.set(messageId, {
        resolve: (response: any) => {
          clearTimeout(timeout);
          resolve(response);
        },
        reject: (error: any) => {
          clearTimeout(timeout);
          reject(error);
        },
        timeout
      });

      // Send the message
      const wsMessage = {
        ...message,
        id: messageId,
        userId: userId()
      };
      console.log('📤 Sending WebSocket message:', wsMessage.type, wsMessage);
      websocket.send(JSON.stringify(wsMessage));
    });
  };

  const handleMessage = (message: any) => {
    // Skip logging if message.type is undefined (likely a raw MCP response)
    if (message.type) {
      console.log('📨 Dashboard server message:', message.type, message);
    }

    // Handle MCP tool responses first
    if (message.id && pendingRequests.has(message.id)) {
      const request = pendingRequests.get(message.id)!;
      clearTimeout(request.timeout);
      pendingRequests.delete(message.id);

      if (message.error) {
        // Check if this is a categorized error
        if (message.error.category) {
          handleCategorizedError(message.error, 'Tool Call');
          const error = new Error(message.error.message);
          (error as any).category = message.error.category;
          (error as any).shouldRetry = message.error.shouldRetry;
          request.reject(error);
        } else {
          // Legacy error handling
          request.reject(new Error(typeof message.error === 'string' ? message.error : 'Tool call failed'));
        }
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

      case 'auth_error':
        // Handle authentication errors with user-friendly messages
        if (message.error) {
          handleCategorizedError(message.error, 'Authentication');
        }
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

      case 'mcp:servers_discovered':
        // Handle MCP server discovery results
        console.log('📡 MCP servers discovered:', message.payload);
        // Store discovered servers in component state or emit event for interested components
        break;

      // TODO: Remove these logging-only handlers post-troubleshooting
      case 'mcp_catalog_list_response':
      case 'event_send_response':
      case 'event_published':
      case 'subscription_confirmed':
      case 'organization_list_response':
      case 'organization_members_response':
      case 'organization_permissions_response':
        // These responses are handled by sendMessage promise resolution
        // Logging cases can be removed once debugging is complete
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

      // Set up timeout (5 seconds for quick feedback, critical calls can retry)
      const timeout = setTimeout(() => {
        pendingRequests.delete(messageId);
        reject(new Error(`MCP tool call '${tool}' timed out after 5s - check MCP server connection`));
      }, 5000);

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


  // KV Store methods
  const kvStore = {
    get: (key: string) => executeToolSafely('kv_get', { key }),
    set: (key: string, value: any, ttlHours: number = 24) => executeToolSafely('kv_set', { key, value, ttl_hours: ttlHours }),
  };

  // Artifacts methods
  const artifacts = {
    list: (prefix: string = '') => executeToolSafely('artifacts_list', { prefix }),
    get: (key: string) => executeToolSafely('artifacts_get', { key }),
    put: (key: string, content: string, contentType: string = 'text/plain') => executeToolSafely('artifacts_put', { key, content, content_type: contentType }),
  };


  // Events methods
  const events = {
    send: (detailType: string, detail: Record<string, any>, source: string = 'dashboard') => executeToolSafely('events_send', { detailType, detail, source }),
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
      // Only connect if not already connected or connecting
      if (!isConnected() && !isConnecting) {
        authenticate();
      }
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
    sendMessageWithResponse,

    // MCP tool calls
    callMCPTool,
    executeTool,

    // Core MCP APIs
    kvStore,
    artifacts,
    events,

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