// ════════════════════════════════════════════════════════════
//  dificultad.mjs — EASY / MEDIUM / HIGH (Bloque 6, fase 6B)
// ════════════════════════════════════════════════════════════
//
//    node herramientas/pruebas/dificultad.mjs
//
//  El contrato de la fase: MEDIUM es el juego de siempre. Esta prueba
//  no confía en "no lo he tocado" — compara los multiplicadores reales
//  contra 1 en todos los sitios donde se aplican (bala enemiga,
//  cadencia, telegráfico, invulnerabilidad, combo) y falla si alguno
//  se ha movido. Luego comprueba que FÁCIL y DIFÍCIL sí se mueven, en
//  la dirección correcta, y que la elección persiste y se aísla entre
//  el jugador normal y ADMIN igual que el resto del save.

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
console.log("\n1 · MEDIUM = el juego de siempre");
{
  const p = await abrir();
  const d = await p.evaluate(() => ({
    opcion: OPCIONES.dificultad,
    dif: DIF,
    balaVel: (() => { const b = eBala(0, 0, 100, -100, 5); const r = { vx: b.vx, vy: b.vy }; eBullets.length = 0; return r; })(),
    comboVentana: comboVentana(),
    comboTiempoConfig: CONFIG.comboTiempo,
  }));
  comprobar(d.opcion === "medium", "dificultad por defecto es medium", d.opcion);
  comprobar(d.dif.enemyBulletSpeedMul === 1, "bala enemiga sin multiplicar en medium");
  comprobar(d.dif.enemyCadenceMul === 1, "cadencia sin multiplicar en medium");
  comprobar(d.dif.telegraphMul === 1, "telegráfico sin multiplicar en medium");
  comprobar(d.dif.invulnMul === 1, "invulnerabilidad sin multiplicar en medium");
  comprobar(d.dif.comboToleranceMul === 1, "tolerancia de combo sin multiplicar en medium");
  comprobar(d.dif.defensiveDropMul === 1, "drops defensivos sin multiplicar en medium");
  comprobar(d.balaVel.vx === 100 && d.balaVel.vy === -100, "eBala() no toca la velocidad en medium", JSON.stringify(d.balaVel));
  comprobar(d.comboVentana === d.comboTiempoConfig, "comboVentana() == CONFIG.comboTiempo en medium", d.comboVentana + " vs " + d.comboTiempoConfig);
  comprobar(p.errs.length === 0, "sin errores", p.errs.slice(0, 3).join(" | "));
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\n2 · FÁCIL y DIFÍCIL se mueven en la dirección correcta");
{
  const p = await abrir();
  const d = await p.evaluate(() => {
    const de = DIFFICULTY_CONFIG.easy, dh = DIFFICULTY_CONFIG.high;
    const invulnEasy = CONFIG.invulnerable * de.invulnMul;
    const invulnHigh = CONFIG.invulnerable * dh.invulnMul;
    return {
      balaMasLentaEasy: de.enemyBulletSpeedMul < 1,
      balaMasRapidaHigh: dh.enemyBulletSpeedMul > 1,
      cadenciaMenorEasy: de.enemyCadenceMul > 1,   // cd más largo = ataca menos
      cadenciaMayorHigh: dh.enemyCadenceMul < 1,
      telegrafoLargoEasy: de.telegraphMul > 1,
      telegrafoCortoHigh: dh.telegraphMul < 1,
      invulnEasy, invulnHigh, invulnBase: CONFIG.invulnerable,
      comboToleranteEasy: de.comboToleranceMul > 1,
      comboExigenteHigh: dh.comboToleranceMul < 1,
      dropsDefMejorEasy: de.defensiveDropMul > 1,
      dropsDefPeorHigh: dh.defensiveDropMul < 1,
      scoreOrden: de.scoreMul < DIFFICULTY_CONFIG.medium.scoreMul && DIFFICULTY_CONFIG.medium.scoreMul < dh.scoreMul,
      ningunoTocaVida: de.enemyBulletSpeedMul !== undefined && !("hpMul" in de) && !("hpMul" in dh),
    };
  });
  comprobar(d.balaMasLentaEasy, "FÁCIL: bala enemiga más lenta");
  comprobar(d.balaMasRapidaHigh, "DIFÍCIL: bala enemiga más rápida");
  comprobar(d.cadenciaMenorEasy, "FÁCIL: cadencia enemiga menor (cd más largo)");
  comprobar(d.cadenciaMayorHigh, "DIFÍCIL: cadencia enemiga mayor (cd más corto)");
  comprobar(d.telegrafoLargoEasy, "FÁCIL: telegráficos más largos");
  comprobar(d.telegrafoCortoHigh, "DIFÍCIL: telegráficos más cortos");
  comprobar(d.invulnEasy > d.invulnBase, "FÁCIL: más invulnerabilidad tras un golpe", d.invulnEasy + " vs " + d.invulnBase);
  comprobar(d.invulnHigh < d.invulnBase, "DIFÍCIL: menos invulnerabilidad tras un golpe", d.invulnHigh + " vs " + d.invulnBase);
  comprobar(d.comboToleranteEasy, "FÁCIL: combo más tolerante");
  comprobar(d.comboExigenteHigh, "DIFÍCIL: combo más exigente");
  comprobar(d.dropsDefMejorEasy, "FÁCIL: drops defensivos ligeramente mejores");
  comprobar(d.dropsDefPeorHigh, "DIFÍCIL: menos ayudas defensivas");
  comprobar(d.scoreOrden, "score: FÁCIL < NORMAL < DIFÍCIL");
  comprobar(d.ningunoTocaVida, "ninguna dificultad declara multiplicador de vida de enemigo (no x2 HP)");
  comprobar(p.errs.length === 0, "sin errores", p.errs.slice(0, 3).join(" | "));
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\n3 · Cambiar dificultad en AJUSTES resuelve DIF al instante");
{
  const p = await abrir();
  const d = await p.evaluate(() => {
    OPCIONES.dificultad = "high"; resolverDificultad();
    const balaHigh = (() => { const b = eBala(0, 0, 100, 0, 5); const r = b.vx; eBullets.length = 0; return r; })();
    OPCIONES.dificultad = "easy"; resolverDificultad();
    const balaEasy = (() => { const b = eBala(0, 0, 100, 0, 5); const r = b.vx; eBullets.length = 0; return r; })();
    return { balaHigh, balaEasy, labelHigh: DIFFICULTY_CONFIG.high.label, labelEasy: DIFFICULTY_CONFIG.easy.label };
  });
  comprobar(Math.abs(d.balaHigh - 110) < 1e-6, "DIFÍCIL: bala a 110 tras resolverDificultad()", d.balaHigh);
  comprobar(Math.abs(d.balaEasy - 90) < 1e-6, "FÁCIL: bala a 90 tras resolverDificultad()", d.balaEasy);
  comprobar(d.labelHigh === "DIFÍCIL" && d.labelEasy === "FÁCIL", "etiquetas en español");
  comprobar(p.errs.length === 0, "sin errores", p.errs.slice(0, 3).join(" | "));
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\n4 · La elección persiste y sobrevive a una recarga");
{
  const p = await abrir();
  await p.evaluate(() => { OPCIONES.dificultad = "high"; guardarOpciones(); });
  await p.reload({ waitUntil: "load" });
  await p.waitForTimeout(900);
  const d = await p.evaluate(() => ({ opcion: OPCIONES.dificultad, label: DIF.label }));
  comprobar(d.opcion === "high", "OPCIONES.dificultad sobrevive a la recarga", d.opcion);
  comprobar(d.label === "DIFÍCIL", "DIF se resuelve solo al cargar el save", d.label);
  comprobar(p.errs.length === 0, "sin errores", p.errs.slice(0, 3).join(" | "));
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\n5 · ADMIN elige la suya sin tocar la del jugador normal (aislamiento)");
{
  const p = await abrir();
  await p.evaluate(() => { OPCIONES.dificultad = "easy"; resolverDificultad(); guardarOpciones(); });
  await p.waitForTimeout(900); // deja asentar el autoguardado con freno antes de la foto
  const antes = await p.evaluate(() => localStorage.getItem("sf_save"));
  const enAdmin = await p.evaluate(() => {
    ADMIN.entrar(ADMIN.PIN_FABRICA, "eloi");
    OPCIONES.dificultad = "high"; resolverDificultad(); guardarOpciones();
    return { opcion: OPCIONES.dificultad, label: DIF.label };
  });
  comprobar(enAdmin.opcion === "high" && enAdmin.label === "DIFÍCIL", "ADMIN puede elegir DIFÍCIL para su propio perfil", JSON.stringify(enAdmin));
  await p.evaluate(() => { ADMIN.salir(); });
  // Mismo margen que la prueba 6 de admin.mjs: el freno del autoguardado
  // tiene hasta 400 ms — sin esperar aquí, la foto se toma antes de que
  // termine de asentar y el resultado es ruido, no una regresión real.
  await p.waitForTimeout(900);
  const despues = await p.evaluate(() => localStorage.getItem("sf_save"));
  const vueltaJugador = await p.evaluate(() => OPCIONES.dificultad);
  comprobar(antes === despues, "el save del jugador normal no cambió ni un byte");
  comprobar(vueltaJugador === "easy", "al salir de ADMIN, el jugador normal conserva FÁCIL", vueltaJugador);
  comprobar(p.errs.length === 0, "sin errores", p.errs.slice(0, 3).join(" | "));
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\n" + (fallos.length ? fallos.length + " FALLO(S):\n  - " + fallos.join("\n  - ") : "TODO OK") + "\n");
await nav.close();
srv.cerrar();
process.exit(fallos.length ? 1 : 0);
