# Sonido de Kali World 3D — paquete de búsqueda

Esto **no es de FLIGHT STRIKE**. Es el trabajo de sonido para
[terulet/KaliWorld3D](https://github.com/terulet/KaliWorld3D), y está aquí
porque esta sesión tenía este repositorio como destino. Cuando convenga, se
copia allí tal cual:

| De aquí | A KaliWorld3D |
|---|---|
| `AUDIO.md` | `docs/AUDIO.md` |
| `sonidos.json` | `docs/sonidos.json` |
| `fuentes.json` | `docs/fuentes.json` |

## Qué hay

| Fichero | Qué es |
|---|---|
| `AUDIO.md` | el documento: qué suena, cuándo, de dónde se saca y cómo entra en Unity |
| `sonidos.json` | los 84 sonidos y las 11 pistas, con su gancho en el código y su prioridad, para que lo lea un programa |
| `fuentes.json` | los sitios de donde bajarlo, con licencia y para qué sirve cada uno |

## Lo que hay que saber antes de usarlo

**No hay ni un fichero de audio descargado.** El contenedor de esta sesión no
tiene salida a `kenney.nl`, `opengameart.org`, `freesound.org` ni `pixabay.com`:
el proxy de red las bloquea. Así que esto es la lista de la compra, hecha y
razonada, pero la compra se hace en el Mac, que es donde vive el proyecto de
Unity (`/Volumes/KALI WORLD 3D/PROJECTES/KaliWorld3D`).

Y al bajarlo, **la licencia se lee en la página del ítem**: en OpenGameArt cada
publicación tiene la suya. Las filas marcadas «comprobar» en `fuentes.json` son
exactamente esas. Los paquetes de Kenney son CC0 enteros y no hacen falta
comprobarlos uno a uno.

## Lo siguiente

1. Bajar, en el Mac, lo marcado como **KW3D-002** en `sonidos.json`: 27 sonidos
   (45 ficheros), 5 bucles de música y 3 remates.
2. Guardarlo sin tocar en `Fuentes~/` y anotar autor, página, licencia, fecha y
   SHA-256 en un `AUDIO-LICENCIAS.md`, como se hizo en FLIGHT STRIKE.
3. Publicar `ArcadeCarController.Slip` y añadir `SuperficieDeSonido`. Son las dos
   únicas cosas que hay que tocar del juego.
4. Escribir los cinco componentes de la tabla del punto 5 de `AUDIO.md`.
