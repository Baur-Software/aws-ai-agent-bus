import { createSignal, createEffect, For, Show } from 'solid-js';
import { useLocation } from '@solidjs/router';
import { useDashboardServer } from '../contexts/DashboardServerContext';
import { useNotifications } from '../contexts/NotificationContext';

interface ChatPanelProps {
  onClose?: () => void;
}

function ChatPanel(props: ChatPanelProps) {
  const location = useLocation();
  const [messages, setMessages] = createSignal([]);
  const [inputText, setInputText] = createSignal('');
  const [isProcessing, setIsProcessing] = createSignal(false);

  const { executeTool } = useDashboardServer();
  const { success, error } = useNotifications();

  // Get context-aware initial message
  const getContextualWelcome = () => {
    const path = location.pathname;
    const pathMessages = {
      '/dashboard': 'Hi! I can help you understand your dashboard metrics, get analytics insights, or navigate to other tools. What would you like to explore?',
      '/analytics': 'Hi! I\'m here to help with analytics. I can fetch Google Analytics data, analyze performance, or explain the charts you\'re seeing. What analytics do you need?',
      '/kv-store': 'Hi! I can help you manage your KV store. I can get/set values, explain data formats, or help you find specific keys. What do you need help with?',
      '/workflows': 'Hi! I can help you build workflows, explain node types, connect integrations, or run existing workflows. What workflow task can I assist with?',
      '/artifacts': 'Hi! I can help you manage artifacts, upload files, or retrieve stored content. What artifact operation do you need help with?',
      '/events': 'Hi! I can help you monitor events, send notifications, or explain event patterns. What event-related task can I help with?',
      '/settings': 'Hi! I can help you configure integrations, manage settings, or explain configuration options. What settings do you need help with?',
    };

    return pathMessages[path] || 'Hi! I\'m your MCP Assistant. I can help you with the current page or any other tools. What would you like to do?';
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

  let messagesRef;
  let inputRef;

  // Auto-scroll to bottom when new messages arrive
  createEffect(() => {
    if (messagesRef) {
      messagesRef.scrollTop = messagesRef.scrollHeight;
    }
  });

  const addMessage = (content, sender = 'user') => {
    const newMessage = {
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

    // Add user message
    addMessage(text, 'user');
    setInputText('');
    setIsProcessing(true);

    try {
      // Process the message and get response
      const response = await processMessage(text);
      addMessage(response, 'assistant');
    } catch (err) {
      addMessage('Sorry, I encountered an error processing your request. Please try again.', 'assistant');
      error('Chat error: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const processMessage = async (message) => {
    const lower = message.toLowerCase();

    try {
      // Use the agent_chat MCP tool to process the message with AI
      const result = await executeTool('agent_chat', {
        message: message,
        context: {
          currentPage: location.pathname,
          conversationHistory: messages().slice(-5).map(m => ({
            role: m.sender === 'user' ? 'user' : 'assistant',
            content: m.content
          }))
        }
      });

      // Extract the response from the MCP result
      if (result && typeof result === 'object') {
        return result.response || result.message || JSON.stringify(result);
      }

      return result || 'I processed your request but got an empty response. Please try rephrasing.';

    } catch (toolError) {
      console.error('Chat tool execution error:', toolError);

      // Fallback to basic help message when MCP server is unavailable
      return `I'm having trouble connecting to the AI backend right now.

The MCP server may not be responding. Please check:
• Dashboard server is running
• MCP server is connected
• Try refreshing the page

Error details: ${toolError.message}`;
    }
  };

  const extractDays = (message) => {
    const match = message.match(/(\d+)\s*days?/i);
    return match ? parseInt(match[1]) : null;
  };

  const formatAnalyticsResult = (result) => {
    if (!result || !result.content || !result.content[0]) {
      return 'No data available';
    }
    
    try {
      const data = JSON.parse(result.content[0].text);
      if (data.data && Array.isArray(data.data)) {
        return data.data.slice(0, 5).map((item, index) => 
          `${index + 1}. ${item.country || item.page || 'Item'}: ${item.totalUsers || item.pageviews || 'N/A'}`
        ).join('\n');
      }
    } catch (e) {
      return 'Data received but could not format it properly';
    }
    
    return 'Analytics data retrieved successfully - check the Analytics page for detailed view';
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([
      {
        id: Date.now().toString(),
        content: getContextualWelcome(),
        sender: 'assistant',
        timestamp: new Date()
      }
    ]);
    success('Chat cleared');
  };

  return (
    <aside class="fixed right-0 top-0 h-full w-80 max-w-[90vw] bg-white dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col z-50">
      {/* Header */}
      <div class="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
            <i class="fas fa-robot text-white text-sm" />
          </div>
          <span class="font-semibold text-slate-900 dark:text-white">MCP Assistant</span>
        </div>
        <div class="flex items-center gap-1">
          <button
            class="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition-colors"
            onClick={clearChat}
            title="Clear chat"
          >
            <i class="fas fa-trash text-sm" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div class="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-900" ref={messagesRef}>
        <For each={messages()}>
          {(message) => (
            <div class={`flex gap-3 ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              {message.sender === 'assistant' && (
                <div class="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <i class="fas fa-robot text-white text-sm" />
                </div>
              )}
              <div class={`max-w-[75%] ${message.sender === 'user' ? 'order-first' : ''}`}>
                <div class={`px-4 py-2 rounded-2xl ${
                  message.sender === 'user' 
                    ? 'bg-blue-500 text-white ml-auto' 
                    : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm border border-slate-200 dark:border-slate-700'
                }`}>
                  <div class="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</div>
                </div>
                <div class={`text-xs text-slate-500 dark:text-slate-400 mt-1 ${
                  message.sender === 'user' ? 'text-right' : 'text-left'
                }`}>
                  {message.timestamp.toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </div>
              </div>
              {message.sender === 'user' && (
                <div class="w-8 h-8 bg-slate-600 dark:bg-slate-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <i class="fas fa-user text-white text-sm" />
                </div>
              )}
            </div>
          )}
        </For>

        <Show when={isProcessing()}>
          <div class="flex gap-3 justify-start">
            <div class="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
              <i class="fas fa-robot text-white text-sm" />
            </div>
            <div class="max-w-[75%]">
              <div class="px-4 py-2 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700">
                <div class="flex items-center gap-1">
                  <div class="w-2 h-2 bg-slate-400 rounded-full animate-bounce" />
                  <div class="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{"animation-delay":"0.1s"}} />
                  <div class="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{"animation-delay":"0.2s"}} />
                </div>
              </div>
            </div>
          </div>
        </Show>
      </div>

      {/* Input */}
      <div class="p-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <div class="flex gap-3 items-end">
          <div class="flex-1 relative">
            <textarea
              ref={inputRef}
              class="w-full min-h-[44px] max-h-32 px-4 py-3 pr-12 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-2xl resize-none text-sm text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              placeholder="Ask me about analytics, workflows, or anything else..."
              value={inputText()}
              onInput={(e) => setInputText(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isProcessing()}
              rows={1}
              style={{resize: "none"}}
            />
            <button 
              class="absolute right-2 bottom-2 w-8 h-8 bg-blue-500 hover:bg-blue-600 disabled:bg-slate-400 disabled:cursor-not-allowed rounded-full flex items-center justify-center text-white transition-colors"
              onClick={sendMessage}
              disabled={!inputText().trim() || isProcessing()}
            >
              {isProcessing() ? (
                <i class="fas fa-spinner fa-spin text-sm" />
              ) : (
                <i class="fas fa-paper-plane text-sm" />
              )}
            </button>
          </div>
        </div>
        <div class="text-xs text-slate-500 dark:text-slate-400 mt-2 text-center">
          Press Enter to send, Shift+Enter for new line
        </div>
      </div>
    </aside>
  );
}

export default ChatPanel;