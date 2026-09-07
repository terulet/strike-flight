--[[
	LA GRAN TORMENTA  —  el guardado

	Una partida son diez o veinte minutos. Perderla al salir empieza a
	doler, asi que a partir de aqui se guarda de verdad.

	Lo que se guarda de cada jugador:

	    dinero          el numero que sube
	    capitulo        por donde iba el guion
	    hallazgos       lo que ya ha descubierto
	    herramientas    lo que ya ha encontrado
	    mundo           puerta abierta, garaje abierto, farolas, vecino
	    nieve           su parcela entera, por tramos
	    tormentas       cuantas ha superado
	    reputacion      lo que vale en el pueblo
	    recompensas     lo que se ha ganado (la baliza, el ayuntamiento)

	Y una cosa que NO se guarda a proposito: la tormenta que este cayendo.
	Es del servidor, no del jugador. Si alguien sale a mitad de tormenta
	no pierde nada de lo suyo; simplemente sale, y ya esta.

	Lo que NO se guarda, porque se vuelve a construir solo: la casa, las
	particulas, los montones de adorno, las luces, el modelo del
	quitanieves. Guardar cosas que se reconstruyen es guardar basura.

	Y una regla que no se salta: si el DataStore no esta (Studio sin
	acceso a la API, por ejemplo), NO se rompe la partida. Se guarda en
	memoria mientras dure el servidor, se avisa una vez en el Output, y a
	jugar.

	Este archivo va en:  ServerScriptService  (ModuleScript, "Guardado")
]]

local RS = game:GetService("ReplicatedStorage")
local Almacen = game:GetService("DataStoreService")
local Correr = game:GetService("RunService")

local A = require(RS:WaitForChild("Ajustes"))

local Guardado = {}

-- EN STUDIO SE GUARDA EN OTRO SITIO. Encender el acceso a la API desde
-- Studio conecta con el DataStore DE VERDAD: sin esto, cualquier prueba
-- pisaria las partidas de la gente que este jugando. El sufijo _DEV es la
-- unica linea que separa una cosa de la otra, y por eso va aqui arriba y
-- no escondida en medio.
Guardado.nombreTienda = "GranTormenta_v" .. A.esquema
if Correr:IsStudio() then
	Guardado.nombreTienda = Guardado.nombreTienda .. "_DEV"
end

-- Y se dice EN VOZ ALTA al arrancar, siempre, no solo cuando algo falla.
-- Es lo unico que separa una prueba en Studio de pisarle la partida a
-- quien este jugando: tiene que poder comprobarse de un vistazo en el
-- Output, sin fiarse de que este bien escrito mas arriba.
if Correr:IsStudio() then
	warn("[tormenta] ESTAS EN STUDIO: se guarda en " .. Guardado.nombreTienda
		.. ", nunca en el de produccion.")
end

-- nil = todavia no se sabe. true/false una vez se ha probado de verdad.
Guardado.disponible = nil
Guardado.enMemoria = {}
Guardado.avisado = false
Guardado.escrituras = 0
Guardado.lecturas = 0

local INTENTOS = 4
local ESPERA = 1

local tienda = nil
local function almacen()
	if tienda then
		return tienda
	end
	local ok, valor = pcall(function()
		return Almacen:GetDataStore(Guardado.nombreTienda)
	end)
	if ok then
		tienda = valor
	end
	return tienda
end

local function avisarUnaVez(porque)
	if Guardado.avisado then
		return
	end
	Guardado.avisado = true
	warn("[tormenta] SIN GUARDADO EN LA NUBE: " .. tostring(porque))
	warn("[tormenta] se juega igual, pero la partida solo dura lo que dure este servidor.")
	warn("[tormenta] en Studio: Game Settings > Security > Enable Studio Access to API Services.")
end

-- Cuatro intentos, esperando cada vez el doble. Los fallos del DataStore
-- suelen ser un pico de un segundo; rendirse al primero es tirar una
-- partida por nada.
local function conReintentos(que, fn)
	local espera = ESPERA
	local ultimo = nil
	for intento = 1, INTENTOS do
		local ok, valor = pcall(fn)
		if ok then
			return true, valor
		end
		ultimo = valor
		if intento < INTENTOS then
			task.wait(espera)
			espera = espera * 2
		end
	end
	warn(("[tormenta] %s ha fallado %d veces: %s"):format(que, INTENTOS, tostring(ultimo)))
	return false, ultimo
end


-------------------------------------------------------------------
--  LA FORMA DE LO GUARDADO
--
--  Todo pasa por aqui antes de subir y despues de bajar. Asi ni se
--  escribe basura ni se lee basura: lo que no encaje se tira y se empieza
--  de cero, que es mejor que cargar una partida imposible.
-------------------------------------------------------------------

local function copiaDeBanderas(origen, permitidas)
	local salida = {}
	if type(origen) == "table" then
		for _, clave in ipairs(permitidas) do
			if origen[clave] == true then
				salida[clave] = true
			end
		end
	end
	return salida
end

local CLAVES_HALLAZGO = {}
for _, def in ipairs(A.hallazgos) do
	CLAVES_HALLAZGO[#CLAVES_HALLAZGO + 1] = def.clave
end

local CLAVES_HERRAMIENTA = {}
for clave in pairs(A.herramientas) do
	CLAVES_HERRAMIENTA[#CLAVES_HERRAMIENTA + 1] = clave
end
table.sort(CLAVES_HERRAMIENTA)

local CLAVES_MUNDO = { "puerta", "garaje", "farolas", "vecinoFuera", "quitanieves" }
local CLAVES_PREMIO = { "baliza", "ayuntamiento" }

function Guardado.nuevo()
	return {
		v = A.esquema,
		dinero = 0,
		nieveTotal = 0,
		capitulo = A.capitulos[1].clave,
		hallazgos = {},
		herramientas = { pala = true },
		mundo = {},
		recompensas = {},
		tormentas = 0,
		reputacion = 0,
		nieve = nil,
		cuando = 0,
	}
end

function Guardado.sanear(datos)
	if type(datos) ~= "table" then
		return nil
	end
	if datos.v ~= A.esquema then
		return nil
	end
	local capitulo = A.capitulos[1].clave
	if type(datos.capitulo) == "string" then
		local cap = A.capitulo(datos.capitulo)
		capitulo = cap.clave
	end
	return {
		v = A.esquema,
		dinero = math.clamp(tonumber(datos.dinero) or 0, 0, 1e12),
		nieveTotal = math.clamp(tonumber(datos.nieveTotal) or 0, 0, 1e12),
		capitulo = capitulo,
		hallazgos = copiaDeBanderas(datos.hallazgos, CLAVES_HALLAZGO),
		herramientas = copiaDeBanderas(datos.herramientas, CLAVES_HERRAMIENTA),
		mundo = copiaDeBanderas(datos.mundo, CLAVES_MUNDO),
		recompensas = copiaDeBanderas(datos.recompensas, CLAVES_PREMIO),
		-- El record de tormentas superadas y lo que vale en el pueblo.
		-- Esto si es permanente: es lo unico que te llevas de un evento.
		tormentas = math.clamp(math.floor(tonumber(datos.tormentas) or 0), 0, 1e9),
		reputacion = math.clamp(math.floor(tonumber(datos.reputacion) or 0), 0, 1e9),
		-- La nieve entera, por tramos. Si es enorme, algo va mal: mas vale
		-- rehacer la nevada que subir un churro de medio mega.
		nieve = (type(datos.nieve) == "string" and #datos.nieve < 100000) and datos.nieve or nil,
		cuando = math.clamp(tonumber(datos.cuando) or 0, 0, 1e12),
	}
end


-------------------------------------------------------------------
--  CARGAR Y GUARDAR
-------------------------------------------------------------------

local function clave(jugador)
	return "j_" .. tostring(jugador.UserId)
end

-- Devuelve  datos, dedonde  con dedonde en "nube" | "memoria" | "nuevo".
function Guardado.cargar(jugador)
	local llave = clave(jugador)
	local tabla = almacen()
	if tabla then
		local ok, crudo = conReintentos("cargar", function()
			return tabla:GetAsync(llave)
		end)
		if ok then
			Guardado.disponible = true
			Guardado.lecturas = Guardado.lecturas + 1
			local limpio = Guardado.sanear(crudo)
			if limpio then
				return limpio, "nube"
			end
			return Guardado.nuevo(), "nuevo"
		end
		Guardado.disponible = false
		avisarUnaVez("no se puede leer")
	else
		Guardado.disponible = false
		avisarUnaVez("no hay DataStoreService")
	end

	local suyo = Guardado.enMemoria[llave]
	if suyo then
		return suyo, "memoria"
	end
	return Guardado.nuevo(), "nuevo"
end

-- Devuelve  ok, dedonde. Nunca lanza: que falle el guardado no puede
-- tumbar una partida ni un cierre de servidor.
function Guardado.guardar(jugador, datos)
	local limpio = Guardado.sanear(datos)
	if not limpio then
		warn("[tormenta] no guardo: los datos no encajan con el esquema " .. tostring(A.esquema))
		return false, "descartado"
	end
	limpio.cuando = os.time()

	local llave = clave(jugador)
	-- El respaldo en memoria se pone SIEMPRE, tambien cuando la nube va
	-- bien: si la nube se cae a mitad de sesion, no se pierde nada.
	Guardado.enMemoria[llave] = limpio

	local tabla = almacen()
	if tabla then
		local ok = conReintentos("guardar", function()
			return tabla:UpdateAsync(llave, function(viejo)
				-- Si otro servidor ha escrito DESPUES que nosotros, gana
				-- el suyo: devolver nil cancela la escritura.
				if type(viejo) == "table" and (tonumber(viejo.cuando) or 0) > limpio.cuando then
					return nil
				end
				return limpio
			end)
		end)
		if ok then
			Guardado.disponible = true
			Guardado.escrituras = Guardado.escrituras + 1
			return true, "nube"
		end
		Guardado.disponible = false
		avisarUnaVez("no se puede escribir")
	else
		Guardado.disponible = false
		avisarUnaVez("no hay DataStoreService")
	end
	return true, "memoria"
end

return Guardado
