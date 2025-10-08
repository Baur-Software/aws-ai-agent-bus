/**
 * Event Node Definitions
 * EventBridge nodes
 */

import type { NodeDefinition } from '../NodeRegistry';

export const EVENT_NODES: NodeDefinition[] = [
  {
    type: 'events-send',
    name: 'Send Event',
    description: 'Publish event to EventBridge',
    category: 'actions',
    subcategory: 'event',
    icon: '📡',
    color: 'bg-red-500',
    fields: [
      {
        key: 'detailType',
        label: 'Event Type',
        type: 'text',
        required: true,
        placeholder: 'user.signup',
        help: 'Event detail-type (e.g., user.signup, order.created)'
      },
      {
        key: 'detail',
        label: 'Event Data',
        type: 'json',
        required: true,
        placeholder: '{"userId": "123", "email": "user@example.com"}',
        help: 'Event payload as JSON object'
      },
      {
        key: 'source',
        label: 'Event Source',
        type: 'text',
        defaultValue: 'workflow-engine',
        placeholder: 'workflow-engine',
        help: 'Source identifier for the event'
      }
    ],
    defaultConfig: {
      source: 'workflow-engine'
    },
    sampleOutput: {
      eventId: 'evt_abc123xyz789',
      published: true,
      timestamp: '2025-09-30T10:30:00Z',
      detailType: 'user.signup',
      source: 'workflow-engine'
    }
  },
  {
    type: 'events-query',
    name: 'Query Events',
    description: 'Query historical events from DynamoDB',
    category: 'data',
    subcategory: 'event',
    icon: '🔍',
    color: 'bg-blue-500',
    fields: [
      {
        key: 'detailType',
        label: 'Event Type',
        type: 'text',
        placeholder: 'user.signup',
        help: 'Filter by event type (optional)'
      },
      {
        key: 'startTime',
        label: 'Start Time',
        type: 'text',
        placeholder: '2025-01-01T00:00:00Z',
        help: 'ISO 8601 timestamp (optional)'
      },
      {
        key: 'endTime',
        label: 'End Time',
        type: 'text',
        placeholder: '2025-12-31T23:59:59Z',
        help: 'ISO 8601 timestamp (optional)'
      },
      {
        key: 'limit',
        label: 'Limit',
        type: 'number',
        defaultValue: 100,
        help: 'Max number of events to return'
      }
    ],
    defaultConfig: {
      limit: 100
    },
    sampleOutput: {
      events: [
        { eventId: 'evt_123', detailType: 'user.signup', timestamp: '2025-10-07T10:00:00Z' },
        { eventId: 'evt_456', detailType: 'user.login', timestamp: '2025-10-07T10:05:00Z' }
      ],
      count: 2,
      hasMore: false
    }
  },
  {
    type: 'events-analytics',
    name: 'Event Analytics',
    description: 'Get event statistics and metrics',
    category: 'data',
    subcategory: 'event',
    icon: '📊',
    color: 'bg-purple-500',
    fields: [
      {
        key: 'detailType',
        label: 'Event Type',
        type: 'text',
        placeholder: 'user.signup',
        help: 'Filter by event type (optional)'
      },
      {
        key: 'timeRange',
        label: 'Time Range',
        type: 'select',
        defaultValue: 'last24h',
        options: [
          { label: 'Last Hour', value: 'last1h' },
          { label: 'Last 24 Hours', value: 'last24h' },
          { label: 'Last 7 Days', value: 'last7d' },
          { label: 'Last 30 Days', value: 'last30d' }
        ]
      }
    ],
    defaultConfig: {
      timeRange: 'last24h'
    },
    sampleOutput: {
      totalEvents: 1523,
      eventsByType: {
        'user.signup': 45,
        'user.login': 892,
        'order.created': 586
      },
      eventRate: 63.5,
      timeRange: 'last24h'
    }
  },
  {
    type: 'events-create-rule',
    name: 'Create Event Rule',
    description: 'Create EventBridge rule for event routing',
    category: 'actions',
    subcategory: 'event',
    icon: '⚙️',
    color: 'bg-orange-500',
    fields: [
      {
        key: 'ruleName',
        label: 'Rule Name',
        type: 'text',
        required: true,
        placeholder: 'signup-processor'
      },
      {
        key: 'eventPattern',
        label: 'Event Pattern',
        type: 'json',
        required: true,
        placeholder: '{"detail-type": ["user.signup"]}',
        help: 'EventBridge event pattern'
      },
      {
        key: 'targets',
        label: 'Targets',
        type: 'json',
        required: true,
        placeholder: '[{"Arn": "arn:aws:lambda:..."}]',
        help: 'Rule targets (Lambda, SNS, SQS, etc.)'
      }
    ],
    sampleOutput: {
      ruleArn: 'arn:aws:events:us-west-2:123456789012:rule/signup-processor',
      created: true
    }
  },
  {
    type: 'events-create-alert',
    name: 'Create Event Alert',
    description: 'Create alert subscription for events',
    category: 'actions',
    subcategory: 'event',
    icon: '🚨',
    color: 'bg-red-600',
    fields: [
      {
        key: 'alertName',
        label: 'Alert Name',
        type: 'text',
        required: true,
        placeholder: 'error-alerts'
      },
      {
        key: 'eventPattern',
        label: 'Event Pattern',
        type: 'json',
        required: true,
        placeholder: '{"detail-type": ["error.*"]}',
        help: 'Pattern to match events'
      },
      {
        key: 'notificationEndpoint',
        label: 'Notification Endpoint',
        type: 'text',
        required: true,
        placeholder: 'alerts@example.com or SNS ARN',
        help: 'Email or SNS topic ARN'
      }
    ],
    sampleOutput: {
      subscriptionArn: 'arn:aws:sns:us-west-2:123456789012:alerts:abc123',
      created: true,
      alertName: 'error-alerts'
    }
  },
  {
    type: 'events-health-check',
    name: 'Event System Health',
    description: 'Check event system health and status',
    category: 'data',
    subcategory: 'event',
    icon: '❤️',
    color: 'bg-green-500',
    fields: [],
    sampleOutput: {
      status: 'healthy',
      eventBusStatus: 'active',
      subscriptionsActive: 5,
      rulesActive: 12,
      lastEventReceived: '2025-10-07T10:00:00Z',
      eventsLast24h: 1523
    }
  }
];
