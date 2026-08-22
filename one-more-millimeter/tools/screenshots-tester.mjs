/**
 * Captures the screens added by the tester milestone. Run the static server first.
 *   node tools/screenshots-tester.mjs [baseUrl] [outDir]
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { mkdirSync } from 'node:fs';

const BASE = process.argv[2] || 'http://127.0.0.1:4321/index.html';
const OUT = process.argv[3] || 'docs/screenshots';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const shot = async (page, name) => {
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log('  ', `${OUT}/${name}.png`);
};
const newPage = async (permissions) => {
  const ctx = await browser.newContext({
    viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true,
    permissions,
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error('PAGEERROR', e.message));
  return page;
};

console.log('\n  capturing tester screens at 393x852 (dpr 3)\n');

const RIVAL_LINK = '?tester=1&challenge=whatsapp01&rival=Marc&score=1.42&target=Marc&mode=quick';

// t01 — name onboarding, mid-typing
{
  const page = await newPage();
  await page.goto(BASE + RIVAL_LINK, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await page.fill('#onboard-input', 'Eloi');
  await page.waitForTimeout(250);
  await shot(page, 't01-name-onboarding');
  await page.close();
}

// t02 — the rival from the link, on the platform
const page = await newPage(['clipboard-read', 'clipboard-write']);
await page.goto(BASE + RIVAL_LINK + '&name=Eloi', { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await page.evaluate(() => { window.OMM.game.press(); });
await page.waitForTimeout(620);
await shot(page, 't02-rival-link');
await page.evaluate(() => window.OMM.game.cancelPress());

// t03 — losing to Marc
await page.evaluate(() => window.OMM.game.fireExact(window.OMM.game.challenge.pe * 0.62));
await page.waitForFunction(() => !document.getElementById('result').hidden);
await page.waitForTimeout(300);
await shot(page, 't03-rival-loss-revenge');

// t04 — revenge taken
await page.evaluate(() => window.OMM.game.advance());
await page.waitForTimeout(200);
await page.evaluate(async () => {
  const g = window.OMM.game;
  const { powerForMargin } = await import('./src/game/Challenge.js');
  g.fireExact(powerForMargin(g.challenge, g.match.target.marginM * 0.45));
});
await page.waitForFunction(() => !document.getElementById('result').hidden);
await page.waitForTimeout(300);
await shot(page, 't04-rival-beaten');

// a few more shots so the report has something to say
await page.evaluate(() => window.OMM.game.advance());
for (const k of [1.0, 0.55, 0.98]) {
  await page.evaluate((x) => window.OMM.game.fireExact(window.OMM.game.challenge.pe * x), k);
  await page.waitForFunction(() => !document.getElementById('result').hidden, null, { timeout: 15000 });
  await page.waitForTimeout(120);
  await page.evaluate(() => window.OMM.game.advance());
  await page.waitForTimeout(100);
}

// t05 — settings, where a tester finds the report
await page.evaluate(() => window.OMM.game.quit());
await page.waitForTimeout(200);
await page.click('#btn-settings');
await page.waitForTimeout(300);
await shot(page, 't05-settings-report');

// t06 — the report itself
await page.locator('#modal-body .row', { hasText: 'TEST REPORT' }).locator('button').click();
await page.waitForTimeout(400);
await shot(page, 't06-test-report');

// t07 — copied
await page.locator('#modal-body .btn-primary').click();
await page.waitForTimeout(500);
await shot(page, 't07-report-copied');
await page.close();

// t08 — debug overlay with the build version
{
  const p2 = await newPage();
  await p2.goto(BASE + '?debug=1&tester=1&challenge=whatsapp01&rival=Marc&score=1.42&name=Eloi&mode=quick', { waitUntil: 'networkidle' });
  await p2.waitForTimeout(700);
  await p2.evaluate(() => window.OMM.game.fireExact(window.OMM.game.challenge.pe * 0.8));
  await p2.waitForTimeout(600);
  await shot(p2, 't08-debug-version');
  await p2.close();
}

await browser.close();
console.log('');
