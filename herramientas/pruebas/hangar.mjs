// ════════════════════════════════════════════════════════════
//  hangar.mjs — Hangar, desbloqueos y personalización
// ════════════════════════════════════════════════════════════
//
//    node herramientas/pruebas/hangar.mjs
//
//  Lo que se vigila aquí:
//
//    · Que la CONCESIÓN RETROACTIVA funcione y sea silenciosa. Es el
//      riesgo del bloque: quien ya se pasó la M8 no puede abrir el juego
//      y encontrarse tres naves bloqueadas, ni recibir cuatro carteles
//      de golpe.
//    · Que el aviso salga UNA vez, al completar la misión que toca, y no
//      vuelva a salir al repetirla.
//    · Que la personalización sea COSMÉTICA ENTERA: cambiar skin, color,
//      estela, emblema o nombre no puede mover ni un número de la ficha.
//    · Que el emblema NO se pinte sobre la nave en partida. Se mide con
//      píxeles, no de palabra.
//    · Que todo sobreviva a un recargado, que es lo que hace un iPad
//      cuando Safari descarta la pestaña.

import { servidor, cargarPlaywright } from "../qa.mjs";

const srv = await servidor();
const { chromium } = await cargarPlaywright();
const nav = await chromium.launch();

const fallos = [];
const comprobar = (ok, t, extra) => {
  console.log((ok ? "  ok    " : "  FALLO ") + t + (extra ? "   " + extra : ""));
  if (!ok) fallos.push(t);
};

const semilla = (o) => localStorage.setItem("sf_save", JSON.stringify({
  v: 2,
  campana: { misionMax: o.misionMax ?? 0, misionIdx: 0, completada: false,
             stats: null, records: {}, temaId: "espacio" },
  perfil: { record: 4242, eloi: 777, partidas: 3,
            misionesCompletadas: 5, jefesDerrotados: 5, tiempoJugado: 900 },
  naves: { seleccionada: o.nave ?? "chassis_01",
           desbloqueadas: o.desbloqueadas ?? [], config: o.config ?? {} },
  opciones: {}, meta: { creado: 1, ultimoGuardado: 2 },
}));

async function abrir(arg) {
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
  if (arg) await p.evaluate(semilla, arg);
  await p.reload({ waitUntil: "load" });
  await p.waitForTimeout(900);
  p.cerrar = () => ctx.close();
  return p;
}

// Toca el botón cuyo texto/posición coincide con el rectángulo dado.
// `botones` se rellena mientras se DIBUJA, así que hay que pintar un
// fotograma antes de poder buscar nada.
const pintar = async (p, n = 3) => p.evaluate(async (n) => {
  for (let i = 0; i < n; i++) await new Promise(r => requestAnimationFrame(r));
}, n);

// ════════════════════════════════════════════════════════════
console.log("\n1 · CONCESIÓN RETROACTIVA");
{
  // Save "antiguo": M9 superada y la lista de desbloqueadas VACÍA, que
  // es exactamente lo que tiene quien jugó antes de este bloque.
  const p = await abrir({ misionMax: 8, desbloqueadas: [] });
  const r = await p.evaluate(() => ({
    lista: SAVE.get("naves.desbloqueadas", []).slice().sort(),
    libres: NAVES.filter(n => !n.bloqueada).map(n => n.id).join(","),
    bloqueadas: NAVES.filter(n => n.bloqueada).map(n => n.id).join(","),
    avisos: UI.pendientes ? UI.pendientes() : null,
  }));
  comprobar(r.lista.join(",") === "chassis_01,chassis_02,chassis_03,chassis_04",
    "con la M9 superada se conceden los cuatro que tocan", r.lista.join(","));
  comprobar(r.bloqueadas === "chassis_05",
    "y NOVA sigue bloqueada porque pide la M10", r.bloqueadas || "ninguna");
  await p.cerrar();
}

{
  const p = await abrir({ misionMax: 3, desbloqueadas: [] });
  const r = await p.evaluate(() => ({
    libres: NAVES.filter(n => !n.bloqueada).map(n => n.id).join(","),
  }));
  comprobar(r.libres === "chassis_01,chassis_02",
    "con la M4 superada solo se conceden dos", r.libres);
  await p.cerrar();
}

{
  // El caso que NO puede fallar: alguien lleva equipada una nave que su
  // progreso no justifica. No se le quita.
  const p = await abrir({ misionMax: 0, nave: "chassis_04", desbloqueadas: [] });
  const r = await p.evaluate(() => ({
    equipada: NAVES[naveSel] && NAVES[naveSel].id,
    bloqueada: NAVES[naveSel] && NAVES[naveSel].bloqueada,
    lista: SAVE.get("naves.desbloqueadas", []),
  }));
  comprobar(r.equipada === "chassis_04" && r.bloqueada === false,
    "la nave equipada se conserva aunque el progreso no llegue", r.equipada);
  comprobar(r.lista.includes("chassis_04"), "y queda registrada como desbloqueada");
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\n2 · EL AVISO SALE UNA VEZ, Y CUANDO TOCA");
{
  const p = await abrir({ misionMax: 0, desbloqueadas: [] });
  const r = await p.evaluate(async () => {
    // Al arrancar NO puede haber salido ningún cartel: la concesión de
    // apertura es silenciosa por diseño.
    const alArrancar = SHIPS.otorgarPorProgreso(0, "chassis_01", true).length;
    // Ahora "completa" la M2, que es lo que abre el STRIKER.
    const primera = SHIPS.otorgarPorProgreso(2, "chassis_01", true).map(c => c.id);
    // Y repetirla no vuelve a dar nada.
    const repetida = SHIPS.otorgarPorProgreso(2, "chassis_01", true).map(c => c.id);
    return { alArrancar, primera, repetida,
             lista: SAVE.get("naves.desbloqueadas", []) };
  });
  comprobar(r.alArrancar === 0, "al arrancar no queda nada por conceder");
  comprobar(r.primera.join(",") === "chassis_02",
    "completar la M2 abre el STRIKER y solo el STRIKER", r.primera.join(","));
  comprobar(r.repetida.length === 0,
    "repetir la misma misión no vuelve a avisar", r.repetida.length + " avisos");
  comprobar(r.lista.filter(x => x === "chassis_02").length === 1,
    "y no se duplica en el guardado");
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\n3 · EL HANGAR SE ABRE Y SE NAVEGA");
{
  const p = await abrir({ misionMax: 9 });
  const r = await p.evaluate(async () => {
    state = "menu"; pantalla = "naves";
    for (let i = 0; i < 4; i++) await new Promise(r => requestAnimationFrame(r));
    const estIni = HANGAR.estado();
    const casillas = naveRects.length;
    // Cambiar a la pestaña de aspecto y recorrer sus cinco secciones.
    HANGAR.ir("aspecto");
    // Cada sección se mide en su propio fotograma limpio: `botones` se
    // rellena al DIBUJAR, así que hay que vaciarlo y pintar solo el
    // Hangar, o se cuentan los botones de la sección anterior.
    const secciones = [];
    for (const s of ["skin", "estela", "emblema", "color", "nombre"]) {
      HANGAR.irSeccion(s);
      botones.length = 0;
      HANGAR.dibujar(PUENTE_HANGAR);
      secciones.push({ s, botones: botones.length, activa: HANGAR.estado().seccion });
    }
    return { estIni, casillas, secciones, naves: NAVES.length };
  });
  comprobar(r.estIni.pestana === "chasis", "abre en la pestaña de CHASIS", r.estIni.pestana);
  comprobar(r.casillas === r.naves, "la rejilla pinta una casilla por nave",
    r.casillas + "/" + r.naves);
  comprobar(r.secciones.every(x => x.activa === x.s),
    "el selector de sección cambia de sección de verdad");
  comprobar(r.secciones.every(x => x.botones > 8),
    "y las cinco dibujan sus controles",
    r.secciones.map(x => x.s + ":" + x.botones).join(" "));
  // Si dos secciones distintas dibujan EXACTAMENTE los mismos botones es
  // que no ha cambiado nada, que es justo el error que tenía esta prueba.
  comprobar(new Set(r.secciones.map(x => x.botones)).size > 1,
    "y no son todas la misma pantalla repetida");
  comprobar(p.errs.length === 0, "sin errores", p.errs[0] || "");
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\n4 · PERSONALIZAR NO MUEVE NI UN NÚMERO");
{
  const p = await abrir({ misionMax: 9 });
  const r = await p.evaluate(async () => {
    const ficha = (id) => {
      const n = NAVES.find(x => x.id === id);
      return { arma: n.arma, vel: n.vel, cad: n.cad, dmg: n.dmg,
               hitbox: n.hitbox, escudo: n.escudo, escala: n.escala };
    };
    const antes = ficha("chassis_03");
    naveSel = NAVES.findIndex(n => n.id === "chassis_03"); nvIdx = -1; trIdx = -1;
    const radioAntes = hitR();

    SHIPS.guardarConfig("chassis_03", {
      skinId: "golden", trailId: "solar", emblemId: "wolf",
      customName: "LA MÍA", primary: "#ff2ea6",
    });
    NAVES = SHIPS.construir("chassis_03", SAVE.get("naves.desbloqueadas", []));
    naveSel = NAVES.findIndex(n => n.id === "chassis_03"); nvIdx = -1; trIdx = -1;
    await new Promise(r => requestAnimationFrame(r));

    return { antes, despues: ficha("chassis_03"),
             radioAntes: +radioAntes.toFixed(4), radioDespues: +hitR().toFixed(4),
             cfg: SHIPS.config("chassis_03") };
  });
  const igual = JSON.stringify(r.antes) === JSON.stringify(r.despues);
  comprobar(igual, "la ficha de juego es idéntica tras personalizar",
    igual ? "" : JSON.stringify(r.despues));
  comprobar(r.radioAntes === r.radioDespues,
    "y el radio de hitbox no se mueve", r.radioAntes + " → " + r.radioDespues);
  comprobar(r.cfg.skinId === "golden" && r.cfg.trailId === "solar" &&
            r.cfg.emblemId === "wolf" && r.cfg.customName === "LA MÍA" &&
            r.cfg.colors.primary === "#ff2ea6",
    "los cinco campos quedan guardados", JSON.stringify(r.cfg.colors));
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\n5 · LA SKIN CAMBIA LA NAVE DE VERDAD");
{
  const p = await abrir({ misionMax: 9 });
  const r = await p.evaluate(async () => {
    // Se compone en un lienzo aparte y se comparan los píxeles del
    // centro. Aquí SÍ se puede leer: la prueba corre por http, no por
    // file://. En file:// no se lee nada, pero tampoco hace falta:
    // componer no usa getImageData.
    const leer = (img) => {
      const c = document.createElement("canvas");
      c.width = 24; c.height = 24;
      const x = c.getContext("2d");
      x.drawImage(img, 0, 0, 24, 24);
      return Array.from(x.getImageData(0, 0, 24, 24).data);
    };
    const orig = SPRITES["chassis_02"];
    if (!orig) return { falta: true };

    SHIPS.guardarConfig("chassis_02", { skinId: "default", primary: null, secondary: null, accent: null });
    SHIPS.limpiarCache();
    const sinSkin = SHIPS.sprite("chassis_02", orig);
    const pxSin = leer(sinSkin);

    SHIPS.guardarConfig("chassis_02", { skinId: "golden" });
    const conSkin = SHIPS.sprite("chassis_02", orig);
    const pxCon = leer(conSkin);

    // Cuántos píxeles opacos han cambiado de color, y cuántos píxeles
    // transparentes se han vuelto opacos (eso sería el cuadrado que
    // deja `source-atop` mal usado: la trampa documentada del proyecto).
    let cambiados = 0, invadidos = 0, opacos = 0;
    for (let i = 0; i < pxSin.length; i += 4) {
      const aA = pxSin[i + 3], aB = pxCon[i + 3];
      if (aA > 20) {
        opacos++;
        if (Math.abs(pxSin[i] - pxCon[i]) + Math.abs(pxSin[i + 1] - pxCon[i + 1]) +
            Math.abs(pxSin[i + 2] - pxCon[i + 2]) > 24) cambiados++;
      } else if (aB > 40) invadidos++;
    }
    // La caché tiene que devolver el MISMO objeto la segunda vez.
    const cacheado = SHIPS.sprite("chassis_02", orig) === conSkin;
    const mismoTam = conSkin.width === (orig.width || orig.naturalWidth);
    return { opacos, cambiados, invadidos, cacheado, mismoTam,
             esOriginal: sinSkin === orig };
  });
  comprobar(!r.falta, "el sprite del chasis está cargado");
  comprobar(r.esOriginal, "sin skin ni colores se devuelve el sprite ORIGINAL, sin componer");
  comprobar(r.cambiados > r.opacos * 0.6,
    "la skin repinta la nave", r.cambiados + "/" + r.opacos + " píxeles");
  comprobar(r.invadidos === 0,
    "y no pinta un cuadrado alrededor (la trampa de source-atop)",
    r.invadidos + " píxeles invadidos");
  comprobar(r.mismoTam, "el compuesto conserva el tamaño del original");
  comprobar(r.cacheado, "y se compone una sola vez (queda en caché)");
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\n6 · LA ESTELA CAMBIA EL COLOR DEL MOTOR");
{
  const p = await abrir({ misionMax: 9 });
  const r = await p.evaluate(async () => {
    naveSel = NAVES.findIndex(n => n.id === "chassis_01"); nvIdx = -1; trIdx = -1;
    await new Promise(r => requestAnimationFrame(r));
    const pordefecto = { trail: trailActual().id, col: nvColor() };
    SHIPS.guardarConfig("chassis_01", { trailId: "toxico" });
    nvIdx = -1; trIdx = -1;
    await new Promise(r => requestAnimationFrame(r));
    const tras = { trail: trailActual().id, col: nvColor() };
    return { pordefecto, tras, esperado: SHIPS.trail("toxico").col,
             chasisMotor: SHIPS.porId("chassis_01").motor };
  });
  comprobar(r.pordefecto.trail === "ion",
    "cada chasis arranca con la estela que le corresponde", r.pordefecto.trail);
  comprobar(r.tras.trail === "toxico" && r.tras.col === r.esperado,
    "cambiarla cambia el color del motor", r.tras.col);
  comprobar(r.tras.col !== r.chasisMotor,
    "y manda sobre el color de fábrica del chasis",
    r.chasisMotor + " → " + r.tras.col);
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\n7 · EL EMBLEMA NO SE PINTA SOBRE LA NAVE EN PARTIDA");
{
  const p = await abrir({ misionMax: 9 });
  const r = await p.evaluate(async () => {
    SHIPS.guardarConfig("chassis_03", { emblemId: "dragon", skinId: "default",
      primary: null, secondary: null, accent: null });
    NAVES = SHIPS.construir("chassis_03", SAVE.get("naves.desbloqueadas", []));
    naveSel = NAVES.findIndex(n => n.id === "chassis_03"); nvIdx = -1; trIdx = -1;

    const emblemaCargado = !!SPRITES["emb_dragon"];
    // El sprite que va a partida NO puede ser el emblema ni llevarlo
    // dentro: con emblema y sin emblema tiene que ser el MISMO objeto.
    const conEmb = SHIPS.sprite("chassis_03", SPRITES["chassis_03"]);
    SHIPS.guardarConfig("chassis_03", { emblemId: "ninguno" });
    const sinEmb = SHIPS.sprite("chassis_03", SPRITES["chassis_03"]);
    return { emblemaCargado, mismo: conEmb === sinEmb,
             esOriginal: conEmb === SPRITES["chassis_03"] };
  });
  comprobar(r.emblemaCargado, "los emblemas se precargan con el resto del arte");
  comprobar(r.mismo && r.esOriginal,
    "poner emblema no altera el sprite que se dibuja en partida");
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\n8 · UNA NAVE BLOQUEADA NO SE PUEDE EQUIPAR");
{
  const p = await abrir({ misionMax: 2 });
  const r = await p.evaluate(async () => {
    state = "menu"; pantalla = "naves";
    for (let i = 0; i < 4; i++) await new Promise(r => requestAnimationFrame(r));
    const i4 = NAVES.findIndex(n => n.id === "chassis_04");
    const antes = naveSel;
    const rect = naveRects.find(x => x.i === i4);
    const btn = rect && botones.find(b => b.x === rect.x && b.y === rect.y && b.fn);
    if (btn) btn.fn();
    await new Promise(r => requestAnimationFrame(r));
    return { bloqueada: NAVES[i4].bloqueada, cambio: naveSel !== antes,
             aviso, avisoActivo: avisoT > 0,
             guardada: SAVE.get("naves.seleccionada") };
  });
  comprobar(r.bloqueada === true, "con la M3 superada el PHANTOM sigue bloqueado");
  comprobar(!r.cambio, "tocarlo no lo equipa");
  comprobar(r.avisoActivo && /M8/.test(r.aviso), "y dice qué hay que hacer", r.aviso);
  comprobar(r.guardada !== "chassis_04", "ni se cuela en el guardado", r.guardada);
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\n9 · TODO SOBREVIVE AL RECARGADO");
{
  const p = await abrir({ misionMax: 9 });
  await p.evaluate(async () => {
    SHIPS.guardarConfig("chassis_05", {
      skinId: "shadow", trailId: "cosmico", emblemId: "phoenix",
      customName: "SOBERANA", primary: "#8aff4d", accent: "#ffcf5c",
    });
    naveSel = NAVES.findIndex(n => n.id === "chassis_05");
    guardarNave();
    SAVE.ya("prueba");
  });
  await p.reload({ waitUntil: "load" });
  await p.waitForTimeout(700);
  const r = await p.evaluate(() => ({
    cfg: SHIPS.config("chassis_05"),
    equipada: NAVES[naveSel] && NAVES[naveSel].id,
    trail: trailActual().id,
    // Y la configuración de OTRO chasis no se ha contaminado.
    otra: SHIPS.config("chassis_01"),
  }));
  comprobar(r.equipada === "chassis_05", "sigue equipada la misma nave", r.equipada);
  comprobar(r.cfg.customName === "SOBERANA" && r.cfg.skinId === "shadow" &&
            r.cfg.emblemId === "phoenix" && r.cfg.colors.primary === "#8aff4d" &&
            r.cfg.colors.accent === "#ffcf5c",
    "y toda su personalización", JSON.stringify(r.cfg.colors));
  comprobar(r.trail === "cosmico", "incluida la estela", r.trail);
  comprobar(r.otra.skinId === "default" && r.otra.customName === "",
    "la configuración es POR CHASIS y no se contamina");
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\n10 · UN SAVE ANTERIOR AL BLOQUE ENTRA SIN PERDER NADA");
{
  const ctx = await nav.newContext({ viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true });
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", e => errs.push("EXCEPCION " + e.message));
  await p.goto(srv.url + "/index.html", { waitUntil: "commit" });
  // Save v2 con el esquema VIEJO: naves.skins y naves.colores, que ya no
  // existen, y un id de nave legacy.
  await p.evaluate(() => localStorage.setItem("sf_save", JSON.stringify({
    v: 2,
    campana: { misionMax: 6, misionIdx: 2, completada: false, stats: null,
               records: { 0: 1234 }, temaId: "espacio" },
    perfil: { record: 9999, eloi: 321, partidas: 12, misionesCompletadas: 7,
              jefesDerrotados: 7, tiempoJugado: 3600 },
    naves: { seleccionada: "silvia", desbloqueadas: [], skins: { silvia: "x" },
             colores: { silvia: "#fff" } },
    opciones: { musica: 0.5 }, meta: { creado: 1, ultimoGuardado: 2 },
  })));
  await p.reload({ waitUntil: "load" });
  await p.waitForTimeout(900);
  const r = await p.evaluate(() => ({
    equipada: NAVES[naveSel] && NAVES[naveSel].id,
    record: SAVE.get("perfil.record"), eloi: SAVE.get("perfil.eloi"),
    misionMax, cfg: SHIPS.config("chassis_03"),
    libres: NAVES.filter(n => !n.bloqueada).map(n => n.id).join(","),
  }));
  comprobar(r.equipada === "chassis_03", "el alias legacy sigue funcionando", r.equipada);
  comprobar(r.record === 9999 && r.eloi === 321 && r.misionMax === 6,
    "no se pierde progreso ni economía", `record ${r.record} · eloi ${r.eloi} · M${r.misionMax + 1}`);
  comprobar(r.cfg.skinId === "default" && r.cfg.trailId === "violeta",
    "y arranca con la personalización por defecto de su chasis", r.cfg.trailId);
  comprobar(r.libres === "chassis_01,chassis_02,chassis_03",
    "con la M7 desbloqueada recibe los tres que le tocan", r.libres);
  comprobar(errs.length === 0, "sin excepciones", errs[0] || "");
  await ctx.close();
}

// ════════════════════════════════════════════════════════════
console.log("\n11 · CERRAR LA MISIÓN AVISA Y REHACE LA TABLA");
{
  // La prueba 2 mide `otorgarPorProgreso` sola. Esta mide el ENGANCHE:
  // que cerrar la misión de verdad avise, reconstruya NAVES y no le
  // cambie la nave al jugador por el camino.
  const p = await abrir({ misionMax: 0, nave: "chassis_01" });
  const r = await p.evaluate(async () => {
    misionIdx = 1;
    const equipadaAntes = NAVES[naveSel].id;
    const bloqAntes = NAVES.filter(n => n.bloqueada).map(n => n.id).join(",");
    const avisos = [];
    const orig = UI.desbloqueo;
    UI.desbloqueo = (o) => { avisos.push(o); return orig.call(UI, o); };
    cerrarMision();
    await new Promise(r => requestAnimationFrame(r));
    UI.desbloqueo = orig;
    return {
      equipadaAntes, bloqAntes,
      equipadaDespues: NAVES[naveSel].id,
      bloqDespues: NAVES.filter(n => n.bloqueada).map(n => n.id).join(","),
      // Se filtran los avisos de NAVE: cerrar misión también anuncia la
      // misión siguiente, y eso es de otro sistema.
      avisos: avisos.filter(a => a.tipo === "nave")
                    .map(a => a.titulo + "/" + a.desc + "/" + a.sprite),
      misionMax,
    };
  });
  comprobar(r.misionMax === 2, "el progreso abre la M3", "misionMax " + r.misionMax);
  comprobar(r.avisos.length === 1 && r.avisos[0] === "AX-4 WARHAWK/STRIKER/chassis_02",
    "sale UN aviso, con modelo, clase y sprite", r.avisos.join(" · ") || "ninguno");
  comprobar(r.bloqAntes.indexOf("chassis_02") >= 0 && r.bloqDespues.indexOf("chassis_02") < 0,
    "la tabla se rehace y el STRIKER deja de estar bloqueado", r.bloqDespues);
  comprobar(r.equipadaDespues === r.equipadaAntes,
    "y la nave equipada no se mueve", r.equipadaAntes + " → " + r.equipadaDespues);
  comprobar(p.errs.length === 0, "sin errores", p.errs[0] || "");
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\n12 · EL CARTEL Y EL DESBLOQUEO DICEN LO MISMO");
{
  // La trampa de este bloque: `misionMax` está TOPADO en 9 (índices de
  // 0 a 9), así que después de la M10 no sube. Si el desbloqueo se
  // colgara de él, NOVA no se podría conseguir nunca y no habría forma
  // de darse cuenta salvo terminando la campaña entera.
  const p = await abrir({ misionMax: 9 });
  const r = await p.evaluate(async () => {
    const antes = NAVES.find(n => n.id === "chassis_05").bloqueada;
    // La M10 es el índice 9. Se cierra como la cierra el juego.
    misionIdx = MISIONES.length - 1;
    cerrarMision();
    await new Promise(r => requestAnimationFrame(r));
    return { antes, tope: misionMax, MIS: MISIONES.length,
             despues: NAVES.find(n => n.id === "chassis_05").bloqueada };
  });
  comprobar(r.antes === true, "con las nueve primeras NOVA sigue cerrada");
  comprobar(r.tope === r.MIS - 1, "misionMax está topado y no sube más", "misionMax " + r.tope);
  comprobar(r.despues === false, "y aun así completar la M10 la abre");
  await p.cerrar();
}

{
  // Y el cartel no puede prometer una cosa y el desbloqueo hacer otra:
  // se comprueba chasis por chasis que el número escrito es EXACTAMENTE
  // el que abre la nave. Es el fallo que no da error y que solo se ve
  // jugando dos horas.
  const p = await abrir({ misionMax: 0 });
  const r = await p.evaluate(async () => {
    const out = [];
    for (const c of SHIPS.CHASIS) {
      if (c.requiere == null) continue;
      // Una misión ANTES de lo prometido: tiene que seguir cerrada.
      SAVE.set("naves.desbloqueadas", [], "prueba");
      const justoAntes = SHIPS.otorgarPorProgreso(c.requiere - 1, null, false).map(x => x.id);
      SAVE.set("naves.desbloqueadas", [], "prueba");
      const justo = SHIPS.otorgarPorProgreso(c.requiere, null, false).map(x => x.id);
      out.push({ id: c.id, requiere: c.requiere,
                 antes: justoAntes.indexOf(c.id) >= 0,
                 justo: justo.indexOf(c.id) >= 0 });
    }
    return out;
  });
  for (const x of r) {
    console.log("        " + x.id + "  cartel: completar la M" + x.requiere);
  }
  comprobar(r.every(x => !x.antes), "ninguna se abre una misión antes de lo que promete",
    r.filter(x => x.antes).map(x => x.id).join(",") || "ninguna se adelanta");
  comprobar(r.every(x => x.justo), "y todas se abren justo con la que promete",
    r.filter(x => !x.justo).map(x => x.id).join(",") || "las " + r.length);
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\n13 · EL CAMBIO SE VE EN EL ACTO");
{
  // El juego guarda aparte el sprite y la estela ya resueltos de la nave
  // equipada, porque los pide una vez por partícula y por fotograma. Si
  // el Hangar guarda una skin y no los invalida, el escaparate sigue
  // enseñando el color anterior y no hay error en ninguna consola: solo
  // un jugador que toca DORADA y no ve nada.
  const p = await abrir({ misionMax: 9 });
  const r = await p.evaluate(async (SECCIONES) => {
    state = "menu"; pantalla = "naves";
    naveSel = NAVES.findIndex(n => n.id === "chassis_01");
    nvIdx = -1; trIdx = -1; spIdx = -1;
    for (let i = 0; i < 3; i++) await new Promise(r => requestAnimationFrame(r));
    const antes = spriteNave();

    // Se pulsa el botón DORADA de verdad, tal cual lo pulsa un dedo.
    HANGAR.ir("aspecto"); HANGAR.irSeccion("skin");
    botones.length = 0;
    HANGAR.dibujar(PUENTE_HANGAR);
    // Orden en que el Hangar dibuja sus botones: flecha de volver (1),
    // pestañas (2), selector de sección (5), las fichas de la sección y
    // por último la rejilla. Se comprueba el total antes de pulsar: si
    // alguien añade un botón, esta prueba falla en vez de pulsar a ciegas
    // el control equivocado y dar por bueno lo que no ha probado.
    const cabeza = 1 + 2 + SECCIONES;
    const totalEsperado = cabeza + SHIPS.SKINS.length + NAVES.length + 1;
    const total = botones.length;
    const iDorada = SHIPS.SKINS.findIndex(s => s.id === "golden");
    if (total === totalEsperado) botones[cabeza + iDorada].fn();
    await new Promise(r => requestAnimationFrame(r));

    const despues = spriteNave();
    return { skin: SHIPS.config("chassis_01").skinId,
             total, totalEsperado,
             cambiado: antes !== despues,
             compuesto: !!despues && despues.tagName === "CANVAS" };
  }, 5);   // las cinco secciones de ASPECTO
  comprobar(r.total === r.totalEsperado,
    "la sección SKIN dibuja los botones que se esperan",
    r.total + "/" + r.totalEsperado);
  comprobar(r.skin === "golden", "pulsar la ficha guarda la skin", r.skin);
  comprobar(r.cambiado && r.compuesto,
    "y el sprite que usa el juego cambia en el mismo fotograma");
  comprobar(p.errs.length === 0, "sin errores", p.errs[0] || "");
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\n14 · CAPTURAS");
{
  const p = await abrir({ misionMax: 9,
    config: { chassis_03: { skinId: "golden", trailId: "solar", emblemId: "dragon" } } });
  await p.evaluate(async () => {
    state = "menu"; pantalla = "naves";
    naveSel = NAVES.findIndex(n => n.id === "chassis_03"); nvIdx = -1; trIdx = -1;
    HANGAR.ir("chasis");
  });
  await pintar(p, 10);
  await p.screenshot({ path: "artifacts/screenshots/hangar/4d-chasis.png" });
  await p.evaluate(() => HANGAR.ir("aspecto"));
  await pintar(p, 10);
  await p.screenshot({ path: "artifacts/screenshots/hangar/4d-aspecto.png" });
  comprobar(p.errs.length === 0, "capturas sin errores", p.errs[0] || "");
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
