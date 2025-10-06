/**
 * Credential Resolver for Workflow Nodes
 *
 * Retrieves credentials for workflow nodes that require authentication.
 * Credentials are stored in KV store with context-specific keys.
 */

import type { KVStoreService } from '../contexts/KVStoreContext';

export interface ResolvedCredentials {
  connectionId: string;
  organizationId?: string;
  userId?: string;
  connectedAt: string;
  [key: string]: any; // Service-specific credential fields
}

export interface CredentialResolverOptions {
  kvStore: KVStoreService;
}

/**
 * Resolve credentials using a complete storage key
 *
 * @param storageKey - The complete KV store key for credentials
 * @param options - KV store service
 * @returns Resolved credentials or null if not found
 */
export async function resolveCredentialsByKey(
  storageKey: string,
  options: CredentialResolverOptions
): Promise<ResolvedCredentials | null> {
  const { kvStore } = options;

  try {
    const credentials = await kvStore.get(storageKey);

    if (!credentials) {
      console.warn(`No credentials found at key: ${storageKey}`);
      return null;
    }

    return credentials as ResolvedCredentials;
  } catch (error) {
    console.error(`Failed to resolve credentials at ${storageKey}:`, error);
    return null;
  }
}

/**
 * Resolve credentials for a workflow node config
 *
 * The node config must contain the complete storage key for credentials
 *
 * @param nodeConfig - The workflow node configuration (must contain credentialKey)
 * @param options - KV store service
 * @returns Resolved credentials or null if not found
 */
export async function resolveNodeCredentials(
  nodeConfig: Record<string, any>,
  options: CredentialResolverOptions
): Promise<ResolvedCredentials | null> {
  // Node config should have the full credential key
  // Example: "org-acme-user-alice-integration-slack-work"
  const credentialKey = nodeConfig.credentialKey;

  if (!credentialKey) {
    console.warn('Node config missing credentialKey');
    return null;
  }

  return resolveCredentialsByKey(credentialKey, options);
}

/**
 * Build a credential storage path
 *
 * Helper to construct the KV store path for credentials.
 * The caller must provide the correct context (org or user).
 *
 * @param integrationId - The integration/service ID
 * @param connectionId - The connection ID
 * @param context - Either { orgId, userId } for org context or { userId } for personal context
 * @returns The KV store path
 */
export function buildCredentialPath(
  integrationId: string,
  connectionId: string,
  context: { orgId?: string; userId: string }
): string {
  if (context.orgId) {
    // Organization context
    return `org-${context.orgId}-user-${context.userId}-integration-${integrationId}-${connectionId}`;
  } else {
    // Personal context
    return `user-${context.userId}-integration-${integrationId}-${connectionId}`;
  }
}

/**
 * Check if credentials exist at a storage path
 *
 * @param storagePath - The complete KV store path
 * @param options - KV store service
 * @returns True if credentials exist
 */
export async function hasCredentials(
  storagePath: string,
  options: CredentialResolverOptions
): Promise<boolean> {
  const credentials = await resolveCredentialsByKey(storagePath, options);
  return credentials !== null;
}

/**
 * Validate node has required credentials before execution
 *
 * @param nodeConfig - The workflow node configuration
 * @param integrationId - The integration/service ID (for error messages)
 * @param options - KV store service
 * @throws Error if credentials are missing or invalid
 */
export async function validateNodeCredentials(
  nodeConfig: Record<string, any>,
  integrationId: string,
  options: CredentialResolverOptions
): Promise<void> {
  const credentialPath = nodeConfig.credentialPath;

  if (!credentialPath) {
    throw new Error(
      `Node configuration missing credentialPath for ${integrationId}. ` +
      `Please configure credentials in the node settings.`
    );
  }

  const credentials = await resolveCredentialsByKey(credentialPath, options);

  if (!credentials) {
    throw new Error(
      `No credentials found for ${integrationId}. ` +
      `Please connect your ${integrationId} account in Settings > Integrations.`
    );
  }
}

/**
 * Example usage:
 *
 * // Building a credential path (in node configuration UI)
 * const credentialPath = buildCredentialPath('slack', 'work', {
 *   orgId: currentOrg.id,
 *   userId: currentUser.id
 * });
 *
 * // Storing in node config
 * nodeConfig.credentialPath = credentialPath;
 *
 * // Resolving credentials (in workflow execution)
 * const credentials = await resolveNodeCredentials(nodeConfig, { kvStore });
 * if (credentials) {
 *   // Use credentials.apiKey, credentials.accessToken, etc.
 * }
 */
