// ════════════════════════════════════════════════════════════
//  stingers.mjs — los cortes musicales que el pack CC0 no trae
// ════════════════════════════════════════════════════════════
//  El pack de OpenGameArt trae cinco BUCLES y ningún corte. Estos cuatro
//  —misión completada, victoria, derrota, desbloqueo— se fabrican aquí
//  con el mismo taller que los efectos.
//
//  Por qué no se buscan también en CC0: un stinger es lo más corto y lo
//  más expuesto que hay en una banda sonora. Suena solo, sin nada que lo
//  tape, justo cuando el jugador está mirando. Cuatro cortes de cuatro
//  autores distintos suenan a cuatro juegos distintos pegados. Estos
//  comparten paleta entre sí, y eso importa más que la procedencia.
//
//  Todos en LA MENOR / DO MAYOR, que es donde se mueven las pistas del
//  pack: así el corte no choca con el bucle que se está agachando debajo.

import {
  SR, secs, buf, env, aplicarEnv, osc, sub, ruidoRosa, filtro,
  saturar, mezclar, cola, limitar, fadeOut, normalizarPico, ganancia,
} from "./dsp.mjs";

// ── Notas ─────────────────────────────────────────────────
//  Nombre a frecuencia. Se escriben las recetas con notas y no con
//  números porque una fanfarria hay que poder leerla.
const NOTA = { C:0, "C#":1, D:2, "D#":3, E:4, F:5, "F#":6, G:7, "G#":8, A:9, "A#":10, B:11 };
const hz = (n) => {
  const m = n.match(/^([A-G]#?)(-?\d)$/);
  return 440 * Math.pow(2, (NOTA[m[1]] + (+m[2] - 4) * 12 - 9) / 12);
};

// ── Voz de sintetizador ───────────────────────────────────
//  Dos sierras desafinadas + un sub. La desafinación es lo que separa un
//  sintetizador de un pitido: con las dos sierras exactamente afinadas
//  esto suena a zumbador de microondas.
function voz(f, dur, {
  vol = 1, detune = 0.008, corte = 4200, corte2 = null, q = 2.2,
  a = 0.006, curva = 2.0, sostiene = 0, subVol = 0.34, brillo = 1,
} = {}) {
  let x = mezclar([
    { x: osc(dur, { tipo: "saw",    f0: f * (1 - detune), vol: 0.50, semilla: 3 }) },
    { x: osc(dur, { tipo: "saw",    f0: f * (1 + detune), vol: 0.50, semilla: 9 }) },
    { x: osc(dur, { tipo: "square", f0: f, pwm: 0.42, vol: 0.16 * brillo, semilla: 5 }) },
    { x: osc(dur, { tipo: "sine",   f0: f / 2, vol: subVol }) },
  ]);
  x = filtro(x, { tipo: "lp", f0: corte, f1: corte2 != null ? corte2 : corte * 0.42, q });
  x = aplicarEnv(x, env(x.length, { a, curva, sostiene }));
  return ganancia(saturar(x, { drive: 1.5, mezcla: 0.35 }), vol);
}

// Acorde: las voces entran con 4 ms entre ellas. Sin ese desfase las
// fundamentales se suman en fase y el acorde pega un pico que obliga a
// bajarlo entero.
const acorde = (notas, dur, o = {}) =>
  mezclar(notas.map((n, i) => ({ x: voz(hz(n), dur - i * 0.004, o), en: i * 0.004 })));

// Golpe grave de apoyo. Lo que hace que un corte se sienta como un
// PUNTO Y APARTE y no como una notita.
const golpe = (dur = 0.5, f0 = 150, f1 = 38, vol = 0.7) =>
  saturar(sub(dur, { f0, f1, vol }), { drive: 2.2, mezcla: 0.55 });

// Brillo de aire: ruido rosa muy agudo con cola. Es el "destello".
const destello = (dur = 0.7, vol = 0.16, f = 6500) =>
  ganancia(cola(aplicarEnv(filtro(ruidoRosa(dur, { semilla: 17 }), { tipo: "hp", f0: f, q: 0.8 }),
    env(secs(dur), { a: 0.004, curva: 2.6 })), { largo: 0.4, mezclaSeca: 0.7, brillo: 8000 }), vol);

// ── Las cuatro recetas ────────────────────────────────────
export const STINGERS = {

  // MISIÓN COMPLETADA. Se oye diez veces por campaña, así que es el más
  // corto y el menos triunfal de los cuatro: satisfecho, no épico. Si
  // este fuera una fanfarria enorme, la victoria del jefe no tendría
  // dónde crecer.
  mision: { dur: 2.8, hacer: () => {
    const p = 0.16;
    return mezclar([
      { x: voz(hz("F4"), 0.30, { vol: 0.50, corte: 3600 }), en: 0 },
      { x: voz(hz("G4"), 0.30, { vol: 0.50, corte: 3900 }), en: p },
      { x: voz(hz("A4"), 0.34, { vol: 0.55, corte: 4200 }), en: p * 2 },
      { x: acorde(["C5", "E5", "G5"], 1.9, { vol: 0.40, corte: 5200, curva: 1.1, sostiene: 0.18 }), en: p * 3 },
      { x: acorde(["C3", "G3"], 1.9, { vol: 0.30, corte: 1800, curva: 1.0, sostiene: 0.20 }), en: p * 3 },
      { x: golpe(0.55, 130, 40, 0.55), en: p * 3 },
      { x: destello(0.8, 0.10), en: p * 3 },
    ], 2.8);
  } },

  // VICTORIA. La del jefe. Sube una octava entera y sostiene el acorde el
  // doble: es la diferencia audible entre "hecho" y "HECHO".
  victoria: { dur: 3.6, hacer: () => {
    const p = 0.13;
    return mezclar([
      { x: golpe(0.6, 180, 44, 0.70), en: 0 },
      { x: voz(hz("C4"), 0.26, { vol: 0.50, corte: 3800 }), en: 0 },
      { x: voz(hz("E4"), 0.26, { vol: 0.50, corte: 4100 }), en: p },
      { x: voz(hz("G4"), 0.26, { vol: 0.52, corte: 4400 }), en: p * 2 },
      { x: voz(hz("C5"), 0.30, { vol: 0.55, corte: 4800 }), en: p * 3 },
      { x: acorde(["C5", "E5", "G5", "C6"], 2.7, { vol: 0.42, corte: 6200, curva: 0.85, sostiene: 0.24, brillo: 1.3 }), en: p * 4 },
      { x: acorde(["C3", "G3", "C4"], 2.7, { vol: 0.30, corte: 2000, curva: 0.80, sostiene: 0.26 }), en: p * 4 },
      { x: golpe(0.9, 200, 34, 0.80), en: p * 4 },
      { x: destello(1.3, 0.15), en: p * 4 },
      { x: destello(1.0, 0.07, 8000), en: p * 4 + 0.5 },
    ], 3.6);
  } },

  // DERROTA. Lo contrario en todo: baja en vez de subir, el filtro se
  // cierra en vez de abrirse, y la afinación cae al final como un motor
  // que se para. Ni un solo agudo brillante.
  derrota: { dur: 3.8, hacer: () => {
    const p = 0.30;
    const caida = filtro(
      aplicarEnv(mezclar([
        { x: osc(1.9, { tipo: "saw", f0: hz("A2"),         f1: hz("A2") * 0.420, curvaF: "exp2", vol: 0.5, semilla: 4 }) },
        { x: osc(1.9, { tipo: "saw", f0: hz("A2") * 1.006, f1: hz("A2") * 0.418, curvaF: "exp2", vol: 0.5, semilla: 8 }) },
      ]), env(secs(1.9), { a: 0.02, curva: 1.2 })),
      { tipo: "lp", f0: 2200, f1: 260, q: 3 });
    return mezclar([
      { x: voz(hz("A4"), 0.42, { vol: 0.42, corte: 2600, corte2: 900 }), en: 0 },
      { x: voz(hz("G4"), 0.42, { vol: 0.40, corte: 2300, corte2: 800 }), en: p },
      { x: voz(hz("F4"), 0.46, { vol: 0.38, corte: 2000, corte2: 700 }), en: p * 2 },
      { x: acorde(["E4", "A4", "C5"], 2.2, { vol: 0.34, corte: 1700, corte2: 520, curva: 0.9, sostiene: 0.16 }), en: p * 3 },
      { x: ganancia(caida, 0.50), en: p * 3 },
      { x: golpe(1.1, 110, 26, 0.75), en: p * 3 },
    ], 3.8);
  } },

  // DESBLOQUEO. El más corto de los cuatro: 1,6 s. Va ENCIMA del bucle
  // sin cortarlo, así que no puede pisar más de un compás.
  unlock: { dur: 1.6, hacer: () => {
    const p = 0.075;
    return mezclar([
      { x: voz(hz("E5"), 0.16, { vol: 0.42, corte: 6000, brillo: 1.4 }), en: 0 },
      { x: voz(hz("G5"), 0.16, { vol: 0.44, corte: 6400, brillo: 1.4 }), en: p },
      { x: voz(hz("B5"), 0.18, { vol: 0.46, corte: 6800, brillo: 1.4 }), en: p * 2 },
      { x: acorde(["E6", "B6"], 1.1, { vol: 0.34, corte: 8000, curva: 1.3, sostiene: 0.10, brillo: 1.5, subVol: 0.10 }), en: p * 3 },
      { x: destello(0.9, 0.20, 7200), en: p * 3 },
      { x: golpe(0.30, 160, 60, 0.30), en: p * 3 },
    ], 1.6);
  } },
};

// Acabado común: pico controlado y cierre limpio. Sin el fundido final
// un MP3 puede acabar en mitad de un ciclo y hacer "clac" al parar.
export function acabar(x) {
  return fadeOut(limitar(normalizarPico(x, 0.93), { techo: 0.95 }), 24);
}
