// HTTP PUT Task
// Performs HTTP PUT requests to update resources

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

export interface HTTPPutInput {
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

export interface HTTPPutOutput {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: any;
  url: string;
  method: 'PUT';
  duration: number;
  success: boolean;
  timestamp: string;
}

export class HTTPPutTask implements WorkflowTask<HTTPPutInput, HTTPPutOutput> {
  readonly type = 'http-put';

  constructor(
    private httpService: {
      put: (url: string, body: any, options?: any) => Promise<any>;
    },
    private logger?: Logger
  ) {}

  async execute(input: HTTPPutInput, context: WorkflowContext): Promise<HTTPPutOutput> {
    const startTime = Date.now();

    // Determine body
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

    this.logger?.info(`Making PUT request to: ${input.url}`);

    try {
      const options = {
        headers: input.headers,
        timeout: input.timeout,
        auth: input.auth
      };

      const response = await this.httpService.put(input.url, body, options);

      const output: HTTPPutOutput = {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        data: response.data,
        url: response.url,
        method: 'PUT',
        duration: Date.now() - startTime,
        success: response.status >= 200 && response.status < 300,
        timestamp: new Date().toISOString()
      };

      this.logger?.info(`PUT request completed: ${response.status} ${response.statusText} (${output.duration}ms)`);

      context.data.httpResponse = response.data;
      context.data.httpStatus = response.status;

      return output;

    } catch (error) {
      this.logger?.error('HTTP PUT request failed:', error);
      throw new TaskExecutionError(
        `HTTP PUT request failed: ${error.message}`,
        this.type,
        context.nodeId,
        input
      );
    }
  }

  validate(input: HTTPPutInput): ValidationResult {
    const errors: string[] = [];

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

    return { isValid: errors.length === 0, errors };
  }

  getSchema(): TaskConfigSchema {
    return {
      type: 'object',
      title: 'HTTP PUT Request',
      description: 'Update a resource with HTTP PUT',
      properties: {
        url: { type: 'string', title: 'Request URL', format: 'uri' },
        body: { type: 'object', title: 'Request Body' },
        headers: { type: 'object', title: 'HTTP Headers' },
        timeout: { type: 'number', title: 'Timeout (ms)', default: 30000 }
      },
      required: ['url']
    };
  }

  getDisplayInfo(): TaskDisplayInfo {
    return {
      category: NODE_CATEGORIES.HTTP_API,
      label: 'HTTP PUT',
      icon: '✏️',
      color: 'bg-blue-600',
      description: 'Update resources with HTTP PUT requests',
      tags: ['http', 'api', 'put', 'update']
    };
  }
}
