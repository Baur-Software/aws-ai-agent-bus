import { useNavigate } from '@solidjs/router';
import { useOverlay } from '../../contexts/OverlayContext';
import WorkflowMarketplace from '../workflow/browser/WorkflowMarketplace';

export default function WorkflowMarketplaceOverlay() {
  const navigate = useNavigate();
  const { closeOverlay } = useOverlay();

  const handleSelectTemplate = (template: any) => {
    // TODO: Create workflow from template and navigate
    console.log('Template selected:', template);
    closeOverlay('workflow-marketplace');
  };

  const handleClose = () => {
    closeOverlay('workflow-marketplace');
  };

  return (
    <div class="h-full">
      <WorkflowMarketplace
        onSelectTemplate={handleSelectTemplate}
        onClose={handleClose}
        organizationContext={true}
      />
    </div>
  );
}