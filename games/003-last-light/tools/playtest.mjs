/**
 * Banco de pruebas de balance.
 *
 * Un bot juega la arena entera muchas veces y devuelve NÚMEROS: cuánto dura
 * un intento, cuántas balas cuesta, cuántas veces te quedas seco, si el bot
 * llega vivo al final. Un bot no puede decir si el juego es divertido —eso
 * solo lo dice Eloi jugando— pero sí detecta lo que haría imposible
 * responder a esa pregunta: quedarse sin munición a medio nivel, un intento
 * de doce minutos, o una arena que no se puede cruzar.
 *
 * Simula SOLO la lógica (`game.update`), sin dibujar: un intento de tres
 * minutos tarda ~1 segundo en vez de cuatro minutos.
 *
 *   node tools/playtest.mjs [intentos]
 */

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 5211;
const RUNS = Number(process.argv[2] || 12);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const server = spawn('node', [resolve(ROOT, 'tools/serve.mjs'), String(PORT)], { stdio: 'ignore' });
await sleep(600);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 960, height: 560 } });
await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.LAST_LIGHT, null, { timeout: 8000 });

const results = await page.evaluate(async (RUNS) => {
  const g = window.LAST_LIGHT;
  const DT = 1 / 60;
  const MAX_SECONDS = 240;
  const out = [];

  /**
   * Bot deliberadamente TORPE: busca al enemigo vivo más cercano, se acerca
   * y dispara si le ve. No esquiva, no ahorra balas, no usa la oscuridad.
   * Es el suelo de habilidad — si el bot termina el nivel, un humano lo hace
   * de sobra; si el bot se queda seco, un humano también.
   */
  let botStuck = 0, botLastX = 0, botLastY = 0, botDetour = 0;

  function drive() {
    const p = g.player;
    // El bot usa la misma navegación tosca que la IA y se atasca igual. Si no
    // se le desatasca, los intentos "sin tiempo" miden al bot, no al juego.
    if (Math.hypot(p.x - botLastX, p.y - botLastY) < 0.4) botStuck++; else botStuck = 0;
    botLastX = p.x; botLastY = p.y;
    if (botStuck > 40) { botDetour = 90; botStuck = 0; }
    let best = null, bestD = Infinity;
    for (const e of g.enemies) {
      if (!e.alive) continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < bestD) { bestD = d; best = e; }
    }
    const i = g.input;
    i.aimMode = 'direction';
    if (!best) { i.moveX = i.moveY = 0; i.firing = false; return; }

    const ax = best.x - p.x, ay = best.y - p.y;
    const len = Math.hypot(ax, ay) || 1;
    i.aimDirX = ax / len; i.aimDirY = ay / len;
    i.aimStrength = 1;

    const sees = g.level.hasLineOfSight(p.x, p.y, best.x, best.y);
    i.firing = sees && bestD < 620;

    // Acercarse esquivando muros con bigotes, igual que hace la IA.
    if (bestD > 190 || botDetour > 0) {
      const base = Math.atan2(ay, ax) + (botDetour-- > 0 ? Math.PI * 0.6 : 0);
      let mx = 0, my = 0;
      for (const off of [0, -0.6, 0.6, -1.2, 1.2, -2.0, 2.0]) {
        const a = base + off;
        if (!g.level.raycast(p.x, p.y, Math.cos(a), Math.sin(a), 70).hit) {
          mx = Math.cos(a); my = Math.sin(a); break;
        }
      }
      i.moveX = mx; i.moveY = my;
    } else {
      i.moveX = i.moveY = 0;
    }
  }

  // Contadores de diagnóstico: sin ellos, "el enemigo no mata" no dice si
  // es que no dispara, si dispara y falla, o si ni siquiera te ve.
  let enemyShots = 0, alertFrames = 0, inRangeFrames = 0, seenFrames = 0;
  const Enemy = g.enemies[0].constructor;
  const origShoot = Enemy.prototype.shoot;
  Enemy.prototype.shoot = function (...a) { enemyShots++; return origShoot.apply(this, a); };

  for (let run = 0; run < RUNS; run++) {
    g.reset();
    let dry = 0, reloads = 0, wasReloading = false, frames = 0;
    enemyShots = 0; alertFrames = 0; inRangeFrames = 0; seenFrames = 0;
    const startHealth = g.player.health;
    const startReserve = g.player.weapon.reserve;

    while (g.state === 'playing' && g.time < MAX_SECONDS) {
      drive();
      g.update(DT);
      g.input.endFrame();
      frames++;
      if (g.player.weapon.mag === 0 && g.player.weapon.reserve === 0) dry++;
      const r = g.player.weapon.isReloading;
      if (r && !wasReloading) reloads++;
      wasReloading = r;
      for (const e of g.enemies) {
        if (!e.alive) continue;
        if (e.ai.state === 'ALERT') alertFrames++;
        if (e.ai.canSeePlayer) seenFrames++;
        if (Math.hypot(e.x - g.player.x, e.y - g.player.y) <= g.config.enemy.attackRange) inRangeFrames++;
      }
    }

    const w = g.player.weapon;
    out.push({
      resultado: g.state === 'cleared' ? 'DESPEJADO' : g.state === 'dead' ? 'muerto' : 'sin tiempo',
      seg: +g.time.toFixed(1),
      bajas: g.stats.kills,
      vida: g.player.health,
      disparos: w.shotsFired,
      recargas: reloads,
      // Cuántos fotogramas ha pasado sin una sola bala en todo el intento.
      seco: +(dry / Math.max(1, frames) * 100).toFixed(1),
      munRestante: w.mag + w.reserve,
      munRecogida: Math.max(0, (w.mag + w.reserve + w.shotsFired) - (startReserve + g.config.weapon.magSize)),
      dañoRecibido: startHealth - g.player.health,
      tirosEnemigos: enemyShots,
      // Segundos acumulados (sumando enemigos) en cada situación.
      sAlerta: +(alertFrames / 60).toFixed(1),
      sTeVe: +(seenFrames / 60).toFixed(1),
      sAtiro: +(inRangeFrames / 60).toFixed(1),
    });
  }
  return out;
}, RUNS);

await browser.close();
server.kill();

const num = (k) => results.map((r) => r[k]);
const avg = (k) => (num(k).reduce((a, b) => a + b, 0) / results.length).toFixed(1);
const count = (v) => results.filter((r) => r.resultado === v).length;

console.log(`\n${RUNS} intentos · bot torpe (sin esquivar, sin ahorrar balas)\n`);
console.table(results);
console.log(`\ndespejado ${count('DESPEJADO')}   muerto ${count('muerto')}   sin tiempo ${count('sin tiempo')}`);
console.log(`duración media ${avg('seg')}s   ·   bajas ${avg('bajas')}/5   ·   disparos ${avg('disparos')}`);
console.log(`munición restante ${avg('munRestante')}   ·   recogida ${avg('munRecogida')}   ·   sin balas el ${avg('seco')}% del intento`);
console.log(`daño recibido ${avg('dañoRecibido')}/3   ·   tiros enemigos ${avg('tirosEnemigos')}`);
console.log(`por intento — en ALERTA ${avg('sAlerta')}s   ·   TE VE ${avg('sTeVe')}s   ·   a tiro ${avg('sAtiro')}s`);
