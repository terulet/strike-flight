/**
 * Recorridos completos del producto en viewport de iPhone (393x852).
 * Comprueba de verdad -no de palabra- mutadores, fantasma, revancha,
 * adelantamiento, reto secreto, evento CHAOS, dia virtual y landscape.
 * Deja las capturas en shots/.
 */
import { launchBrowser } from './browser.mjs';
import { mkdir } from 'node:fs/promises';
import { launchGame, playCurrent, playDrift, playPulse, isOver, readState, salirDelResultado} from './bot.mjs';

const BASE = process.env.BASE ?? 'http://localhost:5173';
const OUT = new URL('../shots/', import.meta.url).pathname;
await mkdir(OUT, { recursive: true });
const ok = [];
const fail = [];
const check = (name, condition, detail = '') => {
  (condition ? ok : fail).push(`${name}${detail ? ` — ${detail}` : ''}`);
  console.log(`${condition ? '  OK  ' : ' FALLO'} ${name}${detail ? ` — ${detail}` : ''}`);
};

const browser = await launchBrowser();
const context = await browser.newContext({
  viewport: { width: 393, height: 852 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: 'es-ES',
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error' && !m.text().includes('favicon')) errors.push(`console: ${m.text()}`);
});

const shot = async (name) => page.screenshot({ path: `${OUT}${name}.png` });
const homeText = () => page.locator('.screen').innerText();

await page.goto(`${BASE}/?debug`, { waitUntil: 'networkidle' });

/** Estas pruebas son del modo en solitario: si sale el onboarding, lo elegimos. */
async function enterSolo(page) {
  if ((await page.locator('.onboarding').count()) > 0) {
    // Por clase, no por texto: el texto tambien aparece en la nota de abajo.
    await page.locator('.onboarding__solo').click();
    await page.waitForSelector('.card', { timeout: 10000 });
  }
}

/** Salir del resultado: por clase, no por texto (ver bot.mjs). */
async function leaveResult(page) {
  await salirDelResultado(page);
}


await enterSolo(page);
await page.waitForSelector('.card');

/* ---------- 1. Portada ---------- */
{
  const text = await homeText();
  check('portada: RUSH DE HOY', text.includes('RUSH') && text.includes('DE HOY'));
  check('portada: 3 retos + secreto', (await page.locator('.card').count()) >= 4);
  // El ranking ya no es una lista plana: el #1 va en tarjeta, el #2 y el #3 en
  // dos modulos y del cuarto en adelante en filas. Se cuentan los tres sitios,
  // que es lo que de verdad importa: que esten los cinco jugadores.
  const enElPodio =
    (await page.locator('.podio__hero').count()) +
    (await page.locator('.podio__mini').count()) +
    (await page.locator('.podio .row').count());
  check('portada: clasificacion con 5 jugadores', enElPodio === 5, `${enElPodio} sitios`);
  check('portada: el #1 destaca sobre el resto', (await page.locator('.podio__hero').count()) === 1);
  check('portada: mi puesto se localiza', (await page.locator('.podio .row--me, .podio__mini--yo, .podio__hero--yo').count()) >= 1);
  check('portada: reto secreto bloqueado', text.includes('RETO SECRETO') && text.includes('BLOQUEADO'));
  check('portada: contexto social (corona)', text.includes('👑'));
  const accents = await page.$$eval('.card', (cards) =>
    cards.map((c) => getComputedStyle(c).getPropertyValue('--accent').trim()),
  );
  check('portada: cada reto con su color', new Set(accents.filter(Boolean)).size >= 3, accents.join(' '));
  await shot('01-home');
}

/* ---------- 2. Partida completa + resultado + revancha ---------- */
{
  await page.locator('.card .btn--accent').first().click();
  await page.waitForSelector('.countdown');
  await shot('02-countdown');
  await page.waitForSelector('.countdown', { state: 'detached', timeout: 10000 });
  const before = await page.evaluate(() => window.__PZ.state()?.game);
  await page.waitForTimeout(2500);
  await shot('03-gameplay');
  await playCurrent(page, 60000);
  await page.waitForSelector('.result', { timeout: 60000 });
  await page.waitForTimeout(600);
  const resultText = await page.locator('.result__inner').innerText();
  check('resultado: aparece la puntuacion', /\d/.test(resultText), before);
  // Al ganar, el boton principal pasa a ser CONTINUAR y la revancha queda
  // como "OTRO INTENTO": las dos formas valen.
  check(
    'resultado: ofrece volver a jugar',
    resultText.includes('REVANCHA') || resultText.includes('OTRO INTENTO'),
  );
  check('resultado: quedan 2 intentos', resultText.includes('● ● ○'));
  check(
    'resultado: mensaje de pique',
    resultText.includes('SUPERAR A') ||
      resultText.includes('HAS SUPERADO') ||
      resultText.includes('MANDAS') ||
      resultText.includes('MEJOR INTENTO') ||
      resultText.includes('TU MEJOR DE HOY'),
    resultText.split('\n').slice(2, 5).join(' | '),
  );
  await shot('04-result');

  const t0 = Date.now();
  // Por texto: si has ganado, el boton de volver a jugar es "OTRO INTENTO".
  await page
    .locator('.result button', { hasText: /REVANCHA|OTRO INTENTO/ })
    .first()
    .click();
  await page.waitForSelector('.countdown', { timeout: 4000 });
  await page.waitForSelector('.countdown', { state: 'detached', timeout: 6000 });
  const elapsed = Date.now() - t0;
  check('revancha: vuelve al juego sin pasar por menu', elapsed < 3000, `${elapsed} ms`);
  const covered = await page.evaluate(() => {
    const play = document.querySelector('.play');
    if (!play) return false;
    // Lo que se ve en el centro de la pantalla tiene que ser el juego, no un menu.
    const middle = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
    const rect = play.getBoundingClientRect();
    return (
      rect.width >= innerWidth &&
      rect.height >= innerHeight &&
      Boolean(middle && play.contains(middle))
    );
  });
  check('revancha: el juego ocupa la pantalla sin menu intermedio', covered);
  await page.evaluate(() => window.__PZ.app.playScreen.forceFinish());
  await page.waitForSelector('.result');
  await leaveResult(page);
}

/* ---------- 3. Adelantar a un rival ---------- */
{
  // Escenario: empiezo desde cero y el grupo esta rondando los 4.800 puntos.
  const setup = await page.evaluate(() => {
    const app = window.__PZ.app;
    app.save.update(() => {
      const day = app.save.day(app.dayKey);
      day.rivalBoosts = {};
      for (const spec of app.plan.challenges) {
        const progress = app.save.challenge(app.dayKey, spec.id);
        progress.bestScore = 0;
        progress.plays = 0;
      }
    });
    const board = app.leaderboard();
    app.save.update(() => {
      const day = app.save.day(app.dayKey);
      for (const entry of board.standings) {
        if (entry.isMe) continue;
        day.rivalBoosts[entry.id] = Math.round((4800 - entry.total) / 3);
      }
    });
    app.refresh();
    return { myRank: app.leaderboard().myRank, lider: app.leaderboard().leader.total };
  });
  check('pique: empiezo el ultimo', setup.myRank === 5, JSON.stringify(setup));
  const spec = await page.evaluate(() => {
    const app = window.__PZ.app;
    const s = app.plan.challenges[0];
    app.startChallenge(s, { ignoreAttempts: true });
    return s.gameId;
  });
  await page.waitForSelector('.countdown', { state: 'detached', timeout: 10000 });
  await playCurrent(page, 60000);
  await page.waitForSelector('.result', { timeout: 60000 });
  await page.waitForTimeout(700);
  const text = await page.locator('.result__inner').innerText();
  check('pique: avisa del adelantamiento', text.includes('HAS SUPERADO A'), `${spec}: ${text.split('\n')[3] ?? ''}`);
  check('pique: dice en que puesto quedas', /AHORA ERES #\d/.test(text));
  await shot('05-result-overtake');
  await leaveResult(page);
  const home = await homeText();
  check(
    'portada: el ranking refleja el adelantamiento',
    home.includes('VAS #1') || home.includes('VAS PRIMERO'),
    home.split('\n').slice(0, 6).join(' | '),
  );
  await shot('06-home-lider');
}

/* ---------- 4. Fantasma en DRIFT ---------- */
{
  await page.evaluate(() => {
    const app = window.__PZ.app;
    app.mutatorOverride = null;
    app.save.update(() => {
      app.save.day(app.dayKey).rivalBoosts = { marc: -3400, kali: -3400, yoli: -3400, silvia: -3400 };
    });
  });
  await launchGame(page, 'drift');
  const ghost = await page.locator('.hud__ghost').innerText();
  check('fantasma: se anuncia la marca del rival', ghost.includes('👻'), ghost.trim());
  await page.waitForTimeout(1500);
  await shot('07-drift-ghost');
  await playDrift(page, 60000);
  await page.waitForSelector('.result', { timeout: 60000 });
  const text = await page.locator('.result__inner').innerText();
  check('fantasma: se celebra al superarlo', text.includes('MARCA DEL RIVAL') || text.includes('👻'), text.split('\n')[4] ?? '');
  await shot('08-drift-result');
  await leaveResult(page);
}

/* ---------- 5. Mutadores ---------- */
{
  // APAGON: el host pinta la oscuridad para cualquier juego.
  await page.evaluate(() => {
    window.__PZ.app.mutatorOverride = ['blackout', 'double'];
  });
  await launchGame(page, 'pulse');
  const darkness = await page.evaluate(() => window.__PZ.game().config.mutators.darkness);
  check('mutador APAGON: llega al juego', darkness > 0.7, String(darkness));
  await page.mouse.move(200, 420);
  await page.waitForTimeout(900);
  await shot('09-mutador-apagon');

  const doubled = await page.evaluate(() => window.__PZ.game().config.mutators.scoreMultiplier);
  check('mutador PUNTOS X2: multiplica', doubled === 2, String(doubled));
  await page.evaluate(() => window.__PZ.app.playScreen.forceFinish());
  await page.waitForSelector('.result');
  await leaveResult(page);

  // SPRINT recorta la duracion sin tocar el juego.
  const durations = await page.evaluate(() => {
    const app = window.__PZ.app;
    app.mutatorOverride = ['sprint'];
    const spec = app.plan.challenges[0];
    app.startChallenge(spec, { ignoreAttempts: true, quick: true });
    const dur = app.playScreen.game.config.durationMs;
    app.playScreen.forceFinish();
    return { base: spec.baseDurationMs, dur };
  });
  check('mutador SPRINT: recorta el tiempo', durations.dur === Math.round(durations.base * 0.7), JSON.stringify(durations));
  await page.waitForSelector('.result');
  await leaveResult(page);
  await page.evaluate(() => {
    window.__PZ.app.mutatorOverride = null;
  });
}

/* ---------- 6. Intentos agotados ---------- */
{
  const state = await page.evaluate(() => {
    const app = window.__PZ.app;
    const spec = app.plan.challenges[1];
    app.save.update(() => {
      app.save.challenge(app.dayKey, spec.id).attemptsUsed = 3;
    });
    app.refresh();
    return { left: app.attemptsLeft(spec) };
  });
  check('intentos: se agotan', state.left === 0);
  const text = await homeText();
  check('intentos: la tarjeta dice SIN INTENTOS', text.includes('SIN INTENTOS'));
  await shot('10-sin-intentos');
  await page.evaluate(() => {
    const app = window.__PZ.app;
    app.save.update(() => {
      app.save.challenge(app.dayKey, app.plan.challenges[1].id).attemptsUsed = 0;
    });
    app.refresh();
  });
}

/* ---------- 7. Reto secreto ---------- */
{
  const before = await homeText();
  check('secreto: bloqueado de inicio', before.includes('Se abre cuando'));
  await page.evaluate(() => {
    const app = window.__PZ.app;
    // Todo el grupo ha jugado: yo tambien (marco mis tres retos como jugados).
    app.save.update(() => {
      for (const spec of app.plan.challenges) {
        const progress = app.save.challenge(app.dayKey, spec.id);
        if (progress.plays === 0) progress.plays = 1;
      }
    });
    app.refresh();
  });
  await page.locator('.debug-toggle').click();
  await page.locator('.debug-tab', { hasText: 'RIVALES' }).click();
  await page.locator('button.dbg-btn', { hasText: 'TODOS HAN JUGADO' }).click();
  await page.locator('.debug-panel__close').click();
  const after = await homeText();
  check('secreto: se abre cuando han jugado los 5', after.includes('RETO SECRETO · 1 INTENTO'), after.includes('A OSCURAS') ? 'a oscuras' : '');
  await shot('11-secreto-abierto');
}

/* ---------- 8. Evento CHAOS ---------- */
{
  await page.locator('.debug-toggle').click();
  await page.locator('.debug-tab', { hasText: 'DIA' }).click();
  await page.locator('button.dbg-btn', { hasText: 'ACTIVAR CHAOS' }).click();
  await shot('12-debug');
  await page.locator('.debug-panel__close').click();
  const text = await homeText();
  check('chaos: aparece la tarjeta del evento', text.includes('CHAOS'));
  const chaos = await page.evaluate(() => {
    const app = window.__PZ.app;
    app.startChallenge(app.plan.chaos, { ignoreAttempts: true, quick: true });
    const cfg = app.playScreen.game.config;
    return { chaos: cfg.mutators.chaos, mult: cfg.mutators.scoreMultiplier, ids: cfg.mutatorIds };
  });
  await page.waitForSelector('.countdown', { state: 'detached', timeout: 10000 });
  await page.waitForTimeout(1200);
  check('chaos: mutadores especiales activos', chaos.chaos === true && chaos.mult >= 2.5, JSON.stringify(chaos));
  await shot('13-chaos-gameplay');
  await page.evaluate(() => window.__PZ.app.playScreen.forceFinish());
  await page.waitForSelector('.result');
  const rtext = await page.locator('.result__inner').innerText();
  check('chaos: puntua aparte del ranking', rtext.includes('aparte'));
  await leaveResult(page);
}

/* ---------- 9. Dia virtual ---------- */
{
  const first = await page.evaluate(() => ({
    day: window.__PZ.app.dayKey,
    juegos: window.__PZ.app.plan.challenges.map((c) => c.gameId).join(','),
  }));
  await page.evaluate(() => window.__PZ.app.shiftDay(1));
  const second = await page.evaluate(() => ({
    day: window.__PZ.app.dayKey,
    juegos: window.__PZ.app.plan.challenges.map((c) => c.gameId).join(','),
    intentos: window.__PZ.app.attemptsLeft(window.__PZ.app.plan.challenges[0]),
  }));
  check('dia virtual: avanza', second.day > first.day, `${first.day} -> ${second.day}`);
  check('dia virtual: intentos nuevos', second.intentos === 3);
  await shot('14-dia-siguiente');
  await page.evaluate(() => window.__PZ.app.shiftDay(-1));
}

/* ---------- 10. Persistencia ---------- */
{
  const saved = await page.evaluate(() => {
    const app = window.__PZ.app;
    app.save.flush();
    return { name: app.save.get().profile.name, total: app.leaderboard().me.total };
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('.card');
  const restored = await page.evaluate(() => ({
    name: window.__PZ.app.save.get().profile.name,
    total: window.__PZ.app.leaderboard().me.total,
  }));
  check('persistencia: la partida sobrevive a recargar', restored.total === saved.total, `${saved.total} pts`);
}

/* ---------- 11. Landscape y escritorio ---------- */
{
  await page.setViewportSize({ width: 852, height: 393 });
  await page.waitForTimeout(400);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check('landscape: no se rompe ni desborda', overflow <= 0, `overflow ${overflow}px`);
  await shot('15-landscape');

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.waitForTimeout(400);
  await shot('16-escritorio');
  const width = await page.evaluate(() => document.querySelector('.shell').getBoundingClientRect().width);
  check('escritorio: se centra como una consola vertical', width <= 470, `${Math.round(width)}px`);
  await page.setViewportSize({ width: 393, height: 852 });
}

console.log(`\nRESULTADO: ${ok.length} OK · ${fail.length} fallos`);
if (fail.length) console.log('FALLOS:\n' + fail.map((f) => ` - ${f}`).join('\n'));
console.log(errors.length ? `\nERRORES DE CONSOLA:\n${errors.join('\n')}` : '\nSin errores de consola.');
await browser.close();
process.exit(fail.length ? 1 : 0);
