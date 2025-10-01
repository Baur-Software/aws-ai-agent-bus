// Service to fetch and manage MCP tools from connected servers
import { mcpRegistry } from './MCPCapabilityRegistry';

export interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema?: {
    type: 'object';
    properties?: Record<string, any>;
    required?: string[];
  };
  outputSchema?: {
    type: 'object';
    properties?: Record<string, any>;
  };
  server?: string;
}

export interface MCPServerTools {
  serverId: string;
  serverName: string;
  tools: MCPToolDefinition[];
  resources?: any[];
  prompts?: any[];
}

class MCPToolService {
  private connectedServers: Map<string, MCPServerTools> = new Map();
  private listeners: Set<(tools: MCPServerTools[]) => void> = new Set();

  // Fetch tools from a specific MCP server
  async fetchServerTools(serverId: string): Promise<MCPToolDefinition[]> {
    try {
      const dashboardServer = (window as any).dashboardServer;
      if (!dashboardServer) return [];

      // Call the MCP server to list its tools
      const result = await dashboardServer.sendMessageWithResponse({
        type: 'mcp_call',
        server: serverId,
        method: 'tools/list',
        params: {}
      });

      if (result?.tools) {
        return result.tools.map((tool: any) => ({
          name: tool.name,
          description: tool.description || '',
          inputSchema: tool.inputSchema,
          outputSchema: tool.outputSchema,
          server: serverId
        }));
      }
    } catch (error) {
      console.warn(`Failed to fetch tools from server ${serverId}:`, error);
    }
    return [];
  }

  // Fetch tools from all connected MCP servers
  async fetchAllConnectedTools(): Promise<MCPServerTools[]> {
    try {
      const dashboardServer = (window as any).dashboardServer;
      if (!dashboardServer) return [];

      // Get list of connected MCP servers
      const serversResult = await dashboardServer.sendMessageWithResponse({
        type: 'mcp_list_servers'
      });

      if (!serversResult?.servers) return [];

      const allServerTools: MCPServerTools[] = [];

      // Fetch tools from each server
      for (const server of serversResult.servers) {
        const tools = await this.fetchServerTools(server.id);
        if (tools.length > 0) {
          const serverTools: MCPServerTools = {
            serverId: server.id,
            serverName: server.name || server.id,
            tools
          };
          this.connectedServers.set(server.id, serverTools);
          allServerTools.push(serverTools);
        }
      }

      // Notify listeners
      this.notifyListeners();

      return allServerTools;
    } catch (error) {
      console.error('Failed to fetch MCP tools:', error);
      return [];
    }
  }

  // Get tools for a specific server
  getServerTools(serverId: string): MCPToolDefinition[] {
    return this.connectedServers.get(serverId)?.tools || [];
  }

  // Get all tools from all servers
  getAllTools(): MCPToolDefinition[] {
    const allTools: MCPToolDefinition[] = [];
    this.connectedServers.forEach(server => {
      allTools.push(...server.tools);
    });
    return allTools;
  }

  // Get all server tools grouped by server
  getAllServerTools(): MCPServerTools[] {
    return Array.from(this.connectedServers.values());
  }

  // Convert MCP tools to workflow nodes for the panel
  convertToWorkflowNodes(tools: MCPToolDefinition[], serverId: string, serverName: string) {
    return tools.map(tool => ({
      type: `mcp-tool-${serverId}-${tool.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
      name: tool.name,
      description: tool.description || `Execute ${tool.name} on ${serverName}`,
      icon: this.getToolIcon(tool.name),
      color: this.getToolColor(tool.name),
      category: 'mcp-tools',
      serverId,
      toolName: tool.name,
      inputs: this.parseInputs(tool.inputSchema),
      outputs: this.parseOutputs(tool.outputSchema)
    }));
  }

  // Parse input schema to node inputs
  private parseInputs(schema?: any) {
    if (!schema?.properties) return [];

    return Object.entries(schema.properties).map(([key, prop]: [string, any]) => ({
      name: key,
      type: prop.type || 'string',
      required: schema.required?.includes(key) || false,
      description: prop.description
    }));
  }

  // Parse output schema to node outputs
  private parseOutputs(schema?: any) {
    if (!schema?.properties) {
      return [{ name: 'result', type: 'any' }];
    }

    return Object.entries(schema.properties).map(([key, prop]: [string, any]) => ({
      name: key,
      type: prop.type || 'any',
      description: prop.description
    }));
  }

  // Get icon for a tool based on its name
  private getToolIcon(toolName: string): string {
    const name = toolName.toLowerCase();

    // Storage/Database
    if (name.includes('kv') || name.includes('store') || name.includes('database')) return '🗄️';
    if (name.includes('artifact') || name.includes('file')) return '📁';

    // Events/Messaging
    if (name.includes('event') || name.includes('message')) return '📬';
    if (name.includes('notification') || name.includes('alert')) return '🔔';

    // Analytics
    if (name.includes('analytics') || name.includes('metric')) return '📊';
    if (name.includes('report') || name.includes('dashboard')) return '📈';

    // AI/Agents
    if (name.includes('agent') || name.includes('ai')) return '🤖';
    if (name.includes('delegate') || name.includes('assign')) return '🎯';

    // Workflow
    if (name.includes('workflow') || name.includes('process')) return '⚙️';
    if (name.includes('execute') || name.includes('run')) return '▶️';

    // Integration
    if (name.includes('api') || name.includes('integration')) return '🔌';
    if (name.includes('webhook') || name.includes('http')) return '🔗';

    // Default
    return '🔧';
  }

  // Get color for a tool based on its type
  private getToolColor(toolName: string): string {
    const name = toolName.toLowerCase();

    if (name.includes('kv') || name.includes('store')) return 'bg-purple-500';
    if (name.includes('event') || name.includes('message')) return 'bg-blue-500';
    if (name.includes('agent') || name.includes('ai')) return 'bg-indigo-500';
    if (name.includes('analytics') || name.includes('metric')) return 'bg-green-500';
    if (name.includes('workflow') || name.includes('process')) return 'bg-orange-500';
    if (name.includes('api') || name.includes('integration')) return 'bg-pink-500';

    return 'bg-gray-500';
  }

  // Subscribe to tool updates
  subscribe(listener: (tools: MCPServerTools[]) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // Notify all listeners of changes
  private notifyListeners() {
    const allTools = this.getAllServerTools();
    this.listeners.forEach(listener => listener(allTools));
  }

  // Clear all cached tools
  clear() {
    this.connectedServers.clear();
    this.notifyListeners();
  }
}

// Singleton instance
export const mcpToolService = new MCPToolService();