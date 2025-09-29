import { createContext, useContext, createSignal, createEffect, onMount, ParentComponent } from 'solid-js';
import CognitoAuthService, { CognitoConfig, CognitoUser, AuthTokens } from '../services/CognitoAuthService';

export interface User {
  userId: string;
  organizationId: string;
  role: 'admin' | 'user' | 'viewer';
  email?: string;
  name?: string;
}

export interface AuthContextType {
  user: () => User | null;
  isAuthenticated: () => boolean;
  isLoading: () => boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  switchOrganization: (organizationId: string) => Promise<void>;
  confirmSignUp?: (email: string, code: string) => Promise<void>;
  resendConfirmationCode?: (email: string) => Promise<void>;
  forgotPassword?: (email: string) => Promise<void>;
  confirmForgotPassword?: (email: string, code: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {}

export const AuthProvider: ParentComponent<AuthProviderProps> = (props) => {
  const [user, setUser] = createSignal<User | null>(null);
  const [isLoading, setIsLoading] = createSignal(true);
  const [cognitoService, setCognitoService] = createSignal<CognitoAuthService | null>(null);
  const [tokens, setTokens] = createSignal<AuthTokens | null>(null);

  // Check if dev auth is enabled
  const isDevMode = () => {
    return import.meta.env.VITE_ENABLE_DEV_AUTH === 'true' ||
           import.meta.env.DEV;
  };

  // Dev user for testing
  const DEV_USER: User = {
    userId: 'user-demo-123',
    organizationId: 'acme',
    role: 'admin',
    email: 'demo@acme.com',
    name: 'Demo User'
  };

  // Initialize Cognito service
  const initializeCognito = async () => {
    if (isDevMode()) {
      console.log('🔧 Dev mode - skipping Cognito initialization');
      return;
    }

    try {
      // Get Cognito configuration from environment or API
      const cognitoConfig = await getCognitoConfig();
      const service = new CognitoAuthService(cognitoConfig);
      setCognitoService(service);
      console.log('✅ Cognito service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Cognito:', error);
      // Fall back to dev mode if Cognito fails
      console.log('🔧 Falling back to dev mode due to Cognito initialization failure');
    }
  };

  // Convert CognitoUser to User interface
  const convertCognitoUser = (cognitoUser: CognitoUser): User => {
    return {
      userId: cognitoUser.userId,
      organizationId: cognitoUser.organizationId || 'default',
      role: (cognitoUser.role as 'admin' | 'user' | 'viewer') || 'user',
      email: cognitoUser.email,
      name: cognitoUser.name,
    };
  };

  // Get Cognito configuration from environment or dashboard server
  const getCognitoConfig = async (): Promise<CognitoConfig> => {
    // Try environment variables first
    const envConfig = {
      userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
      userPoolClientId: import.meta.env.VITE_COGNITO_CLIENT_ID,
      region: import.meta.env.VITE_AWS_REGION || 'us-west-2',
      domain: import.meta.env.VITE_COGNITO_DOMAIN,
      redirectSignIn: import.meta.env.VITE_COGNITO_REDIRECT_SIGN_IN || window.location.origin,
      redirectSignOut: import.meta.env.VITE_COGNITO_REDIRECT_SIGN_OUT || window.location.origin,
    };

    if (envConfig.userPoolId && envConfig.userPoolClientId) {
      return envConfig as CognitoConfig;
    }

    // Fall back to dashboard server API
    try {
      const serverUrl = import.meta.env.VITE_MCP_SERVER_URL || 'http://localhost:3001';
      const response = await fetch(`${serverUrl}/api/auth/config`);
      if (response.ok) {
        const config = await response.json();
        return config.cognito;
      }
    } catch (error) {
      console.warn('Failed to fetch Cognito config from server:', error);
    }

    throw new Error('Cognito configuration not found');
  };

  const login = async (email: string, password: string) => {
    setIsLoading(true);

    try {
      if (isDevMode()) {
        // Dev mode - auto login with dev user
        console.log('🔧 Dev mode login - using hardcoded user');
        setUser(DEV_USER);
        localStorage.setItem('auth_user', JSON.stringify(DEV_USER));
        return;
      }

      // Cognito authentication
      const service = cognitoService();
      if (!service) {
        throw new Error('Authentication service not initialized');
      }

      const result = await service.signIn(email, password);

      if (result.challengeName) {
        // Handle challenges (MFA, password change, etc.)
        throw new Error(`Authentication challenge required: ${result.challengeName}`);
      }

      const convertedUser = convertCognitoUser(result.user);

      // Store tokens and user
      setTokens(result.tokens);
      setUser(convertedUser);
      localStorage.setItem('auth_tokens', JSON.stringify(result.tokens));
      localStorage.setItem('auth_user', JSON.stringify(convertedUser));

      console.log('✅ Login successful');
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      if (isDevMode()) {
        console.log('🔧 Dev mode logout');
        setUser(null);
        localStorage.removeItem('auth_user');
        return;
      }

      // Production logout
      const token = localStorage.getItem('auth_token');
      const serverUrl = import.meta.env.VITE_MCP_SERVER_URL || 'http://localhost:3001';

      if (token) {
        try {
          await fetch(`${serverUrl}/api/auth/logout`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            credentials: 'include'
          });
        } catch (logoutError) {
          console.error('Server logout failed:', logoutError);
          // Continue with local cleanup even if server logout fails
        }
      }

      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
      // Clear local storage anyway
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      setUser(null);
    }
  };

  const register = async (email: string, password: string, name: string) => {
    setIsLoading(true);

    try {
      if (isDevMode()) {
        // Dev mode - create a mock user
        console.log('🔧 Dev mode registration - using mock user');
        const mockUser: User = {
          userId: `user-dev-${Date.now()}`,
          organizationId: 'dev-org',
          role: 'admin',
          email,
          name
        };
        setUser(mockUser);
        localStorage.setItem('auth_user', JSON.stringify(mockUser));
        return;
      }

      // Production registration
      const serverUrl = import.meta.env.VITE_MCP_SERVER_URL || 'http://localhost:3001';
      const response = await fetch(`${serverUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password, name })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Registration failed');
      }

      const { user, token } = await response.json();
      localStorage.setItem('auth_token', token);
      localStorage.setItem('auth_user', JSON.stringify(user));
      setUser(user);
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const switchOrganization = async (organizationId: string) => {
    const currentUser = user();
    if (!currentUser) return;

    if (isDevMode()) {
      // Dev mode - just update the org ID
      const updatedUser = { ...currentUser, organizationId };
      setUser(updatedUser);
      localStorage.setItem('auth_user', JSON.stringify(updatedUser));
      return;
    }

    // Production org switching
    const token = localStorage.getItem('auth_token');
    const serverUrl = import.meta.env.VITE_MCP_SERVER_URL || 'http://localhost:3001';

    if (!token) {
      throw new Error('No authentication token found');
    }

    try {
      const response = await fetch(`${serverUrl}/api/auth/switch-organization`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ organizationId })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to switch organization');
      }

      const { user: updatedUser, token: newToken } = await response.json();

      // Update stored token and user
      localStorage.setItem('auth_token', newToken);
      localStorage.setItem('auth_user', JSON.stringify(updatedUser));
      setUser(updatedUser);
    } catch (error) {
      console.error('Organization switch error:', error);
      throw error;
    }
  };

  // Check for existing authentication on mount
  onMount(async () => {
    setIsLoading(true);

    try {
      if (isDevMode()) {
        // Dev mode - check localStorage or auto-login
        const storedUser = localStorage.getItem('auth_user');
        if (storedUser) {
          setUser(JSON.parse(storedUser));
        } else {
          // Auto-login in dev mode
          setUser(DEV_USER);
          localStorage.setItem('auth_user', JSON.stringify(DEV_USER));
        }
      } else {
        // Production mode - validate token
        const token = localStorage.getItem('auth_token');
        const storedUser = localStorage.getItem('auth_user');

        if (token && storedUser) {
          try {
            // Validate token with server
            const serverUrl = import.meta.env.VITE_MCP_SERVER_URL || 'http://localhost:3001';
            const response = await fetch(`${serverUrl}/api/auth/validate`, {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              credentials: 'include'
            });

            if (response.ok) {
              const { user: validUser } = await response.json();
              setUser(validUser);
              localStorage.setItem('auth_user', JSON.stringify(validUser));
            } else {
              // Token invalid, clear storage
              localStorage.removeItem('auth_token');
              localStorage.removeItem('auth_user');
            }
          } catch (error) {
            console.error('Token validation failed:', error);
            // Clear invalid token
            localStorage.removeItem('auth_token');
            localStorage.removeItem('auth_user');
          }
        }
      }
    } catch (error) {
      console.error('Auth initialization error:', error);
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
    } finally {
      setIsLoading(false);
    }
  });

  const contextValue: AuthContextType = {
    user,
    isAuthenticated: () => user() !== null,
    isLoading,
    login,
    register,
    logout,
    switchOrganization
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {props.children}
    </AuthContext.Provider>
  );
};