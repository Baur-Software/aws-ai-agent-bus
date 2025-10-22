import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock fetch globally
global.fetch = vi.fn();

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock clipboard API
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: vi.fn().mockResolvedValue(undefined),
    readText: vi.fn().mockResolvedValue(''),
  },
  writable: true,
});

// Mock console methods to reduce noise during testing
const originalConsoleError = console.error;
console.error = (...args) => {
  // Suppress specific known warnings/errors in tests
  const message = args[0];
  if (
    typeof message === 'string' &&
    (message.includes('Warning:') ||
     message.includes('React does not recognize') ||
     message.includes('validateDOMNesting'))
  ) {
    return;
  }
  originalConsoleError.apply(console, args);
};

// Setup cleanup for each test
afterEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = '';
});

// Global test helpers
declare global {
  var testHelpers: {
    createMockWorkflow: () => any;
    createMockNode: (type: string) => any;
    createMockConnection: (from: string, to: string) => any;
    wait: (ms: number) => Promise<void>;
  };
}

global.testHelpers = {
  createMockWorkflow: () => ({
    id: 'test-workflow',
    name: 'Test Workflow',
    description: 'A test workflow',
    currentVersion: 1,
    versions: [{
      id: 'test-workflow-v1',
      version: 1,
      name: 'Initial Version',
      description: '',
      nodes: [],
      connections: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'test-user',
      tags: [],
      isPublished: false,
      executionCount: 0
    }],
    totalVersions: 1,
    isStarred: false,
    isTemplate: false,
    collaborators: [],
    organizationId: 'test-org',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'test-user',
    tags: [],
    category: 'automation',
    executionStats: {
      totalExecutions: 0,
      successRate: 0,
      avgDuration: 0
    }
  }),

  createMockNode: (type: string = 'trigger') => ({
    id: `node-${Math.random().toString(36).substr(2, 9)}`,
    type,
    x: 100,
    y: 100,
    inputs: type === 'trigger' ? [] : ['input'],
    outputs: type === 'output' ? [] : ['output'],
    config: {}
  }),

  createMockConnection: (from: string, to: string) => ({
    id: `${from}-${to}`,
    from,
    to,
    fromPort: 'output',
    toPort: 'input'
  }),

  wait: (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
};

// Mock all SolidJS context providers globally
vi.mock('./contexts/MCPContext', () => ({
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

vi.mock('./contexts/KVStoreContext', () => ({
  useKVStore: () => ({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(true),
    del: vi.fn().mockResolvedValue(true),
    getMultiple: vi.fn().mockResolvedValue([])
  }),
  KVStoreProvider: ({ children }: { children: any }) => children
}));

vi.mock('./contexts/OrganizationContext', () => {
  const { createContext } = require('solid-js');
  const MockOrganizationContext = createContext();

  return {
    default: MockOrganizationContext,
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
  };
});

vi.mock('./contexts/NotificationContext', () => ({
  useNotifications: () => ({
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn()
  }),
  NotificationProvider: ({ children }: { children: any }) => children
}));

vi.mock('./contexts/HeaderContext', () => ({
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

  // Return commonly used icons - will expand as needed
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
    // Settings page icons
    Plug: createMockIcon('Plug'),
    Bell: createMockIcon('Bell'),
    Palette: createMockIcon('Palette'),
    Database: createMockIcon('Database'),
    Menu: createMockIcon('Menu'),
    // Chat icons
    Send: createMockIcon('Send'),
    Bot: createMockIcon('Bot'),
    Loader2: createMockIcon('Loader2'),
    AlertCircle: createMockIcon('AlertCircle'),
    CheckCircle: createMockIcon('CheckCircle'),
    // Layout icons
    TriangleAlert: createMockIcon('TriangleAlert'),
    // Sidebar icons
    EyeOff: createMockIcon('EyeOff'),
    ArrowLeft: createMockIcon('ArrowLeft'),
    Server: createMockIcon('Server'),
    // WorkflowNodeDetails icons
    Save: createMockIcon('Save'),
    Code: createMockIcon('Code'),
    Zap: createMockIcon('Zap'),
    MessageSquare: createMockIcon('MessageSquare'),
    BarChart3: createMockIcon('BarChart3'),
    Cloud: createMockIcon('Cloud'),
    CreditCard: createMockIcon('CreditCard'),
    Lock: createMockIcon('Lock'),
    // Additional commonly used icons
    File: createMockIcon('File'),
    Mail: createMockIcon('Mail'),
    Github: createMockIcon('Github'),
    Linkedin: createMockIcon('Linkedin'),
    Youtube: createMockIcon('Youtube'),
    Twitter: createMockIcon('Twitter'),
    RefreshCw: createMockIcon('RefreshCw'),
    Globe: createMockIcon('Globe'),
    Monitor: createMockIcon('Monitor'),
    Activity: createMockIcon('Activity'),
    // Canvas and panel icons
    ZoomIn: createMockIcon('ZoomIn'),
    ZoomOut: createMockIcon('ZoomOut'),
    Pin: createMockIcon('Pin'),
    PinOff: createMockIcon('PinOff'),
    Move: createMockIcon('Move'),
    RotateCcw: createMockIcon('RotateCcw'),
    Maximize2: createMockIcon('Maximize2'),
    Minimize2: createMockIcon('Minimize2'),
    Hand: createMockIcon('Hand')
  };
});