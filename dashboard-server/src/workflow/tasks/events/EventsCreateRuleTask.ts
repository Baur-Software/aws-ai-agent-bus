import { WorkflowTask, WorkflowContext } from '../../types/workflow.js';
import { TaskExecutionError } from '../../errors/TaskExecutionError.js';

export interface EventsCreateRuleInput {
  name: string;
  pattern: Record<string, any>; // EventBridge event pattern
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
      const ruleRequest = {
        name: input.name,
        pattern: input.pattern,
        description: input.description,
        enabled: input.enabled !== undefined ? input.enabled : true
      };

      // Create event rule
      const result = await this.eventsService.createRule(ruleRequest);

      const executionTime = Date.now() - startTime;

      this.logger?.info('Event rule created successfully', {
        ruleId: result.ruleId,
        name: input.name,
        enabled: ruleRequest.enabled,
        executionTime
      });

      return {
        ruleId: result.ruleId,
        name: input.name,
        pattern: input.pattern,
        description: input.description,
        enabled: ruleRequest.enabled,
        success: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;

      this.logger?.error('Failed to create event rule', {
        name: input.name,
        error: error instanceof Error ? error.message : String(error),
        executionTime
      });

      throw new TaskExecutionError(
        this.type,
        context.nodeId || 'unknown',
        `Failed to create event rule: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  async validate(input: EventsCreateRuleInput): Promise<{ valid: boolean; errors: string[]; warnings: string[] }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!input.name) {
      errors.push('Rule name is required');
    } else if (typeof input.name !== 'string') {
      errors.push('Rule name must be a string');
    } else if (input.name.length === 0) {
      errors.push('Rule name cannot be empty');
    } else if (input.name.length > 64) {
      errors.push('Rule name cannot exceed 64 characters');
    }

    if (!input.pattern) {
      errors.push('Event pattern is required');
    } else if (typeof input.pattern !== 'object' || Array.isArray(input.pattern)) {
      errors.push('Event pattern must be an object');
    } else if (Object.keys(input.pattern).length === 0) {
      errors.push('Event pattern cannot be empty');
    }

    if (input.description !== undefined) {
      if (typeof input.description !== 'string') {
        errors.push('Description must be a string');
      } else if (input.description.length > 512) {
        warnings.push('Description exceeds 512 characters and may be truncated');
      }
    }

    if (input.enabled !== undefined && typeof input.enabled !== 'boolean') {
      errors.push('Enabled must be a boolean');
    }

    // Validate event pattern structure
    if (input.pattern) {
      this.validateEventPattern(input.pattern, errors, warnings);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  private validateEventPattern(pattern: Record<string, any>, errors: string[], warnings: string[]): void {
    // Check for common EventBridge pattern fields
    const validFields = [
      'source',
      'detail-type',
      'detail',
      'resources',
      'id',
      'time',
      'region',
      'account'
    ];

    const patternFields = Object.keys(pattern);
    const unknownFields = patternFields.filter(field => !validFields.includes(field));

    if (unknownFields.length > 0) {
      warnings.push(`Unknown pattern fields: ${unknownFields.join(', ')}`);
    }

    // Validate pattern values
    for (const [key, value] of Object.entries(pattern)) {
      if (Array.isArray(value)) {
        // Array patterns are valid (e.g., ["value1", "value2"])
        continue;
      } else if (typeof value === 'object' && value !== null) {
        // Nested patterns are valid (e.g., {"numeric": [">", 0]})
        continue;
      } else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        // Simple values need to be wrapped in arrays for EventBridge
        warnings.push(`Pattern field "${key}" should be wrapped in an array for EventBridge compatibility`);
      }
    }
  }

  getSchema() {
    return {
      input: {
        type: 'object',
        required: ['name', 'pattern'],
        properties: {
          name: {
            type: 'string',
            description: 'Unique name for the rule',
            minLength: 1,
            maxLength: 64
          },
          pattern: {
            type: 'object',
            description: 'EventBridge event pattern for matching events',
            examples: [
              {
                'source': ['workflow.execution'],
                'detail-type': ['Workflow Failed']
              },
              {
                'detail': {
                  'priority': ['critical', 'high']
                }
              }
            ]
          },
          description: {
            type: 'string',
            description: 'Optional description of the rule',
            maxLength: 512
          },
          enabled: {
            type: 'boolean',
            description: 'Whether the rule is enabled',
            default: true
          }
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
      tags: ['events', 'rules', 'filters', 'automation', 'eventbridge', 'monitoring']
    };
  }
}
