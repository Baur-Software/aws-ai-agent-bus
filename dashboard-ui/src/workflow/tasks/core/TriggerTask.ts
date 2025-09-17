// Trigger Task Implementation
// Starts workflow execution - replaces the trigger case in the old switch statement

import {
  WorkflowTask,
  WorkflowContext,
  ValidationResult,
  TaskConfigSchema,
  TaskDisplayInfo,
  Logger,
  NODE_CATEGORIES
} from '../../types';

export interface TriggerInput {
  name?: string;
  description?: string;
  immediate?: boolean;
  data?: any;
}

export interface TriggerOutput {
  status: 'triggered';
  timestamp: string;
  name: string;
  description?: string;
  data?: any;
  executionId: string;
}

export class TriggerTask implements WorkflowTask<TriggerInput, TriggerOutput> {
  readonly type = 'trigger';
  
  constructor(private logger?: Logger) {}

  async execute(input: TriggerInput, context: WorkflowContext): Promise<TriggerOutput> {
    const timestamp = new Date().toISOString();
    const name = input.name || 'Workflow Trigger';
    
    this.logger?.info(`Triggering workflow: ${name}`);
    
    const result: TriggerOutput = {
      status: 'triggered',
      timestamp,
      name,
      description: input.description,
      data: input.data,
      executionId: context.executionId
    };

    // Store trigger data in context for downstream tasks
    context.data.triggerData = input.data;
    context.data.triggerTimestamp = timestamp;
    
    // Emit trigger event
    context.emit('trigger.activated', {
      name,
      timestamp,
      data: input.data
    });

    this.logger?.info(`Workflow triggered successfully: ${name} at ${timestamp}`);
    
    return result;
  }

  validate(input: TriggerInput): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Name validation
    if (input.name && input.name.length > 100) {
      errors.push('Trigger name must be 100 characters or less');
    }

    // Description validation
    if (input.description && input.description.length > 500) {
      warnings.push('Trigger description is quite long (>500 characters)');
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
      title: 'Workflow Trigger',
      description: 'Starts the workflow execution with optional initial data',
      properties: {
        name: {
          type: 'string',
          title: 'Trigger Name',
          description: 'Human-readable name for this trigger',
          default: 'Workflow Trigger'
        },
        description: {
          type: 'string',
          title: 'Description',
          description: 'Optional description of what this trigger does'
        },
        immediate: {
          type: 'boolean',
          title: 'Execute Immediately',
          description: 'Whether to start execution immediately',
          default: true
        },
        data: {
          type: 'object',
          title: 'Initial Data',
          description: 'Optional data to pass to downstream tasks'
        }
      },
      required: [],
      examples: [
        {
          name: 'Daily Analytics Report',
          description: 'Generates daily analytics reports',
          immediate: true,
          data: {
            reportType: 'daily',
            includeCharts: true
          }
        }
      ]
    };
  }

  getDisplayInfo(): TaskDisplayInfo {
    return {
      category: NODE_CATEGORIES.INPUT_OUTPUT,
      label: 'Trigger',
      icon: 'Play',
      color: 'bg-green-500',
      description: 'Start workflow execution',
      tags: ['trigger', 'start', 'workflow', 'control']
    };
  }
}