import { JSX, createSignal, onMount, Show, createContext, useContext } from 'solid-js';
import { useOrganization } from '../../contexts/OrganizationContext';

interface Route {
  path: string;
  component: () => JSX.Element;
  title?: string;
}

interface OrganizationRouterProps {
  routes: Route[];
  defaultRoute?: string;
}

export function OrganizationRouter(props: OrganizationRouterProps) {
  const { currentOrganization } = useOrganization();
  const [currentPath, setCurrentPath] = createSignal('');

  const updatePath = () => {
    const path = window.location.pathname;
    const org = currentOrganization();

    if (org) {
      // Remove organization slug from path
      const orgPath = path.replace(new RegExp(`^/${org.slug}`), '') || '/';
      setCurrentPath(orgPath);
    } else {
      setCurrentPath(path);
    }
  };

  onMount(() => {
    updatePath();

    // Listen for navigation changes
    const handlePopState = () => updatePath();
    window.addEventListener('popstate', handlePopState);

    // Cleanup
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  });

  // Update path when organization changes
  const org = currentOrganization();
  if (org) {
    updatePath();
  }

  const getCurrentRoute = () => {
    const path = currentPath();
    const route = props.routes.find(r => {
      if (r.path === path) return true;

      // Check for dynamic segments
      const routeParts = r.path.split('/').filter(Boolean);
      const pathParts = path.split('/').filter(Boolean);

      if (routeParts.length !== pathParts.length) return false;

      return routeParts.every((part, index) => {
        return part.startsWith(':') || part === pathParts[index];
      });
    });

    return route || props.routes.find(r => r.path === (props.defaultRoute || '/'));
  };

  const navigate = (path: string) => {
    const org = currentOrganization();
    if (org) {
      const fullPath = `/${org.slug}${path}`;
      window.history.pushState({}, '', fullPath);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  // Provide navigation context
  const NavigationContext = {
    navigate,
    currentPath,
    currentOrganization
  };

  const currentRoute = getCurrentRoute();

  return (
    <Show when={currentRoute} fallback={<div>Route not found</div>}>
      <div>
        {/* Set page title */}
        <Show when={currentRoute?.title}>
          {(() => {
            document.title = `${currentRoute?.title} - ${currentOrganization()?.name || 'Dashboard'}`;
            return null;
          })()}
        </Show>

        {/* Render current route component */}
        <NavigationProvider value={NavigationContext}>
          {currentRoute?.component()}
        </NavigationProvider>
      </div>
    </Show>
  );
}

// Navigation context for child components
const NavigationContext = createContext();

function NavigationProvider(props: { value: any; children: JSX.Element }) {
  return (
    <NavigationContext.Provider value={props.value}>
      {props.children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within NavigationProvider');
  }
  return context;
}

// Helper function to create organization-aware links
export function createOrgLink(path: string, orgSlug?: string): string {
  const slug = orgSlug || getCurrentOrgSlug();
  return slug ? `/${slug}${path}` : path;
}

function getCurrentOrgSlug(): string | null {
  const path = window.location.pathname;
  const segments = path.split('/').filter(Boolean);
  return segments[0] || null;
}

// Organization-aware Link component
export function OrgLink(props: {
  href: string;
  children: JSX.Element;
  class?: string;
  activeClass?: string;
}) {
  const { currentOrganization } = useOrganization();
  const { navigate, currentPath } = useNavigation();

  const fullHref = () => {
    const org = currentOrganization();
    return org ? `/${org.slug}${props.href}` : props.href;
  };

  const isActive = () => {
    return currentPath() === props.href;
  };

  const handleClick = (e: MouseEvent) => {
    e.preventDefault();
    navigate(props.href);
  };

  return (
    <a
      href={fullHref()}
      onClick={handleClick}
      class={`${props.class || ''} ${isActive() ? props.activeClass || '' : ''}`}
    >
      {props.children}
    </a>
  );
}

// URL parameter extraction utilities
export function useParams() {
  const { currentPath } = useNavigation();

  return (routePath: string) => {
    const path = currentPath();
    const routeParts = routePath.split('/').filter(Boolean);
    const pathParts = path.split('/').filter(Boolean);
    const params: Record<string, string> = {};

    routeParts.forEach((part, index) => {
      if (part.startsWith(':')) {
        const paramName = part.slice(1);
        params[paramName] = pathParts[index] || '';
      }
    });

    return params;
  };
}

// Query parameter utilities
export function useQuery() {
  const getQuery = () => {
    const searchParams = new URLSearchParams(window.location.search);
    const query: Record<string, string> = {};

    for (const [key, value] of searchParams.entries()) {
      query[key] = value;
    }

    return query;
  };

  const setQuery = (params: Record<string, string | null>) => {
    const searchParams = new URLSearchParams(window.location.search);

    Object.entries(params).forEach(([key, value]) => {
      if (value === null) {
        searchParams.delete(key);
      } else {
        searchParams.set(key, value);
      }
    });

    const newUrl = `${window.location.pathname}?${searchParams.toString()}`;
    window.history.replaceState({}, '', newUrl);
  };

  return { getQuery, setQuery };
}