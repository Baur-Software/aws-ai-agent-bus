/**
 * Workspace Tier Hook
 *
 * Provides access to organization workspace tier using a proxy-based API.
 * Subscribe to node availability changes via event system.
 */

import { createMemo } from 'solid-js';
import { useOrganization } from '../contexts/OrganizationContext';
import {
  WorkspaceTier,
  getTierConfig,
  tierSupportsNode,
  getRequiredTierForNode,
  type TierCapabilities
} from '../types/workspaceTiers';

export interface WorkspaceTierAPI {
  tier: WorkspaceTier;
  config: TierCapabilities;
  nodes: NodeAvailabilityProxy;
  modules: ModuleAvailabilityProxy;
  limits: TierCapabilities['limits'];
}

/**
 * Proxy for checking node availability
 * Usage: tier.nodes.docker-run → true/false
 */
type NodeAvailabilityProxy = {
  [nodeType: string]: boolean;
};

/**
 * Proxy for checking module availability
 * Usage: tier.modules.ecsAgents → true/false
 */
type ModuleAvailabilityProxy = {
  [K in keyof TierCapabilities['modules']]: boolean;
};

export function useWorkspaceTier(): WorkspaceTierAPI {
  const { currentOrganization } = useOrganization();

  // Get current tier (defaults to 'small' if not set)
  const tier = createMemo<WorkspaceTier>(() => {
    const org = currentOrganization();
    return (org?.workspaceTier as WorkspaceTier) || WorkspaceTier.SMALL;
  });

  // Get tier configuration
  const config = createMemo(() => getTierConfig(tier()));

  // Create proxy for node availability
  const nodes = new Proxy({} as NodeAvailabilityProxy, {
    get(_target, nodeType: string) {
      return tierSupportsNode(tier(), nodeType);
    }
  });

  // Create proxy for module availability
  const modules = new Proxy({} as ModuleAvailabilityProxy, {
    get(_target, module: string) {
      return config().modules[module as keyof TierCapabilities['modules']] || false;
    }
  });

  return {
    tier: tier(),
    config: config(),
    nodes,
    modules,
    limits: config().limits
  };
}

/**
 * Get required tier for a node type (for upgrade prompts)
 */
export function getNodeRequiredTier(nodeType: string): WorkspaceTier | null {
  return getRequiredTierForNode(nodeType);
}
