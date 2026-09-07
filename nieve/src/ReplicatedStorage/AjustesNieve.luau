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
--  suelo/material = lo que queda A LA VISTA cuando quitas la nieve. Es
--           media gracia del juego: no descubres hormigon, descubres
--           cesped, el agua de la piscina o la pista de tenis
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
		nombre = { es = "LA ENTRADA", en = "THE DRIVEWAY" },
		suelo = Color3.fromRGB(74, 76, 82),
		material = "Asphalt",
		decorado = "casa",
	},
	{
		clave = "jardin",
		celda = 4,
		ancho = 24, largo = 16,
		valor = 6,
		precio = 500,
		nombre = { es = "EL JARDIN", en = "THE GARDEN" },
		suelo = Color3.fromRGB(96, 150, 76),
		material = "Grass",
		decorado = "jardin",
	},
	{
		clave = "piscina",
		celda = 5,
		ancho = 28, largo = 20,
		valor = 34,
		precio = 7000,
		nombre = { es = "LA PISCINA", en = "THE POOL" },
		suelo = Color3.fromRGB(228, 216, 196),
		material = "Concrete",
		decorado = "piscina",
	},
	{
		clave = "tenis",
		celda = 6,
		ancho = 32, largo = 22,
		valor = 165,
		precio = 70000,
		nombre = { es = "LA PISTA DE TENIS", en = "THE TENNIS COURT" },
		suelo = Color3.fromRGB(52, 104, 154),
		material = "Concrete",
		decorado = "tenis",
	},
	{
		clave = "bosque",
		celda = 7,
		ancho = 36, largo = 24,
		valor = 1050,
		precio = 380000,
		nombre = { es = "EL BOSQUE", en = "THE WOODS" },
		suelo = Color3.fromRGB(122, 106, 88),
		material = "Ground",
		decorado = "bosque",
	},
}


-------------------------------------------------------------------
--  RENACER
--
--  Se vacia todo (dinero, mejoras y zonas) a cambio de cobrar mas
--  para siempre. Es lo que hace que la segunda partida sea corta.
-------------------------------------------------------------------

Ajustes.renacer = {
	precio = 3000000,    -- lo que cuesta el primero
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
--  PREMIO DIARIO
--
--  El premio se mide en BLOQUES DE TU MEJOR ZONA, no en monedas
--  fijas. Asi es un regalo el primer dia y sigue siendo un regalo
--  veinte horas de juego despues.
-------------------------------------------------------------------

Ajustes.diario = {
	bloques = 250,
	rachaMaxima = 7,
	horasParaPerderla = 48,  -- si tardas mas en volver, la racha se cae a 1
}


-------------------------------------------------------------------
--  CODIGOS
--
--  Para soltarlos en TikTok o en la descripcion del juego. Se canjean
--  una vez por jugador. Anadir uno es anadir una linea aqui.
-------------------------------------------------------------------

Ajustes.codigos = {
	{ clave = "NIEVE", bloques = 300 },
	{ clave = "GRACIAS", bloques = 400 },
	{ clave = "PRIMERANEVADA", bloques = 800 },
}


-------------------------------------------------------------------
--  TABLA DE RECORDS
--
--  Se ordena por nieve recogida en total, que es lo unico que no se
--  borra al renacer.
-------------------------------------------------------------------

Ajustes.records = {
	almacen = "RecordNieveV1",
	cuantos = 10,
	refresco = 90,     -- cada cuantos segundos se relee la tabla
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
		guia1 = "ANDA POR ENCIMA DE LA NIEVE",
		guia1pie = "se recoge sola, no hay que pulsar nada",
		guia2 = "SIGUE, HASTA LLENAR LA CARRETILLA",
		guia2pie = "mira la barra de abajo",
		guia3 = "AHORA AL CAMION, A VENDERLA",
		guia3pie = "acercate y se vende sola",
		guia4 = "PULSA MEJORAS Y COMPRA LA PALA",
		guia4pie = "cada mejora se nota enseguida",
		bienvenida = "Bienvenido de vuelta",
		sinGuardado = "no he podido leer tu partida: hoy no se guarda",
		diario = "PREMIO DIARIO",
		diarioRacha = "dia %d seguido",
		codigos = "CODIGOS",
		codigoCaja = "escribe un codigo",
		canjear = "CANJEAR",
		codigoMal = "ese codigo no existe",
		codigoUsado = "ese ya lo has usado",
		records = "MAS NIEVE RECOGIDA",
		tablaVacia = "todavia no hay nadie",
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
		guia1 = "WALK OVER THE SNOW",
		guia1pie = "it shovels itself, no buttons",
		guia2 = "KEEP GOING, FILL THE WHEELBARROW",
		guia2pie = "watch the bar down there",
		guia3 = "NOW TAKE IT TO THE TRUCK",
		guia3pie = "get close and it sells itself",
		guia4 = "TAP UPGRADES AND BUY A SHOVEL",
		guia4pie = "every upgrade shows right away",
		bienvenida = "Welcome back",
		sinGuardado = "could not read your save: progress will not be stored",
		diario = "DAILY REWARD",
		diarioRacha = "day %d in a row",
		codigos = "CODES",
		codigoCaja = "type a code",
		canjear = "REDEEM",
		codigoMal = "that code does not exist",
		codigoUsado = "you already used that one",
		records = "MOST SNOW SHOVELED",
		tablaVacia = "nobody here yet",
	},
}

-- Devuelve el texto en el idioma pedido. Si falta, tira del ingles.
function Ajustes.texto(idioma, clave)
	local tabla = Ajustes.textos[idioma] or Ajustes.textos.en
	return tabla[clave] or Ajustes.textos.en[clave] or clave
end

local SUFIJOS = { "", "K", "M", "B", "T", "Qa", "Qi", "Sx" }

-- 1234567 -> "1.23M". Lo usan el HUD y los carteles del mundo.
function Ajustes.formatear(numero)
	local n = math.floor(tonumber(numero) or 0)
	if n < 1000 then
		return tostring(n)
	end
	local valor = n
	local i = 1
	while valor >= 1000 and i < #SUFIJOS do
		valor = valor / 1000
		i = i + 1
	end
	local texto
	if valor < 10 then
		texto = string.format("%.2f", valor)
	elseif valor < 100 then
		texto = string.format("%.1f", valor)
	else
		texto = string.format("%.0f", valor)
	end
	if string.find(texto, "%.") then
		texto = string.gsub(texto, "0+$", "")
		texto = string.gsub(texto, "%.$", "")
	end
	return texto .. SUFIJOS[i]
end

-- Los nombres de zonas y mejoras viven en su propia tabla ({es=..., en=...}).
function Ajustes.nombre(tabla, idioma)
	if type(tabla) ~= "table" then
		return tostring(tabla)
	end
	return tabla[idioma] or tabla.en or ""
end

return Ajustes
