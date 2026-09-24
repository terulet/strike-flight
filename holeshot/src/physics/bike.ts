/**
 * Fisica de la moto.
 *
 * Modelo: un cuerpo rigido (moto + piloto) con dos ruedas. Cada rueda cuelga
 * de su anclaje a lo largo del eje de la suspension (la horquilla va lanzada,
 * el amortiguador trasero casi vertical) y tiene su propio GIRO con inercia:
 *
 *  - la suspension es un muelle-amortiguador con tope de fin de carrera;
 *  - la traccion sale del deslizamiento entre la velocidad del suelo y la del
 *    neumatico (v - omega*R): por eso la rueda gira de verdad, patina al dar
 *    gas a fondo y se bloquea al frenar;
 *  - el par del motor empuja la rueda y su REACCION levanta el morro: los
 *    caballitos salen solos, no son una animacion;
 *  - frenar produce la reaccion contraria: la horquilla se hunde.
 *
 * Paso fijo de 120 Hz con subpasos internos para que la suspension y el
 * rozamiento sean estables.
 */
import { Vec2, angleDiff, clamp, rotate } from '../core/math';
import { Terrain } from './terrain';

export const BIKE = {
  mass: 175,
  inertia: 58,
  gravity: 11.5,
  wheelRadius: 0.34,
  wheelInertia: 1.3,
  rear: { anchor: { x: -0.6, y: 0.1 }, axis: norm({ x: -0.1, y: -0.51 }), rest: 0.52 },
  front: { anchor: { x: 0.48, y: 0.42 }, axis: norm({ x: 0.407, y: -0.914 }), rest: 0.9 },
  travel: 0.3,
  springK: 10500,
  dampCompress: 950,
  dampRebound: 1250,
  bumpK: 95000,
  bumpC: 2600,
  grip: 1.25,
  slipEps: 0.35,
  engineTorque: 470,
  topSpeed: 25,
  brakeTorque: 850,
  rollingTorque: 6,
  drag: 0.32,
  leanGroundTorque: 560,
  airSpinRate: 6.2,
  airResponse: 6.5,
  airDamping: 0.6,
  nitroForce: 2300,
  nitroTopSpeed: 33,
  substeps: 8,
  mudDrag: 30,
} as const;

function norm(v: Vec2): Vec2 {
  const l = Math.hypot(v.x, v.y);
  return { x: v.x / l, y: v.y / l };
}

/** Puntos del chasis y del piloto que no pueden tocar el suelo (local). */
export const HEAD_LOCAL: Vec2 = { x: 0.02, y: 1.08 };
export const BACK_LOCAL: Vec2 = { x: -0.3, y: 0.78 };
/** Puntos que SI pueden rozar (se apoyan): cubrecarter, colin, guardabarros. */
const SKID_POINTS: Vec2[] = [
  { x: 0.05, y: -0.22 },
  { x: -1.02, y: 0.28 },
  { x: 0.98, y: 0.12 },
];

export interface WheelState {
  /** Compresion de la suspension en metros (0 = extendida del todo). */
  comp: number;
  compVel: number;
  /** Angulo de giro acumulado (rad) y velocidad de rodadura (rad/s, + = hacia delante). */
  spin: number;
  spinRate: number;
  inContact: boolean;
  /** Carga normal (N). */
  load: number;
  /** Deslizamiento en el contacto (m/s). */
  slip: number;
  contactX: number;
  contactY: number;
  /** Barro bajo la rueda (0..1). */
  mud: number;
}

export interface BikeState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  omega: number;
  rear: WheelState;
  front: WheelState;
  /** Entradas suavizadas que alimentan la pose del piloto. */
  throttle: number;
  brake: number;
  lean: number;
  nitro: boolean;
  /** Aceleracion longitudinal suavizada (m/s2), para la pose. */
  accel: number;
}

export interface BikeInput {
  throttle: number; // 0..1
  brake: number; // 0..1
  lean: number; // -1 (adelante) .. +1 (atras)
  nitro: boolean;
}

function newWheel(): WheelState {
  return { comp: 0.09, compVel: 0, spin: 0, spinRate: 0, inContact: false, load: 0, slip: 0, contactX: 0, contactY: 0, mud: 0 };
}

/** Crea la moto apoyada en el suelo en `x`. */
export function createBike(terrain: Terrain, x: number): BikeState {
  const ground = terrain.heightAt(x);
  return {
    x,
    y: ground + 0.72,
    vx: 0,
    vy: 0,
    angle: Math.atan(terrain.slopeAt(x)),
    omega: 0,
    rear: newWheel(),
    front: newWheel(),
    throttle: 0,
    brake: 0,
    lean: 0,
    nitro: false,
    accel: 0,
  };
}

export function cloneBike(b: BikeState): BikeState {
  return { ...b, rear: { ...b.rear }, front: { ...b.front } };
}

export function isAirborne(b: BikeState): boolean {
  return !b.rear.inContact && !b.front.inContact;
}

export function localToWorld(b: { x: number; y: number; angle: number }, p: Vec2): Vec2 {
  const r = rotate(p, b.angle);
  return { x: b.x + r.x, y: b.y + r.y };
}

/** Centro visual de una rueda (sigue a la compresion). */
export function wheelCenter(b: BikeState, which: 'rear' | 'front'): Vec2 {
  const geo = BIKE[which];
  const w = b[which];
  const l = geo.rest - w.comp;
  return localToWorld(b, { x: geo.anchor.x + geo.axis.x * l, y: geo.anchor.y + geo.axis.y * l });
}

export function anchorWorld(b: BikeState, which: 'rear' | 'front'): Vec2 {
  return localToWorld(b, BIKE[which].anchor);
}

const SAMPLE_OFFSETS = Array.from({ length: 11 }, (_, i) => (i / 10 - 0.5) * 1.9);

/**
 * Busca la extension de la suspension para la que el neumatico apoya justo
 * sobre el terreno. Devuelve null si la rueda esta en el aire.
 */
function solveContact(
  terrain: Terrain,
  ax: number,
  ay: number,
  dx: number,
  dy: number,
  rest: number,
): { l: number; px: number } | null {
  const R = BIKE.wheelRadius;
  const pen = (l: number): { v: number; px: number } => {
    const cx = ax + dx * l;
    const cy = ay + dy * l;
    let best = -Infinity;
    let px = cx;
    for (const k of SAMPLE_OFFSETS) {
      const ox = k * R;
      const bottom = cy - Math.sqrt(Math.max(0, R * R - ox * ox));
      const p = terrain.heightAt(cx + ox) - bottom;
      if (p > best) {
        best = p;
        px = cx + ox;
      }
    }
    return { v: best, px };
  };
  const top = pen(rest);
  if (top.v <= 0) return null;
  let lo = rest - BIKE.travel - 0.4;
  let hi = rest;
  const deepest = pen(lo);
  if (deepest.v > 0) return { l: lo, px: deepest.px };
  let px = top.px;
  for (let i = 0; i < 16; i++) {
    const mid = (lo + hi) / 2;
    const r = pen(mid);
    if (r.v > 0) {
      hi = mid;
      px = r.px;
    } else lo = mid;
  }
  return { l: (lo + hi) / 2, px };
}

export interface StepEvents {
  /** Algun punto prohibido (cabeza, espalda) toco el suelo. */
  headHit: boolean;
}

export function stepBike(b: BikeState, input: BikeInput, terrain: Terrain, dt: number): StepEvents {
  // Suavizado de mandos: los botones son binarios, la moto no.
  const k = 1 - Math.exp(-dt * 9);
  b.throttle += (input.throttle - b.throttle) * k;
  b.brake += (input.brake - b.brake) * (1 - Math.exp(-dt * 14));
  b.lean += (input.lean - b.lean) * (1 - Math.exp(-dt * 12));
  b.nitro = input.nitro;

  const n = BIKE.substeps;
  const h = dt / n;
  const events: StepEvents = { headHit: false };
  const vx0 = b.vx;
  for (let s = 0; s < n; s++) substep(b, terrain, h, events);
  const along = (b.vx - vx0) / dt;
  b.accel += (along - b.accel) * (1 - Math.exp(-dt * 6));
  return events;
}

function substep(b: BikeState, terrain: Terrain, h: number, events: StepEvents): void {
  const m = BIKE.mass;
  let fx = 0;
  let fy = -m * BIKE.gravity;
  let torque = 0;
  const cos = Math.cos(b.angle);
  const sin = Math.sin(b.angle);
  const R = BIKE.wheelRadius;

  const applyAt = (px: number, py: number, ffx: number, ffy: number): void => {
    fx += ffx;
    fy += ffy;
    torque += (px - b.x) * ffy - (py - b.y) * ffx;
  };

  let grounded = false;
  for (const which of ['rear', 'front'] as const) {
    const geo = BIKE[which];
    const w = b[which];
    const ax = b.x + geo.anchor.x * cos - geo.anchor.y * sin;
    const ay = b.y + geo.anchor.x * sin + geo.anchor.y * cos;
    const dx = geo.axis.x * cos - geo.axis.y * sin;
    const dy = geo.axis.x * sin + geo.axis.y * cos;
    const contact = solveContact(terrain, ax, ay, dx, dy, geo.rest);

    if (contact) {
      grounded = true;
      const comp = geo.rest - contact.l;
      const compVel = w.inContact ? (comp - w.comp) / h : Math.max(0, comp / h) * 0.3;
      w.comp = comp;
      w.compVel = compVel;
      w.inContact = true;
      const spring = BIKE.springK * Math.min(comp, BIKE.travel);
      const bump = comp > BIKE.travel ? BIKE.bumpK * (comp - BIKE.travel) + BIKE.bumpC * Math.max(0, compVel) : 0;
      const damp = (compVel > 0 ? BIKE.dampCompress : BIKE.dampRebound) * compVel;
      const load = Math.max(0, spring + bump + damp);
      w.load = load;

      const nrm = terrain.normalAt(contact.px);
      const cx = ax + dx * contact.l;
      const cy = ay + dy * contact.l;
      applyAt(cx, cy, nrm.x * load, nrm.y * load);

      // Rozamiento en el contacto: depende del deslizamiento real.
      const tx = nrm.y;
      const ty = -nrm.x;
      const px = cx - nrm.x * R;
      const py = cy - nrm.y * R;
      const vpx = b.vx - b.omega * (py - b.y);
      const vpy = b.vy + b.omega * (px - b.x);
      const vt = vpx * tx + vpy * ty;
      const slip = vt - w.spinRate * R;
      w.slip = slip;
      // En el barro la rueda agarra menos y se hunde: frena.
      const mud = terrain.mudAt(px);
      const grip = BIKE.grip * (1 - 0.38 * mud);
      const ft = (-grip * load * slip) / Math.sqrt(slip * slip + BIKE.slipEps * BIKE.slipEps);
      applyAt(px, py, tx * ft, ty * ft);
      if (mud > 0) applyAt(px, py, -tx * vt * mud * BIKE.mudDrag, -ty * vt * mud * BIKE.mudDrag);
      w.mud = mud;
      w.spinRate += ((-ft * R) / BIKE.wheelInertia) * h;
      w.contactX = px;
      w.contactY = py;
    } else {
      w.inContact = false;
      w.load = 0;
      w.slip = 0;
      w.mud = 0;
      // La suspension se extiende sola en el aire.
      w.compVel = -w.comp * 14;
      w.comp = Math.max(0, w.comp - w.comp * 14 * h);
    }

    // Par motor (solo trasera) con su reaccion sobre el chasis.
    if (which === 'rear') {
      const speed = w.spinRate * R;
      const top = b.nitro ? BIKE.nitroTopSpeed : BIKE.topSpeed;
      // Par casi plano hasta el 65 % de la punta y luego cae: tira fuerte
      // desde abajo, que es lo que hace falta tras reaparecer.
      const curve = clamp((top - speed) / (top * 0.35), 0, 1) * (speed < 3 ? 0.85 + speed * 0.05 : 1);
      const drive = b.throttle * BIKE.engineTorque * curve;
      w.spinRate += (drive / BIKE.wheelInertia) * h;
      torque += drive * (w.inContact ? 0.62 : 0.15);
    }
    // Freno en las dos ruedas.
    if (b.brake > 0.01) {
      const tb = b.brake * BIKE.brakeTorque * (which === 'front' ? 1 : 0.6);
      const maxDelta = Math.abs(w.spinRate) * BIKE.wheelInertia;
      const applied = Math.min(tb * h, maxDelta);
      w.spinRate -= (Math.sign(w.spinRate) * applied) / BIKE.wheelInertia;
      if (w.inContact) torque -= Math.sign(w.spinRate || 1) * (applied / h) * 0.35;
    }
    // Resistencia a la rodadura.
    w.spinRate -= Math.sign(w.spinRate) * Math.min(Math.abs(w.spinRate), (BIKE.rollingTorque / BIKE.wheelInertia) * h);
    w.spin += w.spinRate * h;
  }

  // Puntos del chasis que pueden rozar: apoyo blando, sin choque.
  for (const p of SKID_POINTS) {
    const wx = b.x + p.x * cos - p.y * sin;
    const wy = b.y + p.x * sin + p.y * cos;
    const g = terrain.heightAt(wx);
    if (wy < g) {
      const pen = g - wy;
      const vpy = b.vy + b.omega * (wx - b.x);
      const f = Math.max(0, 60000 * pen - 2500 * vpy);
      applyAt(wx, wy, 0, f);
      const vpx = b.vx - b.omega * (wy - b.y);
      applyAt(wx, wy, -vpx * 400, 0);
    }
  }
  for (const p of [HEAD_LOCAL, BACK_LOCAL]) {
    const wx = b.x + p.x * cos - p.y * sin;
    const wy = b.y + p.x * sin + p.y * cos;
    if (wy < terrain.heightAt(wx) + 0.05) events.headHit = true;
  }

  // Cuerpo del piloto: en el suelo desplaza el peso; en el aire gira la moto.
  if (grounded) {
    torque += b.lean * BIKE.leanGroundTorque;
    // Ayuda arcade: evita darse la vuelta hacia atras con un caballito eterno.
    const slopeAngle = Math.atan(terrain.slopeAt(b.x));
    const pitch = angleDiff(b.angle, slopeAngle);
    if (pitch > 0.55 && b.front.inContact === false) torque -= (pitch - 0.55) * 6500 + Math.max(0, b.omega) * 220;
    if (pitch < -0.6 && b.rear.inContact === false) torque -= (pitch + 0.6) * 2200 + b.omega * 60;
  } else {
    const target = b.lean * BIKE.airSpinRate;
    if (Math.abs(b.lean) > 0.05) {
      b.omega += (target - b.omega) * (1 - Math.exp(-BIKE.airResponse * h * Math.abs(b.lean)));
    } else {
      b.omega -= b.omega * BIKE.airDamping * h;
    }
  }

  // Nitro: empuje a lo largo del chasis.
  if (b.nitro) {
    fx += Math.cos(b.angle) * BIKE.nitroForce;
    fy += Math.sin(b.angle) * BIKE.nitroForce;
  }

  // Aire.
  const speed = Math.hypot(b.vx, b.vy);
  fx -= BIKE.drag * b.vx * speed;
  fy -= BIKE.drag * b.vy * speed;

  b.vx += (fx / m) * h;
  b.vy += (fy / m) * h;
  b.omega += (torque / BIKE.inertia) * h;
  // Cortafuegos numerico: ninguna situacion de juego necesita mas que esto,
  // y un valor desbocado no debe poder propagarse nunca.
  b.vx = clamp(b.vx, -60, 60);
  b.vy = clamp(b.vy, -60, 60);
  b.omega = clamp(b.omega, -25, 25);
  if (grounded) b.omega *= 1 - 1.2 * h;
  b.x += b.vx * h;
  b.y += b.vy * h;
  b.angle += b.omega * h;
}
