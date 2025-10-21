import { Logger } from '../utils/Logger.js';
import { MCPStdioService, MCPTool } from './MCPStdioService.js';
import { JWTPayload, OrganizationMembership } from '../middleware/auth.js';

/**
 * Registry for managing multiple MCP servers and routing tool calls
 */
/**
 * Tool prefix patterns mapped to server names
 */
const TOOL_PREFIX_ROUTING: Record<string, string[]> = {
  aws: [
    'use_aws',
    'aws_',
    'kv_',
    'events_',
    'artifacts_',
    'analytics_',
    'workflow_',
    'agent_',
    'integration_'
  ],
  github: ['github_'],
  slack: ['slack_'],
  stripe: ['stripe_']
};

export class MCPServiceRegistry {
  private servers = new Map<string, MCPStdioService>();
  private toolRouting = new Map<string, string>();
  private logger: Logger;

  constructor() {
    this.logger = new Logger('MCPServiceRegistry');
  }

  /**
   * Register an MCP server
   */
  async registerServer(name: string, serverConfig: MCPServerConfig): Promise<void> {
    try {
      const service = new MCPStdioService();
      await service.connect(serverConfig);

      this.servers.set(name, service);

      // Register tool routing
      const tools = await service.listTools();
      for (const tool of tools) {
        this.toolRouting.set(tool.name, name);
      }

      this.logger.info(`Registered MCP server '${name}' with ${tools.length} tools`);
    } catch (error) {
      this.logger.error(`Failed to register MCP server '${name}':`, error);
      throw error;
    }
  }

  /**
   * Execute a tool with organization context
   */
  async executeTool(
    toolName: string,
    args: Record<string, any>,
    jwt: JWTPayload,
    organizationId?: string
  ): Promise<any> {
    // Get server for this tool
    const serverName = this.getServerForTool(toolName);
    const server = this.servers.get(serverName);

    if (!server) {
      throw new Error(`No MCP server available for tool: ${toolName}`);
    }

    // Validate organization access if specified
    if (organizationId) {
      this.validateOrganizationAccess(jwt, organizationId);
    }

    // Inject organization context
    const enrichedArgs = await this.injectOrganizationContext(
      toolName,
      args,
      jwt,
      organizationId
    );

    this.logger.debug(`Executing tool '${toolName}' on server '${serverName}'`, {
      originalArgs: args,
      enrichedArgs,
      organizationId
    });

    return await server.executeTool(toolName, enrichedArgs);
  }

  /**
   * List all available tools across all servers
   */
  async listAllTools(jwt?: JWTPayload): Promise<MCPTool[]> {
    const allTools: MCPTool[] = [];

    for (const [serverName, server] of this.servers) {
      try {
        const tools = await server.listTools();

        // Add server context to each tool
        const serverTools = tools.map(tool => ({
          ...tool,
          serverName,
          name: tool.name
        }));

        allTools.push(...serverTools);
      } catch (error) {
        this.logger.warn(`Failed to list tools for server '${serverName}':`, error);
      }
    }

    return allTools;
  }

  /**
   * Get server name for a given tool using exact match or prefix patterns
   */
  private getServerForTool(toolName: string): string {
    // First check exact match from tool registry
    const exactMatch = this.toolRouting.get(toolName);
    if (exactMatch) {
      return exactMatch;
    }

    // Fallback to prefix pattern matching
    for (const [serverName, patterns] of Object.entries(TOOL_PREFIX_ROUTING)) {
      for (const pattern of patterns) {
        if (toolName === pattern || toolName.startsWith(pattern)) {
          return serverName;
        }
      }
    }

    throw new Error(`Unknown tool: ${toolName}`);
  }

  /**
   * Validate that JWT has access to the specified organization
   */
  private validateOrganizationAccess(jwt: JWTPayload, organizationId: string): void {
    const hasAccess = jwt.organizationMemberships.some(
      membership => membership.orgId === organizationId
    );

    if (!hasAccess) {
      throw new Error(`User ${jwt.userId} does not have access to organization ${organizationId}`);
    }
  }

  /**
   * Inject organization context into tool arguments
   */
  private async injectOrganizationContext(
    toolName: string,
    args: Record<string, any>,
    jwt: JWTPayload,
    organizationId?: string
  ): Promise<Record<string, any>> {
    const enrichedArgs = { ...args };

    // Get organization context
    let orgContext: OrganizationMembership | null = null;
    if (organizationId) {
      orgContext = jwt.organizationMemberships.find(m => m.orgId === organizationId) || null;
    }

    // AWS-specific context injection
    if (toolName === 'use_aws') {
      return this.injectAWSContext(enrichedArgs, jwt, orgContext);
    }

    // GitHub-specific context injection
    if (toolName.startsWith('github_')) {
      return this.injectGitHubContext(enrichedArgs, jwt, orgContext);
    }

    // Slack-specific context injection
    if (toolName.startsWith('slack_')) {
      return this.injectSlackContext(enrichedArgs, jwt, orgContext);
    }

    // Default: add user and org context
    enrichedArgs._context = {
      userId: jwt.userId,
      personalNamespace: jwt.personalNamespace,
      organizationId: orgContext?.orgId,
      organizationSlug: orgContext?.orgSlug
    };

    return enrichedArgs;
  }

  /**
   * Inject AWS-specific organization context
   */
  private injectAWSContext(
    args: Record<string, any>,
    jwt: JWTPayload,
    orgContext: OrganizationMembership | null
  ): Record<string, any> {
    const serviceName = args.service_name || args.service;

    // DynamoDB context
    if (serviceName === 'dynamodb') {
      if (args.table_name && orgContext) {
        args.table_name = `${orgContext.orgSlug}-${args.table_name}`;
      }

      // Inject org-scoped key prefixes
      if (args.key && orgContext) {
        args.key = `${orgContext.orgId}:${jwt.userId}:${args.key}`;
      }
    }

    // S3 context
    if (serviceName === 's3') {
      if (orgContext) {
        // Prefix S3 operations with organization slug
        if (args.key) {
          args.key = `${orgContext.orgSlug}/${args.key}`;
        }
        if (args.prefix) {
          args.prefix = `${orgContext.orgSlug}/${args.prefix}`;
        }
      }
    }

    // EventBridge context
    if (serviceName === 'events') {
      if (orgContext) {
        args['event-bus-name'] = `${orgContext.orgSlug}-events`;
        args.source = `com.${orgContext.orgSlug}.agent-mesh`;

        // Inject organization context into event detail
        if (args.detail && typeof args.detail === 'object') {
          args.detail = {
            ...args.detail,
            organizationId: orgContext.orgId,
            userId: jwt.userId,
            awsAccountId: orgContext.awsAccountId
          };
        }
      }
    }

    return args;
  }

  /**
   * Inject GitHub-specific organization context
   */
  private injectGitHubContext(
    args: Record<string, any>,
    jwt: JWTPayload,
    orgContext: OrganizationMembership | null
  ): Record<string, any> {
    if (orgContext) {
      args.org = orgContext.orgSlug;
    }
    return args;
  }

  /**
   * Inject Slack-specific organization context
   */
  private injectSlackContext(
    args: Record<string, any>,
    jwt: JWTPayload,
    orgContext: OrganizationMembership | null
  ): Record<string, any> {
    // Slack workspace context would go here
    return args;
  }

  /**
   * Get health status of all registered servers
   */
  async getHealthStatus(): Promise<Record<string, any>> {
    const status: Record<string, any> = {};

    for (const [name, server] of this.servers) {
      try {
        status[name] = await server.getHealth();
      } catch (error) {
        status[name] = {
          status: 'unhealthy',
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        };
      }
    }

    return status;
  }

  /**
   * Disconnect all servers
   */
  async disconnect(): Promise<void> {
    for (const [name, server] of this.servers) {
      try {
        await server.disconnect();
        this.logger.info(`Disconnected from MCP server '${name}'`);
      } catch (error) {
        this.logger.warn(`Error disconnecting from server '${name}':`, error);
      }
    }

    this.servers.clear();
    this.toolRouting.clear();
  }
}

/**
 * MCP Server configuration interface
 */
export interface MCPServerConfig {
  command: string;
  args: string[];
  cwd?: string;
  env?: Record<string, string>;
}

export default MCPServiceRegistry;