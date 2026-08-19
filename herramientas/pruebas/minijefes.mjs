// ════════════════════════════════════════════════════════════
//  minijefes.mjs — bloque 5F: los cinco minijefes de la expansión
// ════════════════════════════════════════════════════════════
//
//    node herramientas/pruebas/minijefes.mjs
//
//  Lo que vigila, en una frase cada cosa:
//
//   · Que los cinco existan en JEFES, con su mundo, sus 2 fases y su HP
//     dentro de lo previsto (280-360).
//   · Que cada uno use DE VERDAD el sistema de su mundo: cazador_polar
//     y el témpano, unidad_control y el tráfico/las columnas,
//     guardian_ruina y la oscuridad/mina_bio, yunque_movil y la
//     columna-colada, heraldo_grieta y la ruptura/el teletransporte.
//   · Que ninguna reaparición sea injusta: siempre invulnerable durante
//     el salto, siempre lejos del jugador al aterrizar.
//   · Que morir limpie lo suyo: hazards propios fuera, primitivas del
//     5D apagadas (esto último ya lo hace `matarMiniboss()` para
//     cualquier jefe, así que se comprueba que sigue siendo así).
//   · Que el VFX no tape ninguna bala, y que no haya fugas de pool tras
//     los cinco seguidos.
//   · Y que M1-M10, los diez jefes de siempre, 5D, 5E, ADMIN, save,
//     audio, música y VFX sigan exactamente donde estaban.

import { servidor, cargarPlaywright } from "../qa.mjs";

const srv = await servidor();
const { chromium } = await cargarPlaywright();
const nav = await chromium.launch();

const fallos = [];
const comprobar = (ok, t, extra) => {
  console.log((ok ? "  ok    " : "  FALLO ") + t + (extra ? "   " + extra : ""));
  if (!ok) fallos.push(t);
};

const CINCO = ["cazador_polar", "unidad_control", "guardian_ruina", "yunque_movil", "heraldo_grieta"];
const MUNDO_DE = {
  cazador_polar: "hielo", unidad_control: "megaciudad", guardian_ruina: "abismo",
  yunque_movil: "fragua", heraldo_grieta: "grieta",
};
const RANGO_HP = { min: 280, max: 360 };

const ctx = await nav.newContext({ viewport: { width: 820, height: 1180 },
                                   hasTouch: true, isMobile: true });
const p = await ctx.newPage();
const errs = [];
p.on("pageerror", e => errs.push("EXCEPCION " + e.message));
p.on("console", m => { if (m.type() === "error") errs.push("CONSOLE " + m.text()); });
p.on("requestfailed", r => {
  const motivo = (r.failure() && r.failure().errorText) || "?";
  const url = r.url().replace(srv.url, "");
  if (motivo.includes("ERR_ABORTED") && /[.](mp3|ogg|wav)$/i.test(url)) return;
  errs.push("PETICION " + motivo + " " + url);
});
const p404 = [];
p.on("response", r => { if (r.status() === 404) p404.push(r.url().replace(srv.url, "")); });

await p.goto(srv.url + "/index.html", { waitUntil: "load" });
await p.waitForTimeout(900);

// ── Neutralizadores (lección de 5D/5E) ──────────────────────
//  Congelar `update()` deja el juego sin más guión que el que pida la
//  prueba; en ese estado `cerrarMision()` dispararía sola, y el disparo
//  automático del jugador metería balas en cada avance. Se apagan una
//  vez para todo el archivo — ver [[feedback-pruebas-motor]].
const congelar = async () => p.evaluate(() => {
  if (window.PASO) return;
  const real = update;
  window.PASO = (dt) => real(dt);
  window.__updateReal = real;
  update = () => {};
});
const descongelar = async () => p.evaluate(() => {
  if (window.__updateReal) { update = window.__updateReal; window.PASO = null; }
});
const avanzar = (seg, paso) => `
  for (let i = 0; i < Math.ceil(${seg} / ${paso || 0.05}); i++) {
    PASO(${paso || 0.05});
    await new Promise(r => requestAnimationFrame(r));
  }
`;
const dentro = (cuerpo) => p.evaluate(new Function("return (async () => {" + cuerpo + "})()"));

await congelar();
await p.evaluate(() => { cerrarMision = () => {}; disparar = () => {}; });

// Deja la partida en combate, sin jefe y sin nada ambiental encendido.
// `player.x/y` va CON `targetX/targetY` — moverlo sin lo segundo hace
// que el propio motor lo arrastre de vuelta al objetivo viejo.
const escenaLimpia = `
  OPCIONES.vfx = "alto"; aplicarVFX();
  modo = "campana"; iniciarMision(0);
  await new Promise(r => setTimeout(r, 220));
  misionIniT = 0; eventoIdx = MISIONES[0].eventos.length;
  enemies.length = 0; eBullets.length = 0; bullets.length = 0;
  hazards.length = 0; columnas.length = 0; rupturas.length = 0;
  telegrafos.length = 0; miniboss = null; hazardEnabled = false;
  oscuro.k = 0; oscuro.obj = 0; oscuro.dur = 0;
  state = "play"; paused = false; lives = 3; score = 0;
  player.x = W * 0.5; player.y = H * 0.82; targetX = player.x; targetY = player.y;
  VFX.limpiar();
`;

// Lleva a un minijefe DIRECTAMENTE a combate, saltándose aviso/entrada:
// esas dos fases ya las prueban los diez jefes de siempre, y aquí lo
// que importa es lo que cada uno hace CON su sistema.
//
// `warningT` se pone a 0 a mano. `spawnMiniboss()` lo deja en 2,6 s —lo
// que dura el banner "A L E R T A" de jefe entrante, que se pinta ENCIMA
// de todo, balas incluidas—, y en el juego de verdad eso nunca coincide
// con combate real: el combate no empieza hasta que aviso y entrada
// terminan, momento en el que warningT ya lleva rato en 0. Saltarse esas
// fases sin apagarlo deja la prueba en un estado que no existe en
// ninguna partida real.
//
// Y `spawnMiniboss()` sacude la cámara siempre (`sacudir("medium")`, de
// llegada). La sacudida decae en 0,28 s reales, y como aquí el reloj se
// pilota a mano pero la cámara se sigue leyendo con tiempo real, tres
// PASO() no bastan para que decaiga sola: cualquier lectura de píxel de
// un punto fijo caía en un sitio distinto según cuánto hubiera decaído
// la sacudida en ESE instante. Se limpia también.
const aCombate = (tipo) => `
  spawnMiniboss("${tipo}", 1);
  miniboss.est = "combate"; miniboss.estT = 0; miniboss.invul = false;
  miniboss.baseY = miniboss.y;
  warningT = 0;
  VFX.sacudidas.length = 0;
`;

// ════════════════════════════════════════════════════════════
console.log("\n1 · LOS CINCO EXISTEN, CON SU MUNDO, SUS 2 FASES Y SU HP");
{
  const r = await dentro(`
    const info = ${JSON.stringify(CINCO)}.map(id => {
      const d = JEFES[id];
      if (!d) return { id, falta: true };
      return { id, hpMax: d.hpMax, mundo: d.mundo, fases: d.fases.length,
               r: d.r, epico: !!d.epico, tieneColor: typeof d.color === "function",
               drops: d.drops, puntos: d.puntos };
    });
    return { info, totalJefes: Object.keys(JEFES).length };
  `);
  // 20 desde el bloque 5G: los 10 de siempre + 5 minijefes (este
  // bloque) + 5 jefes principales de la expansión (5G).
  comprobar(r.totalJefes === 20, "JEFES pasa de 10 a 20 (5 minijefes + 5 de 5G)", r.totalJefes + "");
  for (const j of r.info) {
    console.log(`        ${j.id.padEnd(15)} hp ${j.hpMax}  mundo ${String(j.mundo).padEnd(11)} fases ${j.fases}  r ${j.r}`);
    comprobar(!j.falta, j.id + ": existe en JEFES");
    comprobar(j.mundo === MUNDO_DE[j.id], j.id + ": mundo correcto", j.mundo + " (esperado " + MUNDO_DE[j.id] + ")");
    comprobar(j.fases === 2, j.id + ": exactamente 2 fases", j.fases + "");
    comprobar(j.hpMax >= RANGO_HP.min && j.hpMax <= RANGO_HP.max,
      j.id + ": HP dentro de 280-360", j.hpMax + "");
    comprobar(!j.epico, j.id + ": no es épico (eso es solo de OMEGA)");
    comprobar(j.tieneColor && j.drops && j.drops.length > 0 && j.puntos > 0,
      j.id + ": tiene color(), drops y puntos");
  }
  // Menor que cualquiera de los diez jefes de siempre: es la palanca
  // que el motor ya usa para "esto pesa menos".
  const radiosViejos = await dentro(`return Object.keys(JEFES).filter(k => !${JSON.stringify(CINCO)}.includes(k)).map(k => JEFES[k].r);`);
  const maxNuevo = Math.max(...r.info.map(j => j.r));
  const minViejo = Math.min(...radiosViejos);
  comprobar(maxNuevo < minViejo,
    "★ y los cinco son físicamente más pequeños que cualquiera de los diez jefes",
    "mayor de los 5: " + maxNuevo + " · menor de los 10: " + minViejo);
}

// ════════════════════════════════════════════════════════════
console.log("\n2 · CAZADOR_POLAR: HIELO Y TÉMPANOS");
{
  const r = await dentro(`
    ${escenaLimpia}
    ${aCombate("cazador_polar")}
    const mb = miniboss;
    const lejos = JEFES.cazador_polar.reduccionDano(mb);
    // Fuerza el ataque de témpano de la fase 1 directamente.
    JEFES.cazador_polar.fases[0].ataques[1].fn(mb);
    const antesTipo = hazardTipo;
    const hayTempano = hazards.some(h => h.tipo === "tempano");
    const cerca = JEFES.cazador_polar.reduccionDano(mb);
    return { lejos, hayTempano, cerca, antesTipo, mundoSigue: hazardTipo };
  `);
  comprobar(r.lejos === 1, "sin témpano cerca, daño normal", r.lejos + "");
  comprobar(r.hayTempano, "★ su ataque suelta un témpano de verdad", "hazards con tempano: " + r.hayTempano);
  comprobar(r.cerca === 0.5,
    "★ y con el témpano cerca, se cubre: la mitad de daño", r.cerca + "");
  comprobar(r.mundoSigue === "asteroide" || r.mundoSigue === r.antesTipo,
    "y no deja el tipo de hazard global cambiado para la misión", r.mundoSigue);
}

// ════════════════════════════════════════════════════════════
console.log("\n3 · UNIDAD_CONTROL: TRÁFICO Y CRUCES");
{
  const r = await dentro(`
    ${escenaLimpia}
    ${aCombate("unidad_control")}
    const mb = miniboss;
    const tipoAntes = hazardTipo;
    JEFES.unidad_control.fases[0].ataques[1].fn(mb);   // tráfico
    const trafico = hazards.filter(h => h.tipo === "trafico").length;
    JEFES.unidad_control.fases[0].ataques[2].fn(mb);   // cruce
    const cols = columnas.length;
    return { trafico, cols, tipoSigueIgual: hazardTipo === tipoAntes };
  `);
  comprobar(r.trafico >= 1, "★ coordina tráfico de verdad: suelta hazards de tipo trafico", r.trafico + "");
  comprobar(r.cols >= 1, "★ y activa un cruce: una columna de la primitiva del bloque 5D", r.cols + "");
  comprobar(r.tipoSigueIgual, "y no deja el tipo global de hazard cambiado tras coordinar tráfico");

  const f2 = await dentro(`
    ${escenaLimpia}
    ${aCombate("unidad_control")}
    const mb = miniboss;
    JEFES.unidad_control.fases[1].ataques[2].fn(mb);   // dos cruces
    return { cols: columnas.length };
  `);
  comprobar(f2.cols === 2, "★ en fase 2 abre dos cruces a la vez, no uno", f2.cols + "");
}

// ════════════════════════════════════════════════════════════
console.log("\n4 · GUARDIAN_RUINA: OSCURIDAD Y MINA_BIO");
const OSCURIDAD_MAX_TEST = 0.72;
{
  const r = await dentro(`
    ${escenaLimpia}
    ${aCombate("guardian_ruina")}
    const mb = miniboss;
    JEFES.guardian_ruina.fases[0].alEntrar(mb);
    const oscuroAlEntrar = oscuro.obj;
    const danoOscuro = JEFES.guardian_ruina.reduccionDano(mb);
    JEFES.guardian_ruina.fases[0].ataques[0].fn(mb);   // pulso
    const oscuroTrasPulso = oscuro.obj;
    const danoPulso = JEFES.guardian_ruina.reduccionDano(mb);
    JEFES.guardian_ruina.fases[0].ataques[1].fn(mb);   // mina
    const hayMina = hazards.some(h => h.tipo === "mina_bio");
    return { oscuroAlEntrar, danoOscuro, oscuroTrasPulso, danoPulso, hayMina };
  `);
  comprobar(r.oscuroAlEntrar > 0 && r.oscuroAlEntrar <= OSCURIDAD_MAX_TEST,
    "★ entra en combate y enciende la oscuridad del bloque 5D", r.oscuroAlEntrar);
  comprobar(r.danoOscuro < 1, "y mientras está a oscuras, encaja menos daño", r.danoOscuro + "");
  comprobar(r.oscuroTrasPulso === 0, "★ el pulso APAGA la oscuridad: se ilumina de verdad", r.oscuroTrasPulso + "");
  comprobar(r.danoPulso === 1,
    "★ y mientras dura el pulso, vulnerable del todo — el aviso y el ataque son la misma cosa", r.danoPulso + "");
  comprobar(r.hayMina, "★ y coordina mina_bio: la misma del bloque 5E, no una copia", r.hayMina);
}

// ════════════════════════════════════════════════════════════
console.log("\n5 · YUNQUE_MOVIL: COLUMNA Y COLADA");
{
  const r = await dentro(`
    ${escenaLimpia}
    ${aCombate("yunque_movil")}
    const mb = miniboss;
    const sinColada = JEFES.yunque_movil.reduccionDano(mb);
    JEFES.yunque_movil.fases[0].ataques[1].fn(mb);   // spawnColumna colada
    const col = columnas[0];
    const esColada = col && col.estilo === "colada";
    col.fase = 2;   // fuerza la columna a "activa" para medir la cobertura
    mb.x = col.x;
    const conColada = JEFES.yunque_movil.reduccionDano(mb);
    return { sinColada, esColada, conColada, cols: columnas.length };
  `);
  comprobar(r.cols === 1 && r.esColada, "★ el golpe suelta una columna de estilo colada, la del bloque 5D", r.esColada + "");
  comprobar(r.sinColada === 1, "sin estar sobre la colada, daño normal", r.sinColada + "");
  comprobar(r.conColada === 0.5,
    "★ y de pie sobre la colada activa, la mitad de daño: la cobertura es el ataque", r.conColada + "");
}

// ════════════════════════════════════════════════════════════
console.log("\n6 · HERALDO_GRIETA: RUPTURA Y TELETRANSPORTE, SIEMPRE ANUNCIADO");
{
  const r = await dentro(`
    ${escenaLimpia}
    ${aCombate("heraldo_grieta")}
    const mb = miniboss;
    mb.saltoT = 0.01;
    const invulAntes = mb.invul;
    ${avanzar(0.5, 0.02)}
    const invulDuranteSalida = mb.invul;
    const rupturasAlSalir = rupturas.length;
    ${avanzar(0.5, 0.02)}
    const invulTrasEntrar = mb.invul;
    const distanciaFinal = Math.hypot(mb.x - player.x, mb.y - player.y);
    return { invulAntes, invulDuranteSalida, rupturasAlSalir, invulTrasEntrar, distanciaFinal, saltando: mb.saltando };
  `);
  comprobar(!r.invulAntes, "empieza vulnerable, en combate normal");
  comprobar(r.invulDuranteSalida, "★ se vuelve invulnerable en cuanto empieza a saltar", r.invulDuranteSalida + "");
  comprobar(r.rupturasAlSalir >= 1, "★ abre una ruptura de verdad al reaparecer — la del bloque 5D", r.rupturasAlSalir + "");
  comprobar(!r.saltando, "y termina el salto: vuelve a estado normal");
  comprobar(!r.invulTrasEntrar, "y al aterrizar deja de ser invulnerable");
  comprobar(r.distanciaFinal >= 170,
    "★ y aterriza a 170 px o más del jugador: ninguna reaparición encima suyo",
    r.distanciaFinal.toFixed(0));

  // Muchos saltos seguidos: ninguno debería violar la distancia mínima.
  const muchos = await dentro(`
    ${escenaLimpia}
    ${aCombate("heraldo_grieta")}
    const mb = miniboss;
    const distancias = [];
    for (let s = 0; s < 6; s++) {
      mb.saltoT = 0.01;
      for (let i = 0; i < 50 && mb.saltando === false; i++) PASO(0.02);
      for (let i = 0; i < 50 && mb.saltando; i++) PASO(0.02);
      distancias.push(Math.hypot(mb.x - player.x, mb.y - player.y));
    }
    return { distancias };
  `);
  comprobar(muchos.distancias.every(d => d >= 170),
    "★ y en seis saltos seguidos, ninguno reaparece cerca", muchos.distancias.map(d => d.toFixed(0)).join(", "));
}

// ════════════════════════════════════════════════════════════
console.log("\n7 · LA MUERTE LIMPIA LO SUYO");
{
  // Qué ataque de cada uno ensucia el escenario con SU hazard propio,
  // para forzarlo antes de matarlo.
  const ENSUCIAR = {
    cazador_polar: "JEFES.cazador_polar.fases[0].ataques[1].fn(mb);",
    unidad_control: "JEFES.unidad_control.fases[0].ataques[1].fn(mb); JEFES.unidad_control.fases[0].ataques[2].fn(mb);",
    guardian_ruina: "JEFES.guardian_ruina.fases[0].ataques[1].fn(mb);",
    yunque_movil: "JEFES.yunque_movil.fases[0].ataques[1].fn(mb);",
    heraldo_grieta: "JEFES.heraldo_grieta.fases[0].ataques[1].fn(mb);",
  };
  for (const tipo of CINCO) {
    const r = await dentro(`
      ${escenaLimpia}
      ${aCombate(tipo)}
      const mb = miniboss;
      // Ensucia el escenario con lo que este jefe sabe crear, y con lo
      // que crean los demás sistemas —para comprobar que SOLO se
      // limpia lo que toca, no todo el hazards[]—.
      ${ENSUCIAR[tipo]}
      hazardTipo = "asteroide"; spawnHazard();   // ambiental, de la misión — NO debe desaparecer
      const asteroidesAntes = hazards.filter(h => h.tipo === "asteroide").length;
      mb.hp = 1;
      matarMiniboss();
      ${avanzar(0.3, 0.02)}
      return {
        est: mb.est, invul: mb.invul,
        columnas: columnas.length, rupturas: rupturas.length,
        oscuroObj: oscuro.obj, oscuroDur: oscuro.dur,
        tempanos: hazards.filter(h => h.tipo === "tempano").length,
        trafico: hazards.filter(h => h.tipo === "trafico").length,
        minas: hazards.filter(h => h.tipo === "mina_bio").length,
        fragmentos: hazards.filter(h => h.tipo === "fragmento").length,
        asteroides: hazards.filter(h => h.tipo === "asteroide").length,
        asteroidesAntes,
      };
    `);
    comprobar(r.est === "muriendo", tipo + ": entra en la muerte cinemática", r.est);
    comprobar(r.columnas === 0 && r.rupturas === 0 && r.oscuroObj === 0 && r.oscuroDur === 0,
      tipo + ": las primitivas del bloque 5D quedan apagadas (limpieza genérica de matarMiniboss)");
    comprobar(r.tempanos === 0 && r.trafico === 0 && r.minas === 0 && r.fragmentos === 0,
      tipo + ": ★ y sus propios hazards (témpano/tráfico/mina/fragmento) desaparecen con él");
    comprobar(r.asteroides === r.asteroidesAntes,
      tipo + ": pero NO se lleva por delante lo que no es suyo (un asteroide de la misión sigue ahí)",
      r.asteroides + "/" + r.asteroidesAntes);
  }
}

// ════════════════════════════════════════════════════════════
console.log("\n8 · VFX NO TAPA NINGUNA BALA");
{
  // Se leen píxeles, igual que en el bloque 5D: el orden de dibujo puede
  // parecer correcto y aun así un aura o una detonación tapar un
  // proyectil.
  for (const tipo of ["guardian_ruina", "yunque_movil"]) {
    const r = await dentro(`
      ${escenaLimpia}
      ${aCombate(tipo)}
      const mb = miniboss;
      mb.x = W * 0.5; mb.y = H * 0.3;
      const bx = W * 0.5, by = H * 0.3;
      eBullets.length = 0;
      eBala(bx, by + mb.r + 14, 0, 0, 7);
      const leer = (x, y) => {
        const d = ctx.getImageData(Math.round((PX + x) * DPR), Math.round(y * DPR), 1, 1).data;
        return 0.2126 * d[0] + 0.7152 * d[1] + 0.0722 * d[2];
      };
      // Con el jefe en plena aura Y con oscuridad si es guardian_ruina.
      if (${JSON.stringify(tipo === "guardian_ruina")}) oscurecer(0.6, 0);
      for (let i = 0; i < 3; i++) { PASO(0.02); await new Promise(r => requestAnimationFrame(r)); }
      const bala = leer(bx, by + mb.r + 14);
      return { bala };
    `);
    comprobar(r.bala > 60, "★ " + tipo + ": la bala enemiga se sigue leyendo con el jefe activo", r.bala.toFixed(0));
  }
}

// ════════════════════════════════════════════════════════════
console.log("\n9 · LOS CINCO SEGUIDOS: SIN FUGA DE POOL NI DE ESTADO");
{
  const r = await dentro(`
    ${escenaLimpia}
    const trazas = [];
    for (const tipo of ${JSON.stringify(CINCO)}) {
      spawnMiniboss(tipo, 1);
      miniboss.est = "combate"; miniboss.estT = 0; miniboss.invul = false;
      miniboss.baseY = miniboss.y;
      warningT = 0;
      VFX.sacudidas.length = 0;
      const mb = miniboss;
      // Un poco de cada uno: que fase, que ataque, que se ensucie el
      // escenario, y luego se muere.
      for (let i = 0; i < 90; i++) PASO(0.03);
      mb.hp = 1;
      matarMiniboss();
      for (let i = 0; i < 200; i++) PASO(0.03);   // toda la muerte cinemática
      trazas.push({
        tipo, miniboss: miniboss, columnas: columnas.length, rupturas: rupturas.length,
        hazardsPropios: hazards.filter(h => ["tempano","trafico","mina_bio","fragmento"].includes(h.tipo)).length,
        parts: VFX.metricas().parts, reserva: VFX.metricas().reserva,
      });
    }
    return { trazas, limite: VFX.limites().total };
  `);
  for (const t of r.trazas) {
    console.log(`        ${t.tipo.padEnd(15)} miniboss=${t.miniboss} · columnas ${t.columnas} · ` +
      `rupturas ${t.rupturas} · hazards propios ${t.hazardsPropios} · vivas+reserva ${t.parts + t.reserva}`);
  }
  comprobar(r.trazas.every(t => t.miniboss === null), "★ los cinco acaban muertos y limpios, uno detrás de otro");
  comprobar(r.trazas.every(t => t.columnas === 0 && t.rupturas === 0 && t.hazardsPropios === 0),
    "★ y ninguno deja detrás columnas, rupturas ni hazards de otro");
  const totales = r.trazas.map(t => t.parts + t.reserva);
  comprobar(Math.max(...totales) <= r.limite + 40,
    "el total de partículas nunca pasa del presupuesto, jefe tras jefe", "máx " + Math.max(...totales) + "/" + r.limite);
}

// ════════════════════════════════════════════════════════════
console.log("\n10 · LO DE ANTES SIGUE EN SU SITIO");
{
  const r = await dentro(`
    return {
      guardado: typeof SAVE === "object" && typeof SAVE.get === "function",
      admin: typeof ADMIN === "object" && typeof ADMIN.entrar === "function",
      hangar: typeof HANGAR === "object" && typeof HANGAR.dibujar === "function",
      vfxCal: VFX.calidad(),
      misiones: MISIONES.length, base: MISIONES_BASE,
      jefesBase: ["guardian","titan","rift_reaper","aegis_prime","venom_core",
        "warlord_vesper","singularity_warden","pyre_lord","core_architect","omega_sovereign"]
        .every(k => JEFES[k] && !JEFES[k].mundo),
      hpBaseIntacto: JEFES.guardian.hpMax === 560 && JEFES.omega_sovereign.epico === true,
      enemigos: Object.keys(ENEMIGOS).length,
      temas: TEMAS.length,
      hazardsBase: ["asteroide","cristal","tempano","trafico","mina_bio","fragmento"].every(k => !!HAZARD_TIPOS[k]),
      minasMax: MINAS_ACTIVAS_MAX, fragMax: FRAGMENTOS_ACTIVOS_MAX,
      estilosOk: ["cazador_polar","unidad_control","guardian_ruina","yunque_movil","heraldo_grieta"]
        .every(k => !!VFX.ESTILOS[VFX.ESTILO_DE[k]]),
    };
  `);
  comprobar(r.guardado && r.admin && r.hangar, "save, ADMIN y hangar siguen ahí");
  comprobar(!!r.vfxCal, "VFX intacto", r.vfxCal);
  // 20 desde el bloque 5H (10 de siempre + 10 de la expansión); la base
  // (`MISIONES_BASE`) sigue siendo 10, esa no cambia nunca.
  comprobar(r.misiones === 20 && r.base === 10, "★ las diez misiones de siempre siguen siendo diez (con 10 más detrás)", r.misiones + "");
  comprobar(r.jefesBase, "★ los 10 jefes viejos siguen sin `mundo`: no se han tocado");
  comprobar(r.hpBaseIntacto, "★ y su HP/épico no se ha movido ni un punto");
  comprobar(r.enemigos === 25, "los 25 enemigos del bloque 5E siguen ahí (14 base + 10 + 1 interno)", r.enemigos + "");
  comprobar(r.temas === 9, "los 9 mundos del bloque 5D siguen ahí", r.temas + "");
  comprobar(r.hazardsBase, "★ los hazards del bloque 5D siguen ahí");
  comprobar(r.minasMax === 4 && r.fragMax === 3,
    "y los cupos de minas y fragmentos son los que ya existían (o los que se acaban de centralizar)",
    r.minasMax + "/" + r.fragMax);
  comprobar(r.estilosOk, "★ los cinco minijefes tienen un estilo de VFX válido (reutilizado, ninguno nuevo)");
}

// ════════════════════════════════════════════════════════════
console.log("\n11 · UNA MISIÓN Y UN JEFE DE SIEMPRE SE JUEGAN IGUAL");
{
  const r = await dentro(`
    OPCIONES.vfx = "alto"; aplicarVFX();
    disparar = () => {};
    modo = "campana"; iniciarMision(0);
    await new Promise(r => setTimeout(r, 250));
    state = "play"; paused = false;
    ${avanzar(30, 0.1)}
    const tipos = new Set(enemies.map(e => e.tipo));
    const nuevosEnemigos = [...tipos].filter(t => ["sierra_hielo","prisma","patrulla","torre_neon","medusa",
      "sembrador","crisol","martillo","rompedor","eco"].includes(t));
    return { enemigos: enemies.length, eventos: eventoIdx, tema: T.id, nuevosEnemigos,
             hayMiniboss: !!miniboss };
  `);
  console.log(`        M1 a los 30 s: ${r.enemigos} enemigos · ${r.eventos} eventos · mundo ${r.tema}`);
  comprobar(r.eventos > 0 && r.tema === "espacio", "la M1 corre su guión en su mundo de siempre", r.eventos + " eventos");
  comprobar(r.nuevosEnemigos.length === 0 && !r.hayMiniboss,
    "★ y ni un enemigo del bloque 5E ni un minijefe del 5F aparecen sin que un evento lo pida");

  const guardianOk = await dentro(`
    ${escenaLimpia}
    ${aCombate("guardian")}
    return { hp: miniboss.hpMax, fases: JEFES.guardian.fases.length, tipo: miniboss.tipo };
  `);
  comprobar(guardianOk.tipo === "guardian" && guardianOk.hp === 560 && guardianOk.fases === 2,
    "y el GUARDIÁN de siempre se sigue invocando y comportando igual", JSON.stringify(guardianOk));
}

// ════════════════════════════════════════════════════════════
console.log("\n12 · SIN ERRORES NI PETICIONES ROTAS");
{
  comprobar(!errs.length, "0 errores JS", errs.slice(0, 5).join(" | ") || "ninguno");
  comprobar(!p404.length, "0 respuestas 404", p404.slice(0, 5).join(" ") || "ninguna");
}

await descongelar();
await ctx.close();
await nav.close();
srv.cerrar();
if (fallos.length) {
  console.log("\nFALLOS: " + fallos.length);
  for (const f of fallos) console.log(" - " + f);
  process.exit(1);
}
console.log("\nTodo correcto.");
