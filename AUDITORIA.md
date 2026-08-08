# Strike Flight — Auditoría

Sobre el código real de `index.html` (1250 líneas). Todas las referencias
llevan número de línea para que se puedan comprobar.

---

## 0. Decisiones tomadas

Las tres preguntas que bloqueaban el arranque están cerradas:

1. **El nombre es _Strike Flight_.** Fijado en `<title>` (l. 9), en el menú
   (l. 1029), en el meta de iOS (l. 7) y en las claves de guardado, que son
   `sf_record`, `sf_tema`, `sf_nave` y `sf_naves`. No queda ni un
   *Flight Strike* en el repositorio.
2. **El modo actual sobrevive como «supervivencia».** `elegirTipo()` (l. 586)
   es ese modo, ya aislado en su propia función. La campaña por niveles no lo
   sustituye: llamará a `spawnEnemy(tipo, x)` con tipo y posición concretos,
   y el aleatorio se queda como modo aparte.
3. **El recorte de fondo se hace por inundación desde los bordes.** `quitarFondo()`
   (l. 140). Solo se va el color que toca el marco, así que los blancos del
   interior de la nave se conservan. No se toca.

## Estado

| Etapa | Qué era | Estado |
|---|---|---|
| 0 — Preparación | Fijar el nombre · separar en varios archivos · R4 | **Nombre hecho.** Separación y R4, pendientes |
| 1 — Cimientos | R1 enemigos por datos · R2 patrones de bala | **Hecha y verificada** |
| 2 — Eventos | R3 línea de tiempo, formaciones | Siguiente |
| 3-7 | Amenazas, enemigos avanzados, miniboss, boss, vertical slice | Sin empezar |

### Verificado en navegador

Chromium real, servido por HTTP, 414×896 a DPR 2:

- Los **5 tipos** se mueven, disparan, reciben daño y mueren; puntúan lo que
  dice su tabla (10 / 25 / 40 / 120 / 35).
- **Kamikaze:** gira hacia el jugador y satura en 230 px/s de velocidad
  lateral, que es el tope declarado. Se puede esquivar siempre.
- **Supervivencia:** la mezcla abre en 100 % normales y a nivel 8 reparte
  43 % normal · 36 % veloz · 10 % kamikaze · 6 % tanque · 5 % torreta.
- **60 s de partida simulada:** pico de 7 enemigos, 39 balas y 88 partículas.
  Sin errores de JS.
- **60 fps** con 19 enemigos en pantalla, headless y sin GPU.
- **Recorte de fondo:** una nave blanca de 1024×1024 sobre fondo blanco sale
  en 274×350, con las cuatro esquinas a alfa 0 y **30 424 píxeles blancos
  conservados** dentro del casco.
- **Persistencia:** `sf_record`, `sf_tema` y `sf_nave` sobreviven a la recarga.

Los únicos errores de consola son los 404 de `art/`, previstos mientras
falten los PNG.

---

## 1. Qué existe

Un solo archivo HTML sin dependencias, sin compilación y sin conexión.
Todo el estado en variables globales (l. 474-480).

| Sistema | Dónde | Estado |
|---|---|---|
| Bucle de juego, `dt` acotado | 1241 | Sólido |
| Canvas + DPR + resize | 94 | Sólido |
| Control táctil (arrastre, desfase sobre el dedo, suavizado, alabeo) | 521, 715-719 | **Excelente** |
| Disparo automático, 6 niveles de arma | 674 | Funciona; pendiente de pasar a `PATRONES` |
| 5 tipos de enemigo dirigidos por datos | 366 | **Sólido** |
| Patrones de bala reutilizables | 335 | Base puesta: `abanico` y `circulo` |
| Proyectiles enemigos, apuntados al jugador | 333, 390 | Funciona |
| 5 power-ups | 319, 636 | Funciona |
| Partículas, sacudida, texto flotante, fogonazo | 570-581 | **Excelente** |
| 4 mundos con fondo y paleta propios | 50, 792 | Buena base |
| Pipeline de sprites (recorte, transparencia, escalado) | 117-215 | **Excelente** |
| HUD, menú, selector de nave, fin de partida | 968-1237 | Funciona |
| Audio sintetizado, cero archivos | 288-316 | Buena base |
| Persistencia (récord, mundo, nave, naves cargadas) | 228-260 | Funciona |

---

## 2. El problema central

**No hay niveles. No hay eventos. No hay diseño.**

Los cimientos ya aguantan (etapa 1 hecha), pero encima no hay nada
construido todavía: el enemigo se sigue eligiendo al azar y la dificultad
sigue siendo un cronómetro.

```js
// l. 586 — el "diseño de nivel" completo
function elegirTipo() {
  const r = Math.random();
  if (level >= 2 && r < ...) return "veloz";
  ...
}
// l. 709 — la "progresión" completa
const nl = 1 + Math.floor(elapsed / CONFIG.subeDificultadCada);
```

Esto choca de frente con dos puntos de la dirección:

- **Punto 1:** *«NO quiero un simple endless shooter donde únicamente
  aparecen enemigos aleatoriamente»*.
- **Punto 15:** *«NO únicamente multiplicando HP»* — es lo que hace la
  progresión (l. 602, 744).

La diferencia con la primera auditoría es que ahora **ese modo tiene nombre y
sitio**: es «supervivencia», y se queda. Lo que falta es la campaña al lado.

### Lo que falta frente a la visión

Formaciones · torretas de escenario · minas · barreras · obstáculos ·
misiles · hazards · WARNING · minibosses · bosses · fases de boss · partes
destructibles · niveles · mundos como progresión · ritmo diseñado.

De la lista del punto 5, existen 5 de 14 comportamientos enemigos. De la del
punto 6, cero de 18 defensas. Del punto 7, cero hazards. Del 8, cero bosses.

---

## 3. Qué conservar sin tocar

Esto es lo caro de conseguir y ya está resuelto. **No rehacerlo.**

1. **La capa de sensación.** Control, alabeo, desfase sobre el dedo, sacudida
   de cámara, partículas, fogonazo, parpadeo de invulnerabilidad, textos
   flotantes. Es lo que separa un shooter que se siente bien de uno que no, y
   está bien calibrado.
2. **El pipeline de sprites** (l. 117-215). Reducción por mitades, recorte de
   fondo por inundación desde los bordes, recorte al contenido, 512 px.
   Encaja directamente con el punto 18 y con los PNG RGBA 1024×1024.
3. **La zona de impacto reducida** (l. 772: `player.r * 0.7`). Es la
   convención correcta del género y hace falta para el punto 9.
4. **El audio sintetizado.** Cero archivos, cero latencia de carga.
5. **Menú, persistencia y selector de nave.**
6. **La tabla `ENEMIGOS`** (l. 366). Es el resultado de la etapa 1 y todo lo
   que viene se apoya en ella.

---

## 4. Refactores

**R1 — Enemigos dirigidos por datos. HECHO** (l. 352-420). Una tabla por tipo
con `r`, `hp`, `puntos`, `vel`, `forma`, `color`, y funciones `init(e)`,
`mover(e, dt)` y `atacar(e)`. Los 4 originales están migrados y el quinto
—kamikaze— entró en 11 líneas sin tocar `update()` ni `dibujarEnemigo()`.
Los sprites se recogen solos desde la propia tabla (l. 471), así que un tipo
nuevo solo necesita su entrada y, si se quiere, su PNG.

**R2 — Patrones de bala reutilizables. HECHO a medias** (l. 335-350).
Existen `abanico` y `circulo`, y ya los comparten torreta y tanque. Faltan
`espiral` y `ráfaga`, y falta pasar `disparar()` del jugador (l. 674, un
`if/else` de 6 ramas) a la misma familia. Eso último no corre prisa: no
estorba hasta que lleguen los bosses.

**R3 — Línea de tiempo de nivel. PENDIENTE.** Es la etapa 2 y la que
desbloquea todo lo demás. `spawnEnemy(tipo, x)` (l. 595) ya acepta tipo y
posición, así que el guion de eventos puede escribirse sin tocar nada más.

**R4 — Registro de assets. PENDIENTE a medias.** Las rutas ya no están
cableadas una a una: los enemigos salen de `Object.keys(ENEMIGOS)` y las naves
de la tabla `NAVES`, y ambos pasan por `CARPETAS` (l. 72-83), que prueba
varios sitios —`art/naves/`, `assets/naves/`, `assets/`— y se queda con el
primero que tenga el archivo. `cargarSprite()` recorre la lista y cae al
siguiente candidato en `onerror`.

Eso resuelve el caso «la carpeta se llama de otra manera», que es el que
estaba mordiendo de verdad. Lo que falta del R4 es el otro: el manifiesto
identificador lógico → archivo, para soltar carpetas con nomenclatura tipo
`ENE_001_fighter.png` sin renombrar nada. Mientras el nombre del archivo sea
el del tipo, no hace falta.

### Lo que NO hay que hacer

- No pasar a un framework. No hace falta y rompería el «un archivo, sin
  compilar», que es lo que permite que la niña toque `CONFIG` y recargue.
- No introducir ECS completo. La tabla de comportamientos ya basta.
- Al separar en archivos, **`<script src>` normal, nunca `type="module"`**.
  Comprobado: con `file://` el navegador bloquea los módulos por CORS y el
  juego se queda en negro al abrirlo con doble clic. Los scripts clásicos
  cargan sin problema.

---

## 5. Riesgos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Sin agrupación de objetos; `splice` en cada fotograma | A densidad de bullet hell, tirones por recolección de basura en iPad | Reutilizar objetos cuando entren los bosses, no antes. Medido: 88 partículas de pico en 60 s, muy lejos del problema |
| Colisiones O(balas × enemigos) (l. 760) | Con formaciones + boss modular se dispara | Rejilla espacial simple, solo si se mide caída de FPS. Hoy: 60 fps con 19 enemigos |
| Todo en ámbito global | Colisión de nombres al crecer | Separar en archivos al entrar R3 |
| `localStorage` para las naves cargadas | ~5 MB de tope; 4 naves × 512 px ya son ~70 KB | Vigilar si suben muchos assets |
| Boss modular con partes | Es el sistema más caro de la lista | Dejarlo para el final del vertical slice, con R1 y R2 ya asentados |
| Legibilidad (punto 13) | En CIUDAD NEÓN coincidían enemigos, balas enemigas y premios en el mismo amarillo | **Resuelto.** Lenguaje fijo e independiente del mundo: tu disparo alargado y cian (`TIRO_TUYO`), el suyo redondo y rosa (`TIRO_SUYO`), premios en chapa cuadrada. Los enemigos tienen prohibido el rosa y el cian. Se distingue por forma antes que por color |
| El recorte de fondo no actúa con `file://` | Las naves de `art/` se verían con su fondo al abrir por doble clic | Resuelto: `herramientas/recortar.mjs` las deja recortadas en disco, y usa el propio `prepararSprite()` del juego para que no haya dos algoritmos |

---

## 6. Plan

Respeta el orden de prioridad del punto 19 y el criterio del 21: cada etapa
deja el juego **jugable y probado**, no a medias.

**Etapa 0 — Preparación** · *nombre hecho; falta la separación*
Separar en `index.html` + `motor.js` + `contenido.js` con `<script src>`
clásico. R4 (manifiesto de assets). Sigue jugando exactamente igual.

**Etapa 1 — Cimientos** · **HECHA**
R1 y R2. Los 4 enemigos migrados sin cambiar cómo se juega, y el kamikaze
como prueba: 11 líneas, cero cambios en `update()`. Los cimientos son
correctos.

**Etapa 2 — Sistema de eventos** · *siguiente*
R3: línea de tiempo, `SpawnWave`, `SpawnFormation`, `RewardSection`. Las
formaciones del punto 3 (V, línea, zigzag, pinza, enjambre). Supervivencia se
conserva como modo aparte, elegible desde el menú.

**Etapa 3 — Amenazas**
Torretas de escenario, minas, barreras. `SpawnMissileStrike` con el WARNING
del punto 7 — con margen de reacción real, nunca daño inevitable.

**Etapa 4 — Enemigos avanzados**
Bombardero, francotirador con aviso, portaescudos, sembrador de minas. Ya son
baratos gracias a la etapa 1.

**Etapa 5 — Miniboss**
Enemigo grande, un patrón, una fase. Valida el andamiaje antes del boss.

**Etapa 6 — Boss modular**
Núcleo + partes destructibles + 3 fases. Cadena
generador → escudo → armas → núcleo.

**Etapa 7 — El vertical slice**
Ensamblar el nivel de 3-5 minutos del punto 20 con todo lo anterior, y
ajustar el ritmo del punto 16.

---

## 7. Recomendación

La prueba de la etapa 1 salió bien: añadir el quinto enemigo costó 11 líneas
y no tocó `update()`. Los cimientos aguantan y el resto del plan es ejecución.

Lo siguiente es la **etapa 2**, y conviene arrastrar con ella lo que queda de
la 0: el momento de partir el archivo es justo cuando entra la línea de
tiempo, porque es cuando `contenido.js` empieza a tener contenido de verdad.
Hacerlo antes es mover líneas de sitio sin ganar nada; hacerlo después es
partir 1800 líneas en vez de 1250.

Queda una decisión abierta, y esta sí es de diseño, no de código: **si el
menú pasa a tener dos botones —CAMPAÑA y SUPERVIVENCIA— o si la campaña se
elige por mundo y supervivencia queda como modo suelto.** Afecta a la
pantalla que ella ve al arrancar, así que mejor decidirlo mirándola.
