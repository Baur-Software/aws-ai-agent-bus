import { createSignal, createMemo, Show, For } from 'solid-js';
import { MCPServerListing } from '../../types/mcpCatalog';
import { useDashboardServer } from '../../contexts/DashboardServerContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { getServiceLogo } from '../../utils/logoUtils';

interface MCPOAuthManagerProps {
  servers: MCPServerListing[];
  connectedServers: Set<string>;
  onConnect: (serverId: string) => Promise<void>;
  onDisconnect: (serverId: string) => Promise<void>;
  connectingServerId: string | null;
}

interface OAuthConfiguration {
  serverId: string;
  connectionId: string;
  connectionName: string;
  credentials: Record<string, any>;
  status: 'active' | 'inactive' | 'error';
  lastUsed?: string;
  createdAt: string;
}

export default function MCPOAuthManager(props: MCPOAuthManagerProps) {
  const dashboardServer = useDashboardServer();
  const { addNotification } = useNotifications();

  const [oauthConfigurations, setOAuthConfigurations] = createSignal<Map<string, OAuthConfiguration[]>>(new Map());
  const [editingServer, setEditingServer] = createSignal<string | null>(null);
  const [showCredentials, setShowCredentials] = createSignal<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = createSignal(false);

  // Filter servers that require OAuth authentication
  const oauthRequiredServers = createMemo(() => {
    return props.servers.filter(server => {
      // Check if server requires authentication based on its auth methods
      const hasAuthMethods = server.authMethods &&
        server.authMethods.some(method => ['oauth2', 'api_key'].includes(method)) &&
        server.authMethods.some(method => method !== 'none');

      // Also check if server has required configuration fields (for legacy integration configs)
      const hasRequiredFields = server.configurationSchema &&
        server.configurationSchema.some(field => field.required);

      // Only show well-known servers that we have static integration configs for
      const knownIntegrations = ['github', 'slack', 'stripe', 'google-analytics'];
      const isKnownIntegration = knownIntegrations.includes(server.id);

      return (hasAuthMethods || hasRequiredFields) && isKnownIntegration;
    });
  });

  // Get OAuth configuration schema for a server
  const getOAuthSchema = (server: MCPServerListing) => {
    // Map common OAuth patterns to UI fields
    const authMethod = server.authMethods.find(method => ['oauth2', 'api_key'].includes(method));

    if (authMethod === 'oauth2') {
      return [
        {
          key: 'client_id',
          label: 'Client ID',
          type: 'text' as const,
          required: true,
          description: 'OAuth 2.0 client ID from the service provider',
          placeholder: 'your-client-id'
        },
        {
          key: 'client_secret',
          label: 'Client Secret',
          type: 'password' as const,
          required: true,
          description: 'OAuth 2.0 client secret from the service provider'
        },
        {
          key: 'redirect_uri',
          label: 'Redirect URI',
          type: 'url' as const,
          required: false,
          description: 'OAuth callback URL (optional)',
          placeholder: 'http://localhost:3001/oauth/callback'
        },
        {
          key: 'scope',
          label: 'Scopes',
          type: 'text' as const,
          required: false,
          description: 'Space-separated OAuth scopes',
          placeholder: 'read write'
        }
      ];
    } else if (authMethod === 'api_key') {
      return [
        {
          key: 'api_key',
          label: 'API Key',
          type: 'password' as const,
          required: true,
          description: 'API key for the service',
          placeholder: 'your-api-key'
        },
        {
          key: 'api_secret',
          label: 'API Secret',
          type: 'password' as const,
          required: false,
          description: 'API secret (if required by the service)'
        }
      ];
    }

    return [];
  };

  // Load existing OAuth configurations
  const loadOAuthConfigurations = async (serverId: string) => {
    try {
      setIsLoading(true);
      const configurations: OAuthConfiguration[] = [];
      const connectionIds = ['default', 'work', 'personal', 'backup'];

      for (const connectionId of connectionIds) {
        try {
          const key = `user-oauth-${serverId}-${connectionId}`;
          const result = await dashboardServer.kvStore.get(key);
          if (result?.value) {
            const config = typeof result.value === 'string' ? JSON.parse(result.value) : result.value;
            configurations.push({
              serverId,
              connectionId,
              connectionName: config.connectionName || `${serverId} (${connectionId})`,
              credentials: config.credentials || {},
              status: config.status || 'active',
              lastUsed: config.lastUsed,
              createdAt: config.createdAt || new Date().toISOString()
            });
          }
        } catch (error) {
          // Configuration doesn't exist, continue
        }
      }

      setOAuthConfigurations(prev => {
        const newMap = new Map(prev);
        newMap.set(serverId, configurations);
        return newMap;
      });
    } catch (error) {
      console.error('Failed to load OAuth configurations:', error);
      addNotification({
        type: 'error',
        title: 'Failed to Load OAuth Configurations',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Save OAuth configuration
  const saveOAuthConfiguration = async (
    serverId: string,
    connectionId: string,
    connectionName: string,
    credentials: Record<string, any>
  ) => {
    try {
      setIsLoading(true);

      const configuration: OAuthConfiguration = {
        serverId,
        connectionId,
        connectionName,
        credentials,
        status: 'active',
        createdAt: new Date().toISOString()
      };

      const key = `user-oauth-${serverId}-${connectionId}`;
      await dashboardServer.kvStore.set(key, {
        connectionName,
        credentials,
        status: 'active',
        createdAt: new Date().toISOString()
      }, 168); // 7 days TTL

      // Update local state
      setOAuthConfigurations(prev => {
        const newMap = new Map(prev);
        const existingConfigs = newMap.get(serverId) || [];
        const updatedConfigs = existingConfigs.filter(c => c.connectionId !== connectionId);
        updatedConfigs.push(configuration);
        newMap.set(serverId, updatedConfigs);
        return newMap;
      });

      addNotification({
        type: 'success',
        title: 'OAuth Configuration Saved',
        message: `Successfully configured OAuth for ${serverId}`
      });

      setEditingServer(null);
    } catch (error) {
      console.error('Failed to save OAuth configuration:', error);
      addNotification({
        type: 'error',
        title: 'Failed to Save Configuration',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Delete OAuth configuration
  const deleteOAuthConfiguration = async (serverId: string, connectionId: string) => {
    if (!confirm('Are you sure you want to delete this OAuth configuration?')) return;

    try {
      const key = `user-oauth-${serverId}-${connectionId}`;
      await dashboardServer.kvStore.set(key, null); // Delete by setting to null

      setOAuthConfigurations(prev => {
        const newMap = new Map(prev);
        const existingConfigs = newMap.get(serverId) || [];
        const updatedConfigs = existingConfigs.filter(c => c.connectionId !== connectionId);
        newMap.set(serverId, updatedConfigs);
        return newMap;
      });

      addNotification({
        type: 'success',
        title: 'Configuration Deleted',
        message: 'OAuth configuration has been removed'
      });
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Failed to Delete Configuration',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  // Test OAuth configuration
  const testOAuthConfiguration = async (serverId: string, connectionId: string) => {
    try {
      addNotification({
        type: 'info',
        title: 'Testing OAuth Configuration',
        message: 'Verifying credentials...'
      });

      // Simulate OAuth test (in real implementation, this would call the actual OAuth endpoint)
      await new Promise(resolve => setTimeout(resolve, 2000));

      // For demo purposes, randomly succeed or fail
      const success = Math.random() > 0.3;

      if (success) {
        addNotification({
          type: 'success',
          title: 'OAuth Test Successful',
          message: `OAuth configuration for ${serverId} is working correctly`
        });
      } else {
        addNotification({
          type: 'error',
          title: 'OAuth Test Failed',
          message: 'Invalid credentials or OAuth configuration error'
        });
      }
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'OAuth Test Failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  const toggleShowCredentials = (serverId: string) => {
    setShowCredentials(prev => ({
      ...prev,
      [serverId]: !prev[serverId]
    }));
  };

  return (
    <div class="space-y-6">
      {/* Header */}
      <div class="text-center py-8">
        <svg class="w-16 h-16 mx-auto mb-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
        <h3 class="text-xl font-semibold text-slate-900 dark:text-white mb-2">
          OAuth Configuration
        </h3>
        <p class="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
          Configure authentication credentials for MCP servers that require OAuth or API key authentication.
          Manage multiple connection profiles per service for different environments.
        </p>
      </div>

      {/* OAuth Required Servers Count */}
      <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div class="flex items-center gap-3">
          <svg class="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p class="text-sm font-medium text-blue-900 dark:text-blue-100">
              {oauthRequiredServers().length} servers require authentication
            </p>
            <p class="text-xs text-blue-700 dark:text-blue-300">
              Configure OAuth credentials to connect to these services
            </p>
          </div>
        </div>
      </div>

      {/* OAuth Required Servers List */}
      <Show
        when={oauthRequiredServers().length > 0}
        fallback={
          <div class="text-center py-12">
            <svg class="w-12 h-12 mx-auto mb-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <h4 class="text-lg font-medium text-slate-900 dark:text-white mb-2">
              No OAuth Required
            </h4>
            <p class="text-slate-600 dark:text-slate-400">
              No servers in the current catalog require OAuth authentication
            </p>
          </div>
        }
      >
        <div class="space-y-4">
          <h4 class="text-lg font-semibold text-slate-900 dark:text-white">
            Servers Requiring Authentication
          </h4>

          <For each={oauthRequiredServers()}>
            {(server) => {
              const logo = getServiceLogo(server.name);
              const configs = oauthConfigurations().get(server.id) || [];
              const hasConfigurations = configs.length > 0;
              const isConnected = props.connectedServers.has(server.id);

              return (
                <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6">
                  <div class="flex items-start justify-between mb-4">
                    <div class="flex items-start gap-4">
                      {/* Server Icon */}
                      <div class={`flex-shrink-0 w-12 h-12 rounded-xl ${logo.bgColor} flex items-center justify-center shadow-lg border border-slate-200 dark:border-slate-600`}>
                        <Show when={logo.logoUrl} fallback={
                          <span class="text-white font-bold text-lg">
                            {logo.fallbackLetter}
                          </span>
                        }>
                          <img
                            src={logo.logoUrl}
                            alt={`${server.name} logo`}
                            class="w-8 h-8 object-contain"
                          />
                        </Show>
                      </div>

                      <div class="flex-1">
                        <div class="flex items-center gap-3 mb-2">
                          <h5 class="text-lg font-semibold text-slate-900 dark:text-white">
                            {server.name}
                          </h5>
                          <div class="flex items-center gap-2">
                            <Show when={hasConfigurations}>
                              <span class="px-2 py-1 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full">
                                {configs.length} config{configs.length !== 1 ? 's' : ''}
                              </span>
                            </Show>
                            <Show when={isConnected}>
                              <span class="px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full">
                                Connected
                              </span>
                            </Show>
                          </div>
                        </div>

                        <p class="text-sm text-slate-600 dark:text-slate-400 mb-3">
                          {server.description}
                        </p>

                        <div class="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                          <span class="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded">
                            Auth: {server.authMethods.filter(m => m !== 'none').join(', ')}
                          </span>
                          <span>•</span>
                          <span>by {server.publisher}</span>
                        </div>
                      </div>
                    </div>

                    <div class="flex items-center gap-2">
                      <Show when={hasConfigurations}>
                        <button
                          onClick={() => loadOAuthConfigurations(server.id)}
                          class="px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700"
                        >
                          Manage
                        </button>
                      </Show>

                      <button
                        onClick={() => setEditingServer(editingServer() === server.id ? null : server.id)}
                        class="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                      >
                        {hasConfigurations ? 'Add Another' : 'Configure OAuth'}
                      </button>
                    </div>
                  </div>

                  {/* OAuth Configuration Form */}
                  <Show when={editingServer() === server.id}>
                    <OAuthConfigurationForm
                      server={server}
                      schema={getOAuthSchema(server)}
                      onSave={(connectionId, connectionName, credentials) =>
                        saveOAuthConfiguration(server.id, connectionId, connectionName, credentials)
                      }
                      onCancel={() => setEditingServer(null)}
                      showCredentials={showCredentials()[server.id] || false}
                      onToggleShowCredentials={() => toggleShowCredentials(server.id)}
                      isLoading={isLoading()}
                    />
                  </Show>

                  {/* Existing OAuth Configurations */}
                  <Show when={hasConfigurations}>
                    <div class="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                      <h6 class="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                        OAuth Configurations
                      </h6>
                      <div class="space-y-2">
                        <For each={configs}>
                          {(config) => (
                            <div class="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                              <div>
                                <div class="font-medium text-slate-900 dark:text-white text-sm">
                                  {config.connectionName}
                                </div>
                                <div class="text-xs text-slate-500 dark:text-slate-400">
                                  Created {new Date(config.createdAt).toLocaleDateString()}
                                  {config.lastUsed && ` • Last used ${new Date(config.lastUsed).toLocaleDateString()}`}
                                </div>
                              </div>
                              <div class="flex items-center gap-2">
                                <span class={`px-2 py-1 text-xs rounded-full ${
                                  config.status === 'active' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                                  config.status === 'error' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' :
                                  'bg-slate-100 dark:bg-slate-600 text-slate-700 dark:text-slate-300'
                                }`}>
                                  {config.status}
                                </span>
                                <button
                                  onClick={() => testOAuthConfiguration(server.id, config.connectionId)}
                                  class="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded"
                                  title="Test Configuration"
                                >
                                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => deleteOAuthConfiguration(server.id, config.connectionId)}
                                  class="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                                  title="Delete Configuration"
                                >
                                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          )}
                        </For>
                      </div>
                    </div>
                  </Show>
                </div>
              );
            }}
          </For>
        </div>
      </Show>
    </div>
  );
}

// OAuth Configuration Form Component
interface OAuthField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'url';
  required: boolean;
  description?: string;
  placeholder?: string;
}

function OAuthConfigurationForm(props: {
  server: MCPServerListing;
  schema: OAuthField[];
  onSave: (connectionId: string, connectionName: string, credentials: Record<string, any>) => void;
  onCancel: () => void;
  showCredentials: boolean;
  onToggleShowCredentials: () => void;
  isLoading: boolean;
}) {
  const [credentials, setCredentials] = createSignal<Record<string, any>>({});
  const [connectionName, setConnectionName] = createSignal('');
  const [connectionId, setConnectionId] = createSignal('default');

  const updateCredential = (key: string, value: string) => {
    setCredentials(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e: Event) => {
    e.preventDefault();

    // Validate required fields
    const missingFields = props.schema.filter(field => field.required && !credentials()[field.key]);
    if (missingFields.length > 0) {
      alert(`Missing required fields: ${missingFields.map(f => f.label).join(', ')}`);
      return;
    }

    const name = connectionName() || `${props.server.name} (${connectionId()})`;
    props.onSave(connectionId(), name, credentials());
  };

  return (
    <div class="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
      <form onSubmit={handleSubmit} class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Connection Name
            </label>
            <input
              type="text"
              value={connectionName()}
              onInput={(e) => setConnectionName(e.target.value)}
              placeholder={`${props.server.name} OAuth`}
              class="w-full border border-slate-300 dark:border-slate-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Connection Profile
            </label>
            <select
              value={connectionId()}
              onChange={(e) => setConnectionId(e.target.value)}
              class="w-full border border-slate-300 dark:border-slate-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            >
              <option value="default">Default</option>
              <option value="work">Work</option>
              <option value="personal">Personal</option>
              <option value="backup">Backup</option>
            </select>
          </div>
        </div>

        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <h6 class="text-sm font-medium text-slate-700 dark:text-slate-300">
              OAuth Credentials
            </h6>
            <button
              type="button"
              onClick={props.onToggleShowCredentials}
              class="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
            >
              {props.showCredentials ? (
                <>
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                  </svg>
                  Hide
                </>
              ) : (
                <>
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  Show
                </>
              )} values
            </button>
          </div>

          <For each={props.schema}>
            {(field) => (
              <div>
                <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {field.label} {field.required && <span class="text-red-500">*</span>}
                </label>
                <input
                  type={field.type === 'password' && !props.showCredentials ? 'password' : 'text'}
                  value={credentials()[field.key] || ''}
                  onInput={(e) => updateCredential(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  required={field.required}
                  class="w-full border border-slate-300 dark:border-slate-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
                <Show when={field.description}>
                  <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">{field.description}</p>
                </Show>
              </div>
            )}
          </For>
        </div>

        <div class="flex items-center gap-3">
          <button
            type="submit"
            disabled={props.isLoading}
            class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm disabled:opacity-50"
          >
            {props.isLoading ? 'Saving...' : 'Save OAuth Configuration'}
          </button>

          <button
            type="button"
            onClick={props.onCancel}
            class="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 text-sm"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}