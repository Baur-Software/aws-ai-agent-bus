# Data Visualization Nodes Library

**Location:** `dashboard-ui/lib/datavis-nodes`

This library provides dedicated components for data visualization node configuration, with AI-powered data reshaping capabilities inspired by n8n and Zapier. Each visualization type has rich configuration panels for creating sophisticated, interactive data displays.

## Architecture Benefits

- **AI-Powered Reshaping**: Specialized agent automatically transforms complex data into visualization-ready formats
- **Rich Configuration Panels**: Comprehensive UIs for every visualization aspect
- **Type Safety**: Dedicated TypeScript interfaces for each visualization type
- **Live Preview**: Real-time visualization configuration feedback
- **Multiple Libraries**: Support for Chart.js, D3, Plotly
- **Modularity**: Can be extracted as external package (`@ai-agent-bus/datavis-nodes`)

## Usage

```typescript
import {
  // Chart Nodes
  ChartNodeConfig,
  DEFAULT_CHART_CONFIG,

  // Table Nodes
  TableNodeConfig,
  DEFAULT_TABLE_CONFIG,

  // Metrics Nodes
  MetricsNodeConfig,
  DEFAULT_METRICS_CONFIG,

  // Utils
  isDataVisNode,
  getDataVisDefaultConfig,

  // Types
  type ChartConfig,
  type TableConfig,
  type MetricsConfig
} from '../../lib/datavis-nodes';

// Check if node is a datavis node
if (isDataVisNode(nodeType)) {
  // Render dedicated datavis component
}
```

## Visualization Components

### 1. Chart Visualizations

#### ChartNodeConfig
Comprehensive chart configuration supporting multiple chart types with AI-powered data reshaping.

**Supported Chart Types:**
- **Bar Chart** - Vertical/horizontal bars for categorical comparisons
- **Line Chart** - Time series and trend visualization
- **Pie Chart** - Proportional data display
- **Area Chart** - Filled line charts for cumulative data
- **Scatter Chart** - Correlation and distribution analysis

**Config Interface:**
```typescript
interface ChartConfig {
  type: ChartType;
  title?: string;
  description?: string;

  // Data mapping
  dataSource: string;
  xAxis: ChartAxis;
  yAxis?: ChartAxis;
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
  stacked?: boolean;
  smooth?: boolean;
  responsive?: boolean;
}
```

**Features:**
- 📊 5 chart types with dedicated rendering
- 🎨 Custom color schemes per dataset
- 📈 Multiple datasets for comparison
- 🤖 AI-powered data transformation
- 🔍 Zoom and pan capabilities
- 📱 Responsive sizing
- 🎯 Interactive click events

**Example Usage:**
```typescript
<ChartNodeConfig
  value={chartConfig}
  onChange={(newConfig) => updateNodeConfig(newConfig)}
/>
```

### 2. Table Visualization

#### TableNodeConfig
Advanced data grid with sorting, filtering, pagination, and export capabilities.

**Config Interface:**
```typescript
interface TableConfig {
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

  // Sorting & Filtering
  enableSorting?: boolean;
  enableFiltering?: boolean;

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
}
```

**Column Types:**
- `text` - Plain text display
- `number` - Numeric values with formatting
- `date` - Date/time with custom formats
- `boolean` - Checkbox or badge display
- `image` - Image thumbnails
- `link` - Clickable hyperlinks
- `badge` - Colored status badges

**Features:**
- 📋 7 column types with custom formatting
- 🔄 Column reordering with drag handles
- 🔍 Per-column filtering
- ↕️ Multi-column sorting
- 📄 Pagination with customizable page sizes
- ☑️ Row selection (single/multiple)
- 📤 Export to CSV, JSON, XLSX
- 👁️ Show/hide columns
- 🎨 Multiple table styles (striped, bordered, etc.)

**Example Usage:**
```typescript
<TableNodeConfig
  value={tableConfig}
  onChange={(newConfig) => updateNodeConfig(newConfig)}
/>
```

### 3. Metrics/KPI Dashboard

#### MetricsNodeConfig
KPI cards with trends, comparisons, and real-time updates.

**Config Interface:**
```typescript
interface MetricsConfig {
  // Data
  dataSource: string;
  metrics: MetricCard[];

  // AI reshaping
  useAIReshaping?: boolean;
  reshapingPrompt?: string;

  // Layout
  layout?: 'grid' | 'row' | 'column';
  columns?: number;
  gap?: number;

  // Appearance
  showIcons?: boolean;
  showTrends?: boolean;
  cardStyle?: 'default' | 'bordered' | 'elevated' | 'minimal';

  // Refresh
  autoRefresh?: boolean;
  refreshInterval?: number;
}

interface MetricCard {
  id: string;
  label: string;
  valueField: string;
  format?: 'number' | 'currency' | 'percentage' | 'duration';
  prefix?: string;
  suffix?: string;
  decimals?: number;

  // Trend
  showTrend?: boolean;
  trendField?: string;
  trendFormat?: 'percentage' | 'absolute';
  comparisonLabel?: string;

  // Appearance
  color?: string;
  size?: 'small' | 'medium' | 'large';
}
```

**Features:**
- 📊 Multiple metric cards in customizable layouts
- 📈 Trend indicators (up/down/neutral)
- 💰 Format options (currency, percentage, duration, number)
- 🔄 Auto-refresh capabilities
- 🎨 4 card styles with custom colors
- 📏 3 size options per card
- 🔢 Configurable decimal precision
- 💡 Comparison labels ("vs last month", etc.)

**Example Usage:**
```typescript
<MetricsNodeConfig
  value={metricsConfig}
  onChange={(newConfig) => updateNodeConfig(newConfig)}
/>
```

## AI Data Reshaping

All visualization nodes include AI-powered data reshaping capabilities through the specialized `datavis-reshaper` agent.

### How It Works

1. **User enables AI reshaping** in node configuration
2. **User provides natural language instructions** describing the transformation
3. **Agent analyzes input data structure** from previous workflow nodes
4. **Agent applies transformations** (aggregate, pivot, format, compute)
5. **Visualization receives perfectly formatted data**

### Example Transformations

**Chart Reshaping:**
```
Instruction: "Group by month and sum the revenue field"

Input: [
  { date: "2024-01-15", revenue: 100 },
  { date: "2024-01-20", revenue: 150 },
  { date: "2024-02-10", revenue: 200 }
]

Output: {
  labels: ["Jan 2024", "Feb 2024"],
  datasets: [{ label: "Revenue", data: [250, 200] }]
}
```

**Table Reshaping:**
```
Instruction: "Flatten nested objects and format dates as MM/DD/YYYY"

Input: [{
  user: { name: "Alice", email: "alice@example.com" },
  createdAt: "2024-01-15T10:00:00Z"
}]

Output: [{
  "user.name": "Alice",
  "user.email": "alice@example.com",
  "createdAt": "01/15/2024"
}]
```

**Metrics Reshaping:**
```
Instruction: "Calculate total revenue, count active users, and compute conversion rate"

Input: [
  { userId: "1", revenue: 50, converted: true },
  { userId: "2", revenue: 75, converted: false },
  { userId: "1", revenue: 25, converted: true }
]

Output: {
  totalRevenue: 150,
  activeUsers: 2,
  conversionRate: "66.67%"
}
```

### AI Reshaping Panel

All visualization configs include the AI reshaping toggle:

```typescript
// In configuration panel
<div class="ai-reshaping-panel">
  <input type="checkbox" onChange={enableAIReshaping} />
  <label>Use AI Data Reshaping</label>

  {showAIPanel && (
    <textarea
      placeholder="Describe how to transform the data..."
      value={reshapingPrompt}
      onChange={updatePrompt}
    />
  )}
</div>
```

## Node Type Registry

```typescript
export const DATAVIS_NODE_REGISTRY = {
  'chart-bar': { component: 'ChartNodeConfig', chartType: 'bar' },
  'chart-line': { component: 'ChartNodeConfig', chartType: 'line' },
  'chart-pie': { component: 'ChartNodeConfig', chartType: 'pie' },
  'chart-area': { component: 'ChartNodeConfig', chartType: 'area' },
  'chart-scatter': { component: 'ChartNodeConfig', chartType: 'scatter' },
  'table': { component: 'TableNodeConfig' },
  'metrics': { component: 'MetricsNodeConfig' }
};
```

## Integration with Workflow System

### 1. Add to Node Definitions

```typescript
// dashboard-ui/src/data/nodeDefinitions.ts
{
  type: 'chart-bar',
  name: 'Bar Chart',
  category: 'visualization',
  description: 'Display data as vertical or horizontal bars',
  icon: 'BarChart3',
  configFields: [] // Handled by ChartNodeConfig component
}
```

### 2. Use in WorkflowNodeDetails

```typescript
import { isDataVisNode, /* ... */ } from '../../lib/datavis-nodes';

if (isDataVisNode(selectedNode.type)) {
  // Render appropriate datavis component
  switch (selectedNode.type) {
    case 'chart-bar':
    case 'chart-line':
    case 'chart-pie':
    case 'chart-area':
    case 'chart-scatter':
      return <ChartNodeConfig value={config} onChange={updateConfig} />;

    case 'table':
      return <TableNodeConfig value={config} onChange={updateConfig} />;

    case 'metrics':
      return <MetricsNodeConfig value={config} onChange={updateConfig} />;
  }
}
```

### 3. Runtime Execution

During workflow execution:

1. **Data flows from previous node** → `${input.data}`
2. **AI reshaping (if enabled)** → Agent transforms data
3. **Visualization renders** → Chart/Table/Metrics displays
4. **User interactions** → Click events, selections, filters
5. **Output events** → Pass data to next workflow node

## Styling and Themes

All visualization components support dark mode and respect the dashboard theme:

```typescript
// Tailwind classes used throughout
class="bg-white dark:bg-slate-700"
class="text-slate-900 dark:text-white"
class="border-slate-300 dark:border-slate-600"
```

## Performance Considerations

- **Large Datasets**: Tables automatically paginate
- **Chart Rendering**: Debounced updates on config changes
- **AI Reshaping**: Cached transformations for identical inputs
- **Lazy Loading**: Components load only when node is selected
- **Virtual Scrolling**: Tables with 1000+ rows use virtual rendering

## Adding New Visualization Nodes

1. **Create component file**: `YourVisNodeConfig.tsx`
2. **Export interfaces and defaults**
3. **Add to `index.ts` exports**
4. **Update `DATAVIS_NODE_REGISTRY`**
5. **Add to node definitions**
6. **Update WorkflowNodeDetails conditional rendering**

Example structure:

```typescript
// YourVisNodeConfig.tsx
export interface YourVisConfig {
  dataSource: string;
  useAIReshaping?: boolean;
  // ... specific config
}

export const DEFAULT_YOUR_VIS_CONFIG: YourVisConfig = {
  dataSource: '${input.data}',
  useAIReshaping: false
};

export function YourVisNodeConfig(props: {
  value: YourVisConfig;
  onChange: (value: YourVisConfig) => void;
}) {
  // ... component implementation
}
```

## External Dependency Pattern

This module is designed to be extractable as an external package:

```typescript
// Could be published as: @ai-agent-bus/datavis-nodes
import { ChartNodeConfig, TableNodeConfig } from '@ai-agent-bus/datavis-nodes';
```

## Future Enhancements

- **Heatmap visualization** - 2D data density display
- **Gauge charts** - Single value with min/max ranges
- **Sankey diagrams** - Flow visualization
- **Network graphs** - Node-edge relationship visualization
- **Geo maps** - Location-based data visualization
- **Real-time streaming** - Live data updates
- **Custom D3 visualizations** - Code-based custom charts
- **Embedded dashboards** - Share/export visualization panels

## Related Documentation

- **Workflow Nodes**: [../workflow-nodes/README.md](../workflow-nodes/README.md)
- **Data Reshaping Agent**: [../../.claude/agents/datavis-reshaper.md](../../.claude/agents/datavis-reshaper.md)
- **Integration System**: See CLAUDE.md for credential management

## Examples

See the git history for these example workflows:
- Sales Dashboard (chart + metrics)
- User Analytics Table (table + filters + export)
- Real-time KPI Monitor (metrics + auto-refresh)
