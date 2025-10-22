/**
 * Node Registry
 *
 * Single source of truth for all workflow node definitions.
 * This replaces scattered configs in nodeDefinitions.ts and WorkflowNodeDetails.tsx.
 *
 * Benefits:
 * - Centralized node metadata and configuration
 * - Type-safe interfaces
 * - Easy to extend with new nodes
 * - Supports both dedicated components and generic field-based rendering
 */

import type { JSX } from 'solid-js';

/**
 * Field configuration for generic node config forms
 */
export interface NodeField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'select' | 'checkbox' | 'json' | 'credential';
  required?: boolean;
  defaultValue?: any;
  placeholder?: string;
  help?: string;
  options?: Array<{ label: string; value: any }>;
  integrationId?: string; // For credential type fields
}

/**
 * Complete node definition
 */
export interface NodeDefinition {
  // Identity
  type: string;
  name: string;
  description: string;

  // Categorization
  category: 'triggers' | 'actions' | 'logic' | 'data' | 'integrations' | 'ai' | 'notifications' | 'datavis' | 'custom';
  subcategory?: string;

  // Visual
  icon?: string;
  color?: string;
  shape?: string;

  // Configuration
  fields?: NodeField[];
  defaultConfig?: Record<string, any>;

  // Integration requirements
  requiresIntegration?: string; // e.g., 'slack', 'google-analytics'
  requiresCredentials?: boolean;

  // Advanced features
  hasAgentConfig?: boolean; // Supports AI model configuration
  hasDedicatedComponent?: boolean; // Has custom config component (not field-based)
  componentName?: string; // Name of dedicated component (e.g., 'HttpNodeConfig')

  // Output schema for test/dry-run data
  outputSchema?: {
    type: 'object';
  properties: Record<string, any>;
    required?: string[];
  };
  sampleOutput?: any; // Legacy sample data
}

/**
 * Node category definitions for organization
 */
export interface NodeCategory {
  id: string;
  name: string;
  description: string;
  subcategories?: Array<{
    id: string;
    name: string;
    description?: string;
  }>;
}

/**
 * Standard categories matching the sidebar structure
 */
export const NODE_CATEGORIES: NodeCategory[] = [
  {
    id: 'triggers',
    name: 'Triggers',
    description: 'Start workflow execution',
    subcategories: [
      { id: 'manual', name: 'Manual', description: 'User-initiated triggers' },
      { id: 'webhook', name: 'Webhooks', description: 'HTTP-based triggers' },
      { id: 'schedule', name: 'Scheduled', description: 'Time-based triggers' },
      { id: 'event', name: 'Events', description: 'Event-driven triggers' }
    ]
  },
  {
    id: 'actions',
    name: 'Actions',
    description: 'Perform operations',
    subcategories: [
      { id: 'http', name: 'HTTP', description: 'API requests' },
      { id: 'data-transform', name: 'Data Transform', description: 'Data manipulation' },
      { id: 'ai', name: 'AI', description: 'AI-powered operations' },
      { id: 'notification', name: 'Notifications', description: 'Send notifications' }
    ]
  },
  {
    id: 'logic',
    name: 'Logic & Control',
    description: 'Control flow',
    subcategories: [
      { id: 'conditional', name: 'Conditionals', description: 'If/else logic' },
      { id: 'loop', name: 'Loops', description: 'Iteration' },
      { id: 'switch', name: 'Switch', description: 'Multi-way branching' }
    ]
  },
  {
    id: 'data',
    name: 'Data & Storage',
    description: 'Data operations',
    subcategories: [
      { id: 'kv', name: 'Key-Value', description: 'KV store operations' },
      { id: 's3', name: 'S3', description: 'Object storage' },
      { id: 'database', name: 'Database', description: 'Database operations' }
    ]
  },
  {
    id: 'integrations',
    name: 'Integrations',
    description: 'Third-party services',
    subcategories: [
      { id: 'communication', name: 'Communication', description: 'Slack, email, etc.' },
      { id: 'productivity', name: 'Productivity', description: 'Google, Office 365' },
      { id: 'crm', name: 'CRM', description: 'Salesforce, HubSpot' },
      { id: 'payment', name: 'Payments', description: 'Stripe, PayPal' }
    ]
  },
  {
    id: 'ai',
    name: 'AI Agents',
    description: 'AI-powered agents',
    subcategories: [
      { id: 'specialist', name: 'Specialists', description: 'Domain experts' },
      { id: 'orchestration', name: 'Orchestration', description: 'Conductors, critics' }
    ]
  },
  {
    id: 'datavis',
    name: 'Data Visualization',
    description: 'Charts and metrics',
    subcategories: [
      { id: 'chart', name: 'Charts', description: 'Visual charts' },
      { id: 'table', name: 'Tables', description: 'Data tables' },
      { id: 'metric', name: 'Metrics', description: 'KPI displays' }
    ]
  }
];

/**
 * Node Registry - all available nodes
 * This will be populated from individual node definition files
 */
export const NODE_REGISTRY = new Map<string, NodeDefinition>();

/**
 * Register a node definition
 */
export function registerNode(definition: NodeDefinition): void {
  NODE_REGISTRY.set(definition.type, definition);
}

/**
 * Register multiple nodes at once
 */
export function registerNodes(definitions: NodeDefinition[]): void {
  definitions.forEach(registerNode);
}

/**
 * Get a node definition by type
 */
export function getNodeDefinition(type: string): NodeDefinition | undefined {
  return NODE_REGISTRY.get(type);
}

/**
 * Get all registered nodes
 */
export function getAllNodes(): NodeDefinition[] {
  return Array.from(NODE_REGISTRY.values());
}

/**
 * Get nodes by category
 */
export function getNodesByCategory(category: string): NodeDefinition[] {
  return getAllNodes().filter(node => node.category === category);
}

/**
 * Get nodes by subcategory
 */
export function getNodesBySubcategory(category: string, subcategory: string): NodeDefinition[] {
  return getAllNodes().filter(
    node => node.category === category && node.subcategory === subcategory
  );
}

/**
 * Check if a node type has a dedicated component
 */
export function hasDedicatedComponent(nodeType: string): boolean {
  const definition = getNodeDefinition(nodeType);
  return definition?.hasDedicatedComponent ?? false;
}

/**
 * Get default configuration for a node
 */
export function getDefaultConfig(nodeType: string): Record<string, any> {
  const definition = getNodeDefinition(nodeType);
  if (!definition) return {};

  // Start with defaultConfig if provided
  const config = { ...(definition.defaultConfig || {}) };

  // Fill in defaults from fields
  definition.fields?.forEach(field => {
    if (field.defaultValue !== undefined && !(field.key in config)) {
      config[field.key] = field.defaultValue;
    }
  });

  return config;
}
