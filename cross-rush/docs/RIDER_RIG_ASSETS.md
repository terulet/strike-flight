# Piloto articulado — inventario de piezas que faltan

Este documento existe porque el mandato lo pide explicitamente: *"Si el PNG
único impide un resultado convincente, documenta exactamente qué piezas
separadas se necesitan (torso/cabeza, brazos, piernas) con pivotes y tamaños.
No inventes un collage: 1 asset = 1 archivo."*

## Que se ha hecho con el arte que hay

`src/sprites/rider.png` (262 x 420 px, RGBA) es **una sola pieza**: cuerpo,
casco, brazos y piernas horneados en la misma imagen. Con eso no se puede
articular nada, pero si se puede -y se ha hecho- despegar al piloto del
asiento y darle vida como cuerpo entero:

- **desplazamiento longitudinal** dentro del espacio local del chasis
  (`RiderPose.shiftX`): el cuerpo se va sobre el manillar al frenar y hacia la
  cola al acelerar o al pedir caballito;
- **desplazamiento vertical** (`RiderPose.shiftY`): acompaña a la compresion de
  la suspension, se hunde para absorber el aterrizaje y se estira al despegar;
- **rotacion de torso** (`RiderPose.torsoAngle`): independiente del angulo del
  chasis, y en vuelo contrarresta el cabeceo.

Los tres los mueven muelles de segundo orden (`src/physics/RiderPose.ts`), no
interpolaciones lineales: un lerp llega al destino frenando y no se pasa nunca,
y eso es exactamente lo que hace que un personaje parezca de madera.

Es un salto grande respecto a un sprite atornillado al asiento, y es honesto:
mueve la pieza que existe. Pero tiene un techo. Lo que **no** se puede hacer
con una sola imagen:

- que los brazos se estiren al irse el cuerpo hacia atras y se doblen al
  adelantarse (ahora el cuerpo se mueve entero y los brazos se van del
  manillar);
- que las piernas se separen del asiento al ponerse de pie sobre las
  estriberas, que es la pose real en whoops y rockgarden;
- que la cabeza mire hacia adelante mientras el torso gira;
- que el codo exterior suba al aterrizar, que es el gesto que mas lee como
  "absorber".

## Piezas necesarias

Ocho archivos PNG independientes, **uno por pieza** (regla PLAYZONE: 1 asset =
1 archivo, nada de atlas ni de collage). Todos con transparencia real y con el
mismo estilo, iluminacion y paleta que `rider.png` actual, para que se puedan
mezclar con el arte ya aprobado.

Tamaños de referencia calculados para que el piloto montado siga midiendo
~1.30 m de alto (`SpriteCalibration.rider.assumedHeightMeters`), a la misma
densidad de pixeles que el `rider.png` de hoy (~323 px/m).

| # | Archivo | Contenido | Tamaño sugerido | Pivote (px, origen arriba-izquierda) | Que lo mueve |
|---|---------|-----------|-----------------|--------------------------------------|--------------|
| 1 | `rider_torso.png` | Torso con peto y cuello, **sin** cabeza ni brazos | 150 x 210 | 74, 196 (cadera) | `shiftX`, `shiftY`, `torsoAngle` |
| 2 | `rider_head.png` | Casco completo con visera | 118 x 118 | 60, 104 (base del cuello) | `torsoAngle` compensado: la cabeza mira al horizonte |
| 3 | `rider_arm_upper.png` | Brazo del lado camara, hombro a codo | 62 x 104 | 31, 16 (hombro) | IK de dos huesos hacia el puño del manillar |
| 4 | `rider_arm_fore.png` | Antebrazo con guante, codo a puño | 58 x 112 | 29, 12 (codo) | IK de dos huesos hacia el puño del manillar |
| 5 | `rider_leg_upper.png` | Muslo, cadera a rodilla | 74 x 118 | 36, 16 (cadera) | IK de dos huesos hacia la estribera + `crouch` |
| 6 | `rider_leg_lower.png` | Pierna y bota, rodilla a estribera | 68 x 132 | 33, 14 (rodilla) | IK de dos huesos hacia la estribera + `crouch` |
| 7 | `rider_arm_far.png` | Brazo del lado opuesto, entero y algo mas oscuro | 96 x 190 | 26, 18 (hombro) | Igual que 3+4, dibujado **detras** del chasis |
| 8 | `rider_leg_far.png` | Pierna del lado opuesto, entera y algo mas oscura | 82 x 226 | 34, 16 (cadera) | Igual que 5+6, dibujado **detras** del chasis |

### Requisitos de dibujo

- **Pose base**: piloto de pie sobre las estriberas, rodillas ligeramente
  flexionadas, brazos casi extendidos. Es la pose media entre agachado y
  estirado, la que menos deforma al interpolar hacia los dos extremos.
- **Solapes**: cada pieza tiene que sobrar ~8 px por el extremo del pivote
  (hombro, codo, cadera, rodilla) para que al rotar no se abra un hueco en la
  articulacion.
- **Piezas 7 y 8** (lado lejano): mismo dibujo que las cercanas pero con un 25%
  menos de luminosidad, para que la profundidad se lea sin trucos de render.
- **Orden de dibujo** en pantalla, de atras a adelante: `rider_leg_far`,
  `rider_arm_far`, chasis, `rider_torso`, `rider_head`, `rider_leg_upper`,
  `rider_leg_lower`, `rider_arm_upper`, `rider_arm_fore`.

### Puntos de anclaje que ya existen en el juego

Para enganchar las piezas no hace falta inventar nada: los dos objetivos de IK
salen de la calibracion actual del chasis (`SpriteCalibration.bike`), en
espacio local de la moto y en metros desde el centro de masas.

- **Puño del manillar**: `(+0.42, +0.02)`
- **Estribera**: `(-0.10, -0.46)`
- **Cadera del piloto** (donde se ancla el torso hoy): `(-0.25, -0.63)` mas la
  pose (`shiftX`, `shiftY`), tal y como lo calcula `Renderer.drawRider`.

Con esos dos objetivos y las ocho piezas, la pose completa se resuelve con dos
cadenas de IK de dos huesos por lado, alimentadas por los mismos tres numeros
que ya calcula `RiderPose.ts`. No hace falta tocar la fisica: el rig es
puramente de presentacion.

## Mientras tanto

El juego funciona y se lee sin estas piezas. Este documento es la lista de la
compra, no un bloqueo.
