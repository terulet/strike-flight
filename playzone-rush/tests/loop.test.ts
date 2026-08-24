/**
 * Ticker: el reloj de fotogramas.
 *
 * El caso que importa aqui no es de mentira: paso jugando de verdad. rAF
 * puede entregar, en el PRIMER fotograma tras start(), un timestamp anterior
 * al performance.now() que start() acababa de leer -es como el navegador
 * marca el instante en que empezo a preparar ese fotograma, no cuando corrio
 * nuestro JS-. Sin suelo en el calculo, ese primer dt sale negativo.
 *
 * Un dt negativo no rompe nada por si solo: los contadores lo absorben sin
 * que se note. Pero cualquiera que acumule con `%` (backdropRadial, ver
 * game/draw.ts) puede acabar pidiendo `ctx.arc()` con un radio negativo, que
 * no es un dibujo raro: es una excepcion sin capturar, y esa excepcion para
 * el bucle de fotogramas entero porque corta el `onTick` antes de que llegue
 * a pedir el siguiente frame. Se vio en flows.mjs, jugando de verdad: PULSE y
 * CUENTA lo tiraban en cualquier partida normal, sin tocar nada raro.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Ticker } from '../src/core/loop';

describe('Ticker', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('nunca entrega un dt negativo, ni en el primer fotograma', () => {
    const dts: number[] = [];
    const ticker = new Ticker((dt) => dts.push(dt));

    vi.spyOn(performance, 'now').mockReturnValue(1000);
    let callback: ((now: number) => void) | null = null;
    const raf = vi.fn((cb: (now: number) => void) => {
      callback = cb;
      return 1;
    });
    const caf = vi.fn();
    vi.stubGlobal('requestAnimationFrame', raf);
    vi.stubGlobal('cancelAnimationFrame', caf);

    ticker.start(); // lee performance.now() = 1000 como referencia

    // El primer fotograma real de rAF, con un timestamp ANTERIOR al de arriba.
    expect(callback).not.toBeNull();
    callback!(999.4);

    expect(dts).toHaveLength(1);
    expect(dts[0]).toBeGreaterThanOrEqual(0);

    ticker.stop();
    vi.unstubAllGlobals();
  });

  it('en marcha normal, dt es la diferencia real en segundos', () => {
    const dts: number[] = [];
    const ticker = new Ticker((dt) => dts.push(dt));

    let momento = 2000;
    vi.spyOn(performance, 'now').mockImplementation(() => momento);
    let callback: ((now: number) => void) | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: (now: number) => void) => {
      callback = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    ticker.start();
    momento = 2016; // ~un fotograma a 60 Hz
    callback!(2016);

    expect(dts[0]).toBeCloseTo(0.016, 5);

    ticker.stop();
    vi.unstubAllGlobals();
  });
});
