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
  const { executeTool, isConnected, agents } = useDashboardServer();
  const { success, error: notifyError } = useNotifications();

  const [messages, setMessages] = createSignal<ChatMessage[]>([]);
  const [input, setInput] = createSignal('');
  const [availableAgents, setAvailableAgents] = createSignal<string[]>([]);
  const [selectedAgent, setSelectedAgent] = createSignal<string>('');
  const [mode, setMode] = createSignal<'governance' | 'direct'>('governance');
  const [loading, setLoading] = createSignal(false);

  let chatContainerRef: HTMLDivElement;

  // Load available agents on mount
  createEffect(async () => {
    try {
      const agentsList = await agents.listAvailableAgents();
      if (agentsList && agentsList.agents) {
        setAvailableAgents(agentsList.agents);
        if (agentsList.agents.length > 0) {
          setSelectedAgent(agentsList.agents[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load agents:', err);
      notifyError('Failed to load available agents');
    }
  });

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

    // Generate session context
    const userId = 'demo-user-123'; // TODO: Get from auth context
    const sessionId = `chat-session-${Date.now()}`;

    try {
      if (mode() === 'governance') {
        // Use full agent governance flow (Conductor → Critic → Specialists)
        addMessage({
          type: 'system',
          content: 'Processing request through agent governance (Conductor → Critic → Specialists)...'
        });

        const result = await agents.processRequest(
          userId,
          sessionId,
          userInput,
          { source: 'dashboard-chat', timestamp: new Date().toISOString() }
        );

        if (result.success) {
          addMessage({
            type: 'assistant',
            content: `✅ Request completed successfully!\n\n**Plan ID:** ${result.planId}\n**Execution ID:** ${result.executionId}\n\n**Summary:** ${JSON.stringify(result.results.summary, null, 2)}`,
            requestId: result.requestId,
            executionId: result.executionId
          });
          success('Request processed through agent governance');
        } else {
          addMessage({
            type: 'assistant',
            content: `❌ Request was rejected by Critic Agent\n\n**Reason:** ${result.reason}\n\n**Required Modifications:**\n${result.requiredModifications?.map(mod => `• ${mod}`).join('\n') || 'None specified'}`
          });
          notifyError('Request rejected by safety validation');
        }
      } else {
        // Direct delegation to specific agent
        if (!selectedAgent()) {
          notifyError('Please select an agent for direct delegation');
          return;
        }

        addMessage({
          type: 'system',
          content: `Delegating directly to ${selectedAgent()} agent...`
        });

        const result = await agents.delegateToAgent(
          selectedAgent(),
          userInput,
          userId,
          sessionId,
          { source: 'dashboard-chat-direct', agentType: selectedAgent() }
        );

        if (result.success) {
          addMessage({
            type: 'assistant',
            content: `🤖 **${selectedAgent()}** agent response:\n\n${JSON.stringify(result.result, null, 2)}`,
            agentType: selectedAgent()
          });
          success(`Task delegated to ${selectedAgent()} agent`);
        } else {
          addMessage({
            type: 'assistant',
            content: `❌ Agent delegation failed: ${result.error}`
          });
          notifyError('Agent delegation failed');
        }
      }
    } catch (err) {
      console.error('Agent execution error:', err);
      addMessage({
        type: 'assistant',
        content: `❌ Error: ${err instanceof Error ? err.message : 'Unknown error occurred'}`
      });
      notifyError('Agent execution failed');
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
            Agent Chat
          </h2>
        </div>

        <div class="flex items-center space-x-3">
          {/* Mode Toggle */}
          <div class="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            <button
              class={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                mode() === 'governance'
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
              onClick={() => setMode('governance')}
            >
              Governance
            </button>
            <button
              class={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                mode() === 'direct'
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
              onClick={() => setMode('direct')}
            >
              Direct
            </button>
          </div>

          {/* Agent Selector (Direct mode only) */}
          <Show when={mode() === 'direct'}>
            <select
              class="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
              value={selectedAgent()}
              onChange={(e) => setSelectedAgent(e.target.value)}
            >
              <For each={availableAgents()}>
                {(agent) => <option value={agent}>{agent}</option>}
              </For>
            </select>
          </Show>

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
            <p class="text-lg font-medium mb-2">Welcome to Agent Chat</p>
            <p class="text-sm">
              Choose between <strong>Governance mode</strong> (full Conductor → Critic → Specialist flow)
              or <strong>Direct mode</strong> (delegate directly to a specific agent).
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
            placeholder={
              mode() === 'governance'
                ? 'Ask for anything - request will go through Conductor → Critic → Specialist flow...'
                : `Send a task directly to ${selectedAgent() || 'selected'} agent...`
            }
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

        <div class="mt-2 text-xs text-gray-500 dark:text-gray-400">
          <Show when={mode() === 'governance'}>
            <div class="flex items-center space-x-1">
              <CheckCircle class="w-3 h-3" />
              <span>Governance mode: Full safety validation and agent orchestration</span>
            </div>
          </Show>
          <Show when={mode() === 'direct'}>
            <div class="flex items-center space-x-1">
              <Bot class="w-3 h-3" />
              <span>Direct mode: Bypasses governance for direct agent communication</span>
            </div>
          </Show>
        </div>
      </div>
    </div>
  );
}