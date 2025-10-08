import { createSignal, createEffect, Show, For, onMount } from 'solid-js';
import { Search, GripVertical, X, Pin, PinOff, Plus, Sparkles, ArrowLeft, ChartColumn, Globe, CreditCard, Shield, Users, Building, Square, Circle, Triangle, ArrowRight, Diamond, Hexagon, Star, Heart, Settings, RefreshCw } from 'lucide-solid';
// Data visualization nodes
import {
  ChartNodeConfig,
  DEFAULT_CHART_CONFIG,
  TableNodeConfig,
  DEFAULT_TABLE_CONFIG,
  MetricsNodeConfig,
  DEFAULT_METRICS_CONFIG,
  isDataVisNode,
  type ChartConfig,
  type TableConfig,
  type MetricsConfig
} from '@ai-agent-bus/datavis-nodes';
import { useDashboardServer } from '../../../contexts/DashboardServerContext';
import { useDragDrop, useDragSource } from '../../../contexts/DragDropContext';
import { useIntegrations } from '../../../contexts/IntegrationsContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useArtifactService } from '../../../services/ArtifactService';
import { useAgentDefinitionService } from '../../../services/AgentDefinitionService';
import { listAgents } from '../../../api/agents'; // new API import
import IntegrationsGrid from '../../IntegrationsGrid';
import { mcpRegistry } from '../../../services/MCPCapabilityRegistry';
import { agentRegistryInitializer } from '../../../services/AgentRegistryInitializer';
import { mcpToolService, MCPServerTools } from '../../../services/MCPToolService';
import { CreateAgentWizard } from '../../CreateAgentWizard';
import { Agent } from 'http';
import { WorkflowNode } from './WorkflowNodeDetails';
import { useNavigate } from '@solidjs/router';
import NodeConfigRenderer from './NodeConfigRenderer';
import { useFloatingPanelResize } from '../../../hooks/useFloatingPanelResize';
import {
  getAllNodes,
  getNodesByCategory,
  getNodeDefinition as getRegistryNodeDefinition,
  type NodeDefinition as RegistryNodeDefinition
} from '@ai-agent-bus/workflow-nodes';

interface FloatingNodePanelProps {
  onDragStart: (nodeType: string, e: DragEvent) => void;
  connectedApps?: string[];
  onConnectApp: (app: string) => void;
  onPositionChange?: (x: number, y: number) => void;
  onPinnedChange?: (isPinned: boolean) => void;
  onVisibilityChange?: (isVisible: boolean) => void;
  initialPosition?: { x: number; y: number };
  initialPinned?: boolean;
  selectedNode?: WorkflowNode | null;
  onNodeUpdate?: (node: WorkflowNode) => void;
  availableModels?: string[];
  onNavigate?: (page: string) => void;
}

interface NodeCategory {
  id: string;
  name: string;
  icon: string;
  nodes: {
    type: string;
    name: string;
    description: string;
    icon: string;
    color: string;
    requiresConnectedApp?: string;
  }[];
}

export default function FloatingNodePanel(props: FloatingNodePanelProps) {
  // Calculate initial position that avoids toolbar collision
  const getSafeInitialPosition = () => {
    if (props.initialPosition) return props.initialPosition;

    // Default to right edge, below toolbar (80px for toolbar + 20px margin)
    return {
      x: window.innerWidth - 320,
      y: 100 // Safe distance below top toolbar
    };
  };

  const [position, setPosition] = createSignal(getSafeInitialPosition());
  const [isDragging, setIsDragging] = createSignal(false);
  const [isResizing, setIsResizing] = createSignal(false);
  const [panelWidth, setPanelWidth] = createSignal(320);
  const [panelHeight, setPanelHeight] = createSignal(400);
  const [activeCategory, setActiveCategory] = createSignal('ai-agents');
  const [searchQuery, setSearchQuery] = createSignal('');
  const [isVisible, setIsVisible] = createSignal(true);
  const [isPinned, setIsPinned] = createSignal(props.initialPinned ?? true);
  const [agentNodes, setAgentNodes] = createSignal<any>({});
  const [collapsedGroups, setCollapsedGroups] = createSignal<Set<string>>(new Set());
  const [loading, setLoading] = createSignal(false);
  const [showCreateAgent, setShowCreateAgent] = createSignal(false);
  const [creatingAgent, setCreatingAgent] = createSignal(false);
  const [agentName, setAgentName] = createSignal('');
  const [agentDescription, setAgentDescription] = createSignal('');
  const [agentSpecialty, setAgentSpecialty] = createSignal('');
  const [showConnectedApps, setShowConnectedApps] = createSignal(false);
  const [currentView, setCurrentView] = createSignal<'nodes' | 'details'>('nodes');

  // Show details if there's a selected node OR user manually navigated to details
  const showingDetails = () => (props.selectedNode !== null && props.selectedNode !== undefined) || currentView() === 'details';
  const [agents, setAgents] = createSignal<Agent[]>([]);
  const [mcpServerTools, setMcpServerTools] = createSignal<MCPServerTools[]>([]);
  const [loadingMcpTools, setLoadingMcpTools] = createSignal(false);
  const [availableModels, setAvailableModels] = createSignal<Array<{ id: string; name: string }>>([]);
  const navigate = useNavigate();

  // Get contexts
  const { user } = useAuth();
  const dashboardServer = useDashboardServer();
  const { callMCPTool } = dashboardServer;
  const integrations = useIntegrations();
  const artifactService = useArtifactService();
  const agentService = useAgentDefinitionService(artifactService, { callMCPTool });

  // Fetch agents for current org/user
  createEffect(async () => {
    const currentUser = user();
    if (!currentUser) return;

    const ownerType = 'user'; // Start with user agents
    const ownerId = currentUser.userId;
    const agentList = await listAgents(ownerType, ownerId);
    setAgents(agentList);
  });

  // Generate dynamic app nodes based on connected integrations and MCP tools
  const generateDynamicAppNodes = () => {
    const connectedApps = integrations.getAllConnections();
    const dynamicNodes = [];

    // TODO: Load integration configs dynamically from KV store (integration-{serviceId})
    // For now, no dynamic nodes from integrations until we have real connections
    // Object.entries(connectedApps).forEach(([appId, connections]) => {
    //   if (connections.length > 0) {
    //     // Would need to: await callMCPTool('kv_get', { key: `integration-${appId}` })
    //     // to get workflow_capabilities, name, icon, color
    //   }
    // });

    // Add MCP app nodes from the registry
    const mcpNodes = mcpRegistry.getNodes();
    mcpNodes.forEach(node => {
      dynamicNodes.push({
        type: node.type,
        name: node.name,
        description: node.description,
        icon: node.icon,
        color: node.color,
        requiresConnectedApp: node.serverId,
        inputs: node.inputs,
        outputs: node.outputs
      });
    });

    // Add MCP tool nodes from connected servers
    const serverTools = mcpServerTools();
    serverTools.forEach(server => {
      const toolNodes = mcpToolService.convertToWorkflowNodes(server.tools, server.serverId, server.serverName);
      toolNodes.forEach(node => {
        dynamicNodes.push({
          type: node.type,
          name: `${server.serverName}: ${node.name}`,
          description: node.description,
          icon: node.icon,
          color: node.color,
          requiresConnectedApp: false, // MCP tools don't require app connection
          category: 'mcp-tools',
          inputs: node.inputs,
          outputs: node.outputs
        });
      });
    });

    return dynamicNodes;
  };

  // Load available agents via dashboard server and organize by groups
  const loadAgents = async () => {
    try {
      setLoading(true);

      // First, try to initialize agents using AgentRegistryInitializer
      // This will load existing agents from .claude/agents and organize them
      try {
        const organizedAgents = await agentRegistryInitializer.initialize();

        // Convert organized agents to the format expected by the panel
        const agentGroups: Record<string, any[]> = {
          'orchestrators': organizedAgents.orchestrators || [],
          'core': organizedAgents.core || [],
          'specialized-aws': organizedAgents.specialized?.aws || [],
          'specialized-frameworks': organizedAgents.specialized?.frameworks || [],
          'specialized-devops': organizedAgents.specialized?.devops || [],
          'specialized-integrations': organizedAgents.specialized?.integrations || [],
          'specialized-other': organizedAgents.specialized?.other || [],
          'universal': organizedAgents.universal || [],
          'mcp-apps': organizedAgents['mcp-apps'] || []
        };

        // Add MCP app agents from the registry, grouped by app
        const mcpAgents = mcpRegistry.getAgents();
        mcpAgents.forEach(agent => {
          // Group by the app name (extracted from serverId)
          const groupKey = `mcp-app-${agent.serverId}`;
          if (!agentGroups[groupKey]) {
            agentGroups[groupKey] = [];
          }
          agentGroups[groupKey].push({
            type: agent.id,
            name: agent.name,
            description: agent.description,
            icon: agent.icon,
            color: agent.color,
            group: groupKey,
            serverId: agent.serverId
          });
        });

        setAgentNodes(agentGroups);
        return;
      } catch (initError) {
        console.log('Could not initialize from agent registry, trying KV store fallback');
      }

      // Fallback to KV store if initialization fails
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Agent load timeout')), 3000)
      );

      const fetchPromise = dashboardServer.sendMessageWithResponse({
        type: 'mcp_call',
        tool: 'kv_get',
        arguments: {
          key: 'tenant-agents-registry'
        }
      });

      // Race between fetch and timeout
      const result = await Promise.race([fetchPromise, timeoutPromise]) as any;

      // Check if we have a valid response with agents data
      if (result && result.data && result.data.agents && Array.isArray(result.data.agents) && result.data.agents.length > 0) {
        console.log('Raw agents from MCP:', result.data.agents);
        console.log('Total raw agents:', result.data.agents.length);

        const filteredAgents = result.data.agents
          .filter((agent: string) =>
            !agent.includes('README') &&
            !agent.includes('AGENT_') &&
            !agent.includes('DELEGATION_') &&
            !agent.includes('_template') &&
            !agent.includes('INTEGRATION_SYSTEM_GUIDE') &&
            !agent.includes('AGENT_CREATION_GUIDELINES') &&
            !agent.includes('AGENT_TEMPLATE') &&
            !agent.includes('token-economy')
          );

        console.log('Filtered agents:', filteredAgents);
        console.log('Total filtered agents:', filteredAgents.length);

        // Group agents by directory structure
        const agentGroups: Record<string, any[]> = {
          'orchestrators': [],
          'specialized': [],
          'universal': [],
          'core': [],
          'mcp-apps': [],
          'other': []
        };

        filteredAgents.forEach((agent: string) => {
          const cleanName = agent.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          const agentType = agent.toLowerCase().replace(/[^a-z0-9]/g, '-');

          const agentNode = {
            type: agentType,
            name: cleanName,
            description: `${cleanName} specialized agent`,
            icon: getAgentIcon(agent),
            color: getAgentColor(agent),
            group: determineAgentGroup(agent)
          };

          // Group by directory structure or inferred type
          const group = determineAgentGroup(agent);
          if (agentGroups[group]) {
            agentGroups[group].push(agentNode);
          } else {
            agentGroups['other'].push(agentNode);
          }
        });

        // Add MCP app agents to the groups, organized by app
        const mcpAgents = mcpRegistry.getAgents();
        mcpAgents.forEach(agent => {
          // Group by the app name (extracted from serverId)
          const groupKey = `mcp-app-${agent.serverId}`;
          if (!agentGroups[groupKey]) {
            agentGroups[groupKey] = [];
          }
          agentGroups[groupKey].push({
            type: agent.id,
            name: agent.name,
            description: agent.description,
            icon: agent.icon,
            color: agent.color,
            group: groupKey,
            serverId: agent.serverId
          });
        });

        setAgentNodes(agentGroups);
      } else {
        // Key exists but no agents found, use defaults silently
        console.log('Agent registry empty, using default agents');
      }
    } catch (error: any) {
      // Check if it's just a missing key or timeout (expected conditions)
      if (error?.message?.includes('not found') ||
          error?.message?.includes('does not exist') ||
          error?.message?.includes('timed out') ||
          error?.message?.includes('timeout')) {
        console.log('Agent registry not available, using default agents');
      } else {
        console.warn('Unexpected error loading agents:', error);
      }
      // Use fallback agents with grouped structure
      const fallbackGroups: Record<string, any[]> = {
        'orchestrators': [
          { type: 'agent-conductor', name: 'Conductor', description: 'Goal-driven planner and delegator', icon: '🎯', color: 'bg-indigo-500', group: 'orchestrators' },
          { type: 'agent-critic', name: 'Critic', description: 'Safety and verification agent', icon: '🔍', color: 'bg-red-500', group: 'orchestrators' },
        ],
        'specialized': [
          { type: 'agent-terraform', name: 'Terraform Expert', description: 'Infrastructure as code specialist', icon: '🏗️', color: 'bg-blue-500', group: 'specialized' },
          { type: 'agent-django', name: 'Django Expert', description: 'Python web framework specialist', icon: '🐍', color: 'bg-green-500', group: 'specialized' }
        ],
        'universal': [],
        'core': [],
        'mcp-apps': [],
        'other': []
      };

      // Add MCP app agents even in fallback, grouped by app
      const mcpAgents = mcpRegistry.getAgents();
      mcpAgents.forEach(agent => {
        // Group by the app name (extracted from serverId)
        const groupKey = `mcp-app-${agent.serverId}`;
        if (!fallbackGroups[groupKey]) {
          fallbackGroups[groupKey] = [];
        }
        fallbackGroups[groupKey].push({
          type: agent.id,
          name: agent.name,
          description: agent.description,
          icon: agent.icon,
          color: agent.color,
          group: groupKey,
          serverId: agent.serverId
        });
      });

      setAgentNodes(fallbackGroups);
    } finally {
      setLoading(false);
    }
  };

  // Helper to get a friendly app name from groupName
  const getAppDisplayName = (groupName: string) => {
    if (groupName.startsWith('mcp-app-')) {
      const serverId = groupName.replace('mcp-app-', '');
      // Try to get the actual app name from the MCP registry
      const agents = mcpRegistry.getAgents();
      const agent = agents.find(a => a.serverId === serverId);
      if (agent) {
        // Extract app name from agent name (e.g., "Google Analytics Agent" -> "Google Analytics")
        return agent.name.replace(' Agent', '').trim();
      }
      // Fallback: format the serverId nicely
      return serverId
        .replace(/^(integration|mcp)-/, '')
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    }
    return groupName.replace(/-/g, ' ').replace('specialized ', 'Specialized: ');
  };

  const determineAgentGroup = (agent: string) => {
    const agentLower = agent.toLowerCase();

    // Orchestrators - planning and coordination
    if (agentLower.includes('conductor') || agentLower.includes('critic') || agentLower.includes('sweeper')) {
      return 'orchestrators';
    }

    // Specialized - technical domain experts
    if (agentLower.includes('terraform') || agentLower.includes('django') || agentLower.includes('react') ||
        agentLower.includes('lambda') || agentLower.includes('expert') || agentLower.includes('specialist')) {
      return 'specialized';
    }

    // Universal - general purpose
    if (agentLower.includes('universal') || agentLower.includes('general') || agentLower.includes('assistant')) {
      return 'universal';
    }

    // Core - fundamental system agents
    if (agentLower.includes('core') || agentLower.includes('system') || agentLower.includes('base')) {
      return 'core';
    }

    // Default to other
    return 'other';
  };

  const getAgentIcon = (agent: string) => {
    if (agent.includes('conductor')) return '🎯';
    if (agent.includes('critic')) return '🔍';
    if (agent.includes('sweeper')) return '🧹';
    if (agent.includes('linkedin')) return '💼';
    return '🤖';
  };

  const getAgentColor = (agent: string) => {
    const colors = [
      'bg-indigo-500', 'bg-pink-500', 'bg-cyan-500', 'bg-green-600',
      'bg-purple-500', 'bg-orange-500', 'bg-blue-600', 'bg-red-500'
    ];
    return colors[agent.length % colors.length];
  };

  // Create a new agent using MCP delegation
  const createAgent = async () => {
    if (!agentName().trim() || !agentDescription().trim()) {
      return;
    }

    try {
      setCreatingAgent(true);

      // Use the agent delegation system to create a new agent via WebSocket
      const messageId = `create_agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const result = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Agent creation request timed out'));
        }, 30000);

        const handleMessage = (event: MessageEvent) => {
          try {
            const message = JSON.parse(event.data);
            if (message.id === messageId) {
              clearTimeout(timeout);
              window.removeEventListener('message', handleMessage);
              if (message.error) {
                reject(new Error(message.error));
              } else {
                resolve(message.result || message.data);
              }
            }
          } catch (error) {
            // Ignore parsing errors for other messages
          }
        };

        window.addEventListener('message', handleMessage);

        dashboardServer.sendMessage({
          id: messageId,
          type: 'mcp_call',
          tool: 'agent_delegateToAgent',
          params: {
            agentType: 'integration-specialist-generator',
            prompt: `Create a new AI agent with the following specifications:

        Name: ${agentName()}
        Description: ${agentDescription()}
        Specialty: ${agentSpecialty()}

        Please generate a complete agent definition including:
        1. Agent capabilities and tools
        2. Workflow integration points
        3. MCP tool mappings
        4. Example usage patterns`,
            userId: 'demo-user-123',
            sessionId: `session-${Date.now()}`,
            context: {
              type: 'agent-creation',
              name: agentName(),
              description: agentDescription(),
              specialty: agentSpecialty()
            }
          }
        });
      });

      if (result.success) {
        // Refresh the agent list to include the new agent
        await loadAgents();

        // Reset form and close modal
        setAgentName('');
        setAgentDescription('');
        setAgentSpecialty('');
        setShowCreateAgent(false);

        console.log('Agent created successfully:', result);
      } else {
        console.error('Failed to create agent:', result);
      }
    } catch (error) {
      console.error('Error creating agent:', error);
    } finally {
      setCreatingAgent(false);
    }
  };

  // Note: No custom wheel handler needed!
  // The WorkflowCanvas already checks for .floating-panel and .overflow-y-auto in its wheel handler
  // and returns early without zooming. This allows native browser scrolling to work correctly.

  // Load MCP tools from connected servers
  const loadMcpTools = async () => {
    try {
      setLoadingMcpTools(true);
      const tools = await mcpToolService.fetchAllConnectedTools();
      setMcpServerTools(tools);
    } catch (error) {
      console.warn('Failed to load MCP tools:', error);
    } finally {
      setLoadingMcpTools(false);
    }
  };

  // Load available models from system configuration
  const loadAvailableModels = async () => {
    try {
      const result = await callMCPTool('kv_get', { key: 'system-available-models' });
      if (result?.value) {
        const models = JSON.parse(result.value);
        setAvailableModels(models);
      }
    } catch (error) {
      console.error('Failed to load available models from KV store:', error);
      // Leave models empty - UI should handle empty state
      setAvailableModels([]);
    }
  };

  // Use floating panel resize hook to keep pinned panel at right edge
  useFloatingPanelResize({
    isPinned,
    panelWidth,
    onPositionChange: (x, y) => {
      setPosition({ x, y });
      props.onPositionChange?.(x, y);
    }
  });

  // Load agents on mount
  onMount(async () => {
    loadAgents();
    // Load any persisted MCP apps from KV store
    await mcpRegistry.loadFromKVStore();
    // Load MCP tools from connected servers
    await loadMcpTools();
    // Load available Bedrock models
    await loadAvailableModels();
  });

  // Panel drag handling
  let panelRef: HTMLDivElement | undefined;
  let dragStart = { x: 0, y: 0, panelX: 0, panelY: 0 };

  const handleMouseDown = (e: MouseEvent) => {
    const target = e.target as HTMLElement;

    // Don't drag if clicking on form inputs or interactive elements
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.tagName === 'BUTTON') {
      return;
    }

    // Only allow dragging from header or drag handle
    if (e.target !== e.currentTarget && !(target.closest('[data-drag-handle]')) || isPinned()) {
      return;
    }

    e.preventDefault(); // Only prevent default when actually dragging

    setIsDragging(true);
    const pos = position();
    dragStart = {
      x: e.clientX,
      y: e.clientY,
      panelX: pos.x,
      panelY: pos.y
    };

    let rafId: number | null = null;
    let lastMouseEvent: MouseEvent | null = null;

    const updatePosition = () => {
      if (!lastMouseEvent) return;

      const newX = dragStart.panelX + (lastMouseEvent.clientX - dragStart.x);
      const newY = dragStart.panelY + (lastMouseEvent.clientY - dragStart.y);

      // Keep panel within viewport bounds - more generous constraints
      const panelWidth = 320;
      const gutterSpace = 20;
      const maxX = window.innerWidth - gutterSpace;
      const minX = gutterSpace;
      const maxY = window.innerHeight - 100;

      const clampedPos = {
        x: Math.max(minX, Math.min(maxX, newX)),
        y: Math.max(0, Math.min(maxY, newY))
      };

      setPosition(clampedPos);
      props.onPositionChange?.(clampedPos.x, clampedPos.y);

      rafId = null;
      lastMouseEvent = null;
    };

    const handleMouseMove = (e: MouseEvent) => {
      lastMouseEvent = e;
      if (!rafId) {
        rafId = requestAnimationFrame(updatePosition);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handlePin = () => {
    const willBePinned = !isPinned();
    setIsPinned(willBePinned);

    let newPosition;
    if (willBePinned) {
      // When pinning, move to right edge and reset width
      newPosition = { x: window.innerWidth - panelWidth(), y: 0 };
      setPosition(newPosition);
    } else {
      // When unpinning, move to a floating position with gutter space
      newPosition = { x: window.innerWidth - panelWidth() - 20, y: 120 };
      setPosition(newPosition);
    }

    // Notify parent component
    props.onPinnedChange?.(willBePinned);
    props.onPositionChange?.(newPosition.x, newPosition.y);
  };

  // Panel resize handling
  const handleResizeMouseDown = (e: MouseEvent) => {
    if (isPinned()) return; // Only allow resize when unpinned

    e.preventDefault(); // Prevent text selection on drag start

    setIsResizing(true);
    const startWidth = panelWidth();
    const startHeight = panelHeight();
    const startX = e.clientX;
    const startY = e.clientY;

    let rafId: number | null = null;
    let lastMouseEvent: MouseEvent | null = null;

    const updateSize = () => {
      if (!lastMouseEvent) return;

      const deltaX = lastMouseEvent.clientX - startX;
      const deltaY = lastMouseEvent.clientY - startY;

      // Calculate new dimensions with constraints
      const newWidth = Math.max(280, Math.min(600, startWidth + deltaX));
      const newHeight = Math.max(200, Math.min(800, startHeight + deltaY));

      setPanelWidth(newWidth);
      setPanelHeight(newHeight);

      rafId = null;
      lastMouseEvent = null;
    };

    const handleResizeMove = (e: MouseEvent) => {
      lastMouseEvent = e;
      if (!rafId) {
        rafId = requestAnimationFrame(updateSize);
      }
    };

    const handleResizeUp = () => {
      setIsResizing(false);
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeUp);
    };

    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeUp);
  };

  // Dynamic node categories that include loaded agents + registry nodes
  const nodeCategories = () => {
    const allRegistryNodes = getAllNodes();

    // Convert registry nodes to FloatingPanel node format
    const convertRegistryNode = (node: RegistryNodeDefinition) => ({
      type: node.type,
      name: node.name,
      description: node.description,
      icon: node.icon || '⚙️',
      color: node.color || 'bg-gray-500',
      requiresConnectedApp: node.requiresIntegration
    });

    // Group registry nodes by category
    const triggerNodes = getNodesByCategory('triggers').map(convertRegistryNode);
    const actionNodes = getNodesByCategory('actions').map(convertRegistryNode);
    const logicNodes = getNodesByCategory('logic').map(convertRegistryNode);
    const dataNodes = getNodesByCategory('data').map(convertRegistryNode);
    const integrationNodes = getNodesByCategory('integrations').map(convertRegistryNode);
    const aiNodes = getNodesByCategory('ai').map(convertRegistryNode);
    const datavisNodes = getNodesByCategory('datavis').map(convertRegistryNode);

    const baseCategories: NodeCategory[] = [
      {
        id: 'triggers',
        name: 'Triggers',
        icon: '⚡',
        nodes: triggerNodes
      },
      {
        id: 'actions',
        name: 'Actions',
        icon: '🎯',
        nodes: actionNodes
      },
      {
        id: 'logic',
        name: 'Logic & Control',
        icon: '🔀',
        nodes: logicNodes
      },
      {
        id: 'data',
        name: 'Data & Storage',
        icon: '💾',
        nodes: dataNodes
      },
      {
        id: 'integrations',
        name: 'Integrations',
        icon: '🔌',
        nodes: [
          ...integrationNodes,
          ...generateDynamicAppNodes() // Keep dynamic app nodes
        ]
      },
      {
        id: 'ai',
        name: 'AI & Agents',
        icon: '🤖',
        nodes: [
          ...aiNodes,
          ...Object.values(agentNodes()).flat() // Keep dynamic agent nodes
        ]
      },
      {
        id: 'datavis',
        name: 'Data Visualization',
        icon: '📊',
        nodes: datavisNodes
      },
      {
        id: 'shapes',
        name: 'Visual Elements',
        icon: '🔷',
        nodes: [
          // Keep shape nodes (not in registry)
          { type: 'rectangle', name: 'Rectangle', description: 'Basic rectangle shape', icon: <Square class="w-4 h-4" />, color: 'bg-gray-500' },
          { type: 'circle', name: 'Circle', description: 'Basic circle shape', icon: <Circle class="w-4 h-4" />, color: 'bg-blue-500' },
          { type: 'triangle', name: 'Triangle', description: 'Basic triangle shape', icon: <Triangle class="w-4 h-4" />, color: 'bg-yellow-500' },
          { type: 'diamond', name: 'Diamond', description: 'Diamond decision shape', icon: <ArrowRight class="w-4 h-4" />, color: 'bg-purple-500' },
          { type: 'arrow', name: 'Arrow', description: 'Directional arrow', icon: <ArrowRight class="w-4 h-4" />, color: 'bg-green-500' },
          { type: 'hexagon', name: 'Hexagon', description: 'Six-sided shape', icon: <Hexagon class="w-4 h-4" />, color: 'bg-indigo-500' },
          { type: 'star', name: 'Star', description: 'Star shape for highlights', icon: <Star class="w-4 h-4" />, color: 'bg-orange-500' },
          { type: 'heart', name: 'Heart', description: 'Heart shape for favorites', icon: <Heart class="w-4 h-4" />, color: 'bg-red-500' },
          { type: 'sticky-note', name: 'Sticky Note', description: 'Note with custom text and colors', icon: '📝', color: 'bg-yellow-300' }
        ]
      }
    ];

    return baseCategories;
  };

  const filteredNodes = () => {
    const query = searchQuery().toLowerCase();
    const categories = nodeCategories();
    if (!query) return categories;

    return categories.map(category => ({
      ...category,
      nodes: category.nodes.filter(node =>
        node.name.toLowerCase().includes(query) ||
        node.description.toLowerCase().includes(query)
      )
    })).filter(category => category.nodes.length > 0);
  };

  // Get drag context
  const dragContext = useDragDrop();

  const handleNodeDragStart = (nodeType: string, e: DragEvent) => {
    console.log('🎮 FloatingNodePanel: Starting drag for node type:', nodeType);

    // Set traditional drag data for compatibility
    e.dataTransfer!.effectAllowed = 'copy';
    e.dataTransfer!.setData('text/plain', nodeType);

    // Use new drag context
    dragContext.startDrag('node-create', { type: nodeType, name: formatNodeTitle(nodeType) }, e.target as HTMLElement, e);

    console.log('Drag data set to:', nodeType);
    props.onDragStart(nodeType, e);
  };

  const handleNodeMouseDown = (nodeType: string, e: MouseEvent) => {
    console.log('🎮 FloatingNodePanel: Mouse down for node type:', nodeType);

    // Only start drag if it's a left mouse button
    if (e.button === 0) {
      dragContext.startDrag('node-create', { type: nodeType, name: formatNodeTitle(nodeType) }, e.target as HTMLElement, e);
    }
  };

  const formatNodeTitle = (nodeType: string): string => {
    return nodeType
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // NodeDetailsView component - simplified version of WorkflowNodeDetails for panel integration
  const NodeDetailsView = (props: { node: WorkflowNode; onUpdate: (node: WorkflowNode) => void; availableModels: string[] }) => {
    const [localNode, setLocalNode] = createSignal<WorkflowNode>({ ...props.node });
    const [activeTab, setActiveTab] = createSignal('config');
    const [showPassword, setShowPassword] = createSignal(false);
    const [validationErrors, setValidationErrors] = createSignal<string[]>([]);

    // Get node configuration from NodeRegistry
    const getNodeDefinition = (nodeType: string) => {
      const registryNode = getRegistryNodeDefinition(nodeType);

      if (registryNode) {
        // Convert registry format to old format for compatibility
        return {
          type: registryNode.type,
          name: registryNode.name,
          description: registryNode.description,
          category: registryNode.category,
          icon: registryNode.icon || '⚙️',
          color: registryNode.color || 'bg-gray-500',
          configFields: registryNode.fields?.map(f => ({
            key: f.key,
            label: f.label,
            type: f.type,
            required: f.required,
            defaultValue: f.defaultValue,
            placeholder: f.placeholder,
            help: f.help,
            options: f.options?.map(opt => ({ label: opt.label, value: opt.value }))
          })) || []
        };
      }

      // Fallback for unknown nodes
      return {
        type: nodeType,
        name: nodeType,
        description: 'Custom node',
        category: 'custom',
        icon: '⚙️',
        color: 'bg-gray-500',
        configFields: []
      };
    };

    // Update configuration (supports nested keys like "delegation.maxAgents")
    const updateConfig = (key: string, value: any) => {
      const node = localNode();

      // Handle nested keys (e.g., "delegation.maxAgents")
      if (key.includes('.')) {
        const [parent, child] = key.split('.');
        setLocalNode({
          ...node,
          config: {
            ...node.config,
            [parent]: {
              ...(node.config[parent] || {}),
              [child]: value
            }
          }
        });
      } else {
        setLocalNode({
          ...node,
          config: {
            ...node.config,
            [key]: value
          }
        });
      }
    };


    // Save changes
    const saveChanges = () => {
      props.onUpdate(localNode());
      // Stay in details view after saving - user can manually go back if needed
      // setCurrentView('nodes'); // Removed - keep showing details
    };

    const nodeDefinition = getNodeDefinition(props.node.type);

    return (
      <div class="flex flex-col h-full">
        {/* Scrollable Configuration Content */}
        <div class="flex-1 overflow-y-auto">
          <div class="p-4 space-y-4">
            {/* Basic Settings */}
            <div class="space-y-3">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Node Title
                </label>
                <input
                  type="text"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md text-sm focus:ring-2 focus:ring-blue-500 pointer-events-auto"
                  value={localNode().title || ''}
                  onInput={(e) => setLocalNode({ ...localNode(), title: e.currentTarget.value })}
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md text-sm focus:ring-2 focus:ring-blue-500 pointer-events-auto"
                  rows="2"
                  value={localNode().description || ''}
                  onInput={(e) => setLocalNode({ ...localNode(), description: e.currentTarget.value })}
                />
              </div>
            </div>

            {/* Type-specific Fields */}
            <Show
              when={isDataVisNode(localNode().type)}
              fallback={
                <NodeConfigRenderer
                  nodeDefinition={nodeDefinition}
                  config={localNode().config}
                  onConfigChange={updateConfig}
                />
              }
            >
              {/* Data Visualization Nodes - Charts */}
              <Show when={['chart-bar', 'chart-line', 'chart-pie', 'chart-area', 'chart-scatter'].includes(localNode().type)}>
                <ChartNodeConfig
                  value={{
                    ...DEFAULT_CHART_CONFIG,
                    type: localNode().type.replace('chart-', '') as any,
                    ...(localNode().config || {})
                  }}
                  onChange={(config) => {
                    setLocalNode({ ...localNode(), config: config });
                  }}
                />
              </Show>

              {/* Data Visualization Nodes - Table */}
              <Show when={localNode().type === 'table'}>
                <TableNodeConfig
                  value={{
                    ...DEFAULT_TABLE_CONFIG,
                    ...(localNode().config || {})
                  }}
                  onChange={(config) => {
                    setLocalNode({ ...localNode(), config: config });
                  }}
                />
              </Show>

              {/* Data Visualization Nodes - Metrics */}
              <Show when={localNode().type === 'metrics'}>
                <MetricsNodeConfig
                  value={{
                    ...DEFAULT_METRICS_CONFIG,
                    ...(localNode().config || {})
                  }}
                  onChange={(config) => {
                    setLocalNode({ ...localNode(), config: config });
                  }}
                />
              </Show>
            </Show>
          </div>
        </div>

        {/* Fixed Footer Actions */}
        <div class="flex-shrink-0 p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 pointer-events-auto">
          <div class="flex justify-end gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setCurrentView('nodes');
              }}
              class="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors pointer-events-auto"
            >
              Cancel
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                saveChanges();
              }}
              class="px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors flex items-center gap-2 pointer-events-auto"
            >
              <Settings class="w-4 h-4" />
              Save
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Show when={isVisible()}>
      <div
        ref={panelRef}
        class={`floating-panel fixed z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl transition-all duration-200 relative flex flex-col pointer-events-auto ${
          isDragging() || isResizing() ? 'shadow-2xl scale-105 select-none' : ''
        } ${
          isPinned()
            ? 'rounded-none border-r-0 border-t-0 border-b-0 h-screen'
            : 'rounded-lg'
        }`}
        style={{
          left: `${position().x}px`,
          top: `${position().y}px`,
          width: `${panelWidth()}px`,
          height: isPinned() ? '100vh' : `${panelHeight()}px`,
          'max-height': isPinned() ? '100vh' : '90vh',
          'will-change': isDragging() || isResizing() ? 'transform' : 'auto',
          transform: 'translate3d(0, 0, 0)' // Force GPU acceleration
        }}
        onMouseDown={handleMouseDown}
      >
        {/* Panel Header */}
        <div class={`flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700 ${!isPinned() ? 'cursor-move select-none' : ''}`} data-drag-handle={!isPinned() ? '' : undefined}>
          <div class="flex items-center gap-2">
            <Show when={!isPinned()}>
              <GripVertical class="w-4 h-4 text-gray-400 dark:text-gray-500" />
            </Show>
            <Show when={showConnectedApps()}>
              <button
                onClick={() => setShowConnectedApps(false)}
                class="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-500 dark:text-gray-400 mr-2"
              >
                <ArrowLeft class="w-4 h-4" />
              </button>
            </Show>
            <Show when={showingDetails()}>
              <button
                onClick={() => setCurrentView('nodes')}
                class="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-500 dark:text-gray-400 mr-2"
              >
                <ArrowLeft class="w-4 h-4" />
              </button>
            </Show>
            <span class="font-medium text-gray-900 dark:text-white text-sm">
              {showConnectedApps()
                ? 'Connect Apps'
                : showingDetails()
                  ? `Configure: ${props.selectedNode!.title || props.selectedNode!.type}`
                  : 'Workflow Nodes'
              }
            </span>
          </div>
          <div class="flex items-center gap-1">
            <button
              onClick={handlePin}
              class="p-2 hover:bg-gray-100/80 dark:hover:bg-gray-700/80 rounded-lg text-gray-600 dark:text-gray-400 transition-all duration-200 hover:scale-105"
              title={isPinned() ? 'Unpin from right edge' : 'Pin to right edge'}
            >
              {isPinned() ? <PinOff class="w-4 h-4" /> : <Pin class="w-4 h-4" />}
            </button>
            <button
              onClick={() => {
                setIsVisible(false);
                props.onVisibilityChange?.(false);
              }}
              class="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-500 dark:text-gray-400"
            >
              <X class="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Main Content - Show nodes, integrations, or details */}
        <div class="flex-1 overflow-hidden">
          <Show
            when={showConnectedApps()}
            fallback={
              <Show
                when={showingDetails()}
                fallback={
                  /* Nodes Library View */
                  <div class="h-full flex flex-col">
                  {/* Search */}
                  <div class="p-3 border-b border-gray-200 dark:border-gray-700">
                    <div class="relative">
                      <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
                      <input
                        type="text"
                        placeholder="Search nodes..."
                        value={searchQuery()}
                        onInput={(e) => setSearchQuery(e.currentTarget.value)}
                        class="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                      />
                    </div>
                  </div>

                  {/* Category Tabs */}
                  <div class="flex justify-between border-b border-gray-200 dark:border-gray-700">
                    <For each={nodeCategories()}>
                      {(category) => (
                        <button
                          onClick={() => setActiveCategory(category.id)}
                          class={`flex-1 px-2 py-2 text-xs font-medium border-b-2 transition-colors text-center ${
                            activeCategory() === category.id
                              ? 'border-blue-500 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                          }`}
                        >
                          <span class="mr-1">{category.icon}</span>
                          {category.name}
                        </button>
                      )}
                    </For>
                  </div>

                  {/* Nodes List */}
                  <div class="flex-1 overflow-y-auto p-2">
                    <Show
                      when={!loading()}
                      fallback={
                        <div class="text-center p-4">
                          <div class="text-gray-500 dark:text-gray-400 text-sm">
                            Loading agents...
                          </div>
                        </div>
                      }
                    >
                      <For each={filteredNodes()}>
                        {(category) => (
                          <Show when={!searchQuery() || category.id === activeCategory() || searchQuery()}>
                            <div class={searchQuery() ? '' : (category.id === activeCategory() ? '' : 'hidden')}>
                              <Show
                                when={!(category.id === 'apps' && activeCategory() === 'apps' && (props.connectedApps?.length || 0) === 0)}
                                fallback={
                                  <div class="text-center p-4">
                                    <div class="text-gray-500 dark:text-gray-400 text-sm mb-3">
                                      No apps connected yet
                                    </div>
                                    <button
                                      onClick={() => navigate('apps')}
                                      class="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                                    >
                                      Connect Apps →
                                    </button>
                                  </div>
                                }
                              >

                              {/* Special handling for AI Agents category - add create button first */}
                              <Show when={category.id === 'ai-agents'}>
                                <button
                                  onClick={() => setShowCreateAgent(true)}
                                  class="flex items-center gap-3 p-2 rounded-lg mb-2 border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all cursor-pointer"
                                >
                                  <div class="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white text-sm">
                                    <Plus class="w-4 h-4" />
                                  </div>
                                  <div class="flex-1 min-w-0">
                                    <div class="font-medium text-gray-900 dark:text-white text-sm">
                                      Create Agent
                                    </div>
                                    <div class="text-xs text-gray-500 dark:text-gray-400">
                                      Generate new AI agent with MCP tools
                                    </div>
                                  </div>
                                  <Sparkles class="w-4 h-4 text-purple-500" />
                                </button>
                              </Show>

                              <Show
                                when={category.id === 'ai-agents'}
                                fallback={
                                  <For each={category.nodes}>
                                    {(node) => {
                                      const isConnected = !node.requiresConnectedApp ||
                                        (props.connectedApps?.includes(node.requiresConnectedApp) ?? false);

                                      return (
                                        <div
                                          draggable={isConnected}
                                          onDragStart={(e) => isConnected && handleNodeDragStart(node.type, e)}
                                          onMouseDown={(e) => isConnected && handleNodeMouseDown(node.type, e)}
                                          class={`flex items-center gap-3 p-2 rounded-lg mb-2 transition-all ${
                                            isConnected
                                              ? 'cursor-grab hover:bg-gray-50 dark:hover:bg-gray-700 hover:shadow-sm active:cursor-grabbing'
                                              : 'opacity-50 cursor-not-allowed'
                                          }`}
                                        >
                                          <div class={`w-8 h-8 ${node.color} rounded-lg flex items-center justify-center text-white text-sm`}>
                                            {node.icon}
                                          </div>
                                          <div class="flex-1 min-w-0">
                                            <div class="font-medium text-gray-900 dark:text-white text-sm truncate">
                                              {node.name}
                                            </div>
                                            <div class="text-xs text-gray-500 dark:text-gray-400 truncate">
                                              {node.description}
                                            </div>
                                            <Show when={node.requiresConnectedApp && !isConnected}>
                                              <button
                                                onClick={() => props.onNavigate?.('apps')}
                                                class="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                                              >
                                                Connect {node.requiresConnectedApp}
                                              </button>
                                            </Show>
                                          </div>
                                        </div>
                                      );
                                    }}
                                  </For>
                                }
                              >
                                {/* Collapsible groups for AI Agents */}
                                <For each={Object.entries(agentNodes())}>
                                  {([groupName, groupAgents]) => (
                                    <Show when={groupAgents.length > 0}>
                                      <div class="mb-3">
                                        <button
                                          onClick={() => {
                                            const collapsed = collapsedGroups();
                                            if (collapsed.has(groupName)) {
                                              collapsed.delete(groupName);
                                            } else {
                                              collapsed.add(groupName);
                                            }
                                            setCollapsedGroups(new Set(collapsed));
                                          }}
                                          class={`flex items-center justify-between w-full p-2 rounded-lg hover:opacity-90 transition-all mb-2 ${
                                            groupName.includes('orchestrators') ? 'bg-indigo-100 dark:bg-indigo-900/30' :
                                            groupName.includes('core') ? 'bg-gray-100 dark:bg-gray-700' :
                                            groupName.includes('aws') ? 'bg-orange-100 dark:bg-orange-900/30' :
                                            groupName.includes('frameworks') ? 'bg-blue-100 dark:bg-blue-900/30' :
                                            groupName.includes('devops') ? 'bg-purple-100 dark:bg-purple-900/30' :
                                            groupName.includes('integrations') ? 'bg-pink-100 dark:bg-pink-900/30' :
                                            groupName.includes('universal') ? 'bg-green-100 dark:bg-green-900/30' :
                                            groupName.startsWith('mcp-app-') ? 'bg-cyan-100 dark:bg-cyan-900/30' :
                                            'bg-gray-100 dark:bg-gray-700'
                                          }`}
                                        >
                                          <div class="flex items-center gap-2">
                                            <Show when={groupName.startsWith('mcp-app-')}>
                                              <div class="w-5 h-5 bg-gradient-to-br from-cyan-500 to-blue-600 rounded flex items-center justify-center text-white text-xs">
                                                🔌
                                              </div>
                                            </Show>
                                            <span class="text-sm font-medium text-gray-900 dark:text-white capitalize">
                                              {getAppDisplayName(groupName)}
                                            </span>
                                            <span class="text-xs text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded-full">
                                              {groupAgents.length}
                                            </span>
                                          </div>
                                          <div class={`transform transition-transform ${collapsedGroups().has(groupName) ? 'rotate-180' : ''}`}>
                                            ▼
                                          </div>
                                        </button>

                                        <Show when={!collapsedGroups().has(groupName)}>
                                          <div class="ml-2 space-y-1">
                                            <For each={groupAgents}>
                                              {(node) => (
                                                <div
                                                  draggable={true}
                                                  onDragStart={(e) => handleNodeDragStart(node.type, e)}
                                                  onMouseDown={(e) => handleNodeMouseDown(node.type, e)}
                                                  class="flex items-center gap-3 p-2 rounded-lg transition-all cursor-grab hover:bg-gray-50 dark:hover:bg-gray-700 hover:shadow-sm active:cursor-grabbing"
                                                >
                                                  <div class={`w-8 h-8 ${node.color} rounded-lg flex items-center justify-center text-white text-sm`}>
                                                    {node.icon}
                                                  </div>
                                                  <div class="flex-1 min-w-0">
                                                    <div class="font-medium text-gray-900 dark:text-white text-sm truncate">
                                                      {node.name}
                                                    </div>
                                                    <div class="text-xs text-gray-500 dark:text-gray-400 truncate">
                                                      {node.description}
                                                    </div>
                                                  </div>
                                                </div>
                                              )}
                                            </For>
                                          </div>
                                        </Show>
                                      </div>
                                    </Show>
                                  )}
                                </For>
                              </Show>
                            </Show>
                          </div>
                        </Show>
                      )}
                    </For>
                    </Show>
                  </div>
                  </div>
                }
            >
              {/* Node Details View */}
              <div class="h-full flex flex-col">
                <NodeDetailsView
                  node={props.selectedNode!}
                  onUpdate={props.onNodeUpdate!}
                  availableModels={props.availableModels || ['claude-3-sonnet', 'claude-3-haiku', 'gpt-4', 'gpt-3.5-turbo']}
                />
              </div>
            </Show>
          }
        >
          {/* Connected Apps View */}
          <div class="flex-1 overflow-y-auto p-4">
            <IntegrationsGrid integrations={[]} />
          </div>
        </Show>
        </div>

        {/* Resize Handle - Bottom Right Corner */}
        <Show when={!isPinned()}>
          <div
            class={`absolute bottom-0 right-0 w-6 h-6 cursor-se-resize z-50 select-none ${
              isResizing() ? 'bg-blue-500' : 'hover:bg-gray-300 dark:hover:bg-gray-600'
            } transition-colors flex items-end justify-end`}
            onMouseDown={handleResizeMouseDown}
            title="Resize panel (width & height)"
            style={{
              "pointer-events": "auto",
              "user-select": "none",
              "-webkit-user-select": "none",
              "-moz-user-select": "none",
              "-ms-user-select": "none"
            }}
          >
            <div class="w-3 h-3 border-r-2 border-b-2 border-gray-400 dark:border-gray-500 mb-0.5 mr-0.5" />
          </div>
        </Show>
      </div>

      {/* Toggle button when panel is hidden */}
      <Show when={!isVisible()}>
        <button
          onClick={() => setIsVisible(true)}
          class="fixed bottom-4 left-4 z-50 w-12 h-12 bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all"
        >
          🎯
        </button>
      </Show>

      {/* Create Agent Wizard */}
      <Show when={showCreateAgent()}>
        <CreateAgentWizard
          onClose={() => setShowCreateAgent(false)}
          onCreated={async (agent) => {
            console.log('Agent created:', agent);
            // Reload agent list
            try {
              const organizedAgents = await agentRegistryInitializer.initialize();
              // TODO: Update local agent list state if needed
            } catch (err) {
              console.error('Failed to reload agents:', err);
            }
            setShowCreateAgent(false);
          }}
          agentService={agentService}
          mcpClient={{ callMCPTool }}
          existingAgents={[]} // TODO: Pass actual agent list for icon extraction
          connectedApps={integrations?.connectedApps || []}
          availableModels={availableModels()}
        />
      </Show>
    </Show>
  );
}