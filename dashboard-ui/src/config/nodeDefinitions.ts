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
  defaultSampleOutput?: any;
  configFields?: {
    key: string;
    label: string;
    type: 'text' | 'number' | 'select' | 'textarea' | 'json';
    required?: boolean;
    defaultValue?: any;
    options?: { label: string; value: any }[];
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
    defaultSampleOutput: {
      key: 'user-preferences',
      value: {
        theme: 'dark',
        language: 'en',
        notifications: true
      },
      ttl: 3600,
      timestamp: '2025-09-30T10:30:00Z'
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
    configFields: [
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
    type: 'condition',
    name: 'Condition',
    description: 'Branch based on condition',
    category: 'logic',
    icon: '🔀',
    color: 'bg-cyan-500',
    configFields: [
      { key: 'condition', label: 'Condition Expression', type: 'text', required: true }
    ],
    defaultSampleOutput: {
      condition: 'value > 100',
      result: true,
      branch: 'true-path'
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
  return def?.defaultSampleOutput;
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
