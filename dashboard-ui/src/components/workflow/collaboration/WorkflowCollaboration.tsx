import { createSignal, For, Show } from 'solid-js';
import { Users, UserPlus, Shield, Eye, Edit } from 'lucide-solid';

export interface WorkflowCollaborator {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: 'owner' | 'editor' | 'viewer';
  status: 'active' | 'pending' | 'inactive';
  joinedAt: string;
}

export interface WorkflowPermissions {
  canEdit: boolean;
  canShare: boolean;
  canDelete: boolean;
  canManageAccess: boolean;
}

interface WorkflowCollaborationProps {
  collaborators?: WorkflowCollaborator[];
  permissions?: WorkflowPermissions;
  onInviteUser?: () => void;
  onRemoveUser?: (userId: string) => void;
  onChangeRole?: (userId: string, role: string) => void;
}

export default function WorkflowCollaboration(props: WorkflowCollaborationProps) {
  const [showInviteDialog, setShowInviteDialog] = createSignal(false);

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner':
        return Shield;
      case 'editor':
        return Edit;
      case 'viewer':
      default:
        return Eye;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'owner':
        return 'text-purple-600 dark:text-purple-400';
      case 'editor':
        return 'text-blue-600 dark:text-blue-400';
      case 'viewer':
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  return (
    <div class="p-4 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <Users class="w-5 h-5" />
          Collaboration
        </h3>
        <Show when={props.permissions?.canManageAccess}>
          <button
            onClick={() => setShowInviteDialog(true)}
            class="flex items-center gap-2 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm transition-colors"
          >
            <UserPlus class="w-4 h-4" />
            Invite
          </button>
        </Show>
      </div>

      <div class="space-y-3">
        <For each={props.collaborators || []}>
          {(collaborator) => {
            const RoleIcon = getRoleIcon(collaborator.role);
            return (
              <div class="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 bg-slate-300 dark:bg-slate-600 rounded-full flex items-center justify-center">
                    {collaborator.avatar ? (
                      <img src={collaborator.avatar} alt={collaborator.name} class="w-8 h-8 rounded-full" />
                    ) : (
                      <span class="text-slate-600 dark:text-slate-300 text-sm font-medium">
                        {collaborator.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div>
                    <div class="font-medium text-slate-900 dark:text-white text-sm">
                      {collaborator.name}
                    </div>
                    <div class="text-xs text-slate-500 dark:text-slate-400">
                      {collaborator.email}
                    </div>
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <div class={`flex items-center gap-1 text-sm ${getRoleColor(collaborator.role)}`}>
                    <RoleIcon class="w-4 h-4" />
                    <span class="capitalize">{collaborator.role}</span>
                  </div>
                  <Show when={collaborator.status === 'pending'}>
                    <span class="text-xs bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 px-2 py-1 rounded-full">
                      Pending
                    </span>
                  </Show>
                </div>
              </div>
            );
          }}
        </For>

        <Show when={!props.collaborators || props.collaborators.length === 0}>
          <div class="text-center py-6 text-slate-500 dark:text-slate-400">
            <Users class="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p class="text-sm">No collaborators yet</p>
            <p class="text-xs">Invite team members to collaborate on this workflow</p>
          </div>
        </Show>
      </div>
    </div>
  );
}