// MCP Events Send Task
// Sends events to the MCP event system (EventBridge)

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

import { MCPService } from '../../../services';

export interface EventsSendInput {
  detailType: string;
  detail: any;
  source?: string;
  useContextData?: boolean;
  contextKey?: string;
  includeMetadata?: boolean;
}

export interface EventsSendOutput {
  eventId: string;
  detailType: string;
  source: string;
  success: boolean;
  timestamp: string;
  eventSize: number;
}

export class EventsSendTask implements WorkflowTask<EventsSendInput, EventsSendOutput> {
  readonly type = 'events-send';

  constructor(
    private mcpService: MCPService,
    private logger?: Logger
  ) {}

  async execute(input: EventsSendInput, context: WorkflowContext): Promise<EventsSendOutput> {
    const source = input.source || 'workflow-engine';
    this.logger?.info(`Sending event: ${input.detailType} from ${source}`);

    try {
      // Determine event detail payload
      let detail = input.detail;
      
      if (input.useContextData) {
        const contextKey = input.contextKey || 'previousResult';
        const contextData = context.data[contextKey];
        
        if (contextData === undefined) {
          throw new Error(`Context data key '${contextKey}' not found`);
        }

        detail = contextData;
      }

      // Include workflow metadata if requested
      if (input.includeMetadata) {
        detail = {
          ...detail,
          _workflow: {
            executionId: context.executionId,
            workflowId: context.workflowId,
            nodeId: context.nodeId,
            timestamp: new Date().toISOString()
          }
        };
      }

      // Send the event
      await this.mcpService.eventsSend({
        detailType: input.detailType,
        detail: detail,
        source: source
      });

      const eventSize = JSON.stringify(detail).length;
      const eventId = `${context.executionId}-${context.nodeId}-${Date.now()}`;

      const output: EventsSendOutput = {
        eventId,
        detailType: input.detailType,
        source,
        success: true,
        timestamp: new Date().toISOString(),
        eventSize
      };

      this.logger?.info(`Successfully sent event: ${input.detailType} (${eventSize} bytes)`);

      // Store in context for downstream tasks
      context.data.eventId = eventId;
      context.data.eventSize = eventSize;
      context.data.eventDetail = detail;

      return output;

    } catch (error) {
      this.logger?.error('Failed to send event:', error);
      throw new TaskExecutionError(
        `MCP events send failed: ${error.message}`,
        this.type,
        context.nodeId,
        input
      );
    }
  }

  validate(input: EventsSendInput): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!input.detailType || input.detailType.trim().length === 0) {
      errors.push('Detail type is required');
    }

    if (input.detailType && input.detailType.length > 128) {
      errors.push('Detail type cannot exceed 128 characters');
    }

    if (!input.useContextData && (input.detail === undefined || input.detail === null)) {
      errors.push('Detail is required when not using context data');
    }

    if (input.useContextData && !input.contextKey) {
      warnings.push('No context key specified, will use "previousResult"');
    }

    if (input.source && input.source.length > 256) {
      errors.push('Source cannot exceed 256 characters');
    }

    // Check detail size (EventBridge has a 256KB limit)
    if (input.detail && !input.useContextData) {
      try {
        const detailSize = JSON.stringify(input.detail).length;
        if (detailSize > 250000) { // 250KB to leave room for metadata
          warnings.push('Event detail is very large and may exceed EventBridge limits');
        }
      } catch (e) {
        warnings.push('Event detail could not be serialized to JSON');
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
      title: 'Send Event',
      description: 'Send events to the MCP event system (EventBridge)',
      properties: {
        detailType: {
          type: 'string',
          title: 'Event Type',
          description: 'Type of event being sent (e.g., "WorkflowCompleted", "DataProcessed")'
        },
        detail: {
          type: 'object',
          title: 'Event Detail',
          description: 'Event payload data (not used if useContextData is true)'
        },
        source: {
          type: 'string',
          title: 'Event Source',
          description: 'Source identifier for the event',
          default: 'workflow-engine'
        },
        useContextData: {
          type: 'boolean',
          title: 'Use Context Data',
          description: 'Use data from workflow context instead of detail field',
          default: false
        },
        contextKey: {
          type: 'string',
          title: 'Context Data Key',
          description: 'Key to use from context data (defaults to "previousResult")',
          default: 'previousResult'
        },
        includeMetadata: {
          type: 'boolean',
          title: 'Include Workflow Metadata',
          description: 'Include workflow execution metadata in the event',
          default: true
        }
      },
      required: ['detailType'],
      examples: [
        {
          detailType: 'WorkflowCompleted',
          useContextData: true,
          contextKey: 'workflowResults',
          includeMetadata: true
        },
        {
          detailType: 'CustomNotification',
          detail: {
            message: 'Task completed successfully',
            priority: 'high'
          },
          source: 'task-manager'
        }
      ]
    };
  }

  getDisplayInfo(): TaskDisplayInfo {
    return {
      category: NODE_CATEGORIES.MCP_TOOLS,
      label: 'Send Event',
      icon: 'Zap',
      color: 'bg-blue-600',
      description: 'Send events to the event system',
      tags: ['mcp', 'events', 'eventbridge', 'notification', 'publish']
    };
  }
}