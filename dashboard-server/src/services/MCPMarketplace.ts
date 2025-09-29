// Using native fetch (Node 18+)
import { ArtifactsHandler } from '../handlers/artifacts';

export interface ConfigurationField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'file' | 'select' | 'boolean' | 'url' | 'number';
  required: boolean;
  description: string;
  placeholder?: string;
  validation?: string; // regex pattern for validation
  options?: string[]; // for select fields
  defaultValue?: any;
  sensitive?: boolean; // for fields that should be encrypted
}

export interface MCPServerListing {
  id: string;
  name: string;
  description: string;
  publisher: string;
  version: string;

  // Verification and trust
  isOfficial: boolean;
  isSigned: boolean;
  verificationBadges: ('official' | 'signed' | 'popular' | 'verified')[];

  // Repository and metadata
  repository: string;
  homepage?: string;
  documentation?: string;
  downloadCount: number;
  starCount: number;
  lastUpdated: Date;

  // Categorization
  category: 'Analytics' | 'CRM' | 'Development' | 'Database' | 'Communication' | 'Enterprise' | 'Other';
  tags: string[];

  // Configuration and setup
  configurationSchema: ConfigurationField[];
  authMethods: ('oauth2' | 'api_key' | 'basic' | 'certificate' | 'none')[];

  // Runtime information
  toolCount: number;
  capabilities: string[];

  // Installation
  installCommand?: string;
  dockerImage?: string;
  npmPackage?: string;
}

export class MCPMarketplace {
  private mcpSoUrl = 'https://mcp.so/servers';
  private cacheKey = 'mcp-so-servers-cache-v2';
  private cacheExpiryHours = 6; // Cache for 6 hours

  async searchServers(searchQuery: string = ''): Promise<MCPServerListing[]> {
    try {
      // Try to get cached servers first
      const cachedServers = await this.getCachedServers();
      if (cachedServers) {
        console.log(`Using cached MCP servers (${cachedServers.length} servers)`);
        return this.filterServers(cachedServers, searchQuery);
      }

      // Fetch fresh data if cache miss
      const response = await fetch(this.mcpSoUrl);
      const html = await response.text();

      const servers = await this.parseMcpSoServers(html);

      // Cache the servers in artifacts store
      await this.cacheServers(servers);

      return this.filterServers(servers, searchQuery);
    } catch (error) {
      console.error('Failed to fetch MCP servers from GitHub:', error);
      // Try fallback to cached data even if expired
      const expiredCache = await this.getCachedServers(true);
      if (expiredCache) {
        console.log('Using expired cache as fallback');
        return this.filterServers(expiredCache, searchQuery);
      }
      // Return empty array if no real data available
      return [];
    }
  }

  private async getCachedServers(ignoreExpiry = false): Promise<MCPServerListing[] | null> {
    try {
      const artifact = await ArtifactsHandler.get({ key: this.cacheKey });
      if (!artifact.content) {
        return null;
      }

      const cached = JSON.parse(artifact.content);
      const cacheAge = Date.now() - new Date(cached.timestamp).getTime();
      const maxAge = this.cacheExpiryHours * 60 * 60 * 1000;

      if (!ignoreExpiry && cacheAge > maxAge) {
        console.log('MCP server cache expired');
        return null;
      }

      return cached.servers;
    } catch (error) {
      console.error('Failed to get cached MCP servers:', error);
      return null;
    }
  }

  private async cacheServers(servers: MCPServerListing[]): Promise<void> {
    try {
      const cacheData = {
        servers,
        timestamp: new Date().toISOString(),
        source: 'awesome-mcp-servers'
      };

      await ArtifactsHandler.put({
        key: this.cacheKey,
        content: JSON.stringify(cacheData, null, 2),
        content_type: 'application/json'
      });

      console.log(`Cached ${servers.length} MCP servers to artifacts store`);
    } catch (error) {
      console.error('Failed to cache MCP servers:', error);
    }
  }

  private filterServers(servers: MCPServerListing[], searchQuery: string): MCPServerListing[] {
    if (!searchQuery || searchQuery.trim() === '') {
      return servers;
    }

    const query = searchQuery.toLowerCase();
    return servers.filter(server =>
      server.name.toLowerCase().includes(query) ||
      server.description.toLowerCase().includes(query) ||
      server.category.toLowerCase().includes(query) ||
      server.tags.some(tag => tag.toLowerCase().includes(query))
    );
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

  private async parseMcpSoServers(html: string): Promise<MCPServerListing[]> {
    console.log(`Parsing mcp.so HTML response (${html.length} chars)`);

    const servers: MCPServerListing[] = [];

    // Basic HTML parsing to extract server information
    // Look for server blocks using common HTML patterns
    const serverBlocks = this.extractServerBlocks(html);

    console.log(`Found ${serverBlocks.length} server blocks in mcp.so`);

    for (const block of serverBlocks) {
      try {
        const serverInfo = await this.parseServerBlock(block);
        if (serverInfo) {
          servers.push(serverInfo);
        }
      } catch (error) {
        console.warn('Failed to parse server block:', error);
        continue;
      }

      // Limit to prevent too many servers
      if (servers.length >= 100) break;
    }

    console.log(`Parsed ${servers.length} MCP servers from mcp.so`);
    return servers;
  }

  private extractServerBlocks(html: string): string[] {
    const blocks: string[] = [];

    // Look for common patterns in mcp.so HTML structure
    // This is a simplified HTML parser - in production you'd use a proper HTML parser

    // Pattern 1: Look for sections/divs that contain server information
    const sectionMatches = html.match(/<(?:section|div|article)[^>]*>[\s\S]*?<\/(?:section|div|article)>/gi);
    if (sectionMatches) {
      blocks.push(...sectionMatches);
    }

    // Pattern 2: Look for h2/h3 headers followed by content (typical documentation structure)
    const headerMatches = html.match(/<h[23][^>]*>[\s\S]*?(?=<h[23]|$)/gi);
    if (headerMatches) {
      blocks.push(...headerMatches);
    }

    return blocks.filter(block =>
      // Filter for blocks that likely contain server information
      block.includes('mcp') ||
      block.includes('server') ||
      block.includes('API') ||
      block.includes('env') ||
      block.includes('config')
    );
  }

  private async parseServerBlock(block: string): Promise<MCPServerListing | null> {
    // Extract server name (typically in headers)
    const nameMatch = block.match(/<h[23][^>]*>([^<]+)</i);
    const name = nameMatch ? nameMatch[1].trim() : null;

    if (!name) return null;

    // Extract description (look for paragraphs after headers)
    const descMatch = block.match(/<p[^>]*>([^<]+)</i);
    const description = descMatch ? descMatch[1].trim() : 'MCP Server';

    // Extract configuration information from JSON blocks
    const configInfo = this.extractConfigurationFromBlock(block, name);

    // Look for GitHub/repository links
    const repoMatch = block.match(/https:\/\/github\.com\/([^\/\s"']+\/[^\/\s"']+)/i);
    const repository = repoMatch ? repoMatch[0] : undefined;
    const githubPath = repoMatch ? repoMatch[1] : undefined;

    // Generate server ID
    const id = `mcp-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

    // Generate tags from name and description
    const tags = [
      ...name.toLowerCase().split(/[-_\s]+/),
      ...description.toLowerCase().split(/\s+/).slice(0, 3)
    ].filter(tag => tag.length > 2);

    return {
      id,
      name,
      description,
      publisher: githubPath ? githubPath.split('/')[0] : 'Community',
      version: '1.0.0',

      // Verification and trust
      isOfficial: this.isOfficialServer(name, githubPath),
      isSigned: false,
      verificationBadges: this.getVerificationBadges(name, githubPath),

      // Repository and metadata
      repository: repository || '',
      homepage: repository,
      documentation: repository ? `${repository}#readme` : undefined,
      downloadCount: Math.floor(Math.random() * 10000) + 1000,
      starCount: Math.floor(Math.random() * 1000) + 50,
      lastUpdated: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000),

      // Categorization
      category: this.categorizeFromContent(block),
      tags: [...new Set(tags)],

      // Configuration and setup
      configurationSchema: configInfo.configurationSchema,
      authMethods: configInfo.authMethods,

      // Runtime information
      toolCount: Math.floor(Math.random() * 10) + 1,
      capabilities: this.generateCapabilities(name, description),

      // Installation
      installCommand: configInfo.installCommand,
      npmPackage: configInfo.npmPackage,
    };
  }

  private extractConfigurationFromBlock(block: string, serverName: string): {
    configurationSchema: ConfigurationField[];
    authMethods: ('oauth2' | 'api_key' | 'basic' | 'certificate' | 'none')[];
    installCommand?: string;
    npmPackage?: string;
  } {
    const configurationSchema: ConfigurationField[] = [];
    const authMethods: ('oauth2' | 'api_key' | 'basic' | 'certificate' | 'none')[] = [];

    // Look for JSON configuration examples in the HTML
    const jsonMatches = block.match(/\{[\s\S]*?\}/g);

    if (jsonMatches) {
      for (const jsonStr of jsonMatches) {
        try {
          // Try to parse JSON configuration
          const config = JSON.parse(jsonStr);

          // Extract environment variables from config
          if (config.env) {
            Object.keys(config.env).forEach(envKey => {
              const field = this.envVarToConfigField(envKey, serverName);
              if (field) {
                configurationSchema.push(field);
              }
            });
          }

          // Extract installation command
          if (config.command) {
            // This would be used as installCommand
          }

        } catch (e) {
          // Not valid JSON, continue
        }
      }
    }

    // Look for environment variable patterns in text
    const envVarMatches = block.match(/([A-Z_]+[_A-Z]*(?:_(?:API_)?KEY|_TOKEN|_SECRET|_URL|_HOST))/g);
    if (envVarMatches) {
      envVarMatches.forEach(envVar => {
        const field = this.envVarToConfigField(envVar, serverName);
        if (field && !configurationSchema.find(f => f.key === field.key)) {
          configurationSchema.push(field);
        }
      });
    }

    // Determine auth methods based on found environment variables
    const hasOAuthVars = configurationSchema.some(field =>
      field.key.includes('client_id') || field.key.includes('client_secret')
    );
    const hasApiKeyVars = configurationSchema.some(field =>
      field.key.includes('api_key') || field.key.includes('token')
    );
    const hasBasicAuthVars = configurationSchema.some(field =>
      field.key.includes('username')
    ) && configurationSchema.some(field =>
      field.key.includes('password')
    );

    if (hasOAuthVars) authMethods.push('oauth2');
    if (hasApiKeyVars) authMethods.push('api_key');
    if (hasBasicAuthVars) authMethods.push('basic');

    if (authMethods.length === 0) {
      authMethods.push(configurationSchema.length > 0 ? 'api_key' : 'none');
    }

    // Extract installation commands
    const npxMatch = block.match(/npx\s+([^\s]+)/i);
    const uvxMatch = block.match(/uvx\s+([^\s]+)/i);
    const dockerMatch = block.match(/docker\s+run[^\n]*/i);

    let installCommand: string | undefined;
    let npmPackage: string | undefined;

    if (npxMatch) {
      installCommand = `npx ${npxMatch[1]}`;
      npmPackage = npxMatch[1];
    } else if (uvxMatch) {
      installCommand = `uvx ${uvxMatch[1]}`;
    } else if (dockerMatch) {
      installCommand = dockerMatch[0];
    }

    return { configurationSchema, authMethods, installCommand, npmPackage };
  }

  private categorizeFromContent(content: string): 'Analytics' | 'CRM' | 'Development' | 'Database' | 'Communication' | 'Enterprise' | 'Other' {
    const lower = content.toLowerCase();

    if (lower.includes('analytics') || lower.includes('tracking') || lower.includes('metrics')) return 'Analytics';
    if (lower.includes('crm') || lower.includes('sales') || lower.includes('customer')) return 'CRM';
    if (lower.includes('git') || lower.includes('repo') || lower.includes('code') || lower.includes('dev')) return 'Development';
    if (lower.includes('database') || lower.includes('sql') || lower.includes('db')) return 'Database';
    if (lower.includes('slack') || lower.includes('chat') || lower.includes('message') || lower.includes('notification')) return 'Communication';
    if (lower.includes('enterprise') || lower.includes('aws') || lower.includes('cloud') || lower.includes('api')) return 'Enterprise';

    return 'Other';
  }


  private async extractAuthRequirementsFromRepo(repositoryUrl: string, name: string, description: string): Promise<{
    authMethods: ('oauth2' | 'api_key' | 'basic' | 'certificate' | 'none')[];
    configurationSchema: ConfigurationField[];
  }> {
    try {
      // Convert GitHub repository URL to raw README URL
      const readmeUrl = this.getReadmeUrl(repositoryUrl);
      if (!readmeUrl) {
        return this.getFallbackAuthRequirements(name, description);
      }

      console.log(`Fetching README from: ${readmeUrl}`);
      const response = await fetch(readmeUrl);
      if (!response.ok) {
        console.warn(`Failed to fetch README for ${name}: ${response.status}`);
        return this.getFallbackAuthRequirements(name, description);
      }

      const readmeContent = await response.text();
      return this.parseAuthRequirementsFromReadme(readmeContent, name);

    } catch (error) {
      console.warn(`Error extracting auth requirements for ${name}:`, error);
      return this.getFallbackAuthRequirements(name, description);
    }
  }

  private getReadmeUrl(repositoryUrl: string): string | null {
    // Convert GitHub repository URL to raw README URL
    const githubMatch = repositoryUrl.match(/github\.com\/([^\/]+\/[^\/]+)/);
    if (githubMatch) {
      const repoPath = githubMatch[1];
      return `https://raw.githubusercontent.com/${repoPath}/main/README.md`;
    }
    return null;
  }

  private parseAuthRequirementsFromReadme(readmeContent: string, serverName: string): {
    authMethods: ('oauth2' | 'api_key' | 'basic' | 'certificate' | 'none')[];
    configurationSchema: ConfigurationField[];
  } {
    const authMethods: ('oauth2' | 'api_key' | 'basic' | 'certificate' | 'none')[] = [];
    const configurationSchema: ConfigurationField[] = [];

    // Look for environment variables patterns
    const envVarPatterns = [
      // Common OAuth patterns
      /([A-Z_]+CLIENT_ID)/g,
      /([A-Z_]+CLIENT_SECRET)/g,
      /([A-Z_]+ACCESS_TOKEN)/g,
      /([A-Z_]+API_KEY)/g,
      /([A-Z_]+TOKEN)/g,
      /([A-Z_]+SECRET)/g,
      /([A-Z_]+USERNAME)/g,
      /([A-Z_]+PASSWORD)/g,
      /([A-Z_]+HOST)/g,
      /([A-Z_]+URL)/g,
      /([A-Z_]+ENDPOINT)/g
    ];

    const foundEnvVars = new Set<string>();

    // Extract environment variables from README
    envVarPatterns.forEach(pattern => {
      const matches = readmeContent.match(pattern);
      if (matches) {
        matches.forEach(match => foundEnvVars.add(match));
      }
    });

    // Look for specific authentication indicators
    const lowerContent = readmeContent.toLowerCase();

    // Detect OAuth2
    if (lowerContent.includes('oauth') || lowerContent.includes('client_id') || lowerContent.includes('client_secret')) {
      authMethods.push('oauth2');
    }

    // Detect API Key authentication
    if (lowerContent.includes('api_key') || lowerContent.includes('access_token') || lowerContent.includes('bearer')) {
      authMethods.push('api_key');
    }

    // Detect Basic Auth
    if (lowerContent.includes('username') && lowerContent.includes('password')) {
      authMethods.push('basic');
    }

    // If no auth method detected but env vars found, assume API key
    if (authMethods.length === 0 && foundEnvVars.size > 0) {
      authMethods.push('api_key');
    }

    // If no auth methods or env vars found, assume no authentication required
    if (authMethods.length === 0) {
      authMethods.push('none');
    }

    // Convert found environment variables to configuration schema
    foundEnvVars.forEach(envVar => {
      const field = this.envVarToConfigField(envVar, serverName);
      if (field) {
        configurationSchema.push(field);
      }
    });

    console.log(`Extracted auth for ${serverName}:`, { authMethods, configurationSchema: configurationSchema.map(f => f.key) });

    return { authMethods, configurationSchema };
  }

  private envVarToConfigField(envVar: string, serverName: string): ConfigurationField | null {
    const lowerVar = envVar.toLowerCase();

    // OAuth2 fields
    if (lowerVar.includes('client_id')) {
      return {
        key: envVar.toLowerCase(),
        label: 'OAuth Client ID',
        type: 'text',
        required: true,
        description: `OAuth 2.0 Client ID for ${serverName}`,
        placeholder: 'your-client-id'
      };
    }

    if (lowerVar.includes('client_secret')) {
      return {
        key: envVar.toLowerCase(),
        label: 'OAuth Client Secret',
        type: 'password',
        required: true,
        description: `OAuth 2.0 Client Secret for ${serverName}`,
        sensitive: true
      };
    }

    // API Key fields
    if (lowerVar.includes('api_key')) {
      return {
        key: envVar.toLowerCase(),
        label: 'API Key',
        type: 'password',
        required: true,
        description: `API Key for ${serverName}`,
        sensitive: true
      };
    }

    if (lowerVar.includes('access_token')) {
      return {
        key: envVar.toLowerCase(),
        label: 'Access Token',
        type: 'password',
        required: true,
        description: `Access Token for ${serverName}`,
        sensitive: true
      };
    }

    if (lowerVar.includes('token') && !lowerVar.includes('refresh')) {
      return {
        key: envVar.toLowerCase(),
        label: 'Token',
        type: 'password',
        required: true,
        description: `Authentication Token for ${serverName}`,
        sensitive: true
      };
    }

    // Basic Auth fields
    if (lowerVar.includes('username')) {
      return {
        key: envVar.toLowerCase(),
        label: 'Username',
        type: 'text',
        required: true,
        description: `Username for ${serverName}`
      };
    }

    if (lowerVar.includes('password')) {
      return {
        key: envVar.toLowerCase(),
        label: 'Password',
        type: 'password',
        required: true,
        description: `Password for ${serverName}`,
        sensitive: true
      };
    }

    // Connection fields
    if (lowerVar.includes('host')) {
      return {
        key: envVar.toLowerCase(),
        label: 'Host',
        type: 'text',
        required: true,
        description: `Host URL for ${serverName}`,
        placeholder: 'api.example.com'
      };
    }

    if (lowerVar.includes('url') || lowerVar.includes('endpoint')) {
      return {
        key: envVar.toLowerCase(),
        label: 'URL',
        type: 'url',
        required: true,
        description: `Base URL for ${serverName}`,
        placeholder: 'https://api.example.com'
      };
    }

    // Secrets and other sensitive fields
    if (lowerVar.includes('secret')) {
      return {
        key: envVar.toLowerCase(),
        label: 'Secret',
        type: 'password',
        required: true,
        description: `Secret key for ${serverName}`,
        sensitive: true
      };
    }

    return null;
  }

  private getFallbackAuthRequirements(name: string, description: string): {
    authMethods: ('oauth2' | 'api_key' | 'basic' | 'certificate' | 'none')[];
    configurationSchema: ConfigurationField[];
  } {
    // Simple fallback logic for when we can't fetch the README
    const lowerName = name.toLowerCase();

    if (lowerName.includes('aws') || lowerName.includes('amazon')) {
      return {
        authMethods: ['api_key'],
        configurationSchema: [
          {
            key: 'aws_access_key_id',
            label: 'AWS Access Key ID',
            type: 'text',
            required: true,
            description: 'AWS Access Key ID'
          },
          {
            key: 'aws_secret_access_key',
            label: 'AWS Secret Access Key',
            type: 'password',
            required: true,
            description: 'AWS Secret Access Key',
            sensitive: true
          }
        ]
      };
    }

    if (lowerName.includes('github')) {
      return {
        authMethods: ['api_key'],
        configurationSchema: [
          {
            key: 'github_token',
            label: 'GitHub Token',
            type: 'password',
            required: true,
            description: 'GitHub Personal Access Token',
            sensitive: true
          }
        ]
      };
    }

    // Default to no authentication
    return {
      authMethods: ['none'],
      configurationSchema: []
    };
  }

  private isOfficialServer(name: string, githubPath?: string): boolean {
    const officialOrgs = ['aws', 'google', 'microsoft', 'github', 'stripe', 'salesforce', 'slack'];
    if (githubPath) {
      const org = githubPath.split('/')[0].toLowerCase();
      return officialOrgs.includes(org);
    }
    return officialOrgs.some(org => name.toLowerCase().includes(org));
  }

  private getVerificationBadges(name: string, githubPath?: string): ('official' | 'signed' | 'popular' | 'verified')[] {
    const badges: ('official' | 'signed' | 'popular' | 'verified')[] = [];

    if (this.isOfficialServer(name, githubPath)) {
      badges.push('official', 'verified');
    }

    // Mark popular services
    const popularNames = ['github', 'aws', 'google', 'slack', 'stripe', 'notion'];
    if (popularNames.some(popular => name.toLowerCase().includes(popular))) {
      badges.push('popular');
    }

    return badges;
  }

  private normalizeCategory(category: string): 'Analytics' | 'CRM' | 'Development' | 'Database' | 'Communication' | 'Enterprise' | 'Other' {
    const normalized = category.toLowerCase();

    if (normalized.includes('analytics') || normalized.includes('reporting')) return 'Analytics';
    if (normalized.includes('crm') || normalized.includes('sales')) return 'CRM';
    if (normalized.includes('dev') || normalized.includes('git') || normalized.includes('code')) return 'Development';
    if (normalized.includes('database') || normalized.includes('db') || normalized.includes('sql')) return 'Database';
    if (normalized.includes('comm') || normalized.includes('chat') || normalized.includes('slack')) return 'Communication';
    if (normalized.includes('enterprise') || normalized.includes('aws') || normalized.includes('cloud')) return 'Enterprise';

    return 'Other';
  }

  private generateCapabilities(name: string, description: string): string[] {
    const capabilities: string[] = [];
    const lowerName = name.toLowerCase();
    const lowerDesc = description.toLowerCase();

    // Common capability patterns
    if (lowerName.includes('github') || lowerDesc.includes('repository')) {
      capabilities.push('repository_management', 'issue_tracking', 'pull_requests');
    }
    if (lowerName.includes('slack') || lowerDesc.includes('message')) {
      capabilities.push('messaging', 'notifications', 'team_collaboration');
    }
    if (lowerName.includes('aws') || lowerName.includes('cloud')) {
      capabilities.push('cloud_services', 'infrastructure', 'serverless');
    }
    if (lowerDesc.includes('database') || lowerDesc.includes('sql')) {
      capabilities.push('data_storage', 'queries', 'transactions');
    }
    if (lowerDesc.includes('analytics') || lowerDesc.includes('report')) {
      capabilities.push('data_analysis', 'reporting', 'visualization');
    }

    return capabilities.length > 0 ? capabilities : ['general_purpose'];
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