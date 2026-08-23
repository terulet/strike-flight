"use strict";
// ════════════════════════════════════════════════════════════
//  DIFICULTAD  —  EASY / MEDIUM / HIGH
//
//  UNA sola tabla. Nada de `if (dificultad === ...)` repartido por el
//  juego: el código pide un multiplicador por su nombre y ya está.
//
//  ── La regla que manda sobre todo lo demás ──
//
//  MEDIUM es el juego canónico. TODOS sus valores son exactamente 1.
//  No "casi 1", no 0.99: 1. Así "MEDIUM antes == MEDIUM después" no es
//  una promesa, es una comprobación que se puede automatizar — y de
//  hecho lo hace herramientas/pruebas/dificultad.mjs.
//
//  Por eso los enganches del juego están escritos de forma que
//  multiplicar por 1 devuelve el mismo número, y donde eso no basta
//  (los drops) hay un `if (k !== 1)` que se salta el cálculo entero.
//
//  ── Cómo se leen los números ──
//
//  Todos son multiplicadores sobre el valor canónico. Ojo con el
//  sentido de cada uno, porque no todos "más alto = más difícil":
//
//    balaEnemiga      velocidad del proyectil enemigo.  ↑ = más difícil
//    cadenciaEnemiga  espera entre disparos.            ↑ = más FÁCIL
//    invulnerable     ventana de gracia tras un golpe.  ↑ = más FÁCIL
//    comboTiempo      lo que aguanta el combo.          ↑ = más FÁCIL
//    dropDefensivo    peso de vida/escudo/bomba.        ↑ = más FÁCIL
//
//  ── Lo que NO se toca ──
//
//  HP de los enemigos. Ni se multiplica ni se divide en ninguna
//  dificultad. HIGH es más difícil por presión y lectura, no porque
//  todo tarde el doble en morir, que es la manera barata de hacerlo y
//  además alarga las partidas sin hacerlas mejores.
// ════════════════════════════════════════════════════════════

var DIF = (function () {

  var CONFIG = {

    // ── FÁCIL ────────────────────────────────────────────────
    //  Accesible, no automático. Se sigue muriendo si no se esquiva:
    //  lo que cambia es el margen para leer lo que viene.
    easy: {
      balaEnemiga:     0.90,
      cadenciaEnemiga: 1.18,
      invulnerable:    1.35,
      comboTiempo:     1.35,
      dropDefensivo:   1.30,
      telegrafo:       1.00,   // reservado — ver NOTA TELEGRÁFICOS abajo
      elite:           0.60,   // 6J
      overdrive:       1.15,   // 6G
      score:           0.85,   // 6C — declarado, todavía sin aplicar
    },

    // ── NORMAL ───────────────────────────────────────────────
    //  El juego tal cual está. Todo a 1. Esta columna no se toca.
    medium: {
      balaEnemiga:     1,
      cadenciaEnemiga: 1,
      invulnerable:    1,
      comboTiempo:     1,
      dropDefensivo:   1,
      telegrafo:       1,
      elite:           1,
      overdrive:       1,
      score:           1,
    },

    // ── DIFÍCIL ──────────────────────────────────────────────
    //  Más presión y menos red de seguridad. Los proyectiles llegan
    //  antes y el combo perdona menos, pero el enemigo no tiene más
    //  vida: sigue muriendo con los mismos disparos.
    high: {
      balaEnemiga:     1.12,
      cadenciaEnemiga: 0.86,
      invulnerable:    0.85,
      comboTiempo:     0.75,
      dropDefensivo:   0.80,
      telegrafo:       1.00,   // reservado — ver NOTA TELEGRÁFICOS abajo
      elite:           1.50,   // 6J
      overdrive:       0.90,   // 6G
      score:           1.35,   // 6C — declarado, todavía sin aplicar
    },
  };

  // ── NOTA TELEGRÁFICOS ─────────────────────────────────────
  //  `telegrafo` está a 1 en las tres a propósito, y no por olvido.
  //
  //  Los 161 telegráficos del juego no son adornos: su `life` es el
  //  MISMO número que el temporizador del ataque que anuncian. En la
  //  forja del Vulcano, por ejemplo, el anillo dura `avisoSeg` y el
  //  cambio de modo dispara en `o.t >= avisoSeg`. Son dos relojes
  //  paralelos sobre la misma constante.
  //
  //  Estirar solo el telegráfico los desincroniza: el anillo se
  //  cerraría antes (o después) del golpe que anuncia, que es peor que
  //  no alargarlo. Para alargarlos de verdad hay que mover TAMBIÉN el
  //  wind-up del ataque, y eso es por-ataque, no un multiplicador
  //  central — toca los 10 jefes y las 20 misiones.
  //
  //  Se queda declarado y a 1 para que el día que se haga esté el sitio
  //  hecho. Mientras tanto, el margen de reacción de EASY sale de
  //  `balaEnemiga` y `cadenciaEnemiga`, que sí son centrales y seguros.

  var IDS = ["easy", "medium", "high"];
  var NOMBRES = { easy: "FÁCIL", medium: "NORMAL", high: "DIFÍCIL" };
  var actual = "medium";

  function valida(id) { return IDS.indexOf(id) !== -1 ? id : "medium"; }

  return {
    IDS: IDS,
    NOMBRES: NOMBRES,
    CONFIG: CONFIG,

    // La dificultad en curso.
    id: function () { return actual; },
    nombre: function () { return NOMBRES[actual]; },

    // Cambiarla. Cualquier cosa que no sea de la lista cae en MEDIUM,
    // que es la única respuesta segura ante un save manipulado.
    poner: function (id) { actual = valida(id); return actual; },

    // El multiplicador. Si alguien pide una clave que no existe
    // devuelve 1, que es el valor neutro: una clave mal escrita deja el
    // juego canónico, nunca uno roto.
    m: function (clave) {
      var t = CONFIG[actual];
      return (t && typeof t[clave] === "number") ? t[clave] : 1;
    },

    // Para las pruebas: ¿esta dificultad es la identidad?
    esIdentidad: function (id) {
      var t = CONFIG[valida(id)], k;
      for (k in t) if (t[k] !== 1) return false;
      return true;
    },
  };
})();
