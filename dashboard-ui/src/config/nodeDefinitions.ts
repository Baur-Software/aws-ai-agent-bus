/**
 * Node Definitions with Default Sample Outputs
 * Zapier-style test data for dry-run mode
 */

export interface NodeDefinition {
  type: string;
  name: string;
  description: string;
  category: string;
  icon?: string;
  color?: string;
  defaultConfig?: Record<string, any>;

  // Integration/authentication requirement
  requiresIntegration?: string; // Integration ID (e.g., 'google-analytics', 'slack')
  requiresCredentials?: boolean; // Whether this node needs credentials

  // Schema-based output definition (preferred)
  outputSchema?: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };

  // Legacy: hardcoded sample output (will be replaced by schema)
  defaultSampleOutput?: any;

  configFields?: {
    key: string;
    label: string;
    type: 'text' | 'number' | 'select' | 'textarea' | 'json' | 'credential';
    required?: boolean;
    defaultValue?: any;
    options?: { label: string; value: any }[];
    integrationId?: string; // For credential type fields
  }[];
}

export const NODE_DEFINITIONS: NodeDefinition[] = [
  // Triggers
  {
    type: 'trigger',
    name: 'Trigger',
    description: 'Start workflow execution',
    category: 'triggers',
    icon: '▶️',
    color: 'bg-green-500',
    defaultSampleOutput: {
      status: 'triggered',
      timestamp: '2025-09-30T10:30:00Z',
      triggeredBy: 'manual'
    }
  },
  {
    type: 'webhook',
    name: 'Webhook',
    description: 'HTTP webhook trigger',
    category: 'triggers',
    icon: '🔗',
    color: 'bg-blue-500',
    defaultSampleOutput: {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': 'Sample-Client/1.0'
      },
      body: {
        event: 'user.created',
        userId: 'usr_12345',
        email: 'user@example.com',
        name: 'Sample User'
      },
      query: {},
      timestamp: '2025-09-30T10:30:00Z'
    }
  },
  {
    type: 'schedule',
    name: 'Schedule',
    description: 'Time-based trigger',
    category: 'triggers',
    icon: '⏰',
    color: 'bg-yellow-500',
    configFields: [
      {
        key: 'schedule',
        label: 'Schedule',
        type: 'select',
        required: true,
        options: [
          { label: 'Every 5 minutes', value: '*/5 * * * *' },
          { label: 'Every hour', value: '0 * * * *' },
          { label: 'Daily at 9am', value: '0 9 * * *' },
          { label: 'Weekly on Monday', value: '0 9 * * 1' }
        ]
      }
    ],
    defaultSampleOutput: {
      scheduledTime: '2025-09-30T09:00:00Z',
      actualTime: '2025-09-30T09:00:01Z',
      schedule: '0 9 * * *',
      nextRun: '2025-10-01T09:00:00Z'
    }
  },

  // KV Store
  {
    type: 'kv-get',
    name: 'KV Get',
    description: 'Retrieve value from key-value store',
    category: 'storage',
    icon: '🗄️',
    color: 'bg-purple-500',
    configFields: [
      { key: 'key', label: 'Key', type: 'text', required: true }
    ],
    outputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'The key that was retrieved' },
        value: {
          type: 'object',
          description: 'The stored value (can be any JSON)',
          additionalProperties: true
        },
        ttl: { type: 'number', description: 'Time to live in seconds' },
        timestamp: { type: 'string', format: 'date-time' }
      },
      required: ['key', 'value']
    }
  },
  {
    type: 'kv-set',
    name: 'KV Set',
    description: 'Store value in key-value store',
    category: 'storage',
    icon: '💾',
    color: 'bg-indigo-500',
    configFields: [
      { key: 'key', label: 'Key', type: 'text', required: true },
      { key: 'value', label: 'Value', type: 'json', required: true },
      { key: 'ttl_hours', label: 'TTL (hours)', type: 'number', defaultValue: 24 }
    ],
    defaultSampleOutput: {
      success: true,
      key: 'user-preferences',
      ttl: 86400,
      expiresAt: '2025-10-01T10:30:00Z'
    }
  },

  // Artifacts (S3)
  {
    type: 'artifacts-list',
    name: 'List Artifacts',
    description: 'List files in S3 storage',
    category: 'storage',
    icon: '📁',
    color: 'bg-blue-500',
    configFields: [
      { key: 'prefix', label: 'Prefix/Path', type: 'text' }
    ],
    defaultSampleOutput: {
      artifacts: [
        { key: 'reports/monthly-report.pdf', size: 2048576, lastModified: '2025-09-29T15:30:00Z' },
        { key: 'reports/weekly-summary.xlsx', size: 512000, lastModified: '2025-09-28T10:15:00Z' },
        { key: 'images/logo.png', size: 45120, lastModified: '2025-09-25T08:00:00Z' }
      ],
      count: 3,
      prefix: 'reports/'
    }
  },
  {
    type: 'artifacts-get',
    name: 'Get Artifact',
    description: 'Download file from S3 storage',
    category: 'storage',
    icon: '📥',
    color: 'bg-green-500',
    configFields: [
      { key: 'key', label: 'File Path', type: 'text', required: true }
    ],
    defaultSampleOutput: {
      key: 'reports/monthly-report.pdf',
      content: 'JVBERi0xLjQKJeLjz9MKMyAwIG9iago8PC9UeXBlIC9QYWdlIC9QYXJlbnQgMSAwIFI...', // Base64 sample
      contentType: 'application/pdf',
      size: 2048576,
      lastModified: '2025-09-29T15:30:00Z'
    }
  },
  {
    type: 'artifacts-put',
    name: 'Upload Artifact',
    description: 'Upload file to S3 storage',
    category: 'storage',
    icon: '📤',
    color: 'bg-orange-500',
    configFields: [
      { key: 'key', label: 'File Path', type: 'text', required: true },
      { key: 'content', label: 'Content', type: 'textarea', required: true },
      { key: 'contentType', label: 'Content Type', type: 'text', defaultValue: 'text/plain' }
    ],
    defaultSampleOutput: {
      success: true,
      key: 'uploads/document.txt',
      size: 1024,
      url: 'https://s3.amazonaws.com/bucket/uploads/document.txt'
    }
  },

  // Events (EventBridge)
  {
    type: 'events-send',
    name: 'Send Event',
    description: 'Publish event to EventBridge',
    category: 'events',
    icon: '📡',
    color: 'bg-red-500',
    configFields: [
      { key: 'detailType', label: 'Event Type', type: 'text', required: true },
      { key: 'detail', label: 'Event Data', type: 'json', required: true }
    ],
    defaultSampleOutput: {
      eventId: 'evt_abc123xyz789',
      published: true,
      timestamp: '2025-09-30T10:30:00Z',
      detailType: 'user.signup',
      source: 'workflow-engine'
    }
  },

  // HTTP/API
  {
    type: 'http-get',
    name: 'HTTP GET',
    description: 'Make GET request to API',
    category: 'http',
    icon: '🌐',
    color: 'bg-blue-500',
    configFields: [
      { key: 'url', label: 'URL', type: 'text', required: true },
      { key: 'headers', label: 'Headers (JSON)', type: 'json' }
    ],
    defaultSampleOutput: {
      status: 200,
      statusText: 'OK',
      headers: {
        'content-type': 'application/json',
        'x-rate-limit-remaining': '4999'
      },
      data: {
        users: [
          { id: 1, name: 'Alice Johnson', email: 'alice@example.com', active: true },
          { id: 2, name: 'Bob Smith', email: 'bob@example.com', active: true },
          { id: 3, name: 'Carol White', email: 'carol@example.com', active: false }
        ],
        total: 3,
        page: 1
      }
    }
  },
  {
    type: 'http-post',
    name: 'HTTP POST',
    description: 'Make POST request to API',
    category: 'http',
    icon: '📮',
    color: 'bg-green-500',
    configFields: [
      { key: 'url', label: 'URL', type: 'text', required: true },
      { key: 'headers', label: 'Headers (JSON)', type: 'json' },
      { key: 'body', label: 'Request Body (JSON)', type: 'json', required: true }
    ],
    defaultSampleOutput: {
      status: 201,
      statusText: 'Created',
      headers: {
        'content-type': 'application/json',
        'location': '/api/users/4'
      },
      data: {
        id: 4,
        name: 'David Brown',
        email: 'david@example.com',
        createdAt: '2025-09-30T10:30:00Z',
        active: true
      }
    }
  },

  // Google Analytics
  {
    type: 'ga-top-pages',
    name: 'GA: Top Pages',
    description: 'Get top performing pages from Google Analytics',
    category: 'analytics',
    icon: '📊',
    color: 'bg-orange-500',
    requiresIntegration: 'google-analytics',
    requiresCredentials: true,
    configFields: [
      { key: 'connectionId', label: 'Google Analytics Connection', type: 'credential', integrationId: 'google-analytics', required: true },
      { key: 'days', label: 'Days', type: 'number', defaultValue: 30 },
      { key: 'limit', label: 'Limit', type: 'number', defaultValue: 10 }
    ],
    defaultSampleOutput: {
      pages: [
        { page: '/blog/seo-guide-2025', views: 15234, users: 12450, avgTime: 245, bounceRate: 0.32 },
        { page: '/products/analytics-tool', views: 9876, users: 8123, avgTime: 189, bounceRate: 0.45 },
        { page: '/pricing', views: 7543, users: 6234, avgTime: 156, bounceRate: 0.38 },
        { page: '/about', views: 5432, users: 4567, avgTime: 134, bounceRate: 0.41 },
        { page: '/blog/content-marketing', views: 4321, users: 3456, avgTime: 298, bounceRate: 0.29 }
      ],
      timeframe: '30 days',
      totalViews: 42406,
      totalUsers: 34830
    }
  },
  {
    type: 'ga-search-data',
    name: 'GA: Search Console Data',
    description: 'Get search performance from Google Search Console',
    category: 'analytics',
    icon: '🔍',
    color: 'bg-blue-500',
    configFields: [
      { key: 'days', label: 'Days', type: 'number', defaultValue: 30 }
    ],
    defaultSampleOutput: {
      queries: [
        { query: 'best seo tools', clicks: 1234, impressions: 45678, ctr: 0.027, position: 3.2 },
        { query: 'content marketing tips', clicks: 987, impressions: 32145, ctr: 0.031, position: 2.8 },
        { query: 'analytics platform', clicks: 765, impressions: 28934, ctr: 0.026, position: 4.1 }
      ],
      totalClicks: 2986,
      totalImpressions: 106757,
      avgCtr: 0.028,
      avgPosition: 3.4
    }
  },

  // Data Transformation
  {
    type: 'json-parse',
    name: 'Parse JSON',
    description: 'Parse JSON string to object',
    category: 'transform',
    icon: '📋',
    color: 'bg-purple-500',
    defaultSampleOutput: {
      parsed: {
        userId: '12345',
        event: 'purchase',
        amount: 99.99,
        items: ['Product A', 'Product B']
      },
      status: 'success'
    }
  },
  {
    type: 'filter',
    name: 'Filter',
    description: 'Filter array data',
    category: 'transform',
    icon: '🔍',
    color: 'bg-yellow-500',
    configFields: [
      { key: 'condition', label: 'Filter Condition', type: 'text', required: true }
    ],
    defaultSampleOutput: {
      filtered: [
        { id: 1, active: true, value: 100 },
        { id: 3, active: true, value: 150 }
      ],
      originalCount: 5,
      filteredCount: 2
    }
  },

  // Logic
  {
    type: 'conditional',
    name: 'Conditional Branch',
    description: 'Route workflow based on conditions - supports if/else if/else logic',
    category: 'logic',
    icon: '🔀',
    color: 'bg-cyan-500',
    configFields: [
      {
        key: 'conditions',
        label: 'Conditions (evaluated in order)',
        type: 'json',
        required: true,
        defaultValue: [
          { condition: 'data.value > 100', label: 'High Value', output: 'high' },
          { condition: 'data.value > 50', label: 'Medium Value', output: 'medium' },
          { condition: 'true', label: 'Default/Else', output: 'low' }
        ]
      },
      {
        key: 'mode',
        label: 'Evaluation Mode',
        type: 'select',
        defaultValue: 'first-match',
        options: [
          { label: 'First Match (if/else if/else)', value: 'first-match' },
          { label: 'All Matches (parallel execution)', value: 'all-matches' }
        ]
      }
    ],
    outputSchema: {
      type: 'object',
      properties: {
        matchedCondition: {
          type: 'object',
          properties: {
            condition: { type: 'string', description: 'The matched condition expression' },
            label: { type: 'string', description: 'Human-readable label for the condition' },
            output: { type: 'string', description: 'Output port identifier' },
            index: { type: 'number', description: 'Position in condition list (0-based)' }
          },
          required: ['condition', 'output', 'index']
        },
        allMatches: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              condition: { type: 'string' },
              label: { type: 'string' },
              output: { type: 'string' },
              index: { type: 'number' }
            }
          },
          description: 'All matched conditions (only in all-matches mode)'
        },
        inputData: {
          type: 'object',
          additionalProperties: true,
          description: 'Original input data that was evaluated'
        },
        evaluationMode: { type: 'string', enum: ['first-match', 'all-matches'] }
      },
      required: ['matchedCondition', 'inputData', 'evaluationMode']
    },
    defaultSampleOutput: {
      matchedCondition: {
        condition: 'data.value > 100',
        label: 'High Value',
        output: 'high',
        index: 0
      },
      allMatches: [
        {
          condition: 'data.value > 100',
          label: 'High Value',
          output: 'high',
          index: 0
        }
      ],
      inputData: {
        value: 150,
        category: 'premium',
        userId: 'usr_12345'
      },
      evaluationMode: 'first-match'
    }
  },
  {
    type: 'switch',
    name: 'Switch',
    description: 'Route based on value matching - like a switch/case statement',
    category: 'logic',
    icon: '🎛️',
    color: 'bg-blue-500',
    configFields: [
      {
        key: 'value',
        label: 'Value to Match',
        type: 'text',
        required: true,
        defaultValue: 'data.status'
      },
      {
        key: 'cases',
        label: 'Cases',
        type: 'json',
        required: true,
        defaultValue: [
          { match: 'active', output: 'active-users' },
          { match: 'pending', output: 'pending-users' },
          { match: 'inactive', output: 'inactive-users' },
          { match: 'default', output: 'other' }
        ]
      }
    ],
    outputSchema: {
      type: 'object',
      properties: {
        matchedCase: {
          type: 'object',
          properties: {
            match: { type: 'string', description: 'The value that was matched' },
            output: { type: 'string', description: 'Output port for this case' }
          },
          required: ['match', 'output']
        },
        inputValue: { type: 'string', description: 'The value that was evaluated' },
        inputData: { type: 'object', additionalProperties: true }
      },
      required: ['matchedCase', 'inputValue', 'inputData']
    },
    defaultSampleOutput: {
      matchedCase: {
        match: 'active',
        output: 'active-users'
      },
      inputValue: 'active',
      inputData: {
        status: 'active',
        userId: 'usr_12345',
        lastActive: '2025-09-30T10:30:00Z'
      }
    }
  },
  {
    type: 'delay',
    name: 'Delay',
    description: 'Wait for specified time',
    category: 'logic',
    icon: '⏱️',
    color: 'bg-gray-500',
    configFields: [
      { key: 'seconds', label: 'Delay (seconds)', type: 'number', required: true, defaultValue: 5 }
    ],
    defaultSampleOutput: {
      delayed: 5000,
      startedAt: '2025-09-30T10:30:00Z',
      completedAt: '2025-09-30T10:30:05Z'
    }
  },

  // Docker (executed on AWS ECS Fargate)
  {
    type: 'docker-run',
    name: 'Docker Container',
    description: 'Execute a Docker container on AWS ECS Fargate',
    category: 'compute',
    icon: '🐳',
    color: 'bg-blue-600',
    configFields: [
      { key: 'image', label: 'Image', type: 'text', required: true },
      { key: 'tag', label: 'Tag', type: 'text', defaultValue: 'latest' }
    ],
    outputSchema: {
      type: 'object',
      properties: {
        containerId: { type: 'string', description: 'ECS Task ARN' },
        exitCode: { type: 'number', description: 'Container exit code' },
        stdout: { type: 'string', description: 'Standard output from CloudWatch Logs' },
        stderr: { type: 'string', description: 'Standard error from CloudWatch Logs' },
        duration: { type: 'number', description: 'Execution time in seconds' },
        startedAt: { type: 'string', format: 'date-time' },
        finishedAt: { type: 'string', format: 'date-time' }
      },
      required: ['containerId', 'exitCode']
    }
  },

  // Agents
  {
    type: 'agent',
    name: 'Agent',
    description: 'AI agent task executor',
    category: 'agents',
    icon: '🤖',
    color: 'bg-purple-600',
    configFields: [
      { key: 'agentId', label: 'Agent', type: 'select', required: true },
      { key: 'prompt', label: 'Additional Instructions', type: 'textarea' },
      { key: 'model', label: 'Model', type: 'select', options: [
        { label: 'Claude 3.5 Sonnet', value: 'claude-3-5-sonnet-20241022' },
        { label: 'Claude 3 Opus', value: 'claude-3-opus-20240229' },
        { label: 'Claude 3 Haiku', value: 'claude-3-haiku-20240307' }
      ]},
      { key: 'temperature', label: 'Temperature', type: 'number', defaultValue: 0.7 }
    ],
    outputSchema: {
      type: 'object',
      properties: {
        agentId: { type: 'string', description: 'Agent identifier' },
        result: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['completed', 'failed', 'partial'] },
            output: { type: 'string', description: 'Agent output text' },
            artifacts: {
              type: 'array',
              items: { type: 'string' },
              description: 'Generated artifacts/files'
            },
            thinking: { type: 'string', description: 'Agent reasoning process' }
          },
          required: ['status', 'output']
        },
        tokensUsed: { type: 'number', description: 'LLM tokens consumed' },
        duration: { type: 'number', description: 'Execution time in seconds' }
      },
      required: ['agentId', 'result']
    }
  },
  {
    type: 'agent-conductor',
    name: 'Conductor Agent',
    description: 'Goal-driven planning and task delegation',
    category: 'agents',
    icon: '🎯',
    color: 'bg-indigo-500',
    configFields: [
      { key: 'task', label: 'Task Description', type: 'textarea', required: true },
      { key: 'priority', label: 'Priority', type: 'select', defaultValue: 'medium', options: [
        { label: 'Low', value: 'low' },
        { label: 'Medium', value: 'medium' },
        { label: 'High', value: 'high' }
      ]},
      { key: 'timeoutSeconds', label: 'Timeout (seconds)', type: 'number', defaultValue: 300 },
      { key: 'includeWorkflowContext', label: 'Include Workflow Context', type: 'select', defaultValue: 'true', options: [
        { label: 'Yes', value: 'true' },
        { label: 'No', value: 'false' }
      ]},
      { key: 'delegation.maxAgents', label: 'Max Agents', type: 'number', defaultValue: 3 },
      { key: 'delegation.preferredAgents', label: 'Preferred Agents', type: 'text' },
      { key: 'delegation.excludeAgents', label: 'Exclude Agents', type: 'text' },
      { key: 'context', label: 'Additional Context', type: 'json' }
    ],
    outputSchema: {
      type: 'object',
      properties: {
        agentType: { type: 'string', enum: ['conductor'] },
        task: { type: 'string' },
        status: { type: 'string', enum: ['completed', 'failed', 'partial'] },
        result: { type: 'object' },
        plan: {
          type: 'object',
          properties: {
            steps: { type: 'array' },
            estimatedDuration: { type: 'number' },
            complexity: { type: 'string' }
          }
        },
        execution: {
          type: 'object',
          properties: {
            duration: { type: 'number' },
            tokensUsed: { type: 'number' },
            agentsInvolved: { type: 'array' },
            confidence: { type: 'number' }
          }
        }
      }
    }
  },

  // Output
  {
    type: 'output',
    name: 'Output',
    description: 'Final workflow result',
    category: 'output',
    icon: '📤',
    color: 'bg-purple-500',
    defaultSampleOutput: {
      output: {
        status: 'completed',
        results: {
          processed: 42,
          successful: 40,
          failed: 2
        }
      },
      summary: 'Workflow completed successfully'
    }
  }
];

// Helper to get node definition by type
export function getNodeDefinition(type: string): NodeDefinition | undefined {
  return NODE_DEFINITIONS.find(def => def.type === type);
}

// Helper to get default sample output for a node type
export function getDefaultSampleOutput(type: string): any | undefined {
  const def = getNodeDefinition(type);
  // Prefer schema-based generation over hardcoded samples
  if (def?.outputSchema) {
    return undefined; // Signal to use SampleDataGenerator
  }
  return def?.defaultSampleOutput;
}

// Helper to get output schema for a node type
export function getNodeOutputSchema(type: string): any | undefined {
  const def = getNodeDefinition(type);
  return def?.outputSchema;
}

// Helper to apply default config and sample output to a node
export function applyNodeDefaults(node: any): any {
  const def = getNodeDefinition(node.type);
  if (!def) return node;

  return {
    ...node,
    config: {
      ...def.defaultConfig,
      ...node.config,
      // Add sample output if not already configured
      sampleOutput: node.config?.sampleOutput || def.defaultSampleOutput
    }
  };
}
