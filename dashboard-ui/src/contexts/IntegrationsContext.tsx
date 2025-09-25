import { createContext, useContext, createSignal, createMemo, JSX } from 'solid-js';
import { useKVStore } from './KVStoreContext';
import { useNotifications } from './NotificationContext';
import { useOrganization } from './OrganizationContext';

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

      await publishIntegrationEvent(integrationId, 'connected', {
        connection_id: connectionId,
        service: integrationId,
        organization_id: orgId,
        user_id: userId
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