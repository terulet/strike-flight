/**
 * Generates the app icons with Canvas2D (same language as the game itself), so
 * there are no binary assets in the repo that nobody can regenerate.
 *   node tools/icons.mjs
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';

mkdirSync('assets', { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();

const draw = `(size, maskable) => {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d');
  const s = size / 512;
  const pad = maskable ? size * 0.14 : 0;
  // background
  const g = x.createLinearGradient(0, 0, 0, size);
  g.addColorStop(0, '#0a1020');
  g.addColorStop(0.55, '#070a12');
  g.addColorStop(1, '#04050a');
  x.fillStyle = g;
  if (maskable) { x.fillStyle = '#07080b'; x.fillRect(0, 0, size, size); x.fillStyle = g; }
  roundRect(x, 0, 0, size, size, maskable ? 0 : size * 0.22); x.fill();
  // glow
  const halo = x.createRadialGradient(size * 0.62, size * 0.55, 0, size * 0.62, size * 0.55, size * 0.6);
  halo.addColorStop(0, 'rgba(56,232,255,0.30)');
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = halo; x.fillRect(0, 0, size, size);
  // platform
  const top = size * 0.62, edge = size * 0.70 - pad * 0.4;
  x.fillStyle = '#6b4b30';
  x.fillRect(0, top, edge, size * 0.10);
  x.fillStyle = '#8a6440';
  x.fillRect(0, top, edge, size * 0.035);
  x.fillStyle = '#e7c79a';
  x.fillRect(edge - 4 * s, top, 4 * s, size * 0.10);
  // the object, hanging over the brink
  const w = size * 0.40, h = size * 0.115;
  // The balance point stays ON the slab (that is the whole game); the body hangs off.
  const ox = edge - w * 0.72;
  x.fillStyle = '#15171d';
  roundRect(x, ox, top - h, w, h, h * 0.42); x.fill();
  x.strokeStyle = 'rgba(255,255,255,0.45)'; x.lineWidth = 3 * s; x.stroke();
  x.fillStyle = '#ff4d3d';
  x.fillRect(ox + w * 0.12, top - h * 0.62, w * 0.76, h * 0.2);
  // the measurement
  const com = ox + w * 0.5;
  x.strokeStyle = '#ff2fd0'; x.lineWidth = 6 * s;
  x.setLineDash([10 * s, 8 * s]);
  x.beginPath();
  x.moveTo(com, top - h * 1.9); x.lineTo(com, top + size * 0.155);
  x.stroke();
  x.setLineDash([]);
  const my = top + size * 0.135;
  x.beginPath();
  x.moveTo(com, my); x.lineTo(edge, my);
  x.moveTo(com, my - 12 * s); x.lineTo(com, my + 12 * s);
  x.moveTo(edge, my - 12 * s); x.lineTo(edge, my + 12 * s);
  x.stroke();
  x.fillStyle = '#38e8ff';
  x.font = '900 ' + Math.round(size * 0.085) + 'px -apple-system, system-ui, sans-serif';
  x.textAlign = 'center';
  x.fillText('mm', size * 0.5, size * 0.90 - pad * 0.5);
  function roundRect(ctx, X, Y, W, H, R) {
    ctx.beginPath();
    ctx.moveTo(X + R, Y);
    ctx.arcTo(X + W, Y, X + W, Y + H, R);
    ctx.arcTo(X + W, Y + H, X, Y + H, R);
    ctx.arcTo(X, Y + H, X, Y, R);
    ctx.arcTo(X, Y, X + W, Y, R);
    ctx.closePath();
  }
  return c.toDataURL('image/png');
}`;

for (const [name, size, maskable] of [
  ['icon-180', 180, false], ['icon-192', 192, false], ['icon-512', 512, false], ['icon-maskable-512', 512, true],
]) {
  const url = await page.evaluate(`(${draw})(${size}, ${maskable})`);
  writeFileSync(`assets/${name}.png`, Buffer.from(url.split(',')[1], 'base64'));
  console.log('  assets/' + name + '.png');
}
await browser.close();
