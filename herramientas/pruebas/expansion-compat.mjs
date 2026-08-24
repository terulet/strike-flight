// ════════════════════════════════════════════════════════════
//  expansion-compat.mjs — la campaña base sobrevive a la expansión
// ════════════════════════════════════════════════════════════
//
//    node herramientas/pruebas/expansion-compat.mjs
//
//  Esta prueba existe por una sola razón: el Bloque 5 puede estropearle
//  la partida a alguien que ya se pasó el juego, y eso no se puede
//  deshacer.
//
//  Los dos fallos concretos que vigila, y que NO dan error de consola:
//
//    · Quien terminó la M10 se quedó con `misionMax = 9`, porque el
//      avance está topado en la última misión que hay. El día que
//      existan veinte, ese 9 significa "la M11 está cerrada" y no hay
//      forma de abrirla salvo rejugar la M10. La expansión quedaría
//      bajo llave con la llave dentro.
//
//    · Traducir "terminó su campaña" por `MISIONES.length` convierte a
//      quien jugó diez misiones en alguien que jugó veinte, y le regala
//      todo lo que la expansión pida por progreso. Contenido regalado
//      no se puede retirar.
//
//  Y vigila lo demás que no se puede perder: récord, ELOI, NOVA, los
//  chasis, la personalización y el trofeo de OMEGA.
//
//  Las diez situaciones son las A–J del encargo del bloque.

import { servidor, cargarPlaywright } from "../qa.mjs";

const srv = await servidor();
const { chromium } = await cargarPlaywright();
const nav = await chromium.launch();

const fallos = [];
const comprobar = (ok, t, extra) => {
  console.log((ok ? "  ok    " : "  FALLO ") + t + (extra ? "   " + extra : ""));
  if (!ok) fallos.push(t);
};

// Saves reales, con la forma que tienen HOY en disco. Ninguno lleva los
// campos nuevos: son saves de antes del bloque, que es de lo que se
// trata.
const SAVE_BASE = (o) => ({
  v: 2,
  campana: {
    misionMax: o.misionMax, misionIdx: o.misionIdx ?? 0,
    completada: o.completada ?? false,
    stats: o.stats ?? null,
    records: o.records ?? { m0: 12000, m1: 9000 },
    temaId: "volcan",
  },
  perfil: { record: 45678, eloi: 1234, partidas: 27, misionesCompletadas: o.misionMax + 1,
            jefesDerrotados: 3, tiempoJugado: 7200 },
  naves: { seleccionada: o.nave ?? "chassis_02",
           desbloqueadas: o.desbloqueadas ?? ["chassis_01", "chassis_02"],
           config: { chassis_02: { skinId: "neon", customName: "MI NAVE" } } },
  opciones: { volMusica: 0.42 },
  meta: { creado: 1000, ultimoGuardado: 2000 },
});

const TROFEO_OMEGA = { score: 812340, best: 812340, enemiesKilled: 1120,
  maxCombo: 87, precision: 71, tiempo: 341.2, nave: "AX-4 WARHAWK" };

async function abrir(save) {
  const ctx = await nav.newContext({ viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true });
  const p = await ctx.newPage();
  p.errs = [];
  p.on("pageerror", e => p.errs.push("EXCEPCION " + e.message));
  p.on("console", m => { if (m.type() === "error") p.errs.push("CONSOLE " + m.text()); });
  p.on("requestfailed", r => {
    const motivo = (r.failure() && r.failure().errorText) || "?";
    const url = r.url().replace(srv.url, "");
    if (motivo.includes("ERR_ABORTED") && /[.](mp3|ogg|wav)$/i.test(url)) return;
    p.errs.push("PETICION " + motivo + " " + url);
  });
  await p.goto(srv.url + "/index.html", { waitUntil: "commit" });
  if (save) await p.evaluate((x) => localStorage.setItem("sf_save", JSON.stringify(x)), save);
  await p.reload({ waitUntil: "load" });
  await p.waitForTimeout(900);
  p.cerrar = () => ctx.close();
  return p;
}

// La foto que se compara en todas las situaciones.
const foto = (p) => p.evaluate(() => ({
  base: MISIONES_BASE,
  total: MISIONES.length,
  misionMax: SAVE.get("campana.misionMax", 0),
  misionMaxJuego: misionMax,
  completada: SAVE.get("campana.completada", false),
  completadaBase: SAVE.get("campana.completadaBase", false),
  completadaExp: SAVE.get("campana.completadaExp", false),
  stats: SAVE.get("campana.stats", null),
  statsExp: SAVE.get("campana.statsExp", null),
  completadas: misionesCompletadas(),
  record: SAVE.get("perfil.record", 0),
  eloi: SAVE.get("perfil.eloi", 0),
  records: SAVE.get("campana.records", {}),
  equipada: NAVES[naveSel] && NAVES[naveSel].id,
  cfg: SHIPS.config("chassis_02"),
  libres: NAVES.filter(n => !n.bloqueada).map(n => n.id).join(","),
  bloqueadas: NAVES.filter(n => n.bloqueada).map(n => n.id).join(","),
  nova: !NAVES.find(n => n.id === "chassis_05").bloqueada,
  trofeo: campaignCompleted,
}));

// ════════════════════════════════════════════════════════════
console.log("\nA · SAVE NUEVO, SIN TERMINAR LA M10");
{
  const p = await abrir(null);
  const r = await foto(p);
  comprobar(r.base === 10, "MISIONES_BASE es 10 y es una constante", r.base + "");
  // 20 desde el bloque 5H: las 10 de siempre + las 10 de la expansión.
  comprobar(r.total === 20, "la tabla tiene sus 20 (10 de siempre + 10 de la expansión)", r.total + "");
  comprobar(r.misionMax === 0 && !r.completada && !r.completadaBase,
    "un save nuevo no recibe nada", "misionMax " + r.misionMax);
  comprobar(r.completadas === 0, "y cuenta 0 misiones completadas", r.completadas + "");
  comprobar(r.libres === "chassis_01", "con un solo chasis abierto", r.libres);
  comprobar(p.errs.length === 0, "sin errores", p.errs[0] || "");
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\nB · SAVE ANTIGUO A MEDIAS, EN LA M5");
{
  const p = await abrir(SAVE_BASE({ misionMax: 4, misionIdx: 4 }));
  const r = await foto(p);
  comprobar(r.misionMax === 4, "el progreso NO se toca", "misionMax " + r.misionMax);
  comprobar(!r.completadaBase && !r.completada, "no se le marca nada como terminado");
  comprobar(r.completadas === 4, "cuenta 4 misiones completadas", r.completadas + "");
  comprobar(r.libres === "chassis_01,chassis_02", "y solo los chasis que le tocan", r.libres);
  comprobar(!r.nova, "NOVA sigue bloqueada");
  comprobar(r.record === 45678 && r.eloi === 1234, "récord y ELOI intactos");
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\nC · SAVE ANTIGUO EN LA M9, A UNA DE TERMINAR");
{
  const p = await abrir(SAVE_BASE({ misionMax: 8, misionIdx: 8 }));
  const r = await foto(p);
  comprobar(r.misionMax === 8, "el progreso NO se toca", "misionMax " + r.misionMax);
  comprobar(!r.completadaBase, "no se le regala el final");
  comprobar(r.completadas === 8, "cuenta 8", r.completadas + "");
  comprobar(!r.nova, "y NOVA sigue bloqueada: la pide entera", r.bloqueadas);
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\nD · SAVE ANTIGUO CON LA M10 COMPLETADA  ★");
{
  // El caso que da nombre a la prueba. Un save de antes del bloque:
  // `completada: true`, `misionMax: 9` y ni rastro de los campos nuevos.
  const p = await abrir(SAVE_BASE({
    misionMax: 9, misionIdx: 9, completada: true, stats: TROFEO_OMEGA,
    desbloqueadas: ["chassis_01", "chassis_02", "chassis_03", "chassis_04", "chassis_05"],
    records: { m0: 12000, m9: 812340 },
  }));
  const r = await foto(p);

  comprobar(r.completadaBase === true,
    "se le rellena completadaBase desde el campo viejo");
  comprobar(r.completada === true,
    "y el campo histórico se conserva: es su trofeo");
  comprobar(r.misionMax === 10,
    "★ misionMax sube a MISIONES_BASE: la M11 le queda abierta",
    "misionMax " + r.misionMax);
  // Antes de 5H esto se acotaba a 9 (`Math.min(10, MISIONES.length-1)`
  // con solo 10 misiones en la tabla): el save quería abrir la M11 pero
  // el juego, sin M11 todavía, la recortaba en pantalla para no enseñar
  // un hueco. Desde 5H la M11 existe de verdad, así que ya no hay nada
  // que recortar: el valor en pantalla es el mismo que el del save.
  comprobar(r.misionMaxJuego === 10,
    "★ y ahora el juego lo enseña tal cual: la M11 está abierta de verdad",
    "en pantalla M" + (r.misionMaxJuego + 1));
  comprobar(r.completadas === 10,
    "★ cuenta 10 misiones completadas, NO 20", r.completadas + "");
  comprobar(JSON.stringify(r.stats) === JSON.stringify(TROFEO_OMEGA),
    "el trofeo de OMEGA queda intacto, campo a campo");
  comprobar(r.completadaExp === false && r.statsExp === null,
    "y no se le marca la expansión");
  comprobar(r.trofeo === true, "la pantalla de CAMPAÑA COMPLETADA le sigue saliendo");
  comprobar(r.record === 45678, "récord intacto", r.record + "");
  comprobar(r.eloi === 1234, "ELOI intacto", r.eloi + "");
  comprobar(r.records.m9 === 812340, "sus récords por misión intactos", r.records.m9 + "");
  comprobar(r.equipada === "chassis_02", "su nave puesta", r.equipada);
  comprobar(r.cfg.customName === "MI NAVE" && r.cfg.skinId === "neon",
    "y su personalización", r.cfg.customName);
  comprobar(r.bloqueadas === "", "los cinco chasis abiertos", r.bloqueadas || "ninguno bloqueado");
  comprobar(p.errs.length === 0, "sin errores", p.errs[0] || "");
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\nE · NOVA SE GANA CON LA CAMPAÑA BASE, NO CON LA EXPANSIÓN");
{
  const p = await abrir(SAVE_BASE({ misionMax: 9, misionIdx: 9, completada: true,
    stats: TROFEO_OMEGA, desbloqueadas: [] }));
  const r = await p.evaluate(() => ({
    requiere: SHIPS.porId("chassis_05").requiere,
    base: MISIONES_BASE,
    nova: !NAVES.find(n => n.id === "chassis_05").bloqueada,
    lista: SAVE.get("naves.desbloqueadas", []).join(","),
  }));
  comprobar(r.requiere === r.base,
    "NOVA pide exactamente la campaña base, ni una misión más",
    "requiere " + r.requiere + " · base " + r.base);
  comprobar(r.nova === true,
    "★ quien terminó la M10 la tiene, aunque su lista viniera vacía");
  comprobar(r.lista.split(",").length === 5,
    "y se le conceden los cinco, ni uno más", r.lista);
  await p.cerrar();
}

{
  // Y el reverso: alguien a una misión del final NO la tiene.
  const p = await abrir(SAVE_BASE({ misionMax: 9, misionIdx: 9, completada: false }));
  const r = await p.evaluate(() => ({
    nova: !NAVES.find(n => n.id === "chassis_05").bloqueada,
    completadas: misionesCompletadas(),
  }));
  comprobar(!r.nova, "con la M10 abierta pero sin ganar, NOVA sigue cerrada",
    "completadas " + r.completadas);
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\nF · SAVE DE ADMIN");
{
  const p = await abrir(SAVE_BASE({ misionMax: 3, misionIdx: 2 }));
  const r = await p.evaluate(async () => {
    const normalAntes = localStorage.getItem("sf_save");
    ADMIN.entrar(ADMIN.PIN_FABRICA, "eloi");
    await new Promise(r => requestAnimationFrame(r));
    const dentro = {
      clave: SAVE.clave(),
      misionMax,
      cerradas: MISIONES.filter((m, i) => !ADMIN.misionAbierta(i, 0)).length,
      bloqueadas: NAVES.filter(n => n.bloqueada).length,
      naves: NAVES.length,
      completadas: misionesCompletadas(),
    };
    ADMIN.salir();
    await new Promise(r => requestAnimationFrame(r));
    return { dentro, intacto: localStorage.getItem("sf_save") === normalAntes,
             fuera: { misionMax, completadas: misionesCompletadas(), clave: SAVE.clave() } };
  });
  comprobar(r.dentro.clave === "sf_admin_eloi", "entra a su espacio", r.dentro.clave);
  // 19 desde el bloque 5H: `MISIONES.length - 1` con las 20 misiones ya
  // en la tabla (antes era 9, con solo 10).
  comprobar(r.dentro.misionMax === 19, "con la campaña entera abierta (10 + 10 de la expansión)",
    "misionMax " + r.dentro.misionMax);
  comprobar(r.dentro.cerradas === 0, "ninguna misión cerrada", r.dentro.cerradas + "");
  comprobar(r.dentro.bloqueadas === 0 && r.dentro.naves === 9,
    "y las nueve naves abiertas, founder incluida", r.dentro.naves + " naves");
  comprobar(r.intacto, "★ el save normal no cambia ni un carácter");
  comprobar(r.fuera.clave === "sf_save" && r.fuera.misionMax === 3,
    "y al salir vuelve donde estaba", "M" + (r.fuera.misionMax + 1));
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\nG · COMPLETAR LA M10 DESPUÉS DEL CAMBIO");
{
  const p = await abrir(SAVE_BASE({ misionMax: 8, misionIdx: 9 }));
  const r = await p.evaluate(async () => {
    misionIdx = MISIONES_BASE - 1;
    iniciarMision(misionIdx);
    // Se cierra la misión y se deja correr la cuenta atrás de la
    // pantalla de resultados, que es donde se decide el final.
    cerrarMision();
    misionCompletaT = 0.02;
    // La pantalla final entra con transición, así que hay que dejarla
    // llegar: con doce fotogramas se mide el barrido, no el resultado.
    await new Promise(r => setTimeout(r, 1200));
    return {
      completada: SAVE.get("campana.completada", false),
      completadaBase: SAVE.get("campana.completadaBase", false),
      completadaExp: SAVE.get("campana.completadaExp", false),
      stats: SAVE.get("campana.stats", null),
      statsExp: SAVE.get("campana.statsExp", null),
      misionMax: SAVE.get("campana.misionMax", 0),
      pantalla, completadas: misionesCompletadas(),
      nova: !NAVES.find(n => n.id === "chassis_05").bloqueada,
    };
  });
  comprobar(r.completada && r.completadaBase,
    "termina la campaña BASE y se marcan los dos campos");
  comprobar(!r.completadaExp && r.statsExp === null,
    "★ y NO se marca la expansión");
  comprobar(r.stats && r.stats.score > 0, "el trofeo se escribe en campana.stats",
    r.stats ? "score " + r.stats.score : "nada");
  comprobar(r.pantalla === "campana-completa", "sale la pantalla final", r.pantalla);
  comprobar(r.misionMax === 10, "y misionMax queda en MISIONES_BASE",
    "misionMax " + r.misionMax);
  comprobar(r.completadas === 10, "cuenta 10", r.completadas + "");
  comprobar(r.nova, "NOVA se desbloquea al terminarla");
  comprobar(p.errs.length === 0, "sin errores", p.errs[0] || "");
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\nH · SUPERVIVENCIA SIGUE TENIENDO SUS CUATRO MUNDOS");
{
  const p = await abrir(SAVE_BASE({ misionMax: 9, completada: true, stats: TROFEO_OMEGA }));
  const r = await p.evaluate(async () => {
    state = "menu"; pantalla = "mundos";
    for (let i = 0; i < 3; i++) await new Promise(r => requestAnimationFrame(r));
    return {
      lista: SURVIVAL_MUNDOS.join(","),
      resueltos: TEMAS_SUPERVIVENCIA().map(t => t.id).join(","),
      temas: TEMAS.length,
      // Los botones de la pantalla: uno por mundo, más la flecha de volver.
      botones: botones.length,
    };
  });
  comprobar(r.lista === "espacio,oceano,volcan,neon",
    "la lista es explícita y son cuatro", r.lista);
  comprobar(r.resueltos === r.lista, "y los cuatro existen en TEMAS", r.resueltos);
  // TEMAS pasó a 9 en el bloque 5D (cinco mundos de expansión, marcados
  // `soloCampana`). Lo que importa aquí no es CUÁNTOS hay en TEMAS, sino
  // que SURVIVAL_MUNDOS siga siendo cuatro — y eso ya lo comprueban las
  // dos líneas de arriba.
  comprobar(r.temas === 9, "TEMAS trae los 9 mundos (4 base + 5 de expansión)", r.temas + "");
  comprobar(r.botones === 5, "la pantalla dibuja 4 mundos + volver", r.botones + " botones");
  await p.cerrar();
}

{
  // Y la prueba de verdad: se añade un mundo de campaña EN CALIENTE y
  // supervivencia no se entera. Es lo que impide que esto vuelva a
  // pasar sin que nadie lo decida.
  const p = await abrir(null);
  const r = await p.evaluate(async () => {
    state = "menu"; pantalla = "mundos";
    for (let i = 0; i < 3; i++) await new Promise(r => requestAnimationFrame(r));
    const antes = botones.length;
    TEMAS.push({ id: "hielo_prueba", nombre: "PRUEBA", icono: "*",
      fondoA: "#000", fondoB: "#111", bg: "estrellas", bgColor: "#fff",
      nave: "#fff", naveAla: "#fff", cabina: "#fff", motor: "#fff",
      bala: "#fff", enemigoA: "#f00", enemigoB: "#0f0", enemigoC: "#00f" });
    for (let i = 0; i < 3; i++) await new Promise(r => requestAnimationFrame(r));
    const despues = botones.length;
    const enLista = SURVIVAL_MUNDOS.indexOf("hielo_prueba") >= 0;
    TEMAS.pop();
    return { antes, despues, enLista, temas: TEMAS.length };
  });
  comprobar(r.antes === r.despues,
    "★ añadir un mundo de campaña NO añade uno a supervivencia",
    r.antes + " → " + r.despues + " botones");
  comprobar(!r.enLista, "porque supervivencia va por su lista, no por TEMAS");
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\nI · OMEGA SIGUE SIENDO EL FINAL DE LA CAMPAÑA BASE");
{
  const p = await abrir(SAVE_BASE({ misionMax: 9, misionIdx: 9, completada: true,
    stats: TROFEO_OMEGA }));
  const r = await p.evaluate(async () => {
    state = "menu"; pantalla = "campana-completa";
    for (let i = 0; i < 3; i++) await new Promise(r => requestAnimationFrame(r));
    return {
      jefeBase: jefeDeMision(MISIONES_BASE - 1),
      // El nombre sale del guión, no de una tabla paralela.
      ultimoEvento: (() => {
        const evs = MISIONES[MISIONES_BASE - 1].eventos;
        let id = null;
        for (const e of evs) if (e.fn === "miniboss") id = e.tipo;
        return id;
      })(),
      epico: !!JEFES.omega_sovereign.epico,
      trofeo: campaignCompleted,
      statsPantalla: campaignStats && campaignStats.score,
    };
  });
  comprobar(r.ultimoEvento === "omega_sovereign",
    "la M10 sigue terminando en OMEGA", r.ultimoEvento);
  comprobar(r.jefeBase === "OMEGA SOVEREIGN",
    "y el texto del final lo saca de ahí, no de una constante", r.jefeBase);
  comprobar(r.epico, "OMEGA conserva su muerte de jefe final");
  comprobar(r.trofeo && r.statsPantalla === TROFEO_OMEGA.score,
    "y la pantalla enseña SUS estadísticas", r.statsPantalla + "");
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\nJ · LA EXPANSIÓN, AHORA QUE EXISTE (bloque 5H), NO SE MARCA ANTES DE TIEMPO");
{
  // Esta sección nació en 5B como "hoy no hay expansión en la tabla, así
  // que nada puede marcarla" — un cerrojo válido mientras MISIONES tenía
  // diez entradas nada más. Desde 5H la expansión existe DE VERDAD, así
  // que la comprobación que queda vigente es la de al lado: completar
  // solo la campaña BASE (M1-M10) no puede marcar `completadaExp`, que
  // es justo lo que distingue los dos trofeos.
  const p = await abrir(SAVE_BASE({ misionMax: 9, misionIdx: 9, completada: true,
    stats: TROFEO_OMEGA }));
  const r = await p.evaluate(async () => {
    // Cierra M1..M10 (nunca M11+) con el mismo salto directo que ya usa
    // `campana-final.mjs`, y comprueba que NINGUNA de esas diez marca
    // la expansión — solo M20 puede hacerlo, y eso lo prueba a fondo
    // `mision-11-20.mjs`.
    const marcas = [];
    for (let i = 0; i < MISIONES_BASE; i++) {
      misionIdx = i;
      iniciarMision(i);
      cerrarMision();
      misionCompletaT = 0.02;
      for (let k = 0; k < 8; k++) await new Promise(r => requestAnimationFrame(r));
      marcas.push(SAVE.get("campana.completadaExp", false));
      state = "menu";
    }
    return {
      alguna: marcas.some(Boolean),
      completadaExp: SAVE.get("campana.completadaExp", false),
      statsExp: SAVE.get("campana.statsExp", null),
      completadas: misionesCompletadas(),
      hayExpansion: MISIONES.length > MISIONES_BASE,
    };
  });
  comprobar(r.hayExpansion, "★ ahora SÍ hay expansión en la tabla (bloque 5H)");
  comprobar(!r.alguna && !r.completadaExp,
    "★ completar solo M1-M10 (nunca M11-M20) no marca la expansión como completada");
  comprobar(r.statsExp === null, "ni escribe su trofeo (`campana.statsExp`)");
  comprobar(r.completadas === 10, "y se sigue contando 10 misiones completadas", r.completadas + "");
  comprobar(p.errs.length === 0, "sin errores", p.errs[0] || "");
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\nK · LAS TABLAS EXTRAÍDAS SON LAS MISMAS");
{
  // 5A movió MISIONES, JEFES y ENEMIGOS a sus archivos. Mover una tabla
  // y cambiarla a la vez es la forma más rápida de no saber cuál de las
  // dos cosas rompió el juego, así que aquí se cuenta lo que había.
  const p = await abrir(null);
  const r = await p.evaluate(() => ({
    misiones: MISIONES.length,
    temas: TEMAS.length,
    jefes: Object.keys(JEFES).length,
    enemigos: Object.keys(ENEMIGOS).length,
    eventos: MISIONES.reduce((a, m) => a + m.eventos.length, 0),
    // Y que el motor sigue enganchado a ellas.
    caer: typeof caer === "function",
    formas: typeof FORMAS === "object",
    spritesBaseYaCargados: Object.keys(ENEMIGOS)
      .filter(k => !ENEMIGOS[k].interno && !ENEMIGOS[k].mundo)
      .filter(k => !!SPRITES["e_" + k]).length,
  }));
  // 20 desde el bloque 5H: las 10 de siempre + las 10 de la expansión.
  comprobar(r.misiones === 20, "20 misiones (10 + 10 de la expansión)", r.misiones + "");
  // 9 desde el bloque 5D: los 4 de siempre más los 5 de expansión.
  comprobar(r.temas === 9, "9 mundos", r.temas + "");
  // 20 desde el bloque 5G: los 10 de siempre + 5 minijefes (5F) + 5
  // jefes principales de la expansión (5G).
  comprobar(r.jefes === 20, "20 jefes y minijefes (10 + 5 de 5F + 5 de 5G)", r.jefes + "");
  // 25 desde el bloque 5E: los 14 base más los 10 de expansión más el
  // fragmento interno de crisol (que no tiene PNG a propósito — ver
  // `enemigos.mjs` — así que cuenta en ENEMIGOS pero no en los sprites).
  comprobar(r.enemigos === 25, "25 enemigos (14 base + 10 expansión + 1 interno)", r.enemigos + "");
  // 359 de M1-M10 + 328 de M11-M20 (bloque 5H) = 687. Subió de 681 a 687
  // en el bloque 6D: seis `descansoOn` -uno en M6/OMEGA y cinco en la
  // expansión- que le dicen al Rhythm Director que NO rellene los
  // silencios deliberados antes de cada aviso de jefe (ver AUDITORIA-BLOQUE6.md).
  comprobar(r.eventos === 687, "687 eventos de guión en total (359 + 328 de la expansión)", r.eventos + "");
  comprobar(r.caer, "`caer` viajó con la tabla que lo usa al construirse");
  // Desde la corrección de la regresión de premios: los 14 sprites base
  // siguen cargando al vuelo (como siempre), pero los 10 de expansión
  // ahora se piden BAJO DEMANDA al spawnear (asegurarSpriteEnemigo) para
  // no competir con los power-ups por ancho de banda — eso se comprueba
  // a fondo en premios.mjs, aquí solo se confirma que el arranque no
  // cambió para los 14 de siempre.
  comprobar(r.spritesBaseYaCargados === 14, "y los 14 sprites base siguen cargando de entrada",
    r.spritesBaseYaCargados + "/14");
  comprobar(p.errs.length === 0, "sin errores ni 404", p.errs[0] || "");
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
await nav.close();
await srv.cerrar();
if (fallos.length) {
  console.log("\nFALLOS: " + fallos.length);
  for (const f of fallos) console.log(" - " + f);
  process.exit(1);
}
console.log("\nTodo correcto.");
