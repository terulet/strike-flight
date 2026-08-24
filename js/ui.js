// ════════════════════════════════════════════════════════════
//  ui.js — presentación: transiciones, avisos y lenguaje común
// ════════════════════════════════════════════════════════════
//
//  <script src> clásico, como los otros tres.
//
//  ── Qué resuelve ──
//
//  El juego cambiaba de pantalla asignando una variable. Funciona, pero
//  se ve como lo que es: un corte seco. Aquí vive el BARRIDO que tapa
//  ese corte, el sistema de avisos de desbloqueo —reutilizable, porque
//  el hangar va a necesitar el mismo— y las constantes que hacen que
//  todas las pantallas parezcan de la misma época.
//
//  ── Dos reglas ──
//
//  1. CORTO. Una transición de medio segundo se siente elegante la
//     primera vez y un peaje la décima. 340 ms en total, y el cambio de
//     pantalla ocurre a mitad, cuando la pantalla está tapada.
//
//  2. La UI NO compite con el combate. Sus partículas tienen familia y
//     tope propios, y durante la partida se usan con cuentagotas: lo
//     único que las pide en juego es el récord nuevo.

var UI = (function () {
  "use strict";

  // ── Lenguaje visual común ───────────────────────────────
  //  Los colores POR IMPORTANCIA, no por gusto. Que el rojo signifique
  //  siempre lo mismo es lo que permite leer una pantalla sin leerla.
  var COL = {
    oro:      "#ffd700",   // logro, récord, puntuación
    peligro:  "#ff3b5c",   // irreversible: abandonar, borrar
    aviso:    "#ff8a1f",   // atención, algo no va
    apagado:  "rgba(255,255,255,0.28)",
    texto:    "#ffffff",
    tenue:    "rgba(255,255,255,0.5)",
  };

  // Tipografía por jerarquía. Un solo sitio: si cada pantalla elige su
  // tamaño, cada pantalla parece de un juego distinto.
  var TIPO = {
    titulo:   { peso: 800, tam: [26, 44], esp: 3.0 },
    seccion:  { peso: 800, tam: [9, 11],  esp: 3.0 },
    etiqueta: { peso: 700, tam: [10, 10], esp: 1.6 },
    cifra:    { peso: 800, tam: [12, 12], esp: 0 },
    boton:    { peso: 800, tam: [13, 16], esp: 2.4 },
  };

  // ── Transición ──────────────────────────────────────────
  var tr = { activa: false, t: 0, dur: 0.34, fn: null, hecho: false, col: null };

  // ── Avisos de desbloqueo ────────────────────────────────
  //  Cola, no una variable: al terminar la M2 puede desbloquearse la
  //  misión Y (en el bloque 4) una nave. Dos avisos pisándose no se leen.
  var cola = [], aviso = null;

  // ── Contadores animados ─────────────────────────────────
  var cifras = {};

  // ── Pulsación ───────────────────────────────────────────
  //  En una tablet no hay hover: el ÚNICO momento en que el jugador
  //  recibe confirmación de que ha acertado el botón es mientras tiene
  //  el dedo encima. Sin esto, tocar y que no pase nada se siente como
  //  que el juego se ha colgado.
  var pulsado = null;

  var api = {
    COL: COL, TIPO: TIPO,

    // ── Transición ────────────────────────────────────────
    //  `fn` se ejecuta a MITAD del barrido, con la pantalla tapada.
    ir: function (fn, col) {
      if (tr.activa) {
        // Ya hay un barrido en marcha. Manda la intención MÁS NUEVA: si
        // el jugador toca dos botones seguidos, va a donde apuntó el
        // último. Ejecutar la nueva en el acto dejaba que la vieja se
        // aplicara DESPUÉS, al llegar a su mitad, y acababa en la
        // pantalla equivocada.
        if (!tr.hecho) { tr.fn = fn || null; if (col) tr.col = col; }
        else { try { if (fn) fn(); } catch (e) {} }
        return;
      }
      tr.activa = true; tr.t = 0; tr.fn = fn || null; tr.hecho = false;
      tr.col = col || null;
    },
    enTransicion: function () { return tr.activa; },
    // Progreso 0..1, para que quien quiera pueda atenuar algo con él.
    tapado: function () {
      if (!tr.activa) return 0;
      var k = tr.t / tr.dur;
      return k < 0.5 ? k * 2 : (1 - k) * 2;
    },

    // ── Desbloqueos ───────────────────────────────────────
    //  Genérico a propósito: tipo + icono + título + descripción. El
    //  bloque del hangar solo tiene que llamar con tipo "nave" o "skin"
    //  y ya está; no hay que tocar nada de aquí.
    desbloqueo: function (o) {
      if (cola.length >= 4) return;
      cola.push({
        tipo: o.tipo || "mision",
        titulo: o.titulo || "",
        desc: o.desc || "",
        sprite: o.sprite || null,
        color: o.color || COL.oro,
        t: 0, dur: o.dur || 2.6,
      });
    },
    hayAviso: function () { return !!aviso || cola.length > 0; },
    avisoActual: function () { return aviso; },
    limpiarAvisos: function () { cola.length = 0; aviso = null; },

    // ── Contadores ────────────────────────────────────────
    //  Sube hacia el objetivo en 0,5 s como mucho. Un contador que tarda
    //  tres segundos en llegar no es emoción, es esperar.
    cifra: function (id, objetivo) {
      var c = cifras[id];
      if (!c) { c = cifras[id] = { v: 0, obj: objetivo }; }
      if (c.obj !== objetivo) { c.obj = objetivo; }
      return Math.round(c.v);
    },
    reiniciarCifras: function () { cifras = {}; },

    // ── Pulsación ─────────────────────────────────────────
    pulsar: function (r) { pulsado = r; },
    soltar: function () { pulsado = null; },
    estaPulsado: function (x, y, w, h) {
      return !!pulsado && pulsado.x === x && pulsado.y === y &&
             pulsado.w === w && pulsado.h === h;
    },

    // ── Ciclo ─────────────────────────────────────────────
    //  `dt` REAL, sin el congelado de impacto: la interfaz no se
    //  ralentiza porque el jugador acabe de reventar un jefe.
    tick: function (dt) {
      if (tr.activa) {
        tr.t += dt;
        if (!tr.hecho && tr.t >= tr.dur / 2) {
          tr.hecho = true;
          try { if (tr.fn) tr.fn(); } catch (e) {}
          tr.fn = null;
        }
        if (tr.t >= tr.dur) { tr.activa = false; tr.t = 0; }
      }
      if (!aviso && cola.length) aviso = cola.shift();
      if (aviso) {
        aviso.t += dt;
        if (aviso.t >= aviso.dur) aviso = null;
      }
      for (var k in cifras) {
        var c = cifras[k];
        if (c.v === c.obj) continue;
        // Al 12 % de lo que falta por fotograma, con un mínimo: así las
        // cifras grandes no tardan más que las pequeñas.
        var d = c.obj - c.v;
        var paso = Math.max(Math.abs(d) * 0.12, Math.abs(c.obj) * 0.02, 1) * (dt * 60);
        if (Math.abs(d) <= paso) c.v = c.obj;
        else c.v += Math.sign(d) * paso;
      }
    },

    // ── Dibujo del barrido ────────────────────────────────
    //  Dos bandas que cierran desde arriba y abajo con un filo brillante,
    //  y se abren al revés. Es tecnológico sin ser un efecto caro: dos
    //  rectángulos y dos líneas.
    dibujarTransicion: function (ctx, W, H, acento) {
      if (!tr.activa) return;
      var k = tr.t / tr.dur;
      // Cerrar (0→0.5) y abrir (0.5→1), con una curva que frena al
      // final del cierre para que el cambio no se note.
      var c = k < 0.5 ? Math.pow(k * 2, 0.7) : Math.pow((1 - k) * 2, 0.7);
      var alto = (H / 2) * c;
      var col = tr.col || acento || "#5ce1ff";
      ctx.save();
      ctx.fillStyle = "#04050c";
      ctx.fillRect(0, 0, W, alto);
      ctx.fillRect(0, H - alto, W, alto);
      if (alto > 1) {
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = col;
        ctx.fillRect(0, alto - 2, W, 2);
        ctx.fillRect(0, H - alto, W, 2);
        // Un resplandor corto por dentro del filo: es lo que lo hace
        // leerse como energía y no como una persiana.
        ctx.globalAlpha = 0.3;
        var g1 = ctx.createLinearGradient(0, alto - 26, 0, alto);
        g1.addColorStop(0, "rgba(0,0,0,0)"); g1.addColorStop(1, col);
        ctx.fillStyle = g1; ctx.fillRect(0, alto - 26, W, 26);
        var g2 = ctx.createLinearGradient(0, H - alto + 26, 0, H - alto);
        g2.addColorStop(0, "rgba(0,0,0,0)"); g2.addColorStop(1, col);
        ctx.fillStyle = g2; ctx.fillRect(0, H - alto, W, 26);
      }
      ctx.restore();
    },

    // ── Dibujo del aviso de desbloqueo ────────────────────
    //  Entra desde la derecha, se queda y se va. Arriba, fuera del
    //  camino: durante una partida no puede taparle a nadie el centro
    //  de la pantalla.
    dibujarAviso: function (ctx, W, H, safeTop, dibujarSprite) {
      if (!aviso) return;
      var a = aviso;
      var k = a.t / a.dur;
      // Entra en 0,22, se queda, sale en los últimos 0,3.
      var ap = Math.min(1, a.t / 0.22, (a.dur - a.t) / 0.3);
      var desliz = (1 - Math.min(1, a.t / 0.22));
      var anchoP = Math.min(W - 36, 330), alto = 66;
      var x = (W - anchoP) / 2 + desliz * (W * 0.5);
      var y = safeTop + 76;

      ctx.save();
      ctx.globalAlpha = ap;
      // Panel
      ctx.fillStyle = "rgba(6,9,22,0.92)";
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x, y, anchoP, alto, 14); else ctx.rect(x, y, anchoP, alto);
      ctx.fill();
      // Filo con latido, del color del tipo
      var pul = 0.6 + 0.4 * Math.sin(a.t * 7);
      ctx.strokeStyle = a.color; ctx.globalAlpha = ap * (0.5 + pul * 0.5);
      ctx.lineWidth = 1.5; ctx.stroke();
      // Barra izquierda: el ancla de color. No se depende SOLO del
      // color —el título dice el tipo con palabras— pero ayuda.
      ctx.globalAlpha = ap;
      ctx.fillStyle = a.color;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x, y, 4, alto, 2); else ctx.rect(x, y, 4, alto);
      ctx.fill();

      // Icono
      var ix = x + 40;
      if (a.sprite && dibujarSprite) {
        dibujarSprite(a.sprite, ix, y + alto / 2, 40);
      } else {
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = ap * (0.5 + pul * 0.35);
        var g = ctx.createRadialGradient(ix, y + alto / 2, 0, ix, y + alto / 2, 20);
        g.addColorStop(0, a.color); g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(ix, y + alto / 2, 20, 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = ap;
        ctx.strokeStyle = a.color; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(ix, y + alto / 2, 11, 0, Math.PI * 2); ctx.stroke();
      }

      ctx.textAlign = "left"; ctx.textBaseline = "middle";
      ctx.fillStyle = a.color;
      ctx.font = "800 9px " + api.fuente;
      ctx.fillText(api.ETIQUETA[a.tipo] || "DESBLOQUEADO", x + 68, y + 22);
      ctx.fillStyle = COL.texto;
      ctx.font = "800 13px " + api.fuente;
      ctx.fillText(a.titulo, x + 68, y + 39, anchoP - 84);
      if (a.desc) {
        ctx.fillStyle = COL.tenue;
        ctx.font = "600 9px " + api.fuente;
        ctx.fillText(a.desc, x + 68, y + 54, anchoP - 84);
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    },

    // Las etiquetas por tipo. El bloque 4 añade las suyas aquí.
    ETIQUETA: {
      mision: "MISIÓN DESBLOQUEADA",
      nave:   "NAVE DESBLOQUEADA",
      skin:   "ASPECTO DESBLOQUEADO",
      logro:  "LOGRO",
      record: "NUEVO RÉCORD",
    },

    fuente: "-apple-system, system-ui, Segoe UI, Roboto, sans-serif",
  };

  return api;
})();
