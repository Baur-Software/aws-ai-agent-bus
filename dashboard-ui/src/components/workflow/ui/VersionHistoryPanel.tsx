/**
 * Version History Panel
 * Git-like UI for viewing, comparing, and rolling back workflow versions
 */

import { createSignal, createEffect, Show, For } from 'solid-js';
import { useWorkflow } from '../../../contexts/WorkflowContext';
import { WorkflowVersion } from '../../../services/WorkflowVersioning';
import { History, RotateCcw, GitBranch, FileText, Clock, User } from 'lucide-solid';

export default function VersionHistoryPanel() {
  const workflow = useWorkflow();
  const [versions, setVersions] = createSignal<WorkflowVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = createSignal<number | null>(null);
  const [compareVersion, setCompareVersion] = createSignal<number | null>(null);
  const [diff, setDiff] = createSignal<any>(null);
  const [loading, setLoading] = createSignal(false);

  // Load version history on mount
  createEffect(async () => {
    if (!workflow.currentWorkflow()) return;

    setLoading(true);
    try {
      const history = await workflow.getVersionHistory();
      setVersions(history);
    } catch (err) {
      console.error('Failed to load version history:', err);
    } finally {
      setLoading(false);
    }
  });

  // Calculate diff when compare versions change
  createEffect(async () => {
    const from = compareVersion();
    const to = selectedVersion();

    if (from !== null && to !== null && from !== to) {
      try {
        const diffResult = await workflow.getVersionDiff(from, to);
        setDiff(diffResult);
      } catch (err) {
        console.error('Failed to calculate diff:', err);
        setDiff(null);
      }
    } else {
      setDiff(null);
    }
  });

  const handleRollback = async (version: number) => {
    if (!confirm(`Roll back to version ${version}? This will create a new version as a copy of v${version}.`)) {
      return;
    }

    try {
      await workflow.rollbackToVersion(version);
      // Reload version history
      const history = await workflow.getVersionHistory();
      setVersions(history);
      setSelectedVersion(null);
      setCompareVersion(null);
    } catch (err) {
      console.error('Failed to rollback:', err);
    }
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div class="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div class="flex items-center gap-2 p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <History class="w-5 h-5 text-blue-500" />
        <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Version History</h2>
        <div class="ml-auto text-sm text-gray-500 dark:text-gray-400">
          {versions().length} versions
        </div>
      </div>

      {/* Keyboard shortcuts hint */}
      <div class="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800 text-sm text-blue-700 dark:text-blue-300">
        <span class="font-medium">Shortcuts:</span> Ctrl+Z (Undo) · Ctrl+Y (Redo) · Ctrl+S (Save)
      </div>

      <Show when={loading()}>
        <div class="flex items-center justify-center p-8">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      </Show>

      <Show when={!loading() && versions().length === 0}>
        <div class="flex flex-col items-center justify-center p-8 text-gray-500 dark:text-gray-400">
          <History class="w-12 h-12 mb-4 opacity-50" />
          <p>No version history yet</p>
          <p class="text-sm">Save your workflow to create the first version</p>
        </div>
      </Show>

      <Show when={!loading() && versions().length > 0}>
        <div class="flex-1 overflow-auto">
          {/* Version list */}
          <div class="divide-y divide-gray-200 dark:divide-gray-700">
            <For each={versions()}>
              {(version) => (
                <div
                  class={`p-4 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer transition-colors ${
                    selectedVersion() === version.version
                      ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500'
                      : ''
                  }`}
                  onClick={() => {
                    if (selectedVersion() === version.version) {
                      setSelectedVersion(null);
                    } else {
                      setSelectedVersion(version.version);
                      if (compareVersion() === null && versions().length > 1) {
                        // Auto-select previous version for comparison
                        const currentIndex = versions().findIndex(v => v.version === version.version);
                        if (currentIndex < versions().length - 1) {
                          setCompareVersion(versions()[currentIndex + 1].version);
                        }
                      }
                    }
                  }}
                >
                  <div class="flex items-start gap-3">
                    <GitBranch class="w-5 h-5 mt-1 text-gray-400" />
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2 mb-1">
                        <span class="font-mono text-sm font-semibold text-gray-900 dark:text-gray-100">
                          v{version.version}
                        </span>
                        <span class="text-xs text-gray-500 dark:text-gray-400 font-mono">
                          {version.checksum.slice(0, 8)}
                        </span>
                        <Show when={version.version === versions()[0].version}>
                          <span class="px-2 py-0.5 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full">
                            Latest
                          </span>
                        </Show>
                      </div>

                      <p class="text-sm text-gray-900 dark:text-gray-100 mb-2">
                        {version.metadata.message || version.metadata.name}
                      </p>

                      <div class="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                        <div class="flex items-center gap-1">
                          <User class="w-3 h-3" />
                          <span>{version.metadata.author}</span>
                        </div>
                        <div class="flex items-center gap-1">
                          <Clock class="w-3 h-3" />
                          <span>{formatDate(version.timestamp)}</span>
                        </div>
                        <div class="flex items-center gap-1">
                          <FileText class="w-3 h-3" />
                          <span>{version.nodes.length} nodes</span>
                        </div>
                      </div>

                      <Show when={selectedVersion() === version.version}>
                        <div class="mt-3 flex gap-2">
                          <button
                            class="btn btn-secondary text-xs px-3 py-1 flex items-center gap-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRollback(version.version);
                            }}
                          >
                            <RotateCcw class="w-3 h-3" />
                            Rollback to this version
                          </button>

                          <Show when={versions().length > 1}>
                            <select
                              class="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                              value={compareVersion() || ''}
                              onChange={(e) => {
                                const val = e.currentTarget.value;
                                setCompareVersion(val ? parseInt(val) : null);
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <option value="">Compare with...</option>
                              <For each={versions().filter(v => v.version !== version.version)}>
                                {(v) => <option value={v.version}>v{v.version}</option>}
                              </For>
                            </select>
                          </Show>
                        </div>
                      </Show>
                    </div>
                  </div>

                  {/* Show diff if comparing */}
                  <Show when={selectedVersion() === version.version && diff()}>
                    <div class="mt-4 p-3 bg-gray-100 dark:bg-gray-800 rounded text-xs space-y-2">
                      <div class="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                        Changes from v{compareVersion()} → v{version.version}
                      </div>

                      <Show when={diff()?.nodesAdded?.length > 0}>
                        <div class="text-green-700 dark:text-green-300">
                          + {diff().nodesAdded.length} nodes added
                        </div>
                      </Show>

                      <Show when={diff()?.nodesRemoved?.length > 0}>
                        <div class="text-red-700 dark:text-red-300">
                          - {diff().nodesRemoved.length} nodes removed
                        </div>
                      </Show>

                      <Show when={diff()?.nodesModified?.length > 0}>
                        <div class="text-yellow-700 dark:text-yellow-300">
                          ~ {diff().nodesModified.length} nodes modified
                        </div>
                      </Show>

                      <Show when={diff()?.connectionsAdded?.length > 0}>
                        <div class="text-green-700 dark:text-green-300">
                          + {diff().connectionsAdded.length} connections added
                        </div>
                      </Show>

                      <Show when={diff()?.connectionsRemoved?.length > 0}>
                        <div class="text-red-700 dark:text-red-300">
                          - {diff().connectionsRemoved.length} connections removed
                        </div>
                      </Show>
                    </div>
                  </Show>
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>
    </div>
  );
}
