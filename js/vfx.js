// ════════════════════════════════════════════════════════════
//  vfx.js — efectos visuales de FLIGHT STRIKE
// ════════════════════════════════════════════════════════════
//
//  <script src> clásico, como save.js y music.js.
//
//  ── LA REGLA QUE MANDA SOBRE TODAS ──
//
//     PROYECTIL ENEMIGO  >  VFX
//
//  Si una explosión tapa una bala, el efecto está mal. No "es bonito
//  pero"; está MAL. Por eso los efectos se pintan por CAPAS y las capas
//  no son decorativas: son la jerarquía de lectura del juego.
//
//     FONDO   humo, energía, ondas de choque. Detrás de todo.
//     MEDIO   chispas, restos, motor. Encima de los enemigos, DEBAJO
//             de las balas.
//     FRENTE  lo poquísimo que va sobre las balas, con el alfa atado
//             en corto para que nunca las esconda.
//
//  ── PRESUPUESTO, NO "LO QUE SALGA" ──
//
//  Dos frenos, y hacen falta los dos:
//
//    · Tope TOTAL y por FAMILIA. Sin el de familia, una explosión de
//      jefe se come el presupuesto entero y durante medio segundo los
//      disparos dejan de tener chispas — justo cuando más pasa.
//    · Tope POR FOTOGRAMA. Es el que impide el tirón: el problema del
//      iPad no son 400 partículas vivas, son 400 CREADAS de golpe.
//
//  Cuando no cabe algo, no se encola ni se rebaja: no sale. Un efecto
//  que llega tarde es peor que uno que no llega.
//
//  ── NADA DE ESTO TOCA EL JUEGO ──
//
//  La sacudida es SOLO de cámara: devuelve un desplazamiento para el
//  render y no escribe en ninguna coordenada de nada. Hay una prueba
//  que lo comprueba, porque es el error clásico de este sistema.

var VFX = (function () {
  "use strict";

  // ── PRESUPUESTO ─────────────────────────────────────────
  //  ALTO está calibrado sobre lo que el juego ya gastaba (420
  //  partículas), así que no es "más de lo de antes": es lo mismo,
  //  repartido con criterio y medido.
  var PRESUPUESTO = {
    alto: {
      total: 420, porFrame: 90,
      fam: { chispa: 160, debris: 90, estela: 120, humo: 120, motor: 40, jugador: 60,
             bossAura: 40, bossHit: 50, bossFase: 60, bossMuerte: 120, debrisBoss: 80, ui: 60 },
      sprites: 48, ondas: 12, fogonazos: 24, sacudidas: 3,
      ondasBoss: 6, porFrameBoss: 24,
      escala: 1.0, largoEstela: 1.0, glow: true, flash: 1.0,
    },
    medio: {
      total: 240, porFrame: 50,
      fam: { chispa: 90, debris: 45, estela: 60, humo: 60, motor: 24, jugador: 40,
             bossAura: 24, bossHit: 30, bossFase: 36, bossMuerte: 70, debrisBoss: 45, ui: 36 },
      sprites: 30, ondas: 7, fogonazos: 16, sacudidas: 3,
      ondasBoss: 4, porFrameBoss: 14,
      escala: 0.6, largoEstela: 0.6, glow: true, flash: 0.8,
    },
    // BAJO deja SOLO lo que informa: chispas de impacto, humo y el
    // feedback del jugador. Sin restos y sin estelas. Es feo a
    // propósito; es el modo de "esto tiene que ir a 60 fps cueste lo
    // que cueste". Lo que NO se recorta nunca es `jugador`, y los
    // fogonazos se quedan en la mitad de intensidad por accesibilidad.
    bajo: {
      total: 110, porFrame: 24,
      fam: { chispa: 40, debris: 0, estela: 0, humo: 40, motor: 12, jugador: 24,
             bossAura: 10, bossHit: 16, bossFase: 18, bossMuerte: 36, debrisBoss: 0, ui: 18 },
      sprites: 16, ondas: 3, fogonazos: 8, sacudidas: 2,
      ondasBoss: 2, porFrameBoss: 8,
      escala: 0.32, largoEstela: 0, glow: false, flash: 0.5,
    },
  };

  // Familias que se pueden desalojar para hacer sitio a lo importante.
  // Son las decorativas: nadie pierde una partida porque falte humo.
  //
  // `jugador` NO está aquí, y es deliberado: la muerte de un jefe puede
  // desalojar decoración, pero nunca el feedback del jugador. Si te dan
  // en medio de la explosión del jefe, tienes que verlo.
  var DESALOJABLES = { humo: 1, estela: 1, debris: 1, bossAura: 1 };

  // Prioritarias: se saltan el tope por fotograma y desalojan
  // decoración. Son las que no pueden faltar cuando pasa algo grande.
  var PRIORITARIAS = { jugador: 1, bossMuerte: 1, bossFase: 1 };

  var FONDO = 0, MEDIO = 1, FRENTE = 2;

  var P = PRESUPUESTO.alto;
  var calidad = "alto", pedida = "auto", auto = "alto";

  // ── Reserva de partículas ───────────────────────────────
  //  Una sola lista para todas las familias. Tener una por familia
  //  parece más ordenado y es peor: son cinco recorridos por fotograma
  //  en vez de uno, y el reparto del presupuesto deja de poder mirarse
  //  de una vez.
  var parts = [];
  var libres = [];
  var cuenta = { chispa: 0, debris: 0, estela: 0, humo: 0, motor: 0, jugador: 0,
                 bossAura: 0, bossHit: 0, bossFase: 0, bossMuerte: 0, debrisBoss: 0, ui: 0 };
  var gastadoFrame = 0, gastadoBoss = 0;
  var desalojadas = 0;
  var ondasDeBoss = 0;
  var bossHitT = 0, bossHitAcum = 0;

  var ondas = [], libresOndas = [];
  var fogos = [], libresFogos = [];
  var guiones = [];

  // ── Métricas ────────────────────────────────────────────
  var met = {
    ms: 0, msMax: 0, msMedio: 0, caidas: 0,
    picoParts: 0, rechazadas: 0, creadasFrame: 0,
  };
  var histMs = [], HIST = 60;

  function limites() { return P; }

  function aplicarCalidad() {
    var q = pedida === "auto" ? auto : pedida;
    if (!PRESUPUESTO[q]) q = "alto";
    calidad = q;
    P = PRESUPUESTO[q];
    // Recortar lo que ya no cabe. Bajar la calidad tiene que notarse
    // AHORA, no cuando mueran solas las partículas que ya había.
    while (parts.length > P.total) soltar(parts.length - 1);
    while (ondas.length > P.ondas) { libresOndas.push(ondas.pop()); }
    while (fogos.length > P.fogonazos) { libresFogos.push(fogos.pop()); }
  }

  function soltar(i) {
    var p = parts[i];
    if (cuenta[p.fam] !== undefined) cuenta[p.fam]--;
    libres.push(p);
    parts.splice(i, 1);
  }

  // ¿Cabe? Tres preguntas, de la más barata a la más cara.
  //
  //  `prio` es para el feedback del JUGADOR —daño, escudo, recogida,
  //  muerte—, que el brief pide que no se pierda ni en calidad BAJA.
  //  Para eso se salta el tope por fotograma (son ráfagas de un evento
  //  puntual, no un goteo) y, si el total está lleno, DESALOJA una
  //  partícula decorativa. Lo que nunca se salta es su tope de familia:
  //  60 en ALTO, 24 en BAJO. Así está acotado por arriba.
  function cabe(fam, prio) {
    var lim = P.fam[fam];
    if (lim === undefined) lim = P.total;
    if (cuenta[fam] >= lim) return false;
    // Las familias de jefe tienen ADEMÁS su propio tope por fotograma.
    // Es lo que impide que una muerte de jefe se coma el fotograma de
    // golpe: la coreografía tiene que repartirse en el tiempo, no
    // vaciar el presupuesto en un frame y provocar el tirón.
    if (fam.indexOf("boss") === 0 || fam === "debrisBoss") {
      if (gastadoBoss >= P.porFrameBoss) return false;
    }
    if (!prio && gastadoFrame >= P.porFrame) return false;
    if (parts.length < P.total) return true;
    if (!prio) return false;
    // Lleno y es importante: se busca la decorativa más VIEJA (la que
    // más cerca está de morirse sola) y se le cede el sitio.
    var peor = -1, mejorK = -1;
    for (var i = 0; i < parts.length; i++) {
      if (!DESALOJABLES[parts[i].fam]) continue;
      var k = parts[i].t / parts[i].life;
      if (k > mejorK) { mejorK = k; peor = i; }
    }
    if (peor < 0) return false;
    soltar(peor);
    desalojadas++;
    return true;
  }

  // ── API ─────────────────────────────────────────────────
  var api = {
    FONDO: FONDO, MEDIO: MEDIO, FRENTE: FRENTE,
    PRESUPUESTO: PRESUPUESTO,

    limites: limites,
    calidad: function () { return calidad; },

    // `pedida` viene de OPCIONES.vfx y `auto` del degradado por FPS que
    // ya tenía el juego. Manda el más restrictivo de los dos.
    ajustar: function (opcion, autoNivel) {
      if (opcion !== undefined) pedida = opcion;
      if (autoNivel !== undefined) auto = autoNivel;
      aplicarCalidad();
      return calidad;
    },

    // ── Partículas ────────────────────────────────────────
    //  Devuelve la partícula o null si no cabía. Quien llama NO debe
    //  dar por hecho que existe.
    part: function (o) {
      var fam = o.fam || "humo";
      var prio = o.prio || PRIORITARIAS[fam];
      if (!cabe(fam, prio)) { met.rechazadas++; return null; }
      if (fam.indexOf("boss") === 0 || fam === "debrisBoss") gastadoBoss++;
      var p = libres.pop() || {};
      p.x = o.x; p.y = o.y;
      p.vx = o.vx || 0; p.vy = o.vy || 0;
      p.life = o.life || 0.4; p.t = 0;
      p.color = o.color || "#ffffff";
      p.r = o.r || 2;
      p.fam = fam;
      p.capa = o.capa === undefined ? MEDIO : o.capa;
      p.roce = o.roce === undefined ? 0.93 : o.roce;
      p.grav = o.grav || 0;
      p.estira = o.estira ? 1 : 0;
      p.gira = o.gira || 0;
      p.ang = o.ang || 0;
      parts.push(p);
      cuenta[fam]++;
      gastadoFrame++;
      met.creadasFrame++;
      if (parts.length > met.picoParts) met.picoParts = parts.length;
      return p;
    },

    // Chispas de impacto: cortas, rápidas, brillantes y SIEMPRE en la
    // capa media. Es el efecto que más se repite del juego, así que es
    // el que más barato tiene que salir.
    chispas: function (x, y, n, color, fuerza) {
      var f = fuerza || 1, hechas = 0;
      n = Math.round(n * P.escala);
      for (var i = 0; i < n; i++) {
        var a = Math.random() * Math.PI * 2;
        var s = (60 + Math.random() * 260) * f;
        if (!api.part({
          x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
          life: 0.14 + Math.random() * 0.22, color: color || "#fff3c4",
          r: 1 + Math.random() * 1.8 * f, fam: "chispa", capa: MEDIO,
          estira: 1, roce: 0.9,
        })) break;
        hechas++;
      }
      return hechas;
    },

    // Restos: fragmentos con peso, que caen. Lo que separa "ha
    // desaparecido" de "se ha roto". En BAJO no existen.
    debris: function (x, y, n, color, fuerza) {
      if (!P.fam.debris) return 0;
      var f = fuerza || 1, hechas = 0;
      n = Math.round(n * P.escala);
      for (var i = 0; i < n; i++) {
        var a = -Math.random() * Math.PI;
        var s = (80 + Math.random() * 240) * f;
        if (!api.part({
          x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s + (Math.random() * 80 - 40),
          life: 0.5 + Math.random() * 0.7, color: color || "#ffcf5c",
          r: 1.2 + Math.random() * 1.8, fam: "debris", capa: MEDIO,
          estira: 1, roce: 0.985, grav: 320,
        })) break;
        hechas++;
      }
      return hechas;
    },

    // Humo / energía: lento, grande, en la capa de FONDO para que nunca
    // se ponga por delante de nada que importe.
    humo: function (x, y, n, color, fuerza) {
      var f = fuerza || 1, hechas = 0;
      n = Math.round(n * P.escala);
      for (var i = 0; i < n; i++) {
        var a = Math.random() * Math.PI * 2;
        var s = (20 + Math.random() * 90) * f;
        if (!api.part({
          x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
          life: 0.4 + Math.random() * 0.5, color: color || "#ffffff",
          r: (3 + Math.random() * 5) * f, fam: "humo", capa: FONDO,
          roce: 0.94,
        })) break;
        hechas++;
      }
      return hechas;
    },

    estela: function (x, y, vx, vy, color, r, vida) {
      if (!P.fam.estela) return null;
      return api.part({
        x: x, y: y, vx: vx, vy: vy, life: (vida || 0.3) * P.largoEstela,
        color: color, r: r, fam: "estela", capa: FONDO, roce: 0.9,
      });
    },

    motor: function (x, y, vx, vy, color, r, vida) {
      return api.part({
        x: x, y: y, vx: vx, vy: vy, life: vida || 0.3,
        color: color, r: r, fam: "motor", capa: FONDO, roce: 0.92,
      });
    },

    // ── Feedback del JUGADOR ──────────────────────────────
    //  Familia propia y prioridad, porque es lo único que el brief
    //  prohíbe recortar aunque la calidad esté en BAJO. Todo lo de aquí
    //  desaloja decoración antes que dejar de salir.

    // Ráfaga de chispas del jugador. `arco` en radianes limita el
    // abanico: sirve para que el impacto de escudo salga POR DONDE le
    // han dado, no en todas direcciones.
    jugador: function (x, y, n, color, fuerza, dir, arco) {
      var f = fuerza || 1, hechas = 0;
      // Se escala menos que lo decorativo: en BAJO esto tiene que
      // seguir viéndose.
      n = Math.max(3, Math.round(n * (0.45 + P.escala * 0.55)));
      var abanico = arco === undefined ? Math.PI * 2 : arco;
      var base = dir === undefined ? 0 : dir - abanico / 2;
      for (var i = 0; i < n; i++) {
        var a = base + Math.random() * abanico;
        var s = (70 + Math.random() * 240) * f;
        if (!api.part({
          x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
          life: 0.18 + Math.random() * 0.3, color: color || "#ffffff",
          r: 1.2 + Math.random() * 2 * f, fam: "jugador", capa: MEDIO,
          estira: 1, roce: 0.9, prio: true,
        })) break;
        hechas++;
      }
      return hechas;
    },

    // Materialización: partículas que caen HACIA DENTRO en vez de
    // salir. Es lo que hace que un respawn se lea como "se está
    // formando" y no como otra explosión más.
    materializar: function (x, y, n, color, radio) {
      var hechas = 0;
      n = Math.max(4, Math.round(n * (0.5 + P.escala * 0.5)));
      var rad = radio || 60;
      for (var i = 0; i < n; i++) {
        var a = Math.random() * Math.PI * 2;
        var d = rad * (0.7 + Math.random() * 0.6);
        var vida = 0.3 + Math.random() * 0.2;
        // Velocidad calculada para llegar al centro justo al morir.
        if (!api.part({
          x: x + Math.cos(a) * d, y: y + Math.sin(a) * d,
          vx: -Math.cos(a) * d / vida, vy: -Math.sin(a) * d / vida,
          life: vida, color: color || "#9beeff",
          r: 1.4 + Math.random() * 1.6, fam: "jugador", capa: MEDIO,
          estira: 1, roce: 1, prio: true,
        })) break;
        hechas++;
      }
      return hechas;
    },

    // ── GUION: emisiones repartidas en el tiempo ───────────
    //  Es la pieza que hace que la muerte de un jefe no sea "un sprite
    //  grande y una sacudida". Se apunta una secuencia de instantes con
    //  su función, y el reloj de VFX los va soltando.
    //
    //  Y sobre todo: reparte la CARGA. Lanzar 200 partículas en un
    //  fotograma es un tirón garantizado en el iPad; las mismas 200
    //  repartidas en veinte instantes no se notan.
    //
    //  El dt que recibe está ya escalado por el congelado de impacto,
    //  igual que el reloj de la muerte del jefe, así que los dos van
    //  sincronizados sin hacer nada.
    guion: function (pasos) {
      if (guiones.length >= 3) guiones.shift();   // nunca más de tres a la vez
      guiones.push({ t: 0, i: 0, pasos: pasos.slice(0, 48) });
    },
    guionesActivos: function () { return guiones.length; },
    pararGuiones: function () { guiones.length = 0; },

    // ── Anillos de choque ─────────────────────────────────
    onda: function (x, y, color, rMax, dur, grosor, deBoss) {
      // Los anillos de jefe tienen su propia porción del cupo: sin esto,
      // una muerte de jefe deja sin anillo a todo lo demás.
      if (deBoss && ondasDeBoss >= P.ondasBoss) return null;
      if (ondas.length >= P.ondas) return null;
      if (deBoss) ondasDeBoss++;
      var o = libresOndas.pop() || {};
      o.x = x; o.y = y; o.color = color; o.rMax = rMax;
      o.t = 0; o.life = dur || 0.45; o.grosor = grosor || 8;
      o.boss = !!deBoss;
      ondas.push(o);
      return o;
    },

    // ── Fogonazo de boca ──────────────────────────────────
    //  80 ms, pero es lo que ata el disparo a la nave. Sin él el arma
    //  parece que dispara sola desde algún sitio.
    fogonazo: function (x, y, color, tam) {
      if (fogos.length >= P.fogonazos) return null;
      var f = libresFogos.pop() || {};
      f.x = x; f.y = y; f.col = color; f.tam = tam;
      f.t = 0; f.life = 0.08;
      fogos.push(f);
      return f;
    },

    // ── SACUDIDA ──────────────────────────────────────────
    //  Centralizada, con prioridad y caída propia. Y SOLO de cámara:
    //  esto no escribe en la posición de nada. Lo comprueba una prueba,
    //  porque mover el mundo de verdad es el error clásico y se nota
    //  como "el juego se ha vuelto loco", no como impacto.
    sacudidas: [],
    sacudir: function (mag, dur, prio) {
      if (!api.escalaSacudida) return;
      var m = mag * api.escalaSacudida;
      if (m <= 0) return;
      var s = api.sacudidas;
      if (s.length >= P.sacudidas) {
        // Al tope: solo entra si es más importante que la más floja, y
        // entonces la sustituye. Nunca se acumulan diez sacudidas.
        var pe = 0;
        for (var i = 1; i < s.length; i++) if (s[i].prio < s[pe].prio) pe = i;
        if ((prio || 1) <= s[pe].prio) return;
        s.splice(pe, 1);
      }
      s.push({ mag: m, dur: dur, t: 0, prio: prio || 1 });
    },
    escalaSacudida: 1,

    // Desplazamiento de CÁMARA para este fotograma. Se llama una vez en
    // render() y no lo usa nadie más.
    desplazamiento: function () {
      var s = api.sacudidas, x = 0, y = 0;
      for (var i = 0; i < s.length; i++) {
        var k = 1 - s[i].t / s[i].dur;
        var m = s[i].mag * k * k;                 // caída cuadrática
        x += (Math.random() * 2 - 1) * m;
        y += (Math.random() * 2 - 1) * m;
      }
      // Techo duro. Con tres sacudidas sumando, sin esto la pantalla se
      // va del sitio y se deja de poder apuntar.
      var MAXD = 34;
      if (x > MAXD) x = MAXD; else if (x < -MAXD) x = -MAXD;
      if (y > MAXD) y = MAXD; else if (y < -MAXD) y = -MAXD;
      return { x: x, y: y };
    },

    // ── Ciclo ─────────────────────────────────────────────
    actualizar: function (dt) {
      var i, p;
      for (i = parts.length - 1; i >= 0; i--) {
        p = parts[i];
        p.t += dt;
        if (p.t >= p.life) { soltar(i); continue; }
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.grav) p.vy += p.grav * dt;
        if (p.roce !== 1) {
          var r = Math.pow(p.roce, dt * 60);
          p.vx *= r; p.vy *= r;
        }
        if (p.gira) p.ang += p.gira * dt;
      }
      for (i = ondas.length - 1; i >= 0; i--) {
        ondas[i].t += dt;
        if (ondas[i].t >= ondas[i].life) {
          if (ondas[i].boss && ondasDeBoss > 0) ondasDeBoss--;
          libresOndas.push(ondas.splice(i, 1)[0]);
        }
      }
      // Guiones: se sueltan los pasos cuyo instante ya ha pasado. Puede
      // caer más de uno en el mismo fotograma si el fotograma fue largo,
      // y está bien: lo que los frena es el tope por fotograma.
      for (i = guiones.length - 1; i >= 0; i--) {
        var g = guiones[i];
        g.t += dt;
        while (g.i < g.pasos.length && g.pasos[g.i].t <= g.t) {
          try { g.pasos[g.i].fn(); } catch (e) { met.rechazadas++; }
          g.i++;
        }
        if (g.i >= g.pasos.length) guiones.splice(i, 1);
      }
      for (i = fogos.length - 1; i >= 0; i--) {
        fogos[i].t += dt;
        if (fogos[i].t >= fogos[i].life) libresFogos.push(fogos.splice(i, 1)[0]);
      }
      var s = api.sacudidas;
      for (i = s.length - 1; i >= 0; i--) {
        s[i].t += dt;
        if (s[i].t >= s[i].dur) s.splice(i, 1);
      }
    },

    // Se llama al principio de cada fotograma del juego.
    frame: function (ms) {
      gastadoFrame = 0;
      gastadoBoss = 0;
      met.creadasFrame = 0;
      met.ms = ms;
      if (ms > met.msMax) met.msMax = ms;
      histMs.push(ms);
      if (histMs.length > HIST) histMs.shift();
      var suma = 0;
      for (var i = 0; i < histMs.length; i++) suma += histMs[i];
      met.msMedio = suma / Math.max(1, histMs.length);
      if (ms > 20) met.caidas++;
    },

    // ── Dibujo por capas ──────────────────────────────────
    dibujar: function (ctx, capa) {
      var i, p, k;
      if (capa === FONDO) {
        for (i = 0; i < ondas.length; i++) {
          var o = ondas[i];
          k = o.t / o.life;
          ctx.globalAlpha = (1 - k) * 0.85;
          ctx.strokeStyle = o.color;
          ctx.lineWidth = Math.max(1, o.grosor * (1 - k));
          ctx.beginPath();
          ctx.arc(o.x, o.y, o.rMax * (1 - Math.pow(1 - k, 2.2)), 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }

      ctx.globalCompositeOperation = "lighter";
      for (i = 0; i < parts.length; i++) {
        p = parts[i];
        if (p.capa !== capa) continue;
        k = 1 - p.t / p.life;
        ctx.globalAlpha = capa === FRENTE ? k * 0.5 : k;
        ctx.fillStyle = p.color;
        if (p.estira) {
          // Una chispa que vuela no es un punto: estirada en su
          // dirección se lee la velocidad sin gastar más partículas.
          var l = Math.min(14, Math.hypot(p.vx, p.vy) * 0.035);
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(Math.atan2(p.vy, p.vx));
          ctx.fillRect(-l, -p.r * 0.5, l * 2, p.r);
          ctx.restore();
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * (0.4 + k * 0.6), 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (capa === MEDIO) {
        for (i = 0; i < fogos.length; i++) {
          var f = fogos[i];
          k = 1 - f.t / f.life;
          ctx.globalAlpha = k;
          var rad = f.tam * (0.6 + k * 0.6);
          var g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, rad);
          g.addColorStop(0, "#ffffff");
          g.addColorStop(0.4, f.col);
          g.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(f.x, f.y, rad, 0, Math.PI * 2); ctx.fill();
        }
      }

      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
    },

    // ════════════════════════════════════════════════════════
    //  JEFES
    // ════════════════════════════════════════════════════════
    //  Un solo sistema para los diez, con ESTILOS por datos. Diez
    //  coreografías escritas a mano serían diez sitios donde arreglar
    //  el mismo bug, y ningún jefe nuevo heredaría nada.
    //
    //  `puente` lo rellena el juego con lo que VFX no tiene: los
    //  sprites de efecto, el sonido, la sacudida y el fogonazo. Así la
    //  coreografía vive aquí sin que VFX tenga que saber qué es un
    //  SPRITE ni un SONIDOS.
    puente: {
      vfx: null, sfx: null, sacudir: null, flash: null,
    },

    // ── Estilos ───────────────────────────────────────────
    //  colA/colB   los dos colores del jefe
    //  arcos       descargas eléctricas al morir y en fase final
    //  anillos     cuántos anillos concéntricos en la detonación
    //  metal       los restos pesan y caen (blindados)
    //  pulso       cada cuánto respira el aura, en segundos
    //  distorsion  anillos finos y rápidos, sin relleno (espacial)
    ESTILOS: {
      tecnologico: { arcos: 3, anillos: 2, metal: 0.6, pulso: 1.0, distorsion: 0, chispa: 1.0 },
      blindado:    { arcos: 0, anillos: 2, metal: 1.0, pulso: 1.4, distorsion: 0, chispa: 0.7 },
      rift:        { arcos: 1, anillos: 3, metal: 0.9, pulso: 0.8, distorsion: 1, chispa: 0.8 },
      toxico:      { arcos: 1, anillos: 4, metal: 0.3, pulso: 0.7, distorsion: 0, chispa: 1.2 },
      espacial:    { arcos: 2, anillos: 4, metal: 0.4, pulso: 0.9, distorsion: 1, chispa: 0.9 },
      reactor:     { arcos: 2, anillos: 5, metal: 0.5, pulso: 0.6, distorsion: 0, chispa: 1.3 },
      omega:       { arcos: 4, anillos: 6, metal: 0.8, pulso: 0.5, distorsion: 1, chispa: 1.4 },
    },

    // Qué estilo usa cada jefe. Añadir un jefe es añadir UNA línea; si
    // falta, cae a `tecnologico` y no se rompe nada.
    ESTILO_DE: {
      guardian:           "tecnologico",
      titan:              "blindado",
      rift_reaper:        "rift",
      aegis_prime:        "tecnologico",
      venom_core:         "toxico",
      warlord_vesper:     "blindado",
      singularity_warden: "espacial",
      pyre_lord:          "reactor",
      core_architect:     "tecnologico",
      omega_sovereign:    "omega",

      // Los cinco minijefes de la expansión (bloque 5F). Reutilizan los
      // estilos de siempre — ninguno es nuevo — elegidos por lo que ya
      // significan: `rift` es distorsión rápida y fina, que vale tanto
      // para el hielo cristalino como para una grieta de verdad.
      cazador_polar:      "rift",
      unidad_control:     "tecnologico",
      guardian_ruina:     "toxico",
      yunque_movil:       "blindado",
      heraldo_grieta:     "rift",

      // Los cinco jefes principales de la expansión (bloque 5G).
      // Tampoco añaden estilo nuevo: cada uno cae en el que ya describe
      // su mecánica — KRYOS son placas blindadas, VÉRTICE es una torre
      // de control, NÝX es la firma tóxica/alienígena de su mundo,
      // VULCANO respira como un reactor y AXIOMA, el final de la
      // expansión, se queda con el tratamiento máximo que hasta ahora
      // era solo de OMEGA SOVEREIGN.
      kryos:              "blindado",
      vertice:            "tecnologico",
      nyx:                "toxico",
      vulcano:            "reactor",
      axioma:             "omega",
    },

    estilo: function (tipo) {
      return api.ESTILOS[api.ESTILO_DE[tipo] || "tecnologico"];
    },

    // ── Aura ──────────────────────────────────────────────
    //  Se llama cada fotograma desde el jefe. `inten` va de 0 (recién
    //  llegado) a 1 (fase final): sube el latido, las partículas y la
    //  inestabilidad. Una sola función para los diez.
    bossAura: function (o) {
      var e = api.estilo(o.tipo);
      var inten = o.inten === undefined ? 0.4 : o.inten;
      // Cuántas partículas por segundo. En BAJO baja pero NO se apaga:
      // el aura es lo que dice "esto no es un enemigo normal".
      var ritmo = (2 + inten * 5) * (0.35 + P.escala * 0.65);
      if (Math.random() > ritmo * (o.dt || 0.016) * 10) return;
      var a = Math.random() * Math.PI * 2;
      var d = o.r * (0.8 + Math.random() * 0.5);
      api.part({
        x: o.x + Math.cos(a) * d, y: o.y + Math.sin(a) * d,
        vx: Math.cos(a) * (12 + inten * 40), vy: Math.sin(a) * (12 + inten * 40) - 18,
        life: 0.35 + Math.random() * 0.45,
        color: Math.random() < 0.3 ? "#ffffff" : o.color,
        r: (1.6 + Math.random() * 2.4) * (0.7 + inten * 0.5),
        fam: "bossAura", capa: FONDO, roce: 0.95,
      });
      // Fase final: descargas sueltas. Con hueco entre ellas a
      // propósito — "está al límite" se lee por contraste, y una
      // pantalla siempre llena no contrasta con nada.
      if (inten > 0.85 && e.arcos && Math.random() < 0.035) {
        var a2 = Math.random() * Math.PI * 2;
        api.chispas(o.x + Math.cos(a2) * o.r * 0.7, o.y + Math.sin(a2) * o.r * 0.7,
          4, "#ffffff", 1.1);
      }
    },

    // ── Impacto en el jefe, con freno ─────────────────────
    //  Un jefe recibe decenas de balas por segundo. Sin freno esto sería
    //  el sistema entero dedicado a los impactos del jefe, y encima
    //  taparía al jefe. Se acumula y se suelta como mucho cada 55 ms.
    bossImpacto: function (o) {
      var t = Date.now();
      bossHitAcum += o.dmg || 1;
      if (t - bossHitT < 55) return false;
      bossHitT = t;
      var e = api.estilo(o.tipo);
      var n = Math.min(8, 2 + Math.round(bossHitAcum * 0.35));
      bossHitAcum = 0;
      var ang = o.ang === undefined ? Math.random() * Math.PI * 2 : o.ang;
      for (var i = 0; i < n; i++) {
        var a = ang + (Math.random() - 0.5) * 2.2;
        var s = 60 + Math.random() * 170;
        if (!api.part({
          x: o.x, y: o.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
          life: 0.12 + Math.random() * 0.18,
          color: Math.random() < 0.4 * e.chispa ? "#ffffff" : o.color,
          r: 1 + Math.random() * 1.6, fam: "bossHit", capa: MEDIO,
          estira: 1, roce: 0.9,
        })) break;
      }
      return true;
    },

    // ── Cambio de fase ────────────────────────────────────
    bossFase: function (o) {
      var e = api.estilo(o.tipo);
      var final = !!o.final;
      // Anillo doble. El fino y rápido es lo que se LEE como cambio; el
      // ancho es el peso.
      api.onda(o.x, o.y, "#ffffff", o.r * (final ? 9 : 6.5), final ? 0.6 : 0.45, 3, true);
      api.onda(o.x, o.y, o.color, o.r * (final ? 13 : 9), final ? 0.8 : 0.6, final ? 7 : 5, true);
      if (e.distorsion) api.onda(o.x, o.y, o.color, o.r * 18, 1.0, 1.5, true);

      // Partículas en corona, no en bola: una corona dice "pulso" y una
      // bola dice "explosión", y esto no es una explosión.
      var n = Math.round((final ? 26 : 16) * (0.4 + P.escala * 0.6));
      for (var i = 0; i < n; i++) {
        var a = (i / n) * Math.PI * 2 + Math.random() * 0.3;
        var s = (140 + Math.random() * 180) * (final ? 1.3 : 1);
        api.part({
          x: o.x + Math.cos(a) * o.r * 0.6, y: o.y + Math.sin(a) * o.r * 0.6,
          vx: Math.cos(a) * s, vy: Math.sin(a) * s,
          life: 0.3 + Math.random() * 0.35,
          color: i % 3 ? o.color : "#ffffff",
          r: 1.6 + Math.random() * 2.2, fam: "bossFase", capa: MEDIO,
          estira: 1, roce: 0.92,
        });
      }
      // Arcos del estilo tecnológico/omega: descargas cortas radiales.
      if (e.arcos) {
        for (var j = 0; j < e.arcos; j++) {
          var aa = Math.random() * Math.PI * 2;
          api.chispas(o.x + Math.cos(aa) * o.r, o.y + Math.sin(aa) * o.r,
            5, "#ffffff", 1.2);
        }
      }
    },

    // ── MUERTE ────────────────────────────────────────────
    //  La secuencia entera, repartida en el tiempo con `guion`. Los
    //  instantes están en FRACCIÓN de la ventana que el juego ya tenía
    //  reservada para la agonía del jefe, así que no se cambia ni un
    //  timing: se llena lo que antes estaba medio vacío.
    //
    //  `puntos` son posiciones relativas del cuerpo (nodos, pods,
    //  reactores...). Las pasa el juego leyendo el estado que YA existe;
    //  aquí no se inventa ninguna hitbox.
    bossMuerte: function (o) {
      var e = api.estilo(o.tipo);
      var P0 = api.puente;
      var vent = o.ventana || 1.9;          // hasta la detonación principal
      var cola = o.cola || 1.2;             // después de ella
      var pts = (o.puntos && o.puntos.length) ? o.puntos : [
        [-0.62, -0.30], [0.62, -0.30], [-0.55, 0.42], [0.55, 0.42],
        [0.00, -0.62], [0.00, 0.55], [-0.85, 0.05], [0.85, 0.05],
      ];
      var pasos = [];
      var en = function (t, fn) { pasos.push({ t: t, fn: fn }); };
      var pt = function (i) {
        var p = pts[i % pts.length];
        return [o.x() + p[0] * o.r, o.y() + p[1] * o.r];
      };

      // T0 · fogonazo LOCALIZADO, no de pantalla. Nada de blanco a toda
      // pantalla sostenido: eso es lo que el brief prohíbe.
      en(0.04, function () {
        var q = pt(0);
        if (P0.vfx) P0.vfx("bloom", q[0], q[1], o.r * 2.2, 0.28);
        api.chispas(q[0], q[1], 10, "#ffffff", 1.2);
      });

      // T+0.1 · primera explosión interna
      en(vent * 0.06, function () {
        var q = pt(1);
        if (P0.vfx) P0.vfx("exp_basica", q[0], q[1], o.r * 1.5, 0.32);
        if (P0.sfx) P0.sfx("exp_peq", { vol: 0.6 });
        if (P0.sacudir) P0.sacudir("tiny");
        api.chispas(q[0], q[1], 12, o.color, 1.1);
      });

      // T+0.2..0.75 · SECUNDARIAS repartidas por el cuerpo. Ocho
      // estallidos en ocho sitios distintos: es lo que hace que se lea
      // como una nave enorme rompiéndose por partes y no como un sprite.
      var nSec = P.escala > 0.5 ? 8 : 5;
      for (var i = 0; i < nSec; i++) {
        (function (k) {
          en(vent * (0.14 + 0.62 * (k / nSec)), function () {
            var q = pt(k + 2);
            if (P0.vfx) P0.vfx(k % 2 ? "exp_basica" : "exp_media",
              q[0], q[1], o.r * (1.2 + Math.random() * 1.1), 0.34);
            if (P0.sfx) P0.sfx("exp_peq", { vol: 0.5 + Math.random() * 0.25 });
            if (P0.sacudir) P0.sacudir(k % 3 === 2 ? "small" : "tiny");
            api.chispas(q[0], q[1], 9, k % 2 ? o.color : "#ffcf5c", 1.2);
            if (e.metal > 0.5) api.part({
              x: q[0], y: q[1], vx: (Math.random() - 0.5) * 260, vy: -60 - Math.random() * 200,
              life: 0.7 + Math.random() * 0.6, color: "#ffcf5c",
              r: 1.6 + Math.random() * 2, fam: "debrisBoss", capa: MEDIO,
              estira: 1, roce: 0.985, grav: 300,
            });
            if (e.arcos && k % 3 === 0) api.chispas(q[0], q[1], 5, "#ffffff", 1.4);
          });
        })(i);
      }

      // T+0.35 · SHOCKWAVE grande, antes de la explosión final. Va
      // delante a propósito: la onda anuncia y la explosión remata.
      en(vent * 0.35, function () {
        api.onda(o.x(), o.y(), "#ffffff", o.r * 9, 0.55, 4, true);
        api.onda(o.x(), o.y(), o.color, o.r * 14, 0.8, 6, true);
        if (P0.sacudir) P0.sacudir("medium");
      });

      // T+0.4..0.8 · restos y energía, en tandas pequeñas
      var tandas = P.escala > 0.5 ? 5 : 3;
      for (var j = 0; j < tandas; j++) {
        (function (k) {
          en(vent * (0.42 + 0.34 * (k / tandas)), function () {
            var q = pt(k + 5);
            api.part({
              x: q[0], y: q[1], vx: (Math.random() - 0.5) * 300,
              vy: -80 - Math.random() * 220,
              life: 0.8 + Math.random() * 0.7, color: k % 2 ? "#ffcf5c" : o.color,
              r: 1.4 + Math.random() * 2.2, fam: "debrisBoss", capa: MEDIO,
              estira: 1, roce: 0.985, grav: 320 * e.metal,
            });
            api.chispas(q[0], q[1], 6, o.color, 1);
          });
        })(j);
      }

      // T+vent · EXPLOSIÓN PRINCIPAL. La lanza el juego (es donde ya
      // estaba y donde suena `exp_boss`); aquí van sus capas de
      // partículas y sus anillos concéntricos, que son lo que
      // diferencia un estilo de otro.
      en(vent, function () {
        for (var a = 0; a < e.anillos; a++) {
          api.onda(o.x(), o.y(), a % 2 ? o.color : "#ffffff",
            o.r * (6 + a * 3.2), 0.55 + a * 0.14, Math.max(1.5, 6 - a), true);
        }
        var n = Math.round((o.epico ? 60 : 40) * (0.4 + P.escala * 0.6));
        for (var i2 = 0; i2 < n; i2++) {
          var ang = Math.random() * Math.PI * 2;
          var s2 = (120 + Math.random() * 420) * (o.epico ? 1.3 : 1);
          if (!api.part({
            x: o.x(), y: o.y(), vx: Math.cos(ang) * s2, vy: Math.sin(ang) * s2,
            life: 0.4 + Math.random() * 0.6,
            color: i2 % 4 === 0 ? "#ffffff" : (i2 % 3 ? o.color : "#ffcf5c"),
            r: 1.8 + Math.random() * 3, fam: "bossMuerte", capa: MEDIO,
            estira: 1, roce: 0.94,
          })) break;
        }
      });

      // T+vent..+cola · COLA. Fallos que siguen saliendo del casco ya
      // muerto mientras la nave cae. Es lo que hace que no se sienta
      // como un interruptor.
      var nCola = P.escala > 0.5 ? 7 : 4;
      for (var c2 = 0; c2 < nCola; c2++) {
        (function (k) {
          en(vent + cola * (0.1 + 0.8 * (k / nCola)), function () {
            var q = pt(k + 1);
            if (P0.vfx && k % 2 === 0) P0.vfx("exp_basica", q[0], q[1], o.r * 0.9, 0.3);
            if (P0.sfx && k % 2 === 0) P0.sfx("exp_peq", { vol: 0.35 });
            api.chispas(q[0], q[1], 5, o.color, 0.8);
            api.part({
              x: q[0], y: q[1], vx: (Math.random() - 0.5) * 120, vy: -30 - Math.random() * 90,
              life: 0.7 + Math.random() * 0.6, color: "#ffcf5c",
              r: 2 + Math.random() * 2.6, fam: "bossMuerte", capa: FONDO, roce: 0.96,
            });
          });
        })(c2);
      }

      api.guion(pasos);
      return pasos.length;
    },

    limpiar: function () {
      guiones.length = 0;
      bossHitAcum = 0; ondasDeBoss = 0;
      while (parts.length) soltar(parts.length - 1);
      while (ondas.length) libresOndas.push(ondas.pop());
      while (fogos.length) libresFogos.push(fogos.pop());
      api.sacudidas.length = 0;
      met.picoParts = 0; met.rechazadas = 0; met.msMax = 0; met.caidas = 0;
      desalojadas = 0;
    },

    // ── Métricas ──────────────────────────────────────────
    metricas: function () {
      return {
        calidad: calidad, pedida: pedida, auto: auto,
        parts: parts.length, maxParts: P.total, pico: met.picoParts,
        porFrame: met.creadasFrame, topeFrame: P.porFrame,
        rechazadas: met.rechazadas,
        fam: { chispa: cuenta.chispa, debris: cuenta.debris, estela: cuenta.estela,
               humo: cuenta.humo, motor: cuenta.motor, jugador: cuenta.jugador,
               bossAura: cuenta.bossAura, bossHit: cuenta.bossHit,
               bossFase: cuenta.bossFase, bossMuerte: cuenta.bossMuerte,
               debrisBoss: cuenta.debrisBoss, ui: cuenta.ui },
        desalojadas: desalojadas,
        boss: cuenta.bossAura + cuenta.bossHit + cuenta.bossFase +
              cuenta.bossMuerte + cuenta.debrisBoss,
        porFrameBoss: gastadoBoss, topeFrameBoss: P.porFrameBoss,
        guiones: guiones.length,
        ondasBoss: ondasDeBoss, maxOndasBoss: P.ondasBoss,
        flash: P.flash,
        limFam: P.fam,
        reserva: libres.length,
        ondas: ondas.length, maxOndas: P.ondas,
        fogos: fogos.length,
        sacudidas: api.sacudidas.length, maxSacudidas: P.sacudidas,
        ms: met.ms, msMax: met.msMax, msMedio: met.msMedio, caidas: met.caidas,
      };
    },
  };

  return api;
})();
