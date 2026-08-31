# MANDATO OFICIAL — CROSSRUSH: BIKE FEEL REBUILD

## 1. Veredicto del propietario

Eloi ha probado el juego y lo rechaza en su estado actual:

> “La moto se mueve como un robot, las ruedas ni se mueven; en general el juego está muy mal.”

Esto es un veto de producto. No respondas con que los tests pasan ni con retoques cosméticos. Debes reconstruir el movimiento y la presentación de la moto hasta que se sienta como un juego arcade de motocross, no como un sprite rígido desplazándose sobre un perfil.

## 2. Diagnóstico confirmado en el código

1. **Las ruedas no giran.** `Renderer.drawBike()` dibuja `wheelRear` y `wheelFront` usando `bike.angle`. `BikeState` no contiene ángulo ni velocidad angular de ruedas.
2. **No existe drivetrain visual/físico.** El gas aplica fuerza directamente al chasis. No hay RPM, wheel omega, slip, frenada de rueda ni rueda libre en el aire.
3. **El render no interpola.** `GameLoop` entrega `alpha`, pero `main.ts` ignora el argumento y renderiza directamente el último estado fijo. Esto produce microtirones y rigidez perceptible.
4. **El piloto es completamente rígido.** Un único PNG queda atornillado al asiento con el mismo ángulo del chasis. No anticipa, absorbe, transfiere peso ni reacciona a compresión, frenada, aceleración o vuelo.
5. **El control en suelo tiene muy poca agencia corporal.** `lean` solo actúa realmente en el aire; en suelo manda el par de suspensión y un autonivelado. El usuario no siente que lleva una moto.
6. **Suspensión demasiado abstracta.** Calcula compresión con distancia vertical `anchorY-groundY`, aunque el eje visual de horquilla rota con el chasis. No hay masa no suspendida ni velocidad propia de rueda.
7. **Contacto aproximado.** El terreno se muestrea bajo la X del anclaje, no mediante una búsqueda coherente de contacto del neumático/horquilla. Puede causar deslizamiento o saltos visuales.
8. **Cámara nerviosa, no orgánica.** El shake usa `Math.random()` nuevo en cada frame. Eso genera vibración digital, no una onda amortiguada.
9. **Audio desconectado de la moto.** El motor depende básicamente de velocidad horizontal, no de gas, carga, RPM o rueda trasera.
10. **El sprite del terreno se estira al intervalo físico.** Hay que revisar visualmente que tabletop, step-up, drop-off, whoops y rockgarden coincidan con la cresta real y no parezcan decoraciones pegadas.

## 3. Objetivo de sensación

Arcade inmediato y controlable, inspirado en motocross lateral moderno, sin copiar ningún juego concreto:

- arranque con transferencia de peso y suspensión viva;
- ruedas que giran de forma inequívoca;
- neumático trasero que acelera y puede patinar visualmente;
- frenada que carga la horquilla;
- chasis con masa y rebote, sin parecer una tabla;
- piloto que se inclina y absorbe, aunque se reutilice el arte actual;
- despegue legible, vuelo controlable y recepción suave;
- cámara con seguimiento continuo y shake amortiguado;
- respuesta consistente a 30, 60 y 120 Hz de render.

## 4. Implementación mínima obligatoria

### A. Estado de ruedas

Añade al estado o a un estado visual determinista:

- `frontWheelAngle`, `rearWheelAngle`;
- `frontWheelAngularVelocity`, `rearWheelAngularVelocity`;
- integración estable y normalización de ángulo;
- en contacto: velocidad objetivo aproximada `v_tangent / wheelRadius`;
- en aire: conservación con drag; gas hace girar la trasera;
- freno reduce omega; permite diferencia de slip limitada y visible;
- el render suma el giro propio de cada rueda al ángulo base de la moto.

Las ruedas deben mostrar giro incluso a velocidad constante y su sentido debe corresponder al avance.

### B. Interpolación real

- Conserva estado previo y actual por tick.
- Usa el `alpha` de `GameLoop.render(alpha)` para interpolar `x`, `y`, ángulo con camino corto, suspensiones y ruedas.
- Cámara y sprites deben consumir el estado interpolado.
- Añade pruebas que demuestren que alpha 0, 0.5 y 1 producen estados coherentes.

### C. Weight transfer y control

- Suaviza el input hacia un objetivo continuo; no conviertas cada pulsación en un salto binario brusco.
- En suelo, el lean del jugador debe desplazar el centro de masa/torque de forma acotada.
- Aceleración carga la rueda trasera; frenada carga la delantera.
- Permite preload ligero antes de una rampa sin crear un simulador difícil.
- Mantén asistencias arcade, pero que ayuden al jugador y no conduzcan por él.

### D. Piloto con vida

Con el arte existente, como mínimo:

- offset y rotación de torso/piloto independientes del chasis;
- pose derivada de lean, aceleración/freno, compresión media, velocidad vertical y estado airborne;
- smoothing/segunda orden para evitar cambios instantáneos;
- absorción visible al aterrizar y extensión al despegar.

Si el PNG único impide un resultado convincente, documenta exactamente qué piezas separadas se necesitan (torso/cabeza, brazos, piernas) con pivotes y tamaños. No inventes un collage: 1 asset = 1 archivo.

### E. Cámara y feedback

- Sustituye el shake aleatorio por impulso amortiguado con fase/ruido suave determinista.
- Añade look-ahead estable y dead-zone vertical pequeña.
- Vincula sonido del motor a throttle + carga + RPM estimada, no solo a `vx`.
- Polvo y skid deben corresponder a contacto/slip real.

## 5. No romper

- Los cinco terrenos físicos y sus PNG independientes.
- Riesgo/recompensa: speed pad, alt ramp, bump gate, risk gap y flow ring.
- Ghost del récord, delta en vivo y cuatro sectores.
- Persistencia de récord, pantalla de resultados y controles táctiles.
- Paso fijo de física y protección contra NaN/Infinity.
- Regla visual PLAYZONE: **1 asset = 1 archivo independiente**.

## 6. Pruebas obligatorias nuevas

- giro de rueda proporcional a distancia en llano;
- rueda trasera gira en el aire con gas y conserva inercia;
- freno reduce omega sin invertirla artificialmente;
- interpolación de posición, chasis, rueda y ángulo cruzando ±π;
- weight transfer cambia carga/compresión del eje correcto;
- misma simulación lógica bajo patrones de render 30/60/120 Hz;
- recorrido de fuzz sin NaN/Infinity;
- primera secuencia tabletop → step-up → drop-off → whoops → rockgarden superable;
- ghost sigue sincronizado tras ampliar `BikeState`.

## 7. QA visual obligatorio

Validar la build real, no solo inspeccionar código:

- escritorio 1366×768;
- móvil 393×852;
- salida desde parado;
- aceleración y frenada visibles;
- tabletop, step-up, drop-off, whoops y rockgarden;
- salto, corrección aérea y aterrizaje;
- crash y restart;
- segunda carrera con ghost y delta;
- consola sin errores, assets sin 404 y frame pacing estable.

Graba o entrega capturas/clip corto donde se vea claramente el giro de las ruedas y la reacción del piloto.

## 8. Criterio de cierre

No cierres con “tests verdes”. Cierra únicamente cuando puedas demostrar:

1. ruedas girando;
2. suspensión y transferencia de peso visibles;
3. piloto reaccionando;
4. render interpolado sin microtirones;
5. recorrido jugable sin regresiones;
6. build probada visualmente en escritorio y móvil.

Al terminar: tests, typecheck, build, commit limpio y push a `claude/cross-rush-prototype-nn1jrv`. No desplegar ni tocar `main` sin autorización expresa.
