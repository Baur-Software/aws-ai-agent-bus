// MCP Artifacts Put Task
// Stores content as an artifact in the MCP artifact store

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

export interface ArtifactsPutInput {
  key: string;
  content: any;
  contentType?: string;
  stringifyJSON?: boolean;
  useContextData?: boolean;
  contextKey?: string;
}

export interface ArtifactsPutOutput {
  key: string;
  size: number;
  contentType: string;
  success: boolean;
  timestamp: string;
}

export class ArtifactsPutTask implements WorkflowTask<ArtifactsPutInput, ArtifactsPutOutput> {
  readonly type = 'artifacts-put';

  constructor(
    private mcpService: MCPService,
    private logger?: Logger
  ) {}

  async execute(input: ArtifactsPutInput, context: WorkflowContext): Promise<ArtifactsPutOutput> {
    this.logger?.info(`Storing artifact: ${input.key}`);

    try {
      // Determine content source
      let content = input.content;
      
      if (input.useContextData) {
        const contextKey = input.contextKey || 'previousResult';
        content = context.data[contextKey];
        
        if (content === undefined) {
          throw new Error(`Context data key '${contextKey}' not found`);
        }
      }

      // Handle content formatting
      let finalContent: string;
      let contentType = input.contentType || 'text/plain';

      if (typeof content === 'string') {
        finalContent = content;
      } else if (input.stringifyJSON !== false && typeof content === 'object') {
        finalContent = JSON.stringify(content, null, 2);
        contentType = input.contentType || 'application/json';
      } else {
        finalContent = String(content);
      }

      // Store the artifact
      await this.mcpService.artifactsPut(input.key, finalContent, contentType);

      const output: ArtifactsPutOutput = {
        key: input.key,
        size: finalContent.length,
        contentType,
        success: true,
        timestamp: new Date().toISOString()
      };

      this.logger?.info(`Successfully stored artifact: ${input.key} (${finalContent.length} bytes)`);

      // Store in context for downstream tasks
      context.data.artifactKey = input.key;
      context.data.artifactSize = finalContent.length;

      return output;

    } catch (error) {
      this.logger?.error('Failed to store artifact:', error);
      throw new TaskExecutionError(
        `MCP artifacts put failed: ${error.message}`,
        this.type,
        context.nodeId,
        input
      );
    }
  }

  validate(input: ArtifactsPutInput): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!input.key || input.key.trim().length === 0) {
      errors.push('Key is required');
    }

    if (input.key && input.key.length > 1024) {
      errors.push('Key cannot exceed 1024 characters');
    }

    if (!input.useContextData && (input.content === undefined || input.content === null)) {
      errors.push('Content is required when not using context data');
    }

    if (input.useContextData && !input.contextKey) {
      warnings.push('No context key specified, will use "previousResult"');
    }

    // Content type validation
    if (input.contentType) {
      const validTypes = [
        'text/plain', 'text/html', 'text/css', 'text/javascript',
        'application/json', 'application/xml', 'application/pdf',
        'image/png', 'image/jpeg', 'image/gif', 'image/svg+xml'
      ];
      
      const isValidType = validTypes.some(type => 
        input.contentType!.toLowerCase().startsWith(type)
      );
      
      if (!isValidType) {
        warnings.push(`Content type '${input.contentType}' may not be recognized`);
      }
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
      title: 'Store Artifact',
      description: 'Store content as an artifact in the artifact store',
      properties: {
        key: {
          type: 'string',
          title: 'Artifact Key',
          description: 'Unique key identifier for the artifact'
        },
        content: {
          type: 'string',
          title: 'Content',
          description: 'Content to store (not used if useContextData is true)'
        },
        contentType: {
          type: 'string',
          title: 'Content Type',
          description: 'MIME type of the content',
          default: 'text/plain',
          enum: [
            'text/plain',
            'text/html',
            'text/css',
            'text/javascript',
            'application/json',
            'application/xml',
            'application/pdf',
            'image/png',
            'image/jpeg',
            'image/gif',
            'image/svg+xml'
          ]
        },
        stringifyJSON: {
          type: 'boolean',
          title: 'Stringify JSON',
          description: 'Convert objects to JSON strings automatically',
          default: true
        },
        useContextData: {
          type: 'boolean',
          title: 'Use Context Data',
          description: 'Use data from workflow context instead of content field',
          default: false
        },
        contextKey: {
          type: 'string',
          title: 'Context Data Key',
          description: 'Key to use from context data (defaults to "previousResult")',
          default: 'previousResult'
        }
      },
      required: ['key'],
      examples: [
        {
          key: 'reports/analytics-2024-01.json',
          useContextData: true,
          contextKey: 'analyticsData',
          contentType: 'application/json'
        },
        {
          key: 'templates/report-template.html',
          content: '<html><body>{{content}}</body></html>',
          contentType: 'text/html'
        }
      ]
    };
  }

  getDisplayInfo(): TaskDisplayInfo {
    return {
      category: NODE_CATEGORIES.MCP_TOOLS,
      label: 'Artifacts Put',
      icon: 'Save',
      color: 'bg-blue-600',
      description: 'Store content as an artifact',
      tags: ['mcp', 'artifacts', 'storage', 'save', 'store']
    };
  }
}