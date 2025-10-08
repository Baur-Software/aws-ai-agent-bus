import { createSignal, For, Show, onMount } from 'solid-js';
import { useDashboardServer } from '../contexts/DashboardServerContext';
import { Plus, Trash2, Wand2, Eye, Code, Save, History, GitBranch, Edit2 } from 'lucide-solid';
import { ShapePicker } from '../components/ShapePicker';
import { NODE_CATEGORIES } from '../types/NodeCategories';
import { NodeVersioningService } from '../services/NodeVersioningService';
import {
  getAllNodes,
  getNodeDefinition,
  type NodeDefinition
} from '@ai-agent-bus/workflow-nodes';
import { TenantNodeConfigService } from '@ai-agent-bus/workflow-nodes';
import type { ShapeType } from '@ai-agent-bus/shapes';
import type { NodeVersion } from '../services/NodeVersioningService';

interface FieldSchema {
  id: string;
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'select' | 'checkbox' | 'array' | 'object';
  required: boolean;
  placeholder?: string;
  options?: string[]; // For select type
  help?: string;
}

interface NodeSchema {
  type: string;
  name: string;
  description: string;
  category: string;
  subcategory?: string;
  icon: string;
  color: string;
  shape?: ShapeType | null;
  fields: FieldSchema[];
}

export default function NodeDesigner() {
  const dashboardServer = useDashboardServer();
  const versioningService = new NodeVersioningService(dashboardServer.kvStore);
  const tenantConfigService = new TenantNodeConfigService(dashboardServer.kvStore);
  const currentTenantId = 'demo-tenant'; // TODO: Get from auth context

  const [mode, setMode] = createSignal<'create' | 'edit-registry' | 'edit-custom'>('create');
  const [selectedRegistryNode, setSelectedRegistryNode] = createSignal<NodeDefinition | null>(null);

  const [nodeSchema, setNodeSchema] = createSignal<NodeSchema>({
    type: '',
    name: '',
    description: '',
    category: 'custom',
    subcategory: '',
    icon: '🔧',
    color: 'bg-blue-500',
    shape: null,
    fields: []
  });

  const [aiPrompt, setAiPrompt] = createSignal('');
  const [isGenerating, setIsGenerating] = createSignal(false);
  const [activeTab, setActiveTab] = createSignal<'visual' | 'ai' | 'preview' | 'code'>('visual');
  const [generatedCode, setGeneratedCode] = createSignal('');

  // Version control state
  const [versionHistory, setVersionHistory] = createSignal<NodeVersion[]>([]);
  const [showVersionHistory, setShowVersionHistory] = createSignal(false);
  const [changelog, setChangelog] = createSignal('');

  // Registry node selection
  const [showRegistryPicker, setShowRegistryPicker] = createSignal(false);
  const [registryNodes, setRegistryNodes] = createSignal<NodeDefinition[]>([]);

  // Get subcategories for selected category
  const availableSubcategories = () => {
    const category = NODE_CATEGORIES.find(c => c.id === nodeSchema().category);
    return category?.subcategories || [];
  };

  // Load registry nodes and version history
  onMount(async () => {
    // Load all registry nodes
    const allNodes = getAllNodes();
    setRegistryNodes(allNodes);

    if (nodeSchema().type) {
      await loadVersionHistory();
    }
  });

  const loadVersionHistory = async () => {
    if (!nodeSchema().type) return;

    const history = await versioningService.getVersionHistory(nodeSchema().type);
    if (history) {
      setVersionHistory(history.versions);
    }
  };

  const addField = () => {
    const newField: FieldSchema = {
      id: `field-${Date.now()}`,
      name: '',
      label: '',
      type: 'text',
      required: false
    };
    setNodeSchema({
      ...nodeSchema(),
      fields: [...nodeSchema().fields, newField]
    });
  };

  const removeField = (id: string) => {
    setNodeSchema({
      ...nodeSchema(),
      fields: nodeSchema().fields.filter(f => f.id !== id)
    });
  };

  const updateField = (id: string, updates: Partial<FieldSchema>) => {
    setNodeSchema({
      ...nodeSchema(),
      fields: nodeSchema().fields.map(f =>
        f.id === id ? { ...f, ...updates } : f
      )
    });
  };

  const generateFromAI = async () => {
    if (!aiPrompt()) return;

    setIsGenerating(true);
    try {
      // Use the AI chat to generate node schema
      const systemPrompt = `You are a workflow node designer assistant. Generate a JSON schema for a workflow node based on the user's description.

The schema should follow this format:
{
  "type": "node-type-kebab-case",
  "name": "Human Readable Name",
  "description": "What this node does",
  "category": "actions|triggers|logic|data|integrations|custom",
  "icon": "emoji",
  "color": "bg-color-500",
  "fields": [
    {
      "name": "fieldName",
      "label": "Field Label",
      "type": "text|textarea|number|select|checkbox|array|object",
      "required": true|false,
      "placeholder": "Optional placeholder",
      "options": ["option1", "option2"], // Only for select type
      "help": "Optional help text"
    }
  ]
}

User request: ${aiPrompt()}

Respond with ONLY the JSON schema, no explanation.`;

      // Note: This would use the reshape_data endpoint or a dedicated node generation endpoint
      const response = await dashboardServer.sendMessageWithResponse({
        type: 'generate_node_schema',
        data: { prompt: systemPrompt }
      });

      if (response.schema) {
        setNodeSchema(response.schema);
      }
    } catch (error) {
      console.error('Failed to generate node schema:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const generateCode = () => {
    const schema = nodeSchema();

    // Generate TypeScript interface
    const interfaceCode = `export interface ${toPascalCase(schema.type)}Config {
${schema.fields.map(f => `  ${f.name}${f.required ? '' : '?'}: ${getTypeScriptType(f.type)};`).join('\n')}
}`;

    // Generate default config
    const defaultConfig = `export const DEFAULT_${schema.type.toUpperCase().replace(/-/g, '_')}_CONFIG: ${toPascalCase(schema.type)}Config = {
${schema.fields.map(f => `  ${f.name}: ${getDefaultValue(f)},`).join('\n')}
};`;

    // Generate node definition
    const nodeDefinition = `{
  type: '${schema.type}',
  name: '${schema.name}',
  description: '${schema.description}',
  category: '${schema.category}',
  icon: '${schema.icon}',
  color: '${schema.color}',
  fields: ${JSON.stringify(schema.fields, null, 2)}
}`;

    setGeneratedCode(`// TypeScript Interface
${interfaceCode}

// Default Configuration
${defaultConfig}

// Node Definition
${nodeDefinition}`);
  };

  const toPascalCase = (str: string) => {
    return str.split('-').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join('');
  };

  const getTypeScriptType = (fieldType: string): string => {
    const typeMap: Record<string, string> = {
      'text': 'string',
      'textarea': 'string',
      'number': 'number',
      'select': 'string',
      'checkbox': 'boolean',
      'array': 'any[]',
      'object': 'Record<string, any>'
    };
    return typeMap[fieldType] || 'string';
  };

  const getDefaultValue = (field: FieldSchema): string => {
    const defaults: Record<string, string> = {
      'text': "''",
      'textarea': "''",
      'number': '0',
      'select': "''",
      'checkbox': 'false',
      'array': '[]',
      'object': '{}'
    };
    return defaults[field.type] || "''";
  };

  const saveNodeVersion = async (versionType: 'major' | 'minor' | 'patch' = 'minor') => {
    if (!nodeSchema().type) {
      console.error('Node type is required');
      return;
    }

    try {
      const newVersion = await versioningService.saveNodeVersion(
        nodeSchema().type,
        nodeSchema(),
        'demo-user', // TODO: Get from auth context
        changelog() || 'Updated node configuration',
        versionType
      );

      console.log('Saved new version:', newVersion.version);
      await loadVersionHistory();
      setChangelog('');
    } catch (error) {
      console.error('Failed to save version:', error);
    }
  };

  const rollbackToVersion = async (targetVersion: string) => {
    try {
      const rolledBackVersion = await versioningService.rollbackToVersion(
        nodeSchema().type,
        targetVersion,
        'demo-user'
      );

      setNodeSchema(rolledBackVersion.schema);
      await loadVersionHistory();
      setShowVersionHistory(false);
      console.log('Rolled back to version:', targetVersion);
    } catch (error) {
      console.error('Failed to rollback:', error);
    }
  };

  // Load a registry node into the editor for customization
  const loadRegistryNode = (nodeType: string) => {
    const definition = getNodeDefinition(nodeType);
    if (!definition) return;

    setMode('edit-registry');
    setSelectedRegistryNode(definition);

    // Convert NodeDefinition to NodeSchema format
    setNodeSchema({
      type: definition.type,
      name: definition.name,
      description: definition.description,
      category: definition.category as any,
      subcategory: definition.subcategory,
      icon: definition.icon || '🔧',
      color: definition.color || 'bg-blue-500',
      shape: null,
      fields: definition.fields?.map((field, index) => ({
        id: `field-${index}`,
        name: field.key,
        label: field.label,
        type: field.type as any,
        required: field.required || false,
        placeholder: field.placeholder,
        options: field.options?.map(opt => opt.label),
        help: field.help
      })) || []
    });

    setShowRegistryPicker(false);
  };

  // Save tenant-specific overrides for a registry node
  const saveTenantOverride = async () => {
    const schema = nodeSchema();
    const registryNode = selectedRegistryNode();

    if (!registryNode || mode() !== 'edit-registry') {
      console.error('Not in registry edit mode');
      return;
    }

    try {
      // Build field overrides by comparing with original
      const fieldOverrides: Record<string, any> = {};
      schema.fields.forEach((field, index) => {
        const originalField = registryNode.fields?.[index];
        if (!originalField) return;

        const overrides: any = {};

        // Check for changes
        if (field.required !== originalField.required) {
          overrides.required = field.required;
        }
        if (field.help !== originalField.help) {
          overrides.help = field.help;
        }
        if (field.placeholder !== originalField.placeholder) {
          overrides.defaultValue = field.placeholder;
        }

        if (Object.keys(overrides).length > 0) {
          fieldOverrides[field.name] = overrides;
        }
      });

      // Save tenant override
      await tenantConfigService.saveTenantNodeConfig({
        tenantId: currentTenantId,
        nodeType: schema.type,
        updatedAt: new Date().toISOString(),
        updatedBy: 'demo-user', // TODO: Get from auth
        enabled: true,
        fieldOverrides: Object.keys(fieldOverrides).length > 0 ? fieldOverrides : undefined
      });

      console.log('Saved tenant override for', schema.type);
    } catch (error) {
      console.error('Failed to save tenant override:', error);
    }
  };

  // Create new custom node
  const createCustomNode = () => {
    setMode('create');
    setSelectedRegistryNode(null);
    setNodeSchema({
      type: '',
      name: '',
      description: '',
      category: 'custom',
      subcategory: '',
      icon: '🔧',
      color: 'bg-blue-500',
      shape: null,
      fields: []
    });
  };

  return (
    <div class="h-full flex flex-col bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <div class="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-4 flex-shrink-0">
        <div class="flex items-center justify-between mb-3">
          <div>
            <p class="text-sm text-slate-600 dark:text-slate-400">
              {mode() === 'create' ? 'Build custom workflow nodes with AI assistance' :
               mode() === 'edit-registry' ? 'Customize registry node for your organization' :
               'Edit custom node configuration'}
            </p>
          </div>
          <div class="flex items-center gap-3">
            <Show when={nodeSchema().type && versionHistory().length > 0}>
              <button
                class="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-900 dark:text-white rounded-md text-sm flex items-center gap-2"
                onClick={() => setShowVersionHistory(!showVersionHistory())}
              >
                <History class="w-4 h-4" />
                Version History ({versionHistory().length})
              </button>
            </Show>
          </div>
        </div>

        {/* Mode Selection */}
        <div class="flex gap-2">
          <button
            class={`px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 ${
              mode() === 'create'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
            }`}
            onClick={createCustomNode}
          >
            <Plus class="w-4 h-4" />
            Create New Node
          </button>
          <button
            class={`px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 ${
              mode() === 'edit-registry'
                ? 'bg-purple-600 text-white'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
            }`}
            onClick={() => setShowRegistryPicker(true)}
          >
            <Edit2 class="w-4 h-4" />
            Customize Registry Node
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div class="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <div class="flex gap-2 px-4">
          <button
            class={`px-4 py-2 text-sm font-medium border-b-2 ${
              activeTab() === 'visual'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
            onClick={() => setActiveTab('visual')}
          >
            Visual Editor
          </button>
          <button
            class={`px-4 py-2 text-sm font-medium border-b-2 flex items-center gap-2 ${
              activeTab() === 'ai'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
            onClick={() => setActiveTab('ai')}
          >
            <Wand2 class="w-4 h-4" />
            AI Assistant
          </button>
          <button
            class={`px-4 py-2 text-sm font-medium border-b-2 flex items-center gap-2 ${
              activeTab() === 'preview'
                ? 'border-green-600 text-green-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
            onClick={() => setActiveTab('preview')}
          >
            <Eye class="w-4 h-4" />
            Preview
          </button>
          <button
            class={`px-4 py-2 text-sm font-medium border-b-2 flex items-center gap-2 ${
              activeTab() === 'code'
                ? 'border-orange-600 text-orange-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
            onClick={() => {
              setActiveTab('code');
              generateCode();
            }}
          >
            <Code class="w-4 h-4" />
            Generated Code
          </button>
        </div>
      </div>

      {/* Content */}
      <div class="flex-1 overflow-hidden">
        {/* Visual Editor Tab */}
        <Show when={activeTab() === 'visual'}>
          <div class="h-full overflow-y-auto p-6">
            <div class="max-w-4xl mx-auto space-y-6">
              {/* Basic Info */}
              <div class="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
                <h2 class="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                  Node Information
                </h2>
                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Type ID
                    </label>
                    <input
                      type="text"
                      class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                      placeholder="my-custom-node"
                      value={nodeSchema().type}
                      onInput={(e) => setNodeSchema({ ...nodeSchema(), type: e.currentTarget.value })}
                    />
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Display Name
                    </label>
                    <input
                      type="text"
                      class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                      placeholder="My Custom Node"
                      value={nodeSchema().name}
                      onInput={(e) => setNodeSchema({ ...nodeSchema(), name: e.currentTarget.value })}
                    />
                  </div>
                  <div class="col-span-2">
                    <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Description
                    </label>
                    <textarea
                      class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                      rows="2"
                      placeholder="What does this node do?"
                      value={nodeSchema().description}
                      onInput={(e) => setNodeSchema({ ...nodeSchema(), description: e.currentTarget.value })}
                    />
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Category
                    </label>
                    <select
                      class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                      value={nodeSchema().category}
                      onChange={(e) => {
                        setNodeSchema({ ...nodeSchema(), category: e.currentTarget.value, subcategory: '' });
                      }}
                    >
                      <For each={NODE_CATEGORIES}>
                        {(category) => (
                          <option value={category.id}>{category.name}</option>
                        )}
                      </For>
                    </select>
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Subcategory
                    </label>
                    <select
                      class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                      value={nodeSchema().subcategory || ''}
                      onChange={(e) => setNodeSchema({ ...nodeSchema(), subcategory: e.currentTarget.value })}
                      disabled={availableSubcategories().length === 0}
                    >
                      <option value="">Select subcategory...</option>
                      <For each={availableSubcategories()}>
                        {(subcategory) => (
                          <option value={subcategory.id}>{subcategory.name}</option>
                        )}
                      </For>
                    </select>
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Icon (emoji)
                    </label>
                    <input
                      type="text"
                      class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                      placeholder="🔧"
                      value={nodeSchema().icon}
                      onInput={(e) => setNodeSchema({ ...nodeSchema(), icon: e.currentTarget.value })}
                    />
                  </div>
                  <div class="col-span-2">
                    <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Node Shape
                    </label>
                    <ShapePicker
                      value={nodeSchema().shape}
                      onChange={(shape) => setNodeSchema({ ...nodeSchema(), shape })}
                      color={nodeSchema().color}
                    />
                  </div>
                </div>
              </div>

              {/* Fields */}
              <div class="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
                <div class="flex items-center justify-between mb-4">
                  <h2 class="text-lg font-semibold text-slate-900 dark:text-white">
                    Configuration Fields
                  </h2>
                  <button
                    class="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm flex items-center gap-2"
                    onClick={addField}
                  >
                    <Plus class="w-4 h-4" />
                    Add Field
                  </button>
                </div>

                <div class="space-y-4">
                  <For each={nodeSchema().fields}>
                    {(field) => (
                      <div class="border border-slate-200 dark:border-slate-600 rounded-lg p-4">
                        <div class="flex items-center justify-between mb-3">
                          <span class="text-sm font-medium text-slate-700 dark:text-slate-300">
                            Field Configuration
                          </span>
                          <button
                            class="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                            onClick={() => removeField(field.id)}
                          >
                            <Trash2 class="w-4 h-4" />
                          </button>
                        </div>
                        <div class="grid grid-cols-3 gap-3">
                          <div>
                            <label class="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                              Field Name
                            </label>
                            <input
                              type="text"
                              class="w-full px-2 py-1.5 border border-slate-300 dark:border-slate-600 rounded text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                              placeholder="fieldName"
                              value={field.name}
                              onInput={(e) => updateField(field.id, { name: e.currentTarget.value })}
                            />
                          </div>
                          <div>
                            <label class="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                              Label
                            </label>
                            <input
                              type="text"
                              class="w-full px-2 py-1.5 border border-slate-300 dark:border-slate-600 rounded text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                              placeholder="Field Label"
                              value={field.label}
                              onInput={(e) => updateField(field.id, { label: e.currentTarget.value })}
                            />
                          </div>
                          <div>
                            <label class="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                              Type
                            </label>
                            <select
                              class="w-full px-2 py-1.5 border border-slate-300 dark:border-slate-600 rounded text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                              value={field.type}
                              onChange={(e) => updateField(field.id, { type: e.currentTarget.value as any })}
                            >
                              <option value="text">Text</option>
                              <option value="textarea">Textarea</option>
                              <option value="number">Number</option>
                              <option value="select">Select</option>
                              <option value="checkbox">Checkbox</option>
                              <option value="array">Array</option>
                              <option value="object">Object</option>
                            </select>
                          </div>
                          <div class="col-span-3">
                            <label class="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={field.required}
                                onChange={(e) => updateField(field.id, { required: e.currentTarget.checked })}
                                class="rounded border-slate-300"
                              />
                              <span class="text-xs text-slate-600 dark:text-slate-400">Required field</span>
                            </label>
                          </div>
                        </div>
                      </div>
                    )}
                  </For>

                  <Show when={nodeSchema().fields.length === 0}>
                    <div class="text-center py-8 text-slate-500 dark:text-slate-400">
                      No fields yet. Click "Add Field" to get started.
                    </div>
                  </Show>
                </div>
              </div>

              {/* Version Control & Save */}
              <div class="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
                <h2 class="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <GitBranch class="w-5 h-5" />
                  Version Control
                </h2>
                <div class="space-y-3">
                  <Show when={mode() === 'edit-registry'}>
                    <div class="mb-4 p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                      <h3 class="text-sm font-medium text-purple-900 dark:text-purple-300 mb-2">
                        Tenant Override Mode
                      </h3>
                      <p class="text-xs text-purple-700 dark:text-purple-400">
                        Changes will be saved as organization-level overrides. Original registry node remains unchanged.
                      </p>
                    </div>
                    <button
                      class="w-full px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-md font-medium"
                      onClick={saveTenantOverride}
                      disabled={!nodeSchema().type}
                    >
                      Save Tenant Override
                    </button>
                  </Show>

                  <Show when={mode() === 'create' || mode() === 'edit-custom'}>
                    <div>
                      <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Changelog (what changed?)
                      </label>
                      <textarea
                        class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                        rows="2"
                        placeholder="Added new field for API key configuration..."
                        value={changelog()}
                        onInput={(e) => setChangelog(e.currentTarget.value)}
                      />
                    </div>
                    <div class="flex items-center gap-3">
                      <button
                        class="flex-1 px-4 py-2 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-md text-sm border border-blue-200 dark:border-blue-800"
                        onClick={() => saveNodeVersion('patch')}
                        disabled={!nodeSchema().type}
                      >
                        Save Patch (Bug fix)
                      </button>
                      <button
                        class="flex-1 px-4 py-2 bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:hover:bg-green-900/30 text-green-700 dark:text-green-300 rounded-md text-sm border border-green-200 dark:border-green-800"
                        onClick={() => saveNodeVersion('minor')}
                        disabled={!nodeSchema().type}
                      >
                        Save Minor (New feature)
                      </button>
                      <button
                        class="flex-1 px-4 py-2 bg-orange-50 hover:bg-orange-100 dark:bg-orange-900/20 dark:hover:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded-md text-sm border border-orange-200 dark:border-orange-800"
                        onClick={() => saveNodeVersion('major')}
                        disabled={!nodeSchema().type}
                      >
                        Save Major (Breaking change)
                      </button>
                    </div>
                  </Show>
                </div>
              </div>
            </div>
          </div>
        </Show>

        {/* AI Assistant Tab */}
        <Show when={activeTab() === 'ai'}>
          <div class="h-full p-6 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20">
            <div class="max-w-3xl mx-auto">
              <div class="bg-white dark:bg-slate-800 rounded-lg border border-purple-200 dark:border-purple-800 p-6">
                <div class="flex items-center gap-3 mb-4">
                  <Wand2 class="w-6 h-6 text-purple-600" />
                  <h2 class="text-lg font-semibold text-slate-900 dark:text-white">
                    AI Node Generator
                  </h2>
                </div>
                <p class="text-sm text-slate-600 dark:text-slate-400 mb-6">
                  Describe your node and I'll generate the schema for you!
                </p>

                <textarea
                  class="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white mb-4"
                  rows="6"
                  placeholder="Example: Create a Slack notification node that sends messages to channels with optional attachments and thread support..."
                  value={aiPrompt()}
                  onInput={(e) => setAiPrompt(e.currentTarget.value)}
                />

                <button
                  class="w-full px-4 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white rounded-lg font-medium flex items-center justify-center gap-2"
                  onClick={generateFromAI}
                  disabled={isGenerating() || !aiPrompt()}
                >
                  <Wand2 class="w-5 h-5" />
                  {isGenerating() ? 'Generating...' : 'Generate Node Schema'}
                </button>

                <div class="mt-6 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                  <h3 class="text-sm font-medium text-purple-900 dark:text-purple-200 mb-2">
                    💡 Tips for better results:
                  </h3>
                  <ul class="text-xs text-purple-700 dark:text-purple-300 space-y-1">
                    <li>• Be specific about what the node should do</li>
                    <li>• Mention required configuration fields</li>
                    <li>• Describe any integrations or APIs it connects to</li>
                    <li>• Include validation requirements if any</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </Show>

        {/* Preview Tab */}
        <Show when={activeTab() === 'preview'}>
          <div class="h-full overflow-y-auto p-6">
            <div class="max-w-2xl mx-auto">
              <div class="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
                <h2 class="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                  Node Preview
                </h2>
                <div class="space-y-4">
                  {/* Preview node appearance */}
                  <div class="p-4 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg">
                    <div class="flex items-center gap-3 mb-2">
                      <span class="text-2xl">{nodeSchema().icon}</span>
                      <div>
                        <div class="font-medium text-slate-900 dark:text-white">
                          {nodeSchema().name || 'Node Name'}
                        </div>
                        <div class="text-xs text-slate-500">
                          {nodeSchema().type || 'node-type'}
                        </div>
                      </div>
                    </div>
                    <p class="text-sm text-slate-600 dark:text-slate-400">
                      {nodeSchema().description || 'Node description'}
                    </p>
                  </div>

                  {/* Preview configuration form */}
                  <div>
                    <h3 class="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                      Configuration Form Preview
                    </h3>
                    <div class="space-y-3">
                      <For each={nodeSchema().fields}>
                        {(field) => (
                          <div>
                            <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                              {field.label || field.name}
                              {field.required && <span class="text-red-500 ml-1">*</span>}
                            </label>
                            <Show when={field.type === 'text'}>
                              <input
                                type="text"
                                class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700"
                                placeholder={field.placeholder}
                                disabled
                              />
                            </Show>
                            <Show when={field.type === 'textarea'}>
                              <textarea
                                class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700"
                                rows="3"
                                placeholder={field.placeholder}
                                disabled
                              />
                            </Show>
                            <Show when={field.type === 'number'}>
                              <input
                                type="number"
                                class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700"
                                disabled
                              />
                            </Show>
                            <Show when={field.type === 'checkbox'}>
                              <label class="flex items-center gap-2">
                                <input type="checkbox" class="rounded" disabled />
                                <span class="text-sm text-slate-600 dark:text-slate-400">
                                  {field.help || 'Enable this option'}
                                </span>
                              </label>
                            </Show>
                            <Show when={field.help}>
                              <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                {field.help}
                              </p>
                            </Show>
                          </div>
                        )}
                      </For>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Show>

        {/* Generated Code Tab */}
        <Show when={activeTab() === 'code'}>
          <div class="h-full overflow-y-auto p-6 bg-slate-900">
            <div class="max-w-4xl mx-auto">
              <div class="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
                <div class="px-4 py-2 bg-slate-700 border-b border-slate-600 flex items-center justify-between">
                  <span class="text-sm font-medium text-slate-300">Generated Code</span>
                  <button
                    class="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded"
                    onClick={() => navigator.clipboard.writeText(generatedCode())}
                  >
                    Copy
                  </button>
                </div>
                <pre class="p-4 text-sm text-slate-300 font-mono overflow-x-auto">
                  <code>{generatedCode() || '// Click "Generated Code" tab to see the output'}</code>
                </pre>
              </div>
            </div>
          </div>
        </Show>
      </div>

      {/* Version History Modal */}
      <Show when={showVersionHistory()}>
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div class="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
            <div class="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <h2 class="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <History class="w-5 h-5" />
                Version History - {nodeSchema().name}
              </h2>
              <button
                class="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
                onClick={() => setShowVersionHistory(false)}
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div class="flex-1 overflow-y-auto p-6">
              <div class="space-y-4">
                <For each={versionHistory()}>
                  {(version, index) => (
                    <div class="border border-slate-200 dark:border-slate-700 rounded-lg p-4 hover:border-blue-500 dark:hover:border-blue-400 transition-colors">
                      <div class="flex items-start justify-between mb-2">
                        <div class="flex items-center gap-3">
                          <div class={`px-2 py-1 rounded text-xs font-medium ${
                            version.version.startsWith('1.') ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-300' :
                            version.version.includes('.0.') ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300' :
                            'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300'
                          }`}>
                            v{version.version}
                          </div>
                          <Show when={index() === 0}>
                            <div class="px-2 py-1 bg-blue-600 text-white rounded text-xs font-medium">
                              Current
                            </div>
                          </Show>
                        </div>
                        <div class="flex items-center gap-2">
                          <span class="text-xs text-slate-500 dark:text-slate-400">
                            {new Date(version.createdAt).toLocaleDateString()}
                          </span>
                          <Show when={index() !== 0}>
                            <button
                              class="px-3 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-900 dark:text-white rounded text-xs"
                              onClick={() => rollbackToVersion(version.version)}
                            >
                              Rollback
                            </button>
                          </Show>
                        </div>
                      </div>
                      <p class="text-sm text-slate-700 dark:text-slate-300 mb-2">
                        {version.changelog}
                      </p>
                      <div class="text-xs text-slate-500 dark:text-slate-400">
                        Created by {version.createdBy}
                      </div>
                    </div>
                  )}
                </For>
                <Show when={versionHistory().length === 0}>
                  <div class="text-center py-8 text-slate-500 dark:text-slate-400">
                    No version history yet. Save your first version to get started.
                  </div>
                </Show>
              </div>
            </div>
          </div>
        </div>
      </Show>

      {/* Registry Node Picker Modal */}
      <Show when={showRegistryPicker()}>
        <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div class="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh] overflow-hidden">
            <div class="p-6 border-b border-slate-200 dark:border-slate-700">
              <div class="flex items-center justify-between">
                <div>
                  <h2 class="text-xl font-semibold text-slate-900 dark:text-white">
                    Select Node to Customize
                  </h2>
                  <p class="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    Choose a registry node to customize for your organization
                  </p>
                </div>
                <button
                  class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  onClick={() => setShowRegistryPicker(false)}
                >
                  ✕
                </button>
              </div>
            </div>

            <div class="overflow-y-auto max-h-[calc(80vh-140px)] p-6">
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                <For each={registryNodes()}>
                  {(node) => (
                    <button
                      class="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-600 text-left transition-colors"
                      onClick={() => loadRegistryNode(node.type)}
                    >
                      <div class="flex items-start gap-3">
                        <div class={`w-10 h-10 ${node.color || 'bg-blue-500'} rounded-lg flex items-center justify-center text-xl flex-shrink-0`}>
                          {node.icon || '🔧'}
                        </div>
                        <div class="flex-1 min-w-0">
                          <h3 class="font-medium text-slate-900 dark:text-white truncate">
                            {node.name}
                          </h3>
                          <p class="text-xs text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">
                            {node.description}
                          </p>
                          <div class="flex items-center gap-2 mt-2">
                            <span class="text-xs px-2 py-1 bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-300 rounded">
                              {node.category}
                            </span>
                            <Show when={node.subcategory}>
                              <span class="text-xs px-2 py-1 bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-300 rounded">
                                {node.subcategory}
                              </span>
                            </Show>
                          </div>
                        </div>
                      </div>
                    </button>
                  )}
                </For>
              </div>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}
