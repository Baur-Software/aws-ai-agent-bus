import { Pin, PinOff, ChevronLeft, ChevronRight } from 'lucide-solid';

interface ToolbarControlsProps {
  isPinned: boolean;
  isDragging: boolean;
  onPin: (e: MouseEvent) => void;
  isCompact?: boolean;
  onToggleCompact?: () => void;
  pinTitle?: string;
  compactTitle?: string;
}

export default function ToolbarControls(props: ToolbarControlsProps) {
  return (
    <div class="flex items-center gap-1">
      <button
        class={`p-2 rounded-lg transition-all duration-200 ${
          props.isPinned
            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
            : 'text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-600 dark:hover:text-slate-300'
        } ${props.isDragging ? 'opacity-50' : ''}`}
        onClick={props.onPin}
        title={props.pinTitle || (props.isPinned ? 'Unpin' : 'Pin')}
      >
        {props.isPinned ? (
          <PinOff class="w-4 h-4" />
        ) : (
          <Pin class="w-4 h-4" />
        )}
      </button>

      {props.onToggleCompact && (
        <button
          class={`p-2 rounded-lg transition-all duration-200 ${
            props.isCompact
              ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
              : 'text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-600 dark:hover:text-slate-300'
          }`}
          onClick={props.onToggleCompact}
          title={props.compactTitle || (props.isCompact ? 'Expand' : 'Collapse')}
        >
          {props.isCompact ? (
            <ChevronRight class="w-4 h-4" />
          ) : (
            <ChevronLeft class="w-4 h-4" />
          )}
        </button>
      )}
    </div>
  );
}