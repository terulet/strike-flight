// ════════════════════════════════════════════════════════════
//  dsp.mjs — taller de síntesis y mezcla fuera de línea
// ════════════════════════════════════════════════════════════
//  No se usa en el juego. Se usa para FABRICAR los sonidos del juego, una
//  vez, en el PC, con calma y con precisión que el navegador no permite:
//  envolventes por muestra, barridos de filtro reales, saturación,
//  compresión de transitorio y colas convolucionadas.
//
//  El navegador reproduce el resultado. Todo el trabajo caro ya está hecho.
//
//  Convenio: una señal es un Float32Array mono a SR muestras por segundo,
//  con el pico en torno a 1.0 y sin recortar. Los helpers nunca mutan su
//  entrada salvo que lo digan en el nombre.

export const SR = 48000;

// ── Utilidades básicas ────────────────────────────────────
export const buf = n => new Float32Array(Math.max(0, Math.round(n)));
export const secs = s => Math.round(s * SR);
export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const lerp = (a, b, t) => a + (b - a) * t;
export const dbToGain = db => Math.pow(10, db / 20);
export const gainToDb = g => 20 * Math.log10(Math.max(1e-9, g));

// Ruido reproducible. Math.random() haría que dos ejecuciones del forjador
// dieran archivos distintos y el SHA-256 del manifiesto no serviría de nada.
export function rng(semilla = 1) {
  let s = semilla >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

// ── Envolventes ───────────────────────────────────────────
//  curva > 1 cae rápido al principio (percusivo), < 1 cae despacio (cola).
export function env(n, { a = 0.002, h = 0, d = null, curva = 2.2, sostiene = 0 } = {}) {
  const out = buf(n);
  const na = Math.max(1, secs(a)), nh = secs(h);
  const nd = d != null ? secs(d) : Math.max(1, n - na - nh);
  for (let i = 0; i < n; i++) {
    let v;
    if (i < na) v = i / na;
    else if (i < na + nh) v = 1;
    else {
      const t = clamp((i - na - nh) / nd, 0, 1);
      v = sostiene + (1 - sostiene) * Math.pow(1 - t, curva);
    }
    out[i] = v;
  }
  return out;
}

export function aplicarEnv(x, e) {
  const out = buf(x.length);
  for (let i = 0; i < x.length; i++) out[i] = x[i] * (e[i] !== undefined ? e[i] : 0);
  return out;
}

// ── Osciladores con envolvente de tono ────────────────────
//  El barrido de frecuencia se integra muestra a muestra en lugar de
//  resolverse a mano: así admite cualquier curva (exponencial, lineal,
//  con rodilla) sin rehacer la fórmula de la fase cada vez.
export function osc(dur, {
  tipo = "sine", f0 = 440, f1 = null, curvaF = "exp", vol = 1,
  fase = 0, pwm = 0.5, semilla = 7,
} = {}) {
  const n = secs(dur), out = buf(n);
  const fa = f1 == null ? f0 : f1;
  const r = rng(semilla);
  let ph = fase;
  for (let i = 0; i < n; i++) {
    const t = n > 1 ? i / (n - 1) : 0;
    const f = curvaF === "lin" ? lerp(f0, fa, t)
            : curvaF === "exp2" ? f0 * Math.pow(fa / f0, t * t)
            : f0 * Math.pow(fa / f0, t);
    ph += f / SR;
    ph -= Math.floor(ph);
    let v;
    switch (tipo) {
      case "sine":     v = Math.sin(2 * Math.PI * ph); break;
      case "tri":      v = 4 * Math.abs(ph - 0.5) - 1; break;
      case "saw":      v = 2 * ph - 1; break;
      case "square":   v = ph < pwm ? 1 : -1; break;
      // Un poco de ruido en la fase: los metales y los cañones de verdad
      // no son ondas limpias, y una saw perfecta es lo que suena a "chip".
      case "sawsucia": v = (2 * ph - 1) * 0.85 + (r() * 2 - 1) * 0.15; break;
      default:         v = Math.sin(2 * Math.PI * ph);
    }
    out[i] = v * vol;
  }
  return out;
}

// Golpe de sub: la caída de tono que da el CUERPO a una explosión. Sin
// esto una explosión es ruido filtrado, y suena a papel.
export function sub(dur, { f0 = 140, f1 = 32, vol = 1, a = 0.001, curva = 2.6, curvaF = "exp2" } = {}) {
  const s = osc(dur, { tipo: "sine", f0, f1, curvaF, vol });
  return aplicarEnv(s, env(s.length, { a, curva }));
}

export function ruido(dur, { vol = 1, semilla = 3 } = {}) {
  const n = secs(dur), out = buf(n), r = rng(semilla);
  for (let i = 0; i < n; i++) out[i] = (r() * 2 - 1) * vol;
  return out;
}

// Ruido rosa (−3 dB/octava). El ruido blanco es demasiado brillante para
// una explosión: suena a estática, no a masa de aire.
export function ruidoRosa(dur, { vol = 1, semilla = 11 } = {}) {
  const n = secs(dur), out = buf(n), r = rng(semilla);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < n; i++) {
    const w = r() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.96900 * b2 + w * 0.1538520;
    b3 = 0.86650 * b3 + w * 0.3104856;
    b4 = 0.55000 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.0168980;
    out[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11 * vol;
    b6 = w * 0.115926;
  }
  return out;
}

// ── Filtros biquad con cutoff variable en el tiempo ────────
//  El barrido de filtro es lo que convierte un ruido plano en algo que
//  "se abre" o "se cierra". Se recalculan los coeficientes cada 32
//  muestras: inaudible, y evita recalcular cos/sin 48 000 veces por
//  segundo por filtro.
function coefs(tipo, f, q) {
  const w = 2 * Math.PI * clamp(f, 12, SR * 0.49) / SR;
  const cw = Math.cos(w), sw = Math.sin(w), al = sw / (2 * Math.max(0.05, q));
  let b0, b1, b2, a0, a1, a2;
  switch (tipo) {
    case "hp": b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = b0; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; break;
    case "bp": b0 = al; b1 = 0; b2 = -al; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; break;
    case "peak": { const A = Math.pow(10, (q < 0 ? -1 : 1) * 0); b0 = 1; b1 = 0; b2 = 0; a0 = 1; a1 = 0; a2 = 0; break; }
    default:   b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = b0; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al;
  }
  return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
}

export function filtro(x, { tipo = "lp", f0 = 2000, f1 = null, q = 0.707, curvaF = "exp" } = {}) {
  const n = x.length, out = buf(n);
  const fa = f1 == null ? f0 : f1;
  let z1 = 0, z2 = 0, y1 = 0, y2 = 0;
  let c = coefs(tipo, f0, q);
  for (let i = 0; i < n; i++) {
    if ((i & 31) === 0) {
      const t = n > 1 ? i / (n - 1) : 0;
      const f = curvaF === "lin" ? lerp(f0, fa, t) : f0 * Math.pow(fa / f0, t);
      c = coefs(tipo, f, q);
    }
    const v = x[i];
    const y = c[0] * v + c[1] * z1 + c[2] * z2 - c[3] * y1 - c[4] * y2;
    z2 = z1; z1 = v; y2 = y1; y1 = y;
    out[i] = y;
  }
  return out;
}

// Campana de EQ fija. Se usa para la "voz" de cada categoría: dónde vive
// cada familia en el espectro para que no se tapen entre sí.
export function campana(x, fc, gDb, q = 1) {
  const A = Math.pow(10, gDb / 40);
  const w = 2 * Math.PI * clamp(fc, 20, SR * 0.49) / SR;
  const cw = Math.cos(w), al = Math.sin(w) / (2 * q);
  const b0 = 1 + al * A, b1 = -2 * cw, b2 = 1 - al * A;
  const a0 = 1 + al / A, a1 = -2 * cw, a2 = 1 - al / A;
  const n = x.length, out = buf(n);
  let z1 = 0, z2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < n; i++) {
    const v = x[i];
    const y = (b0 * v + b1 * z1 + b2 * z2 - a1 * y1 - a2 * y2) / a0;
    z2 = z1; z1 = v; y2 = y1; y1 = y;
    out[i] = y;
  }
  return out;
}

// ── Saturación ────────────────────────────────────────────
//  El truco central del brief: "grueso" no es "más alto". Es armónicos.
//  Un sub a 40 Hz saturado se sigue oyendo en el altavoz del iPad, que no
//  reproduce 40 Hz, porque la saturación genera 80, 120, 160…
export function saturar(x, { drive = 2, mezcla = 1, tipo = "tanh" } = {}) {
  const n = x.length, out = buf(n);
  for (let i = 0; i < n; i++) {
    const v = x[i] * drive;
    let s;
    switch (tipo) {
      case "duro":   s = clamp(v, -1, 1); break;
      case "pliegue": s = Math.sin(v); break;
      case "asim":   s = v >= 0 ? Math.tanh(v) : Math.tanh(v * 0.7) * 0.85; break;
      default:       s = Math.tanh(v);
    }
    out[i] = lerp(x[i], s, mezcla);
  }
  return out;
}

// ── Mezcla ────────────────────────────────────────────────
//  Cada capa entra con su retardo y su ganancia. El retardo es lo que
//  crea la SECUENCIA del jefe: impacto en 0, sub en 20 ms, cuerpo en
//  60 ms, debris en 300 ms. Todo a la vez sería un ruido; escalonado es
//  un acontecimiento.
export function mezclar(capas, durTotal = null) {
  let n = durTotal != null ? secs(durTotal) : 0;
  if (durTotal == null) {
    for (const c of capas) n = Math.max(n, secs(c.en || 0) + (c.x ? c.x.length : 0));
  }
  const out = buf(n);
  for (const c of capas) {
    if (!c.x) continue;
    const off = secs(c.en || 0), g = c.g != null ? c.g : 1;
    const lim = Math.min(c.x.length, n - off);
    for (let i = 0; i < lim; i++) out[off + i] += c.x[i] * g;
  }
  return out;
}

// ── Reverberación corta ───────────────────────────────────
//  No es un salón: es la "cola" que pide el brief. Ruido decayendo
//  convolucionado por bloques en el dominio del tiempo; con 120–400 ms
//  de cola el coste es despreciable y da el tamaño de sala.
export function cola(x, { largo = 0.35, mezclaSeca = 0.85, decaimiento = 5, brillo = 3200, semilla = 21 } = {}) {
  const nIr = secs(largo);
  const r = rng(semilla);
  const ir = buf(nIr);
  for (let i = 0; i < nIr; i++) {
    const t = i / nIr;
    ir[i] = (r() * 2 - 1) * Math.pow(1 - t, decaimiento);
  }
  const irF = filtro(ir, { tipo: "lp", f0: brillo, f1: brillo * 0.35 });
  // Normalizar la IR: sin esto, la cola sube el nivel general y el
  // limitador acaba comiéndose el transitorio, que es lo único que no
  // se puede recuperar.
  let e = 0; for (let i = 0; i < nIr; i++) e += irF[i] * irF[i];
  const k = 1 / Math.sqrt(Math.max(1e-9, e));
  const n = x.length + nIr, out = buf(n);
  for (let i = 0; i < x.length; i++) {
    const v = x[i];
    if (Math.abs(v) < 1e-6) continue;
    for (let j = 0; j < nIr; j++) out[i + j] += v * irF[j] * k;
  }
  const seco = buf(n);
  for (let i = 0; i < x.length; i++) seco[i] = x[i];
  const res = buf(n);
  for (let i = 0; i < n; i++) res[i] = seco[i] * mezclaSeca + out[i] * (1 - mezclaSeca) * 3.2;
  return res;
}

// ── Modelador de transitorio ──────────────────────────────
//  Sube los primeros milisegundos y baja el resto. Es lo que hace que un
//  impacto se sienta SECO —la palabra exacta del brief— en vez de blando.
export function transitorio(x, { ms = 12, realce = 2.2, cuerpo = 0.92 } = {}) {
  const n = x.length, out = buf(n), na = Math.max(1, secs(ms / 1000));
  for (let i = 0; i < n; i++) {
    const k = i < na ? lerp(realce, cuerpo, i / na) : cuerpo;
    out[i] = x[i] * k;
  }
  return out;
}

// ── Limitador con look-ahead ──────────────────────────────
//  Evita el clipping del brief en la FUENTE, no en el navegador: cada
//  sonido sale ya con su techo puesto, así que el compresor del juego
//  solo tiene que trabajar con las sumas, no con las voces sueltas.
export function limitar(x, { techo = 0.97, mirada = 0.004, soltar = 0.08 } = {}) {
  const n = x.length, nm = Math.max(1, secs(mirada));
  const out = buf(n);
  // Envolvente de pico con look-ahead: el máximo de la ventana futura.
  const picos = buf(n);
  let maxv = 0;
  for (let i = n - 1; i >= 0; i--) {
    const a = Math.abs(x[i]);
    if (a > maxv) maxv = a;
    picos[i] = maxv;
    if (i + nm < n && Math.abs(x[i + nm]) >= maxv - 1e-9) {
      maxv = 0;
      for (let j = i; j < Math.min(n, i + nm); j++) maxv = Math.max(maxv, Math.abs(x[j]));
    }
  }
  const coefS = Math.exp(-1 / (soltar * SR));
  let g = 1;
  for (let i = 0; i < n; i++) {
    const necesaria = picos[i] > techo ? techo / picos[i] : 1;
    g = necesaria < g ? necesaria : g * coefS + necesaria * (1 - coefS);
    out[i] = clamp(x[i] * g, -1, 1);
  }
  return out;
}

// ── Recortes y ajustes finales ────────────────────────────
export function fadeOut(x, ms = 8) {
  const n = x.length, nf = Math.min(n, Math.max(1, secs(ms / 1000)));
  const out = Float32Array.from(x);
  for (let i = 0; i < nf; i++) out[n - nf + i] *= 1 - i / nf;
  return out;
}

export function fadeIn(x, ms = 2) {
  const nf = Math.min(x.length, Math.max(1, secs(ms / 1000)));
  const out = Float32Array.from(x);
  for (let i = 0; i < nf; i++) out[i] *= i / nf;
  return out;
}

// Quitar silencio de cabeza. Importante de verdad: un disparo con 15 ms
// de silencio delante se siente desconectado del dedo, y el brief pide
// respuesta instantánea.
export function recortarCabeza(x, umbral = 0.0015) {
  let i = 0;
  while (i < x.length && Math.abs(x[i]) < umbral) i++;
  if (i === 0) return x;
  return x.slice(Math.max(0, i - secs(0.0005)));
}

export function recortarCola(x, umbral = 0.0012) {
  let i = x.length - 1;
  while (i > 0 && Math.abs(x[i]) < umbral) i--;
  return x.slice(0, Math.min(x.length, i + secs(0.004)));
}

export function normalizarPico(x, objetivo = 0.95) {
  let m = 0;
  for (let i = 0; i < x.length; i++) m = Math.max(m, Math.abs(x[i]));
  if (m < 1e-9) return x;
  const k = objetivo / m, out = buf(x.length);
  for (let i = 0; i < x.length; i++) out[i] = x[i] * k;
  return out;
}

export function ganancia(x, g) {
  const out = buf(x.length);
  for (let i = 0; i < x.length; i++) out[i] = x[i] * g;
  return out;
}

// ── Manipulación de muestras externas ─────────────────────
//  Remuestreo lineal. Para material percusivo corto la interpolación
//  lineal es indistinguible de una buena y no arrastra dependencias.
export function reafinar(x, ratio) {
  if (Math.abs(ratio - 1) < 1e-6) return x;
  const n = Math.max(1, Math.floor(x.length / ratio)), out = buf(n);
  for (let i = 0; i < n; i++) {
    const p = i * ratio, i0 = Math.floor(p), f = p - i0;
    const a = x[i0] || 0, b = x[i0 + 1] || 0;
    out[i] = a + (b - a) * f;
  }
  return out;
}

export function trozo(x, desde = 0, hasta = null) {
  const a = secs(desde), b = hasta == null ? x.length : secs(hasta);
  return x.slice(clamp(a, 0, x.length), clamp(b, 0, x.length));
}

export function invertir(x) {
  const out = buf(x.length);
  for (let i = 0; i < x.length; i++) out[i] = x[x.length - 1 - i];
  return out;
}

// ── Medida ────────────────────────────────────────────────
//  Lo que permite decir "grueso" con un número en vez de con un adjetivo.
export function medir(x) {
  let pico = 0, suma = 0;
  for (let i = 0; i < x.length; i++) { const a = Math.abs(x[i]); if (a > pico) pico = a; suma += x[i] * x[i]; }
  const rms = Math.sqrt(suma / Math.max(1, x.length));
  // Reparto de energía por bandas, con filtros de un polo encadenados.
  const bandas = { grave: 0, medio: 0, agudo: 0 };
  const g = filtro(x, { tipo: "lp", f0: 200, q: 0.707 });
  const ag = filtro(x, { tipo: "hp", f0: 3000, q: 0.707 });
  let eg = 0, ea = 0, et = 0;
  for (let i = 0; i < x.length; i++) { eg += g[i] * g[i]; ea += ag[i] * ag[i]; et += x[i] * x[i]; }
  et = Math.max(1e-12, et);
  bandas.grave = eg / et; bandas.agudo = ea / et;
  bandas.medio = Math.max(0, 1 - bandas.grave - bandas.agudo);
  return {
    dur: x.length / SR, pico, rms, picoDb: gainToDb(pico), rmsDb: gainToDb(rms),
    cresta: gainToDb(pico) - gainToDb(rms), bandas,
  };
}

// ── WAV ───────────────────────────────────────────────────
export function aWav(x, sr = SR) {
  const n = x.length, b = Buffer.alloc(44 + n * 2);
  b.write("RIFF", 0); b.writeUInt32LE(36 + n * 2, 4); b.write("WAVE", 8);
  b.write("fmt ", 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22); b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28);
  b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write("data", 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(clamp(x[i], -1, 1) * 32767), 44 + i * 2);
  return b;
}
