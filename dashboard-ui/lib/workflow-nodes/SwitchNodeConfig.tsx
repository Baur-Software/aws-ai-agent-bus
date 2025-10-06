import { createSignal, For, Show } from 'solid-js';
import { Plus, Trash2, MoveUp, MoveDown, AlertCircle, Info } from 'lucide-solid';

export interface SwitchCase {
  match: string;
  output: string;
}

export interface SwitchConfig {
  value: string;
  cases: SwitchCase[];
}

interface SwitchNodeConfigProps {
  value: SwitchConfig;
  onChange: (value: SwitchConfig) => void;
}

export function SwitchNodeConfig(props: SwitchNodeConfigProps) {
  const [expandedHelp, setExpandedHelp] = createSignal(false);

  const addCase = () => {
    const newCases = [
      ...props.value.cases,
      { match: '', output: `case-${props.value.cases.length + 1}` }
    ];
    props.onChange({ ...props.value, cases: newCases });
  };

  const removeCase = (index: number) => {
    const newCases = props.value.cases.filter((_, i) => i !== index);
    props.onChange({ ...props.value, cases: newCases });
  };

  const updateCase = (index: number, field: keyof SwitchCase, value: string) => {
    const newCases = [...props.value.cases];
    newCases[index] = { ...newCases[index], [field]: value };
    props.onChange({ ...props.value, cases: newCases });
  };

  const moveCase = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === props.value.cases.length - 1) return;

    const newCases = [...props.value.cases];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    [newCases[index], newCases[newIndex]] = [newCases[newIndex], newCases[index]];
    props.onChange({ ...props.value, cases: newCases });
  };

  const setValue = (value: string) => {
    props.onChange({ ...props.value, value });
  };

  return (
    <div class="space-y-4">
      {/* Info Banner */}
      <div class="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <div class="flex items-start gap-2">
          <Info class="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <div class="flex-1">
            <p class="text-sm text-blue-800 dark:text-blue-200">
              <strong>Switch/Case</strong> routes based on exact value matching. Like a switch statement in programming.
            </p>
            <button
              type="button"
              onClick={() => setExpandedHelp(!expandedHelp())}
              class="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-1"
            >
              {expandedHelp() ? 'Hide' : 'Show'} examples
            </button>
            <Show when={expandedHelp()}>
              <div class="mt-2 p-2 bg-blue-100 dark:bg-blue-900/40 rounded text-xs space-y-1 font-mono">
                <div><strong>Field access:</strong> data.status</div>
                <div><strong>Nested:</strong> data.user.role</div>
                <div><strong>Array:</strong> data.items[0].type</div>
                <div><strong>Default:</strong> Use "default" as a catch-all match</div>
              </div>
            </Show>
          </div>
        </div>
      </div>

      {/* Value to Match */}
      <div>
        <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          Value to Match <span class="text-red-500">*</span>
        </label>
        <input
          type="text"
          class="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-900 dark:text-white font-mono"
          placeholder="e.g., data.status or data.user.role"
          value={props.value.value}
          onInput={(e) => setValue(e.currentTarget.value)}
        />
        <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Expression that evaluates to the value you want to match against
        </p>
      </div>

      {/* Cases List */}
      <div>
        <div class="flex items-center justify-between mb-3">
          <label class="text-sm font-medium text-slate-700 dark:text-slate-300">
            Cases
          </label>
          <button
            type="button"
            onClick={addCase}
            class="btn btn-secondary text-sm flex items-center gap-1"
          >
            <Plus class="w-4 h-4" />
            Add Case
          </button>
        </div>

        <Show when={props.value.cases.length === 0}>
          <div class="p-6 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg text-center">
            <AlertCircle class="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p class="text-sm text-slate-600 dark:text-slate-400 mb-3">
              No cases defined. Add at least one case to enable routing.
            </p>
            <button
              type="button"
              onClick={addCase}
              class="btn btn-primary text-sm"
            >
              <Plus class="w-4 h-4 mr-1" />
              Add First Case
            </button>
          </div>
        </Show>

        <div class="space-y-3">
          <For each={props.value.cases}>
            {(caseItem, index) => (
              <div class="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg">
                <div class="flex items-start gap-3">
                  {/* Case Badge */}
                  <div class="flex-shrink-0">
                    <Show
                      when={caseItem.match.toLowerCase() === 'default'}
                      fallback={
                        <div class="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full flex items-center justify-center text-sm font-semibold">
                          {index() + 1}
                        </div>
                      }
                    >
                      <div class="w-8 h-8 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded-full flex items-center justify-center text-xs font-semibold">
                        ★
                      </div>
                    </Show>
                  </div>

                  {/* Case Fields */}
                  <div class="flex-1 space-y-3">
                    {/* Match Value */}
                    <div>
                      <label class="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Match Value <span class="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        class="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-900 dark:text-white font-mono"
                        placeholder='e.g., "active", "pending", or "default"'
                        value={caseItem.match}
                        onInput={(e) => updateCase(index(), 'match', e.currentTarget.value)}
                      />
                      <Show when={caseItem.match.toLowerCase() === 'default'}>
                        <p class="text-xs text-orange-600 dark:text-orange-400 mt-1">
                          ⭐ Default case - catches all unmatched values
                        </p>
                      </Show>
                    </div>

                    {/* Output Port */}
                    <div>
                      <label class="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Output Port Name
                      </label>
                      <input
                        type="text"
                        class="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-900 dark:text-white font-mono"
                        placeholder="e.g., active-path, pending-path"
                        value={caseItem.output}
                        onInput={(e) => updateCase(index(), 'output', e.currentTarget.value)}
                      />
                    </div>
                  </div>

                  {/* Actions */}
                  <div class="flex-shrink-0 flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => moveCase(index(), 'up')}
                      disabled={index() === 0}
                      class="p-1 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Move up"
                    >
                      <MoveUp class="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveCase(index(), 'down')}
                      disabled={index() === props.value.cases.length - 1}
                      class="p-1 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Move down"
                    >
                      <MoveDown class="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeCase(index())}
                      class="p-1 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                      title="Remove"
                    >
                      <Trash2 class="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Validation Warning */}
                <Show when={!caseItem.match.trim()}>
                  <div class="mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded text-xs text-yellow-700 dark:text-yellow-300 flex items-center gap-2">
                    <AlertCircle class="w-4 h-4" />
                    Match value is required
                  </div>
                </Show>
              </div>
            )}
          </For>
        </div>
      </div>

      {/* Tips */}
      <Show when={props.value.cases.length > 0}>
        <div class="p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg">
          <div class="text-xs text-slate-600 dark:text-slate-400 space-y-1">
            <div><strong>💡 Tip:</strong> Add a case with match value <code class="px-1 py-0.5 bg-slate-200 dark:bg-slate-700 rounded">default</code> as a catch-all</div>
            <div><strong>💡 Exact match:</strong> Comparisons are case-sensitive and exact</div>
            <div><strong>💡 Order:</strong> Cases are checked in order, first match wins</div>
          </div>
        </div>
      </Show>
    </div>
  );
}

// Default configuration
export const DEFAULT_SWITCH_CONFIG: SwitchConfig = {
  value: 'data.status',
  cases: [
    { match: 'active', output: 'active-users' },
    { match: 'pending', output: 'pending-users' },
    { match: 'inactive', output: 'inactive-users' },
    { match: 'default', output: 'other' }
  ]
};
