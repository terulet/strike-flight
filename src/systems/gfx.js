/**
 * Thin drawing helpers over Canvas2D.
 *
 * Performance notes: shadowBlur is avoided entirely (it is brutally slow on
 * mobile GPUs). Glows are faked with a couple of additive passes, which is
 * both cheaper and more controllable.
 */

export class Gfx {
  constructor(ctx) {
    this.ctx = ctx;
  }

  clear(color, w, h) {
    const c = this.ctx;
    c.globalAlpha = 1;
    c.fillStyle = color;
    c.fillRect(0, 0, w, h);
  }

  rect(x, y, w, h, color, alpha = 1) {
    const c = this.ctx;
    c.globalAlpha = alpha;
    c.fillStyle = color;
    c.fillRect(x, y, w, h);
    c.globalAlpha = 1;
  }

  roundRect(x, y, w, h, r, color, alpha = 1) {
    const c = this.ctx;
    const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    c.globalAlpha = alpha;
    c.fillStyle = color;
    c.beginPath();
    c.moveTo(x + rr, y);
    c.arcTo(x + w, y, x + w, y + h, rr);
    c.arcTo(x + w, y + h, x, y + h, rr);
    c.arcTo(x, y + h, x, y, rr);
    c.arcTo(x, y, x + w, y, rr);
    c.closePath();
    c.fill();
    c.globalAlpha = 1;
  }

  strokeRoundRect(x, y, w, h, r, color, width = 2, alpha = 1) {
    const c = this.ctx;
    const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    c.globalAlpha = alpha;
    c.strokeStyle = color;
    c.lineWidth = width;
    c.beginPath();
    c.moveTo(x + rr, y);
    c.arcTo(x + w, y, x + w, y + h, rr);
    c.arcTo(x + w, y + h, x, y + h, rr);
    c.arcTo(x, y + h, x, y, rr);
    c.arcTo(x, y, x + w, y, rr);
    c.closePath();
    c.stroke();
    c.globalAlpha = 1;
  }

  circle(x, y, r, color, alpha = 1) {
    const c = this.ctx;
    c.globalAlpha = alpha;
    c.fillStyle = color;
    c.beginPath();
    c.arc(x, y, Math.max(0.1, r), 0, Math.PI * 2);
    c.fill();
    c.globalAlpha = 1;
  }

  /** Cheap additive bloom: two soft passes around the shape. */
  glowRect(x, y, w, h, color, strength = 0.5, spread = 6) {
    const c = this.ctx;
    c.globalCompositeOperation = 'lighter';
    c.fillStyle = color;
    c.globalAlpha = strength * 0.35;
    c.fillRect(x - spread, y - spread, w + spread * 2, h + spread * 2);
    c.globalAlpha = strength * 0.45;
    c.fillRect(x - spread * 0.45, y - spread * 0.45, w + spread * 0.9, h + spread * 0.9);
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
  }

  glowCircle(x, y, r, color, strength = 0.5, spread = 6) {
    const c = this.ctx;
    c.globalCompositeOperation = 'lighter';
    c.fillStyle = color;
    c.globalAlpha = strength * 0.3;
    c.beginPath();
    c.arc(x, y, r + spread, 0, Math.PI * 2);
    c.fill();
    c.globalAlpha = strength * 0.45;
    c.beginPath();
    c.arc(x, y, r + spread * 0.45, 0, Math.PI * 2);
    c.fill();
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
  }

  line(x1, y1, x2, y2, color, width = 2, alpha = 1) {
    const c = this.ctx;
    c.globalAlpha = alpha;
    c.strokeStyle = color;
    c.lineWidth = width;
    c.beginPath();
    c.moveTo(x1, y1);
    c.lineTo(x2, y2);
    c.stroke();
    c.globalAlpha = 1;
  }

  text(str, x, y, {
    size = 16,
    color = '#fff',
    align = 'center',
    baseline = 'middle',
    weight = 700,
    alpha = 1,
    letterSpacing = 0,
    family = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
  } = {}) {
    const c = this.ctx;
    c.globalAlpha = alpha;
    c.fillStyle = color;
    c.textAlign = letterSpacing ? 'left' : align;
    c.textBaseline = baseline;
    c.font = `${weight} ${size}px ${family}`;
    if (!letterSpacing) {
      c.fillText(str, x, y);
    } else {
      // Manual tracking: canvas letterSpacing is not universally supported.
      const chars = String(str).split('');
      let total = 0;
      for (const ch of chars) total += c.measureText(ch).width + letterSpacing;
      total -= letterSpacing;
      let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
      for (const ch of chars) {
        c.fillText(ch, cx, y);
        cx += c.measureText(ch).width + letterSpacing;
      }
    }
    c.globalAlpha = 1;
  }

  measure(str, size = 16, weight = 700) {
    const c = this.ctx;
    c.font = `${weight} ${size}px ui-monospace, "SF Mono", Menlo, Consolas, monospace`;
    return c.measureText(str).width;
  }
}
