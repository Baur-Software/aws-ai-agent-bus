import { WorkflowTask, WorkflowContext } from '../../types/workflow';
import { TaskExecutionError } from '../../errors/TaskExecutionError';

export interface EventsCreateAlertInput {
  name: string;
  ruleId: string;
  notificationMethod: 'sns' | 'email';
  snsTopicArn?: string;
  emailAddress?: string;
  enabled?: boolean;
}

export interface EventsCreateAlertOutput {
  subscriptionId: string;
  name: string;
  ruleId: string;
  notificationMethod: string;
  target: string;
  enabled: boolean;
  success: boolean;
  timestamp: string;
}

export class EventsCreateAlertTask implements WorkflowTask<EventsCreateAlertInput, EventsCreateAlertOutput> {
  readonly type = 'events-create-alert';

  constructor(
    private eventsService: any,
    private logger?: any
  ) {}

  async execute(input: EventsCreateAlertInput, context: WorkflowContext): Promise<EventsCreateAlertOutput> {
    const startTime = Date.now();

    try {
      const request: any = {
        name: input.name,
        ruleId: input.ruleId,
        notificationMethod: input.notificationMethod,
        enabled: input.enabled !== undefined ? input.enabled : true
      };

      if (input.notificationMethod === 'sns') {
        if (!input.snsTopicArn) {
          throw new TaskExecutionError(this.type, context.nodeId || 'unknown', 'snsTopicArn required for SNS');
        }
        request.snsTopicArn = input.snsTopicArn;
      } else if (input.notificationMethod === 'email') {
        if (!input.emailAddress) {
          throw new TaskExecutionError(this.type, context.nodeId || 'unknown', 'emailAddress required for email');
        }
        request.emailAddress = input.emailAddress;
      }

      const result = await this.eventsService.createAlert(request);

      const target = input.notificationMethod === 'sns' ? input.snsTopicArn! : input.emailAddress!;

      const executionTime = Date.now() - startTime;
      this.logger?.info?.('Event alert created', { subscriptionId: result.subscriptionId, executionTime });

      return {
        subscriptionId: result.subscriptionId,
        name: input.name,
        ruleId: input.ruleId,
        notificationMethod: input.notificationMethod,
        target,
        enabled: request.enabled,
        success: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger?.error?.('Failed to create alert', { error });

      if (error instanceof TaskExecutionError) throw error;

      throw new TaskExecutionError(
        this.type,
        context.nodeId || 'unknown',
        `Failed to create alert: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  async validate(input: EventsCreateAlertInput): Promise<{ valid: boolean; errors: string[]; warnings: string[] }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!input.name) errors.push('Alert name is required');
    if (!input.ruleId) errors.push('Rule ID is required');
    if (!input.notificationMethod) errors.push('Notification method is required');

    if (input.notificationMethod === 'sns' && !input.snsTopicArn) {
      errors.push('SNS topic ARN required for SNS method');
    }

    if (input.notificationMethod === 'email' && !input.emailAddress) {
      errors.push('Email address required for email method');
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  getSchema() {
    return {
      input: {
        type: 'object',
        required: ['name', 'ruleId', 'notificationMethod'],
        properties: {
          name: { type: 'string', description: 'Alert subscription name' },
          ruleId: { type: 'string', description: 'Event rule ID' },
          notificationMethod: { type: 'string', enum: ['sns', 'email'] },
          snsTopicArn: { type: 'string', description: 'SNS topic ARN (if sns)' },
          emailAddress: { type: 'string', description: 'Email address (if email)' },
          enabled: { type: 'boolean', default: true }
        }
      },
      output: {
        type: 'object',
        properties: {
          subscriptionId: { type: 'string' },
          name: { type: 'string' },
          ruleId: { type: 'string' },
          notificationMethod: { type: 'string' },
          target: { type: 'string' },
          enabled: { type: 'boolean' },
          success: { type: 'boolean' },
          timestamp: { type: 'string', format: 'date-time' }
        }
      }
    };
  }

  getDisplayInfo() {
    return {
      name: 'Create Event Alert',
      description: 'Create an alert subscription for an event rule',
      category: 'Events',
      icon: 'bell',
      color: '#9C27B0',
      tags: ['events', 'alerts', 'notifications', 'sns', 'email']
    };
  }
}
