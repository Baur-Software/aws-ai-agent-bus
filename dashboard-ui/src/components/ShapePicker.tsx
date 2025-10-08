import { For, createSignal, Show } from 'solid-js';
import { ShapeRenderer, type ShapeType } from '@ai-agent-bus/shapes';

interface ShapePickerProps {
  value?: ShapeType | null;
  onChange: (shape: ShapeType | null) => void;
  color?: string;
}

const AVAILABLE_SHAPES: Array<{ type: ShapeType; name: string; description: string }> = [
  { type: 'rectangle', name: 'Rectangle', description: 'Standard rectangular node' },
  { type: 'circle', name: 'Circle', description: 'Circular node' },
  { type: 'triangle', name: 'Triangle', description: 'Triangular shape' },
  { type: 'diamond', name: 'Diamond', description: 'Decision/conditional node' },
  { type: 'hexagon', name: 'Hexagon', description: 'Process node' },
  { type: 'arrow', name: 'Arrow', description: 'Directional flow' },
  { type: 'star', name: 'Star', description: 'Highlight/important' },
  { type: 'heart', name: 'Heart', description: 'Favorite/special' },
  { type: 'sticky-note', name: 'Sticky Note', description: 'Comment/annotation' }
];

export function ShapePicker(props: ShapePickerProps) {
  const [isOpen, setIsOpen] = createSignal(false);

  const selectedShape = () => {
    if (!props.value) return null;
    return AVAILABLE_SHAPES.find(s => s.type === props.value);
  };

  return (
    <div class="relative">
      {/* Current Selection */}
      <button
        type="button"
        class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-left flex items-center justify-between hover:border-blue-500"
        onClick={() => setIsOpen(!isOpen())}
      >
        <div class="flex items-center gap-3">
          <Show
            when={props.value}
            fallback={
              <div class="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded flex items-center justify-center text-slate-400">
                <span class="text-xs">None</span>
              </div>
            }
          >
            <div class="w-12 h-12 relative">
              <ShapeRenderer
                shape={props.value!}
                width={48}
                height={48}
                color={props.color || 'bg-blue-500'}
              />
            </div>
          </Show>
          <div>
            <div class="text-sm font-medium text-slate-900 dark:text-white">
              {selectedShape()?.name || 'No Shape'}
            </div>
            <div class="text-xs text-slate-500 dark:text-slate-400">
              {selectedShape()?.description || 'Default node appearance'}
            </div>
          </div>
        </div>
        <svg
          class={`w-4 h-4 text-slate-400 transition-transform ${isOpen() ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      <Show when={isOpen()}>
        <div class="absolute z-50 mt-2 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl max-h-96 overflow-y-auto">
          {/* No Shape Option */}
          <button
            type="button"
            class="w-full px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-3 border-b border-slate-200 dark:border-slate-700"
            onClick={() => {
              props.onChange(null);
              setIsOpen(false);
            }}
          >
            <div class="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded flex items-center justify-center text-slate-400">
              <span class="text-xs">None</span>
            </div>
            <div class="text-left">
              <div class="text-sm font-medium text-slate-900 dark:text-white">
                No Shape
              </div>
              <div class="text-xs text-slate-500 dark:text-slate-400">
                Default node appearance
              </div>
            </div>
          </button>

          {/* Shape Options */}
          <For each={AVAILABLE_SHAPES}>
            {(shape) => (
              <button
                type="button"
                class={`w-full px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-3 ${
                  props.value === shape.type ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                }`}
                onClick={() => {
                  props.onChange(shape.type);
                  setIsOpen(false);
                }}
              >
                <div class="w-12 h-12 relative flex-shrink-0">
                  <ShapeRenderer
                    shape={shape.type}
                    width={48}
                    height={48}
                    color={props.color || 'bg-blue-500'}
                  />
                </div>
                <div class="text-left flex-1">
                  <div class="text-sm font-medium text-slate-900 dark:text-white">
                    {shape.name}
                  </div>
                  <div class="text-xs text-slate-500 dark:text-slate-400">
                    {shape.description}
                  </div>
                </div>
                <Show when={props.value === shape.type}>
                  <svg class="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fill-rule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clip-rule="evenodd"
                    />
                  </svg>
                </Show>
              </button>
            )}
          </For>
        </div>
      </Show>

      {/* Backdrop to close dropdown */}
      <Show when={isOpen()}>
        <div
          class="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      </Show>
    </div>
  );
}
