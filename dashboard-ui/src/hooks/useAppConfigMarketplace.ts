import { createSignal, createEffect } from 'solid-js';
import { useDashboardServer } from '../contexts/DashboardServerContext';
import { useOrganization } from '../contexts/OrganizationContext';
import { useNotifications } from '../contexts/NotificationContext';
import type { AppConfig } from '../contexts/KVStoreContext';
import { MARKETPLACE_CONFIGS } from '../data/appConfigsMarketplace';

/**
 * Hook for managing app config marketplace via events
 * Uses dashboard-server → MCP architecture
 */
export function useAppConfigMarketplace() {
  const [appConfigs, setAppConfigs] = createSignal<AppConfig[]>([]);
  const [isLoading, setIsLoading] = createSignal(true);
  const [lastSeeded, setLastSeeded] = createSignal<string | null>(null);

  const { executeTool } = useDashboardServer();
  const { currentOrganization } = useOrganization();
  const { success, error } = useNotifications();

  // Load configs via events
  const loadConfigs = async (orgId?: string) => {
    try {
      setIsLoading(true);

      // Publish event to load app configs
      await events.send('app-config.load-marketplace', {
        orgId,
        timestamp: new Date().toISOString()
      });

      // For now, try to get configs directly via MCP
      // TODO: Listen for response events when event streaming is implemented
      const configs = await getConfigsViaMCP(orgId);

      if (configs.length === 0) {
        console.log('🌱 Seeding marketplace via events...');
        await seedMarketplaceViaEvents();
        const seededConfigs = await getConfigsViaMCP(orgId);
        setAppConfigs(seededConfigs);
      } else {
        setAppConfigs(configs);
      }
    } catch (err) {
      console.error('Failed to load app configs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Get configs via MCP call
  const getConfigsViaMCP = async (orgId?: string): Promise<AppConfig[]> => {
    try {
      const knownAppIds = MARKETPLACE_CONFIGS.map(c => c.id);
      const configs: AppConfig[] = [];

      for (const appId of knownAppIds) {
        const key = orgId ? `org-${orgId}-app-config-${appId}` : `app-config-${appId}`;
        try {
          const config = await callTool('kv.get', { key });
          if (config) configs.push(config);
        } catch {}

        // Also try global config if org-specific not found
        if (orgId) {
          try {
            const globalConfig = await callTool('kv.get', { key: `app-config-${appId}` });
            if (globalConfig && !configs.find(c => c.id === appId)) {
              configs.push(globalConfig);
            }
          } catch {}
        }
      }

      return configs;
    } catch (err) {
      console.error('Failed to get configs via MCP:', err);
      return [];
    }
  };

  // Seed marketplace via events
  const seedMarketplaceViaEvents = async () => {
    for (const config of MARKETPLACE_CONFIGS) {
      await events.send('app-config.seed', {
        config: {
          ...config,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        key: `app-config-${config.id}`
      });

      // Also store via direct MCP call for immediate availability
      try {
        await callTool('kv.set', {
          key: `app-config-${config.id}`,
          value: {
            ...config,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          ttl_hours: 8760 // 1 year
        });
      } catch (err) {
        console.error(`Failed to seed ${config.name}:`, err);
      }
    }

    setLastSeeded(new Date().toISOString());
    success(`Seeded ${MARKETPLACE_CONFIGS.length} app configs`);
  };

  // Auto-load when org changes
  createEffect(() => {
    const org = currentOrganization();
    if (org) {
      loadConfigs(org.id);
    } else {
      loadConfigs();
    }
  });

  // Search configs (client-side for now)
  const searchConfigs = async (query: string) => {
    const allConfigs = appConfigs();
    const lowerQuery = query.toLowerCase();
    return allConfigs.filter(config =>
      config.name.toLowerCase().includes(lowerQuery) ||
      config.description.toLowerCase().includes(lowerQuery) ||
      config.category.toLowerCase().includes(lowerQuery)
    );
  };

  // Get by category (client-side for now)
  const getByCategory = async (category: string) => {
    const allConfigs = appConfigs();
    return allConfigs.filter(config =>
      config.category.toLowerCase() === category.toLowerCase()
    );
  };

  // Save config via events
  const saveConfig = async (config: AppConfig) => {
    try {
      const orgId = currentOrganization()?.id;
      const key = orgId ? `org-${orgId}-app-config-${config.id}` : `app-config-${config.id}`;

      // Publish event
      await events.send('app-config.save', {
        config: {
          ...config,
          updated_at: new Date().toISOString()
        },
        key,
        orgId
      });

      // Direct MCP call for immediate effect
      await callTool('kv.set', {
        key,
        value: {
          ...config,
          updated_at: new Date().toISOString()
        },
        ttl_hours: 8760
      });

      await loadConfigs(orgId);
      success(`Saved ${config.name}`);
      return true;
    } catch (err: any) {
      error(`Failed to save config: ${err.message}`);
      return false;
    }
  };

  // Delete config via events
  const deleteConfig = async (appId: string) => {
    try {
      const orgId = currentOrganization()?.id;
      const key = orgId ? `org-${orgId}-app-config-${appId}` : `app-config-${appId}`;

      // Publish event
      await events.send('app-config.delete', { appId, key, orgId });

      // Direct MCP call for immediate effect
      await callTool('kv.set', {
        key,
        value: null,
        ttl_hours: 0.001
      });

      await loadConfigs(orgId);
      success(`Deleted app config`);
      return true;
    } catch (err: any) {
      error(`Failed to delete config: ${err.message}`);
      return false;
    }
  };

  // Force reseed via events
  const reseedMarketplace = async () => {
    try {
      await events.send('app-config.reseed-marketplace', {
        force: true,
        timestamp: new Date().toISOString()
      });

      await seedMarketplaceViaEvents();
      const orgId = currentOrganization()?.id;
      await loadConfigs(orgId);
      return { success: true, seeded: MARKETPLACE_CONFIGS.length, errors: [] };
    } catch (err: any) {
      error(`Failed to reseed marketplace: ${err.message}`);
      return { success: false, seeded: 0, errors: [err.message] };
    }
  };

  return {
    appConfigs,
    isLoading,
    lastSeeded,
    searchConfigs,
    getByCategory,
    saveConfig,
    deleteConfig,
    reseedMarketplace,
    refresh: () => loadConfigs(currentOrganization()?.id)
  };
}