// ════════════════════════════════════════════════════════════
//  music.js — música dinámica de FLIGHT STRIKE
// ════════════════════════════════════════════════════════════
//
//  Se carga con <script src> CLÁSICO, antes del bloque del juego. Nada
//  de módulos ES: con file:// el navegador los bloquea por CORS y el
//  juego tiene que seguir abriéndose con doble clic.
//
//  ── Por qué <audio> y no decodeAudioData ──
//
//  Porque estas pistas son largas. Una pista estéreo de 44,1 kHz ocupa
//  10,6 MB por minuto DESCODIFICADA, y aquí hay pistas de dos y tres
//  minutos: el menú solo son 64 MB, y un cruce menú→combate tendría
//  92 MB de audio vivo a la vez. Safari en el iPad mata la pestaña.
//
//  El elemento <audio> TRANSMITE: no descodifica la pista entera, así
//  que el coste de memoria es de kilobytes. Y pasándolo por
//  createMediaElementSource entra en el mismo grafo que los efectos,
//  con lo que el silencio, el volumen de música y el agachado salen
//  gratis, igual que con búferes.
//
//  ── Las dos rutas ──
//
//    webaudio  el camino bueno. Elemento → MediaElementSource → filtro
//              → agachado → BUS.musica. Cruces de potencia constante
//              programados en el reloj del audio, no en el del juego.
//    elemento  el repuesto para file://. En Chrome un medio de origen
//              file: se considera opaco y MediaElementSource saldría
//              MUDO, así que ahí no se usa: se controla el volumen del
//              propio elemento y se renuncia al agachado y al filtro.
//
//  ── Regla que gobierna todo el archivo ──
//
//  Nada de aquí puede impedir que el juego arranque ni tirar el bucle.
//  Todo va envuelto, y si algo falla el sistema se apaga solo y el
//  juego sigue exactamente como estaba antes de que existiera.

var MUSICA = (function () {
  "use strict";

  // ── Catálogo ────────────────────────────────────────────
  //  Copiado a mano de audio/MUSICA.json y no leído de él: leerlo
  //  necesitaría fetch(), que con file:// está prohibido, y entonces la
  //  ruta de repuesto se quedaría sin saber qué pistas existen.
  //  `dur` es la duración real medida; se usa para programar el bucle,
  //  porque el `duration` del elemento incluye el relleno del códec.
  //  `fade` es cuánto dura el cruce de la pista CONSIGO MISMA.
  var CATALOGO = {
    menu:       { archivo: "menu.mp3",       dur: 80.000,  bucle: true,  fade: 2.00 },
    combate_a:  { archivo: "combate_a.mp3",  dur: 82.235,  bucle: true,  fade: 1.00 },
    combate_b:  { archivo: "combate_b.mp3",  dur: 80.000,  bucle: true,  fade: 2.00 },
    hangar:     { archivo: "hangar.mp3",     dur: 124.000, bucle: true,  fade: 4.00 },
    jefe:       { archivo: "jefe.mp3",       dur: 102.400, bucle: true,  fade: 0.15 },
    jefe_final: { archivo: "jefe_final.mp3", dur: 33.926,  bucle: true,  fade: 1.00 },
    mision:     { archivo: "mision.mp3",     dur: 2.800,   bucle: false, fade: 0 },
    victoria:   { archivo: "victoria.mp3",   dur: 3.600,   bucle: false, fade: 0 },
    derrota:    { archivo: "derrota.mp3",    dur: 3.800,   bucle: false, fade: 0 },
    unlock:     { archivo: "unlock.mp3",     dur: 1.600,   bucle: false, fade: 0 },

    // ── Bloque 5I — pistas propias de la expansión (M11-M20) ──
    //  Igual que las de arriba: se cargan por `src` solo cuando `ir()`
    //  las pide de verdad (ver `cargar()`), así que estar aquí no baja
    //  ni un byte por sí solo. `dur` es la medida real de
    //  herramientas/preparar-musica-expansion.mjs, no un número a ojo.
    //  Las cinco son bucles de compás exacto (comprobado con ffprobe: p.
    //  ej. combate_c dura 88,615 s = 48 compases a 130 BPM), así que el
    //  cruce puede ser tan corto como el de "jefe".
    combate_c:  { archivo: "combate_c.mp3",  dur: 88.615,  bucle: true,  fade: 0.15 },
    combate_d:  { archivo: "combate_d.mp3",  dur: 130.286, bucle: true,  fade: 0.15 },
    combate_e:  { archivo: "combate_e.mp3",  dur: 89.143,  bucle: true,  fade: 0.15 },
    jefe2:      { archivo: "jefe2.mp3",      dur: 104.229, bucle: true,  fade: 0.15 },
    final2:     { archivo: "final2.mp3",     dur: 130.909, bucle: true,  fade: 0.15 },
  };
  var CARPETA = "audio/musica/";

  // ── Estados ─────────────────────────────────────────────
  //  `vol` es la mezcla ENTRE ESTADOS, y vive aquí a propósito: en el
  //  archivo quedaría escondida, y todas las pistas están normalizadas
  //  al mismo −16 LUFS justo para que esta tabla sea la única que
  //  decide qué suena más fuerte que qué.
  //
  //  El jefe va +1,2 dB sobre el combate. Más que eso empieza a tapar
  //  los avisos de ataque, que es información, no decoración.
  var ESTADOS = {
    menu:       { pista: "menu",       vol: 1.00, cruce: 1.2 },
    hangar:     { pista: "hangar",     vol: 0.85, cruce: 1.5 },
    combate:    { pista: "combate_a",  vol: 0.95, cruce: 1.0 },
    jefe:       { pista: "jefe",       vol: 1.15, cruce: 0.8 },
    jefe_final: { pista: "jefe_final", vol: 1.15, cruce: 0.8 },
    silencio:   { pista: null,         vol: 0,    cruce: 1.0 },
  };

  var api = null;
  var modo = "espera";          // espera · webaudio · elemento · off
  var estadoActual = null;      // clave de ESTADOS
  var pistaPedida = null;       // id de CATALOGO que debería sonar
  var pendiente = null;         // lo que se quería sonar antes del gesto
  var desbloqueado = false;
  var voces = [], activa = null;
  var vozStinger = null, stingerHasta = 0;
  var nodoFiltro = null, nodoDuck = null;
  var duckHasta = 0, duckNivel = 1;
  var intensidadObj = 1, intensidadAct = 1;
  var reloj = null;
  var dbg = { motivo: "", fallos: 0, cargadas: 0, ultimo: "—" };

  var ahora = function () {
    return (api && api.ctx && api.ctx()) ? api.ctx().currentTime : 0;
  };
  var opciones = function () { return (api && api.opciones) || {}; };

  // Multiplicador que hay que aplicar A MANO en la ruta de repuesto.
  // En la ruta buena lo hace BUS.musica y aquí vale 1, o se aplicaría
  // dos veces.
  function maestro() {
    if (modo === "webaudio") return 1;
    var o = opciones();
    if (o.silencio) return 0;
    var m = typeof o.volMaster === "number" ? o.volMaster : 1;
    var mus = typeof o.volMusica === "number" ? o.volMusica : 1;
    return m * mus;
  }

  // ── Voces ───────────────────────────────────────────────
  function crearVoz(nombre, directa) {
    var v = { el: null, nodo: null, gain: null, id: null,
              valor: 0, objetivo: 0, rampa: null, directa: !!directa };
    try {
      v.el = new Audio();
      v.el.preload = "auto";
      v.el.loop = false;      // el bucle lo hacemos nosotros, cruzando
      v.el.volume = 0;
      // Colgado del documento y no suelto. Un elemento suelto suena
      // igual, pero uno que está en el árbol se puede inspeccionar
      // desde el navegador y lo alcanzan las pruebas: sin esto, la
      // prueba de "vuelve de segundo plano" no encontraba nada que
      // parar y pasaba sin comprobar nada.
      v.el.setAttribute("data-musica", nombre);
      v.el.style.display = "none";
      if (document.body) document.body.appendChild(v.el);
    } catch (e) { return null; }

    if (modo === "webaudio") {
      try {
        var ctx = api.ctx();
        v.nodo = ctx.createMediaElementSource(v.el);
        v.gain = ctx.createGain();
        v.gain.gain.value = 0;
        v.el.volume = 1;      // el volumen lo lleva el nodo, no el elemento
        v.nodo.connect(v.gain);
        v.gain.connect(v.directa ? api.bus() : nodoFiltro);
      } catch (e) {
        dbg.motivo = "MediaElementSource: " + e.message;
        return null;
      }
    }
    return v;
  }

  // Rampa de POTENCIA CONSTANTE. Dos rampas lineales cruzadas dejan un
  // hoyo de 3 dB justo en el centro del cruce: eso es exactamente el
  // "corte feo" que hay que evitar. Con seno y coseno la suma de los
  // cuadrados es 1 en todo el recorrido y el cruce no se oye.
  function rampa(v, hasta, dur) {
    if (!v) return;
    v.objetivo = hasta;
    // Una voz que se apaga hay que PARARLA cuando termine de apagarse.
    // Si no, se queda transmitiendo y descodificando en silencio hasta
    // el final del archivo — dos minutos de trabajo para nada, que en
    // el iPad se paga en batería y en fotogramas.
    v.paraEn = hasta <= 0 ? Date.now() / 1000 + Math.max(0.05, dur) + 0.08 : 0;
    if (modo === "webaudio" && v.gain) {
      var g = v.gain.gain, t = ahora(), desde = v.valor;
      try {
        g.cancelScheduledValues(t);
        if (dur <= 0.02) { g.setValueAtTime(hasta, t); v.valor = hasta; v.rampa = null; return; }
        var N = 48, curva = new Float32Array(N), sube = hasta > desde;
        for (var i = 0; i < N; i++) {
          var k = i / (N - 1);
          curva[i] = sube ? desde + (hasta - desde) * Math.sin(k * Math.PI / 2)
                          : hasta + (desde - hasta) * Math.cos(k * Math.PI / 2);
        }
        g.setValueCurveAtTime(curva, t, dur);
      } catch (e) { try { g.value = hasta; } catch (_) {} }
      v.valor = hasta;
      v.rampa = null;
    } else {
      // Repuesto: se interpola en el tic. 60 ms de paso no producen
      // escalones audibles en una rampa de más de medio segundo.
      v.rampa = dur <= 0.02 ? null : { desde: v.valor, hasta: hasta, t: 0, dur: dur, sube: hasta > v.valor };
      if (!v.rampa) { v.valor = hasta; aplicarVol(v); }
    }
  }

  function aplicarVol(v) {
    if (modo === "webaudio" || !v || !v.el) return;
    var d = duckNivel;
    try { v.el.volume = Math.max(0, Math.min(1, v.valor * maestro() * (v.directa ? 1 : d))); } catch (_) {}
  }

  // Deja la voz cargada y EN EL PRINCIPIO.
  //
  //  Rebobinar con load() y no con currentTime = 0 no es manía: saltar a
  //  una posición cualquiera necesita que el servidor sirva rangos
  //  HTTP, y no todos lo hacen —el servidor de las pruebas no lo hacía,
  //  y ahí CUALQUIER salto acababa en 0—. load() rebobina siempre, en
  //  cualquier servidor y también con file://, y el archivo ya está en
  //  la caché del navegador, así que no cuesta una descarga.
  function cargar(v, id) {
    var c = CATALOGO[id];
    if (!v || !c) return false;
    try {
      if (v.id === id) {
        if (v.el.currentTime > 0.05 || v.el.ended) v.el.load();
        return true;
      }
      v.el.src = CARPETA + c.archivo;
      v.el.load();
      v.id = id;
      dbg.cargadas++;
      return true;
    } catch (e) { dbg.fallos++; dbg.motivo = "carga: " + e.message; return false; }
  }

  // Suena. Y NO toca currentTime: un elemento en pausa conserva su
  // posición, así que reanudar es solo darle al play. Tocarlo era lo
  // que hacía que volver de segundo plano empezara la pista otra vez
  // desde el principio.
  function arrancar(v) {
    if (!v || !v.el) return;
    var p;
    try { p = v.el.play(); } catch (e) { dbg.fallos++; dbg.motivo = "play: " + e.message; return; }
    // Un play() rechazado NO es un error del que haya que informar: en
    // iOS es lo normal antes del primer gesto. Se anota y ya; el
    // siguiente toque lo vuelve a intentar.
    if (p && p.catch) p.catch(function (e) { dbg.motivo = "play: " + (e && e.name || "?"); });
  }

  function parar(v) {
    if (!v || !v.el) return;
    try { v.el.pause(); } catch (_) {}
    v.valor = 0; v.objetivo = 0; v.rampa = null;
    if (modo === "webaudio" && v.gain) { try { v.gain.gain.cancelScheduledValues(ahora()); v.gain.gain.value = 0; } catch (_) {} }
    else aplicarVol(v);
  }

  function otra(v) { return voces[0] === v ? voces[1] : voces[0]; }

  // ── Cambio de estado ────────────────────────────────────
  function ir(pista, vol, cruce) {
    if (modo === "off") return;
    // Antes del primer gesto —y antes incluso de que exista el
    // contexto— se apunta y ya. El juego pide música desde el primer
    // fotograma, mucho antes de que el jugador toque nada, y eso tiene
    // que quedar guardado en vez de perderse.
    if (!desbloqueado || !voces.length) { pendiente = { pista: pista, vol: vol, cruce: cruce }; return; }

    var saliente = activa;
    if (saliente && saliente.id === pista) {
      // Misma pista, distinto volumen de estado: no se reinicia nada.
      rampa(saliente, vol, cruce);
      return;
    }
    if (saliente) rampa(saliente, 0, cruce);

    if (!pista) { activa = null; return; }

    var entrante = saliente ? otra(saliente) : voces[0];
    if (entrante && entrante.el && !entrante.el.paused && entrante !== saliente) parar(entrante);
    if (!cargar(entrante, pista)) return;
    entrante.valor = 0;
    if (modo === "webaudio" && entrante.gain) { try { entrante.gain.gain.value = 0; } catch (_) {} }
    arrancar(entrante);
    rampa(entrante, vol, cruce);
    activa = entrante;
  }

  // ── El tic ──────────────────────────────────────────────
  //  Va por su cuenta con setInterval y NO colgado del bucle del juego,
  //  por dos razones: la música tiene que seguir sonando con el juego en
  //  pausa, y el bucle del juego deforma su dt con el congelado de
  //  impacto — un cruce medido con ese dt se desafinaría.
  function tic() {
    if (modo === "off") return;
    try {
      var t = Date.now() / 1000;

      // Rampas de la ruta de repuesto
      if (modo !== "webaudio") {
        for (var i = 0; i < voces.length; i++) {
          var v = voces[i];
          if (!v || !v.rampa) continue;
          v.rampa.t += 0.06;
          var k = Math.min(1, v.rampa.t / v.rampa.dur);
          var r = v.rampa;
          v.valor = r.sube ? r.desde + (r.hasta - r.desde) * Math.sin(k * Math.PI / 2)
                           : r.hasta + (r.desde - r.hasta) * Math.cos((1 - k) * Math.PI / 2);
          if (k >= 1) { v.valor = r.hasta; v.rampa = null; }
          aplicarVol(v);
        }
        if (vozStinger && vozStinger.rampa) aplicarVol(vozStinger);
      }

      // Voces ya desvanecidas: se paran para que dejen de descodificar.
      for (var j = 0; j < voces.length; j++) {
        var vv = voces[j];
        if (vv && vv !== activa && vv.paraEn && t > vv.paraEn) { vv.paraEn = 0; parar(vv); }
      }

      // Fin del agachado
      if (duckHasta && t > duckHasta) { duckHasta = 0; ponerDuck(1, 0.35); }

      // Fin del stinger: se devuelve el bucle a su sitio
      if (stingerHasta && t > stingerHasta) {
        stingerHasta = 0;
        ponerDuck(1, 0.5);
        if (vozStinger) parar(vozStinger);
      }

      // Bucle por cruce consigo misma
      var a = activa;
      if (a && a.id && a.el && !a.el.paused) {
        var c = CATALOGO[a.id];
        if (c && c.bucle && a.objetivo > 0) {
          var dur = c.dur;
          var fade = Math.max(0.08, c.fade);
          if (a.el.currentTime >= dur - fade) {
            var b = otra(a);
            if (b && cargar(b, a.id)) {
              var destino = a.objetivo;
              rampa(a, 0, fade);
              b.valor = 0;
              if (modo === "webaudio" && b.gain) { try { b.gain.gain.value = 0; } catch (_) {} }
              arrancar(b);
              rampa(b, destino, fade);
              activa = b;
              // La saliente se para sola cuando llega al final del
              // archivo; no hace falta programar nada más.
            }
          }
        }
      }
    } catch (e) {
      dbg.fallos++; dbg.motivo = "tic: " + e.message;
      if (dbg.fallos > 40) { modo = "off"; dbg.motivo = "apagada tras 40 fallos"; }
    }
  }

  function ponerDuck(nivel, dur) {
    duckNivel = nivel;
    if (modo === "webaudio" && nodoDuck) {
      var g = nodoDuck.gain, t = ahora();
      try {
        g.cancelScheduledValues(t);
        g.setValueAtTime(g.value, t);
        g.linearRampToValueAtTime(nivel, t + Math.max(0.01, dur));
      } catch (_) { try { g.value = nivel; } catch (__) {} }
    } else {
      for (var i = 0; i < voces.length; i++) aplicarVol(voces[i]);
    }
  }

  function ponerIntensidad(k, dur) {
    intensidadObj = Math.max(0, Math.min(1, k));
    if (modo !== "webaudio" || !nodoFiltro) { intensidadAct = intensidadObj; return; }
    // La subida de intensidad se hace con FILTRO, no con una capa
    // aparte: las pistas del pack son mezclas planas y no traen pistas
    // separadas. A intensidad 0 la música se sienta un poco atrás
    // (paso bajo a 6 kHz); a 1 entra del todo y sube 1 dB.
    var f = 6000 + (20000 - 6000) * intensidadObj;
    var t = ahora();
    try {
      nodoFiltro.frequency.cancelScheduledValues(t);
      nodoFiltro.frequency.setValueAtTime(nodoFiltro.frequency.value, t);
      nodoFiltro.frequency.linearRampToValueAtTime(f, t + Math.max(0.05, dur));
    } catch (_) {}
    intensidadAct = intensidadObj;
  }

  // ── API ─────────────────────────────────────────────────
  return {

    // Se llama UNA vez, desde el juego, cuando el AudioContext y los
    // buses ya existen. Antes de esto cualquier llamada se guarda y se
    // resuelve al desbloquear.
    init: function (o) {
      if (modo !== "espera") return modo;
      api = o || {};
      try {
        var ctx = api.ctx && api.ctx();
        var bus = api.bus && api.bus();
        var esFile = (typeof location !== "undefined" && location.protocol === "file:");
        if (ctx && bus && !esFile) {
          modo = "webaudio";
          nodoFiltro = ctx.createBiquadFilter();
          nodoFiltro.type = "lowpass";
          nodoFiltro.frequency.value = 20000;
          nodoFiltro.Q.value = 0.707;
          nodoDuck = ctx.createGain();
          nodoDuck.gain.value = 1;
          nodoFiltro.connect(nodoDuck);
          nodoDuck.connect(bus);
        } else {
          modo = "elemento";
          dbg.motivo = esFile ? "file:// — sin grafo, volumen directo" : "sin contexto";
        }
        voces = [crearVoz("a", false), crearVoz("b", false)];
        vozStinger = crearVoz("stinger", true);
        if (!voces[0] || !voces[1]) { modo = "off"; dbg.motivo = dbg.motivo || "sin <audio>"; return modo; }
        if (!reloj) reloj = setInterval(tic, 60);
      } catch (e) {
        modo = "off"; dbg.motivo = "init: " + e.message;
      }
      return modo;
    },

    // Cualquier gesto del usuario. Es lo que convierte "pendiente" en
    // sonido: en iOS el primer play() de CADA elemento tiene que caer
    // dentro de un gesto, así que se tocan los tres aunque solo vaya a
    // sonar uno.
    desbloquear: function () {
      if (modo === "off" || modo === "espera") return;
      if (!desbloqueado) {
        desbloqueado = true;
        for (var i = 0; i < voces.length; i++) {
          var v = voces[i];
          if (!v || !v.el || v.el.src) continue;
          try { var p = v.el.play(); if (p && p.catch) p.catch(function () {}); v.el.pause(); } catch (_) {}
        }
        if (pendiente) { var q = pendiente; pendiente = null; ir(q.pista, q.vol, q.cruce); }
      }
      // Una pista que se quedó en pausa por el sistema vuelve sola.
      var a = activa;
      if (a && a.el && a.el.paused && a.objetivo > 0) arrancar(a);
    },

    // Volver de segundo plano. El elemento conserva su posición, así que
    // reanudar es seguir donde estaba; el fundido corto de entrada es
    // para que no chasque al arrancar el decodificador.
    reanudar: function () {
      if (modo === "off" || modo === "espera" || !desbloqueado) return;
      var a = activa;
      if (!a || !a.el || a.objetivo <= 0) return;
      if (a.el.paused) {
        var destino = a.objetivo;
        a.valor = 0;
        if (modo === "webaudio" && a.gain) { try { a.gain.gain.value = 0; } catch (_) {} }
        arrancar(a);
        rampa(a, destino, 0.25);
      }
    },

    // Cambia de estado. `opts.pista` permite elegir variante de combate
    // sin inventar un estado por misión.
    estado: function (nombre, opts) {
      if (modo === "off") return;
      var e = ESTADOS[nombre];
      if (!e) return;
      var pista = (opts && opts.pista) || e.pista;
      if (estadoActual === nombre && pistaPedida === pista) return;
      estadoActual = nombre; pistaPedida = pista;
      dbg.ultimo = nombre + (pista ? ":" + pista : "");
      // Fuera del jefe la música va siempre entera.
      if (nombre !== "jefe" && nombre !== "jefe_final") ponerIntensidad(1, 0.6);
      ir(pista, e.vol, (opts && opts.cruce) || e.cruce);
    },

    // Corte por encima del bucle, que se aparta y vuelve solo.
    stinger: function (id) {
      if (modo === "off" || !vozStinger) return;
      var c = CATALOGO[id];
      if (!c || c.bucle) return;
      if (!desbloqueado) return;
      if (!cargar(vozStinger, id)) return;
      vozStinger.valor = 1;
      if (modo === "webaudio" && vozStinger.gain) { try { vozStinger.gain.gain.value = 1; } catch (_) {} }
      else aplicarVol(vozStinger);
      arrancar(vozStinger);
      // El bucle se aparta lo justo para dejar sitio al corte. No se
      // apaga: apagarlo y volverlo a subir se oye como un bache.
      stingerHasta = Date.now() / 1000 + c.dur + 0.15;
      ponerDuck(0.45, 0.18);
      dbg.ultimo = "stinger:" + id;
    },

    // 0 = música sentada atrás · 1 = música entera. La fase final del
    // jefe la sube; el resto del juego la deja en 1.
    intensidad: function (k, dur) { ponerIntensidad(k, dur == null ? 1.2 : dur); },

    // Lo que llama el agachado del motor de efectos cuando entra algo
    // grande. Es lo que pide el brief: la explosión del jefe aparta la
    // música un instante en vez de competir con ella.
    duck: function (fuerza, dur) {
      if (modo === "off") return;
      var f = Math.max(0, Math.min(1, fuerza || 0));
      var nivel = Math.max(0.35, 1 - f * 0.5);
      if (nivel >= duckNivel) return;      // ya hay uno más fuerte en curso
      duckHasta = Date.now() / 1000 + (dur || 0.3);
      ponerDuck(nivel, 0.04);
    },

    // Precarga sin sonar. Se usa con el aviso del jefe, que da 2,6 s de
    // margen antes de que la pista tenga que estar lista.
    precargar: function (id) {
      if (modo === "off" || !CATALOGO[id]) return;
      var libre = activa ? otra(activa) : voces[1];
      if (libre && libre.id !== id && (!libre.el || libre.el.paused)) cargar(libre, id);
    },

    // La ruta de repuesto no tiene bus, así que el silencio hay que
    // aplicarlo a mano cuando el jugador lo cambia.
    refrescarVolumen: function () {
      if (modo === "webaudio") return;
      for (var i = 0; i < voces.length; i++) aplicarVol(voces[i]);
      aplicarVol(vozStinger);
    },

    debug: function () {
      var a = activa;
      return {
        modo: modo, estado: estadoActual || "—", pista: (a && a.id) || "—",
        t: a && a.el && isFinite(a.el.currentTime) ? a.el.currentTime : 0,
        dur: a && CATALOGO[a.id] ? CATALOGO[a.id].dur : 0,
        vol: a ? a.valor : 0, duck: duckNivel, inten: intensidadAct,
        listo: desbloqueado, sonando: !!(a && a.el && !a.el.paused),
        cargadas: dbg.cargadas, fallos: dbg.fallos,
        ultimo: dbg.ultimo, motivo: dbg.motivo,
      };
    },
  };
})();
