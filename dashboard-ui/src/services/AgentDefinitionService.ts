/**
 * Agent Definition Service
 * Manages agent definitions using existing ArtifactService infrastructure
 *
 * Storage Strategy:
 * - Agent markdown prompts: S3 artifacts (via ArtifactService)
 * - Agent metadata cache: KV store for quick lookups
 * - Tenant context: Automatically handled by ArtifactService
 *
 * Paths (via ArtifactService.buildKey):
 * - Personal: users/{userId}/agents/{agentId}.md
 * - Organizational: orgs/{orgId}/agents/{agentId}.md
 * - System: system/agents/{agentId}.md
 */

import { ArtifactService, type ArtifactContext } from './ArtifactService';

export interface AgentDefinition {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  color: string;

  // Storage
  context: ArtifactContext;        // Managed by ArtifactService
  version: number;

  // Metadata
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  model?: string;                  // AWS Bedrock model ID

  // Capabilities
  requiredMCPTools?: string[];     // MCP tools this agent needs
  requiredIntegrations?: string[]; // Integrations this agent needs

  // Preview data (cached from markdown)
  promptPreview?: string;          // First 200 chars of prompt
}

export interface AgentPrompt {
  id: string;
  markdown: string;                // Full markdown content
  metadata: {
    name?: string;
    description?: string;
    requiredTools?: string[];
    requiredIntegrations?: string[];
  };
}

export class AgentDefinitionService {
  constructor(
    private artifactService: ArtifactService,
    private mcpClient: any
  ) {}

  /**
   * Seed system agents from .claude/agents to S3
   * This would be called by dashboard-server with file system access
   */
  async seedSystemAgent(agentId: string, markdown: string, metadata: {
    category: string;
    name?: string;
    description?: string;
  }): Promise<AgentDefinition> {
    // Save markdown to S3 via ArtifactService
    await this.artifactService.save(agentId, markdown, {
      type: 'agent',
      context: 'system',
      contentType: 'text/markdown'
    });

    // Parse metadata from markdown
    const parsed = this.parseMarkdownMetadata(markdown);

    // Create definition
    const definition: AgentDefinition = {
      id: agentId,
      name: metadata.name || parsed.name || this.formatAgentName(agentId),
      description: metadata.description || parsed.description || '',
      category: metadata.category,
      icon: this.getAgentIcon(agentId),
      color: this.getAgentColor(metadata.category),
      context: 'system',
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      requiredMCPTools: parsed.requiredTools,
      requiredIntegrations: parsed.requiredIntegrations,
      promptPreview: markdown.substring(0, 200)
    };

    // Cache metadata in KV store
    await this.saveMetadata(definition);

    return definition;
  }

  /**
   * Get agent definition by ID
   */
  async getAgent(agentId: string, context?: ArtifactContext): Promise<AgentDefinition | null> {
    try {
      // Try metadata cache first
      const cached = await this.getMetadata(agentId, context);
      if (cached) return cached;

      // Fall back to loading from artifact
      const markdown = await this.artifactService.get(agentId, 'agent', context);
      if (!markdown) return null;

      // Parse and cache
      const parsed = this.parseMarkdownMetadata(markdown);
      const definition: AgentDefinition = {
        id: agentId,
        name: parsed.name || this.formatAgentName(agentId),
        description: parsed.description || '',
        category: 'custom',
        icon: this.getAgentIcon(agentId),
        color: 'bg-purple-500',
        context: context || 'personal',
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        requiredMCPTools: parsed.requiredTools,
        requiredIntegrations: parsed.requiredIntegrations,
        promptPreview: markdown.substring(0, 200)
      };

      await this.saveMetadata(definition);
      return definition;
    } catch (error) {
      console.error(`Failed to get agent ${agentId}:`, error);
      return null;
    }
  }

  /**
   * Get agent prompt markdown from S3
   */
  async getAgentPrompt(agentId: string, context?: ArtifactContext): Promise<AgentPrompt | null> {
    try {
      const markdown = await this.artifactService.get(agentId, 'agent', context);
      if (!markdown) return null;

      const metadata = this.parseMarkdownMetadata(markdown);

      return {
        id: agentId,
        markdown,
        metadata
      };
    } catch (error) {
      console.error(`Failed to get agent prompt ${agentId}:`, error);
      return null;
    }
  }

  /**
   * Save agent definition and markdown
   */
  async saveAgent(
    agentId: string,
    markdown: string,
    metadata: {
      name: string;
      description?: string;
      category?: string;
      icon?: string;
      color?: string;
      context?: ArtifactContext;
      model?: string;
    }
  ): Promise<AgentDefinition> {
    // Get existing for versioning
    const existing = await this.getAgent(agentId, metadata.context);
    const version = existing ? existing.version + 1 : 1;

    // Parse markdown metadata
    const parsed = this.parseMarkdownMetadata(markdown);

    // Save markdown via ArtifactService (handles tenant context)
    await this.artifactService.save(agentId, markdown, {
      type: 'agent',
      context: metadata.context,
      contentType: 'text/markdown'
    });

    // Create definition
    const definition: AgentDefinition = {
      id: agentId,
      name: metadata.name,
      description: metadata.description || parsed.description || '',
      category: metadata.category || 'custom',
      icon: metadata.icon || this.getAgentIcon(agentId),
      color: metadata.color || 'bg-purple-500',
      context: metadata.context || 'personal',
      version,
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      model: metadata.model,
      requiredMCPTools: parsed.requiredTools,
      requiredIntegrations: parsed.requiredIntegrations,
      promptPreview: markdown.substring(0, 200)
    };

    // Save metadata cache
    await this.saveMetadata(definition);

    return definition;
  }

  /**
   * List agents in current context
   */
  async listAgents(context?: ArtifactContext): Promise<AgentDefinition[]> {
    try {
      // Use ArtifactService.list (respects tenant context)
      const artifacts = await this.artifactService.list('agent', context);

      // Load metadata for each
      const agents: AgentDefinition[] = [];
      for (const artifact of artifacts) {
        const agentId = this.extractAgentIdFromKey(artifact.key);
        const agent = await this.getAgent(agentId, artifact.context);
        if (agent) agents.push(agent);
      }

      return agents;
    } catch (error) {
      console.error('Failed to list agents:', error);
      return [];
    }
  }

  /**
   * Delete agent (respects tenant permissions via ArtifactService)
   */
  async deleteAgent(agentId: string, context?: ArtifactContext): Promise<void> {
    // Delete artifact (ArtifactService checks permissions)
    await this.artifactService.delete(agentId, 'agent', context);

    // Delete metadata cache
    await this.deleteMetadata(agentId, context);
  }

  /**
   * Fork system agent to user/org context
   */
  async forkAgent(systemAgentId: string, newName?: string, newId?: string): Promise<AgentDefinition> {
    // Get system agent markdown
    const prompt = await this.getAgentPrompt(systemAgentId, 'system');
    if (!prompt) {
      throw new Error(`System agent ${systemAgentId} not found`);
    }

    // Use ArtifactService.copy (respects tenant context)
    const targetId = newId || `${systemAgentId}-custom`;
    await this.artifactService.copy(systemAgentId, 'agent', 'system', undefined, targetId);

    // Get original metadata
    const original = await this.getAgent(systemAgentId, 'system');

    // Save with new metadata
    return this.saveAgent(targetId, prompt.markdown, {
      name: newName || `${original?.name || systemAgentId} (Custom)`,
      description: original?.description,
      category: original?.category || 'custom',
      icon: original?.icon,
      color: original?.color
    });
  }

  // Metadata cache helpers (KV store)

  private async getMetadata(agentId: string, context?: ArtifactContext): Promise<AgentDefinition | null> {
    try {
      const key = `agent-metadata-${agentId}`;
      const result = await this.mcpClient.callMCPTool('kv_get', { key });
      return result?.value ? JSON.parse(result.value) : null;
    } catch {
      return null;
    }
  }

  private async saveMetadata(definition: AgentDefinition): Promise<void> {
    try {
      const key = `agent-metadata-${definition.id}`;
      await this.mcpClient.callMCPTool('kv_set', {
        key,
        value: JSON.stringify(definition),
        ttl_hours: 24 * 30 // 30 days cache
      });
    } catch (error) {
      console.warn('Failed to cache agent metadata:', error);
    }
  }

  private async deleteMetadata(agentId: string, context?: ArtifactContext): Promise<void> {
    try {
      const key = `agent-metadata-${agentId}`;
      await this.mcpClient.callMCPTool('kv_delete', { key });
    } catch (error) {
      console.warn('Failed to delete agent metadata:', error);
    }
  }

  // Helper methods

  private extractAgentIdFromKey(key: string): string {
    return key.split('/').pop()!.replace('.md', '').replace('.json', '');
  }

  private formatAgentName(agentId: string): string {
    return agentId
      .replace(/_/g, ' ')
      .replace(/-/g, ' ')
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  private parseMarkdownMetadata(markdown: string): {
    name?: string;
    description?: string;
    requiredTools?: string[];
    requiredIntegrations?: string[];
  } {
    const metadata: any = {};

    // Parse frontmatter if present
    const frontmatterMatch = markdown.match(/^---\n([\s\S]+?)\n---/);
    if (frontmatterMatch) {
      const frontmatter = frontmatterMatch[1];

      const nameMatch = frontmatter.match(/name:\s*(.+)/);
      if (nameMatch) metadata.name = nameMatch[1].trim();

      const descMatch = frontmatter.match(/description:\s*\|?\n?\s*(.+)/);
      if (descMatch) metadata.description = descMatch[1].trim();
    }

    // Extract required MCP tools
    const toolsMatch = markdown.match(/## Required MCP Tools[\s\S]*?```(?:yaml|json)?\n([\s\S]+?)```/i);
    if (toolsMatch) {
      metadata.requiredTools = toolsMatch[1]
        .split('\n')
        .map(line => line.trim().replace(/^-\s*/, ''))
        .filter(Boolean);
    }

    // Extract required integrations
    const integrationsMatch = markdown.match(/## Required Integrations[\s\S]*?```(?:yaml|json)?\n([\s\S]+?)```/i);
    if (integrationsMatch) {
      metadata.requiredIntegrations = integrationsMatch[1]
        .split('\n')
        .map(line => line.trim().replace(/^-\s*/, ''))
        .filter(Boolean);
    }

    return metadata;
  }

  private getAgentIcon(agentId: string): string {
    const iconMap: Record<string, string> = {
      // AWS
      's3': '🪣', 'lambda': '⚡', 'dynamodb': '🗄️', 'cloudfront': '🌐',
      'cloudwatch': '📊', 'sns': '📬', 'sqs': '📮', 'ses': '📧',
      'iam': '🔐', 'rds': '🗃️', 'eks': '☸️', 'route53': '🔀', 'eventbridge': '🌉',

      // Frameworks
      'django': '🐍', 'rails': '💎', 'laravel': '🐘', 'react': '⚛️',
      'vue': '💚', 'solidjs': '⚡', 'nextjs': '▲',

      // Tools
      'terraform': '🏗️', 'github': '🐙', 'slack': '💬', 'stripe': '💳',
      'vercel': '▲', 'rust': '🦀', 'google': '📈',

      // Roles
      'conductor': '🎯', 'critic': '🔍', 'sweeper': '🧹',
      'code': '💻', 'api': '🔌', 'backend': '⚙️', 'frontend': '🎨',
      'event': '🌉'
    };

    const agentLower = agentId.toLowerCase();
    for (const [key, icon] of Object.entries(iconMap)) {
      if (agentLower.includes(key)) return icon;
    }

    return '🤖';
  }

  private getAgentColor(category: string): string {
    const colorMap: Record<string, string> = {
      'orchestrators': 'bg-indigo-500',
      'core': 'bg-gray-600',
      'universal': 'bg-green-500',
      'specialized': 'bg-cyan-500',
      'integrations': 'bg-pink-500',
      'custom': 'bg-purple-500'
    };

    return colorMap[category] || 'bg-gray-500';
  }
}

/**
 * Hook to use AgentDefinitionService with current tenant context
 */
export function useAgentDefinitionService(artifactService: ArtifactService, mcpClient: any) {
  return new AgentDefinitionService(artifactService, mcpClient);
}
