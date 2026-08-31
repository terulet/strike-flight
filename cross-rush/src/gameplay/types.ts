export type LandingQuality = 'PERFECT' | 'GOOD' | 'ROUGH' | 'BAD' | 'CRASH';

export type TrickType = 'FRONTFLIP' | 'BACKFLIP';

export interface TrickResult {
  type: TrickType;
  rotations: number;
}

export type GameState = 'READY' | 'COUNTDOWN' | 'RACING' | 'CRASHED' | 'FINISHED';
