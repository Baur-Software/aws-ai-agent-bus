import { WorkflowTask, WorkflowContext } from '../../types/workflow';
import { TaskExecutionError } from '../../errors/TaskExecutionError';

export interface EventsAnalyticsInput {
  metrics?: string[];
  startTime?: string;
  endTime?: string;
  timeRange?: string;
  granularity?: 'hourly' | 'daily';
  groupBy?: 'hour' | 'day' | 'week';
  organizationId?: string;
  userId?: string;
}

export interface EventsAnalyticsOutput {
  metrics: {
    volume?: any[];
    topSources?: any[];
    priority?: any[];
    eventTypes?: any[];
  };
  totalEvents: number;
  timeRange: { start: string; end: string };
  success: boolean;
  timestamp: string;
}

export class EventsAnalyticsTask implements WorkflowTask<EventsAnalyticsInput, EventsAnalyticsOutput> {
  readonly type = 'events-analytics';

  constructor(
    private eventsService: any,
    private logger?: any
  ) {}

  async execute(input: EventsAnalyticsInput, context: WorkflowContext): Promise<EventsAnalyticsOutput> {
    const startTime = Date.now();

    try {
      const request: any = {
        metrics: input.metrics || ['volume', 'topSources', 'priority', 'eventTypes'],
        timeRange: input.timeRange || '24h'
      };

      if (input.startTime) request.startTime = input.startTime;
      if (input.endTime) request.endTime = input.endTime;
      if (input.granularity) request.granularity = input.granularity;
      if (input.groupBy) request.groupBy = input.groupBy;
      if (input.organizationId) request.organizationId = input.organizationId;
      if (input.userId) request.userId = input.userId;

      const result = await this.eventsService.analytics(request);

      const executionTime = Date.now() - startTime;
      this.logger?.info?.('Event analytics retrieved', { totalEvents: result.totalEvents, executionTime });

      return {
        metrics: result.metrics || {},
        totalEvents: result.totalEvents || 0,
        timeRange: result.timeRange || {
          start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          end: new Date().toISOString()
        },
        success: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger?.error?.('Failed to retrieve analytics', { error });

      throw new TaskExecutionError(
        this.type,
        context.nodeId || 'unknown',
        `Failed to retrieve event analytics: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  async validate(input: EventsAnalyticsInput): Promise<{ valid: boolean; errors: string[]; warnings: string[] }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    const validMetrics = ['volume', 'topSources', 'priority', 'eventTypes'];
    if (input.metrics) {
      for (const metric of input.metrics) {
        if (!validMetrics.includes(metric)) {
          errors.push(`Invalid metric: ${metric}`);
        }
      }
    }

    if (input.startTime && input.endTime) {
      if (new Date(input.startTime) >= new Date(input.endTime)) {
        errors.push('startTime must be before endTime');
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  getSchema() {
    return {
      input: {
        type: 'object',
        properties: {
          metrics: {
            type: 'array',
            items: { type: 'string', enum: ['volume', 'topSources', 'priority', 'eventTypes'] },
            default: ['volume', 'topSources', 'priority', 'eventTypes']
          },
          timeRange: { type: 'string', enum: ['1h', '24h', '7d', '30d'], default: '24h' },
          startTime: { type: 'string', format: 'date-time' },
          endTime: { type: 'string', format: 'date-time' },
          granularity: { type: 'string', enum: ['hourly', 'daily'] },
          groupBy: { type: 'string', enum: ['hour', 'day', 'week'] },
          organizationId: { type: 'string' },
          userId: { type: 'string' }
        }
      },
      output: {
        type: 'object',
        properties: {
          metrics: { type: 'object' },
          totalEvents: { type: 'number' },
          timeRange: { type: 'object' },
          success: { type: 'boolean' },
          timestamp: { type: 'string', format: 'date-time' }
        }
      }
    };
  }

  getDisplayInfo() {
    return {
      name: 'Events Analytics',
      description: 'Get analytics and aggregations for events',
      category: 'Events',
      icon: 'chart',
      color: '#9C27B0',
      tags: ['events', 'analytics', 'metrics', 'monitoring']
    };
  }
}
