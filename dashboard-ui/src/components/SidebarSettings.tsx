import { createSignal, Index, Show, mergeProps } from 'solid-js';
import { useSidebar } from '../contexts/SidebarContext';
import { usePageHeader } from '../contexts/HeaderContext';
import { Eye, ArrowLeft, Plug, Server } from 'lucide-solid';
import { A } from '@solidjs/router';
import SidebarSettingsItem from './SidebarSettingsItem';

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
    allSections,
    connectedIntegrations,
    availableInfrastructure,
    isItemVisible
  } = useSidebar();

  const [isLoading, setIsLoading] = createSignal(false);

  // Get all items across sections for management (unfiltered)
  const allItems = () => {
    return allSections().flatMap(section =>
      section.items.map(item => ({ ...item, sectionTitle: section.title }))
    );
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
            <Index each={allItems()} fallback={<div>No items</div>}>
              {(item) => (
                <SidebarSettingsItem
                  item={item()}
                  isLoading={isLoading}
                  setIsLoading={setIsLoading}
                />
              )}
            </Index>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SidebarSettings;