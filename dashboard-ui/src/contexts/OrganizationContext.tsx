import { createContext, useContext, createSignal, createResource, onMount, JSX } from 'solid-js';
import { useDashboardServer } from './DashboardServerContext';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  description?: string;
  memberCount: number;
  role: 'owner' | 'admin' | 'member';
  createdAt: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  organizations: Organization[];
  currentOrganizationId?: string;
}

export interface OrganizationContextValue {
  // Current user and org
  user: () => User | null;
  currentOrganization: () => Organization | null;

  // Resources
  organizations: () => Organization[];

  // Actions
  switchOrganization: (orgId: string) => void;
  createOrganization: (name: string, description?: string) => Promise<Organization>;
  updateOrganization: (orgId: string, updates: Partial<Organization>) => Promise<void>;

  // Loading states
  loading: () => boolean;
  error: () => string | null;
}

const OrganizationContext = createContext<OrganizationContextValue>();

// Mock API service (replace with real API calls)
class OrganizationService {
  static async getCurrentUser(): Promise<User> {
    // Mock user data - in production, get from JWT/session
    return {
      id: 'user_123',
      email: 'demo@example.com',
      name: 'Demo User',
      avatar: 'https://via.placeholder.com/40',
      organizations: [
        {
          id: 'org_123',
          name: 'Acme Corporation',
          slug: 'acme',
          description: 'Building the future',
          memberCount: 15,
          role: 'admin',
          createdAt: '2024-01-01T00:00:00Z'
        },
        {
          id: 'org_456',
          name: 'Personal Projects',
          slug: 'personal',
          description: 'My personal workspace',
          memberCount: 1,
          role: 'owner',
          createdAt: '2024-01-15T00:00:00Z'
        }
      ],
      currentOrganizationId: 'org_123'
    };
  }

  static async createOrganization(name: string, description?: string): Promise<Organization> {
    // Mock creation
    const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    return {
      id: `org_${Date.now()}`,
      name,
      slug,
      description,
      memberCount: 1,
      role: 'owner',
      createdAt: new Date().toISOString()
    };
  }

  static async updateOrganization(orgId: string, updates: Partial<Organization>): Promise<void> {
    // Mock update
    console.log('Updating organization', orgId, updates);
  }
}

interface OrganizationProviderProps {
  children: JSX.Element;
}

export function OrganizationProvider(props: OrganizationProviderProps) {
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [currentOrgId, setCurrentOrgId] = createSignal<string | null>(null);

  const dashboardServer = useDashboardServer();

  // Load user data from dashboard server
  const [user] = createResource(async () => {
    try {
      setLoading(true);

      // Wait for dashboard server connection
      if (!dashboardServer.isConnected()) {
        await new Promise(resolve => {
          const checkConnection = () => {
            if (dashboardServer.isConnected()) {
              resolve(true);
            } else {
              setTimeout(checkConnection, 100);
            }
          };
          checkConnection();
        });
      }

      // Fetch user data from dashboard server
      const response = await fetch('http://localhost:3001/api/auth/me', {
        headers: {
          'X-User-Id': 'user-demo-123'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch user data: ${response.statusText}`);
      }

      const data = await response.json();
      const userData = {
        id: data.user.id,
        email: data.user.email,
        name: data.user.name,
        avatar: data.user.avatar,
        organizations: data.organizations.map((org: any) => ({
          id: org.id,
          name: org.name,
          slug: org.slug,
          description: org.description,
          memberCount: org.memberCount,
          role: org.ownerId === data.user.id ? 'owner' : 'member',
          createdAt: org.createdAt
        })),
        currentOrganizationId: data.user.currentOrganizationId
      };

      setCurrentOrgId(userData.currentOrganizationId || userData.organizations[0]?.id || null);
      return userData;
    } catch (err) {
      setError('Failed to load user data');
      console.error('Organization context error:', err);
      return null;
    } finally {
      setLoading(false);
    }
  });

  // Computed values
  const organizations = () => user()?.organizations || [];
  const currentOrganization = () => {
    const orgId = currentOrgId();
    return organizations().find(org => org.id === orgId) || null;
  };

  // Actions
  const switchOrganization = async (orgId: string) => {
    const org = organizations().find(o => o.id === orgId);
    if (org) {
      try {
        const success = await dashboardServer.switchOrganization(orgId);
        if (success) {
          setCurrentOrgId(orgId);
          // Update URL to reflect organization change
          const currentPath = window.location.pathname;
          const newPath = `/${org.slug}${currentPath.replace(/^\/[^/]+/, '') || '/workflows'}`;
          window.history.pushState({}, '', newPath);
          window.dispatchEvent(new PopStateEvent('popstate'));
        } else {
          setError('Failed to switch organization');
        }
      } catch (err) {
        setError('Failed to switch organization');
        console.error('Switch organization error:', err);
      }
    }
  };

  const createOrganization = async (name: string, description?: string): Promise<Organization> => {
    try {
      setLoading(true);
      setError(null);
      const newOrg = await dashboardServer.createOrganization(name, description);

      // Reload user data to include new organization
      user.refetch();

      // Switch to the new organization
      await switchOrganization(newOrg.id);

      return newOrg;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create organization';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const updateOrganization = async (orgId: string, updates: Partial<Organization>) => {
    try {
      setLoading(true);
      setError(null);
      await OrganizationService.updateOrganization(orgId, updates);

      // Update local state
      const currentUser = user();
      if (currentUser) {
        const orgIndex = currentUser.organizations.findIndex(org => org.id === orgId);
        if (orgIndex !== -1) {
          currentUser.organizations[orgIndex] = {
            ...currentUser.organizations[orgIndex],
            ...updates
          };
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update organization');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Set organization from URL on mount
  onMount(() => {
    const path = window.location.pathname;
    const orgSlug = path.split('/')[1];

    if (orgSlug && organizations().length > 0) {
      const org = organizations().find(o => o.slug === orgSlug);
      if (org) {
        setCurrentOrgId(org.id);
      }
    }
  });

  const contextValue: OrganizationContextValue = {
    user,
    currentOrganization,
    organizations,
    switchOrganization,
    createOrganization,
    updateOrganization,
    loading,
    error
  };

  return (
    <OrganizationContext.Provider value={contextValue}>
      {props.children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization(): OrganizationContextValue {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
}

export default OrganizationContext;