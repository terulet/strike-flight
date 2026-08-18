/** Bot compartido por playtest.mjs y flows.mjs: juega leyendo debugInfo(). */
export const VIEW = { w: 393, h: 852 };

export const readState = (page) => page.evaluate(() => window.__PZ.state());
export const isOver = (page) => page.evaluate(() => !!document.querySelector('.result'));

export async function launchGame(page, gameId) {
  await page.evaluate((id) => window.__PZ.app.startDebugRun(id), gameId);
  await page.waitForSelector('.countdown', { state: 'detached', timeout: 10000 });
}

/**
 * El bot juega con una "calidad" 0..1. Sirve para montar duelos deterministas:
 * el mismo juego con la misma semilla da la misma puntuacion, asi que la unica
 * forma de que uno gane a otro es que juegue mejor.
 */
export async function playPulse(page, ms = 60000, quality = 1) {
  const t0 = Date.now();
  let tick = 0;
  while (!(await isOver(page)) && Date.now() - t0 < ms) {
    const state = await readState(page);
    if (!state) break;
    const good = (state.nodes ?? []).filter((n) => !n.mine).sort((a, b) => a.life - b.life);
    for (const node of good.slice(0, 2)) {
      // Fallar a proposito de forma reproducible (nada de Math.random).
      if (quality < 1 && tick % Math.max(2, Math.round(1 / (1 - quality))) === 0) {
        tick++;
        continue;
      }
      tick++;
      await page.mouse.click(node.x, node.y);
    }
    await page.waitForTimeout(45);
  }
}

export async function playSnap(page, ms = 60000, quality = 1) {
  const t0 = Date.now();
  let tick = 0;
  const offset = (1 - quality) * 0.85;
  while (!(await isOver(page)) && Date.now() - t0 < ms) {
    const state = await readState(page);
    if (!state?.target) break;
    // Apuntar peor = disparar desviado un porcentaje del radio de la diana.
    const dx = Math.cos(tick) * state.target.r * offset;
    const dy = Math.sin(tick) * state.target.r * offset;
    tick++;
    await page.mouse.click(state.target.x + dx, state.target.y + dy);
    await page.waitForTimeout(120);
  }
}

export async function playDrift(page, ms = 60000, quality = 1) {
  const t0 = Date.now();
  let tick = 0;
  await page.mouse.move(VIEW.w / 2, VIEW.h * 0.79);
  await page.mouse.down();
  while (!(await isOver(page)) && Date.now() - t0 < ms) {
    const state = await readState(page);
    if (!state?.player) break;
    // Con menos calidad, de vez en cuando "se despista" y no corrige.
    if (quality < 1 && tick++ % Math.max(2, Math.round(1 / (1 - quality))) === 0) {
      await page.waitForTimeout(28);
      continue;
    }
    const player = state.player;
    const wall = (state.walls ?? []).filter((w) => w.y < player.y + 20).sort((a, b) => b.y - a.y)[0];
    let targetX = wall ? wall.gapX + wall.gapW / 2 : player.x;
    for (const block of state.blocks ?? []) {
      if (Math.abs(block.y - player.y) < 140 && Math.abs(block.x - targetX) < block.size) {
        targetX += targetX < VIEW.w / 2 ? block.size * 1.6 : -block.size * 1.6;
      }
    }
    await page.mouse.move(Math.max(12, Math.min(VIEW.w - 12, targetX)), VIEW.h * 0.79);
    await page.waitForTimeout(28);
  }
  await page.mouse.up();
}

/** MEMORY: memoriza durante el destello y toca las casillas al apagarse. */
export async function playMemory(page, ms = 60000, quality = 1) {
  const t0 = Date.now();
  let remembered = [];
  let round = -1;
  let tick = 0;
  while (!(await isOver(page)) && Date.now() - t0 < ms) {
    const state = await readState(page);
    if (!state?.cells) break;
    if (state.round !== round) {
      round = state.round;
      remembered = [];
    }
    if (state.phase === 'flash') {
      remembered = state.pattern.slice();
    } else if (state.phase === 'input' && remembered.length > 0) {
      const found = new Set(state.found);
      for (const index of remembered) {
        if (found.has(index)) continue;
        // Con menos calidad, de vez en cuando "se le olvida" una casilla.
        if (quality < 1 && tick++ % Math.max(2, Math.round(1 / (1 - quality))) === 0) continue;
        const cell = state.cells[index];
        if (cell) await page.mouse.click(cell.x, cell.y);
      }
    }
    await page.waitForTimeout(40);
  }
}

export const BOTS = { pulse: playPulse, drift: playDrift, snap: playSnap, memory: playMemory };

/**
 * Juega el reto que este en marcha, sea cual sea el juego.
 *
 * Espera a saber que juego es antes de elegir estrategia: si se lee demasiado
 * pronto, el estado aun no existe y el bot acabaria jugando a otra cosa (y
 * sacando cero, que fue justo lo que paso una vez).
 */
export async function playCurrent(page, ms, quality = 1) {
  let state = null;
  for (let i = 0; i < 30 && !state?.game; i++) {
    state = await readState(page);
    if (!state?.game) await page.waitForTimeout(100);
  }
  const bot = BOTS[state?.game] ?? playPulse;
  await bot(page, ms, quality);
}
