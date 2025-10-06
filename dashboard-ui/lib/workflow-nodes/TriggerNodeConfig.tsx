import { createSignal, Show, For } from 'solid-js';
import { Play, Webhook, Clock, Calendar } from 'lucide-solid';

export interface ManualTriggerConfig {
  type: 'manual';
  description?: string;
}

export interface WebhookTriggerConfig {
  type: 'webhook';
  path?: string;
  method?: 'POST' | 'GET' | 'PUT' | 'DELETE';
  authentication?: 'none' | 'api-key' | 'bearer';
  apiKey?: string;
}

export interface ScheduleTriggerConfig {
  type: 'schedule';
  schedule: string; // cron expression
  timezone?: string;
  enabled?: boolean;
}

export type TriggerConfig = ManualTriggerConfig | WebhookTriggerConfig | ScheduleTriggerConfig;

export const DEFAULT_MANUAL_TRIGGER_CONFIG: ManualTriggerConfig = {
  type: 'manual'
};

export const DEFAULT_WEBHOOK_TRIGGER_CONFIG: WebhookTriggerConfig = {
  type: 'webhook',
  method: 'POST',
  authentication: 'api-key'
};

export const DEFAULT_SCHEDULE_TRIGGER_CONFIG: ScheduleTriggerConfig = {
  type: 'schedule',
  schedule: '0 9 * * *', // 9 AM daily
  timezone: 'UTC',
  enabled: true
};

interface TriggerNodeConfigProps {
  value: TriggerConfig;
  onChange: (value: TriggerConfig) => void;
  triggerType: 'trigger' | 'webhook' | 'schedule';
}

const SCHEDULE_PRESETS = [
  { label: 'Every 5 minutes', value: '*/5 * * * *' },
  { label: 'Every 15 minutes', value: '*/15 * * * *' },
  { label: 'Every hour', value: '0 * * * *' },
  { label: 'Daily at 9 AM', value: '0 9 * * *' },
  { label: 'Daily at 5 PM', value: '0 17 * * *' },
  { label: 'Weekly on Monday 9 AM', value: '0 9 * * 1' },
  { label: 'Monthly on 1st at 9 AM', value: '0 9 1 * *' }
];

export function TriggerNodeConfig(props: TriggerNodeConfigProps) {
  const [useCustomCron, setUseCustomCron] = createSignal(false);

  const updateConfig = (key: string, value: any) => {
    props.onChange({ ...props.value, [key]: value } as TriggerConfig);
  };

  const isManual = () => props.triggerType === 'trigger';
  const isWebhook = () => props.triggerType === 'webhook';
  const isSchedule = () => props.triggerType === 'schedule';

  return (
    <div class="space-y-4">
      {/* Manual Trigger */}
      <Show when={isManual()}>
        <div class="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
          <div class="flex items-center gap-2 mb-2">
            <Play class="w-5 h-5 text-green-600 dark:text-green-400" />
            <h4 class="font-medium text-green-900 dark:text-green-100">Manual Trigger</h4>
          </div>
          <p class="text-sm text-green-700 dark:text-green-300">
            This workflow starts when you manually click the "Run" button. No additional configuration needed.
          </p>
        </div>

        <div>
          <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Description (optional)
          </label>
          <textarea
            class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows="2"
            placeholder="Describe when this workflow should be manually triggered..."
            value={(props.value as ManualTriggerConfig).description || ''}
            onInput={(e) => updateConfig('description', e.currentTarget.value)}
          />
        </div>
      </Show>

      {/* Webhook Trigger */}
      <Show when={isWebhook()}>
        <div class="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div class="flex items-center gap-2 mb-2">
            <Webhook class="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h4 class="font-medium text-blue-900 dark:text-blue-100">Webhook Endpoint</h4>
          </div>
          <code class="text-sm text-blue-700 dark:text-blue-300 font-mono bg-blue-100 dark:bg-blue-900/40 px-2 py-1 rounded">
            POST https://api.agent-mesh.com/webhooks/{(props.value as WebhookTriggerConfig).path || 'auto-generated'}
          </code>
        </div>

        <div>
          <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Webhook Path (optional)
          </label>
          <input
            type="text"
            class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="my-workflow-webhook (auto-generated if empty)"
            value={(props.value as WebhookTriggerConfig).path || ''}
            onInput={(e) => updateConfig('path', e.currentTarget.value)}
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            HTTP Method
          </label>
          <div class="flex gap-2">
            <For each={['POST', 'GET', 'PUT', 'DELETE'] as const}>
              {(method) => (
                <button
                  type="button"
                  class={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    (props.value as WebhookTriggerConfig).method === method
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}
                  onClick={() => updateConfig('method', method)}
                >
                  {method}
                </button>
              )}
            </For>
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Authentication
          </label>
          <div class="space-y-2">
            <For each={[
              { value: 'none', label: 'None (Public)', description: 'Anyone with the URL can trigger' },
              { value: 'api-key', label: 'API Key', description: 'Requires X-API-Key header' },
              { value: 'bearer', label: 'Bearer Token', description: 'Requires Authorization: Bearer header' }
            ] as const}>
              {(option) => (
                <label class="flex items-start gap-2 p-2 border border-slate-200 dark:border-slate-600 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                  <input
                    type="radio"
                    name="auth"
                    class="mt-1"
                    checked={(props.value as WebhookTriggerConfig).authentication === option.value}
                    onChange={() => updateConfig('authentication', option.value)}
                  />
                  <div class="flex-1">
                    <div class="text-sm font-medium text-slate-900 dark:text-white">{option.label}</div>
                    <div class="text-xs text-slate-500 dark:text-slate-400">{option.description}</div>
                  </div>
                </label>
              )}
            </For>
          </div>
        </div>

        <Show when={(props.value as WebhookTriggerConfig).authentication !== 'none'}>
          <div class="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-md">
            <p class="text-xs text-yellow-700 dark:text-yellow-300">
              <strong>Security:</strong> API key will be auto-generated and shown after saving.
              Store it securely as it won't be shown again.
            </p>
          </div>
        </Show>
      </Show>

      {/* Schedule Trigger */}
      <Show when={isSchedule()}>
        <div class="p-4 bg-cyan-50 dark:bg-cyan-900/20 rounded-lg border border-cyan-200 dark:border-cyan-800">
          <div class="flex items-center gap-2 mb-2">
            <Calendar class="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
            <h4 class="font-medium text-cyan-900 dark:text-cyan-100">Scheduled Trigger</h4>
          </div>
          <p class="text-sm text-cyan-700 dark:text-cyan-300">
            Automatically runs this workflow on a schedule using cron expressions
          </p>
        </div>

        <div>
          <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Schedule
          </label>
          <Show when={!useCustomCron()}>
            <select
              class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={(props.value as ScheduleTriggerConfig).schedule}
              onChange={(e) => updateConfig('schedule', e.currentTarget.value)}
            >
              <For each={SCHEDULE_PRESETS}>
                {(preset) => <option value={preset.value}>{preset.label} ({preset.value})</option>}
              </For>
            </select>
          </Show>
          <Show when={useCustomCron()}>
            <input
              type="text"
              class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              placeholder="*/5 * * * *"
              value={(props.value as ScheduleTriggerConfig).schedule}
              onInput={(e) => updateConfig('schedule', e.currentTarget.value)}
            />
          </Show>
          <button
            type="button"
            class="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-1"
            onClick={() => setUseCustomCron(!useCustomCron())}
          >
            {useCustomCron() ? 'Use preset' : 'Use custom cron expression'}
          </button>
        </div>

        <div>
          <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Timezone
          </label>
          <select
            class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={(props.value as ScheduleTriggerConfig).timezone || 'UTC'}
            onChange={(e) => updateConfig('timezone', e.currentTarget.value)}
          >
            <option value="UTC">UTC</option>
            <option value="America/New_York">Eastern Time</option>
            <option value="America/Chicago">Central Time</option>
            <option value="America/Denver">Mountain Time</option>
            <option value="America/Los_Angeles">Pacific Time</option>
            <option value="Europe/London">London</option>
            <option value="Europe/Paris">Paris</option>
            <option value="Asia/Tokyo">Tokyo</option>
          </select>
        </div>

        <div class="flex items-center gap-2">
          <input
            type="checkbox"
            id="enabled"
            class="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
            checked={(props.value as ScheduleTriggerConfig).enabled ?? true}
            onChange={(e) => updateConfig('enabled', e.currentTarget.checked)}
          />
          <label for="enabled" class="text-sm text-slate-700 dark:text-slate-300">
            Schedule enabled
          </label>
        </div>

        <div class="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-md">
          <p class="text-xs text-slate-600 dark:text-slate-400 mb-1">
            <strong>Cron Format:</strong> minute hour day month weekday
          </p>
          <p class="text-xs text-slate-500 dark:text-slate-500">
            Examples: <code>0 9 * * *</code> = 9 AM daily, <code>*/15 * * * *</code> = every 15 minutes
          </p>
        </div>
      </Show>
    </div>
  );
}
