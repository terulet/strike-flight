# Audio de terceros — licencias

**Once fuentes externas, las once CC0, todas verificadas en su página de
origen.** Una para los efectos y diez para la música (cinco del bloque 5
base, cinco del bloque 5I de la expansión). Todas se redistribuyen sin
tocar en `audio/fuentes/`, junto a su licencia.

| | Efectos | Música (base) | Música (expansión, 5I) |
|---|---|---|---|
| Fuente | Kenney "Sci-Fi Sounds" | 5 piezas de OpenGameArt | 5 piezas de OpenGameArt, mismo autor (MintoDog) |
| Archivos | 24 | 5 | 5 |
| Cómo se usan | como CAPA dentro de una receta, nunca enteros | recortadas y normalizadas, nunca tal cual | enteras (son bucles de compás exacto) y normalizadas |
| Receta | `herramientas/audio/paleta.mjs` | `herramientas/preparar-musica.mjs` | `herramientas/preparar-musica-expansion.mjs` |
| Resultado | `audio/muestras.js` (base64) | `audio/musica/*.mp3` (archivos) | `audio/musica/*.mp3` (archivos) |
| Detalle | aquí abajo | [más abajo](#música-seis-bucles-y-cuatro-cortes) | [más abajo](#música-de-la-expansión-bloque-5i) |

---

## La fuente de los efectos

| Campo | |
|---|---|
| Título | Sci-Fi Sounds (1.0) |
| Autor | Kenney |
| Página original | https://kenney.nl/assets/sci-fi-sounds |
| URL de descarga | https://kenney.nl/media/pages/assets/sci-fi-sounds/6b296f9ecf-1677589334/kenney_sci-fi-sounds.zip |
| Licencia | CC0 1.0 Universal (dominio público) |
| URL de la licencia | http://creativecommons.org/publicdomain/zero/1.0/ |
| Uso comercial | **sí**, explícito: «free to use in personal, educational and commercial projects» |
| Atribución exigida | **no** («Support us by crediting Kenney — this is not mandatory») |
| Fecha de descarga | 2026-08-16 |
| SHA-256 del .zip | `119340f351a5098ad814f78719438c0da355a9ce8a4c8a3af6a8d48aa3d49e04` |
| Licencia incluida | `audio/fuentes/kenney/License-Kenney-SciFiSounds.txt` |

Acreditamos a Kenney de todos modos, aquí y en el README. Que no sea
obligatorio no es motivo para no hacerlo.

## Los 24 archivos que se usan

Del paquete de 70 se conservan solo los que entran en alguna receta. Los
demás se descartaron: bucles de motor de 5 s que este juego no necesita,
y láseres tipo `laserRetro` que son exactamente el «piu piu» que había
que evitar.

| Archivo | SHA-256 (16) | Dónde entra |
|---|---|---|
| `explosionCrunch_000..004.ogg` | `4b597d65…` `fdd04d6f…` `be2b8ddc…` `8c7197bb…` `9c3a1c73…` | textura de escombro de TODAS las explosiones, la bomba, el especial y las dos muertes de jefe |
| `impactMetal_000..004.ogg` | `956c6612…` `4a2b76f2…` `0c1bb4db…` `ef29c394…` `0032710d…` | ataque metálico de impactos, cañón, raíl, golpe al jugador, nodos y cambio de fase |
| `laserLarge_000..004.ogg` | `a56d9579…` `e678aca6…` `e5e0b6cc…` `3c7b3c9d…` `86c74948…` | capa del láser del jugador y del láser enemigo |
| `forceField_000..004.ogg` | `c2916f2a…` `5574e69d…` `051b0eaf…` `15e3fe97…` `05609bb2…` | escudo: impacto, rotura, zumbido y recogida |
| `lowFrequency_explosion_000/001.ogg` | `3cb48d86…` `cdda5060…` | subgrave de la explosión grande, del jefe y de la bomba |
| `doorClose_001.ogg` | `2153e83f…` | golpe seco de la pausa |
| `spaceEngineLow_000.ogg` | `d7deee8d…` | fondo de motor bajo la entrada del jefe |

Hashes completos en `audio/MANIFIESTO.json`.

## Modificaciones

Ninguno se usa entero ni sin tocar. En todos los casos, como mínimo:
recorte del silencio de cabeza, recorte a la parte útil, reafinado por
remuestreo, filtrado de paso alto para dejar sitio al sub sintetizado
propio, envolvente nueva y mezcla con entre 2 y 10 capas más. Después,
normalizado a la sonoridad de su categoría, limitado y codificado a MP3
mono. La receta exacta de cada sonido está en
`herramientas/audio/paleta.mjs`, que es la documentación de verdad de
qué se hizo con qué.

CC0 permite todo esto sin condiciones.

---

## Lo que hay: 124 archivos, 71 sonidos

`audio/muestras.js` — 374 kB, MP3 mono en base64, generado por
`herramientas/forjar-audio.mjs`. Un id puede tener 1–4 variantes; el
motor rota entre ellas sin repetir la anterior.

**Por qué base64 dentro de un `.js` y no archivos sueltos.** El juego
tiene que abrirse con doble clic. Con `file://` el navegador prohíbe
`fetch()`, así que `decodeAudioData()` no puede leer un `.mp3` del
disco: un juego con audio solo cuando hay servidor no es un juego con
audio. Un `<script src>` clásico sí se permite con `file://`. De paso:
cero peticiones de red, cero 404 posibles y cero latencia de carga.
Comprobado en `herramientas/pruebas/audio-fileurl.mjs`.

**Por qué MP3 y no OGG.** `decodeAudioData` acepta MP3 en todos los
navegadores, Safari de iOS incluido. Ogg Vorbis no. Con un solo formato
que funciona en todas partes no hace falta *fallback*, y no hay una
segunda ruta de código que pueda romperse solo en el iPad.

**Reproducir la fabricación:**

```
node herramientas/forjar-audio.mjs          # regenera muestras.js
node herramientas/forjar-audio.mjs --wav    # deja los WAV para escucharlos
node herramientas/forjar-audio.mjs --solo cannon,exp_boss
```

Es determinista: mismo código y mismas fuentes, mismo SHA-256.
El actual está en `audio/MANIFIESTO.json`.

## La síntesis sigue, como repuesto

Los 71 sonidos existen además sintetizados en `index.html`. No es código
muerto: es lo que suena mientras el banco se descodifica (~1 s tras el
primer toque) y lo que sonaría si `audio/muestras.js` faltara. El juego
no se queda mudo en ningún caso. Lo comprueba
`herramientas/pruebas/audio-banco.mjs`.

---

## Reglas para cuando entre más audio externo

**Orden de preferencia de licencia:**

1. CC0 / dominio público
2. Royalty-free con uso comercial explícito
3. CC-BY, con la atribución publicada en el juego y aquí

**Prohibido, sin excepciones:** audio extraído de videojuegos, de
películas, de vídeos de YouTube, o de packs recopilados por terceros sin
enlace a la fuente original. Si no se puede abrir la página del autor y
leer la licencia, no entra.

**Ficha obligatoria por fuente.** Sin los doce campos, no se integra:
nombre en el juego · nombre original · título · autor · página original ·
URL de descarga · licencia · URL de la licencia · uso comercial ·
atribución exigida · modificaciones · fecha de descarga · SHA-256.

**Cómo se integra.** Lo normal es añadir la fuente a
`audio/fuentes/`, escribir la receta en `herramientas/audio/paleta.mjs`
y volver a forjar. Para probar un reemplazo suelto sin regenerar el
banco entero hay `cargarMuestra()`, que lo añade como una variante más
del id (necesita HTTP, no funciona con `file://`):

```js
cargarMuestra("exp_boss", "audio/pruebas/otra_explosion.mp3");
```

---

## MÚSICA: seis bucles y cuatro cortes

**Cinco fuentes externas, las cinco CC0, verificadas una a una en su
página de origen el 2026-08-16.** Los originales se conservan sin tocar
en `audio/fuentes/musica/`; lo que suena en el juego está en
`audio/musica/` y lo fabrica `herramientas/preparar-musica.mjs`.

Los cuatro CORTES (victoria, misión completada, derrota, desbloqueo) no
son de nadie: se forjan con `herramientas/audio/stingers.mjs` sobre el
mismo taller DSP que los efectos. El pack no traía cortes, y cuatro
cortes de cuatro autores distintos habrían sonado a cuatro juegos
distintos pegados.

### Las cinco fuentes

| | 1 |
|---|---|
| Nombre en el juego | `menu` y `combate_b` |
| Título original | Synth Wave |
| Autor | Pro Sensory / **Alex McCulloch** |
| Página original | https://opengameart.org/content/synth-wave |
| URL de descarga | https://opengameart.org/sites/default/files/Synth%20Wave_0.mp3 |
| Licencia | CC0 1.0 Universal |
| URL de la licencia | http://creativecommons.org/publicdomain/zero/1.0/ |
| Uso comercial | **sí** |
| Atribución exigida | **no** — el autor dice «just include my name, Alex McCulloch. This is not mandatory» |
| Modificaciones | dos trozos distintos (8–88 s y 96–176 s), normalizado a −16 LUFS con pico real a −1,5 dBFS, reencodado a MP3 VBR |
| Fecha de descarga | 2026-08-16 |
| SHA-256 | `d09b65f3cc1d5306c318bdf27622cc99feb3edb0b7483c463dc38b3432aa9827` |

| | 2 |
|---|---|
| Nombre en el juego | `combate_a` |
| Título original | Space Shooter (Loop) |
| Autor | Pro Sensory / **Alex McCulloch** |
| Página original | https://opengameart.org/content/space-shooter-loop |
| URL de descarga | https://opengameart.org/sites/default/files/space_shooter_0.mp3 |
| Licencia | CC0 1.0 Universal |
| Uso comercial | **sí** |
| Atribución exigida | **no**, pero el autor la pide: «please include my name in your project's credits, Alex McCulloch» |
| Modificaciones | entera; normalizada y reencodada |
| Fecha de descarga | 2026-08-16 |
| SHA-256 | `0768b7660257d45cbcde7acbd40f791e368e4c7837be5dfea49a0e4e9c2dfe82` |

| | 3 |
|---|---|
| Nombre en el juego | `jefe` |
| Título original | Trance Boss Battle |
| Autor | **MintoDog** |
| Página original | https://opengameart.org/content/trance-boss-battle |
| URL de descarga | https://opengameart.org/sites/default/files/trance_boss_battle_bpm150.mp3 |
| Licencia | CC0 1.0 Universal |
| Uso comercial | **sí** |
| Atribución exigida | **no** |
| Modificaciones | entera; normalizada y reencodada |
| Fecha de descarga | 2026-08-16 |
| SHA-256 | `ec3a2e51e1191a380d90e56b1a5b4306a195e5f71d655dd3e18de3eb5ee334d4` |

> **Ojo con la URL.** El manifiesto del pack apuntaba a
> `trance_boss_battle_bpm150_0.mp3`, con sufijo `_0`, y eso da **404**.
> El archivo bueno es el de arriba, sin sufijo.

| | 4 |
|---|---|
| Nombre en el juego | `jefe_final` |
| Título original | Boss Battle 10 [Retro] |
| Autor | **nene** |
| Página original | https://opengameart.org/content/boss-battle-10-retro |
| URL de descarga | https://opengameart.org/sites/default/files/boss_battle_10_retro_0.ogg |
| Licencia | CC0 1.0 Universal |
| Uso comercial | **sí** |
| Atribución exigida | **no** |
| Modificaciones | **transcodificada de OGG Vorbis a MP3**, normalizada y reencodada |
| Fecha de descarga | 2026-08-16 |
| SHA-256 | `76f035c2607a040d04954ac9663ff4d1ddf491ea1dc815e44448e74cd843b193` |

> **No existe en MP3 en origen** (solo `.wav`, `.ogg` y `.mid`), y
> **Safari de iOS no descodifica Ogg Vorbis**. Transcodificar no es una
> mejora aquí: es la condición para que suene en el aparato de destino.

| | 5 |
|---|---|
| Nombre en el juego | `hangar` |
| Título original | Calm Ambient 1 (Synthwave 4k) |
| Autor | **The Cynic Project** (cynicmusic) |
| Página original | https://opengameart.org/content/calm-ambient-1-synthwave-4k |
| URL de descarga | https://opengameart.org/sites/default/files/001_Synthwave_4k_0.mp3 |
| Licencia | CC0 1.0 Universal |
| Uso comercial | **sí** |
| Atribución exigida | **no**, pero el autor la pide explícitamente: «The Cynic Project / cynicmusic.com / pixelsphere.org» |
| Modificaciones | recortada a 16–140 s para quitarle los fundidos de estudio, normalizada y reencodada |
| Fecha de descarga | 2026-08-16 |
| SHA-256 | `56b31f997020da1abd4092f5e82457592323717a23e4d560c5f8135d26c3b8be` |

### Créditos

Ninguno es obligatorio bajo CC0. Se ponen igual, como ya se hace con
Kenney:

> Música: **Alex McCulloch** · **MintoDog** · **nene** ·
> **The Cynic Project** (cynicmusic.com / pixelsphere.org).
> Efectos: **Kenney**.

### Lo que suena, y por qué así

| Pista | Origen | Duración | Peso | LUFS | Bucle |
|---|---|---|---|---|---|
| `menu` | Synth Wave 8–88 s | 1:20 | 1 312 kB | −15,9 | cruce 2,0 s |
| `combate_a` | Space Shooter | 1:22 | 1 627 kB | −15,9 | cruce 1,0 s |
| `combate_b` | Synth Wave 96–176 s | 1:20 | 1 301 kB | −16,1 | cruce 2,0 s |
| `hangar` | Calm Ambient 16–140 s | 2:04 | 1 654 kB | −16,0 | cruce 4,0 s |
| `jefe` | Trance Boss | 1:42 | 1 727 kB | −15,9 | cruce 0,15 s |
| `jefe_final` | Boss Battle 10 | 0:34 | 540 kB | −16,0 | cruce 1,0 s |
| `mision` | forjado | 2,8 s | 23 kB | −16,6 | corte |
| `victoria` | forjado | 3,6 s | 31 kB | −16,0 | corte |
| `derrota` | forjado | 3,8 s | 27 kB | −16,2 | corte |
| `unlock` | forjado | 1,6 s | 14 kB | −16,0 | corte |

**8,1 MB en total.** Se cargan bajo demanda, nunca todas de golpe.

**Por qué se normaliza todo a −16 LUFS.** Las cinco pistas venían con
**6,5 LU de diferencia** entre la más fuerte (Trance Boss, −11,5) y la
más floja (Calm Ambient, −18,0), y `Synth Wave` picaba a **+0,2 dBFS**,
o sea por encima del techo digital: recortaba sola. Sin normalizar,
pasar del hangar al jefe es un susto. La diferencia de volumen *entre
estados* se decide después, en `js/music.js`, donde se ve y se toca: el
jefe va +1,2 dB sobre el combate.

**Por qué archivos sueltos y no base64.** Al revés que los efectos.
Ocho megas no caben en un `.js`, y sobre todo: una pista estéreo de
44,1 kHz ocupa **10,6 MB por minuto descodificada**. Descodificar el
menú entero serían 64 MB y un cruce menú→combate, 92 MB de audio vivo:
Safari en el iPad mata la pestaña. Por eso la música va por `<audio>`,
que **transmite** en vez de descodificar, y entra en el grafo por
`createMediaElementSource` para que el silencio, el volumen de música y
el agachado funcionen igual que con los efectos.

**Con doble clic también suena.** Era la duda que quedaba y está
comprobada: con `file://` el navegador **sí** deja que un `<audio>` lea
un MP3 del disco. Lo que no deja Chrome es enrutarlo por WebAudio (un
medio de origen `file:` se considera opaco y saldría mudo), así que ahí
el sistema cae solo a controlar el volumen del elemento y renuncia al
agachado y al filtro de intensidad. Lo comprueba
`herramientas/pruebas/musica.mjs`.

**Reproducir la fabricación:**

```
node herramientas/preparar-musica.mjs              # regenera audio/musica/
node herramientas/preparar-musica.mjs --solo jefe  # solo una pista
node herramientas/preparar-musica.mjs --wav        # deja los WAV de los cortes
```

Hashes de entrada y de salida, medidas y recortes, en `audio/MUSICA.json`.

---

## MÚSICA DE LA EXPANSIÓN (bloque 5I)

**Cinco fuentes más, las cinco CC0, las cinco del mismo autor que ya
sonaba en `jefe` (MintoDog, OpenGameArt), verificadas el 2026-08-19.**
Traídas por `FLIGHT_STRIKE_MUSIC_EXPANSION_5I.zip`, un pack preparado
para este proyecto con IDs ya pensados para encajar en `js/music.js`. Los
originales están sin tocar en `audio/fuentes/musica/`; lo que suena en
el juego está en `audio/musica/` y lo fabrica
`herramientas/preparar-musica-expansion.mjs`.

Las cinco son bucles de **compás exacto** (confirmado con `ffprobe`:
duración × BPM / 60 da un número entero de compases en las cinco), así
que no hace falta recortarlas como al pack base — se normalizan enteras
y el cruce puede ser tan corto como el de `jefe` (0,15 s en vez de los
1–2 s del resto).

| | 6 |
|---|---|
| Nombre en el juego | `combate_c` |
| Título original | Space Battle |
| Autor | **MintoDog** |
| Página original | https://opengameart.org/content/space-battle |
| URL de descarga | https://opengameart.org/sites/default/files/space_battle_bpm130.mp3 |
| Licencia | CC0 1.0 Universal |
| Uso comercial | **sí** |
| Atribución exigida | **no** |
| Modificaciones | entera (48 compases a 130 BPM); normalizada a −16 LUFS / pico real −1,5 dBFS y reencodada a MP3 VBR |
| Fecha de descarga | 2026-08-19 |
| SHA-256 (fuente) | `de0db250712a4050af4d4711d5d7ea2a0b100ad51b4d31d740f605cf6c78a974` |

| | 7 |
|---|---|
| Nombre en el juego | `combate_d` |
| Título original | Space Adventure |
| Autor | **MintoDog** |
| Página original | https://opengameart.org/content/space-adventure |
| URL de descarga | https://opengameart.org/sites/default/files/space_adventure_bpm140.mp3 |
| Licencia | CC0 1.0 Universal |
| Uso comercial | **sí** |
| Atribución exigida | **no** |
| Modificaciones | entera (76 compases a 140 BPM); normalizada y reencodada |
| Fecha de descarga | 2026-08-19 |
| SHA-256 (fuente) | `d778093ed7e826b8ad604f489cda3675b2d8203576d906a0d2553cfe20f0a93f` |

| | 8 |
|---|---|
| Nombre en el juego | `combate_e` |
| Título original | Hard Battle 2 |
| Autor | **MintoDog** |
| Página original | https://opengameart.org/content/hard-battle-2 |
| URL de descarga | https://opengameart.org/sites/default/files/hard_battle_2_bpm140.mp3 |
| Licencia | CC0 1.0 Universal |
| Uso comercial | **sí** |
| Atribución exigida | **no** |
| Modificaciones | entera (52 compases a 140 BPM); normalizada y reencodada |
| Fecha de descarga | 2026-08-19 |
| SHA-256 (fuente) | `2a0d4edb4e3d2b5545d750b243a4a8fdc8d9edf3ba395bb9dba6cf17ccb2ce64` |

| | 9 |
|---|---|
| Nombre en el juego | `jefe2` |
| Título original | Space Boss Battle |
| Autor | **MintoDog** |
| Página original | https://opengameart.org/content/space-boss-battle |
| URL de descarga | https://opengameart.org/sites/default/files/space_boss_battle_bpm175.mp3 |
| Licencia | CC0 1.0 Universal |
| Uso comercial | **sí** |
| Atribución exigida | **no** |
| Modificaciones | entera (76 compases a 175 BPM); normalizada y reencodada |
| Fecha de descarga | 2026-08-19 |
| SHA-256 (fuente) | `7e9e1a819fe1b4d640a8168bd4b8d5d9ebdc968965a1469c9676276e2742e903` |

| | 10 |
|---|---|
| Nombre en el juego | `final2` |
| Título original | Heavy Boss Battle 2 |
| Autor | **MintoDog** |
| Página original | https://opengameart.org/content/heavy-boss-battle-2 |
| URL de descarga | https://opengameart.org/sites/default/files/heavy_boss_battle_2_bpm110.mp3 |
| Licencia | CC0 1.0 Universal |
| Uso comercial | **sí** |
| Atribución exigida | **no** |
| Modificaciones | entera (60 compases a 110 BPM — el BPM más bajo de las diez pistas de combate/jefe, a propósito: es lo que hace que AXIOMA no suene "más de lo mismo" que los otros cuatro jefes de la expansión); normalizada y reencodada |
| Fecha de descarga | 2026-08-19 |
| SHA-256 (fuente) | `d77c9fbab72e22b615662a04b8a3a178ff6132cd5e69658e4470ae0f05e80c35` |

### Mapping por mundo — y por qué

No es el orden en que llegaron en el pack (`PROMPT_INTEGRACION_CLAUDE.txt`
proponía uno, marcado explícitamente como punto de partida a
contrastar, no a obedecer). Elegido por identidad de mundo y BPM, no al
azar:

| Mundo | Pista | Por qué |
|---|---|---|
| Hielo (M11-M12) | `combate_c` (130 BPM) | el más tranquilo de los tres; abre la expansión sin agotar la carta más agresiva de entrada |
| Megaciudad (M13-M14) | `combate_e` (140 BPM, "Hard Battle") | la más agresiva, en solitario — el mundo más urbano/neón se queda con la más intensa y no la comparte con nadie más, para que destaque del resto |
| Abismo (M15-M16) | `combate_d` (140 BPM, "Space Adventure") | la más atmosférica de las tres; encaja con un mundo de misterio bajo el agua mejor que un tema de "batalla" |
| Fragua (M17-M18) | `combate_c` (130 BPM) | comparte con Hielo, pero no son mundos contiguos — la fragua ya tiene intensidad de sobra en su propio jefe (ciclo de forja) sin necesitar la pista más dura |
| Grieta (M19-M20) | `combate_d` (140 BPM) | comparte con Abismo — ambos son el registro "extraño/onírico" de la expansión, y separa a Grieta de Fragua justo antes de AXIOMA |
| KRYOS / VÉRTICE / NÝX / VULCANO | `jefe2` (175 BPM) | los cuatro jefes completos de la expansión comparten tema, igual que los nueve de la campaña base comparten `jefe` |
| AXIOMA | `final2` (110 BPM) | pista propia, deliberadamente MÁS LENTA que `jefe2` — el contraste de tempo (175 → 110) es lo que hace que el jefe final de la expansión se sienta distinto a los cuatro anteriores, no solo "el quinto jefe2" |

`TEMAS[].pista` (`js/misiones.js`) y `JEFES[].pistaJefe`
(`js/jefes.js`) son los dos únicos sitios que deciden esto — cambiar el
mapping es cambiar un valor ahí, no tocar `spawnMiniboss()` ni
`music.js`.

### Lo que suena, y por qué así

| Pista | Origen | Duración | Peso | LUFS | Bucle |
|---|---|---|---|---|---|
| `combate_c` | Space Battle | 1:29 | 1 467 kB | −15,9 | cruce 0,15 s |
| `combate_d` | Space Adventure | 2:10 | 2 111 kB | −15,9 | cruce 0,15 s |
| `combate_e` | Hard Battle 2 | 1:29 | 1 569 kB | −15,9 | cruce 0,15 s |
| `jefe2` | Space Boss Battle | 1:44 | 1 746 kB | −15,9 | cruce 0,15 s |
| `final2` | Heavy Boss Battle 2 | 2:11 | 2 089 kB | −15,9 | cruce 0,15 s |

**8,98 MB más, ninguno cargado hasta que hace falta.** El catálogo de
`js/music.js` es una tabla de METADATOS: añadir una fila no descarga
nada. Lo único que dispara una descarga real es `cargar()`, y eso solo
pasa cuando el juego pide de verdad ese estado (entrar en el mundo, que
aparezca el jefe) — el mismo mecanismo que ya usaban `combate_a`/
`combate_b`/`jefe`/`jefe_final` desde el bloque 5 base. No hizo falta
construir nada nuevo para que M1-M10 y "abrir M11 sin más" sigan sin
tocar estos cinco archivos.

**Reproducir la fabricación:**

```
node herramientas/preparar-musica-expansion.mjs
```

Hashes de entrada y de salida, medidas, en `audio/MUSICA.json`.
