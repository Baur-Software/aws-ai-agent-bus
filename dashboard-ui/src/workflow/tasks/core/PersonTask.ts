// Person Task Implementation
// Represents a person in the workflow - can be organization member or email

import {
  WorkflowTask,
  WorkflowContext,
  ValidationResult,
  TaskConfigSchema,
  TaskDisplayInfo,
  Logger,
  NODE_CATEGORIES
} from '../../types';

export interface PersonInput {
  personType: 'organization_member' | 'email' | 'external';
  userId?: string;
  email?: string;
  name?: string;
  role?: string;
  notificationPreferences?: {
    email?: boolean;
    slack?: boolean;
    sms?: boolean;
    inApp?: boolean;
  };
  approvalRequired?: boolean;
  timeout?: number; // seconds
  escalationTo?: string; // userId or email
}

export interface PersonOutput {
  personId: string;
  name: string;
  email: string;
  role?: string;
  status: 'assigned' | 'notified' | 'responded' | 'approved' | 'rejected' | 'timeout';
  response?: any;
  timestamp: string;
  notificationsSent: string[];
}

export class PersonTask implements WorkflowTask<PersonInput, PersonOutput> {
  readonly type = 'person';

  constructor(
    private authService?: any,
    private notificationService?: any,
    private logger?: Logger
  ) {}

  async execute(input: PersonInput, context: WorkflowContext): Promise<PersonOutput> {
    const timestamp = new Date().toISOString();
    let personInfo: { id: string; name: string; email: string; role?: string };

    // Resolve person information
    if (input.personType === 'organization_member' && input.userId) {
      personInfo = await this.getOrganizationMember(input.userId, context);
    } else if (input.personType === 'email' && input.email) {
      personInfo = {
        id: input.email,
        name: input.name || input.email,
        email: input.email,
        role: input.role
      };
    } else {
      throw new Error('Invalid person configuration: must specify either userId or email');
    }

    this.logger?.info(`Assigning task to person: ${personInfo.name} (${personInfo.email})`);

    // Create person assignment
    const assignment = {
      workflowId: context.workflowId,
      nodeId: context.nodeId,
      executionId: context.executionId,
      personId: personInfo.id,
      personName: personInfo.name,
      personEmail: personInfo.email,
      assignedAt: timestamp,
      approvalRequired: input.approvalRequired || false,
      timeout: input.timeout,
      escalationTo: input.escalationTo
    };

    // Store assignment in context for other nodes to access
    context.data.personAssignments = context.data.personAssignments || [];
    context.data.personAssignments.push(assignment);

    // Send notifications
    const notificationsSent = await this.sendNotifications(personInfo, input, assignment);

    // Create result
    const result: PersonOutput = {
      personId: personInfo.id,
      name: personInfo.name,
      email: personInfo.email,
      role: personInfo.role,
      status: 'assigned',
      timestamp,
      notificationsSent
    };

    // Set up timeout if specified
    if (input.timeout && input.timeout > 0) {
      this.setupTimeout(assignment, input.timeout, context);
    }

    // Emit person assigned event
    context.emit('person.assigned', {
      assignment,
      notifications: notificationsSent
    });

    this.logger?.info(`Successfully assigned task to ${personInfo.name}`);

    return result;
  }

  private async getOrganizationMember(userId: string, context: WorkflowContext): Promise<{
    id: string;
    name: string;
    email: string;
    role?: string;
  }> {
    // In a real implementation, this would query the organization service
    // For now, return mock data based on the auth system

    if (this.authService) {
      try {
        const user = await this.authService.getUser(userId);
        if (user) {
          return {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role || 'member'
          };
        }
      } catch (error) {
        this.logger?.warn(`Failed to get user ${userId} from auth service:`, error);
      }
    }

    // Fallback for demo purposes
    const mockUsers = [
      { id: 'user-demo-123', name: 'Demo User', email: 'demo@example.com', role: 'admin' },
      { id: 'user-alice-456', name: 'Alice Johnson', email: 'alice@acme.com', role: 'manager' },
      { id: 'user-bob-789', name: 'Bob Wilson', email: 'bob@acme.com', role: 'developer' },
      { id: 'user-carol-012', name: 'Carol Brown', email: 'carol@acme.com', role: 'designer' }
    ];

    const user = mockUsers.find(u => u.id === userId);
    if (!user) {
      throw new Error(`Organization member not found: ${userId}`);
    }

    return user;
  }

  private async sendNotifications(
    person: { id: string; name: string; email: string; role?: string },
    input: PersonInput,
    assignment: any
  ): Promise<string[]> {
    const notifications: string[] = [];
    const preferences = input.notificationPreferences || { email: true, inApp: true };

    try {
      // Email notification
      if (preferences.email && this.notificationService) {
        await this.notificationService.sendEmail({
          to: person.email,
          subject: `Workflow Task Assignment - ${assignment.workflowId}`,
          template: 'workflow_assignment',
          data: {
            personName: person.name,
            workflowId: assignment.workflowId,
            nodeId: assignment.nodeId,
            assignedAt: assignment.assignedAt,
            approvalRequired: assignment.approvalRequired
          }
        });
        notifications.push('email');
      }

      // In-app notification
      if (preferences.inApp) {
        // This would typically be sent via WebSocket or stored in a notifications table
        notifications.push('in_app');
      }

      // Slack notification (if configured)
      if (preferences.slack && this.notificationService) {
        try {
          await this.notificationService.sendSlack({
            userId: person.id,
            message: `You have been assigned a workflow task: ${assignment.workflowId}`,
            data: assignment
          });
          notifications.push('slack');
        } catch (error) {
          this.logger?.warn('Failed to send Slack notification:', error);
        }
      }

      // SMS notification (if configured)
      if (preferences.sms && this.notificationService) {
        try {
          await this.notificationService.sendSMS({
            userId: person.id,
            message: `Workflow task assigned: ${assignment.workflowId}. Check your dashboard for details.`
          });
          notifications.push('sms');
        } catch (error) {
          this.logger?.warn('Failed to send SMS notification:', error);
        }
      }

    } catch (error) {
      this.logger?.error('Error sending notifications:', error);
    }

    return notifications;
  }

  private setupTimeout(assignment: any, timeoutSeconds: number, context: WorkflowContext): void {
    // In a production system, this would be handled by a job queue or scheduler
    setTimeout(() => {
      this.logger?.warn(`Task timeout for person ${assignment.personId} in workflow ${assignment.workflowId}`);

      context.emit('person.timeout', {
        assignment,
        timeoutAt: new Date().toISOString()
      });

      // Handle escalation if configured
      if (assignment.escalationTo) {
        this.logger?.info(`Escalating to: ${assignment.escalationTo}`);
        context.emit('person.escalated', {
          assignment,
          escalatedTo: assignment.escalationTo,
          escalatedAt: new Date().toISOString()
        });
      }
    }, timeoutSeconds * 1000);
  }

  validate(input: PersonInput): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Person type validation
    if (!input.personType || !['organization_member', 'email', 'external'].includes(input.personType)) {
      errors.push('Person type must be one of: organization_member, email, external');
    }

    // Organization member validation
    if (input.personType === 'organization_member' && !input.userId) {
      errors.push('userId is required for organization_member type');
    }

    // Email validation
    if (input.personType === 'email' && !input.email) {
      errors.push('email is required for email type');
    }

    if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
      errors.push('Invalid email format');
    }

    // Timeout validation
    if (input.timeout && (input.timeout < 60 || input.timeout > 86400)) {
      warnings.push('Timeout should be between 60 seconds and 24 hours');
    }

    // Escalation validation
    if (input.escalationTo && !input.timeout) {
      warnings.push('Escalation specified without timeout - escalation will never trigger');
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
      title: 'Person Assignment',
      description: 'Assign a task to a person - organization member or external email',
      properties: {
        personType: {
          type: 'string',
          title: 'Person Type',
          description: 'Type of person assignment',
          enum: ['organization_member', 'email', 'external'],
          default: 'organization_member'
        },
        userId: {
          type: 'string',
          title: 'User ID',
          description: 'Organization member user ID (required for organization_member type)'
        },
        email: {
          type: 'string',
          title: 'Email Address',
          description: 'Email address (required for email type)',
          format: 'email'
        },
        name: {
          type: 'string',
          title: 'Display Name',
          description: 'Display name for the person'
        },
        role: {
          type: 'string',
          title: 'Role',
          description: 'Person\'s role or title'
        },
        approvalRequired: {
          type: 'boolean',
          title: 'Approval Required',
          description: 'Whether this person needs to approve to proceed',
          default: false
        },
        timeout: {
          type: 'number',
          title: 'Timeout (seconds)',
          description: 'Timeout in seconds (60-86400)',
          minimum: 60,
          maximum: 86400
        },
        escalationTo: {
          type: 'string',
          title: 'Escalate To',
          description: 'User ID or email to escalate to on timeout'
        },
        notificationPreferences: {
          type: 'object',
          title: 'Notification Preferences',
          description: 'How to notify this person',
          properties: {
            email: {
              type: 'boolean',
              title: 'Email',
              description: 'Send email notification',
              default: true
            },
            slack: {
              type: 'boolean',
              title: 'Slack',
              description: 'Send Slack notification',
              default: false
            },
            sms: {
              type: 'boolean',
              title: 'SMS',
              description: 'Send SMS notification',
              default: false
            },
            inApp: {
              type: 'boolean',
              title: 'In-App',
              description: 'Send in-app notification',
              default: true
            }
          }
        }
      },
      required: ['personType'],
      examples: [
        {
          personType: 'organization_member',
          userId: 'user-alice-456',
          approvalRequired: true,
          timeout: 3600,
          escalationTo: 'user-demo-123',
          notificationPreferences: {
            email: true,
            slack: true,
            inApp: true
          }
        },
        {
          personType: 'email',
          email: 'contractor@external.com',
          name: 'External Contractor',
          role: 'Reviewer',
          approvalRequired: false,
          notificationPreferences: {
            email: true
          }
        }
      ]
    };
  }

  getDisplayInfo(): TaskDisplayInfo {
    return {
      category: NODE_CATEGORIES.CORE,
      label: 'Person',
      icon: 'User',
      color: 'bg-blue-500',
      description: 'Assign task to a person (organization member or email)',
      tags: ['person', 'assignment', 'approval', 'human', 'notification']
    };
  }
}