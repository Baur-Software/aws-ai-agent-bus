import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';
import { createRoot } from 'solid-js';
import WorkflowManager from '../workflow/core/WorkflowManager';
import type { WorkflowMetadata } from '../workflow/core/WorkflowManager';

// Mock dependencies
const mockKVStore = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn()
};

const mockNotifications = {
  success: vi.fn(),
  error: vi.fn()
};

const mockOrganization = {
  currentOrganization: () => ({ id: 'org-123', name: 'Test Org', slug: 'test-org' })
};

// Mock contexts - need to mock the hook implementations directly
vi.mock('../contexts/KVStoreContext', () => ({
  useKVStore: () => mockKVStore,
  KVStoreProvider: ({ children }: { children: any }) => children
}));

vi.mock('../contexts/NotificationContext', () => ({
  useNotifications: () => mockNotifications,
  NotificationProvider: ({ children }: { children: any }) => children
}));

vi.mock('../contexts/OrganizationContext', () => ({
  useOrganization: () => mockOrganization,
  OrganizationProvider: ({ children }: { children: any }) => children
}));

vi.mock('../contexts/HeaderContext', () => ({
  usePageHeader: () => {},
  HeaderProvider: ({ children }: { children: any }) => children
}));

// Sample test data
const sampleWorkflows: WorkflowMetadata[] = [
  {
    id: 'wf-1',
    name: 'Test Workflow 1',
    description: 'A test workflow for analytics',
    currentVersion: 2,
    versions: [
      {
        id: 'wf-1-v1',
        version: 1,
        name: 'Initial Version',
        description: '',
        nodes: [],
        connections: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        createdBy: 'user-1',
        tags: [],
        isPublished: true,
        executionCount: 5
      },
      {
        id: 'wf-1-v2',
        version: 2,
        name: 'Updated Version',
        description: 'Added error handling',
        nodes: [],
        connections: [],
        createdAt: '2024-01-02T00:00:00Z',
        updatedAt: '2024-01-02T00:00:00Z',
        createdBy: 'user-1',
        tags: ['analytics', 'production'],
        isPublished: false,
        executionCount: 12
      }
    ],
    totalVersions: 2,
    isStarred: true,
    isTemplate: false,
    collaborators: ['user-1', 'user-2'],
    organizationId: 'org-123',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
    createdBy: 'user-1',
    tags: ['analytics', 'production'],
    category: 'automation',
    executionStats: {
      totalExecutions: 17,
      successRate: 0.94,
      avgDuration: 2500,
      lastExecuted: '2024-01-02T12:00:00Z'
    }
  },
  {
    id: 'wf-2',
    name: 'Integration Workflow',
    description: 'Slack and GitHub integration',
    currentVersion: 1,
    versions: [
      {
        id: 'wf-2-v1',
        version: 1,
        name: 'Initial Version',
        description: '',
        nodes: [],
        connections: [],
        createdAt: '2024-01-03T00:00:00Z',
        updatedAt: '2024-01-03T00:00:00Z',
        createdBy: 'user-2',
        tags: ['integration'],
        isPublished: false,
        executionCount: 3
      }
    ],
    totalVersions: 1,
    isStarred: false,
    isTemplate: true,
    collaborators: ['user-2'],
    organizationId: 'org-123',
    createdAt: '2024-01-03T00:00:00Z',
    updatedAt: '2024-01-03T00:00:00Z',
    createdBy: 'user-2',
    tags: ['integration', 'slack', 'github'],
    category: 'integration',
    executionStats: {
      totalExecutions: 3,
      successRate: 1.0,
      avgDuration: 1200
    }
  }
];

describe('WorkflowManager', () => {
  const mockOnSelectWorkflow = vi.fn();
  const mockOnNewWorkflow = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default KV store responses
    mockKVStore.get.mockImplementation((key: string) => {
      if (key === 'org-org-123-workflows-index') {
        return Promise.resolve(JSON.stringify(['wf-1', 'wf-2']));
      }
      if (key === 'workflow-wf-1-metadata') {
        return Promise.resolve(JSON.stringify(sampleWorkflows[0]));
      }
      if (key === 'workflow-wf-2-metadata') {
        return Promise.resolve(JSON.stringify(sampleWorkflows[1]));
      }
      return Promise.resolve(null);
    });

    mockKVStore.set.mockResolvedValue(true);
    mockKVStore.del.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('renders workflow manager with header', async () => {
    render(() => (
      <WorkflowManager
        onSelectWorkflow={mockOnSelectWorkflow}
        onNewWorkflow={mockOnNewWorkflow}
      />
    ));

    await waitFor(() => {
      expect(screen.getByText('Workflows')).toBeInTheDocument();
      expect(screen.getByText('New Workflow')).toBeInTheDocument();
    });
  });

  it('loads and displays workflows on mount', async () => {
    createRoot(async () => {
      render(() => (
        <WorkflowManager
          onSelectWorkflow={mockOnSelectWorkflow}
          onNewWorkflow={mockOnNewWorkflow}
        />
      ));

      await waitFor(() => {
        expect(screen.getByText('Test Workflow 1')).toBeInTheDocument();
        expect(screen.getByText('Integration Workflow')).toBeInTheDocument();
      });

      expect(screen.getByText('2 workflows')).toBeInTheDocument();
    });
  });

  it('filters workflows by search query', async () => {
    createRoot(async () => {
      render(() => (
        <WorkflowManager
          onSelectWorkflow={mockOnSelectWorkflow}
          onNewWorkflow={mockOnNewWorkflow}
        />
      ));

      await waitFor(() => {
        expect(screen.getByText('Test Workflow 1')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search workflows...');
      fireEvent.input(searchInput, { target: { value: 'integration' } });

      await waitFor(() => {
        expect(screen.queryByText('Test Workflow 1')).not.toBeInTheDocument();
        expect(screen.getByText('Integration Workflow')).toBeInTheDocument();
      });
    });
  });

  it('filters workflows by category', async () => {
    createRoot(async () => {
      render(() => (
        <WorkflowManager
          onSelectWorkflow={mockOnSelectWorkflow}
          onNewWorkflow={mockOnNewWorkflow}
        />
      ));

      await waitFor(() => {
        expect(screen.getByText('Test Workflow 1')).toBeInTheDocument();
      });

      const categorySelect = screen.getByDisplayValue('All Categories');
      fireEvent.change(categorySelect, { target: { value: 'integration' } });

      await waitFor(() => {
        expect(screen.queryByText('Test Workflow 1')).not.toBeInTheDocument();
        expect(screen.getByText('Integration Workflow')).toBeInTheDocument();
      });
    });
  });

  it('displays workflow statistics correctly', async () => {
    createRoot(async () => {
      render(() => (
        <WorkflowManager
          onSelectWorkflow={mockOnSelectWorkflow}
          onNewWorkflow={mockOnNewWorkflow}
        />
      ));

      await waitFor(() => {
        // Check execution count
        expect(screen.getByText('17')).toBeInTheDocument();
        expect(screen.getByText('3')).toBeInTheDocument();

        // Check success rates
        expect(screen.getByText('94%')).toBeInTheDocument();
        expect(screen.getByText('100%')).toBeInTheDocument();
      });
    });
  });

  it('shows starred workflows with star icon', async () => {
    createRoot(async () => {
      render(() => (
        <WorkflowManager
          onSelectWorkflow={mockOnSelectWorkflow}
          onNewWorkflow={mockOnNewWorkflow}
        />
      ));

      await waitFor(() => {
        const starredWorkflow = screen.getByText('Test Workflow 1').closest('.bg-white');
        expect(starredWorkflow?.querySelector('[class*="text-yellow-500"]')).toBeInTheDocument();
      });
    });
  });

  it('displays tags correctly', async () => {
    createRoot(async () => {
      render(() => (
        <WorkflowManager
          onSelectWorkflow={mockOnSelectWorkflow}
          onNewWorkflow={mockOnNewWorkflow}
        />
      ));

      await waitFor(() => {
        expect(screen.getByText('analytics')).toBeInTheDocument();
        expect(screen.getByText('production')).toBeInTheDocument();
        expect(screen.getByText('integration')).toBeInTheDocument();
        expect(screen.getByText('slack')).toBeInTheDocument();
      });
    });
  });

  it('calls onSelectWorkflow when edit button is clicked', async () => {
    createRoot(async () => {
      render(() => (
        <WorkflowManager
          onSelectWorkflow={mockOnSelectWorkflow}
          onNewWorkflow={mockOnNewWorkflow}
        />
      ));

      await waitFor(() => {
        expect(screen.getByText('Test Workflow 1')).toBeInTheDocument();
      });

      const editButtons = screen.getAllByTitle('Edit workflow');
      fireEvent.click(editButtons[0]);

      expect(mockOnSelectWorkflow).toHaveBeenCalledWith(sampleWorkflows[0]);
    });
  });

  it('calls onNewWorkflow when New Workflow button is clicked', async () => {
    render(() => (
      <WorkflowManager
        onSelectWorkflow={mockOnSelectWorkflow}
        onNewWorkflow={mockOnNewWorkflow}
      />
    ));

    const newWorkflowButton = screen.getByText('New Workflow');
    fireEvent.click(newWorkflowButton);

    // Wait for the async callback to be called
    await waitFor(() => {
      expect(mockOnNewWorkflow).toHaveBeenCalled();
    });
  });

  it('toggles star status when star button is clicked', async () => {
    createRoot(async () => {
      render(() => (
        <WorkflowManager
          onSelectWorkflow={mockOnSelectWorkflow}
          onNewWorkflow={mockOnNewWorkflow}
        />
      ));

      await waitFor(() => {
        expect(screen.getByText('Test Workflow 1')).toBeInTheDocument();
      });

      const starButtons = screen.getAllByTitle('Star workflow');
      fireEvent.click(starButtons[0]);

      await waitFor(() => {
        expect(mockKVStore.set).toHaveBeenCalledWith(
          'workflow-wf-1-metadata',
          expect.stringContaining('"isStarred":false')
        );
      });
    });
  });

  it('deletes workflow when delete button is clicked and confirmed', async () => {
    // Mock window.confirm
    const originalConfirm = window.confirm;
    window.confirm = vi.fn(() => true);

    createRoot(async () => {
      render(() => (
        <WorkflowManager
          onSelectWorkflow={mockOnSelectWorkflow}
          onNewWorkflow={mockOnNewWorkflow}
        />
      ));

      await waitFor(() => {
        expect(screen.getByText('Test Workflow 1')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByTitle('Delete workflow');
      fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(mockKVStore.del).toHaveBeenCalledWith('workflow-wf-1-metadata');
        expect(mockKVStore.set).toHaveBeenCalledWith(
          'org-org-123-workflows-index',
          JSON.stringify(['wf-2'])
        );
        expect(mockNotifications.success).toHaveBeenCalledWith('Workflow deleted');
      });
    });

    // Restore original confirm
    window.confirm = originalConfirm;
  });

  it('does not delete workflow when deletion is not confirmed', async () => {
    const originalConfirm = window.confirm;
    window.confirm = vi.fn(() => false);

    createRoot(async () => {
      render(() => (
        <WorkflowManager
          onSelectWorkflow={mockOnSelectWorkflow}
          onNewWorkflow={mockOnNewWorkflow}
        />
      ));

      await waitFor(() => {
        expect(screen.getByText('Test Workflow 1')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByTitle('Delete workflow');
      fireEvent.click(deleteButtons[0]);

      expect(mockKVStore.del).not.toHaveBeenCalled();
    });

    window.confirm = originalConfirm;
  });

  it('shows version history when chevron is clicked', async () => {
    createRoot(async () => {
      render(() => (
        <WorkflowManager
          onSelectWorkflow={mockOnSelectWorkflow}
          onNewWorkflow={mockOnNewWorkflow}
        />
      ));

      await waitFor(() => {
        expect(screen.getByText('Test Workflow 1')).toBeInTheDocument();
      });

      const chevronButtons = screen.getAllByTitle('Version history');
      fireEvent.click(chevronButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Version History')).toBeInTheDocument();
        expect(screen.getByText('v1')).toBeInTheDocument();
        expect(screen.getByText('v2')).toBeInTheDocument();
        expect(screen.getByText('Published')).toBeInTheDocument();
      });
    });
  });

  it('sorts workflows by different criteria', async () => {
    createRoot(async () => {
      render(() => (
        <WorkflowManager
          onSelectWorkflow={mockOnSelectWorkflow}
          onNewWorkflow={mockOnNewWorkflow}
        />
      ));

      await waitFor(() => {
        expect(screen.getByText('Test Workflow 1')).toBeInTheDocument();
      });

      const sortSelect = screen.getByDisplayValue('Last Updated');
      fireEvent.change(sortSelect, { target: { value: 'name' } });

      // Workflows should be re-sorted by name
      await waitFor(() => {
        const workflows = screen.getAllByText(/Workflow/);
        expect(workflows[0]).toHaveTextContent('Integration Workflow');
        expect(workflows[1]).toHaveTextContent('Test Workflow 1');
      });
    });
  });

  it('handles KV store errors gracefully', async () => {
    mockKVStore.get.mockRejectedValue(new Error('KV store error'));

    createRoot(async () => {
      render(() => (
        <WorkflowManager
          onSelectWorkflow={mockOnSelectWorkflow}
          onNewWorkflow={mockOnNewWorkflow}
        />
      ));

      await waitFor(() => {
        expect(mockNotifications.error).toHaveBeenCalledWith('Failed to load workflows');
      });
    });
  });

  it('shows empty state when no workflows exist', async () => {
    mockKVStore.get.mockResolvedValue(null);

    createRoot(async () => {
      render(() => (
        <WorkflowManager
          onSelectWorkflow={mockOnSelectWorkflow}
          onNewWorkflow={mockOnNewWorkflow}
        />
      ));

      await waitFor(() => {
        expect(screen.getByText('No workflows yet')).toBeInTheDocument();
        expect(screen.getByText('Create your first workflow to get started')).toBeInTheDocument();
      });
    });
  });

  it('shows loading state initially', async () => {
    // Create a delayed promise to ensure loading state is visible
    let resolvePromise: (value: string | null) => void;
    const delayedPromise = new Promise<string | null>((resolve) => {
      resolvePromise = resolve;
    });

    mockKVStore.get.mockImplementation(() => delayedPromise);

    render(() => (
      <WorkflowManager
        onSelectWorkflow={mockOnSelectWorkflow}
        onNewWorkflow={mockOnNewWorkflow}
      />
    ));

    // Check for loading state
    expect(screen.getByText('Loading workflows...')).toBeInTheDocument();

    // Resolve the promise to complete the test
    resolvePromise!(JSON.stringify(['wf-1']));

    await waitFor(() => {
      expect(screen.queryByText('Loading workflows...')).not.toBeInTheDocument();
    });
  });
});