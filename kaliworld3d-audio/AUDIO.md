# El sonido de Kali World 3D

Encargo de KW3D-002 —«Que se sienta»—: *animación de Kali, sonido de pasos y de
motor, polvo, viento en la altura*. Esto es la parte de sonido: **qué suena,
cuándo, de dónde se saca y cómo entra en el proyecto**.

La regla de producto del mundo dice que si una niña ve algo y piensa que puede
usarlo, tiene que poder. En sonido la regla es la hermana de esa:

> **Lo que se usa, suena. Y suena distinto según dónde se pise.**

Un mundo abierto en el que los pasos suenan igual en la plaza que en la arena no
está callado: está diciendo que la arena no importa.

---

## 1. Las tres capas

| Capa | Qué es | Cuánto ocupa | Regla |
|---|---|---|---|
| **Ambiente** | el fondo de la zona: pájaros, mar, viento | 1 bucle estéreo + 1 capa | nunca calla; cambia por zona con fundido de 2 s |
| **Acción** | pasos, motor, remo, puertas, agua | 15–20 voces | siempre 3D, mono, en metros |
| **Aviso** | cartel, confirmación, encargo, música | 2–3 voces | manda sobre las otras: agacha el ambiente 4 dB |

Tres capas, no más. En un iPad, cada bucle que suene sin que nadie lo note es
una voz que le falta al coche cuando derrapa.

---

## 2. El mapa de sonidos

Cada fila dice **de dónde sale la señal en el código que ya existe**. Lo que no
tiene gancho todavía es porque el sistema aún no está, y va marcado.

### 2.1 Kali a pie — `KaliLocomotion.Speed` (`KaliLocomotion.cs:47`), `IsGrounded` (`:50`)

El paso no se dispara con un temporizador, se dispara **por distancia
recorrida**: la zancada de una niña de 1,30 m es de unos 0,62 m. Así, andar,
correr y bajar una cuesta suenan al ritmo que se ven, sin ajustar nada.

| id | Cuándo | Variantes | Nota |
|---|---|---|---|
| `paso_hierba` | valle, prado, jardines | 6 | el suelo por defecto del mundo |
| `paso_tierra` | caminos, era, montaña | 6 | |
| `paso_grava` | arcén y terraplén de la carretera | 6 | el terraplén se pisa mucho más de lo que parece |
| `paso_piedra` | plaza del pueblo, mirador | 6 | seco y con algo de cola: la plaza tiene paredes |
| `paso_madera` | muelle, porches, escaleras | 6 | también vale para `ClimbUp`/`ClimbDown` |
| `paso_arena` | cala y playa | 6 | apagado, sin ataque |
| `paso_interior` | dentro de las casas | 6 | para KW3D-006 |
| `paso_agua_poca` | orilla, charco | 4 | |
| `salto` | despegue | 2 | |
| `aterrizaje_suave` / `_fuerte` | según velocidad vertical | 2 + 2 | el fuerte, a partir de ~6 m/s |
| `ropa` | roce, bajo los pasos | 3 | opcional; es lo que separa «pisadas» de «una niña andando» |
| `aliento_cuesta` | subiendo la montaña a pie | 2 | opcional, y muy bajo |

Correr **no lleva ficheros aparte**: es el mismo banco con el volumen +3 dB, el
tono +6 % y la zancada a 1,05 m.

**Falta un dato en el código**: qué se está pisando. Un componente
`SuperficieDeSonido` en los volúmenes del generador (y el índice de textura del
`Terrain` para el resto) resuelve el 100 % de los casos y no toca la locomoción.

### 2.2 El coche — `ArcadeCarController.Speed` (`:54`), `IsDriven` (`:213`), `IsGrounded` (`:57`)

| id | Cuándo | Tipo | Nota |
|---|---|---|---|
| `motor_arranque` | al tomar el control (`OnTakeControl`, `:80`) | 1 | |
| `motor_bajo` | bucle, manda de 0 a ~7 m/s | bucle | |
| `motor_alto` | bucle, manda de ~7 a 18 m/s | bucle | |
| `motor_apagado` | al bajarse (`OnReleaseControl`, `:86`) | 1 | |
| `gas_suelta` | al soltar el acelerador rodando | 2 | es lo que hace que el coche parezca tener marchas |
| `derrape` | bucle, entra con el deslizamiento lateral | bucle | |
| `rueda_grava` | bucle, fuera del asfalto | bucle | |
| `suspension` | golpe al caer, badenes, bordillos | 3 | |
| `puerta_abre` / `puerta_cierra` | al subir y al bajar | 1 + 1 | el «clac» de la puerta es la mitad de la sensación de subirse |
| `claxon` | botón libre | 1 | una niña de ocho años le va a dar 200 veces; que sea simpático |
| `choque_leve` / `_fuerte` | contra casas y rocas | 2 + 2 | |

**Dos bucles, no seis.** Se cruzan por velocidad y se afinan de 0,80 a 1,30 de
tono. Seis capas de motor es lo que hace un simulador, y este coche ya decidió
en la arquitectura que no lo es.

**Falta una línea en el código**: `ArcadeCarController` calcula el
`deslizamiento` en `:119` y lo corrige en `:166`, pero no lo publica. Un
`public float Slip => …` es todo lo que hace falta para que el derrape suene
exactamente cuando se ve.

### 2.3 Interacción — `InteractionSensor.Prompt` y `IInteractable.Interact`

Un gesto y muchos verbos, también en sonido: el cartel suena igual siempre, y lo
que cambia es lo que pasa después.

| id | Verbo / momento | Variantes |
|---|---|---|
| `cartel_aparece` | `Prompt` pasa de vacío a algo | 1 |
| `cartel_va` | deja de haber nada cerca | 1 |
| `accion_ok` | se pulsa y se hace | 1 |
| `accion_no` | se pulsa y no se puede (`IsAvailable == false`) | 1 |
| `subir` | `Board` — `VehicleBoarding.cs:43` | 1 |
| `bajar` | `Exit` | 1 |
| `puerta_abre` / `cierra` | `Enter` — casas, gelatería (`Gelateria.cs:37`) | 2 + 2 |
| `comprar` | `Buy` — moneda y campanilla de mostrador | 2 |
| `coger` / `dejar` | `Take` | 2 + 2 |
| `sentarse` | `Sit` | 1 |
| `hablar` | `Talk` — sílabas cortas, sin idioma | 6 |

### 2.4 El encargo — `Encargo.Cambia` (`Encargo.cs:43`)

Tres estados y ya hay evento: el sonido se engancha ahí y no toca el juego.

| id | Cuándo | Duración |
|---|---|---|
| `encargo_empieza` | `SinEmpezar → EnMarcha`, en la gelatería | 1,5 s |
| `helado` | el momento de que le den el helado | 0,6 s |
| `encargo_cumplido` | `EnMarcha → Cumplido`, arriba | 2,5 s |

### 2.5 La llegada al mirador — `LlegadaAlMirador.cs`

La cámara se abre durante cuatro segundos. Es el único momento escrito del
recorrido, y es donde el sonido decide si el viaje valió la pena:

| id | Qué | Duración |
|---|---|---|
| `viento_altura` | bucle, entra por altura, no por zona | bucle |
| `descubrimiento` | el acorde de la vista | 4 s, exactos |

### 2.6 Ambiente por zona

Bucles estéreo, sin espacializar, de 30 a 90 s, con fundido cruzado de 2 s.

| id | Zona | Qué se oye |
|---|---|---|
| `amb_valle` | fuera del pueblo | pájaros sueltos, hierba, chicharras al fondo |
| `amb_pueblo` | plaza y calles | gente lejana, un perro, la fuente |
| `amb_montaña` | la subida y el mirador | viento y aves grandes, muy espaciado |
| `amb_cala` | playa y muelle | olas y gaviotas |
| `amb_noche` | cuando haya ciclo de día | grillos |

Y encima, **puntuales sueltos** cada 20–60 s, que es lo que impide que un bucle
se note: `pajaro_cerca` (4), `campana_pueblo` (1), `perro_lejos` (2),
`grillo_solo` (2).

### 2.7 Agua y los vehículos nuevos

Esto es de la rama en curso —kayak, lancha, tirolina, vagoneta, la cala—, así
que va aparte: no es KW3D-002, pero se busca ahora porque se busca en los mismos
sitios y sale más barato de una vez.

| id | Qué | Tipo |
|---|---|---|
| `remo_entra` / `remo_sale` | la palada del kayak | 4 + 4 |
| `casco_agua` | el kayak avanzando | bucle |
| `fueraborda_arranque` | el tirón de arranque | 1 |
| `fueraborda_ralenti` / `_planeo` | los dos regímenes de la lancha | 2 bucles |
| `ola_golpe` | el casco al saltar una ola | 3 |
| `estela` | bucle bajo el planeo | bucle |
| `amarrar` / `soltar` | cuerda y madera | 2 |
| `entrar_agua` / `salir_agua` | Kali metiéndose | 2 + 2 |
| `chapoteo` | nadar, jugar | 4 |
| `tirolina_entra` / `polea` / `freno` | la tirolina | 1 + bucle + 1 |
| `vagoneta_traqueteo` / `curva` / `palanca` | el raíl | bucle + 2 + 1 |

### 2.8 Modo construir (KW3D-005) y sistema

`construir_entra`, `construir_sale`, `pieza_coge`, `pieza_gira`, `pieza_pone`,
`pieza_no_cabe`, `pieza_borra`, `guardado`. Ocho, cortos y secos: en modo
construir se va a oír uno cada dos segundos durante media hora seguida, y
cualquier cosa con cola cansa.

De sistema: `ui_mueve`, `ui_ok`, `ui_atras`, `pausa`.

### 2.9 La cuenta

Un «sonido» es una entrada del banco; los «ficheros» son sus variantes, porque
un paso que suena siempre igual se oye como un metrónomo a los treinta segundos.

| Bloque | Sonidos | Ficheros | Cuándo |
|---|---|---|---|
| Pasos, 3 superficies de 8 | 3 | 18 | **KW3D-002** |
| Coche | 11 | 14 | **KW3D-002** |
| Interacción, lo mínimo | 6 | 6 | **KW3D-002** |
| Encargo y mirador | 4 | 4 | **KW3D-002** |
| Ambiente: valle, pueblo, viento | 3 | 3 | **KW3D-002** |
| Las otras 5 superficies, saltos, ropa | 10 | 41 | después |
| Choques del coche | 2 | 4 | después |
| Los demás verbos: comprar, coger, hablar… | 7 | 17 | después |
| Ambiente de zona y puntuales | 7 | 12 | después |
| Agua y vehículos nuevos | 19 | 33 | rama en curso |
| Construir | 8 | 8 | KW3D-005 |
| Sistema | 4 | 4 | después |
| **Total** | **84** | **164** | |

**27 sonidos (45 ficheros), 5 bucles de música y 3 remates** cierran KW3D-002.
El resto ya sabe dónde va a vivir, y por eso se busca ahora: son los mismos
sitios y el mismo viaje.

La lista entera, para que la lea un programa, está en `sonidos.json`.

---

## 3. La música

Un mundo abierto no es un shoot'em up: la música **no puede sonar sin parar**.
Cuarenta minutos de bucle en una tarde de sábado se convierten en «quita la
música». La propuesta es **música por momentos**: bloques de dos o tres minutos
y después ambiente solo, hasta que pase algo que la vuelva a encender —entrar en
el pueblo, coger el coche, empezar el encargo, llegar arriba—.

| id | Dónde suena | Carácter | Duración | Bucle |
|---|---|---|---|---|
| `menu` | portada | el tema de Kali: cálido, con melodía que se recuerda | 60–90 s | sí |
| `valle` | a pie, fuera del pueblo | acústico, ligero, con aire entre las notas | 90–120 s | sí |
| `pueblo` | dentro del pueblo | mediterráneo, guitarra o acordeón, alegre y corto | 90 s | sí |
| `conducir` | mientras se lleva el coche | rítmico, arcade, sin agotar | 90 s | sí |
| `montaña` | la subida y el mirador | amplio, cuerdas y pads, poco ritmo | 90 s | sí |
| `cala` | playa y mar | fresco: ukelele, marimba, percusión suave | 90 s | sí |
| `construir` | modo construir | pequeño y repetitivo a propósito, sin melodía fuerte | 120 s | sí |
| `noche` | con el ciclo de día | tranquilo, casi ambiente | 90 s | sí |
| `st_encargo` | al recibir el encargo | tres notas que suben | 2 s | no |
| `st_cumplido` | al cumplirlo | la resolución de las tres | 3 s | no |
| `st_descubrimiento` | mirador, con la cámara abriéndose | un acorde que se abre | 4 s | no |

**El contrato técnico es el mismo que ya funciona en FLIGHT STRIKE**
(`audio/MUSICA.json`): mp3 estéreo 44,1 kHz VBR q5, **−16 LUFS** y pico real
−1,5 dB. Un juego que suena más fuerte que el otro en el mismo iPad es un
descuido, no una decisión.

Tres reglas de mezcla:

- Al entrar en zona, **fundido cruzado de 2 s**; nunca corte.
- Mientras suena un *stinger*, la música baja 4 dB y vuelve.
- Con el coche en marcha, **el ambiente baja 6 dB**: el motor es el ambiente.

**Aviso de repertorio**: la música que ya está en `audio/` es de FLIGHT STRIKE
—sintetizador, espacio, combate— y **no vale ni una pista** para Kali World.
Aquí hace falta el registro contrario: acústico, cálido, de día. Los autores no
se reaprovechan, los sitios sí.

---

## 4. De dónde se saca

Todo **CC0** siempre que se pueda, que es lo que ya se hizo en FLIGHT STRIKE:
las once fuentes externas son CC0 y están documentadas con su hash. Lo que no
sea CC0 solo entra si está anotado en el documento de licencias.

### Efectos

| Qué | Sitio | Licencia | Para qué |
|---|---|---|---|
| Kenney · RPG Audio | https://kenney.nl/assets/rpg-audio | CC0 | pasos, puertas, moneda, coger, mostrador |
| Kenney · UI Audio | https://kenney.nl/assets/ui-audio | CC0 | cartel, confirmar, negar |
| Kenney · Interface Sounds | https://kenney.nl/assets/interface-sounds | CC0 | menús y modo construir |
| Kenney · Impact Sounds | https://kenney.nl/assets/impact-sounds | CC0 | suspensión, choques, golpes de casco |
| Todos los paquetes de Kenney | https://kenney.nl/assets/category:Audio | CC0 | el catálogo entero, por si sale otro |
| Fantozzi's Footsteps (hierba/arena y piedra) | https://opengameart.org/content/fantozzis-footsteps-grasssand-stone | CC0 (12 pasos de freesound) | la base de `paso_hierba`, `paso_arena`, `paso_piedra` |
| Pasos en madera, piedra, hojas, grava y barro | https://opengameart.org/content/different-steps-on-wood-stone-leaves-gravel-and-mud | comprobar en la página | `paso_madera` y `paso_grava` |
| Footsteps on different surfaces | https://opengameart.org/content/footsteps-on-different-surfaces | comprobar | hormigón, metal, agua |
| Footstep Sounds | https://opengameart.org/content/footstep-sounds | comprobar | variantes de relleno |
| CC0 Sounds Library | https://opengameart.org/content/cc0-sounds-library | CC0 | cajón de sastre |
| CC0 Sound Effects | https://opengameart.org/content/cc0-sound-effects | CC0 | ídem |
| 100 CC0 SFX #2 | https://opengameart.org/content/100-cc0-sfx-2 | CC0 | puertas, cristal, madera, golpes |
| racing car engine sound loops | https://opengameart.org/content/racing-car-engine-sound-loops | comprobar (de material de dominio público) | `motor_bajo` y `motor_alto` |
| Car Engine Loop 96 kHz, 4 s | https://opengameart.org/content/car-engine-loop-96khz-4s | comprobar | bucle limpio, buen material para afinar |
| Engine Sound | https://opengameart.org/content/engine-sound | comprobar | alternativa |
| Car tire squeal skid loop | https://opengameart.org/content/car-tire-squeal-skid-loop | comprobar (96 kHz, 24 bits, 3 s) | `derrape` |
| CC0 Background Ambience | https://opengameart.org/content/cc0-background-ambience | CC0 | `amb_valle`, `amb_montaña` |
| JC Sounds · Nature Ambient Pack Vol 1 | https://opengameart.org/content/jc-sounds-nature-ambient-pack-vol-1 | comprobar | pájaros y campo |
| Forest Ambience | https://opengameart.org/content/forest-ambience | CC0 | fondo de valle |
| Freesound, filtrando licencia CC0 | https://freesound.org | por fichero | lo raro: remo, fueraborda, gaviotas, polea, vagoneta |
| Pixabay · efectos | https://pixabay.com/sound-effects/search/cc0/ | licencia de Pixabay (**no** CC0) | último recurso, y anotado aparte |
| Kenney's Sound Pack en gamesounds.xyz | https://gamesounds.xyz/?dir=Kenney%27s+Sound+Pack | CC0 | espejo, si kenney.nl no responde |

### Música

| Qué | Sitio | Licencia | Para qué |
|---|---|---|---|
| Good CC0 Music | https://opengameart.org/content/good-cc0-music | CC0 | selección ya cribada |
| CC0 Music | https://opengameart.org/content/cc0-music-0 | CC0 | ídem |
| CC0 · Calm / Relaxing Music | https://opengameart.org/content/cc0-calm-relaxing-music | CC0 | `valle`, `noche`, `construir` |
| Exploration Theme | https://opengameart.org/content/exploration-theme | comprobar | `montaña` |
| Exploration (guitarra acústica) | https://opengameart.org/content/exploration-0 | comprobar | `valle`, y quizá `menu` |
| Audio · Commercial use OK | https://opengameart.org/content/audio-commercial-use-ok | varias | listado general |
| FreePD, en el espejo de Internet Archive | https://archive.org/details/freepd | dominio público | **freepd.com cerró en 2025**; el catálogo sigue vivo aquí |
| Chosic, filtrado «sin atribución» | https://www.chosic.com/free-music/all/?sort=&attribution=no | CC0 / PD | buscador cómodo por ánimo |

**Lo que se descarta y por qué**: Kevin MacLeod en incompetech y casi todo
Alexandr Zhelanov son CC-BY —se pueden usar, pero obligan a crédito y a
mantenerlo—; los paquetes de itch.io de pago no entran mientras haya CC0 que
sirva; los bundles de Sonniss (GDC) son enormes y de calidad de campo, pero son
*royalty-free* con su propia licencia, así que solo si algo concreto no aparece
en ningún otro sitio.

### Aviso honesto sobre esta lista

Esta sesión corre en un contenedor **sin salida a kenney.nl, opengameart.org,
freesound.org ni pixabay.com** (el proxy de red las bloquea). Así que:

- **No se ha descargado ni un fichero**, y por tanto no hay hashes que dar.
- Las licencias son las que anuncian esas páginas y las que ya conocemos de los
  paquetes de Kenney (CC0 en todo su catálogo de audio, como el
  `Sci-Fi Sounds` que ya usa FLIGHT STRIKE). Las filas marcadas **«comprobar»**
  hay que abrirlas y leer la licencia del ítem antes de meterlas: en OpenGameArt
  la licencia es por publicación, no por sitio.
- La descarga toca hacerla en el Mac, donde vive el proyecto de Unity.

---

## 5. Cómo entra en Unity

**Dónde vive.** `Assets/KaliWorld/Audio/{Pasos,Vehiculos,Ambiente,Interaccion,Musica}`.
Los ficheros originales sin tocar, en `Fuentes~/` **con la virgulilla**: Unity
ignora las carpetas que acaban en `~` y así el material de origen se guarda al
lado del proyecto sin que el editor lo importe ni infle la librería.

**Ajustes de importación**, que es donde se va la memoria de un iPad:

| Tipo | Canales | Compresión | Carga |
|---|---|---|---|
| Pasos y golpes cortos | mono forzado, 22 kHz | ADPCM | descomprimir al cargar |
| Bucles (motor, agua, viento) | mono | Vorbis q70 | comprimido en memoria |
| Ambiente | estéreo | Vorbis q70 | comprimido en memoria |
| Música | estéreo | Vorbis q70 | **streaming** |

**Buses del mezclador**: `Master → Musica · Ambiente · SFX · UI`, con el
*ducking* del punto 3 puesto en el bus, no en cada sonido.

**En 3D, todo en metros**, que para eso la escala es sagrada en este proyecto:
paso 12 m de alcance, coche 40 m, puerta 8 m, ambiente sin espacializar. Caída
lineal, no logarítmica: en un mundo de juguete el logarítmico deja los sonidos
lejanos inaudibles de golpe.

**El `AudioListener` ya está** y va en la cámara (`VerticalSliceBuilder.cs:660`).
Uno solo, y que no se cuele otro en el coche.

**Presupuesto**: 24 voces como techo. Dos bucles de motor, un bucle de ambiente,
una capa de viento, y el resto para lo que pasa.

**Los cinco componentes que hay que escribir** —y ninguno toca lo que ya
funciona, todos leen:

| Componente | Lee de | Hace |
|---|---|---|
| `SonidoDePasos` | `KaliLocomotion.Speed`, `IsGrounded`, `SuperficieDeSonido` | dispara el paso por distancia recorrida |
| `SonidoDeCoche` | `ArcadeCarController.Speed`, `IsDriven`, `Slip` (**falta publicarlo**) | cruza los dos bucles, arranca, derrapa |
| `AmbienteDeZona` | disparadores de zona y altura | funde bucles de ambiente y viento |
| `MusicaPorMomentos` | zona, `Encargo.Cambia`, `CameraContext` | enciende y apaga bloques de música |
| `SonidoDeInteraccion` | `InteractionSensor.Prompt`, `IInteractable.Verb` | cartel, ok, no, y el sonido de cada verbo |

`SuperficieDeSonido` y `ArcadeCarController.Slip` son las **dos únicas cosas que
hay que añadir al juego**. Todo lo demás ya publica lo que el sonido necesita,
que era justamente la idea de tener contratos.

---

## 6. Licencias

Igual que en FLIGHT STRIKE, y por el mismo motivo: cuando esto se publique,
alguien va a preguntar de dónde salió cada sonido.

1. Los ficheros originales se guardan **sin tocar**, con su licencia al lado.
2. Un `AUDIO-LICENCIAS.md` con título, autor, página, licencia, fecha de
   descarga y **SHA-256** de cada fuente.
3. Un manifiesto generado, no escrito a mano, con lo que se produjo a partir de
   cada fuente.

`THIRD_PARTY_AUDIO_LICENSES.md`, `audio/MUSICA.json` y `audio/MANIFIESTO.json`
de este mismo repositorio son la plantilla exacta.

---

## 7. Lo que no se hace todavía

Voz de Kali y de Chloe, reverberación por interiores, oclusión, sonido del clima,
mezcla por auriculares, música que reacciona a lo que pasa. Están en la lista
porque algún día llegan, y ninguno de ellos exige hoy una decisión distinta.
