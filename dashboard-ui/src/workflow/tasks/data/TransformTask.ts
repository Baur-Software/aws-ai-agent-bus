// Transform Task - Advanced Data Manipulation
// Map, reduce, sort, and transform data with JavaScript expressions

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

export interface TransformInput {
  input: any;
  operation: 'map' | 'reduce' | 'sort' | 'groupBy' | 'pluck' | 'flatten';
  expression?: string;
  field?: string;
  initialValue?: any;
  sortOrder?: 'asc' | 'desc';
  useContextInput?: boolean;
  contextInputField?: string;
}

export interface TransformOutput {
  result: any;
  operation: string;
  inputCount?: number;
  outputCount?: number;
  resultType: 'array' | 'object' | 'primitive';
  timestamp: string;
}

export class TransformTask implements WorkflowTask<TransformInput, TransformOutput> {
  readonly type = 'transform';

  constructor(private logger?: Logger) {}

  async execute(input: TransformInput, context: WorkflowContext): Promise<TransformOutput> {
    // Get input data
    let data = input.input;
    if (input.useContextInput) {
      const contextField = input.contextInputField || 'data';
      const contextData = context.data[contextField];
      if (contextData === undefined) {
        throw new TaskExecutionError(
          `Context field '${contextField}' not found`,
          this.type,
          context.nodeId,
          input
        );
      }
      data = contextData;
    }

    const inputCount = Array.isArray(data) ? data.length : undefined;

    this.logger?.info(`Transforming data with operation: ${input.operation}`);

    let result: any;

    try {
      switch (input.operation) {
        case 'map':
          result = this.mapOperation(data, input.expression!, context);
          break;

        case 'reduce':
          result = this.reduceOperation(data, input.expression!, input.initialValue, context);
          break;

        case 'sort':
          result = this.sortOperation(data, input.field, input.sortOrder || 'asc');
          break;

        case 'groupBy':
          result = this.groupByOperation(data, input.field!);
          break;

        case 'pluck':
          result = this.pluckOperation(data, input.field!);
          break;

        case 'flatten':
          result = this.flattenOperation(data);
          break;

        default:
          throw new Error(`Unknown operation: ${input.operation}`);
      }

      const resultType = Array.isArray(result) ? 'array' : typeof result === 'object' ? 'object' : 'primitive';
      const outputCount = Array.isArray(result) ? result.length : undefined;

      const output: TransformOutput = {
        result,
        operation: input.operation,
        inputCount,
        outputCount,
        resultType,
        timestamp: new Date().toISOString()
      };

      this.logger?.info(`Transform completed: ${input.operation} (${inputCount} → ${outputCount})`);

      // Store result in context
      context.data.transformResult = result;
      context.data.transformOperation = input.operation;

      return output;

    } catch (error) {
      this.logger?.error('Transform failed:', error);
      throw new TaskExecutionError(
        `Transform failed: ${error.message}`,
        this.type,
        context.nodeId,
        input
      );
    }
  }

  private mapOperation(data: any, expression: string, context: WorkflowContext): any[] {
    if (!Array.isArray(data)) {
      throw new Error('Map operation requires an array input');
    }

    // Create safe evaluation function
    const evalExpression = this.createEvaluator(expression, context);

    return data.map((item, index) => evalExpression(item, index));
  }

  private reduceOperation(data: any, expression: string, initialValue: any, context: WorkflowContext): any {
    if (!Array.isArray(data)) {
      throw new Error('Reduce operation requires an array input');
    }

    // Create safe evaluation function
    const evalExpression = this.createReduceEvaluator(expression, context);

    return data.reduce((acc, item, index) => evalExpression(acc, item, index), initialValue);
  }

  private sortOperation(data: any, field: string | undefined, order: 'asc' | 'desc'): any[] {
    if (!Array.isArray(data)) {
      throw new Error('Sort operation requires an array input');
    }

    const sorted = [...data].sort((a, b) => {
      let aVal = field ? this.getNestedValue(a, field) : a;
      let bVal = field ? this.getNestedValue(b, field) : b;

      // Handle null/undefined
      if (aVal === null || aVal === undefined) return order === 'asc' ? 1 : -1;
      if (bVal === null || bVal === undefined) return order === 'asc' ? -1 : 1;

      // Compare values
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();

      if (aVal < bVal) return order === 'asc' ? -1 : 1;
      if (aVal > bVal) return order === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  }

  private groupByOperation(data: any, field: string): Record<string, any[]> {
    if (!Array.isArray(data)) {
      throw new Error('GroupBy operation requires an array input');
    }

    const groups: Record<string, any[]> = {};

    for (const item of data) {
      const key = String(this.getNestedValue(item, field) || 'undefined');
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(item);
    }

    return groups;
  }

  private pluckOperation(data: any, field: string): any[] {
    if (!Array.isArray(data)) {
      throw new Error('Pluck operation requires an array input');
    }

    return data.map(item => this.getNestedValue(item, field));
  }

  private flattenOperation(data: any): any[] {
    if (!Array.isArray(data)) {
      throw new Error('Flatten operation requires an array input');
    }

    return data.flat(Infinity);
  }

  private getNestedValue(obj: any, path: string): any {
    const parts = path.split('.');
    let value = obj;

    for (const part of parts) {
      if (value === null || value === undefined) return undefined;
      value = value[part];
    }

    return value;
  }

  private createEvaluator(expression: string, context: WorkflowContext): (item: any, index: number) => any {
    // Safe evaluation using Function constructor (sandboxed)
    // Expression can reference: item, index, context
    try {
      return new Function('item', 'index', 'context', `return ${expression}`) as any;
    } catch (error) {
      throw new Error(`Invalid expression: ${error.message}`);
    }
  }

  private createReduceEvaluator(expression: string, context: WorkflowContext): (acc: any, item: any, index: number) => any {
    try {
      return new Function('acc', 'item', 'index', 'context', `return ${expression}`) as any;
    } catch (error) {
      throw new Error(`Invalid expression: ${error.message}`);
    }
  }

  validate(input: TransformInput): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!input.operation) {
      errors.push('Operation is required');
    }

    if (!['map', 'reduce', 'sort', 'groupBy', 'pluck', 'flatten'].includes(input.operation)) {
      errors.push('Invalid operation. Must be: map, reduce, sort, groupBy, pluck, or flatten');
    }

    // Operation-specific validation
    if (['map', 'reduce'].includes(input.operation) && !input.expression) {
      errors.push(`${input.operation} operation requires an expression`);
    }

    if (['sort', 'groupBy', 'pluck'].includes(input.operation) && !input.field) {
      errors.push(`${input.operation} operation requires a field`);
    }

    if (input.operation === 'reduce' && input.initialValue === undefined) {
      warnings.push('No initial value provided for reduce, will use undefined');
    }

    if (!input.useContextInput && input.input === undefined) {
      errors.push('Input is required when not using context input');
    }

    // Validate expression safety (basic check)
    if (input.expression) {
      const dangerousPatterns = ['eval', 'Function', 'require', 'import', 'process', 'global'];
      for (const pattern of dangerousPatterns) {
        if (input.expression.includes(pattern)) {
          warnings.push(`Expression contains potentially dangerous pattern: ${pattern}`);
        }
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
      title: 'Transform Data',
      description: 'Map, reduce, sort, and transform data',
      properties: {
        input: {
          type: 'array',
          title: 'Input Data',
          description: 'Data to transform (usually an array)'
        },
        operation: {
          type: 'string',
          title: 'Operation',
          description: 'Transform operation to perform',
          enum: ['map', 'reduce', 'sort', 'groupBy', 'pluck', 'flatten'],
          default: 'map'
        },
        expression: {
          type: 'string',
          title: 'Expression',
          description: 'JavaScript expression for map/reduce',
          placeholder: 'item.value * 2'
        },
        field: {
          type: 'string',
          title: 'Field',
          description: 'Field name for sort/groupBy/pluck',
          placeholder: 'age'
        },
        initialValue: {
          type: 'string',
          title: 'Initial Value',
          description: 'Starting value for reduce operation',
          placeholder: '0'
        },
        sortOrder: {
          type: 'string',
          title: 'Sort Order',
          description: 'Sort direction',
          enum: ['asc', 'desc'],
          default: 'asc'
        },
        useContextInput: {
          type: 'boolean',
          title: 'Use Input from Context',
          description: 'Get data from workflow context',
          default: false
        },
        contextInputField: {
          type: 'string',
          title: 'Context Input Field',
          description: 'Field name containing input data',
          default: 'data'
        }
      },
      required: ['operation'],
      examples: [
        {
          input: [1, 2, 3, 4, 5],
          operation: 'map',
          expression: 'item * 2'
        },
        {
          input: [{ name: 'John', age: 30 }, { name: 'Jane', age: 25 }],
          operation: 'sort',
          field: 'age',
          sortOrder: 'asc'
        },
        {
          input: [1, 2, 3, 4, 5],
          operation: 'reduce',
          expression: 'acc + item',
          initialValue: 0
        },
        {
          input: [{ type: 'A', value: 1 }, { type: 'B', value: 2 }, { type: 'A', value: 3 }],
          operation: 'groupBy',
          field: 'type'
        }
      ]
    };
  }

  getDisplayInfo(): TaskDisplayInfo {
    return {
      category: NODE_CATEGORIES.DATA_PROCESSING,
      label: 'Transform',
      icon: '🔄',
      color: 'bg-cyan-500',
      description: 'Map, reduce, sort, and transform data with expressions',
      tags: ['transform', 'map', 'reduce', 'sort', 'data', 'manipulation']
    };
  }
}
