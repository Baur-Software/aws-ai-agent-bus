#!/usr/bin/env node

import express from 'express';
import cors from 'cors';
import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

// AWS SDK clients
import { DynamoDBClient, GetItemCommand, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { S3Client, GetObjectCommand, PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';

// AWS configuration
const awsConfig = {
  region: process.env.AWS_REGION || 'us-west-2'
};

// Add profile only if specified in environment
if (process.env.AWS_PROFILE) {
  awsConfig.profile = process.env.AWS_PROFILE;
}

const dynamodb = new DynamoDBClient(awsConfig);
const s3 = new S3Client(awsConfig);
const eventbridge = new EventBridgeClient(awsConfig);

// Agent mesh configuration - use environment variables with defaults
const AGENT_MESH_CONFIG = {
  env: process.env.AGENT_MESH_ENV || 'dev',
  kvTableName: process.env.AGENT_MESH_KV_TABLE || 'agent-mesh-kv',
  artifactsBucket: process.env.AGENT_MESH_ARTIFACTS_BUCKET || 'agent-mesh-artifacts',
  timelineBucket: process.env.AGENT_MESH_TIMELINE_BUCKET || 'agent-mesh-timeline',
  eventBusName: process.env.AGENT_MESH_EVENT_BUS || 'agent-mesh-events'
};

// Create MCP server factory
const createMCPServer = () => {
  const server = new McpServer({
    name: 'agent-mesh-mcp-http',
    version: '2.0.0'
  }, {
    capabilities: {
      tools: { listChanged: true },
      resources: { listChanged: true },
      logging: {}
    }
  });

  // Register tools
  server.registerTool(
    'mesh_kv_get',
    {
      title: 'Get KV Value',
      description: 'Get value from agent mesh key-value store',
      inputSchema: {
        key: z.string().describe('Key to retrieve')
      }
    },
    async ({ key }) => {
      try {
        const command = new GetItemCommand({
          TableName: AGENT_MESH_CONFIG.kvTableName,
          Key: { key: { S: key } }
        });
        
        const response = await dynamodb.send(command);
        const value = response.Item?.value?.S || null;
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ key, value, found: !!value }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: `Error retrieving key "${key}": ${error.message}`
          }],
          isError: true
        };
      }
    }
  );

  server.registerTool(
    'mesh_kv_set',
    {
      title: 'Set KV Value',
      description: 'Set value in agent mesh key-value store',
      inputSchema: {
        key: z.string().describe('Key to store'),
        value: z.string().describe('Value to store'),
        ttl_hours: z.number().optional().default(24).describe('TTL in hours')
      }
    },
    async ({ key, value, ttl_hours }) => {
      try {
        const expiresAt = Math.floor(Date.now() / 1000) + (ttl_hours * 3600);
        
        const command = new PutItemCommand({
          TableName: AGENT_MESH_CONFIG.kvTableName,
          Item: {
            key: { S: key },
            value: { S: value },
            expires_at: { N: expiresAt.toString() },
            created_at: { S: new Date().toISOString() }
          }
        });
        
        await dynamodb.send(command);
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ 
              key, 
              value, 
              expires_at: expiresAt, 
              status: 'stored',
              expires_in_hours: ttl_hours
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: `Error storing key "${key}": ${error.message}`
          }],
          isError: true
        };
      }
    }
  );

  server.registerTool(
    'mesh_artifacts_list',
    {
      title: 'List Artifacts',
      description: 'List artifacts in the agent mesh artifacts bucket',
      inputSchema: {
        prefix: z.string().optional().describe('Prefix filter'),
        max_keys: z.number().optional().default(10).describe('Maximum keys to return')
      }
    },
    async ({ prefix = '', max_keys = 10 }) => {
      try {
        const command = new ListObjectsV2Command({
          Bucket: AGENT_MESH_CONFIG.artifactsBucket,
          Prefix: prefix,
          MaxKeys: max_keys
        });
        
        const response = await s3.send(command);
        const objects = response.Contents || [];
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              bucket: AGENT_MESH_CONFIG.artifactsBucket,
              prefix,
              count: objects.length,
              objects: objects.map(obj => ({
                key: obj.Key,
                size: obj.Size,
                modified: obj.LastModified
              }))
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: `Error listing artifacts: ${error.message}`
          }],
          isError: true
        };
      }
    }
  );

  server.registerTool(
    'mesh_event_send',
    {
      title: 'Send Event',
      description: 'Send event to agent mesh event bus',
      inputSchema: {
        detail_type: z.string().describe('Event detail type'),
        detail: z.record(z.unknown()).describe('Event detail payload'),
        source: z.string().optional().default('mcp-http-client').describe('Event source')
      }
    },
    async ({ detail_type, detail, source }) => {
      try {
        const command = new PutEventsCommand({
          Entries: [{
            Source: source,
            DetailType: detail_type,
            Detail: JSON.stringify(detail),
            EventBusName: AGENT_MESH_CONFIG.eventBusName
          }]
        });
        
        const response = await eventbridge.send(command);
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              event_id: response.Entries?.[0]?.EventId,
              detail_type,
              source,
              status: 'sent'
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: `Error sending event: ${error.message}`
          }],
          isError: true
        };
      }
    }
  );

  // Add config resource
  server.registerResource(
    'mesh-config',
    'config://agent-mesh',
    {
      title: 'Agent Mesh Configuration',
      description: 'Current agent mesh configuration',
      mimeType: 'application/json'
    },
    async () => ({
      contents: [{
        uri: 'config://agent-mesh',
        text: JSON.stringify(AGENT_MESH_CONFIG, null, 2)
      }]
    })
  );

  return server;
};

// Express app setup
const app = express();
app.use(express.json());
app.use(cors({
  origin: '*',
  exposedHeaders: ['Mcp-Session-Id'],
  allowedHeaders: ['Content-Type', 'mcp-session-id']
}));

// Store transports by session ID
const transports = {};

// MCP endpoints
app.post('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'];
  
  try {
    let transport;
    
    if (sessionId && transports[sessionId]) {
      // Use existing transport
      transport = transports[sessionId];
    } else if (!sessionId && isInitializeRequest(req.body)) {
      // Create new transport for initialization
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sessionId) => {
          transports[sessionId] = transport;
          console.log(`Session initialized: ${sessionId}`);
        }
      });

      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid && transports[sid]) {
          delete transports[sid];
          console.log(`Session closed: ${sid}`);
        }
      };

      const server = createMCPServer();
      await server.connect(transport);
    } else {
      return res.status(400).json({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Invalid session or request' },
        id: null
      });
    }

    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error('MCP error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null
      });
    }
  }
});

app.get('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'];
  if (!sessionId || !transports[sessionId]) {
    return res.status(400).send('Invalid session ID');
  }
  
  const transport = transports[sessionId];
  await transport.handleRequest(req, res);
});

app.delete('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'];
  if (!sessionId || !transports[sessionId]) {
    return res.status(400).send('Invalid session ID');
  }
  
  const transport = transports[sessionId];
  await transport.handleRequest(req, res);
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    sessions: Object.keys(transports).length
  });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Agent Mesh MCP HTTP Server listening on port ${port}`);
  console.log(`Health check: http://localhost:${port}/health`);
  console.log(`MCP endpoint: http://localhost:${port}/mcp`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down HTTP server...');
  for (const [sessionId, transport] of Object.entries(transports)) {
    try {
      await transport.close();
      console.log(`Closed session: ${sessionId}`);
    } catch (error) {
      console.error(`Error closing session ${sessionId}:`, error);
    }
  }
  process.exit(0);
});