import { createSignal, For, Show } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import {
  Plus, Trash2, CircleCheckBig, XCircle, CircleQuestionMark, Zap, Server
} from 'lucide-solid';
import { useNotifications } from '../contexts/NotificationContext';

// Icon mapping for custom integrations that use string icon names
const iconMap: Record<string, any> = {
  'Server': Server,
  'server': Server
};

interface IntegrationConnection {
  connection_id: string;
  connection_name?: string;
  organization_id: string;
  user_id: string;
  connected_at: string;
  credentials?: Record<string, any>;
  settings?: {
    last_used?: string | null;
    user_preferences?: Record<string, any>;
    enabled_workflows?: string[];
  };
}

interface IntegrationConfig {
  id: string;
  name: string;
  icon: any;
  color: string;
  description: string;
  docsUrl: string;
  ui_fields?: Array<{
    key: string;
    label: string;
    type: string;
    required: boolean;
  }>;
  fields?: Array<{
    key: string;
    label: string;
    type: string;
    required: boolean;
  }>;
}

interface IntegrationCardProps {
  integration: IntegrationConfig;
  connections?: IntegrationConnection[];
  onConnect: (integrationId: string, credentials: Record<string, any>, connectionName?: string | null) => Promise<void>;
  onDisconnect: (integrationId: string, connectionId?: string) => Promise<void>;
  onTest: (integrationId: string, connectionId?: string) => Promise<any>;
}

export default function IntegrationCard(props: IntegrationCardProps) {
  const [showFields, setShowFields] = createSignal(false);
  const [formData, setFormData] = createSignal({});
  const [connectionName, setConnectionName] = createSignal('');
  const [isLoading, setIsLoading] = createSignal(false);

  const { success, error } = useNotifications();

  const connections = () => props.connections || [];
  const isConnected = () => connections().length > 0;
  const hasMultipleConnections = () => connections().length > 1;

  // Get the icon component - handle both component references and string names
  const IconComponent = () => {
    const icon = props.integration.icon;
    if (typeof icon === 'string') {
      return iconMap[icon] || Server; // Fallback to Server icon
    }
    return icon;
  };

  const handleFieldChange = (key: string, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleConnect = async () => {
    setIsLoading(true);
    try {
      await props.onConnect(props.integration.id, formData(), connectionName().trim() || null);
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
      const result = await props.onTest(props.integration.id, connectionId);
      success(`✅ Connection test successful for ${props.integration.name}`);
    } catch (err: any) {
      error(`❌ Connection test failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
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
          <div class={`p-3 rounded-lg ${props.integration.color} text-white ${isConnected() ? 'ring-2 ring-green-200 dark:ring-green-700' : ''}`}>
            <Dynamic component={IconComponent()} class="w-6 h-6" />
          </div>
          <div class="flex-1">
            <div class="flex items-center gap-2">
              <h3 class="text-lg font-semibold text-slate-900 dark:text-white">{props.integration.name}</h3>
              <a
                href={props.integration.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                class="text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                title="View documentation"
                onClick={(e) => e.stopPropagation()}
              >
                <CircleQuestionMark class="w-4 h-4" />
              </a>
            </div>
            <p class="text-sm text-slate-600 dark:text-slate-400">{props.integration.description}</p>
          </div>
        </div>
        <div class="flex flex-col items-end gap-1">
          <div class="flex items-center gap-2">
            {isConnected() ? (
              <>
                <CircleCheckBig class="w-5 h-5 text-green-600" />
                <span class="text-sm text-green-700 dark:text-green-400 font-medium">
                  {hasMultipleConnections() ? `${connections().length} Connections` : 'Connected'}
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


      {showFields() && (
        <div class="mb-4 p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
          <h4 class="text-sm font-medium text-slate-900 dark:text-white mb-3">New Connection</h4>
          <div class="space-y-3">
            <div>
              <label class="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Connection Name {hasMultipleConnections() || connectionName() ? '(optional)' : ''}
              </label>
              <input
                type="text"
                class="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                placeholder={`${props.integration.name} ${connections().length > 0 ? '(Work Account)' : '(Default)'}`}
                value={connectionName()}
                onInput={(e) => setConnectionName(e.target.value)}
              />
            </div>

            <For each={props.integration.ui_fields || props.integration.fields}>
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

      {isConnected() && (
        <div class="pt-4 border-t border-green-200 dark:border-green-800">
          <div class="space-y-3">
            <For each={connections()}>
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
                        onClick={() => props.onDisconnect(props.integration.id, connection.connection_id)}
                        title="Disconnect"
                      >
                        <Trash2 class="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </For>

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