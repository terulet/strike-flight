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

## 6F — Overdrive

**Carga** (`cargarOverdrive(cantidad)`, único embudo, escalado por
`DIF.overdriveAccessMul` de 6B): kill normal (2.2) · boss break (6,
vía `alMatar`) · élite (6, extra sobre el kill) · skill event (10) ·
hito de combo (h×0.3) · bonus event exitoso (15). Tope 100.
`OVERDRIVE READY` avisa una vez, al cruzar el tope.

**Activación manual** (`activarOverdrive()` / gancho ADMIN
`activateOverdrive()`): exige la barra llena y ninguna activa ya en
marcha. Duración 13.5s (dentro de la horquilla 12-15s del encargo).
`fillOverdrive()` (gancho ADMIN) llena la barra sin jugar.

**Daño recibido reduce carga — nunca invencibilidad.** En carga, un
golpe le quita 20 puntos de barra. Ya activa, un golpe le RECORTA 3s
en vez de apagarla en seco (cortar en seco un momento que el jugador
acaba de activar a mano se siente peor que acortarlo) — y sigue
perdiendo vidas exactamente igual que sin Overdrive: no toca `golpe()`
ni `hitR()`, así que las balas enemigas se ven y matan igual que
siempre.

**Efectos activa:** cadencia ×0.55 (mismo factor que TURBO, sin
sumarse si coinciden), dos disparos laterales extra por ráfaga con
cualquier arma equipada, score ×1.5 en `alMatar()`, aura rosa de tres
arcos girando (mismo patrón que el anillo de invulnerabilidad, en el
mismo `ctx.save()`, sin sprite nuevo) que NO tapa la nave ni cambia su
radio de impacto real.

**Audio:** reutilizado en su totalidad — `aviso` (READY), `ultimate`
(activar, el disparo del arma ANIQUILADOR), `combo`/`ui_no` (fin). No
hace falta declarar ningún asset SFX nuevo para este bloque.

**Pruebas:** `herramientas/pruebas/overdrive.mjs` (21 comprobaciones)
+ regresión completa. Verde.

---

---

## 6G — Upgrades durante partida

**Build TEMPORAL** (`upgradesJugador`, id → nivel): vive solo en
memoria, `reset()` lo vacía en cada misión nueva — es la razón por la
que un roguelite funciona, y está en el propio encargo. 9 upgrades
(6-10 pedidos), cada uno un dato con `nombre/desc/rareza/maxNivel/
tags/peso/incompatibles` — `incompatibles` declarado y vacío A
PROPÓSITO: en esta primera versión cualquier par puede convivir,
porque 6H (evoluciones) necesita que puedan.

| Upgrade | Efecto | Chokepoint reutilizado |
|---|---|---|
| TRIPLE SHOT | +2 disparos laterales/nivel | `disparar()` |
| RAPID CORE | -12% cadencia/nivel | el mismo cálculo de `cad` que ya usan turbo/Overdrive |
| HEAVY CORE | +20% daño/nivel | `nuevaBala()` |
| CHAIN LIGHTNING | el disparo salta a otro enemigo | `nuevaBala()` presta `b.cadena`, reutiliza `cadenaElectrica()` (las armas eléctricas ya la tienen) |
| MISSILE SWARM | 6 misiles cada 8s (6s a nivel 2) | reutiliza `ARMAS.misil` ENTERO: guiado, área, sonido, sprite |
| PLASMA BURST | explosión al matar | `alMatar()` + `danioArea()` |
| SHIELD REACTOR | el escudo se regenera solo a los 15s | reloj propio, `escudo` |
| MAGNET FIELD | imán permanente (+90/+80 de alcance) | los mismos `alcance`/`vel` de premios y shards |
| OVERDRIVE BOOST | +25% carga/nivel, +2s de duración/nivel | `cargarOverdrive()` / `activarOverdrive()` |

**Momento de elección:** hitos de `enemiesKilled` — [8, 24, 45, 70] —
no de tiempo ni de score. El primero cae pronto A PROPÓSITO (el
encargo es explícito: "una partida donde el primer upgrade llega a
los 4 minutos ha fallado"); el resto reparte 2-4 elecciones en una
misión larga. 3 tarjetas, pesadas por `peso`, nunca repetidas, nunca
un upgrade ya en su `maxNivel`.

**UI:** modal de pantalla completa (mismo patrón que la confirmación
de "borrar progreso" — `botones.length = 0` al principio, así que
nada de detrás recibe un toque por error) con 3 tarjetas grandes,
nombre + rareza + una frase, sin texto kilométrico.

**La partida se congela de verdad** mientras hay tarjetas en pantalla:
las cuatro comprobaciones `if (state !== "play" || paused) return;`
del motor pasaron a `|| upgradesOfrecidos`. Esto rompió TRES pruebas
que pilotan el reloj a mano sin simular ningún toque
(`enemigos.mjs`/`minijefes.mjs`/`mundos.mjs`, todas con el mismo
patrón `congelar()`/`PASO()`): si una masacre de prueba cruza el
primer hito, la oferta se queda en pantalla para siempre porque nada
la cierra, y lo que se estaba midiendo —que nada se quede colgado— se
queda literalmente colgado. Arreglado en el propio arnés de pruebas:
`PASO()` descarta cualquier oferta antes de cada paso, igual que ya
neutraliza `cerrarMision()`. Las pruebas dirigidas por el piloto de
verdad (`campana-final.mjs`, `misiones.mjs`) NO se vieron afectadas:
un piloto que toca la pantalla de verdad resuelve la tarjeta como lo
haría un jugador real.

**Pruebas:** `herramientas/pruebas/upgrades.mjs` (27 comprobaciones:
disparador, elección, los 9 efectos, congelado real, `reset()`) +
regresión completa. Verde.

---

---

## 6H — Evolutions / Synergies

**4 evoluciones** (dentro de las 3-5 pedidas — no 5, porque el pool
real de 6G tiene 9 upgrades, no los 10 de ejemplo del encargo: sin
DRONE WING, STRIKE FLEET se funde con HEAVY CORE en su lugar).
OVERDRIVE BOOST se queda sin pareja a propósito: ya se combina con
TODO por su cuenta vía la barra, forzarle un quinto par no habría
sumado nada nuevo.

| Evolución | Pareja (nivel II + nivel II) | Efecto |
|---|---|---|
| SUPERNOVA CANNON | TRIPLE SHOT + PLASMA BURST | nova de área cada 2,5s (`danioArea()`) |
| THUNDERSTORM | CHAIN LIGHTNING + RAPID CORE | cadena a 3 enemigos cada 1,6s (rayos/`impacto()`) |
| STRIKE FLEET | MISSILE SWARM + HEAVY CORE | enjambre 6→10 misiles, intervalo ×0,7 |
| GRAVITY AEGIS | SHIELD REACTOR + MAGNET FIELD | umbral de regeneración ÷2 + pulso de área cada 6s |

`SHIELD REACTOR` y `MAGNET FIELD` pasaron de `maxNivel:1` a
`maxNivel:2` para poder participar (antes eran binarios: los tenías o
no). Sus efectos ahora escalan con el nivel en vez de ser un
interruptor — corrección menor de diseño, no un cambio de balance
grande.

**Cada efecto reutiliza lo que YA EXISTÍA** para que fundirse se note
más fuerte, no distinto de cero: `danioArea()` (ya la usa PLASMA
BURST), los `rayos`/`impacto()` (ya los usa el arma eléctrica),
`dispararMissileSwarm()` (el propio MISSILE SWARM, con parámetros
mayores), el propio reloj de SHIELD REACTOR. Ninguna evolución inventa
un sistema de proyectiles nuevo.

**"No debe borrar un boss sola":** verificado con números, no a ojo —
una nova sola quita 2,5% del HP de un jefe típico (Guardián, 560 HP);
un pulso de GRAVITY AEGIS, 1,1%. Los dos muy por debajo del 5% que
puso la prueba como techo.

**Banner + "pequeño slowdown":** reutiliza `UI.desbloqueo()` (el mismo
banner de mission/nave desbloqueada) para "EVOLUTION! · NOMBRE", y
`hitstop()` (el congelado de impacto que ya existe) para el frenazo
visual — nada nuevo que mantener.

**Encontrado con una prueba, no a ojo:** la cadena de THUNDERSTORM
excluía solo el ÚLTIMO objetivo golpeado (`enemigoMasCerca(...,
victima)`), así que el tercer salto podía volver sobre el primero en
vez de llegar a un tercer enemigo cercano — con tres enemigos en
línea, el salto 3 comprobaba que el primero (35px) estaba más cerca
que el tercero (60px) y repetía. Arreglado con un `Set` de visitados
completo en vez de una única exclusión.

**Pruebas:** `herramientas/pruebas/evoluciones.mjs` (22
comprobaciones: fusión exacta por pareja+nivel, no re-fusión, los 4
efectos, el techo de daño contra un jefe, `reset()`) + regresión
completa. Verde.

---

---

## 6I — Rank / Replayability

**No solo score.** `calcularRank()` reparte 110 puntos: 35 score/segundo
(normaliza misiones cortas y largas — 15 pts/s en MEDIUM ya cuenta
como bueno), 20 combo máximo, 15 no recibir daño (`vidasPerdidas`, 15
si son 0, 0 si son 3), 15 skill events, 10 élites derrotados, 5 jefe
sin un golpe (`sinDanioBoss`, 6D), y 10 de bono por dificultad (0
FÁCIL / 5 NORMAL / 10 DIFÍCIL — jugar en DIFÍCIL da margen real, no
solo el multiplicador de score de 6B). Umbrales: C (0) · B (35) · A
(60) · S (80) · S+ (95). Verificado con pruebas que dos partidas con
el MISMO score pueden sacar letras distintas, y que cada factor -daño,
skill events, élites, boss limpio, dificultad- mueve la letra en la
dirección correcta.

**Guardado** (`SAVE.subirRecordDif`/`subirRankDif`, nuevo en
`js/save.js`): récord de score Y de rank, cada uno por su lado, los
DOS por misión Y por dificultad (clave compuesta `"m3_high"`). No
tienen por qué caer en la misma partida — se guardan de forma
independiente, verificado con prueba. `campana.records` (récord por
misión SIN dificultad, de siempre) no se toca: sigue siendo lo que ya
lee el resto del juego.

**Estadísticas de por vida** (`perfil.*`, ESQUEMA ampliado):
`closeCalls`, `elitesDerrotados`, `jackpots`, `evolucionesDescubiertas`,
`overdrivesUsados` — se SUMAN en cada `cerrarMision()`, no se
reemplazan, verificado con dos misiones seguidas.

**Pantalla de resultados**, sin volverse una hoja de cálculo:
- Sello de RANK en su propia esquina (no compite con la lista de
  extras ni con el total), con un pequeño golpe de escala al entrar.
- Una línea compacta debajo del ELOI: `COMBO ×N · N SKILL · N ÉLITES
  · N× OVERDRIVE · DIFICULTAD · ★ NUEVO MEJOR` — solo lo que pasó de
  verdad; sin skill events ni élites, esos dos elementos ni aparecen.

**Encontrado durante la comprobación visual** (capturas de
`frontal.mjs`): el nuevo sello de RANK y la línea compacta se leen
limpios, sin pisar nada existente. Hay un artefacto de doble-exposición
PREVIO al bloque (el banner de misión desbloqueada superpuesto con el
texto de resultados) — reproducible con el MISMO guion de prueba antes
de 6I, así que es del arnés sintético de `frontal.mjs`, no una
regresión de este bloque; queda anotado para el informe final.

**Encontrado con `mision-completa.mjs` (partida real de principio a
fin, sin capturas intermedias que la salven):** ese archivo y otros
siete pilotan la nave escribiendo `targetX/targetY` directamente, sin
un toque real — así que nunca "tocarían" una tarjeta de upgrade por su
cuenta. En una misión de 200 iteraciones × 3s, el piloto SÍ acumula
kills de verdad (a diferencia de los bots de solo-jefe, que limpian
`enemies` en cada paso), cruza el primer hito de 6G y la partida se
queda congelada el resto del tiempo -confirmado: `elapsed` se quedó
clavado en 70.5 durante más de 500s de espera real-. Arreglado en los
8 archivos que pilotan así: si hay una oferta en pantalla, el propio
piloto elige la primera opción, que es lo más parecido a lo que
haría un jugador real sin pensárselo. Los tres arneses `congelar()`/
`PASO()` de 6G ya estaban cubiertos; éste es un patrón DISTINTO
-tiempo real con `setInterval`, no reloj pilotado a mano- que se
había colado.

**Pruebas:** `herramientas/pruebas/rank.mjs` (32 comprobaciones) +
regresión completa, incluida `guardado.mjs` (el ESQUEMA de save.js
cambió), `admin.mjs`, y una partida real de M1 de principio a fin sin
congelarse. Verde.

---

---

## 6J — Pasada final de juice

Sin sistemas grandes nuevos, como pide el encargo. Lo que sí:

- **`BALAS_MAX = 240`** (nuevo tope duro): las balas EXTRA de Overdrive
  (6F), TRIPLE SHOT y MISSILE SWARM (6G/6H) no tenían presupuesto — el
  arma base nunca se acercaba a necesitarlo antes de este bloque. La
  peor escena razonable (5 upgrades a tope + evolución + Overdrive a
  la vez) llegaba a 195 balas del jugador. El arma base nunca se
  recorta por esto.
- **`herramientas/pruebas/estres-bloque6.mjs`** — DIFÍCIL, 30 enemigos
  con élites, hazard, 130 balas enemigas, combo 60+, Overdrive activa,
  jefe en pantalla, todo a la vez. Los cuatro topes duros del bloque
  (flotantes/shards/eBalas/balas) se respetan; el auto-degradado de
  calidad responde bajo carga.
- **`herramientas/muestra-ritmo-real.mjs`** — telemetría REAL (no
  análisis de guión) de M1/M10/M15 jugadas de principio a fin con el
  piloto de `mision-completa.mjs`. Las tres terminaron en "over"
  (el piloto muere a propósito, está escrito para esquivar, no para
  ganar) así que no hay rank/skill-events de muestra, pero SÍ hueco
  máximo real: 8.6–10.4s, muy por debajo del umbral de 30s del
  análisis estático — confirma que el guión no deja vacíos
  catastróficos incluso bajo juego imperfecto.
- **`PROTOCOLO-PLAYTEST-BLOQUE6.md`** — las ocho preguntas del
  encargo, con instrucciones de cuándo repreguntar y cuándo NO tocar
  balance por una sola sesión.
- **Auditoría de audio**: 71 sonidos, 0 rutas rotas. Documentadas 5
  identidades sin asset propio (élite aparece/muere, jackpot,
  evolución, rank S/S+) — todas resueltas hoy por reutilización
  razonada, ninguna con un pitido genérico nuevo.
- **Encontrado, sin arreglar (fuera de alcance de este bloque)**: 2
  fallos de `mundos.mjs` y la flakiness de `jefes.mjs`/`enemigos.mjs`
  en headless, los tres confirmados pre-existentes contra el commit
  anterior a Bloque 6. Un choque de nombres entre `ENEMIGOS.elite`
  (de siempre) y el flag `e.elite` (6E) — sin conflicto mecánico,
  decisión de vocabulario pendiente para el usuario.

**Informe final publicado:**
https://claude.ai/code/artifact/f9aca049-c091-4c5b-a2e0-184a132a39ed
— los 24 puntos del encargo, con datos reales de esta rama.

---

**BLOQUE 6 COMPLETO.** Parado aquí, esperando OK antes de
`sync-flight-strike` → `verify-flight-strike-sync` → Netlify. Sin
push, sin merge, sin tocar `main` ni PLAYZONE MAX.
