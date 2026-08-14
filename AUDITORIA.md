# Flight Strike — Auditoría

Estado del código tras el **pase de producción premium** (agosto 2026).
Sustituye a la auditoría anterior, que describía un juego de 1250 líneas
sin niveles, sin jefes y sin diseño.

---

## 1. Qué existe hoy

Un solo `index.html` de ~4200 líneas. Sin dependencias, sin compilación,
sin conexión. Playwright solo para preparar imágenes y para las pruebas.

| Sistema | Estado |
|---|---|
| Campo de juego vertical con marco | **Sólido** |
| Motor de audio (4 buses, 40 sonidos, prioridades) | **Sólido** |
| Reservas de objetos (partículas, balas, efectos) | **Sólido** · sin fugas medidas |
| Calidad adaptativa en 3 niveles, con recuperación | **Sólido** |
| Sacudida de cámara en 5 intensidades + congelado | **Sólido** |
| 11 familias de arma con presentación separada de lógica | **Sólido** |
| 9 tipos de enemigo con identidad real | **Sólido** |
| 7 patrones de bala + 4 telegráficos | **Sólido** |
| Máquina de estados de jefe reutilizable | **Sólido** |
| 16 mejoras con arte real y sin marcadores de posición | **Sólido** |
| HUD, menú por pantallas, ajustes, resultados | **Sólido** |
| 5 misiones con identidad mecánica y armas propias | Bien; falta variedad de jefe |
| Supervivencia (4 mundos) | Conservado íntegro |
| Persistencia con versión de guardado | **Sólido** |
| Pipeline de sprites (recorte, inundación, escalado) | **Sólido** |
| Música | **Pendiente a propósito** |

---

## 2. Decisiones estructurales

**El campo de juego no es la ventana.** `W`/`H` son el campo; `VW`/`VH`
la ventana. El desfase lateral vive en la transformación base del
contexto, así que ninguna línea de juego sabe que existe un marco.
`pos()` es el único sitio que descuenta `PX`. Proporción máxima 4:3
(`PROPORCION_MAX`), que es exactamente el iPad vertical.

**La presentación está separada de la lógica.** En `ARMAS`, `tiros(n)`
dice dónde y hacia dónde sale cada proyectil; el PNG, el color, el
sonido y el impacto son otros campos. Cambiar cómo se ve un arma no
obliga a tocar cómo dispara. Igual en `ENEMIGOS` con `mover` / `atacar`
/ `telegrafo` / `dibujarExtra`.

**La puesta en escena del jefe es del motor, no del jefe.** Todos pasan
por aviso → entrada → fases → transición → muerte cinemática →
victoria. Un jefe nuevo es su tabla de fases y ataques, nada más.

**Ningún patrón produce daño inevitable.** Todo lo que dispara lleva
`avisa` + `telegrafo(e)`. El tope de 340 proyectiles enemigos no es una
optimización: por encima de eso la pantalla deja de tener huecos.

---

## 3. Verificado en navegador

Chromium real, servidor HTTP, iPad 820×1180 a DPR 2 y iPhone 393×852 a
DPR 3.

- **Tormenta de 30 s** con 9 tipos de enemigo a 27 spawns/segundo — 27
  veces lo que genera la campaña. Pico de 631 enemigos, 340 proyectiles
  enemigos, 420 partículas. Sin errores, sin excepciones.
- **Sin fugas.** Al vaciar el campo: 419 partículas en la reserva, 1
  viva. Las balas y los efectos vuelven igual.
- **Calidad automática** baja alta → media → baja bajo carga sostenida y
  vuelve a subir cuando pasa.
- **Bomba** con 60 proyectiles en pantalla: los convierte en puntuación,
  no los borra.
- **Fin de partida** y **supervivencia** siguen funcionando.
- **Secuencia completa de jefe** capturada paso a paso: aviso, entrada,
  fase 1, transición, fase 2, fallos internos, detonación, victoria.
- **Cero 404 y cero excepciones** en las cinco pruebas.
- **Duración de los combates de jefe**, con un piloto que apunta:
  Guardián de M1 (560 HP, cañón nivel 4) **69 s** · Guardián de M4
  (812 HP, vacío nivel 5) **55 s** · Titán (1150 HP, crio nivel 6)
  **113 s**. Con eso las misiones quedan en 4:39 / 5:02 / 5:00 / 4:57 /
  6:09, y eso es con un piloto experto: un jugador normal va más lento.

### Lo que NO está verificado

**Los 60 fps en un iPad.** Chromium sin ventana compone el canvas por
software, sin GPU: da ~20 fps pase lo que pase, incluso en el menú
quieto. Eso no dice nada sobre un aparato real. Lo que hay son las
medidas que sí son fiables —conteos, reservas, fugas, errores— y los
topes que impiden que la carga crezca sin límite. **La medida real hay
que hacerla en el iPad.**

---

## 4. Bugs encontrados y corregidos en este pase

1. **Una excepción congelaba el juego para siempre.** Rompía la cadena
   de `requestAnimationFrame`. Ahora se registra una vez y se sigue.
   Encontrado con el caso real que lo provocaba: un premio de familia de
   arma sin ficha.
2. **`source-atop` pintaba un cuadrado gris** alrededor de enemigos y
   jefes al recibir impactos. El destino es el lienzo entero, que es
   opaco. Se repinta el sprite en aditivo.
3. **Los sprites giraban solos.** `e.giro` se acumulaba para todos los
   tipos, pero solo `veloz` y `kamikaze` lo usan como orientación.
4. **Costura del fondo.** Un fondo pintado no enlaza consigo mismo;
   repetirlo dejaba una línea horizontal recorriendo la pantalla.
   Resuelto volteando una de cada dos copias.
5. **El nombre del jefe pisaba la puntuación.**
6. **`shakeMag * (shakeT / 0.4)`** daba una sacudida mal escalada para
   cualquier duración distinta de 0,4 s.

---

## 5. Riesgos vivos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| FPS reales en iPad sin medir | Alto si falla | Topes, reservas y calidad adaptativa ya puestos. Falta la medida |
| M2–M4 repiten Guardián | Medio · desgaste | Escalado de vida como parche. Lo correcto son jefes propios |
| Colisiones O(balas × enemigos) | Medio | Con 631 enemigos y 49 balas aguanta. Rejilla espacial solo si se mide caída |
| Sin música | Bajo | Arquitectura puesta; documentado en THIRD_PARTY_AUDIO_LICENSES.md |
| `index.html` en 4200 líneas | Medio · mantenimiento | Partir en `<script src>` clásicos si sigue creciendo. Nunca módulos ES |
| `localStorage` para naves cargadas | Bajo | 4 naves × 320 px ≈ 400 KB de un tope de ~5 MB |

---

## 6. Siguiente

En este orden.

**A · Medir en el iPad.** Es lo único que puede invalidar decisiones ya
tomadas. Si no da 60 fps, el sitio por donde recortar ya está preparado
(`CALIDADES`), pero hay que saberlo antes de construir cinco misiones
más encima.

**B · Jefes propios para M2, M3 y M4.** El Guardián cuatro veces es el
punto flojo más visible de la campaña. La tabla `JEFES` ya lo hace
barato: cada uno son sus fases y sus ataques.

**C · M6–M10.** Solo cuando A y B estén cerrados.

| | Misión | Mecánica nueva |
|---|---|---|
| M6 | WAR FLEET | Formaciones grandes y cruceros con partes destructibles |
| M7 | GRAVITY COLLAPSE | Anomalías que curvan proyectiles y movimiento |
| M8 | INFERNO | Velocidad, fuego y zonas que destruyen el terreno |
| M9 | ENEMY CORE | Defensas extremas, escudos encadenados |
| M10 | FINAL STRIKE | Todo lo anterior + jefe final multi-fase |

**D · Música**, si aparece con licencia comercial verificable.
