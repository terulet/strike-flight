/**
 * Lo que se comparte: un resumen en texto con un emoji por tramo (se pega
 * igual en WhatsApp, X o Discord) y un enlace de reto que lleva dentro el
 * fantasma de tu vuelta. Quien lo abre corre la misma pista contra ti.
 */
import type { SectionMark } from '../game/race';

/** Direccion publica del juego publicado en claude.ai (fuera de ahi, la propia pagina). */
const ARTIFACT_URL = 'https://claude.ai/artifact/VFMHnruZ3K1KjwTD2EkHfr';

const MARK_EMOJI: Record<SectionMark, string> = { clean: '🟩', flip: '🔄', rough: '🟨', crash: '💥' };
const MEDAL_EMOJI = ['', '🥉', '🥈', '🥇'];

export function shareBase(): string {
  const inClaude = typeof window !== 'undefined' && 'claude' in window;
  if (inClaude) return ARTIFACT_URL;
  return location.origin + location.pathname;
}

export function challengeLink(token: string): string {
  return `${shareBase()}#reto-${token}`;
}

export interface ShareInput {
  title: string;
  time: string;
  medal: number;
  crashes: number;
  flips: number;
  maxAir: number;
  marks: SectionMark[];
  /** Resultado contra el fantasma del reto, si lo habia. */
  versus: { name: string; won: boolean; diff: string } | null;
  link: string | null;
}

export function shareText(s: ShareInput): string {
  const lines = [`HOLESHOT · ${s.title}`];
  const extra: string[] = [];
  if (s.flips) extra.push(`🔄 ${s.flips}`);
  if (s.maxAir >= 1.5) extra.push(`🪂 ${s.maxAir.toFixed(1).replace('.', ',')} s`);
  extra.push(s.crashes ? `💥 ${s.crashes}` : '0 caídas');
  lines.push(`⏱️ ${s.time} ${MEDAL_EMOJI[s.medal] ?? ''}`.trim() + ' · ' + extra.join(' · '));
  lines.push(s.marks.map((m) => MARK_EMOJI[m]).join(''));
  if (s.versus) lines.push(s.versus.won ? `🏆 Le he ganado a ${s.versus.name} por ${s.versus.diff}` : `😤 ${s.versus.name} me ha ganado por ${s.versus.diff}`);
  if (s.link) lines.push(`¿Me ganas? ${s.link}`);
  return lines.join('\n');
}
