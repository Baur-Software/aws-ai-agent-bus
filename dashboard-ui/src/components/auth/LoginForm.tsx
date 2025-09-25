import { createSignal, Show } from 'solid-js';
import { useAuth } from '../../contexts/AuthContext';

export default function LoginForm() {
  const { login, isLoading } = useAuth();
  const [email, setEmail] = createSignal('');
  const [password, setPassword] = createSignal('');
  const [error, setError] = createSignal('');

  const isDevMode = () => {
    return import.meta.env.VITE_ENABLE_DEV_AUTH === 'true' || import.meta.env.DEV;
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError('');

    try {
      await login(email(), password());
    } catch (err: any) {
      setError(err.message || 'Login failed');
    }
  };

  const handleDevLogin = () => {
    login('demo@acme.com', 'dev-password').catch(err => {
      setError(err.message);
    });
  };

  return (
    <div class="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div class="sm:mx-auto sm:w-full sm:max-w-md">
        <div class="text-center">
          <h2 class="text-3xl font-bold text-gray-900">AI Agent Bus</h2>
          <p class="mt-2 text-sm text-gray-600">
            Multi-tenant workflow automation platform
          </p>
        </div>
      </div>

      <div class="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div class="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <Show when={isDevMode()}>
            <div class="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
              <div class="flex">
                <div class="flex-shrink-0">
                  <svg class="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                  </svg>
                </div>
                <div class="ml-3">
                  <h3 class="text-sm font-medium text-yellow-800">
                    Development Mode
                  </h3>
                  <div class="mt-2 text-sm text-yellow-700">
                    <p>Authentication is in dev mode. You'll be logged in as Demo User (user-demo-123) in the Acme organization.</p>
                  </div>
                  <div class="mt-3">
                    <button
                      type="button"
                      onClick={handleDevLogin}
                      disabled={isLoading()}
                      class="bg-yellow-100 hover:bg-yellow-200 text-yellow-800 text-sm font-medium px-3 py-2 rounded-md transition-colors duration-200 disabled:opacity-50"
                    >
                      {isLoading() ? 'Logging in...' : 'Quick Dev Login'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </Show>

          <form class="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label for="email" class="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <div class="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autocomplete="email"
                  required
                  value={email()}
                  onInput={(e) => setEmail(e.currentTarget.value)}
                  class="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="demo@acme.com"
                />
              </div>
            </div>

            <div>
              <label for="password" class="block text-sm font-medium text-gray-700">
                Password
              </label>
              <div class="mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autocomplete="current-password"
                  required
                  value={password()}
                  onInput={(e) => setPassword(e.currentTarget.value)}
                  class="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
            </div>

            <Show when={error()}>
              <div class="rounded-md bg-red-50 p-4">
                <div class="flex">
                  <div class="flex-shrink-0">
                    <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                    </svg>
                  </div>
                  <div class="ml-3">
                    <h3 class="text-sm font-medium text-red-800">
                      {error()}
                    </h3>
                  </div>
                </div>
              </div>
            </Show>

            <div>
              <button
                type="submit"
                disabled={isLoading()}
                class="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              >
                {isLoading() ? 'Signing in...' : 'Sign in'}
              </button>
            </div>
          </form>

          <Show when={!isDevMode()}>
            <div class="mt-6">
              <div class="relative">
                <div class="absolute inset-0 flex items-center">
                  <div class="w-full border-t border-gray-300" />
                </div>
                <div class="relative flex justify-center text-sm">
                  <span class="px-2 bg-white text-gray-500">Production authentication coming soon</span>
                </div>
              </div>
            </div>
          </Show>
        </div>
      </div>
    </div>
  );
}