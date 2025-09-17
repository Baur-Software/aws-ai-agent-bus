// MCP Key-Value Set Task
// Clean task implementation using the MCPService

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

import { MCPService, KVSetParams, KVSetResult } from '../../../services';

export interface KVSetInput {
  key: string;
  value?: any;
  ttl_hours?: number;
  useContextData?: boolean;
  contextKey?: string;
}

export interface KVSetOutput {
  key: string;
  success: boolean;
  ttl: number;
  timestamp: string;
  valueType: string;
  size: number;
  contextDataUsed: boolean;
}

export class KVSetTask implements WorkflowTask<KVSetInput, KVSetOutput> {
  readonly type = 'kv-set';

  constructor(
    private mcpService: MCPService,
    private logger?: Logger
  ) {}

  async execute(input: KVSetInput, context: WorkflowContext): Promise<KVSetOutput> {
    this.logger?.info(`Setting KV pair: ${input.key}`);

    try {
      // Determine the value to store
      let valueToStore: any;
      let contextDataUsed = false;

      if (input.useContextData) {
        // Use data from context (previous task results)
        if (input.contextKey) {
          valueToStore = context.data[input.contextKey] || context.results[input.contextKey];
        } else {
          // Use the previous result by default
          valueToStore = context.getPreviousResult();
        }
        contextDataUsed = true;
        
        if (valueToStore === undefined || valueToStore === null) {
          throw new Error(`No data found in context${input.contextKey ? ` for key: ${input.contextKey}` : ''}`);
        }
      } else if (input.value !== undefined) {
        valueToStore = input.value;
      } else {
        throw new Error('Either value must be provided or useContextData must be true');
      }

      const params: KVSetParams = {
        key: input.key,
        value: valueToStore,
        ttl_hours: input.ttl_hours || 24
      };

      const result: KVSetResult = await this.mcpService.kvSet(
        params.key,
        params.value,
        params.ttl_hours
      );

      // Calculate value metadata
      const serializedValue = typeof valueToStore === 'string' 
        ? valueToStore 
        : JSON.stringify(valueToStore);
      
      const valueType = typeof valueToStore === 'object' && valueToStore !== null
        ? Array.isArray(valueToStore) ? 'array' : 'object'
        : typeof valueToStore;

      const output: KVSetOutput = {
        key: input.key,
        success: result.success,
        ttl: params.ttl_hours,
        timestamp: result.timestamp,
        valueType,
        size: serializedValue.length,
        contextDataUsed
      };

      this.logger?.info(
        `Successfully stored KV pair: ${input.key} (${valueType}, ${output.size} bytes, TTL: ${params.ttl_hours}h)`
      );

      // Store metadata in context for downstream tasks
      context.data.lastKvKey = input.key;
      context.data.lastKvTimestamp = result.timestamp;
      
      // Emit event for monitoring
      context.emit('kv.set', {
        key: input.key,
        valueType,
        size: output.size,
        ttl: params.ttl_hours
      });

      return output;

    } catch (error) {
      this.logger?.error(`Failed to set KV pair: ${input.key}`, error);
      throw new TaskExecutionError(
        `MCP KV set operation failed: ${error.message}`,
        this.type,
        context.nodeId,
        input
      );
    }
  }

  validate(input: KVSetInput): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Key validation
    if (!input.key || input.key.trim().length === 0) {
      errors.push('Key is required');
    }

    if (input.key && input.key.length > 250) {
      errors.push('Key must be 250 characters or less');
    }

    if (input.key && !/^[a-zA-Z0-9._-]+$/.test(input.key)) {
      warnings.push('Key contains special characters that may cause issues');
    }

    // Value validation
    if (!input.useContextData && input.value === undefined) {
      errors.push('Value is required when not using context data');
    }

    if (input.useContextData && input.value !== undefined) {
      warnings.push('Both value and useContextData specified - context data will take precedence');
    }

    // TTL validation
    if (input.ttl_hours !== undefined) {
      if (input.ttl_hours <= 0) {
        errors.push('TTL must be greater than 0');
      }
      if (input.ttl_hours > 8760) { // 1 year
        warnings.push('TTL greater than 1 year may not be supported by all storage backends');
      }
    }

    // Context key validation
    if (input.useContextData && input.contextKey) {
      if (input.contextKey.trim().length === 0) {
        errors.push('Context key cannot be empty when specified');
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
      title: 'Store Key-Value Pair',
      description: 'Store a key-value pair in the MCP key-value store',
      properties: {
        key: {
          type: 'string',
          title: 'Storage Key',
          description: 'Unique identifier for the stored value'
        },
        value: {
          type: 'object',
          title: 'Value to Store',
          description: 'The data to store (any JSON-serializable value)'
        },
        ttl_hours: {
          type: 'number',
          title: 'Time to Live (Hours)',
          description: 'How long to keep the data before automatic deletion',
          default: 24,
          minimum: 1,
          maximum: 8760
        },
        useContextData: {
          type: 'boolean',
          title: 'Use Context Data',
          description: 'Store data from previous task results instead of the value field',
          default: false
        },
        contextKey: {
          type: 'string',
          title: 'Context Key',
          description: 'Specific context data key to use (optional - uses previous result by default)'
        }
      },
      required: ['key'],
      examples: [
        {
          key: 'user-preferences',
          value: {
            theme: 'dark',
            language: 'en',
            notifications: true
          },
          ttl_hours: 168
        },
        {
          key: 'workflow-result',
          useContextData: true,
          ttl_hours: 24
        },
        {
          key: 'analytics-data',
          useContextData: true,
          contextKey: 'topPages',
          ttl_hours: 12
        }
      ]
    };
  }

  getDisplayInfo(): TaskDisplayInfo {
    return {
      category: NODE_CATEGORIES.MCP_TOOLS,
      label: 'KV Set',
      icon: 'Database',
      color: 'bg-purple-600',
      description: 'Store key-value data in AWS',
      tags: ['storage', 'kv', 'database', 'aws', 'mcp']
    };
  }
}