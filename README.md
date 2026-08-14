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

**CAMPAÑA** — cinco misiones con guion de eventos, identidad propia y
jefe al final.

| | Misión | Identidad |
|---|---|---|
| M1 | PRIMER CONTACTO | Introducción al combate |
| M2 | CINTURÓN DE ASTEROIDES | Movimiento y esquiva |
| M3 | RED DE DEFENSA | Prioridad de objetivos |
| M4 | SECTOR TÓXICO | Control del espacio |
| M5 | FISURA HELADA | Élites, hielo y el TITÁN |

Cada misión suelta **familias de arma distintas**, así que salir de la M2
con misiles y de la M5 con crio no es casualidad: es lo que hace que la
campaña no sepa toda igual.

**SUPERVIVENCIA** — el modo original, intacto. Cuatro mundos, oleadas sin
fin, dificultad por tiempo.

## Las naves

Se diferencian en la mano, no solo en la ficha. Los números están
acotados a ±35 % para que elegir sea una preferencia y no una trampa.

| | | Velocidad | Daño | Cadencia | Zona de impacto | Sale con |
|---|---|---|---|---|---|---|
| **KALI** | ASALTO | ×0.86 | ×1.38 | ×1.14 | ×1.10 | Cañón |
| **YOLI** | INTERCEPTOR | ×1.32 | ×0.82 | ×0.88 | ×0.78 | Repetidor |
| **SILVIA** | VANGUARDIA | ×1.08 | ×1.00 | ×0.96 | ×0.84 | Eléctrico + escudo |
| CLÁSICA | POLIVALENTE | ×1 | ×1 | ×1 | ×1 | Cañón |

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

En **ELIGE NAVE**, la casilla `+ CARGAR`. Se elige un PNG y aparece en el
selector, guardada en el navegador. Caben 4; para borrar una, la `×` de
su esquina. En el iPad el `+` abre la galería de fotos.

El juego le quita el fondo automáticamente si es de un color plano
—magenta, blanco, verde— mediante relleno por inundación desde los
bordes, así que los blancos del interior de la nave se conservan.

## La carpeta `art/`

Las imágenes que trae el juego de serie. Cada subcarpeta tiene su
`LEEME.txt` con los nombres exactos.

```
art/naves/        kali · yoli · silvia
art/enemigos/     normal · veloz · torreta · tanque · kamikaze ·
                  bombardero · francotirador · portaescudos · elite
art/bosses/       guardian · titan
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
node herramientas/pruebas/nucleo.mjs   artifacts/screenshots/x
node herramientas/pruebas/frontal.mjs  artifacts/screenshots/x
node herramientas/pruebas/jefes.mjs    artifacts/screenshots/x
node herramientas/pruebas/aguante.mjs  artifacts/screenshots/x
node herramientas/pruebas/mision-completa.mjs artifacts/screenshots/x [1-5]
```

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
- Tope de 24 voces de audio con prioridades.
- Calidad **automática** en tres niveles. Recorta partículas, estelas y
  brillo decorativo — nunca lógica de juego. Baja tras 1,5 s por debajo
  de 46 fps y sube tras 12 s por encima de 56, para que no oscile.

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
victoria— viene de serie y es la misma para todos.

## Audio

Cuarenta sonidos, cero archivos: todo síntesis en el navegador. Cuatro
buses con compresor a la salida, límite de voces, prioridades y
variación de afinación.

La música está **pendiente a propósito**. La arquitectura está puesta y
el juego ya la pide en los momentos correctos; lo que falta son pistas
con licencia comercial verificable. Los motivos y las reglas, en
[`THIRD_PARTY_AUDIO_LICENSES.md`](THIRD_PARTY_AUDIO_LICENSES.md).

## Ponerlo en la tablet

Con Pages activado, abrir el enlace en Safari y **Compartir → Añadir a
pantalla de inicio**. Queda a pantalla completa y funciona sin conexión.

> GitHub Pages necesita repositorio público en las cuentas gratuitas. La
> alternativa sin repositorio es [Netlify Drop](https://app.netlify.com/drop).
