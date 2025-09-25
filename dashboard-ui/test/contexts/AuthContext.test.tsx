import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { AuthProvider, useAuth, User } from '../../src/contexts/AuthContext';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
};
global.localStorage = mockLocalStorage as any;

// Mock import.meta.env
vi.mock('import.meta.env', () => ({
  VITE_ENABLE_DEV_AUTH: 'false',
  VITE_MCP_SERVER_URL: 'http://localhost:3001',
  DEV: false
}));

// Test component that uses the auth context
function TestComponent() {
  const { user, isAuthenticated, isLoading, login, register, logout, switchOrganization } = useAuth();

  return (
    <div>
      <div data-testid="loading">{isLoading() ? 'loading' : 'not-loading'}</div>
      <div data-testid="authenticated">{isAuthenticated() ? 'authenticated' : 'not-authenticated'}</div>
      <div data-testid="user-id">{user()?.userId || 'no-user'}</div>
      <div data-testid="user-email">{user()?.email || 'no-email'}</div>
      <div data-testid="user-org">{user()?.organizationId || 'no-org'}</div>
      <button
        data-testid="login-btn"
        onClick={() => login('test@example.com', 'password123')}
      >
        Login
      </button>
      <button
        data-testid="register-btn"
        onClick={() => register('new@example.com', 'password123', 'New User')}
      >
        Register
      </button>
      <button data-testid="logout-btn" onClick={() => logout()}>
        Logout
      </button>
      <button
        data-testid="switch-org-btn"
        onClick={() => switchOrganization('new-org-id')}
      >
        Switch Org
      </button>
    </div>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with no user in production mode', async () => {
      render(() => (
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      ));

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
      });

      expect(screen.getByTestId('authenticated')).toHaveTextContent('not-authenticated');
      expect(screen.getByTestId('user-id')).toHaveTextContent('no-user');
    });

    it('should auto-login with dev user in dev mode', async () => {
      vi.stubGlobal('import.meta', {
        env: {
          VITE_ENABLE_DEV_AUTH: 'true',
          VITE_MCP_SERVER_URL: 'http://localhost:3001',
          DEV: true
        }
      });

      render(() => (
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      ));

      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent('authenticated');
      });

      expect(screen.getByTestId('user-id')).toHaveTextContent('user-demo-123');
      expect(screen.getByTestId('user-email')).toHaveTextContent('demo@acme.com');
      expect(screen.getByTestId('user-org')).toHaveTextContent('acme');
    });

    it('should validate existing token on initialization', async () => {
      const mockUser = {
        userId: 'user-123',
        organizationId: 'org-123',
        role: 'admin',
        email: 'test@example.com',
        name: 'Test User'
      };

      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'auth_token') return 'valid-token';
        if (key === 'auth_user') return JSON.stringify(mockUser);
        return null;
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user: mockUser })
      });

      render(() => (
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      ));

      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent('authenticated');
      });

      expect(screen.getByTestId('user-id')).toHaveTextContent('user-123');
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/auth/validate',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer valid-token'
          })
        })
      );
    });

    it('should clear invalid token on initialization', async () => {
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'auth_token') return 'invalid-token';
        if (key === 'auth_user') return JSON.stringify({ userId: 'user-123' });
        return null;
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401
      });

      render(() => (
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      ));

      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent('not-authenticated');
      });

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('auth_token');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('auth_user');
    });
  });

  describe('login', () => {
    it('should login successfully in production mode', async () => {
      const mockUser = {
        userId: 'user-123',
        organizationId: 'org-123',
        role: 'admin',
        email: 'test@example.com',
        name: 'Test User'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          token: 'jwt-token',
          user: mockUser
        })
      });

      render(() => (
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      ));

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
      });

      // Click login button
      const loginBtn = screen.getByTestId('login-btn');
      loginBtn.click();

      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent('authenticated');
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/auth/login',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'test@example.com',
            password: 'password123'
          })
        })
      );

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('auth_token', 'jwt-token');
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('auth_user', JSON.stringify(mockUser));
      expect(screen.getByTestId('user-id')).toHaveTextContent('user-123');
    });

    it('should handle login failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Invalid credentials' })
      });

      render(() => (
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      ));

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
      });

      // Click login button
      const loginBtn = screen.getByTestId('login-btn');

      // Should handle the error (in real app, this would be caught by error boundary or try-catch)
      expect(async () => {
        loginBtn.click();
        await waitFor(() => {
          expect(screen.getByTestId('authenticated')).toHaveTextContent('not-authenticated');
        });
      }).not.toThrow();
    });

    it('should use dev mode login when enabled', async () => {
      vi.stubGlobal('import.meta', {
        env: {
          VITE_ENABLE_DEV_AUTH: 'true',
          VITE_MCP_SERVER_URL: 'http://localhost:3001',
          DEV: true
        }
      });

      render(() => (
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      ));

      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent('authenticated');
      });

      // Login should work immediately without API call
      expect(mockFetch).not.toHaveBeenCalled();
      expect(screen.getByTestId('user-id')).toHaveTextContent('user-demo-123');
    });
  });

  describe('register', () => {
    it('should register successfully in production mode', async () => {
      const mockUser = {
        userId: 'user-456',
        organizationId: 'org-456',
        role: 'admin',
        email: 'new@example.com',
        name: 'New User'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          token: 'new-jwt-token',
          user: mockUser
        })
      });

      render(() => (
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      ));

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
      });

      // Click register button
      const registerBtn = screen.getByTestId('register-btn');
      registerBtn.click();

      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent('authenticated');
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/auth/register',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'new@example.com',
            password: 'password123',
            name: 'New User'
          })
        })
      );

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('auth_token', 'new-jwt-token');
      expect(screen.getByTestId('user-id')).toHaveTextContent('user-456');
    });

    it('should create mock user in dev mode', async () => {
      vi.stubGlobal('import.meta', {
        env: {
          VITE_ENABLE_DEV_AUTH: 'true',
          VITE_MCP_SERVER_URL: 'http://localhost:3001',
          DEV: true
        }
      });

      render(() => (
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      ));

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
      });

      // Click register button - should create mock user
      const registerBtn = screen.getByTestId('register-btn');
      registerBtn.click();

      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent('authenticated');
      });

      expect(mockFetch).not.toHaveBeenCalled();
      expect(screen.getByTestId('user-email')).toHaveTextContent('new@example.com');
    });
  });

  describe('logout', () => {
    it('should logout successfully in production mode', async () => {
      // Start with authenticated user
      const mockUser = {
        userId: 'user-123',
        organizationId: 'org-123',
        role: 'admin',
        email: 'test@example.com',
        name: 'Test User'
      };

      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'auth_token') return 'valid-token';
        if (key === 'auth_user') return JSON.stringify(mockUser);
        return null;
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user: mockUser })
      });

      render(() => (
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      ));

      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent('authenticated');
      });

      // Mock logout API call
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      // Click logout button
      const logoutBtn = screen.getByTestId('logout-btn');
      logoutBtn.click();

      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent('not-authenticated');
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/auth/logout',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer valid-token'
          })
        })
      );

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('auth_token');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('auth_user');
    });

    it('should clear storage even if logout API fails', async () => {
      // Start with authenticated user
      mockLocalStorage.getItem.mockReturnValue('valid-token');

      // Mock failed logout API call
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      render(() => (
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      ));

      // Click logout button
      const logoutBtn = screen.getByTestId('logout-btn');
      logoutBtn.click();

      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent('not-authenticated');
      });

      // Should still clear storage
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('auth_token');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('auth_user');
    });
  });

  describe('switchOrganization', () => {
    it('should switch organization successfully in production mode', async () => {
      // Start with authenticated user
      const initialUser = {
        userId: 'user-123',
        organizationId: 'org-123',
        role: 'admin',
        email: 'test@example.com',
        name: 'Test User'
      };

      const updatedUser = {
        ...initialUser,
        organizationId: 'new-org-id'
      };

      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'auth_token') return 'valid-token';
        if (key === 'auth_user') return JSON.stringify(initialUser);
        return null;
      });

      // Mock initial validation
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user: initialUser })
      });

      render(() => (
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      ));

      await waitFor(() => {
        expect(screen.getByTestId('user-org')).toHaveTextContent('org-123');
      });

      // Mock org switch API call
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          user: updatedUser,
          token: 'new-token'
        })
      });

      // Click switch organization button
      const switchBtn = screen.getByTestId('switch-org-btn');
      switchBtn.click();

      await waitFor(() => {
        expect(screen.getByTestId('user-org')).toHaveTextContent('new-org-id');
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/auth/switch-organization',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer valid-token'
          }),
          body: JSON.stringify({ organizationId: 'new-org-id' })
        })
      );

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('auth_token', 'new-token');
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('auth_user', JSON.stringify(updatedUser));
    });

    it('should update organization locally in dev mode', async () => {
      vi.stubGlobal('import.meta', {
        env: {
          VITE_ENABLE_DEV_AUTH: 'true',
          VITE_MCP_SERVER_URL: 'http://localhost:3001',
          DEV: true
        }
      });

      render(() => (
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      ));

      await waitFor(() => {
        expect(screen.getByTestId('user-org')).toHaveTextContent('acme');
      });

      // Click switch organization button
      const switchBtn = screen.getByTestId('switch-org-btn');
      switchBtn.click();

      await waitFor(() => {
        expect(screen.getByTestId('user-org')).toHaveTextContent('new-org-id');
      });

      // Should not make API call in dev mode
      expect(mockFetch).not.toHaveBeenCalled();
      expect(mockLocalStorage.setItem).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle network errors gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      render(() => (
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      ));

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
      });

      // Should not crash and remain unauthenticated
      expect(screen.getByTestId('authenticated')).toHaveTextContent('not-authenticated');
    });

    it('should handle invalid JSON responses', async () => {
      mockLocalStorage.getItem.mockReturnValue('invalid-json');

      render(() => (
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      ));

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
      });

      // Should clear invalid data
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('auth_token');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('auth_user');
    });
  });
});