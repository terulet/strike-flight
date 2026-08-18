/**
 * PLAYZONE RUSH · arranque.
 *
 * Orden: registrar juegos -> crear app -> pintar. El panel de debug solo se
 * descarga si se pide (?debug o tres toques en el logo).
 */
import './styles/tokens.css';
import './styles/base.css';
import './styles/shell.css';
import './styles/home.css';
import './styles/play.css';
import './styles/result.css';
import './styles/social.css';
import './styles/debug.css';
import './styles/dashboard.css';

import { registerAllGames } from './games/index';
import { App } from './ui/app';
import { installErrorReporter } from './core/errorReporter';

registerAllGames();

const root = document.getElementById('app');
if (!root) throw new Error('Falta #app en el documento');

const app = new App(root);
app.boot();

/**
 * Enganche para herramientas de desarrollo y pruebas automatizadas.
 * En desarrollo siempre; en una build de produccion solo si se pide debug
 * explicitamente (?debug), igual que el panel. Nadie lo tiene activo sin
 * querer, pero se puede auditar la build real.
 */
function exposeDevHook(): void {
  (globalThis as unknown as Record<string, unknown>).__PZ = {
    app,
    game: () => app.playScreen?.game ?? null,
    state: () => app.playScreen?.game?.debugInfo?.() ?? null,
  };
}

if (import.meta.env.DEV) exposeDevHook();

// Herramientas de desarrollo bajo demanda.
let debugLoaded = false;
async function enableDebug(): Promise<void> {
  if (debugLoaded) return;
  debugLoaded = true;
  const { mountDebug } = await import('./ui/debug');
  exposeDevHook();
  mountDebug(app);
  if (app.mode !== 'none') app.renderHome();
}

const params = new URLSearchParams(location.search);
if (params.has('debug')) void enableDebug();

// ?dashboard: metricas agregadas de la semana, solo lectura. Es una pantalla
// aparte del juego (y del panel de debug, que si puede tocar cosas): sustituye
// la interfaz entera para que no haya forma de jugar sin querer desde aqui.
if (params.has('dashboard')) {
  void (async () => {
    const { mountDashboard } = await import('./ui/dashboard');
    await mountDashboard(root, app.sync.client.token);
  })();
}

// Atajo para el movil: tres toques rapidos en el logo.
let taps: number[] = [];
document.addEventListener('pointerdown', (ev) => {
  const target = ev.target as HTMLElement | null;
  if (!target?.closest('.brand')) return;
  const now = performance.now();
  taps = taps.filter((t) => now - t < 1200);
  taps.push(now);
  if (taps.length >= 3) {
    taps = [];
    void enableDebug();
  }
});

// Teclado de escritorio: D abre/cierra el panel.
globalThis.addEventListener('keydown', (ev) => {
  if (ev.code === 'KeyD' && ev.shiftKey) void enableDebug();
});

// Evitar el zoom por doble toque en iOS sin romper el scroll normal.
let lastTouchEnd = 0;
document.addEventListener(
  'touchend',
  (ev) => {
    const now = Date.now();
    if (now - lastTouchEnd < 320) ev.preventDefault();
    lastTouchEnd = now;
  },
  { passive: false },
);

// Service worker solo en la build de produccion: en desarrollo estorba mas
// que ayuda (cachea codigo viejo). Sirve para que la app abra sin cobertura.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  globalThis.addEventListener('load', () => {
    void navigator.serviceWorker
      .register('./sw.js')
      .then(async (registration) => {
        await navigator.serviceWorker.ready;
        const worker = registration.active ?? navigator.serviceWorker.controller;
        if (!worker) return;
        // Le decimos exactamente que ha cargado esta pagina para que lo guarde:
        // en la primera visita esos ficheros no pasan por el service worker.
        const send = () => {
          const urls = performance
            .getEntriesByType('resource')
            .map((entry) => entry.name)
            .filter((url) => url.startsWith(location.origin) && !url.includes('/api/'));
          worker.postMessage({ type: 'precache', urls: [location.origin + location.pathname, ...urls] });
        };
        send();
        // Y otra vez algo mas tarde, por los trozos que se cargan bajo demanda.
        setTimeout(send, 4000);
      })
      .catch(() => {
        /* si el navegador lo rechaza, la app funciona igual con conexion */
      });
  });
}

// Un aviso claro si algo revienta en produccion.
globalThis.addEventListener('error', (ev) => {
  console.error('[playzone] error no controlado', ev.error ?? ev.message);
});

// Solo en produccion: en desarrollo los errores son ruido de iterar, no
// incidentes reales, y no tiene sentido mandarlos al panel de operacion.
if (import.meta.env.PROD) installErrorReporter(() => app.sync.client.token);
