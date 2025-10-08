import { Show } from 'solid-js';
import type { ChartConfig } from './ChartNodeConfig';

interface ChartRendererProps {
  config: ChartConfig;
  data?: any;
}

/**
 * ChartRenderer - Displays a chart visualization based on config and data
 *
 * This is a placeholder renderer that will be replaced with a proper
 * charting library (like Chart.js, Recharts, or Apache ECharts) in production.
 */
export function ChartRenderer(props: ChartRendererProps) {
  const hasData = () => props.data && (Array.isArray(props.data) ? props.data.length > 0 : true);

  return (
    <div class="w-full h-full flex items-center justify-center bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
      <Show
        when={hasData()}
        fallback={
          <div class="text-center p-8">
            <div class="text-slate-400 dark:text-slate-500 text-sm">
              <svg class="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <p class="font-medium">No data to display</p>
              <p class="text-xs mt-1">Connect a data source or run the workflow</p>
            </div>
          </div>
        }
      >
        <div class="p-6 w-full">
          <Show when={props.config.title}>
            <h3 class="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              {props.config.title}
            </h3>
          </Show>

          {/* Placeholder chart visualization */}
          <div class="bg-white dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
            <div class="text-center text-slate-600 dark:text-slate-400">
              <svg class="w-12 h-12 mx-auto mb-3 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <Show when={props.config.type === 'bar'}>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </Show>
                <Show when={props.config.type === 'line'}>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                </Show>
                <Show when={props.config.type === 'pie'}>
                  <circle cx="12" cy="12" r="10" stroke-width="2" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 2v10l7 7" />
                </Show>
              </svg>
              <p class="text-sm font-medium">
                {props.config.type.charAt(0).toUpperCase() + props.config.type.slice(1)} Chart Preview
              </p>
              <p class="text-xs mt-1 text-slate-500 dark:text-slate-500">
                Data Source: {props.config.dataSourceType}
              </p>

              {/* Show data structure */}
              <Show when={props.data}>
                <div class="mt-4 text-left">
                  <details class="text-xs">
                    <summary class="cursor-pointer font-medium text-slate-700 dark:text-slate-300 hover:text-blue-600">
                      View Data ({Array.isArray(props.data) ? props.data.length : 'object'} {Array.isArray(props.data) && props.data.length === 1 ? 'item' : 'items'})
                    </summary>
                    <pre class="mt-2 p-2 bg-slate-100 dark:bg-slate-900 rounded text-xs overflow-auto max-h-48">
                      {JSON.stringify(props.data, null, 2)}
                    </pre>
                  </details>
                </div>
              </Show>

              <div class="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded text-xs text-left">
                <p class="font-medium text-blue-900 dark:text-blue-200">📊 Chart Integration Pending</p>
                <p class="text-blue-700 dark:text-blue-300 mt-1">
                  Full chart rendering with Chart.js/ECharts will be implemented next.
                  Configuration is ready: {props.config.datasets?.length || 0} dataset(s) configured.
                </p>
              </div>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}
