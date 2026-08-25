// ════════════════════════════════════════════════════════════
//  vfx-jefes.mjs — entrada, fases y muerte de los diez jefes
// ════════════════════════════════════════════════════════════
//
//    node herramientas/pruebas/vfx-jefes.mjs
//
//  Lo que se vigila aquí:
//
//    · Los DIEZ usan el sistema. Uno que se quede fuera no da error:
//      simplemente se muere como un enemigo grande, y eso no se ve en
//      ninguna consola. Por eso se comprueba uno a uno.
//    · La muerte no se sale del presupuesto NI concentra el trabajo en
//      un fotograma. Repartir la carga es la mitad del bloque.
//    · Las balas siguen viéndose mientras el jefe explota.
//    · Los diez seguidos no dejan fugas en la reserva.

import { servidor, cargarPlaywright } from "../qa.mjs";

const srv = await servidor();
const { chromium } = await cargarPlaywright();
const nav = await chromium.launch();
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
await p.mouse.click(410, 1100);
await p.waitForTimeout(1500);

const fallos = [];
const comprobar = (ok, t, extra) => {
  console.log((ok ? "  ok    " : "  FALLO ") + t + (extra ? "   " + extra : ""));
  if (!ok) fallos.push(t);
};

const JEFES_ID = await p.evaluate(() => Object.keys(JEFES));

// ════════════════════════════════════════════════════════════
console.log("\n1 · LOS DIEZ JEFES TIENEN ESTILO");
{
  const r = await p.evaluate(() => {
    const sin = [], mapa = {};
    for (const id of Object.keys(JEFES)) {
      const est = VFX.ESTILO_DE[id];
      if (!est) sin.push(id);
      mapa[id] = est || "(por defecto)";
    }
    return { sin, mapa, nEstilos: Object.keys(VFX.ESTILOS).length };
  });
  for (const [id, est] of Object.entries(r.mapa)) {
    console.log("        " + id.padEnd(20) + est);
  }
  // 20 desde el bloque 5G: los 10 de siempre + 5 minijefes (5F) + 5
  // jefes principales de la expansión (5G). Esta prueba recorre TODOS
  // los ids de JEFES sin distinguir, así que de paso pasa la
  // coreografía entera (entrada/fases/muerte/estrés) por los diez
  // nuevos de 5F+5G.
  comprobar(JEFES_ID.length === 20, "hay 20 jefes (10 + 5 minijefes + 5 de 5G)", JEFES_ID.length + "");
  comprobar(r.sin.length === 0, "los 10 tienen estilo asignado", r.sin.join(", "));
  comprobar(r.nEstilos >= 5, "y hay variedad de estilos", r.nEstilos + " estilos");
}

// ════════════════════════════════════════════════════════════
console.log("\n2 · ENTRADA, FASES Y MUERTE, JEFE A JEFE");
{
  const resultados = [];
  for (const id of JEFES_ID) {
    const r = await p.evaluate(async (id) => {
      OPCIONES.vfx = "alto"; aplicarVFX();
      modo = "campana"; iniciarMision(0);
      await new Promise(r => setTimeout(r, 350));
      misionIniT = 0; enemies.length = 0; eBullets.length = 0;
      miniboss = null; VFX.limpiar();

      // ── ENTRADA ──
      spawnMiniboss(id, 1);
      // El aviso dura 2,6 s; se mira a mitad que ya esté pasando algo.
      const t0 = performance.now();
      while (performance.now() - t0 < 900) await new Promise(r => requestAnimationFrame(r));
      const enAviso = VFX.metricas();
      // Se salta el resto del aviso y la bajada.
      miniboss.estT = 2.6;
      await new Promise(r => requestAnimationFrame(r));
      miniboss.estT = 2.0;                       // final de la entrada
      for (let i = 0; i < 4; i++) await new Promise(r => requestAnimationFrame(r));
      const trasEntrada = VFX.metricas();
      const estado = miniboss ? miniboss.est : "sin jefe";

      // ── FASES ── una por una, todas las que tenga
      const fases = JEFES[id].fases.length;
      let picoFase = 0;
      for (let f = 1; f < fases; f++) {
        miniboss.est = "combate"; miniboss.invul = false;
        cambiarFase(miniboss, f);
        for (let i = 0; i < 3; i++) await new Promise(r => requestAnimationFrame(r));
        picoFase = Math.max(picoFase, VFX.metricas().fam.bossFase);
      }
      // Aura en fase final
      miniboss.est = "combate"; miniboss.invul = false;
      for (let i = 0; i < 20; i++) await new Promise(r => requestAnimationFrame(r));
      const auraFinal = VFX.metricas().fam.bossAura;
      const inten = miniboss.inten || 0;

      // ── MUERTE ── y se mide fotograma a fotograma
      matarMiniboss();
      const guiones = VFX.guionesActivos();
      let picoTotal = 0, picoFrame = 0, picoMuerte = 0, frames = 0, emitidas = 0;
      const dur = JEFES[id].epico ? 5200 : 3600;
      const t1 = performance.now();
      while (performance.now() - t1 < dur) {
        await new Promise(r => requestAnimationFrame(r));
        const m = VFX.metricas();
        picoTotal = Math.max(picoTotal, m.parts);
        picoFrame = Math.max(picoFrame, m.porFrameBoss);
        picoMuerte = Math.max(picoMuerte, m.fam.bossMuerte + m.fam.debrisBoss);
        // Lo que importa para comparar jefes no es el PICO instantáneo
        // —una muerte más larga tiene picos más bajos aunque emita más—
        // sino el TOTAL emitido a lo largo de la agonía.
        emitidas += m.porFrameBoss;
        frames++;
      }
      // La MEDIDA va por reloj a propósito: `frames` compara la duración de
      // una muerte con la de otra. Comprobar que el jefe se fue y el guion se
      // recogió es otra cosa y NO puede ir por reloj: en headless el navegador
      // compone por software (~20 fps) y en `dur` ms caben la mitad de
      // fotogramas, con la agonía aún a medias. Se drena aparte y con tope
      // duro, para que un guion de verdad colgado siga fallando.
      const tope1 = performance.now() + dur * 6;
      while (performance.now() < tope1 && (miniboss || VFX.guionesActivos() > 0))
        await new Promise(r => requestAnimationFrame(r));
      const fin = VFX.metricas();
      return {
        id, estado, fases,
        avisoParts: enAviso.parts, entradaParts: trasEntrada.parts,
        picoFase, auraFinal, inten, guiones,
        picoTotal, maxParts: fin.maxParts, picoFrame, topeFrame: fin.topeFrameBoss,
        picoMuerte, frames, emitidas,
        jefeVivo: !!miniboss, reserva: fin.reserva, quedan: fin.parts,
      };
    }, id);
    resultados.push(r);
    console.log(`        ${r.id.padEnd(20)} ${r.fases} fases · ` +
      `aviso ${String(r.avisoParts).padStart(3)}p · ` +
      `fase ${String(r.picoFase).padStart(2)}p · aura ${String(r.auraFinal).padStart(2)}p · ` +
      `muerte pico ${String(r.picoTotal).padStart(3)}/${r.maxParts} · ` +
      `emitidas ${String(r.emitidas).padStart(4)} · boss/frame ${r.picoFrame}/${r.topeFrame}`);
  }

  comprobar(resultados.every(r => r.avisoParts > 0),
    "los 10 tienen energía en el AVISO",
    resultados.filter(r => !r.avisoParts).map(r => r.id).join(", "));
  comprobar(resultados.every(r => r.estado === "combate" || r.estado === "transicion"),
    "los 10 completan la ENTRADA",
    resultados.filter(r => r.estado !== "combate" && r.estado !== "transicion")
      .map(r => r.id + ":" + r.estado).join(", "));
  comprobar(resultados.every(r => r.picoFase > 0),
    "los 10 tienen feedback de CAMBIO DE FASE",
    resultados.filter(r => !r.picoFase).map(r => r.id).join(", "));
  comprobar(resultados.every(r => r.auraFinal > 0),
    "los 10 tienen AURA viva en fase final",
    resultados.filter(r => !r.auraFinal).map(r => r.id).join(", "));
  comprobar(resultados.every(r => r.inten > 0.8),
    "y la intensidad llega arriba en la última fase",
    resultados.map(r => r.inten.toFixed(2)).join(" "));
  comprobar(resultados.every(r => r.guiones > 0),
    "los 10 lanzan la COREOGRAFÍA de muerte",
    resultados.filter(r => !r.guiones).map(r => r.id).join(", "));
  comprobar(resultados.every(r => r.picoMuerte > 0),
    "y sueltan partículas de muerte de verdad");
  comprobar(resultados.every(r => r.picoTotal <= r.maxParts),
    "ninguna muerte se sale del presupuesto total",
    resultados.map(r => r.picoTotal).join(" "));
  comprobar(resultados.every(r => r.picoFrame <= r.topeFrame),
    "ni del tope por fotograma: la carga se REPARTE",
    "máx " + Math.max(...resultados.map(r => r.picoFrame)) + "/" +
      resultados[0].topeFrame);
  comprobar(resultados.every(r => !r.jefeVivo),
    "y los 10 acaban muertos y limpios",
    resultados.filter(r => r.jefeVivo).map(r => r.id).join(", "));

  // Los dos ÉPICOS (OMEGA SOVEREIGN, campaña base; AXIOMA, final de la
  // expansión) por encima del resto — ninguno de los dos manda sobre
  // el otro, los dos son un final de verdad, así que se sacan ambos de
  // "otros" y se comprueba lo mismo para cada uno por separado.
  const omega = resultados.find(r => r.id === "omega_sovereign");
  const axioma = resultados.find(r => r.id === "axioma");
  const otros = resultados.filter(r => r.id !== "omega_sovereign" && r.id !== "axioma");
  // Se compara el TOTAL emitido, no el pico instantáneo: una muerte más
  // larga reparte más y por eso tiene picos más bajos aunque emita más.
  // Medir el pico premiaría justo lo contrario de lo que queremos.
  const medioOtros = otros.reduce((a, r) => a + r.emitidas, 0) / otros.length;
  comprobar(omega.emitidas > medioOtros,
    "OMEGA SOVEREIGN emite más que la media en su muerte",
    omega.emitidas + " vs " + medioOtros.toFixed(0));
  comprobar(omega.frames > otros[0].frames,
    "y su muerte dura más", omega.frames + " vs " + otros[0].frames + " fotogramas");
  comprobar(axioma.emitidas > medioOtros,
    "★ AXIOMA (final de la expansión) también emite más que la media en su muerte",
    axioma.emitidas + " vs " + medioOtros.toFixed(0));
  comprobar(axioma.frames > otros[0].frames,
    "y su muerte también dura más", axioma.frames + " vs " + otros[0].frames + " fotogramas");
}

// ════════════════════════════════════════════════════════════
console.log("\n3 · LAS BALAS SIGUEN VISIBLES DURANTE LA MUERTE");
{
  const r = await p.evaluate(async () => {
    OPCIONES.vfx = "alto"; OPCIONES.sacudida = 0; aplicarVFX();
    showDebug = false;
    modo = "campana"; iniciarMision(0);
    await new Promise(r => setTimeout(r, 350));
    misionIniT = 0; enemies.length = 0; eBullets.length = 0; miniboss = null;
    VFX.limpiar();
    spawnMiniboss("omega_sovereign", 1);
    miniboss.est = "combate"; miniboss.invul = false;
    miniboss.x = W / 2; miniboss.y = H * 0.32;
    // El banner de WARNING es HUD y se pinta sobre TODO, en la banda
    // y≈0,34H–0,43H. En juego real no tapa ninguna bala porque aparecer
    // el jefe vacía eBullets y todavía no ha atacado nadie; aquí se
    // quita porque si no, mide el banner en vez de los efectos.
    warningT = 0;
    await new Promise(r => requestAnimationFrame(r));

    // Muro de balas justo por debajo y por encima del jefe.
    const puntos = [];
    for (let i = 0; i < 8; i++) for (let j = 0; j < 5; j++) {
      const bx = 60 + i * (W - 120) / 7, by = H * 0.24 + j * 52;
      eBala(bx, by, 0, 3, 7);
      puntos.push([Math.round(bx), Math.round(by)]);
    }
    const lee = () => {
      const g = c.getContext("2d");
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let vistas = 0;
      for (const [bx, by] of puntos) {
        let hay = false;
        for (let ox = -9; ox <= 9 && !hay; ox++)
          for (let oy = -9; oy <= 9 && !hay; oy++) {
            const px = Math.round((bx + ox) * DPR) + Math.round(PX * DPR);
            const py = Math.round((by + oy) * DPR);
            if (px < 0 || py < 0 || px >= c.width || py >= c.height) continue;
            const k = (py * c.width + px) * 4;
            if (d[k] > 150 && d[k+1] < 120 && d[k+2] > 60 && d[k+2] < 200) hay = true;
          }
        if (hay) vistas++;
      }
      return vistas;
    };
    await new Promise(r => requestAnimationFrame(r));
    const base = lee();

    // Se mata y se mide en el peor momento: durante las secundarias y
    // justo en la detonación principal. `eBullets` se vacía en la
    // detonación (eso ya lo hacía el juego), así que la medida útil es
    // ANTES de ella.
    matarMiniboss();
    let peor = 999;
    const t0 = performance.now();
    while (performance.now() - t0 < 2600) {
      await new Promise(r => requestAnimationFrame(r));
      if (eBullets.length < puntos.length) break;   // ya detonó
      peor = Math.min(peor, lee());
    }
    OPCIONES.sacudida = 1; aplicarVFX(); showDebug = true;
    miniboss = null;
    return { base, peor, puntos: puntos.length };
  });
  console.log(`        línea base ${r.base}/${r.puntos} · peor momento ${r.peor}/${r.puntos}`);
  comprobar(r.peor >= r.base,
    "la muerte del jefe no esconde ninguna bala", r.peor + " ≥ " + r.base);
}

// ════════════════════════════════════════════════════════════
console.log("\n4 · IMPACTOS DEL JEFE CON FRENO");
{
  const r = await p.evaluate(async () => {
    VFX.limpiar(); VFX.frame(16);
    let aceptados = 0;
    // 200 impactos en el mismo instante, como una ráfaga de raíl.
    for (let i = 0; i < 200; i++) {
      if (VFX.bossImpacto({ x: 400, y: 300, dmg: 1, tipo: "guardian", color: "#fff" })) aceptados++;
    }
    const deGolpe = VFX.metricas().fam.bossHit;
    // Y ahora repartidos en el tiempo: el freno tiene que dejar pasar.
    let aceptados2 = 0;
    for (let i = 0; i < 10; i++) {
      await new Promise(r => setTimeout(r, 70));
      VFX.frame(16);
      if (VFX.bossImpacto({ x: 400, y: 300, dmg: 1, tipo: "guardian", color: "#fff" })) aceptados2++;
    }
    return { aceptados, deGolpe, aceptados2, lim: VFX.metricas().limFam.bossHit };
  });
  comprobar(r.aceptados <= 2, "200 impactos de golpe solo dejan pasar uno o dos",
    r.aceptados + " aceptados");
  comprobar(r.deGolpe <= r.lim, "y no se pasan del tope de la familia",
    r.deGolpe + "/" + r.lim);
  comprobar(r.aceptados2 >= 8, "repartidos en el tiempo sí pasan",
    r.aceptados2 + "/10");
}

// ════════════════════════════════════════════════════════════
console.log("\n5 · CALIDAD BAJA CONSERVA LO ESENCIAL");
{
  const r = await p.evaluate(async () => {
    const medir = async (nivel) => {
      OPCIONES.vfx = nivel; aplicarVFX();
      modo = "campana"; iniciarMision(0);
      await new Promise(r => setTimeout(r, 300));
      misionIniT = 0; enemies.length = 0; miniboss = null; VFX.limpiar();
      spawnMiniboss("pyre_lord", 1);
      miniboss.est = "combate"; miniboss.invul = false;
      cambiarFase(miniboss, JEFES.pyre_lord.fases.length - 1);
      for (let i = 0; i < 6; i++) await new Promise(r => requestAnimationFrame(r));
      const fase = VFX.metricas().fam.bossFase;
      matarMiniboss();
      let pico = 0;
      const t0 = performance.now();
      while (performance.now() - t0 < 2400) {
        await new Promise(r => requestAnimationFrame(r));
        const m = VFX.metricas();
        pico = Math.max(pico, m.fam.bossMuerte + m.fam.debrisBoss);
      }
      miniboss = null;
      return { fase, pico, flash: VFX.metricas().flash, lim: VFX.limites().total };
    };
    return { alto: await medir("alto"), bajo: await medir("bajo") };
  });
  console.log(`        alto: fase ${r.alto.fase}p muerte ${r.alto.pico}p flash×${r.alto.flash}`);
  console.log(`        bajo: fase ${r.bajo.fase}p muerte ${r.bajo.pico}p flash×${r.bajo.flash}`);
  comprobar(r.bajo.fase > 0, "en BAJO el cambio de fase SIGUE viéndose", r.bajo.fase + "p");
  comprobar(r.bajo.pico > 0, "y la muerte del jefe también", r.bajo.pico + "p");
  comprobar(r.bajo.pico < r.alto.pico, "pero con menos carga",
    r.bajo.pico + " < " + r.alto.pico);
  comprobar(r.bajo.flash < r.alto.flash, "y los fogonazos a la mitad",
    "×" + r.bajo.flash + " vs ×" + r.alto.flash);
  await p.evaluate(() => { OPCIONES.vfx = "auto"; aplicarVFX(); });
}

// ════════════════════════════════════════════════════════════
console.log("\n6 · LOS DIEZ SEGUIDOS: FUGAS DE RESERVA");
{
  const r = await p.evaluate(async () => {
    OPCIONES.vfx = "alto"; aplicarVFX();
    modo = "campana"; iniciarMision(0);
    await new Promise(r => setTimeout(r, 300));
    misionIniT = 0; enemies.length = 0; miniboss = null; VFX.limpiar();
    const traza = [];
    for (const id of Object.keys(JEFES)) {
      spawnMiniboss(id, 1);
      miniboss.est = "combate"; miniboss.invul = false;
      for (let f = 1; f < JEFES[id].fases.length; f++) {
        cambiarFase(miniboss, f);
        miniboss.est = "combate"; miniboss.invul = false;
        await new Promise(r => requestAnimationFrame(r));
      }
      matarMiniboss();
      const dur = JEFES[id].epico ? 5200 : 3600;
      const t0 = performance.now();
      const tope0 = t0 + dur * 6;
      while (performance.now() - t0 < dur ||
             (performance.now() < tope0 && (miniboss || VFX.guionesActivos() > 0)))
        await new Promise(r => requestAnimationFrame(r));
      const m = VFX.metricas();
      traza.push({ id, epico: !!JEFES[id].epico,
                   vivas: m.parts, reserva: m.reserva, total: m.parts + m.reserva,
                   guiones: m.guiones, ondas: m.ondas, ondasBoss: m.ondasBoss });
      miniboss = null;
    }
    return { traza, lim: VFX.limites().total };
  });
  for (const t of r.traza) {
    console.log(`        ${t.id.padEnd(20)} vivas ${String(t.vivas).padStart(3)} + ` +
      `reserva ${String(t.reserva).padStart(3)} = ${String(t.total).padStart(3)} · ` +
      `guiones ${t.guiones} · ondas ${t.ondas}/${t.ondasBoss}`);
  }
  const totales = r.traza.map(t => t.total);
  comprobar(Math.max(...totales) <= r.lim + 40,
    "el conjunto vivas+reserva nunca pasa del tope",
    "máx " + Math.max(...totales) + " (tope " + r.lim + ")");
  // Una FUGA sería que el total siguiera subiendo jefe tras jefe sin
  // parar. Lo que sí es normal es que suba al principio: la reserva
  // crece hasta la marca de agua de partículas simultáneas y ahí se
  // queda. Lo que se comprueba, entonces, es que llegue a una MESETA:
  // los seis jefes del medio tienen que dar prácticamente lo mismo.
  // La meseta NO se puede buscar en un tramo fijo: cuántos jefes tarda la
  // reserva en llegar a su marca de agua depende de cuántas partículas
  // coincidan vivas, y eso cambia de una pasada a otra. Se miran los cuatro
  // ÚLTIMOS jefes normales —los épicos suben la marca por diseño, no por
  // fuga— y ahí ya tiene que estar plana.
  comprobar(totales.every((t, i) => i === 0 || t >= totales[i - 1]),
    "la reserva nunca encoge", totales.join(" "));
  const normales = r.traza.filter(t => !t.epico).map(t => t.total);
  const medio = normales.slice(-4);
  const rango = Math.max(...medio) - Math.min(...medio);
  comprobar(rango <= 20,
    "y llega a una meseta: la reserva no fuga",
    "últimos 4 normales: " + Math.min(...medio) + "–" + Math.max(...medio) +
      " (rango " + rango + ")");
  comprobar(r.traza.every(t => t.guiones === 0),
    "todos los guiones terminan y se recogen",
    r.traza.filter(t => t.guiones).map(t => t.id).join(", "));
  comprobar(r.traza.every(t => t.ondasBoss <= 6),
    "y el cupo de ondas de jefe se libera",
    r.traza.map(t => t.ondasBoss).join(" "));
}

// ════════════════════════════════════════════════════════════
console.log("\n7 · ESTRÉS: JEFE + PATRÓN DENSO + MUERTE");
{
  const escena = async (nombre, guion, ms) => {
    const r = await p.evaluate(async ([g, ms]) => {
      // eslint-disable-next-line no-new-func
      new Function(g)();
      const t = [];
      const t0 = performance.now();
      while (performance.now() - t0 < ms) {
        await new Promise(r => requestAnimationFrame(r));
        t.push(VFX.metricas().ms);
      }
      t.sort((a, b) => a - b);
      const m = VFX.metricas();
      return {
        medio: t.reduce((a, b) => a + b, 0) / t.length,
        p95: t[Math.floor(t.length * 0.95)], peor: t[t.length - 1],
        parts: m.pico, boss: m.boss, frameBoss: m.porFrameBoss,
        desc: m.rechazadas, calidad: m.calidad,
      };
    }, [guion, ms]);
    console.log(`        ${nombre.padEnd(26)} ${r.medio.toFixed(1)}ms · p95 ${r.p95.toFixed(1)} · ` +
      `peor ${r.peor.toFixed(1)} · pico ${r.parts}p · boss ${r.boss}p · ` +
      `desc ${r.desc} · ${r.calidad}`);
    return r;
  };

  await p.evaluate(async () => {
    OPCIONES.vfx = "alto"; OPCIONES.calidad = "alta"; aplicarVFX();
    modo = "campana"; iniciarMision(0);
    await new Promise(r => setTimeout(r, 400));
    misionIniT = 0; enemies.length = 0; eBullets.length = 0; miniboss = null;
    VFX.limpiar();
  });

  const base = await escena("jefe en combate", `
    spawnMiniboss("omega_sovereign", 1);
    miniboss.est = "combate"; miniboss.invul = false;
    for (let i = 0; i < 20; i++) spawnEnemy("normal", 40 + (i % 10) * 74);
  `, 1400);
  const denso = await escena("+ patrón denso", `
    for (let i = 0; i < 180; i++) eBala(Math.random()*W, Math.random()*H, 0, 90, 6);
    arma = 6; armaId = "ultimate";
  `, 1400);
  const fase = await escena("+ cambio de fase", `
    miniboss.est = "combate"; miniboss.invul = false;
    cambiarFase(miniboss, JEFES.omega_sovereign.fases.length - 1);
  `, 1200);
  const muerte = await escena("+ MUERTE de OMEGA", `matarMiniboss();`, 5200);

  comprobar(muerte.parts <= 420, "la muerte de OMEGA no pasa de 420 partículas",
    muerte.parts + "/420");
  comprobar(muerte.frameBoss <= 24, "ni del tope de 24 emisiones de jefe por fotograma",
    muerte.frameBoss + "/24");
  comprobar(muerte.medio < Math.max(base.medio, 1) * 6,
    "y no dispara el tiempo de fotograma",
    `${muerte.medio.toFixed(1)}ms vs ${base.medio.toFixed(1)}ms`);
  await p.evaluate(() => { miniboss = null; enemies.length = 0; eBullets.length = 0;
    OPCIONES.calidad = "auto"; aplicarVFX(); });
}

// ════════════════════════════════════════════════════════════
console.log("\n8 · AUTO-DEGRADADO");
{
  const r = await p.evaluate(async () => {
    OPCIONES.vfx = "auto"; OPCIONES.calidad = "baja"; aplicarVFX();
    const conBaja = VFX.calidad();
    OPCIONES.calidad = "alta"; aplicarVFX();
    const conAlta = VFX.calidad();
    // Y el jugador manda por debajo: si pide BAJO, no sube.
    OPCIONES.vfx = "bajo"; OPCIONES.calidad = "alta"; aplicarVFX();
    const pedidaBaja = VFX.calidad();
    OPCIONES.vfx = "auto"; OPCIONES.calidad = "auto"; aplicarVFX();
    return { conBaja, conAlta, pedidaBaja };
  });
  comprobar(r.conBaja === "bajo", "el degradado automático baja los VFX", r.conBaja);
  comprobar(r.conAlta === "alto", "y los sube cuando hay margen", r.conAlta);
  comprobar(r.pedidaBaja === "bajo",
    "y lo que pide el jugador manda por debajo del automático", r.pedidaBaja);
}

// ════════════════════════════════════════════════════════════
console.log("\n9 · SACUDIDA Y EL RESTO INTACTOS");
{
  const r = await p.evaluate(async () => {
    modo = "campana"; iniciarMision(0);
    await new Promise(r => setTimeout(r, 300));
    miniboss = null; VFX.limpiar();
    spawnMiniboss("omega_sovereign", 1);
    miniboss.est = "combate"; miniboss.invul = false;
    await new Promise(r => requestAnimationFrame(r));
    paused = true;
    await new Promise(r => setTimeout(r, 80));
    const antes = { mx: miniboss.x, my: miniboss.y, px: player.x, py: player.y };
    matarMiniboss();                       // la sacudida más grande del juego
    for (let i = 0; i < 20; i++) await new Promise(r => requestAnimationFrame(r));
    const despues = { mx: miniboss ? miniboss.x : null, my: miniboss ? miniboss.y : null,
                      px: player.x, py: player.y };
    paused = false; miniboss = null;
    return {
      jugador: antes.px === despues.px && antes.py === despues.py,
      sacudidas: VFX.metricas().sacudidas, max: VFX.metricas().maxSacudidas,
      save: SAVE.estado().ok, saveV: SAVE.estado().version,
      musica: MUSICA.debug().modo, banco: muestrasDbg.listas,
    };
  });
  comprobar(r.jugador, "la sacudida de muerte de jefe no mueve al jugador");
  comprobar(r.sacudidas <= r.max, "ni acumula sacudidas",
    r.sacudidas + "/" + r.max);
  comprobar(r.save && r.saveV === 2, "guardado intacto", "v" + r.saveV);
  comprobar(r.musica === "webaudio", "música intacta", r.musica);
  comprobar(r.banco > 0, "audio intacto", r.banco + " muestras");
  comprobar(errs.length === 0, "sin errores JS ni 404", errs.slice(0, 3).join(" | "));
}

await nav.close();
srv.cerrar();
console.log("\n" + (fallos.length
  ? "FALLOS: " + fallos.length + "\n - " + fallos.join("\n - ")
  : "Todo correcto."));
process.exit(fallos.length ? 1 : 0);
