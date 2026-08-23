// ════════════════════════════════════════════════════════════
//  dificultad.mjs — EASY / MEDIUM / HIGH (bloque 6B)
// ════════════════════════════════════════════════════════════
//
//    node herramientas/pruebas/dificultad.mjs
//
//  Lo que se vigila aquí, por orden de gravedad:
//
//    1. QUE MEDIUM SIGA SIENDO EL JUEGO CANÓNICO. No "parece igual":
//       se llaman las funciones de verdad en el navegador y se compara
//       su resultado contra el índice ORIGINAL sacado de git. Si un
//       solo número se mueve en MEDIUM, esto falla. Es la única razón
//       de ser de este archivo.
//
//    2. Que EASY y HIGH muevan SOLO lo aprobado. Una dificultad que
//       toca algo que nadie aprobó es un cambio de balance escondido.
//
//    3. Que el HP de los enemigos no se toque en ninguna de las tres.
//
//    4. Que la dificultad persista y que un save antiguo entre en
//       MEDIUM sin migración.
//
//  Y lo de siempre: 0 excepciones, 0 peticiones fallidas.
// ════════════════════════════════════════════════════════════
import { servidor, cargarPlaywright } from "../qa.mjs";
import { execFileSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const BASE = "fa1db20";   // el índice canónico contra el que se compara

const fallos = [];
const comprobar = (ok, t, extra) => {
  console.log("   " + (ok ? "✓" : "✗") + " " + t + (extra ? "  " + extra : ""));
  if (!ok) fallos.push(t + (extra ? " — " + extra : ""));
};

// ── El original, sacado de git ────────────────────────────
//  No se copian los números a mano a este archivo: se leen del commit
//  base. Así la prueba no puede "aprobar" un valor que alguien cambió
//  en los dos sitios a la vez.
function indiceOriginal() {
  try {
    return execFileSync("git", ["-C", RAIZ, "show", BASE + ":index.html"],
      { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  } catch (e) {
    console.log("   ! No se pudo leer " + BASE + " de git: " + e.message);
    return null;
  }
}
const ORIG = indiceOriginal();
const sacarNumero = (txt, re, etq) => {
  const m = txt && re.exec(txt);
  if (!m) { fallos.push("no encuentro " + etq + " en el índice original"); return null; }
  return parseFloat(m[1]);
};

const srv = await servidor();
const { chromium } = await cargarPlaywright();
const nav = await chromium.launch();

async function abrir() {
  const ctx = await nav.newContext({ viewport: { width: 820, height: 1180 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  const errores = [], fallidas = [];
  p.on("pageerror", (e) => errores.push(e.message));
  p.on("response", (r) => { if (r.status() >= 400) fallidas.push(r.status() + " " + r.url()); });
  await p.goto(srv.url + "/index.html", { waitUntil: "load" });
  await p.waitForTimeout(1200);
  return { ctx, p, errores, fallidas };
}

// ════════════════════════════════════════════════════════════
console.log("\n1 · MEDIUM ES LA IDENTIDAD: TODOS SUS MULTIPLICADORES SON 1");
// ════════════════════════════════════════════════════════════
{
  const { ctx, p, errores, fallidas } = await abrir();
  const t = await p.evaluate(() => {
    const c = DIF.CONFIG;
    return {
      claves: Object.keys(c.medium),
      medium: c.medium,
      mismasClaves: ["easy", "high"].every((d) =>
        Object.keys(c[d]).sort().join() === Object.keys(c.medium).sort().join()),
      identidad: DIF.esIdentidad("medium"),
      porDefecto: DIF.id(),
    };
  });
  comprobar(t.identidad, "DIF.esIdentidad('medium')");
  comprobar(t.claves.every((k) => t.medium[k] === 1),
    "las " + t.claves.length + " claves de MEDIUM valen exactamente 1");
  comprobar(t.mismasClaves, "EASY y HIGH declaran exactamente las mismas claves");
  comprobar(t.porDefecto === "medium", "sin save, la dificultad de salida es MEDIUM", "→ " + t.porDefecto);
  comprobar(errores.length === 0, "0 excepciones", JSON.stringify(errores.slice(0, 2)));
  comprobar(fallidas.length === 0, "0 peticiones fallidas", JSON.stringify(fallidas.slice(0, 2)));
  await ctx.close();
}

// ════════════════════════════════════════════════════════════
console.log("\n2 · EN MEDIUM, CADA ENGANCHE DEVUELVE EL VALOR ORIGINAL");
// ════════════════════════════════════════════════════════════
{
  const { ctx, p } = await abrir();
  const origCombo = sacarNumero(ORIG, /comboTiempo:\s*([\d.]+)/, "CONFIG.comboTiempo");
  const origInvul = sacarNumero(ORIG, /invulnerable:\s*([\d.]+)/, "CONFIG.invulnerable");

  const t = await p.evaluate(() => {
    DIF.poner("medium");
    // La bala enemiga: se pide con una velocidad conocida y se mira la
    // que acaba teniendo. Es el único sitio del juego donde nace una.
    eBullets.length = 0;
    const b = eBala(100, 200, 137, -249, 7);
    const bala = b ? { vx: b.vx, vy: b.vy, r: b.r } : null;
    eBullets.length = 0;
    return {
      bala,
      comboTiempo: tiempoCombo(),
      comboConfig: CONFIG.comboTiempo,
      invulEfectivo: CONFIG.invulnerable * DIF.m("invulnerable"),
      invulConfig: CONFIG.invulnerable,
      cadencia: DIF.m("cadenciaEnemiga"),
    };
  });

  comprobar(t.bala && t.bala.vx === 137 && t.bala.vy === -249,
    "eBala() no toca la velocidad", "vx=" + t.bala?.vx + " vy=" + t.bala?.vy);
  comprobar(t.comboTiempo === t.comboConfig,
    "tiempoCombo() === CONFIG.comboTiempo", t.comboTiempo + "s");
  comprobar(origCombo !== null && t.comboTiempo === origCombo,
    "y ese valor es el del índice original (" + BASE + ")", "original=" + origCombo);
  comprobar(t.invulEfectivo === t.invulConfig,
    "la ventana de invulnerabilidad no cambia", t.invulEfectivo + "s");
  comprobar(origInvul !== null && t.invulEfectivo === origInvul,
    "y coincide con el índice original", "original=" + origInvul);
  comprobar(t.cadencia === 1, "el multiplicador de cadencia es 1");
  await ctx.close();
}

// ════════════════════════════════════════════════════════════
console.log("\n3 · EN MEDIUM, LOS DROPS SALEN EXACTAMENTE IGUAL QUE ANTES");
// ════════════════════════════════════════════════════════════
//  Se fija el dado a una secuencia conocida y se compara premio a
//  premio contra la escalera del índice ORIGINAL, reconstruida aquí
//  desde git. 2000 tiradas.
{
  const { ctx, p } = await abrir();
  // La escalera original, sacada del commit base y no escrita a mano.
  const cuerpoOrig = ORIG && /function elegirPremioAleatorio\(\)\s*\{([\s\S]*?)\n\}/.exec(ORIG);
  const umbrales = cuerpoOrig
    ? [...cuerpoOrig[1].matchAll(/r > ([\d.]+)\) return "([a-z0-9]+)"/g)].map((m) => [parseFloat(m[1]), m[2]])
    : [];
  comprobar(umbrales.length === 6, "la escalera original tiene 6 umbrales fijos", umbrales.length + "");

  const t = await p.evaluate((n) => {
    DIF.poner("medium");
    const real = Math.random;
    const salida = [];
    const rs = [];
    for (let i = 0; i < n; i++) rs.push((i * 0.0004987 + 0.00013) % 1);
    let k = 0;
    // Sólo se fija la PRIMERA tirada de cada llamada (la que elige la
    // banda); las de dentro de las familias de arma siguen siendo reales.
    Math.random = function () { return k < rs.length ? rs[k++] : real(); };
    for (let i = 0; i < n; i++) { k = i; salida.push(elegirPremioAleatorio()); }
    Math.random = real;
    return { salida, rs };
  }, 2000);

  // La misma secuencia por la escalera original, calculada en node.
  //  Se compara la BANDA, no el nombre suelto: dentro de la banda de
  //  familias de arma el juego elige uno al azar por diseño, así que
  //  exigir el mismo nombre sería exigir que el azar se repita.
  const FIJOS = umbrales.map(([, n]) => n);
  const bandaDe = (r) => {
    for (const [u, nombre] of umbrales) if (r > u) return nombre;
    return r > 0.435 ? "familia" : "arma";
  };
  const bandaDelPremio = (premio) =>
    FIJOS.includes(premio) ? premio : (premio === "arma" ? "arma" : "familia");

  let iguales = 0; const distintos = [];
  for (let i = 0; i < t.rs.length; i++) {
    const esperada = bandaDe(t.rs[i]);
    const obtenida = bandaDelPremio(t.salida[i]);
    if (esperada === obtenida) iguales++;
    else if (distintos.length < 5) distintos.push("r=" + t.rs[i].toFixed(4) + " " + esperada + " != " + obtenida);
  }
  const esperado = t.rs;
  comprobar(iguales === t.rs.length,
    "las " + t.rs.length + " tiradas caen en la misma banda que la escalera original",
    distintos.join(" | "));

  // Y que la escalera del archivo ACTUAL no se haya tocado.
  const actual = await p.evaluate(() => elegirPremioAleatorio.toString());
  const mismosUmbrales = umbrales.every(([u, n]) => actual.includes('r > ' + u + ') return "' + n + '"'));
  comprobar(mismosUmbrales, "los 6 umbrales siguen escritos igual en el índice actual");
  await ctx.close();
}

// ════════════════════════════════════════════════════════════
console.log("\n4 · EASY Y HIGH MUEVEN SÓLO LO APROBADO");
// ════════════════════════════════════════════════════════════
{
  const APROBADO = {
    easy: { balaEnemiga: 0.90, cadenciaEnemiga: 1.18, invulnerable: 1.35,
            comboTiempo: 1.35, dropDefensivo: 1.30, telegrafo: 1, elite: 0.60,
            overdrive: 1.15, score: 0.85 },
    high: { balaEnemiga: 1.12, cadenciaEnemiga: 0.86, invulnerable: 0.85,
            comboTiempo: 0.75, dropDefensivo: 0.80, telegrafo: 1, elite: 1.50,
            overdrive: 0.90, score: 1.35 },
  };
  const { ctx, p } = await abrir();
  const c = await p.evaluate(() => DIF.CONFIG);
  for (const dif of ["easy", "high"]) {
    const dif_ok = Object.keys(APROBADO[dif]).every((k) => c[dif][k] === APROBADO[dif][k]);
    comprobar(dif_ok, dif.toUpperCase() + " coincide con la tabla aprobada",
      dif_ok ? "" : JSON.stringify(c[dif]));
  }
  // Y que la bala se mueve de verdad en las otras dos.
  const v = await p.evaluate(() => {
    const out = {};
    for (const d of ["easy", "medium", "high"]) {
      DIF.poner(d); eBullets.length = 0;
      const b = eBala(0, 0, 0, 300, 5); out[d] = b ? b.vy : null; eBullets.length = 0;
    }
    DIF.poner("medium");
    return out;
  });
  comprobar(v.easy < v.medium && v.medium < v.high,
    "la bala enemiga va más lenta en FÁCIL y más rápida en DIFÍCIL",
    "easy=" + v.easy + " medium=" + v.medium + " high=" + v.high);
  comprobar(v.medium === 300, "y en NORMAL es exactamente la pedida");
  await ctx.close();
}

// ════════════════════════════════════════════════════════════
console.log("\n5 · EL HP DE LOS ENEMIGOS NO SE TOCA EN NINGUNA DIFICULTAD");
// ════════════════════════════════════════════════════════════
{
  const { ctx, p } = await abrir();
  const hp = await p.evaluate(() => {
    const out = {};
    for (const d of ["easy", "medium", "high"]) {
      DIF.poner(d);
      out[d] = Object.keys(ENEMIGOS).map((k) => k + ":" + ENEMIGOS[k].hp).join(",");
    }
    DIF.poner("medium");
    return out;
  });
  comprobar(hp.easy === hp.medium && hp.medium === hp.high,
    "los HP de los " + hp.medium.split(",").length + " enemigos son idénticos en las tres");
  const sinHp = await p.evaluate(() =>
    !/\bhp\b/.test(JSON.stringify(DIF.CONFIG)));
  comprobar(sinHp, "DIFFICULTY_CONFIG ni siquiera declara una clave de HP");
  await ctx.close();
}

// ════════════════════════════════════════════════════════════
console.log("\n6 · PERSISTE, Y UN SAVE ANTIGUO ENTRA EN MEDIUM");
// ════════════════════════════════════════════════════════════
{
  // 6a. Se elige DIFÍCIL, se recarga, y tiene que seguir en DIFÍCIL.
  const { ctx, p } = await abrir();
  await p.evaluate(() => { OPCIONES.dificultad = "high"; DIF.poner("high"); guardarOpciones(); });
  await p.waitForTimeout(300);
  await p.reload({ waitUntil: "load" });
  await p.waitForTimeout(1200);
  const tras = await p.evaluate(() => ({ dif: DIF.id(), op: OPCIONES.dificultad }));
  comprobar(tras.dif === "high" && tras.op === "high", "DIFÍCIL sobrevive a recargar", JSON.stringify(tras));

  // 6b. Un save SIN la clave —como los de antes de 6B— entra en MEDIUM.
  await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("sf_save"));
    if (s && s.opciones) delete s.opciones.dificultad;
    localStorage.setItem("sf_save", JSON.stringify(s));
  });
  await p.reload({ waitUntil: "load" });
  await p.waitForTimeout(1200);
  const viejo = await p.evaluate(() => ({
    dif: DIF.id(), op: OPCIONES.dificultad,
    // Y que no se haya perdido nada más por el camino.
    record: SAVE.get("perfil.record", -1), mision: SAVE.get("campana.misionMax", -1),
  }));
  comprobar(viejo.dif === "medium", "un save sin la clave entra en MEDIUM", JSON.stringify(viejo));
  comprobar(viejo.record >= 0 && viejo.mision >= 0, "y el resto del save sigue ahí");

  // 6c. Un valor manipulado no rompe nada.
  await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("sf_save"));
    if (s && s.opciones) s.opciones.dificultad = "imposible";
    localStorage.setItem("sf_save", JSON.stringify(s));
  });
  await p.reload({ waitUntil: "load" });
  await p.waitForTimeout(1200);
  const roto = await p.evaluate(() => DIF.id());
  comprobar(roto === "medium", "un save manipulado cae en MEDIUM", "→ " + roto);
  await ctx.close();
}

await nav.close();
await srv.cerrar();

if (fallos.length) {
  console.log("\nFALLOS: " + fallos.length);
  for (const f of fallos) console.log(" - " + f);
  process.exit(1);
}
console.log("\nTodo correcto.");
