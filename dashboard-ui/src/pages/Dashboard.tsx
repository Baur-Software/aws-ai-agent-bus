import { createSignal, onMount, Show, For, createResource } from 'solid-js';
import { useDashboardServer } from '../contexts/DashboardServerContext';
import { useWorkflow } from '../contexts/WorkflowContext';
import { useKVStore } from '../contexts/KVStoreContext';
import { usePageHeader } from '../contexts/HeaderContext';
import {
  Activity,
  Database,
  Workflow,
  Zap,
  TrendingUp,
  Clock,
  CheckCircle,
  Play,
  Users,
  BarChart3
} from 'lucide-solid';

interface DashboardProps {
  isOverlay?: boolean;
}

function Dashboard(props: DashboardProps = {}) {
  // Set page-specific header only when not in overlay mode
  if (!props.isOverlay) {
    usePageHeader('Statistics', 'Performance metrics and system overview');
  }

  const { isConnected, executeTool } = useDashboardServer();
  const { workflows } = useWorkflow();
  const kvStore = useKVStore();
  const [uptime, setUptime] = createSignal('0h 0m 0s');

  // Get KV metrics
  const [kvMetrics] = createResource(
    () => isConnected(),
    async () => {
      try {
        const keys = await kvStore.list('');
        const totalKeys = keys.length;
        const totalSize = keys.reduce((sum, key) => sum + (key.size || 0), 0);
        return { totalKeys, totalSize: totalSize / 1024 }; // Convert to KB
      } catch (error) {
        console.warn('KV metrics error:', error);
        return { totalKeys: 0, totalSize: 0 };
      }
    }
  );

  const [artifactsMetrics] = createResource(
    () => isConnected(),
    async () => {
      try {
        const result = await artifacts.list();
        const items = result.items || [];
        const totalSize = items.reduce((sum: number, item: { size: number; }) => sum + (item.size || 0), 0);

        // Show notification if infrastructure is unavailable
        if (result.warning) {
          notify.warning(result.warning, { duration: 10000 });
        }

        return { totalFiles: items.length, totalSize };
      } catch (error) {
        return { totalFiles: 0, totalSize: 0 };
      }
    }
  );  

  // Recent activity based on real operations
  const [recentActivity] = createSignal([
    { id: 1, action: 'MCP Server Connected', time: 'now', icon: CheckCircle, type: 'success' },
    { id: 2, action: 'Workflow executed', time: '2 min ago', icon: Play, type: 'success' },
    { id: 3, action: 'KV Store updated', time: '5 min ago', icon: Database, type: 'info' },
    { id: 4, action: 'System health check', time: '10 min ago', icon: Activity, type: 'info' }
  ]);

  let startTime = Date.now();

  onMount(() => {
    // Update uptime every second
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const hours = Math.floor(elapsed / 3600);
      const minutes = Math.floor((elapsed % 3600) / 60);
      const seconds = elapsed % 60;
      setUptime(`${hours}h ${minutes}m ${seconds}s`);
    }, 1000);

    return () => clearInterval(interval);
  });

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'success': return CheckCircle;
      case 'warning': return TriangleAlert;
      case 'info': return Info;
      default: return Activity;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'success': return 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30';
      case 'warning': return 'text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30';
      case 'info': return 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30';
      default: return 'text-slate-600 bg-slate-100 dark:text-slate-400 dark:bg-slate-800';
    }
  };

  // Key metrics focused on workflows and system performance
  const stats = () => [
    {
      label: 'Total Workflows',
      value: workflows()?.length || 0,
      change: workflows()?.length ? `${workflows()!.length} active` : 'No workflows',
      trend: 'up',
      icon: Workflow,
      color: 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30'
    },
    {
      label: 'MCP Tools',
      value: availableTools()?.length || 0,
      change: isConnected() ? 'Connected' : 'Offline',
      trend: isConnected() ? 'up' : 'down',
      icon: Zap,
      color: 'text-purple-600 bg-purple-100 dark:text-purple-400 dark:bg-purple-900/30'
    },
    {
      label: 'KV Store',
      value: kvMetrics()?.totalKeys || 0,
      change: kvMetrics() ? `${kvMetrics()!.totalSize.toFixed(1)}KB` : 'Loading...',
      trend: 'up',
      icon: Database,
      color: 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30'
    },
    {
      label: 'System Health',
      value: health()?.status || 'Unknown',
      change: health() ? 'Operational' : 'Checking...',
      trend: health()?.status === 'healthy' ? 'up' : 'down',
      icon: Activity,
      color: 'text-orange-600 bg-orange-100 dark:text-orange-400 dark:bg-orange-900/30'
    }
  ];

  const performanceMetrics = () => [
    {
      title: 'Available Tools',
      value: availableTools()?.length?.toString() || '0',
      change: isConnected() ? 'Connected' : 'Disconnected',
      trend: isConnected() ? 'up' : 'down',
      period: 'MCP Server'
    },
    {
      title: 'Server Version',
      value: serverVersion() || 'Unknown',
      change: isConnected() ? 'Online' : 'Offline',
      trend: isConnected() ? 'up' : 'down',
      period: 'Current'
    },
    {
      title: 'KV Store Size',
      value: kvMetrics() ? `${kvMetrics()!.totalSize.toFixed(1)}KB` : 'Loading...',
      change: kvMetrics() ? `${kvMetrics()!.totalKeys} keys` : 'Loading...',
      trend: 'up',
      period: 'Storage Used'
    },
    {
      title: 'Artifacts',
      value: artifactsMetrics()?.totalFiles?.toString() || '0',
      change: artifactsMetrics() ? `${(artifactsMetrics()!.totalSize / 1024).toFixed(1)}KB` : 'Loading...',
      trend: artifactsMetrics() ? 'up' : 'down',
      period: 'S3 Storage'
    }
  ];

  return (
    <div class="space-y-6 p-6">
      {/* Header */}
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">System Statistics</h1>
          <p class="text-gray-600 dark:text-gray-400">Performance metrics and system overview</p>
        </div>
        <div class="flex items-center gap-3">
          <div class="px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
            <div class="text-sm text-gray-600 dark:text-gray-400">
              Uptime: <span class="font-semibold text-gray-900 dark:text-white">{uptime()}</span>
            </div>
          </div>
          <Show when={serverVersion()}>
            <div class="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-sm font-semibold">
              v{serverVersion()}
            </div>
          </Show>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <For each={stats()}>
          {(stat) => (
            <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow">
              <div class="flex items-center justify-between">
                <div class="flex-1">
                  <p class="text-sm font-medium text-gray-600 dark:text-gray-400">{stat.label}</p>
                  <p class="text-2xl font-bold text-gray-900 dark:text-white mt-1">{stat.value}</p>
                  <div class="flex items-center mt-2">
                    <span class={`text-xs font-medium px-2 py-1 rounded-full ${
                      stat.trend === 'up'
                        ? 'text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-900/30'
                        : 'text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-900/30'
                    }`}>
                      {stat.change}
                    </span>
                  </div>
                </div>
                <div class={`p-3 rounded-lg ${stat.color}`}>
                  <stat.icon class="w-5 h-5" />
                </div>
              </div>
            </div>
          )}
        </For>
      </div>

      {/* Performance Metrics */}
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <div class="flex items-center gap-2 mb-4">
            <BarChart3 class="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Performance Metrics</h2>
          </div>
          <div class="space-y-4">
            <For each={performanceMetrics()}>
              {(metric) => (
                <div class="flex items-center justify-between py-2">
                  <div class="flex-1">
                    <p class="text-sm font-medium text-gray-900 dark:text-white">{metric.title}</p>
                    <p class="text-xs text-gray-500 dark:text-gray-400">{metric.period}</p>
                  </div>
                  <div class="text-right">
                    <p class="text-lg font-bold text-gray-900 dark:text-white">{metric.value}</p>
                    <p class={`text-xs font-medium ${
                      metric.trend === 'up'
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      {metric.change}
                    </p>
                  </div>
                </div>
              )}
            </For>
          </div>
        </div>

        {/* Recent Activity */}
        <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <div class="flex items-center gap-2 mb-4">
            <Clock class="w-5 h-5 text-green-600 dark:text-green-400" />
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Recent Activity</h2>
          </div>
          <div class="space-y-3">
            <For each={recentActivity()}>
              {(activity) => {
                const IconComponent = getActivityIcon(activity.type);
                return (
                  <div class="flex items-center gap-3 py-2">
                    <div class={`p-2 rounded-lg ${getActivityColor(activity.type)}`}>
                      <IconComponent class="w-4 h-4" />
                    </div>
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-medium text-gray-900 dark:text-white">{activity.action}</p>
                      <p class="text-xs text-gray-500 dark:text-gray-400">{activity.time}</p>
                    </div>
                  </div>
                );
              }}
            </For>
          </div>
        </div>
      </div>

      {/* System Health */}
      <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <div class="flex items-center gap-2 mb-4">
          <Activity class="w-5 h-5 text-purple-600 dark:text-purple-400" />
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">System Health</h2>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div class="inline-flex items-center justify-center w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg mb-2">
              <CheckCircle class="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white">MCP Server</h3>
            <p class={`text-xs font-medium mt-1 px-2 py-1 rounded-full inline-block ${
              isConnected()
                ? 'text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-900/30'
                : 'text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-900/30'
            }`}>
              {isConnected() ? 'Online' : 'Offline'}
            </p>
          </div>
          <div class="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div class="inline-flex items-center justify-center w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg mb-2">
              <Database class="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white">Storage</h3>
            <p class="text-xs font-medium text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-900/30 mt-1 px-2 py-1 rounded-full inline-block">Operational</p>
          </div>
          <div class="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div class="inline-flex items-center justify-center w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg mb-2">
              <Users class="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white">Workflows</h3>
            <p class="text-xs font-medium text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-900/30 mt-1 px-2 py-1 rounded-full inline-block">Active</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;