import { Show } from 'solid-js';
import { Eye, EyeOff } from 'lucide-solid';
import { useSidebar, SidebarItem } from '../contexts/SidebarContext';
import { useNotifications } from '../contexts/NotificationContext';

interface SidebarSettingsItemProps {
  item: SidebarItem & { sectionTitle: string };
  isLoading: () => boolean;
  setIsLoading: (loading: boolean) => void;
}

function SidebarSettingsItem(props: SidebarSettingsItemProps) {
  const {
    connectedIntegrations,
    availableInfrastructure,
    hideItem,
    showItem,
    isItemVisible
  } = useSidebar();

  const notify = useNotifications();

  // Reactive computations
  const currentlyVisible = () => isItemVisible(props.item);
  const canToggle = () => !props.item.alwaysVisible &&
                           (!props.item.requiresIntegration || connectedIntegrations().has(props.item.requiresIntegration)) &&
                           (!props.item.requiresInfrastructure || availableInfrastructure().has(props.item.requiresInfrastructure));

  const handleToggleVisibility = async () => {
    props.setIsLoading(true);
    try {
      const isVisible = currentlyVisible();
      if (isVisible) {
        await hideItem(props.item.id);
        notify.info(`Hidden menu item from sidebar`);
      } else {
        await showItem(props.item.id);
        notify.success(`Added menu item to sidebar`);
      }
    } catch (error: any) {
      notify.error(`Failed to update sidebar: ${error.message}`);
    } finally {
      props.setIsLoading(false);
    }
  };

  return (
    <div class="flex items-center justify-between p-4 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
      <div class="flex items-center gap-4">
        <div class="p-2 rounded-lg bg-slate-100 dark:bg-slate-700">
          <props.item.icon class="w-5 h-5 text-slate-600 dark:text-slate-400" />
        </div>
        <div>
          <div class="flex items-center gap-2">
            <h3 class="font-medium text-slate-900 dark:text-white">{props.item.label}</h3>
            <span class="text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">
              {props.item.sectionTitle}
            </span>
          </div>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <Show when={canToggle()}>
          <button
            onClick={handleToggleVisibility}
            disabled={props.isLoading()}
            class={`p-2 rounded-lg transition-colors ${
              currentlyVisible()
                ? 'text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/30'
                : 'text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30'
            } disabled:opacity-50`}
            title={currentlyVisible() ? 'Hide from sidebar' : 'Show in sidebar'}
          >
            {currentlyVisible() ? <EyeOff class="w-4 h-4" /> : <Eye class="w-4 h-4" />}
          </button>
        </Show>

        <Show when={!canToggle()}>
          <div class="text-xs text-slate-500 dark:text-slate-400 px-2">
            {props.item.alwaysVisible ? 'Required' : 'Unavailable'}
          </div>
        </Show>
      </div>
    </div>
  );
}

export default SidebarSettingsItem;
