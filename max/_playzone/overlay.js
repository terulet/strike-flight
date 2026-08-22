"use strict";
// ════════════════════════════════════════════════════════════
//  CAPA DE INTEGRACIÓN DE PLAYZONE
//
//  Esto NO es parte del juego. Es lo único que PLAYZONE añade
//  encima: la puerta de salida al catálogo.
//
//  Vive aquí fuera, en max/_playzone/, y no dentro del juego, por
//  una razón concreta: el juego se sincroniza desde su repositorio
//  canónico y tiene que quedar BYTE A BYTE igual que el original.
//  Si el botón se editara dentro de index.html, cada sincronización
//  lo pisaría y volveríamos a tener dos versiones distintas.
//
//  El único rastro que PLAYZONE deja en el juego es una línea:
//    <script src="../_playzone/overlay.js" defer></script>
//  que inyecta tools/flight-strike/sync.mjs y comprueba verify.mjs.
//
//  Reglas que se respetan aquí:
//   · no se lee ni se toca ninguna variable del juego
//   · no se llama a preventDefault ni se para la propagación,
//     así que el juego sigue recibiendo todos los eventos
//   · nada de esto altera el lienzo, su tamaño ni su escala
// ════════════════════════════════════════════════════════════

(function () {
  var DESTINO   = "../index.html";  // el catálogo de PLAYZONE MAX
  var REAPARECE = 1600;             // ms parado antes de volver a verse
  var ARRASTRE  = 8;                // px: más que esto ya es arrastrar, no tocar
  var TOQUE_MAX = 600;              // ms: más que esto tampoco es un toque

  var css = document.createElement("style");
  css.textContent = [
    "#pzVolver{",
    "  position:fixed; z-index:2147483000;",
    "  top:calc(12px + env(safe-area-inset-top));",
    "  left:calc(12px + env(safe-area-inset-left));",
    // Redondo y pequeño a propósito: los juegos pintan su titulo de
    // pantalla centrado y arriba, y una pastilla con texto se le come
    // el principio. 38 px en la esquina no le quitan sitio a nada.
    "  width:38px; height:38px; border-radius:50%;",
    "  display:flex; align-items:center; justify-content:center;",
    "  border:1px solid rgba(255,255,255,.18);",
    "  background:rgba(8,8,16,.66); color:#d4cfe6;",
    "  text-decoration:none; -webkit-backdrop-filter:blur(6px); backdrop-filter:blur(6px);",
    "  font:700 19px/1 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;",
    "  padding-bottom:2px;",
    "  -webkit-user-select:none; user-select:none; -webkit-tap-highlight-color:transparent;",
    "  transition:opacity .22s ease, transform .22s ease;",
    "}",
    // Mientras se juega desaparece: así no tapa el HUD que el juego
    // dibuja arriba a la izquierda ni se pulsa sin querer al arrastrar.
    "#pzVolver.pz-oculto{ opacity:0; transform:translateY(-6px); pointer-events:none; }",
    "#pzVolver:active{ transform:scale(.96); }",
    "@media (prefers-reduced-motion: reduce){ #pzVolver{ transition:none; } }"
  ].join("\n");

  var boton = document.createElement("a");
  boton.id = "pzVolver";
  boton.href = DESTINO;
  boton.setAttribute("aria-label", "Volver a PLAYZONE MAX");
  boton.setAttribute("title", "Volver a PLAYZONE MAX");
  boton.textContent = "‹";

  function montar() {
    document.head.appendChild(css);
    document.body.appendChild(boton);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", montar);
  } else {
    montar();
  }

  // ── Aparecer y desaparecer ────────────────────────────────
  //  No preguntamos al juego en qué pantalla está: no queremos
  //  depender de sus variables, que cambian entre versiones.
  //  Basta con mirar si el jugador está tocando la pantalla.
  var reloj = 0;
  function ocultar() {
    clearTimeout(reloj);
    boton.classList.add("pz-oculto");
  }
  function mostrarLuego() {
    clearTimeout(reloj);
    reloj = setTimeout(function () {
      boton.classList.remove("pz-oculto");
    }, REAPARECE);
  }

  // ── Sólo un toque limpio sale del juego ───────────────────
  //  Si el dedo empieza sobre el botón pero se arrastra, era una
  //  maniobra de juego, no una salida: se cancela la navegación.
  var x0 = 0, y0 = 0, t0 = 0, arrastrado = false;

  addEventListener("pointerdown", function (e) {
    x0 = e.clientX; y0 = e.clientY; t0 = e.timeStamp;
    arrastrado = false;
    if (e.target !== boton && !boton.contains(e.target)) ocultar();
  }, true);

  addEventListener("pointermove", function (e) {
    if (Math.abs(e.clientX - x0) > ARRASTRE || Math.abs(e.clientY - y0) > ARRASTRE) {
      arrastrado = true;
      ocultar();
    }
  }, true);

  addEventListener("pointerup", mostrarLuego, true);
  addEventListener("pointercancel", mostrarLuego, true);

  boton.addEventListener("click", function (e) {
    // Un clic de teclado (Enter) llega sin coordenadas: ése siempre vale.
    var deTeclado = e.detail === 0;
    if (deTeclado) return;
    if (arrastrado || (e.timeStamp - t0) > TOQUE_MAX) e.preventDefault();
  });
})();
