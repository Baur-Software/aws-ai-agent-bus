/**
 * Schema-Based Sample Data Generator
 * Generates realistic sample data from JSON Schema definitions
 */

export interface JSONSchema {
  type?: string;
  properties?: Record<string, JSONSchema>;
  items?: JSONSchema;
  required?: string[];
  enum?: any[];
  default?: any;
  description?: string;
  format?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
}

export class SampleDataGenerator {
  /**
   * Generate sample data from a JSON Schema
   */
  generateFromSchema(schema: JSONSchema, depth = 0): any {
    if (!schema || depth > 5) {
      return null; // Prevent infinite recursion
    }

    // Use default if provided
    if (schema.default !== undefined) {
      return schema.default;
    }

    // Use enum if provided
    if (schema.enum && schema.enum.length > 0) {
      return schema.enum[0];
    }

    switch (schema.type) {
      case 'object':
        return this.generateObject(schema, depth);
      case 'array':
        return this.generateArray(schema, depth);
      case 'string':
        return this.generateString(schema);
      case 'number':
      case 'integer':
        return this.generateNumber(schema);
      case 'boolean':
        return this.generateBoolean(schema);
      case 'null':
        return null;
      default:
        // If no type specified, try to infer from properties
        if (schema.properties) {
          return this.generateObject(schema, depth);
        }
        return null;
    }
  }

  private generateObject(schema: JSONSchema, depth: number): Record<string, any> {
    const obj: Record<string, any> = {};

    if (!schema.properties) {
      return { sample: true };
    }

    for (const [key, propSchema] of Object.entries(schema.properties)) {
      // Always include required fields
      const isRequired = schema.required?.includes(key);

      // Include required fields and 50% of optional fields
      if (isRequired || Math.random() > 0.5) {
        obj[key] = this.generateFromSchema(propSchema, depth + 1);
      }
    }

    return obj;
  }

  private generateArray(schema: JSONSchema, depth: number): any[] {
    if (!schema.items) {
      return [{ sample: true }];
    }

    // Generate 2-3 sample items
    const count = Math.floor(Math.random() * 2) + 2;
    const arr = [];

    for (let i = 0; i < count; i++) {
      arr.push(this.generateFromSchema(schema.items, depth + 1));
    }

    return arr;
  }

  private generateString(schema: JSONSchema): string {
    // Format-specific generation
    if (schema.format) {
      switch (schema.format) {
        case 'date':
          return '2025-09-30';
        case 'date-time':
          return new Date().toISOString();
        case 'time':
          return '10:30:00';
        case 'email':
          return 'sample@example.com';
        case 'uri':
        case 'url':
          return 'https://example.com/sample';
        case 'uuid':
          return 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
        case 'ipv4':
          return '192.168.1.1';
        case 'ipv6':
          return '2001:0db8:85a3:0000:0000:8a2e:0370:7334';
        default:
          break;
      }
    }

    // Pattern-based generation (simple cases)
    if (schema.pattern) {
      // Common patterns
      if (schema.pattern.includes('^[0-9]')) {
        return '12345';
      }
      if (schema.pattern.includes('[a-z]')) {
        return 'sample';
      }
    }

    // Description-based hints
    const desc = schema.description?.toLowerCase() || '';
    if (desc.includes('email')) return 'sample@example.com';
    if (desc.includes('url') || desc.includes('link')) return 'https://example.com';
    if (desc.includes('id')) return 'sample_123';
    if (desc.includes('name')) return 'Sample Name';
    if (desc.includes('phone')) return '+1-555-123-4567';
    if (desc.includes('address')) return '123 Sample St, Example City, EX 12345';
    if (desc.includes('zip') || desc.includes('postal')) return '12345';
    if (desc.includes('key')) return 'sample-key';
    if (desc.includes('token')) return 'sample_token_abc123';
    if (desc.includes('password')) return 'sample_password';
    if (desc.includes('code')) return 'ABC123';

    // Length constraints
    const minLength = schema.minLength || 5;
    const maxLength = Math.min(schema.maxLength || 20, 50);
    const length = Math.floor(Math.random() * (maxLength - minLength)) + minLength;

    // Generate random string
    return 'sample_' + Array.from({ length: length - 7 }, () =>
      'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]
    ).join('');
  }

  private generateNumber(schema: JSONSchema): number {
    const min = schema.minimum !== undefined ? schema.minimum : 0;
    const max = schema.maximum !== undefined ? schema.maximum : 1000;

    // Description-based hints
    const desc = schema.description?.toLowerCase() || '';
    if (desc.includes('count')) return Math.floor(Math.random() * 100);
    if (desc.includes('page')) return 1;
    if (desc.includes('limit')) return 10;
    if (desc.includes('offset')) return 0;
    if (desc.includes('id')) return Math.floor(Math.random() * 10000);
    if (desc.includes('price') || desc.includes('amount')) {
      return parseFloat((Math.random() * 1000).toFixed(2));
    }
    if (desc.includes('percent') || desc.includes('rate')) {
      return parseFloat((Math.random() * 100).toFixed(2));
    }

    // Generate random number in range
    const value = Math.random() * (max - min) + min;
    return schema.type === 'integer' ? Math.floor(value) : parseFloat(value.toFixed(2));
  }

  private generateBoolean(schema: JSONSchema): boolean {
    // Description-based hints for more realistic defaults
    const desc = schema.description?.toLowerCase() || '';
    if (desc.includes('active') || desc.includes('enabled')) return true;
    if (desc.includes('disabled') || desc.includes('deleted')) return false;

    // Random boolean
    return Math.random() > 0.5;
  }

  /**
   * Generate sample data from MCP tool output schema
   */
  generateFromMCPToolSchema(toolDefinition: any): any {
    if (toolDefinition.outputSchema) {
      return this.generateFromSchema(toolDefinition.outputSchema);
    }

    // Fallback if no output schema
    return {
      success: true,
      message: `Sample output for ${toolDefinition.name}`,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Generate sample input from MCP tool input schema
   * (for pre-filling form fields)
   */
  generateSampleInput(toolDefinition: any): Record<string, any> {
    if (toolDefinition.inputSchema?.properties) {
      return this.generateFromSchema(toolDefinition.inputSchema);
    }
    return {};
  }
}

// Singleton instance
export const sampleDataGenerator = new SampleDataGenerator();
