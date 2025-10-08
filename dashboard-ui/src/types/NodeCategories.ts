/**
 * Node Categories and Subcategories
 *
 * Defines the hierarchical organization of workflow nodes
 * Used in FloatingNodePanel for grouped display
 */

export interface NodeSubcategory {
  id: string;
  name: string;
  icon?: string;
  description?: string;
}

export interface NodeCategory {
  id: string;
  name: string;
  icon: string;
  subcategories: NodeSubcategory[];
}

/**
 * Standard category structure
 * Matches the organization in FloatingNodePanel
 */
export const NODE_CATEGORIES: NodeCategory[] = [
  {
    id: 'triggers',
    name: 'Triggers',
    icon: '⚡',
    subcategories: [
      { id: 'manual', name: 'Manual', icon: '👆' },
      { id: 'webhook', name: 'Webhook', icon: '🔗' },
      { id: 'schedule', name: 'Schedule', icon: '⏰' },
      { id: 'event', name: 'Event', icon: '📡' }
    ]
  },
  {
    id: 'actions',
    name: 'Actions',
    icon: '⚙️',
    subcategories: [
      { id: 'http', name: 'HTTP', icon: '🌐' },
      { id: 'data-transform', name: 'Data Transform', icon: '🔄' },
      { id: 'ai', name: 'AI', icon: '🤖' },
      { id: 'notification', name: 'Notification', icon: '📢' }
    ]
  },
  {
    id: 'logic',
    name: 'Logic',
    icon: '🔀',
    subcategories: [
      { id: 'conditional', name: 'Conditional', icon: '❓' },
      { id: 'loop', name: 'Loop', icon: '🔁' },
      { id: 'switch', name: 'Switch', icon: '🔀' },
      { id: 'merge', name: 'Merge', icon: '🔗' }
    ]
  },
  {
    id: 'data',
    name: 'Data',
    icon: '💾',
    subcategories: [
      { id: 'storage', name: 'Storage', icon: '🗄️' },
      { id: 'database', name: 'Database', icon: '🗃️' },
      { id: 'file', name: 'File', icon: '📁' },
      { id: 'api', name: 'API', icon: '🔌' }
    ]
  },
  {
    id: 'integrations',
    name: 'Integrations',
    icon: '🔌',
    subcategories: [
      { id: 'communication', name: 'Communication', icon: '💬', description: 'Slack, Email, SMS' },
      { id: 'productivity', name: 'Productivity', icon: '📊', description: 'Google Workspace, Office 365' },
      { id: 'crm', name: 'CRM', icon: '👥', description: 'Salesforce, HubSpot' },
      { id: 'payment', name: 'Payment', icon: '💳', description: 'Stripe, PayPal' },
      { id: 'analytics', name: 'Analytics', icon: '📈', description: 'Google Analytics, Mixpanel' }
    ]
  },
  {
    id: 'visualization',
    name: 'Visualization',
    icon: '📊',
    subcategories: [
      { id: 'charts', name: 'Charts', icon: '📊' },
      { id: 'tables', name: 'Tables', icon: '📋' },
      { id: 'metrics', name: 'Metrics', icon: '📈' }
    ]
  },
  {
    id: 'shapes',
    name: 'Shapes',
    icon: '⬛',
    subcategories: [
      { id: 'basic', name: 'Basic', icon: '⬜' },
      { id: 'flowchart', name: 'Flowchart', icon: '🔷' },
      { id: 'special', name: 'Special', icon: '⭐' }
    ]
  },
  {
    id: 'custom',
    name: 'Custom',
    icon: '🔧',
    subcategories: [
      { id: 'user-created', name: 'User Created', icon: '👤' },
      { id: 'organization', name: 'Organization', icon: '🏢' },
      { id: 'community', name: 'Community', icon: '🌐' }
    ]
  }
];

/**
 * Get category by ID
 */
export function getCategoryById(categoryId: string): NodeCategory | undefined {
  return NODE_CATEGORIES.find(cat => cat.id === categoryId);
}

/**
 * Get subcategory by ID
 */
export function getSubcategoryById(
  categoryId: string,
  subcategoryId: string
): NodeSubcategory | undefined {
  const category = getCategoryById(categoryId);
  return category?.subcategories.find(sub => sub.id === subcategoryId);
}

/**
 * Get all subcategories for a category
 */
export function getSubcategories(categoryId: string): NodeSubcategory[] {
  const category = getCategoryById(categoryId);
  return category?.subcategories || [];
}

/**
 * Validate category and subcategory combination
 */
export function isValidCategorization(
  categoryId: string,
  subcategoryId?: string
): boolean {
  const category = getCategoryById(categoryId);
  if (!category) return false;

  if (!subcategoryId) return true;

  return category.subcategories.some(sub => sub.id === subcategoryId);
}

/**
 * Get full path for display
 */
export function getCategoryPath(
  categoryId: string,
  subcategoryId?: string
): string {
  const category = getCategoryById(categoryId);
  if (!category) return 'Unknown';

  if (!subcategoryId) return category.name;

  const subcategory = getSubcategoryById(categoryId, subcategoryId);
  return subcategory ? `${category.name} > ${subcategory.name}` : category.name;
}
