import { createSignal, createEffect, lazy, onMount, onCleanup, Show } from 'solid-js';
import { useParams, useNavigate, useLocation } from '@solidjs/router';
import { usePageHeader } from '../contexts/HeaderContext';
import { useOverlay } from '../contexts/OverlayContext';
import { useWorkflow } from '../contexts/WorkflowContext';
import { YjsWorkflowProvider } from '../contexts/YjsWorkflowContext';
import { useAuth } from '../contexts/AuthContext';
import WorkflowCanvasManager from '../components/workflow/core/WorkflowCanvasManager';
import FloatingNavigation from '../components/workflow/ui/FloatingNavigation';
import FloatingChatPanel from '../components/FloatingChatPanel';
import WorkflowBrowser from './WorkflowBrowser';

// Lazy load overlay components
const KVStore = lazy(() => import('./KVStore'));
const Artifacts = lazy(() => import('./Artifacts'));
const Events = lazy(() => import('./Events'));
const Settings = lazy(() => import('./Settings'));
const AppsTab = lazy(() => import('../components/apps/AppsTab'));
const NodeDesigner = lazy(() => import('./NodeDesigner'));
const Agents = lazy(() => import('./Agents'));

export default function Canvas() {
  const params = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { openOverlay, closeOverlay } = useOverlay();
  const workflow = useWorkflow();

  // Floating navigation state
  const [navigationPinned, setNavigationPinned] = createSignal(true);
  const [navigationPosition, setNavigationPosition] = createSignal({ x: 0, y: 0 });

  // Floating chat panel state
  const [chatPinned, setChatPinned] = createSignal(false);
  // Position chat to the right of the navigation panel (64px wide when pinned, 320px when expanded)
  const getChatInitialPosition = () => {
    const navWidth = navigationPinned() ? 64 : 320;
    return { x: navWidth + 20, y: 100 };
  };
  const [chatPosition, setChatPosition] = createSignal(getChatInitialPosition());

  // Set page header based on whether we have a workflow ID
  const headerTitle = () => params.id ? 'Workflow Canvas' : 'Process Library';
  const headerSubtitle = () => params.id ? 'Design and optimize your business processes' : 'Browse, create, and manage your business processes';

  usePageHeader(headerTitle(), headerSubtitle());

  // Keyboard shortcuts for undo/redo
  onMount(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      // Ctrl+Z or Cmd+Z for undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (workflow.canUndo()) {
          workflow.undo();
        }
      }
      // Ctrl+Y or Cmd+Shift+Z for redo
      else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
        e.preventDefault();
        if (workflow.canRedo()) {
          workflow.redo();
        }
      }
      // Ctrl+S or Cmd+S for save
      else if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        workflow.saveWorkflow();
      }
    };

    window.addEventListener('keydown', handleKeydown);
    onCleanup(() => window.removeEventListener('keydown', handleKeydown));
  });

  // Define overlay routes
  const overlayRoutes = {
    // Dashboard removed - will be rebuilt as configurable canvas with datavis nodes
    '/workflows': {
      id: 'workflow-browser',
      component: () => (
        <WorkflowBrowser
          overlayMode={true}
          onWorkflowSelect={(workflowId) => {
            closeOverlay('workflow-browser');
            if (workflowId === '__marketplace__') {
              navigate('/workflows/marketplace');
            } else {
              navigate(`/workflows/${workflowId}`);
            }
          }}
          onClose={() => closeOverlay('workflow-browser')}
        />
      ),
      title: 'Workflow Browser',
      size: 'large' as const
    },
    '/agents': {
      id: 'agents',
      component: () => <Agents isOverlay={true} />,
      title: 'AI Agents',
      size: 'fullscreen' as const
    },
    '/apps': {
      id: 'apps',
      component: AppsTab,
      title: 'Apps & Integrations',
      size: 'fullscreen' as const
    },
    '/kv-store': {
      id: 'kv-store',
      component: KVStore,
      title: 'KV Store',
      size: 'large' as const
    },
    '/artifacts': {
      id: 'artifacts',
      component: Artifacts,
      title: 'Artifacts & S3',
      size: 'large' as const
    },
    '/events': {
      id: 'events',
      component: Events,
      title: 'Events',
      size: 'large' as const
    },
    '/settings': {
      id: 'settings',
      component: () => <Settings isOverlay={true} />,
      title: 'Settings',
      size: 'medium' as const
    },
    '/node-designer': {
      id: 'node-designer',
      component: NodeDesigner,
      title: 'Node Designer',
      size: 'fullscreen' as const
    }
  };

  // Handle overlay routing
  createEffect(() => {
    const path = location.pathname;
    const overlayConfig = overlayRoutes[path];

    if (overlayConfig) {
      // Open the overlay
      openOverlay({
        id: overlayConfig.id,
        component: overlayConfig.component,
        title: overlayConfig.title,
        size: overlayConfig.size
      });

      // Navigate back to base route to keep Canvas visible
      navigate('/', { replace: true });
    }
  });

  // Auto-open workflow browser when no workflow ID is present
  // createEffect(() => {
  //   if (!params.id && location.pathname === '/') {
  //     // Small delay to ensure overlay system is ready
  //     setTimeout(() => {
  //       handleOpenWorkflowBrowser();
  //     }, 100);
  //   }
  // });

  const handleBack = () => {
    navigate('/');
  };

  const handleWorkflowRename = (newName: string) => {
    // TODO: Implement workflow renaming
    console.log('Workflow renamed to:', newName);
  };

  const handleOpenWorkflowBrowser = () => {
    openOverlay({
      id: 'workflow-browser',
      component: () => (
        <WorkflowBrowser
          overlayMode={true}
          onWorkflowSelect={(workflowId) => {
            // Close the overlay first, then navigate
            closeOverlay('workflow-browser');
            // Handle special marketplace case
            if (workflowId === '__marketplace__') {
              navigate('/workflows/marketplace');
            } else {
              navigate(`/workflows/${workflowId}`);
            }
          }}
        />
      ),
      title: 'Process Library',
      size: 'large'
    });
  };

  const canvasContent = () => (
    <div class="h-full bg-gray-50 dark:bg-gray-900">
      {/* Floating Navigation - now handles its own navigation */}
      <FloatingNavigation
        onPositionChange={(x, y) => setNavigationPosition({ x, y })}
        onPinnedChange={setNavigationPinned}
        initialPosition={navigationPosition()}
        initialPinned={navigationPinned()}
      />

      {/* Floating Chat Panel */}
      <FloatingChatPanel
        onPositionChange={(x, y) => setChatPosition({ x, y })}
        onPinnedChange={setChatPinned}
        initialPosition={chatPosition()}
        initialPinned={chatPinned()}
      />

      {/* Workflow Canvas */}
      <WorkflowCanvasManager
        workflowId={params.id}
        onBack={params.id ? handleBack : undefined}
        navigationPinned={navigationPinned()}
        onWorkflowRename={handleWorkflowRename}
        showWorkflowBrowser={!params.id}
        onSetShowWorkflowBrowser={(show) => {
          if (!show && !params.id) {
            // If closing browser on root page, open it again
            setTimeout(() => handleOpenWorkflowBrowser(), 100);
          }
        }}
      />
    </div>
  );

  // Wrap with Yjs provider if we have a workflow ID
  return (
    <Show
      when={params.id}
      fallback={canvasContent()}
    >
      <YjsWorkflowProvider
        workflowId={params.id!}
        wsUrl={`ws://localhost:3001/workflow/${params.id}`}
      >
        {canvasContent()}
      </YjsWorkflowProvider>
    </Show>
  );
}