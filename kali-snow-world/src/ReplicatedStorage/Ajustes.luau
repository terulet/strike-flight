--[[
	LA GRAN TORMENTA  —  ajustes

	Tercera vertical. Las dos anteriores demostraron que desenterrar
	engancha. Esta hace que no se pierda: varias parcelas de verdad, una
	por jugador, y todo guardado.

	El guion, de principio a fin:

	    buzon > tejado > porche > ventana > PUERTA
	                                          |
	                                       GARAJE  ->  sopladora
	                                          |
	                                     LA CARRETERA
	                                          |
	                        se encienden las farolas, sale humo de
	                        enfrente y alguien golpea una ventana
	                                          |
	                                     EL VECINO  ->  sale, y te da
	                                          |         las llaves del
	                                    EL QUITANIEVES  quitanieves
	                                          |
	                                       LA PLAZA
	                                          |
	                          el cartel del pueblo medio enterrado,
	                          y tejados y chimeneas hasta el fondo

	Sigue sin haber tienda, ni renacimiento, ni tormentas, ni pagos. Las
	tres herramientas se encuentran dentro del mundo.
]]

local Ajustes = {}

Ajustes.version = "KALI SNOW WORLD MASTER 1.1"
Ajustes.idiomaFijo = nil

-- Version del GUARDADO, aparte de la del juego. Si cambia la forma del
-- mundo (medidas, sitios, perfil de nieve), sube esto: lo guardado deja
-- de encajar y hay que rehacer la nevada. El dinero y los hallazgos se
-- conservan igual, que es lo que le dolería perder a alguien.
Ajustes.esquema = 1


-------------------------------------------------------------------
--  LA NIEVE
--
--  La profundidad va en CAPAS, no en studs. Una pasada quita una capa.
-------------------------------------------------------------------

Ajustes.nieve = {
	celda = 4,          -- studs de lado (es el cubo del terreno de Roblox)
	capa = 2,           -- studs de alto por capa
	capasMaximas = 10,  -- el manto general

	-- LA REGLA QUE HACE QUE NO TE QUEDES ENCERRADO: al bajar una casilla
	-- no puede abrirse con ninguna de sus ocho vecinas un escalon mayor
	-- que esto. Para bajar hay que ensanchar. No existe el pozo vertical.
	--
	-- Vale para los tres cacharros. Dos jugadores cavando a la vez tampoco
	-- pueden romperla: comprobar y bajar van seguidos, sin ceder el hilo.
	desnivelMaximo = 2,

	capasContraLaCasa = 13,
	capasContraElGaraje = 30,
	capasContraElVecino = 24,
}


-------------------------------------------------------------------
--  LAS PARCELAS
--
--  Ahora hay varias, en fila, separadas. Cada jugador que entra coge una
--  libre y esa es la suya: su casa, su garaje, sus herramientas y su
--  progreso. Los demas pueden entrar a ayudarle a quitar nieve — ayudar
--  no es fastidiar — pero los hallazgos son del dueno.
-------------------------------------------------------------------

Ajustes.parcela = {
	cuantas = 5,        -- entre cuatro y seis
	ancho = 92,         -- casillas en X (368 studs): la calle va a lo largo
	largo = 60,         -- casillas en Z (240 studs)
	separacion = 120,   -- studs de campo entre una parcela y la siguiente
}


-------------------------------------------------------------------
--  EL SITIO
--
--  Todo en casillas dentro de la parcela. Mover una cosa es cambiar un
--  numero: los edificios, el perfil de nieve y los hallazgos salen de
--  aqui.
--
--     cx 3   el buzon, delante de donde apareces
--     cx 20  TU CASA (fachada a +Z) con el garaje al lado
--     cx 80  LA PLAZA, al final de la calle
--
--     cz 11  la fila de las casas
--     cz 26  LA CALLE, cruzando la parcela de punta a punta
--     cz 50  LA CASA DEL VECINO (fachada a -Z, mirandote)
-------------------------------------------------------------------

Ajustes.sitio = {
	cxCasa = 20,
	czCasa = 11,
	czCarretera = 26,
	anchoCarretera = 7,
	-- El arcen que la maquina tambien puede morder: sin el, la cuchilla
	-- se quedaba encajonada entre dos taludes de jardin y la calle no
	-- llegaba nunca a verse el asfalto.
	anchoArcen = 5,
	czVecino = 50,
	cxPlaza = 80,
	radioPlaza = 7,       -- casillas de plaza a cada lado

	-- La calzada NO esta tan hundida como el ventisquero de tu entrada:
	-- por ahi paso el quitanieves municipal hace dias, dejo el muro
	-- delante de tu casa y volvio a nevar encima. Esa es la excusa, y es
	-- tambien lo que hace que el quitanieves pueda trabajar.
	capasCalzada = 6,
	capasCarretera = 26,  -- el muro que dejo la maquina en tu entrada
	anchoBerma = 9,       -- casillas de muro a cada lado de tu entrada

	cxBuzon = 4,
	czBuzon = 22,
	czCoche = 21,        -- tu coche, enterrado en la entrada
	capasBuzon = 6,
	anchoRepecho = 4,

	anchoEntrada = 7,
	radioCogida = 9,
	capasEntradaPasable = 2,
	-- Cuando se da la calle por abierta hasta la plaza.
	capasCalleAbierta = 1,

	-- LO QUE TRAE LA TORMENTA. Todo esto esta construido desde el primer
	-- dia, debajo de la nieve; la tormenta solo vuelve a taparlo.
	czAceraSur = 16,      -- la acera de tu lado (dos casillas de ancho)
	czAceraNorte = 35,    -- la de enfrente
	cxParada = 56,        -- la parada del autobus, en la acera sur
	czAyuntamiento = 38,  -- el ayuntamiento, al fondo de la plaza
	czArcenNorte = 31,    -- por donde se rodea si cae un arbol
}


-------------------------------------------------------------------
--  LAS TRES HERRAMIENTAS
--
--  Cada una cambia COMO se juega, no solo cuanto se tarda:
--
--    PALA         cuchara redonda, poca superficie, LLEGA AL SUELO.
--                 Es la unica que descubre algo.
--
--    SOPLADORA    franja ancha por delante, se come las capas de arriba
--                 a toda velocidad y escupe la nieve a un lado. Pero
--                 deja un colchon: nunca raspa el suelo.
--
--    QUITANIEVES  se conduce. Limpia la calle entera de lado a lado y
--                 empuja la nieve a los lados en montones enormes. Pero
--                 solo pisa calles y sitios despejados: contra un
--                 ventisquero hondo o contra una casa, se para.
--
--  O sea: la pala descubre, la sopladora abre camino, el quitanieves
--  abre el barrio. Ninguna deja obsoleta a la anterior.
-------------------------------------------------------------------

Ajustes.herramientas = {
	pala = {
		clave = "pala",
		orden = 1,
		nombre = { es = "PALA", en = "SHOVEL" },
		golpe = 0.42,
		-- Lo que se lleva una palada COMPLETA. Como el abanico es mucho
		-- mas pequeno que el circulo de antes, cada palada tiene que
		-- valer mas: si no, apuntar saldria mas lento que cavar a bulto y
		-- la mejora se sentiria como un castigo.
		potencia = 6,
		-- EL ABANICO. No es un circulo alrededor de los pies ni un disco
		-- de dieciocho studs: es lo que barre una pala por delante de ti,
		-- de "cerca" a "lejos" y abriendo "angulo" grados a cada lado.
		-- El cliente dibuja EXACTAMENTE esto, con las mismas tres
		-- medidas, porque una marca que no coincide con lo que se quita
		-- es peor que no poner marca.
		cerca = 3,
		lejos = 12,
		angulo = 55,
		dejaCapas = 0,
		dejaTormenta = 0,   -- la pala llega hasta el suelo, tambien en tormenta
	},
	sopladora = {
		clave = "sopladora",
		orden = 2,
		nombre = { es = "SOPLADORA", en = "SNOW BLOWER" },
		golpe = 0.3,
		potencia = 7,
		ancho = 30,
		fondo = 16,
		dejaCapas = 2,
		-- Deja tambien una capa de la nieve nueva: por eso las puertas y
		-- los escalones siguen siendo trabajo de pala aunque haya
		-- sopladora.
		dejaTormenta = 1,
		desvio = 17,
	},
	quitanieves = {
		clave = "quitanieves",
		orden = 3,
		nombre = { es = "QUITANIEVES", en = "SNOW PLOW" },
		golpe = 0.25,
		potencia = 8,
		ancho = 30,       -- la cuchilla, de lado a lado
		fondo = 14,
		dejaCapas = 0,    -- raspa hasta el asfalto...
		dejaTormenta = 0,
		-- ...pero solo muerde donde ya queda poca nieve. Contra el muro de
		-- tu entrada (diecisiete capas) no puede: eso es de pala y
		-- sopladora. Y es tambien lo que puede pisar sin atascarse.
		-- Lo que traga la cuchilla, contando la nevada vieja Y la de
		-- tormenta. Tiene que dar para la calzada (seis capas) con una
		-- tormenta entera encima (tres mas): si no, en cuanto nevara la
		-- maquina no podria ni salir a la calle que viene a limpiar.
		-- Contra el muro de tu entrada sigue sin poder, que es lo suyo.
		capasMaximas = 14,
		velocidad = 10,
		giro = 1.7,       -- radianes por segundo
		desvio = 22,      -- a que distancia deja los montones
	},
}


-------------------------------------------------------------------
--  LA TORMENTA
--
--  La idea entera en una linea: que el mundo vuelva a necesitarte SIN
--  borrar nada de lo que ya has hecho.
--
--  Por eso la nieve de tormenta es otra capa, encima y aparte: cae poca
--  (tres capas como mucho), no cae sobre lo que ya has descubierto, no
--  se guarda y se derrite al terminar. Por mucho que nieve, tu puerta
--  sigue abierta y tus herramientas siguen siendo tuyas.
-------------------------------------------------------------------

Ajustes.tormenta = {
	capasMaximas = 9,       -- lo hondo que llega a cuajar EN UN BLOQUEO
	capasCalle = 5,         -- y lo que cuaja en el resto de la calle
	-- EN LA CALZADA, MENOS. La pala del quitanieves traga catorce capas
	-- contando lo que ya hubiera debajo; si un ventisquero de tormenta
	-- sobre la calzada se pasara de ahi, la maquina no podria ni entrar
	-- en su propio bloqueo. Ocho mas las seis de la calle son catorce
	-- justas.
	capasEnCalzada = 8,
	calma = 7,              -- segundos de calma y celebracion en la plaza
	aviso = 5,              -- la radio, el cielo y el viento, antes de cuajar
	-- OJO: cada ola echa UNA capa. Sobre los bloqueos cae en todas las
	-- olas (son ventisqueros: ahi es donde el viento amontona), y sobre
	-- el resto de la calle solo en una de cada dos, a manchas. Asi que
	-- lo hondo que cuaja de verdad lo manda esto tanto como los topes de
	-- arriba: con trece olas, nueve capas en un bloqueo y cinco fuera.
	olas = 13,              -- en cuantas tandas cae la nieve
	entreOlas = 2.2,        -- segundos entre tanda y tanda
	porLote = 240,          -- casillas por fotograma: nada de golpes secos
	derretirPorLote = 320,

	-- CUANTOS BLOQUEOS SALEN NO SE DECIDE CONTANDO, SE DECIDE EN MINUTOS.
	-- Un tramo de calle se lo lleva el quitanieves en cuarenta segundos y
	-- la acera del ayuntamiento son dos minutos de pala: pedir "cinco
	-- bloqueos" daba tormentas de siete minutos y tormentas de trece con
	-- las mismas reglas. Aqui se dice cuanto trabajo queremos, en
	-- segundos, y entran los bloqueos que quepan.
	--
	-- Con mas gente NO se multiplica la nieve: se pide un poco mas de
	-- faena y se ensanchan las aceras (nunca la calzada, que la hace uno
	-- solo). Jugar acompanado no puede ser un castigo.
	trabajoSolo = 680,
	trabajoAcompanado = 820,
	-- Lo que no es cavar: andar de una casilla a otra, los viajes al
	-- monton con la carretilla llena, dar la vuelta con la maquina. Es
	-- multiplicador sobre el tiempo de cavar puro.
	entorpecimiento = { calzada = 3, acera = 2, puerta = 2.2 },
	-- Como mucho dos bloqueos de calzada por tormenta, contando el arbol:
	-- quitanieves hay uno solo, y todo lo que sea calle lo hace la misma
	-- persona seguido.
	maximoDeCalzada = 2,
	anchoExtraPorJugador = 1,
	maximoJugadoresQueCuentan = 3,

	-- El arbol caido. No se puede quitar con nada: obliga a abrir el
	-- desvio y a rodear.
	probabilidadArbol = 0.65,

	-- Cada cuanto se recuerda al jugador que hay algo que hacer, si lleva
	-- rato sin cerrar un bloqueo.
	empujon = 100,
}

-- La lista de la que sale cada tormenta. No salen todos cada vez: por eso
-- el recorrido cambia y no se repite el mismo paseo.
--
-- Y estan los tres tipos a proposito, porque el quitanieves NO puede
-- resolverlo todo:
--
--    calzada  nieve honda sobre el asfalto        -> quitanieves
--    acera    caminos estrechos, fuera de calzada -> sopladora
--    puerta   puertas, escalones, nieve prensada  -> pala
Ajustes.bloqueos = {
	{
		clave = "acceso", tipo = "calzada", herramienta = "quitanieves",
		nombre = { es = "EL ACCESO AL PUEBLO", en = "THE WAY INTO TOWN" },
	},
	{
		clave = "ruta", tipo = "calzada", herramienta = "quitanieves",
		nombre = { es = "LA RUTA PRINCIPAL", en = "THE MAIN ROUTE" },
	},
	{
		clave = "cruce", tipo = "calzada", herramienta = "quitanieves",
		nombre = { es = "EL CRUCE DE LA PLAZA", en = "THE SQUARE CROSSING" },
	},
	{
		clave = "parada", tipo = "acera", herramienta = "sopladora",
		nombre = { es = "LA PARADA DEL AUTOBUS", en = "THE BUS STOP" },
	},
	{
		clave = "vecino", tipo = "acera", herramienta = "sopladora",
		nombre = { es = "EL CAMINO DEL VECINO", en = "THE NEIGHBOUR'S PATH" },
	},
	-- Los dos de pala van a los escalones, y NO a la puerta ni al garaje,
	-- por una razon de fondo: esas casillas estan protegidas y ahi no
	-- puede volver a nevar nunca. Un bloqueo encima de una puerta ya
	-- descubierta seria justo lo que este evento no puede hacer.
	{
		clave = "escalones", tipo = "puerta", herramienta = "pala",
		nombre = { es = "LOS ESCALONES DE TU CASA", en = "YOUR FRONT STEPS" },
	},
	{
		clave = "ayuntamiento", tipo = "puerta", herramienta = "pala",
		nombre = { es = "LA ENTRADA DEL AYUNTAMIENTO", en = "THE TOWN HALL STEPS" },
	},
}

-- El desvio no se elige: aparece solo cuando cae el arbol.
Ajustes.desvio = {
	clave = "desvio", tipo = "calzada", herramienta = "quitanieves",
	nombre = { es = "EL DESVIO", en = "THE DETOUR" },
}


-------------------------------------------------------------------
--  EL JUGADOR
-------------------------------------------------------------------

Ajustes.jugador = {
	tic = 0.12,
	capacidad = 700,
	velocidad = 17,
	radioDescarga = 14,
	alturaMaxima = 44,
}


-------------------------------------------------------------------
--  LA CARRETILLA, LAS HUELLAS Y EL MONTON
--
--  Tres cosas que no cambian ninguna regla y cambian entera la
--  sensacion: ver lo que llevas encima, ver por donde has pasado, y
--  poder llegar siempre al sitio donde se vacia.
-------------------------------------------------------------------

Ajustes.carretilla = {
	-- La dibuja el CLIENTE, no el servidor: asi va suelta detras de ti
	-- con su retraso, la rueda gira, se inclina al vaciar y nada de eso
	-- cuesta red ni puede atascarse con la fisica. El servidor solo dice
	-- cuanto llevas (un atributo en el personaje).
	atras = 4.2,
	lado = 0,
	alto = 1.6,
	-- Que tan rapido alcanza a su sitio. Cuanto mas bajo, mas cuelga
	-- detras al arrancar y frenar: eso es lo que la hace parecer que
	-- pesa.
	seguimiento = 9,
	giroMaximo = 26,       -- grados que se tuerce al girar tu
	cajaAncho = 2.6,
	cajaLargo = 3.4,
	cajaAlto = 1.25,
	ruedaRadio = 0.62,
	montonMinimo = 0.2,
	montonMaximo = 1.5,
	-- A partir de aqui se le cae nieve por los bordes: es el aviso de
	-- que ya no cabe mas, y se ve sin mirar ningun numero.
	rebosaDesde = 0.85,
	-- El vaciado: inclinar, soltar, esperar y volver.
	vuelca = 0.35,
	posa = 0.3,
	vuelve = 0.45,
	inclinacion = 62,      -- grados
}

Ajustes.huellas = {
	-- Se pintan en el cliente, no en el servidor: no cuestan red, no se
	-- replican y no hay mil partes fisicas dando vueltas por el mundo.
	porJugador = 18,     -- se reciclan: nunca hay mas de estas POR CABEZA
	cada = 2.4,          -- studs andados entre pisada y pisada
	vida = 24,           -- segundos hasta que se borra del todo
	largo = 1.5,
	ancho = 0.75,
	separacion = 0.85,   -- lo que se aparta cada pie del eje al andar
	hundida = 0.18,      -- lo que se mete por debajo de la superficie
}

Ajustes.descarga = {
	-- EL MONTON NUNCA TAPA EL SITIO DE VACIAR. Crece hacia AFUERA, y la
	-- cara de dentro se queda siempre a esta distancia del centro del
	-- punto de descarga, crezca lo que crezca. Antes crecia centrado
	-- encima: al llenarse una partida entera, la bola de nieve se comia
	-- el punto y ya no se podia vaciar mas. Un juego de mover nieve en
	-- el que se acaba pudiendo mover nieve es un juego roto.
	libre = 17,          -- > radioDescarga (14), y por eso nunca lo tapa
	tamanoMinimo = 12,
	tamanoMaximo = 46,
	porCapa = 90,        -- capas echadas por cada stud que crece
}


-------------------------------------------------------------------
--  LOS EDIFICIOS
-------------------------------------------------------------------

Ajustes.casa = {
	ancho = 34,
	fondo = 24,
	alto = 11,
	alturaChimenea = 34,
	pasosTejado = 6,
	altoPaso = 1.05,
	porcheFondo = 9,
	garajeAncho = 16,
	puertaAncho = 6,
	puertaAlto = 9,
}

Ajustes.vecino = {
	ancho = 30,
	fondo = 20,
	alto = 10,
	alturaChimenea = 26,
	pasosTejado = 5,
	altoPaso = 1.05,
	puertaAncho = 6,
	puertaAlto = 9,
}


-------------------------------------------------------------------
--  EL GUION
--
--  El jugador NUNCA ve un menu de tienda. Ve el siguiente misterio, y
--  una frase que le dice hacia donde cavar.
-------------------------------------------------------------------

Ajustes.capitulos = {
	{
		clave = "puerta",
		titulo = { es = "ENCUENTRA LA PUERTA DE TU CASA", en = "FIND YOUR FRONT DOOR" },
		pie = { es = "esa chimenea de ahi es la tuya. Cava hacia ella", en = "that chimney is yours. Dig towards it" },
	},
	{
		clave = "garaje",
		titulo = { es = "DESENTIERRA EL GARAJE", en = "DIG OUT THE GARAGE" },
		pie = { es = "esta al lado de la puerta. Dentro hay algo que te hace falta", en = "next to the door. There is something in there you need" },
	},
	{
		clave = "sopladora",
		titulo = { es = "COGE LA SOPLADORA", en = "GRAB THE SNOW BLOWER" },
		pie = { es = "esta delante del garaje. Acercate", en = "it is out front of the garage. Walk up to it" },
	},
	{
		clave = "carretera",
		titulo = { es = "ABRE LA ENTRADA HASTA LA CARRETERA", en = "CLEAR THE DRIVEWAY TO THE ROAD" },
		pie = { es = "la sopladora barre ancho, la pala remata y descubre", en = "the blower sweeps wide, the shovel finishes and uncovers" },
	},
	{
		clave = "vecino",
		titulo = { es = "ABRE UN CAMINO HASTA EL VECINO", en = "CLEAR A PATH TO YOUR NEIGHBOUR" },
		pie = { es = "esta golpeando la ventana. Cruza la calle y desentierra su puerta", en = "they are banging on the window. Cross the road and dig out their door" },
	},
	{
		clave = "quitanieves",
		titulo = { es = "COGE EL QUITANIEVES", en = "TAKE THE SNOW PLOW" },
		pie = { es = "te ha dado las llaves. Esta aparcado en la calle", en = "they gave you the keys. It is parked out on the road" },
	},
	{
		clave = "plaza",
		titulo = { es = "ABRE LA CALLE HASTA LA PLAZA", en = "PLOW THE ROAD TO THE SQUARE" },
		pie = { es = "conduce por la calzada. El quitanieves solo puede con la calle", en = "drive down the road. The plow only works on the street" },
	},
	{
		clave = "fin",
		titulo = { es = "EL BARRIO ESTA DESPIERTO", en = "THE NEIGHBOURHOOD IS AWAKE" },
		pie = { es = "y el pueblo entero sigue ahi debajo", en = "and the whole town is still down there" },
	},
}


-------------------------------------------------------------------
--  LO QUE SE DESCUBRE, Y EN QUE ORDEN
--
--  Un hallazgo salta cuando la nieve de encima baja POR DEBAJO de la
--  altura real de la cosa. La geometria manda: lo que se anuncia es
--  exactamente lo que se ve.
-------------------------------------------------------------------

Ajustes.hallazgos = {
	{ clave = "buzon", nombre = { es = "TU BUZON", en = "YOUR MAILBOX" } },
	{ clave = "tejado", nombre = { es = "EL TEJADO", en = "THE ROOF" } },
	{ clave = "porche", nombre = { es = "EL PORCHE", en = "THE PORCH" } },
	{ clave = "ventana", nombre = { es = "UNA VENTANA", en = "A WINDOW" } },
	{ clave = "puerta", nombre = { es = "¡LA PUERTA DE TU CASA!", en = "YOUR FRONT DOOR!" } },
	{ clave = "garaje", nombre = { es = "¡EL GARAJE!", en = "THE GARAGE!" } },
	{ clave = "coche", nombre = { es = "¡TU COCHE!", en = "YOUR CAR!" } },
	{ clave = "carretera", nombre = { es = "¡LA CARRETERA!", en = "THE ROAD!" } },
	{ clave = "vecino", nombre = { es = "¡LA PUERTA DEL VECINO!", en = "YOUR NEIGHBOUR'S DOOR!" } },
	{ clave = "buzonVecino", nombre = { es = "EL BUZON DE ENFRENTE", en = "THE NEIGHBOUR'S MAILBOX" } },
	{ clave = "parada", nombre = { es = "¡LA PARADA DEL AUTOBUS!", en = "THE BUS STOP!" } },
	{ clave = "plaza", nombre = { es = "¡LA PLAZA DEL PUEBLO!", en = "THE TOWN SQUARE!" } },
}


-------------------------------------------------------------------
--  DINERO
--
--  Un numero que sube. Todavia no compra nada, y las herramientas no se
--  compran nunca: se encuentran.
-------------------------------------------------------------------

Ajustes.dinero = {
	porCapa = 1,
}


-------------------------------------------------------------------
--  TEXTOS
-------------------------------------------------------------------

Ajustes.textos = {
	es = {
		lleno = "¡CARRETILLA LLENA! vacia en el monton",
		carga = "NIEVE",
		monedas = "MONEDAS",
		descubierto = "HAS DESCUBIERTO",
		profundidad = "%d capas de nieve encima",
		despejado = "despejado",
		cavar = "CAVAR",
		soplar = "SOPLAR",
		cambiar = "CAMBIAR (Q)",
		cogida = "¡SOPLADORA LISTA!  Q para cambiar",
		cogela = "COGE LA SOPLADORA",
		llaves = "¡LAS LLAVES DEL QUITANIEVES!",
		alQuitanieves = "SUBETE AL QUITANIEVES",
		conduce = "W/S para andar, A/D para girar",
		soloCalle = "el quitanieves solo puede con la calle",
		atascado = "ATASCADO: pulsa RECUPERAR",
		recuperar = "RECUPERAR",
		bajar = "BAJAR",
		soloPala = "lo que queda es para la PALA (Q)",
		manten = "MANTEN PULSADO PARA CAVAR",
		mantenPie = "raton, E, o el boton de la derecha",
		mantenPC = "MANTEN CLIC O E PARA CAVAR",
		mantenMando = "MANTEN EL GATILLO DERECHO",
		gatillo = "RT",
		ensancha = "AQUI YA NO BAJAS: ensancha el hoyo",
		tuParcela = "ESTA ES TU PARCELA",
		ajena = "ayudando a %s",
		guardado = "partida guardada",
		sinGuardado = "SIN GUARDADO (Studio): la partida no se conserva",
		tormentaViene = "AVISO METEOROLOGICO",
		tormentaVienePie = "vuelve a nevar. Y fuerte",
		rutaTitulo = "MANTEN ABIERTA LA RUTA DE EMERGENCIA",
		rutaPie = "el camion de suministros no puede pasar",
		bloqueosQuedan = "quedan %d bloqueos",
		bloqueoUltimo = "queda 1 bloqueo",
		despejado1 = "DESPEJADO",
		camionEnCamino = "EL CAMION YA VIENE",
		camionLlega = "¡EL CAMION HA LLEGADO A LA PLAZA!",
		arbolCaido = "UN ARBOL CAIDO CORTA LA CALLE",
		arbolPie = "no se puede quitar: hay que rodear por el arcen",
		tormentaFin = "LA TORMENTA HA PASADO",
		reputacion = "REPUTACION",
		tormentasSuperadas = "TORMENTAS",
		ayuntamiento = "EL AYUNTAMIENTO HA ABIERTO",
		balizaNueva = "TU QUITANIEVES LLEVA AHORA LUZ DE EMERGENCIA",
		soloQuitanieves = "esto es nieve de calzada: quitanieves",
		soloSopladora = "aqui no entra la maquina: sopladora",
		soloPalaAqui = "nieve prensada: solo con la PALA",
	},
	en = {
		lleno = "WHEELBARROW FULL! dump it on the pile",
		carga = "SNOW",
		monedas = "COINS",
		descubierto = "YOU UNCOVERED",
		profundidad = "%d layers of snow on top",
		despejado = "clear",
		cavar = "DIG",
		soplar = "BLOW",
		cambiar = "SWAP (Q)",
		cogida = "BLOWER READY!  press Q to swap",
		cogela = "GRAB THE SNOW BLOWER",
		llaves = "THE PLOW KEYS!",
		alQuitanieves = "GET ON THE SNOW PLOW",
		conduce = "W/S to drive, A/D to steer",
		soloCalle = "the plow only works on the street",
		atascado = "STUCK: press RECOVER",
		recuperar = "RECOVER",
		bajar = "GET OFF",
		soloPala = "the last of it is SHOVEL work (Q)",
		manten = "HOLD TO DIG",
		mantenPie = "mouse, E, or the button on the right",
		mantenPC = "HOLD CLICK OR E TO DIG",
		mantenMando = "HOLD THE RIGHT TRIGGER",
		gatillo = "RT",
		ensancha = "CANNOT GO DEEPER HERE: widen the pit",
		tuParcela = "THIS IS YOUR PLOT",
		ajena = "helping %s",
		guardado = "game saved",
		sinGuardado = "NO SAVING (Studio): this game will not be kept",
		tormentaViene = "WEATHER WARNING",
		tormentaVienePie = "it is snowing again. Hard",
		rutaTitulo = "KEEP THE EMERGENCY ROUTE OPEN",
		rutaPie = "the supply truck cannot get through",
		bloqueosQuedan = "%d blockages left",
		bloqueoUltimo = "1 blockage left",
		despejado1 = "CLEAR",
		camionEnCamino = "THE TRUCK IS ON ITS WAY",
		camionLlega = "THE TRUCK MADE IT TO THE SQUARE!",
		arbolCaido = "A FALLEN TREE BLOCKS THE ROAD",
		arbolPie = "it cannot be moved: go round by the shoulder",
		tormentaFin = "THE STORM HAS PASSED",
		reputacion = "REPUTATION",
		tormentasSuperadas = "STORMS",
		ayuntamiento = "THE TOWN HALL IS OPEN",
		balizaNueva = "YOUR PLOW NOW CARRIES AN EMERGENCY BEACON",
		soloQuitanieves = "this is roadway snow: use the plow",
		soloSopladora = "the plow cannot reach here: blower",
		soloPalaAqui = "packed snow: SHOVEL only",
	},
}

function Ajustes.texto(idioma, clave)
	local tabla = Ajustes.textos[idioma] or Ajustes.textos.en
	return tabla[clave] or Ajustes.textos.en[clave] or clave
end

function Ajustes.nombre(tabla, idioma)
	if type(tabla) ~= "table" then
		return tostring(tabla)
	end
	return tabla[idioma] or tabla.en or ""
end

function Ajustes.capitulo(clave)
	for i, cap in ipairs(Ajustes.capitulos) do
		if cap.clave == clave then
			return cap, i
		end
	end
	return Ajustes.capitulos[1], 1
end

return Ajustes
