import { createSignal, Show, For, createEffect } from 'solid-js';
import {
  Plus,
  Search,
  Sparkles,
  Star,
  GitFork,
  Eye,
  Clock,
  X,
  Play,
  FileText,
  Zap,
  Users,
  User,
  Link,
  Settings
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
}

interface WorkflowChooserModalProps {
  isOpen: boolean;
  workflows: WorkflowSummary[];
  onClose: () => void;
  onSelectWorkflow: (workflowId: string) => void;
  onCreateNew: () => void;
  onOpenTemplates: () => void;
  loading?: boolean;
}

export default function WorkflowChooserModal(props: WorkflowChooserModalProps) {
  const [searchQuery, setSearchQuery] = createSignal('');
  const [selectedTab, setSelectedTab] = createSignal<'my-workflows' | 'org-workflows' | 'templates' | 'connect-apps'>('my-workflows');

  // Filter workflows based on search and tab
  const filteredWorkflows = () => {
    let workflows = props.workflows || [];
    const query = searchQuery().toLowerCase().trim();

    // Apply search filter
    if (query) {
      workflows = workflows.filter(workflow =>
        workflow.name.toLowerCase().includes(query) ||
        workflow.description?.toLowerCase().includes(query) ||
        workflow.metadata.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Apply tab filter
    switch (selectedTab()) {
      case 'my-workflows':
        return workflows
          .filter(w => w.context === 'user')
          .sort((a, b) => new Date(b.metadata.updatedAt).getTime() - new Date(a.metadata.updatedAt).getTime());
      case 'org-workflows':
        return workflows
          .filter(w => w.context === 'shared')
          .sort((a, b) => new Date(b.metadata.updatedAt).getTime() - new Date(a.metadata.updatedAt).getTime());
      case 'templates':
        // For now, return starred workflows as templates
        return workflows
          .filter(w => w.stats.starCount > 0)
          .sort((a, b) => b.stats.starCount - a.stats.starCount);
      default:
        return workflows.sort((a, b) => new Date(b.metadata.updatedAt).getTime() - new Date(a.metadata.updatedAt).getTime());
    }
  };

  // Get template items for browse templates tab
  const getTemplateItems = () => [
    {
      id: 'data-processing',
      name: 'Data Processing Pipeline',
      description: 'Extract, transform, and load data from various sources',
      category: 'Data & Analytics',
      nodeCount: 8,
      difficulty: 'Intermediate',
      tags: ['data', 'etl', 'analytics']
    },
    {
      id: 'customer-support',
      name: 'AI Customer Support',
      description: 'Automated customer inquiry processing and response',
      category: 'Customer Service',
      nodeCount: 12,
      difficulty: 'Advanced',
      tags: ['ai', 'support', 'automation']
    },
    {
      id: 'content-generation',
      name: 'Content Generation',
      description: 'Generate blog posts, social media content, and marketing copy',
      category: 'Marketing',
      nodeCount: 6,
      difficulty: 'Beginner',
      tags: ['content', 'ai', 'marketing']
    },
    {
      id: 'approval-workflow',
      name: 'Document Approval Flow',
      description: 'Multi-stage approval process for documents and proposals',
      category: 'Business Process',
      nodeCount: 10,
      difficulty: 'Intermediate',
      tags: ['approval', 'documents', 'workflow']
    }
  ];

  // Get integration apps for connect apps tab
  const getIntegrationApps = () => [
    {
      id: 'google-analytics',
      name: 'Google Analytics',
      description: 'Analyze website traffic and user behavior',
      category: 'Analytics',
      icon: '📊',
      connected: true
    },
    {
      id: 'slack',
      name: 'Slack',
      description: 'Send messages and notifications to Slack channels',
      category: 'Communication',
      icon: '💬',
      connected: false
    },
    {
      id: 'github',
      name: 'GitHub',
      description: 'Manage repositories, issues, and pull requests',
      category: 'Development',
      icon: '🐙',
      connected: false
    },
    {
      id: 'airtable',
      name: 'Airtable',
      description: 'Database operations and data management',
      category: 'Database',
      icon: '🗃️',
      connected: false
    },
    {
      id: 'stripe',
      name: 'Stripe',
      description: 'Payment processing and subscription management',
      category: 'Payments',
      icon: '💳',
      connected: false
    },
    {
      id: 'sendgrid',
      name: 'SendGrid',
      description: 'Email delivery and marketing campaigns',
      category: 'Email',
      icon: '📧',
      connected: false
    }
  ];

  // Auto-focus search input when modal opens
  let searchInputRef: HTMLInputElement | undefined;

  createEffect(() => {
    if (props.isOpen && searchInputRef) {
      const timer = setTimeout(() => searchInputRef?.focus(), 100);
      return () => clearTimeout(timer);
    }
  });

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      props.onClose();
    }
  };

  // Add keyboard event listener when modal is open
  createEffect(() => {
    if (props.isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  });

  return (
    <Show when={props.isOpen}>
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        onClick={props.onClose}
      >
        <div
          class="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden border border-gray-200 dark:border-gray-700"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div class="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <div>
              <h2 class="text-2xl font-bold text-gray-900 dark:text-white">Choose a Workflow</h2>
              <p class="text-gray-600 dark:text-gray-400 mt-1">Select an existing workflow or create a new one</p>
            </div>
            <button
              onClick={props.onClose}
              class="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <X class="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Quick Actions */}
          <div class="p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={props.onCreateNew}
                class="flex items-center gap-4 p-4 bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-xl"
              >
                <div class="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                  <Plus class="w-5 h-5" />
                </div>
                <div class="text-left">
                  <div class="font-semibold">Create New Workflow</div>
                  <div class="text-sm opacity-90">Start with a blank canvas</div>
                </div>
              </button>

              <button
                onClick={() => setSelectedTab('templates')}
                class="flex items-center gap-4 p-4 bg-purple-500 hover:bg-purple-600 text-white rounded-xl transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-xl"
              >
                <div class="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                  <Sparkles class="w-5 h-5" />
                </div>
                <div class="text-left">
                  <div class="font-semibold">Browse Templates</div>
                  <div class="text-sm opacity-90">Start from a pre-built template</div>
                </div>
              </button>
            </div>
          </div>

          {/* Search and Tabs */}
          <div class="p-6 border-b border-gray-200 dark:border-gray-700">
            <div class="flex items-center gap-4 mb-4">
              <div class="relative flex-1">
                <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search workflows..."
                  value={searchQuery()}
                  onInput={(e) => setSearchQuery(e.currentTarget.value)}
                  class="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div class="flex gap-2 overflow-x-auto">
              {[
                { id: 'my-workflows', label: 'My Workflows', icon: User },
                { id: 'org-workflows', label: 'Org Workflows', icon: Users },
                { id: 'templates', label: 'Templates', icon: Sparkles },
                { id: 'connect-apps', label: 'Connect Apps', icon: Link }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setSelectedTab(tab.id as any)}
                  class={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 whitespace-nowrap ${
                    selectedTab() === tab.id
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  <tab.icon class="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Content Area */}
          <div class="flex-1 overflow-auto max-h-96">
            <Show
              when={!props.loading}
              fallback={
                <div class="flex items-center justify-center h-64">
                  <div class="flex items-center gap-3">
                    <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
                    <span class="text-gray-600 dark:text-gray-400">Loading...</span>
                  </div>
                </div>
              }
            >
              {/* Workflows Content */}
              <Show when={selectedTab() === 'my-workflows' || selectedTab() === 'org-workflows'}>
                <Show
                  when={filteredWorkflows().length > 0}
                  fallback={
                    <div class="text-center py-12">
                      <div class="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center mx-auto mb-4">
                        {selectedTab() === 'my-workflows' ? <User class="w-8 h-8 text-gray-400" /> : <Users class="w-8 h-8 text-gray-400" />}
                      </div>
                      <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
                        No {selectedTab() === 'my-workflows' ? 'personal' : 'organization'} workflows found
                      </h3>
                      <p class="text-gray-500 dark:text-gray-400 mb-6">
                        {searchQuery() ? 'Try adjusting your search terms.' : `Get started by creating your first ${selectedTab() === 'my-workflows' ? 'personal' : 'organization'} workflow.`}
                      </p>
                      <button
                        onClick={props.onCreateNew}
                        class="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                      >
                        <Plus class="w-4 h-4" />
                        Create Workflow
                      </button>
                    </div>
                  }
                >
                  <div class="p-6">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <For each={filteredWorkflows()}>
                        {(workflow) => (
                          <button
                            onClick={() => props.onSelectWorkflow(workflow.id)}
                            class="text-left p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-lg transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] group"
                          >
                            {/* Workflow Header */}
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

                            {/* Workflow Stats */}
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
                              <div class="flex items-center gap-1">
                                <Zap class="w-3 h-3" />
                                <span>{workflow.metadata.nodeCount} nodes</span>
                              </div>
                            </div>

                            {/* Tags */}
                            <Show when={workflow.metadata.tags.length > 0}>
                              <div class="flex flex-wrap gap-1 mb-3">
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
                            <div class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                              <span>v{workflow.version}</span>
                              <span>{new Date(workflow.metadata.updatedAt).toLocaleDateString()}</span>
                            </div>
                          </button>
                        )}
                      </For>
                    </div>
                  </div>
                </Show>
              </Show>

              {/* Templates Content */}
              <Show when={selectedTab() === 'templates'}>
                <div class="p-6">
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <For each={getTemplateItems()}>
                      {(template) => (
                        <button
                          onClick={props.onOpenTemplates}
                          class="text-left p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-600 hover:shadow-lg transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] group"
                        >
                          <div class="flex items-start justify-between mb-3">
                            <div class="flex-1">
                              <div class="flex items-center gap-2 mb-1">
                                <h3 class="font-semibold text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                                  {template.name}
                                </h3>
                                <span class={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                  template.difficulty === 'Beginner' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' :
                                  template.difficulty === 'Intermediate' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' :
                                  'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                                }`}>
                                  {template.difficulty}
                                </span>
                              </div>
                              <p class="text-sm text-gray-600 dark:text-gray-300 mb-2 line-clamp-2">
                                {template.description}
                              </p>
                              <div class="text-xs text-purple-600 dark:text-purple-400 mb-2">
                                {template.category}
                              </div>
                            </div>
                            <div class="w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center ml-3">
                              <Sparkles class="w-4 h-4 text-purple-600 dark:text-purple-400" />
                            </div>
                          </div>

                          <div class="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mb-3">
                            <div class="flex items-center gap-1">
                              <Zap class="w-3 h-3" />
                              <span>{template.nodeCount} nodes</span>
                            </div>
                          </div>

                          <div class="flex flex-wrap gap-1 mb-3">
                            <For each={template.tags}>
                              {(tag) => (
                                <span class="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 text-xs rounded">
                                  #{tag}
                                </span>
                              )}
                            </For>
                          </div>
                        </button>
                      )}
                    </For>
                  </div>
                </div>
              </Show>

              {/* Connect Apps Content */}
              <Show when={selectedTab() === 'connect-apps'}>
                <div class="p-6">
                  <div class="mb-6">
                    <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">Connect Your Apps</h3>
                    <p class="text-gray-600 dark:text-gray-400 text-sm">Connect external services to unlock more workflow capabilities</p>
                  </div>
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <For each={getIntegrationApps()}>
                      {(app) => (
                        <div class="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all duration-200">
                          <div class="flex items-start justify-between mb-3">
                            <div class="flex items-center gap-3 flex-1">
                              <div class="text-2xl">{app.icon}</div>
                              <div class="flex-1">
                                <div class="flex items-center gap-2 mb-1">
                                  <h3 class="font-semibold text-gray-900 dark:text-white">
                                    {app.name}
                                  </h3>
                                  <Show when={app.connected}>
                                    <span class="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                                      Connected
                                    </span>
                                  </Show>
                                </div>
                                <p class="text-sm text-gray-600 dark:text-gray-300 mb-1">
                                  {app.description}
                                </p>
                                <div class="text-xs text-gray-500 dark:text-gray-400">
                                  {app.category}
                                </div>
                              </div>
                            </div>
                          </div>
                          <div class="flex justify-end">
                            <Show
                              when={app.connected}
                              fallback={
                                <button class="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-lg transition-colors">
                                  Connect
                                </button>
                              }
                            >
                              <button class="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-sm rounded-lg transition-colors">
                                <Settings class="w-3 h-3 inline mr-1" />
                                Configure
                              </button>
                            </Show>
                          </div>
                        </div>
                      )}
                    </For>
                  </div>
                </div>
              </Show>
            </Show>
          </div>
        </div>
      </div>
    </Show>
  );
}