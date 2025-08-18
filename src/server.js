#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
  CallToolRequestSchema, 
  ListToolsRequestSchema 
} from '@modelcontextprotocol/sdk/types.js';

// AWS SDK clients
import { DynamoDBClient, GetItemCommand, PutItemCommand, QueryCommand } from '@aws-sdk/client-dynamodb';
import { S3Client, GetObjectCommand, PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { SFNClient, StartExecutionCommand, DescribeExecutionCommand, ListExecutionsCommand } from '@aws-sdk/client-sfn';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';

// Initialize AWS clients with configurable profile and region
const awsConfig = {
  region: process.env.AWS_REGION || 'us-west-2'
};

// Add profile only if specified in environment
if (process.env.AWS_PROFILE) {
  awsConfig.profile = process.env.AWS_PROFILE;
}

const dynamodb = new DynamoDBClient(awsConfig);
const s3 = new S3Client(awsConfig);
const stepfunctions = new SFNClient(awsConfig);
const eventbridge = new EventBridgeClient(awsConfig);

// Agent mesh configuration - use environment variables with defaults
const AGENT_MESH_CONFIG = {
  env: process.env.AGENT_MESH_ENV || 'dev',
  kvTableName: process.env.AGENT_MESH_KV_TABLE || 'agent-mesh-kv',
  artifactsBucket: process.env.AGENT_MESH_ARTIFACTS_BUCKET || 'agent-mesh-artifacts',
  timelineBucket: process.env.AGENT_MESH_TIMELINE_BUCKET || 'agent-mesh-timeline',
  eventBusName: process.env.AGENT_MESH_EVENT_BUS || 'agent-mesh-events'
};

class AgentMeshMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: 'agent-mesh-mcp',
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
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'mesh_kv_get',
          description: 'Get value from agent mesh key-value store',
          inputSchema: {
            type: 'object',
            properties: {
              key: { type: 'string', description: 'Key to retrieve' }
            },
            required: ['key']
          }
        },
        {
          name: 'mesh_kv_set',
          description: 'Set value in agent mesh key-value store',
          inputSchema: {
            type: 'object',
            properties: {
              key: { type: 'string', description: 'Key to store' },
              value: { type: 'string', description: 'Value to store' },
              ttl_hours: { type: 'number', description: 'TTL in hours (optional)', default: 24 }
            },
            required: ['key', 'value']
          }
        },
        {
          name: 'mesh_artifacts_list',
          description: 'List artifacts in the agent mesh artifacts bucket',
          inputSchema: {
            type: 'object',
            properties: {
              prefix: { type: 'string', description: 'Prefix filter (optional)' }
            }
          }
        },
        {
          name: 'mesh_artifacts_get',
          description: 'Get artifact content from agent mesh',
          inputSchema: {
            type: 'object',
            properties: {
              key: { type: 'string', description: 'Artifact key/path' }
            },
            required: ['key']
          }
        },
        {
          name: 'mesh_artifacts_put',
          description: 'Store artifact in agent mesh',
          inputSchema: {
            type: 'object',
            properties: {
              key: { type: 'string', description: 'Artifact key/path' },
              content: { type: 'string', description: 'Artifact content' },
              content_type: { type: 'string', description: 'Content type', default: 'text/plain' }
            },
            required: ['key', 'content']
          }
        },
        {
          name: 'mesh_timeline_get',
          description: 'Get timeline events from agent mesh',
          inputSchema: {
            type: 'object',
            properties: {
              prefix: { type: 'string', description: 'Timeline prefix filter (optional)' },
              max_keys: { type: 'number', description: 'Max events to return', default: 10 }
            }
          }
        },
        {
          name: 'mesh_event_send',
          description: 'Send event to agent mesh event bus',
          inputSchema: {
            type: 'object',
            properties: {
              detail_type: { type: 'string', description: 'Event detail type' },
              detail: { type: 'object', description: 'Event detail payload' },
              source: { type: 'string', description: 'Event source', default: 'mcp-client' }
            },
            required: ['detail_type', 'detail']
          }
        },
        {
          name: 'mesh_workflow_start',
          description: 'Start agent mesh workflow (when Step Functions is deployed)',
          inputSchema: {
            type: 'object',
            properties: {
              input: { type: 'object', description: 'Workflow input data' },
              name: { type: 'string', description: 'Execution name (optional)' }
            },
            required: ['input']
          }
        },
        {
          name: 'mesh_status',
          description: 'Get agent mesh infrastructure status',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        }
      ]
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'mesh_kv_get':
            return await this.handleKVGet(args);
          case 'mesh_kv_set':
            return await this.handleKVSet(args);
          case 'mesh_artifacts_list':
            return await this.handleArtifactsList(args);
          case 'mesh_artifacts_get':
            return await this.handleArtifactsGet(args);
          case 'mesh_artifacts_put':
            return await this.handleArtifactsPut(args);
          case 'mesh_timeline_get':
            return await this.handleTimelineGet(args);
          case 'mesh_event_send':
            return await this.handleEventSend(args);
          case 'mesh_workflow_start':
            return await this.handleWorkflowStart(args);
          case 'mesh_status':
            return await this.handleStatus(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: `Error executing ${name}: ${error.message}`
          }],
          isError: true
        };
      }
    });
  }

  async handleKVGet({ key }) {
    const command = new GetItemCommand({
      TableName: AGENT_MESH_CONFIG.kvTableName,
      Key: { key: { S: key } }
    });
    
    const response = await dynamodb.send(command);
    const value = response.Item?.value?.S || null;
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ key, value, found: !!value })
      }]
    };
  }

  async handleKVSet({ key, value, ttl_hours = 24 }) {
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
        text: JSON.stringify({ key, value, expires_at: expiresAt, status: 'stored' })
      }]
    };
  }

  async handleArtifactsList({ prefix = '' }) {
    const command = new ListObjectsV2Command({
      Bucket: AGENT_MESH_CONFIG.artifactsBucket,
      Prefix: prefix,
      MaxKeys: 100
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
        })
      }]
    };
  }

  async handleArtifactsGet({ key }) {
    try {
      const command = new GetObjectCommand({
        Bucket: AGENT_MESH_CONFIG.artifactsBucket,
        Key: key
      });
      
      const response = await s3.send(command);
      const content = await response.Body.transformToString();
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            key,
            content,
            content_type: response.ContentType,
            size: response.ContentLength
          })
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error retrieving artifact "${key}": ${error.message}`
        }],
        isError: true
      };
    }
  }

  async handleArtifactsPut({ key, content, content_type = 'text/plain' }) {
    try {
      const command = new PutObjectCommand({
        Bucket: AGENT_MESH_CONFIG.artifactsBucket,
        Key: key,
        Body: content,
        ContentType: content_type
      });
      
      await s3.send(command);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            key,
            bucket: AGENT_MESH_CONFIG.artifactsBucket,
            size: content.length,
            content_type,
            status: 'stored'
          })
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error storing artifact "${key}": ${error.message}`
        }],
        isError: true
      };
    }
  }

  async handleTimelineGet({ prefix = 'timeline/', max_keys = 10 }) {
    const command = new ListObjectsV2Command({
      Bucket: AGENT_MESH_CONFIG.timelineBucket,
      Prefix: prefix,
      MaxKeys: max_keys
    });
    
    const response = await s3.send(command);
    const events = [];
    
    for (const obj of response.Contents || []) {
      try {
        const getCmd = new GetObjectCommand({
          Bucket: AGENT_MESH_CONFIG.timelineBucket,
          Key: obj.Key
        });
        const content = await s3.send(getCmd);
        const eventData = await content.Body.transformToString();
        events.push({
          key: obj.Key,
          timestamp: obj.LastModified,
          data: JSON.parse(eventData)
        });
      } catch (e) {
        // Skip malformed timeline entries
      }
    }
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ timeline_events: events })
      }]
    };
  }

  async handleEventSend({ detail_type, detail, source = 'mcp-client' }) {
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
        })
      }]
    };
  }

  async handleWorkflowStart({ input, name }) {
    // This would need the Step Functions state machine ARN from deployment
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          error: 'Workflow not yet deployed. Deploy medium/workflow workspace first.',
          required: 'Step Functions state machine ARN'
        })
      }]
    };
  }

  async handleStatus() {
    const status = {
      environment: AGENT_MESH_CONFIG.env,
      infrastructure: {
        kv_table: AGENT_MESH_CONFIG.kvTableName,
        artifacts_bucket: AGENT_MESH_CONFIG.artifactsBucket,
        timeline_bucket: AGENT_MESH_CONFIG.timelineBucket,
        event_bus: AGENT_MESH_CONFIG.eventBusName
      },
      region: 'us-west-2',
      timestamp: new Date().toISOString()
    };
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(status, null, 2)
      }]
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    
    await this.server.connect(transport);
    console.error('Agent Mesh MCP Server running on stdio');
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.error('Shutting down server...');
      await this.server.close();
      process.exit(0);
    });
  }
}

// Start the server
const server = new AgentMeshMCPServer();
server.run().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});