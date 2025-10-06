/**
 * Workflow Nodes Module
 *
 * This module provides dedicated components for workflow node configuration.
 * Each node type has its own component instead of using generic array-based rendering.
 *
 * Benefits:
 * - Better performance (no large array iterations)
 * - Type-safe configuration interfaces
 * - Rich, dedicated UIs for complex node types
 * - Easier to maintain and extend
 */

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
