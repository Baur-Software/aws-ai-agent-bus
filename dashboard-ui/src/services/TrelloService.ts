// Trello Service Client
// Provides abstraction over Trello API calls through MCP

export interface MCPClient {
  callTool(tool: string, params: any): Promise<any>;
}

export interface TrelloCreateCardParams {
  listId: string;
  name: string;
  description?: string;
  position?: 'top' | 'bottom' | number;
  dueDate?: string;
  labels?: string[];
  members?: string[];
}

export interface TrelloCreateBoardParams {
  name: string;
  description?: string;
  visibility?: 'private' | 'public' | 'org';
  defaultLists?: boolean;
}

export interface TrelloCreateListParams {
  boardId: string;
  name: string;
  position?: 'top' | 'bottom' | number;
}

export class TrelloService {
  constructor(private client: MCPClient) {}

  async createCard(params: TrelloCreateCardParams): Promise<any> {
    return this.client.callTool('trello.createCard', params);
  }

  async getCard(cardId: string): Promise<any> {
    return this.client.callTool('trello.getCard', { cardId });
  }

  async updateCard(cardId: string, updates: Partial<TrelloCreateCardParams>): Promise<any> {
    return this.client.callTool('trello.updateCard', { cardId, ...updates });
  }

  async deleteCard(cardId: string): Promise<any> {
    return this.client.callTool('trello.deleteCard', { cardId });
  }

  async createBoard(params: TrelloCreateBoardParams): Promise<any> {
    return this.client.callTool('trello.createBoard', params);
  }

  async getBoard(boardId: string): Promise<any> {
    return this.client.callTool('trello.getBoard', { boardId });
  }

  async updateBoard(boardId: string, updates: Partial<TrelloCreateBoardParams>): Promise<any> {
    return this.client.callTool('trello.updateBoard', { boardId, ...updates });
  }

  async deleteBoard(boardId: string): Promise<any> {
    return this.client.callTool('trello.deleteBoard', { boardId });
  }

  async createList(params: TrelloCreateListParams): Promise<any> {
    return this.client.callTool('trello.createList', params);
  }

  async getList(listId: string): Promise<any> {
    return this.client.callTool('trello.getList', { listId });
  }

  async getLists(boardId: string): Promise<any> {
    return this.client.callTool('trello.getLists', { boardId });
  }

  async getCards(listId: string): Promise<any> {
    return this.client.callTool('trello.getCards', { listId });
  }
}

export function createTrelloService(client: MCPClient): TrelloService {
  return new TrelloService(client);
}
