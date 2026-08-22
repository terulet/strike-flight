// ════════════════════════════════════════════════════════════
//  misiones.js — mundos y guión de la campaña de FLIGHT STRIKE
// ════════════════════════════════════════════════════════════
//
//  <script src> clásico, y SOLO DATOS. Sale de index.html en el bloque
//  5A sin tocar una coma.
//
//  Aquí viven tres cosas y conviene no confundirlas:
//
//    TEMAS               los mundos: paleta, fondo y partícula de fondo.
//    SURVIVAL_MUNDOS     cuáles de esos mundos ofrece SUPERVIVENCIA.
//    MISIONES            el guión de la campaña, evento a evento.

// ════════════════════════════════════════════════════════════
//  MUNDOS
// ════════════════════════════════════════════════════════════
//  Los mundos van OSCUROS a propósito. La nave se elige aparte del mundo,
//  así que cualquiera puede acabar en cualquiera: si el fondo también grita,
//  se pelean. El escenario recede y el color lo pone la nave.
const TEMAS = [
  // Los enemigos huyen del rosa (reservado a SUS balas) y del cian
  // (reservado a las TUYAS). Cálido = amenaza, frío = tú.
  { id:"espacio", nombre:"ESPACIO PROFUNDO", icono:"✦", fondoA:"#03050e", fondoB:"#0d1130",
    bg:"estrellas", bgColor:"#a8bcff",
    nave:"#5ce1ff", naveAla:"#2b6cff", cabina:"#fff6a8", motor:"#ffcf5c",
    bala:"#ffe066", enemigoA:"#e0662a", enemigoB:"#d9a520", enemigoC:"#8a5ce0" },

  { id:"oceano", nombre:"FOSA ABISAL", icono:"≈", fondoA:"#010a11", fondoB:"#052733",
    bg:"burbujas", bgColor:"#6fd0e8",
    nave:"#8affd1", naveAla:"#00a89c", cabina:"#eaffff", motor:"#7de8ff",
    bala:"#b6ffe8", enemigoA:"#e07a35", enemigoB:"#c9a53a", enemigoC:"#6f52c9" },

  { id:"volcan", nombre:"NÚCLEO DE LAVA", icono:"▲", fondoA:"#120303", fondoB:"#331002",
    bg:"brasas", bgColor:"#e8853a",
    nave:"#ffd86b", naveAla:"#ff6b1f", cabina:"#fff3d0", motor:"#ff3d00",
    bala:"#fff07a", enemigoA:"#5a3fd6", enemigoB:"#17a58c", enemigoC:"#9b40d6" },

  { id:"neon", nombre:"CIUDAD NEÓN", icono:"◈", fondoA:"#050110", fondoB:"#1c0730",
    bg:"rejilla", bgColor:"#d63a95",
    nave:"#c77dff", naveAla:"#ff2ea6", cabina:"#00f5ff", motor:"#00f5ff",
    bala:"#00f5ff", enemigoA:"#ff5c1a", enemigoB:"#2bd97f", enemigoC:"#b45cff" },

  // ── Mundos de la EXPANSIÓN (M11–M20) ──────────────────────
  //  Tres campos que los cuatro de arriba no tienen, y ninguno es
  //  decorativo:
  //
  //    soloCampana  Etiqueta, no cerradura. Quien decide qué mundos hay
  //                 en supervivencia es SURVIVAL_MUNDOS y solo él; esto
  //                 dice de dónde SALE el mundo, para que una pantalla o
  //                 una prueba pueda distinguirlos sin listarlos a mano.
  //    fondoRef     De qué mundo toma prestado el fondo mientras no
  //                 tenga el suyo. Sin esto haría falta un PNG por mundo
  //                 el primer día, o un 404 por fotograma.
  //    hazards      Qué peligros ADMITE el mundo. El guión sigue
  //                 mandando —un evento pide el hazard que quiere— pero
  //                 esto deja escrito qué pega en cada sitio, que es lo
  //                 que evita que la fragua acabe con témpanos.
  //    primitivas   Qué efectos de escenario usa. Igual: documentación
  //                 ejecutable, no una cerradura.
  //    pista        Música de combate del mundo. Hoy solo hay dos
  //                 pistas, así que se reparten; cuando 5I traiga las
  //                 suyas, se cambia AQUÍ y ya está.
  //  Desde el bloque 5I los cinco mundos de la expansión tienen pista
  //  propia (audio/musica/combate_c|d|e.mp3, ver js/music.js). El reparto
  //  no es el orden en que llegaron en el pack: hielo y fragua comparten
  //  "combate_c" (misma familia de tempo, 130 BPM, y no son mundos
  //  contiguos); abismo y grieta comparten "combate_d" ("Space Adventure"
  //  es la más atmosférica de las tres, y ambos mundos son el registro
  //  "extraño/onírico" de la expansión); megaciudad se queda sola con
  //  "combate_e" ("Hard Battle 2"), la más agresiva, para que el mundo
  //  más urbano/neón destaque del resto en vez de sonar a más de lo
  //  mismo.
  { id:"hielo", nombre:"FRONTERA HELADA", icono:"❄", fondoA:"#030a10", fondoB:"#0c1c26",
    bg:"estrellas", bgColor:"#cfe9ff",
    nave:"#e8f6ff", naveAla:"#4fa8d8", cabina:"#ffffff", motor:"#9fe0ff",
    bala:"#dff4ff", enemigoA:"#e8a33a", enemigoB:"#d1701f", enemigoC:"#a86a2e",
    soloCampana:true, hazards:["tempano","cristal"], primitivas:[], pista:"combate_c" },

  { id:"megaciudad", nombre:"MEGACIUDAD", icono:"▦", fondoA:"#06030f", fondoB:"#1a0a2e",
    bg:"rejilla", bgColor:"#c93ad6",
    nave:"#5cffd6", naveAla:"#00b0ff", cabina:"#eafffb", motor:"#7ef2ff",
    bala:"#9dfff0", enemigoA:"#ff7a1a", enemigoB:"#ffd23a", enemigoC:"#8a5ce0",
    soloCampana:true, hazards:["trafico"], primitivas:[], pista:"combate_e" },

  { id:"abismo", nombre:"ABISMO ALIENÍGENA", icono:"◉", fondoA:"#01090c", fondoB:"#04202a",
    bg:"burbujas", bgColor:"#57e3c9",
    nave:"#b9f0ff", naveAla:"#2ec7a8", cabina:"#eafffb", motor:"#7ef2d5",
    bala:"#d6fff2", enemigoA:"#e07a35", enemigoB:"#c9a53a", enemigoC:"#9b5cd6",
    soloCampana:true, hazards:["mina_bio"], primitivas:["oscuridad"], pista:"combate_d" },

  { id:"fragua", nombre:"FRAGUA VOLCÁNICA", icono:"⚒", fondoA:"#0d0603", fondoB:"#2a1206",
    bg:"brasas", bgColor:"#ffa04a",
    nave:"#a8e6ff", naveAla:"#3f8fd0", cabina:"#ffffff", motor:"#7fd4ff",
    bala:"#cdeaff", enemigoA:"#8a5ce0", enemigoB:"#2bd97f", enemigoC:"#d64f2a",
    soloCampana:true, hazards:["asteroide"], primitivas:["columna"], pista:"combate_c" },

  { id:"grieta", nombre:"REINO DE LA GRIETA", icono:"◇", fondoA:"#050308", fondoB:"#150a24",
    bg:"estrellas", bgColor:"#c9a8ff",
    nave:"#f2eaff", naveAla:"#8a5cff", cabina:"#ffffff", motor:"#c08aff",
    bala:"#efe4ff", enemigoA:"#e07a35", enemigoB:"#d9a520", enemigoC:"#3fd6a8",
    soloCampana:true, hazards:["fragmento","asteroide"], primitivas:["ruptura","oscuridad"],
    pista:"combate_d" },
];


// ── Cuántas misiones son la CAMPAÑA BASE ────────────────────
//  DIEZ. Y es una constante, no `MISIONES.length`.
//
//  La diferencia importa el día que la campaña crezca. `MISIONES.length`
//  significa "todo lo que hay"; esto significa "hasta dónde llegaba la
//  campaña que alguien pudo terminar en su día". Son dos preguntas
//  distintas y usar la primera para responder la segunda es lo que hace
//  que una expansión le regale a un jugador antiguo contenido que no ha
//  jugado, o le cierre la puerta del contenido nuevo.
//
//  Termina en OMEGA SOVEREIGN, y eso no cambia aunque se añadan veinte
//  misiones más: la campaña base sigue siendo la campaña base.
const MISIONES_BASE = 10;

// ── Los mundos de SUPERVIVENCIA ─────────────────────────────
//  Lista EXPLÍCITA, no `TEMAS` entero.
//
//  Supervivencia y campaña compartían la tabla de mundos, así que
//  añadir un mundo a la campaña añadía un mundo a supervivencia sin que
//  nadie lo decidiera. Son dos modos con dos ritmos y dos progresiones:
//  que uno crezca no es motivo para que crezca el otro.
//
//  Ampliar supervivencia es añadir un id AQUÍ, a mano y a propósito.
//
//  Los cinco mundos de la expansión NO están en esta lista, y no lo
//  están por descuido: entran cuando sus oleadas estén calibradas para
//  jugarse sin fin, que es otro problema que el de jugarse una misión.
//  La maquetación de nueve tarjetas ya está hecha y medida (bloque 5C),
//  así que añadirlos el día que toque es escribir el id y nada más.
const SURVIVAL_MUNDOS = ["espacio", "oceano", "volcan", "neon"];
const TEMAS_SUPERVIVENCIA = () =>
  SURVIVAL_MUNDOS.map(id => TEMAS.find(t => t.id === id)).filter(Boolean);

// ════════════════════════════════════════════════════════════
//  MISIONES — guión de la campaña (5 misiones)
//  Cada evento: { t, fn, ...params }
//  fn: "ola" | "reward" | "miniboss"
// ════════════════════════════════════════════════════════════
const MISIONES = [
  {
    nombre: "PRIMER CONTACTO", temaId: "espacio", armas: ["laser", "plasma"],
    desc: "Las primeras oleadas enemigas. Aprende a moverte.",
    eventos: [
      // FASE 1 — Introducción (0-60s): patrón aprendizaje, ritmo lento
      { t:  5, fn:"ola", tipo:"normal",     n:4, patron:"linea"  },
      { t: 13, fn:"ola", tipo:"normal",     n:5, patron:"V"      },
      { t: 22, fn:"reward" },
      { t: 27, fn:"ola", tipo:"veloz",      n:4, patron:"pinza"  },
      { t: 35, fn:"ola", tipo:"normal",     n:6, patron:"ola"    },
      { t: 44, fn:"ola", tipo:"torreta",    n:3, patron:"linea"  },
      { t: 52, fn:"reward" },
      // FASE 2 — Escalada (60-130s): enemigos nuevos, presión
      { t: 60, fn:"ola", tipo:"veloz",      n:5, patron:"zigzag" },
      { t: 68, fn:"ola", tipo:"normal",     n:6, patron:"V"      },
      { t: 76, fn:"ola", tipo:"kamikaze",   n:4, patron:"ola"    },
      { t: 85, fn:"reward" },
      { t: 91, fn:"ola", tipo:"torreta",    n:4, patron:"pinza"  },
      { t: 99, fn:"ola", tipo:"kamikaze",   n:5, patron:"zigzag" },
      { t:108, fn:"ola", tipo:"veloz",      n:6, patron:"linea"  },
      { t:117, fn:"reward" },
      // FASE 3 — Climax pre-boss (130-195s): alta densidad
      { t:125, fn:"ola", tipo:"normal",     n:7, patron:"V"      },
      { t:133, fn:"ola", tipo:"torreta",    n:5, patron:"ola"    },
      { t:141, fn:"ola", tipo:"kamikaze",   n:6, patron:"pinza"  },
      { t:150, fn:"reward" },
      { t:157, fn:"ola", tipo:"veloz",      n:6, patron:"zigzag" },
      { t:165, fn:"ola", tipo:"normal",     n:7, patron:"linea"  },
      { t:173, fn:"ola", tipo:"kamikaze",   n:5, patron:"V"      },
      { t:181, fn:"reward" },
      { t:188, fn:"ola", tipo:"torreta",    n:4, patron:"ola"    },
      { t:196, fn:"ola", tipo:"kamikaze",   n:7, patron:"pinza"  },
      // FASE 4 — Boss (210s+): El Guardián aparece
      { t:210, fn:"miniboss", tipo:"guardian" },
    ],
  },
  {
    // M2: identidad = MOVIMIENTO. La lluvia de asteroides va y viene por
    // tramos: cuatro minutos seguidos de hazard dejan de ser tensión y
    // pasan a ser ruido de fondo. Cada pausa es un respiro medido.
    nombre: "CINTURÓN DE ASTEROIDES", temaId: "volcan", armas: ["misil", "fuego"],
    desc: "Asteroides en lluvia. Muévete o muere.",
    eventos: [
      // FASE 1 — El cinturón (0-60s): aprender a leer la lluvia
      { t:  0, fn:"hazardOn"  },
      { t:  4, fn:"ola", tipo:"veloz",         n:5, patron:"zigzag" },
      { t: 11, fn:"ola", tipo:"kamikaze",      n:4, patron:"pinza"  },
      { t: 18, fn:"reward" },
      { t: 22, fn:"ola", tipo:"veloz",         n:6, patron:"V"      },
      { t: 30, fn:"ola", tipo:"normal",        n:5, patron:"linea"  },
      { t: 38, fn:"ola", tipo:"kamikaze",      n:6, patron:"ola"    },
      { t: 46, fn:"reward" },
      { t: 50, fn:"hazardOff" },
      { t: 52, fn:"ola", tipo:"tanque",        n:2, patron:"linea"  },
      // FASE 2 — Escoltas (60-125s): el hazard vuelve con compañía pesada
      { t: 62, fn:"hazardOn" },
      { t: 64, fn:"ola", tipo:"veloz",         n:8, patron:"zigzag" },
      { t: 72, fn:"ola", tipo:"bombardero",    n:3, patron:"V"      },
      { t: 80, fn:"reward" },
      { t: 84, fn:"ola", tipo:"kamikaze",      n:8, patron:"pinza"  },
      { t: 92, fn:"ola", tipo:"veloz",         n:9, patron:"ola"    },
      { t:100, fn:"ola", tipo:"torreta",       n:4, patron:"linea"  },
      { t:108, fn:"reward" },
      { t:112, fn:"ola", tipo:"tanque",        n:3, patron:"V"      },
      { t:120, fn:"hazardOff" },
      // FASE 3 — Presión (125-190s): la lluvia no para y llegan escudos
      { t:126, fn:"hazardOn" },
      { t:128, fn:"ola", tipo:"kamikaze",      n:9, patron:"zigzag" },
      { t:136, fn:"ola", tipo:"portaescudos",  n:2, patron:"linea"  },
      { t:145, fn:"reward" },
      { t:149, fn:"ola", tipo:"veloz",         n:10,patron:"pinza"  },
      { t:157, fn:"ola", tipo:"bombardero",    n:4, patron:"ola"    },
      { t:166, fn:"ola", tipo:"kamikaze",      n:10,patron:"V"      },
      { t:174, fn:"reward" },
      { t:178, fn:"ola", tipo:"tanque",        n:3, patron:"pinza"  },
      { t:186, fn:"ola", tipo:"veloz",         n:11,patron:"zigzag" },
      // FASE 4 — Clímax (190-240s): todo a la vez
      { t:196, fn:"ola", tipo:"bombardero",    n:5, patron:"linea"  },
      { t:204, fn:"ola", tipo:"kamikaze",      n:11,patron:"ola"    },
      { t:212, fn:"reward" },
      { t:216, fn:"ola", tipo:"portaescudos",  n:3, patron:"pinza"  },
      { t:224, fn:"ola", tipo:"veloz",         n:12,patron:"V"      },
      { t:232, fn:"hazardOff" },                    // silencio antes del jefe
      { t:236, fn:"reward" },
      { t:242, fn:"miniboss", tipo:"rift_reaper" },
    ],
  },
  {
    // M3: identidad = PRIORIZAR. Las defensas no se mueven y suman fuego:
    // dejarlas vivas se paga con intereses. La escolta existe para que
    // ignorarlas tampoco sea gratis.
    nombre: "RED DE DEFENSA", temaId: "neon", armas: ["railgun", "laser"],
    desc: "Destruye las defensas para reducir el fuego.",
    eventos: [
      // FASE 1 — Primera línea (0-60s)
      { t:  2, fn:"defensa", tipo:"torreta", n:3 },
      { t:  5, fn:"ola", tipo:"normal",        n:4, patron:"V"      },
      { t: 12, fn:"ola", tipo:"francotirador", n:2, patron:"linea"  },
      { t: 20, fn:"reward" },
      { t: 24, fn:"defensa", tipo:"canon", n:2 },
      { t: 26, fn:"ola", tipo:"veloz",         n:5, patron:"pinza"  },
      { t: 34, fn:"ola", tipo:"torreta",       n:4, patron:"ola"    },
      { t: 44, fn:"reward" },
      { t: 48, fn:"defensa", tipo:"torreta", n:4 },
      { t: 50, fn:"ola", tipo:"bombardero",    n:3, patron:"linea"  },
      // FASE 2 — Baterías cruzadas (60-130s)
      { t: 60, fn:"ola", tipo:"francotirador", n:3, patron:"pinza"  },
      { t: 70, fn:"defensa", tipo:"canon", n:3 },
      { t: 72, fn:"reward" },
      { t: 76, fn:"ola", tipo:"tanque",        n:2, patron:"V"      },
      { t: 85, fn:"ola", tipo:"kamikaze",      n:6, patron:"zigzag" },
      { t: 94, fn:"defensa", tipo:"torreta", n:5 },
      { t: 96, fn:"ola", tipo:"portaescudos",  n:2, patron:"linea"  },
      { t:106, fn:"reward" },
      { t:110, fn:"ola", tipo:"bombardero",    n:4, patron:"ola"    },
      { t:120, fn:"ola", tipo:"francotirador", n:4, patron:"linea"  },
      // FASE 3 — La red completa (130-195s)
      { t:132, fn:"defensa", tipo:"canon", n:4 },
      { t:134, fn:"ola", tipo:"veloz",         n:8, patron:"pinza"  },
      { t:143, fn:"reward" },
      { t:147, fn:"ola", tipo:"torreta",       n:6, patron:"ola"    },
      { t:156, fn:"defensa", tipo:"torreta", n:5 },
      { t:158, fn:"ola", tipo:"tanque",        n:3, patron:"linea"  },
      { t:168, fn:"ola", tipo:"francotirador", n:5, patron:"pinza"  },
      { t:178, fn:"reward" },
      { t:182, fn:"ola", tipo:"portaescudos",  n:3, patron:"V"      },
      { t:192, fn:"ola", tipo:"bombardero",    n:5, patron:"linea"  },
      // FASE 4 — Núcleo defendido (195-240s): élite de escolta
      { t:200, fn:"defensa", tipo:"canon", n:4 },
      { t:202, fn:"ola", tipo:"elite",         n:1, patron:"linea"  },
      { t:212, fn:"ola", tipo:"kamikaze",      n:9, patron:"zigzag" },
      { t:222, fn:"reward" },
      { t:226, fn:"ola", tipo:"francotirador", n:5, patron:"linea"  },
      { t:236, fn:"reward" },
      { t:242, fn:"miniboss", tipo:"aegis_prime" },
    ],
  },
  {
    // M4: identidad = CONTROL DEL ESPACIO. Las zonas te quitan sitio, y
    // los acorazados te obligan a quedarte quieto para matarlos. La
    // tensión es la contradicción entre las dos cosas.
    nombre: "SECTOR TÓXICO", temaId: "oceano", armas: ["void", "plasma"],
    desc: "Zonas contaminadas: espera el telegráfico.",
    eventos: [
      // FASE 1 — Contaminación (0-60s)
      { t:  0, fn:"zonaOn"  },
      { t:  4, fn:"ola", tipo:"bombardero",    n:3, patron:"V"      },
      { t: 12, fn:"ola", tipo:"normal",        n:7, patron:"ola"    },
      { t: 20, fn:"reward" },
      { t: 24, fn:"ola", tipo:"portaescudos",  n:2, patron:"linea"  },
      { t: 34, fn:"ola", tipo:"veloz",         n:7, patron:"zigzag" },
      { t: 44, fn:"reward" },
      { t: 48, fn:"ola", tipo:"tanque",        n:2, patron:"V"      },
      { t: 56, fn:"zonaOff" },
      // FASE 2 — Aire limpio y emboscada (60-125s)
      { t: 62, fn:"ola", tipo:"kamikaze",      n:8, patron:"pinza"  },
      { t: 70, fn:"ola", tipo:"francotirador", n:4, patron:"linea"  },
      { t: 80, fn:"reward" },
      { t: 84, fn:"zonaOn" },
      { t: 86, fn:"ola", tipo:"bombardero",    n:4, patron:"ola"    },
      { t: 96, fn:"ola", tipo:"portaescudos",  n:3, patron:"linea"  },
      { t:106, fn:"reward" },
      { t:110, fn:"ola", tipo:"tanque",        n:3, patron:"V"      },
      { t:120, fn:"ola", tipo:"veloz",         n:9, patron:"zigzag" },
      // FASE 3 — Sector saturado (130-195s)
      { t:130, fn:"ola", tipo:"kamikaze",      n:9, patron:"ola"    },
      { t:140, fn:"reward" },
      { t:144, fn:"ola", tipo:"francotirador", n:5, patron:"pinza"  },
      { t:154, fn:"ola", tipo:"portaescudos",  n:4, patron:"linea"  },
      { t:164, fn:"ola", tipo:"bombardero",    n:5, patron:"V"      },
      { t:174, fn:"reward" },
      { t:178, fn:"ola", tipo:"elite",         n:1, patron:"linea"  },
      { t:188, fn:"ola", tipo:"tanque",        n:4, patron:"pinza"  },
      // FASE 4 — Purga (195-245s)
      { t:198, fn:"ola", tipo:"kamikaze",      n:11,patron:"zigzag" },
      { t:208, fn:"reward" },
      { t:212, fn:"ola", tipo:"portaescudos",  n:4, patron:"ola"    },
      { t:222, fn:"ola", tipo:"bombardero",    n:6, patron:"linea"  },
      { t:232, fn:"zonaOff" },
      { t:236, fn:"reward" },
      { t:242, fn:"miniboss", tipo:"venom_core" },
    ],
  },
  {
    // M5: identidad = DOMINIO. Todo lo aprendido, a la vez, con élites de
    // por medio y el Titán al final. Es la misión que comprueba si las
    // cuatro anteriores han enseñado algo.
    nombre: "FISURA HELADA", temaId: "espacio", armas: ["cryo", "electrico"],
    desc: "Élites y cristales de hielo. El Titán cierra todo.",
    eventos: [
      // FASE 1 — La fisura (0-65s)
      { t:  0, fn:"hazardOn", subtipo:"cristal" },
      { t:  4, fn:"ola", tipo:"bombardero",    n:4, patron:"V"      },
      { t: 12, fn:"ola", tipo:"francotirador", n:3, patron:"linea"  },
      { t: 22, fn:"reward" },
      { t: 26, fn:"ola", tipo:"veloz",         n:7, patron:"zigzag" },
      { t: 36, fn:"ola", tipo:"portaescudos",  n:3, patron:"pinza"  },
      { t: 48, fn:"reward" },
      { t: 52, fn:"ola", tipo:"tanque",        n:3, patron:"linea"  },
      { t: 62, fn:"hazardOff" },
      // FASE 2 — Primera élite (65-135s)
      { t: 68, fn:"ola", tipo:"elite",         n:1, patron:"linea"  },
      { t: 74, fn:"ola", tipo:"kamikaze",      n:8, patron:"ola"    },
      { t: 86, fn:"reward" },
      { t: 90, fn:"hazardOn", subtipo:"cristal" },
      { t: 92, fn:"ola", tipo:"bombardero",    n:5, patron:"V"      },
      { t:102, fn:"ola", tipo:"francotirador", n:5, patron:"zigzag" },
      { t:114, fn:"reward" },
      { t:118, fn:"ola", tipo:"portaescudos",  n:4, patron:"linea"  },
      { t:128, fn:"ola", tipo:"veloz",         n:10,patron:"pinza"  },
      // FASE 3 — Dos élites (135-200s)
      { t:138, fn:"hazardOff" },
      { t:140, fn:"ola", tipo:"elite",         n:2, patron:"pinza"  },
      { t:150, fn:"ola", tipo:"kamikaze",      n:10,patron:"zigzag" },
      { t:160, fn:"reward" },
      { t:164, fn:"ola", tipo:"tanque",        n:4, patron:"V"      },
      { t:174, fn:"hazardOn", subtipo:"cristal" },
      { t:176, fn:"ola", tipo:"bombardero",    n:6, patron:"ola"    },
      { t:188, fn:"reward" },
      { t:192, fn:"ola", tipo:"francotirador", n:6, patron:"linea"  },
      // FASE 4 — Antes del Titán (200-255s)
      { t:202, fn:"ola", tipo:"portaescudos",  n:5, patron:"pinza"  },
      { t:212, fn:"ola", tipo:"elite",         n:2, patron:"linea"  },
      { t:222, fn:"reward" },
      { t:226, fn:"ola", tipo:"kamikaze",      n:12,patron:"ola"    },
      { t:236, fn:"ola", tipo:"veloz",         n:12,patron:"zigzag" },
      { t:244, fn:"hazardOff" },                    // los cristales paran
      { t:248, fn:"reward" },
      { t:250, fn:"reward" },
      { t:256, fn:"miniboss", tipo:"titan" },
    ],
  },
  {
    // M6: identidad = GUERRA A GRAN ESCALA. Cuatro fases con estructura
    // militar de verdad: entrada, escuadrones, cruceros+torretas, batalla
    // de flota completa. COMMAND SHIPS (comando) aceleran la cadencia de
    // toda la flota mientras viven — matar uno se nota al instante.
    nombre: "WAR FLEET", temaId: "neon", armas: ["misil", "electrico"],
    desc: "Flota militar a gran escala. Prioriza a los comando.",
    eventos: [
      // FASE 1 — Entrada a la flota (0-60s)
      { t:  3, fn:"ola", tipo:"normal",      n:5, patron:"linea" },
      { t: 10, fn:"ola", tipo:"veloz",       n:6, patron:"V"     },
      { t: 18, fn:"reward" },
      { t: 22, fn:"ola", tipo:"dron_ataque", n:4, patron:"pinza" },
      { t: 30, fn:"ola", tipo:"normal",      n:6, patron:"ola"   },
      { t: 38, fn:"defensa", tipo:"torreta", n:3 },
      { t: 46, fn:"reward" },
      { t: 50, fn:"ola", tipo:"crucero",     n:1, patron:"linea" },
      { t: 58, fn:"ola", tipo:"dron_escudo", n:3, patron:"V"     },
      // FASE 2 — Escuadrones coordinados (60-150s)
      { t: 64, fn:"ola", tipo:"comando",     n:1, patron:"linea" },
      { t: 70, fn:"ola", tipo:"dron_ataque", n:5, patron:"zigzag"},
      { t: 78, fn:"reward" },
      { t: 84, fn:"ola", tipo:"veloz",       n:8, patron:"pinza" },
      { t: 92, fn:"ola", tipo:"dron_misil",  n:3, patron:"linea" },
      { t:100, fn:"defensa", tipo:"canon", n:2 },
      { t:108, fn:"reward" },
      { t:114, fn:"ola", tipo:"comando",     n:1, patron:"V"     },
      { t:120, fn:"ola", tipo:"crucero",     n:1, patron:"pinza" },
      { t:128, fn:"ola", tipo:"dron_ataque", n:6, patron:"ola"   },
      { t:136, fn:"reward" },
      { t:144, fn:"ola", tipo:"kamikaze",    n:8, patron:"zigzag"},
      // FASE 3 — Cruceros + torretas (150-230s)
      { t:154, fn:"defensa", tipo:"torreta", n:4 },
      { t:158, fn:"ola", tipo:"crucero",     n:2, patron:"linea" },
      { t:168, fn:"reward" },
      { t:174, fn:"ola", tipo:"comando",     n:1, patron:"pinza" },
      { t:180, fn:"ola", tipo:"dron_escudo", n:4, patron:"V"     },
      { t:188, fn:"ola", tipo:"tanque",      n:3, patron:"linea" },
      { t:196, fn:"reward" },
      { t:202, fn:"defensa", tipo:"canon", n:3 },
      { t:206, fn:"ola", tipo:"crucero",     n:2, patron:"V"     },
      { t:214, fn:"ola", tipo:"dron_misil",  n:4, patron:"zigzag"},
      { t:222, fn:"reward" },
      // FASE 4 — Batalla de flota (230-300s): todo junto
      { t:232, fn:"ola", tipo:"comando",     n:2, patron:"pinza" },
      { t:238, fn:"ola", tipo:"crucero",     n:1, patron:"linea" },
      { t:244, fn:"ola", tipo:"dron_ataque", n:6, patron:"ola"   },
      { t:250, fn:"reward" },
      { t:256, fn:"defensa", tipo:"torreta", n:4 },
      { t:262, fn:"ola", tipo:"kamikaze",    n:10,patron:"zigzag"},
      { t:270, fn:"ola", tipo:"crucero",     n:2, patron:"pinza" },
      { t:278, fn:"reward" },
      { t:284, fn:"ola", tipo:"dron_misil",  n:5, patron:"V"     },
      { t:292, fn:"ola", tipo:"comando",     n:2, patron:"linea" },
      { t:300, fn:"reward" },
      { t:306, fn:"miniboss", tipo:"warlord_vesper" },
    ],
  },
  {
    // M7: identidad = ESPACIO DISTORSIONADO. GRAVITY WELL: TELEGRAPH →
    // FORMATION → ACTIVE → COLLAPSE → CLEAR. La fuerza se suma al
    // objetivo del dedo — nunca sustituye el control del jugador.
    nombre: "GRAVITY COLLAPSE", temaId: "espacio", armas: ["laser", "plasma"],
    desc: "Pozos gravitatorios. La fuerza es suave — nunca pierdes el control.",
    eventos: [
      // FASE 1 — Primeros pozos (0-65s)
      { t:  4, fn:"ola", tipo:"normal",        n:5, patron:"V"      },
      { t: 12, fn:"pozo", y:0.42, r:130, fuerza:95, vida:2.6 },
      { t: 20, fn:"ola", tipo:"veloz",         n:6, patron:"zigzag" },
      { t: 28, fn:"reward" },
      { t: 33, fn:"pozo", y:0.5, r:140, fuerza:105, vida:2.8 },
      { t: 40, fn:"ola", tipo:"francotirador", n:3, patron:"linea"  },
      { t: 50, fn:"ola", tipo:"kamikaze",      n:6, patron:"pinza"  },
      { t: 58, fn:"reward" },
      // FASE 2 — Presión creciente (65-135s)
      { t: 66, fn:"pozo", y:0.44, r:150, fuerza:115, vida:3.0 },
      { t: 72, fn:"ola", tipo:"dron_ataque",   n:5, patron:"ola"    },
      { t: 80, fn:"ola", tipo:"tanque",        n:2, patron:"linea"  },
      { t: 90, fn:"reward" },
      { t: 95, fn:"pozo", y:0.5, r:150, fuerza:120, vida:3.0 },
      { t:102, fn:"ola", tipo:"veloz",         n:9, patron:"pinza"  },
      { t:110, fn:"ola", tipo:"portaescudos",  n:2, patron:"V"      },
      { t:120, fn:"reward" },
      { t:126, fn:"ola", tipo:"kamikaze",      n:9, patron:"zigzag" },
      // FASE 3 — Distorsión intensa (135-200s)
      { t:136, fn:"pozo", y:0.4, r:160, fuerza:130, vida:3.2 },
      { t:144, fn:"ola", tipo:"elite",         n:1, patron:"linea"  },
      { t:154, fn:"reward" },
      { t:160, fn:"pozo", y:0.52, r:160, fuerza:130, vida:3.2 },
      { t:166, fn:"ola", tipo:"francotirador", n:5, patron:"pinza"  },
      { t:176, fn:"ola", tipo:"tanque",        n:3, patron:"V"      },
      { t:186, fn:"reward" },
      { t:192, fn:"ola", tipo:"kamikaze",      n:10,patron:"ola"    },
      // FASE 4 — Antes del Centinela (200-255s)
      { t:202, fn:"pozo", y:0.46, r:170, fuerza:140, vida:3.0 },
      { t:210, fn:"ola", tipo:"elite",         n:2, patron:"pinza"  },
      { t:222, fn:"reward" },
      { t:228, fn:"ola", tipo:"veloz",         n:11,patron:"zigzag" },
      { t:238, fn:"ola", tipo:"portaescudos",  n:3, patron:"linea"  },
      { t:248, fn:"reward" },
      { t:254, fn:"miniboss", tipo:"singularity_warden" },
    ],
  },
  {
    // M8: identidad = VELOCIDAD + CALOR + AGRESIVIDAD. HEAT LANES:
    // TELEGRAPH → IGNITION → ACTIVE → COOLING. Más rápida que M7, nunca
    // menos justa: el aviso sigue siendo el mismo lenguaje de siempre.
    nombre: "INFERNO", temaId: "volcan", armas: ["fuego", "rapid"],
    desc: "Carriles de fuego. Rápida y agresiva — pero siempre avisa.",
    eventos: [
      // FASE 1 — Ignición (0-60s)
      { t:  3, fn:"ola", tipo:"bombardero",  n:3, patron:"V"      },
      { t: 10, fn:"carril", y:0.55, h:70, vida:1.8 },
      { t: 16, fn:"ola", tipo:"normal",      n:6, patron:"ola"    },
      { t: 24, fn:"reward" },
      { t: 30, fn:"carril", y:0.35, h:70, vida:1.8 },
      { t: 36, fn:"ola", tipo:"veloz",       n:7, patron:"zigzag" },
      { t: 46, fn:"ola", tipo:"kamikaze",    n:6, patron:"pinza"  },
      { t: 54, fn:"reward" },
      // FASE 2 — Oleadas rápidas (60-130s)
      { t: 62, fn:"carril", y:0.48, h:76, vida:2.0 },
      { t: 68, fn:"ola", tipo:"veloz",       n:9, patron:"V"      },
      { t: 76, fn:"ola", tipo:"kamikaze",    n:9, patron:"zigzag" },
      { t: 86, fn:"reward" },
      { t: 92, fn:"carril", y:0.3, h:76, vida:2.0 },
      { t: 98, fn:"ola", tipo:"bombardero",  n:4, patron:"linea"  },
      { t:106, fn:"ola", tipo:"veloz",       n:10,patron:"pinza"  },
      { t:116, fn:"reward" },
      { t:122, fn:"ola", tipo:"kamikaze",    n:10,patron:"ola"    },
      // FASE 3 — Presión de calor (130-195s)
      { t:132, fn:"carril", y:0.42, h:80, vida:2.1 },
      { t:138, fn:"ola", tipo:"tanque",      n:3, patron:"linea"  },
      { t:148, fn:"reward" },
      { t:154, fn:"carril", y:0.58, h:80, vida:2.1 },
      { t:160, fn:"ola", tipo:"portaescudos",n:3, patron:"pinza"  },
      { t:170, fn:"ola", tipo:"veloz",       n:12,patron:"zigzag" },
      { t:180, fn:"reward" },
      { t:186, fn:"ola", tipo:"kamikaze",    n:11,patron:"V"      },
      // FASE 4 — Antes del Señor de la Pira (195-250s)
      { t:196, fn:"carril", y:0.36, h:84, vida:1.9 },
      { t:202, fn:"ola", tipo:"elite",       n:2, patron:"linea"  },
      { t:214, fn:"reward" },
      { t:220, fn:"carril", y:0.52, h:84, vida:1.9 },
      { t:226, fn:"ola", tipo:"bombardero",  n:5, patron:"ola"    },
      { t:236, fn:"ola", tipo:"kamikaze",    n:12,patron:"pinza"  },
      { t:246, fn:"reward" },
      { t:252, fn:"miniboss", tipo:"pyre_lord" },
    ],
  },
  {
    // M9: identidad = ASALTO AL CORAZÓN ENEMIGO. CORE ACCESS: ALPHA
    // controla las torretas de escenario, BETA protege a toda la flota
    // (45% menos daño mientras vive), GAMMA manda refuerzos cada 4s.
    // Ignorarlos aprieta la misión; destruirlos la desarma de verdad.
    nombre: "ENEMY CORE", temaId: "neon", armas: ["railgun", "void"],
    desc: "Sistemas ALPHA/BETA/GAMMA. Destrúyelos: cambian el nivel de verdad.",
    eventos: [
      // FASE 1 — Los tres sistemas se activan (0-60s)
      { t:  2, fn:"sistemas" },
      { t:  6, fn:"ola", tipo:"normal",        n:5, patron:"V"      },
      { t: 14, fn:"defensa", tipo:"torreta", n:3 },
      { t: 22, fn:"reward" },
      { t: 28, fn:"ola", tipo:"francotirador", n:3, patron:"linea"  },
      { t: 36, fn:"ola", tipo:"portaescudos",  n:2, patron:"pinza"  },
      { t: 46, fn:"reward" },
      { t: 52, fn:"ola", tipo:"veloz",         n:7, patron:"zigzag" },
      // FASE 2 — Presión con los sistemas activos (60-140s)
      { t: 62, fn:"defensa", tipo:"canon", n:2 },
      { t: 68, fn:"ola", tipo:"tanque",        n:3, patron:"linea"  },
      { t: 78, fn:"reward" },
      { t: 84, fn:"ola", tipo:"portaescudos",  n:3, patron:"V"      },
      { t: 92, fn:"ola", tipo:"francotirador", n:4, patron:"pinza"  },
      { t:102, fn:"reward" },
      { t:108, fn:"defensa", tipo:"torreta", n:4 },
      { t:114, fn:"ola", tipo:"kamikaze",      n:8, patron:"zigzag" },
      { t:124, fn:"ola", tipo:"elite",         n:1, patron:"linea"  },
      { t:134, fn:"reward" },
      // FASE 3 — Empuje final contra los sistemas (140-210s)
      { t:144, fn:"ola", tipo:"tanque",        n:4, patron:"V"      },
      { t:154, fn:"ola", tipo:"portaescudos",  n:4, patron:"pinza"  },
      { t:164, fn:"reward" },
      { t:170, fn:"ola", tipo:"francotirador", n:5, patron:"linea"  },
      { t:180, fn:"ola", tipo:"elite",         n:2, patron:"pinza"  },
      { t:192, fn:"reward" },
      { t:198, fn:"ola", tipo:"kamikaze",      n:10,patron:"ola"    },
      // FASE 4 — Núcleo al descubierto (210-260s)
      { t:210, fn:"ola", tipo:"veloz",         n:10,patron:"zigzag" },
      { t:222, fn:"reward" },
      { t:228, fn:"ola", tipo:"tanque",        n:4, patron:"linea"  },
      { t:238, fn:"ola", tipo:"portaescudos",  n:4, patron:"V"      },
      { t:250, fn:"reward" },
      { t:256, fn:"miniboss", tipo:"core_architect" },
    ],
  },
  {
    // M10: FINAL DE CAMPAÑA. Tres actos.
    //   Acto 1 — FINAL APPROACH: todo lo aprendido, secuenciado, nunca
    //            simultáneo: cada mecánica de M1-M9 tiene su momento.
    //   Acto 2 — GAUNTLET: cinco secciones cortas sin pausa.
    //   Acto 3 — PRE-BOSS: un elite emblemático como guardián final,
    //            silencio, y el aviso definitivo.
    // Jefe final: OMEGA SOVEREIGN, 4 fases, muerte épica.
    nombre: "FINAL STRIKE", temaId: "espacio", armas: ["ultimate", "railgun", "void", "laser"],
    desc: "El final de la campaña. Todo lo aprendido, a la vez.",
    eventos: [
      // ── ACTO 1: FINAL APPROACH (0-150s) ──
      { t:  3, fn:"ola", tipo:"normal",        n:6, patron:"V"      },   // M1
      { t: 10, fn:"ola", tipo:"veloz",         n:7, patron:"zigzag" },
      { t: 18, fn:"reward" },
      { t: 22, fn:"hazardOn" },                                          // M2
      { t: 26, fn:"ola", tipo:"kamikaze",      n:7, patron:"pinza"  },
      { t: 34, fn:"hazardOff" },
      { t: 40, fn:"defensa", tipo:"torreta", n:4 },                      // M3
      { t: 44, fn:"ola", tipo:"francotirador", n:4, patron:"linea"  },
      { t: 52, fn:"reward" },
      { t: 58, fn:"zonaOn" },                                            // M4
      { t: 62, fn:"ola", tipo:"portaescudos",  n:3, patron:"V"      },
      { t: 70, fn:"zonaOff" },
      { t: 76, fn:"ola", tipo:"tanque",        n:4, patron:"linea"  },   // M5
      { t: 84, fn:"reward" },
      { t: 90, fn:"ola", tipo:"comando",       n:1, patron:"linea"  },   // M6
      { t: 94, fn:"ola", tipo:"crucero",       n:2, patron:"pinza"  },
      { t:102, fn:"ola", tipo:"dron_ataque",   n:6, patron:"ola"    },
      { t:110, fn:"reward" },
      { t:116, fn:"pozo", y:0.46, r:160, fuerza:120, vida:2.8 },          // M7
      { t:122, fn:"ola", tipo:"elite",         n:1, patron:"pinza"  },
      { t:132, fn:"carril", y:0.5, h:80, vida:2.0 },                     // M8
      { t:138, fn:"ola", tipo:"kamikaze",      n:10,patron:"zigzag" },
      { t:146, fn:"reward" },
      // ── ACTO 2: GAUNTLET (150-290s) — cinco tramos, sin respiro ──
      { t:150, fn:"ola", tipo:"crucero",       n:2, patron:"linea" },    // 1. Flota
      { t:156, fn:"ola", tipo:"dron_ataque",   n:6, patron:"pinza" },
      { t:164, fn:"ola", tipo:"comando",       n:1, patron:"V"     },
      { t:172, fn:"reward" },
      { t:176, fn:"pozo", y:0.44, r:150, fuerza:130, vida:2.4 },         // 2. Gravity
      { t:180, fn:"ola", tipo:"veloz",         n:10,patron:"zigzag" },
      { t:190, fn:"ola", tipo:"kamikaze",      n:9, patron:"ola"    },
      { t:198, fn:"reward" },
      { t:202, fn:"defensa", tipo:"canon", n:3 },                        // 3. Defense
      { t:206, fn:"ola", tipo:"francotirador", n:5, patron:"linea" },
      { t:216, fn:"ola", tipo:"portaescudos",  n:3, patron:"pinza" },
      { t:224, fn:"reward" },
      { t:228, fn:"carril", y:0.52, h:84, vida:1.9 },                    // 4. Inferno
      { t:232, fn:"ola", tipo:"kamikaze",      n:12,patron:"zigzag" },
      { t:242, fn:"ola", tipo:"tanque",        n:4, patron:"V"      },
      { t:250, fn:"reward" },
      { t:254, fn:"sistemas" },                                          // 5. Core
      { t:258, fn:"ola", tipo:"elite",         n:2, patron:"pinza"  },
      { t:268, fn:"ola", tipo:"veloz",         n:12,patron:"ola"    },
      { t:278, fn:"reward" },
      { t:286, fn:"ola", tipo:"tanque",        n:5, patron:"linea"  },
      // ── ACTO 3: PRE-BOSS (290-340s) ──
      { t:294, fn:"reward" },
      { t:300, fn:"ola", tipo:"elite",         n:1, patron:"linea"  },   // guardián final
      { t:312, fn:"reward" },
      // Silencio deliberado antes del aviso — nada entre 312 y 340.
      { t:340, fn:"miniboss", tipo:"omega_sovereign" },
    ],
  },

  // ════════════════════════════════════════════════════════════
  //  M11–M20 — LA EXPANSIÓN (bloque 5H)
  // ════════════════════════════════════════════════════════════
  //  Dos misiones por mundo, siempre en el mismo orden: la primera
  //  ENSEÑA el mundo (hazard/enemigos sueltos, con aire) y cierra con
  //  SU minijefe (bloque 5F) — nunca con un jefe principal. La segunda
  //  sube la mezcla y cierra con EL jefe de ese mundo (bloque 5G). Ese
  //  patrón —enseñar, luego examinar— es el mismo que ya usa M1→M2 y
  //  M4→M5 en la campaña base, solo que aquí es explícito: dos
  //  misiones, un mundo, una escalada.
  //
  //  Nada de esto es un sistema nuevo. Cada evento sale de
  //  `procesarEvento()` tal cual existe desde 5A: `ola`, `reward`,
  //  `hazardOn/Off`, `columna`, `oscuridad`, `ruptura`, `defensa`,
  //  `miniboss`. Los diez enemigos son los del bloque 5E, los hazards y
  //  primitivas los del 5D, los minijefes el 5F y los jefes el 5G.
  //
  //  Las misiones CON minijefe (M11/13/15/17/19) añaden algo que M1–M10
  //  no tenían: eventos DESPUÉS del `miniboss`, un tramo corto de
  //  "descarga" antes de cerrar. `cerrarMision()` solo dispara con
  //  `!miniboss`, así que esos eventos no dan por completada la misión
  //  mientras el minijefe siga vivo — el mismo mecanismo de siempre,
  //  usado con un margen de tiempo generoso para que el minijefe ya
  //  esté muerto quando les toque.
  {
    // M11: la primera lectura del hielo. `tempano` sale aislado antes de
    // mezclarse con nada, para que quede clarísimo —sin un solo enemigo
    // cerca la primera vez— que BLOQUEA TUS BALAS a ti también, no solo
    // a las suyas.
    nombre: "DERIVA BLANCA", temaId: "hielo", armas: ["cryo", "railgun"],
    desc: "El hielo empieza a hablar. Aprende a leerlo.",
    eventos: [
      // ACTO 1 — Primer contacto con el mundo (0-64s)
      { t:  4, fn:"ola", tipo:"sierra_hielo", n:3, patron:"linea" },
      { t: 12, fn:"ola", tipo:"normal",       n:4, patron:"V"     },
      { t: 20, fn:"reward" },
      { t: 25, fn:"hazardOn", subtipo:"tempano" },   // aislado: aprende que bloquea TUS balas
      { t: 29, fn:"ola", tipo:"sierra_hielo", n:3, patron:"zigzag" },
      { t: 36, fn:"hazardOff" },
      { t: 42, fn:"ola", tipo:"veloz",        n:5, patron:"pinza"  },
      { t: 50, fn:"reward" },
      { t: 56, fn:"ola", tipo:"sierra_hielo", n:4, patron:"ola"    },
      // ACTO 2 — PRISMA + cobertura de hielo (64-130s)
      { t: 64, fn:"reward" },
      { t: 70, fn:"ola", tipo:"prisma",       n:2, patron:"linea"  },
      { t: 76, fn:"hazardOn", subtipo:"tempano" },
      { t: 80, fn:"ola", tipo:"sierra_hielo", n:4, patron:"zigzag" },
      { t: 88, fn:"ola", tipo:"prisma",       n:2, patron:"V"      },
      { t: 96, fn:"reward" },
      { t:102, fn:"ola", tipo:"veloz",        n:6, patron:"pinza"  },
      { t:108, fn:"hazardOff" },
      { t:114, fn:"ola", tipo:"prisma",       n:3, patron:"ola"    },
      { t:120, fn:"ola", tipo:"sierra_hielo", n:5, patron:"linea"  },
      { t:128, fn:"reward" },
      // ACTO 3 — Patrones mezclados, más lateral (130-185s)
      { t:134, fn:"hazardOn", subtipo:"tempano" },
      { t:138, fn:"ola", tipo:"sierra_hielo", n:6, patron:"zigzag" },
      { t:146, fn:"ola", tipo:"prisma",       n:3, patron:"V"      },
      { t:152, fn:"ola", tipo:"veloz",        n:6, patron:"pinza"  },
      { t:158, fn:"hazardOff" },
      { t:162, fn:"reward" },
      { t:168, fn:"ola", tipo:"sierra_hielo", n:5, patron:"ola"    },
      { t:176, fn:"ola", tipo:"prisma",       n:2, patron:"linea"  },
      { t:182, fn:"reward" },
      // MINIJEFE — sin boss principal detrás
      { t:196, fn:"miniboss", tipo:"cazador_polar" },
      // Descarga breve, ya con el minijefe resuelto
      { t:256, fn:"ola", tipo:"sierra_hielo", n:3, patron:"linea"  },
      { t:264, fn:"reward" },
      { t:272, fn:"ola", tipo:"normal",       n:3, patron:"V"      },
    ],
  },
  {
    // M12: sube todo lo de M11 un peldaño y cierra con KRYOS. La última
    // tanda antes del aviso combina sierra_hielo + témpano + prisma a
    // la vez — la primera vez que los tres coinciden en la misión — así
    // que el jugador llega al jefe habiendo ya leído los tres juntos.
    nombre: "EL YUNQUE BLANCO", temaId: "hielo", armas: ["cryo", "railgun"],
    desc: "KRYOS forjó su trono con lo que el hielo no perdona.",
    eventos: [
      // ACTO 1 — Continúa donde dejó M11 (0-64s)
      { t:  4, fn:"ola", tipo:"sierra_hielo", n:5, patron:"zigzag" },
      { t: 12, fn:"ola", tipo:"prisma",       n:3, patron:"linea"  },
      { t: 20, fn:"reward" },
      { t: 25, fn:"hazardOn", subtipo:"tempano" },
      { t: 30, fn:"ola", tipo:"veloz",        n:6, patron:"pinza"  },
      { t: 38, fn:"ola", tipo:"sierra_hielo", n:5, patron:"ola"    },
      { t: 46, fn:"hazardOff" },
      { t: 52, fn:"reward" },
      { t: 58, fn:"ola", tipo:"prisma",       n:4, patron:"V"      },
      // ACTO 2 — Más prisma, sierra+témpano combinados (64-135s)
      { t: 64, fn:"ola", tipo:"tanque",       n:2, patron:"linea"  },
      { t: 70, fn:"reward" },
      { t: 76, fn:"hazardOn", subtipo:"tempano" },
      { t: 80, fn:"ola", tipo:"sierra_hielo", n:6, patron:"zigzag" },
      { t: 88, fn:"ola", tipo:"prisma",       n:4, patron:"pinza"  },
      { t: 96, fn:"reward" },
      { t:102, fn:"ola", tipo:"veloz",        n:7, patron:"V"      },
      { t:108, fn:"ola", tipo:"sierra_hielo", n:6, patron:"linea"  },
      { t:116, fn:"hazardOff" },
      { t:120, fn:"reward" },
      { t:126, fn:"ola", tipo:"prisma",       n:4, patron:"ola"    },
      { t:132, fn:"ola", tipo:"normal",       n:7, patron:"zigzag" },
      // ACTO 3 — Formaciones que obligan a escoger trayectoria (135-175s)
      { t:138, fn:"hazardOn", subtipo:"tempano" },
      { t:142, fn:"ola", tipo:"sierra_hielo", n:7, patron:"pinza"  },
      { t:150, fn:"reward" },
      { t:156, fn:"ola", tipo:"prisma",       n:5, patron:"V"      },
      { t:164, fn:"ola", tipo:"veloz",        n:8, patron:"pinza"  },
      { t:172, fn:"hazardOff" },
      { t:176, fn:"reward" },
      { t:182, fn:"ola", tipo:"sierra_hielo", n:5, patron:"ola"    },
      { t:190, fn:"reward" },
      // Silencio deliberado antes del aviso — nada entre 190 y 206.
      { t:206, fn:"miniboss", tipo:"kryos" },
    ],
  },
  {
    // M13: el tráfico es DECORADO PELIGROSO, no un enemigo — no puntúa,
    // no dispara, y por eso su color/lectura tienen que distinguirse
    // solos (bloque 5D: `HAZARD_TIPOS.trafico`, sin `hp` de enemigo ni
    // entrada en el marcador). Aquí solo se cuida el RITMO: ventanas
    // limpias entre oleadas de tráfico, nunca tráfico + enjambre a la vez
    // en el primer tercio.
    nombre: "TRÁFICO CRUZADO", temaId: "megaciudad", armas: ["electrico", "laser"],
    desc: "La ciudad no se detiene por ti. Aprende a leerla.",
    eventos: [
      // ACTO 1 — Tráfico horizontal + enemigos verticales (0-64s)
      { t:  4, fn:"hazardOn", subtipo:"trafico" },
      { t:  6, fn:"ola", tipo:"normal",   n:4, patron:"linea" },
      { t: 14, fn:"ola", tipo:"patrulla", n:2, patron:"linea" },
      { t: 22, fn:"reward" },
      { t: 28, fn:"ola", tipo:"veloz",    n:5, patron:"V"     },
      { t: 36, fn:"ola", tipo:"patrulla", n:2, patron:"linea" },
      { t: 44, fn:"hazardOff" },                     // ventana segura
      { t: 50, fn:"reward" },
      { t: 56, fn:"ola", tipo:"torre_neon", n:1, patron:"linea" },
      // ACTO 2 — Mezcla + ventanas seguras (64-130s)
      { t: 64, fn:"ola", tipo:"normal",   n:5, patron:"pinza"  },
      { t: 70, fn:"hazardOn", subtipo:"trafico" },
      { t: 76, fn:"reward" },
      { t: 82, fn:"ola", tipo:"patrulla", n:3, patron:"linea" },
      { t: 90, fn:"ola", tipo:"veloz",    n:6, patron:"zigzag" },
      { t: 98, fn:"hazardOff" },
      { t:104, fn:"reward" },
      { t:110, fn:"ola", tipo:"torre_neon", n:2, patron:"linea" },
      { t:118, fn:"ola", tipo:"kamikaze", n:5, patron:"pinza"  },
      { t:126, fn:"hazardOn", subtipo:"trafico" },
      // ACTO 3 — Todo junto, más rápido (130-185s)
      { t:130, fn:"ola", tipo:"patrulla", n:3, patron:"linea" },
      { t:138, fn:"reward" },
      { t:144, fn:"ola", tipo:"veloz",    n:7, patron:"V"      },
      { t:152, fn:"hazardOff" },
      { t:156, fn:"ola", tipo:"torre_neon", n:2, patron:"linea" },
      { t:164, fn:"hazardOn", subtipo:"trafico" },
      { t:168, fn:"ola", tipo:"patrulla", n:4, patron:"linea"  },
      { t:176, fn:"ola", tipo:"kamikaze", n:6, patron:"pinza"  },
      { t:182, fn:"hazardOff" },
      { t:186, fn:"reward" },
      // MINIJEFE — sin boss principal detrás
      { t:198, fn:"miniboss", tipo:"unidad_control" },
      // Descarga breve
      { t:262, fn:"ola", tipo:"patrulla", n:2, patron:"linea" },
      { t:270, fn:"reward" },
      { t:278, fn:"ola", tipo:"normal",   n:3, patron:"V"      },
    ],
  },
  {
    // M14: la torre ya controla el campo antes de que aparezca —cruces
    // (columna "luz") y tráfico desde el minuto uno— para que VÉRTICE,
    // al llegar, se sienta como la MISMA idea a escala de jefe, no como
    // una mecánica nueva de golpe.
    nombre: "TORRE CENTINELA", temaId: "megaciudad", armas: ["electrico", "laser"],
    desc: "Antes de VÉRTICE, aprende a leer carriles y espacio.",
    eventos: [
      // ACTO 1 — Cruces + tráfico desde el principio (0-64s)
      { t:  4, fn:"hazardOn", subtipo:"trafico" },
      { t:  6, fn:"ola", tipo:"patrulla",   n:3, patron:"linea" },
      { t: 14, fn:"ola", tipo:"torre_neon", n:2, patron:"linea" },
      { t: 22, fn:"reward" },
      { t: 28, fn:"ola", tipo:"veloz",      n:6, patron:"pinza"  },
      { t: 36, fn:"hazardOff" },
      { t: 42, fn:"columna", estilo:"luz", w:100, vida:2.0 },
      { t: 46, fn:"ola", tipo:"patrulla",   n:3, patron:"linea"  },
      { t: 54, fn:"reward" },
      { t: 60, fn:"ola", tipo:"torre_neon", n:2, patron:"linea"  },
      // ACTO 2 — Todo combinado (64-135s)
      { t: 64, fn:"reward" },
      { t: 70, fn:"hazardOn", subtipo:"trafico" },
      { t: 74, fn:"ola", tipo:"patrulla",   n:4, patron:"linea"  },
      { t: 80, fn:"columna", estilo:"luz", w:110, vida:2.0 },
      { t: 82, fn:"ola", tipo:"torre_neon", n:2, patron:"linea"  },
      { t: 90, fn:"reward" },
      { t: 96, fn:"ola", tipo:"veloz",      n:8, patron:"pinza"  },
      { t:104, fn:"hazardOff" },
      { t:110, fn:"columna", estilo:"luz", w:110, vida:2.2 },
      { t:112, fn:"ola", tipo:"patrulla",   n:4, patron:"linea"  },
      { t:120, fn:"reward" },
      { t:126, fn:"hazardOn", subtipo:"trafico" },
      { t:130, fn:"ola", tipo:"torre_neon", n:3, patron:"linea"  },
      // ACTO 3 — Preparación directa de VÉRTICE (135-180s)
      { t:138, fn:"ola", tipo:"kamikaze",   n:7, patron:"zigzag" },
      { t:146, fn:"hazardOff" },
      { t:150, fn:"reward" },
      { t:156, fn:"columna", estilo:"luz", w:120, vida:2.2 },
      { t:160, fn:"ola", tipo:"patrulla",   n:4, patron:"linea"  },
      { t:168, fn:"ola", tipo:"veloz",      n:8, patron:"V"      },
      { t:176, fn:"reward" },
      { t:182, fn:"hazardOn", subtipo:"trafico" },
      { t:186, fn:"ola", tipo:"torre_neon", n:3, patron:"linea"  },
      { t:194, fn:"hazardOff" },
      { t:198, fn:"reward" },
      // Silencio deliberado antes del aviso — nada entre 198 y 214.
      { t:214, fn:"miniboss", tipo:"vertice" },
    ],
  },
  {
    // M15: la oscuridad NUNCA empieza en blackout — arranca en 0,22 (el
    // tope del bloque 5D es 0,72) y sube medio paso por acto. La regla
    // de siempre sigue mandando: bala crítica, telégrafo y balas propias
    // se pintan DESPUÉS del velo (`dibujarOscuridad()`, 5D), así que no
    // hay combinación de eventos aquí que pueda ocultar un disparo.
    nombre: "LUZ MUERTA", temaId: "abismo", armas: ["void", "plasma"],
    desc: "La oscuridad empieza ligera. Nunca te va a quitar un disparo.",
    eventos: [
      // ACTO 1 — La oscuridad, ligera, entra sola (0-64s)
      { t:  4, fn:"ola", tipo:"normal",     n:4, patron:"V"     },
      { t: 12, fn:"ola", tipo:"medusa",     n:1, patron:"linea" },
      { t: 20, fn:"reward" },
      { t: 26, fn:"oscuridad", nivel:0.22, dur:5 },
      { t: 30, fn:"ola", tipo:"veloz",      n:5, patron:"zigzag" },
      { t: 38, fn:"reward" },
      { t: 44, fn:"ola", tipo:"medusa",     n:2, patron:"pinza"  },
      { t: 52, fn:"ola", tipo:"sembrador",  n:1, patron:"linea"  },
      { t: 60, fn:"reward" },
      // ACTO 2 — MEDUSA + SEMBRADOR + mina_bio (64-130s)
      { t: 66, fn:"oscuridad", nivel:0.30, dur:6 },
      { t: 70, fn:"ola", tipo:"medusa",     n:2, patron:"linea"  },
      { t: 78, fn:"reward" },
      { t: 84, fn:"ola", tipo:"sembrador",  n:2, patron:"pinza"  },
      { t: 92, fn:"hazardOn", subtipo:"mina_bio" },
      { t: 96, fn:"ola", tipo:"veloz",      n:6, patron:"zigzag" },
      { t:104, fn:"hazardOff" },
      { t:108, fn:"reward" },
      { t:114, fn:"oscuridad", nivel:0.34, dur:7 },
      { t:118, fn:"ola", tipo:"medusa",     n:3, patron:"V"      },
      { t:126, fn:"ola", tipo:"sembrador",  n:2, patron:"linea"  },
      // ACTO 3 — Todo junto (130-185s)
      { t:132, fn:"reward" },
      { t:138, fn:"ola", tipo:"kamikaze",   n:6, patron:"pinza"  },
      { t:146, fn:"hazardOn", subtipo:"mina_bio" },
      { t:150, fn:"oscuridad", nivel:0.36, dur:8 },
      { t:154, fn:"ola", tipo:"sembrador",  n:3, patron:"pinza"  },
      { t:162, fn:"ola", tipo:"medusa",     n:3, patron:"zigzag" },
      { t:170, fn:"hazardOff" },
      { t:174, fn:"reward" },
      { t:180, fn:"ola", tipo:"veloz",      n:7, patron:"V"      },
      // MINIJEFE — sin boss principal detrás
      { t:196, fn:"miniboss", tipo:"guardian_ruina" },
      // Descarga breve
      { t:260, fn:"ola", tipo:"medusa",     n:2, patron:"linea"  },
      { t:268, fn:"reward" },
      { t:276, fn:"ola", tipo:"normal",     n:3, patron:"V"      },
    ],
  },
  {
    // M16: mismo elenco que M15, pero las oleadas "pinza" —que ya reparte
    // la mitad de los enemigos a cada lado— se usan a propósito más
    // seguido: es la manera de insinuar SIMÉTRICO sin que NÝX haya hecho
    // todavía nada. Cuando se parta de verdad en fase 2, no será la
    // primera vez que la misión enseñe dos mitades.
    nombre: "EL QUE DUERME", temaId: "abismo", armas: ["void", "plasma"],
    desc: "Algo grande respira ahí abajo. NÝX ya te ha visto.",
    eventos: [
      // ACTO 1 (0-64s)
      { t:  4, fn:"oscuridad", nivel:0.30, dur:6 },
      { t:  6, fn:"ola", tipo:"medusa",    n:2, patron:"linea" },
      { t: 14, fn:"ola", tipo:"sembrador", n:2, patron:"pinza" },
      { t: 22, fn:"reward" },
      { t: 28, fn:"hazardOn", subtipo:"mina_bio" },
      { t: 32, fn:"ola", tipo:"veloz",     n:6, patron:"zigzag" },
      { t: 40, fn:"hazardOff" },
      { t: 46, fn:"reward" },
      { t: 52, fn:"oscuridad", nivel:0.34, dur:7 },
      { t: 56, fn:"ola", tipo:"medusa",    n:3, patron:"V"      },
      // ACTO 2 (64-135s)
      { t: 64, fn:"ola", tipo:"sembrador", n:2, patron:"pinza"  },
      { t: 72, fn:"reward" },
      { t: 78, fn:"hazardOn", subtipo:"mina_bio" },
      { t: 82, fn:"ola", tipo:"medusa",    n:3, patron:"pinza"  },
      { t: 90, fn:"ola", tipo:"kamikaze",  n:6, patron:"zigzag" },
      { t: 98, fn:"hazardOff" },
      { t:104, fn:"reward" },
      { t:108, fn:"oscuridad", nivel:0.38, dur:8 },
      { t:112, fn:"ola", tipo:"sembrador", n:3, patron:"pinza"  },
      { t:120, fn:"ola", tipo:"medusa",    n:4, patron:"linea"  },
      { t:128, fn:"reward" },
      // ACTO 3 — preparación visual de la escisión, dos mitades a la vez (135-180s)
      { t:134, fn:"hazardOn", subtipo:"mina_bio" },
      { t:138, fn:"ola", tipo:"veloz",     n:7, patron:"pinza"  },
      { t:146, fn:"hazardOff" },
      { t:150, fn:"ola", tipo:"medusa",    n:4, patron:"pinza"  },
      { t:158, fn:"reward" },
      { t:164, fn:"oscuridad", nivel:0.36, dur:8 },
      { t:168, fn:"ola", tipo:"sembrador", n:3, patron:"pinza"  },
      { t:176, fn:"reward" },
      // Silencio deliberado antes del aviso — nada entre 176 y 192.
      { t:192, fn:"miniboss", tipo:"nyx" },
    ],
  },
  {
    // M17: la colada estrecha el paso, pero JAMÁS lo cierra —una sola
    // `columna` a la vez (nunca dos, eso lo reserva VÉRTICE) deja
    // siempre los dos lados libres, por construcción del propio bloque
    // 5D. Nunca "no hay sitio donde ponerse".
    nombre: "COLADA", temaId: "fragua", armas: ["fuego", "misil"],
    desc: "La fragua se estrecha. Siempre hay un sitio donde ponerse.",
    eventos: [
      // ACTO 1 (0-64s)
      { t:  4, fn:"ola", tipo:"normal",   n:4, patron:"V"     },
      { t: 10, fn:"ola", tipo:"crisol",   n:2, patron:"linea" },
      { t: 18, fn:"reward" },
      { t: 24, fn:"columna", estilo:"colada", w:90, vida:1.8 },
      { t: 28, fn:"ola", tipo:"veloz",    n:5, patron:"zigzag" },
      { t: 36, fn:"reward" },
      { t: 42, fn:"ola", tipo:"crisol",   n:3, patron:"pinza"  },
      { t: 50, fn:"ola", tipo:"martillo", n:1, patron:"linea"  },
      { t: 58, fn:"reward" },
      // ACTO 2 — zonas que se estrechan (64-130s)
      { t: 64, fn:"columna", estilo:"colada", w:110, vida:2.0 },
      { t: 70, fn:"ola", tipo:"crisol",   n:3, patron:"linea"  },
      { t: 78, fn:"reward" },
      { t: 84, fn:"ola", tipo:"martillo", n:2, patron:"pinza"  },
      { t: 92, fn:"columna", estilo:"colada", w:100, vida:2.0 },
      { t: 96, fn:"ola", tipo:"veloz",    n:7, patron:"zigzag" },
      { t:104, fn:"reward" },
      { t:110, fn:"ola", tipo:"crisol",   n:4, patron:"V"      },
      { t:118, fn:"ola", tipo:"martillo", n:2, patron:"linea"  },
      { t:126, fn:"reward" },
      // ACTO 3 (130-185s)
      { t:132, fn:"columna", estilo:"colada", w:110, vida:2.2 },
      { t:136, fn:"ola", tipo:"kamikaze", n:7, patron:"pinza"  },
      { t:144, fn:"ola", tipo:"crisol",   n:4, patron:"linea"  },
      { t:152, fn:"reward" },
      { t:158, fn:"columna", estilo:"colada", w:100, vida:2.0 },
      { t:162, fn:"ola", tipo:"martillo", n:2, patron:"pinza"  },
      { t:170, fn:"ola", tipo:"veloz",    n:8, patron:"zigzag" },
      { t:178, fn:"reward" },
      // MINIJEFE — sin boss principal detrás
      { t:192, fn:"miniboss", tipo:"yunque_movil" },
      // Descarga breve
      { t:256, fn:"ola", tipo:"crisol",   n:2, patron:"linea"  },
      { t:264, fn:"reward" },
      { t:272, fn:"ola", tipo:"normal",   n:3, patron:"V"      },
    ],
  },
  {
    // M18: antes de VULCANO, una `defensa` fija —el mismo `canon`/
    // `torreta` de M3, reutilizado tal cual— hace de ensayo silencioso
    // de la FORJA: "esto está aquí, quieto, y se puede romper" se
    // aprende jugando, sin un solo cartel de texto.
    nombre: "MAESTRO DE FRAGUA", temaId: "fragua", armas: ["fuego", "misil"],
    desc: "Algo se está cargando. Puedes romperlo. VULCANO forja el final.",
    eventos: [
      // ACTO 1 (0-64s)
      { t:  4, fn:"ola", tipo:"crisol",   n:3, patron:"linea" },
      { t: 12, fn:"ola", tipo:"martillo", n:1, patron:"linea" },
      { t: 20, fn:"reward" },
      { t: 26, fn:"columna", estilo:"colada", w:100, vida:2.0 },
      { t: 30, fn:"ola", tipo:"veloz",    n:6, patron:"pinza"  },
      { t: 38, fn:"reward" },
      // "Esto se puede romper" — ensayo silencioso de la FORJA
      { t: 44, fn:"defensa", tipo:"canon", n:2 },
      { t: 48, fn:"ola", tipo:"crisol",   n:3, patron:"zigzag" },
      { t: 56, fn:"reward" },
      // ACTO 2 (64-135s)
      { t: 64, fn:"ola", tipo:"martillo", n:2, patron:"linea"  },
      { t: 70, fn:"columna", estilo:"colada", w:110, vida:2.2 },
      { t: 76, fn:"ola", tipo:"crisol",   n:4, patron:"pinza"  },
      { t: 84, fn:"reward" },
      { t: 90, fn:"ola", tipo:"martillo", n:2, patron:"linea"  },
      { t: 98, fn:"defensa", tipo:"torreta", n:3 },
      { t:102, fn:"ola", tipo:"veloz",    n:8, patron:"zigzag" },
      { t:110, fn:"reward" },
      { t:116, fn:"columna", estilo:"colada", w:110, vida:2.2 },
      { t:120, fn:"ola", tipo:"crisol",   n:4, patron:"linea"  },
      { t:128, fn:"ola", tipo:"martillo", n:3, patron:"pinza"  },
      // ACTO 3 (135-180s)
      { t:136, fn:"reward" },
      { t:142, fn:"ola", tipo:"kamikaze", n:8, patron:"zigzag" },
      { t:150, fn:"columna", estilo:"colada", w:120, vida:2.4 },
      { t:154, fn:"ola", tipo:"crisol",   n:5, patron:"linea"  },
      { t:162, fn:"reward" },
      { t:168, fn:"ola", tipo:"martillo", n:3, patron:"linea"  },
      { t:176, fn:"ola", tipo:"veloz",    n:9, patron:"pinza"  },
      { t:184, fn:"reward" },
      // Silencio deliberado antes del aviso — nada entre 184 y 202.
      { t:202, fn:"miniboss", tipo:"vulcano" },
    ],
  },
  {
    // M19: `rompedor` y `eco` ya llevan su propia seguridad —`rompedor`
    // nunca reaparece a menos de 150px del jugador (5E), `spawnRuptura`
    // telegrafía 0,6s antes de abrirse del todo (5D)— así que "entradas
    // no convencionales, nunca encima del jugador" no pide nada nuevo:
    // ya lo hacen los propios enemigos.
    nombre: "ESPACIO ROTO", temaId: "grieta", armas: ["void", "ultimate"],
    desc: "Nada entra por donde debería. Nunca sin aviso.",
    eventos: [
      // ACTO 1 (0-64s)
      { t:  4, fn:"ola", tipo:"normal",    n:4, patron:"V"     },
      { t: 12, fn:"ola", tipo:"rompedor",  n:1, patron:"linea" },
      { t: 20, fn:"reward" },
      { t: 26, fn:"ruptura", y:0.30, r:90, dur:3.5 },
      { t: 30, fn:"ola", tipo:"veloz",     n:5, patron:"zigzag" },
      { t: 38, fn:"reward" },
      { t: 44, fn:"ola", tipo:"eco",       n:1, patron:"linea" },
      { t: 52, fn:"hazardOn", subtipo:"fragmento" },
      { t: 56, fn:"ola", tipo:"rompedor",  n:2, patron:"pinza" },
      { t: 64, fn:"hazardOff" },
      // ACTO 2 — mezcla controlada (64-130s)
      { t: 68, fn:"reward" },
      { t: 74, fn:"ruptura", y:0.28, r:100, dur:4 },
      { t: 78, fn:"ola", tipo:"eco",       n:2, patron:"linea" },
      { t: 86, fn:"ola", tipo:"kamikaze",  n:6, patron:"pinza" },
      { t: 94, fn:"reward" },
      { t:100, fn:"hazardOn", subtipo:"fragmento" },
      { t:104, fn:"ola", tipo:"rompedor",  n:2, patron:"zigzag" },
      { t:112, fn:"hazardOff" },
      { t:116, fn:"ola", tipo:"eco",       n:2, patron:"V"      },
      { t:124, fn:"reward" },
      // ACTO 3 (130-185s)
      { t:130, fn:"ruptura", y:0.32, r:100, dur:4.5 },
      { t:134, fn:"ola", tipo:"veloz",     n:8, patron:"zigzag" },
      { t:142, fn:"ola", tipo:"rompedor",  n:2, patron:"linea"  },
      { t:150, fn:"reward" },
      { t:156, fn:"hazardOn", subtipo:"fragmento" },
      { t:160, fn:"ola", tipo:"eco",       n:2, patron:"pinza"  },
      { t:168, fn:"ola", tipo:"rompedor",  n:3, patron:"zigzag" },
      { t:176, fn:"hazardOff" },
      { t:180, fn:"reward" },
      // MINIJEFE — sin boss principal detrás
      { t:194, fn:"miniboss", tipo:"heraldo_grieta" },
      // Descarga breve
      { t:258, fn:"ola", tipo:"eco",       n:2, patron:"linea" },
      { t:266, fn:"reward" },
      { t:274, fn:"ola", tipo:"normal",    n:3, patron:"V"      },
    ],
  },
  {
    // M20: FINAL DE LA EXPANSIÓN. Tres actos con identidad propia, no
    // "misión normal + boss": ACTO 1 vuelve a las reglas de M19, ACTO 2
    // mezcla con cuidado —grieta y algún básico, NUNCA los cinco mundos
    // a la vez, eso sería ruido, no clímax— y ACTO 3 BAJA la densidad a
    // propósito antes del aviso, con un silencio largo, para que AXIOMA
    // entre en un vacío, no en medio de una oleada.
    nombre: "LO QUE QUEDA", temaId: "grieta", armas: ["void", "ultimate"],
    desc: "El final de la expansión. AXIOMA espera al otro lado.",
    eventos: [
      // ACTO 1 — grieta / rompedor / eco (0-96s)
      { t:  3, fn:"ola", tipo:"normal",   n:5, patron:"V"     },
      { t: 10, fn:"ola", tipo:"rompedor", n:2, patron:"linea" },
      { t: 18, fn:"reward" },
      { t: 24, fn:"ruptura", y:0.30, r:100, dur:4 },
      { t: 28, fn:"ola", tipo:"eco",      n:2, patron:"pinza" },
      { t: 36, fn:"hazardOn", subtipo:"fragmento" },
      { t: 40, fn:"ola", tipo:"veloz",    n:7, patron:"zigzag" },
      { t: 48, fn:"hazardOff" },
      { t: 54, fn:"reward" },
      { t: 60, fn:"ola", tipo:"rompedor", n:2, patron:"V"      },
      { t: 68, fn:"ola", tipo:"eco",      n:2, patron:"linea"  },
      { t: 76, fn:"reward" },
      { t: 82, fn:"ruptura", y:0.32, r:110, dur:4.5 },
      { t: 86, fn:"ola", tipo:"kamikaze", n:8, patron:"pinza"  },
      { t: 94, fn:"reward" },
      // ACTO 2 — mezcla controlada, sin los cinco mundos a la vez (96-190s)
      { t:100, fn:"hazardOn", subtipo:"fragmento" },
      { t:104, fn:"ola", tipo:"rompedor", n:3, patron:"zigzag" },
      { t:112, fn:"ola", tipo:"eco",      n:3, patron:"linea"  },
      { t:120, fn:"hazardOff" },
      { t:124, fn:"reward" },
      { t:130, fn:"ruptura", y:0.28, r:110, dur:4.5 },
      { t:134, fn:"ola", tipo:"veloz",    n:9, patron:"pinza"  },
      { t:142, fn:"ola", tipo:"rompedor", n:3, patron:"V"      },
      { t:150, fn:"reward" },
      { t:156, fn:"hazardOn", subtipo:"fragmento" },
      { t:160, fn:"ola", tipo:"eco",      n:3, patron:"zigzag" },
      { t:168, fn:"ola", tipo:"kamikaze", n:9, patron:"linea"  },
      { t:176, fn:"hazardOff" },
      { t:180, fn:"reward" },
      { t:186, fn:"ola", tipo:"rompedor", n:3, patron:"pinza"  },
      // ACTO 3 — antesala de AXIOMA: baja la densidad a propósito (190-236s)
      { t:194, fn:"reward" },
      { t:200, fn:"ola", tipo:"eco",      n:2, patron:"linea"  },
      { t:210, fn:"oscuridad", nivel:0.20, dur:6 },
      // Sin oleadas nuevas un buen tramo: lo que quede en pantalla se
      // despeja solo, y la pantalla llega vacía al aviso.
      { t:236, fn:"reward" },
      // Silencio deliberado y largo antes del aviso — nada entre 236 y 268.
      { t:268, fn:"miniboss", tipo:"axioma" },
    ],
  },
];
