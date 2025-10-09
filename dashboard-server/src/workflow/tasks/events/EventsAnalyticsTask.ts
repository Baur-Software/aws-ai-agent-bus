import { WorkflowTask, WorkflowContext } from '../../types/workflow.js';
import { TaskExecutionError } from '../../errors/TaskExecutionError.js';

export interface EventsAnalyticsInput {
  metrics?: string[]; // volume, topSources, priority, eventTypes
  startTime?: string;
  endTime?: string;
  timeRange?: string; // 1h, 24h, 7d, 30d
  granularity?: 'hourly' | 'daily';
  groupBy?: 'hour' | 'day' | 'week';
  organizationId?: string;
  userId?: string;
}

export interface VolumeMetric {
  timestamp: string;
  count: number;
  period: string;
}

export interface TopSource {
  source: string;
  count: number;
  percentage: number;
}

export interface PriorityDistribution {
  priority: string;
  count: number;
  percentage: number;
}

export interface EventTypeDistribution {
  eventType: string;
  count: number;
  percentage: number;
}

export interface EventsAnalyticsOutput {
  metrics: {
    volume?: VolumeMetric[];
    topSources?: TopSource[];
    priority?: PriorityDistribution[];
    eventTypes?: EventTypeDistribution[];
  };
  totalEvents: number;
  timeRange: {
    start: string;
    end: string;
  };
  granularity?: string;
  organizationId?: string;
  userId?: string;
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
      // Build analytics request
      const analyticsRequest: any = {};

      if (input.metrics && input.metrics.length > 0) {
        analyticsRequest.metrics = input.metrics;
      } else {
        analyticsRequest.metrics = ['volume', 'topSources', 'priority', 'eventTypes'];
      }

      if (input.timeRange) {
        analyticsRequest.timeRange = input.timeRange;
      } else if (input.startTime && input.endTime) {
        analyticsRequest.startTime = input.startTime;
        analyticsRequest.endTime = input.endTime;
      } else {
        analyticsRequest.timeRange = '24h'; // Default to 24 hours
      }

      if (input.granularity) {
        analyticsRequest.granularity = input.granularity;
      }

      if (input.groupBy) {
        analyticsRequest.groupBy = input.groupBy;
      }

      if (input.organizationId) {
        analyticsRequest.organizationId = input.organizationId;
      }

      if (input.userId) {
        analyticsRequest.userId = input.userId;
      }

      // Get analytics from events service
      const result = await this.eventsService.analytics(analyticsRequest);

      const executionTime = Date.now() - startTime;

      this.logger?.info('Event analytics retrieved successfully', {
        metrics: analyticsRequest.metrics,
        totalEvents: result.totalEvents || 0,
        timeRange: result.timeRange,
        executionTime
      });

      return {
        metrics: {
          volume: result.metrics?.volume || [],
          topSources: result.metrics?.topSources || [],
          priority: result.metrics?.priority || [],
          eventTypes: result.metrics?.eventTypes || []
        },
        totalEvents: result.totalEvents || 0,
        timeRange: result.timeRange || {
          start: input.startTime || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          end: input.endTime || new Date().toISOString()
        },
        granularity: input.granularity,
        organizationId: input.organizationId,
        userId: input.userId,
        success: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;

      this.logger?.error('Failed to retrieve event analytics', {
        error: error instanceof Error ? error.message : String(error),
        executionTime
      });

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

    if (input.metrics) {
      const validMetrics = ['volume', 'topSources', 'priority', 'eventTypes'];
      for (const metric of input.metrics) {
        if (!validMetrics.includes(metric)) {
          errors.push(`Invalid metric: ${metric}. Must be one of: ${validMetrics.join(', ')}`);
        }
      }
    }

    if (input.granularity && !['hourly', 'daily'].includes(input.granularity)) {
      errors.push('granularity must be "hourly" or "daily"');
    }

    if (input.groupBy && !['hour', 'day', 'week'].includes(input.groupBy)) {
      errors.push('groupBy must be "hour", "day", or "week"');
    }

    if (input.timeRange && !['1h', '24h', '7d', '30d'].includes(input.timeRange)) {
      warnings.push('timeRange should typically be 1h, 24h, 7d, or 30d');
    }

    if (input.startTime && input.endTime) {
      const start = new Date(input.startTime);
      const end = new Date(input.endTime);
      if (start >= end) {
        errors.push('startTime must be before endTime');
      }
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
          metrics: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['volume', 'topSources', 'priority', 'eventTypes']
            },
            description: 'Metrics to compute',
            default: ['volume', 'topSources', 'priority', 'eventTypes']
          },
          startTime: {
            type: 'string',
            format: 'date-time',
            description: 'Start time for analytics (ISO 8601)'
          },
          endTime: {
            type: 'string',
            format: 'date-time',
            description: 'End time for analytics (ISO 8601)'
          },
          timeRange: {
            type: 'string',
            enum: ['1h', '24h', '7d', '30d'],
            description: 'Preset time range',
            default: '24h'
          },
          granularity: {
            type: 'string',
            enum: ['hourly', 'daily'],
            description: 'Time granularity for volume metrics'
          },
          groupBy: {
            type: 'string',
            enum: ['hour', 'day', 'week'],
            description: 'Time grouping for volume metrics'
          },
          organizationId: {
            type: 'string',
            description: 'Filter analytics by organization'
          },
          userId: {
            type: 'string',
            description: 'Filter analytics by user'
          }
        }
      },
      output: {
        type: 'object',
        properties: {
          metrics: {
            type: 'object',
            properties: {
              volume: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    timestamp: { type: 'string' },
                    count: { type: 'number' },
                    period: { type: 'string' }
                  }
                }
              },
              topSources: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    source: { type: 'string' },
                    count: { type: 'number' },
                    percentage: { type: 'number' }
                  }
                }
              },
              priority: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    priority: { type: 'string' },
                    count: { type: 'number' },
                    percentage: { type: 'number' }
                  }
                }
              },
              eventTypes: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    eventType: { type: 'string' },
                    count: { type: 'number' },
                    percentage: { type: 'number' }
                  }
                }
              }
            }
          },
          totalEvents: { type: 'number' },
          timeRange: {
            type: 'object',
            properties: {
              start: { type: 'string', format: 'date-time' },
              end: { type: 'string', format: 'date-time' }
            }
          },
          granularity: { type: 'string' },
          organizationId: { type: 'string' },
          userId: { type: 'string' },
          success: { type: 'boolean' },
          timestamp: { type: 'string', format: 'date-time' }
        }
      }
    };
  }

  getDisplayInfo() {
    return {
      name: 'Events Analytics',
      description: 'Get analytics and aggregations for events (volume, top sources, priority distribution)',
      category: 'Events',
      icon: 'chart',
      color: '#9C27B0',
      tags: ['events', 'analytics', 'metrics', 'monitoring', 'aggregation', 'statistics']
    };
  }
}
