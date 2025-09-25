import { createSignal, onMount, For, Show, createEffect } from 'solid-js';
import { KVItem, useKVStore } from '../contexts/KVStoreContext';
import { useNotifications } from '../contexts/NotificationContext';
import { usePageHeader } from '../contexts/HeaderContext';
import { useOrganization } from '../contexts/OrganizationContext';
import { useDashboardServer } from '../contexts/DashboardServerContext';
import {
  Database, Plus, Trash2, Edit3, Eye, EyeOff, RefreshCw,
  Search, Funnel, Download, Upload, Save, X, Copy,
  Clock, FileText, Settings, Key
} from 'lucide-solid';

function KVStore() {
  // Set page-specific header
  const { title, tagline } = usePageHeader('Key-Value Store', 'Manage application data and configuration');
  const [kvPairs, setKvPairs] = createSignal<KVItem[]>([]);
  const [filteredPairs, setFilteredPairs] = createSignal<KVItem[]>([]);
  const [isLoading, setIsLoading] = createSignal(true);
  const [searchQuery, setSearchQuery] = createSignal('');
  const [showAddModal, setShowAddModal] = createSignal(false);
  const [editingPair, setEditingPair] = createSignal<KVItem | null>(null);
  const [newKey, setNewKey] = createSignal('');
  const [newValue, setNewValue] = createSignal('');
  const [newTtl, setNewTtl] = createSignal(24);
  const [showValues, setShowValues] = createSignal<Record<string, boolean>>({});
  const [keyIndex, setKeyIndex] = createSignal<string[]>([]);
  const [usingKeyIndex, setUsingKeyIndex] = createSignal(false);

  const kvStore = useKVStore();
  const { info, error } = useNotifications();
  const { user, currentOrganization } = useOrganization();
  // const dashboard = useDashboard(); // Removed - using DashboardServerContext instead

  // Discover keys based on current context
  const discoverContextKeys = async (): Promise<string[]> => {
    const contextKeys: string[] = [];
    const currentUser = user();
    const currentOrg = currentOrganization();

    if (currentUser) {
      // User-specific keys
      contextKeys.push(
        `user-${currentUser.id}-preferences`,
        `user-${currentUser.id}-settings`,
        `user-${currentUser.id}-last-opened-workflow`,
        `user-${currentUser.id}-nav-preferences`
      );

      // Integration keys for this user
      const integrationServices = ['google-analytics', 'slack', 'github', 'stripe', 'trello', 'google-search-console', 'sendgrid', 'airtable'];
      for (const service of integrationServices) {
        contextKeys.push(`user-${currentUser.id}-integration-${service}`);
        // Also check for multiple connections pattern
        contextKeys.push(`user-${currentUser.id}-integration-${service}-default`);
        contextKeys.push(`user-${currentUser.id}-integration-${service}-work`);
        contextKeys.push(`user-${currentUser.id}-integration-${service}-personal`);
      }
    }

    if (currentOrg) {
      // Organization-specific keys
      contextKeys.push(
        `org-${currentOrg.id}-settings`,
        `org-${currentOrg.id}-workflows`,
        `org-${currentOrg.id}-templates`,
        `org-${currentOrg.id}-permissions`
      );
    }

    // Global system keys
    contextKeys.push(
      'system-config',
      'global-templates',
      'feature-flags',
      'maintenance-mode'
    );

    // Try to get workflow-specific keys
    try {
      // const workflows = await dashboard.workflows.getAll(); // Temporarily disabled - needs DashboardServerContext integration
      // for (const workflow of workflows) {
      //   contextKeys.push(
      //     `workflow-${workflow.workflowId}-definition`,
      //     `workflow-${workflow.workflowId}-metadata`,
      //     `workflow-${workflow.workflowId}-permissions`
      //   );
      // }
    } catch (err) {
      console.warn('Could not load workflow keys:', err);
    }

    return contextKeys;
  };

  // Maintain a key index for the current user/context
  const updateKeyIndex = async (newKey: string) => {
    const currentUser = user();
    if (!currentUser) return;

    const indexKey = `user-${currentUser.id}-key-index`;
    try {
      const existingIndex = await kvStore.get(indexKey) || [];
      const updatedIndex = Array.from(new Set([...existingIndex, newKey]));
      await kvStore.set(indexKey, updatedIndex, 24 * 7, { showNotification: false }); // 1 week TTL
      setKeyIndex(updatedIndex);
    } catch (err) {
      console.warn('Failed to update key index:', err);
    }
  };

  // Remove key from index
  const removeFromKeyIndex = async (deletedKey: string) => {
    const currentUser = user();
    if (!currentUser) return;

    const indexKey = `user-${currentUser.id}-key-index`;
    try {
      const existingIndex = await kvStore.get(indexKey) || [];
      const updatedIndex = existingIndex.filter((key: string) => key !== deletedKey);
      await kvStore.set(indexKey, updatedIndex, 24 * 7, { showNotification: false });
      setKeyIndex(updatedIndex);
    } catch (err) {
      console.warn('Failed to remove key from index:', err);
    }
  };

  // Load keys from the user's key index
  const loadFromKeyIndex = async (): Promise<string[]> => {
    const currentUser = user();
    if (!currentUser) return [];

    const indexKey = `user-${currentUser.id}-key-index`;
    try {
      const userKeys = await kvStore.get(indexKey) || [];
      setKeyIndex(userKeys);
      return userKeys;
    } catch (err) {
      console.warn('Failed to load key index:', err);
      return [];
    }
  };

  // Load KV pairs based on current context
  const loadKVPairs = async () => {
    setIsLoading(true);
    try {
      // First try to load from the user's key index (most efficient)
      const indexedKeys = await loadFromKeyIndex();

      // If we have indexed keys, use those, otherwise discover contextually
      const keysToLoad = indexedKeys.length > 0 ? indexedKeys : await discoverContextKeys();
      setUsingKeyIndex(indexedKeys.length > 0);

      const pairs = await kvStore.getMultiple(keysToLoad);
      setKvPairs(pairs);
      setFilteredPairs(pairs);
    } catch (err) {
      console.error('Failed to load KV store data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Rebuild the key index from current pairs
  const rebuildKeyIndex = async () => {
    const currentUser = user();
    if (!currentUser) return;

    try {
      const currentKeys = kvPairs().map(pair => pair.key);
      const indexKey = `user-${currentUser.id}-key-index`;
      await kvStore.set(indexKey, currentKeys, 24 * 7, { showNotification: false });
      setKeyIndex(currentKeys);
      info(`Key index rebuilt with ${currentKeys.length} keys`);
    } catch (err) {
      error('Failed to rebuild key index');
    }
  };

  // Force discovery mode (ignore index)
  const forceDiscovery = async () => {
    setIsLoading(true);
    try {
      const contextKeys = await discoverContextKeys();
      const pairs = await kvStore.getMultiple(contextKeys);
      setKvPairs(pairs);
      setFilteredPairs(pairs);
      setUsingKeyIndex(false);
    } catch (err) {
      error('Failed to discover keys');
    } finally {
      setIsLoading(false);
    }
  };

  // Filter pairs based on search query
  const filterPairs = () => {
    const query = searchQuery().toLowerCase().trim();
    if (!query) {
      setFilteredPairs(kvPairs());
      return;
    }
    
    const filtered = kvPairs().filter(pair => {
      // Search in key
      if (pair.key.toLowerCase().includes(query)) {
        return true;
      }
      
      // Search in value (handle different data types)
      try {
        let searchableValue = '';
        if (typeof pair.value === 'string') {
          searchableValue = pair.value.toLowerCase();
        } else if (typeof pair.value === 'object') {
          searchableValue = JSON.stringify(pair.value).toLowerCase();
        } else {
          searchableValue = String(pair.value).toLowerCase();
        }
        
        return searchableValue.includes(query);
      } catch (error) {
        // Fallback to string conversion if JSON.stringify fails
        return String(pair.value).toLowerCase().includes(query);
      }
    });
    
    setFilteredPairs(filtered);
  };

  // Add or update KV pair
  const saveKVPair = async () => {
    const key = newKey().trim();
    const value = newValue().trim();

    if (!key || !value) {
      error('Key and value are required');
      return;
    }

    const success = await kvStore.set(key, value, newTtl());
    if (success) {
      // Update the key index for new keys
      if (!editingPair()) {
        await updateKeyIndex(key);
      }

      setShowAddModal(false);
      setEditingPair(null);
      setNewKey('');
      setNewValue('');
      setNewTtl(24);
      loadKVPairs(); // Reload data
    }
  };

  // Delete KV pair
  const deleteKVPair = async (key: string) => {
    if (!confirm(`Are you sure you want to delete "${key}"?`)) return;

    const success = await kvStore.del(key);
    if (success) {
      // Remove from the key index
      await removeFromKeyIndex(key);
      loadKVPairs(); // Reload data
    }
  };

  // Edit existing pair
  const editPair = (pair: KVItem) => {
    setEditingPair(pair);
    setNewKey(pair.key);
    setNewValue(typeof pair.value === 'string' ? pair.value : JSON.stringify(pair.value, null, 2));
    setNewTtl(24);
    setShowAddModal(true);
  };

  // Toggle value visibility
  const toggleValueVisibility = (key: string) => {
    setShowValues(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Copy to clipboard
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      info('Copied to clipboard');
    } catch (err) {
      error('Failed to copy to clipboard');
    }
  };

  onMount(() => {
    loadKVPairs();
  });

  // Reactively filter when kvPairs or searchQuery changes
  createEffect(() => {
    filterPairs();
  });

  // Update filter when search changes
  const handleSearch = (e: { target: { value: any; }; }) => {
    setSearchQuery(e.target.value);
    // filterPairs() will be called automatically by the effect
  };

  return (
    <div class="h-full flex flex-col max-w-7xl mx-auto p-6">
      {/* Header */}
      <div class="flex-shrink-0 mb-6">
        <h1 class="text-3xl font-bold text-slate-900 dark:text-white mb-2">{title || 'KV Store Management' }</h1>
        <p class="text-slate-600 dark:text-slate-400">
          {tagline || 'Manage your application key-value data securely and efficiently.'}
        </p>
      </div>
      {/* Stats */}
      <div class="flex-shrink-0 grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div class="bg-white dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
          <div class="flex items-center gap-2 mb-2">
            <Database class="w-5 h-5 text-blue-500" />
            <span class="font-medium text-slate-900 dark:text-white">Total Pairs</span>
          </div>
          <div class="text-2xl font-bold text-slate-900 dark:text-white">{kvPairs().length}</div>
        </div>
        
        <div class="bg-white dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
          <div class="flex items-center gap-2 mb-2">
            <Search class="w-5 h-5 text-green-500" />
            <span class="font-medium text-slate-900 dark:text-white">Filtered</span>
          </div>
          <div class="text-2xl font-bold text-slate-900 dark:text-white">{filteredPairs().length}</div>
        </div>
        
        <div class="bg-white dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
          <div class="flex items-center gap-2 mb-2">
            <FileText class="w-5 h-5 text-purple-500" />
            <span class="font-medium text-slate-900 dark:text-white">Total Size</span>
          </div>
          <div class="text-2xl font-bold text-slate-900 dark:text-white">
            {(kvPairs().reduce((sum, pair) => sum + pair.size, 0) / 1024).toFixed(1)}KB
          </div>
        </div>
      </div>
      {/* Controls */}
      <div class="flex-shrink-0 flex flex-col sm:flex-row gap-4 mb-6">
        {/* Search */}
        <div class="flex-1 relative">
          <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-slate-500 w-4 h-4" />
          <input
            type="text"
            placeholder={usingKeyIndex()
              ? `Search ${keyIndex().length} indexed keys...`
              : "Search discovered context keys..."
            }
            class="w-full pl-10 pr-10 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
            value={searchQuery()}
            onInput={handleSearch}
          />
          <Show when={searchQuery()}>
            <button
              class="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400"
              onClick={() => setSearchQuery('')}
              title="Clear search"
            >
              <X class="w-4 h-4" />
            </button>
          </Show>
        </div>
        
        {/* Actions */}
        <div class="flex gap-2">
          <button
            class="btn btn-secondary flex items-center gap-2"
            onClick={loadKVPairs}
            disabled={isLoading()}
          >
            <RefreshCw class={`w-4 h-4 ${isLoading() ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <Show when={usingKeyIndex()}>
            <button
              class="btn btn-secondary flex items-center gap-2 text-xs"
              onClick={forceDiscovery}
              title="Discover all context keys (ignores index)"
            >
              <Search class="w-4 h-4" />
              Discover
            </button>
          </Show>
          <Show when={!usingKeyIndex() && kvPairs().length > 0}>
            <button
              class="btn btn-secondary flex items-center gap-2 text-xs"
              onClick={rebuildKeyIndex}
              title="Create key index from current results"
            >
              <Database class="w-4 h-4" />
              Index
            </button>
          </Show>
          <button
            class="btn btn-primary flex items-center gap-2"
            onClick={() => {
              setEditingPair(null);
              setNewKey('');
              setNewValue('');
              setNewTtl(24);
              setShowAddModal(true);
            }}
          >
            <Plus class="w-4 h-4" />
            Add Pair
          </button>
        </div>
      </div>


      {/* Search Results Info */}
      <Show when={searchQuery()}>
        <div class="flex-shrink-0 mb-4 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800/50 rounded-lg">
          <div class="flex items-center gap-2 text-blue-800 dark:text-blue-300">
            <Search class="w-4 h-4" />
            <span class="text-sm font-medium">
              Found {filteredPairs().length} result{filteredPairs().length !== 1 ? 's' : ''} 
              {searchQuery() && ` for "${searchQuery()}"`}
            </span>
            {filteredPairs().length === 0 && (
              <span class="text-sm"> - Try a different search term</span>
            )}
          </div>
        </div>
      </Show>

      {/* Main Content Area - Scrollable */}
      <div class="flex-1 overflow-hidden">
        {/* Loading State */}
        <Show when={isLoading()}>
        <div class="flex items-center justify-center h-64">
          <div class="text-center">
            <Database class="w-12 h-12 text-slate-400 dark:text-slate-500 mx-auto mb-4 animate-pulse" />
            <p class="text-slate-600 dark:text-slate-400">Loading KV store data...</p>
          </div>
        </div>
      </Show>

      {/* KV Pairs Table */}
      <Show when={!isLoading()}>
        <Show when={filteredPairs().length > 0} fallback={
          <div class="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-12">
            <div class="text-center">
              <Database class="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
              <Show when={searchQuery()} fallback={
                <>
                  <h3 class="text-lg font-semibold text-slate-600 dark:text-slate-400 mb-2">No KV Pairs Found</h3>
                  <p class="text-slate-500 dark:text-slate-400">No key-value pairs are currently available.</p>
                </>
              }>
                <h3 class="text-lg font-semibold text-slate-600 dark:text-slate-400 mb-2">No Results Found</h3>
                <p class="text-slate-500 dark:text-slate-400 mb-4">
                  No key-value pairs match "{searchQuery()}"
                </p>
                <div class="text-sm text-slate-500 dark:text-slate-400">
                  <p class="mb-2"><strong>Search tips:</strong></p>
                  <ul class="list-disc list-inside space-y-1 text-left max-w-md mx-auto">
                    <li>Try searching for partial key names (e.g., "integration")</li>
                    <li>Search within JSON values (e.g., "client_id", "token")</li>
                    <li>Use single words for broader results</li>
                    <li>Search is case-insensitive</li>
                  </ul>
                </div>
                <button
                  class="mt-4 text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 text-sm font-medium"
                  onClick={() => setSearchQuery('')}
                >
                  Clear search to view all pairs
                </button>
              </Show>
            </div>
          </div>
        }>
        <div class="h-full bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col">
          {/* Table Header - Fixed */}
          <div class="bg-slate-50 dark:bg-slate-700 border-b border-slate-200 dark:border-slate-600">
            <div class="grid grid-cols-12 gap-4 p-4">
              <div class="col-span-3 font-medium text-slate-900 dark:text-white">Key</div>
              <div class="col-span-4 font-medium text-slate-900 dark:text-white">Value</div>
              <div class="col-span-2 font-medium text-slate-900 dark:text-white">Type</div>
              <div class="col-span-1 font-medium text-slate-900 dark:text-white">Size</div>
              <div class="col-span-2 font-medium text-slate-900 dark:text-white">Actions</div>
            </div>
          </div>

          {/* Table Body - Scrollable */}
          <div class="overflow-auto flex-1">
            <For each={filteredPairs()}>
              {(pair) => (
                <div class="grid grid-cols-12 gap-4 p-4 hover:bg-slate-50 dark:hover:bg-slate-700 border-b border-slate-100 dark:border-slate-700">
                  <div class="col-span-3">
                    <div class="flex items-center gap-2">
                      <Key class="w-4 h-4 text-slate-400 dark:text-slate-500" />
                      <code class="text-sm font-mono bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white px-2 py-1 rounded truncate">
                        {pair.key}
                      </code>
                    </div>
                  </div>
                  <div class="col-span-4">
                    <div class="flex items-center gap-2">
                      <Show when={showValues()[pair.key]} fallback={
                        <span class="text-slate-500 dark:text-slate-400 italic">••••••••</span>
                      }>
                        <pre class="text-xs bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white p-2 rounded border border-slate-200 dark:border-slate-600 max-h-20 overflow-y-auto whitespace-pre-wrap flex-1">
                          {typeof pair.value === 'string'
                            ? pair.value.substring(0, 200) + (pair.value.length > 200 ? '...' : '')
                            : JSON.stringify(pair.value, null, 2).substring(0, 200) + '...'
                          }
                        </pre>
                      </Show>
                      <button
                        class="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400 flex-shrink-0"
                        onClick={() => toggleValueVisibility(pair.key)}
                      >
                        {showValues()[pair.key] ? <EyeOff class="w-4 h-4" /> : <Eye class="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div class="col-span-2">
                    <span class="inline-block px-2 py-1 text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded">
                      {pair.type}
                    </span>
                  </div>
                  <div class="col-span-1 text-sm text-slate-600 dark:text-slate-400">
                    {pair.size < 1024 ? `${pair.size}B` : `${(pair.size / 1024).toFixed(1)}KB`}
                  </div>
                  <div class="col-span-2">
                    <div class="flex items-center gap-2">
                      <button
                        class="text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400"
                        onClick={() => copyToClipboard(typeof pair.value === 'string' ? pair.value : JSON.stringify(pair.value, null, 2))}
                        title="Copy value"
                      >
                        <Copy class="w-4 h-4" />
                      </button>
                      <button
                        class="text-slate-400 dark:text-slate-500 hover:text-green-600 dark:hover:text-green-400"
                        onClick={() => editPair(pair)}
                        title="Edit"
                      >
                        <Edit3 class="w-4 h-4" />
                      </button>
                      <button
                        class="text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400"
                        onClick={() => deleteKVPair(pair.key)}
                        title="Delete"
                      >
                        <Trash2 class="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </For>
          </div>
        </div>
        </Show>
      </Show>
      </div>

      {/* Add/Edit Modal */}
      <Show when={showAddModal()}>
        <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div class="bg-white dark:bg-slate-800 rounded-lg p-6 w-full max-w-lg">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-lg font-semibold text-slate-900 dark:text-white">
                {editingPair() ? 'Edit KV Pair' : 'Add KV Pair'}
              </h3>
              <button
                class="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400"
                onClick={() => setShowAddModal(false)}
              >
                <X class="w-5 h-5" />
              </button>
            </div>
            
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Key</label>
                <input
                  type="text"
                  class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                  placeholder="Enter key name"
                  value={newKey()}
                  onInput={(e) => setNewKey(e.target.value)}
                  disabled={!!editingPair()}
                />
              </div>
              
              <div>
                <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Value</label>
                <textarea
                  class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                  rows="6"
                  placeholder="Enter value (JSON or string)"
                  value={newValue()}
                  onInput={(e) => setNewValue(e.target.value)}
                />
              </div>
              
              <div>
                <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">TTL (Hours)</label>
                <input
                  type="number"
                  class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                  placeholder="24"
                  min="1"
                  max="8760"
                  value={newTtl()}
                  onInput={(e) => setNewTtl(Number(e.target.value))}
                />
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Time to live in hours (1-8760)</p>
              </div>
            </div>
            
            <div class="flex gap-2 mt-6">
              <button
                class="btn btn-primary flex items-center gap-2"
                onClick={saveKVPair}
              >
                <Save class="w-4 h-4" />
                {editingPair() ? 'Update' : 'Save'}
              </button>
              <button
                class="btn btn-secondary"
                onClick={() => setShowAddModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}

export default KVStore;