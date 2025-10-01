import { MCPServerListing, MCPServerCapability } from '../types/mcpCatalog';

export interface MCPAgent {
  id: string;
  name: string;
  description: string;
  serverId: string;
  icon: string;
  color: string;
  capabilities: string[];
  group: 'mcp-apps';
}

export interface MCPWorkflowNode {
  type: string;
  name: string;
  description: string;
  category: 'apps';
  serverId: string;
  capability: string;
  icon: string;
  color: string;
  inputs?: {
    name: string;
    type: string;
    required: boolean;
  }[];
  outputs?: {
    name: string;
    type: string;
  }[];
}

class MCPCapabilityRegistry {
  private connectedApps: Map<string, MCPServerListing> = new Map();
  private appAgents: Map<string, MCPAgent> = new Map();
  private appNodes: Map<string, MCPWorkflowNode[]> = new Map();
  private listeners: Set<(event: MCPRegistryEvent) => void> = new Set();

  // Event types for registry changes
  public readonly events = {
    APP_CONNECTED: 'app_connected',
    APP_DISCONNECTED: 'app_disconnected',
    AGENTS_UPDATED: 'agents_updated',
    NODES_UPDATED: 'nodes_updated'
  } as const;

  // Register a connected MCP app and generate its agent and nodes
  async registerApp(server: MCPServerListing, capabilities?: MCPServerCapability[]): Promise<void> {
    const serverId = server.id;

    // Store the connected app
    this.connectedApps.set(serverId, server);

    // Generate specialized agent for this app
    const agent = this.generateAgent(server);
    this.appAgents.set(serverId, agent);

    // Generate workflow nodes from capabilities
    const nodes = this.generateWorkflowNodes(server, capabilities);
    this.appNodes.set(serverId, nodes);

    // Store in KV store for persistence
    await this.persistToKVStore();

    // Notify listeners
    this.emit({
      type: this.events.APP_CONNECTED,
      serverId,
      agent,
      nodes
    });
  }

  // Unregister a disconnected app
  async unregisterApp(serverId: string): Promise<void> {
    this.connectedApps.delete(serverId);
    this.appAgents.delete(serverId);
    this.appNodes.delete(serverId);

    await this.persistToKVStore();

    this.emit({
      type: this.events.APP_DISCONNECTED,
      serverId
    });
  }

  // Generate a specialized agent for an MCP app
  private generateAgent(server: MCPServerListing): MCPAgent {
    return {
      id: `agent-mcp-${server.id}`,
      name: `${server.name} Agent`,
      description: `Specialized agent for ${server.name} - ${server.description}`,
      serverId: server.id,
      icon: this.getAppIcon(server),
      color: this.getAppColor(server.category),
      capabilities: server.capabilities || [],
      group: 'mcp-apps'
    };
  }

  // Generate workflow nodes from MCP capabilities
  private generateWorkflowNodes(
    server: MCPServerListing,
    capabilities?: MCPServerCapability[]
  ): MCPWorkflowNode[] {
    const nodes: MCPWorkflowNode[] = [];

    // Add input node for the app
    nodes.push({
      type: `mcp-${server.id}-input`,
      name: `${server.name} Input`,
      description: `Receive data from ${server.name}`,
      category: 'apps',
      serverId: server.id,
      capability: 'input',
      icon: this.getAppIcon(server),
      color: this.getAppColor(server.category),
      outputs: [
        { name: 'data', type: 'any' },
        { name: 'metadata', type: 'object' }
      ]
    });

    // Add output node for the app
    nodes.push({
      type: `mcp-${server.id}-output`,
      name: `${server.name} Output`,
      description: `Send data to ${server.name}`,
      category: 'apps',
      serverId: server.id,
      capability: 'output',
      icon: this.getAppIcon(server),
      color: this.getAppColor(server.category),
      inputs: [
        { name: 'data', type: 'any', required: true }
      ]
    });

    // Add action nodes based on capabilities
    if (capabilities) {
      capabilities.forEach(cap => {
        nodes.push({
          type: `mcp-${server.id}-${cap.name}`,
          name: cap.name,
          description: cap.description,
          category: 'apps',
          serverId: server.id,
          capability: cap.name,
          icon: this.getAppIcon(server),
          color: this.getAppColor(server.category),
          inputs: this.parseSchemaToInputs(cap.inputSchema),
          outputs: this.parseSchemaToOutputs(cap.outputSchema)
        });
      });
    } else {
      // Use generic capabilities from server listing
      server.capabilities?.forEach(capName => {
        nodes.push({
          type: `mcp-${server.id}-${capName.toLowerCase().replace(/\s+/g, '-')}`,
          name: capName,
          description: `${capName} action for ${server.name}`,
          category: 'apps',
          serverId: server.id,
          capability: capName,
          icon: this.getAppIcon(server),
          color: this.getAppColor(server.category)
        });
      });
    }

    return nodes;
  }

  // Parse JSON schema to input definitions
  private parseSchemaToInputs(schema?: any): MCPWorkflowNode['inputs'] {
    if (!schema || !schema.properties) return [];

    return Object.entries(schema.properties).map(([key, value]: [string, any]) => ({
      name: key,
      type: value.type || 'any',
      required: schema.required?.includes(key) || false
    }));
  }

  // Parse JSON schema to output definitions
  private parseSchemaToOutputs(schema?: any): MCPWorkflowNode['outputs'] {
    if (!schema || !schema.properties) return [{ name: 'result', type: 'any' }];

    return Object.entries(schema.properties).map(([key, value]: [string, any]) => ({
      name: key,
      type: value.type || 'any'
    }));
  }

  // Get icon for app based on category or name
  private getAppIcon(server: MCPServerListing): string {
    const iconMap: Record<string, string> = {
      'Analytics': '📊',
      'CRM': '👥',
      'Development': '💻',
      'Database': '🗄️',
      'Communication': '💬',
      'Enterprise': '🏢',
      'github': '🐙',
      'slack': '💬',
      'jira': '📋',
      'stripe': '💳',
      'aws': '☁️',
      'google': '🔍',
      'microsoft': '🪟',
      'openai': '🤖',
      'anthropic': '🧠'
    };

    // Check for specific app names
    const lowerName = server.name.toLowerCase();
    for (const [key, icon] of Object.entries(iconMap)) {
      if (lowerName.includes(key)) return icon;
    }

    // Fall back to category icon
    return iconMap[server.category] || '🔌';
  }

  // Get color for app based on category
  private getAppColor(category: MCPServerListing['category']): string {
    const colorMap: Record<MCPServerListing['category'], string> = {
      'Analytics': 'bg-purple-500',
      'CRM': 'bg-blue-500',
      'Development': 'bg-gray-600',
      'Database': 'bg-green-500',
      'Communication': 'bg-indigo-500',
      'Enterprise': 'bg-yellow-600',
      'Other': 'bg-slate-500'
    };

    return colorMap[category] || 'bg-slate-500';
  }

  // Persist registry to KV store
  private async persistToKVStore(): Promise<void> {
    try {
      // Get dashboard server instance
      const dashboardServer = (window as any).dashboardServer;
      if (!dashboardServer) return;

      // Store connected apps list
      await dashboardServer.sendMessageWithResponse({
        type: 'mcp_call',
        tool: 'kv_set',
        arguments: {
          key: 'mcp-connected-apps',
          value: JSON.stringify({
            apps: Array.from(this.connectedApps.keys()),
            agents: Array.from(this.appAgents.values()),
            nodes: Object.fromEntries(this.appNodes)
          }),
          ttl_hours: 168 // 1 week
        }
      });
    } catch (error) {
      console.warn('Failed to persist MCP registry to KV store:', error);
    }
  }

  // Load registry from KV store
  async loadFromKVStore(): Promise<void> {
    try {
      const dashboardServer = (window as any).dashboardServer;
      if (!dashboardServer) return;

      const result = await dashboardServer.sendMessageWithResponse({
        type: 'mcp_call',
        tool: 'kv_get',
        arguments: {
          key: 'mcp-connected-apps'
        }
      });

      if (result?.data?.value) {
        const data = JSON.parse(result.data.value);

        // Restore agents
        if (data.agents) {
          data.agents.forEach((agent: MCPAgent) => {
            this.appAgents.set(agent.serverId, agent);
          });
        }

        // Restore nodes
        if (data.nodes) {
          Object.entries(data.nodes).forEach(([serverId, nodes]) => {
            this.appNodes.set(serverId, nodes as MCPWorkflowNode[]);
          });
        }

        // Emit update events
        this.emit({ type: this.events.AGENTS_UPDATED });
        this.emit({ type: this.events.NODES_UPDATED });
      }
    } catch (error) {
      console.log('No persisted MCP registry found, starting fresh');
    }
  }

  // Get all MCP agents
  getAgents(): MCPAgent[] {
    return Array.from(this.appAgents.values());
  }

  // Get nodes for a specific app or all apps
  getNodes(serverId?: string): MCPWorkflowNode[] {
    if (serverId) {
      return this.appNodes.get(serverId) || [];
    }

    // Return all nodes from all apps
    const allNodes: MCPWorkflowNode[] = [];
    this.appNodes.forEach(nodes => allNodes.push(...nodes));
    return allNodes;
  }

  // Subscribe to registry events
  subscribe(listener: (event: MCPRegistryEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // Emit event to all listeners
  private emit(event: MCPRegistryEvent): void {
    this.listeners.forEach(listener => listener(event));
  }
}

// Event types
export interface MCPRegistryEvent {
  type: string;
  serverId?: string;
  agent?: MCPAgent;
  nodes?: MCPWorkflowNode[];
}

// Singleton instance
export const mcpRegistry = new MCPCapabilityRegistry();