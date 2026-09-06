--[[
	AJUSTES  —  ¡QUITA TODA LA NIEVE!  /  SHOVEL ALL THE SNOW!

	Todo lo que se toca esta aqui. Los otros dos archivos no llevan
	ni un numero suelto: leen de esta tabla.

	Cambias un numero, le das a jugar, y ya se ve. No hay que compilar
	nada ni tocar el resto del codigo.

	Este archivo va en:  ReplicatedStorage  (ModuleScript, nombre "AjustesNieve")
]]

local Ajustes = {}

Ajustes.version = "1.0.0"

-- Nombre que sale en el cartel de la entrada.
Ajustes.titulo = { es = "¡QUITA TODA LA NIEVE!", en = "SHOVEL ALL THE SNOW!" }

-- El idioma se saca del jugador (español o ingles). Pon "es" o "en" aqui
-- para forzarlo siempre a uno.
Ajustes.idiomaFijo = nil


-------------------------------------------------------------------
--  EL MUNDO
-------------------------------------------------------------------

Ajustes.mundo = {
	celda = 4,            -- studs de lado por defecto (cada zona puede pisarlo)
	alturaNieve = 1,      -- grosor del bloque
	separacion = 26,      -- calle entre una zona y la siguiente
	alturaValla = 16,     -- alto de las puertas y del vallado

	-- Cada bloque recogido vuelve a nevar pasados estos segundos.
	-- Con gente el mapa se queda pelado, asi que la nieve vuelve mas
	-- rapido cuanta mas gente hay (ver regresoMinimo).
	regreso = 40,
	regresoPorJugador = 6,   -- divisor: 40s con 1 jugador, ~9s con 20
	regresoMinimo = 8,
	maxRegresoPorTanda = 120, -- bloques que vuelven por segundo, como mucho
}


-------------------------------------------------------------------
--  EL JUGADOR
-------------------------------------------------------------------

Ajustes.jugador = {
	tic = 0.1,              -- cada cuanto se mira si hay nieve debajo

	radioBase = 5.5,        -- lo ancho que barre la pala, en studs
	radioPorNivel = 0.75,

	potenciaBase = 1,       -- bloques por tic (10 por segundo con tic 0.1)
	potenciaPorNivel = 1,

	capacidadBase = 30,     -- bloques que caben antes de ir a vender
	capacidadPorNivel = 20,

	velocidadBase = 16,     -- lo normal de Roblox
	velocidadPorNivel = 1.3,

	radioVenta = 11,        -- cerca del camion se vende solo
	alturaMaxima = 14,      -- si vuelas por encima de esto, no recoges
}


-------------------------------------------------------------------
--  LAS MEJORAS
--
--  precio = lo que cuesta pasar del nivel 1 al 2
--  factor = cuanto se multiplica cada nivel siguiente
-------------------------------------------------------------------

Ajustes.mejoras = {
	{
		clave = "pala",
		niveles = 15,
		precio = 40,
		factor = 2.0,
		nombre = { es = "PALA", en = "SHOVEL" },
		desc = { es = "barre mas ancho y mas rapido", en = "wider and faster scoop" },
		color = Color3.fromRGB(120, 205, 255),
	},
	{
		clave = "carretilla",
		niveles = 15,
		precio = 30,
		factor = 2.0,
		nombre = { es = "CARRETILLA", en = "WHEELBARROW" },
		desc = { es = "cabe mas nieve, menos viajes", en = "more snow, fewer trips" },
		color = Color3.fromRGB(255, 208, 92),
	},
	{
		clave = "botas",
		niveles = 10,
		precio = 100,
		factor = 2.3,
		nombre = { es = "BOTAS", en = "BOOTS" },
		desc = { es = "andas mas rapido", en = "you walk faster" },
		color = Color3.fromRGB(150, 240, 170),
	},
}


-------------------------------------------------------------------
--  LAS ZONAS
--
--  ancho y largo van en casillas, no en studs
--  celda  = lo que mide de lado una casilla, en studs. Crece con la
--           zona: asi la parcela es mucho mas grande sin poner mas
--           piezas, y da tiempo a que vuelva a nevar donde ya pasaste
--  valor  = lo que vale cada bloque de nieve de esa zona
--  precio = lo que cuesta abrir la puerta
-------------------------------------------------------------------

Ajustes.zonas = {
	{
		clave = "entrada",
		celda = 4,
		ancho = 20, largo = 14,
		valor = 1,
		precio = 0,
		nombre = { es = "TU ENTRADA", en = "YOUR DRIVEWAY" },
		suelo = Color3.fromRGB(104, 104, 112),
		decorado = "casa",
	},
	{
		clave = "acera",
		celda = 4,
		ancho = 24, largo = 16,
		valor = 5,
		precio = 500,
		nombre = { es = "LA ACERA", en = "THE SIDEWALK" },
		suelo = Color3.fromRGB(150, 150, 158),
		decorado = "farolas",
	},
	{
		clave = "parque",
		celda = 5,
		ancho = 28, largo = 20,
		valor = 25,
		precio = 8000,
		nombre = { es = "EL PARQUE", en = "THE PARK" },
		suelo = Color3.fromRGB(92, 124, 88),
		decorado = "arboles",
	},
	{
		clave = "parking",
		celda = 6,
		ancho = 32, largo = 22,
		valor = 120,
		precio = 80000,
		nombre = { es = "EL APARCAMIENTO", en = "THE PARKING LOT" },
		suelo = Color3.fromRGB(64, 66, 74),
		decorado = "coches",
	},
	{
		clave = "montana",
		celda = 7,
		ancho = 36, largo = 24,
		valor = 750,
		precio = 450000,
		nombre = { es = "LA MONTAÑA", en = "THE MOUNTAIN" },
		suelo = Color3.fromRGB(196, 208, 224),
		decorado = "rocas",
	},
}


-------------------------------------------------------------------
--  RENACER
--
--  Se vacia todo (dinero, mejoras y zonas) a cambio de cobrar mas
--  para siempre. Es lo que hace que la segunda partida sea corta.
-------------------------------------------------------------------

Ajustes.renacer = {
	precio = 3500000,    -- lo que cuesta el primero
	factor = 3,          -- cada uno cuesta el triple que el anterior
	bonus = 1,           -- x2 de dinero al primero, x3 al segundo...
}


-------------------------------------------------------------------
--  PASES (opcional, para cuando lo publiques)
--
--  Crea el pase en la web de Roblox, copia su id y pegalo aqui.
--  Con 0 el pase no existe y no pasa nada.
-------------------------------------------------------------------

Ajustes.pases = {
	dobleDinero = 0,
	dobleCarretilla = 0,
}


-------------------------------------------------------------------
--  GUARDADO
-------------------------------------------------------------------

Ajustes.guardado = {
	almacen = "NieveV1",  -- cambiar el nombre = empezar de cero todo el mundo
	cada = 120,           -- autoguardado, en segundos
	intentos = 3,
}


-------------------------------------------------------------------
--  TEXTOS
-------------------------------------------------------------------

Ajustes.textos = {
	es = {
		monedas = "MONEDAS",
		carga = "CARGA",
		lleno = "¡LLENA! vete al camion",
		limpio = "%d%% limpio",
		mejoras = "MEJORAS",
		comprar = "COMPRAR",
		maximo = "AL MAXIMO",
		nivel = "Nv %d",
		renacer = "RENACER",
		renacerDesc = "vacia todo y cobras x%d para siempre",
		renacerFalta = "abre todas las zonas primero",
		vender = "VENDER",
		abrir = "ABRIR",
		sinDinero = "te falta dinero",
		vendido = "+%s",
		pistaAndar = "Anda por encima de la nieve para recogerla",
		pistaVender = "Llevala al camion y se vende sola",
		pistaZona = "Nieve mas cara al otro lado de la puerta",
		bienvenida = "Bienvenido de vuelta",
		sinGuardado = "no he podido leer tu partida: hoy no se guarda",
	},
	en = {
		monedas = "COINS",
		carga = "LOAD",
		lleno = "FULL! get to the truck",
		limpio = "%d%% clean",
		mejoras = "UPGRADES",
		comprar = "BUY",
		maximo = "MAXED",
		nivel = "Lv %d",
		renacer = "REBIRTH",
		renacerDesc = "wipes everything, you earn x%d forever",
		renacerFalta = "open every area first",
		vender = "SELL",
		abrir = "OPEN",
		sinDinero = "not enough coins",
		vendido = "+%s",
		pistaAndar = "Walk over the snow to shovel it",
		pistaVender = "Take it to the truck, it sells itself",
		pistaZona = "Pricier snow past the gate",
		bienvenida = "Welcome back",
		sinGuardado = "could not read your save: progress will not be stored",
	},
}

-- Devuelve el texto en el idioma pedido. Si falta, tira del ingles.
function Ajustes.texto(idioma, clave)
	local tabla = Ajustes.textos[idioma] or Ajustes.textos.en
	return tabla[clave] or Ajustes.textos.en[clave] or clave
end

-- Los nombres de zonas y mejoras viven en su propia tabla ({es=..., en=...}).
function Ajustes.nombre(tabla, idioma)
	if type(tabla) ~= "table" then
		return tostring(tabla)
	end
	return tabla[idioma] or tabla.en or ""
end

return Ajustes
