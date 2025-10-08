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
    description: 'Make HTTP API calls',
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
        help: 'The full URL to make the request to'
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
        placeholder: '{"Content-Type": "application/json"}',
        help: 'HTTP headers as JSON object'
      },
      {
        key: 'body',
        label: 'Request Body',
        type: 'textarea',
        placeholder: '{"key": "value"}',
        help: 'Request body for POST/PUT/PATCH requests'
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
  },
  {
    type: 'graphql-query',
    name: 'GraphQL Query',
    description: 'Execute GraphQL query',
    category: 'actions',
    subcategory: 'http',
    icon: '◈',
    color: 'bg-pink-500',
    fields: [
      {
        key: 'endpoint',
        label: 'GraphQL Endpoint',
        type: 'text',
        required: true,
        placeholder: 'https://api.example.com/graphql'
      },
      {
        key: 'query',
        label: 'GraphQL Query',
        type: 'textarea',
        required: true,
        placeholder: 'query { users { id name email } }',
        help: 'GraphQL query or mutation'
      },
      {
        key: 'variables',
        label: 'Variables',
        type: 'json',
        placeholder: '{"userId": "123"}',
        help: 'Query variables as JSON'
      },
      {
        key: 'headers',
        label: 'Headers',
        type: 'json',
        placeholder: '{"Authorization": "Bearer token"}',
        help: 'Additional HTTP headers'
      }
    ],
    defaultConfig: {
      headers: {},
      variables: {}
    },
    sampleOutput: {
      data: {
        users: [
          { id: '1', name: 'Alice', email: 'alice@example.com' },
          { id: '2', name: 'Bob', email: 'bob@example.com' }
        ]
      }
    }
  },
  {
    type: 'rest-api',
    name: 'REST API',
    description: 'RESTful API operations',
    category: 'actions',
    subcategory: 'http',
    icon: '🔌',
    color: 'bg-indigo-500',
    fields: [
      {
        key: 'baseUrl',
        label: 'Base URL',
        type: 'text',
        required: true,
        placeholder: 'https://api.example.com/v1',
        help: 'API base URL'
      },
      {
        key: 'resource',
        label: 'Resource Path',
        type: 'text',
        required: true,
        placeholder: '/users/{id}',
        help: 'Resource path (supports {param} placeholders)'
      },
      {
        key: 'operation',
        label: 'Operation',
        type: 'select',
        required: true,
        defaultValue: 'get',
        options: [
          { label: 'List (GET collection)', value: 'list' },
          { label: 'Get (GET single)', value: 'get' },
          { label: 'Create (POST)', value: 'create' },
          { label: 'Update (PUT)', value: 'update' },
          { label: 'Patch (PATCH)', value: 'patch' },
          { label: 'Delete (DELETE)', value: 'delete' }
        ]
      },
      {
        key: 'pathParams',
        label: 'Path Parameters',
        type: 'json',
        placeholder: '{"id": "123"}',
        help: 'Values for path placeholders'
      },
      {
        key: 'queryParams',
        label: 'Query Parameters',
        type: 'json',
        placeholder: '{"limit": 10, "offset": 0}',
        help: 'URL query parameters'
      },
      {
        key: 'body',
        label: 'Request Body',
        type: 'json',
        help: 'Request payload for create/update operations'
      }
    ],
    defaultConfig: {
      operation: 'get',
      pathParams: {},
      queryParams: {}
    },
    sampleOutput: {
      status: 200,
      data: {
        id: '123',
        name: 'Example Resource',
        createdAt: '2025-10-07T10:00:00Z'
      }
    }
  }
];
