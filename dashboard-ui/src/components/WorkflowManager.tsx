import { createSignal, createEffect, For, Show, onMount } from 'solid-js';
import { useMCP } from '../contexts/MCPContext';
import { useKVStore } from '../contexts/KVStoreContext';
import { useNotifications } from '../contexts/NotificationContext';
import { useOrganization } from '../contexts/OrganizationContext';
import {
  FolderOpen, Plus, Search, Clock, Users, Eye, Edit3, Trash2,
  Copy, Download, Upload, Star, Archive, Filter, SortAsc,
  FileText, Play, Settings, ChevronRight, Calendar, Tag
} from 'lucide-solid';

export interface WorkflowVersion {
  id: string;
  version: number;
  name: string;
  description?: string;
  nodes: any[];
  connections: any[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  tags: string[];
  isPublished: boolean;
  executionCount: number;
  lastExecuted?: string;
}

export interface WorkflowMetadata {
  id: string;
  name: string;
  description?: string;
  currentVersion: number;
  versions: WorkflowVersion[];
  totalVersions: number;
  isStarred: boolean;
  isTemplate: boolean;
  collaborators: string[];
  organizationId: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  tags: string[];
  category: string;
  executionStats: {
    totalExecutions: number;
    successRate: number;
    avgDuration: number;
    lastExecuted?: string;
  };
}

function WorkflowManager({ onSelectWorkflow, onNewWorkflow }) {
  const [workflows, setWorkflows] = createSignal<WorkflowMetadata[]>([]);
  const [filteredWorkflows, setFilteredWorkflows] = createSignal<WorkflowMetadata[]>([]);
  const [searchQuery, setSearchQuery] = createSignal('');
  const [selectedCategory, setSelectedCategory] = createSignal('all');
  const [sortBy, setSortBy] = createSignal('updatedAt');
  const [sortOrder, setSortOrder] = createSignal('desc');
  const [isLoading, setIsLoading] = createSignal(true);
  const [showVersions, setShowVersions] = createSignal<string | null>(null);

  const kvStore = useKVStore();
  const { success, error } = useNotifications();
  const { currentOrganization } = useOrganization();

  // Load workflows for current organization
  const loadWorkflows = async () => {
    setIsLoading(true);
    try {
      const orgId = currentOrganization()?.id;
      if (!orgId) return;

      // Load workflow list from KV store
      const workflowList = await kvStore.get(`org-${orgId}-workflows-index`);

      if (workflowList) {
        const workflowIds = JSON.parse(workflowList);
        const workflowPromises = workflowIds.map(id =>
          kvStore.get(`workflow-${id}-metadata`)
        );

        const workflowData = await Promise.all(workflowPromises);
        const parsedWorkflows = workflowData
          .filter(Boolean)
          .map(data => JSON.parse(data) as WorkflowMetadata);

        setWorkflows(parsedWorkflows);
        setFilteredWorkflows(parsedWorkflows);
      } else {
        setWorkflows([]);
        setFilteredWorkflows([]);
      }
    } catch (err) {
      console.error('Failed to load workflows:', err);
      error('Failed to load workflows');
    } finally {
      setIsLoading(false);
    }
  };

  // Filter and sort workflows
  const filterWorkflows = () => {
    let filtered = workflows();

    // Search filter
    const query = searchQuery().toLowerCase();
    if (query) {
      filtered = filtered.filter(workflow =>
        workflow.name.toLowerCase().includes(query) ||
        workflow.description?.toLowerCase().includes(query) ||
        workflow.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Category filter
    if (selectedCategory() !== 'all') {
      filtered = filtered.filter(workflow => workflow.category === selectedCategory());
    }

    // Sort
    const sortField = sortBy();
    const order = sortOrder();
    filtered.sort((a, b) => {
      let aVal, bVal;

      switch (sortField) {
        case 'name':
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case 'updatedAt':
          aVal = new Date(a.updatedAt).getTime();
          bVal = new Date(b.updatedAt).getTime();
          break;
        case 'executionCount':
          aVal = a.executionStats.totalExecutions;
          bVal = b.executionStats.totalExecutions;
          break;
        case 'successRate':
          aVal = a.executionStats.successRate;
          bVal = b.executionStats.successRate;
          break;
        default:
          return 0;
      }

      if (order === 'desc') {
        return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
      } else {
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      }
    });

    setFilteredWorkflows(filtered);
  };

  // Create new workflow
  const createWorkflow = async () => {
    const orgId = currentOrganization()?.id;
    if (!orgId) return;

    const newWorkflow: WorkflowMetadata = {
      id: `wf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: `Untitled Workflow ${workflows().length + 1}`,
      description: '',
      currentVersion: 1,
      versions: [],
      totalVersions: 1,
      isStarred: false,
      isTemplate: false,
      collaborators: [],
      organizationId: orgId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'current-user', // TODO: Get from auth context
      tags: [],
      category: 'automation',
      executionStats: {
        totalExecutions: 0,
        successRate: 0,
        avgDuration: 0
      }
    };

    // Create initial version
    const initialVersion: WorkflowVersion = {
      id: `${newWorkflow.id}-v1`,
      version: 1,
      name: newWorkflow.name,
      description: newWorkflow.description,
      nodes: [],
      connections: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'current-user',
      tags: [],
      isPublished: false,
      executionCount: 0
    };

    newWorkflow.versions = [initialVersion];

    await saveWorkflow(newWorkflow);
    onNewWorkflow?.(newWorkflow);
    onSelectWorkflow(newWorkflow);
    success('New workflow created');
  };

  // Save workflow
  const saveWorkflow = async (workflow: WorkflowMetadata) => {
    try {
      const orgId = currentOrganization()?.id;
      if (!orgId) return;

      // Save workflow metadata
      await kvStore.set(`workflow-${workflow.id}-metadata`, JSON.stringify(workflow));

      // Update workflow index
      const workflowList = await kvStore.get(`org-${orgId}-workflows-index`);
      const workflowIds = workflowList ? JSON.parse(workflowList) : [];

      if (!workflowIds.includes(workflow.id)) {
        workflowIds.push(workflow.id);
        await kvStore.set(`org-${orgId}-workflows-index`, JSON.stringify(workflowIds));
      }

      // Refresh list
      await loadWorkflows();
    } catch (err) {
      console.error('Failed to save workflow:', err);
      error('Failed to save workflow');
    }
  };

  // Delete workflow
  const deleteWorkflow = async (workflowId: string) => {
    if (!confirm('Are you sure you want to delete this workflow? This action cannot be undone.')) {
      return;
    }

    try {
      const orgId = currentOrganization()?.id;
      if (!orgId) return;

      // Remove from KV store
      await kvStore.del(`workflow-${workflowId}-metadata`);

      // Update workflow index
      const workflowList = await kvStore.get(`org-${orgId}-workflows-index`);
      if (workflowList) {
        const workflowIds = JSON.parse(workflowList);
        const updatedIds = workflowIds.filter(id => id !== workflowId);
        await kvStore.set(`org-${orgId}-workflows-index`, JSON.stringify(updatedIds));
      }

      await loadWorkflows();
      success('Workflow deleted');
    } catch (err) {
      console.error('Failed to delete workflow:', err);
      error('Failed to delete workflow');
    }
  };

  // Toggle star
  const toggleStar = async (workflowId: string) => {
    const workflow = workflows().find(w => w.id === workflowId);
    if (!workflow) return;

    workflow.isStarred = !workflow.isStarred;
    await saveWorkflow(workflow);
  };

  // Get unique categories
  const getCategories = () => {
    const categories = new Set(workflows().map(w => w.category));
    return Array.from(categories);
  };

  // Load workflows on mount and when organization changes
  createEffect(() => {
    if (currentOrganization()?.id) {
      loadWorkflows();
    }
  });

  // Filter workflows when search or filters change
  createEffect(() => {
    filterWorkflows();
  });

  return (
    <div class="workflow-manager h-full flex flex-col bg-white dark:bg-slate-900">
      {/* Header */}
      <div class="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
        <div class="flex items-center gap-3">
          <FolderOpen class="w-6 h-6 text-slate-600 dark:text-slate-400" />
          <h2 class="text-xl font-bold text-slate-900 dark:text-white">Workflows</h2>
          <span class="px-2 py-1 text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded">
            {filteredWorkflows().length} workflows
          </span>
        </div>

        <div class="flex items-center gap-2">
          <button
            class="btn btn-primary flex items-center gap-2"
            onClick={createWorkflow}
          >
            <Plus class="w-4 h-4" />
            New Workflow
          </button>
        </div>
      </div>

      {/* Filters and Search */}
      <div class="p-4 border-b border-slate-200 dark:border-slate-700 space-y-4">
        {/* Search */}
        <div class="relative">
          <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-slate-500 w-4 h-4" />
          <input
            type="text"
            placeholder="Search workflows..."
            class="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={searchQuery()}
            onInput={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Filters */}
        <div class="flex items-center gap-4 flex-wrap">
          <div class="flex items-center gap-2">
            <Filter class="w-4 h-4 text-slate-500" />
            <select
              class="text-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded px-2 py-1"
              value={selectedCategory()}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="all">All Categories</option>
              <For each={getCategories()}>
                {(category) => <option value={category}>{category}</option>}
              </For>
            </select>
          </div>

          <div class="flex items-center gap-2">
            <SortAsc class="w-4 h-4 text-slate-500" />
            <select
              class="text-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded px-2 py-1"
              value={sortBy()}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="updatedAt">Last Updated</option>
              <option value="name">Name</option>
              <option value="executionCount">Executions</option>
              <option value="successRate">Success Rate</option>
            </select>
          </div>

          <button
            class="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            onClick={() => setSortOrder(sortOrder() === 'desc' ? 'asc' : 'desc')}
          >
            {sortOrder() === 'desc' ? '↓' : '↑'}
          </button>
        </div>
      </div>

      {/* Workflow List */}
      <div class="flex-1 overflow-y-auto p-4">
        <Show when={isLoading()} fallback={
          <Show when={filteredWorkflows().length > 0} fallback={
            <div class="text-center py-12">
              <FolderOpen class="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
              <h3 class="text-lg font-semibold text-slate-600 dark:text-slate-400 mb-2">
                {searchQuery() ? 'No workflows found' : 'No workflows yet'}
              </h3>
              <p class="text-slate-500 dark:text-slate-400 mb-4">
                {searchQuery()
                  ? 'Try adjusting your search or filters'
                  : 'Create your first workflow to get started'
                }
              </p>
              {!searchQuery() && (
                <button
                  class="btn btn-primary"
                  onClick={createWorkflow}
                >
                  Create Workflow
                </button>
              )}
            </div>
          }>
            <div class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              <For each={filteredWorkflows()}>
                {(workflow) => (
                  <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 hover:shadow-md transition-all">
                    {/* Workflow Header */}
                    <div class="flex items-start justify-between mb-3">
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 mb-1">
                          <h3 class="font-semibold text-slate-900 dark:text-white truncate">
                            {workflow.name}
                          </h3>
                          <Show when={workflow.isStarred}>
                            <Star class="w-4 h-4 text-yellow-500 fill-current" />
                          </Show>
                          <Show when={workflow.isTemplate}>
                            <Tag class="w-4 h-4 text-blue-500" />
                          </Show>
                        </div>
                        <p class="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
                          {workflow.description || 'No description'}
                        </p>
                      </div>

                      <div class="flex items-center gap-1 ml-2">
                        <button
                          class="p-1 text-slate-400 hover:text-yellow-500 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleStar(workflow.id);
                          }}
                          title="Star workflow"
                        >
                          <Star class={`w-4 h-4 ${workflow.isStarred ? 'fill-current text-yellow-500' : ''}`} />
                        </button>

                        <button
                          class="p-1 text-slate-400 hover:text-red-500 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteWorkflow(workflow.id);
                          }}
                          title="Delete workflow"
                        >
                          <Trash2 class="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Workflow Stats */}
                    <div class="grid grid-cols-2 gap-2 mb-3">
                      <div class="text-center p-2 bg-slate-50 dark:bg-slate-700 rounded">
                        <div class="text-lg font-semibold text-slate-900 dark:text-white">
                          {workflow.executionStats.totalExecutions}
                        </div>
                        <div class="text-xs text-slate-500">Executions</div>
                      </div>
                      <div class="text-center p-2 bg-slate-50 dark:bg-slate-700 rounded">
                        <div class="text-lg font-semibold text-slate-900 dark:text-white">
                          {Math.round(workflow.executionStats.successRate * 100)}%
                        </div>
                        <div class="text-xs text-slate-500">Success Rate</div>
                      </div>
                    </div>

                    {/* Tags */}
                    <Show when={workflow.tags.length > 0}>
                      <div class="flex flex-wrap gap-1 mb-3">
                        <For each={workflow.tags.slice(0, 3)}>
                          {(tag) => (
                            <span class="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                              {tag}
                            </span>
                          )}
                        </For>
                        <Show when={workflow.tags.length > 3}>
                          <span class="text-xs text-slate-500">+{workflow.tags.length - 3} more</span>
                        </Show>
                      </div>
                    </Show>

                    {/* Workflow Actions */}
                    <div class="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-700">
                      <div class="flex items-center gap-2 text-xs text-slate-500">
                        <Clock class="w-3 h-3" />
                        <span>v{workflow.currentVersion}</span>
                        <span>•</span>
                        <span>{new Date(workflow.updatedAt).toLocaleDateString()}</span>
                      </div>

                      <div class="flex items-center gap-1">
                        <button
                          class="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                          onClick={() => onSelectWorkflow(workflow)}
                          title="Edit workflow"
                        >
                          <Edit3 class="w-4 h-4" />
                        </button>

                        <button
                          class="p-1.5 text-slate-400 hover:text-green-600 dark:hover:text-green-400 transition-colors"
                          onClick={() => {
                            // TODO: Implement quick run
                            success('Quick run feature coming soon!');
                          }}
                          title="Quick run"
                        >
                          <Play class="w-4 h-4" />
                        </button>

                        <button
                          class="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                          onClick={() => setShowVersions(showVersions() === workflow.id ? null : workflow.id)}
                          title="Version history"
                        >
                          <ChevronRight class={`w-4 h-4 transition-transform ${showVersions() === workflow.id ? 'rotate-90' : ''}`} />
                        </button>
                      </div>
                    </div>

                    {/* Version History */}
                    <Show when={showVersions() === workflow.id}>
                      <div class="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                        <div class="text-sm font-medium text-slate-900 dark:text-white mb-2">Version History</div>
                        <div class="space-y-1 max-h-32 overflow-y-auto">
                          <For each={workflow.versions.slice(0, 10)}>
                            {(version) => (
                              <div class="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-700 rounded text-xs">
                                <div class="flex items-center gap-2">
                                  <span class="font-medium">v{version.version}</span>
                                  <span class="text-slate-500">{new Date(version.updatedAt).toLocaleDateString()}</span>
                                </div>
                                <div class="flex items-center gap-1">
                                  <Show when={version.isPublished}>
                                    <span class="px-1 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded text-xs">
                                      Published
                                    </span>
                                  </Show>
                                  <button
                                    class="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
                                    onClick={() => {
                                      // TODO: Load specific version
                                      success('Loading version feature coming soon!');
                                    }}
                                  >
                                    Load
                                  </button>
                                </div>
                              </div>
                            )}
                          </For>
                        </div>
                      </div>
                    </Show>
                  </div>
                )}
              </For>
            </div>
          </Show>
        }>
          <div class="text-center py-12">
            <div class="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p class="text-slate-600 dark:text-slate-400">Loading workflows...</p>
          </div>
        </Show>
      </div>
    </div>
  );
}

export default WorkflowManager;