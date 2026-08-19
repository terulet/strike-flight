// ════════════════════════════════════════════════════════════
//  enemigos.js — la tabla de enemigos de FLIGHT STRIKE
// ════════════════════════════════════════════════════════════
//
//  <script src> clásico, y SOLO DATOS. Sale de index.html en el bloque
//  5A sin tocar una coma: mover una tabla y cambiarla a la vez es la
//  forma más rápida de no saber cuál de las dos cosas rompió el juego.
//
//  ── Por qué se puede cargar antes que el juego ──
//
//  Las funciones de cada enemigo —`mover`, `atacar`, `init`— llaman a
//  cosas que viven en index.html (`W`, `H`, `PATRONES`, `sfx`, `rand`).
//  No pasa nada: se llaman EN PARTIDA, cuando index.html hace rato que
//  se evaluó. Lo único que no puede referenciarse aquí es algo que haga
//  falta AL CONSTRUIR la tabla — y eso es `caer`, que se usa como
//  `mover: caer`. Por eso viene con ella.

// ════════════════════════════════════════════════════════════
//  ENEMIGOS — dirigidos por datos
//  Cada tipo declara sus números, su forma y su comportamiento.
//  Añadir uno nuevo es añadir una entrada AQUÍ: no hay que tocar
//  ni update() ni dibujarEnemigo().
//
//    mover(e, dt)   obligatorio
//    atacar(e)      opcional; si existe, se usa recarga()
//    embiste        true = sobrevive al chocar contra el jugador
//    grande         true = explosión y sonido de peso pesado
//    premio         multiplicador de probabilidad de soltar premio
// ════════════════════════════════════════════════════════════
const caer = (e, dt) => { e.y += e.vy * dt; };

const ENEMIGOS = {
  // Silueta redonda, movimiento recto, un disparo de vez en cuando.
  // Es el enemigo contra el que se aprende todo lo demás.
  normal: {
    r: 18, hp: 2, puntos: 10, vel: 1, forma: "circulo",
    color: t => t.enemigoA, muerte: "basica",
    mover: caer,
    recarga: () => rand(2.4, 4.2),
    atacar(e) {
      if (e.y < 40 || e.y > H * 0.72) return;
      PATRONES.abanico(e.x, e.y + e.r * 0.6, Math.PI / 2, 210, 1, 0, 5);
      sfx("ene_disparo");
    },
  },

  // No dispara. Su amenaza es la trayectoria: entra rápido, zigzaguea y
  // se te echa encima antes de que la mires.
  veloz: {
    r: 13, hp: 1, puntos: 25, vel: 1.85, forma: "rombo",
    color: t => t.enemigoB, muerte: "rapida", estela: true, rota: true,
    init(e) { e.zig = rand(80, 165) * (Math.random() < 0.5 ? -1 : 1); },
    mover(e, dt) {
      caer(e, dt);
      e.fase += dt * 3.2;
      e.x = clamp(e.x + Math.cos(e.fase) * e.zig * dt, e.r, W - e.r);
      e.giro = Math.cos(e.fase) * e.zig * 0.0022;
    },
  },

  // Se planta y apunta. Obliga a moverse en lateral, que es lo contrario
  // de lo que pide el veloz.
  torreta: {
    r: 20, hp: 4, puntos: 40, vel: 0.62, forma: "hexagono", premio: 2.2,
    color: t => t.enemigoA, muerte: "basica",
    mover(e, dt) {
      // Frena al llegar a su altura de tiro en vez de cruzar la pantalla.
      if (e.y > H * 0.3) e.y += e.vy * 0.25 * dt; else caer(e, dt);
    },
    recarga: () => rand(1.2, 1.9),
    atacar(e) {
      PATRONES.rafaga(e.x, e.y, haciaJugador(e), 265, 3, 0.16, 5);
      sfx("ene_disparo");
      e.recoil = 4;
    },
  },

  // Pesado de verdad: entra despacio, aguanta, y cuando dispara abre en
  // abanico para cerrar el hueco por el que ibas a salir.
  tanque: {
    r: 27, hp: 14, puntos: 120, vel: 0.46, forma: "acorazado",
    color: t => t.enemigoC, embiste: true, grande: true, premio: 6,
    muerte: "pesada", sonidoTiro: "ene_pesado",
    mover: caer,
    recarga: () => rand(1.4, 2.0),
    avisa: 0.5,
    telegrafo(e) {
      const a = haciaJugador(e);
      telegrafo("cono", { x: e.x, y: e.y, a1: a - 0.42, a2: a + 0.42, r: 620, life: 0.5, sigue: e });
    },
    atacar(e) {
      PATRONES.abanico(e.x, e.y, haciaJugador(e), 255, 5, 0.2, 6);
      sfx("ene_barrido");
      e.recoil = 9;
    },
  },

  // ── KAMIKAZE ──────────────────────────────────────────
  //  Cuatro fases y las cuatro se VEN: entra, se coloca, se enciende y
  //  se lanza. Nunca aparece encima del jugador y nunca gira durante la
  //  embestida — una vez lanzado, el vector está fijado y esquivarlo es
  //  cosa del jugador, no una tirada de dados.
  kamikaze: {
    r: 15, hp: 2, puntos: 45, vel: 1.15, forma: "punta",
    color: t => t.enemigoB, muerte: "kamikaze", premio: 1.4, rota: true,
    init(e) { e.est = 0; e.vx = 0; e.carga = 0; e.paraY = rand(H * 0.16, H * 0.3); },
    mover(e, dt) {
      if (e.est === 0) {
        caer(e, dt);
        e.vx = clamp(e.vx + Math.sign(player.x - e.x) * 260 * dt, -170, 170);
        e.x = clamp(e.x + e.vx * dt, e.r, W - e.r);
        if (e.y >= e.paraY) {
          e.est = 1; e.carga = 0;
          sfx("kamikaze");
          telegrafo("anillo", { x: e.x, y: e.y, r: 74, life: 0.85, sigue: e });
        }
      } else if (e.est === 1) {
        // Se coloca y se enciende. El sonido sube con la carga.
        e.carga += dt / 0.85;
        e.x += clamp(player.x - e.x, -110 * dt, 110 * dt);
        e.y += 14 * dt;
        VFX.estela(e.x + rand(-e.r, e.r), e.y + rand(-e.r, e.r),
          rand(-40, 40), rand(-70, -20), "#ff8a1f", rand(1, 2.6), 0.3);
        if (e.carga >= 1) {
          e.est = 2;
          const a = Math.atan2(player.y - e.y, player.x - e.x);
          e.dvx = Math.cos(a) * 620; e.dvy = Math.sin(a) * 620;
          telegrafo("mira", { x: e.x, y: e.y, ang: a, life: 0.22, col: "#ff8a1f" });
          sfx("ene_misil", { tono: 1.4 });
        }
      } else {
        e.x += e.dvx * dt; e.y += e.dvy * dt;
        e.giro = Math.atan2(e.dvx, Math.max(e.dvy, 1)) * 0.8;
        VFX.estela(e.x, e.y, rand(-30, 30), rand(-40, 40), "#ffcf5c", rand(1.4, 3.2), 0.34);
      }
    },
    dibujarExtra(e) {
      if (e.est !== 1) return;
      const p = 0.4 + 0.6 * Math.abs(Math.sin(performance.now() / 60));
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = e.carga * p * 0.85;
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, e.r * 3);
      g.addColorStop(0, "#ffffff"); g.addColorStop(0.4, "#ff6a1f");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, e.r * 3, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
    },
  },

  // ── BOMBARDERO ────────────────────────────────────────
  //  Lento, grave y con retroceso. Sus bombas caen despacio y explotan
  //  con radio: no basta con no estar debajo, hay que no estar cerca.
  bombardero: {
    r: 24, hp: 9, puntos: 90, vel: 0.5, forma: "acorazado",
    color: t => t.enemigoA, grande: true, premio: 4, muerte: "pesada",
    mover(e, dt) { e.y += e.vy * (e.y < 60 ? 0.55 : 1) * dt; },
    recarga: () => rand(2.0, 2.8),
    avisa: 0.55,
    telegrafo(e) {
      // La banda marca la altura EXACTA a la que van a estallar las
      // bombas. Con eso, estar fuera de ella es una decisión del jugador.
      e.bombaY = clamp(e.y + 170, 0, H - 40);
      telegrafo("banda", { y: e.bombaY, h: 58, life: 0.55, col: "#ff8a1f" });
    },
    atacar(e) {
      const yb = e.bombaY || clamp(e.y + 170, 0, H - 40);
      for (let i = -1; i <= 1; i++) {
        const ang = Math.PI / 2 + i * 0.3;
        eBala(e.x + i * 15, e.y + 12, Math.cos(ang) * 200, Math.sin(ang) * 200, 8,
          { bomba: 58, explotaY: yb });
      }
      sfx("ene_mortero", { tono: 0.8 });
      e.recoil = 11;
      sacudir("tiny");
    },
  },

  // ── FRANCOTIRADOR ─────────────────────────────────────
  //  Entra · se coloca · adquiere · telegrafía · fija · DISPARA ·
  //  reposiciona. Cada paso tiene su sonido y su dibujo, y el disparo
  //  sale por donde decía la línea, no por donde estás en ese momento:
  //  moverse durante el bloqueo funciona SIEMPRE.
  francotirador: {
    r: 15, hp: 3, puntos: 70, vel: 0.8, forma: "rombo",
    color: t => t.enemigoB, premio: 2, muerte: "basica",
    init(e) { e.est = 0; e.tt = 0; e.paraY = rand(H * 0.12, H * 0.26); e.tiros = 0; },
    mover(e, dt) {
      e.tt += dt;
      if (e.est === 0) {                                  // entrada
        caer(e, dt);
        if (e.y >= e.paraY) { e.est = 1; e.tt = 0; sfx("sniper_lock"); }
      } else if (e.est === 1) {                           // adquisición
        e.y += Math.sin(e.tt * 2) * 8 * dt;
        if (e.tt > 0.55) {
          e.est = 2; e.tt = 0;
          e.mira = telegrafo("mira", { x: e.x, y: e.y, ang: haciaJugador(e), life: 1.35, sigue: e });
        }
      } else if (e.est === 2) {                           // seguimiento
        if (e.mira) {
          const obj = Math.atan2(player.y - e.y, player.x - e.x);
          let d = ((obj - e.mira.ang + Math.PI * 3) % TAU) - Math.PI;
          e.mira.ang += clamp(d, -2.4 * dt, 2.4 * dt);
        }
        if (e.tt > 0.9) { e.est = 3; e.tt = 0; sfx("sniper_aviso"); }
      } else if (e.est === 3) {                           // BLOQUEO: ángulo fijo
        if (e.mira) { e.mira.bx = e.x + Math.cos(e.mira.ang) * 400; e.mira.by = e.y + Math.sin(e.mira.ang) * 400; }
        if (e.tt > 0.42) {
          const a = e.mira ? e.mira.ang : haciaJugador(e);
          eBala(e.x, e.y, Math.cos(a) * 760, Math.sin(a) * 760, 5, { lanza: true, halo: false });
          vfx("chispa", e.x + Math.cos(a) * 20, e.y + Math.sin(a) * 20, 54, 0.2);
          sfx("sniper_tiro");
          e.recoil = 8;
          if (e.mira) { telegrafos.splice(telegrafos.indexOf(e.mira), 1); e.mira = null; }
          e.est = 4; e.tt = 0; e.tiros++;
          e.destino = clamp(e.x + rand(-W * 0.4, W * 0.4), 40, W - 40);
        }
      } else {                                            // reposición
        e.x += clamp(e.destino - e.x, -230 * dt, 230 * dt);
        e.y += Math.sin(e.tt * 3) * 12 * dt;
        // Tras dos disparos se retira: un francotirador que no se va nunca
        // deja de ser un acontecimiento y pasa a ser un impuesto.
        if (e.tiros >= 3) { e.y += 190 * dt; return; }
        if (e.tt > 1.1 && Math.abs(e.destino - e.x) < 24) { e.est = 1; e.tt = 0; sfx("sniper_lock"); }
      }
    },
    dibujarExtra(e) {
      if (e.est !== 3) return;
      const p = Math.abs(Math.sin(performance.now() / 55));
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.5 + p * 0.5;
      ctx.fillStyle = TIRO_SUYO;
      ctx.beginPath(); ctx.arc(0, 0, e.r * 1.5, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
    },
  },

  // ── PORTAESCUDOS ──────────────────────────────────────
  //  El escudo se ve, se ondula cuando le pegas y se rompe con
  //  estruendo. Y NO es invulnerabilidad: los disparos pasan al casco
  //  reducidos, así que pegarle mientras aguanta sigue sirviendo.
  portaescudos: {
    r: 26, hp: 14, puntos: 130, vel: 0.42, forma: "hexagono",
    color: t => t.enemigoC, embiste: true, grande: true, premio: 5,
    muerte: "pesada", escMax: 16,
    init(e) { e.esc = 16; e.escFlash = 0; e.onda = 0; },
    mover: caer,
    alGolpe(e, b, dmg) {
      if (e.esc <= 0) return dmg;
      e.esc -= dmg;
      e.escFlash = 0.14; e.onda = 1;
      impacto(b.x, b.y, "escudo", "#5ce1ff");
      if (e.esc <= 0) {
        e.esc = 0;
        impacto(e.x, e.y, "rotura", "#5ce1ff");
        onda(e.x, e.y, "#5ce1ff", e.r * 5, 0.5);
        texto(e.x, e.y - e.r - 14, "ESCUDO ROTO", "#5ce1ff", 13);
        sacudir("tiny");
      } else sfx("escudo_zumb");
      return dmg * 0.35;      // pasa reducido, no anulado
    },
    recarga: () => rand(2.4, 3.2),
    avisa: 0.45,
    telegrafo(e) { telegrafo("anillo", { x: e.x, y: e.y, r: e.r * 3, life: 0.45, sigue: e }); },
    atacar(e) {
      PATRONES.circulo(e.x, e.y, 205, e.esc > 0 ? 8 : 12, e.fase, 5);
      sfx("escudo_zumb", { tono: 0.7 });
    },
    dibujarExtra(e) {
      if (e.esc <= 0) return;
      const k = e.esc / 16;
      const p = 0.5 + 0.5 * Math.sin(performance.now() / 260);
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = (0.2 + k * 0.28 + (e.escFlash > 0 ? 0.5 : 0)) * (0.7 + p * 0.3);
      const rr = e.r * (1.55 + (e.onda > 0 ? e.onda * 0.25 : 0));
      const g = ctx.createRadialGradient(0, 0, rr * 0.55, 0, 0, rr);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, "#5ce1ff");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, rr, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 0.4 + k * 0.45;
      ctx.strokeStyle = e.escFlash > 0 ? "#ffffff" : "#9beeff";
      ctx.lineWidth = 1.5 + k * 1.5;
      ctx.beginPath();
      // Hexágono, no círculo: se lee como tecnología y no se confunde
      // con el halo de un premio.
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU + e.fase * 0.3;
        ctx[i ? "lineTo" : "moveTo"](Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath(); ctx.stroke();
      ctx.globalAlpha = 1;
    },
  },

  // ── ÉLITE ─────────────────────────────────────────────
  //  Escolta pesada. Se queda arriba y teje espirales: no se esquiva
  //  reaccionando, se esquiva leyendo por dónde se abre el brazo.
  elite: {
    r: 30, hp: 26, puntos: 240, vel: 0.4, forma: "acorazado",
    color: t => t.enemigoC, embiste: true, grande: true, premio: 7,
    muerte: "pesada",
    init(e) { e.paraY = rand(H * 0.14, H * 0.24); e.lado = Math.random() < 0.5 ? -1 : 1; },
    mover(e, dt) {
      if (e.y < e.paraY) { caer(e, dt); return; }
      e.fase += dt * 0.7;
      e.x = clamp(e.x + Math.cos(e.fase) * 90 * e.lado * dt, e.r + 8, W - e.r - 8);
    },
    recarga: () => rand(1.6, 2.2),
    avisa: 0.4,
    telegrafo(e) { telegrafo("anillo", { x: e.x, y: e.y, r: e.r * 3.4, life: 0.4, sigue: e }); },
    atacar(e) {
      PATRONES.espiral(e.x, e.y, 215, 10, e.fase * 2.4, 5, 1);
      PATRONES.abanico(e.x, e.y, haciaJugador(e), 300, 3, 0.2, 5);
      sfx("ene_mortero");
      e.recoil = 6;
    },
  },

  // ── CRUCERO ───────────────────────────────────────────
  //  M6: el peso pesado de la flota. Se planta, no persigue, y dispara
  //  con las dos baterías laterales a la vez.
  crucero: {
    r: 32, hp: 30, puntos: 260, vel: 0.32, forma: "acorazado",
    color: t => t.enemigoC, embiste: true, grande: true, premio: 8,
    muerte: "pesada",
    init(e) { e.paraY = rand(H * 0.16, H * 0.3); },
    mover(e, dt) { if (e.y < e.paraY) caer(e, dt); else e.y += Math.sin(e.faseT || 0) * 0; },
    recarga: () => rand(1.5, 2.0),
    avisa: 0.42,
    telegrafo(e) {
      telegrafo("cono", { x: e.x - e.r * 0.8, y: e.y, a1: Math.PI / 2 - 0.3, a2: Math.PI / 2 + 0.3, r: 700, life: 0.42 });
      telegrafo("cono", { x: e.x + e.r * 0.8, y: e.y, a1: Math.PI / 2 - 0.3, a2: Math.PI / 2 + 0.3, r: 700, life: 0.42 });
    },
    atacar(e) {
      PATRONES.abanico(e.x - e.r * 0.8, e.y, Math.PI / 2, 230, 3, 0.18, 6);
      PATRONES.abanico(e.x + e.r * 0.8, e.y, Math.PI / 2, 230, 3, 0.18, 6);
      sfx("ene_barrido"); e.recoil = 7;
    },
  },

  // ── COMANDO ───────────────────────────────────────────
  //  M6: no es el que más pega — es el que hace que los demás peguen
  //  mejor. Mientras vive alguno, toda la flota recarga un 30% más
  //  rápido (comandosVivos, en el bucle de enemigos). Matarlo se nota
  //  al instante: el ritmo de fuego de la pantalla entera baja.
  comando: {
    r: 24, hp: 14, puntos: 180, vel: 0.5, forma: "hexagono", premio: 4,
    color: t => "#7dc4ff", muerte: "media", esComando: true,
    init(e) { e.paraY = rand(H * 0.12, H * 0.22); },
    mover(e, dt) { if (e.y < e.paraY) caer(e, dt); else e.x = clamp(e.x + Math.sin((e.faseT = (e.faseT || 0) + dt) * 0.6) * 20 * dt, e.r, W - e.r); },
    dibujarExtra(e) {
      const p = 0.5 + 0.5 * Math.sin(performance.now() / 160);
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.25 + p * 0.2;
      ctx.strokeStyle = "#7dc4ff"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(0, 0, e.r * 1.9, 0, TAU); ctx.stroke();
      ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
    },
  },

  // ── DRONES DE ESCOLTA ─────────────────────────────────
  //  M6+: acompañan a cruceros y comandos. Frágiles, tres roles claros,
  //  y expiran solos si se quedan atrás (igual que cualquier enemigo:
  //  sale de pantalla, se recicla).
  dron_ataque: {
    r: 11, hp: 2, puntos: 20, vel: 1.6, forma: "rombo",
    color: t => t.enemigoB, muerte: "rapida", estela: true,
    init(e) { e.zig = rand(90, 160) * (Math.random() < 0.5 ? -1 : 1); },
    mover(e, dt) { caer(e, dt); e.fase += dt * 3.5; e.x = clamp(e.x + Math.cos(e.fase) * e.zig * dt, e.r, W - e.r); },
    recarga: () => rand(1.3, 1.9),
    atacar(e) { PATRONES.abanico(e.x, e.y, haciaJugador(e), 260, 1, 0, 4); sfx("ene_disparo"); },
  },
  dron_escudo: {
    r: 14, hp: 5, puntos: 45, vel: 0.55, forma: "circulo", premio: 2,
    color: t => "#8affd1", muerte: "basica",
    mover: caer,
    dibujarExtra(e) {
      ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.3;
      ctx.strokeStyle = "#8affd1"; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(0, 0, e.r * 1.6, 0, TAU); ctx.stroke();
      ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
    },
  },
  dron_misil: {
    r: 13, hp: 3, puntos: 35, vel: 0.6, forma: "punta", premio: 2,
    color: t => t.enemigoA, muerte: "basica",
    mover: caer,
    recarga: () => rand(2.2, 3.0),
    atacar(e) {
      const a = haciaJugador(e);
      eBala(e.x, e.y, Math.cos(a) * 150, Math.sin(a) * 150, 6, { guiaEne: 2.2 });
      sfx("ene_disparo", { tono: 0.7 });
    },
  },

  // ════════════════════════════════════════════════════════════
  //  EXPANSIÓN — diez enemigos nuevos, dos por mundo (bloque 5E)
  // ════════════════════════════════════════════════════════════
  //  Ninguno pasa de 8 HP. La dificultad de estos diez no está en
  //  cuánto aguantan — en eso son más frágiles que un `torreta`— está en
  //  que hay que LEERLOS antes de disparar: el que rebota, el que
  //  devuelve el tiro, el que no está donde parece, el que copia con
  //  retraso. `mundo` es solo metadato de catálogo — de dónde es cada
  //  uno para la auditoría y las pruebas — y no ata nada: quien decide
  //  dónde aparece de verdad sigue siendo el guión de la misión, con
  //  `spawnEnemy(tipo, x)`, igual que con los catorce de siempre.

  // ── HIELO ──────────────────────────────────────────────
  //  SIERRA_HIELO — rebota en las paredes. Trayectoria predecible pero
  //  no vertical: obliga a leer el rebote, no solo a esquivar hacia
  //  abajo. No dispara: la amenaza es la trayectoria, como `veloz`.
  sierra_hielo: {
    mundo: "hielo",
    r: 16, hp: 5, puntos: 35, vel: 1.05, forma: "rombo",
    color: t => t.enemigoA, muerte: "rapida", estela: true, rota: true,
    init(e) { e.vx = rand(85, 150) * (Math.random() < 0.5 ? -1 : 1); },
    mover(e, dt) {
      caer(e, dt);
      e.x += e.vx * dt;
      if (e.x < e.r && e.vx < 0) e.vx = -e.vx;
      if (e.x > W - e.r && e.vx > 0) e.vx = -e.vx;
      e.giro += e.vx * dt * 0.01;
    },
  },

  // PRISMA — no se le dispara de frente: la mayor parte del tiempo está
  // FACETADO (cerrado) y devuelve tu disparo en ángulo en vez de
  // encajarlo. Cada pocos segundos se ABRE —con aviso propio, un brillo
  // que crece antes del cambio— y ahí sí se le hace daño de verdad.
  // Poca vida a propósito: el reto es EL MOMENTO, no la resistencia.
  prisma: {
    mundo: "hielo",
    r: 17, hp: 6, puntos: 60, vel: 0.3, forma: "punta",
    color: t => t.enemigoB, muerte: "rapida", premio: 1.6,
    init(e) { e.abierta = false; e.cicloT = rand(0.9, 1.4); e.facAng = rand(0, TAU); },
    mover(e, dt) {
      caer(e, dt);
      e.facAng += dt * 0.6;
      e.cicloT -= dt;
      if (e.cicloT <= 0) {
        e.abierta = !e.abierta;
        e.cicloT = e.abierta ? 0.5 : rand(1.1, 1.6);
        if (e.abierta) sfx("emp", { vol: 0.4, tono: 1.3 });
      }
    },
    // Devuelve la bala en vez de restarle vida: reflejo de espejo
    // (v' = v - 2(v·n)n) sobre la normal de la faceta, que gira sola
    // con `facAng` — así no siempre sale en el mismo ángulo, y la bala
    // SIGUE VIVA: puede matar a otra cosa por el camino, incluida otra
    // amenaza. Disparar de frente, cerrado, se paga: la devuelve entera,
    // no la amortigua.
    reflejar(e, b) {
      if (e.abierta) return false;
      const nx = Math.cos(e.facAng), ny = Math.sin(e.facAng);
      const dot = b.vx * nx + b.vy * ny;
      b.vx -= 2 * dot * nx;
      b.vy -= 2 * dot * ny;
      vfx("emp", b.x, b.y, 60, 0.22);
      sfx("imp_escudo", { vol: 0.4 });
      return true;
    },
    dibujarExtra(e) {
      const p = 0.5 + 0.5 * Math.sin(performance.now() / 70);
      // Aviso: en el último tercio de estar cerrado, brilla más fuerte
      // antes de abrirse — es el telégrafo del cambio.
      const avisando = !e.abierta && e.cicloT < 0.35;
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = e.abierta ? 0.55 + p * 0.35 : (avisando ? 0.35 + p * 0.35 : 0.14);
      ctx.fillStyle = e.abierta ? "#fff6c4" : "#bfe9ff";
      ctx.beginPath(); ctx.arc(0, 0, e.r * 1.5, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
    },
  },

  // ── MEGACIUDAD ─────────────────────────────────────────
  //  PATRULLA — cruza un carril horizontal disparando hacia abajo.
  //  Entra por un lado y se va por el otro: no cae, así que se limpia
  //  sola forzando `e.y` fuera de pantalla en cuanto sale por el borde,
  //  para no tocar el bucle genérico que solo mira la salida por abajo.
  patrulla: {
    mundo: "megaciudad",
    r: 15, hp: 5, puntos: 45, vel: 0, forma: "rombo",
    color: t => t.enemigoA, muerte: "rapida", estela: true, rota: true,
    init(e) {
      e.y = rand(H * 0.12, H * 0.42);
      const desdeIzq = Math.random() < 0.5;
      e.x = desdeIzq ? -e.r - 10 : W + e.r + 10;
      e.vx = (desdeIzq ? 1 : -1) * rand(150, 210);
    },
    mover(e, dt) {
      e.x += e.vx * dt;
      e.giro += e.vx * dt * 0.006;
      if (e.x < -e.r - 40 || e.x > W + e.r + 40) e.y = H + 999;
    },
    recarga: () => rand(0.65, 1.0),
    atacar(e) {
      PATRONES.abanico(e.x, e.y + e.r * 0.6, Math.PI / 2, 220, 1, 0, 5);
      sfx("ene_disparo", { tono: 0.95 });
    },
  },

  // TORRE_NEON — emplazamiento fijo de borde. No es tráfico: no cruza,
  // no se mueve NADA una vez colocada, y dispara. Es justo lo contrario
  // del hazard `trafico` (bloque 5D), y esa diferencia es la que evita
  // confundirlos: uno amenaza estando quieto, el otro pasando de largo.
  torre_neon: {
    mundo: "megaciudad",
    r: 20, hp: 7, puntos: 70, vel: 0, forma: "hexagono",
    color: t => t.enemigoC, muerte: "media", premio: 2.4,
    init(e) {
      const lado = Math.random() < 0.5 ? 1 : -1;
      e.x = lado === 1 ? e.r + 18 : W - e.r - 18;
      e.y = rand(H * 0.16, H * 0.36);
    },
    mover() {},
    recarga: () => rand(1.7, 2.3),
    avisa: 0.42,
    telegrafo(e) { telegrafo("cono", { x: e.x, y: e.y, a1: haciaJugador(e) - 0.32, a2: haciaJugador(e) + 0.32, r: 640, life: 0.42, sigue: e }); },
    atacar(e) {
      PATRONES.rafaga(e.x, e.y, haciaJugador(e), 260, 4, 0.12, 5);
      sfx("ene_laser", { tono: 0.9 });
      e.recoil = 6;
    },
  },

  // ── ABISMO ─────────────────────────────────────────────
  //  MEDUSA — nunca del todo invisible (0,14 de opacidad como mínimo:
  //  una sombra apagada, no la nada — daño inevitable es justo lo que
  //  este juego no hace) hasta que LATE: entonces se ve entera y ataca
  //  a la vez. El telégrafo y el ataque son la misma cosa.
  medusa: {
    mundo: "abismo",
    r: 22, hp: 6, puntos: 65, vel: 0.28, forma: "circulo",
    color: t => t.enemigoC, muerte: "media", premio: 1.8,
    init(e) { e.pulso = 0; e.pulsoT = rand(1.0, 1.8); e.k = 0.14; },
    mover(e, dt) {
      caer(e, dt);
      e.fase += dt * 0.55;
      e.x = clamp(e.x + Math.sin(e.fase) * 9 * dt, e.r, W - e.r);
      e.pulsoT -= dt;
      if (e.pulsoT <= 0) {
        e.pulso = e.pulso ? 0 : 1;
        e.pulsoT = e.pulso ? 0.55 : rand(1.1, 1.9);
        if (e.pulso) {
          sfx("venom_pulso");
          PATRONES.circulo(e.x, e.y, 145, 6, e.fase, 4);
        }
      }
      const objetivo = e.pulso ? 1 : 0.14;
      e.k += clamp(objetivo - e.k, -3 * dt, 3 * dt);
    },
    alpha(e) { return e.k; },
  },

  // SEMBRADOR — deja `mina_bio` (el hazard del bloque 5D, no una copia)
  // y se va. El límite de minas simultáneas es del TIPO de hazard, no
  // de este enemigo: si el cupo está lleno, avisa igual pero no suelta
  // nada — nunca llena la pantalla por su cuenta.
  sembrador: {
    mundo: "abismo",
    r: 16, hp: 5, puntos: 55, vel: 0.55, forma: "circulo",
    color: t => t.enemigoB, muerte: "basica", premio: 1.6,
    init(e) { e.zig = rand(35, 75) * (Math.random() < 0.5 ? -1 : 1); },
    mover(e, dt) {
      caer(e, dt);
      e.fase += dt * 1.1;
      e.x = clamp(e.x + Math.cos(e.fase) * e.zig * dt, e.r, W - e.r);
    },
    recarga: () => rand(2.2, 3.2),
    avisa: 0.35,
    telegrafo(e) { telegrafo("anillo", { x: e.x, y: e.y, r: e.r * 1.7, life: 0.35, sigue: e }); },
    atacar(e) {
      if (soltarMinaBio(e.x, e.y + e.r * 0.7)) {
        sfx("ene_misil", { tono: 0.6 });
        vfx("toxico", e.x, e.y, 60, 0.3);
      }
    },
  },

  // ── FRAGUA ─────────────────────────────────────────────
  //  CRISOL — matar deprisa se paga: al morir se parte en dos trozos
  //  débiles (un impacto cada uno, sin premio, sin volver a partirse).
  //  `CRISOL_FRAG_MAX` es el tope duro — nadie multiplica sin límite,
  //  ni aunque mueran varios crisoles a la vez.
  crisol: {
    mundo: "fragua",
    r: 19, hp: 6, puntos: 70, vel: 0.48, forma: "hexagono", rota: true,
    color: t => t.enemigoC, muerte: "media", premio: 1.4,
    mover: caer,
    alMorir(e) {
      const vivos = enemies.filter(x => x.tipo === "crisol_frag").length;
      const n = Math.max(0, Math.min(2, CRISOL_FRAG_MAX - vivos));
      for (let k = 0; k < n; k++) {
        const a = rand(0, TAU);
        const f = spawnEnemy("crisol_frag", e.x);
        f.x = e.x; f.y = e.y;
        f.vx = Math.cos(a) * 130; f.vy = Math.sin(a) * 130 - 40;
      }
      if (n > 0) { sfx("roca_break"); vfx("chispa", e.x, e.y, 90, 0.28); }
    },
  },
  // El fragmento no es uno de los diez: es lo que deja `crisol` detrás.
  // `interno` lo aparta de cualquier lista o prueba que recorra los
  // enemigos "de catálogo" — igual que los orbitadores de un jefe no
  // son un jefe aparte.
  crisol_frag: {
    interno: true,
    r: 9, hp: 1, puntos: 8, vel: 1, forma: "rombo",
    color: t => t.enemigoC, muerte: "rapida",
    mover(e, dt) {
      e.vy += 220 * dt;
      e.x += e.vx * dt; e.y += e.vy * dt;
      if (e.x < e.r && e.vx < 0) e.vx = -e.vx;
      if (e.x > W - e.r && e.vx > 0) e.vx = -e.vx;
    },
  },

  // MARTILLO — golpe pesado con aviso largo (0,6 s: el doble que un
  // enemigo normal) porque la zona es estrecha y hay que decidir salir
  // de ella, no solo agacharse. Si nadie está debajo cuando cae, suelta
  // metralla de todos modos: fallar el golpe sigue dejando algo que
  // esquivar, no una pantalla vacía.
  martillo: {
    mundo: "fragua",
    r: 24, hp: 7, puntos: 85, vel: 0.42, forma: "acorazado",
    color: t => t.enemigoA, embiste: true, premio: 2.2, muerte: "pesada",
    init(e) { e.paraY = rand(H * 0.18, H * 0.3); },
    mover(e, dt) {
      if (e.y < e.paraY) { caer(e, dt); return; }
      e.faseT = (e.faseT || 0) + dt;
      e.x = clamp(e.x + Math.sin(e.faseT * 0.5) * 14 * dt, e.r, W - e.r);
    },
    recarga: () => rand(2.6, 3.4),
    avisa: 0.6,
    telegrafo(e) {
      e.golpeY = clamp(e.y + 140, 0, H - 40);
      telegrafo("banda", { y: e.golpeY, h: 110, life: 0.6, col: "#ff5c1a" });
    },
    atacar(e) {
      const yb = e.golpeY != null ? e.golpeY : clamp(e.y + 140, 0, H - 40);
      sfx("ene_barrido", { tono: 0.6 });
      sacudir("small");
      e.recoil = 10;
      onda(e.x, yb, "#ff8a1f", 130, 0.4, 4);
      const dx = player.x - e.x, dy = player.y - yb;
      if (Math.abs(dy) < 60 && Math.abs(dx) < 130) {
        golpe(e.x, yb);
        if (state !== "play") return;
      }
      PATRONES.abanico(e.x, yb, Math.PI / 2, 200, 3, 0.5, 5);
    },
  },

  // ── GRIETA ─────────────────────────────────────────────
  //  ROMPEDOR — se teletransporta a saltos cortos, y las dos mitades del
  //  salto se VEN: se apaga con un aro que se cierra, elige un sitio a
  //  más de 150 px del jugador, y reaparece con `VFX.materializar` y un
  //  aro que se abre. Mientras está "entre sitios" no se le puede tocar
  //  ni él puede tocarte —`invulnerable`—, así que nunca aparece encima
  //  del jugador sin aviso: si el punto elegido queda demasiado cerca,
  //  ya ha reaparecido en otro antes de que pueda importar.
  rompedor: {
    mundo: "grieta",
    r: 17, hp: 6, puntos: 75, vel: 0.5, forma: "punta",
    color: t => t.enemigoB, muerte: "rapida", premio: 2,
    init(e) { e.est = "entrada"; e.paraY = rand(H * 0.16, H * 0.32); e.saltoT = rand(1.3, 2.0); e.fadeT = 0; e.solido = true; },
    mover(e, dt) {
      if (e.est === "entrada") {
        caer(e, dt);
        if (e.y >= e.paraY) e.est = "normal";
        return;
      }
      if (e.est === "normal") {
        e.saltoT -= dt;
        if (e.saltoT <= 0) {
          e.est = "saliendo"; e.fadeT = 0.3; e.solido = false;
          sfx("gravedad_forma", { vol: 0.55 });
          telegrafo("anillo", { x: e.x, y: e.y, r: e.r * 2.4, life: 0.3, sigue: e });
        }
        return;
      }
      if (e.est === "saliendo") {
        e.fadeT -= dt;
        if (e.fadeT <= 0) {
          let nx = e.x, ny = e.y, intentos = 0;
          do {
            nx = rand(e.r + 24, W - e.r - 24);
            ny = rand(H * 0.18, H * 0.6);
            intentos++;
          } while (Math.hypot(nx - player.x, ny - player.y) < 150 && intentos < 8);
          e.x = nx; e.y = ny;
          e.est = "entrando"; e.fadeT = 0.3;
          VFX.materializar(e.x, e.y, 10, ENEMIGOS.rompedor.color(T), 50);
          sfx("gravedad_colapso", { vol: 0.55 });
          telegrafo("anillo", { x: e.x, y: e.y, r: e.r * 0.4, life: 0.3, sigue: e });
        }
        return;
      }
      // "entrando"
      e.fadeT -= dt;
      if (e.fadeT <= 0) {
        e.est = "normal"; e.solido = true; e.saltoT = rand(1.3, 2.0);
        PATRONES.abanico(e.x, e.y, haciaJugador(e), 240, 1, 0, 5);
        sfx("ene_disparo", { tono: 0.85 });
      }
    },
    alpha(e) {
      if (e.est === "saliendo") return Math.max(0.08, e.fadeT / 0.3);
      if (e.est === "entrando") return Math.max(0.08, 1 - e.fadeT / 0.3);
      return 1;
    },
    // Ni bala ni cuerpo lo tocan mientras está "entre sitios" — es lo
    // que hace que la salida y la entrada sean de verdad seguras, y no
    // solo un dibujo distinto encima de la misma hitbox de siempre.
    invulnerable(e) { return !e.solido; },
  },

  // ECO — copia tu POSICIÓN horizontal con casi un segundo de retraso
  // (siete muestras a 0,12 s), nunca al instante. Se ve clarísimo que
  // te sigue y clarísimo que va un paso por detrás: ni te acorrala ni
  // finge que no existe.
  eco: {
    mundo: "grieta",
    r: 15, hp: 6, puntos: 70, vel: 0.5, forma: "rombo", estela: true,
    color: t => t.enemigoC, muerte: "rapida", premio: 1.6,
    init(e) { e.paraY = rand(H * 0.2, H * 0.34); e.buffer = []; e.acc = 0; },
    mover(e, dt) {
      if (e.y < e.paraY) { caer(e, dt); return; }
      e.acc += dt;
      if (e.acc >= 0.12) {
        e.acc = 0;
        e.buffer.push(player.x);
        if (e.buffer.length > 7) e.buffer.shift();
      }
      const objetivo = e.buffer.length ? e.buffer[0] : e.x;
      e.x = clamp(e.x + clamp(objetivo - e.x, -140 * dt, 140 * dt), e.r, W - e.r);
    },
    recarga: () => rand(1.8, 2.4),
    atacar(e) {
      PATRONES.abanico(e.x, e.y, haciaJugador(e), 230, 1, 0, 5);
      sfx("ene_disparo", { tono: 1.15 });
    },
  },
};

// Tope de fragmentos de CRISOL vivos a la vez. No es "por crisol": es
// GLOBAL, así que ni una muerte múltiple llena la pantalla de metralla.
const CRISOL_FRAG_MAX = 8;
