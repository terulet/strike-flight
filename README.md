# PLAYZONE RUSH

Reto diario de microjuegos para picarse con los amigos.
Abres, juegas 30 segundos, ves que Marc te ha pasado por 153 puntos y vuelves a darle.

Este es el **milestone 1**: el corazón del producto funcionando en local.
Sin backend, sin cuentas, sin tienda. Solo el bucle:

> abrir → jugar → puntuar → superar a alguien → ranking → revancha.

Es un proyecto **independiente**. No toca ni depende de los demás juegos de PLAYZONE
(001, 002, 003…), que siguen viviendo en sus propios repositorios. La idea es que más
adelante puedan entrar aquí implementando el contrato de minijuego que se describe abajo.

---

## Cómo ejecutarlo

Requiere Node 18 o superior.

```bash
cd playzone-rush
npm install
npm run dev          # http://localhost:5173
```

Otros comandos:

```bash
npm run build        # comprueba tipos y genera dist/ (estático)
npm run preview      # sirve la build de producción
npm test             # 104 pruebas de los sistemas
npm run typecheck
```

### Probarlo desde el iPhone (misma Wi-Fi)

1. `npm run dev` en el PC. Vite ya escucha en todas las interfaces (`--host 0.0.0.0`)
   e imprime dos direcciones: `Local` y `Network`.
2. En el iPhone, con la misma Wi-Fi, abre la dirección `Network`
   (algo como `http://192.168.1.42:5173`).
3. Si no carga: es casi siempre el firewall de Windows. Permite Node.js en redes
   privadas, o abre el puerto 5173. Comprueba también que la red no esté como "pública"
   y que el router no tenga aislamiento de clientes (AP isolation).
4. Recomendado: **Compartir → Añadir a pantalla de inicio**. Se abre a pantalla completa,
   sin barra de Safari, con las safe areas ya contempladas.
5. Para las herramientas de desarrollo en el móvil: añade `?debug` a la URL o toca
   **tres veces seguidas el logo** de PLAYZONE.

Para probar la build real en vez del servidor de desarrollo: `npm run build && npm run preview`.

---

## Stack y por qué

| Pieza | Decisión | Motivo |
|---|---|---|
| **TypeScript** | Sí | El contrato de minijuego *es* el producto. Con tipos, un juego externo sabe exactamente qué tiene que implementar y el compilador lo verifica. |
| **Vite** | Sí | Arranque instantáneo, HMR, y `build` que escupe estáticos con rutas relativas: los mismos ficheros valen para un servidor, para `file://` y para meterlos en un WKWebView con Capacitor sin tocar nada. |
| **Framework de UI (React/Vue/Svelte)** | **No** | La UI son ~8 pantallas de listas y botones. Un framework aquí solo aporta peso y una capa entre el bucle de juego y el DOM. El bundle entero son **87 kB de JS (29 kB gzip) + 21 kB de CSS (5 kB gzip)**. |
| **Motor de juego (Phaser/PixiJS)** | **No** | Son arcades 2D de 30 segundos. Canvas 2D va sobrado a 60 FPS y no arrastramos 400 kB ni un ciclo de vida ajeno. Si algún día un minijuego necesita WebGL, lo pide él en su `create()`: el contrato no se entera. |
| **Vitest** | Sí | Mismo transformador que Vite, cero configuración, y los sistemas de meta son funciones puras fáciles de probar. |
| **Assets** | Ninguno | Sonido sintetizado con WebAudio y gráficos dibujados con código. Cero descargas, cero licencias, cero peso. |

---

## Estructura

```
playzone-rush/
├─ index.html
├─ src/
│  ├─ main.ts                  arranque: registra juegos, crea la app
│  ├─ core/                    piezas sin opinión sobre el producto
│  │  ├─ rng.ts                aleatoriedad determinista (mulberry32)
│  │  ├─ storage.ts            localStorage con caída a memoria
│  │  ├─ save.ts               save versionado + migraciones + rescate
│  │  ├─ clock.ts              "día de PLAYZONE" con viaje en el tiempo
│  │  ├─ audio.ts              sonido procedural (WebAudio) + mute
│  │  ├─ haptics.ts            vibración (listo para Capacitor)
│  │  ├─ input.ts              puntero + teclado unificados
│  │  ├─ fx.ts                 partículas, números flotantes, shake, flash
│  │  ├─ loop.ts               bucle rAF con dt acotado y FPS
│  │  └─ emitter.ts            eventos tipados
│  ├─ game/                    el contrato y su maquinaria
│  │  ├─ contract.ts           ⭐ interfaz de minijuego
│  │  ├─ base.ts               clase base con toda la fontanería
│  │  ├─ host.ts               monta canvas, bucle, entrada, jugo genérico
│  │  ├─ mutators.ts           catálogo y resolución de mutadores
│  │  ├─ registry.ts           registro de juegos
│  │  └─ draw.ts               ayudas de dibujo
│  ├─ games/                   los minijuegos
│  │  ├─ pulse/                reflejos
│  │  ├─ drift/                supervivencia (+ fantasma)
│  │  ├─ snap/                 precisión
│  │  └─ index.ts              ⭐ aquí se registra un juego nuevo
│  ├─ meta/                    el juego que hay alrededor del juego
│  │  ├─ daily.ts              rotación diaria determinista
│  │  ├─ rivals.ts             el grupo y sus marcas simuladas
│  │  ├─ ranking.ts            clasificación y distancias
│  │  ├─ attempts.ts           3 intentos, mejor marca
│  │  ├─ scoring.ts            cierre de partida y datos del pique
│  │  ├─ streaks.ts            ganador del día, corona y racha
│  │  ├─ secret.ts             reto secreto y evento CHAOS
│  │  └─ session.ts            reto → GameConfig (semilla, fantasma, objetivo)
│  ├─ ui/                      pantallas
│  │  ├─ app.ts                orquestador
│  │  ├─ home.ts               RUSH DE HOY
│  │  ├─ play.ts               cuenta atrás, HUD, pausa
│  │  ├─ result.ts             la pantalla del pique
│  │  ├─ debug.ts              panel de desarrollo (carga aparte)
│  │  └─ dom.ts · toast.ts · modal.ts
│  └─ styles/                  tokens y CSS por pantalla
├─ tests/                      104 pruebas (vitest)
├─ tools/                      bot de playtest, recorridos y capturas
└─ shots/                      capturas generadas (no se versionan)
```

---

## El contrato de minijuego

El shell **no sabe nada** de ningún juego concreto. Solo sabe decir:

> «carga el juego X con esta semilla, esta duración y estos mutadores»

y recoger un `GameResult` al terminar. Todo está en `src/game/contract.ts`.

```ts
interface MiniGame {
  readonly meta: GameMeta;        // id, nombre, descripción, duración, instrucciones, icono, color…
  readonly config: GameConfig;    // semilla, duración, dificultad, mutadores, fantasma, marca a batir
  readonly state: GameState;      // idle | ready | playing | paused | finished | destroyed
  readonly score: number;
  readonly events: Emitter<GameEvents>;   // score, combo, mistake, ghost, milestone, state, finish

  start(): void; pause(): void; resume(): void; restart(): void; destroy(): void;
  update(dt: number): void; render(): void; resize(w: number, h: number): void;

  hud(): HudInfo;                 // lo que pinta el HUD del shell
  getResult(): GameResult | null; // puntuación, duración, puntería, combo, fallos, métricas propias
  debugInfo?(): Record<string, unknown>;  // opcional, solo para herramientas
}
```

El host presta al juego: `canvas`, `ctx`, tamaño, **insets** (la franja que ocupa el HUD
y que el juego debe dejar libre), `input`, `audio`, `haptics` y `fx`.
Los minijuegos **no tocan el DOM**: dibujan en el canvas y emiten eventos.

### Añadir un minijuego

`BaseMiniGame` ya trae maquinaria de estados, reloj, puntuación con multiplicadores,
combo, vidas, puntería y construcción del resultado. Un juego nuevo implementa tres métodos:

```ts
// src/games/miJuego/index.ts
import { BaseMiniGame } from '../../game/base';
import type { GameDefinition, GameMeta } from '../../game/contract';

const META: GameMeta = {
  id: 'mijuego',
  name: 'MI JUEGO',
  tagline: 'Una frase y ya se entiende.',
  skill: 'reflejos',
  defaultDurationMs: 30_000,
  instructions: ['Regla única, clarísima.'],
  icon: '◆',
  accent: '#22d3ee',
  supportsGhost: false,
  scoreLabel: 'PTS',
};

class MiJuego extends BaseMiniGame {
  readonly meta = META;
  protected setup(): void {  /* estado inicial; se llama en cada intento */ }
  protected tick(dt: number): void { /* lógica; this.addScore(10, x, y) */ }
  protected draw(): void { /* dibujo en this.ctx */ }
}

export const definition: GameDefinition = {
  meta: META,
  create: (services, config) => new MiJuego(services, config),
};
```

Y una línea en `src/games/index.ts`:

```ts
import { definition as miJuego } from './miJuego/index';
registerGame(miJuego);
```

Eso es todo: aparece en la rotación diaria, hereda cuenta atrás, HUD, pausa, revancha,
mutadores, pantalla de resultado, ranking y persistencia. Conviene añadir su rango de
marcas en `GAME_BASELINES` (`src/meta/rivals.ts`) para que los rivales simulados
puntúen en su escala.

---

## Cómo funciona cada sistema

### Mutadores
Un mutador **no es una variante del juego, es un modificador de datos**. Todos se
resuelven en un único `MutatorState` (velocidad, ritmo, multiplicador de puntos,
duración, vidas, tamaño, gravedad, peligros extra, controles invertidos, oscuridad, caos).

- Los que aplica **el host** funcionan en cualquier juego, presente o futuro, sin tocarlo:
  `SPRINT` (duración), `PUNTOS X2` (multiplicador), `APAGÓN` (viñeta que sigue al dedo),
  `CAOS` (feedback visual).
- Los que lee **el juego** de su `MutatorState`: `ACELERÓN`, `ENJAMBRE`, `UNA VIDA`,
  `MINIATURA`, `GRAVEDAD X2`, `ESPEJO`.

Hay 10 implementados. Cada día la rotación pone 0 en el reto 1, 1 en el reto 2 y 2 en
el reto 3, sin repetir. Combinar mutadores nunca deja el juego injugable: el resolutor
acota todos los valores.

### Rotación diaria
No hay servidor: **el día se calcula**. La clave del día (`YYYY-MM-DD`) es la semilla de
todo, así que el mismo día produce los mismos retos, mutadores, semillas y marcas de
rivales en cualquier máquina. Cuando llegue el backend, este módulo se sustituye por una
descarga y el resto del juego no se entera.

### Ranking
Mi total del día = suma de mis **mejores** marcas en los retos que puntúan.
El total de un rival = sus marcas simuladas de ese día (deterministas, derivadas de su
perfil de habilidad por tipo de juego y de su constancia) más los ajustes de debug.
El evento CHAOS puntúa aparte. El reto secreto solo suma cuando está abierto.

### Intentos
3 por reto diario, 1 para el secreto y 1 para CHAOS. El intento se consume **al empezar**
(si no, bastaría con reiniciar cien veces y quedarse con la buena), con devolución si
abandonas en los primeros 3 segundos. Solo se guarda la mejor de las tres marcas.

### Revancha
La pantalla de partida **no se desmonta** al terminar: el resultado es una capa encima.
Pulsar REVANCHA quita la capa y reinicia el juego con una cuenta atrás corta (`¡YA!`).
Medido en las pruebas automáticas: **~850 ms desde el botón hasta estar jugando**, sin
pasar por ningún menú.

### Fantasma
`DRIFT` recibe en su `GameConfig` un `GhostData` con hasta dónde llegó el rival que tienes
justo delante en ese reto. Se ve como una marca en el riel derecho, como una silueta que
aparece al acercarte y como un aviso al superarla (flash, sonido, vibración y línea en el
resultado). No hay replays: es un único número, y el contrato ya está preparado para que
mañana sea una traza real sin cambiar la UI.

### Reto secreto
Sale bloqueado con el progreso del grupo (`3/5 han jugado`). Se abre cuando **los cinco**
habéis jugado los tres retos del día. Reutiliza uno de los juegos del día con mutadores
especiales (`APAGÓN` + `PUNTOS X2`), un único intento, y suma al ranking del día.

### Evento CHAOS
Un intento, mutadores rotos (`CAOS` + uno extra), puntuación independiente del ranking
diario y su propio récord. Se activa desde el panel de debug.

### Rachas y corona
Un día se cierra al pasar de fecha y se guarda su ganador. Los días anteriores a la
instalación no se inventan: se calculan con las mismas marcas deterministas de los
rivales (yo no jugué, así que no aparezco), lo que da contexto social desde el primer
arranque sin mentir.

### Persistencia
`localStorage` bajo la clave `playzone.rush.save`, con `version` y migraciones.
Tolera: JSON corrupto (lo archiva en `playzone.rush.save.broken` y empieza limpio),
almacenamiento no disponible (cae a memoria y avisa), cuota llena (no revienta),
campos que faltan o sobran (normaliza contra los valores por defecto) y saves de
versiones futuras (conserva lo que entiende).

---

## Panel de debug

Se activa con `?debug` en la URL o con **tres toques en el logo**. Se carga como un
chunk aparte, tiene su propio CSS y su propia tipografía: no se mezcla con la UI de
producto. Está organizado en pestañas para que quepa en un móvil:

| Pestaña | Qué hace |
|---|---|
| **DÍA** | Avanzar/retroceder el día virtual, volver a hoy, desbloquear el reto secreto, activar CHAOS |
| **INTENTOS** | Restaurar intentos (todos o por reto) y tocar mi puntuación (+500 / −500 / 0) |
| **RIVALES** | Subir/bajar la marca de cada rival, «QUE ME SUPERE» (le da lo justo para pasarme por 150), marcarlos como que han jugado |
| **JUEGOS** | Lanzar cualquier juego o reto directamente, terminar la partida en curso, activar/desactivar mutadores concretos (override) |
| **ESTADO** | Semilla del día, configuración de cada reto, versión y estado del save, racha; reset/exportar/romper el save |

Además muestra FPS del juego y de la UI en una esquina.

---

## Pruebas

```bash
npm test                       # 104 pruebas unitarias
node tools/flows.mjs           # 33 comprobaciones de producto en un navegador real
node tools/playtest.mjs        # un bot juega a los tres juegos y mide las marcas
node tools/screenshots.mjs     # capturas en 393x852, landscape y escritorio
```

Los tres últimos necesitan `npm run dev` levantado.

---

## Lo que este milestone NO hace

Backend, cuentas, amigos reales, multijugador, notificaciones, compras, anuncios,
tienda, skins ni empaquetado para App Store. Es deliberado: primero hay que validar
que jugar, superar y revancha enganchan.
