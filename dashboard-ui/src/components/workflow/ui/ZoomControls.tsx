import { ZoomIn, ZoomOut, RotateCcw, Hand, Expand } from 'lucide-solid';
import type { WorkflowNode } from '../core/WorkflowCanvas';

interface ZoomControlsProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  onFitToScreen: () => void;
  isPanMode?: boolean;
  onTogglePanMode?: () => void;
  isNodePanelPinned?: boolean;
  nodes: WorkflowNode[];
}

export default function ZoomControls(props: ZoomControlsProps) {
  return (
    <div
      class="absolute bottom-4 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200 dark:border-gray-600 p-3 flex flex-col gap-2 pointer-events-auto"
      style={{
        'z-index': 'var(--z-node-details)',
        right: props.isNodePanelPinned ? '340px' : '16px' // 320px panel width + 20px spacing
      }}
    >
      {/* Zoom In */}
      <button
        type="button"
        class="w-10 h-10 flex items-center justify-center bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-all duration-200 hover:scale-105"
        onClick={props.onZoomIn}
        title="Zoom In"
      >
        <ZoomIn class="w-4 h-4" />
      </button>

      {/* Zoom Level Display */}
      <div class="text-xs text-center text-gray-600 dark:text-gray-400 px-1 py-1 bg-gray-50 dark:bg-gray-700 rounded">
        {Math.round(props.zoom * 100)}%
      </div>

      {/* Zoom Out */}
      <button
        type="button"
        class="w-10 h-10 flex items-center justify-center bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-all duration-200 hover:scale-105"
        onClick={props.onZoomOut}
        title="Zoom Out"
      >
        <ZoomOut class="w-4 h-4" />
      </button>

      {/* Divider */}
      <div class="border-t border-gray-200 dark:border-gray-600 my-1"></div>

      {/* Reset View */}
      <button
        type="button"
        class="w-10 h-10 flex items-center justify-center bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-all duration-200 hover:scale-105"
        onClick={props.onResetView}
        title="Reset View"
      >
        <RotateCcw class="w-4 h-4" />
      </button>

      {/* Fit to Screen */}
      <button
        type="button"
        class="w-10 h-10 flex items-center justify-center bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-all duration-200 hover:scale-105"
        onClick={props.onFitToScreen}
        title="Fit to Screen"
        disabled={props.nodes.length === 0}
      >
        <Expand class="w-4 h-4" />
      </button>

      {/* Pan Mode */}
      <button
        type="button"
        class={`w-10 h-10 flex items-center justify-center rounded-lg transition-all duration-200 hover:scale-105 ${
          props.isPanMode
            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
            : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
        }`}
        onClick={props.onTogglePanMode}
        title={props.isPanMode ? 'Exit Pan Mode' : 'Pan Mode'}
      >
        <Hand class="w-4 h-4" />
      </button>
    </div>
  );
}
