// ════════════════════════════════════════════════════════════
//  admin.mjs — MODO ADMIN / FAMILY SANDBOX
// ════════════════════════════════════════════════════════════
//
//    node herramientas/pruebas/admin.mjs
//
//  Lo que se vigila aquí, por orden de gravedad:
//
//    1. QUE EL SAVE DEL JUGADOR NO SE TOQUE. Es lo único de todo el
//       bloque que, si falla, destruye algo que no se puede recuperar:
//       la partida de alguien. No se comprueba "parece que sigue
//       igual": se guarda el texto EXACTO de `sf_save` antes de entrar
//       en admin y se compara byte a byte al salir.
//
//    2. Que la FOUNDER FLEET no exista fuera de admin. Son cuatro naves
//       privadas; que se cuelen en el Hangar de un cliente sería
//       regalar contenido que no se puede retirar.
//
//    3. Que cada perfil de familia esté aislado de los otros.
//
//    4. Que en admin esté todo abierto de verdad —misiones, chasis,
//       cosméticos— y que se pueda jugar la M10 sin haberla ganado.
//
//  Y lo de siempre: 0 excepciones, 0 peticiones fallidas.

import { servidor, cargarPlaywright } from "../qa.mjs";

const srv = await servidor();
const { chromium } = await cargarPlaywright();
const nav = await chromium.launch();

const fallos = [];
const comprobar = (ok, t, extra) => {
  console.log((ok ? "  ok    " : "  FALLO ") + t + (extra ? "   " + extra : ""));
  if (!ok) fallos.push(t);
};

// El save del jugador NORMAL: una partida a medias, con progreso,
// récord y economía. Es lo que hay que devolver intacto.
const SAVE_JUGADOR = {
  v: 2,
  campana: { misionMax: 3, misionIdx: 2, completada: false, stats: null,
             records: { 0: 12000, 1: 9000 }, temaId: "volcan" },
  perfil: { record: 45678, eloi: 1234, partidas: 27, misionesCompletadas: 4,
            jefesDerrotados: 3, tiempoJugado: 7200 },
  naves: { seleccionada: "chassis_02", desbloqueadas: ["chassis_01", "chassis_02"],
           config: { chassis_02: { skinId: "neon", customName: "MI NAVE" } } },
  opciones: { volMusica: 0.42 },
  meta: { creado: 1000, ultimoGuardado: 2000 },
};

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
  if (save) await p.evaluate((s) => localStorage.setItem("sf_save", JSON.stringify(s)), save);
  await p.reload({ waitUntil: "load" });
  await p.waitForTimeout(900);
  p.cerrar = () => ctx.close();
  return p;
}

// Todas las claves de localStorage que empiezan por sf_, con su
// contenido. Es la foto que se compara antes y después.
const foto = (p) => p.evaluate(() => {
  const o = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.indexOf("sf_") === 0) o[k] = localStorage.getItem(k);
  }
  return o;
});

// ════════════════════════════════════════════════════════════
console.log("\n1 · EL JUEGO NORMAL NO SE ENTERA DE QUE ADMIN EXISTE");
{
  const p = await abrir(SAVE_JUGADOR);
  const r = await p.evaluate(() => ({
    activo: ADMIN.activo(),
    clave: SAVE.clave(),
    espacio: SAVE.espacio(),
    esNormal: SAVE.esNormal(),
    naves: NAVES.map(n => n.id),
    founder: NAVES.filter(n => n.founder).length,
    // El catálogo COMPLETO también las tiene: existen, pero no se ven.
    enCatalogo: SHIPS.CHASIS.filter(c => c.legacyFounder).map(c => c.id),
  }));
  comprobar(!r.activo, "arranca en modo normal");
  comprobar(r.clave === "sf_save" && r.esNormal, "y escribiendo en sf_save", r.clave);
  comprobar(r.founder === 0, "la FOUNDER FLEET no está en el Hangar normal",
    r.naves.join(","));
  comprobar(r.enCatalogo.length === 4,
    "pero sí en el catálogo, marcada como privada", r.enCatalogo.join(","));
  comprobar(p.errs.length === 0, "sin errores", p.errs[0] || "");
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\n2 · EL PIN");
{
  const p = await abrir(SAVE_JUGADOR);
  const r = await p.evaluate(() => {
    const malo = ADMIN.entrar("0000", "eloi");
    const trasMalo = { activo: ADMIN.activo(), clave: SAVE.clave() };
    const bueno = ADMIN.entrar(ADMIN.PIN_FABRICA, "eloi");
    return { malo, trasMalo, bueno, clave: SAVE.clave(), perfil: ADMIN.perfilId() };
  });
  comprobar(r.malo === false, "un PIN incorrecto no abre nada");
  comprobar(!r.trasMalo.activo && r.trasMalo.clave === "sf_save",
    "y no cambia de espacio de guardado", r.trasMalo.clave);
  comprobar(r.bueno === true && r.clave === "sf_admin_eloi",
    "el correcto entra y cambia de clave", r.clave);
  comprobar(r.perfil === "eloi", "con el perfil pedido", r.perfil);
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\n3 · EL RECORRIDO COMPLETO: ENTRAR, JUGAR, SALIR");
{
  const p = await abrir(SAVE_JUGADOR);
  const antes = await foto(p);

  const r = await p.evaluate(async () => {
    // 1 · entrar
    ADMIN.entrar(ADMIN.PIN_FABRICA, "kali");
    await new Promise(r => requestAnimationFrame(r));
    const dentro = {
      clave: SAVE.clave(),
      misionMax,
      naves: NAVES.map(n => n.id),
      equipada: NAVES[naveSel] && NAVES[naveSel].id,
      bloqueadas: NAVES.filter(n => n.bloqueada).length,
    };

    // 2 · elegir KALI
    const iKali = NAVES.findIndex(n => n.id === "founder_kali");
    naveSel = iKali; nvIdx = -1; trIdx = -1; spIdx = -1;
    guardarNave();
    const kali = { i: iKali, ficha: (() => { const n = naveActual();
      return { arma: n.arma, vel: n.vel, dmg: n.dmg, hitbox: n.hitbox }; })() };

    // 3 · jugar la ÚLTIMA misión (M20 desde 5H; antes M10), que en
    //     normal está cerrada (misionMax era 3)
    misionIdx = MISIONES.length - 1;
    iniciarMision(MISIONES.length - 1);
    await new Promise(r => requestAnimationFrame(r));
    const jugando = { state, mision: misionIdx, nave: NAVES[naveSel].id };

    // 4 · personalizar
    SHIPS.guardarConfig("founder_kali", { skinId: "golden", trailId: "cosmico",
      emblemId: "wolf", customName: "LA DE KALI" });

    // 5 · ganar ELOI
    const eloiAntes = SAVE.get("perfil.eloi", 0);
    SAVE.sumar("perfil.eloi", 500);
    SAVE.subirRecord(999999);
    SAVE.ya("prueba admin");
    const eloiDentro = SAVE.get("perfil.eloi", 0);

    // 6 · salir
    state = "menu"; pantalla = "inicio";
    ADMIN.salir();
    await new Promise(r => requestAnimationFrame(r));

    return { dentro, kali, jugando, eloiAntes, eloiDentro,
      // 7 · vuelta a normal
      fuera: {
        activo: ADMIN.activo(),
        clave: SAVE.clave(),
        misionMax, best,
        eloi: SAVE.get("perfil.eloi", 0),
        record: SAVE.get("perfil.record", 0),
        equipada: NAVES[naveSel] && NAVES[naveSel].id,
        naves: NAVES.map(n => n.id),
        cfg: SHIPS.config("chassis_02"),
      } };
  });

  const despues = await foto(p);

  comprobar(r.dentro.clave === "sf_admin_kali", "1 · entra al espacio del perfil", r.dentro.clave);
  comprobar(r.dentro.naves.filter(x => x.startsWith("founder_")).length === 4,
    "    y aparece la FOUNDER FLEET", r.dentro.naves.join(","));
  comprobar(r.dentro.bloqueadas === 0, "    sin ninguna nave bloqueada",
    r.dentro.bloqueadas + " bloqueadas");
  // 19 desde el bloque 5H: `MISIONES.length - 1` con las 20 misiones ya
  // en la tabla (antes era 9, con solo 10).
  comprobar(r.dentro.misionMax === 19, "    y con la campaña abierta entera (10 + 10 de la expansión)",
    "misionMax " + r.dentro.misionMax);
  comprobar(r.kali.i >= 0 && r.kali.ficha.dmg === 1.38 && r.kali.ficha.arma === "cannon",
    "2 · KALI se puede equipar y conserva su ficha original",
    `dmg ${r.kali.ficha.dmg} · ${r.kali.ficha.arma}`);
  comprobar(r.jugando.state === "play" && r.jugando.mision === 19,
    "3 · se juega la última misión (M20) sin haberla desbloqueado en normal",
    "M" + (r.jugando.mision + 1));
  comprobar(r.eloiDentro === r.eloiAntes + 500, "5 · el ELOI de admin sube en su propio save",
    r.eloiAntes + " → " + r.eloiDentro);
  comprobar(!r.fuera.activo && r.fuera.clave === "sf_save",
    "6 · salir devuelve a sf_save", r.fuera.clave);

  // ── Lo que de verdad importa ──
  comprobar(antes["sf_save"] === despues["sf_save"],
    "★ el save del jugador es EL MISMO TEXTO, byte a byte");
  comprobar(r.fuera.misionMax === 3, "    misión máxima intacta", "M" + (r.fuera.misionMax + 1));
  comprobar(r.fuera.eloi === 1234, "    ELOI intacto", r.fuera.eloi + "");
  comprobar(r.fuera.record === 45678 && r.fuera.best === 45678,
    "    récord intacto", r.fuera.record + "");
  comprobar(r.fuera.equipada === "chassis_02", "    nave intacta", r.fuera.equipada);
  comprobar(r.fuera.cfg.customName === "MI NAVE" && r.fuera.cfg.skinId === "neon",
    "    y su personalización", r.fuera.cfg.customName);
  comprobar(r.fuera.naves.filter(x => x.startsWith("founder_")).length === 0,
    "    la FOUNDER FLEET vuelve a desaparecer");
  comprobar(despues["sf_admin_kali"] && despues["sf_admin_kali"].indexOf("founder_kali") >= 0,
    "    y lo de admin quedó guardado en SU clave");
  comprobar(p.errs.length === 0, "sin errores", p.errs[0] || "");
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\n4 · VOLVER A ENTRAR: EL PERFIL PERSISTE");
{
  const p = await abrir(SAVE_JUGADOR);
  const r = await p.evaluate(async () => {
    ADMIN.entrar(ADMIN.PIN_FABRICA, "kali");
    SHIPS.guardarConfig("founder_kali", { skinId: "shadow", customName: "KALIBRE" });
    const iKali = NAVES.findIndex(n => n.id === "founder_kali");
    naveSel = iKali; guardarNave();
    SAVE.sumar("perfil.eloi", 777);
    SAVE.ya("prueba");
    ADMIN.salir();
    await new Promise(r => requestAnimationFrame(r));
    ADMIN.entrar(ADMIN.PIN_FABRICA, "kali");
    await new Promise(r => requestAnimationFrame(r));
    return {
      equipada: NAVES[naveSel] && NAVES[naveSel].id,
      cfg: SHIPS.config("founder_kali"),
      eloi: SAVE.get("perfil.eloi", 0),
      clave: SAVE.clave(),
    };
  });
  comprobar(r.clave === "sf_admin_kali", "vuelve al mismo espacio", r.clave);
  comprobar(r.equipada === "founder_kali", "con su nave puesta", r.equipada);
  comprobar(r.cfg.customName === "KALIBRE" && r.cfg.skinId === "shadow",
    "y su personalización", r.cfg.customName + " / " + r.cfg.skinId);
  comprobar(r.eloi === 777, "y su ELOI de admin", r.eloi + "");
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\n5 · LOS CUATRO PERFILES ESTÁN AISLADOS ENTRE SÍ");
{
  const p = await abrir(SAVE_JUGADOR);
  const r = await p.evaluate(async () => {
    ADMIN.entrar(ADMIN.PIN_FABRICA, "kali");
    const claves = [];
    // A cada uno se le pone algo distinto y suyo.
    for (const id of ["kali", "yoli", "silvia", "eloi"]) {
      ADMIN.cambiarPerfil(id);
      claves.push(SAVE.clave());
      SAVE.set("perfil.eloi", { kali: 10, yoli: 20, silvia: 30, eloi: 40 }[id], "prueba");
      SHIPS.guardarConfig("founder_" + id, { customName: id.toUpperCase() + "-X" });
      SAVE.ya("prueba");
    }
    // Y se vuelve a leer todo, uno por uno.
    const leido = {};
    for (const id of ["kali", "yoli", "silvia", "eloi"]) {
      ADMIN.cambiarPerfil(id);
      await new Promise(r => requestAnimationFrame(r));
      leido[id] = {
        eloi: SAVE.get("perfil.eloi", 0),
        nombre: SHIPS.config("founder_" + id).customName,
        clave: SAVE.clave(),
      };
    }
    ADMIN.salir();
    return { claves, leido };
  });
  comprobar(new Set(r.claves).size === 4, "cada perfil tiene su propia clave",
    r.claves.join(" "));
  const ok = r.leido.kali.eloi === 10 && r.leido.yoli.eloi === 20 &&
             r.leido.silvia.eloi === 30 && r.leido.eloi.eloi === 40;
  comprobar(ok, "y su propia economía",
    Object.entries(r.leido).map(([k, v]) => k + ":" + v.eloi).join(" "));
  comprobar(Object.entries(r.leido).every(([k, v]) => v.nombre === k.toUpperCase() + "-X"),
    "y su propia personalización",
    Object.values(r.leido).map(v => v.nombre).join(" "));
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\n6 · NI UNA ESCRITURA DE ADMIN EN EL SAVE NORMAL");
{
  // La prueba 3 compara el texto al final. Ésta vigila el proceso: se
  // marca `sf_save` con un centinela y se comprueba que sigue ahí
  // después de una sesión de admin que escribe todo lo que puede.
  const p = await abrir(SAVE_JUGADOR);
  const r = await p.evaluate(async () => {
    const centinela = localStorage.getItem("sf_save");
    ADMIN.entrar(ADMIN.PIN_FABRICA, "silvia");
    // Todo lo que el juego escribe durante una partida.
    SAVE.set("campana.temaId", "hielo", "prueba");
    SAVE.set("campana.misionIdx", 7, "prueba");
    SAVE.subirRecord(888888);
    SAVE.subirRecordMision(9, 555555);
    SAVE.subirMision(9);
    SAVE.sumar("perfil.partidas", 5);
    SAVE.sumar("perfil.jefesDerrotados", 9);
    SAVE.sumar("perfil.tiempoJugado", 1234);
    SAVE.set("opciones", { volMusica: 0.1 }, "prueba");
    SHIPS.desbloquear("chassis_05");
    SAVE.ya("prueba");
    // Y un guardado con autoguardado PENDIENTE al salir, que es la
    // forma tonta de contaminar: el freno del autoguardado tiene hasta
    // 400 ms de retraso, y si se dispara después del cambio de espacio
    // escribe el dato del espacio viejo con la clave del nuevo.
    SAVE.set("perfil.eloi", 99999, "sucio a propósito");
    ADMIN.salir();
    await new Promise(r => requestAnimationFrame(r));
    await new Promise(r => setTimeout(r, 900));
    return {
      intacto: localStorage.getItem("sf_save") === centinela,
      eloiNormal: SAVE.get("perfil.eloi", 0),
      misionMaxNormal: SAVE.get("campana.misionMax", 0),
      recordNormal: SAVE.get("perfil.record", 0),
      temaNormal: SAVE.get("campana.temaId", ""),
      opcionNormal: SAVE.get("opciones", {}).volMusica,
      desbloqueadasNormal: SAVE.get("naves.desbloqueadas", []).join(","),
      // Y lo escrito sigue en el save de admin, que es donde tenía que ir.
      enAdmin: JSON.parse(localStorage.getItem("sf_admin_silvia") || "{}"),
    };
  });
  comprobar(r.intacto, "★ sf_save no ha cambiado ni un carácter");
  comprobar(r.eloiNormal === 1234, "el ELOI normal sigue en 1234", r.eloiNormal + "");
  comprobar(r.misionMaxNormal === 3, "y su progreso en la M4", "misionMax " + r.misionMaxNormal);
  comprobar(r.recordNormal === 45678, "y su récord", r.recordNormal + "");
  comprobar(r.temaNormal === "volcan", "y su mundo", r.temaNormal);
  comprobar(r.opcionNormal === 0.42, "y sus ajustes", r.opcionNormal + "");
  comprobar(r.desbloqueadasNormal === "chassis_01,chassis_02",
    "y sus naves desbloqueadas", r.desbloqueadasNormal);
  comprobar(r.enAdmin.perfil && r.enAdmin.perfil.eloi === 99999,
    "y lo de admin sí quedó escrito, en sf_admin_silvia",
    r.enAdmin.perfil ? r.enAdmin.perfil.eloi + "" : "nada");
  comprobar(p.errs.length === 0, "sin errores", p.errs[0] || "");
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\n7 · UN PERFIL NUEVO NO HEREDA NADA DEL JUGADOR");
{
  // El rescate de las claves antiguas (`sf_record`, `sf_nave`…) es la
  // forma menos evidente de contaminar: un espacio de admin vacío se
  // habría rellenado con el progreso del jugador y todo parecería bien.
  const p = await abrir(null);
  const r = await p.evaluate(async () => {
    localStorage.setItem("sf_record", "777777");
    localStorage.setItem("sf_misionIdx", "9");
    localStorage.setItem("sf_nave", "silvia");
    localStorage.removeItem("sf_admin_yoli");
    ADMIN.entrar(ADMIN.PIN_FABRICA, "yoli");
    await new Promise(r => requestAnimationFrame(r));
    return { record: SAVE.get("perfil.record", 0), clave: SAVE.clave(),
             equipada: NAVES[naveSel] && NAVES[naveSel].id };
  });
  comprobar(r.clave === "sf_admin_yoli", "el perfil nuevo estrena su clave", r.clave);
  comprobar(r.record === 0, "y NO hereda el récord de las claves antiguas", r.record + "");
  comprobar(r.equipada === "founder_yoli", "arranca con su nave", r.equipada);
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\n8 · TODO ABIERTO, Y NADA QUE PAGAR");
{
  const p = await abrir(SAVE_JUGADOR);
  const r = await p.evaluate(async () => {
    const normal = { puedeGastar: ADMIN.puedeGastar(), excluido: ADMIN.excluido() };
    ADMIN.entrar(ADMIN.PIN_FABRICA, "eloi");
    await new Promise(r => requestAnimationFrame(r));
    state = "menu"; pantalla = "campana";
    for (let i = 0; i < 3; i++) await new Promise(r => requestAnimationFrame(r));
    // Ninguna tarjeta de misión puede estar apagada.
    const misionesCerradas = MISIONES.filter((m, i) => !ADMIN.misionAbierta(i, 0)).length;
    return {
      normal,
      admin: { puedeGastar: ADMIN.puedeGastar(), excluido: ADMIN.excluido() },
      misionesCerradas,
      chasisCerrados: NAVES.filter(n => n.bloqueada).map(n => n.id),
      naves: NAVES.length,
      // Los cosméticos: ni uno con requisito.
      skins: SHIPS.SKINS.length, trails: SHIPS.TRAILS.length,
      emblemas: SHIPS.EMBLEMAS.length,
      cosmeticoLibre: ADMIN.cosmeticoLibre(),
      // El desbloqueo NO escribe la founder fleet en el save de nadie.
      desbloqueadas: SAVE.get("naves.desbloqueadas", []).join(","),
    };
  });
  comprobar(r.normal.puedeGastar && !r.normal.excluido,
    "en normal se puede cobrar y se cuenta para estadísticas");
  comprobar(!r.admin.puedeGastar && r.admin.excluido,
    "en admin no se cobra y queda excluido de todo lo comercial");
  comprobar(r.misionesCerradas === 0, "las 20 misiones abiertas", r.misionesCerradas + " cerradas");
  comprobar(r.chasisCerrados.length === 0, "y los 9 chasis", r.chasisCerrados.join(",") || "ninguno cerrado");
  comprobar(r.naves === 9, "cinco normales + cuatro founder", r.naves + " naves");
  comprobar(r.cosmeticoLibre, "cosméticos sin requisitos");
  comprobar(r.desbloqueadas.indexOf("founder_") < 0,
    "y la founder fleet NO se escribe en naves.desbloqueadas", r.desbloqueadas);
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\n9 · EL SELECTOR DE JEFE");
{
  const p = await abrir(SAVE_JUGADOR);
  const r = await p.evaluate(async () => {
    ADMIN.entrar(ADMIN.PIN_FABRICA, "eloi");
    state = "menu"; pantalla = "admin";
    ADMIN.ir("jefes");
    for (let i = 0; i < 3; i++) await new Promise(r => requestAnimationFrame(r));
    const botonesJefes = botones.length;
    // Salto al jefe de la ÚLTIMA misión (M20 desde 5H).
    irAJefe(MISIONES.length - 1);
    for (let i = 0; i < 40; i++) await new Promise(r => requestAnimationFrame(r));
    return {
      botonesJefes,
      state, mision: misionIdx,
      // El jefe tiene que haber aparecido, no quedarse esperando.
      hayJefe: !!miniboss,
      jefe: miniboss ? miniboss.tipo : null,
      // Y el reloj tiene que estar en el tramo del jefe, no en 0.
      t: Math.round(elapsed),
    };
  });
  comprobar(r.botonesJefes >= 21, "la lista dibuja las 20 misiones y el volver",
    r.botonesJefes + " botones");
  comprobar(r.state === "play" && r.mision === 19, "salta a la última misión (M20)", "M" + (r.mision + 1));
  comprobar(r.hayJefe, "y el jefe aparece de verdad", r.jefe || "no hay");
  comprobar(r.t > 100, "con el reloj ya en su tramo", r.t + "s");
  comprobar(p.errs.length === 0, "sin errores", p.errs[0] || "");
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\n10 · LA PUERTA OCULTA DE LOS AJUSTES");
{
  const p = await abrir(SAVE_JUGADOR);
  const r = await p.evaluate(async () => {
    state = "menu"; pantalla = "ajustes";
    for (let i = 0; i < 3; i++) await new Promise(r => requestAnimationFrame(r));
    // El botón invisible está donde el rótulo PROGRESO: se localiza por
    // ser el único con 96 de ancho y 26 de alto.
    const puerta = botones.filter(b => b.w === 96 && b.h === 26);
    // Cuatro toques no abren nada.
    let pedido = 0;
    const orig = window.prompt;
    window.prompt = () => { pedido++; return null; };
    for (let i = 0; i < 4; i++) puerta[0].fn();
    const trasCuatro = pedido;
    puerta[0].fn();                       // el quinto
    const trasCinco = pedido;
    window.prompt = orig;
    return { puertas: puerta.length, trasCuatro, trasCinco, activo: ADMIN.activo() };
  });
  comprobar(r.puertas === 1, "hay exactamente una puerta, y es invisible", r.puertas + "");
  comprobar(r.trasCuatro === 0, "cuatro toques no piden el PIN");
  comprobar(r.trasCinco === 1, "el quinto sí");
  comprobar(!r.activo, "y cancelar el PIN no entra en admin");
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\n11 · SE VE QUE ESTÁS EN ADMIN");
{
  const p = await abrir(SAVE_JUGADOR);
  const r = await p.evaluate(async () => {
    // Se cuenta cuántas veces el distintivo dice HABER PINTADO, no cómo
    // quedan los píxeles. Leer el lienzo por tu cuenta devuelve lo que
    // hay en el búfer en ese instante, que no siempre es el fotograma
    // que se ve, y comparar PNG comprimidos no distingue un cartel de
    // una estrella que se ha movido. `indicador()` devuelve si ha
    // dibujado, así que la respuesta viene del propio código que dibuja.
    //
    // Y de paso comprueba lo que de verdad se quiere: que esté
    // enganchado en el menú Y en partida, que son dos sitios distintos.
    let pintados = 0;
    const orig = ADMIN.indicador;
    ADMIN.indicador = function (G) {
      const r = orig.call(ADMIN, G);
      if (r) pintados++;
      return r;
    };
    const pintar = async () => {
      pintados = 0;
      for (let i = 0; i < 3; i++) await new Promise(r => requestAnimationFrame(r));
      return pintados;
    };

    state = "menu"; pantalla = "inicio";
    const menuNormal = await pintar();
    misionIdx = 0; iniciarMision(0);
    const juegoNormal = await pintar();

    state = "menu";
    ADMIN.entrar(ADMIN.PIN_FABRICA, "silvia");
    pantalla = "inicio";
    const menuAdmin = await pintar();
    misionIdx = 0; iniciarMision(0);
    const juegoAdmin = await pintar();
    const etiqueta = ADMIN.etiqueta();
    const color = ADMIN.color();

    state = "menu"; pantalla = "inicio";
    ADMIN.salir();
    const menuTrasSalir = await pintar();

    ADMIN.indicador = orig;
    return { menuNormal, juegoNormal, menuAdmin, juegoAdmin, menuTrasSalir,
             etiqueta, color };
  });
  comprobar(r.menuNormal === 0 && r.juegoNormal === 0,
    "en modo normal no se pinta nunca",
    "menú " + r.menuNormal + " · partida " + r.juegoNormal);
  comprobar(r.menuAdmin >= 3, "en admin se pinta en el menú, todos los fotogramas",
    r.menuAdmin + " de 3");
  comprobar(r.juegoAdmin >= 3, "y en partida, que es donde de verdad importa",
    r.juegoAdmin + " de 3");
  comprobar(r.menuTrasSalir === 0, "y al salir desaparece", r.menuTrasSalir + "");
  comprobar(/ADMIN \/ FAMILY .* SILVIA/.test(r.etiqueta),
    "dice qué perfil es", r.etiqueta);
  comprobar(r.color === "#c77dff", "y lleva el color del perfil", r.color);
  comprobar(p.errs.length === 0, "sin errores", p.errs[0] || "");
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\n12 · EL ARTE DE LA FOUNDER FLEET");
{
  // Los cuatro PNG originales son medio mega. NO se cargan en el juego
  // normal —un jugador no los va a ver nunca— y sí en cuanto se entra en
  // admin. Si esto falla no salta ningún error: las naves simplemente se
  // dibujan en vectorial y parecen otra cosa.
  const p = await abrir(SAVE_JUGADOR);
  const r = await p.evaluate(async () => {
    const IDS = ["founder_kali", "founder_yoli", "founder_silvia", "founder_eloi"];
    const cargados = () => IDS.filter(id => !!SPRITES[id]).length;
    const enNormal = cargados();
    ADMIN.entrar(ADMIN.PIN_FABRICA, "eloi");
    // Los PNG llegan por red: hay que dejarles llegar.
    for (let i = 0; i < 60; i++) await new Promise(r => requestAnimationFrame(r));
    const enAdmin = cargados();
    const medidas = IDS.map(id => {
      const sp = SPRITES[id];
      return sp ? (sp.width || sp.naturalWidth) + "x" + (sp.height || sp.naturalHeight) : "—";
    });
    // Y el que se dibuja es el suyo, no el de un chasis normal.
    naveSel = NAVES.findIndex(n => n.id === "founder_kali");
    nvIdx = -1; trIdx = -1; spIdx = -1;
    await new Promise(r => requestAnimationFrame(r));
    const usado = spriteNave();
    return { enNormal, enAdmin, medidas,
             esElSuyo: usado === SPRITES["founder_kali"],
             hayAlguno: !!usado };
  });
  comprobar(r.enNormal === 0, "en normal no se descarga ni uno", r.enNormal + " de 4");
  comprobar(r.enAdmin === 4, "al entrar en admin se cargan los cuatro",
    r.medidas.join(" "));
  comprobar(r.hayAlguno && r.esElSuyo,
    "y KALI se dibuja con SU sprite original");
  comprobar(p.errs.length === 0, "sin errores", p.errs[0] || "");
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\n13 · CAPTURAS");
{
  const p = await abrir(SAVE_JUGADOR);
  await p.evaluate(async () => {
    ADMIN.entrar(ADMIN.PIN_FABRICA, "kali");
    state = "menu"; pantalla = "admin"; ADMIN.ir("menu");
  });
  await p.waitForTimeout(400);
  await p.screenshot({ path: "artifacts/screenshots/admin/admin-menu.png" });
  await p.evaluate(() => ADMIN.ir("jefes"));
  await p.waitForTimeout(300);
  await p.screenshot({ path: "artifacts/screenshots/admin/admin-jefes.png" });
  await p.evaluate(() => { ADMIN.ir("menu"); pantalla = "naves"; HANGAR.ir("chasis"); });
  await p.waitForTimeout(400);
  await p.screenshot({ path: "artifacts/screenshots/admin/admin-hangar.png" });
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
