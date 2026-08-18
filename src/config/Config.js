/**
 * LAST LIGHT — configuración central.
 *
 * TODO parámetro que afecte al balance vive aquí. Nada de números mágicos
 * repartidos por los sistemas: si hay que ajustar la sensación del juego,
 * se ajusta en este archivo (o en caliente desde el panel de debug).
 *
 * Unidades:
 *   distancias  → píxeles de mundo
 *   velocidades → píxeles por segundo
 *   tiempos     → segundos (salvo donde el nombre diga MS)
 */

export const Config = {
  /* ─────────────────────────── MUNDO ─────────────────────────── */
  world: {
    tileSize: 48,
    // Luz ambiental residual. 0 = negro absoluto. Subirlo hace el juego
    // legible pero mata la tensión: es la primera perilla a tocar en test.
    ambient: 0.030,
    // Tinte del ambiente (sci-fi frío).
    ambientTint: [0.35, 0.55, 1.0],
  },

  /* ─────────────────────────── CÁMARA ────────────────────────── */
  camera: {
    // Suavizado exponencial: fracción de distancia recuperada por segundo.
    follow: 9.0,
    // Cuánto se adelanta la cámara en la dirección de apuntado (0..1 del lookMax).
    lookAhead: 0.16,
    lookMax: 140,
    zoom: 1.0,
    shakeDecay: 8.5,      // amortiguación del trauma por segundo
    shakeMaxOffset: 26,   // px de desplazamiento con trauma = 1
    shakeMaxRoll: 0.028,  // radianes de rotación con trauma = 1
  },

  /* ─────────────────────────── JUGADOR ───────────────────────── */
  player: {
    radius: 9,
    accel: 2600,
    maxSpeed: 205,
    friction: 12.0,
    health: 3,
    invulnAfterHit: 0.9,
    // Silueta mínima siempre visible (el spec pide "algo" permanente).
    silhouetteAlpha: 0.30,
    // Farolillo propio: una luz ínfima pegada al jugador para no perderse.
    auraRadius: 62,
    auraIntensity: 0.16,
    // Pasos → ruido que los enemigos pueden oír.
    footstepInterval: 0.36,
    footstepLoudness: 105, // radio de escucha en px
    // "Exposición": cuánto delata la luz al jugador. La suben los fogonazos.
    exposureDecay: 1.9,   // por segundo
  },

  /* ──────────────────────────── ARMA ─────────────────────────── */
  weapon: {
    name: 'PULSE',
    fireInterval: 0.155,
    damage: 1,
    // Munición: es lo que convierte "disparo para ver" en una DECISIÓN.
    // Ponlo a true para pruebas de sensación pura sin presión de recursos.
    infiniteAmmo: false,
    magSize: 8,
    reserveAmmo: 40,
    reloadTime: 1.15,
    // Retroceso: empuje físico al jugador + sacudida visual del cañón.
    // Vive con el arma, no con el jugador: es propiedad de lo que dispara.
    recoilImpulse: 118,
    recoilKick: 7.0,       // px que retrocede visualmente el cañón
    recoilRecover: 16.0,
    spread: 0.022,         // radianes de dispersión base
    spreadPerShot: 0.020,  // acumulado por disparo
    spreadMax: 0.13,
    spreadRecover: 0.34,   // radianes recuperados por segundo
    projectileSpeed: 1150,
    projectileLife: 1.5,
    projectileRadius: 2.6,
    // Ruido del disparo: los enemigos lo oyen a este radio.
    shotLoudness: 900,
    // Cuánto delata al jugador cada disparo (0..1 de exposición).
    shotExposure: 1.0,
    // Congelación de fotograma al impactar. Barato y se nota muchísimo.
    hitStopMs: 42,
    hitStopKillMs: 90,
    shakeOnFire: 0.16,
    shakeOnHit: 0.10,
    shakeOnKill: 0.30,
  },

  /* ────────────────────────── ILUMINACIÓN ────────────────────── */
  lighting: {
    // Las máscaras se renderizan a esta fracción de la resolución lógica.
    // Es LA perilla de rendimiento: 0.6 es el equilibrio, 0.4 salva un iPhone
    // viejo, 1.0 solo para capturas. No subirla sin medir en dispositivo.
    maskScale: 0.6,
    // Cuánta luz se suma por encima de la escena ya iluminada. Es el "glow".
    bloom: 0.34,
    // Máximo de luces que proyectan sombras reales a la vez. El resto cae a
    // un degradado radial sin oclusión (indistinguible en destellos cortos).
    maxShadowCasters: 5,
    maxLights: 48,
    // Suavizado del borde de la luz (0 = duro, 1 = todo degradado).
    falloff: 0.45,

    // Fogonazo del cañón: intenso, enorme y brevísimo.
    muzzle: {
      radius: 430,
      intensity: 2.5,
      duration: 0.085,
      tint: [1.0, 0.86, 0.62],
    },
    // El proyectil ilumina su recorrido. Es el efecto firma del juego.
    projectile: {
      radius: 190,
      intensity: 1.15,
      tint: [0.62, 0.86, 1.0],
      castsShadows: true,
    },
    // Impacto: destello corto que revela la pared golpeada.
    impact: {
      radius: 300,
      intensity: 1.9,
      duration: 0.16,
      tint: [1.0, 0.72, 0.45],
    },
    // Fogonazo enemigo al atacar (también le delata a él).
    enemyMuzzle: {
      radius: 300,
      intensity: 1.8,
      duration: 0.075,
      tint: [1.0, 0.42, 0.34],
    },
  },

  /* ─────────────────────── MEMORIA VISUAL ────────────────────── */
  // La segunda gran idea: lo iluminado no cae de golpe al negro.
  memory: {
    enabled: true,
    // Vida media del recuerdo. Curva objetivo del brief:
    // 0ms máx · 200ms nítido · 500ms decayendo · 1000ms siluetas · 1500ms negro.
    halfLife: 0.62,
    // Suelo por debajo del cual el recuerdo se corta a negro (evita halos eternos).
    floor: 0.05,
    // Intensidad máxima del recuerdo respecto a la luz real.
    strength: 0.72,
    // El recuerdo se desatura y enfría: es memoria, no visión. `coolRate` es
    // la velocidad a la que pierde el color (por segundo). Que el color muera
    // antes que la forma es lo que hace que un recuerdo parezca un recuerdo.
    tint: [0.34, 0.52, 0.95],
    coolRate: 2.2,
    // La geometría estática se recuerda. Las entidades NO: ahí está el juego.
    // Sube esto solo si quieres "fantasmas" de enemigos (rompe la tensión).
    dynamicPersistence: 0.0,
  },

  /* ─────────────────────────── ENEMIGO ───────────────────────── */
  enemy: {
    radius: 11,
    health: 2,
    // Velocidades por estado.
    speedPatrol: 46,
    speedSuspicious: 84,
    speedAlert: 138,
    speedLost: 70,
    accel: 900,
    friction: 9.0,

    // PERCEPCIÓN. Nada de visión mágica: el enemigo también vive a oscuras.
    visionRange: 300,        // alcance máximo con el jugador totalmente expuesto
    visionRangeDark: 78,     // alcance si el jugador está a oscuras y quieto
    visionFov: 1.85,         // radianes de cono total (~106°)
    hearingRange: 900,       // radio propio de escucha
    // Nota de balance: con 620 un disparo apenas cruzaba una sala y el
    // riesgo de disparar no llegaba a existir. 900 hace que un tiro se
    // oiga en buena parte de la arena, que es de lo que va el juego.
    // Error con el que memoriza el origen de un ruido (px). >0 = no es GPS.
    hearingError: 88,

    // Tiempos de la máquina de estados.
    suspiciousTime: 7.0,     // cuánto persigue un ruido antes de rendirse
    lostTime: 5.5,           // cuánto busca tras perder contacto
    searchRadius: 150,       // radio de merodeo en LOST
    reacquireDelay: 0.16,    // histéresis antes de pasar a ALERT
    loseSightGrace: 0.55,    // margen antes de considerar perdido al jugador

    // Ataque.
    attackRange: 250,
    attackInterval: 1.25,
    attackWindup: 0.42,      // aviso previo: el jugador puede reaccionar
    attackDamage: 1,
    projectileSpeed: 430,

    // Ruido propio: sus pasos son la pista principal del jugador.
    footstepInterval: 0.55,
    footstepLoudness: 0,     // el enemigo no se oye a sí mismo
    // Ojos: única información permanente del enemigo. Tenues y delatores.
    eyeAlphaIdle: 0.16,
    eyeAlphaAlert: 0.85,
    eyeRange: 560,           // más allá de esto los ojos no se ven
    spawnCount: 5,
  },

  /* ──────────────────────────── AUDIO ────────────────────────── */
  audio: {
    enabled: true,
    master: 0.55,
    // El sonido es la otra forma de ver: el paneo estéreo debe ser generoso.
    panWidth: 460,           // px para llegar al paneo total
    falloff: 900,            // px hasta el silencio
    footstepVolume: 0.55,
    enemyBreathRange: 330,   // a partir de aquí se le oye respirar
  },

  /* ──────────────────────────── FX ───────────────────────────── */
  fx: {
    maxParticles: 420,
    muzzleParticles: 7,
    impactParticles: 11,
    deathParticles: 26,
    shellChance: 1.0,
    // Polvo ambiental en suspensión: da volumen a los haces de luz.
    dustCount: 130,
    dustDrift: 9,
  },

  /* ───────────────────────── PRESENTACIÓN ────────────────────── */
  render: {
    // Techo de píxeles internos. Un iPad Pro a dpr 2 pediría 5 Mpx por capa
    // y hay 5 capas: sin este límite el rendimiento se cae por la resolución,
    // no por el juego. Se reescala a pantalla completa igualmente.
    maxPixels: 1_500_000,
    dprCap: 2,
    vignette: 0.55,
    grain: 0.030,
  },

  /* ──────────────────────── CONTROL TÁCTIL ──────────────────── */
  touch: {
    // 'auto' | 'button' | 'release'. Ver TouchControls.js para el porqué.
    fireMode: 'auto',
    stickRadius: 62,
    deadzone: 0.16,
    fireThreshold: 0.42,
    buttonRadius: 46,
    hudAlpha: 0.16,
    autoReload: true,
  },

  /* ─────────────────────────── DEBUG ─────────────────────────── */
  debug: {
    enabled: false,
    showAI: true,
    showHearing: true,
    showVision: true,
    showLights: true,
    showColliders: false,
    // Desactiva la oscuridad para inspeccionar el nivel.
    fullbright: false,
  },
};

/** Copia profunda de los valores por defecto, para el botón "reset" del debug. */
export const Defaults = structuredClone(Config);

/** Lee/escribe una ruta tipo 'lighting.muzzle.radius' sobre un objeto. */
export function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
}

export function setPath(obj, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  const target = keys.reduce((o, k) => o[k], obj);
  target[last] = value;
}
