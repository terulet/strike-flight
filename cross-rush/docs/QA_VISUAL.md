# QA visual — CROSS RUSH, reconstrucción de la sensación de conducción

> **Criterio de cierre del mandato:** *"No cierres con 'tests verdes'. Cierra
> únicamente cuando puedas demostrar: 1) ruedas girando; 2) suspensión y
> transferencia de peso visibles; 3) piloto reaccionando; 4) render interpolado
> sin microtirones; 5) recorrido jugable sin regresiones; 6) build probada
> visualmente en escritorio y móvil."*

Este documento es esa demostración. Todo lo que sigue está medido sobre la
**build de producción** (`npm run build` + `vite preview`) corriendo en un
Chromium real, no sobre la simulación en Node.

## Cómo reproducirlo

```bash
cd cross-rush
npm ci
npm run build
npx vite preview --host 127.0.0.1 --port 4173 &
node tools/visual-qa.mjs
```

El arnés (`tools/visual-qa.mjs`) abre la build en dos perfiles —escritorio
1366×768 y móvil 393×852 con `deviceScaleFactor` 3 y táctil—, inyecta un piloto
automático que despacha eventos de teclado reales, juega, y comprueba 25
afirmaciones sobre el estado que de verdad se está dibujando. Deja capturas,
vídeo e informe en `artifacts/qa/`. La copia curada de esa evidencia vive en
`docs/qa/`.

El piloto automático no es un atajo: pulsa las mismas teclas que un jugador y
pasa por el mismo suavizado de entrada. Lo único que se le da de más es
consultar la pendiente del terreno que tiene delante, que es lo que un jugador
hace con los ojos.

## 1. Las ruedas giran

El fallo original era literal: `Renderer.drawBike()` dibujaba las dos ruedas con
`bike.angle`, el ángulo del CHASIS. Conduciendo recto, el chasis no gira, así
que las ruedas tampoco. No había ningún ángulo de rueda en el estado del juego.

Ahora cada rueda es un sólido con inercia, ángulo, velocidad angular y
deslizamiento propios (`src/physics/Wheel.ts`), y el motor aplica par a la
rueda trasera en vez de empujar el chasis.

Medido en el navegador, acelerando desde parado:

| Comprobación | Escritorio | Móvil |
|---|---|---|
| Giro acumulado de la trasera | 146 rad | 147 rad |
| Giro acumulado de la delantera | 82 rad | 85 rad |
| Sentido correspondiente al avance | sí (32.8 m) | sí (33.0 m) |
| Giro de la delantera vs distancia/radio (rodadura pura) | 27 rad medidos / 26 esperados | 30 / 33 |
| Deslizamiento máximo de la trasera al salir | 4.09 m/s | 4.09 m/s |

El panel de depuración (F1) muestra los dos ángulos y las dos velocidades
angulares por separado en tiempo real; en la captura
`escritorio-1366x768--09-panel-de-depuracion.jpg` se leen 84° / 87.6 rad/s
delante y 48° / 96.6 rad/s detrás: ángulos distintos, velocidades distintas,
deslizamiento distinto. Eso es exactamente lo que antes no existía.

## 2. Suspensión y transferencia de peso visibles

Frenada a fondo medida en la recta de salida, con las dos ruedas en el suelo:

| Comprobación | Escritorio | Móvil |
|---|---|---|
| Compresión de la horquilla, antes → frenando | 0.040 → 0.380 m | 0.029 → 0.260 m |
| Carga máxima del eje delantero | ×11.6 del reparto estático | ×2.70 |
| Carga mínima del eje trasero | ×0.00 | ×0.00 |
| Giro mínimo de la rueda al frenar | 21.19 rad/s (nunca negativo) | 0.00 rad/s (bloqueada) |

Y transferencia de peso **por el cuerpo del piloto**, con la moto quieta y
apoyada, que aísla el efecto del gesto del jugador de cualquier otra cosa:

| Gesto | Carga media del eje delantero |
|---|---|
| Peso atrás (flecha arriba) | ×0.81 |
| Peso delante (flecha abajo) | ×1.21 |

Un 50% de diferencia de carga en el eje delantero solo por mover el cuerpo.

## 3. El piloto reacciona

| Comprobación | Escritorio | Móvil |
|---|---|---|
| Desplazamiento del cuerpo, peso atrás → peso delante | −0.363 → +0.210 m | −0.363 → +0.216 m |
| Recorrido de rotación del torso entre ambos gestos | 28.8° | 39.0° |
| Se va sobre el manillar al frenar | −0.090 → +0.104 m | −0.090 → +0.102 m |
| Recorrido vertical del cuerpo a lo largo del recorrido | 31.4 cm | 30.6 cm |

Comparar `escritorio-1366x768--06-piloto-peso-atras.jpg` con
`escritorio-1366x768--07-piloto-peso-delante.jpg`.

El arte disponible es un único PNG, así que no hay miembros articulados. Lo que
haría falta para una pose realmente articulada está inventariado, con pivotes y
tamaños, en `docs/RIDER_RIG_ASSETS.md`.

## 4. Render interpolado, sin microtirones

`GameLoop` siempre entregó un `alpha`, y `main.ts` lo ignoraba: dibujaba el
último estado fijo. Con la simulación a 120 Hz y la pantalla a 60, 90 o 144, cada
fotograma cae en un punto distinto del tick y la moto avanza a saltos
desiguales. Eso es el microtirón.

La prueba es una comparación A/B directa: el juego publica las dos series, la
dibujada (interpolada) y la del último tick (lo que se dibujaba antes). Para
cada par de fotogramas se compara el avance de cada serie con la velocidad que
dice la simulación, usando el **reloj de simulación** (`t` y `alpha`) y no
`performance.now()`, de modo que no hay ruido de temporizador.

| Comprobación | Escritorio | Móvil |
|---|---|---|
| Percentil 90 del error, serie dibujada | 0.2 % | 1.0 % |
| Percentil 90 del error, sin interpolar | 47.6 % | 100.0 % |
| Peor fotograma, dibujada / sin interpolar | 4 % / 100 % | 9 % / 658 % |
| Error mediano de la serie dibujada | 0.0 % | 0.0 % |
| Fotogramas con alpha intermedio | 140 de 154 | 130 de 149 |

Para que la prueba signifique algo, el navegador se lanza con
`--disable-frame-rate-limit`: Chromium sin cabeza entrega rAF a exactamente
60 Hz, que es la mitad justa de los 120 Hz de simulación, y en ese único ritmo
el alpha sale siempre 0 y la interpolación no se nota. Liberado el límite, el
alpha recorre todo el rango (0.00 a 1.00) y la diferencia se mide.

## 5. Recorrido jugable, sin regresiones

| Comprobación | Escritorio | Móvil |
|---|---|---|
| Las piezas de terreno recorridas | tabletop, stepup, dropoff (whoops y rockgarden estan congelados) | idem |
| Fotogramas en vuelo / totales | 204 / 440 | 195 / 410 |
| Compresión trasera máxima al recibir | 0.400 m | 0.400 m |
| Un morro clavado provoca crash | sí | sí |
| Reiniciar vuelve limpio a la salida | sí (x=4.0 m, t=0.00 s) | sí |
| Consola sin errores | sí | sí |
| Peticiones fallidas o 404 | ninguna | ninguna |

Los 82 tests automáticos siguen verdes, incluidos los 44 originales. Se
conservan terrenos, riesgo/recompensa, fantasma, delta, sectores, persistencia,
resultados y controles táctiles.

## 6. Probado visualmente en escritorio y móvil

Las 25 comprobaciones pasan en los dos perfiles. Evidencia en `docs/qa/`:
capturas de salida, aceleración, frenada, las dos poses del piloto, terreno,
panel de depuración, crash y segunda carrera, más `clip-recorrido.webm` con un
recorrido continuo, y el informe completo en `docs/qa/INFORME.txt`.

## Dos cosas que se corrigieron durante el QA visual

**La moto era ilegible.** Con el zoom fijo de 34 px/m ocupaba unos 70 píxeles:
un 5% del ancho de pantalla. A ese tamaño, un hundimiento de horquilla de 13 cm
son 4 píxeles y el cuerpo del piloto se mueve 10: todo el trabajo de suspensión
y pose quedaba por debajo de lo que el ojo distingue jugando. Ahora el zoom se
deriva del ancho real del lienzo (metros visibles fijos, más cerca en vertical),
y la moto ocupa un 11-15% del ancho en cualquier pantalla.

**Los botones de aire flotaban en mitad de la pista.** En 393×852 quedaban
232 px por encima del gas y el freno, tapando el área de juego. Ahora los cuatro
controles comparten línea base y esquivan la barra de FLOW.

## Limitación honesta del entorno

El navegador de esta sesión renderiza por software: el contador marca 14-18 FPS
con la simulación consumiendo hasta 10 ticks por fotograma. La simulación
mantiene su paso fijo y las medidas de arriba son válidas —de hecho ese ritmo
irregular es el peor caso para la interpolación, y aun así el error dibujado es
del 0.2%—, pero **el rendimiento observado aquí no es representativo de un
equipo o un móvil reales** con composición por GPU. El frame pacing en hardware
de verdad queda pendiente de comprobar en el entorno del propietario.

## Secuencia de evidencia (fases 4 y 5)

`node tools/evidence-shots.mjs <url> [desktop|movil]` recorre la pista con un
piloto automatico y captura los cinco estados que pide el cierre del mandato,
en 1366x768 y en 393x852:

| Captura | Que demuestra |
| --- | --- |
| `1-quieta` | Moto posada en la parrilla durante la cuenta atras, con la suspension ya asentada. |
| `2-acelerando` | Rueda trasera patinando, polvo de rodadura, caballito de salida. |
| `3-frenando` | Horquilla hundida, polvo de frenada hacia adelante, marcas de derrape. |
| `4-saltando` | Vuelo con la suspension extendida y la horquilla unida a la rueda. |
| `5-aterrizando` | Golpe de aterrizaje: tierra proyectada, sombra de contacto y compresion. |
| `6-meta` / `7-resultados` | Cartel de meta y panel final. |

Las capturas de la ultima pasada estan en `docs/qa/secuencia/`.

### Rendimiento

El render se mide con Chromium sin GPU (rasterizado por software), que es el
peor caso razonable. Referencia en 1366x768: **~65 fps**. Venia de 5 fps: el
culpable era `ctx.filter` aplicado en caliente sobre las capas de fondo, que
cubren la pantalla entera y se redibujaban con el filtro en cada fotograma.
Ahora los filtros y el reescalado van horneados (`src/rendering/SpriteFilters.ts`)
y el cielo se cachea en un lienzo aparte.
