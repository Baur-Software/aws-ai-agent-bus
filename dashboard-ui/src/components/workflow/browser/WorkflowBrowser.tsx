// Workflow Browser Component
// Lists, searches, and manages multiple workflows

import { createSignal, createResource, For, Show, onMount } from 'solid-js';
import {
  Search, Plus, Play, Edit, Copy, Trash2, Download, Upload,
  Star, Clock, Users, Tag, Funnel, Grid, List as ListIcon,
  Calendar, BarChart3, Settings, Share2, Eye, FileText,
  ChevronDown, SortAsc, SortDesc, Folder, Globe
} from 'lucide-solid';
import { WorkflowStorageService, WorkflowListItem, WorkflowSearchFilters } from '../../../services/WorkflowStorageService';
import { WorkflowDefinition } from '../../../workflow/types';

interface WorkflowBrowserProps {
  workflowStorage: WorkflowStorageService;
  onWorkflowSelect: (workflow: WorkflowDefinition) => void;
  onNewWorkflow: () => void;
  onEditWorkflow: (workflowId: string) => void;
  onExecuteWorkflow: (workflowId: string) => void;
}

type ViewMode = 'grid' | 'list';
type SortBy = 'name' | 'modified' | 'created' | 'executions';
type SortOrder = 'asc' | 'desc';

export default function WorkflowBrowser(props: WorkflowBrowserProps) {
  const [searchQuery, setSearchQuery] = createSignal('');
  const [selectedCategory, setSelectedCategory] = createSignal<string>('all');
  const [selectedTag, setSelectedTag] = createSignal<string>('all');
  const [viewMode, setViewMode] = createSignal<ViewMode>('grid');
  const [sortBy, setSortBy] = createSignal<SortBy>('modified');
  const [sortOrder, setSortOrder] = createSignal<SortOrder>('desc');
  const [showFilters, setShowFilters] = createSignal(false);
  const [selectedWorkflows, setSelectedWorkflows] = createSignal<string[]>([]);

  // Load workflows
  const [workflows, { refetch: refetchWorkflows }] = createResource(
    () => ({ searchQuery: searchQuery(), category: selectedCategory(), tag: selectedTag() }),
    async ({ searchQuery, category, tag }) => {
      const filters: WorkflowSearchFilters = {};
      
      if (searchQuery.trim()) {
        filters.query = searchQuery.trim();
      }
      
      if (category !== 'all') {
        filters.category = category;
      }
      
      if (tag !== 'all') {
        filters.tags = [tag];
      }
      
      return await props.workflowStorage.listWorkflows(filters);
    }
  );

  // Load categories and tags for filters
  const [categories] = createResource(async () => {
    const allWorkflows = await props.workflowStorage.listWorkflows();
    const categorySet = new Set<string>();
    allWorkflows.forEach(w => w.category && categorySet.add(w.category));
    return Array.from(categorySet).sort();
  });

  const [tags] = createResource(async () => {
    const allWorkflows = await props.workflowStorage.listWorkflows();
    const tagSet = new Set<string>();
    allWorkflows.forEach(w => w.tags.forEach(tag => tagSet.add(tag)));
    return Array.from(tagSet).sort();
  });

  // Load global templates
  const [globalTemplates] = createResource(
    () => props.workflowStorage.getGlobalTemplates()
  );

  // Computed sorted and filtered workflows
  const sortedWorkflows = () => {
    const workflowList = workflows() || [];
    const sorted = [...workflowList].sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy()) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'created':
          comparison = new Date(a.created).getTime() - new Date(b.created).getTime();
          break;
        case 'modified':
          comparison = new Date(a.modified).getTime() - new Date(b.modified).getTime();
          break;
        case 'executions':
          comparison = a.executionCount - b.executionCount;
          break;
      }
      
      return sortOrder() === 'asc' ? comparison : -comparison;
    });
    
    return sorted;
  };

  // Actions
  const handleWorkflowSelect = async (workflowId: string) => {
    const workflow = await props.workflowStorage.loadWorkflow(workflowId);
    if (workflow) {
      props.onWorkflowSelect(workflow);
    }
  };

  const handleDuplicateWorkflow = async (workflowId: string, originalName: string) => {
    const newName = prompt(`Enter name for duplicate workflow:`, `Copy of ${originalName}`);
    if (newName) {
      const newId = await props.workflowStorage.duplicateWorkflow(workflowId, newName);
      if (newId) {
        refetchWorkflows();
      }
    }
  };

  const handleDeleteWorkflow = async (workflowId: string, name: string) => {
    if (confirm(`Are you sure you want to delete "${name}"?`)) {
      const success = await props.workflowStorage.deleteWorkflow(workflowId);
      if (success) {
        refetchWorkflows();
      }
    }
  };

  const handleExportWorkflow = async (workflowId: string, name: string) => {
    const exported = await props.workflowStorage.exportWorkflow(workflowId);
    if (exported) {
      const blob = new Blob([exported], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${name.replace(/[^a-zA-Z0-9]/g, '-')}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleImportWorkflows = async (event: Event) => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const text = await file.text();
    const result = await props.workflowStorage.importWorkflows(text);
    
    if (result.imported > 0) {
      alert(`Successfully imported ${result.imported} workflows`);
      refetchWorkflows();
    }
    
    if (result.errors.length > 0) {
      alert(`Import completed with errors:\n${result.errors.join('\n')}`);
    }
    
    // Clear input
    input.value = '';
  };

  const handleBulkAction = async (action: string) => {
    const selected = selectedWorkflows();
    if (selected.length === 0) return;

    switch (action) {
      case 'delete':
        if (confirm(`Delete ${selected.length} selected workflows?`)) {
          for (const id of selected) {
            await props.workflowStorage.deleteWorkflow(id);
          }
          setSelectedWorkflows([]);
          refetchWorkflows();
        }
        break;
      
      case 'export':
        const exported = await props.workflowStorage.exportWorkflows(selected);
        if (exported) {
          const blob = new Blob([exported], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `workflows-export-${Date.now()}.json`;
          a.click();
          URL.revokeObjectURL(url);
        }
        break;
    }
  };

  const toggleWorkflowSelection = (workflowId: string) => {
    const current = selectedWorkflows();
    if (current.includes(workflowId)) {
      setSelectedWorkflows(current.filter(id => id !== workflowId));
    } else {
      setSelectedWorkflows([...current, workflowId]);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-50';
      case 'failed': return 'text-red-600 bg-red-50';
      case 'cancelled': return 'text-yellow-600 bg-yellow-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div class="flex flex-col h-full bg-white">
      {/* Header */}
      <div class="flex-shrink-0 border-b border-gray-200 p-4">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2">
            <Folder class="w-6 h-6 text-indigo-600" />
            <h1 class="text-xl font-semibold text-gray-900">My Workflows</h1>
            <span class="text-sm text-gray-500">({sortedWorkflows().length})</span>
          </div>
          
          <div class="flex items-center gap-2">
            <button
              onClick={props.onNewWorkflow}
              class="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            >
              <Plus class="w-4 h-4" />
              New Workflow
            </button>
            
            <label class="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 cursor-pointer">
              <Upload class="w-4 h-4" />
              Import
              <input
                type="file"
                accept=".json"
                class="hidden"
                onChange={handleImportWorkflows}
              />
            </label>
          </div>
        </div>

        {/* Search and Filters */}
        <div class="flex items-center gap-4 mb-4">
          <div class="flex-1 relative">
            <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search workflows..."
              value={searchQuery()}
              onInput={(e) => setSearchQuery(e.target.value)}
              class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          
          <button
            onClick={() => setShowFilters(!showFilters())}
            class={`flex items-center gap-2 px-3 py-2 border rounded-md ${
              showFilters() ? 'bg-indigo-50 border-indigo-300' : 'border-gray-300 hover:bg-gray-50'
            }`}
          >
            <Funnel class="w-4 h-4" />
            Filters
          </button>
          
          <div class="flex items-center border border-gray-300 rounded-md">
            <button
              onClick={() => setViewMode('grid')}
              class={`p-2 ${viewMode() === 'grid' ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
            >
              <Grid class="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              class={`p-2 ${viewMode() === 'list' ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
            >
              <ListIcon class="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter Panel */}
        <Show when={showFilters()}>
          <div class="flex items-center gap-4 p-3 bg-gray-50 rounded-md">
            <div class="flex items-center gap-2">
              <label class="text-sm font-medium text-gray-700">Category:</label>
              <select
                value={selectedCategory()}
                onChange={(e) => setSelectedCategory(e.target.value)}
                class="text-sm border border-gray-300 rounded px-2 py-1"
              >
                <option value="all">All Categories</option>
                <For each={categories()}>
                  {(category) => <option value={category}>{category}</option>}
                </For>
              </select>
            </div>
            
            <div class="flex items-center gap-2">
              <label class="text-sm font-medium text-gray-700">Tag:</label>
              <select
                value={selectedTag()}
                onChange={(e) => setSelectedTag(e.target.value)}
                class="text-sm border border-gray-300 rounded px-2 py-1"
              >
                <option value="all">All Tags</option>
                <For each={tags()}>
                  {(tag) => <option value={tag}>{tag}</option>}
                </For>
              </select>
            </div>
            
            <div class="flex items-center gap-2">
              <label class="text-sm font-medium text-gray-700">Sort:</label>
              <select
                value={sortBy()}
                onChange={(e) => setSortBy(e.target.value as SortBy)}
                class="text-sm border border-gray-300 rounded px-2 py-1"
              >
                <option value="modified">Modified Date</option>
                <option value="name">Name</option>
                <option value="created">Created Date</option>
                <option value="executions">Executions</option>
              </select>
              <button
                onClick={() => setSortOrder(sortOrder() === 'asc' ? 'desc' : 'asc')}
                class="p-1 hover:bg-gray-200 rounded"
              >
                {sortOrder() === 'asc' ? <SortAsc class="w-4 h-4" /> : <SortDesc class="w-4 h-4" />}
              </button>
            </div>
          </div>
        </Show>

        {/* Bulk Actions */}
        <Show when={selectedWorkflows().length > 0}>
          <div class="flex items-center gap-2 p-2 bg-indigo-50 border border-indigo-200 rounded-md mt-2">
            <span class="text-sm text-indigo-800">
              {selectedWorkflows().length} selected
            </span>
            <button
              onClick={() => handleBulkAction('export')}
              class="text-sm px-2 py-1 text-indigo-600 hover:bg-indigo-100 rounded"
            >
              Export
            </button>
            <button
              onClick={() => handleBulkAction('delete')}
              class="text-sm px-2 py-1 text-red-600 hover:bg-red-100 rounded"
            >
              Delete
            </button>
            <button
              onClick={() => setSelectedWorkflows([])}
              class="text-sm px-2 py-1 text-gray-600 hover:bg-gray-100 rounded ml-auto"
            >
              Clear Selection
            </button>
          </div>
        </Show>
      </div>

      {/* Content */}
      <div class="flex-1 overflow-auto p-4">
        <Show
          when={workflows.loading}
          fallback={
            <Show
              when={sortedWorkflows().length > 0}
              fallback={
                <div class="text-center py-12">
                  <FileText class="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 class="text-lg font-medium text-gray-900 mb-2">No workflows found</h3>
                  <p class="text-gray-500 mb-4">
                    {searchQuery() ? 'Try adjusting your search criteria' : 'Get started by creating your first workflow'}
                  </p>
                  <button
                    onClick={props.onNewWorkflow}
                    class="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                  >
                    <Plus class="w-4 h-4" />
                    Create Workflow
                  </button>
                </div>
              }
            >
              <div class={viewMode() === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-2'}>
                <For each={sortedWorkflows()}>
                  {(workflow) => (
                    <WorkflowCard
                      workflow={workflow}
                      viewMode={viewMode()}
                      selected={selectedWorkflows().includes(workflow.id)}
                      onSelect={() => handleWorkflowSelect(workflow.id)}
                      onEdit={() => props.onEditWorkflow(workflow.id)}
                      onExecute={() => props.onExecuteWorkflow(workflow.id)}
                      onDuplicate={() => handleDuplicateWorkflow(workflow.id, workflow.name)}
                      onDelete={() => handleDeleteWorkflow(workflow.id, workflow.name)}
                      onExport={() => handleExportWorkflow(workflow.id, workflow.name)}
                      onToggleSelection={() => toggleWorkflowSelection(workflow.id)}
                      formatDate={formatDate}
                      getStatusColor={getStatusColor}
                    />
                  )}
                </For>
              </div>
            </Show>
          }
        >
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <For each={Array(6).fill(null)}>
              {() => (
                <div class="border border-gray-200 rounded-lg p-4 animate-pulse">
                  <div class="h-4 bg-gray-200 rounded mb-2" />
                  <div class="h-3 bg-gray-200 rounded mb-4" />
                  <div class="flex gap-2">
                    <div class="h-6 bg-gray-200 rounded w-16" />
                    <div class="h-6 bg-gray-200 rounded w-12" />
                  </div>
                </div>
              )}
            </For>
          </div>
        </Show>

        {/* Global Templates Section */}
        <Show when={globalTemplates() && globalTemplates()!.length > 0}>
          <div class="mt-8 border-t pt-6">
            <div class="flex items-center gap-2 mb-4">
              <Globe class="w-5 h-5 text-blue-600" />
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Global Templates</h2>
              <span class="text-sm text-gray-500 dark:text-gray-400">({globalTemplates()!.length})</span>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <For each={globalTemplates()}>
                {(template) => (
                  <div class="border border-blue-200 bg-blue-50 rounded-lg p-4">
                    <div class="flex items-start justify-between mb-2">
                      <h3 class="font-medium text-gray-900">{template.name}</h3>
                      <div class="flex items-center gap-1">
                        <Globe class="w-4 h-4 text-blue-500" />
                        <Star class="w-4 h-4 text-yellow-500" />
                      </div>
                    </div>
                    
                    <p class="text-sm text-gray-600 mb-3">{template.description}</p>
                    
                    <div class="flex flex-wrap gap-1 mb-3">
                      <For each={template.tags.slice(0, 3)}>
                        {(tag) => (
                          <span class="inline-block px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded">
                            {tag}
                          </span>
                        )}
                      </For>
                    </div>
                    
                    <div class="flex items-center justify-between text-xs text-gray-500">
                      <span>{template.nodeCount} nodes</span>
                      <span>by {template.author || 'Unknown'}</span>
                    </div>
                    
                    <button
                      onClick={() => {
                        const name = prompt('Enter name for new workflow:', `${template.name} Copy`);
                        if (name) {
                          props.workflowStorage.createWorkflowFromTemplate(template.id, name)
                            .then(() => refetchWorkflows());
                        }
                      }}
                      class="w-full mt-3 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Use Template
                    </button>
                  </div>
                )}
              </For>
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
}

// Workflow Card Component
function WorkflowCard(props: {
  workflow: WorkflowListItem;
  viewMode: ViewMode;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onExecute: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onExport: () => void;
  onToggleSelection: () => void;
  formatDate: (date: string) => string;
  getStatusColor: (status?: string) => string;
}) {
  const [showMenu, setShowMenu] = createSignal(false);
  
  if (props.viewMode === 'list') {
    return (
      <div class={`flex items-center gap-4 p-3 border rounded-lg hover:shadow-sm ${
        props.selected ? 'border-indigo-300 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'
      }`}>
        <input
          type="checkbox"
          checked={props.selected}
          onChange={props.onToggleSelection}
          class="rounded text-indigo-600"
        />
        
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <h3 class="font-medium text-gray-900 truncate">{props.workflow.name}</h3>
            <Show when={props.workflow.isTemplate}>
              <Star class="w-4 h-4 text-yellow-500" />
            </Show>
          </div>
          <p class="text-sm text-gray-600 truncate">{props.workflow.description}</p>
        </div>
        
        <div class="flex items-center gap-4 text-sm text-gray-500">
          <span>{props.workflow.nodeCount} nodes</span>
          <span>{props.formatDate(props.workflow.modified)}</span>
          <Show when={props.workflow.lastExecutionStatus}>
            <span class={`px-2 py-1 rounded-full text-xs ${props.getStatusColor(props.workflow.lastExecutionStatus)}`}>
              {props.workflow.lastExecutionStatus}
            </span>
          </Show>
        </div>
        
        <div class="flex items-center gap-2">
          <button onClick={props.onExecute} class="p-1 text-green-600 hover:bg-green-50 rounded">
            <Play class="w-4 h-4" />
          </button>
          <button onClick={props.onEdit} class="p-1 text-gray-600 hover:bg-gray-50 rounded">
            <Edit class="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div class={`border rounded-lg p-4 hover:shadow-md transition-shadow ${
      props.selected ? 'border-indigo-300 bg-indigo-50' : 'border-gray-200'
    }`}>
      <div class="flex items-start justify-between mb-2">
        <div class="flex items-center gap-2">
          <input
            type="checkbox"
            checked={props.selected}
            onChange={props.onToggleSelection}
            class="rounded text-indigo-600"
          />
          <h3 class="font-medium text-gray-900 truncate">{props.workflow.name}</h3>
          <Show when={props.workflow.isTemplate}>
            <Star class="w-4 h-4 text-yellow-500" />
          </Show>
        </div>
        
        <div class="relative">
          <button
            onClick={() => setShowMenu(!showMenu())}
            class="p-1 text-gray-400 hover:text-gray-600 rounded"
          >
            <Settings class="w-4 h-4" />
          </button>
          
          <Show when={showMenu()}>
            <div class="absolute right-0 top-8 bg-white border border-gray-200 rounded-md shadow-lg py-1 z-10">
              <button onClick={() => { props.onEdit(); setShowMenu(false); }} 
                      class="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                <Edit class="w-4 h-4 inline mr-2" />Edit
              </button>
              <button onClick={() => { props.onDuplicate(); setShowMenu(false); }} 
                      class="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                <Copy class="w-4 h-4 inline mr-2" />Duplicate
              </button>
              <button onClick={() => { props.onExport(); setShowMenu(false); }} 
                      class="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                <Download class="w-4 h-4 inline mr-2" />Export
              </button>
              <button onClick={() => { props.onDelete(); setShowMenu(false); }} 
                      class="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50">
                <Trash2 class="w-4 h-4 inline mr-2" />Delete
              </button>
            </div>
          </Show>
        </div>
      </div>
      
      <p class="text-sm text-gray-600 mb-3 line-clamp-2">{props.workflow.description}</p>
      
      <div class="flex flex-wrap gap-1 mb-3">
        <For each={props.workflow.tags.slice(0, 3)}>
          {(tag) => (
            <span class="inline-block px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">
              {tag}
            </span>
          )}
        </For>
      </div>
      
      <div class="flex items-center justify-between text-xs text-gray-500 mb-3">
        <span>{props.workflow.nodeCount} nodes • {props.workflow.connectionCount} connections</span>
        <span>{props.workflow.executionCount} runs</span>
      </div>
      
      <Show when={props.workflow.lastExecutionStatus}>
        <div class="flex items-center gap-2 mb-3">
          <span class="text-xs text-gray-500">Last run:</span>
          <span class={`px-2 py-1 rounded-full text-xs ${props.getStatusColor(props.workflow.lastExecutionStatus)}`}>
            {props.workflow.lastExecutionStatus}
          </span>
          <span class="text-xs text-gray-500">{props.formatDate(props.workflow.lastExecuted!)}</span>
        </div>
      </Show>
      
      <div class="flex items-center gap-2">
        <button
          onClick={props.onExecute}
          class="flex-1 flex items-center justify-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700"
        >
          <Play class="w-4 h-4" />
          Run
        </button>
        <button
          onClick={props.onSelect}
          class="flex-1 flex items-center justify-center gap-2 px-3 py-1.5 border border-gray-300 text-gray-700 rounded text-sm hover:bg-gray-50"
        >
          <Eye class="w-4 h-4" />
          Open
        </button>
      </div>
      
      <div class="text-xs text-gray-500 mt-2">
        Modified {props.formatDate(props.workflow.modified)}
      </div>
    </div>
  );
}