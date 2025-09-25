import { createSignal, createEffect, onCleanup } from 'solid-js';
import { useMCP } from '../contexts/MCPContext';
import { useNotifications } from '../contexts/NotificationContext';

/**
 * Event-driven KV operations following proper architecture:
 * UI → Events → Dashboard Server → MCP → KV Store → Events → UI
 */
export function useEventDrivenKV() {
  const [isLoading, setIsLoading] = createSignal(false);
  const { events } = useMCP();
  const { success, error } = useNotifications();

  // Event-driven KV operations
  const kvOps = {
    /**
     * Set value via events - dashboard server will handle MCP call
     */
    async set(key: string, value: any, ttlHours = 24) {
      try {
        setIsLoading(true);

        // Emit event to dashboard server
        await events.send('kv.set-request', {
          key,
          value,
          ttl_hours: ttlHours,
          timestamp: new Date().toISOString(),
          request_id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        });

        // Dashboard server will:
        // 1. Receive event
        // 2. Call MCP kv.set
        // 3. Emit kv.set-response event
        // 4. Emit kv.updated event for real-time updates

        return true;
      } catch (err: any) {
        error(`Failed to set KV ${key}: ${err.message}`);
        return false;
      } finally {
        setIsLoading(false);
      }
    },

    /**
     * Get value via events - dashboard server will handle MCP call
     */
    async get(key: string) {
      try {
        setIsLoading(true);
        const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Emit event to dashboard server
        await events.send('kv.get-request', {
          key,
          timestamp: new Date().toISOString(),
          request_id: requestId
        });

        // For now, fall back to direct MCP call
        // TODO: Implement response event listening when WebSocket streaming is ready
        const result = await this.getDirectFallback(key);
        return result;
      } catch (err: any) {
        error(`Failed to get KV ${key}: ${err.message}`);
        return null;
      } finally {
        setIsLoading(false);
      }
    },

    /**
     * Delete value via events
     */
    async delete(key: string) {
      try {
        setIsLoading(true);

        await events.send('kv.delete-request', {
          key,
          timestamp: new Date().toISOString(),
          request_id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        });

        return true;
      } catch (err: any) {
        error(`Failed to delete KV ${key}: ${err.message}`);
        return false;
      } finally {
        setIsLoading(false);
      }
    },

    /**
     * Batch operations via events
     */
    async batchSet(operations: Array<{ key: string; value: any; ttl_hours?: number }>) {
      try {
        setIsLoading(true);

        await events.send('kv.batch-set-request', {
          operations,
          timestamp: new Date().toISOString(),
          request_id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        });

        return true;
      } catch (err: any) {
        error(`Failed batch KV operation: ${err.message}`);
        return false;
      } finally {
        setIsLoading(false);
      }
    },

    /**
     * Temporary fallback - direct MCP call until event responses are implemented
     */
    async getDirectFallback(key: string) {
      const { callTool } = useMCP();
      try {
        return await callTool('kv.get', { key });
      } catch (err) {
        console.warn(`Direct KV fallback failed for ${key}:`, err);
        return null;
      }
    }
  };

  return {
    ...kvOps,
    isLoading
  };
}

/**
 * App Config specific event-driven operations
 */
export function useEventDrivenAppConfigs() {
  const [configs, setConfigs] = createSignal<any[]>([]);
  const [isLoading, setIsLoading] = createSignal(false);
  const { events } = useMCP();
  const { success, error } = useNotifications();
  const kv = useEventDrivenKV();

  const appConfigOps = {
    /**
     * Load app configs via events
     */
    async loadConfigs(orgId?: string) {
      try {
        setIsLoading(true);

        // Emit load request event
        await events.send('app-config.load-marketplace', {
          orgId,
          timestamp: new Date().toISOString(),
          request_id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        });

        // For now, use fallback until event streaming is ready
        // TODO: Listen for app-config.loaded event from dashboard server
        const loadedConfigs = await this.loadConfigsFallback(orgId);
        setConfigs(loadedConfigs);

        return loadedConfigs;
      } catch (err: any) {
        error(`Failed to load app configs: ${err.message}`);
        return [];
      } finally {
        setIsLoading(false);
      }
    },

    /**
     * Save app config via events
     */
    async saveConfig(config: any, orgId?: string) {
      try {
        setIsLoading(true);

        await events.send('app-config.save', {
          config: {
            ...config,
            updated_at: new Date().toISOString()
          },
          orgId,
          timestamp: new Date().toISOString(),
          request_id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        });

        // Also update via direct KV for immediate effect
        const key = orgId ? `org-${orgId}-app-config-${config.id}` : `app-config-${config.id}`;
        await kv.set(key, {
          ...config,
          updated_at: new Date().toISOString()
        }, 8760);

        success(`Saved ${config.name}`);
        return true;
      } catch (err: any) {
        error(`Failed to save config: ${err.message}`);
        return false;
      } finally {
        setIsLoading(false);
      }
    },

    /**
     * Delete app config via events
     */
    async deleteConfig(appId: string, orgId?: string) {
      try {
        setIsLoading(true);

        await events.send('app-config.delete', {
          appId,
          orgId,
          timestamp: new Date().toISOString(),
          request_id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        });

        // Also delete via KV for immediate effect
        const key = orgId ? `org-${orgId}-app-config-${appId}` : `app-config-${appId}`;
        await kv.delete(key);

        success('App config deleted');
        return true;
      } catch (err: any) {
        error(`Failed to delete config: ${err.message}`);
        return false;
      } finally {
        setIsLoading(false);
      }
    },

    /**
     * Seed marketplace via events
     */
    async seedMarketplace(force = false) {
      try {
        setIsLoading(true);

        await events.send('app-config.seed-marketplace', {
          force,
          timestamp: new Date().toISOString(),
          request_id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        });

        // Dashboard server will handle the actual seeding
        success('Marketplace seeding initiated');
        return true;
      } catch (err: any) {
        error(`Failed to seed marketplace: ${err.message}`);
        return false;
      } finally {
        setIsLoading(false);
      }
    },

    /**
     * Fallback method until event streaming is implemented
     */
    async loadConfigsFallback(orgId?: string) {
      // This would be replaced with event listener once WebSocket streaming is ready
      const knownAppIds = [
        'google-analytics', 'slack', 'github', 'stripe', 'salesforce',
        'hubspot', 'discord', 'notion', 'airtable', 'shopify'
      ];

      const configs = [];
      for (const appId of knownAppIds) {
        try {
          // Try org-specific first
          if (orgId) {
            const orgConfig = await kv.getDirectFallback(`org-${orgId}-app-config-${appId}`);
            if (orgConfig) {
              configs.push(orgConfig);
              continue;
            }
          }

          // Try global
          const globalConfig = await kv.getDirectFallback(`app-config-${appId}`);
          if (globalConfig) {
            configs.push(globalConfig);
          }
        } catch (err) {
          // Ignore missing configs
        }
      }

      return configs;
    }
  };

  return {
    configs,
    isLoading,
    ...appConfigOps
  };
}