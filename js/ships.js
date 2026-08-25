// ════════════════════════════════════════════════════════════
//  ships.js — catálogo de chasis de FLIGHT STRIKE
// ════════════════════════════════════════════════════════════
//
//  <script src> clásico, como los otros cuatro. Va ANTES del bloque del
//  juego porque `NAVES` se construye desde aquí.
//
//  ── Tres capas separadas, y separadas a propósito ──
//
//    id        técnico. NUNCA cambia. Es lo que va al save.
//    modelo    lo que se ve. Puede cambiar sin consecuencias.
//    legacy    alias de LECTURA para los saves que ya existen.
//
//  Los ids son `chassis_01..05` y no `vx9`/`ax4`: un id que contiene el
//  nombre comercial se queda desfasado en cuanto el nombre cambia, y ya
//  tenemos la lección en casa — los ids viejos eran nombres de personas
//  y por eso existe este bloque.
//
//  ── La ficha de juego va APARTE ──
//
//  Todo lo que afecta a cómo se juega vive dentro de `juego`. Lo de
//  fuera es identidad, presentación y cosmética. Así "esta nave es
//  cosmética" se comprueba de un vistazo, y el día que se toque el
//  balance se sabe exactamente dónde mirar.
//
//  En 4B cada chasis HEREDA la ficha completa de la nave que sustituye:
//  velocidad, cadencia, daño, radio de hitbox, arma inicial y escudo.
//  No se ha tocado ni un número.

var SHIPS = (function () {
  "use strict";

  // ── Alias de LECTURA ────────────────────────────────────
  //  Mapeo explícito, campo a campo. NO se hace ningún reemplazo global
  //  del texto "eloi": `eloi` es TAMBIÉN el nombre de la moneda del
  //  juego (`perfil.eloi`), y un buscar-y-reemplazar rompería la
  //  economía. Aquí solo se traduce el ID DE NAVE.
  //  El reparto sigue el COMPORTAMIENTO, no el orden en que estaban las
  //  naves viejas: YOLI ya era la rápida de hitbox mínima, así que es la
  //  interceptora; KALI era la lenta que pega el doble, así que es la de
  //  ataque. Con el reparto al revés, el nombre de la clase decía una
  //  cosa y la ficha hacía otra.
  var ALIAS = {
    yoli:   "chassis_01",     // vel 1,32 · hitbox 0,78 · rapid  → INTERCEPTOR
    kali:   "chassis_02",     // vel 0,86 · dmg 1,38 · cannon    → STRIKER
    silvia: "chassis_03",
    eloi:   "chassis_04",     // ← el id de NAVE. La moneda no se toca.
    // `clasica` conserva su propio id: sigue siendo una nave válida y
    // quien la tuviera equipada la mantiene. Ver `soloSiEquipada`.
  };

  // ── Catálogo ────────────────────────────────────────────
  //
  //  `escala`  factor de render sobre el ancho base (r · tamanoNave).
  //            NO toca la hitbox. Es lo que permite que un STRIKER se
  //            vea ancho y un INTERCEPTOR estilizado.
  //  `juego`   TODO lo que afecta a la partida. Heredado tal cual.
  //  `requiere` CUÁNTAS misiones hay que haber completado. Es el mismo
  //            número que `misionMax`, que vale "misiones completadas" y
  //            no "índice de la última": tras pasar la M2, misionMax es
  //            2. Así la condición es `requiere <= misionMax` y el cartel
  //            es "completar la M" + requiere, sin sumas ni restas que
  //            terminan desfasadas. null = disponible desde el principio.
  var CHASIS = [
    {
      // ← YOLI. Era ya la rápida de zona de impacto mínima: es la
      //   interceptora sin tocarle un número.
      id: "chassis_01", legacy: "yoli",
      modelo: "VX-9 TALON", clase: "INTERCEPTOR",
      desc: "Rapidísima. Zona de impacto mínima.",
      // Hasta 4C el sprite es el del legacy. La CLAVE de SPRITES es el
      // id del chasis, así que 4C solo cambia el nombre del archivo.
      archivo: "chassis_01_interceptor.png",
      // La escala va con la CLASE, no con el legacy: una interceptora se
      // dibuja estilizada y una de ataque, ancha.
      escala: 0.92,
      motor: "#7df9ff",
      stats: { ATAQUE: 2, VELOCIDAD: 5, CONTROL: 4 },
      requiere: null,
      trailPorDefecto: "ion",
      juego: { arma: "rapid", vel: 1.32, cad: 0.88, dmg: 0.82, hitbox: 0.78, escudo: 0 },
    },
    {
      // ← KALI. Lenta y con el daño más alto del juego: eso es un caza
      //   de ataque, no una interceptora.
      id: "chassis_02", legacy: "kali",
      modelo: "AX-4 WARHAWK", clase: "STRIKER",
      desc: "Pega el doble y gira la mitad.",
      archivo: "chassis_02_striker.png",
      escala: 1.06,
      motor: "#ff7a1f",
      stats: { ATAQUE: 5, VELOCIDAD: 2, CONTROL: 3 },
      requiere: 2,        // completar la M2
      trailPorDefecto: "solar",
      juego: { arma: "cannon", vel: 0.86, cad: 1.14, dmg: 1.38, hitbox: 1.10, escudo: 0 },
    },
    {
      id: "chassis_03", legacy: "silvia",
      modelo: "CR-7 BULWARK", clase: "AEGIS",
      desc: "Sale con escudo y arma de energía.",
      archivo: "chassis_03_aegis.png",
      // Ya con el asset real: es el chasis más ANCHO de los cinco
      // (proporción 1,024), así que subirle la escala lo hace grande sin
      // estirarlo a lo alto. Es justo lo que no se podía hacer con el
      // sprite legacy, que era el más estrecho del juego.
      escala: 1.12,
      motor: "#c77dff",
      stats: { ATAQUE: 3, VELOCIDAD: 4, CONTROL: 5 },
      requiere: 5,        // completar la M5
      trailPorDefecto: "violeta",
      juego: { arma: "electrico", vel: 1.08, cad: 0.96, dmg: 1, hitbox: 0.84, escudo: 1 },
    },
    {
      id: "chassis_04", legacy: "eloi",
      modelo: "NX-11 WRAITH", clase: "PHANTOM",
      desc: "Dispara más rápido que nadie. Y es la más fácil de acertar.",
      archivo: "chassis_04_phantom.png",
      escala: 0.95,
      motor: "#ff3d1a",
      stats: { ATAQUE: 5, VELOCIDAD: 4, CONTROL: 2 },
      requiere: 8,        // completar la M8
      trailPorDefecto: "rojo",
      juego: { arma: "fuego", vel: 1.10, cad: 0.82, dmg: 1.20, hitbox: 1.25, escudo: 0 },
    },
    {
      // ── NOVA · nuevo, sin legacy, BLOQUEADO ──
      //
      //  FICHA PROVISIONAL Y DECLARADA: son los valores NEUTROS de la
      //  arquitectura actual —los mismos que la CLÁSICA— todos a ×1.
      //  No está balanceada y no pretende estarlo: es un marcador de
      //  posición honesto para que la nave exista, se pueda desbloquear
      //  y se pueda previsualizar sin inventar una clase superior.
      //
      //  El balance de NOVA es trabajo posterior, con medición y con
      //  `duracion-*.mjs`, no aquí.
      id: "chassis_05", legacy: null,
      modelo: "SV-12 SOVEREIGN", clase: "NOVA",
      desc: "Prototipo de última generación. Ficha aún sin calibrar.",
      archivo: "chassis_05_nova.png",
      escala: 1.04,
      motor: "#d8dcff",
      stats: { ATAQUE: 3, VELOCIDAD: 3, CONTROL: 3 },
      requiere: 10,             // completar la M10
      fichaProvisional: true,
      trailPorDefecto: "cosmico",
      juego: { arma: "cannon", vel: 1, cad: 1, dmg: 1, hitbox: 1, escudo: 0 },
    },
    // ══════════════════════════════════════════════════
    //  FOUNDER FLEET · las cuatro naves personales
    // ══════════════════════════════════════════════════
    //
    //  Son los PNG originales de KALI, YOLI, SILVIA y ELOI, recuperados
    //  del historial y guardados aparte en `art/founder/`. No vuelven al
    //  juego: viven SOLO dentro del modo Admin.
    //
    //  `adminOnly` las saca de todo lo que es el juego normal —catálogo,
    //  desbloqueos, recompensas de campaña y cualquier tienda futura— de
    //  un solo sitio, `visibles()`, en vez de a base de excepciones
    //  repartidas. `legacyFounder` es lo que las marca como colección
    //  privada para lo que venga después.
    //
    //  Sus ids NO son los legacy (`kali`, `yoli`…): esos siguen siendo
    //  alias de lectura que apuntan a los chasis normales, y reutilizar
    //  el nombre le cambiaría la nave a cualquier save antiguo.
    //
    //  Las fichas son las suyas de siempre, sin tocar. No es un cambio
    //  de balance: es la misma nave que ya existía, en un sitio privado.
    {
      id: "founder_kali", legacy: null,
      modelo: "KALI", clase: "FOUNDER",
      desc: "La original. Pega el doble y gira la mitad.",
      archivo: "kali.png", carpeta: "art/founder/",
      escala: 1.06, motor: "#ff7a1f",
      stats: { ATAQUE: 5, VELOCIDAD: 2, CONTROL: 3 },
      requiere: null, adminOnly: true, legacyFounder: true,
      trailPorDefecto: "solar",
      juego: { arma: "cannon", vel: 0.86, cad: 1.14, dmg: 1.38, hitbox: 1.10, escudo: 0 },
    },
    {
      id: "founder_yoli", legacy: null,
      modelo: "YOLI", clase: "FOUNDER",
      desc: "La original. Rapidísima, zona de impacto mínima.",
      archivo: "yoli.png", carpeta: "art/founder/",
      escala: 0.92, motor: "#7df9ff",
      stats: { ATAQUE: 2, VELOCIDAD: 5, CONTROL: 4 },
      requiere: null, adminOnly: true, legacyFounder: true,
      trailPorDefecto: "ion",
      juego: { arma: "rapid", vel: 1.32, cad: 0.88, dmg: 0.82, hitbox: 0.78, escudo: 0 },
    },
    {
      id: "founder_silvia", legacy: null,
      modelo: "SILVIA", clase: "FOUNDER",
      desc: "La original. Sale con escudo y arma de energía.",
      archivo: "silvia.png", carpeta: "art/founder/",
      escala: 1.12, motor: "#c77dff",
      stats: { ATAQUE: 3, VELOCIDAD: 4, CONTROL: 5 },
      requiere: null, adminOnly: true, legacyFounder: true,
      trailPorDefecto: "violeta",
      juego: { arma: "electrico", vel: 1.08, cad: 0.96, dmg: 1, hitbox: 0.84, escudo: 1 },
    },
    {
      // Ojo: esta es la NAVE de Eloi. La moneda del juego se llama
      // igual y no tiene nada que ver — `perfil.eloi`.
      id: "founder_eloi", legacy: null,
      modelo: "ELOI", clase: "FOUNDER",
      desc: "La original. Dispara más rápido que nadie.",
      archivo: "eloi.png", carpeta: "art/founder/",
      escala: 0.95, motor: "#ff3d1a",
      stats: { ATAQUE: 5, VELOCIDAD: 4, CONTROL: 2 },
      requiere: null, adminOnly: true, legacyFounder: true,
      trailPorDefecto: "rojo",
      juego: { arma: "fuego", vel: 1.10, cad: 0.82, dmg: 1.20, hitbox: 1.25, escudo: 0 },
    },
    {
      // ── CLÁSICA · nave heredada que NO se retira ──
      //
      //  Sigue existiendo por dos motivos: es el repuesto vectorial si
      //  falla un PNG, y puede haber alguien que la tenga equipada.
      //  Quitarle a alguien la nave con la que juega sería el peor
      //  resultado posible de esta actualización.
      //
      //  `soloSiEquipada`: no aparece en el selector salvo que sea la
      //  que llevas puesta. Así el catálogo son cinco chasis limpios y
      //  nadie pierde nada.
      id: "clasica", legacy: null,
      modelo: "CLÁSICA", clase: "POLIVALENTE",
      desc: "Sin manías. Hace de todo.",
      archivo: null,
      escala: 1.00,
      motor: "#ffcf5c",
      stats: { ATAQUE: 3, VELOCIDAD: 3, CONTROL: 3 },
      requiere: null,
      legado: true, soloSiEquipada: true,
      juego: { arma: "cannon", vel: 1, cad: 1, dmg: 1, hitbox: 1, escudo: 0 },
    },
  ];

  // ── SKINS ───────────────────────────────────────────────
  //  Sistema MIXTO, y con una separación honesta.
  //
  //  `tinte`    se compone por código sobre el chasis. Cubre cualquier
  //             combinación de colores, no gasta un solo asset y sale
  //             gratis en partida (se compone UNA vez y se cachea).
  //  `material` NO se puede hacer con color: hielo, brasas, corrosión,
  //             rayos o una nebulosa dentro del casco son CONTENIDO, no
  //             tono. Necesitan un PNG por chasis. Quedan declaradas y
  //             marcadas `pendiente: true` — se muestran bloqueadas en
  //             el Hangar hasta que exista el arte, en vez de mentir
  //             haciendo un cambio de matiz que queda mal.
  var SKINS = [
    { id: "default", nombre: "ESTÁNDAR", tipo: "tinte", pal: null },
    { id: "neon",    nombre: "NEÓN",     tipo: "tinte",
      pal: { p: "#1b0b3a", s: "#c77dff", a: "#00f5ff" } },
    { id: "shadow",  nombre: "SOMBRA",   tipo: "tinte",
      pal: { p: "#0a0a10", s: "#2a2a38", a: "#8a3fd6" } },
    { id: "golden",  nombre: "DORADA",   tipo: "tinte",
      pal: { p: "#3a2a06", s: "#ffd700", a: "#fff3c4" } },
    { id: "desert",  nombre: "DESIERTO", tipo: "tinte",
      pal: { p: "#3a2f18", s: "#c9a86a", a: "#ff8a1f" } },
    // ── Pendientes de asset ──
    //  `requiere` (bloque 5H): la misión de la EXPANSIÓN cuyo jefe las
    //  premia — arctic/KRYOS (M12), storm/VÉRTICE (M14), toxic/NÝX
    //  (M16), inferno/VULCANO (M18), cosmic/AXIOMA (M20). Es el MISMO
    //  campo y la MISMA semántica que ya usa `CHASIS[].requiere`
    //  ("completar la misión N"), no una condición nueva. Que sigan
    //  `pendiente:true` es independiente de esto: bloquea la SELECCIÓN
    //  en el Hangar porque falta el PNG de material, no el desbloqueo.
    //  El desbloqueo (bloque 5H) ya queda escrito en el save al matar
    //  cada jefe, así que el día que 5I traiga el arte no hay que tocar
    //  nada de esto.
    // `arteChasis` (bloque 5I): en qué chasis hay PNG de material de
    // verdad, no tinte. Hoy solo chassis_01 — el pack de la expansión
    // solo trae esa. `pendiente` sigue en `true` aquí a propósito: sigue
    // siendo la respuesta correcta para chassis_02-05, que no tienen
    // arte. Quien decide "pendiente" por chasis es el Hangar
    // (js/hangar.js), que conoce qué nave está mirando el jugador; este
    // objeto compartido no puede, porque un solo `pendiente` no puede
    // valer "sí" para un chasis y "no" para otro a la vez.
    { id: "inferno", nombre: "INFIERNO", tipo: "material", pendiente: true, requiere: 18,
      archivoChasis: { chassis_01: "inferno.png" }, arteChasis: ["chassis_01"],
      pal: { p: "#2a0a04", s: "#ff3d1a", a: "#ffcf5c" } },
    { id: "arctic",  nombre: "ÁRTICA",   tipo: "material", pendiente: true, requiere: 12,
      archivoChasis: { chassis_01: "arctic.png" }, arteChasis: ["chassis_01"],
      pal: { p: "#0d2233", s: "#8fe3ff", a: "#ffffff" } },
    { id: "toxic",   nombre: "TÓXICA",   tipo: "material", pendiente: true, requiere: 16,
      archivoChasis: { chassis_01: "toxic.png" }, arteChasis: ["chassis_01"],
      pal: { p: "#12240a", s: "#8aff4d", a: "#d9ff00" } },
    { id: "storm",   nombre: "TORMENTA", tipo: "material", pendiente: true, requiere: 14,
      archivoChasis: { chassis_01: "storm.png" }, arteChasis: ["chassis_01"],
      pal: { p: "#101828", s: "#5cc8ff", a: "#ffffff" } },
    { id: "cosmic",  nombre: "CÓSMICA",  tipo: "material", pendiente: true, requiere: 20,
      archivoChasis: { chassis_01: "cosmic.png" }, arteChasis: ["chassis_01"],
      pal: { p: "#150a2e", s: "#b45cff", a: "#7df9ff" } },
  ];

  // ── TRAILS ──────────────────────────────────────────────
  //  Solo datos: color, núcleo, ritmo, vida y grosor. Los pinta el
  //  sistema de partículas que ya existe, con la familia `motor`, que
  //  tiene tope propio y NO es desalojable. Cero partículas nuevas.
  var TRAILS = [
    { id: "ion",    nombre: "ION BLANCO",   col: "#9beeff", nucleo: "#ffffff", ritmo: 1.3, vida: 1.0, r: 0.9 },
    { id: "plasma", nombre: "PLASMA AZUL",  col: "#7df9ff", nucleo: "#ffffff", ritmo: 1.0, vida: 1.0, r: 1.0 },
    { id: "rojo",   nombre: "PLASMA ROJO",  col: "#ff3d1a", nucleo: "#ffcf5c", ritmo: 1.0, vida: 1.1, r: 1.1 },
    { id: "violeta",nombre: "VIOLETA",      col: "#c77dff", nucleo: "#ffffff", ritmo: 0.9, vida: 1.2, r: 1.0 },
    { id: "toxico", nombre: "TÓXICO",       col: "#8aff4d", nucleo: "#d9ff00", ritmo: 1.1, vida: 1.1, r: 0.95 },
    { id: "solar",  nombre: "SOLAR",        col: "#ff8a1f", nucleo: "#fff3c4", ritmo: 1.2, vida: 0.9, r: 1.15 },
    { id: "cosmico",nombre: "CÓSMICO",      col: "#b45cff", nucleo: "#7df9ff", ritmo: 0.85, vida: 1.35, r: 1.05 },
  ];

  // ── EMBLEMAS ────────────────────────────────────────────
  //  Se muestran en el Hangar, en la ficha y en resultados. NUNCA sobre
  //  el sprite en partida: la nave se dibuja a ~77 px de ancho y un
  //  emblema legible ahí serían 12 px, o sea una mancha encima de lo
  //  único que el jugador necesita leer mejor que nada.
  var EMBLEMAS = [
    { id: "ninguno", nombre: "NINGUNO", archivo: null },
    { id: "skull",   nombre: "CALAVERA", archivo: "skull.png" },
    { id: "wolf",    nombre: "LOBO",     archivo: "wolf.png" },
    { id: "tiger",   nombre: "TIGRE",    archivo: "tiger.png" },
    { id: "phoenix", nombre: "FÉNIX",    archivo: "phoenix.png" },
    { id: "dragon",  nombre: "DRAGÓN",   archivo: "dragon.png" },
    { id: "cobra",   nombre: "COBRA",    archivo: "cobra.png" },
    { id: "eye",     nombre: "OJO",      archivo: "eye.png" },
    { id: "crystal", nombre: "CRISTAL",  archivo: "crystal.png" },
    { id: "wings",   nombre: "ALAS",     archivo: "wings.png" },
    { id: "solar",   nombre: "SOLAR",    archivo: "solar.png" },

    // ── Emblemas de la expansión (bloque 5I) ────────────────
    //  A diferencia de los diez de arriba, estos SÍ tienen `requiere`:
    //  se ganan al derrotar al jefe de su mundo, no se eligen libres
    //  desde el principio. Mismo campo y semántica que `CHASIS[].requiere`
    //  y `SKINS[].requiere` — "completar la misión N" — y el mismo
    //  guardado (`naves.emblemasDesbloqueadas`) que ya usan chasis y
    //  skins, no una economía nueva. Se cargan BAJO DEMANDA
    //  (`asegurarEmblema()` en index.html), a diferencia de los diez de
    //  arriba que se piden todos al arrancar: esos diez son gratis desde
    //  el primer minuto, y estos cinco no existen hasta pasada la
    //  campaña base, así que pedirlos en el arranque sería exactamente
    //  el mismo error que causó el bug de premios de 5F.
    { id: "kryos",   nombre: "KRYOS",   archivo: "expansion/kryos.png",   requiere: 12 },
    { id: "vertice", nombre: "VÉRTICE", archivo: "expansion/vertice.png", requiere: 14 },
    { id: "nyx",     nombre: "NÝX",     archivo: "expansion/nyx.png",     requiere: 16 },
    { id: "vulcano", nombre: "VULCANO", archivo: "expansion/vulcano.png", requiere: 18 },
    { id: "axioma",  nombre: "AXIOMA",  archivo: "expansion/axioma.png",  requiere: 20 },
  ];

  // Paleta de colores que puede elegir el jugador. Cerrada a propósito:
  // un selector libre de color deja elegir combinaciones ilegibles, y la
  // nave tiene que leerse sobre cuatro fondos distintos.
  var COLORES = [
    "#7df9ff", "#5ce1ff", "#2b6cff", "#c77dff", "#b45cff", "#ff2ea6",
    "#ff3b5c", "#ff7a1f", "#ffcf5c", "#8aff4d", "#17a58c", "#ffffff",
    "#9aa4b8", "#3a3f52", "#0a0a10",
  ];

  var porId = {};
  for (var i = 0; i < CHASIS.length; i++) porId[CHASIS[i].id] = CHASIS[i];
  var skinPorId = {}, trailPorId = {}, emblemaPorId = {};
  for (i = 0; i < SKINS.length; i++) skinPorId[SKINS[i].id] = SKINS[i];
  for (i = 0; i < TRAILS.length; i++) trailPorId[TRAILS[i].id] = TRAILS[i];
  for (i = 0; i < EMBLEMAS.length; i++) emblemaPorId[EMBLEMAS[i].id] = EMBLEMAS[i];

  // ── Compositor de tinte ─────────────────────────────────
  //  Compone UNA vez por combinación y guarda el resultado. En partida
  //  no cuesta nada: se dibuja un canvas como se dibujaría un PNG.
  //
  //  Y funciona con file://. El truco es que `source-atop` se aplica
  //  sobre un lienzo AUXILIAR que solo contiene la nave, no sobre el
  //  lienzo del juego —que es opaco y donde sí saldría un cuadrado, la
  //  trampa que este proyecto tiene documentada—. Además no hace falta
  //  `getImageData` en ningún momento, que es lo que file:// prohíbe.
  var cache = {};
  function componer(sprite, pal) {
    if (!sprite || !pal) return sprite;
    var w = sprite.width || sprite.naturalWidth, h = sprite.height || sprite.naturalHeight;
    if (!w || !h) return sprite;
    var cv, cx;
    try {
      cv = document.createElement("canvas");
      cv.width = w; cv.height = h;
      cx = cv.getContext("2d");
      cx.drawImage(sprite, 0, 0, w, h);

      // Carrocería: degradado del color principal al secundario, solo
      // encima de la nave. Alfa contenido para no perder el relieve del
      // dibujo — si se sube, la nave deja de parecer metal.
      cx.globalCompositeOperation = "source-atop";
      cx.globalAlpha = 0.62;
      var g = cx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, pal.s);
      g.addColorStop(0.55, pal.p);
      g.addColorStop(1, pal.p);
      cx.fillStyle = g;
      cx.fillRect(0, 0, w, h);

      // Se recupera el brillo perdido: el dibujo original en aditivo, a
      // poca opacidad, devuelve los reflejos y los cantos.
      cx.globalCompositeOperation = "lighter";
      cx.globalAlpha = 0.42;
      cx.drawImage(sprite, 0, 0, w, h);

      // Acento en el reactor: la parte baja de la nave.
      cx.globalAlpha = 0.5;
      var ga = cx.createRadialGradient(w / 2, h * 0.82, 0, w / 2, h * 0.82, w * 0.42);
      ga.addColorStop(0, pal.a);
      ga.addColorStop(1, "rgba(0,0,0,0)");
      cx.fillStyle = ga;
      cx.globalCompositeOperation = "source-atop";
      cx.fillRect(0, 0, w, h);

      cx.globalCompositeOperation = "source-over";
      cx.globalAlpha = 1;
      return cv;
    } catch (e) { return sprite; }
  }

  // ¿Estamos en modo Admin? Una sola función, y todo lo que hace es
  // preguntar. Está aquí y no repartida por el archivo para que "qué
  // cambia en admin" se pueda leer de un vistazo, y para que ships.js
  // siga funcionando entero aunque admin.js no exista.
  function admin() {
    return typeof ADMIN !== "undefined" && ADMIN.activo();
  }

  // Los chasis del catálogo visible, en orden.
  //
  //  · La CLÁSICA queda fuera salvo que sea la equipada.
  //  · La FOUNDER FLEET queda fuera SIEMPRE, salvo en modo Admin. Este
  //    `continue` es la frontera entera entre la colección privada y el
  //    juego normal: si alguien lo quita, las cuatro naves personales
  //    aparecen en el Hangar de cualquiera.
  function visibles(equipada) {
    var esAdmin = admin();
    var out = [];
    for (var i = 0; i < CHASIS.length; i++) {
      var c = CHASIS[i];
      if (c.adminOnly && !esAdmin) continue;
      if (c.soloSiEquipada && c.id !== equipada) continue;
      out.push(c);
    }
    return out;
  }

  var api = {
    CHASIS: CHASIS,
    ALIAS: ALIAS,

    porId: function (id) { return porId[id] || null; },

    // Traduce un id guardado a un id actual. Solo LECTURA: no reescribe
    // el save. El id nuevo se graba solo la próxima vez que el jugador
    // cambie de nave, así que un save viejo sigue siendo válido y se
    // puede volver atrás sin haber perdido nada.
    resolver: function (id) {
      if (!id) return null;
      if (porId[id]) return id;
      return ALIAS[id] || null;
    },

    visibles: visibles,

    // ── Disponibilidad ────────────────────────────────────
    //  `requiere` es un dato; quien decide es el save. El enganche al
    //  progreso de campaña es del bloque 4E: aquí solo se responde.
    disponible: function (id, desbloqueadas) {
      var c = porId[id];
      if (!c) return false;
      // En Admin no hay requisitos: es el sentido del modo. No se toca
      // la lista de desbloqueadas del save, solo se responde que sí.
      if (admin()) return true;
      if (c.requiere == null) return true;
      return !!(desbloqueadas && desbloqueadas.indexOf(id) >= 0);
    },

    SKINS: SKINS, TRAILS: TRAILS, EMBLEMAS: EMBLEMAS, COLORES: COLORES,
    skin: function (id) { return skinPorId[id] || skinPorId.default; },
    trail: function (id) { return trailPorId[id] || trailPorId.plasma; },
    emblema: function (id) { return emblemaPorId[id] || emblemaPorId.ninguno; },

    // ── Configuración del jugador por chasis ──────────────
    //  Vive en el SAVE (`naves.config[id]`), no aquí: el chasis es del
    //  juego y la configuración es del jugador.
    config: function (id) {
      var c = (typeof SAVE !== "undefined" && SAVE.get("naves.config", {})) || {};
      var o = c[id] || {};
      var ch = porId[id];
      return {
        customName: typeof o.customName === "string" ? o.customName.slice(0, 16) : "",
        skinId: skinPorId[o.skinId] ? o.skinId : "default",
        trailId: trailPorId[o.trailId] ? o.trailId : (ch && ch.trailPorDefecto) || "plasma",
        emblemId: emblemaPorId[o.emblemId] ? o.emblemId : "ninguno",
        colors: {
          primary:   typeof o.primary === "string" ? o.primary : null,
          secondary: typeof o.secondary === "string" ? o.secondary : null,
          accent:    typeof o.accent === "string" ? o.accent : null,
        },
      };
    },

    guardarConfig: function (id, campos) {
      if (typeof SAVE === "undefined" || !porId[id]) return false;
      var c = SAVE.get("naves.config", {}) || {};
      var o = c[id] || (c[id] = {});
      for (var k in campos) {
        if (Object.prototype.hasOwnProperty.call(campos, k)) o[k] = campos[k];
      }
      SAVE.set("naves.config", c, "personalización " + id);
      cache = {};                 // el tinte cacheado ya no vale
      return true;
    },

    // La paleta efectiva: los colores del jugador mandan sobre los de la
    // skin, y si no ha tocado nada se usan los de la skin tal cual.
    paleta: function (id) {
      var cf = api.config(id);
      var sk = skinPorId[cf.skinId] || skinPorId.default;
      var base = sk.pal;
      if (!base && !cf.colors.primary) return null;   // ESTÁNDAR sin tocar: sin tinte
      return {
        p: cf.colors.primary   || (base && base.p) || "#2a2a38",
        s: cf.colors.secondary || (base && base.s) || "#9aa4b8",
        a: cf.colors.accent    || (base && base.a) || "#7df9ff",
      };
    },

    // Devuelve el sprite LISTO para dibujar: el original si no hay nada
    // que aplicar, o el compuesto si hay skin o colores.
    //
    // `arteMaterial` (bloque 5I, opcional): el PNG de material YA
    // CARGADO para esta skin+chasis, si quien llama lo tiene. Es el
    // resultado final tal cual — no pasa por `componer()`, porque
    // recolorearlo por encima sería exactamente el "recolorear mal para
    // fingir una skin premium" que no se quiere. Los colores propios del
    // jugador tampoco se le aplican: una skin de material sustituye a la
    // paleta, no la hereda.
    sprite: function (id, original, arteMaterial) {
      if (arteMaterial) return arteMaterial;
      if (!original) return null;
      var pal = api.paleta(id);
      if (!pal) return original;
      var clave = id + "|" + pal.p + pal.s + pal.a;
      if (cache[clave]) return cache[clave];
      var hecho = componer(original, pal);
      cache[clave] = hecho;
      return hecho;
    },
    limpiarCache: function () { cache = {}; },

    // ── Desbloqueos ───────────────────────────────────────
    //  Concesión RETROACTIVA: alguien que ya se pasó la M8 no puede
    //  encontrarse con tres chasis bloqueados por haber actualizado. Se
    //  concede en silencio —cuatro avisos de golpe al abrir el juego son
    //  ruido, no recompensa— y se incluye SIEMPRE la que llevara
    //  equipada, aunque su misión no llegue: quitarle a alguien la nave
    //  con la que juega sería el peor resultado de esta actualización.
    otorgarPorProgreso: function (misionMax, equipada, avisar) {
      if (typeof SAVE === "undefined") return [];
      var lista = (SAVE.get("naves.desbloqueadas", []) || []).slice();
      var nuevos = [];
      for (var i = 0; i < CHASIS.length; i++) {
        var c = CHASIS[i];
        if (lista.indexOf(c.id) >= 0) continue;
        // La CLÁSICA no se concede a nadie: no está en el catálogo salvo
        // que ya la lleves puesta, y meterla en la lista de desbloqueadas
        // solo ensuciaría el guardado con una nave que no se puede elegir.
        if (c.soloSiEquipada && c.id !== equipada) continue;
        // La FOUNDER FLEET no se gana jugando y no entra en la lista de
        // desbloqueadas del jugador. En Admin está disponible por
        // `disponible()`, sin escribir nada en ningún save.
        if (c.adminOnly) continue;
        var toca = c.requiere == null || c.requiere <= misionMax || c.id === equipada;
        if (!toca) continue;
        lista.push(c.id);
        nuevos.push(c);
      }
      if (nuevos.length) {
        SAVE.set("naves.desbloqueadas", lista, "desbloqueos");
        if (avisar && typeof UI !== "undefined") {
          for (var j = 0; j < nuevos.length; j++) {
            UI.desbloqueo({ tipo: "nave", titulo: nuevos[j].modelo,
              desc: nuevos[j].clase, sprite: nuevos[j].id, color: nuevos[j].motor });
          }
        }
      }
      return nuevos;
    },

    // ── Desbloqueo de SKINS por progreso (bloque 5H) ───────
    //  Mismo patrón que `otorgarPorProgreso` de arriba, para la lista
    //  aparte de skins: concesión RETROACTIVA y en silencio, con aviso
    //  solo si `avisar`. No es un sistema nuevo, es el mismo aplicado a
    //  la tabla de al lado.
    otorgarSkinsPorProgreso: function (misionMax, avisar) {
      if (typeof SAVE === "undefined") return [];
      var lista = (SAVE.get("naves.skinsDesbloqueadas", []) || []).slice();
      var nuevos = [];
      for (var i = 0; i < SKINS.length; i++) {
        var s = SKINS[i];
        if (s.requiere == null || lista.indexOf(s.id) >= 0) continue;
        if (s.requiere > misionMax) continue;
        lista.push(s.id);
        nuevos.push(s);
      }
      if (nuevos.length) {
        SAVE.set("naves.skinsDesbloqueadas", lista, "skins desbloqueadas");
        if (avisar && typeof UI !== "undefined") {
          for (var j = 0; j < nuevos.length; j++) {
            UI.desbloqueo({ tipo: "skin", titulo: nuevos[j].nombre,
              desc: "Skin de material", color: (nuevos[j].pal && nuevos[j].pal.s) || "#fff" });
          }
        }
      }
      return nuevos;
    },

    // ── Disponibilidad de una SKIN ─────────────────────────
    //  Igual que `disponible()` para chasis: `requiere` es un dato, el
    //  save decide. Las cinco de `tipo:"tinte"` no tienen `requiere` y
    //  están libres desde siempre, como hasta ahora.
    skinDisponible: function (id, skinsDesbloqueadas) {
      var s = skinPorId[id];
      if (!s) return false;
      if (admin()) return true;
      if (s.requiere == null) return true;
      return !!(skinsDesbloqueadas && skinsDesbloqueadas.indexOf(id) >= 0);
    },

    // ── Arte de material por chasis (bloque 5I) ────────────
    //  `null` si esta skin es de tinte, o si es de material pero este
    //  chasis en concreto no tiene PNG (hoy: cualquiera que no sea
    //  chassis_01). Quien llama compone la clave de SPRITES con esto;
    //  ships.js no toca SPRITES directamente, sigue la misma frontera
    //  que ya usa `sprite()` con el sprite del chasis.
    materialArchivo: function (skinId, chasisId) {
      var s = skinPorId[skinId];
      if (!s || s.tipo !== "material" || !s.archivoChasis) return null;
      return s.archivoChasis[chasisId] || null;
    },
    materialDisponible: function (skinId, chasisId) {
      var s = skinPorId[skinId];
      return !!(s && s.arteChasis && s.arteChasis.indexOf(chasisId) >= 0);
    },

    // ── Desbloqueo de EMBLEMAS por progreso (bloque 5I) ────
    //  Mismo patrón exacto que `otorgarSkinsPorProgreso`. Los diez
    //  emblemas de siempre no tienen `requiere` y siguen libres desde el
    //  principio; estos cinco sí, y se ganan al derrotar al jefe de su
    //  mundo — sin economía nueva, sin gastar ELOI.
    otorgarEmblemasPorProgreso: function (misionMax, avisar) {
      if (typeof SAVE === "undefined") return [];
      var lista = (SAVE.get("naves.emblemasDesbloqueadas", []) || []).slice();
      var nuevos = [];
      for (var i = 0; i < EMBLEMAS.length; i++) {
        var e = EMBLEMAS[i];
        if (e.requiere == null || lista.indexOf(e.id) >= 0) continue;
        if (e.requiere > misionMax) continue;
        lista.push(e.id);
        nuevos.push(e);
      }
      if (nuevos.length) {
        SAVE.set("naves.emblemasDesbloqueadas", lista, "emblemas desbloqueados");
        if (avisar && typeof UI !== "undefined") {
          for (var j = 0; j < nuevos.length; j++) {
            UI.desbloqueo({ tipo: "emblema", titulo: nuevos[j].nombre,
              desc: "Emblema de la expansión", sprite: null, color: "#c9a8ff" });
          }
        }
      }
      return nuevos;
    },

    emblemaDisponible: function (id, emblemasDesbloqueadas) {
      var e = emblemaPorId[id];
      if (!e) return false;
      if (admin()) return true;
      if (e.requiere == null) return true;
      return !!(emblemasDesbloqueadas && emblemasDesbloqueadas.indexOf(id) >= 0);
    },

    // Para 4E y para poder probar desde la consola:
    //    SHIPS.desbloquear("chassis_05")
    desbloquear: function (id, guardar) {
      var c = porId[id];
      if (!c) return false;
      if (typeof SAVE === "undefined") return false;
      var lista = SAVE.get("naves.desbloqueadas", []) || [];
      if (lista.indexOf(id) >= 0) return false;
      lista = lista.concat([id]);
      SAVE.set("naves.desbloqueadas", lista, "nave " + id);
      if (guardar !== false) SAVE.ya("desbloqueo de nave");
      return true;
    },

    // ── Puente hacia la tabla que el juego ya usaba ────────
    //  Se construye un array con la MISMA forma que tenía `NAVES`, para
    //  que las decenas de sitios que leen `.arma`, `.vel`, `.hitbox`,
    //  `.motor`, `.nombre`... sigan funcionando sin tocarlos. Lo nuevo
    //  —modelo, clase, escala, bloqueado— se añade encima.
    construir: function (equipada, desbloqueadas) {
      var lista = visibles(equipada), out = [];
      for (var i = 0; i < lista.length; i++) {
        var c = lista[i];
        out.push({
          id: c.id,
          // `nombre` es lo que pinta la interfaz que ya existe. Se le da
          // el MODELO, así que el juego muestra los nombres nuevos sin
          // tocar ni una línea de UI.
          nombre: c.modelo,
          lema: c.clase,
          desc: c.desc,
          src: c.archivo
            ? [(c.carpeta || "art/naves/") + c.archivo,
               "assets/naves/" + c.archivo, "assets/" + c.archivo]
            : null,
          fija: true,
          escala: c.escala,
          motor: c.motor,
          stats: c.stats,
          legado: !!c.legado,
          adminOnly: !!c.adminOnly,
          founder: !!c.legacyFounder,
          provisional: !!c.fichaProvisional,
          requiere: c.requiere,
          bloqueada: !this.disponible(c.id, desbloqueadas),
          // La ficha de juego se aplana sobre el objeto porque es lo que
          // el motor lee hoy (`naveActual().vel`, `.hitbox`...). El
          // original sigue agrupado en CHASIS[].juego, que es la fuente.
          arma: c.juego.arma, vel: c.juego.vel, cad: c.juego.cad,
          dmg: c.juego.dmg, hitbox: c.juego.hitbox, escudo: c.juego.escudo,
        });
      }
      return out;
    },
  };

  return api;
})();
