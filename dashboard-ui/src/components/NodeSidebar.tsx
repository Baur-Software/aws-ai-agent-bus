import { createSignal, For, Show, createEffect } from 'solid-js';
import { useDashboardServer } from '../contexts/DashboardServerContext';
import MCPToolDiscovery from './MCPToolDiscovery';
import {
  Play, Webhook, Clock, FileText, Mail, Bell, Database, Archive, Radio,
  Bot, Eye, BarChart3, Search, Target, Calendar, TrendingUp, Users,
  Zap, Cloud, HardDrive, MessageSquare, CreditCard, Github, Linkedin,
  Youtube, ShoppingCart, DollarSign, Code, FileJson, Key, Link,
  ArrowRight, Send, RefreshCw, Braces, Grid3x3, Layers, Shield,
  Funnel, Repeat, Monitor, Server, List, CheckSquare,
  Activity, PieChart, Gauge, Globe, Image, Twitter, ChevronDown,
  ChevronRight, Plus, Settings, Package, ExternalLink
} from 'lucide-solid';

interface NodeType {
  type: string;
  label: string;
  icon: any;
  color: string;
  description: string;
  category: string;
  requiresIntegration?: string;
  isAvailable: boolean;
  configSchema?: any;
}

interface NodeSidebarProps {
  onDragStart: (nodeType: string) => void;
  nodeTypes: NodeType[];
  connectedIntegrations: string[];
  onConnectIntegration?: (integration: string) => void;
}

// Base node types that are always available
const BASE_NODE_TYPES: NodeType[] = [
  {
    type: 'trigger',
    label: 'Trigger',
    icon: Play,
    color: 'bg-green-500',
    description: 'Start workflow execution',
    category: 'Input/Output',
    isAvailable: true
  },
  {
    type: 'webhook',
    label: 'Webhook',
    icon: Webhook,
    color: 'bg-green-600',
    description: 'HTTP webhook trigger',
    category: 'Input/Output',
    isAvailable: true
  },
  {
    type: 'schedule',
    label: 'Schedule',
    icon: Clock,
    color: 'bg-green-700',
    description: 'Time-based trigger',
    category: 'Input/Output',
    isAvailable: true
  },
  {
    type: 'output',
    label: 'Output',
    icon: FileText,
    color: 'bg-blue-500',
    description: 'Final workflow result',
    category: 'Input/Output',
    isAvailable: true
  },
  {
    type: 'email',
    label: 'Send Email',
    icon: Mail,
    color: 'bg-blue-600',
    description: 'Send email notification',
    category: 'Input/Output',
    isAvailable: true
  },
  {
    type: 'notification',
    label: 'Notification',
    icon: Bell,
    color: 'bg-blue-700',
    description: 'Push notification',
    category: 'Input/Output',
    isAvailable: true
  }
];

// MCP Tools - always available when MCP server is connected
const MCP_NODE_TYPES: NodeType[] = [
  {
    type: 'kv-get',
    label: 'KV Get',
    icon: Database,
    color: 'bg-purple-500',
    description: 'Retrieve key-value data',
    category: 'MCP Tools',
    isAvailable: true
  },
  {
    type: 'kv-set',
    label: 'KV Set',
    icon: Database,
    color: 'bg-purple-600',
    description: 'Store key-value data',
    category: 'MCP Tools',
    isAvailable: true
  },
  {
    type: 'artifacts-get',
    label: 'Get Artifact',
    icon: Archive,
    color: 'bg-purple-700',
    description: 'Retrieve stored artifact',
    category: 'MCP Tools',
    isAvailable: true
  },
  {
    type: 'artifacts-put',
    label: 'Store Artifact',
    icon: Archive,
    color: 'bg-purple-800',
    description: 'Store file or data',
    category: 'MCP Tools',
    isAvailable: true
  }
];

// Agent nodes - always available
const AGENT_NODE_TYPES: NodeType[] = [
  {
    type: 'agent-conductor',
    label: 'Conductor',
    icon: Bot,
    color: 'bg-indigo-500',
    description: 'Goal-driven planning and delegation',
    category: 'AI Agents',
    isAvailable: true,
    configSchema: {
      modelId: { type: 'select', label: 'AI Model', required: true },
      temperature: { type: 'slider', label: 'Creativity', min: 0, max: 2, step: 0.1, default: 0.7 },
      maxTokens: { type: 'number', label: 'Max Tokens', default: 4000 },
      goal: { type: 'textarea', label: 'Goal Description', required: true },
      context: { type: 'textarea', label: 'Context' }
    }
  },
  {
    type: 'agent-critic',
    label: 'Critic',
    icon: Eye,
    color: 'bg-indigo-600',
    description: 'Quality assurance and validation',
    category: 'AI Agents',
    isAvailable: true,
    configSchema: {
      modelId: { type: 'select', label: 'AI Model', required: true },
      temperature: { type: 'slider', label: 'Strictness', min: 0, max: 1, step: 0.1, default: 0.3 },
      criteria: { type: 'textarea', label: 'Validation Criteria', required: true }
    }
  },
  {
    type: 'agent-terraform',
    label: 'Terraform',
    icon: Cloud,
    color: 'bg-indigo-700',
    description: 'Infrastructure as code specialist',
    category: 'AI Agents',
    isAvailable: true,
    configSchema: {
      modelId: { type: 'select', label: 'AI Model', required: true },
      temperature: { type: 'slider', label: 'Precision', min: 0, max: 0.5, step: 0.1, default: 0.1 },
      awsRegion: { type: 'select', label: 'AWS Region', required: true },
      terraformVersion: { type: 'text', label: 'Terraform Version', default: 'latest' }
    }
  },
  {
    type: 'agent-django',
    label: 'Django',
    icon: Code,
    color: 'bg-indigo-800',
    description: 'Python Django development',
    category: 'AI Agents',
    isAvailable: true
  }
];

// Connected app-specific nodes
const INTEGRATION_NODE_TYPES: { [key: string]: NodeType[] } = {
  'google-analytics': [
    {
      type: 'ga-top-pages',
      label: 'Top Pages',
      icon: BarChart3,
      color: 'bg-orange-500',
      description: 'Get top performing pages',
      category: 'Google Analytics',
      requiresIntegration: 'google-analytics',
      isAvailable: false
    },
    {
      type: 'ga-search-data',
      label: 'Search Data',
      icon: Search,
      color: 'bg-orange-600',
      description: 'Get search console data',
      category: 'Google Analytics',
      requiresIntegration: 'google-analytics',
      isAvailable: false
    },
    {
      type: 'ga-content-calendar',
      label: 'Content Calendar',
      icon: Calendar,
      color: 'bg-orange-700',
      description: 'Generate content calendar',
      category: 'Google Analytics',
      requiresIntegration: 'google-analytics',
      isAvailable: false
    }
  ],
  'slack': [
    {
      type: 'slack-message',
      label: 'Send Message',
      icon: MessageSquare,
      color: 'bg-purple-500',
      description: 'Send Slack message',
      category: 'Slack',
      requiresIntegration: 'slack',
      isAvailable: false
    },
    {
      type: 'slack-channel-create',
      label: 'Create Channel',
      icon: Plus,
      color: 'bg-purple-600',
      description: 'Create Slack channel',
      category: 'Slack',
      requiresIntegration: 'slack',
      isAvailable: false
    }
  ],
  'github': [
    {
      type: 'github-webhook',
      label: 'GitHub Webhook',
      icon: Github,
      color: 'bg-gray-700',
      description: 'Listen for GitHub events',
      category: 'GitHub',
      requiresIntegration: 'github',
      isAvailable: false
    },
    {
      type: 'github-create-issue',
      label: 'Create Issue',
      icon: Plus,
      color: 'bg-gray-600',
      description: 'Create GitHub issue',
      category: 'GitHub',
      requiresIntegration: 'github',
      isAvailable: false
    }
  ],
  'stripe': [
    {
      type: 'stripe-payment',
      label: 'Payment',
      icon: CreditCard,
      color: 'bg-blue-600',
      description: 'Process payment',
      category: 'Stripe',
      requiresIntegration: 'stripe',
      isAvailable: false
    },
    {
      type: 'stripe-subscription',
      label: 'Subscription',
      icon: RefreshCw,
      color: 'bg-blue-700',
      description: 'Manage subscription',
      category: 'Stripe',
      requiresIntegration: 'stripe',
      isAvailable: false
    }
  ]
  // Additional integrations loaded dynamically via MCP
};

export default function NodeSidebar(props: NodeSidebarProps) {
  const [expandedCategories, setExpandedCategories] = createSignal<Set<string>>(new Set(['Input/Output', 'AI Agents']));
  const [searchQuery, setSearchQuery] = createSignal('');
  const [showMCPDiscovery, setShowMCPDiscovery] = createSignal(false);
  const [discoveredMCPTools, setDiscoveredMCPTools] = createSignal<NodeType[]>([]);

  const { isConnected } = useDashboardServer();

  // Load discovered MCP tools
  createEffect(() => {
    if (isConnected()) {
      // Auto-discover MCP tools when connected
      discoverMCPTools();
    }
  });

  const discoverMCPTools = async () => {
    // This would integrate with the MCP discovery system
    // For now, we'll simulate discovered tools
    const discoveredTools: NodeType[] = [
      {
        type: 'mcp-events-send',
        label: 'Send Event',
        icon: Radio,
        color: 'bg-green-500',
        description: 'Send event to event bus',
        category: 'Discovered MCP Tools',
        isAvailable: true
      },
      {
        type: 'mcp-ga-top-pages',
        label: 'GA Top Pages',
        icon: BarChart3,
        color: 'bg-orange-500',
        description: 'Get Google Analytics top pages',
        category: 'Discovered MCP Tools',
        isAvailable: true
      },
      {
        type: 'mcp-agent-delegate',
        label: 'Agent Delegate',
        icon: Bot,
        color: 'bg-purple-500',
        description: 'Delegate task to specialist agent',
        category: 'Discovered MCP Tools',
        isAvailable: true
      }
    ];

    setDiscoveredMCPTools(discoveredTools);
  };

  const handleMCPToolSelect = (tool: any) => {
    // Convert MCP tool to NodeType and add to available nodes
    const nodeType: NodeType = {
      type: `mcp-${tool.name.replace(/[^a-zA-Z0-9]/g, '-')}`,
      label: tool.name,
      icon: getIconForMCPTool(tool),
      color: getColorForMCPTool(tool),
      description: tool.description,
      category: 'Discovered MCP Tools',
      isAvailable: true,
      configSchema: convertMCPSchemaToNodeConfig(tool.inputSchema)
    };

    setDiscoveredMCPTools(prev => {
      const existing = prev.find(t => t.type === nodeType.type);
      if (existing) return prev;
      return [...prev, nodeType];
    });

    setShowMCPDiscovery(false);
  };

  const getIconForMCPTool = (tool: any) => {
    const name = tool.name.toLowerCase();
    if (name.includes('event')) return Radio;
    if (name.includes('analytics') || name.includes('ga')) return BarChart3;
    if (name.includes('agent')) return Bot;
    if (name.includes('kv') || name.includes('store')) return Database;
    if (name.includes('artifact')) return Archive;
    if (name.includes('workflow')) return Zap;
    return Settings;
  };

  const getColorForMCPTool = (tool: any) => {
    const category = tool.category || 'utility';
    const colors = {
      data: 'bg-purple-500',
      communication: 'bg-green-500',
      analytics: 'bg-orange-500',
      ai: 'bg-blue-500',
      automation: 'bg-red-500',
      integration: 'bg-yellow-500',
      utility: 'bg-gray-500'
    };
    return colors[category as keyof typeof colors] || 'bg-gray-500';
  };

  const convertMCPSchemaToNodeConfig = (inputSchema: any) => {
    if (!inputSchema?.properties) return undefined;

    const config: any = {};
    Object.entries(inputSchema.properties).forEach(([key, prop]: [string, any]) => {
      switch (prop.type) {
        case 'string':
          config[key] = {
            type: prop.enum ? 'select' : 'text',
            label: prop.description || key,
            required: inputSchema.required?.includes(key) || false,
            options: prop.enum
          };
          break;
        case 'number':
          config[key] = {
            type: 'number',
            label: prop.description || key,
            required: inputSchema.required?.includes(key) || false,
            min: prop.minimum,
            max: prop.maximum
          };
          break;
        case 'boolean':
          config[key] = {
            type: 'checkbox',
            label: prop.description || key,
            required: inputSchema.required?.includes(key) || false
          };
          break;
        case 'object':
          config[key] = {
            type: 'textarea',
            label: prop.description || key,
            required: inputSchema.required?.includes(key) || false,
            placeholder: 'JSON object'
          };
          break;
      }
    });

    return Object.keys(config).length > 0 ? config : undefined;
  };

  // Combine all node types and mark availability based on connected integrations
  const getAllNodeTypes = (): NodeType[] => {
    const allNodes = [...BASE_NODE_TYPES, ...MCP_NODE_TYPES, ...AGENT_NODE_TYPES];

    // Add discovered MCP tools
    allNodes.push(...discoveredMCPTools());

    // Add integration-specific nodes
    Object.entries(INTEGRATION_NODE_TYPES).forEach(([integration, nodes]) => {
      const isConnected = props.connectedIntegrations.includes(integration);
      nodes.forEach(node => {
        allNodes.push({
          ...node,
          isAvailable: isConnected
        });
      });
    });

    return allNodes;
  };

  // Group nodes by category
  const getNodesByCategory = () => {
    const allNodes = getAllNodeTypes();
    const filtered = searchQuery()
      ? allNodes.filter(node =>
          node.label.toLowerCase().includes(searchQuery().toLowerCase()) ||
          node.description.toLowerCase().includes(searchQuery().toLowerCase())
        )
      : allNodes;

    const grouped: { [category: string]: NodeType[] } = {};
    filtered.forEach(node => {
      if (!grouped[node.category]) {
        grouped[node.category] = [];
      }
      grouped[node.category].push(node);
    });

    return grouped;
  };

  const toggleCategory = (category: string) => {
    const expanded = expandedCategories();
    if (expanded.has(category)) {
      expanded.delete(category);
    } else {
      expanded.add(category);
    }
    setExpandedCategories(new Set(expanded));
  };

  const handleDragStart = (e: DragEvent, nodeType: string) => {
    e.dataTransfer?.setData('text/plain', nodeType);
    props.onDragStart(nodeType);
  };

  const handleConnectIntegration = (integration: string) => {
    props.onConnectIntegration?.(integration);
  };

  return (
    <div class="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
      {/* Header */}
      <div class="p-4 border-b border-gray-200 dark:border-gray-700">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
            Workflow Nodes
          </h2>
          <div class="flex items-center gap-2">
            <button
              class={`p-1 rounded transition-colors ${
                isConnected()
                  ? 'text-blue-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                  : 'text-gray-400 cursor-not-allowed'
              }`}
              title={isConnected() ? "Discover MCP Tools" : "MCP Server not connected"}
              onClick={() => isConnected() && setShowMCPDiscovery(true)}
              disabled={!isConnected()}
            >
              <Package class="w-4 h-4" />
            </button>
            <button
              class="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
              title="Node Library Settings"
              onClick={() => {/* TODO: Open node library settings */}}
            >
              <Settings class="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div class="relative">
          <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search nodes..."
            value={searchQuery()}
            onInput={(e) => setSearchQuery(e.currentTarget.value)}
            class="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Node Categories */}
      <div class="flex-1 overflow-y-auto">
        <For each={Object.entries(getNodesByCategory())}>
          {([category, nodes]) => {
            const isExpanded = expandedCategories().has(category);
            const availableCount = nodes.filter(n => n.isAvailable).length;
            const totalCount = nodes.length;

            return (
              <div class="border-b border-gray-200 dark:border-gray-700">
                {/* Category Header */}
                <button
                  onClick={() => toggleCategory(category)}
                  class="w-full flex items-center justify-between p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <div class="flex items-center gap-2">
                    <Show
                      when={isExpanded}
                      fallback={<ChevronRight class="w-4 h-4 text-gray-400" />}
                    >
                      <ChevronDown class="w-4 h-4 text-gray-400" />
                    </Show>
                    <span class="text-sm font-medium text-gray-900 dark:text-white">
                      {category}
                    </span>
                    <span class="text-xs text-gray-500 dark:text-gray-400">
                      ({availableCount}/{totalCount})
                    </span>
                  </div>
                </button>

                {/* Category Nodes */}
                <Show when={isExpanded}>
                  <div class="pb-2">
                    <For each={nodes}>
                      {(node) => (
                        <div class="px-3 py-1">
                          <Show
                            when={node.isAvailable}
                            fallback={
                              <div class="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg opacity-60">
                                <div class="flex items-center gap-3">
                                  <div class={`w-8 h-8 rounded-lg ${node.color} flex items-center justify-center opacity-50`}>
                                    <node.icon class="w-4 h-4 text-white" />
                                  </div>
                                  <div>
                                    <div class="text-sm font-medium text-gray-600 dark:text-gray-400">
                                      {node.label}
                                    </div>
                                    <div class="text-xs text-gray-500">
                                      Requires {node.requiresIntegration}
                                    </div>
                                  </div>
                                </div>
                                <Show when={node.requiresIntegration}>
                                  <button
                                    onClick={() => handleConnectIntegration(node.requiresIntegration!)}
                                    class="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                                  >
                                    Connect
                                  </button>
                                </Show>
                              </div>
                            }
                          >
                            <div
                              draggable
                              onDragStart={(e) => handleDragStart(e, node.type)}
                              class="flex items-center gap-3 p-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 cursor-grab hover:shadow-md hover:border-blue-300 dark:hover:border-blue-600 transition-all"
                              title={node.description}
                            >
                              <div class={`w-8 h-8 rounded-lg ${node.color} flex items-center justify-center`}>
                                <node.icon class="w-4 h-4 text-white" />
                              </div>
                              <div class="flex-1 min-w-0">
                                <div class="text-sm font-medium text-gray-900 dark:text-white truncate">
                                  {node.label}
                                </div>
                                <div class="text-xs text-gray-500 dark:text-gray-400 truncate">
                                  {node.description}
                                </div>
                              </div>
                            </div>
                          </Show>
                        </div>
                      )}
                    </For>
                  </div>
                </Show>
              </div>
            );
          }}
        </For>
      </div>

      {/* Footer */}
      <div class="p-4 border-t border-gray-200 dark:border-gray-700">
        <div class="text-xs text-gray-500 dark:text-gray-400 text-center">
          Drag nodes to the canvas to build your workflow
        </div>
        <Show when={isConnected() && discoveredMCPTools().length > 0}>
          <div class="mt-2 text-xs text-blue-600 dark:text-blue-400 text-center">
            {discoveredMCPTools().length} MCP tools discovered
          </div>
        </Show>
      </div>

      {/* MCP Tool Discovery Modal */}
      <Show when={showMCPDiscovery()}>
        <div class="fixed inset-0 z-50">
          <MCPToolDiscovery
            onClose={() => setShowMCPDiscovery(false)}
            onToolSelect={handleMCPToolSelect}
            showOnlyAvailable={true}
          />
        </div>
      </Show>
    </div>
  );
}