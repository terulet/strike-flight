# PLAYZONE

El paraguas de todos los juegos que vamos haciendo.

Son dos zonas, cada una con su portada y su icono propio:

- **PLAYZONE** (`index.html`) — los **minijuegos**: partida corta, se
  entiende en cinco segundos, se juega de pie.
- **PLAYZONE MAX** (`max/index.html`) — los **juegos grandes**: mundos,
  progresión, jefes. Aquí vive Strike Flight.

Sin instalar nada, sin compilar y sin conexión. Un archivo por juego.

## Jugar

Doble clic en `index.html`. Desde ahí se llega a todo.

## Cómo está montado

```
index.html                     ← PLAYZONE, la portada
minijuegos/
  LEEME.txt                    ← cómo añadir un minijuego
  esquiva/index.html
max/
  index.html                   ← PLAYZONE MAX, la portada
  strike-flight/
    index.html
    README.md · LEEME.txt · AUDITORIA.md
    art/                       ← aquí van los PNG de Strike Flight
```

Cada juego es un `index.html` que no depende de nada externo, así que se
puede abrir suelto, mover de sitio o borrar sin romper el resto. Las dos
portadas son lo único que sabe qué juegos existen.

## Añadir un juego

En la cabecera de cada portada hay una lista, comentada en español:

- minijuego nuevo → lista `MINIJUEGOS` de `index.html`
- juego grande → lista `JUEGOS` de `max/index.html`

Se copia una línea, se cambian los datos y se recarga. Con `listo:false`
la casilla queda en gris como «próximamente», que sirve para reservar el
hueco de algo que aún no existe sin romper nada.

Los detalles, en `minijuegos/LEEME.txt`.

## Ponerlo en la tablet

Con GitHub Pages activado, abrir el enlace en Safari y **Compartir →
Añadir a pantalla de inicio**.

Las dos portadas se pueden añadir por separado: PLAYZONE con la raíz, y
PLAYZONE MAX abriendo antes `max/`. Quedan como dos apps distintas, cada
una con su nombre, a pantalla completa y funcionando sin conexión.
