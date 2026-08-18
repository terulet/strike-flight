# LAST LIGHT

**Disparar te permite ver.**

Prototipo de fase 0. Existe para responder a UNA pregunta y a ninguna más:

> ¿Es divertido moverse por un escenario oscuro donde disparar sirve
> simultáneamente para atacar, explorar y revelar tu posición?

Si la respuesta es sí, LAST LIGHT pasa a la siguiente fase. Si es no,
iteramos la mecánica antes de construir contenido.

---

## Jugar

Necesita Node ≥ 20. **No hay dependencias y no hay `npm install`.**

```bash
cd games/last-light
npm run dev          # → http://localhost:5178
```

El servidor también imprime la IP de red: si abres esa dirección desde el
iPhone o el iPad conectados a la misma wifi, el juego corre nativo en el
navegador con los controles táctiles.

```bash
npm run build        # → dist/last-light.html, un solo archivo autocontenido
npm run check        # prueba de humo en un navegador real
npm run check -- --shots   # …y deja capturas en dist/shots/
```

`dist/last-light.html` no necesita servidor: se abre con doble clic, se manda
por AirDrop al móvil o se sube a cualquier sitio. Es el formato para pasarle
la partida a alguien.

### Controles

|              | Móvil (plataforma objetivo)          | Escritorio (herramienta de pruebas) |
| ------------ | ------------------------------------ | ----------------------------------- |
| Moverse      | joystick flotante, mitad izquierda   | `WASD` / flechas                    |
| Apuntar      | joystick flotante, mitad derecha     | ratón                               |
| Disparar     | auto al desviar el stick derecho     | clic izquierdo                      |
| Recargar     | automática                           | `R`                                 |
| Reiniciar    | tocar la pantalla                    | `ESPACIO`                           |
| Debug        | —                                    | `F1`                                |
| Parámetros   | —                                    | `F2`                                |

El modo de disparo táctil se cambia en `Config.touch.fireMode`:
`'auto'` (por defecto), `'button'` (botón dedicado) o `'release'` (apuntas,
sueltas, dispara). Están los tres implementados justo para poder decidir
cuál sienta mejor jugando, no discutiéndolo.

---

## La regla

Un disparo hace **tres cosas a la vez**, y cada una está en un sitio distinto
del código para poder ajustarlas por separado:

| | Qué hace | Dónde vive |
| --- | --- | --- |
| **ATAQUE** | mata | `entities/Projectiles.js` |
| **VISIÓN** | fogonazo → trayectoria → impacto | `systems/Lighting.js` |
| **RIESGO** | te delata por sonido **y** por luz | `Game.emitSound()` + `player.exposure` |

El riesgo va por dos canales a propósito:

- **`emitSound()`** — el ruido llega a la IA, que acude al origen *con error*
  (`enemy.hearingError`). Un enemigo que caminase a tu posición exacta sería
  un GPS y la oscuridad dejaría de protegerte. Las paredes no bloquean el
  sonido, lo amortiguan: por eso disparar a una pared lejana funciona como
  señuelo.
- **`player.exposure`** — el fogonazo te ilumina, y el alcance visual del
  enemigo se interpola entre `visionRangeDark` y `visionRange` según cuánto
  brillas. La IA no pregunta "¿ha disparado?", pregunta "¿cuánto brilla?".
  Cualquier fuente de luz futura te delatará gratis sin tocar la IA.

---

## Las dos ideas técnicas

### 1 · Las entidades no se recuerdan

El renderizador compone tres poblaciones con **dos máscaras distintas**:

```
ESTÁTICA (geometría)  ← combinedMask   ambiente + luz + MEMORIA
DINÁMICA (entidades)  ← liveMask       solo luz de AHORA
EMISIVA  (luz propia) ← ninguna        siempre visible
```

De esa única diferencia sale la fantasía entera: **recuerdas la habitación,
no recuerdas al enemigo**. Vuelves a un sitio que "conoces" y ya no sabes qué
hay dentro. Si quieres ver fantasmas de enemigos, sube
`memory.dynamicPersistence` — y comprueba tú mismo cómo se desinfla la tensión.

La oclusión es real: cada luz calcula su polígono de visibilidad lanzando tres
rayos por esquina (el central toca la esquina, los laterales se cuelan detrás,
que es lo que hace que la luz *doble* la esquina en vez de cortarse en seco).

### 2 · El recuerdo pierde el color antes que la forma

La memoria vive en un lienzo en **espacio de mundo** (si viviera en pantalla
se arrastraría al mover la cámara) y cada fotograma recibe dos operaciones:
una caída exponencial por vida media, y un empujón de color hacia un tinte
frío. Lo recién iluminado conserva su color real; lo viejo se convierte en una
silueta azulada antes de desaparecer.

Curva por defecto (`memory.halfLife = 0.62`), ajustable en caliente con `F2`:

```
0 ms      iluminación máxima
200 ms    geometría clara, color real
500 ms    empieza a enfriarse
1000 ms   siluetas azules
1500 ms   oscuridad
```

---

## Arquitectura

```
src/
├── config/Config.js     ← TODOS los parámetros de balance. Un solo archivo.
├── core/                  Game · Camera · Pool · Rng · MathUtils · Events
├── input/                 Input (estado unificado) · KeyboardMouse · TouchControls
├── entities/              Player · Weapon · Projectiles · Enemy · EnemyAI
├── systems/               Lighting · Renderer · Level · Audio · Effects
├── ui/                    Hud · Debug
└── main.js                arranque y bucle
tools/                     serve · build · check   (sin dependencias)
```

Reglas que sostienen esto:

- **Nada de números mágicos fuera de `Config.js`.** Si hay que balancear, se
  balancea en un sitio.
- **Nada de `new` en el bucle de juego.** Proyectiles, partículas y destellos
  salen de pools de tamaño fijo: en un móvil el problema no es la CPU, es el
  recolector de basura dando un tirón justo al disparar.
- **El arma no sabe qué es un enemigo.** Publica un sonido; la IA lo escucha.
  Se pueden reajustar por separado.

### El nivel

`systems/Level.js` empieza con un mapa **ASCII editable a mano**:

```
#  muro    .  suelo    P  jugador    E  enemigo    A  munición    L  luz
```

De ahí salen la rejilla de colisiones (raycast DDA), los segmentos de pared
fusionados por tramos colineales (130 en vez de ~600 aristas sueltas, que es
lo que hace viable calcular sombras a 60 fps en un móvil) y los puntos de
aparición. Cambiar el nivel es editar texto.

---

## Balancear

`F2` abre un panel de deslizadores sobre `Config` en vivo. El botón **copiar**
vuelca los valores actuales a la consola y al portapapeles, listos para pegar
en `Config.js` sin transcribir nada a mano.

Las perillas que más cambian el juego, por orden:

| Parámetro | Qué pasa si lo tocas |
| --- | --- |
| `world.ambient` | subirlo hace el juego legible **y le quita la tensión**. Primera perilla a probar. |
| `weapon.infiniteAmmo` | ponlo a `true` y verás cómo la oscuridad deja de importar: sin coste, disparar para ver degenera en mantener el gatillo. |
| `memory.halfLife` | cuánto dura el recuerdo. Con 0.1 vas a ciegas; con 3 el escenario deja de dar miedo. |
| `enemy.hearingRange` | a 620 un disparo no cruzaba una sala y el riesgo no existía. A 900 empieza a doler. |
| `enemy.visionRangeDark` | cuánto te ven estando a oscuras. Es el suelo de tu invisibilidad. |
| `lighting.maskScale` | LA perilla de rendimiento. 0.6 equilibrado, 0.4 salva un móvil viejo. |

---

## Rendimiento

Objetivo iPhone/iPad. Las máscaras se renderizan a `maskScale` de la
resolución lógica y la resolución interna tiene techo (`render.maxPixels`):
en pantallas grandes bajamos densidad antes que fotogramas.

El panel de debug muestra el desglose real del fotograma
(`lógica · escenario · entidades · luz · composición`). El coste de la lógica
—lo único que controla el código— está en ~2-3 ms. La composición es relleno
de píxeles y depende de la GPU: **el único número que vale es el medido en el
dispositivo**, no en un portátil.

---

## Lo que NO está construido, a propósito

Campaña, niveles, tienda, skins, monetización, cuentas, backend, multijugador,
cinemáticas, árboles de habilidades, variedad de enemigos. Hay **un** arma,
**un** enemigo y **una** arena. Primero hay que encontrar el juego.

## Propuestas para la siguiente iteración

Detectadas construyendo esto, **no implementadas** hasta que haya veredicto:

1. **Bengala / luz arrojadiza.** Una fuente de luz que puedes lanzar y dejar
   atrás. Compite con el arma como herramienta de visión y crea la decisión
   "¿ilumino aquello o me guardo el tiro?". Riesgo: puede diluir la tesis de
   que *disparar* es lo que te deja ver.
2. **Un enemigo que reacciona a la luz, no al ruido.** Ciego y sordo, pero se
   mueve hacia cualquier cosa iluminada. Invierte la regla y obliga a disparar
   *lejos de ti*.
3. **Munición como recurso del nivel, no del inventario.** Que la única forma
   de conseguir balas sea explorar a oscuras cierra el bucle sobre sí mismo.

---

## Criterio de éxito

Esta fase termina cuando se pueda jugar varios intentos y responder:

- [ ] ¿Disparar para ver es divertido?
- [ ] ¿Existe tensión **antes** de disparar?
- [ ] ¿La oscuridad aporta gameplay y no solo estética?
- [ ] ¿El sonido ayuda realmente a orientarse?
- [ ] ¿Revelar tu posición crea decisiones interesantes?
- [ ] ¿Se quiere jugar otra partida inmediatamente?
