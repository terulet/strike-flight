# PLAYZONE — Registro de juegos

Inventario del estado **real** encontrado el 2026-08-20. No es la lista de lo que
queremos que exista: es la lista de lo que existe y dónde está.

Nada se ha movido todavía. Este documento es el resultado de la Fase 1.

---

## Resumen

| Nº | Juego | ¿Existe? | Dónde |
|---|---|---|---|
| 001 | FLIGHT STRIKE | **Sí** | `terulet/strike-flight` — en dos versiones, ver abajo |
| 002 | ONE MORE FLOOR | **Sí** | `terulet/atlas-platform`, rama sin fusionar |
| 003 | LAST LIGHT | **Sí** | `terulet/atlas-platform`, rama sin fusionar |
| 004 | APEX PULSE | **No encontrado** | — |
| 005 | NO SECOND SHOT | **No encontrado** | — |
| 006 | CROSS RUSH | **No encontrado** | — |
| 007 | REDLINE: DON'T CHOKE | **No encontrado** | — |
| — | PLAYZONE RUSH | **Sí** | `terulet/strike-flight`, dos ramas sin fusionar |

Dónde se ha buscado: los 38 repositorios de la cuenta, todas las ramas de
`strike-flight`, `atlas-platform`, `kaliworld` y `gelateria-arcade`, el historial
completo de `strike-flight`, y los títulos y ramas de resultado de las 45 sesiones
de trabajo.

---

## 001 — FLIGHT STRIKE

Matamarcianos vertical. **Existe en dos versiones y la de `main` no es la mejor.**

### Versión A — `main` (la que se ve al abrir el repo)
- **Repo:** `terulet/strike-flight`
- **Rama:** `main`
- **HEAD:** `57afd357` · 2026-08-08 16:33 · «Add files via upload»
- **Contenido:** `index.html` de 1250 líneas, sin carpeta `art/`
- **Stack:** un solo HTML, cero dependencias, cero compilación
- **Ejecutar:** doble clic en `index.html`
- **Tests:** ninguno

### Versión B — `claude/strike-flight-setup-7zx2b7`  ← **más nueva**
- **Repo:** `terulet/strike-flight`
- **Rama:** `claude/strike-flight-setup-7zx2b7`
- **HEAD:** `93b3a973` · 2026-08-08 22:21 · «Escalar tamaños y velocidades con la pantalla»
- **Contenido:** `index.html` de 1495 líneas **+ los PNG de las naves**
  (`art/naves/kali.png`, `silvia.png`, `yoli.png`, ~650 KB en total),
  `herramientas/recortar.mjs`, `AUDITORIA.md`, `.nojekyll`
- **Añade sobre `main`:** escalado con el tamaño de pantalla (`REF_ANCHO`),
  `TINTA`, `DETALLES`, `TIRO_TUYO`/`TIRO_SUYO`, `CARPETAS`, `cargarImagen`
- **Ejecutar:** doble clic en `index.html`
- **Tests:** ninguno

> **Ojo:** la copia que hay hoy en `max/strike-flight/` viene de la versión A.
> Falta incorporar la B.

---

## 002 — ONE MORE FLOOR

Arcade vertical de torre. Sube plantas cortas, dificultad creciente, retry inmediato.

- **Repo:** `terulet/atlas-platform` ← **repositorio de negocio, no de juegos**
- **Rama:** `claude/one-more-floor-prototype-w3b31d` (sin fusionar)
- **HEAD:** `4a831bd7` · «docs: add prototype readme and design notes»
- **Ruta dentro del repo:** `games/one-more-floor/`
- **Tamaño:** 57 archivos, 6702 líneas añadidas sobre `main`
- **Stack:** JavaScript de navegador, **cero dependencias**, Node ≥20 solo para servir
- **Ejecutar:** `npm start` (o `npm run dev`) → `node tools/serve.mjs`
- **Tests:** `npm test` → `node --test "test/*.test.js"` · **12 archivos de test**
  (colisión, completabilidad, plantas, gameplay, generador, jugador, rng, guardado, estado)
- **Piezas:** `src/floors/` (registro de plantas, path, hazards), `src/game/`,
  `src/systems/` (audio, cámara, colisión, debug, gfx, partículas, ui, viewport),
  `src/input/`, `DESIGN.md`, `README.md`
- **Estado del worktree:** limpio, todo commiteado

---

## 003 — LAST LIGHT

Disparar te permite ver, y disparar te delata. Oscuridad y memoria espacial.

- **Repo:** `terulet/atlas-platform` ← **repositorio de negocio, no de juegos**
- **Rama:** `claude/last-light-prototype-dfswz3` (sin fusionar)
- **HEAD:** `b6601ebd` · «balance(last-light): cuatro decisiones cambiadas por lo que midió el bot»
- **Ruta dentro del repo:** `games/last-light/`
- **Tamaño:** 32 archivos, 5190 líneas añadidas sobre `main`
- **Stack:** JavaScript de navegador, **cero dependencias**, Node ≥20 para las herramientas
- **Ejecutar:** `npm run dev` → `node tools/serve.mjs`
- **Comprobar:** `npm run check` · **Playtest automático:** `npm run playtest` · **Build:** `npm run build`
- **Tests:** sin tests unitarios; en su lugar `tools/check.mjs` y `tools/playtest.mjs` (un bot que mide el balance)
- **Piezas:** `src/systems/Lighting.js` (324 líneas — el núcleo de la oscuridad),
  `Renderer.js`, `Level.js`, `Audio.js`, `Effects.js`, `src/entities/` (Enemy, EnemyAI,
  Player, Projectiles, Weapon), `src/input/TouchControls.js`, `src/ui/Debug.js`, `Hud.js`
- **Estado del worktree:** limpio, todo commiteado

---

## 004 · 005 · 006 · 007 — no encontrados

**APEX PULSE**, **NO SECOND SHOT**, **CROSS RUSH** y **REDLINE: DON'T CHOKE** no
aparecen en ninguna parte a la que este equipo tenga acceso:

- ningún repositorio de los 38 de la cuenta lleva ese nombre;
- ninguna rama de los repositorios revisados los contiene;
- ninguna de las 45 sesiones de trabajo lleva ese título ni dejó rama con ese nombre;
- ninguna búsqueda de texto por «apex», «no second shot», «cross rush» ni «redline»
  da resultado. El único acierto de «apex» es `T_APEX`, la física del salto en los
  tests de One More Floor.

Si existen, están fuera de GitHub — probablemente en local.

---

## PLAYZONE RUSH — plataforma competitiva

Reto diario de microjuegos con ranking, amigos y revancha. **No es uno de los
juegos numerados**, y sus microjuegos internos **no** son los juegos 004-007.

- **Repo:** `terulet/strike-flight` ← **conviviendo con Flight Strike**
- **Rama vigente:** `claude/playzone-rush-social-kg1l61`
- **HEAD:** `721b1229` · 2026-08-19 19:38 · «fix(tools): el harness se colgaba por el Funnel»
- **Rama anterior:** `claude/playzone-rush-core-kg1l61` · `e2e5d602` · 2026-08-18 13:24 · 73 archivos
- **Ruta dentro del repo:** `playzone-rush/`
- **Tamaño:** 130 archivos
- **Stack:** TypeScript + Vite + Vitest, servidor Node propio, PWA
- **Ejecutar:** `npm run dev` · **Todo junto:** `npm run dev:all` · **Servidor:** `npm run server`
- **Tests:** `npm test` (Vitest) · `npm run test:server` · `npm run test:client` ·
  **21 archivos de test** · **Tipos:** `npm run typecheck`
- **Servidor:** `server/src/` con api, sse, db, backup, dashboard, validate
- **Docs propias:** `docs/ALFA-7-DIAS.md`, `docs/CONGELADO.md`, `docs/DESPLIEGUE.md`

### Microjuegos internos de RUSH

Son retos cortos de la plataforma, con su propio contrato (`src/game/contract.ts`).
**No renumerar como 004-007.**

| Interno | Habilidad | Qué es |
|---|---|---|
| `pulse` | reflejos | Tocar nodos azules antes de que se apaguen; los rojos queman. **No es APEX PULSE.** |
| `drift` | supervivencia | Colar la nave por huecos entre muros, con fantasma del rival del día. **No es conducción.** |
| `snap` | precisión | Disparar lo más cerca del centro de una diana que se mueve. |
| `memory` | memoria | Se encienden casillas, se apagan, hay que tocarlas. |

---

## Estado de Git al cerrar el inventario

| Repo | Rama local | Worktree |
|---|---|---|
| `terulet/strike-flight` | `claude/playzone-nuevo-proyecto-n3sg3d` | limpio |
| `terulet/atlas-platform` | `main` | limpio |
| `terulet/kaliworld` | `main` | limpio |
| `terulet/gelateria-arcade` | `main` | limpio |

Ninguna rama se ha borrado, movido ni reescrito. `atlas-platform`, `kaliworld` y
`gelateria-arcade` se han clonado en modo lectura y **no se ha escrito nada en ellos**.

### Descartados tras revisarlos
- `terulet/gelateria-arcade` — solo un esqueleto de carpetas de assets vacías (28 archivos, ningún juego).
- `terulet/kaliworld` — juego grande propio en TypeScript + Phaser (377 archivos). No es del catálogo PLAYZONE.
- `terulet/procasa-pulse-releases` — app de negocio. El «pulse» del nombre no tiene relación con APEX PULSE.
- `terulet/carnet-quest`, `carnet-quest-open-road` — juego de teoría del carnet de conducir, no es CROSS RUSH ni REDLINE.
