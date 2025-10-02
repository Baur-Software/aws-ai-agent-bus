import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import MCPStdioService from '../services/MCPStdioService.js';
import { KVHandler } from '../handlers/kv.js';
import { AgentHandler } from '../handlers/agents.js';
import AuthMiddleware, { UserContext } from '../middleware/auth.js';
import { MCPWebSocketHandler, MCP_MESSAGE_TYPES } from './mcpHandlers.js';
import ErrorHandler from '../utils/ErrorHandler.js';
import { EventsHandler } from '../handlers/events.js';
import { mcpMarketplace } from '../services/MCPMarketplace.js';
import { ChatService } from '../services/ChatService.js';
import { MCPServiceRegistry } from '../services/MCPServiceRegistry.js';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { EventBridgeClient } from '@aws-sdk/client-eventbridge';

interface Dependencies {
  metricsAggregator: any;
  eventSubscriber: any;
}

// Global ChatService instance
let chatServiceInstance: ChatService | null = null;

function getChatService(): ChatService {
  if (!chatServiceInstance) {
    const dynamodb = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-west-2' });
    const eventBridge = new EventBridgeClient({ region: process.env.AWS_REGION || 'us-west-2' });
    const mcpRegistry = new MCPServiceRegistry();

    chatServiceInstance = new ChatService(dynamodb, eventBridge, mcpRegistry, {
      bedrock: {
        region: process.env.AWS_REGION || 'us-west-2',
        modelId: process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-sonnet-20240229-v1:0'
      }
    });
  }
  return chatServiceInstance;
}

export function setupWebSocketHandlers(wss: WebSocketServer, { metricsAggregator, eventSubscriber }: Dependencies, yjsHandler?: any) {
  // MCP service initialization disabled - will use Lambda/nginx proxy later
  const mcpService = null;

  wss.on('connection', async (ws: WebSocket, req: IncomingMessage) => {
    const url = req.url || '';

    // Route Yjs workflow connections to Yjs handler
    if (url.includes('/workflow/') && yjsHandler) {
      console.log('🔄 Yjs workflow connection');
      const userContext = AuthMiddleware.authenticateWebSocket(ws, req);
      if (!userContext) {
        ws.close(1008, 'Authentication failed');
        return;
      }
      yjsHandler.handleConnection(ws, req, userContext);
      return;
    }

    console.log('📱 Dashboard client attempting to connect');

    // Authenticate the WebSocket connection
    const userContext = AuthMiddleware.authenticateWebSocket(ws, req);
    if (!userContext) {
      const authError = await ErrorHandler.handleError(
        new Error('WebSocket authentication failed'),
        'websocket_auth'
      );

      // Send user-friendly error before closing
      ws.send(JSON.stringify({
        type: 'auth_error',
        error: ErrorHandler.createErrorResponse(authError).error
      }));

      ws.close(1008, authError.userMessage);
      return;
    }

    // Store user context on the WebSocket connection
    (ws as any).userContext = userContext;
    (ws as any).wss = wss; // Reference to the WebSocket server for broadcasting

    // Initialize MCP handler for this connection
    const mcpHandler = new MCPWebSocketHandler(ws);

    console.log(`📱 User ${userContext.userId} connected via WebSocket`);
    console.log(`📡 Subscribed to events: metrics_update, activity_update, organization_switched`);

    // Send initial metrics
    sendInitialData(ws, metricsAggregator);

    // Handle incoming messages
    ws.on('message', async (data: any) => {
      try {
        const message = JSON.parse(data.toString());

        // Route MCP marketplace messages to MCP handler
        if (Object.values(MCP_MESSAGE_TYPES).includes(message.type)) {
          const mcpMessage = {
            ...message,
            userId: userContext.userId,
            orgId: userContext.organizationId
          };
          await mcpHandler.handleMessage(mcpMessage);
        } else {
          // Handle other WebSocket messages
          await handleWebSocketMessage(ws, message, { metricsAggregator, eventSubscriber, mcpService, userContext });
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
        ws.send(JSON.stringify({
          type: 'error',
          error: 'Invalid message format'
        }));
      }
    });

    // Handle disconnection
    ws.on('close', () => {
      // Cleanup event subscriptions
      const clientId = (ws as any).clientId;
      if (clientId) {
        EventsHandler.unsubscribe(clientId);
      }
      console.log('📱 Dashboard client disconnected');
    });

    // Handle errors
    ws.on('error', (error: any) => {
      console.error('WebSocket error:', error);
    });
  });

  // Broadcast updates to all connected clients
  const broadcast = (message: any) => {
    wss.clients.forEach((client: WebSocket) => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(JSON.stringify(message));
      }
    });
  };

  // Subscribe to events and broadcast updates
  eventSubscriber.onMetricsUpdate((metrics: any) => {
    broadcast({
      type: 'metrics_update',
      data: metrics
    });
  });

  eventSubscriber.onActivityUpdate((activity: any) => {
    broadcast({
      type: 'activity_update',
      data: activity
    });
  });

  return {
    broadcast,
    cleanup: async () => {
      // Cleanup agent handler MCP connection
      await AgentHandler.cleanup();
    }
  };
}

// Utility function to broadcast to specific user's connections
function broadcastToUser(wss: WebSocketServer, userId: string, message: any) {
  wss.clients.forEach((client: WebSocket) => {
    if (client.readyState === 1 && (client as any).userId === userId) { // WebSocket.OPEN
      client.send(JSON.stringify(message));
    }
  });
}

async function sendInitialData(ws: WebSocket, metricsAggregator: any) {
  try {
    const [metrics, activity] = await Promise.all([
      metricsAggregator.getAllMetrics(),
      metricsAggregator.getRecentActivity()
    ]);

    ws.send(JSON.stringify({
      type: 'initial_data',
      data: {
        metrics,
        activity
      }
    }));
  } catch (error) {
    console.error('Error sending initial data:', error);
  }
}

interface HandleMessageDeps {
  metricsAggregator: any;
  eventSubscriber: any;
  mcpService?: MCPStdioService | null;
}

async function handleWebSocketMessage(ws: WebSocket, message: any, { metricsAggregator, eventSubscriber, mcpService, userContext }: HandleMessageDeps & { userContext: UserContext }) {
  try {
    switch (message.type) {
      // MCP-specific message types
      case 'health_check':
        ws.send(JSON.stringify({
          id: message.id,
          result: {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            message: 'Dashboard server running (MCP via Lambda/nginx proxy later)'
          }
        }));
        break;

      case 'server_info':
        ws.send(JSON.stringify({
          id: message.id,
          result: {
            service: 'Dashboard Server',
            version: '1.0.0',
            description: 'Dashboard Server with WebSocket MCP Proxy'
          }
        }));
        break;

      case 'list_tools':
        ws.send(JSON.stringify({
          id: message.id,
          result: {
            tools: [
              {
                name: 'kv_get',
                description: 'Get value from KV store',
                inputSchema: {
                  type: 'object',
                  properties: {
                    key: { type: 'string', description: 'Key to retrieve' }
                  },
                  required: ['key']
                }
              },
              {
                name: 'kv_set',
                description: 'Set value in KV store',
                inputSchema: {
                  type: 'object',
                  properties: {
                    key: { type: 'string', description: 'Key to set' },
                    value: { type: 'string', description: 'Value to store' },
                    ttl_hours: { type: 'number', description: 'Time to live in hours', default: 24 }
                  },
                  required: ['key', 'value']
                }
              },
              {
                name: 'agent.processRequest',
                description: 'Process request through agent governance',
                inputSchema: {
                  type: 'object',
                  properties: {
                    userId: { type: 'string', description: 'User identifier' },
                    sessionId: { type: 'string', description: 'Session identifier' },
                    request: { type: 'string', description: 'Request to process' },
                    context: { type: 'object', description: 'Additional context' }
                  },
                  required: ['userId', 'sessionId', 'request']
                }
              },
              {
                name: 'agent.delegateToAgent',
                description: 'Delegate task directly to specific agent',
                inputSchema: {
                  type: 'object',
                  properties: {
                    agentType: { type: 'string', description: 'Agent type to delegate to' },
                    prompt: { type: 'string', description: 'Prompt for the agent' },
                    userId: { type: 'string', description: 'User identifier' },
                    sessionId: { type: 'string', description: 'Session identifier' },
                    context: { type: 'object', description: 'Additional context' }
                  },
                  required: ['agentType', 'prompt', 'userId', 'sessionId']
                }
              },
              {
                name: 'agent.getTaskStatus',
                description: 'Get status of a delegated task',
                inputSchema: {
                  type: 'object',
                  properties: {
                    taskId: { type: 'string', description: 'Task ID to check' }
                  },
                  required: ['taskId']
                }
              }
            ]
          }
        }));
        break;

      case 'mcp_call':
        let result;
        try {
          // Handle KV operations directly for faster response
          if (message.tool === 'kv_get') {
            result = await KVHandler.get(message.arguments || {});
          } else if (message.tool === 'kv_set') {
            result = await KVHandler.set(message.arguments || {});
          }
          // User-specific agent operations
          else if (message.tool === 'agent_list') {
            const userContext = (ws as any).userContext as UserContext;
            result = await AgentHandler.listAgents({
              ownerType: message.arguments.ownerType || 'user',
              ownerId: message.arguments.ownerId || userContext.userId
            });
          }
          else if (message.tool === 'agent_get') {
            const userContext = (ws as any).userContext as UserContext;
            result = await AgentHandler.getAgent({
              agentId: message.arguments.agentId,
              ownerType: message.arguments.ownerType || 'user',
              ownerId: message.arguments.ownerId || userContext.userId
            });
          }
          else if (message.tool === 'agent_create') {
            const userContext = (ws as any).userContext as UserContext;
            const ownerType = message.arguments.ownerType || 'user';
            const ownerId = ownerType === 'organization' ? userContext.organizationId : userContext.userId;

            // Check permissions
            if (!AuthMiddleware.hasPermission(userContext, 'write', { ownerType, ownerId })) {
              throw new Error('Insufficient permissions to create agent');
            }

            result = await AgentHandler.createAgent({
              ownerType,
              ownerId,
              name: message.arguments.name,
              description: message.arguments.description,
              markdown: message.arguments.markdown,
              tags: message.arguments.tags
            });
          }
          else if (message.tool === 'agent_update') {
            const userContext = (ws as any).userContext as UserContext;

            // Check permissions
            if (!AuthMiddleware.hasPermission(userContext, 'write', {
              ownerType: message.arguments.ownerType,
              ownerId: message.arguments.ownerId
            })) {
              throw new Error('Insufficient permissions to update agent');
            }

            result = await AgentHandler.updateAgent({
              agentId: message.arguments.agentId,
              ownerType: message.arguments.ownerType,
              ownerId: message.arguments.ownerId,
              markdown: message.arguments.markdown,
              description: message.arguments.description,
              tags: message.arguments.tags,
              changelog: message.arguments.changelog
            });
          }
          else if (message.tool === 'agent_delete') {
            const userContext = (ws as any).userContext as UserContext;

            // Check permissions
            if (!AuthMiddleware.hasPermission(userContext, 'delete', {
              ownerType: message.arguments.ownerType,
              ownerId: message.arguments.ownerId
            })) {
              throw new Error('Insufficient permissions to delete agent');
            }

            result = await AgentHandler.deleteAgent({
              agentId: message.arguments.agentId,
              ownerType: message.arguments.ownerType,
              ownerId: message.arguments.ownerId
            });
          }
          else if (message.tool === 'agent_processRequest' || message.tool === 'agent.processRequest') {
            result = await AgentHandler.processRequest(message.arguments || {});
          } else if (message.tool === 'agent_delegateToAgent' || message.tool === 'agent.delegateToAgent') {
            result = await AgentHandler.delegateToAgent(message.arguments || {});
          } else if (message.tool === 'agent_getTaskStatus' || message.tool === 'agent.getTaskStatus') {
            result = await AgentHandler.getTaskStatus(message.arguments?.taskId || '');
          } else {
            // Other MCP tools not yet supported via dashboard-server WebSocket
            result = {
              success: false,
              error: `Tool ${message.tool} not available via dashboard-server WebSocket. Supported: KV operations, agent operations.`,
              tool: message.tool,
              arguments: message.arguments
            };
          }
        } catch (error) {
          // Use the error handler to categorize and log properly
          const categorizedError = await ErrorHandler.handleError(
            error,
            `mcp_call_${message.tool}`,
            (ws as any).userContext?.userId
          );

          // Throw the categorized error to be handled by the outer catch
          const handledError = new Error(categorizedError.userMessage);
          (handledError as any).categorized = categorizedError;
          throw handledError;
        }

        const response = {
          id: message.id,
          result
        };
        ws.send(JSON.stringify(response));
        break;

      // Existing dashboard message types
      case 'subscribe_events':
        // New EventsHandler subscription (full pub/sub)
        const clientId = `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        (ws as any).clientId = clientId;

        EventsHandler.subscribe({
          clientId,
          ws,
          userId: userContext.userId,
          organizationId: userContext.organizationId,
          eventTypes: message.eventTypes || ['*'],
          filters: message.filters
        });

        ws.send(JSON.stringify({
          type: 'subscription_confirmed',
          clientId,
          eventTypes: message.eventTypes || ['*'],
          filters: message.filters
        }));
        break;

      case 'publish_event':
        // Publish event through EventsHandler hub
        const publishResult = await EventsHandler.publish({
          ...message.event,
          userId: userContext.userId,
          organizationId: userContext.organizationId
        });

        ws.send(JSON.stringify({
          type: 'event_published',
          eventId: publishResult.eventId,
          success: publishResult.success,
          timestamp: publishResult.timestamp
        }));
        break;

      case 'chat.send_message': {
        const { sessionId, message: userMessage } = message.data || message;
        const chatService = getChatService();

        try {
          // Create session if needed
          let targetSessionId = sessionId;
          if (!targetSessionId) {
            const session = await chatService.createSession(
              userContext.userId,
              'New Chat',
              'bedrock',
              userContext.organizationId
            );
            targetSessionId = session.sessionId;
          }

          // Send message and get AI response
          const response = await chatService.sendMessage({
            sessionId: targetSessionId,
            message: userMessage,
            userId: userContext.userId,
            organizationId: userContext.organizationId
          });

          ws.send(JSON.stringify({
            id: message.id,
            type: 'chat.message_response',
            data: {
              sessionId: targetSessionId,
              message: response
            }
          }));
        } catch (error) {
          console.error('Chat error:', error);
          ws.send(JSON.stringify({
            id: message.id,
            type: 'error',
            error: error instanceof Error ? error.message : 'Failed to process chat message'
          }));
        }
        break;
      }

      case 'chat.get_history': {
        const { sessionId } = message.data || message;
        const chatService = getChatService();

        try {
          const session = chatService.getSession(sessionId);

          ws.send(JSON.stringify({
            id: message.id,
            type: 'chat.history_response',
            data: {
              messages: session?.messages || [],
              session: session ? {
                sessionId: session.sessionId,
                title: session.title,
                backend: session.backend,
                model: session.model
              } : null
            }
          }));
        } catch (error) {
          console.error('Get history error:', error);
          ws.send(JSON.stringify({
            id: message.id,
            type: 'error',
            error: error instanceof Error ? error.message : 'Failed to get chat history'
          }));
        }
        break;
      }

      case 'chat.create_session': {
        const { title } = message.data || message;
        const chatService = getChatService();

        try {
          const session = await chatService.createSession(
            userContext.userId,
            title || 'New Chat',
            'bedrock',
            userContext.organizationId
          );

          ws.send(JSON.stringify({
            id: message.id,
            type: 'chat.session_created',
            data: {
              sessionId: session.sessionId,
              title: session.title,
              backend: session.backend,
              model: session.model
            }
          }));
        } catch (error) {
          console.error('Create session error:', error);
          ws.send(JSON.stringify({
            id: message.id,
            type: 'error',
            error: error instanceof Error ? error.message : 'Failed to create chat session'
          }));
        }
        break;
      }

      case 'request_metrics':
        const metrics = await metricsAggregator.getAllMetrics();
        ws.send(JSON.stringify({
          type: 'metrics_response',
          data: metrics
        }));
        break;

      case 'context_switch':
        // Broadcast context switch event to all clients for this user
        const contextSwitchEvent = {
          type: 'context_switched',
          data: {
            userId: message.userId,
            sessionId: message.sessionId,
            fromContextId: message.fromContextId,
            toContextId: message.toContextId,
            contextType: message.contextType,
            timestamp: new Date().toISOString()
          }
        };

        // Broadcast to all clients
        broadcastToUser((ws as any).wss, message.userId, contextSwitchEvent);

        // Confirm to sender
        ws.send(JSON.stringify({
          type: 'context_switch_confirmed',
          data: contextSwitchEvent.data
        }));
        break;

      case 'session_created':
        // Broadcast new session creation
        const sessionEvent = {
          type: 'session_created',
          data: {
            userId: message.userId,
            sessionId: message.sessionId,
            contextId: message.contextId,
            title: message.title,
            timestamp: new Date().toISOString()
          }
        };

        broadcastToUser((ws as any).wss, message.userId, sessionEvent);
        break;

      case 'ping':
        ws.send(JSON.stringify({
          type: 'pong',
          timestamp: new Date().toISOString()
        }));
        break;

      // MCP Catalog operations
      case 'mcp_catalog_list':
        try {
          const catalogResult = await getMCPServers();
          ws.send(JSON.stringify({
            id: message.id,
            type: 'mcp_catalog_list_response',
            data: catalogResult
          }));
        } catch (error) {
          const catalogError = await ErrorHandler.handleError(
            error,
            'mcp_catalog_list',
            (ws as any).userContext?.userId
          );
          ws.send(JSON.stringify({
            id: message.id,
            type: 'mcp_catalog_list_response',
            error: catalogError.userMessage
          }));
        }
        break;

      case 'mcp:discover_servers':
        try {
          const catalogResult = await getMCPServers();
          ws.send(JSON.stringify({
            id: message.id,
            type: 'mcp:discover_servers_response',
            result: {
              payload: {
                servers: catalogResult
              }
            }
          }));
        } catch (error) {
          const catalogError = await ErrorHandler.handleError(
            error,
            'mcp:discover_servers',
            (ws as any).userContext?.userId
          );
          ws.send(JSON.stringify({
            id: message.id,
            type: 'mcp:discover_servers_response',
            error: catalogError.userMessage
          }));
        }
        break;

      case 'mcp_server_connect':
        try {
          const userContext = (ws as any).userContext as UserContext;
          const connectResult = await connectMCPServer(
            message.data.serverId,
            message.data.serverConfig,
            userContext
          );
          ws.send(JSON.stringify({
            id: message.id,
            type: 'mcp_server_connect_response',
            data: connectResult
          }));
        } catch (error) {
          const connectError = await ErrorHandler.handleError(
            error,
            'mcp_server_connect',
            (ws as any).userContext?.userId
          );
          ws.send(JSON.stringify({
            id: message.id,
            type: 'mcp_server_connect_response',
            error: connectError.userMessage
          }));
        }
        break;

      case 'mcp_server_disconnect':
        try {
          const userContext = (ws as any).userContext as UserContext;
          const disconnectResult = await disconnectMCPServer(
            message.data.serverId,
            userContext
          );
          ws.send(JSON.stringify({
            id: message.id,
            type: 'mcp_server_disconnect_response',
            data: disconnectResult
          }));
        } catch (error) {
          const disconnectError = await ErrorHandler.handleError(
            error,
            'mcp_server_disconnect',
            (ws as any).userContext?.userId
          );
          ws.send(JSON.stringify({
            id: message.id,
            type: 'mcp_server_disconnect_response',
            error: disconnectError.userMessage
          }));
        }
        break;

      case 'event_send':
        try {
          const userContext = (ws as any).userContext as UserContext;
          await EventsHandler.send({
            source: message.data.source,
            detailType: message.data.detailType,
            detail: {
              ...message.data.detail,
              userId: userContext.userId,
              organizationId: userContext.organizationId
            }
          });
          ws.send(JSON.stringify({
            id: message.id,
            type: 'event_send_response',
            data: { success: true }
          }));
        } catch (error) {
          const eventError = await ErrorHandler.handleError(
            error,
            'event_send',
            (ws as any).userContext?.userId
          );
          ws.send(JSON.stringify({
            id: message.id,
            type: 'event_send_response',
            error: eventError.userMessage
          }));
        }
        break;

      // Organization-related message handlers
      case 'organization_list':
        try {
          const userContext = (ws as any).userContext as UserContext;
          // Get organizations from auth service (import needed)
          const { AuthService } = await import('../routes/authRoutes.js');
          const organizations = await AuthService.getUserOrganizations(userContext.userId);

          ws.send(JSON.stringify({
            id: message.id,
            type: 'organization_list_response',
            data: { organizations }
          }));
        } catch (error) {
          const orgError = await ErrorHandler.handleError(
            error,
            'organization_list',
            (ws as any).userContext?.userId
          );
          ws.send(JSON.stringify({
            id: message.id,
            type: 'organization_list_response',
            error: orgError.userMessage
          }));
        }
        break;

      case 'organization_members':
        try {
          const userContext = (ws as any).userContext as UserContext;
          const { organizationId } = message.data;

          // For demo purposes, return mock member data
          // In production, this would query a members table
          const members = [
            {
              id: userContext.userId,
              email: userContext.email,
              name: userContext.name,
              role: 'admin',
              joinedAt: new Date().toISOString(),
              status: 'active'
            }
          ];

          ws.send(JSON.stringify({
            id: message.id,
            type: 'organization_members_response',
            data: { members }
          }));
        } catch (error) {
          const memberError = await ErrorHandler.handleError(
            error,
            'organization_members',
            (ws as any).userContext?.userId
          );
          ws.send(JSON.stringify({
            id: message.id,
            type: 'organization_members_response',
            error: memberError.userMessage
          }));
        }
        break;

      case 'organization_permissions':
        try {
          const userContext = (ws as any).userContext as UserContext;
          const { organizationId } = message.data;

          // For demo purposes, return admin permissions
          // In production, this would query user roles and permissions
          const permissions = [
            {
              resource: 'workflows',
              action: 'read',
              granted: true
            },
            {
              resource: 'workflows',
              action: 'write',
              granted: true
            },
            {
              resource: 'workflows',
              action: 'delete',
              granted: true
            },
            {
              resource: 'organizations',
              action: 'read',
              granted: true
            },
            {
              resource: 'organizations',
              action: 'write',
              granted: true
            },
            {
              resource: 'members',
              action: 'read',
              granted: true
            },
            {
              resource: 'members',
              action: 'write',
              granted: true
            },
            {
              resource: 'agents',
              action: 'read',
              granted: true
            },
            {
              resource: 'agents',
              action: 'write',
              granted: true
            }
          ];

          ws.send(JSON.stringify({
            id: message.id,
            type: 'organization_permissions_response',
            data: { permissions }
          }));
        } catch (error) {
          const permError = await ErrorHandler.handleError(
            error,
            'organization_permissions',
            (ws as any).userContext?.userId
          );
          ws.send(JSON.stringify({
            id: message.id,
            type: 'organization_permissions_response',
            error: permError.userMessage
          }));
        }
        break;

      default:
        ws.send(JSON.stringify({
          id: message.id,
          error: {
            code: -32601,
            message: `Unknown message type: ${message.type}`
          }
        }));
    }
  } catch (error) {
    // Check if this is already a categorized error
    const categorizedError = (error as any).categorized ||
      await ErrorHandler.handleError(
        error,
        `websocket_${message.type}`,
        (ws as any).userContext?.userId
      );

    // Send user-friendly error response
    const errorResponse = ErrorHandler.createErrorResponse(categorizedError);

    ws.send(JSON.stringify({
      id: message.id,
      error: {
        code: -32603,
        message: errorResponse.error.message,
        category: errorResponse.error.category,
        shouldRetry: errorResponse.error.shouldRetry
      },
      retryInfo: errorResponse.retryInfo
    }));
  }
}

// MCP Catalog Helper Functions
async function getMCPServers() {
  try {
    const servers = await mcpMarketplace.searchServers('');
    return servers;
  } catch (error) {
    console.error('Error fetching MCP servers from marketplace:', error);
    throw error;
  }
}

async function connectMCPServer(serverId: string, serverConfig: any, userContext: UserContext) {
  // Mock connection for now - in production this would actually configure and connect to the MCP server
  console.log(`Connecting to MCP server ${serverId} for user ${userContext.userId}`);

  // Simulate connection delay
  await new Promise(resolve => setTimeout(resolve, 1000));

  return {
    success: true,
    serverId,
    connectionId: `conn_${Date.now()}`,
    message: `Successfully connected to ${serverConfig.name || serverId}`,
    timestamp: new Date().toISOString()
  };
}

async function disconnectMCPServer(serverId: string, userContext: UserContext) {
  // Mock disconnection for now
  console.log(`Disconnecting MCP server ${serverId} for user ${userContext.userId}`);

  return {
    success: true,
    serverId,
    message: `Successfully disconnected from ${serverId}`,
    timestamp: new Date().toISOString()
  };
}