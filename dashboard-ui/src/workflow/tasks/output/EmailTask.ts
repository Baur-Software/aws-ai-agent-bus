import { WorkflowTask, WorkflowContext } from '../../types/workflow';
import { TaskExecutionError } from '../../errors/TaskExecutionError';

export interface EmailTask_Input {
  to: string | string[];
  subject: string;
  body: string;
  cc?: string | string[];
  bcc?: string | string[];
  html?: boolean;
  attachments?: Array<{
    filename: string;
    content: string;
    contentType?: string;
  }>;
}

export interface EmailTask_Output {
  messageId: string;
  recipients: string[];
  subject: string;
  sent: boolean;
  success: boolean;
  timestamp: string;
}

export class EmailTask implements WorkflowTask<EmailTask_Input, EmailTask_Output> {
  readonly type = 'email';

  constructor(
    private notification?: any,
    private logger?: any
  ) {}

  async execute(input: EmailTask_Input, context: WorkflowContext): Promise<EmailTask_Output> {
    const startTime = Date.now();

    try {
      if (!this.notification) {
        throw new TaskExecutionError(
          this.type,
          context.nodeId || 'unknown',
          'Notification service not available'
        );
      }

      // Normalize recipients to arrays
      const toAddresses = Array.isArray(input.to) ? input.to : [input.to];
      const ccAddresses = input.cc ? (Array.isArray(input.cc) ? input.cc : [input.cc]) : [];
      const bccAddresses = input.bcc ? (Array.isArray(input.bcc) ? input.bcc : [input.bcc]) : [];

      const allRecipients = [...toAddresses, ...ccAddresses, ...bccAddresses];

      // Send email via notification service
      const result = await this.notification.sendEmail({
        to: toAddresses,
        cc: ccAddresses.length > 0 ? ccAddresses : undefined,
        bcc: bccAddresses.length > 0 ? bccAddresses : undefined,
        subject: input.subject,
        body: input.body,
        html: input.html || false,
        attachments: input.attachments
      });

      const executionTime = Date.now() - startTime;
      this.logger?.info?.('Email sent successfully', {
        messageId: result.messageId,
        recipients: allRecipients.length,
        subject: input.subject,
        executionTime
      });

      return {
        messageId: result.messageId || `email-${Date.now()}`,
        recipients: allRecipients,
        subject: input.subject,
        sent: true,
        success: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger?.error?.('Failed to send email', { error });

      if (error instanceof TaskExecutionError) {
        throw error;
      }

      throw new TaskExecutionError(
        this.type,
        context.nodeId || 'unknown',
        `Failed to send email: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  async validate(input: EmailTask_Input): Promise<{ valid: boolean; errors: string[]; warnings: string[] }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!input.to) {
      errors.push('Recipient (to) is required');
    } else {
      const addresses = Array.isArray(input.to) ? input.to : [input.to];
      for (const addr of addresses) {
        if (!this.isValidEmail(addr)) {
          errors.push(`Invalid email address: ${addr}`);
        }
      }
    }

    if (!input.subject) {
      errors.push('Subject is required');
    } else if (input.subject.length > 200) {
      warnings.push('Subject exceeds 200 characters');
    }

    if (!input.body) {
      errors.push('Body is required');
    }

    if (input.cc) {
      const addresses = Array.isArray(input.cc) ? input.cc : [input.cc];
      for (const addr of addresses) {
        if (!this.isValidEmail(addr)) {
          errors.push(`Invalid CC email address: ${addr}`);
        }
      }
    }

    if (input.bcc) {
      const addresses = Array.isArray(input.bcc) ? input.bcc : [input.bcc];
      for (const addr of addresses) {
        if (!this.isValidEmail(addr)) {
          errors.push(`Invalid BCC email address: ${addr}`);
        }
      }
    }

    if (input.attachments) {
      if (!Array.isArray(input.attachments)) {
        errors.push('Attachments must be an array');
      } else if (input.attachments.length > 10) {
        warnings.push('More than 10 attachments may cause delivery issues');
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  getSchema() {
    return {
      input: {
        type: 'object',
        required: ['to', 'subject', 'body'],
        properties: {
          to: {
            oneOf: [
              { type: 'string', format: 'email' },
              { type: 'array', items: { type: 'string', format: 'email' } }
            ],
            description: 'Recipient email address(es)'
          },
          subject: {
            type: 'string',
            description: 'Email subject line',
            maxLength: 200
          },
          body: {
            type: 'string',
            description: 'Email body content'
          },
          cc: {
            oneOf: [
              { type: 'string', format: 'email' },
              { type: 'array', items: { type: 'string', format: 'email' } }
            ],
            description: 'CC recipient(s)'
          },
          bcc: {
            oneOf: [
              { type: 'string', format: 'email' },
              { type: 'array', items: { type: 'string', format: 'email' } }
            ],
            description: 'BCC recipient(s)'
          },
          html: {
            type: 'boolean',
            description: 'Send as HTML email',
            default: false
          },
          attachments: {
            type: 'array',
            description: 'Email attachments',
            items: {
              type: 'object',
              properties: {
                filename: { type: 'string' },
                content: { type: 'string', description: 'Base64 encoded content' },
                contentType: { type: 'string' }
              },
              required: ['filename', 'content']
            }
          }
        }
      },
      output: {
        type: 'object',
        properties: {
          messageId: { type: 'string' },
          recipients: { type: 'array', items: { type: 'string' } },
          subject: { type: 'string' },
          sent: { type: 'boolean' },
          success: { type: 'boolean' },
          timestamp: { type: 'string', format: 'date-time' }
        }
      }
    };
  }

  getDisplayInfo() {
    return {
      name: 'Send Email',
      description: 'Send email via notification service',
      category: 'Output',
      icon: 'mail',
      color: '#F44336',
      tags: ['email', 'notification', 'send', 'message', 'communication']
    };
  }
}
