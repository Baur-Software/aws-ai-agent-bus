import { createSignal, createEffect, Show, For } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { usePageHeader } from '../contexts/HeaderContext';
import { useWorkflow } from '../contexts/WorkflowContext';
import {
  Search,
  Plus,
  Upload,
  Sparkles,
  Star,
  GitFork,
  Eye,
  Play,
  Share,
  ExternalLink,
  Filter,
  Grid,
  List,
  Users,
  Building
} from 'lucide-solid';

type ViewMode = 'grid' | 'list';
type FilterType = 'all' | 'my' | 'org' | 'templates';

interface WorkflowBrowserProps {
  onWorkflowSelect?: (workflowId: string) => void;
  overlayMode?: boolean;
}

export default function WorkflowBrowser(props: WorkflowBrowserProps = {}) {
  const [searchQuery, setSearchQuery] = createSignal('');
  const [activeFilter, setActiveFilter] = createSignal<FilterType>('all');
  const [viewMode, setViewMode] = createSignal<ViewMode>('grid');
  const [sortBy, setSortBy] = createSignal<'recent' | 'name' | 'popular'>('recent');

  const navigate = useNavigate();

  // Set page header only when not in overlay mode
  if (!props.overlayMode) {
    usePageHeader('Process Library', 'Browse, create, and manage your business processes');
  }

  const {
    workflows,
    loading,
    createNewWorkflow: contextCreateNew,
    importWorkflow: contextImportWorkflow
  } = useWorkflow();

  // Route-based navigation functions
  const createNewWorkflow = async () => {
    try {
      const newId = await contextCreateNew();
      navigate(`/workflows/${newId}`);
    } catch (err) {
      console.error('Failed to create workflow:', err);
    }
  };

  const navigateToWorkflow = (workflowId: string) => {
    if (props.onWorkflowSelect) {
      props.onWorkflowSelect(workflowId);
    } else {
      navigate(`/workflows/${workflowId}`);
    }
  };
  const openTemplates = () => navigate('/workflows/marketplace');
  const importWorkflow = contextImportWorkflow;

  // Filter workflows based on active filter and search
  const filteredWorkflows = () => {
    let workflowList = workflows() || [];
    const query = searchQuery().toLowerCase().trim();
    const filter = activeFilter();

    // Apply context filter
    switch (filter) {
      case 'my':
        workflowList = workflowList.filter(w => w.context === 'user');
        break;
      case 'org':
        workflowList = workflowList.filter(w => w.context === 'shared');
        break;
      case 'templates':
        workflowList = workflowList.filter(w => w.metadata.tags.includes('template'));
        break;
      case 'all':
      default:
        break;
    }

    // Apply search filter
    if (query) {
      workflowList = workflowList.filter(workflow =>
        workflow.name.toLowerCase().includes(query) ||
        workflow.description?.toLowerCase().includes(query) ||
        workflow.metadata.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Apply sorting
    switch (sortBy()) {
      case 'name':
        workflowList.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'popular':
        workflowList.sort((a, b) => b.stats.usageCount - a.stats.usageCount);
        break;
      case 'recent':
      default:
        workflowList.sort((a, b) => new Date(b.metadata.updatedAt).getTime() - new Date(a.metadata.updatedAt).getTime());
        break;
    }

    return workflowList;
  };

  const getFilterCount = (filter: FilterType) => {
    const workflowList = workflows() || [];
    switch (filter) {
      case 'my':
        return workflowList.filter(w => w.context === 'user').length;
      case 'org':
        return workflowList.filter(w => w.context === 'shared').length;
      case 'templates':
        return workflowList.filter(w => w.metadata.tags.includes('template')).length;
      default:
        return workflowList.length;
    }
  };

  const filters = () => [
    { id: 'all' as FilterType, label: 'All Processes', icon: Grid, count: getFilterCount('all') },
    { id: 'my' as FilterType, label: 'My Processes', icon: Users, count: getFilterCount('my') },
    { id: 'org' as FilterType, label: 'Company Processes', icon: Building, count: getFilterCount('org') },
    { id: 'templates' as FilterType, label: 'Templates', icon: Sparkles, count: getFilterCount('templates') }
  ];

  const handleShareWorkflow = (workflowId: string, event: Event) => {
    event.stopPropagation();
    const shareUrl = `${window.location.origin}/workflow/${workflowId}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      console.log('Workflow URL copied to clipboard');
      // TODO: Show toast notification
    });
  };

  return (
    <div class="max-w-7xl mx-auto p-6">
      {/* Quick Actions */}
      <div class="mb-8 bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-6">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            onClick={createNewWorkflow}
            class="flex items-center gap-4 p-4 bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-xl"
          >
            <div class="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
              <Plus class="w-5 h-5" />
            </div>
            <div class="text-left">
              <div class="font-semibold">Design Process</div>
              <div class="text-sm opacity-90">Start with a blank canvas</div>
            </div>
          </button>

          <button
            onClick={importWorkflow}
            class="flex items-center gap-4 p-4 bg-orange-500 hover:bg-orange-600 text-white rounded-xl transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-xl"
          >
            <div class="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
              <Upload class="w-5 h-5" />
            </div>
            <div class="text-left">
              <div class="font-semibold">Import Process</div>
              <div class="text-sm opacity-90">Upload from file</div>
            </div>
          </button>

          <button
            onClick={openTemplates}
            class="flex items-center gap-4 p-4 bg-purple-500 hover:bg-purple-600 text-white rounded-xl transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-xl"
          >
            <div class="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
              <Sparkles class="w-5 h-5" />
            </div>
            <div class="text-left">
              <div class="font-semibold">Browse Templates</div>
              <div class="text-sm opacity-90">Start from proven processes</div>
            </div>
          </button>

          <button
            onClick={() => {/* TODO: Connect apps */}}
            class="flex items-center gap-4 p-4 bg-green-500 hover:bg-green-600 text-white rounded-xl transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-xl"
          >
            <div class="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
              <ExternalLink class="w-5 h-5" />
            </div>
            <div class="text-left">
              <div class="font-semibold">Connect Apps</div>
              <div class="text-sm opacity-90">Expand capabilities</div>
            </div>
          </button>
        </div>
      </div>

      {/* Search and Controls */}
      <div class="mb-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div class="flex items-center gap-4 mb-4">
          <div class="relative flex-1">
            <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              placeholder="Search business processes..."
              value={searchQuery()}
              onInput={(e) => setSearchQuery(e.currentTarget.value)}
              class="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>
          <select
            value={sortBy()}
            onInput={(e) => setSortBy(e.currentTarget.value as any)}
            class="px-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
          >
            <option value="recent">Recent</option>
            <option value="name">Name</option>
            <option value="popular">Popular</option>
          </select>
          <div class="flex items-center gap-1 border border-gray-300 dark:border-gray-600 rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              class={`p-2 rounded transition-colors ${viewMode() === 'grid' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
            >
              <Grid class="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              class={`p-2 rounded transition-colors ${viewMode() === 'list' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
            >
              <List class="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div class="flex gap-2">
          <For each={filters()}>
            {(filter) => (
              <button
                onClick={() => setActiveFilter(filter.id)}
                class={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                  activeFilter() === filter.id
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-700'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 border border-transparent'
                }`}
              >
                <filter.icon class="w-4 h-4" />
                <span>{filter.label}</span>
                <span class="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded-full text-xs">
                  {filter.count}
                </span>
              </button>
            )}
          </For>
        </div>
      </div>

      {/* Workflow List */}
      <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <Show
          when={!loading()}
          fallback={
            <div class="flex items-center justify-center h-64">
              <div class="flex items-center gap-3">
                <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
                <span class="text-gray-600 dark:text-gray-400">Loading workflows...</span>
              </div>
            </div>
          }
        >
          <Show
            when={filteredWorkflows().length > 0}
            fallback={
              <div class="text-center py-12">
                <div class="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Sparkles class="w-8 h-8 text-gray-400 dark:text-gray-500" />
                </div>
                <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No processes found
                </h3>
                <p class="text-gray-500 dark:text-gray-400 mb-6">
                  {searchQuery() ? 'Try adjusting your search terms.' : 'Get started by designing your first business process.'}
                </p>
                <button
                  onClick={createNewWorkflow}
                  class="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                >
                  <Plus class="w-4 h-4" />
                  Design Process
                </button>
              </div>
            }
          >
            <div class="p-6">
              <Show
                when={viewMode() === 'grid'}
                fallback={
                  <div class="space-y-3">
                    <For each={filteredWorkflows()}>
                      {(workflow) => (
                        <div class="flex items-center gap-4 p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md transition-all duration-200 cursor-pointer group">
                          <div class="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                            <Play class="w-6 h-6 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div class="flex-1" onClick={() => navigateToWorkflow(workflow.id)}>
                            <div class="flex items-center gap-2 mb-1">
                              <h3 class="font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
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
                              <p class="text-sm text-gray-600 dark:text-gray-300 mb-2">
                                {workflow.description}
                              </p>
                            </Show>
                            <div class="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
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
                              <span>v{workflow.version}</span>
                              <span>{new Date(workflow.metadata.updatedAt).toLocaleDateString()}</span>
                              <button
                                onClick={(e) => handleShareWorkflow(workflow.id, e)}
                                class="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors ml-auto"
                                title="Copy shareable link"
                              >
                                <Share class="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </For>
                  </div>
                }
              >
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <For each={filteredWorkflows()}>
                    {(workflow) => (
                      <div
                        onClick={() => navigateToWorkflow(workflow.id)}
                        class="text-left p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-lg transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] group cursor-pointer"
                      >
                        <div class="flex items-start justify-between mb-3">
                          <div class="flex-1">
                            <div class="flex items-center gap-2 mb-1">
                              <h3 class="font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
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
                          <div class="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center ml-3">
                            <Play class="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          </div>
                        </div>

                        <div class="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mb-3">
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
                          <span>{workflow.metadata.nodeCount} nodes</span>
                        </div>

                        <div class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                          <span>v{workflow.version}</span>
                          <div class="flex items-center gap-2">
                            <button
                              onClick={(e) => handleShareWorkflow(workflow.id, e)}
                              class="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                              title="Copy shareable link"
                            >
                              <Share class="w-3 h-3" />
                            </button>
                            <span>{new Date(workflow.metadata.updatedAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
            </div>
          </Show>
        </Show>
      </div>
    </div>
  );
}