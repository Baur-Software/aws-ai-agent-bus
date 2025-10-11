import { WorkflowTask, WorkflowContext, TaskExecutionError, ValidationResult } from '../../types';

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
      if (input.prefix) options.prefix = input.prefix;
      if (input.maxKeys) options.maxKeys = Math.min(input.maxKeys, 1000);
      if (input.continuationToken) options.continuationToken = input.continuationToken;

      const result = await this.artifactsService.list(options);

      const artifacts: ArtifactItem[] = (result.artifacts || []).map((item: any) => ({
        key: item.key,
        size: item.size || 0,
        lastModified: item.lastModified || new Date().toISOString(),
        contentType: item.contentType
      }));

      const totalSize = artifacts.reduce((sum, item) => sum + item.size, 0);

      const executionTime = Date.now() - startTime;
      this.logger?.info?.('Artifacts listed', { count: artifacts.length, executionTime });

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
      this.logger?.error?.('Failed to list artifacts', { error });

      throw new TaskExecutionError(`Failed to list artifacts: ${error instanceof Error ? error.message : String(error)}`, this.type, context.nodeId || 'unknown', error instanceof Error ? error : undefined
      );
    }
  }

  validate(input: ArtifactsListInput): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (input.maxKeys !== undefined && input.maxKeys < 1) {
      errors.push('maxKeys must be at least 1');
    }

    if (input.maxKeys !== undefined && input.maxKeys > 1000) {
      warnings.push('maxKeys will be capped at 1000');
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  getSchema() {
    return {
      input: {
        type: 'object',
        properties: {
          prefix: { type: 'string', description: 'Filter by key prefix' },
          maxKeys: { type: 'number', description: 'Max keys to return (max 1000)', default: 100 },
          continuationToken: { type: 'string', description: 'Pagination token' }
        }
      },
      output: {
        type: 'object',
        properties: {
          artifacts: { type: 'array', items: { type: 'object' } },
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
      tags: ['storage', 's3', 'files', 'artifacts', 'list']
    };
  }
}
