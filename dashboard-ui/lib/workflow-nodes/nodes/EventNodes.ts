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
  }
];
