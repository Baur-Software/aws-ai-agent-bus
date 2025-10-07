/**
 * Data Visualization Nodes Module
 *
 * This module provides dedicated components for data visualization node configuration.
 * Each visualization type has its own component with rich configuration panels inspired
 * by n8n and Zapier's data transformation UIs.
 *
 * Features:
 * - AI-powered data reshaping with specialized agent
 * - Rich configuration panels for all chart types
 * - Live preview of visualization configuration
 * - Multiple chart libraries support (Chart.js, D3, Plotly)
 */

// Chart Nodes
export { ChartNodeConfig, DEFAULT_CHART_CONFIG } from './ChartNodeConfig';
export type { ChartConfig, ChartType, ChartDataset, ChartAxis } from './ChartNodeConfig';

// Table Nodes
export { TableNodeConfig, DEFAULT_TABLE_CONFIG } from './TableNodeConfig';
export type { TableConfig, TableColumn, TableSortConfig, TableFilterConfig } from './TableNodeConfig';

// Metrics/KPI Nodes
export { MetricsNodeConfig, DEFAULT_METRICS_CONFIG } from './MetricsNodeConfig';
export type { MetricsConfig, MetricCard, MetricTrend } from './MetricsNodeConfig';

/**
 * Data Visualization Node Type Registry
 * Maps visualization node types to their dedicated configuration components
 */
export const DATAVIS_NODE_REGISTRY = {
  // Chart visualizations
  'chart-bar': {
    component: 'ChartNodeConfig',
    defaultConfig: 'DEFAULT_CHART_CONFIG',
    chartType: 'bar'
  },
  'chart-line': {
    component: 'ChartNodeConfig',
    defaultConfig: 'DEFAULT_CHART_CONFIG',
    chartType: 'line'
  },
  'chart-pie': {
    component: 'ChartNodeConfig',
    defaultConfig: 'DEFAULT_CHART_CONFIG',
    chartType: 'pie'
  },
  'chart-area': {
    component: 'ChartNodeConfig',
    defaultConfig: 'DEFAULT_CHART_CONFIG',
    chartType: 'area'
  },
  'chart-scatter': {
    component: 'ChartNodeConfig',
    defaultConfig: 'DEFAULT_CHART_CONFIG',
    chartType: 'scatter'
  },

  // Table visualization
  'table': {
    component: 'TableNodeConfig',
    defaultConfig: 'DEFAULT_TABLE_CONFIG'
  },

  // Metrics/KPI visualization
  'metrics': {
    component: 'MetricsNodeConfig',
    defaultConfig: 'DEFAULT_METRICS_CONFIG'
  }
} as const;

/**
 * Check if a node type is a data visualization node
 */
export function isDataVisNode(nodeType: string): boolean {
  return nodeType in DATAVIS_NODE_REGISTRY;
}

/**
 * Get the default configuration for a datavis node type
 */
export function getDataVisDefaultConfig(nodeType: string): any {
  const entry = DATAVIS_NODE_REGISTRY[nodeType as keyof typeof DATAVIS_NODE_REGISTRY];
  if (!entry) return null;

  // Import and return default config with chart type if applicable
  switch (nodeType) {
    case 'chart-bar':
    case 'chart-line':
    case 'chart-pie':
    case 'chart-area':
    case 'chart-scatter':
      return { ...DEFAULT_CHART_CONFIG, type: entry.chartType };

    case 'table':
      return DEFAULT_TABLE_CONFIG;

    case 'metrics':
      return DEFAULT_METRICS_CONFIG;

    default:
      return null;
  }
}
