# FLIGHT STRIKE

Shoot'em up vertical para tablet y móvil. Un solo archivo, sin
dependencias, sin compilar y sin conexión.

## Jugar

Doble clic en `index.html`.

Se arrastra el dedo por cualquier parte de la pantalla y la nave sigue.
Dispara sola: solo hay que esquivar, recoger mejoras y elegir cuándo
gastar la bomba.

| | |
|---|---|
| Mover | arrastrar el dedo · WASD · flechas |
| Bomba | botón de abajo a la derecha · Espacio · B |
| Pausa | botón de arriba a la derecha · Esc |
| Depuración | `?debug` en la dirección · Ctrl+Shift+D |

## Campo de juego vertical

La plataforma es el **iPad en vertical**. El mundo tiene una proporción
máxima de 4:3 y lo que sobra a los lados es marco, no terreno jugable.

No es una decisión estética. En un monitor de 2048×858 el campo mediría
cinco veces la nave, y esquivar dejaría de ser una decisión: siempre
habría sitio. En iPad vertical no sobra nada y el marco no aparece.

## Modos

**CAMPAÑA** — diez misiones con guion de eventos, identidad propia,
mecánica firma y jefe propio. Ninguna es una versión con más vida de la
anterior: cada una introduce algo que las demás no tienen.

| | Misión | Identidad | Mecánica firma | Jefe |
|---|---|---|---|---|
| M1 | PRIMER CONTACTO | Introducción al combate | — | GUARDIÁN |
| M2 | CINTURÓN DE ASTEROIDES | Movimiento y esquiva | Asteroid break | RIFT REAPER |
| M3 | RED DE DEFENSA | Prioridad de objetivos | Target priority | AEGIS PRIME |
| M4 | SECTOR TÓXICO | Control del espacio | Toxic zones | VENOM CORE |
| M5 | FISURA HELADA | Primera gran prueba | Élites + hielo | TITÁN |
| M6 | WAR FLEET | Guerra a gran escala | Command ships | WARLORD VESPER |
| M7 | GRAVITY COLLAPSE | Espacio distorsionado | Gravity wells | SINGULARITY WARDEN |
| M8 | INFERNO | Velocidad y calor | Heat lanes | PYRE LORD |
| M9 | ENEMY CORE | Asalto al núcleo | Core access | CORE ARCHITECT |
| M10 | FINAL STRIKE | Final de campaña | Los tres actos | OMEGA SOVEREIGN |

Duración medida, con un piloto competente: **M1** 4:39 · **M2-M4** ~5:00 ·
**M5** 6:09 · **M6** 6:22 · **M7** 5:17 · **M8** 5:29 · **M9** 5:27 ·
**M10** 7:59.

Cada misión suelta **familias de arma distintas**, así que salir de la M2
con misiles, de la M5 con crio y de la M9 con raíl no es casualidad: es
lo que hace que la campaña no sepa toda igual.

Al terminar la M10 se guarda `campaignCompleted` y aparece la pantalla
**CAMPAÑA COMPLETADA** con las estadísticas de la carrera que la ganó.

**SUPERVIVENCIA** — el modo original, intacto. Cuatro mundos, oleadas sin
fin, dificultad por tiempo.

## Mecánicas de la segunda mitad

Las cuatro son sistemas propios con estado explícito, límite duro y
limpieza al morir el jefe. Ninguna toca el control del jugador.

**COMMAND SHIPS** (M6) — mientras viva una nave `comando`, toda la flota
recarga un 30 % más rápido. Matar una se nota al instante en el ritmo de
fuego de la pantalla entera.

**GRAVITY WELL** (M7) — `TELEGRAPH → FORMATION → ACTIVE → COLLAPSE →
CLEAR`. La fuerza se **suma** al objetivo del dedo, nunca lo sustituye, y
el colapso final tiene techo. Por fuerte que tire, sigues pilotando.

**HEAT LANES** (M8) — `TELEGRAPH → IGNITION → ACTIVE → COOLING`. Bandas
horizontales, no círculos: obligan a elegir **altura**, que es lo que
pide una misión de reacción rápida.

**CORE ACCESS** (M9) — tres sistemas que cambian el nivel de verdad al
caer. `ALPHA` apaga las torretas de escenario, `BETA` es un escudo de
flota (los enemigos encajan solo el 55 % del daño mientras vive), `GAMMA`
manda refuerzos cada 4 s. Ignorarlos aprieta la misión; destruirlos la
desarma.

## Las naves

Se diferencian en la mano, no solo en la ficha. Los números están
acotados a ±35 % para que elegir sea una preferencia y no una trampa.

| Chasis | Modelo | Clase | Velocidad | Daño | Cadencia | Zona de impacto | Sale con | Se abre |
|---|---|---|---|---|---|---|---|---|
| `chassis_01` | **VX-9 TALON** | INTERCEPTOR | ×1.32 | ×0.82 | ×0.88 | ×0.78 | Repetidor | de salida |
| `chassis_02` | **AX-4 WARHAWK** | STRIKER | ×0.86 | ×1.38 | ×1.14 | ×1.10 | Cañón | M2 |
| `chassis_03` | **CR-7 BULWARK** | AEGIS | ×1.08 | ×1.00 | ×0.96 | ×0.84 | Eléctrico + escudo | M5 |
| `chassis_04` | **NX-11 WRAITH** | PHANTOM | ×1.10 | ×1.20 | ×0.82 | ×1.25 | Lanzallamas | M8 |
| `chassis_05` | **SV-12 SOVEREIGN** | NOVA | ×1 | ×1 | ×1 | ×1 | Cañón | M10 |
| `clasica` | CLÁSICA | POLIVALENTE | ×1 | ×1 | ×1 | ×1 | Cañón | heredada |

En cadencia, **menos es más rápido**. El WRAITH no repite el hueco del
WARHAWK: el WARHAWK pega fuerte y gira mal; el WRAITH dispara más rápido
que nadie y tiene la zona de impacto más grande del juego. Que salga con
el lanzallamas —corto alcance— es parte de lo mismo: está montada para
obligar a acercarse.

Los cuatro primeros son las naves de siempre con nombre de modelo: **no
se ha movido ni un número**. Los ids viejos (`kali`, `yoli`, `silvia`,
`eloi`) siguen valiendo como alias de lectura, así que un guardado
anterior entra con la misma nave con la que salió. Ojo: `eloi` es
también el nombre de la moneda, y son cosas distintas.

**SV-12 SOVEREIGN** es nueva y su ficha está **sin calibrar**: lleva los
valores neutros y así lo dice el Hangar. Balancearla es trabajo aparte.

### El Hangar

`HANGAR` en la portada. Dos pestañas:

- **CHASIS** — la nave a tamaño grande sobre el fondo del hangar,
  modelo, clase, descripción, barras de ATAQUE/VELOCIDAD/CONTROL, arma
  de salida y, si está cerrada, con qué misión se abre.
- **ASPECTO** — cinco secciones: **SKIN**, **ESTELA**, **EMBLEMA**,
  **COLOR** (casco, detalle y reactor) y **NOMBRE**. Todo es cosmético;
  no toca ni un número de la ficha, y se guarda por chasis.

Las skins de **tinte** se componen por código sobre el sprite y no
gastan ni un asset. Las de **material** —hielo, brasas, corrosión,
tormenta, nebulosa— no se pueden hacer con color, así que salen
bloqueadas hasta que exista su PNG en vez de fingirlas con un cambio de
matiz que queda mal.

El **emblema** se ve en el Hangar, en la casilla de la nave y en la
pantalla de misión completada. **Nunca sobre la nave en partida**: se
dibuja a unos 77 px de ancho y un emblema legible ahí serían 12 px de
mancha encima de lo único que hay que leer bien.

Quien ya tenga progreso recibe sus chasis **de forma retroactiva y en
silencio** al abrir el juego. El cartel de desbloqueo solo sale en el
momento en que se gana, y una sola vez.

## Modo ADMIN / FAMILY

Un cajón de arena privado para jugar sin requisitos, separado del juego
normal por completo. **No es un segundo juego**: es una capa de permisos
sobre el mismo. Ni el balance, ni el daño, ni la cadencia, ni el spawn,
ni los jefes cambian. Lo único que cambia es qué está disponible y dónde
se guarda.

**Cómo se entra.** AJUSTES → cinco toques sobre el rótulo **PROGRESO** →
PIN. Sin botón visible: un botón ADMIN en los ajustes es una invitación
para cualquiera que abra el juego. El PIN de fábrica es `1808` y se
cambia desde dentro. Es una barrera **casual** —que un niño no entre sin
querer— no seguridad: el PIN viaja al navegador con el código. Para
desarrollo, `?admin` en la URL deja la puerta en un solo toque, pero
sigue pidiendo el PIN.

**Cuatro perfiles**: KALI, YOLI, SILVIA y ELOI, cada uno con su nave, su
personalización y su economía. Añadir uno son tres líneas en
`js/admin.js` y ninguna migración.

**Saves completamente separados.** El jugador normal escribe en
`sf_save`; cada perfil de admin en `sf_admin_<perfil>`. El aislamiento
vive **dentro de `save.js`** (`SAVE.usarEspacio`) y no en la capa de
admin: hay más de treinta sitios que guardan, y basta con que uno se
escape para que una partida de admin escriba en la partida de alguien.
Con el espacio dentro de SAVE no hay escritura que pueda equivocarse de
clave. Salir devuelve el save normal **byte a byte**, y hay una prueba
que lo compara como texto.

**FOUNDER FLEET.** Las cuatro naves personales originales —KALI, YOLI,
SILVIA y ELOI— recuperadas del historial y guardadas en `art/founder/`.
Existen en el catálogo marcadas `adminOnly` y `legacyFounder`, y **solo
se ven dentro de admin**: ni en el Hangar normal, ni como recompensa, ni
en una tienda futura. Sus PNG no se descargan siquiera si no se entra.

**Qué queda abierto**: las 10 misiones, los 4 mundos, los 9 chasis y
todos los cosméticos. Sin gastar ELOI.

**Se nota**: un distintivo `ADMIN / FAMILY · <PERFIL>` permanente arriba,
en el menú y en partida. La idea es que nadie se crea que está avanzando
su campaña normal cuando no lo está.

**Para lo comercial que venga después** —compras, anuncios, economía
real, marcadores, logros públicos, telemetría de balance— la
comprobación es `ADMIN.excluido()`, y para cobrar, `ADMIN.puedeGastar()`.
Una sesión de admin no es la partida de un cliente y no puede contar
como tal en ninguna de esas cosas.

## Las armas

Once familias. Se cambia de familia recogiendo su mejora, y el nivel se
conserva: subir el arma seis veces y perderlo todo por recoger algo
nuevo se siente como un castigo, no como una mejora.

`cannon` · `rapid` · `plasma` · `fuego` · `cryo` · `electrico` ·
`misil` · `railgun` · `laser` · `void` · `ultimate`

Cada una tiene su cadencia, su daño, su PNG, su sonido y su impacto, y
algunas tienen algo más: el crio congela, el eléctrico salta al enemigo
de al lado, los misiles se guían con giro limitado, el raíl atraviesa la
pantalla entera.

## Cargar tus propias naves

En el **HANGAR**, la casilla `+ CARGAR`. Se elige un PNG y aparece en el
selector, guardada en el navegador. Caben 4; para borrar una, la `×` de
su esquina. En el iPad el `+` abre la galería de fotos.

El juego le quita el fondo automáticamente si es de un color plano
—magenta, blanco, verde— mediante relleno por inundación desde los
bordes, así que los blancos del interior de la nave se conservan.

## La carpeta `art/`

Las imágenes que trae el juego de serie. Cada subcarpeta tiene su
`LEEME.txt` con los nombres exactos.

```
art/naves/        chassis_01_interceptor · chassis_02_striker ·
                  chassis_03_aegis · chassis_04_phantom · chassis_05_nova
art/emblemas/     skull · wolf · tiger · phoenix · dragon · cobra ·
                  eye · crystal · wings · solar
art/hangar/       hangar_h
art/founder/      kali · yoli · silvia · eloi   (colección privada,
                  solo modo ADMIN — ver su LEEME.txt)
art/enemigos/     normal · veloz · torreta · tanque · kamikaze ·
                  bombardero · francotirador · portaescudos · elite ·
                  crucero · comando · dron_ataque · dron_escudo · dron_misil
art/bosses/       guardian · titan · rift_reaper · aegis_prime ·
                  venom_core · warlord_vesper · singularity_warden ·
                  pyre_lord · core_architect · omega_sovereign
art/powerups/     16 mejoras
art/proyectiles/  13 familias de disparo
art/vfx/          15 efectos
art/impactos/     10 impactos
art/hazards/      asteroide · cristal · nube tóxica
art/defensas/     torreta fija · cañón fijo
art/fondos/       espacio · oceano · volcan · neon
```

Lo que falte se dibuja por código y no se rompe nada. Cada dibujo se
busca además en `assets/`, así que da igual cómo se llame la carpeta.
La lista está en `CARPETAS`, arriba de `index.html`.

> Los nombres, **en minúsculas**. Windows no distingue `KALI.PNG` de
> `kali.png`, pero GitHub Pages sí.

## Herramientas

Necesitan Playwright (`npm i -D playwright && npx playwright install
chromium`). **El juego sigue sin dependencias de ningún tipo**: esto es
solo para preparar imágenes y para probar.

```
node herramientas/hoja-contacto.mjs <carpeta> <salida.png> [cols] [px]
```
Monta una hoja de contacto de una carpeta. Sirve para identificar de un
vistazo 105 PNG que se llaman `ChatGPT Image 10 ago 2026, 01_09_49.png`.

```
node herramientas/optimizar.mjs <glow|recorte> <px> <carpeta...>
```
Dos modos, porque hay dos clases de imagen:

- **recorte** — objetos sólidos. Reutiliza el `prepararSprite()` del
  propio juego: inundación desde los bordes, así que el negro del
  interior del dibujo se conserva.
- **glow** — efectos luminosos sobre fondo negro. El alfa sale del
  brillo del píxel, que es lo que permite pintarlos encima de cualquier
  cosa sin ver el recuadro.

```
node herramientas/recortar.mjs art/
```
Deja los PNG recortados en disco, para que también funcionen abriendo
con doble clic (con `file://` el navegador no deja leer los píxeles de
una imagen del disco).

## Pruebas

Levantan un servidor, abren el juego de verdad en un iPad y un iPhone
simulados, lo juegan y recogen todo lo que dice la consola. Un 404 o una
excepción salen en el informe, no en silencio.

```
node herramientas/pruebas/nucleo.mjs        artifacts/screenshots/x
node herramientas/pruebas/frontal.mjs       artifacts/screenshots/x
node herramientas/pruebas/pantallas.mjs     artifacts/screenshots/x
node herramientas/pruebas/aguante.mjs       artifacts/screenshots/x
node herramientas/pruebas/misiones.mjs      artifacts/screenshots/x
node herramientas/pruebas/musica.mjs                                 # no pide carpeta
node herramientas/pruebas/guardado.mjs                               # no pide carpeta
node herramientas/pruebas/vfx.mjs                                    # no pide carpeta
node herramientas/pruebas/vfx-jefes.mjs                               # no pide carpeta
node herramientas/pruebas/ui.mjs                                     # no pide carpeta
node herramientas/pruebas/naves.mjs                                  # no pide carpeta
node herramientas/pruebas/hangar.mjs                                 # no pide carpeta
node herramientas/pruebas/hangar-fileurl.mjs                         # abre con file://
node herramientas/pruebas/admin.mjs                                  # no pide carpeta

# jefes, por tandas
node herramientas/pruebas/jefes.mjs         artifacts/screenshots/x   # M1 · M5
node herramientas/pruebas/bosses-m2-m4.mjs  artifacts/screenshots/x
node herramientas/pruebas/campana-final.mjs artifacts/screenshots/x   # M6-M10

# duraciones reales, con un piloto que APUNTA al jefe
node herramientas/pruebas/duracion-m2-m4.mjs
node herramientas/pruebas/duracion-m6-m10.mjs

# una misión entera en tiempo real (--inmune para medir su duración)
node herramientas/pruebas/mision-completa.mjs artifacts/screenshots/x [1-10] [--inmune]
```

> Ojo con el piloto automático: `mision-completa.mjs` busca la columna
> más despejada, que durante un combate de jefe significa **lejos del
> jefe**. Mide bien el tránsito de una misión y fatal el combate. Para
> medir un jefe hay que usar `duracion-*.mjs`, que se coloca debajo.

> **Los FPS que salen ahí no valen.** Chromium sin ventana compone el
> canvas por software, sin GPU: son un suelo pesimista, no una medida de
> lo que hace un iPad. Lo que sí es fiable es todo lo demás — conteos,
> reservas, fugas y errores.

## Rendimiento

- Reserva de objetos para partículas, balas y efectos. Comprobado que
  vuelven todas: tras 30 s de tormenta y vaciar el campo, 419 partículas
  en la reserva y 1 viva.
- Tope de partículas por nivel de calidad (420 / 240 / 120).
- Tope de 340 proyectiles enemigos. No es una optimización: por encima
  de eso la pantalla deja de tener huecos.
- Tope de 26 voces de audio con prioridades, más un cupo por grupo
  (4 disparos, 5 disparos enemigos, 6 impactos, 4 explosiones, 2 jefe).
- Tope en cada sistema ambiental de la segunda mitad: 26 rocas, 6 pozos
  gravitatorios, 5 carriles de calor, 8 zonas tóxicas.
- Calidad **automática** en tres niveles. Recorta partículas, estelas y
  brillo decorativo — nunca lógica de juego. Baja tras 1,5 s por debajo
  de 46 fps y sube tras 12 s por encima de 56, para que no oscile.

Al morir un jefe, `matarMiniboss()` vacía pozos, carriles y sistemas de
forma **genérica**: ningún jefe nuevo tiene que acordarse de limpiar lo
ambiental. Lo suyo propio (nodos, orbitadores, subsistemas) va por su
`onMuerte`.

## Ajustes

En **AJUSTES** dentro del juego: volumen general, efectos y música,
silencio, calidad, sacudida de cámara, congelado de impacto y núcleo
visible. Todo se guarda.

En la cabecera de `index.html`, para tocar los números:

- **`CONFIG`** — vidas, velocidad, cadencia, dificultad, tamaño de nave
- **`PROPORCION_MAX`** — proporción del campo de juego
- **`TEMAS`** — los cuatro mundos
- **`CARPETAS`** — dónde se buscan los dibujos

## Lenguaje visual

Dos reglas que no dependen del mundo y conviene no romper:

**Tu disparo es alargado. El suyo es redondo y rosa.** Fijo en los
cuatro mundos, porque lo que te mata no puede cambiar de aspecto cada
vez que cambias de mundo. Se distingue por **forma** antes que por
color: en blanco y negro se seguiría leyendo. La única excepción
deliberada es la lanza del francotirador, que rompe la regla justo
porque es el disparo que hay que reconocer al instante.

**Los mundos van oscuros y el color lo pone la nave.** La nave y el
mundo se eligen por separado: si el fondo también grita, se pelean.

## Añadir contenido

**Un enemigo** es una entrada en la tabla `ENEMIGOS`: sus números, su
forma, y las funciones `mover(e, dt)`, `atacar(e)` y opcionalmente
`telegrafo(e)`, `alGolpe(e, b, dmg)` y `dibujarExtra(e)`. No hay que
tocar `update()` ni el dibujado. Si además existe
`art/enemigos/<tipo>.png`, se recoge solo.

**Un arma** es una entrada en `ARMAS`. `tiros(n)` dice dónde y hacia
dónde sale cada proyectil; el resto de la ficha dice a qué suena, qué
deja al impactar y de qué color es. Cambiar el aspecto de un arma nunca
obliga a tocar cómo dispara.

**Un jefe** es una entrada en `JEFES` con sus fases y sus ataques. La
puesta en escena —aviso, entrada, transición, muerte cinemática,
victoria— viene de serie y es la misma para los diez. Si necesita algo
propio, hay siete enganches opcionales y ninguno es obligatorio:

| | |
|---|---|
| `onSpawn(mb)` | estado propio al aparecer (nodos, pods, subsistemas) |
| `onEntrada(mb, dt, k)` | cada fotograma de la bajada, `k` = 0..1 |
| `reduccionDano(mb)` | multiplicador de daño recibido |
| `onDetonar(mb)` | extra en el instante de la explosión grande |
| `onMuerte(mb)` | limpieza inmediata, antes de la cinemática |
| `dibujarExtra(mb, f)` | dibujo en espacio de mundo |
| `epico: true` | alarga la muerte cinemática (solo el jefe final) |

Y por fase, `alEntrar(mb)`. El motor no sabe qué es un asteroide ni un
pozo gravitatorio: solo llama al enganche si existe.

**Una misión** es una entrada en `MISIONES` con su lista de eventos
`{ t, fn, ... }`. Los verbos disponibles son `ola`, `reward`, `miniboss`,
`hazardOn/Off`, `defensa`, `zonaOn/Off`, `zonaCol`, `pozo`, `carril` y
`sistemas`.

## Audio

**71 sonidos, 124 archivos, 374 kB.** El banco vive en
`audio/muestras.js` como MP3 mono en base64, y se carga con un
`<script src>` clásico para que el juego siga sonando abierto con doble
clic: con `file://` está prohibido `fetch()`, y esa es la razón de que
antes todo fuera síntesis.

Cada sonido se fabrica fuera de línea con
`node herramientas/forjar-audio.mjs`, mezclando capas CC0 de Kenney con
síntesis propia. La regla de la paleta es siempre la misma —transitorio
de banda ancha, cuerpo en 120–900 Hz y sub saturado— y es lo que separa
un arcade moderno de un «piu piu». Las recetas están en
`herramientas/audio/paleta.mjs`, una por sonido y legibles.

La **mezcla** no se ajusta a oído en el juego: cada categoría se
normaliza en el horno a una sonoridad fija (jefe −12 dB, explosión −15,
disparo propio −19,5, disparo enemigo −23), así que la jerarquía está
cerrada en la fuente. Encima, en el navegador: siete grupos con cupo
propio de voces, agachado por prioridad —la explosión de jefe aparta un
instante los disparos—, compresor y un techo de saturación suave que
hace imposible el recorte digital. Medido en
`herramientas/pruebas/audio-mezcla.mjs`: el peor caso imaginable se
queda en 0,94 de pico.

Para que treinta explosiones no suenen a la misma explosión: 1–4
variantes por sonido con rotación que no repite la anterior, más
variación de afinación y de volumen acotada.

La síntesis de antes **sigue en `index.html` como repuesto**. Cubre el
segundo que tarda el banco en descodificarse y cubre el caso de que el
banco falte. El juego no se queda mudo nunca.

## Música

**Quince pistas y cuatro cortes, 17 MB**, en `audio/musica/`. El sistema
vive en `js/music.js`, cargado con `<script src>` clásico como el banco
de efectos. Diez pistas son del bloque base; cinco más (`combate_c`,
`combate_d`, `combate_e`, `jefe2`, `final2`) las trajo la expansión en
el bloque 5I.

| Estado | Pista |
|---|---|
| Menú | `menu` |
| Combate (campaña base) | `combate_a` y `combate_b`, alternando por misión |
| Combate (expansión) | `combate_c`/`combate_d`/`combate_e` según el mundo — ver `js/misiones.js` |
| Jefes 1–9 | `jefe` |
| OMEGA SOVEREIGN | `jefe_final`, pista propia |
| KRYOS · VÉRTICE · NÝX · VULCANO | `jefe2` |
| AXIOMA | `final2`, pista propia — deliberadamente más lenta que `jefe2` |
| Hangar y pausa | `hangar` |
| Cortes | misión completada · victoria · derrota · desbloqueo |

Lo que hace que no suene a pistas puestas en bucle:

- **Cruces de potencia constante** entre estados (0,8–1,5 s). Dos rampas
  lineales cruzadas dejan un hoyo de 3 dB justo en el centro; con seno y
  coseno la suma de potencias es constante y el cambio no se oye.
- **Bucle cruzando la pista consigo misma** con doble elemento, en vez
  de confiar en `loop`, que en Safari deja un hueco audible.
- **El jefe sube de intensidad por fases.** Las pistas son mezclas
  planas y no traen capas sueltas, así que la subida se hace abriendo un
  paso bajo y ganando 1 dB: entra sentada atrás y se pone entera en la
  fase final. Enganchado en `cambiarFase()`, un solo sitio para los diez
  jefes.
- **La explosión de jefe aparta la música** y la devuelve sola. Es el
  mismo mecanismo de agachado que ya usaban los efectos.
- **Dos pistas de combate** alternando, para que diez misiones de seis
  minutos no sean la misma pista diez veces.

Y lo que tenía que seguir funcionando y sigue: silencio, volumen propio
de música, vuelta de segundo plano **por donde iba** y arranque en iOS
dentro del primer gesto. **Con doble clic también suena**: `file://`
deja leer un MP3 desde disco: lo que no deja es enrutarlo por WebAudio,
así que ahí se pierden el agachado y el filtro, y nada más.

Todo eso lo comprueba `node herramientas/pruebas/musica.mjs`, con
medidas reales tomadas a la salida del compresor.

Las pistas son **CC0 de OpenGameArt**, verificadas una a una en su
página de origen; los cortes se forjan con `dsp.mjs` porque el pack no
traía ninguno. Se preparan con
`node herramientas/preparar-musica.mjs`, que las recorta y las
**normaliza todas a −16 LUFS** — venían con 6,5 LU de diferencia entre
la más fuerte y la más floja, y una de ellas recortaba sola. Las cinco
de la expansión se preparan aparte, con
`node herramientas/preparar-musica-expansion.mjs` (mismo contrato de
sonoridad; no hace falta recortarlas porque las cinco son bucles de
compás exacto).

Fuentes, licencias, hashes y créditos en
[`THIRD_PARTY_AUDIO_LICENSES.md`](THIRD_PARTY_AUDIO_LICENSES.md).
Música de Alex McCulloch, MintoDog, nene y The Cynic Project (CC0).
Efectos de [Kenney](https://kenney.nl/assets/sci-fi-sounds) (CC0).

## Guardado

Todo en `js/save.js`. Clave `sf_save` de `localStorage` —o `sf_admin_<perfil>` en modo ADMIN, ver más arriba—, **esquema v2**,
con copia de seguridad en `sf_save_prev`.

**El progreso es monotónico.** `campana.misionMax` solo sube: no se
asigna a pelo en ninguna parte, se pasa por `SAVE.subirMision()`, que
hace el máximo. Lo mismo con el récord global y con los récords por
misión. Esto arregla un bug real: `misionIdx` era a la vez «misión
elegida» y «máxima desbloqueada», así que rejugar la M1 con diez
desbloqueadas y terminarla **volvía a bloquear de la M5 a la M10**.
Ahora son dos campos distintos y el máximo no tiene forma de bajar.

| | |
|---|---|
| `campana` | `misionMax` · `misionIdx` · `completada` · `stats` · `records` · `temaId` |
| `perfil` | `record` · `eloi` · `partidas` · `misionesCompletadas` · `jefesDerrotados` · `tiempoJugado` |
| `naves` | `seleccionada` · `desbloqueadas` · `config` |
| `opciones` | los ocho ajustes, incluido `vfx` |
| `meta` | `creado` · `ultimoGuardado` |

**Se guarda solo**: al completar misión, al desbloquear, al hacer
récord, al morir, al cambiar de nave, al tocar los ajustes, al derrotar
a un jefe, y **al irse de la página**. Lo cotidiano pasa por un freno de
400 ms —`localStorage` es síncrono y cinco toques al volumen serían
cinco escrituras dentro del fotograma—; lo importante se escribe en el
acto.

En iOS **no se depende de `beforeunload`**, que Safari puede saltarse:
lo que manda son `pagehide` y el paso a oculto de `visibilitychange`,
que son los que sí llegan al cambiar de app o bloquear la pantalla.

**Nada de esto puede impedir jugar.** Un JSON a medias se rescata de la
copia; si tampoco se puede, se arranca de cero. Un save de una versión
posterior se lee, no se borra. Un navegador que no deja escribir —el
modo privado de Safari— se avisa en AJUSTES y el juego se juega igual.
Cada campo se valida contra su tipo y sus topes al entrar.

**Migraciones**: v0 (claves sueltas `sf_record`, `sf_nave`…) → v1 → v2,
encadenadas. **Nunca se descarta un save por su versión** — que es lo
que hacía la v1, y por eso subir el número habría borrado todas las
partidas.

En AJUSTES hay **BORRAR PROGRESO**, con una confirmación que dice
exactamente qué se pierde. Los ajustes de sonido no se tocan.

Y para rescatar una partida de un aparato a otro, desde la consola:

```js
copy(SAVE.exportar())      // en el aparato viejo
SAVE.importar('<pegado>')  // en el nuevo
```

`node herramientas/pruebas/guardado.mjs` lo comprueba: 60 casos, entre
ellos el del bug, el save corrupto, las tres migraciones, el modo
privado y el borrado.

## Probarlo en el iPad o el iPhone

Lo más rápido, y sin publicar nada:

```
node herramientas/servir.mjs
```

Escribe las direcciones que hay que abrir en el iPad. El PC y el iPad
tienen que estar en la **misma WiFi**, y la primera vez Windows preguntará
si deja pasar Node por el cortafuegos: hay que decir que sí a *redes
privadas*.

No vale copiar la carpeta al iPad y abrir el archivo: con `file://` el
navegador no deja leer los píxeles de una imagen de disco y el recorte de
fondo no funciona. Hace falta HTTP, que es justo lo que hace esto.

Añadiendo `?debug` a la dirección sale el panel de diagnóstico —estado
del audio, FPS, conteos— que es lo que hay que mirar si algo va raro en
el aparato.

## Ponerlo en la tablet

Con Pages activado, abrir el enlace en Safari y **Compartir → Añadir a
pantalla de inicio**. Queda a pantalla completa y funciona sin conexión.

> GitHub Pages necesita repositorio público en las cuentas gratuitas. La
> alternativa sin repositorio es [Netlify Drop](https://app.netlify.com/drop).
