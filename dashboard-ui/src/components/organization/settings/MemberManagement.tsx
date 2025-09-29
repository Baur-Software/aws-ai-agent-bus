import { createSignal, Show, For, createMemo } from 'solid-js';
import { useOrganization } from '../../../contexts/OrganizationContext';
import { useNotifications } from '../../../contexts/NotificationContext';
import { OrganizationMember, InviteMemberRequest, UpdateMemberRequest } from '../../../services/OrganizationService';
import {
  UserPlus,
  Mail,
  MoreVertical,
  Crown,
  Shield,
  User,
  Eye,
  AlertCircle,
  CheckCircle,
  Clock,
  Ban
} from 'lucide-solid';

export default function MemberManagement() {
  const {
    currentOrganization,
    members,
    inviteMember,
    updateMember,
    removeMember,
    resendInvitation,
    canManageMembers,
    canInviteMembers
  } = useOrganization();
  const { addNotification } = useNotifications();

  const [showInviteModal, setShowInviteModal] = createSignal(false);
  const [isInviting, setIsInviting] = createSignal(false);
  const [selectedMember, setSelectedMember] = createSignal<OrganizationMember | null>(null);
  const [showMemberActions, setShowMemberActions] = createSignal<string | null>(null);

  // Invite form state
  const [inviteEmail, setInviteEmail] = createSignal('');
  const [inviteRole, setInviteRole] = createSignal<OrganizationMember['role']>('member');
  const [inviteMessage, setInviteMessage] = createSignal('');

  // Filter and search
  const [searchQuery, setSearchQuery] = createSignal('');
  const [statusFilter, setStatusFilter] = createSignal<OrganizationMember['status'] | 'all'>('all');
  const [roleFilter, setRoleFilter] = createSignal<OrganizationMember['role'] | 'all'>('all');

  const filteredMembers = createMemo(() => {
    let filtered = members();

    // Search filter
    const query = searchQuery().toLowerCase();
    if (query) {
      filtered = filtered.filter(member =>
        member.name.toLowerCase().includes(query) ||
        member.email.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (statusFilter() !== 'all') {
      filtered = filtered.filter(member => member.status === statusFilter());
    }

    // Role filter
    if (roleFilter() !== 'all') {
      filtered = filtered.filter(member => member.role === roleFilter());
    }

    return filtered.sort((a, b) => {
      // Sort by role priority (owner > admin > member > viewer)
      const rolePriority = { owner: 4, admin: 3, member: 2, viewer: 1 };
      const aPriority = rolePriority[a.role] || 0;
      const bPriority = rolePriority[b.role] || 0;

      if (aPriority !== bPriority) {
        return bPriority - aPriority;
      }

      // Then by name
      return a.name.localeCompare(b.name);
    });
  });

  const memberStats = createMemo(() => {
    const allMembers = members();
    return {
      total: allMembers.length,
      active: allMembers.filter(m => m.status === 'active').length,
      invited: allMembers.filter(m => m.status === 'invited').length,
      suspended: allMembers.filter(m => m.status === 'suspended').length,
      owners: allMembers.filter(m => m.role === 'owner').length,
      admins: allMembers.filter(m => m.role === 'admin').length,
      members: allMembers.filter(m => m.role === 'member').length,
      viewers: allMembers.filter(m => m.role === 'viewer').length
    };
  });

  const handleInviteMember = async () => {
    if (!inviteEmail().trim()) {
      addNotification({
        type: 'error',
        title: 'Invalid Email',
        message: 'Please enter a valid email address'
      });
      return;
    }

    try {
      setIsInviting(true);
      const inviteData: InviteMemberRequest = {
        email: inviteEmail().trim(),
        role: inviteRole(),
        message: inviteMessage().trim() || undefined
      };

      await inviteMember(inviteData);

      // Reset form
      setInviteEmail('');
      setInviteRole('member');
      setInviteMessage('');
      setShowInviteModal(false);

      addNotification({
        type: 'success',
        title: 'Invitation Sent',
        message: `Invitation sent to ${inviteData.email}`
      });
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Invitation Failed',
        message: error instanceof Error ? error.message : 'Failed to send invitation'
      });
    } finally {
      setIsInviting(false);
    }
  };

  const handleUpdateMemberRole = async (member: OrganizationMember, newRole: OrganizationMember['role']) => {
    try {
      const updates: UpdateMemberRequest = { role: newRole };
      await updateMember(member.id, updates);

      addNotification({
        type: 'success',
        title: 'Member Updated',
        message: `${member.name}'s role has been updated to ${newRole}`
      });

      setShowMemberActions(null);
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Update Failed',
        message: error instanceof Error ? error.message : 'Failed to update member'
      });
    }
  };

  const handleSuspendMember = async (member: OrganizationMember) => {
    try {
      const updates: UpdateMemberRequest = {
        status: member.status === 'suspended' ? 'active' : 'suspended'
      };
      await updateMember(member.id, updates);

      addNotification({
        type: 'success',
        title: 'Member Updated',
        message: `${member.name} has been ${updates.status === 'suspended' ? 'suspended' : 'reactivated'}`
      });

      setShowMemberActions(null);
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Action Failed',
        message: error instanceof Error ? error.message : 'Failed to update member status'
      });
    }
  };

  const handleRemoveMember = async (member: OrganizationMember) => {
    if (!confirm(`Are you sure you want to remove ${member.name} from the organization?`)) {
      return;
    }

    try {
      await removeMember(member.id);

      addNotification({
        type: 'success',
        title: 'Member Removed',
        message: `${member.name} has been removed from the organization`
      });

      setShowMemberActions(null);
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Removal Failed',
        message: error instanceof Error ? error.message : 'Failed to remove member'
      });
    }
  };

  const handleResendInvitation = async (member: OrganizationMember) => {
    try {
      await resendInvitation(member.id);

      addNotification({
        type: 'success',
        title: 'Invitation Resent',
        message: `Invitation resent to ${member.email}`
      });

      setShowMemberActions(null);
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Resend Failed',
        message: error instanceof Error ? error.message : 'Failed to resend invitation'
      });
    }
  };

  const getRoleIcon = (role: OrganizationMember['role']) => {
    switch (role) {
      case 'owner': return <Crown class="w-4 h-4 text-yellow-500" />;
      case 'admin': return <Shield class="w-4 h-4 text-blue-500" />;
      case 'member': return <User class="w-4 h-4 text-green-500" />;
      case 'viewer': return <Eye class="w-4 h-4 text-slate-500" />;
      default: return <User class="w-4 h-4 text-slate-500" />;
    }
  };

  const getStatusIcon = (status: OrganizationMember['status']) => {
    switch (status) {
      case 'active': return <CheckCircle class="w-4 h-4 text-green-500" />;
      case 'invited': return <Clock class="w-4 h-4 text-yellow-500" />;
      case 'suspended': return <Ban class="w-4 h-4 text-red-500" />;
      default: return <AlertCircle class="w-4 h-4 text-slate-500" />;
    }
  };

  const canModifyMember = (member: OrganizationMember): boolean => {
    const currentOrg = currentOrganization();
    if (!currentOrg || !canManageMembers()) return false;

    // Can't modify owners unless you're an owner
    if (member.role === 'owner' && currentOrg.userRole !== 'owner') return false;

    // Owners can modify anyone
    if (currentOrg.userRole === 'owner') return true;

    // Admins can modify members and viewers
    if (currentOrg.userRole === 'admin') {
      return ['member', 'viewer'].includes(member.role);
    }

    return false;
  };

  return (
    <div class="p-6 space-y-6">
      {/* Header */}
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-xl font-semibold text-slate-900 dark:text-white">
            Organization Members
          </h2>
          <p class="text-slate-600 dark:text-slate-400 mt-1">
            Manage your organization members and their permissions
          </p>
        </div>
        <Show when={canInviteMembers()}>
          <button
            class="btn btn-primary"
            onClick={() => setShowInviteModal(true)}
          >
            <UserPlus class="w-4 h-4 mr-2" />
            Invite Member
          </button>
        </Show>
      </div>

      {/* Member Stats */}
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="bg-slate-50 dark:bg-slate-900 rounded-lg p-4">
          <div class="text-2xl font-bold text-slate-900 dark:text-white">
            {memberStats().total}
          </div>
          <div class="text-sm text-slate-600 dark:text-slate-400">Total Members</div>
        </div>
        <div class="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
          <div class="text-2xl font-bold text-green-700 dark:text-green-400">
            {memberStats().active}
          </div>
          <div class="text-sm text-green-600 dark:text-green-500">Active</div>
        </div>
        <div class="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
          <div class="text-2xl font-bold text-yellow-700 dark:text-yellow-400">
            {memberStats().invited}
          </div>
          <div class="text-sm text-yellow-600 dark:text-yellow-500">Pending</div>
        </div>
        <div class="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
          <div class="text-2xl font-bold text-red-700 dark:text-red-400">
            {memberStats().suspended}
          </div>
          <div class="text-sm text-red-600 dark:text-red-500">Suspended</div>
        </div>
      </div>

      {/* Filters */}
      <div class="flex flex-col sm:flex-row gap-4">
        <div class="flex-1">
          <input
            type="search"
            placeholder="Search members..."
            class="input"
            value={searchQuery()}
            onInput={(e) => setSearchQuery(e.currentTarget.value)}
          />
        </div>
        <select
          class="input sm:w-40"
          value={statusFilter()}
          onChange={(e) => setStatusFilter(e.currentTarget.value as any)}
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="invited">Pending</option>
          <option value="suspended">Suspended</option>
        </select>
        <select
          class="input sm:w-40"
          value={roleFilter()}
          onChange={(e) => setRoleFilter(e.currentTarget.value as any)}
        >
          <option value="all">All Roles</option>
          <option value="owner">Owner</option>
          <option value="admin">Admin</option>
          <option value="member">Member</option>
          <option value="viewer">Viewer</option>
        </select>
      </div>

      {/* Members List */}
      <div class="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead class="bg-slate-50 dark:bg-slate-900">
              <tr>
                <th class="text-left py-3 px-4 font-medium text-slate-700 dark:text-slate-300">Member</th>
                <th class="text-left py-3 px-4 font-medium text-slate-700 dark:text-slate-300">Role</th>
                <th class="text-left py-3 px-4 font-medium text-slate-700 dark:text-slate-300">Status</th>
                <th class="text-left py-3 px-4 font-medium text-slate-700 dark:text-slate-300">Joined</th>
                <th class="text-right py-3 px-4 font-medium text-slate-700 dark:text-slate-300">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200 dark:divide-slate-700">
              <For each={filteredMembers()}>
                {(member) => (
                  <tr class="hover:bg-slate-50 dark:hover:bg-slate-900">
                    <td class="py-4 px-4">
                      <div class="flex items-center">
                        <div class="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mr-3">
                          <span class="text-white text-sm font-medium">
                            {member.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <div class="font-medium text-slate-900 dark:text-white">
                            {member.name}
                          </div>
                          <div class="text-sm text-slate-500 dark:text-slate-400">
                            {member.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td class="py-4 px-4">
                      <div class="flex items-center">
                        {getRoleIcon(member.role)}
                        <span class="ml-2 capitalize text-sm font-medium text-slate-700 dark:text-slate-300">
                          {member.role}
                        </span>
                      </div>
                    </td>
                    <td class="py-4 px-4">
                      <div class="flex items-center">
                        {getStatusIcon(member.status)}
                        <span class="ml-2 capitalize text-sm text-slate-700 dark:text-slate-300">
                          {member.status}
                        </span>
                      </div>
                    </td>
                    <td class="py-4 px-4 text-sm text-slate-600 dark:text-slate-400">
                      {member.joinedAt
                        ? new Date(member.joinedAt).toLocaleDateString()
                        : member.invitedAt
                        ? `Invited ${new Date(member.invitedAt).toLocaleDateString()}`
                        : '-'
                      }
                    </td>
                    <td class="py-4 px-4 text-right">
                      <Show when={canModifyMember(member)}>
                        <div class="relative inline-block">
                          <button
                            class="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition-colors"
                            onClick={() => setShowMemberActions(
                              showMemberActions() === member.id ? null : member.id
                            )}
                          >
                            <MoreVertical class="w-4 h-4 text-slate-500" />
                          </button>

                          <Show when={showMemberActions() === member.id}>
                            <div class="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-md shadow-lg border border-slate-200 dark:border-slate-700 z-10">
                              <div class="py-1">
                                <Show when={member.status === 'invited'}>
                                  <button
                                    class="block w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                                    onClick={() => handleResendInvitation(member)}
                                  >
                                    <Mail class="w-4 h-4 inline mr-2" />
                                    Resend Invitation
                                  </button>
                                </Show>

                                <Show when={member.role !== 'owner'}>
                                  <button
                                    class="block w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                                    onClick={() => handleUpdateMemberRole(member, 'admin')}
                                  >
                                    Make Admin
                                  </button>
                                  <button
                                    class="block w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                                    onClick={() => handleUpdateMemberRole(member, 'member')}
                                  >
                                    Make Member
                                  </button>
                                  <button
                                    class="block w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                                    onClick={() => handleUpdateMemberRole(member, 'viewer')}
                                  >
                                    Make Viewer
                                  </button>
                                </Show>

                                <Show when={member.status !== 'suspended'}>
                                  <button
                                    class="block w-full text-left px-4 py-2 text-sm text-orange-600 dark:text-orange-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                                    onClick={() => handleSuspendMember(member)}
                                  >
                                    Suspend Member
                                  </button>
                                </Show>

                                <Show when={member.status === 'suspended'}>
                                  <button
                                    class="block w-full text-left px-4 py-2 text-sm text-green-600 dark:text-green-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                                    onClick={() => handleSuspendMember(member)}
                                  >
                                    Reactivate Member
                                  </button>
                                </Show>

                                <Show when={member.role !== 'owner'}>
                                  <button
                                    class="block w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                                    onClick={() => handleRemoveMember(member)}
                                  >
                                    Remove Member
                                  </button>
                                </Show>
                              </div>
                            </div>
                          </Show>
                        </div>
                      </Show>
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>

        <Show when={filteredMembers().length === 0}>
          <div class="text-center py-8">
            <User class="w-12 h-12 mx-auto mb-4 text-slate-400" />
            <h3 class="text-lg font-medium text-slate-900 dark:text-white mb-2">
              No members found
            </h3>
            <p class="text-slate-600 dark:text-slate-400">
              Try adjusting your search filters or invite some members.
            </p>
          </div>
        </Show>
      </div>

      {/* Invite Member Modal */}
      <Show when={showInviteModal()}>
        <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div class="bg-white dark:bg-slate-800 rounded-lg max-w-md w-full p-6">
            <h3 class="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              Invite Team Member
            </h3>

            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  class="input"
                  placeholder="colleague@company.com"
                  value={inviteEmail()}
                  onInput={(e) => setInviteEmail(e.currentTarget.value)}
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Role
                </label>
                <select
                  class="input"
                  value={inviteRole()}
                  onChange={(e) => setInviteRole(e.currentTarget.value as any)}
                >
                  <option value="viewer">Viewer - Can view workflows and apps</option>
                  <option value="member">Member - Can create and edit workflows</option>
                  <option value="admin">Admin - Can manage members and settings</option>
                </select>
              </div>

              <div>
                <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Personal Message (Optional)
                </label>
                <textarea
                  class="input"
                  rows="3"
                  placeholder="Welcome to our team! We're excited to have you on board."
                  value={inviteMessage()}
                  onInput={(e) => setInviteMessage(e.currentTarget.value)}
                />
              </div>
            </div>

            <div class="flex justify-end gap-3 mt-6">
              <button
                class="btn btn-secondary"
                onClick={() => setShowInviteModal(false)}
                disabled={isInviting()}
              >
                Cancel
              </button>
              <button
                class="btn btn-primary"
                onClick={handleInviteMember}
                disabled={isInviting() || !inviteEmail().trim()}
              >
                <Show when={isInviting()} fallback={
                  <>
                    <Mail class="w-4 h-4 mr-2" />
                    Send Invitation
                  </>
                }>
                  <div class="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Sending...
                </Show>
              </button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}