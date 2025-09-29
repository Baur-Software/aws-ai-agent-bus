import { createSignal, createEffect } from 'solid-js';
import { useParams, useNavigate } from '@solidjs/router';
import { usePageHeader } from '../contexts/HeaderContext';
import { useOverlay } from '../contexts/OverlayContext';
import WorkflowCanvasManager from '../components/workflow/core/WorkflowCanvasManager';
import FloatingNavigation from '../components/workflow/ui/FloatingNavigation';
import WorkflowBrowser from './WorkflowBrowser';
import AppsTab from '../components/apps/AppsTab';

export default function Canvas() {
  const params = useParams();
  const navigate = useNavigate();
  const { openOverlay } = useOverlay();

  // Floating navigation state
  const [navigationPinned, setNavigationPinned] = createSignal(true);
  const [navigationPosition, setNavigationPosition] = createSignal({ x: 0, y: 0 });

  // Set page header based on whether we have a workflow ID
  const headerTitle = () => params.id ? 'Workflow Canvas' : 'Process Library';
  const headerSubtitle = () => params.id ? 'Design and optimize your business processes' : 'Browse, create, and manage your business processes';

  usePageHeader(headerTitle(), headerSubtitle());

  // Auto-open workflow browser when no workflow ID is present
  createEffect(() => {
    if (!params.id) {
      // Small delay to ensure overlay system is ready
      setTimeout(() => {
        handleOpenWorkflowBrowser();
      }, 100);
    }
  });

  const handleBack = () => {
    navigate('/');
  };

  const handleWorkflowRename = (newName: string) => {
    // TODO: Implement workflow renaming
    console.log('Workflow renamed to:', newName);
  };

  const handleNavigation = (page: string) => {
    if (page === 'workflows') {
      handleOpenWorkflowBrowser();
    } else if (page === 'apps') {
      openOverlay({
        id: 'apps-catalog',
        component: () => <AppsTab />,
        title: 'Connect an app',
        size: 'fullscreen'
      });
    } else {
      console.log('Navigating to:', page);
    }
  };

  const handleToggleChat = () => {
    // TODO: Implement chat toggle
    console.log('Toggle chat');
  };

  const handleOpenWorkflowBrowser = () => {
    openOverlay({
      id: 'workflow-browser',
      component: () => (
        <WorkflowBrowser
          overlayMode={true}
          onWorkflowSelect={(workflowId) => {
            navigate(`/workflows/${workflowId}`);
          }}
        />
      ),
      title: 'Process Library',
      size: 'large'
    });
  };

  const handleOpenMarketplace = () => {
    // TODO: Implement marketplace
    console.log('Open marketplace');
  };

  return (
    <div class="h-full bg-gray-50 dark:bg-gray-900">
      {/* Floating Navigation */}
      <FloatingNavigation
        currentPage="workflows"
        onNavigate={handleNavigation}
        onPositionChange={(x, y) => setNavigationPosition({ x, y })}
        onPinnedChange={setNavigationPinned}
        onToggleChat={handleToggleChat}
        onOpenWorkflowBrowser={handleOpenWorkflowBrowser}
        onOpenMarketplace={handleOpenMarketplace}
        initialPosition={navigationPosition()}
        initialPinned={navigationPinned()}
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
        onNavigate={handleNavigation}
      />
    </div>
  );
}