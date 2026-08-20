/**
 * Registro de errores del cliente: window.onerror + unhandledrejection.
 *
 * Funciona sin sesion (el onboarding tambien puede fallar antes de que haya
 * grupo) y nunca bloquea nada si el envio falla: es best-effort puro, igual
 * que el resto de telemetria. Limite duro de envios por carga de pagina, para
 * que un bucle que revienta sin parar no se convierta en una tormenta de
 * peticiones contra el servidor.
 */
const MAX_REPORTS_PER_LOAD = 20;
const MAX_MESSAGE = 500;
const MAX_STACK = 4000;

let sent = 0;

interface ErrorPayload {
  message: string;
  stack?: string | null;
  url?: string | null;
  meta?: Record<string, unknown> | null;
}

function context(): Record<string, unknown> {
  return {
    build: __BUILD_ID__,
    ua: typeof navigator !== 'undefined' ? navigator.userAgent : null,
  };
}

function report(getToken: () => string | null, payload: ErrorPayload): void {
  if (sent >= MAX_REPORTS_PER_LOAD) return;
  sent++;

  const body = JSON.stringify({
    message: payload.message.slice(0, MAX_MESSAGE),
    stack: payload.stack ? payload.stack.slice(0, MAX_STACK) : null,
    url: payload.url ?? null,
    meta: payload.meta ?? null,
  });
  const token = getToken();
  // El token va en la URL (y no en cabeceras) porque sendBeacon no admite
  // cabeceras propias; el servidor ya sabe leerlo de ahi como alternativa.
  const path = token ? `/api/errors?token=${encodeURIComponent(token)}` : '/api/errors';

  // sendBeacon sobrevive a que la pestana se cierre justo tras el error (el
  // caso mas comun: algo revienta y el usuario, molesto, cierra la app).
  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    try {
      if (navigator.sendBeacon(path, new Blob([body], { type: 'application/json' }))) return;
    } catch {
      /* seguimos con fetch */
    }
  }
  if (typeof fetch !== 'function') return;
  void fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => undefined);
}

/**
 * Se instala una vez, al arrancar. `getToken` se llama en cada error (no al
 * instalar) para que un fallo despues de crear/unirse a un grupo ya salga
 * atribuido, aunque al arrancar la pagina no hubiera sesion todavia.
 */
export function installErrorReporter(getToken: () => string | null): void {
  if (typeof globalThis.addEventListener !== 'function') return;

  globalThis.addEventListener('error', (event) => {
    const ev = event as ErrorEvent;
    const err = ev.error;
    report(getToken, {
      message: err instanceof Error ? err.message : String(ev.message || 'error sin mensaje'),
      stack: err instanceof Error ? (err.stack ?? null) : null,
      url: typeof location !== 'undefined' ? location.href : null,
      meta: context(),
    });
  });

  globalThis.addEventListener('unhandledrejection', (event) => {
    const reason = (event as PromiseRejectionEvent).reason;
    report(getToken, {
      message: reason instanceof Error ? reason.message : `promesa rechazada: ${String(reason)}`,
      stack: reason instanceof Error ? (reason.stack ?? null) : null,
      url: typeof location !== 'undefined' ? location.href : null,
      meta: context(),
    });
  });
}

/** Solo para tests: el contador de envios vive a nivel de modulo. */
export function __resetReportCountForTests(): void {
  sent = 0;
}
