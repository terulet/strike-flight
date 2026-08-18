/**
 * Entry point. Boots the game and hands the fixed-timestep loop its two
 * callbacks. Nothing else lives here on purpose.
 */
import { GameLoop } from './core/loop.js';
import { Game } from './game/game.js';

const canvas = document.getElementById('game');
const probe = document.getElementById('safe-probe');

const game = new Game({ canvas, probe });
game.boot();

const loop = new GameLoop({
  update: (dt) => game.update(dt),
  render: (frameDt) => game.render(frameDt, loop.fps),
});
loop.start();

// Pause the simulation when the tab is hidden: no runaway accumulator, no
// battery burn, and no "I came back and I was dead".
document.addEventListener('visibilitychange', () => {
  if (document.hidden) loop.stop();
  else loop.start();
});

// Exposed for the debug tools and for poking around from a console.
window.OMF = { game, loop };
