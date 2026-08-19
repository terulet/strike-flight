// ════════════════════════════════════════════════════════════
//  jefes.js — la tabla de jefes y minijefes de FLIGHT STRIKE
// ════════════════════════════════════════════════════════════
//
//  <script src> clásico, y SOLO DATOS. Sale de index.html en el bloque
//  5A sin tocar una coma.
//
//  Los minijefes NO son una tabla aparte: son entradas de ésta con
//  menos fases y menos vida, invocadas con el mismo evento
//  `fn:"miniboss"`. Un jefe y un minijefe se diferencian en los números,
//  no en el código que los mueve.
//
//  Las máquinas de fase llaman a ayudantes que se quedaron en
//  index.html —`venomZona`, `actualizarSubsOmega`, `telegrafo`,
//  `PATRONES`—. Se resuelven en tiempo de ejecución, que es cuando el
//  juego ya existe. Aquí solo se construyen literales.

const JEFES = {
  guardian: {
    r: 62, hpMax: 560, nombre: "GUARDIÁN", titulo: "UNIDAD DE CONTENCIÓN ORBITAL",
    sp: "bs_guardian", color: t => t.enemigoC,
    puntos: 3500, drops: ["arma", "escudo", "vida", "bomba"],
    fases: [
      { umbral: 1, ojo: "#c77dff",
        mover(mb, dt) {
          mb.x = clamp(W / 2 + Math.sin(mb.faseT * 0.55) * W * 0.26, mb.r * 0.7, W - mb.r * 0.7);
          mb.y = mb.baseY + Math.sin(mb.faseT * 0.9) * 12;
        },
        ataques: [
          { cd: [2.3, 3.0], avisa: 0.45,
            telegrafo(mb) {
              const a = haciaJugador(mb);
              telegrafo("cono", { x: mb.x, y: mb.y, a1: a - 0.55, a2: a + 0.55, r: 900, life: 0.45, sigue: mb });
            },
            fn(mb) { PATRONES.abanico(mb.x, mb.y, haciaJugador(mb), 300, 5, 0.26, 7); sfx("ene_barrido"); mb.recoil = 8; } },
          { cd: [4.4, 5.4], avisa: 0.6,
            telegrafo(mb) { telegrafo("anillo", { x: mb.x, y: mb.y, r: mb.r * 3, life: 0.6, sigue: mb }); },
            fn(mb) { PATRONES.circulo(mb.x, mb.y, 250, 12, mb.faseT, 6); sfx("ene_mortero", { tono: 0.7 }); } },
        ] },
      { umbral: 0.5, ojo: "#ff2f6e", furia: true,
        mover(mb, dt) {
          mb.x = clamp(W / 2 + Math.sin(mb.faseT * 0.85) * W * 0.32, mb.r * 0.7, W - mb.r * 0.7);
          mb.y = mb.baseY + Math.sin(mb.faseT * 1.5) * 22;
        },
        ataques: [
          { cd: [1.5, 2.0], avisa: 0.4,
            telegrafo(mb) {
              const a = haciaJugador(mb);
              telegrafo("cono", { x: mb.x, y: mb.y, a1: a - 0.6, a2: a + 0.6, r: 900, life: 0.4, sigue: mb });
            },
            fn(mb) {
              PATRONES.abanico(mb.x, mb.y, haciaJugador(mb), 340, 7, 0.2, 7);
              sfx("ene_barrido"); mb.recoil = 10;
            } },
          { cd: [3.0, 3.8], avisa: 0.5,
            telegrafo(mb) { telegrafo("anillo", { x: mb.x, y: mb.y, r: mb.r * 3.4, life: 0.5, sigue: mb }); },
            fn(mb) { PATRONES.espiral(mb.x, mb.y, 265, 18, mb.faseT * 2, 6, 2); sfx("ene_mortero", { tono: 0.6 }); } },
          { cd: [6.0, 7.5], avisa: 0.8,
            telegrafo(mb) { telegrafo("banda", { y: H * 0.5, h: 70, life: 0.8 }); },
            fn(mb) { PATRONES.muro(0, 235, 7, 2, 2.6); sfx("emp"); sacudir("small"); } },
        ] },
    ],
  },

  titan: {
    r: 82, hpMax: 1150, nombre: "TITÁN", titulo: "PLATAFORMA DE ASEDIO CLASE FISURA",
    sp: "bs_titan", color: t => mezcla(t.enemigoC, "#66ccff", 0.45),
    puntos: 12000, drops: ["arma", "arma", "escudo", "escudo", "vida", "bomba", "bomba"],
    fases: [
      { umbral: 1, ojo: "#88ddff",
        mover(mb, dt) {
          mb.x = clamp(W / 2 + Math.sin(mb.faseT * 0.42) * W * 0.3, mb.r * 0.62, W - mb.r * 0.62);
          mb.y = mb.baseY + Math.sin(mb.faseT * 0.7) * 14;
        },
        ataques: [
          { cd: [2.0, 2.6], avisa: 0.42,
            telegrafo(mb) {
              const a = haciaJugador(mb);
              telegrafo("cono", { x: mb.x, y: mb.y, a1: a - 0.5, a2: a + 0.5, r: 1000, life: 0.42, sigue: mb });
            },
            fn(mb) { PATRONES.abanico(mb.x, mb.y, haciaJugador(mb), 330, 7, 0.2, 8); sfx("ene_barrido"); mb.recoil = 10; } },
          { cd: [3.6, 4.4], avisa: 0.5,
            telegrafo(mb) { telegrafo("anillo", { x: mb.x, y: mb.y, r: mb.r * 2.6, life: 0.5, sigue: mb }); },
            fn(mb) { PATRONES.circulo(mb.x, mb.y, 250, 16, mb.faseT, 6); sfx("ene_mortero", { tono: 0.65 }); } },
          { cd: [7.0, 8.5], avisa: 0.9,
            telegrafo(mb) { telegrafo("banda", { y: H * 0.42, h: 64, life: 0.9, col: "#88ddff" }); },
            fn(mb) { PATRONES.muro(0, 225, 7, 3, 2.4); sfx("cryo", { tono: 0.5 }); } },
        ] },
      { umbral: 0.62, ojo: "#c77dff", furia: true,
        mover(mb, dt) {
          mb.x = clamp(W / 2 + Math.sin(mb.faseT * 0.7) * W * 0.34 + Math.cos(mb.faseT * 1.3) * W * 0.07,
            mb.r * 0.62, W - mb.r * 0.62);
          mb.y = mb.baseY + Math.sin(mb.faseT * 1.2) * 26;
        },
        ataques: [
          { cd: [1.6, 2.1], avisa: 0.36,
            telegrafo(mb) {
              const a = haciaJugador(mb);
              telegrafo("cono", { x: mb.x, y: mb.y, a1: a - 0.62, a2: a + 0.62, r: 1000, life: 0.36, sigue: mb });
            },
            fn(mb) { PATRONES.abanico(mb.x, mb.y, haciaJugador(mb), 360, 9, 0.17, 8); sfx("ene_barrido"); mb.recoil = 12; } },
          { cd: [2.8, 3.4], avisa: 0.44,
            telegrafo(mb) { telegrafo("anillo", { x: mb.x, y: mb.y, r: mb.r * 3, life: 0.44, sigue: mb }); },
            fn(mb) { PATRONES.espiral(mb.x, mb.y, 275, 22, mb.faseT * 2.6, 6, 3); sfx("ene_mortero", { tono: 0.6 }); } },
          { cd: [5.5, 6.8], avisa: 0.7,
            telegrafo(mb) { telegrafo("banda", { y: H * 0.34, h: 54, life: 0.7 }); },
            fn(mb) { PATRONES.cruzado(H * 0.2, 260, 3, 6); sfx("emp"); } },
        ] },
      // FASE FINAL — el ataque insignia del Titán: la LANZA DE FISURA.
      // Tres barridos que cierran la pantalla en tenaza, siempre con
      // salida, y una espiral debajo para que la salida haya que buscarla.
      { umbral: 0.28, ojo: "#ff2f6e", furia: true, final: true,
        mover(mb, dt) {
          mb.x = clamp(W / 2 + Math.sin(mb.faseT * 1.05) * W * 0.36, mb.r * 0.62, W - mb.r * 0.62);
          mb.y = mb.baseY + Math.sin(mb.faseT * 1.8) * 30;
        },
        ataques: [
          { cd: [1.25, 1.6], avisa: 0.3,
            telegrafo(mb) {
              const a = haciaJugador(mb);
              telegrafo("cono", { x: mb.x, y: mb.y, a1: a - 0.7, a2: a + 0.7, r: 1000, life: 0.3, sigue: mb });
            },
            fn(mb) { PATRONES.abanico(mb.x, mb.y, haciaJugador(mb), 400, 9, 0.16, 8); sfx("ene_barrido"); mb.recoil = 12; } },
          { cd: [3.4, 4.2], avisa: 0.85,
            telegrafo(mb) {
              telegrafo("anillo", { x: mb.x, y: mb.y, r: mb.r * 4.2, life: 0.85, sigue: mb, col: "#ff2f6e" });
              telegrafo("cono", { x: mb.x, y: mb.y, a1: 0.15, a2: Math.PI - 0.15, r: 1100, life: 0.85, sigue: mb });
            },
            fn(mb) {
              texto(mb.x, mb.y - mb.r - 30, "LANZA DE FISURA", "#ff2f6e", 15);
              PATRONES.barrido(mb.x, mb.y, 0.2, Math.PI - 0.2, 300, 13, 7);
              PATRONES.barrido(mb.x, mb.y, Math.PI - 0.35, 0.35, 235, 11, 7);
              PATRONES.espiral(mb.x, mb.y, 290, 20, mb.faseT * 3, 5, 2);
              sfx("ultimate", { tono: 0.5 });
              sacudir("medium"); hitstop(0.04);
            } },
        ] },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  RIFT REAPER — jefe de M2, CINTURÓN DE ASTEROIDES
  //  Identidad: movimiento + inercia + asteroides. Su firma es el
  //  ASTEROID BREAK — las rocas grandes que lanza se parten en dos al
  //  morir — y en fase 2 un anillo de escombros orbitando que obliga a
  //  cambiar de posición, no solo a esquivar disparos.
  // ══════════════════════════════════════════════════════════
  rift_reaper: {
    r: 58, hpMax: 210, nombre: "RIFT REAPER", titulo: "SEGADOR DEL CINTURÓN",
    sp: "bs_rift_reaper", color: () => "#ff5c1a",
    puntos: 2600, drops: ["arma", "escudo", "vida"],
    onSpawn(mb) { mb.orbitadores = null; mb.dash = null; mb.dashPrep = null; },
    onEntrada(mb, dt) {
      if (Math.random() < 0.5) {
        part(mb.x + rand(-mb.r * 1.4, mb.r * 1.4), mb.y + rand(-30, 90),
          rand(-30, 30), rand(40, 120), rand(0.4, 0.8), "#ff8a3f", rand(2, 4));
      }
    },
    reduccionDano(mb) { return mb.orbitadores && mb.orbitadores.length ? 0.55 : 1; },
    onDetonar(mb) {
      for (let i = 0; i < 14; i++) {
        const a = rand(0, TAU);
        part(mb.x, mb.y, Math.cos(a) * rand(120, 320), Math.sin(a) * rand(120, 320),
          rand(0.4, 0.9), "#ff5c1a", rand(2, 4));
      }
    },
    onMuerte(mb) {
      if (mb.orbitadores) {
        for (const o of mb.orbitadores) {
          const ox = mb.x + Math.cos(o.ang) * o.radio, oy = mb.y + Math.sin(o.ang) * o.radio;
          vfx("chispa", ox, oy, 60, 0.3);
          boom(ox, oy, "#ff8a3f", 8, 0.8);
        }
        mb.orbitadores = [];
      }
      rocas.length = 0;
    },
    dibujarExtra(mb) {
      if (!mb.orbitadores) return;
      const sp = SPRITES["hz_asteroide"];
      for (const o of mb.orbitadores) {
        const ox = mb.x + Math.cos(o.ang) * o.radio, oy = mb.y + Math.sin(o.ang) * o.radio;
        ctx.save(); ctx.translate(ox, oy); ctx.rotate(o.ang * 2.4);
        if (sp) { ctx.shadowColor = "#ff5c1a"; ctx.shadowBlur = 8; pintarSprite(sp, o.r * 2.4); ctx.shadowBlur = 0; }
        else { ctx.beginPath(); ctx.arc(0, 0, o.r, 0, TAU); ctx.fillStyle = "#a04010"; ctx.fill(); }
        ctx.restore();
      }
    },
    fases: [
      // F1 — barrido lateral amplio + ráfagas dirigidas + rocas sueltas
      { umbral: 1, ojo: "#ff8a3f",
        mover(mb, dt) {
          mb.x = clamp(W / 2 + Math.sin(mb.faseT * 0.5) * W * 0.34, mb.r * 0.6, W - mb.r * 0.6);
          mb.y = mb.baseY + Math.sin(mb.faseT * 0.8) * 16;
        },
        ataques: [
          { cd: [2.0, 2.6], avisa: 0.4,
            telegrafo(mb) {
              const a = haciaJugador(mb);
              telegrafo("cono", { x: mb.x, y: mb.y, a1: a - 0.5, a2: a + 0.5, r: 900, life: 0.4, sigue: mb, col: "#ff8a3f" });
            },
            fn(mb) { PATRONES.rafaga(mb.x, mb.y, haciaJugador(mb), 330, 4, 0.14, 7); sfx("ene_pesado"); mb.recoil = 8; } },
          { cd: [3.2, 4.0], avisa: 0.6,
            telegrafo(mb) { telegrafo("anillo", { x: mb.x, y: mb.y, r: mb.r * 2.4, life: 0.6, sigue: mb, col: "#ff8a3f" }); },
            fn(mb) {
              const a = haciaJugador(mb);
              lanzarRoca(mb.x - 24, mb.y + 10, Math.cos(a - 0.18) * 250, Math.sin(a - 0.18) * 250 + 40, 22, 3, 1);
              lanzarRoca(mb.x + 24, mb.y + 10, Math.cos(a + 0.18) * 250, Math.sin(a + 0.18) * 250 + 40, 22, 3, 1);
              sfx("roca_impacto", { tono: 0.6 }); sacudir("tiny");
            } },
        ] },
      // F2 (~65%) — orbitadores como escudo parcial, obligan a moverse
      { umbral: 0.65, ojo: "#ff3b1a", furia: true,
        alEntrar(mb) { crearOrbitadores(mb, 5); },
        mover(mb, dt) {
          mb.x = clamp(W / 2 + Math.sin(mb.faseT * 0.7) * W * 0.3, mb.r * 0.6, W - mb.r * 0.6);
          mb.y = mb.baseY + Math.sin(mb.faseT * 1.3) * 22;
          if (mb.orbitadores && state === "play" && !paused) {
            for (const o of mb.orbitadores) {
              o.ang += o.velAng * dt;
              const ox = mb.x + Math.cos(o.ang) * o.radio, oy = mb.y + Math.sin(o.ang) * o.radio;
              const dx = player.x - ox, dy = player.y - oy;
              if (dx * dx + dy * dy < (hitR() + o.r) ** 2) golpe(ox, oy);
            }
          }
        },
        ataques: [
          { cd: [1.8, 2.3], avisa: 0.35,
            telegrafo(mb) {
              const a = haciaJugador(mb);
              telegrafo("cono", { x: mb.x, y: mb.y, a1: a - 0.55, a2: a + 0.55, r: 900, life: 0.35, sigue: mb, col: "#ff5c1a" });
            },
            fn(mb) { PATRONES.rafaga(mb.x, mb.y, haciaJugador(mb), 350, 5, 0.13, 7); sfx("ene_pesado"); mb.recoil = 9; } },
          { cd: [3.0, 3.6], avisa: 0.5,
            telegrafo(mb) { telegrafo("banda", { y: H * 0.4, h: 60, life: 0.5, col: "#ff5c1a" }); },
            fn(mb) { PATRONES.barrido(mb.x, mb.y, 0.3, Math.PI - 0.3, 260, 8, 6); sfx("ene_barrido", { tono: 0.7 }); } },
          { cd: [5.0, 6.0], avisa: 0.55,
            telegrafo(mb) { telegrafo("anillo", { x: mb.x, y: mb.y, r: mb.r * 2.6, life: 0.55, sigue: mb, col: "#ff8a3f" }); },
            fn(mb) {
              const a = haciaJugador(mb);
              lanzarRoca(mb.x, mb.y + 16, Math.cos(a) * 230, Math.sin(a) * 230 + 30, 24, 3, 1);
              sfx("roca_impacto");
            } },
        ] },
      // F3 (~30%) — embestida telegrafiada: carril anunciado, siempre esquivable
      { umbral: 0.3, ojo: "#ffffff", furia: true, final: true,
        alEntrar(mb) { mb.orbitadores = null; },
        mover(mb, dt) {
          if (mb.dash && mb.dash.t < mb.dash.dur) {
            mb.dash.t += dt;
            const k = clamp(mb.dash.t / mb.dash.dur, 0, 1);
            mb.x = mb.dash.x0 + (mb.dash.x1 - mb.dash.x0) * k;
            mb.y = mb.dash.y;
            if (Math.random() < 0.6) lanzarRoca(mb.x, mb.y + mb.r * 0.6, rand(-40, 40), rand(160, 260), 12, 1, 0);
          } else {
            mb.x = clamp(W / 2 + Math.sin(mb.faseT * 1.0) * W * 0.28, mb.r * 0.6, W - mb.r * 0.6);
            mb.y = mb.baseY + Math.sin(mb.faseT * 1.8) * 26;
          }
        },
        ataques: [
          { cd: [1.6, 2.0], avisa: 0.3,
            telegrafo(mb) {
              const a = haciaJugador(mb);
              telegrafo("cono", { x: mb.x, y: mb.y, a1: a - 0.6, a2: a + 0.6, r: 900, life: 0.3, sigue: mb, col: "#ffffff" });
            },
            fn(mb) { PATRONES.rafaga(mb.x, mb.y, haciaJugador(mb), 380, 5, 0.12, 7); sfx("ene_pesado"); mb.recoil = 10; } },
          { cd: [4.2, 5.0], avisa: 0.9,
            telegrafo(mb) {
              const dir = mb.x < W / 2 ? 1 : -1;
              telegrafo("banda", { y: mb.y, h: 90, life: 0.9, col: "#ffffff" });
              mb.dashPrep = { dir, y: mb.y };
            },
            fn(mb) {
              const p = mb.dashPrep || { dir: 1, y: mb.y };
              mb.dash = { t: 0, dur: 0.5, x0: mb.x, x1: p.dir > 0 ? W - mb.r * 0.6 : mb.r * 0.6, y: p.y };
              sfx("reaper_carga"); sacudir("medium"); hitstop(0.03);
              texto(mb.x, mb.y - mb.r - 30, "EMBESTIDA", "#ffffff", 15);
            } },
        ] },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  AEGIS PRIME — jefe de M3, RED DE DEFENSA
  //  Identidad: fortaleza militar, prioridad de objetivos. Su firma es
  //  TARGET PRIORITY — cuatro nodos de escolta que reducen el daño al
  //  65 % mientras viven. Ignorarlos es jugar la pelea larga; matarlos,
  //  la corta.
  // ══════════════════════════════════════════════════════════
  aegis_prime: {
    r: 68, hpMax: 380, nombre: "AEGIS PRIME", titulo: "PLATAFORMA DE DEFENSA ORBITAL",
    sp: "bs_aegis_prime", color: () => "#ffcf5c",
    puntos: 3000, drops: ["arma", "escudo", "vida", "bomba"],
    onSpawn(mb) {
      const r = mb.r;
      mb.nodos = [
        { ox: -r * 1.7, oy: -r * 0.1, hp: 13, hpMax: 13, cd: rand(1, 2), flash: 0 },
        { ox: -r * 0.85, oy: r * 0.55, hp: 13, hpMax: 13, cd: rand(1, 2), flash: 0 },
        { ox: r * 0.85, oy: r * 0.55, hp: 13, hpMax: 13, cd: rand(1, 2), flash: 0 },
        { ox: r * 1.7, oy: -r * 0.1, hp: 13, hpMax: 13, cd: rand(1, 2), flash: 0 },
      ];
    },
    onEntrada(mb) {
      if (Math.random() < 0.4) {
        const a = rand(0, TAU);
        part(mb.x + Math.cos(a) * mb.r * 1.3, mb.y + Math.sin(a) * mb.r * 0.8,
          0, rand(-20, 20), 0.3, "#ffcf5c", rand(1.5, 3));
      }
    },
    reduccionDano(mb) { return mb.nodos && mb.nodos.length ? 0.35 : 1; },
    onMuerte(mb) { mb.nodos = []; },
    dibujarExtra(mb) {
      if (!mb.nodos || !mb.nodos.length) return;
      const sp = SPRITES["df_torreta"];
      for (const n of mb.nodos) {
        const nx = mb.x + n.ox, ny = mb.y + n.oy;
        ctx.save(); ctx.translate(nx, ny);
        if (n.flash > 0) ctx.globalAlpha = 0.5 + 0.5 * Math.sin(performance.now() / 35);
        if (sp) { ctx.shadowColor = "rgba(255,207,92,0.5)"; ctx.shadowBlur = 8; pintarSprite(sp, 44); ctx.shadowBlur = 0; }
        else { ctx.beginPath(); ctx.arc(0, 0, 14, 0, TAU); ctx.fillStyle = n.flash > 0 ? "#fff" : "#cc9900"; ctx.fill(); }
        ctx.globalAlpha = 1;
        ctx.restore();
        const bw = 30, bh = 3, bx = nx - bw / 2, by = ny - 26;
        ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
        ctx.fillStyle = "#ffcf5c"; ctx.fillRect(bx, by, bw * (n.hp / n.hpMax), bh);
      }
    },
    fases: [
      // F1 — protegido por los nodos; presión propia mínima a propósito
      { umbral: 1, ojo: "#ffcf5c",
        mover(mb, dt) {
          mb.x = clamp(W / 2 + Math.sin(mb.faseT * 0.4) * W * 0.22, mb.r * 0.75, W - mb.r * 0.75);
          mb.y = mb.baseY + Math.sin(mb.faseT * 0.6) * 10;
          actualizarNodosAegis(mb, dt);
        },
        ataques: [
          { cd: [2.6, 3.2], avisa: 0.5,
            telegrafo(mb) {
              const a = haciaJugador(mb);
              telegrafo("cono", { x: mb.x, y: mb.y, a1: a - 0.4, a2: a + 0.4, r: 900, life: 0.5, sigue: mb, col: "#ffcf5c" });
            },
            fn(mb) { PATRONES.abanico(mb.x, mb.y, haciaJugador(mb), 260, 3, 0.2, 6); sfx("ene_barrido", { tono: 0.8 }); } },
        ] },
      // F2 (~60%) — nodos caídos (a la fuerza si quedaba alguno). Armas
      // principales: líneas cruzadas, barridos, ráfagas.
      { umbral: 0.6, ojo: "#ff8a1f", furia: true,
        alEntrar(mb) {
          if (mb.nodos && mb.nodos.length) {
            for (const n of mb.nodos) muerte(mb.x + n.ox, mb.y + n.oy, "#ffcf5c", "defensa");
            mb.nodos = [];
          }
        },
        mover(mb, dt) {
          mb.x = clamp(W / 2 + Math.sin(mb.faseT * 0.55) * W * 0.28, mb.r * 0.7, W - mb.r * 0.7);
          mb.y = mb.baseY + Math.sin(mb.faseT * 1.0) * 16;
        },
        ataques: [
          { cd: [2.6, 3.2], avisa: 0.55,
            telegrafo(mb) { telegrafo("banda", { y: H * 0.42, h: 60, life: 0.55, col: "#ff8a1f" }); },
            fn(mb) { PATRONES.cruzado(H * 0.3, 260, 4, 6); sfx("ene_barrido"); } },
          { cd: [2.0, 2.6], avisa: 0.4,
            telegrafo(mb) {
              const a = haciaJugador(mb);
              telegrafo("cono", { x: mb.x, y: mb.y, a1: a - 0.5, a2: a + 0.5, r: 900, life: 0.4, sigue: mb, col: "#ff8a1f" });
            },
            fn(mb) { PATRONES.rafaga(mb.x, mb.y, haciaJugador(mb), 340, 5, 0.14, 6); sfx("ene_barrido", { tono: 0.75 }); mb.recoil = 8; } },
          { cd: [3.6, 4.4], avisa: 0.6,
            telegrafo(mb) { telegrafo("anillo", { x: mb.x, y: mb.y, r: mb.r * 2.8, life: 0.6, sigue: mb, col: "#ff8a1f" }); },
            fn(mb) { PATRONES.barrido(mb.x, mb.y, 0.25, Math.PI - 0.25, 270, 9, 6); sfx("ene_barrido", { tono: 0.65 }); } },
        ] },
      // F3 (~25%) — OVERLOAD: ventana de disparo única, muy legible
      { umbral: 0.25, ojo: "#ffffff", furia: true, final: true,
        mover(mb, dt) {
          mb.x = clamp(W / 2 + Math.sin(mb.faseT * 0.7) * W * 0.24, mb.r * 0.7, W - mb.r * 0.7);
          mb.y = mb.baseY + Math.sin(mb.faseT * 1.4) * 20;
        },
        ataques: [
          { cd: [1.8, 2.2], avisa: 0.4,
            telegrafo(mb) {
              const a = haciaJugador(mb);
              telegrafo("cono", { x: mb.x, y: mb.y, a1: a - 0.55, a2: a + 0.55, r: 900, life: 0.4, sigue: mb, col: "#ffffff" });
            },
            fn(mb) { PATRONES.rafaga(mb.x, mb.y, haciaJugador(mb), 360, 6, 0.12, 6); sfx("ene_pesado"); mb.recoil = 9; } },
          { cd: [4.4, 5.2], avisa: 1.0,
            telegrafo(mb) { telegrafo("banda", { y: H * 0.5, h: 80, life: 1.0, col: "#ffffff" }); },
            fn(mb) {
              texto(mb.x, mb.y - mb.r - 30, "OVERLOAD", "#ffffff", 16);
              PATRONES.muro(0, 260, 7, 1, 3.2);
              PATRONES.circulo(mb.x, mb.y, 230, 10, mb.faseT, 6);
              sfx("aegis_overload"); sacudir("medium"); hitstop(0.05);
            } },
        ] },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  VENOM CORE — jefe de M4, SECTOR TÓXICO
  //  Identidad: control espacial, toxicidad. Su firma reutiliza el
  //  propio sistema de zonas de la misión (TELEGRAPH → ACTIVE →
  //  DISSIPATE) acotado por columnas, así que SIEMPRE queda una
  //  franja vertical limpia — nunca puede cerrar el paso entero.
  // ══════════════════════════════════════════════════════════
  venom_core: {
    r: 60, hpMax: 460, nombre: "VENOM CORE", titulo: "NÚCLEO DE CONTAMINACIÓN",
    sp: "bs_venom_core", color: () => "#8aff4d",
    puntos: 3200, drops: ["arma", "arma", "escudo", "vida"],
    onSpawn(mb) { mb._colAlt = -1; },
    onEntrada(mb) {
      if (Math.random() < 0.5) {
        part(mb.x + rand(-mb.r, mb.r), mb.y + rand(-mb.r * 0.6, mb.r * 0.6),
          rand(-15, 15), rand(-40, -10), rand(0.5, 0.9), "#8aff4d", rand(2, 4));
      }
    },
    onDetonar(mb) {
      vfx("toxico", mb.x, mb.y, mb.r * 8, 0.9);
      boom(mb.x, mb.y, "#8aff4d", 30, 1.6);
      sfx("venom_collapse");
    },
    onMuerte(mb) { zonas.length = 0; },   // las zonas dejan de hacer daño AL INSTANTE
    fases: [
      // F1 — proyectiles lentos + una zona ocasional, siempre con aviso
      { umbral: 1, ojo: "#8aff4d",
        mover(mb, dt) {
          mb.x = clamp(W / 2 + Math.sin(mb.faseT * 0.35) * W * 0.24, mb.r * 0.7, W - mb.r * 0.7);
          mb.y = mb.baseY + Math.sin(mb.faseT * 0.5) * 14;
        },
        ataques: [
          { cd: [2.4, 3.0], avisa: 0.5,
            telegrafo(mb) {
              const a = haciaJugador(mb);
              telegrafo("cono", { x: mb.x, y: mb.y, a1: a - 0.4, a2: a + 0.4, r: 800, life: 0.5, sigue: mb, col: "#8aff4d" });
            },
            fn(mb) { PATRONES.abanico(mb.x, mb.y, haciaJugador(mb), 190, 4, 0.22, 7); sfx("venom_pulso"); } },
          { cd: [5.0, 6.2],
            fn(mb) { venomZona((Math.random() * 3) | 0); } },
        ] },
      // F2 (~60%) — 2 de 3 columnas contaminadas a la vez: la tercera
      // queda siempre limpia, garantizado por construcción.
      { umbral: 0.6, ojo: "#c04dff", furia: true,
        alEntrar(mb) { zonas.length = 0; },
        mover(mb, dt) {
          mb.x = clamp(W / 2 + Math.sin(mb.faseT * 0.55) * W * 0.3, mb.r * 0.7, W - mb.r * 0.7);
          mb.y = mb.baseY + Math.sin(mb.faseT * 0.9) * 20;
        },
        ataques: [
          { cd: [2.0, 2.6], avisa: 0.4,
            telegrafo(mb) {
              const a = haciaJugador(mb);
              telegrafo("cono", { x: mb.x, y: mb.y, a1: a - 0.5, a2: a + 0.5, r: 850, life: 0.4, sigue: mb, col: "#c04dff" });
            },
            fn(mb) { PATRONES.abanico(mb.x, mb.y, haciaJugador(mb), 220, 5, 0.19, 7); sfx("venom_pulso", { tono: 0.85 }); } },
          { cd: [6.5, 7.5],
            fn(mb) {
              const cols = [0, 1, 2].sort(() => Math.random() - 0.5).slice(0, 2);
              for (const c of cols) venomZona(c);
              texto(mb.x, mb.y - mb.r - 26, "SECTORES CONTAMINADOS", "#c04dff", 13);
            } },
        ] },
      // F3 (~25%) — pulso tóxico radial + zonas alternando de columna
      { umbral: 0.25, ojo: "#ff2fbf", furia: true, final: true,
        alEntrar(mb) { zonas.length = 0; },
        mover(mb, dt) {
          mb.x = clamp(W / 2 + Math.sin(mb.faseT * 0.8) * W * 0.26, mb.r * 0.7, W - mb.r * 0.7);
          mb.y = mb.baseY + Math.sin(mb.faseT * 1.5) * 24;
        },
        ataques: [
          { cd: [2.0, 2.4], avisa: 0.5,
            telegrafo(mb) { telegrafo("anillo", { x: mb.x, y: mb.y, r: mb.r * 2.6, life: 0.5, sigue: mb, col: "#ff2fbf" }); },
            fn(mb) {
              texto(mb.x, mb.y - mb.r - 26, "PULSO TÓXICO", "#ff2fbf", 14);
              PATRONES.circulo(mb.x, mb.y, 215, 16, mb.faseT, 6);
              sfx("venom_pulso", { tono: 0.6 }); sacudir("tiny");
            } },
          { cd: [1.8, 2.2], avisa: 0.35,
            telegrafo(mb) {
              const a = haciaJugador(mb);
              telegrafo("cono", { x: mb.x, y: mb.y, a1: a - 0.5, a2: a + 0.5, r: 850, life: 0.35, sigue: mb, col: "#ff2fbf" });
            },
            fn(mb) { PATRONES.abanico(mb.x, mb.y, haciaJugador(mb), 260, 5, 0.18, 7); sfx("venom_pulso", { tono: 1.0 }); mb.recoil = 7; } },
          { cd: [4.4, 5.2],
            fn(mb) { mb._colAlt = (mb._colAlt + 1) % 3; venomZona(mb._colAlt); } },
        ] },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  WARLORD VESPER — jefe de M6, WAR FLEET
  //  Identidad: buque de guerra. Su firma son los dos pods laterales:
  //  destruir uno apaga la barrera de fuego de ESE lado en concreto, no
  //  reduce daño en general — es la única forma de abrir un pasillo
  //  limpio en la fase 1.
  // ══════════════════════════════════════════════════════════
  warlord_vesper: {
    r: 74, hpMax: 430, nombre: "WARLORD VESPER", titulo: "BUQUE INSIGNIA DE LA FLOTA",
    sp: "bs_warlord_vesper", color: () => "#ff8040",
    puntos: 5200, drops: ["arma", "arma", "escudo", "vida", "bomba"],
    onSpawn(mb) {
      const r = mb.r;
      mb.pods = { izq: { ox: -r * 1.35, oy: r * 0.1, vivo: true }, der: { ox: r * 1.35, oy: r * 0.1, vivo: true } };
    },
    onEntrada(mb) {
      if (Math.random() < 0.4) part(mb.x + rand(-mb.r, mb.r), mb.y + rand(-20, 60), rand(-20, 20), rand(60, 140), 0.4, "#ff8040", rand(2, 4));
    },
    dibujarExtra(mb) {
      for (const p of [mb.pods.izq, mb.pods.der]) {
        if (!p.vivo) continue;
        const px = mb.x + p.ox, py = mb.y + p.oy;
        ctx.save(); ctx.translate(px, py);
        ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.5;
        ctx.fillStyle = "#ff8040"; ctx.beginPath(); ctx.arc(0, 0, 10, 0, TAU); ctx.fill();
        ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
        ctx.restore();
      }
    },
    onMuerte(mb) { mb.pods.izq.vivo = false; mb.pods.der.vivo = false; },
    fases: [
      // F1 — escoltas y fuego pesado desde los pods
      { umbral: 1, ojo: "#ff8040",
        mover(mb, dt) {
          mb.x = clamp(W / 2 + Math.sin(mb.faseT * 0.4) * W * 0.22, mb.r * 0.7, W - mb.r * 0.7);
          mb.y = mb.baseY + Math.sin(mb.faseT * 0.6) * 12;
        },
        ataques: [
          { cd: [2.2, 2.8], avisa: 0.45,
            telegrafo(mb) { if (mb.pods.izq.vivo) telegrafo("cono", { x: mb.x + mb.pods.izq.ox, y: mb.y + mb.pods.izq.oy, a1: Math.PI / 2 - 0.4, a2: Math.PI / 2 + 0.4, r: 800, life: 0.45, col: "#ff8040" }); },
            fn(mb) { if (mb.pods.izq.vivo) { PATRONES.abanico(mb.x + mb.pods.izq.ox, mb.y + mb.pods.izq.oy, Math.PI / 2, 250, 4, 0.2, 6); sfx("ene_barrido"); } } },
          { cd: [2.2, 2.8], avisa: 0.45,
            telegrafo(mb) { if (mb.pods.der.vivo) telegrafo("cono", { x: mb.x + mb.pods.der.ox, y: mb.y + mb.pods.der.oy, a1: Math.PI / 2 - 0.4, a2: Math.PI / 2 + 0.4, r: 800, life: 0.45, col: "#ff8040" }); },
            fn(mb) { if (mb.pods.der.vivo) { PATRONES.abanico(mb.x + mb.pods.der.ox, mb.y + mb.pods.der.oy, Math.PI / 2, 250, 4, 0.2, 6); sfx("ene_barrido", { tono: 0.9 }); } } },
          { cd: [4.0, 4.8], avisa: 0.5,
            telegrafo(mb) { const a = haciaJugador(mb); telegrafo("cono", { x: mb.x, y: mb.y, a1: a - 0.35, a2: a + 0.35, r: 900, life: 0.5, sigue: mb }); },
            fn(mb) { PATRONES.rafaga(mb.x, mb.y, haciaJugador(mb), 340, 5, 0.13, 7); sfx("ene_barrido", { tono: 0.7 }); mb.recoil = 9; } },
        ] },
      // F2 (~65%) — despliega drones de escolta
      { umbral: 0.65, ojo: "#ffb020", furia: true,
        mover(mb, dt) {
          mb.x = clamp(W / 2 + Math.sin(mb.faseT * 0.6) * W * 0.3, mb.r * 0.7, W - mb.r * 0.7);
          mb.y = mb.baseY + Math.sin(mb.faseT * 1.0) * 18;
        },
        ataques: [
          { cd: [4.5, 5.5],
            fn(mb) { spawnFormacion("dron_ataque", 3, "V"); sfx("ene_misil", { tono: 1.1 }); } },
          { cd: [2.4, 3.0], avisa: 0.4,
            telegrafo(mb) { const a = haciaJugador(mb); telegrafo("cono", { x: mb.x, y: mb.y, a1: a - 0.45, a2: a + 0.45, r: 900, life: 0.4, sigue: mb, col: "#ffb020" }); },
            fn(mb) { PATRONES.rafaga(mb.x, mb.y, haciaJugador(mb), 360, 6, 0.12, 7); sfx("ene_misil"); mb.recoil = 9; } },
          { cd: [3.6, 4.4], avisa: 0.55,
            telegrafo(mb) { telegrafo("banda", { y: H * 0.4, h: 60, life: 0.55, col: "#ffb020" }); },
            fn(mb) { PATRONES.barrido(mb.x, mb.y, 0.25, Math.PI - 0.25, 265, 9, 6); sfx("ene_misil", { tono: 0.65 }); } },
        ] },
      // F3 (~30%) — pierde defensas: modo berserk
      { umbral: 0.3, ojo: "#ff2f2f", furia: true, final: true,
        alEntrar(mb) { mb.pods.izq.vivo = false; mb.pods.der.vivo = false; },
        mover(mb, dt) {
          mb.x = clamp(W / 2 + Math.sin(mb.faseT * 0.9) * W * 0.32, mb.r * 0.7, W - mb.r * 0.7);
          mb.y = mb.baseY + Math.sin(mb.faseT * 1.6) * 24;
        },
        ataques: [
          { cd: [1.5, 1.9], avisa: 0.32,
            telegrafo(mb) { const a = haciaJugador(mb); telegrafo("cono", { x: mb.x, y: mb.y, a1: a - 0.6, a2: a + 0.6, r: 900, life: 0.32, sigue: mb, col: "#ff2f2f" }); },
            fn(mb) { PATRONES.abanico(mb.x, mb.y, haciaJugador(mb), 380, 8, 0.17, 7); sfx("ene_barrido"); mb.recoil = 11; } },
          { cd: [3.2, 3.8], avisa: 0.5,
            telegrafo(mb) { telegrafo("anillo", { x: mb.x, y: mb.y, r: mb.r * 2.8, life: 0.5, sigue: mb, col: "#ff2f2f" }); },
            fn(mb) { PATRONES.circulo(mb.x, mb.y, 260, 16, mb.faseT, 6); sfx("ene_mortero", { tono: 0.6 }); } },
        ] },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  SINGULARITY WARDEN — jefe de M7, GRAVITY COLLAPSE
  //  Identidad: gravedad como herramienta, no decoración. Usa el
  //  sistema de pozos[] de la propia misión — TELEGRAPH → FORMATION →
  //  ACTIVE → COLLAPSE → CLEAR — para tirar del jugador con fuerza
  //  acotada, nunca para quitarle el control.
  // ══════════════════════════════════════════════════════════
  singularity_warden: {
    r: 66, hpMax: 860, nombre: "SINGULARITY WARDEN", titulo: "CENTINELA DE LA SINGULARIDAD",
    sp: "bs_singularity_warden", color: () => "#b45cff",
    puntos: 6200, drops: ["arma", "escudo", "escudo", "vida", "bomba"],
    onSpawn(mb) { mb.orbitadores = null; },
    onEntrada(mb) {
      if (Math.random() < 0.4) part(mb.x + rand(-mb.r, mb.r), mb.y + rand(-20, 60), rand(-15, 15), rand(30, 90), 0.5, "#d9a5ff", rand(2, 4));
    },
    reduccionDano(mb) { return mb.orbitadores && mb.orbitadores.length ? 0.6 : 1; },
    onMuerte(mb) { pozos.length = 0; mb.orbitadores = []; },
    onDetonar(mb) { onda(mb.x, mb.y, "#b45cff", mb.r * 16, 1.2); },
    fases: [
      // F1 — orbes gravitatorios telegrafiados
      { umbral: 1, ojo: "#b45cff",
        mover(mb, dt) {
          mb.x = clamp(W / 2 + Math.sin(mb.faseT * 0.45) * W * 0.26, mb.r * 0.7, W - mb.r * 0.7);
          mb.y = mb.baseY + Math.sin(mb.faseT * 0.7) * 14;
        },
        ataques: [
          { cd: [3.4, 4.0],
            fn(mb) { spawnPozo(clamp(player.x + rand(-90, 90), 90, W - 90), H * 0.48, 150, 130, 3.0); sfx("gravedad_forma"); } },
          { cd: [2.2, 2.7], avisa: 0.4,
            telegrafo(mb) { const a = haciaJugador(mb); telegrafo("cono", { x: mb.x, y: mb.y, a1: a - 0.4, a2: a + 0.4, r: 900, life: 0.4, sigue: mb, col: "#b45cff" }); },
            fn(mb) { PATRONES.abanico(mb.x, mb.y, haciaJugador(mb), 250, 5, 0.19, 6); sfx("ene_barrido", { tono: 0.8 }); } },
        ] },
      // F2 (~60%) — orbitadores propios + proyectiles con guiado suave
      { umbral: 0.6, ojo: "#8a3fd6", furia: true,
        alEntrar(mb) { crearOrbitadores(mb, 4); },
        mover(mb, dt) {
          mb.x = clamp(W / 2 + Math.sin(mb.faseT * 0.6) * W * 0.28, mb.r * 0.7, W - mb.r * 0.7);
          mb.y = mb.baseY + Math.sin(mb.faseT * 1.1) * 18;
          if (mb.orbitadores) for (const o of mb.orbitadores) o.ang += o.velAng * dt;
        },
        dibujarExtra(mb) {
          if (!mb.orbitadores) return;
          const sp = SPRITES["hz_cristal"];
          for (const o of mb.orbitadores) {
            const ox = mb.x + Math.cos(o.ang) * o.radio, oy = mb.y + Math.sin(o.ang) * o.radio;
            ctx.save(); ctx.translate(ox, oy); ctx.rotate(o.ang * 2);
            if (sp) { ctx.shadowColor = "#b45cff"; ctx.shadowBlur = 8; pintarSprite(sp, o.r * 2.4); ctx.shadowBlur = 0; }
            ctx.restore();
          }
        },
        ataques: [
          { cd: [2.6, 3.2],
            fn(mb) { spawnPozo(clamp(mb.x + rand(-200, 200), 90, W - 90), H * 0.5, 130, 110, 2.6); } },
          { cd: [2.0, 2.5], avisa: 0.35,
            telegrafo(mb) { const a = haciaJugador(mb); telegrafo("cono", { x: mb.x, y: mb.y, a1: a - 0.5, a2: a + 0.5, r: 900, life: 0.35, sigue: mb, col: "#8a3fd6" }); },
            fn(mb) {
              const a = haciaJugador(mb);
              for (let i = -1; i <= 1; i++) eBala(mb.x, mb.y, Math.cos(a + i * 0.3) * 250, Math.sin(a + i * 0.3) * 250, 6, { guiaEne: 1.4 });
              sfx("ene_misil", { tono: 0.7 });
            } },
        ] },
      // F3 (~30%) — BLACK HOLE COLLAPSE: espectacular, siempre esquivable
      { umbral: 0.3, ojo: "#ffffff", furia: true, final: true,
        alEntrar(mb) { mb.orbitadores = null; },
        mover(mb, dt) {
          mb.x = clamp(W / 2 + Math.sin(mb.faseT * 0.5) * W * 0.2, mb.r * 0.7, W - mb.r * 0.7);
          mb.y = mb.baseY;
        },
        ataques: [
          { cd: [2.0, 2.4], avisa: 0.4,
            telegrafo(mb) { const a = haciaJugador(mb); telegrafo("cono", { x: mb.x, y: mb.y, a1: a - 0.5, a2: a + 0.5, r: 900, life: 0.4, sigue: mb, col: "#ffffff" }); },
            fn(mb) { PATRONES.rafaga(mb.x, mb.y, haciaJugador(mb), 370, 6, 0.12, 6); sfx("ene_pesado"); mb.recoil = 9; } },
          { cd: [5.2, 6.2], avisa: 1.1,
            telegrafo(mb) { telegrafo("anillo", { x: W / 2, y: H * 0.46, r: 260, life: 1.1, col: "#ffffff" }); },
            fn(mb) {
              texto(W / 2, H * 0.3, "COLAPSO GRAVITATORIO", "#ffffff", 15);
              spawnPozo(W / 2, H * 0.46, 240, 190, 2.6);
              PATRONES.circulo(mb.x, mb.y, 220, 14, mb.faseT, 6);
              sfx("gravedad_colapso"); sacudir("medium"); hitstop(0.04);
            } },
        ] },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  PYRE LORD — jefe de M8, INFERNO
  //  Identidad: velocidad, calor, agresividad. Su firma es OVERHEAT: un
  //  núcleo que se abre a intervalos y encaja 40% más de daño mientras
  //  dura — riesgo/recompensa explícito, no un simple cronómetro.
  // ══════════════════════════════════════════════════════════
  pyre_lord: {
    r: 70, hpMax: 780, nombre: "PYRE LORD", titulo: "SEÑOR DE LA PIRA",
    sp: "bs_pyre_lord", color: () => "#ff3d1a",
    puntos: 7000, drops: ["arma", "arma", "escudo", "vida", "bomba"],
    onSpawn(mb) { mb.overheat = 0; },
    onEntrada(mb) {
      if (Math.random() < 0.5) part(mb.x + rand(-mb.r, mb.r), mb.y + rand(-20, 70), rand(-25, 25), rand(60, 150), 0.4, "#ff6a1f", rand(2, 4));
    },
    reduccionDano(mb) { return mb.overheat > 0 ? 1.4 : 0.8; },
    onMuerte(mb) { carriles.length = 0; mb.overheat = 0; },
    onDetonar(mb) { for (let i = 0; i < 10; i++) part(mb.x, mb.y, rand(-260, 260), rand(-260, 260), rand(0.4, 0.8), "#ff8a1f", rand(2, 4)); },
    dibujarExtra(mb) {
      if (mb.overheat <= 0) return;
      const p = 0.6 + 0.4 * Math.sin(performance.now() / 60);
      ctx.save(); ctx.translate(mb.x, mb.y);
      ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.6 * p;
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, mb.r * 0.7);
      g.addColorStop(0, "#ffffff"); g.addColorStop(0.4, "#ffcf5c"); g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, mb.r * 0.7, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
      ctx.restore();
    },
    fases: [
      // F1 — armamento pesado
      { umbral: 1, ojo: "#ff3d1a",
        mover(mb, dt) {
          if (mb.overheat > 0) mb.overheat -= dt;
          mb.x = clamp(W / 2 + Math.sin(mb.faseT * 0.5) * W * 0.24, mb.r * 0.7, W - mb.r * 0.7);
          mb.y = mb.baseY + Math.sin(mb.faseT * 0.8) * 14;
        },
        ataques: [
          { cd: [2.0, 2.5], avisa: 0.4,
            telegrafo(mb) { const a = haciaJugador(mb); telegrafo("cono", { x: mb.x, y: mb.y, a1: a - 0.42, a2: a + 0.42, r: 900, life: 0.4, sigue: mb, col: "#ff6a1f" }); },
            fn(mb) { PATRONES.abanico(mb.x, mb.y, haciaJugador(mb), 260, 5, 0.19, 6); sfx("ene_barrido"); mb.recoil = 8; } },
          { cd: [4.6, 5.4], avisa: 0.9,
            telegrafo(mb) { texto(mb.x, mb.y - mb.r - 26, "OVERHEAT", "#ffcf5c", 14); },
            fn(mb) { mb.overheat = 2.6; sfx("core_offline", { tono: 1.4 }); sacudir("tiny"); } },
        ] },
      // F2 (~65%) — lanes de fuego
      { umbral: 0.65, ojo: "#ff8a1f", furia: true,
        mover(mb, dt) {
          if (mb.overheat > 0) mb.overheat -= dt;
          mb.x = clamp(W / 2 + Math.sin(mb.faseT * 0.7) * W * 0.3, mb.r * 0.7, W - mb.r * 0.7);
          mb.y = mb.baseY + Math.sin(mb.faseT * 1.2) * 20;
        },
        ataques: [
          { cd: [3.4, 4.0],
            fn(mb) { spawnCarril(rand(H * 0.3, H * 0.68), 76, 2.0); sfx("fuego_ignicion"); } },
          { cd: [1.9, 2.4], avisa: 0.32,
            telegrafo(mb) { const a = haciaJugador(mb); telegrafo("cono", { x: mb.x, y: mb.y, a1: a - 0.5, a2: a + 0.5, r: 900, life: 0.32, sigue: mb, col: "#ff8a1f" }); },
            fn(mb) { PATRONES.rafaga(mb.x, mb.y, haciaJugador(mb), 350, 6, 0.12, 6); sfx("ene_pesado", { tono: 0.85 }); mb.recoil = 9; } },
          { cd: [5.2, 6.0], avisa: 0.9,
            telegrafo(mb) { texto(mb.x, mb.y - mb.r - 26, "OVERHEAT", "#ffcf5c", 14); },
            fn(mb) { mb.overheat = 2.8; sfx("core_offline", { tono: 1.4 }); sacudir("tiny"); } },
        ] },
      // F3 (~30%) — núcleo sobrecalentado permanente: máxima agresividad
      { umbral: 0.3, ojo: "#ffffff", furia: true, final: true,
        alEntrar(mb) { mb.overheat = 999; texto(W / 2, H * 0.32, "NÚCLEO ABIERTO", "#ffffff", 16); },
        mover(mb, dt) {
          mb.x = clamp(W / 2 + Math.sin(mb.faseT * 1.0) * W * 0.3, mb.r * 0.7, W - mb.r * 0.7);
          mb.y = mb.baseY + Math.sin(mb.faseT * 1.8) * 24;
        },
        ataques: [
          { cd: [1.5, 1.9], avisa: 0.3,
            telegrafo(mb) { const a = haciaJugador(mb); telegrafo("cono", { x: mb.x, y: mb.y, a1: a - 0.58, a2: a + 0.58, r: 900, life: 0.3, sigue: mb, col: "#ffffff" }); },
            fn(mb) { PATRONES.abanico(mb.x, mb.y, haciaJugador(mb), 400, 7, 0.16, 6); sfx("ene_barrido"); mb.recoil = 10; } },
          { cd: [3.0, 3.6],
            fn(mb) { spawnCarril(rand(H * 0.28, H * 0.7), 90, 1.8); sfx("fuego_ignicion", { tono: 1.2 }); } },
        ] },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  CORE ARCHITECT — jefe de M9, ENEMY CORE
  //  Identidad: inteligente, artificial. Se teletransporta y orienta su
  //  barrido hacia donde el jugador tiene MÁS sitio — parece adaptarse,
  //  nunca dispara con puntería perfecta.
  // ══════════════════════════════════════════════════════════
  core_architect: {
    r: 64, hpMax: 1150, nombre: "CORE ARCHITECT", titulo: "ARQUITECTO DEL NÚCLEO",
    sp: "bs_core_architect", color: () => "#5cc8ff",
    puntos: 7800, drops: ["arma", "arma", "escudo", "vida", "bomba"],
    onEntrada(mb) {
      if (Math.random() < 0.4) part(mb.x + rand(-mb.r, mb.r), mb.y + rand(-20, 50), rand(-15, 15), rand(30, 80), 0.4, "#5cc8ff", rand(1.5, 3));
    },
    onDetonar(mb) { onda(mb.x, mb.y, "#5cc8ff", mb.r * 12, 1.0); },
    reduccionDano(mb) { return mb.fase >= 2 ? 1.3 : 1; },   // F3: núcleo expuesto, encaja más
    fases: [
      // F1 — defensas geométricas: simétrico, preciso, técnico
      { umbral: 1, ojo: "#5cc8ff",
        mover(mb, dt) {
          mb.x = clamp(W / 2 + Math.sin(mb.faseT * 0.5) * W * 0.24, mb.r * 0.7, W - mb.r * 0.7);
          mb.y = mb.baseY + Math.sin(mb.faseT * 0.7) * 12;
        },
        ataques: [
          { cd: [2.6, 3.2], avisa: 0.5,
            telegrafo(mb) { telegrafo("anillo", { x: mb.x, y: mb.y, r: mb.r * 2.6, life: 0.5, sigue: mb, col: "#5cc8ff" }); },
            fn(mb) { PATRONES.circulo(mb.x, mb.y, 240, 12, mb.faseT, 6); sfx("aegis_lock", { tono: 0.4 }); } },
          { cd: [2.0, 2.5], avisa: 0.38,
            telegrafo(mb) { const a = haciaJugador(mb); telegrafo("cono", { x: mb.x, y: mb.y, a1: a - 0.35, a2: a + 0.35, r: 900, life: 0.38, sigue: mb, col: "#5cc8ff" }); },
            fn(mb) { PATRONES.abanico(mb.x, mb.y, haciaJugador(mb), 270, 5, 0.17, 6); sfx("ene_mortero", { tono: 0.9 }); } },
        ] },
      // F2 (~65%) — teleport + barrido "adaptativo": siempre hacia el
      // lado con más sitio, para que parezca inteligente sin ser injusto
      { umbral: 0.65, ojo: "#3fa8ff", furia: true,
        mover(mb, dt) {
          mb.y = mb.baseY + Math.sin(mb.faseT * 0.9) * 16;
        },
        ataques: [
          { cd: [3.2, 3.8],
            fn(mb) {
              vfx("emp", mb.x, mb.y, mb.r * 4, 0.3);
              mb.x = clamp(player.x + (player.x < W / 2 ? 160 : -160), mb.r, W - mb.r);
              vfx("anillo", mb.x, mb.y, mb.r * 3, 0.3);
              sfx("aegis_lock");
            } },
          { cd: [2.4, 2.9], avisa: 0.45,
            telegrafo(mb) {
              const haciaAmplio = player.x < W / 2 ? [0.2, Math.PI - 0.2] : [Math.PI - 0.2, 0.2];
              telegrafo("cono", { x: mb.x, y: mb.y, a1: Math.min(...haciaAmplio), a2: Math.max(...haciaAmplio), r: 900, life: 0.45, col: "#3fa8ff" });
            },
            fn(mb) {
              const dir = player.x < W / 2 ? [0.25, Math.PI - 0.25] : [Math.PI - 0.25, 0.25];
              PATRONES.barrido(mb.x, mb.y, dir[0], dir[1], 260, 8, 6);
              sfx("ene_barrido", { tono: 0.75 });
            } },
        ] },
      // F3 (~30%) — core expuesto: pierde el blindaje exterior
      { umbral: 0.3, ojo: "#ffffff", furia: true, final: true,
        mover(mb, dt) {
          mb.x = clamp(W / 2 + Math.sin(mb.faseT * 0.8) * W * 0.28, mb.r * 0.7, W - mb.r * 0.7);
          mb.y = mb.baseY + Math.sin(mb.faseT * 1.5) * 20;
        },
        ataques: [
          { cd: [1.7, 2.1], avisa: 0.32,
            telegrafo(mb) { const a = haciaJugador(mb); telegrafo("cono", { x: mb.x, y: mb.y, a1: a - 0.55, a2: a + 0.55, r: 900, life: 0.32, sigue: mb, col: "#ffffff" }); },
            fn(mb) { PATRONES.rafaga(mb.x, mb.y, haciaJugador(mb), 380, 6, 0.12, 6); sfx("ene_pesado"); mb.recoil = 9; } },
          { cd: [3.4, 4.0], avisa: 0.55,
            telegrafo(mb) { telegrafo("anillo", { x: mb.x, y: mb.y, r: mb.r * 2.8, life: 0.55, sigue: mb, col: "#ffffff" }); },
            fn(mb) { PATRONES.circulo(mb.x, mb.y, 250, 16, mb.faseT, 6); sfx("aegis_lock", { tono: 0.5 }); } },
        ] },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  OMEGA SOVEREIGN — jefe final, M10 FINAL STRIKE
  //  El asset más elegante de toda la biblioteca sin usar, para que
  //  contraste con los siete jefes anteriores: todos cálidos u oscuros,
  //  éste blanco-azulado y transcendente. 4 fases, muerte épica (d.epico
  //  alarga la cinemática compartida en vez de duplicarla), y un tramo
  //  final que combina — simplificadas y de una en una, nunca las tres a
  //  la vez — las tres firmas de la segunda mitad: gravedad, calor,
  //  tóxico.
  // ══════════════════════════════════════════════════════════
  omega_sovereign: {
    r: 92, hpMax: 1400, nombre: "OMEGA SOVEREIGN", titulo: "SOBERANO DEL VACÍO",
    sp: "bs_omega_sovereign", color: () => "#d8dcff",
    puntos: 25000, drops: ["arma", "arma", "escudo", "escudo", "vida", "vida", "bomba", "bomba"],
    epico: true,
    onSpawn(mb) {
      const r = mb.r;
      mb.subs = [
        { id: "arma_izq",  ox: -r * 1.5, oy: r * 0.2, hp: 22, hpMax: 22, vivo: true, nombre: "ARMA LATERAL", col: "#ff8a1f" },
        { id: "escudo_gen",ox: 0,        oy: -r * 0.9, hp: 26, hpMax: 26, vivo: true, nombre: "GENERADOR DE ESCUDO", col: "#5cc8ff" },
        { id: "arma_der",  ox: r * 1.5,  oy: r * 0.2, hp: 22, hpMax: 22, vivo: true, nombre: "ARMA LATERAL", col: "#ff8a1f" },
      ];
      mb.vacioIdx = -1;
    },
    onEntrada(mb) {
      if (Math.random() < 0.5) part(mb.x + rand(-mb.r * 1.4, mb.r * 1.4), mb.y + rand(-30, 90), rand(-20, 20), rand(40, 130), 0.5, "#c8ceff", rand(2, 4));
    },
    reduccionDano(mb) {
      const vivos = mb.subs.filter(s => s.vivo).length;
      return 1 - vivos * 0.12;   // cada subsistema vivo protege un poco
    },
    dibujarExtra(mb) {
      for (const s of mb.subs) {
        if (!s.vivo) continue;
        const sx = mb.x + s.ox, sy = mb.y + s.oy;
        const p = 0.5 + 0.5 * Math.sin(performance.now() / 150);
        ctx.save(); ctx.translate(sx, sy);
        ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.35 + p * 0.2;
        ctx.fillStyle = s.col; ctx.beginPath(); ctx.arc(0, 0, 11, 0, TAU); ctx.fill();
        ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
        ctx.strokeStyle = s.col; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(0, 0, 11, 0, TAU); ctx.stroke();
        ctx.restore();
        const bw = 26, bh = 3, bx = sx - bw / 2, by = sy - 20;
        ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
        ctx.fillStyle = s.col; ctx.fillRect(bx, by, bw * (s.hp / s.hpMax), bh);
      }
    },
    onMuerte(mb) {
      for (const s of mb.subs) if (s.vivo) { s.vivo = false; boom(mb.x + s.ox, mb.y + s.oy, s.col, 14, 1); }
      pozos.length = 0; carriles.length = 0; zonas.length = 0;
    },
    onDetonar(mb) {
      for (let i = 0; i < 16; i++) { const a = rand(0, TAU); part(mb.x, mb.y, Math.cos(a) * rand(140, 380), Math.sin(a) * rand(140, 380), rand(0.5, 1.0), "#d8dcff", rand(2, 4)); }
      onda(mb.x, mb.y, "#8a3fd6", mb.r * 18, 1.4);
    },
    fases: [
      // F1 (100%) — DOMINANCE: ataques claros y potentes, nada de caos aún
      { umbral: 1, ojo: "#d8dcff",
        mover(mb, dt) {
          mb.x = clamp(W / 2 + Math.sin(mb.faseT * 0.4) * W * 0.22, mb.r * 0.65, W - mb.r * 0.65);
          mb.y = mb.baseY + Math.sin(mb.faseT * 0.6) * 10;
        },
        ataques: [
          { cd: [2.4, 3.0], avisa: 0.48,
            telegrafo(mb) { const a = haciaJugador(mb); telegrafo("cono", { x: mb.x, y: mb.y, a1: a - 0.4, a2: a + 0.4, r: 1000, life: 0.48, sigue: mb }); },
            fn(mb) { PATRONES.rafaga(mb.x, mb.y, haciaJugador(mb), 320, 6, 0.13, 7); sfx("ene_pesado"); mb.recoil = 9; } },
          { cd: [3.6, 4.2], avisa: 0.55,
            telegrafo(mb) { telegrafo("anillo", { x: mb.x, y: mb.y, r: mb.r * 2.6, life: 0.55, sigue: mb }); },
            fn(mb) { PATRONES.abanico(mb.x, mb.y, haciaJugador(mb), 260, 7, 0.16, 6); sfx("ene_barrido", { tono: 0.8 }); } },
          { cd: [6.0, 7.0],
            fn(mb) { spawnFormacion("dron_ataque", 3, "pinza"); sfx("ene_misil", { tono: 1.1 }); } },
        ] },
      // F2 (~70%) — SYSTEM BREAK: subsistemas al descubierto
      { umbral: 0.7, ojo: "#ff8a1f", furia: true,
        mover(mb, dt) {
          mb.x = clamp(W / 2 + Math.sin(mb.faseT * 0.55) * W * 0.28, mb.r * 0.65, W - mb.r * 0.65);
          mb.y = mb.baseY + Math.sin(mb.faseT * 1.0) * 16;
          actualizarSubsOmega(mb, dt);
        },
        ataques: [
          { cd: [3.0, 3.6], avisa: 0.4,
            telegrafo(mb) { if (mb.subs[0].vivo) telegrafo("cono", { x: mb.x + mb.subs[0].ox, y: mb.y + mb.subs[0].oy, a1: Math.PI / 2 - 0.4, a2: Math.PI / 2 + 0.4, r: 800, life: 0.4, col: "#ff8a1f" }); },
            fn(mb) { if (mb.subs[0].vivo) { PATRONES.abanico(mb.x + mb.subs[0].ox, mb.y + mb.subs[0].oy, Math.PI / 2, 250, 4, 0.2, 6); sfx("ene_barrido"); } } },
          { cd: [3.0, 3.6], avisa: 0.4,
            telegrafo(mb) { if (mb.subs[2].vivo) telegrafo("cono", { x: mb.x + mb.subs[2].ox, y: mb.y + mb.subs[2].oy, a1: Math.PI / 2 - 0.4, a2: Math.PI / 2 + 0.4, r: 800, life: 0.4, col: "#ff8a1f" }); },
            fn(mb) { if (mb.subs[2].vivo) { PATRONES.abanico(mb.x + mb.subs[2].ox, mb.y + mb.subs[2].oy, Math.PI / 2, 250, 4, 0.2, 6); sfx("ene_barrido", { tono: 0.9 }); } } },
          { cd: [2.2, 2.7], avisa: 0.35,
            telegrafo(mb) { const a = haciaJugador(mb); telegrafo("cono", { x: mb.x, y: mb.y, a1: a - 0.5, a2: a + 0.5, r: 1000, life: 0.35, sigue: mb, col: "#ff8a1f" }); },
            fn(mb) { PATRONES.rafaga(mb.x, mb.y, haciaJugador(mb), 350, 6, 0.12, 7); sfx("ene_barrido"); mb.recoil = 9; } },
        ] },
      // F3 (~40%) — VOID MODE: gravedad/tóxico/calor simplificados,
      // uno detrás de otro, nunca los tres a la vez.
      { umbral: 0.4, ojo: "#8a3fd6", furia: true,
        alEntrar(mb) {
          texto(W / 2, H * 0.3, "MODO VACÍO", "#8a3fd6", 20);
          flash = Math.max(flash, 0.5); sfx("emp");
        },
        mover(mb, dt) {
          mb.x = clamp(W / 2 + Math.sin(mb.faseT * 0.7) * W * 0.3, mb.r * 0.65, W - mb.r * 0.65);
          mb.y = mb.baseY + Math.sin(mb.faseT * 1.3) * 22;
          actualizarSubsOmega(mb, dt);
        },
        ataques: [
          { cd: [2.2, 2.6], avisa: 0.4,
            telegrafo(mb) { const a = haciaJugador(mb); telegrafo("cono", { x: mb.x, y: mb.y, a1: a - 0.5, a2: a + 0.5, r: 1000, life: 0.4, sigue: mb, col: "#8a3fd6" }); },
            fn(mb) { PATRONES.abanico(mb.x, mb.y, haciaJugador(mb), 340, 7, 0.15, 7); sfx("ene_barrido", { tono: 0.7 }); mb.recoil = 9; } },
          { cd: [4.5, 5.2],
            fn(mb) {
              mb.vacioIdx = (mb.vacioIdx + 1) % 3;
              if (mb.vacioIdx === 0) { spawnPozo(clamp(player.x, 100, W - 100), H * 0.5, 130, 110, 2.2); sfx("gravedad_forma"); }
              else if (mb.vacioIdx === 1) { spawnCarril(rand(H * 0.3, H * 0.65), 70, 1.8); sfx("fuego_ignicion"); }
              else { venomZona((Math.random() * 3) | 0); }
            } },
        ] },
      // F4 (~15%) — FINAL STRIKE: muy agresivo, y le da al jugador su
      // última bomba justo al entrar — la oportunidad tiene que ser real.
      { umbral: 0.15, ojo: "#ff2f6e", furia: true, final: true,
        alEntrar(mb) {
          texto(W / 2, H * 0.3, "GOLPE FINAL", "#ff2f6e", 22);
          soltarPremio(mb.x, mb.y + 40, "bomba");
          sacudir("heavy");
        },
        mover(mb, dt) {
          mb.x = clamp(W / 2 + Math.sin(mb.faseT * 1.1) * W * 0.34, mb.r * 0.65, W - mb.r * 0.65);
          mb.y = mb.baseY + Math.sin(mb.faseT * 2.0) * 28;
          actualizarSubsOmega(mb, dt);
        },
        ataques: [
          { cd: [1.3, 1.6], avisa: 0.28,
            telegrafo(mb) { const a = haciaJugador(mb); telegrafo("cono", { x: mb.x, y: mb.y, a1: a - 0.62, a2: a + 0.62, r: 1000, life: 0.28, sigue: mb, col: "#ff2f6e" }); },
            fn(mb) { PATRONES.abanico(mb.x, mb.y, haciaJugador(mb), 410, 9, 0.15, 7); sfx("ene_barrido"); mb.recoil = 12; } },
          { cd: [3.2, 3.8], avisa: 0.6,
            telegrafo(mb) { telegrafo("anillo", { x: mb.x, y: mb.y, r: mb.r * 3, life: 0.6, sigue: mb, col: "#ff2f6e" }); },
            fn(mb) { PATRONES.espiral(mb.x, mb.y, 300, 22, mb.faseT * 3, 5, 3); sfx("ultimate", { tono: 0.5 }); } },
        ] },
    ],
  },

  // ════════════════════════════════════════════════════════════
  //  MINIJEFES DE LA EXPANSIÓN (bloque 5F) — M11, M13, M15, M17, M19
  // ════════════════════════════════════════════════════════════
  //  Van en esta misma tabla, con `fn:"miniboss"` como los diez de
  //  arriba: un minijefe no es un sistema aparte, es una entrada con
  //  menos vida (280-360, contra 560-1300) y menos fases (2, no 2-4).
  //  Cada uno usa el hazard o la primitiva de SU mundo (bloque 5D) o el
  //  enemigo de SU mundo (bloque 5E) — nada nuevo, todo reutilizado:
  //
  //    cazador_polar   témpano          (5D, hielo)
  //    unidad_control  trafico + columna (5D, megaciudad)
  //    guardian_ruina  oscuridad + mina_bio (5D/5E, abismo)
  //    yunque_movil    columna "colada" (5D, fragua)
  //    heraldo_grieta  ruptura + fragmento (5D, grieta)
  //
  //  Radio más pequeño que cualquiera de los diez jefes (44-52, contra
  //  62-92) y sin `furia` en la fase 1: es la misma palanca que ya usa
  //  el motor para "esto pesa menos", no una nueva.

  // ── CAZADOR POLAR — M11, hielo ─────────────────────────
  //  Se cubre detrás de un témpano que él mismo suelta: mientras el
  //  témpano siga en pie cerca de él, el daño que recibe se reduce a la
  //  mitad. Romper la cobertura —o rodearla— es la mitad del combate.
  cazador_polar: {
    mundo: "hielo",
    r: 44, hpMax: 300, nombre: "CAZADOR POLAR", titulo: "DEPREDADOR DE LA ESCARCHA",
    sp: "bs_cazador_polar", color: () => "#bfe9ff",
    puntos: 2200, drops: ["arma", "escudo", "vida"],
    onSpawn(mb) { mb.tempanos = 0; },
    onEntrada(mb) {
      if (Math.random() < 0.4) part(mb.x + rand(-mb.r, mb.r), mb.y + rand(-20, 60), rand(-20, 20), rand(40, 110), 0.45, "#bfe9ff", rand(2, 4));
    },
    // Cobertura de verdad: mientras un témpano siga vivo cerca de él,
    // media vida menos. Cuando lo revientan, vuelve a encajar entero.
    reduccionDano(mb) {
      for (const h of hazards) {
        if (h.tipo !== "tempano") continue;
        const dx = h.x - mb.x, dy = h.y - mb.y;
        if (dx * dx + dy * dy < (mb.r + h.r + 46) ** 2) return 0.5;
      }
      return 1;
    },
    onMuerte(mb) {
      for (let i = hazards.length - 1; i >= 0; i--) if (hazards[i].tipo === "tempano") hazards.splice(i, 1);
    },
    fases: [
      // F1 — barridos diagonales, se cubre con un témpano de vez en cuando
      { umbral: 1, ojo: "#bfe9ff",
        mover(mb, dt) {
          // Diagonal, no seno de siempre: entra por una esquina alta,
          // cruza a la contraria y vuelve. Se lee como un barrido, no
          // como una flotación.
          const t = (Math.sin(mb.faseT * 0.5) + 1) / 2;
          mb.x = clamp(mb.r + t * (W - mb.r * 2), mb.r, W - mb.r);
          mb.y = mb.baseY + Math.sin(mb.faseT * 0.9) * 20;
        },
        ataques: [
          { cd: [2.1, 2.7], avisa: 0.38,
            telegrafo(mb) { const a = haciaJugador(mb); telegrafo("cono", { x: mb.x, y: mb.y, a1: a - 0.36, a2: a + 0.36, r: 850, life: 0.38, sigue: mb, col: "#bfe9ff" }); },
            fn(mb) { PATRONES.abanico(mb.x, mb.y, haciaJugador(mb), 250, 4, 0.2, 6); sfx("ene_disparo", { tono: 0.75 }); mb.recoil = 6; } },
          { cd: [3.6, 4.4], avisa: 0.4,
            telegrafo(mb) { telegrafo("anillo", { x: mb.x, y: mb.y + mb.r + 40, r: 44, life: 0.4, col: "#bfe9ff" }); },
            fn(mb) {
              // Se guarda y se devuelve el tipo global en el mismo tick,
              // igual que hace unidad_control con "trafico": si la
              // misión tenía su propia lluvia de hazards puesta, sigue
              // siendo la suya después de este ataque.
              const antesTipo = hazardTipo;
              hazardTipo = "tempano";
              const antes = hazards.length;
              spawnHazard();
              hazardTipo = antesTipo;
              if (hazards.length > antes) { const h = hazards[hazards.length - 1]; h.x = mb.x; h.y = mb.y + mb.r + 40; h.vx = 0; h.vy = 30; h.warnT = 0; mb.tempanos++; }
              sfx("gravedad_forma", { vol: 0.5 });
            } },
        ] },
      // F2 (~55%) — más rápido, cobertura más frecuente
      { umbral: 0.55, ojo: "#ffffff", furia: true,
        mover(mb, dt) {
          const t = (Math.sin(mb.faseT * 0.85) + 1) / 2;
          mb.x = clamp(mb.r + t * (W - mb.r * 2), mb.r, W - mb.r);
          mb.y = mb.baseY + Math.sin(mb.faseT * 1.4) * 30;
        },
        ataques: [
          { cd: [1.5, 1.9], avisa: 0.3,
            telegrafo(mb) { const a = haciaJugador(mb); telegrafo("cono", { x: mb.x, y: mb.y, a1: a - 0.4, a2: a + 0.4, r: 850, life: 0.3, sigue: mb, col: "#ffffff" }); },
            fn(mb) { PATRONES.abanico(mb.x, mb.y, haciaJugador(mb), 290, 5, 0.18, 6); sfx("ene_disparo", { tono: 0.9 }); mb.recoil = 7; } },
          { cd: [2.6, 3.2], avisa: 0.4,
            telegrafo(mb) { telegrafo("anillo", { x: mb.x, y: mb.y + mb.r + 40, r: 44, life: 0.4, col: "#bfe9ff" }); },
            fn(mb) {
              const antesTipo = hazardTipo;
              hazardTipo = "tempano";
              const antes = hazards.length;
              spawnHazard();
              hazardTipo = antesTipo;
              if (hazards.length > antes) { const h = hazards[hazards.length - 1]; h.x = mb.x; h.y = mb.y + mb.r + 40; h.vx = 0; h.vy = 34; h.warnT = 0; mb.tempanos++; }
              sfx("gravedad_forma", { vol: 0.5 });
            } },
        ] },
    ],
  },

  // ── UNIDAD DE CONTROL — M13, megaciudad ────────────────
  //  Manda sobre el tráfico y sobre dos barreras de energía ("cruces")
  //  que abre a los lados. En fase 2 abre las dos a la vez y más
  //  seguido: el mismo tráfico, con más prisa.
  unidad_control: {
    mundo: "megaciudad",
    r: 48, hpMax: 315, nombre: "UNIDAD DE CONTROL", titulo: "COORDINADOR DE TRÁFICO Y DEFENSA",
    sp: "bs_unidad_control", color: t => t.nave,
    puntos: 2400, drops: ["arma", "escudo", "vida"],
    onEntrada(mb) {
      if (Math.random() < 0.4) part(mb.x + rand(-mb.r, mb.r), mb.y + rand(-20, 60), rand(-20, 20), rand(50, 130), 0.4, "#5cffd6", rand(2, 4));
    },
    onMuerte(mb) {
      for (let i = hazards.length - 1; i >= 0; i--) if (hazards[i].tipo === "trafico") hazards.splice(i, 1);
    },
    fases: [
      // F1 — ráfagas controladas, tráfico suelto de vez en cuando, un cruce
      { umbral: 1, ojo: "#5cffd6",
        mover(mb, dt) {
          mb.x = clamp(W / 2 + Math.sin(mb.faseT * 0.5) * W * 0.26, mb.r * 0.7, W - mb.r * 0.7);
          mb.y = mb.baseY + Math.sin(mb.faseT * 0.8) * 14;
        },
        ataques: [
          { cd: [2.0, 2.5], avisa: 0.36,
            telegrafo(mb) { const a = haciaJugador(mb); telegrafo("cono", { x: mb.x, y: mb.y, a1: a - 0.32, a2: a + 0.32, r: 850, life: 0.36, sigue: mb, col: "#5cffd6" }); },
            fn(mb) { PATRONES.rafaga(mb.x, mb.y, haciaJugador(mb), 260, 4, 0.13, 6); sfx("ene_laser", { tono: 0.85 }); mb.recoil = 6; } },
          { cd: [3.8, 4.6],
            // Tráfico coordinado: se pide y se devuelve el tipo global
            // de hazard en el mismo tick, así que no se pisa con lo que
            // la misión tuviera puesto.
            fn(mb) { const antes = hazardTipo; hazardTipo = "trafico"; spawnHazard(); spawnHazard(); hazardTipo = antes; sfx("alarma_flota", { vol: 0.4 }); } },
          { cd: [3.2, 3.8], avisa: 0.4,
            // La columna telegrafía sola en cuanto nace (0,95 s de aviso
            // en fase 0, ver bloque 5D): esto es el aviso ANTES de que
            // exista, y entre los dos suma más de un segundo de margen.
            telegrafo(mb) { texto(mb.x, mb.y - mb.r - 24, "CRUCE ABIERTO", "#5cffd6", 13); },
            fn(mb) { spawnColumna(clamp(player.x + rand(-40, 40), 90, W - 90), 96, 1.6, "luz"); } },
        ] },
      // F2 (~55%) — dos cruces a la vez, más tráfico, más ritmo
      { umbral: 0.55, ojo: "#ff5cff", furia: true,
        mover(mb, dt) {
          mb.x = clamp(W / 2 + Math.sin(mb.faseT * 0.7) * W * 0.3, mb.r * 0.7, W - mb.r * 0.7);
          mb.y = mb.baseY + Math.sin(mb.faseT * 1.2) * 20;
        },
        ataques: [
          { cd: [1.5, 1.9], avisa: 0.28,
            telegrafo(mb) { const a = haciaJugador(mb); telegrafo("cono", { x: mb.x, y: mb.y, a1: a - 0.36, a2: a + 0.36, r: 850, life: 0.28, sigue: mb, col: "#ff5cff" }); },
            fn(mb) { PATRONES.rafaga(mb.x, mb.y, haciaJugador(mb), 300, 5, 0.12, 6); sfx("ene_laser", { tono: 1.0 }); mb.recoil = 7; } },
          { cd: [2.6, 3.2],
            fn(mb) { const antes = hazardTipo; hazardTipo = "trafico"; spawnHazard(); spawnHazard(); spawnHazard(); hazardTipo = antes; sfx("alarma_flota", { vol: 0.5 }); } },
          { cd: [2.6, 3.2], avisa: 0.35,
            telegrafo(mb) { texto(mb.x, mb.y - mb.r - 24, "DOS CRUCES", "#ff5cff", 13); },
            fn(mb) {
              spawnColumna(clamp(W * 0.28, 90, W - 90), 90, 1.4, "luz");
              spawnColumna(clamp(W * 0.72, 90, W - 90), 90, 1.4, "luz");
            } },
        ] },
    ],
  },

  // ── GUARDIÁN DE RUINA — M15, abismo ────────────────────
  //  Vive protegido por su propia oscuridad —daño reducido— y solo se
  //  ilumina, vulnerable del todo, cuando ataca. El telégrafo, el
  //  ataque y la ventana de vida son la misma cosa, como en medusa (5E),
  //  a escala de jefe.
  guardian_ruina: {
    mundo: "abismo",
    r: 47, hpMax: 320, nombre: "GUARDIÁN DE RUINA", titulo: "CENTINELA BIOMECÁNICO DE LAS PROFUNDIDADES",
    sp: "bs_guardian_ruina", color: () => "#57e3c9",
    puntos: 2500, drops: ["arma", "escudo", "vida", "bomba"],
    onSpawn(mb) { mb.pulsoT = 0; },
    onEntrada(mb) {
      if (Math.random() < 0.4) part(mb.x + rand(-mb.r, mb.r), mb.y + rand(-20, 60), rand(-15, 15), rand(30, 90), 0.5, "#57e3c9", rand(2, 4));
    },
    // Nivel de oscuridad MODESTO a propósito: usa el velo del bloque
    // 5D, pero lo bastante bajo para que el propio jefe —que se dibuja
    // ANTES del velo, como cualquier enemigo— siga leyéndose encima.
    reduccionDano(mb) { return mb.pulsoT > 0 ? 1 : 0.4; },
    onMuerte(mb) {
      oscurecer(0, 0);
      for (let i = hazards.length - 1; i >= 0; i--) if (hazards[i].tipo === "mina_bio") hazards.splice(i, 1);
    },
    fases: [
      // F1 — oscuridad de fondo, pulsos que abren la vulnerabilidad
      { umbral: 1, ojo: "#57e3c9",
        alEntrar() { oscurecer(0.32, 0); },
        mover(mb, dt) {
          mb.x = clamp(W / 2 + Math.sin(mb.faseT * 0.45) * W * 0.24, mb.r * 0.7, W - mb.r * 0.7);
          mb.y = mb.baseY + Math.sin(mb.faseT * 0.7) * 12;
          if (mb.pulsoT > 0) { mb.pulsoT -= dt; if (mb.pulsoT <= 0) oscurecer(0.32, 0); }
        },
        ataques: [
          { cd: [2.8, 3.4], avisa: 0.4,
            telegrafo(mb) { telegrafo("anillo", { x: mb.x, y: mb.y, r: mb.r * 2.4, life: 0.4, sigue: mb, col: "#57e3c9" }); },
            fn(mb) {
              mb.pulsoT = 0.8;
              oscurecer(0, 0.8);
              sfx("venom_pulso");
              vfx("toxico", mb.x, mb.y, mb.r * 4.5, 0.5);
              PATRONES.circulo(mb.x, mb.y, 150, 7, mb.faseT, 6);
            } },
          { cd: [3.4, 4.2], avisa: 0.35,
            telegrafo(mb) { telegrafo("anillo", { x: clamp(player.x, 60, W - 60), y: H * 0.5, r: 30, life: 0.35, col: "#9dff5a" }); },
            fn(mb) { soltarMinaBio(clamp(player.x + rand(-60, 60), 60, W - 60), H * 0.5); } },
        ] },
      // F2 (~55%) — pulsos más largos y más seguidos
      { umbral: 0.55, ojo: "#ffffff", furia: true,
        mover(mb, dt) {
          mb.x = clamp(W / 2 + Math.sin(mb.faseT * 0.65) * W * 0.28, mb.r * 0.7, W - mb.r * 0.7);
          mb.y = mb.baseY + Math.sin(mb.faseT * 1.1) * 18;
          if (mb.pulsoT > 0) { mb.pulsoT -= dt; if (mb.pulsoT <= 0) oscurecer(0.32, 0); }
        },
        ataques: [
          { cd: [2.0, 2.5], avisa: 0.32,
            telegrafo(mb) { telegrafo("anillo", { x: mb.x, y: mb.y, r: mb.r * 2.4, life: 0.32, sigue: mb, col: "#ffffff" }); },
            fn(mb) {
              mb.pulsoT = 1.0;
              oscurecer(0, 1.0);
              sfx("venom_pulso");
              vfx("toxico", mb.x, mb.y, mb.r * 5, 0.55);
              PATRONES.circulo(mb.x, mb.y, 175, 9, mb.faseT, 6);
            } },
          { cd: [2.6, 3.2], avisa: 0.3,
            telegrafo(mb) { telegrafo("anillo", { x: clamp(player.x, 60, W - 60), y: H * 0.5, r: 30, life: 0.3, col: "#9dff5a" }); },
            fn(mb) { soltarMinaBio(clamp(player.x + rand(-70, 70), 60, W - 60), H * 0.46); } },
        ] },
    ],
  },

  // ── YUNQUE MÓVIL — M17, fragua ─────────────────────────
  //  Masa pesada: se desplaza despacio y ataca con golpes de zona
  //  telegrafiados, no con lluvia de balas. Se coloca sobre su propia
  //  colada cuando puede: de pie sobre la lava, encaja menos daño.
  yunque_movil: {
    mundo: "fragua",
    r: 52, hpMax: 335, nombre: "YUNQUE MÓVIL", titulo: "MASA DE FORJA AUTOPROPULSADA",
    sp: "bs_yunque_movil", color: () => "#ff8a1f",
    puntos: 2700, drops: ["arma", "escudo", "vida", "bomba"],
    onEntrada(mb) {
      if (Math.random() < 0.45) part(mb.x + rand(-mb.r, mb.r), mb.y + rand(-20, 70), rand(-20, 20), rand(50, 140), 0.4, "#ff8a1f", rand(2, 4));
    },
    // De pie sobre una colada ACTIVA (fase 2 de la columna, la que
    // quema de verdad): encaja la mitad. Es la misma columna que ya usa
    // fragua en el bloque 5D, no una copia para el jefe.
    reduccionDano(mb) {
      for (const c of columnas) {
        if (c.estilo !== "colada" || c.fase !== 2) continue;
        if (Math.abs(mb.x - c.x) < c.w / 2 + mb.r * 0.6) return 0.5;
      }
      return 1;
    },
    fases: [
      // F1 — desplazamiento pesado, un golpe de zona, una colada
      { umbral: 1, ojo: "#ff8a1f",
        mover(mb, dt) {
          // Pasos, no deslizamiento: se para, avanza de golpe, se para.
          mb.pasoT = (mb.pasoT || 0) + dt;
          const ciclo = mb.pasoT % 2.4;
          mb.x = clamp(W / 2 + Math.sin(mb.faseT * 0.3) * W * 0.22, mb.r * 0.75, W - mb.r * 0.75);
          mb.y = mb.baseY + (ciclo < 1.4 ? 0 : Math.sin((ciclo - 1.4) * 3) * 8);
        },
        ataques: [
          { cd: [3.0, 3.6], avisa: 0.7,
            telegrafo(mb) { mb.golpeY = clamp(mb.y + 170, 0, H - 40); telegrafo("banda", { y: mb.golpeY, h: 130, life: 0.7, col: "#ff5c1a" }); },
            fn(mb) {
              const yb = mb.golpeY != null ? mb.golpeY : clamp(mb.y + 170, 0, H - 40);
              sfx("ene_barrido", { tono: 0.55 }); sacudir("medium"); hitstop(0.05); mb.recoil = 12;
              onda(mb.x, yb, "#ff8a1f", mb.r * 2.4, 0.45, 5);
              const dx = player.x - mb.x, dy = player.y - yb;
              if (Math.abs(dy) < 65 && Math.abs(dx) < 150) { golpe(mb.x, yb); if (state !== "play") return; }
              PATRONES.abanico(mb.x, yb, Math.PI / 2, 210, 3, 0.5, 6);
            } },
          { cd: [4.4, 5.2],
            fn(mb) { spawnColumna(clamp(mb.x, 90, W - 90), 110, 2.4, "colada"); sfx("fuego_ignicion"); } },
        ] },
      // F2 (~55%) — encadena dos golpes seguidos, colada más ancha
      { umbral: 0.55, ojo: "#ffffff", furia: true,
        mover(mb, dt) {
          mb.pasoT = (mb.pasoT || 0) + dt;
          const ciclo = mb.pasoT % 1.8;
          mb.x = clamp(W / 2 + Math.sin(mb.faseT * 0.4) * W * 0.26, mb.r * 0.75, W - mb.r * 0.75);
          mb.y = mb.baseY + (ciclo < 1.0 ? 0 : Math.sin((ciclo - 1.0) * 4) * 10);
        },
        ataques: [
          { cd: [2.1, 2.5], avisa: 0.55,
            telegrafo(mb) { mb.golpeY = clamp(mb.y + 170, 0, H - 40); telegrafo("banda", { y: mb.golpeY, h: 130, life: 0.55, col: "#ffffff" }); },
            fn(mb) {
              const yb = mb.golpeY != null ? mb.golpeY : clamp(mb.y + 170, 0, H - 40);
              sfx("ene_barrido", { tono: 0.6 }); sacudir("medium"); hitstop(0.05); mb.recoil = 12;
              onda(mb.x, yb, "#ffffff", mb.r * 2.6, 0.4, 5);
              const dx = player.x - mb.x, dy = player.y - yb;
              if (Math.abs(dy) < 65 && Math.abs(dx) < 150) { golpe(mb.x, yb); if (state !== "play") return; }
              PATRONES.abanico(mb.x, yb, Math.PI / 2, 230, 3, 0.5, 6);
            } },
          { cd: [3.6, 4.2],
            fn(mb) { spawnColumna(clamp(mb.x, 90, W - 90), 130, 2.2, "colada"); sfx("fuego_ignicion", { tono: 1.1 }); } },
        ] },
    ],
  },

  // ── HERALDO DE LA GRIETA — M19, grieta ─────────────────
  //  Se teletransporta como `rompedor` (5E) pero a escala de jefe: se
  //  apaga con un aro, abre una `ruptura` de verdad donde va a
  //  reaparecer —siempre anunciada, nunca a ciegas— y vuelve sólido con
  //  `VFX.materializar`. Reutiliza `mb.invul`, el campo que YA usan
  //  aviso/entrada/transición: no hace falta un gancho nuevo.
  heraldo_grieta: {
    mundo: "grieta",
    r: 46, hpMax: 345, nombre: "HERALDO DE LA GRIETA", titulo: "PRECURSOR DIMENSIONAL",
    sp: "bs_heraldo_grieta", color: () => "#c9a8ff",
    puntos: 2900, drops: ["arma", "escudo", "escudo", "vida"],
    onSpawn(mb) { mb.saltoT = 3.4; mb.saltando = false; },
    onEntrada(mb) {
      if (Math.random() < 0.4) part(mb.x + rand(-mb.r, mb.r), mb.y + rand(-20, 60), rand(-15, 15), rand(40, 100), 0.5, "#c9a8ff", rand(2, 4));
    },
    onMuerte(mb) {
      for (let i = hazards.length - 1; i >= 0; i--) if (hazards[i].tipo === "fragmento") hazards.splice(i, 1);
    },
    fases: [
      { umbral: 1, ojo: "#c9a8ff",
        mover(mb, dt) {
          if (!mb.saltando) {
            mb.x = clamp(W / 2 + Math.sin(mb.faseT * 0.5) * W * 0.24, mb.r * 0.7, W - mb.r * 0.7);
            mb.y = mb.baseY + Math.sin(mb.faseT * 0.8) * 14;
          }
          mb.saltoT -= dt;
          if (mb.saltoT <= 0 && !mb.saltando) {
            // Se apaga, anuncia dónde va a salir, y solo ENTONCES se
            // mueve — la ruptura de destino lleva ahí desde antes.
            mb.saltando = true; mb.invul = true; mb.saltoFase = "saliendo"; mb.saltoFaseT = 0.35;
            telegrafo("anillo", { x: mb.x, y: mb.y, r: mb.r * 2.2, life: 0.35, sigue: mb, col: "#c9a8ff" });
            sfx("gravedad_forma", { vol: 0.55 });
          }
          if (mb.saltando) {
            mb.saltoFaseT -= dt;
            if (mb.saltoFase === "saliendo" && mb.saltoFaseT <= 0) {
              // Igual que rompedor (5E): se prueban hasta 8 puntos y se
              // queda con uno a 170 px o más del jugador. Sin esto,
              // "siempre telegrafiado" no serviría de nada si encima
              // reaparece pegado a la nave.
              let nx = mb.x, ny = mb.y, intentos = 0;
              do {
                nx = clamp(rand(mb.r + 30, W - mb.r - 30), mb.r, W - mb.r);
                ny = rand(H * 0.14, H * 0.4);
                intentos++;
              } while (Math.hypot(nx - player.x, ny - player.y) < 170 && intentos < 8);
              mb.x = nx; mb.y = ny;
              spawnRuptura(mb.x, mb.y, mb.r * 2.6, 0.001);
              telegrafo("anillo", { x: mb.x, y: mb.y, r: mb.r * 0.5, life: 0.4, sigue: mb, col: "#c9a8ff" });
              VFX.materializar(mb.x, mb.y, 12, "#c9a8ff", mb.r * 1.6);
              sfx("gravedad_colapso", { vol: 0.55 });
              mb.saltoFase = "entrando"; mb.saltoFaseT = 0.4;
            } else if (mb.saltoFase === "entrando" && mb.saltoFaseT <= 0) {
              mb.saltando = false; mb.invul = false; mb.saltoT = rand(3.6, 4.6);
              const a = haciaJugador(mb);
              PATRONES.abanico(mb.x, mb.y, a, 260, 3, 0.22, 6);
            }
          }
        },
        ataques: [
          { cd: [2.4, 3.0], avisa: 0.36,
            telegrafo(mb) { const a = haciaJugador(mb); telegrafo("cono", { x: mb.x, y: mb.y, a1: a - 0.34, a2: a + 0.34, r: 850, life: 0.36, sigue: mb, col: "#c9a8ff" }); },
            fn(mb) { PATRONES.abanico(mb.x, mb.y, haciaJugador(mb), 260, 4, 0.2, 6); sfx("ene_disparo", { tono: 0.7 }); mb.recoil = 6; } },
          { cd: [4.2, 5.0],
            fn(mb) { soltarFragmentoHazard(clamp(mb.x + rand(-80, 80), 60, W - 60), mb.y + mb.r + 30); } },
        ] },
      // F2 (~55%) — teletransporte más frecuente
      { umbral: 0.55, ojo: "#ffffff", furia: true,
        alEntrar(mb) { mb.saltoT = Math.min(mb.saltoT, 1.6); },
        mover(mb, dt) {
          if (!mb.saltando) {
            mb.x = clamp(W / 2 + Math.sin(mb.faseT * 0.7) * W * 0.28, mb.r * 0.7, W - mb.r * 0.7);
            mb.y = mb.baseY + Math.sin(mb.faseT * 1.2) * 20;
          }
          mb.saltoT -= dt;
          if (mb.saltoT <= 0 && !mb.saltando) {
            mb.saltando = true; mb.invul = true; mb.saltoFase = "saliendo"; mb.saltoFaseT = 0.3;
            telegrafo("anillo", { x: mb.x, y: mb.y, r: mb.r * 2.2, life: 0.3, sigue: mb, col: "#ffffff" });
            sfx("gravedad_forma", { vol: 0.6 });
          }
          if (mb.saltando) {
            mb.saltoFaseT -= dt;
            if (mb.saltoFase === "saliendo" && mb.saltoFaseT <= 0) {
              let nx = mb.x, ny = mb.y, intentos = 0;
              do {
                nx = clamp(rand(mb.r + 30, W - mb.r - 30), mb.r, W - mb.r);
                ny = rand(H * 0.14, H * 0.42);
                intentos++;
              } while (Math.hypot(nx - player.x, ny - player.y) < 170 && intentos < 8);
              mb.x = nx; mb.y = ny;
              spawnRuptura(mb.x, mb.y, mb.r * 2.8, 0.001);
              telegrafo("anillo", { x: mb.x, y: mb.y, r: mb.r * 0.5, life: 0.34, sigue: mb, col: "#ffffff" });
              VFX.materializar(mb.x, mb.y, 14, "#ffffff", mb.r * 1.7);
              sfx("gravedad_colapso", { vol: 0.6 });
              mb.saltoFase = "entrando"; mb.saltoFaseT = 0.34;
            } else if (mb.saltoFase === "entrando" && mb.saltoFaseT <= 0) {
              mb.saltando = false; mb.invul = false; mb.saltoT = rand(1.8, 2.6);
              PATRONES.abanico(mb.x, mb.y, haciaJugador(mb), 300, 4, 0.2, 6);
            }
          }
        },
        ataques: [
          { cd: [1.7, 2.1], avisa: 0.28,
            telegrafo(mb) { const a = haciaJugador(mb); telegrafo("cono", { x: mb.x, y: mb.y, a1: a - 0.4, a2: a + 0.4, r: 850, life: 0.28, sigue: mb, col: "#ffffff" }); },
            fn(mb) { PATRONES.abanico(mb.x, mb.y, haciaJugador(mb), 300, 5, 0.18, 6); sfx("ene_disparo", { tono: 0.95 }); mb.recoil = 7; } },
          { cd: [3.0, 3.6],
            fn(mb) { soltarFragmentoHazard(clamp(mb.x + rand(-90, 90), 60, W - 60), mb.y + mb.r + 30); } },
        ] },
    ],
  },

  // ════════════════════════════════════════════════════════════
  //  JEFES PRINCIPALES DE LA EXPANSIÓN (bloque 5G) — M12, M14, M16,
  //  M18, M20. Jefes completos, no minijefes: 3-4 fases y 900-1600 HP,
  //  contra las 2 fases y 280-360 HP de los cinco de arriba. Reutilizan
  //  exactamente los mismos sistemas que los diez jefes de siempre —
  //  `mb.subs`/`actualizarSubsOmega` de OMEGA, columna/oscuridad/
  //  ruptura del bloque 5D, hazards del 5D/5E, el propio teletransporte
  //  de HERALDO DE LA GRIETA— más dos ayudantes nuevos y pequeños en
  //  index.html, uno por mecánica de firma que de verdad no existía
  //  todavía: `actualizarMitadesNyx` (NÝX) y `actualizarForjaVulcano`
  //  (VULCANO). Ninguno de los dos es un segundo motor de jefes: son el
  //  mismo patrón de "ayudante que hace el golpe real" que ya usan
  //  `actualizarSubsOmega`/`actualizarNodosAegis`.
  // ════════════════════════════════════════════════════════════

  // ── KRYOS — M12, hielo ──────────────────────────────────
  //  Cuatro placas de hielo con `mb.subs`/`actualizarSubsOmega`, la
  //  MISMA pieza que ya usa OMEGA SOVEREIGN con cuatro entradas en vez
  //  de tres. Su firma: en fase 2 vuelve a congelar exactamente DOS de
  //  las placas ya rotas — nunca las cuatro, nunca al azar cuántas
  //  queden — así que romperlas las cuatro de una sentada sigue siendo
  //  la única forma de que no vuelvan. En fase 3 el reactor queda
  //  expuesto del todo: ya no hay nada que recongelar.
  kryos: {
    mundo: "hielo", pistaJefe: "jefe2",
    r: 80, hpMax: 900, nombre: "KRYOS", titulo: "TRONO DE LA ESCARCHA ETERNA",
    sp: "bs_kryos", color: () => "#dff4ff",
    puntos: 8500, drops: ["arma", "arma", "escudo", "escudo", "vida", "bomba"],
    onSpawn(mb) {
      const r = mb.r;
      mb.subs = [
        { ox: -r * 0.95, oy: -r * 0.75, hp: 24, hpMax: 24, vivo: true, nombre: "PLACA DE HIELO", col: "#bfe9ff" },
        { ox: r * 0.95,  oy: -r * 0.75, hp: 24, hpMax: 24, vivo: true, nombre: "PLACA DE HIELO", col: "#bfe9ff" },
        { ox: -r * 1.1,  oy: r * 0.55,  hp: 24, hpMax: 24, vivo: true, nombre: "PLACA DE HIELO", col: "#bfe9ff" },
        { ox: r * 1.1,   oy: r * 0.55,  hp: 24, hpMax: 24, vivo: true, nombre: "PLACA DE HIELO", col: "#bfe9ff" },
      ];
      asegurarSpriteHazard("tempano");
    },
    onEntrada(mb) {
      if (Math.random() < 0.5) part(mb.x + rand(-mb.r * 1.3, mb.r * 1.3), mb.y + rand(-20, 80), rand(-20, 20), rand(40, 120), 0.5, "#dff4ff", rand(2, 4));
    },
    // F3 (índice 2): reactor expuesto de verdad, las placas ya no protegen.
    reduccionDano(mb) {
      if (mb.fase >= 2) return 1;
      const vivos = mb.subs ? mb.subs.filter(s => s.vivo).length : 0;
      return 1 - vivos * 0.1;
    },
    dibujarExtra(mb) {
      if (!mb.subs) return;
      const sp = SPRITES["hz_tempano"];
      for (const s of mb.subs) {
        if (!s.vivo) continue;
        const sx = mb.x + s.ox, sy = mb.y + s.oy;
        ctx.save(); ctx.translate(sx, sy);
        if (sp) { ctx.shadowColor = s.col; ctx.shadowBlur = 8; pintarSprite(sp, 30); ctx.shadowBlur = 0; }
        else {
          ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.4;
          ctx.fillStyle = s.col; ctx.beginPath(); ctx.arc(0, 0, 11, 0, TAU); ctx.fill();
          ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
        }
        ctx.restore();
        const bw = 26, bh = 3, bx = sx - bw / 2, by = sy - 22;
        ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
        ctx.fillStyle = s.col; ctx.fillRect(bx, by, bw * (s.hp / s.hpMax), bh);
      }
    },
    onMuerte(mb) {
      for (const s of mb.subs) if (s.vivo) { s.vivo = false; boom(mb.x + s.ox, mb.y + s.oy, s.col, 10, 0.8); }
      for (let i = hazards.length - 1; i >= 0; i--) if (hazards[i].tipo === "tempano") hazards.splice(i, 1);
    },
    fases: [
      { umbral: 1, ojo: "#dff4ff",
        mover(mb, dt) {
          mb.x = clamp(W / 2 + Math.sin(mb.faseT * 0.42) * W * 0.24, mb.r * 0.68, W - mb.r * 0.68);
          mb.y = mb.baseY + Math.sin(mb.faseT * 0.65) * 12;
          actualizarSubsOmega(mb, dt);
        },
        ataques: [
          { cd: [2.4, 3.0], avisa: 0.45,
            telegrafo(mb) { const a = haciaJugador(mb); telegrafo("cono", { x: mb.x, y: mb.y, a1: a - 0.42, a2: a + 0.42, r: 1000, life: 0.45, sigue: mb, col: "#dff4ff" }); },
            fn(mb) { PATRONES.abanico(mb.x, mb.y, haciaJugador(mb), 300, 6, 0.19, 7); sfx("ene_barrido", { tono: 0.85 }); mb.recoil = 9; } },
          { cd: [3.6, 4.4], avisa: 0.55,
            telegrafo(mb) { telegrafo("anillo", { x: mb.x, y: mb.y, r: mb.r * 2.6, life: 0.55, sigue: mb, col: "#bfe9ff" }); },
            fn(mb) { PATRONES.circulo(mb.x, mb.y, 240, 14, mb.faseT, 6); sfx("cryo", { tono: 0.6 }); } },
          { cd: [4.6, 5.4], avisa: 0.4,
            telegrafo(mb) { telegrafo("anillo", { x: mb.x, y: mb.y + mb.r + 40, r: 44, life: 0.4, col: "#bfe9ff" }); },
            fn(mb) {
              const antes = hazardTipo; hazardTipo = "tempano";
              const n0 = hazards.length; spawnHazard(); hazardTipo = antes;
              if (hazards.length > n0) { const h = hazards[hazards.length - 1]; h.x = mb.x; h.y = mb.y + mb.r + 40; h.vx = rand(-20, 20); h.vy = 34; h.warnT = 0; }
              sfx("gravedad_forma", { vol: 0.5 });
            } },
        ] },
      { umbral: 0.62, ojo: "#8fd8ff", furia: true,
        mover(mb, dt) {
          mb.x = clamp(W / 2 + Math.sin(mb.faseT * 0.6) * W * 0.28, mb.r * 0.68, W - mb.r * 0.68);
          mb.y = mb.baseY + Math.sin(mb.faseT * 1.1) * 18;
          actualizarSubsOmega(mb, dt);
        },
        ataques: [
          { cd: [1.9, 2.4], avisa: 0.36,
            telegrafo(mb) { const a = haciaJugador(mb); telegrafo("cono", { x: mb.x, y: mb.y, a1: a - 0.5, a2: a + 0.5, r: 1000, life: 0.36, sigue: mb, col: "#8fd8ff" }); },
            fn(mb) { PATRONES.abanico(mb.x, mb.y, haciaJugador(mb), 330, 7, 0.17, 7); sfx("ene_barrido"); mb.recoil = 10; } },
          { cd: [3.2, 3.8], avisa: 0.5,
            telegrafo(mb) { telegrafo("anillo", { x: mb.x, y: mb.y, r: mb.r * 3, life: 0.5, sigue: mb, col: "#8fd8ff" }); },
            fn(mb) { PATRONES.espiral(mb.x, mb.y, 260, 18, mb.faseT * 2.4, 6, 2); sfx("cryo", { tono: 0.5 }); } },
          // RECONGELACIÓN — su firma: repone exactamente DOS placas
          // rotas, nunca más. Si no queda ninguna rota, no hace nada.
          { cd: [7.0, 8.5], avisa: 0.7,
            telegrafo(mb) { texto(mb.x, mb.y - mb.r - 30, "RECONGELACIÓN", "#8fd8ff", 14); },
            fn(mb) {
              const rotas = mb.subs.filter(s => !s.vivo);
              if (!rotas.length) return;
              const n = Math.min(2, rotas.length);
              for (let i = 0; i < n; i++) { rotas[i].vivo = true; rotas[i].hp = rotas[i].hpMax; VFX.materializar(mb.x + rotas[i].ox, mb.y + rotas[i].oy, 6, "#8fd8ff", 24); }
              sfx("gravedad_colapso", { vol: 0.6 }); sacudir("tiny");
            } },
        ] },
      { umbral: 0.28, ojo: "#ffffff", furia: true, final: true,
        alEntrar(mb) {
          for (const s of mb.subs) if (s.vivo) { s.vivo = false; boom(mb.x + s.ox, mb.y + s.oy, s.col, 8, 0.6); }
          texto(W / 2, H * 0.32, "REACTOR EXPUESTO", "#ffffff", 18);
        },
        mover(mb, dt) {
          mb.x = clamp(W / 2 + Math.sin(mb.faseT * 0.9) * W * 0.3, mb.r * 0.68, W - mb.r * 0.68);
          mb.y = mb.baseY + Math.sin(mb.faseT * 1.6) * 24;
        },
        ataques: [
          { cd: [1.4, 1.8], avisa: 0.3,
            telegrafo(mb) { const a = haciaJugador(mb); telegrafo("cono", { x: mb.x, y: mb.y, a1: a - 0.6, a2: a + 0.6, r: 1000, life: 0.3, sigue: mb, col: "#ffffff" }); },
            fn(mb) { PATRONES.abanico(mb.x, mb.y, haciaJugador(mb), 390, 9, 0.15, 7); sfx("ene_barrido"); mb.recoil = 12; } },
          { cd: [3.2, 3.8], avisa: 0.6,
            telegrafo(mb) { telegrafo("anillo", { x: mb.x, y: mb.y, r: mb.r * 3.2, life: 0.6, sigue: mb, col: "#ffffff" }); },
            fn(mb) { PATRONES.circulo(mb.x, mb.y, 270, 18, mb.faseT, 6); sfx("cryo"); } },
        ] },
    ],
  },

  // ── VÉRTICE — M14, megaciudad ───────────────────────────
  //  Apenas se mueve: es una torre de control, no una nave de asalto.
  //  Toda la dificultad sale de manejar el terreno que controla —
  //  tráfico, cruces (columna "luz") y un corredor seguro que cambia de
  //  sitio— no de un chorro de balas. Reutiliza EXACTAMENTE lo que ya
  //  usa unidad_control (5F) para su mismo mundo, a más escala.
  vertice: {
    mundo: "megaciudad", pistaJefe: "jefe2",
    r: 86, hpMax: 1000, nombre: "VÉRTICE", titulo: "NODO CENTRAL DE CONTROL",
    sp: "bs_vertice", color: () => "#e030ff",
    puntos: 9000, drops: ["arma", "arma", "escudo", "escudo", "vida", "bomba"],
    onEntrada(mb) {
      if (Math.random() < 0.4) part(mb.x + rand(-mb.r, mb.r), mb.y + rand(-20, 60), rand(-15, 15), rand(40, 110), 0.5, "#e030ff", rand(2, 4));
    },
    onMuerte(mb) {
      for (let i = hazards.length - 1; i >= 0; i--) if (hazards[i].tipo === "trafico") hazards.splice(i, 1);
    },
    fases: [
      { umbral: 1, ojo: "#5cffd6",
        // Balanceo mínimo a propósito — no el barrido amplio de los
        // demás jefes. Es la torre, no el asalto.
        mover(mb, dt) {
          mb.x = clamp(W / 2 + Math.sin(mb.faseT * 0.22) * W * 0.05, mb.r * 0.7, W - mb.r * 0.7);
          mb.y = mb.baseY + Math.sin(mb.faseT * 0.4) * 6;
        },
        ataques: [
          { cd: [2.4, 3.0], avisa: 0.4,
            telegrafo(mb) { const a = haciaJugador(mb); telegrafo("cono", { x: mb.x, y: mb.y, a1: a - 0.32, a2: a + 0.32, r: 900, life: 0.4, sigue: mb, col: "#5cffd6" }); },
            fn(mb) { PATRONES.rafaga(mb.x, mb.y, haciaJugador(mb), 260, 4, 0.14, 6); sfx("ene_laser", { tono: 0.8 }); mb.recoil = 6; } },
          { cd: [4.0, 4.8],
            fn(mb) { const antes = hazardTipo; hazardTipo = "trafico"; spawnHazard(); spawnHazard(); hazardTipo = antes; sfx("alarma_flota", { vol: 0.45 }); } },
          { cd: [3.4, 4.0], avisa: 0.4,
            telegrafo(mb) { texto(mb.x, mb.y - mb.r - 26, "CRUCE ABIERTO", "#5cffd6", 13); },
            fn(mb) { spawnColumna(clamp(player.x + rand(-40, 40), 90, W - 90), 100, 1.8, "luz"); } },
        ] },
      { umbral: 0.6, ojo: "#ff5cff", furia: true,
        mover(mb, dt) {
          mb.x = clamp(W / 2 + Math.sin(mb.faseT * 0.3) * W * 0.08, mb.r * 0.7, W - mb.r * 0.7);
          mb.y = mb.baseY + Math.sin(mb.faseT * 0.55) * 9;
        },
        ataques: [
          { cd: [1.8, 2.3], avisa: 0.32,
            telegrafo(mb) { const a = haciaJugador(mb); telegrafo("cono", { x: mb.x, y: mb.y, a1: a - 0.36, a2: a + 0.36, r: 900, life: 0.32, sigue: mb, col: "#ff5cff" }); },
            fn(mb) { PATRONES.rafaga(mb.x, mb.y, haciaJugador(mb), 300, 5, 0.12, 6); sfx("ene_laser"); mb.recoil = 7; } },
          { cd: [3.2, 3.8],
            fn(mb) { const antes = hazardTipo; hazardTipo = "trafico"; spawnHazard(); spawnHazard(); spawnHazard(); hazardTipo = antes; sfx("alarma_flota", { vol: 0.5 }); } },
          // CORREDOR MÓVIL — dos cruces a los lados de un hueco que
          // cambia de sitio cada vez: hay que perseguir el pasillo
          // limpio, no esquivar balas.
          { cd: [4.6, 5.4], avisa: 0.5,
            telegrafo(mb) { texto(mb.x, mb.y - mb.r - 26, "CORREDOR MÓVIL", "#ff5cff", 13); },
            fn(mb) {
              const centro = clamp(rand(W * 0.25, W * 0.75), 130, W - 130);
              spawnColumna(centro - 110, 130, 2.2, "luz");
              spawnColumna(centro + 110, 130, 2.2, "luz");
            } },
          { cd: [5.6, 6.4], avisa: 0.7,
            telegrafo(mb) { telegrafo("banda", { y: rand(H * 0.3, H * 0.62), h: 70, life: 0.7, col: "#ff5cff" }); },
            fn(mb) { spawnCarril(rand(H * 0.3, H * 0.62), 70, 2.0); } },
        ] },
      { umbral: 0.28, ojo: "#ffffff", furia: true, final: true,
        alEntrar(mb) { texto(W / 2, H * 0.32, "CONTROL TOTAL", "#ffffff", 18); },
        mover(mb, dt) {
          mb.x = clamp(W / 2 + Math.sin(mb.faseT * 0.4) * W * 0.1, mb.r * 0.7, W - mb.r * 0.7);
          mb.y = mb.baseY + Math.sin(mb.faseT * 0.7) * 12;
        },
        ataques: [
          { cd: [1.5, 1.9], avisa: 0.28,
            telegrafo(mb) { const a = haciaJugador(mb); telegrafo("cono", { x: mb.x, y: mb.y, a1: a - 0.4, a2: a + 0.4, r: 900, life: 0.28, sigue: mb, col: "#ffffff" }); },
            fn(mb) { PATRONES.rafaga(mb.x, mb.y, haciaJugador(mb), 330, 6, 0.11, 6); sfx("ene_laser"); mb.recoil = 8; } },
          { cd: [6.5, 7.5], avisa: 0.6,
            telegrafo(mb) { texto(mb.x, mb.y - mb.r - 26, "BLOQUEO TOTAL", "#ffffff", 14); },
            fn(mb) {
              const centro = clamp(rand(W * 0.3, W * 0.7), 130, W - 130);
              spawnColumna(centro - 100, 110, 2.0, "luz");
              spawnColumna(centro + 100, 110, 2.0, "luz");
              spawnCarril(rand(H * 0.34, H * 0.58), 60, 1.8);
              const antes = hazardTipo; hazardTipo = "trafico"; spawnHazard(); spawnHazard(); hazardTipo = antes;
            } },
        ] },
    ],
  },

  // ── NÝX — M16, abismo ───────────────────────────────────
  //  Una sola entidad que en fase 2 se PARTE en dos cuerpos — pero
  //  sigue habiendo UNA sola vida y UNA sola barra (`mb.hp`, la de
  //  siempre): no son dos jefes, es el mismo con dos puntos de golpe.
  //  El núcleo genérico se apaga con `coreExpuesto` mientras dura la
  //  escisión (índex.html), y el golpe real pasa por
  //  `actualizarMitadesNyx`, que además reparte un goteo de vida —CON
  //  TOPE, ver `REGEN_TOPE_NYX` en índex.html— de la mitad intacta a la
  //  que más golpes lleva encima, para que no caiga mucho antes que la
  //  otra. El tope es lo que evita el bucle infinito, no un reparto
  //  "conservador": `mb.hp` sí sube, pero solo hasta agotar el
  //  presupuesto de TODA la pelea.
  nyx: {
    mundo: "abismo", pistaJefe: "jefe2",
    r: 74, hpMax: 1100, nombre: "NÝX", titulo: "MAREA QUE PIENSA",
    sp: "bs_nyx", color: () => "#3fcbb0",
    puntos: 9500, drops: ["arma", "arma", "escudo", "vida", "vida", "bomba"],
    onSpawn(mb) { mb.pulsoT = 0; mb.mitades = null; mb._tSinGolpe = [0, 0]; mb.regenGastado = 0; },
    onEntrada(mb) {
      if (Math.random() < 0.4) part(mb.x + rand(-mb.r, mb.r), mb.y + rand(-20, 60), rand(-15, 15), rand(30, 90), 0.5, "#3fcbb0", rand(2, 4));
    },
    // F1: expuesto solo durante el pulso, como guardian_ruina (5F) a
    // escala de jefe. F2-F3: el núcleo lo apaga `coreExpuesto`.
    reduccionDano(mb) { return mb.pulsoT > 0 ? 1 : 0.55; },
    coreExpuesto(mb) { return !mb.mitades; },
    // El casco base se apaga casi del todo mientras dura la escisión:
    // `dibujarExtra` pinta las dos mitades aparte, y sin esto se verían
    // TRES cuerpos superpuestos en vez de dos partidos.
    alfaCasco(mb) { return mb.mitades ? 0.12 : 1; },
    onMuerte(mb) {
      oscurecer(0, 0);
      mb.mitades = null;
      for (let i = hazards.length - 1; i >= 0; i--) if (hazards[i].tipo === "mina_bio") hazards.splice(i, 1);
    },
    dibujarExtra(mb) {
      if (!mb.mitades) return;
      const sp = SPRITES["bs_nyx"];
      const k = clamp(mb.hp / mb.hpMax, 0, 1);
      for (const m of mb.mitades) {
        const mx = mb.x + m.ox, my = mb.y + m.oy;
        ctx.save(); ctx.translate(mx, my); ctx.globalAlpha = 0.55 + k * 0.45;
        if (sp) { if (Q.sombras) { ctx.shadowColor = "rgba(0,0,0,0.5)"; ctx.shadowBlur = 12; } pintarSprite(sp, mb.r * 1.7); ctx.shadowBlur = 0; }
        ctx.restore();
      }
    },
    fases: [
      { umbral: 1, ojo: "#3fcbb0",
        alEntrar() { oscurecer(0.3, 0); },
        mover(mb, dt) {
          mb.x = clamp(W / 2 + Math.sin(mb.faseT * 0.4) * W * 0.22, mb.r * 0.75, W - mb.r * 0.75);
          mb.y = mb.baseY + Math.sin(mb.faseT * 0.6) * 12;
          if (mb.pulsoT > 0) { mb.pulsoT -= dt; if (mb.pulsoT <= 0) oscurecer(0.3, 0); }
        },
        ataques: [
          { cd: [2.6, 3.2], avisa: 0.4,
            telegrafo(mb) { telegrafo("anillo", { x: mb.x, y: mb.y, r: mb.r * 2.4, life: 0.4, sigue: mb, col: "#3fcbb0" }); },
            fn(mb) { mb.pulsoT = 0.9; oscurecer(0, 0.9); sfx("venom_pulso"); vfx("toxico", mb.x, mb.y, mb.r * 4.6, 0.55); PATRONES.circulo(mb.x, mb.y, 170, 8, mb.faseT, 6); } },
          { cd: [3.2, 3.8], avisa: 0.35,
            telegrafo(mb) { telegrafo("anillo", { x: clamp(player.x, 60, W - 60), y: H * 0.5, r: 30, life: 0.35, col: "#9dff5a" }); },
            fn(mb) { soltarMinaBio(clamp(player.x + rand(-60, 60), 60, W - 60), H * 0.48); } },
        ] },
      // F2 (~65%) — ESCISIÓN: se parte en dos cuerpos.
      { umbral: 0.65, ojo: "#57e3c9", furia: true,
        alEntrar(mb) {
          const r = mb.r;
          mb.mitades = [{ ox: -r * 1.05, oy: r * 0.1 }, { ox: r * 1.05, oy: r * 0.1 }];
          mb._tSinGolpe = [0, 0];
          texto(W / 2, H * 0.32, "ESCISIÓN", "#57e3c9", 18);
          VFX.materializar(mb.x - mb.r, mb.y, 10, "#57e3c9", mb.r * 1.4);
          VFX.materializar(mb.x + mb.r, mb.y, 10, "#57e3c9", mb.r * 1.4);
          sfx("gravedad_forma", { vol: 0.6 }); sacudir("medium");
        },
        mover(mb, dt) {
          mb.x = clamp(W / 2 + Math.sin(mb.faseT * 0.5) * W * 0.2, mb.r * 0.9, W - mb.r * 0.9);
          mb.y = mb.baseY + Math.sin(mb.faseT * 0.9) * 16;
          if (mb.mitades) {
            mb.mitades[0].oy = mb.r * 0.1 + Math.sin(mb.faseT * 1.4) * 14;
            mb.mitades[1].oy = mb.r * 0.1 + Math.sin(mb.faseT * 1.4 + Math.PI) * 14;
          }
          actualizarMitadesNyx(mb, dt);
        },
        ataques: [
          { cd: [2.2, 2.7], avisa: 0.36,
            telegrafo(mb) { telegrafo("cono", { x: mb.x + mb.mitades[0].ox, y: mb.y + mb.mitades[0].oy, a1: Math.PI / 2 - 0.4, a2: Math.PI / 2 + 0.4, r: 800, life: 0.36, col: "#57e3c9" }); },
            fn(mb) { PATRONES.abanico(mb.x + mb.mitades[0].ox, mb.y + mb.mitades[0].oy, Math.PI / 2, 240, 4, 0.2, 6); sfx("venom_pulso", { tono: 0.85 }); } },
          { cd: [2.2, 2.7], avisa: 0.36,
            telegrafo(mb) { telegrafo("cono", { x: mb.x + mb.mitades[1].ox, y: mb.y + mb.mitades[1].oy, a1: Math.PI / 2 - 0.4, a2: Math.PI / 2 + 0.4, r: 800, life: 0.36, col: "#57e3c9" }); },
            fn(mb) { PATRONES.abanico(mb.x + mb.mitades[1].ox, mb.y + mb.mitades[1].oy, Math.PI / 2, 240, 4, 0.2, 6); sfx("venom_pulso", { tono: 1.0 }); } },
          { cd: [3.6, 4.4], avisa: 0.32,
            telegrafo(mb) { telegrafo("anillo", { x: clamp(player.x, 60, W - 60), y: H * 0.5, r: 30, life: 0.32, col: "#9dff5a" }); },
            fn(mb) { soltarMinaBio(clamp(player.x + rand(-70, 70), 60, W - 60), H * 0.46); } },
        ] },
      // F3 (~25%) — REUNIFICACIÓN: vuelve a ser una sola, más agresiva.
      { umbral: 0.25, ojo: "#ffffff", furia: true, final: true,
        alEntrar(mb) {
          mb.mitades = null;
          texto(W / 2, H * 0.32, "REUNIFICACIÓN", "#ffffff", 18);
          oscurecer(0.45, 0); sacudir("medium");
        },
        mover(mb, dt) {
          mb.x = clamp(W / 2 + Math.sin(mb.faseT * 0.7) * W * 0.26, mb.r * 0.75, W - mb.r * 0.75);
          mb.y = mb.baseY + Math.sin(mb.faseT * 1.3) * 20;
          if (mb.pulsoT > 0) { mb.pulsoT -= dt; if (mb.pulsoT <= 0) oscurecer(0.45, 0); }
        },
        ataques: [
          { cd: [1.8, 2.2], avisa: 0.32,
            telegrafo(mb) { telegrafo("anillo", { x: mb.x, y: mb.y, r: mb.r * 2.6, life: 0.32, sigue: mb, col: "#ffffff" }); },
            fn(mb) { mb.pulsoT = 1.0; oscurecer(0, 1.0); sfx("venom_pulso"); vfx("toxico", mb.x, mb.y, mb.r * 5, 0.6); PATRONES.circulo(mb.x, mb.y, 200, 12, mb.faseT, 6); } },
          { cd: [2.4, 2.9], avisa: 0.3,
            telegrafo(mb) { telegrafo("anillo", { x: clamp(player.x, 60, W - 60), y: H * 0.5, r: 30, life: 0.3, col: "#9dff5a" }); },
            fn(mb) { soltarMinaBio(clamp(player.x + rand(-80, 80), 60, W - 60), H * 0.46); } },
        ] },
    ],
  },

  // ── VULCANO — M18, fragua ───────────────────────────────
  //  Cada ~20-25 s entra en FORJA: un objetivo destructible aparece con
  //  aviso. Si el jugador lo rompe a tiempo, la forja se cancela. Si
  //  no, VULCANO gana un modo temporal —martillo, cañón, columna o
  //  lanzador— que cambia su ataque mientras dura. Tiene que leerse de
  //  un vistazo como "está forjando algo y se puede parar": el texto y
  //  el aro de aviso son literales a propósito, no una adivinanza.
  vulcano: {
    mundo: "fragua", pistaJefe: "jefe2",
    r: 84, hpMax: 1250, nombre: "VULCANO", titulo: "EL QUE FORJA",
    sp: "bs_vulcano", color: () => "#ff6a1f",
    puntos: 9800, drops: ["arma", "arma", "escudo", "escudo", "vida", "bomba", "bomba"],
    onSpawn(mb) { mb.forjaT = 8; mb.forjaObjetivo = null; mb.modoForja = null; mb.modoForjaT = 0; mb._coladaT = 6; },
    onEntrada(mb) {
      if (Math.random() < 0.5) part(mb.x + rand(-mb.r, mb.r), mb.y + rand(-20, 70), rand(-25, 25), rand(60, 150), 0.4, "#ff8a1f", rand(2, 4));
    },
    // F3 (índice 2): reactor inestable, encaja más.
    reduccionDano(mb) { return mb.fase >= 2 ? 1.15 : 0.85; },
    onMuerte(mb) { mb.forjaObjetivo = null; mb.modoForja = null; },
    onDetonar(mb) { for (let i = 0; i < 12; i++) part(mb.x, mb.y, rand(-260, 260), rand(-260, 260), rand(0.4, 0.8), "#ff8a1f", rand(2, 4)); },
    dibujarExtra(mb) {
      if (!mb.forjaObjetivo) return;
      const o = mb.forjaObjetivo, ox = mb.x + o.ox, oy = mb.y + o.oy;
      const p = 0.5 + 0.5 * Math.sin(performance.now() / 90);
      ctx.save(); ctx.translate(ox, oy);
      ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.5 + p * 0.3;
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 20);
      g.addColorStop(0, "#fff3c4"); g.addColorStop(0.5, "#ffcf5c"); g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 20, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
      ctx.restore();
      const bw = 34, bh = 4, bx = ox - bw / 2, by = oy - 28;
      ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
      ctx.fillStyle = "#ffcf5c"; ctx.fillRect(bx, by, bw * (o.hp / o.hpMax), bh);
    },
    fases: [
      { umbral: 1, ojo: "#ff6a1f",
        mover(mb, dt) {
          mb.x = clamp(W / 2 + Math.sin(mb.faseT * 0.32) * W * 0.22, mb.r * 0.7, W - mb.r * 0.7);
          mb.y = mb.baseY + Math.sin(mb.faseT * 0.55) * 12;
          actualizarForjaVulcano(mb, dt, 22, 3.0, 7.0, ["martillo", "canon"]);
        },
        ataques: [
          { cd: [2.4, 3.0], avisa: 0.42,
            telegrafo(mb) { const a = haciaJugador(mb); telegrafo("cono", { x: mb.x, y: mb.y, a1: a - 0.42, a2: a + 0.42, r: 900, life: 0.42, sigue: mb, col: "#ff8a1f" }); },
            fn(mb) { PATRONES.abanico(mb.x, mb.y, haciaJugador(mb), 260, 5, 0.2, 7); sfx("ene_barrido"); mb.recoil = 8; } },
          { cd: [1.6, 2.0], avisa: 0.4,
            telegrafo(mb) { if (mb.modoForja === "martillo") { mb._forjaY = clamp(mb.y + 170, 0, H - 40); telegrafo("banda", { y: mb._forjaY, h: 120, life: 0.4, col: "#ff8a1f" }); } },
            fn(mb) {
              if (!mb.modoForja) return;
              if (mb.modoForja === "martillo") {
                const yb = mb._forjaY != null ? mb._forjaY : clamp(mb.y + 170, 0, H - 40);
                sfx("ene_barrido", { tono: 0.5 }); sacudir("small"); mb.recoil = 10;
                onda(mb.x, yb, "#ff8a1f", mb.r * 2, 0.4, 5);
                const dx = player.x - mb.x, dy = player.y - yb;
                if (Math.abs(dy) < 60 && Math.abs(dx) < 140) { golpe(mb.x, yb); if (state !== "play") return; }
                PATRONES.abanico(mb.x, yb, Math.PI / 2, 200, 3, 0.5, 6);
              } else if (mb.modoForja === "canon") {
                PATRONES.rafaga(mb.x, mb.y, haciaJugador(mb), 360, 6, 0.11, 8); sfx("ene_pesado"); mb.recoil = 10;
              } else if (mb.modoForja === "columna") {
                spawnColumna(clamp(player.x + rand(-60, 60), 90, W - 90), 110, 2.0, "colada");
              } else if (mb.modoForja === "lanzador") {
                PATRONES.abanico(mb.x, mb.y, haciaJugador(mb), 240, 7, 0.3, 6); sfx("ene_misil");
              }
            } },
        ] },
      { umbral: 0.62, ojo: "#ffcf5c", furia: true,
        mover(mb, dt) {
          mb.x = clamp(W / 2 + Math.sin(mb.faseT * 0.45) * W * 0.26, mb.r * 0.7, W - mb.r * 0.7);
          mb.y = mb.baseY + Math.sin(mb.faseT * 0.85) * 16;
          actualizarForjaVulcano(mb, dt, 17, 2.6, 6.0, ["martillo", "canon", "columna", "lanzador"]);
        },
        ataques: [
          { cd: [1.9, 2.4], avisa: 0.36,
            telegrafo(mb) { const a = haciaJugador(mb); telegrafo("cono", { x: mb.x, y: mb.y, a1: a - 0.5, a2: a + 0.5, r: 900, life: 0.36, sigue: mb, col: "#ffcf5c" }); },
            fn(mb) { PATRONES.abanico(mb.x, mb.y, haciaJugador(mb), 300, 6, 0.18, 7); sfx("ene_barrido"); mb.recoil = 9; } },
          { cd: [1.6, 2.0], avisa: 0.4,
            telegrafo(mb) { if (mb.modoForja === "martillo") { mb._forjaY = clamp(mb.y + 170, 0, H - 40); telegrafo("banda", { y: mb._forjaY, h: 120, life: 0.4, col: "#ffcf5c" }); } },
            fn(mb) {
              if (!mb.modoForja) return;
              if (mb.modoForja === "martillo") {
                const yb = mb._forjaY != null ? mb._forjaY : clamp(mb.y + 170, 0, H - 40);
                sfx("ene_barrido", { tono: 0.55 }); sacudir("small"); mb.recoil = 10;
                onda(mb.x, yb, "#ffcf5c", mb.r * 2.1, 0.4, 5);
                const dx = player.x - mb.x, dy = player.y - yb;
                if (Math.abs(dy) < 60 && Math.abs(dx) < 140) { golpe(mb.x, yb); if (state !== "play") return; }
                PATRONES.abanico(mb.x, yb, Math.PI / 2, 215, 3, 0.5, 6);
              } else if (mb.modoForja === "canon") {
                PATRONES.rafaga(mb.x, mb.y, haciaJugador(mb), 380, 7, 0.1, 8); sfx("ene_pesado"); mb.recoil = 11;
              } else if (mb.modoForja === "columna") {
                spawnColumna(clamp(player.x + rand(-70, 70), 90, W - 90), 120, 2.0, "colada");
              } else if (mb.modoForja === "lanzador") {
                PATRONES.abanico(mb.x, mb.y, haciaJugador(mb), 260, 8, 0.27, 6); sfx("ene_misil");
              }
            } },
        ] },
      { umbral: 0.28, ojo: "#ffffff", furia: true, final: true,
        alEntrar(mb) { texto(W / 2, H * 0.32, "REACTOR INESTABLE", "#ffffff", 18); },
        mover(mb, dt) {
          mb.x = clamp(W / 2 + Math.sin(mb.faseT * 0.6) * W * 0.3, mb.r * 0.7, W - mb.r * 0.7);
          mb.y = mb.baseY + Math.sin(mb.faseT * 1.2) * 22;
          actualizarForjaVulcano(mb, dt, 12, 2.2, 5.0, ["martillo", "canon", "columna", "lanzador"]);
          mb._coladaT -= dt;
          if (mb._coladaT <= 0) { mb._coladaT = rand(5, 6.5); spawnColumna(clamp(rand(90, W - 90), 90, W - 90), 100, 2.0, "colada"); }
        },
        ataques: [
          { cd: [1.4, 1.8], avisa: 0.3,
            telegrafo(mb) { const a = haciaJugador(mb); telegrafo("cono", { x: mb.x, y: mb.y, a1: a - 0.6, a2: a + 0.6, r: 900, life: 0.3, sigue: mb, col: "#ffffff" }); },
            fn(mb) { PATRONES.abanico(mb.x, mb.y, haciaJugador(mb), 380, 8, 0.15, 7); sfx("ene_barrido"); mb.recoil = 11; } },
          { cd: [1.4, 1.8], avisa: 0.4,
            telegrafo(mb) { if (mb.modoForja === "martillo") { mb._forjaY = clamp(mb.y + 170, 0, H - 40); telegrafo("banda", { y: mb._forjaY, h: 120, life: 0.4, col: "#ffffff" }); } },
            fn(mb) {
              if (!mb.modoForja) return;
              if (mb.modoForja === "martillo") {
                const yb = mb._forjaY != null ? mb._forjaY : clamp(mb.y + 170, 0, H - 40);
                sfx("ene_barrido", { tono: 0.6 }); sacudir("small"); mb.recoil = 11;
                onda(mb.x, yb, "#ffffff", mb.r * 2.2, 0.4, 5);
                const dx = player.x - mb.x, dy = player.y - yb;
                if (Math.abs(dy) < 60 && Math.abs(dx) < 140) { golpe(mb.x, yb); if (state !== "play") return; }
                PATRONES.abanico(mb.x, yb, Math.PI / 2, 230, 3, 0.5, 6);
              } else if (mb.modoForja === "canon") {
                PATRONES.rafaga(mb.x, mb.y, haciaJugador(mb), 400, 7, 0.1, 8); sfx("ene_pesado"); mb.recoil = 12;
              } else if (mb.modoForja === "columna") {
                spawnColumna(clamp(player.x + rand(-80, 80), 90, W - 90), 130, 1.8, "colada");
              } else if (mb.modoForja === "lanzador") {
                PATRONES.abanico(mb.x, mb.y, haciaJugador(mb), 280, 9, 0.24, 6); sfx("ene_misil");
              }
            } },
        ] },
    ],
  },

  // ── AXIOMA — M20, grieta ─────────────────────────────────
  //  El final de la expansión: el único jefe con CUATRO fases, la vida
  //  más alta y el único, junto con OMEGA SOVEREIGN, que lleva
  //  `epico:true` — la misma cinemática de muerte alargada y la misma
  //  pista de jefe final, reservadas para los dos verdaderos cierres
  //  del juego. Cada fase reutiliza un sistema YA construido en este
  //  bloque o en los anteriores, nunca inventa uno:
  //
  //    F1 PORTALES        el mismo teletransporte por `ruptura` que ya
  //                       usa HERALDO DE LA GRIETA (5F), a su escala.
  //    F2 FRAGMENTACIÓN   `mb.subs`/`actualizarSubsOmega`, el mismo
  //                       patrón de OMEGA SOVEREIGN y de KRYOS.
  //    F3 ECOS            cuatro ataques breves y suaves que llaman
  //                       literalmente al gesto de KRYOS, VÉRTICE, NÝX
  //                       y VULCANO —sin invocarlos como jefes, sin
  //                       duplicar su arsenal entero— cada uno con su
  //                       nombre en pantalla para que se reconozca de
  //                       dónde sale.
  //    F4 CARA A CARA     sin trucos: núcleo expuesto del todo, el
  //                       combo directo más intenso del juego.
  axioma: {
    mundo: "grieta", pistaJefe: "final2",
    r: 96, hpMax: 1600, nombre: "AXIOMA", titulo: "LO NO ESCRITO",
    sp: "bs_axioma", color: () => "#c9a8ff",
    puntos: 32000, drops: ["arma", "arma", "escudo", "escudo", "vida", "vida", "bomba", "bomba"],
    epico: true,
    onSpawn(mb) {
      mb.saltoT = 4.2; mb.saltando = false; mb.subs = null;
      asegurarSpriteHazard("fragmento");
    },
    onEntrada(mb) {
      if (Math.random() < 0.5) part(mb.x + rand(-mb.r * 1.3, mb.r * 1.3), mb.y + rand(-30, 90), rand(-20, 20), rand(40, 130), 0.5, "#e4d4ff", rand(2, 4));
    },
    reduccionDano(mb) {
      if (mb.fase >= 3) return 1.15;   // F4: sin trucos, núcleo expuesto
      if (mb.subs) return 1 - mb.subs.filter(s => s.vivo).length * 0.09;
      return 1;
    },
    dibujarExtra(mb) {
      if (!mb.subs) return;
      const sp = SPRITES["hz_fragmento"];
      for (const s of mb.subs) {
        if (!s.vivo) continue;
        const sx = mb.x + s.ox, sy = mb.y + s.oy;
        ctx.save(); ctx.translate(sx, sy); ctx.rotate(s.giro || 0);
        if (sp) { ctx.shadowColor = "#c9a8ff"; ctx.shadowBlur = 8; pintarSprite(sp, 34); ctx.shadowBlur = 0; }
        ctx.restore();
        const bw = 26, bh = 3, bx = sx - bw / 2, by = sy - 22;
        ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
        ctx.fillStyle = "#c9a8ff"; ctx.fillRect(bx, by, bw * (s.hp / s.hpMax), bh);
      }
    },
    onMuerte(mb) {
      mb.subs = null; mb.saltando = false; oscurecer(0, 0);
      for (let i = hazards.length - 1; i >= 0; i--) if (["tempano", "trafico", "mina_bio", "fragmento"].indexOf(hazards[i].tipo) >= 0) hazards.splice(i, 1);
    },
    onDetonar(mb) {
      for (let i = 0; i < 18; i++) { const a = rand(0, TAU); part(mb.x, mb.y, Math.cos(a) * rand(150, 400), Math.sin(a) * rand(150, 400), rand(0.5, 1.0), "#e4d4ff", rand(2, 4)); }
      onda(mb.x, mb.y, "#c9a8ff", mb.r * 18, 1.4);
    },
    fases: [
      // F1 (100%) — PORTALES
      { umbral: 1, ojo: "#c9a8ff",
        mover(mb, dt) {
          if (!mb.saltando) {
            mb.x = clamp(W / 2 + Math.sin(mb.faseT * 0.4) * W * 0.2, mb.r * 0.65, W - mb.r * 0.65);
            mb.y = mb.baseY + Math.sin(mb.faseT * 0.6) * 12;
          }
          mb.saltoT -= dt;
          if (mb.saltoT <= 0 && !mb.saltando) {
            mb.saltando = true; mb.invul = true; mb.saltoFase = "saliendo"; mb.saltoFaseT = 0.4;
            telegrafo("anillo", { x: mb.x, y: mb.y, r: mb.r * 2.2, life: 0.4, sigue: mb, col: "#c9a8ff" });
            sfx("gravedad_forma", { vol: 0.6 });
          }
          if (mb.saltando) {
            mb.saltoFaseT -= dt;
            if (mb.saltoFase === "saliendo" && mb.saltoFaseT <= 0) {
              let nx = mb.x, ny = mb.y, intentos = 0;
              do { nx = clamp(rand(mb.r + 40, W - mb.r - 40), mb.r, W - mb.r); ny = rand(H * 0.14, H * 0.4); intentos++; }
              while (Math.hypot(nx - player.x, ny - player.y) < 190 && intentos < 8);
              mb.x = nx; mb.y = ny;
              spawnRuptura(mb.x, mb.y, mb.r * 2.8, 0.001);
              telegrafo("anillo", { x: mb.x, y: mb.y, r: mb.r * 0.5, life: 0.45, sigue: mb, col: "#c9a8ff" });
              VFX.materializar(mb.x, mb.y, 14, "#c9a8ff", mb.r * 1.8);
              sfx("gravedad_colapso", { vol: 0.6 });
              mb.saltoFase = "entrando"; mb.saltoFaseT = 0.45;
            } else if (mb.saltoFase === "entrando" && mb.saltoFaseT <= 0) {
              mb.saltando = false; mb.invul = false; mb.saltoT = rand(4.0, 5.0);
              PATRONES.abanico(mb.x, mb.y, haciaJugador(mb), 280, 5, 0.19, 7);
              sfx("ene_barrido");
            }
          }
        },
        ataques: [
          { cd: [2.4, 3.0], avisa: 0.42,
            telegrafo(mb) { const a = haciaJugador(mb); telegrafo("cono", { x: mb.x, y: mb.y, a1: a - 0.4, a2: a + 0.4, r: 1000, life: 0.42, sigue: mb, col: "#c9a8ff" }); },
            fn(mb) { PATRONES.abanico(mb.x, mb.y, haciaJugador(mb), 310, 6, 0.18, 7); sfx("ene_barrido"); mb.recoil = 9; } },
          { cd: [3.8, 4.6], avisa: 0.5,
            telegrafo(mb) { telegrafo("anillo", { x: mb.x, y: mb.y, r: mb.r * 2.6, life: 0.5, sigue: mb, col: "#c9a8ff" }); },
            fn(mb) { PATRONES.circulo(mb.x, mb.y, 250, 14, mb.faseT, 6); sfx("gravedad_forma", { tono: 0.7 }); } },
        ] },
      // F2 (~72%) — FRAGMENTACIÓN
      { umbral: 0.72, ojo: "#a37dff", furia: true,
        alEntrar(mb) {
          const r = mb.r;
          mb.subs = [
            { ox: -r * 1.5, oy: -r * 0.3, hp: 24, hpMax: 24, vivo: true, giro: 0.3,  col: "#c9a8ff", nombre: "FRAGMENTO" },
            { ox: r * 1.5,  oy: -r * 0.3, hp: 24, hpMax: 24, vivo: true, giro: -0.3, col: "#c9a8ff", nombre: "FRAGMENTO" },
            { ox: -r * 1.1, oy: r * 0.9,  hp: 24, hpMax: 24, vivo: true, giro: 0.6,  col: "#c9a8ff", nombre: "FRAGMENTO" },
            { ox: r * 1.1,  oy: r * 0.9,  hp: 24, hpMax: 24, vivo: true, giro: -0.6, col: "#c9a8ff", nombre: "FRAGMENTO" },
          ];
          texto(W / 2, H * 0.32, "FRAGMENTACIÓN", "#a37dff", 18);
        },
        mover(mb, dt) {
          mb.x = clamp(W / 2 + Math.sin(mb.faseT * 0.5) * W * 0.24, mb.r * 0.65, W - mb.r * 0.65);
          mb.y = mb.baseY + Math.sin(mb.faseT * 0.9) * 16;
          actualizarSubsOmega(mb, dt);
        },
        ataques: [
          { cd: [2.2, 2.7], avisa: 0.36,
            telegrafo(mb) { const a = haciaJugador(mb); telegrafo("cono", { x: mb.x, y: mb.y, a1: a - 0.48, a2: a + 0.48, r: 1000, life: 0.36, sigue: mb, col: "#a37dff" }); },
            fn(mb) { PATRONES.abanico(mb.x, mb.y, haciaJugador(mb), 340, 7, 0.16, 7); sfx("ene_barrido"); mb.recoil = 10; } },
          { cd: [3.2, 3.8], avisa: 0.4,
            telegrafo(mb) { telegrafo("anillo", { x: mb.x, y: mb.y, r: mb.r * 3, life: 0.4, sigue: mb, col: "#a37dff" }); },
            fn(mb) { PATRONES.espiral(mb.x, mb.y, 270, 18, mb.faseT * 2.6, 6, 3); sfx("gravedad_forma"); } },
        ] },
      // F3 (~42%) — ECOS: firmas de los otros cuatro jefes de 5G, en
      // pequeño y sin invocarlos. Cada ataque dice de qué jefe viene.
      { umbral: 0.42, ojo: "#ffffff", furia: true,
        alEntrar(mb) { mb.subs = null; texto(W / 2, H * 0.32, "ECOS", "#ffffff", 18); },
        mover(mb, dt) {
          mb.x = clamp(W / 2 + Math.sin(mb.faseT * 0.55) * W * 0.26, mb.r * 0.65, W - mb.r * 0.65);
          mb.y = mb.baseY + Math.sin(mb.faseT * 1.0) * 18;
        },
        ataques: [
          { cd: [1.9, 2.3], avisa: 0.32,
            telegrafo(mb) { const a = haciaJugador(mb); telegrafo("cono", { x: mb.x, y: mb.y, a1: a - 0.5, a2: a + 0.5, r: 1000, life: 0.32, sigue: mb, col: "#ffffff" }); },
            fn(mb) { PATRONES.abanico(mb.x, mb.y, haciaJugador(mb), 320, 6, 0.17, 7); sfx("ene_barrido"); mb.recoil = 9; } },
          // ECO: KRYOS — un témpano suelto + un anillo de hielo, sin ni
          // de lejos el arsenal completo de KRYOS.
          { cd: [6.5, 7.5], avisa: 0.5,
            telegrafo(mb) { texto(mb.x, mb.y - mb.r - 30, "ECO: KRYOS", "#dff4ff", 14); },
            fn(mb) {
              const antes = hazardTipo; hazardTipo = "tempano";
              const n0 = hazards.length; spawnHazard(); hazardTipo = antes;
              if (hazards.length > n0) { const h = hazards[hazards.length - 1]; h.x = mb.x; h.y = mb.y + mb.r + 30; h.warnT = 0; }
              PATRONES.circulo(mb.x, mb.y, 180, 8, mb.faseT, 6); sfx("cryo", { tono: 0.7 });
            } },
          // ECO: VÉRTICE — un cruce y un coche, no el control del campo entero.
          { cd: [7.0, 8.0], avisa: 0.5,
            telegrafo(mb) { texto(mb.x, mb.y - mb.r - 30, "ECO: VÉRTICE", "#e030ff", 14); },
            fn(mb) {
              spawnColumna(clamp(player.x + rand(-50, 50), 90, W - 90), 90, 1.6, "luz");
              const antes = hazardTipo; hazardTipo = "trafico"; spawnHazard(); hazardTipo = antes;
            } },
          // ECO: NÝX — un pulso de oscuridad y una mina, no la escisión.
          { cd: [7.5, 8.5], avisa: 0.5,
            telegrafo(mb) { texto(mb.x, mb.y - mb.r - 30, "ECO: NÝX", "#3fcbb0", 14); },
            fn(mb) { oscurecer(0.3, 0.9); soltarMinaBio(clamp(player.x + rand(-60, 60), 60, W - 60), H * 0.48); sfx("venom_pulso"); } },
          // ECO: VULCANO — una colada suelta y una ráfaga, no la forja entera.
          { cd: [8.0, 9.0], avisa: 0.5,
            telegrafo(mb) { texto(mb.x, mb.y - mb.r - 30, "ECO: VULCANO", "#ff6a1f", 14); },
            fn(mb) { spawnColumna(clamp(rand(90, W - 90), 90, W - 90), 100, 1.8, "colada"); PATRONES.rafaga(mb.x, mb.y, haciaJugador(mb), 300, 4, 0.15, 6); sfx("fuego_ignicion"); } },
        ] },
      // F4 (~16%) — CARA A CARA: sin trucos, núcleo expuesto del todo.
      { umbral: 0.16, ojo: "#ff2f6e", furia: true, final: true,
        alEntrar(mb) {
          mb.subs = null; mb.saltando = false; mb.invul = false;
          texto(W / 2, H * 0.3, "CARA A CARA", "#ff2f6e", 22);
          sacudir("heavy");
        },
        mover(mb, dt) {
          mb.x = clamp(W / 2 + Math.sin(mb.faseT * 1.0) * W * 0.32, mb.r * 0.65, W - mb.r * 0.65);
          mb.y = mb.baseY + Math.sin(mb.faseT * 1.8) * 26;
        },
        ataques: [
          { cd: [1.3, 1.6], avisa: 0.28,
            telegrafo(mb) { const a = haciaJugador(mb); telegrafo("cono", { x: mb.x, y: mb.y, a1: a - 0.62, a2: a + 0.62, r: 1000, life: 0.28, sigue: mb, col: "#ff2f6e" }); },
            fn(mb) { PATRONES.abanico(mb.x, mb.y, haciaJugador(mb), 400, 9, 0.15, 7); sfx("ene_barrido"); mb.recoil = 12; } },
          { cd: [3.2, 3.8], avisa: 0.6,
            telegrafo(mb) {
              telegrafo("anillo", { x: mb.x, y: mb.y, r: mb.r * 3.4, life: 0.6, sigue: mb, col: "#ff2f6e" });
              telegrafo("cono", { x: mb.x, y: mb.y, a1: 0.15, a2: Math.PI - 0.15, r: 1100, life: 0.6, sigue: mb, col: "#ff2f6e" });
            },
            fn(mb) {
              texto(mb.x, mb.y - mb.r - 30, "AXIOMA", "#ff2f6e", 15);
              PATRONES.barrido(mb.x, mb.y, 0.2, Math.PI - 0.2, 300, 12, 7);
              PATRONES.espiral(mb.x, mb.y, 300, 22, mb.faseT * 3, 5, 3);
              sfx("ultimate", { tono: 0.5 }); sacudir("medium"); hitstop(0.05);
            } },
        ] },
    ],
  },
};
