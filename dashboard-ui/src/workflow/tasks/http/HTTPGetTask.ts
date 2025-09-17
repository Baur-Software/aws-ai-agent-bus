// HTTP GET Task
// Performs HTTP GET requests with authentication and error handling

import {
  WorkflowTask,
  WorkflowContext,
  ValidationResult,
  TaskConfigSchema,
  TaskDisplayInfo,
  Logger,
  TaskExecutionError,
  NODE_CATEGORIES
} from '../../types';

import { HTTPService, HTTPRequestOptions, HTTPResponse } from '../../../services';

export interface HTTPGetInput {
  url: string;
  headers?: Record<string, string>;
  params?: Record<string, any>;
  timeout?: number;
  auth?: {
    type: 'bearer' | 'basic' | 'apikey';
    token?: string;
    username?: string;
    password?: string;
    headerName?: string;
  };
  useContextUrl?: boolean;
  contextUrlKey?: string;
}

export interface HTTPGetOutput {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: any;
  url: string;
  method: 'GET';
  duration: number;
  success: boolean;
  timestamp: string;
}

export class HTTPGetTask implements WorkflowTask<HTTPGetInput, HTTPGetOutput> {
  readonly type = 'http-get';

  constructor(
    private httpService: HTTPService,
    private logger?: Logger
  ) {}

  async execute(input: HTTPGetInput, context: WorkflowContext): Promise<HTTPGetOutput> {
    const startTime = Date.now();
    
    // Determine URL
    let url = input.url;
    if (input.useContextUrl) {
      const contextKey = input.contextUrlKey || 'url';
      const contextUrl = context.data[contextKey];
      if (!contextUrl) {
        throw new Error(`Context URL key '${contextKey}' not found`);
      }
      url = contextUrl;
    }

    this.logger?.info(`Making GET request to: ${url}`);

    try {
      const options: HTTPRequestOptions = {
        headers: input.headers,
        params: input.params,
        timeout: input.timeout,
        auth: input.auth
      };

      const response: HTTPResponse = await this.httpService.get(url, options);

      const output: HTTPGetOutput = {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        data: response.data,
        url: response.url,
        method: 'GET',
        duration: Date.now() - startTime,
        success: response.status >= 200 && response.status < 300,
        timestamp: new Date().toISOString()
      };

      this.logger?.info(`GET request completed: ${response.status} ${response.statusText} (${output.duration}ms)`);

      // Store response data in context for downstream tasks
      context.data.httpResponse = response.data;
      context.data.httpStatus = response.status;
      context.data.httpHeaders = response.headers;

      return output;

    } catch (error) {
      this.logger?.error('HTTP GET request failed:', error);
      throw new TaskExecutionError(
        `HTTP GET request failed: ${error.message}`,
        this.type,
        context.nodeId,
        input
      );
    }
  }

  validate(input: HTTPGetInput): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!input.useContextUrl && (!input.url || input.url.trim().length === 0)) {
      errors.push('URL is required when not using context URL');
    }

    if (input.url) {
      try {
        new URL(input.url);
      } catch {
        errors.push('URL must be a valid URL');
      }
    }

    if (input.useContextUrl && !input.contextUrlKey) {
      warnings.push('No context URL key specified, will use "url"');
    }

    if (input.timeout && (input.timeout < 1000 || input.timeout > 300000)) {
      warnings.push('Timeout should be between 1000ms and 300000ms (5 minutes)');
    }

    if (input.auth) {
      if (!['bearer', 'basic', 'apikey'].includes(input.auth.type)) {
        errors.push('Auth type must be "bearer", "basic", or "apikey"');
      }

      if (input.auth.type === 'bearer' && !input.auth.token) {
        errors.push('Bearer token is required for bearer auth');
      }

      if (input.auth.type === 'basic' && (!input.auth.username || !input.auth.password)) {
        errors.push('Username and password are required for basic auth');
      }

      if (input.auth.type === 'apikey' && !input.auth.token) {
        errors.push('API key token is required for API key auth');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  getSchema(): TaskConfigSchema {
    return {
      type: 'object',
      title: 'HTTP GET Request',
      description: 'Make an HTTP GET request to retrieve data',
      properties: {
        url: {
          type: 'string',
          title: 'Request URL',
          description: 'URL to make the GET request to',
          format: 'uri'
        },
        headers: {
          type: 'object',
          title: 'HTTP Headers',
          description: 'Custom headers to include in the request'
        },
        params: {
          type: 'object',
          title: 'Query Parameters',
          description: 'Query parameters to append to the URL'
        },
        timeout: {
          type: 'number',
          title: 'Request Timeout (ms)',
          description: 'Request timeout in milliseconds',
          default: 30000,
          minimum: 1000,
          maximum: 300000
        },
        auth: {
          type: 'object',
          title: 'Authentication',
          description: 'Authentication configuration',
          properties: {
            type: {
              type: 'string',
              enum: ['bearer', 'basic', 'apikey'],
              title: 'Auth Type'
            },
            token: {
              type: 'string',
              title: 'Token/API Key'
            },
            username: {
              type: 'string',
              title: 'Username (for basic auth)'
            },
            password: {
              type: 'string',
              title: 'Password (for basic auth)'
            },
            headerName: {
              type: 'string',
              title: 'Header Name (for API key)',
              default: 'X-API-Key'
            }
          }
        },
        useContextUrl: {
          type: 'boolean',
          title: 'Use URL from Context',
          description: 'Get URL from workflow context data',
          default: false
        },
        contextUrlKey: {
          type: 'string',
          title: 'Context URL Key',
          description: 'Key to use from context data for URL',
          default: 'url'
        }
      },
      required: [],
      examples: [
        {
          url: 'https://api.example.com/data',
          params: { page: 1, limit: 10 },
          auth: { type: 'bearer', token: 'your-token-here' }
        },
        {
          useContextUrl: true,
          contextUrlKey: 'apiEndpoint',
          headers: { 'Content-Type': 'application/json' }
        }
      ]
    };
  }

  getDisplayInfo(): TaskDisplayInfo {
    return {
      category: NODE_CATEGORIES.HTTP_API,
      label: 'HTTP GET',
      icon: 'Globe',
      color: 'bg-indigo-600',
      description: 'Make HTTP GET requests to retrieve data',
      tags: ['http', 'api', 'get', 'request', 'data']
    };
  }
}