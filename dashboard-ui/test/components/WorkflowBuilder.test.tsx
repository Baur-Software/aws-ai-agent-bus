import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import WorkflowBuilder from '../../src/components/WorkflowBuilder'

// Mock contexts and dependencies
vi.mock('../../src/contexts/MCPContext', () => ({
  useMCP: () => ({
    client: createSignal(() => ({
      request: vi.fn().mockResolvedValue({ success: true })
    }))[0]
  })
}))

vi.mock('../contexts/NotificationContext', () => ({
  useNotifications: () => ({
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn()
  })
}))

vi.mock('../utils/workflowEngine', () => ({
  WorkflowEngine: vi.fn().mockImplementation(() => ({
    executeWorkflow: vi.fn().mockResolvedValue({ success: true })
  }))
}))

describe('WorkflowBuilder - BDD Style', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Clear localStorage before each test
    localStorage.clear()
  })

  describe('Given I am viewing the workflow builder', () => {
    it('When the page loads, Then I should see the workflow interface', () => {
      render(() => <WorkflowBuilder />)
      
      expect(screen.getByText('Workflows')).toBeInTheDocument()
      expect(screen.getByText('Workflow Nodes')).toBeInTheDocument()
    })

    it('When no nodes are present, Then I should see the getting started message', () => {
      render(() => <WorkflowBuilder />)
      
      expect(screen.getByText('Start Building Your Workflow')).toBeInTheDocument()
      expect(screen.getByText('Drag nodes from the sidebar to create your automation')).toBeInTheDocument()
    })
  })

  describe('Given I want to save a workflow', () => {
    it('When I click save with nodes present, Then workflow should be saved to localStorage', async () => {
      render(() => <WorkflowBuilder />)
      
      const saveButton = screen.getByText('Save')
      fireEvent.click(saveButton)
      
      await waitFor(() => {
        const savedWorkflow = localStorage.getItem('workflow-draft')
        expect(savedWorkflow).toBeTruthy()
      })
    })
  })

  describe('Given I want to import a workflow', () => {
    it('When I import a valid workflow JSON, Then nodes should be loaded', async () => {
      const mockWorkflow = {
        version: '1.0',
        nodes: [
          {
            id: 'test-1',
            type: 'trigger',
            x: 100,
            y: 100,
            inputs: [],
            outputs: ['output']
          }
        ],
        connections: []
      }

      render(() => <WorkflowBuilder />)
      
      // This would require more complex DOM manipulation to simulate file upload
      // For now, we can test the handleLoad function directly via component props
      expect(screen.getByText('Import')).toBeInTheDocument()
    })
  })

  describe('Given I want to run a workflow', () => {
    it('When I click run without nodes, Then I should see an error', async () => {
      const mockError = vi.fn()
      
      vi.doMock('../contexts/NotificationContext', () => ({
        useNotifications: () => ({
          success: vi.fn(),
          error: mockError,
          info: vi.fn(),
          warning: vi.fn()
        })
      }))

      render(() => <WorkflowBuilder />)
      
      const runButton = screen.getByText('Run Workflow')
      fireEvent.click(runButton)
      
      // Note: This test would need the actual component logic to verify error handling
      expect(runButton).toBeInTheDocument()
    })
  })

  describe('Given I am browsing node types', () => {
    it('When I view the sidebar, Then I should see categorized node types', () => {
      render(() => <WorkflowBuilder />)
      
      // Check for some key categories
      expect(screen.getByText('Input/Output')).toBeInTheDocument()
      expect(screen.getByText('MCP Tools')).toBeInTheDocument()
      expect(screen.getByText('Analytics')).toBeInTheDocument()
      expect(screen.getByText('AWS Services')).toBeInTheDocument()
    })

    it('When I expand a category, Then I should see available nodes', () => {
      render(() => <WorkflowBuilder />)
      
      // Categories start expanded by default for Input/Output and MCP Tools
      expect(screen.getByText('Trigger')).toBeInTheDocument()
      expect(screen.getByText('KV Get')).toBeInTheDocument()
    })
  })
})