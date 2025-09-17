import { createContext, useContext, createSignal } from 'solid-js';
import { useMCP } from './MCPContext';
import { useNotifications } from './NotificationContext.tsx';

interface KVItem {
  key: string;
  value: any;
  size: number;
  type: string;
  lastModified: string;
}

interface KVStoreContextType {
  get: (key: string) => Promise<any>;
  set: (key: string, value: any, ttlHours?: number, options?: { showNotification?: boolean }) => Promise<boolean>;
  del: (key: string, options?: { showNotification?: boolean }) => Promise<boolean>;
  getMultiple: (keys: string[]) => Promise<KVItem[]>;
  exists: (key: string) => Promise<boolean>;
  isLoading: () => boolean;
}

const KVStoreContext = createContext<KVStoreContextType>();

export function KVStoreProvider(props: { children: any }) {
  const { client } = useMCP();
  const { success, error } = useNotifications();
  const [isLoading, setIsLoading] = createSignal(false);

  /**
   * Get a value from the KV store
   */
  const get = async (key: string): Promise<any> => {
    const mcpClient = client();
    if (!mcpClient) return null;

    try {
      const result = await mcpClient.callTool('kv.get', { key });
      return result; // The result is already the value from MCP
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
    const mcpClient = client();
    if (!mcpClient) return false;

    setIsLoading(true);
    try {
      await mcpClient.callTool('kv.set', {
        key,
        value,
        ttl_hours: ttlHours
      });
      
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
    const mcpClient = client();
    if (!mcpClient) return false;

    setIsLoading(true);
    try {
      // Set value to null with minimal TTL to effectively delete
      await mcpClient.callTool('kv.set', {
        key,
        value: null,
        ttl_hours: 0.001 // Very short TTL to effectively delete (3.6 seconds)
      });

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
    const mcpClient = client();
    if (!mcpClient) return [];

    const results = await Promise.allSettled(
      keys.map(async key => {
        try {
          const result = await mcpClient.callTool('kv.get', { key });
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

  const value = {
    get,
    set,
    del,
    getMultiple,
    exists,
    isLoading
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