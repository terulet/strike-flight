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
import './styles/debug.css';

import { registerAllGames } from './games/index';
import { App } from './ui/app';

registerAllGames();

const root = document.getElementById('app');
if (!root) throw new Error('Falta #app en el documento');

const app = new App(root);
app.boot();

// Enganche para herramientas de desarrollo y pruebas automatizadas. Solo en
// modo dev: en la build de produccion esta rama desaparece.
if (import.meta.env.DEV) {
  (globalThis as unknown as Record<string, unknown>).__PZ = {
    app,
    game: () => app.playScreen?.game ?? null,
    state: () => app.playScreen?.game?.debugInfo?.() ?? null,
  };
}

// Herramientas de desarrollo bajo demanda.
let debugLoaded = false;
async function enableDebug(): Promise<void> {
  if (debugLoaded) return;
  debugLoaded = true;
  const { mountDebug } = await import('./ui/debug');
  mountDebug(app);
  app.renderHome();
}

const params = new URLSearchParams(location.search);
if (params.has('debug')) void enableDebug();

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

// Un aviso claro si algo revienta en produccion.
globalThis.addEventListener('error', (ev) => {
  console.error('[playzone] error no controlado', ev.error ?? ev.message);
});
