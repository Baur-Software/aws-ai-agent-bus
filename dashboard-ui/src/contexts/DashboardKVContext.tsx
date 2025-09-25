import { createContext, useContext, createSignal } from 'solid-js';
import { useNotifications } from './NotificationContext';

/**
 * Dashboard-server KV context - replaces direct MCP calls
 * All operations go through dashboard-server API
 */

interface DashboardKVContextType {
  get: (key: string) => Promise<any>;
  set: (key: string, value: any, ttlHours?: number, options?: { showNotification?: boolean }) => Promise<boolean>;
  del: (key: string, options?: { showNotification?: boolean }) => Promise<boolean>;
  exists: (key: string) => Promise<boolean>;
  isLoading: () => boolean;
}

const DashboardKVContext = createContext<DashboardKVContextType>();

export function DashboardKVProvider(props: { children: any }) {
  const { success, error } = useNotifications();
  const [isLoading, setIsLoading] = createSignal(false);

  const baseURL = import.meta.env.VITE_DASHBOARD_SERVER_URL || 'http://localhost:3001';

  /**
   * Get value via dashboard-server KV API
   */
  const get = async (key: string): Promise<any> => {
    try {
      const response = await fetch(`${baseURL}/api/kv/${encodeURIComponent(key)}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data.value;
    } catch (err: any) {
      console.error(`Failed to get KV pair "${key}":`, err);
      return null;
    }
  };

  /**
   * Set value via dashboard-server KV API
   */
  const set = async (key: string, value: any, ttlHours: number = 24, options: { showNotification?: boolean } = {}): Promise<boolean> => {
    const { showNotification = true } = options;
    setIsLoading(true);

    try {
      const response = await fetch(`${baseURL}/api/kv/${encodeURIComponent(key)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value, ttl_hours: ttlHours })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

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
   * Delete value via dashboard-server KV API
   */
  const del = async (key: string, options: { showNotification?: boolean } = {}): Promise<boolean> => {
    const { showNotification = true } = options;
    setIsLoading(true);

    try {
      const response = await fetch(`${baseURL}/api/kv/${encodeURIComponent(key)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

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
   * Check if key exists via dashboard-server
   */
  const exists = async (key: string): Promise<boolean> => {
    const value = await get(key);
    return value !== null;
  };

  const value = {
    get,
    set,
    del,
    exists,
    isLoading
  };

  return (
    <DashboardKVContext.Provider value={value}>
      {props.children}
    </DashboardKVContext.Provider>
  );
}

export function useDashboardKV(): DashboardKVContextType {
  const context = useContext(DashboardKVContext);
  if (!context) {
    throw new Error('useDashboardKV must be used within a DashboardKVProvider');
  }
  return context;
}