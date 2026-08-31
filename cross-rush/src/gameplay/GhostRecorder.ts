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

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpAngle(a: number, b: number, t: number): number {
  let delta = b - a;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return a + delta * t;
}

export function sampleGhostAtTime(frames: readonly GhostFrame[], time: number): GhostFrame | null {
  if (frames.length === 0 || time > frames[frames.length - 1].t) return null;
  if (time <= frames[0].t) return { ...frames[0] };
  let low = 0;
  let high = frames.length - 1;
  while (low + 1 < high) {
    const mid = Math.floor((low + high) / 2);
    if (frames[mid].t <= time) low = mid;
    else high = mid;
  }
  const a = frames[low];
  const b = frames[high];
  const span = b.t - a.t;
  const alpha = span > 0 ? (time - a.t) / span : 0;
  return { t: time, x: lerp(a.x, b.x, alpha), y: lerp(a.y, b.y, alpha), rotation: lerpAngle(a.rotation, b.rotation, alpha) };
}

export function ghostTimeAtX(frames: readonly GhostFrame[], x: number): number | null {
  if (frames.length === 0) return null;
  if (x <= frames[0].x) return frames[0].t;
  for (let i = 1; i < frames.length; i++) {
    const a = frames[i - 1];
    const b = frames[i];
    if (a.x <= x && x <= b.x) {
      const span = b.x - a.x;
      return span > 0 ? lerp(a.t, b.t, (x - a.x) / span) : b.t;
    }
  }
  return null;
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
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    for (let i = 0; i < parsed.length; i++) {
      const frame = parsed[i];
      if (
        typeof frame !== 'object' || frame === null ||
        !Number.isFinite(frame.t) || !Number.isFinite(frame.x) ||
        !Number.isFinite(frame.y) || !Number.isFinite(frame.rotation) ||
        (i > 0 && frame.t <= parsed[i - 1].t)
      ) return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
