--[[
	DESENTIERRA  —  ajustes

	La primera vertical: entras, ves una chimenea asomando, excavas una
	pendiente y descubres la puerta de tu casa.

	Si eso emociona, hay juego. Si no, no lo hay, y mejor saberlo aqui que
	despues de construir el pueblo entero.
]]

local Ajustes = {}

Ajustes.version = "2.0.0-vertical"
Ajustes.idiomaFijo = nil


-------------------------------------------------------------------
--  LA NIEVE
--
--  La profundidad va en CAPAS, no en studs. Una pasada de pala quita
--  una capa. Asi la nieve honda cuesta varias pasadas y la pendiente
--  se forma sola.
-------------------------------------------------------------------

Ajustes.nieve = {
	celda = 4,          -- studs de lado (es el cubo del terreno de Roblox)
	capa = 2,           -- studs de alto por capa
	-- 10 capas = 20 studs. Tiene que tapar el tejado ENTERO, o el
	-- "descubrimiento" del tejado llega cuando ya se veia desde el minuto
	-- cero. La altura de la casa manda sobre este numero.
	capasMaximas = 10,

	-- LA REGLA QUE HACE QUE NO TE QUEDES ENCERRADO: dos casillas vecinas
	-- no pueden diferenciarse en mas de una capa. Se aplica al generar y
	-- al excavar, asi que no hay forma de abrir un pozo vertical.
	-- Dos capas (4 studs). Con una, el cono que hay que vaciar para llegar
	-- al fondo era enorme y el juego bloqueaba con la casa ya a la vista.
	-- Con dos, el cono es la cuarta parte y se sigue sin poder abrir un
	-- pozo del que no se salga: 4 studs se saltan.
	desnivelMaximo = 2,

	-- Contra la fachada se amontona mas.
	capasContraLaCasa = 12,
}


-------------------------------------------------------------------
--  LA PARCELA
--
--  Todo el estado de la nieve vive dentro de una parcela. Hoy hay una;
--  manana habra una por jugador y no hay que tocar el excavador.
-------------------------------------------------------------------

Ajustes.parcela = {
	ancho = 44,         -- casillas
	largo = 44,
	separacion = 80,    -- studs entre una parcela y la siguiente
}


-------------------------------------------------------------------
--  EL JUGADOR
-------------------------------------------------------------------

Ajustes.jugador = {
	tic = 0.12,
	-- Cavar es una ACCION: hay que mantener pulsado. Quieto no pasa nada.
	golpe = 0.42,       -- lo que dura una palada de principio a fin
	radio = 11,         -- lo ancho que barre la pala (casi 3 casillas)
	potencia = 14,      -- casillas por palada (casi toda la cuchara)
	capacidad = 700,    -- capas que caben en la carretilla
	velocidad = 16,
	radioDescarga = 12,
	alturaMaxima = 40,  -- por encima de esto no se excava
}


-------------------------------------------------------------------
--  LA CASA
--
--  Enterrada entera menos la chimenea. Las medidas estan pensadas para
--  que asome exactamente eso y nada mas.
-------------------------------------------------------------------

Ajustes.casa = {
	ancho = 34,
	fondo = 24,
	alto = 11,
	alturaChimenea = 28,   -- tiene que superar las 10 capas (20 studs)
	pasosTejado = 6,       -- escalones de la cubierta inclinada
	altoPaso = 1.05,
	porcheFondo = 9,
	garajeAncho = 16,
	puertaAncho = 6,
	puertaAlto = 9,
}


-------------------------------------------------------------------
--  LO QUE SE DESCUBRE, Y EN QUE ORDEN
--
--  Cada hallazgo es una caja: cuando la nieve de encima baja de cierta
--  capa, se da por descubierto y se avisa.
-------------------------------------------------------------------

-- La altura en studs a la que cada cosa queda a la vista. El servidor la
-- convierte en capas con la geometria de la casa: asi el aviso salta
-- cuando la cosa se ve DE VERDAD, y no antes ni despues.
Ajustes.hallazgos = {
	{ clave = "tejado", donde = "alrededor", nombre = { es = "EL TEJADO", en = "THE ROOF" } },
	{ clave = "ventana", donde = "fachada", nombre = { es = "UNA VENTANA", en = "A WINDOW" } },
	{ clave = "porche", donde = "fachada", nombre = { es = "EL PORCHE", en = "THE PORCH" } },
	{ clave = "puerta", donde = "fachada", nombre = { es = "¡LA PUERTA DE TU CASA!", en = "YOUR FRONT DOOR!" } },
}


-------------------------------------------------------------------
--  DINERO
--
--  La pala basica tiene que poder terminar el juego. El dinero es apoyo,
--  no un peaje: nunca puede bloquear.
-------------------------------------------------------------------

Ajustes.dinero = {
	porCapa = 1,
}


-------------------------------------------------------------------
--  TEXTOS
-------------------------------------------------------------------

Ajustes.textos = {
	es = {
		objetivo1 = "ENCUENTRA LA PUERTA DE TU CASA",
		objetivo1pie = "esa chimenea de ahi es la tuya. Cava hacia ella",
		objetivo2 = "SIGUE CAVANDO, YA ASOMA",
		objetivo2pie = "hay que ensanchar para poder bajar",
		objetivoFin = "TU CASA ESTA LIBRE",
		objetivoFinPie = "y esto era solo la primera",
		lleno = "¡CARRETILLA LLENA! vacia en el monton",
		carga = "NIEVE",
		monedas = "MONEDAS",
		descubierto = "HAS DESCUBIERTO",
		profundidad = "%d capas de nieve encima",
		cavar = "CAVAR",
		manten = "MANTEN PULSADO PARA CAVAR",
		mantenPie = "raton, espacio, o el boton de la derecha",
		ensancha = "AQUI YA NO BAJAS: ensancha el hoyo",
	},
	en = {
		objetivo1 = "FIND YOUR FRONT DOOR",
		objetivo1pie = "that chimney is yours. Dig towards it",
		objetivo2 = "KEEP DIGGING, IT IS SHOWING",
		objetivo2pie = "you have to widen before you can go deeper",
		objetivoFin = "YOUR HOUSE IS FREE",
		objetivoFinPie = "and that was only the first one",
		lleno = "WHEELBARROW FULL! dump it on the pile",
		carga = "SNOW",
		monedas = "COINS",
		descubierto = "YOU UNCOVERED",
		profundidad = "%d layers of snow on top",
		cavar = "DIG",
		manten = "HOLD TO DIG",
		mantenPie = "mouse, space, or the button on the right",
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

return Ajustes
