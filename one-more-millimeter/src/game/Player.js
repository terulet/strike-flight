/**
 * Player identity — the smallest thing that lets a tester report be attributed.
 *
 * A local UUID and a display name. No account, no email, no server. The id exists
 * so two sessions from the same phone can be stitched together in the report; the
 * name exists so a rival link can say BEAT MARC instead of BEAT PLAYER 2.
 */
import { sanitizeName, LIMITS } from '../tester/LaunchConfig.js';

export { sanitizeName };

/** Anonymous, local, stable. crypto.randomUUID where available. */
export function newPlayerId() {
  try {
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
      return globalThis.crypto.randomUUID();
    }
    if (globalThis.crypto && typeof globalThis.crypto.getRandomValues === 'function') {
      const b = new Uint8Array(16);
      globalThis.crypto.getRandomValues(b);
      b[6] = (b[6] & 0x0f) | 0x40;
      b[8] = (b[8] & 0x3f) | 0x80;
      const hex = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }
  } catch (e) { /* fall through */ }
  // Last resort: still unique enough to separate testers in a report.
  return `local-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e12).toString(36)}`;
}

/** Guarantees save.data.player exists. Returns it. */
export function ensurePlayer(save) {
  let created = false;
  save.update((d) => {
    if (!d.player || typeof d.player !== 'object') d.player = { id: '', name: '', createdAt: 0 };
    if (!d.player.id) { d.player.id = newPlayerId(); created = true; }
    if (!d.player.createdAt) d.player.createdAt = Date.now();
    d.player.name = sanitizeName(d.player.name || '');
  });
  return { player: save.data.player, created };
}

export function hasName(save) {
  return !!(save.data.player && save.data.player.name);
}

/**
 * @returns the stored name, or '' if the input sanitised down to nothing.
 */
export function setPlayerName(save, raw) {
  const name = sanitizeName(raw);
  save.update((d) => {
    if (!d.player) d.player = { id: newPlayerId(), name: '', createdAt: Date.now() };
    d.player.name = name;
  });
  return name;
}

export const NAME_MAX = LIMITS.nameMax;
