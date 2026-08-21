/**
 * main — boot. Wires every system together and owns the frame.
 */
import { Save, safeLocalStorage } from './storage/Save.js';
import { Telemetry, EVENTS } from './telemetry/Telemetry.js';
import { AudioEngine } from './audio/Audio.js';
import { Haptics } from './audio/Haptics.js';
import { Renderer } from './render/Renderer.js';
import { UI } from './ui/UI.js';
import { Game } from './game/Game.js';
import { Input } from './input/Input.js';
import { Loop } from './core/Loop.js';
import { Debug, debugEnabled, urlOverrides } from './debug/Debug.js';
import { detectLanguage, setLanguage } from './ui/i18n.js';
import { createChallenge } from './game/Challenge.js';

function boot() {
  const canvas = document.getElementById('stage');
  const save = new Save(safeLocalStorage());
  const overrides = urlOverrides();

  // First run: follow the browser's language.
  if (!save.data.settings.langChosen) {
    save.update((d) => { d.settings.lang = overrides.lang || detectLanguage(); d.settings.langChosen = true; });
  }
  if (overrides.lang) save.update((d) => { d.settings.lang = overrides.lang; });
  setLanguage(save.data.settings.lang);

  const telemetry = new Telemetry({ debug: debugEnabled() });
  const audio = new AudioEngine();
  const haptics = new Haptics(save.data.settings.haptics);
  audio.setEnabled(save.data.settings.sound);
  const renderer = new Renderer(canvas);

  let game = null;
  const ui = new UI({
    save, audio, haptics,
    actions: {
      play: (mode) => game.startMode(mode),
      quit: () => game.quit(),
      advance: () => game.advance(),
      newSetup: () => game.nextSetup(),
      saveReset: () => { game.quit(); },
      share: async () => {
        const m = game.match;
        if (!m || !m.best) return false;
        const { shareResult } = await import('./render/ShareCard.js');
        return shareResult({
          mm: m.best.mm, rank: m.rank, challenge: game.challenge, zone: m.best.zone,
        });
      },
    },
  });

  game = new Game({ renderer, save, telemetry, audio, haptics, ui });
  if (overrides.surfaceId) game.forced.surfaceId = overrides.surfaceId;
  if (overrides.objectId) game.forced.objectId = overrides.objectId;

  const loop = new Loop(frame);
  const debug = debugEnabled() ? new Debug(game, loop) : null;
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

  // ------------------------------------------------------------------- frame
  function frame(dt) {
    game.frame(dt);
    game.render();
    if (debug) debug.update(dt);
  }

  // Idle background for the home screen so the game is never a black rectangle.
  game.challenge = createChallenge(overrides.challengeId || 'menu-showcase', {
    surfaceId: overrides.surfaceId, objectId: overrides.objectId,
  });
  game.state = { x: game.challenge.setup.startX, v: 0, phase: 'ready', angle: 0, y: 0, steps: 0, restTime: 0 };
  game._frameCamera(true);

  loop.start();
  telemetry.log(EVENTS.GAME_START, { lang: save.data.settings.lang });
  save.update((d) => { d.stats.sessions += 1; });

  document.addEventListener('visibilitychange', () => {
    game.setPaused(document.visibilityState !== 'visible');
    if (document.visibilityState !== 'visible') telemetry.log(EVENTS.SESSION_END, telemetry.summary());
  });
  window.addEventListener('pagehide', () => { save.save(); });

  if (overrides.mode) setTimeout(() => game.startMode(overrides.mode), 60);

  // Expose a handle for the debug console and for automated screenshots.
  globalThis.OMM = { game, save, telemetry, ui, audio, loop, renderer, input, debug };

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => { /* offline shell is optional */ });
    });
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
