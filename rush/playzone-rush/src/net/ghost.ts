/**
 * Traza del fantasma.
 *
 * Una muestra cada 100 ms con la posicion horizontal normalizada (0..1)
 * cuantizada a un byte. Una partida de 40 segundos son 400 bytes crudos, unos
 * 536 caracteres en base64: cabe de sobra en cualquier peticion y no merece la
 * pena comprimir mas.
 */
export const GHOST_SAMPLE_MS = 100;

export interface GhostRecording {
  sampleMs: number;
  /** Posiciones normalizadas 0..1. */
  samples: number[];
}

export function encodeTrace(samples: number[]): string {
  const bytes = new Uint8Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const value = Math.max(0, Math.min(1, samples[i] ?? 0));
    bytes[i] = Math.round(value * 255);
  }
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function decodeTrace(trace: string): number[] {
  try {
    const binary = atob(trace);
    const samples = new Array<number>(binary.length);
    for (let i = 0; i < binary.length; i++) samples[i] = binary.charCodeAt(i) / 255;
    return samples;
  } catch {
    return [];
  }
}

/** Posicion del fantasma en un instante, interpolando entre muestras. */
export function sampleAt(samples: number[], elapsedMs: number, sampleMs = GHOST_SAMPLE_MS): number | null {
  if (samples.length === 0) return null;
  const position = elapsedMs / sampleMs;
  if (position >= samples.length - 1) return null; // el fantasma ya ha terminado
  const index = Math.floor(position);
  const fraction = position - index;
  const a = samples[index] ?? 0;
  const b = samples[index + 1] ?? a;
  return a + (b - a) * fraction;
}

/** Tamano aproximado en bytes de una traza codificada. */
export function traceBytes(trace: string): number {
  return trace.length;
}
