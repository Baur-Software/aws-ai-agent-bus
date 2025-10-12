// Organization and Member Management Service
// Handles organization CRUD, member invitations, roles, and permissions

import { AuthTokens } from './CognitoAuthService';

export interface OrganizationMember {
  id: string;
  userId: string;
  email: string;
  name: string;
  avatar?: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  status: 'active' | 'invited' | 'suspended';
  invitedAt?: string;
  joinedAt?: string;
  invitedBy?: string;
  lastActiveAt?: string;
  permissions: OrganizationPermission[];
}

export interface OrganizationPermission {
  resource: string; // 'workflows', 'apps', 'settings', 'members', 'billing'
  actions: string[]; // 'read', 'write', 'delete', 'admin'
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  description?: string;
  avatar?: string;
  website?: string;
  industry?: string;
  size?: 'startup' | 'small' | 'medium' | 'large' | 'enterprise';

  // Infrastructure Tier (maps to infra/workspaces/)
  workspaceTier: 'extra-small' | 'small' | 'medium' | 'large';

  // Membership
  memberCount: number;
  maxMembers?: number;
  members?: OrganizationMember[];
  userRole: 'owner' | 'admin' | 'member' | 'viewer';

  // Settings
  settings: OrganizationSettings;
  features: OrganizationFeatures;

  // Metadata
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface OrganizationSettings {
  allowMemberInvites: boolean;
  requireApprovalForApps: boolean;
  defaultMemberRole: 'member' | 'viewer';
  sessionTimeout: number; // minutes
  enforceSSO: boolean;
  allowedEmailDomains?: string[];

  // Security
  requireMFA: boolean;
  passwordPolicy: {
    minLength: number;
    requireSpecialChars: boolean;
    requireNumbers: boolean;
    requireUppercase: boolean;
  };
}

export interface OrganizationFeatures {
  maxWorkflows: number;
  maxAppsConnections: number;
  customBranding: boolean;
  advancedAnalytics: boolean;
  apiAccess: boolean;
  ssoIntegration: boolean;
  auditLogs: boolean;
  prioritySupport: boolean;
}

export interface CreateOrganizationRequest {
  name: string;
  slug?: string;
  description?: string;
  industry?: string;
  size?: Organization['size'];
}

export interface UpdateOrganizationRequest {
  name?: string;
  description?: string;
  avatar?: string;
  website?: string;
  industry?: string;
  size?: Organization['size'];
  settings?: Partial<OrganizationSettings>;
}

export interface InviteMemberRequest {
  email: string;
  role: OrganizationMember['role'];
  message?: string;
  permissions?: OrganizationPermission[];
}

export interface UpdateMemberRequest {
  role?: OrganizationMember['role'];
  status?: OrganizationMember['status'];
  permissions?: OrganizationPermission[];
}

export class OrganizationService {
  private baseUrl: string;
  private tokens: AuthTokens | null = null;

  constructor(baseUrl: string = 'http://localhost:3001/api/auth') {
    this.baseUrl = baseUrl;
  }

  setTokens(tokens: AuthTokens | null) {
    this.tokens = tokens;
  }

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (this.tokens?.accessToken) {
      headers['Authorization'] = `Bearer ${this.tokens.accessToken}`;
    }

    return headers;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  // Organization Management
  async getOrganizations(): Promise<Organization[]> {
    return this.request<Organization[]>('/organizations');
  }

  async getOrganization(orgId: string): Promise<Organization> {
    return this.request<Organization>(`/organizations/${orgId}`);
  }

  async createOrganization(data: CreateOrganizationRequest): Promise<Organization> {
    // Generate slug if not provided
    if (!data.slug) {
      data.slug = data.name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
    }

    return this.request<Organization>('/organizations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateOrganization(orgId: string, data: UpdateOrganizationRequest): Promise<Organization> {
    return this.request<Organization>(`/organizations/${orgId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteOrganization(orgId: string): Promise<void> {
    await this.request(`/organizations/${orgId}`, {
      method: 'DELETE',
    });
  }

  // Member Management
  async getMembers(orgId: string): Promise<OrganizationMember[]> {
    return this.request<OrganizationMember[]>(`/organizations/${orgId}/members`);
  }

  async getMember(orgId: string, memberId: string): Promise<OrganizationMember> {
    return this.request<OrganizationMember>(`/organizations/${orgId}/members/${memberId}`);
  }

  async inviteMember(orgId: string, data: InviteMemberRequest): Promise<OrganizationMember> {
    return this.request<OrganizationMember>(`/organizations/${orgId}/members/invite`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateMember(orgId: string, memberId: string, data: UpdateMemberRequest): Promise<OrganizationMember> {
    return this.request<OrganizationMember>(`/organizations/${orgId}/members/${memberId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async removeMember(orgId: string, memberId: string): Promise<void> {
    await this.request(`/organizations/${orgId}/members/${memberId}`, {
      method: 'DELETE',
    });
  }

  async resendInvitation(orgId: string, memberId: string): Promise<void> {
    await this.request(`/organizations/${orgId}/members/${memberId}/resend-invite`, {
      method: 'POST',
    });
  }

  async acceptInvitation(token: string): Promise<{ organization: Organization; member: OrganizationMember }> {
    return this.request<{ organization: Organization; member: OrganizationMember }>(`/organizations/invitations/${token}/accept`, {
      method: 'POST',
    });
  }

  async declineInvitation(token: string): Promise<void> {
    await this.request(`/organizations/invitations/${token}/decline`, {
      method: 'POST',
    });
  }

  // Permission Management
  async getUserPermissions(orgId: string, userId?: string): Promise<OrganizationPermission[]> {
    const endpoint = userId
      ? `/organizations/${orgId}/permissions/${userId}`
      : `/organizations/${orgId}/permissions/me`;
    return this.request<OrganizationPermission[]>(endpoint);
  }

  async updateMemberPermissions(
    orgId: string,
    memberId: string,
    permissions: OrganizationPermission[]
  ): Promise<OrganizationMember> {
    return this.request<OrganizationMember>(`/organizations/${orgId}/members/${memberId}/permissions`, {
      method: 'PUT',
      body: JSON.stringify({ permissions }),
    });
  }

  // Organization Switching
  // Note: This is handled via WebSocket 'switch_context' message, not REST API
  // See OrganizationContext.tsx for actual implementation
  async switchOrganization(orgId: string): Promise<{ success: boolean; organization: Organization }> {
    // This method is deprecated - context switching now happens via WebSocket
    // Return mock success to avoid breaking existing code
    console.warn('OrganizationService.switchOrganization is deprecated - use WebSocket switch_context message instead');

    // Find the org from available organizations (would need to be passed in or cached)
    return {
      success: true,
      organization: {
        id: orgId,
        name: orgId, // Placeholder - actual org data should come from WebSocket response
        slug: orgId,
        workspaceTier: 'free',
        memberCount: 0,
        userRole: 'member',
        settings: {},
        infraId: '',
        members: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    };
  }

  // Utilities
  hasPermission(
    permissions: OrganizationPermission[],
    resource: string,
    action: string
  ): boolean {
    const permission = permissions.find(p => p.resource === resource);
    return permission?.actions.includes(action) ||
           permission?.actions.includes('admin') ||
           false;
  }

  getRolePermissions(role: OrganizationMember['role']): OrganizationPermission[] {
    switch (role) {
      case 'owner':
        return [
          { resource: '*', actions: ['admin'] } // Full access
        ];

      case 'admin':
        return [
          { resource: 'workflows', actions: ['read', 'write', 'delete'] },
          { resource: 'apps', actions: ['read', 'write', 'delete'] },
          { resource: 'members', actions: ['read', 'write'] },
          { resource: 'settings', actions: ['read', 'write'] },
          { resource: 'analytics', actions: ['read'] }
        ];

      case 'member':
        return [
          { resource: 'workflows', actions: ['read', 'write'] },
          { resource: 'apps', actions: ['read', 'write'] },
          { resource: 'members', actions: ['read'] },
          { resource: 'analytics', actions: ['read'] }
        ];

      case 'viewer':
        return [
          { resource: 'workflows', actions: ['read'] },
          { resource: 'apps', actions: ['read'] },
          { resource: 'members', actions: ['read'] }
        ];

      default:
        return [];
    }
  }

  canManageMembers(userRole: OrganizationMember['role']): boolean {
    return ['owner', 'admin'].includes(userRole);
  }

  canManageOrganization(userRole: OrganizationMember['role']): boolean {
    return userRole === 'owner';
  }

  canInviteMembers(userRole: OrganizationMember['role'], settings: OrganizationSettings): boolean {
    if (userRole === 'owner') return true;
    if (userRole === 'admin') return true;
    return settings.allowMemberInvites && userRole === 'member';
  }
}

// Default organization settings
export const defaultOrganizationSettings: OrganizationSettings = {
  allowMemberInvites: true,
  requireApprovalForApps: false,
  defaultMemberRole: 'member',
  sessionTimeout: 480, // 8 hours
  enforceSSO: false,
  requireMFA: false,
  passwordPolicy: {
    minLength: 8,
    requireSpecialChars: false,
    requireNumbers: true,
    requireUppercase: true,
  },
};

// Default organization features (basic plan)
export const defaultOrganizationFeatures: OrganizationFeatures = {
  maxWorkflows: 10,
  maxAppsConnections: 5,
  customBranding: false,
  advancedAnalytics: false,
  apiAccess: false,
  ssoIntegration: false,
  auditLogs: false,
  prioritySupport: false,
};

export default OrganizationService;