import { describe, expect, it } from 'vitest';
import { Lens, TEAR_OFFS } from '../src/render/lens';

describe('barro en las gafas', () => {
  it('el barro se acumula y un tear-off lo limpia; hay pocos por carrera', () => {
    const lens = new Lens('#6b4a2e');
    expect(lens.tearOff()).toBe(false); // limpia: no gasta lamina
    lens.hit(6);
    expect(lens.splats.length).toBe(6);
    expect(lens.coverage).toBeGreaterThan(0);
    expect(lens.tearOff()).toBe(true);
    expect(lens.splats.length).toBe(0);
    expect(lens.left).toBe(TEAR_OFFS - 1);
    // Mientras la lamina sale volando no se puede arrancar otra.
    lens.hit(2);
    expect(lens.tearOff()).toBe(false);
    lens.update(0.6);
    for (let i = 0; i < TEAR_OFFS; i++) {
      lens.hit(2);
      lens.tearOff();
      lens.update(0.6);
    }
    expect(lens.left).toBe(0);
    lens.hit(3);
    expect(lens.tearOff()).toBe(false);
    expect(lens.splats.length).toBeGreaterThan(0);
  });

  it('no crece sin limite', () => {
    const lens = new Lens('#6b4a2e');
    lens.hit(200);
    expect(lens.splats.length).toBeLessThanOrEqual(47);
  });
});
