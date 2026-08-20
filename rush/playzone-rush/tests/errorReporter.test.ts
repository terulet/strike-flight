/**
 * Registro de errores del cliente: captura window.onerror/unhandledrejection,
 * manda por sendBeacon o fetch, y no se dispara sin limite.
 *
 * globalThis.addEventListener no existe en Node (solo en el navegador), asi
 * que se sustituye por un doble que captura los handlers registrados y deja
 * invocarlos a mano, como si fuera el navegador disparando el evento.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __resetReportCountForTests, installErrorReporter } from '../src/core/errorReporter';

const REAL_FETCH = globalThis.fetch;

function stubListeners(): Record<string, ((event: unknown) => void)[]> {
  const handlers: Record<string, ((event: unknown) => void)[]> = {};
  vi.stubGlobal('addEventListener', (type: string, fn: (event: unknown) => void) => {
    (handlers[type] ??= []).push(fn);
  });
  return handlers;
}

async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
  __resetReportCountForTests();
});

afterEach(() => {
  vi.unstubAllGlobals();
  globalThis.fetch = REAL_FETCH;
});

describe('installErrorReporter', () => {
  it('manda un error de window.onerror por fetch cuando no hay sendBeacon', async () => {
    const handlers = stubListeners();
    vi.stubGlobal('navigator', { userAgent: 'agente-test' });
    // Objeto-caja en vez de "let" sueltas: TS narrowa mal una union asignada
    // dentro de un closure y la deja en `never` al leerla despues (bug
    // conocido de control-flow analysis, no de esta logica).
    const captured: { url: string | null; init: { keepalive?: boolean; body?: unknown } | null } = {
      url: null,
      init: null,
    };
    globalThis.fetch = vi.fn((url: string, init: unknown) => {
      captured.url = String(url);
      captured.init = init as { keepalive?: boolean; body?: unknown };
      return Promise.resolve(new Response('{"ok":true}', { status: 202 }));
    }) as unknown as typeof fetch;

    installErrorReporter(() => null);
    expect(handlers.error).toHaveLength(1);
    handlers.error?.[0]?.({ error: new Error('boom'), message: 'boom' });
    await flush();

    expect(captured.url).toBe('/api/errors');
    expect(captured.init?.keepalive).toBe(true);
    const body = JSON.parse(String(captured.init?.body));
    expect(body.message).toBe('boom');
    expect(body.meta.ua).toBe('agente-test');
    expect(body.meta.build).toBe(__BUILD_ID__);
  });

  it('captura unhandledrejection incluso con un motivo que no es Error', async () => {
    const handlers = stubListeners();
    vi.stubGlobal('navigator', { userAgent: 'ua' });
    const captured: { init: { body?: unknown } | null } = { init: null };
    globalThis.fetch = vi.fn((_url: string, init: unknown) => {
      captured.init = init as { body?: unknown };
      return Promise.resolve(new Response('{}', { status: 202 }));
    }) as unknown as typeof fetch;

    installErrorReporter(() => null);
    handlers.unhandledrejection?.[0]?.({ reason: 'algo raro' });
    await flush();

    const body = JSON.parse(String(captured.init?.body));
    expect(body.message).toContain('algo raro');
  });

  it('usa sendBeacon con el token de sesion en la URL cuando lo hay', () => {
    const handlers = stubListeners();
    const beacon = vi.fn((_url: string, _data: Blob) => true);
    vi.stubGlobal('navigator', { userAgent: 'ua', sendBeacon: beacon });

    installErrorReporter(() => 'player123.secretXYZ');
    handlers.error?.[0]?.({ error: new Error('boom'), message: 'boom' });

    expect(beacon).toHaveBeenCalledTimes(1);
    const [url, blob] = beacon.mock.calls[0] ?? [];
    expect(url).toBe('/api/errors?token=player123.secretXYZ');
    expect(blob).toBeInstanceOf(Blob);
  });

  it('sin sesion no manda token en la URL', () => {
    const handlers = stubListeners();
    const beacon = vi.fn((_url: string, _data: Blob) => true);
    vi.stubGlobal('navigator', { userAgent: 'ua', sendBeacon: beacon });

    installErrorReporter(() => null);
    handlers.error?.[0]?.({ error: new Error('boom'), message: 'boom' });

    expect(beacon.mock.calls[0]?.[0]).toBe('/api/errors');
  });

  it('deja de mandar tras el limite de envios por carga de pagina', async () => {
    const handlers = stubListeners();
    vi.stubGlobal('navigator', { userAgent: 'ua' });
    const fetchSpy = vi.fn(async () => new Response('{}', { status: 202 }));
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    installErrorReporter(() => null);
    for (let i = 0; i < 25; i++) {
      handlers.error?.[0]?.({ error: new Error(`e${i}`), message: `e${i}` });
    }
    await flush();

    expect(fetchSpy).toHaveBeenCalledTimes(20);
  });
});
