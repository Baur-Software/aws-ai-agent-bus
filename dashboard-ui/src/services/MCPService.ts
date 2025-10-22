// MCP Service Client
// Provides abstraction over MCP tool calls for KV store, artifacts, events, and workflows

export interface MCPClient {
  callTool(tool: string, params: any): Promise<any>;
}

export class MCPService {
  constructor(private client: MCPClient) {}

  // KV Store Operations
  async kvSet(key: string, value: any, ttl_hours?: number): Promise<any> {
    return this.client.callTool('kv.set', {
      key,
      value,
      ttl_hours
    });
  }

  async kvGet(key: string): Promise<any> {
    return this.client.callTool('kv.get', { key });
  }

  async kvDelete(key: string): Promise<any> {
    return this.client.callTool('kv.delete', { key });
  }

  async kvList(prefix?: string): Promise<any> {
    return this.client.callTool('kv.list', { prefix });
  }

  // Artifacts Operations
  async artifactsList(prefix?: string): Promise<any> {
    return this.client.callTool('artifacts.list', { prefix });
  }

  async artifactsGet(key: string): Promise<any> {
    return this.client.callTool('artifacts.get', { key });
  }

  async artifactsPut(key: string, content: any, content_type?: string): Promise<any> {
    return this.client.callTool('artifacts.put', {
      key,
      content,
      content_type
    });
  }

  async artifactsDelete(key: string): Promise<any> {
    return this.client.callTool('artifacts.delete', { key });
  }

  // Events Operations
  async eventsSend(detailType: string, detail: any, source?: string): Promise<any> {
    return this.client.callTool('events.send', {
      detailType,
      detail,
      source
    });
  }

  async eventsQuery(params: any): Promise<any> {
    return this.client.callTool('events.query', params);
  }

  async eventsAnalytics(params: any): Promise<any> {
    return this.client.callTool('events.analytics', params);
  }

  // Workflow Operations
  async workflowStart(workflowName: string, input: any): Promise<any> {
    return this.client.callTool('workflow.start', {
      workflowName,
      input
    });
  }

  async workflowStatus(executionArn: string): Promise<any> {
    return this.client.callTool('workflow.status', {
      executionArn
    });
  }

  async workflowStop(executionArn: string): Promise<any> {
    return this.client.callTool('workflow.stop', {
      executionArn
    });
  }

  async workflowList(): Promise<any> {
    return this.client.callTool('workflow.list', {});
  }
}

export function createMCPService(client: MCPClient): MCPService {
  return new MCPService(client);
}
