export default function ServerCatalogSkeleton() {
  return (
    <div class="max-w-7xl mx-auto p-6">
      {/* Filters Skeleton */}
      <div class="space-y-4 mb-6">
        <div class="flex flex-col sm:flex-row gap-4">
          {/* Search Box Skeleton */}
          <div class="flex-1">
            <div class="h-10 bg-slate-200 dark:bg-slate-700 rounded-md animate-pulse" />
          </div>

          {/* Category Filter Skeleton */}
          <div class="sm:w-48">
            <div class="h-10 bg-slate-200 dark:bg-slate-700 rounded-md animate-pulse" />
          </div>

          {/* Filters Button Skeleton */}
          <div class="sm:w-24">
            <div class="h-10 bg-slate-200 dark:bg-slate-700 rounded-md animate-pulse" />
          </div>
        </div>

        {/* Results Summary Skeleton */}
        <div class="flex justify-between">
          <div class="h-5 w-32 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
          <div class="h-5 w-24 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
        </div>
      </div>

      {/* Server Cards Skeleton */}
      <div class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {Array.from({ length: 9 }).map((_, index) => (
          <div
            class="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 animate-pulse"
          >
            {/* Header */}
            <div class="p-6 pb-4">
              <div class="flex items-start justify-between mb-3">
                <div class="flex items-center gap-3 flex-1">
                  {/* Icon */}
                  <div class="w-10 h-10 rounded-lg bg-slate-200 dark:bg-slate-700" />

                  <div class="flex-1">
                    {/* Title and badges */}
                    <div class="flex items-center gap-2 mb-2">
                      <div class="h-6 w-32 bg-slate-200 dark:bg-slate-700 rounded" />
                      <div class="h-5 w-16 bg-slate-200 dark:bg-slate-700 rounded-full" />
                      <div class="h-5 w-14 bg-slate-200 dark:bg-slate-700 rounded-full" />
                    </div>

                    {/* Description */}
                    <div class="space-y-2">
                      <div class="h-4 w-full bg-slate-200 dark:bg-slate-700 rounded" />
                      <div class="h-4 w-3/4 bg-slate-200 dark:bg-slate-700 rounded" />
                    </div>
                  </div>
                </div>

                {/* Connection Button */}
                <div class="w-20 h-8 bg-slate-200 dark:bg-slate-700 rounded" />
              </div>

              {/* Publisher and Version */}
              <div class="flex items-center gap-4 mb-4">
                <div class="h-4 w-20 bg-slate-200 dark:bg-slate-700 rounded" />
                <div class="h-4 w-16 bg-slate-200 dark:bg-slate-700 rounded" />
                <div class="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
              </div>

              {/* Capabilities Tags */}
              <div class="flex flex-wrap gap-1">
                <div class="h-6 w-16 bg-slate-200 dark:bg-slate-700 rounded-md" />
                <div class="h-6 w-20 bg-slate-200 dark:bg-slate-700 rounded-md" />
                <div class="h-6 w-14 bg-slate-200 dark:bg-slate-700 rounded-md" />
                <div class="h-6 w-18 bg-slate-200 dark:bg-slate-700 rounded-md" />
              </div>
            </div>

            {/* Metrics */}
            <div class="px-6 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-4">
                  <div class="h-4 w-8 bg-slate-200 dark:bg-slate-700 rounded" />
                  <div class="h-4 w-8 bg-slate-200 dark:bg-slate-700 rounded" />
                  <div class="h-4 w-12 bg-slate-200 dark:bg-slate-700 rounded" />
                </div>
                <div class="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
              </div>
            </div>

            {/* Action Buttons */}
            <div class="px-6 py-4 border-t border-slate-200 dark:border-slate-700">
              <div class="flex items-center justify-between">
                <div class="h-5 w-20 bg-slate-200 dark:bg-slate-700 rounded" />
                <div class="flex gap-2">
                  <div class="h-8 w-16 bg-slate-200 dark:bg-slate-700 rounded" />
                  <div class="h-8 w-16 bg-slate-200 dark:bg-slate-700 rounded" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}