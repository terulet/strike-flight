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
import { Shockwaves } from './rendering/Shockwaves';
import { ScreenEffects } from './rendering/ScreenEffects';
import { SpriteImages } from './rendering/SpriteAssets';
import { EXHAUST_LOCAL, Renderer, localToWorld } from './rendering/Renderer';
import { AudioEngine } from './audio/AudioEngine';
import { HUD } from './ui/HUD';
import { DebugOverlay } from './ui/DebugOverlay';
import { ResultsScreen } from './ui/ResultsScreen';
import { engineRpmRatio, normalizedAxleLoad } from './physics/Bike';
import { rotateVec } from './physics/MathUtils';
import { BikeConfig, EffectsConfig, EngineConfig, LandingConfig, RaceStartConfig, SpectacleConfig } from './config/GameConfig';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const uiOverlay = document.getElementById('ui-overlay') as HTMLDivElement;

const track = buildCanyonRun();
const renderer = new Renderer(canvas);
const camera = new Camera();
const particles = new ParticleSystem();
const decals = new SpriteDecals();
const shockwaves = new Shockwaves();
const screenEffects = new ScreenEffects();
const audio = new AudioEngine();
const hud = new HUD(uiOverlay);
const debugOverlay = new DebugOverlay(uiOverlay);
const touchInput = new TouchInput(uiOverlay);
const keyboardInput = new KeyboardInput(window);
const input = new InputManager([keyboardInput, touchInput]);

hud.setBestTime(null);

/** Margen entre cruzar la meta y abrir el panel de resultados (ms). */
const FINISH_PANEL_DELAY_MS = 950;

const race = new RaceManager(track, {
  onStateChange: (state) => {
    if (state === 'COUNTDOWN') {
      screenEffects.reset();
      shockwaves.reset();
      hitStopRemaining = 0;
      resultsScreen.hide();
      // El HUD refresca el record al volver a la salida. Sin esto la marca que
      // se acaba de batir no aparece hasta recargar la pagina: el jugador bate
      // su tiempo, reinicia, y el HUD sigue diciendo "--:--.---".
      hud.setBestTime(race.getBestTimeSeconds());
      hud.showCenterMessage(String(Math.ceil(race.countdownRemaining)));
    } else if (state === 'RACING') {
      hud.hideCenterMessage();
    } else if (state === 'CRASHED') {
      audio.playCrashCue();
      screenEffects.punch(1);
      screenEffects.flash('rgba(255, 60, 30, 1)', 0.5, 0.35);
      hitStop(SpectacleConfig.hitStopBig);
      camera.triggerCrashImpulse();
      particles.spawnBurst(race.bike.x, race.bike.y, 18);
      decals.spawn(race.bike.x, race.bike.y - 0.2, SpriteImages.landingImpact);
      const summary = race.getResultsSummary();
      resultsScreen.show(summary, true);
    } else if (state === 'FINISHED') {
      // La meta tiene su propio instante ANTES del panel: cartel, sonido,
      // sacudida y tierra. Si el panel salta en el mismo fotograma en que se
      // corta la linea, la carrera no termina, se interrumpe.
      audio.playFinishCue();
      camera.triggerLandingImpulse(0.6);
      particles.spawnLandingImpact(race.bike.rear.contactX, race.bike.rear.groundY, 0.8);
      hud.showCenterMessage('META', true);
      hud.setBestTime(race.getBestTimeSeconds());
      const summary = race.getResultsSummary();
      window.setTimeout(() => {
        if (race.state !== 'FINISHED') return; // ya se ha reiniciado
        hud.hideCenterMessage();
        resultsScreen.show(summary, false);
      }, FINISH_PANEL_DELAY_MS);
    }
  },
  onRaceStart: () => {
    // Salida: el golpe de suspension lo aplica RaceManager sobre la fisica;
    // aqui van el polvo de las dos ruedas y la sacudida de camara que lo
    // acompanan.
    camera.triggerLandingImpulse(0.5);
    particles.spawnBurst(race.bike.rear.contactX, race.bike.rear.groundY, RaceStartConfig.launchDustParticles);
    particles.spawnBurst(race.bike.front.contactX, race.bike.front.groundY, Math.round(RaceStartConfig.launchDustParticles * 0.6));
  },
  onTrick: (trick) => {
    // El truco ya lo puntua RaceManager; aqui es donde se GRITA. Sin cartel,
    // un mortal hacia atras y un salto normal se ven igual de premiados, que
    // es lo mismo que no premiarlos.
    audio.playBoostCue();
    // Un truco para el tiempo un instante. Es la convencion arcade de toda la
    // vida y funciona porque el ojo necesita un cuadro quieto para registrar
    // lo que acaba de pasar; sin ella, el mortal se lo traga el aterrizaje.
    hitStop(trick.rotations >= 2 ? SpectacleConfig.hitStopBig : SpectacleConfig.hitStop);
    screenEffects.flash('rgba(255, 255, 255, 1)', trick.rotations >= 2 ? 0.72 : 0.5, 0.3);
    camera.triggerLandingImpulse(1);
    award(trick.rotations >= 2 ? '¡DOBLE MORTAL!' : '¡MORTAL!', SpectacleConfig.awardPoints.trick);
  },
  onBoost: () => {
    audio.playBoostCue();
    screenEffects.flash('rgba(255, 214, 120, 1)', 0.42, 0.3);
    camera.triggerLandingImpulse(0.7);
    particles.spawnBurst(race.bike.rear.contactX, race.bike.rear.groundY, 16);
    hud.showAward('¡TURBO!');
  },
  onCombo: (links) => {
    if (links >= 2) audio.playComboCue(links);
  },
  onComboEnd: (links) => {
    if (links >= 3) award(`CADENA x${links}`, SpectacleConfig.awardPoints.comboClose * links);
  },
  onComboBreak: () => {
    screenEffects.flash('rgba(255, 40, 40, 1)', 0.4, 0.3);
  },
  onLanding: (event) => {
    // La fuerza del golpe sale de la velocidad de impacto, no de la etiqueta
    // de calidad: asi el mismo aterrizaje "GOOD" suena y se ve distinto si se
    // posa o si se estampa.
    const impact = Math.min(1, Math.abs(landingVerticalSpeed) / 13);
    audio.playLandingCue(event.quality, impact);
    camera.triggerLandingImpulse(impact);

    const contactX = race.bike.rear.inContact ? race.bike.rear.contactX : race.bike.x;
    const contactY = race.bike.rear.inContact ? race.bike.rear.groundY : race.bike.y - 0.4;
    particles.spawnLandingImpact(contactX, contactY, impact);

    // Onda expansiva proporcional al golpe: es lo que hace que un aterrizaje
    // de verdad se SIENTA distinto de posar la moto.
    shockwaves.spawn(contactX, contactY, impact);
    screenEffects.punch(impact);
    if (impact > 0.55) hitStop(SpectacleConfig.hitStop * impact);

    if (event.airTime >= SpectacleConfig.bigAirSeconds) {
      const seconds = event.airTime.toFixed(1).replace('.', ',');
      award(`¡VUELO! ${seconds} s`, Math.round(SpectacleConfig.awardPoints.bigAir * event.airTime));
    }
    if (event.quality === 'PERFECT') award('ATERRIZAJE PERFECTO', SpectacleConfig.awardPoints.perfectLanding);
    // Un aterrizaje regular cuesta velocidad y un eslabon de cadena. Quitarle
    // las dos cosas al jugador sin decirselo lo deja preguntandose por que va
    // lento, asi que se canta -en rojo apagado y solo si venia de un vuelo de
    // verdad, para no llenar la pantalla de avisos en una chapa de lavar-.
    if (
      (event.quality === 'ROUGH' || event.quality === 'BAD') &&
      event.airTime >= LandingConfig.minAirTimeForSpeedChange
    ) {
      const perdida = Math.round(-LandingConfig.speedChange[event.quality] * 100);
      const titulo = event.quality === 'BAD' ? '¡MAL APOYO!' : 'APOYO SUCIO';
      hud.showAward(`${titulo}  -${perdida}% VELOCIDAD`, undefined, 'penalty');
    }

    if (event.quality === 'PERFECT' || event.quality === 'GOOD') {
      decals.spawn(contactX, contactY + 0.05, SpriteImages.landingImpact);
    } else if (event.quality === 'ROUGH' || event.quality === 'BAD') {
      const roughDecal = Math.random() < 0.5 ? SpriteImages.dirtSpray : SpriteImages.tireSkid;
      decals.spawn(contactX, contactY + 0.05, roughDecal);
    }
  },
  onSpeedPad: () => {
    // El sprite del pad ya esta pintado de forma permanente en el suelo
    // (ver Renderer.drawGameplayFeatures); aqui solo el "chispazo" del boost.
    audio.playBoostCue();
    particles.spawnBurst(race.bike.x, race.bike.y - 0.2, 12);
    decals.spawn(race.bike.x, race.bike.y - 0.2, SpriteImages.speedPadFx);
    shockwaves.spawn(race.bike.x, race.bike.rear.groundY, 0.7, 'rgba(255, 190, 90, 1)');
    screenEffects.flash('rgba(255, 176, 80, 1)', 0.3, 0.22);
    award('TURBO', SpectacleConfig.awardPoints.speedPad);
  },
  onFlowRing: (hit) => {
    if (!hit) return;
    audio.playBoostCue();
    camera.triggerLandingImpulse();
    particles.spawnBurst(race.bike.x, race.bike.y, 16);
    decals.spawn(race.bike.x, race.bike.y, SpriteImages.flowRingHit);
    // La onda sale EN EL AIRE, a la altura de la moto: el aro se atraviesa
    // volando, no en el suelo.
    shockwaves.spawn(race.bike.x, race.bike.y, 1, 'rgba(140, 220, 255, 1)');
    screenEffects.flash('rgba(150, 225, 255, 1)', 0.42, 0.26);
    award('¡ARO!', SpectacleConfig.awardPoints.flowRing);
  },
  onRiskGapCleared: () => {
    audio.playBoostCue();
    particles.spawnBurst(race.bike.x, race.bike.y, 10);
    decals.spawn(race.bike.x, race.bike.y, SpriteImages.riskGapFx);
    screenEffects.flash('rgba(255, 120, 60, 1)', 0.4, 0.26);
    award('LINEA DE RIESGO', SpectacleConfig.awardPoints.riskGap);
  },
});

hud.setBestTime(race.getBestTimeSeconds());

const resultsScreen = new ResultsScreen(uiOverlay, () => {
  race.restart();
});

let lastFront = false;
let lastRear = false;
/**
 * Velocidad vertical del ultimo instante EN EL AIRE. En el tick en que se
 * detecta el aterrizaje la suspension ya ha absorbido parte del golpe, asi
 * que leer vy en ese momento subestima el impacto.
 */
let landingVerticalSpeed = 0;
let audioStarted = false;
/** Restos fraccionarios de particulas de deslizamiento por rueda (ver ParticleSystem.spawnSlipDust). */
let frontSlipCarry = 0;
let rearSlipCarry = 0;
/** Tiempo desde la ultima marca de derrape, por rueda. */
let frontSkidCooldown = 0;
let rearSkidCooldown = 0;
/** Restos fraccionarios del polvo continuo de rodadura y de frenada. */
let rollingDustCarry = 0;
let brakeDustCarry = 0;
/** Resto fraccionario de la llamarada del escape. */
let flameCarry = 0;
/** Ultimo estado visto de la cuenta atras, para pitar una sola vez por numero. */
let lastCountdownBeep = -1;
/** Escala de tiempo vigente y reloj real, para la camara lenta de los saltos. */
let timeScale = 1;
let lastFrameMs = performance.now();
/** Segundos de tiempo real que quedan de congelacion tras un golpe o un truco. */
let hitStopRemaining = 0;

/**
 * Congela la imagen un instante. Se cuenta en tiempo REAL y se aplica como
 * escala de tiempo casi cero, asi que no hay un segundo mecanismo de pausa
 * que pueda desincronizarse con la camara lenta: es la misma palanca.
 */
function hitStop(seconds: number): void {
  hitStopRemaining = Math.max(hitStopRemaining, seconds);
}

/**
 * Canta un premio con los puntos YA multiplicados por la cadena y el REDLINE.
 * El cartel tiene que decir lo que se ha sumado de verdad; si dijera el valor
 * base, el jugador veria "+400" mientras el marcador sube 3200 y el
 * multiplicador dejaria de significar nada.
 */
function award(text: string, basePoints?: number): void {
  hud.showAward(text, basePoints === undefined ? undefined : Math.round(basePoints * race.scoreMultiplier));
}

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
  // El radio de rueda se publica en vez de copiarse en el arnes: es el numero
  // con el que se comprueba la rodadura pura (giro = distancia / radio), y una
  // copia a mano se queda desfasada en cuanto se recalibra el arte -paso
  // exactamente eso-, y entonces el informe acusa al juego de un fallo suyo.
  wheelRadius: BikeConfig.wheelRadius,
  labels: track.labels.map((label) => ({ name: label.name, x: label.x })),
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
      if (!race.bike.front.inContact && !race.bike.rear.inContact) landingVerticalSpeed = race.bike.vy;
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

      // Polvo continuo de rodadura: lo gobierna el ESFUERZO que pasa por la
      // rueda trasera -gas y carga-, no la velocidad. Salir de parado a fondo
      // levanta tierra aunque la moto casi no se mueva; rodar lanzado por una
      // recta sin tocar nada, apenas.
      if (race.bike.rear.inContact) {
        const effort = Math.max(
          race.bike.throttleAmount * Math.min(1, normalizedAxleLoad(race.bike, 'rear') / 1.4),
          Math.min(1, Math.abs(race.bike.rear.wheel.slip) / 3),
        );
        rollingDustCarry = particles.spawnRollingDust(
          race.bike.rear.contactX,
          race.bike.rear.groundY,
          race.bike.vx,
          effort,
          dt,
          rollingDustCarry,
        );
      } else {
        rollingDustCarry = 0;
      }

      // Polvo de frenada: sale hacia adelante y bajo, y solo con la delantera
      // apoyada y freno de verdad.
      if (race.bike.front.inContact && race.bike.brakeAmount > 0.3 && Math.abs(race.bike.vx) > 3) {
        brakeDustCarry = particles.spawnBrakeDust(
          race.bike.front.contactX,
          race.bike.front.groundY,
          race.bike.vx,
          dt,
          brakeDustCarry,
        );
      } else {
        brakeDustCarry = 0;
      }

      // Llamarada del escape: solo en REDLINE. Nace en la boca del tubo, con
      // la velocidad de la moto mas el chorro, asi que se queda atras en el
      // mundo en vez de viajar pegada al escape.
      if (race.flow.isRedline && race.state === 'RACING') {
        const mouth = localToWorld(race.bike, EXHAUST_LOCAL);
        // Hacia atras del chasis, girado con el: en un mortal el chorro
        // apunta a donde apunta el tubo.
        const direction = rotateVec({ x: -1, y: 0.12 }, race.bike.angle);
        flameCarry = particles.spawnExhaustFlame(
          mouth.x,
          mouth.y,
          direction,
          race.bike.vx,
          race.bike.vy,
          0.45 + race.bike.throttleAmount * 0.55,
          dt,
          flameCarry,
        );
      } else {
        flameCarry = 0;
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
      camera.update(
        dt,
        {
          x: race.bike.x,
          y: race.bike.y,
          vx: race.bike.vx,
          vy: race.bike.vy,
          // El terreno bajo la moto, para que la camara pueda encuadrar la
          // caida en los saltos grandes (ver Camera.update).
          groundY: track.terrain.surfaceY(race.bike.x),
        },
        race.flightTracker.currentAirTime,
      );

      particles.update(dt);
      decals.update(dt);
      shockwaves.update(dt);
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
        shockwaves,
        screenEffects,
        flowValue: race.flow.value,
        isRedline: race.flow.isRedline,
        crashed: race.state === 'CRASHED',
        crashElapsed: race.timeSinceCrash,
        ghost: race.getGhostPose(),
      });

      const boostReady = race.flow.isBoostReady && race.state === 'RACING';
      hud.update(
        race.raceTime,
        race.currentSectorName,
        race.flow.value,
        race.flow.isRedline,
        race.getLiveDeltaSeconds(),
        boostReady,
      );
      touchInput.setBoostReady(boostReady);
      hud.setScore(race.styleScore.score, race.scoreMultiplier);
      // La cadena solo se ensena EN CARRERA: al cruzar meta o estrellarse el
      // reloj de la cadena deja de correr, asi que sin esto se quedaria
      // congelada encima del panel de resultados.
      const racing = race.state === 'RACING';
      hud.setCombo(racing ? race.combo.links : 0, race.combo.multiplier, race.combo.remainingFraction);

      // CAMARA LENTA. Se activa por tiempo de vuelo, no por altura: lo que
      // hace espectacular un salto es cuanto dura, y ademas asi el efecto no
      // salta en cada bache de medio metro. Entra despacio y sale rapido,
      // porque volver al tiempo real de golpe al tocar suelo es lo que hace
      // que el aterrizaje pegue.
      const airborne = !race.bike.front.inContact && !race.bike.rear.inContact;
      const wantsSlowMotion = airborne && race.flightTracker.currentAirTime >= SpectacleConfig.slowMotionAirTime;
      const targetScale = wantsSlowMotion ? SpectacleConfig.slowMotionScale : 1;
      const blend = wantsSlowMotion ? SpectacleConfig.slowMotionBlendIn : SpectacleConfig.slowMotionBlendOut;
      // Se mezcla con el tiempo REAL del fotograma, no con el simulado: si se
      // usara el simulado, la propia camara lenta ralentizaria su salida y el
      // efecto se quedaria pegado.
      const realDt = Math.min(0.05, (performance.now() - lastFrameMs) / 1000);
      lastFrameMs = performance.now();
      timeScale += (targetScale - timeScale) * Math.min(1, blend * realDt);

      // La congelacion manda sobre la camara lenta: mientras dura, el tiempo
      // se para del todo. Se descuenta con el reloj REAL, porque si se
      // descontara con el simulado -que es justo el que acaba de pararse- no
      // terminaria nunca.
      hitStopRemaining = Math.max(0, hitStopRemaining - realDt);
      loop.setTimeScale(hitStopRemaining > 0 ? 0.05 : timeScale);

      // Efectos de pantalla: tambien con el reloj real, para que un destello
      // dure lo mismo a camara lenta que a velocidad normal.
      screenEffects.update(realDt);
      // Lineas de velocidad: solo con REDLINE y a partir de media velocidad.
      // Fuera del turbo ensucian la pantalla sin decir nada.
      const speedFraction = Math.max(0, Math.min(1, (Math.abs(race.bike.vx) / EngineConfig.topSpeed - 0.5) * 2));
      screenEffects.setSpeedLines(race.flow.isRedline ? speedFraction : 0);

      if (race.state === 'COUNTDOWN') {
        const remaining = race.countdownRemaining;
        hud.showCenterMessage(remaining > 0.15 ? String(Math.ceil(remaining)) : '¡YA!', remaining <= 0.15);
        // Un pitido por numero, y uno mas agudo y largo en el GO.
        const step = remaining > 0.15 ? Math.ceil(remaining) : 0;
        if (step !== lastCountdownBeep) {
          lastCountdownBeep = step;
          if (audioStarted) audio.playCountdownCue(step === 0);
        }
      } else if (race.state === 'RACING') {
        lastCountdownBeep = -1;
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
        timeScale,
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
        boostReady: race.flow.isBoostReady,
        isRedline: race.flow.isRedline,
        comboLinks: race.combo.links,
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
        pixelsPerMeter: cameraPose.pixelsPerMeter,
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
