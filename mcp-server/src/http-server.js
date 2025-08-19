#!/usr/bin/env node

import express from 'express';
import cors from 'cors';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { 
  CallToolRequestSchema, 
  ListToolsRequestSchema,
  ErrorCode,
  McpError
} from '@modelcontextprotocol/sdk/types.js';

import KVHandler from './modules/mcp/handlers/kv.js';
import ArtifactsHandler from './modules/mcp/handlers/artifacts.js';
import WorkflowHandler from './modules/mcp/handlers/workflow.js';
import EventsHandler from './modules/mcp/handlers/events.js';

// Shared tool definitions to avoid duplication
const TOOL_DEFINITIONS = [
  {
    name: 'kv.get',
    description: 'Get a value by key from the key-value store',
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
        ttl_hours: { 
          type: 'number', 
          description: 'Time to live in hours (default: 24)',
          default: 24
        }
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
        prefix: { 
          type: 'string', 
          description: 'Optional prefix to filter artifacts',
          default: ''
        }
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
        content_type: { 
          type: 'string', 
          description: 'The content type',
          default: 'text/plain'
        }
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
        name: { 
          type: 'string', 
          description: 'The name of the workflow to start'
        },
        input: {
          type: 'object',
          description: 'Input data for the workflow',
          default: {}
        }
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
        executionArn: { 
          type: 'string', 
          description: 'The execution ARN of the workflow'
        }
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
        detailType: { 
          type: 'string', 
          description: 'The event type'
        },
        detail: {
          type: 'object',
          description: 'The event details'
        },
        source: {
          type: 'string',
          description: 'The event source',
          default: 'mcp-client'
        }
      },
      required: ['detailType', 'detail']
    }
  }
];

// Create MCP server using same architecture as stdio server
class AgentMeshHTTPServer {
  constructor() {
    this.server = new Server(
      {
        name: 'agent-mesh-mcp-http',
        version: '1.0.0'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );

    this.setupToolHandlers();
  }

  setupToolHandlers() {
    // Set up request handlers - same as stdio server
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: TOOL_DEFINITIONS
      };
    });

    // Set up tool call handlers - same as stdio server
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      return await this.executeToolCall(request.params.name, request.params.arguments);
    });
  }

  async executeToolCall(name, args) {
    try {
      let result;
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
        default:
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${name}`
          );
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    } catch (error) {
      if (error instanceof McpError) {
        throw error;
      }
      
      return {
        content: [
          {
            type: 'text',
            text: `Error executing tool '${name}': ${error.message}`
          }
        ],
        isError: true
      };
    }
  }

  // Direct methods for HTTP requests
  async getToolsList() {
    return {
      tools: TOOL_DEFINITIONS
    };
  }

  async callTool(name, args) {
    return await this.executeToolCall(name, args);
  }
}

// Express app setup
const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Create single MCP server instance
const mcpServer = new AgentMeshHTTPServer();
console.log('Agent Mesh HTTP MCP Server created');

// Simple HTTP-JSON-RPC bridge
app.post('/mcp', async (req, res) => {
  try {
    console.log('📨 Received MCP request:', req.body.method);
    
    // Handle initialize requests
    if (req.body.method === 'initialize') {
      const result = {
        jsonrpc: '2.0',
        id: req.body.id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {}
          },
          serverInfo: {
            name: 'agent-mesh-mcp-http',
            version: '1.0.0'
          }
        }
      };
      
      console.log('✅ Initialize successful');
      return res.json(result);
    }

    // Handle tools/list requests
    if (req.body.method === 'tools/list') {
      const toolsResult = await mcpServer.getToolsList();
      
      const result = {
        jsonrpc: '2.0',
        id: req.body.id,
        result: toolsResult
      };
      
      console.log('✅ Tools list successful');
      return res.json(result);
    }

    // Handle tools/call requests
    if (req.body.method === 'tools/call') {
      const toolResult = await mcpServer.callTool(req.body.params.name, req.body.params.arguments);
      
      const result = {
        jsonrpc: '2.0',
        id: req.body.id,
        result: toolResult
      };
      
      console.log('✅ Tool call successful:', req.body.params.name);
      return res.json(result);
    }

    // Unknown method
    return res.status(400).json({
      jsonrpc: '2.0',
      id: req.body.id,
      error: {
        code: -32601,
        message: `Method not found: ${req.body.method}`
      }
    });

  } catch (error) {
    console.error('❌ MCP request error:', error);
    
    return res.status(500).json({
      jsonrpc: '2.0',
      id: req.body.id || null,
      error: {
        code: -32603,
        message: `Internal error: ${error.message}`
      }
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    server: 'agent-mesh-mcp-http',
    version: '1.0.0'
  });
});

// Server info endpoint
app.get('/info', (req, res) => {
  res.json({
    name: 'agent-mesh-mcp-http',
    version: '1.0.0',
    protocol: 'MCP over HTTP JSON-RPC',
    endpoints: {
      mcp: '/mcp',
      health: '/health',
      info: '/info'
    }
  });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🚀 Agent Mesh MCP HTTP Server listening on port ${port}`);
  console.log(`💚 Health check: http://localhost:${port}/health`);
  console.log(`📋 Server info: http://localhost:${port}/info`);
  console.log(`🔌 MCP endpoint: http://localhost:${port}/mcp`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('👋 Shutting down HTTP server...');
  process.exit(0);
});