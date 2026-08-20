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

Para que las naves vengan puestas de serie en vez de cargarlas a mano:

```
art/naves/kali.png
art/naves/yoli.png
art/naves/silvia.png

art/enemigos/normal.png
art/enemigos/veloz.png
art/enemigos/torreta.png
art/enemigos/tanque.png
```

Lo que falte se dibuja por código. No se rompe nada.

> Abriendo con `file://`, el navegador no deja leer los píxeles de una imagen
> de disco, así que a estas no se les puede quitar el fondo: tienen que venir
> ya con transparencia. Servido por HTTP (GitHub Pages) sí funciona el
> recorte automático.

## Requisitos de las imágenes

- La nave **mirando hacia arriba**
- Los enemigos hacia abajo, o simétricos
- PNG con transparencia, o con fondo de un color plano
- Del tamaño que sea: se reducen a 512 px por el lado largo

## Ajustes

Todo en la cabecera de `index.html`, comentado en español:

- **`CONFIG`** — vidas, velocidad, cadencia de disparo, dificultad, tamaño de
  la nave, y `llamasMotor` (ponlo a `false` si tu nave ya lleva las llamas
  dibujadas).
- **`TEMAS`** — los cuatro mundos. Copiar un bloque y cambiar los colores es
  un mundo nuevo.

## Contenido

Cuatro mundos, cuatro tipos de enemigo (normales, veloces en zigzag, torretas
que apuntan, y acorazados con barra de vida), seis niveles de arma, cinco
premios, combos con multiplicador, y récord guardado.

Sonido generado por síntesis: cero archivos de audio.

## Ponerlo en la tablet

Con Pages activado, abrir el enlace en Safari y **Compartir → Añadir a
pantalla de inicio**. Queda con icono propio, a pantalla completa y funciona
sin conexión.
