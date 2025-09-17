// MCP Service Client
// Provides clean abstraction over MCP (Model Context Protocol) tool calls

export interface KVGetResult {
  key: string;
  value: any;
  ttl?: number;
  timestamp?: string;
}

export interface KVSetParams {
  key: string;
  value: any;
  ttl_hours?: number;
}

export interface KVSetResult {
  key: string;
  success: boolean;
  ttl?: number;
  timestamp: string;
}

export interface Artifact {
  key: string;
  content: string;
  content_type: string;
  size: number;
  last_modified: string;
  metadata?: Record<string, any>;
}

export interface ArtifactListResult {
  artifacts: Artifact[];
  count: number;
  prefix?: string;
}

export interface ArtifactPutParams {
  key: string;
  content: string;
  content_type?: string;
  metadata?: Record<string, any>;
}

export interface ArtifactPutResult {
  key: string;
  success: boolean;
  size: number;
  content_type: string;
  timestamp: string;
}

export interface EventSendParams {
  detailType: string;
  detail: Record<string, any>;
  source?: string;
}

export interface EventSendResult {
  eventId: string;
  success: boolean;
  timestamp: string;
  source: string;
  detailType: string;
}

export interface WorkflowStartParams {
  name: string;
  input?: Record<string, any>;
}

export interface WorkflowResult {
  executionArn: string;
  startDate: string;
  status: string;
  stateMachineArn?: string;
}

export interface WorkflowStatusParams {
  executionArn: string;
}

export interface WorkflowStatusResult {
  executionArn: string;
  status: 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'TIMED_OUT' | 'ABORTED';
  startDate: string;
  stopDate?: string;
  input?: string;
  output?: string;
  error?: string;
}

export class MCPService {
  private mcpClient: any; // Injected MCP client

  constructor(mcpClient: any) {
    this.mcpClient = mcpClient;
  }

  // Key-Value Store operations
  async kvGet(key: string): Promise<any> {
    try {
      const result = await this.mcpClient.callTool('mcp__aws__kv_get', { key });
      return result.value || null;
    } catch (error) {
      if (error.message?.includes('not found')) {
        return null; // Key doesn't exist
      }
      throw new MCPError(`Failed to get KV pair: ${error.message}`, 'KV_GET', { key });
    }
  }

  async kvSet(key: string, value: any, ttl_hours: number = 24): Promise<KVSetResult> {
    try {
      const result = await this.mcpClient.callTool('mcp__aws__kv_set', {
        key,
        value: typeof value === 'string' ? value : JSON.stringify(value),
        ttl_hours
      });

      return {
        key,
        success: true,
        ttl: ttl_hours,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new MCPError(`Failed to set KV pair: ${error.message}`, 'KV_SET', { key, value, ttl_hours });
    }
  }

  async kvExists(key: string): Promise<boolean> {
    try {
      const value = await this.kvGet(key);
      return value !== null;
    } catch (error) {
      return false;
    }
  }

  // Artifacts operations
  async artifactsList(prefix?: string): Promise<ArtifactListResult> {
    try {
      const result = await this.mcpClient.callTool('mcp__aws__artifacts_list', {
        prefix: prefix || ''
      });

      return {
        artifacts: result.artifacts || [],
        count: result.artifacts?.length || 0,
        prefix
      };
    } catch (error) {
      throw new MCPError(`Failed to list artifacts: ${error.message}`, 'ARTIFACTS_LIST', { prefix });
    }
  }

  async artifactsGet(key: string): Promise<Artifact | null> {
    try {
      const result = await this.mcpClient.callTool('mcp__aws__artifacts_get', { key });
      
      if (!result) {
        return null;
      }

      return {
        key,
        content: result.content || '',
        content_type: result.content_type || 'text/plain',
        size: result.size || result.content?.length || 0,
        last_modified: result.last_modified || new Date().toISOString(),
        metadata: result.metadata || {}
      };
    } catch (error) {
      if (error.message?.includes('not found')) {
        return null;
      }
      throw new MCPError(`Failed to get artifact: ${error.message}`, 'ARTIFACTS_GET', { key });
    }
  }

  async artifactsPut(params: ArtifactPutParams): Promise<ArtifactPutResult> {
    try {
      const result = await this.mcpClient.callTool('mcp__aws__artifacts_put', {
        key: params.key,
        content: params.content,
        content_type: params.content_type || 'text/plain'
      });

      return {
        key: params.key,
        success: true,
        size: params.content.length,
        content_type: params.content_type || 'text/plain',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new MCPError(`Failed to put artifact: ${error.message}`, 'ARTIFACTS_PUT', params);
    }
  }

  async artifactsExists(key: string): Promise<boolean> {
    try {
      const artifact = await this.artifactsGet(key);
      return artifact !== null;
    } catch (error) {
      return false;
    }
  }

  // Event operations
  async eventsSend(params: EventSendParams): Promise<EventSendResult> {
    try {
      const result = await this.mcpClient.callTool('mcp__aws__events_send', {
        detailType: params.detailType,
        detail: params.detail,
        source: params.source || 'workflow-engine'
      });

      return {
        eventId: result.eventId || `evt_${Date.now()}`,
        success: true,
        timestamp: new Date().toISOString(),
        source: params.source || 'workflow-engine',
        detailType: params.detailType
      };
    } catch (error) {
      throw new MCPError(`Failed to send event: ${error.message}`, 'EVENTS_SEND', params);
    }
  }

  // Workflow operations (Step Functions)
  async workflowStart(params: WorkflowStartParams): Promise<WorkflowResult> {
    try {
      const result = await this.mcpClient.callTool('mcp__aws__workflow_start', {
        name: params.name,
        input: params.input || {}
      });

      return {
        executionArn: result.executionArn,
        startDate: result.startDate,
        status: result.status || 'RUNNING',
        stateMachineArn: result.stateMachineArn
      };
    } catch (error) {
      throw new MCPError(`Failed to start workflow: ${error.message}`, 'WORKFLOW_START', params);
    }
  }

  async workflowStatus(params: WorkflowStatusParams): Promise<WorkflowStatusResult> {
    try {
      const result = await this.mcpClient.callTool('mcp__aws__workflow_status', {
        executionArn: params.executionArn
      });

      return {
        executionArn: params.executionArn,
        status: result.status,
        startDate: result.startDate,
        stopDate: result.stopDate,
        input: result.input,
        output: result.output,
        error: result.error
      };
    } catch (error) {
      throw new MCPError(`Failed to get workflow status: ${error.message}`, 'WORKFLOW_STATUS', params);
    }
  }

  // Utility methods for common patterns
  async storeWorkflowResult(workflowId: string, result: any, ttl_hours: number = 24): Promise<void> {
    const key = `workflow-result-${workflowId}`;
    await this.kvSet(key, result, ttl_hours);
  }

  async getWorkflowResult(workflowId: string): Promise<any> {
    const key = `workflow-result-${workflowId}`;
    return await this.kvGet(key);
  }

  async storeWorkflowArtifact(workflowId: string, content: string, contentType: string = 'application/json'): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const key = `workflow-${workflowId}-${timestamp}`;
    
    await this.artifactsPut({
      key,
      content,
      content_type: contentType
    });

    return key;
  }

  async publishWorkflowEvent(workflowId: string, eventType: string, data: any): Promise<void> {
    await this.eventsSend({
      detailType: eventType,
      detail: {
        workflowId,
        timestamp: new Date().toISOString(),
        ...data
      },
      source: 'workflow-engine'
    });
  }

  // Batch operations
  async kvBatchGet(keys: string[]): Promise<Record<string, any>> {
    const results: Record<string, any> = {};
    
    await Promise.all(
      keys.map(async (key) => {
        try {
          const value = await this.kvGet(key);
          if (value !== null) {
            results[key] = value;
          }
        } catch (error) {
          // Skip errors for individual keys
          console.warn(`Failed to get key ${key}:`, error.message);
        }
      })
    );

    return results;
  }

  async kvBatchSet(entries: Array<{ key: string; value: any; ttl_hours?: number }>): Promise<KVSetResult[]> {
    const results: KVSetResult[] = [];

    await Promise.all(
      entries.map(async (entry) => {
        try {
          const result = await this.kvSet(entry.key, entry.value, entry.ttl_hours);
          results.push(result);
        } catch (error) {
          console.error(`Failed to set key ${entry.key}:`, error.message);
          results.push({
            key: entry.key,
            success: false,
            timestamp: new Date().toISOString()
          });
        }
      })
    );

    return results;
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      const testKey = `health-check-${Date.now()}`;
      const testValue = 'OK';
      
      // Test KV operations
      await this.kvSet(testKey, testValue, 1); // 1 hour TTL
      const retrieved = await this.kvGet(testKey);
      
      return retrieved === testValue;
    } catch (error) {
      console.error('MCP health check failed:', error);
      return false;
    }
  }
}

export class MCPError extends Error {
  constructor(
    message: string,
    public operation: string,
    public params: any
  ) {
    super(message);
    this.name = 'MCPError';
  }
}

// Factory function for easy instantiation
export function createMCPService(mcpClient: any): MCPService {
  return new MCPService(mcpClient);
}