// ════════════════════════════════════════════════════════════
//  ui.mjs — pantallas, transiciones y estados que se limpian
// ════════════════════════════════════════════════════════════
//
//    node herramientas/pruebas/ui.mjs
//
//  Lo que se rompe de verdad en una capa de presentación no es que algo
//  se vea mal: es que algo se quede PUESTO. Un overlay huérfano, un
//  contador que arrastra el valor de la partida anterior, un aviso de
//  desbloqueo que no se va. Y eso solo sale dando vueltas al ciclo
//  completo varias veces, que es lo que hace la última prueba.
//
//  También se comprueba lo que no se puede ver en una captura: que las
//  transiciones no bloqueen, que los botones sean tocables de verdad en
//  iPad y que nada de esto haya tocado el combate, el audio ni el save.

import { servidor, cargarPlaywright } from "../qa.mjs";

const srv = await servidor();
const { chromium } = await cargarPlaywright();
const nav = await chromium.launch();

const fallos = [];
const comprobar = (ok, t, extra) => {
  console.log((ok ? "  ok    " : "  FALLO ") + t + (extra ? "   " + extra : ""));
  if (!ok) fallos.push(t);
};

async function abrir(disp) {
  const d = disp || { width: 820, height: 1180, dpr: 2 };
  const ctx = await nav.newContext({
    viewport: { width: d.width, height: d.height },
    deviceScaleFactor: d.dpr, hasTouch: true, isMobile: true,
  });
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
  await p.goto(srv.url + "?debug", { waitUntil: "load" });
  await p.mouse.click(d.width / 2, d.height - 60);
  await p.waitForTimeout(1400);
  p.cerrar = () => ctx.close();
  return p;
}

const p = await abrir();

// ════════════════════════════════════════════════════════════
console.log("\n1 · TODAS LAS PANTALLAS DIBUJAN SIN ERROR");
{
  const pantallas = ["inicio", "naves", "campana", "mundos", "ajustes", "campana-completa"];
  const r = await p.evaluate(async (lista) => {
    const out = [];
    for (const nombre of lista) {
      state = "menu"; pantalla = nombre;
      // La pantalla de campaña completada necesita sus estadísticas.
      if (nombre === "campana-completa" && !campaignStats) {
        campaignStats = { score: 123456, best: 123456, enemiesKilled: 900,
                          maxCombo: 44, precision: 61, tiempo: 470, nave: "KALI" };
      }
      for (let i = 0; i < 4; i++) await new Promise(r => requestAnimationFrame(r));
      out.push({ nombre, botones: botones.length });
    }
    return out;
  }, pantallas);
  for (const x of r) console.log("        " + x.nombre.padEnd(18) + x.botones + " botones");
  comprobar(r.every(x => x.botones > 0), "todas registran botones tocables",
    r.filter(x => !x.botones).map(x => x.nombre).join(", "));
  comprobar(p.errs.length === 0, "y ninguna lanza errores", p.errs.slice(0, 2).join(" | "));
}

// ════════════════════════════════════════════════════════════
console.log("\n2 · TRANSICIONES");
{
  const r = await p.evaluate(async () => {
    state = "menu"; pantalla = "inicio";
    await new Promise(r => requestAnimationFrame(r));
    UI.ir(() => { pantalla = "campana"; });
    // A mitad tiene que estar tapando y la pantalla YA cambiada.
    const traza = [];
    for (let i = 0; i < 40; i++) {
      await new Promise(r => requestAnimationFrame(r));
      traza.push({ tapado: +UI.tapado().toFixed(2), pant: pantalla, activa: UI.enTransicion() });
    }
    return {
      maxTapado: Math.max(...traza.map(t => t.tapado)),
      cambio: traza.some(t => t.pant === "campana"),
      acabaLimpia: !UI.enTransicion() && UI.tapado() === 0,
      pantFinal: pantalla,
      frames: traza.filter(t => t.activa).length,
    };
  });
  comprobar(r.maxTapado > 0.8, "el barrido llega a tapar la pantalla",
    "máx " + r.maxTapado);
  comprobar(r.cambio && r.pantFinal === "campana", "y la pantalla cambia", r.pantFinal);
  comprobar(r.acabaLimpia, "la transición TERMINA y no deja nada puesto");
  // 340 ms a 60 fps ≈ 20 fotogramas. Si durase mucho más, entrar a jugar
  // se convertiría en un peaje.
  comprobar(r.frames <= 30, "y dura poco", r.frames + " fotogramas");
}

// ════════════════════════════════════════════════════════════
console.log("\n3 · UNA TRANSICIÓN NO PUEDE BLOQUEAR EL JUEGO");
{
  const r = await p.evaluate(async () => {
    // Dos llamadas seguidas: la segunda no debe perderse ni encolarse
    // para siempre.
    state = "menu"; pantalla = "inicio";
    UI.ir(() => { pantalla = "naves"; });
    UI.ir(() => { pantalla = "ajustes"; });
    for (let i = 0; i < 40; i++) await new Promise(r => requestAnimationFrame(r));
    return { pant: pantalla, activa: UI.enTransicion() };
  });
  comprobar(r.pant === "ajustes", "la segunda llamada se aplica igual", r.pant);
  comprobar(!r.activa, "y no queda ninguna transición colgada");
}

// ════════════════════════════════════════════════════════════
console.log("\n4 · MISSION COMPLETE: CIFRAS, RÉCORD Y ELOI");
{
  const r = await p.evaluate(async () => {
    modo = "campana"; misionIdx = 0; iniciarMision(0);
    await new Promise(r => setTimeout(r, 300));
    misionIniT = 0; enemies.length = 0; eBullets.length = 0;
    score = 4000; maxCombo = 12; elapsed = 100;
    cerrarMision();
    // Se congela el mundo mientras se mide. `UI.tick()` va en el bucle,
    // FUERA de la comprobación de pausa, así que los contadores siguen
    // animando pero la puntuación deja de moverse. Sin esto la prueba
    // persigue un objetivo que cambia —la misión sigue soltando
    // enemigos— y falla según lo que haya spawneado, no según el
    // contador, que es lo que se quiere medir.
    paused = true;
    const alPrincipio = UI.cifra("misTotal", 0);
    // El aviso se comprueba AQUÍ y no al final del bucle: dura 2,6 s y
    // este navegador va a ~20 fps, así que sesenta fotogramas son tres
    // segundos y ya se habría ido solo.
    const hayAviso = UI.hayAviso();
    await new Promise(r => requestAnimationFrame(r));
    const tipoAviso = UI.avisoActual() ? UI.avisoActual().tipo : null;
    // Se deja correr y se mira que la cifra SUBA y llegue.
    const traza = [];
    for (let i = 0; i < 60; i++) {
      await new Promise(r => requestAnimationFrame(r));
      traza.push(UI.cifra("misTotal", Math.round(score)));
    }
    return {
      alPrincipio, final: traza[traza.length - 1], objetivo: Math.round(score),
      subio: traza[10] > traza[0],
      eloi: resultado.eloi, record: resultado.recordMision,
      hayAviso, aviso: tipoAviso,
      misionMax,
      descongelado: (paused = false, true),
    };
  });
  comprobar(r.alPrincipio === 0, "la cifra empieza en cero", r.alPrincipio + "");
  comprobar(r.subio, "y sube");
  comprobar(r.final === r.objetivo, "hasta el total exacto", r.final + "/" + r.objetivo);
  comprobar(r.eloi > 0, "se ganan ELOI y se muestran", "+" + r.eloi);
  comprobar(r.record === true, "el récord de misión se detecta");
  comprobar(r.hayAviso && r.aviso === "mision",
    "y salta el aviso de misión desbloqueada", "tipo=" + r.aviso);
  comprobar(r.misionMax === 1, "con el desbloqueo real detrás", "misionMax=" + r.misionMax);
}

// ════════════════════════════════════════════════════════════
console.log("\n5 · SISTEMA DE DESBLOQUEO GENÉRICO");
{
  const r = await p.evaluate(async () => {
    UI.limpiarAvisos();
    // Los cuatro tipos que el bloque 4 va a necesitar.
    UI.desbloqueo({ tipo: "nave",  titulo: "SILVIA", desc: "Vanguardia", color: "#c77dff" });
    UI.desbloqueo({ tipo: "skin",  titulo: "CARMESÍ", desc: "Aspecto", color: "#ff3b5c" });
    UI.desbloqueo({ tipo: "logro", titulo: "SIN UN RASGUÑO", desc: "Misión sin daño" });
    const enCola = UI.hayAviso();
    const vistos = [];
    // Se dejan pasar los tres, uno detrás de otro.
    for (let i = 0; i < 700; i++) {
      await new Promise(r => requestAnimationFrame(r));
      const a = UI.avisoActual();
      if (a && vistos.indexOf(a.titulo) < 0) vistos.push(a.titulo);
      if (!UI.hayAviso()) break;
    }
    return { enCola, vistos, limpio: !UI.hayAviso(),
             etiquetas: Object.keys(UI.ETIQUETA) };
  });
  comprobar(r.enCola, "los avisos se encolan");
  comprobar(r.vistos.length === 3, "y salen de uno en uno, sin pisarse",
    r.vistos.join(" → "));
  comprobar(r.limpio, "y la cola se vacía sola");
  comprobar(r.etiquetas.includes("nave") && r.etiquetas.includes("skin"),
    "hay etiquetas listas para el bloque 4", r.etiquetas.join(", "));
}

// ════════════════════════════════════════════════════════════
console.log("\n6 · GAME OVER: NO TAPA LA MUERTE");
{
  const r = await p.evaluate(async () => {
    modo = "campana"; iniciarMision(0);
    await new Promise(r => setTimeout(r, 300));
    misionIniT = 0; enemies.length = 0; eBullets.length = 0;
    score = 7777; lives = 1; invulnT = 0;
    golpe(player.x, player.y - 20);
    // golpe() ya vacía el campo al morir, pero la misión sigue con sus
    // eventos: se congela para que la puntuación no se mueva mientras se
    // mide el contador.
    paused = true;
    const traza = [];
    const t0 = performance.now();
    while (performance.now() - t0 < 1500) {
      await new Promise(r => requestAnimationFrame(r));
      traza.push({ t: performance.now() - t0, botones: botones.length });
    }
    return {
      state,
      // Durante los primeros 350 ms el panel no debe estar (la cortina
      // aún está entrando y se tiene que ver reventar la nave).
      botonesTemprano: traza.filter(x => x.t < 300).every(x => x.botones === 0),
      botonesLuego: traza[traza.length - 1].botones,
      cifra: UI.cifra("overScore", score), score,
      descongelado: (paused = false, true),
    };
  });
  comprobar(r.state === "over", "entra en fin de partida");
  comprobar(r.botonesTemprano, "no hay panel durante la muerte");
  comprobar(r.botonesLuego >= 2, "y luego aparecen REINTENTAR y MENÚ",
    r.botonesLuego + " botones");
  comprobar(r.cifra === r.score, "la puntuación llega a su valor", r.cifra + "");
}

// ════════════════════════════════════════════════════════════
console.log("\n7 · PAUSA");
{
  const r = await p.evaluate(async () => {
    modo = "campana"; iniciarMision(0);
    await new Promise(r => setTimeout(r, 300));
    misionIniT = 0;
    paused = true;
    for (let i = 0; i < 6; i++) await new Promise(r => requestAnimationFrame(r));
    const enPausa = { botones: botones.length, t: elapsed };
    await new Promise(r => setTimeout(r, 250));
    const sigueQuieto = Math.abs(elapsed - enPausa.t) < 0.001;
    paused = false;
    await new Promise(r => setTimeout(r, 200));
    return { botones: enPausa.botones, sigueQuieto, avanza: elapsed > enPausa.t };
  });
  comprobar(r.botones === 3, "tres botones: continuar, ajustes, abandonar",
    r.botones + "");
  comprobar(r.sigueQuieto, "el reloj de la misión NO avanza en pausa");
  comprobar(r.avanza, "y vuelve a avanzar al continuar");
}

// ════════════════════════════════════════════════════════════
console.log("\n8 · AJUSTES: TODO DENTRO DEL PANEL");
{
  // Se mide sobre los píxeles: el panel es un rectángulo oscuro, así que
  // debajo del último botón tiene que seguir habiendo panel y no
  // nebulosa. Es exactamente el fallo que había.
  const r = await p.evaluate(async () => {
    const medir = async (audio) => {
      state = "menu"; pantalla = "ajustes";
      audioListo = audio;
      for (let i = 0; i < 4; i++) await new Promise(r => requestAnimationFrame(r));
      // El botón PROBAR SONIDO: se busca por tamaño entre los botones.
      const b = botones.find(x => x.w > 150 && x.w < 220 && x.h === 40);
      if (!b) return null;
      const g = c.getContext("2d");
      const leer = (x, y) => {
        const px = Math.round(x * DPR) + Math.round(PX * DPR);
        const py = Math.round(y * DPR);
        const d = g.getImageData(px, py, 1, 1).data;
        return d[0] + d[1] + d[2];
      };
      // Se mide en el margen INTERIOR IZQUIERDO del panel (x0−14), que
      // es la única columna donde no cae ningún glifo: los textos de
      // ayuda van centrados en W/2 y ni el más largo llega ahí. Con un
      // solo píxel a x0−8 la medida caía sobre una letra y daba un falso
      // fallo. Y se toma el MÍNIMO de varias alturas, porque el panel es
      // uniforme y el texto es disperso.
      const anchoP = Math.min(W - 44, 340), x0 = (W - anchoP) / 2;
      const banda = [];
      for (let dy = 44; dy <= 76; dy += 8) banda.push(leer(x0 - 14, b.y + dy));
      return {
        dentroPanel: leer(x0 - 14, b.y + 20),
        bajoAyuda: Math.max(...banda),
        fueraPanel: leer(x0 - 60, b.y + 20),
        botonY: b.y,
      };
    };
    return { listo: await medir(true), enEspera: await medir(false) };
  });
  for (const [nombre, m] of Object.entries(r)) {
    if (!m) { comprobar(false, nombre + ": no se encuentra PROBAR SONIDO"); continue; }
    console.log(`        ${nombre.padEnd(10)} panel ${m.dentroPanel} · bajo la ayuda ` +
      `${m.bajoAyuda} · fuera ${m.fueraPanel}`);
    // El panel es oscuro y uniforme; la nebulosa es más clara y variada.
    comprobar(m.bajoAyuda < 120,
      nombre + ": el texto de ayuda sigue dentro del panel", "brillo " + m.bajoAyuda);
  }
}

// ════════════════════════════════════════════════════════════
console.log("\n9 · BOTONES: TAMAÑO Y SAFE AREA");
{
  const r = await p.evaluate(async () => {
    const problemas = [];
    for (const nombre of ["inicio", "naves", "campana", "mundos", "ajustes"]) {
      state = "menu"; pantalla = nombre;
      for (let i = 0; i < 3; i++) await new Promise(r => requestAnimationFrame(r));
      for (const b of botones) {
        // 30 px es el mínimo razonable para un dedo. La × de borrar nave
        // y los escalones de volumen son deliberadamente pequeños en un
        // eje, así que se pide que al menos UNO de los dos lados llegue.
        if (Math.max(b.w, b.h) < 30) problemas.push(nombre + " " + b.w + "×" + b.h);
        if (b.y < SAFE_TOP - 1) problemas.push(nombre + " sobre el notch y=" + b.y);
        if (b.y + b.h > H - SAFE_BOTTOM + 1) problemas.push(nombre + " bajo el borde");
      }
    }
    return { problemas, safeTop: SAFE_TOP, safeBottom: SAFE_BOTTOM };
  });
  comprobar(r.problemas.length === 0, "ningún botón minúsculo ni fuera del área segura",
    r.problemas.slice(0, 3).join(" | "));
}

// ════════════════════════════════════════════════════════════
console.log("\n10 · PULSACIÓN VISIBLE");
{
  const r = await p.evaluate(async () => {
    state = "menu"; pantalla = "inicio";
    for (let i = 0; i < 3; i++) await new Promise(r => requestAnimationFrame(r));
    const b = botones.find(x => x.h >= 46);
    UI.pulsar(b);
    const marcado = UI.estaPulsado(b.x, b.y, b.w, b.h);
    const otro = UI.estaPulsado(b.x + 5, b.y, b.w, b.h);
    UI.soltar();
    return { marcado, otro, tras: UI.estaPulsado(b.x, b.y, b.w, b.h) };
  });
  comprobar(r.marcado, "el botón pulsado se marca");
  comprobar(!r.otro, "y solo ese");
  comprobar(!r.tras, "y se desmarca al soltar");
}

// ════════════════════════════════════════════════════════════
console.log("\n11 · CICLO COMPLETO, CINCO VUELTAS");
{
  // La prueba que de verdad busca overlays huérfanos: dar vueltas al
  // recorrido entero y comprobar que al volver a la portada no queda
  // NADA puesto — ni transición, ni aviso, ni contador, ni pausa, ni
  // modal, ni partículas.
  const r = await p.evaluate(async () => {
    const esperar = async (n) => { for (let i = 0; i < n; i++) await new Promise(r => requestAnimationFrame(r)); };
    const traza = [];
    for (let vuelta = 0; vuelta < 5; vuelta++) {
      // portada → campaña
      state = "menu"; pantalla = "inicio"; await esperar(3);
      UI.ir(() => { pantalla = "campana"; modo = "campana"; }); await esperar(26);
      // campaña → M1
      UI.ir(() => { misionIdx = 0; iniciarMision(0); }); await esperar(26);
      misionIniT = 0; enemies.length = 0; eBullets.length = 0;
      // pausa → continuar
      paused = true; await esperar(6);
      paused = false; await esperar(4);
      // morir → reintentar
      lives = 1; invulnT = 0; score = 500 + vuelta * 100;
      golpe(player.x, player.y - 20);
      await new Promise(r => setTimeout(r, 700));
      UI.ir(() => { iniciarMision(misionIdx); }); await esperar(26);
      misionIniT = 0; enemies.length = 0; eBullets.length = 0;
      // completar
      score = 3000 + vuelta * 500; cerrarMision();
      await new Promise(r => setTimeout(r, 400));
      misionCompletaT = 0.01;
      await new Promise(r => setTimeout(r, 200));
      // ajustes → volver a portada
      UI.ir(() => { state = "menu"; pantalla = "ajustes"; }); await esperar(26);
      UI.ir(() => { pantalla = "inicio"; }); await esperar(26);
      UI.limpiarAvisos();
      await esperar(4);
      const v = VFX.metricas();
      traza.push({
        vuelta: vuelta + 1,
        transicion: UI.enTransicion(), aviso: UI.hayAviso(),
        modal: !!confirmando, pausa: paused, state, pantalla,
        parts: v.parts, reserva: v.reserva, total: v.parts + v.reserva,
        guiones: v.guiones, efectos: efectos.length,
        misionMax, cifra: UI.cifra("misTotal", 0),
      });
    }
    return traza;
  });
  for (const t of r) {
    console.log(`        vuelta ${t.vuelta} · ${t.state}/${t.pantalla} · ` +
      `part ${t.parts}+${t.reserva} · fx ${t.efectos} · guiones ${t.guiones} · ` +
      `misionMax ${t.misionMax}`);
  }
  comprobar(r.every(t => !t.transicion), "ninguna vuelta deja una transición puesta");
  comprobar(r.every(t => !t.aviso), "ni un aviso huérfano");
  comprobar(r.every(t => !t.modal), "ni el modal de borrado abierto");
  comprobar(r.every(t => !t.pausa), "ni la pausa activada");
  comprobar(r.every(t => t.state === "menu" && t.pantalla === "inicio"),
    "y todas acaban en la portada");
  comprobar(r.every(t => t.guiones === 0), "sin guiones de VFX colgados");
  // Lo que delataría una fuga: que el conjunto vivas+reserva crezca
  // vuelta a vuelta.
  const totales = r.map(t => t.total);
  comprobar(Math.max(...totales) - Math.min(...totales) <= 80,
    "y el pool no crece vuelta a vuelta",
    totales.join(" → "));
  comprobar(r[4].misionMax >= 1, "el progreso se conserva entre vueltas",
    "misionMax=" + r[4].misionMax);
}

// ════════════════════════════════════════════════════════════
console.log("\n12 · EL RESTO SIGUE INTACTO");
{
  const r = await p.evaluate(() => ({
    save: SAVE.estado().ok, saveV: SAVE.estado().version,
    musica: MUSICA.debug().modo, banco: muestrasDbg.listas,
    vfxCalidad: VFX.calidad(), vfxTope: VFX.limites().total,
  }));
  comprobar(r.save && r.saveV === 2, "guardado intacto", "v" + r.saveV);
  comprobar(r.musica === "webaudio", "música intacta", r.musica);
  comprobar(r.banco > 0, "audio intacto", r.banco + " muestras");
  comprobar(r.vfxTope === 420 || r.vfxTope === 240 || r.vfxTope === 110,
    "presupuesto de VFX de combate intacto", r.vfxCalidad + " → " + r.vfxTope);
  comprobar(p.errs.length === 0, "sin errores JS ni 404", p.errs.slice(0, 3).join(" | "));
}
await p.cerrar();

// ════════════════════════════════════════════════════════════
console.log("\n13 · OTRAS RESOLUCIONES Y SAFE AREA");
{
  for (const [nombre, disp] of Object.entries({
    "iPhone":     { width: 393, height: 852, dpr: 3 },
    "iPad mini":  { width: 744, height: 1133, dpr: 2 },
    "escritorio": { width: 1600, height: 900, dpr: 1 },
  })) {
    const q = await abrir(disp);
    const r = await q.evaluate(async () => {
      const out = [];
      for (const nombre of ["inicio", "campana", "ajustes"]) {
        state = "menu"; pantalla = nombre;
        for (let i = 0; i < 3; i++) await new Promise(r => requestAnimationFrame(r));
        const fuera = botones.filter(b => b.y + b.h > H - SAFE_BOTTOM + 1 || b.y < SAFE_TOP - 1);
        out.push({ nombre, botones: botones.length, fuera: fuera.length });
      }
      return { out, W, H, PX, SAFE_TOP, SAFE_BOTTOM };
    });
    console.log(`        ${nombre.padEnd(11)} campo ${r.W}×${r.H} marco ${r.PX}px · ` +
      r.out.map(o => o.nombre + ":" + o.botones + (o.fuera ? "(!" + o.fuera + ")" : "")).join(" "));
    comprobar(r.out.every(o => o.botones > 0), nombre + ": todas las pantallas responden");
    comprobar(r.out.every(o => o.fuera === 0), nombre + ": nada fuera del área segura",
      r.out.filter(o => o.fuera).map(o => o.nombre).join(", "));
    comprobar(q.errs.length === 0, nombre + ": sin errores", q.errs.slice(0, 2).join(" | "));
    await q.cerrar();
  }
}

await nav.close();
srv.cerrar();
console.log("\n" + (fallos.length
  ? "FALLOS: " + fallos.length + "\n - " + fallos.join("\n - ")
  : "Todo correcto."));
process.exit(fallos.length ? 1 : 0);
