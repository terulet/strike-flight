import { describe, expect, it } from 'vitest';
import { Terrain } from '../src/physics/Terrain';
import { BikeState, createInitialBikeState, isAirborne, stepBike } from '../src/physics/Bike';
import { Camera } from '../src/rendering/Camera';
import { RaceManager } from '../src/gameplay/RaceManager';
import { InputSmoother } from '../src/input/InputSmoothing';
import { InputState } from '../src/input/InputManager';
import { buildCanyonRun } from '../src/tracks/CanyonRun';
import { GhostConfig, SIM_DT } from '../src/config/GameConfig';
import { sampleGhostAtTime } from '../src/gameplay/GhostRecorder';

const neutral = (): InputState => ({ throttle: false, brake: false, lean: 0, restartPressed: false, boostPressed: false });

function flatTerrain(): Terrain {
  return new Terrain([
    { x: -60, y: 0 },
    { x: 0, y: 0 },
    { x: 3000, y: 0 },
  ]);
}

function bumpyTerrain(): Terrain {
  const points = [{ x: -60, y: 0 }];
  for (let x = 0; x <= 600; x += 6) {
    points.push({ x, y: Math.sin(x * 0.21) * 1.6 + Math.sin(x * 0.061) * 3.4 });
  }
  return new Terrain(points);
}

describe('suavizado de entrada', () => {
  it('convierte un boton binario en una rampa continua, sin escalones', () => {
    const smoother = new InputSmoother();
    const pressed: InputState = { throttle: true, brake: false, lean: 0, restartPressed: false, boostPressed: false };
    const values: number[] = [];
    for (let i = 0; i < Math.round(0.5 / SIM_DT); i++) {
      values.push(smoother.update(pressed, SIM_DT).throttle);
    }
    expect(values[0]).toBeGreaterThan(0);
    expect(values[0]).toBeLessThan(0.2); // no salta a 1 en el primer tick
    expect(values[values.length - 1]).toBeCloseTo(1, 6);
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]);
      expect(values[i] - values[i - 1]).toBeLessThan(0.25);
    }
  });

  it('soltar tampoco corta de golpe', () => {
    const smoother = new InputSmoother();
    const pressed: InputState = { throttle: true, brake: false, lean: 0, restartPressed: false, boostPressed: false };
    for (let i = 0; i < Math.round(1 / SIM_DT); i++) smoother.update(pressed, SIM_DT);
    const first = smoother.update(neutral(), SIM_DT).throttle;
    expect(first).toBeGreaterThan(0.85);
    expect(first).toBeLessThan(1);
  });

  it('el lean llega al tope rapido: en el aire es el unico control que hay', () => {
    const smoother = new InputSmoother();
    const up: InputState = { throttle: false, brake: false, lean: 1, restartPressed: false, boostPressed: false };
    let ticks = 0;
    while (smoother.update(up, SIM_DT).lean < 1 && ticks < 1000) ticks += 1;
    expect(ticks * SIM_DT).toBeLessThan(0.12);
  });
});

describe('sacudida de camara', () => {
  it('es determinista: el mismo instante da siempre la misma sacudida', () => {
    const camera = new Camera();
    const target = { x: 0, y: 0, vx: 12, vy: 0 };
    camera.reset(target);
    camera.update(SIM_DT, target, 0);
    camera.triggerCrashImpulse();
    for (let i = 0; i < 5; i++) camera.update(SIM_DT, target, 0);

    const a = camera.getShakeOffset(0.5);
    const b = camera.getShakeOffset(0.5);
    expect(a.x).toBe(b.x);
    expect(a.y).toBe(b.y);
    expect(a.x === 0 && a.y === 0).toBe(false);
  });

  it('se amortigua hasta cero en vez de vibrar sin parar', () => {
    const camera = new Camera();
    const target = { x: 0, y: 0, vx: 12, vy: 0 };
    camera.reset(target);
    camera.update(SIM_DT, target, 0);
    camera.triggerCrashImpulse();

    let peakEarly = 0;
    let peakLate = 0;
    for (let i = 0; i < Math.round(0.5 / SIM_DT); i++) {
      camera.update(SIM_DT, target, 0);
      const t = i * SIM_DT;
      const offset = camera.getShakeOffset(1);
      const magnitude = Math.hypot(offset.x, offset.y);
      if (t < 0.05) peakEarly = Math.max(peakEarly, magnitude);
      if (t > 0.25) peakLate = Math.max(peakLate, magnitude);
    }
    expect(peakEarly).toBeGreaterThan(0);
    expect(peakLate).toBeLessThan(peakEarly);

    // Y termina exactamente en cero, no en un temblor residual.
    for (let i = 0; i < Math.round(1 / SIM_DT); i++) camera.update(SIM_DT, target, 0);
    const settled = camera.getShakeOffset(1);
    expect(settled.x).toBe(0);
    expect(settled.y).toBe(0);
  });

  it('la zona muerta vertical se come los baches pequenos y deja pasar los cambios reales', () => {
    function verticalTravel(amplitude: number, seconds: number): number {
      const camera = new Camera();
      camera.reset({ x: 0, y: 0, vx: 15, vy: 0 });
      for (let i = 0; i < Math.round(2 / SIM_DT); i++) {
        camera.update(SIM_DT, { x: 0, y: 0, vx: 15, vy: 0 }, 0);
      }
      const settledY = camera.y;
      let travel = 0;
      for (let i = 0; i < Math.round(seconds / SIM_DT); i++) {
        const bump = Math.sin(i * SIM_DT * 9) * amplitude;
        camera.update(SIM_DT, { x: 0, y: bump, vx: 15, vy: 0 }, 0);
        travel = Math.max(travel, Math.abs(camera.y - settledY));
      }
      return travel;
    }

    // Baches de 15 cm: la camara casi no se entera.
    const small = verticalTravel(0.15, 2);
    expect(small / 0.15).toBeLessThan(0.25);

    // Un salto de 4 m: la camara si tiene que seguirlo, o se pierde la moto.
    const large = verticalTravel(4, 2);
    expect(large).toBeGreaterThan(2);
  });
});

describe('robustez numerica', () => {
  it('un barrido de fuzz sobre terreno irregular no produce NaN ni Infinity', () => {
    const terrain = bumpyTerrain();
    // Generador determinista: un fallo se puede reproducir tal cual.
    let seed = 20260831;
    const random = (): number => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0xffffffff;
    };

    for (let run = 0; run < 6; run++) {
      const smoother = new InputSmoother();
      let state: BikeState = createInitialBikeState(2, 6);
      let throttle = false;
      let brake = false;
      let lean = 0;
      for (let i = 0; i < Math.round(12 / SIM_DT); i++) {
        if (i % 11 === 0) {
          throttle = random() < 0.6;
          brake = random() < 0.25;
          lean = Math.round(random() * 2) - 1;
        }
        const smoothed = smoother.update({ throttle, brake, lean, restartPressed: false, boostPressed: false }, SIM_DT);
        state = stepBike(state, terrain, { throttle, brake, lean: smoothed.lean, smoothed }, SIM_DT);

        for (const value of [
          state.x,
          state.y,
          state.vx,
          state.vy,
          state.angle,
          state.angularVelocity,
          state.front.compression,
          state.rear.compression,
          state.front.load,
          state.rear.load,
          state.front.wheel.spin,
          state.rear.wheel.spin,
          state.front.wheel.spinRate,
          state.rear.wheel.spinRate,
          state.front.wheel.slip,
          state.rear.wheel.slip,
          state.rider.shiftX,
          state.rider.shiftY,
          state.rider.torsoAngle,
        ]) {
          expect(Number.isFinite(value)).toBe(true);
        }
        // Los angulos guardados siempre normalizados: sin esto acaban creciendo
        // sin limite y la precision de coma flotante se degrada sola.
        expect(Math.abs(state.angle)).toBeLessThanOrEqual(Math.PI + 1e-9);
        expect(Math.abs(state.rear.wheel.spin)).toBeLessThanOrEqual(Math.PI + 1e-9);
      }
    }
  });

  it('un dt degenerado (0) no rompe el estado', () => {
    const terrain = flatTerrain();
    let state = createInitialBikeState(0, 1.5);
    for (let i = 0; i < 10; i++) {
      state = stepBike(state, terrain, { throttle: true, brake: false, lean: 0 }, 0);
    }
    expect(Number.isFinite(state.x)).toBe(true);
    expect(Number.isFinite(state.rear.wheel.spinRate)).toBe(true);
  });
});

describe('el fantasma sigue sincronizado tras ampliar BikeState', () => {
  it('graba y reproduce la trayectoria con el estado nuevo de la moto', () => {
    const track = buildCanyonRun();
    const race = new RaceManager(track);
    race.begin();
    while (race.state === 'COUNTDOWN') race.step(SIM_DT, neutral());

    const samples: Array<{ t: number; x: number }> = [];
    for (let i = 0; i < Math.round(6 / SIM_DT); i++) {
      race.step(SIM_DT, { throttle: true, brake: false, lean: 0, restartPressed: false, boostPressed: false });
      if (race.state !== 'RACING') break;
      samples.push({ t: race.raceTime, x: race.bike.x });
    }

    const frames = race.ghost.recordedFrames;
    expect(frames.length).toBeGreaterThan(10);
    // El muestreo respeta su intervalo configurado.
    for (let i = 1; i < frames.length; i++) {
      expect(frames[i].t).toBeGreaterThan(frames[i - 1].t);
      expect(frames[i].t - frames[i - 1].t).toBeLessThan(GhostConfig.sampleInterval * 2);
    }

    // Y reproducido en un instante cualquiera cae donde estuvo la moto.
    const probe = samples[Math.floor(samples.length * 0.7)];
    const pose = sampleGhostAtTime(frames, probe.t);
    expect(pose).not.toBeNull();
    expect(Math.abs(pose!.x - probe.x)).toBeLessThan(1.0);
    expect(Number.isFinite(pose!.rotation)).toBe(true);
  });
});

describe('el corte vertical sigue siendo jugable de punta a punta', () => {
  it('un piloto sencillo enlaza compresion, tabletop, step-up y bajada sin estrellarse', () => {
    const track = buildCanyonRun();
    const race = new RaceManager(track);
    race.begin();
    while (race.state === 'COUNTDOWN') race.step(SIM_DT, neutral());

    const seen = new Set<string>();

    while (race.state === 'RACING' && race.raceTime < 60 && race.bike.x < track.finishX) {
      let lean = 0;
      if (isAirborne(race.bike)) {
        const bike = race.bike;
        const ahead = Math.max(2, Math.abs(bike.vx) * 0.32);
        let delta = Math.atan(track.terrain.surfaceSlope(bike.x + ahead)) - bike.angle;
        while (delta > Math.PI) delta -= Math.PI * 2;
        while (delta <= -Math.PI) delta += Math.PI * 2;
        // P + D: apuntar al terreno que viene y frenar la propia rotacion.
        const want = delta * 2.2 - bike.angularVelocity * 0.42;
        lean = want > 0.25 ? 1 : want < -0.25 ? -1 : 0;
      }
      race.step(SIM_DT, { throttle: true, brake: false, lean, restartPressed: false, boostPressed: false });
      for (const feature of track.terrainFeatures) {
        if (race.bike.x >= feature.endX) seen.add(feature.kind);
      }
    }

    expect(race.state).toBe('FINISHED');
    for (const kind of ['tabletop', 'stepup', 'dropoff']) expect(seen.has(kind)).toBe(true);
  });

  it('el tramo dura entre 50 y 70 segundos a fondo', () => {
    const track = buildCanyonRun();
    const race = new RaceManager(track);
    race.begin();
    while (race.state === 'COUNTDOWN') race.step(SIM_DT, neutral());

    while (race.state === 'RACING' && race.raceTime < 90 && race.bike.x < track.finishX) {
      let lean = 0;
      if (isAirborne(race.bike)) {
        const bike = race.bike;
        const ahead = Math.max(2, Math.abs(bike.vx) * 0.32);
        let delta = Math.atan(track.terrain.surfaceSlope(bike.x + ahead)) - bike.angle;
        while (delta > Math.PI) delta -= Math.PI * 2;
        while (delta <= -Math.PI) delta += Math.PI * 2;
        const want = delta * 2.2 - bike.angularVelocity * 0.42;
        lean = want > 0.25 ? 1 : want < -0.25 ? -1 : 0;
      }
      race.step(SIM_DT, { throttle: true, brake: false, lean, restartPressed: false, boostPressed: false });
    }

    expect(race.state).toBe('FINISHED');
    // El objetivo original del corte vertical eran 30-45 s y la vuelta se
    // quedaba en 42. Se alargo a peticion, y no con recta: los 230 m nuevos
    // son cuatro tramos de obstaculos (ritmo, step-down, chapa de lavar con
    // pedregal, y la mesa de llegada), asi que lo que crece es el contenido y
    // no el tiempo muerto. A fondo y sin fallos salen 57 s; el rango deja
    // margen a los dos lados para que un retoque de una pieza no rompa la
    // prueba, pero no tanto como para que quepa media vuelta de relleno.
    expect(race.raceTime).toBeGreaterThan(50);
    expect(race.raceTime).toBeLessThan(70);
  });
});
