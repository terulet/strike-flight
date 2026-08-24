// ════════════════════════════════════════════════════════════
//  vfx.mjs — que los efectos no rompan el juego ni el iPad
// ════════════════════════════════════════════════════════════
//
//    node herramientas/pruebas/vfx.mjs
//
//  Tres cosas, y las tres son las que se rompen de verdad:
//
//    1. LEGIBILIDAD. Las balas se pintan las últimas. Si un efecto se
//       cuela por encima, la bala que te mata deja de verse.
//    2. PRESUPUESTO. La reserva no puede crecer sin freno, y ninguna
//       familia puede comerse el sitio de las demás.
//    3. GAMEPLAY INTACTO. La sacudida es de CÁMARA. Si mueve una sola
//       coordenada del mundo, está mal.
//
//  Los FPS de aquí NO valen: Chromium sin ventana compone por software
//  y da ~20 fps pase lo que pase. Lo que sí vale son los conteos, las
//  reservas y el tiempo de fotograma RELATIVO entre dos escenas.

import { servidor, cargarPlaywright } from "../qa.mjs";

const srv = await servidor();
const { chromium } = await cargarPlaywright();
const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true });
const p = await ctx.newPage();

const errs = [];
p.on("pageerror", e => errs.push("EXCEPCION " + e.message));
p.on("console", m => { if (m.type() === "error") errs.push("CONSOLE " + m.text()); });
p.on("requestfailed", r => {
  // Un aborto de medios no es un fallo: cambiar de pista mientras la
  // anterior carga aborta esa descarga, y eso es lo correcto.
  const motivo = (r.failure() && r.failure().errorText) || "?";
  const url = r.url().replace(srv.url, "");
  if (motivo.includes("ERR_ABORTED") && /[.](mp3|ogg|wav)$/i.test(url)) return;
  errs.push("PETICION " + motivo + " " + url);
});

await p.goto(srv.url + "?debug", { waitUntil: "load" });
// Un toque: sin gesto no arranca el audio y la comprobación final de
// "el resto sigue intacto" daría un falso rojo.
await p.mouse.click(410, 1100);
await p.waitForTimeout(1500);

const fallos = [];
const comprobar = (ok, t, extra) => {
  console.log((ok ? "  ok    " : "  FALLO ") + t + (extra ? "   " + extra : ""));
  if (!ok) fallos.push(t);
};
const met = () => p.evaluate(() => VFX.metricas());

// ════════════════════════════════════════════════════════════
console.log("\n1 · PRESUPUESTO DECLARADO");
{
  const pres = await p.evaluate(() => VFX.PRESUPUESTO);
  for (const q of ["alto", "medio", "bajo"]) {
    const b = pres[q];
    const suma = Object.values(b.fam).reduce((a, x) => a + x, 0);
    console.log(`        ${q.padEnd(6)} total ${String(b.total).padStart(3)}  ` +
      `frame ${String(b.porFrame).padStart(2)}  familias ${suma}  ` +
      `sprites ${b.sprites} ondas ${b.ondas} sacudidas ${b.sacudidas}`);
    // La suma de las familias PUEDE pasar del total: son topes, no
    // reservas. Lo que no puede es que una sola familia se lo coma.
    comprobar(Math.max(...Object.values(b.fam)) <= b.total,
      `${q}: ninguna familia sola supera el total`);
  }
  comprobar(pres.alto.total > pres.medio.total && pres.medio.total > pres.bajo.total,
    "alto > medio > bajo", `${pres.alto.total} > ${pres.medio.total} > ${pres.bajo.total}`);
  comprobar(pres.bajo.fam.debris === 0 && pres.bajo.fam.estela === 0,
    "BAJO deja solo lo que informa: sin restos ni estelas");
}

// ════════════════════════════════════════════════════════════
console.log("\n2 · LA RESERVA NO CRECE SIN LÍMITE");
{
  await p.evaluate(() => { modo = "campana"; iniciarMision(0); VFX.limpiar(); });
  await p.waitForTimeout(200);
  // Se pide MUCHÍSIMO más de lo que cabe, muchas veces.
  const r = await p.evaluate(async () => {
    let pedidas = 0;
    for (let ronda = 0; ronda < 40; ronda++) {
      for (let i = 0; i < 300; i++) { VFX.chispas(400, 500, 1, "#fff", 1); pedidas++; }
      VFX.actualizar(0.016);
      await new Promise(r => requestAnimationFrame(r));
    }
    return { pedidas, m: VFX.metricas() };
  });
  comprobar(r.m.parts <= r.m.maxParts, "nunca pasa del tope total",
    r.m.parts + "/" + r.m.maxParts);
  comprobar(r.m.rechazadas > 0, "y descarta lo que no cabe en vez de crecer",
    r.m.rechazadas + " descartadas de " + r.pedidas);
  comprobar(r.m.reserva + r.m.parts <= r.m.maxParts + 40,
    "la reserva no se infla", "reserva=" + r.m.reserva + " vivas=" + r.m.parts);
}

// ════════════════════════════════════════════════════════════
console.log("\n3 · TOPE POR FOTOGRAMA");
{
  const r = await p.evaluate(() => {
    VFX.limpiar();
    VFX.frame(16);                       // arranca un fotograma limpio
    let creadas = 0;
    for (let i = 0; i < 500; i++) if (VFX.chispas(400, 500, 1, "#fff", 1)) creadas++;
    return { creadas, tope: VFX.limites().porFrame };
  });
  comprobar(r.creadas <= r.tope, "no se crean más de las permitidas por fotograma",
    r.creadas + " ≤ " + r.tope);
}

// ════════════════════════════════════════════════════════════
console.log("\n4 · LAS PARTÍCULAS MUEREN Y VUELVEN A LA RESERVA");
{
  const r = await p.evaluate(async () => {
    VFX.limpiar();
    VFX.frame(16);
    VFX.chispas(400, 500, 60, "#fff", 1);
    const vivas = VFX.metricas().parts;
    // Se les pasa mucho más tiempo del que viven.
    for (let i = 0; i < 60; i++) VFX.actualizar(0.05);
    const m = VFX.metricas();
    return { vivas, despues: m.parts, reserva: m.reserva };
  });
  comprobar(r.vivas > 0, "se crearon", r.vivas + " partículas");
  comprobar(r.despues === 0, "y todas han muerto", r.despues + " vivas");
  comprobar(r.reserva >= r.vivas, "y han vuelto a la reserva, no al recolector",
    "reserva=" + r.reserva);
}

// ════════════════════════════════════════════════════════════
console.log("\n5 · TOPES POR FAMILIA");
{
  const r = await p.evaluate(() => {
    VFX.limpiar();
    // Se satura de chispas y luego se pide motor: el motor TIENE que
    // seguir teniendo sitio, o la nave se queda sin llama justo cuando
    // más está pasando en pantalla.
    for (let f = 0; f < 20; f++) { VFX.frame(16); VFX.chispas(400, 500, 200, "#fff", 1); }
    VFX.frame(16);
    const motor = VFX.motor(400, 900, 0, 100, "#fff", 2, 0.3);
    const m = VFX.metricas();
    return { chispa: m.fam.chispa, limChispa: m.limFam.chispa, motorOk: !!motor };
  });
  comprobar(r.chispa <= r.limChispa, "las chispas respetan su tope",
    r.chispa + "/" + r.limChispa);
  comprobar(r.motorOk, "y el motor de la nave sigue teniendo sitio");
}

// ════════════════════════════════════════════════════════════
console.log("\n6 · LA SACUDIDA NO TOCA EL GAMEPLAY");
{
  const r = await p.evaluate(async () => {
    modo = "campana"; iniciarMision(0);
    await new Promise(r => setTimeout(r, 300));
    // Se congela el mundo: sin update no se mueve nada por su cuenta.
    paused = true;
    await new Promise(r => setTimeout(r, 100));
    const antes = {
      px: player.x, py: player.y,
      bals: bullets.map(b => [b.x, b.y]),
      enes: enemies.map(e => [e.x, e.y]),
    };
    // La sacudida más bestia del juego, varias veces.
    for (let i = 0; i < 5; i++) VFX.sacudir(26, 0.7, 5);
    // Y se dejan pasar fotogramas REALES, con render incluido.
    for (let i = 0; i < 30; i++) await new Promise(r => requestAnimationFrame(r));
    const despues = {
      px: player.x, py: player.y,
      bals: bullets.map(b => [b.x, b.y]),
      enes: enemies.map(e => [e.x, e.y]),
    };
    paused = false;
    const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    return {
      jugador: antes.px === despues.px && antes.py === despues.py,
      balas: igual(antes.bals, despues.bals),
      enemigos: igual(antes.enes, despues.enes),
      nBalas: antes.bals.length, nEnes: antes.enes.length,
      sacudidas: VFX.metricas().sacudidas,
    };
  });
  comprobar(r.jugador, "la nave no se ha movido ni un píxel");
  comprobar(r.balas, "ni las balas", r.nBalas + " balas");
  comprobar(r.enemigos, "ni los enemigos", r.nEnes + " enemigos");
  comprobar(r.sacudidas <= 3, "y no se acumulan sacudidas sin freno",
    r.sacudidas + " activas");
}

// ════════════════════════════════════════════════════════════
console.log("\n7 · LA CALIDAD BAJA REDUCE LA CARGA");
{
  const carga = async (nivel) => p.evaluate(async (n) => {
    OPCIONES.vfx = n; aplicarVFX();
    VFX.limpiar();
    let total = 0;
    for (let f = 0; f < 30; f++) {
      VFX.frame(16);
      VFX.chispas(400, 400, 40, "#fff", 1);
      VFX.debris(400, 400, 20, "#fff", 1);
      VFX.humo(400, 400, 20, "#fff", 1);
      VFX.actualizar(0.016);
      total = Math.max(total, VFX.metricas().parts);
      await new Promise(r => requestAnimationFrame(r));
    }
    return { pico: total, lim: VFX.limites().total, calidad: VFX.calidad() };
  }, nivel);

  const alto = await carga("alto");
  const medio = await carga("medio");
  const bajo = await carga("bajo");
  console.log(`        alto ${alto.pico}/${alto.lim} · medio ${medio.pico}/${medio.lim} · bajo ${bajo.pico}/${bajo.lim}`);
  comprobar(medio.pico < alto.pico, "MEDIO carga menos que ALTO", `${medio.pico} < ${alto.pico}`);
  comprobar(bajo.pico < medio.pico, "BAJO carga menos que MEDIO", `${bajo.pico} < ${medio.pico}`);
  comprobar(bajo.calidad === "bajo", "y la calidad aplicada es la pedida");
}

// ════════════════════════════════════════════════════════════
console.log("\n8 · LA CALIDAD PERSISTE");
{
  await p.evaluate(() => { OPCIONES.vfx = "medio"; guardarOpciones(); SAVE.ya(); });
  await p.waitForTimeout(200);
  await p.reload({ waitUntil: "load" });
  await p.mouse.click(410, 1100);        // gesto: tras recargar, el audio vuelve a necesitarlo
  await p.waitForTimeout(1500);
  const r = await p.evaluate(() => ({ op: OPCIONES.vfx, aplicada: VFX.calidad() }));
  comprobar(r.op === "medio", "sobrevive a recargar", "vfx=" + r.op);
  comprobar(r.aplicada === "medio", "y está aplicada de verdad", r.aplicada);
  await p.evaluate(() => { OPCIONES.vfx = "auto"; guardarOpciones(); aplicarVFX(); });
}

// ════════════════════════════════════════════════════════════
console.log("\n9 · LEGIBILIDAD: LAS BALAS SE PINTAN LAS ÚLTIMAS");
{
  // Se comprueba sobre el CÓDIGO de render, que es donde vive el orden.
  // Mirar píxeles daría falsos verdes según dónde caigan las balas.
  const orden = await p.evaluate(() => {
    const src = render.toString();
    return {
      fondo:   src.indexOf("VFX.FONDO"),
      efectos: src.indexOf("dibujarEfectos()"),
      medio:   src.indexOf("VFX.MEDIO"),
      eBalas:  src.indexOf("for (const b of eBullets)"),
      frente:  src.indexOf("VFX.FRENTE"),
    };
  });
  comprobar(orden.fondo < orden.efectos, "la capa FONDO va antes que las explosiones");
  comprobar(orden.efectos < orden.eBalas,
    "las explosiones se pintan ANTES que las balas enemigas");
  comprobar(orden.medio < orden.eBalas,
    "las chispas y los restos también");
  comprobar(orden.frente > orden.eBalas,
    "y solo la capa FRENTE, con el alfa atado, va por encima");
}

// ════════════════════════════════════════════════════════════
console.log("\n10 · ESTRÉS: PANTALLA LLENA + JEFE");
{
  const escena = async (nombre, guion) => {
    const r = await p.evaluate(async (g) => {
      VFX.limpiar();
      // eslint-disable-next-line no-new-func
      new Function(g)();
      const ms = [];
      for (let i = 0; i < 90; i++) {
        await new Promise(r => requestAnimationFrame(r));
        ms.push(VFX.metricas().ms);
      }
      ms.sort((a, b) => a - b);
      const m = VFX.metricas();
      return {
        medio: ms.reduce((a, b) => a + b, 0) / ms.length,
        p95: ms[Math.floor(ms.length * 0.95)],
        peor: ms[ms.length - 1],
        parts: m.pico, maxParts: m.maxParts, descartadas: m.rechazadas,
      };
    }, guion);
    console.log(`        ${nombre.padEnd(22)} ${r.medio.toFixed(1)}ms medio · ` +
      `p95 ${r.p95.toFixed(1)}ms · peor ${r.peor.toFixed(1)}ms · ` +
      `pico ${r.parts}/${r.maxParts} part`);
    return r;
  };

  await p.evaluate(() => { modo = "campana"; iniciarMision(0); OPCIONES.vfx = "alto"; aplicarVFX(); });
  await p.waitForTimeout(500);

  const vacio = await escena("en reposo", "");
  const lleno = await escena("30 enemigos + disparos", `
    for (let i = 0; i < 30; i++) spawnEnemy("normal", 40 + (i % 10) * 74);
    for (let i = 0; i < 60; i++) eBala(Math.random()*W, Math.random()*H, 0, 120, 6);
  `);
  const explos = await escena("+ 12 explosiones", `
    for (let i = 0; i < 12; i++) muerte(Math.random()*W, Math.random()*H, "#ffcf5c", "pesada");
  `);
  const jefe = await escena("+ jefe", `
    spawnMiniboss("guardian", 1);
    for (let i = 0; i < 8; i++) muerte(Math.random()*W, Math.random()*H, "#ffcf5c", "media");
  `);

  comprobar(explos.parts <= explos.maxParts, "12 explosiones no pasan del presupuesto",
    explos.parts + "/" + explos.maxParts);
  comprobar(jefe.parts <= jefe.maxParts, "con el jefe encima tampoco",
    jefe.parts + "/" + jefe.maxParts);
  // Lo que se mide aquí no es un número absoluto —headless no vale para
  // eso— sino que la escena peor no cueste un múltiplo desbocado de la
  // más floja. Un x8 sería un sistema sin freno.
  comprobar(jefe.medio < Math.max(vacio.medio, 1) * 8,
    "la escena peor no dispara el tiempo de fotograma",
    `${jefe.medio.toFixed(1)}ms vs ${vacio.medio.toFixed(1)}ms en reposo`);
  await p.evaluate(() => { miniboss = null; enemies.length = 0; eBullets.length = 0; });
}

// ════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════
console.log("\n11 · FEEDBACK DEL JUGADOR: NO SE PIERDE NUNCA");
{
  // El caso que el brief prohíbe: calidad BAJA, presupuesto reventado
  // por decoración, y aun así el daño del jugador TIENE que salir.
  // (a) En calidad BAJA sigue saliendo.
  const bajo = await p.evaluate(() => {
    OPCIONES.vfx = "bajo"; aplicarVFX();
    VFX.limpiar();
    for (let f = 0; f < 20; f++) { VFX.frame(16); VFX.humo(400, 400, 200, "#888", 1); }
    const salieron = VFX.jugador(400, 900, 30, "#fff", 1.4, -Math.PI / 2, Math.PI);
    const m = VFX.metricas();
    return { salieron, jug: m.fam.jugador, limJug: m.limFam.jugador };
  });
  comprobar(bajo.salieron > 0, "el daño del jugador SALE en calidad BAJA",
    bajo.salieron + " partículas");
  comprobar(bajo.jug <= bajo.limJug, "sin pasarse de su familia",
    bajo.jug + "/" + bajo.limJug);

  // (b) Con el presupuesto REALMENTE lleno, desaloja decoración.
  //     En BAJO no se puede llenar solo con humo (su tope es 40 de 110),
  //     así que se llena en ALTO usando las cuatro familias decorativas.
  const lleno = await p.evaluate(() => {
    OPCIONES.vfx = "alto"; aplicarVFX();
    VFX.limpiar();
    for (let f = 0; f < 60; f++) {
      VFX.frame(16);
      VFX.humo(400, 400, 200, "#888", 1);
      VFX.debris(400, 400, 200, "#888", 1);
      VFX.chispas(400, 400, 200, "#888", 1);
      for (let i = 0; i < 200; i++) VFX.estela(400, 400, 0, 0, "#888", 2, 0.9);
    }
    const antes = VFX.metricas();
    const salieron = VFX.jugador(400, 900, 30, "#fff", 1.4, -Math.PI / 2, Math.PI);
    const m = VFX.metricas();
    return {
      antes: antes.parts, tope: antes.maxParts, salieron,
      desalojadas: m.desalojadas, total: m.parts,
      jug: m.fam.jugador, limJug: m.limFam.jugador,
    };
  });
  comprobar(lleno.antes >= lleno.tope - 2, "el presupuesto estaba lleno de decoración",
    lleno.antes + "/" + lleno.tope);
  comprobar(lleno.salieron > 0, "y aun así el jugador saca sus partículas",
    lleno.salieron + " partículas");
  comprobar(lleno.desalojadas > 0, "desalojando decoración, no creciendo",
    lleno.desalojadas + " desalojadas");
  comprobar(lleno.total <= lleno.tope, "y el total sigue respetándose",
    lleno.total + "/" + lleno.tope);
  comprobar(lleno.jug <= lleno.limJug, "sin pasarse de su propia familia",
    lleno.jug + "/" + lleno.limJug);
  await p.evaluate(() => { OPCIONES.vfx = "auto"; aplicarVFX(); });
}

// ════════════════════════════════════════════════════════════
console.log("\n12 · PRUEBA CRÍTICA: MUERTE DEL JUGADOR ENTRE BALAS");
{
  // Se mata al jugador en medio de un muro de balas enemigas y se
  // comprueba, sobre los píxeles, que las balas siguen ahí.
  const r = await p.evaluate(async () => {
    OPCIONES.vfx = "alto"; aplicarVFX();
    // La sacudida mueve la CÁMARA hasta 17 px, así que desplaza también
    // las balas en pantalla y falsearía la lectura de píxeles. Aquí se
    // mide si un efecto TAPA una bala, que es otra cosa; que la sacudida
    // no toca el gameplay ya lo comprueba la prueba 6.
    OPCIONES.sacudida = 0; aplicarVFX();
    // El overlay de ?debug ocupa la esquina superior izquierda y tapa
    // parte de la rejilla de muestreo. Se apaga: aquí se mide el juego,
    // no la chuleta de depuración.
    showDebug = false;
    modo = "campana"; iniciarMision(0);
    await new Promise(r => setTimeout(r, 400));
    misionIniT = 0;
    enemies.length = 0; eBullets.length = 0; lives = 3; invulnT = 0;
    player.x = W / 2; player.y = H * 0.6;

    // Muro de balas cruzando justo por donde va a morir.
    const puntos = [];
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 5; j++) {
        const bx = 70 + i * (W - 140) / 7, by = H * 0.45 + j * 44;
        eBala(bx, by, 0, 6, 7);
        puntos.push([Math.round(bx), Math.round(by)]);
      }
    }
    const nBalas = eBullets.length;

    // Se leen los píxeles en el pico del efecto.
    const lee = () => {
      const g = c.getContext("2d");
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let vistas = 0;
      for (const [bx, by] of puntos) {
        // El rosa de las balas enemigas: rojo alto, verde bajo. Se mira
        // un cuadradito por si la sacudida ha movido la cámara.
        let hay = false;
        for (let ox = -9; ox <= 9 && !hay; ox++) {
          for (let oy = -9; oy <= 9 && !hay; oy++) {
            const px = Math.round((bx + ox) * DPR) + Math.round(PX * DPR);
            const py = Math.round((by + oy) * DPR);
            if (px < 0 || py < 0 || px >= c.width || py >= c.height) continue;
            const k = (py * c.width + px) * 4;
            if (d[k] > 150 && d[k + 1] < 120 && d[k + 2] > 60 && d[k + 2] < 200) hay = true;
          }
        }
        if (hay) vistas++;
      }
      return vistas;
    };
    // Línea base: cuántas de esas balas se detectan SIN ningún efecto.
    await new Promise(r => requestAnimationFrame(r));
    await new Promise(r => requestAnimationFrame(r));
    const base = lee();

    // Y ahora el golpe, con todo su aparato encima.
    golpe(player.x, player.y - 40);
    await new Promise(r => requestAnimationFrame(r));
    await new Promise(r => requestAnimationFrame(r));

    const trasDano = lee();
    const partsDano = VFX.metricas().fam.jugador;

    OPCIONES.sacudida = 1; aplicarVFX(); showDebug = true;
    return { nBalas, puntos: puntos.length, trasDano, partsDano, base };
  });
  console.log(`        ${r.nBalas} balas · línea base ${r.base}/${r.puntos} · ` +
    `tras el impacto ${r.trasDano}/${r.puntos}`);
  comprobar(r.partsDano > 0, "el impacto del jugador ha soltado sus partículas",
    r.partsDano + " de familia jugador");
  // El criterio del bloque: si un efecto TAPA una bala, está mal. Se
  // compara contra la línea base y no contra el total: si una bala no se
  // detectaba ya antes del impacto, el problema es del muestreo, no del
  // efecto.
  comprobar(r.trasDano >= r.base,
    "el efecto no esconde ni una bala que se viera antes",
    r.trasDano + " ≥ " + r.base);
}

// ════════════════════════════════════════════════════════════
console.log("\n13 · LA EXPLOSIÓN NO TAPA LA NAVE");
{
  const orden = await p.evaluate(() => {
    const src = render.toString();
    return {
      efectos: src.indexOf("dibujarEfectos()"),
      premios: src.indexOf("for (const p of premios)"),
      nave: src.indexOf("dibujarJugador()"),
      eBalas: src.indexOf("for (const b of eBullets)"),
    };
  });
  comprobar(orden.efectos < orden.premios, "las explosiones van debajo de los premios");
  comprobar(orden.efectos < orden.nave, "y debajo de la nave del jugador");
  comprobar(orden.nave < orden.eBalas, "y la nave, debajo de las balas");
}

// ════════════════════════════════════════════════════════════
console.log("\n14 · INVULNERABILIDAD SIN PARPADEO DURO");
{
  // Antes la nave se dibujaba o no según un módulo del reloj: durante
  // segundo y medio no estaba la mitad del tiempo. Ahora se dibuja
  // siempre; lo que late es el anillo.
  const r = await p.evaluate(() => {
    const src = dibujarJugador.toString() + render.toString();
    return {
      condicional: /invulnT > 0 && Math\.floor\(invulnT \* \d+\) % 2/.test(src),
      dibujaSiempre: src.indexOf("dibujarNave(player.x, player.y, r, bank)") >= 0,
      anillo: src.indexOf("invulnT > 0") >= 0,
    };
  });
  comprobar(!r.condicional, "ya no se salta el dibujo de la nave por parpadeo");
  comprobar(r.dibujaSiempre, "la nave se pinta siempre");
  comprobar(r.anillo, "y la invulnerabilidad se dice con el anillo");
}

console.log("\n15 · EL RESTO SIGUE INTACTO");
{
  const r = await p.evaluate(() => ({
    save: SAVE.estado().ok,
    saveV: SAVE.estado().version,
    musica: MUSICA.debug().modo,
    audio: audio ? audio.state : "sin crear",
    banco: muestrasDbg.listas,
  }));
  comprobar(r.save && r.saveV === 2, "el guardado sigue vivo", "v" + r.saveV);
  comprobar(r.musica === "webaudio" || r.musica === "espera", "la música sigue viva", r.musica);
  comprobar(r.banco > 0, "el banco de efectos sigue cargado", r.banco + " muestras");
  comprobar(errs.length === 0, "sin errores JS ni 404", errs.slice(0, 3).join(" | "));
}

await nav.close();
srv.cerrar();
console.log("\n" + (fallos.length
  ? "FALLOS: " + fallos.length + "\n - " + fallos.join("\n - ")
  : "Todo correcto."));
process.exit(fallos.length ? 1 : 0);
