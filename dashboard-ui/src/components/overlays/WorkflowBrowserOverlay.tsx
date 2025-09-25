import { useNavigate } from '@solidjs/router';
import { useOverlay } from '../../contexts/OverlayContext';
import { useWorkflow } from '../../contexts/WorkflowContext';
import WorkflowBrowser from '../../pages/WorkflowBrowser';

interface WorkflowBrowserOverlayProps {
  onSelectWorkflow?: (workflowId: string) => void;
}

export default function WorkflowBrowserOverlay(props: WorkflowBrowserOverlayProps) {
  const navigate = useNavigate();
  const { closeOverlay } = useOverlay();

  const handleSelectWorkflow = (workflowId: string) => {
    if (props.onSelectWorkflow) {
      props.onSelectWorkflow(workflowId);
    } else {
      navigate(`/workflows/${workflowId}`);
    }
    closeOverlay('workflow-browser');
  };

  return (
    <div class="h-full">
      <WorkflowBrowser
        onWorkflowSelect={handleSelectWorkflow}
        overlayMode={true}
      />
    </div>
  );
}