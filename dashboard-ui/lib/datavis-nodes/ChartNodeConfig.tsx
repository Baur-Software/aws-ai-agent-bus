import { createSignal, For, Show } from 'solid-js';
import { Plus, Trash2, BarChart3, LineChart, PieChart, TrendingUp, ScatterChart, Sparkles } from 'lucide-solid';
import { useDashboardServer } from '@/contexts/DashboardServerContext';

export type ChartType = 'bar' | 'line' | 'pie' | 'area' | 'scatter';

export interface ChartAxis {
  field: string;
  label?: string;
  type?: 'category' | 'numeric' | 'time';
  format?: string;
}

export interface ChartDataset {
  id: string;
  label: string;
  dataField: string;
  color?: string;
  type?: ChartType; // For mixed charts
}

export interface ChartConfig {
  type: ChartType;
  title?: string;
  description?: string;

  // Data source configuration
  dataSourceType: 'input' | 's3' | 'kv' | 'manual'; // Source type
  dataSource: string; // JSONPath, variable reference, S3 key, or KV key
  manualData?: string; // JSON string for manual input
  xAxis: ChartAxis;
  yAxis?: ChartAxis; // Not used for pie charts
  datasets: ChartDataset[];

  // AI reshaping
  useAIReshaping?: boolean;
  reshapingPrompt?: string;

  // Appearance
  width?: number | 'auto';
  height?: number;
  showLegend?: boolean;
  legendPosition?: 'top' | 'bottom' | 'left' | 'right';
  showGrid?: boolean;
  showTooltips?: boolean;

  // Interactivity
  enableZoom?: boolean;
  enablePan?: boolean;
  clickable?: boolean;

  // Advanced
  customColors?: string[];
  stacked?: boolean; // For bar/area charts
  smooth?: boolean; // For line/area charts
  responsive?: boolean;
}

export const DEFAULT_CHART_CONFIG: ChartConfig = {
  type: 'bar',
  title: '',
  description: '',
  dataSourceType: 'input',
  dataSource: '${input.data}',
  xAxis: {
    field: '',
    label: 'X Axis',
    type: 'category'
  },
  yAxis: {
    field: '',
    label: 'Y Axis',
    type: 'numeric'
  },
  datasets: [
    {
      id: 'dataset-1',
      label: 'Dataset 1',
      dataField: '',
      color: '#3b82f6'
    }
  ],
  useAIReshaping: false,
  width: 'auto',
  height: 400,
  showLegend: true,
  legendPosition: 'top',
  showGrid: true,
  showTooltips: true,
  enableZoom: false,
  enablePan: false,
  clickable: false,
  stacked: false,
  smooth: true,
  responsive: true
};

interface ChartNodeConfigProps {
  value: ChartConfig;
  onChange: (value: ChartConfig) => void;
}

export function ChartNodeConfig(props: ChartNodeConfigProps) {
  const [activeTab, setActiveTab] = createSignal<'data' | 'appearance' | 'advanced'>('data');
  const [showAIPanel, setShowAIPanel] = createSignal(false);
  const [isReshaping, setIsReshaping] = createSignal(false);
  const [reshapeError, setReshapeError] = createSignal<string | null>(null);
  const dashboardServer = useDashboardServer();

  const updateConfig = (key: keyof ChartConfig, value: any) => {
    props.onChange({ ...props.value, [key]: value });
  };

  const fetchDataFromSource = async (): Promise<any> => {
    const { dataSourceType, dataSource, manualData } = props.value;

    switch (dataSourceType) {
      case 'input':
        // Data comes from connected node - for now, use sample data
        return { items: [{ name: 'A', value: 10 }, { name: 'B', value: 20 }] };

      case 'kv':
        // Fetch from KV store
        if (!dataSource) throw new Error('KV key is required');
        const kvResult = await dashboardServer.kvStore.get(dataSource);
        return JSON.parse(kvResult.value || '{}');

      case 's3':
        // Fetch from S3 artifacts
        if (!dataSource) throw new Error('S3 artifact key is required');
        const s3Result = await dashboardServer.artifacts.get(dataSource);
        return JSON.parse(s3Result.content || '{}');

      case 'manual':
        // Parse manual JSON input
        if (!manualData) throw new Error('Manual data is required');
        return JSON.parse(manualData);

      default:
        throw new Error(`Unsupported data source type: ${dataSourceType}`);
    }
  };

  const handleAIReshape = async () => {
    if (!props.value.reshapingPrompt) {
      setReshapeError('Please provide reshaping instructions');
      return;
    }

    setIsReshaping(true);
    setReshapeError(null);

    try {
      // Fetch data from the configured source
      const sourceData = await fetchDataFromSource();

      const result = await dashboardServer.reshapeData(
        sourceData,
        props.value.reshapingPrompt,
        props.value.type
      );

      // Update the config with the reshaped data structure
      if (result.reshapedData) {
        console.log('AI reshaped data:', result.reshapedData);
        // TODO: Update chart config based on reshaped data
        // This could automatically populate xAxis, yAxis, and datasets
      }
    } catch (error) {
      setReshapeError(error instanceof Error ? error.message : 'Failed to reshape data');
    } finally {
      setIsReshaping(false);
    }
  };

  const chartTypeIcons = {
    bar: BarChart3,
    line: LineChart,
    pie: PieChart,
    area: TrendingUp,
    scatter: ScatterChart
  };

  const ChartIcon = () => chartTypeIcons[props.value.type];

  const addDataset = () => {
    const datasets = [...props.value.datasets];
    const newId = `dataset-${datasets.length + 1}`;
    datasets.push({
      id: newId,
      label: `Dataset ${datasets.length + 1}`,
      dataField: '',
      color: `#${Math.floor(Math.random()*16777215).toString(16)}`
    });
    updateConfig('datasets', datasets);
  };

  const updateDataset = (index: number, updates: Partial<ChartDataset>) => {
    const datasets = [...props.value.datasets];
    datasets[index] = { ...datasets[index], ...updates };
    updateConfig('datasets', datasets);
  };

  const removeDataset = (index: number) => {
    const datasets = props.value.datasets.filter((_, i) => i !== index);
    updateConfig('datasets', datasets);
  };

  const updateAxis = (axis: 'xAxis' | 'yAxis', updates: Partial<ChartAxis>) => {
    const current = props.value[axis];
    if (!current) return;
    updateConfig(axis, { ...current, ...updates });
  };

  return (
    <div class="space-y-4">
      {/* Chart Type Selection */}
      <div>
        <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          Chart Type <span class="text-red-500">*</span>
        </label>
        <div class="grid grid-cols-5 gap-2">
          <For each={[
            { type: 'bar' as const, icon: BarChart3, label: 'Bar' },
            { type: 'line' as const, icon: LineChart, label: 'Line' },
            { type: 'pie' as const, icon: PieChart, label: 'Pie' },
            { type: 'area' as const, icon: TrendingUp, label: 'Area' },
            { type: 'scatter' as const, icon: ScatterChart, label: 'Scatter' }
          ]}>
            {(chart) => {
              const Icon = chart.icon;
              return (
                <button
                  type="button"
                  class={`p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-2 ${
                    props.value.type === chart.type
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/30'
                      : 'border-slate-300 dark:border-slate-600 hover:border-blue-400'
                  }`}
                  onClick={() => updateConfig('type', chart.type)}
                >
                  <Icon class="w-6 h-6" />
                  <span class="text-xs">{chart.label}</span>
                </button>
              );
            }}
          </For>
        </div>
      </div>

      {/* Title and Description */}
      <div class="space-y-3">
        <div>
          <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Chart Title
          </label>
          <input
            type="text"
            class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., Monthly Revenue Trend"
            value={props.value.title || ''}
            onInput={(e) => updateConfig('title', e.currentTarget.value)}
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Description
          </label>
          <input
            type="text"
            class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Optional description"
            value={props.value.description || ''}
            onInput={(e) => updateConfig('description', e.currentTarget.value)}
          />
        </div>
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
              Let AI automatically transform your data into the format needed for this chart
            </p>
          </div>
        </div>

        <Show when={showAIPanel()}>
          <div class="mt-3 space-y-3">
            <div>
              <label class="block text-sm font-medium text-purple-900 dark:text-purple-200 mb-2">
                Reshaping Instructions
              </label>
              <textarea
                class="w-full px-3 py-2 border border-purple-300 dark:border-purple-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                rows="3"
                placeholder="Describe how to transform the data... e.g., 'Group by month and sum the revenue field'"
                value={props.value.reshapingPrompt || ''}
                onInput={(e) => updateConfig('reshapingPrompt', e.currentTarget.value)}
              />
            </div>

            <button
              type="button"
              class="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2"
              onClick={handleAIReshape}
              disabled={isReshaping() || !props.value.reshapingPrompt}
            >
              <Sparkles class="w-4 h-4" />
              {isReshaping() ? 'Reshaping Data...' : 'Apply AI Reshaping'}
            </button>

            <Show when={reshapeError()}>
              <div class="p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-700 dark:text-red-300">
                {reshapeError()}
              </div>
            </Show>
          </div>
        </Show>
      </div>

      {/* Tabs */}
      <div class="border-b border-slate-200 dark:border-slate-700">
        <div class="flex gap-2">
          <For each={[
            { id: 'data' as const, label: 'Data Mapping' },
            { id: 'appearance' as const, label: 'Appearance' },
            { id: 'advanced' as const, label: 'Advanced' }
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

      {/* Data Mapping Tab */}
      <Show when={activeTab() === 'data'}>
        <div class="space-y-4">
          {/* Data Source Type */}
          <div>
            <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Data Source Type <span class="text-red-500">*</span>
            </label>
            <select
              class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={props.value.dataSourceType}
              onChange={(e) => updateConfig('dataSourceType', e.currentTarget.value)}
            >
              <option value="input">Node Input (from connected node)</option>
              <option value="kv">KV Store</option>
              <option value="s3">S3 Artifacts</option>
              <option value="manual">Manual JSON Input</option>
            </select>
          </div>

          {/* Data Source Configuration */}
          <Show when={props.value.dataSourceType === 'input'}>
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Data Path
              </label>
              <input
                type="text"
                class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                placeholder="${input.data} or ${nodes.nodeId.output.items}"
                value={props.value.dataSource}
                onInput={(e) => updateConfig('dataSource', e.currentTarget.value)}
              />
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
                JSONPath or variable reference to your data array
              </p>
            </div>
          </Show>

          <Show when={props.value.dataSourceType === 'kv'}>
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                KV Store Key <span class="text-red-500">*</span>
              </label>
              <input
                type="text"
                class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                placeholder="my-data-key"
                value={props.value.dataSource}
                onInput={(e) => updateConfig('dataSource', e.currentTarget.value)}
              />
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Key to fetch data from the KV store
              </p>
            </div>
          </Show>

          <Show when={props.value.dataSourceType === 's3'}>
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                S3 Artifact Key <span class="text-red-500">*</span>
              </label>
              <input
                type="text"
                class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                placeholder="data/my-dataset.json"
                value={props.value.dataSource}
                onInput={(e) => updateConfig('dataSource', e.currentTarget.value)}
              />
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
                S3 artifact key to fetch data from
              </p>
            </div>
          </Show>

          <Show when={props.value.dataSourceType === 'manual'}>
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Manual JSON Data <span class="text-red-500">*</span>
              </label>
              <textarea
                class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                rows="6"
                placeholder={'[\n  {"name": "A", "value": 10},\n  {"name": "B", "value": 20}\n]'}
                value={props.value.manualData || ''}
                onInput={(e) => updateConfig('manualData', e.currentTarget.value)}
              />
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Paste your JSON data directly
              </p>
            </div>
          </Show>

          {/* X Axis Configuration (not for pie charts) */}
          <Show when={props.value.type !== 'pie'}>
            <div class="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg space-y-3">
              <h4 class="text-sm font-medium text-slate-700 dark:text-slate-300">X Axis</h4>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Field Name <span class="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    class="w-full px-2 py-1.5 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded text-sm"
                    placeholder="e.g., date, category"
                    value={props.value.xAxis.field}
                    onInput={(e) => updateAxis('xAxis', { field: e.currentTarget.value })}
                  />
                </div>
                <div>
                  <label class="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Label
                  </label>
                  <input
                    type="text"
                    class="w-full px-2 py-1.5 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded text-sm"
                    placeholder="X Axis"
                    value={props.value.xAxis.label || ''}
                    onInput={(e) => updateAxis('xAxis', { label: e.currentTarget.value })}
                  />
                </div>
              </div>
              <div>
                <label class="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Type
                </label>
                <select
                  class="w-full px-2 py-1.5 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded text-sm"
                  value={props.value.xAxis.type || 'category'}
                  onChange={(e) => updateAxis('xAxis', { type: e.currentTarget.value as any })}
                >
                  <option value="category">Category</option>
                  <option value="numeric">Numeric</option>
                  <option value="time">Time</option>
                </select>
              </div>
            </div>
          </Show>

          {/* Y Axis Configuration (not for pie charts) */}
          <Show when={props.value.type !== 'pie' && props.value.yAxis}>
            <div class="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg space-y-3">
              <h4 class="text-sm font-medium text-slate-700 dark:text-slate-300">Y Axis</h4>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Field Name <span class="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    class="w-full px-2 py-1.5 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded text-sm"
                    placeholder="e.g., value, amount"
                    value={props.value.yAxis?.field || ''}
                    onInput={(e) => updateAxis('yAxis', { field: e.currentTarget.value })}
                  />
                </div>
                <div>
                  <label class="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Label
                  </label>
                  <input
                    type="text"
                    class="w-full px-2 py-1.5 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded text-sm"
                    placeholder="Y Axis"
                    value={props.value.yAxis?.label || ''}
                    onInput={(e) => updateAxis('yAxis', { label: e.currentTarget.value })}
                  />
                </div>
              </div>
            </div>
          </Show>

          {/* Datasets */}
          <div>
            <div class="flex items-center justify-between mb-2">
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Datasets <span class="text-red-500">*</span>
              </label>
              <button
                type="button"
                class="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                onClick={addDataset}
              >
                <Plus class="w-3 h-3" />
                Add Dataset
              </button>
            </div>
            <div class="space-y-3">
              <For each={props.value.datasets}>
                {(dataset, index) => (
                  <div class="p-3 border border-slate-300 dark:border-slate-600 rounded-lg space-y-2">
                    <div class="flex items-center justify-between">
                      <span class="text-sm font-medium text-slate-700 dark:text-slate-300">
                        Dataset {index() + 1}
                      </span>
                      <Show when={props.value.datasets.length > 1}>
                        <button
                          type="button"
                          class="p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                          onClick={() => removeDataset(index())}
                        >
                          <Trash2 class="w-4 h-4" />
                        </button>
                      </Show>
                    </div>
                    <div class="grid grid-cols-2 gap-2">
                      <div>
                        <label class="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                          Label
                        </label>
                        <input
                          type="text"
                          class="w-full px-2 py-1.5 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded text-sm"
                          placeholder="Dataset label"
                          value={dataset.label}
                          onInput={(e) => updateDataset(index(), { label: e.currentTarget.value })}
                        />
                      </div>
                      <div>
                        <label class="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                          Data Field
                        </label>
                        <input
                          type="text"
                          class="w-full px-2 py-1.5 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded text-sm"
                          placeholder="Field name"
                          value={dataset.dataField}
                          onInput={(e) => updateDataset(index(), { dataField: e.currentTarget.value })}
                        />
                      </div>
                    </div>
                    <div>
                      <label class="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Color
                      </label>
                      <input
                        type="color"
                        class="w-full h-8 border border-slate-300 dark:border-slate-600 rounded cursor-pointer"
                        value={dataset.color || '#3b82f6'}
                        onInput={(e) => updateDataset(index(), { color: e.currentTarget.value })}
                      />
                    </div>
                  </div>
                )}
              </For>
            </div>
          </div>
        </div>
      </Show>

      {/* Appearance Tab */}
      <Show when={activeTab() === 'appearance'}>
        <div class="space-y-4">
          {/* Dimensions */}
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Width
              </label>
              <select
                class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={props.value.width === 'auto' ? 'auto' : 'custom'}
                onChange={(e) => updateConfig('width', e.currentTarget.value === 'auto' ? 'auto' : 600)}
              >
                <option value="auto">Auto</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Height (px)
              </label>
              <input
                type="number"
                class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={props.value.height || 400}
                onInput={(e) => updateConfig('height', parseInt(e.currentTarget.value))}
              />
            </div>
          </div>

          {/* Legend */}
          <div class="space-y-3">
            <div class="flex items-center gap-2">
              <input
                type="checkbox"
                id="showLegend"
                class="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                checked={props.value.showLegend ?? true}
                onChange={(e) => updateConfig('showLegend', e.currentTarget.checked)}
              />
              <label for="showLegend" class="text-sm text-slate-700 dark:text-slate-300">
                Show Legend
              </label>
            </div>
            <Show when={props.value.showLegend}>
              <div>
                <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Legend Position
                </label>
                <div class="grid grid-cols-4 gap-2">
                  <For each={['top', 'bottom', 'left', 'right'] as const}>
                    {(pos) => (
                      <button
                        type="button"
                        class={`px-3 py-1.5 rounded text-sm ${
                          props.value.legendPosition === pos
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                        }`}
                        onClick={() => updateConfig('legendPosition', pos)}
                      >
                        {pos}
                      </button>
                    )}
                  </For>
                </div>
              </div>
            </Show>
          </div>

          {/* Display Options */}
          <div class="space-y-2">
            <div class="flex items-center gap-2">
              <input
                type="checkbox"
                id="showGrid"
                class="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                checked={props.value.showGrid ?? true}
                onChange={(e) => updateConfig('showGrid', e.currentTarget.checked)}
              />
              <label for="showGrid" class="text-sm text-slate-700 dark:text-slate-300">
                Show Grid Lines
              </label>
            </div>
            <div class="flex items-center gap-2">
              <input
                type="checkbox"
                id="showTooltips"
                class="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                checked={props.value.showTooltips ?? true}
                onChange={(e) => updateConfig('showTooltips', e.currentTarget.checked)}
              />
              <label for="showTooltips" class="text-sm text-slate-700 dark:text-slate-300">
                Show Tooltips
              </label>
            </div>
            <div class="flex items-center gap-2">
              <input
                type="checkbox"
                id="responsive"
                class="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                checked={props.value.responsive ?? true}
                onChange={(e) => updateConfig('responsive', e.currentTarget.checked)}
              />
              <label for="responsive" class="text-sm text-slate-700 dark:text-slate-300">
                Responsive
              </label>
            </div>
          </div>
        </div>
      </Show>

      {/* Advanced Tab */}
      <Show when={activeTab() === 'advanced'}>
        <div class="space-y-4">
          {/* Chart-specific options */}
          <Show when={['bar', 'area'].includes(props.value.type)}>
            <div class="flex items-center gap-2">
              <input
                type="checkbox"
                id="stacked"
                class="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                checked={props.value.stacked ?? false}
                onChange={(e) => updateConfig('stacked', e.currentTarget.checked)}
              />
              <label for="stacked" class="text-sm text-slate-700 dark:text-slate-300">
                Stacked Chart
              </label>
            </div>
          </Show>

          <Show when={['line', 'area'].includes(props.value.type)}>
            <div class="flex items-center gap-2">
              <input
                type="checkbox"
                id="smooth"
                class="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                checked={props.value.smooth ?? true}
                onChange={(e) => updateConfig('smooth', e.currentTarget.checked)}
              />
              <label for="smooth" class="text-sm text-slate-700 dark:text-slate-300">
                Smooth Lines
              </label>
            </div>
          </Show>

          {/* Interactivity */}
          <div class="space-y-2">
            <h4 class="text-sm font-medium text-slate-700 dark:text-slate-300">Interactivity</h4>
            <div class="flex items-center gap-2">
              <input
                type="checkbox"
                id="enableZoom"
                class="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                checked={props.value.enableZoom ?? false}
                onChange={(e) => updateConfig('enableZoom', e.currentTarget.checked)}
              />
              <label for="enableZoom" class="text-sm text-slate-700 dark:text-slate-300">
                Enable Zoom
              </label>
            </div>
            <div class="flex items-center gap-2">
              <input
                type="checkbox"
                id="enablePan"
                class="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                checked={props.value.enablePan ?? false}
                onChange={(e) => updateConfig('enablePan', e.currentTarget.checked)}
              />
              <label for="enablePan" class="text-sm text-slate-700 dark:text-slate-300">
                Enable Pan
              </label>
            </div>
            <div class="flex items-center gap-2">
              <input
                type="checkbox"
                id="clickable"
                class="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                checked={props.value.clickable ?? false}
                onChange={(e) => updateConfig('clickable', e.currentTarget.checked)}
              />
              <label for="clickable" class="text-sm text-slate-700 dark:text-slate-300">
                Clickable Elements (emit events)
              </label>
            </div>
          </div>
        </div>
      </Show>

      {/* Help Text */}
      <div class="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md">
        <p class="text-xs text-blue-600 dark:text-blue-400">
          <strong>Tip:</strong> Charts automatically render at workflow execution completion.
          Enable AI reshaping to automatically transform complex data structures into chart-ready formats.
        </p>
      </div>
    </div>
  );
}
