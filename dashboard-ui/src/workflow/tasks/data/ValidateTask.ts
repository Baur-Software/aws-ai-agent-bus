import { WorkflowTask, WorkflowContext, TaskExecutionError, ValidationResult } from '../../types';

export interface ValidateTask_Input {
  data: any;
  schema: {
    type: string;
    required?: string[];
    properties?: Record<string, any>;
    items?: any;
    minLength?: number;
    maxLength?: number;
    minimum?: number;
    maximum?: number;
    pattern?: string;
  };
  strict?: boolean; // Fail on validation errors
}

export interface ValidateTask_Output {
  valid: boolean;
  errors: string[];
  warnings: string[];
  data: any;
  success: boolean;
  timestamp: string;
}

export class ValidateTask implements WorkflowTask<ValidateTask_Input, ValidateTask_Output> {
  readonly type = 'validate';

  constructor(private logger?: any) {}

  async execute(input: ValidateTask_Input, context: WorkflowContext): Promise<ValidateTask_Output> {
    const startTime = Date.now();

    try {
      const errors: string[] = [];
      const warnings: string[] = [];

      this.validateValue(input.data, input.schema, '', errors, warnings);

      const valid = errors.length === 0;

      if (!valid && input.strict) {
        throw new TaskExecutionError(`Validation failed: ${errors.join(', ')}`, this.type, context.nodeId || 'unknown');
      }

      const executionTime = Date.now() - startTime;
      this.logger?.info?.('Validation completed', {
        valid,
        errors: errors.length,
        warnings: warnings.length,
        executionTime
      });

      return {
        valid,
        errors,
        warnings,
        data: input.data,
        success: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger?.error?.('Validation failed', { error });

      if (error instanceof TaskExecutionError) {
        throw error;
      }

      throw new TaskExecutionError(`Validation failed: ${error instanceof Error ? error.message : String(error)}`, this.type, context.nodeId || 'unknown', error instanceof Error ? error : undefined
      );
    }
  }

  private validateValue(value: any, schema: any, path: string, errors: string[], warnings: string[]): void {
    const location = path || 'root';

    // Type validation
    if (schema.type) {
      const actualType = Array.isArray(value) ? 'array' : typeof value;
      if (actualType !== schema.type) {
        errors.push(`${location}: expected type '${schema.type}', got '${actualType}'`);
        return;
      }
    }

    // Object validation
    if (schema.type === 'object' && typeof value === 'object' && !Array.isArray(value)) {
      // Required fields
      if (schema.required && Array.isArray(schema.required)) {
        for (const field of schema.required) {
          if (!(field in value)) {
            errors.push(`${location}: missing required field '${field}'`);
          }
        }
      }

      // Property validation
      if (schema.properties) {
        for (const [key, propSchema] of Object.entries(schema.properties)) {
          if (key in value) {
            const propPath = path ? `${path}.${key}` : key;
            this.validateValue(value[key], propSchema, propPath, errors, warnings);
          }
        }
      }
    }

    // Array validation
    if (schema.type === 'array' && Array.isArray(value)) {
      if (schema.minLength !== undefined && value.length < schema.minLength) {
        errors.push(`${location}: array length ${value.length} is less than minimum ${schema.minLength}`);
      }
      if (schema.maxLength !== undefined && value.length > schema.maxLength) {
        errors.push(`${location}: array length ${value.length} exceeds maximum ${schema.maxLength}`);
      }

      // Validate array items
      if (schema.items) {
        value.forEach((item, index) => {
          const itemPath = `${path}[${index}]`;
          this.validateValue(item, schema.items, itemPath, errors, warnings);
        });
      }
    }

    // String validation
    if (schema.type === 'string' && typeof value === 'string') {
      if (schema.minLength !== undefined && value.length < schema.minLength) {
        errors.push(`${location}: string length ${value.length} is less than minimum ${schema.minLength}`);
      }
      if (schema.maxLength !== undefined && value.length > schema.maxLength) {
        errors.push(`${location}: string length ${value.length} exceeds maximum ${schema.maxLength}`);
      }
      if (schema.pattern) {
        const regex = new RegExp(schema.pattern);
        if (!regex.test(value)) {
          errors.push(`${location}: string does not match pattern ${schema.pattern}`);
        }
      }
    }

    // Number validation
    if (schema.type === 'number' && typeof value === 'number') {
      if (schema.minimum !== undefined && value < schema.minimum) {
        errors.push(`${location}: value ${value} is less than minimum ${schema.minimum}`);
      }
      if (schema.maximum !== undefined && value > schema.maximum) {
        errors.push(`${location}: value ${value} exceeds maximum ${schema.maximum}`);
      }
    }
  }

  validate(input: ValidateTask_Input): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (input.data === undefined) {
      errors.push('Data is required');
    }

    if (!input.schema) {
      errors.push('Schema is required');
    } else if (typeof input.schema !== 'object' || Array.isArray(input.schema)) {
      errors.push('Schema must be an object');
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  getSchema() {
    return {
      input: {
        type: 'object',
        required: ['data', 'schema'],
        properties: {
          data: {
            type: 'any',
            description: 'Data to validate'
          },
          schema: {
            type: 'object',
            description: 'JSON Schema-like validation schema',
            properties: {
              type: { type: 'string', enum: ['object', 'array', 'string', 'number', 'boolean'] },
              required: { type: 'array', items: { type: 'string' } },
              properties: { type: 'object' },
              items: { type: 'object' },
              minLength: { type: 'number' },
              maxLength: { type: 'number' },
              minimum: { type: 'number' },
              maximum: { type: 'number' },
              pattern: { type: 'string' }
            }
          },
          strict: {
            type: 'boolean',
            description: 'Fail task if validation errors occur',
            default: false
          }
        }
      },
      output: {
        type: 'object',
        properties: {
          valid: { type: 'boolean' },
          errors: { type: 'array', items: { type: 'string' } },
          warnings: { type: 'array', items: { type: 'string' } },
          data: { type: 'any' },
          success: { type: 'boolean' },
          timestamp: { type: 'string', format: 'date-time' }
        }
      }
    };
  }

  getDisplayInfo() {
    return {
      name: 'Validate',
      description: 'Validate data against JSON Schema',
      category: 'Data',
      icon: 'check-circle',
      color: '#2196F3',
      tags: ['data', 'validate', 'schema', 'verification', 'check']
    };
  }
}
