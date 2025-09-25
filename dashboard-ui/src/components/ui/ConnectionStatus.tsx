import { Show } from 'solid-js';
import { Wifi, WifiOff, RefreshCw } from 'lucide-solid';
import { useDashboardServer } from '../../contexts/DashboardServerContext';

interface ConnectionStatusProps {
  showLabel?: boolean;
  compact?: boolean;
  className?: string;
  variant?: 'default' | 'detailed' | 'styled'; // 'detailed' shows more styling, 'styled' adds colored container
  showVersion?: boolean;
  animate?: boolean;
  showIcon?: boolean; // Show WiFi/WifiOff icon
  showRefresh?: boolean; // Show refresh button
  onRefresh?: () => void; // Refresh callback
  isRefreshing?: boolean; // Loading state for refresh
}

export default function ConnectionStatus(props: ConnectionStatusProps = {}) {
  const { isConnected } = useDashboardServer();

  // For debugging - use just WebSocket connection for now
  const wsConnected = () => isConnected();

  const showLabel = props.showLabel ?? true;
  const compact = props.compact ?? false;
  const variant = props.variant ?? 'default';
  const showVersion = props.showVersion ?? false;
  const animate = props.animate ?? false;
  const showIcon = props.showIcon ?? false;
  const showRefresh = props.showRefresh ?? false;
  const isRefreshing = props.isRefreshing ?? false;

  if (variant === 'detailed' || variant === 'styled') {
    const containerClass = variant === 'styled'
      ? `flex items-center gap-3 p-3 rounded-lg transition-colors ${
          isConnected()
            ? 'bg-green-50 border border-green-200 dark:bg-green-900/20 dark:border-green-800'
            : 'bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800'
        } ${props.className || ''}`
      : `flex items-center gap-3 ${props.className || ''}`;

    return (
      <div class={containerClass}>
        <div class="flex items-center gap-2">
          <Show when={showIcon}>
            {wsConnected() ? (
              <Wifi class={`w-4 h-4 ${wsConnected() ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`} />
            ) : (
              <WifiOff class={`w-4 h-4 ${wsConnected() ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`} />
            )}
          </Show>
          <div class={`w-2 h-2 rounded-full ${
            wsConnected() ? 'bg-green-500' : 'bg-red-500'
          } ${animate && wsConnected() ? 'animate-pulse' : ''}`} />
        </div>
        <div class="flex-1 min-w-0">
          <Show when={showLabel}>
            <div class={`text-sm font-medium ${
              wsConnected()
                ? 'text-green-900 dark:text-green-100'
                : 'text-red-900 dark:text-red-100'
            }`}>
              {wsConnected() ? 'Connected' : 'Disconnected'}
            </div>
          </Show>
          <Show when={showVersion && serverVersion()}>
            <div class={`text-xs ${
              wsConnected()
                ? 'text-green-700 dark:text-green-300'
                : 'text-red-700 dark:text-red-300'
            }`}>
              v{serverVersion()}
            </div>
          </Show>
          <Show when={!wsConnected()}>
            <div class="text-xs text-red-700 dark:text-red-300">
              Check server status
            </div>
          </Show>
        </div>
        <Show when={showRefresh}>
          <button
            onClick={props.onRefresh}
            class={`p-1.5 rounded-md transition-colors hover:bg-slate-100 dark:hover:bg-slate-700 ${
              isRefreshing ? 'animate-spin' : ''
            }`}
            title="Refresh connection status"
          >
            <RefreshCw class="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
          </button>
        </Show>
      </div>
    );
  }

  return (
    <div class={`flex items-center text-xs text-gray-500 dark:text-gray-400 ${
      compact ? 'justify-center' : 'gap-2'
    } ${props.className || ''}`}>
      <div class={`rounded-full ${
        wsConnected()
          ? 'bg-green-500 dark:bg-green-400'
          : 'bg-red-500 dark:bg-red-400'
      } w-2 h-2 ${animate && wsConnected() ? 'animate-pulse' : ''}`}></div>
      <Show when={showLabel}>
        <span>{wsConnected() ? 'Connected' : 'Disconnected'}</span>
      </Show>
    </div>
  );
}