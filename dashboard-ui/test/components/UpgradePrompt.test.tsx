import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { UpgradePrompt } from '../../src/components/workflow/ui/UpgradePrompt';
import { OrganizationProvider } from '../../src/contexts/OrganizationContext';
import type { Organization } from '../../src/services/OrganizationService';

// Mock organization
const createMockOrg = (overrides?: Partial<Organization>): Organization => ({
  id: 'org-123',
  name: 'Test Organization',
  workspaceTier: 'small',
  infraState: 'deployed',
  features: {
    nodes: {
      'docker-run': false
    }
  },
  ...overrides
});

// Test wrapper
function TestWrapper(props: { org: Organization; children: any }) {
  const [currentOrg, setCurrentOrg] = createSignal(props.org);
  const [orgs, setOrgs] = createSignal([props.org]);

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
      {props.children}
    </OrganizationProvider>
  );
}

describe('UpgradePrompt', () => {
  beforeEach(() => {
    // Reset hash before each test
    window.location.hash = '';
  });

  describe('basic rendering', () => {
    it('should render locked badge', () => {
      const org = createMockOrg();
      render(() => (
        <TestWrapper org={org}>
          <UpgradePrompt
            nodeType="docker-run"
            nodeDisplayName="Docker Container"
            nodeDescription="Run Docker containers on AWS ECS Fargate"
          />
        </TestWrapper>
      ));

      expect(screen.getByText('Locked Node')).toBeInTheDocument();
    });

    it('should display node name', () => {
      const org = createMockOrg();
      render(() => (
        <TestWrapper org={org}>
          <UpgradePrompt
            nodeType="docker-run"
            nodeDisplayName="Docker Container"
            nodeDescription="Run Docker containers"
          />
        </TestWrapper>
      ));

      expect(screen.getByText('Docker Container')).toBeInTheDocument();
    });

    it('should display node description when provided', () => {
      const org = createMockOrg();
      render(() => (
        <TestWrapper org={org}>
          <UpgradePrompt
            nodeType="docker-run"
            nodeDisplayName="Docker Container"
            nodeDescription="Run Docker containers on AWS ECS Fargate"
          />
        </TestWrapper>
      ));

      expect(screen.getByText('Run Docker containers on AWS ECS Fargate')).toBeInTheDocument();
    });

    it('should display upgrade message', () => {
      const org = createMockOrg();
      render(() => (
        <TestWrapper org={org}>
          <UpgradePrompt
            nodeType="docker-run"
            nodeDisplayName="Docker Container"
          />
        </TestWrapper>
      ));

      expect(screen.getByText('This node requires a subscription upgrade to use.')).toBeInTheDocument();
    });
  });

  describe('infrastructure state', () => {
    it('should show deploying message when infraState is deploying', () => {
      const org = createMockOrg({ infraState: 'deploying' });
      render(() => (
        <TestWrapper org={org}>
          <UpgradePrompt
            nodeType="docker-run"
            nodeDisplayName="Docker Container"
          />
        </TestWrapper>
      ));

      expect(screen.getByText('Infrastructure Deploying')).toBeInTheDocument();
      expect(screen.getByText(/Your infrastructure is being provisioned/)).toBeInTheDocument();
    });

    it('should show failed message when infraState is failed', () => {
      const org = createMockOrg({ infraState: 'failed' });
      render(() => (
        <TestWrapper org={org}>
          <UpgradePrompt
            nodeType="docker-run"
            nodeDisplayName="Docker Container"
          />
        </TestWrapper>
      ));

      expect(screen.getByText('Infrastructure Deployment Failed')).toBeInTheDocument();
      expect(screen.getByText(/There was an issue deploying your infrastructure/)).toBeInTheDocument();
    });

    it('should not show state messages when infraState is deployed', () => {
      const org = createMockOrg({ infraState: 'deployed' });
      render(() => (
        <TestWrapper org={org}>
          <UpgradePrompt
            nodeType="docker-run"
            nodeDisplayName="Docker Container"
          />
        </TestWrapper>
      ));

      expect(screen.queryByText('Infrastructure Deploying')).not.toBeInTheDocument();
      expect(screen.queryByText('Infrastructure Deployment Failed')).not.toBeInTheDocument();
    });

    it('should hide upgrade button when deploying', () => {
      const org = createMockOrg({ infraState: 'deploying' });
      render(() => (
        <TestWrapper org={org}>
          <UpgradePrompt
            nodeType="docker-run"
            nodeDisplayName="Docker Container"
          />
        </TestWrapper>
      ));

      expect(screen.queryByText('Upgrade Subscription')).not.toBeInTheDocument();
    });

    it('should show upgrade button when deployed or failed', () => {
      const org = createMockOrg({ infraState: 'deployed' });
      render(() => (
        <TestWrapper org={org}>
          <UpgradePrompt
            nodeType="docker-run"
            nodeDisplayName="Docker Container"
          />
        </TestWrapper>
      ));

      expect(screen.getByText('Upgrade Subscription')).toBeInTheDocument();
    });
  });

  describe('upgrade button interaction', () => {
    it('should navigate to billing page when upgrade button is clicked', () => {
      const org = createMockOrg();
      render(() => (
        <TestWrapper org={org}>
          <UpgradePrompt
            nodeType="docker-run"
            nodeDisplayName="Docker Container"
          />
        </TestWrapper>
      ));

      const upgradeButton = screen.getByText('Upgrade Subscription');
      fireEvent.click(upgradeButton);

      expect(window.location.hash).toBe('#/settings/billing');
    });
  });

  describe('learn more link', () => {
    it('should render learn more link', () => {
      const org = createMockOrg();
      render(() => (
        <TestWrapper org={org}>
          <UpgradePrompt
            nodeType="docker-run"
            nodeDisplayName="Docker Container"
          />
        </TestWrapper>
      ));

      const link = screen.getByText('Learn more about workspace tiers');
      expect(link).toBeInTheDocument();
      expect(link.closest('a')).toHaveAttribute('href', 'https://docs.example.com/workspace-tiers');
      expect(link.closest('a')).toHaveAttribute('target', '_blank');
      expect(link.closest('a')).toHaveAttribute('rel', 'noopener noreferrer');
    });
  });

  describe('edge cases', () => {
    it('should handle missing organization gracefully', () => {
      const org = null as any;
      render(() => (
        <TestWrapper org={org}>
          <UpgradePrompt
            nodeType="docker-run"
            nodeDisplayName="Docker Container"
          />
        </TestWrapper>
      ));

      expect(screen.getByText('Locked Node')).toBeInTheDocument();
    });

    it('should handle undefined infraState', () => {
      const org = createMockOrg({ infraState: undefined });
      render(() => (
        <TestWrapper org={org}>
          <UpgradePrompt
            nodeType="docker-run"
            nodeDisplayName="Docker Container"
          />
        </TestWrapper>
      ));

      // Should show upgrade button when infraState is undefined
      expect(screen.getByText('Upgrade Subscription')).toBeInTheDocument();
    });

    it('should not display description when not provided', () => {
      const org = createMockOrg();
      render(() => (
        <TestWrapper org={org}>
          <UpgradePrompt
            nodeType="docker-run"
            nodeDisplayName="Docker Container"
          />
        </TestWrapper>
      ));

      // Should only show the generic upgrade message
      const descriptionElements = screen.queryByText(/Run Docker containers/);
      expect(descriptionElements).not.toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have proper button roles', () => {
      const org = createMockOrg();
      render(() => (
        <TestWrapper org={org}>
          <UpgradePrompt
            nodeType="docker-run"
            nodeDisplayName="Docker Container"
          />
        </TestWrapper>
      ));

      const upgradeButton = screen.getByText('Upgrade Subscription').closest('button');
      expect(upgradeButton).toHaveAttribute('type', 'button');
    });

    it('should have external link indicator', () => {
      const org = createMockOrg();
      render(() => (
        <TestWrapper org={org}>
          <UpgradePrompt
            nodeType="docker-run"
            nodeDisplayName="Docker Container"
          />
        </TestWrapper>
      ));

      const link = screen.getByText('Learn more about workspace tiers').closest('a');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });
  });
});
