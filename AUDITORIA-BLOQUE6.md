# FLIGHT STRIKE — Auditoría Bloque 6

Arcade juice · retención · power progression · rejugabilidad.
Rama de trabajo: `claude/bloque6-arcade-juice`, sobre el árbol canónico
(`claude/strike-flight-setup-7zx2b7` = `origin/canonical/flight-strike-m20`).
No se ha tocado `main` ni PLAYZONE MAX en ningún momento.

Este documento se amplía al cerrar cada fase (6B → 6J). Es el registro
de decisiones, no un resumen de marketing: incluye lo que se ha
comprobado, lo que se ha dejado fuera y por qué.

---

## 6B — Dificultad (EASY / MEDIUM / HIGH)

**Contrato:** MEDIUM reproduce el juego actual byte a byte en
gameplay. `DIFFICULTY_CONFIG` centraliza los multiplicadores; ninguno
toca vida de enemigo ni daño de contacto.

**Chokepoints reales** (no las ~40+ definiciones de ataque):

| Qué | Dónde |
|---|---|
| Velocidad de bala enemiga | `eBala()` — único sitio que empuja a `eBullets` |
| Cadencia enemiga | bucle de `enemies` (`d.recarga()`), `actualizarMiniboss`, `spawnDefensas`/`actualizarDefensas`, nodos AEGIS |
| Ventana de telegráfico | `telegrafo()` (escala `life`) + los mismos bucles de cadencia (escalan el `avisa` con el que se compara) — los dos se escalan por el MISMO factor para que jamás se desincronicen |
| Invulnerabilidad tras un golpe | `golpe()` |
| Tolerancia de combo | `comboVentana()`, nueva — sustituye los usos directos de `CONFIG.comboTiempo` |
| Drops defensivos | `elegirPremioAleatorio()` (envuelve `elegirPremioBase()`, que no se toca) |
| Multiplicador de score | `DIF.scoreMul`, aplicado en 6C dentro de `alMatar()` |

**Valores:** EASY/HIGH mueven cada palanca un 10-25% (nunca más). MEDIUM
es 1 en todo salvo `scoreMul` (1.25, ver 6C — decisión de producto
explícita, no un descuido).

**Encontrado de paso:** `spawnEnemy()` tenía un `r` sin definir
(`tipo: k, r, hp: d.hp, ...`) que crasheaba el bucle de juego en cuanto
aparecía casi cualquier enemigo — confirmado con `git show` que faltaba
`const r = d.r * ESC;`, perdida en el merge que trajo M11-M20 a
canónico. No es una regresión de este bloque; sin arreglarla, ninguna
prueba de M6-M20 podía correr limpia, así que se corrigió aquí.

**Pruebas:** `herramientas/pruebas/dificultad.mjs` (27 comprobaciones)
+ regresión completa. Verde.

---

## 6C — Kill funnel (`alMatar`) + score flotante

**Problema de partida:** cinco sitios subían combo/score por su cuenta
(`matar()`, nodos AEGIS, subsistemas OMEGA, torretas de escenario,
ALPHA/BETA/GAMMA de M9) — la auditoría original del Bloque 6 lo señaló
como el agujero a cerrar antes de construir nada nuevo encima.

**`alMatar({ fuente, tipo, puntosBase, posicion, opciones })`** es
ahora el único embudo. Cada sitio conserva su propio efecto de muerte,
premio o texto con nombre (eso no es un dato de kill), pero combo,
`comboT`, `multCombo`, score y texto flotante pasan todos por aquí.

`opciones.combo` decide si `puntosBase` se multiplica por el combo
(matar, nodos, torretas: sí) o va a secas (subsistemas de OMEGA y M9,
que daban 500/400 fijos). No se igualó el criterio — igualarlo sería
tocar el balance, y esto fue una migración, verificada con pruebas que
comparan la cifra exacta de cada uno de los cinco contra su fórmula de
antes de migrar.

`DIF.scoreMul` se aplica AQUÍ, en el embudo — no en las tablas de
puntos de `ENEMIGOS`/`DEFENSA_TIPOS`, que no se tocan. El ELOI no se ve
afectado: sale de los extras de `cerrarMision()`, no del score de
kills.

**Score flotante:** `flotantes.push()` no tenía pool ni tope, y su
desplazamiento vertical crecía sin límite con `flotantes.length`
—nacía fuera de pantalla con una limpieza grande—. Ahora: reciclado
(`flotantesLibres`), tope duro (40), y los números cercanos en espacio
y tiempo del mismo color se FUNDEN en uno (ocho "+50" ya no se pintan
ocho veces). Los textos con nombre nunca se funden. Con el pool lleno,
un texto de prioridad alta desaloja al de menor prioridad/más viejo en
vez de perderse en silencio.

**Pruebas:** `herramientas/pruebas/kill-funnel.mjs` (15 comprobaciones)
+ regresión completa. Verde.

---

## 6D — Rhythm Director

**TIME WITHOUT STIMULUS (en vivo):** `RHYTHM` mide cuánto tiempo real
pasa sin estímulo (enemigo, hazard, aviso, drop, bonus, jefe/miniboss,
golpe recibido). Umbral 4s. `marcar()` lo llaman las funciones que YA
crean el estímulo (`spawnEnemy`, `soltarPremio`, `telegrafo`, `golpe`,
`spawnMiniboss`, `cambiarFase`, `spawnPozo/Carril/Sistemas/Defensas`)
así que ningún sistema futuro (élites en 6E, upgrades en 6G) tiene que
avisar dos veces: basta con que cree su entidad con una de éstas.

**Informe de guión (estático):** `herramientas/informe-ritmo.mjs` lee
`MISIONES[i].eventos` sin jugar nada — es una lectura de diseño, no un
sustituto del contador en vivo. Resultado sobre las 20 misiones:

```
19 HEALTHY · 1 TOO EMPTY (M20 · LO QUE QUEDA) · 0 TOO BUSY · 0 TOO REPETITIVE
```

Umbrales calibrados CON los datos reales de las 20 misiones (no a
ojo): hueco máx > 30s = TOO EMPTY · hueco medio < 5s y > 14 eventos/min
= TOO BUSY · 4+ "ola" seguidas del mismo tipo = TOO REPETITIVE.

El primer intento marcaba 6 misiones como TOO EMPTY por un hueco de
60-64s después del evento `miniboss`. Investigado: ese hueco es el
COMBATE del jefe, que no vive en `eventos` — lo llena la propia máquina
de ataques/telegraphs del jefe (ya vigilada en vivo por `RHYTHM`). Se
corrigió el analizador para excluir el hueco INMEDIATAMENTE después de
un evento `miniboss` — no es un hueco real, es la lectura errónea de
una herramienta que no ve dentro del combate.

M20 (LO QUE QUEDA, cierre de la expansión) sigue marcada: 31s de
silencio ANTES del aviso de AXIOMA. Revisado a mano — es deliberado, el
propio guión lo dice en un comentario ("Silencio deliberado y largo
antes del aviso"). Se ha dejado así a propósito: es el único momento de
las 20 misiones donde el guión quiere que el jugador note el vacío
antes del jefe final de toda la expansión.

**El problema que eso destapó:** si es deliberado en el guión pero el
Director en vivo rellena cualquier hueco > 4s con un Bonus Event, el
Director le pisa la intención al guión. Se encontraron 6 de estos
silencios pre-jefe en total (M6/OMEGA + 5 de la expansión: KRYOS,
VÉRTICE, NYX, VULCANO, AXIOMA), de 16 a 31s cada uno — todos por debajo
del umbral de 30s salvo AXIOMA, pero TODOS por encima del umbral de 4s
que dispara al Director.

**Arreglo:** `{ fn: "descansoOn" }` (y su opuesto `descansoOff`, no
usado todavía pero simétrico con el patrón `hazardOn/Off` ya existente
en el juego) — una misión puede abrir una ventana donde el Director no
interviene. Añadido a los 6 silencios reales. No hace falta cerrarla a
mano en ninguno de los 6: en cuanto `spawnMiniboss()` pone `miniboss`,
ese guardián ya bloquea al Director por su cuenta.

**BONUS EVENTS** (`BONUS_EVENTOS`, 5 tipos — primera versión):

| Tipo | Objetivo | Fallo |
|---|---|---|
| BONUS WAVE | matar N marcados | solo por tiempo |
| TREASURE CONVOY | matar N transportes | si UNO escapa por abajo |
| GOLDEN TARGET | matar 1 objetivo raro | si escapa o por tiempo |
| PERFECT FORMATION | limpiar la formación entera | si UNO escapa |
| RISK GATE | aguantar la ventana sin recibir un golpe | un golpe (no un escudo roto) |

Uno cada vez (`bonusEvento`), banner + barra de tiempo propios
(`barraBonus()`, mismo lenguaje visual que `barraJefe()` pero no
compiten por sitio: nunca hay bonus event durante un jefe). El Rhythm
Director los dispara solo, sin script, cuando: no hay uno activo, no
hay jefe, no hay `descansoDeliberado`, la pantalla está VACÍA de
verdad (sin enemigos, sin nada en camino), y el hueco actual ya supera
el 70% del umbral. Enfriamiento de 45s entre disparos automáticos.

**Pruebas:** `herramientas/pruebas/ritmo.mjs` (23 comprobaciones:
`RHYTHM`, los 5 tipos de bonus event, y `descansoOn/Off`) + regresión
completa, incluida `expansion-compat.mjs` actualizada (681→687 eventos
de guión: 6 `descansoOn` nuevos, contados y documentados ahí mismo).
Verde.

---

---

## 6E — Skill Events + Élites + Jackpot + Drops físicos

**SKILL EVENTS** (`SKILL_EVENTOS`, 5, sin ELOI directo grande):

| Tipo | Dispara cuando |
|---|---|
| CLOSE CALL | una bala enemiga pasa a menos de 1.8× el radio de impacto SIN tocar (una vez por bala, con `b.cerca`) |
| CHAIN KILL | 4 muertes de `alMatar()` (cualquier fuente, no solo enemigos) en 1.0s |
| FAST BREAK | una ola (`{fn:"ola"}`) se limpia entera en ≤6s sin que nadie escape |
| PERFECT WAVE | una ola se limpia entera, más despacio, pero sin que el jugador reciba un golpe mientras tanto |
| NO HIT BOSS | el jefe muere sin que `golpe()` se haya llamado desde `spawnMiniboss()` |

**Seguimiento de olas** (`olas`, Map con tope duro 30): cada `{fn:"ola"}`
del guión abre una entrada con cuántos trae y cuándo nació el primero;
`matar()` y la fuga por abajo la cierran. Si ALGUNO de la ola escapó
—aunque sea el primero, y la cierre otro que sí murió— ni FAST BREAK ni
PERFECT WAVE cuentan: encontrado por una prueba que fallaba con el
código tal cual, porque el flag de "¿escapó?" solo miraba la llamada
que cerraba a cero, no la ola entera. Corregido antes de mergear.

**ÉLITES:** variante de un enemigo existente, nunca en tipos `grande`
(jefes en miniatura) ni `esComando`. `ELITE_PROB_BASE` (5% en MEDIUM)
× `DIF.eliteFreqMul` (bloque 6B, sin usar hasta ahora). Vida ×1.4 —no
x2—, cadencia ×0.85, aura dorada pulsante (dos anillos, `lighter`,
sin sprite nuevo), score ×2.2, premio garantizado al morir. Dos élites
en 4s encadenan un JACKPOT.

**JACKPOT** — cuatro disparadores, cada uno en el sitio donde ya ocurre
su condición (nada de temporizador propio, "no abusar" es literal):
hito de combo ×50/×100, PERFECT FORMATION (bonus event) exitosa,
cadena de dos élites, romper una pieza de jefe (nodo AEGIS/subsistema
OMEGA/ALPHA-BETA-GAMMA de M9 — 30% de probabilidad, no garantizado).

**DROPS FÍSICOS (`shards`):** distintos de PREMIOS (power-ups,
elección estratégica) — son la lluvia visible de recompensa. Pool +
reciclaje + tope duro propio (60; PREMIOS no lo necesitaba con su
volumen, esto sí). Imán reutilizado (mismo alcance/velocidad que ya
usan los premios con `imanT`). Jerarquía normal(2) → élite(4+1
energía) → miniboss(10+3) → boss(22+8). Los shards de `energia` ya
premian con score porque Overdrive (6F) no existe todavía — cuando
llegue, es la MISMA entidad la que empieza a cargar la barra, no un
sistema nuevo.

**Pruebas:** `herramientas/pruebas/skill-elites-jackpot.mjs` (21
comprobaciones) + regresión completa. Verde.

---

*(Continúa en 6F.)*
