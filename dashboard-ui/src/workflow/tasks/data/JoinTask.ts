import { WorkflowTask, WorkflowContext, TaskExecutionError, ValidationResult } from '../../types';

export interface JoinTask_Input {
  data: any[];
  separator?: string;
  field?: string; // If data is array of objects, join this field
}

export interface JoinTask_Output {
  result: string;
  itemsJoined: number;
  separator: string;
  success: boolean;
  timestamp: string;
}

export class JoinTask implements WorkflowTask<JoinTask_Input, JoinTask_Output> {
  readonly type = 'join';

  constructor(private logger?: any) {}

  async execute(input: JoinTask_Input, context: WorkflowContext): Promise<JoinTask_Output> {
    const startTime = Date.now();

    try {
      if (!Array.isArray(input.data)) {
        throw new TaskExecutionError(
          this.type,
          context.nodeId || 'unknown',
          'Data must be an array'
        );
      }

      const separator = input.separator !== undefined ? input.separator : ',';

      let values: any[];

      if (input.field) {
        // Extract field from objects
        values = input.data.map(item => {
          if (typeof item === 'object' && item !== null) {
            return input.field!.includes('.')
              ? this.getNestedValue(item, input.field!)
              : item[input.field!];
          }
          return item;
        });
      } else {
        values = input.data;
      }

      // Convert all values to strings and filter out nullish values
      const stringValues = values
        .filter(val => val !== null && val !== undefined)
        .map(val => String(val));

      const result = stringValues.join(separator);

      const executionTime = Date.now() - startTime;
      this.logger?.info?.('Array joined successfully', {
        itemsJoined: stringValues.length,
        separator,
        executionTime
      });

      return {
        result,
        itemsJoined: stringValues.length,
        separator,
        success: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger?.error?.('Failed to join array', { error });

      if (error instanceof TaskExecutionError) {
        throw error;
      }

      throw new TaskExecutionError(`Failed to join array: ${error instanceof Error ? error.message : String(error)}`, this.type, context.nodeId || 'unknown', error instanceof Error ? error : undefined
      );
    }
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  validate(input: JoinTask_Input): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!input.data) {
      errors.push('Data is required');
    } else if (!Array.isArray(input.data)) {
      errors.push('Data must be an array');
    }

    if (input.separator !== undefined && typeof input.separator !== 'string') {
      errors.push('Separator must be a string');
    }

    if (input.field !== undefined && typeof input.field !== 'string') {
      errors.push('Field must be a string');
    }

    if (input.data && Array.isArray(input.data) && input.data.length === 0) {
      warnings.push('Joining empty array will produce empty string');
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
            description: 'Array to join',
            items: { type: 'any' }
          },
          separator: {
            type: 'string',
            description: 'Separator between elements',
            default: ',',
            examples: [',', ', ', ' | ', '\n', ';']
          },
          field: {
            type: 'string',
            description: 'Field to extract from objects (if data is array of objects)',
            examples: ['name', 'email', 'user.displayName']
          }
        }
      },
      output: {
        type: 'object',
        properties: {
          result: { type: 'string' },
          itemsJoined: { type: 'number' },
          separator: { type: 'string' },
          success: { type: 'boolean' },
          timestamp: { type: 'string', format: 'date-time' }
        }
      }
    };
  }

  getDisplayInfo() {
    return {
      name: 'Join',
      description: 'Join array elements into string with separator',
      category: 'Data',
      icon: 'link',
      color: '#2196F3',
      tags: ['data', 'array', 'join', 'string', 'combine']
    };
  }
}
