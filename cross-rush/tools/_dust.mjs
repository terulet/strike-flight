import { chromium } from 'playwright';
const OUT = '/tmp/claude-0/-home-user-strike-flight/3406d499-c3d6-5e56-834e-547f55353b44/scratchpad';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--disable-gpu-vsync','--disable-frame-rate-limit'] });
const p = await b.newPage({ viewport: { width: 1366, height: 768 } });
const errs=[]; p.on('pageerror',(e)=>errs.push(String(e))); p.on('console',(m)=>{ if(m.type()==='error') errs.push(m.text()); });
await p.goto('http://127.0.0.1:5174/', { waitUntil: 'load' });
await p.mouse.click(683, 384);
await p.waitForFunction(() => window.__crossRushFrame?.state === 'RACING', null, { timeout: 20000 });
const L = await p.evaluate(() => Object.fromEntries(window.__crossRushTrack.labels.map(l => [l.name, l.x])));
await p.evaluate(() => {
  const held = new Set();
  const setKey = (c, d) => { if (d && !held.has(c)) { held.add(c); window.dispatchEvent(new KeyboardEvent('keydown',{code:c})); } else if (!d && held.has(c)) { held.delete(c); window.dispatchEvent(new KeyboardEvent('keyup',{code:c})); } };
  const tick = () => { const f = window.__crossRushFrame;
    if (f) { if (f.state!=='RACING'){for(const k of ['ArrowRight','ArrowLeft','ArrowUp','ArrowDown'])setKey(k,false);} else {
      setKey('ArrowRight', true); let lean=0;
      if(!f.frontContact&&!f.rearContact){const tr=window.__crossRushTrack;const t=Math.abs(f.vx)<3?0:Math.max(-0.9,Math.min(0.9,Math.atan(tr.surfaceSlope(f.x+Math.max(2,Math.abs(f.vx)*0.32)))));let d=t-f.angle;while(d>Math.PI)d-=Math.PI*2;while(d<=-Math.PI)d+=Math.PI*2;const w=d*2.2-f.angularVelocity*0.42;lean=w>0.25?1:w<-0.25?-1:0;}
      setKey('ArrowUp',lean>0); setKey('ArrowDown',lean<0);} } requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
});
const shot = async (n, cond) => { await p.waitForFunction(cond, null, { timeout: 60000 }); await p.screenshot({ path: `${OUT}/dust-${n}.jpg`, type:'jpeg', quality: 88 }); };
await shot('1-crucero', new Function('return window.__crossRushFrame.x > ' + (L.RECOVERY + 60) + ' && window.__crossRushFrame.vx > 17'));
await shot('2-vuelo', new Function('return window.__crossRushFrame.x > ' + (L.MEGA_JUMP + 16) + ' && !window.__crossRushFrame.frontContact && !window.__crossRushFrame.rearContact'));
console.log('errores:', errs.length?errs.join(' | '):'ninguno');
await b.close();
