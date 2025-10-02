import { A } from '@solidjs/router';
import { Show, createSignal, For, type JSX } from 'solid-js';
import { useDashboardServer } from '../contexts/DashboardServerContext';
import { useSidebar } from '../contexts/SidebarContext';
import ConnectionStatus from './ui/ConnectionStatus';
import {
  X,
  Bot
} from 'lucide-solid';

interface SidebarSectionItem {
  href: string;
  label: string;
  icon: (props: { class?: string }) => JSX.Element;
}

interface SidebarSection {
  title: string;
  items: SidebarSectionItem[];
}

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

function Sidebar(props: SidebarProps) {
  const dashboardServer = useDashboardServer();
  const { isConnected } = dashboardServer;
  const { sections }: { sections: () => SidebarSection[] } = useSidebar();
  const [isRefreshing, setIsRefreshing] = createSignal<boolean>(false);

  const handleRefresh = async (): Promise<void> => {
    setIsRefreshing(true);
    // Force a page reload to refresh MCP resources
    window.location.reload();
  };

  return (
    <aside class={`fixed left-0 top-0 z-50 w-64 h-screen bg-white border-r border-slate-200 transform transition-transform duration-300 lg:translate-x-0 dark:bg-slate-900 dark:border-slate-700 ${props.isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      {/* Header with close button on mobile */}
      <div class="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 lg:justify-center">
        <A href="/dashboard" class="flex items-center gap-3 text-slate-900 dark:text-white font-bold text-lg" onClick={props.onClose}>
          <Bot class="w-8 h-8 text-blue-600" />
          <div class="flex flex-col">
            <span class="text-lg font-bold">AI Agent Bus</span>
            <span class="text-xs text-slate-500 dark:text-slate-400">MCP Dashboard</span>
          </div>
        </A>
        <button 
          class="lg:hidden p-1 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          onClick={props.onClose}
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav class="flex-1 overflow-y-auto p-4 space-y-6">
        <For each={sections()}>
          {(section: SidebarSection) => (
            <div class="space-y-2">
              <h3 class="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-2">
                {section.title}
              </h3>
              <div class="space-y-1">
                <For each={section.items}>
                  {(item: SidebarSectionItem) => (
                    <A
                      href={item.href}
                      class="nav-item flex items-center gap-3 px-3 py-2 text-sm font-medium text-slate-700 rounded-lg hover:bg-slate-100 hover:text-slate-900 transition-colors dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                      activeClass="bg-blue-50 text-blue-700 border-r-2 border-blue-600 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-400"
                      onClick={props.onClose}
                    >
                      <item.icon class="w-5 h-5 flex-shrink-0" />
                      <span>{item.label}</span>
                    </A>
                  )}
                </For>
              </div>
            </div>
          )}
        </For>
      </nav>

      {/* Footer */}
      <div class="p-4 border-t border-slate-200 dark:border-slate-700">
        <ConnectionStatus
          variant="styled"
          showIcon={true}
          showVersion={true}
          animate={true}
          showRefresh={true}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing()}
        />
      </div>
    </aside>
  );
}

export default Sidebar;