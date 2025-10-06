import { createSignal, createEffect, For, Show, createMemo } from 'solid-js';
import { useDashboardServer } from '../../../contexts/DashboardServerContext';
import { useOrganization } from '../../../contexts/OrganizationContext';
import { AgentConfigForm, type AgentConfigFormData } from '../../AgentConfigForm';
// Workflow nodes library - dedicated components for node configuration
import {
  ConditionalNodeConfig,
  DEFAULT_CONDITIONAL_CONFIG,
  SwitchNodeConfig,
  DEFAULT_SWITCH_CONFIG,
  HttpNodeConfig,
  DEFAULT_HTTP_CONFIG,
  KVStoreNodeConfig,
  DEFAULT_KV_GET_CONFIG,
  DEFAULT_KV_SET_CONFIG,
  TriggerNodeConfig,
  DEFAULT_MANUAL_TRIGGER_CONFIG,
  DEFAULT_WEBHOOK_TRIGGER_CONFIG,
  DEFAULT_SCHEDULE_TRIGGER_CONFIG,
  DockerNodeConfig,
  DEFAULT_DOCKER_CONFIG,
  hasDedicatedComponent,
  type ConditionalConfig,
  type SwitchConfig,
  type HttpConfig,
  type KVStoreConfig,
  type TriggerConfig,
  type DockerConfig
} from '../../../lib/workflow-nodes';
import { mcpRegistry } from '../../../services/MCPCapabilityRegistry';
import { CredentialSelector } from './CredentialSelector';
import { UpgradePrompt } from './UpgradePrompt';
import { useNodeAvailable } from '../../../hooks/useFeatureFlag';
import {
  Settings, X, Save, Play, Code, Database, Zap, Bot,
  MessageSquare, Calendar, BarChart3, Cloud, Users,
  CreditCard, Lock, Eye, EyeOff, Info, AlertTriangle,
  ChevronDown, ChevronRight, Copy, Trash2, DollarSign, Shield,
  ArrowRight
} from 'lucide-solid';

export interface WorkflowNode {
  id: string;
  type: string;
  x: number;
  y: number;
  inputs: string[];
  outputs: string[];
  config: {
    [key: string]: any;
  };
  title?: string;
  description?: string;
  enabled?: boolean;
  agentConfig?: {
    modelId?: string;
    temperature?: number;
    maxTokens?: number;
    systemPrompt?: string;
    requiresPrivacy?: boolean;
  };
}

interface NodeDetailsProps {
  node: WorkflowNode | null;
  onUpdate: (node: WorkflowNode) => void;
  onClose: () => void;
  availableModels?: string[];
}

interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  costPer1kTokens: {
    input: number;
    output: number;
  };
  purpose: string;
  strengths: string[];
  limitations: string[];
  maxTokens: number;
  contextWindow: number;
  speed: 'fast' | 'medium' | 'slow';
  quality: 'high' | 'medium' | 'low';
}

function WorkflowNodeDetails(props: NodeDetailsProps) {
  const [localNode, setLocalNode] = createSignal<WorkflowNode | null>(null);
  const [activeTab, setActiveTab] = createSignal('config');
  const [showPassword, setShowPassword] = createSignal(false);
  const [validationErrors, setValidationErrors] = createSignal<string[]>([]);
  const [showModelDetails, setShowModelDetails] = createSignal(false);

  const { executeTool } = useDashboardServer();
  const { currentOrganization } = useOrganization();

  // Check if node is available based on feature flags
  const isNodeAvailable = createMemo(() => {
    const node = localNode();
    if (!node) return true;
    const available = useNodeAvailable(node.type);
    return available();
  });

  // Model configurations with cost and purpose information
  const modelConfigs: ModelInfo[] = [
    // AWS Bedrock Models
    {
      id: 'bedrock:claude-3-haiku',
      name: 'Claude 3 Haiku (Bedrock)',
      provider: 'AWS Bedrock',
      costPer1kTokens: { input: 0.00025, output: 0.00125 },
      purpose: 'AWS-hosted, fast & cost-effective',
      strengths: ['AWS native', 'Very fast', 'Low cost', 'Data stays in your AWS account'],
      limitations: ['Limited reasoning compared to larger models'],
      maxTokens: 4096,
      contextWindow: 200000,
      speed: 'fast',
      quality: 'medium'
    },
    {
      id: 'bedrock:claude-3-sonnet',
      name: 'Claude 3 Sonnet (Bedrock)',
      provider: 'AWS Bedrock',
      costPer1kTokens: { input: 0.003, output: 0.015 },
      purpose: 'AWS-hosted, balanced performance',
      strengths: ['AWS native', 'Good reasoning', 'Balanced speed/quality', 'Private deployment'],
      limitations: ['Higher cost than Haiku'],
      maxTokens: 4096,
      contextWindow: 200000,
      speed: 'medium',
      quality: 'high'
    },
    {
      id: 'bedrock:claude-3-opus',
      name: 'Claude 3 Opus (Bedrock)',
      provider: 'AWS Bedrock',
      costPer1kTokens: { input: 0.015, output: 0.075 },
      purpose: 'AWS-hosted, highest quality',
      strengths: ['AWS native', 'Best reasoning', 'Complex problem solving', 'Enterprise security'],
      limitations: ['Most expensive', 'Slower responses'],
      maxTokens: 4096,
      contextWindow: 200000,
      speed: 'slow',
      quality: 'high'
    },
    // Local Ollama Models
    {
      id: 'ollama:llama3.1',
      name: 'Llama 3.1 (Local)',
      provider: 'Ollama/Local',
      costPer1kTokens: { input: 0, output: 0 },
      purpose: 'Free local inference, privacy-first',
      strengths: ['Completely free', 'No API calls', 'Complete data privacy', 'Offline capable'],
      limitations: ['Requires local GPU/CPU', 'Slower than cloud models', 'Limited by hardware'],
      maxTokens: 4096,
      contextWindow: 128000,
      speed: 'medium',
      quality: 'medium'
    },
    {
      id: 'ollama:codellama',
      name: 'Code Llama (Local)',
      provider: 'Ollama/Local',
      costPer1kTokens: { input: 0, output: 0 },
      purpose: 'Free code-specialized model',
      strengths: ['Code generation', 'Free', 'Privacy', 'Specialized for programming'],
      limitations: ['Limited general knowledge', 'Requires local resources'],
      maxTokens: 4096,
      contextWindow: 100000,
      speed: 'medium',
      quality: 'medium'
    },
    {
      id: 'ollama:mistral',
      name: 'Mistral 7B (Local)',
      provider: 'Ollama/Local',
      costPer1kTokens: { input: 0, output: 0 },
      purpose: 'Lightweight, efficient local model',
      strengths: ['Very fast locally', 'Small memory footprint', 'Free', 'Good for simple tasks'],
      limitations: ['Less capable than larger models', 'Limited reasoning'],
      maxTokens: 4096,
      contextWindow: 32000,
      speed: 'fast',
      quality: 'medium'
    },
    // Direct API Models (fallback)
    {
      id: 'claude-3-sonnet',
      name: 'Claude 3 Sonnet (Direct)',
      provider: 'Anthropic API',
      costPer1kTokens: { input: 0.003, output: 0.015 },
      purpose: 'Direct API access, reliable fallback',
      strengths: ['Direct API', 'Reliable', 'Good performance', 'Well-tested'],
      limitations: ['API rate limits', 'Data leaves your infrastructure'],
      maxTokens: 4096,
      contextWindow: 200000,
      speed: 'medium',
      quality: 'high'
    },
    {
      id: 'gpt-4-turbo',
      name: 'GPT-4 Turbo (Direct)',
      provider: 'OpenAI API',
      costPer1kTokens: { input: 0.01, output: 0.03 },
      purpose: 'OpenAI direct access',
      strengths: ['Strong reasoning', 'Large context', 'Multimodal', 'Well-known'],
      limitations: ['Expensive', 'Rate limited', 'Data leaves infrastructure'],
      maxTokens: 4096,
      contextWindow: 128000,
      speed: 'medium',
      quality: 'high'
    }
  ];

  // Helper functions for model information
  const getModelInfo = (modelId: string): ModelInfo | undefined => {
    return modelConfigs.find(model => model.id === modelId);
  };

  const formatCost = (cost: number): string => {
    return `$${cost.toFixed(4)}`;
  };

  const getSpeedBadgeColor = (speed: string): string => {
    switch (speed) {
      case 'fast': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'slow': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getQualityBadgeColor = (quality: string): string => {
    switch (quality) {
      case 'high': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'medium': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'low': return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  // Initialize local node when prop changes
  createEffect(() => {
    if (props.node) {
      setLocalNode({ ...props.node });
    }
  });

  // Node type configurations
  const getNodeConfig = (nodeType: string) => {
    const configs = {
      // Agent System Nodes
      'agent-conductor': {
        title: 'Conductor Agent',
        description: 'Goal-driven planning and task delegation',
        icon: Bot,
        color: 'bg-indigo-500',
        fields: [
          { key: 'goal', label: 'Goal Description', type: 'textarea', required: true },
          { key: 'context', label: 'Context', type: 'textarea' },
          { key: 'maxSubtasks', label: 'Max Subtasks', type: 'number', default: 5 },
          { key: 'timeout', label: 'Timeout (seconds)', type: 'number', default: 300 }
        ],
        agentConfig: true
      },
      'agent-critic': {
        title: 'Critic Agent',
        description: 'Safety validation and risk assessment',
        icon: Shield,
        color: 'bg-red-500',
        fields: [
          { key: 'validationRules', label: 'Validation Rules', type: 'textarea' },
          { key: 'riskThreshold', label: 'Risk Threshold', type: 'select', options: ['low', 'medium', 'high'] },
          { key: 'requireApproval', label: 'Require Approval', type: 'boolean' }
        ],
        agentConfig: true
      },
      'agent-terraform': {
        title: 'Terraform Expert',
        description: 'Infrastructure as code specialist',
        icon: Cloud,
        color: 'bg-purple-500',
        fields: [
          { key: 'workspace', label: 'Terraform Workspace', type: 'text' },
          { key: 'variables', label: 'Variables', type: 'json' },
          { key: 'autoApply', label: 'Auto Apply', type: 'boolean' }
        ],
        agentConfig: true
      },

      // MCP Tools
      'kv-get': {
        title: 'Get Key-Value',
        description: 'Retrieve data from KV store',
        icon: Database,
        color: 'bg-purple-500',
        fields: [
          { key: 'key', label: 'Key', type: 'text', required: true },
          { key: 'defaultValue', label: 'Default Value', type: 'text' }
        ]
      },
      'kv-set': {
        title: 'Set Key-Value',
        description: 'Store data in KV store',
        icon: Database,
        color: 'bg-purple-600',
        fields: [
          { key: 'key', label: 'Key', type: 'text', required: true },
          { key: 'value', label: 'Value', type: 'textarea', required: true },
          { key: 'ttlHours', label: 'TTL (hours)', type: 'number', default: 24 }
        ]
      },

      // Analytics
      'ga-top-pages': {
        title: 'Google Analytics Top Pages',
        description: 'Get top performing pages',
        icon: BarChart3,
        color: 'bg-green-600',
        fields: [
          { key: 'propertyId', label: 'Property ID', type: 'text', required: true },
          { key: 'days', label: 'Days', type: 'number', default: 30 },
          { key: 'limit', label: 'Limit', type: 'number', default: 10 }
        ]
      },

      // Integrations
      'slack-message': {
        title: 'Send Slack Message',
        description: 'Send message to Slack channel',
        icon: MessageSquare,
        color: 'bg-green-500',
        fields: [
          { key: 'channel', label: 'Channel', type: 'text', required: true },
          { key: 'message', label: 'Message', type: 'textarea', required: true },
          { key: 'username', label: 'Username', type: 'text' },
          { key: 'iconEmoji', label: 'Icon Emoji', type: 'text' }
        ]
      },

      // Logic & Control
      'conditional': {
        title: 'Conditional Branch',
        description: 'Route workflow based on conditions (if/else if/else)',
        icon: Code,
        color: 'bg-cyan-500',
        fields: [
          {
            key: 'conditions',
            label: 'Conditions (evaluated in order)',
            type: 'json',
            required: true,
            help: 'Array of {condition, label, output} objects. Use JavaScript expressions like "data.value > 100"'
          },
          {
            key: 'mode',
            label: 'Evaluation Mode',
            type: 'select',
            options: ['first-match', 'all-matches'],
            default: 'first-match',
            help: 'First match stops at first true condition, all matches evaluates all'
          }
        ]
      },
      'switch': {
        title: 'Switch',
        description: 'Route based on value matching (switch/case)',
        icon: Code,
        color: 'bg-blue-500',
        fields: [
          {
            key: 'value',
            label: 'Value to Match',
            type: 'text',
            required: true,
            help: 'Expression to evaluate (e.g., "data.status")'
          },
          {
            key: 'cases',
            label: 'Cases',
            type: 'json',
            required: true,
            help: 'Array of {match, output} objects. Use "default" as catch-all'
          }
        ]
      },

      // HTTP/API
      'http-get': {
        title: 'HTTP GET Request',
        description: 'Fetch data from API endpoint',
        icon: ArrowRight,
        color: 'bg-green-500',
        fields: [
          { key: 'url', label: 'URL', type: 'url', required: true },
          { key: 'headers', label: 'Headers', type: 'json' },
          { key: 'timeout', label: 'Timeout (ms)', type: 'number', default: 30000 }
        ]
      }
    };

    // Check if config exists in hardcoded list
    if (configs[nodeType]) {
      return configs[nodeType];
    }

    // Check if this is an MCP-generated agent node
    const mcpAgents = mcpRegistry.getAgents();
    const mcpAgent = mcpAgents.find(agent => agent.id === nodeType);

    if (mcpAgent) {
      // Return config for MCP agent nodes
      return {
        title: mcpAgent.name,
        description: mcpAgent.description,
        icon: Bot, // Use Bot icon for agents
        color: mcpAgent.color,
        fields: [], // MCP agents use the agent config tab
        agentConfig: true // Enable AI Model configuration tab
      };
    }

    // Check if this is an MCP-generated workflow node
    const mcpNodes = mcpRegistry.getNodes();
    const mcpNode = mcpNodes.find(node => node.type === nodeType);

    if (mcpNode) {
      // Return config for MCP workflow nodes
      return {
        title: mcpNode.name,
        description: mcpNode.description,
        icon: Settings,
        color: mcpNode.color,
        fields: mcpNode.inputs?.map(input => ({
          key: input.name,
          label: input.name,
          type: input.type as any,
          required: input.required
        })) || [],
        agentConfig: false
      };
    }

    // Fallback for unknown node types
    return {
      title: nodeType,
      description: 'Custom node configuration',
      icon: Settings,
      color: 'bg-gray-500',
      fields: [],
      agentConfig: false
    };
  };

  // Update local config
  const updateConfig = (key: string, value: any) => {
    const node = localNode();
    if (!node) return;

    setLocalNode({
      ...node,
      config: {
        ...node.config,
        [key]: value
      }
    });
  };

  // Update agent configuration
  const updateAgentConfig = (key: string, value: any) => {
    const node = localNode();
    if (!node) return;

    setLocalNode({
      ...node,
      agentConfig: {
        ...node.agentConfig,
        [key]: value
      }
    });
  };

  // Validate node configuration
  const validateNode = () => {
    const node = localNode();
    if (!node) return false;

    const nodeConfig = getNodeConfig(node.type);
    const errors: string[] = [];

    // Check required fields
    nodeConfig.fields?.forEach(field => {
      if (field.required && !node.config[field.key]) {
        errors.push(`${field.label} is required`);
      }
    });

    setValidationErrors(errors);
    return errors.length === 0;
  };

  // Save changes
  const saveChanges = () => {
    if (!validateNode()) return;

    const node = localNode();
    if (node) {
      props.onUpdate(node);
      props.onClose();
    }
  };

  // Test node configuration
  const testNode = async () => {
    const node = localNode();
    if (!node || !validateNode()) return;

    try {
      // TODO: Implement node testing logic
      console.log('Testing node:', node);
    } catch (error) {
      console.error('Node test failed:', error);
    }
  };

  // Render field input
  const renderField = (field: any) => {
    const node = localNode();
    if (!node) return null;

    const value = node.config[field.key] ?? field.default ?? '';

    switch (field.type) {
      case 'text':
      case 'url':
      case 'email':
        return (
          <input
            type={field.type}
            class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={value}
            placeholder={field.placeholder}
            onInput={(e) => updateConfig(field.key, e.target.value)}
          />
        );

      case 'textarea':
        return (
          <textarea
            class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows="3"
            value={value}
            placeholder={field.placeholder}
            onInput={(e) => updateConfig(field.key, e.target.value)}
          />
        );

      case 'number':
        return (
          <input
            type="number"
            class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={value}
            onInput={(e) => updateConfig(field.key, Number(e.target.value))}
          />
        );

      case 'boolean':
        return (
          <label class="flex items-center gap-2">
            <input
              type="checkbox"
              class="rounded border-slate-300 dark:border-slate-600"
              checked={Boolean(value)}
              onChange={(e) => updateConfig(field.key, e.target.checked)}
            />
            <span class="text-sm text-slate-700 dark:text-slate-300">Enable</span>
          </label>
        );

      case 'select':
        return (
          <select
            class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={value}
            onChange={(e) => updateConfig(field.key, e.target.value)}
          >
            <option value="">Select...</option>
            <For each={field.options}>
              {(option) => <option value={option}>{option}</option>}
            </For>
          </select>
        );

      case 'json':
        return (
          <textarea
            class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            rows="4"
            value={typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
            placeholder='{"key": "value"}'
            onInput={(e) => {
              try {
                const parsed = JSON.parse(e.target.value);
                updateConfig(field.key, parsed);
              } catch {
                updateConfig(field.key, e.target.value);
              }
            }}
          />
        );

      case 'credential':
        return (
          <CredentialSelector
            integrationId={field.integrationId || 'unknown'}
            value={value}
            onChange={(credentialPath) => updateConfig(field.key, credentialPath)}
            label={field.label}
            showStatus={true}
            showTest={true}
            allowCreate={true}
          />
        );

      case 'password':
        return (
          <div class="relative">
            <input
              type={showPassword() ? 'text' : 'password'}
              class="w-full px-3 py-2 pr-10 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={value}
              onInput={(e) => updateConfig(field.key, e.target.value)}
            />
            <button
              type="button"
              class="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
              onClick={() => setShowPassword(!showPassword())}
            >
              {showPassword() ? <EyeOff class="w-4 h-4" /> : <Eye class="w-4 h-4" />}
            </button>
          </div>
        );

      default:
        return (
          <input
            type="text"
            class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={value}
            onInput={(e) => updateConfig(field.key, e.target.value)}
          />
        );
    }
  };

  return (
    <Show when={localNode()}>
      <div class="fixed right-0 top-0 h-full w-96 bg-white dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700 shadow-lg z-50 flex flex-col">
        {/* Header */}
        <div class="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <div class="flex items-center gap-3">
            <div class={`p-2 rounded-lg ${getNodeConfig(localNode()!.type).color} text-white`}>
              {getNodeConfig(localNode()!.type).icon({ class: "w-4 h-4" })}
            </div>
            <div>
              <h3 class="font-semibold text-slate-900 dark:text-white">
                {getNodeConfig(localNode()!.type).title}
              </h3>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                {getNodeConfig(localNode()!.type).description}
              </p>
            </div>
          </div>
          <button
            class="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            onClick={props.onClose}
          >
            <X class="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div class="flex border-b border-slate-200 dark:border-slate-700">
          <button
            class={`px-4 py-2 text-sm font-medium ${
              activeTab() === 'config'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-slate-500 hover:text-slate-700'
            }`}
            onClick={() => setActiveTab('config')}
          >
            Configuration
          </button>
          <Show when={getNodeConfig(localNode()!.type).agentConfig}>
            <button
              class={`px-4 py-2 text-sm font-medium ${
                activeTab() === 'agent'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
              onClick={() => setActiveTab('agent')}
            >
              AI Model
            </button>
          </Show>
          <button
            class={`px-4 py-2 text-sm font-medium ${
              activeTab() === 'advanced'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-slate-500 hover:text-slate-700'
            }`}
            onClick={() => setActiveTab('advanced')}
          >
            Advanced
          </button>
        </div>

        {/* Content */}
        <div class="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Show upgrade prompt if node is locked */}
          <Show when={!isNodeAvailable()}>
            <UpgradePrompt
              nodeType={localNode()!.type}
              nodeDisplayName={getNodeConfig(localNode()!.type).title}
              nodeDescription={getNodeConfig(localNode()!.type).description}
            />
          </Show>

          {/* Show configuration only if node is available */}
          <Show when={isNodeAvailable()}>
            {/* Validation Errors */}
            <Show when={validationErrors().length > 0}>
              <div class="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md">
                <div class="flex items-center gap-2 mb-2">
                  <AlertTriangle class="w-4 h-4 text-red-600 dark:text-red-400" />
                  <span class="text-sm font-medium text-red-800 dark:text-red-200">
                    Configuration Errors
                  </span>
                </div>
                <ul class="text-sm text-red-700 dark:text-red-300 space-y-1">
                  <For each={validationErrors()}>
                    {(error) => <li>• {error}</li>}
                  </For>
                </ul>
              </div>
            </Show>

            {/* Configuration Tab */}
            <Show when={activeTab() === 'config'}>
            {/* Logic Nodes - Conditional */}
            <Show when={localNode()!.type === 'conditional'}>
              <ConditionalNodeConfig
                value={localNode()!.config as ConditionalConfig || DEFAULT_CONDITIONAL_CONFIG}
                onChange={(config) => {
                  setLocalNode({ ...localNode()!, config: config });
                }}
              />
            </Show>

            {/* Logic Nodes - Switch */}
            <Show when={localNode()!.type === 'switch'}>
              <SwitchNodeConfig
                value={localNode()!.config as SwitchConfig || DEFAULT_SWITCH_CONFIG}
                onChange={(config) => {
                  setLocalNode({ ...localNode()!, config: config });
                }}
              />
            </Show>

            {/* HTTP Nodes */}
            <Show when={['http-get', 'http-post', 'http-put', 'http-delete'].includes(localNode()!.type)}>
              <HttpNodeConfig
                value={localNode()!.config as HttpConfig || { ...DEFAULT_HTTP_CONFIG, method: localNode()!.type.split('-')[1].toUpperCase() as any }}
                onChange={(config) => {
                  setLocalNode({ ...localNode()!, config: config });
                }}
              />
            </Show>

            {/* Storage Nodes - KV */}
            <Show when={['kv-get', 'kv-set'].includes(localNode()!.type)}>
              <KVStoreNodeConfig
                value={localNode()!.config as KVStoreConfig || (localNode()!.type === 'kv-get' ? DEFAULT_KV_GET_CONFIG : DEFAULT_KV_SET_CONFIG)}
                onChange={(config) => {
                  setLocalNode({ ...localNode()!, config: config });
                }}
                nodeType={localNode()!.type as 'kv-get' | 'kv-set'}
              />
            </Show>

            {/* Trigger Nodes */}
            <Show when={['trigger', 'webhook', 'schedule'].includes(localNode()!.type)}>
              <TriggerNodeConfig
                value={localNode()!.config as TriggerConfig || (
                  localNode()!.type === 'trigger' ? DEFAULT_MANUAL_TRIGGER_CONFIG :
                  localNode()!.type === 'webhook' ? DEFAULT_WEBHOOK_TRIGGER_CONFIG :
                  DEFAULT_SCHEDULE_TRIGGER_CONFIG
                )}
                onChange={(config) => {
                  setLocalNode({ ...localNode()!, config: config });
                }}
                triggerType={localNode()!.type as 'trigger' | 'webhook' | 'schedule'}
              />
            </Show>

            {/* Docker Nodes */}
            <Show when={localNode()!.type === 'docker-run'}>
              <DockerNodeConfig
                value={localNode()!.config as DockerConfig || DEFAULT_DOCKER_CONFIG}
                onChange={(config) => {
                  setLocalNode({ ...localNode()!, config: config });
                }}
              />
            </Show>

            {/* Generic Config Form for Other Node Types */}
            <Show when={!hasDedicatedComponent(localNode()!.type)}>
            <div class="space-y-4">
              {/* Basic Settings */}
              <div class="space-y-3">
                <div>
                  <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Node Title
                  </label>
                  <input
                    type="text"
                    class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={localNode()?.title || ''}
                    onInput={(e) => setLocalNode({ ...localNode()!, title: e.target.value })}
                  />
                </div>

                <div>
                  <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Description
                  </label>
                  <textarea
                    class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows="2"
                    value={localNode()?.description || ''}
                    onInput={(e) => setLocalNode({ ...localNode()!, description: e.target.value })}
                  />
                </div>
              </div>

              {/* Type-specific Fields */}
              <For each={getNodeConfig(localNode()!.type).fields}>
                {(field) => (
                  <div>
                    <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      {field.label}
                      {field.required && <span class="text-red-500 ml-1">*</span>}
                    </label>
                    {renderField(field)}
                    <Show when={field.help}>
                      <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {field.help}
                      </p>
                    </Show>
                  </div>
                )}
              </For>
            </div>
          </Show>

          {/* Agent Configuration Tab - Using Shared AgentConfigForm */}
          <Show when={activeTab() === 'agent' && getNodeConfig(localNode()!.type).agentConfig}>
            <AgentConfigForm
              value={{
                name: localNode()!.title || getNodeConfig(localNode()!.type).title,
                description: localNode()!.description,
                category: 'agents',
                icon: '🤖',
                modelId: localNode()!.agentConfig?.modelId || 'bedrock:anthropic.claude-3-5-sonnet-20241022-v2:0',
                temperature: localNode()!.agentConfig?.temperature ?? 0.7,
                maxTokens: localNode()!.agentConfig?.maxTokens ?? 2048,
                systemPrompt: localNode()!.agentConfig?.systemPrompt,
                requiresPrivacy: localNode()!.agentConfig?.requiresPrivacy ?? false
              }}
              onChange={(config: AgentConfigFormData) => {
                const updated = {
                  ...localNode()!,
                  agentConfig: {
                    ...localNode()!.agentConfig,
                    modelId: config.modelId,
                    temperature: config.temperature,
                    maxTokens: config.maxTokens,
                    systemPrompt: config.systemPrompt,
                    requiresPrivacy: config.requiresPrivacy
                  }
                };
                setLocalNode(updated);
              }}
              availableModels={props.availableModels?.map(m => ({ id: m, name: m }))}
              showAdvanced={true}
              mode="edit"
            />
          </Show>

          {/* Old Agent Configuration Tab - Removed, replaced with shared form above */}
          <Show when={false && activeTab() === 'agent' && getNodeConfig(localNode()!.type).agentConfig}>
            <div class="space-y-4">
              <div>
                <div class="flex items-center justify-between mb-2">
                  <label class="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    AI Model
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowModelDetails(!showModelDetails())}
                    class="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                  >
                    <Info class="w-3 h-3" />
                    Model Details
                  </button>
                </div>

                {/* Model Selection */}
                <div class="space-y-2">
                  <For each={modelConfigs}>
                    {(model) => (
                      <div
                        class={`border rounded-lg p-3 cursor-pointer transition-colors ${
                          (localNode()?.agentConfig?.modelId || 'bedrock:claude-3-sonnet') === model.id
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
                        }`}
                        onClick={() => updateAgentConfig('modelId', model.id)}
                      >
                        <div class="flex items-start justify-between">
                          <div class="flex-1">
                            <div class="flex items-center gap-2 mb-1">
                              <span class="font-medium text-slate-900 dark:text-white">
                                {model.name}
                              </span>
                              <span class="text-xs text-slate-500 dark:text-slate-400">
                                {model.provider}
                              </span>
                              <span class={`px-2 py-0.5 rounded-full text-xs font-medium ${getSpeedBadgeColor(model.speed)}`}>
                                {model.speed}
                              </span>
                              <span class={`px-2 py-0.5 rounded-full text-xs font-medium ${getQualityBadgeColor(model.quality)}`}>
                                {model.quality}
                              </span>
                            </div>
                            <p class="text-sm text-slate-600 dark:text-slate-400 mb-2">
                              {model.purpose}
                            </p>
                            <div class="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                              <span>
                                Input: {formatCost(model.costPer1kTokens.input)}/1K tokens
                              </span>
                              <span>
                                Output: {formatCost(model.costPer1kTokens.output)}/1K tokens
                              </span>
                              <span>
                                Context: {model.contextWindow.toLocaleString()}
                              </span>
                            </div>
                          </div>
                          <div class="flex items-center">
                            <input
                              type="radio"
                              name="model"
                              checked={(localNode()?.agentConfig?.modelId || 'bedrock:claude-3-sonnet') === model.id}
                              class="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                              readOnly
                            />
                          </div>
                        </div>

                        <Show when={showModelDetails() && (localNode()?.agentConfig?.modelId || 'bedrock:claude-3-sonnet') === model.id}>
                          <div class="mt-3 pt-3 border-t border-slate-200 dark:border-slate-600">
                            <div class="grid grid-cols-1 gap-3">
                              <div>
                                <h4 class="text-sm font-medium text-green-700 dark:text-green-400 mb-1">Strengths</h4>
                                <ul class="text-xs text-slate-600 dark:text-slate-400 space-y-0.5">
                                  <For each={model.strengths}>
                                    {(strength) => <li>• {strength}</li>}
                                  </For>
                                </ul>
                              </div>
                              <div>
                                <h4 class="text-sm font-medium text-orange-700 dark:text-orange-400 mb-1">Limitations</h4>
                                <ul class="text-xs text-slate-600 dark:text-slate-400 space-y-0.5">
                                  <For each={model.limitations}>
                                    {(limitation) => <li>• {limitation}</li>}
                                  </For>
                                </ul>
                              </div>
                            </div>
                          </div>
                        </Show>
                      </div>
                    )}
                  </For>
                </div>

                {/* Cost Estimate */}
                <Show when={localNode()?.agentConfig?.modelId}>
                  <div class="mt-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <div class="flex items-center gap-2 text-sm">
                      <DollarSign class="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span class="text-blue-800 dark:text-blue-200">
                        Estimated cost: {formatCost(
                          (getModelInfo(localNode()?.agentConfig?.modelId!)?.costPer1kTokens.input || 0) * 2 +
                          (getModelInfo(localNode()?.agentConfig?.modelId!)?.costPer1kTokens.output || 0) * 1
                        )} per typical workflow run
                      </span>
                    </div>
                    <p class="text-xs text-blue-600 dark:text-blue-300 mt-1">
                      Based on ~2K input + 1K output tokens. Actual costs vary by usage.
                    </p>
                  </div>
                </Show>
              </div>

              <div>
                <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Temperature ({localNode()?.agentConfig?.temperature || 0.7})
                </label>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  class="w-full"
                  value={localNode()?.agentConfig?.temperature || 0.7}
                  onInput={(e) => updateAgentConfig('temperature', Number(e.target.value))}
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Max Tokens
                </label>
                <input
                  type="number"
                  class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={localNode()?.agentConfig?.maxTokens || 4000}
                  onInput={(e) => updateAgentConfig('maxTokens', Number(e.target.value))}
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  System Prompt
                </label>
                <textarea
                  class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows="4"
                  value={localNode()?.agentConfig?.systemPrompt || ''}
                  onInput={(e) => updateAgentConfig('systemPrompt', e.target.value)}
                />
              </div>

              <div>
                <label class="flex items-center gap-2">
                  <input
                    type="checkbox"
                    class="rounded border-slate-300 dark:border-slate-600"
                    checked={localNode()?.agentConfig?.requiresPrivacy || false}
                    onChange={(e) => updateAgentConfig('requiresPrivacy', e.target.checked)}
                  />
                  <span class="text-sm text-slate-700 dark:text-slate-300">
                    Requires Privacy (use local models)
                  </span>
                </label>
              </div>
            </div>
          </Show>

          {/* Advanced Tab */}
          <Show when={activeTab() === 'advanced'}>
            <div class="space-y-4">
              <div>
                <label class="flex items-center gap-2">
                  <input
                    type="checkbox"
                    class="rounded border-slate-300 dark:border-slate-600"
                    checked={localNode()?.enabled !== false}
                    onChange={(e) => setLocalNode({ ...localNode()!, enabled: e.target.checked })}
                  />
                  <span class="text-sm text-slate-700 dark:text-slate-300">
                    Enable Node
                  </span>
                </label>
              </div>

              <div>
                <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Node ID
                </label>
                <div class="flex items-center gap-2">
                  <input
                    type="text"
                    class="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white rounded-md"
                    value={localNode()?.id || ''}
                    readonly
                  />
                  <button
                    class="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    onClick={() => navigator.clipboard.writeText(localNode()?.id || '')}
                    title="Copy ID"
                  >
                    <Copy class="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div>
                <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Position
                </label>
                <div class="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    class="px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={localNode()?.x || 0}
                    onInput={(e) => setLocalNode({ ...localNode()!, x: Number(e.target.value) })}
                    placeholder="X"
                  />
                  <input
                    type="number"
                    class="px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={localNode()?.y || 0}
                    onInput={(e) => setLocalNode({ ...localNode()!, y: Number(e.target.value) })}
                    placeholder="Y"
                  />
                </div>
              </div>
            </div>
          </Show>
          </Show>
        </div>

        {/* Footer Actions */}
        <div class="p-4 border-t border-slate-200 dark:border-slate-700">
          <div class="flex items-center justify-between">
            <div class="flex gap-2">
              <button
                class="btn btn-secondary text-sm"
                onClick={testNode}
              >
                <Play class="w-4 h-4 mr-1" />
                Test
              </button>
            </div>

            <div class="flex gap-2">
              <button
                class="btn btn-secondary text-sm"
                onClick={props.onClose}
              >
                Cancel
              </button>
              <button
                class="btn btn-primary text-sm"
                onClick={saveChanges}
                disabled={validationErrors().length > 0}
              >
                <Save class="w-4 h-4 mr-1" />
                Save
              </button>
            </div>
          </div>
        </div>
      </div>
    </Show>
  );
}

export default WorkflowNodeDetails;