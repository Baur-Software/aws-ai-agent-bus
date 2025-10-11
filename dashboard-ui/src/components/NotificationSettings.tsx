import { createSignal, onMount, For, Show, createEffect } from 'solid-js';
import { Bell, Mail, MessageSquare, Smartphone, Check, X } from 'lucide-solid';
import { useDashboardServer } from '../contexts/DashboardServerContext';
import { useOrganization } from '../contexts/OrganizationContext';
import { useNotifications } from '../contexts/NotificationContext';

interface NotificationPreference {
  category: string;
  label: string;
  description: string;
  channels: {
    inApp: boolean;
    email: boolean;
    sms: boolean;
    webhook: boolean;
  };
}

interface NotificationRule {
  id: string;
  enabled: boolean;
  eventPattern: string; // e.g., "workflow.*", "integration.connected"
  channels: string[]; // ['in-app', 'email', 'sms', 'webhook']
  priority: 'all' | 'high' | 'critical';
  context: 'personal' | 'organizational' | 'both';
}

const DEFAULT_PREFERENCES: NotificationPreference[] = [
  {
    category: 'workflow',
    label: 'Workflow Events',
    description: 'Notifications about workflow execution, completion, and failures',
    channels: { inApp: true, email: false, sms: false, webhook: false }
  },
  {
    category: 'integration',
    label: 'Integration Events',
    description: 'Notifications when integrations connect, disconnect, or encounter errors',
    channels: { inApp: true, email: true, sms: false, webhook: false }
  },
  {
    category: 'agent',
    label: 'Agent Tasks',
    description: 'Notifications about agent task execution and results',
    channels: { inApp: true, email: false, sms: false, webhook: false }
  },
  {
    category: 'system',
    label: 'System Events',
    description: 'Critical system notifications and maintenance alerts',
    channels: { inApp: true, email: true, sms: true, webhook: false }
  },
  {
    category: 'mcp',
    label: 'MCP Tool Events',
    description: 'Notifications from MCP tool executions',
    channels: { inApp: true, email: false, sms: false, webhook: false }
  }
];

export default function NotificationSettings() {
  const { callMCPTool } = useDashboardServer();
  const { currentOrganization, user } = useOrganization();
  const { success, error } = useNotifications();

  const [preferences, setPreferences] = createSignal<NotificationPreference[]>(DEFAULT_PREFERENCES);
  const [rules, setRules] = createSignal<NotificationRule[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [emailEndpoint, setEmailEndpoint] = createSignal('');
  const [smsEndpoint, setSmsEndpoint] = createSignal('');
  const [webhookEndpoint, setWebhookEndpoint] = createSignal('');

  // Load saved preferences from KV store
  const loadPreferences = async () => {
    setLoading(true);
    try {
      const contextKey = currentOrganization()
        ? `notification-prefs-${currentOrganization()!.id}`
        : `notification-prefs-${user()?.id}`;

      const result = await callMCPTool('kv_get', { key: contextKey });

      if (result?.value) {
        const saved = JSON.parse(result.value);
        setPreferences(saved.preferences || DEFAULT_PREFERENCES);
        setRules(saved.rules || []);
        setEmailEndpoint(saved.emailEndpoint || '');
        setSmsEndpoint(saved.smsEndpoint || '');
        setWebhookEndpoint(saved.webhookEndpoint || '');
      }
    } catch (err) {
      console.error('Failed to load notification preferences:', err);
    } finally {
      setLoading(false);
    }
  };

  // Save preferences to KV store
  const savePreferences = async () => {
    setLoading(true);
    try {
      const contextKey = currentOrganization()
        ? `notification-prefs-${currentOrganization()!.id}`
        : `notification-prefs-${user()?.id}`;

      const data = {
        preferences: preferences(),
        rules: rules(),
        emailEndpoint: emailEndpoint(),
        smsEndpoint: smsEndpoint(),
        webhookEndpoint: webhookEndpoint(),
        context: currentOrganization() ? 'organizational' : 'personal',
        updatedAt: new Date().toISOString()
      };

      await callMCPTool('kv_set', {
        key: contextKey,
        value: JSON.stringify(data),
        ttl_hours: 24 * 365 // 1 year
      });

      success('Notification preferences saved');
    } catch (err) {
      console.error('Failed to save notification preferences:', err);
      error('Failed to save preferences');
    } finally {
      setLoading(false);
    }
  };

  // Toggle channel for a category
  const toggleChannel = (category: string, channel: keyof NotificationPreference['channels']) => {
    setPreferences(prev => prev.map(pref =>
      pref.category === category
        ? { ...pref, channels: { ...pref.channels, [channel]: !pref.channels[channel] } }
        : pref
    ));
  };

  // Subscribe to SNS topic
  const subscribeToNotifications = async (protocol: 'email' | 'sms' | 'https', endpoint: string) => {
    setLoading(true);
    try {
      const result = await callMCPTool('notifications_subscribe', {
        protocol,
        endpoint,
        topicName: currentOrganization()
          ? `${currentOrganization()!.id}-notifications`
          : `${user()?.id}-notifications`
      });

      if (result?.success) {
        success(`Successfully subscribed ${endpoint} to notifications`);
        return result.subscriptionArn;
      } else {
        throw new Error(result?.error || 'Subscription failed');
      }
    } catch (err: any) {
      error(`Subscription failed: ${err.message}`);
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Create event rule
  const createEventRule = async (pref: NotificationPreference) => {
    try {
      const activeChannels: string[] = [];
      if (pref.channels.inApp) activeChannels.push('in-app');
      if (pref.channels.email) activeChannels.push('email');
      if (pref.channels.sms) activeChannels.push('sms');
      if (pref.channels.webhook) activeChannels.push('webhook');

      const result = await callMCPTool('events_create_rule', {
        name: `${pref.category}-notifications`,
        pattern: {
          source: ['workflow-engine', 'integration-service', 'agent-system'],
          'detail-type': [`${pref.category}.*`]
        },
        actions: activeChannels.map(channel => ({
          type: channel === 'in-app' ? 'websocket' : channel,
          config: { enabled: true }
        })),
        userId: user()?.id,
        organizationId: currentOrganization()?.id
      });

      if (result?.success) {
        console.log(`Event rule created for ${pref.category}`);
      }
    } catch (err) {
      console.error(`Failed to create event rule for ${pref.category}:`, err);
    }
  };

  // Reload preferences when context changes
  createEffect(() => {
    const org = currentOrganization();
    loadPreferences();
  });

  onMount(() => {
    loadPreferences();
  });

  return (
    <div class="p-6 space-y-6">
      {/* Context Indicator */}
      <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div class="flex items-center gap-2">
          <Bell class="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <div>
            <h3 class="font-medium text-blue-900 dark:text-blue-100">
              Notification Preferences for: {currentOrganization()?.name || 'Personal'}
            </h3>
            <p class="text-sm text-blue-700 dark:text-blue-300 mt-1">
              {currentOrganization()
                ? 'These settings apply to all events in this organization'
                : 'These settings apply to your personal events only'}
            </p>
          </div>
        </div>
      </div>

      {/* Notification Categories */}
      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-4">Event Categories</h2>
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Choose which channels you want to receive notifications on for each event category
        </p>

        <div class="space-y-4">
          <For each={preferences()}>
            {(pref) => (
              <div class="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <div class="flex items-start justify-between mb-3">
                  <div>
                    <h3 class="font-medium text-gray-900 dark:text-white">{pref.label}</h3>
                    <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">{pref.description}</p>
                  </div>
                </div>

                <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {/* In-App */}
                  <button
                    onClick={() => toggleChannel(pref.category, 'inApp')}
                    class={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
                      pref.channels.inApp
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300'
                        : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    <Bell class="w-4 h-4" />
                    <span class="text-sm font-medium">In-App</span>
                    {pref.channels.inApp && <Check class="w-4 h-4 ml-auto" />}
                  </button>

                  {/* Email */}
                  <button
                    onClick={() => toggleChannel(pref.category, 'email')}
                    class={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
                      pref.channels.email
                        ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700 text-green-700 dark:text-green-300'
                        : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    <Mail class="w-4 h-4" />
                    <span class="text-sm font-medium">Email</span>
                    {pref.channels.email && <Check class="w-4 h-4 ml-auto" />}
                  </button>

                  {/* SMS */}
                  <button
                    onClick={() => toggleChannel(pref.category, 'sms')}
                    class={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
                      pref.channels.sms
                        ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-700 text-purple-700 dark:text-purple-300'
                        : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    <Smartphone class="w-4 h-4" />
                    <span class="text-sm font-medium">SMS</span>
                    {pref.channels.sms && <Check class="w-4 h-4 ml-auto" />}
                  </button>

                  {/* Webhook */}
                  <button
                    onClick={() => toggleChannel(pref.category, 'webhook')}
                    class={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
                      pref.channels.webhook
                        ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-700 text-orange-700 dark:text-orange-300'
                        : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    <MessageSquare class="w-4 h-4" />
                    <span class="text-sm font-medium">Webhook</span>
                    {pref.channels.webhook && <Check class="w-4 h-4 ml-auto" />}
                  </button>
                </div>
              </div>
            )}
          </For>
        </div>
      </div>

      {/* Delivery Endpoints */}
      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-4">Delivery Endpoints</h2>
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Configure where notifications should be delivered
        </p>

        <div class="space-y-4">
          {/* Email */}
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Email Address
            </label>
            <div class="flex gap-2">
              <input
                type="email"
                value={emailEndpoint()}
                onInput={(e) => setEmailEndpoint(e.currentTarget.value)}
                placeholder="you@example.com"
                class="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
              />
              <button
                onClick={() => subscribeToNotifications('email', emailEndpoint())}
                disabled={!emailEndpoint() || loading()}
                class="px-4 py-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white rounded-lg transition-colors"
              >
                Subscribe
              </button>
            </div>
          </div>

          {/* SMS */}
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              SMS Number
            </label>
            <div class="flex gap-2">
              <input
                type="tel"
                value={smsEndpoint()}
                onInput={(e) => setSmsEndpoint(e.currentTarget.value)}
                placeholder="+1234567890"
                class="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
              />
              <button
                onClick={() => subscribeToNotifications('sms', smsEndpoint())}
                disabled={!smsEndpoint() || loading()}
                class="px-4 py-2 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-400 text-white rounded-lg transition-colors"
              >
                Subscribe
              </button>
            </div>
          </div>

          {/* Webhook */}
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Webhook URL
            </label>
            <div class="flex gap-2">
              <input
                type="url"
                value={webhookEndpoint()}
                onInput={(e) => setWebhookEndpoint(e.currentTarget.value)}
                placeholder="https://your-app.com/webhook"
                class="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
              />
              <button
                onClick={() => subscribeToNotifications('https', webhookEndpoint())}
                disabled={!webhookEndpoint() || loading()}
                class="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 text-white rounded-lg transition-colors"
              >
                Subscribe
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div class="flex justify-end gap-3">
        <button
          onClick={loadPreferences}
          class="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          Reset
        </button>
        <button
          onClick={savePreferences}
          disabled={loading()}
          class="px-6 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white rounded-lg transition-colors"
        >
          {loading() ? 'Saving...' : 'Save Preferences'}
        </button>
      </div>
    </div>
  );
}
