/**
 * Capture the delivery screenshots at the reference resolution (393 x 852).
 *   node tools/screenshots.mjs [baseUrl] [outDir]
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { mkdirSync } from 'node:fs';

const BASE = process.argv[2] || 'http://127.0.0.1:4321/index.html';
const OUT = process.argv[3] || 'docs/screenshots';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true,
});
const page = await ctx.newPage();
page.on('pageerror', (e) => console.error('PAGEERROR', e.message));

const shot = async (name) => {
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log('  ', `${OUT}/${name}.png`);
};
const go = async (q) => {
  await page.goto(`${BASE}${q}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
};
const seed = async (best, todayBest) => {
  await page.evaluate(([b, t]) => {
    window.OMM.save.update((d) => {
      d.records.bestM = b;
      d.records.today = { day: new Date().toISOString().slice(0, 10), bestM: t };
      d.stats = { ...d.stats, attempts: 148, shots: 148, falls: 37, closeCalls: 12, nearMisses: 9, rivalsBeaten: 8, records: 6, streak: 4, bestStreak: 7, sessions: 5, zones: { legendary: 1, elite: 3, insane: 14, great: 41, good: 52, safe: 30 } };
      d.unlocked = ['puck', 'can', 'phone', 'block', 'car'];
    });
    window.OMM.ui.refreshHome();
  }, [best, todayBest]);
};

console.log('\n  capturing screenshots at 393x852 (dpr 3)\n');

// 1 — home
await go('?surface=wood&object=puck');
await seed(0.00072, 0.00119);
await page.waitForTimeout(400);
await shot('01-home');

// 2 — charging
await go('?mode=quick&surface=wood&object=puck');
await seed(0.00072, 0.00119);
await page.evaluate(() => { window.OMM.game.press(); });
await page.waitForTimeout(720);
await shot('02-charging');
await page.evaluate(() => window.OMM.game.cancelPress());

// 3 — sliding
await go('?mode=quick&surface=ice&object=car');
await page.evaluate(() => window.OMM.game.fireExact(window.OMM.game.challenge.pe * 0.75));
await page.waitForTimeout(620);
await shot('03-sliding');

// 4 — the brink, macro
await go('?mode=quick&surface=wood&object=phone');
await page.evaluate(async () => {
  const g = window.OMM.game;
  g.fireExact(g.challenge.pe - 0.0006);
});
await page.waitForFunction(() => window.OMM.game.shotState === 'result');
await page.waitForTimeout(240);
await shot('04-brink-macro');

// 5 — a winning result
await page.waitForFunction(() => !document.getElementById('result').hidden);
await page.waitForTimeout(260);
await shot('05-result-record');

// 6 — near miss fall
await go('?mode=quick&surface=wood&object=puck');
await page.evaluate(() => window.OMM.game.fireExact(window.OMM.game.challenge.pe + 0.0016));
await page.waitForTimeout(1150);
await shot('06-falling');
await page.waitForFunction(() => !document.getElementById('result').hidden);
await page.waitForTimeout(200);
await shot('07-near-miss');

// 8 — three shots HUD with a rival to beat
await go('?mode=three&surface=metal&object=block');
await page.evaluate(async () => {
  const g = window.OMM.game;
  g.fireExact(g.challenge.pe * 0.72);
});
await page.waitForFunction(() => !document.getElementById('result').hidden);
await page.evaluate(() => window.OMM.game.advance());
await page.evaluate(() => window.OMM.game.fireExact(window.OMM.game.challenge.pe - 0.02));
await page.waitForFunction(() => !document.getElementById('result').hidden);
await page.waitForTimeout(200);
await shot('08-rival-beaten');

// 9 — final shot tension
await page.evaluate(() => window.OMM.game.advance());
await page.waitForTimeout(300);
await shot('09-final-shot');

// 10 — ranking
await go('');
await seed(0.00048, 0.00072);
await page.click('#btn-ranking');
await page.waitForTimeout(300);
await shot('10-ranking');

// 11 — stats
await page.click('#modal-close');
await page.click('#btn-stats');
await page.waitForTimeout(250);
await shot('11-stats');

// 12 — settings
await page.click('#modal-close');
await page.click('#btn-settings');
await page.waitForTimeout(250);
await shot('12-settings');

// 13 — debug
await go('?debug=1&mode=quick&surface=ice&object=phone');
await page.evaluate(() => window.OMM.game.fireExact(window.OMM.game.challenge.pe * 0.85));
await page.waitForTimeout(700);
await shot('13-debug');

// 14 — spanish home
await go('?lang=es');
await seed(0.00072, 0.00119);
await page.waitForTimeout(300);
await shot('14-home-es');

await browser.close();
console.log('');
