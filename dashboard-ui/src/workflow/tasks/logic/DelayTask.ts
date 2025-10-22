// Delay Task - Timer/Wait
// Pause workflow execution for a specified duration

import {
  WorkflowTask,
  WorkflowContext,
  ValidationResult,
  TaskConfigSchema,
  TaskDisplayInfo,
  Logger,
  NODE_CATEGORIES
} from '../../types';

export interface DelayInput {
  duration: number;
  unit: 'milliseconds' | 'seconds' | 'minutes' | 'hours';
  useContextDuration?: boolean;
  contextDurationField?: string;
}

export interface DelayOutput {
  delayedMs: number;
  startTime: string;
  endTime: string;
  actualDuration: number;
  timestamp: string;
}

export class DelayTask implements WorkflowTask<DelayInput, DelayOutput> {
  readonly type = 'delay';

  constructor(private logger?: Logger) {}

  async execute(input: DelayInput, context: WorkflowContext): Promise<DelayOutput> {
    const startTime = new Date();

    // Get duration
    let duration = input.duration;
    if (input.useContextDuration) {
      const contextField = input.contextDurationField || 'duration';
      const contextDuration = context.data[contextField];
      if (typeof contextDuration !== 'number') {
        throw new Error(`Context duration field '${contextField}' is not a number`);
      }
      duration = contextDuration;
    }

    // Convert to milliseconds
    const delayMs = this.convertToMilliseconds(duration, input.unit);

    this.logger?.info(`Delaying for ${delayMs}ms (${duration} ${input.unit})`);

    // Perform delay
    await this.sleep(delayMs);

    const endTime = new Date();
    const actualDuration = endTime.getTime() - startTime.getTime();

    const output: DelayOutput = {
      delayedMs: delayMs,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      actualDuration,
      timestamp: endTime.toISOString()
    };

    this.logger?.info(`Delay completed: ${actualDuration}ms actual`);

    // Store in context
    context.data.delayActualMs = actualDuration;
    context.data.delayRequestedMs = delayMs;

    return output;
  }

  private convertToMilliseconds(duration: number, unit: DelayInput['unit']): number {
    switch (unit) {
      case 'milliseconds':
        return duration;
      case 'seconds':
        return duration * 1000;
      case 'minutes':
        return duration * 60 * 1000;
      case 'hours':
        return duration * 60 * 60 * 1000;
      default:
        return duration;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  validate(input: DelayInput): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!input.useContextDuration && (input.duration === undefined || input.duration < 0)) {
      errors.push('Duration must be a positive number');
    }

    const maxDurations = {
      milliseconds: 600000, // 10 minutes
      seconds: 600,         // 10 minutes
      minutes: 60,          // 1 hour
      hours: 24             // 1 day
    };

    const maxDuration = maxDurations[input.unit] || Infinity;
    if (input.duration > maxDuration) {
      warnings.push(`Duration ${input.duration} ${input.unit} exceeds recommended maximum of ${maxDuration} ${input.unit}`);
    }

    if (input.duration === 0) {
      warnings.push('Delay duration is 0, no delay will occur');
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
      title: 'Delay',
      description: 'Wait/pause workflow execution for a specified duration',
      properties: {
        duration: {
          type: 'number',
          title: 'Duration',
          description: 'How long to delay',
          default: 1000,
          minimum: 0
        },
        unit: {
          type: 'string',
          title: 'Unit',
          description: 'Time unit for duration',
          enum: ['milliseconds', 'seconds', 'minutes', 'hours'],
          default: 'milliseconds'
        },
        useContextDuration: {
          type: 'boolean',
          title: 'Use Duration from Context',
          description: 'Get duration from workflow context',
          default: false
        },
        contextDurationField: {
          type: 'string',
          title: 'Context Duration Field',
          description: 'Field name in context containing duration',
          default: 'duration'
        }
      },
      required: ['duration', 'unit'],
      examples: [
        {
          duration: 5,
          unit: 'seconds'
        },
        {
          duration: 1,
          unit: 'minutes'
        },
        {
          useContextDuration: true,
          contextDurationField: 'waitTime',
          unit: 'seconds'
        }
      ]
    };
  }

  getDisplayInfo(): TaskDisplayInfo {
    return {
      category: NODE_CATEGORIES.DATA_PROCESSING,
      label: 'Delay',
      icon: '⏱️',
      color: 'bg-gray-500',
      description: 'Pause workflow execution for a specified time',
      tags: ['delay', 'wait', 'timer', 'pause', 'sleep']
    };
  }
}
