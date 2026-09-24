/**
 * Portada de revista: en el salto mas grande de la carrera se congela el
 * fotograma y al final se imprime una portada con ese salto, titulares
 * sacados de lo que ha pasado de verdad en la carrera, precio y codigo de
 * barras.
 */
import { makeRng } from '../core/math';
import { fmtDecimal, lang, ordinal, t } from '../i18n';

const W = 600;
const H = 800;
const DISPLAY = '"Russo One", "Arial Black", Impact, sans-serif';
const COND = '"Barlow Condensed", "Arial Narrow", sans-serif';
const MONTHS = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
const MONTHS_EN = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];

/** Recorta del lienzo del juego una foto vertical centrada en el piloto. */
export function capturePhoto(src: HTMLCanvasElement, cssX: number, cssY: number, dpr: number): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = W;
  out.height = H;
  const g = out.getContext('2d') as CanvasRenderingContext2D;
  const sh = Math.min(src.height, src.width * (H / W)) * 0.92;
  const sw = sh * (W / H);
  let sx = cssX * dpr - sw / 2;
  let sy = cssY * dpr - sh * 0.52;
  sx = Math.max(0, Math.min(src.width - sw, sx));
  sy = Math.max(0, Math.min(src.height - sh, sy));
  g.drawImage(src, sx, sy, sw, sh, 0, 0, W, H);
  return out;
}

export interface CoverData {
  missionId: number;
  missionName: string;
  place: string;
  accent: string;
  airTime: number;
  flips: number;
  medal: number;
  position: number | null;
  riders: number;
  time: string;
  crashes: number;
  mud: number;
  holeshot: boolean;
  perfectStart: boolean;
  riderNumber: string;
  riderName: string;
}

function headline(d: CoverData): [string, string] {
  const who = `${d.riderName} (#${d.riderNumber})`;
  const v = { who, m: d.missionName };
  if (d.position === 1) return [t('¡CAMPEÓN!'), t('{who} se corona en {m}', v)];
  if (d.flips >= 2) return [t('¡DOBLE MORTAL!'), t('{who} gira dos veces en {m}', v)];
  if (d.flips === 1) return [t('¡MORTAL!'), t('{who} se da la vuelta en {m}', v)];
  if (d.airTime >= 1.2) return [t('{n} SEGUNDOS', { n: fmtDecimal(d.airTime) }), t('de vuelo de {who}', v)];
  return [t('A FONDO'), t('{who} cruza {m}', v)];
}

function coverLines(d: CoverData): string[] {
  const out: string[] = [];
  if (d.holeshot) out.push(t('Se lleva el HOLESHOT'));
  else if (d.perfectStart) out.push(t('Salida perfecta en la parrilla'));
  if (d.position !== null) out.push(t('Termina {p} de {n}', { p: ordinal(d.position), n: d.riders }));
  out.push(t('{t} en {place}', { t: d.time, place: d.place }));
  if (d.mud > 0.35) out.push(t('Barro hasta el casco ({n} %)', { n: Math.round(d.mud * 100) }));
  out.push(d.crashes === 0 ? t('Cero caídas') : d.crashes === 1 ? t('1 caída y vuelta a subir') : t('{n} caídas y vuelta a subir', { n: d.crashes }));
  return out.slice(0, 4);
}

function fitText(g: CanvasRenderingContext2D, text: string, font: (px: number) => string, maxW: number, start: number): number {
  let px = start;
  g.font = font(px);
  while (g.measureText(text).width > maxW && px > 12) {
    px -= 2;
    g.font = font(px);
  }
  return px;
}

export function renderCover(photo: HTMLCanvasElement | null, d: CoverData): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  if (photo) g.drawImage(photo, 0, 0);
  else {
    g.fillStyle = '#20222b';
    g.fillRect(0, 0, W, H);
  }
  // Degradados para leer los textos.
  const top = g.createLinearGradient(0, 0, 0, 230);
  top.addColorStop(0, 'rgba(0,0,0,0.55)');
  top.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = top;
  g.fillRect(0, 0, W, 230);
  const bot = g.createLinearGradient(0, H * 0.5, 0, H);
  bot.addColorStop(0, 'rgba(0,0,0,0)');
  bot.addColorStop(1, 'rgba(0,0,0,0.82)');
  g.fillStyle = bot;
  g.fillRect(0, H * 0.5, W, H * 0.5);

  // Cabecera.
  g.textBaseline = 'alphabetic';
  g.textAlign = 'left';
  g.save();
  g.translate(26, 132);
  g.transform(1, 0, -0.14, 1, 0, 0);
  const mastPx = fitText(g, 'HOLESHOT', (px) => `400 ${px}px ${DISPLAY}`, W - 52, 124);
  g.font = `400 ${mastPx}px ${DISPLAY}`;
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.fillText('HOLESHOT', 5, 6);
  g.fillStyle = '#ffffff';
  g.fillText('HOLE', 0, 0);
  const holeW = g.measureText('HOLE').width;
  g.fillStyle = d.accent;
  g.fillText('SHOT', holeW, 0);
  g.restore();
  const now = new Date();
  g.font = `800 17px ${COND}`;
  g.fillStyle = '#ffffff';
  g.fillText(`${t('LA REVISTA DEL BARRO · Nº {n}', { n: 100 + d.missionId })} · ${(lang() === 'en' ? MONTHS_EN : MONTHS)[now.getMonth()]} ${now.getFullYear()}`, 28, 162);
  g.textAlign = 'right';
  g.fillText(lang() === 'en' ? '$4.95' : '4,95 €', W - 28, 162);
  g.textAlign = 'left';

  // Titulares laterales.
  const lines = coverLines(d);
  g.font = `800 21px ${COND}`;
  lines.forEach((l, i) => {
    const y = 214 + i * 40;
    g.fillStyle = d.accent;
    g.fillRect(28, y - 17, 5, 22);
    g.fillStyle = '#ffffff';
    g.shadowColor = 'rgba(0,0,0,0.8)';
    g.shadowBlur = 6;
    g.fillText(l.toUpperCase(), 42, y);
    g.shadowBlur = 0;
  });

  // Pegatina.
  const medalName = ['', t('BRONCE'), t('PLATA'), t('ORO')][d.medal] ?? '';
  const stickerColor = d.medal === 3 ? '#ffcf3f' : d.medal === 2 ? '#dfe5ec' : d.medal === 1 ? '#d88a4a' : d.accent;
  g.save();
  g.translate(W - 96, 262);
  g.rotate(0.22);
  g.fillStyle = stickerColor;
  g.beginPath();
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    const r = i % 2 ? 62 : 70;
    (i ? g.lineTo : g.moveTo).call(g, Math.cos(a) * r, Math.sin(a) * r);
  }
  g.closePath();
  g.fill();
  g.fillStyle = '#1a1206';
  g.textAlign = 'center';
  g.font = `800 15px ${COND}`;
  g.fillText(medalName ? t('MEDALLA') : t('EXCLUSIVA'), 0, -8);
  g.font = `400 22px ${DISPLAY}`;
  g.fillText(medalName || t('¡YA!'), 0, 18);
  g.restore();

  // Titular principal.
  const [big, sub] = headline(d);
  g.textAlign = 'left';
  const bigPx = fitText(g, big, (px) => `400 ${px}px ${DISPLAY}`, W - 56, 76);
  g.font = `400 ${bigPx}px ${DISPLAY}`;
  g.fillStyle = '#ffffff';
  g.shadowColor = 'rgba(0,0,0,0.6)';
  g.shadowBlur = 12;
  g.fillText(big, 28, H - 118);
  g.shadowBlur = 0;
  g.font = `800 italic 28px ${COND}`;
  g.fillStyle = d.accent;
  const subPx = fitText(g, sub.toUpperCase(), (px) => `800 italic ${px}px ${COND}`, W - 190, 28);
  g.font = `800 italic ${subPx}px ${COND}`;
  g.fillText(sub.toUpperCase(), 30, H - 78);

  // Codigo de barras.
  const rnd = makeRng(d.missionId * 97 + Math.round(d.airTime * 100));
  g.fillStyle = '#ffffff';
  g.fillRect(W - 150, H - 96, 122, 70);
  g.fillStyle = '#111111';
  let x = W - 142;
  while (x < W - 38) {
    const w = 1 + Math.floor(rnd() * 3);
    g.fillRect(x, H - 88, w, 44);
    x += w + 1 + Math.floor(rnd() * 3);
  }
  g.font = `600 11px ${COND}`;
  g.textAlign = 'center';
  g.fillText(`8 437 0${d.missionId}7 7${Math.round(d.airTime * 10)}`, W - 89, H - 32);
  return c;
}
