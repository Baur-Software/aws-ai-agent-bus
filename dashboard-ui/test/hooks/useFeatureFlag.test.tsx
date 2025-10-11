import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import {
  useFeatureFlag,
  useFeatureFlagValue,
  useNodeAvailable,
  useModuleAvailable,
  useInfraState,
  useInfraDeployed,
  useFeatureLimit
} from '../../src/hooks/useFeatureFlag';
import type { Organization } from '../../src/services/OrganizationService';

// Unmock OrganizationContext for this test file to use our custom TestWrapper
vi.unmock('../../src/contexts/OrganizationContext');

// Import after unmocking
import OrganizationContext, { useOrganization } from '../../src/contexts/OrganizationContext';

// Mock organization with feature flags
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
      'docker-run': false,
      'vector-search': false
    },
    modules: {
      'ecs-agents': false,
      'step-functions': false,
      'vector-pg': false,
      'observability': true
    },
    limits: {
      maxWorkflows: 10,
      maxNodesPerWorkflow: 20,
      maxConcurrentExecutions: 5
    }
  },
  ...overrides
});

// Test wrapper component that provides organization context
function TestWrapper(props: { org: Organization | null; children: any }) {
  return (
    <OrganizationContext.Provider
      value={{
        user: () => null,
        currentOrganization: () => props.org,
        organizations: () => props.org ? [props.org] : [],
        members: () => [],
        userPermissions: () => [],
        switchOrganization: vi.fn(),
        createOrganization: vi.fn(),
        updateOrganization: vi.fn(),
        deleteOrganization: vi.fn(),
        inviteMember: vi.fn(),
        updateMember: vi.fn(),
        removeMember: vi.fn(),
        resendInvitation: vi.fn(),
        hasPermission: vi.fn(() => true),
        canManageMembers: vi.fn(() => true),
        canManageOrganization: vi.fn(() => true),
        canInviteMembers: vi.fn(() => true),
        refreshOrganizations: vi.fn(),
        refreshMembers: vi.fn(),
        loading: () => false,
        error: () => null
      } as any}
    >
      {props.children}
    </OrganizationContext.Provider>
  );
}

describe('useFeatureFlag', () => {
  describe('basic feature flag checks', () => {
    it('should return true for enabled node', () => {
      function TestComponent() {
        const canUseTrigger = useFeatureFlag('nodes.trigger');
        return <div data-testid="result">{canUseTrigger() ? 'enabled' : 'disabled'}</div>;
      }

      const org = createMockOrg();
      render(() => (
        <TestWrapper org={org}>
          <TestComponent />
        </TestWrapper>
      ));

      expect(screen.getByTestId('result').textContent).toBe('enabled');
    });

    it('should return false for disabled node', () => {
      function TestComponent() {
        const canUseDocker = useFeatureFlag('nodes.docker-run');
        return <div data-testid="result">{canUseDocker() ? 'enabled' : 'disabled'}</div>;
      }

      const org = createMockOrg();
      render(() => (
        <TestWrapper org={org}>
          <TestComponent />
        </TestWrapper>
      ));

      expect(screen.getByTestId('result').textContent).toBe('disabled');
    });

    it('should handle nested paths', () => {
      function TestComponent() {
        const hasECS = useFeatureFlag('modules.ecs-agents');
        return <div data-testid="result">{hasECS() ? 'enabled' : 'disabled'}</div>;
      }

      const org = createMockOrg();
      render(() => (
        <TestWrapper org={org}>
          <TestComponent />
        </TestWrapper>
      ));

      expect(screen.getByTestId('result').textContent).toBe('disabled');
    });

    it('should return false when organization is null', () => {
      function TestComponent() {
        const canUseTrigger = useFeatureFlag('nodes.trigger');
        return <div data-testid="result">{canUseTrigger() ? 'enabled' : 'disabled'}</div>;
      }

      const org = null as any;
      render(() => (
        <TestWrapper org={org}>
          <TestComponent />
        </TestWrapper>
      ));

      expect(screen.getByTestId('result').textContent).toBe('disabled');
    });
  });

  describe('wildcard pattern matching', () => {
    it('should return true when wildcard matches existing keys', () => {
      function TestComponent() {
        const hasInfra = useFeatureFlag('org-123.infra-small.*');
        return <div data-testid="result">{hasInfra() ? 'exists' : 'none'}</div>;
      }

      const org = createMockOrg({
        features: {
          'org-123': {
            'infra-small': {
              'kv-store': 'deployed',
              'events': 'deployed'
            }
          }
        }
      });

      render(() => (
        <TestWrapper org={org}>
          <TestComponent />
        </TestWrapper>
      ));

      expect(screen.getByTestId('result').textContent).toBe('exists');
    });

    it('should return false when wildcard matches empty object', () => {
      function TestComponent() {
        const hasInfra = useFeatureFlag('org-123.infra-small.*');
        return <div data-testid="result">{hasInfra() ? 'exists' : 'none'}</div>;
      }

      const org = createMockOrg({
        features: {
          'org-123': {
            'infra-small': {}
          }
        }
      });

      render(() => (
        <TestWrapper org={org}>
          <TestComponent />
        </TestWrapper>
      ));

      expect(screen.getByTestId('result').textContent).toBe('none');
    });

    it('should return false when wildcard path does not exist', () => {
      function TestComponent() {
        const hasInfra = useFeatureFlag('org-999.infra-large.*');
        return <div data-testid="result">{hasInfra() ? 'exists' : 'none'}</div>;
      }

      const org = createMockOrg();
      render(() => (
        <TestWrapper org={org}>
          <TestComponent />
        </TestWrapper>
      ));

      expect(screen.getByTestId('result').textContent).toBe('none');
    });
  });

  describe('custom value check function', () => {
    it('should use custom function when provided', () => {
      function TestComponent() {
        const customFlag = useFeatureFlag('custom', (org) => org.name === 'Test Organization');
        return <div data-testid="result">{customFlag() ? 'yes' : 'no'}</div>;
      }

      const org = createMockOrg();
      render(() => (
        <TestWrapper org={org}>
          <TestComponent />
        </TestWrapper>
      ));

      expect(screen.getByTestId('result').textContent).toBe('yes');
    });

    it('should handle falsy custom function results', () => {
      function TestComponent() {
        const customFlag = useFeatureFlag('custom', (org) => org.name === 'Different Name');
        return <div data-testid="result">{customFlag() ? 'yes' : 'no'}</div>;
      }

      const org = createMockOrg();
      render(() => (
        <TestWrapper org={org}>
          <TestComponent />
        </TestWrapper>
      ));

      expect(screen.getByTestId('result').textContent).toBe('no');
    });
  });

  describe('useFeatureFlagValue', () => {
    it('should return numeric value from limits', () => {
      function TestComponent() {
        const maxWorkflows = useFeatureFlagValue<number>('limits.maxWorkflows');
        return <div data-testid="result">{maxWorkflows()}</div>;
      }

      const org = createMockOrg();
      render(() => (
        <TestWrapper org={org}>
          <TestComponent />
        </TestWrapper>
      ));

      expect(screen.getByTestId('result').textContent).toBe('10');
    });

    it('should return string value from top-level', () => {
      function TestComponent() {
        const tier = useFeatureFlagValue<string>('workspaceTier');
        return <div data-testid="result">{tier()}</div>;
      }

      const org = createMockOrg();
      render(() => (
        <TestWrapper org={org}>
          <TestComponent />
        </TestWrapper>
      ));

      expect(screen.getByTestId('result').textContent).toBe('small');
    });

    it('should return undefined for non-existent path', () => {
      function TestComponent() {
        const missing = useFeatureFlagValue('does.not.exist');
        return <div data-testid="result">{missing() === undefined ? 'undefined' : 'exists'}</div>;
      }

      const org = createMockOrg();
      render(() => (
        <TestWrapper org={org}>
          <TestComponent />
        </TestWrapper>
      ));

      expect(screen.getByTestId('result').textContent).toBe('undefined');
    });
  });

  describe('helper functions', () => {
    describe('useNodeAvailable', () => {
      it('should check node availability', () => {
        function TestComponent() {
          const canUseTrigger = useNodeAvailable('trigger');
          const canUseDocker = useNodeAvailable('docker-run');
          return (
            <div>
              <div data-testid="trigger">{canUseTrigger() ? 'yes' : 'no'}</div>
              <div data-testid="docker">{canUseDocker() ? 'yes' : 'no'}</div>
            </div>
          );
        }

        const org = createMockOrg();
        render(() => (
          <TestWrapper org={org}>
            <TestComponent />
          </TestWrapper>
        ));

        expect(screen.getByTestId('trigger').textContent).toBe('yes');
        expect(screen.getByTestId('docker').textContent).toBe('no');
      });
    });

    describe('useModuleAvailable', () => {
      it('should check module availability', () => {
        function TestComponent() {
          const hasObservability = useModuleAvailable('observability');
          const hasECS = useModuleAvailable('ecs-agents');
          return (
            <div>
              <div data-testid="observability">{hasObservability() ? 'yes' : 'no'}</div>
              <div data-testid="ecs">{hasECS() ? 'yes' : 'no'}</div>
            </div>
          );
        }

        const org = createMockOrg();
        render(() => (
          <TestWrapper org={org}>
            <TestComponent />
          </TestWrapper>
        ));

        expect(screen.getByTestId('observability').textContent).toBe('yes');
        expect(screen.getByTestId('ecs').textContent).toBe('no');
      });
    });

    describe('useInfraState', () => {
      it('should return infrastructure state', () => {
        function TestComponent() {
          const state = useInfraState();
          return <div data-testid="state">{state()}</div>;
        }

        const org = createMockOrg({ infraState: 'deploying' });
        render(() => (
          <TestWrapper org={org}>
            <TestComponent />
          </TestWrapper>
        ));

        expect(screen.getByTestId('state').textContent).toBe('deploying');
      });

      it('should handle undefined state', () => {
        function TestComponent() {
          const state = useInfraState();
          return <div data-testid="state">{state() || 'none'}</div>;
        }

        const org = createMockOrg({ infraState: undefined });
        render(() => (
          <TestWrapper org={org}>
            <TestComponent />
          </TestWrapper>
        ));

        expect(screen.getByTestId('state').textContent).toBe('none');
      });
    });

    describe('useFeatureLimit', () => {
      it('should return limit values', () => {
        function TestComponent() {
          const maxWorkflows = useFeatureLimit('maxWorkflows');
          const maxNodes = useFeatureLimit('maxNodesPerWorkflow');
          return (
            <div>
              <div data-testid="workflows">{String(maxWorkflows() || '')}</div>
              <div data-testid="nodes">{String(maxNodes() || '')}</div>
            </div>
          );
        }

        const org = createMockOrg();
        render(() => (
          <TestWrapper org={org}>
            <TestComponent />
          </TestWrapper>
        ));

        expect(screen.getByTestId('workflows').textContent).toBe('10');
        expect(screen.getByTestId('nodes').textContent).toBe('20');
      });
    });
  });

  describe('edge cases', () => {
    it('should handle missing features object', () => {
      function TestComponent() {
        const canUseTrigger = useFeatureFlag('nodes.trigger');
        return <div data-testid="result">{canUseTrigger() ? 'yes' : 'no'}</div>;
      }

      const org = createMockOrg({ features: undefined });
      render(() => (
        <TestWrapper org={org}>
          <TestComponent />
        </TestWrapper>
      ));

      expect(screen.getByTestId('result').textContent).toBe('no');
    });

    it('should handle null values in feature path', () => {
      function TestComponent() {
        const flag = useFeatureFlag('features.null.path');
        return <div data-testid="result">{flag() ? 'yes' : 'no'}</div>;
      }

      const org = createMockOrg({
        features: {
          null: null
        } as any
      });
      render(() => (
        <TestWrapper org={org}>
          <TestComponent />
        </TestWrapper>
      ));

      expect(screen.getByTestId('result').textContent).toBe('no');
    });

    it('should interpret string "true" as true', () => {
      function TestComponent() {
        const flag = useFeatureFlag('custom.flag');
        return <div data-testid="result">{flag() ? 'yes' : 'no'}</div>;
      }

      const org = createMockOrg({
        features: {
          custom: {
            flag: 'true'
          }
        } as any
      });
      render(() => (
        <TestWrapper org={org}>
          <TestComponent />
        </TestWrapper>
      ));

      expect(screen.getByTestId('result').textContent).toBe('yes');
    });

    it('should interpret number 1 as true', () => {
      function TestComponent() {
        const flag = useFeatureFlag('custom.flag');
        return <div data-testid="result">{flag() ? 'yes' : 'no'}</div>;
      }

      const org = createMockOrg({
        features: {
          custom: {
            flag: 1
          }
        } as any
      });
      render(() => (
        <TestWrapper org={org}>
          <TestComponent />
        </TestWrapper>
      ));

      expect(screen.getByTestId('result').textContent).toBe('yes');
    });
  });
});
