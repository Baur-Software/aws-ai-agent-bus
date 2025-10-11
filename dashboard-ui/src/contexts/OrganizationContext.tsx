import { createContext, useContext, createSignal, createResource, onMount, onCleanup, JSX } from 'solid-js';
import { useDashboardServer } from './DashboardServerContext';
import { useAuth } from './AuthContext';
import OrganizationService, {
  Organization,
  OrganizationMember,
  OrganizationPermission,
  CreateOrganizationRequest,
  UpdateOrganizationRequest,
  InviteMemberRequest,
  UpdateMemberRequest
} from '../services/OrganizationService';

export interface User {
  id: string;
  userId?: string;  // Alias for id for compatibility
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
  organizations: () => Organization[];

  // Member management
  members: () => OrganizationMember[];
  userPermissions: () => OrganizationPermission[];

  // Organization actions
  switchOrganization: (orgId: string) => Promise<boolean>;
  createOrganization: (data: CreateOrganizationRequest) => Promise<Organization>;
  updateOrganization: (orgId: string, updates: UpdateOrganizationRequest) => Promise<void>;
  deleteOrganization: (orgId: string) => Promise<void>;

  // Member actions
  inviteMember: (data: InviteMemberRequest) => Promise<OrganizationMember>;
  updateMember: (memberId: string, updates: UpdateMemberRequest) => Promise<OrganizationMember>;
  removeMember: (memberId: string) => Promise<void>;
  resendInvitation: (memberId: string) => Promise<void>;

  // Permissions
  hasPermission: (resource: string, action: string) => boolean;
  canManageMembers: () => boolean;
  canManageOrganization: () => boolean;
  canInviteMembers: () => boolean;

  // Resource management
  refreshOrganizations: () => void;
  refreshMembers: () => void;

  // Loading states
  loading: () => boolean;
  error: () => string | null;
}

const OrganizationContext = createContext<OrganizationContextValue>();

interface OrganizationProviderProps {
  children: JSX.Element;
}

export function OrganizationProvider(props: OrganizationProviderProps) {
  const auth = useAuth();
  const dashboardServer = useDashboardServer();

  // State
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [currentOrgId, setCurrentOrgId] = createSignal<string | null>(null);
  const [orgService] = createSignal(new OrganizationService());

  // Resources
  const [organizations, { refetch: refetchOrganizations }] = createResource(
    () => auth.isAuthenticated() && dashboardServer.isConnected(),
    async (canLoad) => {
      if (!canLoad) return [];

      try {
        setLoading(true);
        setError(null);

        // Request organizations via WebSocket event
        const result = await dashboardServer.sendMessageWithResponse({
          type: 'organization_list',
          data: {}
        });

        if (result?.error) {
          throw new Error(result.error);
        }

        const orgs = result.data?.organizations || [];

        // Set current org if none selected
        if (!currentOrgId() && orgs.length > 0) {
          setCurrentOrgId(orgs[0].id);
        }

        return orgs;
      } catch (err) {
        console.error('Failed to load organizations:', err);
        setError(err instanceof Error ? err.message : 'Failed to load organizations');
        return [];
      } finally {
        setLoading(false);
      }
    }
  );

  const [members, { refetch: refetchMembers }] = createResource(
    () => currentOrgId() && dashboardServer.isConnected() && auth.isAuthenticated(),
    async (canLoad) => {
      if (!canLoad || !currentOrgId()) return [];

      try {
        // Request members via WebSocket event
        const result = await dashboardServer.sendMessageWithResponse({
          type: 'organization_members',
          data: { organizationId: currentOrgId() }
        });

        if (result?.error) {
          console.warn('Failed to load members:', result.error);
          return [];
        }

        return result.data?.members || [];
      } catch (err) {
        console.error('Failed to load members:', err);
        return [];
      }
    }
  );

  const [userPermissions] = createResource(
    () => currentOrgId(),
    async (orgId) => {
      if (!orgId || !auth.isAuthenticated()) return [];

      try {
        // Request user permissions via WebSocket event
        const result = await dashboardServer.sendMessageWithResponse({
          type: 'organization_permissions',
          data: { organizationId: orgId }
        });

        if (result?.error) {
          console.warn('Failed to load permissions:', result.error);
          // Fall back to admin permissions for demo
          return [{
            resource: '*',
            action: '*',
            granted: true
          }];
        }

        return result.data?.permissions || [];
      } catch (err) {
        console.error('Failed to load permissions:', err);
        // Fall back to admin permissions for demo
        return [{
          resource: '*',
          action: '*',
          granted: true
        }];
      }
    }
  );

  // Computed values
  const currentOrganization = () => {
    const orgId = currentOrgId();
    return organizations()?.find(org => org.id === orgId) || null;
  };

  // Create user object from auth context
  const user = () => {
    const authUser = auth.user();
    if (!authUser || !organizations()) return null;

    return {
      id: authUser.userId,
      email: authUser.email || '',
      name: authUser.name || '',
      avatar: undefined,
      organizations: organizations() || [],
      currentOrganizationId: currentOrgId() || undefined,
    };
  };

  // Organization actions
  const switchOrganization = async (orgId: string): Promise<boolean> => {
    const org = organizations()?.find(o => o.id === orgId);
    if (!org) return false;

    try {
      setLoading(true);
      setError(null);

      // Send switch_context event via WebSocket (event-driven, no REST endpoint)
      dashboardServer.sendMessage({
        type: 'switch_context',
        userId: auth.user()?.userId,
        organizationId: orgId
      });

      // Update local state
      setCurrentOrgId(orgId);

      // Emit organization switch event for logging/analytics
      dashboardServer.sendMessage({
        type: 'publish_event',
        event: {
          detailType: 'organization.context_switched',
          source: 'agent-mesh.ui',
          detail: {
            userId: auth.user()?.userId,
            fromOrgId: currentOrgId(),
            toOrgId: orgId,
            orgName: org.name,
            timestamp: new Date().toISOString()
          }
        }
      });

      // Refresh members for new organization
      refetchMembers();

      return true;
    } catch (err) {
      console.error('Failed to switch organization:', err);
      setError(err instanceof Error ? err.message : 'Failed to switch organization');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const createOrganization = async (data: CreateOrganizationRequest): Promise<Organization> => {
    try {
      setLoading(true);
      setError(null);

      const newOrg = await orgService().createOrganization(data);

      // Refresh organizations list
      refetchOrganizations();

      // Switch to the new organization
      await switchOrganization(newOrg.id);

      // Emit organization created event
      await dashboardServer.sendMessage({
        type: 'event_send',
        data: {
          source: 'agent-mesh.organization',
          detailType: 'Organization Created',
          detail: {
            userId: auth.user()?.userId,
            orgId: newOrg.id,
            orgName: newOrg.name,
            timestamp: new Date().toISOString()
          }
        }
      });

      return newOrg;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create organization';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const updateOrganization = async (orgId: string, updates: UpdateOrganizationRequest): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      await orgService().updateOrganization(orgId, updates);

      // Refresh organizations list
      refetchOrganizations();

      // Emit organization updated event
      await dashboardServer.sendMessage({
        type: 'event_send',
        data: {
          source: 'agent-mesh.organization',
          detailType: 'Organization Updated',
          detail: {
            userId: auth.user()?.userId,
            orgId,
            updates,
            timestamp: new Date().toISOString()
          }
        }
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update organization';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const deleteOrganization = async (orgId: string): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      await orgService().deleteOrganization(orgId);

      // Refresh organizations list
      refetchOrganizations();

      // Switch to another organization if current was deleted
      if (currentOrgId() === orgId) {
        const remainingOrgs = organizations()?.filter(org => org.id !== orgId) || [];
        if (remainingOrgs.length > 0) {
          await switchOrganization(remainingOrgs[0].id);
        } else {
          setCurrentOrgId(null);
        }
      }

      // Emit organization deleted event
      await dashboardServer.sendMessage({
        type: 'event_send',
        data: {
          source: 'agent-mesh.organization',
          detailType: 'Organization Deleted',
          detail: {
            userId: auth.user()?.userId,
            orgId,
            timestamp: new Date().toISOString()
          }
        }
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete organization';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Member actions
  const inviteMember = async (data: InviteMemberRequest): Promise<OrganizationMember> => {
    const orgId = currentOrgId();
    if (!orgId) throw new Error('No organization selected');

    try {
      setLoading(true);
      setError(null);

      const member = await orgService().inviteMember(orgId, data);

      // Refresh members list
      refetchMembers();

      // Emit member invited event
      await dashboardServer.sendMessage({
        type: 'event_send',
        data: {
          source: 'agent-mesh.organization',
          detailType: 'Member Invited',
          detail: {
            userId: auth.user()?.userId,
            orgId,
            invitedEmail: data.email,
            role: data.role,
            timestamp: new Date().toISOString()
          }
        }
      });

      return member;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to invite member';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const updateMember = async (memberId: string, updates: UpdateMemberRequest): Promise<OrganizationMember> => {
    const orgId = currentOrgId();
    if (!orgId) throw new Error('No organization selected');

    try {
      setLoading(true);
      setError(null);

      const member = await orgService().updateMember(orgId, memberId, updates);

      // Refresh members list
      refetchMembers();

      return member;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update member';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const removeMember = async (memberId: string): Promise<void> => {
    const orgId = currentOrgId();
    if (!orgId) throw new Error('No organization selected');

    try {
      setLoading(true);
      setError(null);

      await orgService().removeMember(orgId, memberId);

      // Refresh members list
      refetchMembers();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to remove member';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const resendInvitation = async (memberId: string): Promise<void> => {
    const orgId = currentOrgId();
    if (!orgId) throw new Error('No organization selected');

    try {
      await orgService().resendInvitation(orgId, memberId);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to resend invitation';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  // Permission helpers
  const hasPermission = (resource: string, action: string): boolean => {
    const permissions = userPermissions() || [];
    return orgService().hasPermission(permissions, resource, action);
  };

  const canManageMembers = (): boolean => {
    const currentOrg = currentOrganization();
    return currentOrg ? orgService().canManageMembers(currentOrg.userRole) : false;
  };

  const canManageOrganization = (): boolean => {
    const currentOrg = currentOrganization();
    return currentOrg ? orgService().canManageOrganization(currentOrg.userRole) : false;
  };

  const canInviteMembers = (): boolean => {
    const currentOrg = currentOrganization();
    return currentOrg ? orgService().canInviteMembers(currentOrg.userRole, currentOrg.settings) : false;
  };

  // Update tokens when auth state changes
  onMount(() => {
    const updateTokens = () => {
      if (auth.isAuthenticated()) {
        const tokens = localStorage.getItem('auth_tokens');
        if (tokens) {
          orgService().setTokens(JSON.parse(tokens));
        }
      }
    };

    updateTokens();

    // Listen for auth changes
    const interval = setInterval(updateTokens, 1000);
    onCleanup(() => clearInterval(interval));
  });

  const contextValue: OrganizationContextValue = {
    // Current user and org
    user,
    currentOrganization,
    organizations: () => organizations() || [],

    // Member management
    members: () => members() || [],
    userPermissions: () => userPermissions() || [],

    // Organization actions
    switchOrganization,
    createOrganization,
    updateOrganization,
    deleteOrganization,

    // Member actions
    inviteMember,
    updateMember,
    removeMember,
    resendInvitation,

    // Permissions
    hasPermission,
    canManageMembers,
    canManageOrganization,
    canInviteMembers,

    // Resource management
    refreshOrganizations: refetchOrganizations,
    refreshMembers: refetchMembers,

    // Loading states
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