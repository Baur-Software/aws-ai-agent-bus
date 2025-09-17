#!/usr/bin/env node

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { AgentMeshMCPServer } from './modules/mcp/server.js';

const app = express();
const PORT = process.env.MCP_HTTP_PORT || 3002;

// Create MCP server instance
const mcpServer = new AgentMeshMCPServer();

// Middleware
app.use(cors({
  origin: process.env.DASHBOARD_ORIGIN || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    service: 'mcp-http-bridge'
  });
});

// MCP tools listing endpoint
app.get('/mcp/tools', async (req, res) => {
  try {
    // Manually construct the tools list to match what the MCP server would return
    const tools = [
      {
        name: 'kv.get',
        description: 'Get a value from the key-value store',
        inputSchema: {
          type: 'object',
          properties: {
            key: { type: 'string', description: 'The key to retrieve' }
          },
          required: ['key']
        }
      },
      {
        name: 'kv.set',
        description: 'Set a value in the key-value store',
        inputSchema: {
          type: 'object',
          properties: {
            key: { type: 'string', description: 'The key to set' },
            value: { type: 'string', description: 'The value to store' },
            ttl_hours: { type: 'number', description: 'Time to live in hours (default: 24)', default: 24 }
          },
          required: ['key', 'value']
        }
      },
      {
        name: 'artifacts.list',
        description: 'List artifacts with optional prefix',
        inputSchema: {
          type: 'object',
          properties: {
            prefix: { type: 'string', description: 'Optional prefix to filter artifacts', default: '' }
          }
        }
      },
      {
        name: 'artifacts.get',
        description: 'Get an artifact by key',
        inputSchema: {
          type: 'object',
          properties: {
            key: { type: 'string', description: 'The artifact key to retrieve' }
          },
          required: ['key']
        }
      },
      {
        name: 'artifacts.put',
        description: 'Store an artifact',
        inputSchema: {
          type: 'object',
          properties: {
            key: { type: 'string', description: 'The artifact key' },
            content: { type: 'string', description: 'The artifact content' },
            content_type: { type: 'string', description: 'The content type', default: 'text/plain' }
          },
          required: ['key', 'content']
        }
      },
      {
        name: 'workflow.start',
        description: 'Start a workflow',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'The name of the workflow to start' },
            input: { type: 'object', description: 'Input data for the workflow', default: {} }
          },
          required: ['name']
        }
      },
      {
        name: 'workflow.status',
        description: 'Get workflow status',
        inputSchema: {
          type: 'object',
          properties: {
            executionArn: { type: 'string', description: 'The execution ARN of the workflow' }
          },
          required: ['executionArn']
        }
      },
      {
        name: 'events.send',
        description: 'Send an event',
        inputSchema: {
          type: 'object',
          properties: {
            detailType: { type: 'string', description: 'The event type' },
            detail: { type: 'object', description: 'The event details' },
            source: { type: 'string', description: 'The event source', default: 'mcp-client' }
          },
          required: ['detailType', 'detail']
        }
      },
      {
        name: 'ga.getTopPages',
        description: 'Get top performing pages from Google Analytics',
        inputSchema: {
          type: 'object',
          properties: {
            propertyId: { type: 'string', description: 'GA4 property ID' },
            days: { type: 'number', description: 'Number of days to analyze (default: 30)', default: 30 }
          },
          required: ['propertyId']
        }
      },
      {
        name: 'ga.getSearchConsoleData',
        description: 'Get Search Console keyword data',
        inputSchema: {
          type: 'object',
          properties: {
            siteUrl: { type: 'string', description: 'Website URL in Search Console' },
            days: { type: 'number', description: 'Number of days to analyze (default: 30)', default: 30 }
          },
          required: ['siteUrl']
        }
      },
      {
        name: 'ga.analyzeContentOpportunities',
        description: 'Analyze content opportunities using GA and Search Console data',
        inputSchema: {
          type: 'object',
          properties: {
            propertyId: { type: 'string', description: 'GA4 property ID' },
            siteUrl: { type: 'string', description: 'Website URL in Search Console' }
          },
          required: ['propertyId', 'siteUrl']
        }
      },
      {
        name: 'ga.generateContentCalendar',
        description: 'Generate monthly content calendar based on analytics insights',
        inputSchema: {
          type: 'object',
          properties: {
            propertyId: { type: 'string', description: 'GA4 property ID' },
            siteUrl: { type: 'string', description: 'Website URL in Search Console' },
            targetMonth: { type: 'string', description: 'Target month (YYYY-MM format, optional)' }
          },
          required: ['propertyId', 'siteUrl']
        }
      },
      {
        name: 'agent.processRequest',
        description: 'Process request through agent governance (Conductor → Critic → Specialists)',
        inputSchema: {
          type: 'object',
          properties: {
            userId: { type: 'string', description: 'User identifier' },
            sessionId: { type: 'string', description: 'Session identifier' },
            request: { type: 'string', description: 'The request to process' },
            context: { type: 'object', description: 'Additional context for the request', default: {} }
          },
          required: ['userId', 'sessionId', 'request']
        }
      },
      {
        name: 'agent.delegateToAgent',
        description: 'Delegate directly to a specific agent',
        inputSchema: {
          type: 'object',
          properties: {
            agentType: { type: 'string', description: 'The agent type to delegate to' },
            prompt: { type: 'string', description: 'The prompt for the agent' },
            userId: { type: 'string', description: 'User identifier' },
            sessionId: { type: 'string', description: 'Session identifier' },
            context: { type: 'object', description: 'Additional context', default: {} }
          },
          required: ['agentType', 'prompt', 'userId', 'sessionId']
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
        name: 'agent.getTaskStatus',
        description: 'Get the status of a delegated task',
        inputSchema: {
          type: 'object',
          properties: {
            taskId: { type: 'string', description: 'The task ID to check' }
          },
          required: ['taskId']
        }
      }
    ];

    res.json({ tools });
  } catch (error) {
    console.error('Error listing tools:', error);
    res.status(500).json({ error: 'Failed to list tools' });
  }
});

// MCP tool execution endpoint
app.post('/mcp/call', async (req, res) => {
  try {
    const { name, arguments: args = {} } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Tool name is required' });
    }

    // Import handlers dynamically to avoid circular dependencies
    const { default: KVHandler } = await import('./modules/mcp/handlers/kv.js');
    const { default: ArtifactsHandler } = await import('./modules/mcp/handlers/artifacts.js');
    const { default: WorkflowHandler } = await import('./modules/mcp/handlers/workflow.js');
    const { default: EventsHandler } = await import('./modules/mcp/handlers/events.js');
    const { GoogleAnalyticsHandler } = await import('./modules/mcp/handlers/google-analytics.js');
    const { default: AgentDelegationHandler } = await import('./modules/mcp/handlers/agent-delegation.js');

    let result;

    // Route to appropriate handler based on tool name
    switch (name) {
      case 'kv.get':
        result = await KVHandler.get(args);
        break;
      case 'kv.set':
        result = await KVHandler.set(args);
        break;
      case 'artifacts.list':
        result = await ArtifactsHandler.list(args);
        break;
      case 'artifacts.get':
        result = await ArtifactsHandler.get(args);
        break;
      case 'artifacts.put':
        result = await ArtifactsHandler.put(args);
        break;
      case 'workflow.start':
        result = await WorkflowHandler.start(args);
        break;
      case 'workflow.status':
        result = await WorkflowHandler.getStatus(args);
        break;
      case 'events.send':
        result = await EventsHandler.send(args);
        break;
      case 'ga.getTopPages':
        result = await GoogleAnalyticsHandler.getTopPages(args);
        break;
      case 'ga.getSearchConsoleData':
        result = await GoogleAnalyticsHandler.getSearchConsoleData(args);
        break;
      case 'ga.analyzeContentOpportunities':
        result = await GoogleAnalyticsHandler.analyzeContentOpportunities(args);
        break;
      case 'ga.generateContentCalendar':
        result = await GoogleAnalyticsHandler.generateContentCalendar(args);
        break;
      case 'agent.processRequest':
        result = await AgentDelegationHandler.processRequest(args);
        break;
      case 'agent.delegateToAgent':
        result = await AgentDelegationHandler.delegateToAgent(args);
        break;
      case 'agent.listAvailableAgents':
        result = await AgentDelegationHandler.listAvailableAgents();
        break;
      case 'agent.getTaskStatus':
        result = await AgentDelegationHandler.getTaskStatus(args.taskId);
        break;
      default:
        return res.status(404).json({ error: `Unknown tool: ${name}` });
    }

    res.json(result);
  } catch (error) {
    console.error('Error executing tool:', error);
    res.status(500).json({
      error: 'Tool execution failed',
      message: error.message
    });
  }
});

// Generic MCP protocol endpoint
app.post('/mcp', async (req, res) => {
  try {
    const { method, params, id = 1 } = req.body;

    if (!method) {
      return res.status(400).json({
        jsonrpc: '2.0',
        id,
        error: { code: -32600, message: 'Method is required' }
      });
    }

    let result;
    const handler = mcpServer.server.requestHandlers.get(method);

    if (!handler) {
      return res.status(404).json({
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: `Method not found: ${method}` }
      });
    }

    // Execute the method
    if (params) {
      result = await handler(params);
    } else {
      result = await handler();
    }

    res.json({
      jsonrpc: '2.0',
      id,
      result
    });
  } catch (error) {
    console.error('MCP protocol error:', error);
    res.status(500).json({
      jsonrpc: '2.0',
      id: req.body.id || 1,
      error: {
        code: -32603,
        message: 'Internal error',
        data: error.message
      }
    });
  }
});

// Error handling
app.use((err, req, res, next) => {
  console.error('HTTP bridge error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// Start HTTP bridge
app.listen(PORT, () => {
  console.log(`🌉 MCP HTTP Bridge running on port ${PORT}`);
  console.log(`🔗 Dashboard should connect to: http://localhost:${PORT}/mcp`);
  console.log(`📋 Tools available at: http://localhost:${PORT}/mcp/tools`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 MCP HTTP Bridge shutting down...');
  process.exit(0);
});

export default app;