// HTTP DELETE Task
// Performs HTTP DELETE requests to remove resources

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

export interface HTTPDeleteInput {
  url: string;
  headers?: Record<string, string>;
  timeout?: number;
  auth?: {
    type: 'bearer' | 'basic' | 'apikey';
    token?: string;
    username?: string;
    password?: string;
    headerName?: string;
  };
  useContextUrl?: boolean;
  contextUrlField?: string;
}

export interface HTTPDeleteOutput {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: any;
  url: string;
  method: 'DELETE';
  duration: number;
  success: boolean;
  timestamp: string;
}

export class HTTPDeleteTask implements WorkflowTask<HTTPDeleteInput, HTTPDeleteOutput> {
  readonly type = 'http-delete';

  constructor(
    private httpService: {
      delete: (url: string, options?: any) => Promise<any>;
    },
    private logger?: Logger
  ) {}

  async execute(input: HTTPDeleteInput, context: WorkflowContext): Promise<HTTPDeleteOutput> {
    const startTime = Date.now();

    // Determine URL
    let url = input.url;
    if (input.useContextUrl) {
      const contextField = input.contextUrlField || 'url';
      const contextUrl = context.data[contextField];
      if (!contextUrl) {
        throw new TaskExecutionError(
          `Context URL field '${contextField}' not found`,
          this.type,
          context.nodeId,
          input
        );
      }
      url = contextUrl;
    }

    this.logger?.info(`Making DELETE request to: ${url}`);

    try {
      const options = {
        headers: input.headers,
        timeout: input.timeout,
        auth: input.auth
      };

      const response = await this.httpService.delete(url, options);

      const output: HTTPDeleteOutput = {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        data: response.data,
        url: response.url,
        method: 'DELETE',
        duration: Date.now() - startTime,
        success: response.status >= 200 && response.status < 300,
        timestamp: new Date().toISOString()
      };

      this.logger?.info(`DELETE request completed: ${response.status} ${response.statusText} (${output.duration}ms)`);

      context.data.httpResponse = response.data;
      context.data.httpStatus = response.status;

      return output;

    } catch (error) {
      this.logger?.error('HTTP DELETE request failed:', error);
      throw new TaskExecutionError(
        `HTTP DELETE request failed: ${error.message}`,
        this.type,
        context.nodeId,
        input
      );
    }
  }

  validate(input: HTTPDeleteInput): ValidationResult {
    const errors: string[] = [];

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

    return { isValid: errors.length === 0, errors };
  }

  getSchema(): TaskConfigSchema {
    return {
      type: 'object',
      title: 'HTTP DELETE Request',
      description: 'Delete a resource with HTTP DELETE',
      properties: {
        url: { type: 'string', title: 'Request URL', format: 'uri' },
        headers: { type: 'object', title: 'HTTP Headers' },
        timeout: { type: 'number', title: 'Timeout (ms)', default: 30000 }
      },
      required: []
    };
  }

  getDisplayInfo(): TaskDisplayInfo {
    return {
      category: NODE_CATEGORIES.HTTP_API,
      label: 'HTTP DELETE',
      icon: '🗑️',
      color: 'bg-red-600',
      description: 'Delete resources with HTTP DELETE requests',
      tags: ['http', 'api', 'delete', 'remove']
    };
  }
}
