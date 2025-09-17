import { createSignal, Show, For } from 'solid-js';
import { useOrganization } from '../../contexts/OrganizationContext';

export function OrganizationSwitcher() {
  const { currentOrganization, organizations, switchOrganization, user } = useOrganization();
  const [isOpen, setIsOpen] = createSignal(false);
  const [showCreateModal, setShowCreateModal] = createSignal(false);

  const handleOrgSwitch = (orgId: string) => {
    switchOrganization(orgId);
    setIsOpen(false);
  };

  return (
    <>
      <div class="relative">
        <button
          onClick={() => setIsOpen(!isOpen())}
          class="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <div class="flex items-center space-x-2">
            <div class="w-6 h-6 bg-blue-600 rounded text-white text-xs flex items-center justify-center font-semibold">
              {currentOrganization()?.name?.charAt(0).toUpperCase() || 'O'}
            </div>
            <span class="hidden md:block">{currentOrganization()?.name || 'Select Organization'}</span>
          </div>
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        <Show when={isOpen()}>
          <div class="absolute right-0 mt-2 w-80 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-50">
            <div class="py-1">
              {/* Current User Info */}
              <div class="px-4 py-3 border-b border-gray-200">
                <div class="flex items-center space-x-3">
                  <img
                    src={user()?.avatar || 'https://via.placeholder.com/32'}
                    alt={user()?.name}
                    class="w-8 h-8 rounded-full"
                  />
                  <div>
                    <div class="text-sm font-medium text-gray-900">{user()?.name}</div>
                    <div class="text-xs text-gray-500">{user()?.email}</div>
                  </div>
                </div>
              </div>

              {/* Organization List */}
              <div class="py-2">
                <div class="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Organizations
                </div>
                <For each={organizations()}>
                  {(org) => (
                    <button
                      onClick={() => handleOrgSwitch(org.id)}
                      class={`w-full flex items-center px-4 py-3 text-sm hover:bg-gray-50 ${
                        currentOrganization()?.id === org.id ? 'bg-blue-50 border-r-2 border-blue-600' : ''
                      }`}
                    >
                      <div class="flex items-center space-x-3 flex-1">
                        <div class={`w-8 h-8 rounded text-white text-sm flex items-center justify-center font-semibold ${
                          currentOrganization()?.id === org.id ? 'bg-blue-600' : 'bg-gray-400'
                        }`}>
                          {org.name.charAt(0).toUpperCase()}
                        </div>
                        <div class="flex-1 text-left">
                          <div class="font-medium text-gray-900">{org.name}</div>
                          <div class="text-xs text-gray-500">
                            {org.memberCount} member{org.memberCount !== 1 ? 's' : ''} • {org.role}
                          </div>
                        </div>
                      </div>
                      <Show when={currentOrganization()?.id === org.id}>
                        <svg class="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                        </svg>
                      </Show>
                    </button>
                  )}
                </For>
              </div>

              {/* Actions */}
              <div class="border-t border-gray-200 py-2">
                <button
                  onClick={() => {
                    setShowCreateModal(true);
                    setIsOpen(false);
                  }}
                  class="w-full flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <svg class="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Create new organization
                </button>
                <a
                  href={`/${currentOrganization()?.slug}/settings`}
                  class="w-full flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  onClick={() => setIsOpen(false)}
                >
                  <svg class="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Organization settings
                </a>
              </div>
            </div>
          </div>
        </Show>

        {/* Click outside to close */}
        <Show when={isOpen()}>
          <div
            class="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
        </Show>
      </div>

      {/* Create Organization Modal */}
      <CreateOrganizationModal
        isOpen={showCreateModal()}
        onClose={() => setShowCreateModal(false)}
      />
    </>
  );
}

function CreateOrganizationModal(props: { isOpen: boolean; onClose: () => void }) {
  const { createOrganization } = useOrganization();
  const [name, setName] = createSignal('');
  const [description, setDescription] = createSignal('');
  const [loading, setLoading] = createSignal(false);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (!name().trim()) return;

    try {
      setLoading(true);
      await createOrganization(name().trim(), description().trim() || undefined);
      setName('');
      setDescription('');
      props.onClose();
    } catch (error) {
      console.error('Failed to create organization:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Show when={props.isOpen}>
      <div class="fixed inset-0 z-50 overflow-y-auto">
        <div class="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
          <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={props.onClose} />

          <div class="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
            <form onSubmit={handleSubmit}>
              <div class="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div class="sm:flex sm:items-start">
                  <div class="mt-3 text-center sm:mt-0 sm:text-left w-full">
                    <h3 class="text-lg leading-6 font-medium text-gray-900 mb-4">
                      Create New Organization
                    </h3>

                    <div class="space-y-4">
                      <div>
                        <label for="org-name" class="block text-sm font-medium text-gray-700">
                          Organization Name
                        </label>
                        <input
                          id="org-name"
                          type="text"
                          value={name()}
                          onInput={(e) => setName(e.currentTarget.value)}
                          class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                          placeholder="Acme Corporation"
                          required
                        />
                      </div>

                      <div>
                        <label for="org-description" class="block text-sm font-medium text-gray-700">
                          Description (optional)
                        </label>
                        <textarea
                          id="org-description"
                          value={description()}
                          onInput={(e) => setDescription(e.currentTarget.value)}
                          rows="3"
                          class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                          placeholder="Brief description of your organization"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div class="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="submit"
                  disabled={loading() || !name().trim()}
                  class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading() ? 'Creating...' : 'Create Organization'}
                </button>
                <button
                  type="button"
                  onClick={props.onClose}
                  class="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </Show>
  );
}