/**
 * main — boot. Wires every system together and owns the frame.
 *
 * Boot is async only because a tester link may name a challenge whose real rival
 * scores live in tester-challenges.json. That lookup is time-boxed and optional:
 * if it is slow, missing or blocked, the game starts anyway.
 */
import { Save, safeLocalStorage } from './storage/Save.js';
import { Telemetry, EVENTS, telemetryStorage } from './telemetry/Telemetry.js';
import { AudioEngine } from './audio/Audio.js';
import { Haptics } from './audio/Haptics.js';
import { Renderer } from './render/Renderer.js';
import { UI } from './ui/UI.js';
import { Game } from './game/Game.js';
import { Input } from './input/Input.js';
import { Loop } from './core/Loop.js';
import { Debug, debugEnabled } from './debug/Debug.js';
import { detectLanguage, setLanguage } from './ui/i18n.js';
import { createChallenge } from './game/Challenge.js';
import { parseLaunchConfig } from './tester/LaunchConfig.js';
import { loadRivalConfig, mergeRivalSources } from './tester/rivalConfig.js';
import { ensurePlayer, hasName, setPlayerName } from './game/Player.js';
import { loadBuildInfo, currentBuild, versionLine } from './tester/buildInfo.js';
import {
  buildReportPayload, humanSummary, bugInfo, copyText, shareText, deviceInfo, viewportInfo,
} from './tester/TesterReport.js';

async function boot() {
  const canvas = document.getElementById('stage');
  const launch = parseLaunchConfig();
  const storage = safeLocalStorage();
  const save = new Save(storage);

  // Escape hatch for a tester stuck on an old cached build.
  if (launch.noCache) await hardRefresh();

  const { player } = ensurePlayer(save);
  if (launch.playerName) setPlayerName(save, launch.playerName);

  // First run: follow the browser's language.
  if (!save.data.settings.langChosen) {
    save.update((d) => { d.settings.lang = launch.lang || detectLanguage(); d.settings.langChosen = true; });
  }
  if (launch.lang) save.update((d) => { d.settings.lang = launch.lang; });
  setLanguage(save.data.settings.lang);

  const debugOn = debugEnabled(launch);
  const telemetry = new Telemetry({
    debug: debugOn,
    storage: telemetryStorage(storage),
  });
  const audio = new AudioEngine();
  const haptics = new Haptics(save.data.settings.haptics);
  audio.setEnabled(save.data.settings.sound);
  const renderer = new Renderer(canvas);

  // Real rival scores: the link wins, the JSON file is the fallback for groups.
  const fromJson = launch.challengeId && !launch.rivals.length && !launch.solo
    ? await loadRivalConfig(launch.challengeId)
    : null;
  const rivalPlan = mergeRivalSources(launch, fromJson);

  loadBuildInfo().catch(() => {});

  let game = null;
  const testerApi = {
    opened: () => telemetry.log(EVENTS.REPORT_OPENED, {}),
    versionLine: () => versionLine(),
    buildReport: () => buildReportPayload({ telemetry, save, build: currentBuild() }),
    canShare: () => typeof navigator !== 'undefined' && !!navigator.share,
    copyReport: async (onFallback) => {
      const payload = buildReportPayload({ telemetry, save, build: currentBuild() });
      const text = `${humanSummary(payload)}\n\n----- JSON -----\n${JSON.stringify(payload)}`;
      const res = await copyText(text, onFallback);
      telemetry.log(EVENTS.REPORT_COPIED, { via: res });
      telemetry.flush();
      return res;
    },
    shareReport: async () => {
      const payload = buildReportPayload({ telemetry, save, build: currentBuild() });
      return shareText(`${humanSummary(payload)}\n\n${JSON.stringify(payload)}`);
    },
    copyBugInfo: (onFallback) => copyText(bugInfo({ telemetry, save, game }), onFallback),
    clearTestData: () => {
      // Deliberately does NOT touch the game save: nobody loses a record to this.
      telemetry.clear();
      startSession();
    },
  };

  const ui = new UI({
    save, audio, haptics, tester: testerApi,
    actions: {
      play: (mode) => game.startMode(mode),
      quit: () => game.quit(),
      advance: () => game.advance(),
      newSetup: () => game.nextSetup(),
      nameSet: (name) => {
        setPlayerName(save, name);
        telemetry.setPlayer(save.data.player.id, save.data.player.name);
        telemetry.log(EVENTS.NAME_SET, {});
        ui.refreshHome();
      },
      saveReset: () => { game.quit(); },
      share: async () => {
        const m = game.match;
        if (!m || !m.best) return false;
        const { shareResult } = await import('./render/ShareCard.js');
        return shareResult({ mm: m.best.mm, rank: m.rank, challenge: game.challenge, zone: m.best.zone });
      },
    },
  });

  game = new Game({ renderer, save, telemetry, audio, haptics, ui, launch, rivalPlan });
  if (launch.surfaceId) game.forced.surfaceId = launch.surfaceId;
  if (launch.objectId) game.forced.objectId = launch.objectId;

  const loop = new Loop(frame);
  const debug = debugOn ? new Debug(game, loop) : null;
  if (debug) game.debug = debug;

  const input = new Input(canvas.parentElement, {
    onPress: () => game.press(),
    onRelease: () => game.release(),
    onCancel: () => game.cancelPress(),
    onVisibility: (visible) => game.setPaused(!visible),
  });

  // ------------------------------------------------------------------ resize
  function resize() {
    const dpr = Math.min(globalThis.devicePixelRatio || 1, 2.5);
    const w = Math.max(1, Math.round(canvas.parentElement.clientWidth || window.innerWidth));
    const h = Math.max(1, Math.round(canvas.parentElement.clientHeight || window.innerHeight));
    renderer.resize(w, h, dpr);
    game.camera.setViewport(w, h);
    game._frameCamera(true);
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 120));
  if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);
  resize();

  function frame(dt) {
    game.frame(dt);
    game.render();
    if (debug) debug.update(dt);
  }

  // Idle background for the home screen so the game is never a black rectangle.
  game.challenge = createChallenge(launch.challengeId || 'menu-showcase', {
    surfaceId: launch.surfaceId, objectId: launch.objectId,
  });
  game.state = { x: game.challenge.setup.startX, v: 0, phase: 'ready', angle: 0, y: 0, steps: 0, restTime: 0 };
  game._frameCamera(true);

  // ---------------------------------------------------------------- sessions
  function startSession() {
    telemetry.beginSession({
      playerId: save.data.player.id,
      playerName: save.data.player.name,
      appVersion: game ? undefined : undefined,
      language: save.data.settings.lang,
      viewport: viewportInfo(),
      dpr: Math.round((window.devicePixelRatio || 1) * 100) / 100,
      device: deviceInfo(),
      challengeId: launch.challengeId,
      arm: rivalPlan.rivals.length ? 'rival' : 'solo',
      rivals: rivalPlan.rivals.map((r) => ({ name: r.name, mm: r.mm, real: true })),
      build: currentBuild(),
    });
  }
  startSession();
  telemetry.log(EVENTS.GAME_START, {
    lang: save.data.settings.lang,
    rivalSource: rivalPlan.source,
    invalidParams: launch.invalid.length ? launch.invalid.slice() : undefined,
  });

  loop.start();
  save.update((d) => { d.stats.sessions += 1; });

  document.addEventListener('visibilitychange', () => {
    game.setPaused(document.visibilityState !== 'visible');
    if (document.visibilityState !== 'visible') { telemetry.endSession('hidden'); }
  });
  window.addEventListener('pagehide', () => { telemetry.endSession('pagehide'); save.save(); });

  // ---------------------------------------------------------------- entry
  if (!hasName(save)) {
    ui.showOnboarding((name) => {
      setPlayerName(save, name);
      telemetry.setPlayer(save.data.player.id, save.data.player.name);
      telemetry.log(EVENTS.NAME_SET, {});
      ui.refreshHome();
      afterEntry();
    });
  } else {
    telemetry.setPlayer(save.data.player.id, save.data.player.name);
    afterEntry();
  }

  function afterEntry() {
    if (launch.report) { ui.openReport(); return; }
    if (launch.mode) setTimeout(() => game.startMode(launch.mode), 60);
    else if (launch.tester && rivalPlan.rivals.length) setTimeout(() => game.startMode('quick'), 60);
  }

  globalThis.OMM = { game, save, telemetry, ui, audio, loop, renderer, input, debug, launch, rivalPlan, tester: testerApi };

  registerServiceWorker();
}

/**
 * Service worker: register, then actively look for a new build. A tester stuck on
 * a stale cache is a wasted tester, so a new worker reloads the page once.
 */
function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !location.protocol.startsWith('http')) return;
  window.addEventListener('load', async () => {
    try {
      // A first install also takes control (clients.claim), and reloading for that
      // would restart the session and corrupt attempts-per-session. Only an UPDATE
      // - a controller change when one already existed - is worth a reload.
      const hadController = !!navigator.serviceWorker.controller;
      const reg = await navigator.serviceWorker.register('./sw.js');
      reg.update().catch(() => {});
      let reloaded = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!hadController || reloaded) return;
        reloaded = true;
        location.reload();
      });
      // Check again when they come back to the tab.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update().catch(() => {});
      });
    } catch (e) { /* offline shell is optional */ }
  });
}

/** ?nocache=1 — nuke the worker and its caches, for a tester who is stuck. */
async function hardRefresh() {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    if (globalThis.caches) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch (e) { /* nothing to clean */ }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { boot(); });
else boot();
