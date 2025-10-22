/**
 * Data Visualization Node Definitions
 *
 * Note: These nodes have dedicated config components in @ai-agent-bus/datavis-nodes
 */

import type { NodeDefinition } from '../NodeRegistry';

export const VISUALIZATION_NODES: NodeDefinition[] = [
  {
    type: 'chart-bar',
    name: 'Bar Chart',
    description: 'Display data as vertical or horizontal bars',
    category: 'datavis',
    subcategory: 'chart',
    icon: '📊',
    color: 'bg-blue-500',
    hasDedicatedComponent: true,
    componentName: 'ChartNodeConfig',
    sampleOutput: {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
      datasets: [{
        label: 'Sales',
        data: [12000, 19000, 15000, 22000, 18000],
        backgroundColor: '#3b82f6'
      }],
      chartType: 'bar'
    }
  },
  {
    type: 'chart-line',
    name: 'Line Chart',
    description: 'Display trends and time series data',
    category: 'datavis',
    subcategory: 'chart',
    icon: '📈',
    color: 'bg-green-500',
    hasDedicatedComponent: true,
    componentName: 'ChartNodeConfig',
    sampleOutput: {
      labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
      datasets: [{
        label: 'Active Users',
        data: [1200, 1900, 1500, 2200],
        borderColor: '#10b981',
        fill: false
      }],
      chartType: 'line'
    }
  },
  {
    type: 'chart-pie',
    name: 'Pie Chart',
    description: 'Show proportional data distribution',
    category: 'datavis',
    subcategory: 'chart',
    icon: '🥧',
    color: 'bg-purple-500',
    hasDedicatedComponent: true,
    componentName: 'ChartNodeConfig',
    sampleOutput: {
      labels: ['Direct', 'Organic', 'Referral', 'Social'],
      datasets: [{
        label: 'Traffic Sources',
        data: [45, 30, 15, 10],
        backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6']
      }],
      chartType: 'pie'
    }
  },
  {
    type: 'chart-area',
    name: 'Area Chart',
    description: 'Display cumulative data with filled areas',
    category: 'datavis',
    subcategory: 'chart',
    icon: '📉',
    color: 'bg-cyan-500',
    hasDedicatedComponent: true,
    componentName: 'ChartNodeConfig',
    sampleOutput: {
      labels: ['Q1', 'Q2', 'Q3', 'Q4'],
      datasets: [{
        label: 'Revenue',
        data: [50000, 75000, 90000, 110000],
        backgroundColor: 'rgba(6, 182, 212, 0.3)',
        borderColor: '#06b6d4',
        fill: true
      }],
      chartType: 'area'
    }
  },
  {
    type: 'chart-scatter',
    name: 'Scatter Chart',
    description: 'Visualize correlations and distributions',
    category: 'datavis',
    subcategory: 'chart',
    icon: '⚡',
    color: 'bg-orange-500',
    hasDedicatedComponent: true,
    componentName: 'ChartNodeConfig',
    sampleOutput: {
      datasets: [{
        label: 'Dataset 1',
        data: [
          { x: 10, y: 20 },
          { x: 15, y: 30 },
          { x: 20, y: 25 },
          { x: 25, y: 40 }
        ],
        backgroundColor: '#f97316'
      }],
      chartType: 'scatter'
    }
  },
  {
    type: 'table',
    name: 'Data Table',
    description: 'Display data in sortable, filterable table',
    category: 'datavis',
    subcategory: 'table',
    icon: '📋',
    color: 'bg-indigo-500',
    hasDedicatedComponent: true,
    componentName: 'TableNodeConfig',
    sampleOutput: {
      columns: [
        { field: 'id', label: 'ID', type: 'number' },
        { field: 'name', label: 'Name', type: 'text' },
        { field: 'email', label: 'Email', type: 'text' },
        { field: 'status', label: 'Status', type: 'badge' },
        { field: 'created', label: 'Created', type: 'date' }
      ],
      data: [
        { id: 1, name: 'Alice Johnson', email: 'alice@example.com', status: 'active', created: '2024-01-15' },
        { id: 2, name: 'Bob Smith', email: 'bob@example.com', status: 'active', created: '2024-02-20' },
        { id: 3, name: 'Carol White', email: 'carol@example.com', status: 'inactive', created: '2024-03-10' }
      ],
      totalRows: 3
    }
  },
  {
    type: 'metrics',
    name: 'Metrics Dashboard',
    description: 'Display KPIs with trends and comparisons',
    category: 'datavis',
    subcategory: 'metric',
    icon: '📊',
    color: 'bg-emerald-500',
    hasDedicatedComponent: true,
    componentName: 'MetricsNodeConfig',
    sampleOutput: {
      metrics: [
        {
          label: 'Total Revenue',
          value: 125000,
          format: 'currency',
          trend: '+12.5%',
          trendDirection: 'up',
          comparison: 'vs last month'
        },
        {
          label: 'Active Users',
          value: 1842,
          format: 'number',
          trend: '+8.3%',
          trendDirection: 'up',
          comparison: 'vs last week'
        },
        {
          label: 'Conversion Rate',
          value: 3.45,
          format: 'percentage',
          trend: '-2.1%',
          trendDirection: 'down',
          comparison: 'vs last month'
        }
      ]
    }
  }
];
