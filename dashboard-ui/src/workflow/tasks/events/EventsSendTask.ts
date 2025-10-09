// Events Send Task - Publish Events to EventBridge
// Enable event-driven architecture by publishing events to the event bus

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

export interface EventsSendInput {
  detailType: string;
  detail: any;
  source?: string;
  useContextDetail?: boolean;
  contextDetailField?: string;
  resources?: string[];
  metadata?: Record<string, any>;
}

export interface EventsSendOutput {
  eventId: string;
  published: boolean;
  detailType: string;
  source: string;
  timestamp: string;
  detail: any;
  deliveryStatus?: 'sent' | 'pending' | 'failed';
}

export class EventsSendTask implements WorkflowTask<EventsSendInput, EventsSendOutput> {
  readonly type = 'events-send';

  constructor(
    private eventsService: {
      send: (detailType: string, detail: any) => Promise<{ eventId?: string; success: boolean }>;
    },
    private logger?: Logger
  ) {}

  async execute(input: EventsSendInput, context: WorkflowContext): Promise<EventsSendOutput> {
    // Get event detail
    let detail = input.detail;
    if (input.useContextDetail) {
      const contextField = input.contextDetailField || 'eventData';
      const contextDetail = context.data[contextField];
      if (contextDetail === undefined) {
        throw new TaskExecutionError(
          `Context field '${contextField}' not found`,
          this.type,
          context.nodeId,
          input
        );
      }
      detail = contextDetail;
    }

    // Ensure detail is an object
    if (typeof detail !== 'object' || detail === null) {
      throw new TaskExecutionError(
        'Event detail must be an object',
        this.type,
        context.nodeId,
        input
      );
    }

    const source = input.source || 'workflow-engine';

    this.logger?.info(`Publishing event: ${input.detailType} from ${source}`);

    try {
      // Add workflow context metadata if provided
      let enrichedDetail = { ...detail };
      if (input.metadata) {
        enrichedDetail = {
          ...enrichedDetail,
          _metadata: {
            workflowId: context.workflowId,
            executionId: context.executionId,
            nodeId: context.nodeId,
            ...input.metadata
          }
        };
      }

      // Send event via MCP tool
      const result = await this.eventsService.send(input.detailType, enrichedDetail);

      const output: EventsSendOutput = {
        eventId: result.eventId || `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        published: result.success,
        detailType: input.detailType,
        source,
        timestamp: new Date().toISOString(),
        detail: enrichedDetail,
        deliveryStatus: result.success ? 'sent' : 'failed'
      };

      this.logger?.info(`Event published: ${output.eventId} (${input.detailType})`);

      // Store event info in context for downstream nodes
      context.data.lastEventId = output.eventId;
      context.data.lastEventType = input.detailType;
      context.data.lastEventPublished = output.published;

      return output;

    } catch (error) {
      this.logger?.error('Event publish failed:', error);
      throw new TaskExecutionError(
        `Failed to publish event: ${error.message}`,
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

    if (!input.useContextDetail && (input.detail === undefined || input.detail === null)) {
      errors.push('Event detail is required when not using context detail');
    }

    // Validate detail type naming convention
    if (input.detailType && !input.detailType.match(/^[a-zA-Z0-9._-]+$/)) {
      warnings.push('Detail type should only contain alphanumeric characters, dots, hyphens, and underscores');
    }

    // Check for recommended naming convention
    if (input.detailType && !input.detailType.includes('.')) {
      warnings.push('Detail type should follow convention: namespace.action (e.g., user.signup, order.created)');
    }

    // Validate detail is serializable
    if (input.detail && typeof input.detail === 'object') {
      try {
        JSON.stringify(input.detail);
      } catch (error) {
        errors.push('Event detail must be JSON serializable (no circular references or functions)');
      }
    }

    // Validate source if provided
    if (input.source && input.source.length > 256) {
      warnings.push('Source identifier is very long (>256 chars), consider shortening');
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
      description: 'Publish event to EventBridge for event-driven workflows',
      properties: {
        detailType: {
          type: 'string',
          title: 'Event Type',
          description: 'Event detail-type (e.g., user.signup, order.created)',
          pattern: '^[a-zA-Z0-9._-]+$'
        },
        detail: {
          type: 'object',
          title: 'Event Data',
          description: 'Event payload as JSON object'
        },
        source: {
          type: 'string',
          title: 'Event Source',
          description: 'Source identifier for the event',
          default: 'workflow-engine'
        },
        useContextDetail: {
          type: 'boolean',
          title: 'Use Detail from Context',
          description: 'Get event data from workflow context',
          default: false
        },
        contextDetailField: {
          type: 'string',
          title: 'Context Detail Field',
          description: 'Field name in context containing event data',
          default: 'eventData'
        },
        resources: {
          type: 'array',
          title: 'Resource ARNs',
          description: 'AWS resource ARNs related to this event',
          items: {
            type: 'string'
          }
        },
        metadata: {
          type: 'object',
          title: 'Additional Metadata',
          description: 'Extra metadata to include in event'
        }
      },
      required: ['detailType'],
      examples: [
        {
          detailType: 'user.signup',
          detail: {
            userId: '12345',
            email: 'user@example.com',
            plan: 'premium'
          },
          source: 'user-service'
        },
        {
          detailType: 'order.created',
          useContextDetail: true,
          contextDetailField: 'orderData',
          metadata: {
            priority: 'high'
          }
        },
        {
          detailType: 'workflow.completed',
          detail: {
            workflowName: 'data-processing',
            status: 'success',
            duration: 1234
          }
        }
      ]
    };
  }

  getDisplayInfo(): TaskDisplayInfo {
    return {
      category: NODE_CATEGORIES.INTEGRATION,
      label: 'Send Event',
      icon: '📡',
      color: 'bg-red-500',
      description: 'Publish events to EventBridge for event-driven workflows',
      tags: ['events', 'eventbridge', 'publish', 'async', 'event-driven']
    };
  }
}
