import { For } from 'solid-js';
import IntegrationCard from './IntegrationCard';
import { useIntegrations } from '../contexts/IntegrationsContext';

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

interface IntegrationsGridProps {
  integrations: IntegrationConfig[];
}

export default function IntegrationsGrid(props: IntegrationsGridProps) {
  const integrations = useIntegrations();

  const handleConnect = async (integrationId: string, credentials: Record<string, any>, connectionName?: string | null) => {
    await integrations.connectIntegration(integrationId, { credentials }, connectionName || 'default');
  };

  return (
    <div class="grid gap-6">
      <For each={props.integrations}>
        {(integration) => (
          <IntegrationCard
            integration={integration}
            connections={integrations.getConnectionsForIntegration(integration.id)}
            onConnect={handleConnect}
            onDisconnect={integrations.disconnectIntegration}
            onTest={integrations.testConnection}
          />
        )}
      </For>
    </div>
  );
}