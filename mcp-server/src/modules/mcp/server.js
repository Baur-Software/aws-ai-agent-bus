import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
  CallToolRequestSchema, 
  ListToolsRequestSchema,
  ErrorCode,
  McpError
} from '@modelcontextprotocol/sdk/types.js';

import KVHandler from './handlers/kv.js';
import ArtifactsHandler from './handlers/artifacts.js';
import WorkflowHandler from './handlers/workflow.js';
import EventsHandler from './handlers/events.js';

export class AgentMeshMCPServer {
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
    // Set up request handlers
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
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
        ]
      };
    });

    // Set up tool call handlers
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'kv.get':
            const getResult = await KVHandler.get(args);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(getResult, null, 2)
                }
              ]
            };

          case 'kv.set':
            const setResult = await KVHandler.set(args);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(setResult, null, 2)
                }
              ]
            };

          case 'artifacts.list':
            const listResult = await ArtifactsHandler.list(args);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(listResult, null, 2)
                }
              ]
            };

          case 'artifacts.get':
            const artifactGetResult = await ArtifactsHandler.get(args);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(artifactGetResult, null, 2)
                }
              ]
            };

          case 'artifacts.put':
            const artifactPutResult = await ArtifactsHandler.put(args);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(artifactPutResult, null, 2)
                }
              ]
            };

          case 'workflow.start':
            const workflowStartResult = await WorkflowHandler.start(args);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(workflowStartResult, null, 2)
                }
              ]
            };

          case 'workflow.status':
            const workflowStatusResult = await WorkflowHandler.getStatus(args);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(workflowStatusResult, null, 2)
                }
              ]
            };

          case 'events.send':
            const eventResult = await EventsHandler.send(args);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(eventResult, null, 2)
                }
              ]
            };

          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
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
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.log('Agent Mesh MCP Server running on stdio');
    return this.server;
  }
}

export default AgentMeshMCPServer;