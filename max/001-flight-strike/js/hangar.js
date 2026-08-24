// ════════════════════════════════════════════════════════════
//  hangar.js — la pantalla de naves de FLIGHT STRIKE
// ════════════════════════════════════════════════════════════
//
//  <script src> clásico, como los otros cinco.
//
//  ── Por qué recibe un puente y no toca nada por su cuenta ──
//
//  Todo lo que dibuja —`boton`, `panel`, `letras`, `naveEscaparate`…—
//  vive en index.html. Podría alcanzarlo por variable global, porque un
//  <script> clásico comparte ámbito, pero entonces este archivo
//  dependería en silencio de treinta nombres y no se podría probar sin
//  navegador. Recibe un objeto `G` con lo que necesita, declarado en un
//  sitio, y así la lista de dependencias se lee de un vistazo.
//
//  ── Qué NO hace ──
//
//  Ni una decisión de partida. No toca velocidad, daño, cadencia,
//  hitbox ni arma. Lee el catálogo de `ships.js`, guarda en `save.js` y
//  pinta. La personalización de este bloque es COSMÉTICA entera.

var HANGAR = (function () {
  "use strict";

  // Pestaña principal y sección de personalización. Se conservan entre
  // visitas a propósito: quien está probando colores entra y sale del
  // Hangar varias veces seguidas y volver siempre a "CHASIS" obliga a
  // rehacer dos toques cada vez.
  var pestana = "chasis";          // chasis · aspecto
  var seccion = "skin";            // skin · estela · emblema · color · nombre
  var ranuraColor = "primary";     // qué color se está tocando

  var SECCIONES = [
    { id: "skin",    et: "SKIN" },
    { id: "estela",  et: "ESTELA" },
    { id: "emblema", et: "EMBLEMA" },
    { id: "color",   et: "COLOR" },
    { id: "nombre",  et: "NOMBRE" },
  ];

  // Lo que mide cada sección dibujada. Está a mano y no calculado porque
  // el alto hace falta ANTES de dibujar, para poder centrar el bloque; si
  // se descubriera pintando, el centrado iría siempre un fotograma tarde.
  var ALTO_SECCION = {
    skin: 34 + 8 + 34 + 26,
    estela: 34 + 8 + 34,
    emblema: 2 * (46 + 6),
    color: 34 + 10 + 2 * (30 + 6) + 8 + 30,
    nombre: 46 + 10 + 34,
  };

  var RANURAS = [
    { id: "primary",   et: "CASCO" },
    { id: "secondary", et: "DETALLE" },
    { id: "accent",    et: "REACTOR" },
  ];

  // Guardar la personalización y avisar al juego, SIEMPRE juntas.
  //
  // `SHIPS.guardarConfig` limpia su propia caché de tintes, pero el juego
  // guarda aparte el sprite y la estela ya resueltos de la nave equipada
  // —los pide una vez por partícula y por fotograma— y esos no se
  // enteran. Si se llama a `guardarConfig` a pelo, el escaparate sigue
  // enseñando el color anterior hasta que se cambia de nave. Por eso todo
  // el archivo guarda por aquí y nunca directamente.
  function guardar(G, id, campos) {
    SHIPS.guardarConfig(id, campos);
    G.invalidarCache();
  }

  // ── Utilidades de pintura ───────────────────────────────
  //  Fila de fichas horizontales. Es el patrón que se repite en skin,
  //  estela y ranura de color, así que se escribe una vez.
  function fichas(G, x, y, w, items, activo, alPulsar) {
    var ctx = G.ctx;
    var n = items.length;
    var hueco = 6;
    var ancho = Math.min(96, (w - hueco * (n - 1)) / n);
    var total = ancho * n + hueco * (n - 1);
    var x0 = x + (w - total) / 2;
    for (var i = 0; i < n; i++) {
      var it = items[i];
      var bx = x0 + i * (ancho + hueco);
      var sel = it.id === activo;
      (function (it) {
        G.boton(bx, y, ancho, 34, {
          sel: sel, r: 10, apagado: !!it.pendiente,
          color: it.col || G.T.nave,
          fn: function () {
            if (it.pendiente) {
              G.sfx("ui_no");
              G.avisar(it.motivo || "Pendiente de arte: aún no disponible");
              return;
            }
            alPulsar(it);
          },
        });
      })(it);
      // Muestra de color a la izquierda del nombre. En las estelas es el
      // dato que importa; en las skins, el tono dominante.
      // El punto de color va pegado al borde y el texto se centra en lo
      // que QUEDA, no en la ficha entera: centrado en la ficha, un nombre
      // largo como "DESIERTO" se monta encima del punto.
      var muestra = it.col || (it.pal && it.pal.s);
      var sangria = 0;
      if (muestra) {
        ctx.fillStyle = muestra;
        ctx.globalAlpha = it.pendiente ? 0.3 : 1;
        ctx.beginPath();
        ctx.arc(bx + 11, y + 17, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        sangria = 19;
      }
      var tx = bx + sangria + (ancho - sangria) / 2;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.font = "800 8px " + G.F;
      ctx.fillStyle = it.pendiente ? "rgba(255,255,255,0.3)"
        : sel ? "#ffffff" : "rgba(255,255,255,0.62)";
      G.letras(it.nombre.slice(0, 9), tx, y + 17, 0.6, "center");
    }
    return 34;
  }

  // Rejilla de muestras de color.
  function muestrasColor(G, x, y, w, cols, activo, alPulsar) {
    var ctx = G.ctx;
    var porFila = 8, lado = Math.min(30, (w - 6 * (porFila - 1)) / porFila);
    var filas = Math.ceil(cols.length / porFila);
    for (var i = 0; i < cols.length; i++) {
      var f = Math.floor(i / porFila), c = i % porFila;
      var enFila = Math.min(porFila, cols.length - f * porFila);
      var ancho = enFila * lado + 6 * (enFila - 1);
      var bx = x + (w - ancho) / 2 + c * (lado + 6);
      var by = y + f * (lado + 6);
      var col = cols[i];
      (function (col) {
        G.botones.push({ x: bx, y: by, w: lado, h: lado, fn: function () { alPulsar(col); } });
      })(col);
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(bx, by, lado, lado, 8) : ctx.rect(bx, by, lado, lado);
      ctx.fill();
      // El borde blanco marca el elegido. Hace falta porque hay colores
      // casi negros que sobre el fondo del menú no se distinguen del
      // hueco vacío.
      ctx.strokeStyle = col === activo ? "#ffffff" : "rgba(255,255,255,0.18)";
      ctx.lineWidth = col === activo ? 2.4 : 1;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(bx + 0.5, by + 0.5, lado - 1, lado - 1, 8) : ctx.rect(bx, by, lado, lado);
      ctx.stroke();
    }
    return filas * (lado + 6);
  }

  // Emblema dibujado en un recuadro. Devuelve false si no hay arte
  // cargado, para que quien llame ponga su propio hueco.
  function pintarEmblema(G, id, cx, cy, tam) {
    var e = SHIPS.emblema(id);
    if (!e || !e.archivo) return false;
    if (G.asegurarEmblema) G.asegurarEmblema(e.id);
    var sp = G.SPRITES["emb_" + e.id];
    if (!sp) return false;
    var w = sp.width || sp.naturalWidth, h = sp.height || sp.naturalHeight;
    if (!w || !h) return false;
    var esc = tam / Math.max(w, h);
    G.ctx.drawImage(sp, cx - w * esc / 2, cy - h * esc / 2, w * esc, h * esc);
    return true;
  }

  // ── Escaparate con fondo de hangar ──────────────────────
  //  El fondo que hay es APAISADO y el juego es vertical. No se recorta
  //  a lo bruto: se coloca como una banda a lo ancho, oscurecida y con
  //  degradado a los dos lados, de forma que la nave se lea encima. El
  //  día que llegue el vertical entra por la misma clave y esto no se
  //  entera.
  function fondoHangar(G, y, alto) {
    var sp = G.SPRITES.hangar_fondo;
    var ctx = G.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, y, G.W, alto);
    ctx.clip();
    if (sp) {
      var w = sp.width || sp.naturalWidth, h = sp.height || sp.naturalHeight;
      var esc = Math.max(G.W / w, alto / h);
      ctx.globalAlpha = 0.5;
      ctx.drawImage(sp, (G.W - w * esc) / 2, y + (alto - h * esc) / 2, w * esc, h * esc);
      ctx.globalAlpha = 1;
    }
    // Degradado a negro arriba y abajo: sin esto la banda tiene dos
    // cortes rectos y parece un error de recorte, no una decisión.
    var g = ctx.createLinearGradient(0, y, 0, y + alto);
    g.addColorStop(0, "rgba(4,5,12,0.95)");
    g.addColorStop(0.45, "rgba(4,5,12,0.15)");
    g.addColorStop(1, "rgba(4,5,12,0.95)");
    ctx.fillStyle = g;
    ctx.fillRect(0, y, G.W, alto);
    ctx.restore();
  }

  // ── Rejilla de chasis ───────────────────────────────────
  function rejilla(G, y0, slot, hueco, porFila, total) {
    var ctx = G.ctx;
    for (var i = 0; i < total; i++) {
      var fila = Math.floor(i / porFila), col = i % porFila;
      var enFila = Math.min(porFila, total - fila * porFila);
      var ancho = enFila * slot + hueco * (enFila - 1);
      var x = (G.W - ancho) / 2 + col * (slot + hueco);
      var y = y0 + fila * (slot + hueco);

      if (i === G.NAVES.length) {                       // casilla "+ CARGAR"
        G.masRect.x = x; G.masRect.y = y; G.masRect.w = slot; G.masRect.h = slot;
        G.masRect.hay = true;
        G.botones.push({ x: x, y: y, w: slot, h: slot, fn: G.cargarArchivo });
        G.panel(x, y, slot, slot, 14, 0.3);
        ctx.strokeStyle = "rgba(255,255,255,0.26)"; ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(x + 0.5, y + 0.5, slot - 1, slot - 1, 14) : ctx.rect(x, y, slot, slot);
        ctx.stroke(); ctx.setLineDash([]);
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillStyle = "rgba(255,255,255,0.7)"; ctx.font = "200 28px " + G.F;
        ctx.fillText("+", x + slot / 2, y + slot / 2 - 6);
        ctx.font = "700 8px " + G.F; ctx.globalAlpha = 0.55;
        G.letras("CARGAR", x + slot / 2, y + slot - 14, 1, "center");
        ctx.globalAlpha = 1;
        continue;
      }

      var nv = G.NAVES[i];
      var sel = i === G.naveSel();
      var bloq = !!nv.bloqueada;
      G.naveRects.push({ x: x, y: y, w: slot, h: slot, i: i, borrar: !nv.fija, indice: nv.indice });
      (function (i, nv, bloq) {
        G.boton(x, y, slot, slot, {
          sel: sel, r: 14, apagado: bloq, color: nv.motor || G.T.nave,
          fn: function () {
            if (bloq) {
              G.sfx("ui_no");
              G.avisar("Se desbloquea al completar la M" + (nv.requiere || 0));
              return;
            }
            G.seleccionar(i);
          },
        });
      })(i, nv, bloq);

      // El sprite de la casilla pasa por SHIPS: si esa nave tiene skin o
      // colores, la casilla los enseña. Elegir a ciegas y descubrir el
      // color al entrar en partida no es una elección.
      var matArchivo = SHIPS.materialArchivo(SHIPS.config(nv.id).skinId, nv.id);
      var matSp = null;
      if (matArchivo) {
        var matClave = "skin_" + SHIPS.config(nv.id).skinId + "_" + nv.id;
        if (G.asegurarSkinMaterial) G.asegurarSkinMaterial(matClave, nv.id, matArchivo);
        matSp = G.SPRITES[matClave] || null;
      }
      var sp = SHIPS.sprite(nv.id, G.SPRITES[nv.id], matSp);
      ctx.save(); ctx.translate(x + slot / 2, y + slot / 2 - 5);
      if (bloq) ctx.globalAlpha = 0.25;
      if (sp) G.pintarSprite(sp, slot * 0.62);
      else G.miniNave(0, 0, slot * 0.56, G.T);
      ctx.restore();
      ctx.globalAlpha = 1;

      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillStyle = bloq ? "rgba(255,255,255,0.28)"
        : sel ? (nv.motor || G.T.nave) : "rgba(255,255,255,0.5)";
      ctx.font = "800 8px " + G.F;
      G.letras(etiquetaCorta(nv), x + slot / 2, y + slot - 12, 0.8, "center");

      // Emblema en la esquina: es donde se ve que una nave es TUYA sin
      // tener que entrarle.
      if (!bloq) {
        var cf = SHIPS.porId(nv.id) ? SHIPS.config(nv.id) : null;
        if (cf && cf.emblemId !== "ninguno") {
          ctx.save(); ctx.globalAlpha = 0.9;
          pintarEmblema(G, cf.emblemId, x + slot - 14, y + 14, 18);
          ctx.restore();
        }
      }

      if (bloq) {
        ctx.save();
        ctx.translate(x + slot / 2, y + slot / 2 - 4);
        ctx.strokeStyle = "rgba(255,255,255,0.55)"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, -4, 5, Math.PI, 0); ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(-7, 0, 14, 11, 2) : ctx.rect(-7, 0, 14, 11);
        ctx.fill();
        ctx.restore();
      }
      if (!nv.fija) {
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.beginPath(); ctx.arc(x + slot - 12, y + 12, 9, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.85)"; ctx.font = "700 12px " + G.F;
        ctx.fillText("×", x + slot - 12, y + 12);
      }
    }
  }

  // Lo que cabe debajo de una casilla de 78 px. Si el jugador le ha
  // puesto nombre, manda el suyo: es el motivo de habérselo puesto.
  function etiquetaCorta(nv) {
    var cf = SHIPS.porId(nv.id) ? SHIPS.config(nv.id) : null;
    if (cf && cf.customName) return cf.customName.slice(0, 8).toUpperCase();
    return String(nv.nombre || "").split(" ")[0].slice(0, 8);
  }

  // El nombre grande de la ficha.
  function nombreLargo(nv) {
    var cf = SHIPS.porId(nv.id) ? SHIPS.config(nv.id) : null;
    if (cf && cf.customName) return cf.customName.toUpperCase();
    return nv.nombre;
  }

  // ── Pestaña CHASIS ──────────────────────────────────────
  function tabChasis(G, yTop, yGrid) {
    var ctx = G.ctx;
    var nv = G.NAVES[G.naveSel()] || {};
    var chasis = SHIPS.porId(nv.id);
    var cf = chasis ? SHIPS.config(nv.id) : null;
    var tam = Math.min(G.W * 0.50, 220);
    var anchoP = Math.min(G.W - 44, 320), px0 = (G.W - anchoP) / 2;
    var altoP = nv.bloqueada ? 122 : 104;

    // El resto del bloque (nombre, lema, descripción, ficha de
    // estadísticas, el botón de personalizar) no se comprime: es texto,
    // tiene un tamaño legible mínimo. Lo único elástico es el escaparate
    // de la nave -`tam`/`altoBanda`- porque una nave más pequeña sigue
    // siendo una nave, y es lo que sobra cuando Safari en iPhone se come
    // parte del alto con la barra de direcciones. Sin este ajuste, en una
    // pantalla real (no en el viewport fijo de una prueba) el bloque se
    // salía por debajo y tapaba la rejilla de chasis.
    var alturaFija = 6 + 18 + 18 + 16 + (nv.provisional ? 14 : 0) + altoP + (nv.bloqueada ? 0 : 40);
    var disponible = yGrid - yTop;
    var tamMax = (disponible - alturaFija) / 1.35;
    if (tamMax < tam) tam = Math.max(96, tamMax);
    var altoBanda = tam * 1.35;

    // El bloque se CENTRA en el hueco que deja la rejilla. En un iPad de
    // 1180 px de alto, anclarlo arriba deja medio metro de vacío entre la
    // ficha y las casillas y la pantalla parece a medio hacer.
    var altoBloque = altoBanda + alturaFija;
    // Repartido a partes iguales: el bloque queda ópticamente centrado
    // entre las pestañas y la rejilla, que es lo que hace que la pantalla
    // se vea terminada y no a medio montar.
    var y0 = yTop + Math.max(0, (yGrid - yTop - altoBloque) * 0.5);
    // Solo para pruebas: deja medido dónde termina el bloque de verdad,
    // para poder comprobar desde fuera que nunca pisa la rejilla de abajo.
    G.chasisMedido = { y0: y0, fin: y0 + altoBloque, yGrid: yGrid, tam: tam };

    fondoHangar(G, y0, altoBanda);
    G.naveEscaparate(G.W / 2, y0 + altoBanda / 2, tam);

    var y = y0 + altoBanda + 6;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.font = "800 " + Math.round(G.clamp(G.W * 0.055, 18, 24) ) + "px " + G.F;
    ctx.fillStyle = "#fff";
    G.letras(nombreLargo(nv), G.W / 2, y, 4, "center");
    // Si lleva nombre propio, el modelo real no desaparece: se pone
    // debajo en pequeño. Perder de vista qué chasis es sería peor que no
    // dejar renombrarlo.
    y += 18;
    ctx.font = "700 9px " + G.F; ctx.fillStyle = G.T.nave;
    var sub = nv.lema || "";
    if (cf && cf.customName) sub = nv.nombre + "  ·  " + sub;
    G.letras(sub, G.W / 2, y, 3, "center");
    y += 18;
    ctx.font = "600 11px " + G.F; ctx.fillStyle = "#fff"; ctx.globalAlpha = 0.6;
    ctx.fillText(nv.desc || "", G.W / 2, y);
    ctx.globalAlpha = 1;
    y += 16;

    // Ficha provisional declarada: NOVA no está balanceada y se dice.
    if (nv.provisional) {
      ctx.font = "700 8px " + G.F; ctx.fillStyle = "#ffcf5c"; ctx.globalAlpha = 0.8;
      G.letras("FICHA PROVISIONAL · SIN CALIBRAR", G.W / 2, y, 1.6, "center");
      ctx.globalAlpha = 1;
      y += 14;
    }

    // Estadísticas y arma
    G.panel(px0, y, anchoP, altoP, 14, 0.45);
    G.filo(px0, y, anchoP, altoP, 14, nv.motor || G.T.nave, 0.2);
    var k = 0;
    for (var et in (nv.stats || {})) {
      if (!Object.prototype.hasOwnProperty.call(nv.stats, et)) continue;
      G.barraStat(px0 + 16, y + 20 + k * 21, anchoP - 32, et, nv.stats[et], nv.motor || G.T.nave);
      k++;
    }
    ctx.fillStyle = "rgba(255,255,255,0.1)";
    ctx.fillRect(px0 + 16, y + 76, anchoP - 32, 1);
    var arm = G.ARMAS[nv.arma] || G.ARMAS.cannon;
    ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.font = "700 9px " + G.F;
    ctx.fillStyle = "#ffffff"; ctx.globalAlpha = 0.45;
    G.letras("ARMA", px0 + 16, y + 90, 1.4);
    ctx.globalAlpha = 1; ctx.fillStyle = arm.col; ctx.font = "800 10px " + G.F;
    G.letras(arm.nombre + (nv.escudo ? "  ·  ESCUDO INICIAL" : ""), px0 + 16 + anchoP * 0.42, y + 90, 1.4);

    // Condición de desbloqueo, dentro de la ficha y no como un aviso que
    // se va: es información permanente de esa nave.
    if (nv.bloqueada) {
      ctx.textAlign = "center"; ctx.font = "800 9px " + G.F;
      ctx.fillStyle = "#ffcf5c";
      G.letras("SE DESBLOQUEA AL COMPLETAR LA M" + (nv.requiere || 0),
        G.W / 2, y + 108, 1.6, "center");
    } else if (chasis) {
      // Botón para ir a personalizar, justo donde el jugador está
      // mirando la nave que quiere tocar.
      G.boton(px0 + anchoP / 2 - 78, y + altoP + 10, 156, 30,
        { r: 10, color: G.T.nave, fn: function () { G.sfx("ui_sel"); pestana = "aspecto"; } });
      ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = "800 9px " + G.F;
      ctx.fillStyle = G.T.nave;
      G.letras("PERSONALIZAR  ▸", G.W / 2, y + altoP + 25, 1.6, "center");
    }
  }

  // ── Pestaña ASPECTO ─────────────────────────────────────
  function tabAspecto(G, yTop, yGrid) {
    var ctx = G.ctx;
    var nv = G.NAVES[G.naveSel()] || {};
    var chasis = SHIPS.porId(nv.id);

    // Las naves cargadas por el jugador y la CLÁSICA vectorial no tienen
    // chasis en el catálogo: no hay nada que personalizar y decirlo es
    // mejor que enseñar controles que no hacen nada.
    if (!chasis) {
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.font = "700 11px " + G.F; ctx.fillStyle = "#fff"; ctx.globalAlpha = 0.55;
      ctx.fillText("Esta nave no admite personalización", G.W / 2, yTop + 60);
      ctx.globalAlpha = 1;
      return;
    }

    var cf = SHIPS.config(nv.id);
    var tam = Math.min(G.W * 0.36, 148);
    var altoBanda = tam * 1.25;

    // Igual que en la pestaña de chasis: el bloque se centra en el hueco
    // que deja la rejilla. Cada sección ocupa lo suyo, así que el alto se
    // declara aquí en vez de descubrirse dibujando.
    var altoBloque = altoBanda + 22 + 40 + ALTO_SECCION[seccion];
    var y0 = yTop + Math.max(0, (yGrid - yTop - altoBloque) * 0.5);

    fondoHangar(G, y0, altoBanda);
    // Con emblema, la nave se aparta a la izquierda y el emblema ocupa el
    // hueco de la derecha: los dos centrados se pisarían.
    var hayEmb = cf.emblemId !== "ninguno";
    G.naveEscaparate(G.W / 2 - (hayEmb ? tam * 0.34 : 0), y0 + altoBanda / 2, tam);
    if (hayEmb) {
      ctx.save(); ctx.globalAlpha = 0.95;
      pintarEmblema(G, cf.emblemId, G.W / 2 + tam * 0.58, y0 + altoBanda / 2, tam * 0.52);
      ctx.restore();
    }

    var y = y0 + altoBanda + 14;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.font = "800 13px " + G.F; ctx.fillStyle = "#fff";
    G.letras(nombreLargo(nv), G.W / 2, y, 3, "center");
    y += 22;

    // Selector de sección
    var anchoS = Math.min(G.W - 28, 360), sx = (G.W - anchoS) / 2;
    var hueco = 5;
    var ancho = (anchoS - hueco * (SECCIONES.length - 1)) / SECCIONES.length;
    for (var i = 0; i < SECCIONES.length; i++) {
      var s = SECCIONES[i];
      var bx = sx + i * (ancho + hueco);
      (function (s) {
        G.boton(bx, y, ancho, 28, { sel: seccion === s.id, r: 8, color: G.T.nave,
          fn: function () { G.sfx("ui_sel"); seccion = s.id; } });
      })(s);
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.font = "800 8px " + G.F;
      ctx.fillStyle = seccion === s.id ? "#ffffff" : "rgba(255,255,255,0.55)";
      G.letras(s.et, bx + ancho / 2, y + 14, 0.6, "center");
    }
    y += 40;

    var anchoP = Math.min(G.W - 32, 360), px0 = (G.W - anchoP) / 2;

    if (seccion === "skin") {
      // Skins de material (bloque 5I): cada una se desbloquea al matar
      // el jefe de su mundo (`naves.skinsDesbloqueadas`, otorgado en
      // index.html al cerrar la misión) y hoy solo tiene PNG de verdad
      // para chassis_01 (`SHIPS.materialArchivo`). Las dos condiciones
      // son independientes — desbloqueada sin arte en ESTE chasis sigue
      // bloqueada AQUÍ, con un motivo distinto al de "aún no la has
      // ganado" — así que se resuelven por separado y el mensaje que se
      // ve al tocarla dice cuál de las dos falta.
      var desbloq = (G.naves && G.naves.skinsDesbloqueadas) || [];
      var materiales = SHIPS.SKINS.slice(5).map(function (s) {
        var poseida = SHIPS.skinDisponible(s.id, desbloq);
        var arte = SHIPS.materialDisponible(s.id, nv.id);
        return {
          id: s.id, nombre: s.nombre, pal: s.pal,
          pendiente: !(poseida && arte),
          motivo: !poseida ? "Se desbloquea al completar la M" + s.requiere
                : !arte ? "Sin arte de material en este chasis" : null,
        };
      });
      y += fichas(G, px0, y, anchoP, SHIPS.SKINS.slice(0, 5), cf.skinId, function (it) {
        G.sfx("ui_sel");
        guardar(G, nv.id, { skinId: it.id });
      }) + 8;
      fichas(G, px0, y, anchoP, materiales, cf.skinId, function (it) {
        G.sfx("ui_sel");
        guardar(G, nv.id, { skinId: it.id });
      });
      y += 48;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.font = "700 8px " + G.F; ctx.fillStyle = "#fff"; ctx.globalAlpha = 0.4;
      G.letras("LAS DE ABAJO SON DE LA EXPANSIÓN", G.W / 2, y, 1.2, "center");
      ctx.globalAlpha = 1;

    } else if (seccion === "estela") {
      var mitad = Math.ceil(SHIPS.TRAILS.length / 2);
      y += fichas(G, px0, y, anchoP, SHIPS.TRAILS.slice(0, mitad), cf.trailId, elegirEstela) + 8;
      fichas(G, px0, y, anchoP, SHIPS.TRAILS.slice(mitad), cf.trailId, elegirEstela);

    } else if (seccion === "emblema") {
      // Los cinco de la expansión (bloque 5I, `requiere` puesto) se
      // ganan matando al jefe de su mundo — los diez de siempre siguen
      // libres desde el principio, como hasta hoy.
      var embDesbloq = (G.naves && G.naves.emblemasDesbloqueadas) || [];
      var porFila = 6, lado = Math.min(46, (anchoP - 6 * (porFila - 1)) / porFila);
      for (var e = 0; e < SHIPS.EMBLEMAS.length; e++) {
        var em = SHIPS.EMBLEMAS[e];
        var bloqEmb = !SHIPS.emblemaDisponible(em.id, embDesbloq);
        var f = Math.floor(e / porFila), c = e % porFila;
        var ex = px0 + c * (lado + 6), ey = y + f * (lado + 6);
        (function (em, bloqEmb) {
          G.boton(ex, ey, lado, lado, { sel: cf.emblemId === em.id, r: 10, color: G.T.nave, apagado: bloqEmb,
            fn: function () {
              if (bloqEmb) {
                G.sfx("ui_no");
                G.avisar("Se desbloquea al completar la M" + em.requiere);
                return;
              }
              G.sfx("ui_sel"); guardar(G, nv.id, { emblemId: em.id });
            } });
        })(em, bloqEmb);
        if (bloqEmb) {
          ctx.globalAlpha = 0.3;
        }
        if (em.id === "ninguno") {
          ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.font = "700 7px " + G.F; ctx.fillStyle = "rgba(255,255,255,0.5)";
          G.letras("NO", ex + lado / 2, ey + lado / 2, 0.8, "center");
        } else if (!bloqEmb && !pintarEmblema(G, em.id, ex + lado / 2, ey + lado / 2, lado * 0.72)) {
          // El arte aún no ha cargado: un punto, no un hueco vacío que
          // parezca que el botón está roto.
          ctx.fillStyle = "rgba(255,255,255,0.2)";
          ctx.beginPath(); ctx.arc(ex + lado / 2, ey + lado / 2, 5, 0, Math.PI * 2); ctx.fill();
        } else if (bloqEmb) {
          ctx.strokeStyle = "rgba(255,255,255,0.55)"; ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.arc(ex + lado / 2, ey + lado / 2 - 3, 3.5, Math.PI, 0); ctx.stroke();
          ctx.fillStyle = "rgba(255,255,255,0.55)";
          ctx.beginPath();
          ctx.roundRect ? ctx.roundRect(ex + lado / 2 - 5, ey + lado / 2 - 2, 10, 8, 1.5)
                         : ctx.rect(ex + lado / 2 - 5, ey + lado / 2 - 2, 10, 8);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

    } else if (seccion === "color") {
      y += fichas(G, px0, y, anchoP,
        RANURAS.map(function (r) { return { id: r.id, nombre: r.et, col: cf.colors[r.id] }; }),
        ranuraColor, function (it) { G.sfx("ui_sel"); ranuraColor = it.id; }) + 10;
      var actual = cf.colors[ranuraColor];
      y += muestrasColor(G, px0, y, anchoP, SHIPS.COLORES, actual, function (col) {
        G.sfx("ui_sel");
        var campos = {};
        campos[ranuraColor] = col;
        guardar(G, nv.id, campos);
      }) + 8;
      // Volver a los colores de la skin. Sin esto, tocar un color es
      // irreversible salvo reiniciando el guardado entero.
      G.boton(px0 + anchoP / 2 - 70, y, 140, 30, { r: 10, color: G.T.nave, fn: function () {
        G.sfx("ui_atras");
        guardar(G, nv.id, { primary: null, secondary: null, accent: null });
      } });
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.font = "800 9px " + G.F; ctx.fillStyle = "rgba(255,255,255,0.75)";
      G.letras("QUITAR COLORES", G.W / 2, y + 15, 1.2, "center");

    } else if (seccion === "nombre") {
      G.panel(px0, y, anchoP, 46, 12, 0.45);
      G.filo(px0, y, anchoP, 46, 12, G.T.nave, 0.2);
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.font = "800 14px " + G.F; ctx.fillStyle = "#fff";
      G.letras(cf.customName ? cf.customName.toUpperCase() : nv.nombre, G.W / 2, y + 23, 3, "center");
      y += 56;
      var mitadB = (anchoP - 10) / 2;
      G.boton(px0, y, mitadB, 34, { r: 10, color: G.T.nave, fn: function () {
        G.sfx("ui_sel");
        // `prompt` y no un teclado propio: en iPad Safari el teclado
        // nativo funciona, respeta la accesibilidad del sistema y no hay
        // que mantener un campo de texto dibujado a mano sobre canvas.
        var txt = G.pedirTexto("Nombre de la nave (16 caracteres)", cf.customName || "");
        if (txt === null) return;
        guardar(G, nv.id, { customName: String(txt).slice(0, 16).trim() });
      } });
      G.boton(px0 + mitadB + 10, y, mitadB, 34, { r: 10, color: G.T.nave, fn: function () {
        G.sfx("ui_atras");
        guardar(G, nv.id, { customName: "" });
      } });
      ctx.font = "800 9px " + G.F; ctx.fillStyle = "rgba(255,255,255,0.8)";
      G.letras("ESCRIBIR", px0 + mitadB / 2, y + 17, 1.2, "center");
      G.letras("QUITAR", px0 + mitadB + 10 + mitadB / 2, y + 17, 1.2, "center");
    }
  }

  function elegirEstela(it) {
    var G = ultimoG;
    var nv = G.NAVES[G.naveSel()] || {};
    G.sfx("ui_sel");
    guardar(G, nv.id, { trailId: it.id });
  }
  var ultimoG = null;

  return {
    // Para las pruebas y para el juego: en qué pestaña está.
    estado: function () { return { pestana: pestana, seccion: seccion, ranura: ranuraColor }; },
    // Al entrar desde el menú se vuelve a la vista de chasis si la nave
    // que hay equipada no admite personalización, para no abrir en una
    // pantalla que solo dice "no se puede".
    entrar: function (admite) { if (!admite) pestana = "chasis"; },
    ir: function (p) { pestana = p; },
    irSeccion: function (s) { seccion = s; },

    dibujar: function (G) {
      ultimoG = G;
      var ctx = G.ctx;
      G.cabecera("HANGAR");

      // Pestañas
      var anchoT = Math.min(G.W - 40, 260), tx = (G.W - anchoT) / 2;
      var ty = G.SAFE_TOP + 56;
      var mitad = (anchoT - 8) / 2;
      G.boton(tx, ty, mitad, 30, { sel: pestana === "chasis", r: 9, color: G.T.nave,
        fn: function () { G.sfx("ui_sel"); pestana = "chasis"; } });
      G.boton(tx + mitad + 8, ty, mitad, 30, { sel: pestana === "aspecto", r: 9, color: G.T.nave,
        fn: function () { G.sfx("ui_sel"); pestana = "aspecto"; } });
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.font = "800 9px " + G.F;
      ctx.fillStyle = pestana === "chasis" ? "#fff" : "rgba(255,255,255,0.55)";
      G.letras("CHASIS", tx + mitad / 2, ty + 15, 1.4, "center");
      ctx.fillStyle = pestana === "aspecto" ? "#fff" : "rgba(255,255,255,0.55)";
      G.letras("ASPECTO", tx + mitad + 8 + mitad / 2, ty + 15, 1.4, "center");

      // La rejilla va abajo del todo, que es donde llega el pulgar, y el
      // resto se reparte el hueco que queda.
      var total = G.NAVES.length + 1;
      var porFila = total <= 4 ? total : Math.min(5, Math.ceil(total / 2));
      var hueco = 10;
      var slot = Math.min(78, (G.W - 32 - hueco * (porFila - 1)) / porFila);
      var filas = Math.ceil(total / porFila);
      var yGrid = G.H - G.SAFE_BOTTOM - 24 - filas * (slot + hueco);

      G.naveRects.length = 0;
      G.masRect.hay = false;

      var yTop = ty + 40;
      if (pestana === "chasis") tabChasis(G, yTop, yGrid);
      else tabAspecto(G, yTop, yGrid);

      rejilla(G, yGrid, slot, hueco, porFila, total);
    },
  };
})();
