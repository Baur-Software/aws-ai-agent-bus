import { createContext, useContext, createSignal, createMemo, JSX } from 'solid-js';
import { useKVStore } from './KVStoreContext';
import { useNotifications } from './NotificationContext';
import { useOrganization } from './OrganizationContext';
import { mcpRegistry } from '../services/MCPCapabilityRegistry';
import type { MCPServerListing } from '../types/mcpCatalog';

const ONE_YEAR_HOURS = 8760;

interface IntegrationConnection {
  connection_id: string;
  connection_name?: string;
  organization_id: string;
  user_id: string;
  connected_at: string;
  [key: string]: any;
}

interface IntegrationsContextType {
  // State getters
  userConnections: () => Map<string, IntegrationConnection[]>;
  isLoading: () => boolean;

  // Data getters
  getConnectionsForIntegration: (integrationId: string) => IntegrationConnection[];
  getAllConnections: () => Record<string, IntegrationConnection[]>;
  hasConnection: (integrationId: string) => boolean;
  getConnectionCount: (integrationId: string) => number;

  // Actions
  loadIntegrationConnections: (integrationId: string) => Promise<IntegrationConnection[]>;
  connectIntegration: (integrationId: string, connectionData: any, connectionId?: string) => Promise<void>;
  disconnectIntegration: (integrationId: string, connectionId?: string) => Promise<void>;
  testConnection: (integrationId: string, connectionId?: string) => Promise<{ success: boolean; message: string }>;
}

const IntegrationsContext = createContext<IntegrationsContextType>();

export function IntegrationsProvider(props: { children: JSX.Element }) {
  const [userConnections, setUserConnections] = createSignal(new Map<string, IntegrationConnection[]>());
  const [isLoading, setIsLoading] = createSignal(false);

  const kvStore = useKVStore();
  const { success, error, publishIntegrationEvent } = useNotifications();
  const { currentOrganization, user } = useOrganization();

  // Helper functions
  const getCurrentUserId = () => user()?.id || 'demo-user-123';
  const getCurrentOrgId = () => currentOrganization()?.id || 'default-org';

  const getStorageKey = (type: string, userId: string, integrationId: string, connectionId?: string) => {
    const orgId = getCurrentOrgId();
    const baseKey = `org-${orgId}-user-${userId}-integration-${integrationId}`;
    return connectionId ? `${baseKey}-${connectionId}` : baseKey;
  };

  // Data getters
  const getConnectionsForIntegration = (integrationId: string): IntegrationConnection[] => {
    return userConnections().get(integrationId) || [];
  };

  const hasConnection = (integrationId: string): boolean => {
    return getConnectionsForIntegration(integrationId).length > 0;
  };

  const getConnectionCount = (integrationId: string): number => {
    return getConnectionsForIntegration(integrationId).length;
  };

  const getAllConnections = (): Record<string, IntegrationConnection[]> => {
    const connections: Record<string, IntegrationConnection[]> = {};
    const connectionsMap = userConnections();

    // Convert Map to Record for easier access
    connectionsMap.forEach((connectionsList, integrationId) => {
      if (connectionsList.length > 0) {
        connections[integrationId] = connectionsList;
      }
    });

    return connections;
  };

  // Actions
  const loadIntegrationConnections = async (integrationId: string): Promise<IntegrationConnection[]> => {
    try {
      const userId = getCurrentUserId();
      const orgId = getCurrentOrgId();
      const serviceConnections: IntegrationConnection[] = [];
      const connectionIds = ['default', 'work', 'personal', 'backup'];

      // Load current connections
      for (const connectionId of connectionIds) {
        try {
          const key = getStorageKey('connection', userId, integrationId, connectionId);
          const connection = await kvStore.get(key);
          if (connection) {
            connection.organization_id = orgId;
            connection.user_id = userId;
            serviceConnections.push(connection);
          }
        } catch {
          // Connection doesn't exist, continue
        }
      }

      // Check for legacy connections and migrate them
      for (const connectionId of connectionIds) {
        try {
          const legacyKey = `user-${userId}-integration-${integrationId}-${connectionId}`;
          const legacyConnection = await kvStore.get(legacyKey);
          if (legacyConnection && !serviceConnections.find(c => c.connection_id === connectionId)) {
            legacyConnection.organization_id = orgId;
            legacyConnection.user_id = userId;
            legacyConnection.connection_id = connectionId;

            const newKey = getStorageKey('connection', userId, integrationId, connectionId);
            await kvStore.set(newKey, legacyConnection, ONE_YEAR_HOURS, { showNotification: false });
            serviceConnections.push(legacyConnection);
          }
        } catch {
          // Legacy connection doesn't exist, continue
        }
      }

      // Update the connections for this specific integration
      const currentConnections = userConnections();
      currentConnections.set(integrationId, serviceConnections);
      setUserConnections(new Map(currentConnections));

      return serviceConnections;
    } catch (err) {
      console.error('Failed to load integration connections:', err);
      throw err;
    }
  };

  const connectIntegration = async (integrationId: string, connectionData: any, connectionId = 'default'): Promise<void> => {
    setIsLoading(true);
    try {
      const userId = getCurrentUserId();
      const orgId = getCurrentOrgId();

      const userConnection: IntegrationConnection = {
        ...connectionData,
        connection_id: connectionId,
        organization_id: orgId,
        user_id: userId,
        connected_at: new Date().toISOString(),
      };

      const storageKey = getStorageKey('connection', userId, integrationId, connectionId);
      await kvStore.set(storageKey, userConnection, ONE_YEAR_HOURS);

      // Load the integration configuration to get metadata for MCP registry
      const integrationConfig = await loadIntegrationConfig(integrationId, orgId, userId);

      // Register with MCP capability registry to create agents and workflow nodes
      if (integrationConfig) {
        await registerIntegrationCapabilities(integrationId, integrationConfig);
      }

      await publishIntegrationEvent(integrationId, 'connected', {
        connection_id: connectionId,
        service: integrationId,
        organization_id: orgId,
        user_id: userId,
        has_agents: !!integrationConfig,
        has_nodes: !!integrationConfig
      });

      await loadIntegrationConnections(integrationId);
      success(`Connected ${integrationId} successfully!`);
    } catch (err) {
      error(`Failed to connect integration: ${err.message}`);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const disconnectIntegration = async (integrationId: string, connectionId = 'default'): Promise<void> => {
    try {
      const userId = getCurrentUserId();
      const orgId = getCurrentOrgId();

      const storageKey = getStorageKey('connection', userId, integrationId, connectionId);
      await kvStore.del(storageKey);

      // Unregister from MCP capability registry
      await mcpRegistry.unregisterApp(integrationId);

      await publishIntegrationEvent(integrationId, 'disconnected', {
        connection_id: connectionId,
        service: integrationId,
        organization_id: orgId,
        user_id: userId
      });

      await loadIntegrationConnections(integrationId);
      success(`Disconnected ${integrationId} successfully!`);
    } catch (err) {
      error(`Failed to disconnect integration: ${err.message}`);
    }
  };

  // Helper function to load integration configuration from KV store
  const loadIntegrationConfig = async (integrationId: string, orgId: string, userId: string): Promise<any | null> => {
    try {
      // Try org-specific config first
      let configKey = `org-${orgId}-integration-${integrationId}`;
      let config = await kvStore.get(configKey);

      if (config) {
        return config;
      }

      // Try user-specific config
      configKey = `user-${userId}-integration-${integrationId}`;
      config = await kvStore.get(configKey);

      if (config) {
        return config;
      }

      // Try global integration config
      configKey = `integration-${integrationId}`;
      config = await kvStore.get(configKey);

      return config || null;
    } catch (err) {
      console.warn(`Failed to load integration config for ${integrationId}:`, err);
      return null;
    }
  };

  // Helper function to register integration capabilities with MCP registry
  const registerIntegrationCapabilities = async (integrationId: string, config: any): Promise<void> => {
    try {
      // Convert integration config to MCPServerListing format
      const serverListing: MCPServerListing = {
        id: integrationId,
        name: config.name || integrationId,
        description: config.description || `Integration for ${config.name || integrationId}`,
        publisher: config.publisher || 'User',
        version: config.version || '1.0.0',

        // Verification
        isOfficial: config.isOfficial || false,
        isSigned: config.isSigned || false,
        verificationBadges: config.verificationBadges || [],

        // Repository and metadata
        repository: config.repository || config.serverUrl || config.docsUrl || '',
        homepage: config.homepage || config.serverUrl || config.docsUrl,
        documentation: config.documentation || config.docsUrl,
        downloadCount: config.downloadCount || 0,
        starCount: config.starCount || 0,
        lastUpdated: new Date(config.updated_at || config.created_at || Date.now()),

        // Categorization
        category: config.category || 'Other',
        tags: config.tags || [],

        // Configuration
        configurationSchema: config.ui_fields || config.fields || [],
        authMethods: config.authMethods || ['none'],

        // Runtime information
        toolCount: config.toolCount || 0,
        capabilities: config.capabilities || [],

        // Workflow integration from config
        workflowNodes: config.workflowNodes || [],
        workflowNodeDetails: config.workflowNodeDetails || [],
        specializedAgents: config.specializedAgents || [],
        specializedAgentDetails: config.specializedAgentDetails || [],
        nodeShapes: config.nodeShapes || [],
        canExecuteAgents: config.canExecuteAgents !== false,
        dataInputTypes: config.dataInputTypes || ['json'],
        dataOutputTypes: config.dataOutputTypes || ['json'],

        // Installation
        installCommand: config.installCommand,
        npmPackage: config.npmPackage,
        dockerImage: config.dockerImage
      };

      // Register with MCP capability registry
      await mcpRegistry.registerApp(serverListing);

      console.log(`✅ Registered ${integrationId} with MCP capability registry:`, {
        agents: mcpRegistry.getAgents().filter(a => a.serverId === integrationId).length,
        nodes: mcpRegistry.getNodes(integrationId).length
      });
    } catch (err) {
      console.error(`Failed to register integration capabilities for ${integrationId}:`, err);
      throw err;
    }
  };

  const testConnection = async (integrationId: string, connectionId = 'default'): Promise<{ success: boolean; message: string }> => {
    try {
      // Mock test implementation - in real app would test actual connection
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      success(`Test connection successful for ${integrationId}`);
      return { success: true, message: 'Connection test passed' };
    } catch (err) {
      error(`Test failed for ${integrationId}: ${err.message}`);
      return { success: false, message: err.message };
    }
  };

  const contextValue: IntegrationsContextType = {
    // State getters
    userConnections,
    isLoading,

    // Data getters
    getConnectionsForIntegration,
    getAllConnections,
    hasConnection,
    getConnectionCount,

    // Actions
    loadIntegrationConnections,
    connectIntegration,
    disconnectIntegration,
    testConnection
  };

  return (
    <IntegrationsContext.Provider value={contextValue}>
      {props.children}
    </IntegrationsContext.Provider>
  );
}

export function useIntegrations(): IntegrationsContextType {
  const context = useContext(IntegrationsContext);
  if (!context) {
    throw new Error('useIntegrations must be used within an IntegrationsProvider');
  }
  return context;
}