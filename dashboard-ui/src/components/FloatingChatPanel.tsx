import { createSignal, createEffect, For, Show, onMount } from 'solid-js';
import { X, GripVertical, Pin, PinOff, Trash2, Send, Bot } from 'lucide-solid';
import { useLocation, useNavigate } from '@solidjs/router';
import { useDashboardServer } from '../contexts/DashboardServerContext';
import { useNotifications } from '../contexts/NotificationContext';
import { useFloatingPanelResize } from '../hooks/useFloatingPanelResize';

interface FloatingChatPanelProps {
  onPositionChange?: (x: number, y: number) => void;
  onPinnedChange?: (isPinned: boolean) => void;
  initialPosition?: { x: number; y: number };
  initialPinned?: boolean;
}

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
}

export default function FloatingChatPanel(props: FloatingChatPanelProps) {
  // Calculate initial position (bottom-right corner, above node panel if present)
  const getSafeInitialPosition = () => {
    if (props.initialPosition) return props.initialPosition;
    return {
      x: window.innerWidth - 400,
      y: window.innerHeight - 500
    };
  };

  const [position, setPosition] = createSignal(getSafeInitialPosition());
  const [isDragging, setIsDragging] = createSignal(false);
  const [isResizing, setIsResizing] = createSignal(false);
  const [isPinned, setIsPinned] = createSignal(props.initialPinned ?? false);
  const [panelWidth, setPanelWidth] = createSignal(400);
  const [panelHeight, setPanelHeight] = createSignal(500);
  const [messages, setMessages] = createSignal<Message[]>([]);
  const [inputText, setInputText] = createSignal('');
  const [isProcessing, setIsProcessing] = createSignal(false);

  const location = useLocation();
  const navigate = useNavigate();
  const { executeTool } = useDashboardServer();
  const { success, error } = useNotifications();

  // Control visibility based on route
  const isVisible = () => location.pathname === '/chat';

  let messagesRef: HTMLDivElement | undefined;
  let panelRef: HTMLDivElement | undefined;
  let dragStart = { x: 0, y: 0, panelX: 0, panelY: 0 };

  // Use floating panel resize hook
  useFloatingPanelResize({
    isPinned,
    panelWidth,
    onPositionChange: (x, y) => {
      setPosition({ x, y });
      props.onPositionChange?.(x, y);
    },
    pinSide: 'right'
  });

  // Get contextual welcome message
  const getContextualWelcome = () => {
    const path = location.pathname;
    const pathMessages = {
      '/workflows': 'Hi! I can help you build workflows, explain node types, connect integrations, or run existing workflows.',
      '/kv-store': 'Hi! I can help you manage your KV store - get/set values, explain data formats, or find specific keys.',
      '/artifacts': 'Hi! I can help you manage artifacts, upload files, or retrieve stored content.',
      '/events': 'Hi! I can help you monitor events, send notifications, or explain event patterns.',
      '/settings': 'Hi! I can help you configure integrations, manage settings, or test connections.',
    };
    return pathMessages[path] || 'Hi! I\'m your MCP Assistant. How can I help you today?';
  };

  // Initialize with contextual message
  createEffect(() => {
    if (messages().length === 0) {
      setMessages([{
        id: '1',
        content: getContextualWelcome(),
        sender: 'assistant',
        timestamp: new Date()
      }]);
    }
  });

  // Auto-scroll to bottom
  createEffect(() => {
    if (messagesRef) {
      messagesRef.scrollTop = messagesRef.scrollHeight;
    }
  });

  // Panel drag handling
  const handleMouseDown = (e: MouseEvent) => {
    if (!(e.target as Element).closest('[data-drag-handle]') ||
        (e.target as Element).closest('button') ||
        isPinned()) {
      return;
    }

    e.preventDefault();
    setIsDragging(true);
    const pos = position();
    dragStart = {
      x: e.clientX,
      y: e.clientY,
      panelX: pos.x,
      panelY: pos.y
    };

    let rafId: number | null = null;
    let lastMouseEvent: MouseEvent | null = null;

    const updatePosition = () => {
      if (!lastMouseEvent) return;

      const newX = dragStart.panelX + (lastMouseEvent.clientX - dragStart.x);
      const newY = dragStart.panelY + (lastMouseEvent.clientY - dragStart.y);

      const maxX = window.innerWidth - 400;
      const maxY = window.innerHeight - 500;

      const clampedPos = {
        x: Math.max(20, Math.min(maxX, newX)),
        y: Math.max(20, Math.min(maxY, newY))
      };

      setPosition(clampedPos);
      props.onPositionChange?.(clampedPos.x, clampedPos.y);

      rafId = null;
      lastMouseEvent = null;
    };

    const handleMouseMove = (e: MouseEvent) => {
      lastMouseEvent = e;
      if (!rafId) {
        rafId = requestAnimationFrame(updatePosition);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Panel resize handling
  const handleResizeMouseDown = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);

    const startWidth = panelWidth();
    const startHeight = panelHeight();
    const startX = e.clientX;
    const startY = e.clientY;

    let rafId: number | null = null;
    let lastMouseEvent: MouseEvent | null = null;

    const updateSize = () => {
      if (!lastMouseEvent) return;

      const deltaX = lastMouseEvent.clientX - startX;
      const deltaY = lastMouseEvent.clientY - startY;

      const newWidth = Math.max(300, Math.min(800, startWidth + deltaX));
      const newHeight = Math.max(400, Math.min(900, startHeight + deltaY));

      setPanelWidth(newWidth);
      setPanelHeight(newHeight);

      rafId = null;
      lastMouseEvent = null;
    };

    const handleResizeMove = (e: MouseEvent) => {
      lastMouseEvent = e;
      if (!rafId) {
        rafId = requestAnimationFrame(updateSize);
      }
    };

    const handleResizeUp = () => {
      setIsResizing(false);
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeUp);
    };

    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeUp);
  };

  const handlePin = () => {
    const willBePinned = !isPinned();
    setIsPinned(willBePinned);

    let newPosition;
    if (willBePinned) {
      newPosition = { x: window.innerWidth - panelWidth(), y: 0 };
      setPosition(newPosition);
    } else {
      newPosition = { x: window.innerWidth - 420, y: 100 };
      setPosition(newPosition);
    }

    props.onPinnedChange?.(willBePinned);
    props.onPositionChange?.(newPosition.x, newPosition.y);
  };

  const addMessage = (content: string, sender: 'user' | 'assistant') => {
    const newMessage: Message = {
      id: Date.now().toString(),
      content,
      sender,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, newMessage]);
  };

  const sendMessage = async () => {
    const text = inputText().trim();
    if (!text || isProcessing()) return;

    addMessage(text, 'user');
    setInputText('');
    setIsProcessing(true);

    try {
      const result = await executeTool('agent_chat', {
        message: text,
        context: {
          currentPage: location.pathname,
          conversationHistory: messages().slice(-5).map(m => ({
            role: m.sender === 'user' ? 'user' : 'assistant',
            content: m.content
          }))
        }
      });

      const response = result?.response || result?.message || JSON.stringify(result) || 'No response received';
      addMessage(response, 'assistant');
    } catch (err: any) {
      addMessage(`Error: ${err.message || 'Failed to process message'}`, 'assistant');
      error('Chat error: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const clearChat = () => {
    setMessages([{
      id: Date.now().toString(),
      content: getContextualWelcome(),
      sender: 'assistant',
      timestamp: new Date()
    }]);
  };

  const handleKeyPress = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <Show when={isVisible()}>
      <div
        ref={panelRef}
        class={`fixed z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl transition-all duration-200 flex flex-col ${
          isDragging() ? 'shadow-2xl scale-105 select-none' : ''
        } ${
          isPinned()
            ? 'rounded-none border-r-0 border-t-0 border-b-0 h-screen'
            : 'rounded-lg'
        }`}
        style={{
          left: `${position().x}px`,
          top: `${position().y}px`,
          width: `${panelWidth()}px`,
          height: isPinned() ? '100vh' : `${panelHeight()}px`,
          'will-change': isDragging() || isResizing() ? 'transform' : 'auto',
          transform: 'translate3d(0, 0, 0)'
        }}
        onMouseDown={handleMouseDown}
      >
        {/* Header */}
        <div
          class={`flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-500 to-purple-600 ${!isPinned() ? 'cursor-move' : ''}`}
          data-drag-handle={!isPinned() ? '' : undefined}
        >
          <div class="flex items-center gap-2 text-white">
            <Show when={!isPinned()}>
              <GripVertical class="w-4 h-4 opacity-50" />
            </Show>
            <Bot class="w-5 h-5" />
            <span class="font-semibold">AI Assistant</span>
          </div>
          <div class="flex items-center gap-1">
            <button
              onClick={handlePin}
              class="p-1.5 hover:bg-white/20 rounded-md transition-colors text-white"
              title={isPinned() ? 'Unpin from right edge' : 'Pin to right edge'}
            >
              {isPinned() ? <PinOff class="w-4 h-4" /> : <Pin class="w-4 h-4" />}
            </button>
            <button
              onClick={clearChat}
              class="p-1.5 hover:bg-white/20 rounded-md transition-colors text-white"
              title="Clear chat"
            >
              <Trash2 class="w-4 h-4" />
            </button>
            <button
              onClick={() => navigate('/')}
              class="p-1.5 hover:bg-white/20 rounded-md transition-colors text-white"
            >
              <X class="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div
          ref={messagesRef}
          class="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-gray-900"
        >
          <For each={messages()}>
            {(message) => (
              <div class={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  class={`max-w-[80%] rounded-lg p-3 ${
                    message.sender === 'user'
                      ? 'bg-blue-500 text-white'
                      : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700'
                  }`}
                >
                  <div class="text-sm whitespace-pre-wrap">{message.content}</div>
                  <div class={`text-xs mt-1 opacity-60`}>
                    {message.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              </div>
            )}
          </For>
          <Show when={isProcessing()}>
            <div class="flex justify-start">
              <div class="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                <div class="flex gap-1">
                  <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ 'animation-delay': '0ms' }} />
                  <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ 'animation-delay': '150ms' }} />
                  <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ 'animation-delay': '300ms' }} />
                </div>
              </div>
            </div>
          </Show>
        </div>

        {/* Input */}
        <div class="p-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <div class="flex gap-2">
            <input
              type="text"
              value={inputText()}
              onInput={(e) => setInputText(e.currentTarget.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask me anything..."
              disabled={isProcessing()}
              class="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:opacity-50"
            />
            <button
              onClick={sendMessage}
              disabled={!inputText().trim() || isProcessing()}
              class="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white rounded-lg transition-colors disabled:cursor-not-allowed"
            >
              <Send class="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Resize handle (bottom-right corner) - only when not pinned */}
        <Show when={!isPinned()}>
          <div
            class="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500"
            style={{
              'clip-path': 'polygon(100% 0, 100% 100%, 0 100%)'
            }}
            onMouseDown={handleResizeMouseDown}
          />
        </Show>
      </div>

    </Show>
  );
}
