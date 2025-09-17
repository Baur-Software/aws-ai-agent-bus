import { createSignal, Show, For } from 'solid-js';
import { useMCPContextManager } from '../../contexts/MCPContextManager';
import { useOrganization } from '../../contexts/OrganizationContext';

export function ContextSwitcher() {
  const {
    currentContext,
    currentSession,
    availableContexts,
    switchContext
  } = useMCPContextManager();
  const { currentOrganization } = useOrganization();
  const [isOpen, setIsOpen] = createSignal(false);

  const handleContextSwitch = async (contextId: string) => {
    try {
      await switchContext(contextId);
      setIsOpen(false);
    } catch (error) {
      console.error('Failed to switch context:', error);
    }
  };

  const getContextIcon = (type: 'personal' | 'organization') => {
    if (type === 'personal') {
      return (
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      );
    }
    return (
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    );
  };

  const getContextBadgeColor = (type: 'personal' | 'organization') => {
    return type === 'personal'
      ? 'bg-green-100 text-green-800 border-green-200'
      : 'bg-blue-100 text-blue-800 border-blue-200';
  };

  const personalContexts = () => availableContexts().filter(c => c.type === 'personal');
  const orgContexts = () => availableContexts().filter(c => c.type === 'organization');

  return (
    <div class="relative">
      <button
        onClick={() => setIsOpen(!isOpen())}
        class="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 min-w-[200px]"
      >
        <div class="flex items-center space-x-2 flex-1">
          <div class={`px-2 py-1 rounded-full text-xs font-medium border ${getContextBadgeColor(currentContext()?.type || 'personal')}`}>
            <div class="flex items-center space-x-1">
              {getContextIcon(currentContext()?.type || 'personal')}
              <span>{currentContext()?.type === 'personal' ? 'Personal' : 'Organization'}</span>
            </div>
          </div>
          <span class="truncate">{currentContext()?.name || 'Select Context'}</span>
        </div>
        <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <Show when={isOpen()}>
        <div class="absolute left-0 mt-2 w-80 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-50">
          <div class="py-1">
            {/* Current Session Info */}
            <Show when={currentSession()}>
              <div class="px-4 py-3 border-b border-gray-200">
                <div class="text-sm font-medium text-gray-900">Current Chat Session</div>
                <div class="text-xs text-gray-500 mt-1">
                  {currentSession()?.title || 'Untitled Session'}
                </div>
                <div class="text-xs text-gray-400 mt-1">
                  Context will switch for this session
                </div>
              </div>
            </Show>

            {/* Personal Contexts */}
            <Show when={personalContexts().length > 0}>
              <div class="py-2">
                <div class="px-4 py-2 flex items-center space-x-2">
                  {getContextIcon('personal')}
                  <span class="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Personal Contexts
                  </span>
                </div>
                <For each={personalContexts()}>
                  {(context) => (
                    <button
                      onClick={() => handleContextSwitch(context.id)}
                      class={`w-full flex items-center px-4 py-3 text-sm hover:bg-gray-50 ${
                        currentContext()?.id === context.id ? 'bg-green-50 border-r-2 border-green-600' : ''
                      }`}
                    >
                      <div class="flex items-center space-x-3 flex-1">
                        <div class={`w-8 h-8 rounded text-white text-sm flex items-center justify-center font-semibold ${
                          currentContext()?.id === context.id ? 'bg-green-600' : 'bg-gray-400'
                        }`}>
                          {context.name.charAt(0).toUpperCase()}
                        </div>
                        <div class="flex-1 text-left">
                          <div class="font-medium text-gray-900">{context.name}</div>
                          <Show when={context.description}>
                            <div class="text-xs text-gray-500">{context.description}</div>
                          </Show>
                          <div class="text-xs text-gray-400">
                            {context.oauthGrants.length} integration{context.oauthGrants.length !== 1 ? 's' : ''}
                          </div>
                        </div>
                      </div>
                      <Show when={currentContext()?.id === context.id}>
                        <svg class="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                        </svg>
                      </Show>
                    </button>
                  )}
                </For>
              </div>
            </Show>

            {/* Organization Contexts */}
            <Show when={orgContexts().length > 0 && currentOrganization()}>
              <div class="py-2 border-t border-gray-100">
                <div class="px-4 py-2 flex items-center space-x-2">
                  {getContextIcon('organization')}
                  <span class="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    {currentOrganization()?.name} Contexts
                  </span>
                </div>
                <For each={orgContexts()}>
                  {(context) => (
                    <button
                      onClick={() => handleContextSwitch(context.id)}
                      class={`w-full flex items-center px-4 py-3 text-sm hover:bg-gray-50 ${
                        currentContext()?.id === context.id ? 'bg-blue-50 border-r-2 border-blue-600' : ''
                      }`}
                    >
                      <div class="flex items-center space-x-3 flex-1">
                        <div class={`w-8 h-8 rounded text-white text-sm flex items-center justify-center font-semibold ${
                          currentContext()?.id === context.id ? 'bg-blue-600' : 'bg-gray-400'
                        }`}>
                          {context.name.charAt(0).toUpperCase()}
                        </div>
                        <div class="flex-1 text-left">
                          <div class="font-medium text-gray-900">{context.name}</div>
                          <Show when={context.description}>
                            <div class="text-xs text-gray-500">{context.description}</div>
                          </Show>
                          <div class="text-xs text-gray-400">
                            {context.oauthGrants.length} integration{context.oauthGrants.length !== 1 ? 's' : ''}
                          </div>
                        </div>
                      </div>
                      <Show when={currentContext()?.id === context.id}>
                        <svg class="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                        </svg>
                      </Show>
                    </button>
                  )}
                </For>
              </div>
            </Show>

            {/* Context Actions */}
            <div class="border-t border-gray-200 py-2">
              <button
                onClick={() => {
                  // Navigate to context management
                  const orgSlug = currentOrganization()?.slug;
                  const path = orgSlug ? `/${orgSlug}/contexts` : '/contexts';
                  window.location.href = path;
                  setIsOpen(false);
                }}
                class="w-full flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <svg class="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Manage MCP Contexts
              </button>

              <button
                onClick={() => {
                  // Navigate to integrations
                  const orgSlug = currentOrganization()?.slug;
                  const path = orgSlug ? `/${orgSlug}/integrations` : '/integrations';
                  window.location.href = path;
                  setIsOpen(false);
                }}
                class="w-full flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <svg class="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                Manage Integrations
              </button>
            </div>
          </div>
        </div>

        {/* Click outside to close */}
        <div
          class="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      </Show>
    </div>
  );
}

export function ContextIndicator() {
  const { currentContext } = useMCPContextManager();
  const { currentOrganization } = useOrganization();

  const getContextIcon = (type: 'personal' | 'organization') => {
    if (type === 'personal') {
      return (
        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      );
    }
    return (
      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    );
  };

  return (
    <div class="flex items-center space-x-1 text-xs text-gray-500">
      {getContextIcon(currentContext()?.type || 'personal')}
      <span>
        {currentContext()?.type === 'personal' ? 'Personal' : currentOrganization()?.name}
      </span>
      <span>•</span>
      <span>{currentContext()?.name}</span>
    </div>
  );
}