/**
 * BARRO DEL DIA: una pista nueva cada dia, la misma para todo el mundo.
 *
 * La pista sale de la fecha (AAAA-MM-DD) con un generador entero
 * determinista (mulberry32): las decisiones de trazado no dependen de la
 * fisica ni de funciones trigonometricas, asi que cualquier navegador
 * construye exactamente la misma secuencia de piezas. Un fantasma grabado en
 * un movil se corre en el ordenador de un amigo sobre la misma pista.
 *
 * El catalogo respeta las mismas reglas que las pistas hechas a mano: cada
 * hueco va precedido de un checkpoint con carrerilla, y las pruebas
 * automaticas recorren muchos dias seguidos con el piloto automatico.
 */
import { makeRng } from '../core/math';
import { TrackBuilder, TrackData } from '../physics/trackBuilder';
import { Autopilot } from './autopilot';
import { Mission, THEMES, Theme } from './missions';
import { Race } from './race';

/** Dia 1 de la gira diaria. */
const EPOCH = Date.UTC(2026, 8, 24);
const THEME_ORDER = ['canyon', 'forest', 'quarry', 'stadium', 'dunes'];

const NAMES = [
  'EL LATIGAZO', 'LA LAVADORA', 'EL TOBOGÁN', 'LA ESCALERA', 'EL AGUJERO', 'LA MONTAÑA RUSA',
  'EL TRAMPOLÍN', 'LA CICATRIZ', 'EL SERRUCHO', 'LA RATONERA', 'EL PRECIPICIO', 'LA JOROBA',
  'EL DESCALABRO', 'LA TRINCHERA', 'EL COHETE', 'LA PISCINA', 'EL ACORDEÓN', 'LA PARED',
  'EL MIRADOR', 'LA BAJADA', 'EL CAÑONAZO', 'LA RAMPA LOCA', 'EL VUELO', 'LA GUILLOTINA',
  'EL REMOLINO', 'LA TRAMPA', 'EL LAGARTO', 'LA ESPIRAL', 'EL PORTAZO', 'LA MURALLA',
];

/** Clave del dia en hora local: AAAA-MM-DD. */
export function dayKey(d = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function isDayKey(key: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(key);
}

/** Numero de edicion (#1 el primer dia). */
export function dayNumber(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return Math.floor((Date.UTC(y, m - 1, d) - EPOCH) / 86400000) + 1;
}

function seedOf(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

type Piece = 'whoops' | 'table' | 'doubles' | 'gap' | 'hilldrop' | 'step' | 'rocks' | 'logs' | 'mud' | 'tires' | 'triple';

const WEIGHTS: Array<[Piece, number]> = [
  ['whoops', 3],
  ['table', 3],
  ['doubles', 3],
  ['gap', 3],
  ['hilldrop', 2],
  ['step', 2],
  ['rocks', 2],
  ['logs', 2],
  ['mud', 2],
  ['tires', 1],
  ['triple', 2],
];

export function dailyTheme(key: string): { name: string; theme: Theme } {
  const n = Math.abs(dayNumber(key));
  const name = THEME_ORDER[n % THEME_ORDER.length];
  return { name, theme: THEMES[name] };
}

/** Construye la pista del dia. Solo usa el generador entero para decidir. */
export function buildDailyTrack(key: string): TrackData {
  const rnd = makeRng(seedOf(key));
  const r = (a: number, b: number): number => Math.round((a + rnd() * (b - a)) * 10) / 10;
  const ri = (a: number, b: number): number => a + Math.floor(rnd() * (b - a + 1));
  const { theme } = dailyTheme(key);
  const props = theme.props ?? ['boulder'];
  const names = [...NAMES];
  const takeName = (): string => names.splice(Math.floor(rnd() * names.length), 1)[0];

  // Secuencia: 11 piezas, 2-3 huecos grandes, al menos un charco.
  const seq: Piece[] = [];
  const total = WEIGHTS.reduce((a, [, w]) => a + w, 0);
  const pick = (): Piece => {
    let v = rnd() * total;
    for (const [p, w] of WEIGHTS) {
      v -= w;
      if (v <= 0) return p;
    }
    return 'whoops';
  };
  while (seq.length < 11) {
    const p = pick();
    if (seq.length && seq[seq.length - 1] === p) continue;
    const big = seq.filter((q) => q === 'gap' || q === 'triple').length;
    if ((p === 'gap' || p === 'triple') && big >= 3) continue;
    seq.push(p);
  }
  if (!seq.some((p) => p === 'gap' || p === 'triple')) seq[4] = 'gap';
  if (!seq.includes('mud')) seq[7] = seq[6] === 'mud' ? 'rocks' : 'mud';

  const t = new TrackBuilder();
  t.section('SALIDA').prop('crowd', 4).prop('flag', -3).prop('banner', 16).flat(48);
  let sinceCheckpoint = 0;
  for (const p of seq) {
    const x0 = t.cx;
    // Checkpoint con carrerilla antes de las piezas que exigen velocidad.
    const needsSpeed = p === 'gap' || p === 'triple' || p === 'hilldrop';
    if (needsSpeed || sinceCheckpoint > 160) {
      t.checkpoint().flat(44);
      sinceCheckpoint = 0;
    }
    t.section(takeName());
    const deco = props[ri(0, props.length - 1)];
    t.prop(deco, r(4, 12), r(0.9, 1.3), rnd() < 0.6 ? 1 : 0);
    switch (p) {
      case 'whoops':
        t.whoops(ri(3, 6), r(0.5, 0.75), r(5, 6.5)).flat(r(16, 24));
        break;
      case 'table': {
        const h = r(1.8, 2.8);
        t.tabletop(r(7, 9), h, r(6, 11), r(9, 12)).flat(r(26, 34));
        break;
      }
      case 'doubles': {
        const h = r(1.6, 1.9);
        t.kicker(6, h).landing(9, h).flat(r(2, 4)).kicker(6, h).landing(9, h).flat(r(22, 30));
        break;
      }
      case 'gap': {
        const h = r(2.4, 3.3);
        const exit = -r(0, 0.8);
        t.kicker(r(8, 10), h).gap(r(14, 20), r(5, 9), exit).landing(r(18, 24), h + exit).flat(r(36, 44));
        break;
      }
      case 'triple': {
        const h = r(2.6, 2.9);
        t.kicker(8, h).gap(r(19, 22), 2.9, 0).landing(12, h).flat(r(36, 44));
        break;
      }
      case 'hilldrop': {
        const h = r(5, 8);
        t.hill(r(30, 40), h).flat(10).kicker(6, 1.5).landing(r(24, 30), h + 1.5).flat(r(34, 42));
        break;
      }
      case 'step': {
        const h = r(1.6, 2.3);
        t.stepUp(h).flat(r(14, 20)).dropOff(h).flat(r(20, 26));
        break;
      }
      case 'rocks':
        t.rocks(r(16, 22), ri(5, 8), r(0.32, 0.42)).flat(r(14, 20));
        break;
      case 'logs':
        t.logs(ri(2, 3), r(5.5, 7), r(0.28, 0.34)).flat(r(10, 16));
        break;
      case 'mud':
        t.mud(r(10, 16)).flat(r(14, 20));
        break;
      case 'tires':
        t.tires(ri(3, 4), r(12, 16));
        break;
    }
    sinceCheckpoint += t.cx - x0;
  }
  t.section('META').prop('crowd', 18).prop('banner', 8).flat(62);
  return t.build(8, 32);
}

const cache = new Map<string, Mission>();

/** La mision del dia (medallas calibradas con una vuelta del piloto automatico). */
export function getDailyMission(key: string): Mission {
  const hit = cache.get(key);
  if (hit) return hit;
  const { theme } = dailyTheme(key);
  const number = dayNumber(key);
  const mission: Mission = {
    id: 0,
    name: `BARRO DEL DÍA #${number}`,
    place: key.split('-').reverse().join('/'),
    objective: 'time',
    objectiveText: 'Contrarreloj: la misma pista para todo el mundo, hoy',
    briefing: 'Una pista nueva cada día a medianoche. Haz tu mejor tiempo, comparte el resultado y reta a tus amigos con tu fantasma.',
    track: buildDailyTrack(key),
    theme,
    medals: { parTime: 60, gold: 45, silver: 52 },
    rivals: [],
    daily: { key, number },
  };
  const ref = referenceTime(mission);
  if (Number.isFinite(ref)) {
    const gold = Math.round(ref * 1.12 * 2) / 2;
    const silver = Math.round(ref * 1.3 * 2) / 2;
    mission.medals = { parTime: Math.round(silver + 6), gold, silver };
  }
  cache.set(key, mission);
  return mission;
}

/** Tiempo del piloto automatico sin nitro ni trucos (Infinity si no acaba). */
export function referenceTime(m: Mission): number {
  const race = new Race(m);
  const pilot = new Autopilot();
  for (let t = 0; t < 150 && race.state !== 'finished' && race.state !== 'failed'; t += 1 / 120) {
    const inp = pilot.input(race);
    inp.nitro = false;
    race.step(1 / 120, inp);
  }
  return race.state === 'finished' ? race.time : Infinity;
}
