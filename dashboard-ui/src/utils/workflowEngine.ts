// Import schema-based sample generator
import { sampleDataGenerator } from './sampleDataGenerator.js';

// Simple workflow execution engine for MCP tools
export class WorkflowEngine {
  private mcpClient: any;
  private executionHistory: any[];
  private eventEmitter: ((event: any) => void) | null;
  private useMockData: boolean;
  private nodeRegistry: any;

  constructor(mcpClient: any, eventEmitter: ((event: any) => void) | null = null, useMockData = false, nodeRegistry: any = null) {
    this.mcpClient = mcpClient;
    this.executionHistory = [];
    this.eventEmitter = eventEmitter; // Dashboard server sendMessage function
    this.useMockData = useMockData; // Mock/dry-run mode flag
    this.nodeRegistry = nodeRegistry; // Registry with node schemas/definitions
  }

  // Emit workflow events to EventBridge via dashboard-server
  async emitEvent(detailType, detail, source = 'workflow-engine') {
    if (!this.eventEmitter) return;

    try {
      this.eventEmitter({
        type: 'publish_event',
        event: {
          detailType,
          source,
          detail
        }
      });
    } catch (error) {
      console.error('Failed to emit workflow event:', error);
    }
  }

  async executeWorkflow(workflow) {
    const { nodes } = workflow;
    const executionId = Date.now().toString();

    console.log(`🚀 Starting workflow execution: ${executionId}`);

    // Emit workflow.started event
    await this.emitEvent('workflow.started', {
      executionId,
      workflowId: workflow.id || workflow.name,
      workflowName: workflow.name,
      nodeCount: nodes.length,
      timestamp: new Date().toISOString()
    });

    try {
      // Find the trigger node (starting point)
      const triggerNode = nodes.find(node => node.type === 'trigger');
      if (!triggerNode) {
        throw new Error('No trigger node found in workflow');
      }

      // Initialize execution context
      const context = {
        executionId,
        data: {},
        results: {},
        errors: []
      };

      // Execute nodes in sequence (simple linear execution for now)
      const result = await this.executeNode(triggerNode, nodes, context);

      console.log(`✅ Workflow execution completed: ${executionId}`, result);

      // Emit workflow.completed event
      await this.emitEvent('workflow.completed', {
        executionId,
        workflowId: workflow.id || workflow.name,
        workflowName: workflow.name,
        nodesExecuted: Object.keys(context.results).length,
        result,
        timestamp: new Date().toISOString()
      });

      this.executionHistory.push({
        id: executionId,
        timestamp: new Date().toISOString(),
        status: 'completed',
        result,
        context
      });

      return result;

    } catch (error) {
      console.error(`❌ Workflow execution failed: ${executionId}`, error);

      // Emit workflow.failed event
      await this.emitEvent('workflow.failed', {
        executionId,
        workflowId: workflow.id || workflow.name,
        workflowName: workflow.name,
        error: error.message,
        timestamp: new Date().toISOString()
      });

      this.executionHistory.push({
        id: executionId,
        timestamp: new Date().toISOString(),
        status: 'failed',
        error: error.message
      });

      throw error;
    }
  }

  // Use sample data from node config (Zapier-style test data)
  // Each node can have a 'sampleOutput' field that gets used in dry-run mode
  useSampleData(node) {
    // 1. Check if node has custom configured sample/test data
    if (node.config?.sampleOutput) {
      console.log(`🧪 Using custom sample data for ${node.type}:`, node.config.sampleOutput);
      return node.config.sampleOutput;
    }

    // 2. Use default sample output from node definitions
    const defaultSample = this.getDefaultSampleOutput(node.type);
    if (defaultSample) {
      console.log(`🧪 Using default sample data for ${node.type}:`, defaultSample);
      return defaultSample;
    }

    // 3. Fallback placeholder if no defaults exist
    console.log(`⚠️ No sample data configured for ${node.type}, using placeholder`);
    return {
      _sample: true,
      nodeType: node.type,
      message: `Configure 'sampleOutput' in node settings for realistic test data`,
      timestamp: new Date().toISOString()
    };
  }

  // Generate sample output from node schema
  getDefaultSampleOutput(nodeType) {
    // Try to get node schema from registry (MCP tools, custom nodes, etc)
    const nodeSchema = this.getNodeSchema(nodeType);

    if (nodeSchema?.outputSchema) {
      // Generate sample data from output schema
      return sampleDataGenerator.generateFromSchema(nodeSchema.outputSchema);
    }

    // If no schema available, return null (will trigger placeholder)
    return null;
  }

  // Get node schema from registry
  getNodeSchema(nodeType) {
    // First check centralized NodeRegistry
    const { getNodeDefinition } = require('../../lib/workflow-nodes');
    const registryNode = getNodeDefinition(nodeType);

    if (registryNode) {
      return {
        outputSchema: registryNode.outputSchema,
        sampleOutput: registryNode.sampleOutput
      };
    }

    // If nodeRegistry provided (contains MCP tool definitions, custom nodes, etc)
    if (this.nodeRegistry) {
      // Try to find node in registry
      const nodeDef = this.nodeRegistry.get?.(nodeType) || this.nodeRegistry[nodeType];
      if (nodeDef) {
        return nodeDef;
      }
    }

    return null;
  }

  async executeNode(node, allNodes, context) {
    const modeLabel = this.useMockData ? '🧪 DRY RUN' : '⚡ LIVE';
    console.log(`🔄 ${modeLabel} Executing node: ${node.type} (${node.id})`);

    // Emit node.state_changed → 'executing'
    await this.emitEvent('workflow.node.state_changed', {
      executionId: context.executionId,
      nodeId: node.id,
      nodeType: node.type,
      previousState: 'pending',
      currentState: 'executing',
      mockMode: this.useMockData,
      timestamp: new Date().toISOString()
    });

    const startTime = Date.now();

    try {
      let result;

      // If dry-run mode, use sample data from node config (Zapier-style)
      if (this.useMockData && node.type !== 'trigger') {
        await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300)); // Simulate processing
        result = this.useSampleData(node);
      } else {
        // Real execution - call actual APIs/MCP tools
      
      switch (node.type) {
        case 'trigger':
          result = { status: 'triggered', timestamp: new Date().toISOString() };
          break;

        case 'kv-get':
          result = await this.mcpClient.callTool('kv.get', {
            key: node.config?.key || 'default-key'
          });
          break;

        case 'kv-set':
          result = await this.mcpClient.callTool('kv.set', {
            key: node.config?.key || 'workflow-result',
            value: context.data?.previousResult || 'workflow executed',
            ttl_hours: node.config?.ttl_hours || 24
          });
          break;

        case 'artifacts-list':
          result = await this.mcpClient.callTool('artifacts.list', {
            prefix: node.config?.prefix || ''
          });
          break;

        case 'artifacts-get':
          result = await this.mcpClient.callTool('artifacts.get', {
            key: node.config?.key || 'default-artifact'
          });
          break;

        case 'events-send':
          result = await this.mcpClient.callTool('events.send', {
            detailType: node.config?.eventType || 'WorkflowEvent',
            detail: {
              workflowId: context.executionId,
              nodeId: node.id,
              data: context.data,
              timestamp: new Date().toISOString()
            },
            source: 'workflow-engine'
          });
          break;

        case 'ga-top-pages':
          result = await this.mcpClient.callTool('ga.getTopPages', {
            days: node.config?.days || 30
          });
          break;

        case 'ga-search-data':
          result = await this.mcpClient.callTool('ga.getSearchConsoleData', {
            days: node.config?.days || 30
          });
          break;

        case 'ga-opportunities':
          result = await this.mcpClient.callTool('ga.analyzeContentOpportunities', {
            propertyId: node.config?.propertyId,
            siteUrl: node.config?.siteUrl
          });
          break;

        case 'ga-calendar':
          result = await this.mcpClient.callTool('ga.generateContentCalendar', {
            propertyId: node.config?.propertyId,
            siteUrl: node.config?.siteUrl,
            targetMonth: node.config?.targetMonth
          });
          break;

        case 'condition':
          // Simple condition logic
          const condition = node.config?.condition || 'true';
          const conditionResult = this.evaluateCondition(condition, context);
          result = { condition, result: conditionResult };
          break;

        case 'filter':
          // Simple data filtering
          const filterExpression = node.config?.filter || 'true';
          result = this.filterData(context.data, filterExpression);
          break;

        case 'delay':
          // Simple delay
          const delayMs = (node.config?.seconds || 1) * 1000;
          await new Promise(resolve => setTimeout(resolve, delayMs));
          result = { delayed: delayMs };
          break;

        case 'code':
          // Execute custom JavaScript code (sandbox needed for production)
          const code = node.config?.code || 'return data;';
          result = this.executeCode(code, context);
          break;

        // Agent System nodes
        case 'agent-conductor':
          result = await this.executeAgent('conductor', node.config?.task || 'Plan and execute task', context);
          break;

        case 'agent-critic':
          result = await this.executeAgent('critic', node.config?.task || 'Review and validate', context);
          break;

        case 'agent-frontend':
          result = await this.executeAgent('frontend-developer', node.config?.task || 'Frontend development task', context);
          break;

        case 'agent-backend':
          result = await this.executeAgent('backend-developer', node.config?.task || 'Backend development task', context);
          break;

        case 'agent-terraform':
          result = await this.executeAgent('terraform-infrastructure-expert', node.config?.task || 'Infrastructure task', context);
          break;

        case 'agent-aws-s3':
          result = await this.executeAgent('s3-storage-expert', node.config?.task || 'S3 operations task', context);
          break;

        case 'agent-aws-lambda':
          result = await this.executeAgent('lambda-serverless-expert', node.config?.task || 'Lambda function task', context);
          break;

        case 'agent-aws-dynamodb':
          result = await this.executeAgent('dynamodb-database-expert', node.config?.task || 'DynamoDB operations task', context);
          break;

        case 'agent-stripe':
          result = await this.executeAgent('stripe-payments-expert', node.config?.task || 'Payment processing task', context);
          break;

        case 'agent-github':
          result = await this.executeAgent('github-integration-expert', node.config?.task || 'GitHub operations task', context);
          break;

        case 'agent-slack':
          result = await this.executeAgent('slack-integration-expert', node.config?.task || 'Slack integration task', context);
          break;

        case 'agent-linkedin':
          result = await this.executeAgent('linkedin-content-creator', node.config?.task || 'Create LinkedIn content', context);
          break;

        case 'agent-custom':
          result = await this.executeAgent(node.config?.agentType || 'general-purpose', node.config?.task || 'Custom task', context);
          break;

        // HTTP/API nodes
        case 'http-get':
          result = await this.executeHttpRequest('GET', node.config, context);
          break;

        case 'http-post':
          result = await this.executeHttpRequest('POST', node.config, context);
          break;

        case 'http-put':
          result = await this.executeHttpRequest('PUT', node.config, context);
          break;

        case 'http-delete':
          result = await this.executeHttpRequest('DELETE', node.config, context);
          break;

        case 'json-parse':
          result = this.parseJson(context.data?.previousResult || node.config?.input || '{}');
          break;

        case 'json-stringify':
          result = this.stringifyJson(context.data?.previousResult || node.config?.data || {});
          break;

        case 'http-auth':
          result = this.addAuthentication(context.data, node.config);
          break;

        case 'url-builder':
          result = this.buildUrl(node.config, context);
          break;

        // Task Management nodes
        case 'task-scheduler':
          result = this.scheduleTask(node.config, context);
          break;

        case 'task-prioritizer':
          result = this.prioritizeTasks(node.config, context);
          break;

        // Analytics & Reporting nodes
        case 'ga-traffic-analysis':
          result = await this.analyzeTraffic(node.config, context);
          break;

        case 'ga-content-performance':
          result = await this.analyzeContentPerformance(node.config, context);
          break;

        case 'report-generator':
          result = this.generateReport(node.config, context);
          break;

        case 'data-visualizer':
          result = this.visualizeData(node.config, context);
          break;

        case 'output':
          result = {
            output: context.data,
            summary: `Workflow completed with ${Object.keys(context.results).length} steps`
          };
          break;

        default:
          result = { status: 'unknown_node_type', type: node.type };
      }
      } // End of else block for real execution

      // Store result in context
      context.results[node.id] = result;
      context.data.previousResult = result;

      const duration = Date.now() - startTime;

      // Emit node.output_produced event
      await this.emitEvent('workflow.node.output_produced', {
        executionId: context.executionId,
        nodeId: node.id,
        nodeType: node.type,
        output: result,
        duration,
        timestamp: new Date().toISOString()
      });

      // Emit node.state_changed → 'completed'
      await this.emitEvent('workflow.node.state_changed', {
        executionId: context.executionId,
        nodeId: node.id,
        nodeType: node.type,
        previousState: 'executing',
        currentState: 'completed',
        duration,
        timestamp: new Date().toISOString()
      });

      // Find and execute next nodes (simple linear flow for now)
      const nextNodes = this.findNextNodes(node, allNodes);
      for (const nextNode of nextNodes) {
        // Emit data_flowing event for edge animation
        await this.emitEvent('workflow.node.data_flowing', {
          executionId: context.executionId,
          fromNodeId: node.id,
          toNodeId: nextNode.id,
          data: result,
          timestamp: new Date().toISOString()
        });

        await this.executeNode(nextNode, allNodes, context);
      }

      return result;

    } catch (error) {
      console.error(`❌ Error executing node ${node.type}:`, error);

      const duration = Date.now() - startTime;

      // Emit node.state_changed → 'failed'
      await this.emitEvent('workflow.node.state_changed', {
        executionId: context.executionId,
        nodeId: node.id,
        nodeType: node.type,
        previousState: 'executing',
        currentState: 'failed',
        error: error.message,
        duration,
        timestamp: new Date().toISOString()
      });

      context.errors.push({
        nodeId: node.id,
        nodeType: node.type,
        error: error.message
      });
      throw error;
    }
  }

  findNextNodes(currentNode, allNodes) {
    // Simple implementation - in a real workflow engine, this would follow connections
    // For now, just return the next node in the array if it exists
    const currentIndex = allNodes.findIndex(n => n.id === currentNode.id);
    if (currentIndex >= 0 && currentIndex < allNodes.length - 1) {
      return [allNodes[currentIndex + 1]];
    }
    return [];
  }

  evaluateCondition(condition, context) {
    try {
      // Simple condition evaluation (unsafe - would need proper sandboxing)
      const func = new Function('data', 'results', `return ${condition};`);
      return func(context.data, context.results);
    } catch (error) {
      console.error('Condition evaluation error:', error);
      return false;
    }
  }

  filterData(data: any, filterExpression: string) {
    try {
      if (Array.isArray(data)) {
        const func = new Function('item', 'index', `return ${filterExpression};`) as (item: any, index: number) => boolean;
        return data.filter(func);
      }
      return data;
    } catch (error) {
      console.error('Filter evaluation error:', error);
      return data;
    }
  }

  executeCode(code, context) {
    try {
      // Simple code execution (unsafe - would need proper sandboxing)
      const func = new Function('data', 'results', 'context', code);
      return func(context.data, context.results, context);
    } catch (error) {
      console.error('Code execution error:', error);
      return { error: error.message };
    }
  }

  getExecutionHistory() {
    return this.executionHistory;
  }

  clearHistory() {
    this.executionHistory = [];
  }

  // HTTP/API helper methods
  async executeHttpRequest(method, config, context) {
    try {
      const url = config?.url || context.data?.url || 'https://api.example.com/data';
      const headers = {
        'Content-Type': 'application/json',
        ...config?.headers,
        ...context.data?.headers
      };
      
      const requestOptions: RequestInit = {
        method,
        headers
      };

      if (method !== 'GET' && config?.body) {
        requestOptions.body = typeof config.body === 'string' ? config.body : JSON.stringify(config.body);
      }

      console.log(`🌐 Making ${method} request to: ${url}`);
      
      const response = await fetch(url, requestOptions);
      const data = response.headers.get('content-type')?.includes('application/json') 
        ? await response.json() 
        : await response.text();

      return {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        data,
        url,
        method
      };
    } catch (error) {
      console.error(`❌ HTTP ${method} request failed:`, error);
      return {
        error: error.message,
        status: 'error',
        method,
        url: config?.url || context.data?.url
      };
    }
  }

  parseJson(input) {
    try {
      const jsonString = typeof input === 'string' ? input : JSON.stringify(input);
      const parsed = JSON.parse(jsonString);
      
      console.log('📋 JSON parsed successfully');
      
      return {
        parsed,
        original: jsonString,
        status: 'success'
      };
    } catch (error) {
      console.error('❌ JSON parse error:', error);
      return {
        error: error.message,
        original: input,
        status: 'error'
      };
    }
  }

  stringifyJson(data) {
    try {
      const stringified = JSON.stringify(data, null, 2);
      
      console.log('📄 JSON stringified successfully');
      
      return {
        stringified,
        original: data,
        status: 'success'
      };
    } catch (error) {
      console.error('❌ JSON stringify error:', error);
      return {
        error: error.message,
        original: data,
        status: 'error'
      };
    }
  }

  addAuthentication(data, config) {
    try {
      const authType = config?.type || 'bearer';
      const token = config?.token || config?.apiKey || 'your-token-here';
      
      const headers = { ...data?.headers };
      
      switch (authType.toLowerCase()) {
        case 'bearer':
          headers['Authorization'] = `Bearer ${token}`;
          break;
        case 'basic':
          const credentials = btoa(`${config?.username || 'user'}:${config?.password || 'pass'}`);
          headers['Authorization'] = `Basic ${credentials}`;
          break;
        case 'apikey':
          const headerName = config?.headerName || 'X-API-Key';
          headers[headerName] = token;
          break;
        default:
          headers['Authorization'] = token;
      }

      console.log(`🔐 Added ${authType} authentication`);

      return {
        headers,
        authType,
        status: 'success'
      };
    } catch (error) {
      console.error('❌ Authentication setup error:', error);
      return {
        error: error.message,
        status: 'error'
      };
    }
  }

  buildUrl(config, context) {
    try {
      const baseUrl = config?.baseUrl || context.data?.baseUrl || 'https://api.example.com';
      const path = config?.path || context.data?.path || '';
      const params = { ...config?.params, ...context.data?.params };
      
      let url = baseUrl.replace(/\/$/, '') + (path.startsWith('/') ? path : `/${path}`);
      
      if (Object.keys(params).length > 0) {
        const searchParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            searchParams.append(key, value.toString());
          }
        });
        url += `?${searchParams.toString()}`;
      }

      console.log(`🔗 Built URL: ${url}`);

      return {
        url,
        baseUrl,
        path,
        params,
        status: 'success'
      };
    } catch (error) {
      console.error('❌ URL build error:', error);
      return {
        error: error.message,
        status: 'error'
      };
    }
  }

  async executeAgent(agentType, task, context) {
    console.log(`🤖 Executing agent: ${agentType} - ${task}`);
    
    // Placeholder for actual agent execution
    // In a real implementation, this would call the MCP agent system
    return {
      agentType,
      task,
      status: 'simulated',
      result: `Agent ${agentType} would execute: ${task}`,
      context: context.executionId
    };
  }

  // Task Management helper methods
  scheduleTask(config, context) {
    try {
      const task = config?.task || context.data?.task || 'Scheduled task';
      const schedule = config?.schedule || context.data?.schedule || 'daily';
      
      console.log(`⏰ Scheduling task: ${task} (${schedule})`);
      
      return {
        taskId: `task_${Date.now()}`,
        task,
        schedule,
        nextRun: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        status: 'scheduled'
      };
    } catch (error) {
      console.error('❌ Task scheduling failed:', error);
      return { error: error.message, status: 'failed' };
    }
  }

  prioritizeTasks(config, context) {
    try {
      const tasks = context.data?.tasks || config?.tasks || [];
      const criteria = config?.criteria || 'impact'; // impact, urgency, effort
      
      console.log(`🎯 Prioritizing ${tasks.length} tasks by ${criteria}`);
      
      // Simple priority scoring simulation
      const prioritizedTasks = tasks.map((task, index) => ({
        ...task,
        priority: Math.floor(Math.random() * 100) + 1,
        rank: index + 1
      })).sort((a, b) => b.priority - a.priority);
      
      return {
        tasks: prioritizedTasks,
        criteria,
        totalTasks: tasks.length,
        status: 'prioritized'
      };
    } catch (error) {
      console.error('❌ Task prioritization failed:', error);
      return { error: error.message, status: 'failed' };
    }
  }

  // Analytics & Reporting helper methods
  async analyzeTraffic(config, context) {
    try {
      const timeframe = config?.days || context.data?.days || 30;
      
      console.log(`📊 Analyzing traffic for ${timeframe} days`);
      
      // Simulated traffic data
      return {
        timeframe,
        totalUsers: 45230,
        newUsers: 12450,
        sessions: 67890,
        pageviews: 134560,
        bounceRate: 0.34,
        avgSessionDuration: 185,
        topPages: [
          { page: '/blog/seo-tips', views: 5420, users: 4320 },
          { page: '/products/analytics', views: 4230, users: 3890 },
          { page: '/about', views: 3210, users: 2870 }
        ],
        status: 'analyzed'
      };
    } catch (error) {
      console.error('❌ Traffic analysis failed:', error);
      return { error: error.message, status: 'failed' };
    }
  }

  async analyzeContentPerformance(config, context) {
    try {
      const timeframe = config?.days || context.data?.days || 30;
      
      console.log(`📈 Analyzing content performance for ${timeframe} days`);
      
      return {
        timeframe,
        topContent: [
          { title: 'Ultimate SEO Guide 2024', views: 8450, engagement: 0.67, conversions: 23 },
          { title: 'Google Analytics Setup', views: 6230, engagement: 0.54, conversions: 18 },
          { title: 'Content Marketing Tips', views: 5670, engagement: 0.71, conversions: 31 }
        ],
        contentOpportunities: [
          { topic: 'Local SEO', searchVolume: 12000, difficulty: 'medium' },
          { topic: 'Voice Search Optimization', searchVolume: 8500, difficulty: 'low' },
          { topic: 'AI in Marketing', searchVolume: 15000, difficulty: 'high' }
        ],
        status: 'analyzed'
      };
    } catch (error) {
      console.error('❌ Content performance analysis failed:', error);
      return { error: error.message, status: 'failed' };
    }
  }

  generateReport(config, context) {
    try {
      const data = context.data || {};
      const reportType = config?.type || 'summary';
      
      console.log(`📄 Generating ${reportType} report`);
      
      return {
        reportId: `report_${Date.now()}`,
        type: reportType,
        generatedAt: new Date().toISOString(),
        summary: `Report generated with ${Object.keys(data).length} data points`,
        format: config?.format || 'json',
        downloadUrl: `/reports/report_${Date.now()}.${config?.format || 'json'}`,
        status: 'generated'
      };
    } catch (error) {
      console.error('❌ Report generation failed:', error);
      return { error: error.message, status: 'failed' };
    }
  }

  visualizeData(config, context) {
    try {
      const data = context.data || {};
      const chartType = config?.chartType || 'bar';
      
      console.log(`📊 Creating ${chartType} visualization`);
      
      return {
        visualizationId: `viz_${Date.now()}`,
        chartType,
        dataPoints: Object.keys(data).length,
        imageUrl: `/visualizations/viz_${Date.now()}.png`,
        interactive: config?.interactive || false,
        status: 'created'
      };
    } catch (error) {
      console.error('❌ Data visualization failed:', error);
      return { error: error.message, status: 'failed' };
    }
  }
}