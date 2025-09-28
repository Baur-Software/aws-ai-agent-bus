import { createSignal, Show, onCleanup, createEffect, For } from 'solid-js';
import { useTheme } from '../contexts/ThemeContext';
import { useDashboardServer } from '../contexts/DashboardServerContext';
import { useHeader } from '../contexts/HeaderContext';
import { useOrganization } from '../contexts/OrganizationContext';
import {
  Menu,
  Sun,
  Moon,
  MessageCircle,
  User,
  ChevronDown,
  Settings,
  RotateCcw,
  Info,
  Loader2,
  Building,
  Check,
  Plus
} from 'lucide-solid';

function Header(props) {
  const { theme, toggleTheme } = useTheme();
  const { isConnected, connectionStatus, loading } = useDashboardServer();
  const { headerInfo } = useHeader();
  const { user, currentOrganization, organizations, switchOrganization } = useOrganization();
  const [userMenuOpen, setUserMenuOpen] = createSignal(false);
  const [orgMenuOpen, setOrgMenuOpen] = createSignal(false);

  // Close menus when clicking outside
  createEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuOpen() && !event.target.closest('.user-menu-container')) {
        setUserMenuOpen(false);
      }
      if (orgMenuOpen() && !event.target.closest('.org-menu-container')) {
        setOrgMenuOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    onCleanup(() => document.removeEventListener('click', handleClickOutside));
  });

  return (
    <header class="sticky top-0 z-30 bg-white border-b border-slate-200 px-6 py-4 dark:bg-slate-900 dark:border-slate-700">
      <div class="flex items-center justify-between">
        {/* Left side - Mobile menu button and title */}
        <div class="flex items-center gap-4">
          <button 
            class="lg:hidden p-2 -ml-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800"
            onClick={props.onToggleSidebar}
          >
            <Menu class="w-5 h-5" />
          </button>

          <div class="hidden lg:block">
            <h1 class="text-lg font-semibold text-slate-900 dark:text-white">{headerInfo().title}</h1>
            <div class="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              {headerInfo().tagline}
              <Show when={loading()}>
                <Loader2 class="w-4 h-4 animate-spin" />
              </Show>
            </div>
          </div>
        </div>

        {/* Center - Organization Switcher */}
        <Show when={currentOrganization()}>
          <div class="hidden md:flex items-center">
            <div class="relative org-menu-container">
              <button
                class="flex items-center gap-2 px-3 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors dark:text-slate-300 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-600"
                onClick={() => setOrgMenuOpen(!orgMenuOpen())}
              >
                <Building class="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span class="text-sm font-medium max-w-32 truncate">
                  {currentOrganization()?.name}
                </span>
                <ChevronDown class={`w-4 h-4 transition-transform ${orgMenuOpen() ? 'rotate-180' : ''}`} />
              </button>

              <Show when={orgMenuOpen()}>
                <div class="absolute left-0 mt-2 w-64 bg-white border border-slate-200 rounded-lg shadow-lg py-1 dark:bg-slate-800 dark:border-slate-700 z-50">
                  <div class="px-4 py-2 border-b border-slate-200 dark:border-slate-600">
                    <div class="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                      Switch Organization
                    </div>
                  </div>

                  <For each={organizations()}>
                    {(org) => (
                      <button
                        class="w-full flex items-center gap-3 px-4 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                        onClick={() => {
                          switchOrganization(org.id);
                          setOrgMenuOpen(false);
                        }}
                      >
                        <div class={`p-1.5 rounded ${org.id === currentOrganization()?.id ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-slate-100 dark:bg-slate-700'}`}>
                          <Building class={`w-3 h-3 ${org.id === currentOrganization()?.id ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'}`} />
                        </div>

                        <div class="flex-1 min-w-0">
                          <div class="flex items-center gap-2">
                            <span class={`font-medium truncate ${org.id === currentOrganization()?.id ? 'text-blue-900 dark:text-blue-300' : 'text-slate-900 dark:text-white'}`}>
                              {org.name}
                            </span>
                            <Show when={org.id === currentOrganization()?.id}>
                              <Check class="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                            </Show>
                          </div>
                          <div class="text-xs text-slate-500 dark:text-slate-400 truncate">
                            {org.role} • {org.memberCount} members
                          </div>
                        </div>
                      </button>
                    )}
                  </For>

                  <div class="border-t border-slate-200 dark:border-slate-600 mt-1">
                    <button
                      class="w-full flex items-center gap-3 px-4 py-2 text-left text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                      onClick={() => {
                        // TODO: Implement create organization
                        setOrgMenuOpen(false);
                      }}
                    >
                      <div class="p-1.5 rounded bg-blue-100 dark:bg-blue-900/30">
                        <Plus class="w-3 h-3 text-blue-600 dark:text-blue-400" />
                      </div>
                      <span class="font-medium">Create Organization</span>
                    </button>
                  </div>
                </div>
              </Show>
            </div>
          </div>
        </Show>

        {/* Right side - Actions */}
        <div class="flex items-center gap-2">
          
          {/* Theme toggle */}
          <button 
            class="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800"
            onClick={toggleTheme}
            title={`Switch to ${theme() === 'light' ? 'dark' : 'light'} theme`}
          >
            {theme() === 'light' ? <Moon class="w-5 h-5" /> : <Sun class="w-5 h-5" />}
          </button>

          {/* Chat toggle */}
          <button 
            class={`p-2 rounded-lg transition-colors ${
              props.chatOpen 
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' 
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800'
            }`}
            onClick={props.onToggleChat}
            title="Toggle AI Assistant"
          >
            <MessageCircle class="w-5 h-5" />
          </button>

          {/* User menu */}
          <div class="relative user-menu-container">
            <button 
              class="flex items-center gap-2 p-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors dark:text-slate-300 dark:hover:bg-slate-800"
              onClick={() => setUserMenuOpen(!userMenuOpen())}
            >
              <Show
                when={user()?.avatar}
                fallback={
                  <div class="flex items-center justify-center w-8 h-8 bg-slate-200 rounded-full dark:bg-slate-700">
                    <User class="w-4 h-4" />
                  </div>
                }
              >
                <img
                  src={user()?.avatar}
                  alt={user()?.name}
                  class="w-8 h-8 rounded-full object-cover"
                />
              </Show>
              <span class="hidden sm:inline text-sm font-medium">{user()?.name || 'User'}</span>
              <ChevronDown class={`w-4 h-4 transition-transform ${userMenuOpen() ? 'rotate-180' : ''}`} />
            </button>

            <Show when={userMenuOpen()}>
              <div class="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-lg shadow-lg py-1 dark:bg-slate-800 dark:border-slate-700">
                <a 
                  href="/settings" 
                  class="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  <Settings class="w-4 h-4" />
                  Settings
                </a>
                <button 
                  class="flex items-center gap-2 w-full px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700" 
                  onClick={() => window.location.reload()}
                >
                  <RotateCcw class="w-4 h-4" />
                  Refresh
                </button>
                <div class="my-1 border-t border-slate-200 dark:border-slate-600" />
                <a 
                  href="/info" 
                  target="_blank" 
                  class="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  <Info class="w-4 h-4" />
                  Server Info
                </a>
              </div>
            </Show>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;