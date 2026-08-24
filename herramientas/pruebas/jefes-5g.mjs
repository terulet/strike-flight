// ════════════════════════════════════════════════════════════
//  jefes-5g.mjs — los cinco jefes principales de la expansión
//                 (bloque 5G): KRYOS, VÉRTICE, NÝX, VULCANO, AXIOMA
// ════════════════════════════════════════════════════════════
//
//    node herramientas/pruebas/jefes-5g.mjs
//
//  Sigue el mismo patrón que minijefes.mjs: hand-drive del reloj, con
//  las mismas neutralizaciones documentadas en memoria
//  (feedback_pruebas_motor) — `misionIniT=0` (no `1e9`, rompe el alfa
//  del banner), y `warningT=0; VFX.sacudidas.length=0;` después de
//  saltar directo a "combate" para no arrastrar el aviso/sacudida de
//  `spawnMiniboss()`.

import { servidor, cargarPlaywright } from "../qa.mjs";

const fallos = [];
const comprobar = (ok, t, extra) => {
  console.log((ok ? "  ok    " : "  FALLO ") + t + (extra ? "   " + extra : ""));
  if (!ok) fallos.push(t);
};

const srv = await servidor();
const { chromium } = await cargarPlaywright();
const nav = await chromium.launch();

async function abrirPartida() {
  const ctx = await nav.newContext({ viewport: { width: 420, height: 720 } });
  const p = await ctx.newPage();
  const errs = [];
  const p404 = [];
  p.on("pageerror", e => errs.push("EXCEPCION " + e.message));
  p.on("console", m => { if (m.type() === "error") errs.push("CONSOLE " + m.text()); });
  p.on("response", r => { if (r.status() === 404) p404.push(r.url()); });
  await p.goto(srv.url + "/index.html", { waitUntil: "load" });
  await p.evaluate(async () => {
    unlockAudio(); OPCIONES.vfx = "alto"; aplicarVFX();
    modo = "campana"; iniciarMision(0); misionIniT = 0;
    await new Promise(r => setTimeout(r, 200));
    state = "play"; paused = false;
    // Neutraliza cierre automático de misión y disparo/objetivo
    // automáticos del jugador mientras se pilota el reloj a mano.
    cerrarMision = () => {};
    disparar = () => {};
  });
  return { ctx, p, errs, p404 };
}

// Salta directo a combate con `tipo`, sin aviso/entrada, y limpia los
// efectos secundarios de `spawnMiniboss()` que no pintan aquí.
async function aCombate(p, tipo, mult) {
  await p.evaluate(({ tipo, mult }) => {
    enemies.length = 0; eBullets.length = 0; hazards.length = 0; columnas.length = 0; rupturas.length = 0;
    spawnMiniboss(tipo, mult || 1);
    miniboss.est = "combate"; miniboss.estT = 0; miniboss.invul = false;
    miniboss.x = W / 2; miniboss.y = H * 0.32; miniboss.baseY = miniboss.y;
    warningT = 0; VFX.sacudidas.length = 0;
    cambiarFase(miniboss, 0);
  }, { tipo, mult });
}

async function avanzar(p, segundos, pasoMs) {
  const paso = pasoMs || 50;
  const pasos = Math.round((segundos * 1000) / paso);
  for (let i = 0; i < pasos; i++) {
    await p.evaluate((dtMs) => { if (typeof update === "function") update(dtMs / 1000); }, paso);
  }
}

async function estado(p) {
  return p.evaluate(() => miniboss ? ({
    tipo: miniboss.tipo, fase: miniboss.fase, hp: miniboss.hp, hpMax: miniboss.hpMax,
    est: miniboss.est, invul: miniboss.invul,
  }) : null);
}

const BOSSES = ["kryos", "vertice", "nyx", "vulcano", "axioma"];

// ════════════════════════════════════════════════════════════
console.log("\n1 · REGISTRO — los cinco existen en JEFES con lo básico en orden");
{
  const { ctx, p, errs } = await abrirPartida();
  const r = await p.evaluate((tipos) => tipos.map(t => {
    const d = JEFES[t];
    return d ? { t, r: d.r, hpMax: d.hpMax, mundo: d.mundo, nFases: d.fases.length, epico: !!d.epico, sp: d.sp } : null;
  }), BOSSES);
  for (const b of r) comprobar(!!b, "existe " + b?.t);
  comprobar(r[0].hpMax === 900 && r[0].nFases === 3 && r[0].mundo === "hielo", "KRYOS: 900 HP, 3 fases, mundo hielo", JSON.stringify(r[0]));
  comprobar(r[1].hpMax === 1000 && r[1].nFases === 3 && r[1].mundo === "megaciudad", "VÉRTICE: 1000 HP, 3 fases, mundo megaciudad", JSON.stringify(r[1]));
  comprobar(r[2].hpMax === 1100 && r[2].nFases === 3 && r[2].mundo === "abismo", "NÝX: 1100 HP, 3 fases, mundo abismo", JSON.stringify(r[2]));
  comprobar(r[3].hpMax === 1250 && r[3].nFases === 3 && r[3].mundo === "fragua", "VULCANO: 1250 HP, 3 fases, mundo fragua", JSON.stringify(r[3]));
  comprobar(r[4].hpMax === 1600 && r[4].nFases === 4 && r[4].mundo === "grieta" && r[4].epico, "AXIOMA: 1600 HP, 4 fases, mundo grieta, épico", JSON.stringify(r[4]));
  const total = await p.evaluate(() => Object.keys(JEFES).length);
  comprobar(total === 20, "20 entradas en JEFES (10 base + 5 minijefes + 5 de 5G)", total + "");
  comprobar(!errs.length, "sin errores JS", errs.slice(0, 5).join(" | ") || "ninguno");
  await ctx.close();
}

// ════════════════════════════════════════════════════════════
console.log("\n2 · CADA JEFE CARGA SU PROPIO ARTE AL ENTRAR, Y SOLO ENTONCES");
{
  const { ctx, p, errs, p404 } = await abrirPartida();
  const antes = await p.evaluate((tipos) => tipos.map(t => !!SPRITES["bs_" + t]), BOSSES);
  comprobar(antes.every(x => !x), "★ ninguno de los cinco tiene sprite cargado antes de spawnear", JSON.stringify(antes));
  for (const tipo of BOSSES) {
    await aCombate(p, tipo);
    await p.waitForTimeout(120);
    const ok = await p.evaluate((tipo) => !!SPRITES["bs_" + tipo], tipo);
    comprobar(ok, tipo + ": pide su sprite en cuanto spawnea (asegurarSpriteJefe)");
  }
  comprobar(!errs.length, "sin errores JS", errs.slice(0, 5).join(" | ") || "ninguno");
  comprobar(!p404.length, "sin 404", p404.slice(0, 5).join(" ") || "ninguno");
  await ctx.close();
}

// ════════════════════════════════════════════════════════════
console.log("\n3 · KRYOS — placas de hielo, protección real, RECONGELACIÓN exacta");
{
  const { ctx, p, errs } = await abrirPartida();
  await aCombate(p, "kryos");
  const conPlacas = await p.evaluate(() => {
    const mb = miniboss;
    const antes = mb.hp;
    mb.hp -= 40 * (JEFES.kryos.reduccionDano(mb));
    return { antes, despues: mb.hp, nSubs: mb.subs.length, vivos: mb.subs.filter(s => s.vivo).length };
  });
  comprobar(conPlacas.nSubs === 4, "★ nace con 4 placas", conPlacas.nSubs + "");
  comprobar(conPlacas.vivos === 4, "las 4 empiezan vivas");

  // Rompe DOS placas a mano y comprueba que la protección baja (menos
  // vivas = menos reducción de daño).
  const tras2rotas = await p.evaluate(() => {
    const mb = miniboss;
    mb.subs[0].vivo = false; mb.subs[1].vivo = false;
    const antes = JEFES.kryos.reduccionDano({ ...mb, fase: 0, subs: [{ vivo: true }, { vivo: true }, { vivo: false }, { vivo: false }] });
    return antes;
  });
  comprobar(tras2rotas === 0.8, "reduccionDano con 2 de 4 vivas es 1 - 2*0.1 = 0.8", tras2rotas + "");

  // Entra en fase 2 y dispara RECONGELACIÓN a mano: tiene que reponer
  // EXACTAMENTE 2, nunca las 4.
  await p.evaluate(() => {
    const mb = miniboss;
    mb.subs.forEach(s => { s.vivo = false; });
    mb.hp = mb.hpMax * 0.6; cambiarFase(mb, 1); mb.est = "combate"; mb.estT = 0; mb.invul = false;
  });
  const tras = await p.evaluate(() => {
    const mb = miniboss;
    JEFES.kryos.fases[1].ataques[2].fn(mb);
    return mb.subs.map(s => s.vivo);
  });
  const vivosN = tras.filter(Boolean).length;
  comprobar(vivosN === 2, "★ RECONGELACIÓN repone EXACTAMENTE 2 placas rotas, no 4", JSON.stringify(tras));

  // F3: reactor expuesto, ya no protege nada pase lo que pase con subs.
  const f3 = await p.evaluate(() => {
    const mb = miniboss;
    cambiarFase(mb, 2); mb.est = "combate"; mb.estT = 0; mb.invul = false;
    return { subsVivos: mb.subs.filter(s => s.vivo).length, reduccion: JEFES.kryos.reduccionDano(mb) };
  });
  comprobar(f3.subsVivos === 0, "★ al entrar en F3 se rompen las placas que quedaran", f3.subsVivos + "");
  comprobar(f3.reduccion === 1, "★ F3: reactor expuesto del todo, reduccionDano=1", f3.reduccion + "");
  comprobar(!errs.length, "sin errores JS", errs.slice(0, 5).join(" | ") || "ninguno");
  await ctx.close();
}

// ════════════════════════════════════════════════════════════
console.log("\n4 · VÉRTICE — apenas se mueve, controla el campo (tráfico/cruces/carril)");
{
  const { ctx, p, errs } = await abrirPartida();
  await aCombate(p, "vertice");
  const x0 = await p.evaluate(() => miniboss.x);
  await avanzar(p, 6);
  const x1 = await p.evaluate(() => miniboss.x);
  comprobar(Math.abs(x1 - x0) < 60, "★ apenas se desplaza en 6 s (torre, no asalto)", `${x0.toFixed(0)} → ${x1.toFixed(0)}`);

  // Dispara el ataque de tráfico y el de cruce a mano: comprueba que
  // usan hazards/columna existentes, no algo nuevo.
  const r1 = await p.evaluate(() => {
    hazards.length = 0; columnas.length = 0;
    JEFES.vertice.fases[0].ataques[1].fn(miniboss);
    const trafico = hazards.filter(h => h.tipo === "trafico").length;
    JEFES.vertice.fases[0].ataques[2].fn(miniboss);
    return { trafico, columnas: columnas.length };
  });
  comprobar(r1.trafico === 2, "el ataque de tráfico suelta 2 hazards de tipo trafico", r1.trafico + "");
  comprobar(r1.columnas === 1, "el cruce usa spawnColumna (columna nueva)", r1.columnas + "");

  // Fase 2: CORREDOR MÓVIL dos columnas con un hueco entre ellas.
  await p.evaluate(() => { miniboss.hp = miniboss.hpMax * 0.5; cambiarFase(miniboss, 1); miniboss.est = "combate"; miniboss.estT = 0; miniboss.invul = false; });
  const corredor = await p.evaluate(() => {
    columnas.length = 0;
    JEFES.vertice.fases[1].ataques[2].fn(miniboss);
    return columnas.map(c => c.x);
  });
  comprobar(corredor.length === 2 && Math.abs(corredor[1] - corredor[0]) > 100, "★ CORREDOR MÓVIL abre un hueco real entre dos columnas", JSON.stringify(corredor));

  await p.evaluate(() => { for (let i = hazards.length - 1; i >= 0; i--) if (hazards[i].tipo === "trafico") {} });
  // Muerte: limpia el tráfico que hubiera suelto.
  await p.evaluate(() => { hazards.push({ tipo: "trafico", x: 10, y: 10 }); JEFES.vertice.onMuerte(miniboss); });
  const limpio = await p.evaluate(() => hazards.filter(h => h.tipo === "trafico").length);
  comprobar(limpio === 0, "onMuerte limpia el tráfico que había suelto");
  comprobar(!errs.length, "sin errores JS", errs.slice(0, 5).join(" | ") || "ninguno");
  await ctx.close();
}

// ════════════════════════════════════════════════════════════
console.log("\n5 · NÝX — una sola barra, se parte en dos, regeneración con tope");
{
  const { ctx, p, errs } = await abrirPartida();
  await aCombate(p, "nyx");
  comprobar(await p.evaluate(() => miniboss.mitades === null), "F1: todavía no está partida");

  await p.evaluate(() => { miniboss.hp = miniboss.hpMax * 0.6; cambiarFase(miniboss, 1); miniboss.est = "combate"; miniboss.estT = 0; miniboss.invul = false; });
  const f2 = await p.evaluate(() => ({
    mitades: !!miniboss.mitades, nMitades: miniboss.mitades.length,
    coreExpuesto: JEFES.nyx.coreExpuesto(miniboss), alfa: JEFES.nyx.alfaCasco(miniboss),
  }));
  comprobar(f2.mitades && f2.nMitades === 2, "★ ESCISIÓN: se parte en exactamente 2 cuerpos", JSON.stringify(f2));
  comprobar(f2.coreExpuesto === false, "★ mientras está partida, el núcleo genérico NO está expuesto");
  comprobar(f2.alfa < 0.2, "★ el casco base casi desaparece mientras dura la escisión (no se ven 3 cuerpos)", f2.alfa + "");

  // Golpea las dos mitades directamente vía actualizarMitadesNyx,
  // simulando una bala en cada posición, y comprueba que AMBAS quitan
  // vida de la MISMA barra (mb.hp), nunca una vida aparte.
  const golpe = await p.evaluate(() => {
    const mb = miniboss;
    const hpAntes = mb.hp;
    const mx0 = mb.x + mb.mitades[0].ox, my0 = mb.y + mb.mitades[0].oy;
    bullets.push({ x: mx0, y: my0, r: 4, dmg: 30, cd: 0 });
    actualizarMitadesNyx(mb, 0.016);
    return { hpAntes, hpDespues: mb.hp };
  });
  comprobar(golpe.hpDespues < golpe.hpAntes, "★ golpear una mitad quita vida de mb.hp (la única barra)", `${golpe.hpAntes.toFixed(0)} → ${golpe.hpDespues.toFixed(0)}`);

  // Regeneración con tope: fuerza el desequilibrio (una mitad con
  // mucho tiempo sin golpe, la otra recién golpeada) y deja correr el
  // tiempo suficiente para agotar el presupuesto entero.
  const regen = await p.evaluate(() => {
    const mb = miniboss;
    mb.hp = mb.hpMax * 0.5; mb.regenGastado = 0; mb._tSinGolpe = [10, 0];
    let subioAlgunaVez = false;
    for (let i = 0; i < 4000; i++) {
      const antes = mb.hp;
      actualizarMitadesNyx(mb, 0.05);
      if (mb.hp > antes) subioAlgunaVez = true;
      mb._tSinGolpe[0] = 10; mb._tSinGolpe[1] = 0;   // mantiene el desequilibrio
    }
    return { hpFinal: mb.hp, hpMax: mb.hpMax, regenGastado: mb.regenGastado, subioAlgunaVez };
  });
  comprobar(regen.subioAlgunaVez, "★ SÍ hay regeneración real (mb.hp sube en algún momento)");
  comprobar(regen.regenGastado <= regen.hpMax * 0.12 + 0.01, "★ el total regenerado en toda la pelea nunca supera el 12% del hpMax (tope)", `${regen.regenGastado.toFixed(1)} / tope ${(regen.hpMax * 0.12).toFixed(1)}`);
  comprobar(regen.hpFinal <= regen.hpMax, "★ mb.hp nunca supera hpMax pese a la regeneración", `${regen.hpFinal.toFixed(1)} / ${regen.hpMax}`);

  // F3: se reunifica.
  await p.evaluate(() => { miniboss.hp = miniboss.hpMax * 0.2; cambiarFase(miniboss, 2); miniboss.est = "combate"; miniboss.estT = 0; miniboss.invul = false; });
  const f3 = await p.evaluate(() => ({ mitades: miniboss.mitades, coreExpuesto: JEFES.nyx.coreExpuesto(miniboss) }));
  comprobar(f3.mitades === null, "★ REUNIFICACIÓN: vuelve a ser una sola en F3");
  comprobar(f3.coreExpuesto === true, "★ y el núcleo vuelve a estar expuesto");
  comprobar(!errs.length, "sin errores JS", errs.slice(0, 5).join(" | ") || "ninguno");
  await ctx.close();
}

// ════════════════════════════════════════════════════════════
console.log("\n6 · VULCANO — forja telegrafiada, cancelable, concede modo temporal");
{
  const { ctx, p, errs } = await abrirPartida();
  await aCombate(p, "vulcano");

  // Ciclo completo sin intervención: nada más pasar el tiempo de
  // aviso (3 s) tiene que conceder un modo — se comprueba justo
  // después de ese instante, antes de que el propio modo (7 s) haya
  // tenido tiempo de expirar solo.
  const ciclo = await p.evaluate(() => {
    const mb = miniboss;
    mb.forjaT = 0.05; mb.forjaObjetivo = null; mb.modoForja = null;
    for (let i = 0; i < 66; i++) actualizarForjaVulcano(mb, 0.05, 22, 3.0, 7.0, ["martillo", "canon"]);
    return { modo: mb.modoForja, modoForjaT: mb.modoForjaT };
  });
  comprobar(["martillo", "canon"].includes(ciclo.modo), "★ si no se destruye el objetivo, concede uno de los modos posibles", ciclo.modo);
  comprobar(ciclo.modoForjaT > 0, "y el modo dura un tiempo, no es instantáneo", ciclo.modoForjaT + "");

  // Cancelación: si se rompe el objetivo a tiempo —con una bala DE
  // VERDAD, por el mismo camino de colisión que usa el jugador, no
  // tocando `hp` a mano por fuera— NO debe conceder modo.
  const cancelado = await p.evaluate(() => {
    const mb = miniboss;
    mb.forjaT = 0.05; mb.forjaObjetivo = null; mb.modoForja = null;
    actualizarForjaVulcano(mb, 0.05, 22, 3.0, 7.0, ["martillo"]);   // crea el objetivo
    if (!mb.forjaObjetivo) return { creado: false };
    const ox = mb.x + mb.forjaObjetivo.ox, oy = mb.y + mb.forjaObjetivo.oy;
    bullets.length = 0;
    bullets.push({ x: ox, y: oy, r: 4, dmg: mb.forjaObjetivo.hp + 5, cd: 0 });
    actualizarForjaVulcano(mb, 0.05, 22, 3.0, 7.0, ["martillo"]);
    // Deja correr el resto del aviso: si NO se hubiera cancelado de
    // verdad, aquí habría concedido el modo igualmente.
    for (let i = 0; i < 60; i++) actualizarForjaVulcano(mb, 0.05, 22, 3.0, 7.0, ["martillo"]);
    return { creado: true, objetivo: mb.forjaObjetivo, modo: mb.modoForja };
  });
  comprobar(cancelado.creado, "el objetivo de forja se crea con aviso");
  comprobar(cancelado.objetivo === null && cancelado.modo === null, "★ romperlo a tiempo con una bala CANCELA la forja: no concede modo", JSON.stringify(cancelado));

  // Los 4 modos existen y cada uno hace algo reconocible (martillo =
  // golpe de zona con onda, cañón = ráfaga pesada, columna = colada,
  // lanzador = abanico ancho).
  const modos = await p.evaluate(() => {
    const mb = miniboss; const out = {};
    for (const modo of ["martillo", "canon", "columna", "lanzador"]) {
      bullets.length = 0; eBullets.length = 0; columnas.length = 0;
      mb.modoForja = modo; mb._forjaY = mb.y + 170;
      JEFES.vulcano.fases[0].ataques[1].fn(mb);
      out[modo] = { eBullets: eBullets.length, columnas: columnas.length };
    }
    return out;
  });
  comprobar(modos.canon.eBullets > 0, "modo cañón dispara balas enemigas", JSON.stringify(modos.canon));
  comprobar(modos.lanzador.eBullets > 0, "modo lanzador dispara balas enemigas", JSON.stringify(modos.lanzador));
  comprobar(modos.columna.columnas === 1, "modo columna suelta una colada", JSON.stringify(modos.columna));

  // F3: acelera y suelta colada suelta además del modo (reactor inestable).
  await p.evaluate(() => { miniboss.hp = miniboss.hpMax * 0.2; cambiarFase(miniboss, 2); miniboss.est = "combate"; miniboss.estT = 0; miniboss.invul = false; });
  const f3 = await p.evaluate(() => JEFES.vulcano.reduccionDano(miniboss));
  comprobar(f3 === 1.15, "★ F3: reactor inestable, encaja más daño (1.15)", f3 + "");
  comprobar(!errs.length, "sin errores JS", errs.slice(0, 5).join(" | ") || "ninguno");
  await ctx.close();
}

// ════════════════════════════════════════════════════════════
console.log("\n7 · AXIOMA — 4 fases, portales, fragmentación, ecos, cara a cara");
{
  const { ctx, p, errs } = await abrirPartida();
  await aCombate(p, "axioma");
  comprobar(await p.evaluate(() => JEFES.axioma.epico === true), "★ AXIOMA lleva epico:true (finale de la expansión)");

  // F1: el salto por ruptura reutiliza el mismo patrón que heraldo_grieta.
  const salto = await p.evaluate(async () => {
    const mb = miniboss;
    mb.saltoT = 0.01; rupturas.length = 0;
    const fase0 = JEFES.axioma.fases[0];
    for (let i = 0; i < 60; i++) fase0.mover(mb, 0.05);
    return { saltando: mb.saltando, rupturas: rupturas.length > 0 };
  });
  comprobar(salto.rupturas, "★ F1 abre al menos una ruptura al saltar", JSON.stringify(salto));

  // F2: fragmentación — 4 subs, reduccionDano baja con cada uno vivo.
  await p.evaluate(() => { miniboss.saltando = false; miniboss.invul = false; miniboss.hp = miniboss.hpMax * 0.7; cambiarFase(miniboss, 1); miniboss.est = "combate"; miniboss.estT = 0; miniboss.invul = false; });
  const f2 = await p.evaluate(() => ({ nSubs: miniboss.subs.length, reduccion4: JEFES.axioma.reduccionDano(miniboss) }));
  comprobar(f2.nSubs === 4, "★ F2 FRAGMENTACIÓN: nace con 4 subsistemas", f2.nSubs + "");
  comprobar(Math.abs(f2.reduccion4 - (1 - 4 * 0.09)) < 0.001, "reduccionDano con los 4 vivos coincide con la fórmula", f2.reduccion4 + "");

  // F3: ECOS — cada ataque de eco tiene que dejar rastro reconocible
  // (el hazard/columna/oscuridad que reclama) y un texto con el nombre.
  await p.evaluate(() => { miniboss.hp = miniboss.hpMax * 0.4; cambiarFase(miniboss, 2); miniboss.est = "combate"; miniboss.estT = 0; miniboss.invul = false; });
  const ecos = await p.evaluate(() => {
    const mb = miniboss, out = {};
    hazards.length = 0; columnas.length = 0; oscuro.obj = 0;
    JEFES.axioma.fases[2].ataques[1].fn(mb); // KRYOS
    out.kryos = hazards.some(h => h.tipo === "tempano");
    hazards.length = 0;
    JEFES.axioma.fases[2].ataques[2].fn(mb); // VÉRTICE
    out.vertice = hazards.some(h => h.tipo === "trafico") && columnas.length > 0;
    hazards.length = 0; columnas.length = 0;
    JEFES.axioma.fases[2].ataques[3].fn(mb); // NÝX
    out.nyx = hazards.some(h => h.tipo === "mina_bio") && oscuro.obj > 0;
    hazards.length = 0;
    JEFES.axioma.fases[2].ataques[4].fn(mb); // VULCANO
    out.vulcano = columnas.some(c => c.estilo === "colada");
    return out;
  });
  comprobar(ecos.kryos, "★ ECO: KRYOS deja un témpano");
  comprobar(ecos.vertice, "★ ECO: VÉRTICE deja tráfico + un cruce");
  comprobar(ecos.nyx, "★ ECO: NÝX deja una mina + oscuridad");
  comprobar(ecos.vulcano, "★ ECO: VULCANO deja una colada");

  // F4: cara a cara — sin trucos, núcleo expuesto.
  await p.evaluate(() => { miniboss.hp = miniboss.hpMax * 0.1; cambiarFase(miniboss, 3); miniboss.est = "combate"; miniboss.estT = 0; miniboss.invul = false; });
  const f4 = await p.evaluate(() => ({ subs: miniboss.subs, reduccion: JEFES.axioma.reduccionDano(miniboss) }));
  comprobar(f4.subs === null, "★ F4: sin fragmentos, sin escondites");
  comprobar(f4.reduccion === 1.15, "★ F4: núcleo expuesto, encaja más (1.15)", f4.reduccion + "");
  comprobar(!errs.length, "sin errores JS", errs.slice(0, 5).join(" | ") || "ninguno");
  await ctx.close();
}

// ════════════════════════════════════════════════════════════
console.log("\n8 · MUERTE — limpia hazards/rupturas/oscuridad, sin fugas, sin errores");
{
  const { ctx, p, errs } = await abrirPartida();
  for (const tipo of BOSSES) {
    await aCombate(p, tipo);
    const r = await p.evaluate((tipo) => {
      const mb = miniboss;
      hazards.push({ tipo: "tempano", x: 1, y: 1 }, { tipo: "trafico", x: 1, y: 1 }, { tipo: "mina_bio", x: 1, y: 1 }, { tipo: "fragmento", x: 1, y: 1 });
      oscuro.obj = 0.5;
      mb.hp = 1;
      matarMiniboss();
      return {
        minibossNull_pendiente: true,
        oscuroObj: oscuro.obj,
        columnas: columnas.length, rupturas: rupturas.length,
      };
    }, tipo);
    comprobar(r.oscuroObj === 0, tipo + ": matarMiniboss apaga la oscuridad", r.oscuroObj + "");
    comprobar(r.columnas === 0 && r.rupturas === 0, tipo + ": limpia columnas/rupturas");
    // Deja que la cinemática de muerte corra del todo (AXIOMA es épico
    // y tarda más: hasta 4.6+1.8 s).
    await avanzar(p, tipo === "axioma" ? 7.5 : 5.5, 60);
    const fin = await p.evaluate(() => miniboss === null);
    comprobar(fin, tipo + ": termina la cinemática y miniboss vuelve a null");
  }
  comprobar(!errs.length, "sin errores JS en las cinco muertes", errs.slice(0, 8).join(" | ") || "ninguno");
  await ctx.close();
}

// ════════════════════════════════════════════════════════════
console.log("\n9 · CINCO JEFES SEGUIDOS — sin fugas de memoria/estado entre uno y el siguiente");
{
  const { ctx, p, errs } = await abrirPartida();
  for (let vuelta = 0; vuelta < 2; vuelta++) {
    for (const tipo of BOSSES) {
      await aCombate(p, tipo);
      await avanzar(p, 1.5, 60);
      await p.evaluate(() => { miniboss.hp = 1; matarMiniboss(); });
      await avanzar(p, 6, 80);
    }
  }
  const r = await p.evaluate(() => ({
    miniboss, bullets: bullets.length, eBullets: eBullets.length,
    hazards: hazards.length, columnas: columnas.length, rupturas: rupturas.length,
    oscuroObj: oscuro.obj, particulas: VFX.metricas().parts,
  }));
  comprobar(r.miniboss === null, "★ sin jefe colgado tras diez apariciones seguidas (2 vueltas × 5)");
  comprobar(r.oscuroObj === 0, "sin oscuridad colgada de NÝX");
  comprobar(r.particulas <= 420, "★ el presupuesto global de partículas (420) no se desborda", r.particulas + "");
  comprobar(!errs.length, "sin errores JS en toda la tanda", errs.slice(0, 8).join(" | ") || "ninguno");
  await ctx.close();
}

// ════════════════════════════════════════════════════════════
console.log("\n10 · M1-M10 NO PIDEN NINGÚN SPRITE DE LOS CINCO JEFES DE 5G");
{
  const ctx = await nav.newContext({ viewport: { width: 420, height: 720 } });
  const p = await ctx.newPage();
  const peticiones = [];
  p.on("requestfinished", r => { if (/bs_(kryos|vertice|nyx|vulcano|axioma)/.test(r.url())) peticiones.push(r.url()); });
  await p.goto(srv.url + "/index.html", { waitUntil: "load" });
  await p.evaluate(async () => {
    OPCIONES.vfx = "alto"; aplicarVFX();
    modo = "campana";
    for (let m = 0; m < 10; m++) { iniciarMision(m); await new Promise(r => setTimeout(r, 60)); }
  });
  await p.waitForTimeout(300);
  comprobar(peticiones.length === 0, "★ recorrer M1-M10 no pide ni un sprite de KRYOS/VÉRTICE/NÝX/VULCANO/AXIOMA", peticiones.join(", ") || "ninguna");
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
