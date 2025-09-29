// HubSpot Email Task Implementation
// Send emails through HubSpot

import {
  WorkflowTask,
  WorkflowContext,
  ValidationResult,
  TaskConfigSchema,
  TaskDisplayInfo,
  Logger,
  NODE_CATEGORIES,
  INTEGRATION_KEYS
} from '../../types';

export interface HubSpotEmailInput {
  action: 'send_email' | 'create_sequence' | 'enroll_in_sequence';
  emailId?: string;
  sequenceId?: string;
  contactId?: string;
  email?: string;
  subject?: string;
  htmlContent?: string;
  textContent?: string;
  fromEmail?: string;
  fromName?: string;
  templateId?: string;
  personalization?: Record<string, string>;
  scheduledAt?: string;
  trackOpens?: boolean;
  trackClicks?: boolean;
}

export interface HubSpotEmailOutput {
  emailId?: string;
  sequenceId?: string;
  enrollmentId?: string;
  status: 'sent' | 'scheduled' | 'enrolled' | 'created';
  contactId: string;
  subject?: string;
  sentAt?: string;
  scheduledAt?: string;
  trackingEnabled: {
    opens: boolean;
    clicks: boolean;
  };
  sequenceStep?: number;
}

export class HubSpotEmailTask implements WorkflowTask<HubSpotEmailInput, HubSpotEmailOutput> {
  readonly type = 'hubspot-email';

  constructor(
    private hubspotService?: any,
    private logger?: Logger
  ) {}

  async execute(input: HubSpotEmailInput, context: WorkflowContext): Promise<HubSpotEmailOutput> {
    this.logger?.info(`Executing HubSpot email action: ${input.action}`);

    if (!this.hubspotService) {
      throw new Error('HubSpot service not available. Please connect your HubSpot integration.');
    }

    try {
      let result: HubSpotEmailOutput;

      switch (input.action) {
        case 'send_email':
          result = await this.sendEmail(input, context);
          break;
        case 'create_sequence':
          result = await this.createSequence(input, context);
          break;
        case 'enroll_in_sequence':
          result = await this.enrollInSequence(input, context);
          break;
        default:
          throw new Error(`Unknown action: ${input.action}`);
      }

      // Store result in context for downstream tasks
      context.data.hubspotEmail = result;

      // Emit email event
      context.emit('hubspot.email.processed', {
        action: input.action,
        emailId: result.emailId,
        sequenceId: result.sequenceId,
        contactId: result.contactId
      });

      this.logger?.info(`Successfully processed HubSpot email: ${result.status}`);
      return result;

    } catch (error) {
      this.logger?.error('HubSpot email operation failed:', error);
      throw error;
    }
  }

  private async sendEmail(input: HubSpotEmailInput, context: WorkflowContext): Promise<HubSpotEmailOutput> {
    // Get contact ID from context if not provided
    const contactId = input.contactId || context.data.hubspotContact?.contactId;
    if (!contactId) {
      throw new Error('Contact ID is required. Connect a HubSpot Contact task first.');
    }

    // Simulate HubSpot email API call
    await new Promise(resolve => setTimeout(resolve, 1500));

    const emailId = `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    return {
      emailId,
      status: input.scheduledAt ? 'scheduled' : 'sent',
      contactId,
      subject: input.subject,
      sentAt: input.scheduledAt ? undefined : now,
      scheduledAt: input.scheduledAt,
      trackingEnabled: {
        opens: input.trackOpens ?? true,
        clicks: input.trackClicks ?? true
      }
    };
  }

  private async createSequence(input: HubSpotEmailInput, context: WorkflowContext): Promise<HubSpotEmailOutput> {
    // Simulate HubSpot sequence creation
    await new Promise(resolve => setTimeout(resolve, 2000));

    const sequenceId = `seq_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return {
      sequenceId,
      status: 'created',
      contactId: '', // Not applicable for sequence creation
      trackingEnabled: {
        opens: true,
        clicks: true
      }
    };
  }

  private async enrollInSequence(input: HubSpotEmailInput, context: WorkflowContext): Promise<HubSpotEmailOutput> {
    const contactId = input.contactId || context.data.hubspotContact?.contactId;
    if (!contactId) {
      throw new Error('Contact ID is required. Connect a HubSpot Contact task first.');
    }

    if (!input.sequenceId) {
      throw new Error('Sequence ID is required for enrollment');
    }

    // Simulate HubSpot sequence enrollment
    await new Promise(resolve => setTimeout(resolve, 1200));

    const enrollmentId = `enroll_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return {
      sequenceId: input.sequenceId,
      enrollmentId,
      status: 'enrolled',
      contactId,
      sequenceStep: 1,
      trackingEnabled: {
        opens: true,
        clicks: true
      }
    };
  }

  validate(input: HubSpotEmailInput): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Action validation
    if (!input.action || !['send_email', 'create_sequence', 'enroll_in_sequence'].includes(input.action)) {
      errors.push('Action must be one of: send_email, create_sequence, enroll_in_sequence');
    }

    // Send email validation
    if (input.action === 'send_email') {
      if (!input.subject) {
        errors.push('Subject is required for sending emails');
      }
      if (!input.htmlContent && !input.textContent && !input.templateId) {
        errors.push('Email content (HTML, text, or template ID) is required');
      }
      if (input.fromEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.fromEmail)) {
        errors.push('Invalid from email format');
      }
    }

    // Enroll in sequence validation
    if (input.action === 'enroll_in_sequence' && !input.sequenceId) {
      errors.push('Sequence ID is required for enrollment');
    }

    // Scheduled email validation
    if (input.scheduledAt) {
      const scheduledDate = new Date(input.scheduledAt);
      const now = new Date();
      if (scheduledDate <= now) {
        warnings.push('Scheduled time should be in the future');
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
      title: 'HubSpot Email',
      description: 'Send emails or manage email sequences in HubSpot',
      properties: {
        action: {
          type: 'string',
          title: 'Action',
          description: 'Email action to perform',
          enum: ['send_email', 'create_sequence', 'enroll_in_sequence'],
          default: 'send_email'
        },
        contactId: {
          type: 'string',
          title: 'Contact ID',
          description: 'HubSpot contact ID (will use previous task if not specified)'
        },
        sequenceId: {
          type: 'string',
          title: 'Sequence ID',
          description: 'HubSpot sequence ID (required for enrollment)'
        },
        subject: {
          type: 'string',
          title: 'Email Subject',
          description: 'Subject line for the email'
        },
        htmlContent: {
          type: 'string',
          title: 'HTML Content',
          description: 'HTML email content'
        },
        textContent: {
          type: 'string',
          title: 'Text Content',
          description: 'Plain text email content'
        },
        templateId: {
          type: 'string',
          title: 'Template ID',
          description: 'HubSpot email template ID'
        },
        fromEmail: {
          type: 'string',
          title: 'From Email',
          description: 'Sender email address',
          format: 'email'
        },
        fromName: {
          type: 'string',
          title: 'From Name',
          description: 'Sender display name'
        },
        scheduledAt: {
          type: 'string',
          title: 'Schedule For',
          description: 'Schedule email for later (ISO 8601 format)',
          format: 'date-time'
        },
        trackOpens: {
          type: 'boolean',
          title: 'Track Opens',
          description: 'Track email opens',
          default: true
        },
        trackClicks: {
          type: 'boolean',
          title: 'Track Clicks',
          description: 'Track link clicks',
          default: true
        },
        personalization: {
          type: 'object',
          title: 'Personalization',
          description: 'Personalization tokens for the email'
        }
      },
      required: ['action'],
      examples: [
        {
          action: 'send_email',
          subject: 'Welcome to our AI Agent Bus Demo!',
          htmlContent: '<h1>Hi {{firstname}}!</h1><p>Thank you for joining our demo. We\'re excited to show you how our workflow automation platform can transform your business processes.</p><p><a href="https://example.com/demo">Join the live demo</a></p>',
          fromEmail: 'demo@aiagentbus.com',
          fromName: 'AI Agent Bus Team',
          trackOpens: true,
          trackClicks: true,
          personalization: {
            firstname: 'John',
            company: 'Demo Company'
          }
        },
        {
          action: 'enroll_in_sequence',
          sequenceId: 'demo_nurture_sequence'
        }
      ]
    };
  }

  getDisplayInfo(): TaskDisplayInfo {
    return {
      category: NODE_CATEGORIES.INTEGRATIONS,
      label: 'HubSpot Email',
      icon: 'Mail',
      color: 'bg-orange-600',
      description: 'Send emails or manage sequences in HubSpot',
      tags: ['hubspot', 'email', 'sequence', 'marketing', 'automation'],
      integrationRequired: INTEGRATION_KEYS.HUBSPOT
    };
  }
}