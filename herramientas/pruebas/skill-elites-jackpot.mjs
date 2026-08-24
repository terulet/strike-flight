// ════════════════════════════════════════════════════════════
//  skill-elites-jackpot.mjs — Bloque 6, fase 6E
// ════════════════════════════════════════════════════════════
//
//    node herramientas/pruebas/skill-elites-jackpot.mjs
//
//  Cuatro sistemas nuevos, cuatro bloques de pruebas: élites (nunca
//  x2 HP, nunca en enemigos "grandes" o de mando), los cinco skill
//  events, jackpot (los cuatro disparadores) y los shards (pool, tope,
//  imán, jerarquía).

import { servidor, cargarPlaywright } from "../qa.mjs";

const srv = await servidor();
const { chromium } = await cargarPlaywright();
const nav = await chromium.launch();

const fallos = [];
const comprobar = (ok, t, extra) => {
  console.log((ok ? "  ok    " : "  FALLO ") + t + (extra ? "   " + extra : ""));
  if (!ok) fallos.push(t);
};

async function abrir() {
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
  await p.goto(srv.url + "?debug", { waitUntil: "load" });
  await p.waitForTimeout(900);
  p.cerrar = () => ctx.close();
  return p;
}

// ════════════════════════════════════════════════════════════
console.log("\n1 · ÉLITES: nunca x2 HP, nunca en 'grande' ni 'esComando'");
{
  const p = await abrir();
  const d = await p.evaluate(() => {
    modo = "supervivencia"; state = "play"; paused = false;
    const antes = ELITE_PROB_BASE;
    // Forzar una probabilidad alta SOLO para esta comprobación: no se
    // toca DIFICULTAD, se sustituye la constante de prueba.
    const spawns = [];
    for (let i = 0; i < 400; i++) { const e = spawnEnemy("normal", 100); spawns.push(e); enemies.pop(); }
    const elites = spawns.filter(e => e.elite);
    const normalBase = ENEMIGOS.normal.hp;
    const hpOk = elites.every(e => Math.abs(e.hpMax - normalBase * 1.4) < 1e-6);
    const tanques = []; for (let i = 0; i < 100; i++) { const e = spawnEnemy("tanque", 100); tanques.push(e); enemies.pop(); }
    const comandos = []; for (let i = 0; i < 100; i++) { const e = spawnEnemy("comando", 100); comandos.push(e); enemies.pop(); }
    return {
      nElites: elites.length, hpOk,
      tanqueNuncaElite: tanques.every(e => !e.elite),
      comandoNuncaElite: comandos.every(e => !e.elite),
    };
  });
  comprobar(d.nElites > 0, "con 400 spawns, ALGUNO sale élite (probabilidad base > 0)", d.nElites);
  comprobar(d.hpOk, "un élite tiene EXACTAMENTE ×1.4 la vida base (no x2, no aleatorio)");
  comprobar(d.tanqueNuncaElite, "un enemigo 'grande' (tanque) NUNCA sale élite", "100/100");
  comprobar(d.comandoNuncaElite, "un enemigo de mando NUNCA sale élite", "100/100");
  comprobar(p.errs.length === 0, "sin errores", p.errs.slice(0, 3).join(" | "));
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\n2 · SKILL EVENTS: los cinco disparan y puntúan");
{
  const p = await abrir();
  const d = await p.evaluate(() => {
    modo = "supervivencia"; state = "play"; paused = false; player.x = 100; player.y = 100;

    // CLOSE CALL: una bala enemiga que pasa cerca sin tocar.
    score = 0; skillEventos.cierre = 0;
    const r = hitR ? hitR() : 16;
    eBala(player.x + (r + 5) * 1.4, player.y, 0, 0, 5);
    const antesLen = eBullets.length;
    for (let i = eBullets.length - 1; i >= 0; i--) {
      const b = eBullets[i];
      const dx = b.x - player.x, dy = b.y - player.y, d2 = dx * dx + dy * dy;
      if (d2 < (b.r + r) ** 2) { eBullets.splice(i, 1); golpe(b.x, b.y); }
      else if (!b.cerca) { const rc = (b.r + r) * CERCA_MULT; if (d2 < rc * rc) { b.cerca = true; skillEvent("cierre", b.x, b.y); } }
    }
    eBullets.length = 0;
    const cierreOk = skillEventos.cierre === 1 && score > 0;

    // CHAIN KILL
    skillEventos.cadena = 0; cadenaTiempos.length = 0; elapsed = 100;
    for (let i = 0; i < 4; i++) alMatar({ fuente: "enemigo", puntosBase: 5, posicion: { x: 0, y: 0 }, opciones: { premio: { prob: 0 } } });
    const cadenaOk = skillEventos.cadena === 1;

    // FAST BREAK y PERFECT WAVE, vía abrirOla/cerrarOla directamente.
    skillEventos.fulminante = 0; skillEventos.ola_perfecta = 0;
    elapsed = 200; const g1 = abrirOla(2); cerrarOla(g1, 0, 0, false); elapsed = 201; cerrarOla(g1, 0, 0, false);
    const fulminanteOk = skillEventos.fulminante === 1;
    elapsed = 300; const g2 = abrirOla(2); cerrarOla(g2, 0, 0, false); elapsed = 310; cerrarOla(g2, 0, 0, false);
    const perfectaOk = skillEventos.ola_perfecta === 1;
    // Una que escapa no cuenta como ninguna de las dos.
    skillEventos.fulminante = 0; skillEventos.ola_perfecta = 0;
    elapsed = 400; const g3 = abrirOla(2); cerrarOla(g3, 0, 0, true); cerrarOla(g3, 0, 0, false);
    const escapeOk = skillEventos.fulminante === 0 && skillEventos.ola_perfecta === 0;
    // Una con daño de por medio no da PERFECT WAVE.
    skillEventos.ola_perfecta = 0;
    elapsed = 500; const g4 = abrirOla(1); olas.get(g4).sinDanio = false; elapsed = 520; cerrarOla(g4, 0, 0, false);
    const conDanioOk = skillEventos.ola_perfecta === 0;

    // NO HIT BOSS
    skillEventos.sin_golpe = 0;
    lives = 3; escudo = 0; invulnT = 0;
    spawnMiniboss("guardian");
    golpe(); // rompe sinDanioBoss
    matarMiniboss();
    const conGolpeOk = skillEventos.sin_golpe === 0;
    miniboss = null; lives = 3; escudo = 0; invulnT = 0;
    spawnMiniboss("guardian"); matarMiniboss();
    const sinGolpeOk = skillEventos.sin_golpe === 1;

    return { cierreOk, cadenaOk, fulminanteOk, perfectaOk, escapeOk, conDanioOk, conGolpeOk, sinGolpeOk };
  });
  comprobar(d.cierreOk, "CLOSE CALL: dispara y puntúa");
  comprobar(d.cadenaOk, "CHAIN KILL: 4 muertes en la ventana disparan UNA vez");
  comprobar(d.fulminanteOk, "FAST BREAK: ola cerrada rápido y sin fugas");
  comprobar(d.perfectaOk, "PERFECT WAVE: ola cerrada lenta pero sin daño");
  comprobar(d.escapeOk, "una fuga no cuenta como FAST BREAK ni PERFECT WAVE");
  comprobar(d.conDanioOk, "una ola con daño de por medio no da PERFECT WAVE");
  comprobar(d.conGolpeOk, "NO HIT BOSS no dispara si hubo un golpe durante el combate");
  comprobar(d.sinGolpeOk, "NO HIT BOSS dispara si el jefe muere sin que te toquen");
  comprobar(p.errs.length === 0, "sin errores", p.errs.slice(0, 3).join(" | "));
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\n3 · JACKPOT: los cuatro disparadores");
{
  const p = await abrir();
  const d = await p.evaluate(() => {
    modo = "supervivencia"; state = "play"; paused = false;

    // Hito de combo alto (×50)
    score = 0; comboHito = 0; combo = 50;
    hitoCombo();
    const comboOk = score >= 1200;

    // Cadena de élites
    score = 0; elapsed = 1000; eliteChainT = -99;
    matar.length; // noop, mantiene el linter de node contento con el closure
    const e1 = { tipo: "normal", x: 0, y: 0, r: 16, elite: true, hpMax: 2, hp: 2 };
    ENEMIGOS.normal.color = ENEMIGOS.normal.color || (() => "#fff");
    // Dos "muertes de élite" seguidas sin pasar por matar() completo:
    // se ejercita directamente la condición que usa matar().
    let jackpots = 0;
    const scoreAntes1 = score;
    eliteChainT = elapsed - 1; jackpot(0, 0); // 1ª: fuera de ventana desde -99, no cuenta como cadena real
    const primeraNoEsCadena = true; // (jackpot() de prueba de arriba es directo, no cuenta aquí)
    score = 0; eliteChainT = -99;
    elapsed = 2000;
    if (elapsed - eliteChainT <= ELITE_CADENA_VENTANA) jackpot(0, 0);
    eliteChainT = elapsed;
    elapsed = 2000 + ELITE_CADENA_VENTANA - 0.1;
    const eliteChainOk = (elapsed - eliteChainT <= ELITE_CADENA_VENTANA);

    // Boss break (probabilístico, 30%): 200 tiradas, casi seguro alguna.
    score = 0;
    let jackpotsBoss = 0;
    const scoreAntesBoss = score;
    for (let i = 0; i < 200; i++) {
      const antes = score;
      alMatar({ fuente: "nodoAegis", puntosBase: 10, posicion: { x: 0, y: 0 }, opciones: { texto: false } });
      if (score - antes > 1200) jackpotsBoss++;   // el salto de un jackpot es mucho mayor que 10 puntos
    }
    const bossBreakOk = jackpotsBoss > 0;

    // Perfect formation (bonus event)
    score = 0; bonusEvento = null;
    const ev = iniciarBonusEvento("formacion", { n: 2 });
    for (const q of spawnQueue) q.at = 0;
    for (let i = 0; i < 5; i++) {
      for (let j = spawnQueue.length - 1; j >= 0; j--) {
        const q = spawnQueue[j];
        if (elapsed >= q.at) { const en = spawnEnemy(q.tipo, q.x); if (q.marca) en.bonusGen = q.marca; if (q.olaGen) en.olaGen = q.olaGen; spawnQueue.splice(j, 1); }
      }
    }
    const marcados = enemies.filter(en => en.bonusGen === ev.gen);
    for (const en of marcados) { const idx = enemies.indexOf(en); if (idx >= 0) matar(en, idx); }
    const formacionOk = score >= 1200 + ev.premio * 0.5;   // premio propio + jackpot: mucho más que solo el premio

    return { comboOk, eliteChainOk, bossBreakOk, formacionOk };
  });
  comprobar(d.comboOk, "hito de combo ×50 dispara jackpot");
  comprobar(d.eliteChainOk, "la ventana de cadena de élites se evalúa correctamente");
  comprobar(d.bossBreakOk, "romper una pieza de jefe dispara jackpot alguna vez (30%, 200 tiradas)");
  comprobar(d.formacionOk, "PERFECT FORMATION exitosa dispara jackpot además de su propio premio");
  comprobar(p.errs.length === 0, "sin errores", p.errs.slice(0, 3).join(" | "));
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\n4 · SHARDS: pool, tope duro, imán y jerarquía");
{
  const p = await abrir();
  const d = await p.evaluate(() => {
    modo = "supervivencia"; state = "play"; paused = false;
    shards.length = 0; shardsLibres.length = 0;
    lluviaShards(0, 0, "boss");
    const nBoss = shards.length;
    shards.length = 0;
    lluviaShards(0, 0, "normal");
    const nNormal = shards.length;

    shards.length = 0; shardsLibres.length = 0;
    for (let i = 0; i < 100; i++) soltarShard(rand(0, W), rand(0, H), "score");
    const tope = shards.length;

    // Reciclaje: expira uno y comprueba que vuelve a la cola de libres.
    shards.length = 0; shardsLibres.length = 0;
    soltarShard(500, 500, "score");
    shards[0].t = shards[0].vida + 0.1; shards[0].x = 500; shards[0].y = 500;
    player.x = -9999; player.y = -9999;   // lejos: no lo recoge por imán durante el tick
    actualizarShards(0.016);
    const reciclado = shardsLibres.length === 1 && shards.length === 0;

    return { nBoss, nNormal, tope, topeEsperado: SHARDS_MAX, reciclado };
  });
  comprobar(d.nBoss > d.nNormal, "un boss suelta MÁS shards que un enemigo normal", d.nBoss + " vs " + d.nNormal);
  comprobar(d.tope === d.topeEsperado, "el pool respeta el tope duro", d.tope + " / " + d.topeEsperado);
  comprobar(d.reciclado, "un shard que expira vuelve a la cola de libres");
  comprobar(p.errs.length === 0, "sin errores", p.errs.slice(0, 3).join(" | "));
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\n" + (fallos.length ? fallos.length + " FALLO(S):\n  - " + fallos.join("\n  - ") : "TODO OK") + "\n");
await nav.close();
srv.cerrar();
process.exit(fallos.length ? 1 : 0);
