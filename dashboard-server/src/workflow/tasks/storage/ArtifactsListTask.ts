import { WorkflowTask, WorkflowContext } from '../../types/workflow.js';
import { TaskExecutionError } from '../../errors/TaskExecutionError.js';

export interface ArtifactsListInput {
  prefix?: string;
  maxKeys?: number;
  continuationToken?: string;
}

export interface ArtifactItem {
  key: string;
  size: number;
  lastModified: string;
  contentType?: string;
}

export interface ArtifactsListOutput {
  artifacts: ArtifactItem[];
  count: number;
  hasMore: boolean;
  continuationToken?: string;
  prefix?: string;
  totalSize: number;
  success: boolean;
  timestamp: string;
}

export class ArtifactsListTask implements WorkflowTask<ArtifactsListInput, ArtifactsListOutput> {
  readonly type = 'artifacts-list';

  constructor(
    private artifactsService: any,
    private logger?: any
  ) {}

  async execute(input: ArtifactsListInput, context: WorkflowContext): Promise<ArtifactsListOutput> {
    const startTime = Date.now();

    try {
      const options: any = {};

      if (input.prefix) {
        options.prefix = input.prefix;
      }

      if (input.maxKeys) {
        options.maxKeys = Math.min(input.maxKeys, 1000); // Cap at 1000
      }

      if (input.continuationToken) {
        options.continuationToken = input.continuationToken;
      }

      // List artifacts from S3
      const result = await this.artifactsService.list(options);

      const artifacts: ArtifactItem[] = (result.artifacts || []).map((item: any) => ({
        key: item.key,
        size: item.size || 0,
        lastModified: item.lastModified || new Date().toISOString(),
        contentType: item.contentType
      }));

      const totalSize = artifacts.reduce((sum, item) => sum + item.size, 0);

      const executionTime = Date.now() - startTime;

      this.logger?.info('Artifacts listed successfully', {
        prefix: input.prefix,
        count: artifacts.length,
        totalSize,
        hasMore: result.hasMore || false,
        executionTime
      });

      return {
        artifacts,
        count: artifacts.length,
        hasMore: result.hasMore || false,
        continuationToken: result.continuationToken,
        prefix: input.prefix,
        totalSize,
        success: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;

      this.logger?.error('Failed to list artifacts', {
        prefix: input.prefix,
        error: error instanceof Error ? error.message : String(error),
        executionTime
      });

      throw new TaskExecutionError(
        this.type,
        context.nodeId || 'unknown',
        `Failed to list artifacts: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  async validate(input: ArtifactsListInput): Promise<{ valid: boolean; errors: string[]; warnings: string[] }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (input.prefix !== undefined && typeof input.prefix !== 'string') {
      errors.push('Prefix must be a string');
    }

    if (input.maxKeys !== undefined) {
      if (typeof input.maxKeys !== 'number') {
        errors.push('maxKeys must be a number');
      } else if (input.maxKeys < 1) {
        errors.push('maxKeys must be at least 1');
      } else if (input.maxKeys > 1000) {
        warnings.push('maxKeys will be capped at 1000');
      }
    }

    if (input.continuationToken !== undefined && typeof input.continuationToken !== 'string') {
      errors.push('continuationToken must be a string');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  getSchema() {
    return {
      input: {
        type: 'object',
        properties: {
          prefix: {
            type: 'string',
            description: 'Filter artifacts by key prefix (e.g., "uploads/", "reports/")',
            examples: ['uploads/', 'reports/', 'user-123/']
          },
          maxKeys: {
            type: 'number',
            description: 'Maximum number of keys to return (max 1000)',
            minimum: 1,
            maximum: 1000,
            default: 100
          },
          continuationToken: {
            type: 'string',
            description: 'Token from previous list operation for pagination'
          }
        }
      },
      output: {
        type: 'object',
        properties: {
          artifacts: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                key: { type: 'string' },
                size: { type: 'number' },
                lastModified: { type: 'string', format: 'date-time' },
                contentType: { type: 'string' }
              }
            }
          },
          count: { type: 'number' },
          hasMore: { type: 'boolean' },
          continuationToken: { type: 'string' },
          prefix: { type: 'string' },
          totalSize: { type: 'number' },
          success: { type: 'boolean' },
          timestamp: { type: 'string', format: 'date-time' }
        }
      }
    };
  }

  getDisplayInfo() {
    return {
      name: 'List Artifacts',
      description: 'List files in S3 artifact storage',
      category: 'Storage',
      icon: 'list',
      color: '#FF9800',
      tags: ['storage', 's3', 'files', 'artifacts', 'list', 'browse']
    };
  }
}
