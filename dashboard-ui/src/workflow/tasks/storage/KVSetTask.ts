// KV Store Set Task
// Store data in key-value store

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

export interface KVSetInput {
  key: string;
  value: any;
  ttl_hours?: number;
  useContextKey?: boolean;
  contextKeyField?: string;
  useContextValue?: boolean;
  contextValueField?: string;
  stringifyJSON?: boolean;
}

export interface KVSetOutput {
  key: string;
  value: any;
  success: boolean;
  ttl_hours?: number;
  timestamp: string;
}

export class KVSetTask implements WorkflowTask<KVSetInput, KVSetOutput> {
  readonly type = 'kv-set';

  constructor(
    private kvStore: {
      set: (key: string, value: string, ttl_hours?: number) => Promise<void>;
    },
    private logger?: Logger
  ) {}

  async execute(input: KVSetInput, context: WorkflowContext): Promise<KVSetOutput> {
    // Determine the key to use
    let key = input.key;
    if (input.useContextKey && input.contextKeyField) {
      const contextKey = context.data[input.contextKeyField];
      if (!contextKey) {
        throw new TaskExecutionError(
          `Context key field '${input.contextKeyField}' not found`,
          this.type,
          context.nodeId,
          input
        );
      }
      key = contextKey;
    }

    // Determine the value to use
    let value = input.value;
    if (input.useContextValue && input.contextValueField) {
      const contextValue = context.data[input.contextValueField];
      if (contextValue === undefined) {
        throw new TaskExecutionError(
          `Context value field '${input.contextValueField}' not found`,
          this.type,
          context.nodeId,
          input
        );
      }
      value = contextValue;
    }

    // Stringify value if it's an object and stringifyJSON is enabled
    let stringValue: string;
    if (input.stringifyJSON && typeof value === 'object') {
      stringValue = JSON.stringify(value);
    } else if (typeof value !== 'string') {
      stringValue = String(value);
    } else {
      stringValue = value;
    }

    this.logger?.info(`Setting value for key: ${key}, ttl: ${input.ttl_hours || 'none'}`);

    try {
      await this.kvStore.set(key, stringValue, input.ttl_hours);

      const output: KVSetOutput = {
        key,
        value,
        success: true,
        ttl_hours: input.ttl_hours,
        timestamp: new Date().toISOString()
      };

      this.logger?.info(`KV Set completed: key=${key}`);

      // Store confirmation in context
      context.data.kvSetKey = key;
      context.data.kvSetSuccess = true;

      return output;

    } catch (error) {
      this.logger?.error('KV Set failed:', error);
      throw new TaskExecutionError(
        `KV Set failed: ${error.message}`,
        this.type,
        context.nodeId,
        input
      );
    }
  }

  validate(input: KVSetInput): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!input.useContextKey && (!input.key || input.key.trim().length === 0)) {
      errors.push('Key is required when not using context key');
    }

    if (!input.useContextValue && input.value === undefined) {
      errors.push('Value is required when not using context value');
    }

    if (input.ttl_hours && (input.ttl_hours < 1 || input.ttl_hours > 8760)) {
      warnings.push('TTL should be between 1 hour and 8760 hours (1 year)');
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
      title: 'KV Store Set',
      description: 'Store a value in the key-value store',
      properties: {
        key: {
          type: 'string',
          title: 'Key',
          description: 'Key to store value under'
        },
        value: {
          type: 'string',
          title: 'Value',
          description: 'Value to store'
        },
        ttl_hours: {
          type: 'number',
          title: 'TTL (Hours)',
          description: 'Time to live in hours',
          minimum: 1,
          maximum: 8760
        },
        useContextKey: {
          type: 'boolean',
          title: 'Use Context Key',
          description: 'Get key from workflow context',
          default: false
        },
        contextKeyField: {
          type: 'string',
          title: 'Context Key Field',
          description: 'Field name in context containing the key'
        },
        useContextValue: {
          type: 'boolean',
          title: 'Use Context Value',
          description: 'Get value from workflow context',
          default: false
        },
        contextValueField: {
          type: 'string',
          title: 'Context Value Field',
          description: 'Field name in context containing the value'
        },
        stringifyJSON: {
          type: 'boolean',
          title: 'Stringify JSON',
          description: 'Automatically stringify objects as JSON',
          default: true
        }
      },
      required: [],
      examples: [
        {
          key: 'user-settings',
          value: '{"theme": "dark"}',
          ttl_hours: 24
        },
        {
          useContextKey: true,
          contextKeyField: 'userId',
          useContextValue: true,
          contextValueField: 'userData',
          stringifyJSON: true
        }
      ]
    };
  }

  getDisplayInfo(): TaskDisplayInfo {
    return {
      category: NODE_CATEGORIES.DATA,
      label: 'KV Set',
      icon: '💾',
      color: 'bg-green-600',
      description: 'Store values in key-value store',
      tags: ['storage', 'kv', 'set', 'store', 'data']
    };
  }
}
