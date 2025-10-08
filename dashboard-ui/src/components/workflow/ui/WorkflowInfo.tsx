import { createSignal, Show, onMount } from 'solid-js';
import {
  Edit3,
  Check,
  X,
  Star,
  GitFork,
  Eye,
  Calendar,
  Clock,
  User,
  Tag
} from 'lucide-solid';

interface WorkflowInfoProps {
  currentWorkflow: {
    id: string;
    name: string;
    description?: string;
    version?: string;
    stats?: {
      starCount: number;
      forkCount: number;
      usageCount: number;
    };
    metadata?: {
      createdAt: string;
      updatedAt: string;
      createdBy: string;
      nodeCount: number;
      tags?: string[];
    };
    forkedFrom?: {
      originalAuthor: string;
      workflowId: string;
    };
  };
  onRename?: (newName: string) => void;
  onEditRef?: (editFn: () => void) => void; // Callback to expose edit function to parent
  class?: string;
}

export default function WorkflowInfo(props: WorkflowInfoProps) {
  const [isEditing, setIsEditing] = createSignal(false);
  const [editName, setEditName] = createSignal('');

  const handleStartEdit = () => {
    setEditName(props.currentWorkflow?.name || '');
    setIsEditing(true);
  };

  // Expose edit function to parent on mount
  onMount(() => {
    props.onEditRef?.(handleStartEdit);
  });

  const handleSaveEdit = () => {
    const newName = editName().trim();
    if (newName && newName !== props.currentWorkflow?.name) {
      props.onRename?.(newName);
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditName('');
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return 'Unknown';
    }
  };

  const formatRelativeTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays === 0) return 'Today';
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays} days ago`;
      if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
      return formatDate(dateStr);
    } catch {
      return 'Unknown';
    }
  };

  return (
    <Show when={props.currentWorkflow}>
      <div class={`bg-white/90 dark:bg-gray-800/90 border border-gray-200/50 dark:border-gray-600/50 rounded-lg p-3 min-w-[300px] max-w-[400px] ${props.class || ''}`}>
        {/* Workflow Name & Edit */}
        <div class="flex items-center gap-2 mb-2">
          <Show when={!isEditing()}>
            <div class="flex items-center gap-2 flex-1 min-w-0">
              <h3 class="font-semibold text-gray-900 dark:text-white text-sm truncate">
                {props.currentWorkflow?.name || 'Untitled Workflow'}
              </h3>
              <button
                onClick={handleStartEdit}
                class="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-sm transition-colors flex-shrink-0"
                title="Rename workflow"
              >
                <Edit3 class="w-3 h-3 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
          </Show>

          <Show when={isEditing()}>
            <div class="flex items-center gap-1 flex-1">
              <input
                type="text"
                value={editName()}
                onInput={(e) => setEditName(e.currentTarget.value)}
                onKeyDown={handleKeyDown}
                class="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                placeholder="Workflow name"
                autofocus
              />
              <button
                onClick={handleSaveEdit}
                class="p-1 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-sm transition-colors"
                title="Save"
              >
                <Check class="w-3 h-3 text-green-600 dark:text-green-400" />
              </button>
              <button
                onClick={handleCancelEdit}
                class="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-sm transition-colors"
                title="Cancel"
              >
                <X class="w-3 h-3 text-red-600 dark:text-red-400" />
              </button>
            </div>
          </Show>
        </div>

        {/* Version & Stats */}
        <div class="flex items-center gap-3 mb-2 text-xs text-gray-600 dark:text-gray-400">
          <span class="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">
            v{props.currentWorkflow?.version || '1.0.0'}
          </span>

          <div class="flex items-center gap-1">
            <Star class="w-3 h-3" />
            <span>{props.currentWorkflow?.stats?.starCount || 0}</span>
          </div>

          <div class="flex items-center gap-1">
            <GitFork class="w-3 h-3" />
            <span>{props.currentWorkflow?.stats?.forkCount || 0}</span>
          </div>

          <div class="flex items-center gap-1">
            <Eye class="w-3 h-3" />
            <span>{props.currentWorkflow?.stats?.usageCount || 0}</span>
          </div>
        </div>

        {/* Description */}
        <Show when={props.currentWorkflow?.description}>
          <p class="text-xs text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
            {props.currentWorkflow?.description}
          </p>
        </Show>

        {/* Forked From */}
        <Show when={props.currentWorkflow?.forkedFrom}>
          <div class="text-xs text-gray-500 dark:text-gray-500 mb-2">
            <span>Forked from </span>
            <span class="text-blue-600 dark:text-blue-400 font-medium">
              {props.currentWorkflow?.forkedFrom?.originalAuthor}/{props.currentWorkflow?.forkedFrom?.workflowId}
            </span>
          </div>
        </Show>

        {/* Metadata Row 1 */}
        <div class="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-500 mb-1">
          <div class="flex items-center gap-1">
            <User class="w-3 h-3" />
            <span>{props.currentWorkflow?.metadata?.createdBy || 'Unknown'}</span>
          </div>

          <div class="flex items-center gap-1">
            <Calendar class="w-3 h-3" />
            <span>{formatDate(props.currentWorkflow?.metadata?.createdAt || '')}</span>
          </div>
        </div>

        {/* Metadata Row 2 */}
        <div class="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-500">
          <div class="flex items-center gap-1">
            <Clock class="w-3 h-3" />
            <span>Updated {formatRelativeTime(props.currentWorkflow?.metadata?.updatedAt || '')}</span>
          </div>

          <div class="flex items-center gap-1">
            <Tag class="w-3 h-3" />
            <span>{props.currentWorkflow?.metadata?.nodeCount || 0} nodes</span>
          </div>
        </div>

        {/* Tags */}
        <Show when={props.currentWorkflow?.metadata?.tags?.length}>
          <div class="flex flex-wrap gap-1 mt-2">
            {props.currentWorkflow?.metadata?.tags?.slice(0, 3).map((tag) => (
              <span
                class="inline-block bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs px-2 py-0.5 rounded-full"
              >
                {tag}
              </span>
            ))}
            <Show when={(props.currentWorkflow?.metadata?.tags?.length || 0) > 3}>
              <span class="text-xs text-gray-500 dark:text-gray-500">
                +{(props.currentWorkflow?.metadata?.tags?.length || 0) - 3} more
              </span>
            </Show>
          </div>
        </Show>
      </div>
    </Show>
  );
}