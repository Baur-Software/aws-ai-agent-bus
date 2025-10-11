import { For } from 'solid-js';

export function EventsSkeleton() {
  return (
    <div class="animate-pulse">
      {/* Header Skeleton */}
      <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        {/* Context Indicator Skeleton */}
        <div class="mb-3 flex items-center gap-2">
          <div class="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
          <div class="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded-md" />
          <div class="h-4 w-40 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>

        <div class="flex items-center justify-between gap-4">
          {/* Tabs Skeleton */}
          <div class="flex items-center gap-2">
            <div class="h-10 w-32 bg-gray-200 dark:bg-gray-700 rounded-lg" />
            <div class="h-10 w-32 bg-gray-200 dark:bg-gray-700 rounded-lg" />
          </div>

          {/* Connection Status Skeleton */}
          <div class="flex items-center gap-2">
            <div class="h-2 w-2 bg-gray-300 dark:bg-gray-600 rounded-full" />
            <div class="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        </div>

        {/* Search & Filters Skeleton */}
        <div class="mt-4 flex items-center gap-3">
          <div class="flex-1 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg" />
          <div class="h-10 w-32 bg-gray-200 dark:bg-gray-700 rounded-lg" />
          <div class="h-10 w-32 bg-gray-200 dark:bg-gray-700 rounded-lg" />
        </div>
      </div>

      {/* Event List Skeleton */}
      <div class="flex-1 overflow-auto p-6 space-y-3">
        <For each={Array(8).fill(0)}>
          {() => (
            <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <div class="flex items-start justify-between gap-4">
                <div class="flex-1 space-y-2">
                  {/* Event type */}
                  <div class="h-5 w-48 bg-gray-200 dark:bg-gray-700 rounded" />

                  {/* Source */}
                  <div class="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded" />

                  {/* Details */}
                  <div class="space-y-1.5 mt-2">
                    <div class="h-3 w-full bg-gray-200 dark:bg-gray-700 rounded" />
                    <div class="h-3 w-3/4 bg-gray-200 dark:bg-gray-700 rounded" />
                  </div>
                </div>

                <div class="flex flex-col items-end gap-2">
                  {/* Priority badge */}
                  <div class="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded-full" />

                  {/* Timestamp */}
                  <div class="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
                </div>
              </div>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}

export function AnalyticsSkeleton() {
  return (
    <div class="animate-pulse p-6 space-y-6">
      {/* Stats Grid Skeleton */}
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <For each={Array(4).fill(0)}>
          {() => (
            <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <div class="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
              <div class="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
          )}
        </For>
      </div>

      {/* Charts Grid Skeleton */}
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <For each={Array(4).fill(0)}>
          {() => (
            <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              {/* Chart title */}
              <div class="h-5 w-40 bg-gray-200 dark:bg-gray-700 rounded mb-4" />

              {/* Chart bars */}
              <div class="space-y-3">
                <For each={Array(5).fill(0)}>
                  {(_, i) => (
                    <div class="flex items-center gap-3">
                      <div class="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
                      <div
                        class="h-4 bg-gray-200 dark:bg-gray-700 rounded"
                        style={{ width: `${(5 - i()) * 20}%` }}
                       />
                      <div class="h-4 w-12 bg-gray-200 dark:bg-gray-700 rounded ml-auto" />
                    </div>
                  )}
                </For>
              </div>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}
