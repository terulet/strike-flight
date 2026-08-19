// ════════════════════════════════════════════════════════════
//  mundos.mjs — bloque 5D: los cinco mundos, los hazards y las
//               tres primitivas nuevas
// ════════════════════════════════════════════════════════════
//
//    node herramientas/pruebas/mundos.mjs
//
//  Lo que vigila, en una frase cada cosa:
//
//   · Que los cinco mundos nuevos sean datos COMPLETOS, no medio mundos
//     que revientan el día que una misión los use.
//   · Que supervivencia siga teniendo sus cuatro. Que la campaña crezca
//     no es motivo para que crezca el otro modo, y ya pasó una vez.
//   · Que cada peligro nuevo haga LO SUYO y nada más: el témpano tapa,
//     el tráfico cruza, la mina avisa antes de reventar y el fragmento
//     devuelve una bala hacia arriba.
//   · Que la oscuridad no apague NUNCA un proyectil. Eso se mide leyendo
//     píxeles, no confiando en el orden de dibujo.
//   · Que las primitivas se limpien solas al terminar.
//   · Y que nada de lo anterior —save, ADMIN, hangar, música, VFX y las
//     diez misiones de siempre— se haya movido.

import { servidor, cargarPlaywright } from "../qa.mjs";

const srv = await servidor();
const { chromium } = await cargarPlaywright();
const nav = await chromium.launch();

const fallos = [];
const comprobar = (ok, t, extra) => {
  console.log((ok ? "  ok    " : "  FALLO ") + t + (extra ? "   " + extra : ""));
  if (!ok) fallos.push(t);
};

const MUNDOS_NUEVOS = ["hielo", "megaciudad", "abismo", "fragua", "grieta"];

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

// Deja la partida en un estado conocido: en juego, sin nadie más en el
// campo y con el reloj de misión parado, para que un evento del guión no
// meta una oleada en mitad de una medición.
const escenaLimpia = `
  OPCIONES.vfx = "alto"; aplicarVFX();
  modo = "campana"; iniciarMision(0);
  await new Promise(r => setTimeout(r, 260));
  misionIniT = 0; eventoIdx = MISIONES[0].eventos.length;
  enemies.length = 0; eBullets.length = 0; bullets.length = 0;
  hazards.length = 0; columnas.length = 0; rupturas.length = 0;
  miniboss = null; hazardEnabled = false; zonaEnabled = false;
  oscuro.k = 0; oscuro.obj = 0; oscuro.dur = 0;
  state = "play"; paused = false; lives = 3; score = 0;
  player.x = W / 2; player.y = H * 0.8; targetX = player.x; targetY = player.y;
  VFX.limpiar();
`;
const frames = (n) => `
  for (let i = 0; i < ${n}; i++) await new Promise(r => requestAnimationFrame(r));
`;
const dentro = (cuerpo) => p.evaluate(new Function("return (async () => {" + cuerpo + "})()"));

// ── El reloj lo lleva la prueba ──────────────────────────────
//  En headless el navegador da veinte fotogramas por segundo, así que
//  medir "0,6 segundos" esperando 0,6 segundos mide otra cosa: el
//  telegráfico de una columna dura 0,95 s y con esa imprecisión la
//  comprobación de "durante el aviso no hace daño" se vuelve una
//  moneda al aire.
//
//  Así que se le quita el volante al bucle —que sigue PINTANDO, que es
//  lo que hace falta para leer píxeles— y la lógica avanza a pasos
//  fijos cuando la prueba lo dice. Es la única forma de comprobar una
//  máquina de estados por tiempo sin que el resultado dependa de lo
//  rápido que vaya la máquina de quien la ejecute.
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
await congelar();
// `escenaLimpia` deja `eventoIdx` al final del guión y el campo sin
// enemigos A PROPÓSITO, para que ningún evento de la M1 interfiera con
// lo que se está midiendo. Pero esa combinación es EXACTAMENTE la que
// dispara `cerrarMision()` en el primer tick: sube el marcador, guarda
// la partida y planta la pantalla de "MISIÓN COMPLETADA" seis segundos
// y medio encima de todo, tapando cualquier píxel que se quisiera leer
// debajo. No es la mecánica que se está probando, así que se desactiva
// para todo este archivo — igual que se congela el paso lógico.
await p.evaluate(() => { cerrarMision = () => {}; });
// El jugador dispara SOLO, sin que nadie toque la pantalla — es como
// funciona el juego de verdad. Pero eso significa que cualquier avance
// de varios fotogramas mete balas propias en `bullets` por su cuenta, y
// esas balas pueden llegar a golpear al propio hazard que se está
// midiendo (el tráfico, el fragmento…) antes de que la prueba termine
// de leerlo. No es lo que se está probando, así que se apaga aquí, una
// vez, para todo el archivo.
await p.evaluate(() => { disparar = () => {}; });

// ════════════════════════════════════════════════════════════
console.log("\n1 · LOS CINCO MUNDOS SON DATOS COMPLETOS");
{
  const r = await dentro(`
    const base = TEMAS.find(t => t.id === "espacio");
    const clavesBase = Object.keys(base);
    const info = ${JSON.stringify(MUNDOS_NUEVOS)}.map(id => {
      const t = TEMAS.find(x => x.id === id);
      if (!t) return { id, falta: "NO EXISTE" };
      const faltan = clavesBase.filter(k => t[k] == null);
      const colores = clavesBase.filter(k => /^(nave|naveAla|cabina|motor|bala|enemigo|fondoA|fondoB|bgColor)/.test(k))
        .filter(k => !/^#[0-9a-f]{6}$/i.test(String(t[k])));
      return { id, nombre: t.nombre, faltan, colores, bg: t.bg,
               solo: !!t.soloCampana, hazards: (t.hazards || []).join(","),
               prim: (t.primitivas || []).join(","), pista: t.pista,
               fondo: fondoDe(t) };
    });
    return { total: TEMAS.length, info, bgs: TEMAS.map(t => t.bg) };
  `);
  comprobar(r.total === 9, "TEMAS pasa de 4 a 9 mundos", r.total + "");
  for (const t of r.info) {
    console.log(`        ${t.id.padEnd(11)} ${String(t.nombre).padEnd(20)} fondo ${String(t.fondo).padEnd(11)}` +
      ` bg ${String(t.bg).padEnd(10)} hazards ${t.hazards || "—"}` + (t.prim ? " · prim " + t.prim : ""));
    comprobar(!t.falta && t.faltan.length === 0,
      t.id + ": tiene todos los campos que tiene un mundo de siempre",
      t.falta || (t.faltan.length ? "faltan " + t.faltan.join(",") : "completo"));
    comprobar(!t.colores || t.colores.length === 0,
      t.id + ": sus colores son colores", (t.colores || []).join(",") || "todos válidos");
    comprobar(t.solo === true, t.id + ": marcado como mundo de campaña");
    comprobar(!!t.hazards, t.id + ": declara qué peligros admite", t.hazards);
    comprobar(!!t.pista, t.id + ": declara su música de combate", t.pista);
  }
  comprobar(r.bgs.every(b => ["estrellas", "burbujas", "brasas", "rejilla"].includes(b)),
    "y ninguno pide una partícula de fondo que no existe", r.bgs.join(","));
}

// ════════════════════════════════════════════════════════════
console.log("\n2 · EL FONDO DE CADA MUNDO, Y EL REPUESTO");
{
  for (const id of MUNDOS_NUEVOS) {
    const r = await dentro(`
      T = TEMAS.find(t => t.id === "${id}");
      ${frames(3)}
      await new Promise(r => setTimeout(r, 700));
      ${frames(2)}
      const clave = "f_" + fondoDe(T);
      const img = SPRITES[clave];
      return { clave, cargado: !!img, w: img ? img.naturalWidth : 0,
               ref: T.fondoRef || null, propio: fondoDe(T) === T.id };
    `);
    comprobar(r.cargado, id + ": su fondo carga de verdad",
      r.clave + (r.ref ? " (prestado de " + r.ref + ")" : "") + " · " + r.w + " px");
  }
  const meg = await dentro(`return { ref: TEMAS.find(t => t.id === "megaciudad").fondoRef }`);
  comprobar(meg.ref === "neon",
    "★ megaciudad no tiene PNG propio y lo dice: usa el de NEÓN", meg.ref);
  comprobar(!p404.length, "y ninguna petición se ha ido a 404", p404.join(" ") || "ninguna");
}

// ════════════════════════════════════════════════════════════
console.log("\n3 · CARGA BAJO DEMANDA: NO SE PIDEN LOS NUEVE AL ARRANCAR");
{
  const ctx2 = await nav.newContext({ viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true });
  const p2 = await ctx2.newPage();
  const pedidos = [];
  p2.on("request", r => { const u = r.url(); if (/art\/fondos\/.*\.png/.test(u)) pedidos.push(u.split("/").pop()); });
  await p2.goto(srv.url + "/index.html", { waitUntil: "load" });
  await p2.waitForTimeout(1500);
  console.log("        fondos pedidos en el arranque: " + (pedidos.join(", ") || "ninguno"));
  comprobar(pedidos.length <= 2,
    "★ el arranque pide UN fondo, no los nueve", pedidos.length + " de 9");
  comprobar(!pedidos.includes("grieta.png") && !pedidos.includes("abismo.png"),
    "y desde luego no los de mundos donde no se está");
  await ctx2.close();
}

// ════════════════════════════════════════════════════════════
console.log("\n4 · SUPERVIVENCIA SIGUE TENIENDO SUS CUATRO");
{
  const r = await dentro(`
    state = "menu"; pantalla = "mundos";
    ${frames(3)}
    return { lista: SURVIVAL_MUNDOS.join(","),
             resueltos: TEMAS_SUPERVIVENCIA().map(t => t.id).join(","),
             temas: TEMAS.length, botones: botones.length,
             nuevosDentro: ${JSON.stringify(MUNDOS_NUEVOS)}.filter(id => SURVIVAL_MUNDOS.indexOf(id) >= 0) };
  `);
  comprobar(r.lista === "espacio,oceano,volcan,neon",
    "★ la lista sigue siendo la de siempre", r.lista);
  comprobar(r.nuevosDentro.length === 0,
    "★ ninguno de los cinco nuevos se ha colado", r.nuevosDentro.join(",") || "ninguno");
  comprobar(r.temas === 9 && r.resueltos.split(",").length === 4,
    "nueve mundos en TEMAS, cuatro en supervivencia", r.temas + " → 4");
  comprobar(r.botones === 5, "la pantalla dibuja 4 mundos + volver", r.botones + " botones");
}

// ════════════════════════════════════════════════════════════
console.log("\n5 · LA CAMPAÑA SÍ LOS RECONOCE");
{
  const r = await dentro(`
    const antes = MISIONES[0].temaId;
    MISIONES[0].temaId = "grieta";
    modo = "campana"; iniciarMision(0);
    ${frames(4)}
    const dentro = { id: T.id, nombre: T.nombre, pista: pistaCombate() };
    MISIONES[0].temaId = antes;
    iniciarMision(0);
    ${frames(2)}
    return { dentro, vuelta: T.id, base: antes };
  `);
  comprobar(r.dentro.id === "grieta",
    "una misión puede pedir un mundo nuevo y entra en él", r.dentro.nombre);
  comprobar(r.dentro.pista === "combate_b",
    "y suena la pista que el mundo pide, no la del índice de misión", r.dentro.pista);
  comprobar(r.vuelta === r.base, "y al volver a la M1 vuelve su mundo", r.vuelta);
}

// ════════════════════════════════════════════════════════════
console.log("\n6 · TÉMPANO: TAPA LO QUE LE DISPARAN Y LO QUE DISPARAS");
{
  const r = await dentro(`
    ${escenaLimpia}
    hazardTipo = "tempano"; spawnHazard();
    const h = hazards[0];
    h.warnT = 0; h.x = W / 2; h.y = H * 0.45; h.vx = 0; h.vy = 0;
    // Bala ENEMIGA justo encima del témpano.
    eBala(h.x, h.y - 2, 0, 200, 6);
    const eAntes = eBullets.length;
    ${avanzar(0.1)}
    const eDespues = eBullets.length;
    // Y una TUYA, marcada para no confundirla con las del disparo
    // automático: el jugador sigue disparando solo durante el avance, así
    // que contar el tamaño del array mediría eso, no el témpano.
    const b = { x: h.x, y: h.y + 2, vx: 0, vy: -300, r: 4, dmg: 2, largo: 20,
                col: "#fff", cd: 0, ang: 0, marca: "prueba-tempano" };
    bullets.push(b);
    const hpAntes = h.hp, puntos = score;
    ${avanzar(0.1)}
    return { eAntes, eDespues,
             sigue: bullets.some(x => x.marca === "prueba-tempano"),
             hpAntes, hpAhora: hazards[0] ? hazards[0].hp : 0,
             puntos, puntosAhora: score, hp0: HAZARD_TIPOS.tempano.hp,
             bloquea: !!HAZARD_TIPOS.tempano.bloquea, r: HAZARD_TIPOS.tempano.r };
  `);
  comprobar(r.bloquea === true, "el témpano declara que bloquea", "hp " + r.hp0 + " · r " + r.r);
  comprobar(r.eAntes === 1 && r.eDespues === 0,
    "★ una bala ENEMIGA se apaga contra él", r.eAntes + " → " + r.eDespues);
  comprobar(!r.sigue, "y una tuya también se gasta ahí",
    r.sigue ? "seguía viva" : "consumida");
  comprobar(r.hpAhora < r.hpAntes, "pero la tuya sí le hace daño",
    r.hpAntes + " → " + r.hpAhora);
  comprobar(r.puntosAhora === r.puntos, "y golpearlo no da puntos", r.puntosAhora + "");
}

// ════════════════════════════════════════════════════════════
console.log("\n7 · TRÁFICO: CRUZA, NO DISPARA, NO PUNTÚA, NO ES ENEMIGO");
{
  const r = await dentro(`
    ${escenaLimpia}
    hazardTipo = "trafico"; spawnHazard();
    const h = hazards[0];
    const y0 = h.y, x0 = h.x, avisa = h.warnT > 0, lado = h.lado;
    // El tráfico entra con 0,7 s de aviso antes de moverse (igual que el
    // resto de hazards laterales): avanzar menos que eso mediría el
    // aviso, no el cruce.
    ${avanzar(1.6)}
    const h2 = hazards[0];
    const movX = h2 ? Math.abs(h2.x - x0) : 0, movY = h2 ? Math.abs(h2.y - y0) : 0;
    const enemigos = enemies.length, balasSuyas = eBullets.length;
    const puntos = score, matados = enemiesKilled;
    // Destruirlo: tres impactos.
    if (h2) { h2.hp = 1; bullets.push({ x: h2.x, y: h2.y, vx: 0, vy: -100, r: 4, dmg: 4,
              largo: 20, col: "#fff", cd: 0, ang: 0 }); }
    ${avanzar(0.12)}
    return { avisa, lado, movX, movY, enemigos, balasSuyas, puntos,
             puntosTras: score, matados, matadosTras: enemiesKilled,
             vivos: hazards.length, altoDelCarril: y0 / H };
  `);
  comprobar(r.avisa && (r.lado === 1 || r.lado === 2),
    "avisa por el lado por el que va a entrar", "lado " + r.lado);
  comprobar(r.movX > 40 && r.movY < 1,
    "★ cruza en horizontal y no baja", "Δx " + r.movX.toFixed(0) + " · Δy " + r.movY.toFixed(1));
  comprobar(r.altoDelCarril <= 0.55,
    "por la mitad de arriba, no por donde se esquiva", "y = " + (r.altoDelCarril * 100).toFixed(0) + "% del campo");
  comprobar(r.balasSuyas === 0, "no dispara");
  comprobar(r.enemigos === 0, "y no cuenta como enemigo", r.enemigos + " enemigos");
  comprobar(r.puntosTras === r.puntos && r.matadosTras === r.matados,
    "★ destruirlo no da NI un punto", r.puntosTras + " puntos · " + r.matadosTras + " bajas");
  comprobar(r.vivos === 0, "y desaparece al destruirlo");
}

// ════════════════════════════════════════════════════════════
console.log("\n8 · MINA BIO: DUERME, AVISA Y REVIENTA DONDE ESTÁ");
{
  const lejos = await dentro(`
    ${escenaLimpia}
    hazardTipo = "mina_bio"; spawnHazard();
    const h = hazards[0];
    h.warnT = 0; h.x = 60; h.y = H * 0.3; h.vx = 0; h.vy = 0;
    player.x = W - 60; player.y = H * 0.8; targetX = player.x; targetY = player.y;
    ${avanzar(0.6)}
    return { armada: hazards[0] ? hazards[0].armada : -1, lives };
  `);
  comprobar(lejos.armada === 0, "de lejos ni se entera", "armada " + lejos.armada);

  const cerca = await dentro(`
    const h = hazards[0];
    // 40 px: dentro del radio de ARMADO (74 + hitbox) pero fuera del
    // radio de CONTACTO del cuerpo (radio*0.72 + hitbox, ~25 px). Más
    // cerca y la prueba mediría el choque, no el aviso.
    player.x = h.x + 40; player.y = h.y; targetX = player.x; targetY = player.y;
    ${avanzar(0.1)}
    const armadaAl = hazards[0] ? hazards[0].armada : -1;
    // Y ahora se va: el aviso tiene que servir para algo.
    player.x = W - 60; player.y = H * 0.85; targetX = player.x; targetY = player.y;
    const vidasAntes = lives;
    ${avanzar(1.2)}
    return { armadaAl, vidasAntes, lives, quedan: hazards.length, radio: HAZARD_TIPOS.mina_bio.radio };
  `);
  comprobar(cerca.armadaAl > 0, "★ te acercas y AVISA antes de nada", "aviso " + cerca.armadaAl.toFixed(2) + " s");
  comprobar(cerca.quedan === 0, "revienta al terminar el aviso");
  comprobar(cerca.lives === cerca.vidasAntes,
    "★ y si te apartas NO te toca: el aviso sirve", cerca.lives + " lives");

  const quieto = await dentro(`
    ${escenaLimpia}
    hazardTipo = "mina_bio"; spawnHazard();
    const h = hazards[0];
    h.warnT = 0; h.x = W / 2; h.y = H * 0.5; h.vx = 0; h.vy = 0;
    // Mismo margen que arriba: dentro del radio de explosión (74) y
    // fuera del de contacto directo, para medir la EXPLOSIÓN y no el
    // choque con el cuerpo.
    player.x = h.x + 40; player.y = h.y; targetX = player.x; targetY = player.y;
    const vidasAntes = lives;
    ${avanzar(1.4)}
    return { vidasAntes, lives, quedan: hazards.length };
  `);
  comprobar(quieto.lives < quieto.vidasAntes,
    "y si te quedas dentro, te alcanza", quieto.vidasAntes + " → " + quieto.lives);
}

// ════════════════════════════════════════════════════════════
console.log("\n9 · COLADA: TELEGRÁFICO, LUEGO DAÑO, Y SE VA SOLA");
{
  const r = await dentro(`
    ${escenaLimpia}
    const c = spawnColumna(W / 2, 100, 1.2, "colada");
    player.x = W / 2; player.y = H * 0.7; targetX = player.x; targetY = player.y;
    const vidasIni = lives;
    ${avanzar(0.6)}
    const enAviso = { fase: columnas[0] ? columnas[0].fase : -1, lives };
    ${avanzar(0.9)}
    const yaVa = { fase: columnas[0] ? columnas[0].fase : -1, lives };
    ${avanzar(0.6)}
    const dentro = { lives };
    ${avanzar(2.4)}
    return { vidasIni, enAviso, yaVa, dentro, quedan: columnas.length, estilo: c.estilo };
  `);
  comprobar(r.enAviso.fase === 0, "primero avisa", "fase " + r.enAviso.fase);
  comprobar(r.enAviso.lives === r.vidasIni,
    "★ y durante el aviso NO hace daño", r.enAviso.lives + " lives");
  comprobar(r.yaVa.fase >= 1, "después se enciende", "fase " + r.yaVa.fase);
  comprobar(r.dentro.lives < r.vidasIni,
    "★ y entonces sí quema a quien esté dentro", r.vidasIni + " → " + r.dentro.lives);
  comprobar(r.quedan === 0, "y al terminar se limpia sola", r.quedan + " columnas");

  const tope = await dentro(`
    ${escenaLimpia}
    for (let i = 0; i < 12; i++) spawnColumna(60 + i * 40, 80, 2, "colada");
    return { n: columnas.length, max: COLUMNAS_MAX };
  `);
  comprobar(tope.n <= tope.max, "y tiene tope duro", tope.n + " de " + tope.max);
}

// ════════════════════════════════════════════════════════════
console.log("\n10 · FRAGMENTO: BLOQUEA Y DEVUELVE UNA BALA HACIA ARRIBA");
{
  const r = await dentro(`
    ${escenaLimpia}
    hazardTipo = "fragmento"; spawnHazard();
    const h = hazards[0];
    h.warnT = 0; h.x = W / 2; h.y = H * 0.4; h.vx = 0; h.vy = 0;
    const eb = eBala(h.x, h.y - 2, 0, 220, 6);
    ${avanzar(0.1)}
    const tras = eBullets[0] ? { vy: eBullets[0].vy, rebotada: !!eBullets[0].rebotada } : null;
    // El rebote es por BALA, no por fragmento: cada disparo enemigo que
    // llega nuevo se desvía una vez, marcado con \`rebotada\`. Lo que no
    // puede pasar es que la MISMA bala, si por lo que sea vuelve a tocar
    // el fragmento, rebote una segunda vez — eso sí sería una bala que
    // cambia de rumbo sin aviso. Se la devuelve a mano junto al
    // fragmento y se comprueba que esta vez se apaga.
    if (eBullets[0]) { eBullets[0].x = h.x; eBullets[0].y = h.y - 2; eBullets[0].vy = 40; }
    const n2 = eBullets.length;
    ${avanzar(0.1)}
    return { tras, n2, n3: eBullets.length, quieto: h.vx === 0,
             rebota: !!HAZARD_TIPOS.fragmento.rebota, bloquea: !!HAZARD_TIPOS.fragmento.bloquea };
  `);
  comprobar(r.rebota && r.bloquea, "el fragmento declara que bloquea y rebota");
  comprobar(r.tras && r.tras.rebotada && r.tras.vy < 0,
    "★ la bala enemiga sale HACIA ARRIBA, no hacia ti",
    r.tras ? "vy " + r.tras.vy.toFixed(0) : "no quedó ninguna");
  comprobar(r.n3 < r.n2, "★ pero la MISMA bala no rebota dos veces: la segunda vez se apaga",
    r.n2 + " → " + r.n3);
}

// ════════════════════════════════════════════════════════════
console.log("\n11 · OSCURIDAD: APAGA EL ESCENARIO, NO LO QUE TE MATA");
{
  // Se leen PÍXELES. Es la única forma de comprobar esto: el orden de
  // dibujo puede parecer correcto y aun así un velo mal puesto tapar
  // media pantalla.
  const r = await dentro(`
    ${escenaLimpia}
    oscuro.k = 0; oscuro.obj = 0;
    const bx = W * 0.5, by = H * 0.35;
    const leer = (x, y) => {
      const d = ctx.getImageData(Math.round((PX + x) * DPR), Math.round(y * DPR), 1, 1).data;
      return 0.2126 * d[0] + 0.7152 * d[1] + 0.0722 * d[2];
    };
    eBullets.length = 0;
    eBala(bx, by, 0, 0, 7);
    ${frames(2)}
    const claro = { bala: leer(bx, by), fondo: leer(30, H * 0.62) };
    oscurecer(1, 0);            // se pide todo lo posible: el tope manda
    ${avanzar(1.2)}
    ${frames(2)}
    const oscuras = { bala: leer(bx, by), fondo: leer(30, H * 0.62) };
    const tope = oscuro.k;
    // Y un telegráfico, que es lo otro que no se puede apagar.
    telegrafo("mira", { x: W * 0.3, y: H * 0.3, ang: Math.PI / 2, life: 5 });
    ${frames(2)}
    const conTele = leer(W * 0.3, H * 0.3 + 30);
    oscurecer(0, 0);
    ${avanzar(1.2)}
    return { claro, oscuras, tope, max: OSCURIDAD_MAX, conTele, kFinal: oscuro.k };
  `);
  console.log(`        bala ${r.claro.bala.toFixed(0)} → ${r.oscuras.bala.toFixed(0)} · ` +
    `fondo ${r.claro.fondo.toFixed(0)} → ${r.oscuras.fondo.toFixed(0)} · velo ${r.tope.toFixed(2)}`);
  comprobar(r.tope <= r.max + 0.001,
    "★ pedir oscuridad total no da oscuridad total: hay tope", r.tope.toFixed(2) + " ≤ " + r.max);
  comprobar(r.oscuras.fondo < r.claro.fondo * 0.75,
    "el escenario SÍ se apaga", r.claro.fondo.toFixed(0) + " → " + r.oscuras.fondo.toFixed(0));
  comprobar(r.oscuras.bala >= r.claro.bala * 0.97,
    "★ y la bala enemiga NO pierde ni un punto de brillo",
    r.claro.bala.toFixed(0) + " → " + r.oscuras.bala.toFixed(0));
  comprobar(r.conTele > 0, "el telegráfico se sigue viendo con el velo puesto",
    r.conTele.toFixed(0));
  comprobar(r.kFinal < 0.05, "y al apagarla vuelve la luz", r.kFinal.toFixed(3));
}

// ════════════════════════════════════════════════════════════
console.log("\n12 · RUPTURA: SE ABRE, DURA, SE CIERRA Y NO DEJA NADA");
{
  const r = await dentro(`
    ${escenaLimpia}
    const g = spawnRuptura(W / 2, H * 0.3, 100, 0.8);
    const alAbrir = { n: rupturas.length, fase: g.fase, abierta: !!rupturaAbierta() };
    ${avanzar(0.8)}
    const abierta = { fase: rupturas[0] ? rupturas[0].fase : -1, hay: !!rupturaAbierta() };
    const vidasAntes = lives;
    player.x = W / 2; player.y = H * 0.3; targetX = player.x; targetY = player.y;
    ${avanzar(0.4)}
    const tocando = { lives };
    ${avanzar(1.6)}
    return { alAbrir, abierta, vidasAntes, tocando, quedan: rupturas.length,
             hayAlFinal: !!rupturaAbierta(), max: RUPTURAS_MAX };
  `);
  comprobar(r.alAbrir.n === 1 && r.alAbrir.fase === 0, "se abre");
  comprobar(r.abierta.fase === 1 && r.abierta.hay, "queda ABIERTA y se puede preguntar dónde está");
  comprobar(r.tocando.lives === r.vidasAntes,
    "★ no hace daño: es un sitio, no un ataque", r.tocando.lives + " lives");
  comprobar(r.quedan === 0 && !r.hayAlFinal,
    "★ y al terminar no deja estado detrás", r.quedan + " rupturas");

  const limpieza = await dentro(`
    ${escenaLimpia}
    spawnRuptura(W / 2, H * 0.3, 100, 30);
    spawnColumna(W / 2, 90, 30, "colada");
    oscurecer(0.6, 30);
    for (let i = 0; i < 8; i++) spawnRuptura(rand(60, W - 60), H * 0.3, 80, 30);
    const antes = { rupt: rupturas.length, col: columnas.length, osc: oscuro.obj };
    spawnMiniboss("guardian", 1);
    miniboss.est = "combate"; miniboss.invul = false;
    matarMiniboss();
    ${frames(2)}
    return { antes, rupt: rupturas.length, col: columnas.length, osc: oscuro.obj, max: RUPTURAS_MAX };
  `);
  comprobar(limpieza.antes.rupt <= limpieza.max, "las grietas tienen tope duro",
    limpieza.antes.rupt + " de " + limpieza.max);
  comprobar(limpieza.rupt === 0 && limpieza.col === 0 && limpieza.osc === 0,
    "★ y morir un jefe limpia las tres primitivas, sin que él se acuerde de nada",
    "grietas " + limpieza.rupt + " · columnas " + limpieza.col + " · velo " + limpieza.osc);
}

// ════════════════════════════════════════════════════════════
console.log("\n13 · LO DE ANTES SIGUE EN SU SITIO");
{
  const r = await dentro(`
    return {
      save: "v" + SAVE.estado().version,
      guardado: typeof SAVE === "object" && typeof SAVE.get === "function",
      admin: typeof ADMIN === "object" && typeof ADMIN.entrar === "function",
      hangar: typeof HANGAR === "object" && typeof HANGAR.dibujar === "function",
      musica: MUSICA.debug().modo,
      vfxCal: VFX.calidad(),
      misiones: MISIONES.length, base: MISIONES_BASE,
      nombres: MISIONES.slice(0, 10).map(m => m.nombre).join("|"),
      temasM: MISIONES.slice(0, 10).map(m => m.temaId).join(","),
      hazardsBase: Object.keys(HAZARD_TIPOS).slice(0, 2).join(","),
      enemigos: Object.keys(ENEMIGOS).length, jefes: Object.keys(JEFES).length,
      sonidos: Object.keys(SONIDOS).length,
    };
  `);
  comprobar(r.guardado && r.admin && r.hangar,
    "save, ADMIN y hangar siguen ahí", "esquema " + r.save);
  comprobar(!!r.musica, "música intacta", r.musica);
  comprobar(!!r.vfxCal, "VFX intacto", r.vfxCal);
  // 20 desde el bloque 5H: los 10 de siempre + las 10 de la expansión
  // (M11-M20). `MISIONES_BASE` sigue siendo 10 — eso NO cambia nunca.
  comprobar(r.misiones === 20 && r.base === 10,
    "★ las diez misiones de siempre siguen siendo diez (con 10 más detrás)", r.misiones + " · base " + r.base);
  comprobar(r.nombres.startsWith("PRIMER CONTACTO|CINTURÓN DE ASTEROIDES") &&
            r.nombres.endsWith("FINAL STRIKE"),
    "con sus nombres de siempre");
  const BASE4 = ["espacio", "oceano", "volcan", "neon"];
  comprobar(r.temasM.split(",").every(id => BASE4.includes(id)),
    "★ y en sus mundos de siempre: ninguna se ha ido a un mundo nuevo", r.temasM);
  comprobar(r.hazardsBase === "asteroide,cristal", "los dos peligros de siempre, los primeros de la tabla");
  // ENEMIGOS pasó a 25 en el bloque 5E (14 base + 10 de expansión + el
  // fragmento interno de crisol) y JEFES a 20 en el 5G (10 + 5
  // minijefes de 5F + 5 jefes principales de 5G). Esos bloques tienen
  // su propia prueba para verificar que lo viejo no se ha tocado; aquí
  // solo interesa que el TOTAL —y los sonidos, ajenos a los tres— siga
  // siendo el que toca.
  comprobar(r.enemigos === 25 && r.jefes === 20 && r.sonidos === 71,
    "25 enemigos (14 + 10 de expansión + 1 interno), 20 jefes (10 + 5 de 5F + 5 de 5G) y 71 sonidos",
    r.enemigos + "·" + r.jefes + "·" + r.sonidos);
}

// ════════════════════════════════════════════════════════════
console.log("\n14 · UNA MISIÓN DE SIEMPRE SE JUEGA IGUAL");
{
  const r = await dentro(`
    OPCIONES.vfx = "alto"; aplicarVFX();
    modo = "campana"; iniciarMision(0);
    await new Promise(r => setTimeout(r, 300));
    state = "play"; paused = false;
    ${avanzar(30, 0.1)}
    return { enemigos: enemies.length, eventos: eventoIdx, tema: T.id,
             hazards: hazards.length, columnas: columnas.length,
             rupturas: rupturas.length, velo: oscuro.k, lives, estado: state };
  `);
  console.log(`        M1 a los 30 s: ${r.enemigos} enemigos · ${r.eventos} eventos · mundo ${r.tema}`);
  comprobar(r.eventos > 0 && r.tema === "espacio", "la M1 corre su guión en su mundo", r.eventos + " eventos");
  comprobar(r.columnas === 0 && r.rupturas === 0 && r.velo === 0,
    "★ y NADA de lo nuevo aparece sin que un evento lo pida",
    "columnas " + r.columnas + " · grietas " + r.rupturas + " · velo " + r.velo);
}

// ════════════════════════════════════════════════════════════
console.log("\n15 · ESTRÉS: MUNDO NUEVO CON TODO ENCENDIDO");
{
  // Aquí SÍ manda el bucle del juego: se mide cuánto cuesta un
  // fotograma de verdad, con todo moviéndose solo.
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
               ebalas: 0 };
    }, [guion, ms]);
    console.log(`        ${nombre.padEnd(30)} ${r.medio.toFixed(1)}ms · p95 ${r.p95.toFixed(1)} · ` +
      `peor ${r.peor.toFixed(1)} · pico ${r.parts}/${r.max}p · desc ${r.desc} · ${r.calidad}`);
    return r;
  };

  await dentro(`
    ${escenaLimpia}
    OPCIONES.vfx = "alto"; aplicarVFX();
    T = TEMAS.find(t => t.id === "fragua");
    await new Promise(r => setTimeout(r, 500));
    VFX.limpiar();
  `);

  const base = await escena("30 enemigos disparando", `
    for (let i = 0; i < 30; i++) spawnEnemy("normal", 40 + (i % 10) * 74);
    for (let i = 0; i < 120; i++) eBala(Math.random()*W, Math.random()*H, 0, 110, 6);
    arma = 4;
  `, 1400);

  const conHazard = await escena("+ témpanos y tráfico", `
    hazardEnabled = true; hazardTipo = "tempano";
    for (let i = 0; i < 8; i++) spawnHazard();
    hazardTipo = "trafico";
    for (let i = 0; i < 8; i++) spawnHazard();
    hazards.forEach(h => h.warnT = 0);
  `, 1400);

  const conPrim = await escena("+ colada, grieta y oscuridad", `
    spawnColumna(W * 0.3, 110, 12, "colada");
    spawnColumna(W * 0.7, 110, 12, "colada");
    spawnRuptura(W * 0.5, H * 0.28, 120, 12);
    oscurecer(0.6, 12);
  `, 1600);

  const conJefe = await escena("+ jefe en combate", `
    spawnMiniboss("pyre_lord", 1);
    miniboss.est = "combate"; miniboss.invul = false;
  `, 1600);

  const fin = await dentro(`
    const m = VFX.metricas();
    return { parts: m.parts, max: m.maxParts, reserva: m.reserva, desc: m.rechazadas,
             ebalas: eBullets.length, tope: EBALAS_MAX, calidad: m.calidad,
             sacudidas: m.sacudidas, maxSac: m.maxSacudidas };
  `);
  comprobar(conJefe.parts <= conJefe.max,
    "★ con todo encendido no se pasa del presupuesto de partículas",
    conJefe.parts + "/" + conJefe.max);
  comprobar(fin.ebalas <= fin.tope, "ni del tope de balas enemigas",
    fin.ebalas + "/" + fin.tope);
  comprobar(fin.sacudidas <= fin.maxSac, "ni del de sacudidas",
    fin.sacudidas + "/" + fin.maxSac);
  comprobar(conPrim.medio < Math.max(base.medio, 1) * 3,
    "las tres primitivas juntas no disparan el fotograma",
    conPrim.medio.toFixed(1) + "ms vs " + base.medio.toFixed(1) + "ms");
  comprobar(conHazard.medio < Math.max(base.medio, 1) * 3,
    "y los peligros nuevos tampoco",
    conHazard.medio.toFixed(1) + "ms vs " + base.medio.toFixed(1) + "ms");

  // Auto-degradado: sigue vivo con todo esto encima.
  //
  // `aplicarVFX()` se llama cada fotograma DESDE loop(), no desde
  // update() — así que sigue corriendo aunque la prueba haya congelado
  // el paso lógico para todo lo demás. Llamar a VFX.ajustar() a mano
  // aquí no serviría de nada: el propio loop() lo pisaría en el
  // siguiente fotograma real. Lo que hay que mover es lo que
  // aplicarVFX() LEE — `calidadAuto`, el nivel que decide el medidor de
  // FPS — y esperar un fotograma de verdad a que se aplique.
  const auto = await dentro(`
    OPCIONES.calidad = "auto"; OPCIONES.vfx = "auto";
    calidadAuto = "baja";
    await new Promise(r => requestAnimationFrame(r));
    const bajo = VFX.calidad();
    calidadAuto = "alta";
    await new Promise(r => requestAnimationFrame(r));
    const alto = VFX.calidad();
    OPCIONES.vfx = "bajo";
    await new Promise(r => requestAnimationFrame(r));
    const manda = VFX.calidad();
    OPCIONES.vfx = "alto"; calidadAuto = "alta";
    return { bajo, alto, manda };
  `);
  comprobar(auto.bajo === "bajo" && auto.alto === "alto",
    "el auto-degradado sigue subiendo y bajando", auto.bajo + " → " + auto.alto);
  comprobar(auto.manda === "bajo", "y lo que pide el jugador sigue mandando", auto.manda);
}

// ════════════════════════════════════════════════════════════
console.log("\n16 · SIN ERRORES NI PETICIONES ROTAS");
{
  comprobar(!errs.length, "0 errores JS", errs.slice(0, 3).join(" | ") || "ninguno");
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
