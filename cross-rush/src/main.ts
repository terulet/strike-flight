/**
 * main.ts
 *
 * Punto de entrada: cablea input, fisica/gameplay (RaceManager), render y
 * audio alrededor del GameLoop de paso fijo.
 */

import { GameLoop } from './core/GameLoop';
import { SIM_DT } from './config/GameConfig';
import { buildCanyonRun } from './tracks/CanyonRun';
import { RaceManager } from './gameplay/RaceManager';
import { InputManager } from './input/InputManager';
import { KeyboardInput } from './input/KeyboardInput';
import { TouchInput } from './input/TouchInput';
import { Camera } from './rendering/Camera';
import { ParticleSystem } from './rendering/ParticleSystem';
import { SpriteDecals } from './rendering/SpriteDecals';
import { SpriteImages } from './rendering/SpriteAssets';
import { Renderer } from './rendering/Renderer';
import { AudioEngine } from './audio/AudioEngine';
import { HUD } from './ui/HUD';
import { DebugOverlay } from './ui/DebugOverlay';
import { ResultsScreen } from './ui/ResultsScreen';
import { EngineConfig } from './config/GameConfig';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const uiOverlay = document.getElementById('ui-overlay') as HTMLDivElement;

const track = buildCanyonRun();
const renderer = new Renderer(canvas);
const camera = new Camera();
const particles = new ParticleSystem();
const decals = new SpriteDecals();
const audio = new AudioEngine();
const hud = new HUD(uiOverlay);
const debugOverlay = new DebugOverlay(uiOverlay);
const touchInput = new TouchInput(uiOverlay);
const keyboardInput = new KeyboardInput(window);
const input = new InputManager([keyboardInput, touchInput]);

hud.setBestTime(null);

const race = new RaceManager(track, {
  onStateChange: (state) => {
    if (state === 'COUNTDOWN') {
      resultsScreen.hide();
      hud.showCenterMessage(String(Math.ceil(race.countdownRemaining)));
    } else if (state === 'RACING') {
      hud.hideCenterMessage();
    } else if (state === 'CRASHED') {
      audio.playCrashCue();
      camera.triggerCrashImpulse();
      particles.spawnBurst(race.bike.x, race.bike.y, 18);
      decals.spawn(race.bike.x, race.bike.y - 0.2, SpriteImages.landingImpact);
      const summary = race.getResultsSummary();
      resultsScreen.show(summary, true);
    } else if (state === 'FINISHED') {
      const summary = race.getResultsSummary();
      resultsScreen.show(summary, false);
      hud.setBestTime(race.getBestTimeSeconds());
    }
  },
  onLanding: (event) => {
    audio.playLandingCue(event.quality);
    if (event.quality === 'PERFECT' || event.quality === 'GOOD') {
      camera.triggerLandingImpulse();
      decals.spawn(race.bike.x, race.bike.y - 0.2, SpriteImages.landingImpact);
    } else if (event.quality === 'ROUGH' || event.quality === 'BAD') {
      const roughDecal = Math.random() < 0.5 ? SpriteImages.dirtSpray : SpriteImages.tireSkid;
      decals.spawn(race.bike.x, race.bike.y - 0.2, roughDecal);
    }
    particles.spawnBurst(race.bike.x, race.bike.y - 0.2, 10);
  },
});

hud.setBestTime(race.getBestTimeSeconds());

const resultsScreen = new ResultsScreen(uiOverlay, () => {
  race.restart();
});

let lastFront = false;
let lastRear = false;
let audioStarted = false;

function ensureAudioStarted(): void {
  if (audioStarted) return;
  audio.start();
  audioStarted = true;
}

window.addEventListener('pointerdown', ensureAudioStarted, { once: true });
window.addEventListener('keydown', ensureAudioStarted, { once: true });

window.addEventListener('keydown', (event) => {
  if (event.code === 'F1' || event.code === 'Backquote') {
    event.preventDefault();
    debugOverlay.toggle();
  }
});

race.begin();

let fps = 0;
let fpsAccumulator = 0;
let fpsFrames = 0;
let simTicksThisFrame = 0;

const loop = new GameLoop(
  {
    step: (dt) => {
      simTicksThisFrame += 1;
      const inputState = input.getState();
      race.step(dt, inputState);

      if (race.bike.front.inContact && !lastFront) {
        particles.spawnDust(race.bike.front.contactX, race.bike.front.groundY, Math.abs(race.bike.vx));
      }
      if (race.bike.rear.inContact && !lastRear) {
        particles.spawnDust(race.bike.rear.contactX, race.bike.rear.groundY, Math.abs(race.bike.vx));
      }
      lastFront = race.bike.front.inContact;
      lastRear = race.bike.rear.inContact;

      particles.update(dt);
      decals.update(dt);
    },
    render: () => {
      renderer.resizeToDisplaySize();
      const airTime = race.flightTracker.currentAirTime;
      camera.update(SIM_DT, { x: race.bike.x, y: race.bike.y, vx: race.bike.vx, vy: race.bike.vy }, airTime);

      renderer.render({
        camera,
        track,
        bike: race.bike,
        particles,
        decals,
        flowValue: race.flow.value,
        isRedline: race.flow.isRedline,
        crashed: race.state === 'CRASHED',
      });

      hud.update(race.raceTime, race.currentSectorName, race.flow.value, race.flow.isRedline);

      if (race.state === 'COUNTDOWN') {
        hud.showCenterMessage(race.countdownRemaining > 0.15 ? String(Math.ceil(race.countdownRemaining)) : 'GO!');
      }

      const speedRatio = Math.min(1, Math.abs(race.bike.vx) / EngineConfig.topSpeed);
      audio.updateEngine(speedRatio, input.getState().throttle);

      debugOverlay.update({
        fps,
        simTicksLastFrame: simTicksThisFrame,
        bike: race.bike,
        flow: race.flow.value,
        sector: race.currentSectorName,
        raceTime: race.raceTime,
        gameState: race.state,
      });
      simTicksThisFrame = 0;
    },
  },
  SIM_DT,
);

function fpsTick(now: number): void {
  fpsFrames += 1;
  if (fpsAccumulator === 0) fpsAccumulator = now;
  if (now - fpsAccumulator >= 500) {
    fps = (fpsFrames * 1000) / (now - fpsAccumulator);
    fpsFrames = 0;
    fpsAccumulator = now;
  }
  requestAnimationFrame(fpsTick);
}
requestAnimationFrame(fpsTick);

loop.start();
