import { createSignal, Show, For } from 'solid-js';
import { X, Server, Plus, Trash2, AlertCircle } from 'lucide-solid';
import { useKVStore } from '../contexts/KVStoreContext';
import { useNotifications } from '../contexts/NotificationContext';
import { useOrganization } from '../contexts/OrganizationContext';
import { useAuth } from '../contexts/AuthContext';

interface CustomMCPServerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface CustomMCPField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'url' | 'number';
  required: boolean;
  placeholder?: string;
}

export default function CustomMCPServerModal(props: CustomMCPServerModalProps) {
  const [serverName, setServerName] = createSignal('');
  const [serverUrl, setServerUrl] = createSignal('');
  const [description, setDescription] = createSignal('');
  const [customFields, setCustomFields] = createSignal<CustomMCPField[]>([]);
  const [isLoading, setIsLoading] = createSignal(false);
  const [validationError, setValidationError] = createSignal('');

  const kvStore = useKVStore();
  const { success, error } = useNotifications();
  const { currentOrganization, user } = useOrganization();
  const { user: authUser } = useAuth();

  const resetForm = () => {
    setServerName('');
    setServerUrl('');
    setDescription('');
    setCustomFields([]);
    setValidationError('');
  };

  const addCustomField = () => {
    setCustomFields([
      ...customFields(),
      {
        key: '',
        label: '',
        type: 'text',
        required: false,
        placeholder: ''
      }
    ]);
  };

  const removeCustomField = (index: number) => {
    setCustomFields(customFields().filter((_, i) => i !== index));
  };

  const updateCustomField = (index: number, field: Partial<CustomMCPField>) => {
    const updated = [...customFields()];
    updated[index] = { ...updated[index], ...field };
    setCustomFields(updated);
  };

  const validateForm = (): boolean => {
    if (!serverName().trim()) {
      setValidationError('Server name is required');
      return false;
    }

    if (!serverUrl().trim()) {
      setValidationError('Server URL is required');
      return false;
    }

    // Validate URL format
    try {
      new URL(serverUrl());
    } catch {
      setValidationError('Invalid URL format');
      return false;
    }

    // Validate custom fields
    for (let i = 0; i < customFields().length; i++) {
      const field = customFields()[i];
      if (!field.key.trim() || !field.label.trim()) {
        setValidationError(`Custom field ${i + 1} must have both key and label`);
        return false;
      }
    }

    setValidationError('');
    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    try {
      const userId = authUser()?.userId || user()?.id || 'demo-user-123';
      const orgId = currentOrganization()?.id;

      // Determine scope: if org context exists, save to org; otherwise save to user
      const isOrgScope = !!orgId;

      // Generate a unique ID for this custom MCP server
      const serverId = `custom-mcp-${serverName().toLowerCase().replace(/\s+/g, '-')}`;

      // Create the app configuration that will be stored in KV
      const appConfig = {
        id: serverId,
        name: serverName(),
        description: description() || `Custom MCP server: ${serverName()}`,
        icon: 'Server', // Use a generic server icon
        color: 'bg-purple-600',
        docsUrl: serverUrl(),
        serverUrl: serverUrl(),
        type: 'custom-mcp',
        scope: isOrgScope ? 'organization' : 'personal',
        ui_fields: customFields().length > 0 ? customFields() : [
          {
            key: 'api_key',
            label: 'API Key',
            type: 'password',
            required: true,
            placeholder: 'Enter your API key'
          }
        ],
        created_at: new Date().toISOString(),
        created_by: userId,
        organization_id: isOrgScope ? orgId : undefined
      };

      // Store with appropriate scope prefix
      const scopePrefix = isOrgScope ? `org-${orgId}` : `user-${userId}`;
      const key = `${scopePrefix}-integration-${serverId}`;
      await kvStore.set(key, appConfig, 8760); // 1 year TTL

      // Update the scoped custom MCP registry
      try {
        const registryKey = `${scopePrefix}-integration-registry-custom-mcp`;
        const registry = await kvStore.get(registryKey) || [];
        if (!registry.includes(serverId)) {
          registry.push(serverId);
          await kvStore.set(registryKey, registry, 8760, { showNotification: false });
        }
      } catch (err) {
        console.warn('Failed to update custom MCP registry:', err);
      }

      success(`Custom MCP server "${serverName()}" added successfully!`);
      resetForm();
      props.onClose();

      // Reload the page to show the new integration
      window.location.reload();
    } catch (err: any) {
      error(`Failed to add custom MCP server: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading()) {
      resetForm();
      props.onClose();
    }
  };

  return (
    <Show when={props.isOpen}>
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div class="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div class="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
            <div class="flex items-center gap-3">
              <div class="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <Server class="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h2 class="text-xl font-bold text-slate-900 dark:text-white">
                  Add Custom MCP Server
                </h2>
                <p class="text-sm text-slate-600 dark:text-slate-400">
                  Connect your own MCP-compatible server
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              class="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              disabled={isLoading()}
            >
              <X class="w-5 h-5 text-slate-500 dark:text-slate-400" />
            </button>
          </div>

          {/* Form */}
          <div class="p-6 space-y-6">
            {/* Validation Error */}
            <Show when={validationError()}>
              <div class="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <AlertCircle class="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
                <div class="flex-1">
                  <p class="text-sm font-medium text-red-900 dark:text-red-300">
                    Validation Error
                  </p>
                  <p class="text-sm text-red-700 dark:text-red-400 mt-1">
                    {validationError()}
                  </p>
                </div>
              </div>
            </Show>

            {/* Server Name */}
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Server Name <span class="text-red-500">*</span>
              </label>
              <input
                type="text"
                class="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="e.g., My Custom API"
                value={serverName()}
                onInput={(e) => setServerName(e.target.value)}
              />
            </div>

            {/* Server URL */}
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Server URL <span class="text-red-500">*</span>
              </label>
              <input
                type="url"
                class="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="https://api.example.com"
                value={serverUrl()}
                onInput={(e) => setServerUrl(e.target.value)}
              />
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
                The base URL or documentation URL for this MCP server
              </p>
            </div>

            {/* Description */}
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Description (Optional)
              </label>
              <textarea
                class="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                rows={3}
                placeholder="Brief description of what this server provides..."
                value={description()}
                onInput={(e) => setDescription(e.target.value)}
              />
            </div>

            {/* Custom Fields */}
            <div>
              <div class="flex items-center justify-between mb-3">
                <label class="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Connection Fields
                </label>
                <button
                  class="btn btn-secondary text-sm flex items-center gap-1"
                  onClick={addCustomField}
                >
                  <Plus class="w-4 h-4" />
                  Add Field
                </button>
              </div>

              <Show when={customFields().length === 0}>
                <div class="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600">
                  <p class="text-sm text-slate-600 dark:text-slate-400">
                    No custom fields defined. By default, connections will require an API key.
                  </p>
                </div>
              </Show>

              <div class="space-y-3">
                <For each={customFields()}>
                  {(field, index) => (
                    <div class="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600">
                      <div class="flex items-start gap-3">
                        <div class="flex-1 space-y-3">
                          <div class="grid grid-cols-2 gap-3">
                            <div>
                              <label class="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Field Key
                              </label>
                              <input
                                type="text"
                                class="w-full px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                                placeholder="api_key"
                                value={field.key}
                                onInput={(e) => updateCustomField(index(), { key: e.target.value })}
                              />
                            </div>
                            <div>
                              <label class="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Label
                              </label>
                              <input
                                type="text"
                                class="w-full px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                                placeholder="API Key"
                                value={field.label}
                                onInput={(e) => updateCustomField(index(), { label: e.target.value })}
                              />
                            </div>
                          </div>
                          <div class="grid grid-cols-2 gap-3">
                            <div>
                              <label class="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Type
                              </label>
                              <select
                                class="w-full px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                                value={field.type}
                                onChange={(e) => updateCustomField(index(), { type: e.target.value as any })}
                              >
                                <option value="text">Text</option>
                                <option value="password">Password</option>
                                <option value="url">URL</option>
                                <option value="number">Number</option>
                              </select>
                            </div>
                            <div class="flex items-center pt-6">
                              <label class="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  class="w-4 h-4 text-purple-600 border-slate-300 rounded focus:ring-purple-500"
                                  checked={field.required}
                                  onChange={(e) => updateCustomField(index(), { required: e.target.checked })}
                                />
                                <span class="text-xs font-medium text-slate-700 dark:text-slate-300">
                                  Required
                                </span>
                              </label>
                            </div>
                          </div>
                        </div>
                        <button
                          class="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                          onClick={() => removeCustomField(index())}
                        >
                          <Trash2 class="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </div>

            {/* Info Box */}
            <div class="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p class="text-sm text-blue-700 dark:text-blue-300">
                <strong>Note:</strong> After creating this custom integration, you'll be able to connect to it
                just like any other app. Make sure your MCP server is compatible with the Model Context Protocol.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div class="flex items-center justify-end gap-3 p-6 border-t border-slate-200 dark:border-slate-700">
            <button
              class="btn btn-secondary"
              onClick={handleClose}
              disabled={isLoading()}
            >
              Cancel
            </button>
            <button
              class="btn btn-primary"
              onClick={handleSave}
              disabled={isLoading()}
            >
              {isLoading() ? 'Saving...' : 'Add Custom Server'}
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
}
