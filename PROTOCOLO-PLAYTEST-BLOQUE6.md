# Flight Strike — Protocolo de playtest, Bloque 6

El KPI de este bloque no es "¿se puede terminar?" (eso ya lo mide la
regresión automática). Es **"¿quieres volver a jugar?"** — algo que
solo puede responder una persona jugando.

## Cómo correr una sesión

1. Arranca el servidor de red local: `node herramientas/servir.mjs`
   (ver `LEEME-IPAD.md` / la sección de comandos del informe final
   para el paso a paso completo).
2. El tester juega **una campaña de 20-30 minutos**, sin que nadie le
   explique los sistemas nuevos de antemano — si hace falta explicar
   qué es un jackpot, el jackpot no se está explicando solo en
   pantalla, que es el objetivo.
3. Al terminar (o al parar, si abandona antes), estas ocho preguntas,
   en este orden, respondidas por el tester SOLO — sin que quien
   pregunta sugiera la respuesta:

## Las ocho preguntas

1. **¿Quieres jugar otra?** (sí / no / no sé) — la que de verdad
   importa. Las otras siete existen para explicar el porqué de ésta.
2. **¿En qué momento te aburriste?** (si en ninguno, decirlo) — un
   hueco muerto real que el Rhythm Director no cazó, o un tramo que sí
   detectó pero que en carne y hueso se sigue sintiendo largo.
3. **¿Qué momento fue el más divertido?** — el candidato a "por esto
   vuelvo".
4. **¿Notaste tus upgrades?** — si no se nota tener TRIPLE SHOT puesto,
   la tarjeta no está comunicando lo que hace.
5. **¿Usaste Overdrive?** — si la barra se llenó y no lo activó, o no
   se dio cuenta de que estaba llena, es un fallo de lectura del HUD,
   no del jugador.
6. **¿Intentaste mantener combo?** — si el combo no pesa en la
   decisión de a qué disparar primero, no es protagonista, es un
   número más.
7. **¿Te importó el rank?** — si terminó la misión y ni miró la letra,
   REJUGABILIDAD no está funcionando todavía.
8. **¿Viste algo que quisieras desbloquear o mejorar?** — evolución
   vista pero no conseguida, chasis, skin: cualquier "la próxima quiero
   intentar X" cuenta como un sí.

## Qué hacer con las respuestas

No se puntúan. Se anotan tal cual, con la hora y la misión en la que
pasó cada cosa mencionada. Un "me aburrí en el minuto 4 de la M3" es
información accionable para el Rhythm Director; un "sí, quiero jugar
otra" sin más detalle no lo es tanto — si sale eso, repreguntar UNA vez
"¿qué te hizo querer otra?" antes de cerrar la sesión.

Los cambios de diseño que salgan de un playtest se hacen con evidencia
de MÁS de una sesión, salvo que el fallo sea evidente por sí mismo
(confusión sobre un control, un texto que nadie entiende). Una sola
persona aburrida en un minuto concreto es una pista, no un veredicto.
