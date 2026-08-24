// ════════════════════════════════════════════════════════════
//  naves.mjs — catálogo de chasis, alias legacy y fichas
// ════════════════════════════════════════════════════════════
//
//    node herramientas/pruebas/naves.mjs
//
//  Lo que se vigila aquí:
//
//    · Que un save con "kali" siga jugando con la MISMA nave. Es el
//      riesgo crítico del bloque: si el alias falla, todo el mundo
//      despierta con otra nave y no hay forma de darse cuenta mirando
//      una consola.
//    · Que las fichas heredadas sean IDÉNTICAS, número a número, a las
//      que tenía cada nave legacy. Un 0,86 que se convierte en 0,9 no da
//      ningún error: solo hace el juego distinto.
//    · Que `eloi` la MONEDA siga existiendo mientras `eloi` la NAVE pasa
//      a ser chassis_04. Es la colisión de nombres que puede romper la
//      economía sin avisar.
//    · Que la escala de render NO toque la hitbox.

import { servidor, cargarPlaywright } from "../qa.mjs";

const srv = await servidor();
const { chromium } = await cargarPlaywright();
const nav = await chromium.launch();

const fallos = [];
const comprobar = (ok, t, extra) => {
  console.log((ok ? "  ok    " : "  FALLO ") + t + (extra ? "   " + extra : ""));
  if (!ok) fallos.push(t);
};

// Las fichas que tenían las naves ANTES de este bloque. Es la referencia
// contra la que se compara: si algún número se mueve, esto lo caza.
const LEGACY = {
  kali:   { arma: "cannon",    vel: 0.86, cad: 1.14, dmg: 1.38, hitbox: 1.10, escudo: 0 },
  yoli:   { arma: "rapid",     vel: 1.32, cad: 0.88, dmg: 0.82, hitbox: 0.78, escudo: 0 },
  silvia: { arma: "electrico", vel: 1.08, cad: 0.96, dmg: 1.00, hitbox: 0.84, escudo: 1 },
  eloi:   { arma: "fuego",     vel: 1.10, cad: 0.82, dmg: 1.20, hitbox: 1.25, escudo: 0 },
  clasica:{ arma: "cannon",    vel: 1.00, cad: 1.00, dmg: 1.00, hitbox: 1.00, escudo: 0 },
};
const MAPA = { yoli: "chassis_01", kali: "chassis_02", silvia: "chassis_03", eloi: "chassis_04" };

// Semilla de save. Se pasa como FUNCIÓN con argumento: `p.evaluate` con
// una cadena `() => ...` solo evalúa la expresión y NUNCA la llama, así
// que la semilla no se escribiría y la prueba mediría otra cosa.
const semilla = (o) => localStorage.setItem("sf_save", JSON.stringify({
  v: 2,
  campana: { misionMax: o.misionMax ?? 5, misionIdx: 0, completada: false,
             stats: null, records: {}, temaId: "espacio" },
  perfil: { record: o.record ?? 4242, eloi: o.eloi ?? 777, partidas: 3,
            misionesCompletadas: 5, jefesDerrotados: 5, tiempoJugado: 900 },
  naves: { seleccionada: o.nave, desbloqueadas: o.desbloqueadas ?? [], config: o.config ?? {} },
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
  if (arg) {
    await p.goto(srv.url + "/index.html", { waitUntil: "commit" });
    await p.evaluate(semilla, arg);
    await p.reload({ waitUntil: "load" });
  } else {
    await p.goto(srv.url + "?debug", { waitUntil: "load" });
  }
  await p.waitForTimeout(900);
  p.cerrar = () => ctx.close();
  return p;
}

// ════════════════════════════════════════════════════════════
console.log("\n1 · CATÁLOGO");
{
  const p = await abrir();
  const r = await p.evaluate(() => ({
    chasis: SHIPS.CHASIS.map(c => ({
      id: c.id, legacy: c.legacy, modelo: c.modelo, clase: c.clase,
      escala: c.escala, requiere: c.requiere,
      legado: !!c.legado, provisional: !!c.fichaProvisional,
    })),
    alias: SHIPS.ALIAS,
  }));
  for (const c of r.chasis) {
    console.log(`        ${c.id.padEnd(11)} ${(c.legacy || "—").padEnd(8)} ` +
      `${c.modelo.padEnd(18)} ${c.clase.padEnd(12)} esc ${c.escala.toFixed(2)} ` +
      `req ${c.requiere === null ? "—" : "M" + c.requiere}` +
      (c.provisional ? "  [provisional]" : "") + (c.legado ? "  [legado]" : ""));
  }
  const nuevos = r.chasis.filter(c => c.id.startsWith("chassis_"));
  comprobar(nuevos.length === 5, "hay 5 chasis", nuevos.length + "");
  comprobar(nuevos.every(c => /^chassis_0[1-5]$/.test(c.id)),
    "los ids son chassis_01..05", nuevos.map(c => c.id).join(" "));
  comprobar(nuevos.every(c => c.modelo && c.clase && c.modelo !== c.id),
    "modelo visible y clase, separados del id técnico");
  const nova = r.chasis.find(c => c.id === "chassis_05");
  comprobar(nova.legacy === null, "NOVA no tiene legacy");
  // `requiere` cuenta MISIONES COMPLETADAS, no índices: la M10 son diez.
  comprobar(nova.requiere === 10, "NOVA se desbloquea con la M10", "requiere=" + nova.requiere);
  const calendario = r.chasis.filter(c => c.requiere != null)
    .map(c => c.id + ":M" + c.requiere).join(" ");
  comprobar(calendario === "chassis_02:M2 chassis_03:M5 chassis_04:M8 chassis_05:M10",
    "y el calendario completo es el acordado", calendario);
  comprobar(nova.provisional, "y su ficha está marcada como provisional");
  comprobar(Object.keys(r.alias).length === 4, "hay 4 alias legacy",
    Object.keys(r.alias).join(", "));
  comprobar(p.errs.length === 0, "sin errores", p.errs.slice(0, 2).join(" | "));
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\n2 · FICHAS HEREDADAS, NÚMERO A NÚMERO");
{
  const p = await abrir();
  const r = await p.evaluate(() => {
    const out = {};
    for (const c of SHIPS.CHASIS) out[c.id] = c.juego;
    return out;
  });
  for (const [legacy, chasis] of Object.entries(MAPA)) {
    const esp = LEGACY[legacy], real = r[chasis];
    const dif = Object.keys(esp).filter(k => esp[k] !== real[k])
      .map(k => `${k}: ${esp[k]}→${real[k]}`);
    comprobar(dif.length === 0, `${chasis} hereda la ficha exacta de ${legacy.toUpperCase()}`,
      dif.length ? dif.join(", ")
        : `vel ${real.vel} cad ${real.cad} dmg ${real.dmg} hb ${real.hitbox} esc ${real.escudo} ${real.arma}`);
  }
  const cl = r["clasica"];
  comprobar(Object.keys(LEGACY.clasica).every(k => LEGACY.clasica[k] === cl[k]),
    "CLÁSICA se conserva intacta");
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\n3 · UN SAVE VIEJO SIGUE JUGANDO CON SU MISMA NAVE");
{
  for (const [legacy, chasis] of Object.entries(MAPA)) {
    const p = await abrir({ nave: legacy });
    const r = await p.evaluate(() => {
      const nv = naveActual();
      return {
        id: NAVES[naveSel].id, modelo: NAVES[naveSel].nombre,
        juego: { arma: nv.arma, vel: nv.vel, cad: nv.cad, dmg: nv.dmg,
                 hitbox: nv.hitbox, escudo: nv.escudo },
        hitR: +hitR().toFixed(2),
        guardado: JSON.parse(localStorage.getItem("sf_save")).naves.seleccionada,
        eloi: SAVE.get("perfil.eloi"), record: SAVE.get("perfil.record"),
      };
    });
    const esp = LEGACY[legacy];
    const dif = Object.keys(esp).filter(k => esp[k] !== r.juego[k]);
    console.log(`        "${legacy}" → ${r.id} · ${r.modelo} · hitR ${r.hitR}`);
    comprobar(r.id === chasis, `"${legacy}" se resuelve a ${chasis}`, r.id);
    comprobar(dif.length === 0, "y con la ficha idéntica",
      dif.length ? dif.join(",") : `vel ${r.juego.vel} hb ${r.juego.hitbox} ${r.juego.arma}`);
    comprobar(r.guardado === legacy,
      `el save NO se reescribe: sigue diciendo "${legacy}"`, r.guardado);
    comprobar(r.eloi === 777 && r.record === 4242, "y el resto del progreso intacto",
      "eloi=" + r.eloi + " récord=" + r.record);
    await p.cerrar();
  }
}

// ════════════════════════════════════════════════════════════
console.log("\n4 · LA MONEDA `eloi` SOBREVIVE AL RENOMBRADO DE LA NAVE");
{
  const p = await abrir({ nave: "eloi", eloi: 5150 });
  const r = await p.evaluate(async () => {
    const antes = SAVE.get("perfil.eloi");
    modo = "campana"; iniciarMision(0);
    await new Promise(r => setTimeout(r, 300));
    misionIniT = 0; enemies.length = 0; eBullets.length = 0;
    score = 2000; cerrarMision();
    return { antes, despues: SAVE.get("perfil.eloi"),
             ganados: resultado.eloi, nave: NAVES[naveSel].id };
  });
  comprobar(r.antes === 5150, "la moneda se lee del save", r.antes + " ELOI");
  comprobar(r.ganados > 0 && r.despues === r.antes + r.ganados,
    "y sigue acumulándose al completar misión",
    `${r.antes} + ${r.ganados} = ${r.despues}`);
  comprobar(r.nave === "chassis_04",
    'mientras la NAVE "eloi" es ahora chassis_04', r.nave);
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\n5 · NOVA REGISTRADA Y BLOQUEADA");
{
  // Save con la M6 superada: es donde el calendario se ve mejor —tres
  // chasis concedidos, dos aún no— y donde NOVA sigue bloqueada, que es
  // lo que mide esta sección.
  const p = await abrir({ nave: "chassis_01", misionMax: 5 });
  const r = await p.evaluate(async () => {
    state = "menu"; pantalla = "naves";
    for (let i = 0; i < 3; i++) await new Promise(r => requestAnimationFrame(r));
    const i5 = NAVES.findIndex(n => n.id === "chassis_05");
    const antes = naveSel;
    const rect = naveRects.find(x => x.i === i5);
    let tocada = false;
    if (rect) {
      const btn = botones.find(x => x.x === rect.x && x.y === rect.y && x.fn);
      if (btn) { btn.fn(); tocada = true; }
    }
    await new Promise(r => requestAnimationFrame(r));
    return {
      existe: i5 >= 0, bloqueada: i5 >= 0 ? NAVES[i5].bloqueada : null,
      tocada, cambio: naveSel !== antes, aviso, avisoActivo: avisoT > 0,
      sinLista: SHIPS.disponible("chassis_05", []),
      conLista: SHIPS.disponible("chassis_05", ["chassis_05"]),
      // Con la M6 superada (misionMax 5) el calendario dice: 01, 02 y 03
      // libres, 04 todavía no. Comprobar "los otros cuatro libres" ya no
      // vale: desde 4D los chasis se ganan.
      libres: NAVES.filter(n => !n.bloqueada).map(n => n.id).join(","),
    };
  });
  comprobar(r.existe, "NOVA está en el catálogo");
  comprobar(r.bloqueada === true, "y sale BLOQUEADA");
  comprobar(r.tocada && !r.cambio, "tocarla no la equipa");
  comprobar(r.avisoActivo && /M10/.test(r.aviso), "y explica cómo se consigue", r.aviso);
  comprobar(!r.sinLista && r.conLista, "la disponibilidad la decide naves.desbloqueadas");
  comprobar(r.libres === "chassis_01,chassis_02,chassis_03",
    "el calendario de desbloqueo se respeta con la M6 superada", r.libres);
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\n6 · DESBLOQUEAR NOVA Y EQUIPARLA");
{
  const p = await abrir();
  const r = await p.evaluate(async () => {
    const nuevo = SHIPS.desbloquear("chassis_05");
    NAVES = SHIPS.construir("chassis_05", SAVE.get("naves.desbloqueadas", []));
    nvIdx = -1;
    naveSel = NAVES.findIndex(n => n.id === "chassis_05");
    guardarNave(); SAVE.ya();
    await new Promise(r => requestAnimationFrame(r));
    const nv = naveActual();
    return {
      nuevo, lista: SAVE.get("naves.desbloqueadas", []),
      guardada: SAVE.get("naves.seleccionada"),
      bloqueada: NAVES[naveSel].bloqueada,
      ficha: { vel: nv.vel, cad: nv.cad, dmg: nv.dmg, hitbox: nv.hitbox,
               escudo: nv.escudo, arma: nv.arma },
      repetido: SHIPS.desbloquear("chassis_05"),
      // Ya no se compara contra 1: la concesión retroactiva del arranque
      // ha metido las que tocaban por progreso. Lo que se vigila es que
      // volver a desbloquear NO añada una segunda entrada.
      apariciones: SAVE.get("naves.desbloqueadas", []).filter(x => x === "chassis_05").length,
    };
  });
  comprobar(r.nuevo && r.lista.includes("chassis_05"),
    "se guarda en naves.desbloqueadas", r.lista.join(","));
  comprobar(r.guardada === "chassis_05", "se equipa con el id nuevo", r.guardada);
  comprobar(r.bloqueada === false, "y deja de estar bloqueada");
  comprobar(r.repetido === false && r.apariciones === 1,
    "desbloquear dos veces no duplica ni vuelve a avisar", r.apariciones + " entrada");
  const neutra = r.ficha.vel === 1 && r.ficha.cad === 1 && r.ficha.dmg === 1 &&
                 r.ficha.hitbox === 1 && r.ficha.escudo === 0 && r.ficha.arma === "cannon";
  comprobar(neutra, "NOVA usa la ficha neutra provisional documentada",
    `vel ${r.ficha.vel} cad ${r.ficha.cad} dmg ${r.ficha.dmg} hb ${r.ficha.hitbox}`);
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\n7 · ESCALA DE RENDER: NO TOCA LA HITBOX");
{
  // Con progreso completo: abierto en limpio solo hay un chasis
  // desbloqueado y no habría escalas que comparar.
  const p = await abrir({ nave: "chassis_01", misionMax: 9 });
  const r = await p.evaluate(async () => {
    const out = [];
    for (let i = 0; i < NAVES.length; i++) {
      if (NAVES[i].bloqueada) continue;
      naveSel = i; nvIdx = -1;
      const nv = naveActual();
      const sp = SPRITES[NAVES[i].id];
      let ancho = 0, alto = 0;
      if (sp) {
        const iw = sp.width || sp.naturalWidth, ih = sp.height || sp.naturalHeight;
        ancho = 16 * CONFIG.tamanoNave * (nv.escala || 1);
        alto = ancho * ih / iw;
      }
      out.push({ id: NAVES[i].id, escala: nv.escala,
                 ancho: +ancho.toFixed(1), alto: +alto.toFixed(1),
                 hitR: +hitR().toFixed(2), hitbox: nv.hitbox });
    }
    return out;
  });
  for (const x of r) {
    console.log(`        ${x.id.padEnd(12)} esc ${(x.escala || 1).toFixed(2)} · ` +
      `dibujada ${x.ancho}×${x.alto} px · hitbox ${x.hitbox} → radio ${x.hitR}`);
  }
  comprobar(r.every(x => Math.abs(x.hitR - 16 * 0.66 * x.hitbox) < 0.01),
    "el radio de hitbox sale SOLO de nave.hitbox");
  comprobar(new Set(r.map(x => x.escala)).size > 1,
    "y las escalas de render son distintas entre chasis",
    r.map(x => x.escala).join(" "));
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\n8 · SAVE NUEVO Y CICLO DE JUEGO");
{
  const p = await abrir();
  const r = await p.evaluate(async () => {
    const inicial = { id: NAVES[naveSel].id, guardado: SAVE.get("naves.seleccionada") };
    naveSel = NAVES.findIndex(n => n.id === "chassis_03"); nvIdx = -1;
    guardarNave(); SAVE.ya();
    modo = "campana"; iniciarMision(0);
    await new Promise(r => setTimeout(r, 300));
    misionIniT = 0; enemies.length = 0; eBullets.length = 0;
    const enMision = { escudo, armaId, id: NAVES[naveSel].id };
    lives = 1; invulnT = 0; golpe(player.x, player.y - 20);
    await new Promise(r => setTimeout(r, 700));
    iniciarMision(0);
    await new Promise(r => setTimeout(r, 300));
    return { inicial, enMision,
             tras: { escudo, armaId, id: NAVES[naveSel].id },
             guardado: SAVE.get("naves.seleccionada") };
  });
  comprobar(r.inicial.id === "chassis_01" && r.inicial.guardado === "chassis_01",
    "un save nuevo arranca en chassis_01", r.inicial.id);
  comprobar(r.enMision.id === "chassis_03" && r.enMision.escudo === 1,
    "AEGIS entra en misión con su escudo heredado", "escudo=" + r.enMision.escudo);
  comprobar(r.enMision.armaId === "electrico", "y con su arma heredada", r.enMision.armaId);
  comprobar(r.tras.id === "chassis_03" && r.tras.escudo === 1 && r.tras.armaId === "electrico",
    "reintentar vuelve a aplicar la misma ficha");
  comprobar(r.guardado === "chassis_03", "y queda guardada con el id nuevo", r.guardado);
  comprobar(p.errs.length === 0, "sin errores", p.errs.slice(0, 2).join(" | "));
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\n9 · ID DESCONOCIDO Y CLÁSICA");
{
  const p1 = await abrir({ nave: "nave_inventada" });
  const a = await p1.evaluate(() => ({ id: NAVES[naveSel].id, bloq: NAVES[naveSel].bloqueada }));
  comprobar(a.id === "chassis_01" && !a.bloq,
    "un id desconocido cae a chassis_01 sin romper nada", a.id);
  comprobar(p1.errs.length === 0, "sin errores", p1.errs.slice(0, 2).join(" | "));
  await p1.cerrar();

  const p2 = await abrir({ nave: "clasica" });
  const b = await p2.evaluate(() => ({
    id: NAVES[naveSel].id, enTabla: NAVES.some(n => n.id === "clasica"),
    nombre: NAVES[naveSel].nombre, total: NAVES.length,
  }));
  comprobar(b.id === "clasica" && b.enTabla,
    "quien llevara la CLÁSICA la conserva", b.id + " · " + b.nombre);
  await p2.cerrar();

  const p3 = await abrir();
  const c = await p3.evaluate(() => ({
    enTabla: NAVES.some(n => n.id === "clasica"), total: NAVES.length,
  }));
  comprobar(!c.enTabla && c.total === 5,
    "y quien no, ve solo los cinco chasis", c.total + " naves");
  await p3.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\n10 · EL RESTO SIGUE INTACTO");
{
  const p = await abrir();
  const r = await p.evaluate(() => ({
    save: SAVE.estado().ok, saveV: SAVE.estado().version,
    migradoDe: SAVE.estado().migradoDe,
    vfx: VFX.limites().total, ui: typeof UI.desbloqueo === "function",
    sprites: ["chassis_01", "chassis_02", "chassis_03", "chassis_04"]
      .filter(id => !!SPRITES[id]).length,
  }));
  comprobar(r.save && r.saveV === 2, "el save sigue en v2 sin migración", "v" + r.saveV);
  comprobar(r.sprites === 4, "los 4 sprites cargan con la clave del chasis", r.sprites + "/4");
  comprobar(r.vfx > 0 && r.ui, "VFX y UI intactos");
  comprobar(p.errs.length === 0, "sin errores JS ni 404", p.errs.slice(0, 3).join(" | "));
  await p.cerrar();
}

await nav.close();
srv.cerrar();
console.log("\n" + (fallos.length
  ? "FALLOS: " + fallos.length + "\n - " + fallos.join("\n - ")
  : "Todo correcto."));
process.exit(fallos.length ? 1 : 0);
