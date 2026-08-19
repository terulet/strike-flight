// ════════════════════════════════════════════════════════════
//  guardado.mjs — que el progreso no se pierda ni retroceda
// ════════════════════════════════════════════════════════════
//
//    node herramientas/pruebas/guardado.mjs
//
//  La prueba que da nombre a todo esto es la primera: rejugar la M1 con
//  ocho misiones desbloqueadas NO puede volver a bloquearlas. Era un bug
//  real y silencioso —el jugador solo lo descubría al volver al menú— y
//  la única forma de que no vuelva es que haya una prueba que lo mire.
//
//  Lo demás son las formas conocidas de perder una partida: un JSON a
//  medias, un save de una versión anterior, un navegador que no deja
//  escribir, y cerrar la pestaña antes de que dé tiempo a guardar.

import { servidor, cargarPlaywright } from "../qa.mjs";

const srv = await servidor();
const { chromium } = await cargarPlaywright();
const nav = await chromium.launch();

const fallos = [];
const comprobar = (ok, t, extra) => {
  console.log((ok ? "  ok    " : "  FALLO ") + t + (extra ? "   " + extra : ""));
  if (!ok) fallos.push(t);
};

// Cada caso arranca con un contexto NUEVO: localStorage limpio de
// verdad, no "borrado a mano", que es como se cuelan los falsos verdes.
async function abrir(preparar) {
  const ctx = await nav.newContext({ viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true });
  const p = await ctx.newPage();
  p.errs = [];
  p.on("pageerror", e => p.errs.push("EXCEPCION " + e.message));
  p.on("console", m => { if (m.type() === "error") p.errs.push("CONSOLE " + m.text()); });
  p.on("requestfailed", r => {
    // Un aborto de medios no es un fallo: cambiar de pista mientras la
    // anterior carga aborta esa descarga, y eso es lo correcto.
    const motivo = (r.failure() && r.failure().errorText) || "?";
    const url = r.url().replace(srv.url, "");
    if (motivo.includes("ERR_ABORTED") && /[.](mp3|ogg|wav)$/i.test(url)) return;
    p.errs.push("PETICION " + motivo + " " + url);
  });
  if (preparar) {
    // Hay que sembrar el localStorage ANTES de que corra el juego.
    await p.goto(srv.url + "/index.html", { waitUntil: "commit" });
    await p.evaluate(preparar);
    await p.reload({ waitUntil: "load" });
  } else {
    await p.goto(srv.url + "?debug", { waitUntil: "load" });
  }
  await p.waitForTimeout(900);
  p.cerrar = () => ctx.close();
  return p;
}

const est = (p) => p.evaluate(() => SAVE.estado());

// ════════════════════════════════════════════════════════════
console.log("\n1 · SIN SAVE PREVIO");
{
  const p = await abrir();
  const e = await est(p);
  const v = await p.evaluate(() => ({ misionMax, misionIdx, best, nave: NAVES[naveSel].id }));
  comprobar(e.ok && e.version === 2, "arranca con save v2 limpio", "v" + e.version);
  comprobar(v.misionMax === 0 && v.misionIdx === 0, "empieza en la M1");
  comprobar(v.best === 0, "sin récord");
  comprobar(v.nave === "chassis_01", "nave por defecto: el primer chasis", v.nave);
  comprobar(p.errs.length === 0, "sin errores", p.errs.slice(0, 2).join(" | "));
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\n2 · EL BUG: REJUGAR NO PUEDE RETROCEDER");
{
  const p = await abrir(() => {
    localStorage.setItem("sf_save", JSON.stringify({
      v: 2,
      campana: { misionMax: 7, misionIdx: 7, completada: false, stats: null, records: {}, temaId: "espacio" },
      perfil: { record: 50000, eloi: 0, partidas: 3, misionesCompletadas: 7, jefesDerrotados: 7, tiempoJugado: 900 },
      naves: { seleccionada: "yoli", desbloqueadas: [], skins: {}, colores: {} },
      opciones: {}, meta: { creado: 1, ultimoGuardado: 2 },
    }));
  });

  let v = await p.evaluate(() => ({ misionMax, misionIdx }));
  comprobar(v.misionMax === 7, "carga con 8 misiones desbloqueadas", "misionMax=" + v.misionMax);

  // Rejugar la M1 ENTERA: elegirla y terminarla.
  await p.evaluate(() => { modo = "campana"; misionIdx = 0; iniciarMision(0); });
  await p.waitForTimeout(400);
  v = await p.evaluate(() => ({ misionMax, misionIdx }));
  comprobar(v.misionMax === 7, "elegir la M1 no toca el máximo", "misionMax=" + v.misionMax);

  await p.evaluate(() => { score = 1000; cerrarMision(); });
  await p.waitForTimeout(400);
  v = await p.evaluate(() => ({ misionMax, misionIdx, guardado: SAVE.get("campana.misionMax") }));
  comprobar(v.misionMax === 7, "TERMINAR la M1 no baja el máximo en memoria", "misionMax=" + v.misionMax);
  comprobar(v.guardado === 7, "ni en el save", "guardado=" + v.guardado);

  // Y al recargar sigue estando.
  await p.reload({ waitUntil: "load" });
  await p.waitForTimeout(900);
  v = await p.evaluate(() => ({ misionMax, bloqueadas: MISIONES.map((_, i) => i > misionMax).filter(Boolean).length }));
  comprobar(v.misionMax === 7, "y sobrevive a recargar", "misionMax=" + v.misionMax);
  // 12 desde el bloque 5H: con misionMax=7 (8 desbloqueadas) y 20
  // misiones en la tabla, quedan 12 cerradas (antes eran 2, con solo 10).
  comprobar(v.bloqueadas === 12, "siguen bloqueadas las que tocan por encima del máximo", v.bloqueadas + " bloqueadas");
  comprobar(p.errs.length === 0, "sin errores", p.errs.slice(0, 2).join(" | "));
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\n3 · COMPLETAR SÍ DESBLOQUEA");
{
  const p = await abrir();
  await p.evaluate(() => { modo = "campana"; iniciarMision(0); score = 500; cerrarMision(); });
  await p.waitForTimeout(400);
  const v = await p.evaluate(() => ({ max: SAVE.get("campana.misionMax"), mem: misionMax }));
  comprobar(v.max === 1 && v.mem === 1, "terminar la M1 desbloquea la M2", "misionMax=" + v.max);
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\n4 · SAVE CORRUPTO");
{
  const p = await abrir(() => { localStorage.setItem("sf_save", "{esto no es json,,,"); });
  const e = await est(p);
  const v = await p.evaluate(() => ({ misionMax, best }));
  comprobar(e.version === 2, "arranca igualmente", "v" + e.version);
  comprobar(v.misionMax === 0 && v.best === 0, "cae a valores por defecto");
  comprobar(p.errs.length === 0, "y sin una sola excepción", p.errs.slice(0, 2).join(" | "));
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\n5 · SAVE CORRUPTO CON COPIA DE SEGURIDAD");
{
  const p = await abrir(() => {
    localStorage.setItem("sf_save_prev", JSON.stringify({
      v: 2,
      campana: { misionMax: 5, misionIdx: 5, completada: false, stats: null, records: { m2: 4321 }, temaId: "volcan" },
      perfil: { record: 31337, eloi: 12, partidas: 1, misionesCompletadas: 5, jefesDerrotados: 5, tiempoJugado: 60 },
      naves: { seleccionada: "silvia", desbloqueadas: [], skins: {}, colores: {} },
      opciones: {}, meta: { creado: 1, ultimoGuardado: 2 },
    }));
    localStorage.setItem("sf_save", '{"v":2,"campana":{"misionMax":5');   // escritura a medias
  });
  const v = await p.evaluate(() => ({ misionMax, best, rec: SAVE.recordMision(2), motivo: SAVE.estado().motivo }));
  comprobar(v.misionMax === 5, "rescata la partida de la copia", "misionMax=" + v.misionMax);
  comprobar(v.best === 31337, "con su récord", "best=" + v.best);
  comprobar(v.rec === 4321, "y sus récords por misión", "M3=" + v.rec);
  console.log("        (" + v.motivo + ")");
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\n6 · MIGRACIÓN DESDE LA v1");
{
  const p = await abrir(() => {
    localStorage.setItem("sf_save", JSON.stringify({
      v: 1, record: 12345, temaId: "neon", naveId: "silvia", misionIdx: 4,
      campaignCompleted: false,
      opciones: { volMaster: 0.6, volMusica: 0.2, volSfx: 0.8, silencio: false,
                  sacudida: 0.5, hitstop: 1, calidad: "media", nucleo: false },
    }));
  });
  const e = await est(p);
  const v = await p.evaluate(() => ({
    misionMax, misionIdx, best, nave: NAVES[naveSel].id, tema: T.id,
    vol: OPCIONES.volMaster, mus: OPCIONES.volMusica, cal: OPCIONES.calidad, nuc: OPCIONES.nucleo,
    vfx: OPCIONES.vfx,
  }));
  comprobar(e.version === 2 && e.migradoDe === 1, "migra v1 → v2", e.motivo);
  // Lo importante de la migración: en la v1, misionIdx era LAS DOS
  // COSAS. Si se perdiera el máximo, el jugador se quedaría sin las
  // misiones que ya tenía.
  comprobar(v.misionMax === 4, "el progreso de la v1 se conserva", "misionMax=" + v.misionMax);
  comprobar(v.best === 12345, "el récord se conserva", "best=" + v.best);
  // La nave de la v1 se conserva, resuelta a su chasis por el alias de
  // lectura de ships.js: "silvia" sigue siendo la misma nave.
  comprobar(v.nave === "chassis_03", "la nave de la v1 se conserva", v.nave);
  comprobar(v.tema === "neon", "el mundo se conserva", v.tema);
  comprobar(v.vol === 0.6 && v.mus === 0.2 && v.cal === "media" && v.nuc === false,
    "los ajustes se conservan", `master=${v.vol} mus=${v.mus} cal=${v.cal}`);
  comprobar(v.vfx === "auto", "y las opciones NUEVAS entran con su valor de fábrica", "vfx=" + v.vfx);
  comprobar(p.errs.length === 0, "sin errores", p.errs.slice(0, 2).join(" | "));
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\n7 · CLAVES SUELTAS DE LA PRIMERA ÉPOCA");
{
  const p = await abrir(() => {
    localStorage.setItem("sf_record", "7777");
    localStorage.setItem("sf_nave", "yoli");
    localStorage.setItem("sf_misionIdx", "3");
  });
  const v = await p.evaluate(() => ({ misionMax, best, nave: NAVES[naveSel].id }));
  comprobar(v.best === 7777 && v.misionMax === 3 && v.nave === "chassis_01",
    "un save prehistórico también se recupera", `best=${v.best} max=${v.misionMax} nave=${v.nave}`);
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\n8 · SAVE DE UNA VERSIÓN POSTERIOR");
{
  const p = await abrir(() => {
    localStorage.setItem("sf_save", JSON.stringify({
      v: 99, campana: { misionMax: 6 }, perfil: { record: 999 },
      naves: { seleccionada: "chassis_04" }, opciones: {},
    }));
  });
  const v = await p.evaluate(() => ({ misionMax, best, motivo: SAVE.estado().motivo }));
  comprobar(v.misionMax === 6 && v.best === 999,
    "no se borra: se lee lo que se entiende", `max=${v.misionMax} best=${v.best}`);
  console.log("        (" + v.motivo + ")");
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\n9 · LOS RÉCORDS SOLO SUBEN");
{
  const p = await abrir();
  const v = await p.evaluate(() => {
    SAVE.subirRecord(5000);
    const a = SAVE.get("perfil.record");
    SAVE.subirRecord(100);                       // peor: no debe bajar
    const b = SAVE.get("perfil.record");
    const nuevo = SAVE.subirRecord(9000);
    const c = SAVE.get("perfil.record");
    SAVE.subirRecordMision(2, 800);
    SAVE.subirRecordMision(2, 300);              // peor
    const m = SAVE.recordMision(2);
    SAVE.subirMision(5);
    SAVE.subirMision(2);                         // atrás
    return { a, b, c, nuevo, m, max: SAVE.get("campana.misionMax") };
  });
  comprobar(v.a === 5000 && v.b === 5000, "un récord peor no baja el global", "b=" + v.b);
  comprobar(v.c === 9000 && v.nuevo === true, "uno mejor sí sube y se avisa", "c=" + v.c);
  comprobar(v.m === 800, "el récord por misión tampoco baja", "M3=" + v.m);
  comprobar(v.max === 5, "y el máximo desbloqueado tampoco", "max=" + v.max);
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\n10 · LA NAVE Y LOS AJUSTES PERSISTEN");
{
  const p = await abrir();
  await p.evaluate(() => {
    naveSel = NAVES.findIndex(n => n.id === "chassis_04"); guardarNave();
    OPCIONES.volMusica = 0.4; OPCIONES.volSfx = 0.2; OPCIONES.volMaster = 0.6;
    OPCIONES.silencio = true; OPCIONES.calidad = "baja";
    guardarOpciones(); SAVE.ya();
  });
  await p.waitForTimeout(200);
  await p.reload({ waitUntil: "load" });
  await p.waitForTimeout(900);
  const v = await p.evaluate(() => ({
    nave: NAVES[naveSel].id, mus: OPCIONES.volMusica, sfx: OPCIONES.volSfx,
    master: OPCIONES.volMaster, mute: OPCIONES.silencio, cal: OPCIONES.calidad,
  }));
  comprobar(v.nave === "chassis_04", "la nave elegida persiste", v.nave);
  comprobar(v.mus === 0.4, "volumen de MÚSICA persiste", "mus=" + v.mus);
  comprobar(v.sfx === 0.2, "volumen de EFECTOS persiste", "sfx=" + v.sfx);
  comprobar(v.master === 0.6, "volumen GENERAL persiste", "master=" + v.master);
  comprobar(v.mute === true, "el SILENCIO persiste", "mute=" + v.mute);
  comprobar(v.cal === "baja", "la calidad persiste", v.cal);
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\n11 · GUARDAR AL IRSE (pagehide / visibilitychange)");
{
  const p = await abrir();
  // Se ensucia el save y se comprueba que el freno del autoguardado
  // AÚN no ha escrito: es justo la ventana en la que iOS puede matar la
  // pestaña sin avisar.
  // Base escrita: init() no escribe nada por sí solo —no hay nada que
  // guardar todavía— así que primero hay que crear el archivo.
  const antes = await p.evaluate(() => {
    SAVE.ya();
    const leer = () => JSON.parse(localStorage.getItem("sf_save") || "null");
    SAVE.set("perfil.eloi", 4242);
    return { pendiente: SAVE.estado().pendiente, escrito: leer().perfil.eloi };
  });
  comprobar(antes.pendiente === true && antes.escrito !== 4242,
    "el cambio queda pendiente, sin escribir todavía", "escrito=" + antes.escrito);

  const tras = await p.evaluate(() => {
    document.dispatchEvent(new Event("visibilitychange"));   // aún visible: no debe guardar
    const a = JSON.parse(localStorage.getItem("sf_save")).perfil.eloi;
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));   // ahora sí
    const b = JSON.parse(localStorage.getItem("sf_save")).perfil.eloi;
    return { a, b };
  });
  comprobar(tras.a !== 4242, "estando visible no fuerza el guardado", "eloi=" + tras.a);
  comprobar(tras.b === 4242, "al pasar a oculto guarda en el acto", "eloi=" + tras.b);

  const conPagehide = await p.evaluate(() => {
    SAVE.set("perfil.eloi", 5150);
    window.dispatchEvent(new Event("pagehide"));
    return JSON.parse(localStorage.getItem("sf_save")).perfil.eloi;
  });
  comprobar(conPagehide === 5150, "pagehide también guarda", "eloi=" + conPagehide);
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\n12 · BORRAR PROGRESO");
{
  const p = await abrir(() => {
    localStorage.setItem("sf_save", JSON.stringify({
      v: 2,
      campana: { misionMax: 9, misionIdx: 9, completada: true, stats: { score: 1 }, records: { m0: 999 }, temaId: "neon" },
      perfil: { record: 88888, eloi: 500, partidas: 20, misionesCompletadas: 10, jefesDerrotados: 10, tiempoJugado: 5000 },
      naves: { seleccionada: "chassis_04", desbloqueadas: [], skins: {}, colores: {} },
      opciones: { volMaster: 0.4, volMusica: 0.2, volSfx: 0.6, silencio: false,
                  sacudida: 0, hitstop: 0, calidad: "baja", nucleo: false, vfx: "auto" },
      meta: { creado: 1, ultimoGuardado: 2 },
    }));
  });

  // El save trae `misionMax:9` (correcto ANTES de 5H, cuando esa era la
  // última misión que existía) con `completada:true`. Desde 5H, la
  // misma red de seguridad de 5B que abre la M11 al terminar la base
  // (ver expansion-compat.mjs, sección D) corrige esto AL CARGAR: con
  // la base completada, `misionMax` sube a `MISIONES_BASE` (10) si
  // venía más bajo. 9 sería dejar la M11 cerrada con la base ya ganada.
  const antes = await p.evaluate(() => ({ max: misionMax, best }));
  comprobar(antes.max === 10 && antes.best === 88888,
    "parte de una campaña terminada, con la M11 ya abierta por la base");

  // Se abre el modal, y lo primero: que CANCELAR no borre nada.
  await p.evaluate(() => { pantalla = "ajustes"; confirmando = "progreso"; });
  await p.waitForTimeout(200);
  await p.evaluate(() => {
    const b = botones.find(x => x.fn && x.h === 40 && x.y > H / 2);
    if (b) b.fn();
  });
  await p.waitForTimeout(200);
  let v = await p.evaluate(() => ({ max: misionMax, best, abierto: !!confirmando }));
  comprobar(v.max === 10 && v.best === 88888 && !v.abierto, "CANCELAR no borra nada", "max=" + v.max);

  await p.evaluate(() => { confirmando = "progreso"; });
  await p.waitForTimeout(150);
  await p.evaluate(() => { SAVE.borrar(true); misionMax = 0; misionIdx = 0; best = 0; });
  await p.reload({ waitUntil: "load" });
  await p.waitForTimeout(900);
  v = await p.evaluate(() => ({
    max: misionMax, best, comp: campaignCompleted, rec: SAVE.recordMision(0),
    eloi: SAVE.get("perfil.eloi"), jefes: SAVE.get("perfil.jefesDerrotados"),
    master: OPCIONES.volMaster, mus: OPCIONES.volMusica, cal: OPCIONES.calidad,
  }));
  comprobar(v.max === 0 && v.best === 0 && !v.comp, "el progreso se borra de verdad", "max=" + v.max);
  comprobar(v.rec === 0 && v.eloi === 0 && v.jefes === 0, "también los récords y las estadísticas");
  // Lo que pidió el brief con estas palabras: no borrar los ajustes de
  // audio por accidente.
  comprobar(v.master === 0.4 && v.mus === 0.2 && v.cal === "baja",
    "pero los AJUSTES se respetan", `master=${v.master} mus=${v.mus} cal=${v.cal}`);
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\n13 · ESTADÍSTICAS");
{
  const p = await abrir();
  await p.evaluate(() => {
    modo = "campana"; iniciarMision(0);
    score = 2500; elapsed = 120; cerrarMision();
  });
  await p.waitForTimeout(300);
  const v = await p.evaluate(() => ({
    partidas: SAVE.get("perfil.partidas"),
    mis: SAVE.get("perfil.misionesCompletadas"),
    eloi: SAVE.get("perfil.eloi"),
    tiempo: SAVE.get("perfil.tiempoJugado"),
    recM: SAVE.recordMision(0),
    // El récord se guarda DESPUÉS de sumar el bonus de fin de misión,
    // que es lo que el jugador ve en pantalla y por tanto lo que tiene
    // que quedar apuntado.
    score, best,
  }));
  comprobar(v.partidas === 1, "cuenta la partida", "partidas=" + v.partidas);
  comprobar(v.mis === 1, "cuenta la misión completada", "misiones=" + v.mis);
  comprobar(v.eloi > 0, "acumula ELOI", "eloi=" + v.eloi);
  comprobar(v.tiempo === 120, "acumula tiempo jugado", "t=" + v.tiempo + "s");
  comprobar(v.recM === v.score && v.recM > 2500,
    "el récord de la misión incluye el bonus final", "M1=" + v.recM + " (2500 + bonus)");
  comprobar(v.best === v.score, "y el récord global también", "best=" + v.best);
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\n14 · SIN localStorage (modo privado)");
{
  const ctx = await nav.newContext({ viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true });
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", e => errs.push("EXCEPCION " + e.message));
  // Safari en privado deja LEER pero tira al escribir. Es el caso que
  // más gente ha visto y el que peor se comporta si no se contempla.
  await p.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem() { return null; },
        setItem() { throw new DOMException("QuotaExceededError", "QuotaExceededError"); },
        removeItem() {},
      },
    });
  });
  await p.goto(srv.url + "?debug", { waitUntil: "load" });
  await p.waitForTimeout(1200);
  const v = await p.evaluate(() => {
    const e = SAVE.estado();
    modo = "campana"; iniciarMision(0); score = 100; cerrarMision();
    return { disponible: e.disponible, ok: SAVE.estado().ok, jugando: state, err: SAVE.estado().error };
  });
  comprobar(v.jugando === "play", "el juego se juega igual", "state=" + v.jugando);
  comprobar(v.ok === false, "y avisa de que no puede guardar", v.err);
  comprobar(errs.length === 0, "sin excepciones", errs.slice(0, 2).join(" | "));
  await ctx.close();
}

// ════════════════════════════════════════════════════════════
console.log("\n15 · EXPORTAR / IMPORTAR");
{
  const p = await abrir();
  const v = await p.evaluate(() => {
    SAVE.subirMision(6); SAVE.subirRecord(4242);
    const copia = SAVE.exportar();
    SAVE.borrar(true);
    const tras = SAVE.get("campana.misionMax");
    const ok = SAVE.importar(copia);
    return { tras, ok, max: SAVE.get("campana.misionMax"), best: SAVE.get("perfil.record"),
             malo: SAVE.importar("no soy json") };
  });
  comprobar(v.tras === 0, "borrar deja el progreso a cero");
  comprobar(v.ok && v.max === 6 && v.best === 4242, "importar lo devuelve", "max=" + v.max);
  comprobar(v.malo === false, "e importar basura no rompe nada");
  await p.cerrar();
}

await nav.close();
srv.cerrar();
console.log("\n" + (fallos.length
  ? "FALLOS: " + fallos.length + "\n - " + fallos.join("\n - ")
  : "Todo correcto."));
process.exit(fallos.length ? 1 : 0);
