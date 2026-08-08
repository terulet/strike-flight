# Strike Flight

Matamarcianos vertical para jugar en tablet. Un solo archivo, sin dependencias,
sin compilar y sin conexión.

## Jugar

Doble clic en `index.html`.

Se arrastra el dedo (o el ratón) por cualquier parte de la pantalla y la nave
sigue. Dispara sola: solo hay que esquivar y recoger premios.

## Cargar tus propias naves

En el menú, casilla **`+ CARGAR`**. Eliges un PNG y ya está: aparece en el
selector y se queda guardada en el navegador.

El juego le quita el fondo automáticamente si es de un color plano —
magenta, blanco, verde— mediante relleno por inundación desde los bordes,
así que los blancos del interior de la nave se conservan. Después la recorta
y la ajusta de tamaño.

Caben 4 naves. Para borrar una, la `×` de su esquina.

En el iPad el `+` abre la galería de fotos.

## La carpeta `art/`

Para que las naves vengan puestas de serie en vez de cargarlas a mano. Cada
subcarpeta tiene su `LEEME.txt` con los nombres exactos:

```
art/naves/kali.png       art/enemigos/normal.png
art/naves/yoli.png       art/enemigos/veloz.png
art/naves/silvia.png     art/enemigos/torreta.png
                         art/enemigos/tanque.png
                         art/enemigos/kamikaze.png
```

Lo que falte se dibuja por código. No se rompe nada.

### También vale `assets/`

Cada dibujo se busca en varias carpetas y gana la primera que lo tenga:

```
art/naves/kali.png  →  assets/naves/kali.png  →  assets/kali.png
```

Así que si tu carpeta se llama `assets\`, o si tienes los PNG sueltos sin
subcarpeta, funciona igual sin renombrar nada. La lista está en `CARPETAS`,
arriba del todo de `index.html`: añadir un sitio donde buscar es una línea.

> Los nombres, **en minúsculas**. Windows no distingue `KALI.PNG` de
> `kali.png`, pero GitHub Pages sí: en mayúsculas te funcionaría en el
> ordenador y fallaría en el iPad.

### Dejar los PNG recortados

Abriendo con `file://`, el navegador no deja leer los píxeles de una imagen
de disco, así que a las de `art/` no se les puede quitar el fondo en ese modo.
Servido por HTTP —GitHub Pages— el juego lo hace solo.

Para que funcione también con doble clic, se pasan una vez por la herramienta:

```
npm i -D playwright && npx playwright install chromium
node herramientas/recortar.mjs art/
```

Quita el fondo, recorta al contenido, reduce a 512 px y guarda el resultado en
el propio archivo. Es idempotente: volver a pasarla no estropea nada.

No duplica el algoritmo — abre el propio `index.html` en un navegador sin
ventana y llama a su `prepararSprite()`, así que el resultado es idéntico al
del juego por construcción. Playwright hace falta solo para esto: el juego
sigue sin dependencias.

## Requisitos de las imágenes

- La nave **mirando hacia arriba**
- Los enemigos hacia abajo, o simétricos
- PNG con transparencia, o con fondo de un color plano
- Del tamaño que sea: se reducen a 512 px por el lado largo

## Ajustes

Todo en la cabecera de `index.html`, comentado en español:

- **`CONFIG`** — vidas, velocidad, cadencia de disparo, dificultad, tamaño de
  la nave, y `llamasMotor` (viene en `false` porque las naves ya traen las
  llamas dibujadas; ponlo a `true` si alguna viene sin ellas).
- **`TEMAS`** — los cuatro mundos. Copiar un bloque y cambiar los colores es
  un mundo nuevo.
- **`CARPETAS`** — dónde se buscan los dibujos.

## Lenguaje visual

Dos reglas que no dependen del mundo, y conviene no romperlas al añadir cosas:

**Tu disparo es alargado y cian. El suyo es redondo y rosa.** Fijo en los
cuatro mundos (`TIRO_TUYO` y `TIRO_SUYO`), porque lo que te mata no puede
cambiar de aspecto cada vez que cambias de mundo. Y se distingue por **forma**
antes que por color: en blanco y negro se seguiría leyendo. Los premios son
chapas **cuadradas** — no hay ningún otro cuadrado en pantalla.

**Los mundos van oscuros y el color lo pone la nave.** La nave y el mundo se
eligen por separado, así que cualquiera puede acabar en cualquiera: si el
fondo también grita, se pelean. Los enemigos tienen prohibido el rosa y el
cian, que están reservados a las balas.

Todo lo que dibuja el código lleva contorno oscuro (`TINTA`) más un filo claro
por fuera, para pegar con arte de contorno grueso. El filo claro hace falta:
un contorno negro sobre fondo negro no separa nada.

## Contenido

Cuatro mundos y cinco tipos de enemigo: normales, veloces en zigzag, torretas
que apuntan, acorazados con barra de vida, y kamikazes que persiguen a la nave
con giro limitado —siempre esquivables—. Seis niveles de arma, cinco premios,
combos con multiplicador y récord guardado.

Sonido generado por síntesis: cero archivos de audio.

## Añadir un enemigo

Los enemigos están dirigidos por datos: una entrada en la tabla `ENEMIGOS` y
listo. No hay que tocar `update()` ni el dibujado. El kamikaze completo son
estas líneas:

```js
kamikaze: {
  r: 15, hp: 2, puntos: 35, vel: 1.2, forma: "punta",
  color: t => t.enemigoB,
  init(e) { e.vx = 0; },
  mover(e, dt) {
    caer(e, dt);
    e.vx = clamp(e.vx + Math.sign(player.x - e.x) * 400 * dt, -230, 230);
    e.x = clamp(e.x + e.vx * dt, e.r, W - e.r);
    e.giro = Math.atan2(e.vx, Math.max(e.vy, 1)) * 0.6;
  },
},
```

Si además pones `art/enemigos/kamikaze.png`, se recoge solo.

El modo de juego actual es **supervivencia** (`elegirTipo()`): mezcla
aleatoria que se abre según el nivel. La campaña por niveles se construye al
lado, sin sustituirlo. El plan completo está en [`AUDITORIA.md`](AUDITORIA.md).

## Ponerlo en la tablet

Con Pages activado, abrir el enlace en Safari y **Compartir → Añadir a
pantalla de inicio**. Queda a pantalla completa y funciona sin conexión.

> GitHub Pages necesita que el repositorio sea público en las cuentas
> gratuitas. Si en algún momento pasa a privado, Pages deja de servir: la
> alternativa sin repositorio es [Netlify Drop](https://app.netlify.com/drop),
> que publica arrastrando la carpeta.
