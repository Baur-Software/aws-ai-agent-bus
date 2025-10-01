// HubSpot Contact Task Implementation
// Create or update contacts in HubSpot

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

export interface HubSpotContactInput {
  action: 'create' | 'update' | 'get';
  email: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  phone?: string;
  website?: string;
  properties?: Record<string, string>;
  listIds?: string[];
}

export interface HubSpotContactOutput {
  contactId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  createdAt: string;
  updatedAt: string;
  properties: Record<string, any>;
  lists: string[];
}

export class HubSpotContactTask implements WorkflowTask<HubSpotContactInput, HubSpotContactOutput> {
  readonly type = 'hubspot-contact';

  constructor(
    private hubspotService?: any,
    private logger?: Logger
  ) {}

  async execute(input: HubSpotContactInput, context: WorkflowContext): Promise<HubSpotContactOutput> {
    this.logger?.info(`Executing HubSpot contact action: ${input.action} for ${input.email}`);

    if (!this.hubspotService) {
      throw new Error('HubSpot service not available. Please connect your HubSpot integration.');
    }

    try {
      let result: HubSpotContactOutput;

      switch (input.action) {
        case 'create':
          result = await this.createContact(input);
          break;
        case 'update':
          result = await this.updateContact(input);
          break;
        case 'get':
          result = await this.getContact(input);
          break;
        default:
          throw new Error(`Unknown action: ${input.action}`);
      }

      // Store result in context for downstream tasks
      context.data.hubspotContact = result;

      // Emit contact event
      context.emit('hubspot.contact.processed', {
        action: input.action,
        contactId: result.contactId,
        email: result.email
      });

      this.logger?.info(`Successfully processed HubSpot contact: ${result.contactId}`);
      return result;

    } catch (error) {
      this.logger?.error('HubSpot contact operation failed:', error);
      throw error;
    }
  }

  private async createContact(input: HubSpotContactInput): Promise<HubSpotContactOutput> {
    // Simulate HubSpot API call for demo
    await new Promise(resolve => setTimeout(resolve, 1000));

    const contactId = `contact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString();

    return {
      contactId,
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      company: input.company,
      createdAt: timestamp,
      updatedAt: timestamp,
      properties: {
        email: input.email,
        firstname: input.firstName,
        lastname: input.lastName,
        company: input.company,
        phone: input.phone,
        website: input.website,
        ...input.properties
      },
      lists: input.listIds || []
    };
  }

  private async updateContact(input: HubSpotContactInput): Promise<HubSpotContactOutput> {
    // Simulate HubSpot API call for demo
    await new Promise(resolve => setTimeout(resolve, 800));

    const contactId = `existing_contact_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString();

    return {
      contactId,
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      company: input.company,
      createdAt: new Date(Date.now() - 86400000).toISOString(), // Created yesterday
      updatedAt: timestamp,
      properties: {
        email: input.email,
        firstname: input.firstName,
        lastname: input.lastName,
        company: input.company,
        phone: input.phone,
        website: input.website,
        ...input.properties
      },
      lists: input.listIds || []
    };
  }

  private async getContact(input: HubSpotContactInput): Promise<HubSpotContactOutput> {
    // Simulate HubSpot API call for demo
    await new Promise(resolve => setTimeout(resolve, 600));

    const contactId = `found_contact_${Math.random().toString(36).substr(2, 9)}`;

    return {
      contactId,
      email: input.email,
      firstName: 'John',
      lastName: 'Doe',
      company: 'Demo Company',
      createdAt: new Date(Date.now() - 86400000 * 7).toISOString(), // Created week ago
      updatedAt: new Date(Date.now() - 86400000).toISOString(), // Updated yesterday
      properties: {
        email: input.email,
        firstname: 'John',
        lastname: 'Doe',
        company: 'Demo Company',
        phone: '+1-555-0123',
        website: 'https://democompany.com',
        lifecycle_stage: 'lead',
        lead_status: 'new'
      },
      lists: ['list_prospects', 'list_product_interest']
    };
  }

  validate(input: HubSpotContactInput): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Email validation
    if (!input.email) {
      errors.push('Email is required');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
      errors.push('Invalid email format');
    }

    // Action validation
    if (!input.action || !['create', 'update', 'get'].includes(input.action)) {
      errors.push('Action must be one of: create, update, get');
    }

    // Name validation for create action
    if (input.action === 'create' && (!input.firstName || !input.lastName)) {
      warnings.push('First name and last name are recommended for new contacts');
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
      title: 'HubSpot Contact',
      description: 'Create, update, or retrieve contacts in HubSpot',
      properties: {
        action: {
          type: 'string',
          title: 'Action',
          description: 'What to do with the contact',
          enum: ['create', 'update', 'get'],
          default: 'create'
        },
        email: {
          type: 'string',
          title: 'Email',
          description: 'Contact email address (required)',
          format: 'email'
        },
        firstName: {
          type: 'string',
          title: 'First Name',
          description: 'Contact first name'
        },
        lastName: {
          type: 'string',
          title: 'Last Name',
          description: 'Contact last name'
        },
        company: {
          type: 'string',
          title: 'Company',
          description: 'Company name'
        },
        phone: {
          type: 'string',
          title: 'Phone',
          description: 'Phone number'
        },
        website: {
          type: 'string',
          title: 'Website',
          description: 'Company or personal website',
          format: 'uri'
        },
        properties: {
          type: 'object',
          title: 'Custom Properties',
          description: 'Additional HubSpot properties'
        },
        listIds: {
          type: 'array',
          title: 'Lists',
          description: 'HubSpot list IDs to add contact to',
          items: {
            type: 'string',
            title: 'List ID',
            description: 'HubSpot list identifier'
          }
        }
      },
      required: ['action', 'email'],
      examples: [
        {
          action: 'create',
          email: 'prospect@company.com',
          firstName: 'Jane',
          lastName: 'Smith',
          company: 'Tech Startup Inc',
          phone: '+1-555-0199',
          website: 'https://techstartup.com',
          properties: {
            lifecycle_stage: 'lead',
            lead_status: 'new',
            lead_source: 'demo_workflow'
          },
          listIds: ['prospects_list', 'demo_attendees']
        }
      ]
    };
  }

  getDisplayInfo(): TaskDisplayInfo {
    return {
      category: NODE_CATEGORIES.INTEGRATIONS,
      label: 'HubSpot Contact',
      icon: 'Users',
      color: 'bg-orange-500',
      description: 'Create, update, or retrieve contacts in HubSpot',
      tags: ['hubspot', 'contact', 'crm', 'lead', 'customer'],
      integrationRequired: INTEGRATION_KEYS.HUBSPOT
    };
  }
}