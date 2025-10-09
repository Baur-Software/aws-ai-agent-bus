// JSON Stringify Task - Object to JSON String
// Convert JavaScript objects to JSON strings for API requests and storage

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

export interface JSONStringifyInput {
  input: any;
  useContextInput?: boolean;
  contextInputField?: string;
  pretty?: boolean;
  indent?: number;
  replacer?: string[]; // Keys to include (whitelist)
  space?: string | number;
}

export interface JSONStringifyOutput {
  json: string;
  originalType: string;
  byteSize: number;
  lineCount: number;
  success: boolean;
  timestamp: string;
}

export class JSONStringifyTask implements WorkflowTask<JSONStringifyInput, JSONStringifyOutput> {
  readonly type = 'json-stringify';

  constructor(private logger?: Logger) {}

  async execute(input: JSONStringifyInput, context: WorkflowContext): Promise<JSONStringifyOutput> {
    // Get input to stringify
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

    const originalType = typeof data;
    this.logger?.info(`Stringifying ${originalType} to JSON`);

    try {
      // Prepare replacer function if needed
      let replacer: ((key: string, value: any) => any) | string[] | undefined;
      if (input.replacer && Array.isArray(input.replacer)) {
        replacer = input.replacer;
        this.logger?.debug(`Using replacer with ${input.replacer.length} keys`);
      }

      // Determine indentation
      let space: string | number | undefined;
      if (input.pretty !== false) {
        space = input.space !== undefined ? input.space : (input.indent || 2);
      }

      // Stringify the data
      const json = JSON.stringify(data, replacer as any, space);

      // Calculate metrics
      const byteSize = new Blob([json]).size;
      const lineCount = json.split('\n').length;

      const output: JSONStringifyOutput = {
        json,
        originalType,
        byteSize,
        lineCount,
        success: true,
        timestamp: new Date().toISOString()
      };

      this.logger?.info(`JSON stringified: ${byteSize} bytes, ${lineCount} lines`);

      // Store in context for downstream nodes
      context.data.jsonString = json;
      context.data.jsonByteSize = byteSize;

      return output;

    } catch (error) {
      this.logger?.error('JSON stringify failed:', error);

      // Handle circular references and other errors
      if (error.message.includes('circular')) {
        throw new TaskExecutionError(
          'Cannot stringify object with circular references',
          this.type,
          context.nodeId,
          input
        );
      }

      throw new TaskExecutionError(
        `JSON stringify failed: ${error.message}`,
        this.type,
        context.nodeId,
        input
      );
    }
  }

  validate(input: JSONStringifyInput): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!input.useContextInput && input.input === undefined) {
      errors.push('Input is required when not using context input');
    }

    if (input.indent && (input.indent < 0 || input.indent > 10)) {
      warnings.push('Indent should be between 0 and 10 for readability');
    }

    if (input.replacer && !Array.isArray(input.replacer)) {
      errors.push('Replacer must be an array of keys to include');
    }

    // Check for potential circular references in provided input
    if (input.input && typeof input.input === 'object') {
      try {
        JSON.stringify(input.input);
      } catch (error) {
        if (error.message.includes('circular')) {
          errors.push('Input contains circular references and cannot be stringified');
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
      title: 'JSON Stringify',
      description: 'Convert JavaScript object to JSON string',
      properties: {
        input: {
          type: 'object',
          title: 'Input Data',
          description: 'Object, array, or value to stringify'
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
          description: 'Field name in context containing data to stringify',
          default: 'data'
        },
        pretty: {
          type: 'boolean',
          title: 'Pretty Print',
          description: 'Format JSON with indentation',
          default: true
        },
        indent: {
          type: 'number',
          title: 'Indentation',
          description: 'Number of spaces for indentation',
          default: 2,
          minimum: 0,
          maximum: 10
        },
        replacer: {
          type: 'array',
          title: 'Keys to Include',
          description: 'Array of keys to include in output (whitelist)',
          items: {
            type: 'string'
          }
        },
        space: {
          type: 'string',
          title: 'Custom Spacing',
          description: 'Custom spacing string (e.g., "\\t" for tabs)'
        }
      },
      required: [],
      examples: [
        {
          input: { name: 'John', age: 30, city: 'NYC' },
          pretty: true,
          indent: 2
        },
        {
          useContextInput: true,
          contextInputField: 'httpResponse',
          pretty: false
        },
        {
          input: { name: 'John', age: 30, email: 'john@example.com', password: 'secret' },
          replacer: ['name', 'age', 'email'],
          pretty: true
        }
      ]
    };
  }

  getDisplayInfo(): TaskDisplayInfo {
    return {
      category: NODE_CATEGORIES.DATA_PROCESSING,
      label: 'JSON Stringify',
      icon: '📝',
      color: 'bg-blue-600',
      description: 'Convert objects to JSON strings for APIs and storage',
      tags: ['json', 'stringify', 'serialize', 'convert', 'api']
    };
  }
}
