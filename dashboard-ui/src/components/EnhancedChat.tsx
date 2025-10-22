import { createSignal, createEffect, For, Show, onMount } from 'solid-js';
import { useDashboardServer } from '../contexts/DashboardServerContext';
import { useNotifications } from '../contexts/NotificationContext';
import { Send, Bot, User, Loader2, Copy, Check, Sparkles, Workflow, Eye, Save } from 'lucide-solid';
import { marked } from 'marked';
import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.css';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  streaming?: boolean;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  workflowData?: any; // Generated workflow JSON if present
  isWorkflowGeneration?: boolean; // Flag for workflow generation messages
}

export default function EnhancedChat() {
  const { sendMessageWithResponse } = useDashboardServer();
  const { success, error: notifyError } = useNotifications();

  const [messages, setMessages] = createSignal<ChatMessage[]>([]);
  const [input, setInput] = createSignal('');
  const [currentSessionId, setCurrentSessionId] = createSignal<string | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [copiedId, setCopiedId] = createSignal<string | null>(null);
  const [workflowGenerationMode, setWorkflowGenerationMode] = createSignal(false);
  const [previewWorkflow, setPreviewWorkflow] = createSignal<any | null>(null);

  let chatContainerRef: HTMLDivElement;

  // Detect if user input is a workflow generation request
  const isWorkflowRequest = (text: string): boolean => {
    const workflowKeywords = [
      'build workflow',
      'create workflow',
      'generate workflow',
      'make workflow',
      'workflow that',
      'automate',
      'automation'
    ];
    const lowerText = text.toLowerCase();
    return workflowKeywords.some(keyword => lowerText.includes(keyword));
  };

  // Configure marked for syntax highlighting and load chat history
  onMount(async () => {
    marked.setOptions({
      highlight: function (code, lang) {
        const language = hljs.getLanguage(lang) ? lang : 'plaintext';
        return hljs.highlight(code, { language }).value;
      },
      langPrefix: 'hljs language-',
      breaks: true,
      gfm: true
    });

    // Load most recent chat session
    try {
      const response = await sendMessageWithResponse({
        type: 'chat.list_sessions',
        data: {}
      });

      if (response?.data?.sessions && response.data.sessions.length > 0) {
        const latestSession = response.data.sessions[0];
        setCurrentSessionId(latestSession.sessionId);

        // Load messages from session
        if (latestSession.messages && latestSession.messages.length > 0) {
          const loadedMessages = latestSession.messages.map((msg: {
            id: string;
            role: 'user' | 'assistant' | 'system';
            content: string;
            timestamp: string;
            metadata?: {
              usage?: { inputTokens: number; outputTokens: number; totalTokens: number };
              workflowData?: object;
              isWorkflowGeneration?: boolean;
            };
          }) => ({
            id: msg.id,
            role: msg.role,
            content: msg.content,
            timestamp: new Date(msg.timestamp),
            usage: msg.metadata?.usage,
            workflowData: msg.metadata?.workflowData,
            isWorkflowGeneration: msg.metadata?.isWorkflowGeneration
          }));
          setMessages(loadedMessages);
        }
      }
    } catch {
      console.log('No previous chat session found, starting fresh');
    }
  });

  // Auto-scroll to bottom when new messages arrive
  createEffect(() => {
    messages(); // Subscribe to messages
    setTimeout(() => {
      if (chatContainerRef) {
        chatContainerRef.scrollTop = chatContainerRef.scrollHeight;
      }
    }, 50);
  });

  const addMessage = (message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      timestamp: new Date(),
      ...message
    };
    setMessages(prev => [...prev, newMessage]);
    return newMessage.id;
  };

  const updateLastMessage = (updates: Partial<ChatMessage>) => {
    setMessages(prev => {
      const updated = [...prev];
      if (updated.length > 0) {
        updated[updated.length - 1] = { ...updated[updated.length - 1], ...updates };
      }
      return updated;
    });
  };

  const handleSend = async (forceWorkflowMode = false) => {
    const userInput = input().trim();
    if (!userInput) return;

    const isWorkflow = forceWorkflowMode || (workflowGenerationMode() && isWorkflowRequest(userInput));

    // Add user message
    addMessage({
      role: 'user',
      content: userInput,
      isWorkflowGeneration: isWorkflow
    });

    setInput('');
    setLoading(true);

    // Add assistant placeholder
    addMessage({
      role: 'assistant',
      content: '',
      streaming: true,
      isWorkflowGeneration: isWorkflow
    });

    try {
      if (isWorkflow) {
        // Send workflow generation request
        const response = await sendMessageWithResponse({
          type: 'workflow.generate',
          data: {
            prompt: userInput,
            sessionId: currentSessionId()
          }
        });

        if (response && response.type === 'workflow.generated') {
          // Successfully generated workflow
          setCurrentSessionId(response.data.sessionId);

          const workflowSummary = `✅ **Workflow Generated Successfully!**

**Name:** ${response.data.workflow.name || 'Untitled Workflow'}
**Description:** ${response.data.workflow.description || 'No description'}
**Nodes:** ${response.data.workflow.nodes?.length || 0}
**Connections:** ${response.data.workflow.connections?.length || 0}

${response.data.rawResponse || ''}`;

          updateLastMessage({
            content: workflowSummary,
            streaming: false,
            usage: response.data.usage,
            workflowData: response.data.workflow
          });

          success('Workflow generated! You can preview or save it.');
        } else if (response && response.type === 'workflow.generation_response') {
          // Claude responded but didn't generate workflow (e.g., asking for clarification)
          setCurrentSessionId(response.data.sessionId);

          updateLastMessage({
            content: response.data.message,
            streaming: false,
            usage: response.data.usage
          });
        } else if (response && response.type === 'workflow.generation_failed') {
          // Generation failed
          updateLastMessage({
            content: `❌ **Workflow Generation Failed**\n\n${response.error}\n\n${response.data?.rawResponse || ''}`,
            streaming: false
          });
          notifyError('Failed to generate workflow');
        }
      } else {
        // Regular chat message
        const response = await sendMessageWithResponse({
          type: 'chat.send_message',
          data: {
            sessionId: currentSessionId(),
            message: userInput,
            streaming: false
          }
        });

        if (response && response.data) {
          setCurrentSessionId(response.data.sessionId);

          updateLastMessage({
            content: response.data.message.content,
            streaming: false,
            usage: response.data.message.usage
          });
        }
      }
    } catch (err) {
      console.error('Chat error:', err);
      updateLastMessage({
        content: `❌ Error: ${err instanceof Error ? err.message : 'Unknown error occurred'}`,
        streaming: false
      });
      notifyError('Failed to send message');
    } finally {
      setLoading(false);
    }
  };

  const handlePreviewWorkflow = (workflow: any) => {
    setPreviewWorkflow(workflow);
    // TODO: Open workflow preview modal or navigate to workflow builder
    success('Workflow preview feature coming soon!');
  };

  const handleSaveWorkflow = async (workflow: any) => {
    try {
      // Publish workflow_created event with the AI-generated workflow
      await sendMessageWithResponse({
        type: 'publish_event',
        event: {
          detailType: 'workflow.ai_generated',
          source: 'enhanced-chat',
          detail: {
            workflow,
            action: 'save_to_canvas',
            timestamp: new Date().toISOString()
          }
        }
      });

      success('Workflow published to canvas! Check the Workflows tab.');
      setPreviewWorkflow(null);

      // Optional: Navigate to workflows page
      // window.location.href = '/workflows';
    } catch (err) {
      notifyError('Failed to save workflow');
      console.error('Workflow save error:', err);
    }
  };

  const handleKeyPress = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
      success('Copied to clipboard');
    } catch (err) {
      notifyError('Failed to copy');
    }
  };

  const renderMarkdown = (content: string) => {
    const html = marked.parse(content) as string;
    return html;
  };

  const formatTokens = (usage?: { inputTokens: number; outputTokens: number; totalTokens: number }) => {
    if (!usage) return null;
    return `${usage.totalTokens.toLocaleString()} tokens (${usage.inputTokens.toLocaleString()} in, ${usage.outputTokens.toLocaleString()} out)`;
  };

  return (
    <div class="flex flex-col h-full bg-white dark:bg-gray-900">
      {/* Header */}
      <div class="flex items-center justify-end px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-900">
        <div class="flex items-center space-x-2">
          {/* Mode Toggle */}
          <button
            onClick={() => setWorkflowGenerationMode(!workflowGenerationMode())}
            class={`flex items-center space-x-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              workflowGenerationMode()
                ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
            title={workflowGenerationMode() ? 'Switch to Plan Mode' : 'Switch to Edit Mode'}
          >
            <Workflow class="w-4 h-4" />
            <span>{workflowGenerationMode() ? 'Edit Mode' : 'Plan Mode'}</span>
          </button>

        </div>
      </div>

      {/* Chat Messages */}
      <div
        ref={chatContainerRef!}
        class="flex-1 overflow-y-auto px-6 py-4 space-y-6"
      >
        <Show when={messages().length === 0}>
          <div class="flex flex-col items-center justify-center h-full text-center px-4">
            {/* Example Prompts */}
            <div class="mt-6 max-w-2xl">
              <div class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Try asking:</div>
              <div class="space-y-2">
                <button
                  onClick={() => {
                    setInput('Build a workflow that creates a time-series chart of Google Analytics traffic trends');
                    setWorkflowGenerationMode(true);
                  }}
                  class="w-full text-left px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm text-gray-700 dark:text-gray-300"
                >
                  📈 "Build a workflow that creates a time-series chart of Google Analytics traffic trends"
                </button>
                <button
                  onClick={() => {
                    setInput('Create a workflow to show top pages in a bar chart daily');
                    setWorkflowGenerationMode(true);
                  }}
                  class="w-full text-left px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm text-gray-700 dark:text-gray-300"
                >
                  📊 "Create a workflow to show top pages in a bar chart daily"
                </button>
                <button
                  onClick={() => {
                    setInput('Generate a workflow that sends Slack notifications with a pie chart of traffic sources');
                    setWorkflowGenerationMode(true);
                  }}
                  class="w-full text-left px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm text-gray-700 dark:text-gray-300"
                >
                  🥧 "Generate a workflow that sends Slack notifications with a pie chart of traffic sources"
                </button>
              </div>
            </div>
          </div>
        </Show>

        <For each={messages()}>
          {(message) => (
            <div class={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div class={`max-w-[85%] ${message.role === 'user' ? 'ml-12' : 'mr-12'}`}>
                {/* Message Header */}
                <div class="flex items-center space-x-2 mb-2">
                  <div class={`flex items-center justify-center w-7 h-7 rounded-full ${message.role === 'user' ? 'bg-blue-500' : 'bg-gradient-to-br from-purple-500 to-pink-500'}`}>
                    {message.role === 'user' ? (
                      <User class="w-4 h-4 text-white" />
                    ) : (
                      <Bot class="w-4 h-4 text-white" />
                    )}
                  </div>
                  <span class="text-sm font-medium text-gray-900 dark:text-white">
                    {message.role === 'user' ? 'You' : 'Claude'}
                  </span>
                  <span class="text-xs text-gray-500 dark:text-gray-400">
                    {message.timestamp.toLocaleTimeString()}
                  </span>
                  <Show when={message.usage}>
                    <span class="text-xs text-gray-400 dark:text-gray-500">
                      • {formatTokens(message.usage)}
                    </span>
                  </Show>
                </div>

                {/* Message Content */}
                <div class={`rounded-2xl px-4 py-3 ${message.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'}`}>
                  <Show when={message.streaming}>
                    <div class="flex items-center space-x-2 text-gray-600 dark:text-gray-400">
                      <Loader2 class="w-4 h-4 animate-spin" />
                      <span class="text-sm">Thinking...</span>
                    </div>
                  </Show>

                  <Show when={!message.streaming}>
                    <div
                      class={`prose prose-sm max-w-none ${message.role === 'user' ? 'prose-invert' : 'dark:prose-invert'}`}
                      innerHTML={renderMarkdown(message.content)}
                    />
                  </Show>
                </div>

                {/* Action Buttons (for assistant messages) */}
                <Show when={message.role === 'assistant' && !message.streaming}>
                  <div class="mt-2 flex justify-end space-x-2">
                    {/* Workflow Actions */}
                    <Show when={message.workflowData}>
                      <button
                        onClick={() => handlePreviewWorkflow(message.workflowData)}
                        class="flex items-center space-x-1 px-3 py-1.5 text-xs font-medium text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded-lg transition-colors"
                      >
                        <Eye class="w-3 h-3" />
                        <span>Preview Workflow</span>
                      </button>
                      <button
                        onClick={() => handleSaveWorkflow(message.workflowData)}
                        class="flex items-center space-x-1 px-3 py-1.5 text-xs font-medium text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-lg transition-colors"
                      >
                        <Save class="w-3 h-3" />
                        <span>Save Workflow</span>
                      </button>
                    </Show>

                    {/* Copy Button */}
                    <button
                      onClick={() => copyToClipboard(message.content, message.id)}
                      class="flex items-center space-x-1 px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                      {copiedId() === message.id ? (
                        <>
                          <Check class="w-3 h-3" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy class="w-3 h-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                </Show>
              </div>
            </div>
          )}
        </For>

        <Show when={loading() && messages().length > 0 && !messages()[messages().length - 1].streaming}>
          <div class="flex justify-start mr-12">
            <div class="flex items-center space-x-2 px-4 py-3 bg-gray-100 dark:bg-gray-800 rounded-2xl">
              <Loader2 class="w-4 h-4 animate-spin text-blue-500" />
              <span class="text-sm text-gray-600 dark:text-gray-400">
                ...thinking...
              </span>
            </div>
          </div>
        </Show>
      </div>

      {/* Input Area */}
      <div class="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-6 py-4">
        <div class="max-w-4xl mx-auto">
          <div class="flex items-end space-x-3">
            <div class="flex-1 relative">
              <textarea
                class={`w-full px-4 py-3 pr-12 border rounded-2xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 resize-none focus:outline-none focus:ring-2 transition-shadow ${
                  workflowGenerationMode()
                    ? 'border-purple-300 dark:border-purple-700 focus:ring-purple-500 dark:focus:ring-purple-400'
                    : 'border-gray-300 dark:border-gray-700 focus:ring-blue-500 dark:focus:ring-blue-400'
                }`}
                placeholder={workflowGenerationMode() ? "Describe the workflow you want to build..." : "Plan anything..."}
                value={input()}
                onInput={(e) => setInput(e.currentTarget.value)}
                onKeyPress={handleKeyPress}
                rows="1"
                style={{
                  "min-height": "52px",
                  "max-height": "200px"
                }}
              />
              <div class="absolute right-3 bottom-3 text-xs text-gray-400">
                {input().length > 0 && <span>{input().length} chars</span>}
              </div>
            </div>
            <button
              onClick={() => handleSend()}
              disabled={!input().trim() || loading()}
              class={`p-2.5 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors ${
                workflowGenerationMode()
                  ? 'bg-purple-600 hover:bg-purple-700 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
              title={workflowGenerationMode() ? 'Generate workflow' : 'Send message'}
            >
              {loading() ? (
                <Loader2 class="w-5 h-5 animate-spin" />
              ) : workflowGenerationMode() ? (
                <Workflow class="w-5 h-5" />
              ) : (
                <Send class="w-5 h-5" />
              )}
            </button>
          </div>        
        </div>
      </div>
    </div>
  );
}
