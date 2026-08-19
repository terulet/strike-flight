// ════════════════════════════════════════════════════════════
//  maquetacion.mjs — que 20 misiones quepan donde caben 10
// ════════════════════════════════════════════════════════════
//
//    node herramientas/pruebas/maquetacion.mjs
//
//  El juego NO tiene desplazamiento, así que una lista que no cabe no se
//  corta: desaparece por abajo, sin error de consola y sin que nada lo
//  diga. Con diez misiones eso no pasaba nunca; con veinte (desde el
//  bloque 5H, las 20 son reales) pasa en cualquier móvil corto, y quien
//  lo sufriría es justo quien ya se pasó el juego y viene a jugar la
//  expansión.
//
//  Hasta el bloque 5H esta prueba INYECTABA diez misiones de mentira
//  sobre las diez reales para adelantarse a probar el layout de 5C
//  antes de que la expansión existiera. Desde 5H las 20 son reales —
//  inyectar diez más encima daría 30 y falsearía la medida— así que
//  ahora se mide la tabla tal cual está, sin tocarla.
//
//  Se mira lo único que decide si algo se puede jugar: dónde acaban los
//  rectángulos que el propio juego registra para el dedo. No se lee un
//  solo píxel.

import { servidor, cargarPlaywright } from "../qa.mjs";

const srv = await servidor();
const { chromium } = await cargarPlaywright();
const nav = await chromium.launch();

const fallos = [];
const comprobar = (ok, t, extra) => {
  console.log((ok ? "  ok    " : "  FALLO ") + t + (extra ? "   " + extra : ""));
  if (!ok) fallos.push(t);
};

// El iPad es el objetivo; el SE es el suelo. Si cabe en los dos, cabe.
const PANTALLAS = [
  { nombre: "iPad", w: 820, h: 1180 },
  { nombre: "iPhone SE", w: 375, h: 667 },
];

async function abrir(v) {
  const ctx = await nav.newContext({ viewport: { width: v.w, height: v.h },
                                     hasTouch: true, isMobile: true });
  const p = await ctx.newPage();
  p.errs = [];
  p.on("pageerror", e => p.errs.push("EXCEPCION " + e.message));
  p.on("console", m => { if (m.type() === "error") p.errs.push("CONSOLE " + m.text()); });
  await p.goto(srv.url + "/index.html", { waitUntil: "load" });
  await p.waitForTimeout(700);
  p.cerrar = () => ctx.close();
  return p;
}

// ── Lo que se ejecuta dentro del juego ──────────────────────
//  La flecha de volver de `cabecera()` mide 56×44 y no es una tarjeta.
//  Se aparta aquí para no tener que distinguirla en cada comprobación.
function tarjetas() {
  return botones.filter(b => !(b.w === 56 && b.h === 44));
}

function medida() {
  const t = tarjetas();
  const fuera = t.filter(b => b.x < -0.5 || b.y < -0.5 ||
    b.x + b.w > W + 0.5 || b.y + b.h > H - SAFE_BOTTOM + 0.5);
  const solapes = [];
  for (let i = 0; i < t.length; i++) for (let j = i + 1; j < t.length; j++) {
    const a = t[i], b = t[j];
    if (a.x < b.x + b.w - 0.5 && b.x < a.x + a.w - 0.5 &&
        a.y < b.y + b.h - 0.5 && b.y < a.y + a.h - 0.5) solapes.push(i + "x" + j);
  }
  const r1 = (v) => Math.round(v * 10) / 10;
  return {
    n: t.length,
    cols: new Set(t.map(b => Math.round(b.x))).size,
    alto: t.length ? r1(t[0].h) : 0,
    ancho: t.length ? Math.round(t[0].w) : 0,
    minAlto: t.length ? r1(Math.min(...t.map(b => b.h))) : 0,
    ultimoAbajo: t.length ? Math.round(Math.max(...t.map(b => b.y + b.h))) : 0,
    limite: Math.round(H - SAFE_BOTTOM),
    fuera: fuera.length, solapes: solapes.length,
    W: Math.round(W), H: Math.round(H),
  };
}

const esperar = () => new Promise(r =>
  requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r))));

// Playwright serializa la función, no su ámbito: los ayudantes de arriba
// viajan como texto y se inyectan antes que el cuerpo.
const AYUDA = [tarjetas, medida].map(f => f.toString()).join("\n") +
  "\nconst esperar = " + esperar.toString() + ";\n";
const dentro = (p, cuerpo) =>
  p.evaluate(new Function(AYUDA + "return (async () => {" + cuerpo + "})()"));

// ════════════════════════════════════════════════════════════
console.log("\n1 · CAMPAÑA CON LAS 20 REALES (bloque 5H)");
for (const v of PANTALLAS) {
  const p = await abrir(v);
  const r = await dentro(p, `
    state = "menu"; pantalla = "campana"; misionMax = 19;
    await esperar();
    return medida();`);
  console.log(`        ${v.nombre.padEnd(10)} campo ${r.W}x${r.H} · ${r.n} tarjetas · ` +
    `${r.cols} col · ${r.ancho}x${r.alto} · la última acaba en ${r.ultimoAbajo}/${r.limite}`);
  comprobar(r.n === 20, "salen las 20 misiones", r.n + "");
  comprobar(r.cols === 2, "★ en DOS columnas", r.cols + " col");
  comprobar(r.ultimoAbajo <= r.limite,
    "★ y la vigésima cabe entera: ninguna se cae de la pantalla",
    r.ultimoAbajo + " <= " + r.limite);
  comprobar(r.solapes === 0, "ninguna tarjeta pisa a otra", r.solapes + " solapes");
  comprobar(r.fuera === 0, "ninguna se sale por los lados", r.fuera + " fuera");
  // 38 px es el suelo de lo que se acierta con el dedo en marcha.
  comprobar(r.minAlto >= 38, "y todas siguen siendo tocables", r.minAlto + " px de alto");
  comprobar(!p.errs.length, "sin errores", p.errs.join(" | "));
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\n2 · EL ORDEN SE LEE DE ARRIBA ABAJO, NO EN ZIGZAG");
{
  const p = await abrir(PANTALLAS[0]);
  const r = await dentro(p, `
    state = "menu"; pantalla = "campana"; misionMax = 19;
    await esperar();
    const t = tarjetas();
    return { m1: t[0], m2: t[1], m10: t[9], m11: t[10], m20: t[19] };`);
  comprobar(Math.round(r.m2.x) === Math.round(r.m1.x) && r.m2.y > r.m1.y,
    "★ la M2 va DEBAJO de la M1, no al lado");
  comprobar(r.m11.x > r.m10.x && Math.round(r.m11.y) === Math.round(r.m1.y),
    "★ la M11 abre la segunda columna, arriba del todo");
  comprobar(Math.round(r.m20.x) === Math.round(r.m11.x) && r.m20.y > r.m11.y,
    "y la M20 la cierra abajo");
  comprobar(!p.errs.length, "sin errores", p.errs.join(" | "));
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\n3 · LOS NOMBRES NO SE SALEN DE SU TARJETA");
{
  const p = await abrir(PANTALLAS[1]);
  const r = await p.evaluate(() => {
    ctx.font = "800 11px " + F;
    const mide = (t, esp) => {
      let w = esp * (t.length - 1);
      for (const ch of t) w += ancho(ch);
      return w;
    };
    const largo = "MISION EXPANSION 11 NOMBRE LARGO";
    const cortado = cortar(largo, 120, 1.1);
    return { cabe: mide(cortado, 1.1) <= 120, recortado: cortado !== largo,
             final: cortado.slice(-1), corto: cortar("M1", 120, 1.1) };
  });
  comprobar(r.cabe, "un nombre largo se corta a la medida que se le da");
  comprobar(r.recortado && r.final === "…", "y se ve que está cortado", r.final);
  comprobar(r.corto === "M1", "uno que ya cabe no se toca", r.corto);
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\n4 · SUPERVIVENCIA CON SUS 4 Y CON 9 MUNDOS");
for (const v of PANTALLAS) {
  const p = await abrir(v);
  const r4 = await dentro(p, `
    state = "menu"; pantalla = "mundos";
    await esperar();
    return medida();`);
  comprobar(r4.n === 4 && r4.cols === 1,
    v.nombre + ": los 4 de hoy siguen en una columna", r4.n + " en " + r4.cols + " col");
  comprobar(r4.ultimoAbajo <= r4.limite, "y caben", r4.ultimoAbajo + " <= " + r4.limite);

  // Cinco mundos más, metidos en la lista A PROPÓSITO, que es la única
  // forma de que supervivencia crezca: la expansión los añade a mano,
  // no por arrastre de TEMAS.
  const r9 = await dentro(p, `
    ["hielo", "grieta", "abismo", "forja", "vacio"].forEach(id => {
      TEMAS.push({ id, nombre: "MUNDO " + id.toUpperCase(), icono: "*",
        fondoA: "#000", fondoB: "#111", bg: "estrellas", bgColor: "#fff",
        nave: "#8cf", naveAla: "#8cf", cabina: "#fff", motor: "#8cf",
        bala: "#fff", enemigoA: "#f00", enemigoB: "#0f0", enemigoC: "#00f" });
      SURVIVAL_MUNDOS.push(id);
    });
    await esperar();
    return medida();`);
  console.log(`        ${v.nombre.padEnd(10)} 9 mundos · ${r9.cols} col · ` +
    `${r9.ancho}x${r9.alto} · el último acaba en ${r9.ultimoAbajo}/${r9.limite}`);
  comprobar(r9.n === 9, "los nueve salen", r9.n + "");
  comprobar(r9.ultimoAbajo <= r9.limite,
    "★ y el noveno cabe entero", r9.ultimoAbajo + " <= " + r9.limite);
  comprobar(r9.solapes === 0 && r9.fuera === 0, "sin solapes ni desbordes");
  comprobar(!p.errs.length, "sin errores", p.errs.join(" | "));
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\n5 · EL SELECTOR DE JEFES DE ADMIN, CON 20");
for (const v of PANTALLAS) {
  const p = await abrir(v);
  const r = await dentro(p, `
    ADMIN.entrar("eloi");
    state = "menu"; pantalla = "admin"; ADMIN.vista = "jefes";
    await esperar();
    const t = tarjetas();
    // El VOLVER de la vista de jefes es más bajo que una fila de misión:
    // se cuenta aparte, pero tiene que caber igual.
    const alto = Math.max(...t.map(b => b.h));
    const m = medida();
    m.mis = t.filter(b => Math.abs(b.h - alto) < 0.5).length;
    return m;`);
  console.log(`        ${v.nombre.padEnd(10)} ${r.mis} jefes · ${r.cols} col · ` +
    `alto ${r.alto} · lo más bajo acaba en ${r.ultimoAbajo}/${r.limite}`);
  comprobar(r.mis === 20, "los 20 jefes en la lista", r.mis + "");
  comprobar(r.ultimoAbajo <= r.limite,
    "★ y ni la lista ni el VOLVER se salen", r.ultimoAbajo + " <= " + r.limite);
  comprobar(r.solapes === 0, "sin solapes", r.solapes + "");
  comprobar(!p.errs.length, "sin errores", p.errs.join(" | "));
  await p.cerrar();
}

await nav.close();
srv.cerrar();
if (fallos.length) {
  console.log("\nFALLOS: " + fallos.length);
  for (const f of fallos) console.log(" - " + f);
  process.exit(1);
}
console.log("\nTodo correcto.");
