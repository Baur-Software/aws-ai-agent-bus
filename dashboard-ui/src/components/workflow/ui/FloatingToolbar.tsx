import { createSignal, createEffect, Show } from 'solid-js';
import {
  Play,
  Square,
  Save,
  Upload,
  Download,
  Undo,
  Redo,
  ZoomIn,
  ZoomOut,
  Grid,
  Share,
  Settings,
  ArrowLeft,
  Grid3x3,
  MoreHorizontal,
  FolderOpen,
  Blocks,
  MessageCircle,
  Sun,
  Moon,
  Ellipsis,
  Hand
} from 'lucide-solid';

import { useFloatingPanel } from '../../../hooks/useFloatingPanel';
import { useKVStore } from '../../../contexts/KVStoreContext';
import { useOrganization } from '../../../contexts/OrganizationContext';
import { useTheme } from '../../../contexts/ThemeContext';
import ActionButton from './ActionButton';
import ToolbarControls from './ToolbarControls';
import WorkflowInfo from './WorkflowInfo';

interface WorkflowSummary {
  id: string;
  name: string;
  description?: string;
  version?: string;
  metadata?: {
    nodeCount?: number;
    updatedAt?: string;
  };
}

interface FloatingToolbarProps {
  // Actions
  onSave: () => void;
  onLoad: () => void;
  onRun: () => void;
  onClear: () => void;
  onBack?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onToggleGrid?: () => void;
  onToggleGridOff?: () => void;
  onToggleNodesPanel?: () => void;
  isNodesPanelVisible?: boolean;
  onToggleAgentChat?: () => void;
  isAgentChatVisible?: boolean;
  onShare?: () => void;
  onSettings?: () => void;
  onBrowseWorkflows?: () => void;
  onTogglePanMode?: () => void;

  // State
  hasUnsavedChanges?: boolean;
  isExecuting?: boolean;
  canUndo?: boolean;
  canRedo?: boolean;
  gridMode?: 'off' | 'grid' | 'dots';
  isPanMode?: boolean;
  nodeCount?: number;
  useMockData?: boolean;
  onToggleMockData?: () => void;

  // Auto-save
  autoSaveEnabled?: boolean;
  onToggleAutoSave?: () => void;
  isSaving?: boolean;
  lastSaved?: Date | null;

  // Position
  onPositionChange?: (x: number, y: number) => void;
  onPinnedChange?: (isPinned: boolean) => void;
  initialPosition?: { x: number; y: number };
  initialPinned?: boolean;
  navigationPinned?: boolean;

  // Workflow info
  currentWorkflow: WorkflowSummary;
  onWorkflowRename?: (newName: string) => void;
}

export default function FloatingToolbar(props: FloatingToolbarProps) {
  // Dependencies
  const kvStore = useKVStore();
  const { user } = useOrganization();
  const { toggleTheme, isDark } = useTheme();

  // Compact mode state
  const [isCompact, setIsCompact] = createSignal(true);

  // Workflow edit function ref
  let triggerWorkflowEdit: (() => void) | null = null;

  // Load toolbar preferences from KV store
  const loadToolbarPreferences = async () => {
    try {
      const currentUser = user();
      if (!currentUser) return;

      const savedPrefs = await kvStore.get(`user-${currentUser.id}-toolbar-preferences`);
      if (savedPrefs?.value) {
        const prefs = JSON.parse(savedPrefs.value);
        if (prefs.compact !== undefined) {
          setIsCompact(prefs.compact);
        }
      }
    } catch (err) {
      console.warn('Failed to load toolbar preferences:', err);
    }
  };

  // Save toolbar preferences to KV store
  const saveToolbarPreferences = async () => {
    try {
      const currentUser = user();
      if (!currentUser) return;

      await kvStore.set(
        `user-${currentUser.id}-toolbar-preferences`,
        JSON.stringify({
          compact: isCompact()
        }),
        24 * 7 // 1 week TTL
      );
    } catch (err) {
      console.warn('Failed to save toolbar preferences:', err);
    }
  };

  // Load preferences on mount
  createEffect(() => {
    loadToolbarPreferences();
  });

  // Calculate proper centered position
  const getCenteredPosition = () => {
    const navWidth = props.navigationPinned ? 64 : 0;
    const availableWidth = window.innerWidth - navWidth;
    // Since we use translateX(-50%), the x position should be the center of available width
    return {
      x: navWidth + (availableWidth / 2),
      y: 20
    };
  };

  // Use the composable floating panel hook
  const [panelState, panelHandlers] = useFloatingPanel({
    initialPosition: props.initialPosition || getCenteredPosition(),
    initialPinned: props.initialPinned ?? true,
    initialVisible: true,
    onPositionChange: props.onPositionChange,
    onPinnedChange: props.onPinnedChange,
    minWidth: 600,
    maxConstraints: {
      navigationWidth: props.navigationPinned ? 64 : 0,
      accountForNavigation: true
    }
  });

  // Override the pin handler to use proper centered positioning for toolbar
  const handleToolbarPin = () => {
    const willBePinned = !panelState.isPinned();
    panelState.setIsPinned(willBePinned);

    if (willBePinned) {
      // When pinning, center the toolbar
      panelState.setPosition(getCenteredPosition());
    } else {
      // When unpinning, use a default floating position
      const navWidth = props.navigationPinned ? 64 : 0;
      panelState.setPosition({
        x: navWidth + 20,
        y: 80
      });
    }
  };

  // Grid state helpers
  const getGridIcon = () => {
    switch (props.gridMode) {
      case 'grid':
        return Grid3x3;
      case 'dots':
        return Ellipsis;
      default:
        return Grid3x3;
    }
  };

  const getGridLabel = () => {
    const isOn = props.gridMode !== 'off';
    const gridType = props.gridMode === 'dots' ? 'Dots' : 'Grid';
    return isOn ? gridType : 'Grid';
  };

  const handleGridClick = () => {
    props.onToggleGrid?.();
  };

  const handleGridRightClick = (e: MouseEvent) => {
    e.preventDefault(); // Prevent context menu
    props.onToggleGridOff?.();
  };

  const handleToggleCompact = () => {
    setIsCompact(!isCompact());
    saveToolbarPreferences(); // Save preference immediately when toggled
  };

  // Define toolbar actions
  const toolbarActions = () => [
    {
      icon: ArrowLeft,
      label: 'Back',
      onClick: props.onBack,
      show: !!props.onBack,
      variant: 'secondary' as const
    },
    {
      icon: FolderOpen,
      label: 'Browse Workflows',
      onClick: props.onBrowseWorkflows,
      show: !!props.onBrowseWorkflows,
      variant: 'secondary' as const
    },
    {
      icon: props.isExecuting ? Square : Play,
      label: props.isExecuting ? 'Stop' : (props.useMockData ? 'Dry Run' : 'Live Run'),
      onClick: props.onRun,
      onContextMenu: (e: MouseEvent) => {
        e.preventDefault();
        if (!props.isExecuting && props.onToggleMockData) {
          props.onToggleMockData();
        }
      },
      show: true,
      variant: props.isExecuting ? 'danger' : (props.useMockData ? 'secondary' : 'primary') as const,
      loading: false, // Don't show loading spinner, show Stop icon instead
      disabled: !props.isExecuting && (props.nodeCount === 0 || props.nodeCount === undefined),
      title: props.isExecuting
        ? 'Stop workflow execution'
        : (props.useMockData
          ? 'Dry Run (uses sample data) • Right-click to switch to Live Run'
          : 'Live Run (uses real data) • Right-click to switch to Dry Run')
    },
    {
      icon: Save,
      label: props.autoSaveEnabled ? 'Auto-Save (On)' : 'Auto-Save (Off)',
      onClick: () => {
        if (props.autoSaveEnabled && triggerWorkflowEdit) {
          // Auto-save is on: click to rename workflow
          triggerWorkflowEdit();
        } else {
          // Auto-save is off: click to force save
          props.onSave();
        }
      },
      onContextMenu: (e: MouseEvent) => {
        e.preventDefault();
        props.onToggleAutoSave?.();
      },
      show: true,
      variant: props.autoSaveEnabled ? 'primary' : 'secondary',
      loading: props.isSaving,
      title: props.autoSaveEnabled
        ? `Auto-save enabled${props.lastSaved ? ` • Last saved: ${props.lastSaved.toLocaleTimeString()}` : ''} • Click to rename • Right-click to disable`
        : 'Auto-save disabled • Click to save manually • Right-click to enable'
    },
    {
      icon: Upload,
      label: 'Import',
      onClick: props.onLoad,
      show: true,
      variant: 'secondary' as const
    },
    {
      icon: Download,
      label: 'Export',
      onClick: () => {}, // TODO: Implement export
      show: true,
      variant: 'secondary' as const
    },
    {
      icon: Undo,
      label: 'Undo',
      onClick: props.onUndo,
      show: !!props.onUndo,
      variant: 'secondary' as const,
      disabled: !props.canUndo
    },
    {
      icon: Redo,
      label: 'Redo',
      onClick: props.onRedo,
      show: !!props.onRedo,
      variant: 'secondary' as const,
      disabled: !props.canRedo
    },
    {
      icon: ZoomIn,
      label: 'Zoom In',
      onClick: props.onZoomIn,
      show: !!props.onZoomIn,
      variant: 'secondary' as const
    },
    {
      icon: ZoomOut,
      label: 'Zoom Out',
      onClick: props.onZoomOut,
      show: !!props.onZoomOut,
      variant: 'secondary' as const
    },
    {
      icon: getGridIcon(),
      label: getGridLabel(),
      onClick: handleGridClick,
      onContextMenu: handleGridRightClick,
      show: !!props.onToggleGrid,
      variant: props.gridMode !== 'off' ? 'primary' : 'secondary' as const,
      title: `${getGridLabel()} • Right-click to toggle on/off`
    },
    {
      icon: Blocks,
      label: 'Nodes',
      onClick: props.onToggleNodesPanel,
      show: !!props.onToggleNodesPanel,
      variant: props.isNodesPanelVisible ? 'primary' : 'secondary' as const,
      title: props.isNodesPanelVisible ? 'Hide Nodes Panel' : 'Show Nodes Panel'
    },
    {
      icon: MessageCircle,
      label: 'Show Assistant',
      onClick: props.onToggleAgentChat,
      show: !!props.onToggleAgentChat && !props.isAgentChatVisible,
      variant: 'secondary' as const
    },
    {
      icon: Share,
      label: 'Share',
      onClick: props.onShare,
      show: !!props.onShare,
      variant: 'secondary' as const
    },
    {
      icon: Settings,
      label: 'Settings',
      onClick: props.onSettings,
      show: !!props.onSettings,
      variant: 'secondary' as const
    },
    {
      icon: isDark() ? Sun : Moon,
      label: isDark() ? 'Light Mode' : 'Dark Mode',
      onClick: toggleTheme,
      show: true,
      variant: 'secondary' as const,
      title: `Switch to ${isDark() ? 'light' : 'dark'} mode`
    }
  ];

  return (
    <Show when={panelState.isVisible()}>
      <div
        class={`fixed z-50 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border border-gray-200/50 dark:border-gray-700/50 rounded-xl shadow-2xl transition-all duration-200 ${
          panelState.isDragging() ? 'shadow-2xl scale-[1.02]' : ''
        }`}
        style={{
          left: `${panelState.position().x}px`,
          top: `${panelState.position().y}px`,
          transform: panelState.isPinned() ? 'translateX(-50%)' : 'none'
        }}
        data-drag-handle="true"
        onMouseDown={panelHandlers.handleMouseDown}
      >
        <div class="flex items-center p-3 gap-3">
          {/* Workflow Info */}
          <Show when={props.currentWorkflow}>
            <WorkflowInfo
              currentWorkflow={props.currentWorkflow}
              onRename={props.onWorkflowRename}
              onEditRef={(editFn) => { triggerWorkflowEdit = editFn; }}
              class="mr-3"
            />
          </Show>

          {/* Action Buttons */}
          <div class="flex items-center gap-1">
            {toolbarActions()
              .filter(action => action.show)
              .map((action, index) => (
                <ActionButton
                  key={index}
                  icon={action.icon}
                  label={action.label}
                  onClick={action.onClick}
                  onContextMenu={action.onContextMenu}
                  variant={action.variant}
                  loading={action.loading}
                  disabled={action.disabled}
                  badge={action.badge}
                  title={action.title || action.label}
                  compact={isCompact()}
                />
              ))}
          </div>

          {/* Toolbar Controls */}
          <div class="ml-3 pl-3 border-l border-gray-200/50 dark:border-gray-700/50">
            <ToolbarControls
              isPinned={panelState.isPinned()}
              isDragging={panelState.isDragging()}
              onPin={handleToolbarPin}
              isCompact={isCompact()}
              onToggleCompact={handleToggleCompact}
              pinTitle={panelState.isPinned() ? 'Unpin from center' : 'Pin to center'}
              compactTitle={isCompact() ? 'Expand toolbar' : 'Collapse toolbar'}
            />
          </div>
        </div>
      </div>

      {/* Show button when hidden */}
      <Show when={!panelState.isVisible()}>
        <button
          onClick={panelHandlers.handleShow}
          class="fixed top-4 right-4 z-50 w-14 h-14 bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white rounded-2xl shadow-xl hover:shadow-2xl flex items-center justify-center transition-all duration-300 transform hover:scale-110 active:scale-95 backdrop-blur-sm"
          title="Show Toolbar"
        >
          <Settings class="w-6 h-6" />
        </button>
      </Show>
    </Show>
  );
}