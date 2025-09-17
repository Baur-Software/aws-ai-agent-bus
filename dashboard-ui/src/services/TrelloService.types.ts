// TrelloService interface for abstraction
export interface TrelloService {
  createCard(params: TrelloCardParams): Promise<TrelloCard>;
  createBoard(params: TrelloBoardParams): Promise<TrelloBoard>;
  getBoards(): Promise<TrelloBoard[]>;
  addToList(params: TrelloListParams): Promise<TrelloListResult>;
}

// Example types (expand as needed)
export interface TrelloCardParams {
  name: string;
  description?: string;
  listId: string;
  dueDate?: string;
  labels?: string[];
}

export interface TrelloCard {
  id: string;
  name: string;
  url: string;
  shortLink: string;
  dateCreated: string;
}

export interface TrelloBoardParams {
  name: string;
}

export interface TrelloBoard {
  id: string;
  name: string;
}

export interface TrelloListParams {
  listId: string;
  cardId: string;
}

export interface TrelloListResult {
  success: boolean;
}
