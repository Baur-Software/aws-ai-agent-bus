import { WorkflowTask, WorkflowContext } from '../../types/workflow.js';
import { TaskExecutionError } from '../../errors/TaskExecutionError.js';

export interface EventsHealthCheckInput {
  checkComponents?: string[]; // tables, eventVolume, subscriptions, rules
  verbose?: boolean;
}

export interface ComponentHealth {
  component: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  message?: string;
  details?: Record<string, any>;
}

export interface EventsHealthCheckOutput {
  overallStatus: 'healthy' | 'degraded' | 'unhealthy';
  components: ComponentHealth[];
  checkedAt: string;
  responseTime: number;
  success: boolean;
  timestamp: string;
}

export class EventsHealthCheckTask implements WorkflowTask<EventsHealthCheckInput, EventsHealthCheckOutput> {
  readonly type = 'events-health-check';

  constructor(
    private eventsService: any,
    private logger?: any
  ) {}

  async execute(input: EventsHealthCheckInput, context: WorkflowContext): Promise<EventsHealthCheckOutput> {
    const startTime = Date.now();

    try {
      const checkRequest: any = {};

      if (input.checkComponents && input.checkComponents.length > 0) {
        checkRequest.components = input.checkComponents;
      }

      if (input.verbose !== undefined) {
        checkRequest.verbose = input.verbose;
      }

      // Perform health check
      const result = await this.eventsService.healthCheck(checkRequest);

      const components: ComponentHealth[] = (result.components || []).map((comp: any) => ({
        component: comp.component,
        status: comp.status,
        message: comp.message,
        details: input.verbose ? comp.details : undefined
      }));

      // Determine overall status
      const overallStatus = this.determineOverallStatus(components);

      const responseTime = Date.now() - startTime;

      this.logger?.info('Event system health check completed', {
        overallStatus,
        componentCount: components.length,
        responseTime
      });

      return {
        overallStatus,
        components,
        checkedAt: result.checkedAt || new Date().toISOString(),
        responseTime,
        success: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;

      this.logger?.error('Failed to perform health check', {
        error: error instanceof Error ? error.message : String(error),
        responseTime
      });

      throw new TaskExecutionError(
        this.type,
        context.nodeId || 'unknown',
        `Failed to perform health check: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  private determineOverallStatus(components: ComponentHealth[]): 'healthy' | 'degraded' | 'unhealthy' {
    if (components.length === 0) {
      return 'healthy';
    }

    const hasUnhealthy = components.some(c => c.status === 'unhealthy');
    const hasDegraded = components.some(c => c.status === 'degraded');

    if (hasUnhealthy) {
      return 'unhealthy';
    } else if (hasDegraded) {
      return 'degraded';
    } else {
      return 'healthy';
    }
  }

  async validate(input: EventsHealthCheckInput): Promise<{ valid: boolean; errors: string[]; warnings: string[] }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (input.checkComponents !== undefined) {
      if (!Array.isArray(input.checkComponents)) {
        errors.push('checkComponents must be an array');
      } else {
        const validComponents = ['tables', 'eventVolume', 'subscriptions', 'rules'];
        for (const component of input.checkComponents) {
          if (typeof component !== 'string') {
            errors.push('Each component must be a string');
          } else if (!validComponents.includes(component)) {
            warnings.push(`Unknown component: ${component}. Valid components: ${validComponents.join(', ')}`);
          }
        }
      }
    }

    if (input.verbose !== undefined && typeof input.verbose !== 'boolean') {
      errors.push('verbose must be a boolean');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  getSchema() {
    return {
      input: {
        type: 'object',
        properties: {
          checkComponents: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['tables', 'eventVolume', 'subscriptions', 'rules']
            },
            description: 'Specific components to check (checks all if not specified)',
            default: ['tables', 'eventVolume', 'subscriptions', 'rules']
          },
          verbose: {
            type: 'boolean',
            description: 'Include detailed information in health check results',
            default: false
          }
        }
      },
      output: {
        type: 'object',
        properties: {
          overallStatus: {
            type: 'string',
            enum: ['healthy', 'degraded', 'unhealthy']
          },
          components: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                component: { type: 'string' },
                status: {
                  type: 'string',
                  enum: ['healthy', 'degraded', 'unhealthy']
                },
                message: { type: 'string' },
                details: { type: 'object' }
              }
            }
          },
          checkedAt: { type: 'string', format: 'date-time' },
          responseTime: { type: 'number' },
          success: { type: 'boolean' },
          timestamp: { type: 'string', format: 'date-time' }
        }
      }
    };
  }

  getDisplayInfo() {
    return {
      name: 'Events Health Check',
      description: 'Perform health checks on event system components (DynamoDB tables, event volume)',
      category: 'Events',
      icon: 'health',
      color: '#9C27B0',
      tags: ['events', 'health', 'monitoring', 'diagnostics', 'system', 'status']
    };
  }
}
