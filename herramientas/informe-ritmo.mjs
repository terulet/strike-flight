// ════════════════════════════════════════════════════════════
//  informe-ritmo.mjs — ritmo de M1-M20, a partir del GUIÓN
// ════════════════════════════════════════════════════════════
//
//    node herramientas/informe-ritmo.mjs
//
//  Análisis ESTÁTICO: lee `MISIONES[i].eventos` (cada uno con su `t`)
//  sin jugar nada. Es una lectura de diseño -¿dónde tiene el guión un
//  hueco que nadie quiso dejar?- que se suma, no sustituye, al
//  contador en vivo `RHYTHM` (herramientas/pruebas/ritmo.mjs), que ve
//  la partida real y no solo lo escrito.
//
//  Umbrales (ver AUDITORIA-BLOQUE6.md para la evidencia con la que se
//  calibraron sobre las 20 misiones reales, no a ojo):
//    TOO EMPTY      hueco máximo > 30s entre eventos con guión
//    TOO BUSY       hueco medio < 5s Y más de 14 eventos/min
//    TOO REPETITIVE 4 o más "ola" seguidas del MISMO tipo de enemigo
//    HEALTHY        ninguna de las anteriores

import { servidor, cargarPlaywright } from "./qa.mjs";

const srv = await servidor();
const { chromium } = await cargarPlaywright();
const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 820, height: 1180 } });
const p = await ctx.newPage();
await p.goto(srv.url + "?debug", { waitUntil: "load" });
await p.waitForTimeout(600);

const datos = await p.evaluate(() => {
  return MISIONES.map((m, i) => {
    const eventos = (m.eventos || []).slice().sort((a, b) => a.t - b.t);
    const ts = eventos.map(e => e.t);
    // El hueco justo DESPUÉS de un miniboss/jefe no es un hueco real: ahí
    // está el combate del jefe, que no vive en `eventos` -lo llena su
    // propia máquina de ataques/telegraphs, ya vigilada en vivo por
    // RHYTHM- así que contarlo como "guión vacío" sería un falso positivo.
    const gaps = [];
    let prev = 0;
    for (let i = 0; i < eventos.length; i++) {
      const t = eventos[i].t;
      const trasBoss = i > 0 && eventos[i - 1].fn === "miniboss";
      if (!trasBoss) gaps.push(t - prev);
      prev = t;
    }
    const duracion = ts.length ? ts[ts.length - 1] : 0;
    const maxGap = gaps.length ? Math.max(...gaps) : 0;
    const avgGap = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0;
    const porMinuto = duracion > 0 ? eventos.length / (duracion / 60) : 0;
    const totalEnemigos = eventos.filter(e => e.fn === "ola").reduce((a, e) => a + (e.n || 0), 0);
    const tieneBoss = eventos.some(e => e.fn === "miniboss");

    // Racha más larga de "ola" consecutivas con el MISMO tipo (sin que
    // se cuele otro evento en medio, que ya rompe la sensación de repetir).
    let racha = 1, rachaMax = 1, tipoAnterior = null;
    for (const e of eventos) {
      if (e.fn !== "ola") { racha = 1; tipoAnterior = null; continue; }
      racha = e.tipo === tipoAnterior ? racha + 1 : 1;
      tipoAnterior = e.tipo;
      rachaMax = Math.max(rachaMax, racha);
    }

    return {
      idx: i, nombre: m.nombre, nEventos: eventos.length, duracion,
      maxGap: Math.round(maxGap * 10) / 10, avgGap: Math.round(avgGap * 10) / 10,
      porMinuto: Math.round(porMinuto * 10) / 10, totalEnemigos, tieneBoss, rachaMax,
    };
  });
});

await nav.close();
srv.cerrar();

const UMBRAL_VACIO = 30, UMBRAL_DENSO_GAP = 5, UMBRAL_DENSO_MIN = 14, UMBRAL_REPETITIVO = 4;

function clasificar(d) {
  const etiquetas = [];
  if (d.maxGap > UMBRAL_VACIO) etiquetas.push("TOO EMPTY");
  if (d.avgGap < UMBRAL_DENSO_GAP && d.porMinuto > UMBRAL_DENSO_MIN) etiquetas.push("TOO BUSY");
  if (d.rachaMax >= UMBRAL_REPETITIVO) etiquetas.push("TOO REPETITIVE");
  return etiquetas.length ? etiquetas.join(" + ") : "HEALTHY";
}

console.log("\n# Ritmo M1-M20 (guión, estático)\n");
console.log(
  "M".padEnd(4) + "nombre".padEnd(24) + "eventos".padEnd(9) + "guión(s)".padEnd(10) +
  "hueco máx".padEnd(11) + "hueco med".padEnd(11) + "ev/min".padEnd(8) + "racha".padEnd(7) + "estado"
);
let vacias = 0, densas = 0, repetitivas = 0, sanas = 0;
for (const d of datos) {
  const estado = clasificar(d);
  if (estado.includes("EMPTY")) vacias++;
  if (estado.includes("BUSY")) densas++;
  if (estado.includes("REPETITIVE")) repetitivas++;
  if (estado === "HEALTHY") sanas++;
  console.log(
    ("M" + (d.idx + 1)).padEnd(4) + d.nombre.slice(0, 22).padEnd(24) +
    String(d.nEventos).padEnd(9) + String(d.duracion).padEnd(10) +
    String(d.maxGap).padEnd(11) + String(d.avgGap).padEnd(11) +
    String(d.porMinuto).padEnd(8) + String(d.rachaMax).padEnd(7) + estado
  );
}
console.log("\nResumen: " + sanas + " HEALTHY · " + vacias + " TOO EMPTY · " + densas + " TOO BUSY · " + repetitivas + " TOO REPETITIVE (de " + datos.length + " misiones)\n");
