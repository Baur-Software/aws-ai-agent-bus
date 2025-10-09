import { WorkflowTask, WorkflowContext } from '../../types/workflow';
import { TaskExecutionError } from '../../errors/TaskExecutionError';

export interface SplitTask_Input {
  data: string;
  delimiter?: string;
  limit?: number;
  trim?: boolean;
  removeEmpty?: boolean;
}

export interface SplitTask_Output {
  parts: string[];
  count: number;
  delimiter: string;
  success: boolean;
  timestamp: string;
}

export class SplitTask implements WorkflowTask<SplitTask_Input, SplitTask_Output> {
  readonly type = 'split';

  constructor(private logger?: any) {}

  async execute(input: SplitTask_Input, context: WorkflowContext): Promise<SplitTask_Output> {
    const startTime = Date.now();

    try {
      if (typeof input.data !== 'string') {
        throw new TaskExecutionError(
          this.type,
          context.nodeId || 'unknown',
          'Data must be a string'
        );
      }

      const delimiter = input.delimiter || ',';
      let parts: string[] = input.limit
        ? input.data.split(delimiter, input.limit)
        : input.data.split(delimiter);

      // Trim whitespace
      if (input.trim) {
        parts = parts.map(part => part.trim());
      }

      // Remove empty strings
      if (input.removeEmpty) {
        parts = parts.filter(part => part.length > 0);
      }

      const executionTime = Date.now() - startTime;
      this.logger?.info?.('String split successfully', {
        count: parts.length,
        delimiter,
        executionTime
      });

      return {
        parts,
        count: parts.length,
        delimiter,
        success: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger?.error?.('Failed to split string', { error });

      if (error instanceof TaskExecutionError) {
        throw error;
      }

      throw new TaskExecutionError(
        this.type,
        context.nodeId || 'unknown',
        `Failed to split string: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  async validate(input: SplitTask_Input): Promise<{ valid: boolean; errors: string[]; warnings: string[] }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (input.data === undefined || input.data === null) {
      errors.push('Data is required');
    } else if (typeof input.data !== 'string') {
      errors.push('Data must be a string');
    }

    if (input.limit !== undefined) {
      if (typeof input.limit !== 'number') {
        errors.push('Limit must be a number');
      } else if (input.limit < 1) {
        errors.push('Limit must be at least 1');
      }
    }

    if (input.delimiter === '') {
      warnings.push('Empty delimiter will split into individual characters');
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  getSchema() {
    return {
      input: {
        type: 'object',
        required: ['data'],
        properties: {
          data: {
            type: 'string',
            description: 'String to split'
          },
          delimiter: {
            type: 'string',
            description: 'Delimiter to split on',
            default: ',',
            examples: [',', ';', '|', '\n', ' ']
          },
          limit: {
            type: 'number',
            description: 'Maximum number of splits',
            minimum: 1
          },
          trim: {
            type: 'boolean',
            description: 'Trim whitespace from each part',
            default: false
          },
          removeEmpty: {
            type: 'boolean',
            description: 'Remove empty strings from result',
            default: false
          }
        }
      },
      output: {
        type: 'object',
        properties: {
          parts: { type: 'array', items: { type: 'string' } },
          count: { type: 'number' },
          delimiter: { type: 'string' },
          success: { type: 'boolean' },
          timestamp: { type: 'string', format: 'date-time' }
        }
      }
    };
  }

  getDisplayInfo() {
    return {
      name: 'Split',
      description: 'Split string into array by delimiter',
      category: 'Data',
      icon: 'split',
      color: '#2196F3',
      tags: ['data', 'string', 'split', 'parse', 'array']
    };
  }
}
