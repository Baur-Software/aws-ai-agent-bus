/**
 * Workspace Tier System
 *
 * Maps infrastructure capabilities to subscription tiers.
 * Organizations are provisioned with a specific workspace tier that determines
 * which AWS services and workflow nodes are available.
 *
 * Based on actual infra/workspaces structure:
 * - extra-small: Minimal infrastructure
 * - small: Basic AWS components (DynamoDB, S3, EventBridge, Secrets)
 * - medium: ECS agents, Step Functions, CloudWatch observability
 * - large: Aurora pgvector, advanced analytics
 */

export enum WorkspaceTier {
  EXTRA_SMALL = 'extra-small',
  SMALL = 'small',
  MEDIUM = 'medium',
  LARGE = 'large'
}

/**
 * Infrastructure capabilities available per workspace tier
 */
export interface TierCapabilities {
  tier: WorkspaceTier;
  displayName: string;
  description: string;
  monthlyEstimate: string;

  // Infrastructure modules (from infra/workspaces/)
  modules: {
    // Small tier
    kvStore: boolean;              // small/kv_store
    artifactsBucket: boolean;      // small/artifacts_bucket
    eventBus: boolean;             // small/event_bus
    eventsMonitoring: boolean;     // small/events_monitoring
    secrets: boolean;              // small/secrets
    timelineStore: boolean;        // small/timeline_store
    dashboardService: boolean;     // small/dashboard_service

    // Medium tier
    ecsAgents: boolean;            // medium/mesh_agents (ECS tasks)
    observability: boolean;        // medium/observability (CloudWatch)
    workflow: boolean;             // medium/workflow (Step Functions)

    // Large tier
    vectorPg: boolean;             // large/vector_pg (Aurora + pgvector)
  };

  // Workflow node categories
  nodes: {
    basic: boolean;            // All tiers (trigger, http, kv, events)
    compute: boolean;          // Medium+ (docker via ECS)
    orchestration: boolean;    // Medium+ (step functions)
    vectorDb: boolean;         // Large (pgvector queries)
  };

  // Resource limits
  limits: {
    maxWorkflows: number;
    maxNodesPerWorkflow: number;
    maxConcurrentExecutions: number;
    storageGB: number;
    requestsPerMinute: number;
  };
}

/**
 * Tier configuration definitions
 */
export const TIER_CONFIGS: Record<WorkspaceTier, TierCapabilities> = {
  [WorkspaceTier.EXTRA_SMALL]: {
    tier: WorkspaceTier.EXTRA_SMALL,
    displayName: 'Extra Small',
    description: 'Minimal infrastructure for testing',
    monthlyEstimate: '~$5/month',

    modules: {
      kvStore: false,
      artifactsBucket: false,
      eventBus: false,
      eventsMonitoring: false,
      secrets: false,
      timelineStore: false,
      dashboardService: false,
      ecsAgents: false,
      observability: false,
      workflow: false,
      vectorPg: false
    },

    nodes: {
      basic: false,
      compute: false,
      orchestration: false,
      vectorDb: false
    },

    limits: {
      maxWorkflows: 1,
      maxNodesPerWorkflow: 5,
      maxConcurrentExecutions: 1,
      storageGB: 1,
      requestsPerMinute: 10
    }
  },

  [WorkspaceTier.SMALL]: {
    tier: WorkspaceTier.SMALL,
    displayName: 'Small',
    description: 'Basic AWS components for simple workflows',
    monthlyEstimate: '~$10/month',

    modules: {
      kvStore: true,
      artifactsBucket: true,
      eventBus: true,
      eventsMonitoring: true,
      secrets: true,
      timelineStore: true,
      dashboardService: true,
      ecsAgents: false,
      observability: false,
      workflow: false,
      vectorPg: false
    },

    nodes: {
      basic: true,
      compute: false,
      orchestration: false,
      vectorDb: false
    },

    limits: {
      maxWorkflows: 10,
      maxNodesPerWorkflow: 20,
      maxConcurrentExecutions: 5,
      storageGB: 10,
      requestsPerMinute: 60
    }
  },

  [WorkspaceTier.MEDIUM]: {
    tier: WorkspaceTier.MEDIUM,
    displayName: 'Medium',
    description: 'ECS agents, workflows, and observability',
    monthlyEstimate: '~$100/month',

    modules: {
      kvStore: true,
      artifactsBucket: true,
      eventBus: true,
      eventsMonitoring: true,
      secrets: true,
      timelineStore: true,
      dashboardService: true,
      ecsAgents: true,
      observability: true,
      workflow: true,
      vectorPg: false
    },

    nodes: {
      basic: true,
      compute: true,
      orchestration: true,
      vectorDb: false
    },

    limits: {
      maxWorkflows: 100,
      maxNodesPerWorkflow: 100,
      maxConcurrentExecutions: 50,
      storageGB: 100,
      requestsPerMinute: 600
    }
  },

  [WorkspaceTier.LARGE]: {
    tier: WorkspaceTier.LARGE,
    displayName: 'Large',
    description: 'Full platform with vector database',
    monthlyEstimate: '~$1000/month',

    modules: {
      kvStore: true,
      artifactsBucket: true,
      eventBus: true,
      eventsMonitoring: true,
      secrets: true,
      timelineStore: true,
      dashboardService: true,
      ecsAgents: true,
      observability: true,
      workflow: true,
      vectorPg: true
    },

    nodes: {
      basic: true,
      compute: true,
      orchestration: true,
      vectorDb: true
    },

    limits: {
      maxWorkflows: -1, // Unlimited
      maxNodesPerWorkflow: -1,
      maxConcurrentExecutions: -1,
      storageGB: -1,
      requestsPerMinute: -1
    }
  }
};

/**
 * Node type to required tier mapping
 */
export const NODE_TIER_REQUIREMENTS: Record<string, WorkspaceTier> = {
  // Small tier (basic nodes - uses DynamoDB, S3, EventBridge)
  'trigger': WorkspaceTier.SMALL,
  'webhook': WorkspaceTier.SMALL,
  'schedule': WorkspaceTier.SMALL,
  'http-get': WorkspaceTier.SMALL,
  'http-post': WorkspaceTier.SMALL,
  'http-put': WorkspaceTier.SMALL,
  'http-delete': WorkspaceTier.SMALL,
  'kv-get': WorkspaceTier.SMALL,
  'kv-set': WorkspaceTier.SMALL,
  'events-send': WorkspaceTier.SMALL,
  'artifacts-get': WorkspaceTier.SMALL,
  'artifacts-put': WorkspaceTier.SMALL,
  'artifacts-list': WorkspaceTier.SMALL,
  'conditional': WorkspaceTier.SMALL,
  'switch': WorkspaceTier.SMALL,
  'delay': WorkspaceTier.SMALL,
  'json-parse': WorkspaceTier.SMALL,
  'filter': WorkspaceTier.SMALL,
  'output': WorkspaceTier.SMALL,

  // Medium tier (requires ECS - medium/mesh_agents)
  'docker-run': WorkspaceTier.MEDIUM,
  'agent': WorkspaceTier.MEDIUM,
  'agent-conductor': WorkspaceTier.MEDIUM,

  // Medium tier (requires Step Functions - medium/workflow)
  'step-function': WorkspaceTier.MEDIUM,
  'workflow-invoke': WorkspaceTier.MEDIUM,

  // Large tier (requires Aurora pgvector - large/vector_pg)
  'vector-search': WorkspaceTier.LARGE,
  'vector-upsert': WorkspaceTier.LARGE,
  'pg-query': WorkspaceTier.LARGE
};

/**
 * Get tier configuration
 */
export function getTierConfig(tier: WorkspaceTier): TierCapabilities {
  return TIER_CONFIGS[tier];
}

/**
 * Check if organization tier supports a node type
 */
export function tierSupportsNode(orgTier: WorkspaceTier, nodeType: string): boolean {
  const requiredTier = NODE_TIER_REQUIREMENTS[nodeType];

  // If node has no tier requirement, it's available to all
  if (!requiredTier) return true;

  // Check tier hierarchy: extra-small < small < medium < large
  const tierHierarchy = {
    [WorkspaceTier.EXTRA_SMALL]: 0,
    [WorkspaceTier.SMALL]: 1,
    [WorkspaceTier.MEDIUM]: 2,
    [WorkspaceTier.LARGE]: 3
  };

  return tierHierarchy[orgTier] >= tierHierarchy[requiredTier];
}

/**
 * Check if organization tier has a specific module
 */
export function tierHasModule(tier: WorkspaceTier, module: keyof TierCapabilities['modules']): boolean {
  return TIER_CONFIGS[tier].modules[module];
}

/**
 * Get required tier for a node type
 */
export function getRequiredTierForNode(nodeType: string): WorkspaceTier | null {
  return NODE_TIER_REQUIREMENTS[nodeType] || null;
}

/**
 * Get available nodes for a tier
 */
export function getAvailableNodesForTier(tier: WorkspaceTier): string[] {
  return Object.entries(NODE_TIER_REQUIREMENTS)
    .filter(([nodeType, _]) => tierSupportsNode(tier, nodeType))
    .map(([nodeType]) => nodeType);
}

/**
 * Get unavailable nodes for a tier (for upgrade prompts)
 */
export function getUnavailableNodesForTier(tier: WorkspaceTier): Array<{ nodeType: string; requiredTier: WorkspaceTier }> {
  return Object.entries(NODE_TIER_REQUIREMENTS)
    .filter(([nodeType, _]) => !tierSupportsNode(tier, nodeType))
    .map(([nodeType, requiredTier]) => ({ nodeType, requiredTier }));
}
