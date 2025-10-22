/**
 * Logic & Control Flow Node Definitions
 */

import type { NodeDefinition } from '../NodeRegistry';

export const LOGIC_NODES: NodeDefinition[] = [
  {
    type: 'conditional',
    name: 'Conditional (If/Else)',
    description: 'Branch based on condition',
    category: 'logic',
    subcategory: 'conditional',
    icon: '🔀',
    color: 'bg-amber-500',
    hasDedicatedComponent: true,
    componentName: 'ConditionalNodeConfig',
    defaultConfig: {
      conditions: [
        {
          field: '',
          operator: 'equals',
          value: '',
          logicalOperator: 'AND'
        }
      ]
    },
    sampleOutput: {
      conditionMet: true,
      evaluatedConditions: [
        { field: 'status', operator: 'equals', value: 'active', result: true }
      ],
      branch: 'true'
    }
  },
  {
    type: 'switch',
    name: 'Switch',
    description: 'Multi-way branching',
    category: 'logic',
    subcategory: 'switch',
    icon: '🔃',
    color: 'bg-orange-500',
    hasDedicatedComponent: true,
    componentName: 'SwitchNodeConfig',
    defaultConfig: {
      cases: [
        {
          value: '',
          output: 'case1'
        }
      ],
      defaultCase: 'default'
    },
    sampleOutput: {
      matchedCase: 'case1',
      switchValue: 'active',
      output: 'case1'
    }
  },
  {
    type: 'loop',
    name: 'Loop',
    description: 'Iterate over items',
    category: 'logic',
    subcategory: 'loop',
    icon: '🔁',
    color: 'bg-yellow-500',
    fields: [
      {
        key: 'items',
        label: 'Items to Loop',
        type: 'json',
        required: true,
        placeholder: '["item1", "item2", "item3"]',
        help: 'Array of items to iterate over'
      },
      {
        key: 'maxIterations',
        label: 'Max Iterations',
        type: 'number',
        defaultValue: 100,
        help: 'Maximum number of iterations (safety limit)'
      },
      {
        key: 'continueOnError',
        label: 'Continue on Error',
        type: 'checkbox',
        defaultValue: false,
        help: 'Continue processing remaining items if one fails'
      }
    ],
    defaultConfig: {
      maxIterations: 100,
      continueOnError: false
    },
    sampleOutput: {
      totalItems: 3,
      processedItems: 3,
      failedItems: 0,
      results: [
        { index: 0, item: 'item1', status: 'success' },
        { index: 1, item: 'item2', status: 'success' },
        { index: 2, item: 'item3', status: 'success' }
      ]
    }
  },
  {
    type: 'filter',
    name: 'Filter',
    description: 'Filter array items',
    category: 'logic',
    subcategory: 'conditional',
    icon: '🔍',
    color: 'bg-teal-500',
    fields: [
      {
        key: 'array',
        label: 'Input Array',
        type: 'json',
        required: true,
        help: 'Array to filter'
      },
      {
        key: 'field',
        label: 'Field to Check',
        type: 'text',
        required: true,
        placeholder: 'status',
        help: 'Field name to evaluate'
      },
      {
        key: 'operator',
        label: 'Operator',
        type: 'select',
        required: true,
        defaultValue: 'equals',
        options: [
          { label: 'Equals', value: 'equals' },
          { label: 'Not Equals', value: 'notEquals' },
          { label: 'Greater Than', value: 'greaterThan' },
          { label: 'Less Than', value: 'lessThan' },
          { label: 'Contains', value: 'contains' },
          { label: 'Exists', value: 'exists' }
        ]
      },
      {
        key: 'value',
        label: 'Value',
        type: 'text',
        help: 'Value to compare against'
      }
    ],
    defaultConfig: {
      operator: 'equals'
    },
    sampleOutput: {
      inputCount: 10,
      outputCount: 3,
      filtered: [
        { id: 1, status: 'active' },
        { id: 3, status: 'active' },
        { id: 7, status: 'active' }
      ]
    }
  },
  {
    type: 'delay',
    name: 'Delay',
    description: 'Wait before continuing',
    category: 'logic',
    subcategory: 'conditional',
    icon: '⏱️',
    color: 'bg-gray-500',
    fields: [
      {
        key: 'duration',
        label: 'Duration',
        type: 'number',
        required: true,
        defaultValue: 1000,
        help: 'Delay duration in milliseconds'
      },
      {
        key: 'unit',
        label: 'Unit',
        type: 'select',
        defaultValue: 'milliseconds',
        options: [
          { label: 'Milliseconds', value: 'milliseconds' },
          { label: 'Seconds', value: 'seconds' },
          { label: 'Minutes', value: 'minutes' },
          { label: 'Hours', value: 'hours' }
        ]
      }
    ],
    defaultConfig: {
      duration: 1000,
      unit: 'milliseconds'
    },
    sampleOutput: {
      delayedMs: 1000,
      startTime: '2025-10-07T10:00:00Z',
      endTime: '2025-10-07T10:00:01Z'
    }
  },
  {
    type: 'parallel',
    name: 'Parallel Execution',
    description: 'Execute multiple branches simultaneously',
    category: 'logic',
    subcategory: 'loop',
    icon: '⚡',
    color: 'bg-purple-500',
    fields: [
      {
        key: 'branches',
        label: 'Number of Branches',
        type: 'number',
        required: true,
        defaultValue: 2,
        help: 'How many parallel branches to execute'
      },
      {
        key: 'waitForAll',
        label: 'Wait for All',
        type: 'checkbox',
        defaultValue: true,
        help: 'Wait for all branches to complete before continuing'
      },
      {
        key: 'failOnError',
        label: 'Fail on Any Error',
        type: 'checkbox',
        defaultValue: false,
        help: 'Fail entire node if any branch fails'
      }
    ],
    defaultConfig: {
      branches: 2,
      waitForAll: true,
      failOnError: false
    },
    sampleOutput: {
      totalBranches: 2,
      completedBranches: 2,
      failedBranches: 0,
      results: [
        { branch: 0, status: 'success', duration: 123 },
        { branch: 1, status: 'success', duration: 145 }
      ]
    }
  }
];
