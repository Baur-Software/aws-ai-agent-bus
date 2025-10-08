import { For, Show } from 'solid-js';
import type { WorkflowConnection } from '../core/WorkflowCanvas';
import type { ConnectionStyle } from './ConnectionToolbar';

interface ConnectionData {
  connection: WorkflowConnection;
  fromPos: { x: number; y: number };
  toPos: { x: number; y: number };
  fromControl: { x: number; y: number };
  toControl: { x: number; y: number };
  path: string;
}

interface ConnectionRendererProps {
  connections: (ConnectionData | null)[];
  hoveredConnection: string | null;
  selectedConnection: string | null;
  onConnectionHover: (id: string | null) => void;
  onConnectionClick: (connection: WorkflowConnection, midpoint: { x: number; y: number }) => void;
  getConnectionStyle: (connection: WorkflowConnection) => ConnectionStyle;
  getMarkerUrl: (arrowType: string, position: 'start' | 'end') => string;
  canvasToScreen: (x: number, y: number) => { x: number; y: number };
}

export default function ConnectionRenderer(props: ConnectionRendererProps) {
  const handleConnectionClick = (connData: ConnectionData, e: MouseEvent) => {
    e.stopPropagation();

    const { connection, fromPos, toPos } = connData;
    const midX = (fromPos.x + toPos.x) / 2;
    const midY = (fromPos.y + toPos.y) / 2;
    const screenPos = props.canvasToScreen(midX, midY);

    // Ensure toolbar stays within viewport
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const toolbarWidth = 400;
    const toolbarHeight = 60;

    const constrainedPos = {
      x: Math.max(toolbarWidth / 2, Math.min(viewportWidth - toolbarWidth / 2, screenPos.x)),
      y: Math.max(toolbarHeight + 10, Math.min(viewportHeight - toolbarHeight - 10, screenPos.y))
    };

    props.onConnectionClick(connection, constrainedPos);
  };

  return (
    <>
      {/* Arrow marker definitions */}
      <defs style={{ 'pointer-events': 'none' }}>
        <marker
          id="arrow-end"
          markerWidth="10"
          markerHeight="10"
          refX="9"
          refY="3"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <polygon points="0 0, 10 3, 0 6" fill="currentColor" />
        </marker>
        <marker
          id="arrow-start"
          markerWidth="10"
          markerHeight="10"
          refX="1"
          refY="3"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <polygon points="10 0, 0 3, 10 6" fill="currentColor" />
        </marker>
        <marker
          id="circle-end"
          markerWidth="8"
          markerHeight="8"
          refX="4"
          refY="4"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <circle cx="4" cy="4" r="3" fill="none" stroke="currentColor" stroke-width="1" />
        </marker>
        <marker
          id="circle-start"
          markerWidth="8"
          markerHeight="8"
          refX="4"
          refY="4"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <circle cx="4" cy="4" r="3" fill="none" stroke="currentColor" stroke-width="1" />
        </marker>
        <marker
          id="diamond-end"
          markerWidth="10"
          markerHeight="10"
          refX="5"
          refY="5"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <polygon points="0 5, 5 0, 10 5, 5 10" fill="none" stroke="currentColor" stroke-width="1" />
        </marker>
        <marker
          id="diamond-start"
          markerWidth="10"
          markerHeight="10"
          refX="5"
          refY="5"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <polygon points="0 5, 5 0, 10 5, 5 10" fill="none" stroke="currentColor" stroke-width="1" />
        </marker>
      </defs>

      {/* Render existing connections */}
      <For each={props.connections}>
        {(connData) => {
          if (!connData) return null;

          const { connection, fromPos, toPos, path } = connData;
          const isHovered = props.hoveredConnection === connection.id;
          const isSelected = props.selectedConnection === connection.id;
          const style = props.getConnectionStyle(connection);

          // Reduce opacity and stroke width for selected connections
          const selectedOpacity = isSelected ? 0.3 : 1;
          const selectedStrokeWidth = isSelected ? Math.max(1, style.strokeWidth - 1) : style.strokeWidth;

          return (
            <g>
              {/* Connection shadow for depth */}
              <path
                d={path}
                stroke="rgba(0,0,0,0.1)"
                stroke-width={isHovered && !isSelected ? selectedStrokeWidth + 4 : selectedStrokeWidth + 2}
                fill="none"
                stroke-dasharray={style.strokeDasharray}
                opacity={selectedOpacity * 0.5}
                style={{
                  transform: 'translate(2px, 2px)',
                  'pointer-events': 'none'
                }}
              />

              {/* Main connection line */}
              <path
                d={path}
                stroke={isSelected ? "#8b5cf6" : isHovered ? "#7c3aed" : style.color}
                stroke-width={isHovered && !isSelected ? selectedStrokeWidth + 1 : selectedStrokeWidth}
                fill="none"
                stroke-dasharray={style.strokeDasharray}
                marker-start={props.getMarkerUrl(style.startArrow, 'start')}
                marker-end={props.getMarkerUrl(style.endArrow, 'end')}
                opacity={selectedOpacity}
                class="transition-all duration-200 cursor-pointer"
                style={{
                  'stroke-linecap': 'round',
                  color: isSelected ? "#8b5cf6" : isHovered ? "#7c3aed" : style.color,
                  'pointer-events': 'auto'
                }}
                onMouseEnter={() => props.onConnectionHover(connection.id)}
                onMouseLeave={() => props.onConnectionHover(null)}
                onClick={(e) => handleConnectionClick(connData, e)}
              />

              {/* Connection label */}
              <Show when={style.label}>
                <text
                  x={(fromPos.x + toPos.x) / 2}
                  y={(fromPos.y + toPos.y) / 2 - 8}
                  fill={style.color}
                  font-size="12"
                  font-family="system-ui"
                  text-anchor="middle"
                  class="select-none"
                  style={{
                    stroke: 'white',
                    'stroke-width': '2px',
                    'paint-order': 'stroke',
                    'font-weight': '500',
                    'pointer-events': 'none'
                  }}
                >
                  {style.label}
                </text>
              </Show>

              {/* Invisible wider area for easier hovering */}
              <path
                d={path}
                stroke="transparent"
                stroke-width="12"
                fill="none"
                opacity={selectedOpacity}
                style={{
                  cursor: 'pointer',
                  'pointer-events': 'auto'
                }}
                onMouseEnter={() => props.onConnectionHover(connection.id)}
                onMouseLeave={() => props.onConnectionHover(null)}
                onClick={(e) => handleConnectionClick(connData, e)}
              />
            </g>
          );
        }}
      </For>
    </>
  );
}
