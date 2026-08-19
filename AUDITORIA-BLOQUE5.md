# Bloque 5 — Expansión M11–M20 · auditoría y diseño

**Estado: 5A, 5B, 5C, 5D, 5E, 5F, 5G, 5H y 5I HECHOS y en verde.**

- **5A · Cimientos: hecho.** `MISIONES`/`TEMAS` → `js/misiones.js`,
  `JEFES` → `js/jefes.js`, `ENEMIGOS` → `js/enemigos.js`, todos con
  `<script src>` clásico. Cero cambios de comportamiento: la sección K de
  `expansion-compat.mjs` compara las tablas extraídas contra lo que había
  (10 misiones · 4 mundos · 10 jefes · 14 enemigos · 358 eventos).
- **5B · Compatibilidad: hecho.** `MISIONES_BASE = 10`,
  `campana.completadaBase`/`completadaExp` con sus estadísticas aparte,
  migración que sube `misionMax` a `MISIONES_BASE` a quien ya terminó la
  M10 (R1), `misionesCompletadas()` topado en la base (R2), y B1–B5 y
  C1–C3 arreglados. Lo cubre `herramientas/pruebas/expansion-compat.mjs`
  con saves reales de campaña vieja.
- **5C · Maquetación: hecho.** Una sola función `rejilla()` reparte las
  tarjetas de la pantalla de campaña, de supervivencia y del selector de
  jefes de ADMIN, y decide sola una o dos columnas. Con las diez de hoy
  no cambia absolutamente nada; con veinte pasa a dos columnas y cabe
  hasta en un iPhone SE. Resuelve L1, L2, L3 y R4 **sin sistema de
  desplazamiento**. Lo cubre `herramientas/pruebas/maquetacion.mjs`, que
  mete diez misiones y cinco mundos en caliente y mide los rectángulos
  que el juego registra para el dedo.
- **5D · Mundos y hazards: hecho.** Los cinco mundos de la expansión
  añadidos a `TEMAS` (`hielo`, `megaciudad`, `abismo`, `fragua`,
  `grieta`), todos `soloCampana:true`. `hielo` y `grieta` con fondo
  propio (el de `hielo` reescalado de brillo 57→30 para que no compita
  con las balas); `megaciudad`, `abismo` y `fragua` con repuesto
  automático (`fondoRef`) a `neon`/`oceano`/`volcan` mientras no tengan
  el suyo — la carga de fondos pasó a ser BAJO DEMANDA (antes se pedían
  los cuatro al arrancar; con nueve mundos eso eran 19 MB en el primer
  arranque). Cuatro hazards nuevos con arte real del pack de assets
  (`tempano`, `trafico` con dos variantes A/B, `mina_bio`, `fragmento`)
  más tres primitivas de escenario (`columna`, `oscuridad`, `ruptura`),
  todas reutilizables y sin lógica de jefe. Auditoría de legibilidad
  hecha leyendo PÍXELES del canvas, no asumiendo el orden de dibujo: la
  oscuridad no le quita brillo a una bala aunque la tape por detrás.
  Prueba: `herramientas/pruebas/mundos.mjs` (16 bloques, cero fallos en
  dos pasadas).
- **5E · Enemigos: hecho.** Los diez enemigos de §6, dos por mundo, en
  `js/enemigos.js` (25 entradas en ENEMIGOS: 14 base + 10 nuevos + un
  fragmento interno sin sprite). Ninguno pasa de 7 HP — la dificultad es
  de lectura, no de vida. Arte real para los diez, del pack de assets.
  Cuatro ganchos GENÉRICOS y opcionales nuevos en el motor —`alpha`,
  `reflejar`, `alMorir`, `invulnerable`— más `soltarMinaBio()`, todos
  reutilizables por contenido futuro. Prueba:
  `herramientas/pruebas/enemigos.mjs` (16 bloques, cero fallos en dos
  pasadas).
- **5F · Minijefes: hecho.** Los cinco minijefes de §7 (M11, M13, M15,
  M17, M19), en `js/jefes.js` — 15 entradas en JEFES (10 jefes + 5
  minijefes), todos con 2 fases, radio 44-52 (menor que cualquiera de
  los diez jefes, 58-92) y sin `epico`. Cada uno usa de verdad el
  sistema de su mundo: `cazador_polar` se cubre tras un témpano propio
  (5D) que reduce el daño a la mitad mientras siga en pie;
  `unidad_control` coordina el hazard `trafico` y abre "cruces" con la
  primitiva `columna` (5D); `guardian_ruina` invierte el overheat de
  PYRE LORD usando `oscurecer()` (5D) — protegido en la
  oscuridad, vulnerable del todo solo mientras dura su pulso, que
  también es su ataque — y coordina `mina_bio` (5E); `yunque_movil` se
  cubre de pie sobre su propia `columna` de colada; `heraldo_grieta` se
  teletransporta como `rompedor` (5E) pero reutilizando `mb.invul` —el
  campo que ya usan aviso/entrada/transición— en vez de un gancho nuevo,
  y abre una `ruptura` (5D) real donde va a reaparecer, siempre a 170 px
  o más del jugador. Arte real para los cinco, del pack de assets;
  ninguno collage. `matarMiniboss()` ya limpiaba genéricamente las
  primitivas del 5D — se comprobó que sigue haciéndolo — y cada uno
  limpia además su propio hazard (témpano/tráfico/mina/fragmento) en su
  `onMuerte`, siguiendo el precedente de VENOM CORE con las zonas.
  Prueba: `herramientas/pruebas/minijefes.mjs` (12 bloques, cero fallos
  en seis pasadas), más `vfx-jefes.mjs`, que al recorrer `JEFES` entero
  pasa la coreografía completa (aviso/entrada/fase/muerte/estrés/reserva)
  por los cinco sin tocarlos.
- **5G · Jefes completos: hecho.** Los cinco jefes de fin de mundo de
  §8 (`kryos` M12, `vertice` M14, `nyx` M16, `vulcano` M18, `axioma`
  M20), en `js/jefes.js` — 20 entradas en JEFES (10 jefes + 5 minijefes
  + 5 de 5G). 3 fases cada uno salvo AXIOMA, con 4 — el único, junto con
  OMEGA SOVEREIGN, con `epico:true` (misma cinemática de muerte
  alargada, misma pista de jefe final). Ninguno inventa un sistema
  nuevo: KRYOS reutiliza `mb.subs`/`actualizarSubsOmega` de OMEGA para
  cuatro placas de hielo (en fase 2 recongela EXACTAMENTE dos de las ya
  rotas, nunca las cuatro); VÉRTICE apenas se mueve y controla el campo
  con tráfico/columna "luz"/`spawnCarril`, todo ya existente; NÝX se
  parte en dos cuerpos en fase 2 pero sigue habiendo una sola vida y una
  sola barra — el núcleo genérico se apaga con un gancho opcional nuevo,
  `d.coreExpuesto(mb)` (por defecto expuesto siempre; solo lo usa NÝX), y
  el golpe real pasa por `actualizarMitadesNyx()`, que además reparte
  una regeneración capada al 12% del hpMax en toda la pelea —de verdad
  cura, lo que evita el bucle infinito es el tope, no que "no cure de la
  nada"—; VULCANO entra en FORJA cada ~15-25 s con un objetivo
  destructible y aviso: romperlo a tiempo cancela el ciclo, si no
  concede un modo temporal (martillo/cañón/columna/lanzador) que
  reutiliza patrones ya existentes; AXIOMA tiene 4 fases que reutilizan,
  una por una, el teletransporte por `ruptura` de HERALDO DE LA GRIETA
  (F1 Portales), `mb.subs` de OMEGA/KRYOS (F2 Fragmentación), cuatro
  ataques breves con el nombre en pantalla que citan el gesto de los
  otros cuatro jefes de 5G sin invocarlos (F3 Ecos), y un combo final
  directo con el núcleo expuesto del todo (F4 Cara a cara). Otro gancho
  opcional nuevo, `d.alfaCasco(mb)`, atenúa solo el casco base del jefe
  (nunca el aura ni el ojo) — lo usa NÝX para que su cuerpo principal
  casi desaparezca mientras dura la escisión y no se vean tres cuerpos
  superpuestos; por defecto el casco se pinta entero, como en los veinte
  jefes de antes. Arte real para los cinco, del pack de assets ya
  procesado con `optimizar.mjs recorte`; ninguno collage. Sigue
  cargándose bajo demanda: `asegurarSpriteJefe()` no cambió, y los cinco
  nombres NO están en el bloque eager de `index.html` (siguen siendo
  solo los diez de siempre). Prueba:
  `herramientas/pruebas/jefes-5g.mjs` (10 bloques, cero fallos), más la
  actualización de `vfx-jefes.mjs`/`enemigos.mjs`/`expansion-compat.mjs`/
  `mundos.mjs`/`minijefes.mjs` a 20 jefes (antes 15) y una comprobación
  nueva en `vfx-jefes.mjs` de que los DOS épicos (OMEGA, AXIOMA) emiten
  y duran por encima de la media, no solo uno.

- **5H · Integración real M11–M20: hecho.** Las diez misiones de la
  expansión, escritas en `js/misiones.js` sobre `MISIONES` — nada de
  sistema nuevo: cada evento sale de `procesarEvento()` (`ola`,
  `reward`, `hazardOn/Off`, `columna`, `oscuridad`, `ruptura`,
  `defensa`, `miniboss`) tal cual existe desde 5A. Dos misiones por
  mundo, en el mismo orden siempre: la primera ENSEÑA (aire, hazard
  aislado, cierra con el minijefe del 5F) y la segunda EXAMINA (sube la
  mezcla, cierra con el jefe del 5G) — M11 Deriva Blanca→CAZADOR POLAR,
  M12 El Yunque Blanco→KRYOS, M13 Tráfico Cruzado→UNIDAD DE CONTROL, M14
  Torre Centinela→VÉRTICE, M15 Luz Muerta→GUARDIÁN DE RUINA, M16 El Que
  Duerme→NÝX, M17 Colada→YUNQUE MÓVIL, M18 Maestro de Fragua→VULCANO,
  M19 Espacio Roto→HERALDO DE LA GRIETA, M20 Lo Que Queda→AXIOMA (4
  actos, el único final de verdad de la expansión). Las cinco misiones
  CON minijefe (M11/13/15/17/19) no llevan boss principal detrás: tras
  el minijefe hay un tramo corto de "descarga" y la misión cierra sola,
  sin inventar un gancho de "esperar a que el minijefe muera" — solo un
  margen de tiempo generoso, igual de honesto que la propia variación
  por nivel de arma que ya tenía M1–M10.
  Progresión: `campana.misionMax` (0-indexado, el mismo campo de
  siempre) sigue subiendo de uno en uno según se completa cada misión,
  topado en `MISIONES.length - 1` porque no hay "misión 21" — así que
  al completar M20 se queda en 19, no en 20, exactamente la misma regla
  que ya deja M11 abierta con `misionMax >= 10`.
  Recompensas: las cinco skins de MATERIAL que ya estaban en `SHIPS.SKINS`
  desde antes (`arctic`/`storm`/`toxic`/`inferno`/`cosmic`, marcadas
  `pendiente:true` a la espera de arte) ganan un campo `requiere`
  (12/14/16/18/20) y un otorgador nuevo y pequeño,
  `SHIPS.otorgarSkinsPorProgreso()` — mismo patrón que
  `otorgarPorProgreso()` de los chasis, concesión retroactiva y
  `UI.desbloqueo({tipo:"skin",...})` en el momento justo. Siguen
  bloqueadas en el Hangar por falta de PNG de material —eso no lo toca
  este bloque— pero el desbloqueo por progreso ya queda escrito en el
  save, así que el día que 5I traiga el arte no hay que volver a tocar
  esto. El emblema por jefe (ICE/KRYOS, etc.) NO se ha integrado: la
  tabla `EMBLEMAS` no tiene ningún emblema con esa identidad y no se ha
  inventado uno sin arte real detrás.
  Pantalla de cierre: `pantallaExpansionCompletada()`, function NUEVA y
  separada de `pantallaCampanaCompleta()` — comparten los mismos
  ladrillos de UI pero es un trofeo distinto, con sus propias
  estadísticas (`campaignStatsExp`, nunca pisa `campaignStats` de
  OMEGA) y sus dos filas propias: JEFES DE LA EXPANSIÓN (sale de contar
  en `MISIONES` cuántos jefes de 3-4 fases hay a partir de
  `MISIONES_BASE`, no de un contador aparte) y ELOI DE LA EXPANSIÓN
  (`campana.eloiExp`, campo nuevo en el ESQUEMA de `save.js`, una
  segunda cuenta del mismo ELOI de siempre — `perfil.eloi` sigue siendo
  la única suma que importa). Qué pantalla mostrar se decide en el
  instante exacto del final (`pantallaCompletaEsExp`), no releyendo el
  save cada vez que se pinta.
  ADMIN: cero cambios. `PUENTE_HANGAR.totalMisiones()`/`.mision()` ya
  leían `MISIONES` sin un "10" a fuego, así que las diez misiones nuevas
  y sus diez jefes/minijefes aparecen solos.
  Música y fondos: sin tocar. `TEMAS[].pista` ya reparte "combate_a"/
  "combate_b" por mundo desde 5D, y `hielo`/`abismo`/`fragua`/`grieta`
  ya tenían fondo propio en `art/fondos/` desde 5D — solo `megaciudad`
  sigue con `fondoRef:"neon"` (el pack MASTER no trae un fondo de
  ciudad-neón dedicado). Cuatro hooks documentados y DELIBERADAMENTE
  inertes en `js/music.js` (`combate_c`, `combate_d`, `jefe2`, `final2`)
  para cuando 5I traiga pistas propias — ninguno intenta cargar un
  archivo que no existe.
  Dificultad: nunca por HP absurdo, doble velocidad global ni spawns
  infinitos — sube por lectura (más tipos combinados por acto), espacio
  (columnas/corredores que se estrechan sin cerrarse nunca del todo,
  garantizado por construcción del propio bloque 5D) y comportamiento
  (los hazards/enemigos de cada mundo, introducidos uno a uno antes de
  mezclarse).
  Prueba: `herramientas/pruebas/mision-11-20.mjs` — estructura de las
  10 misiones, progresión completa M11→M20, save con recarga real
  (`localStorage`+`reload`, mismo patrón que `guardado.mjs`), que
  rejugar M11 tras M20 o M10 tras la expansión no retroceda nada,
  borrado de progreso, aislamiento de ADMIN, duración real de los diez
  jefes/minijefes jugada de verdad (bot apuntando, sin trucos) y
  rendimiento en escena densa de M12/14/16/18/20.

La expansión ya tiene sus 20 misiones, jugable de principio a fin: save
antiguo de M10 → M11 se abre sola → M11...M20 → AXIOMA → EXPANSIÓN
COMPLETADA, con su propio trofeo aparte del de OMEGA.

---

## 1. Hardcodes de 10 misiones encontrados

La buena noticia primero: **el juego ya está escrito contra
`MISIONES.length`, no contra el número 10.** Trece de los catorce sitios
que dependen del total lo leen de la tabla. Añadir diez entradas y el
juego funciona.

La mala: los sitios que quedan no dan error. Fallan en silencio, y dos de
ellos le quitan cosas a un jugador que ya se pasó la campaña.

### 1.1 Bloqueantes — hay que tocarlos sí o sí

| # | Dónde | Qué pasa hoy | Qué pasaría con 20 |
|---|---|---|---|
| **B1** | `index.html:5908` `const esUltima = misionIdx >= MISIONES.length - 1` | La pantalla de campaña completada se dispara al terminar la M10 | Se dispararía **solo en la M20**. Quien esté a medias pierde el final que tenía a la vista |
| **B2** | `index.html:4365` `s.campana.completada ? MISIONES.length : misionMax` | A quien completó la campaña se le conceden los chasis como si tuviera 10 misiones | Le concedería **20**, o sea todo lo que la expansión pida por progreso, sin haberlo jugado |
| **B3** | `index.html:5477` `SAVE.subirMision(min(misionIdx+1, MISIONES.length-1))` + save existente | Un jugador que terminó la M10 tiene `misionMax = 9`, topado | La M11 (índice 10) **le sale bloqueada** y no hay forma de abrirla salvo rejugar la M10. Es la regresión más gorda del bloque |
| **B4** | `js/ships.js` `requiere: 10` (NOVA) | NOVA pide 10 misiones completadas | Sigue funcionando, pero **B2 se la regalaría** a alguien con la campaña vieja terminada… y también todo lo que se añada con `requiere ≤ 20` |
| **B5** | `campana.completada` (bool, `js/save.js:47`) | Un solo trofeo | No distingue "campaña base" de "expansión". Terminar la M20 machacaría `campana.stats` y borraría el trofeo de OMEGA |

### 1.2 Cosméticos — se ven raros pero no rompen

| # | Dónde | Qué |
|---|---|---|
| C1 | `index.html:7413` | `"10 MISIONES · OMEGA SOVEREIGN DERROTADO"` escrito a mano |
| C2 | `index.html:5926` | `UI.desbloqueo(… "Diez misiones · OMEGA SOVEREIGN derrotado")` |
| C3 | `index.html:2907-2910` | `elegirPistaCombate()` alterna dos pistas con `misionIdx % 2`. Comentario: *"Diez misiones y dos pistas de combate"*. Con 20 misiones son 10 repeticiones por pista |
| C4 | `index.html:7131` | `pantallaMundos()`: `(H - SAFE_TOP - SAFE_BOTTOM - 140) / 4` — **el 4 es "cuántos mundos hay"**. Si la expansión añade temas, la rejilla de supervivencia se descuadra |

### 1.3 Maquetación — 20 filas no caben donde caben 10

| # | Dónde | Cuenta |
|---|---|---|
| ~~L1~~ ✅ | `pantallaCampana()` | `alto = clamp((disp - (n-1)*8)/n, 40, 78)`. En iPad (1180 px) con n=20 sale 46,6 px y **cabe**. En un iPhone SE (667 px) el `clamp` fuerza 40 px → 20×48 = 960 px en 571 disponibles. **Se sale de la pantalla y no hay desplazamiento** |
| ~~L2~~ ✅ | `ADMIN.dibujarJefes()` `js/admin.js` | Mismo cálculo, mismo problema, con el mismo mínimo de 34 px |
| ~~L3~~ ✅ | `pantallaCampanaCompleta()` | Panel de estadísticas de alto fijo (190 px). Si la expansión añade filas, se sale |

### 1.4 Lo que NO hay que tocar (verificado)

- `SAVE` esquema: `misionMax` y `misionIdx` admiten hasta **99**. Sin cambios.
- `campana.records`: mapa `m0…m19`, tipo `mapaNum`, sin tope de claves. Sin cambios.
- `misionMax` monótono (`SAVE.subirMision` hace `max`). Sin cambios.
- `armasDeMision()`, `elegirPremioAleatorio()`, `procesarEvento()`, HUD, pausa, resultados, VFX, audio: todos genéricos.
- `ADMIN.prepararPerfil()` usa `MISIONES.length - 1`. **Correcto ya.**
- `ADMIN.misionAbierta()` devuelve `true` siempre en admin. **Correcto ya.**
- `irAJefe()` busca el último evento `miniboss` de la misión. **Correcto ya.**

### 1.5 Pruebas que asumen 10

`guardado.mjs:314` siembra `misionMax: 9, completada: true` · `hangar.mjs`
usa `misionMax: 9` como "campaña terminada" en seis sitios y comprueba
`/M10/` en el aviso de NOVA · `campana-final.mjs` y `duracion-m6-m10.mjs`
recorren M6–M10 por nombre · `admin.mjs` usa `MISIONES.length - 1` (bien)
pero afirma `r.mision === 9`.

**Ninguna se rompe por sí sola**; todas necesitan repaso porque su
significado cambia.

---

## 2. Impacto en el save

**El esquema no cambia de versión.** Se añaden campos, y añadir campos ya
está resuelto: lo que no está se rellena con su valor por defecto.

### 2.1 Campos nuevos

```js
"campana.completadaBase":   { tipo: "bool", def: false },  // M10  · OMEGA
"campana.completadaExp":    { tipo: "bool", def: false },  // M20  · AXIOMA
"campana.statsExp":         { tipo: "objeto", def: null },
```

`campana.completada` **se conserva tal cual** y pasa a significar
"terminó la campaña base". `campana.stats` sigue siendo el trofeo de
OMEGA y no se toca nunca más. La expansión escribe en los campos nuevos.

### 2.2 Migración (v2 → v2, sin subir versión)

Una sola regla, y resuelve **B3** y **B4** a la vez:

```
si campana.completada === true  y  campana.misionMax < BASE:
    campana.misionMax = BASE          // BASE = 10 → la M11 abierta
    campana.completadaBase = true
```

`BASE` es una constante (`MISIONES_BASE = 10`), no `MISIONES.length`. Es
lo que impide que mañana, al añadir M21–M30, la misma regla vuelva a
regalar tramos.

Y para **B2**, la concesión de chasis pasa de

```js
SHIPS.otorgarPorProgreso(s.campana.completada ? MISIONES.length : misionMax, …)
```

a

```js
SHIPS.otorgarPorProgreso(misionesCompletadas(), …)

function misionesCompletadas() {
  if (SAVE.get("campana.completadaExp")) return MISIONES.length;
  if (SAVE.get("campana.completada"))    return Math.max(MISIONES_BASE, misionMax);
  return misionMax;
}
```

Así quien terminó la campaña vieja se queda con **10** y NOVA sigue
suya, pero nada de la expansión le cae en el regazo.

### 2.3 Lo que un jugador con la M10 terminada conserva, punto por punto

| | Antes | Después de la expansión |
|---|---|---|
| `perfil.record` · `perfil.eloi` · estadísticas | — | **intactos**, no se tocan |
| `campana.completada` | `true` | **`true`**, nunca se borra |
| `campana.stats` (trofeo de OMEGA) | el suyo | **el suyo**, la expansión escribe en `statsExp` |
| Pantalla CAMPAÑA COMPLETADA | accesible | **accesible**, es su trofeo |
| `campana.records` M1–M10 | los suyos | **los suyos** |
| NOVA y los cinco chasis | desbloqueados | **desbloqueados** |
| Personalización (`naves.config`) | la suya | **la suya** |
| Acceso a M11 | — | **abierto en el primer arranque**, por migración |
| Naves de la expansión | — | **bloqueadas** hasta jugarlas |

Esto es una prueba, no una promesa: `expansion-compat.mjs`, sección 15.

---

## 3. Arquitectura propuesta

`index.html` está en **8.179 líneas** y la tabla `MISIONES` ocupa 493 de
ellas. Duplicarla mete ~500 líneas más de datos en un archivo que ya
pesa, y la tabla `JEFES` (922 líneas para 10 jefes) crecería otras ~800
con los cinco jefes y los cinco minijefes nuevos.

**Propuesta: sacar los DATOS, dejar el MOTOR donde está.**

```
js/misiones.js      MISIONES (20) + MISIONES_BASE + TEMAS (los 4 + los nuevos)
js/jefes.js         JEFES (10 actuales + 5 minijefes + 5 jefes)
js/enemigos.js      ENEMIGOS (14 actuales + 10 nuevos)
index.html          el motor: procesarEvento, spawn, colisiones, dibujo…
```

Tres archivos, `<script src>` clásico, **antes** del bloque del juego —
exactamente el mismo patrón que `ships.js`, `hangar.js` y `admin.js`. Sin
módulos ES (con `file://` el navegador los bloquea por CORS y el juego se
queda en negro).

Por qué así y no de otra forma:

- **Es mover, no reescribir.** Las tablas son literales; se cortan y se
  pegan. El riesgo de un movimiento así es que se pierda una coma, y eso
  lo caza el primer arranque.
- **Las tablas se leen mientras se diseña.** Tener las veinte misiones en
  un archivo de 1.000 líneas de puros datos es mucho más manejable que
  buscarlas dentro de 8.700.
- **El motor no se entera.** `procesarEvento`, `spawnFormacion`,
  `spawnMiniboss` y el bucle de eventos no cambian ni una línea.

Fuera de eso, lo nuevo son **primitivas de evento**, no sistemas:

| Primitiva nueva | Reutiliza | Coste estimado |
|---|---|---|
| `fn:"columna"` (colada vertical) | `carril` girado 90° | ~25 líneas |
| `fn:"oscuridad"` (velo con hueco) | el velo de `dibujarTransicion` | ~30 líneas |
| `fn:"ruptura"` (spawn lateral / central) | `spawnFormacion` + telégrafo | ~35 líneas |
| `fn:"placas"` (armadura por placas) | los subsistemas de OMEGA | ~0, ya existe |
| 4 tipos de `hazard` nuevos | `HAZARD_TIPOS` es una tabla | ~4 líneas + arte |

**Cero sistemas nuevos.** Todo lo demás sale de combinar lo que ya hay.

---

## 4. Diseño M11–M20

Duraciones objetivo en línea con la campaña actual (M1 210 s · M6 306 s ·
M10 340 s). La expansión arranca donde termina M10, no donde termina M1.

### FROZEN FRONTIER

#### M11 · «DERIVA BLANCA» — 260 s

| | |
|---|---|
| **Mundo** | `hielo` |
| **Identidad** | El campo deja de estar vacío. Témpanos a la deriva **bloquean los disparos**: los tuyos y los suyos. Por primera vez la posición no es solo esquivar, es buscar línea de tiro |
| **Enemigos** | `normal`, `veloz`, `torreta`, `kamikaze` + **`sierra_hielo`** (rebota en las paredes laterales) + **`prisma`** (devuelve tu disparo en ángulo; hay que darle de lado) |
| **Formaciones** | `linea`, `ola`, `zigzag`, `pinza` |
| **Hazards** | **`tempano`** — bloque a la deriva, 8 hp, **detiene proyectiles**. Es cobertura y es estorbo |
| **Evento especial** | **VENTISCA** (t≈150, 25 s): velo blanco en movimiento que reduce la visibilidad. Telegrafiado 3 s. Las balas enemigas mantienen contraste íntegro |
| **Miniboss** | **CAZADOR POLAR** (t≈205) · 280 hp · 2 fases |
| **Boss** | — |
| **Dificultad** | 6/10 · el listón es la M6, no la M1 |
| **Recompensa** | 2.200 base · armas `cryo`, `laser` |
| **Assets** | `sierra_hielo.png`, `prisma.png`, `cazador_polar.png`, `tempano.png`, fondo `hielo.png` |

#### M12 · «EL YUNQUE BLANCO» — 275 s

| | |
|---|---|
| **Mundo** | `hielo` |
| **Identidad** | Todo lo de M11, contra algo que lo usa a su favor |
| **Enemigos** | los de M11 + `tanque`, `portaescudos` |
| **Hazards** | `tempano`, más denso en la fase de jefe |
| **Evento especial** | La pelea del jefe ocurre **con témpanos en pantalla**: el jefe los usa de escudo |
| **Boss** | **KRYOS, EL YUNQUE BLANCO** — 4 placas de hielo + núcleo |
| **Dificultad** | 7/10 |
| **Recompensa** | 3.000 base + skin **ÁRTICA** (ver §12) |
| **Assets** | `kryos.png` |

### NEON MEGACITY

#### M13 · «TRÁFICO CRUZADO» — 270 s

| | |
|---|---|
| **Mundo** | `megaciudad` |
| **Identidad** | La ciudad está viva y no te está mirando. Carriles de tráfico civil cruzan en horizontal: no te disparan, pero te matan |
| **Enemigos** | `veloz`, `dron_ataque`, `dron_misil`, `elite` + **`patrulla`** (recorre un carril horizontal disparando hacia abajo) + **`torre_neon`** (torre de borde, fija, dispara en horizontal) |
| **Formaciones** | `linea`, `V`, `ola` |
| **Hazards** | **`trafico`** — lanzadera civil, cruza en horizontal, destructible, **no da puntos**. Es un obstáculo, no un objetivo |
| **Evento especial** | **APAGÓN** (t≈165, 8 s): se apaga la ciudad, solo quedan los perfiles de neón. Telegrafiado 2 s |
| **Miniboss** | **UNIDAD DE CONTROL** (t≈215) · 300 hp · 2 fases |
| **Boss** | — |
| **Dificultad** | 7/10 |
| **Recompensa** | 2.400 base · armas `railgun`, `electrico` |
| **Assets** | `patrulla.png`, `torre_neon.png`, `unidad_control.png`, `trafico_a.png`, `trafico_b.png` |

#### M14 · «TORRE CENTINELA» — 280 s

| | |
|---|---|
| **Mundo** | `megaciudad` |
| **Identidad** | El jefe **no se mueve**: es la torre. Lo que se mueve es el campo |
| **Enemigos** | los de M13 + `crucero` |
| **Hazards** | `trafico`, en carriles que el jefe reorienta |
| **Boss** | **VÉRTICE, LA TORRE VIVA** — 3 antenas (subsistemas) + carriles reorientables |
| **Dificultad** | 7,5/10 |
| **Recompensa** | 3.200 base + skin **TORMENTA** |
| **Assets** | `vertice.png` |

### ALIEN ABYSS

#### M15 · «LUZ MUERTA» — 285 s

| | |
|---|---|
| **Mundo** | `abismo` |
| **Identidad** | Oscuridad. Tu nave es la linterna. Lo que brilla, o es tuyo o te quiere matar |
| **Enemigos** | `normal`, `bombardero`, `francotirador`, `dron_escudo` + **`medusa`** (invisible hasta que late; el latido **es** el telégrafo) + **`sembrador`** (suelta minas lentas y se va) |
| **Formaciones** | `ola`, `pinza`, `zigzag` |
| **Hazards** | **`mina_bio`** — mina flotante lenta, radio de explosión pequeño y legible |
| **Evento especial** | **OSCURIDAD** (t≈120, 30 s): velo oscuro con un hueco radial alrededor de tu nave. **Las balas enemigas conservan brillo íntegro** — la regla de legibilidad del proyecto manda sobre el efecto |
| **Miniboss** | **GUARDIÁN DE RUINA** (t≈230) · 320 hp · 2 fases |
| **Boss** | — |
| **Dificultad** | 8/10 |
| **Recompensa** | 2.600 base · armas `void`, `plasma` |
| **Assets** | `medusa.png`, `sembrador.png`, `guardian_ruina.png`, `mina_bio.png`, fondo `abismo.png` (opcional, ver §10) |

#### M16 · «EL QUE DUERME» — 290 s

| | |
|---|---|
| **Mundo** | `abismo` |
| **Identidad** | Un jefe que **se parte en dos** y hay que cerrar los dos a la vez |
| **Enemigos** | los de M15 + `medusa` en enjambre |
| **Hazards** | `mina_bio` durante la fase 2 |
| **Boss** | **NÝX, LA MAREA QUE PIENSA** — al 60 % se divide; si una mitad sobrevive 8 s sola, regenera a la otra |
| **Dificultad** | 8/10 |
| **Recompensa** | 3.400 base + skin **TÓXICA** |
| **Assets** | `nyx.png` (+ media silueta para las mitades, se puede componer por código) |

### VOLCANIC FORGE

#### M17 · «COLADA» — 290 s

| | |
|---|---|
| **Mundo** | `fragua` |
| **Identidad** | Columnas de lava caen del techo, siempre anunciadas. El campo se estrecha por columnas, no por balas |
| **Enemigos** | `tanque`, `torreta`, `kamikaze`, `comando` + **`crisol`** (al morir se parte en dos más pequeños) + **`martillo`** (pesado, golpe telegrafiado hacia abajo) |
| **Formaciones** | `linea`, `pinza`, `V` |
| **Hazards** | **`colada`** — columna vertical de lava, telegrafiada 1,4 s. Primitiva `fn:"columna"` |
| **Evento especial** | **SOBRECARGA DEL HORNO** (t≈180, 20 s): las columnas se aceleran hasta que el horno purga. Con final visible, no indefinido |
| **Miniboss** | **YUNQUE MÓVIL** (t≈235) · 340 hp · 2 fases |
| **Boss** | — |
| **Dificultad** | 8,5/10 |
| **Recompensa** | 2.800 base · armas `fuego`, `misil` |
| **Assets** | `crisol.png`, `martillo.png`, `yunque_movil.png`, `colada.png`, fondo `fragua.png` (opcional) |

#### M18 · «MAESTRO DE FRAGUA» — 300 s

| | |
|---|---|
| **Mundo** | `fragua` |
| **Identidad** | El jefe **se fabrica armas durante el combate**. Puedes impedírselo |
| **Enemigos** | `crisol`, `martillo`, `elite` |
| **Hazards** | `colada` durante todo el combate |
| **Boss** | **VULCANO, EL QUE FORJA** — cada 25 s forja un arma nueva, telegrafiado 3 s. Si le rompes el brazo de forja en esa ventana, la cancela. Si no, se la queda |
| **Dificultad** | 9/10 |
| **Recompensa** | 3.600 base + skin **INFIERNO** |
| **Assets** | `vulcano.png` |

### RIFT REALM

#### M19 · «ESPACIO ROTO» — 300 s

| | |
|---|---|
| **Mundo** | `grieta` |
| **Identidad** | Los enemigos dejan de venir de arriba. Las grietas se abren en los lados y en mitad del campo |
| **Enemigos** | `elite`, `crucero`, `dron_misil`, `comando` + **`rompedor`** (se teletransporta a saltos cortos, siempre con destello previo) + **`eco`** (copia tu posición horizontal; hay que romper la simetría para acertarle) |
| **Formaciones** | todas, más las que entran por grieta |
| **Hazards** | **`fragmento`** — esquirla estática de espacio roto; bloquea disparos y **rebota una bala enemiga** antes de agotarse |
| **Evento especial** | **RUPTURAS** (desde t≈60, recurrente): grietas laterales y centrales que sueltan enemigos, telegrafiadas 1,5 s. Cambia la lectura espacial del juego entero sin cambiar un solo número |
| **Miniboss** | **HERALDO DE LA GRIETA** (t≈245) · 360 hp · 2 fases |
| **Boss** | — |
| **Dificultad** | 9/10 |
| **Recompensa** | 3.000 base · armas `void`, `railgun` |
| **Assets** | `rompedor.png`, `eco.png`, `heraldo_grieta.png`, `fragmento.png`, fondo `grieta.png` |

#### M20 · «LO QUE QUEDA» — 360 s

| | |
|---|---|
| **Mundo** | `grieta` |
| **Identidad** | El cierre. Cuatro fases, y una de ellas es un desfile de todo lo que has matado |
| **Enemigos** | los cinco nuevos, en oleadas cortas entre fases |
| **Hazards** | `fragmento` en F1, ninguno en F4 |
| **Boss** | **AXIOMA, LO NO ESCRITO** · `epico: true` |
| | **F1 (100–75 %)** — portales emparejados: sus balas entran por uno y salen por el otro. El peligro viene de donde él no está |
| | **F2 (75–45 %)** — el campo se fragmenta: tres esquirlas grandes fijas que hay que rodear |
| | **F3 (45–20 %)** — **ECOS**: invoca en fila las siluetas de KRYOS, VÉRTICE, NÝX y VULCANO, uno cada vez, con **un solo ataque característico** y poca vida. Es el momento memorable, y no cuesta arte nuevo: son sus tablas con `mult` bajo y una fase |
| | **F4 (20–0 %)** — sin portales, sin esquirlas, sin ecos. Él y tú |
| **Dificultad** | 10/10 |
| **Recompensa** | 6.000 base + **CAMPAÑA EXPANDIDA COMPLETADA** + skin **CÓSMICA** |
| **Assets** | `axioma.png` |

---

## 5. Los cinco mundos

Los temas son **datos**: paleta, fondo y tipo de partícula de fondo. Un
tema nuevo son 6 líneas más un PNG.

| Tema | Nombre | Fondo | Paleta | Fondo PNG |
|---|---|---|---|---|
| `hielo` | **FRONTERA HELADA** | `estrellas` (nieve) | blancos y cianes fríos, acero; enemigos en ámbar | **falta** `hielo.png` |
| `megaciudad` | **MEGACIUDAD** | `rejilla` | magenta y cian densos, violeta profundo | reutiliza `neon.png` · variante deseable |
| `abismo` | **ABISMO ALIENÍGENA** | `burbujas` | verde azulado muy oscuro, bioluminiscencia violeta | reutiliza `oceano.png` · variante deseable |
| `fragua` | **FRAGUA VOLCÁNICA** | `brasas` | naranja fundido, acero negro, industrial | reutiliza `volcan.png` · variante deseable |
| `grieta` | **REINO DE LA GRIETA** | `estrellas` (invertido) | blanco roto, violeta, negro absoluto | **falta** `grieta.png` |

**Decisión a tomar (§14, R3):** los temas también alimentan la pantalla
de SUPERVIVENCIA, que hoy tiene cuatro mundos y una maquetación con `/4`
a mano. Añadir cinco temas la convierte en nueve tarjetas. Recomiendo
marcar los nuevos `soloCampana: true` y decidir aparte si supervivencia
crece — es otra decisión de producto, no un efecto secundario.

---

## 6. Enemigos

**14 existentes, todos reutilizables.** 10 nuevos, dos por mundo:

| Id | Mundo | Qué hace (una frase) | Por qué es nuevo y no un `normal` con más vida |
|---|---|---|---|
| `sierra_hielo` | hielo | Rebota en las paredes laterales | Trayectoria predecible pero no vertical: obliga a leer el rebote |
| `prisma` | hielo | Devuelve tu disparo en ángulo | El primer enemigo al que **no** se le dispara de frente |
| `patrulla` | megaciudad | Cruza un carril horizontal disparando hacia abajo | Amenaza que atraviesa, no que baja |
| `torre_neon` | megaciudad | Torre de borde fija, dispara en horizontal | Convierte los laterales en zona peligrosa |
| `medusa` | abismo | Invisible hasta que late | El telégrafo **es** el enemigo |
| `sembrador` | abismo | Suelta minas y se va | Deja peligro detrás: mata al que persigue |
| `crisol` | fragua | Al morir se parte en dos | Matar deprisa se paga |
| `martillo` | fragua | Golpe pesado telegrafiado | Enseña a no quedarse debajo |
| `rompedor` | grieta | Se teletransporta a saltos cortos | Rompe el seguimiento con la mira |
| `eco` | grieta | Copia tu posición horizontal | El único al que se le gana moviéndose raro |

Ninguno tiene más de **8 hp**. La dificultad viene de cómo se leen, no de
cuánto aguantan.

---

## 7. Los cinco minijefes

Van en la misma tabla `JEFES` (hoy los minijefes ya son entradas de
`JEFES` invocadas con `fn:"miniboss"`). 2 fases, 280–360 hp.

| Id | Nombre | Misión | Mecánica |
|---|---|---|---|
| `cazador_polar` | **CAZADOR POLAR** | M11 | Se esconde detrás de los témpanos; hay que romper la cobertura o rodearla |
| `unidad_control` | **UNIDAD DE CONTROL** | M13 | Reorienta los carriles de tráfico contra ti mientras dispara |
| `guardian_ruina` | **GUARDIÁN DE RUINA** | M15 | Solo es vulnerable cuando se ilumina, y se ilumina cuando ataca |
| `yunque_movil` | **YUNQUE MÓVIL** | M17 | Marca una columna de colada y se pone encima de ella: la cobertura es su ataque |
| `heraldo_grieta` | **HERALDO DE LA GRIETA** | M19 | Se teletransporta entre tres posiciones fijas, siempre anunciadas |

---

## 8. Los cinco jefes

3 fases (4 el final), 700–1.500 hp. **Ninguno recicla a los diez
actuales**: cada uno estrena una mecánica que se explica en una frase.

| Id | Nombre | Misión | HP | Fases | Mecánica firma | Reutiliza |
|---|---|---|---|---|---|---|
| `kryos` | **KRYOS, EL YUNQUE BLANCO** | M12 | 900 | 3 | **Placas**: 4 placas de hielo; el núcleo no recibe daño hasta romperlas. Entre fases recongela 2 y tú decides si rehacer el trabajo o empujar | subsistemas de OMEGA |
| `vertice` | **VÉRTICE, LA TORRE VIVA** | M14 | 1.000 | 3 | **No se mueve.** Reorienta los carriles del campo. 3 antenas lo mantienen escudado | `sistemas` + `carril` |
| `nyx` | **NÝX, LA MAREA QUE PIENSA** | M16 | 1.100 | 3 | **Se parte en dos** al 60 %; si una mitad sobrevive 8 s sola, regenera a la otra | spawn de minijefe |
| `vulcano` | **VULCANO, EL QUE FORJA** | M18 | 1.250 | 3 | **Forja armas** cada 25 s; puedes cancelarlo rompiéndole el brazo en la ventana de 3 s | subsistemas + telégrafos |
| `axioma` | **AXIOMA, LO NO ESCRITO** | M20 | 1.600 | 4 | **Portales** (F1) · **fragmentación** (F2) · **ecos de los cuatro jefes** (F3) · **cara a cara** (F4) | todo lo anterior |

`axioma` lleva `epico: true`: muerte larga, sacudida de jefe final,
`jefe_final` de música. Es el único que la usa además de OMEGA.

---

## 9. Hazards

Hoy hay **dos**: `asteroide` y `cristal`. La tabla `HAZARD_TIPOS` son
cuatro campos por entrada, así que un hazard nuevo es una línea más el
arte más, cuando toca, un comportamiento.

| Id | Mundo | Comportamiento | Coste |
|---|---|---|---|
| `tempano` | hielo | Deriva lenta, 8 hp, **bloquea proyectiles** | tabla + ~15 líneas (bloqueo) |
| `trafico` | megaciudad | Cruce horizontal, destructible, **0 puntos** | tabla (`lateral` ya existe) |
| `mina_bio` | abismo | Flota, explota en radio pequeño al contacto | tabla + ~12 líneas |
| `colada` | fragua | Columna vertical telegrafiada — primitiva `fn:"columna"` | ~25 líneas |
| `fragmento` | grieta | Estático, bloquea disparos y **rebota una bala enemiga** | ~20 líneas |

Los dos actuales siguen tal cual y se reutilizan: `asteroide` encaja en
`grieta`, `cristal` en `hielo`.

---

## 10. Assets exactos necesarios

### Enemigos — 10 PNG · `art/enemigos/`

```
sierra_hielo.png   prisma.png
patrulla.png       torre_neon.png
medusa.png         sembrador.png
crisol.png         martillo.png
rompedor.png       eco.png
```
Mismo formato que los 14 actuales: PNG con alfa real, recortado al píxel,
lado mayor ≤ 512, morro hacia **abajo** (miran al jugador). Referencia de
peso: los 14 actuales ocupan 1.092 kB en total.

### Minijefes — 5 PNG · `art/bosses/`

```
cazador_polar.png   unidad_control.png   guardian_ruina.png
yunque_movil.png    heraldo_grieta.png
```

### Jefes — 5 PNG · `art/bosses/`

```
kryos.png   vertice.png   nyx.png   vulcano.png   axioma.png
```
Los 10 actuales ocupan 2.564 kB; estos 10 nuevos añadirán ~2,5 MB.
`vertice.png` conviene que sea **vertical y alto** (es una torre) y
`axioma.png` el más grande de todos.

### Hazards — 6 PNG · `art/hazards/`

```
tempano.png     trafico_a.png   trafico_b.png
mina_bio.png    colada.png      fragmento.png
```
Dos dibujos de tráfico por el mismo motivo que hay dos de asteroide: una
fila de veinte copias idénticas se lee como un patrón, no como tráfico.

### Fondos — `art/fondos/`, 941×1672, ~2 MB cada uno

| | |
|---|---|
| **Imprescindibles (2)** | `hielo.png`, `grieta.png` |
| **Deseables (3)** | `megaciudad.png`, `abismo.png`, `fragua.png` |

Los tres deseables tienen **repuesto automático**: si el archivo no
existe, el tema usa el fondo del mundo equivalente (`neon`, `oceano`,
`volcan`). La expansión es jugable y coherente con solo los dos
imprescindibles; los otros tres suben el listón visual y pueden llegar
después sin tocar código.

**Ojo al peso**: `art/fondos/` ya son 8,4 MB. Cinco más lo dejan en ~18
MB. Para Netlify da igual; para el primer arranque en iPad con datos
móviles, no. Los fondos se cargan con `cargarImagen` bajo demanda por
tema, así que solo se descarga el del mundo en el que se juega — merece
la pena comprobarlo antes de dar por buena la cifra.

### VFX

**Procedural, sin arte nuevo**, reutilizando las familias que ya existen
en `vfx.js`:

| Efecto | Cómo |
|---|---|
| Ventisca, apagado, oscuridad | velo con degradado, como `dibujarTransicion` |
| Escarcha, brillo bioluminiscente | `lighter` + gradiente radial |
| Portales | dos elipses con anillo pulsante, dibujadas |
| Fragmentación del campo | polígonos con `stroke` |
| Rotura de placas de KRYOS | el sistema de escombros de los subsistemas de OMEGA |
| Colada de lava | gradiente vertical + partículas de la familia `brasas` |

**Con arte (opcional, 2 PNG):** `vfx_portal.png` y `vfx_escarcha.png`, si
al probarlo el resultado procedural no convence. No son bloqueantes.

### Sprites de proyectil

Se reutilizan los 11 actuales de `art/proy_enemigos/`. Ninguno nuevo.

---

## 11. Música

Hoy: **10 pistas, 8,3 MB**. `elegirPistaCombate()` alterna `combate_a` y
`combate_b` con `misionIdx % 2`; con veinte misiones cada pista suena en
diez, y son misiones de cuatro a seis minutos.

| Prioridad | Pista | Por qué |
|---|---|---|
| **Imprescindible** | `combate_c.mp3` | Sin ella la expansión suena exactamente igual que la campaña base, que es lo contrario de "segunda campaña" |
| **Imprescindible** | `jefe2.mp3` | Los cinco jefes nuevos compartirían tema con los nueve viejos. Es lo que más delata un refrito |
| **Deseable** | `combate_d.mp3` | Deja 4 pistas para 20 misiones: dos por mundo |
| **Deseable** | `final2.mp3` | AXIOMA merece cierre propio; hoy reutilizaría el de OMEGA |

Y **un cambio de una línea**: la elección de pista pasa de `misionIdx % 2`
a hacerse **por mundo**, para que cada bloque de dos misiones tenga su
sonido y no se alterne a ciegas.

Todo con licencia CC0 verificada en origen y normalizado a −16 LUFS con
`preparar-musica.mjs`, igual que las diez actuales. Cuatro pistas nuevas
añaden ~3,5 MB.

---

## 12. Progresión y dificultad

**La expansión empieza en 6/10, no en 1/10.** Quien llega a M11 lleva
diez misiones y a OMEGA derrotado.

```
M1 ▁▂▂▃▃▄▄▅▅▆  M10
                M11 ▆▆▇▇▇▇███ M20
      6  7  7  7½  8  8  8½  9  9  10
```

Cómo sube la dificultad, y cómo **no**:

| Sí | No |
|---|---|
| Más tipos de lectura simultáneos (hazard + formación + telégrafo) | Más vida a los mismos enemigos |
| Enemigos que castigan un hábito concreto (`prisma`, `eco`, `crisol`) | Más balas en pantalla |
| Hazards que estrechan el campo con aviso | Patrones imposibles de leer en 9,7″ |
| Jefes con una regla nueva explicable en una frase | Jefes con la misma regla y más fases |

**Topes que no se tocan:** el máximo de balas enemigas en pantalla (regla
de diseño, no optimización), los presupuestos de partículas por familia,
y la prioridad de legibilidad *bala enemiga > VFX*. Los eventos nuevos de
oscuridad y ventisca **respetan esa prioridad por definición**: oscurecen
el fondo, nunca los proyectiles.

**Recompensas.** Hoy no hay nada que dar salvo puntuación y ELOI: los
cosméticos son gratuitos y no hay tienda. Dos opciones, y recomiendo la
primera:

- **(A, recomendada)** Las **cinco skins de material** —INFIERNO, ÁRTICA,
  TÓXICA, TORMENTA, CÓSMICA— ya están declaradas y bloqueadas a la espera
  de su arte. Convertirlas en la recompensa de M12/M14/M16/M18/M20 le da
  a la expansión una progresión real **sin tocar balance y sin una nave
  nueva que calibrar**. Coste: el arte de las skins (5 PNG por chasis…
  ver §14, R5).
- **(B)** Un sexto chasis al terminar M20. Coste: arte + balance +
  medición con `duracion-*.mjs`. Y NOVA sigue sin calibrar; añadir otra
  nave sin ficha antes de arreglar esa es acumular deuda.

---

## 13. Compatibilidad con ADMIN

**Casi todo ya funciona.** Se comprobó línea a línea:

| | |
|---|---|
| `ADMIN.prepararPerfil()` | usa `MISIONES.length - 1` → los perfiles abren **las 20** solos |
| `ADMIN.misionAbierta()` | devuelve `true` siempre en admin → sin cambios |
| Selector de misión | es la pantalla de campaña; hereda su arreglo de maquetación (L1) |
| `irAJefe(i)` | busca el **último** evento `miniboss` de la misión → funciona con los jefes nuevos sin tocar nada |
| Founder Fleet, perfiles, aislamiento de saves | **no les afecta**: la expansión no toca `ships.js` ni `save.js` salvo para añadir campos |

Lo único que hay que tocar:

1. **`ADMIN.dibujarJefes()`** — la lista pasa de 10 a 20 entradas (L2).
   Cabe en iPad; hay que decidir qué hacer en pantallas cortas.
2. **El selector de jefes debería agrupar por mundo** ahora que hay 20.
   Diez seguidos se leen; veinte, no.
3. Los perfiles de familia existentes ya tienen `misionMax = 9` escrito.
   La migración de §2.2 les vale igual, pero conviene que
   `prepararPerfil` lo suba a `MISIONES.length - 1` en la siguiente
   entrada — **ya lo hace**, verificado.

---

## 14. Riesgos

| # | Riesgo | Impacto | Mitigación |
|---|---|---|---|
| **R1** | **Un jugador con la M10 terminada se queda sin M11** | **Alto** — es la regresión que arruina el bloque | Migración de §2.2 + `expansion-compat.mjs` que la prueba con un save real de la campaña vieja |
| **R2** | La concesión retroactiva regala contenido de la expansión (B2) | **Alto** — no se puede retirar lo regalado | `misionesCompletadas()` topado en `MISIONES_BASE`. Prueba con save de campaña completada |
| **R3** | Cinco temas nuevos inflan SUPERVIVENCIA de 4 a 9 mundos | Medio | **Decidido: supervivencia SÍ crece a nueve mundos.** Crece a mano —añadiendo el id a `SURVIVAL_MUNDOS`— cuando el tema exista de verdad, en 5D. La maquetación de los nueve ya está hecha y medida en 5C; lo que queda es calibrar oleadas para temas pensados para campaña |
| ~~R4~~ ✅ | La lista de 20 misiones no cabe en pantallas cortas | — | **Resuelto en 5C sin scroll**: `rejilla()` pasa a dos columnas cuando una sola no cabe (`altoMin`) o cuando son demasiadas filas para recorrerlas de un vistazo (`maxFilas`). Medido en iPad y en iPhone SE |
| **R5** | Las 5 skins de material como recompensa necesitan **un PNG por chasis** | Medio | 5 skins × 9 chasis = 45 PNG. Alternativa: que sean de tinte con un patrón procedural encima, o que solo apliquen a los 5 chasis normales (25 PNG) |
| **R6** | Duplicar `MISIONES` y `JEFES` deja `index.html` en ~9.500 líneas | Medio · mantenimiento | Extracción a `js/misiones.js`, `js/jefes.js`, `js/enemigos.js` (§3) **antes** de escribir contenido nuevo |
| **R7** | Los eventos de oscuridad y apagón pueden hacer ilegible el juego en iPad | Medio | Los proyectiles enemigos quedan **fuera** del velo por construcción. Medición de contraste con la misma prueba de píxeles que se usó en el Bloque 3 |
| **R8** | 10 misiones más sin jugador real | Medio | Igual que M6–M10: `duracion-*.mjs` da duración fiable, no sensación. Hace falta que las juegue una persona |
| **R9** | +2,5 MB de jefes, +5 MB de fondos, +3,5 MB de música | Bajo | Carga por tema y bajo demanda; medir el primer arranque en iPad con datos |
| **R10** | 5 jefes nuevos ≈ 800 líneas de tabla | Bajo · esperado | Es el trabajo, no un riesgo. Los 10 actuales son 922 líneas |
| **R11** | Las pruebas actuales usan `misionMax: 9` como "campaña terminada" | Bajo | Repasar `hangar.mjs`, `guardado.mjs` y `admin.mjs`: cambian de significado aunque no fallen |

---

## 15. Fases de implementación

Cada fase termina en verde y se para para revisión, como los bloques
anteriores.

| Fase | Qué | Se puede jugar al terminar |
|---|---|---|
| **5A · Cimientos** ✅ | Extraer `MISIONES`/`TEMAS`, `JEFES` y `ENEMIGOS` a `js/misiones.js`, `js/jefes.js`, `js/enemigos.js`. **Cero cambios de comportamiento.** Regresión completa | Igual que hoy, exactamente |
| **5B · Compatibilidad** ✅ | `MISIONES_BASE`, `completadaBase`/`completadaExp`, migración de §2.2, `misionesCompletadas()`, arreglo de B1–B5 y C1–C3. Prueba nueva `expansion-compat.mjs` con saves reales de campaña vieja | Igual que hoy, pero **a prueba de expansión** |
| **5C · Maquetación** ✅ | 20 misiones en la lista de campaña y en el selector de jefes de ADMIN. Agrupación por mundo. Mundos de supervivencia (R3) | Se ven 20 huecos, 10 llenos |
| **5D · Mundos y hazards** ✅ | Temas `hielo` y `grieta` + fondos. Los 5 hazards nuevos y las primitivas `columna`, `oscuridad`, `ruptura` | Probable en supervivencia / ADMIN |
| **5E · Enemigos** ✅ | Los 10 enemigos nuevos con su arte | Aparecen en ADMIN |
| **5F · Minijefes** ✅ | Los 5 minijefes (`cazador_polar`, `unidad_control`, `guardian_ruina`, `yunque_movil`, `heraldo_grieta`), los cinco a la vez y no mundo a mundo — reorganizado sobre la marcha: igual que 5D e 5E hicieron todos los mundos/enemigos juntos, tiene más sentido cerrar un SISTEMA entero (minijefes) que ir de mundo en mundo repitiendo el mismo tipo de trabajo cinco veces | Aparecen en ADMIN, con su coreografía completa |
| **5G · Jefes completos** ✅ | Los 5 jefes de fin de mundo (`kryos`, `vertice`, `nyx`, `vulcano`, `axioma`), con más fases que un minijefe | Aparecen en ADMIN |
| **5H · Integración real M11–M20** ✅ | Los eventos de las diez misiones nuevas —dónde entra cada enemigo, minijefe y jefe— y la pantalla de expansión completada | **La expansión entera, jugable de principio a fin** |
| **5I · Música y arte final** ✅ | Cinco pistas de combate/jefe propias (`combate_c/d/e`, `jefe2`, `final2`), mapping por mundo, fondo propio de MEGACIUDAD, cinco skins de material reales para chassis_01, cinco emblemas de la expansión | **La expansión suena y se ve terminada, no con lo prestado de 5D-5H** |

**5A y 5B se hacen antes que cualquier contenido.** No por orden: porque
5B es lo único de todo el bloque que puede estropearle la partida a
alguien, y hacerlo con diez misiones —donde todo es comprobable— es mucho
más seguro que hacerlo con veinte a medio escribir.

---

*5A, 5B, 5C, 5D, 5E, 5F, 5G, 5H y 5I implementados y en verde. Bloque 5
completo. Nada publicado, nada empujado.*

---

## 16. Bloque 5I — música y arte final (hecho)

**Los dos ZIP de origen** (`FLIGHT_STRIKE_MUSIC_EXPANSION_5I.zip`,
`FLIGHT_STRIKE_BLOQUE5_MASTER_ASSETS_v1.zip`) se inspeccionaron enteros
antes de tocar nada, comparando cada categoría contra lo ya integrado en
5D-5H. Resultado del inventario:

- **Música (5 pistas, MintoDog, CC0):** todas se usan.
- **01_BACKGROUNDS (5 PNG):** solo `BACKGROUND_MEGACITY.png` entra —
  es el único mundo de la expansión que no tenía fondo propio (usaba el
  de "neon" prestado). Los otros cuatro fondos del pack (hielo, abismo,
  fragua, grieta) se compararon uno a uno contra los ya integrados en
  5D: misma familia de estilo (pintura oscura por el centro, para que
  las balas se lean), misma resolución, y ninguno es claramente mejor
  que el que ya hay — así que se quedan los de 5D, sin forzar el
  cambio.
- **07_REWARD_EMBLEMS (5 PNG) y 08_REWARD_SKINS_CHASSIS_01 (5 PNG):**
  las diez entran — son contenido nuevo, no había nada que comparar.
- **03_ENEMIES / 04_HAZARDS / 05_MINIBOSSES / 06_BOSSES:** revisados y
  **no se usan**. El pack mezcla dos lenguajes de diseño distintos entre
  sí (algunos jefes son cazas fotorrealistas tipo F-22, algunos enemigos
  son iconos planos con contorno grueso) y ninguno de los dos coincide
  con el lenguaje ya establecido en 5E-5G (seres cristalinos/energéticos
  abstractos, coherente en los veinte jefes). Cambiar solo KRYOS o
  VÉRTICE habría dejado el plantel de jefes con dos estilos a la vez.
  El arte de 5E-5G ya estaba aprobado y probado; no se tocó.

**A · Música.** Cinco pistas de MintoDog (`combate_c` Space Battle,
`combate_d` Space Adventure, `combate_e` Hard Battle 2, `jefe2` Space
Boss Battle, `final2` Heavy Boss Battle 2), normalizadas a −16 LUFS /
pico real −1,5 dBFS con `herramientas/preparar-musica-expansion.mjs`
(mismo contrato que las seis del bloque base). Detalle completo,
licencias y hashes en `THIRD_PARTY_AUDIO_LICENSES.md`.

**B · Mapping.** No se siguió el mapping propuesto en el prompt a
ciegas: hielo y fragua comparten `combate_c` (130 BPM, el tempo más
tranquilo de los tres), abismo y grieta comparten `combate_d` (140 BPM,
la más atmosférica — "Space Adventure"), y megaciudad se queda sola con
`combate_e` (140 BPM, "Hard Battle 2") para que el mundo más urbano
destaque en vez de sonar a más de lo mismo. Los cuatro jefes completos
no épicos (KRYOS/VÉRTICE/NÝX/VULCANO) comparten `jefe2` (175 BPM);
AXIOMA suena con `final2` (110 BPM) — el contraste de tempo con `jefe2`
es lo que lo separa de verdad de los otros cuatro, más que compartir
"jefe_final" con OMEGA SOVEREIGN como hacía antes de 5I. Razonamiento
completo, mundo a mundo, en `THIRD_PARTY_AUDIO_LICENSES.md`.

**C · Carga lazy.** No hizo falta construir nada nuevo: el catálogo de
`js/music.js` es una tabla de metadatos, y lo único que descarga algo de
verdad es `cargar()`, llamado solo cuando el juego pide ESE estado. Las
cinco pistas nuevas siguen el mismo mecanismo que ya usaban
`combate_a`/`combate_b`/`jefe`/`jefe_final` desde el bloque base.
Confirmado con peticiones de red reales en
`herramientas/pruebas/expansion-5i.mjs` (secciones 1, 2 y 9).

**D · Fondos.** Solo MEGACIUDAD es nuevo (`art/fondos/megaciudad.png`,
941×1672, mismo formato que el resto). Bajo demanda con el mismo
`asegurarFondo()` de siempre.

**E · Skins de material.** Las cinco (`art/naves/skins/chassis_01/*.png`)
son el mismo modelo de nave que `chassis_01_interceptor.png`, repintado
de verdad por el pack — no un tinte. `SHIPS.sprite()` ahora acepta un
tercer parámetro opcional (`arteMaterial`): si hay PNG de material para
la skin+chasis equipados, se devuelve tal cual, sin pasar por el
compositor de tinte. Solo chassis_01 tiene arte; en cualquier otro
chasis `SHIPS.materialArchivo()` devuelve `null` y la skin sigue
bloqueada en el Hangar con un motivo explícito ("sin arte de material en
este chasis"), distinto del motivo de "aún no la has ganado". No se
inventó arte para chassis_02–05.

**F · Emblemas.** Cinco nuevos en `SHIPS.EMBLEMAS`
(`art/emblemas/expansion/*.png`), con `requiere` (M12/14/16/18/20) —
primera vez que un emblema tiene requisito; los diez de siempre siguen
libres. Se ganan al cerrar la misión del jefe correspondiente
(`SHIPS.otorgarEmblemasPorProgreso()`, mismo patrón que
`otorgarSkinsPorProgreso()` de 5H), sin economía nueva ni gasto de ELOI,
y avisan con `UI.desbloqueo()`. A diferencia de los diez de siempre —que
se cargan todos al arrancar— estos cinco se cargan bajo demanda
(`asegurarEmblema()`), porque nadie los tiene en M1-M10.

**G, H, I · Pruebas.** `herramientas/pruebas/expansion-5i.mjs` (nuevo,
31 comprobaciones): arranque en frío sin descargas de la expansión, M11
sola sin arrastrar las otras cuatro pistas, los cuatro jefes con
`jefe2`, AXIOMA con `final2` y NO con `jefe_final`, fondo de megaciudad
bajo demanda, skin de material real en chassis_01 y bloqueada en
chassis_03, emblemas bloqueados/desbloqueados con su PNG bajo demanda,
máximo de tres `<audio>` vivos en todo el recorrido (menú → combate de
expansión → jefe → Hangar), y regresión de que M1 sigue sonando con
`combate_a`. Además, regresión completa de `musica.mjs`, `naves.mjs`,
`hangar.mjs`, `hangar-fileurl.mjs`, `guardado.mjs`, `admin.mjs`,
`expansion-compat.mjs` y `maquetacion.mjs`, todas en verde.

**Lo que queda pendiente, honestamente:** el pack trae también arte de
enemigos/hazards/minijefes/bosses que no se usó (razón en el inventario
de arriba) — si algún día se quiere unificar el estilo de TODO el
plantel de jefes, ese es un encargo aparte, con su propio criterio
artístico, no una continuación de 5I. Los colores personalizados del
jugador (pestaña "color" del Hangar) no tienen efecto visual mientras
una skin de material está equipada — es la consecuencia esperada de
"una skin de material sustituye la paleta, no la hereda", no un fallo.
