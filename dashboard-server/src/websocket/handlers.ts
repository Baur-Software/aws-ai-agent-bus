import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import MCPStdioService from '../services/MCPStdioService.js';
import { KVHandler } from '../handlers/kv.js';
import { AgentHandler } from '../handlers/agents.js';
import AuthMiddleware, { UserContext } from '../middleware/auth.js';
import { MCPWebSocketHandler, MCP_MESSAGE_TYPES } from './mcpHandlers.js';
import ErrorHandler from '../utils/ErrorHandler.js';

interface Dependencies {
  metricsAggregator: any;
  eventSubscriber: any;
}

export function setupWebSocketHandlers(wss: WebSocketServer, { metricsAggregator, eventSubscriber }: Dependencies) {
  // MCP service initialization disabled - will use Lambda/nginx proxy later
  const mcpService = null;

  wss.on('connection', async (ws: WebSocket, req: IncomingMessage) => {
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
          await handleWebSocketMessage(ws, message, { metricsAggregator, eventSubscriber, mcpService });
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

async function handleWebSocketMessage(ws: WebSocket, message: any, { metricsAggregator, eventSubscriber, mcpService }: HandleMessageDeps) {
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
                name: 'mcp__aws__kv_get',
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
                name: 'mcp__aws__kv_set',
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
                name: 'agent.listAvailableAgents',
                description: 'List available agents from .claude/agents directory',
                inputSchema: {
                  type: 'object',
                  properties: {}
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
          if (message.tool === 'mcp__aws__kv_get') {
            result = await KVHandler.get(message.arguments || {});
          } else if (message.tool === 'mcp__aws__kv_set') {
            result = await KVHandler.set(message.arguments || {});
          }
          // Handle agent operations with user context
          else if (message.tool === 'agent_listAvailableAgents' || message.tool === 'agent.listAvailableAgents') {
            result = await AgentHandler.listAvailableAgents();
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

        ws.send(JSON.stringify({
          id: message.id,
          result
        }));
        break;

      // Existing dashboard message types
      case 'subscribe_events':
        await eventSubscriber.subscribe(message.eventTypes);
        ws.send(JSON.stringify({
          type: 'subscription_confirmed',
          eventTypes: message.eventTypes
        }));
        break;

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