/**
 * Feature Flag Hook
 *
 * Pure feature flag system - no tier coupling in code.
 * Flags are stored in Organization.features and checked dynamically.
 *
 * Usage:
 *   const canUseDocker = useFeatureFlag('nodes.docker-run');
 *   const hasECS = useFeatureFlag('modules.ecs-agents');
 *   const customFlag = useFeatureFlag('beta-ui', (org) => org.settings?.betaEnabled);
 *
 * Feature Flag Namespaces:
 *   - nodes.*        → Workflow node availability
 *   - modules.*      → Infrastructure module availability
 *   - limits.*       → Resource limits
 *   - infra.*        → Infrastructure state
 *   - integrations.* → Connected app capabilities
 *   - Custom flags   → Any other feature
 */

import { createMemo, Accessor } from 'solid-js';
import { useOrganization } from '../contexts/OrganizationContext';
import type { Organization } from '../services/OrganizationService';

export type FeatureFlagKey = string;
export type FeatureFlagValueCheck = (org: Organization) => boolean | number | string | undefined;

/**
 * Check if a feature flag is enabled
 *
 * @param flag - Feature flag key (dot-notation path or custom)
 * @param valueCheckFn - Optional custom check function
 * @returns Accessor returning boolean indicating if feature is enabled
 */
export function useFeatureFlag(
  flag: FeatureFlagKey,
  valueCheckFn?: FeatureFlagValueCheck
): Accessor<boolean> {
  const { currentOrganization } = useOrganization();

  return createMemo(() => {
    const org = currentOrganization();
    if (!org) return false;

    // Custom value check function takes precedence
    if (valueCheckFn) {
      const result = valueCheckFn(org);
      return result === true || result === 'true';
    }

    // Get feature value from organization
    const value = getFeatureFlagValue(org, flag);

    // Interpret as boolean
    return value === true || value === 'true' || value === 1;
  });
}

/**
 * Get feature flag value (any type)
 *
 * @param flag - Feature flag key
 * @returns The feature flag value (boolean, number, string, or undefined)
 */
export function useFeatureFlagValue<T = any>(
  flag: FeatureFlagKey,
  valueCheckFn?: FeatureFlagValueCheck
): Accessor<T | undefined> {
  const { currentOrganization } = useOrganization();

  return createMemo(() => {
    const org = currentOrganization();
    if (!org) return undefined;

    // Custom value check function
    if (valueCheckFn) {
      return valueCheckFn(org) as T;
    }

    // Get feature value from organization
    return getFeatureFlagValue(org, flag) as T;
  });
}

/**
 * Extract feature flag value from organization object
 * Supports dot-notation paths (e.g., 'nodes.docker-run', 'limits.maxWorkflows')
 */
function getFeatureFlagValue(org: Organization, flag: string): any {
  // Check in org.features first
  if (org.features) {
    const value = getNestedValue(org.features, flag);
    if (value !== undefined) return value;
  }

  // Check in top-level org properties
  return getNestedValue(org, flag);
}

/**
 * Get nested value from object using dot notation
 * Supports wildcards: 'org-123.infra-small.*' checks if any key exists
 * Example: getNestedValue(obj, 'nodes.docker-run') → obj.nodes['docker-run']
 * Example: getNestedValue(obj, 'org-123.infra-small.*') → true if any keys exist
 */
function getNestedValue(obj: any, path: string): any {
  const keys = path.split('.');
  let current = obj;

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];

    if (current == null) return undefined;

    // Handle wildcard - check if object has any keys
    if (key === '*') {
      if (typeof current === 'object' && current !== null) {
        const hasKeys = Object.keys(current).length > 0;
        return hasKeys;
      }
      return false;
    }

    current = current[key];
  }

  return current;
}

/**
 * Batch check multiple feature flags
 *
 * @param flags - Array of feature flag keys
 * @returns Object mapping flag keys to boolean values
 */
export function useFeatureFlags(flags: FeatureFlagKey[]): Record<string, boolean> {
  const results: Record<string, boolean> = {};

  for (const flag of flags) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    results[flag] = useFeatureFlag(flag)();
  }

  return results;
}

/**
 * Common feature flag helpers
 */

// Node availability
export function useNodeAvailable(nodeType: string): Accessor<boolean> {
  return useFeatureFlag(`nodes.${nodeType}`);
}

// Module availability
export function useModuleAvailable(moduleName: string): Accessor<boolean> {
  return useFeatureFlag(`modules.${moduleName}`);
}

// Infrastructure state - reads from top-level org.infraState
export function useInfraState(): Accessor<'deploying' | 'deployed' | 'failed' | undefined> {
  return useFeatureFlagValue('infraState');
}

// Check if infrastructure is deployed for org/infra
// Example: useInfraDeployed('org-123', 'infra-small') checks org.features['org-123.infra-small.*']
export function useInfraDeployed(orgId?: string, infraId?: string): Accessor<boolean> {
  const { currentOrganization } = useOrganization();

  return createMemo(() => {
    const org = currentOrganization();
    if (!org) return false;

    // If no IDs provided, assume infrastructure is deployed (TODO: add infraState to Organization type)
    if (!orgId || !infraId) {
      return true;
    }

    // Check if org.features has any keys at org-{orgId}.infra-{infraId}.*
    const flagAccessor = useFeatureFlag(`${orgId}.${infraId}.*`);
    return flagAccessor();
  });
}

// Resource limits
export function useFeatureLimit(limitName: string): Accessor<number | undefined> {
  return useFeatureFlagValue(`limits.${limitName}`);
}

/**
 * Example Organization.features structure:
 *
 * {
 *   features: {
 *     // Workspace tier flags (set by backend based on subscription)
 *     nodes: {
 *       'trigger': true,
 *       'http-get': true,
 *       'docker-run': false,  // Requires upgrade
 *       'vector-search': false
 *     },
 *     modules: {
 *       'ecs-agents': false,
 *       'vector-pg': false,
 *       'step-functions': false
 *     },
 *     limits: {
 *       maxWorkflows: 10,
 *       maxNodesPerWorkflow: 20,
 *       maxConcurrentExecutions: 5
 *     },
 *
 *     // Custom feature flags
 *     'beta-ui': true,
 *     'ai-suggestions': false,
 *     'custom-branding': false
 *   },
 *
 *   // Infrastructure state (top-level)
 *   infraState: 'deployed',
 *   workspaceTier: 'small'  // Metadata only, not used for feature checks
 * }
 */
