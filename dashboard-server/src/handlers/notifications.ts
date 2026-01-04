/**
 * MCP Notification Handlers
 * Provides MCP tools for sending and managing notifications via SNS
 */

import { getSNSService, SNSService } from '../services/SNSService.js';

// Get the singleton SNS service instance
const snsService = getSNSService();

export const notificationTools = [
  {
    name: 'notifications.send',
    description: 'Send a notification via SNS that will persist across sessions',
    inputSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['success', 'error', 'warning', 'info'],
          description: 'Type of notification'
        },
        message: {
          type: 'string',
          description: 'Notification message'
        },
        title: {
          type: 'string',
          description: 'Optional notification title'
        },
        userId: {
          type: 'string',
          description: 'User ID to target (defaults to current user)',
          default: 'default'
        },
        metadata: {
          type: 'object',
          description: 'Additional metadata for the notification',
          additionalProperties: true
        }
      },
      required: ['type', 'message']
    }
  },
  {
    name: 'notifications.subscribe',
    description: 'Subscribe an endpoint to receive notifications',
    inputSchema: {
      type: 'object',
      properties: {
        protocol: {
          type: 'string',
          enum: ['email', 'sms', 'sqs', 'http', 'https'],
          description: 'Protocol for notification delivery'
        },
        endpoint: {
          type: 'string',
          description: 'Endpoint URL or address (email, phone, URL, etc.)'
        },
        topicName: {
          type: 'string',
          description: 'SNS topic name (optional, defaults to notifications)',
          default: 'notifications'
        }
      },
      required: ['protocol', 'endpoint']
    }
  },
  {
    name: 'notifications.unsubscribe',
    description: 'Unsubscribe from notifications',
    inputSchema: {
      type: 'object',
      properties: {
        subscriptionArn: {
          type: 'string',
          description: 'Subscription ARN to unsubscribe'
        }
      },
      required: ['subscriptionArn']
    }
  },
  {
    name: 'notifications.integration-event',
    description: 'Publish integration-related notifications (connection status, etc.)',
    inputSchema: {
      type: 'object',
      properties: {
        integration: {
          type: 'string',
          description: 'Integration name (e.g., hubspot, slack, google-analytics)'
        },
        action: {
          type: 'string',
          enum: ['connected', 'disconnected', 'error', 'sync_started', 'sync_completed'],
          description: 'Integration action'
        },
        userId: {
          type: 'string',
          description: 'User ID',
          default: 'default'
        },
        details: {
          type: 'object',
          description: 'Additional details about the integration event',
          additionalProperties: true
        }
      },
      required: ['integration', 'action', 'userId']
    }
  },
  {
    name: 'notifications.system-event',
    description: 'Publish system-level notifications',
    inputSchema: {
      type: 'object',
      properties: {
        eventType: {
          type: 'string',
          description: 'Type of system event'
        },
        component: {
          type: 'string',
          description: 'Component name that triggered the event'
        },
        message: {
          type: 'string',
          description: 'Event message'
        },
        level: {
          type: 'string',
          enum: ['info', 'warning', 'error', 'critical'],
          description: 'Event severity level',
          default: 'info'
        },
        metadata: {
          type: 'object',
          description: 'Additional event metadata',
          additionalProperties: true
        }
      },
      required: ['eventType', 'component', 'message']
    }
  },
  {
    name: 'notifications.health',
    description: 'Check SNS service health status',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  }
];

export async function handleNotificationTool(name: string, args: any) {
  try {
    switch (name) {
      case 'notifications.send': {
        const result = await snsService.publishNotification({
          type: args.type,
          message: args.message,
          title: args.title,
          userId: args.userId,
          metadata: args.metadata
        });

        return {
          success: result.success,
          messageId: result.messageId,
          message: result.success
            ? 'Notification sent successfully via SNS'
            : 'Failed to send notification',
          notification: args
        };
      }

      case 'notifications.subscribe': {
        const result = await snsService.subscribeToNotifications(
          args.protocol,
          args.endpoint,
          args.topicName || 'notifications'
        );

        return {
          success: result.success,
          subscriptionArn: result.subscriptionArn,
          message: result.success
            ? `Subscribed ${args.endpoint} to notifications`
            : 'Failed to subscribe to notifications',
          subscription: {
            protocol: args.protocol,
            endpoint: args.endpoint,
            topicName: args.topicName || 'notifications'
          },
          note: result.subscriptionArn === 'pending-confirmation'
            ? 'Please check your email/endpoint to confirm the subscription'
            : undefined
        };
      }

      case 'notifications.unsubscribe': {
        const result = await snsService.unsubscribeFromNotifications(args.subscriptionArn);

        return {
          success: result.success,
          message: result.success
            ? 'Unsubscribed successfully'
            : 'Failed to unsubscribe',
          subscriptionArn: args.subscriptionArn
        };
      }

      case 'notifications.integration-event': {
        const result = await snsService.publishIntegrationEvent({
          integration: args.integration,
          action: args.action,
          userId: args.userId,
          details: args.details
        });

        return {
          success: result.success,
          messageId: result.messageId,
          message: result.success
            ? `Integration event published: ${args.integration} ${args.action}`
            : 'Failed to publish integration event',
          event: args
        };
      }

      case 'notifications.system-event': {
        const result = await snsService.publishSystemEvent({
          eventType: args.eventType,
          component: args.component,
          message: args.message,
          level: args.level,
          metadata: args.metadata
        });

        return {
          success: result.success,
          messageId: result.messageId,
          message: result.success
            ? `System event published: ${args.eventType}`
            : 'Failed to publish system event',
          event: args
        };
      }

      case 'notifications.health': {
        const health = await snsService.getHealth();

        return {
          success: health.healthy,
          status: health.healthy ? 'healthy' : 'unhealthy',
          topicCount: health.topicCount,
          error: health.error,
          timestamp: new Date().toISOString()
        };
      }

      default:
        throw new Error(`Unknown notification tool: ${name}`);
    }
  } catch (error: any) {
    console.error(`Notification tool error (${name}):`, error);
    return {
      success: false,
      error: error.message || 'Unknown error',
      tool: name,
      args
    };
  }
}

// Export the SNS service for use by other modules (like EventsHandler)
export { getSNSService };
