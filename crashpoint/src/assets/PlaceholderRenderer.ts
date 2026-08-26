import type { ShapeDescriptor } from '../entities/GameEntity';

export interface PlaceholderStyle {
  fill: string;
  stroke: string;
  /** 0..1 — draws crack lines/darkening as damage accumulates. */
  damage?: number;
  broken?: boolean;
  label?: string;
}

/**
 * Draws a clearly-fake, clearly-labeled placeholder shape. Every placeholder gets a diagonal
 * hatch so it reads as "temporary art" at a glance (section 38) — never mistaken for final.
 */
export function drawPlaceholder(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  shape: ShapeDescriptor,
  style: PlaceholderStyle
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  const w = shape.kind === 'rectangle' ? shape.width : shape.radius * 2;
  const h = shape.kind === 'rectangle' ? shape.height : shape.radius * 2;

  ctx.beginPath();
  if (shape.kind === 'rectangle') {
    ctx.rect(-w / 2, -h / 2, w, h);
  } else {
    ctx.arc(0, 0, shape.radius, 0, Math.PI * 2);
  }
  ctx.fillStyle = style.broken ? shadeColor(style.fill, -0.35) : style.fill;
  ctx.fill();
  ctx.lineWidth = Math.max(1.5, Math.min(w, h) * 0.03);
  ctx.strokeStyle = style.stroke;
  ctx.stroke();

  // Placeholder hatch — clearly non-final art.
  ctx.save();
  ctx.clip();
  ctx.globalAlpha = 0.16;
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 3;
  const step = Math.max(10, Math.min(w, h) / 4);
  for (let i = -w - h; i < w + h; i += step) {
    ctx.beginPath();
    ctx.moveTo(i, -h);
    ctx.lineTo(i + h * 2, h);
    ctx.stroke();
  }
  ctx.restore();

  if (style.damage && style.damage > 0.15) drawDamageCracks(ctx, w, h, style.damage);

  ctx.restore();
}

/**
 * Crack lines scaled to accumulated damage. Shared by the procedural placeholder above and by
 * real production sprites (drawn on top of a loaded PNG so damage still reads once art lands).
 * Caller must have already translated to the piece center and clipped to its shape.
 */
export function drawDamageCracks(ctx: CanvasRenderingContext2D, w: number, h: number, damage: number): void {
  ctx.save();
  ctx.globalAlpha = Math.min(0.8, damage);
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 1.5;
  const cracks = Math.floor(damage * 4) + 1;
  for (let i = 0; i < cracks; i++) {
    const cx = (Math.sin(i * 12.9898) * 0.5) * w;
    const cy = (Math.cos(i * 78.233) * 0.5) * h;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + (Math.sin(i * 4.2) * w) / 3, cy + (Math.cos(i * 3.1) * h) / 3);
    ctx.stroke();
  }
  ctx.restore();
}

/** Darkening tint for a broken piece rendered with a real sprite (can't re-shade a PNG's pixels). */
export function drawBrokenTint(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.save();
  ctx.globalAlpha = 0.4;
  ctx.fillStyle = '#000000';
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.restore();
}

function shadeColor(hex: string, amount: number): string {
  const clean = hex.replace('#', '');
  const num = parseInt(clean, 16);
  let r = (num >> 16) & 0xff;
  let g = (num >> 8) & 0xff;
  let b = num & 0xff;
  r = Math.max(0, Math.min(255, Math.round(r + 255 * amount)));
  g = Math.max(0, Math.min(255, Math.round(g + 255 * amount)));
  b = Math.max(0, Math.min(255, Math.round(b + 255 * amount)));
  return `rgb(${r},${g},${b})`;
}
