// Workflow Templates and Examples
// Pre-built workflows for common use cases

import { WorkflowDefinition } from '../types';
// import { hubspotDemoSequenceWorkflow } from './hubspot-demo-sequence';

// Basic workflow templates
export const WORKFLOW_TEMPLATES: WorkflowDefinition[] = [
  // Add HubSpot demo sequence workflow
  // hubspotDemoSequenceWorkflow,

  {
    version: '1.0',
    created: '2025-01-15T10:00:00Z',
    name: 'Data Processing Pipeline',
    description: 'Fetch data from API, process it, and store results',
    nodes: [
      {
        id: 'trigger-1',
        type: 'trigger',
        x: 50,
        y: 150,
        inputs: [],
        outputs: ['output'],
        config: {
          name: 'API Data Processing',
          description: 'Process data from external API'
        }
      },
      {
        id: 'http-get-1',
        type: 'http-get',
        x: 300,
        y: 150,
        inputs: ['input'],
        outputs: ['output'],
        config: {
          url: 'https://api.example.com/data',
          headers: {
            'Accept': 'application/json'
          }
        }
      },
      {
        id: 'json-parse-1',
        type: 'json-parse',
        x: 550,
        y: 150,
        inputs: ['input'],
        outputs: ['output'],
        config: {
          useContextData: true
        }
      },
      {
        id: 'filter-1',
        type: 'filter',
        x: 300,
        y: 300,
        inputs: ['input'],
        outputs: ['output'],
        config: {
          condition: 'item.status === "active"',
          description: 'Filter for active items only'
        }
      },
      {
        id: 'artifacts-put-1',
        type: 'artifacts-put',
        x: 550,
        y: 300,
        inputs: ['input'],
        outputs: ['output'],
        config: {
          key: 'processed-data-{{timestamp}}',
          useContextData: true,
          content_type: 'application/json'
        }
      }
    ],
    connections: [
      { from: 'trigger-1', to: 'http-get-1', fromOutput: 'output', toInput: 'input' },
      { from: 'http-get-1', to: 'json-parse-1', fromOutput: 'output', toInput: 'input' },
      { from: 'json-parse-1', to: 'filter-1', fromOutput: 'output', toInput: 'input' },
      { from: 'filter-1', to: 'artifacts-put-1', fromOutput: 'output', toInput: 'input' }
    ],
    metadata: {
      author: 'AWS AI Agent Bus',
      tags: ['api', 'data-processing', 'json', 'filter'],
      category: 'Data Processing',
      estimatedDuration: '1-2 minutes',
      version: '1.0.0',
      isTemplate: true
    }
  },

  {
    version: '1.0',
    created: '2025-01-15T10:00:00Z',
    name: 'Simple KV Storage Workflow',
    description: 'Basic workflow to store and retrieve data from key-value store',
    nodes: [
      {
        id: 'trigger-1',
        type: 'trigger',
        x: 50,
        y: 100,
        inputs: [],
        outputs: ['output'],
        config: {
          name: 'KV Demo Trigger',
          description: 'Demonstrate KV storage operations',
          data: {
            message: 'Hello, World!',
            timestamp: new Date().toISOString()
          }
        }
      },
      {
        id: 'kv-set-1',
        type: 'kv-set',
        x: 300,
        y: 100,
        inputs: ['input'],
        outputs: ['output'],
        config: {
          key: 'demo-message',
          useContextData: true,
          contextKey: 'triggerData',
          ttl_hours: 1
        }
      },
      {
        id: 'kv-get-1',
        type: 'kv-get',
        x: 550,
        y: 100,
        inputs: ['input'],
        outputs: ['output'],
        config: {
          key: 'demo-message'
        }
      },
      {
        id: 'output-1',
        type: 'output',
        x: 800,
        y: 100,
        inputs: ['input'],
        outputs: [],
        config: {
          format: 'json'
        }
      }
    ],
    connections: [
      { from: 'trigger-1', to: 'kv-set-1', fromOutput: 'output', toInput: 'input' },
      { from: 'kv-set-1', to: 'kv-get-1', fromOutput: 'output', toInput: 'input' },
      { from: 'kv-get-1', to: 'output-1', fromOutput: 'output', toInput: 'input' }
    ],
    metadata: {
      author: 'AWS AI Agent Bus',
      tags: ['kv-store', 'basic', 'demo'],
      category: 'Examples',
      estimatedDuration: '30 seconds',
      version: '1.0.0',
      isTemplate: true
    }
  },

  {
    version: '1.0',
    created: '2025-01-15T10:00:00Z',
    name: 'Event-Driven Notification System',
    description: 'Send notifications based on conditions and events',
    nodes: [
      {
        id: 'trigger-1',
        type: 'trigger',
        x: 50,
        y: 150,
        inputs: [],
        outputs: ['output'],
        config: {
          name: 'Event Monitoring Trigger',
          description: 'Monitor system events and send notifications'
        }
      },
      {
        id: 'condition-1',
        type: 'condition',
        x: 300,
        y: 150,
        inputs: ['input'],
        outputs: ['output'],
        config: {
          condition: 'data.severity === "high"',
          description: 'Check if event severity is high'
        }
      },
      {
        id: 'trello-card-1',
        type: 'trello-create-card',
        x: 550,
        y: 100,
        inputs: ['input'],
        outputs: ['output'],
        config: {
          name: 'High Severity Alert',
          description: 'A high severity event was detected and requires attention',
          listId: 'YOUR_ALERTS_LIST_ID'
        }
      },
      {
        id: 'events-send-1',
        type: 'events-send',
        x: 550,
        y: 200,
        inputs: ['input'],
        outputs: ['output'],
        config: {
          detailType: 'AlertCreated',
          detail: {
            severity: '{{severity}}',
            timestamp: '{{timestamp}}',
            alertType: 'trello-card'
          }
        }
      },
      {
        id: 'kv-set-1',
        type: 'kv-set',
        x: 800,
        y: 150,
        inputs: ['input'],
        outputs: ['output'],
        config: {
          key: 'last-alert-{{date}}',
          useContextData: true,
          ttl_hours: 168
        }
      }
    ],
    connections: [
      { from: 'trigger-1', to: 'condition-1', fromOutput: 'output', toInput: 'input' },
      { from: 'condition-1', to: 'trello-card-1', fromOutput: 'output', toInput: 'input' },
      { from: 'condition-1', to: 'events-send-1', fromOutput: 'output', toInput: 'input' },
      { from: 'trello-card-1', to: 'kv-set-1', fromOutput: 'output', toInput: 'input' }
    ],
    metadata: {
      author: 'AWS AI Agent Bus',
      tags: ['notifications', 'events', 'monitoring', 'trello'],
      category: 'Monitoring',
      estimatedDuration: '1 minute',
      version: '1.0.0',
      isTemplate: true
    }
  }
];

// Utility function to create a workflow from template
export function createWorkflowFromTemplate(template: WorkflowDefinition, name: string): WorkflowDefinition {
  return {
    ...template,
    name,
    description: `${template.description} (Created from template: ${template.name})`,
    created: new Date().toISOString(),
    metadata: {
      ...template.metadata,
      id: undefined, // Will be generated when saved
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
      version: '1.0.0',
      isTemplate: false,
      templateSource: template.name
    }
  };
}

// Function to get templates by category
export function getTemplatesByCategory(category: string): WorkflowDefinition[] {
  return WORKFLOW_TEMPLATES.filter(template => 
    template.metadata?.category?.toLowerCase() === category.toLowerCase()
  );
}

// Function to get templates by tag
export function getTemplatesByTag(tag: string): WorkflowDefinition[] {
  return WORKFLOW_TEMPLATES.filter(template =>
    template.metadata?.tags?.some(t => t.toLowerCase() === tag.toLowerCase())
  );
}

// Function to search templates
export function searchTemplates(query: string): WorkflowDefinition[] {
  const lowercaseQuery = query.toLowerCase();
  return WORKFLOW_TEMPLATES.filter(template =>
    template.name.toLowerCase().includes(lowercaseQuery) ||
    template.description.toLowerCase().includes(lowercaseQuery) ||
    template.metadata?.tags?.some(tag => tag.toLowerCase().includes(lowercaseQuery))
  );
}

// Template categories
export const TEMPLATE_CATEGORIES = [
  {
    id: 'content-management',
    name: 'Content Management',
    description: 'Workflows for managing and optimizing content',
    icon: 'FileText',
    templates: getTemplatesByCategory('Content Management')
  },
  {
    id: 'data-processing',
    name: 'Data Processing',
    description: 'Workflows for processing and transforming data',
    icon: 'Database',
    templates: getTemplatesByCategory('Data Processing')
  },
  {
    id: 'monitoring',
    name: 'Monitoring',
    description: 'Workflows for monitoring systems and sending alerts',
    icon: 'Bell',
    templates: getTemplatesByCategory('Monitoring')
  },
  {
    id: 'examples',
    name: 'Examples',
    description: 'Simple examples to help you get started',
    icon: 'Star',
    templates: getTemplatesByCategory('Examples')
  },
  {
    id: 'marketing',
    name: 'Marketing Automation',
    description: 'Customer engagement and lead nurturing workflows',
    icon: 'Mail',
    templates: getTemplatesByCategory('Marketing')
  }
];

// Function to initialize default templates in storage
export async function initializeDefaultTemplates(workflowStorage: any): Promise<void> {
  console.log('🔄 Initializing default workflow templates...');
  
  let templatesCreated = 0;
  
  for (const template of WORKFLOW_TEMPLATES) {
    try {
      const templateId = template.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      
      // Check if template already exists
      const exists = await workflowStorage.workflowExists(templateId);
      if (!exists) {
        await workflowStorage.saveWorkflow(template, {
          generateId: false,
          isTemplate: true
        });
        templatesCreated++;
      }
    } catch (error) {
      console.error(`Failed to create template ${template.name}:`, error);
    }
  }
  
  if (templatesCreated > 0) {
    console.log(`✅ Created ${templatesCreated} default templates`);
  } else {
    console.log('ℹ️ All default templates already exist');
  }
}