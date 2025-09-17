import { createContext, useContext, createSignal, createResource, JSX, onMount } from 'solid-js';
import { useOrganization } from './OrganizationContext';

export interface MCPContextScope {
  id: string;
  type: 'personal' | 'organization';
  name: string;
  description?: string;
  permissions: string[];
  oauthGrants: string[];
  workflows: string[];
  organizationId?: string; // Only for org contexts
  userId: string;
  createdAt: number;
  updatedAt: number;
}

export interface ChatSession {
  sessionId: string;
  userId: string;
  contextId: string; // Current MCP context
  contextType: 'personal' | 'organization';
  organizationId?: string;
  title: string;
  lastMessage?: string;
  createdAt: number;
  updatedAt: number;
}

export interface MCPContextManagerValue {
  // Current context state
  currentContext: () => MCPContextScope | null;
  currentSession: () => ChatSession | null;
  availableContexts: () => MCPContextScope[];

  // Context management
  switchContext: (contextId: string) => Promise<void>;
  createPersonalContext: (name: string, description?: string) => Promise<MCPContextScope>;
  createOrgContext: (name: string, description?: string) => Promise<MCPContextScope>;

  // Session management
  createSession: (title: string, contextId?: string) => Promise<ChatSession>;
  switchSession: (sessionId: string) => Promise<void>;
  updateSessionContext: (sessionId: string, contextId: string) => Promise<void>;
  getSessions: () => ChatSession[];

  // Loading states
  loading: () => boolean;
  error: () => string | null;
}

const MCPContextManagerContext = createContext<MCPContextManagerValue>();

class MCPContextService {
  static async getContexts(userId: string, organizationId?: string): Promise<MCPContextScope[]> {
    const headers: Record<string, string> = {
      'x-user-id': userId
    };

    if (organizationId) {
      headers['x-organization-id'] = organizationId;
    }

    try {
      const response = await fetch('/api/mcp/contexts', { headers });
      if (!response.ok) {
        throw new Error('Failed to fetch contexts');
      }
      const data = await response.json();
      return data.contexts || [];
    } catch (error) {
      console.error('Failed to load MCP contexts:', error);
      // Return default personal context if API fails
      return [{
        id: `personal_${userId}`,
        type: 'personal',
        name: 'Personal Context',
        description: 'Your personal MCP context',
        permissions: ['mcp:*'],
        oauthGrants: [],
        workflows: [],
        userId,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }];
    }
  }

  static async createContext(
    userId: string,
    type: 'personal' | 'organization',
    name: string,
    description?: string,
    organizationId?: string
  ): Promise<MCPContextScope> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-user-id': userId
    };

    if (organizationId) {
      headers['x-organization-id'] = organizationId;
    }

    const response = await fetch('/api/mcp/contexts', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        type,
        name,
        description,
        organizationId
      })
    });

    if (!response.ok) {
      throw new Error('Failed to create context');
    }

    return response.json();
  }

  static async getSessions(userId: string): Promise<ChatSession[]> {
    try {
      const response = await fetch('/api/chat/sessions', {
        headers: {
          'x-user-id': userId
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch sessions');
      }

      const data = await response.json();
      return data.sessions || [];
    } catch (error) {
      console.error('Failed to load chat sessions:', error);
      return [];
    }
  }

  static async createSession(
    userId: string,
    title: string,
    contextId: string,
    organizationId?: string
  ): Promise<ChatSession> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-user-id': userId
    };

    if (organizationId) {
      headers['x-organization-id'] = organizationId;
    }

    const response = await fetch('/api/chat/sessions', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title,
        contextId,
        organizationId
      })
    });

    if (!response.ok) {
      throw new Error('Failed to create session');
    }

    return response.json();
  }

  static async updateSession(
    sessionId: string,
    userId: string,
    updates: Partial<ChatSession>
  ): Promise<ChatSession> {
    const response = await fetch(`/api/chat/sessions/${sessionId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userId
      },
      body: JSON.stringify(updates)
    });

    if (!response.ok) {
      throw new Error('Failed to update session');
    }

    return response.json();
  }
}

interface MCPContextManagerProviderProps {
  children: JSX.Element;
}

export function MCPContextManagerProvider(props: MCPContextManagerProviderProps) {
  const { user, currentOrganization } = useOrganization();
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [currentContextId, setCurrentContextId] = createSignal<string | null>(null);
  const [currentSessionId, setCurrentSessionId] = createSignal<string | null>(null);

  // Load available contexts (personal + organizational)
  const [contexts, { refetch: refetchContexts }] = createResource(
    () => ({ userId: user()?.id, orgId: currentOrganization()?.id }),
    async ({ userId, orgId }) => {
      if (!userId) return [];

      try {
        setLoading(true);

        // Get personal contexts
        const personalContexts = await MCPContextService.getContexts(userId);

        // Get organizational contexts if in an org
        let orgContexts: MCPContextScope[] = [];
        if (orgId) {
          orgContexts = await MCPContextService.getContexts(userId, orgId);
        }

        // Combine and deduplicate
        const allContexts = [...personalContexts, ...orgContexts];
        const uniqueContexts = allContexts.filter((context, index, self) =>
          index === self.findIndex(c => c.id === context.id)
        );

        // Set default context if none selected
        if (!currentContextId() && uniqueContexts.length > 0) {
          // Prefer personal context, then org context
          const defaultContext = uniqueContexts.find(c => c.type === 'personal') || uniqueContexts[0];
          setCurrentContextId(defaultContext.id);
        }

        return uniqueContexts;
      } catch (err) {
        setError('Failed to load MCP contexts');
        return [];
      } finally {
        setLoading(false);
      }
    }
  );

  // Load chat sessions
  const [sessions, { refetch: refetchSessions }] = createResource(
    () => user()?.id,
    async (userId) => {
      if (!userId) return [];
      return MCPContextService.getSessions(userId);
    }
  );

  // Computed values
  const availableContexts = () => contexts() || [];
  const currentContext = () => {
    const contextId = currentContextId();
    return availableContexts().find(c => c.id === contextId) || null;
  };

  const currentSession = () => {
    const sessionId = currentSessionId();
    const sessionList = sessions() || [];
    return sessionList.find(s => s.sessionId === sessionId) || null;
  };

  // Actions
  const switchContext = async (contextId: string) => {
    const context = availableContexts().find(c => c.id === contextId);
    if (!context) {
      throw new Error('Context not found');
    }

    setCurrentContextId(contextId);

    // Update current session if one is active
    const session = currentSession();
    if (session && user()?.id) {
      try {
        await MCPContextService.updateSession(
          session.sessionId,
          user()!.id,
          {
            contextId,
            contextType: context.type,
            organizationId: context.organizationId
          }
        );
        refetchSessions();
      } catch (error) {
        console.error('Failed to update session context:', error);
      }
    }

    // Store preference in localStorage
    localStorage.setItem('mcp_current_context', contextId);
  };

  const createPersonalContext = async (name: string, description?: string): Promise<MCPContextScope> => {
    const userId = user()?.id;
    if (!userId) {
      throw new Error('User not authenticated');
    }

    try {
      setLoading(true);
      const newContext = await MCPContextService.createContext(
        userId,
        'personal',
        name,
        description
      );

      refetchContexts();
      return newContext;
    } catch (err) {
      setError('Failed to create personal context');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const createOrgContext = async (name: string, description?: string): Promise<MCPContextScope> => {
    const userId = user()?.id;
    const orgId = currentOrganization()?.id;

    if (!userId || !orgId) {
      throw new Error('User or organization not available');
    }

    try {
      setLoading(true);
      const newContext = await MCPContextService.createContext(
        userId,
        'organization',
        name,
        description,
        orgId
      );

      refetchContexts();
      return newContext;
    } catch (err) {
      setError('Failed to create organization context');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const createSession = async (title: string, contextId?: string): Promise<ChatSession> => {
    const userId = user()?.id;
    if (!userId) {
      throw new Error('User not authenticated');
    }

    const useContextId = contextId || currentContextId();
    if (!useContextId) {
      throw new Error('No context available');
    }

    const context = availableContexts().find(c => c.id === useContextId);
    if (!context) {
      throw new Error('Context not found');
    }

    try {
      setLoading(true);
      const session = await MCPContextService.createSession(
        userId,
        title,
        useContextId,
        context.organizationId
      );

      setCurrentSessionId(session.sessionId);
      refetchSessions();
      return session;
    } catch (err) {
      setError('Failed to create session');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const switchSession = async (sessionId: string) => {
    const session = (sessions() || []).find(s => s.sessionId === sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    setCurrentSessionId(sessionId);
    setCurrentContextId(session.contextId);

    // Store in localStorage
    localStorage.setItem('mcp_current_session', sessionId);
  };

  const updateSessionContext = async (sessionId: string, contextId: string) => {
    const userId = user()?.id;
    if (!userId) return;

    const context = availableContexts().find(c => c.id === contextId);
    if (!context) return;

    try {
      await MCPContextService.updateSession(sessionId, userId, {
        contextId,
        contextType: context.type,
        organizationId: context.organizationId
      });

      refetchSessions();

      // Update current session if it's the one being modified
      if (currentSessionId() === sessionId) {
        setCurrentContextId(contextId);
      }
    } catch (error) {
      console.error('Failed to update session context:', error);
    }
  };

  // Load saved preferences on mount
  onMount(() => {
    const savedContext = localStorage.getItem('mcp_current_context');
    const savedSession = localStorage.getItem('mcp_current_session');

    if (savedContext) {
      setCurrentContextId(savedContext);
    }

    if (savedSession) {
      setCurrentSessionId(savedSession);
    }
  });

  const contextValue: MCPContextManagerValue = {
    currentContext,
    currentSession,
    availableContexts,
    switchContext,
    createPersonalContext,
    createOrgContext,
    createSession,
    switchSession,
    updateSessionContext,
    getSessions: () => sessions() || [],
    loading,
    error
  };

  return (
    <MCPContextManagerContext.Provider value={contextValue}>
      {props.children}
    </MCPContextManagerContext.Provider>
  );
}

export function useMCPContextManager(): MCPContextManagerValue {
  const context = useContext(MCPContextManagerContext);
  if (!context) {
    throw new Error('useMCPContextManager must be used within a MCPContextManagerProvider');
  }
  return context;
}

export default MCPContextManagerContext;