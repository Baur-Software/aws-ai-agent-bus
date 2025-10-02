import { createSignal, createMemo, Show, createEffect, createResource } from 'solid-js';
import { usePageHeader } from '../contexts/HeaderContext';
import { useIntegrations } from '../contexts/IntegrationsContext';
import { useOrganization } from '../contexts/OrganizationContext';
import { useEventDrivenAppConfigs } from '../hooks/useEventDrivenKV';
import IntegrationsGrid from './IntegrationsGrid';
import {
  Settings, Shield, Building
} from 'lucide-solid';

export default function IntegrationsSettings() {
  usePageHeader('Connected Apps', 'Connect external services and manage API connections');

  const integrations = useIntegrations();
  const { currentOrganization } = useOrganization();
  const { loadConfigs } = useEventDrivenAppConfigs();

  // Load app configs dynamically from KV store (integration-* keys)
  const [appConfigs] = createResource(async () => {
    const configs = await loadConfigs();
    return configs || [];
  });

  const availableIntegrations = createMemo(() => appConfigs() || []);

  // Initialize data loading when component mounts
  createEffect(() => {
    const configs = availableIntegrations();
    if (configs.length > 0) {
      Promise.all(
        configs.map(config =>
          integrations.loadIntegrationConnections(config.id).catch(console.error)
        )
      );
    }
  });

  const hasIntegrations = createMemo(() => availableIntegrations().length > 0);

  return (
    <div class="max-w-4xl mx-auto p-6">
      <Show when={integrations.isLoading()}>
        <div class="flex items-center justify-center h-64">
          <div class="text-center">
            <Settings class="w-8 h-8 text-slate-400 dark:text-slate-500 mx-auto mb-2 animate-spin" />
            <p class="text-slate-600 dark:text-slate-400">Loading integrations...</p>
          </div>
        </div>
      </Show>

      <Show when={!integrations.isLoading() && !hasIntegrations()}>
        <div class="flex items-center justify-center h-64">
          <div class="text-center">
            <p class="text-slate-600 dark:text-slate-400">No integrations available</p>
          </div>
        </div>
      </Show>

      <Show when={!integrations.isLoading() && hasIntegrations()}>
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

        <IntegrationsGrid integrations={availableIntegrations()} />

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