import { createSignal, For, Show, onMount } from 'solid-js';
import { useDashboardServer } from '../../../contexts/DashboardServerContext';
import { useOrganization } from '../../../contexts/OrganizationContext';
import { useNotifications } from '../../../contexts/NotificationContext';
import {
  getAllNodes,
  getNodeDefinition,
  TenantNodeConfigService,
  type NodeDefinition,
  type TenantNodeConfig
} from '@ai-agent-bus/workflow-nodes';
import { Box, Settings, ChevronDown, ChevronRight, Edit2, Power, PowerOff, Save, X } from 'lucide-solid';

export default function NodeManagementSettings() {
  const { kvStore } = useDashboardServer();
  const { currentOrganization } = useOrganization();
  const { addNotification } = useNotifications();
  const tenantConfigService = new TenantNodeConfigService(kvStore);

  const [registryNodes, setRegistryNodes] = createSignal<NodeDefinition[]>([]);
  const [tenantConfigs, setTenantConfigs] = createSignal<Map<string, TenantNodeConfig>>(new Map());
  const [selectedCategory, setSelectedCategory] = createSignal<string>('all');
  const [expandedNode, setExpandedNode] = createSignal<string | null>(null);
  const [editingNode, setEditingNode] = createSignal<string | null>(null);
  const [editForm, setEditForm] = createSignal<Partial<TenantNodeConfig>>({});

  // Load all nodes and tenant configs
  onMount(async () => {
    const allNodes = getAllNodes();
    setRegistryNodes(allNodes);

    // Load existing tenant configs
    const tenantId = currentOrganization()?.id || 'demo-tenant';
    const configs = new Map<string, TenantNodeConfig>();

    for (const node of allNodes) {
      const config = await tenantConfigService.getTenantNodeConfig(tenantId, node.type);
      if (config) {
        configs.set(node.type, config);
      }
    }

    setTenantConfigs(configs);
  });

  // Get unique categories
  const categories = () => {
    const cats = new Set(registryNodes().map(n => n.category));
    return ['all', ...Array.from(cats)];
  };

  // Filter nodes by category
  const filteredNodes = () => {
    const cat = selectedCategory();
    if (cat === 'all') return registryNodes();
    return registryNodes().filter(n => n.category === cat);
  };

  // Toggle node enabled/disabled
  const toggleNodeEnabled = async (nodeType: string, currentlyEnabled: boolean) => {
    const tenantId = currentOrganization()?.id || 'demo-tenant';

    try {
      const existingConfig = tenantConfigs().get(nodeType);

      await tenantConfigService.saveTenantNodeConfig({
        tenantId,
        nodeType,
        updatedAt: new Date().toISOString(),
        updatedBy: 'admin', // TODO: Get from auth
        enabled: !currentlyEnabled,
        fieldOverrides: existingConfig?.fieldOverrides,
        policies: existingConfig?.policies
      });

      // Update local state
      const newConfigs = new Map(tenantConfigs());
      const config = await tenantConfigService.getTenantNodeConfig(tenantId, nodeType);
      if (config) {
        newConfigs.set(nodeType, config);
      }
      setTenantConfigs(newConfigs);

      addNotification({
        type: 'success',
        message: `Node ${!currentlyEnabled ? 'enabled' : 'disabled'} successfully`
      });
    } catch (error) {
      console.error('Failed to toggle node:', error);
      addNotification({
        type: 'error',
        message: 'Failed to update node status'
      });
    }
  };

  // Start editing node config
  const startEditing = (nodeType: string) => {
    const config = tenantConfigs().get(nodeType);
    setEditingNode(nodeType);
    setEditForm(config || {
      tenantId: currentOrganization()?.id || 'demo-tenant',
      nodeType,
      enabled: true
    });
  };

  // Save node config
  const saveNodeConfig = async () => {
    const nodeType = editingNode();
    if (!nodeType) return;

    try {
      await tenantConfigService.saveTenantNodeConfig({
        ...editForm() as TenantNodeConfig,
        updatedAt: new Date().toISOString(),
        updatedBy: 'admin' // TODO: Get from auth
      });

      // Reload config
      const tenantId = currentOrganization()?.id || 'demo-tenant';
      const config = await tenantConfigService.getTenantNodeConfig(tenantId, nodeType);
      if (config) {
        const newConfigs = new Map(tenantConfigs());
        newConfigs.set(nodeType, config);
        setTenantConfigs(newConfigs);
      }

      setEditingNode(null);
      setEditForm({});

      addNotification({
        type: 'success',
        message: 'Node configuration saved successfully'
      });
    } catch (error) {
      console.error('Failed to save node config:', error);
      addNotification({
        type: 'error',
        message: 'Failed to save node configuration'
      });
    }
  };

  // Get node status (enabled/disabled)
  const isNodeEnabled = (nodeType: string) => {
    const config = tenantConfigs().get(nodeType);
    return config?.enabled !== false; // Default to enabled if no config
  };

  // Format category name
  const formatCategory = (cat: string) => {
    if (cat === 'all') return 'All Nodes';
    return cat.charAt(0).toUpperCase() + cat.slice(1);
  };

  return (
    <div class="space-y-4">
      {/* Compact Header with Category Filter and Stats */}
      <div class="flex items-center justify-between gap-4 flex-wrap">
        {/* Category Filter */}
        <div class="flex items-center gap-2 flex-wrap">
          <For each={categories()}>
            {(cat) => (
              <button
                class={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  selectedCategory() === cat
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}
                onClick={() => setSelectedCategory(cat)}
              >
                {formatCategory(cat)}
              </button>
            )}
          </For>
        </div>

        {/* Compact Stats */}
        <div class="flex items-center gap-3 text-sm">
          <div class="flex items-center gap-1.5">
            <span class="text-slate-600 dark:text-slate-400">Total:</span>
            <span class="font-semibold text-slate-900 dark:text-white">{registryNodes().length}</span>
          </div>
          <div class="w-px h-4 bg-slate-300 dark:bg-slate-600" />
          <div class="flex items-center gap-1.5">
            <span class="text-slate-600 dark:text-slate-400">Enabled:</span>
            <span class="font-semibold text-green-600 dark:text-green-400">
              {registryNodes().filter(n => isNodeEnabled(n.type)).length}
            </span>
          </div>
          <div class="w-px h-4 bg-slate-300 dark:bg-slate-600" />
          <div class="flex items-center gap-1.5">
            <span class="text-slate-600 dark:text-slate-400">Customized:</span>
            <span class="font-semibold text-slate-900 dark:text-white">{tenantConfigs().size}</span>
          </div>
        </div>
      </div>

      {/* Node List */}
      <div class="space-y-2">
        <For each={filteredNodes()}>
          {(node) => {
            const config = () => tenantConfigs().get(node.type);
            const enabled = () => isNodeEnabled(node.type);
            const expanded = () => expandedNode() === node.type;
            const editing = () => editingNode() === node.type;

            return (
              <div class="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                {/* Node Header */}
                <div class="p-4 flex items-center gap-4">
                  {/* Icon */}
                  <div class={`w-10 h-10 ${node.color || 'bg-blue-500'} rounded-lg flex items-center justify-center text-xl flex-shrink-0`}>
                    {node.icon || '🔧'}
                  </div>

                  {/* Info */}
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-1">
                      <h3 class="font-medium text-slate-900 dark:text-white">
                        {node.name}
                      </h3>
                      <span class="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded">
                        {node.category}
                      </span>
                      <Show when={node.subcategory}>
                        <span class="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded">
                          {node.subcategory}
                        </span>
                      </Show>
                    </div>
                    <p class="text-sm text-slate-600 dark:text-slate-400">
                      {node.description}
                    </p>
                  </div>

                  {/* Actions */}
                  <div class="flex items-center gap-2 flex-shrink-0">
                    {/* Enable/Disable Toggle */}
                    <button
                      class={`p-2 rounded-md transition-colors ${
                        enabled()
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-600'
                      }`}
                      onClick={() => toggleNodeEnabled(node.type, enabled())}
                      title={enabled() ? 'Disable node' : 'Enable node'}
                    >
                      {enabled() ? <Power class="w-4 h-4" /> : <PowerOff class="w-4 h-4" />}
                    </button>

                    {/* Edit Config */}
                    <button
                      class="p-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-md hover:bg-slate-200 dark:hover:bg-slate-600"
                      onClick={() => startEditing(node.type)}
                      title="Edit configuration"
                    >
                      <Edit2 class="w-4 h-4" />
                    </button>

                    {/* Expand/Collapse */}
                    <button
                      class="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                      onClick={() => setExpandedNode(expanded() ? null : node.type)}
                    >
                      {expanded() ? <ChevronDown class="w-5 h-5" /> : <ChevronRight class="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* Expanded Details */}
                <Show when={expanded()}>
                  <div class="border-t border-slate-200 dark:border-slate-700 p-4 bg-slate-50 dark:bg-slate-900/50">
                    <div class="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span class="font-medium text-slate-700 dark:text-slate-300">Fields:</span>
                        <span class="ml-2 text-slate-600 dark:text-slate-400">
                          {node.fields?.length || 0} configuration fields
                        </span>
                      </div>
                      <div>
                        <span class="font-medium text-slate-700 dark:text-slate-300">Status:</span>
                        <span class={`ml-2 ${enabled() ? 'text-green-600' : 'text-slate-400'}`}>
                          {enabled() ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                      <Show when={config()}>
                        <div class="col-span-2">
                          <span class="font-medium text-slate-700 dark:text-slate-300">Last Updated:</span>
                          <span class="ml-2 text-slate-600 dark:text-slate-400">
                            {new Date(config()!.updatedAt).toLocaleDateString()} by {config()!.updatedBy}
                          </span>
                        </div>
                      </Show>
                    </div>
                  </div>
                </Show>

                {/* Edit Form */}
                <Show when={editing()}>
                  <div class="border-t border-slate-200 dark:border-slate-700 p-4 bg-blue-50 dark:bg-blue-900/20">
                    <h4 class="font-medium text-slate-900 dark:text-white mb-4">
                      Configure Node Policies
                    </h4>

                    <div class="space-y-4">
                      {/* Require Approval */}
                      <label class="flex items-center gap-3">
                        <input
                          type="checkbox"
                          class="w-4 h-4 rounded border-slate-300 dark:border-slate-600"
                          checked={editForm().policies?.requireApproval || false}
                          onChange={(e) => setEditForm({
                            ...editForm(),
                            policies: {
                              ...editForm().policies,
                              requireApproval: e.currentTarget.checked
                            }
                          })}
                        />
                        <span class="text-sm text-slate-700 dark:text-slate-300">
                          Require approval before execution
                        </span>
                      </label>

                      {/* Max Executions Per Day */}
                      <div>
                        <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                          Max Executions Per Day (0 = unlimited)
                        </label>
                        <input
                          type="number"
                          class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                          value={editForm().policies?.maxExecutionsPerDay || 0}
                          onInput={(e) => setEditForm({
                            ...editForm(),
                            policies: {
                              ...editForm().policies,
                              maxExecutionsPerDay: parseInt(e.currentTarget.value) || 0
                            }
                          })}
                        />
                      </div>

                      {/* Actions */}
                      <div class="flex items-center gap-2 pt-2">
                        <button
                          class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium flex items-center gap-2"
                          onClick={saveNodeConfig}
                        >
                          <Save class="w-4 h-4" />
                          Save Configuration
                        </button>
                        <button
                          class="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-md text-sm font-medium flex items-center gap-2"
                          onClick={() => {
                            setEditingNode(null);
                            setEditForm({});
                          }}
                        >
                          <X class="w-4 h-4" />
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                </Show>
              </div>
            );
          }}
        </For>

        <Show when={filteredNodes().length === 0}>
          <div class="text-center py-12 text-slate-500 dark:text-slate-400">
            No nodes found in this category.
          </div>
        </Show>
      </div>
    </div>
  );
}
