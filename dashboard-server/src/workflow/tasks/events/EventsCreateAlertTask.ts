import { WorkflowTask, WorkflowContext } from '../../types/workflow.js';
import { TaskExecutionError } from '../../errors/TaskExecutionError.js';

export interface EventsCreateAlertInput {
  name: string;
  ruleId: string;
  notificationMethod: 'sns' | 'email';
  snsTopicArn?: string; // Required if notificationMethod is 'sns'
  emailAddress?: string; // Required if notificationMethod is 'email'
  enabled?: boolean;
}

export interface EventsCreateAlertOutput {
  subscriptionId: string;
  name: string;
  ruleId: string;
  notificationMethod: string;
  target: string; // SNS topic ARN or email address
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
      const alertRequest: any = {
        name: input.name,
        ruleId: input.ruleId,
        notificationMethod: input.notificationMethod,
        enabled: input.enabled !== undefined ? input.enabled : true
      };

      if (input.notificationMethod === 'sns') {
        if (!input.snsTopicArn) {
          throw new TaskExecutionError(
            this.type,
            context.nodeId || 'unknown',
            'snsTopicArn is required when notificationMethod is "sns"'
          );
        }
        alertRequest.snsTopicArn = input.snsTopicArn;
      } else if (input.notificationMethod === 'email') {
        if (!input.emailAddress) {
          throw new TaskExecutionError(
            this.type,
            context.nodeId || 'unknown',
            'emailAddress is required when notificationMethod is "email"'
          );
        }
        alertRequest.emailAddress = input.emailAddress;
      }

      // Create alert subscription
      const result = await this.eventsService.createAlert(alertRequest);

      const target = input.notificationMethod === 'sns' ? input.snsTopicArn! : input.emailAddress!;

      const executionTime = Date.now() - startTime;

      this.logger?.info('Event alert created successfully', {
        subscriptionId: result.subscriptionId,
        name: input.name,
        ruleId: input.ruleId,
        notificationMethod: input.notificationMethod,
        target,
        executionTime
      });

      return {
        subscriptionId: result.subscriptionId,
        name: input.name,
        ruleId: input.ruleId,
        notificationMethod: input.notificationMethod,
        target,
        enabled: alertRequest.enabled,
        success: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;

      this.logger?.error('Failed to create event alert', {
        name: input.name,
        ruleId: input.ruleId,
        error: error instanceof Error ? error.message : String(error),
        executionTime
      });

      if (error instanceof TaskExecutionError) {
        throw error;
      }

      throw new TaskExecutionError(
        this.type,
        context.nodeId || 'unknown',
        `Failed to create event alert: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  async validate(input: EventsCreateAlertInput): Promise<{ valid: boolean; errors: string[]; warnings: string[] }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!input.name) {
      errors.push('Alert name is required');
    } else if (typeof input.name !== 'string') {
      errors.push('Alert name must be a string');
    } else if (input.name.length === 0) {
      errors.push('Alert name cannot be empty');
    } else if (input.name.length > 64) {
      errors.push('Alert name cannot exceed 64 characters');
    }

    if (!input.ruleId) {
      errors.push('Rule ID is required');
    } else if (typeof input.ruleId !== 'string') {
      errors.push('Rule ID must be a string');
    }

    if (!input.notificationMethod) {
      errors.push('Notification method is required');
    } else if (!['sns', 'email'].includes(input.notificationMethod)) {
      errors.push('Notification method must be "sns" or "email"');
    }

    if (input.notificationMethod === 'sns') {
      if (!input.snsTopicArn) {
        errors.push('SNS topic ARN is required when notification method is "sns"');
      } else if (typeof input.snsTopicArn !== 'string') {
        errors.push('SNS topic ARN must be a string');
      } else if (!input.snsTopicArn.startsWith('arn:aws:sns:')) {
        errors.push('Invalid SNS topic ARN format');
      }
    }

    if (input.notificationMethod === 'email') {
      if (!input.emailAddress) {
        errors.push('Email address is required when notification method is "email"');
      } else if (typeof input.emailAddress !== 'string') {
        errors.push('Email address must be a string');
      } else if (!this.isValidEmail(input.emailAddress)) {
        errors.push('Invalid email address format');
      }
    }

    if (input.enabled !== undefined && typeof input.enabled !== 'boolean') {
      errors.push('Enabled must be a boolean');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  getSchema() {
    return {
      input: {
        type: 'object',
        required: ['name', 'ruleId', 'notificationMethod'],
        properties: {
          name: {
            type: 'string',
            description: 'Unique name for the alert subscription',
            minLength: 1,
            maxLength: 64
          },
          ruleId: {
            type: 'string',
            description: 'ID of the event rule to subscribe to'
          },
          notificationMethod: {
            type: 'string',
            enum: ['sns', 'email'],
            description: 'Notification method (SNS or email)'
          },
          snsTopicArn: {
            type: 'string',
            description: 'SNS topic ARN (required if notificationMethod is "sns")',
            pattern: '^arn:aws:sns:'
          },
          emailAddress: {
            type: 'string',
            description: 'Email address (required if notificationMethod is "email")',
            format: 'email'
          },
          enabled: {
            type: 'boolean',
            description: 'Whether the alert subscription is enabled',
            default: true
          }
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
      description: 'Create an alert subscription for an event rule (SNS or email notifications)',
      category: 'Events',
      icon: 'bell',
      color: '#9C27B0',
      tags: ['events', 'alerts', 'notifications', 'sns', 'email', 'monitoring']
    };
  }
}
