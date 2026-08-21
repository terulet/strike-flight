/**
 * Object silhouettes, drawn in world units (metres) with the origin at the object's
 * geometric centre and its base at y = 0. Everything is Canvas2D primitives so a
 * future sprite pipeline can replace one function without touching gameplay.
 */
function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + Math.sign(h) * rr);
  ctx.lineTo(x + w, y + h - Math.sign(h) * rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - Math.sign(h) * rr);
  ctx.lineTo(x, y + Math.sign(h) * rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

export function drawObjectShape(ctx, obj, opts = {}) {
  const w = obj.width;
  const h = obj.height;
  const x = -w / 2;
  const ghost = !!opts.ghost;
  const alpha = opts.alpha ?? 1;
  ctx.save();
  // Multiply, never assign: the caller may already be drawing a faded ghost.
  ctx.globalAlpha *= alpha;
  if (opts.squash) ctx.scale(opts.squash.x, opts.squash.y);

  const body = ghost ? opts.color || '#ffffff' : obj.color;
  const accent = ghost ? opts.color || '#ffffff' : obj.accent;
  // A rim keeps a dark object readable against a dark platform at any zoom.
  const rim = () => {
    if (!opts.outline) return;
    ctx.strokeStyle = opts.outlineColor || 'rgba(255,255,255,0.42)';
    ctx.lineWidth = opts.outline;
    ctx.stroke();
  };

  switch (obj.shape) {
    case 'can': {
      const g = ctx.createLinearGradient(x, 0, x + w, 0);
      g.addColorStop(0, shade(body, -0.35));
      g.addColorStop(0.35, body);
      g.addColorStop(0.62, shade(body, 0.22));
      g.addColorStop(1, shade(body, -0.42));
      ctx.fillStyle = ghost ? body : g;
      roundRect(ctx, x, 0, w, h, w * 0.14);
      ctx.fill();
      rim();
      if (!ghost) {
        ctx.fillStyle = accent;
        ctx.fillRect(x, h * 0.34, w, h * 0.24);
        ctx.fillStyle = 'rgba(255,255,255,0.30)';
        ctx.fillRect(x + w * 0.16, h * 0.06, w * 0.10, h * 0.88);
        ctx.fillStyle = shade(body, -0.5);
        ctx.fillRect(x, h - h * 0.06, w, h * 0.06);
      }
      break;
    }
    case 'phone': {
      ctx.fillStyle = body;
      roundRect(ctx, x, 0, w, h, h * 0.34);
      ctx.fill();
      rim();
      if (!ghost) {
        ctx.fillStyle = accent;
        ctx.fillRect(x + w * 0.06, h * 0.30, w * 0.88, h * 0.16);
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.fillRect(x + w * 0.06, h * 0.72, w * 0.88, h * 0.12);
        ctx.fillStyle = shade(body, 0.5);
        ctx.fillRect(x + w * 0.70, h * 0.05, w * 0.12, h * 0.18);
      }
      break;
    }
    case 'block': {
      const g = ctx.createLinearGradient(x, 0, x + w * 0.8, h);
      g.addColorStop(0, shade(body, -0.3));
      g.addColorStop(0.45, body);
      g.addColorStop(1, shade(body, 0.35));
      ctx.fillStyle = ghost ? body : g;
      roundRect(ctx, x, 0, w, h, w * 0.06);
      ctx.fill();
      rim();
      if (!ghost) {
        ctx.fillStyle = 'rgba(255,255,255,0.30)';
        ctx.fillRect(x + w * 0.08, h * 0.86, w * 0.84, h * 0.05);
        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        ctx.lineWidth = w * 0.02;
        ctx.strokeRect(x + w * 0.18, h * 0.20, w * 0.64, h * 0.46);
      }
      break;
    }
    case 'car': {
      const bodyH = h * 0.52;
      const wheelR = h * 0.24;
      ctx.fillStyle = body;
      roundRect(ctx, x, wheelR * 0.8, w, bodyH, h * 0.16);
      ctx.fill();
      rim();
      // cabin
      ctx.fillStyle = ghost ? body : shade(body, -0.25);
      roundRect(ctx, x + w * 0.24, wheelR * 0.8 + bodyH * 0.82, w * 0.46, h * 0.30, h * 0.10);
      ctx.fill();
      if (!ghost) {
        ctx.fillStyle = accent;
        ctx.fillRect(x + w * 0.30, wheelR * 0.8 + bodyH * 0.95, w * 0.32, h * 0.13);
        ctx.fillStyle = '#0b0c0f';
        for (const cx of [x + w * 0.24, x + w * 0.76]) {
          ctx.beginPath();
          ctx.arc(cx, wheelR, wheelR, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        for (const cx of [x + w * 0.24, x + w * 0.76]) {
          ctx.beginPath();
          ctx.arc(cx, wheelR, wheelR * 0.34, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;
    }
    case 'puck':
    default: {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, shade(body, -0.4));
      g.addColorStop(0.55, body);
      g.addColorStop(1, shade(body, 0.5));
      ctx.fillStyle = ghost ? body : g;
      roundRect(ctx, x, 0, w, h, h * 0.42);
      ctx.fill();
      rim();
      if (!ghost) {
        ctx.fillStyle = accent;
        ctx.fillRect(x + w * 0.10, h * 0.40, w * 0.80, h * 0.16);
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        roundRect(ctx, x + w * 0.08, h * 0.72, w * 0.84, h * 0.16, h * 0.08);
        ctx.fill();
      }
      break;
    }
  }
  ctx.restore();
}

/** Lighten (t>0) / darken (t<0) a hex colour. */
export function shade(hex, t) {
  const c = hex.replace('#', '');
  const n = parseInt(c.length === 3 ? c.split('').map((x) => x + x).join('') : c, 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (t >= 0) { r += (255 - r) * t; g += (255 - g) * t; b += (255 - b) * t; }
  else { r *= 1 + t; g *= 1 + t; b *= 1 + t; }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

export function rgba(hex, a) {
  const c = hex.replace('#', '');
  const n = parseInt(c.length === 3 ? c.split('').map((x) => x + x).join('') : c, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export { roundRect };
