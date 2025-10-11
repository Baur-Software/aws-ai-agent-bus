import { WorkflowTask, WorkflowContext, TaskExecutionError, ValidationResult } from '../../types';

export interface TemplateTask_Input {
  template: string;
  data: Record<string, any>;
  delimiter?: string; // Default: '{{' and '}}'
}

export interface TemplateTask_Output {
  result: string;
  variablesReplaced: number;
  missingVariables: string[];
  success: boolean;
  timestamp: string;
}

export class TemplateTask implements WorkflowTask<TemplateTask_Input, TemplateTask_Output> {
  readonly type = 'template';

  constructor(private logger?: any) {}

  async execute(input: TemplateTask_Input, context: WorkflowContext): Promise<TemplateTask_Output> {
    const startTime = Date.now();

    try {
      const delimiter = input.delimiter || '{{';
      const closeDelimiter = input.delimiter === '{{' ? '}}' : input.delimiter;

      let result = input.template;
      let variablesReplaced = 0;
      const missingVariables: string[] = [];
      const usedVariables = new Set<string>();

      // Find all template variables
      const regex = new RegExp(`${this.escapeRegex(delimiter)}\\s*([\\w.]+)\\s*${this.escapeRegex(closeDelimiter)}`, 'g');

      result = result.replace(regex, (match, variable) => {
        const value = this.getNestedValue(input.data, variable);

        if (value !== undefined && value !== null) {
          variablesReplaced++;
          usedVariables.add(variable);
          return String(value);
        } else {
          if (!missingVariables.includes(variable)) {
            missingVariables.push(variable);
          }
          return match; // Keep original placeholder if no value
        }
      });

      const executionTime = Date.now() - startTime;
      this.logger?.info?.('Template rendered successfully', {
        variablesReplaced,
        missingVariables: missingVariables.length,
        executionTime
      });

      return {
        result,
        variablesReplaced,
        missingVariables,
        success: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger?.error?.('Failed to render template', { error });

      if (error instanceof TaskExecutionError) {
        throw error;
      }

      throw new TaskExecutionError(`Failed to render template: ${error instanceof Error ? error.message : String(error)}`, this.type, context.nodeId || 'unknown', error instanceof Error ? error : undefined
      );
    }
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  validate(input: TemplateTask_Input): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!input.template) {
      errors.push('Template is required');
    } else if (typeof input.template !== 'string') {
      errors.push('Template must be a string');
    }

    if (!input.data) {
      errors.push('Data is required');
    } else if (typeof input.data !== 'object' || Array.isArray(input.data)) {
      errors.push('Data must be an object');
    }

    if (input.delimiter !== undefined && typeof input.delimiter !== 'string') {
      errors.push('Delimiter must be a string');
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  getSchema() {
    return {
      input: {
        type: 'object',
        required: ['template', 'data'],
        properties: {
          template: {
            type: 'string',
            description: 'Template string with variables',
            examples: [
              'Hello {{name}}!',
              'Order #{{order.id}} total: ${{order.total}}',
              'Dear {{user.firstName}} {{user.lastName}}'
            ]
          },
          data: {
            type: 'object',
            description: 'Data object with values for template variables',
            examples: [
              { name: 'John' },
              { order: { id: 123, total: 99.99 } },
              { user: { firstName: 'Jane', lastName: 'Doe' } }
            ]
          },
          delimiter: {
            type: 'string',
            description: 'Variable delimiter (default: {{}})',
            default: '{{',
            examples: ['{{', '${', '<%', '[[']
          }
        }
      },
      output: {
        type: 'object',
        properties: {
          result: { type: 'string' },
          variablesReplaced: { type: 'number' },
          missingVariables: { type: 'array', items: { type: 'string' } },
          success: { type: 'boolean' },
          timestamp: { type: 'string', format: 'date-time' }
        }
      }
    };
  }

  getDisplayInfo() {
    return {
      name: 'Template',
      description: 'Render string template with variable substitution',
      category: 'Data',
      icon: 'file-text',
      color: '#2196F3',
      tags: ['data', 'template', 'string', 'variables', 'render']
    };
  }
}
