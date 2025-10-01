// Service to match existing agents with MCP servers in the catalog
import { MCPServerListing } from '../types/mcpCatalog';

export interface AgentDefinition {
  id: string;
  name: string;
  path: string;
  category: string;
  description?: string;
  matchedMCPServers?: string[];
}

// Map of agent identifiers to potential MCP server matches
const AGENT_MCP_MAPPINGS: Record<string, string[]> = {
  // AWS Agents
  'cloudfront-expert': ['mcp-aws-cloudfront', 'mcp-cloudflare', 'mcp-cdn'],
  'cloudwatch-expert': ['mcp-aws-cloudwatch', 'mcp-datadog', 'mcp-monitoring'],
  'dynamodb-expert': ['mcp-aws-dynamodb', 'mcp-dynamodb', 'mcp-nosql'],
  'eks-expert': ['mcp-aws-eks', 'mcp-kubernetes', 'mcp-k8s'],
  'eventbridge-expert': ['mcp-aws-eventbridge', 'mcp-events'],
  'iam-expert': ['mcp-aws-iam', 'mcp-auth0', 'mcp-okta'],
  'lambda-expert': ['mcp-aws-lambda', 'mcp-serverless', 'mcp-functions'],
  'rds-database-expert': ['mcp-aws-rds', 'mcp-postgresql', 'mcp-mysql'],
  'route53-dns-expert': ['mcp-aws-route53', 'mcp-cloudflare', 'mcp-dns'],
  's3-expert': ['mcp-aws-s3', 'mcp-s3', 'mcp-storage', 'mcp-backblaze', 'mcp-wasabi'],
  'ses-email-expert': ['mcp-aws-ses', 'mcp-sendgrid', 'mcp-mailgun'],
  'sns-expert': ['mcp-aws-sns', 'mcp-twilio', 'mcp-notification'],
  'sqs-expert': ['mcp-aws-sqs', 'mcp-rabbitmq', 'mcp-queue'],

  // Framework Agents
  'django-api-developer': ['mcp-django', 'mcp-python-web'],
  'django-backend-expert': ['mcp-django', 'mcp-python-web'],
  'django-orm-expert': ['mcp-django', 'mcp-sqlalchemy'],
  'laravel-backend-expert': ['mcp-laravel', 'mcp-php'],
  'laravel-eloquent-expert': ['mcp-laravel', 'mcp-php'],
  'rails-activerecord-expert': ['mcp-rails', 'mcp-ruby'],
  'rails-api-developer': ['mcp-rails', 'mcp-ruby'],
  'rails-backend-expert': ['mcp-rails', 'mcp-ruby'],
  'react-component-architect': ['mcp-react', 'mcp-nextjs'],
  'react-nextjs-expert': ['mcp-nextjs', 'mcp-react', 'mcp-vercel'],
  'react-state-manager': ['mcp-react', 'mcp-redux'],
  'vue-component-architect': ['mcp-vue', 'mcp-vuejs'],
  'vue-nuxt-expert': ['mcp-nuxt', 'mcp-vue'],
  'vue-state-manager': ['mcp-vue', 'mcp-vuex'],
  'solidjs-specialist': ['mcp-solidjs', 'mcp-solid'],

  // Integration Specialists
  'github-specialist': ['mcp-github', 'mcp-git'],
  'github-expert': ['mcp-github', 'mcp-git'],
  'salesforce-specialist': ['mcp-salesforce', 'mcp-crm'],
  'shopify-specialist': ['mcp-shopify', 'mcp-ecommerce'],
  'slack-expert': ['mcp-slack', 'mcp-discord', 'mcp-microsoft-teams'],
  'stripe-expert': ['mcp-stripe', 'mcp-paypal', 'mcp-square'],
  'google-analytics-mcp-expert': ['mcp-google-analytics', 'mcp-analytics'],

  // Infrastructure
  'terraform-architect': ['mcp-terraform', 'mcp-infrastructure'],
  'terraform-expert': ['mcp-terraform', 'mcp-infrastructure'],
  'vercel-deployment-expert': ['mcp-vercel', 'mcp-netlify'],

  // Languages
  'rust-expert': ['mcp-rust', 'mcp-cargo'],

  // Core/Universal
  'api-architect': ['mcp-openapi', 'mcp-graphql', 'mcp-rest'],
  'backend-developer': ['mcp-nodejs', 'mcp-express', 'mcp-fastapi'],
  'frontend-developer': ['mcp-react', 'mcp-vue', 'mcp-angular'],
  'tailwind-css-expert': ['mcp-tailwind', 'mcp-css'],

  // Orchestrators
  'conductor': ['mcp-workflow', 'mcp-orchestration'],
  'critic': ['mcp-testing', 'mcp-validation'],
  'tech-lead-orchestrator': ['mcp-project-management', 'mcp-jira'],
  'project-analyst': ['mcp-analytics', 'mcp-reporting'],

  // Special
  'linkedin-content-creator': ['mcp-linkedin', 'mcp-social-media']
};

class AgentMCPMatcher {
  // Parse agent definitions from filesystem structure
  parseAgentsFromPaths(paths: string[]): AgentDefinition[] {
    return paths.map(path => {
      // Extract agent name from path
      const fileName = path.split('/').pop()?.replace('.md', '') || '';
      const pathParts = path.split('/');

      // Determine category from path
      let category = 'other';
      if (path.includes('/orchestrators/')) category = 'orchestrators';
      else if (path.includes('/specialized/')) category = 'specialized';
      else if (path.includes('/universal/')) category = 'universal';
      else if (path.includes('/core/')) category = 'core';
      else if (path.includes('/integrations/')) category = 'integrations';

      // Clean up the name for display
      const name = fileName
        .replace(/-/g, ' ')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase());

      return {
        id: fileName,
        name,
        path,
        category,
        matchedMCPServers: AGENT_MCP_MAPPINGS[fileName] || []
      };
    });
  }

  // Match agents with available MCP servers
  async matchWithMCPServers(
    agents: AgentDefinition[],
    mcpServers: MCPServerListing[]
  ): Promise<Map<string, string[]>> {
    const matches = new Map<string, string[]>();

    for (const agent of agents) {
      const potentialMatches: string[] = [];

      // Check predefined mappings
      if (AGENT_MCP_MAPPINGS[agent.id]) {
        potentialMatches.push(...AGENT_MCP_MAPPINGS[agent.id]);
      }

      // Try fuzzy matching based on name
      const agentKeywords = agent.id.toLowerCase().split(/[-_]/);

      for (const server of mcpServers) {
        const serverKeywords = [
          ...server.id.toLowerCase().split(/[-_]/),
          ...server.name.toLowerCase().split(/\s+/),
          ...server.tags.map(t => t.toLowerCase())
        ];

        // Check if any agent keywords match server keywords
        const hasMatch = agentKeywords.some(ak =>
          serverKeywords.some(sk =>
            sk.includes(ak) || ak.includes(sk)
          )
        );

        if (hasMatch && !potentialMatches.includes(server.id)) {
          potentialMatches.push(server.id);
        }
      }

      if (potentialMatches.length > 0) {
        matches.set(agent.id, potentialMatches);
      }
    }

    return matches;
  }

  // Create agent registry entries for matched agents
  async primeAgentRegistry(
    agents: AgentDefinition[],
    matches: Map<string, string[]>
  ): Promise<void> {
    const dashboardServer = (window as any).dashboardServer;
    if (!dashboardServer) return;

    try {
      // Prepare registry data
      const registryData = {
        agents: agents.map(agent => ({
          id: agent.id,
          name: agent.name,
          path: agent.path,
          category: agent.category,
          description: agent.description || `${agent.name} specialist agent`,
          icon: this.getAgentIcon(agent),
          color: this.getAgentColor(agent.category),
          mcpServers: matches.get(agent.id) || [],
          group: agent.category
        })),
        matches: Object.fromEntries(matches),
        timestamp: new Date().toISOString()
      };

      // Store in KV store
      await dashboardServer.sendMessageWithResponse({
        type: 'mcp_call',
        tool: 'kv_set',
        arguments: {
          key: 'tenant-agents-registry',
          value: JSON.stringify(registryData),
          ttl_hours: 720 // 30 days
        }
      });

      console.log('Successfully primed agent registry with', agents.length, 'agents');
    } catch (error) {
      console.error('Failed to prime agent registry:', error);
    }
  }

  // Get appropriate icon for agent based on type
  private getAgentIcon(agent: AgentDefinition): string {
    const iconMap: Record<string, string> = {
      // AWS Services
      's3': '🪣',
      'lambda': '⚡',
      'dynamodb': '🗄️',
      'cloudfront': '🌐',
      'cloudwatch': '📊',
      'sns': '📬',
      'sqs': '📮',
      'ses': '📧',
      'iam': '🔐',
      'rds': '🗃️',
      'eks': '☸️',
      'route53': '🔀',
      'eventbridge': '🌉',

      // Frameworks
      'django': '🐍',
      'rails': '💎',
      'laravel': '🐘',
      'react': '⚛️',
      'vue': '💚',
      'solidjs': '⚡',
      'nextjs': '▲',

      // Tools
      'terraform': '🏗️',
      'github': '🐙',
      'slack': '💬',
      'stripe': '💳',
      'vercel': '▲',
      'rust': '🦀',

      // Categories
      'orchestrators': '🎯',
      'specialized': '🔧',
      'universal': '🌍',
      'core': '💻',
      'integrations': '🔌'
    };

    // Check for keywords in agent ID
    const agentLower = agent.id.toLowerCase();
    for (const [key, icon] of Object.entries(iconMap)) {
      if (agentLower.includes(key)) return icon;
    }

    // Fall back to category icon
    return iconMap[agent.category] || '🤖';
  }

  // Get color for agent based on category
  private getAgentColor(category: string): string {
    const colorMap: Record<string, string> = {
      'orchestrators': 'bg-indigo-500',
      'specialized': 'bg-blue-500',
      'universal': 'bg-green-500',
      'core': 'bg-gray-600',
      'integrations': 'bg-purple-500',
      'other': 'bg-slate-500'
    };

    return colorMap[category] || 'bg-slate-500';
  }
}

export const agentMCPMatcher = new AgentMCPMatcher();