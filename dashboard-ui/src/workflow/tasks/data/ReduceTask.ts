import { WorkflowTask, WorkflowContext, TaskExecutionError, ValidationResult } from '../../types';

export interface ReduceTask_Input {
  data: any[];
  operation: 'sum' | 'avg' | 'min' | 'max' | 'count' | 'concat' | 'custom';
  field?: string; // Field to operate on (for sum, avg, min, max)
  expression?: string; // Custom reducer expression
  initialValue?: any;
}

export interface ReduceTask_Output {
  result: any;
  operation: string;
  itemsProcessed: number;
  success: boolean;
  timestamp: string;
}

export class ReduceTask implements WorkflowTask<ReduceTask_Input, ReduceTask_Output> {
  readonly type = 'reduce';

  constructor(private logger?: any) {}

  async execute(input: ReduceTask_Input, context: WorkflowContext): Promise<ReduceTask_Output> {
    const startTime = Date.now();

    try {
      if (!Array.isArray(input.data)) {
        throw new TaskExecutionError(
          this.type,
          context.nodeId || 'unknown',
          'Data must be an array'
        );
      }

      let result: any;

      switch (input.operation) {
        case 'sum':
          result = this.sum(input.data, input.field);
          break;
        case 'avg':
          result = this.average(input.data, input.field);
          break;
        case 'min':
          result = this.min(input.data, input.field);
          break;
        case 'max':
          result = this.max(input.data, input.field);
          break;
        case 'count':
          result = input.data.length;
          break;
        case 'concat':
          result = this.concat(input.data, input.field);
          break;
        case 'custom':
          if (!input.expression) {
            throw new TaskExecutionError(
              this.type,
              context.nodeId || 'unknown',
              'Expression is required for custom operation'
            );
          }
          result = this.customReduce(input.data, input.expression, input.initialValue, context);
          break;
        default:
          throw new TaskExecutionError(`Unknown operation: ${input.operation}`, this.type, context.nodeId || 'unknown');
      }

      const executionTime = Date.now() - startTime;
      this.logger?.info?.('Data reduced successfully', {
        operation: input.operation,
        itemsProcessed: input.data.length,
        executionTime
      });

      return {
        result,
        operation: input.operation,
        itemsProcessed: input.data.length,
        success: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger?.error?.('Failed to reduce data', { error });

      if (error instanceof TaskExecutionError) {
        throw error;
      }

      throw new TaskExecutionError(`Failed to reduce data: ${error instanceof Error ? error.message : String(error)}`, this.type, context.nodeId || 'unknown', error instanceof Error ? error : undefined
      );
    }
  }

  private getValue(item: any, field?: string): number {
    if (!field) return typeof item === 'number' ? item : 0;

    const value = field.includes('.')
      ? field.split('.').reduce((obj, key) => obj?.[key], item)
      : item[field];

    return typeof value === 'number' ? value : 0;
  }

  private sum(data: any[], field?: string): number {
    return data.reduce((sum, item) => sum + this.getValue(item, field), 0);
  }

  private average(data: any[], field?: string): number {
    if (data.length === 0) return 0;
    return this.sum(data, field) / data.length;
  }

  private min(data: any[], field?: string): number {
    if (data.length === 0) return 0;
    return Math.min(...data.map(item => this.getValue(item, field)));
  }

  private max(data: any[], field?: string): number {
    if (data.length === 0) return 0;
    return Math.max(...data.map(item => this.getValue(item, field)));
  }

  private concat(data: any[], field?: string): string {
    return data
      .map(item => field ? (field.includes('.')
        ? field.split('.').reduce((obj, key) => obj?.[key], item)
        : item[field]) : item)
      .filter(val => val !== undefined && val !== null)
      .join('');
  }

  private customReduce(data: any[], expression: string, initialValue: any, context: WorkflowContext): any {
    try {
      const reducer = new Function('accumulator', 'item', 'index', 'context', `return ${expression}`);
      return data.reduce(
        (acc, item, index) => reducer(acc, item, index, context),
        initialValue ?? 0
      );
    } catch (error) {
      this.logger?.error?.('Custom reducer failed', { expression, error });
      throw new TaskExecutionError(`Custom reducer failed: ${error instanceof Error ? error.message : String(error)}`, this.type, context.nodeId || 'unknown');
    }
  }

  validate(input: ReduceTask_Input): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!input.data) {
      errors.push('Data is required');
    } else if (!Array.isArray(input.data)) {
      errors.push('Data must be an array');
    }

    if (!input.operation) {
      errors.push('Operation is required');
    } else if (!['sum', 'avg', 'min', 'max', 'count', 'concat', 'custom'].includes(input.operation)) {
      errors.push('Invalid operation');
    }

    if (['sum', 'avg', 'min', 'max'].includes(input.operation) && !input.field) {
      warnings.push(`${input.operation} operation works best with a field specified`);
    }

    if (input.operation === 'custom' && !input.expression) {
      errors.push('Expression is required for custom operation');
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  getSchema() {
    return {
      input: {
        type: 'object',
        required: ['data', 'operation'],
        properties: {
          data: {
            type: 'array',
            description: 'Array to reduce',
            items: { type: 'any' }
          },
          operation: {
            type: 'string',
            enum: ['sum', 'avg', 'min', 'max', 'count', 'concat', 'custom'],
            description: 'Reduction operation'
          },
          field: {
            type: 'string',
            description: 'Field to operate on (for sum, avg, min, max)',
            examples: ['price', 'quantity', 'user.age']
          },
          expression: {
            type: 'string',
            description: 'Custom reducer expression (for custom operation)',
            examples: ['accumulator + item.value', 'accumulator * item.multiplier']
          },
          initialValue: {
            type: 'any',
            description: 'Initial value for custom reducer',
            default: 0
          }
        }
      },
      output: {
        type: 'object',
        properties: {
          result: { type: 'any' },
          operation: { type: 'string' },
          itemsProcessed: { type: 'number' },
          success: { type: 'boolean' },
          timestamp: { type: 'string', format: 'date-time' }
        }
      }
    };
  }

  getDisplayInfo() {
    return {
      name: 'Reduce',
      description: 'Aggregate array data (sum, avg, min, max, count, concat)',
      category: 'Data',
      icon: 'sigma',
      color: '#2196F3',
      tags: ['data', 'aggregate', 'reduce', 'sum', 'average', 'calculate']
    };
  }
}
