import { Logger } from '../utils/Logger.js';
import { WebSocket } from 'ws';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { EventBridgeClient } from '@aws-sdk/client-eventbridge';

interface WorkflowCollaborator {
  userId: string;
  sessionId: string;
  name: string;
  avatar?: string;
  role: 'owner' | 'editor' | 'viewer';
  cursor?: {
    x: number;
    y: number;
    nodeId?: string;
  };
  activeNode?: string;
  lastSeen: string;
}

interface WorkflowUpdate {
  type: 'node_move' | 'node_add' | 'node_delete' | 'node_update' | 'connection_add' | 'connection_delete';
  data: any;
  userId: string;
  timestamp: string;
  workflowId: string;
}

interface RealTimeSession {
  workflowId: string;
  collaborators: Map<string, WorkflowCollaborator>;
  updates: WorkflowUpdate[];
  lastActivity: string;
}

export class CollaborativeWorkflowService {
  private logger: Logger;
  private sessions = new Map<string, RealTimeSession>();
  private userSockets = new Map<string, WebSocket>();

  constructor(
    private dynamodb: DynamoDBClient,
    private eventBridge: EventBridgeClient
  ) {
    this.logger = new Logger('CollaborativeWorkflowService');
  }

  /**
   * Join a collaborative workflow session
   */
  joinWorkflow(
    workflowId: string,
    userId: string,
    userName: string,
    userAvatar: string | undefined,
    role: 'owner' | 'editor' | 'viewer',
    socket: WebSocket
  ): void {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Get or create session
    let session = this.sessions.get(workflowId);
    if (!session) {
      session = {
        workflowId,
        collaborators: new Map(),
        updates: [],
        lastActivity: new Date().toISOString()
      };
      this.sessions.set(workflowId, session);
    }

    // Add collaborator
    const collaborator: WorkflowCollaborator = {
      userId,
      sessionId,
      name: userName,
      avatar: userAvatar,
      role,
      lastSeen: new Date().toISOString()
    };

    session.collaborators.set(userId, collaborator);
    this.userSockets.set(userId, socket);

    // Set up socket handlers
    this.setupSocketHandlers(socket, workflowId, userId);

    // Notify other collaborators
    this.broadcastToWorkflow(workflowId, {
      type: 'user_joined',
      data: {
        collaborator,
        timestamp: new Date().toISOString()
      }
    }, userId);

    // Send current state to new user
    this.sendToUser(userId, {
      type: 'workflow_state',
      data: {
        collaborators: Array.from(session.collaborators.values()),
        recentUpdates: session.updates.slice(-20), // Last 20 updates
        timestamp: new Date().toISOString()
      }
    });

    this.logger.info(`User ${userId} joined workflow ${workflowId} as ${role}`);
  }

  /**
   * Leave a collaborative workflow session
   */
  leaveWorkflow(workflowId: string, userId: string): void {
    const session = this.sessions.get(workflowId);
    if (!session) return;

    const collaborator = session.collaborators.get(userId);
    if (!collaborator) return;

    // Remove collaborator
    session.collaborators.delete(userId);
    this.userSockets.delete(userId);

    // Notify other collaborators
    this.broadcastToWorkflow(workflowId, {
      type: 'user_left',
      data: {
        userId,
        userName: collaborator.name,
        timestamp: new Date().toISOString()
      }
    }, userId);

    // Clean up session if empty
    if (session.collaborators.size === 0) {
      this.sessions.delete(workflowId);
    }

    this.logger.info(`User ${userId} left workflow ${workflowId}`);
  }

  /**
   * Set up WebSocket message handlers
   */
  private setupSocketHandlers(socket: WebSocket, workflowId: string, userId: string): void {
    socket.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleWorkflowMessage(workflowId, userId, message);
      } catch (error) {
        this.logger.error('Failed to parse WebSocket message:', error);
      }
    });

    socket.on('close', () => {
      this.leaveWorkflow(workflowId, userId);
    });

    socket.on('error', (error) => {
      this.logger.error(`WebSocket error for user ${userId}:`, error);
      this.leaveWorkflow(workflowId, userId);
    });
  }

  /**
   * Handle workflow-related messages
   */
  private handleWorkflowMessage(workflowId: string, userId: string, message: any): void {
    const session = this.sessions.get(workflowId);
    if (!session) return;

    const collaborator = session.collaborators.get(userId);
    if (!collaborator) return;

    const timestamp = new Date().toISOString();

    switch (message.type) {
      case 'cursor_move':
        this.handleCursorMove(workflowId, userId, message.data);
        break;

      case 'node_move':
        if (collaborator.role !== 'viewer') {
          this.handleNodeMove(workflowId, userId, message.data, timestamp);
        }
        break;

      case 'node_add':
        if (collaborator.role !== 'viewer') {
          this.handleNodeAdd(workflowId, userId, message.data, timestamp);
        }
        break;

      case 'node_delete':
        if (collaborator.role !== 'viewer') {
          this.handleNodeDelete(workflowId, userId, message.data, timestamp);
        }
        break;

      case 'node_update':
        if (collaborator.role !== 'viewer') {
          this.handleNodeUpdate(workflowId, userId, message.data, timestamp);
        }
        break;

      case 'connection_add':
        if (collaborator.role !== 'viewer') {
          this.handleConnectionAdd(workflowId, userId, message.data, timestamp);
        }
        break;

      case 'connection_delete':
        if (collaborator.role !== 'viewer') {
          this.handleConnectionDelete(workflowId, userId, message.data, timestamp);
        }
        break;

      case 'node_select':
        this.handleNodeSelect(workflowId, userId, message.data);
        break;

      case 'typing_start':
        this.handleTypingStart(workflowId, userId, message.data);
        break;

      case 'typing_end':
        this.handleTypingEnd(workflowId, userId, message.data);
        break;

      default:
        this.logger.warn(`Unknown message type: ${message.type}`);
    }

    // Update last seen
    collaborator.lastSeen = timestamp;
    session.lastActivity = timestamp;
  }

  /**
   * Handle cursor movement
   */
  private handleCursorMove(workflowId: string, userId: string, data: any): void {
    const session = this.sessions.get(workflowId);
    if (!session) return;

    const collaborator = session.collaborators.get(userId);
    if (!collaborator) return;

    collaborator.cursor = {
      x: data.x,
      y: data.y,
      nodeId: data.nodeId
    };

    // Broadcast cursor position to other users
    this.broadcastToWorkflow(workflowId, {
      type: 'cursor_update',
      data: {
        userId,
        cursor: collaborator.cursor,
        timestamp: new Date().toISOString()
      }
    }, userId);
  }

  /**
   * Handle node movement
   */
  private handleNodeMove(workflowId: string, userId: string, data: any, timestamp: string): void {
    const update: WorkflowUpdate = {
      type: 'node_move',
      data: {
        nodeId: data.nodeId,
        x: data.x,
        y: data.y
      },
      userId,
      timestamp,
      workflowId
    };

    this.addWorkflowUpdate(workflowId, update);
    this.broadcastToWorkflow(workflowId, {
      type: 'workflow_update',
      data: update
    }, userId);
  }

  /**
   * Handle node addition
   */
  private handleNodeAdd(workflowId: string, userId: string, data: any, timestamp: string): void {
    const update: WorkflowUpdate = {
      type: 'node_add',
      data: {
        node: data.node,
        position: data.position
      },
      userId,
      timestamp,
      workflowId
    };

    this.addWorkflowUpdate(workflowId, update);
    this.broadcastToWorkflow(workflowId, {
      type: 'workflow_update',
      data: update
    }, userId);
  }

  /**
   * Handle node deletion
   */
  private handleNodeDelete(workflowId: string, userId: string, data: any, timestamp: string): void {
    const update: WorkflowUpdate = {
      type: 'node_delete',
      data: {
        nodeId: data.nodeId
      },
      userId,
      timestamp,
      workflowId
    };

    this.addWorkflowUpdate(workflowId, update);
    this.broadcastToWorkflow(workflowId, {
      type: 'workflow_update',
      data: update
    }, userId);
  }

  /**
   * Handle node updates
   */
  private handleNodeUpdate(workflowId: string, userId: string, data: any, timestamp: string): void {
    const update: WorkflowUpdate = {
      type: 'node_update',
      data: {
        nodeId: data.nodeId,
        updates: data.updates
      },
      userId,
      timestamp,
      workflowId
    };

    this.addWorkflowUpdate(workflowId, update);
    this.broadcastToWorkflow(workflowId, {
      type: 'workflow_update',
      data: update
    }, userId);
  }

  /**
   * Handle connection addition
   */
  private handleConnectionAdd(workflowId: string, userId: string, data: any, timestamp: string): void {
    const update: WorkflowUpdate = {
      type: 'connection_add',
      data: {
        connection: data.connection
      },
      userId,
      timestamp,
      workflowId
    };

    this.addWorkflowUpdate(workflowId, update);
    this.broadcastToWorkflow(workflowId, {
      type: 'workflow_update',
      data: update
    }, userId);
  }

  /**
   * Handle connection deletion
   */
  private handleConnectionDelete(workflowId: string, userId: string, data: any, timestamp: string): void {
    const update: WorkflowUpdate = {
      type: 'connection_delete',
      data: {
        connectionId: data.connectionId
      },
      userId,
      timestamp,
      workflowId
    };

    this.addWorkflowUpdate(workflowId, update);
    this.broadcastToWorkflow(workflowId, {
      type: 'workflow_update',
      data: update
    }, userId);
  }

  /**
   * Handle node selection
   */
  private handleNodeSelect(workflowId: string, userId: string, data: any): void {
    const session = this.sessions.get(workflowId);
    if (!session) return;

    const collaborator = session.collaborators.get(userId);
    if (!collaborator) return;

    collaborator.activeNode = data.nodeId;

    // Broadcast selection to other users
    this.broadcastToWorkflow(workflowId, {
      type: 'node_selection',
      data: {
        userId,
        nodeId: data.nodeId,
        timestamp: new Date().toISOString()
      }
    }, userId);
  }

  /**
   * Handle typing indicators
   */
  private handleTypingStart(workflowId: string, userId: string, data: any): void {
    this.broadcastToWorkflow(workflowId, {
      type: 'typing_indicator',
      data: {
        userId,
        nodeId: data.nodeId,
        isTyping: true,
        timestamp: new Date().toISOString()
      }
    }, userId);
  }

  private handleTypingEnd(workflowId: string, userId: string, data: any): void {
    this.broadcastToWorkflow(workflowId, {
      type: 'typing_indicator',
      data: {
        userId,
        nodeId: data.nodeId,
        isTyping: false,
        timestamp: new Date().toISOString()
      }
    }, userId);
  }

  /**
   * Add update to workflow history
   */
  private addWorkflowUpdate(workflowId: string, update: WorkflowUpdate): void {
    const session = this.sessions.get(workflowId);
    if (!session) return;

    session.updates.push(update);

    // Keep only last 100 updates
    if (session.updates.length > 100) {
      session.updates = session.updates.slice(-100);
    }

    // In production, persist to DynamoDB
    this.persistUpdate(update);
  }

  /**
   * Persist update to storage
   */
  private async persistUpdate(update: WorkflowUpdate): Promise<void> {
    try {
      // In production, save to DynamoDB
      this.logger.debug('Persisting workflow update:', update);
    } catch (error) {
      this.logger.error('Failed to persist workflow update:', error);
    }
  }

  /**
   * Broadcast message to all users in a workflow
   */
  private broadcastToWorkflow(workflowId: string, message: any, excludeUserId?: string): void {
    const session = this.sessions.get(workflowId);
    if (!session) return;

    for (const [userId, collaborator] of session.collaborators) {
      if (userId !== excludeUserId) {
        this.sendToUser(userId, message);
      }
    }
  }

  /**
   * Send message to specific user
   */
  private sendToUser(userId: string, message: any): void {
    const socket = this.userSockets.get(userId);
    if (socket && socket.readyState === WebSocket.OPEN) {
      try {
        socket.send(JSON.stringify(message));
      } catch (error) {
        this.logger.error(`Failed to send message to user ${userId}:`, error);
        this.userSockets.delete(userId);
      }
    }
  }

  /**
   * Get active collaborators for a workflow
   */
  getActiveCollaborators(workflowId: string): WorkflowCollaborator[] {
    const session = this.sessions.get(workflowId);
    if (!session) return [];

    return Array.from(session.collaborators.values());
  }

  /**
   * Get recent updates for a workflow
   */
  getRecentUpdates(workflowId: string, limit: number = 20): WorkflowUpdate[] {
    const session = this.sessions.get(workflowId);
    if (!session) return [];

    return session.updates.slice(-limit);
  }

  /**
   * Clean up inactive sessions
   */
  cleanupInactiveSessions(): void {
    const now = Date.now();
    const maxAge = 30 * 60 * 1000; // 30 minutes

    for (const [workflowId, session] of this.sessions) {
      const lastActivity = new Date(session.lastActivity).getTime();

      if (now - lastActivity > maxAge) {
        this.sessions.delete(workflowId);
        this.logger.info(`Cleaned up inactive session for workflow ${workflowId}`);
      }
    }
  }

  /**
   * Get session statistics
   */
  getSessionStats(): {
    activeSessions: number;
    totalCollaborators: number;
    updatesInLast24h: number;
  } {
    let totalCollaborators = 0;
    let updatesInLast24h = 0;
    const yesterday = Date.now() - 24 * 60 * 60 * 1000;

    for (const session of this.sessions.values()) {
      totalCollaborators += session.collaborators.size;

      updatesInLast24h += session.updates.filter(
        update => new Date(update.timestamp).getTime() > yesterday
      ).length;
    }

    return {
      activeSessions: this.sessions.size,
      totalCollaborators,
      updatesInLast24h
    };
  }
}

export default CollaborativeWorkflowService;