import { createSignal, createEffect, Show, For } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { MockDataGenerator, mockWorkflowTemplates } from '../mocks';
import { useOrganization } from '../../../contexts/OrganizationContext';
import { useNotifications } from '../../../contexts/NotificationContext';
import { useKVStore } from '../../../contexts/KVStoreContext';
import { usePageHeader } from '../../../contexts/HeaderContext';
import {
  Search,
  Star,
  GitFork,
  Download,
  Eye,
  Users,
  Globe,
  Tag,
  Filter,
  SortAsc,
  SortDesc,
  Sparkles,
  Zap,
  Clock,
  TrendingUp,
  Award,
  X
} from 'lucide-solid';

interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  author: {
    id: string;
    name: string;
    avatar?: string;
    organizationName?: string;
  };
  stats: {
    starCount: number;
    forkCount: number;
    usageCount: number;
    rating: number;
    reviewCount: number;
  };
  metadata: {
    version: string;
    createdAt: string;
    updatedAt: string;
    lastUsed?: string;
    complexity: 'beginner' | 'intermediate' | 'advanced';
    estimatedTime: string; // e.g., "5-10 minutes"
    requiredIntegrations: string[];
  };
  preview: {
    thumbnail?: string;
    nodeCount: number;
    connectionCount: number;
    hasScreenshots: boolean;
  };
  isOfficial: boolean;
  isFeatured: boolean;
  context: 'public' | 'organization' | 'user';
}

interface WorkflowMarketplaceProps {
  onClose?: () => void;
  onSelectTemplate?: (template: WorkflowTemplate) => void;
  organizationContext?: boolean;
}

export default function WorkflowMarketplace(props: WorkflowMarketplaceProps = {}) {
  const [templates, setTemplates] = createSignal<WorkflowTemplate[]>([]);
  const [filteredTemplates, setFilteredTemplates] = createSignal<WorkflowTemplate[]>([]);
  const [searchQuery, setSearchQuery] = createSignal('');
  const [selectedCategory, setSelectedCategory] = createSignal('all');
  const [sortBy, setSortBy] = createSignal<'popular' | 'recent' | 'rating' | 'usage'>('popular');

  const navigate = useNavigate();

  // Set page header when used as standalone page
  if (!props.onClose) {
    usePageHeader('Workflow Templates', 'Discover and use pre-built workflow templates');
  }
  const [showFilters, setShowFilters] = createSignal(false);
  const [selectedComplexity, setSelectedComplexity] = createSignal<string[]>([]);
  const [selectedTags, setSelectedTags] = createSignal<string[]>([]);
  const [loading, setLoading] = createSignal(true);

  const { currentOrganization, user } = useOrganization();
  const { success, error } = useNotifications();
  const kvStore = useKVStore();

  const categories = [
    { id: 'all', name: 'All Templates', icon: Globe },
    { id: 'analytics', name: 'Analytics & Reports', icon: TrendingUp },
    { id: 'automation', name: 'Automation', icon: Zap },
    { id: 'data-processing', name: 'Data Processing', icon: Filter },
    { id: 'notifications', name: 'Notifications', icon: Users },
    { id: 'integrations', name: 'Integrations', icon: Globe },
    { id: 'ai-workflows', name: 'AI Workflows', icon: Sparkles },
    { id: 'official', name: 'Official Templates', icon: Award }
  ];

  const complexityLevels = ['beginner', 'intermediate', 'advanced'];
  const popularTags = ['popular', 'automation', 'analytics', 'ai', 'integration', 'notification', 'data'];

  createEffect(async () => {
    await loadTemplates();
  });

  createEffect(() => {
    const query = searchQuery().toLowerCase();
    const category = selectedCategory();
    const complexity = selectedComplexity();
    const tags = selectedTags();

    let filtered = templates().filter(template => {
      // Search filter
      const matchesSearch = !query ||
        template.name.toLowerCase().includes(query) ||
        template.description.toLowerCase().includes(query) ||
        template.author.name.toLowerCase().includes(query) ||
        template.tags.some(tag => tag.toLowerCase().includes(query));

      // Category filter
      const matchesCategory = category === 'all' ||
        template.category === category ||
        (category === 'official' && template.isOfficial);

      // Complexity filter
      const matchesComplexity = complexity.length === 0 ||
        complexity.includes(template.metadata.complexity);

      // Tags filter
      const matchesTags = tags.length === 0 ||
        tags.some(tag => template.tags.includes(tag));

      return matchesSearch && matchesCategory && matchesComplexity && matchesTags;
    });

    // Sort filtered results
    const sortType = sortBy();
    filtered.sort((a, b) => {
      switch (sortType) {
        case 'popular':
          return (b.stats.starCount + b.stats.forkCount) - (a.stats.starCount + a.stats.forkCount);
        case 'recent':
          return new Date(b.metadata.updatedAt).getTime() - new Date(a.metadata.updatedAt).getTime();
        case 'rating':
          return b.stats.rating - a.stats.rating;
        case 'usage':
          return b.stats.usageCount - a.stats.usageCount;
        default:
          return 0;
      }
    });

    setFilteredTemplates(filtered);
  });

  const loadTemplates = async () => {
    try {
      setLoading(true);

      // Use mock data for now (TODO: implement API endpoint)
      await new Promise(resolve => setTimeout(resolve, 500));
      setTemplates(mockWorkflowTemplates);
      return;

      // Load from API in production (TODO: implement API endpoint)
      const sampleTemplates: WorkflowTemplate[] = [
        {
          id: 'slack-incident-response',
          name: 'Incident Response Workflow',
          description: 'Automated incident detection, notification, and response coordination',
          category: 'automation',
          tags: ['incident', 'slack', 'monitoring', 'automation'],
          author: {
            id: 'user-456',
            name: 'DevOps Team',
            organizationName: 'TechCorp'
          },
          stats: {
            starCount: 180,
            forkCount: 65,
            usageCount: 890,
            rating: 4.6,
            reviewCount: 45
          },
          metadata: {
            version: '1.8.2',
            createdAt: '2024-01-20T09:15:00Z',
            updatedAt: '2024-03-05T11:45:00Z',
            complexity: 'intermediate',
            estimatedTime: '15-20 minutes',
            requiredIntegrations: ['slack', 'monitoring', 'email']
          },
          preview: {
            nodeCount: 15,
            connectionCount: 22,
            hasScreenshots: true
          },
          isOfficial: false,
          isFeatured: true,
          context: 'public'
        },
        {
          id: 'ai-content-generator',
          name: 'AI Content Generation Pipeline',
          description: 'Generate, review, and publish content using AI with human approval workflow',
          category: 'ai-workflows',
          tags: ['ai', 'content', 'automation', 'approval'],
          author: {
            id: 'user-789',
            name: 'Marketing Pro',
            organizationName: 'ContentCorp'
          },
          stats: {
            starCount: 320,
            forkCount: 125,
            usageCount: 1500,
            rating: 4.9,
            reviewCount: 89
          },
          metadata: {
            version: '3.0.1',
            createdAt: '2024-02-01T16:20:00Z',
            updatedAt: '2024-03-10T08:30:00Z',
            complexity: 'advanced',
            estimatedTime: '30-45 minutes',
            requiredIntegrations: ['openai', 'slack', 'cms']
          },
          preview: {
            nodeCount: 25,
            connectionCount: 38,
            hasScreenshots: true
          },
          isOfficial: false,
          isFeatured: true,
          context: 'public'
        }
      ];

      setTemplates(sampleTemplates);
    } catch (err) {
      error(`Failed to load templates: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTemplate = async (template: WorkflowTemplate) => {
    try {
      // Simulate loading template content
      await new Promise(resolve => setTimeout(resolve, 1000));

      success(`Template "${template.name}" loaded successfully!`);

      if (props.onSelectTemplate) {
        // Used as modal - call prop callback
        props.onSelectTemplate(template);
        props.onClose?.();
      } else {
        // Used as standalone page - navigate to workflows with template
        // TODO: Pass template data via route state or create workflow from template
        navigate('/workflows', { state: { template } });
      }
    } catch (err) {
      error(`Failed to load template: ${err.message}`);
    }
  };

  const toggleComplexityFilter = (complexity: string) => {
    setSelectedComplexity(prev =>
      prev.includes(complexity)
        ? prev.filter(c => c !== complexity)
        : [...prev, complexity]
    );
  };

  const toggleTagFilter = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const clearFilters = () => {
    setSelectedComplexity([]);
    setSelectedTags([]);
    setSelectedCategory('all');
    setSearchQuery('');
  };

  return (
    <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-7xl h-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div class="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div class="flex items-center gap-3">
            <Sparkles class="w-6 h-6 text-purple-500" />
            <h2 class="text-2xl font-bold text-gray-900 dark:text-white">
              Workflow Marketplace
            </h2>
            <span class="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs font-medium rounded-full">
              {filteredTemplates().length} templates
            </span>
          </div>
          <button
            onClick={props.onClose}
            class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X class="w-5 h-5" />
          </button>
        </div>

        {/* Search and Filters */}
        <div class="p-6 border-b border-gray-200 dark:border-gray-700 space-y-4">
          {/* Search Bar */}
          <div class="relative">
            <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search templates, authors, or tags..."
              value={searchQuery()}
              onInput={(e) => setSearchQuery(e.currentTarget.value)}
              class="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          {/* Filter Bar */}
          <div class="flex items-center gap-4 flex-wrap">
            {/* Category Filter */}
            <select
              value={selectedCategory()}
              onInput={(e) => setSelectedCategory(e.currentTarget.value)}
              class="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500"
            >
              <For each={categories}>
                {(category) => (
                  <option value={category.id}>{category.name}</option>
                )}
              </For>
            </select>

            {/* Sort Filter */}
            <select
              value={sortBy()}
              onInput={(e) => setSortBy(e.currentTarget.value as any)}
              class="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500"
            >
              <option value="popular">Most Popular</option>
              <option value="recent">Recently Updated</option>
              <option value="rating">Highest Rated</option>
              <option value="usage">Most Used</option>
            </select>

            {/* Advanced Filters Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters())}
              class="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <Filter class="w-4 h-4" />
              <span>Filters</span>
              <Show when={selectedComplexity().length > 0 || selectedTags().length > 0}>
                <span class="w-2 h-2 bg-purple-500 rounded-full" />
              </Show>
            </button>

            {/* Clear Filters */}
            <Show when={selectedComplexity().length > 0 || selectedTags().length > 0 || selectedCategory() !== 'all' || searchQuery()}>
              <button
                onClick={clearFilters}
                class="text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300"
              >
                Clear all
              </button>
            </Show>
          </div>

          {/* Advanced Filters */}
          <Show when={showFilters()}>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              {/* Complexity Filter */}
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Complexity Level
                </label>
                <div class="flex gap-2 flex-wrap">
                  <For each={complexityLevels}>
                    {(complexity) => (
                      <button
                        onClick={() => toggleComplexityFilter(complexity)}
                        class={`px-3 py-1 rounded-full text-sm transition-colors ${
                          selectedComplexity().includes(complexity)
                            ? 'bg-purple-500 text-white'
                            : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'
                        }`}
                      >
                        {complexity}
                      </button>
                    )}
                  </For>
                </div>
              </div>

              {/* Tags Filter */}
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Popular Tags
                </label>
                <div class="flex gap-2 flex-wrap">
                  <For each={popularTags}>
                    {(tag) => (
                      <button
                        onClick={() => toggleTagFilter(tag)}
                        class={`px-3 py-1 rounded-full text-sm transition-colors ${
                          selectedTags().includes(tag)
                            ? 'bg-purple-500 text-white'
                            : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'
                        }`}
                      >
                        #{tag}
                      </button>
                    )}
                  </For>
                </div>
              </div>
            </div>
          </Show>
        </div>

        {/* Templates Grid */}
        <div class="flex-1 overflow-auto p-6">
          <Show
            when={!loading()}
            fallback={
              <div class="flex items-center justify-center h-64">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
              </div>
            }
          >
            <Show
              when={filteredTemplates().length > 0}
              fallback={
                <div class="text-center py-12">
                  <Sparkles class="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p class="text-gray-500 dark:text-gray-400">No templates found matching your filters.</p>
                  <button
                    onClick={clearFilters}
                    class="mt-2 text-purple-600 dark:text-purple-400 hover:underline"
                  >
                    Clear filters to see all templates
                  </button>
                </div>
              }
            >
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <For each={filteredTemplates()}>
                  {(template) => (
                    <div class="bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 p-6 hover:shadow-lg transition-shadow cursor-pointer group">
                      {/* Template Header */}
                      <div class="flex items-start justify-between mb-4">
                        <div class="flex-1">
                          <div class="flex items-center gap-2 mb-2">
                            <h3 class="font-semibold text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400">
                              {template.name}
                            </h3>
                            <Show when={template.isOfficial}>
                              <Award class="w-4 h-4 text-yellow-500" />
                            </Show>
                            <Show when={template.isFeatured}>
                              <Sparkles class="w-4 h-4 text-purple-500" />
                            </Show>
                          </div>
                          <p class="text-sm text-gray-600 dark:text-gray-300 mb-3">
                            {template.description}
                          </p>
                        </div>
                      </div>

                      {/* Template Stats */}
                      <div class="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mb-4">
                        <div class="flex items-center gap-1">
                          <Star class="w-4 h-4" />
                          <span>{template.stats.starCount}</span>
                        </div>
                        <div class="flex items-center gap-1">
                          <GitFork class="w-4 h-4" />
                          <span>{template.stats.forkCount}</span>
                        </div>
                        <div class="flex items-center gap-1">
                          <Eye class="w-4 h-4" />
                          <span>{template.stats.usageCount}</span>
                        </div>
                        <div class="flex items-center gap-1">
                          <span>⭐ {template.stats.rating}</span>
                        </div>
                      </div>

                      {/* Template Meta */}
                      <div class="space-y-2 mb-4">
                        <div class="flex items-center justify-between text-sm">
                          <span class="text-gray-500 dark:text-gray-400">Complexity:</span>
                          <span class={`px-2 py-1 rounded text-xs font-medium ${
                            template.metadata.complexity === 'beginner'
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                              : template.metadata.complexity === 'intermediate'
                              ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                              : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                          }`}>
                            {template.metadata.complexity}
                          </span>
                        </div>
                        <div class="flex items-center justify-between text-sm">
                          <span class="text-gray-500 dark:text-gray-400">Time:</span>
                          <span class="text-gray-700 dark:text-gray-300">{template.metadata.estimatedTime}</span>
                        </div>
                        <div class="flex items-center justify-between text-sm">
                          <span class="text-gray-500 dark:text-gray-400">Nodes:</span>
                          <span class="text-gray-700 dark:text-gray-300">{template.preview.nodeCount}</span>
                        </div>
                      </div>

                      {/* Template Tags */}
                      <div class="flex flex-wrap gap-2 mb-4">
                        <For each={template.tags.slice(0, 3)}>
                          {(tag) => (
                            <span class="px-2 py-1 bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300 text-xs rounded">
                              #{tag}
                            </span>
                          )}
                        </For>
                        <Show when={template.tags.length > 3}>
                          <span class="px-2 py-1 bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300 text-xs rounded">
                            +{template.tags.length - 3}
                          </span>
                        </Show>
                      </div>

                      {/* Author */}
                      <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                          <div class="w-6 h-6 bg-gradient-to-r from-purple-400 to-blue-500 rounded-full flex items-center justify-center text-white text-xs font-medium">
                            {template.author.name.charAt(0)}
                          </div>
                          <span>{template.author.name}</span>
                        </div>
                        <button
                          onClick={() => handleSelectTemplate(template)}
                          class="px-3 py-1 bg-purple-500 hover:bg-purple-600 text-white text-sm rounded-lg transition-colors"
                        >
                          Use Template
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
    </div>
  );
}