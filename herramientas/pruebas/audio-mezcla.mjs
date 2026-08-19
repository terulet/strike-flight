// ════════════════════════════════════════════════════════════
//  audio-mezcla.mjs — que no clipee con la pantalla llena
// ════════════════════════════════════════════════════════════
//
//    node herramientas/pruebas/audio-mezcla.mjs
//
//  El brief lo pide con estas palabras: "evitar clipping cuando hay
//  muchos enemigos". Aquí se mide de verdad, no se supone: se pincha un
//  analizador DESPUÉS del compresor —o sea, en lo que sale por el
//  altavoz— y se reproducen escenas reales del juego.
//
//  Si la muestra pico llega a 1.0, la onda está recortada y lo que se
//  oye es un chasquido. El margen sano es quedarse por debajo de 0,99.
//
//  Se comprueba además la jerarquía del brief: el jefe por encima de la
//  explosión, la explosión por encima del disparo propio, y el disparo
//  propio por encima del disparo enemigo.

import { servidor, cargarPlaywright } from "../qa.mjs";

const srv = await servidor();
const { chromium } = await cargarPlaywright();
const nav = await chromium.launch({ args: ["--autoplay-policy=document-user-activation-required"] });
const ctx = await nav.newContext({ viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true });
const p = await ctx.newPage();
const errs = [];
p.on("pageerror", e => errs.push("EXCEPCION " + e.message));
await p.goto(srv.url + "?debug", { waitUntil: "load" });
await p.mouse.click(410, 900);
await p.waitForFunction(() => muestrasDbg.total > 0 && muestrasDbg.listas >= muestrasDbg.total,
  null, { timeout: 60000 }).catch(() => {});

// Analizador enchufado a la salida del compresor.
await p.evaluate(() => {
  window._an = audio.createAnalyser();
  window._an.fftSize = 2048;
  // Después del techo de seguridad: es exactamente lo que va al altavoz.
  BUS.techo.connect(window._an);
  window._buf = new Float32Array(window._an.fftSize);
  window._medir = async (ms) => {
    let pico = 0, suma = 0, n = 0;
    const t0 = performance.now();
    while (performance.now() - t0 < ms) {
      window._an.getFloatTimeDomainData(window._buf);
      for (let i = 0; i < window._buf.length; i++) {
        const a = Math.abs(window._buf[i]);
        if (a > pico) pico = a;
        suma += window._buf[i] * window._buf[i]; n++;
      }
      await new Promise(r => setTimeout(r, 12));
    }
    return { pico: +pico.toFixed(3), rms: +Math.sqrt(suma / Math.max(1, n)).toFixed(4) };
  };
  window._libre = () => { for (const k in sonVivos) sonVivos[k] = 0;
    for (const k in vocesGrupo) vocesGrupo[k] = 0;
    for (const k in sonUltimo) sonUltimo[k] = -1e9; voces = 0; };
});

const escena = (nombre, guion, ms) => p.evaluate(async ([g, m]) => {
  window._libre();
  await new Promise(r => setTimeout(r, 260));
  const pr = window._medir(m);
  // eslint-disable-next-line no-new-func
  new Function("sfx", "_libre", g)(sfx, window._libre);
  return await pr;
}, [guion, ms]).then(r => ({ nombre, ...r }));

const fallos = [];
const comprobar = (ok, t) => { console.log((ok ? "  ok   " : "  FALLO") + "  " + t); if (!ok) fallos.push(t); };

// Las escenas miden la mezcla de EFECTOS. Con la música sonando encima,
// "silencio" ya no es silencio y los picos no se pueden comparar con los
// de antes de que hubiera música, así que se apaga aquí y se enciende
// más abajo, donde toca medirla a propósito.
await p.evaluate(() => { if (typeof MUSICA !== "undefined") musica("silencio"); });
await p.waitForTimeout(1400);

console.log("\n— escenas, pico medido a la salida del compresor —");

// Pantalla llena: seis cañones, quince impactos y ocho explosiones a la vez.
const casos = [
  ["silencio",        "", 260],
  ["disparo suelto",  "sfx('cannon');", 400],
  ["disparo enemigo", "sfx('ene_pesado');", 400],
  ["explosión media", "sfx('exp_med');", 700],
  ["muerte de jefe",  "sfx('exp_boss');", 1500],
  ["combate cargado",
   `for(let i=0;i<8;i++){setTimeout(()=>{_libre();sfx('cannon');sfx('rapid');sfx('imp_ligero');
     sfx('imp_medio');sfx('ene_barrido');sfx('ene_disparo');},i*70);}
    for(let i=0;i<6;i++){setTimeout(()=>{_libre();sfx('exp_peq');sfx('exp_med');},i*110);}`, 1400],
  ["lo peor posible",
   `for(let i=0;i<14;i++){setTimeout(()=>{_libre();sfx('cannon');sfx('railgun');sfx('imp_pesado');
     sfx('ene_mortero');sfx('exp_grande');sfx('exp_med');sfx('exp_peq');},i*55);}
    setTimeout(()=>{_libre();sfx('exp_boss');},220);
    setTimeout(()=>{_libre();sfx('bomba');},480);`, 2200],
];

const res = [];
for (const [n, g, ms] of casos) res.push(await escena(n, g, ms));
for (const r of res) console.log(`  ${r.nombre.padEnd(18)} pico ${String(r.pico).padStart(6)}  rms ${r.rms}`);

const de = n => res.find(r => r.nombre === n);
console.log("");
comprobar(de("lo peor posible").pico < 0.99,
  `el peor caso no recorta: pico ${de("lo peor posible").pico}`);
comprobar(de("combate cargado").pico < 0.99,
  `combate cargado no recorta: pico ${de("combate cargado").pico}`);
comprobar(de("silencio").pico < 0.02, "el silencio es silencio");

// ── Con música encima ─────────────────────────────────────
//  La música es la única fuente CONTINUA del juego: no entra y sale
//  como un disparo, está siempre sumando. El sitio donde puede recortar
//  es el jefe —la pista más fuerte— con la pantalla llena encima.
console.log("\n— lo mismo, pero con la música del jefe sonando —");
await p.evaluate(() => { musica("jefe"); });
await p.waitForTimeout(2500);
const conMus = await escena("peor + música", casos[casos.length - 1][1], 2200);
const soloMus = await escena("solo música", "", 700);
console.log(`  ${"solo música".padEnd(18)} pico ${String(soloMus.pico).padStart(6)}  rms ${soloMus.rms}`);
console.log(`  ${"peor + música".padEnd(18)} pico ${String(conMus.pico).padStart(6)}  rms ${conMus.rms}`);
comprobar(conMus.pico < 0.99, `con música tampoco recorta: pico ${conMus.pico}`);
// Que la música NO tape los efectos: el peor caso tiene que seguir
// destacando claramente por encima de la música sola.
comprobar(conMus.rms > soloMus.rms * 1.5,
  `los efectos siguen mandando sobre la música (${conMus.rms} > ${soloMus.rms})`);
await p.evaluate(() => { musica("silencio"); });

console.log("\n— jerarquía de la mezcla —");
comprobar(de("muerte de jefe").rms > de("explosión media").rms,
  `el jefe manda sobre la explosión (${de("muerte de jefe").rms} > ${de("explosión media").rms})`);
comprobar(de("explosión media").rms > de("disparo suelto").rms,
  `la explosión manda sobre el disparo propio (${de("explosión media").rms} > ${de("disparo suelto").rms})`);
// Aquí se compara PICO y no rms a propósito. El disparo enemigo dura
// 195 ms y el propio 73: sobre una ventana fija, el largo acumula más
// energía aunque suene por debajo. Lo que decide cuál "está delante" en
// un sonido tan corto es el transitorio, y eso es el pico.
comprobar(de("disparo suelto").pico > de("disparo enemigo").pico * 1.2,
  `el disparo propio pega más que el enemigo (pico ${de("disparo suelto").pico} > ${de("disparo enemigo").pico})`);

console.log("\nerrores: " + (errs.length ? errs.join(" | ") : "ninguno"));
if (errs.length) fallos.push("errores en la página");
await nav.close(); await srv.cerrar();
console.log(fallos.length ? `\n${fallos.length} FALLOS` : "\nTODO OK");
process.exit(fallos.length ? 1 : 0);
