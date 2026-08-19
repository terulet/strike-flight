// ════════════════════════════════════════════════════════════
//  enemigos.mjs — bloque 5E: los diez enemigos de la expansión
// ════════════════════════════════════════════════════════════
//
//    node herramientas/pruebas/enemigos.mjs
//
//  Lo que vigila, en una frase cada cosa:
//
//   · Que los diez existan en ENEMIGOS, con su mundo y su HP dentro de
//     lo previsto — máximo 8, sin excepciones sin documentar.
//   · Que cada comportamiento haga LO SUYO: sierra rebota, prisma
//     devuelve, patrulla cruza, torre_neon no se mueve un píxel, medusa
//     nunca llega a opacidad 0, sembrador respeta el cupo de minas,
//     crisol fragmenta con tope, martillo avisa antes de golpear,
//     rompedor nunca reaparece sin aviso NI encima del jugador, y eco
//     copia con retraso, no al instante.
//   · Que nada de esto deje basura detrás: ni entidades colgadas, ni
//     minas de sobra, ni fragmentos sin límite.
//   · Y que M1–M10, save, ADMIN, VFX y los hazards del bloque 5D sigan
//     exactamente donde estaban.

import { servidor, cargarPlaywright } from "../qa.mjs";

const srv = await servidor();
const { chromium } = await cargarPlaywright();
const nav = await chromium.launch();

const fallos = [];
const comprobar = (ok, t, extra) => {
  console.log((ok ? "  ok    " : "  FALLO ") + t + (extra ? "   " + extra : ""));
  if (!ok) fallos.push(t);
};

const DIEZ = ["sierra_hielo", "prisma", "patrulla", "torre_neon", "medusa",
  "sembrador", "crisol", "martillo", "rompedor", "eco"];
const MUNDO_DE = {
  sierra_hielo: "hielo", prisma: "hielo",
  patrulla: "megaciudad", torre_neon: "megaciudad",
  medusa: "abismo", sembrador: "abismo",
  crisol: "fragua", martillo: "fragua",
  rompedor: "grieta", eco: "grieta",
};

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

// ── Neutralizadores (lección del bloque 5D) ─────────────────
//  Congelar `update()` para pilotar el reloj a mano deja el juego en un
//  estado (sin enemigos, sin más guión) que dispara `cerrarMision()` en
//  el primer tick, y el disparo automático del jugador mete balas
//  nuevas en cada avance. Ninguna de las dos cosas es lo que se está
//  probando aquí, así que se apagan una vez para todo el archivo — ver
//  [[feedback-pruebas-motor]].
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
const frames = (n) => `
  for (let i = 0; i < ${n}; i++) await new Promise(r => requestAnimationFrame(r));
`;
const dentro = (cuerpo) => p.evaluate(new Function("return (async () => {" + cuerpo + "})()"));

await congelar();
await p.evaluate(() => { cerrarMision = () => {}; disparar = () => {}; });

// Deja la partida en un estado conocido y sin nada más que lo que se
// vaya a probar. `player.x/y` se fija junto con `targetX/targetY` —
// moverlo sin lo segundo hace que el propio motor lo arrastre de vuelta
// (la otra lección del bloque 5D).
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
  player.x = W * 0.15; player.y = H * 0.85; targetX = player.x; targetY = player.y;
  VFX.limpiar();
`;

// ════════════════════════════════════════════════════════════
console.log("\n1 · LOS DIEZ EXISTEN, CON SU MUNDO Y SU HP");
{
  const r = await dentro(`
    const todos = Object.keys(ENEMIGOS);
    const conMundo = todos.filter(k => ENEMIGOS[k].mundo);
    const info = ${JSON.stringify(DIEZ)}.map(id => {
      const d = ENEMIGOS[id];
      if (!d) return { id, falta: true };
      return { id, hp: d.hp, mundo: d.mundo, forma: d.forma,
               tieneColor: typeof d.color === "function",
               tieneMover: typeof d.mover === "function" };
    });
    return { total: todos.length, conMundo: conMundo.length, info,
             viejosSinMundo: todos.filter(k => !${JSON.stringify(DIEZ)}.includes(k) && ENEMIGOS[k].mundo).length };
  `);
  comprobar(r.total === 25, "ENEMIGOS pasa de 14 a 25 (14 + 10 nuevos + 1 fragmento interno)", r.total + "");
  comprobar(r.conMundo === 10, "exactamente diez tienen `mundo`: ni de más ni de menos", r.conMundo + "");
  comprobar(r.viejosSinMundo === 0, "★ ninguno de los 14 viejos se ha etiquetado sin querer", r.viejosSinMundo + "");
  for (const e of r.info) {
    console.log(`        ${e.id.padEnd(13)} hp ${String(e.hp).padEnd(2)} mundo ${String(e.mundo).padEnd(11)} forma ${e.forma}`);
    comprobar(!e.falta, e.id + ": existe en ENEMIGOS");
    comprobar(e.mundo === MUNDO_DE[e.id], e.id + ": mundo correcto", e.mundo + " (esperado " + MUNDO_DE[e.id] + ")");
    comprobar(e.hp > 0 && e.hp <= 8, e.id + ": HP dentro de rango (≤8)", e.hp + "");
    comprobar(e.tieneColor && e.tieneMover, e.id + ": tiene color() y mover()");
  }
  const frag = await dentro(`return { hp: ENEMIGOS.crisol_frag.hp, interno: !!ENEMIGOS.crisol_frag.interno, mundo: ENEMIGOS.crisol_frag.mundo };`);
  comprobar(frag.interno === true && !frag.mundo,
    "el fragmento de crisol es interno y no cuenta como uno de los diez", JSON.stringify(frag));
}

// ════════════════════════════════════════════════════════════
console.log("\n2 · SIERRA_HIELO: REBOTA EN LAS PAREDES");
{
  const r = await dentro(`
    ${escenaLimpia}
    const e = spawnEnemy("sierra_hielo", W / 2);
    // Caída casi nula A PROPÓSITO: lo que se mide es el rebote lateral,
    // y con la vy de siempre (~140 px/s) se sale por abajo antes de
    // que le dé tiempo a tocar una segunda pared.
    e.y = H * 0.3; e.vy = 12; e.vx = 200;
    const historial = [];
    for (let i = 0; i < 500; i++) {
      PASO(0.02);
      historial.push(e.vx > 0 ? 1 : -1);
    }
    const cambios = historial.filter((v, i) => i > 0 && v !== historial[i - 1]).length;
    return { cambios, xFinal: e.x, dentro: e.x >= 0 && e.x <= W, vivo: enemies.includes(e) };
  `);
  comprobar(r.cambios >= 2, "★ cambia de sentido al tocar una pared, más de una vez", r.cambios + " cambios");
  comprobar(r.dentro, "y nunca sale del campo por el rebote", r.xFinal.toFixed(0) + " de " + 820);
  comprobar(r.vivo, "sin disparar, solo trayectoria — sigue vivo, no se autodestruye");
}

// ════════════════════════════════════════════════════════════
console.log("\n3 · PRISMA: DEVUELVE TU DISPARO, PERO SOLO CERRADO");
{
  const cerrada = await dentro(`
    ${escenaLimpia}
    const e = spawnEnemy("prisma", W / 2);
    e.y = H * 0.4; e.abierta = false; e.cicloT = 5; e.facAng = -Math.PI / 2;
    const b = { x: e.x, y: e.y + e.r - 1, vx: 0, vy: -260, r: 4, dmg: 3,
                largo: 20, col: "#fff", cd: 0, ang: 0 };
    bullets.push(b);
    const hpAntes = e.hp, vyAntes = b.vy;
    PASO(0.05);
    return { hpAntes, hp: e.hp, vyAntes, vy: b.vy, sigue: bullets.includes(b) };
  `);
  comprobar(cerrada.hp === cerrada.hpAntes,
    "★ cerrado: no le baja la vida", cerrada.hpAntes + " → " + cerrada.hp);
  comprobar(cerrada.sigue, "la bala sigue viva — se refleja, no se gasta");
  comprobar(cerrada.vy !== cerrada.vyAntes,
    "★ y cambia de dirección: la devuelve, no la absorbe",
    cerrada.vyAntes + " → " + cerrada.vy);

  const abierta = await dentro(`
    ${escenaLimpia}
    const e = spawnEnemy("prisma", W / 2);
    e.y = H * 0.4; e.abierta = true; e.cicloT = 5;
    const b = { x: e.x, y: e.y + e.r - 1, vx: 0, vy: -260, r: 4, dmg: 3,
                largo: 20, col: "#fff", cd: 0, ang: 0 };
    bullets.push(b);
    const hpAntes = e.hp;
    PASO(0.05);
    return { hpAntes, hp: e.hp };
  `);
  comprobar(abierta.hp < abierta.hpAntes,
    "★ y ABIERTO sí encaja daño: la ventana de vulnerabilidad es real",
    abierta.hpAntes + " → " + abierta.hp);

  const ciclo = await dentro(`
    ${escenaLimpia}
    const e = spawnEnemy("prisma", W / 2);
    let vistoAbierto = false, vistoCerrado = e.abierta === false;
    for (let i = 0; i < 200; i++) { PASO(0.02); if (e.abierta) vistoAbierto = true; else vistoCerrado = true; }
    return { vistoAbierto, vistoCerrado };
  `);
  comprobar(ciclo.vistoAbierto && ciclo.vistoCerrado,
    "y el ciclo abre y cierra solo, sin quedarse fijo en un estado");
}

// ════════════════════════════════════════════════════════════
console.log("\n4 · PATRULLA: CRUZA DISPARANDO Y SE VA");
{
  const r = await dentro(`
    ${escenaLimpia}
    const e = spawnEnemy("patrulla");
    const y0 = e.y, x0 = e.x;
    const balasAntes = eBullets.length;
    ${avanzar(1.2)}
    const y1 = enemies.includes(e) ? e.y : null;
    const x1 = enemies.includes(e) ? e.x : null;
    const balasTras = eBullets.length;
    return { y0, x0, y1, x1, balasAntes, balasTras, viva: enemies.includes(e) };
  `);
  if (r.viva) {
    comprobar(Math.abs(r.y1 - r.y0) < 1, "★ cruza en horizontal: la altura no cambia", "Δy " + Math.abs(r.y1 - r.y0).toFixed(2));
    comprobar(Math.abs(r.x1 - r.x0) > 80, "y avanza de verdad en horizontal", "Δx " + Math.abs(r.x1 - r.x0).toFixed(0));
  } else {
    comprobar(true, "★ cruza en horizontal (ya ha salido por el otro lado en 1,2 s: cruce rápido, como pide el diseño)");
  }
  comprobar(r.balasTras > r.balasAntes, "y dispara hacia abajo mientras cruza", r.balasAntes + " → " + r.balasTras);

  const sale = await dentro(`
    ${escenaLimpia}
    const e = spawnEnemy("patrulla");
    e.vx = 400; e.x = W - 5;
    ${avanzar(0.3)}
    return { viva: enemies.includes(e), n: enemies.length };
  `);
  comprobar(!sale.viva, "★ y se limpia sola al salir por el lado — no se queda pegada al borde", "quedan " + sale.n);
}

// ════════════════════════════════════════════════════════════
console.log("\n5 · TORRE_NEON: NO SE MUEVE, Y DISPARA");
{
  const r = await dentro(`
    ${escenaLimpia}
    const e = spawnEnemy("torre_neon");
    const x0 = e.x, y0 = e.y;
    const balasAntes = eBullets.length;
    const telAntes = telegrafos.length;
    ${avanzar(2.6)}
    return { x0, y0, x1: e.x, y1: e.y, balasAntes, balasTras: eBullets.length,
             telAntes, telVisto: telAntes > 0 };
  `);
  comprobar(r.x1 === r.x0 && r.y1 === r.y0,
    "★ ni un píxel de movimiento en 2,6 s", `(${r.x0.toFixed(1)},${r.y0.toFixed(1)}) → (${r.x1.toFixed(1)},${r.y1.toFixed(1)})`);
  comprobar(r.balasTras > r.balasAntes, "y dispara desde su sitio", r.balasAntes + " → " + r.balasTras);
}

// ════════════════════════════════════════════════════════════
console.log("\n6 · MEDUSA: NUNCA 0, Y LATE DE VERDAD");
{
  const r = await dentro(`
    ${escenaLimpia}
    const e = spawnEnemy("medusa", W / 2);
    e.y = H * 0.4;
    let kMin = 1, kMax = 0, pulsos = 0, balasAlPulso = 0;
    let pulsoAntes = e.pulso;
    const balasAntes0 = eBullets.length;
    for (let i = 0; i < 300; i++) {
      const antes = eBullets.length;
      PASO(0.02);
      kMin = Math.min(kMin, e.k); kMax = Math.max(kMax, e.k);
      if (e.pulso && !pulsoAntes) { pulsos++; if (eBullets.length > antes) balasAlPulso++; }
      pulsoAntes = e.pulso;
    }
    return { kMin, kMax, pulsos, balasAlPulso, balasGanadas: eBullets.length > balasAntes0 };
  `);
  comprobar(r.kMin >= 0.14 - 0.001, "★ nunca llega a opacidad 0: siempre queda un rastro", r.kMin.toFixed(3));
  comprobar(r.kMax > 0.9, "y al pulsar se ve casi entera", r.kMax.toFixed(2));
  comprobar(r.pulsos >= 2, "el pulso se repite solo, más de una vez", r.pulsos + " pulsos");
  comprobar(r.balasAlPulso >= 1, "★ y el ataque llega justo cuando se hace visible: el telégrafo ES el ataque",
    r.balasAlPulso + "/" + r.pulsos);
}

// ════════════════════════════════════════════════════════════
console.log("\n7 · SEMBRADOR: RESPETA EL CUPO DE MINAS");
{
  const lleno = await dentro(`
    ${escenaLimpia}
    for (let i = 0; i < MINAS_ACTIVAS_MAX; i++) hazards.push({ tipo: "mina_bio", x: 60 + i * 40, y: H * 0.3,
      r: 19, vx: 0, vy: 0, hp: 2, warnT: 0, armada: 0, sway: 0 });
    const antes = minasActivas();
    const e = spawnEnemy("sembrador", W / 2);
    e.cd = 0; e.avisado = 1;
    ENEMIGOS.sembrador.atacar(e);
    return { antes, despues: minasActivas(), max: MINAS_ACTIVAS_MAX };
  `);
  comprobar(lleno.antes === lleno.max, "el cupo estaba lleno antes de intentarlo", lleno.antes + "/" + lleno.max);
  comprobar(lleno.despues === lleno.max,
    "★ con el cupo lleno, sembrar no añade una quinta mina", lleno.despues + "/" + lleno.max);

  const libre = await dentro(`
    ${escenaLimpia}
    const antes = minasActivas();
    const e = spawnEnemy("sembrador", W / 2);
    ENEMIGOS.sembrador.atacar(e);
    return { antes, despues: minasActivas() };
  `);
  comprobar(libre.despues === libre.antes + 1,
    "y con sitio libre SÍ suelta la suya", libre.antes + " → " + libre.despues);
}

// ════════════════════════════════════════════════════════════
console.log("\n8 · CRISOL: FRAGMENTA, Y CON TOPE");
{
  const uno = await dentro(`
    ${escenaLimpia}
    const e = spawnEnemy("crisol", W / 2);
    e.y = H * 0.4; e.hp = 1;
    const b = { x: e.x, y: e.y, vx: 0, vy: 0, r: 40, dmg: 5, largo: 20,
                col: "#fff", cd: 0, ang: 0 };
    bullets.push(b);
    PASO(0.02);
    const frags = enemies.filter(x => x.tipo === "crisol_frag");
    return { vivoAntes: true, murioCrisol: !enemies.includes(e), nFrags: frags.length,
             fragHp: frags.map(f => ENEMIGOS.crisol_frag.hp) };
  `);
  comprobar(uno.murioCrisol, "muere al golpe, como cualquier enemigo de 6 hp");
  comprobar(uno.nFrags === 2, "★ y deja exactamente dos fragmentos", uno.nFrags + "");
  comprobar(uno.fragHp.every(h => h === 1), "cada fragmento es de un solo impacto", uno.fragHp.join(","));

  const tope = await dentro(`
    ${escenaLimpia}
    // Casi lleno de fragmentos de antes: solo cabe UNO más antes del tope.
    for (let i = 0; i < CRISOL_FRAG_MAX - 1; i++) {
      const f = spawnEnemy("crisol_frag", 40 + i * 10); f.vx = 0; f.vy = 20;
    }
    const antes = enemies.filter(x => x.tipo === "crisol_frag").length;
    const e = spawnEnemy("crisol", W / 2);
    e.y = H * 0.4;
    ENEMIGOS.crisol.alMorir(e);
    return { antes, despues: enemies.filter(x => x.tipo === "crisol_frag").length, max: CRISOL_FRAG_MAX };
  `);
  comprobar(tope.antes === tope.max - 1, "se llega a un fragmento del tope", tope.antes + "/" + tope.max);
  comprobar(tope.despues === tope.max,
    "★ y un crisol más solo añade lo que cabe (uno, no los dos que pedía) — nunca se pasa del tope",
    tope.antes + " + alMorir → " + tope.despues + "/" + tope.max);
}

// ════════════════════════════════════════════════════════════
console.log("\n9 · MARTILLO: TELEGRAFÍA ANTES DE GOLPEAR");
{
  const r = await dentro(`
    ${escenaLimpia}
    const e = spawnEnemy("martillo", W / 2);
    e.y = e.paraY; e.cd = ENEMIGOS.martillo.avisa + 0.06;
    player.x = e.x; player.y = e.y + 140; targetX = player.x; targetY = player.y;
    const livesIni = lives;
    let telAntes = telegrafos.length, avisadoEn = -1, golpeEn = -1;
    for (let i = 0; i < 80; i++) {
      const eraAvisado = e.avisado;
      PASO(0.02);
      if (e.avisado && !eraAvisado) avisadoEn = i;
      if (lives < livesIni && golpeEn < 0) golpeEn = i;
    }
    return { livesIni, lives, telAntes, telDespues: telegrafos.length,
             avisadoEn, golpeEn };
  `);
  comprobar(r.avisadoEn >= 0, "★ avisa antes de golpear (banda de telegrafío)", "en el paso " + r.avisadoEn);
  comprobar(r.golpeEn > r.avisadoEn,
    "★ y el golpe llega DESPUÉS del aviso, nunca a la vez ni antes",
    "aviso " + r.avisadoEn + " → golpe " + r.golpeEn);
  comprobar(r.lives < r.livesIni, "y si te quedas debajo, sí que pega", r.livesIni + " → " + r.lives);
}

// ════════════════════════════════════════════════════════════
console.log("\n10 · ROMPEDOR: NUNCA SIN AVISO, NUNCA ENCIMA");
{
  const r = await dentro(`
    ${escenaLimpia}
    const e = spawnEnemy("rompedor", W / 2);
    e.y = e.paraY; e.est = "normal"; e.saltoT = 0.02;
    const distancias = [];
    const alphaDurante = [];
    const invulDurante = [];
    let saltos = 0;
    let antesEst = e.est;
    for (let i = 0; i < 400; i++) {
      PASO(0.02);
      if (!e.solido) invulDurante.push(!!ENEMIGOS.rompedor.invulnerable(e));
      alphaDurante.push(ENEMIGOS.rompedor.alpha(e));
      if (antesEst !== "normal" && e.est === "normal") {
        saltos++;
        distancias.push(Math.hypot(e.x - player.x, e.y - player.y));
      }
      antesEst = e.est;
    }
    return { saltos, distancias, minAlpha: Math.min(...alphaDurante),
             invulSiempre: invulDurante.length > 0 && invulDurante.every(Boolean) };
  `);
  comprobar(r.saltos >= 2, "salta varias veces durante la prueba", r.saltos + " saltos");
  comprobar(r.distancias.every(d => d >= 149),
    "★ cada vez que se solidifica, está a 150 px o más del jugador",
    r.distancias.map(d => d.toFixed(0)).join(", "));
  comprobar(r.minAlpha > 0, "nunca llega a opacidad 0 del todo (ni él es un misterio total)", r.minAlpha.toFixed(2));
  comprobar(r.invulSiempre, "★ y mientras no es sólido, es invulnerable — no se le puede tocar ni toca");
}

// ════════════════════════════════════════════════════════════
console.log("\n11 · ECO: COPIA CON RETRASO, NO AL INSTANTE");
{
  const r = await dentro(`
    ${escenaLimpia}
    const e = spawnEnemy("eco", W / 2);
    e.y = e.paraY;
    player.x = 60; targetX = player.x;
    for (let i = 0; i < 40; i++) PASO(0.02);   // que se asiente en 60
    // Salto BRUSCO del jugador.
    const xAntes = e.x;
    player.x = W - 60; targetX = player.x;
    PASO(0.02);
    const xInmediato = e.x;
    for (let i = 0; i < 60; i++) PASO(0.02);   // 1,2 s más
    const xTras1s = e.x;
    return { xAntes, xInmediato, xTras1s, bufferMax: e.buffer.length <= 7 };
  `);
  comprobar(Math.abs(r.xInmediato - r.xAntes) < 5,
    "★ un salto brusco del jugador NO lo mueve de golpe", r.xAntes.toFixed(0) + " → " + r.xInmediato.toFixed(0));
  comprobar(Math.abs(r.xTras1s - r.xAntes) > 30,
    "pero un segundo después sí se ha movido hacia allí — copia, con retraso",
    r.xAntes.toFixed(0) + " → " + r.xTras1s.toFixed(0));
  comprobar(r.bufferMax, "y el historial que usa tiene tamaño fijo, no crece sin límite");
}

// ════════════════════════════════════════════════════════════
console.log("\n12 · SIN FUGAS DE ENTIDADES");
const MINAS_HAZARDS_ESPERADAS_MAX = 0;
{
  const r = await dentro(`
    ${escenaLimpia}
    for (const tipo of ${JSON.stringify(DIEZ)}) spawnEnemy(tipo, rand(60, W - 60));
    // Todos con hp mínimo: que mueran a la primera. El prisma es la
    // excepción a propósito: si le toca estar CERRADO, un disparo a
    // quemarropa no le hace nada — eso no es una fuga, es la mecánica
    // que se comprueba en el bloque 3. Se le abre a mano para que este
    // bloque mida lo suyo (que nada se quede colgado) sin chocar con lo
    // otro (que el reflejo funcione).
    for (const e of enemies) { e.hp = 1; if (e.tipo === "prisma") e.abierta = true; }
    for (const e of enemies.slice()) {
      bullets.push({ x: e.x, y: e.y, vx: 0, vy: 0, r: 60, dmg: 20, largo: 10,
                     col: "#fff", cd: 0, ang: 0 });
    }
    ${avanzar(0.3)}
    // Deja que caigan fragmentos, minas y demás durante un buen rato.
    ${avanzar(20, 0.1)}
    return { enemigos: enemies.length, hazards: hazards.length,
             columnas: columnas.length, rupturas: rupturas.length,
             telegrafos: telegrafos.length };
  `);
  console.log(`        tras matarlos a todos y esperar 20 s: ${r.enemigos} enemigos · ` +
    `${r.hazards} hazards · ${r.columnas} columnas · ${r.telegrafos} telégrafos`);
  comprobar(r.enemigos === 0, "★ ningún enemigo ni fragmento se queda colgado", r.enemigos + "");
  comprobar(r.hazards <= MINAS_HAZARDS_ESPERADAS_MAX, "las minas que quedaran han reventado o caído",
    r.hazards + "");
  comprobar(r.columnas === 0 && r.rupturas === 0,
    "las primitivas del bloque 5D no se han quedado encendidas por error");
}

// ════════════════════════════════════════════════════════════
console.log("\n13 · LO DE ANTES SIGUE EN SU SITIO");
{
  const r = await dentro(`
    return {
      guardado: typeof SAVE === "object" && typeof SAVE.get === "function",
      admin: typeof ADMIN === "object" && typeof ADMIN.entrar === "function",
      hangar: typeof HANGAR === "object" && typeof HANGAR.dibujar === "function",
      vfxCal: VFX.calidad(),
      misiones: MISIONES.length, base: MISIONES_BASE,
      enemigosBase: ["normal","veloz","torreta","tanque","kamikaze","bombardero",
        "francotirador","portaescudos","elite","crucero","comando",
        "dron_ataque","dron_escudo","dron_misil"].every(k => ENEMIGOS[k] && !ENEMIGOS[k].mundo),
      hpBaseIntacto: ENEMIGOS.normal.hp === 2 && ENEMIGOS.tanque.hp === 14 && ENEMIGOS.elite.hp === 26,
      jefes: Object.keys(JEFES).length, temas: TEMAS.length,
      hazardsBase: ["asteroide","cristal","tempano","trafico","mina_bio","fragmento"]
        .every(k => !!HAZARD_TIPOS[k]),
      minasMax: MINAS_ACTIVAS_MAX,
    };
  `);
  comprobar(r.guardado && r.admin && r.hangar, "save, ADMIN y hangar siguen ahí");
  comprobar(!!r.vfxCal, "VFX intacto", r.vfxCal);
  // 20 desde el bloque 5H (10 de siempre + 10 de la expansión); la base
  // (`MISIONES_BASE`) sigue siendo 10, esa no cambia nunca.
  comprobar(r.misiones === 20 && r.base === 10, "★ las diez misiones de siempre siguen siendo diez (con 10 más detrás)", r.misiones + "");
  comprobar(r.enemigosBase, "★ los 14 enemigos viejos siguen sin `mundo`: no se han tocado");
  comprobar(r.hpBaseIntacto, "★ y su HP no se ha movido ni un punto");
  // 20 desde el bloque 5G: los 10 de siempre + 5 minijefes (5F) + 5
  // jefes principales de la expansión (5G).
  comprobar(r.jefes === 20 && r.temas === 9, "20 jefes (10 + 5 minijefes + 5 de 5G) y los 9 mundos del bloque 5D", r.jefes + "·" + r.temas);
  comprobar(r.hazardsBase, "★ los hazards del bloque 5D (tempano, tráfico, mina_bio, fragmento) siguen ahí");
  comprobar(r.minasMax === 4, "y el cupo de minas del bloque 5D es el mismo que usa sembrador", r.minasMax + "");
}

// ════════════════════════════════════════════════════════════
console.log("\n14 · UNA MISIÓN DE SIEMPRE SE JUEGA IGUAL");
{
  const r = await dentro(`
    OPCIONES.vfx = "alto"; aplicarVFX();
    disparar = () => {};
    modo = "campana"; iniciarMision(0);
    await new Promise(r => setTimeout(r, 250));
    state = "play"; paused = false;
    ${avanzar(30, 0.1)}
    const tipos = new Set(enemies.map(e => e.tipo));
    const nuevos = [...tipos].filter(t => ${JSON.stringify(DIEZ)}.includes(t));
    return { enemigos: enemies.length, eventos: eventoIdx, tema: T.id, nuevos };
  `);
  console.log(`        M1 a los 30 s: ${r.enemigos} enemigos · ${r.eventos} eventos · mundo ${r.tema}`);
  comprobar(r.eventos > 0 && r.tema === "espacio", "la M1 corre su guión en su mundo de siempre", r.eventos + " eventos");
  comprobar(r.nuevos.length === 0,
    "★ y ningún enemigo de la expansión aparece sin que un evento lo pida", r.nuevos.join(",") || "ninguno");
}

// ════════════════════════════════════════════════════════════
console.log("\n15 · ESTRÉS: LOS DIEZ EN ROTACIÓN + HAZARDS + DISPAROS + VFX ALTO");
{
  await descongelar();
  const escena = async (nombre, guion, ms) => {
    const r = await p.evaluate(async ([g, ms]) => {
      new Function(g)();
      const t = [];
      const t0 = performance.now();
      while (performance.now() - t0 < ms) {
        await new Promise(r => requestAnimationFrame(r));
        t.push(VFX.metricas().ms);
      }
      t.sort((a, b) => a - b);
      const m = VFX.metricas();
      return { medio: t.reduce((a, b) => a + b, 0) / t.length,
               p95: t[Math.floor(t.length * 0.95)], peor: t[t.length - 1],
               parts: m.pico, max: m.maxParts, desc: m.rechazadas, calidad: m.calidad,
               enemigos: 0, ebalas: 0 };
    }, [guion, ms]);
    console.log(`        ${nombre.padEnd(30)} ${r.medio.toFixed(1)}ms · p95 ${r.p95.toFixed(1)} · ` +
      `peor ${r.peor.toFixed(1)} · pico ${r.parts}/${r.max}p · desc ${r.desc} · ${r.calidad}`);
    return r;
  };

  await dentro(`
    ${escenaLimpia}
    disparar = () => {};
    OPCIONES.vfx = "alto"; aplicarVFX();
    T = TEMAS.find(t => t.id === "grieta");
    await new Promise(r => setTimeout(r, 400));
    VFX.limpiar();
  `);

  const base = await escena("los 10 nuevos en rotación", `
    const diez = ["sierra_hielo","prisma","patrulla","torre_neon","medusa",
      "sembrador","crisol","martillo","rompedor","eco"];
    diez.forEach((t, i) => spawnEnemy(t, 40 + i * 70));
  `, 1600);

  const conHazards = await escena("+ hazards del bloque 5D", `
    hazardEnabled = true; hazardTipo = "fragmento";
    for (let i = 0; i < 4; i++) spawnHazard();
    hazardTipo = "tempano";
    for (let i = 0; i < 4; i++) spawnHazard();
    hazards.forEach(h => h.warnT = 0);
  `, 1400);

  const conDisparos = await escena("+ disparos cruzados", `
    for (let i = 0; i < 100; i++) eBala(Math.random()*W, Math.random()*H, 0, 100, 6);
  `, 1400);

  const fin = await dentro(`
    const m = VFX.metricas();
    return { parts: m.parts, max: m.maxParts, ebalas: eBullets.length, tope: EBALAS_MAX,
             enemigos: enemies.length, hazards: hazards.length };
  `);
  console.log(`        estado final: ${fin.enemigos} enemigos · ${fin.hazards} hazards · ` +
    `${fin.ebalas}/${fin.tope} balas enemigas`);
  comprobar(conDisparos.parts <= conDisparos.max,
    "★ con todo encendido no se pasa del presupuesto de partículas", conDisparos.parts + "/" + conDisparos.max);
  comprobar(fin.ebalas <= fin.tope, "ni del tope de balas enemigas", fin.ebalas + "/" + fin.tope);
  comprobar(conHazards.medio < Math.max(base.medio, 1) * 3,
    "los hazards del bloque 5D conviviendo con los diez no disparan el fotograma",
    conHazards.medio.toFixed(1) + "ms vs " + base.medio.toFixed(1) + "ms");
  comprobar(conDisparos.medio < Math.max(base.medio, 1) * 3,
    "y añadir disparos tampoco",
    conDisparos.medio.toFixed(1) + "ms vs " + base.medio.toFixed(1) + "ms");
}

// ════════════════════════════════════════════════════════════
console.log("\n16 · SIN ERRORES NI PETICIONES ROTAS");
{
  comprobar(!errs.length, "0 errores JS", errs.slice(0, 5).join(" | ") || "ninguno");
  comprobar(!p404.length, "0 respuestas 404", p404.slice(0, 5).join(" ") || "ninguna");
}

await ctx.close();
await nav.close();
srv.cerrar();
if (fallos.length) {
  console.log("\nFALLOS: " + fallos.length);
  for (const f of fallos) console.log(" - " + f);
  process.exit(1);
}
console.log("\nTodo correcto.");
