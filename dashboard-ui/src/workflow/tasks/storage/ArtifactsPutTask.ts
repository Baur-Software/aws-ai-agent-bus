import { WorkflowTask, WorkflowContext } from '../../types/workflow';
import { TaskExecutionError } from '../../errors/TaskExecutionError';

export interface ArtifactsPutInput {
  key: string;
  content: string;
  contentType?: string;
  encode?: boolean;
  stringifyJson?: boolean;
  metadata?: Record<string, string>;
}

export interface ArtifactsPutOutput {
  key: string;
  url?: string;
  size: number;
  contentType: string;
  encoded: boolean;
  stringified: boolean;
  success: boolean;
  timestamp: string;
}

export class ArtifactsPutTask implements WorkflowTask<ArtifactsPutInput, ArtifactsPutOutput> {
  readonly type = 'artifacts-put';

  constructor(
    private artifactsService: any,
    private logger?: any
  ) {}

  async execute(input: ArtifactsPutInput, context: WorkflowContext): Promise<ArtifactsPutOutput> {
    const startTime = Date.now();

    try {
      let content = input.content;
      let encoded = false;
      let stringified = false;

      if (input.stringifyJson && typeof content === 'object') {
        content = JSON.stringify(content);
        stringified = true;
      }

      if (input.encode) {
        content = btoa(content as string);
        encoded = true;
      }

      const contentType = input.contentType || this.inferContentType(input.key, content);

      const result = await this.artifactsService.put(input.key, content, {
        contentType,
        metadata: input.metadata
      });

      const executionTime = Date.now() - startTime;
      this.logger?.info?.('Artifact stored', { key: input.key, executionTime });

      return {
        key: input.key,
        url: result.url,
        size: content.length,
        contentType,
        encoded,
        stringified,
        success: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger?.error?.('Failed to store artifact', { key: input.key, error });

      throw new TaskExecutionError(
        this.type,
        context.nodeId || 'unknown',
        `Failed to store artifact: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  private inferContentType(key: string, content: any): string {
    const ext = key.split('.').pop()?.toLowerCase();
    const map: Record<string, string> = {
      json: 'application/json',
      txt: 'text/plain',
      html: 'text/html',
      xml: 'application/xml',
      csv: 'text/csv',
      pdf: 'application/pdf',
      png: 'image/png',
      jpg: 'image/jpeg'
    };

    if (ext && map[ext]) return map[ext];

    if (typeof content === 'string') {
      try {
        JSON.parse(content);
        return 'application/json';
      } catch {
        return 'text/plain';
      }
    }

    return 'application/octet-stream';
  }

  async validate(input: ArtifactsPutInput): Promise<{ valid: boolean; errors: string[]; warnings: string[] }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!input.key) errors.push('Artifact key is required');
    if (input.content === undefined) errors.push('Content is required');

    if (input.stringifyJson && typeof input.content !== 'object') {
      warnings.push('stringifyJson specified but content is not an object');
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  getSchema() {
    return {
      input: {
        type: 'object',
        required: ['key', 'content'],
        properties: {
          key: { type: 'string', description: 'Artifact key (file path)' },
          content: { type: 'string', description: 'Content to store' },
          contentType: { type: 'string', description: 'MIME type (auto-detected)' },
          encode: { type: 'boolean', description: 'Encode to base64', default: false },
          stringifyJson: { type: 'boolean', description: 'Stringify JSON', default: false },
          metadata: { type: 'object', description: 'Additional metadata' }
        }
      },
      output: {
        type: 'object',
        properties: {
          key: { type: 'string' },
          url: { type: 'string' },
          size: { type: 'number' },
          contentType: { type: 'string' },
          encoded: { type: 'boolean' },
          stringified: { type: 'boolean' },
          success: { type: 'boolean' },
          timestamp: { type: 'string', format: 'date-time' }
        }
      }
    };
  }

  getDisplayInfo() {
    return {
      name: 'Put Artifact',
      description: 'Store a file to S3 artifact storage',
      category: 'Storage',
      icon: 'upload',
      color: '#FF9800',
      tags: ['storage', 's3', 'files', 'artifacts', 'upload']
    };
  }
}
