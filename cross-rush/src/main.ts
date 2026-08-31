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
import { engineRpmRatio, normalizedAxleLoad } from './physics/Bike';
import { EffectsConfig } from './config/GameConfig';

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
  onSpeedPad: () => {
    // El sprite del pad ya esta pintado de forma permanente en el suelo
    // (ver Renderer.drawGameplayFeatures); aqui solo el "chispazo" del boost.
    audio.playBoostCue();
    particles.spawnBurst(race.bike.x, race.bike.y - 0.2, 12);
    decals.spawn(race.bike.x, race.bike.y - 0.2, SpriteImages.speedPadFx);
  },
  onFlowRing: (hit) => {
    if (!hit) return;
    audio.playBoostCue();
    camera.triggerLandingImpulse();
    particles.spawnBurst(race.bike.x, race.bike.y, 16);
    decals.spawn(race.bike.x, race.bike.y, SpriteImages.flowRingHit);
  },
  onRiskGapCleared: () => {
    audio.playBoostCue();
    particles.spawnBurst(race.bike.x, race.bike.y, 10);
    decals.spawn(race.bike.x, race.bike.y, SpriteImages.riskGapFx);
  },
  onAltRamp: () => {
    particles.spawnBurst(race.bike.x, race.bike.y - 0.2, 8);
    decals.spawn(race.bike.x, race.bike.y - 0.2, SpriteImages.altRampFx);
  },
  onBumpGate: () => {
    particles.spawnBurst(race.bike.x, race.bike.y - 0.2, 8);
    decals.spawn(race.bike.x, race.bike.y - 0.2, SpriteImages.bumpGateFx);
  },
});

hud.setBestTime(race.getBestTimeSeconds());

const resultsScreen = new ResultsScreen(uiOverlay, () => {
  race.restart();
});

let lastFront = false;
let lastRear = false;
let audioStarted = false;
/** Restos fraccionarios de particulas de deslizamiento por rueda (ver ParticleSystem.spawnSlipDust). */
let frontSlipCarry = 0;
let rearSlipCarry = 0;
/** Tiempo desde la ultima marca de derrape, por rueda. */
let frontSkidCooldown = 0;
let rearSkidCooldown = 0;

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

// Metadatos estaticos de la pista para el arnes de QA visual: le permiten
// saber donde empieza y acaba cada pieza de terreno sin duplicar la
// definicion de la pista en el script de captura.
(window as unknown as { __crossRushTrack?: unknown }).__crossRushTrack = {
  startX: track.startX,
  finishX: track.finishX,
  features: track.terrainFeatures.map((feature) => ({
    kind: feature.kind,
    startX: feature.startX,
    endX: feature.endX,
  })),
  // Consultas de terreno de solo lectura, para que el piloto automatico del
  // QA pueda mirar la pendiente que viene igual que hace un jugador con los
  // ojos. Sin esto tendria que adivinar por la trayectoria y se clava en el
  // primer step-up, que es un problema del arnes y no del juego.
  surfaceY: (x: number) => track.terrain.surfaceY(x),
  surfaceSlope: (x: number) => track.terrain.surfaceSlope(x),
};

race.begin();

let fps = 0;
let qaFrameCounter = 0;
let fpsAccumulator = 0;
let fpsFrames = 0;
let simTicksThisFrame = 0;
let shownSectorSplits = 0;

const loop = new GameLoop(
  {
    step: (dt) => {
      simTicksThisFrame += 1;
      const inputState = input.getState();
      race.step(dt, inputState);

      if (race.sectorSplits.length > shownSectorSplits) {
        const split = race.latestSectorSplit;
        if (split) hud.showSectorSplit(split.sectorTime, split.deltaSeconds);
        shownSectorSplits = race.sectorSplits.length;
      }
      const latestSplit = race.latestSectorSplit;
      if (!latestSplit || race.raceTime - latestSplit.totalTime > 2.5) hud.hideSectorSplit();
      if (race.state === 'COUNTDOWN') shownSectorSplits = 0;

      // Golpe de tierra al TOCAR el suelo (flanco de contacto).
      if (race.bike.front.inContact && !lastFront) {
        particles.spawnDust(race.bike.front.contactX, race.bike.front.groundY, Math.abs(race.bike.vx));
      }
      if (race.bike.rear.inContact && !lastRear) {
        particles.spawnDust(race.bike.rear.contactX, race.bike.rear.groundY, Math.abs(race.bike.vx));
      }
      lastFront = race.bike.front.inContact;
      lastRear = race.bike.rear.inContact;

      // Y tierra continua mientras el neumatico DESLIZA de verdad: patinando
      // al acelerar o bloqueado al frenar. Antes el polvo dependia solo de
      // cruzar el umbral de contacto, asi que una salida a fondo quemando la
      // rueda trasera no levantaba ni una mota.
      if (race.bike.rear.inContact) {
        rearSlipCarry = particles.spawnSlipDust(
          race.bike.rear.contactX,
          race.bike.rear.groundY,
          race.bike.rear.wheel.slip,
          dt,
          rearSlipCarry,
        );
      } else {
        rearSlipCarry = 0;
      }
      if (race.bike.front.inContact) {
        frontSlipCarry = particles.spawnSlipDust(
          race.bike.front.contactX,
          race.bike.front.groundY,
          race.bike.front.wheel.slip,
          dt,
          frontSlipCarry,
        );
      } else {
        frontSlipCarry = 0;
      }

      // Marca de derrape: solo con la rueda bloqueada o patinando fuerte, y
      // espaciada en el tiempo para no empapelar el suelo.
      rearSkidCooldown = Math.max(0, rearSkidCooldown - dt);
      frontSkidCooldown = Math.max(0, frontSkidCooldown - dt);
      if (
        race.bike.rear.inContact &&
        Math.abs(race.bike.rear.wheel.slip) >= EffectsConfig.slip.skidMarkSlip &&
        rearSkidCooldown <= 0
      ) {
        rearSkidCooldown = EffectsConfig.slip.skidMarkInterval;
        decals.spawn(race.bike.rear.contactX, race.bike.rear.groundY + 0.05, SpriteImages.tireSkid);
      }
      if (
        race.bike.front.inContact &&
        Math.abs(race.bike.front.wheel.slip) >= EffectsConfig.slip.skidMarkSlip &&
        frontSkidCooldown <= 0
      ) {
        frontSkidCooldown = EffectsConfig.slip.skidMarkInterval;
        decals.spawn(race.bike.front.contactX, race.bike.front.groundY + 0.05, SpriteImages.tireSkid);
      }

      // La camara avanza en el PASO FIJO, con el estado de simulacion: asi es
      // determinista y luego el render la interpola igual que a la moto.
      camera.update(dt, { x: race.bike.x, y: race.bike.y, vx: race.bike.vx, vy: race.bike.vy }, race.flightTracker.currentAirTime);

      particles.update(dt);
      decals.update(dt);
    },
    /**
     * `alpha` es la fraccion de tick pendiente que entrega el GameLoop. Antes
     * se ignoraba y se dibujaba siempre el ultimo estado fijo: con la
     * simulacion a 120 Hz y la pantalla a 60, 90 o 144, cada frame caia en un
     * punto distinto del tick y la moto avanzaba a saltos desiguales. Eso era
     * el microtiron. Ahora TODO lo que se dibuja -moto, ruedas, suspension,
     * piloto, camara y sacudida- sale del mismo estado interpolado.
     */
    render: (alpha) => {
      renderer.resizeToDisplaySize();
      // El zoom se deriva del ancho real del lienzo, para que la moto ocupe la
      // misma fraccion de pantalla en escritorio y en movil.
      camera.setViewportSize(renderer.viewportWidthPx, renderer.viewportHeightPx);
      const bike = race.getInterpolatedBike(alpha);
      const cameraPose = camera.getPose(alpha);
      const shake = camera.getShakeOffset(alpha);

      renderer.render({
        camera: cameraPose,
        shake,
        track,
        bike,
        particles,
        decals,
        flowValue: race.flow.value,
        isRedline: race.flow.isRedline,
        crashed: race.state === 'CRASHED',
        crashElapsed: race.timeSinceCrash,
        ghost: race.getGhostPose(),
      });

      hud.update(race.raceTime, race.currentSectorName, race.flow.value, race.flow.isRedline, race.getLiveDeltaSeconds());

      if (race.state === 'COUNTDOWN') {
        hud.showCenterMessage(race.countdownRemaining > 0.15 ? String(Math.ceil(race.countdownRemaining)) : 'GO!');
      }

      // El motor suena a lo que hace la RUEDA, no a lo que hace la camara:
      // vueltas reales de la trasera, gas continuo y carga (patinaje +
      // cuanto peso lleva encima el eje motriz).
      const smoothed = race.smoothedInput;
      const slipLoad = Math.min(1, Math.abs(race.bike.rear.wheel.slip) / 4);
      const axleLoad = Math.min(1, normalizedAxleLoad(race.bike, 'rear') / 1.6);
      audio.updateEngine({
        rpmRatio: engineRpmRatio(race.bike),
        throttle: smoothed.throttle,
        load: Math.max(slipLoad, axleLoad * smoothed.throttle),
      });

      // Gancho de QA, solo lectura. Publica el ultimo estado REALMENTE
      // dibujado -no el de la simulacion- para que el arnes de captura
      // (tools/visual-qa.mjs) pueda comprobar sobre la build de verdad que las
      // ruedas giran, que el piloto reacciona y que el avance entre
      // fotogramas es uniforme. El juego no lo lee nunca.
      (window as unknown as { __crossRushFrame?: unknown }).__crossRushFrame = {
        frame: qaFrameCounter++,
        alpha,
        t: race.raceTime,
        state: race.state,
        x: bike.x,
        y: bike.y,
        // La x del ULTIMO TICK, sin interpolar: es lo que se dibujaba antes.
        // Publicarla permite al QA comparar las dos series y demostrar la
        // mejora en vez de afirmarla.
        rawX: race.bike.x,
        rawY: race.bike.y,
        vx: bike.vx,
        vy: bike.vy,
        angle: bike.angle,
        angularVelocity: bike.angularVelocity,
        frontContact: bike.front.inContact,
        rearContact: bike.rear.inContact,
        frontSpin: bike.front.wheel.spin,
        rearSpin: bike.rear.wheel.spin,
        frontSpinRate: bike.front.wheel.spinRate,
        rearSpinRate: bike.rear.wheel.spinRate,
        rearSlip: bike.rear.wheel.slip,
        frontCompression: bike.front.compression,
        rearCompression: bike.rear.compression,
        frontLoad: normalizedAxleLoad(bike, 'front'),
        rearLoad: normalizedAxleLoad(bike, 'rear'),
        riderShiftX: bike.rider.shiftX,
        riderShiftY: bike.rider.shiftY,
        riderTorso: bike.rider.torsoAngle,
        throttle: bike.throttleAmount,
        brake: bike.brakeAmount,
        lean: bike.leanAmount,
        cameraX: cameraPose.x,
        cameraY: cameraPose.y,
        shakeX: shake.x,
        shakeY: shake.y,
      };

      debugOverlay.update({
        fps,
        simTicksLastFrame: simTicksThisFrame,
        // El mismo estado que se acaba de dibujar, para que lo que dice el
        // panel y lo que se ve en pantalla no puedan discrepar.
        bike,
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
