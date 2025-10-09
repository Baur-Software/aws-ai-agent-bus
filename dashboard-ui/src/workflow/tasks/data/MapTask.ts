import { WorkflowTask, WorkflowContext } from '../../types/workflow';
import { TaskExecutionError } from '../../errors/TaskExecutionError';

export interface MapTask_Input {
  data: any[];
  mapping: Record<string, string>; // { newField: 'sourceField' } or { newField: 'expression' }
  removeOriginal?: boolean;
}

export interface MapTask_Output {
  data: any[];
  count: number;
  fieldsAdded: string[];
  fieldsRemoved?: string[];
  success: boolean;
  timestamp: string;
}

export class MapTask implements WorkflowTask<MapTask_Input, MapTask_Output> {
  readonly type = 'map';

  constructor(private logger?: any) {}

  async execute(input: MapTask_Input, context: WorkflowContext): Promise<MapTask_Output> {
    const startTime = Date.now();

    try {
      if (!Array.isArray(input.data)) {
        throw new TaskExecutionError(
          this.type,
          context.nodeId || 'unknown',
          'Data must be an array'
        );
      }

      const mappedData = input.data.map((item, index) => {
        const result: any = input.removeOriginal ? {} : { ...item };

        for (const [newField, source] of Object.entries(input.mapping)) {
          try {
            // Check if source is a direct field reference
            if (source.includes('.')) {
              // Nested field access (e.g., "user.email")
              result[newField] = this.getNestedValue(item, source);
            } else if (this.isExpression(source)) {
              // JavaScript expression evaluation
              result[newField] = this.evaluateExpression(source, item, index, context);
            } else {
              // Simple field reference
              result[newField] = item[source];
            }
          } catch (error) {
            this.logger?.warn?.('Failed to map field', {
              newField,
              source,
              error: error instanceof Error ? error.message : String(error)
            });
            result[newField] = null;
          }
        }

        return result;
      });

      const fieldsAdded = Object.keys(input.mapping);
      const fieldsRemoved = input.removeOriginal ? Object.keys(input.data[0] || {}).filter(
        key => !fieldsAdded.includes(key)
      ) : undefined;

      const executionTime = Date.now() - startTime;
      this.logger?.info?.('Data mapped successfully', {
        count: mappedData.length,
        fieldsAdded: fieldsAdded.length,
        executionTime
      });

      return {
        data: mappedData,
        count: mappedData.length,
        fieldsAdded,
        fieldsRemoved,
        success: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger?.error?.('Failed to map data', { error });

      if (error instanceof TaskExecutionError) {
        throw error;
      }

      throw new TaskExecutionError(
        this.type,
        context.nodeId || 'unknown',
        `Failed to map data: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private isExpression(source: string): boolean {
    // Check if it contains operators or function calls
    return /[+\-*/%<>=!&|()]/.test(source) || /\b(Math|String|Number|Date)\b/.test(source);
  }

  private evaluateExpression(expression: string, item: any, index: number, context: WorkflowContext): any {
    try {
      const func = new Function('item', 'index', 'context', `return ${expression}`);
      return func(item, index, context);
    } catch (error) {
      this.logger?.warn?.('Expression evaluation failed', { expression, error });
      return null;
    }
  }

  async validate(input: MapTask_Input): Promise<{ valid: boolean; errors: string[]; warnings: string[] }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!input.data) {
      errors.push('Data is required');
    } else if (!Array.isArray(input.data)) {
      errors.push('Data must be an array');
    }

    if (!input.mapping) {
      errors.push('Mapping is required');
    } else if (typeof input.mapping !== 'object' || Array.isArray(input.mapping)) {
      errors.push('Mapping must be an object');
    } else if (Object.keys(input.mapping).length === 0) {
      errors.push('Mapping cannot be empty');
    }

    if (input.removeOriginal && input.data?.length > 0) {
      warnings.push('removeOriginal will discard all original fields');
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  getSchema() {
    return {
      input: {
        type: 'object',
        required: ['data', 'mapping'],
        properties: {
          data: {
            type: 'array',
            description: 'Array of objects to map',
            items: { type: 'object' }
          },
          mapping: {
            type: 'object',
            description: 'Field mappings: { newField: "sourceField" } or { newField: "expression" }',
            additionalProperties: { type: 'string' },
            examples: [
              { fullName: 'firstName + " " + lastName' },
              { email: 'user.email' },
              { age: 'profile.age' }
            ]
          },
          removeOriginal: {
            type: 'boolean',
            description: 'Remove original fields (keep only mapped fields)',
            default: false
          }
        }
      },
      output: {
        type: 'object',
        properties: {
          data: { type: 'array', items: { type: 'object' } },
          count: { type: 'number' },
          fieldsAdded: { type: 'array', items: { type: 'string' } },
          fieldsRemoved: { type: 'array', items: { type: 'string' } },
          success: { type: 'boolean' },
          timestamp: { type: 'string', format: 'date-time' }
        }
      }
    };
  }

  getDisplayInfo() {
    return {
      name: 'Map',
      description: 'Transform array items by mapping fields to new structure',
      category: 'Data',
      icon: 'map',
      color: '#2196F3',
      tags: ['data', 'transform', 'map', 'fields', 'restructure']
    };
  }
}
