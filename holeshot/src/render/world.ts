/**
 * El mundo en primer plano: terreno con estratos, costra, luz de borde,
 * hierba y piedras; fosos con su peligro (agua, fuego, sombra); obstaculos
 * dibujados exactamente sobre su relieve; decorados; puertas de salida,
 * checkpoints y meta; recogibles.
 */
import { hash1, noise1 } from '../core/math';
import { Mission, Theme } from '../game/missions';
import { Obstacle, Pickup, Prop, TrackData } from '../physics/trackBuilder';
import { TERRAIN_STEP } from '../physics/terrain';
import { mix, rgba, shade } from './color';
import { TRACK_BAND, laneOffset } from './lanes';
import { View } from './view';
import { t as tr } from '../i18n';

const TAU = Math.PI * 2;

function hazeHex(theme: Theme): string {
  const [r, g, b] = theme.haze.split(',').map((n) => parseInt(n, 10));
  return '#' + [r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('');
}

/**
 * Texto en coordenadas de mundo (la Y esta invertida). Se rasteriza a 100x
 * y se escala: una fuente web pedida a 0,3 px sale como un borron.
 */
const worldFont = (size: number): string => `700 ${Math.round(size * 100)}px "Russo One", "Arial Black", Impact, sans-serif`;

export function worldText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = 'center'): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(0.01, -0.01);
  ctx.font = worldFont(size);
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

/** Ancho en metros de un texto de `worldText`. */
export function worldTextWidth(ctx: CanvasRenderingContext2D, text: string, size: number): number {
  ctx.save();
  ctx.font = worldFont(size);
  const w = ctx.measureText(text).width * 0.01;
  ctx.restore();
  return w;
}

export class WorldArt {
  private readonly track: TrackData;
  private readonly theme: Theme;
  private readonly haze: string;

  constructor(mission: Mission) {
    this.track = mission.track;
    this.theme = mission.theme;
    this.haze = hazeHex(mission.theme);
  }

  private h(x: number): number {
    return this.track.terrain.heightAt(x);
  }

  // ---------------------------------------------------------------- terreno
  drawTerrain(ctx: CanvasRenderingContext2D, v: View, time: number): void {
    const g = this.theme.ground;
    const x0 = Math.floor((v.x0 - 1) / TERRAIN_STEP) * TERRAIN_STEP;
    const x1 = v.x1 + 1;
    const bottom = v.yBottom - 2;
    const xs: number[] = [];
    const ys: number[] = [];
    for (let x = x0; x <= x1; x += TERRAIN_STEP) {
      xs.push(x);
      ys.push(this.h(x));
    }
    const n = xs.length;
    const band = (depth: (x: number, i: number) => number, color: string): void => {
      ctx.beginPath();
      ctx.moveTo(xs[0], bottom);
      for (let i = 0; i < n; i++) ctx.lineTo(xs[i], ys[i] - depth(xs[i], i));
      ctx.lineTo(xs[n - 1], bottom);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    };

    band(() => 0, g.crust);
    // Estratos: capas con su propia ondulacion.
    g.strata.forEach((c, k) => {
      const base = 0.42 + k * (1.05 + k * 0.28);
      band((x) => base + (noise1(x * 0.11 + k * 13.7) - 0.5) * (0.5 + k * 0.25) + (noise1(x * 0.6 + k * 3.1) - 0.5) * 0.12, c);
    });

    // Vetas horizontales en los estratos.
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = g.crustShade;
    ctx.lineWidth = 0.05;
    for (let k = 0; k < 6; k++) {
      ctx.beginPath();
      const base = 1 + k * 1.3;
      for (let i = 0; i < n; i += 2) {
        const y = ys[i] - base - (noise1(xs[i] * 0.2 + k * 9.3) - 0.5) * 0.9;
        (i ? ctx.lineTo : ctx.moveTo).call(ctx, xs[i], y);
      }
      ctx.stroke();
    }
    ctx.restore();

    // Sombra bajo la costra (grosor del borde).
    ctx.beginPath();
    for (let i = 0; i < n; i++) (i ? ctx.lineTo : ctx.moveTo).call(ctx, xs[i], ys[i] - 0.16);
    ctx.strokeStyle = rgba(g.crustShade, 0.9);
    ctx.lineWidth = 0.2;
    ctx.stroke();

    // Piedrecitas y grumos incrustados en la costra.
    for (let cell = Math.floor(x0 / 0.7); cell * 0.7 < x1; cell++) {
      const r = hash1(cell * 1.91);
      if (r < 0.55) continue;
      const x = cell * 0.7 + hash1(cell * 3.7) * 0.7;
      const d = 0.22 + hash1(cell * 5.3) * 1.1;
      const s = 0.025 + hash1(cell * 7.1) * 0.045;
      ctx.fillStyle = r > 0.8 ? shade(g.crust, 0.18) : g.pebble;
      ctx.beginPath();
      ctx.ellipse(x, this.h(x) - d, s * 1.4, s, hash1(cell) * 3, 0, TAU);
      ctx.fill();
    }

    // Superficie de la pista vista un poco desde arriba: franja con fondo.
    const B = TRACK_BAND;
    const bandPoly = (y0: number, y1: number, color: string): void => {
      ctx.beginPath();
      for (let i = 0; i < n; i++) (i ? ctx.lineTo : ctx.moveTo).call(ctx, xs[i], ys[i] + y0);
      for (let i = n - 1; i >= 0; i--) ctx.lineTo(xs[i], ys[i] + y1);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    };
    bandPoly(0, B, shade(g.crust, 0.1));
    bandPoly(B * 0.62, B, mix(shade(g.crust, 0.1), g.crustShade, 0.22));
    // Rodadas de cada carril.
    ctx.save();
    ctx.strokeStyle = rgba(g.crustShade, 0.45);
    ctx.lineWidth = 0.028;
    for (let lane = 0; lane < 4; lane++) {
      const off = laneOffset(lane) + 0.035;
      ctx.setLineDash([0.9 + lane * 0.2, 0.25, 0.3, 0.2]);
      ctx.beginPath();
      for (let i = 0; i < n; i++) (i ? ctx.lineTo : ctx.moveTo).call(ctx, xs[i], ys[i] + off);
      ctx.stroke();
    }
    ctx.restore();
    // Piedrecitas sueltas sobre la superficie.
    ctx.fillStyle = rgba(g.pebble, 0.55);
    for (let cell = Math.floor(x0 / 0.5); cell * 0.5 < x1; cell++) {
      const r = hash1(cell * 6.17);
      if (r < 0.6) continue;
      const x = cell * 0.5 + hash1(cell * 2.9) * 0.5;
      ctx.fillRect(x, this.h(x) + 0.05 + hash1(cell * 8.3) * (B - 0.1), 0.05, 0.03);
    }
    this.drawMud(ctx, v, time);
    // Labio del fondo y luz del borde de delante.
    ctx.beginPath();
    for (let i = 0; i < n; i++) (i ? ctx.lineTo : ctx.moveTo).call(ctx, xs[i], ys[i] + B);
    ctx.strokeStyle = rgba(g.crustShade, 0.8);
    ctx.lineWidth = 0.05;
    ctx.stroke();
    ctx.beginPath();
    for (let i = 0; i < n; i++) (i ? ctx.lineTo : ctx.moveTo).call(ctx, xs[i], ys[i] - 0.01);
    ctx.strokeStyle = g.rim;
    ctx.lineWidth = 0.06;
    ctx.stroke();

    if (g.grass) this.drawGrass(ctx, x0, x1, g.grass, time, TRACK_BAND - 0.02);
    this.drawPits(ctx, v, time);
  }

  private drawGrass(ctx: CanvasRenderingContext2D, x0: number, x1: number, color: string, time: number, lift: number): void {
    const t = this.track.terrain;
    ctx.lineCap = 'round';
    ctx.lineWidth = 0.022;
    // Dos tonos, un solo trazo por tono: cientos de briznas en dos llamadas.
    for (const tone of [0, 1]) {
      ctx.strokeStyle = tone ? color : shade(color, 0.18);
      ctx.beginPath();
      for (let cell = Math.floor(x0 / 0.45); cell * 0.45 < x1; cell++) {
        const r = hash1(cell * 2.13 + 0.5);
        if (r < 0.45) continue;
        const x = cell * 0.45 + hash1(cell * 4.1) * 0.4;
        if (Math.abs(t.slopeAt(x)) > 0.45) continue;
        const y = this.h(x) + lift;
        const blades = 3 + Math.floor(r * 4);
        const sway = Math.sin(time * 2 + x * 0.7) * 0.03;
        for (let k = tone; k < blades; k += 2) {
          const bx = x + (k - blades / 2) * 0.035;
          const len = 0.1 + hash1(cell * 9.7 + k) * 0.16;
          ctx.moveTo(bx, y);
          ctx.quadraticCurveTo(bx + sway, y + len * 0.6, bx + (k - blades / 2) * 0.03 + sway * 2, y + len);
        }
      }
      ctx.stroke();
    }
  }

  private drawMud(ctx: CanvasRenderingContext2D, v: View, time: number): void {
    const B = TRACK_BAND;
    const wet = mix(this.theme.ground.crustShade, '#1e140c', 0.45);
    const sky = this.theme.night ? '#6f8fe0' : this.theme.skyMid;
    for (const z of this.track.terrain.mud) {
      if (z.x1 < v.x0 - 1 || z.x0 > v.x1 + 1) continue;
      const pts: Array<[number, number, number]> = [];
      for (let x = z.x0 - 0.4; x <= z.x1 + 0.4; x += 0.25) {
        const e = Math.min(1, Math.min(x - (z.x0 - 0.4), z.x1 + 0.4 - x) / 1.2);
        const wob = (noise1(x * 0.8 + z.x0) - 0.5) * 0.08;
        pts.push([x, this.h(x) + 0.03 + (1 - e) * B * 0.4 + wob, this.h(x) + B - 0.05 - (1 - e) * B * 0.4 - wob]);
      }
      ctx.beginPath();
      pts.forEach(([x, lo], i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, x, lo));
      for (let i = pts.length - 1; i >= 0; i--) ctx.lineTo(pts[i][0], pts[i][2]);
      ctx.closePath();
      ctx.fillStyle = wet;
      ctx.fill();
      // Charcos que reflejan el cielo, con ondas.
      for (let k = 0; k < Math.max(1, Math.floor((z.x1 - z.x0) / 4)); k++) {
        const px = z.x0 + ((k + 0.5) / Math.max(1, Math.floor((z.x1 - z.x0) / 4))) * (z.x1 - z.x0);
        const py = this.h(px) + B * (0.35 + hash1(px) * 0.3);
        const w = 0.9 + hash1(px * 3.1) * 1.2;
        ctx.fillStyle = rgba(sky, 0.28);
        ctx.beginPath();
        ctx.ellipse(px, py, w, 0.07, Math.atan(this.track.terrain.slopeAt(px)), 0, TAU);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.22)';
        ctx.lineWidth = 0.015;
        const rr = ((time * 0.6 + hash1(px * 7)) % 1) * w;
        ctx.beginPath();
        ctx.ellipse(px, py, rr, 0.05 * (rr / w), 0, 0, TAU);
        ctx.stroke();
      }
      // Brillos de barro mojado.
      ctx.strokeStyle = 'rgba(255,245,230,0.16)';
      ctx.lineWidth = 0.02;
      ctx.beginPath();
      for (let x = z.x0; x < z.x1; x += 0.7) {
        const y = this.h(x) + 0.1 + hash1(x * 5.3) * (B - 0.2);
        ctx.moveTo(x, y);
        ctx.lineTo(x + 0.25 + hash1(x) * 0.3, y + 0.01);
      }
      ctx.stroke();
    }
  }

  private drawPits(ctx: CanvasRenderingContext2D, v: View, time: number): void {
    for (const pit of this.track.pits) {
      if (pit.endX < v.x0 - 3 || pit.startX > v.x1 + 3) continue;
      let floor = Infinity;
      for (let x = pit.startX; x <= pit.endX; x += 0.5) floor = Math.min(floor, this.h(x));
      const a = pit.startX - 1.2;
      const b = pit.endX + 1.2;
      const top = pit.killY + 0.6;
      const grad = ctx.createLinearGradient(0, top, 0, floor);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, 'rgba(0,0,0,0.55)');
      ctx.fillStyle = grad;
      ctx.fillRect(a, floor - 0.5, b - a, top - floor + 0.5);

      const hazard = this.theme.pitHazard ?? 'rocks';
      if (hazard === 'water') {
        const level = floor + 1.4;
        const wg = ctx.createLinearGradient(0, level, 0, floor);
        wg.addColorStop(0, 'rgba(70,120,130,0.92)');
        wg.addColorStop(1, 'rgba(20,40,50,0.95)');
        ctx.fillStyle = wg;
        ctx.beginPath();
        ctx.moveTo(a, floor - 1);
        for (let x = a; x <= b; x += 0.3) ctx.lineTo(x, level + Math.sin(x * 1.3 + time * 2) * 0.06);
        ctx.lineTo(b, floor - 1);
        ctx.fill();
        ctx.strokeStyle = 'rgba(200,235,240,0.6)';
        ctx.lineWidth = 0.05;
        ctx.beginPath();
        for (let x = a; x <= b; x += 0.3) (x === a ? ctx.moveTo : ctx.lineTo).call(ctx, x, level + Math.sin(x * 1.3 + time * 2) * 0.06);
        ctx.stroke();
      } else if (hazard === 'fire') {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const glow = ctx.createLinearGradient(0, floor, 0, floor + 5);
        glow.addColorStop(0, 'rgba(255,120,30,0.6)');
        glow.addColorStop(1, 'rgba(255,60,0,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(a, floor, b - a, 5);
        for (let x = pit.startX; x < pit.endX; x += 0.45) {
          const r = hash1(x * 3.1);
          const hgt = 1 + r * 1.6 + Math.sin(time * 9 + r * 20) * 0.5;
          const w = 0.35 + r * 0.25;
          const base = this.h(x);
          ctx.fillStyle = `rgba(255,${Math.round(90 + r * 90)},20,0.55)`;
          ctx.beginPath();
          ctx.moveTo(x - w, base);
          ctx.quadraticCurveTo(x - w * 0.2, base + hgt * 0.6, x + Math.sin(time * 7 + r * 9) * 0.2, base + hgt);
          ctx.quadraticCurveTo(x + w * 0.3, base + hgt * 0.5, x + w, base);
          ctx.fill();
        }
        ctx.restore();
      } else {
        // Rocas afiladas en el fondo.
        ctx.fillStyle = shade(this.theme.ground.strata[3], -0.2);
        for (let x = pit.startX; x < pit.endX; x += 0.8) {
          const r = hash1(x * 5.7);
          const base = this.h(x);
          ctx.beginPath();
          ctx.moveTo(x - 0.4, base - 0.1);
          ctx.lineTo(x - 0.05 + r * 0.1, base + 0.4 + r * 0.7);
          ctx.lineTo(x + 0.4, base - 0.1);
          ctx.fill();
        }
      }
    }
  }

  // ------------------------------------------------------------ obstaculos
  drawObstacles(ctx: CanvasRenderingContext2D, v: View): void {
    for (const o of this.track.obstacles) {
      if (o.x < v.x0 - 2 || o.x > v.x1 + 2) continue;
      if (o.kind === 'log') this.drawLog(ctx, o);
      else if (o.kind === 'rock') this.drawRock(ctx, o);
      else if (o.kind === 'tire') this.drawTire(ctx, o);
    }
  }

  private drawLog(ctx: CanvasRenderingContext2D, o: Obstacle): void {
    const r = o.size;
    const cx = o.x;
    const cy = this.h(o.x) - r;
    // Tronco cruzado en la pista: cuerpo de corteza hasta el borde del fondo.
    const far = TRACK_BAND * 0.95;
    ctx.fillStyle = '#3b2616';
    ctx.beginPath();
    ctx.arc(cx, cy + far, r, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#56381f';
    ctx.fillRect(cx - r, cy, r * 2, far);
    ctx.strokeStyle = 'rgba(30,18,8,0.55)';
    ctx.lineWidth = 0.02;
    ctx.beginPath();
    for (let k = -2; k <= 2; k++) {
      ctx.moveTo(cx + k * r * 0.35, cy + r * 0.2);
      ctx.lineTo(cx + k * r * 0.35 + 0.02, cy + far);
    }
    ctx.stroke();
    ctx.fillStyle = '#4a2f1c';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#c99a62';
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.84, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(110,70,35,0.7)';
    ctx.lineWidth = 0.018;
    for (let k = 1; k <= 4; k++) {
      ctx.beginPath();
      ctx.arc(cx + 0.02, cy - 0.01, r * 0.84 * (k / 5), 0, TAU);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(70,40,20,0.8)';
    ctx.lineWidth = 0.025;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + r * 0.6, cy + r * 0.3);
    ctx.stroke();
    // Musgo encima.
    ctx.fillStyle = 'rgba(90,140,60,0.8)';
    ctx.beginPath();
    ctx.arc(cx - r * 0.2, cy + r * 0.92, r * 0.28, 0, Math.PI);
    ctx.fill();
  }

  private drawRock(ctx: CanvasRenderingContext2D, o: Obstacle): void {
    // Otra piedra mas pequeña en el fondo de la pista.
    ctx.save();
    ctx.translate(o.x + (hash1(o.seed * 3.3) - 0.5) * 0.6, this.h(o.x) + TRACK_BAND * 0.6);
    ctx.scale(0.6, 0.6);
    ctx.fillStyle = shade(this.theme.ground.strata[2], -0.1);
    ctx.beginPath();
    ctx.moveTo(-0.5, -0.05);
    ctx.lineTo(-0.3, 0.35);
    ctx.lineTo(0.15, 0.45);
    ctx.lineTo(0.5, 0.1);
    ctx.lineTo(0.55, -0.05);
    ctx.fill();
    ctx.restore();

    const hgt = o.size;
    const half = hgt * (1.3 + hash1(o.seed * 2.3) * 0.6);
    const base = this.h(o.x - half - 0.1);
    const base2 = this.h(o.x + half + 0.1);
    const pts: Array<[number, number]> = [];
    const N = 9;
    for (let i = 0; i <= N; i++) {
      const dx = (i / N - 0.5) * 2 * half;
      const prof = hgt * Math.pow(Math.max(0, 1 - (dx / half) ** 2), 0.7);
      const b = base + (base2 - base) * (i / N);
      const jag = i > 0 && i < N ? (hash1(o.seed + i * 3.3) - 0.5) * hgt * 0.25 : 0;
      pts.push([o.x + dx, b + prof + jag]);
    }
    const col = this.theme.rockColor ?? shade(this.theme.ground.strata[1], 0.05);
    ctx.fillStyle = shade(col, -0.25);
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1] - 0.1);
    for (const [x, y] of pts) ctx.lineTo(x, y);
    ctx.lineTo(pts[N][0], pts[N][1] - 0.1);
    ctx.fill();
    // Cara iluminada.
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(pts[1][0], pts[1][1] - hgt * 0.3);
    for (let i = 1; i < N - 2; i++) ctx.lineTo(pts[i][0], pts[i][1] - 0.02);
    ctx.lineTo(o.x + half * 0.2, base - 0.05);
    ctx.fill();
    ctx.fillStyle = shade(col, 0.3);
    ctx.beginPath();
    ctx.moveTo(pts[2][0], pts[2][1] - 0.03);
    ctx.lineTo(pts[3][0], pts[3][1] - 0.02);
    ctx.lineTo(pts[4][0], pts[4][1] - 0.05);
    ctx.lineTo(pts[3][0], pts[3][1] - hgt * 0.35);
    ctx.fill();
  }

  private drawTire(ctx: CanvasRenderingContext2D, o: Obstacle, depthStep = 2): void {
    if (depthStep > 0) {
      // Fila de neumaticos a lo ancho de la pista: primero los del fondo.
      for (let k = depthStep; k >= 1; k--) {
        ctx.save();
        ctx.translate(0, (TRACK_BAND * 0.42 * k) / depthStep * 2 * 0.5 + 0.02 * k);
        this.drawTire(ctx, o, 0);
        ctx.restore();
      }
    }
    const r = o.size;
    const cx = o.x;
    const cy = this.h(o.x) - r * 0.8;
    ctx.fillStyle = '#18181b';
    ctx.beginPath();
    ctx.ellipse(cx, cy, r, r * 0.8, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = hash1(o.seed) > 0.5 ? '#f4f4f0' : this.theme.accent;
    ctx.lineWidth = 0.07;
    ctx.beginPath();
    ctx.ellipse(cx, cy, r * 0.72, r * 0.56, 0, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = '#0a0a0c';
    ctx.beginPath();
    ctx.ellipse(cx, cy, r * 0.42, r * 0.32, 0, 0, TAU);
    ctx.fill();
  }

  // -------------------------------------------------------------- decorado
  /** depth 1 = detras de la pista (antes del terreno); 0 = junto a la pista. */
  drawProps(ctx: CanvasRenderingContext2D, v: View, depth: 0 | 1, time: number): void {
    for (const p of this.track.props) {
      if ((p.depth > 0 ? 1 : 0) !== depth) continue;
      if (p.x < v.x0 - 12 || p.x > v.x1 + 12) continue;
      const fog = depth ? 0.3 : 0;
      const s = p.scale * (depth ? 0.82 : 1);
      ctx.save();
      ctx.translate(p.x, this.h(p.x) + (depth ? TRACK_BAND + 0.2 : TRACK_BAND - 0.02));
      ctx.scale(s, s);
      this.drawProp(ctx, p, fog, time);
      ctx.restore();
    }
    if (depth === 1) this.drawSectionSigns(ctx, v);
  }

  private c(hex: string, fog: number): string {
    return fog > 0 ? mix(hex, this.haze, fog) : hex;
  }

  private drawProp(ctx: CanvasRenderingContext2D, p: Prop, fog: number, time: number): void {
    const c = (hex: string): string => this.c(hex, fog);
    const acc = this.theme.accent;
    switch (p.kind) {
      case 'tires': {
        for (let stack = 0; stack < 2; stack++) {
          const ox = stack * 0.72;
          const n = 3 + (stack === 0 ? 1 : 0);
          for (let k = 0; k < n; k++) {
            const y = k * 0.26 + 0.13;
            ctx.fillStyle = c('#1b1b1f');
            ctx.beginPath();
            ctx.ellipse(ox, y, 0.36, 0.14, 0, 0, TAU);
            ctx.fill();
            ctx.fillStyle = c(k % 2 ? '#f2f2ee' : acc);
            ctx.fillRect(ox - 0.36, y - 0.03, 0.72, 0.06);
          }
        }
        break;
      }
      case 'flag': {
        ctx.fillStyle = c('#d8dce2');
        ctx.fillRect(-0.03, 0, 0.06, 3.4);
        const wave = (u: number): number => Math.sin(time * 5 + u * 5 + p.seed) * 0.12 * u;
        ctx.fillStyle = c(acc);
        ctx.beginPath();
        ctx.moveTo(0.03, 3.35);
        for (let u = 0; u <= 1; u += 0.1) ctx.lineTo(0.03 + u * 1.3, 3.35 + wave(u) - u * 0.08);
        for (let u = 1; u >= 0; u -= 0.1) ctx.lineTo(0.03 + u * 1.3, 2.55 + wave(u) + u * 0.08);
        ctx.fill();
        ctx.fillStyle = c('#ffffff');
        ctx.beginPath();
        ctx.arc(0.6, 2.95 + wave(0.45), 0.13, 0, TAU);
        ctx.fill();
        break;
      }
      case 'banner': {
        ctx.fillStyle = c('#2a2d35');
        ctx.fillRect(-2.2, 0, 0.1, 3.2);
        ctx.fillRect(2.1, 0, 0.1, 3.2);
        ctx.fillStyle = c('#15171d');
        ctx.fillRect(-2.2, 2.2, 4.4, 1.0);
        ctx.fillStyle = c(acc);
        ctx.fillRect(-2.2, 2.2, 4.4, 0.14);
        ctx.fillRect(-2.2, 3.06, 4.4, 0.14);
        worldText(ctx, 'HOLESHOT', 0, 2.7, 0.62, c('#ffffff'));
        break;
      }
      case 'cactus': {
        const g = c('#4f7a3a');
        const gd = c('#3a5c2a');
        const arm = (x: number, y0: number, up: number, dir: number): void => {
          ctx.strokeStyle = gd;
          ctx.lineWidth = 0.28;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(x, y0);
          ctx.lineTo(x + dir * 0.45, y0);
          ctx.lineTo(x + dir * 0.45, y0 + up);
          ctx.stroke();
        };
        arm(0, 1.2, 0.8, -1);
        arm(0, 1.6, 0.7, 1);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.roundRect(-0.2, 0, 0.4, 2.9, 0.2);
        ctx.fill();
        ctx.strokeStyle = gd;
        ctx.lineWidth = 0.03;
        for (const dx of [-0.08, 0.06]) {
          ctx.beginPath();
          ctx.moveTo(dx, 0.1);
          ctx.lineTo(dx, 2.75);
          ctx.stroke();
        }
        break;
      }
      case 'boulder': {
        const col = c(shade(this.theme.ground.strata[1], 0.08));
        ctx.fillStyle = c(shade(this.theme.ground.strata[2], -0.1));
        ctx.beginPath();
        ctx.moveTo(-1.6, 0);
        ctx.lineTo(-1.3, 1.1);
        ctx.lineTo(-0.4, 1.8);
        ctx.lineTo(0.8, 1.6);
        ctx.lineTo(1.5, 0.7);
        ctx.lineTo(1.7, 0);
        ctx.fill();
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(-1.3, 1.1);
        ctx.lineTo(-0.4, 1.8);
        ctx.lineTo(0.8, 1.6);
        ctx.lineTo(0.2, 0.9);
        ctx.fill();
        break;
      }
      case 'tree': {
        ctx.fillStyle = c('#4a3222');
        ctx.fillRect(-0.15, 0, 0.3, 2.4);
        const blobs: Array<[number, number, number]> = [[0, 3.2, 1.3], [-0.9, 2.6, 0.9], [0.9, 2.7, 0.95], [0.2, 4, 0.9]];
        blobs.forEach(([x, y, r], i) => {
          ctx.fillStyle = c(i % 2 ? '#2f5a36' : '#3b6d40');
          ctx.beginPath();
          ctx.arc(x, y, r, 0, TAU);
          ctx.fill();
        });
        ctx.fillStyle = c('#5c8f52');
        ctx.beginPath();
        ctx.arc(-0.3, 3.6, 0.5, 0, TAU);
        ctx.fill();
        break;
      }
      case 'pine': {
        ctx.fillStyle = c('#3a2a1c');
        ctx.fillRect(-0.12, 0, 0.24, 1.2);
        for (let k = 0; k < 4; k++) {
          const y = 0.8 + k * 1.05;
          const w = 1.5 - k * 0.3;
          ctx.fillStyle = c(k % 2 ? '#1f4a36' : '#275a40');
          ctx.beginPath();
          ctx.moveTo(-w, y);
          ctx.lineTo(0, y + 1.7);
          ctx.lineTo(w, y);
          ctx.fill();
        }
        break;
      }
      case 'fence': {
        ctx.fillStyle = c('#7a5a3a');
        for (let k = 0; k < 5; k++) ctx.fillRect(k * 1.4 - 0.05, 0, 0.1, 1.1);
        ctx.fillRect(-0.1, 0.75, 5.8, 0.08);
        ctx.fillRect(-0.1, 0.4, 5.8, 0.08);
        break;
      }
      case 'crowd': {
        this.drawCrowd(ctx, fog, time, p.seed);
        break;
      }
      case 'light': {
        ctx.strokeStyle = c('#3a4150');
        ctx.lineWidth = 0.1;
        ctx.beginPath();
        ctx.moveTo(-0.4, 0);
        ctx.lineTo(0, 9);
        ctx.lineTo(0.4, 0);
        ctx.stroke();
        for (let y = 1; y < 9; y += 1) {
          const w = 0.4 * (1 - y / 9);
          ctx.beginPath();
          ctx.moveTo(-w, y);
          ctx.lineTo(w, y + 0.5);
          ctx.stroke();
        }
        ctx.fillStyle = c('#222733');
        ctx.fillRect(-1, 8.8, 2, 0.9);
        ctx.fillStyle = this.theme.night ? '#f4f8ff' : c('#c9d2e0');
        for (let k = 0; k < 4; k++) ctx.fillRect(-0.9 + k * 0.47, 9, 0.36, 0.5);
        break;
      }
      case 'crane': {
        const y = c('#f2b01e');
        ctx.strokeStyle = y;
        ctx.lineWidth = 0.12;
        ctx.beginPath();
        ctx.moveTo(-0.4, 0);
        ctx.lineTo(-0.4, 8);
        ctx.moveTo(0.4, 0);
        ctx.lineTo(0.4, 8);
        for (let k = 0; k < 8; k++) {
          ctx.moveTo(-0.4, k);
          ctx.lineTo(0.4, k + 1);
        }
        ctx.moveTo(-2, 8);
        ctx.lineTo(7, 8);
        ctx.moveTo(-2, 8.6);
        ctx.lineTo(7, 8);
        ctx.moveTo(0, 8);
        ctx.lineTo(0, 9.3);
        ctx.lineTo(7, 8);
        ctx.stroke();
        ctx.strokeStyle = c('#2a2a2a');
        ctx.lineWidth = 0.04;
        const hook = 5.2 + Math.sin(time * 0.8 + p.seed) * 0.15;
        ctx.beginPath();
        ctx.moveTo(hook, 8);
        ctx.lineTo(hook, 4.5);
        ctx.stroke();
        ctx.fillStyle = c('#555a62');
        ctx.fillRect(hook - 0.3, 3.9, 0.6, 0.6);
        ctx.fillStyle = c('#3a3f47');
        ctx.fillRect(-2.2, 7.2, 1.4, 0.8);
        break;
      }
      case 'sign': {
        ctx.fillStyle = c('#6a6f78');
        ctx.fillRect(-0.04, 0, 0.08, 1.6);
        ctx.save();
        ctx.translate(0, 1.9);
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = c('#1a1a1a');
        ctx.fillRect(-0.42, -0.42, 0.84, 0.84);
        ctx.fillStyle = c('#ffcc1a');
        ctx.fillRect(-0.36, -0.36, 0.72, 0.72);
        ctx.restore();
        worldText(ctx, '!', 0, 1.88, 0.55, c('#1a1a1a'));
        break;
      }
      case 'hay': {
        for (let k = 0; k < 3; k++) {
          const x = (k - 1) * 0.95;
          const y = k === 1 ? 0.55 : 0;
          ctx.fillStyle = c('#d9b556');
          ctx.fillRect(x - 0.45, y, 0.9, 0.55);
          ctx.strokeStyle = c('#a8842e');
          ctx.lineWidth = 0.03;
          for (let s = 1; s < 4; s++) {
            ctx.beginPath();
            ctx.moveTo(x - 0.45, y + s * 0.14);
            ctx.lineTo(x + 0.45, y + s * 0.14);
            ctx.stroke();
          }
          ctx.fillStyle = c(this.theme.accent);
          ctx.fillRect(x - 0.45, y + 0.2, 0.9, 0.06);
        }
        break;
      }
    }
  }

  private drawCrowd(ctx: CanvasRenderingContext2D, fog: number, time: number, seed: number): void {
    const c = (hex: string): string => this.c(hex, fog);
    // Grada metalica con tejadillo.
    ctx.fillStyle = c('#2b303a');
    ctx.beginPath();
    ctx.moveTo(-4, 0);
    ctx.lineTo(-4, 0.6);
    ctx.lineTo(4, 2.6);
    ctx.lineTo(4, 0);
    ctx.fill();
    for (let row = 0; row < 5; row++) {
      const y = 0.6 + row * 0.42;
      const x0 = -4 + row * 1.6;
      ctx.fillStyle = c('#3d4452');
      ctx.fillRect(x0, y - 0.05, 8 - row * 1.6, 0.08);
      for (let x = x0 + 0.2; x < 4; x += 0.34) {
        const r = hash1(x * 3.7 + row * 11 + seed);
        if (r < 0.15) continue;
        const jump = Math.max(0, Math.sin(time * (5 + r * 3) + r * 20)) * 0.08;
        const body = `hsl(${Math.round(r * 360)},${fog ? 25 : 60}%,${fog ? 55 : 50}%)`;
        ctx.fillStyle = body;
        ctx.fillRect(x - 0.1, y + jump, 0.2, 0.26);
        ctx.fillStyle = c(r > 0.5 ? '#e0b48f' : '#8a5a3c');
        ctx.beginPath();
        ctx.arc(x, y + 0.34 + jump, 0.08, 0, TAU);
        ctx.fill();
        if (r > 0.8) {
          ctx.strokeStyle = body;
          ctx.lineWidth = 0.05;
          ctx.beginPath();
          ctx.moveTo(x + 0.08, y + 0.22 + jump);
          ctx.lineTo(x + 0.18, y + 0.5 + jump * 2);
          ctx.stroke();
        }
      }
    }
    ctx.fillStyle = c('#1d2129');
    ctx.fillRect(-4.2, 3.4, 8.6, 0.18);
    ctx.fillRect(-3.9, 0, 0.1, 3.4);
    ctx.fillRect(3.9, 0, 0.1, 3.5);
  }

  private drawSectionSigns(ctx: CanvasRenderingContext2D, v: View): void {
    for (const s of this.track.sections) {
      if (s.name === 'SALIDA' || s.name === 'META' || s.name === 'PARRILLA') continue;
      if (s.x < v.x0 - 5 || s.x > v.x1 + 5) continue;
      const y = this.h(s.x) + TRACK_BAND + 0.15;
      ctx.fillStyle = '#3b2c20';
      ctx.fillRect(s.x - 0.05, y, 0.1, 2.2);
      const name = tr(s.name);
      const w = Math.max(2.2, worldTextWidth(ctx, name, 0.34) + 0.5);
      ctx.fillStyle = '#1a1c22';
      ctx.fillRect(s.x - w / 2, y + 1.9, w, 0.6);
      ctx.fillStyle = this.theme.accent;
      ctx.fillRect(s.x - w / 2, y + 1.9, 0.12, 0.6);
      worldText(ctx, name, s.x + 0.05, y + 2.2, 0.34, '#f5f2ea');
    }
  }

  // ------------------------------------------------ salida, checkpoints, meta
  /** `gate` = 0 parrilla levantada, 1 caida del todo. */
  drawGates(ctx: CanvasRenderingContext2D, v: View, reached: number, time: number, gate: number): void {
    const t = this.track;
    // Parrilla de salida: una rejilla por carril que cae hacia delante.
    if (t.startX > v.x0 - 5 && t.startX < v.x1 + 5) {
      this.featherFlag(ctx, t.startX - 1.5, 'START', '#ffffff', this.theme.accent, time);
      const x = t.startX + 1.35;
      const fall = Math.min(1, gate) ** 2;
      for (let lane = 3; lane >= 0; lane--) {
        const y = this.h(x) + laneOffset(lane);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(-fall * Math.PI * 0.5);
        ctx.fillStyle = mix('#2a2e38', this.haze, lane * 0.08);
        ctx.fillRect(-0.05, 0, 0.1, 0.62);
        ctx.fillStyle = mix('#c8ced8', this.haze, lane * 0.08);
        for (let k = 0; k < 4; k++) ctx.fillRect(-0.03, 0.08 + k * 0.14, 0.06, 0.08);
        ctx.fillStyle = this.theme.accent;
        ctx.fillRect(-0.05, 0.56, 0.1, 0.06);
        ctx.restore();
      }
      ctx.fillStyle = this.theme.accent;
      ctx.fillRect(t.startX - 1.2, this.h(t.startX) + 0.005, 2.6, 0.04);
    }
    t.checkpoints.forEach((cx, i) => {
      if (i === 0 || cx < v.x0 - 5 || cx > v.x1 + 5) return;
      const on = i <= reached;
      this.featherFlag(ctx, cx, 'CP', on ? '#ffffff' : '#c8ccd4', on ? this.theme.accent : '#4a4f5c', time);
    });
    // Arco de meta a cuadros.
    const fx = t.finishX;
    if (fx > v.x0 - 8 && fx < v.x1 + 8) {
      const y0 = this.h(fx - 3);
      const y1 = this.h(fx + 3);
      const top = Math.max(y0, y1) + 4.2;
      ctx.fillStyle = '#20232b';
      ctx.fillRect(fx - 3.2, y0, 0.35, top - y0);
      ctx.fillRect(fx + 2.85, y1, 0.35, top - y1);
      const sq = 0.35;
      for (let i = 0; i < 18; i++) {
        for (let j = 0; j < 3; j++) {
          ctx.fillStyle = (i + j) % 2 ? '#111' : '#f5f5f5';
          ctx.fillRect(fx - 3.2 + i * sq, top + j * sq, sq, sq);
        }
      }
      ctx.fillStyle = this.theme.accent;
      ctx.fillRect(fx - 3.2, top + 1.05, 6.4, 0.5);
      worldText(ctx, tr('META'), fx, top + 1.3, 0.42, '#ffffff');
    }
  }

  private featherFlag(ctx: CanvasRenderingContext2D, x: number, label: string, fg: string, bg: string, time: number): void {
    const y = this.h(x) + TRACK_BAND;
    ctx.fillStyle = '#9aa1ad';
    ctx.fillRect(x - 0.03, y, 0.06, 3.6);
    const sway = Math.sin(time * 3 + x) * 0.05;
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.moveTo(x + 0.03, y + 3.6);
    ctx.quadraticCurveTo(x + 0.95 + sway, y + 3.5, x + 0.75 + sway, y + 1.2);
    ctx.lineTo(x + 0.03, y + 1.0);
    ctx.fill();
    ctx.save();
    ctx.translate(x + 0.42 + sway * 0.5, y + 2.3);
    ctx.rotate(-Math.PI / 2);
    worldText(ctx, label, 0, 0, 0.36, fg);
    ctx.restore();
  }

  // ------------------------------------------------------------ recogibles
  drawPickups(ctx: CanvasRenderingContext2D, v: View, pickups: Pickup[], collected: boolean[], time: number): void {
    pickups.forEach((p, i) => {
      if (collected[i] || p.x < v.x0 - 2 || p.x > v.x1 + 2) return;
      const bob = Math.sin(time * 3 + i) * 0.1;
      ctx.save();
      ctx.translate(p.x, p.y + bob);
      const glow = ctx.createRadialGradient(0, 0, 0.1, 0, 0, 1.3);
      glow.addColorStop(0, p.kind === 'plate' ? 'rgba(255,215,90,0.55)' : 'rgba(90,200,255,0.55)');
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(-1.3, -1.3, 2.6, 2.6);
      const spin = Math.cos(time * 2.6 + i);
      ctx.scale(Math.max(0.12, Math.abs(spin)), 1);
      if (p.kind === 'plate') {
        ctx.fillStyle = spin > 0 ? '#ffd23f' : '#d99a1a';
        ctx.beginPath();
        ctx.roundRect(-0.42, -0.5, 0.84, 1.0, 0.16);
        ctx.fill();
        ctx.strokeStyle = '#fff2b0';
        ctx.lineWidth = 0.06;
        ctx.stroke();
        worldText(ctx, '1', 0, -0.02, 0.72, '#6b4100');
      } else {
        ctx.fillStyle = '#1a76d2';
        ctx.beginPath();
        ctx.roundRect(-0.28, -0.46, 0.56, 0.92, 0.12);
        ctx.fill();
        ctx.fillStyle = '#8fe3ff';
        ctx.beginPath();
        ctx.moveTo(0.06, 0.34);
        ctx.lineTo(-0.16, -0.02);
        ctx.lineTo(0.02, -0.02);
        ctx.lineTo(-0.06, -0.34);
        ctx.lineTo(0.16, 0.06);
        ctx.lineTo(-0.02, 0.06);
        ctx.fill();
      }
      ctx.restore();
    });
  }

  // --------------------------------------------------------------- tormenta
  drawStorm(ctx: CanvasRenderingContext2D, v: View, stormX: number, time: number): void {
    if (!Number.isFinite(stormX) || stormX < v.x0 - 6) return;
    const edge = (y: number): number => stormX + (noise1(y * 0.35 + time * 1.4) - 0.5) * 4 + (noise1(y * 1.3 - time * 3) - 0.5) * 1.2;
    const yb = v.yBottom - 1;
    const yt = v.yTop + 1;
    ctx.save();
    for (let layer = 0; layer < 3; layer++) {
      const off = layer * 1.8;
      ctx.fillStyle = ['rgba(150,95,50,0.55)', 'rgba(185,125,70,0.6)', 'rgba(120,75,40,0.85)'][layer];
      ctx.beginPath();
      ctx.moveTo(v.x0 - 2, yb);
      for (let y = yb; y <= yt; y += 0.6) ctx.lineTo(edge(y + layer * 7) - off, y);
      ctx.lineTo(v.x0 - 2, yt);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(255,225,170,0.25)';
    ctx.lineWidth = 0.08;
    for (let k = 0; k < 14; k++) {
      const y = yb + ((k * 1.7 + time * 3) % (yt - yb));
      const x = edge(y) - 1 - hash1(k) * 6;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 2 - hash1(k * 3) * 3, y - 0.3);
      ctx.stroke();
    }
    ctx.restore();
  }
}
