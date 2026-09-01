/**
 * Secuencia de evidencia visual del mandato: moto quieta, acelerando,
 * frenando, saltando y aterrizando, en escritorio (1366x768) y movil
 * (393x852). Corre sobre el servidor que se le pase por argumento.
 */
import { chromium } from 'playwright';
import { mkdirSync, renameSync, rmSync } from 'node:fs';

const OUT = process.env.SHOTS ?? '/tmp/claude-0/-home-user-strike-flight/3406d499-c3d6-5e56-834e-547f55353b44/scratchpad/shots';
mkdirSync(OUT, { recursive: true });
const url = process.argv[2] ?? 'http://127.0.0.1:5174/';

const PILOT = () => {
  const held = new Set();
  const setKey = (c, d) => {
    if (d && !held.has(c)) { held.add(c); window.dispatchEvent(new KeyboardEvent('keydown', { code: c })); }
    else if (!d && held.has(c)) { held.delete(c); window.dispatchEvent(new KeyboardEvent('keyup', { code: c })); }
  };
  window.__pilot = { brake: false, coast: false, landings: 0, wasAir: false, maxVx: 0 };
  const tick = () => {
    const f = window.__crossRushFrame;
    if (f) {
      const air = !f.frontContact && !f.rearContact;
      if (window.__pilot.wasAir && !air) window.__pilot.landings++;
      window.__pilot.wasAir = air;
      window.__pilot.maxVx = Math.max(window.__pilot.maxVx, f.vx);
      const dead = f.state === 'CRASHED' || f.state === 'FINISHED';
      if (dead) { for (const k of ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown']) setKey(k, false); }
      else {
        setKey('ArrowRight', !window.__pilot.brake && !window.__pilot.coast);
        setKey('ArrowLeft', window.__pilot.brake);
        let lean = 0;
        if (air) {
          const tr = window.__crossRushTrack;
          const target = Math.abs(f.vx) < 3 ? 0 : Math.max(-0.9, Math.min(0.9, Math.atan(tr.surfaceSlope(f.x + Math.max(2, Math.abs(f.vx) * 0.32)))));
          let d = target - f.angle;
          while (d > Math.PI) d -= Math.PI * 2;
          while (d <= -Math.PI) d += Math.PI * 2;
          const want = d * 2.2 - f.angularVelocity * 0.42;
          lean = want > 0.25 ? 1 : want < -0.25 ? -1 : 0;
        }
        setKey('ArrowUp', lean > 0); setKey('ArrowDown', lean < 0);
      }
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};

async function runPass(label, viewport, extra, videoDir) {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--disable-gpu-vsync', '--disable-frame-rate-limit'],
  });
  // El video se graba a media resolucion: es evidencia de movimiento -que las
  // ruedas giran, que la suspension trabaja, que la camara acompana-, no de
  // detalle, y a tamano completo son decenas de MB que no caben en el repo.
  const recordVideo = videoDir
    ? { dir: videoDir, size: { width: Math.round(viewport.width / 2), height: Math.round(viewport.height / 2) } }
    : undefined;
  const page = await browser.newPage({ viewport, ...extra, ...(recordVideo ? { recordVideo } : {}) });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  const shot = (name) => page.screenshot({ path: `${OUT}/${label}-${name}.jpg`, type: 'jpeg', quality: 85 });

  await page.goto(url, { waitUntil: 'load' });
  await page.mouse.click(viewport.width / 2, viewport.height / 2);
  await page.waitForFunction(() => Boolean(window.__crossRushFrame), null, { timeout: 20000 });

  // 1. QUIETA: en la parrilla, con la cuenta atras corriendo y la moto ya
  //    posada sobre su suspension.
  await page.waitForFunction(() => window.__crossRushFrame.state === 'COUNTDOWN' && window.__crossRushFrame.frontContact, null, { timeout: 15000 });
  await page.waitForTimeout(500);
  await shot('1-quieta');

  await page.waitForFunction(() => window.__crossRushFrame.state === 'RACING', null, { timeout: 20000 });
  await page.evaluate(PILOT);

  // 2. ACELERANDO: primer segundo, con la trasera patinando.
  await page.waitForTimeout(700);
  await shot('2-acelerando');

  // 3. FRENANDO: lanzada y freno a fondo.
  await page.waitForFunction(() => window.__crossRushFrame.vx > 16, null, { timeout: 20000 });
  await page.evaluate(() => { window.__pilot.brake = true; });
  await page.waitForTimeout(420);
  await shot('3-frenando');
  await page.evaluate(() => { window.__pilot.brake = false; });

  // 4. SALTANDO: en vuelo, subiendo.
  await page.waitForFunction(() => {
    const f = window.__crossRushFrame;
    return !f.frontContact && !f.rearContact && f.vy > 2;
  }, null, { timeout: 30000 });
  await shot('4-saltando');

  // 5. ATERRIZANDO: el fotograma del impacto.
  await page.evaluate(() => { window.__pilot.landings = 0; });
  await page.waitForFunction(() => window.__pilot.landings > 0, null, { timeout: 20000 });
  await shot('5-aterrizando');

  // 6. META (o el estado en que acabe la pasada).
  const finished = await page
    .waitForFunction(() => ['FINISHED', 'CRASHED'].includes(window.__crossRushFrame.state), null, { timeout: 60000 })
    .then(() => true)
    .catch(() => false);
  if (finished) {
    await shot('6-meta');
    await page.waitForTimeout(1200);
    await shot('7-resultados');
  }

  const summary = await page.evaluate(() => ({
    state: window.__crossRushFrame.state,
    t: window.__crossRushFrame.t,
    x: window.__crossRushFrame.x,
    maxVx: window.__pilot.maxVx,
    finishX: window.__crossRushTrack.finishX,
  }));
  const video = page.video();
  await browser.close();
  if (video && videoDir) {
    renameSync(await video.path(), `${videoDir}/${label}-vuelta.webm`);
  }
  console.log(label, JSON.stringify(summary), 'errores:', errs.length ? errs.join(' | ') : 'ninguno');
  return summary;
}

const only = process.argv[3];
// `--video` graba ademas la vuelta entera en webm (ver cierre del mandato).
const videoDir = process.argv.includes('--video') ? `${OUT}/video` : null;
if (videoDir) {
  rmSync(videoDir, { recursive: true, force: true });
  mkdirSync(videoDir, { recursive: true });
}
if (!only || only === 'desktop') await runPass('desktop', { width: 1366, height: 768 }, {}, videoDir);
if (!only || only === 'movil') {
  await runPass('movil', { width: 393, height: 852 }, { hasTouch: true, isMobile: true, deviceScaleFactor: 2 }, videoDir);
}
