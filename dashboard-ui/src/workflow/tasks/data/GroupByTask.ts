import { WorkflowTask, WorkflowContext } from '../../types/workflow';
import { TaskExecutionError } from '../../errors/TaskExecutionError';

export interface GroupByTask_Input {
  data: any[];
  field: string;
  aggregations?: {
    field: string;
    operation: 'sum' | 'avg' | 'min' | 'max' | 'count';
    as?: string; // Output field name
  }[];
}

export interface GroupByTask_Output {
  groups: Record<string, any>;
  groupCount: number;
  totalItems: number;
  success: boolean;
  timestamp: string;
}

export class GroupByTask implements WorkflowTask<GroupByTask_Input, GroupByTask_Output> {
  readonly type = 'group-by';

  constructor(private logger?: any) {}

  async execute(input: GroupByTask_Input, context: WorkflowContext): Promise<GroupByTask_Output> {
    const startTime = Date.now();

    try {
      if (!Array.isArray(input.data)) {
        throw new TaskExecutionError(
          this.type,
          context.nodeId || 'unknown',
          'Data must be an array'
        );
      }

      const groups: Record<string, any[]> = {};

      // Group items by field value
      for (const item of input.data) {
        const key = this.getFieldValue(item, input.field);
        const keyStr = String(key ?? 'null');

        if (!groups[keyStr]) {
          groups[keyStr] = [];
        }
        groups[keyStr].push(item);
      }

      // Apply aggregations if specified
      const result: Record<string, any> = {};

      for (const [key, items] of Object.entries(groups)) {
        const groupData: any = {
          [input.field]: key === 'null' ? null : this.parseValue(key),
          items: items.length
        };

        if (input.aggregations) {
          for (const agg of input.aggregations) {
            const outputField = agg.as || `${agg.field}_${agg.operation}`;
            groupData[outputField] = this.aggregate(items, agg.field, agg.operation);
          }
        } else {
          // If no aggregations, include the items
          groupData.data = items;
        }

        result[key] = groupData;
      }

      const executionTime = Date.now() - startTime;
      this.logger?.info?.('Data grouped successfully', {
        groupCount: Object.keys(result).length,
        totalItems: input.data.length,
        executionTime
      });

      return {
        groups: result,
        groupCount: Object.keys(result).length,
        totalItems: input.data.length,
        success: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger?.error?.('Failed to group data', { error });

      if (error instanceof TaskExecutionError) {
        throw error;
      }

      throw new TaskExecutionError(
        this.type,
        context.nodeId || 'unknown',
        `Failed to group data: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  private getFieldValue(item: any, field: string): any {
    return field.includes('.')
      ? field.split('.').reduce((obj, key) => obj?.[key], item)
      : item[field];
  }

  private parseValue(str: string): any {
    // Try to parse back to number if it was a number
    const num = Number(str);
    if (!isNaN(num) && str === String(num)) {
      return num;
    }
    return str;
  }

  private aggregate(items: any[], field: string, operation: string): number {
    const values = items.map(item => this.getFieldValue(item, field)).filter(v => typeof v === 'number');

    if (values.length === 0) return 0;

    switch (operation) {
      case 'sum':
        return values.reduce((sum, val) => sum + val, 0);
      case 'avg':
        return values.reduce((sum, val) => sum + val, 0) / values.length;
      case 'min':
        return Math.min(...values);
      case 'max':
        return Math.max(...values);
      case 'count':
        return values.length;
      default:
        return 0;
    }
  }

  async validate(input: GroupByTask_Input): Promise<{ valid: boolean; errors: string[]; warnings: string[] }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!input.data) {
      errors.push('Data is required');
    } else if (!Array.isArray(input.data)) {
      errors.push('Data must be an array');
    }

    if (!input.field) {
      errors.push('Field is required');
    } else if (typeof input.field !== 'string') {
      errors.push('Field must be a string');
    }

    if (input.aggregations) {
      if (!Array.isArray(input.aggregations)) {
        errors.push('Aggregations must be an array');
      } else {
        for (const agg of input.aggregations) {
          if (!agg.field) errors.push('Aggregation field is required');
          if (!agg.operation) errors.push('Aggregation operation is required');
          if (!['sum', 'avg', 'min', 'max', 'count'].includes(agg.operation)) {
            errors.push(`Invalid aggregation operation: ${agg.operation}`);
          }
        }
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  getSchema() {
    return {
      input: {
        type: 'object',
        required: ['data', 'field'],
        properties: {
          data: {
            type: 'array',
            description: 'Array to group',
            items: { type: 'object' }
          },
          field: {
            type: 'string',
            description: 'Field to group by',
            examples: ['category', 'status', 'user.role']
          },
          aggregations: {
            type: 'array',
            description: 'Aggregations to compute for each group',
            items: {
              type: 'object',
              properties: {
                field: { type: 'string', description: 'Field to aggregate' },
                operation: { type: 'string', enum: ['sum', 'avg', 'min', 'max', 'count'] },
                as: { type: 'string', description: 'Output field name' }
              },
              required: ['field', 'operation']
            }
          }
        }
      },
      output: {
        type: 'object',
        properties: {
          groups: { type: 'object', description: 'Grouped data by key' },
          groupCount: { type: 'number' },
          totalItems: { type: 'number' },
          success: { type: 'boolean' },
          timestamp: { type: 'string', format: 'date-time' }
        }
      }
    };
  }

  getDisplayInfo() {
    return {
      name: 'Group By',
      description: 'Group array items by field value with optional aggregations',
      category: 'Data',
      icon: 'layers',
      color: '#2196F3',
      tags: ['data', 'group', 'aggregate', 'categorize', 'organize']
    };
  }
}
