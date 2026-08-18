import { chromium } from 'playwright';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
page.on('pageerror', e => console.log('PAGEERROR', e.message));
await page.goto('http://localhost:5173/?debug', { waitUntil: 'networkidle' });
await page.locator('.card .btn--accent').first().click();
await page.waitForSelector('.result', { timeout: 60000 });
console.log('primer resultado');
await page.locator('.result .btn--play').click();
await page.waitForTimeout(400);
console.log('revancha lanzada; hay result?', await page.locator('.result').count());
await page.locator('.debug-toggle').click();
await page.locator('.debug-tab', { hasText: 'JUEGOS' }).click();
await page.waitForTimeout(300);
const info = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.debug-panel button')].find(b => b.textContent.includes('TERMINAR'));
  const r = btn.getBoundingClientRect();
  const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
  const hit = document.elementFromPoint(cx, cy);
  const stack = [];
  let n = hit;
  while (n) { stack.push(`${n.tagName}.${n.className}`); n = n.parentElement; }
  const cs = getComputedStyle(btn);
  return {
    btn: `x${Math.round(r.x)} y${Math.round(r.y)} w${Math.round(r.width)} h${Math.round(r.height)} pe=${cs.pointerEvents} vis=${cs.visibility} disp=${cs.display}`,
    hitChain: stack.slice(0, 4),
    hasResult: !!document.querySelector('.result'),
    hasPlay: !!document.querySelector('.play'),
  };
});
console.log(JSON.stringify(info, null, 1));
await page.screenshot({ path: 'shots/_diag.png' });
await browser.close();
