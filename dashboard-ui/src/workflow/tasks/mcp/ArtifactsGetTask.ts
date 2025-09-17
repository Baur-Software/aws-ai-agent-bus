// MCP Artifacts Get Task
// Retrieves a specific artifact from the MCP artifact store

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

export interface ArtifactsGetInput {
  key: string;
  parseJSON?: boolean;
}

export interface ArtifactsGetOutput {
  key: string;
  content: any;
  contentType: string;
  size: number;
  lastModified: string;
  parsed: boolean;
  timestamp: string;
}

export class ArtifactsGetTask implements WorkflowTask<ArtifactsGetInput, ArtifactsGetOutput> {
  readonly type = 'artifacts-get';

  constructor(
    private mcpService: MCPService,
    private logger?: Logger
  ) {}

  async execute(input: ArtifactsGetInput, context: WorkflowContext): Promise<ArtifactsGetOutput> {
    this.logger?.info(`Getting artifact: ${input.key}`);

    try {
      const artifact = await this.mcpService.artifactsGet(input.key);
      
      let content = artifact.content;
      let parsed = false;

      // Auto-parse JSON if requested or if content type is JSON
      if (input.parseJSON || artifact.contentType?.includes('json')) {
        try {
          content = JSON.parse(artifact.content);
          parsed = true;
          this.logger?.info(`Parsed JSON content for artifact: ${input.key}`);
        } catch (parseError) {
          this.logger?.warn(`Failed to parse JSON for artifact ${input.key}:`, parseError);
          // Keep original content if parsing fails
        }
      }

      const output: ArtifactsGetOutput = {
        key: input.key,
        content,
        contentType: artifact.contentType,
        size: artifact.size,
        lastModified: artifact.lastModified,
        parsed,
        timestamp: new Date().toISOString()
      };

      this.logger?.info(`Successfully retrieved artifact: ${input.key} (${artifact.size} bytes)`);

      // Store in context for downstream tasks
      context.data.artifactContent = content;
      context.data.artifactKey = input.key;
      context.data.artifactMetadata = {
        contentType: artifact.contentType,
        size: artifact.size,
        lastModified: artifact.lastModified
      };

      return output;

    } catch (error) {
      this.logger?.error('Failed to get artifact:', error);
      throw new TaskExecutionError(
        `MCP artifacts get failed: ${error.message}`,
        this.type,
        context.nodeId,
        input
      );
    }
  }

  validate(input: ArtifactsGetInput): ValidationResult {
    const errors: string[] = [];

    if (!input.key || input.key.trim().length === 0) {
      errors.push('Key is required');
    }

    if (input.key && input.key.length > 1024) {
      errors.push('Key cannot exceed 1024 characters');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  getSchema(): TaskConfigSchema {
    return {
      type: 'object',
      title: 'Get Artifact',
      description: 'Retrieve a specific artifact from the artifact store',
      properties: {
        key: {
          type: 'string',
          title: 'Artifact Key',
          description: 'Unique key identifier for the artifact'
        },
        parseJSON: {
          type: 'boolean',
          title: 'Parse JSON',
          description: 'Automatically parse content as JSON if possible',
          default: false
        }
      },
      required: ['key'],
      examples: [
        {
          key: 'reports/monthly-analytics-2024-01.json',
          parseJSON: true
        },
        {
          key: 'templates/email-template.html'
        }
      ]
    };
  }

  getDisplayInfo(): TaskDisplayInfo {
    return {
      category: NODE_CATEGORIES.MCP_TOOLS,
      label: 'Artifacts Get',
      icon: 'FileText',
      color: 'bg-blue-600',
      description: 'Retrieve a specific artifact from storage',
      tags: ['mcp', 'artifacts', 'storage', 'retrieve', 'file']
    };
  }
}