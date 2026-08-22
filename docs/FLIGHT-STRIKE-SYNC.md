# Flight Strike dentro de PLAYZONE

## La regla

```
ORIGEN   strike-flight-repo          ← el juego. Aquí se toca.
DESTINO  max/001-flight-strike/      ← una copia. Aquí NO se toca nunca.
```

El destino se regenera entero con un comando. Cualquier cosa que edites a
mano ahí dentro la borrará la siguiente sincronización, y `verify` te la
señalará antes.

PLAYZONE se adapta al juego. El juego no se toca para que quepa en PLAYZONE.

## Los tres comandos

```bash
# Traer el juego canónico a PLAYZONE
npm run sync-flight-strike -- "C:/Users/TeRuLeT/Desktop/PROJECTES SOFTS/JOCS/strike-flight-repo"

# ¿Sigue siendo el mismo juego? (sale con código 1 si no)
npm run verify-flight-strike-sync
npm run verify-flight-strike-sync -- --source "C:/.../strike-flight-repo"   # y ademas ¿el origen ha avanzado?

# Comparar juego suelto vs juego en PLAYZONE en iPhone, iPad y escritorio
npm run qa-flight-strike -- "C:/.../strike-flight-repo"     # necesita: npm i
```

`sync` acepta `--dry-run` (no escribe nada, solo enseña qué copiaría) y
`--label "texto"` (deja anotado de dónde vino, para leerlo luego en
`verify`).

## Qué se copia y qué no

Lista de **exclusión**, no de inclusión: si el juego estrena una carpeta de
assets que estas herramientas no conocen, se copia igual. Preferimos copiar
de más antes que perder un asset.

Se quedan fuera: `.git`, `.github`, `.claude`, `node_modules`, `herramientas/`,
`tools/`, `tests/`, `docs/`, `screenshots/`, los `.md`, los `LEEME`/`README`,
los `.zip`, los `.psd` y los ficheros de configuración de proyecto.

`sync` **imprime todo lo que deja fuera**, agrupado por motivo. No hay
recortes silenciosos: si algo que hacía falta se queda fuera, lo verás en
la lista y se ajusta la exclusión en `tools/flight-strike/common.mjs`.

## La única diferencia permitida

El juego en PLAYZONE es byte a byte el mismo fichero que en el origen, con
**una línea añadida** antes de `</body>`:

```html
<script src="../_playzone/overlay.js" defer></script>
```

Ese `overlay.js` vive en `max/_playzone/`, **fuera del juego**, y es todo lo
que PLAYZONE añade: el botón de volver al catálogo. Está fuera a propósito —
si estuviera dentro del `index.html`, cada sincronización lo pisaría y
volveríamos a tener dos Flight Strike distintos, que es justo el problema
que esto resuelve.

`verify` descuenta esa línea antes de comparar la huella sha256. Por eso
puede afirmar "esto es el juego canónico" sin mirarlo a ojo.

### Qué hace el overlay, y qué no hace

Hace: pinta el botón, y lo esconde mientras se juega (así no tapa el
`NIVEL n` que el juego dibuja arriba a la izquierda, y no se pulsa sin
querer al arrastrar la nave). Vuelve tras 1,6 s sin tocar la pantalla.
Sólo sale del juego con un toque limpio: si el dedo arrastra, se cancela.

No hace: leer variables del juego, parar eventos, ni tocar el lienzo, su
tamaño o su escala. El juego no se entera de que existe.

## La ficha: `max/001-flight-strike/build-info.json`

La escribe `sync`. Lleva el commit del origen, la fecha, y la huella sha256
de cada fichero. Es lo que hace posible la comprobación de paridad. **No se
edita a mano.**

## Cómo se rompería esto

`verify` sale con código 1 en los cinco casos, y los cinco están probados:

| Qué pasó | Qué dice |
|---|---|
| Alguien editó el `index.html` del destino | `index.html NO coincide con el del origen` |
| Falta un asset | `Falta en el destino: art/...` |
| Se coló un fichero de más | `Sobra en el destino` |
| Se perdió la línea del overlay | `no habría salida al catálogo` |
| El origen avanzó y PLAYZONE se quedó atrás | `El origen ha cambiado desde la última sincronización` (sólo con `--source`) |

## Guardado

El juego guarda en `localStorage` con claves `sf_*` (`sf_record`, `sf_nave`,
`sf_naves`, `sf_tema`).

`localStorage` va **por origen, no por ruta**. En un mismo dominio, la
portada de PLAYZONE, el catálogo MAX y el juego comparten el mismo almacén:
comprobado, el récord sobrevive al ir de `/max/001-flight-strike/` a `/max/`
y a `/`. Consecuencias:

- Mover el juego de carpeta **dentro del mismo dominio** no pierde partida.
- Cambiar de dominio (de `usuario.github.io/strike-flight` a
  `usuario.github.io/playzone`, o a un dominio propio) **sí** estrena
  guardado: son orígenes distintos y el navegador no los comunica. No hay
  nada que migrar salvo que se quiera hacer a mano.
- Ningún otro juego de PLAYZONE usa el prefijo `sf_`. No hay colisiones.

## Audio en iOS

El juego crea el `AudioContext` en el primer `pointerdown` sobre el lienzo,
que es lo que exige Safari. El overlay de PLAYZONE **no** intercepta ese
gesto: escucha en captura pero no llama a `preventDefault` ni corta la
propagación. Comprobado con la política de autoplay estricta: sin contexto
antes del gesto, `running` después.

## Service worker

PLAYZONE no registra ninguno en la raíz ni en `max/`. El único `sw.js` del
repositorio está en `rush/playzone-rush/public/`, que es material de origen
de esa app y no se publica en esta ruta. Es decir: **una versión vieja de
Flight Strike no puede venir de una caché de PLAYZONE.** Si algún día se
añade un service worker, tendrá que excluir `max/001-flight-strike/` o
versionar su caché con el `commit` de `build-info.json`.
