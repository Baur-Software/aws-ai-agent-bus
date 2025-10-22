import { createSignal, For, Show } from 'solid-js';
import { Plus, Trash2, MoveUp, MoveDown, AlertCircle, Info } from 'lucide-solid';

export interface Condition {
  condition: string;
  label: string;
  output: string;
}

export interface ConditionalConfig {
  conditions: Condition[];
  mode: 'first-match' | 'all-matches';
}

interface ConditionalNodeConfigProps {
  value: ConditionalConfig;
  onChange: (value: ConditionalConfig) => void;
}

export function ConditionalNodeConfig(props: ConditionalNodeConfigProps) {
  const [expandedHelp, setExpandedHelp] = createSignal(false);

  const addCondition = () => {
    const newConditions = [
      ...props.value.conditions,
      { condition: '', label: '', output: `output-${props.value.conditions.length + 1}` }
    ];
    props.onChange({ ...props.value, conditions: newConditions });
  };

  const removeCondition = (index: number) => {
    const newConditions = props.value.conditions.filter((_, i) => i !== index);
    props.onChange({ ...props.value, conditions: newConditions });
  };

  const updateCondition = (index: number, field: keyof Condition, value: string) => {
    const newConditions = [...props.value.conditions];
    newConditions[index] = { ...newConditions[index], [field]: value };
    props.onChange({ ...props.value, conditions: newConditions });
  };

  const moveCondition = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === props.value.conditions.length - 1) return;

    const newConditions = [...props.value.conditions];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    [newConditions[index], newConditions[newIndex]] = [newConditions[newIndex], newConditions[index]];
    props.onChange({ ...props.value, conditions: newConditions });
  };

  const setMode = (mode: 'first-match' | 'all-matches') => {
    props.onChange({ ...props.value, mode });
  };

  return (
    <div class="space-y-4">
      {/* Info Banner */}
      <div class="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <div class="flex items-start gap-2">
          <Info class="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <div class="flex-1">
            <p class="text-sm text-blue-800 dark:text-blue-200">
              <strong>Conditional branching</strong> evaluates conditions in order. Each condition creates a separate output port.
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
                <div><strong>Simple:</strong> data.value &gt; 100</div>
                <div><strong>String:</strong> data.status === 'active'</div>
                <div><strong>Complex:</strong> data.price &gt; 50 && data.category === 'premium'</div>
                <div><strong>Else:</strong> true (always matches)</div>
              </div>
            </Show>
          </div>
        </div>
      </div>

      {/* Evaluation Mode */}
      <div>
        <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          Evaluation Mode
        </label>
        <div class="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setMode('first-match')}
            class={`p-3 border-2 rounded-lg transition-colors text-left ${
              props.value.mode === 'first-match'
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-slate-300 dark:border-slate-600 hover:border-slate-400'
            }`}
          >
            <div class="font-medium text-slate-900 dark:text-white text-sm">First Match</div>
            <div class="text-xs text-slate-600 dark:text-slate-400 mt-1">
              Stops at first true condition (if/else if/else)
            </div>
          </button>
          <button
            type="button"
            onClick={() => setMode('all-matches')}
            class={`p-3 border-2 rounded-lg transition-colors text-left ${
              props.value.mode === 'all-matches'
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-slate-300 dark:border-slate-600 hover:border-slate-400'
            }`}
          >
            <div class="font-medium text-slate-900 dark:text-white text-sm">All Matches</div>
            <div class="text-xs text-slate-600 dark:text-slate-400 mt-1">
              Executes all matching branches in parallel
            </div>
          </button>
        </div>
      </div>

      {/* Conditions List */}
      <div>
        <div class="flex items-center justify-between mb-3">
          <label class="text-sm font-medium text-slate-700 dark:text-slate-300">
            Conditions <span class="text-slate-500">(evaluated in order)</span>
          </label>
          <button
            type="button"
            onClick={addCondition}
            class="btn btn-secondary text-sm flex items-center gap-1"
          >
            <Plus class="w-4 h-4" />
            Add Condition
          </button>
        </div>

        <Show when={props.value.conditions.length === 0}>
          <div class="p-6 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg text-center">
            <AlertCircle class="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p class="text-sm text-slate-600 dark:text-slate-400 mb-3">
              No conditions defined. Add at least one condition to enable branching.
            </p>
            <button
              type="button"
              onClick={addCondition}
              class="btn btn-primary text-sm"
            >
              <Plus class="w-4 h-4 mr-1" />
              Add First Condition
            </button>
          </div>
        </Show>

        <div class="space-y-3">
          <For each={props.value.conditions}>
            {(condition, index) => (
              <div class="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg">
                <div class="flex items-start gap-3">
                  {/* Order Badge */}
                  <div class="flex-shrink-0 w-8 h-8 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full flex items-center justify-center text-sm font-semibold">
                    {index() + 1}
                  </div>

                  {/* Condition Fields */}
                  <div class="flex-1 space-y-3">
                    {/* Label */}
                    <div>
                      <label class="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Label
                      </label>
                      <input
                        type="text"
                        class="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-900 dark:text-white"
                        placeholder="e.g., High Value"
                        value={condition.label}
                        onInput={(e) => updateCondition(index(), 'label', e.currentTarget.value)}
                      />
                    </div>

                    {/* Condition Expression */}
                    <div>
                      <label class="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Condition Expression <span class="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        class="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-900 dark:text-white font-mono"
                        placeholder="e.g., data.value > 100"
                        value={condition.condition}
                        onInput={(e) => updateCondition(index(), 'condition', e.currentTarget.value)}
                      />
                    </div>

                    {/* Output Port */}
                    <div>
                      <label class="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Output Port Name
                      </label>
                      <input
                        type="text"
                        class="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-900 dark:text-white font-mono"
                        placeholder="e.g., high, medium, low"
                        value={condition.output}
                        onInput={(e) => updateCondition(index(), 'output', e.currentTarget.value)}
                      />
                    </div>
                  </div>

                  {/* Actions */}
                  <div class="flex-shrink-0 flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => moveCondition(index(), 'up')}
                      disabled={index() === 0}
                      class="p-1 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Move up"
                    >
                      <MoveUp class="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveCondition(index(), 'down')}
                      disabled={index() === props.value.conditions.length - 1}
                      class="p-1 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Move down"
                    >
                      <MoveDown class="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeCondition(index())}
                      class="p-1 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                      title="Remove"
                    >
                      <Trash2 class="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Validation Warning */}
                <Show when={!condition.condition.trim()}>
                  <div class="mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded text-xs text-yellow-700 dark:text-yellow-300 flex items-center gap-2">
                    <AlertCircle class="w-4 h-4" />
                    Condition expression is required
                  </div>
                </Show>
              </div>
            )}
          </For>
        </div>
      </div>

      {/* Tips */}
      <Show when={props.value.conditions.length > 0}>
        <div class="p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg">
          <div class="text-xs text-slate-600 dark:text-slate-400 space-y-1">
            <div><strong>💡 Tip:</strong> Add a final condition with <code class="px-1 py-0.5 bg-slate-200 dark:bg-slate-700 rounded">true</code> as the else/default branch</div>
            <div><strong>💡 Order matters:</strong> Conditions are evaluated from top to bottom</div>
            <Show when={props.value.mode === 'first-match'}>
              <div><strong>💡 First match mode:</strong> Only the first true condition will execute</div>
            </Show>
            <Show when={props.value.mode === 'all-matches'}>
              <div><strong>💡 All matches mode:</strong> All true conditions will execute in parallel</div>
            </Show>
          </div>
        </div>
      </Show>
    </div>
  );
}

// Default configuration
export const DEFAULT_CONDITIONAL_CONFIG: ConditionalConfig = {
  conditions: [
    { condition: 'data.value > 100', label: 'High Value', output: 'high' },
    { condition: 'data.value > 50', label: 'Medium Value', output: 'medium' },
    { condition: 'true', label: 'Default/Else', output: 'low' }
  ],
  mode: 'first-match'
};
