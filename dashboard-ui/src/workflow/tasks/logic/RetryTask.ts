import { WorkflowTask, WorkflowContext } from '../../types/workflow';
import { TaskExecutionError } from '../../errors/TaskExecutionError';

export interface RetryTask_Input {
  maxAttempts: number;
  backoffStrategy?: 'fixed' | 'linear' | 'exponential';
  initialDelay?: number; // milliseconds
  maxDelay?: number; // milliseconds
  retryOn?: string[]; // Error messages to retry on
}

export interface RetryTask_Output {
  attempts: number;
  succeeded: boolean;
  lastError?: string;
  totalDelay: number;
  success: boolean;
  timestamp: string;
}

export class RetryTask implements WorkflowTask<RetryTask_Input, RetryTask_Output> {
  readonly type = 'retry';

  constructor(private logger?: any) {}

  async execute(input: RetryTask_Input, context: WorkflowContext): Promise<RetryTask_Output> {
    const startTime = Date.now();

    try {
      const backoffStrategy = input.backoffStrategy || 'exponential';
      const initialDelay = input.initialDelay || 1000;
      const maxDelay = input.maxDelay || 30000;
      const maxAttempts = Math.min(input.maxAttempts, 10); // Cap at 10 attempts

      let attempts = 0;
      let totalDelay = 0;
      let lastError: string | undefined;
      let succeeded = false;

      // Note: In a real implementation, this would wrap the execution of child nodes
      // For now, we'll return metadata about retry configuration

      this.logger?.info?.('Retry task configured', {
        maxAttempts,
        backoffStrategy,
        initialDelay,
        maxDelay
      });

      const executionTime = Date.now() - startTime;

      return {
        attempts: 0,
        succeeded: true,
        totalDelay: 0,
        success: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger?.error?.('Retry task failed', { error });

      if (error instanceof TaskExecutionError) {
        throw error;
      }

      throw new TaskExecutionError(
        this.type,
        context.nodeId || 'unknown',
        `Retry task failed: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  private calculateDelay(attempt: number, strategy: string, initialDelay: number, maxDelay: number): number {
    let delay: number;

    switch (strategy) {
      case 'fixed':
        delay = initialDelay;
        break;
      case 'linear':
        delay = initialDelay * (attempt + 1);
        break;
      case 'exponential':
      default:
        delay = initialDelay * Math.pow(2, attempt);
        break;
    }

    return Math.min(delay, maxDelay);
  }

  private shouldRetry(error: Error, retryOn?: string[]): boolean {
    if (!retryOn || retryOn.length === 0) {
      return true; // Retry on all errors if not specified
    }

    const errorMessage = error.message.toLowerCase();
    return retryOn.some(pattern => errorMessage.includes(pattern.toLowerCase()));
  }

  async validate(input: RetryTask_Input): Promise<{ valid: boolean; errors: string[]; warnings: string[] }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!input.maxAttempts) {
      errors.push('maxAttempts is required');
    } else if (typeof input.maxAttempts !== 'number') {
      errors.push('maxAttempts must be a number');
    } else if (input.maxAttempts < 1) {
      errors.push('maxAttempts must be at least 1');
    } else if (input.maxAttempts > 10) {
      warnings.push('maxAttempts will be capped at 10');
    }

    if (input.backoffStrategy && !['fixed', 'linear', 'exponential'].includes(input.backoffStrategy)) {
      errors.push('backoffStrategy must be fixed, linear, or exponential');
    }

    if (input.initialDelay !== undefined) {
      if (typeof input.initialDelay !== 'number') {
        errors.push('initialDelay must be a number');
      } else if (input.initialDelay < 0) {
        errors.push('initialDelay must be non-negative');
      }
    }

    if (input.maxDelay !== undefined) {
      if (typeof input.maxDelay !== 'number') {
        errors.push('maxDelay must be a number');
      } else if (input.maxDelay < 0) {
        errors.push('maxDelay must be non-negative');
      }
    }

    if (input.retryOn !== undefined && !Array.isArray(input.retryOn)) {
      errors.push('retryOn must be an array');
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  getSchema() {
    return {
      input: {
        type: 'object',
        required: ['maxAttempts'],
        properties: {
          maxAttempts: {
            type: 'number',
            description: 'Maximum number of retry attempts',
            minimum: 1,
            maximum: 10,
            default: 3
          },
          backoffStrategy: {
            type: 'string',
            enum: ['fixed', 'linear', 'exponential'],
            description: 'Backoff strategy for delays between retries',
            default: 'exponential'
          },
          initialDelay: {
            type: 'number',
            description: 'Initial delay in milliseconds',
            default: 1000,
            minimum: 0
          },
          maxDelay: {
            type: 'number',
            description: 'Maximum delay in milliseconds',
            default: 30000,
            minimum: 0
          },
          retryOn: {
            type: 'array',
            items: { type: 'string' },
            description: 'Error messages to retry on (retries all if empty)',
            examples: [['timeout', 'network'], ['rate limit', '429']]
          }
        }
      },
      output: {
        type: 'object',
        properties: {
          attempts: { type: 'number' },
          succeeded: { type: 'boolean' },
          lastError: { type: 'string' },
          totalDelay: { type: 'number' },
          success: { type: 'boolean' },
          timestamp: { type: 'string', format: 'date-time' }
        }
      }
    };
  }

  getDisplayInfo() {
    return {
      name: 'Retry',
      description: 'Retry operation with configurable backoff strategy',
      category: 'Logic',
      icon: 'rotate-cw',
      color: '#FF9800',
      tags: ['logic', 'retry', 'backoff', 'resilience', 'error-handling']
    };
  }
}
