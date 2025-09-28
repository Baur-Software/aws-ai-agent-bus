// JSON Parse Task - Parse JSON strings
import { WorkflowTask, WorkflowContext, Logger, TaskExecutionError, NODE_CATEGORIES } from '../../types';

export interface JSONParseInput {
  jsonString?: string;
  useContextData?: boolean;
  contextKey?: string;
  cleanupMode?: boolean;
}

export interface JSONParseOutput {
  parsed: any;
  success: boolean;
  originalString?: string;
  timestamp: string;
}

export class JSONParseTask implements WorkflowTask<JSONParseInput, JSONParseOutput> {
  readonly type = 'json-parse';

  constructor(private logger?: Logger) {}

  getDisplayInfo() {
    return {
      category: NODE_CATEGORIES.DATA,
      label: 'JSON Parse',
      icon: 'Code',
      color: 'bg-orange-600',
      description: 'Parse JSON string into object',
      tags: ['json', 'parse', 'data', 'transform']
    };
  }

  getSchema() {
    return {
      title: 'Parse JSON String',
      properties: {
        jsonString: { type: 'string', description: 'JSON string to parse' },
        useContextData: { type: 'boolean', description: 'Use data from workflow context' },
        contextKey: { type: 'string', description: 'Key to read from context data' },
        cleanupMode: { type: 'boolean', description: 'Attempt to clean malformed JSON' }
      },
      required: []
    };
  }

  validate(input: any) {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    if (!input.useContextData && !input.jsonString?.trim()) {
      errors.push('JSON string is required when not using context data');
    }
    
    if (input.useContextData && !input.contextKey) {
      warnings.push('No context key specified, will use "previousResult"');
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  async execute(input: JSONParseInput, context: WorkflowContext): Promise<JSONParseOutput> {
    this.logger?.info('Parsing JSON data');

    let jsonString: string;
    
    if (input.useContextData) {
      const contextKey = input.contextKey || 'previousResult';
      const contextValue = context.data[contextKey];
      
      if (contextValue === undefined) {
        throw new TaskExecutionError(
          `Context data key '${contextKey}' not found`,
          this.type,
          context.nodeId,
          input
        );
      }
      
      jsonString = typeof contextValue === 'string' ? contextValue : JSON.stringify(contextValue);
    } else {
      jsonString = input.jsonString!;
    }

    try {
      let parsed;
      
      if (input.cleanupMode && typeof jsonString === 'string') {
        // Attempt basic cleanup
        let cleanedString = jsonString.trim();
        if (!cleanedString.startsWith('{') && !cleanedString.startsWith('[')) {
          throw new Error('Not valid JSON format');
        }
        parsed = JSON.parse(cleanedString);
      } else {
        parsed = JSON.parse(jsonString);
      }

      context.data.parsedJSON = parsed;
      context.data.originalJSONString = jsonString;

      this.logger?.info('Successfully parsed JSON');

      return {
        parsed,
        success: true,
        originalString: jsonString,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger?.error('Failed to parse JSON:', error);
      throw new TaskExecutionError(
        `JSON parse failed: ${error.message}`,
        this.type,
        context.nodeId,
        input
      );
    }
  }
}