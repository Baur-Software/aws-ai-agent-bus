import { createSignal, createEffect, Show, For, onMount } from 'solid-js';
import { Search, GripVertical, X, Pin, PinOff, Plus, Sparkles, ArrowLeft, ChartColumn, Globe, CreditCard, Shield, Users, Building, Square, Circle, Triangle, ArrowRight, Diamond, Hexagon, Star, Heart, Settings, RefreshCw } from 'lucide-solid';
import { useDashboardServer } from '../../../contexts/DashboardServerContext';
import { useDragDrop, useDragSource } from '../../../contexts/DragDropContext';
import { useIntegrations } from '../../../contexts/IntegrationsContext';
import { useAuth } from '../../../contexts/AuthContext';
import { listAgents } from '../../../api/agents'; // new API import
import IntegrationsGrid from '../../IntegrationsGrid';
import { mcpRegistry } from '../../../services/MCPCapabilityRegistry';
import { agentRegistryInitializer } from '../../../services/AgentRegistryInitializer';
import { mcpToolService, MCPServerTools } from '../../../services/MCPToolService';
import { Agent } from 'http';
import { WorkflowNode } from './WorkflowNodeDetails';

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

// App configuration templates
const APP_CONFIGS = [
  {
    id: 'google-analytics',
    name: 'Google Analytics',
    icon: ChartColumn,
    color: 'bg-orange-500',
    description: 'Connect Google Analytics for website metrics and reporting',
    type: 'oauth2',
    oauth2_config: {
      auth_url: 'https://accounts.google.com/o/oauth2/auth',
      token_url: 'https://oauth2.googleapis.com/token',
      scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
      redirect_uri: 'http://localhost:3000/oauth/callback'
    },
    ui_fields: [
      { key: 'client_id', label: 'Client ID', type: 'text', required: true },
      { key: 'client_secret', label: 'Client Secret', type: 'password', required: true },
      { key: 'property_id', label: 'GA4 Property ID', type: 'text', required: true }
    ],
    workflow_capabilities: [
      'ga-top-pages', 'ga-search-data', 'ga-opportunities', 'ga-calendar'
    ],
    docsUrl: 'https://developers.google.com/analytics/devguides/config/mgmt/v3/quickstart/web-js'
  },
  {
    id: 'google-search-console',
    name: 'Google Search Console',
    icon: Globe,
    color: 'bg-blue-500',
    description: 'Access search performance and indexing data',
    docsUrl: 'https://developers.google.com/webmaster-tools/search-console-api/v1/quickstart',
    fields: [
      { key: 'client_id', label: 'Client ID', type: 'text', required: true },
      { key: 'client_secret', label: 'Client Secret', type: 'password', required: true },
      { key: 'site_url', label: 'Site URL', type: 'url', required: true }
    ],
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly']
  },
  {
    id: 'stripe',
    name: 'Stripe',
    icon: CreditCard,
    color: 'bg-purple-500',
    description: 'Process payments and manage subscriptions',
    docsUrl: 'https://stripe.com/docs/api',
    fields: [
      { key: 'secret_key', label: 'Secret Key', type: 'password', required: true },
      { key: 'publishable_key', label: 'Publishable Key', type: 'text', required: true }
    ]
  }
];

export default function FloatingNodePanel(props: FloatingNodePanelProps) {
  const [position, setPosition] = createSignal(props.initialPosition || { x: window.innerWidth - 320, y: 0 });
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
  const [agents, setAgents] = createSignal<Agent[]>([]);
  const [mcpServerTools, setMcpServerTools] = createSignal<MCPServerTools[]>([]);
  const [loadingMcpTools, setLoadingMcpTools] = createSignal(false);

  // Auto-switch to details view when a node is selected
  createEffect(() => {
    if (props.selectedNode) {
      setCurrentView('details');
    }
  });

  // Get contexts
  const { user } = useAuth();
  const dashboardServer = useDashboardServer();
  const integrations = useIntegrations();

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

    // Create nodes for each connected app
    Object.entries(connectedApps).forEach(([appId, connections]) => {
      if (connections.length > 0) {
        // Find the app config for this integration
        const appConfig = APP_CONFIGS.find(config => config.id === appId);
        if (appConfig && appConfig.workflow_capabilities) {
          // Create nodes for each workflow capability
          appConfig.workflow_capabilities.forEach(capability => {
            dynamicNodes.push({
              type: capability,
              name: `${appConfig.name} ${capability.split('-').pop()?.toUpperCase()}`,
              description: `Use ${appConfig.name} ${capability} capability`,
              icon: <appConfig.icon class="w-4 h-4" />,
              color: appConfig.color,
              requiresConnectedApp: appId
            });
          });
        }
      }
    });

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

        // Add any MCP app agents from the registry
        const mcpAgents = mcpRegistry.getAgents();
        if (mcpAgents.length > 0 && !agentGroups['mcp-apps']) {
          agentGroups['mcp-apps'] = [];
        }
        mcpAgents.forEach(agent => {
          agentGroups['mcp-apps'].push({
            type: agent.id,
            name: agent.name,
            description: agent.description,
            icon: agent.icon,
            color: agent.color,
            group: 'mcp-apps'
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

        // Add MCP app agents to the groups
        const mcpAgents = mcpRegistry.getAgents();
        if (mcpAgents.length > 0) {
          if (!agentGroups['mcp-apps']) {
            agentGroups['mcp-apps'] = [];
          }
          mcpAgents.forEach(agent => {
            agentGroups['mcp-apps'].push({
              type: agent.id,
              name: agent.name,
              description: agent.description,
              icon: agent.icon,
              color: agent.color,
              group: 'mcp-apps'
            });
          });
        }

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

      // Add MCP app agents even in fallback
      const mcpAgents = mcpRegistry.getAgents();
      if (mcpAgents.length > 0) {
        mcpAgents.forEach(agent => {
          fallbackGroups['mcp-apps'].push({
            type: agent.id,
            name: agent.name,
            description: agent.description,
            icon: agent.icon,
            color: agent.color,
            group: 'mcp-apps'
          });
        });
      }

      setAgentNodes(fallbackGroups);
    } finally {
      setLoading(false);
    }
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

  // Handle scroll events to prevent canvas scroll when over panel
  const handlePanelWheel = (e: WheelEvent) => {
    // Stop the scroll event from propagating to the canvas
    e.stopPropagation();

    // Find the scrollable content area
    const target = e.currentTarget as HTMLElement;
    const scrollableContent = target.querySelector('.overflow-y-auto');

    if (scrollableContent) {
      const { scrollTop, scrollHeight, clientHeight } = scrollableContent;
      const isScrollingUp = e.deltaY < 0;
      const isScrollingDown = e.deltaY > 0;

      // Check if we can scroll in the intended direction
      const canScrollUp = scrollTop > 0;
      const canScrollDown = scrollTop < scrollHeight - clientHeight;

      // Only prevent default if we can actually scroll in that direction
      if ((isScrollingUp && canScrollUp) || (isScrollingDown && canScrollDown)) {
        e.preventDefault();
        scrollableContent.scrollTop += e.deltaY;
      }
    }
  };

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

  // Load agents on mount
  onMount(async () => {
    loadAgents();
    // Load any persisted MCP apps from KV store
    await mcpRegistry.loadFromKVStore();
    // Load MCP tools from connected servers
    await loadMcpTools();
  });

  // Panel drag handling
  let panelRef: HTMLDivElement | undefined;
  let dragStart = { x: 0, y: 0, panelX: 0, panelY: 0 };

  const handleMouseDown = (e: MouseEvent) => {
    if (e.target !== e.currentTarget && !(e.target as Element).closest('[data-drag-handle]') || isPinned()) {
      return;
    }

    // Prevent text selection and default browser behavior
    e.preventDefault();
    e.stopPropagation();

    setIsDragging(true);
    const pos = position();
    dragStart = {
      x: e.clientX,
      y: e.clientY,
      panelX: pos.x,
      panelY: pos.y
    };

    // Disable text selection on body during drag
    document.body.style.userSelect = 'none';
    document.body.style.webkitUserSelect = 'none';

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      const newX = dragStart.panelX + (e.clientX - dragStart.x);
      const newY = dragStart.panelY + (e.clientY - dragStart.y);

      // Keep panel within viewport bounds - more generous constraints
      const panelWidth = 320;
      const gutterSpace = 20; // Minimum space from edges
      const maxX = window.innerWidth - gutterSpace; // Allow panel to go almost to right edge
      const minX = gutterSpace; // Allow panel to move across entire screen
      const maxY = window.innerHeight - 100;

      const clampedPos = {
        x: Math.max(minX, Math.min(maxX, newX)),
        y: Math.max(0, Math.min(maxY, newY))
      };

      setPosition(clampedPos);
      props.onPositionChange?.(clampedPos.x, clampedPos.y);
    };

    const handleMouseUp = () => {
      setIsDragging(false);

      // Re-enable text selection
      document.body.style.userSelect = '';
      document.body.style.webkitUserSelect = '';

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

    e.preventDefault();
    e.stopPropagation();

    setIsResizing(true);
    const startWidth = panelWidth();
    const startHeight = panelHeight();
    const startX = e.clientX;
    const startY = e.clientY;
    const startPosition = position(); // Store initial position

    // Disable text selection during resize - more comprehensive approach
    document.body.style.userSelect = 'none';
    document.body.style.webkitUserSelect = 'none';
    document.body.style.mozUserSelect = 'none';
    document.body.style.msUserSelect = 'none';
    document.documentElement.style.userSelect = 'none';

    const handleResizeMove = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;

      // Calculate new dimensions with constraints
      const newWidth = Math.max(280, Math.min(600, startWidth + deltaX)); // Min 280px, max 600px
      const newHeight = Math.max(200, Math.min(800, startHeight + deltaY)); // Min 200px, max 800px

      // Calculate the actual changes (accounting for constraints)
      const actualWidthChange = newWidth - startWidth;

      setPanelWidth(newWidth);
      setPanelHeight(newHeight);

      // Adjust position to keep right edge in same place using the original position
      const newPosition = {
        x: startPosition.x - actualWidthChange,
        y: startPosition.y
      };
      setPosition(newPosition);
      props.onPositionChange?.(newPosition.x, newPosition.y);
    };

    const handleResizeUp = () => {
      setIsResizing(false);

      // Re-enable text selection
      document.body.style.userSelect = '';
      document.body.style.webkitUserSelect = '';
      document.body.style.mozUserSelect = '';
      document.body.style.msUserSelect = '';
      document.documentElement.style.userSelect = '';

      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeUp);
    };

    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeUp);
  };

  // Dynamic node categories that include loaded agents
  const nodeCategories = () => {
    const baseCategories: NodeCategory[] = [
      {
        id: 'input-output',
        name: 'Input/Output',
        icon: '⚡',
        nodes: [
          { type: 'webhook', name: 'Webhook', description: 'HTTP webhook trigger', icon: '🔗', color: 'bg-blue-500' },
          { type: 'schedule', name: 'Schedule', description: 'Time-based trigger', icon: '⏰', color: 'bg-yellow-500' },
          { type: 'send-email', name: 'Send Email', description: 'Send email notification', icon: '📧', color: 'bg-red-500' },
          { type: 'notification', name: 'Notification', description: 'Push notification', icon: '🔔', color: 'bg-orange-500' }
        ]
      },
      {
        id: 'shapes',
        name: 'Shapes',
        icon: '🔷',
        nodes: [
          { type: 'trigger', name: 'Trigger', description: 'Visually represent the start of a workflow execution', icon: '▶️', color: 'bg-green-500' },
          { type: 'output', name: 'Output', description: 'Visually represent the final workflow result', icon: '📤', color: 'bg-purple-500' },
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
      },
      {
        id: 'ai-agents',
        name: 'AI Agents',
        icon: '🤖',
        nodes: Object.values(agentNodes()).flat() // Flatten grouped agents for category
      },
      {
        id: 'apps',
        name: 'Apps',
        icon: '🔌',
        nodes: [
          ...generateDynamicAppNodes()
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

    // Get node configuration
    const getNodeConfig = (nodeType: string) => {
      const configs = {
        'agent-conductor': {
          title: 'Conductor Agent',
          description: 'Goal-driven planning and task delegation',
          icon: '🎯',
          color: 'bg-indigo-500',
          fields: [
            { key: 'goal', label: 'Goal Description', type: 'textarea', required: true },
            { key: 'context', label: 'Context', type: 'textarea' },
            { key: 'maxSubtasks', label: 'Max Subtasks', type: 'number', default: 5 }
          ],
          agentConfig: true
        },
        'heart': {
          title: 'Heart Shape',
          description: 'Heart shape for favorites and highlights',
          icon: '❤️',
          color: 'bg-red-500',
          fields: [
            { key: 'text', label: 'Text', type: 'text' },
            { key: 'color', label: 'Color', type: 'text', default: '#ef4444' }
          ]
        },
        'sticky-note': {
          title: 'Sticky Note',
          description: 'Note with custom text and colors',
          icon: '📝',
          color: 'bg-yellow-300',
          fields: [
            { key: 'text', label: 'Note Text', type: 'textarea', required: true },
            { key: 'backgroundColor', label: 'Background Color', type: 'text', default: '#fef08a' },
            { key: 'textColor', label: 'Text Color', type: 'text', default: '#374151' },
            { key: 'fontFamily', label: 'Font', type: 'select', options: ['Inter', 'Comic Sans MS', 'Brush Script MT', 'cursive'] }
          ]
        }
      };

      return configs[nodeType] || {
        title: nodeType,
        description: 'Custom node configuration',
        icon: '⚙️',
        color: 'bg-gray-500',
        fields: []
      };
    };

    // Update configuration
    const updateConfig = (key: string, value: any) => {
      const node = localNode();
      setLocalNode({
        ...node,
        config: {
          ...node.config,
          [key]: value
        }
      });
    };

    // Render field input
    const renderField = (field: any) => {
      const node = localNode();
      const value = node.config[field.key] ?? field.default ?? '';

      switch (field.type) {
        case 'text':
          return (
            <input
              type="text"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md text-sm focus:ring-2 focus:ring-blue-500"
              value={value}
              onInput={(e) => updateConfig(field.key, e.currentTarget.value)}
            />
          );

        case 'textarea':
          return (
            <textarea
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md text-sm focus:ring-2 focus:ring-blue-500"
              rows="3"
              value={value}
              onInput={(e) => updateConfig(field.key, e.currentTarget.value)}
            />
          );

        case 'number':
          return (
            <input
              type="number"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md text-sm focus:ring-2 focus:ring-blue-500"
              value={value}
              onInput={(e) => updateConfig(field.key, Number(e.currentTarget.value))}
            />
          );

        case 'select':
          return (
            <select
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md text-sm focus:ring-2 focus:ring-blue-500"
              value={value}
              onChange={(e) => updateConfig(field.key, e.currentTarget.value)}
            >
              <option value="">Select...</option>
              <For each={field.options}>
                {(option) => <option value={option}>{option}</option>}
              </For>
            </select>
          );

        default:
          return (
            <input
              type="text"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md text-sm focus:ring-2 focus:ring-blue-500"
              value={value}
              onInput={(e) => updateConfig(field.key, e.currentTarget.value)}
            />
          );
      }
    };

    // Save changes
    const saveChanges = () => {
      props.onUpdate(localNode());
      setCurrentView('nodes'); // Go back to nodes view
    };

    const nodeConfig = getNodeConfig(props.node.type);

    return (
      <div class="flex-1 overflow-y-auto">
        {/* Configuration Content */}
        <div class="p-4 space-y-4">
          {/* Basic Settings */}
          <div class="space-y-3">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Node Title
              </label>
              <input
                type="text"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md text-sm focus:ring-2 focus:ring-blue-500"
                value={localNode().title || ''}
                onInput={(e) => setLocalNode({ ...localNode(), title: e.currentTarget.value })}
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Description
              </label>
              <textarea
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md text-sm focus:ring-2 focus:ring-blue-500"
                rows="2"
                value={localNode().description || ''}
                onInput={(e) => setLocalNode({ ...localNode(), description: e.currentTarget.value })}
              />
            </div>
          </div>

          {/* Type-specific Fields */}
          <For each={nodeConfig.fields}>
            {(field) => (
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {field.label}
                  {field.required && <span class="text-red-500 ml-1">*</span>}
                </label>
                {renderField(field)}
              </div>
            )}
          </For>
        </div>

        {/* Footer Actions */}
        <div class="p-4 border-t border-gray-200 dark:border-gray-700">
          <div class="flex justify-end gap-2">
            <button
              onClick={() => setCurrentView('nodes')}
              class="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={saveChanges}
              class="px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors flex items-center gap-2"
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
        class={`fixed z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl transition-all duration-200 relative flex flex-col ${
          isDragging() || isResizing() ? 'shadow-2xl scale-105 select-none' : ''
        } ${
          isPinned()
            ? 'rounded-none border-l-0 border-t-0 border-b-0 h-screen'
            : 'rounded-lg'
        }`}
        style={{
          left: `${position().x}px`,
          top: `${position().y}px`,
          width: `${panelWidth()}px`,
          height: isPinned() ? '100vh' : `${panelHeight()}px`,
          'max-height': isPinned() ? '100vh' : '90vh'
        }}
        onMouseDown={handleMouseDown}
        onWheel={handlePanelWheel}
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
            <Show when={currentView() === 'details' && props.selectedNode}>
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
                : currentView() === 'details' && props.selectedNode
                  ? `Configure: ${props.selectedNode.title || props.selectedNode.type}`
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
                when={currentView() === 'details' && props.selectedNode}
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
                                      onClick={() => props.onNavigate?.('apps')}
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
                                            groupName.includes('mcp-apps') ? 'bg-cyan-100 dark:bg-cyan-900/30' :
                                            'bg-gray-100 dark:bg-gray-700'
                                          }`}
                                        >
                                          <div class="flex items-center gap-2">
                                            <span class="text-sm font-medium text-gray-900 dark:text-white capitalize">
                                              {groupName.replace(/-/g, ' ').replace('specialized ', 'Specialized: ')}
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
              <NodeDetailsView
                node={props.selectedNode!}
                onUpdate={props.onNodeUpdate!}
                availableModels={props.availableModels || ['claude-3-sonnet', 'claude-3-haiku', 'gpt-4', 'gpt-3.5-turbo']}
              />
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

      {/* Create Agent Modal */}
      <Show when={showCreateAgent()}>
        <div class="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-md mx-4">
            {/* Modal Header */}
            <div class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <div class="flex items-center gap-2">
                <div class="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <Sparkles class="w-4 h-4 text-white" />
                </div>
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
                  Create AI Agent
                </h3>
              </div>
              <button
                onClick={() => setShowCreateAgent(false)}
                class="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <X class="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Modal Content */}
            <div class="p-4 space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Agent Name
                </label>
                <input
                  type="text"
                  value={agentName()}
                  onInput={(e) => setAgentName(e.currentTarget.value)}
                  placeholder="e.g., Email Marketing Expert"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  value={agentDescription()}
                  onInput={(e) => setAgentDescription(e.currentTarget.value)}
                  placeholder="Describe what this agent will do..."
                  rows="3"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Specialty/Domain
                </label>
                <input
                  type="text"
                  value={agentSpecialty()}
                  onInput={(e) => setAgentSpecialty(e.currentTarget.value)}
                  placeholder="e.g., Email automation, Content creation, Data analysis"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div class="flex items-center justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setShowCreateAgent(false)}
                class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                disabled={creatingAgent()}
              >
                Cancel
              </button>
              <button
                onClick={createAgent}
                disabled={creatingAgent() || !agentName().trim() || !agentDescription().trim()}
                class="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-all flex items-center gap-2"
              >
                <Show when={creatingAgent()}>
                  <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                </Show>
                {creatingAgent() ? 'Creating...' : 'Create Agent'}
              </button>
            </div>
          </div>
        </div>
      </Show>
    </Show>
  );
}