/**
 * Physics + balance harness.
 *
 *   node tools/harness.mjs                    quick pass
 *   node tools/harness.mjs --shots 4000 --all every surface x object
 *   node tools/harness.mjs --surface ice --object phone
 *   node tools/harness.mjs --json out.json
 *
 * It answers the only questions that matter before testers touch the build:
 *   - how often do people fall?
 *   - what does a new player score, and what does an expert score?
 *   - does the third attempt actually get better than the first?
 *   - is the physics smooth, or are there cliffs that would feel unfair?
 */
import { createChallenge, launchSpeedFor, powerForMargin } from '../src/game/Challenge.js';
import { simulateShot } from '../src/physics/Simulation.js';
import { SURFACES } from '../src/config/surfaces.js';
import { OBJECTS } from '../src/config/objects.js';
import { GameConfig, zoneForMm } from '../src/config/GameConfig.js';
import { sensitivityMmPerMs } from '../src/physics/calibration.js';
import { mulberry32 } from '../src/core/rng.js';
import { writeFileSync } from 'node:fs';

const args = parseArgs(process.argv.slice(2));
const SHOTS = args.shots ? Number(args.shots) : 900;
const CHARGE = GameConfig.power.chargeMs;

/**
 * Player models.
 *   jitterMs  release timing noise (the human hand)
 *   biasMs    how wrong their read of this particular setup is on the first attempt
 *   aimSigmas how greedy they are: they aim this many standard deviations short of the
 *             brink, so the fall rate falls out of the model instead of being assumed
 *   learn     how much of the bias they remove after seeing where the last shot landed
 * Attempt 1 is played safe, attempt 3 is played for the win.
 */
const PLAYERS = [
  { id: 'new', name: 'NEW', jitterMs: 46, biasMs: 95, aimSigmas: 1.5, learn: 0.55 },
  { id: 'learning', name: 'LEARNING', jitterMs: 26, biasMs: 50, aimSigmas: 1.3, learn: 0.70 },
  { id: 'good', name: 'GOOD', jitterMs: 14, biasMs: 24, aimSigmas: 1.1, learn: 0.80 },
  { id: 'expert', name: 'EXPERT', jitterMs: 7, biasMs: 11, aimSigmas: 0.85, learn: 0.88 },
];
/** Greed per attempt: learn, close in, then go for it. */
const ATTEMPT_GREED = [2.0, 1.35, 1.0];

function normal(rng) {
  const u = Math.max(rng(), 1e-9);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}

/** One shot: convert intent into a hold time, add human noise, simulate honestly. */
function takeShot(ch, aimMm, errorMs, rng, jitterMs) {
  const aimMargin = Math.max(aimMm, 0.05) / 1000;
  const idealPower = powerForMargin(ch, aimMargin);
  const idealMs = idealPower * CHARGE;
  const heldMs = Math.max(0, idealMs + errorMs + normal(rng) * jitterMs);
  const power = Math.min(1, heldMs / CHARGE);
  const v0 = launchSpeedFor(ch, power);
  const real = simulateShot(ch.setup, v0, { derived: ch.derived });
  const ghost = simulateShot(ch.setup, v0, { derived: ch.derived, ignoreEdge: true });
  return {
    power, heldMs,
    fell: real.fell,
    mm: real.fell ? null : real.marginM * 1000,
    pastMm: real.fell ? (ghost.travelM - ch.travelToEdge) * 1000 : 0,
    hangMm: real.overhangM * 1000,
    timeS: real.timeS,
  };
}

/** A session of three attempts on one challenge, with the player learning as they go. */
function playRun(ch, player, rng) {
  let error = normal(rng) * player.biasMs;
  const shots = [];
  // How many millimetres a millisecond of slop is worth on THIS challenge.
  const mmPerMs = sensitivityMmPerMs(ch.pe, ch.surface);
  for (let i = 0; i < 3; i++) {
    const uncertaintyMs = Math.hypot(player.jitterMs, Math.abs(error) * 0.6);
    const aimMm = Math.max(0.15, uncertaintyMs * mmPerMs * player.aimSigmas * ATTEMPT_GREED[i]);
    const s = takeShot(ch, aimMm, error, rng, player.jitterMs);
    shots.push(s);
    // They saw where it landed and correct most of the systematic part.
    error *= 1 - player.learn;
    error += normal(rng) * player.biasMs * 0.12;
  }
  return shots;
}

function stats(values) {
  if (!values.length) return null;
  const v = values.slice().sort((a, b) => a - b);
  const q = (p) => v[Math.min(v.length - 1, Math.max(0, Math.round((v.length - 1) * p)))];
  return {
    n: v.length,
    min: v[0], max: v[v.length - 1],
    mean: v.reduce((a, b) => a + b, 0) / v.length,
    p10: q(0.1), p25: q(0.25), p50: q(0.5), p75: q(0.75), p90: q(0.9),
  };
}

function runPool(challenges, label) {
  const out = { label, players: {}, zones: {}, attempts: [[], [], []], falls: 0, shots: 0, nearMiss: 0, hangs: 0, durations: [] };
  for (const player of PLAYERS) {
    const rng = mulberry32(0xc0ffee ^ hash(player.id));
    const scores = [];
    let falls = 0, shots = 0, nearMiss = 0, best = Infinity;
    const runs = Math.max(1, Math.round(SHOTS / 3 / challenges.length));
    for (const ch of challenges) {
      for (let r = 0; r < runs; r++) {
        const run = playRun(ch, player, rng);
        run.forEach((s, i) => {
          shots++; out.shots++;
          out.durations.push(s.timeS);
          if (s.fell) {
            falls++; out.falls++;
            if (s.pastMm <= 4) { nearMiss++; out.nearMiss++; }
          } else {
            scores.push(s.mm);
            best = Math.min(best, s.mm);
            const z = zoneForMm(s.mm).id;
            out.zones[z] = (out.zones[z] || 0) + 1;
            if (s.hangMm > 0) out.hangs++;
            out.attempts[i].push(s.mm);
          }
        });
      }
    }
    out.players[player.id] = {
      name: player.name,
      shots,
      fallRate: falls / shots,
      nearMissRate: nearMiss / shots,
      best: best === Infinity ? null : best,
      dist: stats(scores),
      subMm: scores.filter((m) => m < 1).length / Math.max(1, scores.length),
      sub5: scores.filter((m) => m < 5).length / Math.max(1, scores.length),
      sub10: scores.filter((m) => m < 10).length / Math.max(1, scores.length),
    };
  }
  out.attemptMedians = out.attempts.map((a) => (stats(a) ? stats(a).p50 : null));
  out.durationStats = stats(out.durations);
  return out;
}

/** Sweeps power finely and looks for cliffs: a fair game must be smooth. */
function continuityScan(ch, steps = 900) {
  let worstJump = 0, worstAt = 0, nonMonotonic = 0;
  let prevTravel = -Infinity;
  const jumps = [];
  for (let i = 0; i <= steps; i++) {
    const p = i / steps;
    const v = launchSpeedFor(ch, p);
    const g = simulateShot(ch.setup, v, { derived: ch.derived, ignoreEdge: true });
    if (g.travelM < prevTravel - 1e-9) nonMonotonic++;
    if (prevTravel > -Infinity) {
      const jump = (g.travelM - prevTravel) * 1000;
      jumps.push(jump);
      if (jump > worstJump) { worstJump = jump; worstAt = p; }
    }
    prevTravel = g.travelM;
  }
  const mean = jumps.reduce((a, b) => a + b, 0) / jumps.length;
  return { worstJumpMm: worstJump, worstAt, meanStepMm: mean, ratio: worstJump / mean, nonMonotonic };
}

function hash(s) { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return h >>> 0; }
function pct(x) { return `${(x * 100).toFixed(1)}%`; }
function mm(x) { return x == null ? '  --  ' : `${x.toFixed(x < 1 ? 3 : x < 10 ? 2 : 1)}`; }

// --------------------------------------------------------------------- run it
const report = { generatedAt: new Date().toISOString(), shots: SHOTS, pools: [], continuity: [], sensitivity: [] };

const pools = [];
if (args.all) {
  for (const s of SURFACES) {
    const chs = OBJECTS.map((o, i) => createChallenge(`harness-${s.id}-${o.id}`, { surfaceId: s.id, objectId: o.id }));
    pools.push({ label: s.name, challenges: chs });
  }
} else if (args.surface || args.object) {
  const chs = [];
  for (let i = 0; i < 6; i++) chs.push(createChallenge(`harness-fixed-${i}`, { surfaceId: args.surface, objectId: args.object }));
  pools.push({ label: `${args.surface || 'any'}/${args.object || 'any'}`, challenges: chs });
} else {
  const chs = [];
  for (let i = 0; i < 12; i++) chs.push(createChallenge(`harness-mix-${i}`));
  pools.push({ label: 'MIXED (12 challenges)', challenges: chs });
}

console.log(`\n  ONE MORE MILLIMETER — balance harness   (${SHOTS} shots per player per pool)\n`);

for (const pool of pools) {
  const r = runPool(pool.challenges, pool.label);
  report.pools.push(r);
  console.log(`  ── ${r.label} ${'─'.repeat(Math.max(0, 46 - r.label.length))}`);
  console.log('  player     shots  falls   near   median    p25     p90     best   <10mm   <1mm');
  for (const p of PLAYERS) {
    const s = r.players[p.id];
    const d = s.dist || {};
    console.log(
      `  ${p.name.padEnd(9)} ${String(s.shots).padStart(6)}  ${pct(s.fallRate).padStart(5)}  ${pct(s.nearMissRate).padStart(5)}` +
      `  ${mm(d.p50).padStart(7)} ${mm(d.p25).padStart(6)} ${mm(d.p90).padStart(7)} ${mm(s.best).padStart(8)}` +
      `  ${pct(s.sub10).padStart(6)} ${pct(s.subMm).padStart(6)}`
    );
  }
  console.log(`  attempt medians (1/2/3): ${r.attemptMedians.map((x) => mm(x)).join('  ')} mm` +
    `   |  overhangs ${pct(r.hangs / Math.max(1, r.shots))}  |  slide ${r.durationStats.p50.toFixed(2)}s`);
  const zoneLine = GameConfig.zones.map((z) => `${z.name.slice(0, 4)} ${r.zones[z.id] || 0}`).join('  ');
  console.log(`  zones: ${zoneLine}\n`);
}

console.log('  ── CONTINUITY (a fair game has no cliffs) ─────────────────');
for (const s of SURFACES) {
  const ch = createChallenge(`cont-${s.id}`, { surfaceId: s.id, objectId: 'puck' });
  const c = continuityScan(ch, args.all ? 900 : 300);
  report.continuity.push({ surface: s.id, ...c });
  const ok = c.nonMonotonic === 0 && c.ratio < 6;
  console.log(`  ${s.name.padEnd(7)} step ${c.meanStepMm.toFixed(3)}mm  worst ${c.worstJumpMm.toFixed(3)}mm @p${c.worstAt.toFixed(2)}` +
    `  ratio ${c.ratio.toFixed(2)}  nonmono ${c.nonMonotonic}  ${ok ? 'OK' : 'CHECK'}`);
}

console.log('\n  ── SENSITIVITY (mm of result per ms of hold, at the brink) ─');
for (const s of SURFACES) {
  const lo = sensitivityMmPerMs(GameConfig.window.edgePowerMin, s);
  const hi = sensitivityMmPerMs(GameConfig.window.edgePowerMax, s);
  report.sensitivity.push({ surface: s.id, easiest: hi, hardest: lo });
  console.log(`  ${s.name.padEnd(7)} ${hi.toFixed(4)} .. ${lo.toFixed(4)}   (10 ms of slop = ${(hi * 10).toFixed(2)}..${(lo * 10).toFixed(2)} mm)`);
}

if (args.json) {
  writeFileSync(args.json, JSON.stringify(report, null, 1));
  console.log(`\n  wrote ${args.json}`);
}
console.log('');

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) out[key] = true;
    else { out[key] = next; i++; }
  }
  return out;
}
