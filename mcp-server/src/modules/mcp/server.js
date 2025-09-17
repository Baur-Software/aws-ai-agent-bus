import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
  CallToolRequestSchema, 
  ListToolsRequestSchema,
  ErrorCode,
  McpError
} from '@modelcontextprotocol/sdk/types.js';

import WorkflowHandler from './handlers/workflow.js';
import EventsHandler from './handlers/events.js';
import GoogleAnalyticsHandler from './handlers/google-analytics.js';
import AgentDelegationHandler from './handlers/agent-delegation.js';
import KVHandler from './handlers/kv.js';
import ArtifactsHandler from './handlers/artifacts.js';

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
            description: 'Get a value from the key-value store',
            inputSchema: {
              type: 'object',
              properties: {
                key: {
                  type: 'string',
                  description: 'The key to retrieve'
                }
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
                key: {
                  type: 'string',
                  description: 'The key to set'
                },
                value: {
                  type: 'string',
                  description: 'The value to store'
                },
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
                key: {
                  type: 'string',
                  description: 'The artifact key to retrieve'
                }
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
                key: {
                  type: 'string',
                  description: 'The artifact key'
                },
                content: {
                  type: 'string',
                  description: 'The artifact content'
                },
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
          },
          {
            name: 'ga.getTopPages',
            description: 'Get top performing pages from Google Analytics',
            inputSchema: {
              type: 'object',
              properties: {
                propertyId: {
                  type: 'string',
                  description: 'GA4 property ID'
                },
                days: {
                  type: 'number',
                  description: 'Number of days to analyze (default: 30)',
                  default: 30
                }
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
                siteUrl: {
                  type: 'string',
                  description: 'Website URL in Search Console'
                },
                days: {
                  type: 'number',
                  description: 'Number of days to analyze (default: 30)',
                  default: 30
                }
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
                propertyId: {
                  type: 'string',
                  description: 'GA4 property ID'
                },
                siteUrl: {
                  type: 'string',
                  description: 'Website URL in Search Console'
                }
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
                propertyId: {
                  type: 'string',
                  description: 'GA4 property ID'
                },
                siteUrl: {
                  type: 'string',
                  description: 'Website URL in Search Console'
                },
                targetMonth: {
                  type: 'string',
                  description: 'Target month (YYYY-MM format, optional)'
                }
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
                userId: {
                  type: 'string',
                  description: 'User identifier'
                },
                sessionId: {
                  type: 'string',
                  description: 'Session identifier'
                },
                request: {
                  type: 'string',
                  description: 'The request to process'
                },
                context: {
                  type: 'object',
                  description: 'Additional context for the request',
                  default: {}
                }
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
                agentType: {
                  type: 'string',
                  description: 'The agent type to delegate to'
                },
                prompt: {
                  type: 'string',
                  description: 'The prompt for the agent'
                },
                userId: {
                  type: 'string',
                  description: 'User identifier'
                },
                sessionId: {
                  type: 'string',
                  description: 'Session identifier'
                },
                context: {
                  type: 'object',
                  description: 'Additional context',
                  default: {}
                }
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
                taskId: {
                  type: 'string',
                  description: 'The task ID to check'
                }
              },
              required: ['taskId']
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
            const kvGetResult = await KVHandler.get(args);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(kvGetResult, null, 2)
                }
              ]
            };

          case 'kv.set':
            const kvSetResult = await KVHandler.set(args);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(kvSetResult, null, 2)
                }
              ]
            };

          case 'artifacts.list':
            const artifactsListResult = await ArtifactsHandler.list(args);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(artifactsListResult, null, 2)
                }
              ]
            };

          case 'artifacts.get':
            const artifactsGetResult = await ArtifactsHandler.get(args);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(artifactsGetResult, null, 2)
                }
              ]
            };

          case 'artifacts.put':
            const artifactsPutResult = await ArtifactsHandler.put(args);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(artifactsPutResult, null, 2)
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

          case 'ga.getTopPages':
            const topPagesResult = await GoogleAnalyticsHandler.getTopPages(args);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(topPagesResult, null, 2)
                }
              ]
            };

          case 'ga.getSearchConsoleData':
            const searchConsoleResult = await GoogleAnalyticsHandler.getSearchConsoleData(args);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(searchConsoleResult, null, 2)
                }
              ]
            };

          case 'ga.analyzeContentOpportunities':
            const analysisResult = await GoogleAnalyticsHandler.analyzeContentOpportunities(args);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(analysisResult, null, 2)
                }
              ]
            };

          case 'ga.generateContentCalendar':
            const calendarResult = await GoogleAnalyticsHandler.generateContentCalendar(args);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(calendarResult, null, 2)
                }
              ]
            };

          case 'agent.processRequest':
            const processResult = await AgentDelegationHandler.processRequest(args);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(processResult, null, 2)
                }
              ]
            };

          case 'agent.delegateToAgent':
            const delegateResult = await AgentDelegationHandler.delegateToAgent(args);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(delegateResult, null, 2)
                }
              ]
            };

          case 'agent.listAvailableAgents':
            const agentsList = await AgentDelegationHandler.listAvailableAgents();
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({ agents: agentsList }, null, 2)
                }
              ]
            };

          case 'agent.getTaskStatus':
            const taskStatus = await AgentDelegationHandler.getTaskStatus(args.taskId);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(taskStatus, null, 2)
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