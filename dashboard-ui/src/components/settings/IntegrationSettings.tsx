// Integration Settings Component
// Manages third-party service integrations for workflows

import { createSignal, createResource, Show, For, onMount } from 'solid-js';
import { 
  Settings, CheckCircle, AlertCircle, Plus, Trash2, Edit, 
  Eye, EyeOff, Key, Globe, Database, BarChart3, Trello,
  Slack, Github, CreditCard, Mail, Phone, Users, Zap,
  RefreshCw, Download, Upload, Shield, Info
} from 'lucide-solid';
import { WorkflowStorageService } from '../../services/WorkflowStorageService';
import { serviceRegistry } from '../../services';

interface IntegrationSettingsProps {
  workflowStorage: WorkflowStorageService;
}

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: any;
  color: string;
  status: 'connected' | 'disconnected' | 'error' | 'testing';
  lastTested?: string;
  errorMessage?: string;
  requiredFields: IntegrationField[];
  optionalFields?: IntegrationField[];
  connectionCount?: number;
  usageCount?: number;
}

interface IntegrationField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'url' | 'email' | 'number' | 'select';
  placeholder?: string;
  required: boolean;
  description?: string;
  options?: { value: string; label: string }[];
  validation?: (value: string) => string | null;
}

interface IntegrationConnection {
  id: string;
  name: string;
  integrationId: string;
  credentials: Record<string, any>;
  status: 'active' | 'inactive' | 'error';
  lastUsed?: string;
  createdAt: string;
}

const AVAILABLE_INTEGRATIONS: Integration[] = [
  {
    id: 'google-analytics',
    name: 'Google Analytics',
    description: 'Connect to Google Analytics 4 for traffic data and insights',
    icon: BarChart3,
    color: 'bg-orange-500',
    status: 'disconnected',
    requiredFields: [
      {
        key: 'propertyId',
        label: 'GA4 Property ID',
        type: 'text',
        placeholder: '123456789',
        required: true,
        description: 'Your Google Analytics 4 property ID',
        validation: (value) => /^\d+$/.test(value) ? null : 'Must be numeric'
      },
      {
        key: 'clientId',
        label: 'OAuth Client ID',
        type: 'text',
        placeholder: 'your-client-id.googleusercontent.com',
        required: true,
        description: 'OAuth 2.0 client ID from Google Cloud Console'
      },
      {
        key: 'clientSecret',
        label: 'OAuth Client Secret',
        type: 'password',
        required: true,
        description: 'OAuth 2.0 client secret from Google Cloud Console'
      }
    ],
    connectionCount: 0,
    usageCount: 0
  },
  {
    id: 'trello',
    name: 'Trello',
    description: 'Create cards, boards, and manage tasks in Trello',
    icon: Trello,
    color: 'bg-blue-500',
    status: 'disconnected',
    requiredFields: [
      {
        key: 'apiKey',
        label: 'API Key',
        type: 'text',
        required: true,
        description: 'Your Trello API key from https://trello.com/app-key'
      },
      {
        key: 'token',
        label: 'API Token',
        type: 'password',
        required: true,
        description: 'Your Trello API token (generated after getting API key)'
      }
    ],
    optionalFields: [
      {
        key: 'defaultBoardId',
        label: 'Default Board ID',
        type: 'text',
        required: false,
        description: 'Optional default board for new cards'
      }
    ],
    connectionCount: 0,
    usageCount: 0
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Send messages and notifications to Slack channels',
    icon: Slack,
    color: 'bg-purple-500',
    status: 'disconnected',
    requiredFields: [
      {
        key: 'botToken',
        label: 'Bot Token',
        type: 'password',
        placeholder: 'xoxb-...',
        required: true,
        description: 'Slack bot token starting with xoxb-'
      },
      {
        key: 'signingSecret',
        label: 'Signing Secret',
        type: 'password',
        required: true,
        description: 'Slack app signing secret for webhook verification'
      }
    ],
    optionalFields: [
      {
        key: 'defaultChannel',
        label: 'Default Channel',
        type: 'text',
        placeholder: '#general',
        required: false,
        description: 'Default channel for notifications'
      }
    ],
    connectionCount: 0,
    usageCount: 0
  },
  {
    id: 'github',
    name: 'GitHub',
    description: 'Create issues, manage repositories, and trigger workflows',
    icon: Github,
    color: 'bg-gray-800',
    status: 'disconnected',
    requiredFields: [
      {
        key: 'accessToken',
        label: 'Personal Access Token',
        type: 'password',
        placeholder: 'ghp_...',
        required: true,
        description: 'GitHub personal access token with repo permissions'
      }
    ],
    optionalFields: [
      {
        key: 'defaultOwner',
        label: 'Default Owner',
        type: 'text',
        placeholder: 'username or organization',
        required: false,
        description: 'Default repository owner for operations'
      },
      {
        key: 'defaultRepo',
        label: 'Default Repository',
        type: 'text',
        placeholder: 'repository-name',
        required: false,
        description: 'Default repository for operations'
      }
    ],
    connectionCount: 0,
    usageCount: 0
  },
  {
    id: 'stripe',
    name: 'Stripe',
    description: 'Process payments and manage customer data',
    icon: CreditCard,
    color: 'bg-indigo-500',
    status: 'disconnected',
    requiredFields: [
      {
        key: 'publishableKey',
        label: 'Publishable Key',
        type: 'text',
        placeholder: 'pk_test_...',
        required: true,
        description: 'Stripe publishable key (starts with pk_)'
      },
      {
        key: 'secretKey',
        label: 'Secret Key',
        type: 'password',
        placeholder: 'sk_test_...',
        required: true,
        description: 'Stripe secret key (starts with sk_)'
      }
    ],
    optionalFields: [
      {
        key: 'webhookSecret',
        label: 'Webhook Secret',
        type: 'password',
        placeholder: 'whsec_...',
        required: false,
        description: 'Webhook endpoint secret for event verification'
      }
    ],
    connectionCount: 0,
    usageCount: 0
  }
];

export default function IntegrationSettings(props: IntegrationSettingsProps) {
  const [integrations, setIntegrations] = createSignal<Integration[]>(AVAILABLE_INTEGRATIONS);
  const [connections, setConnections] = createSignal<IntegrationConnection[]>([]);
  const [editingIntegration, setEditingIntegration] = createSignal<string | null>(null);
  const [testingIntegration, setTestingIntegration] = createSignal<string | null>(null);
  const [showCredentials, setShowCredentials] = createSignal<Record<string, boolean>>({});

  // Load existing connections
  const [existingConnections] = createResource(async () => {
    try {
      // Load all user integration connections
      const userId = props.workflowStorage.getCurrentUserId();
      const connectionKeys = await props.workflowStorage.getUserIntegrationKeys();
      
      const connectionList: IntegrationConnection[] = [];
      
      for (const key of connectionKeys) {
        const connectionData = await props.workflowStorage.getIntegrationConnection(key);
        if (connectionData) {
          connectionList.push(connectionData);
        }
      }
      
      return connectionList;
    } catch (error) {
      console.error('Failed to load integration connections:', error);
      return [];
    }
  });

  // Update integration status based on connections
  onMount(() => {
    const connections = existingConnections();
    if (connections) {
      const updatedIntegrations = integrations().map(integration => {
        const integrationConnections = connections.filter(c => c.integrationId === integration.id);
        return {
          ...integration,
          connectionCount: integrationConnections.length,
          status: integrationConnections.length > 0 ? 'connected' : 'disconnected'
        } as Integration;
      });
      setIntegrations(updatedIntegrations);
      setConnections(connections);
    }
  });

  const handleSaveConnection = async (integrationId: string, credentials: Record<string, any>, connectionName?: string) => {
    try {
      const integration = integrations().find(i => i.id === integrationId);
      if (!integration) return;

      // Validate required fields
      const missingFields = integration.requiredFields.filter(field => !credentials[field.key]);
      if (missingFields.length > 0) {
        alert(`Missing required fields: ${missingFields.map(f => f.label).join(', ')}`);
        return;
      }

      // Validate field formats
      for (const field of integration.requiredFields) {
        if (field.validation && credentials[field.key]) {
          const error = field.validation(credentials[field.key]);
          if (error) {
            alert(`${field.label}: ${error}`);
            return;
          }
        }
      }

      // Create connection
      const connectionId = `${integrationId}-${Date.now()}`;
      const connection: IntegrationConnection = {
        id: connectionId,
        name: connectionName || `${integration.name} Connection`,
        integrationId,
        credentials,
        status: 'active',
        createdAt: new Date().toISOString()
      };

      // Save to storage
      await props.workflowStorage.saveIntegrationConnection(connectionId, connection);

      // Update local state
      setConnections(prev => [...prev, connection]);
      setIntegrations(prev => prev.map(i => 
        i.id === integrationId 
          ? { ...i, connectionCount: (i.connectionCount || 0) + 1, status: 'connected' as const }
          : i
      ));

      setEditingIntegration(null);
      console.log(`✅ Saved connection for ${integration.name}`);
    } catch (error) {
      console.error('Failed to save integration connection:', error);
      alert('Failed to save connection');
    }
  };

  const handleTestConnection = async (integrationId: string, credentials: Record<string, any>) => {
    setTestingIntegration(integrationId);
    
    try {
      const integration = integrations().find(i => i.id === integrationId);
      if (!integration) return;

      // Simulate connection test (in real implementation, this would call the actual API)
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // For demo purposes, randomly succeed or fail
      const success = Math.random() > 0.3;
      
      if (success) {
        setIntegrations(prev => prev.map(i => 
          i.id === integrationId 
            ? { ...i, status: 'connected', lastTested: new Date().toISOString() }
            : i
        ));
        alert('Connection test successful!');
      } else {
        setIntegrations(prev => prev.map(i => 
          i.id === integrationId 
            ? { ...i, status: 'error', errorMessage: 'Invalid credentials or API error' }
            : i
        ));
        alert('Connection test failed. Please check your credentials.');
      }
    } catch (error) {
      console.error('Connection test failed:', error);
      alert('Connection test failed');
    } finally {
      setTestingIntegration(null);
    }
  };

  const handleDeleteConnection = async (connectionId: string) => {
    if (!confirm('Are you sure you want to delete this connection?')) return;

    try {
      await props.workflowStorage.deleteIntegrationConnection(connectionId);
      
      const deletedConnection = connections().find(c => c.id === connectionId);
      if (deletedConnection) {
        setConnections(prev => prev.filter(c => c.id !== connectionId));
        setIntegrations(prev => prev.map(i => 
          i.id === deletedConnection.integrationId
            ? { ...i, connectionCount: Math.max(0, (i.connectionCount || 1) - 1) }
            : i
        ));
      }
    } catch (error) {
      console.error('Failed to delete connection:', error);
      alert('Failed to delete connection');
    }
  };

  const toggleShowCredentials = (integrationId: string) => {
    setShowCredentials(prev => ({
      ...prev,
      [integrationId]: !prev[integrationId]
    }));
  };

  const getStatusIcon = (status: Integration['status']) => {
    switch (status) {
      case 'connected': return <CheckCircle class="w-5 h-5 text-green-500" />;
      case 'error': return <AlertCircle class="w-5 h-5 text-red-500" />;
      case 'testing': return <RefreshCw class="w-5 h-5 text-blue-500 animate-spin" />;
      default: return <Globe class="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusText = (integration: Integration) => {
    switch (integration.status) {
      case 'connected': return `${integration.connectionCount} connection(s)`;
      case 'error': return integration.errorMessage || 'Connection error';
      case 'testing': return 'Testing connection...';
      default: return 'Not connected';
    }
  };

  return (
    <div class="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h2 class="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Settings class="w-6 h-6" />
          Integration Settings
        </h2>
        <p class="text-gray-600 mt-1">
          Connect third-party services to use in your workflows
        </p>
      </div>

      {/* Integration Overview */}
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="bg-white border border-gray-200 rounded-lg p-4">
          <div class="flex items-center gap-2 mb-2">
            <CheckCircle class="w-5 h-5 text-green-500" />
            <span class="font-medium text-gray-900">Connected</span>
          </div>
          <div class="text-2xl font-bold text-gray-900">
            {integrations().filter(i => i.status === 'connected').length}
          </div>
          <div class="text-sm text-gray-600">Active integrations</div>
        </div>
        
        <div class="bg-white border border-gray-200 rounded-lg p-4">
          <div class="flex items-center gap-2 mb-2">
            <Globe class="w-5 h-5 text-gray-400" />
            <span class="font-medium text-gray-900">Available</span>
          </div>
          <div class="text-2xl font-bold text-gray-900">
            {integrations().length}
          </div>
          <div class="text-sm text-gray-600">Total integrations</div>
        </div>
        
        <div class="bg-white border border-gray-200 rounded-lg p-4">
          <div class="flex items-center gap-2 mb-2">
            <Zap class="w-5 h-5 text-blue-500" />
            <span class="font-medium text-gray-900">Usage</span>
          </div>
          <div class="text-2xl font-bold text-gray-900">
            {connections().length}
          </div>
          <div class="text-sm text-gray-600">Total connections</div>
        </div>
      </div>

      {/* Integration List */}
      <div class="space-y-4">
        <h3 class="text-lg font-semibold text-gray-900">Available Integrations</h3>
        
        <For each={integrations()}>
          {(integration) => (
            <div class="bg-white border border-gray-200 rounded-lg p-6">
              <div class="flex items-start justify-between">
                <div class="flex items-start gap-4">
                  <div class={`p-3 rounded-lg ${integration.color} text-white`}>
                    <integration.icon class="w-6 h-6" />
                  </div>
                  
                  <div class="flex-1">
                    <div class="flex items-center gap-2 mb-1">
                      <h4 class="text-lg font-medium text-gray-900">{integration.name}</h4>
                      {getStatusIcon(integration.status)}
                    </div>
                    
                    <p class="text-gray-600 mb-2">{integration.description}</p>
                    
                    <div class="text-sm text-gray-500">
                      {getStatusText(integration)}
                    </div>
                  </div>
                </div>
                
                <div class="flex items-center gap-2">
                  <Show when={integration.status === 'connected'}>
                    <button
                      onClick={() => setEditingIntegration(
                        editingIntegration() === integration.id ? null : integration.id
                      )}
                      class="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                      Manage
                    </button>
                  </Show>
                  
                  <Show when={integration.status !== 'connected'}>
                    <button
                      onClick={() => setEditingIntegration(
                        editingIntegration() === integration.id ? null : integration.id
                      )}
                      class="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                      Connect
                    </button>
                  </Show>
                </div>
              </div>

              {/* Connection Configuration */}
              <Show when={editingIntegration() === integration.id}>
                <IntegrationForm
                  integration={integration}
                  onSave={(credentials, name) => handleSaveConnection(integration.id, credentials, name)}
                  onTest={(credentials) => handleTestConnection(integration.id, credentials)}
                  onCancel={() => setEditingIntegration(null)}
                  testing={testingIntegration() === integration.id}
                  showCredentials={showCredentials()[integration.id] || false}
                  onToggleShowCredentials={() => toggleShowCredentials(integration.id)}
                />
              </Show>

              {/* Existing Connections */}
              <Show when={integration.status === 'connected'}>
                <div class="mt-4 pt-4 border-t border-gray-200">
                  <h5 class="text-sm font-medium text-gray-700 mb-3">Active Connections</h5>
                  <div class="space-y-2">
                    <For each={connections().filter(c => c.integrationId === integration.id)}>
                      {(connection) => (
                        <div class="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                          <div>
                            <div class="font-medium text-gray-900">{connection.name}</div>
                            <div class="text-sm text-gray-500">
                              Created {new Date(connection.createdAt).toLocaleDateString()}
                              {connection.lastUsed && ` • Last used ${new Date(connection.lastUsed).toLocaleDateString()}`}
                            </div>
                          </div>
                          <div class="flex items-center gap-2">
                            <span class={`px-2 py-1 text-xs rounded-full ${
                              connection.status === 'active' ? 'bg-green-100 text-green-800' :
                              connection.status === 'error' ? 'bg-red-100 text-red-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {connection.status}
                            </span>
                            <button
                              onClick={() => handleDeleteConnection(connection.id)}
                              class="p-1 text-red-600 hover:bg-red-50 rounded"
                            >
                              <Trash2 class="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </For>
                  </div>
                </div>
              </Show>
            </div>
          )}
        </For>
      </div>

      {/* Help & Documentation */}
      <div class="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 class="text-lg font-semibold text-blue-900 mb-4 flex items-center gap-2">
          <Info class="w-5 h-5" />
          Integration Help
        </h3>
        
        <div class="space-y-3 text-sm text-blue-800">
          <div>
            <strong>Google Analytics:</strong> Requires OAuth 2.0 setup in Google Cloud Console. 
            Enable the Analytics Reporting API and create OAuth credentials.
          </div>
          
          <div>
            <strong>Trello:</strong> Get your API key from https://trello.com/app-key and generate a token 
            with read/write permissions for your boards.
          </div>
          
          <div>
            <strong>Slack:</strong> Create a Slack app in your workspace with bot permissions. 
            Install the app to get the bot token.
          </div>
          
          <div>
            <strong>GitHub:</strong> Generate a personal access token with appropriate repository permissions. 
            Fine-grained tokens are recommended for better security.
          </div>
          
          <div>
            <strong>Stripe:</strong> Use test keys for development and live keys for production. 
            Webhook endpoints are optional but recommended for event handling.
          </div>
        </div>
      </div>
    </div>
  );
}

// Integration Form Component
function IntegrationForm(props: {
  integration: Integration;
  onSave: (credentials: Record<string, any>, name?: string) => void;
  onTest: (credentials: Record<string, any>) => void;
  onCancel: () => void;
  testing: boolean;
  showCredentials: boolean;
  onToggleShowCredentials: () => void;
}) {
  const [credentials, setCredentials] = createSignal<Record<string, any>>({});
  const [connectionName, setConnectionName] = createSignal('');

  const updateCredential = (key: string, value: string) => {
    setCredentials(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    props.onSave(credentials(), connectionName() || undefined);
  };

  const handleTest = () => {
    props.onTest(credentials());
  };

  return (
    <div class="mt-4 pt-4 border-t border-gray-200">
      <form onSubmit={handleSubmit} class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Connection Name (Optional)
          </label>
          <input
            type="text"
            value={connectionName()}
            onInput={(e) => setConnectionName(e.target.value)}
            placeholder={`${props.integration.name} Connection`}
            class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          />
        </div>

        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <h5 class="text-sm font-medium text-gray-700">Required Fields</h5>
            <button
              type="button"
              onClick={props.onToggleShowCredentials}
              class="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
            >
              {props.showCredentials ? <EyeOff class="w-3 h-3" /> : <Eye class="w-3 h-3" />}
              {props.showCredentials ? 'Hide' : 'Show'} values
            </button>
          </div>

          <For each={props.integration.requiredFields}>
            {(field) => (
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  {field.label} {field.required && <span class="text-red-500">*</span>}
                </label>
                <input
                  type={field.type === 'password' && !props.showCredentials ? 'password' : 'text'}
                  value={credentials()[field.key] || ''}
                  onInput={(e) => updateCredential(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  required={field.required}
                  class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
                <Show when={field.description}>
                  <p class="text-xs text-gray-500 mt-1">{field.description}</p>
                </Show>
              </div>
            )}
          </For>
        </div>

        <Show when={props.integration.optionalFields && props.integration.optionalFields.length > 0}>
          <div class="space-y-3">
            <h5 class="text-sm font-medium text-gray-700">Optional Fields</h5>
            <For each={props.integration.optionalFields}>
              {(field) => (
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    {field.label}
                  </label>
                  <input
                    type={field.type === 'password' && !props.showCredentials ? 'password' : 'text'}
                    value={credentials()[field.key] || ''}
                    onInput={(e) => updateCredential(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  />
                  <Show when={field.description}>
                    <p class="text-xs text-gray-500 mt-1">{field.description}</p>
                  </Show>
                </div>
              )}
            </For>
          </div>
        </Show>

        <div class="flex items-center gap-3">
          <button
            type="submit"
            class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
          >
            Save Connection
          </button>
          
          <button
            type="button"
            onClick={handleTest}
            disabled={props.testing}
            class="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm disabled:opacity-50"
          >
            {props.testing ? <RefreshCw class="w-4 h-4 animate-spin inline mr-1" /> : null}
            Test Connection
          </button>
          
          <button
            type="button"
            onClick={props.onCancel}
            class="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}