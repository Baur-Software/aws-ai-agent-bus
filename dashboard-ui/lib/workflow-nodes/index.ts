/**
 * Workflow Nodes Module
 *
 * Centralized node registry with:
 * - Standardized node definitions (NodeRegistry)
 * - Dedicated configuration components
 * - Tenant-scoped customization (TenantNodeConfig)
 * - Type-safe interfaces
 *
 * Benefits:
 * - Single source of truth for all nodes
 * - Organization-level node customization
 * - Better performance (cached, indexed)
 * - Rich, dedicated UIs for complex node types
 * - Easier to maintain and extend
 */

// Import default configs for use in this module
import { DEFAULT_CONDITIONAL_CONFIG } from './ConditionalNodeConfig';
import { DEFAULT_SWITCH_CONFIG } from './SwitchNodeConfig';
import { DEFAULT_HTTP_CONFIG } from './HttpNodeConfig';
import { DEFAULT_KV_GET_CONFIG, DEFAULT_KV_SET_CONFIG } from './KVStoreNodeConfig';
import { DEFAULT_MANUAL_TRIGGER_CONFIG, DEFAULT_WEBHOOK_TRIGGER_CONFIG, DEFAULT_SCHEDULE_TRIGGER_CONFIG } from './TriggerNodeConfig';
import { DEFAULT_DOCKER_CONFIG } from './DockerNodeConfig';

// ============================================================================
// Node Registry System
// ============================================================================
export {
  NODE_REGISTRY,
  NODE_CATEGORIES,
  registerNode,
  registerNodes,
  getNodeDefinition,
  getAllNodes,
  getNodesByCategory,
  getNodesBySubcategory,
  hasDedicatedComponent as isNodeRegistered,
  getDefaultConfig as getRegistryDefaultConfig
} from './NodeRegistry';

export type {
  NodeDefinition,
  NodeField,
  NodeCategory
} from './NodeRegistry';

// ============================================================================
// Tenant-Scoped Configuration
// ============================================================================
export {
  TenantNodeConfigService,
  EXAMPLE_TENANT_CONFIG
} from './TenantNodeConfig';

export type {
  TenantNodeConfig
} from './TenantNodeConfig';

// ============================================================================
// Node Definitions by Category
// ============================================================================
export { TRIGGER_NODES } from './nodes/TriggerNodes';
export { HTTP_NODES } from './nodes/HttpNodes';
export { LOGIC_NODES } from './nodes/LogicNodes';
export { DATA_NODES } from './nodes/DataNodes';
export { AI_NODES } from './nodes/AINodes';
export { INTEGRATION_NODES } from './nodes/IntegrationNodes';
export { VISUALIZATION_NODES } from './nodes/VisualizationNodes';
export { STORAGE_NODES } from './nodes/StorageNodes';
export { EVENT_NODES } from './nodes/EventNodes';
export { DOCKER_NODES } from './nodes/DockerNodes';
export { TRANSFORM_NODES } from './nodes/TransformNodes';
export { OUTPUT_NODES } from './nodes/OutputNodes';

// Auto-register all nodes on module load
import { registerNodes } from './NodeRegistry';
import { TRIGGER_NODES } from './nodes/TriggerNodes';
import { HTTP_NODES } from './nodes/HttpNodes';
import { LOGIC_NODES } from './nodes/LogicNodes';
import { DATA_NODES } from './nodes/DataNodes';
import { AI_NODES } from './nodes/AINodes';
import { INTEGRATION_NODES } from './nodes/IntegrationNodes';
import { VISUALIZATION_NODES } from './nodes/VisualizationNodes';
import { STORAGE_NODES } from './nodes/StorageNodes';
import { EVENT_NODES } from './nodes/EventNodes';
import { DOCKER_NODES } from './nodes/DockerNodes';
import { TRANSFORM_NODES } from './nodes/TransformNodes';
import { OUTPUT_NODES } from './nodes/OutputNodes';

registerNodes([
  ...TRIGGER_NODES,
  ...HTTP_NODES,
  ...LOGIC_NODES,
  ...DATA_NODES,
  ...AI_NODES,
  ...INTEGRATION_NODES,
  ...VISUALIZATION_NODES,
  ...STORAGE_NODES,
  ...EVENT_NODES,
  ...DOCKER_NODES,
  ...TRANSFORM_NODES,
  ...OUTPUT_NODES
]);

// ============================================================================
// Dedicated Config Components (Legacy - still used by some nodes)
// ============================================================================

// Logic Nodes
export { ConditionalNodeConfig, DEFAULT_CONDITIONAL_CONFIG } from './ConditionalNodeConfig';
export type { ConditionalConfig, Condition } from './ConditionalNodeConfig';

export { SwitchNodeConfig, DEFAULT_SWITCH_CONFIG } from './SwitchNodeConfig';
export type { SwitchConfig, SwitchCase } from './SwitchNodeConfig';

// HTTP Nodes
export { HttpNodeConfig, DEFAULT_HTTP_CONFIG } from './HttpNodeConfig';
export type { HttpConfig } from './HttpNodeConfig';

// Storage Nodes
export { KVStoreNodeConfig, DEFAULT_KV_GET_CONFIG, DEFAULT_KV_SET_CONFIG } from './KVStoreNodeConfig';
export type { KVStoreConfig, KVGetConfig, KVSetConfig } from './KVStoreNodeConfig';

// Trigger Nodes
export { TriggerNodeConfig, DEFAULT_MANUAL_TRIGGER_CONFIG, DEFAULT_WEBHOOK_TRIGGER_CONFIG, DEFAULT_SCHEDULE_TRIGGER_CONFIG } from './TriggerNodeConfig';
export type { TriggerConfig, ManualTriggerConfig, WebhookTriggerConfig, ScheduleTriggerConfig } from './TriggerNodeConfig';

// Docker Nodes
export { DockerNodeConfig, DEFAULT_DOCKER_CONFIG } from './DockerNodeConfig';
export type { DockerConfig, EnvironmentVariable, VolumeMount, PortMapping } from './DockerNodeConfig';

/**
 * Node Type Registry
 * Maps node types to their dedicated configuration components
 */
export const NODE_COMPONENT_REGISTRY = {
  // Logic nodes
  conditional: {
    component: 'ConditionalNodeConfig',
    defaultConfig: 'DEFAULT_CONDITIONAL_CONFIG'
  },
  switch: {
    component: 'SwitchNodeConfig',
    defaultConfig: 'DEFAULT_SWITCH_CONFIG'
  },

  // HTTP nodes
  'http-get': {
    component: 'HttpNodeConfig',
    defaultConfig: 'DEFAULT_HTTP_CONFIG'
  },
  'http-post': {
    component: 'HttpNodeConfig',
    defaultConfig: 'DEFAULT_HTTP_CONFIG'
  },
  'http-put': {
    component: 'HttpNodeConfig',
    defaultConfig: 'DEFAULT_HTTP_CONFIG'
  },
  'http-delete': {
    component: 'HttpNodeConfig',
    defaultConfig: 'DEFAULT_HTTP_CONFIG'
  },

  // Storage nodes
  'kv-get': {
    component: 'KVStoreNodeConfig',
    defaultConfig: 'DEFAULT_KV_GET_CONFIG'
  },
  'kv-set': {
    component: 'KVStoreNodeConfig',
    defaultConfig: 'DEFAULT_KV_SET_CONFIG'
  },

  // Trigger nodes
  'trigger': {
    component: 'TriggerNodeConfig',
    defaultConfig: 'DEFAULT_MANUAL_TRIGGER_CONFIG'
  },
  'webhook': {
    component: 'TriggerNodeConfig',
    defaultConfig: 'DEFAULT_WEBHOOK_TRIGGER_CONFIG'
  },
  'schedule': {
    component: 'TriggerNodeConfig',
    defaultConfig: 'DEFAULT_SCHEDULE_TRIGGER_CONFIG'
  },

  // Docker nodes
  'docker-run': {
    component: 'DockerNodeConfig',
    defaultConfig: 'DEFAULT_DOCKER_CONFIG'
  }
} as const;

/**
 * Check if a node type has a dedicated component
 */
export function hasDedicatedComponent(nodeType: string): boolean {
  return nodeType in NODE_COMPONENT_REGISTRY;
}

/**
 * Get the default configuration for a node type
 */
export function getDefaultConfig(nodeType: string): any {
  const entry = NODE_COMPONENT_REGISTRY[nodeType as keyof typeof NODE_COMPONENT_REGISTRY];
  if (!entry) return null;

  // Import and return default config
  switch (nodeType) {
    // Logic
    case 'conditional':
      return DEFAULT_CONDITIONAL_CONFIG;
    case 'switch':
      return DEFAULT_SWITCH_CONFIG;

    // HTTP
    case 'http-get':
    case 'http-post':
    case 'http-put':
    case 'http-delete':
      return { ...DEFAULT_HTTP_CONFIG, method: nodeType.split('-')[1].toUpperCase() };

    // Storage
    case 'kv-get':
      return DEFAULT_KV_GET_CONFIG;
    case 'kv-set':
      return DEFAULT_KV_SET_CONFIG;

    // Triggers
    case 'trigger':
      return DEFAULT_MANUAL_TRIGGER_CONFIG;
    case 'webhook':
      return DEFAULT_WEBHOOK_TRIGGER_CONFIG;
    case 'schedule':
      return DEFAULT_SCHEDULE_TRIGGER_CONFIG;

    // Docker
    case 'docker-run':
      return DEFAULT_DOCKER_CONFIG;

    default:
      return null;
  }
}
