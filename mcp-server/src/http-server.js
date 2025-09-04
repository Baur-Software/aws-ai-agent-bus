#!/usr/bin/env node

import 'dotenv/config';
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
import GoogleAnalyticsHandler from './modules/mcp/handlers/google-analytics.js';
import { uiService } from './services/ui-service.js';

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
    ui_enabled: uiService.isEnabled(),
    endpoints: {
      mcp: '/mcp',
      health: '/health',
      info: '/info',
      ...(uiService.isEnabled() ? {
        ui_dashboard: '/ui/dashboard',
        ui_analytics: '/ui/analytics',
        ui_setup: '/ui/setup'
      } : {})
    }
  });
});

// UI Routes (only enabled if MCP_UI_ENABLED=true)
if (uiService.isEnabled()) {
  // Main dashboard route
  app.get('/ui/dashboard', (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>AWS AI Agent Bus - Dashboard</title>
        <meta charset="utf-8">
        <style>
          body { font-family: system-ui, sans-serif; margin: 0; padding: 20px; background: #f8fafc; }
          .container { max-width: 1200px; margin: 0 auto; }
          .header { background: white; padding: 24px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 24px; }
          .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
          .card { background: white; padding: 24px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
          .card h3 { margin: 0 0 16px 0; color: #2d3748; }
          .card p { color: #4a5568; line-height: 1.5; margin: 0 0 16px 0; }
          .btn { background: #3182ce; color: white; padding: 12px 24px; border: none; border-radius: 8px; text-decoration: none; display: inline-block; font-weight: 600; }
          .btn:hover { background: #2c5aa0; }
          .status { padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; }
          .status.enabled { background: #d1fae5; color: #059669; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>AWS AI Agent Bus Dashboard</h1>
            <p>Interactive dashboards and analytics for your AI agent system</p>
            <span class="status enabled">UI Service Enabled</span>
          </div>
          
          <div class="grid">
            <div class="card">
              <h3>📊 Google Analytics</h3>
              <p>View interactive reports and analytics dashboards with real-time data from your Google Analytics 4 properties.</p>
              <a href="/ui/analytics/demo" class="btn">View Demo Report</a>
              <a href="/ui/analytics" class="btn" style="margin-left: 8px;">Live Analytics</a>
            </div>
            
            <div class="card">
              <h3>📅 Content Calendar</h3>
              <p>AI-generated content calendars based on your analytics data and content opportunities.</p>
              <a href="/ui/content-calendar/demo" class="btn">View Demo Calendar</a>
              <a href="/ui/content-calendar" class="btn" style="margin-left: 8px;">Generate Calendar</a>
            </div>
            
            <div class="card">
              <h3>⚙️ Setup & Configuration</h3>
              <p>Interactive setup wizard for Google Analytics credentials and system configuration.</p>
              <a href="/ui/setup" class="btn">Setup Wizard</a>
            </div>
            
            <div class="card">
              <h3>🔧 API & Tools</h3>
              <p>Access the MCP API directly or view available tools and their schemas.</p>
              <a href="/info" class="btn">API Info</a>
              <a href="/health" class="btn" style="margin-left: 8px;">Health Check</a>
            </div>
          </div>
        </div>
      </body>
      </html>
    `);
  });

  // Analytics demo route with sample data
  app.get('/ui/analytics/demo', async (req, res) => {
    try {
      // Generate sample data for demo
      const sampleData = [
        { country: 'United States', countryCode: 'US', totalUsers: '15,420', activeUsers: '12,830', engagementRate: '68.0%' },
        { country: 'Canada', countryCode: 'CA', totalUsers: '3,240', activeUsers: '2,890', engagementRate: '72.0%' },
        { country: 'United Kingdom', countryCode: 'GB', totalUsers: '2,890', activeUsers: '2,450', engagementRate: '65.0%' },
        { country: 'Germany', countryCode: 'DE', totalUsers: '2,110', activeUsers: '1,890', engagementRate: '69.0%' },
        { country: 'Australia', countryCode: 'AU', totalUsers: '1,850', activeUsers: '1,540', engagementRate: '71.0%' }
      ];
      
      const sampleMetadata = {
        propertyId: 'properties/demo-property',
        days: 30,
        retrievedAt: new Date().toISOString()
      };
      
      const ui = uiService.generateUIResource('users-by-country', sampleData, sampleMetadata);
      if (ui && ui.resource && ui.resource.text) {
        res.send(ui.resource.text);
      } else if (ui && ui.content && ui.content.htmlString) {
        res.send(ui.content.htmlString);
      } else {
        console.error('UI resource structure:', JSON.stringify(ui, null, 2));
        res.status(500).send('Failed to generate UI resource - unexpected structure');
      }
    } catch (error) {
      console.error('Error generating demo analytics:', error);
      res.status(500).send(`Error generating analytics demo: ${error.message}`);
    }
  });

  // Export routes for analytics data
  app.get('/api/analytics/users-by-country/csv', async (req, res) => {
    const { propertyId, days = 30 } = req.query;
    
    try {
      // Always use sample data for demo - don't call actual GA API
      const result = { data: getSampleData() };
      
      // Generate CSV
      const csvHeaders = ['Rank', 'Country', 'Country Code', 'Total Users', 'Active Users', 'Engagement Rate'];
      const csvRows = result.data.map((item, index) => [
        index + 1,
        item.country,
        item.countryCode,
        item.totalUsers,
        item.activeUsers,
        item.engagementRate
      ]);
      
      const csvContent = [csvHeaders, ...csvRows]
        .map(row => row.map(cell => `"${cell}"`).join(','))
        .join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="users-by-country.csv"');
      res.send(csvContent);
    } catch (error) {
      console.error('CSV export error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // PDF export endpoint
  app.get('/api/analytics/users-by-country/pdf', async (req, res) => {
    const { propertyId, days = 30 } = req.query;
    
    try {
      const result = propertyId 
        ? await GoogleAnalyticsHandler.getTopPages({ propertyId, days: parseInt(days) })
        : { data: getSampleData() };
      
      // Simple PDF generation (you'd want to use a proper PDF library in production)
      const pdfContent = `
        Users by Country Report
        Generated: ${new Date().toISOString()}
        
        ${result.data.map((item, index) => 
          `${index + 1}. ${item.country} (${item.countryCode}): ${item.totalUsers} users, ${item.engagementRate} engagement`
        ).join('\n')}
      `;
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="users-by-country.pdf"');
      res.send(pdfContent); // In production, generate actual PDF
    } catch (error) {
      console.error('PDF export error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Refresh data endpoint
  app.post('/api/analytics/refresh', async (req, res) => {
    const { propertyId, days = 30 } = req.body;
    
    try {
      const result = await GoogleAnalyticsHandler.getTopPages({ 
        propertyId, 
        days: parseInt(days) 
      });
      res.json(result);
    } catch (error) {
      console.error('Refresh data error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Helper function for sample data
  function getSampleData() {
    return [
      { country: 'United States', countryCode: 'US', totalUsers: '15,420', activeUsers: '12,830', engagementRate: '68.0%' },
      { country: 'Canada', countryCode: 'CA', totalUsers: '3,240', activeUsers: '2,890', engagementRate: '72.0%' },
      { country: 'United Kingdom', countryCode: 'GB', totalUsers: '2,890', activeUsers: '2,450', engagementRate: '65.0%' },
      { country: 'Germany', countryCode: 'DE', totalUsers: '2,110', activeUsers: '1,890', engagementRate: '69.0%' },
      { country: 'Australia', countryCode: 'AU', totalUsers: '1,850', activeUsers: '1,540', engagementRate: '71.0%' }
    ];
  }

  // Live analytics route
  app.get('/ui/analytics', async (req, res) => {
    const { propertyId, days = 30 } = req.query;
    
    if (!propertyId) {
      res.send(`
        <html>
        <head><title>Google Analytics - Property Required</title></head>
        <body style="font-family: system-ui, sans-serif; padding: 20px;">
          <h1>Google Analytics Dashboard</h1>
          <p>Please provide a property ID:</p>
          <form>
            <input type="text" name="propertyId" placeholder="properties/123456789" style="padding: 8px; margin-right: 8px;">
            <input type="number" name="days" value="30" min="1" max="365" style="padding: 8px; margin-right: 8px;">
            <button type="submit" style="padding: 8px 16px; background: #3182ce; color: white; border: none; border-radius: 4px;">Generate Report</button>
          </form>
          <p><a href="/ui/analytics/demo">← View Demo with Sample Data</a></p>
          <p><strong>Note:</strong> Live analytics requires AWS credentials and Google Analytics setup. Use the demo for testing.</p>
        </body>
        </html>
      `);
      return;
    }
    
    try {
      const result = await GoogleAnalyticsHandler.getTopPages({ propertyId, days: parseInt(days) });
      if (result.ui && result.ui.resource && result.ui.resource.text) {
        res.send(result.ui.resource.text);
      } else if (result.ui && result.ui.content && result.ui.content.htmlString) {
        res.send(result.ui.content.htmlString);
      } else {
        res.json(result); // Fallback to JSON if no UI
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
      res.send(`
        <html>
        <head><title>Analytics Error</title></head>
        <body style="font-family: system-ui, sans-serif; padding: 20px;">
          <h1>⚠️ Analytics Error</h1>
          <p><strong>Error:</strong> ${error.message}</p>
          <p>This usually means:</p>
          <ul>
            <li>AWS credentials not configured (<code>aws configure</code>)</li>
            <li>Google Analytics credentials not set up</li>
            <li>Invalid property ID</li>
          </ul>
          <p><a href="/ui/analytics/demo">← Try the Demo Version Instead</a></p>
          <p><a href="/ui/dashboard">← Back to Dashboard</a></p>
        </body>
        </html>
      `);
    }
  });

  // Setup wizard route
  app.get('/ui/setup', (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>AWS AI Agent Bus - Setup</title>
        <meta charset="utf-8">
        <style>
          body { font-family: system-ui, sans-serif; margin: 0; padding: 20px; background: #f8fafc; }
          .container { max-width: 800px; margin: 0 auto; }
          .setup-card { background: white; padding: 32px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 24px; }
          .setup-card h2 { margin: 0 0 16px 0; color: #2d3748; }
          .step { background: #f7fafc; padding: 20px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #3182ce; }
          .step h3 { margin: 0 0 12px 0; color: #2d3748; }
          .command { background: #1a202c; color: #e2e8f0; padding: 12px; border-radius: 6px; font-family: monospace; margin: 8px 0; }
          .btn { background: #3182ce; color: white; padding: 12px 24px; border: none; border-radius: 8px; text-decoration: none; display: inline-block; font-weight: 600; }
          .btn:hover { background: #2c5aa0; }
          .status { padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; }
          .status.success { background: #d1fae5; color: #059669; }
          .status.warning { background: #fef3c7; color: #d97706; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="setup-card">
            <h1>🛠️ AWS AI Agent Bus Setup</h1>
            <p>Follow these steps to get your system fully configured:</p>
          </div>

          <div class="setup-card">
            <h2>📊 Current Status</h2>
            <p>UI Service: <span class="status success">✅ Enabled</span></p>
            <p>AWS Region: <span class="status success">✅ us-west-2</span></p>
            <p>Demo Mode: <span class="status success">✅ Working</span></p>
            <p>Google Analytics: <span class="status warning">⚠️ Not Configured</span></p>
          </div>

          <div class="setup-card">
            <h2>1. 🔐 Configure AWS Credentials</h2>
            <div class="step">
              <h3>Install AWS CLI</h3>
              <p>Download and install the AWS CLI from AWS documentation, then configure:</p>
              <div class="command">aws configure</div>
              <p>Enter your AWS Access Key ID, Secret Access Key, region (us-west-2), and output format (json).</p>
            </div>
          </div>

          <div class="setup-card">
            <h2>2. 📈 Setup Google Analytics</h2>
            <div class="step">
              <h3>Interactive Setup</h3>
              <p>Run the automated setup script:</p>
              <div class="command">npm run setup:ga-credentials</div>
              <p>This will guide you through:</p>
              <ul>
                <li>Creating Google Cloud Console OAuth2 credentials</li>
                <li>Completing the OAuth flow</li>
                <li>Storing credentials in AWS Secrets Manager</li>
                <li>Testing the connection</li>
              </ul>
            </div>
          </div>

          <div class="setup-card">
            <h2>3. ✅ Test Everything</h2>
            <div class="step">
              <h3>Try These Commands</h3>
              <div class="command">npm run report:users-by-country-sample</div>
              <p>Test with sample data (no credentials needed)</p>
              
              <div class="command">npm run report:users-by-country</div>
              <p>Test with live Google Analytics data (after setup)</p>
            </div>
          </div>

          <div class="setup-card">
            <h2>🎯 Quick Links</h2>
            <p>Once setup is complete:</p>
            <a href="/ui/analytics/demo" class="btn">📊 Try Demo Dashboard</a>
            <a href="/ui/analytics" class="btn" style="margin-left: 8px;">📈 Live Analytics</a>
            <a href="/ui/dashboard" class="btn" style="margin-left: 8px;">🏠 Main Dashboard</a>
          </div>

          <div class="setup-card">
            <h2>🆘 Troubleshooting</h2>
            <p><strong>AWS Region Error:</strong> Make sure AWS_REGION=us-west-2 in your .env file</p>
            <p><strong>Credentials Error:</strong> Run <code>aws configure</code> and check your keys</p>
            <p><strong>Google Analytics Error:</strong> Use <code>npm run setup:ga-credentials</code> and choose option 3 to test</p>
            <p><strong>Need Help:</strong> Check the <a href="/info">server info</a> or view <a href="https://github.com/Baur-Software/aws-ai-agent-bus">documentation</a></p>
          </div>
        </div>
      </body>
      </html>
    `);
  });

  console.log('🎨 UI routes enabled');
} else {
  console.log('ℹ️  UI routes disabled (set MCP_UI_ENABLED=true to enable)');
}

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