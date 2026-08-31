import { describe, expect, it } from 'vitest';
import { GameLoop } from '../src/core/GameLoop';
import { MAX_CATCHUP_STEPS, SIM_DT } from '../src/config/GameConfig';

describe('GameLoop', () => {
  it('produces the same accumulated simulation time regardless of how frame durations are chunked', () => {
    function runWithFramePattern(framesMs: number[]): { steps: number; simTime: number } {
      let steps = 0;
      let simTime = 0;
      const loop = new GameLoop({
        step: (dt) => {
          steps += 1;
          simTime += dt;
        },
        render: () => {},
      });
      for (const frame of framesMs) loop.advance(frame);
      return { steps, simTime };
    }

    const dtMs = SIM_DT * 1000;
    // Patron A: frames regulares de 16.67ms (60fps) durante 1 segundo.
    const patternA = Array.from({ length: 60 }, () => 1000 / 60);
    // Patron B: mismos ~1000ms totales pero repartidos de forma irregular
    // (simula un framerate variable tipo 20fps/100fps intercalado), siempre
    // por debajo del tope de recuperacion para que ambos patrones deban
    // producir el mismo numero de pasos fijos de simulacion.
    const patternB = Array.from({ length: 25 }, () => [10, 30]).flat();

    const resultA = runWithFramePattern(patternA);
    const resultB = runWithFramePattern(patternB);

    // Ambos patrones deben producir practicamente el mismo numero de pasos
    // fijos de simulacion (misma cantidad de "tiempo de juego" avanzado),
    // independientemente de como se trocearan los frames de render.
    expect(Math.abs(resultA.steps - resultB.steps)).toBeLessThanOrEqual(1);
    expect(Math.abs(resultA.simTime - resultB.simTime)).toBeLessThan(dtMs / 1000 + 1e-6);
  });

  it('never runs more than MAX_CATCHUP_STEPS steps in a single advance() call (spiral-of-death guard)', () => {
    let steps = 0;
    const loop = new GameLoop({
      step: () => {
        steps += 1;
      },
      render: () => {},
    });
    // Simula que la pestana estuvo en segundo plano 30 segundos.
    loop.advance(30000);
    expect(steps).toBeLessThanOrEqual(MAX_CATCHUP_STEPS);
  });
});
