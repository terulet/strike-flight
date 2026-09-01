import { describe, expect, it } from 'vitest';
import { ComboMeter } from '../src/gameplay/ComboMeter';
import { ComboConfig, SIM_DT } from '../src/config/GameConfig';

describe('cadena de acrobacias', () => {
  it('el multiplicador sube por escalones y se queda en el ultimo', () => {
    const combo = new ComboMeter();
    expect(combo.multiplier).toBe(1);
    const seen: number[] = [];
    for (let i = 0; i < 10; i++) seen.push(combo.add());
    // Los escalones configurados, y de ahi en adelante el ultimo: crecer sin
    // techo hace que la puntuacion deje de significar nada.
    expect(seen.slice(0, ComboConfig.steps.length)).toEqual([...ComboConfig.steps]);
    expect(seen[seen.length - 1]).toBe(ComboConfig.steps[ComboConfig.steps.length - 1]);
  });

  it('se cierra sola al agotarse la ventana, y avisa una unica vez', () => {
    const combo = new ComboMeter();
    combo.add();
    combo.add();
    expect(combo.links).toBe(2);

    let closes = 0;
    for (let t = 0; t < ComboConfig.windowSeconds + 1; t += SIM_DT) {
      if (combo.tick(SIM_DT)) closes += 1;
    }
    expect(closes).toBe(1);
    expect(combo.links).toBe(0);
    expect(combo.multiplier).toBe(1);
  });

  it('cada eslabon reinicia la ventana', () => {
    const combo = new ComboMeter();
    combo.add();
    for (let t = 0; t < ComboConfig.windowSeconds * 0.8; t += SIM_DT) combo.tick(SIM_DT);
    expect(combo.links).toBe(1);
    combo.add();
    // Justo despues del segundo eslabon la ventana esta llena otra vez, asi
    // que lo que quedaba del primero ya no cuenta.
    expect(combo.remainingFraction).toBeCloseTo(1, 5);
    for (let t = 0; t < ComboConfig.windowSeconds * 0.8; t += SIM_DT) combo.tick(SIM_DT);
    expect(combo.links).toBe(2);
  });

  it('un choque la rompe entera pero no borra el record de la carrera', () => {
    const combo = new ComboMeter();
    combo.add();
    combo.add();
    combo.add();
    expect(combo.bestLinks).toBe(3);
    combo.break();
    expect(combo.links).toBe(0);
    expect(combo.isActive).toBe(false);
    expect(combo.bestLinks).toBe(3);
  });
});
