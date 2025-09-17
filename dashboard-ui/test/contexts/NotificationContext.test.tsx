import { render, screen, fireEvent } from '@solidjs/testing-library';
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { NotificationProvider, useNotifications } from '../../src/contexts/NotificationContext';

// Test component that uses the notification context
function TestComponent() {
  const { success, error, warning, info, showAt, notifications } = useNotifications();
  
  return (
    <div>
      <button data-testid="success-btn" onClick={() => success('Success message')}>
        Success
      </button>
      <button data-testid="error-btn" onClick={() => error('Error message')}>
        Error
      </button>
      <button data-testid="warning-btn" onClick={() => warning('Warning message')}>
        Warning
      </button>
      <button data-testid="info-btn" onClick={() => info('Info message')}>
        Info
      </button>
      <button data-testid="top-btn" onClick={() => showAt('top', 'info', 'Top message')}>
        Top Position
      </button>
      <button data-testid="center-btn" onClick={() => showAt('center', 'success', 'Center message')}>
        Center Position
      </button>
      <div data-testid="notification-count">{notifications().length}</div>
    </div>
  );
}

describe('NotificationContext', () => {
  beforeEach(() => {
    // Mock timers for auto-removal testing
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('renders notification provider without errors', () => {
    render(() => (
      <NotificationProvider>
        <TestComponent />
      </NotificationProvider>
    ));
    
    expect(screen.getByTestId('success-btn')).toBeTruthy();
  });

  test('creates notifications with correct default properties', () => {
    render(() => (
      <NotificationProvider>
        <TestComponent />
      </NotificationProvider>
    ));

    fireEvent.click(screen.getByTestId('success-btn'));
    
    expect(screen.getByTestId('notification-count')).toHaveTextContent('1');
    
    // Check notification appears in DOM
    expect(screen.getByText('Success message')).toBeTruthy();
    expect(document.querySelector('.notification-success')).toBeTruthy();
  });

  test('creates notifications with different types', () => {
    render(() => (
      <NotificationProvider>
        <TestComponent />
      </NotificationProvider>
    ));

    fireEvent.click(screen.getByTestId('error-btn'));
    fireEvent.click(screen.getByTestId('warning-btn'));
    fireEvent.click(screen.getByTestId('info-btn'));
    
    expect(screen.getByTestId('notification-count')).toHaveTextContent('3');
    expect(document.querySelector('.notification-error')).toBeTruthy();
    expect(document.querySelector('.notification-warning')).toBeTruthy();
    expect(document.querySelector('.notification-info')).toBeTruthy();
  });

  test('creates notifications with correct positioning classes', () => {
    render(() => (
      <NotificationProvider>
        <TestComponent />
      </NotificationProvider>
    ));

    fireEvent.click(screen.getByTestId('top-btn'));
    fireEvent.click(screen.getByTestId('center-btn'));
    
    // Check positioning containers are created
    expect(document.querySelector('.notification-container-top')).toBeTruthy();
    expect(document.querySelector('.notification-container-center')).toBeTruthy();
  });

  test('removes notifications when clicked', () => {
    render(() => (
      <NotificationProvider>
        <TestComponent />
      </NotificationProvider>
    ));

    fireEvent.click(screen.getByTestId('success-btn'));
    expect(screen.getByTestId('notification-count')).toHaveTextContent('1');
    
    // Click the notification to dismiss
    const notification = document.querySelector('.notification');
    fireEvent.click(notification);
    
    expect(screen.getByTestId('notification-count')).toHaveTextContent('0');
  });

  test('auto-removes notifications after duration', () => {
    render(() => (
      <NotificationProvider>
        <TestComponent />
      </NotificationProvider>
    ));

    fireEvent.click(screen.getByTestId('success-btn'));
    expect(screen.getByTestId('notification-count')).toHaveTextContent('1');
    
    // Fast-forward time by 5 seconds (default duration)
    vi.advanceTimersByTime(5000);
    
    expect(screen.getByTestId('notification-count')).toHaveTextContent('0');
  });

  test('groups notifications by position', () => {
    render(() => (
      <NotificationProvider>
        <TestComponent />
      </NotificationProvider>
    ));

    // Create notifications in different positions
    fireEvent.click(screen.getByTestId('success-btn')); // default 'right'
    fireEvent.click(screen.getByTestId('top-btn')); // 'top'
    fireEvent.click(screen.getByTestId('center-btn')); // 'center'
    
    // Should have 3 different position containers
    expect(document.querySelector('.notification-container-right')).toBeTruthy();
    expect(document.querySelector('.notification-container-top')).toBeTruthy();
    expect(document.querySelector('.notification-container-center')).toBeTruthy();
    
    expect(screen.getByTestId('notification-count')).toHaveTextContent('3');
  });

  test('notification containers have correct CSS positioning', () => {
    render(() => (
      <NotificationProvider>
        <TestComponent />
      </NotificationProvider>
    ));

    fireEvent.click(screen.getByTestId('top-btn'));
    
    const topContainer = document.querySelector('.notification-container-top');
    
    // Check CSS classes are applied correctly
    expect(topContainer).toBeTruthy();
    expect(topContainer.classList.contains('notification-container')).toBe(true);
    expect(topContainer.classList.contains('notification-container-top')).toBe(true);
  });

  test('notification portal renders outside component tree', () => {
    const { container } = render(() => (
      <NotificationProvider>
        <TestComponent />
      </NotificationProvider>
    ));

    fireEvent.click(screen.getByTestId('success-btn'));
    
    // Notification should not be inside the component container
    const notificationInContainer = container.querySelector('.notification');
    const notificationInBody = document.body.querySelector('.notification');
    
    expect(notificationInContainer).toBeFalsy();
    expect(notificationInBody).toBeTruthy();
  });
});