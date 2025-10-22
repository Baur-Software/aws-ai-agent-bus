import { useDashboardServer } from '../contexts/DashboardServerContext';
import { useOrganization } from '../contexts/OrganizationContext';

/**
 * Artifact Service - Context-aware S3 storage for workflows, shapes, and files
 *
 * Path Structure:
 * - Personal: users/{userId}/workflows/{workflowId}.json
 * - Organizational: orgs/{orgId}/workflows/{workflowId}.json
 * - Custom Shapes: users/{userId}/shapes/{shapeId}.json OR orgs/{orgId}/shapes/{shapeId}.json
 * - Templates: templates/{category}/{templateId}.json (system-wide)
 */

export type ArtifactType = 'workflow' | 'shape' | 'template' | 'integration' | 'agent' | 'file';
export type ArtifactContext = 'personal' | 'organizational' | 'system';

interface ArtifactMetadata {
  key: string;
  type: ArtifactType;
  context: ArtifactContext;
  contentType?: string;
  size?: number;
  createdAt?: string;
  updatedAt?: string;
  tags?: string[];
}

interface SaveArtifactOptions {
  type: ArtifactType;
  context?: ArtifactContext;
  contentType?: string;
  tags?: string[];
  metadata?: Record<string, any>;
}

export class ArtifactService {
  private callMCPTool: (tool: string, params: any) => Promise<any>;
  private userId: () => string | undefined;
  private organizationId: () => string | undefined;

  constructor(
    callMCPTool: (tool: string, params: any) => Promise<any>,
    userId: () => string | undefined,
    organizationId: () => string | undefined
  ) {
    this.callMCPTool = callMCPTool;
    this.userId = userId;
    this.organizationId = organizationId;
  }

  /**
   * Build artifact key based on context
   */
  private buildKey(id: string, type: ArtifactType, context?: ArtifactContext): string {
    const effectiveContext = context || (this.organizationId() ? 'organizational' : 'personal');

    switch (effectiveContext) {
      case 'personal':
        return `users/${this.userId()}/${type}s/${id}.json`;
      case 'organizational':
        if (!this.organizationId()) {
          throw new Error('No organization context available');
        }
        return `orgs/${this.organizationId()}/${type}s/${id}.json`;
      case 'system':
        return `system/${type}s/${id}.json`;
      default:
        throw new Error(`Unknown context: ${effectiveContext}`);
    }
  }

  /**
   * Save artifact to S3
   */
  async save(
    id: string,
    data: any,
    options: SaveArtifactOptions
  ): Promise<{ success: boolean; key: string }> {
    const key = this.buildKey(id, options.type, options.context);

    // Prepare content
    const content = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    const base64Content = btoa(content);

    // Save via MCP artifacts_put
    const result = await this.callMCPTool('artifacts_put', {
      key,
      content: base64Content,
      content_type: options.contentType || 'application/json',
      metadata: {
        type: options.type,
        context: options.context || (this.organizationId() ? 'organizational' : 'personal'),
        userId: this.userId(),
        organizationId: this.organizationId(),
        tags: options.tags || [],
        ...options.metadata,
        updatedAt: new Date().toISOString()
      }
    });

    return {
      success: result?.success || false,
      key
    };
  }

  /**
   * Get artifact from S3
   */
  async get(id: string, type: ArtifactType, context?: ArtifactContext): Promise<any> {
    const key = this.buildKey(id, type, context);

    const result = await this.callMCPTool('artifacts_get', { key });

    if (!result?.content) {
      return null;
    }

    // Decode base64 content
    const content = atob(result.content);

    // Try to parse as JSON
    try {
      return JSON.parse(content);
    } catch {
      return content;
    }
  }

  /**
   * List artifacts by type and context
   */
  async list(
    type: ArtifactType,
    context?: ArtifactContext
  ): Promise<ArtifactMetadata[]> {
    const effectiveContext = context || (this.organizationId() ? 'organizational' : 'personal');

    let prefix: string;
    switch (effectiveContext) {
      case 'personal':
        prefix = `users/${this.userId()}/${type}s/`;
        break;
      case 'organizational':
        prefix = `orgs/${this.organizationId()}/${type}s/`;
        break;
      case 'system':
        prefix = `system/${type}s/`;
        break;
      default:
        throw new Error(`Unknown context: ${effectiveContext}`);
    }

    const result = await this.callMCPTool('artifacts_list', { prefix });

    if (!result?.artifacts) {
      return [];
    }

    return result.artifacts.map((artifact: any) => ({
      key: artifact.key,
      type,
      context: effectiveContext,
      contentType: artifact.content_type,
      size: artifact.metadata?.size,
      createdAt: artifact.metadata?.createdAt,
      updatedAt: artifact.metadata?.updatedAt,
      tags: artifact.metadata?.tags || []
    }));
  }

  /**
   * Delete artifact
   */
  async delete(id: string, type: ArtifactType, context?: ArtifactContext): Promise<boolean> {
    const key = this.buildKey(id, type, context);

    const result = await this.callMCPTool('artifacts_delete', { key });
    return result?.success || false;
  }

  /**
   * Copy artifact to different context
   */
  async copy(
    id: string,
    type: ArtifactType,
    fromContext: ArtifactContext,
    toContext: ArtifactContext,
    newId?: string
  ): Promise<{ success: boolean; key: string }> {
    // Get from source
    const data = await this.get(id, type, fromContext);

    if (!data) {
      throw new Error('Artifact not found');
    }

    // Save to destination
    return this.save(newId || id, data, { type, context: toContext });
  }

  /**
   * Share workflow (copy from personal to organizational)
   */
  async shareWorkflow(workflowId: string): Promise<{ success: boolean; key: string }> {
    return this.copy(workflowId, 'workflow', 'personal', 'organizational');
  }

  /**
   * Save custom shape
   */
  async saveShape(shapeId: string, shapeData: any, isOrgShape = false): Promise<{ success: boolean; key: string }> {
    return this.save(shapeId, shapeData, {
      type: 'shape',
      context: isOrgShape ? 'organizational' : 'personal',
      tags: shapeData.tags || []
    });
  }

  /**
   * List all workflows in current context
   */
  async listWorkflows(): Promise<ArtifactMetadata[]> {
    const context = this.organizationId() ? 'organizational' : 'personal';
    return this.list('workflow', context);
  }

  /**
   * List all custom shapes in current context
   */
  async listShapes(): Promise<ArtifactMetadata[]> {
    const context = this.organizationId() ? 'organizational' : 'personal';
    return this.list('shape', context);
  }

  /**
   * Search artifacts across contexts
   */
  async search(
    type: ArtifactType,
    query: string,
    contexts: ArtifactContext[] = ['personal', 'organizational']
  ): Promise<ArtifactMetadata[]> {
    const results: ArtifactMetadata[] = [];

    for (const context of contexts) {
      try {
        const artifacts = await this.list(type, context);
        results.push(...artifacts);
      } catch (err) {
        console.warn(`Failed to search ${context} artifacts:`, err);
      }
    }

    // Filter by query
    if (query) {
      const lowerQuery = query.toLowerCase();
      return results.filter(artifact =>
        artifact.key.toLowerCase().includes(lowerQuery) ||
        artifact.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
      );
    }

    return results;
  }
}

/**
 * Hook to use ArtifactService with current context
 */
export function useArtifactService() {
  const { callMCPTool } = useDashboardServer();
  const { user, currentOrganization } = useOrganization();

  return new ArtifactService(
    callMCPTool,
    () => user()?.id,
    () => currentOrganization()?.id
  );
}
