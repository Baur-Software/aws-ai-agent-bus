/**
 * Agent API for dashboard-ui
 * Connects to dashboard-server via WebSocket for agent CRUD operations
 *
 * Uses the mcp_call message type with agent tools:
 * - agent_list: List agents for an owner
 * - agent_get: Get a specific agent with markdown content
 * - agent_create: Create a new agent
 * - agent_update: Update an existing agent
 * - agent_delete: Delete an agent
 */

// Types matching backend AgentHandler response shapes
export interface Agent {
  agentId: string;
  ownerType: 'organization' | 'user';
  ownerId: string;
  name: string;
  description?: string;
  tags?: string[];
  s3Key?: string;
  version?: string;
  createdAt?: string;
  updatedAt?: string;
  isActive?: boolean;
}

export interface AgentWithMarkdown extends Agent {
  markdown: string;
}

export interface ListAgentsResult {
  success: boolean;
  agents: Agent[];
  count?: number;
  timestamp?: string;
  error?: string;
}

export interface GetAgentResult {
  success: boolean;
  agent: Agent | null;
  markdown: string;
  timestamp?: string;
  error?: string;
}

export interface CreateAgentResult {
  success: boolean;
  agent?: Agent;
  message?: string;
  error?: string;
}

export interface UpdateAgentResult {
  success: boolean;
  agent?: Agent;
  newVersion?: string;
  message?: string;
  error?: string;
}

export interface DeleteAgentResult {
  success: boolean;
  message?: string;
  error?: string;
}

// WebSocket MCP tool call interface
type MCPToolCaller = (tool: string, params: Record<string, any>) => Promise<any>;

/**
 * Creates an agent API client using the provided MCP tool caller
 * This should be called from a component with access to useDashboardServer()
 *
 * @example
 * ```tsx
 * const { callMCPTool } = useDashboardServer();
 * const agentApi = createAgentApi(callMCPTool);
 *
 * const agents = await agentApi.listAgents('user', userId);
 * ```
 */
export function createAgentApi(callMCPTool: MCPToolCaller) {
  return {
    /**
     * List agents for an organization or user
     */
    async listAgents(
      ownerType: 'organization' | 'user',
      ownerId: string
    ): Promise<ListAgentsResult> {
      try {
        const result = await callMCPTool('agent_list', {
          ownerType,
          ownerId
        });

        return {
          success: result?.success ?? false,
          agents: result?.agents ?? [],
          count: result?.count,
          timestamp: result?.timestamp,
          error: result?.error
        };
      } catch (error) {
        console.error('Failed to list agents:', error);
        return {
          success: false,
          agents: [],
          error: error instanceof Error ? error.message : 'Failed to list agents'
        };
      }
    },

    /**
     * Get a specific agent with its markdown content
     */
    async getAgent(
      agentId: string,
      ownerType: 'organization' | 'user',
      ownerId: string
    ): Promise<GetAgentResult> {
      try {
        const result = await callMCPTool('agent_get', {
          agentId,
          ownerType,
          ownerId
        });

        return {
          success: result?.success ?? false,
          agent: result?.agent ?? null,
          markdown: result?.markdown ?? '',
          timestamp: result?.timestamp,
          error: result?.error
        };
      } catch (error) {
        console.error('Failed to get agent:', error);
        return {
          success: false,
          agent: null,
          markdown: '',
          error: error instanceof Error ? error.message : 'Failed to get agent'
        };
      }
    },

    /**
     * Create a new agent
     */
    async createAgent(params: {
      ownerType: 'organization' | 'user';
      ownerId: string;
      name: string;
      description?: string;
      markdown: string;
      tags?: string[];
    }): Promise<CreateAgentResult> {
      try {
        const result = await callMCPTool('agent_create', params);

        return {
          success: result?.success ?? false,
          agent: result?.agent,
          message: result?.message,
          error: result?.error
        };
      } catch (error) {
        console.error('Failed to create agent:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to create agent'
        };
      }
    },

    /**
     * Update an existing agent
     */
    async updateAgent(params: {
      agentId: string;
      ownerType: 'organization' | 'user';
      ownerId: string;
      markdown: string;
      description?: string;
      tags?: string[];
      changelog?: string;
    }): Promise<UpdateAgentResult> {
      try {
        const result = await callMCPTool('agent_update', params);

        return {
          success: result?.success ?? false,
          agent: result?.agent,
          newVersion: result?.newVersion,
          message: result?.message,
          error: result?.error
        };
      } catch (error) {
        console.error('Failed to update agent:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to update agent'
        };
      }
    },

    /**
     * Delete an agent
     */
    async deleteAgent(
      agentId: string,
      ownerType: 'organization' | 'user',
      ownerId: string
    ): Promise<DeleteAgentResult> {
      try {
        const result = await callMCPTool('agent_delete', {
          agentId,
          ownerType,
          ownerId
        });

        return {
          success: result?.success ?? false,
          message: result?.message,
          error: result?.error
        };
      } catch (error) {
        console.error('Failed to delete agent:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to delete agent'
        };
      }
    }
  };
}

/**
 * Standalone functions for backwards compatibility
 * These require a global MCP tool caller to be set via setMCPToolCaller()
 */
let globalMCPToolCaller: MCPToolCaller | null = null;

/**
 * Set the global MCP tool caller for standalone functions
 * Call this once from your app initialization with useDashboardServer().callMCPTool
 */
export function setMCPToolCaller(caller: MCPToolCaller): void {
  globalMCPToolCaller = caller;
}

function getGlobalApi() {
  if (!globalMCPToolCaller) {
    throw new Error(
      'Agent API not initialized. Call setMCPToolCaller() first, or use createAgentApi() with useDashboardServer().callMCPTool'
    );
  }
  return createAgentApi(globalMCPToolCaller);
}

export async function listAgents(
  ownerType: 'organization' | 'user',
  ownerId: string
): Promise<Agent[]> {
  const result = await getGlobalApi().listAgents(ownerType, ownerId);
  return result.agents;
}

export async function getAgent(
  agentId: string,
  ownerType: 'organization' | 'user',
  ownerId: string
): Promise<AgentWithMarkdown | null> {
  const result = await getGlobalApi().getAgent(agentId, ownerType, ownerId);
  if (!result.success || !result.agent) {
    return null;
  }
  return {
    ...result.agent,
    markdown: result.markdown
  };
}

export async function createAgent(params: {
  ownerType: 'organization' | 'user';
  ownerId: string;
  name: string;
  description?: string;
  markdown: string;
  tags?: string[];
  permissions?: Record<string, any>;
}): Promise<CreateAgentResult> {
  return getGlobalApi().createAgent(params);
}

export async function updateAgent(params: {
  agentId: string;
  ownerType: 'organization' | 'user';
  ownerId: string;
  markdown: string;
  description?: string;
  tags?: string[];
  permissions?: Record<string, any>;
}): Promise<UpdateAgentResult> {
  return getGlobalApi().updateAgent(params);
}

export async function deleteAgent(
  agentId: string,
  ownerType: 'organization' | 'user',
  ownerId: string
): Promise<DeleteAgentResult> {
  return getGlobalApi().deleteAgent(agentId, ownerType, ownerId);
}
