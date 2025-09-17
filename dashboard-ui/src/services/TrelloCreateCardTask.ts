import { TrelloService, TrelloCardParams, TrelloCard } from './TrelloService.types';
import { TaskRegistry } from './TaskRegistry';

// WorkflowTask interface for Trello tasks
export interface WorkflowTask<TInput = any, TOutput = any> {
  readonly type: string;
  execute(input: TInput, context: any): Promise<TOutput>;
  validate?(input: TInput): { isValid: boolean; errors: string[] };
  getSchema?(): any;
}

// TrelloCreateCardTask implementation
export class TrelloCreateCardTask implements WorkflowTask<TrelloCardParams, TrelloCard> {
  readonly type = 'trello-create-card';
  private trelloService: TrelloService;

  constructor(trelloService: TrelloService) {
    this.trelloService = trelloService;
  }

  async execute(input: TrelloCardParams, context: any): Promise<TrelloCard> {
    // Add logging/context as needed
    return await this.trelloService.createCard(input);
  }

  validate(input: TrelloCardParams) {
    const errors: string[] = [];
    if (!input.name || input.name.trim().length === 0) errors.push('Card name is required');
    if (!input.listId) errors.push('List ID is required');
    return { isValid: errors.length === 0, errors };
  }

  getSchema() {
    return {
      title: 'Create Trello Card',
      description: 'Create a new card in a Trello list',
      properties: {
        name: { type: 'string', title: 'Card Name' },
        description: { type: 'string', title: 'Description' },
        listId: { type: 'string', title: 'List ID' },
        dueDate: { type: 'string', format: 'date', title: 'Due Date' },
        labels: { type: 'array', items: { type: 'string' }, title: 'Labels' }
      },
      required: ['name', 'listId']
    };
  }
}

// Register TrelloCreateCardTask in TaskRegistry (example usage)
// const registry = new TaskRegistry();
// registry.registerTask('trello-create-card', new TrelloCreateCardTask(trelloServiceInstance));
