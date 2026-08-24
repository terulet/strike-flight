/**
 * backdropRadial: el fondo de anillos que usan PULSE, CUENTA y otros.
 *
 * Ver tests/loop.test.ts para el porque: un dt negativo en el primer
 * fotograma (real, no hipotetico) puede llegar aqui como una `fase` negativa,
 * y sin el suelo `Math.max(0, ...)` eso pide a ctx.arc() un radio negativo,
 * que lanza IndexSizeError y para el juego en seco. Este test cubre la
 * funcion en si, aparte del origen del dt (ya cubierto en loop.test.ts):
 * cualquier otra via que llegue a pasar una fase negativa queda cubierta
 * igual.
 */
import { describe, expect, it } from 'vitest';
import { backdropRadial } from '../src/game/draw';

/** Un ctx que solo recuerda los radios con los que se le ha llamado a arc(). */
function ctxQueRegistraRadios(): { ctx: CanvasRenderingContext2D; radios: number[] } {
  const radios: number[] = [];
  const ctx = new Proxy(
    {},
    {
      get: (_target, prop) => {
        if (prop === 'arc') return (_cx: number, _cy: number, r: number) => radios.push(r);
        return () => undefined;
      },
      set: () => true,
    },
  ) as unknown as CanvasRenderingContext2D;
  return { ctx, radios };
}

describe('backdropRadial', () => {
  it('con fase negativa, nunca pide un arco de radio negativo', () => {
    const { ctx, radios } = ctxQueRegistraRadios();
    backdropRadial(ctx, 393, 700, '#22d3ee', -0.02);
    expect(radios.length).toBeGreaterThan(0);
    for (const r of radios) expect(r).toBeGreaterThanOrEqual(0);
  });

  it('con fase 0 (el caso normal), tampoco', () => {
    const { ctx, radios } = ctxQueRegistraRadios();
    backdropRadial(ctx, 393, 700, '#22d3ee', 0);
    for (const r of radios) expect(r).toBeGreaterThanOrEqual(0);
  });
});
