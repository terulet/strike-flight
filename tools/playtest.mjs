/**
 * Bot de playtest: juega de verdad a cada minijuego leyendo su debugInfo() y
 * devuelve la puntuacion. Sirve para dos cosas: comprobar que cada juego es
 * jugable de principio a fin y calibrar el rango de marcas de los rivales.
 *
 *   node tools/playtest.mjs [pulse|drift|snap] [repeticiones]
 */
import { chromium } from 'playwright';
import { playMemory } from './bot.mjs';

const BASE = process.env.BASE ?? 'http://localhost:5173';
const only = process.argv[2];
const runs = Number.parseInt(process.argv[3] ?? '2', 10);

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROME ?? '/opt/pw-browsers/chromium',
  args: ['--no-sandbox', '--use-gl=swiftshader'],
});
const context = await browser.newContext({
  viewport: { width: 393, height: 852 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();
page.on('pageerror', (e) => console.log('  PAGEERROR', e.message));

await page.goto(`${BASE}/?debug`, { waitUntil: 'networkidle' });

/** Estas pruebas son del modo en solitario: si sale el onboarding, lo elegimos. */
async function enterSolo(page) {
  if ((await page.locator('.onboarding').count()) > 0) {
    await page.getByText('PROBAR SOLO').click();
    await page.waitForSelector('.card', { timeout: 10000 });
  }
}

await enterSolo(page);
await page.waitForSelector('.card');

async function launch(gameId) {
  await page.evaluate((id) => window.__PZ.app.startDebugRun(id), gameId);
  await page.waitForSelector('.countdown', { state: 'detached', timeout: 8000 });
}

async function readState() {
  return page.evaluate(() => window.__PZ.state());
}

async function isOver() {
  return page.evaluate(() => !!document.querySelector('.result'));
}

async function playPulse() {
  while (!(await isOver())) {
    const state = await readState();
    if (!state) break;
    const good = (state.nodes ?? []).filter((n) => !n.mine).sort((a, b) => a.life - b.life);
    for (const node of good.slice(0, 2)) await page.mouse.click(node.x, node.y);
    await page.waitForTimeout(45);
  }
}

async function playSnap() {
  while (!(await isOver())) {
    const state = await readState();
    if (!state?.target) break;
    // Adelantarse un pelin al movimiento para simular a un humano decente.
    await page.mouse.click(state.target.x, state.target.y);
    await page.waitForTimeout(90);
  }
}

async function playDrift() {
  const box = { w: 393, h: 852 };
  await page.mouse.move(box.w / 2, box.h * 0.79);
  await page.mouse.down();
  while (!(await isOver())) {
    const state = await readState();
    if (!state?.player) break;
    const player = state.player;
    // Muro mas cercano por encima del jugador.
    const wall = (state.walls ?? [])
      .filter((w) => w.y < player.y + 20)
      .sort((a, b) => b.y - a.y)[0];
    let targetX = wall ? wall.gapX + wall.gapW / 2 : player.x;
    for (const block of state.blocks ?? []) {
      if (Math.abs(block.y - player.y) < 140 && Math.abs(block.x - targetX) < block.size) {
        targetX += targetX < box.w / 2 ? block.size * 1.6 : -block.size * 1.6;
      }
    }
    targetX = Math.max(12, Math.min(box.w - 12, targetX));
    await page.mouse.move(targetX, box.h * 0.79);
    await page.waitForTimeout(28);
  }
  await page.mouse.up();
}

const BOTS = { pulse: playPulse, drift: playDrift, snap: playSnap, memory: () => playMemory(page) };
const results = {};

for (const gameId of Object.keys(BOTS)) {
  if (only && only !== gameId) continue;
  results[gameId] = [];
  for (let i = 0; i < runs; i++) {
    await launch(gameId);
    await BOTS[gameId]();
    await page.waitForSelector('.result', { timeout: 60000 });
    const info = await page.evaluate(() => {
      const score = document.querySelector('.result__score')?.textContent ?? '?';
      const stats = [...document.querySelectorAll('.stat')].map((s) => s.textContent.trim());
      return { score, stats };
    });
    results[gameId].push(info);
    console.log(`${gameId} #${i + 1}: ${info.score}  [${info.stats.join(' | ')}]`);
    await page.locator('.result .btn--ghost').click();
    await page.waitForSelector('.card');
  }
}

console.log('\nRESUMEN');
for (const [game, list] of Object.entries(results)) {
  const nums = list.map((r) => Number.parseInt(r.score.replace(/\D/g, ''), 10)).filter(Number.isFinite);
  const avg = Math.round(nums.reduce((a, b) => a + b, 0) / Math.max(1, nums.length));
  console.log(`${game}: min ${Math.min(...nums)} · media ${avg} · max ${Math.max(...nums)}`);
}

await browser.close();
