import { createMemo } from 'solid-js';
import type { WorkflowNode } from '../components/workflow/core/WorkflowCanvas';

/**
 * Performance optimization hook that creates a Map for O(1) node lookups
 * instead of O(n) array.find() operations
 */
export function useNodeLookup(nodes: WorkflowNode[]) {
  return createMemo(() => {
    const lookup = new Map<string, WorkflowNode>();
    nodes.forEach(node => lookup.set(node.id, node));
    return lookup;
  });
}
