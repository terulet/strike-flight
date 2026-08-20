# PLAYZONE

Marca paraguas de una colección de juegos arcade independientes.

| Nº | Juego | Género | Dónde |
|---|---|---|---|
| 001 | FLIGHT STRIKE | Shoot'em up vertical | `max/001-flight-strike/` |
| 002 | ONE MORE FLOOR | Torre / supervivencia | `games/002-one-more-floor/` |
| 003 | LAST LIGHT | Oscuridad y memoria | `games/003-last-light/` |
| 004 | APEX PULSE | Conducción / time attack | `games/004-apex-pulse/` |
| 005 | NO SECOND SHOT | Precisión / rebotes | `games/005-no-second-shot/` |
| 006 | CROSS RUSH | Motocross arcade | `games/006-cross-rush/` |
| 007 | REDLINE: DON'T CHOKE | Conducción bajo presión | `games/007-redline-dont-choke/` |
| — | PLAYZONE RUSH | Capa competitiva, no es un juego | `rush/playzone-rush/` |

## Jugar

Doble clic en `index.html`. Desde ahí se llega a todo.

Servido por HTTP o GitHub Pages funciona el catálogo entero. Con doble clic
funcionan los juegos de un solo archivo (001, 004, 005, 006, 007); **002 y 003
usan módulos ES y necesitan su servidor**, que traen incluido.

## Cómo está montado

```
index.html                        ← PLAYZONE, el catálogo
max/
  index.html                      ← PLAYZONE MAX, los juegos grandes
  001-flight-strike/
games/
  002-one-more-floor/   003-last-light/
  004-apex-pulse/       005-no-second-shot/
  006-cross-rush/       007-redline-dont-choke/
rush/
  playzone-rush/                  ← plataforma competitiva
docs/
  CATALOG.md · PLAYZONE.md · GAME-REGISTRY.md
```

Cada juego es independiente: no importa código de otro, trae sus propios
assets y sus propios tests, y se puede desarrollar, probar, desplegar y
publicar por su cuenta. Las portadas son lo único que sabe qué juegos existen.

## Arrancar cada juego

| Juego | Ejecutar | Tests |
|---|---|---|
| 001 Flight Strike | doble clic | — |
| 002 One More Floor | `npm start` | `npm test` (12 archivos) |
| 003 Last Light | `npm run dev` | `npm run check` · `npm run playtest` |
| 004 · 005 · 006 · 007 | doble clic | piloto automático por consola |
| PLAYZONE RUSH | `npm run dev:all` | `npm test` (21 archivos) |

## Añadir un juego

En la cabecera de `index.html` hay una lista `CATALOGO` comentada en español.
Se copia una línea, se cambian los datos y se recarga. Con `listo:false` la
casilla queda en gris como «en construcción» y no rompe nada.

Los números no se reutilizan nunca: el siguiente juego es el **008**.

Los detalles, en `docs/PLAYZONE.md`.

## Ponerlo en la tablet

Con GitHub Pages activado, abrir el enlace en Safari y **Compartir → Añadir a
pantalla de inicio**. PLAYZONE y PLAYZONE MAX se pueden añadir por separado,
cada uno con su icono, a pantalla completa y sin conexión.
