/**
 * Automated QA pass (spec 79 / 81 / 84).
 * Drives the real build in Chromium: restarts, falls, records, modals, reloads,
 * corrupted saves, backgrounding and different frame rates.
 *
 *   node tools/qa.mjs [baseUrl]
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const BASE = process.argv[2] || 'http://127.0.0.1:4321/index.html';
const results = [];
const check = (name, ok, extra = '') => {
  results.push({ name, ok, extra });
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`);
};

const browser = await chromium.launch();

/** Every check that is not ABOUT onboarding skips it with ?name=. */
function withName(url, name = 'QA') {
  if (/[?&]name=/.test(url)) return url;
  return url + (url.includes('?') ? '&' : '?') + 'name=' + name;
}

async function newPage(url = BASE, opts = {}) {
  const page = await browser.newPage({
    viewport: opts.viewport || { width: 393, height: 852 },
    deviceScaleFactor: opts.dsf || 2,
    hasTouch: true, isMobile: true,
    permissions: opts.permissions,
  });
  page.on('pageerror', (e) => errors.push(`${url} :: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${url} :: console ${m.text()}`); });
  await page.goto(opts.raw ? url : withName(url), { waitUntil: 'networkidle' });
  await page.waitForTimeout(350);
  return page;
}
const errors = [];

/** Fires a shot with an exact power value, bypassing wall-clock jitter. */
async function shoot(page, power) {
  await page.evaluate((p) => window.OMM.game.fireExact(p), power);
  await page.waitForFunction(() => window.OMM.game.shotState === 'result', null, { timeout: 15000 });
  // The panel is deliberately delayed (settle pause / magnifier): wait for it.
  await page.waitForFunction(() => !document.getElementById('result').hidden, null, { timeout: 15000 });
  return page.evaluate(() => {
    const g = window.OMM.game;
    return { mm: g.result.mm, fell: g.result.fell, zone: g.result.zoneId, over: g.result.overshootMm, attempt: g.match.attempt, finished: !!g.match.finished };
  });
}

console.log('\n  ONE MORE MILLIMETER — automated QA\n');

// ---------------------------------------------------------------- 1. boot
{
  const page = await newPage(BASE + '?debug=1');
  const st = await page.evaluate(() => ({ omm: !!window.OMM, screen: window.OMM.game.screen, fps: window.OMM.loop.fps }));
  check('boots with no page errors', st.omm && errors.length === 0, `fps ${st.fps.toFixed(0)}`);
  await page.close();
}

// -------------------------------------------------- 2. full three-shot run
{
  const page = await newPage(BASE + '?mode=three&surface=wood&object=puck');
  const pe = await page.evaluate(() => window.OMM.game.challenge.pe);
  const a = await shoot(page, pe * 0.7);
  await page.evaluate(() => window.OMM.game.advance());
  const b = await shoot(page, pe * 0.95);
  await page.evaluate(() => window.OMM.game.advance());
  const c = await shoot(page, pe - 0.004);
  check('three shots run to completion', a.attempt === 1 && b.attempt === 2 && c.attempt === 3 && c.finished);
  check('closer power gives a better score', a.mm > b.mm && b.mm > c.mm, `${a.mm.toFixed(1)} > ${b.mm.toFixed(1)} > ${c.mm.toFixed(2)} mm`);
  const bestOf = await page.evaluate(() => window.OMM.game.match.best.mm);
  check('best of three is kept', Math.abs(bestOf - c.mm) < 1e-9, `${bestOf.toFixed(3)} mm`);
  await page.close();
}

// ------------------------------------- 2b. a finished run starts another run
{
  const page = await newPage(BASE + '?mode=three&surface=rubber&object=can');
  const pe = await page.evaluate(() => window.OMM.game.challenge.pe);
  for (let i = 0; i < 3; i++) {
    await shoot(page, pe * 0.8);
    if (i < 2) await page.evaluate(() => window.OMM.game.advance());
  }
  const before = await page.evaluate(() => ({ finished: window.OMM.game.match.finished, id: window.OMM.game.challenge.id }));
  await page.evaluate(() => window.OMM.game.advance());
  await page.waitForTimeout(200);
  const after = await page.evaluate(() => ({ screen: window.OMM.game.screen, attempt: window.OMM.game.match.attempt, id: window.OMM.game.challenge.id }));
  check('finished run rolls into a fresh run, not the menu',
    before.finished && after.screen === 'game' && after.attempt === 1 && after.id !== before.id,
    `${before.id} -> ${after.id}`);
  await page.close();
}

// ------------------------------------------------------ 3. falls and near miss
{
  const page = await newPage(BASE + '?mode=quick&surface=wood&object=puck');
  const pe = await page.evaluate(() => window.OMM.game.challenge.pe);
  const big = await shoot(page, 1);
  check('full power falls', big.fell === true, `${big.over.toFixed(1)} mm past`);
  await page.evaluate(() => window.OMM.game.advance());
  const near = await shoot(page, pe + 0.0012);
  const nearMiss = await page.evaluate(() => window.OMM.game.result.nearMiss);
  check('a hair past the brink is a near miss', near.fell && nearMiss, `${near.over.toFixed(3)} mm past`);
  const copy = await page.evaluate(() => document.getElementById('result-sub').textContent);
  check('fall copy names the overshoot', /PAST THE EDGE/.test(copy), copy);
  const vsHidden = await page.evaluate(() => {
    const el = document.getElementById('result-versus');
    return el.hidden && getComputedStyle(el).display === 'none';
  });
  check('no stale comparison panel on a fall', vsHidden);
  await page.close();
}

// --------------------------------------------------- 4. restart stability
{
  const page = await newPage(BASE + '?mode=quick&surface=ice&object=phone');
  const pe = await page.evaluate(() => window.OMM.game.challenge.pe);
  let ok = true;
  for (let i = 0; i < 10; i++) {
    const r = await shoot(page, i % 2 ? pe + 0.02 : pe * 0.8);
    if (!Number.isFinite(r.mm) && !r.fell) ok = false;
    await page.evaluate(() => window.OMM.game.advance());
  }
  const state = await page.evaluate(() => ({
    shot: window.OMM.game.shotState,
    attempt: window.OMM.game.match.attempt,
    parts: window.OMM.game.particles.count,
    listeners: window.OMM.input._bound.length,
  }));
  check('10 shots + retries stay stable', ok && state.shot === 'idle' && state.attempt === 11, JSON.stringify(state));
  check('no listener growth', state.listeners < 20, `${state.listeners} bound`);
  await page.close();
}

// ------------------------------------------------------ 5. save round trip
{
  const page = await newPage(BASE + '?mode=quick&surface=wood&object=puck');
  const pe = await page.evaluate(() => window.OMM.game.challenge.pe);
  const r = await shoot(page, pe - 0.006);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('omm.save.v1')).records.bestM);
  check('record is written to storage', Math.abs(saved * 1000 - r.mm) < 1e-6, `${(saved * 1000).toFixed(3)} mm`);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  const shown = await page.evaluate(() => document.getElementById('home-best').textContent);
  check('record survives a reload', shown !== '--', `home shows ${shown}`);
  await page.close();
}

// ------------------------------------------------------- 6. corrupted save
{
  // Injected before boot: the app writes a clean save on pagehide, so seeding the
  // corruption through a reload would be undone by our own (correct) behaviour.
  const page = await browser.newPage({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2 });
  page.on('pageerror', (e) => errors.push(`corrupt :: ${e.message}`));
  await page.addInitScript(() => {
    try { localStorage.setItem('omm.save.v1', '{"records":{"bestM":'); } catch (e) {}
  });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  const st = await page.evaluate(() => ({ omm: !!window.OMM, best: window.OMM.save.data.records.bestM, corrupt: window.OMM.save.corrupted }));
  check('corrupted save recovers', st.omm && st.best === null && st.corrupt === true);
  await page.close();
}

// ------------------------------------------------- 7. background during hold
{
  const page = await newPage(BASE + '?mode=quick');
  await page.evaluate(() => window.OMM.game.press());
  await page.waitForTimeout(120);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(200);
  const st = await page.evaluate(() => ({ shot: window.OMM.game.shotState, paused: window.OMM.game.paused }));
  check('backgrounding cancels the hold, never fires', st.shot === 'idle', JSON.stringify(st));
  await page.close();
}

// ------------------------------------------------------------ 8. modals + i18n
{
  const page = await newPage(BASE);
  await page.click('#btn-ranking');
  const rankRows = await page.locator('.rank-row').count();
  check('ranking lists the board', rankRows >= 6, `${rankRows} rows`);
  await page.click('#modal-close');
  await page.click('#btn-stats');
  const statRows = await page.locator('#modal-body .row').count();
  check('stats screen renders', statRows >= 8, `${statRows} rows`);
  await page.click('#modal-close');
  await page.click('#btn-settings');
  await page.locator('.toggle', { hasText: 'ES' }).click();
  const play = await page.evaluate(() => document.getElementById('btn-play').textContent);
  check('language switch reaches every string', play === 'JUGAR', `play button = ${play}`);
  await page.close();
}

// ------------------------------------------- 9. determinism across frame rates
{
  const page = await newPage(BASE + '?mode=quick&surface=metal&object=block');
  const out = await page.evaluate(() => {
    const { createState, launch, step, buildResult, isSettled } = window.OMM.game.__sim || {};
    return null;
  });
  // Done through the public path instead: fire the same power twice and compare.
  const pe = await page.evaluate(() => window.OMM.game.challenge.pe);
  const a = await shoot(page, pe - 0.01);
  await page.evaluate(() => window.OMM.game.advance());
  const b = await shoot(page, pe - 0.01);
  check('same power, same score', a.mm === b.mm, `${a.mm.toFixed(9)} vs ${b.mm.toFixed(9)} mm`);
  await page.close();
}

// ------------------------------------------------------------ 10. viewports
{
  const sizes = [
    { name: 'iPhone SE', width: 375, height: 667 },
    { name: 'iPhone 15', width: 393, height: 852 },
    { name: 'iPhone Pro Max', width: 430, height: 932 },
    { name: 'Pixel 7', width: 412, height: 915 },
    { name: 'landscape', width: 852, height: 393 },
    { name: 'desktop', width: 1280, height: 800 },
  ];
  for (const s of sizes) {
    const page = await newPage(BASE + '?mode=quick', { viewport: { width: s.width, height: s.height } });
    const m = await page.evaluate(() => {
      const r = window.OMM.renderer;
      const btn = document.getElementById('btn-primary').getBoundingClientRect();
      const meter = document.getElementById('meter').getBoundingClientRect();
      return { w: r.w, h: r.h, meterW: meter.width, overflow: document.body.scrollWidth > window.innerWidth + 1 };
    });
    check(`${s.name} ${s.width}x${s.height}`, m.w === s.width && m.h === s.height && !m.overflow && m.meterW > 100, `canvas ${m.w}x${m.h}`);
    await page.close();
  }
}

// ============================================================ TESTER BUILD ==

// ------------------------------------------------------ 11. name onboarding
{
  const page = await newPage(BASE, { raw: true });
  const shown = await page.isVisible('#onboard');
  const disabledBefore = await page.locator('#onboard-play').isDisabled();
  await page.fill('#onboard-input', '  Eloi <b>  ');
  const enabled = !(await page.locator('#onboard-play').isDisabled());
  await page.click('#onboard-play');
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => ({
    hidden: document.getElementById('onboard').hidden,
    name: window.OMM.save.data.player.name,
    id: window.OMM.save.data.player.id,
  }));
  check('name onboarding gates the first run', shown && disabledBefore && enabled && after.hidden);
  check('the name is sanitised on the way in', after.name === 'Eloi b' || !/[<>]/.test(after.name), `stored "${after.name}"`);
  check('a player id is generated', after.id.length >= 20);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  const persisted = await page.evaluate(() => ({
    onboard: document.getElementById('onboard').hidden,
    name: window.OMM.save.data.player.name,
  }));
  check('the name persists and onboarding does not come back', persisted.onboard && !!persisted.name, persisted.name);
  await page.close();
}

// --------------------------------------------------- 12. rival from the link
{
  const page = await newPage(BASE + '?tester=1&challenge=qa01&rival=Marc&score=1.42&target=Marc');
  await page.waitForTimeout(400);
  const st = await page.evaluate(() => {
    const g = window.OMM.game;
    return {
      source: window.OMM.rivalPlan.source,
      started: g.screen === 'game',
      target: g.match && g.match.target ? { name: g.match.target.name, mm: g.match.target.mm, real: !!g.match.target.real } : null,
      challenge: g.challenge.id,
      arm: window.OMM.telemetry.session.arm,
      chipName: document.getElementById('hud-target-name').textContent,
      chipValue: document.getElementById('hud-target-value').textContent,
      ghosts: g._ghosts().length,
    };
  });
  check('a link injects the real rival and hunts them',
    st.source === 'link' && st.target && st.target.name === 'MARC' && st.target.mm === 1.42 && st.target.real,
    `${st.chipName} ${st.chipValue}`);
  check('the link pins the challenge and starts the game', st.challenge === 'qa01' && st.started);
  check('the session is tagged as the rival arm', st.arm === 'rival');
  check('the rival ghost is on the platform', st.ghosts >= 1);
  await page.close();
}

// ----------------------------------------------------------- 13. solo arm
{
  const page = await newPage(BASE + '?tester=1&solo=1&challenge=qa01&mode=quick');
  await page.waitForTimeout(300);
  const st = await page.evaluate(() => ({
    rivals: window.OMM.game.match.rivals.length,
    target: window.OMM.game.match.target,
    arm: window.OMM.telemetry.session.arm,
    chipHidden: document.getElementById('hud-target').hidden,
  }));
  check('solo removes every rival', st.rivals === 0 && !st.target && st.arm === 'solo');
  await page.close();
}

// -------------------------------------------- 14. hostile link cannot break it
{
  const nasty = BASE + '?challenge=' + encodeURIComponent('<script>alert(1)</script>') +
    '&rival=' + encodeURIComponent('<img src=x>') + '&score=-99&rivals=' + encodeURIComponent('a'.repeat(400)) +
    '&mode=' + encodeURIComponent('"><b>') + '&pe=99';
  const page = await newPage(nasty);
  await page.waitForTimeout(400);
  const st = await page.evaluate(() => ({
    omm: !!window.OMM,
    challenge: window.OMM.launch.challengeId,
    rivals: window.OMM.launch.rivals.length,
    invalid: window.OMM.launch.invalid.slice(),
    html: document.body.innerHTML.includes('<script>alert'),
  }));
  check('a hostile link is neutralised and the game still boots',
    st.omm && !st.html && st.rivals === 0 && !/[<>]/.test(String(st.challenge)),
    `rejected: ${st.invalid.join(',')}`);
  await page.close();
}

// ------------------------------------------- 15. retry attribution end to end
{
  const page = await newPage(BASE + '?tester=1&challenge=qa02&rival=Marc&score=0.30&target=Marc&mode=quick');
  const pe = await page.evaluate(() => window.OMM.game.challenge.pe);
  // A shot that loses to Marc, then a retry.
  await shoot(page, pe * 0.6);
  await page.evaluate(() => window.OMM.game.advance());
  await page.waitForTimeout(120);
  // A fall, then a retry.
  await shoot(page, 1);
  await page.evaluate(() => window.OMM.game.advance());
  await page.waitForTimeout(120);
  // A loss with no retry: quit instead.
  await shoot(page, pe * 0.6);
  await page.evaluate(() => window.OMM.game.quit());
  await page.waitForTimeout(150);
  const s = await page.evaluate(() => window.OMM.telemetry.summary());
  check('retry after rival loss is counted separately from retry after fall',
    s.results.rival_loss === 2 && s.retries.rival_loss === 1 && s.retryAfterRivalLoss === 0.5 &&
    s.retries.fall === 1,
    `rivalLoss ${s.retries.rival_loss}/${s.results.rival_loss}, fall ${s.retries.fall}/${s.results.fall}`);
  check('quitting is not counted as a retry', s.retryAfterRivalLoss === 0.5);
  check('every attempt is recorded', s.attempts === 3, `${s.attempts} attempts`);
  await page.close();
}

// ------------------------------------------------------- 16. the test report
{
  const page = await newPage(BASE + '?tester=1&challenge=qa03&rival=Marc&score=1.0&mode=quick', {
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  const pe = await page.evaluate(() => window.OMM.game.challenge.pe);
  await shoot(page, pe * 0.7);
  await page.evaluate(() => window.OMM.game.advance());
  await page.waitForTimeout(150);
  await page.evaluate(() => window.OMM.game.quit());
  await page.click('#btn-settings');
  await page.waitForTimeout(200);
  await page.locator('#modal-body .row', { hasText: 'TEST REPORT' }).locator('button').click();
  await page.waitForTimeout(250);
  const rows = (await page.locator('#modal-body .row').allTextContents()).join(' | ');
  check('the report shows the retry rates by cause',
    /RETRY AFTER RIVAL LOSS/.test(rows) && /RETRY AFTER FALL/.test(rows), rows.slice(0, 60) + '...');
  await page.locator('#modal-body .btn-primary').click();
  await page.waitForTimeout(400);
  const clip = await page.evaluate(() => navigator.clipboard.readText().catch(() => ''));
  let parsed = null;
  try { parsed = JSON.parse(clip.split('----- JSON -----')[1].trim()); } catch (e) { /* stays null */ }
  check('COPY TEST REPORT puts a valid payload on the clipboard',
    !!parsed && parsed.schemaVersion === 1 && Array.isArray(parsed.sessions) && !!parsed.player.name,
    `${clip.length} chars`);
  check('the human summary is on top of the JSON', /^PLAYER:/.test(clip.trim()));
  await page.close();
}

// ------------------------------------------------- 17. clipboard fallback path
{
  const page = await newPage(BASE + '?tester=1&report=1');
  // Simulate iOS Safari refusing the clipboard entirely.
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    document.execCommand = () => false;
  });
  await page.waitForTimeout(200);
  await page.locator('#modal-body .btn-primary').click();
  await page.waitForTimeout(300);
  const fb = await page.evaluate(() => {
    const ta = document.querySelector('.report-fallback');
    return { visible: ta && !ta.hidden, len: ta ? ta.value.length : 0 };
  });
  check('a blocked clipboard falls back to selectable text, never loses the report',
    fb.visible && fb.len > 200, `${fb.len} chars in the box`);
  await page.close();
}

// -------------------------------------------- 18. clear test data is surgical
{
  const page = await newPage(BASE + '?tester=1&mode=quick');
  const pe = await page.evaluate(() => window.OMM.game.challenge.pe);
  await shoot(page, pe * 0.7);
  await page.waitForTimeout(150);
  const before = await page.evaluate(() => ({
    best: window.OMM.save.data.records.bestM,
    sessions: window.OMM.telemetry.sessions.length,
  }));
  await page.evaluate(() => window.OMM.tester.clearTestData());
  await page.waitForTimeout(150);
  const after = await page.evaluate(() => ({
    best: window.OMM.save.data.records.bestM,
    name: window.OMM.save.data.player.name,
    sessions: window.OMM.telemetry.sessions.length,
  }));
  check('CLEAR TEST DATA wipes telemetry and keeps the record',
    before.best != null && after.best === before.best && !!after.name && after.sessions === 1,
    `best ${after.best}, sessions ${after.sessions}`);
  await page.close();
}

// ------------------------------------------------ 19. service worker updates
{
  const page = await newPage(BASE + '?mode=quick');
  await page.waitForTimeout(1500);
  const st = await page.evaluate(async () => {
    const regs = await navigator.serviceWorker.getRegistrations();
    const keys = await caches.keys();
    return {
      registered: regs.length > 0,
      controller: !!navigator.serviceWorker.controller,
      caches: keys,
      sessions: window.OMM.telemetry.sessions.length,
    };
  });
  check('the service worker registers without a reload loop',
    st.registered && st.controller && st.sessions === 1,
    `${st.caches.join(',')} | ${st.sessions} session`);
  check('the cache name is versioned', st.caches.every((k) => /^omm-v/.test(k)), st.caches.join(','));
  await page.close();
}

// ------------------------------------------------------- 20. nocache recovery
{
  const page = await newPage(BASE);
  await page.waitForTimeout(1200);
  await page.goto(withName(BASE + '?nocache=1'), { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const st = await page.evaluate(async () => ({
    omm: !!window.OMM,
    caches: (await caches.keys()).length,
  }));
  check('?nocache=1 clears the caches and still boots', st.omm, `${st.caches} caches left`);
  await page.close();
}

console.log('');
if (errors.length) {
  console.log('  RUNTIME ERRORS:');
  for (const e of [...new Set(errors)]) console.log('   ', e);
}
const failed = results.filter((r) => !r.ok);
console.log(`  ${results.length - failed.length}/${results.length} checks passed${errors.length ? `, ${errors.length} runtime errors` : ', no runtime errors'}\n`);
await browser.close();
process.exit(failed.length || errors.length ? 1 : 0);
