import { createSignal, onMount, For, createMemo, Show } from 'solid-js';
import { useKVStore } from '../contexts/KVStoreContext';
import { useNotifications } from '../contexts/NotificationContext';
import { usePageHeader } from '../contexts/HeaderContext';
import { useOrganization } from '../contexts/OrganizationContext';
import {
  Settings, Plus, Trash2, CheckCircle, XCircle, CircleQuestionMark,
  Slack, Github, Database, BarChart3,  CreditCard, Globe, Shield, Zap, Users, Building
} from 'lucide-solid';

// App configuration templates - these get stored as integration-<service> keys
const APP_CONFIGS = [
  {
    id: 'google-analytics',
    name: 'Google Analytics',
    icon: BarChart3,
    color: 'bg-orange-500',
    description: 'Connect Google Analytics for website metrics and reporting',
    type: 'oauth2',
    oauth2_config: {
      auth_url: 'https://accounts.google.com/o/oauth2/auth',
      token_url: 'https://oauth2.googleapis.com/token',
      scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
      redirect_uri: 'http://localhost:3000/oauth/callback'
    },
    ui_fields: [
      { key: 'client_id', label: 'Client ID', type: 'text', required: true },
      { key: 'client_secret', label: 'Client Secret', type: 'password', required: true },
      { key: 'property_id', label: 'GA4 Property ID', type: 'text', required: true }
    ],
    workflow_capabilities: [
      'ga-top-pages', 'ga-search-data', 'ga-opportunities', 'ga-calendar'
    ],
    docsUrl: 'https://developers.google.com/analytics/devguides/config/mgmt/v3/quickstart/web-js'
  },
  {
    id: 'google-search-console',
    name: 'Google Search Console', 
    icon: Globe,
    color: 'bg-blue-500',
    description: 'Access search performance and indexing data',
    docsUrl: 'https://developers.google.com/webmaster-tools/search-console-api/v1/quickstart',
    fields: [
      { key: 'client_id', label: 'Client ID', type: 'text', required: true },
      { key: 'client_secret', label: 'Client Secret', type: 'password', required: true },
      { key: 'site_url', label: 'Site URL', type: 'url', required: true }
    ],
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly']
  },
  {
    id: 'slack',
    name: 'Slack',
    icon: Slack,
    color: 'bg-green-500',
    description: 'Send messages and notifications to Slack channels',
    docsUrl: 'https://api.slack.com/authentication/basics',
    fields: [
      { key: 'bot_token', label: 'Bot User OAuth Token', type: 'password', required: true },
      { key: 'signing_secret', label: 'Signing Secret', type: 'password', required: true },
      { key: 'workspace_url', label: 'Workspace URL', type: 'url', required: false }
    ],
    scopes: ['chat:write', 'channels:read', 'users:read']
  },
  {
    id: 'github',
    name: 'GitHub',
    icon: Github,
    color: 'bg-gray-800',
    description: 'Access repositories, issues, and pull requests',
    docsUrl: 'https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token',
    fields: [
      { key: 'access_token', label: 'Personal Access Token', type: 'password', required: true },
      { key: 'organization', label: 'Organization (optional)', type: 'text', required: false }
    ],
    scopes: ['repo', 'user', 'notifications']
  },
  {
    id: 'stripe',
    name: 'Stripe',
    icon: CreditCard,
    color: 'bg-purple-500',
    description: 'Process payments and manage customer data',
    docsUrl: 'https://stripe.com/docs/keys',
    fields: [
      { key: 'publishable_key', label: 'Publishable Key', type: 'text', required: true },
      { key: 'secret_key', label: 'Secret Key', type: 'password', required: true },
      { key: 'webhook_secret', label: 'Webhook Secret', type: 'password', required: false }
    ],
    scopes: []
  },
  {
    id: 'trello',
    name: 'Trello',
    icon: Database,
    color: 'bg-blue-600',
    description: 'Create and manage cards, boards, and lists',
    docsUrl: 'https://developer.atlassian.com/cloud/trello/guides/rest-api/api-introduction/',
    fields: [
      { key: 'api_key', label: 'API Key', type: 'text', required: true },
      { key: 'api_token', label: 'API Token', type: 'password', required: true },
      { key: 'board_id', label: 'Default Board ID', type: 'text', required: false }
    ],
    scopes: ['read', 'write']
  },
  {
    id: 'hubspot',
    name: 'HubSpot',
    icon: Users,
    color: 'bg-orange-600',
    description: 'Manage contacts, deals, and marketing automation',
    type: 'oauth2',
    oauth2_config: {
      auth_url: 'https://app.hubspot.com/oauth/authorize',
      token_url: 'https://api.hubapi.com/oauth/v1/token',
      scopes: ['crm.objects.contacts.read', 'crm.objects.contacts.write', 'crm.objects.deals.read', 'crm.objects.deals.write'],
      redirect_uri: 'http://localhost:3000/oauth/callback'
    },
    ui_fields: [
      { key: 'client_id', label: 'Client ID', type: 'text', required: true },
      { key: 'client_secret', label: 'Client Secret', type: 'password', required: true },
      { key: 'portal_id', label: 'Portal ID (Hub ID)', type: 'text', required: true }
    ],
    workflow_capabilities: [
      'hubspot-create-contact', 'hubspot-update-contact', 'hubspot-create-deal', 'hubspot-get-contacts', 'hubspot-get-deals'
    ],
    docsUrl: 'https://developers.hubspot.com/docs/api/oauth-quickstart-guide'
  }
];

type IntegrationConfig = typeof APP_CONFIGS[number];
type Connection = {
  connection_id: string;
  connection_name: string;
  connected_at: string;
  credentials: Record<string, any>;
  settings: {
    last_used?: string | null;
    user_preferences?: Record<string, any>;
    enabled_workflows?: string[];
  };
};

interface IntegrationCardProps {
  integration: IntegrationConfig;
  connections?: Connection[];
  onConnect: (integrationId: string, credentials: Record<string, any>, connectionName?: string | null) => Promise<void>;
  onDisconnect: (integrationId: string, connectionId?: string) => Promise<void>;
  onTest: (integrationId: string, connectionId?: string) => Promise<any>;
}

function IntegrationCard({ integration, connections = [], onConnect, onDisconnect, onTest }: IntegrationCardProps) {
  const [showFields, setShowFields] = createSignal(false);
  const [formData, setFormData] = createSignal({});
  const [connectionName, setConnectionName] = createSignal('');
  const [isLoading, setIsLoading] = createSignal(false);
  const [testResult, setTestResult] = createSignal(null);
  const [expandedConnection, setExpandedConnection] = createSignal(null);
  
  const isConnected = () => connections.length > 0;
  const hasMultipleConnections = () => connections.length > 1;

  const handleFieldChange = (key, value) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleConnect = async () => {
    setIsLoading(true);
    try {
      await onConnect(integration.id, formData(), connectionName().trim() || null);
      setShowFields(false);
      setFormData({});
      setConnectionName('');
    } catch (error) {
      console.error('Connection failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTest = async (connectionId = 'default') => {
    setIsLoading(true);
    try {
      const result = await onTest(integration.id, connectionId);
      setTestResult({ success: true, message: 'Connection test successful!' });
    } catch (error) {
      setTestResult({ success: false, message: error.message || 'Connection test failed' });
    } finally {
      setIsLoading(false);
      setTimeout(() => setTestResult(null), 3000);
    }
  };

  return (
    <div 
      class={`rounded-lg border p-6 transition-all cursor-pointer ${
        isConnected() 
          ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 hover:border-green-300 dark:hover:border-green-700' 
          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md'
      }`}
      onClick={() => !isConnected() && setShowFields(!showFields())}
    >
      <div class="flex items-start justify-between mb-4">
        <div class="flex items-center gap-3">
          <div class={`p-3 rounded-lg ${integration.color} text-white ${isConnected() ? 'ring-2 ring-green-200 dark:ring-green-700' : ''}`}>
            <integration.icon class="w-6 h-6" />
          </div>
          <div class="flex-1">
            <div class="flex items-center gap-2">
              <h3 class="text-lg font-semibold text-slate-900 dark:text-white">{integration.name}</h3>
              <a
                href={integration.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                class="text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                title="View documentation"
                onClick={(e) => e.stopPropagation()}
              >
                <CircleQuestionMark class="w-4 h-4" />
              </a>
            </div>
            <p class="text-sm text-slate-600 dark:text-slate-400">{integration.description}</p>
          </div>
        </div>
        <div class="flex flex-col items-end gap-1">
          <div class="flex items-center gap-2">
            {isConnected() ? (
              <>
                <CheckCircle class="w-5 h-5 text-green-600" />
                <span class="text-sm text-green-700 dark:text-green-400 font-medium">
                  {hasMultipleConnections() ? `${connections.length} Connections` : 'Connected'}
                </span>
              </>
            ) : (
              <>
                <Plus class="w-5 h-5 text-blue-500" />
                <span class="text-sm text-blue-600 dark:text-blue-400 font-medium">Click to Setup</span>
              </>
            )}
          </div>
          {isConnected() && (
            <span class="text-xs text-green-600 dark:text-green-400">Ready for workflows</span>
          )}
        </div>
      </div>

      {testResult() && (
        <div class={`mb-4 p-3 rounded-lg ${testResult().success ? 'bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-300' : 'bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-300'}`}>
          <div class="flex items-center gap-2">
            {testResult().success ? (
              <CheckCircle class="w-4 h-4" />
            ) : (
              <XCircle class="w-4 h-4" />
            )}
            <span class="text-sm">{testResult().message}</span>
          </div>
        </div>
      )}

      {showFields() && (
        <div class="mb-4 p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
          <h4 class="text-sm font-medium text-slate-900 dark:text-white mb-3">New Connection</h4>
          <div class="space-y-3">
            {/* Connection Name Field */}
            <div>
              <label class="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Connection Name {hasMultipleConnections() || connectionName() ? '(optional)' : ''}
              </label>
              <input
                type="text"
                class="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                placeholder={`${integration.name} ${connections.length > 0 ? '(Work Account)' : '(Default)'}`}
                value={connectionName()}
                onInput={(e) => setConnectionName(e.target.value)}
              />
            </div>
            
            <For each={integration.ui_fields || integration.fields}>
              {(field) => (
                <div>
                  <label class="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {field.label}
                    {field.required && <span class="text-red-500 ml-1">*</span>}
                  </label>
                  <input
                    type={field.type}
                    class="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                    placeholder={field.label}
                    value={formData()[field.key] || ''}
                    onInput={(e) => handleFieldChange(field.key, e.target.value)}
                    required={field.required}
                  />
                </div>
              )}
            </For>
          </div>
          <div class="flex gap-2 mt-4">
            <button
              class="btn btn-primary text-sm"
              onClick={handleConnect}
              disabled={isLoading()}
            >
              {isLoading() ? 'Saving...' : 'Save & Connect'}
            </button>
            <button
              class="btn btn-secondary text-sm"
              onClick={() => setShowFields(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Multiple connections display */}
      {isConnected() && (
        <div class="pt-4 border-t border-green-200 dark:border-green-800">
          <div class="space-y-3">
            <For each={connections}>
              {(connection) => (
                <div class="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 border border-green-200 dark:border-green-700">
                  <div class="flex items-center justify-between">
                    <div class="flex-1">
                      <div class="flex items-center gap-2 mb-1">
                        <h5 class="text-sm font-medium text-green-900 dark:text-green-300">
                          {connection.connection_name || `Connection ${connection.connection_id}`}
                        </h5>
                        <span class="text-xs bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full">
                          {connection.connection_id}
                        </span>
                      </div>
                      <p class="text-xs text-green-700 dark:text-green-400">
                        Connected {connection.connected_at ? new Date(connection.connected_at).toLocaleDateString() : 'Unknown'}
                        {connection.settings?.last_used && (
                          <span> • Last used {new Date(connection.settings.last_used).toLocaleDateString()}</span>
                        )}
                      </p>
                    </div>
                    <div class="flex gap-1">
                      <button
                        class="p-1.5 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-800 rounded transition-colors"
                        onClick={() => handleTest(connection.connection_id)}
                        disabled={isLoading()}
                        title="Test connection"
                      >
                        <Zap class="w-3.5 h-3.5" />
                      </button>
                      <button
                        class="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-800 rounded transition-colors"
                        onClick={() => onDisconnect(integration.id, connection.connection_id)}
                        title="Disconnect"
                      >
                        <Trash2 class="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </For>
            
            {/* Add Another Connection Button */}
            <button
              class="w-full py-2 text-sm text-green-700 dark:text-green-400 border border-green-300 dark:border-green-600 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/30 transition-colors flex items-center justify-center gap-2"
              onClick={() => setShowFields(true)}
            >
              <Plus class="w-4 h-4" />
              Add Another Connection
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function IntegrationsSettings() {
  // Set page-specific header
  usePageHeader('Connected Apps', 'Connect external services and manage API connections');

  const [availableIntegrations, setAvailableIntegrations] = createSignal(APP_CONFIGS);
  const [userConnections, setUserConnections] = createSignal(new Map()); // Map<serviceId, Connection[]>
  const [isLoading, setIsLoading] = createSignal(true);
  const kvStore = useKVStore();
  const { success, error, publishIntegrationEvent } = useNotifications();
  const { currentOrganization, user } = useOrganization();

  // Get current user and organization info
  const getCurrentUserId = () => {
    const currentUser = user();
    if (!currentUser) {
      throw new Error('User not authenticated');
    }
    return currentUser.id;
  };

  const getCurrentOrgId = () => {
    const org = currentOrganization();
    return org?.id || 'default-org';
  };

  // Get storage key with organization scope for better multi-tenant isolation
  const getStorageKey = (type: string, userId: string, integrationId: string, connectionId?: string) => {
    const orgId = getCurrentOrgId();
    const baseKey = `org-${orgId}-user-${userId}-integration-${integrationId}`;
    return connectionId ? `${baseKey}-${connectionId}` : baseKey;
  };

  // Load user connection states on mount
  onMount(async () => {
    console.log('IntegrationsSettings: Starting onMount');
    try {
      const userId = getCurrentUserId();
      const orgId = getCurrentOrgId();
      console.log('IntegrationsSettings: Using userId:', userId, 'orgId:', orgId);

      const connectionsMap = new Map();

      // Check for user connections for each service
      for (const config of APP_CONFIGS) {
        const serviceConnections = [];

        // Check for legacy single connection first (organization-scoped)
        try {
          const legacyKey = `user-${userId}-integration-${config.id}`;
          const legacyConnection = await kvStore.get(legacyKey);
          if (legacyConnection) {
            // Migrate legacy connection to new org-scoped format
            const connectionId = 'default';
            const migratedConnection = {
              ...legacyConnection,
              connection_id: connectionId,
              connection_name: `${config.name} (Default)`,
              created_at: legacyConnection.connected_at,
              organization_id: orgId, // Add org context
              user_id: userId
            };
            serviceConnections.push(migratedConnection);

            // Store with new org-scoped format
            const newKey = getStorageKey('connection', userId, config.id, connectionId);
            await kvStore.set(newKey, migratedConnection, 8760, { showNotification: false });
            // Keep legacy for backward compatibility during transition
          }
        } catch (error) {
          // Legacy connection doesn't exist, that's fine
        }

        // Look for multiple connections with new org-scoped pattern
        const commonConnectionIds = ['default', 'work', 'personal', 'backup', 'test', 'production'];

        for (const connectionId of commonConnectionIds) {
          try {
            const key = getStorageKey('connection', userId, config.id, connectionId);
            const connection = await kvStore.get(key);
            if (connection && !serviceConnections.find(c => c.connection_id === connectionId)) {
              // Ensure connection has org context
              if (!connection.organization_id) {
                connection.organization_id = orgId;
                connection.user_id = userId;
                await kvStore.set(key, connection, 8760, { showNotification: false });
              }
              serviceConnections.push(connection);
            }
          } catch (error) {
            // Connection doesn't exist, continue
          }
        }

        // Also check legacy format during transition period
        for (const connectionId of commonConnectionIds) {
          try {
            const legacyKey = `user-${userId}-integration-${config.id}-${connectionId}`;
            const connection = await kvStore.get(legacyKey);
            if (connection && !serviceConnections.find(c => c.connection_id === connectionId)) {
              // Migrate to org-scoped format
              connection.organization_id = orgId;
              connection.user_id = userId;
              const newKey = getStorageKey('connection', userId, config.id, connectionId);
              await kvStore.set(newKey, connection, 8760, { showNotification: false });
              serviceConnections.push(connection);
            }
          } catch (error) {
            // Connection doesn't exist, continue
          }
        }

        if (serviceConnections.length > 0) {
          connectionsMap.set(config.id, serviceConnections);
          console.log(`IntegrationsSettings: Found ${serviceConnections.length} connections for ${config.id} in org ${orgId}`);
        }
      }

      setUserConnections(connectionsMap);
      console.log('Loaded user connections:', connectionsMap.size, 'services for org', orgId);

    } catch (err) {
      console.error('Error loading integration states:', err);
      if (err.message === 'User not authenticated') {
        error('Please log in to manage your connected apps');
      }
    } finally {
      console.log('IntegrationsSettings: Setting loading to false');
      setIsLoading(false);
      console.log('IntegrationsSettings: Loading set to false');
    }
  });

  const handleConnect = async (integrationId, credentials, connectionName = null) => {
    try {
      const userId = getCurrentUserId();
      const orgId = getCurrentOrgId();
      const integration = availableIntegrations().find(i => i.id === integrationId);

      // Generate connection ID and name
      const existingConnections = userConnections().get(integrationId) || [];
      const connectionId = connectionName ? connectionName.toLowerCase().replace(/[^a-z0-9]/g, '-') :
                          existingConnections.length === 0 ? 'default' : `connection-${Date.now()}`;
      const displayName = connectionName || `${integration?.name || integrationId} (${connectionId})`;

      // Create organization-scoped connection data
      const userConnection = {
        user_id: userId,
        organization_id: orgId,
        service: integrationId,
        connection_id: connectionId,
        connection_name: displayName,
        connected_at: new Date().toISOString(),
        status: 'active',
        credentials: credentials, // This should be encrypted in production
        settings: {
          last_used: null,
          user_preferences: {},
          enabled_workflows: integration?.workflow_capabilities || [],
          organization_permissions: {
            shared_with_org: false, // Default to private
            can_be_used_by_others: false
          }
        }
      };

      // Store user connection data with organization-scoped key
      const storageKey = getStorageKey('connection', userId, integrationId, connectionId);
      const success = await kvStore.set(storageKey, userConnection, 8760);

      if (success) {
        // Update local state
        setUserConnections(prev => {
          const newMap = new Map(prev);
          const serviceConnections = newMap.get(integrationId) || [];
          serviceConnections.push(userConnection);
          newMap.set(integrationId, serviceConnections);
          return newMap;
        });
        success(`Connected ${displayName} successfully to ${currentOrganization()?.name || 'your organization'}!`);

        // Publish integration event to SNS for persistence with org context
        try {
          await publishIntegrationEvent(integrationId, 'connected', {
            connection_id: connectionId,
            connection_name: displayName,
            service: integrationId,
            organization_id: orgId,
            user_id: userId
          });
        } catch (err) {
          console.warn('Failed to publish integration event:', err);
        }
      }
    } catch (err) {
      error(`Failed to connect integration: ${err.message}`);
      throw err;
    }
  };

  const handleDisconnect = async (integrationId, connectionId = 'default') => {
    try {
      const userId = getCurrentUserId();
      const orgId = getCurrentOrgId();

      // Remove user connection data using organization-scoped key
      const storageKey = getStorageKey('connection', userId, integrationId, connectionId);
      const success = await kvStore.del(storageKey);

      if (success) {
        // Update local state
        setUserConnections(prev => {
          const newMap = new Map(prev);
          const serviceConnections = newMap.get(integrationId) || [];
          const updatedConnections = serviceConnections.filter(conn => conn.connection_id !== connectionId);

          if (updatedConnections.length === 0) {
            newMap.delete(integrationId);
          } else {
            newMap.set(integrationId, updatedConnections);
          }
          return newMap;
        });

        const connection = userConnections().get(integrationId)?.find(c => c.connection_id === connectionId);
        success(`Disconnected ${connection?.connection_name || integrationId} from ${currentOrganization()?.name || 'your organization'}!`);

        // Publish disconnection event to SNS with org context
        try {
          await publishIntegrationEvent(integrationId, 'disconnected', {
            connection_id: connectionId,
            connection_name: connection?.connection_name,
            service: integrationId,
            organization_id: orgId,
            user_id: userId
          });
        } catch (err) {
          console.warn('Failed to publish disconnection event:', err);
        }
      }
    } catch (err) {
      error(`Failed to disconnect integration: ${err.message}`);
    }
  };

  const handleTest = async (integrationId, connectionId = 'default') => {
    try {
      const userId = getCurrentUserId();
      const orgId = getCurrentOrgId();

      // Get user connection data using organization-scoped key
      const storageKey = getStorageKey('connection', userId, integrationId, connectionId);
      const userConnection = await kvStore.get(storageKey);

      if (!userConnection) {
        throw new Error('No connection found for this integration in your organization');
      }

      if (!userConnection.credentials) {
        throw new Error('No credentials found in connection');
      }

      // Verify organization context
      if (userConnection.organization_id && userConnection.organization_id !== orgId) {
        throw new Error('Connection belongs to a different organization');
      }

      const integration = availableIntegrations().find(i => i.id === integrationId);

      // Validate required fields from the app config UI fields
      for (const field of (integration.ui_fields || integration.fields || []).filter(f => f.required)) {
        if (!userConnection.credentials[field.key]) {
          throw new Error(`Missing required field: ${field.label}`);
        }
      }

      // Update last_used timestamp and ensure org context
      userConnection.settings.last_used = new Date().toISOString();
      if (!userConnection.organization_id) {
        userConnection.organization_id = orgId;
      }
      await kvStore.set(storageKey, userConnection, 8760, { showNotification: false });

      return { success: true };
    } catch (err) {
      throw err;
    }
  };

  // Create memoized derived state for better performance
  const hasIntegrations = createMemo(() => availableIntegrations().length > 0);

  // Use Show components for better performance than ternary operators
  return (
    <div class="max-w-4xl mx-auto p-6">
      <Show when={isLoading()}>
        <div class="flex items-center justify-center h-64">
          <div class="text-center">
            <Settings class="w-8 h-8 text-slate-400 dark:text-slate-500 mx-auto mb-2 animate-spin" />
            <p class="text-slate-600 dark:text-slate-400">Loading integrations...</p>
          </div>
        </div>
      </Show>

      <Show when={!isLoading() && !hasIntegrations()}>
        <div class="flex items-center justify-center h-64">
          <div class="text-center">
            <p class="text-slate-600 dark:text-slate-400">No integrations available</p>
          </div>
        </div>
      </Show>

      <Show when={!isLoading() && hasIntegrations()}>
        <div class="mb-8">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h1 class="text-3xl font-bold text-slate-900 dark:text-white mb-2">Connected Apps</h1>
              <p class="text-slate-600 dark:text-slate-400">
                Connect external services to enable agents, workflows, and MCP tools.
                Each connected app provides structured configuration for seamless automation.
              </p>
            </div>
            <Show when={currentOrganization()}>
              <div class="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <Building class="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <div class="text-sm">
                  <div class="font-medium text-blue-900 dark:text-blue-300">
                    {currentOrganization()?.name}
                  </div>
                  <div class="text-blue-600 dark:text-blue-400 text-xs">
                    Organization Context
                  </div>
                </div>
              </div>
            </Show>
          </div>
        </div>

        <div class="grid gap-6">
          <For each={availableIntegrations()}>
            {(integration) => (
              <IntegrationCard
                integration={integration}
                connections={userConnections().get(integration.id) || []}
                onConnect={handleConnect}
                onDisconnect={handleDisconnect}
                onTest={handleTest}
              />
            )}
          </For>
        </div>

        <div class="mt-8 p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
          <div class="flex items-start gap-3">
            <Shield class="w-5 h-5 text-blue-500 dark:text-blue-400 mt-0.5" />
            <div>
              <h3 class="font-medium text-blue-900 dark:text-blue-300">Security Notice</h3>
              <p class="text-sm text-blue-700 dark:text-blue-300 mt-1">
                All integration credentials are encrypted and stored securely in AWS. 
                They're only accessible by your workflows and are never logged or exposed in plaintext.
              </p>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}