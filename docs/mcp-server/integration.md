# Integration Guide

This guide covers integrating the Agent Mesh MCP Server with various platforms, frameworks, and AI systems.

## Table of Contents

- [Claude Desktop Integration](#claude-desktop-integration)
- [Web Application Integration](#web-application-integration)
- [Node.js Application Integration](#nodejs-application-integration)
- [Python Integration](#python-integration)
- [Automation & Workflows](#automation--workflows)
- [Custom MCP Clients](#custom-mcp-clients)

## Claude Desktop Integration

### Configuration

Add the MCP server to your Claude Desktop configuration file (`~/.config/claude-desktop/settings.json`):

```json
{
  "mcpServers": {
    "aws-agent-mesh": {
      "command": "node",
      "args": ["src/server.js"],
      "cwd": "/path/to/aws-ai-agent-bus/mcp-server",
      "env": {
        "AWS_REGION": "us-west-2",
        "AWS_PROFILE": "your-aws-profile",
        "DYNAMODB_TABLE": "agent-mesh-prod-kv",
        "S3_BUCKET": "agent-mesh-prod-artifacts",
        "EVENT_BUS_NAME": "agent-mesh-prod",
        "GOOGLE_ANALYTICS_SECRET": "prod/google-analytics",
        "NODE_ENV": "production"
      }
    }
  }
}
```

### Environment-Specific Configurations

#### Development Environment

```json
{
  "aws-agent-mesh-dev": {
    "command": "npm",
    "args": ["run", "dev"],
    "cwd": "/path/to/aws-ai-agent-bus/mcp-server",
    "env": {
      "NODE_ENV": "development",
      "AWS_REGION": "us-west-2",
      "DYNAMODB_TABLE": "agent-mesh-dev-kv",
      "S3_BUCKET": "agent-mesh-dev-artifacts",
      "EVENT_BUS_NAME": "agent-mesh-dev",
      "LOG_LEVEL": "debug"
    }
  }
}
```

#### Production Environment

```json
{
  "aws-agent-mesh-prod": {
    "command": "node",
    "args": ["src/server.js"],
    "cwd": "/path/to/aws-ai-agent-bus/mcp-server",
    "env": {
      "NODE_ENV": "production",
      "AWS_REGION": "us-west-2",
      "DYNAMODB_TABLE": "agent-mesh-prod-kv",
      "S3_BUCKET": "agent-mesh-prod-artifacts",
      "EVENT_BUS_NAME": "agent-mesh-prod",
      "GOOGLE_ANALYTICS_SECRET": "prod/google-analytics",
      "LOG_LEVEL": "warn"
    }
  }
}
```

### Usage in Claude Desktop

Once configured, you can use natural language to interact with your analytics and infrastructure:

```
User: "What are my top performing blog posts this month?"
Claude: [Uses mcp__aws__ga_getTopPages to fetch analytics data]

User: "Generate a content calendar for next month based on my analytics"
Claude: [Uses mcp__aws__ga_generateContentCalendar to create actionable content plan]

User: "Store this analysis report in my artifacts bucket"
Claude: [Uses mcp__aws__artifacts_put to save the report]
```

## Web Application Integration

### HTTP Server Mode

Start the MCP server in HTTP mode for web integrations:

```bash
npm run start:http
```

This provides REST-like endpoints for MCP operations.

### Frontend JavaScript Integration

```javascript
class MCPAnalyticsClient {
  constructor(baseUrl = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
    this.sessionId = null;
  }

  async initialize() {
    // Create MCP session
    const response = await fetch(`${this.baseUrl}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '0.1.0',
          capabilities: {},
          clientInfo: {
            name: 'web-analytics-dashboard',
            version: '1.0.0'
          }
        }
      })
    });

    const result = await response.json();
    this.sessionId = result.id;
    return result;
  }

  async getTopPages(propertyId, days = 30) {
    const response = await fetch(`${this.baseUrl}/mcp`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-Session-ID': this.sessionId
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: {
          name: 'mcp__aws__ga_getTopPages',
          arguments: { propertyId, days }
        }
      })
    });

    const result = await response.json();
    return result.result;
  }

  async generateContentCalendar(propertyId, siteUrl, targetMonth) {
    const response = await fetch(`${this.baseUrl}/mcp`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-Session-ID': this.sessionId
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: {
          name: 'mcp__aws__ga_generateContentCalendar',
          arguments: { propertyId, siteUrl, targetMonth }
        }
      })
    });

    const result = await response.json();
    return result.result;
  }
}

// Usage in React component
function AnalyticsDashboard() {
  const [mcpClient, setMcpClient] = useState(null);
  const [topPages, setTopPages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function initializeAnalytics() {
      const client = new MCPAnalyticsClient();
      await client.initialize();
      setMcpClient(client);

      const pages = await client.getTopPages('properties/123456789');
      setTopPages(pages.data);
      setLoading(false);
    }

    initializeAnalytics();
  }, []);

  if (loading) return <div>Loading analytics...</div>;

  return (
    <div>
      <h2>Top Performing Pages</h2>
      {topPages.map((page, index) => (
        <div key={index} className="page-metric">
          <h3>{page.pageTitle}</h3>
          <p>Sessions: {page.sessions}</p>
          <p>Pageviews: {page.pageviews}</p>
          <p>Bounce Rate: {(page.bounceRate * 100).toFixed(1)}%</p>
        </div>
      ))}
    </div>
  );
}
```

### Express.js Middleware

```javascript
const express = require('express');
const { MCPClient } = require('@modelcontextprotocol/client');

class MCPMiddleware {
  constructor() {
    this.client = new MCPClient();
  }

  async initialize() {
    // Initialize MCP client connection
    await this.client.connect();
  }

  // Middleware to add MCP client to request
  middleware() {
    return (req, res, next) => {
      req.mcp = this.client;
      next();
    };
  }
}

const app = express();
const mcpMiddleware = new MCPMiddleware();

app.use(express.json());
app.use(mcpMiddleware.middleware());

// Analytics API endpoint
app.get('/api/analytics/top-pages', async (req, res) => {
  try {
    const { propertyId, days = 30 } = req.query;
    
    const result = await req.mcp.request({
      method: 'tools/call',
      params: {
        name: 'mcp__aws__ga_getTopPages',
        arguments: { propertyId, days: parseInt(days) }
      }
    });

    res.json(result.result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Content calendar API endpoint
app.post('/api/content/calendar', async (req, res) => {
  try {
    const { propertyId, siteUrl, targetMonth } = req.body;
    
    const result = await req.mcp.request({
      method: 'tools/call',
      params: {
        name: 'mcp__aws__ga_generateContentCalendar',
        arguments: { propertyId, siteUrl, targetMonth }
      }
    });

    res.json(result.result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(3001, async () => {
  await mcpMiddleware.initialize();
  console.log('Express server with MCP integration running on port 3001');
});
```

## Node.js Application Integration

### Stdio MCP Client

```javascript
const { spawn } = require('child_process');
const { MCPClient } = require('@modelcontextprotocol/client');

class NodeMCPAnalytics {
  constructor(serverPath) {
    this.serverPath = serverPath;
    this.client = null;
    this.serverProcess = null;
  }

  async connect() {
    // Start MCP server process
    this.serverProcess = spawn('node', ['src/server.js'], {
      cwd: this.serverPath,
      stdio: ['pipe', 'pipe', 'inherit'],
      env: {
        ...process.env,
        AWS_REGION: 'us-west-2',
        DYNAMODB_TABLE: 'agent-mesh-prod-kv',
        S3_BUCKET: 'agent-mesh-prod-artifacts'
      }
    });

    // Create MCP client connected to server process
    this.client = new MCPClient({
      transport: {
        stdin: this.serverProcess.stdin,
        stdout: this.serverProcess.stdout
      }
    });

    await this.client.connect();
    return this.client;
  }

  async getAnalytics(propertyId, days = 30) {
    const [topPages, keywords, opportunities] = await Promise.all([
      this.client.request({
        method: 'tools/call',
        params: {
          name: 'mcp__aws__ga_getTopPages',
          arguments: { propertyId, days }
        }
      }),
      this.client.request({
        method: 'tools/call',
        params: {
          name: 'mcp__aws__ga_getSearchConsoleData',
          arguments: { siteUrl: 'https://example.com', days }
        }
      }),
      this.client.request({
        method: 'tools/call',
        params: {
          name: 'mcp__aws__ga_analyzeContentOpportunities',
          arguments: { propertyId, siteUrl: 'https://example.com' }
        }
      })
    ]);

    return {
      topPages: topPages.result.data,
      keywords: keywords.result.data,
      opportunities: opportunities.result.insights
    };
  }

  async generateReport(analytics) {
    const reportData = {
      generated: new Date().toISOString(),
      summary: {
        totalPages: analytics.topPages.length,
        totalKeywords: analytics.keywords.length,
        opportunities: analytics.opportunities.keywordOpportunities?.length || 0
      },
      data: analytics
    };

    const stored = await this.client.request({
      method: 'tools/call',
      params: {
        name: 'mcp__aws__artifacts_put',
        arguments: {
          key: `reports/${new Date().toISOString().split('T')[0]}-analytics.json`,
          content: JSON.stringify(reportData, null, 2),
          content_type: 'application/json'
        }
      }
    });

    return stored.result;
  }

  async disconnect() {
    if (this.client) {
      await this.client.disconnect();
    }
    if (this.serverProcess) {
      this.serverProcess.kill();
    }
  }
}

// Usage example
async function runAnalyticsReport() {
  const analytics = new NodeMCPAnalytics('/path/to/aws-ai-agent-bus/mcp-server');
  
  try {
    await analytics.connect();
    
    const data = await analytics.getAnalytics('properties/123456789');
    console.log('Analytics data retrieved:', {
      pages: data.topPages.length,
      keywords: data.keywords.length
    });

    const report = await analytics.generateReport(data);
    console.log('Report saved:', report.key);
    
  } finally {
    await analytics.disconnect();
  }
}

runAnalyticsReport().catch(console.error);
```

## Python Integration

### Python MCP Client

```python
import asyncio
import json
import subprocess
from typing import Dict, Any, Optional

class PythonMCPClient:
    def __init__(self, server_path: str):
        self.server_path = server_path
        self.process = None
        
    async def connect(self):
        """Start the MCP server and establish connection."""
        self.process = await asyncio.create_subprocess_exec(
            'node', 'src/server.js',
            cwd=self.server_path,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env={
                **os.environ,
                'AWS_REGION': 'us-west-2',
                'DYNAMODB_TABLE': 'agent-mesh-prod-kv',
                'S3_BUCKET': 'agent-mesh-prod-artifacts'
            }
        )
        
        # Initialize MCP protocol
        init_msg = {
            'jsonrpc': '2.0',
            'id': 1,
            'method': 'initialize',
            'params': {
                'protocolVersion': '0.1.0',
                'capabilities': {},
                'clientInfo': {
                    'name': 'python-analytics-client',
                    'version': '1.0.0'
                }
            }
        }
        
        await self._send_message(init_msg)
        response = await self._receive_message()
        return response
        
    async def _send_message(self, message: Dict[str, Any]):
        """Send JSON-RPC message to MCP server."""
        msg_str = json.dumps(message) + '\n'
        self.process.stdin.write(msg_str.encode())
        await self.process.stdin.drain()
        
    async def _receive_message(self) -> Dict[str, Any]:
        """Receive JSON-RPC message from MCP server."""
        line = await self.process.stdout.readline()
        return json.loads(line.decode())
        
    async def call_tool(self, tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Call an MCP tool with arguments."""
        message = {
            'jsonrpc': '2.0',
            'id': asyncio.get_event_loop().time(),
            'method': 'tools/call',
            'params': {
                'name': tool_name,
                'arguments': arguments
            }
        }
        
        await self._send_message(message)
        response = await self._receive_message()
        return response.get('result', {})
        
    async def get_top_pages(self, property_id: str, days: int = 30) -> list:
        """Get top performing pages from Google Analytics."""
        result = await self.call_tool('mcp__aws__ga_getTopPages', {
            'propertyId': property_id,
            'days': days
        })
        return result.get('data', [])
        
    async def generate_content_calendar(self, property_id: str, site_url: str, target_month: Optional[str] = None) -> dict:
        """Generate content calendar based on analytics."""
        args = {
            'propertyId': property_id,
            'siteUrl': site_url
        }
        if target_month:
            args['targetMonth'] = target_month
            
        result = await self.call_tool('mcp__aws__ga_generateContentCalendar', args)
        return result.get('calendar', {})
        
    async def disconnect(self):
        """Close connection and terminate server process."""
        if self.process:
            self.process.terminate()
            await self.process.wait()

# Usage example
async def run_analytics_pipeline():
    client = PythonMCPClient('/path/to/aws-ai-agent-bus/mcp-server')
    
    try:
        await client.connect()
        
        # Get analytics data
        top_pages = await client.get_top_pages('properties/123456789')
        print(f"Retrieved {len(top_pages)} top pages")
        
        # Generate content calendar
        calendar = await client.generate_content_calendar(
            'properties/123456789',
            'https://example.com',
            '2024-09'
        )
        print(f"Generated calendar with {len(calendar.get('items', []))} content items")
        
        # Process results
        for item in calendar.get('items', [])[:5]:  # Show first 5 items
            print(f"- {item['dueDate']}: {item['title']} ({item['type']})")
            
    finally:
        await client.disconnect()

# Run the pipeline
if __name__ == "__main__":
    asyncio.run(run_analytics_pipeline())
```

### Flask Web Application

```python
from flask import Flask, jsonify, request
import asyncio
from python_mcp_client import PythonMCPClient

app = Flask(__name__)
mcp_client = None

@app.before_first_request
async def initialize_mcp():
    global mcp_client
    mcp_client = PythonMCPClient('/path/to/aws-ai-agent-bus/mcp-server')
    await mcp_client.connect()

@app.route('/api/analytics/top-pages')
async def get_top_pages():
    try:
        property_id = request.args.get('propertyId')
        days = int(request.args.get('days', 30))
        
        pages = await mcp_client.get_top_pages(property_id, days)
        return jsonify({
            'success': True,
            'data': pages
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/content/calendar', methods=['POST'])
async def generate_calendar():
    try:
        data = request.json
        calendar = await mcp_client.generate_content_calendar(
            data['propertyId'],
            data['siteUrl'],
            data.get('targetMonth')
        )
        return jsonify({
            'success': True,
            'calendar': calendar
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
```

## Automation & Workflows

### Scheduled Analytics Reports

```bash
#!/bin/bash
# daily-analytics-report.sh

cd /path/to/aws-ai-agent-bus/mcp-server

# Start MCP server in background
npm start &
MCP_PID=$!

# Wait for server to start
sleep 5

# Run analytics collection script
node scripts/collect-daily-analytics.js

# Generate report
node scripts/generate-report.js

# Send to team (example with Slack webhook)
curl -X POST -H 'Content-type: application/json' \
  --data '{"text":"Daily analytics report generated and stored in S3"}' \
  $SLACK_WEBHOOK_URL

# Cleanup
kill $MCP_PID
```

### GitHub Actions Integration

```yaml
name: Weekly Analytics Report
on:
  schedule:
    - cron: '0 9 * * 1'  # Every Monday at 9 AM

jobs:
  generate-report:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        
    - name: Install dependencies
      run: |
        cd mcp-server
        npm install
        
    - name: Configure AWS credentials
      uses: aws-actions/configure-aws-credentials@v2
      with:
        aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
        aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        aws-region: us-west-2
        
    - name: Generate weekly report
      run: |
        cd mcp-server
        node scripts/weekly-report.js
      env:
        DYNAMODB_TABLE: agent-mesh-prod-kv
        S3_BUCKET: agent-mesh-prod-artifacts
        GOOGLE_ANALYTICS_SECRET: prod/google-analytics
        
    - name: Notify team
      uses: 8398a7/action-slack@v3
      with:
        status: success
        text: 'Weekly analytics report generated successfully'
      env:
        SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

## Custom MCP Clients

### Building a Custom Dashboard Client

```javascript
// custom-dashboard-client.js
const { EventEmitter } = require('events');

class DashboardMCPClient extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.tools = new Map();
    this.cache = new Map();
  }

  // Register custom tools
  registerTool(name, handler) {
    this.tools.set(name, handler);
  }

  // Enhanced caching with event emission
  async callToolWithCache(toolName, args, cacheMinutes = 10) {
    const cacheKey = `${toolName}:${JSON.stringify(args)}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < cacheMinutes * 60 * 1000) {
      this.emit('cache-hit', { toolName, args });
      return cached.result;
    }

    this.emit('cache-miss', { toolName, args });
    
    const result = await this.callTool(toolName, args);
    this.cache.set(cacheKey, {
      result,
      timestamp: Date.now()
    });

    this.emit('data-updated', { toolName, args, result });
    return result;
  }

  // Batch operations
  async batchAnalytics(propertyId, siteUrl, days = 30) {
    this.emit('batch-start', { propertyId, siteUrl, days });

    const operations = [
      { tool: 'mcp__aws__ga_getTopPages', args: { propertyId, days } },
      { tool: 'mcp__aws__ga_getSearchConsoleData', args: { siteUrl, days } },
      { tool: 'mcp__aws__ga_analyzeContentOpportunities', args: { propertyId, siteUrl } }
    ];

    const results = await Promise.allSettled(
      operations.map(op => this.callToolWithCache(op.tool, op.args))
    );

    const batchResult = {
      topPages: results[0].status === 'fulfilled' ? results[0].value : null,
      keywords: results[1].status === 'fulfilled' ? results[1].value : null,
      opportunities: results[2].status === 'fulfilled' ? results[2].value : null,
      errors: results.filter(r => r.status === 'rejected').map(r => r.reason)
    };

    this.emit('batch-complete', batchResult);
    return batchResult;
  }
}

// Usage with real-time dashboard
const dashboardClient = new DashboardMCPClient();

dashboardClient.on('data-updated', ({ toolName, result }) => {
  console.log(`Tool ${toolName} returned updated data:`, result);
  // Update dashboard UI
  updateDashboard(toolName, result);
});

dashboardClient.on('cache-hit', ({ toolName }) => {
  console.log(`Using cached data for ${toolName}`);
});

dashboardClient.on('batch-complete', (results) => {
  console.log('Batch analytics complete:', {
    success: !results.errors.length,
    pages: results.topPages?.data?.length || 0,
    keywords: results.keywords?.data?.length || 0,
    opportunities: results.opportunities?.keywordOpportunities?.length || 0
  });
});
```

## Error Handling & Resilience

### Retry Logic

```javascript
class ResilientMCPClient {
  constructor(client) {
    this.client = client;
    this.maxRetries = 3;
    this.baseDelay = 1000;
  }

  async callWithRetry(toolName, args, options = {}) {
    const { retries = this.maxRetries, delay = this.baseDelay } = options;
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await this.client.request({
          method: 'tools/call',
          params: { name: toolName, arguments: args }
        });
      } catch (error) {
        if (attempt === retries) {
          throw error;
        }

        // Exponential backoff with jitter
        const backoffDelay = delay * Math.pow(2, attempt) + Math.random() * 1000;
        console.log(`Attempt ${attempt + 1} failed, retrying in ${backoffDelay}ms...`);
        
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
      }
    }
  }

  async callWithFallback(toolName, args, fallbackFn) {
    try {
      return await this.callWithRetry(toolName, args);
    } catch (error) {
      console.warn(`Tool ${toolName} failed, using fallback:`, error.message);
      return await fallbackFn(error);
    }
  }
}
```

## Performance Monitoring

### Integration Metrics

```javascript
class MCPMetrics {
  constructor() {
    this.metrics = {
      calls: 0,
      errors: 0,
      totalLatency: 0,
      toolUsage: new Map()
    };
  }

  async instrumentedCall(client, toolName, args) {
    const start = Date.now();
    this.metrics.calls++;
    
    const usage = this.metrics.toolUsage.get(toolName) || 0;
    this.metrics.toolUsage.set(toolName, usage + 1);

    try {
      const result = await client.request({
        method: 'tools/call',
        params: { name: toolName, arguments: args }
      });
      
      const latency = Date.now() - start;
      this.metrics.totalLatency += latency;
      
      return result;
    } catch (error) {
      this.metrics.errors++;
      throw error;
    }
  }

  getStats() {
    return {
      totalCalls: this.metrics.calls,
      errorRate: this.metrics.errors / this.metrics.calls,
      averageLatency: this.metrics.totalLatency / this.metrics.calls,
      mostUsedTool: [...this.metrics.toolUsage.entries()].sort((a, b) => b[1] - a[1])[0]
    };
  }
}
```

This integration guide provides comprehensive examples for connecting the MCP server with various platforms and use cases. For specific deployment scenarios, refer to the [SETUP.md](SETUP.md) guide for detailed configuration instructions.
