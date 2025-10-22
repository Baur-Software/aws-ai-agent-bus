import { createSignal, For, Show } from 'solid-js';
import { Plus, Trash2, TrendingUp, TrendingDown, Minus, Sparkles, Activity } from 'lucide-solid';

export type MetricTrend = 'up' | 'down' | 'neutral';

export interface MetricCard {
  id: string;
  label: string;
  valueField: string;
  format?: 'number' | 'currency' | 'percentage' | 'duration';
  prefix?: string;
  suffix?: string;
  decimals?: number;

  // Trend/comparison
  showTrend?: boolean;
  trendField?: string;
  trendFormat?: 'percentage' | 'absolute';
  comparisonLabel?: string; // e.g., "vs last month"

  // Appearance
  color?: string;
  icon?: string;
  size?: 'small' | 'medium' | 'large';
}

export interface MetricsConfig {
  // Data source configuration
  dataSourceType: 'input' | 's3' | 'kv' | 'manual';
  dataSource: string;
  manualData?: string;
  metrics: MetricCard[];

  // AI reshaping
  useAIReshaping?: boolean;
  reshapingPrompt?: string;

  // Layout
  layout?: 'grid' | 'row' | 'column';
  columns?: number; // For grid layout
  gap?: number;

  // Appearance
  showIcons?: boolean;
  showTrends?: boolean;
  cardStyle?: 'default' | 'bordered' | 'elevated' | 'minimal';

  // Refresh
  autoRefresh?: boolean;
  refreshInterval?: number; // seconds
}

export const DEFAULT_METRICS_CONFIG: MetricsConfig = {
  dataSourceType: 'input',
  dataSource: '${input.data}',
  metrics: [
    {
      id: 'metric-1',
      label: 'Total Revenue',
      valueField: 'revenue',
      format: 'currency',
      prefix: '$',
      decimals: 2,
      showTrend: true,
      trendField: 'revenueChange',
      trendFormat: 'percentage',
      comparisonLabel: 'vs last month',
      color: '#3b82f6',
      size: 'medium'
    }
  ],
  useAIReshaping: false,
  layout: 'grid',
  columns: 3,
  gap: 16,
  showIcons: true,
  showTrends: true,
  cardStyle: 'elevated',
  autoRefresh: false,
  refreshInterval: 60
};

interface MetricsNodeConfigProps {
  value: MetricsConfig;
  onChange: (value: MetricsConfig) => void;
}

export function MetricsNodeConfig(props: MetricsNodeConfigProps) {
  const [activeTab, setActiveTab] = createSignal<'metrics' | 'layout' | 'appearance'>('metrics');
  const [showAIPanel, setShowAIPanel] = createSignal(false);

  const updateConfig = (key: keyof MetricsConfig, value: any) => {
    props.onChange({ ...props.value, [key]: value });
  };

  const addMetric = () => {
    const metrics = [...props.value.metrics];
    const newId = `metric-${metrics.length + 1}`;
    metrics.push({
      id: newId,
      label: `Metric ${metrics.length + 1}`,
      valueField: '',
      format: 'number',
      decimals: 0,
      showTrend: false,
      color: `#${Math.floor(Math.random()*16777215).toString(16)}`,
      size: 'medium'
    });
    updateConfig('metrics', metrics);
  };

  const updateMetric = (index: number, updates: Partial<MetricCard>) => {
    const metrics = [...props.value.metrics];
    metrics[index] = { ...metrics[index], ...updates };
    updateConfig('metrics', metrics);
  };

  const removeMetric = (index: number) => {
    const metrics = props.value.metrics.filter((_, i) => i !== index);
    updateConfig('metrics', metrics);
  };

  const moveMetric = (index: number, direction: 'up' | 'down') => {
    const metrics = [...props.value.metrics];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= metrics.length) return;
    [metrics[index], metrics[newIndex]] = [metrics[newIndex], metrics[index]];
    updateConfig('metrics', metrics);
  };

  return (
    <div class="space-y-4">
      {/* Header */}
      <div class="flex items-center gap-2">
        <Activity class="w-5 h-5 text-blue-600" />
        <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Metrics Dashboard Configuration</h3>
      </div>

      {/* Data Source */}
      <div>
        <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          Data Source <span class="text-red-500">*</span>
        </label>
        <input
          type="text"
          class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
          placeholder="${input.data} or ${nodes.nodeId.output.metrics}"
          value={props.value.dataSource}
          onInput={(e) => updateConfig('dataSource', e.currentTarget.value)}
        />
        <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Can be an object with metric fields or an array of metrics
        </p>
      </div>

      {/* AI Reshaping Toggle */}
      <div class="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
        <div class="flex items-start gap-3">
          <input
            type="checkbox"
            id="useAIReshaping"
            class="mt-1 w-4 h-4 text-purple-600 border-slate-300 rounded focus:ring-purple-500"
            checked={props.value.useAIReshaping ?? false}
            onChange={(e) => {
              updateConfig('useAIReshaping', e.currentTarget.checked);
              setShowAIPanel(e.currentTarget.checked);
            }}
          />
          <div class="flex-1">
            <label for="useAIReshaping" class="flex items-center gap-2 text-sm font-medium text-purple-900 dark:text-purple-200 cursor-pointer">
              <Sparkles class="w-4 h-4" />
              Use AI Data Reshaping
            </label>
            <p class="text-xs text-purple-700 dark:text-purple-300 mt-1">
              Let AI automatically extract and format metrics from your data
            </p>
          </div>
        </div>

        <Show when={showAIPanel()}>
          <div class="mt-3">
            <label class="block text-sm font-medium text-purple-900 dark:text-purple-200 mb-2">
              Reshaping Instructions
            </label>
            <textarea
              class="w-full px-3 py-2 border border-purple-300 dark:border-purple-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
              rows="3"
              placeholder="Describe how to extract metrics... e.g., 'Calculate total revenue, count active users, and compute conversion rate'"
              value={props.value.reshapingPrompt || ''}
              onInput={(e) => updateConfig('reshapingPrompt', e.currentTarget.value)}
            />
          </div>
        </Show>
      </div>

      {/* Tabs */}
      <div class="border-b border-slate-200 dark:border-slate-700">
        <div class="flex gap-2">
          <For each={[
            { id: 'metrics' as const, label: 'Metrics' },
            { id: 'layout' as const, label: 'Layout' },
            { id: 'appearance' as const, label: 'Appearance' }
          ]}>
            {(tab) => (
              <button
                type="button"
                class={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab() === tab.id
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            )}
          </For>
        </div>
      </div>

      {/* Metrics Tab */}
      <Show when={activeTab() === 'metrics'}>
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <label class="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Metric Cards <span class="text-red-500">*</span>
            </label>
            <button
              type="button"
              class="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              onClick={addMetric}
            >
              <Plus class="w-3 h-3" />
              Add Metric
            </button>
          </div>

          <div class="space-y-3">
            <For each={props.value.metrics}>
              {(metric, index) => (
                <div class="p-4 border-2 border-slate-300 dark:border-slate-600 rounded-lg space-y-3">
                  {/* Metric Header */}
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <div
                        class="w-3 h-3 rounded-full"
                        style={{ "background-color": metric.color || '#3b82f6' }}
                      />
                      <span class="text-sm font-medium text-slate-700 dark:text-slate-300">
                        {metric.label || `Metric ${index() + 1}`}
                      </span>
                    </div>
                    <div class="flex items-center gap-1">
                      <button
                        type="button"
                        class="p-1 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded disabled:opacity-30"
                        disabled={index() === 0}
                        onClick={() => moveMetric(index(), 'up')}
                        title="Move up"
                      >
                        <TrendingUp class="w-4 h-4 rotate-180" />
                      </button>
                      <button
                        type="button"
                        class="p-1 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded disabled:opacity-30"
                        disabled={index() === props.value.metrics.length - 1}
                        onClick={() => moveMetric(index(), 'down')}
                        title="Move down"
                      >
                        <TrendingDown class="w-4 h-4" />
                      </button>
                      <Show when={props.value.metrics.length > 1}>
                        <button
                          type="button"
                          class="p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                          onClick={() => removeMetric(index())}
                          title="Remove metric"
                        >
                          <Trash2 class="w-4 h-4" />
                        </button>
                      </Show>
                    </div>
                  </div>

                  {/* Basic Fields */}
                  <div class="grid grid-cols-2 gap-3">
                    <div>
                      <label class="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Label <span class="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        class="w-full px-2 py-1.5 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded text-sm"
                        placeholder="e.g., Total Revenue"
                        value={metric.label}
                        onInput={(e) => updateMetric(index(), { label: e.currentTarget.value })}
                      />
                    </div>
                    <div>
                      <label class="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Value Field <span class="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        class="w-full px-2 py-1.5 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded text-sm"
                        placeholder="e.g., revenue"
                        value={metric.valueField}
                        onInput={(e) => updateMetric(index(), { valueField: e.currentTarget.value })}
                      />
                    </div>
                  </div>

                  {/* Formatting */}
                  <div class="grid grid-cols-4 gap-2">
                    <div>
                      <label class="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Format
                      </label>
                      <select
                        class="w-full px-2 py-1.5 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded text-sm"
                        value={metric.format || 'number'}
                        onChange={(e) => updateMetric(index(), { format: e.currentTarget.value as any })}
                      >
                        <option value="number">Number</option>
                        <option value="currency">Currency</option>
                        <option value="percentage">Percentage</option>
                        <option value="duration">Duration</option>
                      </select>
                    </div>
                    <div>
                      <label class="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Decimals
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="4"
                        class="w-full px-2 py-1.5 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded text-sm"
                        value={metric.decimals ?? 0}
                        onInput={(e) => updateMetric(index(), { decimals: parseInt(e.currentTarget.value) })}
                      />
                    </div>
                    <div>
                      <label class="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Prefix
                      </label>
                      <input
                        type="text"
                        class="w-full px-2 py-1.5 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded text-sm"
                        placeholder="$"
                        value={metric.prefix || ''}
                        onInput={(e) => updateMetric(index(), { prefix: e.currentTarget.value })}
                      />
                    </div>
                    <div>
                      <label class="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Suffix
                      </label>
                      <input
                        type="text"
                        class="w-full px-2 py-1.5 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded text-sm"
                        placeholder="ms"
                        value={metric.suffix || ''}
                        onInput={(e) => updateMetric(index(), { suffix: e.currentTarget.value })}
                      />
                    </div>
                  </div>

                  {/* Trend Configuration */}
                  <div class="p-2 bg-slate-50 dark:bg-slate-900/50 rounded space-y-2">
                    <div class="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`showTrend-${index()}`}
                        class="w-3 h-3 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                        checked={metric.showTrend ?? false}
                        onChange={(e) => updateMetric(index(), { showTrend: e.currentTarget.checked })}
                      />
                      <label for={`showTrend-${index()}`} class="text-xs font-medium text-slate-700 dark:text-slate-300">
                        Show Trend
                      </label>
                    </div>

                    <Show when={metric.showTrend}>
                      <div class="grid grid-cols-3 gap-2">
                        <div>
                          <label class="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                            Trend Field
                          </label>
                          <input
                            type="text"
                            class="w-full px-2 py-1.5 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded text-xs"
                            placeholder="changePercent"
                            value={metric.trendField || ''}
                            onInput={(e) => updateMetric(index(), { trendField: e.currentTarget.value })}
                          />
                        </div>
                        <div>
                          <label class="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                            Format
                          </label>
                          <select
                            class="w-full px-2 py-1.5 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded text-xs"
                            value={metric.trendFormat || 'percentage'}
                            onChange={(e) => updateMetric(index(), { trendFormat: e.currentTarget.value as any })}
                          >
                            <option value="percentage">Percentage</option>
                            <option value="absolute">Absolute</option>
                          </select>
                        </div>
                        <div>
                          <label class="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                            Comparison Label
                          </label>
                          <input
                            type="text"
                            class="w-full px-2 py-1.5 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded text-xs"
                            placeholder="vs last month"
                            value={metric.comparisonLabel || ''}
                            onInput={(e) => updateMetric(index(), { comparisonLabel: e.currentTarget.value })}
                          />
                        </div>
                      </div>
                    </Show>
                  </div>

                  {/* Appearance */}
                  <div class="grid grid-cols-2 gap-3">
                    <div>
                      <label class="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Color
                      </label>
                      <input
                        type="color"
                        class="w-full h-8 border border-slate-300 dark:border-slate-600 rounded cursor-pointer"
                        value={metric.color || '#3b82f6'}
                        onInput={(e) => updateMetric(index(), { color: e.currentTarget.value })}
                      />
                    </div>
                    <div>
                      <label class="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Size
                      </label>
                      <select
                        class="w-full px-2 py-1.5 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded text-sm"
                        value={metric.size || 'medium'}
                        onChange={(e) => updateMetric(index(), { size: e.currentTarget.value as any })}
                      >
                        <option value="small">Small</option>
                        <option value="medium">Medium</option>
                        <option value="large">Large</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>

      {/* Layout Tab */}
      <Show when={activeTab() === 'layout'}>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Layout Style
            </label>
            <div class="grid grid-cols-3 gap-2">
              <For each={[
                { value: 'grid' as const, label: 'Grid' },
                { value: 'row' as const, label: 'Row' },
                { value: 'column' as const, label: 'Column' }
              ]}>
                {(layout) => (
                  <button
                    type="button"
                    class={`px-4 py-2 rounded text-sm ${
                      props.value.layout === layout.value
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                    onClick={() => updateConfig('layout', layout.value)}
                  >
                    {layout.label}
                  </button>
                )}
              </For>
            </div>
          </div>

          <Show when={props.value.layout === 'grid'}>
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Columns
              </label>
              <input
                type="number"
                min="1"
                max="6"
                class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={props.value.columns || 3}
                onInput={(e) => updateConfig('columns', parseInt(e.currentTarget.value))}
              />
            </div>
          </Show>

          <div>
            <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Gap (px)
            </label>
            <input
              type="number"
              min="0"
              max="48"
              step="4"
              class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={props.value.gap || 16}
              onInput={(e) => updateConfig('gap', parseInt(e.currentTarget.value))}
            />
          </div>
        </div>
      </Show>

      {/* Appearance Tab */}
      <Show when={activeTab() === 'appearance'}>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Card Style
            </label>
            <div class="grid grid-cols-2 gap-2">
              <For each={[
                { value: 'default' as const, label: 'Default' },
                { value: 'bordered' as const, label: 'Bordered' },
                { value: 'elevated' as const, label: 'Elevated' },
                { value: 'minimal' as const, label: 'Minimal' }
              ]}>
                {(style) => (
                  <button
                    type="button"
                    class={`px-3 py-2 rounded text-sm ${
                      props.value.cardStyle === style.value
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                    onClick={() => updateConfig('cardStyle', style.value)}
                  >
                    {style.label}
                  </button>
                )}
              </For>
            </div>
          </div>

          <div class="space-y-2">
            <div class="flex items-center gap-2">
              <input
                type="checkbox"
                id="showIcons"
                class="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                checked={props.value.showIcons ?? true}
                onChange={(e) => updateConfig('showIcons', e.currentTarget.checked)}
              />
              <label for="showIcons" class="text-sm text-slate-700 dark:text-slate-300">
                Show Icons
              </label>
            </div>
            <div class="flex items-center gap-2">
              <input
                type="checkbox"
                id="showTrends"
                class="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                checked={props.value.showTrends ?? true}
                onChange={(e) => updateConfig('showTrends', e.currentTarget.checked)}
              />
              <label for="showTrends" class="text-sm text-slate-700 dark:text-slate-300">
                Show Trends
              </label>
            </div>
          </div>

          {/* Auto Refresh */}
          <div class="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg space-y-3">
            <div class="flex items-center gap-2">
              <input
                type="checkbox"
                id="autoRefresh"
                class="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                checked={props.value.autoRefresh ?? false}
                onChange={(e) => updateConfig('autoRefresh', e.currentTarget.checked)}
              />
              <label for="autoRefresh" class="text-sm font-medium text-slate-700 dark:text-slate-300">
                Auto Refresh
              </label>
            </div>
            <Show when={props.value.autoRefresh}>
              <div>
                <label class="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Refresh Interval (seconds)
                </label>
                <input
                  type="number"
                  min="10"
                  max="3600"
                  class="w-full px-2 py-1.5 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded text-sm"
                  value={props.value.refreshInterval || 60}
                  onInput={(e) => updateConfig('refreshInterval', parseInt(e.currentTarget.value))}
                />
              </div>
            </Show>
          </div>
        </div>
      </Show>

      {/* Help Text */}
      <div class="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md">
        <p class="text-xs text-blue-600 dark:text-blue-400">
          <strong>Tip:</strong> Metrics display key performance indicators (KPIs) in an easy-to-scan format.
          Perfect for dashboards showing business metrics, system health, or real-time statistics.
        </p>
      </div>
    </div>
  );
}
