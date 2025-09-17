import { createSignal, Show } from 'solid-js';
import {
  Play,
  Save,
  Download,
  Upload,
  ChevronLeft,
  RefreshCw,
  Trash2,
  Copy,
  Settings,
  Share,
  History,
  Pause,
  Square,
  GitFork,
  Star,
  Users,
  Globe,
  Tag,
  GitBranch,
  Eye,
  Heart
} from 'lucide-solid';

interface WorkflowToolbarProps {
  onSave: () => void;
  onLoad: (workflow: any) => void;
  onRun: () => void;
  onClear: () => void;
  isExecuting?: boolean;
  workflowName?: string;
  onNameChange?: (name: string) => void;
  onBack?: () => void;
  onShare?: () => void;
  onExport?: () => void;
  onImport?: () => void;
  onHistory?: () => void;
  onSettings?: () => void;
  hasUnsavedChanges?: boolean;
  executionStatus?: 'idle' | 'running' | 'paused' | 'completed' | 'error';

  // GitHub-like versioning and collaboration
  workflowMetadata?: any;
  onFork?: () => void;
  onPublishToOrg?: () => void;
  onCreateVersion?: () => void;
  onStar?: () => void;
  onViewHistory?: () => void;
}

export default function WorkflowToolbar(props: WorkflowToolbarProps) {
  const [isNameEditing, setIsNameEditing] = createSignal(false);
  const [localName, setLocalName] = createSignal(props.workflowName || 'Untitled Workflow');
  const [showDropdown, setShowDropdown] = createSignal(false);

  const handleNameSubmit = () => {
    setIsNameEditing(false);
    props.onNameChange?.(localName());
  };

  const handleNameKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNameSubmit();
    } else if (e.key === 'Escape') {
      setLocalName(props.workflowName || 'Untitled Workflow');
      setIsNameEditing(false);
    }
  };

  const getExecutionIcon = () => {
    switch (props.executionStatus || 'idle') {
      case 'running':
        return <Pause class="w-4 h-4" />;
      case 'paused':
        return <Play class="w-4 h-4" />;
      case 'completed':
        return <RefreshCw class="w-4 h-4" />;
      case 'error':
        return <RefreshCw class="w-4 h-4" />;
      default:
        return <Play class="w-4 h-4" />;
    }
  };

  const getExecutionText = () => {
    switch (props.executionStatus || 'idle') {
      case 'running':
        return 'Pause';
      case 'paused':
        return 'Resume';
      case 'completed':
        return 'Run Again';
      case 'error':
        return 'Retry';
      default:
        return 'Run';
    }
  };

  const getExecutionColor = () => {
    switch (props.executionStatus || 'idle') {
      case 'running':
        return 'bg-yellow-500 hover:bg-yellow-600';
      case 'paused':
        return 'bg-blue-500 hover:bg-blue-600';
      case 'completed':
        return 'bg-green-500 hover:bg-green-600';
      case 'error':
        return 'bg-red-500 hover:bg-red-600';
      default:
        return 'bg-blue-500 hover:bg-blue-600';
    }
  };

  return (
    <div class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
      <div class="flex items-center justify-between">
        {/* Left section - Navigation and Title */}
        <div class="flex items-center gap-4">
          <Show when={props.onBack}>
            <button
              onClick={props.onBack}
              class="flex items-center gap-2 px-3 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="Back to workflows"
            >
              <ChevronLeft class="w-4 h-4" />
              <span class="text-sm font-medium">Back</span>
            </button>
          </Show>

          {/* Workflow Name */}
          <div class="flex items-center gap-2">
            <Show
              when={!isNameEditing()}
              fallback={
                <input
                  type="text"
                  value={localName()}
                  onInput={(e) => setLocalName(e.currentTarget.value)}
                  onBlur={handleNameSubmit}
                  onKeyDown={handleNameKeyDown}
                  class="text-lg font-semibold bg-transparent border border-blue-500 rounded px-2 py-1 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autofocus
                />
              }
            >
              <h1
                class="text-lg font-semibold text-gray-900 dark:text-white cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 px-2 py-1 rounded transition-colors"
                onClick={() => setIsNameEditing(true)}
                title="Click to edit name"
              >
                {props.workflowName || 'Untitled Workflow'}
              </h1>
            </Show>

            <Show when={props.hasUnsavedChanges}>
              <div class="w-2 h-2 bg-orange-500 rounded-full" title="Unsaved changes" />
            </Show>

            {/* GitHub-like Workflow Info */}
            <Show when={props.workflowMetadata}>
              <div class="flex items-center gap-3 ml-4 text-sm text-gray-600 dark:text-gray-400">
                {/* Context Badge */}
                <div class={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                  props.workflowMetadata?.context === 'shared'
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                }`}>
                  {props.workflowMetadata?.context === 'shared' ? (
                    <>
                      <Users class="w-3 h-3" />
                      Shared
                    </>
                  ) : (
                    <>
                      <Eye class="w-3 h-3" />
                      Private
                    </>
                  )}
                </div>

                {/* Version */}
                <div class="flex items-center gap-1">
                  <Tag class="w-3 h-3" />
                  v{props.workflowMetadata?.version || '1.0.0'}
                </div>

                {/* Stars */}
                <div class="flex items-center gap-1">
                  <Star class="w-3 h-3" />
                  {props.workflowMetadata?.stats?.starCount || 0}
                </div>

                {/* Forks */}
                <div class="flex items-center gap-1">
                  <GitFork class="w-3 h-3" />
                  {props.workflowMetadata?.stats?.forkCount || 0}
                </div>

                {/* Fork indicator */}
                <Show when={props.workflowMetadata?.forkedFrom}>
                  <div class="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
                    <GitBranch class="w-3 h-3" />
                    forked from {props.workflowMetadata?.forkedFrom?.originalAuthor}
                  </div>
                </Show>
              </div>
            </Show>

            <Show when={props.executionStatus === 'running'}>
              <div class="flex items-center gap-1 text-xs text-yellow-600 dark:text-yellow-400">
                <div class="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                Running...
              </div>
            </Show>

            <Show when={props.executionStatus === 'completed'}>
              <div class="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                <div class="w-2 h-2 bg-green-500 rounded-full" />
                Completed
              </div>
            </Show>

            <Show when={props.executionStatus === 'error'}>
              <div class="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                <div class="w-2 h-2 bg-red-500 rounded-full" />
                Error
              </div>
            </Show>
          </div>
        </div>

        {/* Center section - Main Actions */}
        <div class="flex items-center gap-2">
          {/* Run/Pause Button */}
          <button
            onClick={props.onRun}
            disabled={props.isExecuting}
            class={`flex items-center gap-2 px-4 py-2 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${getExecutionColor()}`}
            title={getExecutionText()}
          >
            {getExecutionIcon()}
            <span>{getExecutionText()}</span>
          </button>

          {/* Stop Button (when running) */}
          <Show when={props.executionStatus === 'running' || props.executionStatus === 'paused'}>
            <button
              onClick={() => {/* TODO: Implement stop */}}
              class="flex items-center gap-2 px-3 py-2 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              title="Stop execution"
            >
              <Square class="w-4 h-4" />
            </button>
          </Show>

          {/* Save Button */}
          <button
            onClick={props.onSave}
            class="flex items-center gap-2 px-3 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="Save workflow"
          >
            <Save class="w-4 h-4" />
            <span class="text-sm font-medium">Save</span>
          </button>
        </div>

        {/* Right section - Secondary Actions */}
        <div class="flex items-center gap-2">
          {/* Import Button */}
          <Show when={props.onImport}>
            <button
              onClick={props.onImport}
              class="flex items-center gap-2 px-3 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="Import workflow"
            >
              <Upload class="w-4 h-4" />
            </button>
          </Show>

          {/* Export Button */}
          <Show when={props.onExport}>
            <button
              onClick={props.onExport}
              class="flex items-center gap-2 px-3 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="Export workflow"
            >
              <Download class="w-4 h-4" />
            </button>
          </Show>

          {/* History Button */}
          <Show when={props.onHistory}>
            <button
              onClick={props.onHistory}
              class="flex items-center gap-2 px-3 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="View history"
            >
              <History class="w-4 h-4" />
            </button>
          </Show>

          {/* Share Button */}
          <Show when={props.onShare}>
            <button
              onClick={props.onShare}
              class="flex items-center gap-2 px-3 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="Share workflow"
            >
              <Share class="w-4 h-4" />
            </button>
          </Show>

          {/* GitHub-like Actions */}
          <Show when={props.workflowMetadata}>
            {/* Star Button */}
            <button
              onClick={props.onStar}
              class="flex items-center gap-2 px-3 py-2 text-gray-600 dark:text-gray-400 hover:text-yellow-600 dark:hover:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded-lg transition-colors"
              title="Star this workflow"
            >
              <Star class={`w-4 h-4 ${props.workflowMetadata?.stats?.starCount > 0 ? 'fill-yellow-400 text-yellow-400' : ''}`} />
              <span class="text-sm font-medium">{props.workflowMetadata?.stats?.starCount || 0}</span>
            </button>

            {/* Fork Button */}
            <button
              onClick={props.onFork}
              class="flex items-center gap-2 px-3 py-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
              title="Fork this workflow"
            >
              <GitFork class="w-4 h-4" />
              <span class="text-sm font-medium">Fork</span>
            </button>

            {/* Publish to Org Button */}
            <Show when={props.workflowMetadata?.context === 'user'}>
              <button
                onClick={props.onPublishToOrg}
                class="flex items-center gap-2 px-3 py-2 text-gray-600 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                title="Publish to organization"
              >
                <Globe class="w-4 h-4" />
                <span class="text-sm font-medium">Publish</span>
              </button>
            </Show>

            {/* Create Version Button */}
            <button
              onClick={props.onCreateVersion}
              class="flex items-center gap-2 px-3 py-2 text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors"
              title="Create new version"
            >
              <Tag class="w-4 h-4" />
              <span class="text-sm font-medium">Version</span>
            </button>
          </Show>

          {/* More Actions Dropdown */}
          <div class="relative">
            <button
              onClick={() => setShowDropdown(!showDropdown())}
              class="flex items-center gap-2 px-3 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="More actions"
            >
              <Settings class="w-4 h-4" />
            </button>

            <Show when={showDropdown()}>
              <div class="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
                <div class="py-1">
                  <Show when={props.onSettings}>
                    <button
                      onClick={() => {
                        props.onSettings?.();
                        setShowDropdown(false);
                      }}
                      class="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                    >
                      <Settings class="w-4 h-4" />
                      Workflow Settings
                    </button>
                  </Show>

                  <Show when={props.onViewHistory}>
                    <button
                      onClick={() => {
                        props.onViewHistory?.();
                        setShowDropdown(false);
                      }}
                      class="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                    >
                      <History class="w-4 h-4" />
                      Version History
                    </button>
                  </Show>

                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(window.location.href);
                      setShowDropdown(false);
                    }}
                    class="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                  >
                    <Copy class="w-4 h-4" />
                    Copy Link
                  </button>

                  <hr class="my-1 border-gray-200 dark:border-gray-600" />

                  <button
                    onClick={() => {
                      if (confirm('Are you sure you want to clear this workflow? This action cannot be undone.')) {
                        props.onClear();
                        setShowDropdown(false);
                      }
                    }}
                    class="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                  >
                    <Trash2 class="w-4 h-4" />
                    Clear Workflow
                  </button>
                </div>
              </div>
            </Show>
          </div>
        </div>
      </div>

      {/* Click outside to close dropdown */}
      <Show when={showDropdown()}>
        <div
          class="fixed inset-0 z-40"
          onClick={() => setShowDropdown(false)}
        />
      </Show>
    </div>
  );
}