import { WorkflowTask, WorkflowContext, TaskExecutionError, ValidationResult } from '../../types';

export interface CacheTask_Input {
  operation: 'get' | 'set' | 'delete' | 'clear';
  key?: string; // Required for get, set, delete
  value?: any; // Required for set
  ttl?: number; // TTL in seconds (for set)
  prefix?: string; // Cache key prefix (for clear)
}

export interface CacheTask_Output {
  operation: string;
  key?: string;
  value?: any;
  found?: boolean; // For get operations
  deleted?: boolean; // For delete operations
  cleared?: number; // Number of keys cleared
  success: boolean;
  timestamp: string;
}

export class CacheTask implements WorkflowTask<CacheTask_Input, CacheTask_Output> {
  readonly type = 'cache';

  constructor(
    private kvStore?: any,
    private logger?: any
  ) {}

  async execute(input: CacheTask_Input, context: WorkflowContext): Promise<CacheTask_Output> {
    const startTime = Date.now();

    try {
      if (!this.kvStore) {
        throw new TaskExecutionError(
          this.type,
          context.nodeId || 'unknown',
          'KV store service not available'
        );
      }

      const cacheKeyPrefix = 'workflow-cache:';

      switch (input.operation) {
        case 'get': {
          if (!input.key) {
            throw new TaskExecutionError(this.type, context.nodeId || 'unknown', 'Key required for get operation');
          }

          const cacheKey = `${cacheKeyPrefix}${input.key}`;
          const result = await this.kvStore.get(cacheKey);

          this.logger?.info?.('Cache get', { key: input.key, found: !!result });

          return {
            operation: 'get',
            key: input.key,
            value: result?.value,
            found: !!result,
            success: true,
            timestamp: new Date().toISOString()
          };
        }

        case 'set': {
          if (!input.key) {
            throw new TaskExecutionError(this.type, context.nodeId || 'unknown', 'Key required for set operation');
          }
          if (input.value === undefined) {
            throw new TaskExecutionError(this.type, context.nodeId || 'unknown', 'Value required for set operation');
          }

          const cacheKey = `${cacheKeyPrefix}${input.key}`;
          const ttl = input.ttl || 3600; // Default 1 hour

          await this.kvStore.set(cacheKey, input.value, ttl);

          this.logger?.info?.('Cache set', { key: input.key, ttl });

          return {
            operation: 'set',
            key: input.key,
            value: input.value,
            success: true,
            timestamp: new Date().toISOString()
          };
        }

        case 'delete': {
          if (!input.key) {
            throw new TaskExecutionError(this.type, context.nodeId || 'unknown', 'Key required for delete operation');
          }

          const cacheKey = `${cacheKeyPrefix}${input.key}`;
          await this.kvStore.delete(cacheKey);

          this.logger?.info?.('Cache delete', { key: input.key });

          return {
            operation: 'delete',
            key: input.key,
            deleted: true,
            success: true,
            timestamp: new Date().toISOString()
          };
        }

        case 'clear': {
          // Note: This would require listing keys with prefix and deleting them
          // For now, we'll return a placeholder
          const prefix = input.prefix || '';
          const searchKey = `${cacheKeyPrefix}${prefix}`;

          this.logger?.info?.('Cache clear', { prefix });

          return {
            operation: 'clear',
            cleared: 0, // Would be actual count in real implementation
            success: true,
            timestamp: new Date().toISOString()
          };
        }

        default:
          throw new TaskExecutionError(`Unknown operation: ${input.operation}`, this.type, context.nodeId || 'unknown');
      }
    } catch (error) {
      this.logger?.error?.('Cache operation failed', { error });

      if (error instanceof TaskExecutionError) {
        throw error;
      }

      throw new TaskExecutionError(`Cache operation failed: ${error instanceof Error ? error.message : String(error)}`, this.type, context.nodeId || 'unknown', error instanceof Error ? error : undefined
      );
    }
  }

  validate(input: CacheTask_Input): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!input.operation) {
      errors.push('Operation is required');
    } else if (!['get', 'set', 'delete', 'clear'].includes(input.operation)) {
      errors.push('Operation must be get, set, delete, or clear');
    }

    if (['get', 'set', 'delete'].includes(input.operation) && !input.key) {
      errors.push(`Key is required for ${input.operation} operation`);
    }

    if (input.operation === 'set' && input.value === undefined) {
      errors.push('Value is required for set operation');
    }

    if (input.ttl !== undefined) {
      if (typeof input.ttl !== 'number') {
        errors.push('TTL must be a number');
      } else if (input.ttl < 0) {
        errors.push('TTL must be non-negative');
      } else if (input.ttl > 86400 * 30) {
        warnings.push('TTL exceeds 30 days');
      }
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  getSchema() {
    return {
      input: {
        type: 'object',
        required: ['operation'],
        properties: {
          operation: {
            type: 'string',
            enum: ['get', 'set', 'delete', 'clear'],
            description: 'Cache operation'
          },
          key: {
            type: 'string',
            description: 'Cache key (required for get, set, delete)'
          },
          value: {
            type: 'any',
            description: 'Value to cache (required for set)'
          },
          ttl: {
            type: 'number',
            description: 'Time to live in seconds (default: 3600)',
            default: 3600,
            minimum: 0
          },
          prefix: {
            type: 'string',
            description: 'Key prefix for clear operation'
          }
        }
      },
      output: {
        type: 'object',
        properties: {
          operation: { type: 'string' },
          key: { type: 'string' },
          value: { type: 'any' },
          found: { type: 'boolean' },
          deleted: { type: 'boolean' },
          cleared: { type: 'number' },
          success: { type: 'boolean' },
          timestamp: { type: 'string', format: 'date-time' }
        }
      }
    };
  }

  getDisplayInfo() {
    return {
      name: 'Cache',
      description: 'Cache data with TTL (get, set, delete, clear)',
      category: 'Storage',
      icon: 'database',
      color: '#FF9800',
      tags: ['storage', 'cache', 'performance', 'kv', 'ttl']
    };
  }
}
