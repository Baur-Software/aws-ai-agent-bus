// MCP KV Get Task
// Retrieves a value from the MCP key-value store

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

import { MCPService } from '../../../services';

export interface KVGetInput {
  key: string;
}

export interface KVGetOutput {
  key: string;
  value: any;
  found: boolean;
  timestamp: string;
}

export class KVGetTask implements WorkflowTask<KVGetInput, KVGetOutput> {
  readonly type = 'kv-get';

  constructor(
    private mcpService: MCPService,
    private logger?: Logger
  ) {}

  async execute(input: KVGetInput, context: WorkflowContext): Promise<KVGetOutput> {
    this.logger?.info(`Getting KV value for key: ${input.key}`);

    try {
      const result = await this.mcpService.kvGet(input.key);
      
      const output: KVGetOutput = {
        key: input.key,
        value: result,
        found: result !== null && result !== undefined,
        timestamp: new Date().toISOString()
      };

      this.logger?.info(`Successfully retrieved KV value for key: ${input.key}`);

      // Store in context for downstream tasks
      context.data.kvResult = result;
      context.data.kvKey = input.key;

      return output;

    } catch (error) {
      this.logger?.error('Failed to get KV value:', error);
      throw new TaskExecutionError(
        `MCP KV get failed: ${error.message}`,
        this.type,
        context.nodeId,
        input
      );
    }
  }

  validate(input: KVGetInput): ValidationResult {
    const errors: string[] = [];

    if (!input.key || input.key.trim().length === 0) {
      errors.push('Key is required');
    }

    if (input.key && input.key.length > 1024) {
      errors.push('Key cannot exceed 1024 characters');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  getSchema(): TaskConfigSchema {
    return {
      type: 'object',
      title: 'Get Key-Value Pair',
      description: 'Retrieve a value from the MCP key-value store',
      properties: {
        key: {
          type: 'string',
          title: 'Key',
          description: 'Storage key identifier to retrieve'
        }
      },
      required: ['key'],
      examples: [
        {
          key: 'user-settings'
        },
        {
          key: 'workflow-data-2024-01-15'
        }
      ]
    };
  }

  getDisplayInfo(): TaskDisplayInfo {
    return {
      category: NODE_CATEGORIES.MCP_TOOLS,
      label: 'KV Get',
      icon: 'Database',
      color: 'bg-blue-600',
      description: 'Retrieve a value from key-value store',
      tags: ['mcp', 'kv', 'storage', 'retrieve']
    };
  }
}