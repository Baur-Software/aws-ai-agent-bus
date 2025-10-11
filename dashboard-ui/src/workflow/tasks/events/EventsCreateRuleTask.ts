import { WorkflowTask, WorkflowContext, TaskExecutionError, ValidationResult } from '../../types';

export interface EventsCreateRuleInput {
  name: string;
  pattern: Record<string, any>;
  description?: string;
  enabled?: boolean;
}

export interface EventsCreateRuleOutput {
  ruleId: string;
  name: string;
  pattern: Record<string, any>;
  description?: string;
  enabled: boolean;
  success: boolean;
  timestamp: string;
}

export class EventsCreateRuleTask implements WorkflowTask<EventsCreateRuleInput, EventsCreateRuleOutput> {
  readonly type = 'events-create-rule';

  constructor(
    private eventsService: any,
    private logger?: any
  ) {}

  async execute(input: EventsCreateRuleInput, context: WorkflowContext): Promise<EventsCreateRuleOutput> {
    const startTime = Date.now();

    try {
      const request = {
        name: input.name,
        pattern: input.pattern,
        description: input.description,
        enabled: input.enabled !== undefined ? input.enabled : true
      };

      const result = await this.eventsService.createRule(request);

      const executionTime = Date.now() - startTime;
      this.logger?.info?.('Event rule created', { ruleId: result.ruleId, executionTime });

      return {
        ruleId: result.ruleId,
        name: input.name,
        pattern: input.pattern,
        description: input.description,
        enabled: request.enabled,
        success: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger?.error?.('Failed to create event rule', { error });

      throw new TaskExecutionError(`Failed to create event rule: ${error instanceof Error ? error.message : String(error)}`, this.type, context.nodeId || 'unknown', error instanceof Error ? error : undefined
      );
    }
  }

  validate(input: EventsCreateRuleInput): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!input.name) errors.push('Rule name is required');
    if (!input.pattern) errors.push('Event pattern is required');

    if (input.name && input.name.length > 64) {
      errors.push('Rule name cannot exceed 64 characters');
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  getSchema() {
    return {
      input: {
        type: 'object',
        required: ['name', 'pattern'],
        properties: {
          name: { type: 'string', description: 'Unique rule name', maxLength: 64 },
          pattern: { type: 'object', description: 'EventBridge event pattern' },
          description: { type: 'string', description: 'Optional description' },
          enabled: { type: 'boolean', description: 'Enabled state', default: true }
        }
      },
      output: {
        type: 'object',
        properties: {
          ruleId: { type: 'string' },
          name: { type: 'string' },
          pattern: { type: 'object' },
          description: { type: 'string' },
          enabled: { type: 'boolean' },
          success: { type: 'boolean' },
          timestamp: { type: 'string', format: 'date-time' }
        }
      }
    };
  }

  getDisplayInfo() {
    return {
      name: 'Create Event Rule',
      description: 'Create an event filtering rule for automated processing',
      category: 'Events',
      icon: 'filter',
      color: '#9C27B0',
      tags: ['events', 'rules', 'filters', 'automation']
    };
  }
}
