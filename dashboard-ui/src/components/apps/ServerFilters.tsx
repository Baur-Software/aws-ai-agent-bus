import { createSignal, For, Show } from 'solid-js';

interface ServerFiltersProps {
  searchQuery: string;
  selectedTags: Set<string>;
  tagSearchQuery: string;
  filteredTags: string[];
  popularTags: string[];
  selectedVerification: 'all' | 'official' | 'popular';
  sortBy: 'name' | 'downloadCount' | 'lastUpdated' | 'starCount';
  showOnlyFeatured: boolean;
  serverCount: number;
  totalCount: number;
  onSearch: (query: string) => void;
  onToggleTag: (tag: string) => void;
  onClearTags: () => void;
  onTagSearch: (query: string) => void;
  onVerificationFilter: (verification: 'all' | 'official' | 'popular') => void;
  onSortChange: (sort: 'name' | 'downloadCount' | 'lastUpdated' | 'starCount') => void;
  onToggleFeatured: (featured: boolean) => void;
}

export default function ServerFilters(props: ServerFiltersProps) {
  const [showAdvancedFilters, setShowAdvancedFilters] = createSignal(false);
  const [showTagSearch, setShowTagSearch] = createSignal(false);

  const handleSearchInput = (e: Event) => {
    const input = e.target as HTMLInputElement;
    props.onSearch(input.value);
  };

  const handleTagSearchInput = (e: Event) => {
    const input = e.target as HTMLInputElement;
    props.onTagSearch(input.value);
  };

  const handleVerificationSelect = (e: Event) => {
    const select = e.target as HTMLSelectElement;
    props.onVerificationFilter(select.value as any);
  };

  const handleSortSelect = (e: Event) => {
    const select = e.target as HTMLSelectElement;
    props.onSortChange(select.value as any);
  };

  const isFiltered = () => {
    return props.searchQuery !== '' ||
           props.selectedTags.size > 0 ||
           props.selectedVerification !== 'all' ||
           props.showOnlyFeatured;
  };

  const clearAllFilters = () => {
    props.onSearch('');
    props.onClearTags();
    props.onVerificationFilter('all');
    props.onToggleFeatured(false);
  };

  return (
    <div class="space-y-4">
      {/* Search Box */}
      <div class="flex flex-col sm:flex-row gap-4">
        <div class="flex-1">
          <div class="relative">
            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg class="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="search"
              placeholder="Search servers, publishers, or capabilities..."
              class="block w-full pl-10 pr-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md leading-5 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={props.searchQuery}
              onInput={handleSearchInput}
            />
            <Show when={props.searchQuery}>
              <button type="button"
                class="absolute inset-y-0 right-0 pr-3 flex items-center"
                onClick={() => props.onSearch('')}
              >
                <svg class="h-5 w-5 text-slate-400 hover:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </Show>
          </div>
        </div>

        {/* Featured Toggle */}
        <button
          class={`px-4 py-2 rounded-md font-medium transition-colors ${
            props.showOnlyFeatured
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'
          }`}
          onClick={() => props.onToggleFeatured(!props.showOnlyFeatured)}
        >
          <svg class="w-5 h-5 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Featured
        </button>

        {/* Advanced Filters Toggle */}
        <button
          class="btn btn-outline sm:w-auto"
          onClick={() => setShowAdvancedFilters(!showAdvancedFilters())}
        >
          <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
          </svg>
          Filters
          <Show when={isFiltered()}>
            <span class="ml-1 px-1.5 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full">
              Active
            </span>
          </Show>
        </button>
      </div>

      {/* Category Tag Buttons Row */}
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-medium text-slate-700 dark:text-slate-300">Filter by Tags</h3>
          <button
            class="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
            onClick={() => setShowTagSearch(!showTagSearch())}
          >
            {showTagSearch() ? 'Hide search' : '+ Add custom tag'}
          </button>
        </div>

        {/* Popular Tag Buttons */}
        <div class="flex flex-wrap gap-2">
          <For each={props.popularTags}>
            {(tag) => (
              <button
                class={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  props.selectedTags.has(tag)
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600'
                }`}
                onClick={() => props.onToggleTag(tag)}
              >
                {tag}
              </button>
            )}
          </For>

          {/* Show selected non-popular tags */}
          <For each={Array.from(props.selectedTags).filter(tag => !props.popularTags.includes(tag))}>
            {(tag) => (
              <button
                class="px-3 py-1.5 rounded-full text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                onClick={() => props.onToggleTag(tag)}
              >
                {tag}
                <svg class="w-4 h-4 ml-1 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </For>

          <Show when={props.selectedTags.size > 0}>
            <button
              class="px-3 py-1.5 rounded-full text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              onClick={props.onClearTags}
            >
              Clear tags
            </button>
          </Show>
        </div>

        {/* Tag Search Input */}
        <Show when={showTagSearch()}>
          <div class="relative">
            <input
              type="text"
              placeholder="Search for tags..."
              class="block w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={props.tagSearchQuery}
              onInput={handleTagSearchInput}
            />
            <Show when={props.filteredTags.length > 0}>
              <div class="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md shadow-lg max-h-60 overflow-auto">
                <For each={props.filteredTags}>
                  {(tag) => (
                    <button
                      class="w-full px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                      onClick={() => {
                        props.onToggleTag(tag);
                        props.onTagSearch('');
                      }}
                    >
                      {tag}
                    </button>
                  )}
                </For>
              </div>
            </Show>
          </div>
        </Show>
      </div>

      {/* Advanced Filters */}
      <Show when={showAdvancedFilters()}>
        <div class="flex flex-col sm:flex-row gap-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700">
          {/* Verification Filter */}
          <div class="flex-1">
            <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Verification Status
            </label>
            <select
              class="block w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={props.selectedVerification}
              onChange={handleVerificationSelect}
            >
              <option value="all">All Servers</option>
              <option value="official">Official Only</option>
              <option value="popular">Popular Only</option>
            </select>
          </div>

          {/* Sort By */}
          <div class="flex-1">
            <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Sort By
            </label>
            <select
              class="block w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={props.sortBy}
              onChange={handleSortSelect}
            >
              <option value="downloadCount">Most Downloaded</option>
              <option value="starCount">Most Starred</option>
              <option value="lastUpdated">Recently Updated</option>
              <option value="name">Name (A-Z)</option>
            </select>
          </div>

          {/* Clear Filters */}
          <div class="flex-shrink-0 flex items-end">
            <button
              class="btn btn-secondary h-10"
              onClick={clearAllFilters}
              disabled={!isFiltered()}
            >
              Clear All
            </button>
          </div>
        </div>
      </Show>

      {/* Results Summary */}
      <div class="flex items-center justify-between text-sm text-slate-600 dark:text-slate-400">
        <div>
          <Show when={isFiltered()} fallback={
            <span>Showing all {props.totalCount} servers</span>
          }>
            <span>
              Showing {props.serverCount} of {props.totalCount} servers
            </span>
          </Show>
        </div>

        <Show when={isFiltered()}>
          <button
            class="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
            onClick={clearAllFilters}
          >
            Clear all filters
          </button>
        </Show>
      </div>
    </div>
  );
}