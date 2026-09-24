/**
 * Clip vertical (9:16) para TikTok, Reels y Shorts: se vuelve a dibujar tu
 * mejor salto desde la repeticion grabada, con camara cercana, camara lenta
 * en el punto mas alto, rotulos y una ultima tarjeta con tu tiempo y el reto.
 * Se graba en tiempo real con MediaRecorder sobre un lienzo aparte.
 */
import { clamp } from '../core/math';
import { t as tr } from '../i18n';
import { Mission } from '../game/missions';
import { RiderProfile } from '../game/progress';
import { BikeState, cloneBike } from '../physics/bike';
import { Scene, SceneRace } from '../render/scene';

export interface ReplayFrame {
  t: number;
  bike: BikeState;
  stormX: number;
}

export const REPLAY_RATE = 30;

export function clipSupported(): boolean {
  const c = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  return !!c && typeof c.captureStream === 'function' && typeof MediaRecorder !== 'undefined';
}

function pickMime(): { mime: string; ext: string } {
  const options: Array<[string, string]> = [
    ['video/mp4;codecs=avc1', 'mp4'],
    ['video/mp4', 'mp4'],
    ['video/webm;codecs=vp9', 'webm'],
    ['video/webm;codecs=vp8', 'webm'],
    ['video/webm', 'webm'],
  ];
  for (const [m, e] of options) if (MediaRecorder.isTypeSupported(m)) return { mime: m, ext: e };
  return { mime: '', ext: 'webm' };
}

export interface ClipOptions {
  mission: Mission;
  frames: ReplayFrame[];
  /** Instante (reloj de carrera) del punto mas alto del mejor salto. */
  apex: number | null;
  rider: RiderProfile;
  title: string;
  time: string;
  onProgress?: (p: number) => void;
}

const W = 720;
const H = 1280;
const DISPLAY = '"Russo One", "Arial Black", Impact, sans-serif';
const COND = '"Barlow Condensed", "Arial Narrow", sans-serif';

export async function makeClip(o: ClipOptions): Promise<{ blob: Blob; ext: string }> {
  const frames = o.frames;
  if (frames.length < 10) throw new Error('sin repeticion');
  const end = frames[frames.length - 1].t;
  const apex = o.apex ?? Math.max(0, end - 3);
  const t0 = clamp(apex - 2.6, 0, Math.max(0, end - 5));
  const t1 = Math.min(end, apex + 3);
  const slowA = apex - 0.55;
  const slowB = apex + 0.65;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

  const first = frames[0];
  const fake: SceneRace = {
    mission: o.mission,
    track: o.mission.track,
    bike: cloneBike(first.bike),
    prevBike: cloneBike(first.bike),
    state: 'racing',
    time: t0,
    rivals: [],
    lastCheckpoint: 0,
    collected: o.mission.track.pickups.map(() => true),
    stormX: first.stormX,
    crashBike: null,
  };
  const scene = new Scene(fake, o.rider);
  scene.clean = true;
  scene.camera.fixedZoom = 0.46;
  scene.camera.portrait = true;

  const sample = (t: number): { a: ReplayFrame; b: ReplayFrame; u: number } => {
    const f = clamp(t * REPLAY_RATE, 0, frames.length - 1);
    const i = Math.min(frames.length - 2, Math.floor(f));
    return { a: frames[i], b: frames[i + 1], u: f - i };
  };
  const place = (t: number): number => {
    const s = sample(t);
    fake.prevBike = s.a.bike;
    fake.bike = s.b.bike;
    fake.time = t;
    fake.stormX = s.b.stormX;
    return s.u;
  };

  // Precalienta camara y piloto antes de grabar.
  for (let t = Math.max(0, t0 - 1); t < t0; t += 1 / 30) {
    place(t);
    scene.update(1 / 30);
  }

  const { mime, ext } = pickMime();
  const stream = canvas.captureStream(30);
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 5_000_000 } : { videoBitsPerSecond: 5_000_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e): void => {
    if (e.data.size) chunks.push(e.data);
  };
  const done = new Promise<Blob>((res) => (rec.onstop = (): void => res(new Blob(chunks, { type: mime || 'video/webm' }))));
  rec.start(250);

  const endCard = 1.6;
  let t = t0;
  let cardT = 0;
  let last = performance.now();
  await new Promise<void>((resolve) => {
    const frame = (now: number): void => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (t < t1) {
        const slow = t > slowA && t < slowB;
        const rate = slow ? 0.32 : 1;
        scene.cinema = slow ? 1 : Math.max(0, scene.cinema - dt * 4);
        t = Math.min(t1, t + dt * rate);
        const alpha = place(t);
        scene.update(dt * rate);
        scene.draw(ctx, W, H, 1, alpha, dt * rate);
        overlay(ctx, o, slow);
        o.onProgress?.(clamp((t - t0) / (t1 - t0), 0, 1) * 0.85);
      } else {
        cardT += dt;
        scene.update(0);
        scene.draw(ctx, W, H, 1, 1, 0);
        endOverlay(ctx, o, clamp(cardT / 0.4, 0, 1));
        o.onProgress?.(0.85 + clamp(cardT / endCard, 0, 1) * 0.15);
        if (cardT >= endCard) {
          resolve();
          return;
        }
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
  rec.stop();
  stream.getTracks().forEach((tr) => tr.stop());
  return { blob: await done, ext };
}

function overlay(ctx: CanvasRenderingContext2D, o: ClipOptions, slow: boolean): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const top = ctx.createLinearGradient(0, 0, 0, 260);
  top.addColorStop(0, 'rgba(0,0,0,0.6)');
  top.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, W, 260);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.save();
  ctx.translate(W / 2, 118);
  ctx.transform(1, 0, -0.14, 1, 0, 0);
  ctx.font = `400 92px ${DISPLAY}`;
  const hw = ctx.measureText('HOLE').width;
  const sw = ctx.measureText('SHOT').width;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('HOLE', -(hw + sw) / 2, 0);
  ctx.fillStyle = o.mission.theme.accent;
  ctx.fillText('SHOT', -(hw + sw) / 2 + hw, 0);
  ctx.restore();
  ctx.textAlign = 'center';
  ctx.font = `800 30px ${COND}`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(o.title.toUpperCase(), W / 2, 164);
  if (slow) {
    ctx.font = `800 italic 34px ${COND}`;
    ctx.fillStyle = o.mission.theme.accent;
    ctx.fillText(tr('CÁMARA LENTA'), W / 2, H - 200);
  }
  ctx.font = `800 28px ${COND}`;
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText(`#${o.rider.number} ${o.rider.name}`, W / 2, H - 140);
}

function endOverlay(ctx: CanvasRenderingContext2D, o: ClipOptions, k: number): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = `rgba(8,9,14,${(0.78 * k).toFixed(3)})`;
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = k;
  ctx.textAlign = 'center';
  ctx.font = `800 34px ${COND}`;
  ctx.fillStyle = o.mission.theme.accent;
  ctx.fillText(o.title.toUpperCase(), W / 2, H * 0.36);
  ctx.font = `400 128px ${DISPLAY}`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(o.time, W / 2, H * 0.47);
  ctx.font = `800 40px ${COND}`;
  ctx.fillText(`#${o.rider.number} ${o.rider.name}`, W / 2, H * 0.54);
  ctx.font = `400 64px ${DISPLAY}`;
  ctx.fillStyle = o.mission.theme.accent;
  ctx.fillText(tr('¿ME GANAS?'), W / 2, H * 0.66);
  ctx.font = `800 28px ${COND}`;
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillText(tr('ENLACE DEL RETO EN LA DESCRIPCIÓN'), W / 2, H * 0.71);
  ctx.globalAlpha = 1;
}
