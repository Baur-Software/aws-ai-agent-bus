import { createSignal, For, Show } from 'solid-js';
import { Plus, Trash2, Table, ArrowUpDown, Filter, Eye, EyeOff, Sparkles } from 'lucide-solid';

export interface TableColumn {
  id: string;
  field: string;
  label: string;
  type?: 'text' | 'number' | 'date' | 'boolean' | 'image' | 'link' | 'badge';
  format?: string;
  width?: number | 'auto';
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
  filterable?: boolean;
  visible?: boolean;
}

export interface TableSortConfig {
  column: string;
  direction: 'asc' | 'desc';
}

export interface TableFilterConfig {
  column: string;
  operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'gt' | 'lt' | 'between';
  value: string | number | [number, number];
}

export interface TableConfig {
  // Data
  dataSource: string;
  columns: TableColumn[];

  // AI reshaping
  useAIReshaping?: boolean;
  reshapingPrompt?: string;

  // Pagination
  enablePagination?: boolean;
  pageSize?: number;
  pageSizeOptions?: number[];

  // Sorting
  enableSorting?: boolean;
  defaultSort?: TableSortConfig;

  // Filtering
  enableFiltering?: boolean;
  defaultFilters?: TableFilterConfig[];

  // Selection
  enableSelection?: boolean;
  selectionMode?: 'single' | 'multiple';

  // Appearance
  striped?: boolean;
  bordered?: boolean;
  hoverable?: boolean;
  compact?: boolean;
  stickyHeader?: boolean;

  // Export
  enableExport?: boolean;
  exportFormats?: ('csv' | 'json' | 'xlsx')[];

  // Actions
  rowActions?: { label: string; action: string }[];
}

export const DEFAULT_TABLE_CONFIG: TableConfig = {
  dataSource: '${input.data}',
  columns: [
    {
      id: 'col-1',
      field: '',
      label: 'Column 1',
      type: 'text',
      width: 'auto',
      align: 'left',
      sortable: true,
      filterable: true,
      visible: true
    }
  ],
  useAIReshaping: false,
  enablePagination: true,
  pageSize: 25,
  pageSizeOptions: [10, 25, 50, 100],
  enableSorting: true,
  enableFiltering: true,
  enableSelection: false,
  selectionMode: 'single',
  striped: true,
  bordered: false,
  hoverable: true,
  compact: false,
  stickyHeader: true,
  enableExport: false,
  exportFormats: ['csv', 'json'],
  rowActions: []
};

interface TableNodeConfigProps {
  value: TableConfig;
  onChange: (value: TableConfig) => void;
}

export function TableNodeConfig(props: TableNodeConfigProps) {
  const [activeTab, setActiveTab] = createSignal<'columns' | 'features' | 'appearance'>('columns');
  const [showAIPanel, setShowAIPanel] = createSignal(false);

  const updateConfig = (key: keyof TableConfig, value: any) => {
    props.onChange({ ...props.value, [key]: value });
  };

  const addColumn = () => {
    const columns = [...props.value.columns];
    const newId = `col-${columns.length + 1}`;
    columns.push({
      id: newId,
      field: '',
      label: `Column ${columns.length + 1}`,
      type: 'text',
      width: 'auto',
      align: 'left',
      sortable: true,
      filterable: true,
      visible: true
    });
    updateConfig('columns', columns);
  };

  const updateColumn = (index: number, updates: Partial<TableColumn>) => {
    const columns = [...props.value.columns];
    columns[index] = { ...columns[index], ...updates };
    updateConfig('columns', columns);
  };

  const removeColumn = (index: number) => {
    const columns = props.value.columns.filter((_, i) => i !== index);
    updateConfig('columns', columns);
  };

  const moveColumn = (index: number, direction: 'up' | 'down') => {
    const columns = [...props.value.columns];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= columns.length) return;
    [columns[index], columns[newIndex]] = [columns[newIndex], columns[index]];
    updateConfig('columns', columns);
  };

  return (
    <div class="space-y-4">
      {/* Header */}
      <div class="flex items-center gap-2">
        <Table class="w-5 h-5 text-blue-600" />
        <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Data Table Configuration</h3>
      </div>

      {/* Data Source */}
      <div>
        <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          Data Source <span class="text-red-500">*</span>
        </label>
        <input
          type="text"
          class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
          placeholder="${input.data} or ${nodes.nodeId.output.items}"
          value={props.value.dataSource}
          onInput={(e) => updateConfig('dataSource', e.currentTarget.value)}
        />
        <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Must be an array of objects
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
              Let AI automatically transform your data into table-ready format
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
              placeholder="Describe how to transform the data... e.g., 'Flatten nested objects and format dates as MM/DD/YYYY'"
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
            { id: 'columns' as const, label: 'Columns' },
            { id: 'features' as const, label: 'Features' },
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

      {/* Columns Tab */}
      <Show when={activeTab() === 'columns'}>
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <label class="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Table Columns <span class="text-red-500">*</span>
            </label>
            <button
              type="button"
              class="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              onClick={addColumn}
            >
              <Plus class="w-3 h-3" />
              Add Column
            </button>
          </div>

          <div class="space-y-3">
            <For each={props.value.columns}>
              {(column, index) => (
                <div class="p-4 border border-slate-300 dark:border-slate-600 rounded-lg space-y-3">
                  {/* Column Header */}
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <span class="text-sm font-medium text-slate-700 dark:text-slate-300">
                        Column {index() + 1}
                      </span>
                      <Show when={!column.visible}>
                        <EyeOff class="w-4 h-4 text-slate-400" />
                      </Show>
                    </div>
                    <div class="flex items-center gap-1">
                      <button
                        type="button"
                        class="p-1 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded disabled:opacity-30"
                        disabled={index() === 0}
                        onClick={() => moveColumn(index(), 'up')}
                        title="Move up"
                      >
                        <ArrowUpDown class="w-4 h-4 rotate-180" />
                      </button>
                      <button
                        type="button"
                        class="p-1 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded disabled:opacity-30"
                        disabled={index() === props.value.columns.length - 1}
                        onClick={() => moveColumn(index(), 'down')}
                        title="Move down"
                      >
                        <ArrowUpDown class="w-4 h-4" />
                      </button>
                      <Show when={props.value.columns.length > 1}>
                        <button
                          type="button"
                          class="p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                          onClick={() => removeColumn(index())}
                          title="Remove column"
                        >
                          <Trash2 class="w-4 h-4" />
                        </button>
                      </Show>
                    </div>
                  </div>

                  {/* Column Fields */}
                  <div class="grid grid-cols-2 gap-3">
                    <div>
                      <label class="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Field Name <span class="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        class="w-full px-2 py-1.5 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded text-sm"
                        placeholder="e.g., name, email"
                        value={column.field}
                        onInput={(e) => updateColumn(index(), { field: e.currentTarget.value })}
                      />
                    </div>
                    <div>
                      <label class="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Label
                      </label>
                      <input
                        type="text"
                        class="w-full px-2 py-1.5 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded text-sm"
                        placeholder="Column label"
                        value={column.label}
                        onInput={(e) => updateColumn(index(), { label: e.currentTarget.value })}
                      />
                    </div>
                  </div>

                  <div class="grid grid-cols-3 gap-3">
                    <div>
                      <label class="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Type
                      </label>
                      <select
                        class="w-full px-2 py-1.5 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded text-sm"
                        value={column.type || 'text'}
                        onChange={(e) => updateColumn(index(), { type: e.currentTarget.value as any })}
                      >
                        <option value="text">Text</option>
                        <option value="number">Number</option>
                        <option value="date">Date</option>
                        <option value="boolean">Boolean</option>
                        <option value="image">Image</option>
                        <option value="link">Link</option>
                        <option value="badge">Badge</option>
                      </select>
                    </div>
                    <div>
                      <label class="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Width
                      </label>
                      <select
                        class="w-full px-2 py-1.5 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded text-sm"
                        value={column.width === 'auto' ? 'auto' : 'custom'}
                        onChange={(e) => updateColumn(index(), { width: e.currentTarget.value === 'auto' ? 'auto' : 150 })}
                      >
                        <option value="auto">Auto</option>
                        <option value="custom">Custom</option>
                      </select>
                    </div>
                    <div>
                      <label class="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Align
                      </label>
                      <select
                        class="w-full px-2 py-1.5 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded text-sm"
                        value={column.align || 'left'}
                        onChange={(e) => updateColumn(index(), { align: e.currentTarget.value as any })}
                      >
                        <option value="left">Left</option>
                        <option value="center">Center</option>
                        <option value="right">Right</option>
                      </select>
                    </div>
                  </div>

                  {/* Column Options */}
                  <div class="flex flex-wrap gap-3">
                    <label class="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        class="w-3 h-3 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                        checked={column.sortable ?? true}
                        onChange={(e) => updateColumn(index(), { sortable: e.currentTarget.checked })}
                      />
                      Sortable
                    </label>
                    <label class="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        class="w-3 h-3 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                        checked={column.filterable ?? true}
                        onChange={(e) => updateColumn(index(), { filterable: e.currentTarget.checked })}
                      />
                      Filterable
                    </label>
                    <label class="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        class="w-3 h-3 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                        checked={column.visible ?? true}
                        onChange={(e) => updateColumn(index(), { visible: e.currentTarget.checked })}
                      />
                      Visible
                    </label>
                  </div>

                  {/* Format field for specific types */}
                  <Show when={['date', 'number'].includes(column.type || 'text')}>
                    <div>
                      <label class="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Format
                      </label>
                      <input
                        type="text"
                        class="w-full px-2 py-1.5 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded text-sm font-mono"
                        placeholder={column.type === 'date' ? 'MM/DD/YYYY' : '#,##0.00'}
                        value={column.format || ''}
                        onInput={(e) => updateColumn(index(), { format: e.currentTarget.value })}
                      />
                    </div>
                  </Show>
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>

      {/* Features Tab */}
      <Show when={activeTab() === 'features'}>
        <div class="space-y-4">
          {/* Pagination */}
          <div class="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg space-y-3">
            <div class="flex items-center gap-2">
              <input
                type="checkbox"
                id="enablePagination"
                class="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                checked={props.value.enablePagination ?? true}
                onChange={(e) => updateConfig('enablePagination', e.currentTarget.checked)}
              />
              <label for="enablePagination" class="text-sm font-medium text-slate-700 dark:text-slate-300">
                Enable Pagination
              </label>
            </div>
            <Show when={props.value.enablePagination}>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Page Size
                  </label>
                  <input
                    type="number"
                    class="w-full px-2 py-1.5 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded text-sm"
                    value={props.value.pageSize || 25}
                    onInput={(e) => updateConfig('pageSize', parseInt(e.currentTarget.value))}
                  />
                </div>
                <div>
                  <label class="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Page Size Options (comma-separated)
                  </label>
                  <input
                    type="text"
                    class="w-full px-2 py-1.5 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded text-sm"
                    placeholder="10,25,50,100"
                    value={(props.value.pageSizeOptions || []).join(',')}
                    onInput={(e) => updateConfig('pageSizeOptions', e.currentTarget.value.split(',').map(s => parseInt(s.trim())))}
                  />
                </div>
              </div>
            </Show>
          </div>

          {/* Sorting */}
          <div class="flex items-center gap-2">
            <input
              type="checkbox"
              id="enableSorting"
              class="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
              checked={props.value.enableSorting ?? true}
              onChange={(e) => updateConfig('enableSorting', e.currentTarget.checked)}
            />
            <label for="enableSorting" class="text-sm text-slate-700 dark:text-slate-300">
              Enable Sorting
            </label>
          </div>

          {/* Filtering */}
          <div class="flex items-center gap-2">
            <input
              type="checkbox"
              id="enableFiltering"
              class="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
              checked={props.value.enableFiltering ?? true}
              onChange={(e) => updateConfig('enableFiltering', e.currentTarget.checked)}
            />
            <label for="enableFiltering" class="text-sm text-slate-700 dark:text-slate-300">
              Enable Filtering
            </label>
          </div>

          {/* Selection */}
          <div class="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg space-y-3">
            <div class="flex items-center gap-2">
              <input
                type="checkbox"
                id="enableSelection"
                class="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                checked={props.value.enableSelection ?? false}
                onChange={(e) => updateConfig('enableSelection', e.currentTarget.checked)}
              />
              <label for="enableSelection" class="text-sm font-medium text-slate-700 dark:text-slate-300">
                Enable Row Selection
              </label>
            </div>
            <Show when={props.value.enableSelection}>
              <div>
                <label class="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Selection Mode
                </label>
                <select
                  class="w-full px-2 py-1.5 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded text-sm"
                  value={props.value.selectionMode || 'single'}
                  onChange={(e) => updateConfig('selectionMode', e.currentTarget.value as any)}
                >
                  <option value="single">Single</option>
                  <option value="multiple">Multiple</option>
                </select>
              </div>
            </Show>
          </div>

          {/* Export */}
          <div class="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg space-y-3">
            <div class="flex items-center gap-2">
              <input
                type="checkbox"
                id="enableExport"
                class="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                checked={props.value.enableExport ?? false}
                onChange={(e) => updateConfig('enableExport', e.currentTarget.checked)}
              />
              <label for="enableExport" class="text-sm font-medium text-slate-700 dark:text-slate-300">
                Enable Export
              </label>
            </div>
            <Show when={props.value.enableExport}>
              <div class="space-y-2">
                <label class="block text-xs font-medium text-slate-600 dark:text-slate-400">
                  Export Formats
                </label>
                <div class="flex flex-wrap gap-3">
                  <For each={['csv', 'json', 'xlsx'] as const}>
                    {(format) => (
                      <label class="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          class="w-3 h-3 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                          checked={(props.value.exportFormats || []).includes(format)}
                          onChange={(e) => {
                            const formats = props.value.exportFormats || [];
                            if (e.currentTarget.checked) {
                              updateConfig('exportFormats', [...formats, format]);
                            } else {
                              updateConfig('exportFormats', formats.filter(f => f !== format));
                            }
                          }}
                        />
                        {format.toUpperCase()}
                      </label>
                    )}
                  </For>
                </div>
              </div>
            </Show>
          </div>
        </div>
      </Show>

      {/* Appearance Tab */}
      <Show when={activeTab() === 'appearance'}>
        <div class="space-y-3">
          <div class="flex items-center gap-2">
            <input
              type="checkbox"
              id="striped"
              class="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
              checked={props.value.striped ?? true}
              onChange={(e) => updateConfig('striped', e.currentTarget.checked)}
            />
            <label for="striped" class="text-sm text-slate-700 dark:text-slate-300">
              Striped Rows
            </label>
          </div>
          <div class="flex items-center gap-2">
            <input
              type="checkbox"
              id="bordered"
              class="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
              checked={props.value.bordered ?? false}
              onChange={(e) => updateConfig('bordered', e.currentTarget.checked)}
            />
            <label for="bordered" class="text-sm text-slate-700 dark:text-slate-300">
              Bordered
            </label>
          </div>
          <div class="flex items-center gap-2">
            <input
              type="checkbox"
              id="hoverable"
              class="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
              checked={props.value.hoverable ?? true}
              onChange={(e) => updateConfig('hoverable', e.currentTarget.checked)}
            />
            <label for="hoverable" class="text-sm text-slate-700 dark:text-slate-300">
              Hover Effect
            </label>
          </div>
          <div class="flex items-center gap-2">
            <input
              type="checkbox"
              id="compact"
              class="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
              checked={props.value.compact ?? false}
              onChange={(e) => updateConfig('compact', e.currentTarget.checked)}
            />
            <label for="compact" class="text-sm text-slate-700 dark:text-slate-300">
              Compact Mode
            </label>
          </div>
          <div class="flex items-center gap-2">
            <input
              type="checkbox"
              id="stickyHeader"
              class="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
              checked={props.value.stickyHeader ?? true}
              onChange={(e) => updateConfig('stickyHeader', e.currentTarget.checked)}
            />
            <label for="stickyHeader" class="text-sm text-slate-700 dark:text-slate-300">
              Sticky Header
            </label>
          </div>
        </div>
      </Show>

      {/* Help Text */}
      <div class="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md">
        <p class="text-xs text-blue-600 dark:text-blue-400">
          <strong>Tip:</strong> Tables automatically render at workflow execution completion.
          Enable AI reshaping to handle complex nested data structures, API responses, or data transformations.
        </p>
      </div>
    </div>
  );
}
