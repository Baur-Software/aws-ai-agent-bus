// Global test setup for SolidJS components
import { vi } from 'vitest';

// Mock all context providers globally
vi.mock('../components/contexts/MCPContext', () => ({
  useMCP: () => ({
    client: () => ({}),
    isConnected: () => true,
    serverVersion: () => '1.0.0',
    availableTools: () => [],
    loading: () => false,
    error: () => null,
    executeTool: vi.fn().mockResolvedValue({}),
    clearError: () => {},
    refresh: () => {}
  }),
  MCPProvider: ({ children }: { children: any }) => children
}));

vi.mock('../components/contexts/KVStoreContext', () => ({
  useKVStore: () => ({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(true),
    del: vi.fn().mockResolvedValue(true),
    getMultiple: vi.fn().mockResolvedValue([])
  }),
  KVStoreProvider: ({ children }: { children: any }) => children
}));

vi.mock('../components/contexts/OrganizationContext', () => ({
  useOrganization: () => ({
    user: () => ({
      id: 'test-user',
      email: 'test@example.com',
      name: 'Test User',
      organizations: [],
      currentOrganizationId: 'test-org'
    }),
    currentOrganization: () => ({
      id: 'test-org',
      name: 'Test Org',
      slug: 'test-org',
      workspaceType: 'medium',
      description: 'Test organization',
      memberCount: 1,
      role: 'owner' as const,
      createdAt: new Date().toISOString()
    }),
    organizations: () => [],
    switchOrganization: () => {},
    createOrganization: vi.fn().mockResolvedValue({
      id: 'new-org',
      name: 'New Org',
      slug: 'new-org',
      memberCount: 1,
      role: 'owner' as const,
      createdAt: new Date().toISOString()
    }),
    updateOrganization: vi.fn().mockResolvedValue(undefined),
    loading: () => false,
    error: () => null
  }),
  OrganizationProvider: ({ children }: { children: any }) => children
}));

vi.mock('../components/contexts/NotificationContext', () => ({
  useNotifications: () => ({
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn()
  }),
  NotificationProvider: ({ children }: { children: any }) => children
}));

vi.mock('../components/contexts/HeaderContext', () => ({
  usePageHeader: () => ({
    title: () => 'Test',
    description: () => 'Test description',
    setTitle: vi.fn(),
    setDescription: vi.fn()
  }),
  HeaderProvider: ({ children }: { children: any }) => children
}));

// Mock lucide-solid icons - simple factory approach
vi.mock('lucide-solid', () => {
  // Create a named mock component factory
  const createMockIcon = (name: string) => {
    const MockIcon = (props: any) => null;
    Object.defineProperty(MockIcon, 'name', { value: name });
    return MockIcon;
  };

  // Return commonly used icons
  return {
    // Basic icons
    Shield: createMockIcon('Shield'),
    ArrowRight: createMockIcon('ArrowRight'),
    Star: createMockIcon('Star'),
    Edit: createMockIcon('Edit'),
    Trash: createMockIcon('Trash'),
    ChevronDown: createMockIcon('ChevronDown'),
    Search: createMockIcon('Search'),
    Plus: createMockIcon('Plus'),
    Settings: createMockIcon('Settings'),
    User: createMockIcon('User'),
    Check: createMockIcon('Check'),
    X: createMockIcon('X'),
    AlertTriangle: createMockIcon('AlertTriangle'),
    Info: createMockIcon('Info'),
    // WorkflowManager icons
    FolderOpen: createMockIcon('FolderOpen'),
    Clock: createMockIcon('Clock'),
    Users: createMockIcon('Users'),
    Eye: createMockIcon('Eye'),
    Edit3: createMockIcon('Edit3'),
    Trash2: createMockIcon('Trash2'),
    Copy: createMockIcon('Copy'),
    Download: createMockIcon('Download'),
    Upload: createMockIcon('Upload'),
    Archive: createMockIcon('Archive'),
    Filter: createMockIcon('Filter'),
    SortAsc: createMockIcon('SortAsc'),
    FileText: createMockIcon('FileText'),
    Play: createMockIcon('Play'),
    ChevronRight: createMockIcon('ChevronRight'),
    Calendar: createMockIcon('Calendar'),
    Tag: createMockIcon('Tag'),
    // WorkflowNodeDetails icons
    Save: createMockIcon('Save'),
    Code: createMockIcon('Code'),
    Zap: createMockIcon('Zap'),
    MessageSquare: createMockIcon('MessageSquare'),
    BarChart3: createMockIcon('BarChart3'),
    Cloud: createMockIcon('Cloud'),
    CreditCard: createMockIcon('CreditCard'),
    Lock: createMockIcon('Lock'),
    Bot: createMockIcon('Bot'),
    // Additional commonly used icons
    File: createMockIcon('File'),
    Mail: createMockIcon('Mail'),
    Send: createMockIcon('Send'),
    Loader2: createMockIcon('Loader2'),
    AlertCircle: createMockIcon('AlertCircle'),
    CheckCircle: createMockIcon('CheckCircle'),
    EyeOff: createMockIcon('EyeOff'),
    ArrowLeft: createMockIcon('ArrowLeft'),
    Server: createMockIcon('Server')
  };
});