// Events Query Task - Query Event History
// Query historical events from DynamoDB for analytics and monitoring

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

export interface EventsQueryInput {
  detailType?: string;
  source?: string;
  startTime?: string;
  endTime?: string;
  limit?: number;
  sortOrder?: 'asc' | 'desc';
  userId?: string;
  organizationId?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  useContextFilters?: boolean;
  contextFilterField?: string;
}

export interface EventsQueryOutput {
  events: Array<{
    eventId: string;
    detailType: string;
    source: string;
    detail: any;
    timestamp: string;
    userId?: string;
    priority?: string;
  }>;
  count: number;
  hasMore: boolean;
  nextCursor?: string;
  queryTime: number;
  filters: Record<string, any>;
  timestamp: string;
}

export class EventsQueryTask implements WorkflowTask<EventsQueryInput, EventsQueryOutput> {
  readonly type = 'events-query';

  constructor(
    private eventsService: {
      query: (filters: any) => Promise<{ events: any[]; count: number; hasMore?: boolean; nextCursor?: string }>;
    },
    private logger?: Logger
  ) {}

  async execute(input: EventsQueryInput, context: WorkflowContext): Promise<EventsQueryOutput> {
    const startTime = Date.now();

    // Build query filters
    let filters: any = {
      detailType: input.detailType,
      source: input.source,
      startTime: input.startTime,
      endTime: input.endTime,
      limit: input.limit || 100,
      sortOrder: input.sortOrder || 'desc',
      userId: input.userId,
      organizationId: input.organizationId,
      priority: input.priority
    };

    // Get filters from context if requested
    if (input.useContextFilters) {
      const contextField = input.contextFilterField || 'eventFilters';
      const contextFilters = context.data[contextField];
      if (contextFilters && typeof contextFilters === 'object') {
        filters = { ...filters, ...contextFilters };
      }
    }

    // Remove undefined values
    Object.keys(filters).forEach(key => {
      if (filters[key] === undefined) {
        delete filters[key];
      }
    });

    this.logger?.info(`Querying events with filters: ${JSON.stringify(filters)}`);

    try {
      const result = await this.eventsService.query(filters);

      const output: EventsQueryOutput = {
        events: result.events || [],
        count: result.count || result.events?.length || 0,
        hasMore: result.hasMore || false,
        nextCursor: result.nextCursor,
        queryTime: Date.now() - startTime,
        filters,
        timestamp: new Date().toISOString()
      };

      this.logger?.info(
        `Events query completed: ${output.count} events found in ${output.queryTime}ms`
      );

      // Store results in context for downstream nodes
      context.data.queryEvents = output.events;
      context.data.queryEventCount = output.count;
      context.data.queryHasMore = output.hasMore;
      context.data.queryNextCursor = output.nextCursor;

      return output;

    } catch (error) {
      this.logger?.error('Events query failed:', error);
      throw new TaskExecutionError(
        `Events query failed: ${error.message}`,
        this.type,
        context.nodeId,
        input
      );
    }
  }

  validate(input: EventsQueryInput): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate time range
    if (input.startTime) {
      try {
        new Date(input.startTime);
      } catch {
        errors.push('startTime must be a valid ISO 8601 timestamp');
      }
    }

    if (input.endTime) {
      try {
        new Date(input.endTime);
      } catch {
        errors.push('endTime must be a valid ISO 8601 timestamp');
      }
    }

    if (input.startTime && input.endTime) {
      const start = new Date(input.startTime);
      const end = new Date(input.endTime);
      if (start > end) {
        errors.push('startTime must be before endTime');
      }
    }

    // Validate limit
    if (input.limit && (input.limit < 1 || input.limit > 1000)) {
      warnings.push('Limit should be between 1 and 1000 for optimal performance');
    }

    // Validate priority
    if (input.priority && !['low', 'medium', 'high', 'critical'].includes(input.priority)) {
      errors.push('Priority must be: low, medium, high, or critical');
    }

    // Validate sort order
    if (input.sortOrder && !['asc', 'desc'].includes(input.sortOrder)) {
      errors.push('sortOrder must be: asc or desc');
    }

    // Warning if no filters provided
    if (!input.detailType && !input.source && !input.startTime && !input.userId && !input.organizationId && !input.priority) {
      warnings.push('No filters provided - query will return all events (up to limit)');
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
      title: 'Query Events',
      description: 'Query historical events from event store',
      properties: {
        detailType: {
          type: 'string',
          title: 'Event Type',
          description: 'Filter by event detail-type (e.g., user.signup)',
          placeholder: 'user.signup'
        },
        source: {
          type: 'string',
          title: 'Event Source',
          description: 'Filter by event source',
          placeholder: 'workflow-engine'
        },
        startTime: {
          type: 'string',
          title: 'Start Time',
          description: 'ISO 8601 timestamp for query start',
          placeholder: '2025-01-01T00:00:00Z'
        },
        endTime: {
          type: 'string',
          title: 'End Time',
          description: 'ISO 8601 timestamp for query end',
          placeholder: '2025-12-31T23:59:59Z'
        },
        limit: {
          type: 'number',
          title: 'Limit',
          description: 'Maximum number of events to return',
          default: 100,
          minimum: 1,
          maximum: 1000
        },
        sortOrder: {
          type: 'string',
          title: 'Sort Order',
          description: 'Sort by timestamp',
          enum: ['asc', 'desc'],
          default: 'desc'
        },
        userId: {
          type: 'string',
          title: 'User ID',
          description: 'Filter by user ID'
        },
        organizationId: {
          type: 'string',
          title: 'Organization ID',
          description: 'Filter by organization ID'
        },
        priority: {
          type: 'string',
          title: 'Priority',
          description: 'Filter by event priority',
          enum: ['low', 'medium', 'high', 'critical']
        },
        useContextFilters: {
          type: 'boolean',
          title: 'Use Filters from Context',
          description: 'Get additional filters from workflow context',
          default: false
        },
        contextFilterField: {
          type: 'string',
          title: 'Context Filter Field',
          description: 'Field name containing filter object',
          default: 'eventFilters'
        }
      },
      required: [],
      examples: [
        {
          detailType: 'user.signup',
          startTime: '2025-10-01T00:00:00Z',
          endTime: '2025-10-08T23:59:59Z',
          limit: 50
        },
        {
          source: 'workflow-engine',
          priority: 'high',
          sortOrder: 'desc'
        },
        {
          userId: 'user-123',
          limit: 100
        }
      ]
    };
  }

  getDisplayInfo(): TaskDisplayInfo {
    return {
      category: NODE_CATEGORIES.DATA,
      label: 'Query Events',
      icon: '🔍',
      color: 'bg-blue-500',
      description: 'Query historical events for analytics and monitoring',
      tags: ['events', 'query', 'history', 'analytics', 'search']
    };
  }
}
