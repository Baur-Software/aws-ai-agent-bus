import { createSignal, Show } from 'solid-js';
import { Database, Key, Clock, Info } from 'lucide-solid';

export interface KVGetConfig {
  operation: 'get';
  key: string;
  defaultValue?: string;
  parseJson?: boolean;
}

export interface KVSetConfig {
  operation: 'set';
  key: string;
  value: string;
  ttlHours?: number;
  scope?: 'user' | 'organization' | 'global';
}

export type KVStoreConfig = KVGetConfig | KVSetConfig;

export const DEFAULT_KV_GET_CONFIG: KVGetConfig = {
  operation: 'get',
  key: '',
  parseJson: true
};

export const DEFAULT_KV_SET_CONFIG: KVSetConfig = {
  operation: 'set',
  key: '',
  value: '',
  ttlHours: 24,
  scope: 'user'
};

interface KVStoreNodeConfigProps {
  value: KVStoreConfig;
  onChange: (value: KVStoreConfig) => void;
  nodeType: 'kv-get' | 'kv-set';
}

export function KVStoreNodeConfig(props: KVStoreNodeConfigProps) {
  const [showAdvanced, setShowAdvanced] = createSignal(false);

  const updateConfig = (key: string, value: any) => {
    props.onChange({ ...props.value, [key]: value } as KVStoreConfig);
  };

  const isGetOperation = () => props.nodeType === 'kv-get';
  const isSetOperation = () => props.nodeType === 'kv-set';

  return (
    <div class="space-y-4">
      {/* Key Input */}
      <div>
        <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          Key <span class="text-red-500">*</span>
        </label>
        <div class="relative">
          <Key class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            class="w-full pl-10 pr-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="user-preferences"
            value={props.value.key}
            onInput={(e) => updateConfig('key', e.currentTarget.value)}
          />
        </div>
        <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Supports variable interpolation: {'${data.userId}'} or {'${nodes.prevNode.output.key}'}
        </p>
      </div>

      {/* KV Get Specific Fields */}
      <Show when={isGetOperation()}>
        <div>
          <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Default Value (optional)
          </label>
          <input
            type="text"
            class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Returned if key doesn't exist"
            value={(props.value as KVGetConfig).defaultValue || ''}
            onInput={(e) => updateConfig('defaultValue', e.currentTarget.value)}
          />
        </div>

        <div class="flex items-center gap-2">
          <input
            type="checkbox"
            id="parseJson"
            class="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
            checked={(props.value as KVGetConfig).parseJson ?? true}
            onChange={(e) => updateConfig('parseJson', e.currentTarget.checked)}
          />
          <label for="parseJson" class="text-sm text-slate-700 dark:text-slate-300">
            Auto-parse JSON values
          </label>
        </div>
      </Show>

      {/* KV Set Specific Fields */}
      <Show when={isSetOperation()}>
        <div>
          <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Value <span class="text-red-500">*</span>
          </label>
          <textarea
            class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            rows="4"
            placeholder='{"key": "value"} or simple string'
            value={(props.value as KVSetConfig).value || ''}
            onInput={(e) => updateConfig('value', e.currentTarget.value)}
          />
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Can be JSON object, string, or variable reference like {'${nodes.prevNode.output}'}
          </p>
        </div>

        <div>
          <div class="flex items-center gap-2 mb-2">
            <Clock class="w-4 h-4 text-slate-400" />
            <label class="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Time to Live (TTL)
            </label>
          </div>
          <div class="flex items-center gap-2">
            <input
              type="number"
              class="w-32 px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              min="1"
              value={(props.value as KVSetConfig).ttlHours || 24}
              onInput={(e) => updateConfig('ttlHours', parseInt(e.currentTarget.value))}
            />
            <span class="text-sm text-slate-600 dark:text-slate-400">hours</span>
          </div>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Data will automatically expire after this duration (0 = never expire)
          </p>
        </div>

        <div>
          <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Storage Scope
          </label>
          <div class="flex gap-2">
            {(['user', 'organization', 'global'] as const).map((scope) => (
              <button
                type="button"
                class={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  (props.value as KVSetConfig).scope === scope
                    ? 'bg-purple-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}
                onClick={() => updateConfig('scope', scope)}
              >
                {scope.charAt(0).toUpperCase() + scope.slice(1)}
              </button>
            ))}
          </div>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
            <Show when={(props.value as KVSetConfig).scope === 'user'}>
              Only accessible by the current user
            </Show>
            <Show when={(props.value as KVSetConfig).scope === 'organization'}>
              Accessible by all users in the organization
            </Show>
            <Show when={(props.value as KVSetConfig).scope === 'global'}>
              Accessible across all organizations (admin only)
            </Show>
          </p>
        </div>
      </Show>

      {/* Info Box */}
      <div class="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-md flex gap-2">
        <Info class="w-4 h-4 text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" />
        <div class="text-xs text-purple-600 dark:text-purple-400">
          <Show when={isGetOperation()}>
            <p>
              <strong>Output:</strong> Retrieved value will be available as <code class="bg-purple-100 dark:bg-purple-900/40 px-1 rounded">{'${nodes.thisNode.output.value}'}</code>
            </p>
          </Show>
          <Show when={isSetOperation()}>
            <p>
              <strong>Output:</strong> Success status will be available as <code class="bg-purple-100 dark:bg-purple-900/40 px-1 rounded">{'${nodes.thisNode.output.success}'}</code>
            </p>
          </Show>
        </div>
      </div>
    </div>
  );
}
