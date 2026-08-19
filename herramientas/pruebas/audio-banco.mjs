// ════════════════════════════════════════════════════════════
//  audio-banco.mjs — el banco de muestras y la mezcla, en navegador
// ════════════════════════════════════════════════════════════
//
//    node herramientas/pruebas/audio-banco.mjs
//
//  Comprueba lo que solo se ve con un AudioContext de verdad:
//
//    1. Que los 124 MP3 del banco DESCODIFICAN. Un archivo corrupto no
//       da error visible: el sonido cae a la síntesis y nadie se entera.
//    2. Que se descodifican con la política de autoplay estricta, o sea
//       la de iOS: primero el gesto, luego el banco.
//    3. Que el recorte del silencio de cabeza del MP3 funciona. Es lo
//       que separa "responde" de "va con retraso".
//    4. Que el límite de voces por grupo frena de verdad. Se piden 60
//       disparos en un fotograma y tienen que sonar 4.
//    5. Que el agachado se dispara con la explosión del jefe y VUELVE.
//       Un agachado que no vuelve deja el juego bajo de volumen para
//       siempre y es el fallo más difícil de ver desde dentro.
//    6. Que reproducir los 71 sonidos seguidos no lanza ni una excepción.

import { servidor, cargarPlaywright } from "../qa.mjs";

const srv = await servidor();
const { chromium } = await cargarPlaywright();
const navegador = await chromium.launch({
  args: ["--autoplay-policy=document-user-activation-required"],
});
const ctx = await navegador.newContext({
  viewport: { width: 820, height: 1180 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true,
});
const p = await ctx.newPage();
const errores = [];
p.on("pageerror", e => errores.push("EXCEPCION " + e.message));
p.on("console", m => { if (m.type() === "error") errores.push("CONSOLE " + m.text()); });
p.on("requestfailed", r => errores.push("RED " + r.url() + " " + (r.failure() || {}).errorText));
p.on("response", r => { if (r.status() >= 400) errores.push("HTTP " + r.status() + " " + r.url()); });

await p.goto(srv.url + "?debug", { waitUntil: "load" });
await p.waitForTimeout(600);

const fallos = [];
const comprobar = (ok, txt) => { console.log((ok ? "  ok   " : "  FALLO") + "  " + txt); if (!ok) fallos.push(txt); };

// 1 · El banco está en la página pero NO descodificado: no ha habido gesto.
const antes = await p.evaluate(() => ({
  hayBanco: !!(window.SFX_MUESTRAS && window.SFX_MUESTRAS.d),
  ids: window.SFX_MUESTRAS ? Object.keys(window.SFX_MUESTRAS.d).length : 0,
  listas: muestrasDbg.listas, ctx: audio ? audio.state : null,
}));
console.log("\n— antes de tocar —");
comprobar(antes.hayBanco, "audio/muestras.js cargado (" + antes.ids + " ids)");
comprobar(antes.ctx === null, "sin AudioContext antes del gesto (iOS)");
comprobar(antes.listas === 0, "nada descodificado antes del gesto");

// 2 · Gesto real. A partir de aquí el banco tiene que descodificarse solo.
await p.mouse.click(410, 900);
await p.waitForFunction(() => muestrasDbg.total > 0 &&
  muestrasDbg.listas + muestrasDbg.fallo >= muestrasDbg.total, null, { timeout: 45000 })
  .catch(() => {});

const banco = await p.evaluate(() => ({
  total: muestrasDbg.total, listas: muestrasDbg.listas, fallo: muestrasDbg.fallo, ms: muestrasDbg.ms,
  ids: Object.keys(MUESTRAS).length,
  sinBuffer: Object.keys(MUESTRAS).filter(k => !MUESTRAS[k].bufs.length),
  // Recorte de cabeza: cuánto silencio de codificación se está saltando.
  offMax: Math.max(...Object.values(MUESTRAS).flatMap(m => m.offs)),
  offMed: (() => { const o = Object.values(MUESTRAS).flatMap(m => m.offs);
    return o.reduce((a, b) => a + b, 0) / Math.max(1, o.length); })(),
  ctx: audio.state, sr: audio.sampleRate,
}));
console.log("\n— banco —");
comprobar(banco.fallo === 0, `descodificados ${banco.listas}/${banco.total} sin fallos (${banco.ms} ms)`);
comprobar(banco.listas === banco.total, "todos los archivos del banco están listos");
comprobar(banco.sinBuffer.length === 0, "ningún id se ha quedado sin muestra" +
  (banco.sinBuffer.length ? ": " + banco.sinBuffer.join(",") : ""));
comprobar(banco.offMax < 0.06, `recorte de cabeza mp3: medio ${(banco.offMed * 1000).toFixed(1)} ms, máx ${(banco.offMax * 1000).toFixed(1)} ms`);

// 3 · Límite de voces por grupo: 60 disparos de golpe, y el cupo es 4.
const cupo = await p.evaluate(() => {
  for (const k in vocesGrupo) vocesGrupo[k] = 0;
  for (const k in sonVivos) sonVivos[k] = 0;
  voces = 0;
  let sonaron = 0;
  const real = audio.createBufferSource.bind(audio);
  audio.createBufferSource = () => { sonaron++; return real(); };
  // Sin `espera` no habría prueba: se cuenta lo que deja pasar el CUPO.
  const g = SONIDOS.cannon.espera; SONIDOS.cannon.espera = 0;
  for (let i = 0; i < 60; i++) sfx("cannon");
  SONIDOS.cannon.espera = g;
  audio.createBufferSource = real;
  return { sonaron, enGrupo: vocesGrupo.disparo, max: GRUPOS.disparo.max };
});
console.log("\n— límite de voces —");
comprobar(cupo.sonaron === cupo.max,
  `60 disparos pedidos en un fotograma → ${cupo.sonaron} sonando (cupo ${cupo.max})`);

// 4 · Agachado: baja al entrar el jefe y vuelve solo.
await p.waitForTimeout(400);
const duck = await p.evaluate(async () => {
  const lee = () => +GRP.disparo.gain.value.toFixed(3);
  const reposo = lee();
  sfx("exp_boss");
  await new Promise(r => setTimeout(r, 90));
  const dentro = lee();
  await new Promise(r => setTimeout(r, 1900));
  return { reposo, dentro, despues: lee() };
});
console.log("\n— agachado por prioridad —");
comprobar(duck.dentro < duck.reposo - 0.1,
  `la explosión de jefe aparta los disparos: ${duck.reposo} → ${duck.dentro}`);
comprobar(duck.despues > 0.9, `y vuelve a su sitio: ${duck.despues}`);

// 5 · Los 71 sonidos, uno detrás de otro, sin excepciones.
const todos = await p.evaluate(async () => {
  const ids = Object.keys(SONIDOS);
  let usaronMuestra = 0;
  for (const id of ids) {
    for (const k in sonVivos) sonVivos[k] = 0;
    for (const k in vocesGrupo) vocesGrupo[k] = 0;
    voces = 0; sonUltimo[id] = -1e9;
    const antes = MUESTRAS[id] ? MUESTRAS[id].ult : -99;
    sfx(id);
    if (MUESTRAS[id] && MUESTRAS[id].bufs.length) usaronMuestra++;
    void antes;
  }
  await new Promise(r => setTimeout(r, 200));
  return { n: ids.length, usaronMuestra };
});
console.log("\n— catálogo completo —");
comprobar(todos.usaronMuestra === todos.n,
  `los ${todos.n} sonidos del catálogo suenan por muestra, no por síntesis`);

// 6 · Y con el banco quitado, el repuesto sintetizado sigue sonando.
const repuesto = await p.evaluate(async () => {
  const guardado = {};
  for (const k of Object.keys(MUESTRAS)) { guardado[k] = MUESTRAS[k]; delete MUESTRAS[k]; }
  let osc = 0;
  const real = audio.createOscillator.bind(audio);
  audio.createOscillator = () => { osc++; return real(); };
  for (const id of Object.keys(SONIDOS)) {
    for (const k in sonVivos) sonVivos[k] = 0;
    for (const k in vocesGrupo) vocesGrupo[k] = 0;
    voces = 0; sonUltimo[id] = -1e9;
    sfx(id);
  }
  audio.createOscillator = real;
  Object.assign(MUESTRAS, guardado);
  return osc;
});
console.log("\n— repuesto sintetizado —");
comprobar(repuesto > 60, `sin banco, la síntesis cubre el catálogo (${repuesto} osciladores)`);

console.log("\nerrores de página: " + (errores.length ? "\n  " + errores.join("\n  ") : "ninguno"));
if (errores.length) fallos.push("errores en la página");

await navegador.close(); await srv.cerrar();
console.log(fallos.length ? `\n${fallos.length} FALLOS` : "\nTODO OK");
process.exit(fallos.length ? 1 : 0);
