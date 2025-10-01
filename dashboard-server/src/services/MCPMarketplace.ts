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
  private awesomeServersUrl = 'https://raw.githubusercontent.com/punkpeye/awesome-mcp-servers/main/README.md';
  private cacheKey = 'awesome-mcp-servers-cache-v5'; // v5: Added detailed node/agent info with icons, descriptions, expertise
  private cacheExpiryHours = 6; // Cache for 6 hours

  async searchServers(searchQuery: string = ''): Promise<MCPServerListing[]> {
    try {
      // Try to get cached servers first
      const cachedServers = await this.getCachedServers();
      if (cachedServers) {
        console.log(`Using cached MCP servers (${cachedServers.length} servers)`);
        return this.filterServers(cachedServers, searchQuery);
      }

      // Fetch fresh data from awesome-mcp-servers GitHub
      const response = await fetch(this.awesomeServersUrl);
      const markdown = await response.text();

      const servers = await this.parseAwesomeMcpServers(markdown);

      // Cache the servers in artifacts store
      await this.cacheServers(servers);

      console.log(`Fetched and cached ${servers.length} MCP servers from awesome-mcp-servers`);
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

  private async parseAwesomeMcpServers(markdown: string): Promise<MCPServerListing[]> {
    console.log(`Parsing awesome-mcp-servers markdown (${markdown.length} chars)`);

    const servers: MCPServerListing[] = [];
    let currentCategory = 'Other';

    // Parse markdown line by line
    const lines = markdown.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Category headers (## Category Name)
      if (line.startsWith('## ') && !line.includes('Table of Contents') && !line.includes('Contributing')) {
        currentCategory = line.replace('## ', '').trim();
        continue;
      }

      // Server entries (- [Name](link) - Description)
      const serverMatch = line.match(/^-\s+\[([^\]]+)\]\(([^)]+)\)\s*-?\s*(.*)$/);
      if (serverMatch) {
        const [, name, url, description] = serverMatch;

        try {
          const server = await this.createServerFromMarkdownEntry(
            name,
            url,
            description,
            currentCategory
          );

          if (server) {
            servers.push(server);
          }
        } catch (error) {
          console.warn(`Failed to parse server: ${name}`, error);
        }
      }
    }

    console.log(`Parsed ${servers.length} MCP servers from awesome-mcp-servers (${new Set(servers.map(s => s.category)).size} categories)`);
    return servers;
  }

  private async createServerFromMarkdownEntry(
    name: string,
    url: string,
    description: string,
    category: string
  ): Promise<MCPServerListing | null> {
    // Extract repository URL (GitHub)
    const githubMatch = url.match(/github\.com\/([^\/]+\/[^\/]+)/);
    const repository = githubMatch ? `https://github.com/${githubMatch[1]}` : url;
    const githubPath = githubMatch ? githubMatch[1] : undefined;
    const publisher = githubPath ? githubPath.split('/')[0] : 'Community';

    // Generate server ID
    const id = `mcp-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

    // Check official status
    const isOfficial = this.isOfficialServer(name, githubPath);
    const verificationBadges = this.getVerificationBadges(name, githubPath);

    // Generate tags from name and description
    const baseTags = [
      ...name.toLowerCase().split(/[-_\s]+/),
      ...description.toLowerCase().split(/\s+/).slice(0, 5),
      category.toLowerCase()
    ].filter(tag => tag.length > 2 && !['mcp', 'server', 'the', 'and', 'for', 'with'].includes(tag));

    // Add verification tags for filtering
    const verificationTags = [];
    if (isOfficial) {
      verificationTags.push('official', 'verified');
    } else {
      verificationTags.push('community');
    }

    // Add badge tags
    if (verificationBadges.includes('popular')) {
      verificationTags.push('popular');
    }

    const tags = [...new Set([...verificationTags, ...baseTags])].slice(0, 15);
    const capabilities = this.generateCapabilities(name, description);
    const workflowIntegration = this.calculateWorkflowIntegration(name, description, capabilities);

    return {
      id,
      name,
      description: description || 'MCP Server',
      publisher,
      version: '1.0.0',

      // Verification and trust
      isOfficial,
      isSigned: false,
      verificationBadges,

      // Repository and metadata
      repository,
      homepage: repository,
      documentation: repository ? `${repository}#readme` : undefined,
      downloadCount: 0, // Would need to fetch from npm/GitHub API
      starCount: 0, // Would need to fetch from GitHub API
      lastUpdated: new Date(),

      // Categorization
      category: this.normalizeCategory(category),
      tags,

      // Configuration - would need to fetch README
      configurationSchema: [],
      authMethods: ['none'],

      // Runtime information
      toolCount: 0,
      capabilities,

      // Workflow integration
      workflowNodes: workflowIntegration.workflowNodes,
      workflowNodeDetails: workflowIntegration.workflowNodeDetails,
      specializedAgents: workflowIntegration.specializedAgents,
      specializedAgentDetails: workflowIntegration.specializedAgentDetails,
      nodeShapes: workflowIntegration.nodeShapes,
      canExecuteAgents: workflowIntegration.canExecuteAgents,
      dataInputTypes: workflowIntegration.dataInputTypes,
      dataOutputTypes: workflowIntegration.dataOutputTypes,

      // Installation
      installCommand: undefined,
      npmPackage: undefined,
      dockerImage: undefined
    };
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
    if (!githubPath) return false;

    const org = githubPath.split('/')[0].toLowerCase();
    const repoName = githubPath.split('/')[1]?.toLowerCase() || '';

    // Official MCP organization
    if (org === 'modelcontextprotocol') {
      return true;
    }

    // Extract the core service name from the MCP server name
    // e.g., "GitHub MCP Server" -> "github", "Slack Integration" -> "slack"
    const normalizedName = name.toLowerCase()
      .replace(/\bmcp\b/g, '')
      .replace(/\bserver\b/g, '')
      .replace(/\bintegration\b/g, '')
      .replace(/\bofficial\b/g, '')
      .replace(/[-_\s]+/g, ' ')
      .trim();

    // Get significant words (longer than 2 chars)
    const nameWords = normalizedName.split(/\s+/).filter(w => w.length > 2);

    // Check if the GitHub org exactly matches any word in the service name
    // This catches: "github/..." for "GitHub MCP", "stripe/..." for "Stripe Integration"
    for (const word of nameWords) {
      if (org === word) {
        return true;
      }

      // Also check common variations
      const variations = [
        word,
        `${word}api`,
        `${word}inc`,
        `${word}hq`,
        `${word}labs`,
        word.replace('hub', ''), // githubapi -> gitapi
        word.endsWith('api') ? word.slice(0, -3) : null
      ].filter(Boolean);

      if (variations.includes(org)) {
        return true;
      }
    }

    // Check if the repo name starts with the org name (canonical pattern)
    // e.g., "stripe/stripe-mcp-server" or "github/github-integration"
    if (repoName.startsWith(org) || repoName.startsWith(`${org}-`)) {
      return true;
    }

    return false;
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

  /**
   * Calculate workflow nodes, agents, and shapes available with this MCP server
   */
  private calculateWorkflowIntegration(name: string, description: string, capabilities: string[]): {
    workflowNodes: string[];
    workflowNodeDetails: Array<{ type: string; name: string; description: string; category: string; icon?: string }>;
    specializedAgents: string[];
    specializedAgentDetails: Array<{ id: string; name: string; description: string; expertise: string[] }>;
    nodeShapes: string[];
    canExecuteAgents: boolean;
    dataInputTypes: string[];
    dataOutputTypes: string[];
  } {
    const workflowNodes: string[] = [];
    const workflowNodeDetails: Array<{ type: string; name: string; description: string; category: string; icon?: string }> = [];
    const specializedAgents: string[] = [];
    const specializedAgentDetails: Array<{ id: string; name: string; description: string; expertise: string[] }> = [];
    const nodeShapes: string[] = [];
    const dataInputTypes: string[] = ['json', 'text']; // Most integrations accept these
    const dataOutputTypes: string[] = ['json']; // Most integrations output JSON
    let canExecuteAgents = true; // MCP servers can invoke agents

    const lowerName = name.toLowerCase();
    const lowerDesc = description.toLowerCase();
    const allText = `${lowerName} ${lowerDesc} ${capabilities.join(' ')}`;

    // Helper to add node with details
    const addNode = (type: string, name: string, description: string, category: string, icon?: string) => {
      workflowNodes.push(type);
      workflowNodeDetails.push({ type, name, description, category, icon });
    };

    // Helper to add agent with details
    const addAgent = (id: string, name: string, description: string, expertise: string[]) => {
      specializedAgents.push(id);
      specializedAgentDetails.push({ id, name, description, expertise });
    };

    // Triggers based on service type
    if (allText.includes('webhook') || allText.includes('event')) {
      addNode('webhook-trigger', 'Webhook Trigger', 'Receive HTTP webhooks from external services', 'triggers', '🔗');
      nodeShapes.push('trigger');
      dataInputTypes.push('webhook', 'http');
    }
    if (allText.includes('schedule') || allText.includes('cron') || allText.includes('periodic')) {
      addNode('schedule-trigger', 'Schedule Trigger', 'Run workflows on a schedule', 'triggers', '⏰');
      nodeShapes.push('trigger');
    }

    // Data operations
    if (allText.includes('database') || allText.includes('sql') || allText.includes('data')) {
      addNode('db-query', 'Database Query', 'Execute SQL queries', 'storage', '🗄️');
      addNode('db-insert', 'Database Insert', 'Insert data into database', 'storage', '💾');
      addNode('db-update', 'Database Update', 'Update database records', 'storage', '✏️');
      nodeShapes.push('data', 'storage');
      dataInputTypes.push('sql', 'structured-data');
      dataOutputTypes.push('table', 'records');
    }

    // Analytics services
    if (lowerName.includes('analytics') || lowerName.includes('google analytics') || capabilities.includes('data_analysis')) {
      addNode('ga-top-pages', 'Top Pages Report', 'Get top performing pages from analytics', 'analytics', '📊');
      addNode('ga-search-data', 'Search Console Data', 'Get search performance metrics', 'analytics', '🔍');
      addNode('analytics-report', 'Analytics Report', 'Generate comprehensive analytics report', 'analytics', '📈');
      addAgent('analytics-expert', 'Analytics Expert', 'Specialized in data analysis and reporting', ['analytics', 'data-visualization', 'metrics']);
      nodeShapes.push('analytics', 'reporting');
      dataOutputTypes.push('metrics', 'charts');
    }

    // Communication services
    if (lowerName.includes('slack') || lowerName.includes('discord') || capabilities.includes('messaging')) {
      addNode('send-message', 'Send Message', 'Send messages to channels or users', 'communication', '💬');
      addNode('create-channel', 'Create Channel', 'Create new communication channels', 'communication', '➕');
      addNode('notification', 'Notification', 'Send notifications', 'communication', '🔔');
      addAgent('slack-integration-expert', 'Slack Expert', 'Specialized in Slack integrations and workflows', ['slack-api', 'bot-development', 'webhooks']);
      nodeShapes.push('communication', 'notification');
      dataInputTypes.push('message', 'notification');
    }

    // Development tools
    if (lowerName.includes('github') || lowerName.includes('gitlab') || capabilities.includes('repository_management')) {
      addNode('create-issue', 'Create Issue', 'Create repository issues', 'development', '🐛');
      addNode('create-pr', 'Create Pull Request', 'Create pull requests', 'development', '🔀');
      addNode('repo-query', 'Repository Query', 'Query repository data', 'development', '📂');
      addAgent('github-integration-expert', 'GitHub Expert', 'Specialized in GitHub API and workflows', ['git', 'ci-cd', 'code-review']);
      nodeShapes.push('development', 'version-control');
      dataInputTypes.push('code', 'git-refs');
      dataOutputTypes.push('commits', 'pull-requests');
    }

    // Cloud services
    if (lowerName.includes('aws') || capabilities.includes('cloud_services')) {
      addNode('s3-upload', 'S3 Upload', 'Upload files to S3 storage', 'cloud', '☁️');
      addNode('dynamodb-query', 'DynamoDB Query', 'Query DynamoDB tables', 'cloud', '🗃️');
      addNode('lambda-invoke', 'Invoke Lambda', 'Execute Lambda functions', 'cloud', '⚡');
      addNode('sns-send', 'SNS Publish', 'Publish messages to SNS topics', 'cloud', '📢');
      addAgent('s3-storage-expert', 'S3 Expert', 'Specialized in S3 storage operations', ['s3', 'object-storage', 'cdn']);
      addAgent('dynamodb-database-expert', 'DynamoDB Expert', 'Specialized in DynamoDB operations', ['nosql', 'dynamodb', 'queries']);
      addAgent('lambda-serverless-expert', 'Lambda Expert', 'Specialized in serverless functions', ['serverless', 'lambda', 'functions']);
      addAgent('sns-messaging-expert', 'SNS Expert', 'Specialized in SNS messaging', ['messaging', 'pub-sub', 'notifications']);
      nodeShapes.push('cloud', 'infrastructure');
      dataInputTypes.push('files', 'binary');
      dataOutputTypes.push('storage-urls', 'execution-results');
    }

    // Stripe/payments
    if (lowerName.includes('stripe') || allText.includes('payment')) {
      addNode('create-payment', 'Create Payment', 'Process payments', 'payments', '💳');
      addNode('check-subscription', 'Check Subscription', 'Verify subscription status', 'payments', '🔒');
      addNode('refund-payment', 'Refund Payment', 'Process refunds', 'payments', '↩️');
      addAgent('stripe-payments-expert', 'Stripe Expert', 'Specialized in payment processing', ['stripe-api', 'subscriptions', 'webhooks']);
      nodeShapes.push('payments', 'ecommerce');
      dataInputTypes.push('payment-data', 'customer-info');
      dataOutputTypes.push('transaction-results', 'receipts');
    }

    // HTTP/API actions (always available for MCP servers)
    addNode('http-get', 'HTTP GET', 'Make GET requests to APIs', 'http', '🌐');
    addNode('http-post', 'HTTP POST', 'Make POST requests to APIs', 'http', '📮');
    nodeShapes.push('http', 'api');

    // Agent node (always available - can invoke any specialized agent)
    addNode('agent', 'AI Agent', 'Execute tasks with AI agents', 'agents', '🤖');
    nodeShapes.push('agents');

    return {
      workflowNodes: [...new Set(workflowNodes)],
      workflowNodeDetails,
      specializedAgents: [...new Set(specializedAgents)],
      specializedAgentDetails,
      nodeShapes: [...new Set(nodeShapes)],
      canExecuteAgents,
      dataInputTypes: [...new Set(dataInputTypes)],
      dataOutputTypes: [...new Set(dataOutputTypes)]
    };
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