/**
 * Integration Node Definitions
 * Third-party service integrations
 */

import type { NodeDefinition } from '../NodeRegistry';

export const INTEGRATION_NODES: NodeDefinition[] = [
  // Communication
  {
    type: 'slack-message',
    name: 'Send Slack Message',
    description: 'Post message to Slack channel',
    category: 'integrations',
    subcategory: 'communication',
    icon: '💬',
    color: 'bg-purple-500',
    requiresIntegration: 'slack',
    requiresCredentials: true,
    fields: [
      {
        key: 'channel',
        label: 'Channel',
        type: 'text',
        required: true,
        placeholder: '#general',
        help: 'Channel name or ID'
      },
      {
        key: 'message',
        label: 'Message',
        type: 'textarea',
        required: true,
        placeholder: 'Hello from workflow!'
      },
      {
        key: 'username',
        label: 'Bot Username',
        type: 'text',
        placeholder: 'Workflow Bot'
      },
      {
        key: 'iconEmoji',
        label: 'Icon Emoji',
        type: 'text',
        placeholder: ':robot_face:'
      }
    ],
    defaultConfig: {
      channel: '#general'
    },
    sampleOutput: {
      ok: true,
      channel: 'C12345',
      ts: '1234567890.123456',
      message: { text: 'Hello from workflow!' }
    }
  },
  {
    type: 'email-send',
    name: 'Send Email',
    description: 'Send email via SES',
    category: 'integrations',
    subcategory: 'communication',
    icon: '📧',
    color: 'bg-blue-500',
    fields: [
      {
        key: 'to',
        label: 'To',
        type: 'text',
        required: true,
        placeholder: 'user@example.com',
        help: 'Recipient email address'
      },
      {
        key: 'subject',
        label: 'Subject',
        type: 'text',
        required: true,
        placeholder: 'Workflow Notification'
      },
      {
        key: 'body',
        label: 'Body',
        type: 'textarea',
        required: true,
        help: 'Email body (plain text or HTML)'
      },
      {
        key: 'from',
        label: 'From',
        type: 'text',
        placeholder: 'noreply@example.com'
      }
    ],
    sampleOutput: {
      messageId: '<abc123@example.com>',
      sent: true
    }
  },

  // Productivity
  {
    type: 'google-sheets-read',
    name: 'Read Google Sheet',
    description: 'Read data from Google Sheets',
    category: 'integrations',
    subcategory: 'productivity',
    icon: '📊',
    color: 'bg-green-500',
    requiresIntegration: 'google',
    requiresCredentials: true,
    fields: [
      {
        key: 'spreadsheetId',
        label: 'Spreadsheet ID',
        type: 'text',
        required: true,
        help: 'The ID from the spreadsheet URL'
      },
      {
        key: 'range',
        label: 'Range',
        type: 'text',
        required: true,
        defaultValue: 'Sheet1!A1:Z100',
        placeholder: 'Sheet1!A1:Z100'
      }
    ],
    defaultConfig: {
      range: 'Sheet1!A1:Z100'
    },
    sampleOutput: {
      values: [
        ['Name', 'Email', 'Status'],
        ['John Doe', 'john@example.com', 'Active'],
        ['Jane Smith', 'jane@example.com', 'Inactive']
      ],
      rowCount: 3
    }
  },
  {
    type: 'google-sheets-write',
    name: 'Write Google Sheet',
    description: 'Write data to Google Sheets',
    category: 'integrations',
    subcategory: 'productivity',
    icon: '📝',
    color: 'bg-green-600',
    requiresIntegration: 'google',
    requiresCredentials: true,
    fields: [
      {
        key: 'spreadsheetId',
        label: 'Spreadsheet ID',
        type: 'text',
        required: true
      },
      {
        key: 'range',
        label: 'Range',
        type: 'text',
        required: true,
        defaultValue: 'Sheet1!A1',
        placeholder: 'Sheet1!A1'
      },
      {
        key: 'values',
        label: 'Values',
        type: 'json',
        required: true,
        placeholder: '[["A1", "B1"], ["A2", "B2"]]',
        help: '2D array of values'
      }
    ],
    defaultConfig: {
      range: 'Sheet1!A1'
    },
    sampleOutput: {
      updatedCells: 4,
      updatedRange: 'Sheet1!A1:B2'
    }
  },

  // CRM
  {
    type: 'hubspot-contact-create',
    name: 'Create HubSpot Contact',
    description: 'Create contact in HubSpot',
    category: 'integrations',
    subcategory: 'crm',
    icon: '👤',
    color: 'bg-orange-500',
    requiresIntegration: 'hubspot',
    requiresCredentials: true,
    fields: [
      {
        key: 'email',
        label: 'Email',
        type: 'text',
        required: true,
        placeholder: 'contact@example.com'
      },
      {
        key: 'firstName',
        label: 'First Name',
        type: 'text'
      },
      {
        key: 'lastName',
        label: 'Last Name',
        type: 'text'
      },
      {
        key: 'properties',
        label: 'Additional Properties',
        type: 'json',
        placeholder: '{"company": "Acme Corp"}',
        help: 'Custom HubSpot properties'
      }
    ],
    sampleOutput: {
      id: '12345',
      email: 'contact@example.com',
      createdAt: '2025-10-07T10:00:00Z'
    }
  },
  {
    type: 'salesforce-lead-create',
    name: 'Create Salesforce Lead',
    description: 'Create lead in Salesforce',
    category: 'integrations',
    subcategory: 'crm',
    icon: '☁️',
    color: 'bg-blue-600',
    requiresIntegration: 'salesforce',
    requiresCredentials: true,
    fields: [
      {
        key: 'email',
        label: 'Email',
        type: 'text',
        required: true
      },
      {
        key: 'firstName',
        label: 'First Name',
        type: 'text',
        required: true
      },
      {
        key: 'lastName',
        label: 'Last Name',
        type: 'text',
        required: true
      },
      {
        key: 'company',
        label: 'Company',
        type: 'text',
        required: true
      },
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        defaultValue: 'Open - Not Contacted',
        options: [
          { label: 'Open - Not Contacted', value: 'Open - Not Contacted' },
          { label: 'Working - Contacted', value: 'Working - Contacted' },
          { label: 'Closed - Converted', value: 'Closed - Converted' },
          { label: 'Closed - Not Converted', value: 'Closed - Not Converted' }
        ]
      }
    ],
    defaultConfig: {
      status: 'Open - Not Contacted'
    },
    sampleOutput: {
      id: '00Q1234567890ABC',
      success: true
    }
  },

  // Payment
  {
    type: 'stripe-payment',
    name: 'Create Stripe Payment',
    description: 'Process payment with Stripe',
    category: 'integrations',
    subcategory: 'payment',
    icon: '💳',
    color: 'bg-indigo-500',
    requiresIntegration: 'stripe',
    requiresCredentials: true,
    fields: [
      {
        key: 'amount',
        label: 'Amount (cents)',
        type: 'number',
        required: true,
        help: 'Amount in cents (e.g., 1000 = $10.00)'
      },
      {
        key: 'currency',
        label: 'Currency',
        type: 'select',
        defaultValue: 'usd',
        options: [
          { label: 'USD', value: 'usd' },
          { label: 'EUR', value: 'eur' },
          { label: 'GBP', value: 'gbp' }
        ]
      },
      {
        key: 'description',
        label: 'Description',
        type: 'text',
        placeholder: 'Payment for services'
      },
      {
        key: 'customerEmail',
        label: 'Customer Email',
        type: 'text',
        placeholder: 'customer@example.com'
      }
    ],
    defaultConfig: {
      currency: 'usd'
    },
    sampleOutput: {
      id: 'pi_1234567890',
      amount: 1000,
      currency: 'usd',
      status: 'succeeded',
      created: 1696680000
    }
  },

  // Analytics
  {
    type: 'google-analytics-query',
    name: 'Google Analytics Query',
    description: 'Query Google Analytics data',
    category: 'integrations',
    subcategory: 'analytics',
    icon: '📈',
    color: 'bg-yellow-500',
    requiresIntegration: 'google-analytics',
    requiresCredentials: true,
    fields: [
      {
        key: 'propertyId',
        label: 'Property ID',
        type: 'text',
        required: true,
        placeholder: '123456789'
      },
      {
        key: 'metrics',
        label: 'Metrics',
        type: 'json',
        required: true,
        defaultValue: ['activeUsers'],
        help: 'Array of metrics to query'
      },
      {
        key: 'dimensions',
        label: 'Dimensions',
        type: 'json',
        defaultValue: ['country'],
        help: 'Array of dimensions to group by'
      },
      {
        key: 'dateRange',
        label: 'Date Range',
        type: 'select',
        defaultValue: 'last7Days',
        options: [
          { label: 'Last 7 Days', value: 'last7Days' },
          { label: 'Last 30 Days', value: 'last30Days' },
          { label: 'Last 90 Days', value: 'last90Days' },
          { label: 'Custom', value: 'custom' }
        ]
      }
    ],
    defaultConfig: {
      metrics: ['activeUsers'],
      dimensions: ['country'],
      dateRange: 'last7Days'
    },
    sampleOutput: {
      rows: [
        { country: 'United States', activeUsers: 1234 },
        { country: 'United Kingdom', activeUsers: 567 }
      ],
      rowCount: 2
    }
  },

  // GitHub
  {
    type: 'github-issue-create',
    name: 'Create GitHub Issue',
    description: 'Create issue on GitHub',
    category: 'integrations',
    subcategory: 'productivity',
    icon: '🐙',
    color: 'bg-gray-700',
    requiresIntegration: 'github',
    requiresCredentials: true,
    fields: [
      {
        key: 'owner',
        label: 'Owner',
        type: 'text',
        required: true,
        placeholder: 'username'
      },
      {
        key: 'repo',
        label: 'Repository',
        type: 'text',
        required: true,
        placeholder: 'repo-name'
      },
      {
        key: 'title',
        label: 'Title',
        type: 'text',
        required: true
      },
      {
        key: 'body',
        label: 'Body',
        type: 'textarea',
        help: 'Issue description (Markdown supported)'
      },
      {
        key: 'labels',
        label: 'Labels',
        type: 'json',
        placeholder: '["bug", "high-priority"]',
        help: 'Array of label names'
      }
    ],
    sampleOutput: {
      number: 123,
      html_url: 'https://github.com/owner/repo/issues/123',
      state: 'open'
    }
  }
];
