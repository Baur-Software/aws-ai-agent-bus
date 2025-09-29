import { createSignal, Show, For, lazy, onMount, onCleanup } from 'solid-js';
import { useOverlay } from '../../../contexts/OverlayContext';
import { useOrganization } from '../../../contexts/OrganizationContext';
import ConnectionStatus from '../../ui/ConnectionStatus';
import {
  Home,
  Database,
  Archive,
  Workflow,
  Calendar,
  Settings,
  User,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  Pin,
  PinOff,
  MessageCircle,
  ChevronDown,
  Building,
  Grid3X3
} from 'lucide-solid';

// Lazy load the pages as overlays
const Dashboard = lazy(() => import('../../../pages/Dashboard'));
const KVStore = lazy(() => import('../../../pages/KVStore'));
const Artifacts = lazy(() => import('../../../pages/Artifacts'));
const Events = lazy(() => import('../../../pages/Events'));
const SettingsPage = lazy(() => import('../../../pages/Settings'));
const AppsTab = lazy(() => import('../../apps/AppsTab'));

interface FloatingNavigationProps {
  currentPage?: string;
  onNavigate?: (page: string) => void;
  onPositionChange?: (x: number, y: number) => void;
  onPinnedChange?: (isPinned: boolean) => void;
  onToggleChat?: () => void;
  onOpenWorkflowBrowser?: () => void;
  onOpenMarketplace?: () => void;
  initialPosition?: { x: number; y: number };
  initialPinned?: boolean;
}

interface NavItem {
  id: string;
  label: string;
  icon: any;
  path: string;
  badge?: number;
}

export default function FloatingNavigation(props: FloatingNavigationProps) {
  const [position, setPosition] = createSignal(props.initialPosition || { x: 0, y: 0 });
  const [isCollapsed, setIsCollapsed] = createSignal(props.initialPinned ?? true);
  const [isDragging, setIsDragging] = createSignal(false);
  const [isVisible, setIsVisible] = createSignal(true);
  const [isPinned, setIsPinned] = createSignal(props.initialPinned ?? true);
  const [showOrgDropdown, setShowOrgDropdown] = createSignal(false);

  const { openOverlay } = useOverlay();
  const { user, currentOrganization, organizations, switchOrganization } = useOrganization();

  // Navigation drag handling
  let navRef: HTMLDivElement | undefined;
  let dragStart = { x: 0, y: 0, panelX: 0, panelY: 0 };

  const handleMouseDown = (e: MouseEvent) => {
    // Don't start drag if clicking on buttons or not on drag handle
    if (!(e.target as Element).closest('[data-drag-handle]') ||
        (e.target as Element).closest('button') ||
        isPinned()) {
      return;
    }

    e.preventDefault(); // Prevent text selection during drag
    setIsDragging(true);
    const pos = position();
    dragStart = {
      x: e.clientX,
      y: e.clientY,
      panelX: pos.x,
      panelY: pos.y
    };

    const handleMouseMove = (e: MouseEvent) => {
      const newX = dragStart.panelX + (e.clientX - dragStart.x);
      const newY = dragStart.panelY + (e.clientY - dragStart.y);

      // Keep navigation within viewport bounds - increased width by 100px
      const maxX = window.innerWidth - (isCollapsed() ? 60 : 320);
      const maxY = window.innerHeight - 300;

      const clampedPos = {
        x: Math.max(0, Math.min(maxX, newX)),
        y: Math.max(0, Math.min(maxY, newY))
      };

      setPosition(clampedPos);
      props.onPositionChange?.(clampedPos.x, clampedPos.y);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const navItems: NavItem[] = [
    { id: 'workflows', label: 'Workflows', icon: Workflow, path: '/' },
    { id: 'apps', label: 'Apps', icon: Grid3X3, path: '/apps' },
    { id: 'overview', label: 'Stats', icon: Home, path: '/dashboard' },
    { id: 'kv-store', label: 'KV Store', icon: Database, path: '/kv-store' },
    { id: 'artifacts', label: 'Artifacts & S3', icon: Archive, path: '/artifacts' },
    { id: 'events', label: 'Events', icon: Calendar, path: '/events' },
    { id: 'chat', label: 'AI Chat', icon: MessageCircle, path: '/chat' },
    { id: 'settings', label: 'Settings', icon: Settings, path: '/settings' }
  ];

  const getPageComponent = (itemId: string) => {
    switch (itemId) {
      case 'overview':
        return Dashboard;
      case 'apps':
        return AppsTab;
      case 'kv-store':
        return KVStore;
      case 'artifacts':
        return Artifacts;
      case 'events':
        return Events;
      case 'settings':
        return SettingsPage;
      default:
        return null;
    }
  };

  const getOverlaySize = (itemId: string) => {
    switch (itemId) {
      case 'overview':
        return 'large';
      case 'apps':
        return 'full';
      case 'settings':
        return 'medium';
      case 'kv-store':
      case 'artifacts':
      case 'events':
        return 'large';
      default:
        return 'medium';
    }
  };

  const handleNavigation = (item: NavItem) => {
    // Special case for workflows - use parent handler or fallback to browser
    if (item.id === 'workflows') {
      if (props.onNavigate) {
        props.onNavigate('workflows');
      } else {
        props.onOpenWorkflowBrowser?.();
      }
      return;
    }

    // Special case for chat - toggle chat panel
    if (item.id === 'chat') {
      props.onToggleChat?.();
      return;
    }

    // For other items, use parent navigation handler first
    if (props.onNavigate) {
      props.onNavigate(item.id);
      return;
    }

    // Fallback: Open other pages as overlays
    const component = getPageComponent(item.id);
    if (component) {
      openOverlay({
        id: item.id,
        component: () => {
          // Pass isOverlay prop to Settings component
          if (item.id === 'settings') {
            return <SettingsPage isOverlay={true} />;
          }
          return component();
        },
        title: item.label,
        size: getOverlaySize(item.id) as any
      });
    }
  };

  const isActive = (itemId: string) => {
    // Workflows is always active since it's the main page
    if (itemId === 'workflows') {
      return true;
    }
    return false; // Overlays don't have active states in navigation
  };

  const handlePin = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const willBePinned = !isPinned();
    setIsPinned(willBePinned);

    let newPosition;
    if (willBePinned) {
      // When pinning, move to left edge and make it icon-only
      newPosition = { x: 0, y: 0 };
      setPosition(newPosition);
      setIsCollapsed(true);
    } else {
      // When unpinning, move back to a floating position
      newPosition = { x: 20, y: 100 };
      setPosition(newPosition);
      setIsCollapsed(false);
    }

    // Notify parent component
    props.onPinnedChange?.(willBePinned);
    props.onPositionChange?.(newPosition.x, newPosition.y);
  };

  const handleOrganizationSwitch = (orgId: string) => {
    switchOrganization(orgId);
    setShowOrgDropdown(false);
  };

  const handleUserClick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowOrgDropdown(!showOrgDropdown());
  };

  // Close dropdown when clicking outside
  const handleClickOutside = (e: MouseEvent) => {
    if (showOrgDropdown() && !navRef?.contains(e.target as Node)) {
      setShowOrgDropdown(false);
    }
  };

  onMount(() => {
    document.addEventListener('click', handleClickOutside);
  });

  onCleanup(() => {
    document.removeEventListener('click', handleClickOutside);
  });

  return (
    <Show when={isVisible()}>
      <div
        ref={navRef}
        class={`fixed z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl transition-all duration-300 ${
          isDragging() ? 'shadow-2xl scale-105' : ''
        } ${
          isPinned()
            ? 'rounded-none border-l-0 border-t-0 border-b-0 h-screen'
            : 'rounded-lg'
        }`}
        style={{
          left: `${position().x}px`,
          top: `${position().y}px`,
          width: isPinned() ? '64px' : (isCollapsed() ? '60px' : '320px'),
          height: isPinned() ? '100vh' : 'auto',
          'min-height': isPinned() ? '100vh' : 'auto'
        }}
        onMouseDown={handleMouseDown}
      >
        {/* Navigation Header */}
        <Show when={!isPinned()}>
          <div class="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700" data-drag-handle>
            <Show when={!isCollapsed()}>
              <div class="flex items-center gap-2 cursor-move">
                <div class="w-6 h-6 bg-blue-500 rounded flex items-center justify-center">
                  <span class="text-white text-xs font-bold">AI</span>
                </div>
                <span class="font-medium text-gray-900 dark:text-white text-sm">Agent Bus</span>
              </div>
            </Show>

            <div class="flex items-center gap-1 flex-shrink-0">
              <Show when={!isDragging()}>
                <button
                  onClick={handlePin}
                  onMouseDown={(e) => e.stopPropagation()}
                  class="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors flex-shrink-0"
                  title="Pin to left edge"
                >
                  <Pin class="w-3.5 h-3.5 text-gray-500" />
                </button>
              </Show>
              <div class="cursor-move p-1">
                <GripVertical class="w-4 h-4 text-gray-400" />
              </div>
              <button
                onClick={() => setIsVisible(false)}
                onMouseDown={(e) => e.stopPropagation()}
                class="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md text-gray-500 transition-colors flex-shrink-0"
              >
                <X class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </Show>

        {/* Pinned Header */}
        <Show when={isPinned()}>
          <div class="flex flex-col items-center p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <div class="w-10 h-10 bg-blue-500 dark:bg-blue-600 rounded-lg flex items-center justify-center mb-4 shadow-sm">
              <span class="text-white text-sm font-bold">AI</span>
            </div>
            <button
              onClick={handlePin}
              onMouseDown={(e) => e.stopPropagation()}
              class="w-8 h-8 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex-shrink-0"
              title="Unpin from edge"
            >
              <PinOff class="w-4 h-4 text-gray-500 dark:text-gray-400" />
            </button>
          </div>
        </Show>

        {/* Navigation Items */}
        <div class={isPinned() ? "flex-1 flex flex-col justify-start px-2 py-4" : "p-2"}>
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavigation(item)}
              class={`w-full flex items-center transition-colors ${
                isPinned()
                  ? 'justify-center p-2 mb-2 rounded-lg mx-1'
                  : `gap-3 px-3 py-2 rounded-lg mb-1 ${!isCollapsed() ? '' : 'justify-center'}`
              } ${
                isActive(item.id)
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-700'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
              title={isCollapsed() || isPinned() ? item.label : undefined}
            >
              <item.icon class={`flex-shrink-0 ${isPinned() ? 'w-5 h-5' : 'w-4 h-4'}`} />
              <Show when={!isCollapsed() && !isPinned()}>
                <span class="text-sm font-medium">{item.label}</span>
                <Show when={item.badge}>
                  <span class="ml-auto bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                    {item.badge}
                  </span>
                </Show>
              </Show>
            </button>
          ))}
        </div>

        {/* User Section with Organization Switcher */}
        <Show when={!isCollapsed() && !isPinned()}>
          <div class="border-t border-gray-200 dark:border-gray-700 p-2 relative">
            <button
              onClick={handleUserClick}
              class="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
            >
              <div class="w-6 h-6 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center">
                <Show
                  when={currentOrganization()?.name === 'Personal Projects'}
                  fallback={<Building class="w-3 h-3" />}
                >
                  <User class="w-3 h-3" />
                </Show>
              </div>
              <div class="text-left flex-1">
                <div class="text-xs font-medium">{user()?.name || 'Demo User'}</div>
                <div class="text-xs text-gray-500">{currentOrganization()?.name || 'Loading...'}</div>
              </div>
              <ChevronDown class={`w-3 h-3 transition-transform ${showOrgDropdown() ? 'rotate-180' : ''}`} />
            </button>

            {/* Organization Dropdown */}
            <Show when={showOrgDropdown()}>
              <div class="absolute bottom-full left-2 right-2 mb-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
                <div class="p-2">
                  <div class="text-xs font-medium text-gray-500 dark:text-gray-400 px-2 py-1">Switch Context</div>
                  <For each={organizations()}>
                    {(org) => (
                      <button
                        onClick={() => handleOrganizationSwitch(org.id)}
                        class={`w-full flex items-center gap-2 px-2 py-2 rounded text-xs hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                          currentOrganization()?.id === org.id
                            ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                            : 'text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        <Show
                          when={org.name === 'Personal Projects'}
                          fallback={<Building class="w-4 h-4" />}
                        >
                          <User class="w-4 h-4" />
                        </Show>
                        <div class="text-left">
                          <div class="font-medium">{org.name}</div>
                          <div class="text-gray-500 dark:text-gray-400">{org.description}</div>
                        </div>
                      </button>
                    )}
                  </For>
                </div>
              </div>
            </Show>
          </div>
        </Show>

        {/* Connection Status */}
        <div class={`border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 ${
          isPinned()
            ? 'mt-auto p-4 flex flex-col items-center space-y-3'
            : `p-2 ${isCollapsed() ? 'text-center' : ''}`
        }`}>
          <Show when={isPinned()}>
            <button
              onClick={handleUserClick}
              class="w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded-lg flex items-center justify-center hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors relative"
              title={`${user()?.name || 'Demo User'} - ${currentOrganization()?.name || 'Loading...'}`}
            >
              <Show
                when={currentOrganization()?.name === 'Personal Projects'}
                fallback={<Building class="w-4 h-4 text-gray-600 dark:text-gray-300" />}
              >
                <User class="w-4 h-4 text-gray-600 dark:text-gray-300" />
              </Show>

              {/* Pinned Organization Dropdown */}
              <Show when={showOrgDropdown()}>
                <div class="absolute left-full ml-2 top-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 w-48">
                  <div class="p-2">
                    <div class="text-xs font-medium text-gray-500 dark:text-gray-400 px-2 py-1">Switch Context</div>
                    <For each={organizations()}>
                      {(org) => (
                        <button
                          onClick={() => handleOrganizationSwitch(org.id)}
                          class={`w-full flex items-center gap-2 px-2 py-2 rounded text-xs hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                            currentOrganization()?.id === org.id
                              ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                              : 'text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          <Show
                            when={org.name === 'Personal Projects'}
                            fallback={<Building class="w-4 h-4" />}
                          >
                            <User class="w-4 h-4" />
                          </Show>
                          <div class="text-left">
                            <div class="font-medium">{org.name}</div>
                            <div class="text-gray-500 dark:text-gray-400">{org.description}</div>
                          </div>
                        </button>
                      )}
                    </For>
                  </div>
                </div>
              </Show>
            </button>
          </Show>
          <ConnectionStatus
            showLabel={!isPinned()}
            compact={isPinned()}
          />
        </div>
      </div>

      {/* Toggle button when navigation is hidden */}
      <Show when={!isVisible()}>
        <button
          onClick={() => setIsVisible(true)}
          class="fixed top-1/2 left-4 z-50 w-12 h-12 bg-blue-500 hover:bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center transition-all transform -translate-y-1/2"
        >
          <Menu class="w-5 h-5" />
        </button>
      </Show>
    </Show>
  );
}