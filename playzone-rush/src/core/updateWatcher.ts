/**
 * Deteccion de version nueva.
 *
 * Dos senales independientes, porque ninguna es fiable del todo sola:
 *  - controllerchange: dispara cuando un service worker nuevo toma el
 *    control. Rapido, pero Safari/iOS a veces tarda en comprobar si hay
 *    actualizacion del SW (sobre todo con la app en background).
 *  - sondeo de /api/health: compara el build de este proceso (__BUILD_ID__,
 *    fijado en tiempo de compilacion) contra el que dice el servidor ahora
 *    mismo. Red de seguridad si el SW no ha avisado.
 *
 * No decide nada por su cuenta: solo avisa una vez. Quien llama decide
 * cuando es buen momento para ensenar el aviso (nunca a mitad de partida).
 *
 * Todo con guardas de `typeof x !== 'undefined'`: en Node (tests, SSR
 * hipotetico) no existe `document`, asi que referenciarlo sin comprobar
 * primero revienta con ReferenceError aunque solo sea para un `?.`.
 */
const POLL_MS = 4 * 60_000;
const HEALTH_TIMEOUT_MS = 4000;

async function currentServerBuildId(): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
  try {
    const response = await fetch('/api/health', { cache: 'no-store', signal: controller.signal });
    if (!response.ok) return null;
    const data = (await response.json()) as { buildId?: string };
    return typeof data.buildId === 'string' ? data.buildId : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function pageHidden(): boolean {
  return typeof document !== 'undefined' && document.hidden === true;
}

/** setInterval/setTimeout de Node se pueden desenganchar; los del navegador no, y no hace falta. */
function unref(handle: unknown): void {
  const withUnref = handle as { unref?: () => void };
  withUnref?.unref?.();
}

/**
 * Empieza a vigilar. Llama a `onAvailable` como mucho una vez (aunque
 * salten las dos senales). No hace falta pararlo: vive con la pagina.
 */
export function watchForUpdate(onAvailable: () => void): void {
  let fired = false;
  const trigger = (): void => {
    if (fired) return;
    fired = true;
    onAvailable();
  };

  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    // En la PRIMERA visita no hay controlador todavia: el service worker se
    // instala y toma el control, y eso dispara un controllerchange que no es
    // una actualizacion de nada. Sin esta comprobacion, a todo el que entra
    // por primera vez le saldria "hay una version nueva" al instante.
    const hadController = navigator.serviceWorker.controller !== null;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadController) trigger();
    });
  }

  const checkHealth = async (): Promise<void> => {
    if (fired || pageHidden()) return;
    const serverBuild = await currentServerBuildId();
    if (serverBuild && serverBuild !== __BUILD_ID__) trigger();
  };

  unref(setInterval(() => void checkHealth(), POLL_MS));
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (!pageHidden()) void checkHealth();
    });
  }
  // Una comprobacion temprana, pero no instantanea: que de tiempo a que el
  // primer fetch de /api/health no compita con el arranque de la app.
  unref(setTimeout(() => void checkHealth(), 15_000));
}
