import { For, Show } from 'solid-js';
import { X, Maximize2, Minimize2 } from 'lucide-solid';
import { useOverlay } from '../../../contexts/OverlayContext';

export default function OverlayManager() {
  const { overlays, closeOverlay } = useOverlay();

  const getSizeClasses = (size?: string) => {
    switch (size) {
      case 'small':
        return 'w-96 h-2/3 max-h-[600px]';
      case 'medium':
        return 'w-2/3 h-2/3 max-w-4xl max-h-[800px]';
      case 'large':
        return 'w-5/6 h-5/6 max-w-6xl max-h-[900px]';
      case 'fullscreen':
        return 'w-full h-full max-w-none max-h-none';
      default:
        return 'w-2/3 h-2/3 max-w-4xl max-h-[800px]';
    }
  };

  return (
    <Show when={overlays().length > 0}>
      <div class="fixed inset-0 z-[100] overflow-hidden">
        <For each={overlays()}>
          {(overlay, index) => (
            <div class="absolute inset-0">
              {/* Backdrop with proper event capture */}
              <div
                class="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  closeOverlay(overlay.id);
                }}
                onWheel={(e) => e.stopPropagation()}
                onTouchMove={(e) => e.stopPropagation()}
              />

              {/* Overlay Panel */}
              <div class="absolute inset-0 flex items-center justify-center p-4">
                <div
                  class={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ${getSizeClasses(overlay.size)}`}
                  style={{
                    'z-index': 101 + index(),
                    transform: `scale(${1 - index() * 0.02}) translateY(${index() * 20}px)`
                  }}
                  onClick={(e) => e.stopPropagation()}
                  onWheel={(e) => e.stopPropagation()}
                  onTouchMove={(e) => e.stopPropagation()}
                >
                  {/* Header */}
                  <div class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 flex-shrink-0">
                    <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
                      {overlay.title}
                    </h2>
                    <div class="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          closeOverlay(overlay.id);
                        }}
                        class="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                        title="Close"
                      >
                        <X class="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* Content with isolated scrolling */}
                  <div class="flex-1 overflow-auto bg-white dark:bg-gray-800 overscroll-contain">
                    <div
                      onWheel={(e) => e.stopPropagation()}
                      onTouchMove={(e) => e.stopPropagation()}
                      class="h-full"
                    >
                      {overlay.component()}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </For>
      </div>
    </Show>
  );
}