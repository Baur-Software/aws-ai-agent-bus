// Trello Create Card Task - Stub implementation for testing
import { WorkflowTask, WorkflowContext, Logger, TaskExecutionError, NODE_CATEGORIES, INTEGRATION_KEYS } from '../../types';

export interface TrelloCreateCardInput {
  listId: string;
  name: string;
  description?: string;
  position?: 'top' | 'bottom';
}

export interface TrelloCreateCardOutput {
  id: string;
  name: string;
  url: string;
  success: boolean;
  timestamp: string;
}

export class TrelloCreateCardTask implements WorkflowTask<TrelloCreateCardInput, TrelloCreateCardOutput> {
  readonly type = 'trello-create-card';

  constructor(
    private trelloService: any,
    private logger?: Logger
  ) {}

  getDisplayInfo() {
    return {
      category: NODE_CATEGORIES.INTEGRATION,
      label: 'Create Trello Card',
      icon: 'Plus',
      color: 'bg-blue-600',
      description: 'Create a new card in Trello',
      tags: ['trello', 'create', 'card'],
      integrationRequired: INTEGRATION_KEYS.TRELLO
    };
  }

  getSchema() {
    return {
      title: 'Create Trello Card',
      properties: {
        listId: { type: 'string', description: 'ID of the Trello list' },
        name: { type: 'string', description: 'Card title' },
        description: { type: 'string', description: 'Card description' },
        position: { 
          type: 'string', 
          enum: ['top', 'bottom'],
          description: 'Position in the list'
        }
      },
      required: ['listId', 'name']
    };
  }

  validate(input: any) {
    const errors: string[] = [];
    
    if (!input.listId?.trim()) {
      errors.push('List ID is required');
    }
    
    if (!input.name?.trim()) {
      errors.push('Card name is required');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: []
    };
  }

  async execute(input: TrelloCreateCardInput, context: WorkflowContext): Promise<TrelloCreateCardOutput> {
    this.logger?.info(`Creating Trello card: ${input.name}`);

    try {
      const result = await this.trelloService.createCard(input);

      context.data.trelloCardId = result.id;
      context.data.trelloCardUrl = result.url;

      this.logger?.info(`Successfully created Trello card: ${result.id}`);

      return {
        id: result.id,
        name: result.name,
        url: result.url,
        success: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger?.error('Failed to create Trello card:', error);
      throw new TaskExecutionError(`Trello create card failed: ${error.message}`);
    }
  }
}