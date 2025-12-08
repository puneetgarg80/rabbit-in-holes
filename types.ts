export enum GameStatus {
  PLAYING = 'PLAYING',
  WON = 'WON',
  LOST = 'LOST', // Theoretically hard to reach in this specific puzzle logic unless defined by turn limit
}

export interface HistoryEntry {
  day: number;
  checkedHoleIndex: number; // 0-based
  found: boolean;
  rabbitMoveDirection?: 'left' | 'right'; // Only revealed in debug or maybe end game? (Usually hidden)
}

export interface GameState {
  holeCount: number;
  rabbitIndex: number; // 0-based index of where the rabbit is
  day: number;
  history: HistoryEntry[];
  status: GameStatus;
  lastCheckedIndex: number | null;
  rabbitPath: number[]; // Stores the position of the rabbit for each day
}

export interface HintResponse {
  text: string;
  suggestedHole?: number;
}