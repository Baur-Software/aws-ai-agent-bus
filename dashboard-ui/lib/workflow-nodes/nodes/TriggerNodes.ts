/**
 * Trigger Node Definitions
 *
 * All trigger-type nodes defined here using the standardized NodeDefinition interface.
 */

import type { NodeDefinition } from '../NodeRegistry';

export const TRIGGER_NODES: NodeDefinition[] = [
  {
    type: 'trigger',
    name: 'Manual Trigger',
    description: 'Start workflow manually',
    category: 'triggers',
    subcategory: 'manual',
    icon: '▶️',
    color: 'bg-green-500',
    hasDedicatedComponent: true,
    componentName: 'TriggerNodeConfig',
    defaultConfig: {
      triggerType: 'manual',
      requiresConfirmation: false
    },
    sampleOutput: {
      status: 'triggered',
      timestamp: '2025-10-07T10:30:00Z',
      triggeredBy: 'user'
    }
  },
  {
    type: 'webhook',
    name: 'Webhook Trigger',
    description: 'HTTP webhook trigger',
    category: 'triggers',
    subcategory: 'webhook',
    icon: '🔗',
    color: 'bg-blue-500',
    hasDedicatedComponent: true,
    componentName: 'TriggerNodeConfig',
    defaultConfig: {
      triggerType: 'webhook',
      method: 'POST',
      authentication: 'none'
    },
    fields: [
      {
        key: 'path',
        label: 'Webhook Path',
        type: 'text',
        required: true,
        placeholder: '/webhooks/my-endpoint',
        help: 'The URL path for this webhook'
      },
      {
        key: 'method',
        label: 'HTTP Method',
        type: 'select',
        defaultValue: 'POST',
        options: [
          { label: 'POST', value: 'POST' },
          { label: 'GET', value: 'GET' },
          { label: 'PUT', value: 'PUT' },
          { label: 'DELETE', value: 'DELETE' }
        ]
      },
      {
        key: 'authentication',
        label: 'Authentication',
        type: 'select',
        defaultValue: 'none',
        options: [
          { label: 'None', value: 'none' },
          { label: 'API Key', value: 'api-key' },
          { label: 'Bearer Token', value: 'bearer' },
          { label: 'Basic Auth', value: 'basic' }
        ]
      }
    ],
    sampleOutput: {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': 'Sample-Client/1.0'
      },
      body: {
        event: 'user.created',
        userId: 'usr_12345',
        email: 'user@example.com'
      },
      timestamp: '2025-10-07T10:30:00Z'
    }
  },
  {
    type: 'schedule',
    name: 'Schedule Trigger',
    description: 'Time-based trigger (cron)',
    category: 'triggers',
    subcategory: 'schedule',
    icon: '⏰',
    color: 'bg-yellow-500',
    hasDedicatedComponent: true,
    componentName: 'TriggerNodeConfig',
    defaultConfig: {
      triggerType: 'schedule',
      schedule: '0 9 * * *', // 9am daily
      timezone: 'UTC'
    },
    fields: [
      {
        key: 'schedule',
        label: 'Schedule (Cron)',
        type: 'select',
        required: true,
        defaultValue: '0 9 * * *',
        options: [
          { label: 'Every 5 minutes', value: '*/5 * * * *' },
          { label: 'Every hour', value: '0 * * * *' },
          { label: 'Daily at 9am', value: '0 9 * * *' },
          { label: 'Weekly on Monday', value: '0 9 * * 1' },
          { label: 'Monthly on 1st', value: '0 9 1 * *' },
          { label: 'Custom', value: 'custom' }
        ]
      },
      {
        key: 'customSchedule',
        label: 'Custom Cron Expression',
        type: 'text',
        placeholder: '0 */6 * * *',
        help: 'Only used when "Custom" is selected'
      },
      {
        key: 'timezone',
        label: 'Timezone',
        type: 'select',
        defaultValue: 'UTC',
        options: [
          { label: 'UTC', value: 'UTC' },
          { label: 'America/New_York', value: 'America/New_York' },
          { label: 'America/Los_Angeles', value: 'America/Los_Angeles' },
          { label: 'Europe/London', value: 'Europe/London' },
          { label: 'Asia/Tokyo', value: 'Asia/Tokyo' }
        ]
      }
    ],
    sampleOutput: {
      scheduledTime: '2025-10-07T09:00:00Z',
      actualTime: '2025-10-07T09:00:01Z',
      timezone: 'UTC',
      cronExpression: '0 9 * * *'
    }
  },
  {
    type: 'event-trigger',
    name: 'Event Trigger',
    description: 'EventBridge event trigger',
    category: 'triggers',
    subcategory: 'event',
    icon: '📡',
    color: 'bg-purple-500',
    fields: [
      {
        key: 'eventPattern',
        label: 'Event Pattern',
        type: 'json',
        required: true,
        help: 'EventBridge event pattern to match',
        defaultValue: {
          source: ['custom.app'],
          'detail-type': ['User Action']
        }
      },
      {
        key: 'eventBusName',
        label: 'Event Bus',
        type: 'text',
        defaultValue: 'default',
        help: 'EventBridge event bus name'
      }
    ],
    defaultConfig: {
      eventPattern: {
        source: ['custom.app'],
        'detail-type': ['User Action']
      },
      eventBusName: 'default'
    },
    sampleOutput: {
      source: 'custom.app',
      'detail-type': 'User Action',
      detail: {
        action: 'login',
        userId: 'usr_12345',
        timestamp: '2025-10-07T10:30:00Z'
      },
      time: '2025-10-07T10:30:00Z'
    }
  }
];
