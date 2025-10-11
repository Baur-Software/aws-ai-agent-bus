import { createSignal, createEffect, onMount, onCleanup, For, Show, batch } from 'solid-js';
import { useOrganization } from '../contexts/OrganizationContext';
import { useDashboardServer } from '../contexts/DashboardServerContext';
import { useNotifications } from '../contexts/NotificationContext';
import { usePageHeader } from '../contexts/HeaderContext';
import { EventsSkeleton, AnalyticsSkeleton } from '../components/ui/EventsSkeleton';
import {
  Activity, Radio, Zap, Eye, Filter, Search, Calendar, Clock,
  GitBranch, Users, AlertTriangle, CheckCircle, XCircle, Info,
  BarChart3, Workflow, Settings, Plus, RefreshCw, Download,
  PlayCircle, PauseCircle, StopCircle, Target, Bell, TrendingUp,
  TrendingDown, Minus
} from 'lucide-solid';

interface RealtimeEvent {
  id?: string;
  eventId?: string;
  timestamp: string;
  detailType: string;
  source: string;
  detail: any;
  priority: 'low' | 'medium' | 'high' | 'critical';
  userId?: string;
  organizationId?: string;
  executionId?: string;
  tags?: string[];
}

interface EventRule {
  ruleId: string;
  name: string;
  pattern: any;
  description?: string;
  enabled: boolean;
  createdAt?: string;
}

interface EventAnalytics {
  scope: string;
  startTime: string;
  endTime: string;
  analytics: {
    volume?: {
      granularity: string;
      buckets: Array<{ bucket: string; count: number }>;
    };
    topSources?: Array<{ source: string; count: number }>;
    priority?: {
      low: number;
      medium: number;
      high: number;
      critical: number;
    };
    eventTypes?: Array<{ eventType: string; count: number }>;
  };
}

export default function Events() {
  usePageHeader('Event Bus', 'Real-time event streaming and analytics');

  const { currentOrganization, user } = useOrganization();
  const { sendMessageWithResponse, sendMessage, callMCPTool, isConnected } = useDashboardServer();
  const { success, error } = useNotifications();

  // State management
  const [realtimeEvents, setRealtimeEvents] = createSignal<RealtimeEvent[]>([]);
  const [eventRules, setEventRules] = createSignal<EventRule[]>([]);
  const [analytics, setAnalytics] = createSignal<EventAnalytics | null>(null);
  const [activeTab, setActiveTab] = createSignal<'live' | 'rules' | 'analytics'>('live');
  const [filterQuery, setFilterQuery] = createSignal('');
  const [priorityFilter, setPriorityFilter] = createSignal<string | null>(null);
  const [sourceFilter, setSourceFilter] = createSignal<string | null>(null);
  const [autoRefresh, setAutoRefresh] = createSignal(true);
  const [isLoading, setIsLoading] = createSignal(true);
  const [subscriptionActive, setSubscriptionActive] = createSignal(false);

  // Load historical events and analytics
  const loadHistoricalEvents = async () => {
    try {
      setIsLoading(true);

      // Query recent events via MCP events_query tool
      const result = await callMCPTool('events_query', {
        userId: user()?.userId,
        organizationId: currentOrganization()?.id,
        limit: 100,
        sortOrder: 'desc'
      });

      if (result?.events) {
        setRealtimeEvents(result.events.map((event: any) => ({
          ...event,
          id: event.eventId || event.id,
          tags: event.tags || []
        })));
      }
    } catch (err) {
      console.error('Failed to load historical events:', err);
      error('Failed to load event history');
    } finally {
      setIsLoading(false);
    }
  };

  // Load analytics data
  const loadAnalytics = async () => {
    try {
      const analyticsResult = await callMCPTool('events_analytics', {
        organizationId: currentOrganization()?.id,
        userId: user()?.userId,
        metrics: ['volume', 'topSources', 'priority', 'eventTypes'],
        granularity: 'hourly'
      });

      if (analyticsResult) {
        setAnalytics(analyticsResult);
      }
    } catch (err) {
      console.error('Failed to load analytics:', err);
    }
  };

  // Subscribe to real-time event stream
  const subscribeToEvents = () => {
    if (!isConnected()) {
      console.warn('WebSocket not connected, cannot subscribe to events');
      return;
    }

    sendMessage({
      type: 'subscribe_events',
      eventTypes: ['*'], // Subscribe to all events
      filters: {
        userId: user()?.userId,
        organizationId: currentOrganization()?.id
      }
    });

    setSubscriptionActive(true);
    console.log('📡 Subscribed to real-time event stream');
  };

  // Handle incoming real-time events
  const handleEventStream = (message: any) => {
    if (message.type === 'event_stream' && message.event) {
      const newEvent: RealtimeEvent = {
        ...message.event,
        id: message.event.eventId || message.event.id,
        tags: message.event.tags || []
      };

      // Add to top of list (most recent first)
      setRealtimeEvents(prev => [newEvent, ...prev].slice(0, 200)); // Keep last 200 events

      // Optionally show notification for critical events
      if (newEvent.priority === 'critical') {
        error(`Critical event: ${newEvent.detailType}`);
      }
    }
  };

  // Set up WebSocket message listener
  onMount(() => {
    // Load initial data
    loadHistoricalEvents();
    loadAnalytics();

    // Subscribe to real-time events when connected
    createEffect(() => {
      if (isConnected() && !subscriptionActive()) {
        subscribeToEvents();
      }
    });

    // Re-subscribe when context changes (personal ↔ organizational)
    createEffect(() => {
      const org = currentOrganization();
      const currentUser = user();

      if (isConnected() && subscriptionActive()) {
        console.log(`🔄 Context switched to: ${org?.name || 'Personal'}`);

        // Unsubscribe from old context (implicit via new subscription)
        setSubscriptionActive(false);

        // Reload data for new context
        loadHistoricalEvents();
        loadAnalytics();

        // Re-subscribe with new context filters
        subscribeToEvents();
      }
    });

    // Listen for event_stream messages
    const handleMessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);
        handleEventStream(message);
      } catch (err) {
        // Ignore parse errors for non-JSON messages
      }
    };

    // Add event listener to window for WebSocket messages
    window.addEventListener('message', handleMessage);

    // Periodic analytics refresh
    const analyticsInterval = setInterval(() => {
      if (autoRefresh() && activeTab() === 'analytics') {
        loadAnalytics();
      }
    }, 30000); // Every 30 seconds

    onCleanup(() => {
      window.removeEventListener('message', handleMessage);
      clearInterval(analyticsInterval);
    });
  });

  // Refresh data when organization changes
  createEffect(() => {
    const org = currentOrganization();
    if (org) {
      loadHistoricalEvents();
      loadAnalytics();

      // Resubscribe with new organization filter
      if (subscriptionActive()) {
        subscribeToEvents();
      }
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

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'critical': return <AlertTriangle class="w-4 h-4" />;
      case 'high': return <TrendingUp class="w-4 h-4" />;
      case 'medium': return <Minus class="w-4 h-4" />;
      case 'low': return <TrendingDown class="w-4 h-4" />;
      default: return <Info class="w-4 h-4" />;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const filteredEvents = () => {
    let events = realtimeEvents();

    // Text filter
    const query = filterQuery().toLowerCase();
    if (query) {
      events = events.filter(event =>
        event.detailType.toLowerCase().includes(query) ||
        event.source.toLowerCase().includes(query) ||
        (event.tags && event.tags.some(tag => tag.toLowerCase().includes(query))) ||
        JSON.stringify(event.detail).toLowerCase().includes(query)
      );
    }

    // Priority filter
    if (priorityFilter()) {
      events = events.filter(event => event.priority === priorityFilter());
    }

    // Source filter
    if (sourceFilter()) {
      events = events.filter(event => event.source === sourceFilter());
    }

    return events;
  };

  const uniqueSources = () => {
    const sources = new Set<string>();
    realtimeEvents().forEach(event => sources.add(event.source));
    return Array.from(sources).sort();
  };

  const eventCountByPriority = (priority: string) => {
    return realtimeEvents().filter(event => event.priority === priority).length;
  };

  return (
    <div class="h-full flex flex-col bg-white dark:bg-gray-900">
      {/* Header Controls */}
      <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        {/* Context Indicator */}
        <div class="mb-3 flex items-center gap-2 text-sm">
          <span class="text-gray-500 dark:text-gray-400">Context:</span>
          <span class="px-2 py-1 rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium">
            {currentOrganization()?.name || 'Personal'}
          </span>
          <Show when={currentOrganization()}>
            <span class="text-gray-400 dark:text-gray-500">
              (Organization events)
            </span>
          </Show>
          <Show when={!currentOrganization()}>
            <span class="text-gray-400 dark:text-gray-500">
              (Your personal events)
            </span>
          </Show>
        </div>

        <div class="flex items-center justify-between gap-4">
          {/* Tabs */}
          <div class="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Live Events tab clicked');
                setActiveTab('live');
              }}
              class={`px-4 py-2 rounded-lg font-medium transition-all cursor-pointer ${
                activeTab() === 'live'
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
              type="button"
            >
              <Radio class="w-4 h-4 inline mr-2" />
              Live Events
              <span class="ml-2 px-2 py-0.5 text-xs rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                {realtimeEvents().length}
              </span>
            </button>

            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Analytics tab clicked');
                setActiveTab('analytics');
                loadAnalytics();
              }}
              class={`px-4 py-2 rounded-lg font-medium transition-all cursor-pointer ${
                activeTab() === 'analytics'
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
              type="button"
            >
              <BarChart3 class="w-4 h-4 inline mr-2" />
              Analytics
            </button>
          </div>

          {/* Actions */}
          <div class="flex items-center gap-2">
            <button
              onClick={() => setAutoRefresh(!autoRefresh())}
              class={`p-2 rounded-lg transition-all ${
                autoRefresh()
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
              }`}
              title={autoRefresh() ? 'Auto-refresh enabled' : 'Auto-refresh disabled'}
            >
              <Radio class="w-4 h-4" />
            </button>

            <button
              onClick={() => {
                loadHistoricalEvents();
                loadAnalytics();
              }}
              class="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
              title="Refresh"
            >
              <RefreshCw class="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filters (Live Events Tab) */}
        <Show when={activeTab() === 'live'}>
          <div class="mt-4 flex flex-wrap items-center gap-2">
            {/* Search */}
            <div class="flex-1 min-w-[200px]">
              <div class="relative">
                <Search class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Filter events by type, source, tags..."
                  value={filterQuery()}
                  onInput={(e) => setFilterQuery(e.currentTarget.value)}
                  class="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Priority Filter */}
            <select
              value={priorityFilter() || ''}
              onChange={(e) => setPriorityFilter(e.currentTarget.value || null)}
              class="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            >
              <option value="">All Priorities</option>
              <option value="critical">Critical ({eventCountByPriority('critical')})</option>
              <option value="high">High ({eventCountByPriority('high')})</option>
              <option value="medium">Medium ({eventCountByPriority('medium')})</option>
              <option value="low">Low ({eventCountByPriority('low')})</option>
            </select>

            {/* Source Filter */}
            <select
              value={sourceFilter() || ''}
              onChange={(e) => setSourceFilter(e.currentTarget.value || null)}
              class="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            >
              <option value="">All Sources</option>
              <For each={uniqueSources()}>
                {(source) => <option value={source}>{source}</option>}
              </For>
            </select>
          </div>
        </Show>
      </div>

      {/* Content Area - Show skeleton while loading */}
      <Show
        when={!isLoading()}
        fallback={
          <Show
            when={activeTab() === 'analytics'}
            fallback={<EventsSkeleton />}
          >
            <AnalyticsSkeleton />
          </Show>
        }
      >
        <div class="flex-1 overflow-auto p-6">
          {/* Live Events Tab */}
          <Show when={activeTab() === 'live'}>
            <Show
              when={filteredEvents().length > 0}
              fallback={
                <div class="text-center py-12">
                  <Radio class="w-12 h-12 mx-auto text-gray-400 dark:text-gray-600 mb-4" />
                  <p class="text-gray-600 dark:text-gray-400">
                    No events found. Events will appear here in real-time.
                  </p>
                </div>
              }
            >
              <div class="space-y-2">
                <For each={filteredEvents()}>
                  {(event) => (
                    <div class="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-blue-300 dark:hover:border-blue-700 transition-all">
                      <div class="flex items-start justify-between gap-4">
                        <div class="flex-1 min-w-0">
                          {/* Event Type */}
                          <div class="flex items-center gap-2 mb-2">
                            <span class="font-mono text-sm font-medium text-gray-900 dark:text-gray-100">
                              {event.detailType}
                            </span>
                            <span class={`px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1 ${getPriorityColor(event.priority)}`}>
                              {getPriorityIcon(event.priority)}
                              {event.priority}
                            </span>
                          </div>

                          {/* Source & Timestamp */}
                          <div class="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mb-2">
                            <div class="flex items-center gap-1">
                              <GitBranch class="w-3 h-3" />
                              <span class="font-mono">{event.source}</span>
                            </div>
                            <div class="flex items-center gap-1">
                              <Clock class="w-3 h-3" />
                              <span>{formatTimestamp(event.timestamp)}</span>
                            </div>
                            <Show when={event.executionId}>
                              <div class="flex items-center gap-1">
                                <Workflow class="w-3 h-3" />
                                <span class="font-mono text-xs">{event.executionId?.slice(0, 8)}...</span>
                              </div>
                            </Show>
                          </div>

                          {/* Event Detail */}
                          <details class="text-sm">
                            <summary class="cursor-pointer text-blue-600 dark:text-blue-400 hover:underline">
                              View detail
                            </summary>
                            <pre class="mt-2 p-3 rounded bg-gray-50 dark:bg-gray-900 text-xs overflow-x-auto">
                              {JSON.stringify(event.detail, null, 2)}
                            </pre>
                          </details>

                          {/* Tags */}
                          <Show when={event.tags && event.tags.length > 0}>
                            <div class="flex items-center gap-2 mt-2">
                              <For each={event.tags}>
                                {(tag) => (
                                  <span class="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs">
                                    {tag}
                                  </span>
                                )}
                              </For>
                            </div>
                          </Show>
                        </div>

                        {/* Event ID */}
                        <div class="text-xs font-mono text-gray-400 dark:text-gray-600">
                          {(event.id || event.eventId)?.slice(0, 8)}
                        </div>
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </Show>
        </div>

        {/* Analytics Tab */}
        <Show when={activeTab() === 'analytics'}>
          <Show
            when={analytics() && analytics()!.analytics}
            fallback={
              <div class="flex flex-col items-center justify-center h-64 text-center">
                <Show
                  when={!isLoading()}
                  fallback={
                    <>
                      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-4" />
                      <p class="text-gray-600 dark:text-gray-400">Loading analytics...</p>
                    </>
                  }
                >
                  <BarChart3 class="w-12 h-12 mx-auto text-gray-400 dark:text-gray-600 mb-4" />
                  <p class="text-gray-600 dark:text-gray-400 mb-2">No analytics data available</p>
                  <button
                    onClick={() => loadAnalytics()}
                    class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                  >
                    <RefreshCw class="w-4 h-4 inline mr-2" />
                    Load Analytics
                  </button>
                </Show>
              </div>
            }
          >
            {(analyticsData) => (
              <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Event Volume Chart */}
                <Show when={analyticsData().volume}>
                  {(volume) => (
                    <div class="p-6 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                      <h3 class="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Event Volume</h3>
                      <div class="space-y-2">
                        <For each={volume().buckets}>
                          {(bucket) => (
                            <div class="flex items-center gap-3">
                              <div class="w-24 text-xs text-gray-600 dark:text-gray-400 font-mono">{bucket.bucket}</div>
                              <div class="flex-1 h-8 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
                                <div
                                  class="h-full bg-blue-500 dark:bg-blue-600 rounded-lg transition-all"
                                  style={{ width: `${Math.min(100, (bucket.count / Math.max(...volume().buckets.map(b => b.count))) * 100)}%` }}
                                />
                              </div>
                              <div class="w-12 text-right text-sm font-medium text-gray-900 dark:text-gray-100">{bucket.count}</div>
                            </div>
                          )}
                        </For>
                      </div>
                    </div>
                  )}
                </Show>

                {/* Priority Distribution */}
                <Show when={analyticsData().priority}>
                  {(priority) => (
                    <div class="p-6 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                      <h3 class="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Priority Distribution</h3>
                      <div class="space-y-3">
                        <div class="flex items-center justify-between">
                          <span class="text-red-600 dark:text-red-400 flex items-center gap-2">
                            <AlertTriangle class="w-4 h-4" />
                            Critical
                          </span>
                          <span class="font-semibold text-gray-900 dark:text-gray-100">{priority().critical}</span>
                        </div>
                        <div class="flex items-center justify-between">
                          <span class="text-orange-600 dark:text-orange-400 flex items-center gap-2">
                            <TrendingUp class="w-4 h-4" />
                            High
                          </span>
                          <span class="font-semibold text-gray-900 dark:text-gray-100">{priority().high}</span>
                        </div>
                        <div class="flex items-center justify-between">
                          <span class="text-blue-600 dark:text-blue-400 flex items-center gap-2">
                            <Minus class="w-4 h-4" />
                            Medium
                          </span>
                          <span class="font-semibold text-gray-900 dark:text-gray-100">{priority().medium}</span>
                        </div>
                        <div class="flex items-center justify-between">
                          <span class="text-gray-600 dark:text-gray-400 flex items-center gap-2">
                            <TrendingDown class="w-4 h-4" />
                            Low
                          </span>
                          <span class="font-semibold text-gray-900 dark:text-gray-100">{priority().low}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </Show>

                {/* Top Sources */}
                <Show when={analyticsData().topSources}>
                  {(topSources) => (
                    <div class="p-6 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                      <h3 class="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Top Event Sources</h3>
                      <div class="space-y-2">
                        <For each={topSources().slice(0, 10)}>
                          {(item) => (
                            <div class="flex items-center gap-3">
                              <div class="flex-1 text-sm font-mono text-gray-900 dark:text-gray-100 truncate">{item.source}</div>
                              <div class="text-sm font-semibold text-blue-600 dark:text-blue-400">{item.count}</div>
                            </div>
                          )}
                        </For>
                      </div>
                    </div>
                  )}
                </Show>

                {/* Event Types */}
                <Show when={analyticsData().eventTypes}>
                  {(eventTypes) => (
                    <div class="p-6 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                      <h3 class="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Event Types</h3>
                      <div class="space-y-2">
                        <For each={eventTypes().slice(0, 10)}>
                          {(item) => (
                            <div class="flex items-center gap-3">
                              <div class="flex-1 text-sm font-mono text-gray-900 dark:text-gray-100 truncate">{item.eventType}</div>
                              <div class="text-sm font-semibold text-purple-600 dark:text-purple-400">{item.count}</div>
                            </div>
                          )}
                        </For>
                      </div>
                    </div>
                  )}
                </Show>
              </div>
            )}
          </Show>
        </Show>
      </Show>
    </div>
  );
}
