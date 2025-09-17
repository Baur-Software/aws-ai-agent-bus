import { A } from '@solidjs/router';
import { Show, createSignal, For } from 'solid-js';
import { useMCP } from '../contexts/MCPContext';
import { useSidebar } from '../contexts/SidebarContext';
import {
  X,
  RefreshCw,
  Wifi,
  WifiOff,
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
  const mcp = useMCP();
  const { isConnected, serverVersion, health } = mcp;
  const { sections }: { sections: () => SidebarSection[] } = useSidebar();
  const [isRefreshing, setIsRefreshing] = createSignal<boolean>(false);

  const handleRefresh = async (): Promise<void> => {
    setIsRefreshing(true);
    // Force a health check by reloading the page's MCP resources
    try {
      if (mcp.refresh) {
        mcp.refresh();
      } else {
        console.warn('Refresh method not available');
      }
    } catch (error) {
      console.warn('Manual health check failed:', error);
    }
    // Brief delay to show the refresh animation
    setTimeout(() => setIsRefreshing(false), 1000);
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
        <div class={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
          isConnected() 
            ? 'bg-green-50 border border-green-200 dark:bg-green-900/20 dark:border-green-800' 
            : 'bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800'
        }`}>
          <div class="flex items-center gap-2">
            {isConnected() ? (
              <Wifi class={`w-4 h-4 ${isConnected() ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`} />
            ) : (
              <WifiOff class={`w-4 h-4 ${isConnected() ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`} />
            )}
            <div class={`w-2 h-2 rounded-full ${isConnected() ? 'bg-green-500' : 'bg-red-500'} ${isConnected() ? 'animate-pulse' : ''}`} />
          </div>
          <div class="flex-1 min-w-0">
            <div class={`text-sm font-medium ${isConnected() ? 'text-green-900 dark:text-green-100' : 'text-red-900 dark:text-red-100'}`}>
              {isConnected() ? 'MCP Connected' : 'MCP Disconnected'}
            </div>
            <Show when={serverVersion()}>
              <div class={`text-xs ${isConnected() ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                v{serverVersion()}
              </div>
            </Show>
            <Show when={!isConnected()}>
              <div class="text-xs text-red-700 dark:text-red-300">
                Check server status
              </div>
            </Show>
          </div>
          <button
            onClick={handleRefresh}
            class={`p-1.5 rounded-md transition-colors hover:bg-slate-100 dark:hover:bg-slate-700 ${
              isRefreshing() ? 'animate-spin' : ''
            }`}
            title="Refresh connection status"
          >
            <RefreshCw class="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
          </button>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;