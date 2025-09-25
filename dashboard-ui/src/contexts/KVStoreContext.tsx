import { createContext, useContext, createSignal } from 'solid-js';
import { useDashboardServer } from './DashboardServerContext';
import { useNotifications } from './NotificationContext.tsx';

export interface KVItem {
  key: string;
  value: any;
  size: number;
  type: string;
  lastModified: string;
}

export interface AppConfig {
  id: string;
  name: string;
  category: string;
  icon?: string;
  color?: string;
  description: string;
  type: 'oauth2' | 'api_key' | 'webhook' | 'basic_auth';
  verified?: boolean;
  oauth2_config?: {
    auth_url: string;
    token_url: string;
    scopes: string[];
    redirect_uri: string;
  };
  ui_fields: Array<{
    key: string;
    label: string;
    type: 'text' | 'password' | 'url' | 'email' | 'textarea';
    required: boolean;
    placeholder?: string;
    help?: string;
  }>;
  workflow_capabilities: string[];
  docsUrl?: string;
  created_at?: string;
  updated_at?: string;
}

interface KVStoreContextType {
  // Core KV operations
  get: (key: string) => Promise<any>;
  set: (key: string, value: any, ttlHours?: number, options?: { showNotification?: boolean }) => Promise<boolean>;
  del: (key: string, options?: { showNotification?: boolean }) => Promise<boolean>;
  getMultiple: (keys: string[]) => Promise<KVItem[]>;
  exists: (key: string) => Promise<boolean>;
  isLoading: () => boolean;

  // App config management
  getAppConfig: (appId: string, orgId?: string) => Promise<AppConfig | null>;
  setAppConfig: (config: AppConfig, orgId?: string) => Promise<boolean>;
  deleteAppConfig: (appId: string, orgId?: string) => Promise<boolean>;
  getAppConfigs: (orgId?: string) => Promise<AppConfig[]>;
  searchAppConfigs: (query: string, orgId?: string) => Promise<AppConfig[]>;
  getAppConfigsByCategory: (category: string, orgId?: string) => Promise<AppConfig[]>;
}

const KVStoreContext = createContext<KVStoreContextType>();

export function KVStoreProvider(props: { children: any }) {
  const { kvStore } = useDashboardServer();
  const { success, error } = useNotifications();
  const [isLoading, setIsLoading] = createSignal(false);

  /**
   * Get a value from the KV store
   */
  const get = async (key: string): Promise<any> => {
    try {
      const result = await kvStore.get(key);
      return result;
    } catch (err: any) {
      console.error(`Failed to get KV pair "${key}":`, err);
      return null;
    }
  };

  /**
   * Set a value in the KV store
   */
  const set = async (key: string, value: any, ttlHours: number = 24, options: { showNotification?: boolean } = {}): Promise<boolean> => {
    const { showNotification = true } = options;

    setIsLoading(true);
    try {
      await kvStore.set(key, value, ttlHours);

      if (showNotification) {
        success(`KV pair "${key}" saved successfully`);
      }
      return true;
    } catch (err: any) {
      error(`Failed to save KV pair "${key}": ${err.message}`);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Delete a value from the KV store by setting it to null with very short TTL
   */
  const del = async (key: string, options: { showNotification?: boolean } = {}): Promise<boolean> => {
    const { showNotification = true } = options;

    setIsLoading(true);
    try {
      // Set value to null with minimal TTL to effectively delete
      await kvStore.set(key, null, 0.001); // Very short TTL to effectively delete (3.6 seconds)

      if (showNotification) {
        success(`KV pair "${key}" deleted successfully`);
      }
      return true;
    } catch (err: any) {
      error(`Failed to delete KV pair "${key}": ${err.message}`);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Get multiple values from the KV store
   */
  const getMultiple = async (keys: string[]): Promise<KVItem[]> => {
    const results = await Promise.allSettled(
      keys.map(async key => {
        try {
          const result = await kvStore.get(key);
          if (result !== null && result !== undefined) {
            return {
              key,
              value: result,
              size: JSON.stringify(result).length,
              type: typeof result === 'object' ? 'object' : typeof result,
              lastModified: new Date().toISOString() // Mock - would come from backend
            };
          }
          return null;
        } catch {
          return null;
        }
      })
    );

    return results
      .filter((result): result is PromiseFulfilledResult<KVItem> => result.status === 'fulfilled' && result.value !== null)
      .map(result => result.value);
  };

  /**
   * Check if a key exists in the KV store
   */
  const exists = async (key: string): Promise<boolean> => {
    const value = await get(key);
    return value !== null;
  };

  /**
   * Get app config (org-specific override or global marketplace)
   */
  const getAppConfig = async (appId: string, orgId?: string): Promise<AppConfig | null> => {
    // Try org-specific config first
    if (orgId) {
      const orgConfig = await get(`org-${orgId}-app-config-${appId}`);
      if (orgConfig) return orgConfig;
    }

    // Fall back to global marketplace config
    return await get(`app-config-${appId}`);
  };

  /**
   * Set app config (org-specific or global marketplace)
   */
  const setAppConfig = async (config: AppConfig, orgId?: string): Promise<boolean> => {
    const timestamp = new Date().toISOString();
    const configWithTimestamp = {
      ...config,
      updated_at: timestamp,
      created_at: config.created_at || timestamp
    };

    const key = orgId ? `org-${orgId}-app-config-${config.id}` : `app-config-${config.id}`;
    return await set(key, configWithTimestamp, 8760, { showNotification: false }); // 1 year TTL
  };

  /**
   * Delete app config
   */
  const deleteAppConfig = async (appId: string, orgId?: string): Promise<boolean> => {
    const key = orgId ? `org-${orgId}-app-config-${appId}` : `app-config-${appId}`;
    return await del(key, { showNotification: false });
  };

  /**
   * Get all app configs with prefix scanning
   */
  const getAppConfigs = async (orgId?: string): Promise<AppConfig[]> => {
    const mcpClient = client();
    if (!mcpClient) return [];

    try {
      // Get both org-specific and global configs
      const prefixes = orgId ? [`org-${orgId}-app-config-`, 'app-config-'] : ['app-config-'];
      const allConfigs: AppConfig[] = [];
      const seenIds = new Set<string>();

      for (const prefix of prefixes) {
        // Note: This would need backend support for prefix scanning
        // For now, we'll use known app IDs or implement a registry
        const knownAppIds = [
          'google-analytics', 'slack', 'github', 'stripe', 'trello', 'hubspot',
          'salesforce', 'discord', 'twitter', 'linkedin', 'facebook', 'microsoft-365',
          'google-workspace', 'notion', 'airtable', 'zapier', 'mailchimp', 'sendgrid'
        ];

        for (const appId of knownAppIds) {
          if (!seenIds.has(appId)) {
            const config = await getAppConfig(appId, orgId);
            if (config) {
              allConfigs.push(config);
              seenIds.add(appId);
            }
          }
        }
      }

      return allConfigs;
    } catch (err: any) {
      console.error('Failed to get app configs:', err);
      return [];
    }
  };

  /**
   * Search app configs by name or description
   */
  const searchAppConfigs = async (query: string, orgId?: string): Promise<AppConfig[]> => {
    const allConfigs = await getAppConfigs(orgId);
    const lowerQuery = query.toLowerCase();

    return allConfigs.filter(config =>
      config.name.toLowerCase().includes(lowerQuery) ||
      config.description.toLowerCase().includes(lowerQuery) ||
      config.category.toLowerCase().includes(lowerQuery)
    );
  };

  /**
   * Get app configs by category
   */
  const getAppConfigsByCategory = async (category: string, orgId?: string): Promise<AppConfig[]> => {
    const allConfigs = await getAppConfigs(orgId);
    return allConfigs.filter(config => config.category.toLowerCase() === category.toLowerCase());
  };

  const value = {
    // Core KV operations
    get,
    set,
    del,
    getMultiple,
    exists,
    isLoading,

    // App config management
    getAppConfig,
    setAppConfig,
    deleteAppConfig,
    getAppConfigs,
    searchAppConfigs,
    getAppConfigsByCategory
  };

  return (
    <KVStoreContext.Provider value={value}>
      {props.children}
    </KVStoreContext.Provider>
  );
}

export function useKVStore(): KVStoreContextType {
  const context = useContext(KVStoreContext);
  if (!context) {
    throw new Error('useKVStore must be used within a KVStoreProvider');
  }
  return context;
}