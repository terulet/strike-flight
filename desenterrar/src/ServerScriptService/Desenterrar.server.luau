--[[
	DESENTIERRA  —  servidor

	Primera vertical: una parcela, una casa enterrada, y la pala.

	Lo importante del diseno esta en dos sitios:

	  Parcela   todo el estado de la nieve vive aqui dentro, con su id.
	            Hoy hay una; manana una por jugador, y el excavador no se
	            entera porque siempre recibe SOBRE QUE parcela actua.

	  puedeExcavar()  la regla que hace imposible quedarse encerrado: al
	            bajar una casilla no se puede abrir con sus ocho vecinas un
	            escalon mayor que desnivelMaximo. Para bajar hay que
	            ensanchar, la pendiente se forma sola y no hay pozos.

	  Y cavar es una ACCION: hay que mantener pulsado. Quieto no pasa nada.
]]

local Jugadores = game:GetService("Players")
local RS = game:GetService("ReplicatedStorage")
local Luz = game:GetService("Lighting")
local Tweens = game:GetService("TweenService")

local A = require(RS:WaitForChild("AjustesV2"))
local Parcela = require(RS:WaitForChild("ParcelaV2"))

local Terreno = workspace.Terrain
local CELDA = A.nieve.celda



-------------------------------------------------------------------
--  PIEZAS
-------------------------------------------------------------------

local NIEVE = Color3.fromRGB(246, 250, 255)

local function parte(props, padre)
	local p = Instance.new("Part")
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


-------------------------------------------------------------------
--  REMOTOS
-------------------------------------------------------------------

local remotos = Instance.new("Folder")
remotos.Name = "DesenterrarRemotos"
remotos.Parent = RS

local RemotoEstado = Instance.new("RemoteEvent")
RemotoEstado.Name = "Estado"
RemotoEstado.Parent = remotos

local RemotoAviso = Instance.new("RemoteEvent")
RemotoAviso.Name = "Aviso"
RemotoAviso.Parent = remotos

-- El cliente dice cuando esta pulsando. Sin esto no se cava: quieto no
-- pasa nada, que era justo la queja.
local RemotoCavar = Instance.new("RemoteEvent")
RemotoCavar.Name = "Cavar"
RemotoCavar.Parent = remotos


-------------------------------------------------------------------
--  EL MUNDO
-------------------------------------------------------------------

local parcelas = {}
local mundo = { carpeta = nil, salida = CFrame.new(0, 5, 0) }

-- Se define mas abajo; construirParcela la necesita para dejar el HUD con
-- el numero correcto desde el primer momento.
local revisarHallazgos

local function parcelaEn(x, z)
	for _, p in ipairs(parcelas) do
		if p:contiene(x, z) then
			return p
		end
	end
	return nil
end

-- La casa, en casillas y en studs. Todo lo demas se coloca a partir de
-- aqui, para que mover la casa no descuadre nada.
local function medidasCasa(parcela)
	local cxCentro = math.floor(parcela.ancho / 2)
	local czCentro = math.floor(parcela.largo * 0.32)
	local mediaAncho = math.ceil(A.casa.ancho / CELDA / 2)
	local mediaFondo = math.ceil(A.casa.fondo / CELDA / 2)
	local m = {
		cx0 = cxCentro - mediaAncho,
		cx1 = cxCentro + mediaAncho,
		cz0 = czCentro - mediaFondo,
		cz1 = czCentro + mediaFondo,
		cxCentro = cxCentro,
		czCentro = czCentro,
	}
	m.x, m.z = parcela:centro(m.cxCentro, m.czCentro)
	m.frenteZ = select(2, parcela:centro(m.cxCentro, m.cz1)) + CELDA / 2
	return m
end

local function construirCasa(parcela, padre)
	local m = medidasCasa(parcela)
	local grupo = Instance.new("Folder")
	grupo.Name = "Casa"
	grupo.Parent = padre

	local CREMA = Color3.fromRGB(238, 224, 198)
	local LADRILLO = Color3.fromRGB(152, 88, 70)
	local PIZARRA = Color3.fromRGB(64, 70, 84)
	local MADERA = Color3.fromRGB(122, 82, 50)
	local CALIDA = Color3.fromRGB(255, 214, 138)

	local function pieza(nombre, tam, pos, color, material, solido)
		return parte({
			Name = nombre,
			Size = tam,
			Position = pos,
			Color = color,
			Material = material or Enum.Material.SmoothPlastic,
			CanCollide = solido ~= false,
			CanQuery = solido ~= false,
		}, grupo)
	end

	local zFachada = m.z + A.casa.fondo / 2

	-- Cuerpo y zocalo.
	pieza("Cuerpo", Vector3.new(A.casa.ancho, A.casa.alto, A.casa.fondo),
		Vector3.new(m.x, A.casa.alto / 2, m.z), CREMA, Enum.Material.Concrete)
	pieza("Zocalo", Vector3.new(A.casa.ancho + 1.4, 3.2, A.casa.fondo + 1.4),
		Vector3.new(m.x, 1.6, m.z), LADRILLO, Enum.Material.Brick)
	-- Esquinas de piedra: dan silueta.
	for _, dx in ipairs({ -1, 1 }) do
		pieza("Esquina", Vector3.new(2.2, A.casa.alto, 2.2),
			Vector3.new(m.x + dx * (A.casa.ancho / 2 - 1), A.casa.alto / 2, m.z + A.casa.fondo / 2 - 1),
			Color3.fromRGB(216, 206, 190), Enum.Material.Concrete)
	end

	-- Cubierta inclinada, a escalones. Cada uno con su nieve encima: a
	-- distancia lee como un tejado a dos aguas y no puede salir torcido,
	-- que es lo que pasa con las cunas si aciertas mal el giro.
	local alturaTejado = A.casa.alto
	for i = 0, A.casa.pasosTejado - 1 do
		local encogido = i * (A.casa.ancho * 0.42 / A.casa.pasosTejado)
		local y = A.casa.alto + 0.6 + i * A.casa.altoPaso
		local anchoPaso = A.casa.ancho + 5 - encogido * 2
		pieza("Tejado" .. i, Vector3.new(anchoPaso, A.casa.altoPaso, A.casa.fondo + 5),
			Vector3.new(m.x, y, m.z), PIZARRA, Enum.Material.Slate)
		pieza("TejadoNieve" .. i, Vector3.new(anchoPaso + 0.4, 0.55, A.casa.fondo + 5.4),
			Vector3.new(m.x, y + A.casa.altoPaso * 0.6, m.z), NIEVE, Enum.Material.Snow, false)
		alturaTejado = y + A.casa.altoPaso
	end
	-- Caballete.
	pieza("Caballete", Vector3.new(4, 1.4, A.casa.fondo + 6),
		Vector3.new(m.x, alturaTejado + 0.4, m.z), PIZARRA, Enum.Material.Slate)
	alturaTejado = alturaTejado + 1.1

	-- Chimenea, lo unico que asoma cuando esta todo enterrado.
	local chx = m.x + A.casa.ancho / 2 - 6
	local chz = m.z - A.casa.fondo / 4
	pieza("Chimenea", Vector3.new(5, A.casa.alturaChimenea, 5),
		Vector3.new(chx, A.casa.alturaChimenea / 2, chz), LADRILLO, Enum.Material.Brick)
	pieza("ChimeneaBoca", Vector3.new(6, 1.2, 6),
		Vector3.new(chx, A.casa.alturaChimenea + 0.6, chz), PIZARRA, Enum.Material.Slate)
	pieza("ChimeneaNieve", Vector3.new(6.2, 0.6, 6.2),
		Vector3.new(chx, A.casa.alturaChimenea + 1.4, chz), NIEVE, Enum.Material.Snow, false)

	-- El porche: suelo, cuatro postes, baranda y su tejadillo.
	local zPorche = zFachada + A.casa.porcheFondo / 2
	pieza("PorcheSuelo", Vector3.new(A.casa.ancho * 0.62, 1, A.casa.porcheFondo),
		Vector3.new(m.x, 1.5, zPorche), MADERA, Enum.Material.WoodPlanks)
	for _, dx in ipairs({ -1, 1 }) do
		for _, dz in ipairs({ -1, 1 }) do
			pieza("Poste", Vector3.new(1.2, 12, 1.2),
				Vector3.new(m.x + dx * (A.casa.ancho * 0.29), 8, zPorche + dz * (A.casa.porcheFondo / 2 - 1)),
				Color3.fromRGB(248, 246, 240), Enum.Material.WoodPlanks)
		end
		pieza("Baranda", Vector3.new(1, 1, A.casa.porcheFondo - 2),
			Vector3.new(m.x + dx * (A.casa.ancho * 0.29), 4.4, zPorche),
			Color3.fromRGB(248, 246, 240), Enum.Material.WoodPlanks)
	end
	local alturaPorche = 14.2
	pieza("PorcheTejado", Vector3.new(A.casa.ancho * 0.68, 1.2, A.casa.porcheFondo + 2),
		Vector3.new(m.x, alturaPorche, zPorche), PIZARRA, Enum.Material.Slate)
	pieza("PorcheNieve", Vector3.new(A.casa.ancho * 0.68 + 0.4, 0.6, A.casa.porcheFondo + 2.4),
		Vector3.new(m.x, alturaPorche + 0.9, zPorche), NIEVE, Enum.Material.Snow, false)
	for i = 0, 2 do
		pieza("Escalon", Vector3.new(A.casa.ancho * 0.4, 0.6, 2),
			Vector3.new(m.x, 0.4 + i * 0.5, zPorche + A.casa.porcheFondo / 2 + 2 - i * 2),
			Color3.fromRGB(228, 224, 216), Enum.Material.Concrete)
	end

	-- El garaje, pegado a un lado.
	local gx = m.x - A.casa.ancho / 2 - A.casa.garajeAncho / 2
	pieza("Garaje", Vector3.new(A.casa.garajeAncho, A.casa.alto - 2, A.casa.fondo - 4),
		Vector3.new(gx, (A.casa.alto - 2) / 2, m.z), CREMA, Enum.Material.Concrete)
	pieza("GarajeTejado", Vector3.new(A.casa.garajeAncho + 3, 1.2, A.casa.fondo - 1),
		Vector3.new(gx, A.casa.alto - 1.4, m.z), PIZARRA, Enum.Material.Slate)
	pieza("GarajeNieve", Vector3.new(A.casa.garajeAncho + 3.4, 0.6, A.casa.fondo - 0.6),
		Vector3.new(gx, A.casa.alto - 0.5, m.z), NIEVE, Enum.Material.Snow, false)
	pieza("GarajePuerta", Vector3.new(A.casa.garajeAncho - 3, 8, 0.7),
		Vector3.new(gx, 4.2, m.z + (A.casa.fondo - 4) / 2 + 0.3),
		Color3.fromRGB(206, 208, 212), Enum.Material.Metal)
	for i = 1, 4 do
		pieza("GarajeRanura", Vector3.new(A.casa.garajeAncho - 3, 0.25, 0.9),
			Vector3.new(gx, 1 + i * 1.6, m.z + (A.casa.fondo - 4) / 2 + 0.5),
			Color3.fromRGB(168, 172, 178), Enum.Material.Metal, false)
	end

	-- La puerta, con su marco, su corona y su farol encendido.
	pieza("MarcoPuerta", Vector3.new(A.casa.puertaAncho + 2, A.casa.puertaAlto + 1.6, 0.5),
		Vector3.new(m.x, (A.casa.puertaAlto + 1.6) / 2, zFachada + 0.1),
		Color3.fromRGB(250, 248, 244))
	local puerta = pieza("Puerta", Vector3.new(A.casa.puertaAncho, A.casa.puertaAlto, 0.8),
		Vector3.new(m.x, A.casa.puertaAlto / 2, zFachada + 0.4), MADERA, Enum.Material.WoodPlanks)
	pieza("Pomo", Vector3.new(0.8, 0.8, 0.8),
		Vector3.new(m.x + 2, A.casa.puertaAlto / 2, zFachada + 0.9),
		Color3.fromRGB(236, 196, 96), Enum.Material.Metal, false)
	pieza("Corona", Vector3.new(3, 3, 0.5),
		Vector3.new(m.x, A.casa.puertaAlto - 1.6, zFachada + 0.9),
		Color3.fromRGB(52, 112, 60), Enum.Material.Grass, false)
	local farol = pieza("Farol", Vector3.new(1.4, 2, 1.4),
		Vector3.new(m.x + A.casa.puertaAncho / 2 + 2, A.casa.puertaAlto, zFachada + 0.9),
		CALIDA, Enum.Material.Neon, false)
	local luzFarol = Instance.new("PointLight")
	luzFarol.Color = CALIDA
	luzFarol.Brightness = 2
	luzFarol.Range = 18
	luzFarol.Parent = farol

	-- Ventanas encendidas: la casa se ve viva segun aparece.
	local alturaVentana = 0
	local yVentana = 6.4
	local medioAlto = 3.1
	for _, dx in ipairs({ -13, 13 }) do
		pieza("Marco", Vector3.new(6.2, 6.2, 0.4), Vector3.new(m.x + dx, yVentana, zFachada + 0.1),
			Color3.fromRGB(250, 248, 244), nil, false)
		local cristal = pieza("Cristal", Vector3.new(5.2, 5.2, 0.5),
			Vector3.new(m.x + dx, yVentana, zFachada + 0.3), CALIDA, Enum.Material.Neon, false)
		local luz = Instance.new("PointLight")
		luz.Color = CALIDA
		luz.Brightness = 1.6
		luz.Range = 22
		luz.Parent = cristal
		pieza("Cruz", Vector3.new(0.35, 5.2, 0.7), Vector3.new(m.x + dx, yVentana, zFachada + 0.4),
			Color3.fromRGB(250, 248, 244), nil, false)
		for _, lado in ipairs({ -1, 1 }) do
			pieza("Contraventana", Vector3.new(1.6, 6.4, 0.4),
				Vector3.new(m.x + dx + lado * 4, yVentana, zFachada + 0.15),
				Color3.fromRGB(76, 104, 132), Enum.Material.WoodPlanks, false)
		end
		alturaVentana = yVentana + medioAlto
	end

	-- Las alturas de verdad, para que los hallazgos salten cuando toca.
	m.alturaTejado = alturaTejado
	m.alturaPorche = alturaPorche + 1.5
	m.alturaVentana = alturaVentana
	m.alturaPuerta = A.casa.puertaAlto
	m.puerta = puerta
	m.zFachada = zFachada
	return m
end

local function construirParcela(parcela)
	local grupo = Instance.new("Folder")
	grupo.Name = "Parcela_" .. parcela.id
	grupo.Parent = mundo.carpeta
	parcela.carpeta = grupo

	local anchoS = parcela.ancho * CELDA
	local largoS = parcela.largo * CELDA

	parte({
		Name = "Suelo",
		Size = Vector3.new(anchoS + 80, 2, largoS + 80),
		Position = Vector3.new(parcela.origen.X + anchoS / 2, -1, parcela.origen.Z + largoS / 2 + 20),
		Color = Color3.fromRGB(96, 150, 76),
		Material = Enum.Material.Grass,
		CanCollide = true,
		CanQuery = true,
	}, grupo)

	local m = construirCasa(parcela, grupo)
	parcela.casa = m

	-- La nevada es un manto ALTO Y PLANO que baja a cero en el borde de la
	-- parcela. Ese borde es la rampa por la que se sube al campo.
	--
	-- OJO, que esta es la leccion mas cara del diseno: con la regla de la
	-- pendiente solo se puede cavar en lo mas alto. Si el jugador naciera
	-- en el fondo de un hoyo, TODO a su alrededor estaria bloqueado y no
	-- podria cavar nada. Naciendo arriba, en el llano, todo vale.
	parcela:generar(function(cx, cz)
		if cx >= m.cx0 and cx <= m.cx1 and cz >= m.cz0 and cz <= m.cz1 then
			return 0, true -- debajo de la casa no hay nieve
		end
		local alBorde = math.min(cx, cz, parcela.ancho - 1 - cx, parcela.largo - 1 - cz)
		if alBorde <= 1 then
			return 0
		end
		local pegadoALaCasa = cx >= m.cx0 - 2 and cx <= m.cx1 + 2 and cz >= m.cz0 - 2 and cz <= m.cz1 + 2
		return pegadoALaCasa and A.nieve.capasContraLaCasa or A.nieve.capasMaximas
	end)

	-- Se aparece FUERA de la parcela, en suelo firme, mirando al manto.
	local sx = parcela.origen.X + anchoS / 2
	local sz = parcela.origen.Z + largoS + 16

	-- El monton donde se descarga, al lado de donde apareces.
	parcela.descarga = Vector3.new(sx + 18, 0, sz)
	parcela.monton = parte({
		Name = "Monton",
		Shape = Enum.PartType.Ball,
		Size = Vector3.new(10, 6, 10),
		Position = Vector3.new(parcela.descarga.X, 1, parcela.descarga.Z),
		Color = NIEVE,
		Material = Enum.Material.Snow,
		CanCollide = true,
		CanQuery = true,
	}, grupo)
	parte({
		Name = "PuntoDescarga",
		Size = Vector3.new(20, 0.3, 20),
		Position = Vector3.new(parcela.descarga.X, 0.2, parcela.descarga.Z),
		Color = Color3.fromRGB(120, 205, 255),
		Material = Enum.Material.Neon,
		Transparency = 0.55,
	}, grupo)

	parcela:nevar()
	-- Deja el contador de la puerta bien puesto ANTES del primer paquete:
	-- si no, el HUD empieza diciendo un numero y al segundo salta a otro.
	parcela.hallazgos = {}
	revisarHallazgos(parcela)

	grupo:SetAttribute("casillas", parcela.ancho * parcela.largo)
	grupo:SetAttribute("capas", parcela.capasTotales)
	return sx, sz
end

local function construirMundo()
	pcall(function()
		Terreno:Clear()
	end)
	for _, obj in ipairs(workspace:GetChildren()) do
		if obj.Name == "Baseplate" or obj.Name == "Desenterrar" or obj:IsA("SpawnLocation") then
			obj:Destroy()
		end
	end

	local carpeta = Instance.new("Folder")
	carpeta.Name = "Desenterrar"
	carpeta.Parent = workspace
	mundo.carpeta = carpeta

	local parcela = Parcela.nueva(1, Vector3.new(0, 0, 0))
	parcelas[1] = parcela
	local sx, sz = construirParcela(parcela)

	local sitio = Instance.new("SpawnLocation")
	sitio.Name = "Salida"
	sitio.Size = Vector3.new(12, 1, 12)
	sitio.Position = Vector3.new(sx, 0.5, sz)
	sitio.Anchored = true
	sitio.CanCollide = true
	sitio.Transparency = 0.5
	sitio.Color = Color3.fromRGB(120, 205, 255)
	sitio.Material = Enum.Material.Neon
	sitio.Duration = 0
	sitio.Neutral = true
	sitio.Parent = carpeta
	mundo.salida = CFrame.new(sitio.Position + Vector3.new(0, 4, 0))

	Luz.ClockTime = 15
	Luz.Brightness = 2.2
	Luz.Ambient = Color3.fromRGB(128, 138, 158)
	Luz.OutdoorAmbient = Color3.fromRGB(160, 174, 198)
	Luz.FogColor = Color3.fromRGB(214, 226, 240)
	Luz.FogStart = 260
	Luz.FogEnd = 1400
	Luz.GlobalShadows = true
	if not Luz:FindFirstChildOfClass("Atmosphere") then
		local aire = Instance.new("Atmosphere")
		aire.Density = 0.34
		aire.Haze = 1.6
		aire.Color = Color3.fromRGB(214, 226, 242)
		aire.Parent = Luz
	end
end


-------------------------------------------------------------------
--  LOS HALLAZGOS
--
--  Se miran las casillas de delante de la puerta: segun baja la nieve
--  van apareciendo el tejado, la ventana y por fin la puerta.
-------------------------------------------------------------------

local estados = {}

local function anunciar(parcela, def)
	for jugador, estado in pairs(estados) do
		if estado.parcela == parcela.id then
			RemotoAviso:FireClient(jugador, {
				tipo = "hallazgo",
				clave = def.clave,
				nombre = def.nombre,
			})
		end
	end
end

local function alturaMaxima(parcela, cx0, cz0, cx1, cz1)
	local peor = 0
	for cx = cx0, cx1 do
		for cz = cz0, cz1 do
			local h = parcela:alturaEn(cx, cz)
			if h > peor then
				peor = h
			end
		end
	end
	return peor
end

-- Un hallazgo salta cuando la nieve baja POR DEBAJO de la altura real de
-- la cosa. Nada de umbrales a ojo: la casa dice a que altura esta cada
-- pieza y de ahi sale el aviso, asi que lo que se anuncia es lo que se ve.
function revisarHallazgos(parcela)
	local m = parcela.casa
	if not m then
		return
	end

	-- Todo se mide POR DELANTE, que es desde donde mira el jugador. Medir
	-- el tejado contra los ventisqueros de detras lo dejaba escondido
	-- hasta el final, y salta el ultimo siendo lo mas alto de la casa.
	-- Todo se mide en la MISMA linea de vision: lo que hay delante de la
	-- puerta, que es desde donde mira el jugador. Asi los avisos salen en
	-- orden de altura -- tejado, porche, ventana, puerta -- y cada uno
	-- justo cuando esa pieza asoma de verdad.
	local fachada = alturaMaxima(parcela, m.cxCentro - 1, m.cz1 + 1, m.cxCentro + 1, m.cz1 + 3)

	parcela.capasEnLaPuerta = math.ceil(fachada / A.nieve.capa)
	parcela.alturaFachada = fachada

	local altura = {
		tejado = { hasta = m.alturaTejado, mide = fachada },
		porche = { hasta = m.alturaPorche, mide = fachada },
		ventana = { hasta = m.alturaVentana, mide = fachada },
		puerta = { hasta = 0.5, mide = fachada },
	}

	for _, def in ipairs(A.hallazgos) do
		local u = altura[def.clave]
		if u and not parcela.hallazgos[def.clave] and u.mide < u.hasta then
			parcela.hallazgos[def.clave] = true
			anunciar(parcela, def)
		end
	end
end


-------------------------------------------------------------------
--  LA PALA
-------------------------------------------------------------------

local REPOSO = CFrame.new(0, -0.6, -0.5) * CFrame.Angles(math.rad(20), 0, 0)
local GOLPE = CFrame.new(0, -1.1, -1.4) * CFrame.Angles(math.rad(78), 0, 0)

local function darPala(jugador, pers, estado)
	local vieja = pers:FindFirstChild("Pala")
	if vieja then
		vieja:Destroy()
	end
	local brazo = pers:FindFirstChild("RightHand") or pers:FindFirstChild("Right Arm")
	if not brazo then
		local humano = pers:FindFirstChildOfClass("Humanoid")
		local esR15 = humano ~= nil and humano.RigType == Enum.HumanoidRigType.R15
		brazo = pers:WaitForChild(esR15 and "RightHand" or "Right Arm", 8)
	end
	if not brazo then
		return
	end

	local grupo = Instance.new("Model")
	grupo.Name = "Pala"

	local function trozo(nombre, tam, color, material)
		local p = Instance.new("Part")
		p.Name = nombre
		p.Size = tam
		p.Color = color
		p.Material = material or Enum.Material.SmoothPlastic
		p.CanCollide = false
		p.CanQuery = false
		p.CanTouch = false
		p.Massless = true
		p.Parent = grupo
		return p
	end

	local mango = trozo("Mango", Vector3.new(0.32, 4.2, 0.32), Color3.fromRGB(132, 92, 56), Enum.Material.Wood)
	mango.CFrame = brazo.CFrame * REPOSO
	local hoja = trozo("Hoja", Vector3.new(2.4, 0.24, 2.2), Color3.fromRGB(210, 224, 240), Enum.Material.Metal)
	hoja.CFrame = mango.CFrame * CFrame.new(0, -2.3, -0.6)
	local union = Instance.new("WeldConstraint")
	union.Part0 = mango
	union.Part1 = hoja
	union.Parent = hoja

	-- Motor6D y no soldadura: asi se puede animar el golpe moviendo C0.
	local motor = Instance.new("Motor6D")
	motor.Name = "Empunadura"
	motor.Part0 = brazo
	motor.Part1 = mango
	motor.C0 = REPOSO
	motor.Parent = brazo

	local punto = Instance.new("Attachment")
	punto.Name = "Polvo"
	punto.Parent = hoja
	local emisor = Instance.new("ParticleEmitter")
	emisor.Texture = "rbxasset://textures/particles/smoke_main.dds"
	emisor.Color = ColorSequence.new(Color3.fromRGB(255, 255, 255))
	emisor.Size = NumberSequence.new(2.2)
	emisor.Transparency = NumberSequence.new({
		NumberSequenceKeypoint.new(0, 0.05),
		NumberSequenceKeypoint.new(1, 1),
	})
	emisor.Lifetime = NumberRange.new(0.4, 0.9)
	emisor.Speed = NumberRange.new(8, 16)
	emisor.SpreadAngle = Vector2.new(50, 50)
	emisor.Acceleration = Vector3.new(0, -22, 0)
	emisor.Rate = 0
	emisor.Enabled = false
	emisor.Parent = punto

	grupo.Parent = pers
	estado.motor = motor
	estado.emisor = emisor
end

-- El golpe: la pala baja de verdad y salta la nieve.
local function animarGolpe(estado)
	if not estado.motor then
		return
	end
	pcall(function()
		Tweens:Create(
			estado.motor,
			TweenInfo.new(0.12, Enum.EasingStyle.Quad, Enum.EasingDirection.In),
			{ C0 = GOLPE }
		):Play()
	end)
	task.delay(0.14, function()
		if estado.emisor then
			pcall(function()
				estado.emisor:Emit(16)
			end)
		end
		if estado.motor then
			pcall(function()
				Tweens:Create(
					estado.motor,
					TweenInfo.new(0.24, Enum.EasingStyle.Quad, Enum.EasingDirection.Out),
					{ C0 = REPOSO }
				):Play()
			end)
		end
	end)
end


-------------------------------------------------------------------
--  EXCAVAR Y DESCARGAR
-------------------------------------------------------------------

local function excavarPara(jugador, estado, pos)
	if pos.Y > A.jugador.alturaMaxima then
		return
	end
	local parcela = parcelaEn(pos.X, pos.Z)
	if not parcela then
		return
	end
	estado.parcela = parcela.id

	local hueco = A.jugador.capacidad - estado.carga
	if hueco <= 0 then
		return
	end

	local radio = A.jugador.radio
	local radio2 = radio * radio
	local potencia = math.min(A.jugador.potencia, hueco)
	local cxMin, czMin = parcela:aCasilla(pos.X - radio, pos.Z - radio)
	local cxMax, czMax = parcela:aCasilla(pos.X + radio, pos.Z + radio)

	-- Se barre TODA la pala buscando casillas validas: que una este
	-- bloqueada no tira el golpe, se coge otra. Y si no hay ninguna
	-- valida pero si queda nieve, es que hay que ensanchar, y se dice.
	-- Se recogen las casillas de la cuchara y se atacan DE MAS ALTA A MAS
	-- BAJA. Al bajar una, sus vecinas quedan al mismo nivel y tambien se
	-- pueden bajar en la misma palada: una cuchara mueve una cucharada, no
	-- tres casillas sueltas.
	local candidatas = {}
	local habiaNieve = false
	for cx = cxMin, cxMax do
		for cz = czMin, czMax do
			local x, z = parcela:centro(cx, cz)
			local dx, dz = x - pos.X, z - pos.Z
			if dx * dx + dz * dz <= radio2 then
				local c = parcela:casilla(cx, cz)
				if c and not c.muro and c.restante > 0 then
					habiaNieve = true
					candidatas[#candidatas + 1] = { cx = cx, cz = cz, alto = c.restante }
				end
			end
		end
	end
	table.sort(candidatas, function(a, b)
		return a.alto > b.alto
	end)

	local hechas = 0
	for _, casilla in ipairs(candidatas) do
		if hechas >= potencia then
			break
		end
		if parcela:excavar(casilla.cx, casilla.cz) then
			hechas = hechas + 1
		end
	end

	estado.bloqueado = (hechas == 0 and habiaNieve)
	if hechas > 0 then
		estado.carga = estado.carga + hechas
		estado.excavando = true
		revisarHallazgos(parcela)
	end
end

local function descargarPara(jugador, estado, pos)
	if estado.carga <= 0 then
		return
	end
	local parcela = parcelas[estado.parcela] or parcelas[1]
	if not parcela then
		return
	end
	local plano = Vector3.new(pos.X, 0, pos.Z)
	if (plano - parcela.descarga).Magnitude > A.jugador.radioDescarga then
		return
	end

	local ganado = estado.carga * A.dinero.porCapa
	estado.dinero = estado.dinero + ganado
	estado.nieveTotal = estado.nieveTotal + estado.carga
	estado.carga = 0

	-- El monton crece con lo que se le echa: es el marcador de verdad.
	if parcela.monton then
		local crecido = 10 + math.min(40, parcela.capasQuitadas / 25)
		parcela.monton.Size = Vector3.new(crecido, crecido * 0.6, crecido)
		parcela.monton.Position = Vector3.new(parcela.descarga.X, crecido * 0.2, parcela.descarga.Z)
	end

	RemotoAviso:FireClient(jugador, { tipo = "descarga", cantidad = ganado })
	local marcador = jugador:FindFirstChild("leaderstats")
	local monedas = marcador and marcador:FindFirstChild("Coins")
	if monedas then
		monedas.Value = math.clamp(math.floor(estado.dinero), 0, 2147483647)
	end
end


-------------------------------------------------------------------
--  LO QUE VE EL CLIENTE
-------------------------------------------------------------------

local function paqueteDe(estado)
	local parcela = parcelas[estado.parcela] or parcelas[1]
	local hallazgos = {}
	if parcela then
		for clave, si in pairs(parcela.hallazgos) do
			hallazgos[clave] = si
		end
	end
	return {
		dinero = math.floor(estado.dinero),
		carga = estado.carga,
		capacidad = A.jugador.capacidad,
		nieveTotal = estado.nieveTotal,
		limpio = parcela and parcela:limpio() or 0,
		capasPuerta = parcela and parcela.capasEnLaPuerta or A.nieve.capasMaximas,
		bloqueado = estado.bloqueado == true,
		cavando = estado.cavando == true,
		hallazgos = hallazgos,
	}
end


-------------------------------------------------------------------
--  ENTRAR Y SALIR
-------------------------------------------------------------------

local function alEntrar(jugador)
	local carpeta = Instance.new("Folder")
	carpeta.Name = "leaderstats"
	local monedas = Instance.new("IntValue")
	monedas.Name = "Coins"
	monedas.Parent = carpeta
	local nieve = Instance.new("IntValue")
	nieve.Name = "Snow"
	nieve.Parent = carpeta
	carpeta.Parent = jugador

	estados[jugador] = {
		dinero = 0,
		carga = 0,
		nieveTotal = 0,
		excavando = false,
		cavando = false,
		ultimoGolpe = 0,
		-- De momento todos comparten la parcela 1. El dia que haya una por
		-- jugador solo cambia esta linea: el excavador ya trabaja por id.
		parcela = 1,
	}

	local function alAparecer(pers)
		local humano = pers:WaitForChild("Humanoid", 8)
		if humano then
			humano.WalkSpeed = A.jugador.velocidad
		end
		local estado = estados[jugador]
		if estado then
			estado.motor = nil
			estado.emisor = nil
			darPala(jugador, pers, estado)
		end
	end
	jugador.CharacterAdded:Connect(alAparecer)
	if jugador.Character then
		task.spawn(alAparecer, jugador.Character)
	end
end

local function alSalir(jugador)
	estados[jugador] = nil
end


RemotoCavar.OnServerEvent:Connect(function(jugador, quiere)
	local estado = estados[jugador]
	if estado then
		estado.cavando = quiere == true
	end
end)


-------------------------------------------------------------------
--  BUCLES
-------------------------------------------------------------------

local function bucle(nombre, cada, fn)
	task.spawn(function()
		while true do
			task.wait(cada)
			local ok, err = pcall(fn)
			if not ok then
				warn("[desenterrar] fallo en " .. nombre .. ": " .. tostring(err))
			end
		end
	end)
end

local function ticJuego()
	for jugador, estado in pairs(estados) do
		local pers = jugador.Character
		local raiz = pers and pers:FindFirstChild("HumanoidRootPart")
		if raiz then
			estado.excavando = false
			-- Solo se cava si el jugador esta pulsando, y a golpes: una
			-- palada cada tantos segundos, no un chorro continuo.
			if estado.cavando and (os.clock() - (estado.ultimoGolpe or 0)) >= A.jugador.golpe then
				estado.ultimoGolpe = os.clock()
				excavarPara(jugador, estado, raiz.Position)
				animarGolpe(estado)
			end
			descargarPara(jugador, estado, raiz.Position)
		end
	end
end

local function ticEstado()
	for jugador, estado in pairs(estados) do
		RemotoEstado:FireClient(jugador, paqueteDe(estado))
		local marcador = jugador:FindFirstChild("leaderstats")
		local nieve = marcador and marcador:FindFirstChild("Snow")
		if nieve then
			nieve.Value = math.clamp(math.floor(estado.nieveTotal), 0, 2147483647)
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

bucle("excavar", A.jugador.tic, ticJuego)
bucle("estado", 0.3, ticEstado)

print(
	("[desenterrar] parcela lista: %d casillas, %d capas de nieve"):format(
		parcelas[1].ancho * parcelas[1].largo,
		parcelas[1].capasTotales
	)
)
