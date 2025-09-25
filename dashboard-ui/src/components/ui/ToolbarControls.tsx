import { Show } from 'solid-js';
import { GripVertical, Pin, PinOff, X } from 'lucide-solid';
import ActionButton from './ActionButton';

export interface ToolbarControlsProps {
  // State
  isPinned: boolean;
  isDragging: boolean;
  showDragHandle?: boolean;

  // Handlers
  onPin: (e: MouseEvent) => void;
  onHide: () => void;

  // Customization
  pinTitle?: string;
  hideTitle?: string;
  class?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function ToolbarControls(props: ToolbarControlsProps) {
  const showDragHandle = () => props.showDragHandle ?? true;
  const size = () => props.size || 'md';

  const pinTitle = () => props.pinTitle || (props.isPinned ? 'Unpin' : 'Pin');
  const hideTitle = () => props.hideTitle || 'Hide';

  return (
    <div class={`flex items-center gap-1 ${props.class || ''}`}>
      {/* Drag Handle */}
      <Show when={showDragHandle() && !props.isPinned}>
        <div class="cursor-move p-1" data-drag-handle>
          <GripVertical class="w-4 h-4 text-gray-400 dark:text-gray-500" />
        </div>
      </Show>

      {/* Pin Button */}
      <Show when={!props.isDragging}>
        <ActionButton
          icon={props.isPinned ? PinOff : Pin}
          onClick={props.onPin}
          onMouseDown={(e) => e.stopPropagation()}
          variant="secondary"
          size={size()}
          iconOnly
          title={pinTitle()}
          class="text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
        />
      </Show>

      {/* Hide Button */}
      <ActionButton
        icon={X}
        onClick={props.onHide}
        onMouseDown={(e) => e.stopPropagation()}
        variant="secondary"
        size={size()}
        iconOnly
        title={hideTitle()}
        class="text-gray-500 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
      />
    </div>
  );
}