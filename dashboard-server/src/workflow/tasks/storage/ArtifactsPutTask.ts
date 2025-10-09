import { WorkflowTask, WorkflowContext } from '../../types/workflow.js';
import { TaskExecutionError } from '../../errors/TaskExecutionError.js';

export interface ArtifactsPutInput {
  key: string;
  content: string;
  contentType?: string;
  encode?: boolean; // Auto-encode to base64 if true
  stringifyJson?: boolean; // Auto-stringify JSON objects
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

      // Auto-stringify JSON if requested
      if (input.stringifyJson && typeof content === 'object') {
        try {
          content = JSON.stringify(content);
          stringified = true;
        } catch (error) {
          this.logger?.warn('Failed to stringify JSON content', { key: input.key, error });
        }
      }

      // Auto-encode to base64 if requested
      if (input.encode) {
        try {
          content = Buffer.from(content as string).toString('base64');
          encoded = true;
        } catch (error) {
          this.logger?.warn('Failed to encode content to base64', { key: input.key, error });
        }
      }

      // Determine content type
      const contentType = input.contentType || this.inferContentType(input.key, content);

      // Store artifact in S3
      const result = await this.artifactsService.put(input.key, content, {
        contentType,
        metadata: input.metadata
      });

      const executionTime = Date.now() - startTime;

      this.logger?.info('Artifact stored successfully', {
        key: input.key,
        size: content.length,
        contentType,
        encoded,
        stringified,
        executionTime
      });

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
      const executionTime = Date.now() - startTime;

      this.logger?.error('Failed to store artifact', {
        key: input.key,
        error: error instanceof Error ? error.message : String(error),
        executionTime
      });

      throw new TaskExecutionError(
        this.type,
        context.nodeId || 'unknown',
        `Failed to store artifact: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  private inferContentType(key: string, content: any): string {
    // Try to infer from file extension
    const ext = key.split('.').pop()?.toLowerCase();
    const extensionMap: Record<string, string> = {
      json: 'application/json',
      txt: 'text/plain',
      html: 'text/html',
      xml: 'application/xml',
      csv: 'text/csv',
      pdf: 'application/pdf',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      svg: 'image/svg+xml',
      zip: 'application/zip',
      gz: 'application/gzip'
    };

    if (ext && extensionMap[ext]) {
      return extensionMap[ext];
    }

    // Try to infer from content
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

    if (!input.key) {
      errors.push('Artifact key is required');
    } else if (typeof input.key !== 'string') {
      errors.push('Artifact key must be a string');
    } else if (input.key.length === 0) {
      errors.push('Artifact key cannot be empty');
    }

    if (input.content === undefined || input.content === null) {
      errors.push('Content is required');
    }

    if (input.stringifyJson && typeof input.content !== 'object') {
      warnings.push('stringifyJson specified but content is not an object');
    }

    if (input.encode && typeof input.content !== 'string') {
      warnings.push('encode specified but content is not a string');
    }

    if (input.metadata) {
      for (const [key, value] of Object.entries(input.metadata)) {
        if (typeof value !== 'string') {
          errors.push(`Metadata value for key "${key}" must be a string`);
        }
      }
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
        required: ['key', 'content'],
        properties: {
          key: {
            type: 'string',
            description: 'Artifact key (file path)',
            minLength: 1
          },
          content: {
            type: 'string',
            description: 'Content to store (string or object if stringifyJson is true)'
          },
          contentType: {
            type: 'string',
            description: 'MIME content type (auto-detected if not provided)',
            examples: ['application/json', 'text/plain', 'image/png']
          },
          encode: {
            type: 'boolean',
            description: 'Automatically encode content to base64',
            default: false
          },
          stringifyJson: {
            type: 'boolean',
            description: 'Automatically stringify JSON objects',
            default: false
          },
          metadata: {
            type: 'object',
            description: 'Additional metadata key-value pairs',
            additionalProperties: { type: 'string' }
          }
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
      tags: ['storage', 's3', 'files', 'artifacts', 'upload', 'store']
    };
  }
}
