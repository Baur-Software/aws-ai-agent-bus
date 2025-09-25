import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import AuthGuard from '../../../src/components/auth/AuthGuard';
import { AuthContextType } from '../../../src/contexts/AuthContext';

// Mock LoginForm component
vi.mock('../../../src/components/auth/LoginForm', () => ({
  default: () => <div data-testid="login-form">Login Form</div>
}));

// Mock the useAuth hook
let mockAuthState: {
  user: any;
  isAuthenticated: boolean;
  isLoading: boolean;
};

const mockAuthContext: AuthContextType = {
  user: () => mockAuthState.user,
  isAuthenticated: () => mockAuthState.isAuthenticated,
  isLoading: () => mockAuthState.isLoading,
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  switchOrganization: vi.fn()
};

vi.mock('../../../src/contexts/AuthContext', async () => {
  const actual = await vi.importActual('../../../src/contexts/AuthContext');
  return {
    ...actual,
    useAuth: () => mockAuthContext
  };
});

// Mock import.meta.env
vi.stubGlobal('import.meta', {
  env: {
    VITE_ENABLE_DEV_AUTH: 'false',
    DEV: false
  }
});

// Test component to wrap in AuthGuard
function ProtectedComponent() {
  return <div data-testid="protected-content">Protected Content</div>;
}

describe('AuthGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset auth state to default (not loading, not authenticated)
    mockAuthState = {
      user: null,
      isAuthenticated: false,
      isLoading: false
    };
  });

  it('should show loading spinner when authentication is loading', () => {
    mockAuthState.isLoading = true;

    render(() => (
      <AuthGuard>
        <ProtectedComponent />
      </AuthGuard>
    ));

    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.getByRole('status', { hidden: true })).toBeInTheDocument(); // Loading spinner
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    expect(screen.queryByTestId('login-form')).not.toBeInTheDocument();
  });

  it('should show login form when user is not authenticated', () => {
    mockAuthState.isLoading = false;
    mockAuthState.isAuthenticated = false;

    render(() => (
      <AuthGuard>
        <ProtectedComponent />
      </AuthGuard>
    ));

    expect(screen.getByTestId('login-form')).toBeInTheDocument();
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
  });

  it('should show protected content when user is authenticated', () => {
    mockAuthState.isLoading = false;
    mockAuthState.isAuthenticated = true;
    mockAuthState.user = {
      userId: 'user-123',
      organizationId: 'org-123',
      role: 'admin',
      email: 'test@example.com',
      name: 'Test User'
    };

    render(() => (
      <AuthGuard>
        <ProtectedComponent />
      </AuthGuard>
    ));

    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    expect(screen.queryByTestId('login-form')).not.toBeInTheDocument();
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
  });

  it('should log auth state in development mode', () => {
    vi.stubGlobal('import.meta', {
      env: { DEV: true }
    });

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    mockAuthState.isLoading = false;
    mockAuthState.isAuthenticated = true;
    mockAuthState.user = {
      userId: 'user-123',
      organizationId: 'org-123',
      role: 'admin'
    };

    render(() => (
      <AuthGuard>
        <ProtectedComponent />
      </AuthGuard>
    ));

    expect(consoleSpy).toHaveBeenCalledWith('🔐 Auth state:', {
      isAuthenticated: true,
      isLoading: false,
      user: mockAuthState.user
    });

    consoleSpy.mockRestore();
  });

  it('should not log auth state in production mode', () => {
    vi.stubGlobal('import.meta', {
      env: { DEV: false }
    });

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    mockAuthState.isLoading = false;
    mockAuthState.isAuthenticated = true;

    render(() => (
      <AuthGuard>
        <ProtectedComponent />
      </AuthGuard>
    ));

    expect(consoleSpy).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it('should handle transition from loading to authenticated', async () => {
    // Start with loading state
    mockAuthState.isLoading = true;
    mockAuthState.isAuthenticated = false;

    const { rerender } = render(() => (
      <AuthGuard>
        <ProtectedComponent />
      </AuthGuard>
    ));

    expect(screen.getByText('Loading...')).toBeInTheDocument();

    // Simulate authentication completion
    mockAuthState.isLoading = false;
    mockAuthState.isAuthenticated = true;
    mockAuthState.user = {
      userId: 'user-123',
      organizationId: 'org-123',
      role: 'admin'
    };

    rerender(() => (
      <AuthGuard>
        <ProtectedComponent />
      </AuthGuard>
    ));

    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
  });

  it('should handle transition from loading to unauthenticated', async () => {
    // Start with loading state
    mockAuthState.isLoading = true;
    mockAuthState.isAuthenticated = false;

    const { rerender } = render(() => (
      <AuthGuard>
        <ProtectedComponent />
      </AuthGuard>
    ));

    expect(screen.getByText('Loading...')).toBeInTheDocument();

    // Simulate authentication completion (failed)
    mockAuthState.isLoading = false;
    mockAuthState.isAuthenticated = false;
    mockAuthState.user = null;

    rerender(() => (
      <AuthGuard>
        <ProtectedComponent />
      </AuthGuard>
    ));

    expect(screen.getByTestId('login-form')).toBeInTheDocument();
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
  });

  it('should handle authentication state changes', async () => {
    // Start unauthenticated
    mockAuthState.isLoading = false;
    mockAuthState.isAuthenticated = false;

    const { rerender } = render(() => (
      <AuthGuard>
        <ProtectedComponent />
      </AuthGuard>
    ));

    expect(screen.getByTestId('login-form')).toBeInTheDocument();

    // User logs in
    mockAuthState.isAuthenticated = true;
    mockAuthState.user = {
      userId: 'user-123',
      organizationId: 'org-123',
      role: 'admin'
    };

    rerender(() => (
      <AuthGuard>
        <ProtectedComponent />
      </AuthGuard>
    ));

    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    expect(screen.queryByTestId('login-form')).not.toBeInTheDocument();

    // User logs out
    mockAuthState.isAuthenticated = false;
    mockAuthState.user = null;

    rerender(() => (
      <AuthGuard>
        <ProtectedComponent />
      </AuthGuard>
    ));

    expect(screen.getByTestId('login-form')).toBeInTheDocument();
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  it('should render multiple children correctly when authenticated', () => {
    mockAuthState.isLoading = false;
    mockAuthState.isAuthenticated = true;
    mockAuthState.user = { userId: 'user-123' };

    render(() => (
      <AuthGuard>
        <div data-testid="child1">Child 1</div>
        <div data-testid="child2">Child 2</div>
      </AuthGuard>
    ));

    expect(screen.getByTestId('child1')).toBeInTheDocument();
    expect(screen.getByTestId('child2')).toBeInTheDocument();
  });

  it('should have proper loading screen styling', () => {
    mockAuthState.isLoading = true;

    render(() => (
      <AuthGuard>
        <ProtectedComponent />
      </AuthGuard>
    ));

    const loadingContainer = screen.getByText('Loading...').closest('div');
    expect(loadingContainer).toHaveClass('min-h-screen');
    expect(loadingContainer).toHaveClass('bg-gray-50');
    expect(loadingContainer).toHaveClass('flex');
    expect(loadingContainer).toHaveClass('items-center');
    expect(loadingContainer).toHaveClass('justify-center');

    const spinner = screen.getByRole('status', { hidden: true });
    expect(spinner).toHaveClass('animate-spin');
    expect(spinner).toHaveClass('rounded-full');
    expect(spinner).toHaveClass('border-b-2');
    expect(spinner).toHaveClass('border-blue-600');
  });
});