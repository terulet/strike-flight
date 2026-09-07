--[[
	DESENTIERRA  —  servidor

	Primera vertical: una parcela, una casa enterrada, y la pala.

	Lo importante del diseno esta en dos sitios:

	  Parcela   todo el estado de la nieve vive aqui dentro, con su id.
	            Hoy hay una; manana una por jugador, y el excavador no se
	            entera porque siempre recibe SOBRE QUE parcela actua.

	  puedeExcavar()  la regla que hace imposible quedarse encerrado: solo
	            se puede cavar una casilla que no tenga ninguna vecina mas
	            alta. Para bajar hay que ensanchar, asi que la pendiente
	            se forma sola y nunca hay un pozo vertical.
]]

local Jugadores = game:GetService("Players")
local RS = game:GetService("ReplicatedStorage")
local Luz = game:GetService("Lighting")

local A = require(RS:WaitForChild("AjustesV2"))
local Parcela = require(RS:WaitForChild("ParcelaV2"))

local Terreno = workspace.Terrain
local CELDA = A.nieve.celda
local aleatorio = Random.new(20260907)


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


-------------------------------------------------------------------
--  EL MUNDO
-------------------------------------------------------------------

local parcelas = {}
local mundo = { carpeta = nil, salida = CFrame.new(0, 5, 0) }

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

	parte({
		Name = "Cuerpo",
		Size = Vector3.new(A.casa.ancho, A.casa.alto, A.casa.fondo),
		Position = Vector3.new(m.x, A.casa.alto / 2, m.z),
		Color = Color3.fromRGB(232, 214, 186),
		Material = Enum.Material.Concrete,
		CanCollide = true,
		CanQuery = true,
	}, grupo)
	parte({
		Name = "Zocalo",
		Size = Vector3.new(A.casa.ancho + 1, 3, A.casa.fondo + 1),
		Position = Vector3.new(m.x, 1.5, m.z),
		Color = Color3.fromRGB(158, 92, 74),
		Material = Enum.Material.Brick,
	}, grupo)
	parte({
		Name = "Tejado",
		Size = Vector3.new(A.casa.ancho + 5, 2, A.casa.fondo + 5),
		Position = Vector3.new(m.x, A.casa.alto + 1, m.z),
		Color = Color3.fromRGB(72, 78, 92),
		Material = Enum.Material.Slate,
		CanCollide = true,
		CanQuery = true,
	}, grupo)
	parte({
		Name = "TejadoNieve",
		Size = Vector3.new(A.casa.ancho + 5.4, 1.2, A.casa.fondo + 5.4),
		Position = Vector3.new(m.x, A.casa.alto + 2.6, m.z),
		Color = NIEVE,
		Material = Enum.Material.Snow,
	}, grupo)

	-- La chimenea: lo unico que asoma por encima de la nevada.
	parte({
		Name = "Chimenea",
		Size = Vector3.new(5, A.casa.alturaChimenea, 5),
		Position = Vector3.new(m.x + A.casa.ancho / 2 - 5, A.casa.alturaChimenea / 2, m.z - A.casa.fondo / 4),
		Color = Color3.fromRGB(158, 92, 74),
		Material = Enum.Material.Brick,
		CanCollide = true,
		CanQuery = true,
	}, grupo)
	parte({
		Name = "ChimeneaNieve",
		Size = Vector3.new(5.6, 1, 5.6),
		Position = Vector3.new(m.x + A.casa.ancho / 2 - 5, A.casa.alturaChimenea + 0.5, m.z - A.casa.fondo / 4),
		Color = NIEVE,
		Material = Enum.Material.Snow,
	}, grupo)

	-- La puerta, en la fachada que mira al hueco de salida.
	local zFachada = m.z + A.casa.fondo / 2
	parte({
		Name = "Puerta",
		Size = Vector3.new(A.casa.puertaAncho, A.casa.puertaAlto, 0.8),
		Position = Vector3.new(m.x, A.casa.puertaAlto / 2, zFachada + 0.3),
		Color = Color3.fromRGB(126, 78, 44),
		Material = Enum.Material.WoodPlanks,
		CanCollide = true,
		CanQuery = true,
	}, grupo)
	parte({
		Name = "Pomo",
		Shape = Enum.PartType.Ball,
		Size = Vector3.new(0.8, 0.8, 0.8),
		Position = Vector3.new(m.x + 2, A.casa.puertaAlto / 2, zFachada + 0.8),
		Color = Color3.fromRGB(228, 190, 84),
		Material = Enum.Material.Metal,
	}, grupo)
	for _, dx in ipairs({ -11, 11 }) do
		parte({
			Name = "Marco",
			Size = Vector3.new(5.6, 5.6, 0.4),
			Position = Vector3.new(m.x + dx, 9, zFachada + 0.2),
			Color = Color3.fromRGB(252, 252, 252),
		}, grupo)
		parte({
			Name = "Cristal",
			Size = Vector3.new(4.6, 4.6, 0.6),
			Position = Vector3.new(m.x + dx, 9, zFachada + 0.35),
			Color = Color3.fromRGB(142, 198, 232),
			Material = Enum.Material.Glass,
			Transparency = 0.2,
		}, grupo)
	end

	return m
end

local function construirParcela(parcela)
	local grupo = Instance.new("Folder")
	grupo.Name = "Parcela_" .. parcela.id
	grupo.Parent = mundo.carpeta
	parcela.carpeta = grupo

	local anchoS = parcela.ancho * CELDA
	local largoS = parcela.largo * CELDA
	local cxCentro = parcela.ancho / 2

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

local function revisarHallazgos(parcela)
	local m = parcela.casa
	if not m then
		return
	end
	local encima = parcela:capasEncima(m.cxCentro - 1, m.cz1 + 1, m.cxCentro + 1, m.cz1 + 2)
	parcela.capasEnLaPuerta = encima
	for _, def in ipairs(A.hallazgos) do
		if not parcela.hallazgos[def.clave] and encima <= def.capas then
			parcela.hallazgos[def.clave] = true
			anunciar(parcela, def)
		end
	end
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
	local hechas = 0
	local habiaNieve = false
	for cx = cxMin, cxMax do
		for cz = czMin, czMax do
			local x, z = parcela:centro(cx, cz)
			local dx, dz = x - pos.X, z - pos.Z
			if dx * dx + dz * dz <= radio2 then
				local c = parcela:casilla(cx, cz)
				if c and not c.muro and c.restante > 0 then
					habiaNieve = true
					if parcela:excavar(cx, cz) then
						hechas = hechas + 1
						if hechas >= potencia then
							break
						end
					end
				end
			end
		end
		if hechas >= potencia then
			break
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
		-- De momento todos comparten la parcela 1. El dia que haya una por
		-- jugador solo cambia esta linea: el excavador ya trabaja por id.
		parcela = 1,
	}

	jugador.CharacterAdded:Connect(function(pers)
		local humano = pers:WaitForChild("Humanoid", 8)
		if humano then
			humano.WalkSpeed = A.jugador.velocidad
		end
	end)
end

local function alSalir(jugador)
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
			excavarPara(jugador, estado, raiz.Position)
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
