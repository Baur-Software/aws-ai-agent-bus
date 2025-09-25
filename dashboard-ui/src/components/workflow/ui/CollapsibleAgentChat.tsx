import { createSignal, createEffect, Show } from 'solid-js';
import { MessageCircle, X, Minimize2, Bot, Pin, PinOff } from 'lucide-solid';
import { useWorkflowUI } from '../../../contexts/WorkflowUIContext';
import AgentChat from '../../AgentChat';

interface CollapsibleAgentChatProps {
  // Position relative to toolbar for collision detection
  toolbarPosition: { x: number; y: number };
  toolbarWidth?: number;
}

export default function CollapsibleAgentChat(props: CollapsibleAgentChatProps) {
  const workflowUI = useWorkflowUI();

  // Calculate position to the left of zoom controls
  const calculatePosition = () => {
    const toolbarPos = props.toolbarPosition;
    const toolbarWidth = props.toolbarWidth || 600;

    // Position to the left of the toolbar with some spacing
    return {
      x: Math.max(20, toolbarPos.x - 340), // Chat width + spacing, with minimum left margin
      y: toolbarPos.y
    };
  };

  // Update position when toolbar moves (only if not pinned)
  createEffect(() => {
    if (!workflowUI.isAgentChatPinned()) {
      const newPos = calculatePosition();
      workflowUI.setAgentChatPosition(newPos);
    }
  });

  const handleToggleExpanded = () => {
    const currentState = workflowUI.agentChatState();
    if (currentState === 'launcher') {
      workflowUI.setAgentChatState('agentchat');
    } else if (currentState === 'agentchat') {
      workflowUI.setAgentChatState('launcher');
    }
  };

  const handleTogglePin = () => {
    workflowUI.setIsAgentChatPinned(!workflowUI.isAgentChatPinned());
  };

  return (
    <div
      class={`fixed transition-all duration-300 ease-in-out ${
        workflowUI.agentChatState() === 'agentchat'
          ? 'w-80 h-96'
          : 'w-12 h-12'
      }`}
      style={{
        right: `${workflowUI.agentChatPosition().x}px`,
        bottom: `${workflowUI.agentChatPosition().y}px`,
        'z-index': 'var(--z-connection-toolbar)', // Use same level as connection toolbar
      }}
    >
      {/* Launcher Icon */}
      <Show when={workflowUI.agentChatState() === 'launcher'}>
        <button
          onClick={handleToggleExpanded}
          class="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 flex items-center justify-center relative group"
          title="Open Business Assistant"
        >
          <MessageCircle class="w-6 h-6" />
          {/* Notification dot */}
          <div class="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
          {/* Tooltip */}
          <div class="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
            Business Assistant
          </div>
        </button>
      </Show>

      {/* AgentChat Interface */}
      <Show when={workflowUI.agentChatState() === 'agentchat'}>
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col h-full">
            {/* Header */}
            <div class="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-t-lg">
              <div class="flex items-center gap-2">
                <Bot class="w-5 h-5" />
                <span class="font-medium text-sm">Business Assistant</span>
              </div>
              <div class="flex items-center gap-1">
                <button
                  onClick={handleTogglePin}
                  class="p-1 hover:bg-white/20 rounded transition-colors"
                  title={workflowUI.isAgentChatPinned() ? "Unpin from position" : "Pin to current position"}
                >
                  {workflowUI.isAgentChatPinned() ? <PinOff class="w-4 h-4" /> : <Pin class="w-4 h-4" />}
                </button>
                <button
                  onClick={handleToggleExpanded}
                  class="p-1 hover:bg-white/20 rounded transition-colors"
                  title="Minimize to launcher"
                >
                  <Minimize2 class="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Embedded AgentChat */}
            <div class="flex-1 overflow-hidden">
              <AgentChat />
            </div>
          </div>
        </Show>
    </div>
  );
}