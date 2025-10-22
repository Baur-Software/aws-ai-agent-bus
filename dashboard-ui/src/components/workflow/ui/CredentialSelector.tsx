import { createSignal, createEffect, For, Show } from 'solid-js';
import { useIntegrations } from '../../../contexts/IntegrationsContext';
import { useOrganization } from '../../../contexts/OrganizationContext';
import { buildCredentialPath } from '../../../utils/credentialResolver';
import { Key, Plus, CheckCircle, XCircle, AlertCircle, ExternalLink } from 'lucide-solid';

interface CredentialSelectorProps {
  /** Integration/service ID (e.g., 'google-analytics', 'slack', 'github') */
  integrationId: string;

  /** Currently selected credential path (full KV store path) */
  value?: string;

  /** Callback when a connection is selected - receives the full credential path */
  onChange: (credentialPath: string) => void;

  /** Optional label override */
  label?: string;

  /** Show connection status indicators */
  showStatus?: boolean;

  /** Allow creating new connection inline */
  allowCreate?: boolean;

  /** Show test connection button */
  showTest?: boolean;
}

export function CredentialSelector(props: CredentialSelectorProps) {
  const integrations = useIntegrations();
  const { currentOrganization, user } = useOrganization();
  const [isTesting, setIsTesting] = createSignal(false);
  const [testResult, setTestResult] = createSignal<{ success: boolean; message: string } | null>(null);

  // Load connections for this integration when component mounts
  createEffect(() => {
    if (props.integrationId) {
      integrations.loadIntegrationConnections(props.integrationId);
    }
  });

  const connections = () => integrations.getConnectionsForIntegration(props.integrationId);
  const hasConnections = () => connections().length > 0;

  // Get current user and org context
  const getUserId = () => user()?.id || 'demo-user-123';
  const getOrgId = () => currentOrganization()?.id || 'default-org';

  // Build credential path for a connection
  const buildPathForConnection = (connectionId: string) => {
    return buildCredentialPath(props.integrationId, connectionId, {
      orgId: getOrgId(),
      userId: getUserId()
    });
  };

  // Extract connection ID from credential path (for display)
  const getConnectionIdFromPath = (credentialPath?: string) => {
    if (!credentialPath) return '';
    // Parse: "org-{orgId}-user-{userId}-integration-{integrationId}-{connectionId}"
    const parts = credentialPath.split('-');
    const integrationIndex = parts.indexOf('integration');
    if (integrationIndex >= 0 && integrationIndex < parts.length - 2) {
      // Everything after "integration-{integrationId}-" is the connectionId
      return parts.slice(integrationIndex + 2).join('-');
    }
    return '';
  };

  const selectedConnectionId = () => getConnectionIdFromPath(props.value);

  const handleTestConnection = async () => {
    const connectionId = selectedConnectionId();
    if (!connectionId) return;

    setIsTesting(true);
    setTestResult(null);

    try {
      const result = await integrations.testConnection(props.integrationId, connectionId);
      setTestResult(result);

      // Clear test result after 3 seconds
      setTimeout(() => setTestResult(null), 3000);
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : 'Test failed'
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleCreateConnection = () => {
    // Navigate to integrations settings to add connection
    window.location.hash = '#/settings/integrations';
  };

  const getConnectionLabel = (connection: any) => {
    return connection.connection_name ||
           `${props.integrationId} (${connection.connection_id})`;
  };

  return (
    <div class="space-y-2">
      {/* Label */}
      <label class="block text-sm font-medium text-slate-700 dark:text-slate-300">
        <div class="flex items-center gap-2">
          <Key class="w-4 h-4" />
          {props.label || 'Connection'}
          <span class="text-red-500">*</span>
        </div>
      </label>

      {/* No Connections State */}
      <Show when={!hasConnections()}>
        <div class="p-4 bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-200 dark:border-yellow-800 rounded-lg">
          <div class="flex items-start gap-3">
            <AlertCircle class="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
            <div class="flex-1">
              <p class="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                No {props.integrationId} connection found
              </p>
              <p class="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                You need to connect your {props.integrationId} account before using this node.
              </p>
              <Show when={props.allowCreate !== false}>
                <button
                  type="button"
                  onClick={handleCreateConnection}
                  class="mt-3 inline-flex items-center gap-1 px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 text-white text-sm font-medium rounded-md transition-colors"
                >
                  <Plus class="w-4 h-4" />
                  Connect {props.integrationId}
                  <ExternalLink class="w-3 h-3" />
                </button>
              </Show>
            </div>
          </div>
        </div>
      </Show>

      {/* Connection Selector */}
      <Show when={hasConnections()}>
        <div class="space-y-2">
          <select
            class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={selectedConnectionId()}
            onChange={(e) => {
              const connectionId = e.currentTarget.value;
              const credentialPath = buildPathForConnection(connectionId);
              props.onChange(credentialPath);
            }}
          >
            <option value="" disabled>Select a connection...</option>
            <For each={connections()}>
              {(connection) => (
                <option value={connection.connection_id}>
                  {getConnectionLabel(connection)}
                </option>
              )}
            </For>
          </select>

          {/* Connection Status & Actions */}
          <div class="flex items-center justify-between text-xs">
            <div class="flex items-center gap-2">
              <Show when={props.showStatus !== false && props.value}>
                <div class="flex items-center gap-1 text-green-600 dark:text-green-400">
                  <CheckCircle class="w-3 h-3" />
                  <span>Connected</span>
                </div>
              </Show>

              <Show when={testResult()}>
                <div class={`flex items-center gap-1 ${
                  testResult()!.success
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  {testResult()!.success ? (
                    <CheckCircle class="w-3 h-3" />
                  ) : (
                    <XCircle class="w-3 h-3" />
                  )}
                  <span>{testResult()!.message}</span>
                </div>
              </Show>
            </div>

            <div class="flex items-center gap-2">
              <Show when={props.showTest !== false && props.value}>
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={isTesting()}
                  class="text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
                >
                  {isTesting() ? 'Testing...' : 'Test Connection'}
                </button>
              </Show>

              <Show when={props.allowCreate !== false}>
                <button
                  type="button"
                  onClick={handleCreateConnection}
                  class="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                >
                  <Plus class="w-3 h-3" />
                  Add Another
                </button>
              </Show>
            </div>
          </div>
        </div>
      </Show>

      {/* Help Text */}
      <p class="text-xs text-slate-500 dark:text-slate-400">
        Select which {props.integrationId} account to use for this node
      </p>
    </div>
  );
}
