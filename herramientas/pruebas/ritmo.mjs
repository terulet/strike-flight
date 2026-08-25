// ════════════════════════════════════════════════════════════
//  ritmo.mjs — RHYTHM DIRECTOR y BONUS EVENTS (Bloque 6, fase 6D)
// ════════════════════════════════════════════════════════════
//
//    node herramientas/pruebas/ritmo.mjs

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
console.log("\n1 · RHYTHM.marcar(): huecos por debajo del umbral no cuentan");
{
  const p = await abrir();
  const d = await p.evaluate(() => {
    modo = "supervivencia"; state = "play"; paused = false;
    elapsed = 0; RHYTHM.reiniciar();
    elapsed = 2; RHYTHM.marcar();          // hueco de 2s: por debajo de UMBRAL (4)
    const trasCorto = { huecos: RHYTHM.huecos.length, maxHueco: RHYTHM.maxHueco };
    elapsed = 9; RHYTHM.marcar();          // hueco de 7s: por encima
    const trasLargo = { huecos: RHYTHM.huecos.length, maxHueco: RHYTHM.maxHueco };
    return { trasCorto, trasLargo, umbral: RHYTHM.UMBRAL };
  });
  comprobar(d.trasCorto.huecos === 0, "un hueco de 2s no se registra (umbral=" + d.umbral + ")");
  comprobar(d.trasLargo.huecos === 1, "un hueco de 7s sí se registra", d.trasLargo.huecos);
  comprobar(Math.abs(d.trasLargo.maxHueco - 7) < 1e-6, "maxHueco refleja el hueco real", d.trasLargo.maxHueco);
  comprobar(p.errs.length === 0, "sin errores", p.errs.slice(0, 3).join(" | "));
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\n2 · Tope duro de huecos registrados");
{
  const p = await abrir();
  const d = await p.evaluate(() => {
    modo = "supervivencia"; state = "play"; paused = false;
    elapsed = 0; RHYTHM.reiniciar();
    for (let i = 0; i < 250; i++) { elapsed += 10; RHYTHM.marcar(); }
    return { n: RHYTHM.huecos.length, tope: RHYTHM.HUECOS_MAX };
  });
  comprobar(d.n === d.tope, "250 huecos no superan el tope duro", d.n + " / " + d.tope);
  comprobar(p.errs.length === 0, "sin errores", p.errs.slice(0, 3).join(" | "));
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\n3 · BONUS WAVE: matar los objetivos marcados cierra el evento con éxito");
{
  const p = await abrir();
  const d = await p.evaluate(() => {
    modo = "supervivencia"; state = "play"; paused = false; score = 0;
    bonusEvento = null;
    const ev = iniciarBonusEvento("bonus_wave", { objetivo: 3 });
    // spawnFormacion encola en spawnQueue con retraso: forzar que entren YA.
    for (const q of spawnQueue) q.at = 0;
    for (let i = 0; i < 5; i++) {
      for (let j = spawnQueue.length - 1; j >= 0; j--) {
        const q = spawnQueue[j];
        if (elapsed >= q.at) { const e = spawnEnemy(q.tipo, q.x); if (q.marca) e.bonusGen = q.marca; spawnQueue.splice(j, 1); }
      }
    }
    const marcados = enemies.filter(e => e.bonusGen === ev.gen);
    for (const e of marcados) {
      const i = enemies.indexOf(e);
      if (i >= 0) matar(e, i);
    }
    return { objetivo: ev.objetivo, marcados: marcados.length, estado: bonusEvento && bonusEvento.estado, progreso: bonusEvento && bonusEvento.progreso, score };
  });
  comprobar(d.marcados === 3, "se marcaron los 3 enemigos del evento", d.marcados);
  comprobar(d.estado === "exito", "matar los 3 cierra el evento con éxito", d.estado);
  comprobar(d.score > 0, "el score sube con el premio del evento", d.score);
  comprobar(p.errs.length === 0, "sin errores", p.errs.slice(0, 3).join(" | "));
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\n4 · CONVOY/FORMACIÓN: un objetivo marcado que ESCAPA falla el evento al instante");
{
  const p = await abrir();
  const d = await p.evaluate(() => {
    modo = "supervivencia"; state = "play"; paused = false;
    bonusEvento = null;
    const ev = iniciarBonusEvento("convoy", { objetivo: 3 });
    const marcado = enemies.find(e => e.bonusGen === ev.gen);
    marcado.y = H + 50;   // fuera de pantalla: el bucle de update lo detectará como fuga
    return { antes: bonusEvento.estado, tieneMarcado: !!marcado };
  });
  comprobar(d.tieneMarcado, "convoy() marca sus transportes al nacer");
  comprobar(d.antes === "activo", "el evento sigue activo antes de que el bucle procese la fuga");

  await p.waitForTimeout(400);   // deja correr un par de fotogramas reales
  const tras = await p.evaluate(() => ({ estado: bonusEvento && bonusEvento.estado }));
  comprobar(tras.estado === "fallo", "el bucle de juego detecta la fuga y falla el evento", tras.estado);
  comprobar(p.errs.length === 0, "sin errores", p.errs.slice(0, 3).join(" | "));
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\n5 · RISK GATE: recibir un golpe falla; aguantar el tiempo entero da éxito");
{
  const p = await abrir();
  const falla = await p.evaluate(() => {
    modo = "supervivencia"; state = "play"; paused = false;
    player = player || { x: W / 2, y: H * 0.78 };
    escudo = 0; invulnT = 0; lives = 3; bonusEvento = null;
    iniciarBonusEvento("riesgo");
    const activoAntes = bonusEvento.estado === "activo";
    golpe();
    return { activoAntes, estado: bonusEvento.estado };
  });
  comprobar(falla.activoAntes, "RISK GATE arranca activo");
  comprobar(falla.estado === "fallo", "un golpe durante RISK GATE lo falla", falla.estado);

  const exito = await p.evaluate(() => {
    bonusEvento = null;
    iniciarBonusEvento("riesgo");
    bonusEvento.t = bonusEvento.duracion + 0.1;
    actualizarBonusEvento(0.016);
    return { estado: bonusEvento.estado };
  });
  comprobar(exito.estado === "exito", "aguantar hasta el final da éxito, no fallo", exito.estado);
  comprobar(p.errs.length === 0, "sin errores", p.errs.slice(0, 3).join(" | "));
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\n6 · El Director interviene solo cuando la pantalla está vacía y el hueco es real");
{
  const p = await abrir();
  const d = await p.evaluate(() => {
    modo = "supervivencia"; state = "play"; paused = false;
    elapsed = 0; RHYTHM.reiniciar(); bonusEvento = null; rhythmDirectorCooldownT = 0;
    enemies.length = 0; spawnQueue.length = 0; miniboss = null;
    elapsed = 20; RHYTHM.ultimo = 12;   // hueco de 8s, ya por encima del 70% del umbral
    rhythmDirectorTick(0.016);
    const conHuecoYVacio = !!bonusEvento;
    bonusEvento = null;
    enemies.push({ tipo: "normal", hp: 1 });   // pantalla NO vacía
    rhythmDirectorTick(0.016);
    const conEnemigosEnPantalla = !!bonusEvento;
    return { conHuecoYVacio, conEnemigosEnPantalla };
  });
  comprobar(d.conHuecoYVacio, "con hueco real y pantalla vacía, el Director dispara un bonus event");
  comprobar(!d.conEnemigosEnPantalla, "con enemigos ya en pantalla, el Director NO interviene");
  comprobar(p.errs.length === 0, "sin errores", p.errs.slice(0, 3).join(" | "));
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\n7 · descansoOn suprime al Director; descansoOff lo devuelve");
{
  const p = await abrir();
  const d = await p.evaluate(() => {
    modo = "supervivencia"; state = "play"; paused = false;
    elapsed = 20; RHYTHM.ultimo = 12; bonusEvento = null; rhythmDirectorCooldownT = 0;
    enemies.length = 0; spawnQueue.length = 0; miniboss = null;
    procesarEvento({ fn: "descansoOn" });
    rhythmDirectorTick(0.016);
    const conDescanso = !!bonusEvento;
    procesarEvento({ fn: "descansoOff" });
    rhythmDirectorTick(0.016);
    const sinDescanso = !!bonusEvento;
    return { conDescanso, sinDescanso, flag: descansoDeliberado };
  });
  comprobar(!d.conDescanso, "con descansoOn activo, el Director NO interviene aunque el hueco sea real");
  comprobar(d.sinDescanso, "descansoOff devuelve el control al Director");
  comprobar(p.errs.length === 0, "sin errores", p.errs.slice(0, 3).join(" | "));
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\n" + (fallos.length ? fallos.length + " FALLO(S):\n  - " + fallos.join("\n  - ") : "TODO OK") + "\n");
await nav.close();
srv.cerrar();
process.exit(fallos.length ? 1 : 0);
