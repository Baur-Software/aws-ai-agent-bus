import fetch from 'node-fetch';

export interface MCPServerListing {
  id: string;
  name: string;
  description: string;
  author: string;
  category: string;
  tags: string[];
  npmPackage?: string;
  repository?: string;
  rating?: number;
  downloads?: number;
}

export class MCPMarketplace {
  private baseUrl = 'https://mcpservers.org';

  async searchServers(searchQuery: string = ''): Promise<MCPServerListing[]> {
    try {
      const url = `${this.baseUrl}?query=${encodeURIComponent(searchQuery)}`;
      const response = await fetch(url);
      const html = await response.text();

      return this.parseServerListings(html);
    } catch (error) {
      console.error('Failed to fetch MCP servers:', error);
      return [];
    }
  }

  async getFeaturedServers(): Promise<MCPServerListing[]> {
    try {
      // Use a broad search query to get featured/popular servers
      return this.searchServers('popular');
    } catch (error) {
      console.error('Failed to fetch featured MCP servers:', error);
      return [];
    }
  }

  private parseServerListings(html: string): MCPServerListing[] {
    console.log(`Parsing HTML response (${html.length} chars)`);

    // Since mcpservers.org is a client-side React app, the server listings
    // are not available in the initial HTML. For demo purposes, return
    // sample MCP servers that would commonly be searched for.

    // In production, this would either:
    // 1. Use a headless browser to render the React app
    // 2. Call an API endpoint if available
    // 3. Maintain a curated list of popular MCP servers

    return this.getSampleServers();
  }

  private getSampleServers(): MCPServerListing[] {
    return [
      {
        id: 'mcp-salesforce',
        name: 'Salesforce MCP Server',
        description: 'Connect to Salesforce CRM for lead management, opportunity tracking, and customer data.',
        author: 'Salesforce',
        category: 'CRM',
        tags: ['salesforce', 'crm', 'leads', 'opportunities'],
        repository: 'https://github.com/salesforce/mcp-server',
        rating: 4.8,
        downloads: 12500
      },
      {
        id: 'mcp-github',
        name: 'GitHub MCP Server',
        description: 'Integrate with GitHub for repository management, issues, pull requests, and actions.',
        author: 'GitHub',
        category: 'Development',
        tags: ['github', 'git', 'repositories', 'ci-cd'],
        repository: 'https://github.com/github/mcp-server',
        rating: 4.9,
        downloads: 25000
      },
      {
        id: 'mcp-business-tools',
        name: 'Business Analytics MCP',
        description: 'Business intelligence and analytics tools for data visualization and reporting.',
        author: 'Business Tools Inc',
        category: 'Analytics',
        tags: ['business', 'analytics', 'reporting', 'data'],
        repository: 'https://github.com/business-tools/mcp-server',
        rating: 4.5,
        downloads: 8500
      }
    ];
  }

  async getServersByCategory(category: string): Promise<MCPServerListing[]> {
    return this.searchServers(category);
  }

  async getPopularServers(): Promise<MCPServerListing[]> {
    // Get commonly searched integrations
    const popularQueries = [
      'salesforce', 'github', 'slack', 'notion',
      'stripe', 'google', 'aws', 'database'
    ];

    const allServers: MCPServerListing[] = [];

    for (const query of popularQueries) {
      const servers = await this.searchServers(query);
      allServers.push(...servers);
    }

    // Remove duplicates and return top results
    const uniqueServers = allServers.filter((server, index, self) =>
      self.findIndex(s => s.name === server.name) === index
    );

    return uniqueServers.slice(0, 20);
  }
}

export const mcpMarketplace = new MCPMarketplace();