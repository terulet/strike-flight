# QUITA TODA LA NIEVE

*Shovel All the Snow!* — un juego de Roblox del género que ahora mismo
está arrasando: acción mínima, satisfactoria y repetible, con números que
suben.

Tres archivos de Luau. El mapa entero se construye por código al arrancar
la partida, así que no hay nada que dibujar en Studio: se pegan los tres
scripts y hay juego.

Para jugarlo: descargas `QUITA-LA-NIEVE.rbxlx`, doble clic y Play — el
sitio viene con los tres scripts ya colocados. Los detalles y la vía a
mano, en `LEEME.txt`. Esto de aquí es el porqué.

El sitio se regenera con `node nieve/herramientas/empaquetar.mjs`, que
además comprueba que el código que queda dentro es idéntico al de los
`.luau`, carácter a carácter.

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

## El mapa: una casa con su parcela

No cinco rectángulos en fila: **una propiedad**, con su calle delante, su
casa, su jardín, su piscina y su pista de tenis. Separadas por setos con
arco de madera, no por muros.

| Zona | Casilla | Parcela | Vale | Abrir | Qué aparece debajo |
|---|---|---|---|---|---|
| LA ENTRADA | 4 studs | 80 × 56 | 1 | gratis | asfalto, con el coche aparcado |
| EL JARDÍN | 4 | 96 × 64 | 6 | 500 | césped, mesa, barbacoa y árboles |
| LA PISCINA | 5 | 140 × 100 | 34 | 7.000 | la piscina helada y sus tumbonas |
| LA PISTA DE TENIS | 6 | 192 × 132 | 165 | 70.000 | la pista pintada, con su red |
| EL BOSQUE | 7 | 252 × 168 | 1.050 | 380.000 | pinos, estanque helado y cabaña |

**Esa última columna es media gracia del juego.** Quitar nieve para
descubrir hormigón gris no sabe a nada; quitarla para que aparezca el
césped, el agua de la piscina o las líneas de la pista, sí. Por eso cada
parcela tiene su propio suelo y su propio decorado.

Y el decorado está **dentro** de la parcela, no alrededor: la mesa del
jardín, los pinos, la piscina y la red de tenis dejan huecos sin nieve, y
se barre a su alrededor. Cuesta un 20% de la nieve de cada parcela — que
se compensa subiendo lo que vale cada bloque, no metiendo más piezas.

El mapa entero son **2.911 piezas**, techo puesto en la prueba para que no
se dispare: esto tiene que ir en un móvil.

### Por qué la casilla crece con la zona

No es un capricho. Con casillas de 4
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
   2 min 34 s   se abre EL JARDÍN                 (306 monedas/min)
   9 min 52 s   se abre LA PISCINA              (1.884 monedas/min)
  20 min 16 s   se abre LA PISTA DE TENIS      (14.701 monedas/min)
  26 min 15 s   botas al máximo                (77.003 monedas/min)
  30 min 13 s   se abre EL BOSQUE              (92.208 monedas/min)
  33 min 10 s   carretilla al máximo          (301.585 monedas/min)
  34 min 38 s   pala al máximo                (329.472 monedas/min)
  41 min 14 s   primer RENACER                (341.309 monedas/min)

  el parón más largo sin nada nuevo: 10 min
```

La primera mejora se compra **en el primer minuto**: el premio de
bienvenida da para ella de sobra, y la siguiente se gana enseguida. Eso es
lo más importante de toda la tabla — quien no compra nada en el primer
minuto, se va.

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

## La guía: los primeros diez segundos

Un juego de estos se pierde antes del primer minuto. Si no sabes qué
hacer, te vas — y "andar por encima" no es obvio para quien nunca ha
jugado a esto, por muy simple que parezca.

Así que hay un cartel grande, debajo del nombre de la zona, que dice lo
siguiente que toca. Y **no se quita por tiempo: se quita cuando lo haces**.

| | Dice | Se va cuando |
|---|---|---|
| 1 | ANDA POR ENCIMA DE LA NIEVE | recoges el primer bloque |
| 2 | SIGUE, HASTA LLENAR LA CARRETILLA | la llenas |
| 3 | AHORA AL CAMIÓN, A VENDERLA | vendes |
| 4 | PULSA MEJORAS Y COMPRA LA PALA | compras la primera mejora |

No hay estado guardado para esto: el paso sale de lo que el jugador ya ha
hecho (`nieveTotal`, `ventas`, si tiene alguna mejora). Nada que
sincronizar y nada que se pueda quedar a medias.

## Volver mañana

Un juego de estos no se pierde por el primer minuto: se pierde por el
segundo día. Tres cosas, y las tres pesan más que cualquier mejora nueva.

**Premio diario.** Al entrar, si es un día nuevo, cobras. Y el premio no
son monedas fijas: son **250 bloques de tu mejor zona**, así que vale algo
el primer día y sigue valiendo algo veinte horas de juego después. La
racha sube con cada día seguido y multiplica el premio hasta ×7; si tardas
más de 48 horas en volver, vuelve a empezar.

**Códigos.** Se canjean desde el panel de mejoras. Da igual mayúsculas,
minúsculas o espacios de más. Cada uno vale una vez por jugador y queda
guardado, así que no se puede repetir al día siguiente. Añadir uno es
añadir una línea a `Ajustes.codigos` — para soltarlos en TikTok y que la
gente los busque.

**Tabla de récords.** Un poste al lado de la salida con los diez que más
nieve han recogido en total. Ordenada por lo único que **no** se borra al
renacer, para que renacer no te cueste el puesto. Se relee cada 90
segundos y los nombres se cachean, que `GetNameFromUserIdAsync` está
limitado.

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

Con eso, el código corre **tal cual, sin tocarle una línea** — y no solo
el servidor: el LocalScript también se carga, construye su HUD y recibe
los paquetes de verdad, así que se puede comprobar lo que acaba escrito en
pantalla.

```bash
node nieve/herramientas/probar.mjs           # 96 comprobaciones del servidor
node nieve/herramientas/probar.mjs cliente   # 53 del HUD, ejecutado
node nieve/herramientas/probar.mjs ritmo     # la partida entera, cronometrada
```

Hace falta el intérprete `luau` en el PATH
([releases](https://github.com/luau-lang/luau/releases)).

Qué comprueba el servidor: que el mundo se construya entero; que al pisar
la nieve se recoja y al llegar al camión se cobre; que no se compre sin
dinero; que colarse en una zona cerrada no dé nada; que la nieve vuelva;
que la partida se guarde y se recupere; que un fallo de DataStore no pise
la partida buena; que renacer haga lo que dice y no se pueda hacer antes
de tiempo; que el premio diario pague una vez al día y la racha suba y se
caiga cuando toca; que un código no se pueda canjear dos veces ni
sobrevivir a un cierre de sesión; y que al apagar el servidor no se pierda
a nadie.

Qué comprueba el cliente: que el HUD se construya entero; que el dinero,
la carga, la zona y el porcentaje limpio se pinten con lo que manda el
servidor; que la barra diga "llena" cuando toca; que el panel abra y
cierre; que los avisos aparezcan, no se pisen entre ellos y se borren
solos; que los carteles del mundo salgan en el idioma del jugador; y que
canjear un código desde la caja llegue al servidor y vuelva.

El entorno de mentira además exige que toda propiedad de Roblox empiece
por mayúscula, que es como cazó un error de verdad antes de llegar a
Studio.

## Qué está probado y qué no

**Probado, ejecutando el código:** toda la lógica de arriba y el HUD
entero — 149 comprobaciones en verde entre servidor y cliente — más el
análisis estático de Luau (`luau-analyze`) sobre los tres archivos.

**Sin probar, porque hace falta Studio:** cómo se ve. Que la pala quede
bien cogida en la mano, que los carteles floten a la altura correcta, que
el panel no se salga en una pantalla de móvil estrecha, que la nieve
cayendo no cueste FPS en un teléfono viejo. El HUD se construye y se
actualiza bien — eso está comprobado — pero que *se vea* bien es otra
cosa, y seguro que hay dos o tres cosas que retocar en la primera partida
de verdad.

Ahí es donde entra tu playtest.

## Qué le falta para pelear de verdad

El juego está entero y se puede publicar tal cual. Lo que separa "está
publicado" de "tiene jugadores":

- **Pases.** Lo único que necesita algo tuyo: el hueco ya está hecho
  (`Ajustes.pases`), creas el pase en la web, pegas su id y funciona. Los
  dos de siempre: dinero ×2 y carretilla ×2.
- **La miniatura y el nombre.** En Roblox esto pesa tanto como el juego.
  Una imagen que se entienda a tamaño de sello y un nombre que la gente
  escriba en el buscador.
- **Un mundo de invierno con hueco propio.** El filón de las hojas está
  saturado; la nieve tiene temporada propia y menos competencia.
