import { createSignal, createEffect, For, Show, createMemo } from 'solid-js';
import { useDashboardServer } from '../../../contexts/DashboardServerContext';
import { useIntegrations } from '../../../contexts/IntegrationsContext';
import { useOrganization } from '../../../contexts/OrganizationContext';

interface WorkflowCapability {
  id: string;
  name: string;
  description: string;
  requiredApps: string[];
  connectedApps: string[];
  missingApps: string[];
  complexity: 'simple' | 'medium' | 'advanced';
  category: string;
  estimatedTime: string;
  benefits: string[];
  template: {
    nodes: any[];
    connections: any[];
    triggers: string[];
    actions: string[];
  };
}

interface AppCapability {
  appId: string;
  appName: string;
  capabilities: string[];
  triggers: string[];
  actions: string[];
  isConnected: boolean;
}

export default function WorkflowCapabilityGenerator() {
  const dashboardServer = useDashboardServer();
  const integrations = useIntegrations();
  const { currentOrganization } = useOrganization();

  const [loading, setLoading] = createSignal(false);
  const [analyzedCapabilities, setAnalyzedCapabilities] = createSignal<WorkflowCapability[]>([]);
  const [selectedCategory, setSelectedCategory] = createSignal<string>('all');
  const [selectedComplexity, setSelectedComplexity] = createSignal<string>('all');

  // Define app capabilities based on common integrations
  const appCapabilities: AppCapability[] = [
    {
      appId: 'google-analytics',
      appName: 'Google Analytics',
      capabilities: ['web-analytics', 'reporting', 'audience-insights'],
      triggers: ['traffic-spike', 'goal-completion', 'new-audience-segment'],
      actions: ['generate-report', 'create-audience', 'track-event'],
      isConnected: integrations.getConnections('google-analytics').length > 0
    },
    {
      appId: 'slack',
      appName: 'Slack',
      capabilities: ['messaging', 'notifications', 'team-communication'],
      triggers: ['new-message', 'mention', 'channel-activity'],
      actions: ['send-message', 'create-channel', 'invite-user'],
      isConnected: integrations.getConnections('slack').length > 0
    },
    {
      appId: 'github',
      appName: 'GitHub',
      capabilities: ['code-management', 'issue-tracking', 'ci-cd'],
      triggers: ['push', 'pull-request', 'issue-created', 'release'],
      actions: ['create-issue', 'merge-pr', 'create-release', 'update-status'],
      isConnected: integrations.getConnections('github').length > 0
    },
    {
      appId: 'stripe',
      appName: 'Stripe',
      capabilities: ['payments', 'subscriptions', 'invoicing'],
      triggers: ['payment-success', 'payment-failed', 'subscription-created'],
      actions: ['create-customer', 'process-payment', 'send-invoice'],
      isConnected: integrations.getConnections('stripe').length > 0
    }
  ];

  const connectedApps = createMemo(() =>
    appCapabilities.filter(app => app.isConnected)
  );

  const categories = createMemo(() => {
    const cats = new Set(analyzedCapabilities().map(cap => cap.category));
    return ['all', ...Array.from(cats)];
  });

  const filteredCapabilities = createMemo(() => {
    return analyzedCapabilities().filter(cap => {
      const categoryMatch = selectedCategory() === 'all' || cap.category === selectedCategory();
      const complexityMatch = selectedComplexity() === 'all' || cap.complexity === selectedComplexity();
      return categoryMatch && complexityMatch;
    });
  });

  // Generate workflow capabilities based on connected apps
  const generateCapabilities = () => {
    setLoading(true);

    const capabilities: WorkflowCapability[] = [];
    const connected = connectedApps();

    // Single app workflows
    connected.forEach(app => {
      if (app.appId === 'google-analytics') {
        capabilities.push({
          id: 'ga-weekly-report',
          name: 'Weekly Analytics Report',
          description: 'Automatically generate and distribute weekly traffic reports',
          requiredApps: ['google-analytics'],
          connectedApps: ['google-analytics'],
          missingApps: [],
          complexity: 'simple',
          category: 'Analytics',
          estimatedTime: '5 minutes',
          benefits: ['Automated reporting', 'Time savings', 'Consistent insights'],
          template: {
            nodes: [
              { id: 'trigger', type: 'schedule', config: { cron: '0 9 * * 1' } },
              { id: 'analytics', type: 'google-analytics', action: 'get-weekly-report' },
              { id: 'format', type: 'data-processor', action: 'format-report' }
            ],
            connections: [
              { from: 'trigger', to: 'analytics' },
              { from: 'analytics', to: 'format' }
            ],
            triggers: ['schedule'],
            actions: ['generate-report', 'format-data']
          }
        });
      }

      if (app.appId === 'github') {
        capabilities.push({
          id: 'github-release-automation',
          name: 'Release Automation',
          description: 'Automate release notes and deployment notifications',
          requiredApps: ['github'],
          connectedApps: ['github'],
          missingApps: [],
          complexity: 'medium',
          category: 'Development',
          estimatedTime: '15 minutes',
          benefits: ['Consistent releases', 'Automated documentation', 'Team notifications'],
          template: {
            nodes: [
              { id: 'trigger', type: 'github', event: 'release' },
              { id: 'notes', type: 'github', action: 'generate-release-notes' },
              { id: 'deploy', type: 'deployment', action: 'trigger-deployment' }
            ],
            connections: [
              { from: 'trigger', to: 'notes' },
              { from: 'notes', to: 'deploy' }
            ],
            triggers: ['release'],
            actions: ['generate-notes', 'deploy']
          }
        });
      }
    });

    // Multi-app workflows
    if (connected.some(app => app.appId === 'google-analytics') && connected.some(app => app.appId === 'slack')) {
      capabilities.push({
        id: 'analytics-slack-alerts',
        name: 'Traffic Alert System',
        description: 'Send Slack notifications when website traffic spikes or drops',
        requiredApps: ['google-analytics', 'slack'],
        connectedApps: ['google-analytics', 'slack'],
        missingApps: [],
        complexity: 'medium',
        category: 'Monitoring',
        estimatedTime: '20 minutes',
        benefits: ['Real-time alerts', 'Team awareness', 'Quick response to issues'],
        template: {
          nodes: [
            { id: 'trigger', type: 'schedule', config: { interval: '1h' } },
            { id: 'analytics', type: 'google-analytics', action: 'get-realtime-users' },
            { id: 'condition', type: 'condition', config: { operator: '>', threshold: 1000 } },
            { id: 'slack', type: 'slack', action: 'send-message' }
          ],
          connections: [
            { from: 'trigger', to: 'analytics' },
            { from: 'analytics', to: 'condition' },
            { from: 'condition', to: 'slack' }
          ],
          triggers: ['schedule'],
          actions: ['check-traffic', 'send-alert']
        }
      });
    }

    if (connected.some(app => app.appId === 'github') && connected.some(app => app.appId === 'slack')) {
      capabilities.push({
        id: 'github-slack-integration',
        name: 'Development Notifications',
        description: 'Notify team in Slack about pull requests and deployments',
        requiredApps: ['github', 'slack'],
        connectedApps: ['github', 'slack'],
        missingApps: [],
        complexity: 'simple',
        category: 'Development',
        estimatedTime: '10 minutes',
        benefits: ['Team coordination', 'Faster reviews', 'Deployment awareness'],
        template: {
          nodes: [
            { id: 'trigger', type: 'github', event: 'pull_request' },
            { id: 'format', type: 'data-processor', action: 'format-pr-message' },
            { id: 'slack', type: 'slack', action: 'send-message' }
          ],
          connections: [
            { from: 'trigger', to: 'format' },
            { from: 'format', to: 'slack' }
          ],
          triggers: ['pull_request'],
          actions: ['format-message', 'notify-team']
        }
      });
    }

    // Suggest workflows for missing apps
    const missingGoogleAnalytics = !connected.some(app => app.appId === 'google-analytics');
    const missingSlack = !connected.some(app => app.appId === 'slack');

    if (missingGoogleAnalytics && connected.some(app => app.appId === 'slack')) {
      capabilities.push({
        id: 'potential-analytics-slack',
        name: 'Analytics + Slack Integration',
        description: 'Connect Google Analytics to get traffic alerts in Slack',
        requiredApps: ['google-analytics', 'slack'],
        connectedApps: ['slack'],
        missingApps: ['google-analytics'],
        complexity: 'medium',
        category: 'Monitoring',
        estimatedTime: '25 minutes',
        benefits: ['Real-time insights', 'Team awareness', 'Proactive monitoring'],
        template: {
          nodes: [],
          connections: [],
          triggers: ['traffic-change'],
          actions: ['analyze-traffic', 'send-alert']
        }
      });
    }

    if (missingSlack && connected.length > 0) {
      capabilities.push({
        id: 'potential-slack-integration',
        name: 'Team Notification System',
        description: 'Connect Slack to enable team notifications for all your workflows',
        requiredApps: ['slack'],
        connectedApps: [],
        missingApps: ['slack'],
        complexity: 'simple',
        category: 'Communication',
        estimatedTime: '5 minutes',
        benefits: ['Team coordination', 'Instant notifications', 'Centralized communication'],
        template: {
          nodes: [],
          connections: [],
          triggers: ['any-event'],
          actions: ['notify-team']
        }
      });
    }

    setAnalyzedCapabilities(capabilities);
    setLoading(false);
  };

  // Auto-generate capabilities when integrations change
  createEffect(() => {
    const hasConnections = integrations.getAllConnections().length > 0;
    if (hasConnections) {
      generateCapabilities();
    }
  });

  const createWorkflowFromTemplate = async (capability: WorkflowCapability) => {
    if (capability.missingApps.length > 0) {
      // Navigate to integrations to connect missing apps
      window.location.href = '/settings?tab=integrations';
      return;
    }

    try {
      setLoading(true);

      // Create a new workflow using the DashboardServer
      const workflowData = {
        name: capability.name,
        description: capability.description,
        definition: capability.template,
        requiredApps: capability.requiredApps,
        category: capability.category,
        complexity: capability.complexity
      };

      const { executeTool } = dashboardServer;
      await executeTool('kv_set', {
        key: `workflow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        value: JSON.stringify(workflowData),
        ttl_hours: 8760 // 1 year
      });

      // Navigate to workflows page
      window.location.href = '/workflows';
    } catch (error) {
      console.error('Failed to create workflow:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="space-y-6">
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h2 class="text-xl font-semibold text-gray-900">Workflow Generator</h2>
            <p class="text-sm text-gray-600 mt-1">
              Discover workflow opportunities based on your connected apps
            </p>
          </div>
          <button
            onClick={generateCapabilities}
            disabled={loading()}
            class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Show when={loading()}>
              <span class="inline-block animate-spin mr-2">⚪</span>
            </Show>
            Analyze Capabilities
          </button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div class="bg-blue-50 rounded-lg p-4">
            <div class="text-2xl font-bold text-blue-600">{connectedApps().length}</div>
            <div class="text-sm text-blue-600">Connected Apps</div>
          </div>
          <div class="bg-green-50 rounded-lg p-4">
            <div class="text-2xl font-bold text-green-600">
              {analyzedCapabilities().filter(c => c.missingApps.length === 0).length}
            </div>
            <div class="text-sm text-green-600">Ready Workflows</div>
          </div>
          <div class="bg-amber-50 rounded-lg p-4">
            <div class="text-2xl font-bold text-amber-600">
              {analyzedCapabilities().filter(c => c.missingApps.length > 0).length}
            </div>
            <div class="text-sm text-amber-600">Potential Workflows</div>
          </div>
        </div>

        <div class="flex flex-wrap gap-4 mb-6">
          <div class="flex items-center space-x-2">
            <label class="text-sm font-medium text-gray-700">Category:</label>
            <select
              value={selectedCategory()}
              onInput={(e) => setSelectedCategory(e.currentTarget.value)}
              class="px-3 py-1 border border-gray-300 rounded-md text-sm"
            >
              <For each={categories()}>
                {(category) => (
                  <option value={category}>
                    {category === 'all' ? 'All Categories' : category}
                  </option>
                )}
              </For>
            </select>
          </div>
          <div class="flex items-center space-x-2">
            <label class="text-sm font-medium text-gray-700">Complexity:</label>
            <select
              value={selectedComplexity()}
              onInput={(e) => setSelectedComplexity(e.currentTarget.value)}
              class="px-3 py-1 border border-gray-300 rounded-md text-sm"
            >
              <option value="all">All Levels</option>
              <option value="simple">Simple</option>
              <option value="medium">Medium</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <For each={filteredCapabilities()}>
          {(capability) => (
            <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <div class="flex items-start justify-between mb-4">
                <div class="flex-1">
                  <h3 class="font-semibold text-gray-900 mb-2">{capability.name}</h3>
                  <p class="text-sm text-gray-600 mb-3">{capability.description}</p>
                </div>
                <div class={`px-2 py-1 rounded-full text-xs font-medium ${
                  capability.complexity === 'simple' ? 'bg-green-100 text-green-800' :
                  capability.complexity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {capability.complexity}
                </div>
              </div>

              <div class="space-y-3 mb-4">
                <div>
                  <div class="text-xs font-medium text-gray-700 mb-1">Required Apps:</div>
                  <div class="flex flex-wrap gap-1">
                    <For each={capability.requiredApps}>
                      {(app) => (
                        <span class={`px-2 py-1 rounded-md text-xs ${
                          capability.connectedApps.includes(app)
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {app}
                        </span>
                      )}
                    </For>
                  </div>
                </div>

                <Show when={capability.missingApps.length > 0}>
                  <div>
                    <div class="text-xs font-medium text-red-700 mb-1">Missing Apps:</div>
                    <div class="flex flex-wrap gap-1">
                      <For each={capability.missingApps}>
                        {(app) => (
                          <span class="px-2 py-1 rounded-md text-xs bg-red-100 text-red-800">
                            {app}
                          </span>
                        )}
                      </For>
                    </div>
                  </div>
                </Show>

                <div class="text-xs text-gray-600">
                  <span class="font-medium">Setup time:</span> {capability.estimatedTime}
                </div>
              </div>

              <div class="mb-4">
                <div class="text-xs font-medium text-gray-700 mb-1">Benefits:</div>
                <ul class="text-xs text-gray-600 space-y-1">
                  <For each={capability.benefits}>
                    {(benefit) => <li>• {benefit}</li>}
                  </For>
                </ul>
              </div>

              <button
                onClick={() => createWorkflowFromTemplate(capability)}
                disabled={loading()}
                class={`w-full py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                  capability.missingApps.length > 0
                    ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {capability.missingApps.length > 0 ? 'Connect Apps First' : 'Create Workflow'}
              </button>
            </div>
          )}
        </For>
      </div>

      <Show when={filteredCapabilities().length === 0 && !loading()}>
        <div class="text-center py-12 bg-gray-50 rounded-lg">
          <div class="text-gray-500 mb-4">
            <svg class="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h3 class="text-lg font-medium text-gray-900 mb-2">No Workflow Capabilities Found</h3>
          <p class="text-gray-600 mb-4">
            Connect some apps in your integrations settings to discover workflow opportunities.
          </p>
          <button
            onClick={() => window.location.href = '/settings?tab=integrations'}
            class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Connect Apps
          </button>
        </div>
      </Show>
    </div>
  );
}