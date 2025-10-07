# MCP Server Usage Examples

This guide provides practical examples for using the Agent Mesh MCP Server tools in real-world scenarios.

## Quick Start Examples

### Basic Google Analytics Integration

```javascript
// Initialize MCP client and get top pages
const mcpClient = require('your-mcp-client');

async function getContentInsights() {
  // Get top performing pages from GA4
  const topPages = await mcpClient.request({
    method: 'tools/call',
    params: {
      name: 'mcp__aws__ga_getTopPages',
      arguments: {
        propertyId: 'properties/123456789',
        days: 30
      }
    }
  });

  console.log('Top performing content:', topPages.result.data);
  
  // Get Search Console keyword data
  const keywords = await mcpClient.request({
    method: 'tools/call',
    params: {
      name: 'mcp__aws__ga_getSearchConsoleData',
      arguments: {
        siteUrl: 'https://example.com',
        days: 30
      }
    }
  });

  console.log('Top keywords:', keywords.result.data);
}

getContentInsights();
```

### Content Strategy Automation

```javascript
async function generateMonthlyContentPlan() {
  // Analyze content opportunities
  const analysis = await mcpClient.request({
    method: 'tools/call',
    params: {
      name: 'mcp__aws__ga_analyzeContentOpportunities',
      arguments: {
        propertyId: 'properties/123456789',
        siteUrl: 'https://example.com'
      }
    }
  });

  console.log('Content opportunities found:');
  console.log('- Top performing:', analysis.result.insights.topPerformingContent.length);
  console.log('- Keyword opportunities:', analysis.result.insights.keywordOpportunities.length);
  console.log('- Content gaps:', analysis.result.insights.contentGaps.length);

  // Generate actionable content calendar
  const calendar = await mcpClient.request({
    method: 'tools/call',
    params: {
      name: 'mcp__aws__ga_generateContentCalendar',
      arguments: {
        propertyId: 'properties/123456789',
        siteUrl: 'https://example.com',
        targetMonth: '2024-09'
      }
    }
  });

  console.log('Content calendar generated:');
  calendar.result.calendar.items.forEach(item => {
    console.log(`${item.dueDate}: ${item.title} (${item.type})`);
  });
}
```

### Key-Value Storage for Session Data

```javascript
async function manageUserSession() {
  // Store user preferences with 1-hour TTL
  await mcpClient.request({
    method: 'tools/call',
    params: {
      name: 'mcp__aws__kv_set',
      arguments: {
        key: 'user-session-12345',
        value: JSON.stringify({
          theme: 'dark',
          language: 'en',
          dashboard: 'analytics'
        }),
        ttl_hours: 1
      }
    }
  });

  // Retrieve session data
  const session = await mcpClient.request({
    method: 'tools/call',
    params: {
      name: 'mcp__aws__kv_get',
      arguments: {
        key: 'user-session-12345'
      }
    }
  });

  if (session.result.value) {
    const preferences = JSON.parse(session.result.value);
    console.log('User preferences:', preferences);
  }
}
```

### Artifact Management for Reports

```javascript
async function storeAndRetrieveReport() {
  const reportData = {
    title: 'Monthly Analytics Report',
    generated: new Date().toISOString(),
    metrics: {
      sessions: 15420,
      pageviews: 23100,
      bounceRate: 0.42
    }
  };

  // Store report as JSON artifact
  const stored = await mcpClient.request({
    method: 'tools/call',
    params: {
      name: 'mcp__aws__artifacts_put',
      arguments: {
        key: 'reports/2024/september-analytics.json',
        content: JSON.stringify(reportData, null, 2),
        content_type: 'application/json'
      }
    }
  });

  console.log('Report stored:', stored.result.key);
  console.log('Access URL:', stored.result.url);

  // List all reports
  const reports = await mcpClient.request({
    method: 'tools/call',
    params: {
      name: 'mcp__aws__artifacts_list',
      arguments: {
        prefix: 'reports/'
      }
    }
  });

  console.log('Available reports:', reports.result.artifacts.length);
}
```

## Advanced Integration Patterns

### SEO Content Pipeline

```javascript
class SEOContentPipeline {
  constructor(mcpClient) {
    this.mcp = mcpClient;
    this.propertyId = 'properties/123456789';
    this.siteUrl = 'https://example.com';
  }

  async analyzeAndOptimize() {
    // Step 1: Get current performance data
    const [topPages, keywords] = await Promise.all([
      this.getTopPages(),
      this.getKeywords()
    ]);

    // Step 2: Identify optimization opportunities
    const opportunities = this.identifyOpportunities(topPages, keywords);

    // Step 3: Store analysis results
    await this.storeAnalysis(opportunities);

    // Step 4: Generate action items
    const actionItems = await this.generateActionItems(opportunities);

    return actionItems;
  }

  async getTopPages() {
    const response = await this.mcp.request({
      method: 'tools/call',
      params: {
        name: 'mcp__aws__ga_getTopPages',
        arguments: {
          propertyId: this.propertyId,
          days: 30
        }
      }
    });
    return response.result.data;
  }

  async getKeywords() {
    const response = await this.mcp.request({
      method: 'tools/call',
      params: {
        name: 'mcp__aws__ga_getSearchConsoleData',
        arguments: {
          siteUrl: this.siteUrl,
          days: 30
        }
      }
    });
    return response.result.data;
  }

  identifyOpportunities(pages, keywords) {
    const opportunities = [];

    // Find high-impression, low-CTR keywords
    keywords.forEach(keyword => {
      if (keyword.impressions > 1000 && keyword.ctr < 0.05) {
        opportunities.push({
          type: 'improve-ctr',
          keyword: keyword.query,
          page: keyword.page,
          potential: keyword.impressions * 0.1 // Estimate 10% CTR potential
        });
      }
    });

    // Find pages with high bounce rate
    pages.forEach(page => {
      if (page.bounceRate > 0.7 && page.sessions > 100) {
        opportunities.push({
          type: 'reduce-bounce',
          page: page.pagePath,
          sessions: page.sessions,
          currentBounceRate: page.bounceRate
        });
      }
    });

    return opportunities;
  }

  async storeAnalysis(opportunities) {
    const analysis = {
      timestamp: new Date().toISOString(),
      opportunities: opportunities,
      summary: {
        ctrOpportunities: opportunities.filter(o => o.type === 'improve-ctr').length,
        bounceOpportunities: opportunities.filter(o => o.type === 'reduce-bounce').length
      }
    };

    await this.mcp.request({
      method: 'tools/call',
      params: {
        name: 'mcp__aws__artifacts_put',
        arguments: {
          key: `analysis/${new Date().toISOString().split('T')[0]}-seo-analysis.json`,
          content: JSON.stringify(analysis, null, 2),
          content_type: 'application/json'
        }
      }
    });
  }

  async generateActionItems(opportunities) {
    const calendar = await this.mcp.request({
      method: 'tools/call',
      params: {
        name: 'mcp__aws__ga_generateContentCalendar',
        arguments: {
          propertyId: this.propertyId,
          siteUrl: this.siteUrl,
          targetMonth: new Date().toISOString().slice(0, 7) // Current month YYYY-MM
        }
      }
    });

    // Combine opportunities with calendar items
    return {
      calendar: calendar.result.calendar,
      seoOpportunities: opportunities,
      actionPlan: this.createActionPlan(opportunities)
    };
  }

  createActionPlan(opportunities) {
    return opportunities.map(opp => ({
      priority: opp.type === 'improve-ctr' ? 'high' : 'medium',
      action: opp.type === 'improve-ctr' 
        ? `Optimize title and meta description for "${opp.keyword}"`
        : `Improve content engagement on ${opp.page}`,
      estimatedImpact: opp.potential || 'Medium',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    }));
  }
}
```

### Event-Driven Workflow Automation

```javascript
class ContentWorkflowAutomation {
  constructor(mcpClient) {
    this.mcp = mcpClient;
  }

  async setupMonthlyAnalysis() {
    // Send event to trigger monthly content analysis
    await this.mcp.request({
      method: 'tools/call',
      params: {
        name: 'mcp__aws__events_send',
        arguments: {
          detailType: 'ContentAnalysis.Scheduled',
          detail: {
            propertyId: 'properties/123456789',
            siteUrl: 'https://example.com',
            analysisType: 'monthly',
            scheduledBy: 'automation-system',
            timestamp: new Date().toISOString()
          }
        }
      }
    });

    console.log('Monthly analysis scheduled');
  }

  async handleAnalysisComplete(analysisResult) {
    // Store results
    await this.storeResults(analysisResult);

    // Generate calendar
    const calendar = await this.generateCalendar(analysisResult);

    // Notify team
    await this.notifyTeam(calendar);

    // Trigger workflow
    await this.startContentWorkflow(calendar);
  }

  async startContentWorkflow(calendar) {
    const response = await this.mcp.request({
      method: 'tools/call',
      params: {
        name: 'mcp__aws__workflow_start',
        arguments: {
          name: 'content-production-pipeline',
          input: {
            calendar: calendar,
            month: calendar.month,
            year: calendar.year,
            itemCount: calendar.items.length
          }
        }
      }
    });

    console.log('Workflow started:', response.result.executionArn);
    return response.result;
  }
}
```

## Error Handling Best Practices

```javascript
async function robustAnalyticsQuery() {
  try {
    const result = await mcpClient.request({
      method: 'tools/call',
      params: {
        name: 'mcp__aws__ga_getTopPages',
        arguments: {
          propertyId: 'properties/123456789',
          days: 30
        }
      }
    });

    if (!result.result.success) {
      throw new Error(`Analytics query failed: ${result.result.error?.message}`);
    }

    return result.result.data;

  } catch (error) {
    console.error('Analytics query error:', error.message);

    // Fallback: try with shorter time period
    if (error.message.includes('quota') || error.message.includes('rate limit')) {
      console.log('Retrying with shorter period due to quota limits...');
      
      await new Promise(resolve => setTimeout(resolve, 60000)); // Wait 1 minute
      
      return mcpClient.request({
        method: 'tools/call',
        params: {
          name: 'mcp__aws__ga_getTopPages',
          arguments: {
            propertyId: 'properties/123456789',
            days: 7 // Shorter period
          }
        }
      });
    }

    // Log error for monitoring
    await mcpClient.request({
      method: 'tools/call',
      params: {
        name: 'mcp__aws__events_send',
        arguments: {
          detailType: 'Analytics.QueryError',
          detail: {
            error: error.message,
            timestamp: new Date().toISOString(),
            propertyId: 'properties/123456789'
          }
        }
      }
    });

    throw error;
  }
}
```

## Performance Optimization

### Caching Strategy

```javascript
class AnalyticsCache {
  constructor(mcpClient) {
    this.mcp = mcpClient;
    this.cachePrefix = 'analytics-cache';
  }

  async getCachedOrFetch(cacheKey, fetchFunction, cacheHours = 4) {
    // Check cache first
    const cached = await this.mcp.request({
      method: 'tools/call',
      params: {
        name: 'mcp__aws__kv_get',
        arguments: {
          key: `${this.cachePrefix}:${cacheKey}`
        }
      }
    });

    if (cached.result.value) {
      console.log('Cache hit for:', cacheKey);
      return JSON.parse(cached.result.value);
    }

    // Cache miss - fetch fresh data
    console.log('Cache miss for:', cacheKey);
    const freshData = await fetchFunction();

    // Store in cache
    await this.mcp.request({
      method: 'tools/call',
      params: {
        name: 'mcp__aws__kv_set',
        arguments: {
          key: `${this.cachePrefix}:${cacheKey}`,
          value: JSON.stringify(freshData),
          ttl_hours: cacheHours
        }
      }
    });

    return freshData;
  }

  async getTopPagesWithCache(propertyId, days = 30) {
    const cacheKey = `top-pages:${propertyId}:${days}`;
    
    return this.getCachedOrFetch(cacheKey, async () => {
      const response = await this.mcp.request({
        method: 'tools/call',
        params: {
          name: 'mcp__aws__ga_getTopPages',
          arguments: { propertyId, days }
        }
      });
      return response.result.data;
    }, 2); // 2-hour cache for page data
  }
}
```

## Integration with Claude Desktop

### MCP Client Configuration

Add to your Claude Desktop configuration file:

```json
{
  "mcpServers": {
    "aws-agent-mesh": {
      "command": "node",
      "args": ["src/server.js"],
      "cwd": "/path/to/aws-ai-agent-bus/mcp-server",
      "env": {
        "AWS_REGION": "us-west-2",
        "DYNAMODB_TABLE": "agent-mesh-dev-kv",
        "S3_BUCKET": "agent-mesh-dev-artifacts",
        "EVENT_BUS_NAME": "agent-mesh-dev",
        "GOOGLE_ANALYTICS_SECRET": "myproject-content-pipeline/google-analytics"
      }
    }
  }
}
```

### Claude Desktop Usage

Once configured, you can use these tools naturally in Claude Desktop:

```
You: "Show me the top performing pages from my website analytics for the last 30 days"

Claude: I'll get your top performing pages from Google Analytics.

[Uses mcp__aws__ga_getTopPages tool]

Here are your top performing pages from the last 30 days:

1. /blog/analytics-guide - 2,341 sessions, 3,120 pageviews
2. /tutorial/getting-started - 1,892 sessions, 2,456 pageviews
3. /products/analytics-tool - 1,567 sessions, 2,034 pageviews

Would you like me to analyze content opportunities based on this data?
```

## Monitoring and Observability

```javascript
async function setupMonitoring() {
  // Monitor API usage
  await mcpClient.request({
    method: 'tools/call',
    params: {
      name: 'mcp__aws__events_send',
      arguments: {
        detailType: 'Analytics.DailyUsage',
        detail: {
          apiCalls: 156,
          cacheHits: 89,
          cacheMisses: 67,
          errorRate: 0.02,
          timestamp: new Date().toISOString()
        }
      }
    }
  });

  // Health check
  const status = await mcpClient.request({
    method: 'tools/call',
    params: {
      name: 'mcp__aws__kv_get',
      arguments: {
        key: 'system-health'
      }
    }
  });

  console.log('System health:', status.result.value || 'No health data');
}
```

## Next Steps

1. **Authentication Setup**: Follow the [SETUP.md](SETUP.md) guide for OAuth2 configuration
2. **Infrastructure**: Deploy AWS resources using the [infrastructure guide](../infra/README.md)
3. **Custom Workflows**: Build your own automation using the patterns above
4. **Monitoring**: Set up CloudWatch dashboards for usage tracking

For more examples, see the [test files](../test/) which demonstrate additional usage patterns and integration scenarios.
