import { createSignal, createMemo, createEffect, Show, For } from 'solid-js';
import { usePageHeader } from '../../contexts/HeaderContext';
import { useDashboardServer } from '../../contexts/DashboardServerContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { MCPServerListing } from '../../types/mcpCatalog';
import MCPServerCard from './MCPServerCard';
import ServerFilters from './ServerFilters';
import ServerCatalogSkeleton from './ServerCatalogSkeleton';
import MCPOAuthManager from './MCPOAuthManager';
import { mcpRegistry } from '../../services/MCPCapabilityRegistry';

export default function AppsTab() {
  usePageHeader('Connect Apps', 'Discover and connect your apps for enhanced AI capabilities');

  const dashboardServer = useDashboardServer();
  const { addNotification } = useNotifications();

  // Core state signals
  const [servers, setServers] = createSignal<MCPServerListing[]>([]);
  const [isLoading, setIsLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);

  // Filter/search state
  const [searchQuery, setSearchQuery] = createSignal('');
  const [selectedTags, setSelectedTags] = createSignal<Set<string>>(new Set());
  const [tagSearchQuery, setTagSearchQuery] = createSignal('');
  const [selectedVerification, setSelectedVerification] = createSignal<'all' | 'official' | 'popular'>('all');
  const [sortBy, setSortBy] = createSignal<'name' | 'downloadCount' | 'lastUpdated' | 'starCount'>('downloadCount');
  const [showOnlyFeatured, setShowOnlyFeatured] = createSignal(false);

  // Tab state
  const [activeTab, setActiveTab] = createSignal<'my-servers' | 'catalog' | 'oauth'>('catalog');

  // Connection state
  const [connectingServerId, setConnectingServerId] = createSignal<string | null>(null);
  const [connectedServers, setConnectedServers] = createSignal<Set<string>>(new Set());

  // Pagination state
  const [currentPage, setCurrentPage] = createSignal(1);
  const itemsPerPage = 12;

  // Top 100 most popular SaaS platforms with MCP servers (prioritized by enterprise usage)
  const featuredPlatformIds = [
    // Cloud Infrastructure & Compute
    'mcp-aws-core', 'mcp-aws-bedrock-kb-retrieval', 'mcp-aws-cdk', 'mcp-aws-cost-analysis',
    'mcp-azure-devops', 'mcp-google-cloud', 'mcp-cloudflare', 'mcp-digital-ocean',
    'mcp-vercel', 'mcp-netlify', 'mcp-heroku', 'mcp-railway',

    // Developer Tools & CI/CD
    'mcp-github', 'mcp-gitlab', 'mcp-bitbucket', 'mcp-circleci',
    'mcp-jenkins', 'mcp-buildkite', 'mcp-travis-ci', 'mcp-docker',
    'mcp-kubernetes', 'mcp-terraform', 'mcp-ansible', 'mcp-datadog',

    // Database & Data Tools
    'mcp-mongodb', 'mcp-postgresql', 'mcp-mysql', 'mcp-redis',
    'mcp-elasticsearch', 'mcp-clickhouse', 'mcp-snowflake', 'mcp-databricks',
    'mcp-bigquery', 'mcp-redshift', 'mcp-dynamodb', 'mcp-firebase',

    // Communication & Collaboration
    'mcp-slack', 'mcp-discord', 'mcp-microsoft-teams', 'mcp-zoom',
    'mcp-notion', 'mcp-linear', 'mcp-jira', 'mcp-confluence',
    'mcp-asana', 'mcp-monday', 'mcp-clickup', 'mcp-basecamp',

    // Business & Finance
    'mcp-stripe', 'mcp-paypal', 'mcp-square', 'mcp-chargebee',
    'mcp-quickbooks', 'mcp-xero', 'mcp-freshbooks', 'mcp-braintree',
    'mcp-plaid', 'mcp-wise', 'mcp-coinbase', 'mcp-binance',

    // Marketing & Analytics
    'mcp-google-analytics', 'mcp-segment', 'mcp-mixpanel', 'mcp-amplitude',
    'mcp-hubspot', 'mcp-salesforce', 'mcp-mailchimp', 'mcp-sendgrid',
    'mcp-twilio', 'mcp-intercom', 'mcp-zendesk', 'mcp-freshdesk',

    // Content & Media
    'mcp-youtube', 'mcp-vimeo', 'mcp-spotify', 'mcp-soundcloud',
    'mcp-wordpress', 'mcp-contentful', 'mcp-strapi', 'mcp-sanity',
    'mcp-cloudinary', 'mcp-imgix', 'mcp-mux', 'mcp-wistia',

    // AI & Machine Learning
    'mcp-openai', 'mcp-anthropic', 'mcp-huggingface', 'mcp-replicate',
    'mcp-cohere', 'mcp-stability-ai', 'mcp-midjourney', 'mcp-elevenlabs',

    // Storage & File Management
    'mcp-box', 'mcp-dropbox', 'mcp-google-drive', 'mcp-onedrive',
    'mcp-s3', 'mcp-backblaze', 'mcp-wasabi', 'mcp-aiven',

    // Security & Authentication
    'mcp-auth0', 'mcp-okta', 'mcp-onelogin', 'mcp-duo',
    'mcp-1password', 'mcp-lastpass', 'mcp-vault', 'mcp-cyberark',

    // E-commerce & Retail
    'mcp-shopify', 'mcp-woocommerce', 'mcp-magento', 'mcp-bigcommerce',

    // Automation & Integration
    'mcp-zapier', 'mcp-make', 'mcp-n8n', 'mcp-ifttt',
    'mcp-apify', 'mcp-browserbase', 'mcp-puppeteer', 'mcp-playwright'
  ];

  const featuredServers = createMemo(() => {
    return servers().filter(server => featuredPlatformIds.includes(server.id));
  });

  // Derived state with memos
  const allTags = createMemo(() => {
    const tags = new Set<string>();
    servers().forEach(server => {
      // Add category as a tag
      if (server.category) tags.add(server.category);
      // Add all server tags
      server.tags?.forEach(tag => tags.add(tag));
    });
    return Array.from(tags).sort();
  });

  const filteredTags = createMemo(() => {
    const query = tagSearchQuery().toLowerCase();
    if (!query) return [];
    return allTags().filter(tag =>
      tag.toLowerCase().includes(query)
    ).slice(0, 10); // Limit to 10 suggestions
  });

  const popularTags = createMemo(() => {
    // Common categories that should be shown as quick filter buttons
    const commonTags = [
      'AI', 'Database', 'Analytics', 'Communication', 'Developer Tools',
      'Cloud', 'Storage', 'Security', 'Finance', 'Marketing',
      'Automation', 'E-commerce', 'Media', 'Productivity'
    ];
    return commonTags.filter(tag => allTags().includes(tag));
  });

  const filteredServers = createMemo(() => {
    const query = searchQuery().toLowerCase();
    const tags = selectedTags();
    const verification = selectedVerification();
    const featured = showOnlyFeatured();

    return servers().filter(server => {
      // Featured filter
      if (featured && !featuredPlatformIds.includes(server.id)) {
        return false;
      }

      // Search filter
      const matchesSearch = query === '' ||
        server.name.toLowerCase().includes(query) ||
        server.description.toLowerCase().includes(query) ||
        server.publisher.toLowerCase().includes(query) ||
        server.tags.some(tag => tag.toLowerCase().includes(query));

      // Tag filter - if tags are selected, server must have at least one
      const matchesTags = tags.size === 0 ||
        (server.category && tags.has(server.category)) ||
        server.tags.some(tag => tags.has(tag));

      // Verification filter
      const matchesVerification = verification === 'all' ||
        (verification === 'official' && server.isOfficial) ||
        (verification === 'signed' && server.isSigned) ||
        (verification === 'popular' && server.verificationBadges.includes('popular'));

      return matchesSearch && matchesTags && matchesVerification;
    });
  });

  const sortedServers = createMemo(() => {
    const sort = sortBy();
    // Exclude featured servers from the main list to avoid duplicates
    const nonFeaturedServers = filteredServers().filter(server =>
      !featuredPlatformIds.includes(server.id)
    );

    return [...nonFeaturedServers].sort((a, b) => {
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

  // Pagination logic
  const paginatedServers = createMemo(() => {
    const servers = sortedServers();
    const startIndex = (currentPage() - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return servers.slice(startIndex, endIndex);
  });

  const totalPages = createMemo(() => {
    return Math.ceil(sortedServers().length / itemsPerPage);
  });

  // Load servers data and connection state
  createEffect(() => {
    loadServers();
    loadConnectedServers();
  });

  // Load persisted connection state
  const loadConnectedServers = async () => {
    try {
      if (!dashboardServer.kvStore?.get) {
        console.warn('KV store not available, skipping load');
        return;
      }
      const result = await dashboardServer.kvStore.get('user-connected-mcp-servers');
      if (result.value) {
        const connectionData = typeof result.value === 'string'
          ? JSON.parse(result.value)
          : result.value;

        if (Array.isArray(connectionData)) {
          setConnectedServers(new Set(connectionData));
        }
      }
    } catch (error) {
      console.warn('Failed to load connected servers state:', error);
    }
  };

  // Persist connection state
  const persistConnectedServers = async (connectedSet: Set<string>) => {
    try {
      if (!dashboardServer.kvStore?.set) {
        console.warn('KV store not available, skipping persistence');
        return;
      }
      await dashboardServer.kvStore.set(
        'user-connected-mcp-servers',
        JSON.stringify(Array.from(connectedSet)),
        168 // 7 days TTL
      );
    } catch (error) {
      console.warn('Failed to persist connected servers state:', error);
    }
  };

  const loadServers = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Call MCP Catalog Service through dashboard server
      const result = await dashboardServer.sendMessageWithResponse({
        type: 'mcp_catalog_list',
        payload: { integration: '' }
      });

      if (!result) {
        throw new Error('No response received from MCP catalog service');
      }

      if (result.error) {
        throw new Error(result.error);
      }

      setServers(result.data || []);

      // Emit discovery completed event
      dashboardServer.sendMessage({
        type: 'event_send',
        data: {
          source: 'agent-mesh.mcp.catalog',
          detailType: 'MCP Catalog Discovery Completed',
          detail: {
            serverCount: result.payload?.servers?.length || 0,
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

  const handleToggleTag = (tag: string) => {
    const tags = new Set(selectedTags());
    if (tags.has(tag)) {
      tags.delete(tag);
    } else {
      tags.add(tag);
    }
    setSelectedTags(tags);
  };

  const handleClearTags = () => {
    setSelectedTags(new Set<string>());
    setShowOnlyFeatured(false);
  };

  const handleVerificationFilter = (verification: 'all' | 'official' | 'popular') => {
    setSelectedVerification(verification);
  };

  const handleSortChange = (sort: 'name' | 'downloadCount' | 'lastUpdated' | 'starCount') => {
    setSortBy(sort);
  };

  const handleServerConnect = async (serverId: string) => {
    const server = servers().find(s => s.id === serverId);
    if (!server) return;

    // Check if server requires authentication (either through authMethods or static integration config)
    const requiresAuth = (server.authMethods &&
      server.authMethods.length > 0 &&
      !server.authMethods.includes('none')) ||
      await checkStaticIntegrationRequiresAuth(serverId);

    if (requiresAuth) {
      // Check if authentication credentials exist
      const hasCredentials = await checkAuthenticationCredentials(serverId);

      if (!hasCredentials) {
        // Redirect to OAuth tab for authentication setup
        addNotification({
          type: 'warning',
          title: 'Authentication Required',
          message: `${server.name} requires authentication. Please configure credentials in the OAuth tab first.`
        });
        setActiveTab('oauth');
        return;
      }
    }

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
          authRequired: requiresAuth,
          retryAttempt: 1,
          timestamp: new Date().toISOString()
        }
      }
    });

    try {
      // Get authentication credentials if required
      let authConfig = undefined;
      if (requiresAuth) {
        authConfig = await getAuthenticationCredentials(serverId);
      }

      const result = await dashboardServer.sendMessageWithResponse({
        type: 'mcp_server_connect',
        data: {
          serverId,
          serverConfig: {
            command: server.installCommand,
            name: server.name,
            description: server.description,
            authConfig: authConfig
          }
        }
      });

      if (result.error) {
        throw new Error(result.error);
      }

      const newConnectedServers = new Set([...connectedServers(), serverId]);
      setConnectedServers(newConnectedServers);
      await persistConnectedServers(newConnectedServers);

      // Register the app with the MCP capability registry to create agents and nodes
      await mcpRegistry.registerApp(server, result.capabilities);

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
            authMethod: requiresAuth ? server.authMethods[0] : 'none',
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
            authRequired: requiresAuth,
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
      const result = await dashboardServer.sendMessageWithResponse({
        type: 'mcp_server_disconnect',
        data: { serverId }
      });

      if (result.error) {
        throw new Error(result.error);
      }

      const newConnectedServers = new Set(connectedServers());
      newConnectedServers.delete(serverId);
      setConnectedServers(newConnectedServers);
      await persistConnectedServers(newConnectedServers);

      // Unregister the app from the MCP capability registry
      await mcpRegistry.unregisterApp(serverId);

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

  // Authentication helper functions
  const checkStaticIntegrationRequiresAuth = async (serverId: string): Promise<boolean> => {
    try {
      // Check if there's a static integration configuration for this server
      const integrationKey = `integration-${serverId}`;
      const result = await dashboardServer.kvStore.get(integrationKey);

      if (result?.value) {
        const config = typeof result.value === 'string' ? JSON.parse(result.value) : result.value;
        // Check if the integration has required fields
        return config.fields && config.fields.some((field: any) => field.required);
      }

      return false;
    } catch (error) {
      console.error('Failed to check static integration requirements:', error);
      return false;
    }
  };

  const checkAuthenticationCredentials = async (serverId: string): Promise<boolean> => {
    try {
      // First check OAuth-style credentials
      const connectionIds = ['default', 'work', 'personal', 'backup'];

      for (const connectionId of connectionIds) {
        const key = `user-oauth-${serverId}-${connectionId}`;
        const result = await dashboardServer.kvStore.get(key);
        if (result?.value) {
          return true;
        }
      }

      // Also check static integration-style credentials
      const legacyKey = `user-demo-user-123-integration-${serverId}-default`;
      const legacyResult = await dashboardServer.kvStore.get(legacyKey);
      if (legacyResult?.value &&
          typeof legacyResult.value === 'object' &&
          legacyResult.value.value !== null &&
          legacyResult.value.value !== undefined) {
        return true;
      }

      return false;
    } catch (error) {
      console.error('Failed to check authentication credentials:', error);
      return false;
    }
  };

  const getAuthenticationCredentials = async (serverId: string): Promise<any> => {
    try {
      const connectionIds = ['default', 'work', 'personal', 'backup'];

      for (const connectionId of connectionIds) {
        const key = `user-oauth-${serverId}-${connectionId}`;
        const result = await dashboardServer.kvStore.get(key);
        if (result?.value) {
          const config = typeof result.value === 'string' ? JSON.parse(result.value) : result.value;
          return config.credentials;
        }
      }

      return null;
    } catch (error) {
      console.error('Failed to get authentication credentials:', error);
      return null;
    }
  };

  return (
    <div class="max-w-7xl mx-auto p-6">
      <Show when={isLoading()}>
        <ServerCatalogSkeleton />
      </Show>

      <Show when={error() && !isLoading() && servers().length === 0}>
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

      <Show when={!isLoading() && (!error() || servers().length > 0)}>
        {/* Tabbed Navigation */}
        <div class="border-b border-slate-200 dark:border-slate-700 mb-6">
          <nav class="flex space-x-8" aria-label="MCP Tabs">
            <button
              onClick={() => setActiveTab('my-servers')}
              class={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab() === 'my-servers'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-300'
              }`}
            >
              My servers ({connectedServers().size})
            </button>
            <button
              onClick={() => setActiveTab('catalog')}
              class={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab() === 'catalog'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-300'
              }`}
            >
              Catalog ({servers().length})
            </button>
            <button
              onClick={() => setActiveTab('oauth')}
              class={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab() === 'oauth'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-300'
              }`}
            >
              OAuth
            </button>
          </nav>
        </div>

        {/* Catalog Tab Content */}
        <Show when={activeTab() === 'catalog'}>
          <div class="mb-6">
            <ServerFilters
            searchQuery={searchQuery()}
            selectedTags={selectedTags()}
            tagSearchQuery={tagSearchQuery()}
            filteredTags={filteredTags()}
            popularTags={popularTags()}
            selectedVerification={selectedVerification()}
            sortBy={sortBy()}
            showOnlyFeatured={showOnlyFeatured()}
            serverCount={filteredServers().length}
            totalCount={servers().length}
            onSearch={handleSearch}
            onToggleTag={handleToggleTag}
            onClearTags={handleClearTags}
            onTagSearch={setTagSearchQuery}
            onVerificationFilter={handleVerificationFilter}
            onSortChange={handleSortChange}
            onToggleFeatured={setShowOnlyFeatured}
          />
        </div>

        {/* Featured SaaS Platforms Section */}
        <Show when={featuredServers().length > 0 && !showOnlyFeatured() && searchQuery() === '' && selectedTags().size === 0}>
          <div class="mb-8">
            <div class="flex items-center gap-3 mb-6">
              <div class="flex-shrink-0">
                <div class="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
              </div>
              <div>
                <h2 class="text-xl font-semibold text-slate-900 dark:text-white">Featured SaaS Platforms</h2>
                <p class="text-sm text-slate-600 dark:text-slate-400">Top 100 most popular enterprise platforms with MCP integrations</p>
              </div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              <For each={featuredServers().slice(0, 8)}>
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
            <Show when={featuredServers().length > 8}>
              <div class="mt-4 text-center">
                <button
                  class="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
                  onClick={() => setShowOnlyFeatured(true)}
                >
                  View all {featuredServers().length} featured platforms →
                </button>
              </div>
            </Show>
          </div>
        </Show>

        {/* All Apps Section */}
        <Show when={paginatedServers().length > 0}>
          <div class="mb-6">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-lg font-medium text-slate-900 dark:text-white">
                {showOnlyFeatured() ? 'Featured Platforms' :
                 searchQuery() !== '' || selectedTags().size > 0 ? 'Search Results' : 'All Apps'}
              </h3>
              <div class="text-sm text-slate-600 dark:text-slate-400">
                Page {currentPage()} of {totalPages()} • {sortedServers().length} apps
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              <For each={paginatedServers()}>
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

            {/* Pagination */}
            <Show when={totalPages() > 1}>
              <div class="flex items-center justify-center gap-2 mt-8">
                <button
                  class="px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={currentPage() === 1}
                  onClick={() => setCurrentPage(Math.max(1, currentPage() - 1))}
                >
                  Previous
                </button>

                <For each={Array.from({ length: Math.min(5, totalPages()) }, (_, i) => {
                  const page = Math.max(1, Math.min(totalPages() - 4, currentPage() - 2)) + i;
                  return page <= totalPages() ? page : null;
                }).filter(Boolean)}>
                  {(page) => (
                    <button
                      class={`px-3 py-2 text-sm font-medium rounded-lg ${
                        currentPage() === page
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'
                      }`}
                      onClick={() => setCurrentPage(page!)}
                    >
                      {page}
                    </button>
                  )}
                </For>

                <button
                  class="px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={currentPage() === totalPages()}
                  onClick={() => setCurrentPage(Math.min(totalPages(), currentPage() + 1))}
                >
                  Next
                </button>
              </div>
            </Show>
          </div>
        </Show>

        <Show when={sortedServers().length === 0}>
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
                setSelectedTags(new Set<string>());
                setSelectedVerification('all');
                setShowOnlyFeatured(false);
              }}
            >
              Clear Filters
            </button>
          </div>
        </Show>
        </Show>

        {/* My Servers Tab Content */}
        <Show when={activeTab() === 'my-servers'}>
          <div class="space-y-6">
            <Show when={connectedServers().size === 0}>
              <div class="text-center py-12">
                <svg class="w-16 h-16 mx-auto mb-4 text-slate-400 dark:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <h3 class="text-lg font-medium text-slate-900 dark:text-white mb-2">
                  No servers connected
                </h3>
                <p class="text-slate-600 dark:text-slate-400 mb-4">
                  Connect to MCP servers from the catalog to see them here.
                </p>
                <button
                  class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  onClick={() => setActiveTab('catalog')}
                >
                  Browse Catalog
                </button>
              </div>
            </Show>

            <Show when={connectedServers().size > 0}>
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                <For each={servers().filter(server => connectedServers().has(server.id))}>
                  {(server) => (
                    <MCPServerCard
                      server={server}
                      isConnected={true}
                      isConnecting={connectingServerId() === server.id}
                      onConnect={handleServerConnect}
                      onDisconnect={handleServerDisconnect}
                      onViewDetails={handleServerView}
                    />
                  )}
                </For>
              </div>
            </Show>
          </div>
        </Show>

        {/* OAuth Tab Content */}
        <Show when={activeTab() === 'oauth'}>
          <MCPOAuthManager
            servers={servers()}
            connectedServers={connectedServers()}
            onConnect={handleServerConnect}
            onDisconnect={handleServerDisconnect}
            connectingServerId={connectingServerId()}
          />
        </Show>
      </Show>
    </div>
  );
}