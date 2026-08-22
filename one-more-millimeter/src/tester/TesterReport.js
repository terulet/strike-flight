/**
 * Tester report — everything a tester needs to hand back, as text they can paste
 * into WhatsApp. No upload, no account, no server.
 */
import { GameConfig } from '../config/GameConfig.js';
import { PhysicsConfig } from '../config/PhysicsConfig.js';
import { formatMm } from '../ui/format.js';
import { currentBuild, versionLine } from './buildInfo.js';

/** Limited, non-identifying device facts — needed to read the QA matrix. */
export function deviceInfo() {
  const nav = typeof navigator !== 'undefined' ? navigator : {};
  const ua = String(nav.userAgent || '').slice(0, 180);
  const platform =
    /iPhone|iPad|iPod/i.test(ua) ? 'ios' :
    /Android/i.test(ua) ? 'android' :
    /Macintosh/i.test(ua) ? 'mac' :
    /Windows/i.test(ua) ? 'windows' : 'other';
  const browser =
    /CriOS|Chrome/i.test(ua) ? 'chrome' :
    /FxiOS|Firefox/i.test(ua) ? 'firefox' :
    /Safari/i.test(ua) ? 'safari' : 'other';
  const standalone = !!(
    (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
    nav.standalone
  );
  return { platform, browser, standalone, ua };
}

export function viewportInfo() {
  if (typeof window === 'undefined') return null;
  return {
    w: window.innerWidth,
    h: window.innerHeight,
    dpr: Math.round((window.devicePixelRatio || 1) * 100) / 100,
    orientation: window.innerWidth > window.innerHeight ? 'landscape' : 'portrait',
  };
}

/** The full JSON a tester copies (spec 20). */
export function buildReportPayload({ telemetry, save, build = currentBuild() }) {
  const player = save && save.data && save.data.player ? save.data.player : null;
  return telemetry.buildReport({
    appVersion: GameConfig.version,
    physicsVersion: PhysicsConfig.version,
    build: { sha: build.sha, ref: build.ref, builtAt: build.builtAt, source: build.source },
    player: player ? { id: player.id, name: player.name, createdAt: player.createdAt } : null,
  });
}

const pct = (v) => (v == null ? 'n/a' : `${Math.round(v * 100)}%`);
const dur = (ms) => {
  if (!Number.isFinite(ms) || ms < 0) return 'n/a';
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
};

/**
 * The human block from spec 19. Deliberately readable in a chat window: this is
 * what gets skim-read before anybody opens the JSON.
 */
export function humanSummary(payload) {
  const s = payload.currentSummary;
  const p = payload.player;
  if (!s) return 'NO SESSION DATA';
  const lines = [
    `PLAYER: ${p && p.name ? p.name : 'unknown'}`,
    `SESSION: ${dur(s.durationMs)}  (${s.arm.toUpperCase()})`,
    '',
    `ATTEMPTS: ${s.attempts}`,
    `FALLS: ${s.falls}`,
    `NEAR MISS FALLS: ${s.nearMissFalls}`,
    `BEST: ${s.bestMm == null ? '--' : `${formatMm(s.bestMm)} mm`}`,
    '',
    `RETRY AFTER FALL: ${pct(s.retryAfterFall)}`,
    `RETRY AFTER RIVAL LOSS: ${pct(s.retryAfterRivalLoss)}`,
    `RETRY AFTER RIVAL WIN: ${pct(s.retryAfterRivalWin)}`,
    `RETRY AFTER PERSONAL MISS: ${pct(s.retryAfterPersonalMiss)}`,
    `RETRY AFTER NORMAL STOP: ${pct(s.retryAfterNormalStop)}`,
    `MEDIAN RETRY DELAY: ${s.medianRetryDelayMs == null ? 'n/a' : `${s.medianRetryDelayMs} ms`}`,
    '',
    `RIVALS BEATEN: ${s.rivalsBeaten}`,
    `PERSONAL BESTS: ${s.personalBests}`,
    `SESSIONS STORED: ${payload.aggregate ? payload.aggregate.sessions : 1}`,
  ];
  if (s.truncated) lines.push('', 'NOTE: this session hit the storage cap, some events were dropped');
  return lines.join('\n');
}

/** Short reproducible context for a bug (spec 26). */
export function bugInfo({ telemetry, save, game }) {
  const d = deviceInfo();
  const v = viewportInfo();
  const s = telemetry.summary();
  const last = s && telemetry.session && telemetry.session.attempts.length
    ? telemetry.session.attempts[telemetry.session.attempts.length - 1]
    : null;
  const lastEvent = telemetry.session && telemetry.session.events.length
    ? telemetry.session.events[telemetry.session.events.length - 1]
    : null;
  const player = save && save.data && save.data.player;
  return [
    'PLAYZONE 008 TESTER BUILD',
    `Version: ${versionLine()}`,
    `Player: ${player && player.name ? player.name : 'unknown'} (${player ? player.id : 'no id'})`,
    `Device: ${d.platform}/${d.browser}${d.standalone ? '/pwa' : ''}`,
    `UA: ${d.ua}`,
    `Viewport: ${v ? `${v.w}x${v.h} @${v.dpr} ${v.orientation}` : 'n/a'}`,
    `Challenge: ${game && game.challenge ? game.challenge.id : 'n/a'} (${game && game.challenge ? `${game.challenge.surfaceId}/${game.challenge.objectId}` : '-'})`,
    `Mode: ${game && game.match ? game.match.modeId : 'n/a'}  Arm: ${s ? s.arm : 'n/a'}`,
    `Last attempt: ${last ? JSON.stringify(last) : 'none'}`,
    `Last event: ${lastEvent ? JSON.stringify(lastEvent) : 'none'}`,
    `URL: ${typeof location !== 'undefined' ? location.href.slice(0, 300) : 'n/a'}`,
  ].join('\n');
}

/**
 * Clipboard with an honest fallback: iOS can refuse the API outright, and losing
 * a tester's report to a silent failure would waste their whole session.
 * @returns {Promise<'clipboard'|'fallback'>}
 */
export async function copyText(text, onFallback) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return 'clipboard';
    }
  } catch (e) { /* fall through */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand && document.execCommand('copy');
    document.body.removeChild(ta);
    if (ok) return 'clipboard';
  } catch (e) { /* fall through */ }
  if (onFallback) onFallback(text);
  return 'fallback';
}

/** Optional. Never required, never treated as a failure when missing. */
export async function shareText(text, title = 'One More Millimeter — test report') {
  try {
    if (!navigator.share) return false;
    await navigator.share({ title, text });
    return true;
  } catch (e) {
    return false;
  }
}
