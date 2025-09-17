import { createSignal, Show } from 'solid-js';
import { useLocation } from '@solidjs/router';
import { useTheme } from '../contexts/ThemeContext';
import { useMCP } from '../contexts/MCPContext';
import { TriangleAlert } from 'lucide-solid';
import Sidebar from './Sidebar';
import Header from './Header';
import ChatPanel from './ChatPanel';

function Layout(props) {
  const [sidebarOpen, setSidebarOpen] = createSignal(false);
  const [chatPanelOpen, setChatPanelOpen] = createSignal(false);
  const { theme } = useTheme();
  const { isConnected } = useMCP();
  const location = useLocation();

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
      
      {/* Mobile sidebar backdrop */}
      <Show when={sidebarOpen()}>
        <div 
          class="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      </Show>

      {/* Sidebar */}
      <Sidebar 
        isOpen={sidebarOpen()}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main content area */}
      <div class={`lg:ml-64 flex flex-col min-h-screen transition-all duration-300 ${chatPanelOpen() ? 'mr-80' : ''}`}>
        {/* Header */}
        <Header 
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen())}
          onToggleChat={() => setChatPanelOpen(!chatPanelOpen())}
          chatOpen={chatPanelOpen()}
        />

        {/* Content */}
        <main class="flex-1 p-6 dark:bg-slate-900 dark:border-slate-700">
          <Show when={!isConnected()}>
            <div class="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-3 text-amber-800 dark:bg-amber-900 dark:border-amber-800 dark:text-amber-200">
              <TriangleAlert class="w-5 h-5 flex-shrink-0" />
              <span>Lost connection to MCP server. Trying to reconnect...</span>
            </div>
          </Show>
          
          <div class="max-w-7xl mx-auto">
            {props.children}
          </div>
        </main>
      </div>
    </div>
  );
}

export default Layout;