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
| Motor de audio (4 buses, 58 sonidos, prioridades) | **Sólido** |
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
| Música | **Pendiente a propósito** |

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
| `index.html` en ~6 700 líneas | Medio · mantenimiento | Partir en `<script src>` clásicos. **Nunca** módulos ES |
| Colisiones O(balas × enemigos) | Medio | Con 631 enemigos y 49 balas aguanta. Rejilla espacial solo si se mide caída |
| Sin música | Bajo | Arquitectura puesta; documentado en THIRD_PARTY_AUDIO_LICENSES.md |
| `localStorage` para naves cargadas | Bajo | 4 naves × 320 px ≈ 400 KB de un tope de ~5 MB |
| Dificultad de la segunda mitad sin jugador real | Medio | Calibrada con piloto automático; falta que la juegue una persona |

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
