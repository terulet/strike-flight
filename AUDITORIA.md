# Flight Strike — Auditoría

Estado tras la **fase Campaign Finale**: campaña completa de diez
misiones con diez jefes propios. Sustituye a la auditoría del pase
premium, que describía un juego de cinco misiones con dos jefes.

---

## 1. Qué existe hoy

Un solo `index.html` de ~6 700 líneas. Sin dependencias, sin
compilación, sin conexión. Playwright solo para preparar imágenes y para
las pruebas.

| Sistema | Estado |
|---|---|
| Campo de juego vertical con marco | **Sólido** |
| Motor de audio (4 buses, 7 grupos, 71 sonidos por muestra + repuesto sintetizado) | **Sólido** |
| Reservas de objetos (partículas, balas, efectos) | **Sólido** · sin fugas medidas |
| Calidad adaptativa en 3 niveles, con recuperación | **Sólido** |
| Sacudida de cámara en 5 intensidades + congelado | **Sólido** |
| 11 familias de arma con presentación separada de lógica | **Sólido** |
| 14 tipos de enemigo con identidad real | **Sólido** |
| 7 patrones de bala + 4 telegráficos | **Sólido** |
| Máquina de estados de jefe reutilizable + 7 enganches | **Sólido** |
| 10 jefes propios, ninguno reciclado | **Sólido** |
| 4 mecánicas ambientales (rocas, pozos, carriles, sistemas) | **Sólido** |
| 16 mejoras con arte real, sin marcadores de posición | **Sólido** |
| HUD, menú por pantallas, ajustes, resultados | **Sólido** |
| 10 misiones con identidad mecánica y armas propias | **Sólido** |
| Cierre de campaña (`campaignCompleted` + pantalla) | **Sólido** |
| Supervivencia (4 mundos) | Conservado íntegro |
| Persistencia con versión de guardado | **Sólido** |
| Pipeline de sprites (recorte, inundación, escalado) | **Sólido** |
| 5 chasis con arte propio, ficha heredada sin tocar y alias de los ids viejos | **Sólido** |
| Hangar: catálogo, desbloqueo por misión con concesión retroactiva y personalización | **Sólido** |
| Skins por tinte compuesto en código (5) · por material | 5 sólidas · 5 **declaradas y bloqueadas** a falta de arte |
| Estelas (7) y emblemas (10) | **Sólido** |
| Ficha de juego de SV-12 SOVEREIGN | **Provisional y declarada** · valores neutros, sin calibrar |
| Modo ADMIN / FAMILY: capa de permisos, 4 perfiles, saves separados por clave | **Sólido** · aislamiento verificado byte a byte |
| FOUNDER FLEET (4 naves privadas, `adminOnly`) | **Sólido** · fuera del juego normal desde un solo sitio |
| Música | **Pendiente a propósito** |

### Escala por tamaño de pantalla

El juego estaba calibrado en píxeles fijos a 414×896 (el móvil). En un iPad,
esos mismos píxeles ocupan una fracción menor de la pantalla: la nave se veía
diminuta y esquivar era más fácil de lo diseñado — medido, no a ojo: en una
partida ciega simulada (el dedo barriendo la pantalla en seno, sin reaccionar
a nada) el iPad perdía una partida entera en 45 s con daño 0 en el móvil.

`ESC` (l. 127-152) multiplica tamaños y velocidades de lo que se juega —nave,
enemigos, balas, premios— por el **menor** de los dos ratios, ancho y alto,
no solo el ancho. Hace falta el de los dos: el iPad es más "cuadrado" que el
móvil, así que escalar solo por ancho aceleraba la caída de los enemigos más
de lo que crecía la pantalla, y el tiempo de reacción bajaba en vez de
mantenerse igual. Con el menor de los dos ratios, ese mismo test ciego pasa a
dar **0 golpes en las dos pantallas**, y el nivel alcanzado en 45 s es
comparable (5 en móvil, 5 en iPad, frente al 2 de antes de la corrección).

No toca `CONFIG.velocidadNave` (es un tiempo de respuesta al dedo, no una
distancia) ni la capa de sensación —partículas, sacudida, fogonazo—, que
sigue calibrada tal cual estaba.

**Hallazgo aparte, no causado por esto:** con el lienzo del iPad (más
píxeles reales que el móvil a la misma densidad), el juego rinde a la mitad
de fps que el original — 21-23 fps frente a los ~45 del móvil, medido
headless y sin GPU. Forzando `ESC=1` en ese mismo lienzo el fps no cambia
(22 → 23), así que **no es el escalado**: es el coste fijo de la capa visual
—viñeta de pantalla completa y degradados por enemigo— sobre más píxeles.
Con GPU real (cualquier iPad físico) los degradados son mucho más baratos que
en Chromium headless sin aceleración, así que no está claro que esto se note
fuera de este entorno de pruebas. Sin optimizar sin medir en el dispositivo
real primero.

---

## 2. Decisiones estructurales

**El campo de juego no es la ventana.** `W`/`H` son el campo; `VW`/`VH`
la ventana. El desfase lateral vive en la transformación base del
contexto, así que ninguna línea de juego sabe que existe un marco.
`pos()` es el único sitio que descuenta `PX`.

**La presentación está separada de la lógica.** En `ARMAS`, `tiros(n)`
dice dónde y hacia dónde sale cada proyectil; el PNG, el color, el
sonido y el impacto son otros campos. Igual en `ENEMIGOS` con `mover` /
`atacar` / `telegrafo` / `dibujarExtra`.

**La puesta en escena del jefe es del motor, no del jefe.** Los diez
pasan por aviso → entrada → fases → transición → muerte cinemática →
victoria. Un jefe nuevo es su tabla de fases y ataques; si necesita algo
propio, hay siete enganches opcionales y el motor solo los llama si
existen. El motor no sabe qué es un asteroide ni un pozo gravitatorio.

**La limpieza ambiental es genérica.** `matarMiniboss()` vacía pozos,
carriles y sistemas por su cuenta: ningún jefe futuro tiene que
acordarse. Lo suyo propio va por `onMuerte`.

**Ningún patrón produce daño inevitable.** Todo lo que dispara lleva
`avisa` + `telegrafo(e)`. El tope de 340 proyectiles enemigos no es una
optimización: por encima de eso la pantalla deja de tener huecos.

**La gravedad no quita el control.** En M7 y en la fase 3 del jefe
final, la fuerza se **suma** al objetivo del dedo y el colapso tiene
techo. Por fuerte que tire, el jugador sigue pilotando.

---

## 3. Verificado en navegador

Chromium real, servidor HTTP, iPad 820×1180 a DPR 2 y iPhone 393×852 a
DPR 3.

- **Las diez misiones** arrancan, avanzan por sus fases y llegan a su
  jefe sin errores.
- **Los diez jefes** ciclados por todas sus fases, muertos, y con la
  limpieza comprobada al instante: `eBullets=0 · rocas=0 · zonas=0 ·
  pozos=0 · carriles=0 · sistemas=0 · telegrafos=0 · miniboss=null`.
- **Cierre de campaña** de punta a punta: matar a Omega Sovereign deja
  `campaignCompleted:true` en el save, construye `campaignStats` y
  lleva a la pantalla CAMPAÑA COMPLETADA.
- **Tormenta de 30 s** con 9 tipos a 27 spawns/segundo — 27 veces lo
  que genera la campaña. Pico de 631 enemigos, 340 proyectiles, 420
  partículas. Sin errores.
- **Sin fugas.** Al vaciar el campo: 419 partículas en la reserva, 1
  viva.
- **Cero 404 y cero excepciones** en las nueve pruebas.

### Duraciones medidas

Combate de jefe, con un piloto que **apunta** (el de tránsito busca el
hueco más despejado, que durante un jefe significa lejos de él — mide
bien la misión y fatal el combate):

| | Vida | Combate | Objetivo |
|---|---|---|---|
| M1 Guardián | 560 | 69 s | — |
| M2 Rift Reaper | 210 | 47 s | 35-55 s |
| M3 Aegis Prime | 380 | 48 s | 40-60 s |
| M4 Venom Core | 460 | 60 s | 45-70 s |
| M5 Titán | 1150 | 113 s | — |
| M6 Warlord Vesper | 430 | 71 s | 50-75 s |
| M7 Singularity Warden | 860 | 58 s | 55-80 s |
| M8 Pyre Lord | 780 | 72 s | 55-80 s |
| M9 Core Architect | 1150 | 66 s | 60-85 s |
| M10 Omega Sovereign | 1400 | 135 s | — |

Misión completa: **M1** 4:39 · **M2-M4** ~5:00 · **M5** 6:09 · **M6**
6:22 · **M7** 5:17 · **M8** 5:29 · **M9** 5:27 · **M10** 7:59. M6
comprobada además jugándola entera en tiempo real.

### Lo que NO está verificado

**Los 60 fps en un iPad.** Chromium sin ventana compone el canvas por
software, sin GPU: da ~20 fps pase lo que pase, incluso en el menú
quieto. Los topes, las reservas y la calidad adaptativa están puestos,
pero **la medida real hay que hacerla en el iPad**.

---

## 4. Bugs encontrados y corregidos

Del pase premium:

1. **Una excepción congelaba el juego para siempre** — rompía la cadena
   de `requestAnimationFrame`. Ahora se registra una vez y se sigue.
2. **`golpe()` vaciaba arrays en mitad de su propio bucle.**
3. **`source-atop` pintaba un cuadrado gris** alrededor de enemigos y
   jefes al recibir impactos.
4. **Los sprites giraban solos.**
5. **Costura del fondo** al repetirlo.
6. **Sacudida mal escalada** para duraciones distintas de 0,4 s.

De esta fase:

7. **`pantallaCampana()` dividía por 5 a fuego** para calcular la altura
   de cada tarjeta. Habría reventado en cuanto existiera una sexta
   misión; ahora divide por `MISIONES.length`.
8. **Los sistemas ALPHA/BETA/GAMMA sin destruir se quedaban flotando**
   peleándose con el nombre del jefe por el mismo sitio. Ahora
   `spawnMiniboss()` los da por caídos: el jefe manda.
9. **`herramientas/pruebas/jefes.mjs` llevaba roto** desde que M5 se
   alargó: suponía el Titán en t≈100 cuando entra en t=256. No era un
   bug del juego, era el guion de prueba desactualizado.

---

## 5. Riesgos vivos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| FPS reales en iPad sin medir | Alto si falla | Topes, reservas y calidad adaptativa puestos. Falta la medida |
| Compensación de tamaño/velocidad por pantalla física, sin re-verificar tras el paso a `PROPORCION_MAX` | Medio | Una rama vieja (fusionada aquí el 2026-08-21) medía que en iPad la nave ocupaba menos pantalla y esquivar era más fácil de lo diseñado, y lo arreglaba escalando naves/enemigos/balas con `ESC`. Esa rama es anterior al reparto en `js/enemigos.js` etc. y a `PROPORCION_MAX`, así que su código se descartó por obsoleto — pero `PROPORCION_MAX` solo acota el ANCHO, no repite la compensación por ALTO que `ESC` hacía. Falta repetir esa medida ciega en la versión actual antes de dar el tema por cerrado |
| `index.html` en ~6 700 líneas | Medio · mantenimiento | Partir en `<script src>` clásicos. **Nunca** módulos ES |
| Colisiones O(balas × enemigos) | Medio | Con 631 enemigos y 49 balas aguanta. Rejilla espacial solo si se mide caída |
| Sin música | Bajo | Arquitectura puesta; documentado en THIRD_PARTY_AUDIO_LICENSES.md |
| `localStorage` para naves cargadas | Bajo | 4 naves × 320 px ≈ 400 KB de un tope de ~5 MB |
| Dificultad de la segunda mitad sin jugador real | Medio | Calibrada con piloto automático; falta que la juegue una persona |
| SV-12 SOVEREIGN sin balancear | Medio | Ficha neutra, marcada `fichaProvisional` y avisada en el Hangar. Se calibra con `duracion-*.mjs` |
| 5 skins de material sin arte | Bajo | Salen bloqueadas y dicen por qué, en vez de fingirse con un cambio de matiz |
| El fondo del Hangar es apaisado y el juego vertical | Bajo | Se coloca como banda con degradados; `hangar_v.png` entra por la misma ruta y lo sustituye solo |
| El PIN de admin viaja en el código | Bajo · es lo pedido | Barrera casual, no seguridad. Quien abra el inspector entra. Lo que sirve para lo comercial es `ADMIN.excluido()`, que no depende del PIN |
| Un save de admin corrupto | Bajo | Mismo esquema y misma validación que el normal, y su copia de seguridad va aparte (`sf_admin_<perfil>_prev`) |
| Inversión visual/hitbox entre AEGIS y PHANTOM | Bajo · estético | El AEGIS se dibuja ancho con radio pequeño y el PHANTOM al revés. **A propósito**: tocar la hitbox cambiaría el juego |

---

## 6. Siguiente

**A · Medir en el iPad.** Sigue siendo lo único que puede invalidar
decisiones ya tomadas. Es lo primero.

**B · Que lo juegue una persona.** Los diez jefes están calibrados con
un piloto automático que apunta perfecto y esquiva regular. Eso da un
número fiable de *duración*, no de *sensación*. La curva M6→M10 hay que
sentirla.

**C · Partir el archivo.** ~6 700 líneas en uno solo empieza a pesar.
`<script src>` clásicos en orden, nunca módulos ES (con `file://` el
navegador los bloquea por CORS y el juego se queda en negro).

**D · Música**, si aparece con licencia comercial verificable.

**E · New Game+**, si la campaña aguanta una segunda vuelta. No antes.
