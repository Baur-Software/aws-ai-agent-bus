/**
 * HTTP Node Definitions
 *
 * All HTTP/API request nodes defined here.
 */

import type { NodeDefinition } from '../NodeRegistry';

export const HTTP_NODES: NodeDefinition[] = [
  {
    type: 'http-request',
    name: 'HTTP Request',
    description: 'Make HTTP/REST/GraphQL API calls with full control',
    category: 'actions',
    subcategory: 'http',
    icon: '🌐',
    color: 'bg-blue-500',
    hasDedicatedComponent: true,
    componentName: 'HttpNodeConfig',
    fields: [
      {
        key: 'url',
        label: 'URL',
        type: 'text',
        required: true,
        placeholder: 'https://api.example.com/endpoint',
        help: 'The full URL to make the request to (supports REST APIs, GraphQL endpoints, etc.)'
      },
      {
        key: 'method',
        label: 'HTTP Method',
        type: 'select',
        required: true,
        defaultValue: 'GET',
        options: [
          { label: 'GET', value: 'GET' },
          { label: 'POST', value: 'POST' },
          { label: 'PUT', value: 'PUT' },
          { label: 'PATCH', value: 'PATCH' },
          { label: 'DELETE', value: 'DELETE' },
          { label: 'HEAD', value: 'HEAD' },
          { label: 'OPTIONS', value: 'OPTIONS' }
        ]
      },
      {
        key: 'headers',
        label: 'Headers',
        type: 'json',
        placeholder: '{"Content-Type": "application/json", "Authorization": "Bearer token"}',
        help: 'HTTP headers as JSON object'
      },
      {
        key: 'body',
        label: 'Request Body',
        type: 'textarea',
        placeholder: '{"key": "value"} or GraphQL query { users { id name } }',
        help: 'Request body for POST/PUT/PATCH requests (JSON, GraphQL query, etc.)'
      },
      {
        key: 'timeout',
        label: 'Timeout (ms)',
        type: 'number',
        defaultValue: 30000,
        help: 'Request timeout in milliseconds'
      },
      {
        key: 'retries',
        label: 'Retry Attempts',
        type: 'number',
        defaultValue: 0,
        help: 'Number of retry attempts on failure'
      }
    ],
    defaultConfig: {
      method: 'GET',
      timeout: 30000,
      retries: 0,
      headers: {}
    },
    sampleOutput: {
      status: 200,
      headers: {
        'content-type': 'application/json'
      },
      body: {
        success: true,
        data: {
          id: 123,
          name: 'Example'
        }
      },
      duration: 145
    }
  }
];
