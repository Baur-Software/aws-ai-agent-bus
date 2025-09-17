import { createContext, useContext, createSignal, For, JSX } from 'solid-js';
import { Portal } from 'solid-js/web';
import { useMCP } from './MCPContext';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';
export type NotificationPosition = 'top' | 'bottom' | 'left' | 'right' | 'center' | 'attached';

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  title?: string;
  duration: number;
  position: NotificationPosition;
  timestamp: Date;
  attachTo?: HTMLElement;
}

export interface NotificationOptions {
  title?: string;
  duration?: number;
  position?: NotificationPosition;
  attachTo?: HTMLElement;
}

export interface NotificationContextValue {
  notifications: () => Notification[];
  addNotification: (notification: Partial<Notification>) => string;
  removeNotification: (id: string) => void;
  clearAll: () => void;
  success: (message: string, options?: NotificationOptions) => string;
  error: (message: string, options?: NotificationOptions) => string;
  warning: (message: string, options?: NotificationOptions) => string;
  info: (message: string, options?: NotificationOptions) => string;
  showAt: (position: NotificationPosition, type: NotificationType, message: string, options?: NotificationOptions) => string;
  attachedTo: (element: HTMLElement, type: NotificationType, message: string, options?: NotificationOptions) => string;
  // SNS-backed persistent notifications
  sendPersistentNotification: (notification: Partial<Notification>) => Promise<string>;
  publishIntegrationEvent: (integration: string, action: string, details?: Record<string, any>) => Promise<string>;
}

const NotificationContext = createContext<NotificationContextValue>();

interface NotificationProviderProps {
  children: JSX.Element;
  notificationProps?: any;
}

export function NotificationProvider(props: NotificationProviderProps) {
  const [notifications, setNotifications] = createSignal<Notification[]>([]);
  const { executeTool } = useMCP();

  const addNotification = (notification: Partial<Notification>): string => {
    const id = Date.now().toString();
    const newNotification: Notification = {
      id,
      type: 'info',
      duration: 5000,
      position: 'right',
      message: '',
      timestamp: new Date(),
      ...notification,
    };

    setNotifications(prev => [...prev, newNotification]);

    // Auto-remove after duration
    if (newNotification.duration > 0) {
      setTimeout(() => {
        removeNotification(id);
      }, newNotification.duration);
    }

    return id;
  };

  const removeNotification = (id: string): void => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const clearAll = (): void => {
    setNotifications([]);
  };

  // Enhanced convenience methods with positioning support
  const success = (message: string, options: NotificationOptions = {}): string => 
    addNotification({ type: 'success', message, ...options });
  
  const error = (message: string, options: NotificationOptions = {}): string => 
    addNotification({ type: 'error', message, duration: 8000, ...options });
  
  const warning = (message: string, options: NotificationOptions = {}): string => 
    addNotification({ type: 'warning', message, ...options });
  
  const info = (message: string, options: NotificationOptions = {}): string => 
    addNotification({ type: 'info', message, ...options });

  // New methods for positional notifications
  const showAt = (position: NotificationPosition, type: NotificationType, message: string, options: NotificationOptions = {}): string => 
    addNotification({ type, message, position, ...options });

  const attachedTo = (element: HTMLElement, type: NotificationType, message: string, options: NotificationOptions = {}): string => 
    addNotification({ type, message, position: 'attached', attachTo: element, ...options });

  // SNS-backed persistent notifications
  const sendPersistentNotification = async (notification: Partial<Notification>): Promise<string> => {
    try {
      // Send to SNS for persistence across sessions
      const result = await executeTool('notifications.send', {
        type: notification.type || 'info',
        message: notification.message || '',
        title: notification.title,
        userId: 'demo-user-123', // TODO: Get from actual user context
        metadata: {
          position: notification.position,
          duration: notification.duration,
          source: 'dashboard-ui'
        }
      });

      // Also show locally
      const localId = addNotification(notification);
      
      console.log('📨 Notification sent to SNS:', result.messageId);
      return result.messageId || localId;
    } catch (error) {
      console.error('❌ Failed to send persistent notification:', error);
      // Fallback to local notification
      return addNotification(notification);
    }
  };

  const publishIntegrationEvent = async (integration: string, action: string, details: Record<string, any> = {}): Promise<string> => {
    try {
      const result = await executeTool('notifications.integration-event', {
        integration,
        action,
        userId: 'demo-user-123', // TODO: Get from actual user context
        details
      });

      // Show local notification for immediate feedback
      const typeMap: Record<string, NotificationType> = {
        'connected': 'success',
        'disconnected': 'warning', 
        'error': 'error'
      };

      addNotification({
        type: typeMap[action] || 'info',
        title: `${integration} ${action}`,
        message: `Integration ${integration} has been ${action}`,
        duration: action === 'error' ? 8000 : 5000
      });

      console.log('📨 Integration event published to SNS:', result.messageId);
      return result.messageId;
    } catch (error) {
      console.error('❌ Failed to publish integration event:', error);
      throw error;
    }
  };

  const contextValue: NotificationContextValue = {
    notifications,
    addNotification,
    removeNotification,
    clearAll,
    success,
    error,
    warning,
    info,
    showAt,
    attachedTo,
    sendPersistentNotification,
    publishIntegrationEvent
  };

  return (
    <NotificationContext.Provider value={contextValue}>
      {props.children}
      <NotificationContainer {...(props.notificationProps || {})} />
    </NotificationContext.Provider>
  );
}

interface NotificationContainerProps {
  [key: string]: any;
}

function NotificationContainer(props: NotificationContainerProps) {
  const context = useNotifications();
  if (!context) return null;
  
  const { notifications, removeNotification } = context;
  
  // Group notifications by position
  const notificationsByPosition = (): Record<string, Notification[]> => {
    const groups: Record<string, Notification[]> = {};
    notifications().forEach(notification => {
      const position = notification.position || 'right';
      if (!groups[position]) {
        groups[position] = [];
      }
      groups[position].push(notification);
    });
    return groups;
  };

  const getContainerClass = (position: string): string => {
    return `notification-container notification-container-${position}`;
  };

  const getAttachedStyles = (notification: Notification): JSX.CSSProperties => {
    if (notification.position === 'attached' && notification.attachTo) {
      // Calculate position relative to attached element
      const rect = notification.attachTo.getBoundingClientRect();
      return {
        top: `${rect.bottom + 8}px`,
        left: `${rect.left}px`,
      };
    }
    return {};
  };

  return (
    <For each={Object.entries(notificationsByPosition())}>
      {([position, positionNotifications]) => (
        <Portal mount={document.body}>
          <div 
            class={getContainerClass(position)}
            style={position === 'attached' ? getAttachedStyles(positionNotifications[0]) : {}}
          >
            <For each={positionNotifications}>
              {(notification) => (
                <div
                  class={`notification notification-${notification.type}`}
                  onClick={() => removeNotification(notification.id)}
                >
                  <div class="notification-content">
                    <div class="notification-icon">
                      {notification.type === 'success' && <i class="fas fa-check-circle" />}
                      {notification.type === 'error' && <i class="fas fa-exclamation-circle" />}
                      {notification.type === 'warning' && <i class="fas fa-exclamation-triangle" />}
                      {notification.type === 'info' && <i class="fas fa-info-circle" />}
                    </div>
                    <div class="notification-message">
                      {notification.title && <div class="notification-title">{notification.title}</div>}
                      <div class="notification-text">{notification.message}</div>
                    </div>
                  </div>
                  <button
                    class="notification-close"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      removeNotification(notification.id);
                    }}
                  >
                    <i class="fas fa-times" />
                  </button>
                </div>
              )}
            </For>
          </div>
        </Portal>
      )}
    </For>
  );
}

export function useNotifications(): NotificationContextValue {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}