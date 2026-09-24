/**
 * Moto y piloto en vectores.
 *
 * La moto se dibuja en coordenadas LOCALES del chasis (metros, Y arriba,
 * X hacia delante). Las ruedas salen de la fisica (compresion de cada
 * suspension y giro acumulado): la horquilla se hunde de verdad, el
 * basculante sube, el muelle del amortiguador se comprime y los radios giran
 * a la velocidad real de la rueda.
 *
 * El piloto es un esqueleto con cinematica inversa de dos huesos: pies
 * clavados en las estriberas, manos en los puños. Su cadera y su torso son
 * muelles amortiguados que persiguen una pose objetivo calculada con el
 * cuerpo (atras/adelante), la aceleracion, el frenazo, la compresion y el
 * vuelo. El retraso del muelle es lo que le da vida: se hunde al aterrizar,
 * se echa atras al acelerar y se encoge al girar en el aire.
 */
import { Vec2, clamp, makeRng } from '../core/math';
import { mix } from './color';
import { BIKE, BikeState, isAirborne } from '../physics/bike';

const TAU = Math.PI * 2;
const R = BIKE.wheelRadius;

export const LIVERY = {
  plastic: '#ff5a1f',
  plasticDark: '#c63d10',
  white: '#f5f4ef',
  graphic: '#16181f',
  frame: '#aeb8c4',
  engine: '#3a3d44',
  engineHi: '#7d838d',
  metal: '#c9ced6',
  seat: '#17181c',
  stanchion: '#e0b04a',
  forkLeg: '#1f2a44',
  spring: '#ffd23a',
  rim: '#20242c',
  spoke: '#b9c0ca',
  tire: '#121215',
  jersey: '#ff5a1f',
  jerseyDark: '#b83c0f',
  jerseyAlt: '#1c2030',
  pants: '#20232c',
  pantsHi: '#ff7a44',
  boot: '#f0f0ec',
  bootDark: '#9a9ea8',
  glove: '#1c2030',
  helmet: '#f7f6f0',
  helmetStripe: '#ff5a1f',
  goggle: '#35d6ff',
  number: '77',
};

export type Livery = typeof LIVERY;

const RIDER_COLORS: Record<string, { main: string; dark: string; alt: string; lens: string }> = {
  orange: { main: '#ff5a1f', dark: '#c63d10', alt: '#1c2030', lens: '#35d6ff' },
  blue: { main: '#2f7df6', dark: '#1c55b8', alt: '#f2f2ee', lens: '#ffcf3f' },
  green: { main: '#3fbf5a', dark: '#23863a', alt: '#15171d', lens: '#ff7ad9' },
  yellow: { main: '#ffcf1f', dark: '#c99a0a', alt: '#1b1d25', lens: '#5fe0ff' },
  purple: { main: '#8a4dff', dark: '#5e2cc4', alt: '#f2f2ee', lens: '#7dffb0' },
  // Decoraciones especiales (se desbloquean).
  gold: { main: '#e0b12e', dark: '#9c7512', alt: '#15171d', lens: '#ff5a1f' },
  neon: { main: '#ff2fa8', dark: '#b3106f', alt: '#1a1d26', lens: '#3dfcff' },
  carbon: { main: '#2c2f36', dark: '#16181c', alt: '#ff5a1f', lens: '#ffd23a' },
};

/** Libreria de colores de un piloto; `fog` lo aclara hacia `fogColor` (carriles del fondo). */
export function makeLivery(colors: string, number: string, fog = 0, fogColor = '#888888'): Livery {
  const c = RIDER_COLORS[colors] ?? RIDER_COLORS.orange;
  const base: Livery = {
    ...LIVERY,
    plastic: c.main,
    plasticDark: c.dark,
    jersey: c.main,
    jerseyDark: c.dark,
    jerseyAlt: c.alt,
    pantsHi: c.main,
    helmetStripe: c.main,
    goggle: c.lens,
    number,
  };
  if (fog <= 0) return base;
  const out = { ...base } as Record<string, string>;
  for (const [k, v] of Object.entries(base)) if (typeof v === 'string' && v.startsWith('#')) out[k] = mix(v, fogColor, fog);
  return out as Livery;
}

/** Estilo del piloto que se esta dibujando (colores, niebla y barro). */
let L: Livery = LIVERY;
let fogAmount = 0;
let fogTo = '#888888';
let mudLevel = 0;
let mudColor = '#4a3020';
function T(hex: string): string {
  return fogAmount > 0 ? mix(hex, fogTo, fogAmount) : hex;
}

export interface RiderStyle {
  livery: Livery;
  fog: number;
  fogColor: string;
  /** Barro acumulado 0..1 y su color. */
  mud: number;
  mudColor: string;
  seed: number;
}

export function setStyle(st: RiderStyle | null): void {
  L = st?.livery ?? LIVERY;
  fogAmount = st?.fog ?? 0;
  fogTo = st?.fogColor ?? '#888888';
  mudLevel = st?.mud ?? 0;
  mudColor = st?.mudColor ?? '#4a3020';
  mudSeed = st?.seed ?? 1;
}
let mudSeed = 1;

interface Splat {
  /** Donde va: pieza fija de la moto (x,y locales) o hueso del piloto (u a lo largo, v de lado). */
  bone: 'bike' | 'shin' | 'thigh' | 'boot' | 'torso' | 'forearm';
  x: number;
  y: number;
  r: number;
  /** Nivel de barro a partir del cual aparece. */
  at: number;
  blobs: Array<[number, number, number]>;
}

const splatCache = new Map<number, Splat[]>();

/** Manchas de barro deterministas por piloto: salen poco a poco segun el nivel. */
function splatsFor(seed: number): Splat[] {
  const hit = splatCache.get(seed);
  if (hit) return hit;
  const rnd = makeRng(Math.floor(seed * 1000) + 17);
  const out: Splat[] = [];
  const add = (bone: Splat['bone'], x: number, y: number, r: number): void => {
    const blobs: Array<[number, number, number]> = [];
    const n = 2 + Math.floor(rnd() * 3);
    for (let i = 0; i < n; i++) blobs.push([(rnd() - 0.5) * r * 1.4, (rnd() - 0.5) * r, r * (0.45 + rnd() * 0.55)]);
    out.push({ bone, x, y, r, at: rnd(), blobs });
  };
  // Moto: guardabarros, lateral, motor, basculante, horquilla, cubrecarter.
  for (let i = 0; i < 9; i++) add('bike', -1.1 + rnd() * 0.55, 0.42 + rnd() * 0.1, 0.035 + rnd() * 0.03);
  for (let i = 0; i < 8; i++) add('bike', -0.7 + rnd() * 0.5, 0.15 + rnd() * 0.22, 0.03 + rnd() * 0.035);
  for (let i = 0; i < 8; i++) add('bike', -0.1 + rnd() * 0.42, -0.26 + rnd() * 0.3, 0.035 + rnd() * 0.035);
  for (let i = 0; i < 6; i++) add('bike', -0.6 + rnd() * 0.5, -0.15 + rnd() * 0.12, 0.03 + rnd() * 0.03);
  for (let i = 0; i < 6; i++) add('bike', 0.3 + rnd() * 0.6, 0.28 + rnd() * 0.08, 0.03 + rnd() * 0.03);
  for (let i = 0; i < 5; i++) add('bike', 0.1 + rnd() * 0.3, 0.05 + rnd() * 0.35, 0.03 + rnd() * 0.03);
  // Piloto: botas, espinillas, muslos, espalda baja, antebrazo.
  for (let i = 0; i < 8; i++) add('boot', rnd(), (rnd() - 0.5) * 0.08, 0.03 + rnd() * 0.03);
  for (let i = 0; i < 7; i++) add('shin', rnd(), (rnd() - 0.5) * 0.1, 0.03 + rnd() * 0.03);
  for (let i = 0; i < 6; i++) add('thigh', rnd(), (rnd() - 0.5) * 0.1, 0.03 + rnd() * 0.03);
  for (let i = 0; i < 6; i++) add('torso', rnd() * 0.5, (rnd() - 0.7) * 0.2, 0.03 + rnd() * 0.035);
  for (let i = 0; i < 3; i++) add('forearm', rnd(), (rnd() - 0.5) * 0.06, 0.025 + rnd() * 0.02);
  splatCache.set(seed, out);
  return out;
}

function drawSplat(ctx: CanvasRenderingContext2D, x: number, y: number, sp: Splat): void {
  ctx.fillStyle = T(mudColor);
  ctx.beginPath();
  for (const [bx, by, br] of sp.blobs) {
    ctx.moveTo(x + bx + br, y + by);
    ctx.arc(x + bx, y + by, br, 0, TAU);
  }
  ctx.fill();
  // Brillo de barro mojado.
  ctx.fillStyle = 'rgba(255,240,220,0.18)';
  const [bx, by, br] = sp.blobs[0];
  ctx.beginPath();
  ctx.arc(x + bx - br * 0.3, y + by + br * 0.3, br * 0.3, 0, TAU);
  ctx.fill();
}

function drawBikeMud(ctx: CanvasRenderingContext2D): void {
  if (mudLevel <= 0.02) return;
  for (const sp of splatsFor(mudSeed)) if (sp.bone === 'bike' && sp.at < mudLevel) drawSplat(ctx, sp.x, sp.y, sp);
}

function along(a: Vec2, b: Vec2, u: number, v: number): Vec2 {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: a.x + dx * u - (dy / len) * v, y: a.y + dy * u + (dx / len) * v };
}

function drawRiderMud(ctx: CanvasRenderingContext2D, p: RiderPose): void {
  if (mudLevel <= 0.02) return;
  for (const sp of splatsFor(mudSeed)) {
    if (sp.bone === 'bike' || sp.at >= mudLevel) continue;
    let q: Vec2;
    if (sp.bone === 'boot') q = along({ x: p.knee.x + (p.ankle.x - p.knee.x) * 0.4, y: p.knee.y + (p.ankle.y - p.knee.y) * 0.4 }, p.toe, sp.x, sp.y);
    else if (sp.bone === 'shin') q = along(p.knee, p.ankle, sp.x, sp.y);
    else if (sp.bone === 'thigh') q = along(p.hip, p.knee, 0.3 + sp.x * 0.7, sp.y);
    else if (sp.bone === 'torso') q = along(p.hip, p.shoulder, sp.x, sp.y);
    else q = along(p.elbow, p.hand, sp.x, sp.y);
    drawSplat(ctx, q.x, q.y, sp);
  }
}

// Geometria fija del chasis (local).
const PIVOT: Vec2 = { x: -0.08, y: 0.02 };
const SHOCK_TOP: Vec2 = { x: -0.2, y: 0.4 };
const GRIP: Vec2 = { x: 0.3, y: 0.72 };
const PEG: Vec2 = { x: -0.12, y: -0.2 };
const EXHAUST_TIP: Vec2 = { x: -1.0, y: 0.37 };

export function wheelLocal(b: BikeState, which: 'rear' | 'front'): Vec2 {
  const geo = BIKE[which];
  const l = geo.rest - b[which].comp;
  return { x: geo.anchor.x + geo.axis.x * l, y: geo.anchor.y + geo.axis.y * l };
}

/** Punta del escape en el mundo (para la llama del nitro). */
export function exhaustTipWorld(b: { x: number; y: number; angle: number }): Vec2 {
  const c = Math.cos(b.angle);
  const s = Math.sin(b.angle);
  return { x: b.x + EXHAUST_TIP.x * c - EXHAUST_TIP.y * s, y: b.y + EXHAUST_TIP.x * s + EXHAUST_TIP.y * c };
}

// ---------------------------------------------------------------------------
// Rig del piloto
// ---------------------------------------------------------------------------

export interface RiderPose {
  hip: Vec2;
  knee: Vec2;
  ankle: Vec2;
  toe: Vec2;
  shoulder: Vec2;
  elbow: Vec2;
  hand: Vec2;
  head: Vec2;
  headAngle: number;
  /** Pierna y brazo del lado lejano (algo desplazados). */
  farKnee: Vec2;
  farAnkle: Vec2;
  farToe: Vec2;
  farElbow: Vec2;
  farHand: Vec2;
}

const THIGH = 0.44;
const SHIN = 0.45;
const UPPER_ARM = 0.31;
const FOREARM = 0.31;
const TORSO = 0.5;

/** Articulacion intermedia de una cadena de dos huesos. bend +1 = hacia delante/arriba. */
export function ik2(a: Vec2, b: Vec2, l1: number, l2: number, bend: number): Vec2 {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = clamp(Math.hypot(dx, dy), 1e-4, l1 + l2 - 1e-4);
  const cosA = clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1);
  const ang = Math.atan2(dy, dx) + bend * Math.acos(cosA);
  return { x: a.x + Math.cos(ang) * l1, y: a.y + Math.sin(ang) * l1 };
}

function reach(from: Vec2, to: Vec2, max: number): Vec2 {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const d = Math.hypot(dx, dy);
  if (d <= max) return to;
  return { x: from.x + (dx / d) * max, y: from.y + (dy / d) * max };
}

export class RiderRig {
  hx = -0.38;
  hy = 0.55;
  private vhx = 0;
  private vhy = 0;
  torso = 0.86;
  private vtorso = 0;
  private tuck = 0;
  private t = 0;

  reset(): void {
    this.hx = -0.38;
    this.hy = 0.55;
    this.vhx = 0;
    this.vhy = 0;
    this.torso = 0.86;
    this.vtorso = 0;
    this.tuck = 0;
  }

  /** Golpe de recepcion: el piloto absorbe con las piernas. */
  land(airTime: number, rough: boolean): void {
    this.vhy -= Math.min(2.8, 0.5 + airTime * 0.7) * (rough ? 1.4 : 1);
    this.vtorso += rough ? 1.5 : 0.6;
  }

  update(dt: number, b: BikeState): void {
    this.t += dt;
    const air = isAirborne(b);
    const lean = b.lean; // +1 atras
    const comp = (b.rear.comp + b.front.comp) * 0.5;
    const accel = clamp(b.accel, -25, 25);
    const spinning = air && Math.abs(b.omega) > 2.5;
    this.tuck += ((spinning ? 1 : 0) - this.tuck) * (1 - Math.exp(-dt * 8));

    let tx = -0.38 - lean * (lean > 0 ? 0.2 : 0.13) - accel * 0.006 - b.brake * 0.07;
    let ty = 0.53 - comp * 0.75 - Math.abs(lean) * 0.05 - Math.max(0, lean) * 0.06;
    let tt = 0.86 - lean * (lean > 0 ? 0.5 : 0.3) - accel * 0.008 + b.brake * 0.1;
    if (air) {
      ty += 0.06;
      tt += 0.05;
    }
    // Encogido para girar.
    tx += this.tuck * 0.06;
    ty -= this.tuck * 0.14;
    tt += this.tuck * 0.35;
    // Respiracion y vibracion del motor.
    ty += Math.sin(this.t * 2.1) * 0.006 + (air ? 0 : Math.sin(this.t * 43) * 0.003 * b.throttle);

    const k = 170;
    const c = 15;
    this.vhx += (-(this.hx - tx) * k - this.vhx * c) * dt;
    this.vhy += (-(this.hy - ty) * k - this.vhy * c) * dt;
    this.vtorso += (-(this.torso - tt) * 95 - this.vtorso * 12) * dt;
    this.hx += this.vhx * dt;
    this.hy += this.vhy * dt;
    this.torso += this.vtorso * dt;
    this.hx = clamp(this.hx, -0.72, -0.12);
    this.hy = clamp(this.hy, 0.3, 0.7);
    this.torso = clamp(this.torso, -0.1, 1.25);
  }

  pose(): RiderPose {
    const hip = { x: this.hx, y: this.hy };
    let shoulder = { x: hip.x + Math.sin(this.torso) * TORSO, y: hip.y + Math.cos(this.torso) * TORSO };
    // Si los brazos no llegan al manillar, el torso se inclina lo necesario.
    shoulder = reach(GRIP, shoulder, (UPPER_ARM + FOREARM) * 0.97);
    const hipFixed = reach(PEG, hip, (THIGH + SHIN) * 0.99);
    const ankle = { x: PEG.x - 0.04, y: PEG.y + 0.1 };
    const knee = ik2(hipFixed, ankle, THIGH, SHIN, 1);
    const elbow = ik2(shoulder, GRIP, UPPER_ARM, FOREARM, -1);
    const neckDir = this.torso * 0.45;
    const head = { x: shoulder.x + Math.sin(neckDir) * 0.17 + 0.03, y: shoulder.y + Math.cos(neckDir) * 0.17 };
    const farAnkle = { x: ankle.x + 0.05, y: ankle.y + 0.01 };
    const farHand = { x: GRIP.x + 0.02, y: GRIP.y + 0.01 };
    return {
      hip: hipFixed,
      knee,
      ankle,
      toe: { x: PEG.x + 0.2, y: PEG.y + 0.02 },
      shoulder,
      elbow,
      hand: GRIP,
      head,
      headAngle: -this.torso * 0.25,
      farKnee: ik2(hipFixed, farAnkle, THIGH, SHIN, 1),
      farAnkle,
      farToe: { x: PEG.x + 0.25, y: PEG.y + 0.03 },
      farElbow: ik2(shoulder, farHand, UPPER_ARM, FOREARM, -1),
      farHand,
    };
  }
}

/** Pose de muñeco de trapo para las caidas (coordenadas locales del cuerpo). */
export function flailPose(t: number): RiderPose {
  const s = (f: number, p: number): number => Math.sin(t * f + p);
  const hip = { x: 0, y: 0 };
  const shoulder = { x: 0.1, y: TORSO };
  const hand = { x: 0.35 + s(9, 0) * 0.2, y: 0.55 + s(7, 1) * 0.3 };
  const ankle = { x: -0.25 + s(8, 2) * 0.3, y: -0.7 + s(6, 3) * 0.15 };
  const farHand = { x: -0.2 + s(10, 4) * 0.2, y: 0.3 + s(8, 5) * 0.3 };
  const farAnkle = { x: 0.3 + s(7, 6) * 0.25, y: -0.6 + s(9, 7) * 0.15 };
  return {
    hip,
    knee: ik2(hip, ankle, THIGH, SHIN, 1),
    ankle,
    toe: { x: ankle.x + 0.2, y: ankle.y - 0.05 },
    shoulder,
    elbow: ik2(shoulder, hand, UPPER_ARM, FOREARM, -1),
    hand,
    head: { x: 0.15, y: TORSO + 0.2 },
    headAngle: 0,
    farKnee: ik2(hip, farAnkle, THIGH, SHIN, 1),
    farAnkle,
    farToe: { x: farAnkle.x + 0.2, y: farAnkle.y - 0.05 },
    farElbow: ik2(shoulder, farHand, UPPER_ARM, FOREARM, -1),
    farHand,
  };
}

// ---------------------------------------------------------------------------
// Dibujo
// ---------------------------------------------------------------------------

function limb(ctx: CanvasRenderingContext2D, a: Vec2, b: Vec2, w: number, color: string): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}

function poly(ctx: CanvasRenderingContext2D, pts: number[], color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
  ctx.fill();
}

function drawWheel(ctx: CanvasRenderingContext2D, c: Vec2, spin: number, spinRate: number, front: boolean): void {
  const fast = Math.abs(spinRate * R) > 11;
  ctx.save();
  ctx.translate(c.x, c.y);
  // Neumatico.
  ctx.fillStyle = L.tire;
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, TAU);
  ctx.fill();
  ctx.rotate(-spin);
  // Tacos del neumatico.
  if (fast) {
    ctx.strokeStyle = 'rgba(60,60,64,0.9)';
    ctx.lineWidth = 0.035;
    ctx.setLineDash([0.03, 0.05]);
    ctx.beginPath();
    ctx.arc(0, 0, R + 0.005, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
  } else {
    ctx.fillStyle = T('#26262b');
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * TAU;
      ctx.save();
      ctx.rotate(a);
      ctx.fillRect(R - 0.02, -0.022, 0.045, 0.044);
      ctx.restore();
    }
  }
  // Barro pegado a los tacos.
  if (mudLevel > 0.15) {
    ctx.strokeStyle = T(mudColor);
    ctx.lineWidth = 0.05;
    const n = Math.floor(mudLevel * 7);
    for (let i = 0; i < n; i++) {
      const a0 = (i / 7) * TAU + mudSeed;
      ctx.beginPath();
      ctx.arc(0, 0, R - 0.01, a0, a0 + 0.35 + mudLevel * 0.3);
      ctx.stroke();
    }
  }
  // Flanco con letras (rayitas claras que delatan el giro).
  ctx.strokeStyle = 'rgba(200,200,205,0.35)';
  ctx.lineWidth = 0.015;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(0, 0, R - 0.045, (i / 3) * TAU, (i / 3) * TAU + 0.5);
    ctx.stroke();
  }
  // Llanta.
  ctx.strokeStyle = L.rim;
  ctx.lineWidth = 0.035;
  ctx.beginPath();
  ctx.arc(0, 0, R - 0.085, 0, TAU);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 0.008;
  ctx.beginPath();
  ctx.arc(0, 0, R - 0.1, 0, TAU);
  ctx.stroke();
  // Radios.
  ctx.strokeStyle = fast ? 'rgba(185,192,202,0.28)' : L.spoke;
  ctx.lineWidth = 0.009;
  ctx.beginPath();
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU;
    const b = a + (i % 2 ? 0.5 : -0.5);
    ctx.moveTo(Math.cos(a) * 0.045, Math.sin(a) * 0.045);
    ctx.lineTo(Math.cos(b) * (R - 0.1), Math.sin(b) * (R - 0.1));
  }
  ctx.stroke();
  if (fast) {
    ctx.fillStyle = 'rgba(185,192,202,0.12)';
    ctx.beginPath();
    ctx.arc(0, 0, R - 0.1, 0, TAU);
    ctx.fill();
  }
  // Disco de freno.
  const dr = front ? 0.135 : 0.105;
  ctx.strokeStyle = T('#a7aeb8');
  ctx.lineWidth = 0.028;
  ctx.beginPath();
  ctx.arc(0, 0, dr, 0, TAU);
  ctx.stroke();
  ctx.fillStyle = T('#5a606a');
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * dr, Math.sin(a) * dr, 0.009, 0, TAU);
    ctx.fill();
  }
  // Buje.
  ctx.fillStyle = T('#d6dbe2');
  ctx.beginPath();
  ctx.arc(0, 0, 0.045, 0, TAU);
  ctx.fill();
  ctx.fillStyle = T('#50565f');
  ctx.beginPath();
  ctx.arc(0, 0, 0.018, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawRiderFar(ctx: CanvasRenderingContext2D, p: RiderPose): void {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  limb(ctx, p.hip, p.farKnee, 0.14, T('#15171d'));
  limb(ctx, p.farKnee, p.farAnkle, 0.12, T('#15171d'));
  limb(ctx, p.farAnkle, p.farToe, 0.09, L.bootDark);
  limb(ctx, p.shoulder, p.farElbow, 0.1, L.jerseyDark);
  limb(ctx, p.farElbow, p.farHand, 0.085, T('#121420'));
}

function drawRiderNear(ctx: CanvasRenderingContext2D, p: RiderPose): void {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // Torso: camiseta con peto.
  const dx = p.shoulder.x - p.hip.x;
  const dy = p.shoulder.y - p.hip.y;
  const len = Math.hypot(dx, dy);
  const nx = -dy / len;
  const ny = dx / len;
  const back = (s: number): Vec2 => ({ x: p.hip.x + dx * s - nx * 0.15, y: p.hip.y + dy * s - ny * 0.15 });
  const front = (s: number, w: number): Vec2 => ({ x: p.hip.x + dx * s + nx * w, y: p.hip.y + dy * s + ny * w });
  const b0 = back(-0.05);
  const b1 = back(1.02);
  const f1 = front(0.95, 0.15);
  const f0 = front(-0.05, 0.12);
  poly(ctx, [b0.x, b0.y, b1.x, b1.y, f1.x, f1.y, f0.x, f0.y], L.jersey);
  // Franja y numero en la espalda.
  const s0 = back(0.35);
  const s1 = back(0.8);
  const s2 = front(0.8, 0.02);
  const s3 = front(0.35, 0.0);
  poly(ctx, [s0.x, s0.y, s1.x, s1.y, s2.x, s2.y, s3.x, s3.y], L.jerseyAlt);
  const bl = back(0.2);
  const fl = front(0.2, 0.11);
  limb(ctx, bl, fl, 0.05, L.white);

  // Pierna cercana: pantalon con rodillera y bota.
  limb(ctx, p.hip, p.knee, 0.17, L.pants);
  limb(ctx, p.hip, p.knee, 0.05, L.pantsHi);
  limb(ctx, p.knee, { x: p.knee.x + (p.ankle.x - p.knee.x) * 0.45, y: p.knee.y + (p.ankle.y - p.knee.y) * 0.45 }, 0.145, L.pants);
  ctx.fillStyle = T('#2f3440');
  ctx.beginPath();
  ctx.arc(p.knee.x, p.knee.y, 0.085, 0, TAU);
  ctx.fill();
  const bootTop = { x: p.knee.x + (p.ankle.x - p.knee.x) * 0.4, y: p.knee.y + (p.ankle.y - p.knee.y) * 0.4 };
  limb(ctx, bootTop, p.ankle, 0.14, L.boot);
  limb(ctx, p.ankle, p.toe, 0.1, L.boot);
  ctx.strokeStyle = L.bootDark;
  ctx.lineWidth = 0.02;
  for (let k = 1; k <= 3; k++) {
    const u = k / 4;
    const cx = bootTop.x + (p.ankle.x - bootTop.x) * u;
    const cy = bootTop.y + (p.ankle.y - bootTop.y) * u;
    ctx.beginPath();
    ctx.moveTo(cx - 0.06, cy - 0.01);
    ctx.lineTo(cx + 0.06, cy + 0.01);
    ctx.stroke();
  }
  limb(ctx, { x: p.ankle.x - 0.02, y: p.ankle.y - 0.05 }, { x: p.toe.x, y: p.toe.y - 0.04 }, 0.035, T('#2a2d34'));

  // Brazo cercano.
  limb(ctx, p.shoulder, p.elbow, 0.115, L.jersey);
  limb(ctx, p.elbow, p.hand, 0.1, L.jersey);
  limb(ctx, { x: p.elbow.x + (p.hand.x - p.elbow.x) * 0.72, y: p.elbow.y + (p.hand.y - p.elbow.y) * 0.72 }, p.hand, 0.1, L.glove);
  ctx.fillStyle = L.glove;
  ctx.beginPath();
  ctx.arc(p.hand.x, p.hand.y, 0.058, 0, TAU);
  ctx.fill();

  // Casco.
  ctx.save();
  ctx.translate(p.head.x, p.head.y);
  ctx.rotate(p.headAngle);
  ctx.fillStyle = L.helmet;
  ctx.beginPath();
  ctx.arc(0, 0, 0.15, 0, TAU);
  ctx.fill();
  // Mentonera.
  poly(ctx, [0.02, -0.14, 0.2, -0.1, 0.19, -0.02, 0.06, -0.02], L.helmet);
  poly(ctx, [0.1, -0.12, 0.2, -0.1, 0.19, -0.05, 0.1, -0.06], T('#2a2d36'));
  // Franja.
  ctx.strokeStyle = L.helmetStripe;
  ctx.lineWidth = 0.045;
  ctx.beginPath();
  ctx.arc(0, 0, 0.11, 1.3, 3.0);
  ctx.stroke();
  // Visera.
  poly(ctx, [0.02, 0.1, 0.27, 0.075, 0.25, 0.035, 0.05, 0.06], L.helmetStripe);
  // Gafas.
  ctx.fillStyle = T('#15161c');
  ctx.beginPath();
  ctx.roundRect(0.035, -0.02, 0.16, 0.08, 0.03);
  ctx.fill();
  const g = ctx.createLinearGradient(0.05, 0.05, 0.18, -0.02);
  g.addColorStop(0, L.goggle);
  g.addColorStop(1, T('#a86bff'));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(0.07, -0.01, 0.115, 0.058, 0.02);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillRect(0.09, 0.025, 0.04, 0.012);
  ctx.restore();
}

/** Solo el piloto (caidas). */
export function drawRiderPose(ctx: CanvasRenderingContext2D, p: RiderPose): void {
  drawRiderFar(ctx, p);
  drawRiderNear(ctx, p);
  drawRiderMud(ctx, p);
}

export interface BikeDrawState {
  rearComp: number;
  frontComp: number;
  rearSpin: number;
  frontSpin: number;
  rearSpinRate: number;
  frontSpinRate: number;
}

export function bikeDrawState(b: BikeState): BikeDrawState {
  return {
    rearComp: b.rear.comp,
    frontComp: b.front.comp,
    rearSpin: b.rear.spin,
    frontSpin: b.front.spin,
    rearSpinRate: b.rear.spinRate,
    frontSpinRate: b.front.spinRate,
  };
}

function localWheel(which: 'rear' | 'front', comp: number): Vec2 {
  const geo = BIKE[which];
  const l = geo.rest - comp;
  return { x: geo.anchor.x + geo.axis.x * l, y: geo.anchor.y + geo.axis.y * l };
}

/**
 * Dibuja moto (y piloto si se pasa pose) en el origen actual del contexto,
 * que debe estar ya trasladado y girado al chasis.
 */
export function drawBike(ctx: CanvasRenderingContext2D, s: BikeDrawState, pose: RiderPose | null, nitro: boolean): void {
  const rw = localWheel('rear', s.rearComp);
  const fw = localWheel('front', s.frontComp);
  const fg = BIKE.front;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (pose) drawRiderFar(ctx, pose);

  drawWheel(ctx, rw, s.rearSpin, s.rearSpinRate, false);
  drawWheel(ctx, fw, s.frontSpin, s.frontSpinRate, true);

  // Escape (lado lejano asoma bajo el lateral).
  ctx.strokeStyle = T('#8c929c');
  ctx.lineWidth = 0.07;
  ctx.beginPath();
  ctx.moveTo(0.27, 0.12);
  ctx.bezierCurveTo(0.42, -0.12, 0.2, -0.24, -0.02, -0.1);
  ctx.lineTo(-0.42, 0.2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 0.015;
  ctx.stroke();
  ctx.save();
  ctx.translate(-0.42, 0.21);
  ctx.rotate(Math.atan2(EXHAUST_TIP.y - 0.21, EXHAUST_TIP.x + 0.42));
  ctx.fillStyle = T('#2a2d33');
  ctx.beginPath();
  ctx.roundRect(0, -0.065, 0.6, 0.13, 0.05);
  ctx.fill();
  ctx.fillStyle = T('#6f7580');
  ctx.fillRect(0.08, -0.065, 0.38, 0.03);
  ctx.fillStyle = T('#b8bec8');
  ctx.fillRect(0.52, -0.05, 0.08, 0.1);
  ctx.restore();
  if (nitro) {
    ctx.fillStyle = 'rgba(120,220,255,0.9)';
    ctx.beginPath();
    ctx.arc(EXHAUST_TIP.x, EXHAUST_TIP.y, 0.05, 0, TAU);
    ctx.fill();
  }

  // Basculante y cadena.
  const dx = rw.x - PIVOT.x;
  const dy = rw.y - PIVOT.y;
  const armLen = Math.hypot(dx, dy);
  const ux = dx / armLen;
  const uy = dy / armLen;
  const nx = -uy;
  const ny = ux;
  poly(ctx, [PIVOT.x + nx * 0.055, PIVOT.y + ny * 0.055, rw.x + nx * 0.035, rw.y + ny * 0.035, rw.x - nx * 0.035, rw.y - ny * 0.035, PIVOT.x - nx * 0.06, PIVOT.y - ny * 0.06], T('#9aa4b1'));
  limb(ctx, { x: PIVOT.x + ux * 0.05 + nx * 0.02, y: PIVOT.y + uy * 0.05 + ny * 0.02 }, { x: rw.x - ux * 0.08 + nx * 0.015, y: rw.y - uy * 0.08 + ny * 0.015 }, 0.012, T('#e3e8ee'));
  ctx.strokeStyle = T('#2a2c31');
  ctx.lineWidth = 0.018;
  ctx.beginPath();
  ctx.moveTo(0.02, 0.07);
  ctx.lineTo(rw.x, rw.y + 0.12);
  ctx.moveTo(0.02, -0.03);
  ctx.lineTo(rw.x, rw.y - 0.12);
  ctx.stroke();
  ctx.fillStyle = T('#3b3f47');
  ctx.beginPath();
  ctx.arc(rw.x, rw.y, 0.12, 0, TAU);
  ctx.fill();

  // Amortiguador trasero: muelle que se comprime.
  const sb = { x: PIVOT.x + dx * 0.3 + nx * 0.06, y: PIVOT.y + dy * 0.3 + ny * 0.06 };
  const sdx = sb.x - SHOCK_TOP.x;
  const sdy = sb.y - SHOCK_TOP.y;
  const sl = Math.hypot(sdx, sdy);
  ctx.save();
  ctx.translate(SHOCK_TOP.x, SHOCK_TOP.y);
  ctx.rotate(Math.atan2(sdy, sdx));
  ctx.fillStyle = T('#2b2e35');
  ctx.fillRect(0, -0.03, sl * 0.55, 0.06);
  ctx.fillStyle = T('#c7ccd4');
  ctx.fillRect(sl * 0.5, -0.013, sl * 0.5, 0.026);
  ctx.strokeStyle = L.spring;
  ctx.lineWidth = 0.022;
  ctx.beginPath();
  const coils = 7;
  for (let i = 0; i <= coils * 2; i++) {
    const u = 0.06 + (i / (coils * 2)) * (sl - 0.1);
    const v = i % 2 ? 0.05 : -0.05;
    (i ? ctx.lineTo : ctx.moveTo).call(ctx, u, v);
  }
  ctx.stroke();
  ctx.restore();

  // Motor.
  poly(ctx, [-0.14, 0.2, 0.3, 0.26, 0.34, 0.02, 0.24, -0.2, -0.02, -0.24, -0.16, -0.06], L.engine);
  // Culata con aletas.
  ctx.save();
  ctx.translate(0.2, 0.17);
  ctx.rotate(-0.35);
  ctx.fillStyle = T('#50545c');
  ctx.fillRect(-0.1, -0.1, 0.2, 0.2);
  ctx.strokeStyle = T('#8c929c');
  ctx.lineWidth = 0.012;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(-0.1, -0.08 + i * 0.04);
    ctx.lineTo(0.1, -0.08 + i * 0.04);
    ctx.stroke();
  }
  ctx.restore();
  // Tapa del embrague.
  ctx.fillStyle = L.engineHi;
  ctx.beginPath();
  ctx.ellipse(0.02, -0.06, 0.12, 0.1, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = T('#a9afb8');
  ctx.lineWidth = 0.012;
  ctx.stroke();
  ctx.fillStyle = T('#bfc5cd');
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU;
    ctx.beginPath();
    ctx.arc(0.02 + Math.cos(a) * 0.085, -0.06 + Math.sin(a) * 0.07, 0.009, 0, TAU);
    ctx.fill();
  }
  // Cubrecarter.
  poly(ctx, [-0.06, -0.25, 0.26, -0.22, 0.34, -0.06, 0.3, -0.08, 0.22, -0.18, -0.04, -0.2], T('#1a1c20'));

  // Chasis visible.
  ctx.strokeStyle = L.frame;
  ctx.lineWidth = 0.05;
  ctx.beginPath();
  ctx.moveTo(0.44, 0.58);
  ctx.lineTo(0.3, 0.12);
  ctx.moveTo(0.44, 0.58);
  ctx.lineTo(-0.15, 0.38);
  ctx.lineTo(-0.12, 0.05);
  ctx.stroke();

  // Guardabarros trasero y colin.
  poly(ctx, [-0.35, 0.42, -0.72, 0.45, -1.14, 0.56, -1.13, 0.5, -0.8, 0.38, -0.5, 0.32], L.plastic);
  poly(ctx, [-0.72, 0.45, -1.14, 0.56, -1.13, 0.53, -0.72, 0.43], L.white);
  // Lateral con dorsal.
  poly(ctx, [-0.18, 0.4, -0.72, 0.44, -0.62, 0.14, -0.22, 0.12], L.white);
  poly(ctx, [-0.18, 0.4, -0.72, 0.44, -0.7, 0.4, -0.2, 0.36], L.plastic);
  ctx.save();
  // Dorsal: rasterizado grande y escalado (una fuente web a 0,2 px es un borron).
  ctx.translate(-0.43, 0.24);
  ctx.scale(0.01, -0.01);
  ctx.font = '700 20px "Russo One", "Arial Black", Impact, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = L.graphic;
  ctx.fillText(L.number, 0, 0);
  ctx.restore();
  // Asiento.
  ctx.fillStyle = L.seat;
  ctx.beginPath();
  ctx.moveTo(0.12, 0.46);
  ctx.quadraticCurveTo(-0.3, 0.52, -0.86, 0.5);
  ctx.lineTo(-0.84, 0.43);
  ctx.quadraticCurveTo(-0.3, 0.44, 0.1, 0.39);
  ctx.fill();
  // Deposito y aleta del radiador.
  poly(ctx, [0.06, 0.48, 0.42, 0.56, 0.4, 0.44, 0.36, 0.14, 0.18, 0.02, 0.06, 0.24], L.plastic);
  poly(ctx, [0.16, 0.36, 0.38, 0.4, 0.36, 0.26, 0.2, 0.2], L.white);
  poly(ctx, [0.2, 0.3, 0.36, 0.33, 0.35, 0.29, 0.21, 0.26], L.graphic);
  ctx.strokeStyle = L.plasticDark;
  ctx.lineWidth = 0.015;
  ctx.beginPath();
  ctx.moveTo(0.1, 0.25);
  ctx.lineTo(0.18, 0.04);
  ctx.stroke();

  // Horquilla: barras fijas (doradas) y botellas que suben con la compresion.
  const top = { x: fg.anchor.x - fg.axis.x * 0.24, y: fg.anchor.y - fg.axis.y * 0.24 };
  const stanchionEnd = { x: fg.anchor.x + fg.axis.x * 0.5, y: fg.anchor.y + fg.axis.y * 0.5 };
  const legTop = { x: fw.x - fg.axis.x * 0.5, y: fw.y - fg.axis.y * 0.5 };
  limb(ctx, top, stanchionEnd, 0.05, L.stanchion);
  limb(ctx, top, stanchionEnd, 0.012, 'rgba(255,255,255,0.55)');
  limb(ctx, legTop, fw, 0.075, L.forkLeg);
  limb(ctx, { x: legTop.x + fg.axis.x * 0.05, y: legTop.y + fg.axis.y * 0.05 }, { x: fw.x - fg.axis.x * 0.08, y: fw.y - fg.axis.y * 0.08 }, 0.02, T('#4a5a80'));
  // Tijas.
  const bot = { x: fg.anchor.x + fg.axis.x * 0.02, y: fg.anchor.y + fg.axis.y * 0.02 };
  limb(ctx, { x: top.x - 0.06, y: top.y }, { x: top.x + 0.06, y: top.y }, 0.05, T('#2a2d34'));
  limb(ctx, { x: bot.x - 0.07, y: bot.y }, { x: bot.x + 0.07, y: bot.y }, 0.055, T('#2a2d34'));
  // Guardabarros delantero fijo a la tija inferior.
  ctx.fillStyle = L.plastic;
  ctx.beginPath();
  ctx.moveTo(bot.x - 0.28, bot.y - 0.04);
  ctx.quadraticCurveTo(bot.x + 0.12, bot.y + 0.06, bot.x + 0.5, bot.y - 0.1);
  ctx.lineTo(bot.x + 0.48, bot.y - 0.15);
  ctx.quadraticCurveTo(bot.x + 0.1, bot.y - 0.02, bot.x - 0.26, bot.y - 0.1);
  ctx.fill();
  // Manillar y placa porta-numeros.
  limb(ctx, top, { x: GRIP.x + 0.02, y: GRIP.y - 0.02 }, 0.035, T('#2f3239'));
  limb(ctx, { x: GRIP.x - 0.02, y: GRIP.y }, { x: GRIP.x + 0.06, y: GRIP.y + 0.01 }, 0.045, T('#15161a'));
  poly(ctx, [top.x + 0.03, top.y + 0.1, top.x + 0.12, top.y + 0.1, top.x + 0.2, top.y - 0.2, top.x + 0.1, top.y - 0.24], L.white);
  poly(ctx, [top.x + 0.05, top.y + 0.08, top.x + 0.1, top.y + 0.08, top.x + 0.16, top.y - 0.18, top.x + 0.11, top.y - 0.2], L.plastic);

  // Estribera y pedal.
  limb(ctx, { x: PEG.x - 0.06, y: PEG.y }, { x: PEG.x + 0.06, y: PEG.y }, 0.035, T('#8b919b'));

  drawBikeMud(ctx);
  if (pose) {
    drawRiderNear(ctx, pose);
    drawRiderMud(ctx, pose);
  }
}
