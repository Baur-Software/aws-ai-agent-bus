import { createSignal, For, Show } from 'solid-js';

interface ServerFiltersProps {
  searchQuery: string;
  selectedCategory: string;
  selectedVerification: 'all' | 'official' | 'signed' | 'popular';
  sortBy: 'name' | 'downloadCount' | 'lastUpdated' | 'starCount';
  categories: string[];
  serverCount: number;
  totalCount: number;
  onSearch: (query: string) => void;
  onCategoryChange: (category: string) => void;
  onVerificationFilter: (verification: 'all' | 'official' | 'signed' | 'popular') => void;
  onSortChange: (sort: 'name' | 'downloadCount' | 'lastUpdated' | 'starCount') => void;
}

export default function ServerFilters(props: ServerFiltersProps) {
  const [showAdvancedFilters, setShowAdvancedFilters] = createSignal(false);

  const handleSearchInput = (e: Event) => {
    const input = e.target as HTMLInputElement;
    props.onSearch(input.value);
  };

  const handleCategorySelect = (e: Event) => {
    const select = e.target as HTMLSelectElement;
    props.onCategoryChange(select.value);
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
           props.selectedCategory !== 'all' ||
           props.selectedVerification !== 'all';
  };

  const clearAllFilters = () => {
    props.onSearch('');
    props.onCategoryChange('all');
    props.onVerificationFilter('all');
  };

  return (
    <div class="space-y-4">
      {/* Search and Primary Filters */}
      <div class="flex flex-col sm:flex-row gap-4">
        {/* Search Box */}
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

        {/* Category Filter */}
        <div class="sm:w-48">
          <select
            class="block w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={props.selectedCategory}
            onChange={handleCategorySelect}
          >
            <For each={props.categories}>
              {(category) => (
                <option value={category}>
                  {category === 'all' ? 'All Categories' : category}
                </option>
              )}
            </For>
          </select>
        </div>

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
              <option value="signed">Code-signed Only</option>
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
              Clear Filters
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

      {/* Active Filter Tags */}
      <Show when={isFiltered()}>
        <div class="flex flex-wrap gap-2">
          <Show when={props.searchQuery}>
            <span class="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-sm rounded-full">
              Search: "{props.searchQuery}"
              <button
                class="hover:bg-blue-200 dark:hover:bg-blue-800 rounded-full p-0.5"
                onClick={() => props.onSearch('')}
              >
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          </Show>

          <Show when={props.selectedCategory !== 'all'}>
            <span class="inline-flex items-center gap-1 px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-sm rounded-full">
              Category: {props.selectedCategory}
              <button
                class="hover:bg-green-200 dark:hover:bg-green-800 rounded-full p-0.5"
                onClick={() => props.onCategoryChange('all')}
              >
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          </Show>

          <Show when={props.selectedVerification !== 'all'}>
            <span class="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-sm rounded-full">
              {props.selectedVerification === 'official' ? 'Official' :
               props.selectedVerification === 'signed' ? 'Code-signed' : 'Popular'}
              <button
                class="hover:bg-purple-200 dark:hover:bg-purple-800 rounded-full p-0.5"
                onClick={() => props.onVerificationFilter('all')}
              >
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          </Show>
        </div>
      </Show>
    </div>
  );
}