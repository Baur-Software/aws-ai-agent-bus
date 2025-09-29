import {
  MCPServerListing,
  MCPServerConnection,
  CatalogResponse,
  ServerDetailsResponse,
  MCPCatalogFilters,
  MCPCatalogSort,
  MCPCatalogRegistry,
  ConfigurationField
} from '../types/mcpCatalog';

/**
 * Service for fetching MCP servers from external catalogs
 * Integrates with registries like mcpservers.org and official sources
 */
export class MCPCatalogService {
  private static instance: MCPCatalogService;
  private cache = new Map<string, { data: any; expires: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  // Known registries for MCP servers
  private readonly OFFICIAL_REGISTRIES: MCPCatalogRegistry[] = [
    {
      name: 'MCP Servers Registry',
      url: 'https://mcpservers.org/api',
      description: 'Official MCP servers registry',
      isOfficial: true
    },
    {
      name: 'Docker Hub MCP',
      url: 'https://hub.docker.com/v2/repositories',
      description: 'MCP servers available as Docker images',
      isOfficial: false
    },
    {
      name: 'GitHub MCP Registry',
      url: 'https://api.github.com/search/repositories',
      description: 'MCP servers hosted on GitHub',
      isOfficial: false
    }
  ];

  // Official organizations/publishers that we trust
  private readonly OFFICIAL_PUBLISHERS = [
    'anthropic',
    'microsoft',
    'google',
    'github',
    'atlassian',
    'hubspot',
    'docker',
    'aws',
    'openai'
  ];

  static getInstance(): MCPCatalogService {
    if (!MCPCatalogService.instance) {
      MCPCatalogService.instance = new MCPCatalogService();
    }
    return MCPCatalogService.instance;
  }

  /**
   * Fetch MCP servers from all known registries
   */
  async fetchServerCatalog(
    filters?: MCPCatalogFilters,
    sort?: MCPCatalogSort,
    page = 1,
    limit = 50
  ): Promise<CatalogResponse> {
    const cacheKey = `catalog_${JSON.stringify({ filters, sort, page, limit })}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      // Fetch from multiple sources and merge
      const [mockServers, githubServers, dockerServers] = await Promise.allSettled([
        this.fetchMockRegistry(filters, sort, page, limit),
        this.fetchFromGitHub(filters?.search),
        this.fetchFromDockerHub(filters?.search)
      ]);

      let servers: MCPServerListing[] = [];

      // Process mock registry (placeholder for mcpservers.org)
      if (mockServers.status === 'fulfilled') {
        servers.push(...mockServers.value);
      }

      // Process GitHub results
      if (githubServers.status === 'fulfilled') {
        servers.push(...githubServers.value);
      }

      // Process Docker Hub results
      if (dockerServers.status === 'fulfilled') {
        servers.push(...dockerServers.value);
      }

      // Apply client-side filtering and sorting
      servers = this.applyFilters(servers, filters);
      servers = this.applySort(servers, sort);

      // Paginate
      const start = (page - 1) * limit;
      const paginatedServers = servers.slice(start, start + limit);

      const response: CatalogResponse = {
        servers: paginatedServers,
        total: servers.length,
        page,
        limit,
        registries: this.OFFICIAL_REGISTRIES
      };

      this.setCache(cacheKey, response);
      return response;

    } catch (error) {
      console.error('Failed to fetch server catalog:', error);
      throw new Error('Failed to load MCP server catalog');
    }
  }

  /**
   * Get detailed information about a specific server
   */
  async getServerDetails(serverId: string): Promise<ServerDetailsResponse> {
    const cacheKey = `server_${serverId}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      // Try to fetch from multiple sources
      const server = await this.fetchServerFromRegistry(serverId);

      // Enhance with additional details
      const details: ServerDetailsResponse = {
        ...server,
        readme: await this.fetchReadme(server.repository),
        changelog: await this.fetchChangelog(server.repository),
        dependencies: await this.fetchDependencies(server.repository),
        screenshots: await this.fetchScreenshots(server.repository)
      };

      this.setCache(cacheKey, details);
      return details;

    } catch (error) {
      console.error(`Failed to fetch server details for ${serverId}:`, error);
      throw new Error(`Failed to load details for server ${serverId}`);
    }
  }

  /**
   * Mock registry for demonstration (replace with real mcpservers.org API)
   */
  private async fetchMockRegistry(
    filters?: MCPCatalogFilters,
    sort?: MCPCatalogSort,
    page = 1,
    limit = 50
  ): Promise<MCPServerListing[]> {
    // Mock data representing what we'd get from mcpservers.org
    const mockServers: MCPServerListing[] = [
      {
        id: 'github-official',
        name: 'GitHub Official',
        description: 'Official GitHub MCP Server. Provides seamless integration with GitHub APIs, enabling advanced automation and interaction.',
        publisher: 'github',
        version: '1.2.3',
        isOfficial: true,
        isSigned: true,
        verificationBadges: ['official', 'signed', 'popular'],
        repository: 'https://github.com/github/github-mcp',
        homepage: 'https://github.com/mcp',
        documentation: 'https://docs.github.com/mcp',
        downloadCount: 50000,
        starCount: 1200,
        lastUpdated: new Date('2024-01-15'),
        category: 'Development',
        tags: ['git', 'repositories', 'issues', 'automation'],
        configurationSchema: [
          {
            key: 'github_token',
            label: 'GitHub Personal Access Token',
            type: 'password',
            required: true,
            description: 'Personal access token with appropriate permissions for repository access',
            sensitive: true
          },
          {
            key: 'default_org',
            label: 'Default Organization',
            type: 'text',
            required: false,
            description: 'Default GitHub organization for operations'
          }
        ],
        authMethods: ['oauth2', 'api_key'],
        toolCount: 96,
        capabilities: ['repositories', 'issues', 'pull-requests', 'actions', 'webhooks'],
        dockerImage: 'ghcr.io/github/github-mcp:latest'
      },
      {
        id: 'hubspot-official',
        name: 'HubSpot Official',
        description: 'Official HubSpot MCP Server for CRM integration, contact management, and marketing automation.',
        publisher: 'hubspot',
        version: '2.1.0',
        isOfficial: true,
        isSigned: true,
        verificationBadges: ['official', 'signed'],
        repository: 'https://github.com/hubspot/hubspot-mcp',
        homepage: 'https://developers.hubspot.com/mcp',
        downloadCount: 25000,
        starCount: 800,
        lastUpdated: new Date('2024-01-10'),
        category: 'CRM',
        tags: ['crm', 'contacts', 'deals', 'email', 'marketing'],
        configurationSchema: [
          {
            key: 'hubspot_api_key',
            label: 'HubSpot Private App Token',
            type: 'password',
            required: true,
            description: 'Private app access token from HubSpot developer settings',
            sensitive: true
          },
          {
            key: 'portal_id',
            label: 'Portal ID',
            type: 'text',
            required: true,
            description: 'Your HubSpot portal/account ID'
          }
        ],
        authMethods: ['oauth2', 'api_key'],
        toolCount: 45,
        capabilities: ['contacts', 'deals', 'companies', 'email', 'workflows'],
        npmPackage: '@hubspot/mcp-server'
      },
      {
        id: 'atlassian-official',
        name: 'Atlassian Official',
        description: 'Official Atlassian MCP Server for Jira and Confluence integration.',
        publisher: 'atlassian',
        version: '1.5.2',
        isOfficial: true,
        isSigned: true,
        verificationBadges: ['official', 'signed', 'verified'],
        repository: 'https://github.com/atlassian/atlassian-mcp',
        downloadCount: 37000,
        starCount: 950,
        lastUpdated: new Date('2024-01-12'),
        category: 'Enterprise',
        tags: ['jira', 'confluence', 'project-management', 'documentation'],
        configurationSchema: [
          {
            key: 'atlassian_domain',
            label: 'Atlassian Domain',
            type: 'url',
            required: true,
            description: 'Your Atlassian domain (e.g., yourcompany.atlassian.net)',
            placeholder: 'https://yourcompany.atlassian.net'
          },
          {
            key: 'api_token',
            label: 'API Token',
            type: 'password',
            required: true,
            description: 'Atlassian API token from your account settings',
            sensitive: true
          },
          {
            key: 'username',
            label: 'Username',
            type: 'text',
            required: true,
            description: 'Your Atlassian username (email address)'
          }
        ],
        authMethods: ['api_key', 'oauth2'],
        toolCount: 37,
        capabilities: ['jira-issues', 'confluence-pages', 'project-management']
      },
      {
        id: 'community-weather',
        name: 'Weather API Server',
        description: 'Community-built MCP server for weather data and forecasting.',
        publisher: 'weather-dev',
        version: '0.3.1',
        isOfficial: false,
        isSigned: false,
        verificationBadges: ['popular'],
        repository: 'https://github.com/weather-dev/weather-mcp',
        downloadCount: 5000,
        starCount: 120,
        lastUpdated: new Date('2023-12-20'),
        category: 'Other',
        tags: ['weather', 'api', 'forecast', 'location'],
        configurationSchema: [
          {
            key: 'api_key',
            label: 'Weather API Key',
            type: 'password',
            required: true,
            description: 'API key from your weather service provider',
            sensitive: true
          },
          {
            key: 'default_units',
            label: 'Default Units',
            type: 'select',
            required: false,
            description: 'Default temperature units',
            options: ['celsius', 'fahrenheit', 'kelvin'],
            defaultValue: 'celsius'
          }
        ],
        authMethods: ['api_key'],
        toolCount: 8,
        capabilities: ['current-weather', 'forecast', 'alerts']
      }
    ];

    return mockServers;
  }

  /**
   * Fetch MCP servers from GitHub (search for repos with mcp topics)
   */
  private async fetchFromGitHub(searchTerm?: string): Promise<MCPServerListing[]> {
    try {
      const query = `topic:mcp topic:model-context-protocol${searchTerm ? ` ${searchTerm}` : ''}`;
      const response = await fetch(
        `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=20`
      );

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
      }

      const data = await response.json();

      return data.items.map((repo: any): MCPServerListing => ({
        id: `github-${repo.id}`,
        name: repo.name,
        description: repo.description || 'No description available',
        publisher: repo.owner.login,
        version: 'latest',
        isOfficial: this.OFFICIAL_PUBLISHERS.includes(repo.owner.login.toLowerCase()),
        isSigned: false,
        verificationBadges: this.getVerificationBadges(repo),
        repository: repo.html_url,
        homepage: repo.homepage,
        downloadCount: repo.forks_count * 10, // Estimate
        starCount: repo.stargazers_count,
        lastUpdated: new Date(repo.updated_at),
        category: this.categorizeRepo(repo),
        tags: repo.topics || [],
        configurationSchema: [], // Would need to fetch from repo
        authMethods: ['api_key'], // Default assumption
        toolCount: 0, // Would need to analyze repo
        capabilities: []
      }));

    } catch (error) {
      console.warn('Failed to fetch from GitHub:', error);
      return [];
    }
  }

  /**
   * Fetch MCP servers from Docker Hub
   */
  private async fetchFromDockerHub(searchTerm?: string): Promise<MCPServerListing[]> {
    try {
      const query = searchTerm ? `mcp ${searchTerm}` : 'mcp';
      const response = await fetch(
        `https://hub.docker.com/v2/search/repositories/?page_size=20&query=${encodeURIComponent(query)}`
      );

      if (!response.ok) {
        throw new Error(`Docker Hub API error: ${response.status}`);
      }

      const data = await response.json();

      return data.results.map((repo: any): MCPServerListing => ({
        id: `docker-${repo.repo_name.replace('/', '-')}`,
        name: repo.repo_name,
        description: repo.short_description || 'No description available',
        publisher: repo.repo_name.split('/')[0],
        version: 'latest',
        isOfficial: repo.is_official || this.OFFICIAL_PUBLISHERS.includes(repo.repo_name.split('/')[0].toLowerCase()),
        isSigned: repo.is_official,
        verificationBadges: repo.is_official ? ['official', 'signed'] : [],
        repository: `https://hub.docker.com/r/${repo.repo_name}`,
        downloadCount: repo.pull_count || 0,
        starCount: repo.star_count || 0,
        lastUpdated: new Date(),
        category: 'Other',
        tags: [],
        configurationSchema: [], // Would need to fetch from image
        authMethods: ['none'], // Default assumption
        toolCount: 0,
        capabilities: [],
        dockerImage: repo.repo_name
      }));

    } catch (error) {
      console.warn('Failed to fetch from Docker Hub:', error);
      return [];
    }
  }

  /**
   * Placeholder for fetching from actual server registry
   */
  private async fetchServerFromRegistry(serverId: string): Promise<MCPServerListing> {
    // This would fetch from mcpservers.org or similar
    const catalog = await this.fetchMockRegistry();
    const server = catalog.find(s => s.id === serverId);
    if (!server) {
      throw new Error(`Server ${serverId} not found`);
    }
    return server;
  }

  // Helper methods for processing and categorizing
  private getVerificationBadges(repo: any): ('official' | 'signed' | 'popular' | 'verified')[] {
    const badges: ('official' | 'signed' | 'popular' | 'verified')[] = [];

    if (this.OFFICIAL_PUBLISHERS.includes(repo.owner.login.toLowerCase())) {
      badges.push('official', 'verified');
    }

    if (repo.stargazers_count > 100) {
      badges.push('popular');
    }

    return badges;
  }

  private categorizeRepo(repo: any): MCPServerListing['category'] {
    const name = repo.name.toLowerCase();
    const description = (repo.description || '').toLowerCase();
    const topics = repo.topics || [];

    if (topics.includes('crm') || name.includes('hubspot') || name.includes('salesforce')) {
      return 'CRM';
    }
    if (topics.includes('analytics') || name.includes('analytics') || name.includes('metrics')) {
      return 'Analytics';
    }
    if (topics.includes('database') || name.includes('db') || name.includes('mongo') || name.includes('postgres')) {
      return 'Database';
    }
    if (topics.includes('chat') || topics.includes('communication') || name.includes('slack') || name.includes('discord')) {
      return 'Communication';
    }
    if (name.includes('github') || name.includes('git') || topics.includes('development')) {
      return 'Development';
    }
    if (topics.includes('enterprise') || name.includes('enterprise')) {
      return 'Enterprise';
    }

    return 'Other';
  }

  private applyFilters(servers: MCPServerListing[], filters?: MCPCatalogFilters): MCPServerListing[] {
    if (!filters) return servers;

    return servers.filter(server => {
      if (filters.category && server.category !== filters.category) return false;
      if (filters.verified !== undefined && !server.verificationBadges.includes('verified') !== !filters.verified) return false;
      if (filters.official !== undefined && server.isOfficial !== filters.official) return false;
      if (filters.search && !this.matchesSearch(server, filters.search)) return false;
      if (filters.tags?.length && !filters.tags.some(tag => server.tags.includes(tag))) return false;
      if (filters.authMethods?.length && !filters.authMethods.some(method => server.authMethods.includes(method as any))) return false;

      return true;
    });
  }

  private matchesSearch(server: MCPServerListing, search: string): boolean {
    const searchLower = search.toLowerCase();
    return (
      server.name.toLowerCase().includes(searchLower) ||
      server.description.toLowerCase().includes(searchLower) ||
      server.publisher.toLowerCase().includes(searchLower) ||
      server.tags.some(tag => tag.toLowerCase().includes(searchLower))
    );
  }

  private applySort(servers: MCPServerListing[], sort?: MCPCatalogSort): MCPServerListing[] {
    if (!sort) return servers;

    return [...servers].sort((a, b) => {
      let aVal, bVal;

      switch (sort.field) {
        case 'name':
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case 'downloadCount':
          aVal = a.downloadCount;
          bVal = b.downloadCount;
          break;
        case 'starCount':
          aVal = a.starCount;
          bVal = b.starCount;
          break;
        case 'lastUpdated':
          aVal = a.lastUpdated.getTime();
          bVal = b.lastUpdated.getTime();
          break;
        case 'popularity':
          aVal = a.downloadCount + a.starCount * 10;
          bVal = b.downloadCount + b.starCount * 10;
          break;
        default:
          return 0;
      }

      const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sort.direction === 'desc' ? -comparison : comparison;
    });
  }

  // Placeholder methods for fetching additional details
  private async fetchReadme(repository: string): Promise<string> {
    // Would fetch README.md from the repository
    return 'README content would be fetched from the repository...';
  }

  private async fetchChangelog(repository: string): Promise<string[]> {
    // Would fetch CHANGELOG.md or releases from the repository
    return ['v1.0.0: Initial release', 'v1.1.0: Added new features'];
  }

  private async fetchDependencies(repository: string): Promise<string[]> {
    // Would parse package.json, requirements.txt, etc.
    return ['express', 'axios', 'dotenv'];
  }

  private async fetchScreenshots(repository: string): Promise<string[]> {
    // Would look for screenshots in repository
    return [];
  }

  // Cache management
  private getFromCache(key: string): any {
    const cached = this.cache.get(key);
    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, {
      data,
      expires: Date.now() + this.CACHE_TTL
    });
  }
}

export default MCPCatalogService.getInstance();