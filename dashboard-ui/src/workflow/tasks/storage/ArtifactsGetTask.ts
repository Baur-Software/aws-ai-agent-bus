import { WorkflowTask, WorkflowContext, TaskExecutionError, ValidationResult } from '../../types';

export interface ArtifactsGetInput {
  key: string;
  decode?: boolean;
  parseJson?: boolean;
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
      const result = await this.artifactsService.get(input.key);

      if (!result || !result.content) {
        throw new TaskExecutionError(`Artifact not found: ${input.key}`, this.type, context.nodeId || 'unknown');
      }

      let content = result.content;
      let decoded = false;
      let parsed = false;

      if (input.decode) {
        try {
          content = atob(content);
          decoded = true;
        } catch (error) {
          this.logger?.warn?.('Failed to decode base64 content', { key: input.key });
        }
      }

      if (input.parseJson) {
        try {
          content = JSON.parse(content);
          parsed = true;
        } catch (error) {
          this.logger?.warn?.('Failed to parse JSON content', { key: input.key });
        }
      }

      const executionTime = Date.now() - startTime;
      this.logger?.info?.('Artifact retrieved', { key: input.key, executionTime });

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
      this.logger?.error?.('Failed to retrieve artifact', { key: input.key, error });

      if (error instanceof TaskExecutionError) {
        throw error;
      }

      throw new TaskExecutionError(`Failed to retrieve artifact: ${error instanceof Error ? error.message : String(error)}`, this.type, context.nodeId || 'unknown', error instanceof Error ? error : undefined
      );
    }
  }

  validate(input: ArtifactsGetInput): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!input.key) {
      errors.push('Artifact key is required');
    }

    if (input.parseJson && !input.decode) {
      warnings.push('parseJson without decode assumes content is already a string');
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  getSchema() {
    return {
      input: {
        type: 'object',
        required: ['key'],
        properties: {
          key: { type: 'string', description: 'Artifact key to retrieve' },
          decode: { type: 'boolean', description: 'Auto-decode base64', default: false },
          parseJson: { type: 'boolean', description: 'Auto-parse JSON', default: false }
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
      tags: ['storage', 's3', 'files', 'artifacts', 'download']
    };
  }
}
