/**
 * SNS Service - Actual AWS SNS integration for notifications
 * Provides topic management, publishing, and subscription functionality
 */

import {
  SNSClient,
  PublishCommand,
  SubscribeCommand,
  UnsubscribeCommand,
  CreateTopicCommand,
  ListTopicsCommand,
  GetTopicAttributesCommand,
  SetTopicAttributesCommand,
  PublishBatchCommand,
  MessageAttributeValue,
} from '@aws-sdk/client-sns';
import { fromIni } from '@aws-sdk/credential-providers';
import { Logger } from '../utils/Logger.js';

export interface SNSPublishParams {
  topicArn?: string;
  topicName?: string;
  message: string;
  subject?: string;
  messageAttributes?: Record<string, { DataType: string; StringValue?: string; BinaryValue?: Uint8Array }>;
  messageGroupId?: string; // For FIFO topics
  messageDeduplicationId?: string; // For FIFO topics
}

export interface SNSNotificationParams {
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  title?: string;
  userId?: string;
  metadata?: Record<string, any>;
}

export interface SNSSubscriptionParams {
  protocol: 'email' | 'sms' | 'sqs' | 'http' | 'https' | 'lambda' | 'application';
  endpoint: string;
  topicArn?: string;
  topicName?: string;
  filterPolicy?: Record<string, any>;
  returnSubscriptionArn?: boolean;
}

export interface SNSIntegrationEventParams {
  integration: string;
  action: 'connected' | 'disconnected' | 'error' | 'sync_started' | 'sync_completed';
  userId: string;
  details?: Record<string, any>;
}

export interface SNSSystemEventParams {
  eventType: string;
  component: string;
  message: string;
  level?: 'info' | 'warning' | 'error' | 'critical';
  metadata?: Record<string, any>;
}

export class SNSService {
  private client: SNSClient;
  private logger: Logger;
  private topicArnCache: Map<string, string> = new Map();
  private defaultTopicPrefix: string;
  private accountId: string | null = null;
  private region: string;

  constructor() {
    this.region = process.env.AWS_REGION || 'us-west-2';

    const config: any = {
      region: this.region,
    };

    // Use profile credentials in development, IAM role in production
    if (process.env.AWS_PROFILE) {
      config.credentials = fromIni({ profile: process.env.AWS_PROFILE });
    }

    // Support local testing with endpoint override
    if (process.env.AWS_ENDPOINT_URL) {
      config.endpoint = process.env.AWS_ENDPOINT_URL;
    }

    this.client = new SNSClient(config);
    this.logger = new Logger('SNSService');
    this.defaultTopicPrefix = process.env.SNS_TOPIC_PREFIX || 'agent-mesh';
  }

  /**
   * Get or create a topic ARN by name
   */
  private async getOrCreateTopicArn(topicName: string): Promise<string> {
    // Check cache first
    if (this.topicArnCache.has(topicName)) {
      return this.topicArnCache.get(topicName)!;
    }

    const fullTopicName = topicName.startsWith(this.defaultTopicPrefix)
      ? topicName
      : `${this.defaultTopicPrefix}-${topicName}`;

    try {
      // List topics to find existing one
      const listResponse = await this.client.send(new ListTopicsCommand({}));
      const existingTopic = listResponse.Topics?.find(t =>
        t.TopicArn?.endsWith(`:${fullTopicName}`)
      );

      if (existingTopic?.TopicArn) {
        this.topicArnCache.set(topicName, existingTopic.TopicArn);
        return existingTopic.TopicArn;
      }

      // Create topic if it doesn't exist
      const createResponse = await this.client.send(new CreateTopicCommand({
        Name: fullTopicName,
        Tags: [
          { Key: 'Service', Value: 'agent-mesh' },
          { Key: 'Environment', Value: process.env.NODE_ENV || 'development' }
        ]
      }));

      if (createResponse.TopicArn) {
        this.topicArnCache.set(topicName, createResponse.TopicArn);
        this.logger.info(`Created SNS topic: ${createResponse.TopicArn}`);
        return createResponse.TopicArn;
      }

      throw new Error(`Failed to create topic: ${fullTopicName}`);
    } catch (error) {
      this.logger.error(`Failed to get/create topic ${topicName}:`, error);
      throw error;
    }
  }

  /**
   * Publish a message to an SNS topic
   */
  async publish(params: SNSPublishParams): Promise<{ MessageId: string }> {
    try {
      let topicArn = params.topicArn;

      // Resolve topic ARN from name if not provided
      if (!topicArn && params.topicName) {
        topicArn = await this.getOrCreateTopicArn(params.topicName);
      }

      if (!topicArn) {
        throw new Error('Either topicArn or topicName must be provided');
      }

      // Convert message attributes to AWS format
      const messageAttributes: Record<string, MessageAttributeValue> = {};
      if (params.messageAttributes) {
        for (const [key, value] of Object.entries(params.messageAttributes)) {
          messageAttributes[key] = {
            DataType: value.DataType,
            StringValue: value.StringValue,
            BinaryValue: value.BinaryValue
          };
        }
      }

      const command = new PublishCommand({
        TopicArn: topicArn,
        Message: params.message,
        Subject: params.subject,
        MessageAttributes: Object.keys(messageAttributes).length > 0 ? messageAttributes : undefined,
        MessageGroupId: params.messageGroupId,
        MessageDeduplicationId: params.messageDeduplicationId
      });

      const response = await this.client.send(command);

      this.logger.info(`Published message to ${topicArn}`, { messageId: response.MessageId });

      return { MessageId: response.MessageId || '' };
    } catch (error) {
      this.logger.error('Failed to publish SNS message:', error);
      throw error;
    }
  }

  /**
   * Publish a notification with structured format
   */
  async publishNotification(params: SNSNotificationParams): Promise<{ success: boolean; messageId: string }> {
    try {
      const topicArn = await this.getOrCreateTopicArn('notifications');

      const notification = {
        type: params.type,
        title: params.title || this.getDefaultTitle(params.type),
        message: params.message,
        userId: params.userId || 'system',
        timestamp: new Date().toISOString(),
        metadata: params.metadata || {}
      };

      const result = await this.publish({
        topicArn,
        message: JSON.stringify(notification),
        subject: `[${params.type.toUpperCase()}] ${params.title || params.message.substring(0, 100)}`,
        messageAttributes: {
          type: { DataType: 'String', StringValue: params.type },
          userId: { DataType: 'String', StringValue: params.userId || 'system' }
        }
      });

      return { success: true, messageId: result.MessageId };
    } catch (error) {
      this.logger.error('Failed to publish notification:', error);
      return { success: false, messageId: '' };
    }
  }

  /**
   * Subscribe an endpoint to notifications
   */
  async subscribeToNotifications(
    protocol: SNSSubscriptionParams['protocol'],
    endpoint: string,
    topicName: string = 'notifications'
  ): Promise<{ success: boolean; subscriptionArn: string }> {
    try {
      const topicArn = await this.getOrCreateTopicArn(topicName);

      const command = new SubscribeCommand({
        TopicArn: topicArn,
        Protocol: protocol,
        Endpoint: endpoint,
        ReturnSubscriptionArn: true
      });

      const response = await this.client.send(command);

      this.logger.info(`Subscribed ${endpoint} to ${topicArn}`, {
        subscriptionArn: response.SubscriptionArn
      });

      return {
        success: true,
        subscriptionArn: response.SubscriptionArn || 'pending-confirmation'
      };
    } catch (error) {
      this.logger.error(`Failed to subscribe ${endpoint}:`, error);
      return { success: false, subscriptionArn: '' };
    }
  }

  /**
   * Unsubscribe from notifications
   */
  async unsubscribeFromNotifications(subscriptionArn: string): Promise<{ success: boolean }> {
    try {
      if (subscriptionArn === 'pending-confirmation') {
        return { success: true }; // Can't unsubscribe pending confirmations
      }

      const command = new UnsubscribeCommand({
        SubscriptionArn: subscriptionArn
      });

      await this.client.send(command);

      this.logger.info(`Unsubscribed: ${subscriptionArn}`);

      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to unsubscribe ${subscriptionArn}:`, error);
      return { success: false };
    }
  }

  /**
   * Publish an integration event (connection status, sync events, etc.)
   */
  async publishIntegrationEvent(params: SNSIntegrationEventParams): Promise<{ success: boolean; messageId: string }> {
    try {
      const topicArn = await this.getOrCreateTopicArn('integrations');

      const event = {
        eventType: 'integration',
        integration: params.integration,
        action: params.action,
        userId: params.userId,
        details: params.details || {},
        timestamp: new Date().toISOString()
      };

      const result = await this.publish({
        topicArn,
        message: JSON.stringify(event),
        subject: `Integration ${params.action}: ${params.integration}`,
        messageAttributes: {
          integration: { DataType: 'String', StringValue: params.integration },
          action: { DataType: 'String', StringValue: params.action },
          userId: { DataType: 'String', StringValue: params.userId }
        }
      });

      return { success: true, messageId: result.MessageId };
    } catch (error) {
      this.logger.error('Failed to publish integration event:', error);
      return { success: false, messageId: '' };
    }
  }

  /**
   * Publish a system event (health status, performance alerts, etc.)
   */
  async publishSystemEvent(params: SNSSystemEventParams): Promise<{ success: boolean; messageId: string }> {
    try {
      const topicArn = await this.getOrCreateTopicArn('system-events');
      const level = params.level || 'info';

      const event = {
        eventType: params.eventType,
        component: params.component,
        message: params.message,
        level,
        metadata: params.metadata || {},
        timestamp: new Date().toISOString()
      };

      const result = await this.publish({
        topicArn,
        message: JSON.stringify(event),
        subject: `[${level.toUpperCase()}] ${params.component}: ${params.eventType}`,
        messageAttributes: {
          eventType: { DataType: 'String', StringValue: params.eventType },
          component: { DataType: 'String', StringValue: params.component },
          level: { DataType: 'String', StringValue: level }
        }
      });

      return { success: true, messageId: result.MessageId };
    } catch (error) {
      this.logger.error('Failed to publish system event:', error);
      return { success: false, messageId: '' };
    }
  }

  /**
   * Publish to a specific topic ARN (for event rule actions)
   */
  async publishToTopic(
    topicArn: string,
    message: string | object,
    subject?: string
  ): Promise<{ success: boolean; messageId: string }> {
    try {
      const messageStr = typeof message === 'string' ? message : JSON.stringify(message);

      const result = await this.publish({
        topicArn,
        message: messageStr,
        subject
      });

      return { success: true, messageId: result.MessageId };
    } catch (error) {
      this.logger.error(`Failed to publish to topic ${topicArn}:`, error);
      return { success: false, messageId: '' };
    }
  }

  /**
   * Get health status of SNS service
   */
  async getHealth(): Promise<{ healthy: boolean; topicCount?: number; error?: string }> {
    try {
      const response = await this.client.send(new ListTopicsCommand({}));
      return {
        healthy: true,
        topicCount: response.Topics?.length || 0
      };
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get default title based on notification type
   */
  private getDefaultTitle(type: SNSNotificationParams['type']): string {
    switch (type) {
      case 'success':
        return 'Success';
      case 'error':
        return 'Error';
      case 'warning':
        return 'Warning';
      case 'info':
        return 'Information';
      default:
        return 'Notification';
    }
  }
}

// Singleton instance
let snsServiceInstance: SNSService | null = null;

export function getSNSService(): SNSService {
  if (!snsServiceInstance) {
    snsServiceInstance = new SNSService();
  }
  return snsServiceInstance;
}

export default SNSService;
