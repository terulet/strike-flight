# PLAYZONE GAME REGISTRY

Estado real, comprobado el 2026-08-20. Todos los juegos viven en el
repositorio `terulet/strike-flight`, rama `claude/playzone-nuevo-proyecto-n3sg3d`.

Los números no se reutilizan nunca. El siguiente juego es el **008**.

---

## 001 — FLIGHT STRIKE

- **Estado:** jugable, **versión canónica** (campaña M1–M20 + expansión)
- **Ruta:** `max/001-flight-strike/`
- **Zona:** PLAYZONE MAX
- **Repo:** `terulet/strike-flight`
- **Origen:** rama `canonical/flight-strike-m20` (`fa1db20`)
- **Ejecutar:** necesita servidor HTTP (carga `js/` y `audio/` por ruta relativa)
- **Plataforma:** HTML + 10 módulos JS, cero dependencias
- **Gancho:** esquivar, disparar y no soltar. 20 misiones, jefes y hangar
- **Contenido:** campaña M1–M20, supervivencia, hangar, 5 chasis
  (VX-9 TALON, AX-4 WARHAWK, CR-7 BULWARK, NX-11 WRAITH, SV-12 SOVEREIGN),
  skins, emblemas, trails, ADMIN
- **Assets:** 223 ficheros, ~101 MB (`art/`, `audio/musica/`, `audio/fuentes/`)
- **Guardado:** `sf_save` y `sf_save_prev` en `localStorage`
- **Copia, no fuente:** el contenido de `max/001-flight-strike/` lo genera
  `npm run sync-flight-strike` desde el repositorio del juego. No se edita a mano.
  Lo único que PLAYZONE añade es una línea que carga `max/_playzone/overlay.js`
  (el botón de volver). Ver `docs/FLIGHT-STRIKE-SYNC.md`.
- **Tests:** `npm run verify-flight-strike-sync` compara huella a huella contra
  `build-info.json` y falla si destino y origen se separan.
  `npm run qa-flight-strike` compara el juego suelto y el de PLAYZONE en
  iPhone, iPad y escritorio (lienzo, resolución interna, dpr y escala).

## 002 — ONE MORE FLOOR

- **Estado:** jugable, con tests
- **Ruta:** `games/002-one-more-floor/`
- **Origen:** `terulet/atlas-platform`, rama `claude/one-more-floor-prototype-w3b31d` (`4a831bd7`)
- **Historia:** los 20 commits originales viajaron con el código (`git subtree`)
- **Ejecutar:** `npm start` → `node tools/serve.mjs` · **necesita servidor** (usa módulos ES)
- **Tests:** `npm test` → `node --test "test/*.test.js"` · **12 archivos**
- **Plataforma:** JavaScript de navegador, cero dependencias, Node ≥20 para servir
- **Gancho:** una planta más. Siempre una planta más
- **Siguiente hito:** pasar de las 20 plantas diseñadas a la torre infinita

## 003 — LAST LIGHT

- **Estado:** jugable
- **Ruta:** `games/003-last-light/`
- **Origen:** `terulet/atlas-platform`, rama `claude/last-light-prototype-dfswz3` (`b6601ebd`)
- **Historia:** sus 3 commits viajaron con el código
- **Ejecutar:** `npm run dev` · **necesita servidor** (usa módulos ES)
- **Comprobar:** `npm run check` · **Playtest con bot:** `npm run playtest` · **Build:** `npm run build`
- **Tests:** sin unitarios; `tools/check.mjs` y `tools/playtest.mjs` miden el balance
- **Gancho:** disparar te permite ver, y disparar les dice dónde estás
- **Siguiente hito:** más enemigos con estados distintos sobre `src/systems/Lighting.js`

## 004 — APEX PULSE

- **Estado:** jugable
- **Ruta:** `games/004-apex-pulse/`
- **Ejecutar:** doble clic en `index.html`
- **Tests:** piloto automático desde consola (sustituir `window.mandos`)
- **Plataforma:** un solo HTML, cero dependencias
- **Gancho:** clavar la trazada perfecta. Nada más
- **Sistemas:** circuito Catmull-Rom desde `TRAZADO`, ápex deducidos de la curvatura,
  sectores, delta en vivo contra fantasma, turbo al clavar, paso fijo 1/120
- **Medido:** vuelta de 11,56 s con los 9 ápex clavados
- **Siguiente hito:** un segundo circuito, y vuelta perfecta con recompensa propia

## 005 — NO SECOND SHOT

- **Estado:** jugable, 20 salas verificadas
- **Ruta:** `games/005-no-second-shot/`
- **Ejecutar:** doble clic en `index.html`
- **Tests:** expone `simular(sala, ángulo)`, que corre una tirada sin dibujar.
  Barriendo 1440 ángulos por sala se comprueba solución, margen y par
- **Gancho:** una bala, todos los objetivos, calcula
- **Verificado:** las 20 salas tienen solución, ninguna baja de 0,75° de margen,
  y el par de cada sala es el mínimo de rebotes real, medido
- **Siguiente hito:** modo Endless y base para el Daily Shot

## 006 — CROSS RUSH

- **Estado:** jugable
- **Ruta:** `games/006-cross-rush/`
- **Ejecutar:** doble clic en `index.html`
- **Tests:** piloto automático desde consola (sustituir `window.mandos`)
- **Gancho:** el vuelo se paga al aterrizar
- **Sistemas:** terreno generado de `RASGOS` con tope de pendiente a 54°,
  aterrizajes clavado/torpe/caída, fantasma y delta, paso fijo 1/120
- **Medido:** carrera de 51,6 s con 17 aterrizajes clavados
- **Siguiente hito:** un segundo circuito y el pique de décimas entre dos nombres

## 007 — REDLINE: DON'T CHOKE

- **Estado:** jugable
- **Ruta:** `games/007-redline-dont-choke/`
- **Ejecutar:** doble clic en `index.html`
- **Tests:** piloto automático desde consola (sustituir `window.frenando`)
- **Gancho:** vas por delante del récord y quedan dos curvas
- **Sistemas:** velocidad límite por curvatura, sectores, delta en vivo,
  RECORD PACE + DON'T CHOKE con latido en el último sector, paso fijo 1/120
- **Medido:** vuelta de 37,6 s, y dos vueltas seguidas dan 37,600 exacto las dos,
  o sea que la física es determinista y las vueltas son comparables
- **Siguiente hito:** Revenge y retos contra amigos, apoyándose en PLAYZONE RUSH

---

## PLAYZONE RUSH — plataforma competitiva

**No es un juego del catálogo.** Es la capa social: reto diario, ranking entre
amigos, fantasma, revancha. Sus microjuegos internos **no** son los juegos 004-007.

- **Ruta:** `rush/playzone-rush/`
- **Origen:** `terulet/strike-flight`, rama `claude/playzone-rush-social-kg1l61` (`721b1229`)
- **Historia:** sus 28 commits viajaron con el código
- **Rama anterior:** `claude/playzone-rush-core-kg1l61` (`e2e5d602`), conservada
- **Stack:** TypeScript + Vite + Vitest, servidor Node propio, PWA
- **Ejecutar:** `npm run dev` · **todo junto:** `npm run dev:all` · **servidor:** `npm run server`
- **Tests:** `npm test`, `npm run test:server`, `npm run test:client` · **21 archivos**
- **Tipos:** `npm run typecheck`
- **Docs propias:** `docs/ALFA-7-DIAS.md`, `docs/CONGELADO.md`, `docs/DESPLIEGUE.md`

### Sus microjuegos internos

| Interno | Habilidad | Qué es |
|---|---|---|
| `pulse` | reflejos | Tocar nodos azules antes de que se apaguen. **No es APEX PULSE** |
| `drift` | supervivencia | Colar la nave por huecos, con fantasma del rival del día |
| `snap` | precisión | Disparar cerca del centro de una diana que se mueve |
| `memory` | memoria | Se encienden casillas, se apagan, hay que tocarlas |
