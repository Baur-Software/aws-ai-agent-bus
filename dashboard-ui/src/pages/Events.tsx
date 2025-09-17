import { createSignal, createEffect, onMount, For, Show } from 'solid-js';
import { useOrganization } from '../contexts/OrganizationContext';
import { useMCP } from '../contexts/MCPContext';
import { useNotifications } from '../contexts/NotificationContext';
import { usePageHeader } from '../contexts/HeaderContext';
import {
  Activity, Radio, Zap, Eye, Filter, Search, Calendar, Clock,
  GitBranch, Users, AlertTriangle, CheckCircle, XCircle, Info,
  BarChart3, Workflow, Settings, Plus, RefreshCw, Download,
  PlayCircle, PauseCircle, StopCircle, Target, Bell
} from 'lucide-solid';

interface EventStream {
  id: string;
  name: string;
  description: string;
  eventCount: number;
  lastEvent: string;
  status: 'active' | 'paused' | 'error';
  subscribers: number;
  rules: number;
}

interface RealtimeEvent {
  id: string;
  timestamp: string;
  detailType: string;
  source: string;
  detail: any;
  priority: 'low' | 'medium' | 'high' | 'critical';
  userId?: string;
  organizationId: string;
  tags: string[];
}

interface EventRule {
  id: string;
  name: string;
  pattern: string;
  action: string;
  enabled: boolean;
  triggerCount: number;
  lastTriggered?: string;
}

export default function Events() {
  usePageHeader('Event Bus', 'Monitor and manage organizational event streams');

  const { currentOrganization, user } = useOrganization();
  const { executeTool } = useMCP();
  const { success, error } = useNotifications();

  // State management
  const [eventStreams, setEventStreams] = createSignal<EventStream[]>([]);
  const [realtimeEvents, setRealtimeEvents] = createSignal<RealtimeEvent[]>([]);
  const [eventRules, setEventRules] = createSignal<EventRule[]>([]);
  const [selectedStream, setSelectedStream] = createSignal<string | null>(null);
  const [activeTab, setActiveTab] = createSignal<'streams' | 'live' | 'rules' | 'analytics'>('live');
  const [filterQuery, setFilterQuery] = createSignal('');
  const [autoRefresh, setAutoRefresh] = createSignal(true);
  const [isLoading, setIsLoading] = createSignal(true);

  // GitHub-like mock data for demonstration
  const mockEventStreams: EventStream[] = [
    {
      id: 'main',
      name: 'main',
      description: 'Primary event stream for core workflows',
      eventCount: 1247,
      lastEvent: '2 minutes ago',
      status: 'active',
      subscribers: 8,
      rules: 12
    },
    {
      id: 'integrations',
      name: 'integrations',
      description: 'Connected apps and external service events',
      eventCount: 892,
      lastEvent: '5 minutes ago',
      status: 'active',
      subscribers: 5,
      rules: 7
    },
    {
      id: 'workflows',
      name: 'workflows',
      description: 'Workflow execution and coordination events',
      eventCount: 634,
      lastEvent: '1 minute ago',
      status: 'active',
      subscribers: 12,
      rules: 15
    },
    {
      id: 'alerts',
      name: 'alerts',
      description: 'System alerts and error notifications',
      eventCount: 23,
      lastEvent: '1 hour ago',
      status: 'paused',
      subscribers: 3,
      rules: 5
    }
  ];

  const mockRealtimeEvents: RealtimeEvent[] = [
    {
      id: '1',
      timestamp: new Date(Date.now() - 30000).toISOString(),
      detailType: 'workflow.execution.completed',
      source: 'workflow-engine',
      detail: { workflowId: 'wf-123', duration: 45000, status: 'success' },
      priority: 'medium',
      organizationId: currentOrganization()?.id || 'default',
      tags: ['workflow', 'success']
    },
    {
      id: '2',
      timestamp: new Date(Date.now() - 120000).toISOString(),
      detailType: 'integration.connected',
      source: 'integration-manager',
      detail: { service: 'google-analytics', connectionId: 'default', userId: 'user-123' },
      priority: 'low',
      organizationId: currentOrganization()?.id || 'default',
      tags: ['integration', 'connection']
    },
    {
      id: '3',
      timestamp: new Date(Date.now() - 300000).toISOString(),
      detailType: 'agent.model.switched',
      source: 'agent-manager',
      detail: { agentId: 'agent-456', fromModel: 'claude-3-sonnet', toModel: 'bedrock:claude-3-sonnet' },
      priority: 'low',
      organizationId: currentOrganization()?.id || 'default',
      tags: ['agent', 'model']
    },
    {
      id: '4',
      timestamp: new Date(Date.now() - 480000).toISOString(),
      detailType: 'system.error',
      source: 'mcp-server',
      detail: { error: 'Connection timeout', component: 'bedrock-client', retries: 3 },
      priority: 'high',
      organizationId: currentOrganization()?.id || 'default',
      tags: ['error', 'system']
    }
  ];

  const mockEventRules: EventRule[] = [
    {
      id: 'rule-1',
      name: 'High Priority Alerts',
      pattern: 'priority:high OR priority:critical',
      action: 'notify-slack',
      enabled: true,
      triggerCount: 12,
      lastTriggered: '2 hours ago'
    },
    {
      id: 'rule-2',
      name: 'Workflow Failures',
      pattern: 'detailType:workflow.execution.failed',
      action: 'create-incident',
      enabled: true,
      triggerCount: 3,
      lastTriggered: '1 day ago'
    },
    {
      id: 'rule-3',
      name: 'Integration Events',
      pattern: 'source:integration-*',
      action: 'log-analytics',
      enabled: false,
      triggerCount: 156,
      lastTriggered: '3 hours ago'
    }
  ];

  // Initialize with mock data
  onMount(() => {
    setEventStreams(mockEventStreams);
    setRealtimeEvents(mockRealtimeEvents);
    setEventRules(mockEventRules);
    setIsLoading(false);

    // Simulate real-time events
    if (autoRefresh()) {
      const interval = setInterval(() => {
        if (autoRefresh()) {
          // Add a new mock event occasionally
          if (Math.random() < 0.3) {
            const newEvent: RealtimeEvent = {
              id: `event-${Date.now()}`,
              timestamp: new Date().toISOString(),
              detailType: ['user.action', 'workflow.started', 'integration.sync', 'agent.response'][Math.floor(Math.random() * 4)],
              source: ['dashboard', 'workflow-engine', 'integration-manager', 'agent-mesh'][Math.floor(Math.random() * 4)],
              detail: { action: 'simulated', timestamp: new Date().toISOString() },
              priority: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)] as any,
              organizationId: currentOrganization()?.id || 'default',
              tags: ['simulated', 'realtime']
            };
            setRealtimeEvents(prev => [newEvent, ...prev.slice(0, 49)]); // Keep last 50 events
          }
        }
      }, 5000);

      return () => clearInterval(interval);
    }
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30';
      case 'high': return 'text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30';
      case 'medium': return 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30';
      case 'low': return 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-900/30';
      default: return 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-900/30';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle class="w-4 h-4 text-green-500" />;
      case 'paused': return <PauseCircle class="w-4 h-4 text-yellow-500" />;
      case 'error': return <XCircle class="w-4 h-4 text-red-500" />;
      default: return <Info class="w-4 h-4 text-gray-500" />;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  const filteredEvents = () => {
    const query = filterQuery().toLowerCase();
    if (!query) return realtimeEvents();

    return realtimeEvents().filter(event =>
      event.detailType.toLowerCase().includes(query) ||
      event.source.toLowerCase().includes(query) ||
      event.tags.some(tag => tag.toLowerCase().includes(query)) ||
      JSON.stringify(event.detail).toLowerCase().includes(query)
    );
  };

  return (
    <div class="space-y-6">
      {/* Organization Context */}
      <Show when={currentOrganization()}>
        <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div class="flex items-center gap-3">
            <Radio class="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <div>
              <h3 class="font-medium text-blue-900 dark:text-blue-300">
                Event Bus: {currentOrganization()?.name}
              </h3>
              <p class="text-sm text-blue-700 dark:text-blue-300">
                Real-time monitoring of organizational event streams and workflows
              </p>
            </div>
          </div>
        </div>
      </Show>

      {/* Header Controls */}
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-4">
          {/* Tab Navigation */}
          <nav class="flex gap-1">
            <For each={[
              { key: 'live', label: 'Live Events', icon: Activity },
              { key: 'streams', label: 'Streams', icon: GitBranch },
              { key: 'rules', label: 'Rules', icon: Target },
              { key: 'analytics', label: 'Analytics', icon: BarChart3 }
            ]}>
              {(tab) => (
                <button
                  class={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    activeTab() === tab.key
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                  onClick={() => setActiveTab(tab.key as any)}
                >
                  <tab.icon class="w-4 h-4" />
                  {tab.label}
                </button>
              )}
            </For>
          </nav>
        </div>

        <div class="flex items-center gap-2">
          {/* Auto Refresh Toggle */}
          <button
            class={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
              autoRefresh()
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
            }`}
            onClick={() => setAutoRefresh(!autoRefresh())}
          >
            <RefreshCw class={`w-4 h-4 ${autoRefresh() ? 'animate-spin' : ''}`} />
            Auto Refresh
          </button>

          {/* Search */}
          <div class="relative">
            <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Filter events..."
              class="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              value={filterQuery()}
              onInput={(e) => setFilterQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Content Based on Active Tab */}
      <Show when={activeTab() === 'live'}>
        <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <Activity class="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Live Event Stream</h2>
                <div class="flex items-center gap-1">
                  <div class="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span class="text-sm text-green-600 dark:text-green-400">Live</span>
                </div>
              </div>
              <span class="text-sm text-gray-500 dark:text-gray-400">
                {filteredEvents().length} events
              </span>
            </div>
          </div>

          <div class="divide-y divide-gray-200 dark:divide-gray-700">
            <For each={filteredEvents()}>
              {(event) => (
                <div class="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <div class="flex items-start justify-between">
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-3 mb-2">
                        <span class={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(event.priority)}`}>
                          {event.priority}
                        </span>
                        <span class="text-sm font-mono text-blue-600 dark:text-blue-400">
                          {event.detailType}
                        </span>
                        <span class="text-sm text-gray-500 dark:text-gray-400">
                          from {event.source}
                        </span>
                      </div>

                      <div class="bg-gray-50 dark:bg-gray-700 rounded p-3 mb-2">
                        <pre class="text-xs text-gray-700 dark:text-gray-300 overflow-x-auto">
                          {JSON.stringify(event.detail, null, 2)}
                        </pre>
                      </div>

                      <div class="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                        <span class="flex items-center gap-1">
                          <Clock class="w-3 h-3" />
                          {formatTimestamp(event.timestamp)}
                        </span>
                        <div class="flex items-center gap-1">
                          <For each={event.tags}>
                            {(tag) => (
                              <span class="px-2 py-0.5 bg-gray-100 dark:bg-gray-600 rounded text-gray-600 dark:text-gray-300">
                                {tag}
                              </span>
                            )}
                          </For>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>

      {/* Streams Tab */}
      <Show when={activeTab() === 'streams'}>
        <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <For each={eventStreams()}>
            {(stream) => (
              <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <div class="flex items-start justify-between mb-4">
                  <div class="flex items-center gap-3">
                    <GitBranch class="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    <div>
                      <h3 class="font-semibold text-gray-900 dark:text-white">{stream.name}</h3>
                      <p class="text-sm text-gray-600 dark:text-gray-400">{stream.description}</p>
                    </div>
                  </div>
                  {getStatusIcon(stream.status)}
                </div>

                <div class="space-y-3">
                  <div class="flex justify-between text-sm">
                    <span class="text-gray-600 dark:text-gray-400">Events</span>
                    <span class="font-medium text-gray-900 dark:text-white">{stream.eventCount.toLocaleString()}</span>
                  </div>
                  <div class="flex justify-between text-sm">
                    <span class="text-gray-600 dark:text-gray-400">Subscribers</span>
                    <span class="font-medium text-gray-900 dark:text-white">{stream.subscribers}</span>
                  </div>
                  <div class="flex justify-between text-sm">
                    <span class="text-gray-600 dark:text-gray-400">Rules</span>
                    <span class="font-medium text-gray-900 dark:text-white">{stream.rules}</span>
                  </div>
                  <div class="flex justify-between text-sm">
                    <span class="text-gray-600 dark:text-gray-400">Last Event</span>
                    <span class="font-medium text-gray-900 dark:text-white">{stream.lastEvent}</span>
                  </div>
                </div>

                <div class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    class="w-full px-3 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                    onClick={() => setSelectedStream(stream.id)}
                  >
                    View Details
                  </button>
                </div>
              </div>
            )}
          </For>
        </div>
      </Show>

      {/* Rules Tab */}
      <Show when={activeTab() === 'rules'}>
        <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <Target class="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Event Rules</h2>
              </div>
              <button class="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
                <Plus class="w-4 h-4" />
                Create Rule
              </button>
            </div>
          </div>

          <div class="divide-y divide-gray-200 dark:divide-gray-700">
            <For each={eventRules()}>
              {(rule) => (
                <div class="px-6 py-4">
                  <div class="flex items-center justify-between">
                    <div class="flex-1">
                      <div class="flex items-center gap-3 mb-2">
                        <h3 class="font-medium text-gray-900 dark:text-white">{rule.name}</h3>
                        <span class={`px-2 py-1 text-xs font-medium rounded-full ${
                          rule.enabled
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                        }`}>
                          {rule.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>

                      <div class="text-sm text-gray-600 dark:text-gray-400 font-mono bg-gray-50 dark:bg-gray-700 px-2 py-1 rounded mb-2">
                        {rule.pattern}
                      </div>

                      <div class="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                        <span>Action: {rule.action}</span>
                        <span>Triggered: {rule.triggerCount} times</span>
                        <Show when={rule.lastTriggered}>
                          <span>Last: {rule.lastTriggered}</span>
                        </Show>
                      </div>
                    </div>

                    <div class="flex items-center gap-2">
                      <button class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                        <Settings class="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>

      {/* Analytics Tab */}
      <Show when={activeTab() === 'analytics'}>
        <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div class="flex items-center gap-3 mb-6">
            <BarChart3 class="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Event Analytics</h2>
          </div>

          <div class="text-center py-12">
            <BarChart3 class="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">Analytics Dashboard</h3>
            <p class="text-gray-600 dark:text-gray-400 mb-4">
              Real-time analytics and insights for your event streams
            </p>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              Coming soon: Event volume charts, performance metrics, and trend analysis
            </p>
          </div>
        </div>
      </Show>
    </div>
  );
}