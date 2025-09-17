/**
 * MCP Notification Handlers
 * Provides MCP tools for sending and managing notifications via SNS
 */

import { SNSService } from '../../aws/index.js';

const snsService = new SNSService();

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
          description: 'SNS topic name (optional, defaults to agent-mesh-notifications)',
          default: 'agent-mesh-notifications'
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
          enum: ['connected', 'disconnected', 'error'],
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
        eventData: {
          type: 'object',
          description: 'Event data',
          additionalProperties: true
        },
        userId: {
          type: 'string',
          description: 'User ID (optional, defaults to system)',
          default: 'system'
        }
      },
      required: ['eventType', 'eventData']
    }
  }
];

export async function handleNotificationTool(name, args) {
  try {
    switch (name) {
      case 'notifications.send':
        const messageId = await snsService.publishNotification(args);
        return {
          success: true,
          messageId,
          message: 'Notification sent successfully',
          notification: args
        };

      case 'notifications.subscribe':
        const subscriptionArn = await snsService.subscribeToNotifications(
          args.protocol,
          args.endpoint,
          args.topicName
        );
        return {
          success: true,
          subscriptionArn,
          message: `Subscribed ${args.endpoint} to notifications`,
          subscription: {
            protocol: args.protocol,
            endpoint: args.endpoint,
            topicName: args.topicName || 'agent-mesh-notifications'
          }
        };

      case 'notifications.unsubscribe':
        await snsService.unsubscribeFromNotifications(args.subscriptionArn);
        return {
          success: true,
          message: 'Unsubscribed successfully',
          subscriptionArn: args.subscriptionArn
        };

      case 'notifications.integration-event':
        const integrationMessageId = await snsService.publishIntegrationEvent(
          args.integration,
          args.action,
          args.userId,
          args.details
        );
        return {
          success: true,
          messageId: integrationMessageId,
          message: `Integration event published: ${args.integration} ${args.action}`,
          event: args
        };

      case 'notifications.system-event':
        const systemMessageId = await snsService.publishSystemEvent(
          args.eventType,
          args.eventData,
          args.userId
        );
        return {
          success: true,
          messageId: systemMessageId,
          message: `System event published: ${args.eventType}`,
          event: args
        };

      default:
        throw new Error(`Unknown notification tool: ${name}`);
    }
  } catch (error) {
    console.error(`❌ Notification tool error (${name}):`, error);
    return {
      success: false,
      error: error.message,
      tool: name,
      args
    };
  }
}