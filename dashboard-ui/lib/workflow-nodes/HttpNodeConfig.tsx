import { createSignal, For, Show } from 'solid-js';
import { Plus, Trash2, Globe } from 'lucide-solid';

export interface HttpConfig {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;
  headers?: Record<string, string>;
  body?: string;
  timeout?: number;
  followRedirects?: boolean;
  validateSSL?: boolean;
}

export const DEFAULT_HTTP_CONFIG: HttpConfig = {
  method: 'GET',
  url: '',
  headers: {},
  timeout: 30000,
  followRedirects: true,
  validateSSL: true
};

interface HttpNodeConfigProps {
  value: HttpConfig;
  onChange: (value: HttpConfig) => void;
}

export function HttpNodeConfig(props: HttpNodeConfigProps) {
  const [showAdvanced, setShowAdvanced] = createSignal(false);

  const updateConfig = (key: keyof HttpConfig, value: any) => {
    props.onChange({ ...props.value, [key]: value });
  };

  const addHeader = () => {
    const headers = props.value.headers || {};
    const newKey = `Header-${Object.keys(headers).length + 1}`;
    updateConfig('headers', { ...headers, [newKey]: '' });
  };

  const updateHeader = (oldKey: string, newKey: string, value: string) => {
    const headers = { ...props.value.headers };
    if (oldKey !== newKey) {
      delete headers[oldKey];
    }
    headers[newKey] = value;
    updateConfig('headers', headers);
  };

  const removeHeader = (key: string) => {
    const headers = { ...props.value.headers };
    delete headers[key];
    updateConfig('headers', headers);
  };

  const headerEntries = () => Object.entries(props.value.headers || {});

  return (
    <div class="space-y-4">
      {/* HTTP Method Selection */}
      <div>
        <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          HTTP Method <span class="text-red-500">*</span>
        </label>
        <div class="flex gap-2">
          <For each={['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as const}>
            {(method) => (
              <button
                type="button"
                class={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  props.value.method === method
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

      {/* URL Input */}
      <div>
        <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          URL <span class="text-red-500">*</span>
        </label>
        <div class="relative">
          <Globe class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="url"
            class="w-full pl-10 pr-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="https://api.example.com/endpoint"
            value={props.value.url}
            onInput={(e) => updateConfig('url', e.currentTarget.value)}
          />
        </div>
        <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Supports variable interpolation: {'${data.userId}'}
        </p>
      </div>

      {/* Request Body (for POST/PUT/PATCH) */}
      <Show when={['POST', 'PUT', 'PATCH'].includes(props.value.method)}>
        <div>
          <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Request Body (JSON)
          </label>
          <textarea
            class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            rows="6"
            placeholder='{\n  "key": "value",\n  "userId": "${data.userId}"\n}'
            value={props.value.body || ''}
            onInput={(e) => updateConfig('body', e.currentTarget.value)}
          />
        </div>
      </Show>

      {/* Headers */}
      <div>
        <div class="flex items-center justify-between mb-2">
          <label class="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Headers
          </label>
          <button
            type="button"
            class="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            onClick={addHeader}
          >
            <Plus class="w-3 h-3" />
            Add Header
          </button>
        </div>
        <div class="space-y-2">
          <For each={headerEntries()}>
            {([key, value]) => (
              <div class="flex gap-2">
                <input
                  type="text"
                  class="flex-1 px-3 py-1.5 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="Header name"
                  value={key}
                  onInput={(e) => updateHeader(key, e.currentTarget.value, value)}
                />
                <input
                  type="text"
                  class="flex-1 px-3 py-1.5 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="Value"
                  value={value}
                  onInput={(e) => updateHeader(key, key, e.currentTarget.value)}
                />
                <button
                  type="button"
                  class="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md"
                  onClick={() => removeHeader(key)}
                >
                  <Trash2 class="w-4 h-4" />
                </button>
              </div>
            )}
          </For>
          <Show when={headerEntries().length === 0}>
            <p class="text-sm text-slate-500 dark:text-slate-400 italic">
              No headers configured. Click "Add Header" to add one.
            </p>
          </Show>
        </div>
      </div>

      {/* Advanced Options */}
      <div>
        <button
          type="button"
          class="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          onClick={() => setShowAdvanced(!showAdvanced())}
        >
          {showAdvanced() ? 'Hide' : 'Show'} Advanced Options
        </button>
      </div>

      <Show when={showAdvanced()}>
        <div class="space-y-3 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-md">
          <div>
            <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Timeout (ms)
            </label>
            <input
              type="number"
              class="w-full px-3 py-1.5 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={props.value.timeout || 30000}
              onInput={(e) => updateConfig('timeout', parseInt(e.currentTarget.value))}
            />
          </div>

          <div class="flex items-center gap-2">
            <input
              type="checkbox"
              id="followRedirects"
              class="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
              checked={props.value.followRedirects ?? true}
              onChange={(e) => updateConfig('followRedirects', e.currentTarget.checked)}
            />
            <label for="followRedirects" class="text-sm text-slate-700 dark:text-slate-300">
              Follow Redirects
            </label>
          </div>

          <div class="flex items-center gap-2">
            <input
              type="checkbox"
              id="validateSSL"
              class="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
              checked={props.value.validateSSL ?? true}
              onChange={(e) => updateConfig('validateSSL', e.currentTarget.checked)}
            />
            <label for="validateSSL" class="text-sm text-slate-700 dark:text-slate-300">
              Validate SSL Certificate
            </label>
          </div>
        </div>
      </Show>

      {/* Help Text */}
      <div class="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md">
        <p class="text-xs text-blue-600 dark:text-blue-400">
          <strong>Tip:</strong> Use variable interpolation in URL, headers, and body with {'${path.to.value}'} syntax.
          Previous node outputs are available via {'${nodes.nodeId.output.field}'}.
        </p>
      </div>
    </div>
  );
}
