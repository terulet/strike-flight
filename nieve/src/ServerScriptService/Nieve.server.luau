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

local Terreno = workspace.Terrain
local CON_TERRENO = A.mundo.nieveTerreno == true
local BASE_NIEVE = 0.4                  -- lo alto que queda la parcela
local GROSOR = A.mundo.grosorNieve


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
	if CON_TERRENO then
		pcall(function()
			Terreno:Clear()
		end)
	end
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
			huecos = {},
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
	mundo.minZ = -largoMax / 2 - 62
	mundo.maxZ = largoMax / 2 + 84
end

-------------------------------------------------------------------
--  PIEZAS QUE SE REPITEN POR TODO EL MAPA
-------------------------------------------------------------------

local NIEVE = Color3.fromRGB(246, 250, 255)

-- Marca un trozo de parcela donde NO va nieve. Sin esto, la mesa del
-- jardin o la red de tenis saldrian medio enterradas en bloques.
local function hueco(zona, x0, z0, x1, z1)
	zona.huecos[#zona.huecos + 1] = {
		x0 = math.min(x0, x1),
		x1 = math.max(x0, x1),
		z0 = math.min(z0, z1),
		z1 = math.max(z0, z1),
	}
end

local function enHueco(zona, x, z)
	for _, h in ipairs(zona.huecos) do
		if x >= h.x0 and x <= h.x1 and z >= h.z0 and z <= h.z1 then
			return true
		end
	end
	return false
end

local function pino(padre, x, z, escala)
	escala = escala or 1
	parte({
		Name = "Tronco",
		Size = Vector3.new(1.7 * escala, 7 * escala, 1.7 * escala),
		Position = Vector3.new(x, 3.5 * escala, z),
		Color = Color3.fromRGB(94, 64, 42),
		Material = Enum.Material.Wood,
		CanCollide = true,
		CanQuery = true,
	}, padre)
	for capa = 0, 2 do
		local lado = (11 - capa * 2.8) * escala
		local alto = 4.6 * escala
		local y = (6.8 + capa * 3.4) * escala
		parte({
			Name = "Copa",
			Size = Vector3.new(lado, alto, lado),
			CFrame = CFrame.new(x, y, z) * CFrame.Angles(0, math.rad(45), 0),
			Color = Color3.fromRGB(44, 102, 62),
			Material = Enum.Material.Grass,
		}, padre)
		parte({
			Name = "CopaNieve",
			Size = Vector3.new(lado * 0.7, 0.8 * escala, lado * 0.7),
			CFrame = CFrame.new(x, y + alto / 2, z) * CFrame.Angles(0, math.rad(45), 0),
			Color = NIEVE,
			Material = Enum.Material.Snow,
		}, padre)
	end
end

local function seto(padre, x, z, anchoX, anchoZ)
	parte({
		Name = "Seto",
		Size = Vector3.new(anchoX, 5, anchoZ),
		Position = Vector3.new(x, 2.5, z),
		Color = Color3.fromRGB(56, 106, 58),
		Material = Enum.Material.LeafyGrass,
		CanCollide = true,
		CanQuery = true,
	}, padre)
	parte({
		Name = "SetoNieve",
		Size = Vector3.new(anchoX + 0.5, 0.8, anchoZ + 0.5),
		Position = Vector3.new(x, 5.2, z),
		Color = NIEVE,
		Material = Enum.Material.Snow,
	}, padre)
end

-- Ventana mirando hacia la parcela (+Z).
local function ventana(padre, x, y, z)
	parte({
		Name = "Marco",
		Size = Vector3.new(4.6, 4.6, 0.4),
		Position = Vector3.new(x, y, z),
		Color = Color3.fromRGB(252, 252, 252),
	}, padre)
	parte({
		Name = "Cristal",
		Size = Vector3.new(3.7, 3.7, 0.6),
		Position = Vector3.new(x, y, z + 0.15),
		Color = Color3.fromRGB(142, 198, 232),
		Material = Enum.Material.Glass,
		Transparency = 0.25,
	}, padre)
	parte({
		Name = "Cruz",
		Size = Vector3.new(0.3, 3.7, 0.7),
		Position = Vector3.new(x, y, z + 0.2),
		Color = Color3.fromRGB(252, 252, 252),
	}, padre)
	parte({
		Name = "Alfeizar",
		Size = Vector3.new(5.2, 0.5, 1),
		Position = Vector3.new(x, y - 2.5, z + 0.3),
		Color = NIEVE,
		Material = Enum.Material.Snow,
	}, padre)
end

local function farola(padre, x, z)
	parte({
		Name = "Farola",
		Size = Vector3.new(0.7, 16, 0.7),
		Position = Vector3.new(x, 8, z),
		Color = Color3.fromRGB(44, 48, 58),
		Material = Enum.Material.Metal,
		CanCollide = true,
		CanQuery = true,
	}, padre)
	parte({
		Name = "Brazo",
		Size = Vector3.new(3.5, 0.5, 0.5),
		Position = Vector3.new(x + 1.7, 15.8, z),
		Color = Color3.fromRGB(44, 48, 58),
	}, padre)
	parte({
		Name = "Luz",
		Size = Vector3.new(2.4, 0.8, 1.6),
		Position = Vector3.new(x + 3.2, 15.3, z),
		Color = Color3.fromRGB(255, 238, 190),
		Material = Enum.Material.Neon,
	}, padre)
end

local function coche(padre, x, z, color)
	parte({
		Name = "Coche",
		Size = Vector3.new(7, 3.2, 15),
		Position = Vector3.new(x, 2.3, z),
		Color = color,
		CanCollide = true,
		CanQuery = true,
	}, padre)
	parte({
		Name = "Cabina",
		Size = Vector3.new(6.4, 2.8, 7),
		Position = Vector3.new(x, 5.3, z - 0.6),
		Color = color,
	}, padre)
	parte({
		Name = "Lunas",
		Size = Vector3.new(6.6, 2, 6.6),
		Position = Vector3.new(x, 5.4, z - 0.6),
		Color = Color3.fromRGB(126, 172, 202),
		Material = Enum.Material.Glass,
		Transparency = 0.35,
	}, padre)
	parte({
		Name = "TechoNieve",
		Size = Vector3.new(6.6, 0.5, 7.2),
		Position = Vector3.new(x, 6.9, z - 0.6),
		Color = NIEVE,
		Material = Enum.Material.Snow,
	}, padre)
	for _, dx in ipairs({ -3.5, 3.5 }) do
		for _, dz in ipairs({ -5, 5 }) do
			parte({
				Name = "Rueda",
				Shape = Enum.PartType.Cylinder,
				Size = Vector3.new(1.2, 2.6, 2.6),
				Position = Vector3.new(x + dx, 1.3, z + dz),
				Color = Color3.fromRGB(26, 26, 30),
			}, padre)
		end
	end
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

-- Un cubo de nieve del terreno, puesto o quitado. Al quitar se pide un
-- poco mas de sitio del que se lleno, o quedan restos en los bordes.
local function nieveEn(x, z, poner)
	if poner then
		Terreno:FillBlock(
			CFrame.new(x, BASE_NIEVE + GROSOR / 2, z),
			Vector3.new(A.mundo.celda, GROSOR, A.mundo.celda),
			Enum.Material.Snow
		)
	else
		Terreno:FillBlock(
			CFrame.new(x, BASE_NIEVE + GROSOR / 2, z),
			Vector3.new(A.mundo.celda + 0.2, GROSOR + 2, A.mundo.celda + 0.2),
			Enum.Material.Air
		)
	end
end

-- Pinta una casilla como puesta o recogida, sea terreno o pieza.
local function pintarCasilla(casilla, hayNieve)
	if CON_TERRENO then
		nieveEn(casilla.x, casilla.z, hayNieve)
	elseif casilla.parte then
		casilla.parte.Transparency = hayNieve and 0 or 1
	end
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
			local px = zona.x0 + (cx + 0.5) * celda
			local pz = zona.z0 + (cz + 0.5) * celda
			if enHueco(zona, px, pz) then
				continue
			end

			local bloque = nil
			if not CON_TERRENO then
				-- Camino de repuesto. OJO: una pieza con Shape=Ball se
				-- dibuja como esfera del eje MAS PEQUENO, asi que para
				-- una cupula ancha y plana hace falta una malla.
				local ancho = celda * (1.5 + aleatorio:NextNumber() * 0.3)
				local altura = A.mundo.alturaNieve * (0.5 + aleatorio:NextNumber() * 0.55)
				local tono = 243 + math.floor(aleatorio:NextNumber() * 12)
				bloque = parte({
					Name = "n",
					Size = Vector3.new(ancho, altura, ancho * (0.88 + aleatorio:NextNumber() * 0.24)),
					CFrame = CFrame.new(
						px + (aleatorio:NextNumber() - 0.5) * celda * 0.36,
						BASE_NIEVE + altura * 0.16,
						pz + (aleatorio:NextNumber() - 0.5) * celda * 0.36
					) * CFrame.Angles(0, aleatorio:NextNumber() * math.pi, 0),
					Color = Color3.fromRGB(tono - 8, tono - 3, tono),
					Material = Enum.Material.Snow,
				}, carpetaNieve)
				local malla = Instance.new("SpecialMesh")
				malla.MeshType = Enum.MeshType.Sphere
				malla.Parent = bloque
			end

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
			if hechas % 600 == 0 then
				task.wait()
			end
		end
	end

	-- Con terreno se nieva la parcela entera de una vez y luego se
	-- destapan los huecos del decorado: son dos ordenes en vez de miles.
	if CON_TERRENO then
		Terreno:FillBlock(
			CFrame.new(zona.centroX, BASE_NIEVE + GROSOR / 2, (zona.z0 + zona.z1) / 2),
			Vector3.new(zona.x1 - zona.x0, GROSOR, zona.z1 - zona.z0),
			Enum.Material.Snow
		)
		for _, h in ipairs(zona.huecos) do
			Terreno:FillBlock(
				CFrame.new((h.x0 + h.x1) / 2, BASE_NIEVE + GROSOR / 2, (h.z0 + h.z1) / 2),
				Vector3.new(h.x1 - h.x0, GROSOR + 2, h.z1 - h.z0),
				Enum.Material.Air
			)
		end
	end

	-- El total es lo que se ha puesto de verdad, no ancho por largo: los
	-- huecos del decorado no cuentan para el "% limpio".
	zona.total = #zona.casillas
	zona.activas = #zona.casillas
end

local function construirCamion(zona, padre)
	local cx = zona.centroX
	local cz = zona.z1 + 22
	local suelo = 0

	-- Todo relativo al morro del camion, que mira hacia -X.
	local function trozo(nombre, tam, dx, dy, dz, color, material, giro)
		local cf = CFrame.new(cx + dx, suelo + dy, cz + dz)
		if giro then
			cf = cf * CFrame.Angles(giro[1] or 0, giro[2] or 0, giro[3] or 0)
		end
		return parte({
			Name = nombre,
			Size = tam,
			CFrame = cf,
			Color = color,
			Material = material or Enum.Material.SmoothPlastic,
			CanCollide = true,
			CanQuery = true,
		}, padre)
	end

	local ROJO = Color3.fromRGB(178, 46, 46)
	local ROJO_OSCURO = Color3.fromRGB(126, 32, 32)
	local CHASIS = Color3.fromRGB(38, 40, 46)
	local ACERO = Color3.fromRGB(158, 164, 174)
	local CRISTAL = Color3.fromRGB(120, 168, 200)

	-- Sitio donde se vende: un rectangulo que se ve desde lejos.
	parte({
		Name = "PuntoVenta",
		Size = Vector3.new(24, 0.3, 16),
		Position = Vector3.new(cx, 0.15, cz - 10),
		Color = Color3.fromRGB(120, 205, 255),
		Material = Enum.Material.Neon,
		Transparency = 0.55,
	}, padre)

	-- Chasis y ejes.
	trozo("Chasis", Vector3.new(34, 1.2, 7), 0, 3, 0, CHASIS, Enum.Material.Metal)
	for _, dx in ipairs({ -11, 6, 10.5 }) do
		trozo("Eje", Vector3.new(1.2, 1.2, 9.6), dx, 2.6, 0, CHASIS, Enum.Material.Metal)
	end

	-- Cabina: morro, techo, luna delantera inclinada y ventanillas.
	trozo("Cabina", Vector3.new(9, 7.5, 8.6), -12, 7.4, 0, ROJO, Enum.Material.Metal)
	trozo("TechoCabina", Vector3.new(9.4, 0.7, 9), -12, 11.4, 0, ROJO_OSCURO, Enum.Material.Metal)
	trozo("NieveTecho", Vector3.new(9.6, 0.5, 9.2), -12, 11.9, 0, NIEVE, Enum.Material.Snow)
	trozo("Luna", Vector3.new(0.5, 4.6, 7.8), -7.4, 9.4, 0, CRISTAL, Enum.Material.Glass, { 0, 0, math.rad(-16) })
	for _, dz in ipairs({ -4.4, 4.4 }) do
		trozo("Ventanilla", Vector3.new(4.4, 3, 0.4), -12.5, 9.4, dz, CRISTAL, Enum.Material.Glass)
	end
	trozo("Parrilla", Vector3.new(0.6, 4, 7.6), -16.6, 6.4, 0, ACERO, Enum.Material.Metal)
	for i = 1, 4 do
		trozo("Barra", Vector3.new(0.8, 0.35, 7.8), -16.8, 5 + i * 0.9, 0, CHASIS, Enum.Material.Metal)
	end
	trozo("Parachoques", Vector3.new(1.4, 1.8, 9.4), -17.2, 3.4, 0, ACERO, Enum.Material.Metal)
	for _, dz in ipairs({ -3, 3 }) do
		trozo("Faro", Vector3.new(0.5, 1.5, 2.2), -17, 5.6, dz, Color3.fromRGB(255, 242, 196), Enum.Material.Neon)
	end
	for _, dz in ipairs({ -5, 5 }) do
		trozo("Retrovisor", Vector3.new(0.4, 2.2, 1), -14.6, 10, dz, CHASIS, Enum.Material.Metal)
		trozo("BrazoRetro", Vector3.new(1.6, 0.3, 0.3), -13.8, 10, dz, CHASIS, Enum.Material.Metal)
	end
	trozo("Tubo", Vector3.new(1, 8, 1), -7.6, 11, -4.2, ACERO, Enum.Material.Metal)

	-- Volquete: suelo, laterales, frente, puerta trasera y refuerzos.
	trozo("VolqueteSuelo", Vector3.new(21, 0.8, 9.6), 4, 4.4, 0, ROJO_OSCURO, Enum.Material.Metal)
	for _, dz in ipairs({ -4.8, 4.8 }) do
		trozo("VolqueteLado", Vector3.new(21, 6, 0.7), 4, 7.6, dz, ROJO, Enum.Material.Metal)
	end
	trozo("VolqueteFrente", Vector3.new(0.7, 6.6, 9.6), -6.4, 7.9, 0, ROJO, Enum.Material.Metal)
	trozo("VolquetePuerta", Vector3.new(0.7, 5.4, 9.6), 14.4, 7.3, 0, ROJO_OSCURO, Enum.Material.Metal)
	for i = 0, 4 do
		for _, dz in ipairs({ -5.1, 5.1 }) do
			trozo("Refuerzo", Vector3.new(0.6, 6, 0.5), -4 + i * 4.2, 7.6, dz, ROJO_OSCURO, Enum.Material.Metal)
		end
	end

	-- La nieve que ya se ha descargado, asomando por el volquete.
	parte({
		Name = "CargaNieve",
		Shape = Enum.PartType.Ball,
		Size = Vector3.new(19, 5, 9),
		Position = Vector3.new(cx + 4, suelo + 9.6, cz),
		Color = NIEVE,
		Material = Enum.Material.Snow,
	}, padre)

	-- Seis ruedas con su llanta.
	for _, dx in ipairs({ -11, 6, 10.5 }) do
		for _, dz in ipairs({ -4.8, 4.8 }) do
			parte({
				Name = "RuedaCamion",
				Shape = Enum.PartType.Cylinder,
				Size = Vector3.new(2.4, 5.6, 5.6),
				CFrame = CFrame.new(cx + dx, suelo + 2.8, cz + dz) * CFrame.Angles(0, 0, math.rad(90)),
				Color = Color3.fromRGB(26, 26, 30),
				Material = Enum.Material.Metal,
			}, padre)
			parte({
				Name = "LlantaCamion",
				Shape = Enum.PartType.Cylinder,
				Size = Vector3.new(2.6, 2.8, 2.8),
				CFrame = CFrame.new(cx + dx, suelo + 2.8, cz + dz) * CFrame.Angles(0, 0, math.rad(90)),
				Color = ACERO,
				Material = Enum.Material.Metal,
			}, padre)
		end
		trozo("Guardabarros", Vector3.new(6.4, 0.5, 11), dx, 6, 0, CHASIS, Enum.Material.Metal)
	end

	-- El monton de nieve ya vendida, al lado.
	for i = 1, 4 do
		parte({
			Name = "Monton",
			Shape = Enum.PartType.Ball,
			Size = Vector3.new(9 + i * 2, 5 + i, 9 + i * 2),
			Position = Vector3.new(cx + 22 + i * 3, 0.6, cz + 5),
			Color = Color3.fromRGB(246, 250, 255),
			Material = Enum.Material.Snow,
		}, padre)
	end

	local caja = padre:FindFirstChild("Cabina")
	if caja then
		cartel(caja, "SELL", "vender", 9, 12)
	end
	-- El punto de venta, justo fuera de la parcela: si cayera dentro se
	-- venderia solo mientras barres y no habria viaje que hacer.
	zona.ventaEn = Vector3.new(cx, 0, cz - 10)
	zona.camion = caja
end


-------------------------------------------------------------------
--  LO QUE HAY EN CADA ZONA
--
--  Cada una tiene que reconocerse de un vistazo, y sobre todo: al quitar
--  la nieve tiene que aparecer algo que merezca la pena ver. Eso es media
--  gracia del genero. Si debajo hay hormigon gris, limpiar no sabe a nada.
-------------------------------------------------------------------

local CREMA = Color3.fromRGB(232, 214, 186)
local LADRILLO = Color3.fromRGB(158, 92, 74)
local MADERA = Color3.fromRGB(126, 88, 54)
local PIZARRA = Color3.fromRGB(72, 78, 92)

-- ZONA 1 · LA ENTRADA: la casa, el garaje y el coche.
local function decoradoCasa(zona, padre)
	local cx = zona.centroX
	local zCasa = zona.z0 - 24
	local frente = zona.z0 - 13

	parte({ Name = "Casa", Size = Vector3.new(42, 18, 22), Position = Vector3.new(cx, 9, zCasa),
		Color = CREMA, Material = Enum.Material.Concrete, CanCollide = true, CanQuery = true }, padre)
	parte({ Name = "Zocalo", Size = Vector3.new(43, 3.2, 23), Position = Vector3.new(cx, 1.6, zCasa),
		Color = LADRILLO, Material = Enum.Material.Brick }, padre)
	parte({ Name = "Tejado", Size = Vector3.new(46, 2, 26), Position = Vector3.new(cx, 19, zCasa),
		Color = PIZARRA, Material = Enum.Material.Slate }, padre)
	parte({ Name = "TejadoNieve", Size = Vector3.new(46.5, 1.3, 26.5), Position = Vector3.new(cx, 20.6, zCasa),
		Color = NIEVE, Material = Enum.Material.Snow }, padre)
	parte({ Name = "Chimenea", Size = Vector3.new(4, 9, 4), Position = Vector3.new(cx + 15, 23.5, zCasa - 6),
		Color = LADRILLO, Material = Enum.Material.Brick }, padre)
	parte({ Name = "ChimeneaNieve", Size = Vector3.new(4.6, 0.8, 4.6), Position = Vector3.new(cx + 15, 28.4, zCasa - 6),
		Color = NIEVE, Material = Enum.Material.Snow }, padre)

	-- El garaje, mirando a la parcela.
	parte({ Name = "Garaje", Size = Vector3.new(15, 10, 0.8), Position = Vector3.new(cx - 11, 5.2, frente + 0.2),
		Color = Color3.fromRGB(206, 208, 212), Material = Enum.Material.Metal }, padre)
	for i = 1, 5 do
		parte({ Name = "Ranura", Size = Vector3.new(15, 0.25, 1), Position = Vector3.new(cx - 11, 0.9 + i * 1.7, frente + 0.5),
			Color = Color3.fromRGB(168, 172, 178) }, padre)
	end

	parte({ Name = "PuertaCasa", Size = Vector3.new(5, 8.5, 0.8), Position = Vector3.new(cx + 13, 4.4, frente + 0.2),
		Color = MADERA, Material = Enum.Material.WoodPlanks }, padre)
	parte({ Name = "Pomo", Shape = Enum.PartType.Ball, Size = Vector3.new(0.7, 0.7, 0.7),
		Position = Vector3.new(cx + 14.6, 4.4, frente + 0.7), Color = Color3.fromRGB(228, 190, 84), Material = Enum.Material.Metal }, padre)
	parte({ Name = "Escalon", Size = Vector3.new(7, 0.7, 3), Position = Vector3.new(cx + 13, 0.75, frente + 2),
		Color = Color3.fromRGB(228, 228, 232), Material = Enum.Material.Concrete }, padre)

	ventana(padre, cx + 3, 12, frente + 0.1)
	ventana(padre, cx + 20, 12, frente + 0.1)
	ventana(padre, cx - 4, 12, frente + 0.1)

	seto(padre, cx + 8, frente + 3, 4, 4)
	seto(padre, cx + 18, frente + 3, 4, 4)

	-- El coche, aparcado en la entrada: hay que quitar la nieve a su lado.
	local xCoche = zona.x0 + 13
	hueco(zona, xCoche - 6, -16, xCoche + 6, 4)
	coche(padre, xCoche, -6, Color3.fromRGB(188, 62, 62))

	-- El buzon, en la esquina de la parcela.
	local xBuzon = zona.x1 - 6
	hueco(zona, xBuzon - 3, zona.z1 - 7, xBuzon + 3, zona.z1 - 1)
	parte({ Name = "PosteBuzon", Size = Vector3.new(0.7, 5, 0.7), Position = Vector3.new(xBuzon, 2.5, zona.z1 - 4),
		Color = MADERA, Material = Enum.Material.Wood, CanCollide = true, CanQuery = true }, padre)
	parte({ Name = "Buzon", Size = Vector3.new(2.4, 2, 3.4), Position = Vector3.new(xBuzon, 6, zona.z1 - 4),
		Color = Color3.fromRGB(72, 96, 156), Material = Enum.Material.Metal }, padre)
	parte({ Name = "BuzonNieve", Size = Vector3.new(2.7, 0.5, 3.7), Position = Vector3.new(xBuzon, 7.2, zona.z1 - 4),
		Color = NIEVE, Material = Enum.Material.Snow }, padre)

	farola(padre, zona.x0 - 8, zona.z1 - 10)
end

-- ZONA 2 · EL JARDIN: cesped, setos, mesa y barbacoa.
local function decoradoJardin(zona, padre)
	local cx = zona.centroX

	-- Setos rodeando el jardin, por fuera de la parcela.
	seto(padre, cx, zona.z0 - 4, zona.x1 - zona.x0 + 8, 5)
	for _, x in ipairs({ zona.x0 - 4, zona.x1 + 4 }) do
		seto(padre, x, 0, 5, zona.z1 - zona.z0)
	end

	-- La caseta del jardin.
	parte({ Name = "Caseta", Size = Vector3.new(16, 11, 12), Position = Vector3.new(cx - 26, 5.5, zona.z0 - 16),
		Color = Color3.fromRGB(150, 108, 74), Material = Enum.Material.WoodPlanks, CanCollide = true, CanQuery = true }, padre)
	parte({ Name = "CasetaTejado", Size = Vector3.new(18, 1.6, 14), Position = Vector3.new(cx - 26, 11.6, zona.z0 - 16),
		Color = NIEVE, Material = Enum.Material.Snow }, padre)
	parte({ Name = "CasetaPuerta", Size = Vector3.new(4, 7, 0.6), Position = Vector3.new(cx - 26, 3.5, zona.z0 - 10.2),
		Color = Color3.fromRGB(96, 68, 46), Material = Enum.Material.Wood }, padre)

	-- La mesa con sus sillas y su sombrilla, en el cesped.
	local mx, mz = cx + 24, -12
	hueco(zona, mx - 10, mz - 10, mx + 10, mz + 10)
	parte({ Name = "Mesa", Shape = Enum.PartType.Cylinder, Size = Vector3.new(0.6, 11, 11),
		CFrame = CFrame.new(mx, 4, mz) * CFrame.Angles(0, 0, math.rad(90)),
		Color = Color3.fromRGB(238, 238, 240), CanCollide = true, CanQuery = true }, padre)
	parte({ Name = "MesaNieve", Shape = Enum.PartType.Cylinder, Size = Vector3.new(0.4, 11, 11),
		CFrame = CFrame.new(mx, 4.5, mz) * CFrame.Angles(0, 0, math.rad(90)),
		Color = NIEVE, Material = Enum.Material.Snow }, padre)
	parte({ Name = "PataMesa", Size = Vector3.new(1, 4, 1), Position = Vector3.new(mx, 2, mz),
		Color = Color3.fromRGB(200, 200, 204) }, padre)
	parte({ Name = "Sombrilla", Size = Vector3.new(0.5, 13, 0.5), Position = Vector3.new(mx, 6.5, mz),
		Color = Color3.fromRGB(180, 180, 184) }, padre)
	parte({ Name = "SombrillaTela", Shape = Enum.PartType.Cylinder, Size = Vector3.new(1.4, 15, 15),
		CFrame = CFrame.new(mx, 12.6, mz) * CFrame.Angles(0, 0, math.rad(90)),
		Color = Color3.fromRGB(214, 96, 88), Material = Enum.Material.Fabric }, padre)
	for _, d in ipairs({ { 7, 0 }, { -7, 0 }, { 0, 7 }, { 0, -7 } }) do
		parte({ Name = "Silla", Size = Vector3.new(3, 1, 3), Position = Vector3.new(mx + d[1], 2.6, mz + d[2]),
			Color = Color3.fromRGB(238, 238, 240), CanCollide = true, CanQuery = true }, padre)
		parte({ Name = "Respaldo", Size = Vector3.new(3, 4, 0.6), Position = Vector3.new(mx + d[1], 4.6, mz + d[2] - 1.4),
			Color = Color3.fromRGB(238, 238, 240) }, padre)
	end

	-- La barbacoa.
	local bx, bz = cx - 24, 14
	hueco(zona, bx - 6, bz - 6, bx + 6, bz + 6)
	parte({ Name = "Barbacoa", Size = Vector3.new(6, 4, 4), Position = Vector3.new(bx, 4, bz),
		Color = Color3.fromRGB(52, 56, 64), Material = Enum.Material.Metal, CanCollide = true, CanQuery = true }, padre)
	parte({ Name = "BarbacoaPata", Size = Vector3.new(1, 2.5, 1), Position = Vector3.new(bx, 1.2, bz), Color = Color3.fromRGB(52, 56, 64) }, padre)
	parte({ Name = "BarbacoaTapa", Size = Vector3.new(6.4, 0.6, 4.4), Position = Vector3.new(bx, 6.3, bz),
		Color = NIEVE, Material = Enum.Material.Snow }, padre)

	-- Tres arboles en el cesped.
	for _, punto in ipairs({ { zona.x0 + 14, 16 }, { cx + 4, -20 }, { zona.x1 - 16, 20 } }) do
		hueco(zona, punto[1] - 8, punto[2] - 8, punto[1] + 8, punto[2] + 8)
		pino(padre, punto[1], punto[2], 1)
	end

	-- Macetas contra el seto del fondo.
	for i = 0, 5 do
		local px = zona.x0 + 10 + i * ((zona.x1 - zona.x0 - 20) / 5)
		parte({ Name = "Maceta", Size = Vector3.new(3, 2.5, 3), Position = Vector3.new(px, 1.25, zona.z0 - 9),
			Color = Color3.fromRGB(176, 106, 76), Material = Enum.Material.Concrete }, padre)
		parte({ Name = "MacetaNieve", Size = Vector3.new(3.2, 0.8, 3.2), Position = Vector3.new(px, 2.8, zona.z0 - 9),
			Color = NIEVE, Material = Enum.Material.Snow }, padre)
	end
end

-- ZONA 3 · LA PISCINA: helada, con su trampolin y sus tumbonas.
local function decoradoPiscina(zona, padre)
	local cx = zona.centroX
	local anchoP, largoP = 62, 34

	hueco(zona, cx - anchoP / 2 - 3, -largoP / 2 - 3, cx + anchoP / 2 + 3, largoP / 2 + 3)

	parte({ Name = "BordePiscina", Size = Vector3.new(anchoP + 6, 0.5, largoP + 6), Position = Vector3.new(cx, 0.65, 0),
		Color = Color3.fromRGB(246, 246, 248), Material = Enum.Material.Marble }, padre)
	parte({ Name = "Piscina", Size = Vector3.new(anchoP, 0.6, largoP), Position = Vector3.new(cx, 0.7, 0),
		Color = Color3.fromRGB(104, 194, 226), Material = Enum.Material.Ice, Transparency = 0.15 }, padre)
	parte({ Name = "PiscinaFondo", Size = Vector3.new(anchoP - 2, 0.4, largoP - 2), Position = Vector3.new(cx, 0.45, 0),
		Color = Color3.fromRGB(46, 132, 178) }, padre)

	-- Trampolin.
	local tx = cx - anchoP / 2 - 6
	parte({ Name = "TrampolinPie", Size = Vector3.new(2, 4, 3), Position = Vector3.new(tx - 2, 2, 0),
		Color = Color3.fromRGB(190, 194, 200), Material = Enum.Material.Metal, CanCollide = true, CanQuery = true }, padre)
	parte({ Name = "Trampolin", Size = Vector3.new(11, 0.7, 3.4), Position = Vector3.new(tx + 4, 4.2, 0),
		Color = Color3.fromRGB(236, 238, 242) }, padre)

	-- Escalera de la piscina.
	for _, dz in ipairs({ -1.6, 1.6 }) do
		parte({ Name = "Escalera", Size = Vector3.new(0.4, 4.5, 0.4), Position = Vector3.new(cx + anchoP / 2 - 1, 2.6, dz),
			Color = Color3.fromRGB(214, 218, 224), Material = Enum.Material.Metal }, padre)
	end

	-- Tumbonas y sombrillas.
	for i, dz in ipairs({ -largoP / 2 - 12, largoP / 2 + 12 }) do
		local ux = cx - 16 + (i - 1) * 32
		hueco(zona, ux - 8, dz - 7, ux + 8, dz + 7)
		parte({ Name = "Tumbona", Size = Vector3.new(5, 0.7, 11), Position = Vector3.new(ux, 2, dz),
			Color = Color3.fromRGB(240, 240, 244), CanCollide = true, CanQuery = true }, padre)
		parte({ Name = "TumbonaRespaldo", Size = Vector3.new(5, 4, 0.7), Position = Vector3.new(ux, 4, dz - 5),
			Color = Color3.fromRGB(240, 240, 244) }, padre)
		parte({ Name = "TumbonaNieve", Size = Vector3.new(5.2, 0.5, 11.2), Position = Vector3.new(ux, 2.6, dz),
			Color = NIEVE, Material = Enum.Material.Snow }, padre)
		parte({ Name = "PieSombrilla", Size = Vector3.new(0.5, 12, 0.5), Position = Vector3.new(ux + 7, 6, dz),
			Color = Color3.fromRGB(180, 180, 184) }, padre)
		parte({ Name = "Sombrilla", Shape = Enum.PartType.Cylinder, Size = Vector3.new(1.2, 13, 13),
			CFrame = CFrame.new(ux + 7, 11.6, dz) * CFrame.Angles(0, 0, math.rad(90)),
			Color = Color3.fromRGB(96, 176, 214), Material = Enum.Material.Fabric }, padre)
	end

	-- La casita de la piscina, al fondo.
	parte({ Name = "Casita", Size = Vector3.new(22, 12, 14), Position = Vector3.new(cx, 6, zona.z0 - 16),
		Color = Color3.fromRGB(238, 232, 220), Material = Enum.Material.Concrete, CanCollide = true, CanQuery = true }, padre)
	parte({ Name = "CasitaTejado", Size = Vector3.new(25, 1.6, 17), Position = Vector3.new(cx, 12.6, zona.z0 - 16),
		Color = NIEVE, Material = Enum.Material.Snow }, padre)
	ventana(padre, cx - 6, 7, zona.z0 - 9.1)
	ventana(padre, cx + 6, 7, zona.z0 - 9.1)
end

-- ZONA 4 · LA PISTA DE TENIS: con sus lineas pintadas y su red.
local function decoradoTenis(zona, padre)
	local cx = zona.centroX
	local anchoC, largoC = 104, 48

	local function linea(x, z, ancho, largo)
		parte({ Name = "Linea", Size = Vector3.new(ancho, 0.25, largo), Position = Vector3.new(x, 0.5, z),
			Color = Color3.fromRGB(250, 250, 252) }, padre)
	end

	linea(cx, -largoC / 2, anchoC, 0.9)
	linea(cx, largoC / 2, anchoC, 0.9)
	linea(cx - anchoC / 2, 0, 0.9, largoC)
	linea(cx + anchoC / 2, 0, 0.9, largoC)
	linea(cx - anchoC / 4, 0, 0.9, largoC * 0.7)
	linea(cx + anchoC / 4, 0, 0.9, largoC * 0.7)
	linea(cx, 0, anchoC * 0.5, 0.9)
	for _, dz in ipairs({ -largoC / 2 + 6, largoC / 2 - 6 }) do
		linea(cx, dz, anchoC, 0.7)
	end

	-- La red.
	hueco(zona, cx - 4, -largoC / 2 - 6, cx + 4, largoC / 2 + 6)
	parte({ Name = "Red", Size = Vector3.new(0.5, 5, largoC + 6), Position = Vector3.new(cx, 2.9, 0),
		Color = Color3.fromRGB(38, 42, 50), Material = Enum.Material.Fabric, Transparency = 0.25 }, padre)
	parte({ Name = "RedBanda", Size = Vector3.new(0.7, 1, largoC + 6), Position = Vector3.new(cx, 5.6, 0),
		Color = Color3.fromRGB(248, 248, 250) }, padre)
	for _, dz in ipairs({ -largoC / 2 - 3, largoC / 2 + 3 }) do
		parte({ Name = "PosteRed", Size = Vector3.new(1, 6.5, 1), Position = Vector3.new(cx, 3.2, dz),
			Color = Color3.fromRGB(52, 56, 64), Material = Enum.Material.Metal, CanCollide = true, CanQuery = true }, padre)
	end

	-- Valla de la pista, por fuera de la parcela.
	local pasos = 14
	for i = 0, pasos do
		local px = zona.x0 + i * ((zona.x1 - zona.x0) / pasos)
		for _, pz in ipairs({ zona.z0 - 5, zona.z1 + 5 }) do
			parte({ Name = "PosteValla", Size = Vector3.new(0.5, 13, 0.5), Position = Vector3.new(px, 6.5, pz),
				Color = Color3.fromRGB(96, 104, 118), Material = Enum.Material.Metal }, padre)
		end
	end
	for _, pz in ipairs({ zona.z0 - 5, zona.z1 + 5 }) do
		for _, py in ipairs({ 4, 9, 13 }) do
			parte({ Name = "TravesanoValla", Size = Vector3.new(zona.x1 - zona.x0, 0.35, 0.35),
				Position = Vector3.new(cx, py, pz), Color = Color3.fromRGB(96, 104, 118) }, padre)
		end
	end

	-- Banco y marcador.
	local bx = zona.x0 + 14
	parte({ Name = "Banco", Size = Vector3.new(4, 1, 12), Position = Vector3.new(bx, 3, zona.z1 + 10),
		Color = MADERA, Material = Enum.Material.WoodPlanks, CanCollide = true, CanQuery = true }, padre)
	parte({ Name = "BancoNieve", Size = Vector3.new(4.2, 0.5, 12.2), Position = Vector3.new(bx, 3.7, zona.z1 + 10),
		Color = NIEVE, Material = Enum.Material.Snow }, padre)
	for _, dz in ipairs({ -4.5, 4.5 }) do
		parte({ Name = "PataBanco", Size = Vector3.new(3.4, 2.6, 0.8), Position = Vector3.new(bx, 1.3, zona.z1 + 10 + dz),
			Color = Color3.fromRGB(84, 88, 98) }, padre)
	end
end

-- ZONA 5 · EL BOSQUE: pinos, cabana y estanque helado.
local function decoradoBosque(zona, padre)
	local cx = zona.centroX

	local sitios = {
		{ zona.x0 + 20, -50 }, { zona.x0 + 46, 22 }, { zona.x0 + 74, -28 },
		{ cx + 10, 44 }, { cx + 34, -14 }, { zona.x1 - 58, 52 },
		{ zona.x1 - 26, -46 }, { zona.x1 - 16, 18 }, { cx - 30, 8 },
	}
	for i, punto in ipairs(sitios) do
		local escala = 1 + ((i % 3) * 0.25)
		hueco(zona, punto[1] - 9 * escala, punto[2] - 9 * escala, punto[1] + 9 * escala, punto[2] + 9 * escala)
		pino(padre, punto[1], punto[2], escala)
	end

	-- El estanque helado.
	local ex, ez = zona.x0 + 30, 40
	hueco(zona, ex - 24, ez - 16, ex + 24, ez + 16)
	parte({ Name = "Estanque", Size = Vector3.new(46, 0.5, 30), Position = Vector3.new(ex, 0.65, ez),
		Color = Color3.fromRGB(150, 206, 226), Material = Enum.Material.Ice, Transparency = 0.1 }, padre)
	for i = 0, 7 do
		local ang = i * math.pi / 4
		parte({ Name = "Piedra", Shape = Enum.PartType.Ball, Size = Vector3.new(4, 3, 4),
			Position = Vector3.new(ex + math.cos(ang) * 25, 0.8, ez + math.sin(ang) * 17),
			Color = Color3.fromRGB(150, 150, 156), Material = Enum.Material.Slate }, padre)
	end

	-- La cabana.
	parte({ Name = "Cabana", Size = Vector3.new(26, 14, 20), Position = Vector3.new(cx + 40, 7, zona.z0 - 18),
		Color = Color3.fromRGB(122, 84, 56), Material = Enum.Material.WoodPlanks, CanCollide = true, CanQuery = true }, padre)
	parte({ Name = "CabanaTejado", Size = Vector3.new(30, 2, 24), Position = Vector3.new(cx + 40, 15, zona.z0 - 18),
		Color = NIEVE, Material = Enum.Material.Snow }, padre)
	parte({ Name = "CabanaPuerta", Size = Vector3.new(5, 8, 0.7), Position = Vector3.new(cx + 40, 4, zona.z0 - 8.2),
		Color = Color3.fromRGB(88, 60, 40), Material = Enum.Material.Wood }, padre)
	ventana(padre, cx + 32, 8, zona.z0 - 8.1)
	ventana(padre, cx + 48, 8, zona.z0 - 8.1)
	parte({ Name = "CabanaChimenea", Size = Vector3.new(3.5, 8, 3.5), Position = Vector3.new(cx + 50, 19, zona.z0 - 22),
		Color = Color3.fromRGB(128, 122, 116), Material = Enum.Material.Slate }, padre)

	-- Rocas nevadas sueltas.
	for i = 0, 5 do
		local px = zona.x0 + 30 + i * ((zona.x1 - zona.x0 - 60) / 5)
		local tam = 9 + aleatorio:NextNumber() * 10
		hueco(zona, px - tam, zona.z0 + 8 - tam, px + tam, zona.z0 + 8 + tam)
		parte({ Name = "Roca", Shape = Enum.PartType.Ball, Size = Vector3.new(tam, tam * 0.7, tam),
			Position = Vector3.new(px, tam * 0.2, zona.z0 + 8), Color = Color3.fromRGB(226, 234, 244),
			Material = Enum.Material.Snow, CanCollide = true, CanQuery = true }, padre)
	end
end

local DECORADOS = {
	casa = decoradoCasa,
	jardin = decoradoJardin,
	piscina = decoradoPiscina,
	tenis = decoradoTenis,
	bosque = decoradoBosque,
}

local function decorarZona(zona, padre)
	local montar = DECORADOS[zona.def.decorado]
	if montar then
		montar(zona, padre)
	end
end

-- Las casas, los arboles y el camion si proyectan sombra: es lo que hace
-- que el sitio no parezca de carton. Los bloques de nieve no, que son casi
-- tres mil y eso si se nota en un movil.
local function sombrasEnDecorado(grupo)
	for _, obj in ipairs(grupo:GetChildren()) do
		local grande = obj:IsA("BasePart")
			and (obj.Size.X > 3 or obj.Size.Y > 3 or obj.Size.Z > 3)
		if grande and obj.Name ~= "Parcela" and obj.Name ~= "PuntoVenta" then
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

		-- Un seto alto con su arco de madera. Los muros de hielo quedaban
		-- de maqueta; un seto es lo que separa dos parcelas de verdad.
		local muro = parte({
			Name = "Puerta_" .. zona.clave,
			Size = Vector3.new(5, A.mundo.alturaValla, largo),
			Position = Vector3.new(px, A.mundo.alturaValla / 2, (mundo.minZ + mundo.maxZ) / 2),
			Color = Color3.fromRGB(52, 100, 56),
			Material = Enum.Material.LeafyGrass,
			CanCollide = true,
			CanQuery = true,
		}, carpeta)

		-- Lo decorativo cuelga del propio seto: cuando la zona se abre, el
		-- cliente lo esconde todo de una vez.
		parte({
			Name = "NieveEncima",
			Size = Vector3.new(6, 1.2, largo),
			Position = Vector3.new(px, A.mundo.alturaValla + 0.6, (mundo.minZ + mundo.maxZ) / 2),
			Color = NIEVE,
			Material = Enum.Material.Snow,
		}, muro)
		for _, dz in ipairs({ -7, 7 }) do
			parte({
				Name = "PosteArco",
				Size = Vector3.new(2, A.mundo.alturaValla + 5, 2),
				Position = Vector3.new(px, (A.mundo.alturaValla + 5) / 2, dz),
				Color = MADERA,
				Material = Enum.Material.WoodPlanks,
			}, muro)
		end
		parte({
			Name = "VigaArco",
			Size = Vector3.new(3, 2, 18),
			Position = Vector3.new(px, A.mundo.alturaValla + 4, 0),
			Color = MADERA,
			Material = Enum.Material.WoodPlanks,
		}, muro)
		parte({
			Name = "VigaNieve",
			Size = Vector3.new(3.4, 0.8, 18.4),
			Position = Vector3.new(px, A.mundo.alturaValla + 5.4, 0),
			Color = NIEVE,
			Material = Enum.Material.Snow,
		}, muro)
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
	local alto = A.mundo.alturaValla
	local ancho = mundo.maxX - mundo.minX
	local largo = mundo.maxZ - mundo.minZ
	local centroX = (mundo.minX + mundo.maxX) / 2
	local centroZ = (mundo.minZ + mundo.maxZ) / 2

	local lados = {
		{ Vector3.new(ancho, alto, 6), Vector3.new(centroX, alto / 2, mundo.minZ) },
		{ Vector3.new(ancho, alto, 6), Vector3.new(centroX, alto / 2, mundo.maxZ) },
		{ Vector3.new(6, alto, largo), Vector3.new(mundo.minX, alto / 2, centroZ) },
		{ Vector3.new(6, alto, largo), Vector3.new(mundo.maxX, alto / 2, centroZ) },
	}
	for i, lado in ipairs(lados) do
		parte({
			Name = "Seto" .. i,
			Size = lado[1],
			Position = lado[2],
			Color = Color3.fromRGB(48, 94, 52),
			Material = Enum.Material.LeafyGrass,
			CanCollide = true,
			CanQuery = true,
		}, mundo.carpeta)
		parte({
			Name = "SetoNieve" .. i,
			Size = lado[1] + Vector3.new(0.6, 0, 0.6),
			Position = lado[2] + Vector3.new(0, alto / 2 + 0.5, 0),
			Color = NIEVE,
			Material = Enum.Material.Snow,
		}, mundo.carpeta)
	end

	-- Pinos por detras, para que el fondo no sea una pared verde.
	local paso = 46
	local cuantos = math.floor(ancho / paso)
	for i = 0, cuantos do
		local px = mundo.minX + 10 + i * paso
		pino(mundo.carpeta, px, mundo.minZ - 14, 1.1 + (i % 3) * 0.3)
	end
end

-- La calle por delante de todas las parcelas: es lo que ata el sitio y lo
-- que hace que parezca un barrio y no cinco rectangulos en el aire.
local function construirCalle()
	local ancho = mundo.maxX - mundo.minX
	local centroX = (mundo.minX + mundo.maxX) / 2
	local zAcera = mundo.maxZ - 46
	local zCalle = mundo.maxZ - 24

	parte({
		Name = "Acera",
		Size = Vector3.new(ancho, 0.6, 14),
		Position = Vector3.new(centroX, 0.3, zAcera),
		Color = Color3.fromRGB(206, 206, 210),
		Material = Enum.Material.Concrete,
	}, mundo.carpeta)
	parte({
		Name = "Bordillo",
		Size = Vector3.new(ancho, 1, 1.6),
		Position = Vector3.new(centroX, 0.5, zAcera + 7.8),
		Color = Color3.fromRGB(228, 228, 232),
		Material = Enum.Material.Concrete,
	}, mundo.carpeta)
	parte({
		Name = "Calzada",
		Size = Vector3.new(ancho, 0.5, 26),
		Position = Vector3.new(centroX, 0.25, zCalle),
		Color = Color3.fromRGB(58, 58, 64),
		Material = Enum.Material.Asphalt,
	}, mundo.carpeta)

	local paso = 26
	local rayas = math.floor(ancho / paso)
	for i = 0, rayas do
		parte({
			Name = "Raya",
			Size = Vector3.new(11, 0.2, 1.2),
			Position = Vector3.new(mundo.minX + 8 + i * paso, 0.55, zCalle),
			Color = Color3.fromRGB(238, 232, 190),
		}, mundo.carpeta)
	end

	local separacion = 150
	local cuantas = math.floor(ancho / separacion)
	for i = 0, cuantas do
		farola(mundo.carpeta, mundo.minX + 40 + i * separacion, zAcera - 5)
	end
end

local function ambientar()
	Luz.ClockTime = 15.5
	Luz.Brightness = 2.2
	Luz.Ambient = Color3.fromRGB(126, 136, 156)
	Luz.OutdoorAmbient = Color3.fromRGB(158, 172, 196)
	Luz.FogColor = Color3.fromRGB(214, 226, 240)
	Luz.FogEnd = 1800
	Luz.FogStart = 420
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
			Material = Enum.Material[zona.def.material or "Concrete"],
		}, grupo)

		-- El decorado primero: es quien dice donde NO va nieve.
		decorarZona(zona, grupo)
		construirNieve(zona, grupo)
		grupo:SetAttribute("casillas", zona.total)
		construirCamion(zona, grupo)
		sombrasEnDecorado(grupo)
	end

	construirPuertas()
	construirValla()
	construirCalle()
	ambientar()

	local primera = mundo.zonas[1]
	local sitio = Instance.new("SpawnLocation")
	sitio.Name = "Salida"
	sitio.Size = Vector3.new(14, 1, 14)
	sitio.Position = Vector3.new(primera.centroX, 0.5, primera.z1 + 42)
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

-- Se define mas abajo, pero comprarMejora ya la necesita.
local equipar

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
		ventas = 0,
		racha = 0,
		ultimoDia = 0,
		ultimoPremio = 0,
		pases = {},
		zonaVista = A.zonas[1].clave,
		cargado = false,
		puedeGuardar = false,
		recogiendo = false,
		emisor = nil,
		montones = nil,
		escalonMonton = -1,
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
		ventas = estado.ventas,
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
	estado.ventas = math.max(0, math.floor(tonumber(datos.ventas) or 0))
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

-- Si el mismo jugador esta en dos servidores a la vez (dos aparatos, o
-- ha vuelto a entrar antes de que el primero guardase), el ultimo en
-- guardar se lo cargaria todo. Con esto, lo acumulado no se pierde nunca:
-- de cada cosa que solo puede subir, se queda lo mas alto de las dos.
--
-- El dinero y los niveles NO se fusionan: para eso manda la sesion que
-- esta guardando, que es la que ha jugado. Fusionarlos daria monedas
-- gratis a quien abriese el juego en dos sitios.
local function fusionar(anterior, nuevo)
	if type(anterior) ~= "table" then
		return nuevo
	end

	local function loMasAlto(campo)
		nuevo[campo] = math.max(nuevo[campo] or 0, tonumber(anterior[campo]) or 0)
	end
	loMasAlto("nieveTotal")
	loMasAlto("renaceres")
	loMasAlto("ventas")
	loMasAlto("racha")
	loMasAlto("ultimoDia")
	loMasAlto("ultimoPremio")

	-- Un codigo canjeado no se descanjea nunca.
	local vistos = {}
	for _, clave in ipairs(nuevo.codigos) do
		vistos[clave] = true
	end
	if type(anterior.codigos) == "table" then
		for _, clave in ipairs(anterior.codigos) do
			if not vistos[clave] then
				nuevo.codigos[#nuevo.codigos + 1] = clave
			end
		end
	end

	-- Las zonas tampoco se cierran solas... salvo al renacer, que es
	-- justo lo que hace renacer. Si ha renacido, mandan las suyas.
	local mismosRenaceres = (tonumber(anterior.renaceres) or 0) == nuevo.renaceres
	if mismosRenaceres and type(anterior.zonas) == "table" then
		local abiertas = {}
		for _, clave in ipairs(nuevo.zonas) do
			abiertas[clave] = true
		end
		for _, clave in ipairs(anterior.zonas) do
			if not abiertas[clave] then
				nuevo.zonas[#nuevo.zonas + 1] = clave
			end
		end
	end

	return nuevo
end

local function guardar(jugador)
	local estado = estados[jugador]
	if not estado or not estado.cargado or not estado.puedeGuardar or not almacen then
		return
	end
	local datos = serializar(estado)
	reintentar(function()
		-- UpdateAsync y no SetAsync: aqui se ve lo que hay guardado antes
		-- de escribir, que es lo unico que evita machacar a otro servidor.
		almacen:UpdateAsync(claveDe(jugador), function(anterior)
			return fusionar(anterior, datos)
		end)
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
	else
		-- La pala y la carretilla se ven: hay que rehacerlas mas grandes.
		equipar(jugador)
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
		Size = Vector3.new(1.4, 13, 1.4),
		Position = Vector3.new(primera.x0 - 16, 6.5, primera.z1 + 40),
		Color = Color3.fromRGB(56, 66, 86),
		CanCollide = true,
		CanQuery = true,
	}, mundo.carpeta)

	local gui = Instance.new("BillboardGui")
	gui.Name = "Records"
	gui.Adornee = poste
	gui.Size = UDim2.new(12, 0, 9, 0)
	gui.StudsOffsetWorldSpace = Vector3.new(0, 10.5, 0)
	gui.MaxDistance = 200
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

-- Cuantos escalones tiene el monton de la carretilla. Se encienden y se
-- apagan; nada de cambiar tamanos, que con una soldadura no se puede.
local ESCALONES_MONTON = 6

local function montarPala(pers, brazo, escala)
	local grupo = Instance.new("Model")
	grupo.Name = "Pala"

	local largo = 3.4 * escala
	local mango = Instance.new("Part")
	mango.Name = "Mango"
	mango.Size = Vector3.new(0.32 * escala, largo, 0.32 * escala)
	mango.Color = Color3.fromRGB(132, 92, 56)
	mango.Material = Enum.Material.Wood
	mango.CanCollide = false
	mango.CanQuery = false
	mango.CanTouch = false
	mango.Massless = true
	mango.CFrame = brazo.CFrame * CFrame.new(0, -0.5, -0.4) * CFrame.Angles(math.rad(28), 0, 0)
	mango.Parent = grupo

	local hoja = Instance.new("Part")
	hoja.Name = "Hoja"
	hoja.Size = Vector3.new(2.1 * escala, 0.22 * escala, 1.9 * escala)
	hoja.Color = Color3.fromRGB(206, 220, 238)
	hoja.Material = Enum.Material.Metal
	hoja.Reflectance = 0.15
	hoja.CanCollide = false
	hoja.CanQuery = false
	hoja.CanTouch = false
	hoja.Massless = true
	hoja.CFrame = mango.CFrame * CFrame.new(0, -largo / 2 - 0.2 * escala, -0.5 * escala)
	hoja.Parent = grupo

	local borde = Instance.new("Part")
	borde.Name = "Borde"
	borde.Size = Vector3.new(2.1 * escala, 0.5 * escala, 0.25 * escala)
	borde.Color = Color3.fromRGB(168, 186, 210)
	borde.Material = Enum.Material.Metal
	borde.CanCollide = false
	borde.CanQuery = false
	borde.CanTouch = false
	borde.Massless = true
	borde.CFrame = hoja.CFrame * CFrame.new(0, 0.3 * escala, 0.9 * escala)
	borde.Parent = grupo

	for _, pieza2 in ipairs({ hoja, borde }) do
		local union = Instance.new("WeldConstraint")
		union.Part0 = mango
		union.Part1 = pieza2
		union.Parent = pieza2
	end

	local alBrazo = Instance.new("WeldConstraint")
	alBrazo.Part0 = brazo
	alBrazo.Part1 = mango
	alBrazo.Parent = mango

	grupo.Parent = pers
	return hoja
end

local function montarCarretilla(pers, raiz, escala)
	local grupo = Instance.new("Model")
	grupo.Name = "Carretilla"

	local ancho = 2.9 * escala
	local alto = 1.7 * escala
	local fondo = 3.6 * escala
	-- Por delante y casi a ras de suelo. Antes iba tan grande y tan pegada
	-- que el muneco parecia ir metido dentro de un cajon.
	local base = raiz.CFrame * CFrame.new(0, -2.35, -3.3)

	local function trozo(nombre, tam, cf, color, material)
		local pieza2 = Instance.new("Part")
		pieza2.Name = nombre
		pieza2.Size = tam
		pieza2.CFrame = cf
		pieza2.Color = color
		pieza2.Material = material or Enum.Material.SmoothPlastic
		pieza2.CanCollide = false
		pieza2.CanQuery = false
		pieza2.CanTouch = false
		pieza2.Massless = true
		pieza2.Parent = grupo
		return pieza2
	end

	local naranja = Color3.fromRGB(216, 118, 48)
	local hierro = Color3.fromRGB(78, 84, 96)

	local suelo = trozo("Cubeta", Vector3.new(ancho, 0.35 * escala, fondo), base, naranja, Enum.Material.Metal)
	trozo("ParedIzq", Vector3.new(0.3 * escala, alto, fondo), base * CFrame.new(-ancho / 2, alto / 2, 0), naranja, Enum.Material.Metal)
	trozo("ParedDcha", Vector3.new(0.3 * escala, alto, fondo), base * CFrame.new(ancho / 2, alto / 2, 0), naranja, Enum.Material.Metal)
	trozo("ParedFrente", Vector3.new(ancho, alto, 0.3 * escala), base * CFrame.new(0, alto / 2, -fondo / 2), naranja, Enum.Material.Metal)
	trozo("ParedAtras", Vector3.new(ancho, alto * 0.7, 0.3 * escala), base * CFrame.new(0, alto * 0.35, fondo / 2), naranja, Enum.Material.Metal)

	trozo("Rueda", Vector3.new(0.5 * escala, 2.2 * escala, 2.2 * escala),
		base * CFrame.new(0, -1 * escala, -fondo / 2 - 0.6), Color3.fromRGB(30, 30, 34), Enum.Material.Metal)
	for _, dx in ipairs({ -1, 1 }) do
		trozo("Pata", Vector3.new(0.35 * escala, 1.6 * escala, 0.35 * escala),
			base * CFrame.new(dx * ancho * 0.35, -0.9 * escala, fondo / 2 - 0.5), hierro, Enum.Material.Metal)
		trozo("Varal", Vector3.new(0.35 * escala, 0.35 * escala, 3 * escala),
			base * CFrame.new(dx * ancho * 0.4, 0.5 * escala, fondo / 2 + 1.2), hierro, Enum.Material.Metal)
	end

	-- El monton: escalones apagados que se van encendiendo al llenarse.
	local montones = {}
	for i = 1, ESCALONES_MONTON do
		local altura = (alto * 1.25 / ESCALONES_MONTON)
		local encogido = 1 - (i - 1) * 0.09
		local capa = trozo(
			"Monton" .. i,
			Vector3.new((ancho - 0.7 * escala) * encogido, altura, (fondo - 0.7 * escala) * encogido),
			base * CFrame.new(0, 0.2 * escala + (i - 0.5) * altura, 0),
			Color3.fromRGB(246, 250, 255),
			Enum.Material.Snow
		)
		capa.Transparency = 1
		montones[i] = capa
	end

	for _, pieza2 in ipairs(grupo:GetChildren()) do
		if pieza2 ~= suelo and pieza2:IsA("BasePart") then
			local union = Instance.new("WeldConstraint")
			union.Part0 = suelo
			union.Part1 = pieza2
			union.Parent = pieza2
		end
	end
	local alCuerpo = Instance.new("WeldConstraint")
	alCuerpo.Part0 = raiz
	alCuerpo.Part1 = suelo
	alCuerpo.Parent = suelo

	grupo.Parent = pers
	return montones
end

local function prepararPolvo(hoja, estado)
	if not hoja then
		return
	end
	local punto = Instance.new("Attachment")
	punto.Name = "PolvoNieve"
	punto.Position = Vector3.new(0, -0.3, 0)
	punto.Parent = hoja

	local emisor = Instance.new("ParticleEmitter")
	emisor.Texture = "rbxasset://textures/particles/smoke_main.dds"
	emisor.Color = ColorSequence.new(Color3.fromRGB(255, 255, 255))
	emisor.Size = NumberSequence.new(1.8)
	emisor.Transparency = NumberSequence.new({
		NumberSequenceKeypoint.new(0, 0.1),
		NumberSequenceKeypoint.new(1, 1),
	})
	emisor.Lifetime = NumberRange.new(0.3, 0.7)
	emisor.Rate = 55
	emisor.Speed = NumberRange.new(4, 9)
	emisor.SpreadAngle = Vector2.new(45, 45)
	emisor.Acceleration = Vector3.new(0, -16, 0)
	emisor.LightEmission = 0.4
	emisor.Enabled = false
	emisor.Parent = punto

	estado.emisor = emisor
end

-- Monta (o vuelve a montar) pala y carretilla al tamano que toque.
equipar = function(jugador)
	local estado = estados[jugador]
	local pers = jugador.Character
	if not estado or not pers then
		return
	end

	for _, nombre in ipairs({ "Pala", "Carretilla" }) do
		local viejo = pers:FindFirstChild(nombre)
		if viejo then
			viejo:Destroy()
		end
	end
	estado.montones = nil
	estado.escalonMonton = -1
	estado.emisor = nil

	-- El personaje llega por piezas: hay que esperar al brazo.
	local brazo = pers:FindFirstChild("RightHand") or pers:FindFirstChild("Right Arm")
	if not brazo then
		local humano = pers:FindFirstChildOfClass("Humanoid")
		local esR15 = humano ~= nil and humano.RigType == Enum.HumanoidRigType.R15
		brazo = pers:WaitForChild(esR15 and "RightHand" or "Right Arm", 8)
	end
	local raiz = pers:FindFirstChild("HumanoidRootPart")
	if not brazo or not raiz then
		warn("[nieve] sin brazo: este jugador se queda sin equipo")
		return
	end

	local hoja = montarPala(pers, brazo, 1 + (estado.niveles.pala - 1) * 0.09)
	-- Crece, pero con tope: a 15 niveles sin freno acabaria siendo un
	-- contenedor mas grande que el jugador.
	local tamCarretilla = math.min(1.5, 1 + (estado.niveles.carretilla - 1) * 0.045)
	estado.montones = montarCarretilla(pers, raiz, tamCarretilla)
	prepararPolvo(hoja, estado)
end

-- Enciende tantos escalones del monton como carga lleve encima.
local function pintarMonton(estado)
	local montones = estado.montones
	if not montones then
		return
	end
	local capacidad = capacidadDe(estado)
	if capacidad < 1 then
		capacidad = 1
	end
	local lleno = math.clamp(estado.carga / capacidad, 0, 1)
	local escalon = math.floor(lleno * ESCALONES_MONTON + 0.0001)
	if escalon == estado.escalonMonton then
		return
	end
	estado.escalonMonton = escalon
	for i, capa in ipairs(montones) do
		capa.Transparency = (i <= escalon) and 0 or 1
	end
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
						pintarCasilla(casilla, false)
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
			estado.ventas = estado.ventas + 1
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
	-- El tutorial del cliente se saca de aqui: no hace falta guardar por
	-- donde va, se deduce de lo que el jugador ya ha hecho.
	local mejorada = false
	for _, def in ipairs(A.mejoras) do
		if (estado.niveles[def.clave] or 1) > 1 then
			mejorada = true
		end
	end

	return {
		dinero = math.floor(estado.dinero),
		nieveTotal = math.floor(estado.nieveTotal),
		ventas = estado.ventas,
		mejorada = mejorada,
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
	equipar(jugador)
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
				pintarMonton(estado)
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
				pintarCasilla(casilla, true)
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
