import { createSignal, createEffect, Show, For } from 'solid-js';
import { useDashboardServer } from '../contexts/DashboardServerContext';
import { useNotifications } from '../contexts/NotificationContext';
import {
  Search,
  Filter,
  Zap,
  Database,
  Cloud,
  MessageSquare,
  BarChart3,
  Settings,
  Globe,
  FileText,
  Users,
  Mail,
  Calendar,
  Image,
  Code,
  Cpu,
  Workflow,
  Package,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Info,
  ExternalLink,
  Plus
} from 'lucide-solid';

interface MCPTool {
  name: string;
  description: string;
  category: 'data' | 'communication' | 'analytics' | 'storage' | 'ai' | 'automation' | 'integration' | 'utility';
  inputSchema: any;
  outputSchema?: any;
  version?: string;
  provider: string;
  isAvailable: boolean;
  requiredPermissions?: string[];
  examples?: {
    name: string;
    description: string;
    inputExample: any;
  }[];
  documentation?: string;
  tags: string[];
}

interface MCPCapability {
  id: string;
  name: string;
  description: string;
  tools: MCPTool[];
  status: 'available' | 'loading' | 'error' | 'disabled';
  provider: string;
  version: string;
  lastUpdated: string;
}

interface MCPToolDiscoveryProps {
  onToolSelect?: (tool: MCPTool) => void;
  selectedCategory?: string;
  showOnlyAvailable?: boolean;
}

export default function MCPToolDiscovery(props: MCPToolDiscoveryProps) {
  const [capabilities, setCapabilities] = createSignal<MCPCapability[]>([]);
  const [allTools, setAllTools] = createSignal<MCPTool[]>([]);
  const [filteredTools, setFilteredTools] = createSignal<MCPTool[]>([]);
  const [searchQuery, setSearchQuery] = createSignal('');
  const [selectedCategory, setSelectedCategory] = createSignal<string>(props.selectedCategory || 'all');
  const [showOnlyAvailable, setShowOnlyAvailable] = createSignal(props.showOnlyAvailable || false);
  const [loading, setLoading] = createSignal(true);
  const [selectedTool, setSelectedTool] = createSignal<MCPTool | null>(null);
  const [refreshing, setRefreshing] = createSignal(false);

  const { executeTool, isConnected } = useDashboardServer();
  const { success, error, info } = useNotifications();

  const categories = [
    { id: 'all', name: 'All Tools', icon: Package },
    { id: 'data', name: 'Data & Storage', icon: Database },
    { id: 'communication', name: 'Communication', icon: MessageSquare },
    { id: 'analytics', name: 'Analytics', icon: BarChart3 },
    { id: 'ai', name: 'AI & ML', icon: Cpu },
    { id: 'automation', name: 'Automation', icon: Workflow },
    { id: 'integration', name: 'Integrations', icon: Globe },
    { id: 'utility', name: 'Utilities', icon: Settings }
  ];

  const categoryIcons = {
    data: Database,
    communication: MessageSquare,
    analytics: BarChart3,
    storage: Cloud,
    ai: Cpu,
    automation: Workflow,
    integration: Globe,
    utility: Settings
  };

  createEffect(async () => {
    await discoverMCPTools();
  });

  createEffect(() => {
    const query = searchQuery().toLowerCase();
    const category = selectedCategory();
    const availableOnly = showOnlyAvailable();

    let filtered = allTools().filter(tool => {
      const matchesSearch = !query ||
        tool.name.toLowerCase().includes(query) ||
        tool.description.toLowerCase().includes(query) ||
        tool.tags.some(tag => tag.toLowerCase().includes(query)) ||
        tool.provider.toLowerCase().includes(query);

      const matchesCategory = category === 'all' || tool.category === category;
      const matchesAvailability = !availableOnly || tool.isAvailable;

      return matchesSearch && matchesCategory && matchesAvailability;
    });

    // Sort by availability, then name
    filtered.sort((a, b) => {
      if (a.isAvailable !== b.isAvailable) {
        return a.isAvailable ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    setFilteredTools(filtered);
  });

  const discoverMCPTools = async () => {
    try {
      setLoading(true);

      if (!isConnected()) {
        info('MCP server not connected. Showing mock tool data.');
        loadMockTools();
        return;
      }

      // Try to get real MCP tool list
      try {
        const result = await executeTool('listTools', {});
        if (result?.tools) {
          processMCPTools(result.tools);
        } else {
          loadMockTools();
        }
      } catch (err) {
        console.warn('Failed to get real MCP tools, using mock data:', err);
        loadMockTools();
      }
    } catch (err) {
      error(`Failed to discover MCP tools: ${err.message}`);
      loadMockTools();
    } finally {
      setLoading(false);
    }
  };

  const processMCPTools = (mcpTools: any[]) => {
    const tools: MCPTool[] = mcpTools.map(tool => ({
      name: tool.name,
      description: tool.description || 'No description available',
      category: categorizeTool(tool.name),
      inputSchema: tool.inputSchema,
      outputSchema: tool.outputSchema,
      provider: 'MCP Server',
      isAvailable: true,
      tags: generateTags(tool.name, tool.description || ''),
      examples: generateExamples(tool.name, tool.inputSchema)
    }));

    const capability: MCPCapability = {
      id: 'mcp-server',
      name: 'MCP Server',
      description: 'Model Context Protocol server tools',
      tools,
      status: 'available',
      provider: 'Agent Mesh',
      version: '1.0.0',
      lastUpdated: new Date().toISOString()
    };

    setCapabilities([capability]);
    setAllTools(tools);
  };

  const loadMockTools = () => {
    const mockTools: MCPTool[] = [
      {
        name: 'kv_get',
        description: 'Retrieve a value from the key-value store',
        category: 'data',
        inputSchema: {
          type: 'object',
          properties: {
            key: { type: 'string', description: 'The key to retrieve' }
          },
          required: ['key']
        },
        provider: 'KV Store',
        isAvailable: true,
        tags: ['storage', 'database', 'retrieval'],
        examples: [
          {
            name: 'Get user preference',
            description: 'Retrieve user preferences from storage',
            inputExample: { key: 'user-123-preferences' }
          }
        ]
      },
      {
        name: 'kv_set',
        description: 'Store a value in the key-value store',
        category: 'data',
        inputSchema: {
          type: 'object',
          properties: {
            key: { type: 'string', description: 'The key to set' },
            value: { type: 'string', description: 'The value to store' },
            ttl_hours: { type: 'number', description: 'Time to live in hours' }
          },
          required: ['key', 'value']
        },
        provider: 'KV Store',
        isAvailable: true,
        tags: ['storage', 'database', 'persistence'],
        examples: [
          {
            name: 'Save user data',
            description: 'Store user data with expiration',
            inputExample: { key: 'user-123-session', value: 'session-data', ttl_hours: 24 }
          }
        ]
      },
      {
        name: 'ga_getTopPages',
        description: 'Get top performing pages from Google Analytics',
        category: 'analytics',
        inputSchema: {
          type: 'object',
          properties: {
            propertyId: { type: 'string', description: 'GA4 property ID' },
            days: { type: 'number', description: 'Number of days to analyze' }
          },
          required: ['propertyId']
        },
        provider: 'Google Analytics',
        isAvailable: true,
        tags: ['analytics', 'google', 'reporting', 'metrics'],
        examples: [
          {
            name: 'Weekly report',
            description: 'Get top pages for the last 7 days',
            inputExample: { propertyId: '12345678', days: 7 }
          }
        ]
      },
      {
        name: 'events_send',
        description: 'Send an event to the event bus',
        category: 'communication',
        inputSchema: {
          type: 'object',
          properties: {
            detailType: { type: 'string', description: 'The event type' },
            detail: { type: 'object', description: 'The event details' },
            source: { type: 'string', description: 'The event source' }
          },
          required: ['detailType', 'detail']
        },
        provider: 'Event Bus',
        isAvailable: true,
        tags: ['events', 'messaging', 'integration', 'notification'],
        examples: [
          {
            name: 'Workflow completion',
            description: 'Send workflow completion event',
            inputExample: {
              detailType: 'WorkflowCompleted',
              detail: { workflowId: 'wf-123', status: 'success' }
            }
          }
        ]
      },
      {
        name: 'agent_processRequest',
        description: 'Process request through agent governance system',
        category: 'ai',
        inputSchema: {
          type: 'object',
          properties: {
            userId: { type: 'string', description: 'User identifier' },
            sessionId: { type: 'string', description: 'Session identifier' },
            request: { type: 'string', description: 'The request to process' },
            context: { type: 'object', description: 'Additional context' }
          },
          required: ['userId', 'sessionId', 'request']
        },
        provider: 'Agent System',
        isAvailable: true,
        tags: ['ai', 'agents', 'processing', 'governance'],
        examples: [
          {
            name: 'Process user query',
            description: 'Route user query through agent system',
            inputExample: {
              userId: 'user-123',
              sessionId: 'session-456',
              request: 'Generate analytics report'
            }
          }
        ]
      },
      {
        name: 'workflow_start',
        description: 'Start a workflow execution',
        category: 'automation',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'The name of the workflow to start' },
            input: { type: 'object', description: 'Input data for the workflow' }
          },
          required: ['name']
        },
        provider: 'Workflow Engine',
        isAvailable: false, // Mark as not available for demo
        tags: ['workflow', 'automation', 'execution'],
        examples: [
          {
            name: 'Run data pipeline',
            description: 'Execute a data processing workflow',
            inputExample: { name: 'data-pipeline', input: { source: 'api' } }
          }
        ]
      }
    ];

    const mockCapability: MCPCapability = {
      id: 'mock-tools',
      name: 'Mock MCP Tools',
      description: 'Demonstration tools for development',
      tools: mockTools,
      status: 'available',
      provider: 'Development',
      version: '0.1.0',
      lastUpdated: new Date().toISOString()
    };

    setCapabilities([mockCapability]);
    setAllTools(mockTools);
  };

  const categorizeTool = (toolName: string): MCPTool['category'] => {
    const name = toolName.toLowerCase();
    if (name.includes('kv') || name.includes('store') || name.includes('database')) return 'data';
    if (name.includes('event') || name.includes('message') || name.includes('notification')) return 'communication';
    if (name.includes('analytics') || name.includes('report') || name.includes('metric')) return 'analytics';
    if (name.includes('agent') || name.includes('ai') || name.includes('process')) return 'ai';
    if (name.includes('workflow') || name.includes('automation') || name.includes('execute')) return 'automation';
    if (name.includes('api') || name.includes('integration') || name.includes('external')) return 'integration';
    return 'utility';
  };

  const generateTags = (name: string, description: string): string[] => {
    const text = `${name} ${description}`.toLowerCase();
    const tags = [];

    if (text.includes('google')) tags.push('google');
    if (text.includes('analytics')) tags.push('analytics');
    if (text.includes('storage') || text.includes('store')) tags.push('storage');
    if (text.includes('event')) tags.push('events');
    if (text.includes('agent')) tags.push('agents');
    if (text.includes('workflow')) tags.push('workflow');
    if (text.includes('database') || text.includes('data')) tags.push('data');
    if (text.includes('api')) tags.push('api');
    if (text.includes('automation')) tags.push('automation');

    return tags;
  };

  const generateExamples = (toolName: string, inputSchema: any): MCPTool['examples'] => {
    // Generate basic examples based on schema
    if (!inputSchema?.properties) return [];

    const example: any = {};
    Object.entries(inputSchema.properties).forEach(([key, prop]: [string, any]) => {
      switch (prop.type) {
        case 'string':
          example[key] = prop.description?.includes('ID') ? '123456' : 'example-value';
          break;
        case 'number':
          example[key] = 30;
          break;
        case 'boolean':
          example[key] = true;
          break;
        case 'object':
          example[key] = { key: 'value' };
          break;
        default:
          example[key] = 'example';
      }
    });

    return [{
      name: `Basic ${toolName}`,
      description: `Example usage of ${toolName}`,
      inputExample: example
    }];
  };

  const refreshTools = async () => {
    setRefreshing(true);
    await discoverMCPTools();
    setRefreshing(false);
    success('Tool discovery refreshed');
  };

  const handleToolSelect = (tool: MCPTool) => {
    setSelectedTool(tool);
    props.onToolSelect?.(tool);
  };

  const getCategoryIcon = (category: string) => {
    return categoryIcons[category as keyof typeof categoryIcons] || Settings;
  };

  return (
    <div class="mcp-tool-discovery h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <Zap class="w-6 h-6 text-blue-500" />
            <h2 class="text-xl font-bold text-gray-900 dark:text-white">
              MCP Tool Discovery
            </h2>
            <span class="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-sm font-medium rounded-full">
              {filteredTools().length} tools
            </span>
          </div>

          <div class="flex items-center gap-3">
            <div class={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
              isConnected()
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
            }`}>
              <div class={`w-2 h-2 rounded-full ${isConnected() ? 'bg-green-500' : 'bg-red-500'}`} />
              {isConnected() ? 'Connected' : 'Disconnected'}
            </div>

            <button
              onClick={refreshTools}
              disabled={refreshing()}
              class="flex items-center gap-2 px-3 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw class={`w-4 h-4 ${refreshing() ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div class="mt-4 flex items-center gap-4 flex-wrap">
          <div class="relative flex-1 max-w-md">
            <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search tools..."
              value={searchQuery()}
              onInput={(e) => setSearchQuery(e.currentTarget.value)}
              class="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <select
            value={selectedCategory()}
            onInput={(e) => setSelectedCategory(e.currentTarget.value)}
            class="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
          >
            <For each={categories}>
              {(category) => (
                <option value={category.id}>{category.name}</option>
              )}
            </For>
          </select>

          <label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={showOnlyAvailable()}
              onChange={(e) => setShowOnlyAvailable(e.currentTarget.checked)}
              class="rounded"
            />
            Available only
          </label>
        </div>
      </div>

      {/* Tool Grid */}
      <div class="flex-1 overflow-auto p-6">
        <Show
          when={!loading()}
          fallback={
            <div class="flex items-center justify-center h-64">
              <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
            </div>
          }
        >
          <Show
            when={filteredTools().length > 0}
            fallback={
              <div class="text-center py-12">
                <Zap class="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p class="text-gray-500 dark:text-gray-400">No tools found matching your criteria.</p>
              </div>
            }
          >
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <For each={filteredTools()}>
                {(tool) => {
                  const CategoryIcon = getCategoryIcon(tool.category);
                  return (
                    <div class={`bg-white dark:bg-gray-800 rounded-lg border-2 p-6 transition-all cursor-pointer ${
                      tool.isAvailable
                        ? 'border-gray-200 dark:border-gray-700 hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-600'
                        : 'border-gray-100 dark:border-gray-800 opacity-60'
                    } ${selectedTool()?.name === tool.name ? 'border-blue-500 dark:border-blue-400 ring-2 ring-blue-200 dark:ring-blue-800' : ''}`}
                      onClick={() => tool.isAvailable && handleToolSelect(tool)}
                    >
                      {/* Tool Header */}
                      <div class="flex items-start justify-between mb-4">
                        <div class="flex items-center gap-3">
                          <div class={`p-2 rounded-lg ${
                            tool.isAvailable ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-gray-100 dark:bg-gray-700'
                          }`}>
                            <CategoryIcon class={`w-5 h-5 ${
                              tool.isAvailable ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'
                            }`} />
                          </div>
                          <div>
                            <h3 class="font-semibold text-gray-900 dark:text-white">
                              {tool.name}
                            </h3>
                            <p class="text-sm text-gray-500 dark:text-gray-400">
                              {tool.provider}
                            </p>
                          </div>
                        </div>

                        <div class={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                          tool.isAvailable
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                        }`}>
                          {tool.isAvailable ? (
                            <>
                              <CheckCircle class="w-3 h-3" />
                              Available
                            </>
                          ) : (
                            <>
                              <AlertCircle class="w-3 h-3" />
                              Unavailable
                            </>
                          )}
                        </div>
                      </div>

                      {/* Tool Description */}
                      <p class="text-sm text-gray-600 dark:text-gray-300 mb-4 line-clamp-2">
                        {tool.description}
                      </p>

                      {/* Tool Tags */}
                      <div class="flex flex-wrap gap-1 mb-4">
                        <For each={tool.tags.slice(0, 3)}>
                          {(tag) => (
                            <span class="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs rounded">
                              #{tag}
                            </span>
                          )}
                        </For>
                        <Show when={tool.tags.length > 3}>
                          <span class="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs rounded">
                            +{tool.tags.length - 3}
                          </span>
                        </Show>
                      </div>

                      {/* Tool Actions */}
                      <div class="flex items-center justify-between">
                        <span class={`text-xs px-2 py-1 rounded ${
                          tool.category === 'data' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' :
                          tool.category === 'communication' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' :
                          tool.category === 'analytics' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' :
                          tool.category === 'ai' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' :
                          tool.category === 'automation' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' :
                          'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                        }`}>
                          {tool.category}
                        </span>

                        <Show when={tool.isAvailable}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToolSelect(tool);
                            }}
                            class="flex items-center gap-1 px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded-lg transition-colors"
                          >
                            <Plus class="w-3 h-3" />
                            Add to Workflow
                          </button>
                        </Show>
                      </div>
                    </div>
                  );
                }}
              </For>
            </div>
          </Show>
        </Show>
      </div>
    </div>
  );
}