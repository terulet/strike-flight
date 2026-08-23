/** Ayudas de dibujo compartidas por los minijuegos. */

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export function glowCircle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  glow = 18,
): void {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = glow;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function ringArc(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  fraction: number,
  color: string,
  width = 3,
): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(x, y, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, Math.min(1, fraction)));
  ctx.stroke();
  ctx.restore();
}

export function label(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  options: { size?: number; color?: string; weight?: number; align?: CanvasTextAlign } = {},
): void {
  ctx.save();
  ctx.fillStyle = options.color ?? '#ffffff';
  ctx.font = `${options.weight ?? 800} ${options.size ?? 16}px ui-sans-serif, system-ui, -apple-system, sans-serif`;
  ctx.textAlign = options.align ?? 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
  ctx.restore();
}

/** Rejilla de fondo tenue con el color del juego. */
export function backdropGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  accent: string,
  offset = 0,
  cell = 46,
): void {
  ctx.save();
  ctx.strokeStyle = accent;
  ctx.globalAlpha = 0.08;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = -cell + (offset % cell); x <= width; x += cell) {
    ctx.moveTo(Math.round(x) + 0.5, 0);
    ctx.lineTo(Math.round(x) + 0.5, height);
  }
  for (let y = -cell + (offset % cell); y <= height; y += cell) {
    ctx.moveTo(0, Math.round(y) + 0.5);
    ctx.lineTo(width, Math.round(y) + 0.5);
  }
  ctx.stroke();
  ctx.restore();
}

export function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const num = Number.parseInt(full, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

/* ------------------------------------------------------------------ */
/* Fondos con caracter                                                 */
/* ------------------------------------------------------------------ */
/**
 * Los siete juegos usaban la misma rejilla, y eso los hacia parecer siete
 * pantallas del mismo juego. Estos fondos existen para que reconozcas a que
 * estas jugando por el rabillo del ojo, antes de leer nada.
 *
 * Todos son baratos (lineas y rectangulos, nada de sombras por elemento) y
 * todos se dibujan MUY tenues: el fondo tiene que dar caracter sin competir
 * con lo que hay que mirar para jugar.
 */

/** Lineas de velocidad hacia abajo. Para lo que corre. */
export function backdropSpeed(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  accent: string,
  offset = 0,
): void {
  ctx.save();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  const separacion = 34;
  for (let x = 0; x <= width; x += separacion) {
    // Las de los lados mas marcadas: refuerza la sensacion de tunel.
    const borde = Math.abs(x - width / 2) / (width / 2);
    ctx.globalAlpha = 0.03 + borde * 0.05;
    const largo = 60 + borde * 90;
    const y = ((offset * (0.6 + borde)) % (height + largo)) - largo;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + largo);
    ctx.stroke();
  }
  ctx.restore();
}

/** Cuadricula fria de laboratorio, con marcas de medida. Para lo calculado. */
export function backdropLab(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  accent: string,
): void {
  ctx.save();
  const cell = 30;
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.045;
  ctx.beginPath();
  for (let x = 0; x <= width; x += cell) {
    ctx.moveTo(Math.round(x) + 0.5, 0);
    ctx.lineTo(Math.round(x) + 0.5, height);
  }
  for (let y = 0; y <= height; y += cell) {
    ctx.moveTo(0, Math.round(y) + 0.5);
    ctx.lineTo(width, Math.round(y) + 0.5);
  }
  ctx.stroke();
  // Cruces cada cinco celdas: se lee como papel milimetrado, no como rejilla.
  ctx.globalAlpha = 0.11;
  ctx.beginPath();
  for (let x = 0; x <= width; x += cell * 5) {
    for (let y = 0; y <= height; y += cell * 5) {
      ctx.moveTo(x - 4, y);
      ctx.lineTo(x + 4, y);
      ctx.moveTo(x, y - 4);
      ctx.lineTo(x, y + 4);
    }
  }
  ctx.stroke();
  ctx.restore();
}

/** Anillos concentricos saliendo del centro. Para lo que estalla. */
export function backdropRadial(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  accent: string,
  fase = 0,
): void {
  ctx.save();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1.5;
  const cx = width / 2;
  const cy = height / 2;
  const maximo = Math.hypot(width, height) / 2;
  const separacion = 78;
  for (let i = 0; i < 7; i++) {
    const r = ((fase * 24 + i * separacion) % maximo);
    ctx.globalAlpha = 0.055 * (1 - r / maximo);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

/** Franjas diagonales de aviso. Para lo que hay que mirar con cuidado. */
export function backdropWarning(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  accent: string,
  offset = 0,
): void {
  ctx.save();
  ctx.strokeStyle = accent;
  ctx.globalAlpha = 0.05;
  ctx.lineWidth = 22;
  const paso = 62;
  const total = width + height;
  for (let d = -height + (offset % paso); d < total; d += paso) {
    ctx.beginPath();
    ctx.moveTo(d, 0);
    ctx.lineTo(d + height, height);
    ctx.stroke();
  }
  ctx.restore();
}

/** Ondas horizontales que laten. Para lo que suena. */
export function backdropWaves(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  accent: string,
  fase = 0,
  energia = 0.5,
): void {
  ctx.save();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1.5;
  const lineas = 6;
  for (let i = 0; i < lineas; i++) {
    const base = (height / (lineas + 1)) * (i + 1);
    const amplitud = 7 + energia * 20;
    ctx.globalAlpha = 0.05 + energia * 0.05;
    ctx.beginPath();
    for (let x = 0; x <= width; x += 10) {
      const y = base + Math.sin(x * 0.019 + fase * 2.4 + i * 0.85) * amplitud;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

/** Papel de plano: puntos regulares y margenes. Para lo que se dibuja. */
export function backdropBlueprint(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  accent: string,
): void {
  ctx.save();
  ctx.fillStyle = accent;
  ctx.globalAlpha = 0.13;
  const paso = 26;
  for (let x = paso; x < width; x += paso) {
    for (let y = paso; y < height; y += paso) {
      ctx.fillRect(x, y, 1.6, 1.6);
    }
  }
  ctx.restore();
}

/** Puntos de mira dispersos. Para lo que se apunta. */
export function backdropScope(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  accent: string,
): void {
  ctx.save();
  ctx.strokeStyle = accent;
  ctx.globalAlpha = 0.05;
  ctx.lineWidth = 1;
  const paso = 96;
  for (let x = paso / 2; x < width; x += paso) {
    for (let y = paso / 2; y < height; y += paso) {
      ctx.beginPath();
      ctx.arc(x, y, 13, 0, Math.PI * 2);
      ctx.moveTo(x - 20, y);
      ctx.lineTo(x - 17, y);
      ctx.moveTo(x + 17, y);
      ctx.lineTo(x + 20, y);
      ctx.moveTo(x, y - 20);
      ctx.lineTo(x, y - 17);
      ctx.moveTo(x, y + 17);
      ctx.lineTo(x, y + 20);
      ctx.stroke();
    }
  }
  ctx.restore();
}
