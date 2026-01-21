
export enum GameState {
  START = 'START',
  PLAYING = 'PLAYING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  VICTORY = 'VICTORY',
  RANKING_ENTRY = 'RANKING_ENTRY'
}

export enum ShapeType {
  CIRCLE = 'CIRCLE',
  TRIANGLE = 'TRIANGLE',
  SQUARE = 'SQUARE',
  STAR = 'STAR',
  HEART = 'HEART',
  CLOUD = 'CLOUD',
  BIRD = 'BIRD',
  BUTTERFLY = 'BUTTERFLY',
  GHOST = 'GHOST',
  UMBRELLA = 'UMBRELLA'
}

export interface Point {
  x: number;
  y: number;
}

export interface LevelConfig {
  level: number;
  shape: ShapeType;
  stressGain: number;
  precision: number;
  requiredCoverage: number;
}

export interface RankingRecord {
  name: string;
  level: number;
  totalTime: number;
  date: string;
}
