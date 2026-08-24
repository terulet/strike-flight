# FLIGHT STRIKE — Auditoría Fase 2

Estado del código a 2026-08-16, rama `claude/strike-flight-setup-7zx2b7`.

| Fase | Estado |
|---|---|
| **A · Auditoría** | ✅ hecha — este documento |
| **B · Bloque 1 · Música** | ✅ hecha — pendiente de prueba física de Eloi |
| **C · Bloque 2 · Guardado** | ✅ hecha — pendiente de prueba física de Eloi |
| D · Bloque 3 · VFX | ⬜ sin empezar |
| E · Bloque 4 · Hangar | ⬜ sin empezar |

## Lo que se hizo en la fase B

Seis bucles y cuatro cortes, 8,1 MB. Sistema en `js/music.js`,
preparación en `herramientas/preparar-musica.mjs`, cortes forjados en
`herramientas/audio/stingers.mjs`, 42 comprobaciones en
`herramientas/pruebas/musica.mjs`. Detalle en `THIRD_PARTY_AUDIO_LICENSES.md`.

Tres cosas que se encontraron por el camino y que no estaban en el plan:

1. **El juego no tenía música de derrota.** Era el único estado con la
   llamada sin poner (`golpe()`, `index.html:5216`). Puesta.
2. **El juego arrancaba mudo.** La portada no pedía música; la primera
   pista no entraba hasta elegir misión. Puesto.
3. **El servidor de pruebas no servía rangos HTTP**, así que cualquier
   salto de posición en un `<audio>` caía a 0 y la prueba de reanudación
   daba por roto lo que en un alojamiento de verdad funciona. Arreglado
   en `qa.mjs` — y, de paso, el sistema se rehízo para **no depender de
   saltos**, que es más robusto en cualquier caso.

Y una corrección a esta misma auditoría: la § 3.4 proponía
`decodeAudioData`, y con las pistas reales **no vale** (64 MB solo el
menú). Está reescrita con el motivo medido.

## Lo que se hizo en la fase C

`js/save.js`, esquema **v2**, 60 comprobaciones en
`herramientas/pruebas/guardado.mjs`. El detalle está en el README.

El bug de `misionIdx` (R2 de esta auditoría) **arreglado y con prueba
que lo vigila**: `campana.misionMax` y `campana.misionIdx` son campos
distintos, y el máximo solo se toca por `SAVE.subirMision()`, que hace
el máximo. No existe forma de bajarlo.

El riesgo R1 —subir `SAVE_VERSION` borraba todas las partidas— también
está cerrado: las migraciones se encadenan (v0 → v1 → v2) y **nunca se
descarta un save por su versión**, ni siquiera uno de una versión
posterior a la del juego.

Y un fallo que se encontró por el camino, heredado del bloque 1: había
**cuatro formas de empezar una misión y solo una ponía música**, así
que reintentar tras morir dejaba la partida MUDA —la derrota se lleva
la pista y nadie la devolvía—. La llamada se ha movido dentro de
`iniciarMision()`, que es por donde pasan todas.

---

---

## 1. ESTADO ACTUAL

### 1.1 Loop de juego

Un único `requestAnimationFrame` en `index.html:7165`.

```
loop(now)
  ├── dt real = min((now-last)/1000, 0.05)        techo de 50 ms
  ├── FPS suavizado cada 0,5 s
  ├── calidad automática (mide 3 s antes de decidir; baja en 1,5 s, sube en 12 s)
  ├── hitStop → dt = real * 0.06
  └── try { update(dt); render() } catch → se registra y SIGUE
```

Puntos que importan para lo que viene:

- **No hay paso fijo.** Todo es proporcional a `dt`. Cualquier sistema nuevo
  tiene que integrarse por `dt`, no por fotograma.
- **`update()` y `render()` están envueltos en `try/catch`** (`index.html:7206`).
  Una excepción en un sistema nuevo NO congela el juego, pero tampoco se ve:
  solo va a consola una vez. Los sistemas nuevos deben fallar en silencio por
  su cuenta, no confiar en esta red.
- **`hitStop` ralentiza `dt` global.** La música NO puede engancharse a `dt`:
  un hitstop de 120 ms desafinaría el tempo. La música va por `audio.currentTime`.
- **`paused`** solo lo consume `update()`; `render()` sigue dibujando. Un
  sistema nuevo que dibuje tiene que mirar `paused` si no debe animarse.

### 1.2 Misiones

Tabla de datos `MISIONES` (`index.html:1248`), 10 entradas:

```js
{ id, nombre, desc, temaId, armas:[...], eventos:[ {t, ...}, ... ] }
```

- `eventos` es una **línea de tiempo por segundos**. En `update()`
  (`index.html:5445`) se consumen mientras `elapsed >= ev.t`.
- `procesarEvento(ev)` (`index.html:4333`) es el despachador: oleadas,
  formaciones, hazards, defensas, zonas, pozos, carriles, sistemas, jefe.
- **Fin de misión** (`index.html:5451`): eventos agotados **y** sin jefe **y**
  `enemies.length === 0` **y** `spawnQueue.length === 0` → `cerrarMision()`.
- `cerrarMision()` (`index.html:5089`) calcula bonus, pone `misionCompletaT = 6.5`
  y suena `victoria`. Al llegar a 0 (`index.html:5457`) avanza o abre
  `campana-completa`.
- `iniciarMision(idx)` (`index.html:4291`) fija tema, hace `reset()` y pone
  `misionIniT = 2.6` (rótulo de entrada).

### 1.3 Bosses

Tabla `JEFES` (`index.html:319`), 10 entradas. Máquina de estados **compartida**
en `actualizarMiniboss()` (`index.html:4421`):

```
aviso (2,6 s)  →  entrada (1,9 s)  →  combate  ⇄  transicion  →  muriendo  →  ∅
                                        ↑                          │
                                        └── umbral de vida ────────┘
```

`muriendo` tiene tres tramos: fallos internos (1,9 s / 2,8 s si `epico`),
detonación principal, silencio y victoria (3,1 s / 4,6 s).

**Siete enganches opcionales por jefe**: `onSpawn`, `onEntrada`, `reduccionDano`,
`onDetonar`, `onMuerte`, `dibujarExtra`, `epico`. Y por fase: `alEntrar`, `furia`,
`final`, `umbral`, `ojo`, `mover`, `ataques[]`.

Esto es lo mejor que tiene el proyecto para lo que viene: **la música y los VFX
de jefe se enganchan aquí sin tocar ningún jefe concreto.**

### 1.4 Guardado — lo que hay hoy

Clave `sf_save` en `localStorage`. `SAVE_VERSION = 1`.

| Campo | Dónde se escribe |
|---|---|
| `v` | siempre |
| `record` | `cerrarMision`, `golpe` (game over) |
| `temaId` | `iniciarMision`, selector de supervivencia |
| `naveId` | selector de naves, borrado de nave custom |
| `misionIdx` | al completar misión |
| `opciones` | `guardarOpciones()` |
| `campaignCompleted`, `campaignStats` | al terminar M10 |

Aparte: `sf_naves` (naves cargadas por el jugador, dataURL, máx. 4) y las claves
legacy `sf_record` / `sf_tema` / `sf_nave` / `sf_misionIdx`, que solo se leen.

**Lo que NO se guarda hoy:** records por misión, estadísticas por misión,
naves desbloqueadas (hoy están las 5 abiertas desde el principio),
personalización, mejoras, moneda, misión en curso, fecha del último guardado.

**Cómo se comporta:**

- `guardarSave(campos)` hace `Object.assign` sobre lo que ya hay → guardado
  parcial, no destructivo. Bien.
- `cargarSave()` devuelve `{}` si el JSON es inválido **o si `v` no coincide**.
  → **No hay migración: subir `SAVE_VERSION` a 2 borra todas las partidas.**
- El bloque de carga inicial (`index.html:4219`) ya es defensivo: acota volúmenes
  a [0,1], levanta el master y el de efectos si quedaron a 0, valida tipos de
  `opciones` uno a uno y acota `misionIdx` al rango. Es un buen precedente y hay
  que extenderlo, no rehacerlo.

**BUG DE PROGRESO — confirmado, no hipotético:**
`misionIdx` es a la vez «misión seleccionada» y «máxima desbloqueada»
(`index.html:6449`, `bloq = i > misionIdx`). Al elegir una misión antigua se hace
`misionIdx = i` (`index.html:6454`) y al completarla se guarda `misionIdx = i+1`
(`index.html:5472`).

> Con las 10 misiones desbloqueadas, rejugar la M3 y terminarla deja el save en
> `misionIdx = 3` y **vuelve a bloquear de la M5 a la M10.**

Separar `misionMax` de `misionIdx` es requisito del Bloque 2, no un extra.

### 1.5 Estructura del jugador / nave

`player` es **solo geometría** (`index.html:4268`):

```js
player = { x, y, r:16, px, retro, empuje }
```

Todo el estado real del jugador son variables globales sueltas:
`lives · escudo · arma · armaId · bombas · turbo · combo · comboT · invulnT ·
dobleT · imanT · sinDanio · comboHito`.

La ficha de nave es `NAVES[]` (`index.html:1756`), 5 entradas:

| id | arma | vel | cad | dmg | hitbox | escudo | motor |
|---|---|---|---|---|---|---|---|
| `clasica` | cannon | 1.00 | 1.00 | 1.00 | 1.00 | 0 | `#ffcf5c` |
| `kali` | cannon | 0.86 | 1.14 | 1.38 | 1.10 | 0 | `#ff7a1f` |
| `yoli` | rapid | 1.32 | 0.88 | 0.82 | 0.78 | 0 | `#7df9ff` |
| `silvia` | electrico | 1.08 | 0.96 | 1.00 | 0.84 | 1 | `#c77dff` |
| `eloi` | fuego | 1.10 | 0.82 | 1.20 | 1.25 | 0 | `#ff3d1a` |

Más `stats:{ATAQUE,VELOCIDAD,CONTROL}` (solo visual), `lema`, `desc`, `src`, `fija`.

- `naveActual()` está **cacheado por índice** (`index.html:1792`) porque `hitR()`
  lo llama una vez por bala enemiga y fotograma. Cualquier campo nuevo que
  dependa de la personalización tiene que invalidar `nvCache`.
- `naveSel` es un **índice**, pero se persiste por `id` — porque las naves
  cargadas por el jugador se añaden al final del array y mueven los índices.
- Las 4 naves con arte se dibujan desde `SPRITES[nv.id]` (`index.html:5698`).
  El motor/llama se dibuja por código con `nv.motor`.

**Ya hay diferencias de balance entre naves.** No es cosmético hoy: KALI pega
un 38 % más, YOLI tiene la hitbox al 78 %. La campaña está calibrada con el
piloto automático usando la nave por defecto (`naveSel = 1`, KALI).

### 1.6 VFX que ya existen

Más de lo que parece. El Bloque 3 es **subir el listón sobre esto**, no partir de cero.

| Sistema | Dónde | Reserva / tope |
|---|---|---|
| Partículas | `part()` `index.html:4807` | pool `libresPart`, tope `Q.maxPart` (420/240/120) |
| Explosión radial | `boom()` | escala por `Q.part` |
| Restos con gravedad | `restos()` | solo si `Q.estela` |
| Efectos de sprite | `vfx()` `index.html:4845` | pool `libresFx`, **tope duro 60** |
| Muertes tipadas | `MUERTES` `index.html:4892` | 10 tipos, escalan por enemigo |
| Impactos tipados | `IMPACTOS` `index.html:4922` | 5 pesos |
| Ondas de choque | `onda()` | tope 14 |
| Sacudida | `SACUDIDAS` 5 niveles | `OPCIONES.sacudida` |
| Congelado | `hitstop()` | `OPCIONES.hitstop` |
| Fogonazo de boca | `fogonazo()` `index.html:5250` | — |
| Telégrafos | `telegrafo()` `index.html:3115` | — |
| Flash de pantalla | `flash` global | — |
| Texto flotante | `texto()` | — |
| Estelas de bala | dentro de `render()` | por `Q.estela` |

Arte disponible sin usar del todo: `art/vfx/` (15 PNG) y `art/impactos/` (10 PNG),
ya recortados en alfa por brillo para pintarse en aditivo.

**Escalones de calidad ya existen**: `CALIDADES = {alta, media, baja}` con
`{part, estela, glowSprite, maxPart, sombras}` y auto-degradado por FPS. La opción
«VFX alto/medio/bajo» del brief **ya está ahí** como CALIDAD; hay que decidir si
se renombra o se añade un eje aparte.

**Defecto encontrado:** `IMPACTOS.rotura` está declarado **dos veces**
(`index.html:4932` y `4933`). El primero es código muerto; el que manda es el
segundo (`escudo_roto`, sonido `emp`). Cosmético, pero conviene limpiarlo.

### 1.7 Pantallas y UI

Todo es canvas. No hay DOM salvo el `<canvas>` y un `<input type=file>` oculto.

- `state`: `menu` · `play` · `over`
- `pantalla` (solo con `state === "menu"`): `inicio` · `naves` · `campana` ·
  `mundos` · `ajustes` · `campana-completa`
- Overlays dentro de `render()`: pausa, misión completada, WARNING de jefe,
  rótulo de inicio de misión, fin de partida, overlay de `?debug`

**Los botones son inmediatos**: `boton()` (`index.html:6159`) dibuja **y** empuja
un rect a `botones[]` cada fotograma; `pointerdown` recorre `botones` **al revés**
(lo último dibujado gana). Añadir una pantalla nueva son ~40 líneas y cero
fontanería. Esto hace el HANGAR barato.

### 1.8 Audio — lo que hay

Muy sólido. Es la mejor base del proyecto.

```
BUS.master ──► compresor ──► techo (waveshaper) ──► destination
   ├── BUS.sfx   ──► GRP.{disparo,enemigo,impacto,explosion,jefe,sfx}
   ├── BUS.ui    ──► GRP.ui
   └── BUS.musica ──► (VACÍO, nadie cuelga de aquí)
```

- `BUS.musica` **ya existe, ya está conectado y ya obedece a `OPCIONES.volMusica`**
  (`aplicarVolumenes()`, `index.html:2243`). Está esperando a que alguien se cuelgue.
- Ciclo de vida iOS resuelto: `unlockAudio()` con `golpeSilencioso()`, reintento
  desde cualquier gesto, `visibilitychange` + `pageshow` + `focus` → `reanudarAudio()`,
  y estado `interrupted` contemplado.
- `agachar(fuerza, dur)` (`index.html:2257`) ya hace ducking por grupos. El brief
  pide «bajar la música en explosiones de jefe»: **es añadir `musica` a `GRUPOS`**
  con su factor, no un sistema nuevo.
- 71 sonidos, 124 archivos, MP3 mono en base64 (`audio/muestras.js`, 374 kB),
  fabricados por `herramientas/forjar-audio.mjs` con `herramientas/audio/dsp.mjs`
  (taller DSP completo: osciladores, filtros, saturación, colas, limitador,
  medición LUFS-ish, WAV, ruido reproducible con semilla).

**`musica()` hoy es un esqueleto** (`index.html:2817`):

```js
const PISTAS = { menu:null, combate:null, jefe:null, victoria:null, derrota:null };
```

Crea un `new Audio(src)` suelto, **fuera del grafo WebAudio** — no pasa por
`BUS.musica`, así que hoy no respetaría el ducking ni el mute por bus (sí el
volumen, porque lo aplica a mano). No hay crossfade. No hay reanudación tras
background. **Hay que reescribirlo**, no rellenarlo.

**Llamadas a `musica()` que ya existen** (esto es oro — la mitad del Bloque 1
ya está cableada):

| Momento | Línea | Llamada |
|---|---|---|
| Aparece el jefe | `4386` | `musica("jefe")` |
| Muere el jefe | `4509` | `musica(epico ? "victoria" : "combate")` |
| Misión completada | `5103` | `musica("victoria")` |
| Campaña completada | `5468` | `musica("victoria")` |
| Vuelta al menú tras misión | `5473` | `musica("menu")` |
| Empezar misión | `6454` | `musica("combate")` |
| Empezar supervivencia | `6502` | `musica("combate")` |
| Botón del fin de partida | `6965` | `musica("menu")` |
| Abandonar desde pausa | `7117` | `musica("menu")` |

**Huecos**: no suena nada al arrancar el juego (el menú inicial no llama a
`musica()`), **no hay `musica("derrota")` en ningún sitio** (`golpe()` /
`state = "over"`, `index.html:5216`), y no hay estados `hangar`, `unlock` ni
`mision_completa`.

### 1.9 Herramientas y pruebas

- `herramientas/qa.mjs` — servidor estático + Playwright, iPad/iPhone simulados,
  captura consola, 404 y excepciones. **Comprueba la sintaxis de `index.html`
  antes de arrancar.** Expone `abrir/jugar/saltarA/captura/estado/informe`.
- 17 guiones en `herramientas/pruebas/` (misiones, jefes, duraciones, audio ×5,
  aguante, pantallas, campaña final).
- `herramientas/servir.mjs` — servidor de red local para probar en iPad real.
- **Los FPS de las pruebas headless no valen** (Chromium sin ventana compone por
  software, ~20 fps siempre). Para rendimiento, iPad real.

---

## 2. RIESGOS

Ordenados por lo que costaría arreglarlos si se descubren tarde.

| # | Riesgo | Impacto | Mitigación |
|---|---|---|---|
| R1 | **Subir `SAVE_VERSION` borra todas las partidas** (`cargarSave` devuelve `{}` si `v` no coincide) | Pérdida total de progreso del jugador | Escribir `migrar(s)` ANTES de tocar la versión. Nunca descartar por versión: migrar o conservar campos conocidos |
| R2 | **`misionIdx` sirve para dos cosas** → rejugar retrocede el progreso | Ya está pasando hoy | Separar `misionMax` (desbloqueo) de `misionIdx` (selección). Al migrar, `misionMax = max(misionIdx guardado, misionMax)` |
| R3 | **Memoria de audio en iPad.** Una pista decodificada de 32 s mono a 32 kHz son ~4 MB de `Float32Array`. Ocho pistas a la vez = 32 MB solo de música | Safari mata la pestaña | Bucles cortos, mono, decodificación bajo demanda, liberar lo que no está sonando, máximo 3 búferes vivos |
| R4 | **Los VFX pueden tapar las balas** — es la prioridad explícita del brief | Juego injugable, no feo | Regla de capas: TODO VFX nuevo se pinta ANTES de las balas o con `alpha ≤ 0.5`; las balas se pintan siempre las últimas. Prueba automática que cuente píxeles sobre las balas |
| R5 | **`vfx()` tiene tope duro de 60 y `part()` de `Q.maxPart`.** Subir el listón visual sin subir topes = efectos que no salen; subirlos sin medir = 30 fps en iPad | Se pierde el objetivo de 60 fps | Presupuesto por fotograma, no por objeto. Contadores en `?debug` desde el primer día |
| R6 | **`index.html` tiene 7 217 líneas / 350 kB.** Cuatro bloques dentro = inmanejable | Deuda | Sacar los sistemas nuevos a `<script src>` CLÁSICO (nunca módulos ES: `file://` los bloquea por CORS) |
| R7 | **Bloquear naves que hoy están abiertas** rompe la expectativa de quien ya juega | Regresión percibida | Grandfathering en la migración: quien tenga `misionMax > 0` conserva lo que ya usaba. Solo se bloquea lo NUEVO |
| R8 | **La música con `file://`.** `fetch()` está prohibido, así que `decodeAudioData` no puede leer un MP3 del disco | Sin música al abrir con doble clic | Ya documentado como excepción aceptable. Añadir fallback `<audio>` (sin crossfade) para que al menos suene |
| R9 | **La campaña está calibrada con piloto automático y con KALI.** Naves nuevas con estadísticas propias = recalibrar 10 misiones | Trabajo escondido | Bloque 4 arranca COSMÉTICO. Estadísticas nuevas solo tras prueba física |
| R10 | **`hitStop` deforma `dt`.** Un sistema de música o VFX que use `dt` se desincroniza | Música desafinada, VFX a tirones | La música usa `audio.currentTime`. Los VFX pueden usar `dt` (deben: el hitstop tiene que congelarlos también) |
| R11 | El `try/catch` del bucle **esconde** los fallos de sistemas nuevos | Bugs invisibles | Cada sistema nuevo con su propio `try/catch` y su contador visible en `?debug` |

---

## 3. ARQUITECTURA PROPUESTA

### 3.1 Regla de oro

`<script src>` **clásicos**, cargados antes del bloque en línea, en este orden:

```html
<script src="audio/muestras.js"></script>   <!-- ya existe -->
<script src="js/save.js"></script>
<script src="js/music.js"></script>
<script src="js/vfx.js"></script>
<script src="js/ships.js"></script>
<script src="js/hangar.js"></script>
<script>  <!-- el juego, como hoy -->
```

Nada de `type="module"`, nada de `import`, nada de bundler. Cada archivo declara
un objeto global (`SAVE`, `MUSICA`, `VFX`, `SHIPS`, `HANGAR`) y **nada más**.

### 3.2 Contrato de dependencias

El problema real: `js/*.js` se ejecuta ANTES que el juego, así que **no puede
leer `W`, `H`, `ctx`, `OPCIONES`, `player`...** en el momento de cargarse.

Solución: cada módulo expone `init(api)` y el juego lo llama cuando ya existe todo.

```js
// en index.html, justo después de crear los buses de audio
MUSICA.init({
  ctx:      () => audio,
  bus:      () => BUS.musica,
  opciones: OPCIONES,
  log:      (m) => { musicaDbg.motivo = m; },
});
```

Ventaja: si un archivo falta, `typeof MUSICA === "undefined"` y el juego arranca
igual con un adaptador vacío. **Ningún sistema nuevo puede impedir el arranque.**

### 3.3 `js/save.js` — el que va primero

Es la base de los otros tres. API:

```js
SAVE.cargar()                  // objeto validado y migrado, nunca lanza
SAVE.set(campos)               // fusión + autosave con debounce (500 ms)
SAVE.get(clave, porDefecto)
SAVE.borrar()                  // con confirmación desde la UI, no aquí
SAVE.estado()                  // { ok, version, ultimo, migrado, bytes, error }
```

Esquema v2 (v1 se migra, no se descarta):

```js
{
  v: 2,
  campana: { misionMax, misionIdx, completada, stats, records: { "m01": {...} } },
  perfil:  { record, eloi, tiempoJugado },
  naves:   { seleccionada, desbloqueadas:[...], skins:{}, colores:{} },
  opciones: { ...OPCIONES },
  meta:    { creado, ultimoGuardado, versionJuego }
}
```

`migrar(s)`: si `s.v === 1` → mapea campo a campo y **conserva lo desconocido**.
Si `s.v` es mayor que la actual (el jugador volvió a una versión vieja) → se
LEE lo que se entienda y no se sobrescribe hasta que el jugador juegue.

### 3.4 `js/music.js` — arquitectura de reproducción

> **Corregido tras medir las pistas reales del pack.** La primera versión de
> esta auditoría proponía `decodeAudioData` + `AudioBufferSourceNode`. **No
> vale con estas pistas.** Duran entre 34 s y 3:12, y una pista estéreo de
> 44,1 kHz decodificada ocupa 10,6 MB por minuto:
>
> | Pista | Duración | Decodificada |
> |---|---|---|
> | `menu_hangar` | 3:12 | **64,6 MB** |
> | `hangar_alt` | 2:38 | **53,1 MB** |
> | `boss` | 1:42 | **34,5 MB** |
> | `mission_a` | 1:22 | **27,7 MB** |
> | `final_boss` | 0:34 | **11,4 MB** |
>
> Un crossfade menú→combate tendría 92 MB de audio vivo a la vez. Safari en
> iPad mata la pestaña. Esto era el riesgo R3 y es peor de lo estimado.

**Ruta A — `<audio>` + `createMediaElementSource` → `BUS.musica`.**

El elemento **transmite**: no decodifica la pista entera en memoria, así que el
coste es de kilobytes en vez de decenas de megas. Y al pasar por
`createMediaElementSource` entra en el grafo que ya existe, con lo que
**mute, `volMusica` y `agachar()` salen gratis**, igual que con búferes.

Dos elementos y dos ganancias en paralelo (doble búfer): uno suena, el otro
precarga la siguiente. Con eso salen las tres cosas que hacen falta:

- **crossfade** de potencia constante entre estados (0,5–1,5 s),
- **bucle sin costura**, cruzando la pista consigo misma antes del final en vez
  de confiar en `loop` del elemento (que en Safari deja un hueco audible),
- **reanudación tras background** desde `currentTime`, con entrada de 200 ms.

**Ruta B (`file://`, doble clic):** el mismo `<audio>` pero **sin**
`createMediaElementSource` — en Chrome un medio de origen `file:` se considera
opaco y el nodo saldría mudo. Se controla el volumen por `el.volume` y se
renuncia al ducking. Detección por `location.protocol`, anotada en `?debug`.

**Peso de descarga:** reencodadas a VBR ~130 kbps las cinco pistas suman
**9,0 MB** (desde 22,8 MB de los originales a 320 kbps). Se cargan bajo
demanda, nunca todas al arrancar: menú primero, la de combate al entrar en
misión, la de jefe al lanzar el aviso del jefe — que da 2,6 s de margen, más
que suficiente.

**Modelo de estados y capas:**

```
MUSICA.estado("menu" | "combate" | "jefe" | "jefe_final" | "victoria"
              | "mision" | "derrota" | "hangar" | "unlock")
MUSICA.intensidad(0..1)     // capa que se suma sin cambiar de pista
MUSICA.duck(fuerza, dur)    // la explosión de jefe la aparta
```

- Los bucles (`menu`, `combate*`, `jefe`, `hangar`) se cruzan con fundido
  equal-power de 1,2 s.
- Los cortes (`victoria`, `derrota`, `unlock`, `mision`) son **stingers**: no
  hacen bucle, agachan el bucle de fondo y lo devuelven al terminar.
- `jefe` = base + capa de fase final. La capa entra por `intensidad()` cuando
  `mb.fase` es la última o `f.final` — engancha en `cambiarFase()`, un solo sitio.
- Varias pistas de combate: se elige por `MISIONES[i].temaId` o por índice de
  misión, para que M1 y M6 no suenen igual.

**Ducking:** añadir `musica: { agacha: 0.55 }` a `GRUPOS` y colgar `BUS.musica`
del mecanismo de `agachar()`. Cero código nuevo de ducking.

**Background/iOS:** `MUSICA` se suscribe a los mismos `visibilitychange` /
`pageshow` / `focus` que ya existen. Al volver: si el contexto se levantó,
reanudar la pista **desde donde estaba** (`offset` guardado con `audio.currentTime`),
con fundido de entrada de 200 ms para que no chasque.

### 3.5 De dónde sale la música

**Decidido: el pack CC0 de OpenGameArt** (`FLIGHT_STRIKE_AUDIO_PACK_CLAUDE.zip`).
Cinco pistas, las cinco verificadas CC0 en la página de origen el 2026-08-16.
Ficha completa, hashes y medidas en la tabla de verificación (§ 3.5.1).

Queda descartada la alternativa de forjarlas con `dsp.mjs`. Sigue siendo viable
si más adelante hace falta una pista concreta que no exista con licencia limpia
—el taller está montado y `music.js` no distingue de dónde salió un MP3— pero
no es el camino por defecto.

**Lo que el pack NO cubre y hay que resolver aparte:**

- **Stingers**: `victoria`, `mision_completa`, `derrota`, `unlock`. El pack solo
  trae bucles. Son piezas de 3–7 s. Aquí sí conviene forjarlas con `dsp.mjs`,
  afinadas a la tonalidad de las pistas del pack, porque un stinger CC0 de otro
  autor va a chocar de estilo.
- **Variedad de combate**: solo hay UNA pista de combate para diez misiones de
  5–8 minutos. `Synth Wave` puede hacer de segunda si se acepta que el menú y
  la misión B compartan tema, pero seguirían siendo dos para diez misiones.
- **Capa de intensidad de fase final**: las pistas son mezclas planas, no traen
  stems. La subida de intensidad hay que hacerla con filtro y ganancia sobre la
  propia pista (paso alto que se abre, +1,5 dB), no con una capa aparte.

#### 3.5.1 Tabla de verificación

Descargado y comprobado el 2026-08-16. Nada integrado todavía.

| # | Asset | Autor | Licencia verificada | Tamaño orig. → opt. | Duración | Formato | Loop | Escena propuesta | Decisión |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Space Shooter (Loop) | Pro Sensory / Alex McCulloch | **CC0** ✓ en página | 3,2 MB → 1,6 MB | 1:22 | MP3 320k → VBR ~130k, 44,1 kHz estéreo | **Sí** (el propio título lo dice; cola −17,9 dB sin fundido a silencio) | Combate normal | **USAR** |
| 2 | Synth Wave | Pro Sensory / Alex McCulloch | **CC0** ✓ en página | 7,5 MB → 3,2 MB | 3:12 | MP3 320k → VBR ~130k | **Sí** con crossfade (cola −20,6 dB) | Menú + hangar | **USAR** |
| 3 | Trance Boss Battle | MintoDog | **CC0** ✓ en página | 4,0 MB → 1,7 MB | 1:42 | MP3 320k → VBR ~130k | **Sí**, declarado por el autor. 102,400 s exactos = 64 compases a 150 BPM | Jefe | **USAR** |
| 4 | Boss Battle 10 [Retro] | nene | **CC0** ✓ en página | 1,9 MB (OGG) → 0,5 MB | 0:34 | **OGG Vorbis** → transcodificar a MP3 | Probable (cola −21,3 dB) | Jefe final / fase final | **RESERVA — requiere escucha** |
| 5 | Calm Ambient 1 (Synthwave 4k) | The Cynic Project | **CC0** ✓ en página | 6,2 MB → 2,0 MB | 2:38 | MP3 320k → VBR ~130k | **No tal cual**: entra a −51,5 dB y acaba a −69,7 dB (fundidos largos). Hay que recortar o cruzar con 4 s | Hangar / pausa | **USAR recortada** |
| 6 | Kenney Sci-Fi Sounds | Kenney | **CC0** ✓ | — | — | OGG | — | Refuerzo de SFX | **YA INTEGRADO** — no tocar |

**Sonoridad medida (EBU R128 integrada):**

| Pista | LUFS | LRA | Pico |
|---|---|---|---|
| Trance Boss | −11,5 | 1,7 LU | −1,0 dBFS |
| Synth Wave | −12,5 | 4,9 LU | **+0,2 dBFS** |
| Space Shooter | −14,6 | 1,0 LU | 0,0 dBFS |
| Boss 10 Retro | −16,0 | 2,7 LU | 0,0 dBFS |
| Calm Ambient | −18,0 | 6,9 LU | 0,0 dBFS |

Hay **6,5 LU de diferencia** entre la más fuerte y la más floja: sin normalizar,
pasar del hangar al jefe sería un salto de volumen brutal. Se normalizan todas a
**−16 LUFS** en el reencodado, y a partir de ahí el jefe sube sus +1,5 dB por
mezcla, no por casualidad. `Synth Wave` además pica por encima de 0 dBFS y hay
que bajarla sí o sí.

**Incidencias de descarga:**

- La URL de MP3 del jefe que trae el manifiesto
  (`trance_boss_battle_bpm150_0.mp3`) devuelve **404**. El archivo real es
  `trance_boss_battle_bpm150.mp3`, sin el sufijo `_0` — descargado y verificado.
- `Boss Battle 10 [Retro]` **no tiene MP3** en origen (solo `.wav`, `.ogg` y
  `.mid`). Hay que transcodificar: **OGG Vorbis no lo descodifica Safari de
  iOS**, que es exactamente la razón por la que todo el banco de efectos es MP3.

**Riesgo abierto (#4):** el brief dice «nada 8-bit barato» y esta pista se
titula literalmente *[Retro]*. Está pendiente de escucha antes de integrarla.
Si no encaja, el jefe final se queda con `Trance Boss Battle` y la fase final se
distingue por filtro y ganancia.

**Créditos a publicar** (ninguno obligatorio bajo CC0; se ponen igual, como ya
se hace con Kenney): Alex McCulloch · MintoDog · nene · The Cynic Project /
cynicmusic.com / pixelsphere.org · Kenney.

### 3.6 `js/vfx.js`

Envuelve lo que ya hay, no lo sustituye. Añade:

- **Presupuesto por fotograma**, no por objeto: `VFX.presupuesto()` devuelve
  cuántas partículas quedan este fotograma. Un jefe explotando no puede robarle
  el presupuesto a las balas del jugador durante los siguientes 300 ms.
- **Capas explícitas de dibujo** con la regla de legibilidad:

  ```
  fondo · VFX_FONDO · enemigos · jugador · VFX_MEDIO · BALAS · VFX_FRENTE(α≤0.5) · HUD
  ```

  Las balas **siempre** por encima del VFX opaco. `VFX_FRENTE` limitado en alfa
  y sin sprites grandes en el corredor central.
- Pools nuevos: chispas, debris, shockwaves, muzzle, trails — todos con
  `libres[]` como los actuales.
- `VFX.nivel = "alto" | "medio" | "bajo"` como **eje aparte de CALIDAD**
  (CALIDAD sigue siendo el auto-degradado por FPS; VFX es la preferencia del
  jugador). El efectivo es el mínimo de los dos.

### 3.7 `js/ships.js` + `js/hangar.js`

- `ships.js`: la tabla `NAVES` sale de `index.html` y se le añaden
  `desbloqueo:{ tipo, valor }` y `skins:[...]`. `naveActual()` se queda en
  `index.html` (lo llama el bucle caliente) pero lee de `SHIPS.tabla`.
- `hangar.js`: una `pantalla` más (`pantalla === "hangar"`), con la misma
  fontanería de `boton()`. Nada nuevo que aprender.
- Skins por **tinte**, no por PNG nuevo: pintar el sprite y encima el mismo
  sprite en `lighter` con el color de la skin. Es lo que ya hace el fogonazo
  blanco de impacto (`project-assets` lo documenta), así que hay precedente.

---

## 4. ARCHIVOS A TOCAR

| Archivo | Bloque | Qué |
|---|---|---|
| `index.html` | 1 | Añadir `<script src="js/music.js">`; sustituir `musica()`/`PISTAS` (`2810-2827`) por la llamada a `MUSICA`; añadir `musica` a `GRUPOS` (`2098`); llamar `MUSICA.init()` tras crear buses (`2180`); añadir `musica("derrota")` en game over (`5216`); llamar `musica("menu")` al arrancar; capa de jefe en `cambiarFase()` (`4396`); bloque MÚSICA en `?debug` (`7135`) |
| `index.html` | 2 | `<script src="js/save.js">`; sustituir `cargarSave`/`guardarSave` (`4194-4216`) por `SAVE`; separar `misionMax` de `misionIdx` (`5471`, `6449-6454`); botón «Borrar progreso» en `pantallaAjustes()` (`6565`); bloque SAVE en `?debug` |
| `index.html` | 3 | `<script src="js/vfx.js">`; reordenar las capas de `render()` (`6710`); enganchar `muerte()`/`impacto()`/`disparar()`/máquina de jefe a los pools nuevos; opción VFX en `pantallaAjustes()`; contadores en `?debug` |
| `index.html` | 4 | `<script src="js/ships.js">` y `hangar.js`; `NAVES` pasa a `SHIPS.tabla`; `pantalla === "hangar"` en `menu()` (`6664`); botón HANGAR en `pantallaInicio()` (`6270`); `dibujarNave()` (`5691`) y `naveEscaparate()` (`6231`) leen la skin |
| `herramientas/qa.mjs` | 1-4 | `estado()` devuelve además música, save y contadores VFX |
| `THIRD_PARTY_AUDIO_LICENSES.md` | 1 | Sección de música: fuente, licencia, archivo, uso |
| `README.md` | 1-4 | Bloques nuevos |
| `AUDITORIA.md` | 1-4 | Al cerrar cada bloque |
| `.gitignore` | 1 | `audio/.forja-musica/` |

## 5. ARCHIVOS NUEVOS

| Archivo | Bloque | Aprox. |
|---|---|---|
| `js/save.js` | 2 | 250 líneas |
| `js/music.js` | 1 | 350 líneas |
| `js/vfx.js` | 3 | 500 líneas |
| `js/ships.js` | 4 | 200 líneas |
| `js/hangar.js` | 4 | 350 líneas |
| `herramientas/preparar-musica.mjs` | 1 | 180 líneas — recorta, normaliza a −16 LUFS, transcodifica OGG→MP3, reencoda y escribe el manifiesto. Determinista, igual que el forjador de efectos |
| `herramientas/audio/stingers.mjs` | 1 | 150 líneas — victoria · misión · derrota · unlock, forjados con `dsp.mjs` (el pack no los trae) |
| `audio/musica/*.mp3` | 1 | 5 bucles del pack (~9 MB) + 4 stingers forjados (~120 kB) |
| `audio/fuentes/musica/` | 1 | los originales sin tocar, con su licencia, como ya se hace con Kenney |
| `audio/MUSICA.json` | 1 | manifiesto: fuente, autor, licencia, URL, SHA-256 de origen y de salida, duración, LUFS, punto de bucle |
| `herramientas/pruebas/musica.mjs` | 1 | estados, crossfade, mute, background |
| `herramientas/pruebas/guardado.mjs` | 2 | migración, corrupto, borrado, arranque |
| `herramientas/pruebas/vfx-legibilidad.mjs` | 3 | píxeles de bala tapados |
| `herramientas/pruebas/hangar.mjs` | 4 | desbloqueos, selección, persistencia |

## 6. PLAN POR FASES

```
FASE A   Auditoría                                    ← estás aquí
FASE B   BLOQUE 1 · MÚSICA                            → PARAR, prueba física de Eloi
FASE C   BLOQUE 2 · GUARDADO
FASE D   BLOQUE 3 · VFX
FASE E   BLOQUE 4 · HANGAR Y NAVES
```

**Fase B, en cinco pasos con punto de parada en cada uno:**

1. `js/music.js` con el sistema completo y **sin pistas** — se comprueba que
   los estados cambian, que el fallback funciona y que nada se rompe.
2. Secuenciador + una pista (`combate_a`). Se escucha. Si el sonido no vale,
   se para aquí y se replantea el origen de la música.
3. El resto de las pistas.
4. Enganches: capa de jefe, ducking, stingers, `derrota`, música al arrancar.
5. Pruebas + documentación de licencias + capturas.

**Un bloque = un commit por paso.** Nada se mezcla entre bloques.

## 7. QUÉ PODEMOS HACER SIN TOCAR EL GAMEPLAY

Todo esto es aditivo. Ninguna física, ningún control, ninguna dificultad,
ningún comportamiento de enemigo:

- **Bloque 1 entero.** La música no toca el juego. Los enganches que se añaden
  (`musica("derrota")`, capa de jefe) son llamadas a un sistema aislado.
- **Bloque 2 entero.** Guardar más campos no cambia nada. Arreglar el bug de
  `misionIdx` **devuelve** progreso, no lo altera. El botón de borrar es opt-in
  con confirmación.
- **Bloque 3 casi entero**, con una condición: los VFX no pueden cambiar la
  legibilidad. Partículas, glow, shockwaves, debris, aura de jefe, escudo
  visible — todo decorativo. `sacudida` y `hitstop` **ya son opciones del
  jugador** y no se tocan.
- **Bloque 4 en su versión cosmética**: pantalla HANGAR, selección de nave,
  skins, colores, estelas, desbloqueos de naves **que hoy no existen**.
- Limpiar el `IMPACTOS.rotura` duplicado.
- Contadores de rendimiento en `?debug` (frame time, partículas, voces, memoria).

## 8. QUÉ REQUERIRÍA TOCAR EL GAMEPLAY

Nada de esto entra sin tu OK explícito:

1. **Bloquear naves que hoy están disponibles.** Hoy las 5 están abiertas desde
   el primer arranque. Si KALI o YOLI pasan a desbloquearse en la M2/M5, la
   primera partida de un jugador nuevo cambia. *(Propuesta: bloquear solo lo
   nuevo, y grandfathering para los saves existentes.)*
2. **Estadísticas distintas en naves nuevas.** Las 5 actuales ya alteran el
   balance (KALI +38 % daño, YOLI hitbox 0.78). Una nave nueva con estadísticas
   propias hay que medirla contra las 10 misiones con `duracion-*.mjs`.
3. **Personalización que afecte a algo más que al color.** Un motor/estela con
   hitbox o alcance distinto es balance, no cosmética.
4. **Bajar la música en explosiones de jefe** si se hace tan agresivo que el
   aviso sonoro del jefe se pierde. Es mezcla, pero afecta a la información.
5. **Subir los topes de partículas** para VFX más grandes: si el iPad baja de
   60 fps, la ventana de esquiva cambia de verdad. Se mide antes.
6. **Mission select con `misionIdx` separado** cambia cuál es la misión
   «actual» al abrir la campaña. Es una mejora, pero es un cambio visible.

## 9. COMPLEJIDAD ESTIMADA

| Bloque | Complejidad | Dónde está el trabajo | Riesgo |
|---|---|---|---|
| **1 · Música** | **Media-alta** | El sistema de reproducción es 1 día; **fabricar música que no canse en 15 minutos es lo caro**. El 70 % del esfuerzo es componer, no programar | Medio — el riesgo es artístico, no técnico |
| **2 · Guardado** | **Baja-media** | Sistema sencillo y bien acotado. Lo delicado es la **migración v1→v2 sin perder partidas** y el bug de `misionIdx` | Bajo, si la migración se prueba con saves reales antes |
| **3 · VFX** | **Alta** | Muchos enganches repartidos por todo `index.html`, y el requisito de legibilidad obliga a revisar el orden de dibujo entero. Más el presupuesto de rendimiento en iPad | **Alto** — es el bloque que puede romper la sensación del juego y los FPS |
| **4 · Hangar** | **Media** (cosmético) / **Alta** (con balance) | La pantalla y la persistencia son baratas gracias a `boton()`. Lo caro es **decidir y calibrar** naves nuevas | Bajo en cosmético, alto si toca balance |

**Orden recomendado, que coincide con el tuyo**, con un matiz: el Bloque 2
(guardado) es prerrequisito real del Bloque 4 (hangar) y conviene que esté
hecho antes de que haya desbloqueos que persistir. El Bloque 3 es el más
peligroso y se beneficia de ir el último de los tres «grandes», con el resto
ya estable.

---

## PREGUNTAS ABIERTAS

1. **¿Qué es «ELOI» en la lista de guardado del Bloque 2?** En el Bloque 4
   aparece como nave jugable (y existe en `NAVES` con arte propio), pero en el
   Bloque 2 va listado entre `puntuación máxima` y `records por misión`, donde
   parecería una moneda o un contador. Cambia el diseño del save y del hangar.
2. ~~Origen de la música~~ — **RESUELTO** por
   `FLIGHT_STRIKE_AUDIO_PACK_CLAUDE.zip`: pack CC0 de OpenGameArt, cinco pistas
   verificadas en origen. Ver § 3.5.
3. **¿Entra `Boss Battle 10 [Retro]`?** Pendiente de escucha. El brief prohíbe
   el «8-bit barato» y la pista se llama *[Retro]*. Clips en
   `JOCS/FLIGHT_STRIKE_MUSICA_PREVIEWS/`.
4. **Solo hay una pista de combate para diez misiones de 5–8 minutos.** El brief
   pide «varias pistas o variaciones para que no sea siempre la misma».
   Opciones: usar `Synth Wave` también como combate B, buscar una o dos CC0 más,
   o generar variaciones por filtro y capas sobre la que hay.
5. **«VFX alto/medio/bajo»**: ¿eje nuevo separado de CALIDAD, o renombrar la
   opción CALIDAD que ya existe?
