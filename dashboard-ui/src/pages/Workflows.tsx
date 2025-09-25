import { usePageHeader } from '../contexts/HeaderContext';
import WorkflowBrowser from './WorkflowBrowser';

export default function Workflows() {
  // Set page header
  usePageHeader('Workflow Library', 'Browse, create, and manage your business processes');

  return <WorkflowBrowser />;
}