/**
 * Build identity. The deploy workflow writes build-info.json next to index.html;
 * locally the file does not exist and we say so instead of guessing.
 *
 * Fetched lazily (only the report and the debug overlay need it) and never cached
 * by the service worker, so a tester report always names the build they played.
 */
import { GameConfig } from '../config/GameConfig.js';
import { PhysicsConfig } from '../config/PhysicsConfig.js';

let cached = null;

export const FALLBACK = Object.freeze({
  sha: 'dev',
  shortSha: 'dev',
  ref: null,
  builtAt: null,
  source: 'local',
});

export async function loadBuildInfo(fetchImpl) {
  if (cached) return cached;
  const f = fetchImpl || (typeof fetch === 'function' ? fetch : null);
  if (!f) { cached = FALLBACK; return cached; }
  try {
    const res = await f('./build-info.json', { cache: 'no-store' });
    if (!res || !res.ok) { cached = FALLBACK; return cached; }
    const j = await res.json();
    const sha = typeof j.sha === 'string' ? j.sha.slice(0, 40) : 'unknown';
    cached = Object.freeze({
      sha,
      shortSha: sha.slice(0, 7),
      ref: typeof j.ref === 'string' ? j.ref.slice(0, 80) : null,
      builtAt: typeof j.builtAt === 'string' ? j.builtAt.slice(0, 40) : null,
      // The committed copy says "dev"; the deploy workflow overwrites it with a SHA.
      source: sha === 'dev' ? 'local' : 'pages',
    });
  } catch (e) {
    cached = FALLBACK;
  }
  return cached;
}

/** Synchronous view for anything that cannot await. */
export function currentBuild() {
  return cached || FALLBACK;
}

export function versionLine(build = currentBuild()) {
  return `PLAYZONE 008 · tester build · app ${GameConfig.version} · physics ${PhysicsConfig.version} · ${build.shortSha}`;
}
