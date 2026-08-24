// ════════════════════════════════════════════════════════════
//  save.js — guardado de FLIGHT STRIKE
// ════════════════════════════════════════════════════════════
//
//  <script src> clásico, como music.js y el banco de efectos. Nada de
//  módulos ES: con file:// el navegador los bloquea y el juego tiene
//  que seguir abriéndose con doble clic.
//
//  ── La regla que manda sobre todas las demás ──
//
//  UN SAVE ROTO NO PUEDE IMPEDIR JUGAR. Ni un JSON corrupto, ni una
//  versión del futuro, ni el almacenamiento lleno, ni el modo privado
//  de Safari (que tira una excepción en cuanto escribes). Todo lo de
//  aquí está envuelto y todo tiene un valor por defecto. Lo peor que
//  puede pasar es empezar de cero, nunca una pantalla en blanco.
//
//  ── El progreso es MONOTÓNICO ──
//
//  `campana.misionMax` solo sube. Nunca se asigna a pelo: se pasa por
//  subirMision(), que hace el máximo. Esto no es elegancia, es el
//  arreglo de un bug real —rejugar la misión 1 con diez desbloqueadas
//  volvía a bloquear de la 5 a la 10— y la única forma de que no vuelva
//  es que no exista la manera de bajarlo.
//
//  ── Versiones ──
//
//  La v1 descartaba el save entero si la versión no coincidía, así que
//  subir el número borraba la partida de todo el mundo. Aquí NUNCA se
//  descarta por versión: se migra, y lo que no se entienda se queda con
//  su valor por defecto.

var SAVE = (function () {
  "use strict";

  var VERSION = 2;

  // ── Espacios de guardado ────────────────────────────────
  //  El juego normal escribe en `sf_save`. El MODO ADMIN escribe en su
  //  propia clave y NUNCA en la del jugador: cambiar de espacio es
  //  cambiar estas dos variables y volver a cargar.
  //
  //  Está aquí y no en admin.js a propósito. Si el aislamiento lo
  //  montara la capa de arriba, cualquier `SAVE.set` que se le escapara
  //  —uno solo, en cualquiera de los treinta sitios que guardan— caería
  //  en el save del jugador. Con el espacio dentro de SAVE no hay
  //  escritura que pueda equivocarse de sitio, porque no existe ninguna
  //  ruta que escriba sin pasar por `guardarYa`.
  var NORMAL = "sf_save";
  var ESPACIO = "";               // "" = el jugador normal
  var CLAVE = NORMAL;
  var COPIA = NORMAL + "_prev";   // último estado que se pudo leer entero

  // ── Esquema ─────────────────────────────────────────────
  //  Cada campo con su tipo, su valor por defecto y sus topes. Es lo
  //  que convierte "confío en lo que había en localStorage" en "lo que
  //  entra se comprueba": un `record` que sea la cadena "NaN" o un
  //  `misionMax` de 900 no puede llegar al juego.
  var ESQUEMA = {
    "campana.misionMax":          { tipo: "entero", def: 0,    min: 0, max: 99 },
    "campana.misionIdx":          { tipo: "entero", def: 0,    min: 0, max: 99 },
    // ── Los dos hitos de la campaña ──
    //
    //  `completada` es el campo HISTÓRICO y significa, y seguirá
    //  significando siempre, "terminó la campaña base". No se renombra
    //  y no se retira: está escrito en los saves de quien ya se pasó el
    //  juego, y ese trofeo no se toca.
    //
    //  `completadaBase` es el mismo dato con el nombre que debería
    //  haber tenido. Se rellena solo a partir de `completada` (ver
    //  `ajustarCampana`). Existe para que el código nuevo pueda decir
    //  lo que quiere decir sin depender de un nombre ambiguo.
    //
    //  `completadaExp` y `statsExp` son de la expansión, y van APARTE
    //  justo para que terminarla no pise el trofeo de OMEGA.
    "campana.completada":         { tipo: "bool",   def: false },
    "campana.completadaBase":     { tipo: "bool",   def: false },
    "campana.completadaExp":      { tipo: "bool",   def: false },
    "campana.stats":              { tipo: "objeto", def: null },
    "campana.statsExp":           { tipo: "objeto", def: null },
    "campana.records":            { tipo: "mapaNum", def: {} },
    "campana.temaId":             { tipo: "texto",  def: "espacio", max: 24 },
    // ELOI ganado SOLO en M11+ (bloque 5H) — para la pantalla de
    // EXPANSIÓN COMPLETADA. Segunda cuenta del mismo ELOI que ya suma
    // `perfil.eloi`, no una moneda nueva.
    "campana.eloiExp":            { tipo: "entero", def: 0, min: 0, max: 1e9 },

    "perfil.record":              { tipo: "entero", def: 0, min: 0, max: 1e12 },
    "perfil.eloi":                { tipo: "entero", def: 0, min: 0, max: 1e12 },
    "perfil.partidas":            { tipo: "entero", def: 0, min: 0, max: 1e9 },
    "perfil.misionesCompletadas": { tipo: "entero", def: 0, min: 0, max: 1e9 },
    "perfil.jefesDerrotados":     { tipo: "entero", def: 0, min: 0, max: 1e9 },
    "perfil.tiempoJugado":        { tipo: "numero", def: 0, min: 0, max: 1e9 },
    // Bloque 6I — estadísticas de por vida de los sistemas del Bloque 6.
    // Cada una suma lo de ESA misión al cerrarla, no vive por partida.
    "perfil.closeCalls":              { tipo: "entero", def: 0, min: 0, max: 1e9 },
    "perfil.elitesDerrotados":        { tipo: "entero", def: 0, min: 0, max: 1e9 },
    "perfil.jackpots":                { tipo: "entero", def: 0, min: 0, max: 1e9 },
    "perfil.evolucionesDescubiertas": { tipo: "entero", def: 0, min: 0, max: 1e9 },
    "perfil.overdrivesUsados":        { tipo: "entero", def: 0, min: 0, max: 1e9 },
    // bestScore/bestRank POR MISIÓN Y DIFICULTAD: clave compuesta
    // "misionIdx_dificultad" (p.ej. "3_high"). `campana.records` (de
    // siempre) sigue siendo el récord por misión SIN distinguir
    // dificultad — no se toca, es lo que ya lee el resto del juego.
    "campana.recordsDif":         { tipo: "mapaNum", def: {} },
    "campana.rankDif":            { tipo: "mapaNum", def: {} },   // 0=C 1=B 2=A 3=S 4=S+

    // Lista vacía = ninguna nave bloqueada. Hoy están las cinco
    // disponibles y NO se toca eso: el campo queda preparado para el
    // bloque del hangar, que es quien decidirá qué se bloquea.
    "naves.seleccionada":         { tipo: "texto",  def: "chassis_01", max: 24 },
    "naves.desbloqueadas":        { tipo: "lista",  def: [] },
    // Igual que `naves.desbloqueadas`, para las skins de material que
    // premian un jefe de la expansión (bloque 5H). Tabla aparte porque
    // es una lista aparte (`SHIPS.SKINS`, no `SHIPS.CHASIS`).
    "naves.skinsDesbloqueadas":   { tipo: "lista",  def: [] },
    // Igual otra vez, para los cinco emblemas de la expansión (bloque
    // 5I). Los diez emblemas de siempre no están en ninguna lista: son
    // libres desde el principio y no necesitan guardar nada.
    "naves.emblemasDesbloqueadas": { tipo: "lista", def: [] },
    // Personalización cosmética, un objeto por chasis:
    //   naves.config["chassis_02"] = { customName, skinId, trailId,
    //                                  emblemId, primary, secondary, accent }
    // Va anidada a propósito: si mañana se añade un campo cosmético no
    // hay que tocar el esquema, y las claves de chasis que ya no existan
    // se quedan ahí sin molestar en vez de perderse.
    "naves.config":               { tipo: "objeto", def: {} },

    "opciones":                   { tipo: "opciones", def: {} },

    "meta.creado":                { tipo: "numero", def: 0, min: 0 },
    "meta.ultimoGuardado":        { tipo: "numero", def: 0, min: 0 },
  };

  // Campos que sobreviven a "BORRAR PROGRESO". Los ajustes de audio no
  // son progreso: quien borra la partida no está pidiendo que le suban
  // el volumen otra vez.
  var NO_ES_PROGRESO = ["opciones"];

  var datos = null;
  var defOpciones = {};
  var sucio = false, temporizador = null;
  var est = {
    ok: false, version: 0, migradoDe: 0, ultimo: 0, bytes: 0,
    escrituras: 0, error: "", motivo: "—", disponible: true,
  };

  // ── Utilidades de ruta ──────────────────────────────────
  function leerRuta(o, ruta) {
    var p = ruta.split("."), v = o;
    for (var i = 0; i < p.length; i++) {
      if (v == null || typeof v !== "object") return undefined;
      v = v[p[i]];
    }
    return v;
  }
  function escribirRuta(o, ruta, valor) {
    var p = ruta.split("."), n = o;
    for (var i = 0; i < p.length - 1; i++) {
      if (typeof n[p[i]] !== "object" || n[p[i]] === null) n[p[i]] = {};
      n = n[p[i]];
    }
    n[p[p.length - 1]] = valor;
  }

  // ── Validación ──────────────────────────────────────────
  //  Devuelve SIEMPRE un valor utilizable. Nunca lanza y nunca deja
  //  pasar algo del tipo equivocado.
  function validar(spec, v) {
    var d = spec.def;
    switch (spec.tipo) {
      case "entero":
      case "numero": {
        var n = Number(v);
        if (!isFinite(n)) return d;
        if (spec.tipo === "entero") n = Math.floor(n);
        if (spec.min != null && n < spec.min) n = spec.min;
        if (spec.max != null && n > spec.max) n = spec.max;
        return n;
      }
      case "bool":
        return v === true;
      case "texto":
        if (typeof v !== "string") return d;
        return spec.max ? v.slice(0, spec.max) : v;
      case "lista":
        if (!Array.isArray(v)) return d.slice ? d.slice() : [];
        return v.filter(function (x) { return typeof x === "string"; }).slice(0, 64);
      case "objeto":
        if (v === null) return spec.def === null ? null : {};
        if (typeof v !== "object" || Array.isArray(v)) return spec.def === null ? null : {};
        return v;
      case "mapaNum": {
        var out = {};
        if (v && typeof v === "object" && !Array.isArray(v)) {
          var k = Object.keys(v).slice(0, 200);
          for (var i = 0; i < k.length; i++) {
            var n2 = Number(v[k[i]]);
            if (isFinite(n2) && n2 >= 0) out[k[i]] = Math.floor(n2);
          }
        }
        return out;
      }
      case "opciones": {
        // Se valida CONTRA LOS VALORES DE FÁBRICA que pasa el juego:
        // cada clave tiene que existir y ser del mismo tipo. Así una
        // opción que se retire del juego no queda flotando, y una que
        // se añada aparece con su valor de fábrica sin migración.
        var o = {};
        for (var c in defOpciones) {
          if (!Object.prototype.hasOwnProperty.call(defOpciones, c)) continue;
          var val = v && typeof v === "object" ? v[c] : undefined;
          o[c] = (val !== undefined && typeof val === typeof defOpciones[c]) ? val : defOpciones[c];
        }
        return o;
      }
    }
    return d;
  }

  function porDefecto() {
    var o = { v: VERSION };
    for (var ruta in ESQUEMA) {
      if (!Object.prototype.hasOwnProperty.call(ESQUEMA, ruta)) continue;
      var d = ESQUEMA[ruta].def;
      escribirRuta(o, ruta, d && typeof d === "object" ? JSON.parse(JSON.stringify(d)) : d);
    }
    o.meta.creado = Date.now();
    return o;
  }

  function normalizar(bruto) {
    var o = { v: VERSION };
    for (var ruta in ESQUEMA) {
      if (!Object.prototype.hasOwnProperty.call(ESQUEMA, ruta)) continue;
      escribirRuta(o, ruta, validar(ESQUEMA[ruta], leerRuta(bruto, ruta)));
    }
    if (!o.meta.creado) o.meta.creado = Date.now();
    return o;
  }

  // ── Migraciones ─────────────────────────────────────────
  //  Una función por versión, que recibe el save de esa versión y
  //  devuelve el de la siguiente. Se encadenan. Nada se descarta: lo
  //  que no se sepa traducir se queda con su valor por defecto, que es
  //  lo que hace normalizar() después.
  var MIGRACIONES = {
    // v0 = las claves sueltas de antes de que hubiera un save único.
    0: function (s) {
      return {
        v: 1,
        record: s.record, temaId: s.temaId, naveId: s.naveId,
        misionIdx: s.misionIdx, opciones: s.opciones,
        campaignCompleted: s.campaignCompleted, campaignStats: s.campaignStats,
      };
    },
    1: function (s) {
      return {
        v: 2,
        campana: {
          // En la v1 `misionIdx` era LAS DOS COSAS a la vez: la misión
          // elegida y la máxima desbloqueada. Al migrar se copia a las
          // dos, que es la única lectura fiel de un save viejo.
          misionMax: s.misionIdx,
          misionIdx: s.misionIdx,
          completada: s.campaignCompleted === true,
          stats: s.campaignStats || null,
          records: {},
          temaId: s.temaId,
        },
        perfil: {
          record: s.record,
          eloi: 0, partidas: 0, misionesCompletadas: 0,
          // Un save de la v1 que tenga la campaña terminada ha visto los
          // diez jefes: no se le va a poner el contador a cero.
          jefesDerrotados: s.campaignCompleted === true ? 10 : 0,
          tiempoJugado: 0,
        },
        naves: { seleccionada: s.naveId, desbloqueadas: [], config: {} },
        opciones: s.opciones,
        meta: { creado: Date.now() },
      };
    },
  };

  // Las claves sueltas de la primera época. Se leen una vez, para que
  // quien venga de una versión muy vieja no pierda su récord.
  function leerLegacy() {
    var s = {};
    try {
      var r = localStorage.getItem("sf_record");
      var t = localStorage.getItem("sf_tema");
      var n = localStorage.getItem("sf_nave");
      var m = localStorage.getItem("sf_misionIdx");
      if (r == null && t == null && n == null && m == null) return null;
      if (r != null) s.record = Number(r);
      if (t != null) s.temaId = t;
      if (n != null) s.naveId = n;
      if (m != null) s.misionIdx = Number(m);
    } catch (_) { return null; }
    return s;
  }

  function migrar(s) {
    var desde = typeof s.v === "number" && isFinite(s.v) ? s.v : 0;
    est.migradoDe = desde;
    // Un save del FUTURO (el jugador volvió a una versión vieja del
    // juego) no se toca ni se borra: se lee lo que se entienda. Los
    // campos que esta versión no conoce se pierden al guardar, pero eso
    // es mejor que borrarle la partida por haber ido hacia atrás.
    if (desde > VERSION) { est.motivo = "save de una versión posterior (v" + desde + ")"; return s; }
    var guarda = 0;
    while (desde < VERSION && MIGRACIONES[desde] && guarda++ < 20) {
      s = MIGRACIONES[desde](s) || {};
      desde = s.v;
    }
    return s;
  }

  function serializar() {
    datos.meta.ultimoGuardado = Date.now();
    return JSON.stringify(datos);
  }

  // ── Escritura ───────────────────────────────────────────
  function guardarYa(motivo) {
    if (!datos) return false;
    try {
      var txt = serializar();
      localStorage.setItem(CLAVE, txt);
      est.bytes = txt.length;
      est.ultimo = datos.meta.ultimoGuardado;
      est.escrituras++;
      est.ok = true;
      est.error = "";
      if (motivo) est.motivo = motivo;
      sucio = false;
      if (temporizador) { clearTimeout(temporizador); temporizador = null; }
      return true;
    } catch (e) {
      // Modo privado de Safari, cuota llena, permisos. El juego sigue:
      // se pierde la persistencia, no la partida en curso.
      est.ok = false;
      est.error = (e && e.name ? e.name : "error") + ": " + (e && e.message ? e.message.slice(0, 40) : "");
      est.disponible = false;
      return false;
    }
  }

  // Autoguardado con freno. Cambiar el volumen son cinco toques
  // seguidos; sin el freno son cinco serializaciones y cinco
  // escrituras, y localStorage es SÍNCRONO: se paga en fotogramas.
  function marcar(motivo) {
    sucio = true;
    if (motivo) est.motivo = motivo;
    if (temporizador) return;
    temporizador = setTimeout(function () {
      temporizador = null;
      guardarYa();
    }, 400);
  }

  // Cuántas misiones son la campaña base. Lo pone `init`; el 10 es solo
  // el valor con el que arrancó el juego, por si alguien llama a SAVE
  // sin pasarlo.
  var BASE = 10;

  // ── El puente entre la campaña base y la expansión ──────
  //
  //  Se ejecuta en CADA carga, y es idempotente a propósito: no es una
  //  migración de versión —el esquema no cambia— sino una regla que
  //  tiene que valer igual para un save de hace un año y para uno
  //  guardado hace cinco segundos.
  //
  //  Hace dos cosas:
  //
  //  1. Rellena `completadaBase` desde `completada`. Un save antiguo
  //     solo tiene el campo viejo, y el código nuevo pregunta por el
  //     nuevo.
  //
  //  2. **Abre la puerta de la expansión.** Y aquí está lo importante:
  //     quien terminó la campaña base se quedó con `misionMax = 9`,
  //     porque el avance está topado en la última misión que había. El
  //     día que existan veinte, ese 9 significaría "la M11 está
  //     cerrada", y no habría forma de abrirla salvo rejugar la M10.
  //     Alguien que ya se pasó el juego se encontraría la expansión
  //     bajo llave, con la llave dentro.
  //
  //     Se sube a `BASE`, que es el índice de la primera misión de la
  //     expansión. Contra la constante y NO contra `MISIONES.length`:
  //     con `length` esto mismo, el día que la campaña llegue a treinta
  //     misiones, le regalaría veinte de golpe a quien solo jugó diez.
  function ajustarCampana() {
    if (!datos || !datos.campana) return;
    var c = datos.campana;
    if (c.completada && !c.completadaBase) c.completadaBase = true;
    if (c.completadaBase && c.completada !== true) c.completada = true;
    if (c.completadaBase && c.misionMax < BASE) c.misionMax = BASE;
  }

  // ── Carga ───────────────────────────────────────────────
  //  Lee el espacio ACTIVO y deja `datos` listo. Se llama al arrancar
  //  y cada vez que se cambia de espacio, así que no puede tener nada
  //  que solo deba pasar una vez: las escuchas de salida van aparte.
  function cargar() {
    var bruto = null, deCopia = false;

    try {
      var txt = localStorage.getItem(CLAVE);
      if (txt) {
        try { bruto = JSON.parse(txt); }
        catch (e) {
          // JSON corrupto: se intenta la copia del arranque anterior
          // antes de rendirse. Es la diferencia entre perder una
          // sesión y perder la campaña entera.
          est.error = "JSON corrupto";
          try { bruto = JSON.parse(localStorage.getItem(COPIA) || "null"); deCopia = !!bruto; } catch (_) {}
        }
      }
    } catch (e) {
      est.disponible = false;
      est.error = "localStorage no disponible";
    }

    if (bruto && typeof bruto !== "object") bruto = null;
    // El rescate de las claves sueltas antiguas (`sf_record`, `sf_nave`…)
    // es SOLO del jugador normal. En un espacio de admin vacío importaría
    // el progreso del jugador dentro de admin y el aislamiento estaría
    // roto desde el primer arranque, con la mejor de las intenciones.
    if (!bruto && !ESPACIO) {
      var leg = leerLegacy();
      if (leg) { bruto = leg; est.motivo = "recuperado de claves antiguas"; }
    }

    if (!bruto) {
      datos = porDefecto();
      est.motivo = est.error ? est.motivo : "sin save previo";
    } else {
      datos = normalizar(migrar(bruto));
      if (deCopia) est.motivo = "recuperado de la copia de seguridad";
      else if (est.migradoDe < VERSION) est.motivo = "migrado de v" + est.migradoDe;
      else if (!est.motivo || est.motivo === "—") est.motivo = "cargado";
    }
    ajustarCampana();
    est.version = datos.v;
    est.ok = est.disponible;
    // La hora del último guardado viene del propio save, no de esta
    // sesión: si no, AJUSTES decía "nunca" hasta que el jugador
    // guardara algo, y lo que se quiere saber es cuándo se guardó por
    // última vez, no cuándo se guardó desde que abrí el juego.
    est.ultimo = datos.meta.ultimoGuardado || 0;

    // Copia de "lo último que se pudo leer entero". Se escribe una vez
    // por arranque, no en cada guardado: es un seguro contra una
    // escritura que quede a medias, no un historial.
    try { localStorage.setItem(COPIA, JSON.stringify(datos)); } catch (_) {}

    // Lo recién cargado no está sucio, y cualquier autoguardado que
    // quedara programado era del espacio anterior: dispararlo ahora
    // escribiría estos datos con la clave equivocada.
    sucio = false;
    if (temporizador) { clearTimeout(temporizador); temporizador = null; }

    return datos;
  }

  // Se registran UNA sola vez, en el init. Si se registraran en cada
  // carga, entrar y salir de admin cinco veces dejaría cinco escuchas
  // de `pagehide` haciendo el mismo trabajo.
  var escuchasPuestas = false;
  function escuchasDeSalida() {
    if (escuchasPuestas) return;
    escuchasPuestas = true;
    // El guardado de salida. En iOS `beforeunload` NO es fiable —
    // Safari puede matar la pestaña sin dispararlo— así que lo que
    // manda es `pagehide` y el paso a oculto de `visibilitychange`,
    // que son los que sí llegan al cambiar de app o bloquear la
    // pantalla. `beforeunload` se deja solo para el escritorio.
    try {
      var salir = function () { if (sucio) guardarYa("salida"); };
      window.addEventListener("pagehide", salir);
      window.addEventListener("beforeunload", salir);
      document.addEventListener("visibilitychange", function () {
        if (document.visibilityState === "hidden") salir();
      });
    } catch (_) {}

    return datos;
  }

  // ── API ─────────────────────────────────────────────────
  return {

    // Se llama una vez, al arrancar, antes de leer nada.
    init: function (o) {
      o = o || {};
      defOpciones = o.opciones || {};
      // Cuántas misiones son la campaña BASE. Se recibe, no se deduce:
      // save.js no tiene por qué saber cuántas misiones hay hoy, y
      // deducirlo de la tabla es exactamente el error que este bloque
      // viene a arreglar.
      if (typeof o.base === "number" && o.base > 0) BASE = o.base | 0;
      var d = cargar();
      escuchasDeSalida();
      return d;
    },

    // ── Cambio de espacio ─────────────────────────────────
    //  `SAVE.usarEspacio("sf_admin_kali")` deja de escribir en el save
    //  del jugador y pasa a escribir en ése. `SAVE.usarEspacio("")`
    //  vuelve al normal.
    //
    //  Lo primero que hace es VACIAR lo pendiente en el espacio que se
    //  abandona. El autoguardado tiene freno —hasta un segundo de
    //  retraso— y sin este volcado, salir de admin justo después de
    //  tocar algo escribiría el dato del espacio viejo con la clave del
    //  nuevo. Es exactamente la forma en que se contaminan dos saves.
    usarEspacio: function (nombre) {
      nombre = nombre || "";
      if (nombre === ESPACIO) return datos;
      if (sucio) guardarYa("cambio de espacio");
      ESPACIO = nombre;
      CLAVE = ESPACIO || NORMAL;
      COPIA = CLAVE + "_prev";
      est.migradoDe = 0;
      est.error = ""; est.motivo = "—";
      return cargar();
    },

    espacio: function () { return ESPACIO; },
    esNormal: function () { return ESPACIO === ""; },

    // La clave real donde se está escribiendo. Para las pruebas y para
    // el panel de depuración: "creo que estoy aislado" no vale, hay que
    // poder mirarlo.
    clave: function () { return CLAVE; },

    datos: function () { return datos; },

    get: function (ruta, def) {
      if (!datos) return def;
      var v = leerRuta(datos, ruta);
      return v === undefined ? def : v;
    },

    // Escribe y programa el autoguardado. Valida por el camino, así que
    // no hay forma de meter basura desde el juego tampoco.
    set: function (ruta, valor, motivo) {
      if (!datos) return;
      var spec = ESQUEMA[ruta];
      escribirRuta(datos, ruta, spec ? validar(spec, valor) : valor);
      marcar(motivo || ruta);
    },

    // Varios campos de golpe, con UN solo autoguardado.
    setVarios: function (obj, motivo) {
      if (!datos) return;
      for (var ruta in obj) {
        if (!Object.prototype.hasOwnProperty.call(obj, ruta)) continue;
        var spec = ESQUEMA[ruta];
        escribirRuta(datos, ruta, spec ? validar(spec, obj[ruta]) : obj[ruta]);
      }
      marcar(motivo || "varios");
    },

    ya: function (motivo) { return guardarYa(motivo || "manual"); },

    // ── Monotónicos ───────────────────────────────────────
    //  Estos tres NO tienen versión que baje, y es a propósito.

    // La misión máxima desbloqueada. Es el arreglo del bug: no existe
    // ninguna forma de que este número baje.
    subirMision: function (idx) {
      if (!datos) return 0;
      var n = validar(ESQUEMA["campana.misionMax"], idx);
      if (n > datos.campana.misionMax) {
        datos.campana.misionMax = n;
        marcar("misión " + n + " desbloqueada");
      }
      return datos.campana.misionMax;
    },

    subirRecord: function (score) {
      if (!datos) return 0;
      var n = validar(ESQUEMA["perfil.record"], score);
      if (n > datos.perfil.record) {
        datos.perfil.record = n;
        marcar("récord " + n);
        return true;
      }
      return false;
    },

    // Récord por misión. Devuelve true si es nuevo, para que el juego
    // pueda cantarlo en pantalla.
    subirRecordMision: function (idx, score) {
      if (!datos) return false;
      var k = "m" + idx;
      var n = Math.max(0, Math.floor(Number(score) || 0));
      var prev = datos.campana.records[k] || 0;
      if (n > prev) {
        datos.campana.records[k] = n;
        marcar("récord M" + (idx + 1));
        return true;
      }
      return false;
    },

    recordMision: function (idx) {
      return (datos && datos.campana.records["m" + idx]) || 0;
    },

    // Bloque 6I — récord de score Y de rank, cada uno por separado,
    // los DOS por misión Y por dificultad. No tienen por qué caer en la
    // misma partida: alguien puede sacar su mejor puntuación un día y
    // su mejor letra otro, y las dos cuentan.
    subirRecordDif: function (idx, dificultad, score) {
      if (!datos) return false;
      var k = "m" + idx + "_" + dificultad;
      var n = Math.max(0, Math.floor(Number(score) || 0));
      var prev = datos.campana.recordsDif[k] || 0;
      if (n > prev) { datos.campana.recordsDif[k] = n; marcar("récord M" + (idx + 1) + " " + dificultad); return true; }
      return false;
    },
    recordDif: function (idx, dificultad) {
      return (datos && datos.campana.recordsDif["m" + idx + "_" + dificultad]) || 0;
    },
    subirRankDif: function (idx, dificultad, rankNum) {
      if (!datos) return false;
      var k = "m" + idx + "_" + dificultad;
      var n = Math.max(0, Math.min(4, Math.floor(Number(rankNum) || 0)));
      var prev = datos.campana.rankDif[k] || 0;
      if (n > prev) { datos.campana.rankDif[k] = n; marcar("rank M" + (idx + 1) + " " + dificultad); return true; }
      return false;
    },
    rankDif: function (idx, dificultad) {
      return (datos && datos.campana.rankDif["m" + idx + "_" + dificultad]) || 0;
    },

    // Contadores que solo suman.
    sumar: function (ruta, cuanto) {
      if (!datos || !ESQUEMA[ruta]) return 0;
      var v = (Number(leerRuta(datos, ruta)) || 0) + (Number(cuanto) || 0);
      var n = validar(ESQUEMA[ruta], v);
      escribirRuta(datos, ruta, n);
      marcar(ruta);
      return n;
    },

    // ── Borrado ───────────────────────────────────────────
    //  `conservarAjustes` por defecto: quien borra la partida no está
    //  pidiendo que le devuelvan el volumen a fábrica.
    borrar: function (conservarAjustes) {
      var guardados = {};
      if (conservarAjustes !== false) {
        for (var i = 0; i < NO_ES_PROGRESO.length; i++) {
          guardados[NO_ES_PROGRESO[i]] = leerRuta(datos, NO_ES_PROGRESO[i]);
        }
      }
      datos = porDefecto();
      for (var r in guardados) {
        if (guardados[r] !== undefined) escribirRuta(datos, r, guardados[r]);
      }
      try { localStorage.removeItem(COPIA); } catch (_) {}
      est.migradoDe = VERSION;
      return guardarYa(conservarAjustes === false ? "borrado total" : "progreso borrado");
    },

    // ── Herramientas de consola ───────────────────────────
    //  Sin interfaz a propósito: son para rescatar una partida desde el
    //  inspector, no una función del juego.
    //    copy(SAVE.exportar())      en el aparato viejo
    //    SAVE.importar('<pegado>')  en el nuevo
    exportar: function () { try { return JSON.stringify(datos); } catch (_) { return "{}"; } },
    importar: function (txt) {
      try {
        var o = JSON.parse(txt);
        if (!o || typeof o !== "object") return false;
        datos = normalizar(migrar(o));
        ajustarCampana();
        return guardarYa("importado");
      } catch (e) { return false; }
    },

    estado: function () {
      return {
        ok: est.ok, disponible: est.disponible, version: est.version,
        migradoDe: est.migradoDe, ultimo: est.ultimo, bytes: est.bytes,
        escrituras: est.escrituras, pendiente: sucio,
        error: est.error, motivo: est.motivo,
        misionMax: datos ? datos.campana.misionMax : 0,
        base: BASE,
        completadaBase: datos ? !!datos.campana.completadaBase : false,
        completadaExp: datos ? !!datos.campana.completadaExp : false,
        nave: datos ? datos.naves.seleccionada : "—",
      };
    },
  };
})();
