/**
 * Data Transform Node Definitions
 * JSON parsing, filtering, etc.
 */

import type { NodeDefinition } from '../NodeRegistry';

export const TRANSFORM_NODES: NodeDefinition[] = [
  {
    type: 'json-parse',
    name: 'Parse JSON',
    description: 'Parse JSON string to object',
    category: 'data',
    subcategory: 'transform',
    icon: '📋',
    color: 'bg-purple-500',
    fields: [
      {
        key: 'input',
        label: 'JSON String',
        type: 'textarea',
        required: true,
        placeholder: '{"userId": "12345", "event": "purchase"}',
        help: 'JSON string to parse'
      }
    ],
    sampleOutput: {
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
    category: 'data',
    subcategory: 'transform',
    icon: '🔍',
    color: 'bg-yellow-500',
    fields: [
      {
        key: 'array',
        label: 'Input Array',
        type: 'json',
        required: true,
        help: 'Array to filter'
      },
      {
        key: 'condition',
        label: 'Filter Condition',
        type: 'text',
        required: true,
        placeholder: 'item.active === true',
        help: 'JavaScript expression to filter by'
      }
    ],
    sampleOutput: {
      filtered: [
        { id: 1, active: true, value: 100 },
        { id: 3, active: true, value: 150 }
      ],
      originalCount: 5,
      filteredCount: 2
    }
  }
];
