// Mock data for workflow templates and marketplace

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  popularity: number;
  rating: number;
  author: string;
  createdAt: string;
  updatedAt: string;
  featured: boolean;
  premium: boolean;
  nodes: any[];
  connections: any[];
}

export class MockDataGenerator {
  static generateWorkflowTemplate(partial: Partial<WorkflowTemplate> = {}): WorkflowTemplate {
    return {
      id: `template-${Math.random().toString(36).substr(2, 9)}`,
      name: 'Sample Workflow',
      description: 'A sample workflow template',
      category: 'General',
      tags: ['automation', 'sample'],
      popularity: Math.floor(Math.random() * 1000),
      rating: 4.0 + Math.random(),
      author: 'System',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      featured: false,
      premium: false,
      nodes: [],
      connections: [],
      ...partial
    };
  }

  static generateWorkflowTemplates(count: number = 10): WorkflowTemplate[] {
    return Array.from({ length: count }, (_, i) =>
      this.generateWorkflowTemplate({
        id: `template-${i + 1}`,
        name: `Workflow Template ${i + 1}`,
        description: `Description for workflow template ${i + 1}`,
        featured: i < 3
      })
    );
  }
}

export const mockWorkflowTemplates: WorkflowTemplate[] = [
  {
    id: 'template-1',
    name: 'E-commerce Order Processing',
    description: 'Automated workflow for processing e-commerce orders from Shopify to fulfillment',
    category: 'E-commerce',
    tags: ['shopify', 'orders', 'fulfillment', 'automation'],
    popularity: 850,
    rating: 4.7,
    author: 'Workflow Templates Team',
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-20T15:30:00Z',
    featured: true,
    premium: false,
    nodes: [],
    connections: []
  },
  {
    id: 'template-2',
    name: 'Lead Nurturing Campaign',
    description: 'Automated lead nurturing workflow using CRM and email marketing',
    category: 'Sales & Marketing',
    tags: ['crm', 'leads', 'email', 'nurturing'],
    popularity: 720,
    rating: 4.5,
    author: 'Marketing Automation Team',
    createdAt: '2024-01-10T08:00:00Z',
    updatedAt: '2024-01-18T12:00:00Z',
    featured: true,
    premium: true,
    nodes: [],
    connections: []
  },
  {
    id: 'template-3',
    name: 'GitHub Release Automation',
    description: 'Automated workflow for creating releases and deploying to production',
    category: 'DevOps',
    tags: ['github', 'releases', 'deployment', 'automation'],
    popularity: 650,
    rating: 4.8,
    author: 'DevOps Team',
    createdAt: '2024-01-12T14:00:00Z',
    updatedAt: '2024-01-22T09:00:00Z',
    featured: true,
    premium: false,
    nodes: [],
    connections: []
  },
  {
    id: 'template-4',
    name: 'Customer Onboarding',
    description: 'Streamlined customer onboarding process with multiple touchpoints',
    category: 'Customer Success',
    tags: ['onboarding', 'customers', 'automation', 'communication'],
    popularity: 480,
    rating: 4.3,
    author: 'Customer Success Team',
    createdAt: '2024-01-08T11:00:00Z',
    updatedAt: '2024-01-16T16:00:00Z',
    featured: false,
    premium: false,
    nodes: [],
    connections: []
  },
  {
    id: 'template-5',
    name: 'Data Backup & Sync',
    description: 'Automated data backup and synchronization across multiple systems',
    category: 'Data Management',
    tags: ['backup', 'sync', 'data', 'automation'],
    popularity: 380,
    rating: 4.1,
    author: 'Data Team',
    createdAt: '2024-01-05T13:00:00Z',
    updatedAt: '2024-01-19T10:30:00Z',
    featured: false,
    premium: true,
    nodes: [],
    connections: []
  }
];