import { createSignal, createEffect, For, Show } from 'solid-js';
import { useDashboardServer } from '../contexts/DashboardServerContext';
import { useNotifications } from '../contexts/NotificationContext';
import { Send, Bot, User, Loader2, AlertCircle, CheckCircle } from 'lucide-solid';

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  requestId?: string;
  executionId?: string;
  agentType?: string;
}

export default function AgentChat() {
  const { sendMessageWithResponse, isConnected } = useDashboardServer();
  const { success, error: notifyError } = useNotifications();

  const [messages, setMessages] = createSignal<ChatMessage[]>([]);
  const [input, setInput] = createSignal('');
  const [currentSessionId, setCurrentSessionId] = createSignal<string | null>(null);
  const [loading, setLoading] = createSignal(false);

  let chatContainerRef: HTMLDivElement;

  // Auto-scroll to bottom when new messages arrive
  createEffect(() => {
    messages(); // Subscribe to messages
    setTimeout(() => {
      if (chatContainerRef) {
        chatContainerRef.scrollTop = chatContainerRef.scrollHeight;
      }
    }, 100);
  });

  const addMessage = (message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      timestamp: new Date(),
      ...message
    };
    setMessages(prev => [...prev, newMessage]);
  };

  const handleSend = async () => {
    const userInput = input().trim();
    if (!userInput) return;

    // Add user message
    addMessage({
      type: 'user',
      content: userInput
    });

    setInput('');
    setLoading(true);

    try {
      // Send message via WebSocket
      const response = await sendMessageWithResponse({
        type: 'chat.send_message',
        data: {
          sessionId: currentSessionId(),
          message: userInput
        }
      });

      if (response && response.data) {
        // Update session ID if this was the first message
        setCurrentSessionId(response.data.sessionId);

        // Add assistant response
        addMessage({
          type: 'assistant',
          content: response.data.message.content
        });
      }
    } catch (err) {
      console.error('Chat error:', err);
      addMessage({
        type: 'assistant',
        content: `❌ Error: ${err instanceof Error ? err.message : 'Unknown error occurred'}`
      });
      notifyError('Failed to send message');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    setMessages([]);
    success('Chat cleared');
  };

  return (
    <div class="flex flex-col h-full bg-white dark:bg-gray-900 rounded-lg shadow-lg">
      {/* Header */}
      <div class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div class="flex items-center space-x-3">
          <Bot class="w-6 h-6 text-blue-500" />
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
            AI Workflow Assistant
          </h2>
        </div>

        <div class="flex items-center space-x-3">
          <button
            onClick={clearChat}
            class="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Chat Messages */}
      <div
        ref={chatContainerRef!}
        class="flex-1 overflow-y-auto p-4 space-y-4"
      >
        <Show when={messages().length === 0}>
          <div class="text-center text-gray-500 dark:text-gray-400 py-8">
            <Bot class="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p class="text-lg font-medium mb-2">AI Workflow Assistant</p>
            <p class="text-sm">
              Ask me to create workflows, automate tasks, or help with your integrations.
              I can access your connected apps and generate workflows tailored to your needs!
            </p>
          </div>
        </Show>

        <For each={messages()}>
          {(message) => (
            <div class={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                class={`max-w-[80%] p-3 rounded-lg ${
                  message.type === 'user'
                    ? 'bg-blue-500 text-white'
                    : message.type === 'system'
                    ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white'
                }`}
              >
                <div class="flex items-start space-x-2">
                  <div class="flex-shrink-0 mt-0.5">
                    {message.type === 'user' && <User class="w-4 h-4" />}
                    {message.type === 'assistant' && <Bot class="w-4 h-4" />}
                    {message.type === 'system' && <AlertCircle class="w-4 h-4" />}
                  </div>
                  <div class="flex-1">
                    <div class="text-sm whitespace-pre-wrap">{message.content}</div>
                    <div class="text-xs opacity-70 mt-1">
                      {message.timestamp.toLocaleTimeString()}
                      {message.agentType && ` • ${message.agentType}`}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </For>

        <Show when={loading()}>
          <div class="flex justify-start">
            <div class="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg">
              <div class="flex items-center space-x-2">
                <Loader2 class="w-4 h-4 animate-spin" />
                <span class="text-sm text-gray-600 dark:text-gray-400">
                  Agent is processing...
                </span>
              </div>
            </div>
          </div>
        </Show>
      </div>

      {/* Input Area */}
      <div class="p-4 border-t border-gray-200 dark:border-gray-700">
        <div class="flex space-x-3">
          <textarea
            class="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 resize-none"
            placeholder="Ask me to create a workflow, connect an app, or automate a task..."
            value={input()}
            onInput={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            rows="2"
          />
          <button
            onClick={handleSend}
            disabled={!input().trim() || loading()}
            class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send class="w-5 h-5" />
          </button>
        </div>

        <div class="mt-2 text-xs text-gray-500 dark:text-gray-400 flex items-center space-x-1">
          <Bot class="w-3 h-3" />
          <span>Powered by Claude via AWS Bedrock • Tenant-aware AI assistance</span>
        </div>
      </div>
    </div>
  );
}