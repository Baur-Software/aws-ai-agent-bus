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
  includeResults?: boolean;
  includeMetadata?: boolean;
  includeErrors?: boolean;
  customFields?: string[];
  summaryTemplate?: string;
}

export interface OutputOutput {
  output: any;
  format: string;
  summary: string;
  metadata: {
    executionId: string;
    workflowId: string;
    completedAt: string;
    nodesExecuted: number;
    totalDuration: number;
  };
  results?: Record<string, any>;
  errors?: any[];
}

export class OutputTask implements WorkflowTask<OutputInput, OutputOutput> {
  readonly type = 'output';

  constructor(
    private logger?: Logger
  ) {}

  async execute(input: OutputInput, context: WorkflowContext): Promise<OutputOutput> {
    this.logger?.info('Generating workflow output');

    try {
      const format = input.format || 'summary';
      
      // Collect all results from context
      const allResults = context.results || {};
      const nodeCount = Object.keys(allResults).length;

      // Generate different output formats
      let output: any;
      let summary: string;

      switch (format) {
        case 'json':
          output = this.generateJSONOutput(allResults, context, input);
          summary = `JSON output with ${nodeCount} node results`;
          break;

        case 'detailed':
          output = this.generateDetailedOutput(allResults, context, input);
          summary = `Detailed workflow report with ${nodeCount} executed nodes`;
          break;

        case 'custom':
          output = this.generateCustomOutput(allResults, context, input);
          summary = `Custom formatted output with ${input.customFields?.length || 0} fields`;
          break;

        case 'summary':
        default:
          output = this.generateSummaryOutput(allResults, context, input);
          summary = `Workflow completed with ${nodeCount} steps`;
          break;
      }

      const metadata = {
        executionId: context.executionId,
        workflowId: context.workflowId,
        completedAt: new Date().toISOString(),
        nodesExecuted: nodeCount,
        totalDuration: this.calculateTotalDuration(context)
      };

      const result: OutputOutput = {
        output,
        format,
        summary: input.summaryTemplate 
          ? this.applyTemplate(input.summaryTemplate, { output, metadata, context })
          : summary,
        metadata,
        ...(input.includeResults && { results: allResults }),
        ...(input.includeErrors && context.errors?.length && { errors: context.errors })
      };

      this.logger?.info(`Generated ${format} output with ${nodeCount} results`);

      return result;

    } catch (error) {
      this.logger?.error('Failed to generate output:', error);
      
      // Return error output instead of throwing
      return {
        output: { error: error.message, success: false },
        format: 'error',
        summary: `Workflow output generation failed: ${error.message}`,
        metadata: {
          executionId: context.executionId,
          workflowId: context.workflowId,
          completedAt: new Date().toISOString(),
          nodesExecuted: Object.keys(context.results || {}).length,
          totalDuration: 0
        }
      };
    }
  }

  validate(input: OutputInput): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (input.format && !['json', 'summary', 'detailed', 'custom'].includes(input.format)) {
      errors.push('Format must be one of: json, summary, detailed, custom');
    }

    if (input.format === 'custom' && (!input.customFields || input.customFields.length === 0)) {
      warnings.push('Custom format specified but no custom fields provided');
    }

    if (input.customFields && input.customFields.length > 50) {
      warnings.push('Large number of custom fields may impact performance');
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
      title: 'Workflow Output',
      description: 'Collect and format final workflow results',
      properties: {
        format: {
          type: 'string',
          title: 'Output Format',
          description: 'How to format the final output',
          enum: ['json', 'summary', 'detailed', 'custom'],
          default: 'summary'
        },
        includeResults: {
          type: 'boolean',
          title: 'Include All Results',
          description: 'Include results from all workflow nodes',
          default: true
        },
        includeMetadata: {
          type: 'boolean',
          title: 'Include Metadata',
          description: 'Include execution metadata',
          default: true
        },
        includeErrors: {
          type: 'boolean',
          title: 'Include Errors',
          description: 'Include any errors that occurred',
          default: false
        },
        customFields: {
          type: 'array',
          title: 'Custom Fields',
          description: 'Specific fields to include in custom format',
          items: {
            type: 'string',
            title: 'Field Name',
            description: 'Custom field name'
          }
        },
        summaryTemplate: {
          type: 'string',
          title: 'Summary Template',
          description: 'Custom template for summary text (supports {{variable}} syntax)'
        }
      },
      required: [],
      examples: [
        {
          format: 'detailed',
          includeResults: true,
          includeMetadata: true
        },
        {
          format: 'custom',
          customFields: ['analyticsData', 'reportUrl', 'summary'],
          summaryTemplate: 'Workflow {{workflowId}} completed with {{nodesExecuted}} steps'
        }
      ]
    };
  }

  getDisplayInfo(): TaskDisplayInfo {
    return {
      category: NODE_CATEGORIES.INPUT_OUTPUT,
      label: 'Output',
      icon: 'FileOutput',
      color: 'bg-gray-600',
      description: 'Collect and format workflow results',
      tags: ['output', 'results', 'formatting', 'final']
    };
  }

  private generateJSONOutput(results: Record<string, any>, context: WorkflowContext, input: OutputInput): any {
    return {
      success: true,
      executionId: context.executionId,
      workflowId: context.workflowId,
      results: input.includeResults !== false ? results : Object.keys(results),
      timestamp: new Date().toISOString(),
      nodeCount: Object.keys(results).length
    };
  }

  private generateSummaryOutput(results: Record<string, any>, context: WorkflowContext, input: OutputInput): any {
    const nodeCount = Object.keys(results).length;
    const hasErrors = context.errors && context.errors.length > 0;
    
    return {
      success: !hasErrors,
      summary: `Workflow executed ${nodeCount} nodes successfully`,
      executionId: context.executionId,
      completedAt: new Date().toISOString(),
      keyResults: this.extractKeyResults(results),
      ...(hasErrors && input.includeErrors && { errors: context.errors.length })
    };
  }

  private generateDetailedOutput(results: Record<string, any>, context: WorkflowContext, input: OutputInput): any {
    return {
      execution: {
        id: context.executionId,
        workflowId: context.workflowId,
        startedAt: this.estimateStartTime(context),
        completedAt: new Date().toISOString(),
        duration: this.calculateTotalDuration(context)
      },
      statistics: {
        totalNodes: Object.keys(results).length,
        successfulNodes: Object.keys(results).length - (context.errors?.length || 0),
        failedNodes: context.errors?.length || 0,
        dataTransferred: this.calculateDataSize(results)
      },
      results: input.includeResults !== false ? results : undefined,
      errors: input.includeErrors ? context.errors : undefined,
      performance: {
        averageNodeDuration: this.calculateAverageNodeDuration(context),
        bottlenecks: this.identifyBottlenecks(results),
        recommendations: this.generateRecommendations(results, context)
      }
    };
  }

  private generateCustomOutput(results: Record<string, any>, context: WorkflowContext, input: OutputInput): any {
    const customOutput: any = {};
    
    if (input.customFields && input.customFields.length > 0) {
      for (const field of input.customFields) {
        // Try to find the field in results, context data, or generate it
        if (results[field] !== undefined) {
          customOutput[field] = results[field];
        } else if (context.data[field] !== undefined) {
          customOutput[field] = context.data[field];
        } else {
          // Generate computed fields
          switch (field) {
            case 'nodeCount':
              customOutput[field] = Object.keys(results).length;
              break;
            case 'executionTime':
              customOutput[field] = this.calculateTotalDuration(context);
              break;
            case 'success':
              customOutput[field] = !context.errors || context.errors.length === 0;
              break;
            default:
              customOutput[field] = null;
          }
        }
      }
    }

    return customOutput;
  }

  private extractKeyResults(results: Record<string, any>): any {
    // Extract the most important results for summary
    const keyResults: any = {};
    
    // Look for common result patterns
    Object.entries(results).forEach(([nodeId, result]) => {
      if (result && typeof result === 'object') {
        // Extract key metrics
        if (result.count !== undefined) keyResults[`${nodeId}_count`] = result.count;
        if (result.total !== undefined) keyResults[`${nodeId}_total`] = result.total;
        if (result.success !== undefined) keyResults[`${nodeId}_success`] = result.success;
        if (result.url !== undefined) keyResults[`${nodeId}_url`] = result.url;
        if (result.id !== undefined) keyResults[`${nodeId}_id`] = result.id;
      }
    });

    return keyResults;
  }

  private calculateTotalDuration(context: WorkflowContext): number {
    // This would be calculated by the workflow engine
    // For now, return a placeholder
    return Date.now() - (context.data.startTime || Date.now());
  }

  private estimateStartTime(context: WorkflowContext): string {
    // Estimate start time based on execution duration
    const duration = this.calculateTotalDuration(context);
    return new Date(Date.now() - duration).toISOString();
  }

  private calculateDataSize(results: Record<string, any>): number {
    try {
      return JSON.stringify(results).length;
    } catch {
      return 0;
    }
  }

  private calculateAverageNodeDuration(context: WorkflowContext): number {
    const nodeCount = Object.keys(context.results || {}).length;
    if (nodeCount === 0) return 0;
    return this.calculateTotalDuration(context) / nodeCount;
  }

  private identifyBottlenecks(results: Record<string, any>): string[] {
    // Identify potential performance bottlenecks
    const bottlenecks: string[] = [];
    
    Object.entries(results).forEach(([nodeId, result]) => {
      if (result && typeof result === 'object') {
        if (result.duration > 5000) {
          bottlenecks.push(`${nodeId}: Slow execution (${result.duration}ms)`);
        }
        if (result.size > 1000000) {
          bottlenecks.push(`${nodeId}: Large data size (${result.size} bytes)`);
        }
      }
    });

    return bottlenecks;
  }

  private generateRecommendations(results: Record<string, any>, context: WorkflowContext): string[] {
    const recommendations: string[] = [];
    
    const nodeCount = Object.keys(results).length;
    if (nodeCount > 20) {
      recommendations.push('Consider breaking large workflows into smaller, focused workflows');
    }

    if (context.errors && context.errors.length > 0) {
      recommendations.push('Review and fix error handling for failed nodes');
    }

    const dataSize = this.calculateDataSize(results);
    if (dataSize > 5000000) { // 5MB
      recommendations.push('Consider using artifact storage for large data sets');
    }

    return recommendations;
  }

  private applyTemplate(template: string, data: any): string {
    let result = template;
    
    // Simple template replacement
    result = result.replace(/\{\{workflowId\}\}/g, data.context.workflowId || 'unknown');
    result = result.replace(/\{\{executionId\}\}/g, data.context.executionId || 'unknown');
    result = result.replace(/\{\{nodesExecuted\}\}/g, data.metadata.nodesExecuted.toString());
    result = result.replace(/\{\{duration\}\}/g, data.metadata.totalDuration.toString());
    
    return result;
  }
}