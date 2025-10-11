// Output Task
// Collects and formats final workflow output

import {
  WorkflowTask,
  WorkflowContext,
  ValidationResult,
  TaskConfigSchema,
  TaskDisplayInfo,
  Logger,
  NODE_CATEGORIES
} from '../../types';

export interface OutputInput {
  format?: 'json' | 'summary' | 'detailed' | 'custom';
  fields?: string[];  // For field selection
  includeMetadata?: boolean;
  customTemplate?: string;  // For custom format template
}

export interface OutputOutput {
  success?: boolean;
  format: string;
  output: any;
}

export class OutputTask implements WorkflowTask<OutputInput, OutputOutput> {
  readonly type = 'output';

  constructor(
    private logger?: Logger
  ) {}

  async execute(input: OutputInput, context: WorkflowContext): Promise<OutputOutput> {
    const format = input.format || 'json';

    this.logger?.info(`Formatting workflow output as: ${format}`);

    try {
      let output: any;

      switch (format) {
        case 'json':
          output = this.generateJSONOutput(input, context);
          break;
        case 'summary':
          output = this.generateSummaryOutput(input, context);
          break;
        case 'detailed':
          output = this.generateDetailedOutput(input, context);
          break;
        case 'custom':
          output = this.generateCustomOutput(input, context);
          break;
        default:
          output = this.generateJSONOutput(input, context);
      }

      // Store output in context for downstream tasks
      context.data.finalOutput = output;
      context.data.outputFormat = format;

      this.logger?.info('Successfully formatted workflow output');

      return {
        success: true,
        format,
        output
      };
    } catch (error: any) {
      this.logger?.error('Failed to format output:', error);
      return {
        success: false,
        format: 'error',
        output: { error: error.message }
      };
    }
  }

  validate(input: OutputInput): ValidationResult {
    const errors: string[] = [];

    if (input.format && !['json', 'summary', 'detailed', 'custom'].includes(input.format)) {
      errors.push('Format must be one of: json, summary, detailed, custom');
    }

    if (input.format === 'custom' && !input.customTemplate) {
      errors.push('Custom template is required when format is "custom"');
    }

    // Validate fields array if provided
    if (input.fields) {
      if (!Array.isArray(input.fields)) {
        errors.push('Fields must be an array');
      } else if (input.fields.some(f => typeof f !== 'string')) {
        errors.push('All fields must be strings');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  getSchema(): TaskConfigSchema {
    return {
      type: 'object',
      title: 'Output Formatter',
      description: 'Collect and format final workflow output',
      properties: {
        format: {
          type: 'string',
          title: 'Output Format',
          description: 'How to format the final output',
          enum: ['json', 'summary', 'detailed', 'custom'],
          default: 'json'
        },
        fields: {
          type: 'array',
          title: 'Fields',
          description: 'Specific fields to include in output (supports dot notation)',
          items: {
            type: 'string',
            title: 'Field Path',
            description: 'Field path (supports dot notation)'
          }
        },
        includeMetadata: {
          type: 'boolean',
          title: 'Include Metadata',
          description: 'Include context metadata in output',
          default: false
        },
        customTemplate: {
          type: 'string',
          title: 'Custom Template',
          description: 'Template string for custom format (use {{field}} syntax)'
        }
      },
      required: []
    };
  }

  getDisplayInfo(): TaskDisplayInfo {
    return {
      category: NODE_CATEGORIES.CORE,
      label: 'Output',
      icon: 'FileOutput',
      color: 'bg-gray-600',
      description: 'Collect and format final workflow output',
      tags: ['core', 'output', 'result', 'format']
    };
  }

  private generateJSONOutput(input: OutputInput, context: WorkflowContext): any {
    // If fields are specified, select only those fields
    if (input.fields && input.fields.length > 0) {
      return this.selectFields(input.fields, context);
    }

    // Filter out internal fields from context.data
    const cleanData = { ...context.data };
    delete cleanData.finalOutput;
    delete cleanData.outputFormat;

    // Otherwise return full context data and results
    const output: any = {
      data: cleanData,
      results: context.results
    };

    if (input.includeMetadata) {
      output.metadata = context.metadata;
    }

    return output;
  }

  private generateSummaryOutput(_input: OutputInput, context: WorkflowContext): string {
    const taskCount = Object.keys(context.results || {}).length;

    // Filter out internal fields
    const cleanData = { ...context.data };
    delete cleanData.finalOutput;
    delete cleanData.outputFormat;

    const dataFields = Object.keys(cleanData).join(', ');

    let summary = `Workflow completed successfully\n`;
    summary += `${taskCount} tasks executed\n`;
    if (dataFields) {
      summary += `Data fields: ${dataFields}\n`;

      // Include actual data values in summary
      Object.entries(cleanData).forEach(([key, value]) => {
        if (typeof value === 'number' || typeof value === 'boolean') {
          summary += `${key}: ${value}\n`;
        }
      });
    }

    return summary.trimEnd();
  }

  private generateDetailedOutput(_input: OutputInput, context: WorkflowContext): string {
    const taskCount = Object.keys(context.results || {}).length;
    const hasErrors = context.errors && context.errors.length > 0;

    let output = '=== Workflow Execution Report ===\n\n';

    // Add summary
    if (!hasErrors) {
      output += `Workflow completed successfully\n`;
    }
    output += `${taskCount} tasks executed\n\n`;

    output += `Execution ID: ${context.executionId}\n`;
    output += `Workflow ID: ${context.workflowId}\n`;

    // Filter out internal fields
    const cleanData = { ...context.data };
    delete cleanData.finalOutput;
    delete cleanData.outputFormat;

    // Add context data with clean formatting
    output += '\n=== Context Data ===\n';
    Object.entries(cleanData).forEach(([key, value]) => {
      // Capitalize first letter only for 'status' key
      const displayKey = key === 'status' ? 'Status' : key;

      // Show primitives as plain values, objects/arrays as JSON
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        output += `${displayKey}: ${value}\n`;
      } else {
        output += `${displayKey}: ${JSON.stringify(value)}\n`;
      }
    });

    // Add task results with flattened nested values
    output += '\n=== Task Results ===\n';
    Object.entries(context.results || {}).forEach(([nodeId, result]) => {
      output += `${nodeId}: ${JSON.stringify(result)}\n`;

      // Also output nested primitive values for easier access
      if (result && typeof result === 'object') {
        Object.entries(result).forEach(([nestedKey, nestedValue]) => {
          if (typeof nestedValue === 'number' || typeof nestedValue === 'boolean') {
            output += `${nestedKey}: ${nestedValue}\n`;
          }
        });
      }
    });

    // Add errors if any
    if (hasErrors) {
      output += '\n=== Errors/Issues ===\n';
      context.errors.forEach(error => {
        output += `${error.message}\n`;
      });
    }

    return output.trimEnd();
  }

  private generateCustomOutput(input: OutputInput, context: WorkflowContext): string {
    if (!input.customTemplate) {
      return '';
    }

    let output = input.customTemplate;

    // Simple template replacement - replace {{field}} with values from context.data
    // NOTE: This only handles direct property access, not computed properties like .length
    const templateRegex = /\{\{([^}]+)\}\}/g;
    output = output.replace(templateRegex, (match, fieldPath) => {
      const trimmed = fieldPath.trim();

      // Skip computed properties (anything with .length, method calls, etc.)
      if (trimmed.includes('.length') || trimmed.includes('(')) {
        return match; // Leave as-is
      }

      const value = this.getNestedValue(context.data, trimmed);
      return value !== undefined ? String(value) : match;
    });

    return output;
  }

  private selectFields(fields: string[], context: WorkflowContext): any {
    const result: any = {};

    for (const field of fields) {
      // Try to get value from data first
      let value = this.getNestedValue(context.data, field);

      // If not in data, try results
      if (value === undefined) {
        value = this.getNestedValue(context.results, field);
      }

      if (value !== undefined) {
        result[field] = value;
      }
    }

    return result;
  }

  private getNestedValue(obj: any, path: string): any {
    if (!obj || typeof obj !== 'object') {
      return undefined;
    }

    const parts = path.split('.');
    let current = obj;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = current[part];
    }

    return current;
  }
}
