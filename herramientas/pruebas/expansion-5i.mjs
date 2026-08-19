// ════════════════════════════════════════════════════════════
//  expansion-5i.mjs — música, fondos, skins y emblemas del bloque 5I
// ════════════════════════════════════════════════════════════
//
//    node herramientas/pruebas/expansion-5i.mjs
//
//  Lo que 5H dejó sin poder probar porque el arte y la música no
//  existían todavía. Cada sección vigila peticiones de red REALES (no
//  el catálogo en memoria, que no cuesta nada por sí solo) para
//  confirmar que nada de la expansión se descarga antes de que el
//  juego lo pida de verdad — la regla que costó el bug de premios de 5F.

import { servidor, cargarPlaywright } from "../qa.mjs";

const srv = await servidor();
const { chromium } = await cargarPlaywright();
const nav = await chromium.launch();

const fallos = [];
const comprobar = (ok, t, extra) => {
  console.log((ok ? "  ok    " : "  FALLO ") + t + (extra ? "   " + extra : ""));
  if (!ok) fallos.push(t);
};

async function abrirConSave(seedJson) {
  const ctx = await nav.newContext({ viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true });
  const p = await ctx.newPage();
  const errores = [], peticiones = [];
  p.on("pageerror", e => errores.push("EXCEPCION " + e.message));
  p.on("console", m => { if (m.type() === "error") errores.push("CONSOLE " + m.text()); });
  p.on("request", r => peticiones.push(r.url().replace(srv.url, "")));
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
  p.peticiones = peticiones;
  return { ctx, p };
}

const SAVE_BASE = (extra) => JSON.stringify(Object.assign({
  v: 2,
  campana: Object.assign({ misionMax: 0, misionIdx: 0, completada: false, completadaBase: false,
    completadaExp: false, stats: null, statsExp: null, records: {}, temaId: "espacio", eloiExp: 0 },
    (extra && extra.campana) || {}),
  perfil: Object.assign({ record: 0, eloi: 0, partidas: 1, misionesCompletadas: 0, jefesDerrotados: 0, tiempoJugado: 0 },
    (extra && extra.perfil) || {}),
  naves: Object.assign({ seleccionada: "chassis_01", desbloqueadas: [], skinsDesbloqueadas: [],
    emblemasDesbloqueadas: [], config: {} }, (extra && extra.naves) || {}),
  opciones: {}, meta: { creado: 1, ultimoGuardado: 2 },
}, {}));

const pide = (peticiones, patron) => peticiones.some(u => patron.test(u));

// ════════════════════════════════════════════════════════════
console.log("\n1 · ARRANQUE EN FRÍO — nada de la expansión se pide sin que haga falta");
{
  const { ctx, p } = await abrirConSave(null);
  await p.waitForTimeout(800);
  const exp = p.peticiones.filter(u =>
    /combate_c|combate_d|combate_e|jefe2|final2/.test(u) ||
    /fondos\/megaciudad/.test(u) ||
    /naves\/skins\//.test(u) ||
    /emblemas\/expansion/.test(u));
  comprobar(exp.length === 0, "★ ni música, ni fondo, ni skins, ni emblemas de la expansión", exp.join(", ") || "0 peticiones");
  comprobar(!p.errores.length, "sin errores ni 404", p.errores.join(" | "));
  await ctx.close();
}

// ════════════════════════════════════════════════════════════
console.log("\n2 · M11 SOLA — no arrastra las otras cuatro pistas de combate ni los jefes");
{
  const seed = SAVE_BASE({ campana: { misionMax: 9, misionIdx: 9, completada: true, completadaBase: true } });
  const { ctx, p } = await abrirConSave(seed);
  await p.evaluate(() => { unlockAudio(); modo = "campana"; iniciarMision(10); });
  await p.waitForTimeout(1500);
  const pistaViva = await p.evaluate(() => (typeof MUSICA !== "undefined" ? MUSICA.debug().pista : "—"));
  comprobar(pistaViva === "combate_c", "★ M11 (hielo) suena con combate_c", pistaViva);
  comprobar(pide(p.peticiones, /audio\/musica\/combate_c\.mp3/), "combate_c.mp3 se pidió de verdad");
  const otras = p.peticiones.filter(u => /combate_d|combate_e|jefe2|final2/.test(u));
  comprobar(otras.length === 0, "★ y ninguna de las otras cuatro pistas de la expansión", otras.join(", ") || "0");
  comprobar(!pide(p.peticiones, /fondos\/megaciudad/), "el fondo de megaciudad tampoco (no es su mundo)");
  comprobar(!p.errores.length, "sin errores", p.errores.join(" | "));
  await ctx.close();
}

// ════════════════════════════════════════════════════════════
console.log("\n3 · KRYOS, VÉRTICE, NÝX Y VULCANO SUENAN CON jefe2");
{
  const CASOS = [
    { i: 11, tipo: "kryos",   mundo: "hielo" },
    { i: 13, tipo: "vertice", mundo: "megaciudad" },
    { i: 15, tipo: "nyx",     mundo: "abismo" },
    { i: 17, tipo: "vulcano", mundo: "fragua" },
  ];
  for (const c of CASOS) {
    const seed = SAVE_BASE({ campana: { misionMax: c.i, misionIdx: c.i, completada: true, completadaBase: true } });
    const { ctx, p } = await abrirConSave(seed);
    await p.evaluate((i) => { unlockAudio(); modo = "campana"; iniciarMision(i); }, c.i);
    await p.evaluate((tipo) => { spawnMiniboss(tipo, 1); }, c.tipo);
    await p.waitForTimeout(600);
    const pistaViva = await p.evaluate(() => (typeof MUSICA !== "undefined" ? MUSICA.debug().pista : "—"));
    comprobar(pistaViva === "jefe2", c.tipo.toUpperCase() + " suena con jefe2", pistaViva);
    comprobar(pide(p.peticiones, /audio\/musica\/jefe2\.mp3/), c.tipo + ": jefe2.mp3 pedido de verdad");
    comprobar(!pide(p.peticiones, /audio\/musica\/jefe\.mp3/), c.tipo + ": NO pide la pista de los 9 jefes base");
    await ctx.close();
  }
}

// ════════════════════════════════════════════════════════════
console.log("\n4 · AXIOMA SUENA CON final2, DISTINTA DE jefe_final (OMEGA)");
{
  const seed = SAVE_BASE({ campana: { misionMax: 19, misionIdx: 19, completada: true, completadaBase: true } });
  const { ctx, p } = await abrirConSave(seed);
  await p.evaluate(() => { unlockAudio(); modo = "campana"; iniciarMision(19); });
  await p.evaluate(() => { spawnMiniboss("axioma", 1); });
  await p.waitForTimeout(600);
  const pistaViva = await p.evaluate(() => (typeof MUSICA !== "undefined" ? MUSICA.debug().pista : "—"));
  comprobar(pistaViva === "final2", "★ AXIOMA suena con final2, no jefe_final", pistaViva);
  comprobar(pide(p.peticiones, /audio\/musica\/final2\.mp3/), "final2.mp3 pedido de verdad");
  comprobar(!pide(p.peticiones, /audio\/musica\/jefe_final\.mp3/), "★ y NO comparte pista con OMEGA SOVEREIGN");
  await ctx.close();
}

// ════════════════════════════════════════════════════════════
console.log("\n5 · MEGACIUDAD TIENE FONDO PROPIO, BAJO DEMANDA");
{
  const seed = SAVE_BASE({ campana: { misionMax: 12, misionIdx: 12, completada: true, completadaBase: true } });
  const { ctx, p } = await abrirConSave(seed);
  await p.evaluate(() => { unlockAudio(); modo = "campana"; iniciarMision(12); });
  await p.waitForTimeout(800);
  comprobar(pide(p.peticiones, /art\/fondos\/megaciudad\.png/), "★ M13 (megaciudad) pide su fondo propio");
  const otrosFondos = p.peticiones.filter(u => /art\/fondos\/(hielo|abismo|fragua|grieta)\.png/.test(u));
  comprobar(otrosFondos.length === 0, "y no arrastra los otros cuatro fondos de la expansión", otrosFondos.join(", ") || "0");
  comprobar(!p.errores.length, "sin errores ni 404 en el fondo");
  await ctx.close();
}

// ════════════════════════════════════════════════════════════
console.log("\n6 · SKIN DE MATERIAL: ARTE DE VERDAD EN CHASSIS_01, BLOQUEADA EN LOS DEMÁS");
{
  const seed = SAVE_BASE({
    naves: { seleccionada: "chassis_01", desbloqueadas: ["chassis_01"],
      skinsDesbloqueadas: ["arctic"], emblemasDesbloqueadas: [],
      config: { chassis_01: { skinId: "arctic" } } },
  });
  const { ctx, p } = await abrirConSave(seed);
  await p.evaluate(() => { pantalla = "naves"; });
  await p.waitForTimeout(600);
  comprobar(pide(p.peticiones, /naves\/skins\/chassis_01\/arctic\.png/),
    "★ chassis_01 con ÁRTICA desbloqueada pide el PNG de material");
  const spriteEsArte = await p.evaluate(() => {
    const cf = SHIPS.config("chassis_01");
    const clave = "skin_" + cf.skinId + "_chassis_01";
    return !!SPRITES[clave] && spriteNave() === SPRITES[clave];
  });
  comprobar(spriteEsArte, "★ y el sprite que se dibuja ES ese PNG, no un tinte compuesto");
  await ctx.close();
}
{
  // chassis_03 no tiene arte de material: aunque alguien fuerce el
  // skinId en el save, no debe pedir ningún PNG de skins/ y debe caer
  // al tinte de siempre (arte === null).
  const seed = SAVE_BASE({
    naves: { seleccionada: "chassis_03", desbloqueadas: ["chassis_01", "chassis_02", "chassis_03"],
      skinsDesbloqueadas: ["arctic"], emblemasDesbloqueadas: [],
      config: { chassis_03: { skinId: "arctic" } } },
    campana: { misionMax: 4, misionIdx: 4, completada: true, completadaBase: true },
  });
  const { ctx, p } = await abrirConSave(seed);
  await p.evaluate(() => { pantalla = "naves"; });
  await p.waitForTimeout(600);
  comprobar(!pide(p.peticiones, /naves\/skins\//), "★ chassis_03 con la misma skin NO pide ningún PNG de material");
  const arte = await p.evaluate(() => SHIPS.materialArchivo("arctic", "chassis_03"));
  comprobar(arte === null, "SHIPS.materialArchivo() confirma que no hay arte para ese chasis", String(arte));
  await ctx.close();
}

// ════════════════════════════════════════════════════════════
console.log("\n7 · EMBLEMAS DE LA EXPANSIÓN: BLOQUEADOS HASTA MATAR AL JEFE, LUEGO DE VERDAD");
{
  // Sin desbloquear: no debe poder equiparse, y no debe pedir su PNG.
  const seedBloq = SAVE_BASE({ naves: { seleccionada: "chassis_01", desbloqueadas: ["chassis_01"],
    skinsDesbloqueadas: [], emblemasDesbloqueadas: [], config: {} } });
  const { ctx: c1, p: p1 } = await abrirConSave(seedBloq);
  const bloqueado = await p1.evaluate(() => SHIPS.emblemaDisponible("kryos", []));
  comprobar(bloqueado === false, "sin matar a KRYOS, el emblema no está disponible");
  comprobar(!pide(p1.peticiones, /emblemas\/expansion\/kryos\.png/), "★ y su PNG no se ha pedido");
  await c1.close();

  // Desbloqueado y equipado: sí debe pedir su PNG.
  const seedOk = SAVE_BASE({ naves: { seleccionada: "chassis_01", desbloqueadas: ["chassis_01"],
    skinsDesbloqueadas: [], emblemasDesbloqueadas: ["kryos"], config: { chassis_01: { emblemId: "kryos" } } } });
  const { ctx: c2, p: p2 } = await abrirConSave(seedOk);
  await p2.evaluate(() => { pantalla = "naves"; });
  await p2.waitForTimeout(600);
  comprobar(pide(p2.peticiones, /emblemas\/expansion\/kryos\.png/), "★ desbloqueado y equipado, el PNG se pide de verdad");
  await c2.close();
}

// ════════════════════════════════════════════════════════════
console.log("\n8 · MEMORIA: NUNCA MÁS DE TRES <audio> VIVOS A LA VEZ");
{
  const seed = SAVE_BASE({ campana: { misionMax: 19, misionIdx: 19, completada: true, completadaBase: true } });
  const { ctx, p } = await abrirConSave(seed);
  const contar = () => p.evaluate(() => document.querySelectorAll("[data-musica]").length);
  await p.evaluate(() => { unlockAudio(); });
  comprobar((await contar()) <= 3, "en el menú", await contar());
  await p.evaluate(() => { modo = "campana"; iniciarMision(10); });
  await p.waitForTimeout(400);
  comprobar((await contar()) <= 3, "en combate de la expansión (M11)", await contar());
  await p.evaluate(() => { spawnMiniboss("kryos", 1); });
  await p.waitForTimeout(400);
  comprobar((await contar()) <= 3, "con un jefe de la expansión en pantalla", await contar());
  await p.evaluate(() => { pantalla = "naves"; state = "menu"; });
  await p.waitForTimeout(400);
  comprobar((await contar()) <= 3, "de vuelta en el Hangar", await contar());
  comprobar(!p.errores.length, "sin errores en todo el recorrido", p.errores.join(" | "));
  await ctx.close();
}

// ════════════════════════════════════════════════════════════
console.log("\n9 · REGRESIÓN: LA CAMPAÑA BASE SIGUE SONANDO COMO SIEMPRE");
{
  const { ctx, p } = await abrirConSave(null);
  await p.evaluate(() => { unlockAudio(); modo = "campana"; iniciarMision(0); });
  await p.waitForTimeout(800);
  const pistaViva = await p.evaluate(() => MUSICA.debug().pista);
  comprobar(pistaViva === "combate_a", "M1 sigue sonando con combate_a, como desde el bloque base", pistaViva);
  comprobar(!pide(p.peticiones, /combate_c|combate_d|combate_e|jefe2|final2/),
    "★ y no toca ni un solo archivo de la expansión");
  comprobar(!p.errores.length, "sin errores", p.errores.join(" | "));
  await ctx.close();
}

await nav.close();
srv.cerrar();
if (fallos.length) {
  console.log("\nFALLOS: " + fallos.length);
  for (const f of fallos) console.log(" - " + f);
  process.exit(1);
}
console.log("\nTodo correcto.");
