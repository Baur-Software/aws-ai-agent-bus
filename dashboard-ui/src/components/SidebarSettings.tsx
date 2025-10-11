import { createSignal, For, Show, mergeProps } from 'solid-js';
import { useSidebar } from '../contexts/SidebarContext';
import { usePageHeader } from '../contexts/HeaderContext';
import { useNotifications } from '../contexts/NotificationContext';
import { Eye, EyeOff, ArrowLeft, Plug, Server, CheckCircle } from 'lucide-solid';
import { A } from '@solidjs/router';

interface SidebarSettingsProps {
  isOverlay?: boolean;
}

function SidebarSettings(_props: SidebarSettingsProps) {
  // Set page-specific header (only when not in overlay)
    const props = mergeProps({ isOverlay: false }, _props);
if (!props.isOverlay) {
    usePageHeader('Sidebar Settings', 'Customize your navigation menu');
  }

  const {
    sections,
    preferences,
    connectedIntegrations,
    availableInfrastructure,
    hideItem,
    showItem,
    isItemVisible
  } = useSidebar();

  const notify = useNotifications();
  const [isLoading, setIsLoading] = createSignal(false);

  // Get all items across sections for management
  const allItems = () => {
    return sections().flatMap(section =>
      section.items.map(item => ({ ...item, sectionTitle: section.title }))
    );
  };

  const handleToggleVisibility = async (itemId: string, currentlyVisible: boolean) => {
    setIsLoading(true);
    try {
      if (currentlyVisible) {
        await hideItem(itemId);
        notify.info(`Hidden menu item from sidebar`);
      } else {
        await showItem(itemId);
        notify.success(`Added menu item to sidebar`);
      }
    } catch (error) {
      notify.error(`Failed to update sidebar: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div class="max-w-4xl mx-auto space-y-8">
      {/* Header - only show when not in overlay mode */}
      <Show when={!props.isOverlay}>
        <div class="flex items-center gap-4">
          <A href="/settings" class="p-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <ArrowLeft class="w-5 h-5" />
          </A>
          <div>
            <h1 class="text-2xl font-bold text-slate-900 dark:text-white">Sidebar Configuration</h1>
            <p class="text-slate-600 dark:text-slate-400 mt-1">Control which navigation items appear in your sidebar</p>
          </div>
        </div>
      </Show>

      {/* Status Overview */}
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="bg-white dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
          <div class="flex items-center gap-3">
            <Plug class="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <div>
              <div class="text-sm font-medium text-slate-900 dark:text-white">Connected Integrations</div>
              <div class="text-2xl font-bold text-blue-600 dark:text-blue-400">{connectedIntegrations().size}</div>
            </div>
          </div>
        </div>

        <div class="bg-white dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
          <div class="flex items-center gap-3">
            <Server class="w-5 h-5 text-green-600 dark:text-green-400" />
            <div>
              <div class="text-sm font-medium text-slate-900 dark:text-white">Available Infrastructure</div>
              <div class="text-2xl font-bold text-green-600 dark:text-green-400">{availableInfrastructure().size}</div>
            </div>
          </div>
        </div>

        <div class="bg-white dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
          <div class="flex items-center gap-3">
            <Eye class="w-5 h-5 text-purple-600 dark:text-purple-400" />
            <div>
              <div class="text-sm font-medium text-slate-900 dark:text-white">Visible Items</div>
              <div class="text-2xl font-bold text-purple-600 dark:text-purple-400">{allItems().filter(item => isItemVisible(item)).length}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Menu Items Management */}
      <div class="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
        <div class="p-6 border-b border-slate-200 dark:border-slate-700">
          <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Navigation Items</h2>
          <p class="text-sm text-slate-600 dark:text-slate-400 mt-1">Manage visibility of sidebar navigation items</p>
        </div>

        <div class="p-6">
          <div class="space-y-4">
            <For each={allItems()}>
              {(item) => {
                const currentlyVisible = isItemVisible(item);
                const canToggle = !item.alwaysVisible &&
                                 (!item.requiresIntegration || connectedIntegrations().has(item.requiresIntegration)) &&
                                 (!item.requiresInfrastructure || availableInfrastructure().has(item.requiresInfrastructure));

                return (
                  <div class="flex items-center justify-between p-4 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors">
                    <div class="flex items-center gap-4">
                      <div class="p-2 rounded-lg bg-slate-100 dark:bg-slate-700">
                        <item.icon class="w-5 h-5 text-slate-600 dark:text-slate-400" />
                      </div>
                      <div>
                        <div class="flex items-center gap-2">
                          <h3 class="font-medium text-slate-900 dark:text-white">{item.label}</h3>
                          <span class="text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">
                            {item.sectionTitle}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div class="flex items-center gap-2">
                      <Show when={canToggle}>
                        <button
                          onClick={() => handleToggleVisibility(item.id, currentlyVisible)}
                          disabled={isLoading()}
                          class={`p-2 rounded-lg transition-colors ${
                            currentlyVisible
                              ? 'text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/30'
                              : 'text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30'
                          } disabled:opacity-50`}
                          title={currentlyVisible ? 'Hide from sidebar' : 'Show in sidebar'}
                        >
                          {currentlyVisible ? <EyeOff class="w-4 h-4" /> : <Eye class="w-4 h-4" />}
                        </button>
                      </Show>

                      <Show when={!canToggle}>
                        <div class="text-xs text-slate-500 dark:text-slate-400 px-2">
                          {item.alwaysVisible ? 'Required' : 'Unavailable'}
                        </div>
                      </Show>
                    </div>
                  </div>
                );
              }}
            </For>
          </div>
        </div>
      </div>

      {/* Integration Status */}
      <div class="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
        <div class="p-6 border-b border-slate-200 dark:border-slate-700">
          <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Requirements Status</h2>
          <p class="text-sm text-slate-600 dark:text-slate-400 mt-1">View integration and infrastructure requirements</p>
        </div>

        <div class="p-6">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 class="font-medium text-slate-900 dark:text-white mb-3">Connected Integrations</h3>
              <div class="space-y-2">
                <Show when={connectedIntegrations().size > 0} fallback={
                  <div class="text-sm text-slate-500 dark:text-slate-400">No integrations connected</div>
                }>
                  <For each={Array.from(connectedIntegrations())}>
                    {(integration) => (
                      <div class="flex items-center gap-2 text-sm">
                        <CheckCircle class="w-4 h-4 text-green-600 dark:text-green-400" />
                        <span class="text-slate-900 dark:text-white capitalize">{integration.replace('-', ' ')}</span>
                      </div>
                    )}
                  </For>
                </Show>
              </div>
            </div>

            <div>
              <h3 class="font-medium text-slate-900 dark:text-white mb-3">Available Infrastructure</h3>
              <div class="space-y-2">
                <Show when={availableInfrastructure().size > 0} fallback={
                  <div class="text-sm text-slate-500 dark:text-slate-400">No infrastructure available</div>
                }>
                  <For each={Array.from(availableInfrastructure())}>
                    {(infra) => (
                      <div class="flex items-center gap-2 text-sm">
                        <CheckCircle class="w-4 h-4 text-green-600 dark:text-green-400" />
                        <span class="text-slate-900 dark:text-white uppercase">{infra}</span>
                      </div>
                    )}
                  </For>
                </Show>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SidebarSettings;