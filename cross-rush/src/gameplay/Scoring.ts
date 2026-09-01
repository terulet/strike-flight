/**
 * Scoring.ts
 *
 * Formato de tiempo (mm:ss.mmm), calculo de STYLE SCORE, y persistencia del
 * mejor tiempo en localStorage.
 */

import { DEFAULT_MISSION_ID, StorageScope, storageKey } from '../config/GameConfig';
import { LandingQuality, TrickResult } from './types';

export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const totalMs = Math.round(seconds * 1000);
  const mm = Math.floor(totalMs / 60000);
  const ss = Math.floor((totalMs % 60000) / 1000);
  const ms = totalMs % 1000;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

const LANDING_POINTS: Record<LandingQuality, number> = {
  PERFECT: 300,
  GOOD: 130,
  ROUGH: 20,
  BAD: -50,
  CRASH: -200,
};

const TRICK_POINTS = 450;

export class StyleScore {
  private _score = 0;
  private _perfectLandings = 0;
  private _tricks = 0;

  get score(): number {
    return Math.max(0, Math.round(this._score));
  }

  get perfectLandings(): number {
    return this._perfectLandings;
  }

  get tricks(): number {
    return this._tricks;
  }

  reset(): void {
    this._score = 0;
    this._perfectLandings = 0;
    this._tricks = 0;
  }

  registerLanding(quality: LandingQuality, scoreMultiplier: number): void {
    this._score += LANDING_POINTS[quality] * scoreMultiplier;
    if (quality === 'PERFECT') this._perfectLandings += 1;
  }

  registerTrick(_trick: TrickResult, scoreMultiplier: number): void {
    this._score += TRICK_POINTS * scoreMultiplier;
    this._tricks += 1;
  }
}

function safeLocalStorage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

export function loadBestTime(missionId: string = DEFAULT_MISSION_ID, scope: StorageScope = 'jugador'): number | null {
  const storage = safeLocalStorage();
  if (!storage) return null;
  const raw = storage.getItem(storageKey('best-time', missionId, scope));
  if (raw === null) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

/** Devuelve true si el nuevo tiempo mejora (y por tanto persiste) el record. */
export function saveBestTimeIfBetter(
  candidateSeconds: number,
  currentBest: number | null,
  missionId: string = DEFAULT_MISSION_ID,
  scope: StorageScope = 'jugador',
): boolean {
  if (currentBest !== null && candidateSeconds >= currentBest) return false;
  const storage = safeLocalStorage();
  if (storage) storage.setItem(storageKey('best-time', missionId, scope), String(candidateSeconds));
  return true;
}
