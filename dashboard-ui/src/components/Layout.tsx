import { createSignal, Show } from 'solid-js';
import { useTheme } from '../contexts/ThemeContext';
import { useDashboardServer } from '../contexts/DashboardServerContext';
import { TriangleAlert } from 'lucide-solid';
import ChatPanel from './ChatPanel';
import OverlayManager from './workflow/core/OverlayManager';

function Layout(props) {
  const [chatPanelOpen, setChatPanelOpen] = createSignal(false);
  const { theme } = useTheme();
  const dashboardServer = useDashboardServer();


  return (
    <div class={`min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 ${theme() === 'dark' ? 'dark' : ''}`} data-theme={theme()}>
      {/* Chat panel */}
      <Show when={chatPanelOpen()}>
        <ChatPanel onClose={() => setChatPanelOpen(false)} />
        {/* Mobile chat backdrop */}
        <div 
          class="fixed inset-0 z-40 bg-black bg-opacity-50 md:hidden"
          onClick={() => setChatPanelOpen(false)}
        />
      </Show>

      {/* Main content area - canvas-first layout (no sidebar/header) */}
      <div class={`flex flex-col min-h-screen transition-all duration-300 ${chatPanelOpen() ? 'mr-80' : ''}`}>
        {/* Content */}
        <main class="flex-1 dark:bg-slate-900 dark:border-slate-700">
          <Show when={!dashboardServer.isConnected()}>
            <div class="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-3 text-amber-800 dark:bg-amber-900 dark:border-amber-800 dark:text-amber-200 shadow-lg">
              <TriangleAlert class="w-5 h-5 flex-shrink-0" />
              <span>Lost connection to server. Trying to reconnect...</span>
            </div>
          </Show>

          {props.children}
        </main>
      </div>

      {/* Overlay Manager */}
      <OverlayManager />
    </div>
  );
}

export default Layout;