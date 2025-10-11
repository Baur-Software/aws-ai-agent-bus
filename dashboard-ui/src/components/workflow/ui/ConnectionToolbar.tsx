import { createSignal, Show, For } from 'solid-js';
import {
  ArrowRight,
  ArrowLeft,
  ArrowUpDown,
  Type,
  Palette,
  MoreHorizontal,
  Trash2,
  Edit3
} from 'lucide-solid';

export interface ConnectionStyle {
  strokeWidth: number;
  strokeDasharray?: string;
  color: string;
  startArrow: 'none' | 'arrow' | 'circle' | 'diamond';
  endArrow: 'none' | 'arrow' | 'circle' | 'diamond';
  label?: string;
}

interface ConnectionToolbarProps {
  position: { x: number; y: number };
  connectionId: string;
  currentStyle: ConnectionStyle;
  onStyleChange: (style: Partial<ConnectionStyle>) => void;
  onDelete: () => void;
  onClose: () => void;
}

export default function ConnectionToolbar(props: ConnectionToolbarProps) {
  const [showColorPicker, setShowColorPicker] = createSignal(false);
  const [showLineStyles, setShowLineStyles] = createSignal(false);
  const [isEditingLabel, setIsEditingLabel] = createSignal(false);
  const [labelText, setLabelText] = createSignal(props.currentStyle.label || '');

  const colors = [
    '#6366f1', // Default blue
    '#ef4444', // Red
    '#10b981', // Green
    '#f59e0b', // Amber
    '#8b5cf6', // Purple
    '#06b6d4', // Cyan
    '#84cc16', // Lime
    '#f97316', // Orange
    '#6b7280', // Gray
    '#1f2937'  // Dark gray
  ];

  const lineStyles = [
    { name: 'Solid', strokeDasharray: undefined, strokeWidth: 2 },
    { name: 'Dashed', strokeDasharray: '8,4', strokeWidth: 2 },
    { name: 'Dotted', strokeDasharray: '2,2', strokeWidth: 2 },
    { name: 'Thick', strokeDasharray: undefined, strokeWidth: 4 },
    { name: 'Thin', strokeDasharray: undefined, strokeWidth: 1 }
  ];

  // Arrow combinations for single button cycling
  const arrowCombinations = [
    { name: 'None', startArrow: 'none' as const, endArrow: 'none' as const, icon: MoreHorizontal },
    { name: 'End Arrow', startArrow: 'none' as const, endArrow: 'arrow' as const, icon: ArrowRight },
    { name: 'Both Arrows', startArrow: 'arrow' as const, endArrow: 'arrow' as const, icon: ArrowRight },
    { name: 'Reverse Arrow', startArrow: 'arrow' as const, endArrow: 'none' as const, icon: ArrowRight }
  ];

  // Get current arrow combination
  const getCurrentArrowIndex = () => {
    return arrowCombinations.findIndex(combo =>
      combo.startArrow === props.currentStyle.startArrow &&
      combo.endArrow === props.currentStyle.endArrow
    );
  };

  const handleLabelSave = () => {
    props.onStyleChange({ label: labelText().trim() || undefined });
    setIsEditingLabel(false);
  };

  return (
    <div
      class="fixed bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-2 z-50 flex items-center gap-1"
      style={{
        left: `${props.position.x}px`,
        top: `${props.position.y - 60}px`,
        transform: 'translateX(-50%)'
      }}
    >
      {/* Arrow Style */}
      <div class="relative">
        <button
          class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors group"
          title="Arrow Style"
          style={{ 'pointer-events': 'auto', cursor: 'pointer' }}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();

            // Find current combination or default to first
            let currentIndex = arrowCombinations.findIndex(combo =>
              combo.startArrow === props.currentStyle.startArrow &&
              combo.endArrow === props.currentStyle.endArrow
            );

            if (currentIndex === -1) currentIndex = 0;

            const nextIndex = (currentIndex + 1) % arrowCombinations.length;
            const combo = arrowCombinations[nextIndex];

            props.onStyleChange({
              startArrow: combo.startArrow,
              endArrow: combo.endArrow
            });
          }}
        >
          <ArrowRight class="w-4 h-4 text-gray-600 dark:text-gray-300" />
        </button>
      </div>

      {/* Line Style */}
      <div class="relative">
        <button
          class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          title="Line Style"
          onClick={() => setShowLineStyles(!showLineStyles())}
        >
          <div
            class="w-4 h-0.5 bg-current"
            style={{
              'border-top': `${props.currentStyle.strokeWidth}px ${props.currentStyle.strokeDasharray ? 'dashed' : 'solid'} ${props.currentStyle.color}`
            }}
          />
        </button>

        <Show when={showLineStyles()}>
          <div class="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-2 min-w-[120px]">
            <For each={lineStyles}>{style => (
              <button
                class="w-full p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-left text-sm transition-colors"
                onClick={() => {
                  props.onStyleChange({
                    strokeWidth: style.strokeWidth,
                    strokeDasharray: style.strokeDasharray
                  });
                  setShowLineStyles(false);
                }}
              >
                <div class="flex items-center gap-2">
                  <div
                    class="flex-1 h-0.5 bg-gray-600"
                    style={{
                      'border-top': `${style.strokeWidth}px ${style.strokeDasharray ? 'dashed' : 'solid'} currentColor`
                    }}
                  />
                  <span>{style.name}</span>
                </div>
              </button>
            )}</For>
          </div>
        </Show>
      </div>

      {/* Color */}
      <div class="relative">
        <button
          class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          title="Color"
          onClick={() => setShowColorPicker(!showColorPicker())}
        >
          <div class="flex items-center gap-1">
            <Palette class="w-4 h-4 text-gray-600 dark:text-gray-300" />
            <div
              class="w-3 h-3 rounded border border-gray-300"
              style={{ 'background-color': props.currentStyle.color }}
            />
          </div>
        </button>

        <Show when={showColorPicker()}>
          <div class="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-3">
            <div class="grid grid-cols-5 gap-2">
              <For each={colors}>{color => (
                <button
                  class={`w-6 h-6 rounded border-2 transition-transform hover:scale-110 ${
                    props.currentStyle.color === color ? 'border-gray-400' : 'border-gray-200'
                  }`}
                  style={{ 'background-color': color }}
                  onClick={() => {
                    props.onStyleChange({ color });
                    setShowColorPicker(false);
                  }}
                />
              )}</For>
            </div>
          </div>
        </Show>
      </div>

      {/* Label */}
      <div class="relative">
        {isEditingLabel() ? (
          <div class="flex items-center gap-1">
            <input
              type="text"
              value={labelText()}
              onInput={(e) => setLabelText(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleLabelSave();
                if (e.key === 'Escape') setIsEditingLabel(false);
              }}
              onBlur={handleLabelSave}
              class="w-20 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:border-blue-500"
              placeholder="Label"
              autofocus
            />
          </div>
        ) : (
          <button
            class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title={props.currentStyle.label ? "Edit Label" : "Add Label"}
            onClick={() => {
              setLabelText(props.currentStyle.label || '');
              setIsEditingLabel(true);
            }}
          >
            <div class="flex items-center gap-1">
              <Type class="w-4 h-4 text-gray-600 dark:text-gray-300" />
              {props.currentStyle.label && (
                <span class="text-xs text-gray-600 dark:text-gray-300 max-w-[40px] truncate">
                  {props.currentStyle.label}
                </span>
              )}
            </div>
          </button>
        )}
      </div>

      {/* Separator */}
      <div class="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />

      {/* Delete */}
      <button
        class="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors text-red-600 dark:text-red-400"
        title="Delete Connection"
        onClick={props.onDelete}
      >
        <Trash2 class="w-4 h-4" />
      </button>

      {/* Close */}
      <button
        class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors ml-1"
        title="Close"
        onClick={props.onClose}
      >
        <MoreHorizontal class="w-4 h-4 text-gray-600 dark:text-gray-300" />
      </button>
    </div>
  );
}