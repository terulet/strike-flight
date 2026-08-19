// ════════════════════════════════════════════════════════════
//  musica.mjs — que la música suene, cambie y no tape nada
// ════════════════════════════════════════════════════════════
//
//    node herramientas/pruebas/musica.mjs
//
//  Lo que se comprueba aquí es lo que el brief pide con nombre propio:
//  que respete el silencio, que tenga volumen propio, que cruce en vez
//  de cortar, que se aparte cuando explota el jefe, que vuelva después
//  de segundo plano y que el jefe cambie de tema de forma perceptible.
//
//  Se mide DESPUÉS del techo de seguridad, o sea en lo que sale por el
//  altavoz, igual que audio-mezcla.mjs. Comprobar el gain de un nodo
//  solo demuestra que se puso un número; lo que importa es si suena.

import { servidor, cargarPlaywright } from "../qa.mjs";

const srv = await servidor();
const { chromium } = await cargarPlaywright();
const nav = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
const ctx = await nav.newContext({ viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true });
const p = await ctx.newPage();

const errs = [];
p.on("pageerror", e => errs.push("EXCEPCION " + e.message));
p.on("console", m => { if (m.type() === "error") errs.push("CONSOLE " + m.text()); });
p.on("requestfailed", r => {
  // Un aborto de medios no es un fallo: cambiar de pista mientras la
  // anterior carga aborta esa descarga, y eso es lo correcto.
  const motivo = (r.failure() && r.failure().errorText) || "?";
  const url = r.url().replace(srv.url, "");
  if (motivo.includes("ERR_ABORTED") && /[.](mp3|ogg|wav)$/i.test(url)) return;
  errs.push("PETICION " + motivo + " " + url);
});

await p.goto(srv.url + "?debug", { waitUntil: "load" });
await p.mouse.click(410, 900);
await p.waitForTimeout(400);

const fallos = [];
const comprobar = (ok, t, extra) => {
  console.log((ok ? "  ok    " : "  FALLO ") + t + (extra ? "   " + extra : ""));
  if (!ok) fallos.push(t);
};

// Analizador en la salida real, y otro colgado SOLO del bus de música:
// con los dos se puede saber si lo que se oye es la música o los
// efectos, que es justo lo que hace falta para medir el agachado.
await p.evaluate(() => {
  const crear = (nodo) => {
    const an = audio.createAnalyser();
    an.fftSize = 2048;
    nodo.connect(an);
    return an;
  };
  window._anMus = crear(BUS.musica);      // solo música, antes del master
  window._anOut = crear(BUS.techo);       // lo que sale por el altavoz
  window._buf = new Float32Array(2048);
  window._leer = (an) => {
    an.getFloatTimeDomainData(window._buf);
    let s = 0;
    for (let i = 0; i < window._buf.length; i++) s += window._buf[i] * window._buf[i];
    return Math.sqrt(s / window._buf.length);
  };
  window._nivel = async (ms, salida) => {
    const an = salida ? window._anOut : window._anMus;
    let pico = 0, suma = 0, n = 0;
    const t0 = performance.now();
    while (performance.now() - t0 < ms) {
      an.getFloatTimeDomainData(window._buf);
      for (let i = 0; i < window._buf.length; i++) {
        const a = Math.abs(window._buf[i]);
        if (a > pico) pico = a;
        suma += window._buf[i] * window._buf[i]; n++;
      }
      await new Promise(r => setTimeout(r, 12));
    }
    return { pico: +pico.toFixed(4), rms: +Math.sqrt(suma / Math.max(1, n)).toFixed(5) };
  };
});

const dbg = () => p.evaluate(() => MUSICA.debug());
const nivel = (ms) => p.evaluate((m) => window._nivel(m, false), ms);
// El SILENCIO no vacía el bus de música: apaga el MASTER, que está
// después. Medirlo en BUS.musica daría un falso fallo, así que este se
// mide en la salida de verdad.
const nivelSalida = (ms) => p.evaluate((m) => window._nivel(m, true), ms);

console.log("\nARRANQUE");
await p.waitForTimeout(2500);
let d = await dbg();
comprobar(d.modo === "webaudio", "modo webaudio con servidor", "modo=" + d.modo);
comprobar(d.listo, "desbloqueada tras el primer toque");
comprobar(d.pista === "menu", "el menú pide su pista al arrancar", "pista=" + d.pista);
comprobar(d.sonando, "está sonando de verdad");
let n = await nivel(600);
comprobar(n.rms > 0.005, "sale señal por el bus de música", "rms=" + n.rms);

console.log("\nSILENCIO");
await p.evaluate(() => { OPCIONES.silencio = true; aplicarVolumenes(); });
await p.waitForTimeout(350);
const rmsMudo = (await nivelSalida(500)).rms;
await p.evaluate(() => { OPCIONES.silencio = false; aplicarVolumenes(); });
await p.waitForTimeout(350);
const rmsVuelve = (await nivelSalida(500)).rms;
comprobar(rmsMudo < 0.0005, "con SILENCIO no sale nada por el altavoz", "rms=" + rmsMudo);
comprobar(rmsVuelve > 0.005, "al quitarlo vuelve", "rms=" + rmsVuelve);

console.log("\nVOLUMEN PROPIO DE MÚSICA");
const conMusica = (await nivel(500)).rms;
await p.evaluate(() => { OPCIONES.volMusica = 0.2; aplicarVolumenes(); });
await p.waitForTimeout(300);
const bajo = (await nivel(500)).rms;
await p.evaluate(() => { OPCIONES.volMusica = 0.6; aplicarVolumenes(); });
await p.waitForTimeout(300);
comprobar(bajo < conMusica * 0.6, "volMusica baja la música y solo la música",
  conMusica.toFixed(5) + " → " + bajo.toFixed(5));

console.log("\nCRUCE MENÚ → COMBATE");
// Que NO haya un hueco de silencio en mitad del cambio es lo que
// significa "no cortar de forma fea". Se muestrea durante el cruce y se
// mira el mínimo, no la media.
const durante = await p.evaluate(async () => {
  const lee = () => {
    window._anMus.getFloatTimeDomainData(window._buf);
    let s = 0;
    for (let i = 0; i < window._buf.length; i++) s += window._buf[i] * window._buf[i];
    return Math.sqrt(s / window._buf.length);
  };
  misionIdx = 0; modo = "campana";
  musica("combate");
  const m = [];
  for (let i = 0; i < 90; i++) { m.push(lee()); await new Promise(r => setTimeout(r, 20)); }
  return m;
});
const minCruce = Math.min(...durante.slice(5, 85));
comprobar(minCruce > 0.002, "el cruce no deja un hueco de silencio", "mín rms=" + minCruce.toFixed(5));
d = await dbg();
comprobar(d.pista === "combate_a", "M1 usa combate_a", "pista=" + d.pista);

console.log("\nDOS PISTAS DE COMBATE");
await p.evaluate(() => { misionIdx = 1; musica("combate"); });
await p.waitForTimeout(1600);
d = await dbg();
comprobar(d.pista === "combate_b", "M2 usa combate_b", "pista=" + d.pista);

console.log("\nJEFE");
await p.evaluate(() => musica("jefe"));
await p.waitForTimeout(1500);
d = await dbg();
comprobar(d.pista === "jefe", "el jefe cambia de pista", "pista=" + d.pista);
comprobar(d.vol > 1, "el jefe suena por encima del combate", "vol=" + d.vol);
await p.evaluate(() => musica("jefe_final"));
await p.waitForTimeout(1400);
d = await dbg();
comprobar(d.pista === "jefe_final", "OMEGA SOVEREIGN tiene pista propia", "pista=" + d.pista);

console.log("\nINTENSIDAD DE FASE FINAL");
await p.evaluate(() => MUSICA.intensidad(0, 0.1));
await p.waitForTimeout(400);
const i0 = await p.evaluate(() => MUSICA.debug().inten);
await p.evaluate(() => MUSICA.intensidad(1, 0.1));
await p.waitForTimeout(400);
const i1 = await p.evaluate(() => MUSICA.debug().inten);
comprobar(i0 === 0 && i1 === 1, "la intensidad sube y baja", i0 + " → " + i1);

console.log("\nAGACHADO POR EXPLOSIÓN DE JEFE");
const duckMin = await p.evaluate(async () => {
  let min = 1;
  agachar(1, 0.5);
  for (let i = 0; i < 30; i++) {
    min = Math.min(min, MUSICA.debug().duck);
    await new Promise(r => setTimeout(r, 20));
  }
  return min;
});
await p.waitForTimeout(1200);
const duckVuelve = await p.evaluate(() => MUSICA.debug().duck);
comprobar(duckMin < 0.8, "la explosión aparta la música", "mín=" + duckMin.toFixed(2));
comprobar(duckMin >= 0.3, "pero NO la apaga del todo", "mín=" + duckMin.toFixed(2));
comprobar(duckVuelve > 0.95, "y vuelve sola", "duck=" + duckVuelve.toFixed(2));

console.log("\nSTINGERS");
for (const s of ["mision", "victoria", "derrota", "unlock"]) {
  const r = await p.evaluate(async (id) => {
    MUSICA.stinger(id);
    await new Promise(r => setTimeout(r, 300));
    return MUSICA.debug();
  }, s);
  comprobar(r.ultimo === "stinger:" + s && r.duck < 1, "corte " + s + " suena y aparta el bucle",
    "duck=" + r.duck.toFixed(2));
}
await p.waitForTimeout(4200);
comprobar((await dbg()).duck > 0.95, "el bucle vuelve tras el corte");

console.log("\nDERROTA — la música se va");
await p.evaluate(() => { musica("menu"); });
await p.waitForTimeout(1500);
await p.evaluate(() => musica("derrota"));
await p.waitForTimeout(5000);
n = await nivel(600);
comprobar(n.rms < 0.002, "tras la derrota queda silencio", "rms=" + n.rms);

console.log("\nVUELTA DE SEGUNDO PLANO");
await p.evaluate(() => musica("menu"));
await p.waitForTimeout(1600);
const antes = await dbg();
// Es lo que hace iOS al cambiar de app: para el elemento por su cuenta.
const paradas = await p.evaluate(() => {
  const els = [...document.querySelectorAll("audio[data-musica]")];
  els.forEach(a => a.pause());
  return els.length;
});
await p.waitForTimeout(300);
const pausada = await dbg();
comprobar(paradas === 3, "las tres voces están en el documento", "encontradas=" + paradas);
comprobar(!pausada.sonando, "el sistema se entera de que la han parado");
await p.evaluate(() => reanudarAudio());
await p.waitForTimeout(900);
const despues = await dbg();
comprobar(despues.sonando, "reanuda tras volver");
comprobar(despues.t >= antes.t - 0.5, "y sigue donde estaba, no desde cero",
  antes.t.toFixed(1) + "s → " + despues.t.toFixed(1) + "s");

console.log("\nBUCLE SIN COSTURA");
// Se salta a 3 s del final y se mira que no aparezca un hueco al dar la
// vuelta. Es el sitio exacto donde un <audio loop> de Safari hace clac.
const bucle = await p.evaluate(async () => {
  const el = [...document.querySelectorAll("audio[data-musica]")].find(a => !a.paused);
  if (!el) return null;
  el.currentTime = Math.max(0, MUSICA.debug().dur - 3);
  const m = [];
  for (let i = 0; i < 200; i++) { m.push(window._leer(window._anMus)); await new Promise(r => setTimeout(r, 20)); }
  return { min: Math.min(...m), medio: m.reduce((a, b) => a + b, 0) / m.length };
});
comprobar(!!bucle, "se encuentra la voz que está sonando para probar el bucle");
if (bucle) {
  comprobar(bucle.min > bucle.medio * 0.15, "el bucle da la vuelta sin hueco",
    "mín=" + bucle.min.toFixed(5) + " medio=" + bucle.medio.toFixed(5));
  const tras = await dbg();
  comprobar(tras.sonando && tras.t < 20, "y sigue sonando después de dar la vuelta",
    "t=" + tras.t.toFixed(1) + "s");
}

// ── Integración de verdad ─────────────────────────────────
//  Hasta aquí se ha llamado a musica() a mano. Lo que importa es que
//  los enganches del JUEGO la disparen solos: que aparecer un jefe
//  cambie el tema sin que nadie lo pida, y que matarlo lo devuelva.
console.log("\nENGANCHES DEL JUEGO");
await p.evaluate(() => { modo = "campana"; iniciarMision(0); musica("combate"); });
await p.waitForTimeout(1800);
comprobar((await dbg()).pista === "combate_a", "empezar la misión pone el combate");

await p.evaluate(() => spawnMiniboss("guardian", 1));
await p.waitForTimeout(1800);
d = await dbg();
comprobar(d.pista === "jefe", "spawnMiniboss cambia el tema solo", "pista=" + d.pista);
comprobar(d.inten < 1, "y entra sentada atrás", "inten=" + d.inten);

await p.evaluate(() => cambiarFase(miniboss, JEFES.guardian.fases.length - 1));
await p.waitForTimeout(1300);
comprobar((await dbg()).inten === 1, "la última fase la sube del todo");

await p.evaluate(() => matarMiniboss());
await p.waitForTimeout(6500);
d = await dbg();
comprobar(d.pista === "combate_a", "matar al jefe devuelve el combate", "pista=" + d.pista);
comprobar(d.inten === 1, "y la música vuelve a sonar entera");

// Morir se lleva la música. Volver a empezar tiene que devolverla —
// había cuatro formas de empezar una misión y solo una ponía música,
// así que reintentar tras morir dejaba la partida muda.
await p.evaluate(() => { miniboss = null; musica("derrota"); });
await p.waitForTimeout(1500);
comprobar((await dbg()).pista === "—", "la derrota deja la música en silencio");
await p.evaluate(() => { modo = "campana"; iniciarMision(2); });
await p.waitForTimeout(1800);
d = await dbg();
comprobar(d.pista === "combate_a" && d.sonando,
  "reintentar tras morir devuelve la música", "pista=" + d.pista);

// El décimo jefe es el único con pista propia.
await p.evaluate(() => { miniboss = null; spawnMiniboss("omega_sovereign", 1); });
await p.waitForTimeout(1800);
comprobar((await dbg()).pista === "jefe_final", "OMEGA SOVEREIGN dispara SU pista, no la de los otros nueve");
await p.evaluate(() => { miniboss = null; state = "menu"; musica("menu"); });
await p.waitForTimeout(600);

console.log("\nCONSOLA");
comprobar(errs.length === 0, "sin errores ni 404", errs.slice(0, 3).join(" | "));

// ── Doble clic ────────────────────────────────────────────
//  La restricción que decide la arquitectura del audio entero: el juego
//  tiene que abrirse sin servidor. Aquí la música NO puede pasar por
//  WebAudio —Chrome deja mudo un medio de origen file: enrutado por el
//  grafo— así que lo que se comprueba es que caiga sola a la ruta de
//  repuesto, que suene igualmente, y sobre todo que NO reviente nada.
console.log("\nDOBLE CLIC (file://)");
const { pathToFileURL } = await import("node:url");
const { resolve: res2, dirname: dir2, join: join2 } = await import("node:path");
const { fileURLToPath: f2u } = await import("node:url");
const RAIZ = res2(dir2(f2u(import.meta.url)), "..", "..");
const ctxF = await nav.newContext({ viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true });
const pf = await ctxF.newPage();
const errsF = [];
pf.on("pageerror", e => errsF.push("EXCEPCION " + e.message));
pf.on("console", m => { if (m.type() === "error") errsF.push("CONSOLE " + m.text()); });
await pf.goto(pathToFileURL(join2(RAIZ, "index.html")).href, { waitUntil: "load" });
await pf.mouse.click(410, 900);
await pf.waitForTimeout(3000);
const df = await pf.evaluate(() => MUSICA.debug());
comprobar(df.modo === "elemento", "con file:// cae a la ruta de repuesto", "modo=" + df.modo);
comprobar(df.pista === "menu", "y aun así pide su pista", "pista=" + df.pista);
comprobar(errsF.length === 0, "sin excepciones con doble clic", errsF.slice(0, 2).join(" | "));
const sonandoF = await pf.evaluate(() => {
  const el = document.querySelector('audio[data-musica="a"]');
  return { paused: el.paused, t: +el.currentTime.toFixed(2), vol: +el.volume.toFixed(2), err: el.error ? el.error.code : 0 };
});
console.log("        (elemento: t=" + sonandoF.t + "s vol=" + sonandoF.vol +
  " paused=" + sonandoF.paused + " error=" + sonandoF.err + ")");
comprobar(!sonandoF.err, "el navegador puede leer el mp3 desde disco");

await nav.close();
srv.cerrar();
console.log("\n" + (fallos.length ? "FALLOS: " + fallos.length + "\n - " + fallos.join("\n - ")
  : "Todo correcto."));
process.exit(fallos.length ? 1 : 0);
