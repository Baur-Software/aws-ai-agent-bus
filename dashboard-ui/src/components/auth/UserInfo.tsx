import { Show, createSignal } from 'solid-js';
import { useAuth } from '../../contexts/AuthContext';

export default function UserInfo() {
  const { user, logout, switchOrganization } = useAuth();
  const [showDropdown, setShowDropdown] = createSignal(false);

  const handleLogout = async () => {
    setShowDropdown(false);
    await logout();
  };

  const isDevMode = () => {
    return import.meta.env.VITE_ENABLE_DEV_AUTH === 'true' || import.meta.env.DEV;
  };

  return (
    <div class="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown())}
        class="flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
      >
        <div class="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
          {user()?.name?.charAt(0) || user()?.email?.charAt(0) || '?'}
        </div>
        <div class="text-left">
          <div class="font-medium">{user()?.name || 'User'}</div>
          <div class="text-xs text-gray-500">{user()?.organizationId || 'No org'}</div>
        </div>
        <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <Show when={showDropdown()}>
        <div class="absolute right-0 mt-2 w-64 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-200">
          <div class="px-4 py-3 border-b border-gray-200">
            <p class="text-sm font-medium text-gray-900">{user()?.name || 'User'}</p>
            <p class="text-sm text-gray-500">{user()?.email}</p>
            <p class="text-xs text-gray-400 mt-1">
              {user()?.organizationId} • {user()?.role}
            </p>
            <Show when={isDevMode()}>
              <div class="mt-2 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded">
                Dev Mode
              </div>
            </Show>
          </div>

          <div class="py-1">
            <button
              onClick={() => {
                setShowDropdown(false);
                // TODO: Open profile settings
              }}
              class="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              <svg class="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Profile Settings
            </button>

            <button
              onClick={() => {
                setShowDropdown(false);
                // TODO: Open organization settings
              }}
              class="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              <svg class="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              Organization
            </button>

            <div class="border-t border-gray-200 mt-1 pt-1">
              <button
                onClick={handleLogout}
                class="flex items-center w-full px-4 py-2 text-sm text-red-700 hover:bg-red-50"
              >
                <svg class="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </Show>

      {/* Backdrop to close dropdown */}
      <Show when={showDropdown()}>
        <div
          class="fixed inset-0 z-40"
          onClick={() => setShowDropdown(false)}
        />
      </Show>
    </div>
  );
}