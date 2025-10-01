// Service to initialize the agent registry with existing agents from .claude/agents
import { agentMCPMatcher } from './AgentMCPMatcher';

// Complete list of agents from .claude/agents folder
const EXISTING_AGENTS = [
  '.claude/agents/api-discoverer.md',
  '.claude/agents/conductor.md',
  '.claude/agents/core/code-archaeologist.md',
  '.claude/agents/core/code-reviewer.md',
  '.claude/agents/core/documentation-specialist.md',
  '.claude/agents/core/performance-optimizer.md',
  '.claude/agents/critic.md',
  '.claude/agents/integrations/github-specialist.md',
  '.claude/agents/integrations/salesforce-specialist.md',
  '.claude/agents/integrations/shopify-specialist.md',
  '.claude/agents/integration-specialist-generator.md',
  '.claude/agents/linkedin-content-creator.md',
  '.claude/agents/orchestrators/project-analyst.md',
  '.claude/agents/orchestrators/team-configurator.md',
  '.claude/agents/orchestrators/tech-lead-orchestrator.md',
  '.claude/agents/specialized/cloudfront/cloudfront-expert.md',
  '.claude/agents/specialized/cloudwatch/cloudwatch-expert.md',
  '.claude/agents/specialized/django/django-api-developer.md',
  '.claude/agents/specialized/django/django-backend-expert.md',
  '.claude/agents/specialized/django/django-orm-expert.md',
  '.claude/agents/specialized/dynamodb/dynamodb-expert.md',
  '.claude/agents/specialized/eks/eks-expert.md',
  '.claude/agents/specialized/eventbridge/eventbridge-expert.md',
  '.claude/agents/specialized/github/github-expert.md',
  '.claude/agents/specialized/google-analytics/google-analytics-mcp-expert.md',
  '.claude/agents/specialized/iam/iam-expert.md',
  '.claude/agents/specialized/lambda/lambda-expert.md',
  '.claude/agents/specialized/laravel/laravel-backend-expert.md',
  '.claude/agents/specialized/laravel/laravel-eloquent-expert.md',
  '.claude/agents/specialized/rails/rails-activerecord-expert.md',
  '.claude/agents/specialized/rails/rails-api-developer.md',
  '.claude/agents/specialized/rails/rails-backend-expert.md',
  '.claude/agents/specialized/rds/rds-database-expert.md',
  '.claude/agents/specialized/react/react-component-architect.md',
  '.claude/agents/specialized/react/react-nextjs-expert.md',
  '.claude/agents/specialized/react/react-state-manager.md',
  '.claude/agents/specialized/route53/route53-dns-expert.md',
  '.claude/agents/specialized/rust/rust-expert.md',
  '.claude/agents/specialized/s3/s3-expert.md',
  '.claude/agents/specialized/ses/ses-email-expert.md',
  '.claude/agents/specialized/slack/slack-expert.md',
  '.claude/agents/specialized/sns/sns-expert.md',
  '.claude/agents/specialized/solidjs/solidjs-specialist.md',
  '.claude/agents/specialized/sqs/sqs-expert.md',
  '.claude/agents/specialized/stripe/stripe-expert.md',
  '.claude/agents/specialized/terraform/terraform-architect.md',
  '.claude/agents/specialized/terraform/terraform-expert.md',
  '.claude/agents/specialized/vercel/vercel-deployment-expert.md',
  '.claude/agents/specialized/vue/vue-component-architect.md',
  '.claude/agents/specialized/vue/vue-nuxt-expert.md',
  '.claude/agents/specialized/vue/vue-state-manager.md',
  '.claude/agents/sweeper.md',
  '.claude/agents/universal/api-architect.md',
  '.claude/agents/universal/backend-developer.md',
  '.claude/agents/universal/frontend-developer.md',
  '.claude/agents/universal/mentoring-agent.md',
  '.claude/agents/universal/tailwind-css-expert.md'
];

// Organized agent structure for display
export interface OrganizedAgents {
  orchestrators: AgentNode[];
  core: AgentNode[];
  specialized: {
    aws: AgentNode[];
    frameworks: AgentNode[];
    devops: AgentNode[];
    integrations: AgentNode[];
    other: AgentNode[];
  };
  universal: AgentNode[];
  'mcp-apps': AgentNode[];
}

interface AgentNode {
  type: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  group: string;
  subgroup?: string;
}

class AgentRegistryInitializer {
  // Initialize the registry with existing agents
  async initialize(): Promise<OrganizedAgents> {
    const dashboardServer = (window as any).dashboardServer;

    // Parse agent definitions
    const agents = agentMCPMatcher.parseAgentsFromPaths(EXISTING_AGENTS);

    // Try to get MCP servers if available
    let mcpServers = [];
    try {
      if (dashboardServer) {
        const result = await dashboardServer.sendMessageWithResponse({
          type: 'mcp_catalog_list',
          payload: { integration: '' }
        });
        mcpServers = result?.data || [];
      }
    } catch (error) {
      console.log('Could not fetch MCP servers, continuing without matches');
    }

    // Match agents with MCP servers
    const matches = await agentMCPMatcher.matchWithMCPServers(agents, mcpServers);

    // Prime the registry if dashboard server is available
    if (dashboardServer) {
      await agentMCPMatcher.primeAgentRegistry(agents, matches);
    }

    // Organize agents for display
    return this.organizeAgents(agents);
  }

  // Organize agents into categorized structure
  private organizeAgents(agents: any[]): OrganizedAgents {
    const organized: OrganizedAgents = {
      orchestrators: [],
      core: [],
      specialized: {
        aws: [],
        frameworks: [],
        devops: [],
        integrations: [],
        other: []
      },
      universal: [],
      'mcp-apps': []
    };

    agents.forEach(agent => {
      const node: AgentNode = {
        type: `agent-${agent.id}`,
        name: agent.name,
        description: `${agent.name} specialist`,
        icon: this.getAgentIcon(agent),
        color: this.getAgentColor(agent),
        group: agent.category,
        subgroup: this.getSubgroup(agent)
      };

      // Place in appropriate category
      if (agent.category === 'orchestrators') {
        organized.orchestrators.push(node);
      } else if (agent.category === 'core') {
        organized.core.push(node);
      } else if (agent.category === 'universal') {
        organized.universal.push(node);
      } else if (agent.category === 'specialized') {
        // Further categorize specialized agents
        const subgroup = this.getSubgroup(agent);
        if (subgroup === 'aws') {
          organized.specialized.aws.push(node);
        } else if (subgroup === 'frameworks') {
          organized.specialized.frameworks.push(node);
        } else if (subgroup === 'devops') {
          organized.specialized.devops.push(node);
        } else if (subgroup === 'integrations') {
          organized.specialized.integrations.push(node);
        } else {
          organized.specialized.other.push(node);
        }
      } else if (agent.category === 'integrations') {
        // Handle root-level integration agents
        organized.specialized.integrations.push(node);
      } else {
        // Handle other root-level agents like conductor, critic, etc.
        const mainCategory = this.determineMainCategory(agent);
        if (mainCategory === 'orchestrators') {
          organized.orchestrators.push(node);
        } else if (mainCategory === 'integrations') {
          organized.specialized.integrations.push(node);
        } else {
          organized.specialized.other.push(node);
        }
      }
    });

    return organized;
  }

  // Determine subgroup for specialized agents
  private getSubgroup(agent: any): string {
    const id = agent.id.toLowerCase();
    const path = agent.path.toLowerCase();

    // AWS services - explicitly check for AWS service directories
    if (path.includes('/s3/') || path.includes('/lambda/') || path.includes('/dynamodb/') ||
        path.includes('/cloudfront/') || path.includes('/cloudwatch/') || path.includes('/sns/') ||
        path.includes('/sqs/') || path.includes('/ses/') || path.includes('/iam/') ||
        path.includes('/rds/') || path.includes('/eks/') || path.includes('/route53/') ||
        path.includes('/eventbridge/')) {
      return 'aws';
    }

    // Web Frameworks - React, Vue, Django, Rails, Laravel, SolidJS
    if (path.includes('/django/') || path.includes('/rails/') || path.includes('/laravel/') ||
        path.includes('/react/') || path.includes('/vue/') || path.includes('/solidjs/')) {
      return 'frameworks';
    }

    // DevOps & Infrastructure - Terraform, Vercel, Rust
    if (path.includes('/terraform/') || path.includes('/vercel/') || path.includes('/rust/')) {
      return 'devops';
    }

    // Integrations - GitHub, Slack, Stripe, Google Analytics, etc.
    if (path.includes('/github/') || path.includes('/slack/') || path.includes('/stripe/') ||
        path.includes('/google-analytics/') || path.includes('/integrations/') ||
        path.includes('/salesforce/') || path.includes('/shopify/')) {
      return 'integrations';
    }

    // Note: Database experts are within frameworks (Django ORM, Rails ActiveRecord, Laravel Eloquent)
    // RDS is an AWS service, not a separate database category

    return 'other';
  }

  // Determine main category for root-level agents
  private determineMainCategory(agent: any): string {
    const id = agent.id.toLowerCase();
    const path = agent.path.toLowerCase();

    // Check for orchestrator-like agents
    if (id.includes('conductor') || id.includes('critic') || id.includes('sweeper') ||
        id.includes('project-analyst') || id.includes('tech-lead')) {
      return 'orchestrators';
    }

    // Check for integration specialists
    if (id.includes('integration') || id.includes('linkedin')) {
      return 'integrations';
    }

    // Check for API/discovery agents
    if (id.includes('api-discoverer')) {
      return 'core';
    }

    return 'other';
  }

  // Get icon for agent
  private getAgentIcon(agent: any): string {
    const iconMap: Record<string, string> = {
      // AWS
      's3': '🪣', 'lambda': '⚡', 'dynamodb': '🗄️', 'cloudfront': '🌐',
      'cloudwatch': '📊', 'sns': '📬', 'sqs': '📮', 'ses': '📧',
      'iam': '🔐', 'rds': '🗃️', 'eks': '☸️', 'route53': '🔀', 'eventbridge': '🌉',

      // Frameworks
      'django': '🐍', 'rails': '💎', 'laravel': '🐘', 'react': '⚛️',
      'vue': '💚', 'solidjs': '⚡', 'nextjs': '▲',

      // Tools & Services
      'terraform': '🏗️', 'github': '🐙', 'slack': '💬', 'stripe': '💳',
      'vercel': '▲', 'rust': '🦀', 'google-analytics': '📈',
      'salesforce': '☁️', 'shopify': '🛍️',

      // Categories
      'conductor': '🎯', 'critic': '🔍', 'sweeper': '🧹',
      'code': '💻', 'api': '🔌', 'backend': '⚙️', 'frontend': '🎨',
      'tailwind': '🎨', 'mentor': '🎓', 'linkedin': '💼',
      'project': '📋', 'team': '👥', 'tech-lead': '👨‍💻'
    };

    const agentLower = agent.id.toLowerCase();
    for (const [key, icon] of Object.entries(iconMap)) {
      if (agentLower.includes(key)) return icon;
    }

    return '🤖';
  }

  // Get color for agent
  private getAgentColor(agent: any): string {
    const subgroup = this.getSubgroup(agent);

    const colorMap: Record<string, string> = {
      // By category
      'orchestrators': 'bg-indigo-500',
      'core': 'bg-gray-600',
      'universal': 'bg-green-500',

      // By subgroup
      'aws': 'bg-orange-500',
      'frameworks': 'bg-blue-500',
      'devops': 'bg-purple-500',
      'integrations': 'bg-pink-500',

      // Default
      'specialized': 'bg-cyan-500',
      'other': 'bg-slate-500'
    };

    return colorMap[subgroup] || colorMap[agent.category] || 'bg-slate-500';
  }
}

export const agentRegistryInitializer = new AgentRegistryInitializer();