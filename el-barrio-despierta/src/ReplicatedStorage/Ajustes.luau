--[[
	EL BARRIO DESPIERTA  —  ajustes

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

Ajustes.version = "4.0.0-el-barrio-despierta"
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
	capasContraElGaraje = 26,
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
	capasCarretera = 21,  -- el muro que dejo la maquina en tu entrada
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
		potencia = 3,
		radio = 11,
		dejaCapas = 0,
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
		-- ...pero solo muerde donde ya queda poca nieve. Contra el muro de
		-- tu entrada (diecisiete capas) no puede: eso es de pala y
		-- sopladora. Y es tambien lo que puede pisar sin atascarse.
		capasMaximas = 6,
		velocidad = 10,
		giro = 1.7,       -- radianes por segundo
		desvio = 22,      -- a que distancia deja los montones
	},
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
		ensancha = "AQUI YA NO BAJAS: ensancha el hoyo",
		tuParcela = "ESTA ES TU PARCELA",
		ajena = "ayudando a %s",
		guardado = "partida guardada",
		sinGuardado = "SIN GUARDADO (Studio): la partida no se conserva",
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
		ensancha = "CANNOT GO DEEPER HERE: widen the pit",
		tuParcela = "THIS IS YOUR PLOT",
		ajena = "helping %s",
		guardado = "game saved",
		sinGuardado = "NO SAVING (Studio): this game will not be kept",
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
