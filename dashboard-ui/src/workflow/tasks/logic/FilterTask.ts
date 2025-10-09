// Filter Task - Array Filtering
// Filter array items based on conditions

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

export interface FilterInput {
  array: any[];
  field: string;
  operator: 'equals' | 'notEquals' | 'greaterThan' | 'lessThan' | 'greaterThanOrEqual' | 'lessThanOrEqual' | 'contains' | 'exists' | 'startsWith' | 'endsWith' | 'matches';
  value?: any;
  useContextArray?: boolean;
  contextArrayField?: string;
  caseSensitive?: boolean;
}

export interface FilterOutput {
  inputCount: number;
  outputCount: number;
  filtered: any[];
  removedCount: number;
  timestamp: string;
}

export class FilterTask implements WorkflowTask<FilterInput, FilterOutput> {
  readonly type = 'filter';

  constructor(private logger?: Logger) {}

  async execute(input: FilterInput, context: WorkflowContext): Promise<FilterOutput> {
    // Get array to filter
    let array = input.array;
    if (input.useContextArray) {
      const contextField = input.contextArrayField || 'array';
      const contextArray = context.data[contextField];
      if (!Array.isArray(contextArray)) {
        throw new TaskExecutionError(
          `Context field '${contextField}' is not an array`,
          this.type,
          context.nodeId,
          input
        );
      }
      array = contextArray;
    }

    if (!Array.isArray(array)) {
      throw new TaskExecutionError(
        'Input must be an array',
        this.type,
        context.nodeId,
        input
      );
    }

    this.logger?.info(`Filtering array of ${array.length} items`);

    // Filter items
    const filtered = array.filter(item => {
      const fieldValue = this.getFieldValue(item, input.field);
      return this.evaluateCondition(fieldValue, input.operator, input.value, input.caseSensitive);
    });

    const output: FilterOutput = {
      inputCount: array.length,
      outputCount: filtered.length,
      filtered,
      removedCount: array.length - filtered.length,
      timestamp: new Date().toISOString()
    };

    this.logger?.info(`Filtered: ${array.length} -> ${filtered.length} items (${output.removedCount} removed)`);

    // Store results in context
    context.data.filteredArray = filtered;
    context.data.filterInputCount = array.length;
    context.data.filterOutputCount = filtered.length;

    return output;
  }

  private getFieldValue(item: any, field: string): any {
    if (item === null || item === undefined) return undefined;

    // Support nested field access (e.g., "user.email")
    const parts = field.split('.');
    let value = item;

    for (const part of parts) {
      if (value === null || value === undefined) return undefined;
      value = value[part];
    }

    return value;
  }

  private evaluateCondition(
    fieldValue: any,
    operator: string,
    compareValue: any,
    caseSensitive: boolean = true
  ): boolean {
    switch (operator) {
      case 'equals':
        if (typeof fieldValue === 'string' && typeof compareValue === 'string' && !caseSensitive) {
          return fieldValue.toLowerCase() === compareValue.toLowerCase();
        }
        return fieldValue == compareValue;

      case 'notEquals':
        if (typeof fieldValue === 'string' && typeof compareValue === 'string' && !caseSensitive) {
          return fieldValue.toLowerCase() !== compareValue.toLowerCase();
        }
        return fieldValue != compareValue;

      case 'greaterThan':
        return fieldValue > compareValue;

      case 'lessThan':
        return fieldValue < compareValue;

      case 'greaterThanOrEqual':
        return fieldValue >= compareValue;

      case 'lessThanOrEqual':
        return fieldValue <= compareValue;

      case 'contains':
        if (typeof fieldValue === 'string' && typeof compareValue === 'string') {
          const searchValue = caseSensitive ? fieldValue : fieldValue.toLowerCase();
          const findValue = caseSensitive ? compareValue : compareValue.toLowerCase();
          return searchValue.includes(findValue);
        }
        if (Array.isArray(fieldValue)) {
          return fieldValue.includes(compareValue);
        }
        return false;

      case 'exists':
        return fieldValue !== null && fieldValue !== undefined;

      case 'startsWith':
        if (typeof fieldValue === 'string' && typeof compareValue === 'string') {
          const searchValue = caseSensitive ? fieldValue : fieldValue.toLowerCase();
          const findValue = caseSensitive ? compareValue : compareValue.toLowerCase();
          return searchValue.startsWith(findValue);
        }
        return false;

      case 'endsWith':
        if (typeof fieldValue === 'string' && typeof compareValue === 'string') {
          const searchValue = caseSensitive ? fieldValue : fieldValue.toLowerCase();
          const findValue = caseSensitive ? compareValue : compareValue.toLowerCase();
          return searchValue.endsWith(findValue);
        }
        return false;

      case 'matches':
        if (typeof fieldValue === 'string' && typeof compareValue === 'string') {
          try {
            const flags = caseSensitive ? '' : 'i';
            const regex = new RegExp(compareValue, flags);
            return regex.test(fieldValue);
          } catch (error) {
            this.logger?.warn(`Invalid regex pattern: ${compareValue}`);
            return false;
          }
        }
        return false;

      default:
        this.logger?.warn(`Unknown operator: ${operator}, defaulting to false`);
        return false;
    }
  }

  validate(input: FilterInput): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!input.useContextArray && (!input.array || !Array.isArray(input.array))) {
      errors.push('Array is required when not using context array');
    }

    if (!input.field) {
      errors.push('Field is required');
    }

    if (!input.operator) {
      errors.push('Operator is required');
    }

    if (input.value === undefined && input.operator !== 'exists') {
      warnings.push('Value is undefined (may be intentional for exists operator)');
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
      title: 'Filter',
      description: 'Filter array items based on conditions',
      properties: {
        array: {
          type: 'array',
          title: 'Input Array',
          description: 'Array to filter',
          items: {
            type: 'object',
            properties: {}
          }
        },
        field: {
          type: 'string',
          title: 'Field to Check',
          description: 'Field name to evaluate (supports nested paths like "user.email")'
        },
        operator: {
          type: 'string',
          title: 'Operator',
          description: 'Comparison operator',
          enum: [
            'equals',
            'notEquals',
            'greaterThan',
            'lessThan',
            'greaterThanOrEqual',
            'lessThanOrEqual',
            'contains',
            'exists',
            'startsWith',
            'endsWith',
            'matches'
          ],
          default: 'equals'
        },
        value: {
          type: 'string',
          title: 'Value',
          description: 'Value to compare against'
        },
        useContextArray: {
          type: 'boolean',
          title: 'Use Array from Context',
          description: 'Get array from workflow context',
          default: false
        },
        contextArrayField: {
          type: 'string',
          title: 'Context Array Field',
          description: 'Field name in context containing array',
          default: 'array'
        },
        caseSensitive: {
          type: 'boolean',
          title: 'Case Sensitive',
          description: 'Whether string comparisons are case sensitive',
          default: true
        }
      },
      required: ['field', 'operator'],
      examples: [
        {
          array: [
            { status: 'active', age: 25 },
            { status: 'inactive', age: 30 },
            { status: 'active', age: 35 }
          ],
          field: 'status',
          operator: 'equals',
          value: 'active'
        },
        {
          useContextArray: true,
          contextArrayField: 'users',
          field: 'email',
          operator: 'endsWith',
          value: '@example.com',
          caseSensitive: false
        }
      ]
    };
  }

  getDisplayInfo(): TaskDisplayInfo {
    return {
      category: NODE_CATEGORIES.DATA_PROCESSING,
      label: 'Filter',
      icon: '🔍',
      color: 'bg-teal-500',
      description: 'Filter array items based on conditions',
      tags: ['filter', 'array', 'data', 'condition', 'select']
    };
  }
}
