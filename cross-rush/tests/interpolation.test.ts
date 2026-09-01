import { describe, expect, it } from 'vitest';
import { Terrain } from '../src/physics/Terrain';
import { BikeState, createInitialBikeState, lerpBikeState, stepBike } from '../src/physics/Bike';
import { GameLoop } from '../src/core/GameLoop';
import { RaceManager } from '../src/gameplay/RaceManager';
import { InputState } from '../src/input/InputManager';
import { buildCanyonRun } from '../src/tracks/CanyonRun';
import { SIM_DT } from '../src/config/GameConfig';

function flatTerrain(): Terrain {
  return new Terrain([
    { x: -60, y: 0 },
    { x: 0, y: 0 },
    { x: 2000, y: 0 },
  ]);
}

const neutral = (): InputState => ({ throttle: false, brake: false, lean: 0, restartPressed: false, boostPressed: false });
const gas = (): InputState => ({ throttle: true, brake: false, lean: 0, restartPressed: false, boostPressed: false });

/** Distancia angular por el camino corto, en (-PI, PI]. */
function shortest(a: number, b: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

describe('lerpBikeState', () => {
  it('alpha 0 y 1 devuelven exactamente los estados de origen y destino', () => {
    const terrain = flatTerrain();
    const previous = createInitialBikeState(0, 1.5);
    const current = stepBike(previous, terrain, { throttle: true, brake: false, lean: 0 }, SIM_DT);

    const at0 = lerpBikeState(previous, current, 0);
    const at1 = lerpBikeState(previous, current, 1);

    expect(at0.x).toBe(previous.x);
    expect(at0.y).toBe(previous.y);
    expect(at0.angle).toBe(previous.angle);
    expect(at0.rear.wheel.spin).toBe(previous.rear.wheel.spin);
    expect(at1.x).toBe(current.x);
    expect(at1.angle).toBe(current.angle);
    expect(at1.rear.wheel.spin).toBe(current.rear.wheel.spin);
  });

  it('alpha 0.5 cae justo en medio en posicion, suspension, ruedas y pose del piloto', () => {
    const terrain = flatTerrain();
    let previous = createInitialBikeState(0, 1.5);
    for (let i = 0; i < 120; i++) {
      previous = stepBike(previous, terrain, { throttle: true, brake: false, lean: 0.4 }, SIM_DT);
    }
    const current = stepBike(previous, terrain, { throttle: true, brake: false, lean: 0.4 }, SIM_DT);
    const mid = lerpBikeState(previous, current, 0.5);

    expect(mid.x).toBeCloseTo((previous.x + current.x) / 2, 12);
    expect(mid.y).toBeCloseTo((previous.y + current.y) / 2, 12);
    expect(mid.vx).toBeCloseTo((previous.vx + current.vx) / 2, 12);
    expect(mid.front.compression).toBeCloseTo((previous.front.compression + current.front.compression) / 2, 12);
    expect(mid.rear.load).toBeCloseTo((previous.rear.load + current.rear.load) / 2, 12);
    expect(mid.rider.shiftX).toBeCloseTo((previous.rider.shiftX + current.rider.shiftX) / 2, 12);
    expect(mid.rider.torsoAngle).toBeCloseTo((previous.rider.torsoAngle + current.rider.torsoAngle) / 2, 12);

    // El estado intermedio siempre queda ENTRE los dos, nunca fuera.
    const lo = Math.min(previous.x, current.x);
    const hi = Math.max(previous.x, current.x);
    expect(mid.x).toBeGreaterThanOrEqual(lo);
    expect(mid.x).toBeLessThanOrEqual(hi);
  });

  it('interpola el angulo del chasis por el camino corto al cruzar +-PI', () => {
    const base = createInitialBikeState(0, 1.5);
    // 3.10 rad -> -3.10 rad son 0.083 rad por el camino corto, no 6.2 en sentido contrario.
    const previous: BikeState = { ...base, angle: 3.1 };
    const current: BikeState = { ...base, angle: -3.1 };

    const mid = lerpBikeState(previous, current, 0.5);
    // El punto medio esta justo en la discontinuidad: |angulo| ~ PI.
    expect(Math.abs(mid.angle)).toBeCloseTo(Math.PI, 3);
    // Y sobre todo: el camino recorrido es el corto, no casi una vuelta entera.
    expect(Math.abs(shortest(previous.angle, mid.angle))).toBeLessThan(0.1);
    expect(Math.abs(shortest(mid.angle, current.angle))).toBeLessThan(0.1);

    // Un cuarto del camino se queda muy cerca del origen, no al otro lado.
    const quarter = lerpBikeState(previous, current, 0.25);
    expect(Math.abs(shortest(previous.angle, quarter.angle))).toBeLessThan(0.05);
  });

  it('interpola el angulo de la RUEDA por el camino corto al cruzar +-PI', () => {
    const base = createInitialBikeState(0, 1.5);
    const previous: BikeState = {
      ...base,
      rear: { ...base.rear, wheel: { spin: 3.05, spinRate: 100, slip: 0 } },
    };
    const current: BikeState = {
      ...base,
      rear: { ...base.rear, wheel: { spin: -3.05, spinRate: 100, slip: 0 } },
    };
    const mid = lerpBikeState(previous, current, 0.5);
    // Sin camino corto, la rueda aparentaria dar casi una vuelta hacia atras
    // en un solo fotograma: el artefacto clasico de la rueda "rebobinando".
    expect(Math.abs(shortest(previous.rear.wheel.spin, mid.rear.wheel.spin))).toBeLessThan(0.15);
  });

  it('alpha fuera de rango o no finito no rompe el estado dibujado', () => {
    const terrain = flatTerrain();
    const previous = createInitialBikeState(0, 1.5);
    const current = stepBike(previous, terrain, { throttle: true, brake: false, lean: 0 }, SIM_DT);
    for (const alpha of [-3, 2, Number.NaN, Number.POSITIVE_INFINITY]) {
      const s = lerpBikeState(previous, current, alpha);
      expect(Number.isFinite(s.x)).toBe(true);
      expect(Number.isFinite(s.y)).toBe(true);
      expect(Number.isFinite(s.angle)).toBe(true);
      expect(Number.isFinite(s.rear.wheel.spin)).toBe(true);
    }
  });
});

describe('RaceManager.getInterpolatedBike', () => {
  it('entrega estados coherentes entre el tick anterior y el actual', () => {
    const race = new RaceManager(buildCanyonRun());
    race.begin();
    while (race.state === 'COUNTDOWN') race.step(SIM_DT, neutral());
    for (let i = 0; i < 240; i++) race.step(SIM_DT, gas());

    const a = race.getInterpolatedBike(0);
    const b = race.getInterpolatedBike(0.5);
    const c = race.getInterpolatedBike(1);

    expect(a.x).toBeCloseTo(race.previousBike.x, 12);
    expect(c.x).toBeCloseTo(race.bike.x, 12);
    // Monotono: la moto va hacia adelante, asi que tambien lo hace la interpolacion.
    expect(b.x).toBeGreaterThan(a.x);
    expect(c.x).toBeGreaterThan(b.x);
  });

  it('tras un reinicio no interpola desde la carrera anterior', () => {
    const track = buildCanyonRun();
    const race = new RaceManager(track);
    race.begin();
    while (race.state === 'COUNTDOWN') race.step(SIM_DT, neutral());
    for (let i = 0; i < 600; i++) race.step(SIM_DT, gas());
    expect(race.bike.x).toBeGreaterThan(track.startX + 20);

    race.restart();
    // Sin resincronizar el estado previo, el primer fotograma tras reiniciar
    // dibujaria la moto a medio camino entre donde estaba y la linea de salida.
    const drawn = race.getInterpolatedBike(0.5);
    expect(drawn.x).toBeCloseTo(track.startX, 6);
    expect(drawn.y).toBeCloseTo(track.startY, 6);
  });
});

describe('independencia del ritmo de render', () => {
  it('la simulacion avanza igual con patrones de frame de 30, 60 y 120 Hz', () => {
    function runAtRenderHz(renderHz: number): { steps: number; alphas: number[] } {
      let steps = 0;
      const alphas: number[] = [];
      const loop = new GameLoop(
        {
          step: () => {
            steps += 1;
          },
          render: (alpha) => {
            alphas.push(alpha);
          },
        },
        SIM_DT,
      );
      const frameMs = 1000 / renderHz;
      const frames = Math.round(renderHz * 2); // 2 segundos de reloj real
      loop.advance(0); // primer frame: inicializa el reloj
      for (let i = 0; i < frames; i++) loop.advance(frameMs);
      return { steps, alphas };
    }

    const results = [30, 60, 120].map((hz) => runAtRenderHz(hz));
    // Dos segundos de reloj real son siempre los mismos ticks de simulacion,
    // caiga donde caiga cada fotograma.
    const expectedSteps = Math.round(2 / SIM_DT);
    for (const r of results) {
      expect(Math.abs(r.steps - expectedSteps)).toBeLessThanOrEqual(2);
      for (const alpha of r.alphas) {
        expect(alpha).toBeGreaterThanOrEqual(0);
        expect(alpha).toBeLessThan(1.0000001);
      }
    }
  });

  it('la moto llega al mismo sitio con render a 30, 60 y 120 Hz', () => {
    function raceAtRenderHz(renderHz: number): BikeState {
      const race = new RaceManager(buildCanyonRun());
      race.begin();
      const loop = new GameLoop(
        {
          step: (dt) => race.step(dt, race.state === 'COUNTDOWN' ? neutral() : gas()),
          // El render solo lee: no debe poder alterar la simulacion.
          render: (alpha) => {
            race.getInterpolatedBike(alpha);
          },
        },
        SIM_DT,
      );
      const frameMs = 1000 / renderHz;
      loop.advance(0);
      for (let i = 0; i < Math.round(renderHz * 6); i++) loop.advance(frameMs);
      return race.bike;
    }

    const at30 = raceAtRenderHz(30);
    const at60 = raceAtRenderHz(60);
    const at120 = raceAtRenderHz(120);

    // Mismo numero de ticks de simulacion -> exactamente el mismo estado.
    expect(at60.x).toBeCloseTo(at30.x, 6);
    expect(at120.x).toBeCloseTo(at30.x, 6);
    expect(at60.angle).toBeCloseTo(at30.angle, 6);
    expect(at120.rear.wheel.spin).toBeCloseTo(at30.rear.wheel.spin, 6);
  });
});
