# QUITA TODA LA NIEVE

*Shovel All the Snow!* — un juego de Roblox del género que ahora mismo
está arrasando: acción mínima, satisfactoria y repetible, con números que
suben.

Tres archivos de Luau. El mapa entero se construye por código al arrancar
la partida, así que no hay nada que dibujar en Studio: se pegan los tres
scripts y hay juego.

Para ponerlo en Roblox, mira `LEEME.txt`. Esto de aquí es el porqué.

## De dónde sale

De mirar qué hace funcionar a *Clean all the leaves!* (67 millones de
partidas en su primer mes) y a los demás del filón: *Leaf Collector*,
*Clean the Leaves*, *Leaf Blowing Simulator*.

El rastrillo es lo de menos. Lo que engancha es el esqueleto, y son seis
reglas:

1. **Se entiende en tres segundos, sin tutorial.** Ves nieve, te acercas,
   desaparece. Nadie lee nada.
2. **No se puede perder.** Cero muerte, cero fallo, cero castigo. Solo
   progreso.
3. **El número sube, y sube rápido al principio.** La primera mejora
   llega antes de que dé tiempo a aburrirse.
4. **La limpieza se ve.** Lo sucio se queda sucio y lo limpio se queda
   limpio: el mapa *es* la barra de progreso.
5. **Siempre hay una zanahoria a la vista.** La zona cerrada de al lado,
   la mejora que cuesta un poco más de lo que llevas encima.
6. **Excusa social.** Un sitio que se limpia entre varios.

Todo lo que hay en este juego sale de una de esas seis. Lo que no salía
de ninguna, no está.

## El bucle

Andas por encima de la nieve y se recoge sola. Cuando la carretilla se
llena, vas al camión y se vende sola. Con el dinero, mejoras. Cuando la
parcela se te queda pequeña, abres la siguiente.

No hay botón de recoger ni botón de vender. Cada botón que quitas es
gente que no se cae por el camino.

## El mapa

Cinco parcelas en fila, separadas por puertas de hielo. La nieve de cada
una vale más que la de la anterior.

| Zona | Casilla | Parcela | Bloques | Vale | Abrir |
|---|---|---|---|---|---|
| TU ENTRADA | 4 studs | 80 × 56 | 280 | 1 | gratis |
| LA ACERA | 4 | 96 × 64 | 384 | 5 | 500 |
| EL PARQUE | 5 | 140 × 100 | 560 | 25 | 8.000 |
| EL APARCAMIENTO | 6 | 192 × 132 | 704 | 120 | 80.000 |
| LA MONTAÑA | 7 | 252 × 168 | 864 | 750 | 450.000 |

**La casilla crece con la zona**, y no es un capricho. Con casillas de 4
studs en todas partes, una parcela grande son miles de piezas y el móvil
se arrastra. Creciendo la casilla, LA MONTAÑA mide nueve veces lo que TU
ENTRADA y solo tiene tres veces más piezas.

Y arregla algo peor. Con casillas iguales, un jugador con la pala al
máximo recoge más rápido de lo que vuelve a nevar en *cualquier* zona: el
techo de ingresos es el mismo al principio que al final, las mejoras
dejan de notarse y la progresión se para en seco. Con la casilla grande
recoges menos bloques por segundo, pero cada uno vale mucho más — y la
parcela da abasto.

Total del mapa: **2.792 piezas de nieve**, unas 2.900 con decorado.

## El ritmo, medido

No a ojo: hay un simulador que juega una partida entera solo
(`herramientas/ritmo.luau`) y cronometra cada hito. Esto es lo que sale
con los números de ahora:

```
   3 min 20 s   se abre LA ACERA                  (302 monedas/min)
  11 min 46 s   se abre EL PARQUE              (2.176 monedas/min)
  22 min 55 s   se abre EL APARCAMIENTO       (12.930 monedas/min)
  30 min 45 s   botas al máximo               (57.740 monedas/min)
  37 min 07 s   se abre LA MONTAÑA            (68.463 monedas/min)
  40 min 18 s   carretilla al máximo         (341.444 monedas/min)
  41 min 43 s   pala al máximo               (327.657 monedas/min)
  50 min 07 s   primer RENACER               (327.077 monedas/min)

  el parón más largo sin nada nuevo: 11 min
```

La primera mejora cae a los **8 segundos**. Eso es lo más importante de
toda la tabla: quien no compra algo en el primer minuto, se va.

La primera versión de estos números era mucho peor y el simulador lo
cazó: **media hora sin nada nuevo** antes de la última zona, y las tres
mejoras agotadas en el minuto 35. Un jugador real habría cerrado el juego
mucho antes de llegar ahí.

## La economía

| Mejora | Niveles | Precio | Sube | Qué hace |
|---|---|---|---|---|
| PALA | 15 | 40 | ×2 | +0,75 studs de radio y +1 bloque por tic |
| CARRETILLA | 15 | 30 | ×2 | +20 de capacidad |
| BOTAS | 10 | 100 | ×2,3 | +1,3 de velocidad |

De salida: radio 5,5 · 10 bloques por segundo · caben 30 · velocidad 16.
Al máximo: radio 16 · 150 por segundo · caben 310 · velocidad 27,7.

**RENACER** cuesta 3.500.000 y exige tener las cinco zonas abiertas. Lo
vacía todo — dinero, mejoras y zonas — a cambio de cobrar el doble para
siempre. El segundo cuesta el triple que el primero.

Las curvas de mejora son ×2 a propósito, no más. Cuando las probé a ×2,4
las últimas mejoras costaban más que las zonas y competían con ellas: el
jugador se pasaba veinte minutos ahorrando sin que pasara nada.

## La nieve vuelve, y más rápido si hay gente

Cada bloque recogido vuelve a nevar a los 40 segundos. Sin eso el mapa se
queda pelado y no hay nada que hacer.

Pero 40 segundos con veinte personas dentro es un descampado. Así que el
tiempo baja con el número de jugadores:

```
regreso = 40 / (1 + jugadores / 6)     mínimo 8 segundos
```

Solo: 34 segundos. Con veinte: 9. El servidor lleno rinde más que el
vacío, que es justo lo que quieres — que entrar en un servidor con gente
se note bien, no mal.

Es la alternativa barata a darle a cada jugador su propia parcela, que es
lo que hacen los grandes y multiplica por veinte las piezas del mapa.

## Cómo está montado

Tres archivos, y cada uno tiene un trabajo:

| Archivo | Dónde va | Qué hace |
|---|---|---|
| `AjustesNieve.luau` | ReplicatedStorage | todos los números y todos los textos |
| `Nieve.server.luau` | ServerScriptService | el mundo, las cuentas, el guardado |
| `NieveCliente.client.luau` | StarterPlayerScripts | el HUD y los efectos |

**El servidor manda en todo lo que vale dinero.** El cliente pide
("quiero subir la pala") y enseña lo que le mandan; no decide nada, no
suma nada y no se le cree nada. Un tramposo con el cliente parcheado
puede atravesar una puerta cerrada — y no recoger ni un bloque al otro
lado, porque quien mira si esa zona es suya es el servidor.

Ni un número vive fuera de `AjustesNieve`. Cambiar el equilibrio del
juego es tocar una tabla y darle a PLAY.

El idioma sale del jugador: español si su Roblox está en español, inglés
en los demás casos. Los carteles del mundo se traducen en el cliente, así
que dos personas con idiomas distintos ven cada una el suyo en la misma
partida.

## El guardado

DataStore, con reintentos y espera creciente.

La regla importante: **si la lectura falla, esa sesión no guarda**. Más
vale perder una partida de hoy que machacar la de tres semanas con un
perfil vacío porque el DataStore tuvo un mal minuto. Se avisa al jugador
y se sigue jugando.

Se guarda al salir, cada dos minutos, y al apagarse el servidor
(`BindToClose`).

## Pruebas

No hay Roblox Studio donde escribí esto, así que hay un Roblox de mentira
(`herramientas/entorno.luau`): lo justo de la API — instancias, hijos,
señales, atributos, DataStore — más un planificador de corrutinas que
imita `task.wait()` y deja adelantar el reloj a voluntad.

Con eso, el código del servidor corre **tal cual, sin tocarle una línea**:

```bash
node nieve/herramientas/probar.mjs         # 69 comprobaciones
node nieve/herramientas/probar.mjs ritmo   # la partida entera, cronometrada
```

Hace falta el intérprete `luau` en el PATH
([releases](https://github.com/luau-lang/luau/releases)).

Qué comprueba: que el mundo se construya entero; que al pisar la nieve se
recoja y al llegar al camión se cobre; que no se compre sin dinero; que
colarse en una zona cerrada no dé nada; que la nieve vuelva; que la
partida se guarde y se recupere; que un fallo de DataStore no pise la
partida buena; que renacer haga lo que dice y no se pueda hacer antes de
tiempo; y que al apagar el servidor no se pierda a nadie.

El entorno de mentira además exige que toda propiedad de Roblox empiece
por mayúscula, que es como cazó un error de verdad antes de llegar a
Studio.

## Qué está probado y qué no

**Probado, ejecutando el código:** toda la lógica de arriba, 69
comprobaciones en verde, más el análisis estático de Luau
(`luau-analyze`) sobre los tres archivos.

**Sin probar, porque hace falta Studio:** cómo se ve. Que la pala quede
bien cogida en la mano, que los carteles floten a la altura correcta, que
el HUD no se solape con los botones del móvil, que la nieve cayendo no
cueste FPS en un teléfono viejo. Nada de eso rompe el juego, pero seguro
que hay dos o tres cosas que retocar en la primera partida de verdad.

Ahí es donde entra tu playtest.

## Qué le falta para pelear de verdad

El juego está entero y se puede publicar tal cual. Lo que separa "está
publicado" de "tiene jugadores":

- **Pases.** El hueco ya está hecho (`Ajustes.pases`): creas el pase en
  la web, pegas su id y ya funciona. Los dos de siempre: dinero x2 y
  carretilla x2.
- **Premio diario.** Volver mañana tiene que dar algo. Es lo más barato
  que existe para que la gente vuelva.
- **Codigos.** Para poder soltarlos en TikTok y que se busquen.
- **Tabla de récords.** Ya se manda al marcador de Roblox (monedas, nieve
  y renaceres); falta la global, con DataStore ordenado.
- **La miniatura y el nombre.** En Roblox esto pesa tanto como el juego.
  Una imagen que se entienda a tamaño de sello y un nombre que la gente
  escriba en el buscador.
- **Un mundo de invierno con hueco propio.** El filón de las hojas está
  saturado; la nieve tiene temporada propia y menos competencia.
