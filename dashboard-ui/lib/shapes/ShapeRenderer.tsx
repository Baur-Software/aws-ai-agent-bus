/**
 * Shape Renderer Component
 *
 * Renders various SVG shapes for workflow canvas nodes
 */

export type ShapeType = 'circle' | 'triangle' | 'diamond' | 'arrow' | 'hexagon' | 'star' | 'heart' | 'rectangle' | 'sticky-note';

export interface ShapeRendererProps {
  shape: ShapeType;
  width: number;
  height: number;
  color: string; // Tailwind bg-color class like 'bg-blue-500'
}

const COLOR_MAP: Record<string, string> = {
  'gray-500': '#6b7280',
  'blue-500': '#3b82f6',
  'yellow-500': '#eab308',
  'purple-500': '#a855f7',
  'green-500': '#22c55e',
  'indigo-500': '#6366f1',
  'orange-500': '#f97316',
  'red-500': '#ef4444'
};

export function ShapeRenderer(props: ShapeRendererProps) {
  const colorClass = () => props.color.replace('bg-', '');
  const fillColor = () => COLOR_MAP[colorClass()] || '#6b7280';
  const halfWidth = () => props.width / 2;
  const halfHeight = () => props.height / 2;

  const renderShape = () => {
    switch (props.shape) {
      case 'circle':
        return (
          <svg width={props.width} height={props.height} class="absolute inset-0">
            <circle
              cx={halfWidth()}
              cy={halfHeight()}
              r={Math.min(halfWidth(), halfHeight()) - 2}
              fill={fillColor()}
              stroke="white"
              stroke-width="2"
            />
          </svg>
        );

      case 'triangle':
        return (
          <svg width={props.width} height={props.height} class="absolute inset-0">
            <polygon
              points={`${halfWidth()},4 ${props.width-4},${props.height-4} 4,${props.height-4}`}
              fill={fillColor()}
              stroke="white"
              stroke-width="2"
            />
          </svg>
        );

      case 'diamond':
        return (
          <svg width={props.width} height={props.height} class="absolute inset-0">
            <polygon
              points={`${halfWidth()},4 ${props.width-4},${halfHeight()} ${halfWidth()},${props.height-4} 4,${halfHeight()}`}
              fill={fillColor()}
              stroke="white"
              stroke-width="2"
            />
          </svg>
        );

      case 'arrow':
        return (
          <svg width={props.width} height={props.height} class="absolute inset-0">
            <polygon
              points={`4,${halfHeight()-8} ${props.width-20},${halfHeight()-8} ${props.width-20},4 ${props.width-4},${halfHeight()} ${props.width-20},${props.height-4} ${props.width-20},${halfHeight()+8} 4,${halfHeight()+8}`}
              fill={fillColor()}
              stroke="white"
              stroke-width="2"
            />
          </svg>
        );

      case 'hexagon': {
        const points = [];
        for (let i = 0; i < 6; i++) {
          const angle = (i * Math.PI) / 3;
          const x = halfWidth() + (halfWidth() - 4) * Math.cos(angle);
          const y = halfHeight() + (halfHeight() - 4) * Math.sin(angle);
          points.push(`${x},${y}`);
        }
        return (
          <svg width={props.width} height={props.height} class="absolute inset-0">
            <polygon
              points={points.join(' ')}
              fill={fillColor()}
              stroke="white"
              stroke-width="2"
            />
          </svg>
        );
      }

      case 'star': {
        const starPoints = [];
        for (let i = 0; i < 10; i++) {
          const angle = (i * Math.PI) / 5;
          const radius = i % 2 === 0 ? halfWidth() - 4 : (halfWidth() - 4) / 2;
          const x = halfWidth() + radius * Math.cos(angle - Math.PI / 2);
          const y = halfHeight() + radius * Math.sin(angle - Math.PI / 2);
          starPoints.push(`${x},${y}`);
        }
        return (
          <svg width={props.width} height={props.height} class="absolute inset-0">
            <polygon
              points={starPoints.join(' ')}
              fill={fillColor()}
              stroke="white"
              stroke-width="2"
            />
          </svg>
        );
      }

      case 'heart': {
        const r = Math.min(halfWidth(), halfHeight()) * 0.4;
        const leftCx = halfWidth() - r * 0.6;
        const rightCx = halfWidth() + r * 0.6;
        const cy = props.height * 0.35;
        return (
          <svg width={props.width} height={props.height} class="absolute inset-0">
            {/* Left circle */}
            <circle
              cx={leftCx}
              cy={cy}
              r={r}
              fill={fillColor()}
              stroke="white"
              stroke-width="2"
            />
            {/* Right circle */}
            <circle
              cx={rightCx}
              cy={cy}
              r={r}
              fill={fillColor()}
              stroke="white"
              stroke-width="2"
            />
            {/* Bottom triangle */}
            <path
              d={`M${leftCx - r},${cy} L${rightCx + r},${cy} L${halfWidth()},${props.height - 8} Z`}
              fill={fillColor()}
              stroke="white"
              stroke-width="2"
            />
          </svg>
        );
      }

      case 'rectangle':
        return (
          <svg width={props.width} height={props.height} class="absolute inset-0">
            <rect
              x="2"
              y="2"
              width={props.width - 4}
              height={props.height - 4}
              fill={fillColor()}
              stroke="white"
              stroke-width="2"
              rx="4"
            />
          </svg>
        );

      case 'sticky-note':
        return (
          <svg width={props.width} height={props.height} class="absolute inset-0">
            {/* Main note body */}
            <rect
              x="2"
              y="2"
              width={props.width - 4}
              height={props.height - 4}
              fill={fillColor()}
              stroke="#fbbf24"
              stroke-width="1"
              rx="2"
            />
            {/* Top fold corner */}
            <polygon
              points={`${props.width-15},2 ${props.width-2},2 ${props.width-2},15`}
              fill="#f59e0b"
              stroke="#fbbf24"
              stroke-width="1"
            />
            {/* Shadow effect */}
            <rect
              x="4"
              y="4"
              width={props.width - 8}
              height={props.height - 8}
              fill="none"
              stroke="rgba(0,0,0,0.1)"
              stroke-width="1"
              rx="2"
            />
          </svg>
        );

      default:
        return null;
    }
  };

  return <>{renderShape()}</>;
}
