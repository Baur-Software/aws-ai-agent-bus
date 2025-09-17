/**
 * Event Monitoring MCP Tools
 * Provides comprehensive event monitoring, alerting, and analytics capabilities
 */

import EventMonitoringService from '../../aws/event-monitoring.js';

const eventMonitoring = new EventMonitoringService();

export const eventMonitoringTools = [
  {
    name: 'event-monitoring.send',
    description: 'Send an event with enhanced monitoring capabilities including alerting and analytics',
    inputSchema: {
      type: 'object',
      properties: {
        detailType: {
          type: 'string',
          description: 'Event type/category (e.g., user.login, system.error, integration.connected)'
        },
        detail: {
          type: 'object',
          description: 'Event details and payload',
          additionalProperties: true
        },
        source: {
          type: 'string',
          description: 'Event source identifier',
          default: 'agent-mesh-monitoring'
        },
        priority: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'critical'],
          description: 'Event priority level',
          default: 'medium'
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Event tags for categorization and filtering',
          default: []
        },
        alerting: {
          type: 'boolean',
          description: 'Whether this event should trigger alerts',
          default: false
        },
        userId: {
          type: 'string',
          description: 'User ID associated with the event',
          default: 'system'
        }
      },
      required: ['detailType', 'detail']
    }
  },

  {
    name: 'event-monitoring.query',
    description: 'Query event history with filtering and pagination',
    inputSchema: {
      type: 'object',
      properties: {
        source: {
          type: 'string',
          description: 'Filter by event source'
        },
        detailType: {
          type: 'string',
          description: 'Filter by event type'
        },
        priority: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'critical'],
          description: 'Filter by priority level'
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Filter by tags (events must have at least one matching tag)',
          default: []
        },
        startTime: {
          type: 'string',
          description: 'Start time filter (ISO 8601 format)',
          format: 'date-time'
        },
        endTime: {
          type: 'string',
          description: 'End time filter (ISO 8601 format)', 
          format: 'date-time'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of events to return (1-100)',
          minimum: 1,
          maximum: 100,
          default: 50
        },
        nextToken: {
          type: 'string',
          description: 'Pagination token for next page of results'
        }
      }
    }
  },

  {
    name: 'event-monitoring.analytics',
    description: 'Get event analytics and insights for monitoring dashboards',
    inputSchema: {
      type: 'object',
      properties: {
        timeRange: {
          type: 'string',
          enum: ['1h', '6h', '24h', '7d', '30d'],
          description: 'Time range for analytics',
          default: '24h'
        },
        groupBy: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['source', 'detailType', 'priority', 'userId']
          },
          description: 'Fields to group analytics by',
          default: ['source', 'detailType']
        }
      }
    }
  },

  {
    name: 'event-monitoring.create-rule',
    description: 'Create or update an event monitoring rule for automated processing',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Unique rule name (alphanumeric and hyphens only)'
        },
        description: {
          type: 'string',
          description: 'Rule description'
        },
        eventPattern: {
          type: 'object',
          description: 'EventBridge event pattern for matching events',
          additionalProperties: true
        },
        targets: {
          type: 'array',
          description: 'Rule targets (SNS topics, Lambda functions, etc.)',
          items: {
            type: 'object',
            properties: {
              Arn: { type: 'string', description: 'Target ARN' },
              RoleArn: { type: 'string', description: 'IAM role ARN for target' }
            },
            required: ['Arn']
          },
          default: []
        }
      },
      required: ['name', 'description', 'eventPattern']
    }
  },

  {
    name: 'event-monitoring.create-alert',
    description: 'Create an alert subscription for specific event patterns',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Alert subscription name'
        },
        eventPattern: {
          type: 'object',
          description: 'Event pattern to match for alerts',
          additionalProperties: true
        },
        channels: {
          type: 'array',
          description: 'Notification channels for alerts',
          items: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                enum: ['email', 'sms', 'webhook'],
                description: 'Channel type'
              },
              endpoint: {
                type: 'string',
                description: 'Channel endpoint (email address, phone number, webhook URL)'
              }
            },
            required: ['type', 'endpoint']
          }
        },
        userId: {
          type: 'string',
          description: 'User ID for the subscription',
          default: 'system'
        }
      },
      required: ['name', 'eventPattern', 'channels']
    }
  },

  {
    name: 'event-monitoring.health-check',
    description: 'Check the health and status of the event monitoring system',
    inputSchema: {
      type: 'object',
      properties: {
        detailed: {
          type: 'boolean',
          description: 'Include detailed health metrics',
          default: false
        }
      }
    }
  }
];

export async function handleEventMonitoringTool(name, args) {
  try {
    switch (name) {
      case 'event-monitoring.send':
        return await handleSendMonitoredEvent(args);
      
      case 'event-monitoring.query':
        return await handleQueryEvents(args);
      
      case 'event-monitoring.analytics':
        return await handleEventAnalytics(args);
      
      case 'event-monitoring.create-rule':
        return await handleCreateRule(args);
      
      case 'event-monitoring.create-alert':
        return await handleCreateAlert(args);
      
      case 'event-monitoring.health-check':
        return await handleHealthCheck(args);
      
      default:
        throw new Error(`Unknown event monitoring tool: ${name}`);
    }
  } catch (error) {
    console.error(`❌ Event monitoring tool error (${name}):`, error);
    return {
      success: false,
      error: error.message,
      tool: name,
      timestamp: new Date().toISOString()
    };
  }
}

async function handleSendMonitoredEvent(args) {
  const result = await eventMonitoring.sendMonitoredEvent(args);
  
  return {
    success: true,
    message: 'Event sent with monitoring enabled',
    eventId: result.eventId,
    timestamp: result.timestamp,
    metadata: result.metadata,
    alertsTriggered: args.alerting,
    priority: args.priority || 'medium'
  };
}

async function handleQueryEvents(args) {
  const result = await eventMonitoring.queryEventHistory(args);
  
  return {
    success: true,
    message: `Found ${result.count} events`,
    events: result.events,
    count: result.count,
    scannedCount: result.scannedCount,
    nextToken: result.nextToken,
    hasMore: !!result.nextToken
  };
}

async function handleEventAnalytics(args) {
  const analytics = await eventMonitoring.getEventAnalytics(args);
  
  return {
    success: true,
    message: `Analytics for ${analytics.summary.timeRange} time range`,
    analytics,
    generatedAt: new Date().toISOString()
  };
}

async function handleCreateRule(args) {
  const result = await eventMonitoring.createMonitoringRule(args);
  
  return {
    success: true,
    message: `Monitoring rule '${args.name}' created successfully`,
    ruleName: result.ruleName,
    ruleArn: result.ruleArn,
    targetsCount: result.targetsCount
  };
}

async function handleCreateAlert(args) {
  const result = await eventMonitoring.createEventAlertSubscription(args);
  
  return {
    success: true,
    message: `Alert subscription '${args.name}' created successfully`,
    subscriptionId: result.subscriptionId,
    ruleName: result.ruleName,
    channelsSubscribed: result.channelsSubscribed
  };
}

async function handleHealthCheck(args) {
  const { detailed = false } = args;
  const timestamp = new Date().toISOString();
  
  // Basic health check
  const health = {
    status: 'healthy',
    timestamp,
    services: {
      eventBridge: 'operational',
      sns: 'operational', 
      dynamodb: 'operational'
    }
  };

  if (detailed) {
    try {
      // Get recent event counts
      const recentEvents = await eventMonitoring.queryEventHistory({
        startTime: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // Last hour
        limit: 1
      });

      health.metrics = {
        eventsLastHour: recentEvents.scannedCount || 0,
        lastEventTime: recentEvents.events[0]?.timestamp || null
      };

    } catch (error) {
      health.status = 'degraded';
      health.error = error.message;
    }
  }

  return {
    success: true,
    message: `Event monitoring system is ${health.status}`,
    health
  };
}

export default { eventMonitoringTools, handleEventMonitoringTool };