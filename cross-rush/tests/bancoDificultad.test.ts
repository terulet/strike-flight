/**
 * El banco de dificultad: que mida, que no haga trampas y que sea repetible.
 *
 * Un banco que no es determinista no mide nada -dos ejecuciones dan cosas
 * distintas y no se sabe si cambio el juego o el azar-, y un banco que hace
 * trampas mide su propia trampa. Estas pruebas vigilan las dos cosas, ademas
 * de que los tres perfiles sigan produciendo resultados claramente distintos.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { buildCanyonRun } from '../src/tracks/CanyonRun';
import { runBenchRace, runProfile, summarise } from '../src/tools/DifficultyBench';
import { TrackBuilder } from '../src/tracks/TrackBuilder';
import { Terrain } from '../src/physics/Terrain';
import { TrackDefinition } from '../src/tracks/CanyonRun';
import { storageKey } from '../src/config/GameConfig';

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];
const track = buildCanyonRun();

/** Escenario de laboratorio: un trozo de terreno y nada mas. */
function escenario(nombre: string, build: (b: TrackBuilder) => void): TrackDefinition {
  const builder = new TrackBuilder(0);
  builder.mark('START').flat(40);
  build(builder);
  builder.mark('FINISH').flat(60);
  const { points, labels, endX } = builder.build();
  const terrain = new Terrain(points);
  const finishX = endX - 30;
  return {
    terrain,
    labels,
    terrainFeatures: [],
    sectors: [{ name: nombre, startX: 0, endX: finishX }],
    startX: 6,
    startY: terrain.surfaceY(6) + 1.6,
    finishX,
    length: finishX,
  };
}

const ESCENARIOS: Array<{ nombre: string; track: TrackDefinition }> = [
  { nombre: 'pista plana', track: escenario('plana', (b) => b.flat(160)) },
  { nombre: 'rampa sencilla', track: escenario('rampa', (b) => b.rampUp(10, 2).flat(60).slope(12, -2).flat(40)) },
  { nombre: 'salto corto', track: escenario('salto corto', (b) => b.tabletop(8, 1.8, 6, 9).flat(60)) },
  { nombre: 'salto con valle', track: escenario('valle', (b) => b.rampUp(7, 2.2).gapValley(12, 3).flat(70)) },
  { nombre: 'recepcion inclinada', track: escenario('recepcion', (b) => b.rampUp(9, 3).landingSlope(24, 6).flat(60)) },
  { nombre: 'whoops', track: escenario('whoops', (b) => b.waves(7, 0.55, 8).flat(60)) },
  { nombre: 'mega salto', track: escenario('mega', (b) => b.slope(40, -12).flat(12).rampUp(11, 5).gapValley(20, 5).landingSlope(26, 10).flat(50)) },
];

describe('determinismo', () => {
  it('la misma semilla da exactamente el mismo resultado', () => {
    const a = runBenchRace(track, 'competente', 42);
    const b = runBenchRace(track, 'competente', 42);
    expect(b.state).toBe(a.state);
    expect(b.timeSeconds).toBe(a.timeSeconds);
    expect(b.distance).toBe(a.distance);
    expect(b.landings).toEqual(a.landings);
    expect(b.bestCombo).toBe(a.bestCombo);
  });

  it('semillas distintas dan intentos distintos, no copias', () => {
    const runs = runProfile(track, 'competente', SEEDS);
    const tiempos = new Set(runs.map((r) => r.timeSeconds.toFixed(3)));
    expect(tiempos.size).toBeGreaterThan(1);
  });

  it('el mundo no cambia con la semilla: solo cambia el piloto', () => {
    // El piloto perfecto no tiene ruido de punteria, asi que TODAS sus
    // semillas tienen que dar el mismo resultado exacto. Si no, la semilla
    // estaria tocando algo que no es el piloto.
    const runs = runProfile(track, 'perfecto', SEEDS);
    const tiempos = new Set(runs.map((r) => r.timeSeconds.toFixed(6)));
    expect(tiempos.size).toBe(1);
  });
});

describe('el banco no hace trampas', () => {
  let data: Map<string, string>;
  beforeEach(() => {
    data = new Map();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
      clear: () => data.clear(),
      key: (i: number) => [...data.keys()][i] ?? null,
      get length() { return data.size; },
    });
  });

  it('un piloto automatico no escribe NUNCA el record ni el fantasma del jugador', () => {
    data.set(storageKey('best-time', 'M01', 'jugador'), '999');
    runProfile(track, 'perfecto', [1, 2]);
    // Ni lo toca, ni crea claves propias: el banco corre sin persistencia.
    expect(data.get(storageKey('best-time', 'M01', 'jugador'))).toBe('999');
    expect(data.has(storageKey('best-ghost', 'M01', 'jugador'))).toBe(false);
    expect([...data.keys()].some((k) => k.startsWith('cross-rush:qa'))).toBe(false);
  });

  it('las claves de QA y las del jugador son distintas, y las de cada mision tambien', () => {
    const claves = [
      storageKey('best-time', 'M01', 'jugador'),
      storageKey('best-time', 'M01', 'qa'),
      storageKey('best-time', 'M02', 'jugador'),
      storageKey('best-ghost', 'M01', 'jugador'),
    ];
    expect(new Set(claves).size).toBe(claves.length);
  });
});

describe('los tres perfiles miden cosas distintas', () => {
  const descuidado = summarise(runProfile(track, 'descuidado', SEEDS));
  const competente = summarise(runProfile(track, 'competente', SEEDS));
  const perfecto = summarise(runProfile(track, 'perfecto', SEEDS));

  it('el descuidado no completa la mision', () => {
    // Objetivo del mandato: por debajo del 40%.
    expect(descuidado.completionRate).toBeLessThan(0.4);
  });

  it('el perfecto la completa casi siempre', () => {
    expect(perfecto.completionRate).toBeGreaterThanOrEqual(0.95);
  });

  it('el competente queda claramente entre los dos', () => {
    expect(competente.completionRate).toBeGreaterThan(descuidado.completionRate);
    expect(competente.completionRate).toBeLessThan(perfecto.completionRate);
  });

  it('DEUDA MEDIDA: el competente se queda en el 63%, por debajo del 80% que pide el mandato', () => {
    // Esta prueba no esconde el hueco, lo fija. El objetivo del mandato para
    // el piloto competente es completar la mision al menos el 80% de las
    // veces, y M01 lo deja en el 63%. El cuello de botella esta localizado:
    // TODAS las carreras que pierde caen en RISK_LINE_JUMP, no repartidas por
    // la vuelta.
    //
    // No se arregla desde aqui a proposito. El mandato prohibe expresamente
    // cambiar la geometria de una mision para que aprueben los pilotos
    // automaticos, y ademas seria justo la clase de autoengano que este banco
    // existe para evitar. La decision es de quien tenga la propiedad del
    // trazado; el banco pone el numero y la causa encima de la mesa.
    //
    // Si alguien retoca esa zona, esta prueba falla y obliga a actualizar la
    // cifra a conciencia en vez de dejarla pasar.
    expect(competente.completionRate).toBeGreaterThanOrEqual(0.5);
    expect(competente.completionRate).toBeLessThan(0.8);
    const enRiesgo = competente.failures.filter((causa) => causa.includes('RISK_LINE_JUMP'));
    expect(enRiesgo.length).toBe(competente.failures.length);
  });

  it('el perfecto apunta mejor, clava mas y encadena mas', () => {
    expect(perfecto.meanAngleError).toBeLessThan(competente.meanAngleError);
    expect(competente.meanAngleError).toBeLessThan(descuidado.meanAngleError);
    expect(perfecto.meanBestCombo).toBeGreaterThan(competente.meanBestCombo);
  });

  it('el perfecto es mas rapido que el competente', () => {
    expect(perfecto.meanTime).not.toBeNull();
    expect(competente.meanTime).not.toBeNull();
    expect(perfecto.meanTime!).toBeLessThan(competente.meanTime!);
  });

  it('cada perfil usa el turbo con una estrategia distinta', () => {
    expect(descuidado.meanBoosts).toBe(0);
    expect(perfecto.meanBoosts).toBeGreaterThan(0);
    // El perfecto lo guarda para el salto grande; el competente lo va gastando.
    expect(perfecto.meanBoosts).toBeLessThan(competente.meanBoosts);
  });

  it('el informe dice POR QUE se pierde, no solo que se pierde', () => {
    expect(descuidado.failures.length).toBeGreaterThan(0);
    for (const causa of descuidado.failures) {
      expect(causa.length).toBeGreaterThan(10);
      expect(causa).toMatch(/tras |al principio/);
    }
  });
});

describe('escenarios de laboratorio', () => {
  for (const { nombre, track: escena } of ESCENARIOS) {
    it(`${nombre}: el piloto perfecto lo pasa`, () => {
      const run = runBenchRace(escena, 'perfecto', 1, { mission: nombre, maxSeconds: 90 });
      expect(run.state, `${nombre}: ${run.failure}`).toBe('FINISHED');
    });

    it(`${nombre}: ningun numero se va a NaN o Infinity`, () => {
      const run = runBenchRace(escena, 'descuidado', 3, { mission: nombre, maxSeconds: 90 });
      for (const n of [run.timeSeconds, run.distance, run.maxFlow, run.finalFlow]) {
        expect(Number.isFinite(n), nombre).toBe(true);
      }
      for (const landing of run.landingDetail) {
        expect(Number.isFinite(landing.angleError), nombre).toBe(true);
        expect(Number.isFinite(landing.impactSpeed), nombre).toBe(true);
      }
    });
  }
});

describe('reinicio', () => {
  it('tras un choque se puede reintentar, y el banco lo cuenta', () => {
    const run = runBenchRace(track, 'descuidado', 1, { allowedRestarts: 2 });
    expect(run.restarts).toBe(2);
    // Y el reintento arranca de verdad desde la salida, no desde donde cayo.
    expect(run.timeSeconds).toBeLessThan(120);
  });
});
