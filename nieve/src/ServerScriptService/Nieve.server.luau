--[[
	¡QUITA TODA LA NIEVE!  —  servidor

	Construye el mapa entero por codigo (no hay que dibujar nada en
	Studio), lleva las cuentas y guarda las partidas.

	El servidor manda en todo lo que vale dinero: el cliente solo pide
	cosas y enseña numeros. Asi no hay nada que trampear desde fuera.

	Este archivo va en:  ServerScriptService  (Script, nombre "Nieve")
]]

local Jugadores = game:GetService("Players")
local Almacenes = game:GetService("DataStoreService")
local Mercado = game:GetService("MarketplaceService")
local Luz = game:GetService("Lighting")
local RS = game:GetService("ReplicatedStorage")

local A = require(RS:WaitForChild("AjustesNieve"))

local aleatorio = Random.new(20260906)


-------------------------------------------------------------------
--  UTILIDADES
-------------------------------------------------------------------

local function pieza(clase, props, padre)
	local p = Instance.new(clase)
	p.Anchored = true
	p.CanCollide = false
	p.CanQuery = false
	p.CanTouch = false
	p.CastShadow = false
	p.Material = Enum.Material.SmoothPlastic
	for clave, valor in pairs(props) do
		p[clave] = valor
	end
	p.Parent = padre
	return p
end

local function parte(props, padre)
	return pieza("Part", props, padre)
end

-- Cartel flotante. El cliente le cambia el texto a su idioma.
local function cartel(adornee, texto, tipo, altura, ancho)
	local gui = Instance.new("BillboardGui")
	gui.Name = "Cartel"
	gui.Adornee = adornee
	gui.Size = UDim2.new(ancho or 11, 0, 2.6, 0)
	gui.StudsOffsetWorldSpace = Vector3.new(0, altura or 6, 0)
	gui.AlwaysOnTop = true
	gui.LightInfluence = 0
	gui.MaxDistance = 220

	local fondo = Instance.new("Frame")
	fondo.Size = UDim2.fromScale(1, 1)
	fondo.BackgroundColor3 = Color3.fromRGB(12, 18, 30)
	fondo.BackgroundTransparency = 0.15
	fondo.BorderSizePixel = 0
	fondo.Parent = gui

	local esquina = Instance.new("UICorner")
	esquina.CornerRadius = UDim.new(0, 12)
	esquina.Parent = fondo

	local borde = Instance.new("UIStroke")
	borde.Color = Color3.fromRGB(120, 205, 255)
	borde.Thickness = 2
	borde.Transparency = 0.3
	borde.Parent = fondo

	local etiqueta = Instance.new("TextLabel")
	etiqueta.Name = "Texto"
	etiqueta.Size = UDim2.fromScale(0.9, 0.75)
	etiqueta.Position = UDim2.fromScale(0.05, 0.125)
	etiqueta.BackgroundTransparency = 1
	etiqueta.Font = Enum.Font.GothamBlack
	etiqueta.TextColor3 = Color3.fromRGB(255, 255, 255)
	etiqueta.TextScaled = true
	etiqueta.Text = texto
	etiqueta.Parent = fondo

	gui:SetAttribute("tipo", tipo)
	gui.Parent = adornee
	return gui
end


-------------------------------------------------------------------
--  REMOTOS
-------------------------------------------------------------------

local remotos = Instance.new("Folder")
remotos.Name = "NieveRemotos"
remotos.Parent = RS

local function nuevoRemoto(nombre)
	local r = Instance.new("RemoteEvent")
	r.Name = nombre
	r.Parent = remotos
	return r
end

local RemotoEstado = nuevoRemoto("Estado")   -- servidor -> cliente, el HUD entero
local RemotoAviso = nuevoRemoto("Aviso")     -- servidor -> cliente, mensajitos
local RemotoComprar = nuevoRemoto("Comprar") -- cliente -> servidor, mejoras y renacer


-------------------------------------------------------------------
--  EL MUNDO
-------------------------------------------------------------------

local mundo = {
	zonas = {},
	porClave = {},
	carpeta = nil,
	puertas = nil,
	spawnCFrame = CFrame.new(0, 5, 0),
}

local function limpiarPlantilla()
	for _, obj in ipairs(workspace:GetChildren()) do
		if obj.Name == "Baseplate" or obj.Name == "Nieve" then
			obj:Destroy()
		elseif obj:IsA("SpawnLocation") then
			obj:Destroy()
		end
	end
	local viejo = RS:FindFirstChild("NieveRemotos")
	if viejo and viejo ~= remotos then
		viejo:Destroy()
	end
end

local function calcularZonas()
	local x = 0
	for i, def in ipairs(A.zonas) do
		-- Cada zona puede tener la casilla mas grande que la anterior.
		local celda = def.celda or A.mundo.celda
		local anchoS = def.ancho * celda
		local largoS = def.largo * celda
		local zona = {
			indice = i,
			clave = def.clave,
			def = def,
			celda = celda,
			x0 = x,
			x1 = x + anchoS,
			z0 = -largoS / 2,
			z1 = largoS / 2,
			centroX = x + anchoS / 2,
			total = def.ancho * def.largo,
			activas = 0,
			casillas = {},
			rejilla = {},
			ventaEn = Vector3.new(0, 0, 0),
		}
		mundo.zonas[i] = zona
		mundo.porClave[def.clave] = zona
		x = x + anchoS + A.mundo.separacion
	end

	local ultima = mundo.zonas[#mundo.zonas]
	local largoMax = 0
	for _, zona in ipairs(mundo.zonas) do
		largoMax = math.max(largoMax, zona.z1 - zona.z0)
	end

	mundo.minX = mundo.zonas[1].x0 - 30
	mundo.maxX = ultima.x1 + 30
	mundo.minZ = -largoMax / 2 - 46
	mundo.maxZ = largoMax / 2 + 46
end

local function construirSuelo()
	local ancho = mundo.maxX - mundo.minX
	local largo = mundo.maxZ - mundo.minZ
	parte({
		Name = "Suelo",
		Size = Vector3.new(ancho, 4, largo),
		Position = Vector3.new((mundo.minX + mundo.maxX) / 2, -2, (mundo.minZ + mundo.maxZ) / 2),
		Color = Color3.fromRGB(228, 236, 246),
		Material = Enum.Material.Snow,
		CanCollide = true,
		CanQuery = true,
	}, mundo.carpeta)
end

local function construirNieve(zona, padre)
	local celda = zona.celda
	local carpetaNieve = Instance.new("Folder")
	carpetaNieve.Name = "Nieve"
	carpetaNieve.Parent = padre

	local hechas = 0
	for cx = 0, zona.def.ancho - 1 do
		zona.rejilla[cx] = {}
		for cz = 0, zona.def.largo - 1 do
			local altura = A.mundo.alturaNieve * (0.6 + aleatorio:NextNumber() * 1.3)
			local tono = 243 + math.floor(aleatorio:NextNumber() * 12)
			local px = zona.x0 + (cx + 0.5) * celda
			local pz = zona.z0 + (cz + 0.5) * celda
			local bloque = parte({
				Name = "n",
				Size = Vector3.new(celda, altura, celda),
				Position = Vector3.new(px, 0.4 + altura / 2, pz),
				Color = Color3.fromRGB(tono - 8, tono - 3, tono),
				Material = Enum.Material.Snow,
			}, carpetaNieve)

			local casilla = {
				parte = bloque,
				x = px,
				z = pz,
				activa = true,
				vuelveEn = 0,
			}
			zona.rejilla[cx][cz] = casilla
			zona.casillas[#zona.casillas + 1] = casilla

			hechas = hechas + 1
			if hechas % 400 == 0 then
				task.wait()
			end
		end
	end
	zona.activas = #zona.casillas
end

local function construirCamion(zona, padre)
	local cx = zona.centroX
	local cz = zona.z1 + 13

	parte({
		Name = "PuntoVenta",
		Size = Vector3.new(22, 0.3, 14),
		Position = Vector3.new(cx, 0.15, cz - 4),
		Color = Color3.fromRGB(120, 205, 255),
		Material = Enum.Material.Neon,
		Transparency = 0.55,
	}, padre)

	local caja = parte({
		Name = "Caja",
		Size = Vector3.new(16, 8, 9),
		Position = Vector3.new(cx + 2, 5.4, cz + 4),
		Color = Color3.fromRGB(48, 60, 82),
		CanCollide = true,
		CanQuery = true,
	}, padre)

	parte({
		Name = "Cabina",
		Size = Vector3.new(7, 6.5, 9),
		Position = Vector3.new(cx - 9.5, 4.6, cz + 4),
		Color = Color3.fromRGB(206, 76, 76),
		CanCollide = true,
		CanQuery = true,
	}, padre)

	for _, dx in ipairs({ -9, 1, 7 }) do
		for _, dz in ipairs({ -4.6, 4.6 }) do
			parte({
				Name = "Rueda",
				Shape = Enum.PartType.Cylinder,
				Size = Vector3.new(1.6, 3.2, 3.2),
				CFrame = CFrame.new(cx + dx, 1.5, cz + 4 + dz),
				Color = Color3.fromRGB(28, 28, 32),
			}, padre)
		end
	end

	-- El monton de nieve ya vendida, para que se vea a donde va.
	for i = 1, 4 do
		parte({
			Name = "Monton",
			Shape = Enum.PartType.Ball,
			Size = Vector3.new(6 + i, 6 + i, 6 + i),
			Position = Vector3.new(cx + 12 + i * 2.5, 0.6, cz + 6),
			Color = Color3.fromRGB(246, 250, 255),
			Material = Enum.Material.Snow,
		}, padre)
	end

	cartel(caja, "SELL", "vender", 7, 12)
	zona.ventaEn = Vector3.new(cx, 0, cz - 4)
	zona.camion = caja
end

local function decorarZona(zona, padre)
	local tipo = zona.def.decorado
	local cx = zona.centroX
	local zAtras = zona.z0 - 12

	if tipo == "casa" then
		parte({
			Name = "Casa",
			Size = Vector3.new(26, 16, 18),
			Position = Vector3.new(cx, 8, zAtras - 8),
			Color = Color3.fromRGB(196, 168, 140),
			CanCollide = true,
			CanQuery = true,
		}, padre)
		parte({
			Name = "Tejado",
			Size = Vector3.new(29, 1.8, 21),
			Position = Vector3.new(cx, 16.9, zAtras - 8),
			Color = Color3.fromRGB(238, 244, 252),
			Material = Enum.Material.Snow,
			CanCollide = true,
			CanQuery = true,
		}, padre)
		parte({
			Name = "Puerta",
			Size = Vector3.new(5, 8, 0.6),
			Position = Vector3.new(cx, 4, zAtras + 1),
			Color = Color3.fromRGB(92, 62, 44),
		}, padre)

	elseif tipo == "farolas" then
		for i = 0, 3 do
			local px = zona.x0 + (i + 0.5) * (zona.x1 - zona.x0) / 4
			parte({
				Name = "Farola",
				Size = Vector3.new(0.8, 18, 0.8),
				Position = Vector3.new(px, 9, zAtras),
				Color = Color3.fromRGB(48, 52, 60),
			}, padre)
			parte({
				Name = "Luz",
				Shape = Enum.PartType.Ball,
				Size = Vector3.new(2.4, 2.4, 2.4),
				Position = Vector3.new(px, 18, zAtras),
				Color = Color3.fromRGB(255, 236, 180),
				Material = Enum.Material.Neon,
			}, padre)
		end

	elseif tipo == "arboles" then
		for i = 0, 5 do
			local px = zona.x0 + (i + 0.5) * (zona.x1 - zona.x0) / 6
			local pz = (i % 2 == 0) and (zAtras - 4) or (zona.z1 + 4)
			parte({
				Name = "Tronco",
				Size = Vector3.new(2.4, 12, 2.4),
				Position = Vector3.new(px, 6, pz),
				Color = Color3.fromRGB(94, 66, 46),
				Material = Enum.Material.Wood,
			}, padre)
			for capa = 0, 2 do
				parte({
					Name = "Copa",
					Shape = Enum.PartType.Ball,
					Size = Vector3.new(13 - capa * 3, 8 - capa * 1.6, 13 - capa * 3),
					Position = Vector3.new(px, 12 + capa * 3.4, pz),
					Color = Color3.fromRGB(236, 244, 252),
					Material = Enum.Material.Snow,
				}, padre)
			end
		end

	elseif tipo == "coches" then
		local colores = {
			Color3.fromRGB(196, 72, 72),
			Color3.fromRGB(72, 116, 196),
			Color3.fromRGB(220, 196, 88),
			Color3.fromRGB(88, 176, 128),
		}
		for i = 0, 3 do
			local px = zona.x0 + (i + 0.5) * (zona.x1 - zona.x0) / 4
			parte({
				Name = "Coche",
				Size = Vector3.new(8, 4, 14),
				Position = Vector3.new(px, 2.4, zAtras - 6),
				Color = colores[i + 1],
				CanCollide = true,
				CanQuery = true,
			}, padre)
			parte({
				Name = "Techo",
				Size = Vector3.new(7, 3, 7),
				Position = Vector3.new(px, 5.6, zAtras - 6),
				Color = Color3.fromRGB(238, 246, 254),
				Material = Enum.Material.Snow,
			}, padre)
		end

	elseif tipo == "rocas" then
		for i = 0, 6 do
			local px = zona.x0 + (i + 0.5) * (zona.x1 - zona.x0) / 7
			local pz = (i % 2 == 0) and (zAtras - 6) or (zona.z1 + 8)
			local tam = 10 + aleatorio:NextNumber() * 14
			parte({
				Name = "Roca",
				Shape = Enum.PartType.Ball,
				Size = Vector3.new(tam, tam * 0.8, tam),
				Position = Vector3.new(px, tam * 0.2, pz),
				Color = Color3.fromRGB(224, 234, 246),
				Material = Enum.Material.Snow,
				CanCollide = true,
				CanQuery = true,
			}, padre)
		end
	end
end

-- Las casas, los arboles y el camion si proyectan sombra: es lo que hace
-- que el sitio no parezca de carton. Los bloques de nieve no, que son casi
-- tres mil y eso si se nota en un movil.
local function sombrasEnDecorado(grupo)
	for _, obj in ipairs(grupo:GetChildren()) do
		if obj:IsA("BasePart") and obj.Name ~= "Parcela" and obj.Name ~= "PuntoVenta" then
			obj.CastShadow = true
		end
	end
end

local function construirPuertas()
	local carpeta = Instance.new("Folder")
	carpeta.Name = "Puertas"
	carpeta.Parent = mundo.carpeta
	mundo.puertas = carpeta

	local largo = mundo.maxZ - mundo.minZ
	for i = 2, #mundo.zonas do
		local zona = mundo.zonas[i]
		local anterior = mundo.zonas[i - 1]
		local px = (anterior.x1 + zona.x0) / 2

		local muro = parte({
			Name = "Puerta_" .. zona.clave,
			Size = Vector3.new(2.5, A.mundo.alturaValla, largo),
			Position = Vector3.new(px, A.mundo.alturaValla / 2, (mundo.minZ + mundo.maxZ) / 2),
			Color = Color3.fromRGB(150, 214, 255),
			Material = Enum.Material.Ice,
			Transparency = 0.35,
			CanCollide = true,
			CanQuery = true,
		}, carpeta)
		muro:SetAttribute("zona", zona.clave)
		muro:SetAttribute("precio", zona.def.precio)
		muro:SetAttribute("indice", i)

		cartel(muro, "OPEN", "puerta", A.mundo.alturaValla / 2 + 3, 16)

		local aviso = Instance.new("ProximityPrompt")
		aviso.Name = "Abrir"
		aviso.ActionText = "OPEN"
		aviso.ObjectText = A.nombre(zona.def.nombre, "en")
		aviso.HoldDuration = 0.4
		aviso.MaxActivationDistance = 14
		aviso.RequiresLineOfSight = false
		aviso.Parent = muro
		muro:SetAttribute("promptListo", true)
	end
end

local function construirValla()
	local grosor = 3
	local alto = A.mundo.alturaValla
	local ancho = mundo.maxX - mundo.minX
	local largo = mundo.maxZ - mundo.minZ
	local centroX = (mundo.minX + mundo.maxX) / 2
	local centroZ = (mundo.minZ + mundo.maxZ) / 2

	local lados = {
		{ Vector3.new(ancho, alto, grosor), Vector3.new(centroX, alto / 2, mundo.minZ) },
		{ Vector3.new(ancho, alto, grosor), Vector3.new(centroX, alto / 2, mundo.maxZ) },
		{ Vector3.new(grosor, alto, largo), Vector3.new(mundo.minX, alto / 2, centroZ) },
		{ Vector3.new(grosor, alto, largo), Vector3.new(mundo.maxX, alto / 2, centroZ) },
	}
	for i, lado in ipairs(lados) do
		parte({
			Name = "Valla" .. i,
			Size = lado[1],
			Position = lado[2],
			Color = Color3.fromRGB(190, 214, 240),
			Material = Enum.Material.Ice,
			Transparency = 0.55,
			CanCollide = true,
			CanQuery = true,
		}, mundo.carpeta)
	end
end

local function ambientar()
	Luz.ClockTime = 15.5
	Luz.Brightness = 2.2
	Luz.Ambient = Color3.fromRGB(126, 136, 156)
	Luz.OutdoorAmbient = Color3.fromRGB(158, 172, 196)
	Luz.FogColor = Color3.fromRGB(214, 226, 240)
	Luz.FogEnd = 1100
	Luz.FogStart = 220
	Luz.GeographicLatitude = 60
	Luz.GlobalShadows = true

	if not Luz:FindFirstChildOfClass("Atmosphere") then
		local aire = Instance.new("Atmosphere")
		aire.Density = 0.36
		aire.Offset = 0.1
		aire.Color = Color3.fromRGB(214, 226, 242)
		aire.Decay = Color3.fromRGB(160, 178, 200)
		aire.Glare = 0.2
		aire.Haze = 1.6
		aire.Parent = Luz
	end
end

local function construirMundo()
	limpiarPlantilla()
	calcularZonas()

	local carpeta = Instance.new("Folder")
	carpeta.Name = "Nieve"
	carpeta.Parent = workspace
	mundo.carpeta = carpeta

	construirSuelo()

	for _, zona in ipairs(mundo.zonas) do
		local grupo = Instance.new("Folder")
		grupo.Name = zona.clave
		grupo.Parent = carpeta

		parte({
			Name = "Parcela",
			Size = Vector3.new(zona.x1 - zona.x0, 0.4, zona.z1 - zona.z0),
			Position = Vector3.new(zona.centroX, 0.2, 0),
			Color = zona.def.suelo,
			Material = Enum.Material.Concrete,
		}, grupo)

		construirNieve(zona, grupo)
		construirCamion(zona, grupo)
		decorarZona(zona, grupo)
		sombrasEnDecorado(grupo)
	end

	construirPuertas()
	construirValla()
	ambientar()

	local primera = mundo.zonas[1]
	local sitio = Instance.new("SpawnLocation")
	sitio.Name = "Salida"
	sitio.Size = Vector3.new(14, 1, 14)
	sitio.Position = Vector3.new(primera.centroX, 0.5, primera.z1 + 24)
	sitio.Anchored = true
	sitio.CanCollide = true
	sitio.Transparency = 0.4
	sitio.Color = Color3.fromRGB(120, 205, 255)
	sitio.Material = Enum.Material.Neon
	sitio.Duration = 0
	sitio.Neutral = true
	sitio.Parent = carpeta
	mundo.spawnCFrame = CFrame.new(sitio.Position + Vector3.new(0, 4, 0))
end


-------------------------------------------------------------------
--  ESTADO DE CADA JUGADOR
-------------------------------------------------------------------

local estados = {}

local mejoraPorClave = {}
for _, def in ipairs(A.mejoras) do
	mejoraPorClave[def.clave] = def
end

local TOPE_ENTERO = 2147483647

local function nuevoEstado()
	return {
		dinero = 0,
		nieveTotal = 0,
		renaceres = 0,
		carga = 0,
		valor = 0,
		niveles = { pala = 1, carretilla = 1, botas = 1 },
		zonas = { [A.zonas[1].clave] = true },
		codigos = {},
		racha = 0,
		ultimoDia = 0,
		ultimoPremio = 0,
		pases = {},
		zonaVista = A.zonas[1].clave,
		cargado = false,
		puedeGuardar = false,
		recogiendo = false,
		emisor = nil,
		ultimaPeticion = 0,
	}
end

local function radioDe(estado)
	return A.jugador.radioBase + (estado.niveles.pala - 1) * A.jugador.radioPorNivel
end

local function potenciaDe(estado)
	return A.jugador.potenciaBase + (estado.niveles.pala - 1) * A.jugador.potenciaPorNivel
end

local function capacidadDe(estado)
	local base = A.jugador.capacidadBase + (estado.niveles.carretilla - 1) * A.jugador.capacidadPorNivel
	if estado.pases.dobleCarretilla then
		base = base * 2
	end
	return base
end

local function velocidadDe(estado)
	return A.jugador.velocidadBase + (estado.niveles.botas - 1) * A.jugador.velocidadPorNivel
end

local function multiplicadorDe(estado)
	local mult = 1 + estado.renaceres * A.renacer.bonus
	if estado.pases.dobleDinero then
		mult = mult * 2
	end
	return mult
end

local function precioMejora(def, nivel)
	return math.floor(def.precio * def.factor ^ (nivel - 1))
end

local function precioRenacer(estado)
	return math.floor(A.renacer.precio * A.renacer.factor ^ estado.renaceres)
end

local function tieneTodasLasZonas(estado)
	for _, def in ipairs(A.zonas) do
		if not estado.zonas[def.clave] then
			return false
		end
	end
	return true
end

local function avisar(jugador, clave, extra)
	local paquete = extra or {}
	paquete.tipo = "texto"
	paquete.clave = clave
	RemotoAviso:FireClient(jugador, paquete)
end


-------------------------------------------------------------------
--  MARCADOR DE ROBLOX
-------------------------------------------------------------------

local function crearMarcador(jugador)
	local carpeta = Instance.new("Folder")
	carpeta.Name = "leaderstats"

	local monedas = Instance.new("IntValue")
	monedas.Name = "Coins"
	monedas.Parent = carpeta

	local nieve = Instance.new("IntValue")
	nieve.Name = "Snow"
	nieve.Parent = carpeta

	local renaceres = Instance.new("IntValue")
	renaceres.Name = "Rebirths"
	renaceres.Parent = carpeta

	carpeta.Parent = jugador
end

local function refrescarMarcador(jugador, estado)
	local carpeta = jugador:FindFirstChild("leaderstats")
	if not carpeta then
		return
	end
	local monedas = carpeta:FindFirstChild("Coins")
	local nieve = carpeta:FindFirstChild("Snow")
	local renaceres = carpeta:FindFirstChild("Rebirths")
	if monedas then
		monedas.Value = math.clamp(math.floor(estado.dinero), 0, TOPE_ENTERO)
	end
	if nieve then
		nieve.Value = math.clamp(math.floor(estado.nieveTotal), 0, TOPE_ENTERO)
	end
	if renaceres then
		renaceres.Value = estado.renaceres
	end
end


-------------------------------------------------------------------
--  GUARDADO
-------------------------------------------------------------------

local almacen = nil
do
	local ok, resultado = pcall(function()
		return Almacenes:GetDataStore(A.guardado.almacen)
	end)
	if ok then
		almacen = resultado
	else
		warn("[nieve] sin DataStore: la partida no se va a guardar (es lo normal mientras el sitio no este publicado)")
	end
end

local function claveDe(jugador)
	return "j_" .. tostring(jugador.UserId)
end

local function reintentar(fn)
	for intento = 1, A.guardado.intentos do
		local ok, resultado = pcall(fn)
		if ok then
			return true, resultado
		end
		if intento < A.guardado.intentos then
			task.wait(2 ^ intento)
		else
			warn("[nieve] fallo de DataStore: " .. tostring(resultado))
		end
	end
	return false, nil
end

local function serializar(estado)
	local zonas = {}
	for clave, abierta in pairs(estado.zonas) do
		if abierta then
			zonas[#zonas + 1] = clave
		end
	end
	local codigos = {}
	for clave, usado in pairs(estado.codigos) do
		if usado then
			codigos[#codigos + 1] = clave
		end
	end
	return {
		v = 1,
		dinero = math.floor(estado.dinero),
		nieveTotal = math.floor(estado.nieveTotal),
		renaceres = estado.renaceres,
		racha = estado.racha,
		ultimoDia = estado.ultimoDia,
		ultimoPremio = estado.ultimoPremio,
		codigos = codigos,
		pala = estado.niveles.pala,
		carretilla = estado.niveles.carretilla,
		botas = estado.niveles.botas,
		zonas = zonas,
	}
end

local function aplicarDatos(estado, datos)
	if type(datos) ~= "table" then
		return
	end
	estado.dinero = math.max(0, tonumber(datos.dinero) or 0)
	estado.nieveTotal = math.max(0, tonumber(datos.nieveTotal) or 0)
	estado.renaceres = math.max(0, math.floor(tonumber(datos.renaceres) or 0))
	estado.racha = math.clamp(math.floor(tonumber(datos.racha) or 0), 0, A.diario.rachaMaxima)
	estado.ultimoDia = math.max(0, math.floor(tonumber(datos.ultimoDia) or 0))
	estado.ultimoPremio = math.max(0, math.floor(tonumber(datos.ultimoPremio) or 0))

	if type(datos.codigos) == "table" then
		estado.codigos = {}
		for _, clave in ipairs(datos.codigos) do
			if type(clave) == "string" then
				estado.codigos[clave] = true
			end
		end
	end

	for _, def in ipairs(A.mejoras) do
		local nivel = math.floor(tonumber(datos[def.clave]) or 1)
		estado.niveles[def.clave] = math.clamp(nivel, 1, def.niveles)
	end

	if type(datos.zonas) == "table" then
		estado.zonas = {}
		for _, clave in ipairs(datos.zonas) do
			if mundo.porClave[clave] then
				estado.zonas[clave] = true
			end
		end
	end
	-- La primera zona es de todos, pase lo que pase.
	estado.zonas[A.zonas[1].clave] = true
end

local function guardar(jugador)
	local estado = estados[jugador]
	if not estado or not estado.cargado or not estado.puedeGuardar or not almacen then
		return
	end
	local datos = serializar(estado)
	reintentar(function()
		almacen:SetAsync(claveDe(jugador), datos)
		return true
	end)
end


-------------------------------------------------------------------
--  COMPRAS
-------------------------------------------------------------------

local function aplicarVelocidad(jugador, estado)
	local pers = jugador.Character
	local humano = pers and pers:FindFirstChildOfClass("Humanoid")
	if humano then
		humano.WalkSpeed = velocidadDe(estado)
	end
end

local function comprarMejora(jugador, estado, clave)
	local def = mejoraPorClave[clave]
	if not def then
		return
	end
	local nivel = estado.niveles[clave] or 1
	if nivel >= def.niveles then
		return
	end
	local precio = precioMejora(def, nivel)
	if estado.dinero < precio then
		avisar(jugador, "sinDinero")
		return
	end
	estado.dinero = estado.dinero - precio
	estado.niveles[clave] = nivel + 1
	if clave == "botas" then
		aplicarVelocidad(jugador, estado)
	end
	refrescarMarcador(jugador, estado)
	RemotoAviso:FireClient(jugador, { tipo = "mejora", clave = clave, nivel = nivel + 1 })
end

local function hacerRenacer(jugador, estado)
	if not tieneTodasLasZonas(estado) then
		avisar(jugador, "renacerFalta")
		return
	end
	local precio = precioRenacer(estado)
	if estado.dinero < precio then
		avisar(jugador, "sinDinero")
		return
	end

	estado.renaceres = estado.renaceres + 1
	estado.dinero = 0
	estado.carga = 0
	estado.valor = 0
	estado.niveles = { pala = 1, carretilla = 1, botas = 1 }
	estado.zonas = { [A.zonas[1].clave] = true }
	estado.zonaVista = A.zonas[1].clave

	local pers = jugador.Character
	if pers then
		pcall(function()
			pers:PivotTo(mundo.spawnCFrame)
		end)
	end
	aplicarVelocidad(jugador, estado)
	refrescarMarcador(jugador, estado)
	RemotoAviso:FireClient(jugador, { tipo = "renacer", nivel = estado.renaceres })
	guardar(jugador)
end


-------------------------------------------------------------------
--  PREMIO DIARIO Y CODIGOS
-------------------------------------------------------------------

local function valorMaximoDe(estado)
	local mejor = A.zonas[1].valor
	for _, def in ipairs(A.zonas) do
		if estado.zonas[def.clave] and def.valor > mejor then
			mejor = def.valor
		end
	end
	return mejor
end

local function comprobarPremio(jugador, estado)
	local ahora = os.time()
	local dia = math.floor(ahora / 86400)
	if estado.ultimoDia == dia then
		return
	end

	-- Volver al dia siguiente suma racha; tardar dos dias la reinicia.
	local desde = estado.ultimoPremio or 0
	if desde > 0 and (ahora - desde) <= A.diario.horasParaPerderla * 3600 then
		estado.racha = math.min(A.diario.rachaMaxima, (estado.racha or 0) + 1)
	else
		estado.racha = 1
	end
	estado.ultimoDia = dia
	estado.ultimoPremio = ahora

	local premio = math.floor(valorMaximoDe(estado) * A.diario.bloques * estado.racha)
	estado.dinero = estado.dinero + premio
	refrescarMarcador(jugador, estado)
	RemotoAviso:FireClient(jugador, { tipo = "diario", cantidad = premio, racha = estado.racha })
end

local codigosPorClave = {}
for _, def in ipairs(A.codigos) do
	codigosPorClave[string.upper(def.clave)] = def
end

local function canjearCodigo(jugador, estado, texto)
	if type(texto) ~= "string" or #texto > 32 then
		return
	end
	local clave = string.upper((string.gsub(texto, "%s", "")))
	local def = codigosPorClave[clave]
	if not def then
		avisar(jugador, "codigoMal")
		return
	end
	if estado.codigos[clave] then
		avisar(jugador, "codigoUsado")
		return
	end

	estado.codigos[clave] = true
	local premio = math.floor(valorMaximoDe(estado) * def.bloques)
	estado.dinero = estado.dinero + premio
	refrescarMarcador(jugador, estado)
	RemotoAviso:FireClient(jugador, { tipo = "codigo", cantidad = premio, clave = clave })
	guardar(jugador)
end


-------------------------------------------------------------------
--  TABLA DE RECORDS
--
--  Se ordena por nieve recogida en total, que es lo unico que no se
--  borra al renacer. Vive en un poste al lado de la salida.
-------------------------------------------------------------------

local ordenado = nil
do
	local ok, resultado = pcall(function()
		return Almacenes:GetOrderedDataStore(A.records.almacen)
	end)
	if ok then
		ordenado = resultado
	else
		warn("[nieve] sin tabla de records (es lo normal mientras el sitio no este publicado)")
	end
end

local nombresPorId = {}
local etiquetaTabla = nil

local function subirRecord(jugador, estado)
	if not ordenado or not estado or not estado.puedeGuardar then
		return
	end
	pcall(function()
		ordenado:SetAsync(tostring(jugador.UserId), math.floor(estado.nieveTotal))
	end)
end

local function construirTabla()
	local primera = mundo.zonas[1]
	local poste = parte({
		Name = "Tabla",
		Size = Vector3.new(1.6, 15, 1.6),
		Position = Vector3.new(primera.centroX - 30, 7.5, primera.z1 + 24),
		Color = Color3.fromRGB(56, 66, 86),
		CanCollide = true,
		CanQuery = true,
	}, mundo.carpeta)

	local gui = Instance.new("BillboardGui")
	gui.Name = "Records"
	gui.Adornee = poste
	gui.Size = UDim2.new(17, 0, 13, 0)
	gui.StudsOffsetWorldSpace = Vector3.new(0, 14, 0)
	gui.MaxDistance = 280
	gui.LightInfluence = 0

	local fondo = Instance.new("Frame")
	fondo.Size = UDim2.fromScale(1, 1)
	fondo.BackgroundColor3 = Color3.fromRGB(12, 18, 30)
	fondo.BackgroundTransparency = 0.15
	fondo.BorderSizePixel = 0
	fondo.Parent = gui

	local esquina = Instance.new("UICorner")
	esquina.CornerRadius = UDim.new(0, 14)
	esquina.Parent = fondo

	local borde = Instance.new("UIStroke")
	borde.Color = Color3.fromRGB(120, 205, 255)
	borde.Thickness = 2
	borde.Transparency = 0.3
	borde.Parent = fondo

	local titulo = Instance.new("TextLabel")
	titulo.Name = "Titulo"
	titulo.Size = UDim2.fromScale(0.92, 0.15)
	titulo.Position = UDim2.fromScale(0.04, 0.04)
	titulo.BackgroundTransparency = 1
	titulo.Font = Enum.Font.GothamBlack
	titulo.TextColor3 = Color3.fromRGB(120, 205, 255)
	titulo.TextScaled = true
	titulo.Text = "MOST SNOW SHOVELED"
	titulo.Parent = fondo

	local lista = Instance.new("TextLabel")
	lista.Name = "Lista"
	lista.Size = UDim2.fromScale(0.92, 0.74)
	lista.Position = UDim2.fromScale(0.04, 0.21)
	lista.BackgroundTransparency = 1
	-- Fuente de ancho fijo: si no, las columnas bailan.
	lista.Font = Enum.Font.Code
	lista.TextColor3 = Color3.fromRGB(236, 244, 255)
	lista.TextScaled = true
	lista.TextXAlignment = Enum.TextXAlignment.Left
	lista.TextYAlignment = Enum.TextYAlignment.Top
	lista.Text = ""
	lista.Parent = fondo

	gui:SetAttribute("tipo", "records")
	gui.Parent = poste
	etiquetaTabla = lista
end

local function refrescarTabla()
	if not etiquetaTabla then
		return
	end
	if not ordenado then
		local vacias = {}
		for puesto = 1, A.records.cuantos do
			vacias[puesto] = string.format("%2d  %-14s %8s", puesto, "-", "-")
		end
		etiquetaTabla.Text = table.concat(vacias, "\n")
		return
	end

	local ok, paginas = pcall(function()
		return ordenado:GetSortedAsync(false, A.records.cuantos)
	end)
	if not ok then
		return
	end

	local lineas = {}
	local pagina = paginas:GetCurrentPage()
	for puesto = 1, A.records.cuantos do
		lineas[puesto] = string.format("%2d  %-14s %8s", puesto, "-", "-")
	end
	for puesto, fila in ipairs(pagina) do
		local nombre = nombresPorId[fila.key]
		if not nombre then
			local id = tonumber(fila.key)
			local hecho, resultado = pcall(function()
				return Jugadores:GetNameFromUserIdAsync(id)
			end)
			nombre = (hecho and resultado) or "?"
			nombresPorId[fila.key] = nombre
		end
		if #nombre > 14 then
			nombre = string.sub(nombre, 1, 13) .. "."
		end
		lineas[puesto] = string.format("%2d  %-14s %8s", puesto, nombre, A.formatear(fila.value))
	end

	etiquetaTabla.Text = table.concat(lineas, "\n")
end


RemotoComprar.OnServerEvent:Connect(function(jugador, tipo, clave)
	local estado = estados[jugador]
	if not estado or not estado.cargado then
		return
	end
	if type(tipo) ~= "string" then
		return
	end
	if clave ~= nil and type(clave) ~= "string" then
		return
	end

	local ahora = os.clock()
	if ahora - estado.ultimaPeticion < 0.12 then
		return
	end
	estado.ultimaPeticion = ahora

	if tipo == "mejora" then
		comprarMejora(jugador, estado, clave)
	elseif tipo == "renacer" then
		hacerRenacer(jugador, estado)
	elseif tipo == "codigo" then
		canjearCodigo(jugador, estado, clave)
	end
end)

local function conectarPuertas()
	for _, muro in ipairs(mundo.puertas:GetChildren()) do
		local aviso = muro:FindFirstChildOfClass("ProximityPrompt")
		local clave = muro:GetAttribute("zona")
		if aviso and clave then
			aviso.Triggered:Connect(function(jugador)
				local estado = estados[jugador]
				if not estado or not estado.cargado then
					return
				end
				if estado.zonas[clave] then
					return
				end
				local zona = mundo.porClave[clave]
				if not zona then
					return
				end
				local precio = zona.def.precio
				if estado.dinero < precio then
					avisar(jugador, "sinDinero")
					return
				end
				estado.dinero = estado.dinero - precio
				estado.zonas[clave] = true
				refrescarMarcador(jugador, estado)
				RemotoAviso:FireClient(jugador, { tipo = "zona", clave = clave })
				guardar(jugador)
			end)
		end
	end
end


-------------------------------------------------------------------
--  LA PALA Y EL POLVO DE NIEVE
-------------------------------------------------------------------

local function darPala(jugador, pers)
	local vieja = pers:FindFirstChild("Pala")
	if vieja then
		vieja:Destroy()
	end

	-- Sin Tool: se suelda al brazo. Con Tool.Grip hay que adivinar como
	-- esta orientada la mano y la pala acaba flotando al lado del muneco.
	--
	-- El personaje llega por piezas, asi que el brazo puede no estar
	-- todavia: se espera al que toque segun sea R6 o R15.
	local brazo = pers:FindFirstChild("RightHand") or pers:FindFirstChild("Right Arm")
	if not brazo then
		local humano = pers:FindFirstChildOfClass("Humanoid")
		local esR15 = humano ~= nil and humano.RigType == Enum.HumanoidRigType.R15
		brazo = pers:WaitForChild(esR15 and "RightHand" or "Right Arm", 8)
	end
	if not brazo then
		warn("[nieve] no encuentro el brazo: este jugador se queda sin pala")
		return
	end
	local esR15 = pers:FindFirstChild("RightHand") ~= nil

	local grupo = Instance.new("Model")
	grupo.Name = "Pala"

	local mango = Instance.new("Part")
	mango.Name = "Mango"
	mango.Size = Vector3.new(0.16, 2.4, 0.16)
	mango.Color = Color3.fromRGB(126, 88, 54)
	mango.Material = Enum.Material.Wood
	mango.CanCollide = false
	mango.CanQuery = false
	mango.CanTouch = false
	mango.Massless = true
	mango.CFrame = brazo.CFrame
		* CFrame.new(0, esR15 and -0.45 or -0.95, -0.2)
		* CFrame.Angles(math.rad(18), 0, 0)
	mango.Parent = grupo

	local hoja = Instance.new("Part")
	hoja.Name = "Hoja"
	hoja.Size = Vector3.new(1, 0.14, 0.85)
	hoja.Color = Color3.fromRGB(198, 214, 234)
	hoja.Material = Enum.Material.Metal
	hoja.CanCollide = false
	hoja.CanQuery = false
	hoja.CanTouch = false
	hoja.Massless = true
	hoja.CFrame = mango.CFrame * CFrame.new(0, -1.25, -0.3)
	hoja.Parent = grupo

	local alBrazo = Instance.new("WeldConstraint")
	alBrazo.Part0 = brazo
	alBrazo.Part1 = mango
	alBrazo.Parent = mango

	local alMango = Instance.new("WeldConstraint")
	alMango.Part0 = mango
	alMango.Part1 = hoja
	alMango.Parent = hoja

	grupo.Parent = pers
end

local function prepararPolvo(pers, estado)
	local raiz = pers:FindFirstChild("HumanoidRootPart")
	if not raiz then
		return
	end
	local punto = Instance.new("Attachment")
	punto.Name = "PolvoNieve"
	punto.Position = Vector3.new(0, -2.2, -1.6)
	punto.Parent = raiz

	local emisor = Instance.new("ParticleEmitter")
	emisor.Texture = "rbxasset://textures/particles/smoke_main.dds"
	emisor.Color = ColorSequence.new(Color3.fromRGB(255, 255, 255))
	emisor.Size = NumberSequence.new(1.5)
	emisor.Transparency = NumberSequence.new({
		NumberSequenceKeypoint.new(0, 0.15),
		NumberSequenceKeypoint.new(1, 1),
	})
	emisor.Lifetime = NumberRange.new(0.35, 0.75)
	emisor.Rate = 42
	emisor.Speed = NumberRange.new(3, 8)
	emisor.SpreadAngle = Vector2.new(40, 40)
	emisor.Acceleration = Vector3.new(0, -14, 0)
	emisor.LightEmission = 0.4
	emisor.Enabled = false
	emisor.Parent = punto

	estado.emisor = emisor
end


-------------------------------------------------------------------
--  RECOGER Y VENDER
-------------------------------------------------------------------

local function tiempoRegreso()
	local cuantos = #Jugadores:GetPlayers()
	local segundos = A.mundo.regreso / (1 + cuantos / A.mundo.regresoPorJugador)
	return math.max(A.mundo.regresoMinimo, segundos)
end

local function zonaEn(pos)
	for _, zona in ipairs(mundo.zonas) do
		if pos.X >= zona.x0 and pos.X <= zona.x1 and pos.Z >= zona.z0 and pos.Z <= zona.z1 then
			return zona
		end
	end
	return nil
end

local function recoger(jugador, estado, pos)
	if pos.Y > A.jugador.alturaMaxima then
		return
	end
	local zona = zonaEn(pos)
	if not zona then
		return
	end
	estado.zonaVista = zona.clave
	if not estado.zonas[zona.clave] then
		return
	end

	local capacidad = capacidadDe(estado)
	local hueco = capacidad - estado.carga
	if hueco <= 0 then
		return
	end

	local celda = zona.celda
	local radio = radioDe(estado)
	local radio2 = radio * radio
	local potencia = math.min(potenciaDe(estado), hueco)

	local cxMin = math.max(0, math.floor((pos.X - radio - zona.x0) / celda))
	local cxMax = math.min(zona.def.ancho - 1, math.floor((pos.X + radio - zona.x0) / celda))
	local czMin = math.max(0, math.floor((pos.Z - radio - zona.z0) / celda))
	local czMax = math.min(zona.def.largo - 1, math.floor((pos.Z + radio - zona.z0) / celda))

	local vuelveEn = os.clock() + tiempoRegreso()
	local cogidas = 0

	for cx = cxMin, cxMax do
		local columna = zona.rejilla[cx]
		if columna then
			for cz = czMin, czMax do
				local casilla = columna[cz]
				if casilla and casilla.activa then
					local dx = casilla.x - pos.X
					local dz = casilla.z - pos.Z
					if dx * dx + dz * dz <= radio2 then
						casilla.activa = false
						casilla.parte.Transparency = 1
						casilla.vuelveEn = vuelveEn
						zona.activas = zona.activas - 1
						cogidas = cogidas + 1
						if cogidas >= potencia then
							break
						end
					end
				end
			end
		end
		if cogidas >= potencia then
			break
		end
	end

	if cogidas > 0 then
		estado.carga = estado.carga + cogidas
		estado.valor = estado.valor + cogidas * zona.def.valor
		estado.nieveTotal = estado.nieveTotal + cogidas
		estado.recogiendo = true
	end
end

local function vender(jugador, estado, pos)
	if estado.carga <= 0 then
		return
	end
	local plano = Vector3.new(pos.X, 0, pos.Z)
	for _, zona in ipairs(mundo.zonas) do
		if estado.zonas[zona.clave] and (plano - zona.ventaEn).Magnitude <= A.jugador.radioVenta then
			local ganado = math.floor(estado.valor * multiplicadorDe(estado))
			estado.dinero = estado.dinero + ganado
			estado.carga = 0
			estado.valor = 0
			refrescarMarcador(jugador, estado)
			RemotoAviso:FireClient(jugador, { tipo = "venta", cantidad = ganado })
			return
		end
	end
end


-------------------------------------------------------------------
--  LO QUE VE EL CLIENTE
-------------------------------------------------------------------

local function paqueteDe(estado)
	local zona = mundo.porClave[estado.zonaVista] or mundo.zonas[1]
	local precios = {}
	for _, def in ipairs(A.mejoras) do
		local nivel = estado.niveles[def.clave] or 1
		precios[def.clave] = (nivel >= def.niveles) and -1 or precioMejora(def, nivel)
	end
	return {
		dinero = math.floor(estado.dinero),
		carga = estado.carga,
		capacidad = capacidadDe(estado),
		valor = math.floor(estado.valor * multiplicadorDe(estado)),
		niveles = estado.niveles,
		precios = precios,
		zonas = estado.zonas,
		zona = zona.clave,
		limpio = 1 - (zona.activas / math.max(1, zona.total)),
		renaceres = estado.renaceres,
		precioRenacer = precioRenacer(estado),
		puedeRenacer = tieneTodasLasZonas(estado),
		multiplicador = multiplicadorDe(estado),
	}
end


-------------------------------------------------------------------
--  ENTRAR Y SALIR
-------------------------------------------------------------------

local function comprobarPases(jugador, estado)
	for clave, id in pairs(A.pases) do
		if type(id) == "number" and id > 0 then
			local ok, tiene = pcall(function()
				return Mercado:UserOwnsGamePassAsync(jugador.UserId, id)
			end)
			estado.pases[clave] = (ok and tiene) or false
		end
	end
end

local function alAparecer(jugador, pers)
	local estado = estados[jugador]
	if not estado then
		return
	end
	local humano = pers:WaitForChild("Humanoid", 8)
	if not humano then
		return
	end
	estado.emisor = nil
	estado.recogiendo = false
	humano.WalkSpeed = velocidadDe(estado)
	darPala(jugador, pers)
	prepararPolvo(pers, estado)
end

local function alEntrar(jugador)
	crearMarcador(jugador)

	local estado = nuevoEstado()
	estados[jugador] = estado

	if almacen then
		local ok, datos = reintentar(function()
			return almacen:GetAsync(claveDe(jugador))
		end)
		-- Si la lectura falla NO guardamos: mejor una partida perdida
		-- que machacar la buena con una vacia.
		if ok then
			if datos then
				aplicarDatos(estado, datos)
			end
			estado.puedeGuardar = true
		else
			estado.puedeGuardar = false
			avisar(jugador, "sinGuardado")
		end
	end

	-- Se ha podido ir mientras leiamos.
	if estados[jugador] ~= estado or jugador.Parent == nil then
		return
	end

	estado.cargado = true
	comprobarPremio(jugador, estado)
	refrescarMarcador(jugador, estado)
	task.spawn(comprobarPases, jugador, estado)

	jugador.CharacterAdded:Connect(function(pers)
		alAparecer(jugador, pers)
	end)
	if jugador.Character then
		task.spawn(alAparecer, jugador, jugador.Character)
	end
end

local function alSalir(jugador)
	subirRecord(jugador, estados[jugador])
	guardar(jugador)
	estados[jugador] = nil
end


-------------------------------------------------------------------
--  BUCLES
-------------------------------------------------------------------

local function bucle(nombre, cada, fn)
	task.spawn(function()
		while true do
			task.wait(cada)
			local ok, err = pcall(fn)
			if not ok then
				warn("[nieve] fallo en " .. nombre .. ": " .. tostring(err))
			end
		end
	end)
end

local function ticJuego()
	for jugador, estado in pairs(estados) do
		if estado.cargado then
			local pers = jugador.Character
			local raiz = pers and pers:FindFirstChild("HumanoidRootPart")
			if raiz then
				local antes = estado.recogiendo
				estado.recogiendo = false
				recoger(jugador, estado, raiz.Position)
				vender(jugador, estado, raiz.Position)
				if estado.emisor and estado.recogiendo ~= antes then
					estado.emisor.Enabled = estado.recogiendo
				end
			end
		end
	end
end

local function ticNieve()
	local ahora = os.clock()
	local devueltas = 0
	for _, zona in ipairs(mundo.zonas) do
		for _, casilla in ipairs(zona.casillas) do
			if not casilla.activa and casilla.vuelveEn <= ahora then
				casilla.activa = true
				casilla.parte.Transparency = 0
				zona.activas = zona.activas + 1
				devueltas = devueltas + 1
				if devueltas >= A.mundo.maxRegresoPorTanda then
					return
				end
			end
		end
	end
end

local function ticEstado()
	for jugador, estado in pairs(estados) do
		if estado.cargado then
			RemotoEstado:FireClient(jugador, paqueteDe(estado))
		end
	end
end

local function ticGuardado()
	-- Copia primero: guardar cede el hilo y alguien puede irse en medio,
	-- y no se recorre una tabla que esta cambiando.
	local lista = {}
	for jugador in pairs(estados) do
		lista[#lista + 1] = jugador
	end
	for _, jugador in ipairs(lista) do
		if estados[jugador] then
			guardar(jugador)
			subirRecord(jugador, estados[jugador])
			task.wait(0.2)
		end
	end
end


-------------------------------------------------------------------
--  ARRANQUE
-------------------------------------------------------------------

Jugadores.CharacterAutoLoads = false
Jugadores.PlayerAdded:Connect(alEntrar)
Jugadores.PlayerRemoving:Connect(alSalir)

construirMundo()
conectarPuertas()
construirTabla()
task.spawn(refrescarTabla)

Jugadores.CharacterAutoLoads = true
for _, jugador in ipairs(Jugadores:GetPlayers()) do
	if not estados[jugador] then
		task.spawn(alEntrar, jugador)
	end
	if not jugador.Character then
		task.spawn(function()
			pcall(function()
				jugador:LoadCharacter()
			end)
		end)
	end
end

bucle("recogida", A.jugador.tic, ticJuego)
bucle("nieve", 1, ticNieve)
bucle("estado", 0.3, ticEstado)
bucle("guardado", A.guardado.cada, ticGuardado)
bucle("records", A.records.refresco, refrescarTabla)

game:BindToClose(function()
	for _, jugador in ipairs(Jugadores:GetPlayers()) do
		task.spawn(guardar, jugador)
	end
	task.wait(3)
end)

print("[nieve] mundo listo: " .. tostring(#mundo.zonas) .. " zonas")
