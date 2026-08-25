# FLIGHT STRIKE — Auditoría del Bloque 4

Hangar, chasis y personalización. **Solo auditoría: no se ha tocado nada.**
Medido sobre el código y los assets reales a 2026-08-17.

---

## 1. Tabla de naves actuales

**Cinco naves, y NO son cosméticas.** Cada una cambia velocidad, cadencia,
daño, zona de impacto, arma de salida y escudo inicial. Verificado en
`index.html:1774-1803`.

| | `clasica` | `kali` | `yoli` | `silvia` | `eloi` |
|---|---|---|---|---|---|
| Nombre visible | CLÁSICA | KALI | YOLI | SILVIA | ELOI |
| Asset | — (vectorial) | `kali.png` | `yoli.png` | `silvia.png` | `eloi.png` |
| Ruta | — | `art/naves/` | `art/naves/` | `art/naves/` | `art/naves/` |
| PNG | — | 292×320 · 153 kB | 296×320 · 117 kB | 238×320 · 95 kB | 309×320 · 188 kB |
| Caja alfa real | — | 292×319 | 296×320 | 238×318 | 308×320 |
| Margen sobrante | — | 0–1 px | 0 px | 0–1 px | 0–1 px |
| Proporción | — | 0,92 | 0,93 | **0,75** | **0,96** |
| **Dibujada** | vector | 76,8 × 83,9 | 76,8 × 83,0 | **76,8 × 102,6** | 76,8 × 79,8 |
| **Radio de hitbox** | 10,56 | 11,62 | 8,24 | 8,87 | **13,20** |
| Arma de salida | cannon | cannon | rapid | electrico | fuego |
| Velocidad | ×1 | ×0,86 | ×1,32 | ×1,08 | ×1,10 |
| Cadencia | ×1 | ×1,14 | ×0,88 | ×0,96 | ×0,82 |
| Daño | ×1 | ×1,38 | ×0,82 | ×1 | ×1,20 |
| Escudo inicial | 0 | 0 | 0 | **1** | 0 |
| Vidas | 3 (`CONFIG.vidas`, igual para todas) | | | | |
| Bombas | 1 para todas | | | | |

**Geometría común, medida:**

- **Anchura dibujada: 76,8 px para TODAS** (`r · CONFIG.tamanoNave` = 16 × 4,8).
  Lo que cambia es el ALTO, que sale de la proporción del PNG.
- **Punto de disparo**: `(player.x + dx, player.y − 17,6)`. Idéntico en las
  cinco; el `dx` lo pone el arma, no la nave (`disparar()`).
- **Toberas**: `±0,155 · ancho` = **±11,9 px**, a `0,34 · alto` del centro
  (28,5 · 28,2 · 34,9 · 27,1 px). Se derivan de la CAJA del sprite, no del
  dibujo: por eso encajan sin configurarlas.
- **Hitbox**: `hitR() = player.r · 0,66 · nave.hitbox` = `10,56 · hitbox`.
  **No depende del sprite en absoluto.**

**Campos declarados y sin usar hoy**: `bombas` (ninguna nave lo define, todas
arrancan con 1) y `stats{ATAQUE,VELOCIDAD,CONTROL}` (solo se pintan como
barritas en la pantalla de naves; no afectan a nada).

**Disponibilidad**: **las cinco están abiertas desde el primer arranque.**
No existe ninguna lógica de desbloqueo de naves en el código.

**Dónde se selecciona**: `pantallaNaves()` (`index.html:6786`), rejilla de
casillas; al tocar, `naveSel = i; guardarNave()`.

**Dónde se guarda**: `SAVE.set("naves.seleccionada", NAVES[naveSel].id)`. Se
guarda el **id**, no el índice, y a propósito: las naves que carga el jugador
se añaden al final del array y mueven los índices de todo lo demás.

**Dependencias de código de la nave activa** (todas leen `naveActual()`):

| Dónde | Qué usa |
|---|---|
| `hitR()` | `hitbox` — llamado una vez **por bala enemiga y fotograma** |
| `reset()` | `arma`, `escudo`, `bombas` |
| `update()` | `vel` (interpolación al dedo), `cad` (cadencia) |
| `nuevaBala()` | `dmg` |
| `dibujarNave()` | sprite por `id`, `motor` (color de llama) |
| `nvColor()` | `motor` |
| `pantallaNaves`, `naveEscaparate` | `nombre`, `lema`, `desc`, `stats`, `arma` |

`naveActual()` está **cacheado por índice** (`nvCache`/`nvIdx`) porque
`hitR()` lo llama cientos de veces por fotograma. Cualquier cosa nueva que
dependa de la configuración tendrá que invalidar esa caché.

**Naves cargadas por el jugador**: hasta 4, en `localStorage` bajo la clave
**`sf_naves`** (dataURL en base64), **fuera del save v2**. Se añaden a `NAVES`
con id `custom0..custom3` y heredan `NAVE_BASE` (todo ×1). Es un sistema
paralelo que el Hangar tendrá que respetar o retirar conscientemente.

---

## 2. Usos de KALI / YOLI / SILVIA / ELOI

**89 apariciones en total**, pero el reparto real es mucho mejor de lo que ese
número sugiere:

| Archivo | Nº | Clasificación |
|---|---|---|
| `index.html` | 13 | **6 reales** (5 filas de `NAVES` + 1 comentario). Las otras **7 son la MONEDA `eloi`**, sin relación |
| `js/save.js` | 3 | **1 real**: `"naves.seleccionada"` con defecto `"kali"` (E). Las otras 2 son la moneda |
| `herramientas/pruebas/guardado.mjs` | 27 | 13 ids de nave entrecomillados (G) + 10 de la moneda + 4 texto |
| `herramientas/pruebas/ui.mjs` | 5 | G — fixtures |
| `README.md`, `LEEME.txt`, `art/naves/LEEME.txt`, `AUDITORIA-FASE2.md` | 41 | I — documentación |

**Por categoría:**

- **A · solo nombre visible** — `nombre:"KALI"` etc. (4 sitios). Cambiar esto
  no rompe nada.
- **B · ID interno** — `id:"kali"` etc. (4 sitios). Es la clave de `SPRITES`,
  del save y de la búsqueda `NAVES.findIndex(n => n.id === naveId)`.
- **C · lógica de gameplay** — **NINGUNA**. No hay ni un `if (id === "kali")`
  en todo el código. Los ids no se usan para decidir comportamiento.
- **D · asset** — `buscar("naves","kali.png")` (4 sitios) + los nombres de
  archivo en `art/naves/`.
- **E · save** — el valor guardado en `naves.seleccionada` y el defecto
  `"kali"` en el esquema.
- **F · UI** — solo a través de `nombre`; no hay ningún id escrito en la UI.
- **G · tests** — 13 ids entrecomillados en fixtures de `guardado.mjs` y
  `ui.mjs`.
- **H · debug** — el overlay imprime `nave:` con el id que venga; no lo compara.
- **I · documentación** — 41 menciones.

### Qué se rompería mañana si renombramos

**Poco, y está acotado.** El punto delicado no son los cuatro nombres:

> ⚠️ **`eloi` es a la vez un id de nave Y el nombre de la moneda**
> (`perfil.eloi`, `resultado.eloi`, «+950 ELOI»). Un buscar-y-reemplazar sobre
> «eloi» rompería la economía del juego. **Cualquier renombrado tiene que ser
> selectivo, no textual.**

Lo que hay que tocar de verdad: 4 filas de la tabla `NAVES`, 1 defecto en
`save.js`, los 4 nombres de archivo (o dejarlos y añadir alias), 18 fixtures
de pruebas, y la documentación. **Ni una línea de lógica de juego.**

---

## 3. Sistema de selección actual

```
pantallaNaves()  →  naveSel = i  +  guardarNave()
                                       ↓
                          SAVE "naves.seleccionada" = NAVES[naveSel].id
                                       ↓
                    naveActual()  (cacheado por índice)
                                       ↓
       hitR() · reset() · update() · nuevaBala() · dibujarNave() · nvColor()
```

- **Estructura de datos**: array `NAVES` (orden = índice). `naveSel` es un
  entero, `nvCache`/`nvIdx` la caché.
- **Variable activa en partida**: `naveSel`. No se copia a `player`: todo se
  consulta en vivo a través de `naveActual()`.
- **Al iniciar misión**: `reset()` aplica `arma`, `escudo` y `bombas` de la
  nave. La nave **no se puede cambiar durante la misión**.
- **Al reintentar**: `iniciarMision()` → `reset()` → se vuelve a aplicar la
  misma nave. Correcto.
- **Al recargar la página**: se lee `naves.seleccionada` (un id) y se busca el
  índice; si no aparece, **`naveSel = 1` (KALI)**.
- **Con save antiguo**: la migración v1→v2 copió `naveId` a
  `naves.seleccionada`. Un id desconocido cae a KALI sin romper nada.

**Respuesta directa a la pregunta:** la nave seleccionada **NO cambia solo el
sprite**. Cambia velocidad, cadencia, daño, radio de hitbox, arma inicial y
escudo inicial. Es gameplay.

---

## 4. Estado real del save de naves

```js
"naves.seleccionada":  { tipo: "texto", def: "kali", max: 24 }   // ✅ EN USO
"naves.desbloqueadas": { tipo: "lista", def: [] }                // ⬜ NUNCA LEÍDA NI ESCRITA
"naves.skins":         { tipo: "objeto", def: {} }               // ⬜ NUNCA LEÍDA NI ESCRITA
"naves.colores":       { tipo: "objeto", def: {} }               // ⬜ NUNCA LEÍDA NI ESCRITA
```

Verificado por búsqueda en todo el repo: **fuera de `save.js` no las menciona
nadie.** Se dejaron preparadas en el Bloque 2 y siguen vacías.

### Extensión propuesta

```js
naves: {
  seleccionada: "chassis_01",
  desbloqueadas: ["chassis_01", "chassis_02"],
  config: {
    "chassis_01": {
      customName: "NIGHT REAPER",
      skinId: "inferno",
      colors: { primary: "#1a1a1a", secondary: "#ff3b1a", accent: "#ff8a1f" },
      trailId: "plasma_violeta",
      emblemId: "skull",
    },
  },
}
```

`skins` y `colores` (planos) se sustituyen por `config` (por nave), que es lo
correcto: cada chasis tiene SU nombre, SU skin y SUS colores.

### Migración: **no hace falta subir de versión**

Ésta es la conclusión importante. `normalizar()` reconstruye el objeto campo a
campo desde `ESQUEMA`, y **lo que no está en el esquema se pierde; lo que está
y falta en el save entra con su valor por defecto**. Añadir
`"naves.config": { tipo:"objeto", def:{} }` hace que todos los saves v2
existentes lo tengan vacío al instante, sin escribir ni una migración.

Los dos campos que se retiran (`skins`, `colores`) están vacíos en el 100 % de
los saves reales, porque nunca se escribieron. **Cero pérdida.**

| | |
|---|---|
| Versión propuesta | **seguir en v2** |
| Compatibilidad hacia atrás | total: v0→v1→v2 sigue funcionando igual |
| Riesgo de pérdida de progreso | **ninguno** en campaña, récords, ELOI ni ajustes |
| Mapeo de ids antiguos | tabla de alias leída al cargar (ver § 5) |

**Mapeo de ids**: NO reescribir el save en la migración. Un **alias de
lectura** es más seguro y reversible:

```js
const LEGACY = { kali:"chassis_02", yoli:"chassis_01",
                 silvia:"chassis_03", eloi:"chassis_04", clasica:"chassis_01" };
```

Se resuelve al cargar; en el siguiente guardado se escribe ya el id nuevo. Si
hubiera que dar marcha atrás, los saves viejos siguen intactos.

*(La correspondencia de arriba es una propuesta por AFINIDAD DE ROL, no
definitiva: YOLI es la interceptora, KALI la de asalto, SILVIA la vanguardia
con escudo, ELOI la pesada. Hay que decidirla mirando los cinco chasis nuevos.)*

---

## 5. Propuesta de IDs

**Recomendación: `chassis_01` … `chassis_05`.**

Comparadas las dos opciones que planteas:

| | `vx9`, `ax4`, `cr7`… | `chassis_01`… |
|---|---|---|
| ¿Sobrevive a renombrar el modelo? | **No.** `vx9` ES «VX-9». Si el modelo pasa a llamarse XF-11, el id miente para siempre | Sí |
| ¿Sobrevive a cambiar de clase? | No: `cr7`→AEGIS ata el id a un rol | Sí |
| Legible en un save | Sí | Sí |
| Ordenable / iterable | No | Sí |
| Riesgo de colisión | Medio (dos modelos con el mismo prefijo) | Nulo |

Un id no debe poder quedarse desfasado, y **un id que contiene el nombre
comercial se desfasa en cuanto marketing cambia de opinión**. Ya tenemos la
lección en casa: los ids actuales son nombres de personas, y por eso este
bloque existe.

**Estructura de tres capas, desacoplada:**

```js
{
  id: "chassis_01",              // técnico. NUNCA cambia. Va al save.
  legacy: "yoli",                // alias de lectura para saves viejos
  modelo: "VX-9 INTERCEPTOR",    // visible, puede cambiar sin consecuencias
  clase: "INTERCEPTOR",          // para agrupar y filtrar en el Hangar
  // customName vive en el SAVE, no aquí: es del jugador, no del chasis
}
```

---

## 6. Naming de los 5 chasis — 3 propuestas cada uno

Sin fijar nada. Marcadas con ★ mis preferidas.

**01 · INTERCEPTOR** — fino, rápido, agresivo
- ★ **VX-9 TALON** — corto, se dice fácil, «garra» encaja con fino y agresivo
- XF-11 RAZOR
- IV-3 SPARROWHAWK

**02 · STRIKER** — caza de ataque, ancho, armado
- ★ **AX-4 WARHAWK** — «hawk» ata con TALON sin repetirlo; suena a armamento
- ST-12 HAVOC
- BR-7 IRONCLAW

**03 · AEGIS** — pesado, blindado
- ★ **CR-7 BULWARK** — «baluarte»; AEGIS es tan usado que ya no dice nada
- HV-14 BASTION
- MG-6 RAMPART

**04 · PHANTOM** — oscuro, furtivo, amenazante
- ★ **NX-11 WRAITH** — más frío y menos gastado que PHANTOM
- SX-13 NOCTURNE
- VN-8 REVENANT

**05 · NOVA** — avanzado, espectacular, end-game
- ★ **SV-12 SOVEREIGN** — ata con OMEGA SOVEREIGN: la última nave y el último
  jefe comparten linaje. Es gratis y cuenta algo
- XN-21 ASCENDANT
- ZR-∞ APEX

**Nota de coherencia**: el prefijo alfanumérico (dos letras + guion + número)
es lo que hace que los cinco parezcan de la misma flota. Merece la pena
respetarlo aunque cambien las palabras.

---

## 7. Compatibilidad de los 5 assets nuevos

**Formato actual**: PNG RGBA, 238–309 × 320 px, 95–188 kB. Sin WebP en el
proyecto (aunque `qa.mjs` ya sirve el MIME).

### Cómo se procesa hoy un sprite de nave

`cargarSprite()` → `prepararSprite()`, que hace tres cosas:
1. Reduce si el lado mayor pasa de **`MAX_SPRITE` = 512**.
2. `quitarFondo()`: relleno por inundación desde los bordes.
3. **Recorta a la caja alfa.**

### Los cinco requisitos que deben cumplir los assets nuevos

1. **Esquinas transparentes.** `quitarFondo()` sale por la primera línea si las
   cuatro esquinas tienen alfa ≤ 200. Con un PNG transparente **no toca nada**.
   Sin esa condición, un chasis oscuro sobre fondo oscuro (PHANTOM) podría
   perder parte del casco. Con transparencia real, riesgo cero.
2. **Recortados al píxel.** ⚠️ **El más importante.** Con `file://` el navegador
   prohíbe `getImageData`, `quitarFondo()` devuelve `null` y **el recorte NO se
   ejecuta**. Un PNG con margen se dibujaría más pequeño y descentrado *solo* al
   abrir con doble clic. Los cuatro actuales tienen 0–1 px de margen justo por
   esto. **Los nuevos tienen que venir igual de ajustados.**
3. **Lado mayor ≤ 512 px**, para saltarse el remuestreo de carga. Los actuales
   están en 320.
4. **Centrados** en su caja: los actuales están al 49,8–50,0 %.
5. **Morro arriba**, sin rotación.

### El problema de escala que sí hay que resolver

**Todas las naves se dibujan a la MISMA ANCHURA: 76,8 px.** Solo cambia el
alto, según la proporción del PNG.

Consecuencia directa para los chasis nuevos: **un STRIKER «más ancho» no se
verá más ancho.** Se verá igual de ancho y **más bajo**, porque su proporción
mayor reduce el alto calculado. El resultado sería lo contrario de lo buscado.

**Solución propuesta (para 4x, no ahora)**: pasar de «anchura fija» a **área
visual constante**, con un factor por chasis:

```js
// en vez de: ws = r * CONFIG.tamanoNave
// escala por chasis, calibrada a ojo una vez y guardada en la tabla
ws = r * CONFIG.tamanoNave * (chasis.escala || 1)
```

Es un cambio de una línea, solo de render, y no toca hitbox ni gameplay.

### Hitbox: el riesgo ya existe hoy

| Nave | Alto dibujado | Radio de hitbox | Relación |
|---|---|---|---|
| SILVIA | **102,6 px** | **8,87** | parece enorme, es de las más pequeñas |
| ELOI | 79,8 px | **13,20** | parece la más pequeña, es la mayor |

**Está invertido hoy mismo**, antes de tocar nada. Un jugador que elige SILVIA
por «parece grande» acierta sin saberlo, y quien elige ELOI recibe impactos que
no entiende. Mitiga el ajuste **NÚCLEO** (que pinta la zona real y está activo
por defecto), pero la lectura sigue siendo engañosa.

**Propuesta**: en 4B **todos los chasis con `hitbox: 1`** (radio 10,56 px para
todos). Ninguna nave engaña porque todas son iguales. La calibración por chasis
—si llega— se hace después, con medida y con el núcleo visible, y se documenta.

---

## 8. Skins: qué se puede tintar y qué no

**Recomendación: D · sistema mixto**, y con una separación honesta.

### Lo que Canvas SÍ puede hacer bien

Tintado **cacheado**, no por fotograma: al elegir la skin se compone **una vez**
en un canvas fuera de pantalla y luego se dibuja como cualquier sprite. Coste en
partida: **cero**. Coste al cambiar de skin: un par de milisegundos.

Técnica: `multiply` para oscurecer y teñir la chapa, `lighter` para el brillo
del reactor, y `destination-in` con el propio sprite para respetar la silueta.

> ⚠️ Lo que **no** hay que usar es `source-atop` con un rectángulo: el destino
> es el lienzo entero, que es opaco, y sale un cuadrado. Ya nos pasó en 3C y
> está documentado.

Con **máscara de zonas** (un PNG en escala de grises por chasis: R = chapa,
G = paneles, B = reactor) se puede recolorear **por regiones**: carrocería en
negro, paneles en rojo, reactor en naranja. Eso cubre `primary/secondary/accent`
de verdad, no un tinte global.

### Lo que NO se puede hacer por código

Y aquí soy franco: **la mitad de vuestras diez skins no son un cambio de color.**

| Skin | ¿Tinte + máscara? | Por qué |
|---|---|---|
| DEFAULT | ✅ | es la base |
| NEON | ✅ | color + emisivo; el glow se añade en aditivo |
| SHADOW | ✅ | oscurecer + bajar especular |
| GOLDEN | ⚠️ casi | el oro necesita un especular distinto, no solo tono |
| DESERT | ⚠️ casi | el desgaste/arena es **textura**, no color |
| ARCTIC | ❌ | hielo: cristales, transparencias, escarcha en los bordes |
| INFERNO | ❌ | brasas, grietas incandescentes, hollín |
| TOXIC | ❌ | corrosión, goteo, verde emisivo irregular |
| STORM | ❌ | rayos, arcos, patrón que se mueve |
| COSMIC | ❌ | nebulosa **dentro** del casco: es contenido, no color |

**Conclusión**: 3 skins por tinte+máscara (DEFAULT, NEON, SHADOW), 2
discutibles (GOLDEN, DESERT) y **5 necesitan asset pre-renderizado**.

### Coste de la vía pre-renderizada

5 chasis × 5 skins renderizadas = **25 PNG**. A ~150 kB → **≈3,7 MB**. Es
comparable a la música (8 MB) y aceptable **si se cargan bajo demanda**: solo
la skin equipada y las que se estén mirando en el Hangar.

| Vía | Calidad | iPad | Memoria | file:// | Mantenimiento |
|---|---|---|---|---|---|
| A · tinte runtime por fotograma | media | ❌ caro | baja | ✅ | fácil |
| B · paletas | baja | ✅ | baja | ✅ | fácil |
| C · pre-renderizado | **alta** | ✅ | media | ✅ | caro (25 assets) |
| **D · mixto (recomendado)** | **alta** | ✅ | media | ✅ | medio |

**Mixto** = colores del jugador por tinte+máscara cacheado (infinitas
combinaciones, gratis) + skins «de material» como assets. Lo mejor de las dos.

⚠️ **Aviso de `file://`**: componer el tinte requiere `getImageData`, que con
doble clic está prohibido. **Con `file://` habrá que caer a la skin base sin
tintar.** Es la misma excepción aceptada que la música; hay que decidirlo, no
descubrirlo.

---

## 9. Trails / motor

**Se puede hacer entero por código, y sale barato.**

Hoy: `VFX.motor(x, y, vx, vy, color, r, vida)`, familia con tope propio
(40/24/12), y el color sale de `nave.motor`. La llama de las toberas se dibuja
en `dibujarNave()` con tres gradientes.

**Qué habría que parametrizar** — una tabla como `VFX.ESTILOS` de los jefes:

```js
TRAILS: {
  plasma_azul:   { col: ["#7df9ff","#2b6cff"], nucleo:"#ffffff", ritmo:1.0,
                   vida:[0.14,0.30], r:[1.1,2.6], estira:0, brillo:1.0 },
  plasma_violeta:{ col: ["#c77dff","#8a3fd6"], ... },
  toxico:        { col: ["#8aff4d","#2f8a1f"], ..., estira:1 },
  solar:         { col: ["#ffcf5c","#ff6a1f"], ..., brillo:1.3 },
  ion_blanco:    { col: ["#ffffff","#9beeff"], ..., ritmo:1.4 },
  cosmico:       { col: ["#d8dcff","#8a3fd6"], ..., brillo:1.2 },
}
```

- **Coste**: cero partículas nuevas. Es la familia `motor` que ya existe,
  cambiando color, vida y ritmo.
- **`trailId` en el save**: sí, un texto en `naves.config[id].trailId`.
- **ALTO/MEDIO/BAJO**: ya lo soporta. `motor` tiene 40/24/12 y **no es
  desalojable**, así que la llama no desaparece ni con la pantalla llena. Un
  trail «denso» solo debería subir el *ritmo*, nunca el tope.
- **Los gradientes de las toberas** también aceptan el color del trail: son dos
  `createRadialGradient` que hoy leen `nv.motor`.

**Riesgo bajo.** Es la parte más agradecida del bloque: mucho efecto percibido
por muy poco código.

---

## 10. Emblemas

**Sitios seguros, en orden:**

1. **Tarjeta del Hangar** — ✅ ideal. Espacio, tamaño libre, sin coste en juego.
2. **Panel de nave / escaparate** — ✅ bien, junto al nombre personalizado.
3. **Resultados de misión** — ✅ bien, como firma junto a la puntuación.
4. **Sobre el sprite en partida** — ❌ **mala idea con los assets actuales.**

**Por qué no sobre el sprite:**

- La nave se dibuja a **76,8 px de ancho**. Un emblema legible ahí serían unos
  **12–14 px**: a esa escala no se distingue una calavera de una mancha.
- Haría falta un **punto de anclaje por chasis** (dónde va el emblema en cada
  casco) y respetar la perspectiva del dibujo. Son 5 anclajes a mano y se
  romperían con cada asset nuevo.
- Añade ruido justo en el objeto que el jugador necesita leer mejor que ningún
  otro, y va en contra de la regla del Bloque 3.
- En el HANGAR, donde la nave se ve a 300–400 px, **sí** tiene sentido.

**Propuesta**: emblema en Hangar, tarjeta y resultados. En partida, no.

---

## 11. HANGAR_MAIN_01

**Aviso primero, porque cambia el encargo:**

> ⚠️ **El juego es VERTICAL.** `PROPORCION_MAX = 0.75` (4:3 en vertical) y todo
> el campo está construido para el iPad en vertical. Un fondo **horizontal**
> tendría que recortarse a 3:4, o sea perder **más de la mitad del ancho**.

Tres salidas, de mejor a peor:

- **A** — entregar el hangar **compuesto para vertical** (o con la plataforma
  centrada y aire suficiente arriba y abajo para un recorte 3:4 que siga
  leyéndose).
- **B** — entregar **dos versiones**: `hangar_v.webp` (3:4) y `hangar_h.webp`
  (16:9), y elegir por proporción. `buscar()` ya prueba varias rutas en orden.
- **C** — usar el horizontal recortado. Se pierde el 55 % de la imagen.

**Datos técnicos:**

| | Referencia actual (`art/fondos/`) | Propuesta hangar |
|---|---|---|
| Resolución | 941 × 1672 | **1200 × 1600** (3:4) |
| Formato | PNG | **WebP q80** |
| Peso | ~2 MB cada uno | objetivo **≤ 400 kB** |
| Memoria descodificada | ~6 MB | ~7,7 MB |

- **WebP**: Safari lo soporta desde la 14. Con `buscar()` se puede intentar
  `.webp` y caer a `.png` sin tocar el motor de carga. Reduce 2 MB → ~350 kB.
- **Escalado**: el fondo de misión ya hace `cover` sobre el campo
  (`fondo()`); el hangar puede reutilizar exactamente esa lógica.
- **iPhone** (393×852, proporción 0,46): recorte fuerte. Con la plataforma
  centrada y márgenes generosos, aguanta. **Una sola imagen bien compuesta
  basta**; no veo necesidad de versión móvil aparte si se compone con aire.
- **Memoria**: solo se descodifica al entrar en el Hangar. Conviene **soltarla
  al salir** (`img.src = ""`), o serán 8 MB permanentes en un iPad.
- **La plataforma central**: lo correcto es que la imagen NO lleve la nave y que
  el Canvas dibuje encima, en una posición relativa a la plataforma
  (p. ej. 50 % / 62 % de la imagen), declarada como dato en `ships.js`.

---

## 12. Preview de nave en el Hangar

**Arquitectura propuesta, sin 3D y reutilizando casi todo.**

```
fondo del hangar (imagen, cover)
  → luz ambiente        gradiente radial sobre la plataforma
  → sombra proyectada   elipse difusa bajo la nave
  → NAVE                sprite tintado (cache de skin+colores)
  → toberas + llama     dibujarNave(), ya lo hace
  → trail               VFX.motor(), familia existente
  → emblema             encima del casco, a este tamaño SÍ se lee
  → cabeceo             seno lento sobre Y, como naveEscaparate()
  → tarjeta             UI: panel + filo + nombre + modelo + estado
```

**Lo que se reutiliza tal cual:**

| Sistema | Qué se aprovecha |
|---|---|
| `VFX.js` | `motor()` para el trail · `chispas()` para el burst al equipar · presupuesto y calidad ya resueltos · `onda()` para el pulso al cambiar de nave |
| `UI.js` | `panel`/`filo` vía index · `UI.ir()` para entrar y salir · **`UI.desbloqueo()` ya acepta tipo `nave` y `skin`** · `UI.cifra()` para el contador de ELOI · pulsación de botones |
| `save.js` | `naves.*` · `SAVE.set` con autoguardado y freno · validación por esquema · `perfil.eloi` |
| `index.html` | `naveEscaparate()` (ya hace nave flotando con llama, es el 70 % del preview) · `pintarSprite()` · `boton()` |

**El único desacople necesario:** `dibujarNave()` y `naveEscaparate()` leen
`naveActual()` y `NAVES[naveSel]` por dentro. Para previsualizar una nave que
**no** es la equipada hay que pasarles la ficha como parámetro. Es un cambio
mecánico y sin riesgo, pero hay que hacerlo antes de nada.

---

## 13. Desbloqueos

**Enganche exacto**: `cerrarMision()`, justo donde ya sube `misionMax`
(`index.html:5387`). Es **el único sitio** del código donde el progreso avanza,
y ya tiene delante `SAVE.subirMision()` y detrás la llamada a `UI.desbloqueo()`
de la misión. Ahí mismo.

```js
// (propuesta, NO implementado)
for (const ch of SHIPS.tabla) {
  if (ch.requiere == null || ch.requiere > misionMax) continue;
  if (SAVE.get("naves.desbloqueadas", []).includes(ch.id)) continue;   // no repetir
  SHIPS.desbloquear(ch.id);                    // añade al array y guarda
  UI.desbloqueo({ tipo: "nave", titulo: ch.modelo, desc: ch.clase, sprite: ch.id });
}
```

- **Evitar repetir el aviso**: la propia lista `naves.desbloqueadas` es el
  registro. Si ya está, no se avisa. No hace falta un campo aparte.
- **Save**: `naves.desbloqueadas[]`, que ya existe en el esquema y está vacía.

### Jugadores que ya terminaron esas misiones

Es el caso que hay que tratar bien: alguien con la campaña completada NO puede
encontrarse con cuatro chasis bloqueados.

**Concesión retroactiva y silenciosa** al cargar el save:

```js
// al arrancar, una vez
if (naves.desbloqueadas.length === 0) {
  // todo lo que le corresponda por su misionMax, SIN banner
  otorgarPorProgreso(misionMax);
}
```

Sin aviso, porque avisar de cuatro desbloqueos de golpe al abrir el juego es
ruido, no recompensa. Y **la primera vez que se aplica también hay que
conceder el chasis equivalente a la nave que tuviera equipada**, aunque su
misión no llegue: quitarle a alguien la nave con la que juega sería el peor
resultado posible de esta actualización.

---

## 14. ELOI

Hoy: se acumula en `perfil.eloi` (10 % del bonus de misión), se muestra al
completar, y **no se gasta en nada**. Correcto para ahora.

**Encaje futuro, sin mezclarlo con la campaña:**

| Se consigue con | Qué desbloquea |
|---|---|
| **Progreso de campaña** | **CHASIS** — son la progresión, y no deben poder comprarse |
| **ELOI** | **SKINS · TRAILS · EMBLEMAS** — cosmética pura |

Mantenerlo separado evita el peor escenario: que alguien «se salte» la campaña
comprando la nave final, o que farmee para avanzar.

Lo que haría falta cuando llegue: `perfil.eloiGastado` (para poder auditar y
para no permitir números negativos), y precios como **dato** en `ships.js`, no
repartidos por el código. Con la validación del esquema ya hecha, es barato.

**No lo tocaría hasta 4F o más tarde.** Una tienda sin catálogo suficiente se
siente vacía; primero que haya skins y trails que merezca la pena comprar.

---

## 15. Arquitectura de archivos

```
js/ships.js     datos: tabla de chasis, skins, trails, emblemas,
                alias legacy, requisitos de desbloqueo, y el
                compositor de tinte (cachea en canvas fuera de pantalla)
js/hangar.js    la pantalla: layout, tarjetas, preview, pestañas
```

Coherente con lo que ya hay (`save.js`, `music.js`, `vfx.js`, `ui.js`): cinco
`<script src>` clásicos y un sexto y séptimo más. **Sin módulos ES** (con
`file://` los bloquea CORS), sin bundler, sin dependencias.

`index.html` conserva `naveActual()` —está en el camino caliente de `hitR()`—
pero pasa a leer de `SHIPS.tabla` en vez de la constante `NAVES` local.

Compatibilidad exigida y respetada: doble clic (`file://`), servidor local,
Netlify, Safari/iPad.

---

## 16. Qué desacoplar para NO tocar gameplay

Objetivo: los cinco chasis se juegan **exactamente igual** que hoy.

| Campo | Valor en 4B | Nota |
|---|---|---|
| `vel`, `cad`, `dmg` | **×1 en los cinco** | |
| `hitbox` | **1 en los cinco** | radio 10,56 px para todos |
| `escudo` | **0 en los cinco** | |
| `arma` | **`cannon` en los cinco** | |
| `bombas` | 1 (ya es así) | |
| `motor` | **distinto por chasis** | es color: cosmético |
| `escala` | distinta por chasis | solo render |

**Lo que hay que separar en la ficha**, para que no vuelva a mezclarse:

```js
{
  id, legacy, modelo, clase,        // identidad
  sprite, escala, anclaEmblema,     // presentación
  motor, trailPorDefecto,           // cosmética
  requiere,                         // progresión
  juego: { vel:1, cad:1, dmg:1, hitbox:1, escudo:0, arma:"cannon" },  // ← GAMEPLAY, aparte
}
```

Con `juego` en su propio sub-objeto, «esta nave es cosmética» se comprueba de
un vistazo, y el día que se toque el balance se sabrá exactamente dónde.

**Consecuencia que hay que decidir**: hoy las cinco naves SÍ se diferencian en
juego. Si los cinco chasis son iguales, **el juego pierde variedad mecánica que
ya tenía**. Dos salidas: (a) aceptarlo como paso intermedio y recuperar el
balance en 4G con medición; (b) conservar las diferencias actuales mapeando
cada chasis a la ficha de la nave legacy que sustituye. **(a) es lo que has
pedido; lo dejo escrito para que sea una decisión y no un descuido.**

---

## 17. Riesgos

### CRÍTICO

1. **`eloi` es id de nave Y moneda.** Un reemplazo textual rompe la economía.
   → Renombrado selectivo, campo a campo, con las pruebas de guardado delante.
2. **Perder la nave equipada al actualizar.** Si el alias legacy falla, todo el
   mundo despierta con KALI. → Alias de lectura + concesión retroactiva +
   prueba con saves reales de las cuatro naves.

### ALTO

3. **`file://` no puede tintar.** `getImageData` está prohibido; el compositor
   de skins no funciona con doble clic. → Decidir ya: caer a skin base sin
   tintar, y documentarlo como la excepción de la música.
4. **Fondo del hangar horizontal en un juego vertical.** Se perdería más de la
   mitad de la imagen. → Resolver antes de encargar el arte final.
5. **Pérdida de variedad mecánica** al igualar los cinco chasis (§ 16).

### MEDIO

6. **La anchura de dibujo es fija (76,8 px)**: un chasis «ancho» se verá más
   BAJO, no más ancho. → Factor `escala` por chasis, solo render.
7. **Hitbox visualmente engañosa**, ya presente hoy (SILVIA parece grande y es
   pequeña; ELOI al revés). → `hitbox: 1` para todos en 4B.
8. **Memoria en iPad**: 25 skins pre-renderizadas + hangar de 8 MB
   descodificados. → Carga bajo demanda y soltar el fondo al salir.
9. **Assets sin recortar** se verían mal solo con `file://`. → Requisito de
   entrega, verificable con un script.

### BAJO

10. **18 fixtures de pruebas** con ids antiguos. → Actualizar con el renombrado.
11. **Naves cargadas por el jugador** (`sf_naves`, sistema paralelo fuera del
    save v2). → Decidir si el Hangar las integra o se retiran.
12. **41 menciones en documentación**. → Barrido al final.
13. **`stats{}` y `bombas`**, campos declarados sin uso real. → Limpiar o usar.

---

## 18. Plan propuesto 4B → 4H

Cada fase se para y se enseña, como en el Bloque 3.

| Fase | Qué | Riesgo |
|---|---|---|
| **4B** | `js/ships.js` con la tabla de 5 chasis, alias legacy, y el desacople de `dibujarNave`/`naveEscaparate` para aceptar una ficha. **Sin Hangar, sin assets nuevos.** El juego sigue idéntico | Bajo |
| **4C** | Integrar los 5 PNG de chasis + factor `escala`. Verificar recorte, centrado y `file://`. Naves legacy siguen accesibles | Medio |
| **4D** | `js/hangar.js`: pantalla, tarjetas, selección, preview vivo. Con `HANGAR_MAIN_01` | Medio |
| **4E** | Desbloqueos por campaña + concesión retroactiva + `UI.desbloqueo` | **Alto** (toca save) |
| **4F** | Trails por `trailId` y colores por tinte+máscara. Nombre personalizado | Medio |
| **4G** | Skins pre-renderizadas (las 5 «de material») y emblemas | Medio |
| **4H** | Tienda de ELOI, si el catálogo lo justifica | Bajo |

**Antes de 4B hacen falta dos decisiones tuyas:**

1. **La correspondencia legacy → chasis** (§ 4). Quién sustituye a quién.
2. **El fondo del hangar** (§ 11): vertical, dos versiones, o recorte.

Y una tercera que no es urgente pero conviene contestar pronto: **si aceptas
perder las diferencias mecánicas actuales** (§ 16) o prefieres que cada chasis
herede la ficha de la nave que sustituye.
