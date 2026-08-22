/**
 * Aggregates tester reports pasted back over WhatsApp.
 *
 *   node tools/summarize-tester-reports.mjs reports/*.json
 *   cat one-report.txt | node tools/summarize-tester-reports.mjs
 *
 * Input can be either the raw JSON, or the whole pasted block (human summary +
 * "----- JSON -----" + JSON) exactly as COPY TEST REPORT produces it.
 *
 * It NEVER invents a number. Missing data is reported as missing, corrupt files
 * are counted and named, and a rate with no denominator prints as "n/a" rather
 * than 0%.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);

// ------------------------------------------------------------------- loading
function extractJson(text) {
  const marker = text.indexOf('----- JSON -----');
  const body = marker >= 0 ? text.slice(marker + '----- JSON -----'.length) : text;
  const start = body.indexOf('{');
  if (start < 0) return null;
  // Walk braces so trailing chat noise ("nice one 😄") cannot break the parse.
  let depth = 0;
  for (let i = start; i < body.length; i++) {
    if (body[i] === '{') depth++;
    else if (body[i] === '}') {
      depth--;
      if (depth === 0) {
        try { return JSON.parse(body.slice(start, i + 1)); } catch (e) { return null; }
      }
    }
  }
  return null;
}

function expand(paths) {
  const out = [];
  for (const p of paths) {
    try {
      if (statSync(p).isDirectory()) {
        for (const f of readdirSync(p)) {
          if (/\.(json|txt)$/i.test(f)) out.push(join(p, f));
        }
      } else out.push(p);
    } catch (e) { out.push(p); }
  }
  return out;
}

async function readStdin() {
  if (process.stdin.isTTY) return '';
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  return Buffer.concat(chunks).toString('utf8');
}

// ------------------------------------------------------------------ analysis
const RESULT_TYPES = ['fall', 'near_miss_fall', 'rival_loss', 'rival_win', 'personal_best', 'personal_miss', 'normal_stop'];

function blankBucket() {
  return {
    players: new Set(),
    sessions: 0,
    attempts: 0,
    durations: [],
    falls: 0,
    nearMissFalls: 0,
    personalBests: 0,
    rivalsBeaten: 0,
    bests: [],
    results: Object.fromEntries(RESULT_TYPES.map((t) => [t, 0])),
    retries: Object.fromEntries(RESULT_TYPES.map((t) => [t, 0])),
    retryDelays: [],
  };
}

function addSession(bucket, s, playerName) {
  const sum = s.summary;
  if (!sum) return false;
  bucket.players.add(playerName || 'unknown');
  bucket.sessions++;
  bucket.attempts += sum.attempts || 0;
  if (Number.isFinite(sum.durationMs)) bucket.durations.push(sum.durationMs);
  bucket.falls += sum.falls || 0;
  bucket.nearMissFalls += sum.nearMissFalls || 0;
  bucket.personalBests += sum.personalBests || 0;
  bucket.rivalsBeaten += sum.rivalsBeaten || 0;
  if (Number.isFinite(sum.bestMm)) bucket.bests.push(sum.bestMm);
  for (const t of RESULT_TYPES) {
    bucket.results[t] += (sum.results && sum.results[t]) || 0;
    bucket.retries[t] += (sum.retries && sum.retries[t]) || 0;
  }
  for (const d of s.retryDelays || []) bucket.retryDelays.push(d.delayMs);
  return true;
}

const median = (a) => {
  const v = a.filter(Number.isFinite).sort((x, y) => x - y);
  return v.length ? v[Math.floor(v.length / 2)] : null;
};
const pct = (n, d) => (d ? `${((n / d) * 100).toFixed(0)}%` : 'n/a');
const num = (v, dp = 2) => (Number.isFinite(v) ? v.toFixed(dp) : 'n/a');
const dur = (ms) => (Number.isFinite(ms) ? `${Math.floor(ms / 60000)}m${String(Math.round((ms % 60000) / 1000)).padStart(2, '0')}s` : 'n/a');

function printBucket(label, b) {
  if (!b.sessions) {
    console.log(`\n  ${label}: no sessions`);
    return;
  }
  const fallTotal = b.results.fall + b.results.near_miss_fall;
  const fallRetry = b.retries.fall + b.retries.near_miss_fall;
  console.log(`\n  ${label}`);
  console.log(`  ${'-'.repeat(52)}`);
  console.log(`  players                 ${b.players.size}`);
  console.log(`  sessions                ${b.sessions}`);
  console.log(`  attempts                ${b.attempts}`);
  console.log(`  attempts / session      ${num(b.attempts / b.sessions, 1)}`);
  console.log(`  median session          ${dur(median(b.durations))}`);
  console.log(`  fall rate               ${pct(b.falls, b.attempts)}`);
  console.log(`  near miss falls         ${b.nearMissFalls}`);
  console.log(`  best score seen         ${b.bests.length ? `${Math.min(...b.bests).toFixed(3)} mm` : 'n/a'}`);
  console.log(`  personal bests          ${b.personalBests}`);
  console.log(`  rivals beaten           ${b.rivalsBeaten}`);
  console.log('');
  console.log(`  RETRY AFTER FALL        ${pct(fallRetry, fallTotal)}   (${fallRetry}/${fallTotal})`);
  console.log(`  RETRY AFTER RIVAL LOSS  ${pct(b.retries.rival_loss, b.results.rival_loss)}   (${b.retries.rival_loss}/${b.results.rival_loss})`);
  console.log(`  RETRY AFTER RIVAL WIN   ${pct(b.retries.rival_win, b.results.rival_win)}   (${b.retries.rival_win}/${b.results.rival_win})`);
  console.log(`  RETRY AFTER PB          ${pct(b.retries.personal_best, b.results.personal_best)}   (${b.retries.personal_best}/${b.results.personal_best})`);
  console.log(`  RETRY AFTER PB MISS     ${pct(b.retries.personal_miss, b.results.personal_miss)}   (${b.retries.personal_miss}/${b.results.personal_miss})`);
  console.log(`  RETRY AFTER NORMAL STOP ${pct(b.retries.normal_stop, b.results.normal_stop)}   (${b.retries.normal_stop}/${b.results.normal_stop})`);
  console.log(`  median retry delay      ${median(b.retryDelays) == null ? 'n/a' : `${median(b.retryDelays)} ms`}`);
}

// ---------------------------------------------------------------------- main
const files = expand(args);
const reports = [];
const problems = [];

for (const f of files) {
  let text;
  try { text = readFileSync(f, 'utf8'); }
  catch (e) { problems.push(`${f}: unreadable (${e.code || e.message})`); continue; }
  const json = extractJson(text);
  if (!json) { problems.push(`${f}: no JSON payload found`); continue; }
  if (json.schemaVersion !== 1) problems.push(`${f}: schemaVersion ${json.schemaVersion} (expected 1)`);
  if (!Array.isArray(json.sessions)) { problems.push(`${f}: no sessions array`); continue; }
  reports.push({ file: f, json });
}

if (!files.length) {
  const stdin = await readStdin();
  const json = stdin && extractJson(stdin);
  if (json) reports.push({ file: '<stdin>', json });
}

if (!reports.length) {
  console.log('\n  No usable reports.\n  Usage: node tools/summarize-tester-reports.mjs <files or dir>\n');
  if (problems.length) problems.forEach((p) => console.log('   !', p));
  process.exit(1);
}

const all = blankBucket();
const arms = { solo: blankBucket(), rival: blankBucket() };
const perPlayer = new Map();
let skippedSessions = 0;

for (const { file, json } of reports) {
  const name = (json.player && json.player.name) || 'unknown';
  for (const s of json.sessions) {
    if (!s || !s.summary) { skippedSessions++; problems.push(`${file}: a session had no summary`); continue; }
    if (!s.summary.attempts) { skippedSessions++; continue; } // opened the game, never played
    addSession(all, s, name);
    addSession(arms[s.arm === 'rival' ? 'rival' : 'solo'], s, name);
    if (!perPlayer.has(name)) perPlayer.set(name, blankBucket());
    addSession(perPlayer.get(name), s, name);
  }
}

console.log('\n  ONE MORE MILLIMETER - tester report summary');
console.log(`  ${reports.length} report file(s), ${all.sessions} session(s) with data` +
  (skippedSessions ? `, ${skippedSessions} empty/unusable session(s) skipped` : ''));

printBucket('ALL', all);
printBucket('SOLO (no rival)', arms.solo);
printBucket('RIVAL', arms.rival);

console.log('\n  PER PLAYER');
console.log(`  ${'player'.padEnd(14)} ${'sess'.padStart(4)} ${'att'.padStart(4)} ${'att/s'.padStart(6)} ${'best'.padStart(8)} ${'fall%'.padStart(6)} ${'retry@rivalloss'.padStart(16)}`);
for (const [name, b] of perPlayer) {
  console.log(`  ${name.slice(0, 14).padEnd(14)} ${String(b.sessions).padStart(4)} ${String(b.attempts).padStart(4)}` +
    ` ${num(b.attempts / b.sessions, 1).padStart(6)} ${(b.bests.length ? Math.min(...b.bests).toFixed(3) : 'n/a').padStart(8)}` +
    ` ${pct(b.falls, b.attempts).padStart(6)} ${pct(b.retries.rival_loss, b.results.rival_loss).padStart(16)}`);
}

if (problems.length) {
  console.log('\n  DATA PROBLEMS (not silently ignored)');
  for (const p of [...new Set(problems)]) console.log('   !', p);
}
console.log('');
