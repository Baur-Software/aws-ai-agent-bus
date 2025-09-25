import { createSignal, createMemo, Show, createEffect } from 'solid-js';
import { usePageHeader } from '../contexts/HeaderContext';
import { useIntegrations } from '../contexts/IntegrationsContext';
import { useOrganization } from '../contexts/OrganizationContext';
import IntegrationsGrid from './IntegrationsGrid';
import {
  Settings, Slack, Github, Database, ChartColumn, CreditCard, Globe, Shield, Users, Building
} from 'lucide-solid';

// App configuration templates - these get stored as integration-<service> keys
const APP_CONFIGS = [
  {
    id: 'google-analytics',
    name: 'Google Analytics',
    icon: ChartColumn,
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

export default function IntegrationsSettings() {
  usePageHeader('Connected Apps', 'Connect external services and manage API connections');

  const integrations = useIntegrations();
  const { currentOrganization } = useOrganization();
  const [availableIntegrations] = createSignal(APP_CONFIGS);

  // Initialize data loading when component mounts
  createEffect(() => {
    Promise.all(
      APP_CONFIGS.map(config =>
        integrations.loadIntegrationConnections(config.id).catch(console.error)
      )
    );
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