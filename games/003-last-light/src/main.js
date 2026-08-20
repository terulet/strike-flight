/**
 * Arranque. Bucle de fotograma, redimensionado y desbloqueo del audio.
 *
 * iOS no deja sonar nada hasta que el usuario toca algo, así que el audio se
 * inicializa en el primer gesto y no antes. Es la razón de `unlock()`.
 */

import { Game } from './core/Game.js';

const canvas = document.getElementById('game');
const game = new Game(canvas);
game.resize();

// El contexto de audio necesita un gesto del usuario. Cualquiera sirve.
const unlock = () => game.audio.unlock();
for (const ev of ['pointerdown', 'touchstart', 'keydown', 'mousedown']) {
  window.addEventListener(ev, unlock, { once: false, passive: true });
}

let last = performance.now();
let errors = 0;

function loop(now) {
  const dt = (now - last) / 1000;
  last = now;
  try {
    game.frame(dt);
  } catch (err) {
    // Una excepción dentro del fotograma NO debe matar el bucle: si esto
    // pasa en el iPhone de alguien probando, la partida se queda congelada
    // y no hay consola donde mirar. Se registra y se sigue.
    if (++errors <= 5) console.error('[LAST LIGHT] fallo en el fotograma:', err);
    if (errors === 6) console.error('[LAST LIGHT] demasiados fallos, dejo de avisar');
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// La rotación de un móvil informa del tamaño nuevo con retraso: se vuelve a
// medir un instante después o el lienzo se queda con la orientación vieja.
const onResize = () => { game.resize(); setTimeout(() => game.resize(), 120); };
window.addEventListener('resize', onResize);
window.addEventListener('orientationchange', onResize);

// Volver de segundo plano con un dt gigante teletransportaría a todo el mundo.
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) last = performance.now();
});

// Consola: para trastear sin abrir el panel.
window.LAST_LIGHT = game;
