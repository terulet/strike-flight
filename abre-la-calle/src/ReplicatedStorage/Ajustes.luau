--[[
	ABRE LA CALLE  —  ajustes

	Segunda vertical. La primera termino en "he encontrado mi puerta".
	Esta empieza ahi y termina en "hay alguien mas ahi abajo".

	El guion entero, de principio a fin:

	    buzon  ->  tejado  ->  ventana  ->  porche  ->  PUERTA
	                                                     |
	                                              se abre, sale luz,
	                                              humo en la chimenea
	                                                     |
	                                                  GARAJE
	                                                     |
	                                            dentro hay una SOPLADORA
	                                                     |
	                                       la entrada hasta la CARRETERA
	                                                     |
	                                        al otro lado sale humo: VECINO

	Ni tienda, ni renacimiento, ni guardado. Una sesion de diez minutos
	que se entienda sola. Si esto no engancha, no hay juego.
]]

local Ajustes = {}

Ajustes.version = "3.0.0-abre-la-calle"
Ajustes.idiomaFijo = nil


-------------------------------------------------------------------
--  LA NIEVE
--
--  La profundidad va en CAPAS, no en studs. Una pasada quita una capa.
--  Asi la nieve honda cuesta varias pasadas y la pendiente se forma sola.
-------------------------------------------------------------------

Ajustes.nieve = {
	celda = 4,          -- studs de lado (es el cubo del terreno de Roblox)
	capa = 2,           -- studs de alto por capa
	-- 10 capas = 20 studs. Tiene que tapar el tejado ENTERO, o el
	-- "descubrimiento" del tejado llega cuando ya se veia desde el minuto
	-- cero. La altura de la casa manda sobre este numero.
	capasMaximas = 10,

	-- LA REGLA QUE HACE QUE NO TE QUEDES ENCERRADO: al bajar una casilla
	-- no puede abrirse con ninguna de sus ocho vecinas un escalon mayor
	-- que esto. Se aplica al generar y al excavar, asi que no existe el
	-- pozo vertical del que no se sale.
	--
	-- Dos capas = 4 studs, que se saltan. Con una, el cono que hay que
	-- vaciar para llegar al fondo era enorme y el juego se atascaba con la
	-- casa ya a la vista.
	desnivelMaximo = 2,

	-- Contra las fachadas se amontona mas.
	capasContraLaCasa = 13,

	-- Y hay dos sitios donde la nieve se ceba, que son justo los dos que
	-- hacen falta para el guion: la maquina quitanieves paso por la calle
	-- y dejo un muro delante del garaje y otro delante del vecino.
	capasContraElGaraje = 14,
	capasContraElVecino = 15,
}


-------------------------------------------------------------------
--  LA PARCELA
--
--  Todo el estado de la nieve vive dentro de una parcela. Hoy hay una;
--  manana habra una por jugador y no hay que tocar el excavador.
-------------------------------------------------------------------

Ajustes.parcela = {
	ancho = 44,         -- casillas (176 studs)
	largo = 60,         -- casillas (240 studs): ahora hay que llegar a la calle
	separacion = 80,
}


-------------------------------------------------------------------
--  EL SITIO
--
--  Todo en casillas contadas desde el fondo de la parcela. Mover la
--  carretera es cambiar un numero: el perfil de nieve, los edificios y
--  los hallazgos salen todos de aqui.
--
--        cz 0   fondo de la parcela
--        cz 11  TU CASA (fachada mirando a +Z) y el garaje a un lado
--        cz 15..22  la entrada de coches
--        cz 26  LA CARRETERA
--        cz 50  LA CASA DEL VECINO (fachada mirando a -Z, hacia ti)
--        cz 59  el borde
--
--  La calle esta a unos cuarenta studs de tu puerta. Escrito asi parece
--  poco; con tres metros de nieve encima es un buen rato de trabajo. Y
--  sobre todo se ve la casa desde la calle y la calle desde la casa: si
--  se separan mas, la partida se convierte en un paseo.
Ajustes.sitio = {
	czCasa = 11,         -- centro de tu casa
	czCarretera = 26,    -- centro de la calzada
	anchoCarretera = 7,  -- casillas de calzada
	czVecino = 50,       -- centro de la casa del vecino
	capasCarretera = 17, -- la calle esta MAS enterrada: nevada de las gordas
	czBuzon = 17,        -- el buzon, al borde: el primer hallazgo, en segundos
	cxBuzon = 41,
	capasBuzon = 6,      -- el monton que lo tapa: unas paladas y ahi esta
	anchoRepecho = 4,    -- casillas de nieve fina en la entrada a la parcela
	anchoEntrada = 7,    -- casillas de ancho de la entrada de coches
	radioCogida = 9,     -- a que distancia se recoge la sopladora
	-- Cuando se da la entrada por abierta: pasable, no impecable.
	capasEntradaPasable = 2,
}


-------------------------------------------------------------------
--  LAS DOS HERRAMIENTAS
--
--  No son "la misma pero mas rapida". Hacen cosas distintas, y esa es la
--  gracia:
--
--    PALA       cuchara redonda, poca superficie, pero LLEGA AL SUELO.
--               Es la unica que descubre nada: lo que aparece, aparece
--               porque lo has palado tu.
--
--    SOPLADORA  franja ancha por delante, se come las capas de arriba a
--               toda velocidad y escupe la nieve a un lado en montones.
--               Pero DEJA UN COLCHON: no raspa el suelo. Con ella abres
--               la calle; para descubrir lo de debajo, la pala.
--
--  O sea: la sopladora barre, la pala descubre. Hacen falta las dos.
-------------------------------------------------------------------

Ajustes.herramientas = {
	pala = {
		clave = "pala",
		nombre = { es = "PALA", en = "SHOVEL" },
		golpe = 0.42,        -- lo que dura una palada
		potencia = 14,       -- casillas por palada
		radio = 11,          -- cuchara redonda alrededor
		dejaCapas = 0,       -- llega al suelo
	},
	sopladora = {
		clave = "sopladora",
		nombre = { es = "SOPLADORA", en = "SNOW BLOWER" },
		golpe = 0.3,
		potencia = 40,       -- muchas casillas de golpe...
		ancho = 30,          -- ...en una franja ancha POR DELANTE
		fondo = 16,
		dejaCapas = 2,       -- ...pero nunca raspa el suelo
		desvio = 17,         -- a que lado escupe el monton
	},
}


-------------------------------------------------------------------
--  EL JUGADOR
-------------------------------------------------------------------

Ajustes.jugador = {
	tic = 0.12,
	-- Cavar es una ACCION: hay que mantener pulsado. Quieto no pasa nada.
	capacidad = 700,    -- capas que caben en la carretilla
	velocidad = 17,
	radioDescarga = 14,
	alturaMaxima = 44,  -- por encima de esto no se excava
}


-------------------------------------------------------------------
--  LOS EDIFICIOS
-------------------------------------------------------------------

Ajustes.casa = {
	ancho = 34,
	fondo = 24,
	alto = 11,
	alturaChimenea = 30,   -- tiene que superar el ventisquero de la casa
	pasosTejado = 6,       -- escalones de la cubierta inclinada
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
--  Cada capitulo dice que se busca. El jugador NUNCA ve un menu de
--  tienda: ve el siguiente misterio y hacia donde cavar.
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
		titulo = { es = "ALGUIEN VIVE AHI ENFRENTE", en = "SOMEBODY LIVES ACROSS THE ROAD" },
		pie = { es = "sale humo de debajo de la nieve. Desentierra su entrada", en = "smoke from under the snow. Dig out their door" },
	},
	{
		clave = "fin",
		titulo = { es = "Y ESTO ERA SOLO LA PRIMERA CALLE", en = "AND THAT WAS JUST THE FIRST STREET" },
		pie = { es = "el pueblo entero sigue ahi debajo", en = "the whole town is still down there" },
	},
}


-------------------------------------------------------------------
--  LO QUE SE DESCUBRE, Y EN QUE ORDEN
--
--  Un hallazgo salta cuando la nieve de encima baja POR DEBAJO de la
--  altura real de la cosa. Nada de umbrales a ojo: la geometria manda,
--  asi que lo que se anuncia es exactamente lo que se ve.
-------------------------------------------------------------------

Ajustes.hallazgos = {
	{ clave = "buzon", donde = "buzon", nombre = { es = "TU BUZON", en = "YOUR MAILBOX" } },
	{ clave = "tejado", donde = "fachada", nombre = { es = "EL TEJADO", en = "THE ROOF" } },
	{ clave = "porche", donde = "fachada", nombre = { es = "EL PORCHE", en = "THE PORCH" } },
	{ clave = "ventana", donde = "fachada", nombre = { es = "UNA VENTANA", en = "A WINDOW" } },
	{ clave = "puerta", donde = "fachada", nombre = { es = "¡LA PUERTA DE TU CASA!", en = "YOUR FRONT DOOR!" } },
	{ clave = "garaje", donde = "garaje", nombre = { es = "¡EL GARAJE!", en = "THE GARAGE!" } },
	{ clave = "carretera", donde = "carretera", nombre = { es = "¡LA CARRETERA!", en = "THE ROAD!" } },
	{ clave = "vecino", donde = "vecino", nombre = { es = "¡LA CASA DEL VECINO!", en = "THE NEIGHBOUR'S HOUSE!" } },
}


-------------------------------------------------------------------
--  DINERO
--
--  La pala basica tiene que poder terminar el juego. El dinero es un
--  numero que sube, no un peaje: aqui todavia no compra nada.
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
		puertaAbierta = "TU CASA",
		soloPala = "lo que queda es para la PALA (Q)",
		manten = "MANTEN PULSADO PARA CAVAR",
		mantenPie = "raton, E, o el boton de la derecha",
		ensancha = "AQUI YA NO BAJAS: ensancha el hoyo",
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
		puertaAbierta = "YOUR HOUSE",
		soloPala = "the last of it is SHOVEL work (Q)",
		manten = "HOLD TO DIG",
		mantenPie = "mouse, E, or the button on the right",
		ensancha = "CANNOT GO DEEPER HERE: widen the pit",
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

-- El capitulo por su clave, para no ir contando indices por ahi.
function Ajustes.capitulo(clave)
	for i, cap in ipairs(Ajustes.capitulos) do
		if cap.clave == clave then
			return cap, i
		end
	end
	return Ajustes.capitulos[1], 1
end

return Ajustes
