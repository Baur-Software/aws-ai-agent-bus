import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import MCPStdioService from '../services/MCPStdioService.js';
import { KVHandler } from '../handlers/kv.js';
import { AgentHandler } from '../handlers/agents.js';
import AuthMiddleware, { UserContext } from '../middleware/auth.js';
import { MCPWebSocketHandler, MCP_MESSAGE_TYPES } from './mcpHandlers.js';
import ErrorHandler from '../utils/ErrorHandler.js';
import { EventsHandler } from '../handlers/events.js';

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
  // Mock MCP catalog data for now - in production this would call the MCPCatalogService
  const mockServers = [
    {
      id: 'github-official',
      name: 'GitHub',
      description: 'Official GitHub MCP server for repository management, issue tracking, and code collaboration',
      publisher: 'GitHub Inc.',
      version: '1.2.0',
      isOfficial: true,
      isSigned: true,
      verificationBadges: ['official', 'signed'],
      repository: 'https://github.com/github/mcp-server',
      documentation: 'https://docs.github.com/mcp',
      downloadCount: 150000,
      starCount: 1200,
      lastUpdated: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      category: 'Development',
      tags: ['git', 'repositories', 'issues', 'collaboration'],
      configurationSchema: [
        {
          key: 'token',
          label: 'GitHub Personal Access Token',
          type: 'password',
          required: true,
          description: 'GitHub personal access token with repo and user permissions',
          sensitive: true
        },
        {
          key: 'baseUrl',
          label: 'GitHub Base URL',
          type: 'url',
          required: false,
          description: 'Base URL for GitHub Enterprise (leave empty for github.com)',
          defaultValue: 'https://api.github.com'
        }
      ],
      authMethods: ['api_key'],
      toolCount: 15,
      capabilities: ['repository-management', 'issue-tracking', 'pull-requests', 'user-management'],
      installCommand: 'npm install -g @github/mcp-server'
    },
    {
      id: 'atlassian-jira',
      name: 'Atlassian Jira',
      description: 'Connect to Jira for issue management, project tracking, and agile workflows',
      publisher: 'Atlassian',
      version: '2.1.5',
      isOfficial: true,
      isSigned: true,
      verificationBadges: ['official', 'signed', 'popular'],
      repository: 'https://github.com/atlassian/mcp-jira',
      documentation: 'https://developer.atlassian.com/mcp',
      downloadCount: 89000,
      starCount: 890,
      lastUpdated: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
      category: 'Enterprise',
      tags: ['project-management', 'issues', 'agile', 'workflows'],
      configurationSchema: [
        {
          key: 'instanceUrl',
          label: 'Jira Instance URL',
          type: 'url',
          required: true,
          description: 'Your Jira instance URL (e.g., https://company.atlassian.net)',
          validation: '^https?://.+\\.atlassian\\.net/?$'
        },
        {
          key: 'email',
          label: 'Email Address',
          type: 'text',
          required: true,
          description: 'Your Jira account email address'
        },
        {
          key: 'apiToken',
          label: 'API Token',
          type: 'password',
          required: true,
          description: 'Jira API token from your account settings',
          sensitive: true
        }
      ],
      authMethods: ['api_key', 'oauth2'],
      toolCount: 22,
      capabilities: ['issue-management', 'project-tracking', 'workflow-automation', 'reporting'],
      installCommand: 'npm install -g @atlassian/mcp-jira',
      npmPackage: '@atlassian/mcp-jira'
    },
    {
      id: 'hubspot-crm',
      name: 'HubSpot CRM',
      description: 'Integration with HubSpot for customer relationship management, marketing automation, and sales tracking',
      publisher: 'HubSpot',
      version: '3.0.2',
      isOfficial: true,
      isSigned: true,
      verificationBadges: ['official', 'signed', 'popular'],
      repository: 'https://github.com/hubspot/mcp-hubspot',
      documentation: 'https://developers.hubspot.com/docs/api/mcp',
      downloadCount: 67000,
      starCount: 445,
      lastUpdated: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 1 week ago
      category: 'CRM',
      tags: ['crm', 'marketing', 'sales', 'contacts', 'automation'],
      configurationSchema: [
        {
          key: 'accessToken',
          label: 'HubSpot Access Token',
          type: 'password',
          required: true,
          description: 'HubSpot private app access token',
          sensitive: true
        },
        {
          key: 'portalId',
          label: 'Portal ID',
          type: 'number',
          required: true,
          description: 'Your HubSpot portal (account) ID'
        }
      ],
      authMethods: ['oauth2', 'api_key'],
      toolCount: 28,
      capabilities: ['contact-management', 'deal-tracking', 'email-marketing', 'analytics'],
      installCommand: 'npm install -g @hubspot/mcp-server',
      npmPackage: '@hubspot/mcp-server'
    },
    {
      id: 'elasticsearch-search',
      name: 'Elasticsearch',
      description: 'Search and analytics engine integration for full-text search, data analysis, and real-time insights',
      publisher: 'Elastic',
      version: '1.8.1',
      isOfficial: false,
      isSigned: true,
      verificationBadges: ['signed', 'popular'],
      repository: 'https://github.com/elastic/mcp-elasticsearch',
      documentation: 'https://www.elastic.co/guide/en/mcp/current/index.html',
      downloadCount: 34000,
      starCount: 278,
      lastUpdated: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // 2 weeks ago
      category: 'Database',
      tags: ['search', 'analytics', 'indexing', 'data'],
      configurationSchema: [
        {
          key: 'host',
          label: 'Elasticsearch Host',
          type: 'url',
          required: true,
          description: 'Elasticsearch cluster endpoint',
          defaultValue: 'http://localhost:9200'
        },
        {
          key: 'username',
          label: 'Username',
          type: 'text',
          required: false,
          description: 'Username for authentication (if required)'
        },
        {
          key: 'password',
          label: 'Password',
          type: 'password',
          required: false,
          description: 'Password for authentication (if required)',
          sensitive: true
        }
      ],
      authMethods: ['basic', 'api_key', 'none'],
      toolCount: 12,
      capabilities: ['full-text-search', 'data-analytics', 'indexing', 'aggregations'],
      installCommand: 'npm install -g @elastic/mcp-elasticsearch',
      dockerImage: 'elastic/mcp-elasticsearch:latest'
    }
  ];

  return {
    servers: mockServers,
    total: mockServers.length,
    registries: [
      {
        name: 'Official MCP Registry',
        url: 'https://mcpservers.org',
        description: 'Official registry of verified MCP servers',
        isOfficial: true
      }
    ]
  };
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