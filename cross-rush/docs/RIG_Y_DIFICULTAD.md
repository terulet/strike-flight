# Moto, piloto y banco de dificultad

Informe del pase de produccion sobre el ensamblaje de la moto, el rig del
piloto, sus animaciones y el sistema automatico de medicion de dificultad.

## 0. Discrepancia de base, antes que nada

El mandato daba por existentes cosas que **no estan en este repositorio**. Se
comprobo antes de editar una sola linea:

| lo que el mandato asume | estado real |
| --- | --- |
| commit `a84ce40` | no existe (`git cat-file` falla) |
| M02 LA CANTERA VIVA | no existe en ninguna de las 17 ramas remotas ni en ningun commit de la historia |
| `MissionRegistry.ts`, `TrackDefinition.ts`, `LaCanteraViva.ts`, `MissionEventDirector.ts`, `QuarryBlockout.ts` | no existen |
| `?mission=1` / `?mission=2`, `?autoplay=1` | no implementados |
| persistencia por mision, persistencia de QA separada | no implementadas |
| `src/tools/rigCheck.ts` | SI existe |
| 108 pruebas minimo | habia 116 |

Decision tomada y documentada: **no se inventa M02**. El propio mandato
prohibe disenar misiones -son propiedad de Codex- asi que se hizo todo lo que
si es de este ambito (moto, piloto, rig, animaciones, banco de dificultad) y se
dejaron preparadas las COSTURAS para que M02 enchufe sin retrabajo:

- La persistencia ya esta separada por mision y por origen (ver seccion 5).
- El banco de dificultad es agnostico del trazado: recibe cualquier
  `TrackDefinition` y no conoce ninguna mision por nombre.
- Las reglas de conduccion de los pilotos son geometricas -leen el terreno- y
  no listas de sitios, asi que valen para un trazado que aun no existe.

## 1. El defecto que reporto el usuario

> "El piloto parece pegado a la moto. Cuando se levanta la rueda, el piloto se
> mueve sin acompanar correctamente a la moto."

Se midio antes de tocar nada, sobre las dieciseis poses canonicas:

| pose | mano-manillar | pie-estribera | torso/chasis | cadera |
| --- | --- | --- | --- | --- |
| CABALLITO SUAVE | 10,9 cm | 0,0 cm | 1,03 | 25 cm |
| **CABALLITO FUERTE** | **29,2 cm** | **9,6 cm** | **1,25** | **37 cm** |
| RECEPCION FUERTE | 1,8 cm | 0,0 cm | 1,00 | 27 cm |
| (9 poses mas) | | | 1,00 | |

Tres defectos, y ninguno era el que parecia:

1. **La cinematica inversa se rendia.** Cuando la cadena no alcanzaba el
   agarre, estiraba el brazo del todo y lo dejaba apuntando al puno desde
   lejos. Eso es literalmente "el piloto se mueve sin acompanar a la moto".
2. **El torso copiaba el 100% del cabeceo del chasis** -y en caballito hasta
   el 125%, o sea que giraba MAS que la moto-. Por eso se leia como una
   pegatina.
3. **La cadera recorria 37 cm** y llegaba a x = -0,58, veintitres centimetros
   por detras del final del asiento: sentada sobre la rueda trasera.

## 2. Lo que se cambio

### La cadera se recoloca; la extremidad no se suelta

Es el arreglo de fondo. El orden es el que pide el mandato: primero se recorta
la cadera a la envolvente del asiento, y despues se recoloca hasta que las dos
cadenas alcanzan sus agarres.

Cada cadena de dos huesos solo llega a su agarre si la cadera esta dentro de
una corona circular alrededor de el. Con dos cadenas son dos coronas, y la
cadera tiene que caer en la interseccion; se resuelve con proyecciones
alternas. El resultado es que **desconectar una mano deja de ser una opcion**:
lo que cede es el recorrido del cuerpo, que se ve infinitamente mejor.

### El torso conserva parte de su orientacion

`TORSO_CHASSIS_FOLLOW = 0,62`. No es cero a proposito: un piloto desacoplado
del todo parece flotar al lado de la moto en vez de ir montado en ella. Con
0,62 el cuerpo acompana claramente pero la cabeza mantiene la vista donde va,
que es lo que hace una persona.

### Resultado medido

| | antes | ahora |
| --- | --- | --- |
| mano-manillar, peor pose | 29,2 cm | **0,0 cm** |
| pie-estribera, peor pose | 9,6 cm | **0,0 cm** |
| torso/chasis | 1,00 a 1,25 | 0,62 a 0,87 |
| recorrido de cadera, peor pose | 37 cm | 21 cm |
| codo estirado del todo (180 grados) | 4 poses | ninguna |

Evidencia: `docs/qa/rig/caballito-antes-despues.jpg` (mismas poses, rig
antiguo y rig nuevo) y `docs/qa/rig/banco-16-poses.jpg`.

### El banco de poses ahora prueba el sistema real

Las poses del banco eran estados ESCRITOS A MANO: cada una traia su
`rider: { shiftX: -0.28, torsoAngle: 0.24 }` teclado por alguien. El banco
dibujaba una postura inventada, asi que podia estar en verde con el sistema de
pose completamente roto.

Ahora cada pose describe una SITUACION FISICA y la postura se resuelve con
`riderPoseTargets`, el mismo codigo que corre en partida
(`src/tools/RigPoseCatalog.ts`). El catalogo lo comparten el banco visual y las
pruebas, asi que no pueden desincronizarse.

## 3. El banco de dificultad

`src/tools/DifficultyBench.ts`, sin navegador. `npm run bench`.

Los tres pilotos conducen por las mismas entradas publicas que un jugador -gas,
freno, inclinar, turbo, reiniciar- y nada mas. No se teletransporta la moto, no
se tocan colisiones ni gravedad, no se regala velocidad, no se cambia la pista
segun el piloto, no se reproduce una trayectoria grabada y no se marca un
aterrizaje como bueno sin que ocurra.

No se diferencian por tener numeros mas altos, sino por ESTRATEGIA:

| | mira adelante | reaccion | turbo | lineas |
| --- | --- | --- | --- | --- |
| descuidado | no mira | 0,34 s | no lo usa | entra a todo a fondo |
| competente | 0,30 s | 0,16 s | lo gasta, lo suelta a 90 m del salto | rueda los huecos rodables, levanta el pie en bajadas |
| perfecto | 0,36 s | cada tick | lo guarda para los 60 m del salto grande | se compromete siempre |

La semilla solo mueve al piloto (momento de reaccion y error de punteria). El
mundo no cambia nunca, y por eso una tasa de finalizacion significa algo. Hay
una prueba que lo vigila: el piloto perfecto no tiene ruido, asi que sus ocho
semillas tienen que dar el MISMO tiempo al microsegundo.

### Resultado sobre M01 CANYON RUN, 8 semillas por perfil

| perfil | llega | t. medio | cadena | turbos | linea RUSH | err. angulo | P/G/R/B/C |
| --- | --- | --- | --- | --- | --- | --- | --- |
| descuidado | 0% | - | 2,0 | 0,0 | 0% | 17,9 grados | 24/32/48/8/8 |
| competente | 63% | 61,9 s | 3,0 | 3,6 | 50% | 11,1 grados | 60/95/86/26/3 |
| perfecto | 100% | 58,7 s | 6,0 | 1,0 | 100% | 6,9 grados | 120/64/112/8/0 |

El descuidado pierde siempre por lo mismo y el informe lo dice: *"aterrizo
cruzado (79 grados), tras RHYTHM"*.

## 4. Dos objetivos del mandato que M01 NO cumple

Se reportan en vez de maquillarse, y hay una prueba que los fija para que no se
degraden en silencio.

**El competente se queda en el 63%, no en el 80%.** El cuello de botella esta
localizado: TODAS las carreras que pierde caen en `RISK_LINE_JUMP`. Se barrio
el parametro de decision del piloto (zona muerta 0,32 / 0,4 / 0,5 y reaccion
0,12 / 0,16) y el mejor resultado posible es ese 63%: **no es calibracion del
bot, es el obstaculo**. La linea "segura" de ese hueco -aterrizar dentro del
valle- no es superable de forma consistente por un piloto medio, y frenar
delante no ayuda porque hay un kicker de 2,6 m antes: te tira igual, pero sin
velocidad.

No se toca desde aqui: el mandato prohibe expresamente cambiar la geometria de
una mision para que aprueben los pilotos automaticos, y hacerlo seria el
autoengano que este banco existe para evitar. **Es una decision de quien tenga
la propiedad del trazado.**

**El perfecto solo es un 5,2% mas rapido que el competente, no un 8-15%.** La
causa es estructural y conviene decirla: con el gas siempre abierto y sin
curvas, la duracion de la vuelta la manda sobre todo el trazado. El eje donde
si se expresa la habilidad en este juego es la PUNTUACION -el piloto perfecto
casi dobla la del competente- y la cadena (6,0 contra 3,0). Subir la diferencia
de tiempo pediria una mecanica que hoy no existe: gestion de velocidad con
riesgo, atajos, o penalizacion de tiempo por error.

## 5. Persistencia separada por mision y por origen

Las claves eran dos constantes globales. Ahora son
`cross-rush:<mision>:best-time` para el jugador y `cross-rush:qa:<mision>:...`
para las pasadas automaticas.

Dos problemas que eso evita, y que se verian el primer dia que exista M02:

- Dos misiones compartirian record y fantasma, asi que el fantasma de una se
  dibujaria en la otra y el delta compararia tiempos de trazados distintos.
- Una pasada de QA machacaria el record del jugador.

El banco de dificultad no usa ninguno de los dos ambitos: corre con
`persistence.store = false`, o sea que **ni lee ni escribe nada**. Es la unica
garantia solida de que un bot no toca la marca de una persona, y hay una
prueba que lo comprueba dejando un record falso en el almacenamiento y
verificando que sigue intacto tras ocho carreras automaticas.

## 6. Un bloqueo real que encontro el banco

Cayendo dentro del valle de la linea de riesgo a poca velocidad, la moto no
tiene con que remontar la pared y se queda ahi. No choca -no hay impacto, ni
angulo malo, ni trompo- asi que el juego no la declaraba caida, pero tampoco
avanzaba: **la carrera se quedaba colgada**. Medido: 180 segundos parada en el
metro 739 de 1032, con el gas pulsado todo el rato.

Ahora un atasco termina la vuelta igual que un choque (3,5 s sin avanzar 1,2 m
con la moto apoyada), porque para el jugador es lo mismo -no puede seguir- y
asi puede reiniciar en vez de mirar una pantalla que no cambia.

## 7. Lo que sigue necesitando ojo humano

1. **La decision sobre `RISK_LINE_JUMP`.** El numero y la causa estan; la
   decision de trazado no es de este ambito.
2. **Si el 0,62 del torso es el valor correcto.** Es el que mejor se lee en el
   banco, pero la sensacion de "montado" es un juicio y un test no lo sustituye.
3. **El descuidado al 0%.** Cumple el objetivo (por debajo del 40%) pero por un
   margen enorme. Puede ser correcto -no hacer nada en el aire deberia costar
   la carrera- o puede indicar que el juego no perdona ni un fallo al que
   empieza. Hace falta jugarlo.
4. **La escala del error de punteria del competente.** 11,1 grados de media es
   una eleccion de modelo, no una medida de un humano real.
