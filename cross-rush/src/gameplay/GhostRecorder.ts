/**
 * GhostRecorder.ts
 *
 * Graba (timestamp, x, y, rotation) a intervalos regulares durante una
 * carrera y persiste el fantasma de la mejor vuelta en localStorage. El
 * renderizado del sprite fantasma no es obligatorio en el milestone 001,
 * pero los datos quedan listos para usarlo.
 */

import { GhostConfig, StorageKeys } from '../config/GameConfig';

export interface GhostFrame {
  t: number;
  x: number;
  y: number;
  rotation: number;
}

export class GhostRecorder {
  private frames: GhostFrame[] = [];
  private timeSinceSample = Infinity;

  reset(): void {
    this.frames = [];
    this.timeSinceSample = Infinity;
  }

  get recordedFrames(): readonly GhostFrame[] {
    return this.frames;
  }

  record(t: number, x: number, y: number, rotation: number, dt: number): void {
    this.timeSinceSample += dt;
    if (this.timeSinceSample < GhostConfig.sampleInterval) return;
    this.timeSinceSample = 0;
    this.frames.push({ t, x, y, rotation });
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

export function saveBestGhost(frames: readonly GhostFrame[]): void {
  const storage = safeLocalStorage();
  if (!storage) return;
  try {
    storage.setItem(StorageKeys.bestGhost, JSON.stringify(frames));
  } catch {
    // Cuota de almacenamiento excedida u otro fallo no critico: se ignora.
  }
}

export function loadBestGhost(): GhostFrame[] | null {
  const storage = safeLocalStorage();
  if (!storage) return null;
  const raw = storage.getItem(StorageKeys.bestGhost);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as GhostFrame[];
    if (!Array.isArray(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}
