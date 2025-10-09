import { WorkflowTask, WorkflowContext } from '../../types/workflow.js';
import { TaskExecutionError } from '../../errors/TaskExecutionError.js';

export interface ArtifactsGetInput {
  key: string;
  decode?: boolean; // Auto-decode base64 if true
  parseJson?: boolean; // Auto-parse JSON if true
}

export interface ArtifactsGetOutput {
  key: string;
  content: string;
  contentType?: string;
  size: number;
  decoded: boolean;
  parsed: boolean;
  metadata?: Record<string, any>;
  lastModified?: string;
  success: boolean;
  timestamp: string;
}

export class ArtifactsGetTask implements WorkflowTask<ArtifactsGetInput, ArtifactsGetOutput> {
  readonly type = 'artifacts-get';

  constructor(
    private artifactsService: any,
    private logger?: any
  ) {}

  async execute(input: ArtifactsGetInput, context: WorkflowContext): Promise<ArtifactsGetOutput> {
    const startTime = Date.now();

    try {
      // Retrieve artifact from S3
      const result = await this.artifactsService.get(input.key);

      if (!result || !result.content) {
        throw new TaskExecutionError(
          this.type,
          context.nodeId || 'unknown',
          `Artifact not found: ${input.key}`
        );
      }

      let content = result.content;
      let decoded = false;
      let parsed = false;

      // Auto-decode base64 if requested
      if (input.decode) {
        try {
          content = Buffer.from(content, 'base64').toString('utf-8');
          decoded = true;
        } catch (error) {
          this.logger?.warn('Failed to decode base64 content', { key: input.key, error });
        }
      }

      // Auto-parse JSON if requested
      if (input.parseJson) {
        try {
          content = JSON.parse(content);
          parsed = true;
        } catch (error) {
          this.logger?.warn('Failed to parse JSON content', { key: input.key, error });
        }
      }

      const executionTime = Date.now() - startTime;

      this.logger?.info('Artifact retrieved successfully', {
        key: input.key,
        size: result.content.length,
        decoded,
        parsed,
        executionTime
      });

      return {
        key: input.key,
        content,
        contentType: result.contentType,
        size: result.content.length,
        decoded,
        parsed,
        metadata: result.metadata,
        lastModified: result.lastModified,
        success: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;

      this.logger?.error('Failed to retrieve artifact', {
        key: input.key,
        error: error instanceof Error ? error.message : String(error),
        executionTime
      });

      if (error instanceof TaskExecutionError) {
        throw error;
      }

      throw new TaskExecutionError(
        this.type,
        context.nodeId || 'unknown',
        `Failed to retrieve artifact: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  async validate(input: ArtifactsGetInput): Promise<{ valid: boolean; errors: string[]; warnings: string[] }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!input.key) {
      errors.push('Artifact key is required');
    } else if (typeof input.key !== 'string') {
      errors.push('Artifact key must be a string');
    } else if (input.key.length === 0) {
      errors.push('Artifact key cannot be empty');
    }

    if (input.parseJson && !input.decode) {
      warnings.push('parseJson without decode assumes content is already a string');
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
        required: ['key'],
        properties: {
          key: {
            type: 'string',
            description: 'Artifact key to retrieve',
            minLength: 1
          },
          decode: {
            type: 'boolean',
            description: 'Automatically decode base64 content',
            default: false
          },
          parseJson: {
            type: 'boolean',
            description: 'Automatically parse JSON content',
            default: false
          }
        }
      },
      output: {
        type: 'object',
        properties: {
          key: { type: 'string' },
          content: { type: 'string' },
          contentType: { type: 'string' },
          size: { type: 'number' },
          decoded: { type: 'boolean' },
          parsed: { type: 'boolean' },
          metadata: { type: 'object' },
          lastModified: { type: 'string' },
          success: { type: 'boolean' },
          timestamp: { type: 'string', format: 'date-time' }
        }
      }
    };
  }

  getDisplayInfo() {
    return {
      name: 'Get Artifact',
      description: 'Retrieve a file from S3 artifact storage',
      category: 'Storage',
      icon: 'download',
      color: '#FF9800',
      tags: ['storage', 's3', 'files', 'artifacts', 'download', 'retrieve']
    };
  }
}
