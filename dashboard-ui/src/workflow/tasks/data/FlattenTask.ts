import { WorkflowTask, WorkflowContext, TaskExecutionError, ValidationResult } from '../../types';

export interface FlattenTask_Input {
  data: any[];
  depth?: number; // Depth to flatten (default: 1, use Infinity for full flatten)
  field?: string; // If data is array of objects, flatten this field
}

export interface FlattenTask_Output {
  data: any[];
  originalCount: number;
  flattenedCount: number;
  depth: number;
  success: boolean;
  timestamp: string;
}

export class FlattenTask implements WorkflowTask<FlattenTask_Input, FlattenTask_Output> {
  readonly type = 'flatten';

  constructor(private logger?: any) {}

  async execute(input: FlattenTask_Input, context: WorkflowContext): Promise<FlattenTask_Output> {
    const startTime = Date.now();

    try {
      if (!Array.isArray(input.data)) {
        throw new TaskExecutionError(
          this.type,
          context.nodeId || 'unknown',
          'Data must be an array'
        );
      }

      const originalCount = input.data.length;
      const depth = input.depth !== undefined ? input.depth : 1;

      let result: any[];

      if (input.field) {
        // Extract field from objects and flatten those arrays
        result = input.data.flatMap(item => {
          const value = this.getFieldValue(item, input.field!);
          if (Array.isArray(value)) {
            return this.flattenArray(value, depth);
          }
          return item;
        });
      } else {
        // Flatten the array itself
        result = this.flattenArray(input.data, depth);
      }

      const executionTime = Date.now() - startTime;
      this.logger?.info?.('Array flattened successfully', {
        originalCount,
        flattenedCount: result.length,
        depth,
        executionTime
      });

      return {
        data: result,
        originalCount,
        flattenedCount: result.length,
        depth,
        success: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger?.error?.('Failed to flatten array', { error });

      if (error instanceof TaskExecutionError) {
        throw error;
      }

      throw new TaskExecutionError(`Failed to flatten array: ${error instanceof Error ? error.message : String(error)}`, this.type, context.nodeId || 'unknown', error instanceof Error ? error : undefined
      );
    }
  }

  private getFieldValue(item: any, field: string): any {
    return field.includes('.')
      ? field.split('.').reduce((obj, key) => obj?.[key], item)
      : item[field];
  }

  private flattenArray(arr: any[], depth: number): any[] {
    if (depth === 0) return arr;
    if (depth === Infinity) return arr.flat(Infinity);

    let result = arr;
    for (let i = 0; i < depth; i++) {
      result = result.flat(1);
    }
    return result;
  }

  validate(input: FlattenTask_Input): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!input.data) {
      errors.push('Data is required');
    } else if (!Array.isArray(input.data)) {
      errors.push('Data must be an array');
    }

    if (input.depth !== undefined) {
      if (typeof input.depth !== 'number') {
        errors.push('Depth must be a number');
      } else if (input.depth < 0) {
        errors.push('Depth must be non-negative');
      } else if (input.depth === Infinity) {
        warnings.push('Using Infinity depth will flatten all nested arrays');
      }
    }

    if (input.field !== undefined && typeof input.field !== 'string') {
      errors.push('Field must be a string');
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  getSchema() {
    return {
      input: {
        type: 'object',
        required: ['data'],
        properties: {
          data: {
            type: 'array',
            description: 'Array to flatten (can contain nested arrays)',
            items: { type: 'any' }
          },
          depth: {
            type: 'number',
            description: 'Depth to flatten (1 = one level, Infinity = all levels)',
            default: 1,
            minimum: 0
          },
          field: {
            type: 'string',
            description: 'Field to extract and flatten (if data is array of objects)',
            examples: ['items', 'children', 'tags']
          }
        }
      },
      output: {
        type: 'object',
        properties: {
          data: { type: 'array', items: { type: 'any' } },
          originalCount: { type: 'number' },
          flattenedCount: { type: 'number' },
          depth: { type: 'number' },
          success: { type: 'boolean' },
          timestamp: { type: 'string', format: 'date-time' }
        }
      }
    };
  }

  getDisplayInfo() {
    return {
      name: 'Flatten',
      description: 'Flatten nested arrays to specified depth',
      category: 'Data',
      icon: 'minimize',
      color: '#2196F3',
      tags: ['data', 'array', 'flatten', 'nested', 'normalize']
    };
  }
}
