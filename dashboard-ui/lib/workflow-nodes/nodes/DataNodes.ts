/**
 * Data & Storage Node Definitions
 */

import type { NodeDefinition } from '../NodeRegistry';

export const DATA_NODES: NodeDefinition[] = [
  // KV Store Nodes
  {
    type: 'kv-get',
    name: 'Get Key-Value',
    description: 'Retrieve data from KV store',
    category: 'data',
    subcategory: 'kv',
    icon: '📥',
    color: 'bg-purple-500',
    hasDedicatedComponent: true,
    componentName: 'KVStoreNodeConfig',
    fields: [
      {
        key: 'key',
        label: 'Key',
        type: 'text',
        required: true,
        placeholder: 'my-key',
        help: 'The key to retrieve from the KV store'
      },
      {
        key: 'defaultValue',
        label: 'Default Value',
        type: 'text',
        help: 'Value to return if key does not exist'
      }
    ],
    defaultConfig: {
      key: '',
      defaultValue: null
    },
    sampleOutput: {
      key: 'user-settings',
      value: '{"theme": "dark", "language": "en"}',
      found: true,
      ttl: 86400
    }
  },
  {
    type: 'kv-set',
    name: 'Set Key-Value',
    description: 'Store data in KV store',
    category: 'data',
    subcategory: 'kv',
    icon: '📤',
    color: 'bg-purple-600',
    hasDedicatedComponent: true,
    componentName: 'KVStoreNodeConfig',
    fields: [
      {
        key: 'key',
        label: 'Key',
        type: 'text',
        required: true,
        placeholder: 'my-key',
        help: 'The key to store in the KV store'
      },
      {
        key: 'value',
        label: 'Value',
        type: 'textarea',
        required: true,
        help: 'The value to store (can be JSON)'
      },
      {
        key: 'ttlHours',
        label: 'TTL (hours)',
        type: 'number',
        defaultValue: 24,
        help: 'Time to live in hours (0 = never expires)'
      }
    ],
    defaultConfig: {
      key: '',
      value: '',
      ttlHours: 24
    },
    sampleOutput: {
      key: 'user-settings',
      stored: true,
      expiresAt: '2025-10-08T10:00:00Z'
    }
  },
  // NOTE: kv-delete removed - no MCP tool backing
  // Use kv-set with empty/null value or TTL expiration instead

  // NOTE: s3-get and s3-put removed - use artifact nodes instead
  // See StorageNodes.ts for artifacts-get, artifacts-put, artifacts-list
  // Artifact nodes work with the configured S3 artifacts bucket

  // Transform Nodes (client-side operations)
  {
    type: 'json-parse',
    name: 'Parse JSON',
    description: 'Parse JSON string to object',
    category: 'data',
    subcategory: 'transform',
    icon: '📋',
    color: 'bg-blue-500',
    fields: [
      {
        key: 'input',
        label: 'JSON String',
        type: 'textarea',
        required: true,
        placeholder: '{"key": "value"}'
      }
    ],
    sampleOutput: {
      parsed: { key: 'value' },
      success: true
    }
  },
  {
    type: 'json-stringify',
    name: 'Stringify JSON',
    description: 'Convert object to JSON string',
    category: 'data',
    subcategory: 'transform',
    icon: '📝',
    color: 'bg-blue-600',
    fields: [
      {
        key: 'input',
        label: 'Object',
        type: 'json',
        required: true
      },
      {
        key: 'pretty',
        label: 'Pretty Print',
        type: 'checkbox',
        defaultValue: true,
        help: 'Format with indentation'
      }
    ],
    defaultConfig: {
      pretty: true
    },
    sampleOutput: {
      json: '{\n  "key": "value"\n}',
      success: true
    }
  },
  {
    type: 'data-transform',
    name: 'Transform Data',
    description: 'Map, filter, and transform data',
    category: 'data',
    subcategory: 'transform',
    icon: '🔄',
    color: 'bg-cyan-500',
    fields: [
      {
        key: 'input',
        label: 'Input Data',
        type: 'json',
        required: true
      },
      {
        key: 'operation',
        label: 'Operation',
        type: 'select',
        required: true,
        options: [
          { label: 'Map (transform items)', value: 'map' },
          { label: 'Filter (select items)', value: 'filter' },
          { label: 'Reduce (aggregate)', value: 'reduce' },
          { label: 'Sort', value: 'sort' },
          { label: 'Group By', value: 'groupBy' }
        ]
      },
      {
        key: 'expression',
        label: 'Expression',
        type: 'textarea',
        required: true,
        help: 'JavaScript expression (e.g., "item.value * 2")'
      }
    ],
    sampleOutput: {
      result: [1, 2, 3, 4, 5],
      count: 5
    }
  }
];
