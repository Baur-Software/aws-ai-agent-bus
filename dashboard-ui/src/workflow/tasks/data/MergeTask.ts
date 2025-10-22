// Merge Task - Combine Multiple Data Sources
// Merge objects and arrays from different workflow steps

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

export interface MergeInput {
  sources: Array<{
    type: 'context' | 'inline';
    contextField?: string;
    data?: any;
  }>;
  strategy: 'shallow' | 'deep' | 'concat' | 'union';
  conflictResolution?: 'first' | 'last' | 'error';
  arrayHandling?: 'concat' | 'unique' | 'replace';
}

export interface MergeOutput {
  merged: any;
  sourceCount: number;
  mergeStrategy: string;
  conflicts: number;
  resultType: 'object' | 'array' | 'primitive';
  timestamp: string;
}

export class MergeTask implements WorkflowTask<MergeInput, MergeOutput> {
  readonly type = 'merge';

  constructor(private logger?: Logger) {}

  async execute(input: MergeInput, context: WorkflowContext): Promise<MergeOutput> {
    this.logger?.info(`Merging ${input.sources.length} sources with strategy: ${input.strategy}`);

    // Gather all source data
    const sourcesData: any[] = [];
    for (const source of input.sources) {
      if (source.type === 'context') {
        const field = source.contextField || 'data';
        const contextData = context.data[field];
        if (contextData === undefined) {
          throw new TaskExecutionError(
            `Context field '${field}' not found`,
            this.type,
            context.nodeId,
            input
          );
        }
        sourcesData.push(contextData);
      } else if (source.type === 'inline') {
        if (source.data === undefined) {
          throw new TaskExecutionError(
            'Inline source has no data',
            this.type,
            context.nodeId,
            input
          );
        }
        sourcesData.push(source.data);
      }
    }

    if (sourcesData.length === 0) {
      throw new TaskExecutionError(
        'No sources to merge',
        this.type,
        context.nodeId,
        input
      );
    }

    let merged: any;
    let conflicts = 0;

    try {
      // Apply merge strategy
      switch (input.strategy) {
        case 'shallow':
          merged = this.shallowMerge(sourcesData, input.conflictResolution || 'last');
          break;

        case 'deep':
          merged = this.deepMerge(sourcesData, input.conflictResolution || 'last');
          break;

        case 'concat':
          merged = this.concatMerge(sourcesData);
          break;

        case 'union':
          merged = this.unionMerge(sourcesData);
          break;

        default:
          throw new Error(`Unknown merge strategy: ${input.strategy}`);
      }

      const resultType = Array.isArray(merged) ? 'array' : typeof merged === 'object' ? 'object' : 'primitive';

      const output: MergeOutput = {
        merged,
        sourceCount: sourcesData.length,
        mergeStrategy: input.strategy,
        conflicts,
        resultType,
        timestamp: new Date().toISOString()
      };

      this.logger?.info(`Merge completed: ${resultType}, ${conflicts} conflicts`);

      // Store in context
      context.data.mergedData = merged;
      context.data.mergeSourceCount = sourcesData.length;

      return output;

    } catch (error) {
      this.logger?.error('Merge failed:', error);
      throw new TaskExecutionError(
        `Merge failed: ${error.message}`,
        this.type,
        context.nodeId,
        input
      );
    }
  }

  private shallowMerge(sources: any[], conflictResolution: string): any {
    if (sources.every(s => Array.isArray(s))) {
      // All arrays - concatenate
      return sources.flat();
    }

    if (sources.every(s => typeof s === 'object' && !Array.isArray(s))) {
      // All objects - merge keys
      const result: any = {};
      for (const source of sources) {
        for (const key in source) {
          if (key in result && conflictResolution === 'error') {
            throw new Error(`Conflict on key: ${key}`);
          }
          if (conflictResolution === 'first' && key in result) {
            continue;
          }
          result[key] = source[key];
        }
      }
      return result;
    }

    // Mixed types - return last
    return sources[sources.length - 1];
  }

  private deepMerge(sources: any[], conflictResolution: string): any {
    const isObject = (obj: any) => obj && typeof obj === 'object' && !Array.isArray(obj);

    const merge = (target: any, source: any): any => {
      if (!isObject(target) || !isObject(source)) {
        return source;
      }

      const result = { ...target };

      for (const key in source) {
        if (key in result) {
          if (isObject(result[key]) && isObject(source[key])) {
            result[key] = merge(result[key], source[key]);
          } else {
            if (conflictResolution === 'error') {
              throw new Error(`Conflict on key: ${key}`);
            }
            if (conflictResolution === 'last') {
              result[key] = source[key];
            }
            // 'first' keeps existing value
          }
        } else {
          result[key] = source[key];
        }
      }

      return result;
    };

    let result = sources[0];
    for (let i = 1; i < sources.length; i++) {
      result = merge(result, sources[i]);
    }

    return result;
  }

  private concatMerge(sources: any[]): any[] {
    const result: any[] = [];
    for (const source of sources) {
      if (Array.isArray(source)) {
        result.push(...source);
      } else {
        result.push(source);
      }
    }
    return result;
  }

  private unionMerge(sources: any[]): any[] {
    const seen = new Set();
    const result: any[] = [];

    for (const source of sources) {
      const items = Array.isArray(source) ? source : [source];
      for (const item of items) {
        const key = typeof item === 'object' ? JSON.stringify(item) : String(item);
        if (!seen.has(key)) {
          seen.add(key);
          result.push(item);
        }
      }
    }

    return result;
  }

  validate(input: MergeInput): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!input.sources || input.sources.length === 0) {
      errors.push('At least one source is required');
    }

    if (!input.strategy) {
      errors.push('Merge strategy is required');
    }

    if (!['shallow', 'deep', 'concat', 'union'].includes(input.strategy)) {
      errors.push('Invalid merge strategy. Must be: shallow, deep, concat, or union');
    }

    input.sources?.forEach((source, index) => {
      if (!source.type) {
        errors.push(`Source ${index + 1}: type is required (context or inline)`);
      }
      if (source.type === 'context' && !source.contextField) {
        warnings.push(`Source ${index + 1}: no contextField specified, will use "data"`);
      }
      if (source.type === 'inline' && source.data === undefined) {
        errors.push(`Source ${index + 1}: inline source requires data`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  getSchema(): TaskConfigSchema {
    return {
      type: 'object',
      title: 'Merge Data',
      description: 'Combine multiple data sources into one',
      properties: {
        sources: {
          type: 'array',
          title: 'Data Sources',
          description: 'Sources to merge',
          items: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                title: 'Source Type',
                enum: ['context', 'inline'],
                description: 'Where to get data from'
              },
              contextField: {
                type: 'string',
                title: 'Context Field',
                description: 'Field name in workflow context'
              },
              data: {
                type: 'object',
                title: 'Inline Data',
                description: 'Data to merge (for inline type)'
              }
            }
          },
          minItems: 1
        },
        strategy: {
          type: 'string',
          title: 'Merge Strategy',
          description: 'How to combine sources',
          enum: ['shallow', 'deep', 'concat', 'union'],
          default: 'shallow'
        },
        conflictResolution: {
          type: 'string',
          title: 'Conflict Resolution',
          description: 'How to handle key conflicts',
          enum: ['first', 'last', 'error'],
          default: 'last'
        },
        arrayHandling: {
          type: 'string',
          title: 'Array Handling',
          description: 'How to merge arrays',
          enum: ['concat', 'unique', 'replace'],
          default: 'concat'
        }
      },
      required: ['sources', 'strategy'],
      examples: [
        {
          sources: [
            { type: 'context', contextField: 'userData' },
            { type: 'context', contextField: 'userPreferences' }
          ],
          strategy: 'deep',
          conflictResolution: 'last'
        },
        {
          sources: [
            { type: 'context', contextField: 'list1' },
            { type: 'context', contextField: 'list2' }
          ],
          strategy: 'union'
        }
      ]
    };
  }

  getDisplayInfo(): TaskDisplayInfo {
    return {
      category: NODE_CATEGORIES.DATA_PROCESSING,
      label: 'Merge Data',
      icon: '🔗',
      color: 'bg-cyan-500',
      description: 'Combine multiple data sources with flexible strategies',
      tags: ['merge', 'combine', 'join', 'union', 'data']
    };
  }
}
