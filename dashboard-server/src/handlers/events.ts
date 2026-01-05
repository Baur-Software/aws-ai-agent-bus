/**
 * Event Hub for dashboard-server
 * Central pub/sub system for all events: EventBridge + WebSocket + SNS
 * All events flow through this hub - no direct Lambda/EventBridge -> WebSocket
 */

import { WebSocket, WebSocketServer } from 'ws';
import MCPStdioService from '../services/MCPStdioService.js';
import { getSNSService } from './notifications.js';
import { Logger } from '../utils/Logger.js';

export interface EventMessage {
  eventId?: string;
  detailType: string;
  source: string;
  detail: any;
  timestamp?: string;
  userId?: string;
  organizationId?: string;
  executionId?: string;
}

export interface EventSubscription {
  clientId: string;
  ws: WebSocket;
  userId: string;
  organizationId?: string;
  eventTypes: string[]; // e.g., ['workflow.*', 'mcp.tool.*']
  filters?: {
    executionId?: string;
    nodeId?: string;
    source?: string;
    priority?: string;
  };
}

export interface EventRule {
  ruleId: string;
  name: string;
  pattern: any; // EventBridge pattern
  actions: EventRuleAction[];
  enabled: boolean;
}

export interface EventRuleAction {
  type: 'sns' | 'webhook' | 'workflow_trigger';
  config: any;
}

export class EventsHandler {
  private static subscribers = new Map<string, EventSubscription>();
  private static mcpService: MCPStdioService | null = null;

  static initialize(mcpService: MCPStdioService) {
    this.mcpService = mcpService;
  }

  /**
   * Publish event to all systems (EventBridge + WebSocket + SNS)
   * This is the central event publishing method
   */
  static async publish(event: EventMessage): Promise<{ eventId: string; success: boolean; timestamp: string }> {
    const eventId = event.eventId || `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = event.timestamp || new Date().toISOString();

    const fullEvent: EventMessage = {
      ...event,
      eventId,
      timestamp
    };

    try {
      // 1. Persist to EventBridge → DynamoDB (via MCP events_send tool)
      await this.persistToEventBridge(fullEvent);

      // 2. Broadcast to subscribed WebSocket clients
      this.broadcastToClients(fullEvent);

      // 3. Process event rules and trigger alerts/actions
      await this.processEventRules(fullEvent);

      return { eventId, success: true, timestamp };
    } catch (error) {
      console.error('Error publishing event:', error);
      return { eventId, success: false, timestamp };
    }
  }

  /**
   * Persist event to EventBridge → DynamoDB via MCP
   */
  private static async persistToEventBridge(event: EventMessage): Promise<void> {
    if (!this.mcpService) {
      console.warn('MCP service not initialized, skipping EventBridge persistence');
      return;
    }

    try {
      await this.mcpService.executeTool('events_send', {
        detailType: event.detailType,
        source: event.source,
        detail: event.detail,
        userId: event.userId,
        organizationId: event.organizationId,
        priority: event.detail?.priority || 'medium'
      });
    } catch (error) {
      console.error('Failed to persist event to EventBridge:', error);
      // Don't throw - event should still reach WebSocket clients
    }
  }

  /**
   * Broadcast event to all subscribed WebSocket clients
   */
  private static broadcastToClients(event: EventMessage): void {
    let matchedClients = 0;

    for (const subscription of this.subscribers.values()) {
      if (this.matchesSubscription(event, subscription)) {
        try {
          if (subscription.ws.readyState === WebSocket.OPEN) {
            subscription.ws.send(JSON.stringify({
              type: 'event_stream',
              event
            }));
            matchedClients++;
          }
        } catch (error) {
          console.error(`Failed to send event to client ${subscription.clientId}:`, error);
        }
      }
    }

    console.log(`📡 Event ${event.eventId} broadcast to ${matchedClients} clients`);
  }

  /**
   * Process event rules and trigger actions (SNS alerts, workflows, etc.)
   */
  private static async processEventRules(event: EventMessage): Promise<void> {
    if (!this.mcpService) return;

    try {
      // Query matching rules from DynamoDB via MCP
      const rulesResult = await this.mcpService.executeTool('kv_get', {
        key: `event-rules-${event.userId || 'system'}`
      });

      if (!rulesResult || !rulesResult.value) return;

      const rules: EventRule[] = JSON.parse(rulesResult.value);

      for (const rule of rules) {
        if (rule.enabled && this.matchesEventPattern(event, rule.pattern)) {
          await this.executeRuleActions(event, rule);
        }
      }
    } catch (error) {
      console.error('Failed to process event rules:', error);
    }
  }

  /**
   * Execute actions for a matched rule
   */
  private static async executeRuleActions(event: EventMessage, rule: EventRule): Promise<void> {
    const logger = new Logger('EventsHandler');
    logger.info(`Rule "${rule.name}" matched event ${event.eventId}, executing ${rule.actions.length} action(s)`);

    for (const action of rule.actions) {
      try {
        switch (action.type) {
          case 'sns':
            await this.executeSNSAction(event, rule, action.config);
            break;

          case 'webhook':
            await this.executeWebhookAction(event, rule, action.config);
            break;

          case 'workflow_trigger':
            await this.executeWorkflowTriggerAction(event, rule, action.config);
            break;
        }
      } catch (error) {
        logger.error(`Failed to execute action ${action.type} for rule ${rule.name}:`, error);
      }
    }
  }

  /**
   * Execute SNS notification action
   */
  private static async executeSNSAction(
    event: EventMessage,
    rule: EventRule,
    config: { topicArn?: string; topicName?: string; subject?: string }
  ): Promise<void> {
    const logger = new Logger('EventsHandler');
    const snsService = getSNSService();

    const message = {
      eventId: event.eventId,
      ruleId: rule.ruleId,
      ruleName: rule.name,
      detailType: event.detailType,
      source: event.source,
      detail: event.detail,
      timestamp: event.timestamp,
      userId: event.userId,
      organizationId: event.organizationId
    };

    const subject = config.subject || `Event Rule Triggered: ${rule.name}`;

    if (config.topicArn) {
      const result = await snsService.publishToTopic(config.topicArn, message, subject);
      if (result.success) {
        logger.info(`SNS notification sent for rule "${rule.name}"`, { messageId: result.messageId });
      } else {
        logger.error(`SNS notification failed for rule "${rule.name}"`);
      }
    } else if (config.topicName) {
      // Use system event publishing for named topics
      const result = await snsService.publishSystemEvent({
        eventType: event.detailType,
        component: 'EventRules',
        message: JSON.stringify(message),
        level: 'info',
        metadata: { ruleId: rule.ruleId, ruleName: rule.name }
      });
      if (result.success) {
        logger.info(`SNS notification sent for rule "${rule.name}"`, { messageId: result.messageId });
      } else {
        logger.error(`SNS notification failed for rule "${rule.name}"`);
      }
    } else {
      logger.warn(`SNS action for rule "${rule.name}" missing topicArn or topicName`);
    }
  }

  /**
   * Execute webhook HTTP POST action
   */
  private static async executeWebhookAction(
    event: EventMessage,
    rule: EventRule,
    config: { url: string; headers?: Record<string, string>; secret?: string }
  ): Promise<void> {
    const logger = new Logger('EventsHandler');

    if (!config.url) {
      logger.warn(`Webhook action for rule "${rule.name}" missing URL`);
      return;
    }

    const payload = {
      eventId: event.eventId,
      ruleId: rule.ruleId,
      ruleName: rule.name,
      detailType: event.detailType,
      source: event.source,
      detail: event.detail,
      timestamp: event.timestamp,
      userId: event.userId,
      organizationId: event.organizationId
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Event-Id': event.eventId || '',
      'X-Rule-Id': rule.ruleId,
      'X-Rule-Name': rule.name,
      ...(config.headers || {})
    };

    // Add HMAC signature if secret is provided
    if (config.secret) {
      const crypto = await import('crypto');
      const signature = crypto
        .createHmac('sha256', config.secret)
        .update(JSON.stringify(payload))
        .digest('hex');
      headers['X-Signature-256'] = `sha256=${signature}`;
    }

    try {
      const response = await fetch(config.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30000) // 30 second timeout
      });

      if (response.ok) {
        logger.info(`Webhook triggered for rule "${rule.name}"`, {
          url: config.url,
          status: response.status
        });
      } else {
        logger.error(`Webhook failed for rule "${rule.name}"`, {
          url: config.url,
          status: response.status,
          statusText: response.statusText
        });
      }
    } catch (error) {
      logger.error(`Webhook request failed for rule "${rule.name}":`, error);
    }
  }

  /**
   * Execute workflow trigger action
   */
  private static async executeWorkflowTriggerAction(
    event: EventMessage,
    rule: EventRule,
    config: { workflowId: string; input?: Record<string, any> }
  ): Promise<void> {
    const logger = new Logger('EventsHandler');

    if (!config.workflowId) {
      logger.warn(`Workflow trigger action for rule "${rule.name}" missing workflowId`);
      return;
    }

    if (!this.mcpService) {
      logger.warn('MCP service not initialized, cannot trigger workflow');
      return;
    }

    try {
      // Merge event data with custom input
      const workflowInput = {
        triggeredBy: 'event_rule',
        ruleId: rule.ruleId,
        ruleName: rule.name,
        event: {
          eventId: event.eventId,
          detailType: event.detailType,
          source: event.source,
          detail: event.detail,
          timestamp: event.timestamp,
          userId: event.userId,
          organizationId: event.organizationId
        },
        ...(config.input || {})
      };

      // Start workflow execution via MCP
      const result = await this.mcpService.executeTool('workflow_start', {
        workflowId: config.workflowId,
        input: workflowInput
      });

      if (result?.executionId) {
        logger.info(`Workflow triggered for rule "${rule.name}"`, {
          workflowId: config.workflowId,
          executionId: result.executionId
        });
      } else {
        logger.warn(`Workflow trigger returned no execution ID for rule "${rule.name}"`);
      }
    } catch (error) {
      logger.error(`Workflow trigger failed for rule "${rule.name}":`, error);
    }
  }

  /**
   * Check if event matches subscription filters
   */
  private static matchesSubscription(event: EventMessage, subscription: EventSubscription): boolean {
    // Check tenant isolation
    if (subscription.userId && event.userId !== subscription.userId) {
      return false;
    }

    if (subscription.organizationId && event.organizationId !== subscription.organizationId) {
      return false;
    }

    // Check event type pattern matching
    const eventTypeMatches = subscription.eventTypes.some(pattern => {
      if (pattern === '*') return true;
      if (pattern.endsWith('.*')) {
        const prefix = pattern.slice(0, -2);
        return event.detailType.startsWith(prefix);
      }
      return event.detailType === pattern;
    });

    if (!eventTypeMatches) return false;

    // Check additional filters
    if (subscription.filters) {
      if (subscription.filters.executionId && event.executionId !== subscription.filters.executionId) {
        return false;
      }

      if (subscription.filters.nodeId && event.detail?.nodeId !== subscription.filters.nodeId) {
        return false;
      }

      if (subscription.filters.source && event.source !== subscription.filters.source) {
        return false;
      }

      if (subscription.filters.priority && event.detail?.priority !== subscription.filters.priority) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if event matches EventBridge pattern
   */
  private static matchesEventPattern(event: EventMessage, pattern: any): boolean {
    // Simple EventBridge pattern matching
    // TODO: Implement full EventBridge pattern syntax

    if (pattern.source && !pattern.source.includes(event.source)) {
      return false;
    }

    if (pattern['detail-type'] && !pattern['detail-type'].includes(event.detailType)) {
      return false;
    }

    if (pattern.detail) {
      for (const [key, value] of Object.entries(pattern.detail)) {
        if (Array.isArray(value)) {
          if (!value.includes(event.detail[key])) {
            return false;
          }
        }
      }
    }

    return true;
  }

  /**
   * Subscribe WebSocket client to event patterns
   */
  static subscribe(subscription: EventSubscription): void {
    this.subscribers.set(subscription.clientId, subscription);
    console.log(`📡 Client ${subscription.clientId} subscribed to events:`, subscription.eventTypes);
  }

  /**
   * Unsubscribe WebSocket client
   */
  static unsubscribe(clientId: string): void {
    this.subscribers.delete(clientId);
    console.log(`📡 Client ${clientId} unsubscribed from events`);
  }

  /**
   * Get subscription count for monitoring
   */
  static getSubscriptionCount(): number {
    return this.subscribers.size;
  }

  /**
   * Cleanup closed connections
   */
  static cleanup(): void {
    const closedConnections: string[] = [];

    for (const [clientId, subscription] of this.subscribers) {
      if (subscription.ws.readyState !== WebSocket.OPEN) {
        closedConnections.push(clientId);
      }
    }

    closedConnections.forEach(clientId => this.unsubscribe(clientId));

    if (closedConnections.length > 0) {
      console.log(`🧹 Cleaned up ${closedConnections.length} closed connections`);
    }
  }

  /**
   * Legacy send method for backwards compatibility
   */
  static async send({ detailType, detail, source = 'dashboard-server', userId, organizationId }: {
    detailType?: string;
    detail?: any;
    source?: string;
    userId?: string;
    organizationId?: string;
  } = {}) {
    if (!detailType || !detail) {
      throw new Error('detailType and detail are required');
    }

    return this.publish({
      detailType,
      detail,
      source,
      userId,
      organizationId
    });
  }

  /**
   * Send batch of events
   */
  static async sendBatch(events: EventMessage[] = []) {
    if (!Array.isArray(events) || events.length === 0) {
      throw new Error('Events array is required and cannot be empty');
    }

    const results = await Promise.allSettled(
      events.map(event => this.publish(event))
    );

    return {
      success: results.every(r => r.status === 'fulfilled' && r.value.success),
      results: results.map((result, index) => ({
        event: events[index],
        success: result.status === 'fulfilled',
        ...(result.status === 'fulfilled'
          ? { eventId: result.value.eventId }
          : { error: result.reason?.message || String(result.reason) }
        ),
      })),
    };
  }
}

// Start cleanup interval
setInterval(() => {
  EventsHandler.cleanup();
}, 30000); // Every 30 seconds

export default EventsHandler;
