// Loop Task - Array Iteration
// Iterate over array items and execute child nodes for each item

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

export interface LoopInput {
  items: any[];
  maxIterations?: number;
  continueOnError?: boolean;
  useContextItems?: boolean;
  contextItemsField?: string;
  itemKey?: string; // Key to store current item in context
  indexKey?: string; // Key to store current index in context
}

export interface LoopOutput {
  totalItems: number;
  processedItems: number;
  failedItems: number;
  results: Array<{
    index: number;
    item: any;
    status: 'success' | 'failed' | 'skipped';
    result?: any;
    error?: string;
  }>;
  timestamp: string;
}

export class LoopTask implements WorkflowTask<LoopInput, LoopOutput> {
  readonly type = 'loop';

  constructor(private logger?: Logger) {}

  async execute(input: LoopInput, context: WorkflowContext): Promise<LoopOutput> {
    // Get items to iterate
    let items = input.items;
    if (input.useContextItems) {
      const contextField = input.contextItemsField || 'items';
      const contextItems = context.data[contextField];
      if (!Array.isArray(contextItems)) {
        throw new TaskExecutionError(
          `Context field '${contextField}' is not an array`,
          this.type,
          context.nodeId,
          input
        );
      }
      items = contextItems;
    }

    if (!Array.isArray(items)) {
      throw new TaskExecutionError(
        'Items must be an array',
        this.type,
        context.nodeId,
        input
      );
    }

    const maxIterations = input.maxIterations || 100;
    const itemsToProcess = items.slice(0, maxIterations);

    this.logger?.info(`Starting loop: ${itemsToProcess.length} items (max: ${maxIterations})`);

    const results: LoopOutput['results'] = [];
    let processedItems = 0;
    let failedItems = 0;

    for (let index = 0; index < itemsToProcess.length; index++) {
      const item = itemsToProcess[index];

      try {
        // Store current item and index in context for child nodes
        context.data[input.itemKey || 'currentItem'] = item;
        context.data[input.indexKey || 'currentIndex'] = index;
        context.data.loopIndex = index;
        context.data.loopTotal = itemsToProcess.length;

        this.logger?.debug(`Processing item ${index + 1}/${itemsToProcess.length}`);

        // In a real implementation, this would execute child nodes
        // For now, we just mark it as successful
        results.push({
          index,
          item,
          status: 'success',
          result: item // Placeholder - would be result from child nodes
        });

        processedItems++;

      } catch (error) {
        failedItems++;

        results.push({
          index,
          item,
          status: 'failed',
          error: error.message
        });

        if (!input.continueOnError) {
          this.logger?.error(`Loop failed at item ${index}:`, error);
          throw new TaskExecutionError(
            `Loop failed at item ${index}: ${error.message}`,
            this.type,
            context.nodeId,
            input
          );
        }

        this.logger?.warn(`Item ${index} failed, continuing:`, error.message);
      }
    }

    // Clean up context
    delete context.data[input.itemKey || 'currentItem'];
    delete context.data[input.indexKey || 'currentIndex'];
    delete context.data.loopIndex;
    delete context.data.loopTotal;

    const output: LoopOutput = {
      totalItems: items.length,
      processedItems,
      failedItems,
      results,
      timestamp: new Date().toISOString()
    };

    this.logger?.info(`Loop completed: ${processedItems} processed, ${failedItems} failed`);

    // Store results in context
    context.data.loopResults = results;
    context.data.loopProcessedCount = processedItems;

    return output;
  }

  validate(input: LoopInput): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!input.useContextItems && (!input.items || !Array.isArray(input.items))) {
      errors.push('Items must be an array when not using context items');
    }

    if (input.useContextItems && !input.contextItemsField) {
      warnings.push('No context items field specified, will use "items"');
    }

    if (input.maxIterations && input.maxIterations < 1) {
      errors.push('Max iterations must be at least 1');
    }

    if (input.maxIterations && input.maxIterations > 10000) {
      warnings.push('Max iterations is very high (>10000), this may cause performance issues');
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
      title: 'Loop',
      description: 'Iterate over array items',
      properties: {
        items: {
          type: 'array',
          title: 'Items',
          description: 'Array of items to iterate over',
          items: {
            type: 'object',
            properties: {}
          }
        },
        maxIterations: {
          type: 'number',
          title: 'Max Iterations',
          description: 'Maximum number of iterations (safety limit)',
          default: 100,
          minimum: 1,
          maximum: 10000
        },
        continueOnError: {
          type: 'boolean',
          title: 'Continue on Error',
          description: 'Continue processing remaining items if one fails',
          default: false
        },
        useContextItems: {
          type: 'boolean',
          title: 'Use Items from Context',
          description: 'Get items array from workflow context',
          default: false
        },
        contextItemsField: {
          type: 'string',
          title: 'Context Items Field',
          description: 'Field name in context containing items array',
          default: 'items'
        },
        itemKey: {
          type: 'string',
          title: 'Item Key',
          description: 'Context key for current item',
          default: 'currentItem'
        },
        indexKey: {
          type: 'string',
          title: 'Index Key',
          description: 'Context key for current index',
          default: 'currentIndex'
        }
      },
      required: [],
      examples: [
        {
          items: [1, 2, 3, 4, 5],
          maxIterations: 100,
          continueOnError: true
        },
        {
          useContextItems: true,
          contextItemsField: 'userList',
          itemKey: 'currentUser',
          continueOnError: false
        }
      ]
    };
  }

  getDisplayInfo(): TaskDisplayInfo {
    return {
      category: NODE_CATEGORIES.DATA_PROCESSING,
      label: 'Loop',
      icon: '🔁',
      color: 'bg-yellow-500',
      description: 'Iterate over array items and process each one',
      tags: ['loop', 'iteration', 'array', 'foreach', 'control-flow']
    };
  }
}
