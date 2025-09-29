import { createSignal, createMemo, createEffect, Show, For } from 'solid-js';
import { usePageHeader } from '../../contexts/HeaderContext';
import { useDashboardServer } from '../../contexts/DashboardServerContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { MCPServerListing } from '../../types/mcpCatalog';
import MCPServerCard from './MCPServerCard';
import ServerFilters from './ServerFilters';
import ServerCatalogSkeleton from './ServerCatalogSkeleton';

export default function AppsTab() {
  usePageHeader('MCP Apps', 'Discover and connect MCP servers for enhanced AI capabilities');

  const dashboardServer = useDashboardServer();
  const { addNotification } = useNotifications();

  // Core state signals
  const [servers, setServers] = createSignal<MCPServerListing[]>([]);
  const [isLoading, setIsLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);

  // Filter/search state
  const [searchQuery, setSearchQuery] = createSignal('');
  const [selectedCategory, setSelectedCategory] = createSignal<string>('all');
  const [selectedVerification, setSelectedVerification] = createSignal<'all' | 'official' | 'signed' | 'popular'>('all');
  const [sortBy, setSortBy] = createSignal<'name' | 'downloadCount' | 'lastUpdated' | 'starCount'>('downloadCount');

  // Connection state
  const [connectingServerId, setConnectingServerId] = createSignal<string | null>(null);
  const [connectedServers, setConnectedServers] = createSignal<Set<string>>(new Set());

  // Derived state with memos
  const categories = createMemo(() => {
    const uniqueCategories = new Set(
      servers().map(server => server.category)
    );
    return ['all', ...Array.from(uniqueCategories).sort()];
  });

  const filteredServers = createMemo(() => {
    const query = searchQuery().toLowerCase();
    const category = selectedCategory();
    const verification = selectedVerification();

    return servers().filter(server => {
      // Search filter
      const matchesSearch = query === '' ||
        server.name.toLowerCase().includes(query) ||
        server.description.toLowerCase().includes(query) ||
        server.publisher.toLowerCase().includes(query) ||
        server.tags.some(tag => tag.toLowerCase().includes(query));

      // Category filter
      const matchesCategory = category === 'all' || server.category === category;

      // Verification filter
      const matchesVerification = verification === 'all' ||
        (verification === 'official' && server.isOfficial) ||
        (verification === 'signed' && server.isSigned) ||
        (verification === 'popular' && server.verificationBadges.includes('popular'));

      return matchesSearch && matchesCategory && matchesVerification;
    });
  });

  const sortedServers = createMemo(() => {
    const sort = sortBy();
    return [...filteredServers()].sort((a, b) => {
      switch (sort) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'downloadCount':
          return b.downloadCount - a.downloadCount;
        case 'starCount':
          return b.starCount - a.starCount;
        case 'lastUpdated':
          return new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime();
        default:
          return 0;
      }
    });
  });

  // Load servers data
  createEffect(() => {
    loadServers();
  });

  const loadServers = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Call MCP Catalog Service through dashboard server
      const result = await dashboardServer.sendMessage({
        type: 'mcp_catalog_list',
        data: {}
      });

      if (result.error) {
        throw new Error(result.error);
      }

      setServers(result.data?.servers || []);

      // Emit discovery completed event
      dashboardServer.sendMessage({
        type: 'event_send',
        data: {
          source: 'agent-mesh.mcp.catalog',
          detailType: 'MCP Catalog Discovery Completed',
          detail: {
            serverCount: result.data?.servers?.length || 0,
            timestamp: new Date().toISOString()
          }
        }
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load MCP servers';
      setError(errorMessage);

      // Emit discovery failed event
      dashboardServer.sendMessage({
        type: 'event_send',
        data: {
          source: 'agent-mesh.mcp.catalog',
          detailType: 'MCP Catalog Discovery Failed',
          detail: {
            errorMessage,
            timestamp: new Date().toISOString()
          }
        }
      });

      addNotification({
        type: 'error',
        title: 'Failed to Load MCP Servers',
        message: errorMessage
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Event handlers
  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
  };

  const handleVerificationFilter = (verification: 'all' | 'official' | 'signed' | 'popular') => {
    setSelectedVerification(verification);
  };

  const handleSortChange = (sort: 'name' | 'downloadCount' | 'lastUpdated' | 'starCount') => {
    setSortBy(sort);
  };

  const handleServerConnect = async (serverId: string) => {
    const server = servers().find(s => s.id === serverId);
    if (!server) return;

    setConnectingServerId(serverId);

    // Emit connection attempt event
    await dashboardServer.sendMessage({
      type: 'event_send',
      data: {
        source: 'agent-mesh.mcp.connection',
        detailType: 'MCP Server Connection Attempted',
        detail: {
          serverId,
          serverName: server.name,
          retryAttempt: 1,
          timestamp: new Date().toISOString()
        }
      }
    });

    try {
      const result = await dashboardServer.sendMessage({
        type: 'mcp_server_connect',
        data: {
          serverId,
          serverConfig: {
            command: server.installCommand,
            name: server.name,
            description: server.description
          }
        }
      });

      if (result.error) {
        throw new Error(result.error);
      }

      setConnectedServers(prev => new Set([...prev, serverId]));

      // Emit connection established event
      await dashboardServer.sendMessage({
        type: 'event_send',
        data: {
          source: 'agent-mesh.mcp.connection',
          detailType: 'MCP Server Connection Established',
          detail: {
            serverId,
            serverName: server.name,
            connectionId: `conn_${Date.now()}`,
            timestamp: new Date().toISOString()
          }
        }
      });

      addNotification({
        type: 'success',
        title: 'Server Connected',
        message: `Successfully connected to ${server.name}`
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect server';

      // Emit connection failed event
      await dashboardServer.sendMessage({
        type: 'event_send',
        data: {
          source: 'agent-mesh.mcp.connection',
          detailType: 'MCP Server Connection Failed',
          detail: {
            serverId,
            serverName: server.name,
            errorType: 'connection_error',
            errorMessage,
            retryAttempt: 1,
            timestamp: new Date().toISOString()
          }
        }
      });

      addNotification({
        type: 'error',
        title: 'Connection Failed',
        message: `Failed to connect to ${server.name}: ${errorMessage}`
      });
    } finally {
      setConnectingServerId(null);
    }
  };

  const handleServerDisconnect = async (serverId: string) => {
    const server = servers().find(s => s.id === serverId);
    if (!server) return;

    try {
      const result = await dashboardServer.sendMessage({
        type: 'mcp_server_disconnect',
        data: { serverId }
      });

      if (result.error) {
        throw new Error(result.error);
      }

      setConnectedServers(prev => {
        const next = new Set(prev);
        next.delete(serverId);
        return next;
      });

      // Emit disconnection event
      await dashboardServer.sendMessage({
        type: 'event_send',
        data: {
          source: 'agent-mesh.mcp.connection',
          detailType: 'MCP Server Disconnected',
          detail: {
            serverId,
            serverName: server.name,
            timestamp: new Date().toISOString()
          }
        }
      });

      addNotification({
        type: 'success',
        title: 'Server Disconnected',
        message: `Disconnected from ${server.name}`
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to disconnect server';
      addNotification({
        type: 'error',
        title: 'Disconnect Failed',
        message: `Failed to disconnect from ${server.name}: ${errorMessage}`
      });
    }
  };

  const handleServerView = (serverId: string) => {
    const server = servers().find(s => s.id === serverId);
    if (server?.repository) {
      window.open(server.repository, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div class="max-w-7xl mx-auto p-6">
      <Show when={isLoading()}>
        <ServerCatalogSkeleton />
      </Show>

      <Show when={error() && !isLoading()}>
        <div class="text-center py-12">
          <div class="text-red-600 dark:text-red-400 mb-4">
            <svg class="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <p class="text-lg font-medium">{error()}</p>
          </div>
          <button
            class="btn btn-primary"
            onClick={loadServers}
          >
            Retry Loading Servers
          </button>
        </div>
      </Show>

      <Show when={!isLoading() && !error()}>
        <div class="mb-6">
          <ServerFilters
            searchQuery={searchQuery()}
            selectedCategory={selectedCategory()}
            selectedVerification={selectedVerification()}
            sortBy={sortBy()}
            categories={categories()}
            serverCount={filteredServers().length}
            totalCount={servers().length}
            onSearch={handleSearch}
            onCategoryChange={handleCategoryChange}
            onVerificationFilter={handleVerificationFilter}
            onSortChange={handleSortChange}
          />
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          <For each={sortedServers()}>
            {(server) => (
              <MCPServerCard
                server={server}
                isConnected={connectedServers().has(server.id)}
                isConnecting={connectingServerId() === server.id}
                onConnect={handleServerConnect}
                onDisconnect={handleServerDisconnect}
                onViewDetails={handleServerView}
              />
            )}
          </For>
        </div>

        <Show when={sortedServers().length === 0 && !isLoading()}>
          <div class="text-center py-12">
            <svg class="w-16 h-16 mx-auto mb-4 text-slate-400 dark:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <h3 class="text-lg font-medium text-slate-900 dark:text-white mb-2">
              No servers found
            </h3>
            <p class="text-slate-600 dark:text-slate-400 mb-4">
              Try adjusting your search filters or browse all available categories.
            </p>
            <button
              class="btn btn-secondary"
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
                setSelectedVerification('all');
              }}
            >
              Clear Filters
            </button>
          </div>
        </Show>
      </div>
    </div>
  );
}