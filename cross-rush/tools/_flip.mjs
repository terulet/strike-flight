import { chromium } from 'playwright';
const OUT = '/tmp/claude-0/-home-user-strike-flight/3406d499-c3d6-5e56-834e-547f55353b44/scratchpad';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--disable-gpu-vsync','--disable-frame-rate-limit'] });
const p = await b.newPage({ viewport: { width: 1366, height: 768 } });
const errs=[]; p.on('pageerror',(e)=>errs.push(String(e))); p.on('console',(m)=>{ if(m.type()==='error') errs.push(m.text()); });
await p.goto('http://127.0.0.1:5174/', { waitUntil: 'load' });
await p.mouse.click(683, 384);
await p.waitForFunction(() => window.__crossRushFrame?.state === 'RACING', null, { timeout: 20000 });
const L = await p.evaluate(() => Object.fromEntries(window.__crossRushTrack.labels.map(l => [l.name, l.x])));
await p.evaluate((mega) => {
  const held = new Set();
  const setKey = (c, d) => { if (d && !held.has(c)) { held.add(c); window.dispatchEvent(new KeyboardEvent('keydown',{code:c})); } else if (!d && held.has(c)) { held.delete(c); window.dispatchEvent(new KeyboardEvent('keyup',{code:c})); } };
  window.__rot = 0; let prev = null;
  const tick = () => {
    const f = window.__crossRushFrame;
    if (f) {
      if (f.state !== 'RACING') { for (const k of ['ArrowRight','ArrowLeft','ArrowUp','ArrowDown']) setKey(k,false); }
      else {
        setKey('ArrowRight', true);
        const air = !f.frontContact && !f.rearContact;
        const inMega = f.x > mega + 8 && f.x < mega + 34;
        if (air && inMega) {
          if (prev !== null) { let d = f.angle - prev; while (d > Math.PI) d -= Math.PI*2; while (d <= -Math.PI) d += Math.PI*2; window.__rot += d; }
          prev = f.angle;
        }
        let lean = 0;
        if (air && inMega && window.__rot < 5.2) lean = 1;
        else if (air) {
          const tr = window.__crossRushTrack;
          const t = Math.abs(f.vx) < 3 ? 0 : Math.max(-0.9, Math.min(0.9, Math.atan(tr.surfaceSlope(f.x + Math.max(2, Math.abs(f.vx)*0.32)))));
          let d = t - f.angle; while (d > Math.PI) d -= Math.PI*2; while (d <= -Math.PI) d += Math.PI*2;
          const w = d*2.2 - f.angularVelocity*0.42;
          lean = w > 0.25 ? 1 : w < -0.25 ? -1 : 0;
        }
        setKey('ArrowUp', lean>0); setKey('ArrowDown', lean<0);
      }
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}, L.MEGA_JUMP);
await p.waitForFunction(new Function('return window.__crossRushFrame.x > ' + (L.MEGA_JUMP + 11)), null, { timeout: 90000 });
for (let i = 0; i < 6; i++) { await p.screenshot({ path: `${OUT}/flip-${i}.jpg`, type:'jpeg', quality: 86 }); await p.waitForTimeout(230); }
console.log('rot', await p.evaluate(() => window.__rot.toFixed(2)), 'errores:', errs.length?errs.join(' | '):'ninguno');
await b.close();
