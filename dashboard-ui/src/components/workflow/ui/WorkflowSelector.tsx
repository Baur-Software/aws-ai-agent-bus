import { createSignal, createEffect, Show, For, onCleanup } from 'solid-js';
import { ChevronDown, Search, Plus, Play, Sparkles } from 'lucide-solid';

export interface WorkflowSelectorProps {
  currentWorkflow?: {
    id: string;
    name: string;
    version: string;
    metadata?: {
      nodeCount?: number;
      updatedAt?: string;
    };
  };
  workflows?: Array<{
    id: string;
    name: string;
    description?: string;
    metadata?: {
      nodeCount?: number;
      updatedAt?: string;
    };
  }>;
  onWorkflowSelect?: (workflowId: string) => void;
  onCreateNewWorkflow?: () => void;
  onOpenTemplates?: () => void;
  onBrowseAll?: () => void;
  class?: string;
}

export default function WorkflowSelector(props: WorkflowSelectorProps) {
  const [showPicker, setShowPicker] = createSignal(false);
  const [searchQuery, setSearchQuery] = createSignal('');

  // Filter workflows based on search query
  const filteredWorkflows = () => {
    if (!props.workflows) return [];
    const query = searchQuery().toLowerCase().trim();
    if (!query) return props.workflows;

    return props.workflows.filter(workflow =>
      workflow.name.toLowerCase().includes(query) ||
      workflow.description?.toLowerCase().includes(query)
    );
  };

  // Close picker when clicking outside
  createEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('[data-workflow-selector]')) {
        setShowPicker(false);
      }
    };

    if (showPicker()) {
      document.addEventListener('mousedown', handleClickOutside);
      onCleanup(() => document.removeEventListener('mousedown', handleClickOutside));
    }
  });

  const handleWorkflowSelect = (workflowId: string) => {
    props.onWorkflowSelect?.(workflowId);
    setShowPicker(false);
    setSearchQuery(''); // Reset search
  };

  const handleCreateNew = () => {
    props.onCreateNewWorkflow?.();
    setShowPicker(false);
  };

  const handleOpenTemplates = () => {
    props.onOpenTemplates?.();
    setShowPicker(false);
  };

  const handleBrowseAll = () => {
    props.onBrowseAll?.();
    setShowPicker(false);
  };

  return (
    <div class={`relative ${props.class || ''}`} data-workflow-selector>
      {/* Main Selector Button */}
      <button
        onClick={() => setShowPicker(!showPicker())}
        class="flex items-center gap-2 px-3 py-2 text-left bg-white/90 dark:bg-gray-800/90 hover:bg-white dark:hover:bg-gray-700 rounded-lg border border-gray-200/50 dark:border-gray-600/50 min-w-[200px] shadow-sm hover:shadow-md transition-all duration-200"
        aria-expanded={showPicker()}
        aria-haspopup="listbox"
      >
        <div class="flex-1 min-w-0">
          <div class="font-medium text-gray-900 dark:text-white text-sm truncate">
            {props.currentWorkflow?.name || 'New Workflow'}
          </div>
          <Show when={props.currentWorkflow}>
            <div class="text-xs text-gray-500 dark:text-gray-400 truncate">
              v{props.currentWorkflow?.version} • {props.currentWorkflow?.metadata?.nodeCount || 0} nodes
            </div>
          </Show>
        </div>
        <ChevronDown class={`w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform ${showPicker() ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Picker */}
      <Show when={showPicker()}>
        <div class="absolute top-full left-0 mt-2 w-80 bg-white/95 dark:bg-gray-800/95 backdrop-blur-md border border-gray-200/50 dark:border-gray-700/50 rounded-xl shadow-2xl z-50 max-h-96 overflow-hidden">

          {/* Search Input */}
          <div class="p-3 border-b border-gray-200/50 dark:border-gray-700/50">
            <div class="relative">
              <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
              <input
                type="text"
                placeholder="Search workflows..."
                value={searchQuery()}
                onInput={(e) => setSearchQuery(e.currentTarget.value)}
                class="w-full pl-10 pr-4 py-2 border border-gray-300/50 dark:border-gray-600/50 rounded-lg bg-white/80 dark:bg-gray-700/80 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-all"
                autofocus
              />
            </div>
          </div>

          {/* Workflow List */}
          <div class="max-h-64 overflow-y-auto">

            {/* Create New Workflow Option */}
            <button
              onClick={handleCreateNew}
              class="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50/80 dark:hover:bg-gray-700/80 border-b border-gray-100/50 dark:border-gray-700/50 transition-colors"
            >
              <div class="w-8 h-8 bg-blue-100/80 dark:bg-blue-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                <Plus class="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div class="flex-1 min-w-0">
                <div class="font-medium text-gray-900 dark:text-white text-sm">Create New Workflow</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">Start with a blank canvas</div>
              </div>
            </button>

            {/* Existing Workflows */}
            <For each={filteredWorkflows().slice(0, 8)}>
              {(workflow) => (
                <button
                  onClick={() => handleWorkflowSelect(workflow.id)}
                  class={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50/80 dark:hover:bg-gray-700/80 transition-colors ${
                    workflow.id === props.currentWorkflow?.id
                      ? 'bg-blue-50/80 dark:bg-blue-900/20 border-r-2 border-blue-500'
                      : ''
                  }`}
                >
                  <div class="w-8 h-8 bg-gray-100/80 dark:bg-gray-700/80 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Play class="w-4 h-4 text-gray-600 dark:text-gray-300" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="font-medium text-gray-900 dark:text-white text-sm truncate">
                      {workflow.name}
                    </div>
                    <div class="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {workflow.metadata?.nodeCount || 0} nodes • {
                        workflow.metadata?.updatedAt
                          ? new Date(workflow.metadata.updatedAt).toLocaleDateString()
                          : 'Unknown'
                      }
                    </div>
                  </div>
                </button>
              )}
            </For>

            {/* Show More Option */}
            <Show when={filteredWorkflows().length > 8}>
              <button
                onClick={handleBrowseAll}
                class="w-full px-4 py-3 text-center text-sm text-blue-600 dark:text-blue-400 hover:bg-gray-50/80 dark:hover:bg-gray-700/80 border-t border-gray-100/50 dark:border-gray-700/50 transition-colors"
              >
                View all {props.workflows?.length || 0} workflows →
              </button>
            </Show>

            {/* No Results */}
            <Show when={searchQuery() && filteredWorkflows().length === 0}>
              <div class="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                <div class="text-sm">No workflows found</div>
                <div class="text-xs mt-1">Try a different search term</div>
              </div>
            </Show>
          </div>

          {/* Quick Actions Footer */}
          <div class="border-t border-gray-100/50 dark:border-gray-700/50 p-2 flex gap-2">
            <button
              onClick={handleOpenTemplates}
              class="flex-1 flex items-center gap-2 px-3 py-2 text-purple-600 dark:text-purple-400 hover:bg-purple-50/80 dark:hover:bg-purple-900/20 rounded-lg transition-colors text-sm"
            >
              <Sparkles class="w-4 h-4 flex-shrink-0" />
              <span>Templates</span>
            </button>
            <button
              onClick={handleBrowseAll}
              class="flex-1 flex items-center gap-2 px-3 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-50/80 dark:hover:bg-gray-700/80 rounded-lg transition-colors text-sm"
            >
              <span>Browse All</span>
            </button>
          </div>
        </div>
      </Show>
    </div>
  );
}