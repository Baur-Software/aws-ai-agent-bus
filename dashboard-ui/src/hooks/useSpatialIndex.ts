import { createMemo } from 'solid-js';
import type { WorkflowNode } from '../components/workflow/core/WorkflowCanvas';

interface SpatialCell {
  nodes: Set<string>; // Node IDs in this cell
}

interface PortLocation {
  nodeId: string;
  port: string;
  type: 'input' | 'output';
  x: number;
  y: number;
}

/**
 * Spatial indexing for efficient nearby port lookups
 * Divides canvas into grid cells for O(1) spatial queries
 * Critical for performance with hundreds of nodes
 */
export function useSpatialIndex(
  nodes: WorkflowNode[],
  getPortPosition: (node: WorkflowNode, port: string, type: 'input' | 'output') => { x: number; y: number },
  cellSize: number = 100
) {
  return createMemo(() => {
    const grid = new Map<string, PortLocation[]>();

    // Build spatial index
    nodes.forEach(node => {
      // Index input ports
      node.inputs.forEach(port => {
        const pos = getPortPosition(node, port, 'input');
        const cellKey = getCellKey(pos.x, pos.y, cellSize);

        if (!grid.has(cellKey)) {
          grid.set(cellKey, []);
        }

        grid.get(cellKey)!.push({
          nodeId: node.id,
          port,
          type: 'input',
          x: pos.x,
          y: pos.y
        });
      });

      // Index output ports
      node.outputs.forEach(port => {
        const pos = getPortPosition(node, port, 'output');
        const cellKey = getCellKey(pos.x, pos.y, cellSize);

        if (!grid.has(cellKey)) {
          grid.set(cellKey, []);
        }

        grid.get(cellKey)!.push({
          nodeId: node.id,
          port,
          type: 'output',
          x: pos.x,
          y: pos.y
        });
      });
    });

    return {
      grid,
      cellSize,

      /**
       * Find nearby ports within maxDistance
       * Only checks ports in adjacent cells (9 cells max)
       */
      findNearby(x: number, y: number, maxDistance: number): PortLocation | null {
        const candidates: PortLocation[] = [];

        // Check current cell and 8 adjacent cells
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            const cellX = Math.floor(x / cellSize) + dx;
            const cellY = Math.floor(y / cellSize) + dy;
            const cellKey = `${cellX},${cellY}`;

            const cellPorts = grid.get(cellKey);
            if (cellPorts) {
              candidates.push(...cellPorts);
            }
          }
        }

        // Find closest port within maxDistance
        let closestPort: PortLocation | null = null;
        let closestDist = maxDistance;

        for (const port of candidates) {
          const dist = Math.sqrt(
            Math.pow(port.x - x, 2) + Math.pow(port.y - y, 2)
          );

          if (dist < closestDist) {
            closestDist = dist;
            closestPort = port;
          }
        }

        return closestPort;
      }
    };
  });
}

function getCellKey(x: number, y: number, cellSize: number): string {
  const cellX = Math.floor(x / cellSize);
  const cellY = Math.floor(y / cellSize);
  return `${cellX},${cellY}`;
}
