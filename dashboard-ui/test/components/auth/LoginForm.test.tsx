import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import LoginForm from '../../../src/components/auth/LoginForm';
import { AuthProvider, AuthContextType } from '../../../src/contexts/AuthContext';

// Mock the useAuth hook
const mockLogin = vi.fn();
const mockAuthContext: AuthContextType = {
  user: () => null,
  isAuthenticated: () => false,
  isLoading: () => false,
  login: mockLogin,
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
    VITE_MCP_SERVER_URL: 'http://localhost:3001',
    DEV: false
  }
});

describe('LoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render login form elements', () => {
    render(() => <LoginForm />);

    expect(screen.getByText('AI Agent Bus')).toBeInTheDocument();
    expect(screen.getByText('Multi-tenant workflow automation platform')).toBeInTheDocument();
    expect(screen.getByLabelText('Email address')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('should not show dev mode banner in production', () => {
    render(() => <LoginForm />);

    expect(screen.queryByText('Development Mode')).not.toBeInTheDocument();
    expect(screen.queryByText('Quick Dev Login')).not.toBeInTheDocument();
  });

  it('should show dev mode banner when dev mode is enabled', () => {
    vi.stubGlobal('import.meta', {
      env: {
        VITE_ENABLE_DEV_AUTH: 'true',
        VITE_MCP_SERVER_URL: 'http://localhost:3001',
        DEV: true
      }
    });

    render(() => <LoginForm />);

    expect(screen.getByText('Development Mode')).toBeInTheDocument();
    expect(screen.getByText(/Authentication is in dev mode/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /quick dev login/i })).toBeInTheDocument();
  });

  it('should handle form submission with valid credentials', async () => {
    mockLogin.mockResolvedValue(undefined);

    render(() => <LoginForm />);

    const emailInput = screen.getByLabelText('Email address');
    const passwordInput = screen.getByLabelText('Password');
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    // Fill in the form
    fireEvent.input(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.input(passwordInput, { target: { value: 'password123' } });

    // Submit the form
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123');
    });
  });

  it('should display error message on login failure', async () => {
    const errorMessage = 'Invalid credentials';
    mockLogin.mockRejectedValue(new Error(errorMessage));

    render(() => <LoginForm />);

    const emailInput = screen.getByLabelText('Email address');
    const passwordInput = screen.getByLabelText('Password');
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    // Fill in the form
    fireEvent.input(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.input(passwordInput, { target: { value: 'wrongpassword' } });

    // Submit the form
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  it('should show loading state during login', async () => {
    // Mock loading state
    const mockAuthContextLoading = {
      ...mockAuthContext,
      isLoading: () => true
    };

    vi.mocked(mockAuthContext).isLoading = () => true;

    render(() => <LoginForm />);

    const submitButton = screen.getByRole('button', { name: /signing in.../i });
    expect(submitButton).toBeDisabled();
  });

  it('should handle dev mode quick login', async () => {
    vi.stubGlobal('import.meta', {
      env: {
        VITE_ENABLE_DEV_AUTH: 'true',
        VITE_MCP_SERVER_URL: 'http://localhost:3001',
        DEV: true
      }
    });

    mockLogin.mockResolvedValue(undefined);

    render(() => <LoginForm />);

    const quickLoginBtn = screen.getByRole('button', { name: /quick dev login/i });
    fireEvent.click(quickLoginBtn);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('demo@acme.com', 'dev-password');
    });
  });

  it('should show error for dev mode quick login failure', async () => {
    vi.stubGlobal('import.meta', {
      env: {
        VITE_ENABLE_DEV_AUTH: 'true',
        VITE_MCP_SERVER_URL: 'http://localhost:3001',
        DEV: true
      }
    });

    const errorMessage = 'Dev login failed';
    mockLogin.mockRejectedValue(new Error(errorMessage));

    render(() => <LoginForm />);

    const quickLoginBtn = screen.getByRole('button', { name: /quick dev login/i });
    fireEvent.click(quickLoginBtn);

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  it('should require email and password fields', () => {
    render(() => <LoginForm />);

    const emailInput = screen.getByLabelText('Email address');
    const passwordInput = screen.getByLabelText('Password');

    expect(emailInput).toBeRequired();
    expect(passwordInput).toBeRequired();
    expect(emailInput).toHaveAttribute('type', 'email');
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  it('should have proper form attributes', () => {
    render(() => <LoginForm />);

    const emailInput = screen.getByLabelText('Email address');
    const passwordInput = screen.getByLabelText('Password');

    expect(emailInput).toHaveAttribute('autocomplete', 'email');
    expect(passwordInput).toHaveAttribute('autocomplete', 'current-password');
    expect(emailInput).toHaveAttribute('placeholder', 'demo@acme.com');
  });

  it('should show production message when not in dev mode', () => {
    render(() => <LoginForm />);

    expect(screen.getByText('Production authentication coming soon')).toBeInTheDocument();
  });

  it('should clear error when form is resubmitted', async () => {
    // First submission fails
    mockLogin.mockRejectedValueOnce(new Error('First error'));

    render(() => <LoginForm />);

    const emailInput = screen.getByLabelText('Email address');
    const passwordInput = screen.getByLabelText('Password');
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    // Fill and submit form (first time - should fail)
    fireEvent.input(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.input(passwordInput, { target: { value: 'wrongpassword' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('First error')).toBeInTheDocument();
    });

    // Second submission succeeds
    mockLogin.mockResolvedValueOnce(undefined);

    // Change password and submit again
    fireEvent.input(passwordInput, { target: { value: 'correctpassword' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.queryByText('First error')).not.toBeInTheDocument();
    });
  });
});