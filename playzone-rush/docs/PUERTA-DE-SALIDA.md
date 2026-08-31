# Puerta de salida de PLAYZONE RUSH

RUSH no se considera terminado por una captura bonita ni porque compile. Esta
es la puerta exacta y reproducible para cerrar el juego sin mezclar Flight
Strike ni convertir una prueba local en un despliegue accidental.

## 1. Alcance Git

- Rama de trabajo: `claude/playzone-rush-showtime-kg1l61`.
- El diff contra su base solo puede tocar `playzone-rush/`.
- Árbol limpio y sin cambios de Flight Strike.
- Ningún merge a `main`, publicación o despliegue sin autorización de Eloi.

## 2. Puerta automatizada

Desde `playzone-rush/` deben pasar, sin omitir fallos:

```bash
npm test
npm run build
find tools server -type f -name '*.mjs' -print0 | xargs -0 -n1 node --check
git diff --check
```

Además, el smoke HTTP con SQLite desechable debe demostrar: tres intentos
normales aceptados; cuarto intento normal `409 attempts_exhausted`; reenvío
`isBet:true` aceptado; marca final sustituida y cero intentos restantes.

## 3. Puerta de navegador con base aislada

Arrancar backend y frontend contra una SQLite desechable, nunca contra datos
reales, y ejecutar:

```bash
node tools/smoke.mjs
node tools/flows.mjs
node tools/apuesta.mjs
node tools/dashboard-porjuego.mjs
```

El smoke impone un motion budget de máximo dos animaciones infinitas de
atención (un héroe y una secundaria; la aurora ambiental de 26 s no cuenta).
Con `prefers-reduced-motion: reduce` no puede quedar ninguna.

## 4. Puerta móvil física

Dos móviles reales, uno iOS y otro Android si están disponibles, a 393×852 o
equivalente: crear/unirse al mismo grupo, jugar los tres intentos, cortar red,
apostar offline, recuperar red y verificar ranking, ficha consumida, sonido,
haptics y ausencia de scroll/cortes. Repetir con movimiento reducido.

## Estados permitidos

- **NO TERMINADO**: falla cualquier prueba automatizada o existe un bug abierto.
- **CANDIDATO CERRADO**: código, build y smokes pasan; queda la validación física.
- **TERMINADO**: también pasan los dos dispositivos y el alcance Git está limpio.
- **PUBLICADO**: estado separado; solo existe después de autorización explícita
  de Eloi y verificación posterior al despliegue.
