# PLAYZONE RUSH

Reto diario de microjuegos para picarse con los amigos.
Abres, juegas 30 segundos, ves que Marc te ha pasado por 153 puntos y vuelves a darle.

Este es el **milestone 3**: el mismo bucle, pero **desplegado de verdad y
midiéndose**.

> abrir → jugar → puntuar → superar a alguien de verdad → esa persona lo ve →
> revancha.

Dos móviles distintos, un código de grupo de cuatro letras, y la marca de uno
aparece en el otro sin recargar. Sin registro, sin email, sin login.

Ahora, además: se instala en la pantalla de inicio, se autoaloja con HTTPS, se
entera solo de que hay versión nueva, registra sus errores, y tiene un panel de
métricas de solo lectura para responder a la única pregunta que importa esta
semana — **¿vuelve la gente sola, y vuelve por lo que hace otro?**

- [Cómo desplegarlo](docs/DESPLIEGUE.md) · [Protocolo de la alfa de 7 días](docs/ALFA-7-DIAS.md) · [Features congeladas](docs/CONGELADO.md)

Es un proyecto **independiente**. No toca ni depende de los demás juegos de PLAYZONE
(001, 002, 003…), que siguen viviendo en sus propios repositorios. La idea es que más
adelante puedan entrar aquí implementando el contrato de minijuego que se describe abajo.

---

## Cómo ejecutarlo

Requiere Node 22 o superior (el servidor usa `node:sqlite`, que llegó en Node 22).

```bash
cd playzone-rush
npm install
npm run dev:all      # backend (8788) + frontend (5173) en una sola ventana
```

Abre `http://localhost:5173`. El frontend habla siempre con `/api`, que Vite
reenvía al backend: un único origen, sin CORS ni IPs que configurar.

Otros comandos:

```bash
npm run dev          # solo frontend (el modo PROBAR SOLO funciona sin backend)
npm run server       # solo backend
npm run build        # comprueba tipos y genera dist/ (estático)
npm run preview      # sirve la build de producción (con service worker)
npm test             # 221 pruebas (cliente + backend)
npm run test:server  # solo backend
npm run typecheck
```

### Probarlo con DOS móviles (misma Wi-Fi)

Esta es la prueba que importa en este milestone.

1. `npm run dev:all` en el PC. Vite imprime dos direcciones: `Local` y `Network`.
   Usa la de **Network** (algo como `http://192.168.1.42:5173`). Si no la ves:
   `ipconfig` en Windows → "Dirección IPv4".
2. **Móvil A**: abre esa dirección → CREAR GRUPO → nombre → sale un código de
   cuatro caracteres (por ejemplo `7K4D`) → COMPARTIR (se abre el menú de iOS)
   o COPIAR.
3. **Móvil B**: misma dirección → UNIRME A UN GRUPO → escribe el código y su
   nombre → ENTRAR.
4. Los dos veis la misma clasificación. Jugad el mismo reto: cuando uno supere
   al otro, el que ha perdido el primer puesto verá aparecer
   **"🔥 X TE HA QUITADO EL #1"** con un botón de REVANCHA que entra directo al
   juego donde lo tiene más cerca.
5. Si cortas la Wi-Fi de un móvil, ese móvil sigue jugando; sus marcas quedan
   como `1 PENDIENTE` arriba a la derecha y suben solas al volver la cobertura.
Si no carga: es casi siempre el firewall de Windows. Permite Node.js en redes
privadas, o abre los puertos 5173 y 8788. Comprueba también que la red esté
marcada como privada y que el router no tenga aislamiento de clientes.

Recomendado: **Compartir → Añadir a pantalla de inicio**. Se abre a pantalla
completa, sin barra de Safari, y con la build de producción (`npm run preview`)
además queda cacheada: abre aunque no haya cobertura.

Para las herramientas de desarrollo en el móvil: añade `?debug` a la URL o toca
**tres veces seguidas el logo** de PLAYZONE.

Para probar la build real: `npm run build`, luego `npm run server` y
`npm run preview` (preview también reenvía `/api` al backend).

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
| **Backend** | `node:http` + `node:sqlite`, **cero dependencias** | Ver abajo. |
| **Tiempo real** | Server-Sent Events + polling de seguridad | Un `GET` que se queda abierto. Sin websockets, sin librería, y atraviesa cualquier proxy. Si se cae, hay un sondeo cada 20 s por debajo. |

---

## Dirección visual: ARCADE SOCIAL PREMIUM

La idea es una sola: **el juego pasa dentro de una máquina, y la máquina es
cristal oscuro con luz por dentro.** De ahí sale todo lo demás.

### El reparto del color

Esto es lo que evita el ruido: cada tono tiene un trabajo, y solo uno. Si el
mismo acento sirve para pulsar y para ganar, deja de significar nada.

| Color | Trabajo | Dónde sale |
|---|---|---|
| **Cian** `#22d3ee` | Energía, acción, «esto se pulsa» | CTA, tu fila del ranking, tu puesto, el código del grupo |
| **Violeta** `#8b5cf6` | Profundidad, superficie | Aurora de fondo, CHAOS |
| **Oro** `#ffd23f` | **Solo el primer puesto**, corona y racha | Insignia del #1, «te faltan 42» cuando quedaste cerca |
| **Magenta** `#ff2f6d` | Calor social: rivalidad y adelantamientos | «Te ha quitado el #1», la marca |
| **Lima** `#d7ff3e` | Acento agudo, en gotas | Poco y contado |
| **Rojo** `#ff4d6d` | Pérdida. Nunca decorativo | Fallo, apuesta perdida |

El oro es escaso a propósito: si sale en cinco sitios deja de querer decir
*primero*. Y el magenta —que antes pintaba media interfaz— pasa a estar al
servicio del pique en vez de decorar.

### Tipografía

**Archivo variable**, auto-alojada en `public/fonts/archivo.woff2` (88 kB, pesos
100–900 y ejes de anchura). Auto-alojada porque es una PWA que tiene que abrir
sin cobertura; con `font-display: swap` y pila del sistema de reserva, si el
fichero no llega el juego se lee igual.

Seis tamaños y ni uno más (`--t-heroe` … `--t-micro`). Los números llevan
`.num`: peso 900, más cerrados y con cifras de ancho fijo para que no bailen al
contar.

### Motion

**La interfaz nunca espera a la animación.** Nada pulsable tarda más de 240 ms
en estar disponible y las entradas completas se acaban antes de medio segundo.

- `--dur-tap: 90ms` · `--dur-fast: 150ms` · `--dur: 240ms` · `--dur-lento: 420ms`
- `--ease-elastico` se reserva para **recompensa** (récord, adelantamiento, ×2).
  Usarlo en todo hace que la interfaz parezca de goma.
- Todo lo animado tiene salida por `prefers-reduced-motion`.

### Componentes

`src/styles/components.css` es el sistema: lo que se repite en más de una
pantalla vive ahí, para que portada, resultado, sorteo y HUD no sean cuatro
dialectos. Panel y cristal, rótulos, `cifra-heroe`, chips teñidos, insignia de
puesto, banner social, ficha de jugador, barra de distancia y entradas
escalonadas.

Muchos aceptan `--emite` como color, así que **un solo componente sirve para
todos los estados** sin multiplicar clases:

```html
<div class="banner" style="--emite: var(--oro)">…</div>
```

**Regla del cristal:** `backdrop-filter` solo en lo que **flota** (paneles,
banners, overlays). Cada capa con desenfoque cuesta, y encima del canvas cuesta
el doble.

### El sorteo de los retos del día

`src/ui/reveal.ts`. Tres columnas que giran y **paran una a una** revelando los
retos. Se toma prestado el *ritmo* de la tragaperras —la espera entre parada y
parada es donde está la tensión— pero no su estética: lo que gira son las marcas
de los propios juegos, cada una en su color.

- 2,2 s hasta la última parada. Se salta tocando, y saltarlo deja los tres
  retos puestos.
- Se ve **una vez al día** (`DayRecord.revealVisto`). Una animación que se
  repite en cada apertura deja de ser un momento y pasa a ser un peaje.
- **No decide nada**: el sorteo del día ya lo hizo la semilla antes de pintarse.
  Esto solo lo cuenta.

---

## Compartir: momentos y mini-póster

Un share que sale siempre no significa nada. Solo se ofrece cuando ha pasado
algo que **a otra persona le cambia el día**.

**Tres capas separadas** — `meta/compartir.ts` decide y describe (funciones
puras, sin DOM), `ui/poster.ts` dibuja, `ui/compartir.ts` envía. El renderer no
consulta el estado del juego: recibe una estructura plana y pinta. Por eso un
póster de prueba con datos inventados sale idéntico al de verdad, y los casos
raros (nombre largo, seis cifras, empate, sin rival) se comprueban sin
provocarlos jugando.

**Ocho momentos**, en orden de fuerza social y no deportiva:

| | Cuándo | Remate |
|---|---|---|
| 🔥 Robar el #1 | te pones primero quitándoselo a alguien | ¿ME LO QUITAS? |
| Por los pelos | ganas por ≤ 60 puntos | ESO HA DOLIDO. |
| 🔥 Doblar | ganas el DOBLE O NADA | NO HA SIDO SUERTE. |
| 💀 Caer | lo pierdes | DOLIÓ. |
| 👑 Racha | 3+ días mandando | HOY MANDO YO. |
| 👻 Ghost | superas la marca del rival | A VER SI PUEDES. |
| 🔓 Secreto | el grupo lo desbloquea | UN INTENTO. A OSCURAS. |
| Récord | tu mejor marca | +X SOBRE MI MARCA |

Jugársela se cuenta **antes** que un récord porque es lo que más conversación
genera. Y ganar por 18 puntos se cuenta antes que ganar por 900: el margen *es*
la historia.

**El póster**: 1080×1350 (4:5), Canvas 2D, sin dependencias, determinista.
JPEG al 0,92, entre 79 y 131 kB. PNG daba 1.563 kB para el mismo póster — el
fondo son degradados suaves, justo lo que peor comprime PNG — y no se distingue
a la vista. WebP baja a 51 kB pero WhatsApp lo trata como pegatina en algunas
plataformas.

Se dibuja **al pulsar**, no al terminar la partida: cuesta unos milisegundos y
no tiene por qué gastarlos quien no va a compartir.

**Cuatro caminos de envío, ninguno silencioso**: fichero por el menú del
sistema → solo texto → guardar imagen y copiar texto *diciéndolo* → aviso de
fallo. Cancelar el menú no es un fallo y no dispara nada por detrás.

---

## Transiciones

**La tarjeta se convierte en el juego.** Se mide la tarjeta pulsada, se clona su
aspecto en una capa fija y esa capa crece hasta llenar la pantalla mientras se
disuelve, con el nombre del juego flotando en el centro.

Lo que hace que no sea un adorno: **la partida se monta dentro de la llamada, no
al terminar la animación**. Medido en página: del toque al primer fotograma de
juego, 45–98 ms; la capa termina de irse a los 520 ms. La animación acompaña el
arranque en vez de retenerlo, y lleva `pointer-events: none` porque durante esos
420 ms hay un juego corriendo debajo.

**La vuelta**: el resultado sube desde el propio HUD y la arena se queda detrás
bajando de intensidad en vez de desaparecer.

**Encadenar**: al acabar un reto el botón principal ofrece el siguiente.
`PlayScreen` se reconfigura sin remontarse, así que se reaprovecha el lienzo y
el audio ya arrancado. VER RANKING sigue a un toque.

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
│  ├─ net/                     la capa nueva de este milestone
│  │  ├─ client.ts             cliente HTTP con timeouts y errores tipados
│  │  ├─ sync.ts               SSE, reconexión, cola de envíos, conciliación
│  │  ├─ ghost.ts              códec de la traza del fantasma
│  │  └─ types.ts              formas que viajan entre cliente y servidor
├─ server/                     backend (JavaScript puro, sin build)
│  ├─ bin/start.mjs            arranque
│  ├─ src/config.mjs           TODO lo configurable (env vars y límites)
│  ├─ src/db.mjs               esquema SQLite y consultas
│  ├─ src/api.mjs              la lógica: grupos, marcas, ghost, secreto
│  ├─ src/validate.mjs         nada entra sin pasar por aquí
│  ├─ src/sse.mjs              empuje de la foto del grupo
│  ├─ src/server.mjs           enrutador HTTP
│  └─ test/                    38 pruebas (lógica + HTTP real)
├─ public/sw.js                service worker: abrir sin cobertura
├─ tests/                      143 pruebas de cliente (vitest)
├─ tools/                      bots, duelo entre dos móviles, resiliencia, capturas
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

### Los cuatro juegos

| | Habilidad | Regla | Formato |
|---|---|---|---|
| **PULSE** | Reflejos | Toca los nodos azules antes de que se apaguen; los rojos quitan vida | 30 s, 3 vidas |
| **DRIFT** | Supervivencia | Pasa por los huecos; rozar sin chocar da bonus. **Aquí vive el fantasma** | 40 s, 1 vida |
| **SNAP** | Precisión | 18 disparos, no tiempo: acierta lo más cerca del centro | 18 balas / 30 s |
| **MEMORY** | Memoria | Se encienden casillas, se apagan, tócalas todas. Cada ronda una más | 30 s, 3 vidas |

Cada día la rotación elige **3 de los 4**. El pool sale del registro: registrar
un quinto juego lo mete en la rotación sin tocar nada más.

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

**Cada juego declara con cuáles se lleva bien** (`supportedMutators` en su
`GameMeta`) y la rotación filtra el resto: `GRAVEDAD X2` no pinta nada en
MEMORY, que no tiene inercia, así que nunca le toca.

### Rotación diaria
No hay servidor: **el día se calcula**. La clave del día (`YYYY-MM-DD`) es la semilla de
todo, así que el mismo día produce los mismos retos, mutadores, semillas y marcas de
rivales en cualquier máquina. Cuando llegue el backend, este módulo se sustituye por una
descarga y el resto del juego no se entera.

### Ranking
Mi total del día = suma de mis **mejores** marcas en los retos que puntúan.
En grupo, los rivales son **personas**: sus marcas salen del servidor. En modo
solo (o con el interruptor de debug), son los bots simulados de siempre. El
ranking no sabe la diferencia: recibe una lista de contendientes y ordena.

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

### Fantasma (ahora de verdad)
`DRIFT` graba **una muestra cada 100 ms** con su posición horizontal normalizada.
Una partida de 40 s son 400 bytes crudos, ~536 caracteres en base64: se envía
junto al resultado, y **solo si esa partida ha mejorado la marca del día**.

Al lanzar una revancha, la traza del rival se descarga **durante la cuenta
atrás** (nunca se espera por la red) y su nave aparece corriendo a tu lado,
dibujada en contorno para que no tape la tuya. Cuando la adelantas: flash,
sonido, vibración y aviso. Si el rival no tiene traza, se usa el sistema
anterior de marca a distancia; el juego nunca falla por eso.

Medido en la prueba automática: 118 muestras, **160 bytes** para 11,8 s.

### Reto secreto
Sale bloqueado con el progreso real del grupo (`3/5 JUGADORES LISTOS`). Se abre
cuando **todos los que han abierto PLAYZONE ese día** han terminado los tres
retos. Esa es la regla, y es deliberada: quien entró una vez hace un mes no
bloquea al grupo para siempre. Reutiliza uno de los juegos del día con
mutadores especiales (`APAGÓN` + `PUNTOS X2`), un único intento, y suma al
ranking del día.

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


## El backend (y por qué este)

**`node:http` + `node:sqlite`. Cero dependencias.** Un proceso, un fichero de
base de datos, y `node server/bin/start.mjs` para arrancarlo.

Se valoraron Supabase y Firebase. Las dos habrían funcionado, pero para lo que
hace falta ahora —ocho personas, cuatro tablas, un código de invitación— traen
más de lo que resuelven: una consola web, un SDK en el bundle, un modelo de
permisos que aprender y un proveedor del que salir después. El día que haga
falta escalar o dejar de mantener el servidor, migrar es reescribir
`src/net/client.ts` (un fichero, ~200 líneas): el resto de la app habla con
`SyncEngine`, no con el backend.

Lo que sí se ha respetado del enunciado: coste inicial cero, se despliega en
cualquier sitio que ejecute Node, se borra con un `rm`, y no hay lock-in.

### Modelo de datos

```
groups     id · code · timezone · season · max_players · created_at
players    id · group_id · name · secret · joined_at · last_seen_at
scores     (day, player_id, challenge_id) · game_id · best_score
           · attempts_used · plays · counts_ranking · updated_at
attempts   attempt_id · player_id · day · created_at · response   ← idempotencia
ghosts     (day, player_id, game_id) · score · duration_ms · trace
presence   (day, player_id) · seen_at                             ← reto secreto
events     ts · group_id · player_id · day · type · game_id · value · meta
```

Sin redundancia: el total del día no se guarda, se suma; el ranking no se
guarda, se ordena; la participación no se guarda, se deduce de `scores`.

### Endpoints

| Método | Ruta | Para qué |
|---|---|---|
| `POST` | `/api/groups` | Crear grupo (devuelve código + credencial) |
| `POST` | `/api/groups/join` | Entrar con código |
| `GET` | `/api/snapshot` | La foto del grupo del día |
| `POST` | `/api/scores` | Enviar una partida (idempotente) |
| `GET` | `/api/ghost` | Bajar la traza de un rival |
| `POST` | `/api/name` | Cambiar mi nombre |
| `POST` | `/api/events` | Telemetría de producto |
| `GET` | `/api/stats` | Métricas agregadas del grupo |
| `GET` | `/api/stream` | SSE: la foto del grupo cuando cambia |
| `GET` | `/api/health` | Estado y día competitivo del servidor |

## Grupos e identidad

- **Crear grupo** genera un código de 4 caracteres con un alfabeto sin
  ambigüedades (fuera `O/0`, `I/1`, `S/5`, `Z/2`, `B/8`), aleatorio, no
  secuencial. Máximo 8 jugadores (`PLAYZONE_MAX_PLAYERS`).
- **Identidad**: al crear o entrar, el servidor devuelve un `playerId` y un
  secreto que se guardan en el móvil. No es una cuenta: no hay email, ni
  contraseña, ni recuperación. Mismo móvil = mismo jugador después de recargar.
  Las peticiones van con `Authorization: Bearer <playerId>.<secreto>`.
- **PROBAR SOLO** sigue existiendo y funciona igual que en el milestone
  anterior: bots, día virtual, debug y cero red.

## Sincronización, offline y conflictos

**El servidor manda** en lo compartido: miembros, marcas, participación,
día competitivo. **El móvil manda** en lo suyo: identidad, preferencias, caché
y lo que aún no ha podido subir.

- Al terminar una partida, el resultado va a una **cola persistente** con un
  `attemptId` único y se intenta subir. Si no hay red, se queda ahí: la app
  muestra `1 PENDIENTE` y la puntuación local se ve al instante.
- La cola se vacía al volver la conexión, al volver a la app, cada 20 s, y en
  cuanto termina el envío anterior. Sobrevive a cerrar la app.
- **Conflictos**: solo importa la mejor marca. `best = max(local, servidor)`,
  siempre, en los dos sentidos. Una marca nunca baja.
- **Intentos**: el servidor cuenta los envíos aceptados (`plays`) y ese es el
  límite real; el número que se muestra es `max(lo que cuenta el servidor, lo
  que dice el móvil)`, con tope. Traducción: jugar sin conexión no regala
  intentos, y sincronizar tarde no te los quita.
- Si el servidor rechaza algo **para siempre** (día cerrado, sin intentos,
  datos inválidos), se saca de la cola y se avisa en pantalla. Nada se pierde
  en silencio.
- **Sin cobertura, la app abre igual**: un service worker mínimo cachea el
  shell (y nunca `/api`).

## Anti-trampa (lo justo)

No es un anti-cheat: es un cortafuegos contra el que edita la petición.
El servidor comprueba que el jugador existe y pertenece al grupo, que el juego
y el reto existen, que el día es el de hoy, que la duración es plausible, que
la puntuación está por debajo del techo de ese juego (calibrado con el bot de
playtest × 2,5), que no se superan los intentos, y que el cuerpo no pasa de
64 KB. Más un `attemptId` único por partida y un límite de peticiones por
minuto.

## Métricas

Cada evento se guarda en el móvil y, si hay grupo, se manda al servidor
(id aleatorio, tipo, día, juego y un número; nada personal).

**REVENGE RATE = `revenge_clicked / revenge_available`** — la métrica de esta
fase. Se cuenta una oferta cuando la pantalla de resultado (o el aviso de la
portada) enseña de verdad un botón de revancha con una diferencia concreta, y
una pulsación cuando se aprieta. Las ofertas repetidas por un repintado no
cuentan dos veces.

Además: utilización de intentos, % de días completos, adelantamientos a favor
y en contra, vuelta al día siguiente, mediana de **reacción social** (de "me
han superado" a empezar la siguiente partida) y **revancha por tramos** de
diferencia (0-100, 100-300, 300-1000, 1000+), que es lo que dirá si el pique
funciona porque está cerca o simplemente porque hay botón.

Todo se ve en la pestaña **METRICAS** del panel de debug, con exportar a JSON
y borrar.

## Configuración

Nada sensible en el código. Cliente (build time):

| Variable | Por defecto | Para qué |
|---|---|---|
| `VITE_API_URL` | vacío (mismo origen) | URL del backend si está en otro dominio |

Servidor (runtime):

| Variable | Por defecto | Para qué |
|---|---|---|
| `PLAYZONE_PORT` | `8788` | Puerto |
| `PLAYZONE_HOST` | `0.0.0.0` | Interfaz |
| `PLAYZONE_DB` | `server/data/playzone.db` | Fichero SQLite |
| `PLAYZONE_TZ` | `Europe/Madrid` | Zona del día competitivo |
| `PLAYZONE_MAX_PLAYERS` | `8` | Tope por grupo |
| `PLAYZONE_RATE_LIMIT` | `240` | Peticiones por minuto y ruta |
| `PLAYZONE_CORS` | `*` | Origen permitido (poner el dominio real al desplegar) |

## Desplegar

En la LAN de casa no hace falta desplegar nada: `npm run dev:all` y la IP del
PC. Para tenerlo fuera de casa, **el runbook completo está en
[docs/DESPLIEGUE.md](docs/DESPLIEGUE.md)**.

El resumen: en producción **un solo proceso Node sirve el juego y la API** en
el mismo puerto. Ni segundo servidor, ni CORS, ni proxy que configurar.

```bash
npm install          # completo: vite y typescript hacen falta para construir
npm run build        # genera dist/
npm run server       # sirve dist/ Y /api en el mismo puerto
```

Si existe `dist/`, el servidor lo detecta y lo sirve; si no, arranca en modo
solo-API y el frontend lo sirve Vite. `index.html`, el manifest y `sw.js` van
con `no-cache` para que una build nueva se recoja sola; los ficheros de
`assets/` llevan hash y se cachean un año.

Para HTTPS y una URL pública sin comprar dominio, el runbook usa **Tailscale
Funnel**, y **pm2** para que sobreviva a los reinicios.

> **Estado real**: el despliegue lo ejecuta una persona en su propia máquina
> siguiendo el runbook. Desde este entorno no hay acceso a esa máquina, así que
> aquí no se ha desplegado nada ni se va a fingir que sí. Lo que sí está
> probado y verificado es todo lo que el runbook necesita: un solo proceso
> sirviendo las dos cosas, cabeceras de caché, PWA instalable, copias de
> seguridad y actualización limpia.

### Copias de seguridad

Cada 6 horas, `VACUUM INTO` sobre el SQLite (seguro con el servidor
escribiendo, a diferencia de copiar el fichero). Se guardan las últimas 28: una
semana entera. Cada copia es una base de datos válida por sí sola.

Se configura con `PLAYZONE_BACKUP_DIR`, `PLAYZONE_BACKUP_INTERVAL_MS` y
`PLAYZONE_BACKUP_KEEP`.

## Instalar como app (PWA)

Con Safari en iOS: compartir → **Añadir a pantalla de inicio**. Abre a pantalla
completa, con su icono y el fondo oscuro de la marca. El manifest está en
`public/manifest.webmanifest` y los iconos se generan desde la misma marca del
favicon con `node tools/gen-icons.mjs`.

## Versión nueva y actualización limpia

Dos señales independientes, porque ninguna es fiable del todo sola:

- `controllerchange` del service worker — rápido, pero Safari a veces tarda en
  comprobar si hay actualización. Y solo cuenta **si ya había un controlador**:
  en la primera visita el SW toma el control sin que haya nada que actualizar.
- Sondeo de `/api/health` comparando el build del cliente (`__BUILD_ID__`,
  fijado al compilar) con el que dice el servidor ahora mismo.

Cuando hay versión nueva aparece **HAY UNA VERSIÓN NUEVA · ACTUALIZAR** en la
portada. Nunca a mitad de partida: la pantalla de juego lo tapa por completo.

## Registro de errores

`window.onerror` y `unhandledrejection` van a `POST /api/errors`, por
`sendBeacon` cuando existe (sobrevive a que se cierre la pestaña) y por `fetch`
si no. Funciona **sin sesión**: un fallo en el onboarding también tiene que
constar. Hay un límite de envíos por carga para que un bucle roto no sea una
tormenta de peticiones.

En el servidor, una excepción no capturada se registra **antes** de salir, y
pm2 reinicia: la caída se puede investigar después.

La tabla `errors` es independiente de `events` a propósito: una es operación y
la otra es producto.

## Dashboard de la alfa (solo lectura)

Se abre con `?dashboard`. Es un **módulo aparte** del panel de debug, y esa
separación es estructural, no cosmética: `server/src/dashboard.mjs` solo
prepara sentencias `SELECT`, así que no tiene forma de tocar un resultado. Quien
mira los datos no debe poder ensuciarlos sin darse cuenta.

| Métrica | Qué mide |
|---|---|
| **Retención D1 / D3 / D7** | Volver al día siguiente exacto, por cohortes. Solo cuenta a quien ya ha tenido oportunidad de volver, y el denominador siempre está a la vista |
| **Revenge Rate** ⭐ | De las revanchas ofrecidas, cuántas se pulsan. Además, repartido por cuánto se pierde |
| **Intentos usados** | 1/3 frente a 3/3 |
| **Reto diario completado** | De los que abren, cuántos terminan los tres |
| **Organic Reopen Rate** ⭐ | Volver a abrir la app **después** de terminar la sesión del día, habiendo jugado un rival por en medio |

El **Organic Reopen Rate** es el que separa un juego social de un solitario con
marcador. El Revenge Rate dice si responden cuando ya están dentro; este dice
si **vuelven desde fuera**. Mide correlación, no intención — nadie ha dicho por
qué volvió —, pero distingue con precisión "volvió con el ranking movido" de
"volvió sin que nadie hubiera tocado nada", que es justo lo que interesa.

Cuando una métrica no tiene base suficiente devuelve `null` y su denominador,
en vez de un cero que parezca un resultado.

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
| **GRUPO** | Modo, estado de red, cola pendiente, miembros, día del servidor, **USAR RIVALES SIMULADOS**, forzar sync, salir del grupo |
| **METRICAS** | Revenge Rate, intentos, días completos, adelantamientos, reacción social, tramos por diferencia, últimos eventos, exportar/borrar |
| **ESTADO** | Semilla del día, configuración de cada reto, versión y estado del save, racha; reset/exportar/romper el save |

Además muestra FPS del juego y de la UI en una esquina.

---

## Pruebas

```bash
npm test                       # 221 pruebas (cliente + backend)
node tools/alfa.mjs            # ⭐ la prueba de este milestone (42 checks)
node tools/duel.mjs            # dos navegadores compitiendo de verdad (16 checks)
node tools/resilience.mjs      # offline, cola, servidor caído, ghost (20 checks)
node tools/ghost.mjs           # traza real de DRIFT y su fallback (6 checks)
node tools/flows.mjs           # producto en modo solo (33 checks)
node tools/playtest.mjs        # un bot juega a los cuatro juegos y mide las marcas
node tools/shots-social.mjs    # capturas del milestone social
node tools/screenshots.mjs     # capturas del modo solo
```

`alfa.mjs` va contra la build de producción servida por el propio servidor
(`npm run build && npm run server`), que es exactamente lo que se despliega.
Comprueba las seis cosas del milestone: un solo proceso, instalable, versión
nueva, errores registrados, dashboard de solo lectura, y dos móviles en
condiciones de red muy distintas.

Antes de nada comprueba que al otro lado hay un PLAYZONE de verdad, y si no,
para. Otra aplicación en ese puerto puede contestar un `{"status":"ok"}` con
buena pinta, y entonces la prueba estaría midiendo un servicio que no es.

> **`alfa.mjs` escribe en la base de datos**: crea grupos, jugadores y marcas,
> y provoca errores a propósito para comprobar que quedan registrados. No lo
> lances contra datos reales sin copia previa. Lo limpio es usar otra base:
> `PLAYZONE_DB=/tmp/alfa-prueba.db npm run server`

Las herramientas usan el Chromium que tenga instalado Playwright
(`npx playwright install chromium` si no hay ninguno). `PW_CHROME` fuerza uno
concreto.

El resto necesita `npm run dev:all` levantado (`resilience.mjs` va contra
`npm run preview`, que es donde vive el service worker).

> **Sobre "dos redes distintas"**: `alfa.mjs` emula dos redes asimétricas (una
> rápida y otra 3G con 400 ms de latencia) desde el mismo equipo, con CDP. Es
> una buena aproximación, pero **no sustituye** la prueba con dos iPhones de
> verdad, uno por Wi-Fi y otro por datos móviles con el Wi-Fi apagado. Esa está
> en el paso 5 del runbook y hay que hacerla a mano.

---

## Lo que este milestone NO hace

Login, email, OAuth, perfiles, chat, amigos globales, matchmaking, torneos,
notificaciones push reales, compras, anuncios, tienda, skins ni empaquetado
para App Store. Sigue siendo deliberado.

Y algo nuevo, también deliberado: **durante la semana de alfa no se añade ni un
minijuego, ni un mutador, ni una mecánica**. Está escrito y razonado en
[docs/CONGELADO.md](docs/CONGELADO.md). Si a mitad de semana aparece contenido
nuevo, la subida del día siguiente ya no dice nada: no se sabría si volvieron
por el pique o por la novedad, que es justo lo único que hay que distinguir.
