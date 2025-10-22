/**
 * Tenant-Scoped Node Configuration
 *
 * Allows organizations to:
 * - Enable/disable specific node types
 * - Override default configurations
 * - Customize field options and defaults
 * - Set organization-wide policies
 *
 * Configuration is stored in KV store with tenant isolation:
 * Key: `tenant-{tenantId}-node-config-{nodeType}`
 */

import type { NodeDefinition, NodeField } from './NodeRegistry';
import { getNodeDefinition } from './NodeRegistry';

/**
 * Tenant-specific node configuration overrides
 */
export interface TenantNodeConfig {
  // Metadata
  tenantId: string;
  nodeType: string;
  updatedAt: string;
  updatedBy: string;

  // Availability
  enabled?: boolean; // If false, node is hidden for this tenant

  // Configuration overrides
  defaultConfig?: Record<string, any>; // Override default values
  fieldOverrides?: {
    [fieldKey: string]: {
      hidden?: boolean; // Hide this field
      required?: boolean; // Override required status
      defaultValue?: any; // Override default value
      options?: Array<{ label: string; value: any }>; // Override options for select fields
      help?: string; // Override help text
    };
  };

  // Policy enforcement
  policies?: {
    requireApproval?: boolean; // Require approval to use this node
    maxExecutionsPerDay?: number; // Rate limiting
    allowedUsers?: string[]; // Only specific users can use
    allowedRoles?: string[]; // Only specific roles can use
  };

  // Integration settings
  integrationOverrides?: {
    requiresCredentials?: boolean;
    defaultCredentialId?: string; // Pre-select specific credential
  };
}

/**
 * Service for managing tenant node configurations
 */
export class TenantNodeConfigService {
  private kvStore: any; // KVStore instance from context
  private cache: Map<string, TenantNodeConfig> = new Map();

  constructor(kvStore: any) {
    this.kvStore = kvStore;
  }

  /**
   * Get configuration key for KV store
   */
  private getConfigKey(tenantId: string, nodeType: string): string {
    return `tenant-${tenantId}-node-config-${nodeType}`;
  }

  /**
   * Get tenant configuration for a node
   */
  async getTenantNodeConfig(
    tenantId: string,
    nodeType: string
  ): Promise<TenantNodeConfig | null> {
    // Check cache first
    const cacheKey = `${tenantId}:${nodeType}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    try {
      const key = this.getConfigKey(tenantId, nodeType);
      const result = await this.kvStore.get(key);

      if (result?.value) {
        const config = JSON.parse(result.value) as TenantNodeConfig;
        this.cache.set(cacheKey, config);
        return config;
      }
    } catch (error) {
      console.error(`Failed to load tenant config for ${nodeType}:`, error);
    }

    return null;
  }

  /**
   * Save tenant configuration for a node
   */
  async saveTenantNodeConfig(
    config: TenantNodeConfig
  ): Promise<void> {
    const key = this.getConfigKey(config.tenantId, config.nodeType);

    try {
      await this.kvStore.set(
        key,
        JSON.stringify({
          ...config,
          updatedAt: new Date().toISOString()
        }),
        24 * 30 // 30 days TTL
      );

      // Update cache
      const cacheKey = `${config.tenantId}:${config.nodeType}`;
      this.cache.set(cacheKey, config);
    } catch (error) {
      console.error(`Failed to save tenant config for ${config.nodeType}:`, error);
      throw error;
    }
  }

  /**
   * Delete tenant configuration for a node
   */
  async deleteTenantNodeConfig(
    tenantId: string,
    nodeType: string
  ): Promise<void> {
    const key = this.getConfigKey(tenantId, nodeType);

    try {
      await this.kvStore.delete(key);

      // Clear cache
      const cacheKey = `${tenantId}:${nodeType}`;
      this.cache.delete(cacheKey);
    } catch (error) {
      console.error(`Failed to delete tenant config for ${nodeType}:`, error);
      throw error;
    }
  }

  /**
   * Get all tenant configurations
   */
  async getAllTenantNodeConfigs(tenantId: string): Promise<TenantNodeConfig[]> {
    // Note: This would require a KV scan or list operation
    // For now, return empty array - implement when KV supports prefix queries
    return [];
  }

  /**
   * Apply tenant configuration to a node definition
   * Returns a new NodeDefinition with tenant-specific overrides applied
   */
  async applyTenantConfig(
    tenantId: string,
    baseDefinition: NodeDefinition
  ): Promise<NodeDefinition & { isAvailable: boolean }> {
    const tenantConfig = await this.getTenantNodeConfig(tenantId, baseDefinition.type);

    // If no tenant config, return base definition
    if (!tenantConfig) {
      return {
        ...baseDefinition,
        isAvailable: true
      };
    }

    // Check if node is disabled for this tenant
    if (tenantConfig.enabled === false) {
      return {
        ...baseDefinition,
        isAvailable: false
      };
    }

    // Apply overrides
    const modified: NodeDefinition = {
      ...baseDefinition,
      // Override default config
      defaultConfig: {
        ...(baseDefinition.defaultConfig || {}),
        ...(tenantConfig.defaultConfig || {})
      },
      // Override integration settings
      requiresCredentials: tenantConfig.integrationOverrides?.requiresCredentials ??
        baseDefinition.requiresCredentials
    };

    // Apply field overrides
    if (tenantConfig.fieldOverrides && modified.fields) {
      modified.fields = modified.fields
        .map(field => {
          const override = tenantConfig.fieldOverrides![field.key];
          if (!override) return field;

          // Skip hidden fields
          if (override.hidden) return null;

          return {
            ...field,
            required: override.required ?? field.required,
            defaultValue: override.defaultValue ?? field.defaultValue,
            options: override.options ?? field.options,
            help: override.help ?? field.help
          };
        })
        .filter(field => field !== null) as NodeField[];
    }

    return {
      ...modified,
      isAvailable: true
    };
  }

  /**
   * Check if a user has permission to use a node
   */
  async canUserUseNode(
    tenantId: string,
    nodeType: string,
    userId: string,
    userRoles: string[]
  ): Promise<{ allowed: boolean; reason?: string }> {
    const tenantConfig = await this.getTenantNodeConfig(tenantId, nodeType);

    if (!tenantConfig) {
      return { allowed: true };
    }

    // Check if node is disabled
    if (tenantConfig.enabled === false) {
      return {
        allowed: false,
        reason: 'This node has been disabled by your organization'
      };
    }

    // Check user allowlist
    if (tenantConfig.policies?.allowedUsers) {
      if (!tenantConfig.policies.allowedUsers.includes(userId)) {
        return {
          allowed: false,
          reason: 'You do not have permission to use this node'
        };
      }
    }

    // Check role allowlist
    if (tenantConfig.policies?.allowedRoles) {
      const hasAllowedRole = userRoles.some(role =>
        tenantConfig.policies!.allowedRoles!.includes(role)
      );

      if (!hasAllowedRole) {
        return {
          allowed: false,
          reason: 'Your role does not have permission to use this node'
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Clear cache for a tenant (call when tenant settings change)
   */
  clearTenantCache(tenantId: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${tenantId}:`)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear entire cache
   */
  clearAllCache(): void {
    this.cache.clear();
  }
}

/**
 * Example tenant configuration
 */
export const EXAMPLE_TENANT_CONFIG: TenantNodeConfig = {
  tenantId: 'org-acme-corp',
  nodeType: 'http-request',
  updatedAt: '2025-10-07T10:00:00Z',
  updatedBy: 'admin@acme.com',

  // Enable the node
  enabled: true,

  // Override default URL to internal API gateway
  defaultConfig: {
    baseUrl: 'https://api.acme.internal',
    timeout: 30000
  },

  // Customize fields
  fieldOverrides: {
    url: {
      help: 'Use relative URLs - will be prefixed with https://api.acme.internal',
      defaultValue: '/api/v1/'
    },
    method: {
      // Restrict to safe methods only
      options: [
        { label: 'GET', value: 'GET' },
        { label: 'POST', value: 'POST' }
      ]
    },
    authentication: {
      // Pre-select company credential
      defaultValue: 'company-api-key'
    }
  },

  // Add policies
  policies: {
    requireApproval: false,
    maxExecutionsPerDay: 10000,
    allowedRoles: ['developer', 'admin']
  }
};
