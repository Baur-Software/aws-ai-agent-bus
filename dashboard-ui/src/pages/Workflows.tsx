import { createSignal, createEffect, Show, For } from 'solid-js';
import { useOrganization } from '../contexts/OrganizationContext';
import { useNotifications } from '../contexts/NotificationContext';
import { useKVStore } from '../contexts/KVStoreContext';
import { useDashboard } from '../contexts/DashboardContext';
import { usePageHeader } from '../contexts/HeaderContext';
import WorkflowBuilder from '../components/WorkflowBuilder';
import WorkflowMarketplace from '../components/WorkflowMarketplace';
import {
  Plus,
  Search,
  Filter,
  Star,
  GitFork,
  Eye,
  Clock,
  Users,
  Globe,
  Sparkles,
  Play,
  Edit,
  Trash2,
  Copy,
  Share,
  MoreHorizontal
} from 'lucide-solid';

interface WorkflowSummary {
  id: string;
  name: string;
  description?: string;
  context: 'user' | 'shared';
  isPublic: boolean;
  version: string;
  stats: {
    starCount: number;
    forkCount: number;
    usageCount: number;
    lastUsed?: string;
  };
  metadata: {
    createdAt: string;
    updatedAt: string;
    createdBy: string;
    nodeCount: number;
    tags: string[];
  };
  collaborators: any[];
  forkedFrom?: {
    originalAuthor: string;
    workflowId: string;
  };
}

function Workflows() {
  const [view, setView] = createSignal<'browser' | 'builder' | 'marketplace'>('browser');
  const [selectedWorkflowId, setSelectedWorkflowId] = createSignal<string | undefined>();
  const [workflows, setWorkflows] = createSignal<WorkflowSummary[]>([]);
  const [filteredWorkflows, setFilteredWorkflows] = createSignal<WorkflowSummary[]>([]);
  const [searchQuery, setSearchQuery] = createSignal('');
  const [contextFilter, setContextFilter] = createSignal<'all' | 'user' | 'shared'>('all');
  const [loading, setLoading] = createSignal(true);

  const { currentOrganization, user } = useOrganization();
  const { success, error } = useNotifications();
  const kvStore = useKVStore();
  const dashboard = useDashboard();

  // Set page-specific header
  usePageHeader('Workflows', 'Orchestrate and automate AI agent tasks');

  createEffect(async () => {
    if (view() === 'browser') {
      await loadWorkflows();
    }
  });

  createEffect(() => {
    const query = searchQuery().toLowerCase();
    const context = contextFilter();

    let filtered = workflows().filter(workflow => {
      const matchesSearch = !query ||
        workflow.name.toLowerCase().includes(query) ||
        workflow.description?.toLowerCase().includes(query) ||
        workflow.metadata.tags.some(tag => tag.toLowerCase().includes(query));

      const matchesContext = context === 'all' || workflow.context === context;

      return matchesSearch && matchesContext;
    });

    // Sort by last updated
    filtered.sort((a, b) => new Date(b.metadata.updatedAt).getTime() - new Date(a.metadata.updatedAt).getTime());

    setFilteredWorkflows(filtered);
  });

  const loadWorkflows = async () => {
    try {
      setLoading(true);

      // Load workflows from dashboard API
      const workflowsData = await dashboard.workflows.getAll();

      // Convert to our UI format
      const workflowSummaries: WorkflowSummary[] = workflowsData.map(workflow => ({
        id: workflow.workflowId,
        name: workflow.name,
        description: workflow.description,
        context: 'user', // TODO: Determine from contextId
        isPublic: false, // TODO: Get from context permissions
        version: '1.0.0', // TODO: Implement versioning
        stats: {
          starCount: 0, // TODO: Implement stats in backend
          forkCount: 0,
          usageCount: 0
        },
        metadata: {
          createdAt: workflow.createdAt,
          updatedAt: workflow.updatedAt,
          createdBy: workflow.createdBy,
          nodeCount: 0, // TODO: Parse definition to count nodes
          tags: [] // TODO: Implement tags
        },
        collaborators: [], // TODO: Get from workflow sharing
        forkedFrom: undefined // TODO: Implement forking
      }));

      setWorkflows(workflowSummaries);
    } catch (err) {
      error(`Failed to load workflows: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    setSelectedWorkflowId(undefined);
    setView('builder');
  };

  const handleOpenMarketplace = () => {
    setView('marketplace');
  };

  const handleSelectWorkflow = (workflowId: string) => {
    setSelectedWorkflowId(workflowId);
    setView('builder');
  };

  const handleSelectTemplate = (template: any) => {
    // TODO: Create workflow from template
    success(`Template "${template.name}" will be loaded soon!`);
    setView('browser');
  };

  const handleBackToBrowser = () => {
    setView('browser');
    setSelectedWorkflowId(undefined);
    loadWorkflows(); // Refresh workflow list
  };

  if (view() === 'builder') {
    return (
      <WorkflowBuilder
        workflowId={selectedWorkflowId()}
        onBack={handleBackToBrowser}
      />
    );
  }

  if (view() === 'marketplace') {
    return (
      <WorkflowMarketplace
        onClose={() => setView('browser')}
        onSelectTemplate={handleSelectTemplate}
        organizationContext={currentOrganization() !== null}
      />
    );
  }

  return (
    <div class="workflows-page h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-4">
            <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
              Workflows
            </h1>
            <span class="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-sm font-medium rounded-full">
              {filteredWorkflows().length} workflows
            </span>
          </div>

          <div class="flex items-center gap-3">
            <button
              onClick={handleOpenMarketplace}
              class="flex items-center gap-2 px-4 py-2 text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors"
            >
              <Sparkles class="w-4 h-4" />
              <span class="font-medium">Browse Templates</span>
            </button>
            <button
              onClick={handleCreateNew}
              class="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors"
            >
              <Plus class="w-4 h-4" />
              <span>New Workflow</span>
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div class="mt-4 flex items-center gap-4">
          <div class="relative flex-1 max-w-md">
            <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search workflows..."
              value={searchQuery()}
              onInput={(e) => setSearchQuery(e.currentTarget.value)}
              class="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <select
            value={contextFilter()}
            onInput={(e) => setContextFilter(e.currentTarget.value as any)}
            class="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Contexts</option>
            <option value="user">Personal</option>
            <option value="shared">Organization</option>
          </select>
        </div>
      </div>

      {/* Workflow Grid */}
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
            when={filteredWorkflows().length > 0}
            fallback={
              <div class="text-center py-12">
                <div class="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Play class="w-8 h-8 text-gray-400" />
                </div>
                <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No workflows found
                </h3>
                <p class="text-gray-500 dark:text-gray-400 mb-6">
                  Get started by creating your first workflow or browsing templates.
                </p>
                <div class="flex items-center justify-center gap-3">
                  <button
                    onClick={handleCreateNew}
                    class="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                  >
                    <Plus class="w-4 h-4" />
                    Create Workflow
                  </button>
                  <button
                    onClick={handleOpenMarketplace}
                    class="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
                  >
                    <Sparkles class="w-4 h-4" />
                    Browse Templates
                  </button>
                </div>
              </div>
            }
          >
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              <For each={filteredWorkflows()}>
                {(workflow) => (
                  <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg transition-shadow cursor-pointer group">
                    {/* Workflow Header */}
                    <div class="flex items-start justify-between mb-4">
                      <div class="flex-1">
                        <div class="flex items-center gap-2 mb-1">
                          <h3
                            class="font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 cursor-pointer"
                            onClick={() => handleSelectWorkflow(workflow.id)}
                          >
                            {workflow.name}
                          </h3>
                          <span class={`px-2 py-0.5 text-xs font-medium rounded-full ${
                            workflow.context === 'shared'
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                              : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                          }`}>
                            {workflow.context === 'shared' ? 'Org' : 'Personal'}
                          </span>
                        </div>
                        <Show when={workflow.description}>
                          <p class="text-sm text-gray-600 dark:text-gray-300 mb-2 line-clamp-2">
                            {workflow.description}
                          </p>
                        </Show>
                      </div>
                    </div>

                    {/* Fork Info */}
                    <Show when={workflow.forkedFrom}>
                      <div class="text-xs text-blue-600 dark:text-blue-400 mb-3">
                        Forked from {workflow.forkedFrom?.originalAuthor}
                      </div>
                    </Show>

                    {/* Workflow Stats */}
                    <div class="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mb-4">
                      <div class="flex items-center gap-1">
                        <Star class="w-3 h-3" />
                        <span>{workflow.stats.starCount}</span>
                      </div>
                      <div class="flex items-center gap-1">
                        <GitFork class="w-3 h-3" />
                        <span>{workflow.stats.forkCount}</span>
                      </div>
                      <div class="flex items-center gap-1">
                        <Eye class="w-3 h-3" />
                        <span>{workflow.stats.usageCount}</span>
                      </div>
                      <div class="flex items-center gap-1">
                        <span>{workflow.metadata.nodeCount} nodes</span>
                      </div>
                    </div>

                    {/* Tags */}
                    <Show when={workflow.metadata.tags.length > 0}>
                      <div class="flex flex-wrap gap-1 mb-4">
                        <For each={workflow.metadata.tags.slice(0, 3)}>
                          {(tag) => (
                            <span class="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs rounded">
                              #{tag}
                            </span>
                          )}
                        </For>
                        <Show when={workflow.metadata.tags.length > 3}>
                          <span class="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs rounded">
                            +{workflow.metadata.tags.length - 3}
                          </span>
                        </Show>
                      </div>
                    </Show>

                    {/* Workflow Footer */}
                    <div class="flex items-center justify-between">
                      <div class="text-xs text-gray-500 dark:text-gray-400">
                        v{workflow.version} • {new Date(workflow.metadata.updatedAt).toLocaleDateString()}
                      </div>
                      <button
                        onClick={() => handleSelectWorkflow(workflow.id)}
                        class="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                      >
                        Open →
                      </button>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </Show>
      </div>
    </div>
  );
}

export default Workflows;