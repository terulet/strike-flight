# Protocolo de la alfa privada · 7 días

El objetivo de esta semana **no** es que guste. Es contestar a una pregunta:

> ¿Vuelve la gente sola, y vuelve por lo que hace otro?

Si la respuesta es sí, el M4 es construir sobre esto. Si es no, mejor saberlo
ahora que después de meter veinte minijuegos.

---

## Regla número uno: features congeladas

**Del día 1 al día 7 no se añade ni un minijuego, ni un mutador, ni una
mecánica.** Está escrito aparte en [CONGELADO.md](CONGELADO.md) y va en serio.

El motivo no es pereza: si a mitad de semana aparece contenido nuevo, la
subida de actividad del día siguiente ya no significa nada. No se sabría si
volvieron por el pique o por la novedad, que es justo lo único que queremos
distinguir. Una semana con el juego quieto vale más que dos con el juego
cambiando.

Sí se arregla: **cualquier cosa que impida jugar**. Un fallo que bloquee una
partida, una marca que no suba, la app que no abre. Eso se arregla el mismo
día y se anota en el diario, porque afecta a los datos.

## Los cinco

Cinco personas, un grupo, siete días. Ni más ni menos:

- Con menos de cuatro no hay ranking que pique.
- Con más de ocho no cabe (el grupo tiene tope) y encima se diluye.
- Todos tienen que conocerse entre sí. El pique es con gente de verdad; con
  desconocidos esto mide otra cosa distinta.

Lo que hay que decirles, literalmente, y nada más:

> "Es un reto diario de tres microjuegos, muy corto. Tres intentos por reto.
> Estamos los cinco en el mismo ranking. Juega cuando te apetezca, y si no te
> apetece, no juegues: eso también es un dato."

Lo que **no** hay que decirles:

- Que hay métricas mirando (cambiaría cómo juegan).
- Que hay que jugar todos los días. Si hay que pedirlo, ya está respondida la
  pregunta.
- Ninguna recordatorio por WhatsApp del tipo "¿has jugado hoy?". Ese mensaje
  destruye el experimento: se mide la retención orgánica, no la insistencia.

## Día 0 · Preparación

1. Desplegar según [DESPLIEGUE.md](DESPLIEGUE.md) y comprobar que la URL abre
   desde fuera de casa, con datos móviles.
2. Hacer la prueba real de dos redes (paso 5 del runbook). **Sin esto no se
   empieza.**
3. Crear el grupo desde tu móvil y anotar el código.
4. Instalar en la pantalla de inicio en tu iPhone y comprobar que abre a
   pantalla completa.
5. Guardar una copia de la base de datos vacía: es el punto cero.
6. Mandar a los cuatro: la URL, el código, y cómo añadirlo a la pantalla de
   inicio. Nada más.

## Los siete días

Cada día, **una sola cosa por tu parte**: entrar una vez en `?dashboard` y
apuntar cuatro números en el diario de abajo. Tarda un minuto. No hace falta
mirarlo cinco veces al día, y de hecho es mejor que no.

| Día | Qué mirar de cerca |
|---|---|
| 1 | Que entren los cinco y que nadie se atasque. Novedad pura: los datos de hoy no dicen nada del futuro. |
| 2 | **El día más importante.** El D1 de hoy es el primer dato honesto: ¿quién volvió sin que nadie se lo pidiera? |
| 3 | Que empiecen los adelantamientos. Aquí es donde el Revenge Rate empieza a significar algo. |
| 4 | El aburrimiento, si lo hay, aparece hoy. Mirar si alguien se queda en 1/3 intentos. |
| 5 | ¿Hay algún juego que la gente evita? Si uno se juega mucho menos, es un dato sobre ese juego, no sobre el jugador. |
| 6 | Organic Reopen: ¿alguien vuelve por segunda vez en el mismo día? Es la señal más fuerte de todas. |
| 7 | Cuántos siguen jugando sin que nadie haya dicho nada en toda la semana. |

## El diario

Copiar esta tabla y rellenarla cada día. A mano, en un minuto, mirando el
dashboard:

```
DÍA │ JUGARON │ COMPLETAN │ REVENGE │ REOPEN │ QUÉ HA PASADO HOY
────┼─────────┼───────────┼─────────┼────────┼──────────────────────────────
 1  │   /5    │     %     │    %    │   %    │
 2  │   /5    │     %     │    %    │   %    │
 3  │   /5    │     %     │    %    │   %    │
 4  │   /5    │     %     │    %    │   %    │
 5  │   /5    │     %     │    %    │   %    │
 6  │   /5    │     %     │    %    │   %    │
 7  │   /5    │     %     │    %    │   %    │
```

La última columna es la importante y no sale en ningún dashboard: si alguien
comenta algo en persona, si se pica una conversación en el grupo de WhatsApp,
si alguien se queja de un juego. Eso explica los números.

## Qué significa cada número

Todos salen de `?dashboard`. Ninguno se calcula a mano.

**1. Retención D1** — de los que entraron un día, cuántos volvieron **al día
siguiente exacto**. Es la métrica más dura y la más honesta: mide el hábito.

**2. Retención D3 y D7** — lo mismo a tres y siete días. D7 con cinco personas
es un dato frágil: no se puede leer como un porcentaje serio, se lee como
"cuántos de los cinco siguen aquí".

**3. Revenge Rate** ⭐ — de todas las veces que se ofreció una revancha,
cuántas se pulsaron. **Es el KPI estrella.** Mide directamente si perder
contra un amigo produce ganas de responder, que es toda la tesis del producto.

**4. Intentos usados** — el reparto entre 1/3 y 3/3. Si casi todos se quedan
en 1, el sistema de tres intentos no está haciendo nada y sobra. Si muchos
llegan a 3, es que aprieta.

**5. Reto diario completado** — de los que abren, cuántos terminan los tres.
Si es bajo, o los retos son largos o el tercero aburre.

**6. Organic Reopen Rate** ⭐ — de las sesiones ya terminadas, en cuántas el
jugador **volvió a abrir la app ese mismo día**, habiendo jugado un rival por
en medio. Traducido: *"a ver si ese cabrón me ha vuelto a pasar"*.

Es la métrica que separa un juego social de un solitario con marcador. Si el
Revenge Rate dice que responden cuando están dentro, esto dice si **vuelven
desde fuera**. Es la más difícil de conseguir y la más valiosa.

> Honestidad sobre esta métrica: mide correlación, no intención. Nadie ha
> dicho por qué volvió. Lo que sí distingue con precisión es "volvió con el
> ranking movido" de "volvió sin que nadie hubiera tocado nada", que es
> exactamente la distinción que interesa.

## Cómo leerlo el día 8

**Con cinco personas y siete días, ninguna cifra es estadísticamente
significativa.** Un 60% son tres personas. Esto no es un experimento, es una
señal. Se lee como se lee una señal: mirando la dirección, no el decimal.

Señales de que hay algo:

- Tres o más de los cinco siguen jugando el día 7 sin que nadie se lo haya
  pedido.
- El Revenge Rate está por encima del 40%. Que uno de cada tres piques acabe
  en partida es mucho.
- El Organic Reopen Rate no es cero. Aunque sea el 10%: significa que alguien
  cerró la app, y volvió, por otra persona. Eso no se compra con contenido.

Señales de que no:

- La retención D1 se desploma después del día 2 y no se recupera.
- Nadie pulsa REVANCHA aunque se ofrezca. Si el pique no convierte con cinco
  amigos, no va a convertir con desconocidos.
- Organic Reopen 0% toda la semana: cada uno cumple su ratito y se va. Es un
  solitario con marcador, y entonces el ranking sobra.

Señal ambigua, que es la más probable:

- Dos o tres siguen enganchados, dos se han caído. Entonces la pregunta pasa a
  ser **qué tienen en común los que siguen**, y eso se contesta hablando con
  ellos, no mirando el dashboard.

## Al terminar

1. Copia de la base de datos, guardada aparte y con la fecha.
2. Captura del dashboard del día 7.
3. Hablar cinco minutos con cada uno. Una sola pregunta, sin dirigir:
   *"¿qué te hacía abrirlo?"*. Y si dejó de abrirlo, *"¿cuándo dejaste de
   abrirlo?"* — la respuesta suele ser un día concreto y un motivo concreto.
4. Con eso y el diario, decidir el M4. Y solo entonces descongelar.

---

**El error a evitar**: llegar al día 4 con datos flojos y meter contenido
nuevo para animar la cosa. Eso convierte una semana de medición en una semana
de nada. Si sale mal, sale mal, y esa respuesta vale exactamente lo mismo que
la buena — de hecho vale más, porque llega antes.
