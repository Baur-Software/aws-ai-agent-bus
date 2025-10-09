// Webhook Task - External HTTP Callbacks
// Send data to external services via webhooks (Slack, Discord, custom endpoints)

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

export interface WebhookInput {
  url: string;
  method?: 'POST' | 'PUT' | 'PATCH';
  body: any;
  headers?: Record<string, string>;
  timeout?: number;
  useContextUrl?: boolean;
  contextUrlField?: string;
  useContextBody?: boolean;
  contextBodyField?: string;
  retries?: number;
  retryDelay?: number;
}

export interface WebhookOutput {
  status: number;
  statusText: string;
  success: boolean;
  response: any;
  url: string;
  duration: number;
  retries: number;
  timestamp: string;
}

export class WebhookTask implements WorkflowTask<WebhookInput, WebhookOutput> {
  readonly type = 'webhook';

  constructor(
    private httpService: {
      request: (method: string, url: string, options?: any) => Promise<any>;
    },
    private logger?: Logger
  ) {}

  async execute(input: WebhookInput, context: WorkflowContext): Promise<WebhookOutput> {
    const startTime = Date.now();

    // Determine URL
    let url = input.url;
    if (input.useContextUrl) {
      const contextField = input.contextUrlField || 'webhookUrl';
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

    // Determine body
    let body = input.body;
    if (input.useContextBody) {
      const contextField = input.contextBodyField || 'webhookData';
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

    const method = input.method || 'POST';
    const maxRetries = input.retries || 0;
    const retryDelay = input.retryDelay || 1000;

    this.logger?.info(`Sending webhook ${method} to: ${url}`);

    let lastError: any;
    let attemptCount = 0;

    // Retry loop
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      attemptCount++;

      try {
        const options = {
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Workflow-Engine/1.0',
            ...input.headers
          },
          body,
          timeout: input.timeout || 30000
        };

        const response = await this.httpService.request(method, url, options);

        const output: WebhookOutput = {
          status: response.status,
          statusText: response.statusText,
          success: response.status >= 200 && response.status < 300,
          response: response.data,
          url,
          duration: Date.now() - startTime,
          retries: attempt,
          timestamp: new Date().toISOString()
        };

        this.logger?.info(
          `Webhook delivered: ${response.status} ${response.statusText} (${output.duration}ms, ${attempt} retries)`
        );

        // Store response in context
        context.data.webhookResponse = response.data;
        context.data.webhookStatus = response.status;
        context.data.webhookSuccess = output.success;

        return output;

      } catch (error) {
        lastError = error;
        this.logger?.warn(`Webhook attempt ${attempt + 1}/${maxRetries + 1} failed: ${error.message}`);

        // Don't retry on client errors (4xx)
        if (error.status >= 400 && error.status < 500) {
          this.logger?.error('Client error, not retrying');
          break;
        }

        // Wait before retrying (except on last attempt)
        if (attempt < maxRetries) {
          await this.sleep(retryDelay * (attempt + 1)); // Exponential backoff
        }
      }
    }

    // All retries failed
    this.logger?.error(`Webhook failed after ${attemptCount} attempts`);
    throw new TaskExecutionError(
      `Webhook failed after ${attemptCount} attempts: ${lastError.message}`,
      this.type,
      context.nodeId,
      input
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  validate(input: WebhookInput): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!input.useContextUrl && (!input.url || input.url.trim().length === 0)) {
      errors.push('URL is required when not using context URL');
    }

    if (input.url) {
      try {
        const parsedUrl = new URL(input.url);
        if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
          errors.push('URL must use HTTP or HTTPS protocol');
        }
      } catch {
        errors.push('URL must be a valid URL');
      }
    }

    if (!input.useContextBody && input.body === undefined) {
      warnings.push('No body provided, webhook will send empty payload');
    }

    if (input.method && !['POST', 'PUT', 'PATCH'].includes(input.method)) {
      errors.push('Method must be POST, PUT, or PATCH');
    }

    if (input.retries && (input.retries < 0 || input.retries > 5)) {
      warnings.push('Retries should be between 0 and 5');
    }

    if (input.timeout && (input.timeout < 1000 || input.timeout > 60000)) {
      warnings.push('Timeout should be between 1000ms and 60000ms');
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
      title: 'Webhook',
      description: 'Send data to external services via HTTP webhook',
      properties: {
        url: {
          type: 'string',
          title: 'Webhook URL',
          description: 'Target URL for the webhook',
          format: 'uri'
        },
        method: {
          type: 'string',
          title: 'HTTP Method',
          description: 'HTTP method to use',
          enum: ['POST', 'PUT', 'PATCH'],
          default: 'POST'
        },
        body: {
          type: 'object',
          title: 'Payload',
          description: 'Data to send in webhook body'
        },
        headers: {
          type: 'object',
          title: 'Custom Headers',
          description: 'Additional HTTP headers'
        },
        timeout: {
          type: 'number',
          title: 'Timeout (ms)',
          description: 'Request timeout in milliseconds',
          default: 30000,
          minimum: 1000,
          maximum: 60000
        },
        useContextUrl: {
          type: 'boolean',
          title: 'Use URL from Context',
          description: 'Get webhook URL from workflow context',
          default: false
        },
        contextUrlField: {
          type: 'string',
          title: 'Context URL Field',
          description: 'Field name containing webhook URL',
          default: 'webhookUrl'
        },
        useContextBody: {
          type: 'boolean',
          title: 'Use Body from Context',
          description: 'Get payload from workflow context',
          default: false
        },
        contextBodyField: {
          type: 'string',
          title: 'Context Body Field',
          description: 'Field name containing webhook payload',
          default: 'webhookData'
        },
        retries: {
          type: 'number',
          title: 'Max Retries',
          description: 'Number of retry attempts on failure',
          default: 0,
          minimum: 0,
          maximum: 5
        },
        retryDelay: {
          type: 'number',
          title: 'Retry Delay (ms)',
          description: 'Base delay between retries (exponential backoff)',
          default: 1000
        }
      },
      required: [],
      examples: [
        {
          url: 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL',
          body: {
            text: 'Workflow completed successfully!',
            channel: '#alerts'
          }
        },
        {
          url: 'https://discord.com/api/webhooks/YOUR/WEBHOOK',
          body: {
            content: 'New order received',
            embeds: [{ title: 'Order #12345', description: '$99.99' }]
          }
        },
        {
          useContextUrl: true,
          useContextBody: true,
          contextBodyField: 'notificationData',
          retries: 3
        }
      ]
    };
  }

  getDisplayInfo(): TaskDisplayInfo {
    return {
      category: NODE_CATEGORIES.INTEGRATION,
      label: 'Webhook',
      icon: '🔗',
      color: 'bg-purple-600',
      description: 'Send data to external services (Slack, Discord, custom endpoints)',
      tags: ['webhook', 'http', 'notification', 'integration', 'callback']
    };
  }
}
