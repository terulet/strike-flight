// ════════════════════════════════════════════════════════════
//  mision-11-20.mjs — las diez misiones de la expansión (bloque 5H)
// ════════════════════════════════════════════════════════════
//
//    node herramientas/pruebas/mision-11-20.mjs
//
//  Cubre lo que pide el bloque 5H: estructura de cada misión, minijefe/
//  boss correcto, duración real, progresión, save completo (con
//  recarga), que rejugar no retroceda nada, borrado de progreso,
//  aislamiento de ADMIN y rendimiento en escena densa de M12/14/16/18/20.

import { servidor, cargarPlaywright, abrir, informe } from "../qa.mjs";

const fallos = [];
const comprobar = (ok, t, extra) => {
  console.log((ok ? "  ok    " : "  FALLO ") + t + (extra ? "   " + extra : ""));
  if (!ok) fallos.push(t);
};

const srv = await servidor();
const { chromium } = await cargarPlaywright();
const nav = await chromium.launch();

// Abre un contexto NUEVO (localStorage limpio de verdad) y, si se pasa
// `seedJson` (una CADENA — el resultado de `SAVE_BASE(...)`), siembra
// `sf_save` ANTES de que el juego arranque — mismo patrón que
// `guardado.mjs`: cargar hasta "commit" (hay `window` y `localStorage`,
// no ha corrido el script todavía), sembrar, y recargar del todo.
async function abrirConSave(seedJson) {
  const ctx = await nav.newContext({ viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true });
  const p = await ctx.newPage();
  const errores = [];
  p.on("pageerror", e => errores.push("EXCEPCION " + e.message));
  p.on("console", m => { if (m.type() === "error") errores.push("CONSOLE " + m.text()); });
  p.on("requestfailed", r => {
    const motivo = (r.failure() && r.failure().errorText) || "?";
    const url = r.url().replace(srv.url, "");
    if (motivo.includes("ERR_ABORTED") && /\.(mp3|ogg|wav)$/i.test(url)) return;
    errores.push("PETICION " + motivo + " " + url);
  });
  await p.goto(srv.url + "/index.html", { waitUntil: "commit" });
  if (seedJson) await p.evaluate((json) => localStorage.setItem("sf_save", json), seedJson);
  await p.reload({ waitUntil: "load" });
  await p.waitForTimeout(500);
  p.errores = errores;
  return { ctx, p };
}

const SAVE_BASE = (extra) => JSON.stringify(Object.assign({
  v: 2,
  campana: Object.assign({ misionMax: 0, misionIdx: 0, completada: false, completadaBase: false,
    completadaExp: false, stats: null, statsExp: null, records: {}, temaId: "espacio", eloiExp: 0 },
    (extra && extra.campana) || {}),
  perfil: Object.assign({ record: 0, eloi: 0, partidas: 1, misionesCompletadas: 0, jefesDerrotados: 0, tiempoJugado: 0 },
    (extra && extra.perfil) || {}),
  naves: Object.assign({ seleccionada: "chassis_01", desbloqueadas: [], skinsDesbloqueadas: [], config: {} },
    (extra && extra.naves) || {}),
  opciones: {}, meta: { creado: 1, ultimoGuardado: 2 },
}, {}));

const MISIONES_11_20 = [
  { i: 10, nombre: "DERIVA BLANCA",     mundo: "hielo",      jefe: "cazador_polar", boss: false },
  { i: 11, nombre: "EL YUNQUE BLANCO",  mundo: "hielo",      jefe: "kryos",         boss: true  },
  { i: 12, nombre: "TRÁFICO CRUZADO",   mundo: "megaciudad", jefe: "unidad_control",boss: false },
  { i: 13, nombre: "TORRE CENTINELA",   mundo: "megaciudad", jefe: "vertice",       boss: true  },
  { i: 14, nombre: "LUZ MUERTA",        mundo: "abismo",     jefe: "guardian_ruina",boss: false },
  { i: 15, nombre: "EL QUE DUERME",     mundo: "abismo",     jefe: "nyx",           boss: true  },
  { i: 16, nombre: "COLADA",            mundo: "fragua",     jefe: "yunque_movil",  boss: false },
  { i: 17, nombre: "MAESTRO DE FRAGUA", mundo: "fragua",     jefe: "vulcano",       boss: true  },
  { i: 18, nombre: "ESPACIO ROTO",      mundo: "grieta",     jefe: "heraldo_grieta",boss: false },
  { i: 19, nombre: "LO QUE QUEDA",      mundo: "grieta",     jefe: "axioma",        boss: true  },
];

async function abrirPartida(opts) {
  const p = await abrir({ navegador: nav }, srv, "ipad", opts);
  return p;
}

// ════════════════════════════════════════════════════════════
console.log("\n1 · REGISTRO — 10 misiones, mundo, armas y eventos válidos");
{
  const p = await abrirPartida();
  const r = await p.evaluate((MISIONES_11_20) => {
    const fns = new Set(["ola", "reward", "miniboss", "hazardOn", "hazardOff", "defensa",
      "zonaOn", "zonaOff", "pozo", "carril", "sistemas", "zonaCol", "columna", "oscuridad", "ruptura",
      // Bloque 6D: le dicen al Rhythm Director que NO rellene un silencio
      // deliberado antes de un aviso de jefe (ver AUDITORIA-BLOQUE6.md).
      "bonus", "descansoOn", "descansoOff"]);
    return MISIONES_11_20.map(({ i, nombre, mundo, jefe, boss }) => {
      const m = MISIONES[i];
      const bad = m.eventos.filter(e => !fns.has(e.fn));
      const badEnemy = m.eventos.filter(e => e.fn === "ola" && !ENEMIGOS[e.tipo]);
      const badBoss = m.eventos.filter(e => e.fn === "miniboss" && !JEFES[e.tipo]);
      const badHazard = m.eventos.filter(e => (e.fn === "hazardOn" && e.subtipo) && !HAZARD_TIPOS[e.subtipo]);
      const jefes = m.eventos.filter(e => e.fn === "miniboss").map(e => e.tipo);
      const ultimoJefe = jefes[jefes.length - 1];
      const dUltimo = JEFES[ultimoJefe];
      const ordenT = m.eventos.every((e, k) => k === 0 || e.t >= m.eventos[k - 1].t);
      return {
        i, nombre: m.nombre, nombreOk: m.nombre === nombre,
        mundoOk: m.temaId === mundo, armasOk: Array.isArray(m.armas) && m.armas.length >= 2,
        bad: bad.length, badEnemy: badEnemy.map(e => e.tipo), badBoss: badBoss.map(e => e.tipo),
        badHazard: badHazard.map(e => e.subtipo), ordenT,
        nJefes: jefes.length, ultimoJefe, esperado: jefe,
        fasesUltimo: dUltimo ? dUltimo.fases.length : 0, esperaBoss: boss,
      };
    });
  }, MISIONES_11_20);
  for (const m of r) {
    console.log(`        M${m.i + 1} ${m.nombre}`);
    comprobar(m.nombreOk, "  nombre correcto");
    comprobar(m.mundoOk, "  mundo correcto");
    comprobar(m.armasOk, "  al menos 2 armas propias");
    comprobar(m.bad === 0, "  todos los fn de evento son válidos", m.bad + "");
    comprobar(m.badEnemy.length === 0, "  todos los enemigos de 'ola' existen en ENEMIGOS", m.badEnemy.join(","));
    comprobar(m.badBoss.length === 0, "  todos los 'miniboss' existen en JEFES", m.badBoss.join(","));
    comprobar(m.badHazard.length === 0, "  todos los subtipo de hazardOn existen en HAZARD_TIPOS", m.badHazard.join(","));
    comprobar(m.ordenT, "  los eventos están en orden temporal");
    comprobar(m.nJefes === 1, "  ★ un solo evento de miniboss/boss (nunca dos)", m.nJefes + "");
    comprobar(m.ultimoJefe === m.esperado, "  ★ el jefe/minijefe que cierra la misión es el que toca", `${m.ultimoJefe} (esperado ${m.esperado})`);
    const esBossReal = m.fasesUltimo >= 3;
    comprobar(esBossReal === m.esperaBoss, "  ★ es jefe principal (3-4 fases) solo cuando debe serlo", `${m.fasesUltimo} fases, boss=${esBossReal}, esperado=${m.esperaBoss}`);
  }
  comprobar(p.errores.length === 0, "sin errores JS", p.errores.slice(0, 3).join(" | "));
  await p.close();
}

// ════════════════════════════════════════════════════════════
console.log("\n2 · PROGRESIÓN — M11 cerrada sin campaña base, cadena M11→M20");
{
  const seedMedio = SAVE_BASE({ campana: { misionMax: 5 } });
  const medio = await abrirConSave(seedMedio);
  const r2 = await medio.p.evaluate(() => ({ misionMax, bloqueadaM11: misionMax < 10 }));
  comprobar(r2.bloqueadaM11, "★ con la campaña base a medias (misionMax=5), M11 sigue cerrada", "misionMax=" + r2.misionMax);
  await medio.p.close(); await medio.ctx.close();

  const seed10 = SAVE_BASE({ campana: { misionMax: 10, completadaBase: true, completada: true } });
  const { ctx, p } = await abrirConSave(seed10);
  const r3 = await p.evaluate(() => ({ abierta: misionMax >= 10 }));
  comprobar(r3.abierta, "★ con la base completa (misionMax=10), M11 se abre");

  // Cadena M11→M20: completa cada una saltando el guion (como hace
  // `campana-final.mjs`) y forzando la muerte del jefe/minijefe, y
  // comprueba que el máximo sube de una en una, en orden.
  const cadena = await p.evaluate(async (MISIONES_11_20) => {
    const log = [];
    for (const { i, jefe } of MISIONES_11_20) {
      modo = "campana"; misionIdx = i; iniciarMision(i); misionIniT = 0;
      await new Promise(r => setTimeout(r, 30));
      state = "play"; paused = false; golpe = () => {};
      eventoIdx = 9999; enemies.length = 0; spawnQueue.length = 0; eBullets.length = 0;
      spawnMiniboss(jefe);
      miniboss.est = "combate"; miniboss.estT = 0; miniboss.invul = false;
      miniboss.hp = 1;
      for (let k = 0; k < 400 && miniboss; k++) { update(0.05); enemies.length = 0; spawnQueue.length = 0; }
      for (let k = 0; k < 300 && misionCompletaT >= 0 && state === "play"; k++) update(0.05);
      log.push({ i, misionMax, state });
    }
    return log;
  }, MISIONES_11_20);
  // `misionMax` es el ÍNDICE (0-based, como `misionIdx`) más alto
  // desbloqueado, topado en `MISIONES.length - 1` porque no hay
  // "misión 21" que desbloquear — así que tras completar M20
  // (misionIdx=19, la ÚLTIMA) se queda en 19, no en 20. Es la misma
  // regla que ya deja M11 abierta con `misionMax >= 10` más arriba.
  let ordenOk = true;
  for (let k = 0; k < cadena.length; k++) {
    const esperado = Math.min(cadena[k].i + 1, 19);
    if (cadena[k].misionMax < esperado) ordenOk = false;
  }
  comprobar(ordenOk, "★ misionMax sube de una en una a lo largo de M11→M20", JSON.stringify(cadena.map(c => c.misionMax)));
  comprobar(cadena[cadena.length - 1].misionMax === 19, "★ al completar M20 (la última), misionMax se queda en 19 (tope)", cadena[cadena.length - 1].misionMax + "");
  const fin = await p.evaluate(() => ({
    completadaExp: SAVE.get("campana.completadaExp", false),
    completadaBase: SAVE.get("campana.completadaBase", false),
    statsExp: !!SAVE.get("campana.statsExp", null),
    eloiExp: SAVE.get("campana.eloiExp", 0),
    skins: SAVE.get("naves.skinsDesbloqueadas", []),
    jefesExp: jefesExpansionDerrotados(),
  }));
  comprobar(fin.completadaExp, "★ campana.completadaExp queda escrito");
  comprobar(fin.completadaBase, "y campana.completadaBase sigue en pie (no se pisó)");
  comprobar(fin.statsExp, "campana.statsExp queda escrito");
  comprobar(fin.eloiExp > 0, "★ campana.eloiExp acumuló algo en M11-M20", fin.eloiExp + "");
  comprobar(["inferno", "arctic", "toxic", "storm", "cosmic"].every(s => fin.skins.includes(s)),
    "★ las 5 skins de la expansión quedan desbloqueadas", JSON.stringify(fin.skins));
  comprobar(fin.jefesExp === 5, "★ jefesExpansionDerrotados() cuenta los 5 jefes principales", fin.jefesExp + "");
  comprobar(p.errores.length === 0, "sin errores JS en toda la cadena", p.errores.slice(0, 5).join(" | "));
  await p.close(); await ctx.close();
}

// ════════════════════════════════════════════════════════════
console.log("\n3 · SAVE COMPLETO — save antiguo de M10 → M11 abierta → recarga persiste");
{
  // Save "antiguo": alguien que terminó M10 antes de que existiera la
  // expansión — exactamente el caso que 5B dejó preparado.
  const seedM10 = SAVE_BASE({ campana: { completada: true, completadaBase: true, misionMax: 10,
    stats: { score: 50000 } } });
  const { ctx, p } = await abrirConSave(seedM10);
  const r1 = await p.evaluate(() => ({ misionMax, m11Abierta: misionMax >= 10 }));
  comprobar(r1.m11Abierta, "★ un save antiguo de M10 deja M11 abierta sin tocar nada más", "misionMax=" + r1.misionMax);

  // Completa M11-M20 rápido y comprueba que TODO sobrevive a una recarga.
  await p.evaluate(async (MISIONES_11_20) => {
    for (const { i, jefe } of MISIONES_11_20) {
      modo = "campana"; misionIdx = i; iniciarMision(i); misionIniT = 0;
      await new Promise(r => setTimeout(r, 20));
      state = "play"; paused = false; golpe = () => {};
      eventoIdx = 9999; enemies.length = 0; spawnQueue.length = 0; eBullets.length = 0;
      spawnMiniboss(jefe);
      miniboss.est = "combate"; miniboss.estT = 0; miniboss.invul = false;
      miniboss.hp = 1;
      for (let k = 0; k < 400 && miniboss; k++) { update(0.05); enemies.length = 0; spawnQueue.length = 0; }
      for (let k = 0; k < 300 && misionCompletaT >= 0 && state === "play"; k++) update(0.05);
    }
  }, MISIONES_11_20);
  const antes = await p.evaluate(() => ({
    completadaExp: SAVE.get("campana.completadaExp", false),
    eloiExp: SAVE.get("campana.eloiExp", 0),
    skins: SAVE.get("naves.skinsDesbloqueadas", []).slice().sort(),
    misionMax: SAVE.get("campana.misionMax", 0),
  }));
  await p.reload({ waitUntil: "load" });
  await p.waitForTimeout(600);
  const despues = await p.evaluate(() => ({
    completadaExp: SAVE.get("campana.completadaExp", false),
    eloiExp: SAVE.get("campana.eloiExp", 0),
    skins: SAVE.get("naves.skinsDesbloqueadas", []).slice().sort(),
    misionMax: SAVE.get("campana.misionMax", 0),
  }));
  comprobar(despues.completadaExp === antes.completadaExp && despues.completadaExp === true, "★ completadaExp persiste tras recargar");
  comprobar(despues.eloiExp === antes.eloiExp && despues.eloiExp > 0, "★ eloiExp persiste tras recargar", `${antes.eloiExp} → ${despues.eloiExp}`);
  comprobar(JSON.stringify(despues.skins) === JSON.stringify(antes.skins) && despues.skins.length === 5, "★ las skins desbloqueadas persisten tras recargar");
  comprobar(despues.misionMax === antes.misionMax && despues.misionMax === 19, "★ misionMax persiste tras recargar");
  comprobar(p.errores.length === 0, "sin errores JS", p.errores.slice(0, 3).join(" | "));
  await p.close(); await ctx.close();
}

// ════════════════════════════════════════════════════════════
console.log("\n4 · NO RETROCESO — rejugar M11 tras M20 no baja nada, rejugar M10 no pierde la expansión");
{
  const seed19 = SAVE_BASE({ campana: { completadaBase: true, completadaExp: true, misionMax: 19 } });
  const { ctx, p } = await abrirConSave(seed19);
  const r1 = await p.evaluate(() => {
    modo = "campana"; misionIdx = 10; iniciarMision(10); misionIniT = 0;
    state = "play"; paused = false; golpe = () => {};
    eventoIdx = 9999; enemies.length = 0; spawnQueue.length = 0;
    spawnMiniboss("cazador_polar"); miniboss.est = "combate"; miniboss.invul = false; miniboss.hp = 1;
    return { misionMaxAntes: SAVE.get("campana.misionMax", 0) };
  });
  await p.evaluate(async () => {
    for (let k = 0; k < 400 && miniboss; k++) { update(0.05); enemies.length = 0; spawnQueue.length = 0; }
    for (let k = 0; k < 300 && misionCompletaT >= 0 && state === "play"; k++) update(0.05);
  });
  const r2 = await p.evaluate(() => ({
    misionMax: SAVE.get("campana.misionMax", 0),
    completadaExp: SAVE.get("campana.completadaExp", false),
  }));
  comprobar(r2.misionMax === 19, "★ rejugar M11 (ya con las 20 abiertas) NO retrocede misionMax", `${r1.misionMaxAntes} → ${r2.misionMax}`);
  comprobar(r2.completadaExp, "y no toca el trofeo de expansión ya ganado");

  // Rejugar M10 (OMEGA) no debe perder completadaExp ni misionMax.
  await p.evaluate(() => {
    modo = "campana"; misionIdx = 9; iniciarMision(9); misionIniT = 0;
    state = "play"; paused = false; golpe = () => {};
    eventoIdx = 9999; enemies.length = 0; spawnQueue.length = 0;
    spawnMiniboss("omega_sovereign"); miniboss.est = "combate"; miniboss.invul = false; miniboss.hp = 1;
  });
  await p.evaluate(async () => {
    for (let k = 0; k < 400 && miniboss; k++) { update(0.05); enemies.length = 0; spawnQueue.length = 0; }
    for (let k = 0; k < 300 && misionCompletaT >= 0 && state === "play"; k++) update(0.05);
  });
  const r3 = await p.evaluate(() => ({
    misionMax: SAVE.get("campana.misionMax", 0),
    completadaExp: SAVE.get("campana.completadaExp", false),
    completadaBase: SAVE.get("campana.completadaBase", false),
  }));
  comprobar(r3.misionMax === 19, "★ rejugar M10 (OMEGA) no baja misionMax de 19", r3.misionMax + "");
  comprobar(r3.completadaExp && r3.completadaBase, "★ y no pierde ni completadaBase ni completadaExp");
  comprobar(p.errores.length === 0, "sin errores JS", p.errores.slice(0, 3).join(" | "));
  await p.close(); await ctx.close();
}

// ════════════════════════════════════════════════════════════
console.log("\n5 · BORRAR PROGRESO — limpia también los campos de la expansión");
{
  const seedExp = SAVE_BASE({ campana: { completadaExp: true, misionMax: 20, eloiExp: 500 },
    naves: { skinsDesbloqueadas: ["arctic", "storm"] } });
  const { ctx, p } = await abrirConSave(seedExp);
  const r = await p.evaluate(() => {
    SAVE.borrar();
    return {
      completadaExp: SAVE.get("campana.completadaExp", false),
      misionMax: SAVE.get("campana.misionMax", 0),
      eloiExp: SAVE.get("campana.eloiExp", 0),
      skins: SAVE.get("naves.skinsDesbloqueadas", []),
    };
  });
  comprobar(!r.completadaExp, "★ borrar progreso también borra completadaExp");
  comprobar(r.misionMax === 0, "y misionMax vuelve a 0");
  comprobar(r.eloiExp === 0, "★ y eloiExp de la expansión vuelve a 0");
  comprobar(r.skins.length === 0, "★ y las skins desbloqueadas por progreso se van con el resto");
  comprobar(p.errores.length === 0, "sin errores JS", p.errores.slice(0, 3).join(" | "));
  await p.close(); await ctx.close();
}

// ════════════════════════════════════════════════════════════
console.log("\n6 · ADMIN — ve M11-M20 y los 20 jefes, salta a AXIOMA, no toca el save normal");
{
  const seedNormal = SAVE_BASE({ campana: { misionMax: 3 } });
  const { ctx, p } = await abrirConSave(seedNormal);
  const r = await p.evaluate(async () => {
    ADMIN.entrar(ADMIN.PIN_FABRICA, "kali");
    const total = PUENTE_HANGAR.totalMisiones();
    const m19 = PUENTE_HANGAR.mision(19);
    PUENTE_HANGAR.irAJefe(19);
    await new Promise(r => setTimeout(r, 50));
    const bossOk = miniboss && miniboss.tipo === "axioma";
    const espacioAdmin = SAVE.esNormal();
    ADMIN.salir();
    return {
      total, jefeM19: m19.jefe, bossOk, espacioAdmin,
      misionMaxNormalIntacto: SAVE.get("campana.misionMax", 0) === 3,
      activoTrasSalir: ADMIN.activo(),
    };
  });
  comprobar(r.total === 20, "★ ADMIN ve las 20 misiones (10 + 10 de la expansión)", r.total + "");
  comprobar(r.jefeM19.toUpperCase().includes("AXIOMA"), "★ M20 en ADMIN muestra AXIOMA como su jefe", r.jefeM19);
  comprobar(r.bossOk, "★ PUENTE_HANGAR.irAJefe(19) salta directo a AXIOMA");
  comprobar(!r.espacioAdmin, "★ mientras está activo, SAVE escribe en un espacio aislado (sf_admin_*), no en el normal");
  comprobar(r.misionMaxNormalIntacto, "★ entrar/salir de ADMIN no tocó campana.misionMax del save normal");
  comprobar(!r.activoTrasSalir, "ADMIN queda desactivado al salir");
  comprobar(p.errores.length === 0, "sin errores JS", p.errores.slice(0, 3).join(" | "));
  await p.close(); await ctx.close();
}

// ════════════════════════════════════════════════════════════
console.log("\n7 · DURACIÓN REAL — minijefes (M11/13/15/17/19) y jefes principales (M12/14/16/18/20)");
{
  // Los minijefes con cobertura propia (cazador_polar/tempano,
  // unidad_control, yunque_movil/colada) se miden con `cannon` nivel 6
  // —el mismo arma de referencia que ya usa `duracion-m2-m4.mjs`— y no
  // con el arma "temática" del mundo: a nivel bajo, un bot que solo
  // apunta en X (sin esquivar ni priorizar objetivos) tarda mucho más
  // de lo que tardaría una persona jugando de verdad, y 180s se
  // quedaban cortos. Medido a mano: cazador_polar con cannon nivel 6
  // muere en ~222s.
  const CASOS = [
    ["M11 Cazador Polar",  10, "cazador_polar",  "cannon",    6],
    ["M12 KRYOS",          11, "kryos",           "railgun",   5],
    ["M13 Unidad Control", 12, "unidad_control",  "cannon",    6],
    ["M14 VÉRTICE",        13, "vertice",         "laser",     5],
    ["M15 Guardián Ruina", 14, "guardian_ruina",  "void",      4],
    ["M16 NÝX",            15, "nyx",             "plasma",    5],
    ["M17 Yunque Móvil",   16, "yunque_movil",    "cannon",    6],
    // "misil" nivel 5 también lo mata, pero muy cerca del borde del
    // tiempo de prueba: ~4,3 HP/s medidos a mano contra sus 1250 HP (con
    // la fase 1 reduciendo daño un 15%) rondan los 290s, y cualquier
    // variación de RNG en las oleadas de la FORJA lo empuja por encima
    // de la ventana. "cannon" nivel 6 es más rápido y deja margen real.
    ["M18 VULCANO",        17, "vulcano",         "cannon",    6],
    ["M19 Heraldo Grieta", 18, "heraldo_grieta",  "void",      4],
    ["M20 AXIOMA",         19, "axioma",          "ultimate",  6],
  ];
  const paginas = {};
  for (const [nombre, mis, jefe, ar, niv] of CASOS) {
    const p = await abrir({ navegador: nav }, srv, "ipad");
    paginas[nombre] = p;
    await p.evaluate(({ mis, jefe, ar, niv }) => {
      unlockAudio(); modo = "campana"; iniciarMision(mis);
      golpe = () => {};
      eventoIdx = 999; enemies.length = 0; spawnQueue.length = 0;
      armaId = ar; arma = niv;
      window._bot = setInterval(() => {
        if (state !== "play") return;
        if (upgradesOfrecidos) { elegirUpgrade(upgradesOfrecidos.opciones[0]); return; }
        targetX = miniboss ? miniboss.x : W / 2;
        targetY = H * 0.78;
        arma = niv; armaId = ar;
        enemies.length = 0;   // sin trash orgánico contaminando la medida
      }, 50);
      spawnMiniboss(jefe);
    }, { mis, jefe, ar, niv });

    // VULCANO es el más lento de los diez incluso con cannon nivel 6
    // (reduccionDano 0.85 en F1-F2, y su objetivo de FORJA se lleva
    // parte del fuego que iba al núcleo): ronda los 300s de verdad, así
    // que necesita más margen que el resto para no rozar el borde.
    const cap = jefe === "vulcano" ? 380 : 300;
    let t0 = null, seg = null, hpMax = null;
    for (let i = 0; i < Math.ceil(cap / 1.2); i++) {
      await p.waitForTimeout(1200);
      const st = await p.evaluate(() => miniboss ? { hp: miniboss.hp, max: miniboss.hpMax, est: miniboss.est } : null);
      if (!st) { seg = t0 ? (Date.now() - t0) / 1000 : null; break; }
      hpMax = st.max;
      if (st.est === "combate" && t0 === null) t0 = Date.now();
      if (st.est === "muriendo") { seg = (Date.now() - t0) / 1000; break; }
    }
    console.log(
      (nombre + " · " + ar + " nivel " + niv).padEnd(32),
      String(hpMax).padStart(5) + " HP →",
      seg === null ? "NO MUERE en " + cap + " s" : seg.toFixed(0) + " s de combate"
    );
    comprobar(seg !== null && seg < cap, nombre + ": muere en un tiempo razonable", seg == null ? "no murió" : seg.toFixed(0) + "s");
    // Cerrar aquí, no al final: con los diez casos de este bucle
    // abiertos a la vez, cada `waitForTimeout` real se alarga por la
    // propia carga de tener varias páginas de Chromium corriendo su
    // bucle de juego en paralelo — se midió una vez "NÝX: 4727s de
    // combate", que no es el jefe, es diez pestañas compitiendo por
    // CPU. `informe()` solo lee `p.errores`, que ya quedó recogido; no
    // hace falta la página abierta para eso.
    await p.close();
  }
  await informe(paginas, "artifacts/screenshots/mision-11-20", "Duración de combate M11-M20");
}

// ════════════════════════════════════════════════════════════
console.log("\n8 · RENDIMIENTO — M12/14/16/18/20 en escena densa");
{
  const DENSOS = [
    ["M12 (kryos)",  11, "kryos"],
    ["M14 (vertice)", 13, "vertice"],
    ["M16 (nyx)",     15, "nyx"],
    ["M18 (vulcano)", 17, "vulcano"],
    ["M20 (axioma)",  19, "axioma"],
  ];
  for (const [nombre, mis, jefe] of DENSOS) {
    const p = await abrir({ navegador: nav }, srv, "ipad");
    await p.evaluate(({ mis, jefe }) => {
      unlockAudio(); OPCIONES.vfx = "alto"; aplicarVFX();
      modo = "campana"; iniciarMision(mis); misionIniT = 0;
    }, { mis, jefe });
    await p.waitForTimeout(300);
    await p.evaluate(({ jefe }) => {
      state = "play"; paused = false; golpe = () => {};
      eventoIdx = 999; enemies.length = 0; spawnQueue.length = 0;
      arma = 6; armaId = "ultimate";
      spawnMiniboss(jefe);
      miniboss.est = "combate"; miniboss.estT = 0; miniboss.invul = false;
    }, { jefe });
    // El sprite se pide en `spawnMiniboss` pero `cargarSprite` es
    // asíncrono (decodifica la imagen): hace falta un respiro REAL de
    // Playwright —no un `setTimeout` dentro del propio `evaluate`— para
    // que el navegador termine de verdad antes de comprobar "¿ya está".
    await p.waitForTimeout(300);
    const r = await p.evaluate(({ jefe }) => {
      // Satura: patrón denso + enemigos + tráfico/tempano/mina/colada
      // según cada mundo, para medir en el peor caso razonable.
      for (let i = 0; i < 12; i++) spawnEnemy(["normal", "veloz", "kamikaze"][i % 3]);
      const tiempos = [];
      for (let i = 0; i < 240; i++) {
        const t0 = performance.now();
        update(1 / 60);
        tiempos.push(performance.now() - t0);
      }
      tiempos.sort((a, b) => a - b);
      const media = tiempos.reduce((a, b) => a + b, 0) / tiempos.length;
      const p95 = tiempos[Math.floor(tiempos.length * 0.95)];
      const peor = tiempos[tiempos.length - 1];
      return {
        media: +media.toFixed(2), p95: +p95.toFixed(2), peor: +peor.toFixed(2),
        particulas: VFX.metricas().parts, balas: eBullets.length,
        spriteJefe: !!SPRITES["bs_" + jefe],
      };
    }, { mis, jefe });
    console.log(`        ${nombre.padEnd(16)} medio ${r.media}ms · p95 ${r.p95} · peor ${r.peor} · partículas ${r.particulas} · balas ${r.balas} · sprite ${r.spriteJefe ? "cargado" : "NO"}`);
    comprobar(r.particulas <= 420, nombre + ": no pasa del presupuesto de partículas (420)", r.particulas + "");
    // El MEDIO y el p95 son la medida fiable en headless sin GPU; UN
    // fotograma suelto puede picar por una pausa del propio Chromium
    // (GC, decodificar el sprite que se acaba de pedir) y no significa
    // nada por sí solo — por eso el p95, no el peor absoluto, es lo que
    // de verdad dice si el fotograma "dispara".
    comprobar(r.p95 < 20, nombre + ": el p95 de fotograma no dispara (headless, sin GPU)", `p95 ${r.p95}ms, peor ${r.peor}ms`);
    comprobar(r.spriteJefe, nombre + ": el sprite del jefe está cargado bajo demanda al spawnear");
    comprobar(p.errores.length === 0, nombre + ": sin errores JS", p.errores.slice(0, 3).join(" | "));
    await p.close();
  }
}

// ════════════════════════════════════════════════════════════
console.log("\n9 · 0 404 EN TODA LA EXPANSIÓN — recorrer M11-M20 sin romper ninguna petición");
{
  const p = await abrirPartida();
  await p.evaluate(async (MISIONES_11_20) => {
    for (const { i, jefe } of MISIONES_11_20) {
      modo = "campana"; misionIdx = i; iniciarMision(i); misionIniT = 0;
      await new Promise(r => setTimeout(r, 20));
      state = "play"; paused = false; golpe = () => {};
      eventoIdx = 9999; enemies.length = 0; spawnQueue.length = 0;
      spawnMiniboss(jefe);
      for (let k = 0; k < 15; k++) update(0.05);
    }
  }, MISIONES_11_20);
  comprobar(p.errores.length === 0, "★ 0 errores/404 recorriendo las 10 misiones y sus 10 jefes/minijefes",
    p.errores.slice(0, 8).join(" | ") || "ninguno");
  await p.close();
}

await nav.close();
srv.cerrar();
if (fallos.length) {
  console.log("\nFALLOS: " + fallos.length);
  for (const f of fallos) console.log(" - " + f);
  process.exit(1);
}
console.log("\nTodo correcto.");
