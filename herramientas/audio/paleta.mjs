// ════════════════════════════════════════════════════════════
//  paleta.mjs — la receta de cada sonido de FLIGHT STRIKE
// ════════════════════════════════════════════════════════════
//  Regla que gobierna todo el archivo, y que es la diferencia entre un
//  arcade moderno y un "piu piu":
//
//    TRANSITORIO + CUERPO + SUB.
//
//  · TRANSITORIO  los primeros 5–15 ms, banda ancha. Es lo que el oído
//                 usa para localizar el golpe en el tiempo. Sin él, el
//                 sonido llega tarde aunque salga en el fotograma justo.
//  · CUERPO       120–900 Hz. Es el "grosor". Un disparo que solo tiene
//                 agudos suena a juguete por muy alto que se ponga.
//  · SUB          30–120 Hz saturado. Da el peso. Saturado a propósito:
//                 el altavoz del iPad no reproduce 45 Hz, pero sí los
//                 armónicos que la saturación genera encima.
//
//  Y la regla del brief que manda sobre las demás: los disparos
//  frecuentes son CORTOS. Ninguno pasa de 110 ms.
//
//  Fuentes externas: Kenney "Sci-Fi Sounds" (CC0). Nunca se usan enteras;
//  entran como CAPA —el crujido, el metal, la cola— dentro de una receta.
//  Detalle y licencia en THIRD_PARTY_AUDIO_LICENSES.md.

import {
  SR, secs, buf, env, aplicarEnv, osc, sub, ruido, ruidoRosa, filtro, campana,
  saturar, mezclar, cola, transitorio, limitar, fadeOut, fadeIn, recortarCabeza,
  recortarCola, normalizarPico, ganancia, reafinar, trozo, invertir, rng, clamp, lerp,
} from "./dsp.mjs";

// ── Ladrillos compuestos ──────────────────────────────────

// El "clic" de banda ancha. Ruido rosa muy corto, agudo y saturado.
const chasquido = (ms = 9, f = 2600, vol = 1, s = 1) =>
  saturar(
    aplicarEnv(filtro(ruidoRosa(ms / 1000, { semilla: s }), { tipo: "hp", f0: f, q: 0.9 }),
      env(secs(ms / 1000), { a: 0.0004, curva: 3.4 })),
    { drive: 2.4, mezcla: 0.7 });

// Metal de Kenney recortado al ataque y reafinado. La cola se tira: nos
// interesa el golpe, no el "ting" de después.
const metal = (F, n, { ms = 90, tono = 1, vol = 1, hp = 260, s = 1 } = {}) => {
  const x = reafinar(recortarCabeza(F("impactMetal_00" + n)), tono);
  const y = filtro(trozo(x, 0, ms / 1000), { tipo: "hp", f0: hp, q: 0.8 });
  return ganancia(aplicarEnv(y, env(y.length, { a: 0.0006, curva: 2.6 })), vol);
};

// Crujido de explosión de Kenney: la textura de escombro que la síntesis
// pura no da. Se le quita el grave (lo pone nuestro sub, afinado) y se le
// deja solo la suciedad.
const crujido = (F, n, { desde = 0, ms = 500, tono = 1, vol = 1, hp = 180 } = {}) => {
  const x = reafinar(recortarCabeza(F("explosionCrunch_00" + n)), tono);
  const y = filtro(trozo(x, desde, desde + ms / 1000), { tipo: "hp", f0: hp, q: 0.7 });
  return ganancia(fadeOut(y, 30), vol);
};

// Chispazo eléctrico: ruido troceado por una compuerta irregular.
const crepitar = (dur, { f = 3000, vol = 1, densidad = 0.5, s = 5 } = {}) => {
  const n = secs(dur), r = rng(s), x = filtro(ruido(dur, { semilla: s }), { tipo: "hp", f0: f, q: 1.2 });
  const out = buf(n);
  let g = 0, cd = 0;
  for (let i = 0; i < n; i++) {
    if (cd-- <= 0) { g = r() < densidad ? 1 : 0.05; cd = secs(0.0012 + r() * 0.006); }
    out[i] = x[i] * g;
  }
  return ganancia(aplicarEnv(out, env(n, { a: 0.001, curva: 2 })), vol);
};

// Cuerpo tonal saturado: el 90 % del "grosor" de las armas sale de aquí.
const cuerpo = (dur, { f0, f1, tipo = "saw", lp0 = 3400, lp1 = 700, q = 2.2, vol = 1, drive = 2.6, curva = 2.4, a = 0.0012 } = {}) => {
  const o = osc(dur, { tipo, f0, f1, curvaF: "exp2", vol: 1 });
  const f = filtro(o, { tipo: "lp", f0: lp0, f1: lp1, q });
  return ganancia(saturar(aplicarEnv(f, env(secs(dur), { a, curva })), { drive, mezcla: 0.85 }), vol);
};

// Silbido de aire: la masa que se desplaza. Barrido de paso banda.
const aire = (dur, { f0 = 900, f1 = 220, q = 1.1, vol = 1, a = 0.01, curva = 1.6, s = 9 } = {}) =>
  ganancia(aplicarEnv(filtro(ruidoRosa(dur, { semilla: s }), { tipo: "bp", f0, f1, q }),
    env(secs(dur), { a, curva })), vol);

// ── Acabado por categoría ─────────────────────────────────
//  Cada familia sale ya con su espacio en el espectro reservado. Es la
//  mitad de la "mezcla" del brief: si dos familias viven en la misma
//  banda, ningún límite de voces las va a separar después.
const ACABADO = {
  // Presencia en 2 kHz para que se oiga sobre todo lo demás, pero sin
  // grave largo: el disparo propio no puede dominar la mezcla.
  disparo:   x => limitar(fadeOut(campana(campana(x, 2200, 3, 1.1), 420, 2, 0.9), 6), { techo: 0.95 }),
  // Los enemigos ceden los agudos al jugador y viven más abajo.
  disparoEne:x => limitar(fadeOut(campana(campana(x, 700, 2.5, 0.9), 3600, -3.5, 0.8), 8), { techo: 0.92 }),
  impacto:   x => limitar(fadeOut(transitorio(campana(x, 1500, 2.5, 1.2), { ms: 8, realce: 1.5, cuerpo: 0.95 }), 8), { techo: 0.95 }),
  explosion: x => limitar(fadeOut(campana(campana(x, 90, 3.5, 0.8), 5200, -2, 0.7), 25), { techo: 0.98, mirada: 0.006 }),
  jefe:      x => limitar(fadeOut(campana(campana(x, 55, 5, 0.7), 4200, -1.5, 0.7), 60), { techo: 0.99, mirada: 0.008 }),
  premio:    x => limitar(fadeOut(campana(x, 2800, 2, 1), 20), { techo: 0.94 }),
  aviso:     x => limitar(fadeOut(campana(x, 1100, 3, 1.1), 25), { techo: 0.96 }),
  ui:        x => limitar(fadeOut(campana(x, 1900, 2, 1.2), 12), { techo: 0.93 }),
};

// ════════════════════════════════════════════════════════════
//  CATÁLOGO
// ════════════════════════════════════════════════════════════
//  n   variantes que se generan (el motor rota entre ellas)
//  cat categoría de mezcla y de acabado
export const CATALOGO = {

  // ── ARMAS DEL JUGADOR ───────────────────────────────────
  //  80 ms. Se disparan seis por segundo: cualquier cola los convierte
  //  en una masa de ruido a los tres segundos de partida.
  cannon: { cat: "disparo", n: 3, hacer: (F, k) => mezclar([
    { x: chasquido(8, 3000, 0.55, 21 + k) },
    { x: metal(F, (k % 5), { ms: 55, tono: 1.7 + k * 0.06, vol: 0.4, hp: 900 }) },
    { x: cuerpo(0.072, { f0: 640 - k * 25, f1: 170, lp0: 3600, lp1: 800, vol: 0.85, drive: 3 }) },
    { x: sub(0.055, { f0: 165, f1: 58, vol: 0.62, curva: 2.8 }) },
    { x: aire(0.03, { f0: 5200, f1: 2400, vol: 0.18, a: 0.0008, s: 40 + k }) },
  ], 0.09) },

  // El repetidor dispara 13 veces por segundo. Es el sonido con menos
  // margen del juego: 45 ms y muy poco grave, o se embarra solo.
  rapid: { cat: "disparo", n: 3, hacer: (F, k) => mezclar([
    { x: chasquido(6, 3800, 0.5, 31 + k) },
    { x: cuerpo(0.042, { f0: 900 - k * 40, f1: 300, lp0: 4800, lp1: 1400, vol: 0.62, drive: 2.6 }) },
    { x: sub(0.03, { f0: 220, f1: 95, vol: 0.34, curva: 3 }) },
  ], 0.05) },

  // Lento y gordo: aquí sí cabe cuerpo, porque solo suena 3 veces por
  // segundo. Filtro resonante que se cierra = "energía", no "nota".
  plasma: { cat: "disparo", n: 3, hacer: (F, k) => mezclar([
    { x: chasquido(10, 2000, 0.42, 41 + k) },
    { x: cuerpo(0.16, { f0: 520 - k * 20, f1: 120, tipo: "sawsucia", lp0: 2800, lp1: 420, q: 6.5, vol: 0.9, drive: 3.4, curva: 2 }) },
    { x: sub(0.13, { f0: 190, f1: 45, vol: 0.8, curva: 2.2 }) },
    { x: ganancia(filtro(ruidoRosa(0.09, { semilla: 55 + k }), { tipo: "bp", f0: 2600, f1: 900, q: 2 }), 0.3), en: 0.002 },
  ], 0.18) },

  laser: { cat: "disparo", n: 2, hacer: (F, k) => mezclar([
    { x: chasquido(7, 4200, 0.4, 51 + k) },
    { x: ganancia(filtro(trozo(reafinar(recortarCabeza(F("laserLarge_00" + (k % 5))), 1.25 + k * 0.05), 0, 0.12), { tipo: "hp", f0: 420 }), 0.7) },
    { x: cuerpo(0.1, { f0: 2600 - k * 100, f1: 1300, tipo: "saw", lp0: 6000, lp1: 2600, q: 5, vol: 0.4, drive: 2 }) },
    { x: sub(0.07, { f0: 260, f1: 110, vol: 0.42 }) },
  ], 0.13) },

  // El arma más pesada del jugador. Cañón de riel: chispa, latigazo de
  // aire y un sub que cae dos octavas.
  railgun: { cat: "disparo", n: 2, hacer: (F, k) => mezclar([
    { x: chasquido(14, 1600, 0.75, 61 + k) },
    { x: metal(F, 3 - k, { ms: 140, tono: 0.85, vol: 0.6, hp: 400 }) },
    { x: cuerpo(0.2, { f0: 300, f1: 62, tipo: "sawsucia", lp0: 2600, lp1: 300, q: 3.5, vol: 0.95, drive: 4, curva: 2.2 }) },
    { x: sub(0.26, { f0: 210, f1: 36, vol: 1, curva: 2, a: 0.0008 }) },
    { x: aire(0.17, { f0: 4200, f1: 700, q: 1.4, vol: 0.42, a: 0.002, s: 70 + k }), en: 0.004 },
    { x: ganancia(cola(chasquido(10, 1400, 0.5, 66 + k), { largo: 0.2, mezclaSeca: 0.4, decaimiento: 6 }), 0.3), en: 0.02 },
  ], 0.3) },

  electrico: { cat: "disparo", n: 2, hacer: (F, k) => mezclar([
    { x: crepitar(0.09, { f: 2600, vol: 0.85, densidad: 0.55, s: 81 + k }) },
    { x: cuerpo(0.06, { f0: 1800 + k * 200, f1: 3600, tipo: "square", lp0: 6000, lp1: 4000, vol: 0.3, drive: 3 }) },
    { x: sub(0.05, { f0: 180, f1: 70, vol: 0.4 }) },
  ], 0.1) },

  fuego: { cat: "disparo", n: 2, hacer: (F, k) => mezclar([
    { x: ganancia(saturar(aplicarEnv(filtro(ruidoRosa(0.13, { semilla: 91 + k }), { tipo: "lp", f0: 2600, f1: 520, q: 1.5 }), env(secs(0.13), { a: 0.004, curva: 1.7 })), { drive: 3, mezcla: 0.7 }), 0.9) },
    { x: cuerpo(0.09, { f0: 320 - k * 15, f1: 105, tipo: "sawsucia", lp0: 1500, lp1: 480, vol: 0.5, drive: 3 }) },
    { x: sub(0.08, { f0: 150, f1: 62, vol: 0.45 }) },
  ], 0.14) },

  cryo: { cat: "disparo", n: 2, hacer: (F, k) => mezclar([
    { x: chasquido(7, 6000, 0.45, 101 + k) },
    { x: ganancia(aplicarEnv(filtro(ruidoRosa(0.12, { semilla: 105 + k }), { tipo: "bp", f0: 5200, f1: 3200, q: 2.4 }), env(secs(0.12), { a: 0.003, curva: 2 })), 0.5) },
    { x: cuerpo(0.11, { f0: 2400 - k * 90, f1: 1500, tipo: "tri", lp0: 8000, lp1: 5000, vol: 0.42, drive: 1.6 }) },
    { x: sub(0.06, { f0: 200, f1: 90, vol: 0.34 }) },
  ], 0.13) },

  misil: { cat: "disparo", n: 3, hacer: (F, k) => mezclar([
    { x: chasquido(11, 1200, 0.5, 111 + k) },
    { x: ganancia(aplicarEnv(filtro(ruidoRosa(0.3, { semilla: 115 + k }), { tipo: "bp", f0: 700, f1: 2600, q: 1.3 }), env(secs(0.3), { a: 0.03, curva: 1.2, sostiene: 0.15 })), 0.75) },
    { x: cuerpo(0.13, { f0: 260, f1: 95, tipo: "sawsucia", lp0: 1800, lp1: 500, vol: 0.6, drive: 3.2 }) },
    { x: sub(0.2, { f0: 170, f1: 48, vol: 0.75, curva: 1.9 }) },
  ], 0.32) },

  // El especial. Aquí sí se permite ser enorme: solo suena cuando la
  // jugadora ha decidido gastarlo.
  ultimate: { cat: "jefe", n: 1, hacer: (F) => mezclar([
    { x: ganancia(aplicarEnv(filtro(ruidoRosa(0.26, { semilla: 121 }), { tipo: "bp", f0: 300, f1: 5200, q: 1.1 }), env(secs(0.26), { a: 0.2, curva: 0.7, sostiene: 0.9 })), 0.5) },
    { x: cuerpo(0.24, { f0: 120, f1: 900, tipo: "sawsucia", lp0: 900, lp1: 6000, q: 3, vol: 0.5, drive: 3, curva: 0.6, a: 0.15 }) },
    { x: chasquido(18, 900, 1, 125), en: 0.25 },
    { x: crujido(F, 4, { ms: 620, tono: 0.82, vol: 0.85, hp: 240 }), en: 0.252 },
    { x: sub(0.6, { f0: 320, f1: 34, vol: 1, curva: 1.8, a: 0.0008 }), en: 0.25 },
    { x: cuerpo(0.34, { f0: 700, f1: 90, tipo: "sawsucia", lp0: 5000, lp1: 400, q: 2.5, vol: 0.6, drive: 4 }), en: 0.254 },
    { x: ganancia(cola(crujido(F, 2, { ms: 300, tono: 1.1, vol: 0.6, hp: 700 }), { largo: 0.4, mezclaSeca: 0.35, decaimiento: 5 }), 0.4), en: 0.42 },
  ], 1.0) },

  // Carga del especial: subida de 0,9 s que dice "algo va a pasar".
  carga: { cat: "aviso", n: 1, hacer: () => mezclar([
    { x: cuerpo(0.9, { f0: 70, f1: 620, tipo: "sawsucia", lp0: 500, lp1: 4200, q: 3.5, vol: 0.8, drive: 2.6, curva: 0.35, a: 0.5 }) },
    { x: osc(0.9, { tipo: "sine", f0: 140, f1: 1240, curvaF: "exp", vol: 0.28 }) },
    { x: ganancia(aplicarEnv(filtro(ruidoRosa(0.9, { semilla: 131 }), { tipo: "bp", f0: 800, f1: 6000, q: 1.6 }), env(secs(0.9), { a: 0.6, curva: 0.4, sostiene: 0.8 })), 0.35) },
    { x: sub(0.3, { f0: 90, f1: 44, vol: 0.5, curva: 1.4 }), en: 0.62 },
  ], 0.95) },

  // ── EL JUGADOR RECIBE ───────────────────────────────────
  //  Tres sonidos que ANTES NO EXISTÍAN. El impacto sobre la nave usaba
  //  el mismo "tick" de 35 ms que una bala rebotando en un dron.
  jug_golpe: { cat: "impacto", n: 2, hacer: (F, k) => mezclar([
    { x: chasquido(12, 900, 0.8, 141 + k) },
    { x: metal(F, k, { ms: 190, tono: 0.7, vol: 0.85, hp: 200 }) },
    { x: cuerpo(0.16, { f0: 380, f1: 90, tipo: "sawsucia", lp0: 2400, lp1: 380, vol: 0.8, drive: 4 }) },
    { x: sub(0.24, { f0: 150, f1: 38, vol: 0.95, curva: 2 }) },
    { x: ganancia(crepitar(0.22, { f: 1800, vol: 0.3, densidad: 0.25, s: 145 + k }), 0.6), en: 0.03 },
  ], 0.35) },

  // Rotura de escudo. El bug: el juego pedía impacto "rotura", que no
  // existe en la tabla, y caía al impacto ligero. La pérdida del escudo
  // sonaba como una china contra el casco.
  jug_escudo: { cat: "impacto", n: 2, hacer: (F, k) => mezclar([
    { x: ganancia(reafinar(recortarCabeza(F("forceField_00" + (k * 2 % 5))), 1.15), 0.55) },
    { x: chasquido(10, 2600, 0.5, 151 + k) },
    { x: cuerpo(0.2, { f0: 1500, f1: 420, tipo: "tri", lp0: 6000, lp1: 1800, q: 4, vol: 0.55, drive: 2 }) },
    { x: ganancia(crepitar(0.26, { f: 3400, vol: 0.4, densidad: 0.3, s: 155 + k }), 0.7), en: 0.02 },
    { x: sub(0.18, { f0: 220, f1: 70, vol: 0.5 }) },
  ], 0.4) },

  // Muerte del jugador. No puede ser la explosión de un enemigo mediano,
  // que es lo que sonaba.
  jug_muerte: { cat: "jefe", n: 1, hacer: (F) => mezclar([
    { x: chasquido(16, 700, 1, 161) },
    { x: metal(F, 3, { ms: 220, tono: 0.6, vol: 0.7, hp: 160 }) },
    { x: crujido(F, 3, { ms: 900, tono: 0.72, vol: 0.95, hp: 150 }) },
    { x: sub(0.75, { f0: 240, f1: 28, vol: 1, curva: 1.7, a: 0.001 }) },
    { x: cuerpo(0.4, { f0: 520, f1: 60, tipo: "sawsucia", lp0: 3200, lp1: 260, q: 2.4, vol: 0.7, drive: 4.5 }) },
    { x: ganancia(cola(crujido(F, 1, { ms: 420, tono: 0.9, vol: 0.7, hp: 500 }), { largo: 0.5, mezclaSeca: 0.3, decaimiento: 4.5 }), 0.5), en: 0.3 },
  ], 1.35) },

  // ── ENEMIGOS ────────────────────────────────────────────
  ene_disparo: { cat: "disparoEne", n: 3, hacer: (F, k) => mezclar([
    { x: chasquido(6, 1800, 0.35, 171 + k) },
    { x: cuerpo(0.075, { f0: 380 - k * 20, f1: 120, tipo: "sawsucia", lp0: 2000, lp1: 520, vol: 0.75, drive: 2.8 }) },
    { x: sub(0.06, { f0: 140, f1: 55, vol: 0.45 }) },
  ], 0.09) },

  // 48 sitios del código pedían este sonido: TODOS los ataques de los
  // diez jefes más tres tipos de enemigo. Ahora es una familia de cuatro
  // y los jefes reparten (ver ene_pesado / ene_mortero / ene_barrido).
  ene_pesado: { cat: "disparoEne", n: 3, hacer: (F, k) => mezclar([
    { x: chasquido(10, 1100, 0.5, 181 + k) },
    { x: cuerpo(0.16, { f0: 210 - k * 10, f1: 58, tipo: "sawsucia", lp0: 1500, lp1: 260, q: 2.6, vol: 0.9, drive: 3.6 }) },
    { x: sub(0.2, { f0: 150, f1: 40, vol: 0.85, curva: 2.1 }) },
    { x: aire(0.09, { f0: 2200, f1: 600, vol: 0.25, a: 0.002, s: 185 + k }) },
  ], 0.24) },

  // Mortero: sale hacia arriba, con hueco de aire antes del cuerpo.
  ene_mortero: { cat: "disparoEne", n: 2, hacer: (F, k) => mezclar([
    { x: chasquido(13, 700, 0.6, 191 + k) },
    { x: sub(0.28, { f0: 120, f1: 34, vol: 0.95, curva: 1.8 }) },
    { x: aire(0.24, { f0: 500, f1: 1900, q: 1.2, vol: 0.5, a: 0.02, curva: 1.1, s: 195 + k }) },
    { x: cuerpo(0.12, { f0: 260, f1: 80, tipo: "sawsucia", lp0: 1200, lp1: 320, vol: 0.55, drive: 3.2 }) },
  ], 0.32) },

  // Barrido: los patrones en abanico y circulares. Más ancho, menos seco.
  ene_barrido: { cat: "disparoEne", n: 2, hacer: (F, k) => mezclar([
    { x: chasquido(8, 1500, 0.4, 201 + k) },
    { x: cuerpo(0.19, { f0: 430 - k * 25, f1: 130, tipo: "sawsucia", lp0: 2600, lp1: 620, q: 4.5, vol: 0.8, drive: 3, curva: 1.7 }) },
    { x: ganancia(aplicarEnv(filtro(ruidoRosa(0.16, { semilla: 205 + k }), { tipo: "bp", f0: 1800, f1: 700, q: 1.8 }), env(secs(0.16), { a: 0.006, curva: 1.5 })), 0.35) },
    { x: sub(0.17, { f0: 165, f1: 48, vol: 0.7 }) },
  ], 0.24) },

  ene_laser: { cat: "disparoEne", n: 2, hacer: (F, k) => mezclar([
    { x: ganancia(filtro(trozo(reafinar(recortarCabeza(F("laserLarge_00" + (k + 2))), 0.78), 0, 0.2), { tipo: "hp", f0: 260 }), 0.7) },
    { x: cuerpo(0.17, { f0: 1500, f1: 520, tipo: "sawsucia", lp0: 4000, lp1: 1200, q: 5.5, vol: 0.55, drive: 2.4 }) },
    { x: sub(0.14, { f0: 190, f1: 60, vol: 0.55 }) },
  ], 0.24) },

  ene_misil: { cat: "disparoEne", n: 2, hacer: (F, k) => mezclar([
    { x: chasquido(10, 900, 0.45, 211 + k) },
    { x: ganancia(aplicarEnv(filtro(ruidoRosa(0.34, { semilla: 215 + k }), { tipo: "bp", f0: 520, f1: 2000, q: 1.2 }), env(secs(0.34), { a: 0.04, curva: 1.1, sostiene: 0.2 })), 0.7) },
    { x: sub(0.24, { f0: 140, f1: 42, vol: 0.7, curva: 1.9 }) },
  ], 0.36) },

  // ── IMPACTOS ────────────────────────────────────────────
  //  Muy cortos: se disparan a la vez que el disparo siguiente.
  imp_ligero: { cat: "impacto", n: 4, hacer: (F, k) => mezclar([
    { x: chasquido(5, 3400, 0.6, 221 + k) },
    { x: metal(F, k % 5, { ms: 45, tono: 1.9 + k * 0.08, vol: 0.55, hp: 1400 }) },
    { x: cuerpo(0.035, { f0: 800, f1: 300, lp0: 4000, lp1: 1600, vol: 0.35, drive: 2.4 }) },
  ], 0.06) },

  imp_medio: { cat: "impacto", n: 4, hacer: (F, k) => mezclar([
    { x: chasquido(7, 2000, 0.62, 231 + k) },
    { x: metal(F, (k + 1) % 5, { ms: 90, tono: 1.25 + k * 0.06, vol: 0.7, hp: 700 }) },
    { x: cuerpo(0.06, { f0: 520, f1: 165, tipo: "sawsucia", lp0: 3000, lp1: 900, vol: 0.5, drive: 3 }) },
    { x: sub(0.07, { f0: 190, f1: 70, vol: 0.45 }) },
  ], 0.11) },

  imp_pesado: { cat: "impacto", n: 3, hacer: (F, k) => mezclar([
    { x: chasquido(11, 1200, 0.8, 241 + k) },
    { x: metal(F, (k + 2) % 5, { ms: 170, tono: 0.72 + k * 0.05, vol: 0.85, hp: 260 }) },
    { x: cuerpo(0.13, { f0: 340, f1: 85, tipo: "sawsucia", lp0: 2200, lp1: 340, q: 2.4, vol: 0.75, drive: 4 }) },
    { x: sub(0.2, { f0: 145, f1: 36, vol: 0.9, curva: 2.1 }) },
  ], 0.28) },

  imp_escudo: { cat: "impacto", n: 3, hacer: (F, k) => mezclar([
    { x: ganancia(trozo(reafinar(recortarCabeza(F("forceField_00" + (k % 5))), 1.5), 0, 0.16), 0.5) },
    { x: chasquido(6, 3000, 0.4, 251 + k) },
    { x: cuerpo(0.11, { f0: 1300 - k * 60, f1: 520, tipo: "tri", lp0: 5000, lp1: 2200, q: 4.5, vol: 0.5, drive: 1.8 }) },
    { x: sub(0.07, { f0: 240, f1: 105, vol: 0.3 }) },
  ], 0.19) },

  // ── EXPLOSIONES ─────────────────────────────────────────
  //  Cuatro escalas y se tienen que notar las cuatro. Lo que las separa
  //  NO es el volumen: es cuánto grave hay, cuánto dura la cola y cuánto
  //  tarda el crujido en llegar.
  exp_peq: { cat: "explosion", n: 4, hacer: (F, k) => mezclar([
    { x: chasquido(8, 1600, 0.7, 261 + k) },
    { x: crujido(F, k % 5, { ms: 210, tono: 1.45 + k * 0.07, vol: 0.8, hp: 420 }) },
    { x: sub(0.16, { f0: 220, f1: 62, vol: 0.7, curva: 2.4 }) },
    { x: ganancia(aplicarEnv(filtro(ruidoRosa(0.14, { semilla: 265 + k }), { tipo: "lp", f0: 4200, f1: 900 }), env(secs(0.14), { a: 0.001, curva: 2.6 })), 0.45) },
  ], 0.26) },

  exp_med: { cat: "explosion", n: 4, hacer: (F, k) => mezclar([
    { x: chasquido(12, 1100, 0.85, 271 + k) },
    { x: crujido(F, (k + 1) % 5, { ms: 460, tono: 1.05 + k * 0.06, vol: 0.9, hp: 240 }) },
    { x: sub(0.4, { f0: 190, f1: 40, vol: 0.95, curva: 2 }) },
    { x: cuerpo(0.2, { f0: 300, f1: 62, tipo: "sawsucia", lp0: 2200, lp1: 300, vol: 0.55, drive: 4 }) },
    { x: ganancia(cola(crujido(F, (k + 3) % 5, { ms: 200, tono: 1.2, vol: 0.5, hp: 800 }), { largo: 0.3, mezclaSeca: 0.4, decaimiento: 5.5 }), 0.35), en: 0.1 },
  ], 0.62) },

  exp_grande: { cat: "explosion", n: 3, hacer: (F, k) => mezclar([
    { x: chasquido(16, 800, 1, 281 + k) },
    { x: crujido(F, (k + 2) % 5, { ms: 780, tono: 0.82 + k * 0.05, vol: 1, hp: 170 }) },
    { x: ganancia(trozo(reafinar(recortarCabeza(F("lowFrequency_explosion_00" + (k % 2))), 0.9), 0, 0.9), 0.55) },
    { x: sub(0.66, { f0: 230, f1: 30, vol: 1, curva: 1.8, a: 0.0009 }) },
    { x: cuerpo(0.3, { f0: 400, f1: 55, tipo: "sawsucia", lp0: 2600, lp1: 240, q: 2.2, vol: 0.6, drive: 4.5 }) },
    { x: ganancia(cola(crujido(F, (k + 4) % 5, { ms: 340, tono: 1, vol: 0.6, hp: 600 }), { largo: 0.45, mezclaSeca: 0.32, decaimiento: 4.8 }), 0.45), en: 0.16 },
  ], 1.1) },

  // ── LA MUERTE DEL JEFE ──────────────────────────────────
  //  El brief lo pide explícitamente como secuencia, no como sonido:
  //
  //    0 ms   impacto inicial      chasquido + metal grave
  //    30 ms  subgrave             caída de 260 Hz a 26 Hz, saturada
  //    60 ms  explosión            crujido a media velocidad
  //   340 ms  debris + energía     segundo crujido + crepitar
  //   700 ms  cola corta           convolución que se apaga
  //
  //  Es el sonido más largo y más alto del juego, y el único con
  //  prioridad 10 en el motor: nunca lo tira el límite de voces.
  exp_boss: { cat: "jefe", n: 1, hacer: (F) => mezclar([
    { x: chasquido(20, 600, 1, 291) },
    { x: metal(F, 3, { ms: 260, tono: 0.5, vol: 0.8, hp: 120 }) },
    { x: sub(1.15, { f0: 260, f1: 26, vol: 1, curva: 1.5, a: 0.0012 }), en: 0.03 },
    { x: ganancia(trozo(reafinar(recortarCabeza(F("lowFrequency_explosion_000")), 0.72), 0, 1.6), 0.7), en: 0.03 },
    { x: crujido(F, 4, { ms: 1250, tono: 0.62, vol: 1, hp: 130 }), en: 0.06 },
    { x: cuerpo(0.5, { f0: 420, f1: 42, tipo: "sawsucia", lp0: 3000, lp1: 200, q: 2, vol: 0.7, drive: 5 }), en: 0.06 },
    { x: crujido(F, 2, { ms: 700, tono: 0.88, vol: 0.75, hp: 320 }), en: 0.34 },
    { x: ganancia(crepitar(0.7, { f: 2400, vol: 0.4, densidad: 0.22, s: 295 }), 0.8), en: 0.36 },
    { x: sub(0.6, { f0: 90, f1: 24, vol: 0.6, curva: 1.3 }), en: 0.36 },
    { x: ganancia(cola(crujido(F, 1, { ms: 520, tono: 0.95, vol: 0.8, hp: 420 }), { largo: 0.7, mezclaSeca: 0.22, decaimiento: 3.8 }), 0.6), en: 0.7 },
  ], 2.6) },

  // Escala intermedia que faltaba: el miniboss no puede sonar como un
  // enemigo pesado ni como el jefe final.
  exp_miniboss: { cat: "jefe", n: 2, hacer: (F, k) => mezclar([
    { x: chasquido(17, 700, 0.95, 301 + k) },
    { x: metal(F, 4 - k, { ms: 200, tono: 0.58, vol: 0.7, hp: 150 }) },
    { x: sub(0.85, { f0: 245, f1: 28, vol: 1, curva: 1.65, a: 0.001 }), en: 0.02 },
    { x: crujido(F, (k + 3) % 5, { ms: 950, tono: 0.72, vol: 0.95, hp: 155 }), en: 0.04 },
    { x: cuerpo(0.36, { f0: 400, f1: 48, tipo: "sawsucia", lp0: 2800, lp1: 220, q: 2.1, vol: 0.62, drive: 4.6 }), en: 0.04 },
    { x: ganancia(cola(crujido(F, k, { ms: 380, tono: 0.98, vol: 0.7, hp: 500 }), { largo: 0.55, mezclaSeca: 0.28, decaimiento: 4.2 }), 0.5), en: 0.3 },
  ], 1.7) },

  // ── PREMIOS ─────────────────────────────────────────────
  premio_cae: { cat: "premio", n: 1, hacer: (F, k) => mezclar([
    { x: ganancia(osc(0.22, { tipo: "sine", f0: 620 + k * 60, f1: 1240 + k * 60, vol: 0.35 }), 1) },
    { x: aplicarEnv(osc(0.22, { tipo: "tri", f0: 930 + k * 90, f1: 1860, vol: 0.18 }), env(secs(0.22), { a: 0.02, curva: 1.6 })) },
    { x: ganancia(aplicarEnv(filtro(ruidoRosa(0.2, { semilla: 311 + k }), { tipo: "bp", f0: 3400, f1: 7000, q: 2 }), env(secs(0.2), { a: 0.05, curva: 1.4 })), 0.22) },
  ], 0.26) },

  pickup: { cat: "premio", n: 3, hacer: (F, k) => mezclar([
    { x: chasquido(5, 4000, 0.35, 321 + k) },
    { x: aplicarEnv(osc(0.09, { tipo: "tri", f0: 880 * (1 + k * 0.06), f1: 1760 * (1 + k * 0.06), vol: 0.55 }), env(secs(0.09), { a: 0.002, curva: 2.4 })) },
    { x: aplicarEnv(osc(0.13, { tipo: "tri", f0: 1320 * (1 + k * 0.06), f1: 2640 * (1 + k * 0.06), vol: 0.4 }), env(secs(0.13), { a: 0.002, curva: 2.2 })), en: 0.055 },
    { x: sub(0.08, { f0: 300, f1: 150, vol: 0.3 }) },
  ], 0.2) },

  mejora: { cat: "premio", n: 1, hacer: () => mezclar([
    ...[523, 659, 784, 1046].map((f, i) => ({
      x: mezclar([
        { x: aplicarEnv(osc(0.2, { tipo: "tri", f0: f, vol: 0.42 }), env(secs(0.2), { a: 0.003, curva: 2.2 })) },
        { x: aplicarEnv(osc(0.2, { tipo: "saw", f0: f * 2, vol: 0.1 }), env(secs(0.2), { a: 0.003, curva: 3 })) },
        { x: sub(0.1, { f0: f / 2, f1: f / 2, vol: 0.22, curva: 2.4 }) },
      ]), en: i * 0.052,
    })),
    { x: ganancia(cola(chasquido(6, 3000, 0.3, 331), { largo: 0.3, mezclaSeca: 0.3, decaimiento: 5 }), 0.25), en: 0.2 },
  ], 0.5) },

  escudo_on: { cat: "premio", n: 1, hacer: (F) => mezclar([
    { x: ganancia(reafinar(recortarCabeza(F("forceField_002")), 0.92), 0.6) },
    { x: cuerpo(0.4, { f0: 280, f1: 1400, tipo: "tri", lp0: 1200, lp1: 6000, q: 3, vol: 0.5, drive: 1.8, curva: 0.5, a: 0.03 }) },
    { x: osc(0.4, { tipo: "sine", f0: 420, f1: 2100, vol: 0.22 }) },
    { x: sub(0.3, { f0: 180, f1: 70, vol: 0.4, curva: 1.6 }) },
  ], 0.55) },

  vida: { cat: "premio", n: 1, hacer: () => mezclar([
    ...[523, 784, 1046, 1568].map((f, i) => ({
      x: mezclar([
        { x: aplicarEnv(osc(0.34, { tipo: "tri", f0: f, vol: 0.45 }), env(secs(0.34), { a: 0.004, curva: 2 })) },
        { x: aplicarEnv(osc(0.34, { tipo: "sine", f0: f * 1.5, vol: 0.16 }), env(secs(0.34), { a: 0.004, curva: 2.4 })) },
      ]), en: i * 0.075,
    })),
    { x: sub(0.2, { f0: 260, f1: 130, vol: 0.35 }) },
    { x: ganancia(cola(chasquido(7, 2600, 0.35, 341), { largo: 0.45, mezclaSeca: 0.25, decaimiento: 4 }), 0.3), en: 0.28 },
  ], 0.75) },

  combo: { cat: "premio", n: 1, hacer: (F, k) => mezclar([
    { x: chasquido(4, 5000, 0.3, 351 + k) },
    { x: aplicarEnv(osc(0.09, { tipo: "tri", f0: 1046 * (1 + k * 0.12), vol: 0.4 }), env(secs(0.09), { a: 0.002, curva: 2.6 })) },
    { x: aplicarEnv(osc(0.14, { tipo: "tri", f0: 1568 * (1 + k * 0.12), vol: 0.45 }), env(secs(0.14), { a: 0.002, curva: 2.2 })), en: 0.055 },
  ], 0.21) },

  // ── PARTIDA Y AVISOS ────────────────────────────────────
  aviso: { cat: "aviso", n: 1, agudo: true, hacer: () => mezclar([
    ...[0, 0.34].map(t => ({
      x: mezclar([
        { x: cuerpo(0.28, { f0: 680, f1: 640, tipo: "square", lp0: 2600, lp1: 1600, vol: 0.55, drive: 2.4, curva: 1.4, a: 0.006 }) },
        { x: osc(0.28, { tipo: "saw", f0: 340, f1: 320, vol: 0.14 }) },
        { x: sub(0.2, { f0: 170, f1: 120, vol: 0.35, curva: 1.6 }) },
      ]), en: t,
    })),
  ], 0.68) },

  boss_llega: { cat: "jefe", n: 1, hacer: (F) => mezclar([
    { x: sub(1.9, { f0: 72, f1: 48, vol: 1, curva: 0.7, a: 0.25 }) },
    { x: cuerpo(1.9, { f0: 144, f1: 96, tipo: "sawsucia", lp0: 700, lp1: 300, q: 2, vol: 0.42, drive: 3.4, curva: 0.6, a: 0.3 }) },
    { x: ganancia(aplicarEnv(filtro(ruidoRosa(1.5, { semilla: 361 }), { tipo: "lp", f0: 600, f1: 200 }), env(secs(1.5), { a: 0.5, curva: 0.9, sostiene: 0.3 })), 0.4), en: 0.4 },
    { x: ganancia(trozo(reafinar(recortarCabeza(F("spaceEngineLow_000")), 0.8), 0.4, 2.0), 0.28), en: 0.15 },
    { x: chasquido(24, 400, 0.7, 365), en: 1.55 },
    { x: sub(0.5, { f0: 120, f1: 34, vol: 0.7, curva: 1.6 }), en: 1.55 },
  ], 2.3) },

  fase: { cat: "jefe", n: 1, hacer: (F) => mezclar([
    { x: chasquido(15, 900, 0.8, 371) },
    { x: metal(F, 2, { ms: 200, tono: 0.62, vol: 0.6, hp: 200 }) },
    { x: sub(0.7, { f0: 200, f1: 32, vol: 0.95, curva: 1.7 }) },
    { x: cuerpo(0.42, { f0: 1600, f1: 300, tipo: "sawsucia", lp0: 5000, lp1: 900, q: 3.5, vol: 0.5, drive: 3.4 }), en: 0.05 },
    { x: ganancia(crepitar(0.5, { f: 2200, vol: 0.35, densidad: 0.3, s: 375 }), 0.7), en: 0.08 },
    { x: ganancia(cola(chasquido(10, 1200, 0.5, 377), { largo: 0.5, mezclaSeca: 0.25, decaimiento: 4 }), 0.4), en: 0.3 },
  ], 1.0) },

  bomba: { cat: "jefe", n: 1, hacer: (F) => mezclar([
    { x: cuerpo(0.16, { f0: 1800, f1: 260, tipo: "sawsucia", lp0: 7000, lp1: 1200, q: 3, vol: 0.5, drive: 3, curva: 1.2 }) },
    { x: chasquido(20, 500, 1, 381), en: 0.15 },
    { x: crujido(F, 4, { ms: 900, tono: 0.75, vol: 1, hp: 160 }), en: 0.15 },
    { x: sub(0.9, { f0: 280, f1: 26, vol: 1, curva: 1.6, a: 0.001 }), en: 0.15 },
    { x: ganancia(trozo(reafinar(recortarCabeza(F("lowFrequency_explosion_001")), 0.85), 0, 1.0), 0.6), en: 0.15 },
    { x: ganancia(cola(crujido(F, 0, { ms: 400, tono: 1.05, vol: 0.7, hp: 700 }), { largo: 0.5, mezclaSeca: 0.3, decaimiento: 4.5 }), 0.45), en: 0.45 },
  ], 1.6) },

  emp: { cat: "aviso", n: 1, hacer: () => mezclar([
    { x: cuerpo(0.42, { f0: 3400, f1: 190, tipo: "square", lp0: 8000, lp1: 500, q: 3, vol: 0.6, drive: 3 }) },
    { x: crepitar(0.4, { f: 2000, vol: 0.6, densidad: 0.45, s: 391 }) },
    { x: sub(0.35, { f0: 200, f1: 45, vol: 0.7, curva: 1.9 }) },
    { x: ganancia(cola(crepitar(0.2, { f: 3000, vol: 0.4, densidad: 0.3, s: 393 }), { largo: 0.35, mezclaSeca: 0.3, decaimiento: 5 }), 0.35), en: 0.1 },
  ], 0.85) },

  mision_ini: { cat: "aviso", n: 1, hacer: () => mezclar([
    ...[392, 523, 659].map((f, i) => ({
      x: mezclar([
        { x: aplicarEnv(osc(0.34, { tipo: "tri", f0: f, vol: 0.42 }), env(secs(0.34), { a: 0.006, curva: 1.9 })) },
        { x: aplicarEnv(osc(0.34, { tipo: "sawsucia", f0: f * 2, vol: 0.1 }), env(secs(0.34), { a: 0.006, curva: 2.6 })) },
        { x: sub(0.18, { f0: f / 2, f1: f / 2, vol: 0.28, curva: 2 }) },
      ]), en: i * 0.1,
    })),
    { x: mezclar([
      { x: aplicarEnv(osc(0.55, { tipo: "tri", f0: 784, vol: 0.5 }), env(secs(0.55), { a: 0.006, curva: 1.6 })) },
      { x: aplicarEnv(osc(0.55, { tipo: "sine", f0: 1176, vol: 0.2 }), env(secs(0.55), { a: 0.006, curva: 1.8 })) },
      { x: sub(0.35, { f0: 196, f1: 98, vol: 0.4, curva: 1.5 }) },
    ]), en: 0.3 },
  ], 0.95) },

  victoria: { cat: "aviso", n: 1, hacer: () => mezclar([
    ...[523, 659, 784, 1046, 1319].map((f, i) => ({
      x: mezclar([
        { x: aplicarEnv(osc(0.5, { tipo: "tri", f0: f, vol: 0.4 }), env(secs(0.5), { a: 0.005, curva: 1.7 })) },
        { x: aplicarEnv(osc(0.5, { tipo: "sine", f0: f / 2, vol: 0.24 }), env(secs(0.5), { a: 0.005, curva: 1.5 })) },
        { x: aplicarEnv(osc(0.5, { tipo: "sawsucia", f0: f * 2, vol: 0.07 }), env(secs(0.5), { a: 0.005, curva: 2.6 })) },
      ]), en: i * 0.11,
    })),
    { x: sub(0.6, { f0: 262, f1: 131, vol: 0.45, curva: 1.4 }), en: 0.44 },
    { x: ganancia(cola(chasquido(8, 2200, 0.4, 401), { largo: 0.6, mezclaSeca: 0.2, decaimiento: 3.6 }), 0.35), en: 0.5 },
  ], 1.35) },

  derrota: { cat: "aviso", n: 1, hacer: () => mezclar([
    ...[440, 392, 330, 247].map((f, i) => ({
      x: mezclar([
        { x: cuerpo(0.55, { f0: f, f1: f * 0.94, tipo: "sawsucia", lp0: 1600, lp1: 700, q: 2, vol: 0.45, drive: 2.6, curva: 1.5, a: 0.01 }) },
        { x: sub(0.4, { f0: f / 2, f1: f / 2.2, vol: 0.35, curva: 1.5 }) },
      ]), en: i * 0.17,
    })),
    { x: sub(0.9, { f0: 124, f1: 40, vol: 0.6, curva: 1.3 }), en: 0.51 },
  ], 1.5) },

  desbloqueo: { cat: "premio", n: 1, hacer: () => mezclar([
    { x: chasquido(9, 2400, 0.5, 411) },
    ...[659, 988, 1319].map((f, i) => ({
      x: mezclar([
        { x: aplicarEnv(osc(0.4, { tipo: "tri", f0: f, vol: 0.42 }), env(secs(0.4), { a: 0.004, curva: 1.8 })) },
        { x: aplicarEnv(osc(0.4, { tipo: "sine", f0: f * 2, vol: 0.12 }), env(secs(0.4), { a: 0.004, curva: 2.4 })) },
      ]), en: 0.02 + i * 0.085,
    })),
    { x: sub(0.3, { f0: 330, f1: 165, vol: 0.35 }) },
    { x: ganancia(cola(chasquido(6, 3400, 0.3, 413), { largo: 0.5, mezclaSeca: 0.22, decaimiento: 4 }), 0.3), en: 0.2 },
  ], 0.8) },

  // ── INTERFAZ ────────────────────────────────────────────
  //  Cortos y secos. La interfaz no puede tener cola: se navega rápido y
  //  dos colas solapadas suenan a error.
  ui_sel: { cat: "ui", n: 2, hacer: (F, k) => mezclar([
    { x: chasquido(4, 4200, 0.4, 421 + k) },
    { x: aplicarEnv(osc(0.055, { tipo: "tri", f0: 780 + k * 40, f1: 1170 + k * 40, vol: 0.5 }), env(secs(0.055), { a: 0.002, curva: 2.6 })) },
    { x: sub(0.04, { f0: 280, f1: 150, vol: 0.25 }) },
  ], 0.08) },

  ui_ok: { cat: "ui", n: 1, hacer: () => mezclar([
    { x: chasquido(5, 3200, 0.45, 431) },
    { x: aplicarEnv(osc(0.07, { tipo: "tri", f0: 660, vol: 0.5 }), env(secs(0.07), { a: 0.002, curva: 2.4 })) },
    { x: aplicarEnv(osc(0.14, { tipo: "tri", f0: 990, vol: 0.55 }), env(secs(0.14), { a: 0.002, curva: 2 })), en: 0.05 },
    { x: sub(0.08, { f0: 330, f1: 165, vol: 0.3 }) },
  ], 0.22) },

  ui_atras: { cat: "ui", n: 1, hacer: () => mezclar([
    { x: chasquido(4, 2600, 0.35, 441) },
    { x: aplicarEnv(osc(0.09, { tipo: "tri", f0: 540, f1: 310, vol: 0.5 }), env(secs(0.09), { a: 0.002, curva: 2.2 })) },
    { x: sub(0.07, { f0: 260, f1: 120, vol: 0.3 }) },
  ], 0.13) },

  ui_no: { cat: "ui", n: 1, hacer: () => mezclar([
    { x: chasquido(6, 1400, 0.4, 451) },
    { x: cuerpo(0.12, { f0: 210, f1: 155, tipo: "square", lp0: 1300, lp1: 800, vol: 0.55, drive: 2.6, curva: 1.8 }) },
    { x: sub(0.1, { f0: 105, f1: 78, vol: 0.4 }) },
  ], 0.17) },

  ui_pausa: { cat: "ui", n: 1, hacer: (F) => mezclar([
    { x: ganancia(trozo(reafinar(recortarCabeza(F("doorClose_001")), 1.35), 0, 0.2), 0.5) },
    { x: chasquido(6, 1800, 0.45, 461) },
    { x: cuerpo(0.11, { f0: 420, f1: 200, tipo: "tri", lp0: 2400, lp1: 1100, vol: 0.45, drive: 2 }) },
    { x: sub(0.1, { f0: 200, f1: 95, vol: 0.4 }) },
  ], 0.24) },

  // ── ENEMIGOS CON IDENTIDAD ──────────────────────────────
  sniper_lock: { cat: "aviso", n: 1, agudo: true, hacer: () => mezclar([
    { x: mezclar([
      { x: aplicarEnv(osc(0.08, { tipo: "sine", f0: 1760, vol: 0.5 }), env(secs(0.08), { a: 0.002, curva: 2.4 })) },
      { x: aplicarEnv(osc(0.08, { tipo: "saw", f0: 3520, vol: 0.1 }), env(secs(0.08), { a: 0.002, curva: 3 })) },
    ]) },
    { x: mezclar([
      { x: aplicarEnv(osc(0.09, { tipo: "sine", f0: 2349, vol: 0.55 }), env(secs(0.09), { a: 0.002, curva: 2.4 })) },
      { x: aplicarEnv(osc(0.09, { tipo: "saw", f0: 4698, vol: 0.1 }), env(secs(0.09), { a: 0.002, curva: 3 })) },
    ]), en: 0.13 },
    { x: sub(0.06, { f0: 440, f1: 220, vol: 0.2 }) },
  ], 0.26) },

  sniper_aviso: { cat: "aviso", n: 1, hacer: () => mezclar([
    { x: chasquido(4, 4000, 0.3, 471) },
    { x: aplicarEnv(osc(0.06, { tipo: "square", f0: 1200, vol: 0.4 }), env(secs(0.06), { a: 0.002, curva: 2.6 })) },
  ], 0.09) },

  sniper_tiro: { cat: "disparoEne", n: 2, hacer: (F, k) => mezclar([
    { x: chasquido(12, 1800, 0.85, 481 + k) },
    { x: metal(F, 1 + k, { ms: 120, tono: 1.1, vol: 0.55, hp: 800 }) },
    { x: cuerpo(0.14, { f0: 2400 - k * 150, f1: 230, tipo: "sawsucia", lp0: 6000, lp1: 700, q: 4, vol: 0.75, drive: 3.4 }) },
    { x: sub(0.16, { f0: 200, f1: 48, vol: 0.7, curva: 2.2 }) },
  ], 0.24) },

  kamikaze: { cat: "aviso", n: 1, hacer: (F, k) => mezclar([
    { x: cuerpo(0.55, { f0: 230, f1: 980, tipo: "sawsucia", lp0: 1300, lp1: 3800, q: 2.6, vol: 0.7, drive: 3, curva: 0.5, a: 0.16 }) },
    { x: osc(0.55, { tipo: "sine", f0: 115, f1: 490, vol: 0.25 }) },
    { x: ganancia(aplicarEnv(filtro(ruidoRosa(0.55, { semilla: 491 + k }), { tipo: "bp", f0: 900, f1: 4200, q: 1.5 }), env(secs(0.55), { a: 0.3, curva: 0.6, sostiene: 0.7 })), 0.3) },
  ], 0.6) },

  escudo_zumb: { cat: "aviso", n: 2, hacer: (F, k) => mezclar([
    { x: ganancia(trozo(reafinar(recortarCabeza(F("forceField_00" + (k + 1))), 1.05), 0, 0.28), 0.45) },
    { x: cuerpo(0.24, { f0: 430 - k * 20, f1: 215, tipo: "tri", lp0: 2200, lp1: 1100, q: 3, vol: 0.5, drive: 2 }) },
    { x: osc(0.24, { tipo: "sine", f0: 645, f1: 322, vol: 0.16 }) },
    { x: sub(0.18, { f0: 215, f1: 105, vol: 0.35 }) },
  ], 0.32) },

  // ── IDENTIDAD DE JEFES ──────────────────────────────────
  roca_impacto: { cat: "impacto", n: 2, hacer: (F, k) => mezclar([
    { x: chasquido(9, 900, 0.6, 501 + k) },
    { x: ganancia(aplicarEnv(filtro(ruidoRosa(0.15, { semilla: 505 + k }), { tipo: "lp", f0: 1400, f1: 320, q: 1.4 }), env(secs(0.15), { a: 0.001, curva: 2.6 })), 0.8) },
    { x: cuerpo(0.11, { f0: 130 + k * 8, f1: 52, tipo: "sawsucia", lp0: 800, lp1: 250, vol: 0.6, drive: 3.4 }) },
    { x: sub(0.16, { f0: 110, f1: 40, vol: 0.7 }) },
  ], 0.22) },

  roca_break: { cat: "explosion", n: 2, hacer: (F, k) => mezclar([
    { x: chasquido(11, 1100, 0.7, 511 + k) },
    { x: crujido(F, (k + 2) % 5, { ms: 320, tono: 1.15, vol: 0.75, hp: 300 }) },
    { x: ganancia(aplicarEnv(filtro(ruidoRosa(0.26, { semilla: 515 + k }), { tipo: "lp", f0: 2400, f1: 380, q: 1.2 }), env(secs(0.26), { a: 0.001, curva: 2.2 })), 0.7) },
    { x: sub(0.24, { f0: 165, f1: 44, vol: 0.75 }) },
  ], 0.42) },

  reaper_carga: { cat: "aviso", n: 1, hacer: () => mezclar([
    { x: cuerpo(0.6, { f0: 95, f1: 360, tipo: "sawsucia", lp0: 1400, lp1: 3400, q: 3.5, vol: 0.75, drive: 3.2, curva: 0.45, a: 0.3 }) },
    { x: osc(0.6, { tipo: "sine", f0: 190, f1: 720, vol: 0.22 }) },
    { x: ganancia(aplicarEnv(filtro(ruidoRosa(0.55, { semilla: 521 }), { tipo: "hp", f0: 620, f1: 2200, q: 1.3 }), env(secs(0.55), { a: 0.32, curva: 0.6, sostiene: 0.75 })), 0.35) },
    { x: sub(0.2, { f0: 80, f1: 42, vol: 0.4, curva: 1.4 }), en: 0.42 },
  ], 0.7) },

  aegis_lock: { cat: "aviso", n: 1, agudo: true, hacer: (F, k) => mezclar([
    { x: chasquido(4, 3600, 0.3, 531 + k) },
    { x: aplicarEnv(osc(0.05, { tipo: "square", f0: 1500 + k * 90, vol: 0.4 }), env(secs(0.05), { a: 0.002, curva: 2.8 })) },
    { x: aplicarEnv(osc(0.06, { tipo: "square", f0: 1900 + k * 90, vol: 0.4 }), env(secs(0.06), { a: 0.002, curva: 2.8 })), en: 0.07 },
  ], 0.15) },

  aegis_nodo: { cat: "explosion", n: 2, hacer: (F, k) => mezclar([
    { x: chasquido(9, 2200, 0.7, 541 + k) },
    { x: metal(F, (k + 3) % 5, { ms: 110, tono: 1.35, vol: 0.6, hp: 900 }) },
    { x: cuerpo(0.15, { f0: 2600 - k * 120, f1: 380, tipo: "sawsucia", lp0: 5200, lp1: 800, q: 3.5, vol: 0.65, drive: 3 }) },
    { x: crepitar(0.2, { f: 3000, vol: 0.35, densidad: 0.35, s: 545 + k }), en: 0.02 },
    { x: sub(0.2, { f0: 190, f1: 50, vol: 0.7 }) },
  ], 0.34) },

  aegis_overload: { cat: "jefe", n: 1, hacer: () => mezclar([
    { x: cuerpo(0.95, { f0: 200, f1: 2800, tipo: "sawsucia", lp0: 1200, lp1: 7000, q: 3.5, vol: 0.75, drive: 3.4, curva: 0.35, a: 0.6 }) },
    { x: osc(0.95, { tipo: "sine", f0: 100, f1: 1400, vol: 0.22 }) },
    { x: crepitar(0.9, { f: 2400, vol: 0.4, densidad: 0.3, s: 551 }) },
    { x: chasquido(16, 800, 0.8, 553), en: 0.9 },
    { x: sub(0.5, { f0: 140, f1: 30, vol: 0.85, curva: 1.6 }), en: 0.9 },
  ], 1.6) },

  venom_pulso: { cat: "disparoEne", n: 2, hacer: (F, k) => mezclar([
    { x: cuerpo(0.28, { f0: 270 - k * 12, f1: 88, tipo: "tri", lp0: 1600, lp1: 420, q: 3, vol: 0.7, drive: 2.6, curva: 1.6, a: 0.008 }) },
    { x: osc(0.24, { tipo: "sine", f0: 405, f1: 132, vol: 0.2 }) },
    { x: ganancia(aplicarEnv(filtro(ruidoRosa(0.2, { semilla: 561 + k }), { tipo: "lp", f0: 1200, f1: 400 }), env(secs(0.2), { a: 0.01, curva: 1.8 })), 0.28) },
    { x: sub(0.22, { f0: 135, f1: 44, vol: 0.6 }) },
  ], 0.34) },

  venom_zona: { cat: "aviso", n: 1, hacer: () => mezclar([
    { x: cuerpo(0.42, { f0: 185, f1: 350, tipo: "tri", lp0: 900, lp1: 1800, q: 2.4, vol: 0.55, drive: 2.2, curva: 1, a: 0.14 }) },
    { x: ganancia(aplicarEnv(filtro(ruidoRosa(0.4, { semilla: 571 }), { tipo: "lp", f0: 900, f1: 1600 }), env(secs(0.4), { a: 0.1, curva: 1.2, sostiene: 0.4 })), 0.4) },
    { x: sub(0.3, { f0: 92, f1: 60, vol: 0.45, curva: 1.4 }) },
  ], 0.55) },

  venom_collapse: { cat: "jefe", n: 1, hacer: (F) => mezclar([
    { x: chasquido(14, 700, 0.7, 581) },
    { x: sub(1.15, { f0: 225, f1: 24, vol: 1, curva: 1.5, a: 0.002 }) },
    { x: crujido(F, 2, { ms: 800, tono: 0.7, vol: 0.7, hp: 200 }), en: 0.06 },
    { x: ganancia(aplicarEnv(filtro(ruidoRosa(0.85, { semilla: 583 }), { tipo: "lp", f0: 1300, f1: 180, q: 1.3 }), env(secs(0.85), { a: 0.08, curva: 1.5 })), 0.55), en: 0.1 },
    { x: ganancia(cola(crujido(F, 0, { ms: 300, tono: 0.9, vol: 0.5, hp: 500 }), { largo: 0.6, mezclaSeca: 0.25, decaimiento: 4 }), 0.4), en: 0.45 },
  ], 1.7) },

  gravedad_forma: { cat: "aviso", n: 1, hacer: () => mezclar([
    { x: cuerpo(0.62, { f0: 920, f1: 145, tipo: "tri", lp0: 3600, lp1: 700, q: 3.2, vol: 0.6, drive: 2.2, curva: 1, a: 0.28 }) },
    { x: osc(0.62, { tipo: "sine", f0: 1380, f1: 218, vol: 0.18 }) },
    { x: ganancia(aplicarEnv(filtro(ruidoRosa(0.6, { semilla: 591 }), { tipo: "bp", f0: 2600, f1: 500, q: 1.8 }), env(secs(0.6), { a: 0.25, curva: 1 })), 0.3) },
    { x: sub(0.4, { f0: 150, f1: 62, vol: 0.5, curva: 1.4 }), en: 0.2 },
  ], 0.75) },

  gravedad_colapso: { cat: "jefe", n: 1, hacer: () => mezclar([
    { x: ganancia(aplicarEnv(filtro(invertir(ruidoRosa(0.42, { semilla: 601 })), { tipo: "hp", f0: 260, f1: 900 }), env(secs(0.42), { a: 0.34, curva: 0.5, sostiene: 0.8 })), 0.75) },
    { x: cuerpo(0.5, { f0: 2600, f1: 62, tipo: "sawsucia", lp0: 6000, lp1: 260, q: 3, vol: 0.8, drive: 3.6, curva: 1.6 }) },
    { x: sub(0.7, { f0: 260, f1: 26, vol: 1, curva: 1.5 }), en: 0.03 },
    { x: chasquido(14, 600, 0.7, 605), en: 0.02 },
  ], 1.1) },

  fuego_ignicion: { cat: "aviso", n: 2, hacer: (F, k) => mezclar([
    { x: chasquido(8, 1400, 0.45, 611 + k) },
    { x: ganancia(saturar(aplicarEnv(filtro(ruidoRosa(0.32, { semilla: 615 + k }), { tipo: "lp", f0: 3000, f1: 620, q: 1.4 }), env(secs(0.32), { a: 0.02, curva: 1.4 })), { drive: 2.8, mezcla: 0.7 }), 0.8) },
    { x: cuerpo(0.22, { f0: 280 - k * 12, f1: 88, tipo: "sawsucia", lp0: 1600, lp1: 420, vol: 0.5, drive: 3.4 }) },
    { x: sub(0.26, { f0: 130, f1: 42, vol: 0.6 }) },
  ], 0.4) },

  core_offline: { cat: "aviso", n: 2, hacer: (F, k) => mezclar([
    { x: chasquido(7, 2600, 0.5, 621 + k) },
    { x: cuerpo(0.3, { f0: 1250 - k * 60, f1: 195, tipo: "square", lp0: 3400, lp1: 700, q: 2.6, vol: 0.6, drive: 2.8, curva: 1.7 }) },
    { x: crepitar(0.18, { f: 1800, vol: 0.3, densidad: 0.3, s: 625 + k }), en: 0.02 },
    { x: sub(0.28, { f0: 165, f1: 44, vol: 0.65 }) },
  ], 0.42) },

  alarma_flota: { cat: "aviso", n: 1, hacer: () => mezclar([
    ...[0, 0.26].map(t => ({
      x: mezclar([
        { x: cuerpo(0.21, { f0: 540, f1: 500, tipo: "square", lp0: 2200, lp1: 1400, vol: 0.5, drive: 2.6, curva: 1.5, a: 0.005 }) },
        { x: osc(0.21, { tipo: "saw", f0: 270, f1: 250, vol: 0.13 }) },
        { x: sub(0.16, { f0: 135, f1: 100, vol: 0.32 }) },
      ]), en: t,
    })),
  ], 0.52) },

  reactor: { cat: "aviso", n: 1, hacer: (F, k) => mezclar([
    { x: cuerpo(0.9, { f0: 72 + k * 4, f1: 56, tipo: "sawsucia", lp0: 400, lp1: 220, q: 2, vol: 0.55, drive: 3.4, curva: 0.9, a: 0.12 }) },
    { x: osc(0.9, { tipo: "sine", f0: 144, f1: 112, vol: 0.14 }) },
    { x: ganancia(aplicarEnv(filtro(ruidoRosa(0.85, { semilla: 631 + k }), { tipo: "lp", f0: 420, f1: 200 }), env(secs(0.85), { a: 0.2, curva: 1, sostiene: 0.4 })), 0.22) },
  ], 1.0) },

  finale: { cat: "jefe", n: 1, hacer: () => mezclar([
    ...[220, 330, 440, 660, 880].map((f, i) => ({
      x: mezclar([
        { x: aplicarEnv(osc(0.7, { tipo: "tri", f0: f, vol: 0.4 }), env(secs(0.7), { a: 0.006, curva: 1.5 })) },
        { x: aplicarEnv(osc(0.6, { tipo: "sine", f0: f * 1.5, vol: 0.18 }), env(secs(0.6), { a: 0.006, curva: 1.7 })) },
        { x: sub(0.4, { f0: f / 2, f1: f / 2, vol: 0.3, curva: 1.4 }) },
      ]), en: i * 0.16,
    })),
    { x: ganancia(aplicarEnv(filtro(ruidoRosa(1.2, { semilla: 641 }), { tipo: "lp", f0: 4200, f1: 420 }), env(secs(1.2), { a: 0.5, curva: 1.1 })), 0.3), en: 0.7 },
    { x: sub(0.9, { f0: 110, f1: 42, vol: 0.55, curva: 1.2 }), en: 0.64 },
  ], 2.1) },

  campana_victoria: { cat: "jefe", n: 1, hacer: () => mezclar([
    ...[392, 523, 659, 784, 1046, 1319, 1568].map((f, i) => ({
      x: mezclar([
        { x: aplicarEnv(osc(0.75, { tipo: "tri", f0: f, vol: 0.38 }), env(secs(0.75), { a: 0.005, curva: 1.5 })) },
        { x: aplicarEnv(osc(0.75, { tipo: "sine", f0: f / 2, vol: 0.22 }), env(secs(0.75), { a: 0.005, curva: 1.4 })) },
        { x: aplicarEnv(osc(0.5, { tipo: "sawsucia", f0: f * 2, vol: 0.06 }), env(secs(0.5), { a: 0.005, curva: 2.4 })) },
      ]), en: i * 0.13,
    })),
    { x: sub(0.9, { f0: 196, f1: 98, vol: 0.45, curva: 1.2 }), en: 0.78 },
    { x: ganancia(cola(chasquido(9, 2000, 0.4, 651), { largo: 0.8, mezclaSeca: 0.18, decaimiento: 3.2 }), 0.35), en: 0.8 },
  ], 2.3) },
};

export { ACABADO };
