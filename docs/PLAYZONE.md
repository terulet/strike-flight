# PLAYZONE

Marca paraguas de una colección de juegos arcade independientes.

## La filosofía

> entrar → entender enseguida → jugar → fallar o terminar → querer repetir →
> superar tu marca → superar a un amigo

No buscamos que todos tengan la misma mecánica. Al revés: cada uno mide una
habilidad distinta —reflejos, precisión, conducción, memoria, puntería, riesgo,
timing, nervios, optimización, score attack—, y esa variedad **es** el catálogo.

## Las dos zonas

- **PLAYZONE** (`index.html`) — la portada y el catálogo entero.
- **PLAYZONE MAX** (`max/index.html`) — los juegos grandes, con mundos,
  progresión y jefes. Aquí vive Flight Strike.

## La regla que manda

Cada juego tiene que poder **desarrollarse, ejecutarse, probarse, desplegarse,
publicarse y venderse por separado**.

PLAYZONE es el paraguas, no una excusa para acoplar. En la práctica:

- ningún juego importa código de otro;
- ningún juego comparte configuración con otro;
- cada uno trae sus propios assets, sus propios tests y su forma de arrancar;
- las portadas son lo único que sabe qué juegos existen, y solo guardan una
  ruta y cuatro datos por juego.

Si un día un juego se va a su propio repositorio, se mueve su carpeta y se
borra su línea de la lista. No hay nada más que desenredar.

## Numeración

Un número por juego, asignado al crearlo, **y no se reutiliza nunca**. Da igual
que un juego se abandone: su número se queda con él. El siguiente es el 008.

## Guardado

Cada juego guarda en `localStorage` con su propio prefijo `pz_<juego>_`, para
que nunca se pisen entre ellos:

`pz_apex_*` · `pz_nss_*` · `pz_cross_*` · `pz_redline_*` · `sf_*` (Flight Strike)

## Cómo se juega

Servido por HTTP o GitHub Pages funciona todo. Abriendo con doble clic
funcionan los juegos de un solo archivo (001, 004, 005, 006, 007); 002 y 003
usan módulos ES y necesitan su servidor, que traen incluido.

## Añadir el 008

1. Carpeta nueva en `games/008-loquesea/`.
2. Una línea en la lista `CATALOGO` de `index.html`, con `listo:false` mientras
   se construye: sale en gris como «en construcción» y no rompe nada.
3. Cuando funcione, `listo:true`.

Si es un juego grande, va en `max/` y lleva la insignia MAX.
