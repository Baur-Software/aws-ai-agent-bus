// HTTP POST Task
// Performs HTTP POST requests with body data

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

export interface HTTPPostInput {
  url: string;
  body: any;
  headers?: Record<string, string>;
  timeout?: number;
  auth?: {
    type: 'bearer' | 'basic' | 'apikey';
    token?: string;
    username?: string;
    password?: string;
    headerName?: string;
  };
  useContextBody?: boolean;
  contextBodyField?: string;
}

export interface HTTPPostOutput {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: any;
  url: string;
  method: 'POST';
  duration: number;
  success: boolean;
  timestamp: string;
}

export class HTTPPostTask implements WorkflowTask<HTTPPostInput, HTTPPostOutput> {
  readonly type = 'http-post';

  constructor(
    private httpService: {
      post: (url: string, body: any, options?: any) => Promise<any>;
    },
    private logger?: Logger
  ) {}

  async execute(input: HTTPPostInput, context: WorkflowContext): Promise<HTTPPostOutput> {
    const startTime = Date.now();

    // Determine body to send
    let body = input.body;
    if (input.useContextBody) {
      const contextField = input.contextBodyField || 'body';
      const contextBody = context.data[contextField];
      if (contextBody === undefined) {
        throw new TaskExecutionError(
          `Context body field '${contextField}' not found`,
          this.type,
          context.nodeId,
          input
        );
      }
      body = contextBody;
    }

    this.logger?.info(`Making POST request to: ${input.url}`);

    try {
      const options = {
        headers: input.headers,
        timeout: input.timeout,
        auth: input.auth
      };

      const response = await this.httpService.post(input.url, body, options);

      const output: HTTPPostOutput = {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        data: response.data,
        url: response.url,
        method: 'POST',
        duration: Date.now() - startTime,
        success: response.status >= 200 && response.status < 300,
        timestamp: new Date().toISOString()
      };

      this.logger?.info(`POST request completed: ${response.status} ${response.statusText} (${output.duration}ms)`);

      // Store response in context
      context.data.httpResponse = response.data;
      context.data.httpStatus = response.status;
      context.data.httpHeaders = response.headers;

      return output;

    } catch (error) {
      this.logger?.error('HTTP POST request failed:', error);
      throw new TaskExecutionError(
        `HTTP POST request failed: ${error.message}`,
        this.type,
        context.nodeId,
        input
      );
    }
  }

  validate(input: HTTPPostInput): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!input.url || input.url.trim().length === 0) {
      errors.push('URL is required');
    }

    if (input.url) {
      try {
        new URL(input.url);
      } catch {
        errors.push('URL must be a valid URL');
      }
    }

    if (!input.useContextBody && input.body === undefined) {
      warnings.push('No body provided, will send empty POST request');
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
      title: 'HTTP POST Request',
      description: 'Make an HTTP POST request to send data',
      properties: {
        url: {
          type: 'string',
          title: 'Request URL',
          description: 'URL to make the POST request to',
          format: 'uri'
        },
        body: {
          type: 'object',
          title: 'Request Body',
          description: 'Data to send in the request body'
        },
        headers: {
          type: 'object',
          title: 'HTTP Headers',
          description: 'Custom headers to include in the request'
        },
        timeout: {
          type: 'number',
          title: 'Request Timeout (ms)',
          description: 'Request timeout in milliseconds',
          default: 30000,
          minimum: 1000,
          maximum: 300000
        },
        useContextBody: {
          type: 'boolean',
          title: 'Use Body from Context',
          description: 'Get request body from workflow context data',
          default: false
        },
        contextBodyField: {
          type: 'string',
          title: 'Context Body Field',
          description: 'Key to use from context data for body',
          default: 'body'
        }
      },
      required: ['url']
    };
  }

  getDisplayInfo(): TaskDisplayInfo {
    return {
      category: NODE_CATEGORIES.HTTP_API,
      label: 'HTTP POST',
      icon: '📤',
      color: 'bg-green-600',
      description: 'Make HTTP POST requests to send data',
      tags: ['http', 'api', 'post', 'request', 'send']
    };
  }
}
