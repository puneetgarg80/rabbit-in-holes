export enum GameStatus {
  PLAYING = 'PLAYING',
  WON = 'WON',
  LOST = 'LOST',
}

export interface HistoryEntry {
  day: number;
  checkedHoleIndex: number; // 0-based
  found: boolean;
  remainingPossibilitiesCount: number; // How many holes could the mouse be in after this check?
}

export interface GameState {
  holeCount: number;
  possibleHoles: number[]; // The set of all holes the mouse *could* be in currently
  candidatesHistory: number[][]; // Snapshots of possibleHoles for each day (for backtracking replay)
  day: number;
  history: HistoryEntry[];
  status: GameStatus;
  lastCheckedIndex: number | null;
  mousePath: number[]; // Generated at the end of the game for replay
}
