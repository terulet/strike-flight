/**
 * Deteccion de version nueva: dos senales (controllerchange y sondeo de
 * /api/health contra __BUILD_ID__), como mucho un aviso.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { watchForUpdate } from '../src/core/updateWatcher';

const REAL_FETCH = globalThis.fetch;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  globalThis.fetch = REAL_FETCH;
});

function stubHealth(buildId: string | null, ok = true): void {
  globalThis.fetch = vi.fn(async () =>
    ok
      ? new Response(JSON.stringify({ buildId }), { status: 200 })
      : new Response('', { status: 500 }),
  ) as unknown as typeof fetch;
}

describe('watchForUpdate', () => {
  it('no avisa si el build del servidor coincide con el actual', async () => {
    stubHealth(__BUILD_ID__);
    const onAvailable = vi.fn();
    watchForUpdate(onAvailable);

    await vi.advanceTimersByTimeAsync(15_000);
    expect(onAvailable).not.toHaveBeenCalled();
  });

  it('avisa cuando el servidor dice un build distinto', async () => {
    stubHealth('otro-build-999');
    const onAvailable = vi.fn();
    watchForUpdate(onAvailable);

    await vi.advanceTimersByTimeAsync(15_000);
    expect(onAvailable).toHaveBeenCalledTimes(1);
  });

  it('no avisa mientras la pagina esta oculta', async () => {
    vi.stubGlobal('document', { hidden: true, addEventListener: vi.fn() });
    stubHealth('otro-build-999');
    const onAvailable = vi.fn();
    watchForUpdate(onAvailable);

    await vi.advanceTimersByTimeAsync(POLL_ROUND_TRIP);
    expect(onAvailable).not.toHaveBeenCalled();
  });

  it('sigue sondeando y avisa en la siguiente ronda si el primer intento fallo', async () => {
    let calls = 0;
    globalThis.fetch = vi.fn(async () => {
      calls++;
      if (calls === 1) throw new Error('sin red');
      return new Response(JSON.stringify({ buildId: 'otro-build-999' }), { status: 200 });
    }) as unknown as typeof fetch;
    const onAvailable = vi.fn();
    watchForUpdate(onAvailable);

    await vi.advanceTimersByTimeAsync(15_000);
    expect(onAvailable).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(POLL_ROUND_TRIP);
    expect(onAvailable).toHaveBeenCalledTimes(1);
  });

  it('avisa como mucho una vez aunque salten las dos senales', async () => {
    const listeners = stubServiceWorker({ controller: {} });
    stubHealth('otro-build-999');
    const onAvailable = vi.fn();
    watchForUpdate(onAvailable);

    // Las dos senales llegan: primero el service worker, luego el sondeo.
    for (const fn of listeners.controllerchange ?? []) fn();
    await vi.advanceTimersByTimeAsync(15_000);

    expect(onAvailable).toHaveBeenCalledTimes(1);
  });

  it('el service worker tomando el control por primera vez NO es una version nueva', async () => {
    // Primera visita: no habia controlador. El SW se instala y reclama la
    // pagina, y eso dispara controllerchange sin que haya nada que actualizar.
    const listeners = stubServiceWorker({ controller: null });
    stubHealth(__BUILD_ID__);
    const onAvailable = vi.fn();
    watchForUpdate(onAvailable);

    for (const fn of listeners.controllerchange ?? []) fn();
    await vi.advanceTimersByTimeAsync(15_000);

    expect(onAvailable).not.toHaveBeenCalled();
  });

  it('pero con un controlador ya puesto, controllerchange si es una version nueva', async () => {
    const listeners = stubServiceWorker({ controller: {} });
    stubHealth(__BUILD_ID__); // el sondeo no detecta nada: avisa el SW
    const onAvailable = vi.fn();
    watchForUpdate(onAvailable);

    for (const fn of listeners.controllerchange ?? []) fn();
    expect(onAvailable).toHaveBeenCalledTimes(1);
  });
});

function stubServiceWorker({ controller }: { controller: object | null }): Record<string, (() => void)[]> {
  const listeners: Record<string, (() => void)[]> = {};
  vi.stubGlobal('navigator', {
    serviceWorker: {
      controller,
      addEventListener: (type: string, fn: () => void) => {
        (listeners[type] ??= []).push(fn);
      },
    },
  });
  return listeners;
}

/** Un ciclo de sondeo completo: el primer chequeo (15s) + un intervalo entero. */
const POLL_ROUND_TRIP = 15_000 + 4 * 60_000;
