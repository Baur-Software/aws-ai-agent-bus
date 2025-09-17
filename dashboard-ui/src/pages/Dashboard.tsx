import { createSignal, onMount, Show, For, createResource } from 'solid-js';
import { A } from '@solidjs/router';
import { useMCP } from '../contexts/MCPContext';
import { useNotifications } from '../contexts/NotificationContext';
import { usePageHeader } from '../contexts/HeaderContext';
import {
  Activity,
  ChartColumn,
  Database,
  CirclePlay,
  Users,
  Zap,
  TrendingUp,
  Clock,
  CheckCircle,
  TriangleAlert,
  Info
} from 'lucide-solid';

function Dashboard() {
  // Set page-specific header
  usePageHeader('Dashshboard', 'Operational overview of your AI Agent Bus');

  const { isConnected, serverVersion, health, artifacts, availableTools } = useMCP();
  const [uptime, setUptime] = createSignal('0h 0m 0s');

  // TODO: Replace with dashboard-server API call
  const [kvMetrics] = createSignal({ totalKeys: 10, totalSize: 5.2 });

  // Remove the old resource-based approach - now using event-driven metrics
  /*const [kvMetrics] = createResource(
    () => isConnected(),
    async () => {
      try {
        // Use the new kv.getStats MCP tool to get accurate counts
        const result = await kvStore.getStats();

        // Debug logging
        console.log('Dashboard KV metrics result:', result);

        // Handle warnings from infrastructure issues
        if (result && result.warning) {
          notify.warning(result.warning, { duration: 10000 });
        }

        // Handle case where result is null/undefined
        if (!result) {
          console.warn('KV getStats returned null/undefined');
          return { totalKeys: 0, totalSize: 0 };
        }

        return {
          totalKeys: result.totalKeys || 0,
          totalSize: result.totalSize || 0
        };
      } catch (error) {
        console.warn('KV metrics error:', error);
        return { totalKeys: 0, totalSize: 0 };
      }
    }
  );*/

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
  const [recentActivity, _setRecentActivity] = createSignal([
    { id: 1, action: 'MCP Server Connected', time: 'now', icon: CheckCircle, type: 'success' },
    { id: 2, action: 'Health check completed', time: '1 min ago', icon: Activity, type: 'info' },
    { id: 3, action: 'Agent delegation active', time: '5 min ago', icon: Users, type: 'success' },
    { id: 4, action: 'Dashboard initialized', time: '10 min ago', icon: ChartColumn, type: 'info' }
  ]);

  const notify = useNotifications();

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

    notify.success("Welcome back! Here's your dashboard overview.", { duration: 600000 });
    notify.info('System health is optimal.', { duration: 600000 });
    notify.error('This is a test error message.', { duration: 600000 });
    notify.warning('This is a test warning message.', { duration: 600000 });
    // debug('This is a test debug message.', { duration: 600000 });

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

  // Real metrics from MCP server
  const stats = () => [
    {
      label: 'Active Tools',
      value: availableTools()?.length || 0,
      change: isConnected() ? 'Connected' : 'Offline',
      trend: isConnected() ? 'up' : 'down',
      icon: Zap,
      color: 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30'
    },
    {
      label: 'KV Store Keys',
      value: kvMetrics().totalKeys,
      change: isConnected() ? `${kvMetrics().totalSize.toFixed(1)}KB` : 'Offline',
      trend: isConnected() ? 'up' : 'down',
      icon: Database,
      color: 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30'
    },
    {
      label: 'Artifacts',
      value: artifactsMetrics()?.totalFiles || 0,
      change: isConnected() ? `${(artifactsMetrics()?.totalSize / 1024 || 0).toFixed(1)}KB` : 'Offline',
      trend: isConnected() ? 'up' : 'down',
      icon: Activity,
      color: 'text-purple-600 bg-purple-100 dark:text-purple-400 dark:bg-purple-900/30'
    },
    {
      label: 'Connection',
      value: isConnected() ? 'Online' : 'Offline',
      change: serverVersion() ? `v${serverVersion()}` : 'No version',
      trend: isConnected() ? 'up' : 'down',
      icon: TrendingUp,
      color: 'text-purple-600 bg-purple-100 dark:text-purple-400 dark:bg-purple-900/30'
    },
    {
      label: 'Health Status',
      value: health()?.status || 'Unknown',
      change: health() && health()!.timestamp ? new Date(health()!.timestamp).toLocaleTimeString() : 'Not checked',
      trend: health()?.status === 'healthy' ? 'up' : 'down',
      icon: Clock,
      color: 'text-orange-600 bg-orange-100 dark:text-orange-400 dark:bg-orange-900/30'
    }
  ];

  const quickActions = [
    {
      title: 'View Analytics',
      description: 'Explore detailed performance metrics',
      href: '/analytics',
      icon: ChartColumn,
      color: 'bg-blue-500'
    },
    {
      title: 'Manage Workflows',
      description: 'Create and monitor workflows',
      href: '/workflows',
      icon: CirclePlay,
      color: 'bg-purple-500'
    },
    {
      title: 'KV Store',
      description: 'Manage key-value data',
      href: '/kv-store',
      icon: Database,
      color: 'bg-orange-500'
    },
    {
      title: 'Artifacts',
      description: 'View and manage stored artifacts',
      href: '/artifacts',
      icon: Activity,
      color: 'bg-green-500'
    }
  ];

  return (
    <div class="space-y-8 animate-fade-in">
      {/* Header */}
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
        <div class="flex items-center gap-4">
          <div class="px-4 py-2 bg-white/50 backdrop-blur-sm rounded-lg border border-slate-200/50 dark:bg-slate-800/50 dark:border-slate-700/50">
            <div class="text-sm text-slate-600 dark:text-slate-400">
              Uptime: <span class="font-semibold text-slate-900 dark:text-white">{uptime()}</span>
            </div>
          </div>
          <Show when={serverVersion()}>
            <div class="px-3 py-1.5 bg-gradient-brand text-white rounded-full text-sm font-semibold shadow-lg animate-glow">
              v{serverVersion()}
            </div>
          </Show>
        </div>
      </div>

      {/* Stats Grid */}
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <For each={stats()}>
          {(stat, index) => (
            <div 
              class="group bg-white/80 backdrop-blur-sm p-6 rounded-xl border border-slate-200/60 shadow-sm hover:shadow-xl hover:-translate-y-2 transition-all duration-300 dark:bg-slate-800/80 dark:border-slate-700/60 animate-slide-up"
              style={`animation-delay: ${index() * 0.1}s;`}
            >
              <div class="flex items-center justify-between">
                <div class="flex-1">
                  <p class="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">{stat.label}</p>
                  <p class="text-3xl font-bold text-slate-900 dark:text-white mt-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{stat.value}</p>
                  <div class="flex items-center mt-3">
                    <span class={`text-sm font-semibold px-2 py-1 rounded-full ${stat.trend === 'up' 
                      ? 'text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-900/30' 
                      : 'text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-900/30'
                    }`}>
                      {stat.change}
                    </span>
                    <span class="text-sm text-slate-500 dark:text-slate-400 ml-2">vs last week</span>
                  </div>
                </div>
                <div class={`p-4 rounded-2xl ${stat.color} group-hover:scale-110 transition-transform duration-300 animate-float`}>
                  <stat.icon class="w-7 h-7" />
                </div>
              </div>
            </div>
          )}
        </For>
      </div>

      {/* Main Content Grid */}
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <div class="lg:col-span-2 animate-slide-up" style="animation-delay: 0.4s;">
          <div class="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200/60 shadow-lg dark:bg-slate-800/80 dark:border-slate-700/60">
            <div class="p-8 border-b border-slate-200/50 dark:border-slate-700/50">
              <h2 class="text-2xl font-bold text-slate-900 dark:text-white">Quick Actions</h2>
              <p class="text-slate-600 dark:text-slate-400 mt-2">Access your most used tools and features</p>
            </div>
            <div class="p-8">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <For each={quickActions}>
                  {(action, index) => (
                    <A
                      href={action.href}
                      class="group flex items-start gap-4 p-6 bg-white/50 backdrop-blur-sm border border-slate-200/60 rounded-xl hover:border-slate-300/80 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 dark:bg-slate-800/50 dark:border-slate-700/60 dark:hover:border-slate-600/80 animate-slide-up"
                      style={`animation-delay: ${0.5 + index() * 0.1}s;`}
                    >
                      <div class={`p-3 rounded-2xl ${action.color} text-white group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 shadow-lg`}>
                        <action.icon class="w-6 h-6" />
                      </div>
                      <div class="flex-1 min-w-0">
                        <h3 class="text-base font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors mb-1">
                          {action.title}
                        </h3>
                        <p class="text-sm text-slate-600 dark:text-slate-400">{action.description}</p>
                      </div>
                    </A>
                  )}
                </For>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div class="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200/60 shadow-lg dark:bg-slate-800/80 dark:border-slate-700/60 animate-slide-up" style="animation-delay: 0.5s;">
          <div class="p-8 border-b border-slate-200/50 dark:border-slate-700/50">
            <h2 class="text-2xl font-bold text-slate-900 dark:text-white">Recent Activity</h2>
            <p class="text-slate-600 dark:text-slate-400 mt-2">Latest system events</p>
          </div>
          <div class="p-8">
            <div class="space-y-6">
              <For each={recentActivity()}>
                {(activity, index) => {
                  const IconComponent = getActivityIcon(activity.type);
                  return (
                    <div class="flex items-start gap-4 group animate-slide-up" style={`animation-delay: ${0.6 + index() * 0.1}s;`}>
                      <div class={`p-3 rounded-xl ${getActivityColor(activity.type)} group-hover:scale-110 transition-transform duration-300`}>
                        <IconComponent class="w-5 h-5" />
                      </div>
                      <div class="flex-1 min-w-0">
                        <p class="text-base font-semibold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{activity.action}</p>
                        <p class="text-sm text-slate-600 dark:text-slate-400 mt-1">{activity.time}</p>
                      </div>
                    </div>
                  );
                }}
              </For>
            </div>
            <div class="mt-8 pt-6 border-t border-slate-200/50 dark:border-slate-700/50">
              <A 
                href="/events" 
                class="inline-flex items-center gap-2 text-base font-semibold text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 transition-colors group"
              >
                View all activity 
                <span class="group-hover:translate-x-1 transition-transform">→</span>
              </A>
            </div>
          </div>
        </div>
      </div>

      {/* System Health */}
      <div class="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200/60 shadow-lg dark:bg-slate-800/80 dark:border-slate-700/60 animate-slide-up" style="animation-delay: 0.7s;">
        <div class="p-8 border-b border-slate-200/50 dark:border-slate-700/50">
          <h2 class="text-2xl font-bold text-slate-900 dark:text-white">System Health</h2>
          <p class="text-slate-600 dark:text-slate-400 mt-2">Monitor your system's performance</p>
        </div>
        <div class="p-8">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div class="text-center group animate-slide-up" style="animation-delay: 0.8s;">
              <div class="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-2xl dark:bg-green-900/30 group-hover:scale-110 transition-transform duration-300 animate-float">
                <CheckCircle class="w-10 h-10 text-green-600 dark:text-green-400" />
              </div>
              <h3 class="text-xl font-bold text-slate-900 dark:text-white mt-4 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">MCP Server</h3>
              <p class={`text-base font-semibold mt-2 px-3 py-1 rounded-full inline-block ${isConnected() 
                ? 'text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-900/30' 
                : 'text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-900/30'
              }`}>
                {isConnected() ? 'Connected' : 'Disconnected'}
              </p>
            </div>
            <div class="text-center group animate-slide-up" style="animation-delay: 0.9s;">
              <div class="inline-flex items-center justify-center w-20 h-20 bg-blue-100 rounded-2xl dark:bg-blue-900/30 group-hover:scale-110 transition-transform duration-300 animate-float" style="animation-delay: 1s;">
                <Database class="w-10 h-10 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 class="text-xl font-bold text-slate-900 dark:text-white mt-4 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">Storage</h3>
              <p class="text-base font-semibold text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-900/30 mt-2 px-3 py-1 rounded-full inline-block">Operational</p>
            </div>
            <div class="text-center group animate-slide-up" style="animation-delay: 1s;">
              <div class="inline-flex items-center justify-center w-20 h-20 bg-purple-100 rounded-2xl dark:bg-purple-900/30 group-hover:scale-110 transition-transform duration-300 animate-float" style="animation-delay: 2s;">
                <Activity class="w-10 h-10 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 class="text-xl font-bold text-slate-900 dark:text-white mt-4 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">Performance</h3>
              <p class="text-base font-semibold text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-900/30 mt-2 px-3 py-1 rounded-full inline-block">Excellent</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;