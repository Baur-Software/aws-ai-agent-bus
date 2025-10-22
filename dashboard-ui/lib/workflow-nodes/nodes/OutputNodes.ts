/**
 * Output Node Definitions
 * Workflow output/result nodes
 */

import type { NodeDefinition } from '../NodeRegistry';

export const OUTPUT_NODES: NodeDefinition[] = [
  {
    type: 'output',
    name: 'Workflow Output',
    description: 'Final workflow result',
    category: 'actions',
    subcategory: 'output',
    icon: '📤',
    color: 'bg-purple-500',
    fields: [
      {
        key: 'outputData',
        label: 'Output Data',
        type: 'json',
        help: 'Data to output from the workflow'
      },
      {
        key: 'summary',
        label: 'Summary Message',
        type: 'textarea',
        placeholder: 'Workflow completed successfully',
        help: 'Human-readable summary of results'
      }
    ],
    sampleOutput: {
      output: {
        status: 'completed',
        results: {
          processed: 42,
          successful: 40,
          failed: 2
        }
      },
      summary: 'Workflow completed successfully'
    }
  }
];
