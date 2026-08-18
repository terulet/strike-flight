/**
 * LA PRUEBA DEL MILESTONE.
 *
 * Dos navegadores independientes (dos "moviles") compitiendo de verdad:
 *
 *   Eloi crea grupo -> juega -> Marc entra con el codigo -> juega mejor ->
 *   Eloi ve "MARC TE HA QUITADO EL #1" -> pulsa REVANCHA -> gana ->
 *   Marc ve el ranking nuevo.
 *
 * Sin tocar datos a mano: las puntuaciones salen de jugar. El bot lee el
 * estado del juego igual que un humano mira la pantalla, pero no escribe nada.
 *
 *   node tools/duel.mjs
 */
import { chromium } from 'playwright';
import { playCurrent } from './bot.mjs';

const BASE = process.env.BASE ?? 'http://localhost:5173';
const OUT = new URL('../shots/', import.meta.url).pathname;

const ok = [];
const fail = [];
const check = (name, condition, detail = '') => {
  (condition ? ok : fail).push(`${name}${detail ? ` — ${detail}` : ''}`);
  console.log(`${condition ? '  OK  ' : ' FALLO'} ${name}${detail ? ` — ${detail}` : ''}`);
};

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROME ?? '/opt/pw-browsers/chromium',
  args: ['--no-sandbox', '--use-gl=swiftshader'],
});

const phone = () =>
  browser.newContext({
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'es-ES',
  });

const errors = [];
async function openPhone(label) {
  const context = await phone();
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(`${label}: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().includes('favicon')) {
      errors.push(`${label}: ${message.text()}`);
    }
  });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  return { context, page };
}

const shot = (page, name) => page.screenshot({ path: `${OUT}${name}.png` });
const homeText = (page) => page.locator('.screen').innerText();

/**
 * Salir del resultado a la portada. Se pulsa por TEXTO, no por clase: cuando
 * ganas, CONTINUAR pasa a ser el boton principal y REVANCHA el secundario.
 */
async function backToHome(page) {
  await page.getByText('CONTINUAR', { exact: true }).click();
  await page.waitForSelector('.play', { state: 'detached', timeout: 10000 });
  await page.waitForSelector('.card');
}

/* ------------------------------------------------------------------ */
/* 1. Eloi crea el grupo                                               */
/* ------------------------------------------------------------------ */
const eloi = await openPhone('eloi');
await eloi.page.waitForSelector('.onboarding');
check('onboarding: aparece al abrir por primera vez', true);
await shot(eloi.page, 'd01-onboarding');

await eloi.page.getByText('CREAR GRUPO', { exact: true }).click();
await eloi.page.locator('.onboarding__input').fill('Eloi');
await shot(eloi.page, 'd02-crear-grupo');
await eloi.page.locator('.btn--play').click();
await eloi.page.waitForSelector('.onboarding__code');
const code = (await eloi.page.locator('.onboarding__code').innerText()).trim();
check('crear grupo: devuelve un codigo corto', /^[A-Z0-9]{4}$/.test(code), code);
await shot(eloi.page, 'd03-codigo');
await eloi.page.getByText('ENTRAR A PLAYZONE').click();
await eloi.page.waitForSelector('.card');
check('portada: entra directo tras crear el grupo', (await homeText(eloi.page)).includes('RUSH'));

/* ------------------------------------------------------------------ */
/* 2. Eloi juega el reto 1 (flojo)                                     */
/* ------------------------------------------------------------------ */
/**
 * Juega el primer reto durante `playMs` y deja que la partida termine sola.
 * Jugar menos rato = puntuar menos, en cualquiera de los juegos: es la forma
 * mas reproducible de montar un duelo con ganador conocido.
 */
async function playFirstChallenge(page, playMs) {
  await page.locator('.card .btn--accent').first().click();
  await page.waitForSelector('.countdown', { state: 'detached', timeout: 15000 });
  await playCurrent(page, playMs, 1);
  await page.waitForSelector('.result', { timeout: 60000 });
  const score = Number.parseInt(
    (await page.locator('.result__score').innerText()).replace(/\D/g, ''),
    10,
  );
  return score;
}

const eloiFirst = await playFirstChallenge(eloi.page, 5000);
check('eloi juega y saca puntuacion', eloiFirst > 0, String(eloiFirst));
await backToHome(eloi.page);

/* ------------------------------------------------------------------ */
/* 3. Marc entra con el codigo desde otro navegador                    */
/* ------------------------------------------------------------------ */
const marc = await openPhone('marc');
await marc.page.waitForSelector('.onboarding');
await marc.page.getByText('UNIRME A UN GRUPO').click();
await marc.page.locator('.onboarding__input--code').fill(code);
await marc.page.locator('.onboarding__input').nth(1).fill('Marc');
await shot(marc.page, 'd04-unirse');
await marc.page.locator('.btn--play').click();
await marc.page.waitForSelector('.card', { timeout: 15000 });
check('unirse: entra en el grupo con el codigo', true, code);

const marcSeesEloi = await homeText(marc.page);
check(
  'marc ve la marca real de eloi en su ranking',
  marcSeesEloi.includes('Eloi'),
  `${eloiFirst} pts`,
);
await shot(marc.page, 'd05-ranking-real');

/* ------------------------------------------------------------------ */
/* 4. Marc juega mejor y adelanta a Eloi                               */
/* ------------------------------------------------------------------ */
const marcScore = await playFirstChallenge(marc.page, 14000);
check('marc supera a eloi jugando', marcScore > eloiFirst, `${marcScore} > ${eloiFirst}`);
await shot(marc.page, 'd06-marc-gana');
await backToHome(marc.page);

/* ------------------------------------------------------------------ */
/* 5. Eloi se entera SIN recargar                                      */
/* ------------------------------------------------------------------ */
await eloi.page.waitForSelector('.overtake', { timeout: 25000 });
const overtakeText = await eloi.page.locator('.overtake').innerText();
check('eloi recibe el aviso sin recargar', overtakeText.includes('Marc'), overtakeText.split('\n')[0]);
await shot(eloi.page, 'd07-te-han-superado');

/* ------------------------------------------------------------------ */
/* 6. Eloi pulsa REVANCHA y responde                                   */
/* ------------------------------------------------------------------ */
const t0 = Date.now();
await eloi.page.locator('.overtake .btn--play').click();
await eloi.page.waitForSelector('.countdown', { state: 'detached', timeout: 15000 });
check('revancha: entra directo al juego', Date.now() - t0 < 6000, `${Date.now() - t0} ms`);
await eloi.page.waitForTimeout(1200);
await shot(eloi.page, 'd08-revancha');

await playCurrent(eloi.page, 60000, 1);
await eloi.page.waitForSelector('.result', { timeout: 60000 });
await eloi.page.waitForTimeout(600);
const revengeScore = Number.parseInt(
  (await eloi.page.locator('.result__score').innerText()).replace(/\D/g, ''),
  10,
);
const resultText = await eloi.page.locator('.result__inner').innerText();
check('revancha: eloi vuelve a pasar a marc', revengeScore > marcScore, `${revengeScore} > ${marcScore}`);
check('resultado: lo dice con nombre y apellidos', resultText.includes('Marc'), resultText.split('\n')[3] ?? '');
await shot(eloi.page, 'd09-resultado-superado');
await backToHome(eloi.page);

/* ------------------------------------------------------------------ */
/* 7. Marc ve el ranking nuevo                                         */
/* ------------------------------------------------------------------ */
await marc.page.waitForFunction(
  () => {
    const rows = [...document.querySelectorAll('.board .row')];
    return rows.length > 0 && rows[0]?.textContent?.includes('Eloi');
  },
  { timeout: 25000 },
);
const marcFinal = await homeText(marc.page);
check('marc ve a eloi otra vez primero', marcFinal.includes('Eloi'));
const marcOvertaken = await marc.page.locator('.overtake').count();
if (marcOvertaken === 0) {
  const diag = await marc.page.evaluate(() => ({
    pending: window.__PZ?.app?.pendingOvertake ?? null,
    totals: window.__PZ?.app?.save?.get?.().social?.lastTotals ?? null,
    seen: (window.__PZ?.app?.save?.get?.().social?.seenOvertakes ?? []).slice(-3),
    day: window.__PZ?.app?.dayKey,
    board: window.__PZ?.app?.leaderboard?.().standings.map((s) => [s.name, s.total, s.isMe]),
  }));
  console.log('   diagnostico marc:', JSON.stringify(diag));
}
check('marc recibe su propio aviso de adelantamiento', marcOvertaken > 0);
await shot(marc.page, 'd10-marc-ve-ranking');

/* ------------------------------------------------------------------ */
/* 8. Coherencia entre los dos moviles                                 */
/* ------------------------------------------------------------------ */
const totals = async (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('.board .row')].map((row) => ({
      name: row.querySelector('.row__name')?.textContent?.replace(/TU|HA JUGADO|👑/g, '').trim(),
      score: Number.parseInt(row.querySelector('.row__score')?.textContent?.replace(/\D/g, '') ?? '0', 10),
    })),
  );
const eloiBoard = await totals(eloi.page);
const marcBoard = await totals(marc.page);
const same = JSON.stringify(eloiBoard.map((e) => e.score).sort()) ===
  JSON.stringify(marcBoard.map((e) => e.score).sort());
check(
  'los dos moviles ven exactamente el mismo ranking',
  same,
  `eloi=${JSON.stringify(eloiBoard)} marc=${JSON.stringify(marcBoard)}`,
);

console.log(`\nRESULTADO: ${ok.length} OK · ${fail.length} fallos`);
if (fail.length) console.log('FALLOS:\n' + fail.map((f) => ` - ${f}`).join('\n'));
console.log(errors.length ? `\nERRORES DE CONSOLA:\n${errors.join('\n')}` : '\nSin errores de consola.');

await browser.close();
process.exit(fail.length ? 1 : 0);
