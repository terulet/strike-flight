import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const url = process.argv[2] || 'http://127.0.0.1:4321/index.html?debug=1';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
const state = await page.evaluate(() => ({
  hasOMM: !!window.OMM,
  screen: window.OMM?.game?.screen,
  challenge: window.OMM?.game?.challenge?.id,
  fps: window.OMM?.loop?.fps,
}));
console.log('state', JSON.stringify(state));
console.log(errors.length ? errors.join('\n') : 'no errors');
await page.screenshot({ path: process.argv[3] || '/tmp/claude-0/-home-user-strike-flight/89f5ef26-0867-5fae-8c2b-651bfa3e5540/scratchpad/home.png' });
await browser.close();
