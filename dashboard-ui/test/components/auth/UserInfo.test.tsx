import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';
import UserInfo from '../../../src/components/auth/UserInfo';
import { AuthContextType } from '../../../src/contexts/AuthContext';

// Mock the useAuth hook
let mockUser: any = null;
const mockLogout = vi.fn();
const mockSwitchOrganization = vi.fn();

const mockAuthContext: AuthContextType = {
  user: () => mockUser,
  isAuthenticated: () => !!mockUser,
  isLoading: () => false,
  login: vi.fn(),
  register: vi.fn(),
  logout: mockLogout,
  switchOrganization: mockSwitchOrganization
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

describe('UserInfo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = {
      userId: 'user-123',
      organizationId: 'org-123',
      role: 'admin',
      email: 'test@example.com',
      name: 'Test User'
    };
  });

  it('should render user info button with user details', () => {
    render(() => <UserInfo />);

    // Should show user avatar with initial
    expect(screen.getByText('T')).toBeInTheDocument(); // First letter of name

    // Should show user name and org
    expect(screen.getByText('Test User')).toBeInTheDocument();
    expect(screen.getByText('org-123')).toBeInTheDocument();

    // Should have dropdown arrow
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('should use email initial if name is not available', () => {
    mockUser.name = undefined;

    render(() => <UserInfo />);

    expect(screen.getByText('t')).toBeInTheDocument(); // First letter of email
    expect(screen.getByText('User')).toBeInTheDocument(); // Default name
  });

  it('should use question mark if neither name nor email available', () => {
    mockUser.name = undefined;
    mockUser.email = undefined;

    render(() => <UserInfo />);

    expect(screen.getByText('?')).toBeInTheDocument();
    expect(screen.getByText('User')).toBeInTheDocument(); // Default name
    expect(screen.getByText('No org')).toBeInTheDocument(); // Default org text when organizationId is missing
  });

  it('should show dropdown menu when clicked', async () => {
    render(() => <UserInfo />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('test@example.com')).toBeInTheDocument();
    });

    expect(screen.getByText('org-123 • admin')).toBeInTheDocument();
    expect(screen.getByText('Profile Settings')).toBeInTheDocument();
    expect(screen.getByText('Organization')).toBeInTheDocument();
    expect(screen.getByText('Sign Out')).toBeInTheDocument();
  });

  it('should hide dropdown menu when clicked again', async () => {
    render(() => <UserInfo />);

    const button = screen.getByRole('button');

    // Open dropdown
    fireEvent.click(button);
    await waitFor(() => {
      expect(screen.getByText('Profile Settings')).toBeInTheDocument();
    });

    // Close dropdown
    fireEvent.click(button);
    await waitFor(() => {
      expect(screen.queryByText('Profile Settings')).not.toBeInTheDocument();
    });
  });

  it('should show dev mode badge when in dev mode', async () => {
    vi.stubGlobal('import.meta', {
      env: {
        VITE_ENABLE_DEV_AUTH: 'true',
        DEV: true
      }
    });

    render(() => <UserInfo />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('Dev Mode')).toBeInTheDocument();
    });
  });

  it('should not show dev mode badge in production', async () => {
    render(() => <UserInfo />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('Profile Settings')).toBeInTheDocument();
    });

    expect(screen.queryByText('Dev Mode')).not.toBeInTheDocument();
  });

  it('should call logout when sign out is clicked', async () => {
    mockLogout.mockResolvedValue(undefined);

    render(() => <UserInfo />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('Sign Out')).toBeInTheDocument();
    });

    const signOutBtn = screen.getByText('Sign Out');
    fireEvent.click(signOutBtn);

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalled();
    });
  });

  it('should close dropdown after logout', async () => {
    mockLogout.mockResolvedValue(undefined);

    render(() => <UserInfo />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('Sign Out')).toBeInTheDocument();
    });

    const signOutBtn = screen.getByText('Sign Out');
    fireEvent.click(signOutBtn);

    await waitFor(() => {
      expect(screen.queryByText('Profile Settings')).not.toBeInTheDocument();
    });
  });

  it('should close dropdown when profile settings is clicked', async () => {
    render(() => <UserInfo />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('Profile Settings')).toBeInTheDocument();
    });

    const profileBtn = screen.getByText('Profile Settings');
    fireEvent.click(profileBtn);

    await waitFor(() => {
      expect(screen.queryByText('Profile Settings')).not.toBeInTheDocument();
    });
  });

  it('should close dropdown when organization settings is clicked', async () => {
    render(() => <UserInfo />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('Organization')).toBeInTheDocument();
    });

    const orgBtn = screen.getByText('Organization');
    fireEvent.click(orgBtn);

    await waitFor(() => {
      expect(screen.queryByText('Organization')).not.toBeInTheDocument();
    });
  });

  it('should close dropdown when backdrop is clicked', async () => {
    render(() => <UserInfo />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('Profile Settings')).toBeInTheDocument();
    });

    // Click backdrop
    const backdrop = document.querySelector('.fixed.inset-0');
    expect(backdrop).toBeInTheDocument();
    fireEvent.click(backdrop!);

    await waitFor(() => {
      expect(screen.queryByText('Profile Settings')).not.toBeInTheDocument();
    });
  });

  it('should have proper button styling', () => {
    render(() => <UserInfo />);

    const button = screen.getByRole('button');

    expect(button).toHaveClass('flex');
    expect(button).toHaveClass('items-center');
    expect(button).toHaveClass('space-x-2');
    expect(button).toHaveClass('px-3');
    expect(button).toHaveClass('py-2');
    expect(button).toHaveClass('rounded-md');
    expect(button).toHaveClass('text-sm');
    expect(button).toHaveClass('font-medium');
    expect(button).toHaveClass('text-gray-700');
    expect(button).toHaveClass('hover:bg-gray-100');
    expect(button).toHaveClass('transition-colors');
  });

  it('should have proper avatar styling', () => {
    render(() => <UserInfo />);

    const avatar = screen.getByText('T');
    expect(avatar).toHaveClass('w-8');
    expect(avatar).toHaveClass('h-8');
    expect(avatar).toHaveClass('bg-blue-600');
    expect(avatar).toHaveClass('rounded-full');
    expect(avatar).toHaveClass('flex');
    expect(avatar).toHaveClass('items-center');
    expect(avatar).toHaveClass('justify-center');
    expect(avatar).toHaveClass('text-white');
    expect(avatar).toHaveClass('text-sm');
    expect(avatar).toHaveClass('font-semibold');
  });

  it('should display correct user information in dropdown', async () => {
    render(() => <UserInfo />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      // User details in dropdown
      expect(screen.getByText('Test User')).toBeInTheDocument();
      expect(screen.getByText('test@example.com')).toBeInTheDocument();
      expect(screen.getByText('org-123 • admin')).toBeInTheDocument();
    });
  });

  it('should handle missing organization ID gracefully', async () => {
    mockUser.organizationId = undefined;

    render(() => <UserInfo />);

    expect(screen.getByText('No org')).toBeInTheDocument();

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('• admin')).toBeInTheDocument(); // Should still show role
    });
  });

  it('should have proper dropdown menu styling', async () => {
    render(() => <UserInfo />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      const dropdown = screen.getByText('Profile Settings').closest('div');
      expect(dropdown).toHaveClass('absolute');
      expect(dropdown).toHaveClass('right-0');
      expect(dropdown).toHaveClass('mt-2');
      expect(dropdown).toHaveClass('w-64');
      expect(dropdown).toHaveClass('bg-white');
      expect(dropdown).toHaveClass('rounded-md');
      expect(dropdown).toHaveClass('shadow-lg');
      expect(dropdown).toHaveClass('py-1');
      expect(dropdown).toHaveClass('z-50');
      expect(dropdown).toHaveClass('border');
      expect(dropdown).toHaveClass('border-gray-200');
    });
  });
});