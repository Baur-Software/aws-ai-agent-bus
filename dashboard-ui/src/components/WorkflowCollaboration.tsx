import { createSignal, createEffect, For, Show } from 'solid-js';
import { useOrganization } from '../contexts/OrganizationContext';
import { useKVStore } from '../contexts/KVStoreContext';
import { useNotifications } from '../contexts/NotificationContext';
import {
  Users, Plus, X, Crown, Shield, User as UserIcon,
  Mail, Share, Link, Copy, Check, UserPlus, UserMinus,
  Eye, Edit, Settings, Globe, Lock
} from 'lucide-solid';

export interface WorkflowCollaborator {
  userId: string;
  email: string;
  name: string;
  avatar?: string;
  role: 'owner' | 'editor' | 'viewer';
  addedAt: string;
  addedBy: string;
  status: 'pending' | 'accepted' | 'declined';
}

export interface WorkflowPermissions {
  isPublic: boolean;
  allowOrgMembers: boolean;
  allowExternalCollaborators: boolean;
  requireApproval: boolean;
}

interface WorkflowCollaborationProps {
  workflowId: string;
  workflowName: string;
  isOwner: boolean;
  currentCollaborators: WorkflowCollaborator[];
  permissions: WorkflowPermissions;
  onCollaboratorsChange: (collaborators: WorkflowCollaborator[]) => void;
  onPermissionsChange: (permissions: WorkflowPermissions) => void;
  onClose: () => void;
}

export default function WorkflowCollaboration(props: WorkflowCollaborationProps) {
  const [activeTab, setActiveTab] = createSignal<'collaborators' | 'permissions' | 'sharing'>('collaborators');
  const [inviteEmail, setInviteEmail] = createSignal('');
  const [inviteRole, setInviteRole] = createSignal<'editor' | 'viewer'>('editor');
  const [isInviting, setIsInviting] = createSignal(false);
  const [orgMembers, setOrgMembers] = createSignal<any[]>([]);
  const [shareUrl, setShareUrl] = createSignal('');
  const [copied, setCopied] = createSignal(false);

  const { currentOrganization, user } = useOrganization();
  const kvStore = useKVStore();
  const { success, error } = useNotifications();

  // Load organization members
  createEffect(async () => {
    const org = currentOrganization();
    if (org) {
      try {
        // In a real implementation, this would fetch from an API
        const members = await loadOrganizationMembers(org.id);
        setOrgMembers(members);
      } catch (err) {
        console.error('Failed to load org members:', err);
      }
    }
  });

  // Generate share URL
  createEffect(() => {
    const baseUrl = window.location.origin;
    const url = `${baseUrl}/workflow/${props.workflowId}${props.permissions.isPublic ? '?public=true' : ''}`;
    setShareUrl(url);
  });

  const loadOrganizationMembers = async (orgId: string) => {
    // Mock implementation - in production, fetch from API
    return [
      {
        id: 'user_456',
        email: 'jane@example.com',
        name: 'Jane Smith',
        avatar: 'https://via.placeholder.com/32',
        role: 'admin'
      },
      {
        id: 'user_789',
        email: 'bob@example.com',
        name: 'Bob Johnson',
        avatar: 'https://via.placeholder.com/32',
        role: 'member'
      }
    ];
  };

  const sendInvitation = async () => {
    if (!inviteEmail() || isInviting()) return;

    setIsInviting(true);
    try {
      const org = currentOrganization();
      const currentUser = user();

      if (!org || !currentUser) {
        throw new Error('Organization or user context not available');
      }

      // Check if user is already a collaborator
      const existingCollaborator = props.currentCollaborators.find(
        c => c.email.toLowerCase() === inviteEmail().toLowerCase()
      );

      if (existingCollaborator) {
        error('User is already a collaborator on this workflow');
        return;
      }

      // Create invitation
      const invitation: WorkflowCollaborator = {
        userId: '', // Will be set when user accepts
        email: inviteEmail(),
        name: inviteEmail(), // Will be updated when user accepts
        role: inviteRole(),
        addedAt: new Date().toISOString(),
        addedBy: currentUser.id,
        status: 'pending'
      };

      // Store invitation
      const invitationKey = `workflow-${props.workflowId}-invitation-${Date.now()}`;
      await kvStore.set(invitationKey, JSON.stringify(invitation));

      // Add to collaborators list
      const updatedCollaborators = [...props.currentCollaborators, invitation];
      props.onCollaboratorsChange(updatedCollaborators);

      // Send email invitation (in production, this would be handled by the backend)
      await sendEmailInvitation(invitation, props.workflowName, org.name);

      success(`Invitation sent to ${inviteEmail()}`);
      setInviteEmail('');
    } catch (err) {
      error(`Failed to send invitation: ${err.message}`);
    } finally {
      setIsInviting(false);
    }
  };

  const sendEmailInvitation = async (invitation: WorkflowCollaborator, workflowName: string, orgName: string) => {
    // Mock email service - in production, use SES or similar
    console.log('Sending email invitation:', {
      to: invitation.email,
      subject: `You've been invited to collaborate on "${workflowName}"`,
      body: `You've been invited to collaborate on the workflow "${workflowName}" in ${orgName}.`
    });
  };

  const removeCollaborator = async (collaborator: WorkflowCollaborator) => {
    if (!props.isOwner) {
      error('Only the workflow owner can remove collaborators');
      return;
    }

    try {
      const updatedCollaborators = props.currentCollaborators.filter(
        c => c.email !== collaborator.email
      );
      props.onCollaboratorsChange(updatedCollaborators);
      success(`Removed ${collaborator.email} from workflow`);
    } catch (err) {
      error(`Failed to remove collaborator: ${err.message}`);
    }
  };

  const updateCollaboratorRole = async (collaborator: WorkflowCollaborator, newRole: 'editor' | 'viewer') => {
    if (!props.isOwner) {
      error('Only the workflow owner can change roles');
      return;
    }

    try {
      const updatedCollaborators = props.currentCollaborators.map(c =>
        c.email === collaborator.email ? { ...c, role: newRole } : c
      );
      props.onCollaboratorsChange(updatedCollaborators);
      success(`Updated ${collaborator.email}'s role to ${newRole}`);
    } catch (err) {
      error(`Failed to update role: ${err.message}`);
    }
  };

  const copyShareUrl = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      success('Share URL copied to clipboard');
    } catch (err) {
      error('Failed to copy URL');
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner': return Crown;
      case 'editor': return Edit;
      case 'viewer': return Eye;
      default: return UserIcon;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'owner': return 'text-yellow-600 dark:text-yellow-400';
      case 'editor': return 'text-blue-600 dark:text-blue-400';
      case 'viewer': return 'text-gray-600 dark:text-gray-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  return (
    <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div class="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 class="text-xl font-semibold text-gray-900 dark:text-white">
              Workflow Collaboration
            </h2>
            <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Manage access to "{props.workflowName}"
            </p>
          </div>
          <button
            onClick={props.onClose}
            class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X class="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div class="border-b border-gray-200 dark:border-gray-700">
          <nav class="flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('collaborators')}
              class={`py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab() === 'collaborators'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <Users class="w-4 h-4 inline mr-2" />
              Collaborators
            </button>
            <button
              onClick={() => setActiveTab('permissions')}
              class={`py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab() === 'permissions'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <Settings class="w-4 h-4 inline mr-2" />
              Permissions
            </button>
            <button
              onClick={() => setActiveTab('sharing')}
              class={`py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab() === 'sharing'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <Share class="w-4 h-4 inline mr-2" />
              Sharing
            </button>
          </nav>
        </div>

        {/* Content */}
        <div class="p-6 overflow-y-auto max-h-96">
          {/* Collaborators Tab */}
          <Show when={activeTab() === 'collaborators'}>
            <div class="space-y-6">
              {/* Add Collaborator */}
              <Show when={props.isOwner}>
                <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <h3 class="text-sm font-medium text-gray-900 dark:text-white mb-3">
                    Invite Collaborators
                  </h3>
                  <div class="flex gap-3">
                    <input
                      type="email"
                      placeholder="Enter email address"
                      value={inviteEmail()}
                      onInput={(e) => setInviteEmail(e.currentTarget.value)}
                      class="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <select
                      value={inviteRole()}
                      onChange={(e) => setInviteRole(e.currentTarget.value as 'editor' | 'viewer')}
                      class="px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="editor">Editor</option>
                      <option value="viewer">Viewer</option>
                    </select>
                    <button
                      onClick={sendInvitation}
                      disabled={!inviteEmail() || isInviting()}
                      class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      <Show when={isInviting()} fallback={<Plus class="w-4 h-4" />}>
                        <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      </Show>
                      Invite
                    </button>
                  </div>
                </div>
              </Show>

              {/* Current Collaborators */}
              <div>
                <h3 class="text-sm font-medium text-gray-900 dark:text-white mb-3">
                  Current Collaborators ({props.currentCollaborators.length})
                </h3>
                <div class="space-y-3">
                  <For each={props.currentCollaborators}>
                    {(collaborator) => {
                      const RoleIcon = getRoleIcon(collaborator.role);
                      return (
                        <div class="flex items-center justify-between p-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg">
                          <div class="flex items-center gap-3">
                            <Show when={collaborator.avatar} fallback={
                              <div class="w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center">
                                <UserIcon class="w-4 h-4 text-gray-600 dark:text-gray-400" />
                              </div>
                            }>
                              <img
                                src={collaborator.avatar}
                                alt={collaborator.name}
                                class="w-8 h-8 rounded-full"
                              />
                            </Show>
                            <div>
                              <div class="text-sm font-medium text-gray-900 dark:text-white">
                                {collaborator.name}
                              </div>
                              <div class="text-xs text-gray-500 dark:text-gray-400">
                                {collaborator.email}
                              </div>
                            </div>
                            <Show when={collaborator.status === 'pending'}>
                              <span class="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 rounded">
                                Pending
                              </span>
                            </Show>
                          </div>

                          <div class="flex items-center gap-2">
                            <div class={`flex items-center gap-1 text-xs ${getRoleColor(collaborator.role)}`}>
                              <RoleIcon class="w-3 h-3" />
                              {collaborator.role}
                            </div>

                            <Show when={props.isOwner && collaborator.role !== 'owner'}>
                              <select
                                value={collaborator.role}
                                onChange={(e) => updateCollaboratorRole(collaborator, e.currentTarget.value as 'editor' | 'viewer')}
                                class="text-xs border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded px-2 py-1"
                              >
                                <option value="editor">Editor</option>
                                <option value="viewer">Viewer</option>
                              </select>

                              <button
                                onClick={() => removeCollaborator(collaborator)}
                                class="p-1 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                                title="Remove collaborator"
                              >
                                <UserMinus class="w-4 h-4" />
                              </button>
                            </Show>
                          </div>
                        </div>
                      );
                    }}
                  </For>
                </div>
              </div>
            </div>
          </Show>

          {/* Permissions Tab */}
          <Show when={activeTab() === 'permissions'}>
            <div class="space-y-6">
              <div>
                <h3 class="text-sm font-medium text-gray-900 dark:text-white mb-4">
                  Workflow Visibility
                </h3>
                <div class="space-y-4">
                  <label class="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={props.permissions.isPublic}
                      onChange={(e) => props.onPermissionsChange({
                        ...props.permissions,
                        isPublic: e.currentTarget.checked
                      })}
                      disabled={!props.isOwner}
                      class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <div>
                      <div class="text-sm font-medium text-gray-900 dark:text-white">
                        Public workflow
                      </div>
                      <div class="text-xs text-gray-500 dark:text-gray-400">
                        Anyone with the link can view this workflow
                      </div>
                    </div>
                  </label>

                  <label class="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={props.permissions.allowOrgMembers}
                      onChange={(e) => props.onPermissionsChange({
                        ...props.permissions,
                        allowOrgMembers: e.currentTarget.checked
                      })}
                      disabled={!props.isOwner}
                      class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <div>
                      <div class="text-sm font-medium text-gray-900 dark:text-white">
                        Allow organization members
                      </div>
                      <div class="text-xs text-gray-500 dark:text-gray-400">
                        All members of your organization can view this workflow
                      </div>
                    </div>
                  </label>

                  <label class="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={props.permissions.allowExternalCollaborators}
                      onChange={(e) => props.onPermissionsChange({
                        ...props.permissions,
                        allowExternalCollaborators: e.currentTarget.checked
                      })}
                      disabled={!props.isOwner}
                      class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <div>
                      <div class="text-sm font-medium text-gray-900 dark:text-white">
                        Allow external collaborators
                      </div>
                      <div class="text-xs text-gray-500 dark:text-gray-400">
                        Invite people outside your organization
                      </div>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          </Show>

          {/* Sharing Tab */}
          <Show when={activeTab() === 'sharing'}>
            <div class="space-y-6">
              <div>
                <h3 class="text-sm font-medium text-gray-900 dark:text-white mb-4">
                  Share Workflow
                </h3>
                <div class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div class="flex-1 text-sm text-gray-600 dark:text-gray-400 font-mono break-all">
                    {shareUrl()}
                  </div>
                  <button
                    onClick={copyShareUrl}
                    class="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                    title="Copy URL"
                  >
                    <Show when={copied()} fallback={<Copy class="w-4 h-4" />}>
                      <Check class="w-4 h-4 text-green-600" />
                    </Show>
                  </button>
                </div>
                <Show when={!props.permissions.isPublic}>
                  <p class="text-xs text-yellow-600 dark:text-yellow-400">
                    <Lock class="w-3 h-3 inline mr-1" />
                    This workflow is private. Only collaborators can access it.
                  </p>
                </Show>
              </div>
            </div>
          </Show>
        </div>
      </div>
    </div>
  );
}