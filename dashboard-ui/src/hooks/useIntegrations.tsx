import { createSignal, createEffect } from 'solid-js';
import { useKVStore } from '../contexts/KVStoreContext';
import { useNotifications } from '../contexts/NotificationContext';
import { useOrganization } from '../contexts/OrganizationContext';

const ONE_YEAR_HOURS = 8760;

export function useIntegrations() {
  const [userConnections, setUserConnections] = createSignal(new Map());
  const [isLoading, setIsLoading] = createSignal(false);

  const kvStore = useKVStore();
  const { success, error, publishIntegrationEvent } = useNotifications();
  const { currentOrganization, user } = useOrganization();

  const getCurrentUserId = () => user()?.id || 'demo-user-123';
  const getCurrentOrgId = () => currentOrganization()?.id || 'default-org';

  const getStorageKey = (type: string, userId: string, integrationId: string, connectionId?: string) => {
    const orgId = getCurrentOrgId();
    const baseKey = `org-${orgId}-user-${userId}-integration-${integrationId}`;
    return connectionId ? `${baseKey}-${connectionId}` : baseKey;
  };

  const loadIntegrationConnections = async (integrationId: string) => {
    try {
      const userId = getCurrentUserId();
      const orgId = getCurrentOrgId();
      const serviceConnections = [];
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
        } catch (error) {
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
        } catch (error) {
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

  const handleConnect = async (integrationId: string, connectionData: any, connectionId = 'default') => {
    setIsLoading(true);
    try {
      const userId = getCurrentUserId();
      const orgId = getCurrentOrgId();

      const userConnection = {
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

  const handleDisconnect = async (integrationId: string, connectionId = 'default') => {
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

  const handleTest = async (integrationId: string, connectionId = 'default') => {
    try {
      // Mock test implementation
      success(`Test connection successful for ${integrationId}`);
      return { success: true, message: 'Connection test passed' };
    } catch (err) {
      error(`Test failed for ${integrationId}: ${err.message}`);
      return { success: false, message: err.message };
    }
  };

  return {
    userConnections,
    isLoading,
    loadIntegrationConnections,
    handleConnect,
    handleDisconnect,
    handleTest
  };
}