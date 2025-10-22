// Switch Task - Multi-way Branching
// Evaluate a value against multiple cases and route to matching branch

import {
  WorkflowTask,
  WorkflowContext,
  ValidationResult,
  TaskConfigSchema,
  TaskDisplayInfo,
  Logger,
  TaskExecutionError,
  NODE_CATEGORIES
} from '../../types';

export interface SwitchInput {
  switchValue?: any;
  useContextValue?: boolean;
  contextValueField?: string;
  cases: Array<{
    value: any;
    output: string;
    matchType?: 'exact' | 'contains' | 'regex' | 'range';
    rangeMin?: number;
    rangeMax?: number;
  }>;
  defaultCase?: string;
  caseSensitive?: boolean;
}

export interface SwitchOutput {
  matchedCase: string | null;
  switchValue: any;
  output: string;
  caseIndex: number | null;
  timestamp: string;
}

export class SwitchTask implements WorkflowTask<SwitchInput, SwitchOutput> {
  readonly type = 'switch';

  constructor(private logger?: Logger) {}

  async execute(input: SwitchInput, context: WorkflowContext): Promise<SwitchOutput> {
    // Get value to switch on
    let switchValue = input.switchValue;
    if (input.useContextValue) {
      const contextField = input.contextValueField || 'value';
      switchValue = context.data[contextField];
      if (switchValue === undefined) {
        throw new TaskExecutionError(
          `Context field '${contextField}' not found`,
          this.type,
          context.nodeId,
          input
        );
      }
    }

    this.logger?.info(`Evaluating switch value: ${switchValue}`);

    // Try to match against cases
    let matchedCaseIndex: number | null = null;
    let matchedOutput: string | null = null;

    for (let i = 0; i < input.cases.length; i++) {
      const caseItem = input.cases[i];

      if (this.matchesCase(switchValue, caseItem, input.caseSensitive)) {
        matchedCaseIndex = i;
        matchedOutput = caseItem.output;
        this.logger?.info(`Matched case ${i}: ${caseItem.value} -> ${caseItem.output}`);
        break;
      }
    }

    // Use default case if no match
    if (matchedCaseIndex === null && input.defaultCase) {
      matchedOutput = input.defaultCase;
      this.logger?.info(`No match, using default case: ${input.defaultCase}`);
    }

    if (matchedOutput === null) {
      throw new TaskExecutionError(
        `No matching case found for value: ${switchValue} and no default case specified`,
        this.type,
        context.nodeId,
        input
      );
    }

    const output: SwitchOutput = {
      matchedCase: matchedCaseIndex !== null ? input.cases[matchedCaseIndex].value : null,
      switchValue,
      output: matchedOutput,
      caseIndex: matchedCaseIndex,
      timestamp: new Date().toISOString()
    };

    // Store in context
    context.data.switchOutput = matchedOutput;
    context.data.switchValue = switchValue;
    context.data.switchCaseIndex = matchedCaseIndex;

    return output;
  }

  private matchesCase(
    value: any,
    caseItem: SwitchInput['cases'][0],
    caseSensitive: boolean = true
  ): boolean {
    const matchType = caseItem.matchType || 'exact';

    switch (matchType) {
      case 'exact':
        if (typeof value === 'string' && typeof caseItem.value === 'string' && !caseSensitive) {
          return value.toLowerCase() === caseItem.value.toLowerCase();
        }
        return value == caseItem.value; // Loose equality

      case 'contains':
        if (typeof value === 'string' && typeof caseItem.value === 'string') {
          const searchValue = caseSensitive ? value : value.toLowerCase();
          const caseValue = caseSensitive ? caseItem.value : caseItem.value.toLowerCase();
          return searchValue.includes(caseValue);
        }
        if (Array.isArray(value)) {
          return value.includes(caseItem.value);
        }
        return false;

      case 'regex':
        if (typeof value === 'string' && typeof caseItem.value === 'string') {
          try {
            const flags = caseSensitive ? '' : 'i';
            const regex = new RegExp(caseItem.value, flags);
            return regex.test(value);
          } catch (error) {
            this.logger?.warn(`Invalid regex pattern: ${caseItem.value}`);
            return false;
          }
        }
        return false;

      case 'range':
        if (typeof value === 'number' && caseItem.rangeMin !== undefined && caseItem.rangeMax !== undefined) {
          return value >= caseItem.rangeMin && value <= caseItem.rangeMax;
        }
        return false;

      default:
        this.logger?.warn(`Unknown match type: ${matchType}`);
        return false;
    }
  }

  validate(input: SwitchInput): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!input.useContextValue && input.switchValue === undefined) {
      errors.push('Switch value is required when not using context value');
    }

    if (!input.cases || input.cases.length === 0) {
      errors.push('At least one case is required');
    }

    input.cases?.forEach((caseItem, index) => {
      if (caseItem.value === undefined) {
        errors.push(`Case ${index + 1}: value is required`);
      }
      if (!caseItem.output) {
        errors.push(`Case ${index + 1}: output is required`);
      }
      if (caseItem.matchType === 'range') {
        if (caseItem.rangeMin === undefined || caseItem.rangeMax === undefined) {
          errors.push(`Case ${index + 1}: rangeMin and rangeMax required for range match`);
        }
      }
    });

    if (!input.defaultCase) {
      warnings.push('No default case specified - switch will fail if no case matches');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  getSchema(): TaskConfigSchema {
    return {
      type: 'object',
      title: 'Switch',
      description: 'Multi-way branching based on value',
      properties: {
        switchValue: {
          type: 'string',
          title: 'Switch Value',
          description: 'Value to evaluate against cases'
        },
        useContextValue: {
          type: 'boolean',
          title: 'Use Value from Context',
          description: 'Get switch value from workflow context',
          default: false
        },
        contextValueField: {
          type: 'string',
          title: 'Context Value Field',
          description: 'Field name in context containing switch value',
          default: 'value'
        },
        cases: {
          type: 'array',
          title: 'Cases',
          description: 'List of cases to match against',
          items: {
            type: 'object',
            properties: {
              value: {
                type: 'string',
                title: 'Case Value',
                description: 'Value to match'
              },
              output: {
                type: 'string',
                title: 'Output',
                description: 'Output identifier for this case'
              },
              matchType: {
                type: 'string',
                title: 'Match Type',
                description: 'How to match the value',
                enum: ['exact', 'contains', 'regex', 'range'],
                default: 'exact'
              },
              rangeMin: {
                type: 'number',
                title: 'Range Min',
                description: 'Minimum value for range match'
              },
              rangeMax: {
                type: 'number',
                title: 'Range Max',
                description: 'Maximum value for range match'
              }
            }
          }
        },
        defaultCase: {
          type: 'string',
          title: 'Default Case',
          description: 'Output if no case matches'
        },
        caseSensitive: {
          type: 'boolean',
          title: 'Case Sensitive',
          description: 'Whether string matching is case sensitive',
          default: true
        }
      },
      required: ['cases'],
      examples: [
        {
          switchValue: 'active',
          cases: [
            { value: 'active', output: 'case1', matchType: 'exact' },
            { value: 'pending', output: 'case2', matchType: 'exact' },
            { value: 'inactive', output: 'case3', matchType: 'exact' }
          ],
          defaultCase: 'default'
        }
      ]
    };
  }

  getDisplayInfo(): TaskDisplayInfo {
    return {
      category: NODE_CATEGORIES.DATA_PROCESSING,
      label: 'Switch',
      icon: '🔃',
      color: 'bg-orange-500',
      description: 'Multi-way branching based on value matching',
      tags: ['switch', 'branch', 'case', 'routing', 'control-flow']
    };
  }
}
