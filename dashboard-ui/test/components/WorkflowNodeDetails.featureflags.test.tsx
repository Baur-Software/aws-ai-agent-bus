import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import WorkflowNodeDetails from '../../src/components/workflow/ui/WorkflowNodeDetails';
import { OrganizationProvider } from '../../src/contexts/OrganizationContext';
import { DashboardServerProvider } from '../../src/contexts/DashboardServerContext';
import type { Organization } from '../../src/services/OrganizationService';
import type { WorkflowNode } from '../../src/components/workflow/ui/WorkflowNodeDetails';

// Mock organization
const createMockOrg = (overrides?: Partial<Organization>): Organization => ({
  id: 'org-123',
  name: 'Test Organization',
  workspaceTier: 'small',
  infraState: 'deployed',
  features: {
    nodes: {
      'trigger': true,
      'http-get': true,
      'kv-get': true,
      'kv-set': true,
      'conditional': true,
      'switch': true,
      'docker-run': false,
      'vector-search': false
    },
    modules: {
      'ecs-agents': false,
      'vector-pg': false
    },
    limits: {
      maxWorkflows: 10
    }
  },
  ...overrides
});

// Mock node
const createMockNode = (type: string, overrides?: Partial<WorkflowNode>): WorkflowNode => ({
  id: `node-${type}-123`,
  type,
  x: 100,
  y: 100,
  inputs: [],
  outputs: [],
  config: {},
  enabled: true,
  ...overrides
});

// Test wrapper
function TestWrapper(props: { org: Organization; children: any }) {
  const [currentOrg, setCurrentOrg] = createSignal(props.org);
  const [orgs, setOrgs] = createSignal([props.org]);

  // Mock dashboard server context
  const mockExecuteTool = vi.fn().mockResolvedValue({ success: true });

  return (
    <OrganizationProvider
      value={{
        currentOrganization: currentOrg,
        organizations: orgs,
        isLoading: () => false,
        error: () => null,
        switchOrganization: vi.fn(),
        refreshOrganizations: vi.fn(),
        createOrganization: vi.fn(),
        updateOrganization: vi.fn(),
        deleteOrganization: vi.fn()
      }}
    >
      <DashboardServerProvider
        value={{
          isConnected: () => true,
          executeTool: mockExecuteTool,
          subscribe: vi.fn(),
          unsubscribe: vi.fn(),
          sendMessage: vi.fn()
        }}
      >
        {props.children}
      </DashboardServerProvider>
    </OrganizationProvider>
  );
}

describe('WorkflowNodeDetails - Feature Flags Integration', () => {
  const mockOnUpdate = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('available nodes', () => {
    it('should show configuration for available node', () => {
      const org = createMockOrg();
      const node = createMockNode('trigger');

      render(() => (
        <TestWrapper org={org}>
          <WorkflowNodeDetails
            node={node}
            onUpdate={mockOnUpdate}
            onClose={mockOnClose}
          />
        </TestWrapper>
      ));

      // Should show configuration tabs
      expect(screen.getByText('Configuration')).toBeInTheDocument();
      expect(screen.getByText('Advanced')).toBeInTheDocument();

      // Should NOT show upgrade prompt
      expect(screen.queryByText('Locked Node')).not.toBeInTheDocument();
    });

    it('should allow editing available node config', () => {
      const org = createMockOrg();
      const node = createMockNode('http-get', {
        config: { url: 'https://api.example.com' }
      });

      render(() => (
        <TestWrapper org={org}>
          <WorkflowNodeDetails
            node={node}
            onUpdate={mockOnUpdate}
            onClose={mockOnClose}
          />
        </TestWrapper>
      ));

      // Configuration should be editable
      expect(screen.getByText('Configuration')).toBeInTheDocument();

      // Should have save button enabled
      const saveButton = screen.getByText('Save').closest('button');
      expect(saveButton).not.toBeDisabled();
    });
  });

  describe('locked nodes', () => {
    it('should show upgrade prompt for locked node', () => {
      const org = createMockOrg();
      const node = createMockNode('docker-run');

      render(() => (
        <TestWrapper org={org}>
          <WorkflowNodeDetails
            node={node}
            onUpdate={mockOnUpdate}
            onClose={mockOnClose}
          />
        </TestWrapper>
      ));

      // Should show upgrade prompt
      expect(screen.getByText('Locked Node')).toBeInTheDocument();
      expect(screen.getByText('This node requires a subscription upgrade to use.')).toBeInTheDocument();
    });

    it('should hide configuration UI for locked node', () => {
      const org = createMockOrg();
      const node = createMockNode('docker-run');

      render(() => (
        <TestWrapper org={org}>
          <WorkflowNodeDetails
            node={node}
            onUpdate={mockOnUpdate}
            onClose={mockOnClose}
          />
        </TestWrapper>
      ));

      // Configuration fields should not be visible
      expect(screen.queryByText('Image')).not.toBeInTheDocument();
      expect(screen.queryByText('Environment Variables')).not.toBeInTheDocument();
    });

    it('should show upgrade button for locked node', () => {
      const org = createMockOrg();
      const node = createMockNode('vector-search');

      render(() => (
        <TestWrapper org={org}>
          <WorkflowNodeDetails
            node={node}
            onUpdate={mockOnUpdate}
            onClose={mockOnClose}
          />
        </TestWrapper>
      ));

      const upgradeButton = screen.getByText('Upgrade Subscription');
      expect(upgradeButton).toBeInTheDocument();
    });
  });

  describe('infrastructure state handling', () => {
    it('should show deploying message for locked node when infra is deploying', () => {
      const org = createMockOrg({ infraState: 'deploying' });
      const node = createMockNode('docker-run');

      render(() => (
        <TestWrapper org={org}>
          <WorkflowNodeDetails
            node={node}
            onUpdate={mockOnUpdate}
            onClose={mockOnClose}
          />
        </TestWrapper>
      ));

      expect(screen.getByText('Infrastructure Deploying')).toBeInTheDocument();
      expect(screen.queryByText('Upgrade Subscription')).not.toBeInTheDocument();
    });

    it('should show failed message for locked node when infra failed', () => {
      const org = createMockOrg({ infraState: 'failed' });
      const node = createMockNode('docker-run');

      render(() => (
        <TestWrapper org={org}>
          <WorkflowNodeDetails
            node={node}
            onUpdate={mockOnUpdate}
            onClose={mockOnClose}
          />
        </TestWrapper>
      ));

      expect(screen.getByText('Infrastructure Deployment Failed')).toBeInTheDocument();
    });

    it('should not affect available nodes when infra is deploying', () => {
      const org = createMockOrg({ infraState: 'deploying' });
      const node = createMockNode('trigger'); // Available in small tier

      render(() => (
        <TestWrapper org={org}>
          <WorkflowNodeDetails
            node={node}
            onUpdate={mockOnUpdate}
            onClose={mockOnClose}
          />
        </TestWrapper>
      ));

      // Available nodes should still show config, not affected by infra state
      expect(screen.getByText('Configuration')).toBeInTheDocument();
      expect(screen.queryByText('Locked Node')).not.toBeInTheDocument();
    });
  });

  describe('node type display', () => {
    it('should show correct node title for locked node', () => {
      const org = createMockOrg();
      const node = createMockNode('docker-run');

      render(() => (
        <TestWrapper org={org}>
          <WorkflowNodeDetails
            node={node}
            onUpdate={mockOnUpdate}
            onClose={mockOnClose}
          />
        </TestWrapper>
      ));

      // Should show the node type title in the header
      expect(screen.getByText(/Docker/i)).toBeInTheDocument();
    });

    it('should show node description in upgrade prompt', () => {
      const org = createMockOrg();
      const node = createMockNode('docker-run');

      render(() => (
        <TestWrapper org={org}>
          <WorkflowNodeDetails
            node={node}
            onUpdate={mockOnUpdate}
            onClose={mockOnClose}
          />
        </TestWrapper>
      ));

      // Should show description in upgrade prompt
      expect(screen.getByText(/container/i)).toBeInTheDocument();
    });
  });

  describe('close functionality', () => {
    it('should allow closing locked node details', () => {
      const org = createMockOrg();
      const node = createMockNode('docker-run');

      render(() => (
        <TestWrapper org={org}>
          <WorkflowNodeDetails
            node={node}
            onUpdate={mockOnUpdate}
            onClose={mockOnClose}
          />
        </TestWrapper>
      ));

      const closeButton = screen.getAllByRole('button').find(btn =>
        btn.querySelector('svg') // X icon
      );

      if (closeButton) {
        fireEvent.click(closeButton);
        expect(mockOnClose).toHaveBeenCalled();
      }
    });
  });

  describe('feature flag changes', () => {
    it('should update UI when node becomes available', async () => {
      const org = createMockOrg();
      const node = createMockNode('docker-run');

      const { rerender } = render(() => (
        <TestWrapper org={org}>
          <WorkflowNodeDetails
            node={node}
            onUpdate={mockOnUpdate}
            onClose={mockOnClose}
          />
        </TestWrapper>
      ));

      // Initially locked
      expect(screen.getByText('Locked Node')).toBeInTheDocument();

      // Update org to enable docker-run
      const updatedOrg = createMockOrg({
        features: {
          nodes: {
            ...org.features.nodes,
            'docker-run': true
          }
        }
      });

      rerender(() => (
        <TestWrapper org={updatedOrg}>
          <WorkflowNodeDetails
            node={node}
            onUpdate={mockOnUpdate}
            onClose={mockOnClose}
          />
        </TestWrapper>
      ));

      // Should now show configuration
      expect(screen.queryByText('Locked Node')).not.toBeInTheDocument();
      expect(screen.getByText('Configuration')).toBeInTheDocument();
    });
  });

  describe('multiple node types', () => {
    it('should handle different locked nodes correctly', () => {
      const testCases = [
        { type: 'docker-run', expectedLocked: true },
        { type: 'vector-search', expectedLocked: true },
        { type: 'trigger', expectedLocked: false },
        { type: 'http-get', expectedLocked: false }
      ];

      testCases.forEach(({ type, expectedLocked }) => {
        const org = createMockOrg();
        const node = createMockNode(type);

        const { unmount } = render(() => (
          <TestWrapper org={org}>
            <WorkflowNodeDetails
              node={node}
              onUpdate={mockOnUpdate}
              onClose={mockOnClose}
            />
          </TestWrapper>
        ));

        if (expectedLocked) {
          expect(screen.getByText('Locked Node')).toBeInTheDocument();
        } else {
          expect(screen.queryByText('Locked Node')).not.toBeInTheDocument();
          expect(screen.getByText('Configuration')).toBeInTheDocument();
        }

        unmount();
      });
    });
  });

  describe('edge cases', () => {
    it('should handle null organization', () => {
      const org = null as any;
      const node = createMockNode('docker-run');

      render(() => (
        <TestWrapper org={org}>
          <WorkflowNodeDetails
            node={node}
            onUpdate={mockOnUpdate}
            onClose={mockOnClose}
          />
        </TestWrapper>
      ));

      // Should show locked when org is null
      expect(screen.getByText('Locked Node')).toBeInTheDocument();
    });

    it('should handle missing features object', () => {
      const org = createMockOrg({ features: undefined });
      const node = createMockNode('docker-run');

      render(() => (
        <TestWrapper org={org}>
          <WorkflowNodeDetails
            node={node}
            onUpdate={mockOnUpdate}
            onClose={mockOnClose}
          />
        </TestWrapper>
      ));

      // Should show locked when features is missing
      expect(screen.getByText('Locked Node')).toBeInTheDocument();
    });

    it('should handle null node gracefully', () => {
      const org = createMockOrg();

      render(() => (
        <TestWrapper org={org}>
          <WorkflowNodeDetails
            node={null}
            onUpdate={mockOnUpdate}
            onClose={mockOnClose}
          />
        </TestWrapper>
      ));

      // Should not crash, should just not render
      expect(screen.queryByText('Configuration')).not.toBeInTheDocument();
      expect(screen.queryByText('Locked Node')).not.toBeInTheDocument();
    });
  });
});
