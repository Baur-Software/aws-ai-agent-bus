// Trello Service Client
// Provides clean abstraction over Trello API calls

export interface TrelloCardParams {
  name: string;
  desc?: string;
  idList: string;
  due?: string;
  labels?: string[];
  members?: string[];
  pos?: 'top' | 'bottom' | number;
}

export interface TrelloCard {
  id: string;
  name: string;
  desc: string;
  url: string;
  shortLink: string;
  shortUrl: string;
  dateCreated: string;
  dateLastActivity: string;
  idList: string;
  idBoard: string;
  due?: string;
  labels: TrelloLabel[];
  members: TrelloMember[];
}

export interface TrelloLabel {
  id: string;
  name: string;
  color: string;
}

export interface TrelloMember {
  id: string;
  fullName: string;
  username: string;
  avatarUrl?: string;
}

export interface TrelloBoardParams {
  name: string;
  desc?: string;
  prefs_permissionLevel?: 'private' | 'public' | 'org';
  defaultLists?: boolean;
}

export interface TrelloBoard {
  id: string;
  name: string;
  desc: string;
  url: string;
  shortUrl: string;
  dateCreated: string;
  lists: TrelloList[];
  members: TrelloMember[];
  prefs: BoardPrefs;
}

export interface BoardPrefs {
  permissionLevel: string;
  background: string;
  backgroundColor?: string;
}

export interface TrelloListParams {
  name: string;
  idBoard: string;
  pos?: 'top' | 'bottom' | number;
}

export interface TrelloList {
  id: string;
  name: string;
  pos: number;
  idBoard: string;
  closed: boolean;
}

export interface TrelloListAddParams {
  cardId: string;
  listId: string;
  position?: 'top' | 'bottom' | number;
}

export interface TrelloListResult {
  success: boolean;
  cardId: string;
  listId: string;
  position: string | number;
}

export class TrelloService {
  private apiKey?: string;
  private token?: string;
  private baseUrl = 'https://api.trello.com/1';

  constructor(config: { apiKey?: string; token?: string } = {}) {
    this.apiKey = config.apiKey;
    this.token = config.token;
  }

  // Set credentials (useful for dependency injection)
  setCredentials(apiKey: string, token: string): void {
    this.apiKey = apiKey;
    this.token = token;
  }

  async createCard(params: TrelloCardParams): Promise<TrelloCard> {
    this.validateCredentials();

    try {
      const requestBody = {
        name: params.name,
        desc: params.desc || '',
        idList: params.idList,
        due: params.due,
        pos: params.pos || 'bottom'
      };

      const response = await this.makeRequest('POST', '/cards', requestBody);
      
      const card: TrelloCard = {
        id: response.id,
        name: response.name,
        desc: response.desc,
        url: response.url,
        shortLink: response.shortLink,
        shortUrl: response.shortUrl,
        dateCreated: response.dateLastActivity,
        dateLastActivity: response.dateLastActivity,
        idList: response.idList,
        idBoard: response.idBoard,
        due: response.due,
        labels: response.labels || [],
        members: response.members || []
      };

      return card;
    } catch (error) {
      throw new TrelloError(`Failed to create card: ${error.message}`, 'CREATE_CARD', params);
    }
  }

  async createBoard(params: TrelloBoardParams): Promise<TrelloBoard> {
    this.validateCredentials();

    try {
      const requestBody = {
        name: params.name,
        desc: params.desc || '',
        prefs_permissionLevel: params.prefs_permissionLevel || 'private',
        defaultLists: params.defaultLists !== false // Default to true
      };

      const response = await this.makeRequest('POST', '/boards', requestBody);

      // Fetch lists for the board
      const lists = await this.getBoardLists(response.id);

      const board: TrelloBoard = {
        id: response.id,
        name: response.name,
        desc: response.desc,
        url: response.url,
        shortUrl: response.shortUrl,
        dateCreated: response.dateLastActivity,
        lists,
        members: response.members || [],
        prefs: {
          permissionLevel: response.prefs.permissionLevel,
          background: response.prefs.background,
          backgroundColor: response.prefs.backgroundColor
        }
      };

      return board;
    } catch (error) {
      throw new TrelloError(`Failed to create board: ${error.message}`, 'CREATE_BOARD', params);
    }
  }

  async getBoards(): Promise<TrelloBoard[]> {
    this.validateCredentials();

    try {
      const response = await this.makeRequest('GET', '/members/me/boards');
      
      const boards: TrelloBoard[] = response.map((board: any) => ({
        id: board.id,
        name: board.name,
        desc: board.desc,
        url: board.url,
        shortUrl: board.shortUrl,
        dateCreated: board.dateLastActivity,
        lists: [], // Will be populated if needed
        members: board.members || [],
        prefs: {
          permissionLevel: board.prefs.permissionLevel,
          background: board.prefs.background,
          backgroundColor: board.prefs.backgroundColor
        }
      }));

      return boards;
    } catch (error) {
      throw new TrelloError(`Failed to get boards: ${error.message}`, 'GET_BOARDS', {});
    }
  }

  async getBoardLists(boardId: string): Promise<TrelloList[]> {
    this.validateCredentials();

    try {
      const response = await this.makeRequest('GET', `/boards/${boardId}/lists`);
      
      const lists: TrelloList[] = response.map((list: any) => ({
        id: list.id,
        name: list.name,
        pos: list.pos,
        idBoard: list.idBoard,
        closed: list.closed
      }));

      return lists;
    } catch (error) {
      throw new TrelloError(`Failed to get board lists: ${error.message}`, 'GET_BOARD_LISTS', { boardId });
    }
  }

  async addToList(params: TrelloListAddParams): Promise<TrelloListResult> {
    this.validateCredentials();

    try {
      const requestBody = {
        idList: params.listId,
        pos: params.position || 'bottom'
      };

      await this.makeRequest('PUT', `/cards/${params.cardId}`, requestBody);

      return {
        success: true,
        cardId: params.cardId,
        listId: params.listId,
        position: params.position || 'bottom'
      };
    } catch (error) {
      throw new TrelloError(`Failed to add card to list: ${error.message}`, 'ADD_TO_LIST', params);
    }
  }

  async createList(params: TrelloListParams): Promise<TrelloList> {
    this.validateCredentials();

    try {
      const requestBody = {
        name: params.name,
        idBoard: params.idBoard,
        pos: params.pos || 'bottom'
      };

      const response = await this.makeRequest('POST', '/lists', requestBody);

      const list: TrelloList = {
        id: response.id,
        name: response.name,
        pos: response.pos,
        idBoard: response.idBoard,
        closed: response.closed
      };

      return list;
    } catch (error) {
      throw new TrelloError(`Failed to create list: ${error.message}`, 'CREATE_LIST', params);
    }
  }

  // Utility methods
  async validateCredentials(): Promise<boolean> {
    if (!this.apiKey || !this.token) {
      throw new TrelloError('API key and token are required', 'INVALID_CREDENTIALS', {});
    }

    try {
      await this.makeRequest('GET', '/members/me');
      return true;
    } catch (error) {
      throw new TrelloError('Invalid credentials', 'INVALID_CREDENTIALS', {});
    }
  }

  private async makeRequest(method: string, endpoint: string, body?: any): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    const searchParams = new URLSearchParams({
      key: this.apiKey!,
      token: this.token!
    });

    const requestOptions: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (method === 'GET') {
      // Add query parameters for GET requests
      if (body) {
        Object.entries(body).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            searchParams.append(key, value.toString());
          }
        });
      }
    } else {
      // Add body for POST/PUT requests
      if (body) {
        requestOptions.body = JSON.stringify(body);
      }
    }

    const fullUrl = `${url}?${searchParams.toString()}`;
    const response = await fetch(fullUrl, requestOptions);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    return response.json();
  }

  // Helper method to get default list IDs from a board
  async getDefaultLists(boardId: string): Promise<{ todo: string; doing: string; done: string }> {
    const lists = await this.getBoardLists(boardId);
    
    const todoList = lists.find(l => l.name.toLowerCase().includes('to do') || l.name.toLowerCase().includes('todo'));
    const doingList = lists.find(l => l.name.toLowerCase().includes('doing') || l.name.toLowerCase().includes('progress'));
    const doneList = lists.find(l => l.name.toLowerCase().includes('done') || l.name.toLowerCase().includes('complete'));

    return {
      todo: todoList?.id || lists[0]?.id || '',
      doing: doingList?.id || lists[1]?.id || '',
      done: doneList?.id || lists[2]?.id || ''
    };
  }
}

export class TrelloError extends Error {
  constructor(
    message: string,
    public operation: string,
    public params: any
  ) {
    super(message);
    this.name = 'TrelloError';
  }
}

// Factory function for easy instantiation
export function createTrelloService(config: { apiKey?: string; token?: string } = {}): TrelloService {
  return new TrelloService(config);
}