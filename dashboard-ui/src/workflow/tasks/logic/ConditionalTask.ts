// Conditional Task - If/Else Logic
// Evaluates conditions and branches workflow execution

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

export interface ConditionalInput {
  conditions: Array<{
    field: string;
    operator: 'equals' | 'notEquals' | 'greaterThan' | 'lessThan' | 'contains' | 'exists' | 'startsWith' | 'endsWith';
    value: any;
    logicalOperator?: 'AND' | 'OR';
  }>;
  useContextData?: boolean;
  contextDataKey?: string;
}

export interface ConditionalOutput {
  conditionMet: boolean;
  evaluatedConditions: Array<{
    field: string;
    operator: string;
    value: any;
    result: boolean;
  }>;
  branch: 'true' | 'false';
  timestamp: string;
}

export class ConditionalTask implements WorkflowTask<ConditionalInput, ConditionalOutput> {
  readonly type = 'conditional';

  constructor(private logger?: Logger) {}

  async execute(input: ConditionalInput, context: WorkflowContext): Promise<ConditionalOutput> {
    this.logger?.info(`Evaluating conditional with ${input.conditions.length} condition(s)`);

    // Get data to evaluate against
    const dataSource = input.useContextData && input.contextDataKey
      ? context.data[input.contextDataKey]
      : context.getPreviousResult();

    const evaluatedConditions: ConditionalOutput['evaluatedConditions'] = [];
    let overallResult = true;
    let currentLogicalOp: 'AND' | 'OR' = 'AND';

    for (const condition of input.conditions) {
      const fieldValue = this.getFieldValue(dataSource, condition.field);
      const conditionResult = this.evaluateCondition(fieldValue, condition.operator, condition.value);

      evaluatedConditions.push({
        field: condition.field,
        operator: condition.operator,
        value: condition.value,
        result: conditionResult
      });

      // Apply logical operator
      if (currentLogicalOp === 'AND') {
        overallResult = overallResult && conditionResult;
      } else {
        overallResult = overallResult || conditionResult;
      }

      // Update logical operator for next iteration
      currentLogicalOp = condition.logicalOperator || 'AND';
    }

    const output: ConditionalOutput = {
      conditionMet: overallResult,
      evaluatedConditions,
      branch: overallResult ? 'true' : 'false',
      timestamp: new Date().toISOString()
    };

    this.logger?.info(`Conditional evaluation result: ${overallResult ? 'TRUE' : 'FALSE'}`);

    // Store result in context
    context.data.conditionMet = overallResult;
    context.data.branch = output.branch;

    return output;
  }

  private getFieldValue(data: any, field: string): any {
    if (!data) return undefined;

    // Support nested field access (e.g., "user.email")
    const parts = field.split('.');
    let value = data;

    for (const part of parts) {
      if (value === null || value === undefined) return undefined;
      value = value[part];
    }

    return value;
  }

  private evaluateCondition(fieldValue: any, operator: string, compareValue: any): boolean {
    switch (operator) {
      case 'equals':
        return fieldValue == compareValue; // Loose equality
      case 'notEquals':
        return fieldValue != compareValue;
      case 'greaterThan':
        return fieldValue > compareValue;
      case 'lessThan':
        return fieldValue < compareValue;
      case 'contains':
        if (typeof fieldValue === 'string') {
          return fieldValue.includes(String(compareValue));
        }
        if (Array.isArray(fieldValue)) {
          return fieldValue.includes(compareValue);
        }
        return false;
      case 'exists':
        return fieldValue !== null && fieldValue !== undefined;
      case 'startsWith':
        return typeof fieldValue === 'string' && fieldValue.startsWith(String(compareValue));
      case 'endsWith':
        return typeof fieldValue === 'string' && fieldValue.endsWith(String(compareValue));
      default:
        this.logger?.warn(`Unknown operator: ${operator}, defaulting to false`);
        return false;
    }
  }

  validate(input: ConditionalInput): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!input.conditions || input.conditions.length === 0) {
      errors.push('At least one condition is required');
    }

    input.conditions?.forEach((condition, index) => {
      if (!condition.field) {
        errors.push(`Condition ${index + 1}: field is required`);
      }
      if (!condition.operator) {
        errors.push(`Condition ${index + 1}: operator is required`);
      }
      if (condition.value === undefined && condition.operator !== 'exists') {
        warnings.push(`Condition ${index + 1}: value is undefined (may be intentional)`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  getSchema(): TaskConfigSchema {
    return {
      type: 'object',
      title: 'Conditional (If/Else)',
      description: 'Evaluate conditions and branch workflow execution',
      properties: {
        conditions: {
          type: 'array',
          title: 'Conditions',
          description: 'List of conditions to evaluate',
          items: {
            type: 'object',
            properties: {
              field: {
                type: 'string',
                title: 'Field',
                description: 'Field name to check (supports nested paths like "user.email")'
              },
              operator: {
                type: 'string',
                title: 'Operator',
                description: 'Comparison operator',
                enum: ['equals', 'notEquals', 'greaterThan', 'lessThan', 'contains', 'exists', 'startsWith', 'endsWith']
              },
              value: {
                type: 'string',
                title: 'Value',
                description: 'Value to compare against'
              },
              logicalOperator: {
                type: 'string',
                title: 'Logical Operator',
                description: 'How to combine with next condition',
                enum: ['AND', 'OR'],
                default: 'AND'
              }
            }
          }
        },
        useContextData: {
          type: 'boolean',
          title: 'Use Context Data',
          description: 'Evaluate against specific context data',
          default: false
        },
        contextDataKey: {
          type: 'string',
          title: 'Context Data Key',
          description: 'Key to use from context data'
        }
      },
      required: ['conditions']
    };
  }

  getDisplayInfo(): TaskDisplayInfo {
    return {
      category: NODE_CATEGORIES.DATA_PROCESSING,
      label: 'Conditional',
      icon: '🔀',
      color: 'bg-amber-500',
      description: 'Evaluate conditions and branch workflow execution',
      tags: ['logic', 'conditional', 'if', 'branch', 'control-flow']
    };
  }
}
