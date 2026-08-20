# Flight Strike — Auditoría

Sobre el código real de `index.html` (1133 líneas, 1107 de JS). Todas las
referencias llevan número de línea para que se puedan comprobar.

> **Nota de nombre:** el repo, el título en pantalla y la clave de guardado
> dicen *Strike Flight*; la dirección dice *Flight Strike*. Hay que fijar uno.
> Afecta a `<title>`, al texto del menú (l. 913) y a las claves `sf_*` de
> `localStorage`.

---

## 1. Qué existe

Un solo archivo HTML sin dependencias, sin compilación y sin conexión.
Todo el estado en variables globales (l. 330-336).

| Sistema | Dónde | Estado |
|---|---|---|
| Bucle de juego, `dt` acotado | 1124 | Sólido |
| Canvas + DPR + resize | 94 | Sólido |
| Control táctil (arrastre, desfase sobre el dedo, suavizado, alabeo) | 376, 595-604 | **Excelente** |
| Disparo automático, 6 niveles de arma | 522 | Funciona, mal estructurado |
| 4 tipos de enemigo | 440, 612-660 | Funciona, mal estructurado |
| Proyectiles enemigos, apuntados al jugador | 627-640 | Funciona |
| 5 power-ups | 320, 484 | Funciona |
| Partículas, sacudida, texto flotante, fogonazo | 426-438 | **Excelente** |
| 4 mundos con fondo y paleta propios | 50, 649 | Buena base |
| Pipeline de sprites (recorte, transparencia, escalado) | 121-228 | **Excelente** |
| HUD, menú, selector de nave, fin de partida | 851-1056 | Funciona |
| Audio sintetizado, cero archivos | 289-318 | Buena base |
| Persistencia (récord, mundo, nave, naves cargadas) | 230-262 | Funciona |

### Verificado en ejecución

Probado con navegador real: las 4 temáticas, los 4 enemigos, los premios, el
fin de partida, la carga de naves y la persistencia tras recarga. Sin errores
de JS. El recorte de fondo conserva 5220 píxeles blancos interiores en una
nave blanca sobre fondo blanco.

---

## 2. El problema central

**No hay niveles. No hay eventos. No hay diseño.**

```js
// l. 440 — el "diseño de nivel" completo
function spawnEnemy() {
  const r1 = Math.random();
  let tipo = "normal";
  if (level >= 2 && r1 < ...) tipo = "veloz";
  ...
}
// l. 665 — la "progresión" completa
const nl = 1 + Math.floor(elapsed / CONFIG.subeDificultadCada);
```

El enemigo se elige al azar, la posición es aleatoria (l. 451), y la
dificultad es un cronómetro que multiplica cantidad, velocidad y vida.

Esto choca de frente con dos puntos de la dirección:

- **Punto 1:** *«NO quiero un simple endless shooter donde únicamente
  aparecen enemigos aleatoriamente»* — es literalmente lo que hay.
- **Punto 15:** *«NO únicamente multiplicando HP»* — es literalmente lo que
  hace (l. 448, 683).

No es un defecto de calidad: es que la capa que la visión necesita **no
existe todavía**. Hay que construirla, no arreglarla.

### Lo que falta frente a la visión

Formaciones · torretas de escenario · minas · barreras · obstáculos ·
misiles · hazards · WARNING · minibosses · bosses · fases de boss · partes
destructibles · patrones de bala reutilizables · niveles · mundos como
progresión · ritmo diseñado.

De la lista del punto 5, existen 4 de 14 comportamientos enemigos. De la del
punto 6, cero de 18 defensas. Del punto 7, cero hazards. Del 8, cero bosses.

---

## 3. Qué conservar sin tocar

Esto es lo caro de conseguir y ya está resuelto. **No rehacerlo.**

1. **La capa de sensación.** Control, alabeo, desfase sobre el dedo, sacudida
   de cámara, partículas, fogonazo, parpadeo de invulnerabilidad, textos
   flotantes. Es lo que separa un shooter que se siente bien de uno que no, y
   está bien calibrado.
2. **El pipeline de sprites** (l. 121-228). Reducción por mitades, recorte de
   fondo por inundación desde los bordes, recorte al contenido, 512 px.
   Encaja directamente con el punto 18 y con los PNG RGBA 1024×1024.
3. **La zona de impacto reducida** (l. 656: `player.r * 0.7`). Es la
   convención correcta del género y hace falta para el punto 9.
4. **El audio sintetizado.** Cero archivos, cero latencia de carga.
5. **Menú, persistencia y selector de nave.**

---

## 4. Qué refactorizar (y por qué, no por gusto)

El comportamiento enemigo hoy vive repartido en cadenas `if/else` sobre
`e.tipo` en tres sitios: creación (440), actualización (612-660) y dibujo
(768). Añadir los 14 comportamientos del punto 5 por esa vía significa
tocar tres bloques por enemigo y acabar con `if/else` de 40 ramas.

**R1 — Enemigos dirigidos por datos.** Una tabla por tipo con `hp`, `r`,
`sprite`, `puntos`, y funciones `mover(e, dt)` y `atacar(e, dt)`. Los 4
actuales se migran tal cual; los 10 nuevos se añaden sin tocar `update()`.

**R2 — Patrones de bala reutilizables.** `disparar()` (l. 522) es un
`if/else` de 6 ramas para el jugador, y los enemigos tienen el suyo aparte
(l. 630). Una sola familia de funciones —`recto`, `abanico`, `círculo`,
`espiral`, `apuntado`, `ráfaga`— sirve para jugador, enemigos y bosses
(puntos 9 y 11).

**R3 — Línea de tiempo de nivel.** Sustituir `spawnEnemy()` por un guion de
eventos con marca de tiempo o condición de avance. Es el punto 4 y el que
desbloquea todo lo demás.

**R4 — Registro de assets.** `cargarSprite` está cableado a rutas fijas
(l. 226-228). Con la nomenclatura `ENE_001_fighter.png` hace falta un
manifiesto que asocie identificador lógico → archivo, para poder soltar
carpetas enteras sin tocar código.

### Lo que NO hay que hacer

- No pasar a un framework. No hace falta y rompería el «un archivo, sin
  compilar», que es lo que permite que la niña toque `CONFIG` y recargue.
- No introducir ECS completo. Una tabla de comportamientos basta.
- No dividir en 20 módulos todavía. Sí conviene separar en 3-4 archivos
  cuando el evento/nivel entre, porque 1100 líneas ya duelen y esto va a
  triplicar.

---

## 5. Riesgos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Sin agrupación de objetos; `splice` en cada fotograma | A densidad de bullet hell, tirones por recolección de basura en iPad | Reutilizar objetos cuando entren los bosses, no antes |
| Colisiones O(balas × enemigos) (l. 617) | Con formaciones + boss modular se dispara | Rejilla espacial simple, solo si se mide caída de FPS |
| Todo en ámbito global | Colisión de nombres al crecer | Separar en archivos al entrar R3 |
| `localStorage` para las naves cargadas | ~5 MB de tope; 4 naves × 512 px ya son ~70 KB | Vigilar si suben muchos assets |
| Boss modular con partes | Es el sistema más caro de la lista | Dejarlo para el final del vertical slice, con R1 y R2 ya asentados |
| Legibilidad (punto 13) | Las balas del jugador y las de algún mundo comparten color | Fijar lenguaje visual: enemigo = rojo/naranja + forma redonda; jugador = cian + forma alargada. Y no depender solo del color |

---

## 6. Plan recomendado

Respeta el orden de prioridad del punto 19 y el criterio del 21: cada etapa
deja el juego **jugable y probado**, no a medias.

**Etapa 0 — Preparación** *(sin cambio visible)*
Fijar el nombre. Separar en `index.html` + `motor.js` + `contenido.js`.
R4 (registro de assets). Sigue jugando exactamente igual.

**Etapa 1 — Cimientos** *(el desbloqueo)*
R1 (enemigos por datos) y R2 (patrones de bala). Migrar los 4 enemigos
actuales sin cambiar cómo se juega. Punto de control: el juego se comporta
igual que ahora, pero añadir un enemigo cuesta 15 líneas.

**Etapa 2 — Sistema de eventos**
R3: línea de tiempo, `SpawnWave`, `SpawnFormation`, `RewardSection`. Las
formaciones del punto 3 (V, línea, zigzag, pinza, enjambre). El modo
aleatorio actual se conserva como «supervivencia».

**Etapa 3 — Amenazas**
Torretas de escenario, minas, barreras. `SpawnMissileStrike` con el WARNING
del punto 7 — con margen de reacción real, nunca daño inevitable.

**Etapa 4 — Enemigos avanzados**
Kamikaze, bombardero, francotirador con aviso, portaescudos, sembrador de
minas. Ya son baratos gracias a la etapa 1.

**Etapa 5 — Miniboss**
Enemigo grande, un patrón, una fase. Valida el andamiaje antes del boss.

**Etapa 6 — Boss modular**
Núcleo + partes destructibles + 3 fases. Cadena
generador → escudo → armas → núcleo.

**Etapa 7 — El vertical slice**
Ensamblar el nivel de 3-5 minutos del punto 20 con todo lo anterior, y
ajustar el ritmo del punto 16.

Las etapas 0 y 1 no añaden nada visible y son las más importantes. Saltárselas
para llegar antes a los bosses es exactamente cómo este proyecto se vuelve
inmantenible a mitad de camino.

---

## 7. Recomendación

Empezar por **Etapa 0 + Etapa 1**, y como prueba de que funciona, añadir un
quinto enemigo (kamikaze) que persiga al jugador. Si añadirlo cuesta unas
pocas líneas y no toca `update()`, los cimientos son correctos y el resto del
plan es ejecución.

Antes de eso hay que decidir dos cosas:

1. **El nombre**, porque afecta a las claves de guardado.
2. **Si el modo actual sobrevive** como modo «supervivencia» aparte de la
   campaña por niveles. Recomiendo que sí: ya funciona, no cuesta nada
   conservarlo, y da algo que jugar mientras la campaña se construye.
