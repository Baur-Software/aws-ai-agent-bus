import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import IntegrationsSettings from '../../src/components/IntegrationsSettings'

// Mock contexts
vi.mock('../../src/contexts/MCPContext', () => ({
  useMCP: () => ({
    client: () => null // Simulate no MCP client available
  })
}))

vi.mock('../../src/contexts/NotificationContext', () => ({
  useNotifications: () => ({
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn()
  })
}))

describe('IntegrationsSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should show loading state initially', () => {
    render(() => <IntegrationsSettings />)
    expect(screen.getByText('Loading integrations...')).toBeInTheDocument()
  })

  it('should eventually render the integrations page', async () => {
    render(() => <IntegrationsSettings />)
    
    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.getByText('Integrations')).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('should display all available integrations after loading', async () => {
    render(() => <IntegrationsSettings />)
    
    await waitFor(() => {
      // Check for some key integrations
      // Note: Google Analytics integration is now dynamic based on MCP server connection
      expect(screen.getByText('Slack')).toBeInTheDocument()
      expect(screen.getByText('GitHub')).toBeInTheDocument()
      expect(screen.getByText('Stripe')).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('should display not connected status by default after loading', async () => {
    render(() => <IntegrationsSettings />)
    
    await waitFor(() => {
      const notConnectedElements = screen.getAllByText('Not connected')
      expect(notConnectedElements.length).toBeGreaterThan(0)
    }, { timeout: 3000 })
  })

  it('should have help icons with documentation links after loading', async () => {
    render(() => <IntegrationsSettings />)
    
    await waitFor(() => {
      const helpLinks = screen.getAllByTitle('View documentation')
      expect(helpLinks.length).toBe(6) // Should match number of integrations
      
      // Check that links have proper attributes
      helpLinks.forEach(link => {
        expect(link.getAttribute('target')).toBe('_blank')
        expect(link.getAttribute('rel')).toBe('noopener noreferrer')
      })
    }, { timeout: 3000 })
  })

  it('should show connect buttons for disconnected integrations after loading', async () => {
    render(() => <IntegrationsSettings />)
    
    await waitFor(() => {
      const connectButtons = screen.getAllByText('Connect')
      expect(connectButtons.length).toBeGreaterThan(0)
    }, { timeout: 3000 })
  })
})