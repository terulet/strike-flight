/**
 * Prueba de humo. Levanta el juego en un navegador real, lo juega solo unos
 * segundos y falla si algo se rompe.
 *
 * No sustituye a jugar — nada lo hace — pero sí responde a lo único que un
 * humano no debería tener que comprobar a mano en cada cambio: que arranca,
 * que no lanza errores, que la IA cambia de estado y que va a 60.
 *
 *   node tools/check.mjs [--headed] [--shots]
 */

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
// Playwright vive en la instalación global de este entorno, no en el proyecto:
// el juego sigue sin dependencias, la herramienta de pruebas no cuenta.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = resolve(ROOT, 'dist/shots');
const PORT = 5199;
const wantShots = process.argv.includes('--shots');
const headed = process.argv.includes('--headed');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fail = [];

const server = spawn('node', [resolve(ROOT, 'tools/serve.mjs'), String(PORT)], { stdio: 'ignore' });
await sleep(600);

const browser = await chromium.launch({ headless: !headed });
const page = await browser.newPage({
  viewport: { width: 960, height: 560 }, deviceScaleFactor: 2, hasTouch: true,
});
const cdp = await page.context().newCDPSession(page);
/** Multitáctil real vía CDP: dos pulgares a la vez, como en un iPhone. */
const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', {
  type,
  touchPoints: points.map((p, i) => ({ x: p[0], y: p[1], id: i })),
});

const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });

if (wantShots) mkdirSync(SHOTS, { recursive: true });
const shot = async (name) => { if (wantShots) await page.screenshot({ path: resolve(SHOTS, `${name}.png`) }); };

try {
  await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.LAST_LIGHT, null, { timeout: 8000 });
  await sleep(700);

  const boot = await page.evaluate(() => {
    const g = window.LAST_LIGHT;
    return {
      enemies: g.enemies.length, pickups: g.pickups.length, lamps: g.lamps.length,
      segments: g.level.segments.length,
      view: [g.renderer.viewW, g.renderer.viewH, +g.renderer.dpr.toFixed(2)],
      mask: [g.lighting.liveMask.width, g.lighting.liveMask.height],
      mem: [g.lighting.memMask.width, g.lighting.memMask.height],
    };
  });
  console.log('arranque   ', JSON.stringify(boot));
  if (boot.enemies < 1) fail.push('no se han creado enemigos');
  if (boot.mask[0] < 8) fail.push('la máscara de luz tiene tamaño 0');
  await shot('01-oscuridad');

  // ── Un disparo, congelado, para ver el fogonazo ────────────────────
  await page.evaluate(() => {
    const g = window.LAST_LIGHT;
    g.config.lighting.muzzle.duration = 2.5;   // solo para la captura
    g.input.aimMode = 'direction';
    g.input.aimDirX = 1; g.input.aimDirY = 0; g.input.aimStrength = 1;
    g.input.firing = true;
  });
  await sleep(45);
  await page.evaluate(() => { window.LAST_LIGHT.input.firing = false; });
  await shot('02-fogonazo');

  await page.evaluate(() => { window.LAST_LIGHT.config.lighting.muzzle.duration = 0.085; });
  await sleep(450);
  await shot('03-memoria');

  // ── Juega sola: se mueve y dispara en varias direcciones ───────────
  for (let i = 0; i < 26; i++) {
    await page.evaluate((i) => {
      const g = window.LAST_LIGHT;
      const a = i * 0.62;
      g.input.moveX = Math.cos(a); g.input.moveY = Math.sin(a);
      g.input.aimDirX = Math.cos(a * 1.7); g.input.aimDirY = Math.sin(a * 1.7);
      g.input.aimStrength = 1;
      g.input.firing = i % 3 !== 0;
    }, i);
    await sleep(190);
  }
  await shot('04-combate');

  const after = await page.evaluate(() => {
    const g = window.LAST_LIGHT;
    const states = {};
    for (const e of g.enemies) states[e.ai.state] = (states[e.ai.state] || 0) + 1;
    return {
      fps: +g.fps.toFixed(1), frameMs: +g.frameMs.toFixed(2),
      time: +g.time.toFixed(1), state: g.state,
      shots: g.player.weapon.shotsFired, kills: g.stats.kills,
      alive: g.enemies.filter((e) => e.alive).length,
      states,
      exposure: +g.player.exposure.toFixed(2),
      projectiles: g.projectiles.count,
      particles: g.effects.particles.active,
      lights: g.lighting.activeCount, shadows: g.lighting.shadowCount,
      perf: Object.fromEntries(Object.entries(g.perf).map(([k, v]) => [k, +v.toFixed(2)])),
      playerHealth: g.player.health,
      soundsHeard: g.enemies.filter((e) => e.ai.state !== 'IDLE').length,
    };
  });
  console.log('tras jugar ', JSON.stringify(after));
  console.log('desglose   ', JSON.stringify(after.perf));

  if (after.shots === 0) fail.push('no se ha disparado ni una vez');
  if (after.lights === 0) fail.push('no hay ninguna luz activa');

  // El coste de la lógica es lo que controla el código; la composición es
  // relleno de píxeles y aquí corre por software (sin GPU), así que se mide
  // aparte y con otro listón. El número que vale es el del dispositivo.
  const logic = after.perf.update + after.perf.static + after.perf.entities + after.perf.light;
  console.log(`lógica ${logic.toFixed(2)}ms   composición ${after.perf.compose.toFixed(2)}ms (software, sin GPU)`);
  if (logic > 6) fail.push(`lógica demasiado cara: ${logic.toFixed(2)}ms (objetivo <6)`);
  if (after.perf.compose > 34) fail.push(`composición desbocada: ${after.perf.compose.toFixed(1)}ms`);

  // ── LA REGLA: disparar te delata ───────────────────────────────────
  // Se coloca al jugador a tiro de oído de un enemigo concreto y se
  // comprueba que ese enemigo reacciona. Sin azar: o la regla funciona o no.
  const heard = await page.evaluate(async () => {
    const g = window.LAST_LIGHT;
    g.reset();
    const e = g.enemies[0];
    e.ai.state = 'IDLE';
    g.player.x = e.x + 260; g.player.y = e.y;
    g.player.weapon.cooldown = 0;
    const before = e.ai.state;
    g.emitSound(g.player.x, g.player.y, g.config.weapon.shotLoudness, 'shot');
    return { before, after: e.ai.state, dist: Math.round(Math.hypot(e.x - g.player.x, e.y - g.player.y)) };
  });
  console.log('la regla   ', JSON.stringify(heard));
  if (heard.after === 'IDLE') fail.push('un disparo a 260px no alerta al enemigo: la regla central no funciona');

  // ── CONTROL TÁCTIL: la plataforma objetivo, probada con dos dedos ───
  // Es lo único que no se puede validar a ojo desde un escritorio, y es
  // justamente donde se va a jugar. Así que se prueba con CDP de verdad.
  await page.evaluate(() => {
    const g = window.LAST_LIGHT;
    g.reset();
    g.input.moveX = 0; g.input.moveY = 0; g.input.firing = false;
    g.config.touch.fireMode = 'auto';
  });
  await touch('touchStart', [[200, 400], [740, 300]]);
  await sleep(60);
  // Pulgar izquierdo a la derecha (mover), pulgar derecho arriba (apuntar+disparar).
  await touch('touchMove', [[260, 400], [740, 220]]);
  await sleep(220);

  const tState = await page.evaluate(() => {
    const g = window.LAST_LIGHT;
    return {
      touchActive: g.input.touchActive,
      move: [+g.input.moveX.toFixed(2), +g.input.moveY.toFixed(2)],
      aimMode: g.input.aimMode,
      aim: [+g.input.aimDirX.toFixed(2), +g.input.aimDirY.toFixed(2)],
      firing: g.input.firing,
      shots: g.player.weapon.shotsFired,
    };
  });
  console.log('táctil     ', JSON.stringify(tState));
  await shot('05-tactil');
  await touch('touchEnd', []);

  if (!tState.touchActive) fail.push('el táctil no se detecta');
  if (tState.move[0] < 0.5) fail.push(`el stick izquierdo no mueve: ${tState.move}`);
  if (tState.aim[1] > -0.5) fail.push(`el stick derecho no apunta hacia arriba: ${tState.aim}`);
  if (!tState.firing || tState.shots === 0) fail.push('el auto-fire táctil no dispara');

  // Modo 'button': el stick derecho apunta pero NO debe disparar solo.
  await page.evaluate(() => {
    const g = window.LAST_LIGHT;
    g.config.touch.fireMode = 'button';
    g.input.firing = false;
  });
  await touch('touchStart', [[740, 300]]);
  await sleep(60);
  await touch('touchMove', [[740, 200]]);
  await sleep(120);
  const btnMode = await page.evaluate(() => window.LAST_LIGHT.input.firing);
  await touch('touchEnd', []);
  await page.evaluate(() => { window.LAST_LIGHT.config.touch.fireMode = 'auto'; });
  if (btnMode) fail.push("en modo 'button' el stick de apuntado dispara solo");

  // ── Reinicio: el estado no debe arrastrar nada ─────────────────────
  await page.evaluate(() => {
    const g = window.LAST_LIGHT;
    g.input.firing = false; g.input.moveX = 0; g.input.moveY = 0;
    g.reset();
  });
  await sleep(300);
  const reset = await page.evaluate(() => {
    const g = window.LAST_LIGHT;
    return {
      alive: g.enemies.filter((e) => e.alive).length,
      health: g.player.health, mag: g.player.weapon.mag,
      projectiles: g.projectiles.count, state: g.state, time: +g.time.toFixed(2),
    };
  });
  console.log('reinicio   ', JSON.stringify(reset));
  if (reset.alive !== boot.enemies) fail.push('el reinicio no repone a los enemigos');
  if (reset.projectiles !== 0) fail.push('quedan proyectiles vivos tras reiniciar');

  // ── El BUNDLE: es lo que acaba en el móvil, así que se prueba él ────
  // Que compile no significa que arranque: el empaquetador quita imports y
  // exports a mano y una colisión de nombres solo se ve al ejecutarlo.
  const { execFileSync } = await import('node:child_process');
  execFileSync('node', [resolve(ROOT, 'tools/build.mjs')], { stdio: 'ignore' });
  const bundleErrors = [];
  const bundlePage = await browser.newPage({ viewport: { width: 800, height: 480 } });
  bundlePage.on('pageerror', (e) => bundleErrors.push(`bundle pageerror: ${e.message}`));
  bundlePage.on('console', (m) => { if (m.type() === 'error') bundleErrors.push(`bundle console: ${m.text()}`); });
  await bundlePage.goto(`http://localhost:${PORT}/dist/last-light.html`, { waitUntil: 'load' });
  await bundlePage.waitForFunction(() => window.LAST_LIGHT, null, { timeout: 8000 }).catch(() => {});
  await sleep(900);
  const bundleState = await bundlePage.evaluate(() => {
    const g = window.LAST_LIGHT;
    return g ? { enemies: g.enemies.length, time: +g.time.toFixed(1), fps: +g.fps.toFixed(0) } : null;
  });
  console.log('bundle     ', JSON.stringify(bundleState));
  await bundlePage.close();
  if (!bundleState) fail.push('dist/last-light.html no arranca');
  else if (bundleState.time < 0.3) fail.push('el bundle arranca pero el bucle no avanza');
  fail.push(...bundleErrors.slice(0, 4));

  if (errors.length) fail.push(...errors.slice(0, 8));
} catch (e) {
  fail.push(`excepción: ${e.message}`);
} finally {
  await browser.close();
  server.kill();
}

if (fail.length) {
  console.error('\n✗ FALLOS\n' + fail.map((f) => '  · ' + f).join('\n'));
  process.exit(1);
}
console.log('\n✓ todo en orden' + (wantShots ? `  ·  capturas en ${SHOTS}` : ''));
