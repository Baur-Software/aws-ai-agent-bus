import { WorkflowTask, WorkflowContext, TaskExecutionError, ValidationResult } from '../../types';

export interface EventsHealthCheckInput {
  checkComponents?: string[];
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
      const request: any = {};
      if (input.checkComponents) request.components = input.checkComponents;
      if (input.verbose !== undefined) request.verbose = input.verbose;

      const result = await this.eventsService.healthCheck(request);

      const components: ComponentHealth[] = (result.components || []).map((comp: any) => ({
        component: comp.component,
        status: comp.status,
        message: comp.message,
        details: input.verbose ? comp.details : undefined
      }));

      const overallStatus = this.determineOverallStatus(components);
      const responseTime = Date.now() - startTime;

      this.logger?.info?.('Health check completed', { overallStatus, responseTime });

      return {
        overallStatus,
        components,
        checkedAt: result.checkedAt || new Date().toISOString(),
        responseTime,
        success: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger?.error?.('Failed to perform health check', { error });

      throw new TaskExecutionError(`Failed to perform health check: ${error instanceof Error ? error.message : String(error)}`, this.type, context.nodeId || 'unknown', error instanceof Error ? error : undefined
      );
    }
  }

  private determineOverallStatus(components: ComponentHealth[]): 'healthy' | 'degraded' | 'unhealthy' {
    if (components.length === 0) return 'healthy';

    const hasUnhealthy = components.some(c => c.status === 'unhealthy');
    const hasDegraded = components.some(c => c.status === 'degraded');

    if (hasUnhealthy) return 'unhealthy';
    if (hasDegraded) return 'degraded';
    return 'healthy';
  }

  validate(input: EventsHealthCheckInput): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (input.checkComponents !== undefined && !Array.isArray(input.checkComponents)) {
      errors.push('checkComponents must be an array');
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  getSchema() {
    return {
      input: {
        type: 'object',
        properties: {
          checkComponents: {
            type: 'array',
            items: { type: 'string', enum: ['tables', 'eventVolume', 'subscriptions', 'rules'] },
            description: 'Components to check'
          },
          verbose: { type: 'boolean', description: 'Include detailed info', default: false }
        }
      },
      output: {
        type: 'object',
        properties: {
          overallStatus: { type: 'string', enum: ['healthy', 'degraded', 'unhealthy'] },
          components: { type: 'array', items: { type: 'object' } },
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
      description: 'Perform health checks on event system components',
      category: 'Events',
      icon: 'health',
      color: '#9C27B0',
      tags: ['events', 'health', 'monitoring', 'diagnostics']
    };
  }
}
