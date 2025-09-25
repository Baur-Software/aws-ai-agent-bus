import { ParentComponent, Show, createEffect } from 'solid-js';
import { useAuth } from '../../contexts/AuthContext';
import LoginForm from './LoginForm';

interface AuthGuardProps {}

const AuthGuard: ParentComponent<AuthGuardProps> = (props) => {
  const { isAuthenticated, isLoading, user } = useAuth();

  // Debug logging in development
  createEffect(() => {
    if (import.meta.env.DEV) {
      console.log('🔐 Auth state:', {
        isAuthenticated: isAuthenticated(),
        isLoading: isLoading(),
        user: user()
      });
    }
  });

  return (
    <Show
      when={!isLoading()}
      fallback={
        <div class="min-h-screen bg-gray-50 flex items-center justify-center">
          <div class="text-center">
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p class="mt-4 text-gray-600">Loading...</p>
          </div>
        </div>
      }
    >
      <Show
        when={isAuthenticated()}
        fallback={<LoginForm />}
      >
        {props.children}
      </Show>
    </Show>
  );
};

export default AuthGuard;