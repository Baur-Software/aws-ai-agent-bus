// Abstract base interface for all integrations
export interface IntegrationAgent {
  id: string; // Unique identifier for the integration
  name: string;
  description?: string;

  // Connect to the service (OAuth, API key, etc.)
  connect(credentials: Record<string, any>): Promise<boolean>;

  // Test the connection
  testConnection(): Promise<boolean>;

  // Execute an action (e.g., send message, upload file)
  executeAction(action: string, params: Record<string, any>): Promise<any>;

  // Listen for triggers/events (e.g., webhook, polling)
  listenTrigger(trigger: string, handler: (event: any) => void): void;

  // Disconnect/cleanup
  disconnect(): Promise<void>;
}

// Composite manager for all integrations
export class IntegrationManager {
  private agents: Map<string, IntegrationAgent> = new Map();

  register(agent: IntegrationAgent) {
    this.agents.set(agent.id, agent);
  }

  getAgent(id: string): IntegrationAgent | undefined {
    return this.agents.get(id);
  }

  listAgents(): IntegrationAgent[] {
    return Array.from(this.agents.values());
  }

  async execute(id: string, action: string, params: Record<string, any>) {
    const agent = this.getAgent(id);
    if (!agent) throw new Error(`Integration agent '${id}' not found.`);
    return await agent.executeAction(action, params);
  }
}

// Example: Dropbox integration agent
export class DropboxAgent implements IntegrationAgent {
  id = 'dropbox';
  name = 'Dropbox';
  description = 'Dropbox file storage integration';
  private connected = false;

  async connect(credentials: { accessToken: string }): Promise<boolean> {
    // Simulate connection logic
    this.connected = !!credentials.accessToken;
    return this.connected;
  }

  async testConnection(): Promise<boolean> {
    // Simulate test
    return this.connected;
  }

  async executeAction(action: string, params: Record<string, any>): Promise<any> {
    if (!this.connected) throw new Error('Not connected');
    // Simulate actions: upload, download, list files
    switch (action) {
      case 'upload':
        return { success: true, file: params.fileName };
      case 'list':
        return ['file1.txt', 'file2.txt'];
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  listenTrigger(trigger: string, handler: (event: any) => void): void {
    // Simulate event listening
    // e.g., handler({ event: 'file_uploaded', file: 'file1.txt' })
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }
}

// Usage example
const manager = new IntegrationManager();
manager.register(new DropboxAgent());
// manager.execute('dropbox', 'upload', { fileName: 'test.txt' });
