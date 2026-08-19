// ════════════════════════════════════════════════════════════
//  admin.js — MODO ADMIN / FAMILY SANDBOX
// ════════════════════════════════════════════════════════════
//
//  <script src> clásico, como los otros seis.
//
//  ── Qué es ──
//
//  Una CAPA DE PERMISOS, no un segundo juego. No duplica ni una línea
//  de partida: el juego es el mismo, con tres diferencias declaradas
//  aquí y consultadas desde un puñado de sitios concretos:
//
//    1. Escribe en OTRA clave de localStorage (una por perfil).
//    2. Todo está disponible: misiones, mundos, chasis y cosméticos.
//    3. Aparece la FOUNDER FLEET, que en el juego normal no existe.
//
//  Todo lo demás —balance, daño, velocidad, cadencia, spawn, jefes,
//  audio, VFX— es idéntico. Admin no rebalancea nada: se salta
//  requisitos, que no es lo mismo.
//
//  ── Por qué el aislamiento vive en save.js y no aquí ──
//
//  Podría haber envuelto los `SAVE.set` desde esta capa. No: hay más de
//  treinta sitios que guardan, y basta con que UNO se escape para que
//  una partida de admin escriba en el save del jugador. El espacio de
//  guardado está dentro de SAVE (`SAVE.usarEspacio`), donde no hay
//  ninguna escritura que pueda equivocarse de clave porque todas pasan
//  por el mismo sitio.
//
//  ── Qué NO es ──
//
//  El PIN es una barrera CASUAL —que un niño no entre sin querer— no
//  seguridad: está en el código, que va al navegador. Para lo que hace
//  falta seguridad de verdad (compras, marcadores, telemetría) lo que
//  sirve es `ADMIN.activo()`, que deja fuera la sesión entera.

var ADMIN = (function () {
  "use strict";

  // El PIN por defecto. Se puede cambiar desde dentro de Admin y queda
  // en `sf_admin_meta`, que NO es un save: no lleva progreso y no se
  // borra al borrar la partida de nadie.
  var PIN_FABRICA = "1808";
  var META = "sf_admin_meta";

  // ── Perfiles ────────────────────────────────────────────
  //  Cada uno con SU PROPIA clave de guardado. No es un campo dentro de
  //  un save compartido: son saves distintos, con el mismo esquema y el
  //  mismo código. Así "el progreso de KALI no toca el de YOLI" no
  //  depende de que nadie se acuerde de filtrar por perfil, y añadir a
  //  la abuela mañana son tres líneas y ni una migración.
  var PERFILES = [
    { id: "kali",   nombre: "KALI",   color: "#ff7a1f", nave: "founder_kali" },
    { id: "yoli",   nombre: "YOLI",   color: "#7df9ff", nave: "founder_yoli" },
    { id: "silvia", nombre: "SILVIA", color: "#c77dff", nave: "founder_silvia" },
    { id: "eloi",   nombre: "ELOI",   color: "#ff3d1a", nave: "founder_eloi" },
  ];

  // La clave de guardado de un perfil. Con prefijo propio para que se
  // vean de un vistazo en el inspector y para que nunca puedan chocar
  // con `sf_save` ni con `sf_save_prev`.
  function espacioDe(id) { return "sf_admin_" + id; }

  var activo = false;
  var perfilId = null;
  var meta = null;

  function leerMeta() {
    if (meta) return meta;
    meta = { pin: PIN_FABRICA, ultimo: "eloi", iniciados: {} };
    try {
      var o = JSON.parse(localStorage.getItem(META) || "null");
      if (o && typeof o === "object") {
        if (typeof o.pin === "string" && /^[0-9]{4,8}$/.test(o.pin)) meta.pin = o.pin;
        if (typeof o.ultimo === "string" && porId(o.ultimo)) meta.ultimo = o.ultimo;
        if (o.iniciados && typeof o.iniciados === "object") meta.iniciados = o.iniciados;
      }
    } catch (_) {}
    return meta;
  }

  function escribirMeta() {
    try { localStorage.setItem(META, JSON.stringify(leerMeta())); } catch (_) {}
  }

  function porId(id) {
    for (var i = 0; i < PERFILES.length; i++) if (PERFILES[i].id === id) return PERFILES[i];
    return null;
  }

  // Título y subtítulo dentro de un botón ya dibujado. Los botones del
  // juego traen `label`/`sub`, pero alineados al centro; aquí interesa a
  // la izquierda para que la columna se lea de un vistazo.
  function etiqueta(G, x, y, w, h, titulo, sub) {
    var ctx = G.ctx;
    ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.font = "800 11px " + G.F; ctx.fillStyle = "#fff";
    G.letras(titulo, x + 16, y + h / 2 - 7, 1.4);
    ctx.font = "700 8px " + G.F; ctx.fillStyle = "#fff"; ctx.globalAlpha = 0.45;
    ctx.fillText(sub, x + 16, y + h / 2 + 9);
    ctx.globalAlpha = 1;
  }

  // Lo que hay que rehacer en el juego al cambiar de espacio: volver a
  // leer el save y volver a montar la tabla de naves. Lo pone index.html
  // con `ADMIN.conectar()`, porque es suyo, no de este archivo.
  var recargar = null;

  return {

    PERFILES: PERFILES,
    PIN_FABRICA: PIN_FABRICA,

    // index.html entrega aquí la función que reaplica un save cargado.
    // Sin ella, ADMIN sabría cambiar de clave pero no de partida.
    conectar: function (fn) { recargar = fn; },

    // ── Estado ────────────────────────────────────────────
    //  El flag que tiene que consultar TODO lo comercial que se añada
    //  después: compras, anuncios, economía real, marcadores, logros
    //  públicos, telemetría de balance y estadísticas de negocio. Una
    //  sesión de admin no es una partida de un cliente y no puede
    //  contar como tal en ninguna de esas cosas.
    activo: function () { return activo; },
    perfil: function () { return activo ? porId(perfilId) : null; },
    perfilId: function () { return activo ? perfilId : null; },

    // Atajo para los sistemas comerciales futuros, para que la
    // comprobación se escriba igual en todas partes:
    //    if (ADMIN.excluido()) return;   // no cobrar, no medir, no subir
    excluido: function () { return activo; },

    // ¿Se puede cobrar esto? En Admin, nunca. Hoy no hay nada que
    // gastar ELOI, pero el día que lo haya el sitio donde preguntarlo
    // ya existe y no habrá que acordarse de añadirlo.
    puedeGastar: function () { return !activo; },

    // ── PIN ───────────────────────────────────────────────
    //  Barrera casual. Comparación en tiempo no constante y PIN en el
    //  código: quien abra el inspector entra. Es lo que se quiere.
    pinCorrecto: function (txt) {
      return String(txt || "").trim() === leerMeta().pin;
    },
    cambiarPin: function (txt) {
      var v = String(txt || "").trim();
      if (!/^[0-9]{4,8}$/.test(v)) return false;
      leerMeta().pin = v;
      escribirMeta();
      return true;
    },
    ultimoPerfil: function () { return leerMeta().ultimo; },

    // ── Entrar y salir ────────────────────────────────────
    //  Entrar es: volcar lo pendiente del jugador, cambiar de clave,
    //  releer y reaplicar. Salir es lo mismo al revés. El save normal no
    //  recibe NI UNA escritura por el camino que no sea la suya propia.
    entrar: function (pin, idPerfil) {
      if (!this.pinCorrecto(pin)) return false;
      var p = porId(idPerfil) || porId(leerMeta().ultimo) || PERFILES[0];
      activo = true;
      perfilId = p.id;
      leerMeta().ultimo = p.id;
      escribirMeta();
      var d = SAVE.usarEspacio(espacioDe(p.id));
      // Un perfil recién estrenado arranca con SU nave y con la campaña
      // entera abierta. No es progreso regalado: en Admin no hay
      // progreso que valga, y dejar a un niño en la M1 con una sola
      // nave sería justo lo contrario de lo que es este modo.
      this.prepararPerfil(p);
      if (recargar) recargar(d);
      return true;
    },

    // Cambiar de perfil sin salir. Mismo camino: volcar, cambiar,
    // releer.
    cambiarPerfil: function (idPerfil) {
      if (!activo) return false;
      var p = porId(idPerfil);
      if (!p || p.id === perfilId) return false;
      perfilId = p.id;
      leerMeta().ultimo = p.id;
      escribirMeta();
      var d = SAVE.usarEspacio(espacioDe(p.id));
      this.prepararPerfil(p);
      if (recargar) recargar(d);
      return true;
    },

    salir: function () {
      if (!activo) return false;
      activo = false;
      perfilId = null;
      var d = SAVE.usarEspacio("");     // vuelta a sf_save
      if (recargar) recargar(d);
      return true;
    },

    // Deja el save del perfil listo. Se ejecuta cada vez que se entra,
    // no solo la primera: es idempotente y así un perfil no se puede
    // quedar a medias si algo se añade al catálogo más adelante.
    prepararPerfil: function (p) {
      if (typeof SAVE === "undefined") return;
      var campos = {};
      // Campaña abierta entera. Se escribe en el save DEL PERFIL, que es
      // suyo y de nadie más.
      var total = (typeof MISIONES !== "undefined" ? MISIONES.length : 10) - 1;
      if (SAVE.get("campana.misionMax", 0) < total) campos["campana.misionMax"] = total;

      // Su nave puesta, pero SOLO la primera vez. La marca de "ya
      // estrenado" va en `sf_admin_meta` y no dentro del save: el
      // esquema del save valida campo a campo y descarta lo que no
      // conoce, así que una marca inventada ahí no sobreviviría a una
      // recarga y el perfil se resetearía la nave en cada entrada.
      var m = leerMeta();
      if (!m.iniciados[p.id]) {
        campos["naves.seleccionada"] = p.nave;
        m.iniciados[p.id] = true;
        escribirMeta();
      }
      SAVE.setVarios(campos, "perfil admin " + p.id);
      SAVE.ya("perfil admin");
    },

    // ── Permisos ──────────────────────────────────────────
    //  Lo que consulta el juego. Cada uno en un solo sitio y con nombre
    //  de lo que decide, no de dónde se usa.
    misionAbierta: function (idx, misionMax) { return activo || idx <= misionMax; },
    mundoAbierto: function () { return activo; },
    cosmeticoLibre: function () { return activo; },

    // La etiqueta del indicador. Va aquí porque el texto es del modo, no
    // de la pantalla que lo dibuja.
    etiqueta: function () {
      var p = this.perfil();
      return p ? "ADMIN / FAMILY  ·  " + p.nombre : "ADMIN / FAMILY";
    },
    color: function () {
      var p = this.perfil();
      return p ? p.color : "#ffcf5c";
    },

    // ── Pantalla ──────────────────────────────────────────
    //  Reutiliza el mismo puente que el Hangar. No hay ni una primitiva
    //  de dibujo propia aquí: Admin es una capa, no una interfaz nueva.
    vista: "menu",        // menu · jefes
    ir: function (v) { this.vista = v; },

    dibujar: function (G) {
      var ctx = G.ctx;
      G.cabecera("ADMIN / FAMILY");
      if (this.vista === "jefes") return this.dibujarJefes(G);

      var ancho = Math.min(G.W - 40, 340), x0 = (G.W - ancho) / 2;
      var y = G.SAFE_TOP + 74;

      // ── Perfiles ──
      ctx.textAlign = "left"; ctx.textBaseline = "middle";
      ctx.font = "800 9px " + G.F; ctx.fillStyle = G.T.nave; ctx.globalAlpha = 0.8;
      G.letras("PERFIL", x0, y, 3);
      ctx.globalAlpha = 1;
      y += 16;

      var hueco = 8;
      var w = (ancho - hueco * (PERFILES.length - 1)) / PERFILES.length;
      for (var i = 0; i < PERFILES.length; i++) {
        var p = PERFILES[i];
        var bx = x0 + i * (w + hueco);
        var sel = p.id === perfilId;
        (function (p, bx, sel) {
          G.boton(bx, y, w, 46, { sel: sel, r: 12, color: p.color,
            fn: function () {
              if (p.id === perfilId) return;
              G.sfx("ui_sel");
              ADMIN.cambiarPerfil(p.id);
            } });
        })(p, bx, sel);
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.font = "800 10px " + G.F;
        ctx.fillStyle = sel ? p.color : "rgba(255,255,255,0.55)";
        G.letras(p.nombre, bx + w / 2, y + 23, 1, "center");
      }
      y += 62;

      // Cada perfil guarda en SU clave, y se dice: es la única forma de
      // que quien lo use pueda comprobarlo sin abrir el inspector.
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.font = "700 8px " + G.F; ctx.fillStyle = "#fff"; ctx.globalAlpha = 0.4;
      G.letras("GUARDA EN  " + (typeof SAVE !== "undefined" ? SAVE.clave() : "?"),
        G.W / 2, y, 1.2, "center");
      ctx.globalAlpha = 1;
      y += 22;

      // ── Accesos ──
      var alto = 44, paso = 52;
      G.boton(x0, y, ancho, alto, { r: 12, color: G.T.nave,
        fn: function () { G.sfx("ui_sel"); G.irA("naves"); } });
      etiqueta(G, x0, y, ancho, alto, "HANGAR ADMIN", "founder fleet + todo desbloqueado");
      y += paso;

      G.boton(x0, y, ancho, alto, { r: 12, color: G.T.nave,
        fn: function () { G.sfx("ui_sel"); G.irA("campana"); } });
      etiqueta(G, x0, y, ancho, alto, "ELEGIR MISIÓN", "las " + G.totalMisiones() + " abiertas");
      y += paso;

      G.boton(x0, y, ancho, alto, { r: 12, color: G.T.nave,
        fn: function () { G.sfx("ui_sel"); ADMIN.vista = "jefes"; } });
      etiqueta(G, x0, y, ancho, alto, "IR A UN JEFE", "salta directo al combate final");
      y += paso;

      G.boton(x0, y, ancho, alto, { r: 12, color: G.T.nave,
        fn: function () { G.sfx("ui_sel"); G.irA("mundos"); } });
      etiqueta(G, x0, y, ancho, alto, "SUPERVIVENCIA", "los cuatro mundos");
      y += paso + 10;

      var mitad = (ancho - 10) / 2;
      G.boton(x0, y, mitad, 38, { r: 10, color: "#9aa4b8",
        fn: function () {
          G.sfx("ui_sel");
          var v = G.pedirTexto("PIN nuevo (4 a 8 cifras)", "");
          if (v === null) return;
          G.avisar(ADMIN.cambiarPin(v) ? "PIN cambiado" : "PIN no válido: 4 a 8 cifras");
        } });
      G.boton(x0 + mitad + 10, y, mitad, 38, { r: 10, color: "#ff3b5c",
        fn: function () {
          G.sfx("ui_atras");
          ADMIN.salir();
          G.irA("inicio");
        } });
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.font = "800 10px " + G.F; ctx.fillStyle = "rgba(255,255,255,0.8)";
      G.letras("CAMBIAR PIN", x0 + mitad / 2, y + 19, 1, "center");
      ctx.fillStyle = "#ff3b5c";
      G.letras("SALIR DE ADMIN", x0 + mitad + 10 + mitad / 2, y + 19, 1, "center");
      y += 52;

      ctx.textAlign = "center"; ctx.font = "700 8px " + G.F;
      ctx.fillStyle = "#fff"; ctx.globalAlpha = 0.35;
      ctx.fillText("Al salir vuelve el guardado normal, intacto.", G.W / 2, y + 4);
      ctx.globalAlpha = 1;
    },

    // ── Selector de jefe ──────────────────────────────────
    //  No es un modo de juego nuevo: arranca la misión de verdad y
    //  adelanta el reloj hasta su evento de jefe, aplicando por el
    //  camino los eventos de ESTADO (hazard, zona) que estuvieran
    //  vigentes. Así el jefe se pelea en el escenario que le toca y no
    //  en uno vacío, y no hay ni una línea de combate duplicada.
    dibujarJefes: function (G) {
      var ctx = G.ctx;
      var n = G.totalMisiones();
      // La misma rejilla que la pantalla de campaña, a propósito: si el
      // selector de jefes tuviera su propio reparto, con veinte misiones
      // una de las dos listas se saldría de la pantalla y la otra no.
      var R = G.rejilla(n, { y0: G.SAFE_TOP + 78, reserva: 72, hueco: 6, ancho: 340,
                             maxFilas: 12, altoMin: 36, altoMax: 52, altoTope: 30 });
      var ancho = Math.min(G.W - 40, 340), x0 = (G.W - ancho) / 2;
      var alto = R.alto, cmp = R.compacta;
      for (var i = 0; i < n; i++) {
        var m = G.mision(i);
        var p = R.pos(i);
        (function (i, m, p) {
          G.boton(p.x, p.y, R.w, alto, { r: 12, color: m.color,
            fn: function () { G.sfx("mision_ini"); G.irAJefe(i); } });
        })(i, m, p);
        var pad = cmp ? 11 : 16;
        ctx.textAlign = "left"; ctx.textBaseline = "middle";
        ctx.font = "800 " + (cmp ? 9 : 10) + "px " + G.F; ctx.fillStyle = "#fff";
        var etq = "M" + (i + 1) + "  " + m.jefe;
        // En dos columnas el nombre de la misión ya no cabe al lado del
        // jefe, y el jefe es lo que se viene a buscar aquí.
        var libre = R.w - pad * 2 - (cmp ? 0 : 96);
        G.letras(G.cortar(etq, libre, 1.2), p.x + pad, p.y + alto / 2, 1.2);
        if (!cmp) {
          ctx.textAlign = "right";
          ctx.font = "700 8px " + G.F; ctx.fillStyle = m.color; ctx.globalAlpha = 0.8;
          G.letras(m.nombre.slice(0, 18), p.x + R.w - pad, p.y + alto / 2, 1, "right");
          ctx.globalAlpha = 1;
        }
      }
      G.boton(x0, G.H - G.SAFE_BOTTOM - 56, ancho, 40, { r: 12, color: G.T.nave,
        fn: function () { G.sfx("ui_atras"); ADMIN.vista = "menu"; } });
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.font = "800 10px " + G.F; ctx.fillStyle = "rgba(255,255,255,0.8)";
      G.letras("VOLVER", G.W / 2, G.H - G.SAFE_BOTTOM - 36, 1.2, "center");
    },

    // El indicador permanente. Pequeño, siempre visible y con el nombre
    // del perfil: la idea es que nadie —y menos un niño— se crea que
    // está avanzando en su partida normal cuando no lo está.
    //  Devuelve si ha pintado. No es adorno: es lo que permite
    //  comprobar desde una prueba que el distintivo sale en el menú Y en
    //  partida, sin tener que adivinarlo leyendo píxeles de un fondo que
    //  se mueve solo.
    indicador: function (G) {
      if (!activo) return false;
      var ctx = G.ctx;
      var txt = this.etiqueta();
      ctx.save();
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.font = "800 8px " + G.F;
      var w = ctx.measureText(txt).width + txt.length * 1.2 + 22;
      var x = G.W / 2 - w / 2, y = G.SAFE_TOP + 2, h = 16;
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = "rgba(3,4,10,0.72)";
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x, y, w, h, 8); else ctx.rect(x, y, w, h);
      ctx.fill();
      ctx.strokeStyle = this.color();
      ctx.globalAlpha = 0.5; ctx.lineWidth = 1;
      ctx.stroke();
      ctx.globalAlpha = 0.95;
      ctx.fillStyle = this.color();
      G.letras(txt, G.W / 2, y + h / 2 + 0.5, 1.2, "center");
      ctx.restore();
      return true;
    },

    // Para las pruebas y para el panel de depuración: dónde se está
    // escribiendo AHORA MISMO. "Creo que estoy aislado" no vale.
    diagnostico: function () {
      return {
        activo: activo,
        perfil: perfilId,
        clave: typeof SAVE !== "undefined" ? SAVE.clave() : "?",
        espacio: typeof SAVE !== "undefined" ? SAVE.espacio() : "?",
      };
    },
  };
})();
