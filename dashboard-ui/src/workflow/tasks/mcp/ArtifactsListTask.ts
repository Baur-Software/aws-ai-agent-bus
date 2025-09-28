// MCP Artifacts List Task
// Lists artifacts from the MCP artifact store

import {
  WorkflowTask,
  WorkflowContext,
  ValidationResult,
  TaskConfigSchema,
  TaskDisplayInfo,
  Logger,
  TaskExecutionError,
  NODE_CATEGORIES
} from '../../types';

import { MCPService } from '../../../services';

export interface ArtifactsListInput {
  prefix?: string;
  limit?: number;
}

export interface ArtifactsListOutput {
  artifacts: Array<{
    key: string;
    size: number;
    lastModified: string;
    contentType?: string;
  }>;
  count: number;
  prefix: string;
  timestamp: string;
}

export class ArtifactsListTask implements WorkflowTask<ArtifactsListInput, ArtifactsListOutput> {
  readonly type = 'artifacts-list';

  constructor(
    private mcpService: MCPService,
    private logger?: Logger
  ) {}

  async execute(input: ArtifactsListInput, context: WorkflowContext): Promise<ArtifactsListOutput> {
    const prefix = input.prefix || '';
    this.logger?.info(`Listing artifacts with prefix: ${prefix}`);

    try {
      const artifactList = await this.mcpService.artifactsList(prefix);
      
      // Apply limit if specified
      const limitedArtifacts = input.limit
        ? artifactList.artifacts.slice(0, input.limit)
        : artifactList.artifacts;

      const artifacts = limitedArtifacts.map(artifact => ({
        key: artifact.key,
        size: artifact.size,
        lastModified: artifact.last_modified,
        contentType: artifact.content_type
      }));

      const output: ArtifactsListOutput = {
        artifacts,
        count: artifacts.length,
        prefix,
        timestamp: new Date().toISOString()
      };

      this.logger?.info(`Found ${artifacts.length} artifacts with prefix: ${prefix}`);

      // Store in context for downstream tasks
      context.data.artifactList = artifacts;
      context.data.artifactCount = artifacts.length;

      return output;

    } catch (error) {
      this.logger?.error('Failed to list artifacts:', error);
      throw new TaskExecutionError(
        `MCP artifacts list failed: ${error.message}`,
        this.type,
        context.nodeId,
        input
      );
    }
  }

  validate(input: ArtifactsListInput): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (input.limit !== undefined) {
      if (input.limit < 1) {
        errors.push('Limit must be at least 1');
      }
      if (input.limit > 1000) {
        errors.push('Limit cannot exceed 1000');
      }
      if (input.limit > 100) {
        warnings.push('Large limits may impact performance');
      }
    }

    if (input.prefix && input.prefix.length > 512) {
      errors.push('Prefix cannot exceed 512 characters');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  getSchema(): TaskConfigSchema {
    return {
      type: 'object',
      title: 'List Artifacts',
      description: 'List artifacts from the MCP artifact store',
      properties: {
        prefix: {
          type: 'string',
          title: 'Prefix Filter',
          description: 'Optional prefix to filter artifacts (leave empty for all)'
        },
        limit: {
          type: 'number',
          title: 'Limit Results',
          description: 'Maximum number of artifacts to return',
          minimum: 1,
          maximum: 1000,
          default: 50
        }
      },
      required: [],
      examples: [
        {
          prefix: 'reports/',
          limit: 10
        },
        {
          prefix: 'workflows/2024/',
          limit: 25
        }
      ]
    };
  }

  getDisplayInfo(): TaskDisplayInfo {
    return {
      category: NODE_CATEGORIES.MCP_TOOLS,
      label: 'Artifacts List',
      icon: 'FolderOpen',
      color: 'bg-blue-600',
      description: 'List artifacts from artifact store',
      tags: ['mcp', 'artifacts', 'storage', 'list']
    };
  }
}