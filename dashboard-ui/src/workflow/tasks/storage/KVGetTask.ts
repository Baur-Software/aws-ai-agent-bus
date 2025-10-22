// KV Store Get Task
// Retrieve data from key-value store

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

export interface KVGetInput {
  key: string;
  useContextKey?: boolean;
  contextKeyField?: string;
  defaultValue?: any;
  parseJSON?: boolean;
}

export interface KVGetOutput {
  key: string;
  value: any;
  exists: boolean;
  timestamp: string;
}

export class KVGetTask implements WorkflowTask<KVGetInput, KVGetOutput> {
  readonly type = 'kv-get';

  constructor(
    private kvStore: {
      get: (key: string) => Promise<{ value?: string; exists: boolean }>;
    },
    private logger?: Logger
  ) {}

  async execute(input: KVGetInput, context: WorkflowContext): Promise<KVGetOutput> {
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

    this.logger?.info(`Getting value for key: ${key}`);

    try {
      const result = await this.kvStore.get(key);

      let value = result.value;

      // Parse JSON if requested
      if (value && input.parseJSON) {
        try {
          value = JSON.parse(value);
        } catch (error) {
          this.logger?.warn(`Failed to parse JSON for key ${key}: ${error.message}`);
          // Keep original value if parse fails
        }
      }

      // Use default value if key doesn't exist
      if (!result.exists && input.defaultValue !== undefined) {
        value = input.defaultValue;
      }

      const output: KVGetOutput = {
        key,
        value,
        exists: result.exists,
        timestamp: new Date().toISOString()
      };

      this.logger?.info(`KV Get completed: key=${key}, exists=${result.exists}`);

      // Store in context for downstream nodes
      context.data.kvValue = value;
      context.data.kvKey = key;
      context.data.kvExists = result.exists;

      return output;

    } catch (error) {
      this.logger?.error('KV Get failed:', error);
      throw new TaskExecutionError(
        `KV Get failed: ${error.message}`,
        this.type,
        context.nodeId,
        input
      );
    }
  }

  validate(input: KVGetInput): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!input.useContextKey && (!input.key || input.key.trim().length === 0)) {
      errors.push('Key is required when not using context key');
    }

    if (input.useContextKey && !input.contextKeyField) {
      warnings.push('No context key field specified, will use "key"');
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
      title: 'KV Store Get',
      description: 'Retrieve a value from the key-value store',
      properties: {
        key: {
          type: 'string',
          title: 'Key',
          description: 'Key to retrieve'
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
          description: 'Field name in context containing the key',
          default: 'key'
        },
        defaultValue: {
          type: 'string',
          title: 'Default Value',
          description: 'Value to return if key does not exist'
        },
        parseJSON: {
          type: 'boolean',
          title: 'Parse as JSON',
          description: 'Automatically parse value as JSON',
          default: false
        }
      },
      required: [],
      examples: [
        {
          key: 'user-settings',
          parseJSON: true
        },
        {
          useContextKey: true,
          contextKeyField: 'userId',
          defaultValue: '{}'
        }
      ]
    };
  }

  getDisplayInfo(): TaskDisplayInfo {
    return {
      category: NODE_CATEGORIES.DATA,
      label: 'KV Get',
      icon: '💾',
      color: 'bg-blue-600',
      description: 'Retrieve values from key-value store',
      tags: ['storage', 'kv', 'get', 'retrieve', 'data']
    };
  }
}
