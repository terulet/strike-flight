--[[
	LA GRAN TORMENTA  —  servidor

	Tercera vertical. Las dos anteriores demostraron que desenterrar
	engancha; esta hace que no se pierda y que se pueda jugar acompanado.

	Lo que sostiene todo, en cuatro sitios:

	  Parcela        el estado de la nieve, con su id. Ahora hay cinco a la
	                 vez y quien excava siempre dice SOBRE QUE parcela
	                 actua. La parcela no sabe quien juega.

	  puedeExcavar() la regla que hace imposible quedarse encerrado, y la
	                 que hace que dos jugadores cavando juntos no puedan
	                 romper la pendiente ni bajar dos veces la misma
	                 casilla: comprobar y bajar van seguidos.

	  Guardado       lo que no se puede deducir del mundo. Si el DataStore
	                 no esta, se juega igual con guardado temporal.

	  los capitulos  el jugador nunca ve un menu. Ve el siguiente misterio.
	                 Y son del DUENO de la parcela: quien viene a ayudar
	                 quita nieve y cobra por ella, pero el guion es de
	                 quien vive ahi.
]]

local Jugadores = game:GetService("Players")
local RS = game:GetService("ReplicatedStorage")
local Luz = game:GetService("Lighting")
local Tweens = game:GetService("TweenService")

local A = require(RS:WaitForChild("Ajustes"))
local Parcela = require(RS:WaitForChild("Parcela"))
local Mundo = require(script.Parent.Mundo)
local Guardado = require(script.Parent.Guardado)
local Tormenta = require(script.Parent.Tormenta)

local Terreno = workspace.Terrain
local CELDA = A.nieve.celda
local NIEVE = Mundo.NIEVE
local CALIDA = Mundo.CALIDA
local parte = Mundo.parte
local luzDe = Mundo.luzDe
local sonidoDe = Mundo.sonidoDe


-------------------------------------------------------------------
--  REMOTOS
-------------------------------------------------------------------

local remotos = Instance.new("Folder")
remotos.Name = "RemotosKali"
remotos.Parent = RS

local function remoto(nombre)
	local r = Instance.new("RemoteEvent")
	r.Name = nombre
	r.Parent = remotos
	return r
end

local RemotoEstado = remoto("Estado")
local RemotoAviso = remoto("Aviso")
-- El cliente dice cuando esta pulsando. Sin esto no se cava: quieto no
-- pasa nada, que era justo la queja.
local RemotoCavar = remoto("Cavar")
local RemotoHerramienta = remoto("Herramienta")
local RemotoMaquina = remoto("Maquina")


-------------------------------------------------------------------
--  ESTADO
-------------------------------------------------------------------

local parcelas = {}
local estados = {}
local mundo = { carpeta = nil }

local revisarHallazgos
local quizaEmpezarTormenta
local protegerLoDescubierto
local zonasProtegidas
local montarParcela
local reiniciarPiezas
local darHerramienta
local soltarQuitanieves
local guardarJugador
local ponerBaliza
local abrirAyuntamiento

local function parcelaEn(x, z)
	for _, p in ipairs(parcelas) do
		if p:contiene(x, z) then
			return p
		end
	end
	return nil
end


-------------------------------------------------------------------
--  CONSTRUIR LAS PARCELAS
--
--  La forma del mundo se levanta UNA vez al arrancar. Lo unico que va y
--  viene al cambiar de dueno es la nieve y el estado del guion, que es
--  justo lo que se guarda.
-------------------------------------------------------------------

local function montonEn(parcela, grupo, x, z, fuera)
	local D = A.descarga
	local nace = Vector3.new(x, 0, z) + fuera * (D.libre + D.tamanoMinimo / 2)
	local bola = parte({
		Name = "Monton",
		Shape = Enum.PartType.Ball,
		Size = Vector3.new(D.tamanoMinimo, D.tamanoMinimo, D.tamanoMinimo),
		Position = Vector3.new(nace.X, 2, nace.Z),
		Color = NIEVE,
		Material = Enum.Material.Snow,
		CanCollide = true,
		CanQuery = true,
	}, grupo)
	parte({
		Name = "PuntoDescarga",
		Size = Vector3.new(24, 0.3, 24),
		Position = Vector3.new(x, 0.2, z),
		Color = Color3.fromRGB(120, 205, 255),
		Material = Enum.Material.Neon,
		Transparency = 0.55,
	}, grupo)
	parcela.descargas[#parcela.descargas + 1] =
		{ sitio = Vector3.new(x, 0, z), bola = bola, echado = 0, fuera = fuera }
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
		Size = Vector3.new(anchoS + 200, 2, largoS + 100),
		Position = Vector3.new(parcela.origen.X + anchoS / 2 + 30, -1, parcela.origen.Z + largoS / 2),
		Color = Color3.fromRGB(96, 150, 76),
		Material = Enum.Material.Grass,
		CanCollide = true,
		CanQuery = true,
	}, grupo)

	local m = Mundo.medidasCasa(parcela)
	local v = Mundo.medidasVecino(parcela)
	Mundo.casa(parcela, grupo, m)
	parcela.casa = m
	parcela.vecino = Mundo.vecino(parcela, grupo, v)
	parcela.calle = Mundo.calle(parcela, grupo, m)
	parcela.ayuntamiento = Mundo.ayuntamiento(parcela, grupo)
	parcela.arbol = Mundo.arbol(parcela, grupo)
	parcela.camion = Mundo.camion(parcela, grupo)
	Mundo.pueblo(parcela, grupo)
	parcela.perfil = Mundo.perfil(parcela, m, parcela.vecino, parcela.ayuntamiento)

	-- Como estaba todo antes de tocarlo: al soltar la parcela para el
	-- siguiente jugador hay que devolverla exactamente aqui.
	parcela.cerrado = {
		puerta = m.puerta.CFrame,
		garajeSize = m.puertaGaraje.Size,
		garajePos = m.puertaGaraje.Position,
		vecinoPuerta = parcela.vecino.puerta.CFrame,
		aytoPuerta = parcela.ayuntamiento.puerta.CFrame,
		persona = {},
	}
	-- Donde estaba cada trozo del vecino antes de salir por la puerta.
	for _, pieza in ipairs(parcela.vecino.persona:GetChildren()) do
		if pieza:IsA("BasePart") then
			parcela.cerrado.persona[pieza] = pieza.CFrame
		end
	end

	-- Dos montones donde vaciar la carretilla, en el arcen: uno a la
	-- altura de tu casa y otro a la del vecino. Con uno solo, la segunda
	-- mitad de la partida era ir y volver.
	local aPoniente = Vector3.new(-1, 0, 0)
	local aLevante = Vector3.new(1, 0, 0)
	montonEn(parcela, grupo, parcela.origen.X - 20, m.z, aPoniente)
	montonEn(parcela, grupo, parcela.origen.X - 20, parcela.vecino.z, aPoniente)
	-- Y UNO TERCERO AL OTRO EXTREMO, pasada la plaza. Los dos de arriba
	-- estan a la altura de tu casa, que es donde ocurre la primera
	-- historia; en cuanto el pueblo se abre hacia levante (la parada, el
	-- ayuntamiento, y sobre todo las tormentas) palear alli con solo esos
	-- dos era cruzar el pueblo entero con la carretilla llena a cada
	-- viaje. Un monton no es un adorno: es lo que decide si un rincon
	-- del mapa se puede trabajar o no.
	montonEn(parcela, grupo,
		parcela.origen.X + parcela.ancho * CELDA + 20,
		parcela.origen.Z + A.sitio.czAyuntamiento * CELDA, aLevante)

	-- Se aparece FUERA de la parcela, en suelo firme, en linea recta con
	-- el buzon: lo primero que se ve es su marca naranja asomando, y
	-- detras la chimenea.
	local bx, bz = parcela:centro(parcela.calle.buzonCx, parcela.calle.buzonCz)
	local sitio = Instance.new("SpawnLocation")
	sitio.Name = "Salida"
	sitio.Size = Vector3.new(14, 1, 14)
	sitio.Anchored = true
	sitio.CanCollide = true
	sitio.Transparency = 0.5
	sitio.Color = Color3.fromRGB(120, 205, 255)
	sitio.Material = Enum.Material.Neon
	sitio.Duration = 0
	sitio.Neutral = true
	-- Ojo: sin esto, cualquiera reaparece en la parcela de cualquiera.
	-- Cada jugador se ata a la suya al entrar.
	sitio.Enabled = false
	sitio.CFrame = CFrame.lookAt(
		Vector3.new(parcela.origen.X - 20, 0.5, bz),
		Vector3.new(bx, 0.5, bz)
	)
	sitio.Parent = grupo
	parcela.salida = sitio

	local cartel = Instance.new("BillboardGui")
	cartel.Name = "DeQuien"
	cartel.Size = UDim2.new(0, 260, 0, 44)
	cartel.StudsOffset = Vector3.new(0, 7, 0)
	cartel.AlwaysOnTop = true
	cartel.MaxDistance = 320
	cartel.Parent = sitio
	local texto = Instance.new("TextLabel")
	texto.Name = "Texto"
	texto.Size = UDim2.new(1, 0, 1, 0)
	texto.BackgroundTransparency = 1
	texto.Text = "LIBRE"
	texto.TextColor3 = Color3.fromRGB(190, 226, 255)
	texto.Font = Enum.Font.GothamBlack
	texto.TextScaled = true
	texto.Parent = cartel
	parcela.cartelDueno = texto

	grupo:SetAttribute("casillas", parcela.ancho * parcela.largo)
	return parcela
end

local function construirMundo()
	pcall(function()
		Terreno:Clear()
	end)
	for _, obj in ipairs(workspace:GetChildren()) do
		if obj.Name == "Baseplate" or obj.Name == "Pueblo" or obj:IsA("SpawnLocation") then
			obj:Destroy()
		end
	end

	local carpeta = Instance.new("Folder")
	carpeta.Name = "Pueblo"
	carpeta.Parent = workspace
	mundo.carpeta = carpeta

	local paso = A.parcela.largo * CELDA + A.parcela.separacion
	for i = 1, A.parcela.cuantas do
		local p = Parcela.nueva(i, Vector3.new(0, 0, (i - 1) * paso))
		parcelas[i] = p
		construirParcela(p)
	end

	Luz.ClockTime = 15
	Luz.Brightness = 2.2
	Luz.Ambient = Color3.fromRGB(128, 138, 158)
	Luz.OutdoorAmbient = Color3.fromRGB(160, 174, 198)
	Luz.FogColor = Color3.fromRGB(214, 226, 240)
	Luz.FogStart = 300
	Luz.FogEnd = 1800
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
--  EL MUNDO REACCIONA
--
--  Esto es la mitad del juego. Cavar sin que pase nada es trabajo; cavar
--  y que se abra una puerta y salga alguien es otra cosa. Ninguna
--  reaccion quita el control al jugador: pasa, se ve, y a seguir.
--
--  Cada una se puede aplicar EN SECO (al cargar una partida guardada):
--  entonces no suena nada ni hay tween, simplemente el mundo ya esta asi.
-------------------------------------------------------------------

local function encender(luz, brillo, tiempo)
	if not luz then
		return
	end
	luz.Enabled = true
	if tiempo == 0 then
		luz.Brightness = brillo
		return
	end
	pcall(function()
		Tweens:Create(luz, TweenInfo.new(tiempo or 1.2), { Brightness = brillo }):Play()
	end)
end

local function subirSonido(sonido, volumen, seco)
	if not sonido then
		return
	end
	pcall(function()
		sonido:Play()
		if seco then
			sonido.Volume = volumen
		else
			Tweens:Create(sonido, TweenInfo.new(2), { Volume = volumen }):Play()
		end
	end)
end

local function mover(pieza, destino, tiempo, estilo)
	if tiempo == 0 then
		pieza.CFrame = destino
		return
	end
	pcall(function()
		Tweens:Create(
			pieza,
			TweenInfo.new(tiempo, estilo or Enum.EasingStyle.Back, Enum.EasingDirection.Out),
			{ CFrame = destino }
		):Play()
	end)
end

-- La puerta se abre hacia dentro, girando sobre su jamba. Nada de
-- desvanecerla: gira, y por el hueco sale la luz de tu casa.
local function abrirPuerta(parcela, seco)
	local m = parcela.casa
	if not m or m.puertaAbierta then
		return
	end
	m.puertaAbierta = true

	local ancho = A.casa.puertaAncho
	local bisagra = CFrame.new(parcela.cerrado.puerta.Position - Vector3.new(ancho / 2, 0, 0))
	mover(m.puerta, bisagra * CFrame.Angles(0, math.rad(84), 0) * CFrame.new(ancho / 2, 0, 0),
		seco and 0 or 1.4)

	if m.recibidor then
		m.recibidor.Material = Enum.Material.Neon
		if seco then
			m.recibidor.Color = CALIDA
		else
			pcall(function()
				Tweens:Create(m.recibidor, TweenInfo.new(1.6), { Color = CALIDA }):Play()
			end)
		end
	end
	encender(m.luzRecibidor, 3.2, seco and 0 or 1.6)
	subirSonido(m.sonidoCasa, 0.3, seco)
	if m.humo then
		m.humo.Enabled = true
	end
end

-- El garaje: la persiana se enrolla y dentro hay luz. Lo que hay dentro
-- se ve desde fuera, que para eso se ha cavado.
local function abrirGaraje(parcela, seco)
	local m = parcela.casa
	if not m or m.garajeAbierto then
		return
	end
	m.garajeAbierto = true

	local p = m.puertaGaraje
	local destinoSize = Vector3.new(p.Size.X, 0.6, p.Size.Z)
	local destinoPos = Vector3.new(parcela.cerrado.garajePos.X, 8, parcela.cerrado.garajePos.Z)
	if seco then
		p.Size = destinoSize
		p.Position = destinoPos
	else
		pcall(function()
			Tweens:Create(p, TweenInfo.new(2, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), {
				Size = destinoSize,
				Position = destinoPos,
			}):Play()
		end)
	end
	for _, r in ipairs(m.ranurasGaraje or {}) do
		if seco then
			r.Transparency = 1
		else
			pcall(function()
				Tweens:Create(r, TweenInfo.new(1.2), { Transparency = 1 }):Play()
			end)
		end
	end
	encender(m.luzGaraje, 2.6, seco and 0 or 1)
	if not seco then
		pcall(function()
			m.sonidoGaraje:Play()
		end)
	end
end

-- La calle abierta enciende las farolas y despierta la casa de enfrente:
-- humo, luz floja, y alguien golpeando el cristal. Ese golpe es el
-- capitulo siguiente, dicho sin una sola linea de texto.
local function abrirCarretera(parcela, seco)
	local c = parcela.calle
	local v = parcela.vecino
	if not c or c.encendida then
		return
	end
	c.encendida = true
	for _, f in ipairs(c.farolas) do
		f.pieza.Material = Enum.Material.Neon
		f.pieza.Color = Color3.fromRGB(255, 240, 202)
		encender(f.luz, 2.2, seco and 0 or 2.5)
	end
	encender(c.luzSenal, 1.2, seco and 0 or 2)
	if not v then
		return
	end
	if v.humo then
		v.humo.Enabled = true
	end
	for _, cr in ipairs(v.cristales) do
		cr.pieza.Material = Enum.Material.Neon
		cr.pieza.Color = Color3.fromRGB(126, 106, 78)
		encender(cr.luz, 0.9, seco and 0 or 3)
	end

	-- LA SILUETA. Se asoma y golpea el cristal cada pocos segundos hasta
	-- que vas. No se puede no entenderlo.
	v.silueta.Transparency = 0
	if v.llamando then
		return
	end
	v.llamando = true
	task.spawn(function()
		local base = v.silueta.CFrame
		while v.llamando and v.silueta.Parent do
			for _ = 1, 3 do
				if not v.llamando then
					break
				end
				mover(v.silueta, base * CFrame.new(0, 0, -0.35), 0.09, Enum.EasingStyle.Quad)
				pcall(function()
					v.golpe:Play()
				end)
				task.wait(0.16)
				mover(v.silueta, base, 0.09, Enum.EasingStyle.Quad)
				task.wait(0.2)
			end
			task.wait(4.5)
		end
	end)
end

-- EL RESCATE. Se abre su puerta, sale, y te da las llaves. Pocos
-- segundos, sin quitarte el control y sin una linea de dialogo: se abre,
-- sale, brilla algo dorado, y ya tienes quitanieves.
local function rescatarVecino(parcela, seco)
	local v = parcela.vecino
	if not v or v.abierta then
		return
	end
	v.abierta = true
	v.llamando = false
	v.silueta.Transparency = 1

	local ancho = A.vecino.puertaAncho
	local bisagra = CFrame.new(parcela.cerrado.vecinoPuerta.Position - Vector3.new(ancho / 2, 0, 0))
	mover(v.puerta, bisagra * CFrame.Angles(0, math.rad(-84), 0) * CFrame.new(ancho / 2, 0, 0),
		seco and 0 or 1.6)

	v.recibidor.Material = Enum.Material.Neon
	if seco then
		v.recibidor.Color = CALIDA
	else
		pcall(function()
			Tweens:Create(v.recibidor, TweenInfo.new(1.6), { Color = CALIDA }):Play()
		end)
	end
	encender(v.luzRecibidor, 3, seco and 0 or 1.6)
	for _, cr in ipairs(v.cristales) do
		cr.pieza.Color = CALIDA
		encender(cr.luz, 2, seco and 0 or 1.5)
	end
	subirSonido(v.sonido, 0.3, seco)

	-- Sale. Las piezas van una a una porque el modelo esta suelto: se
	-- mueven todas el mismo vector desde donde estaban.
	local salida = Vector3.new(0, 0, -6)
	for _, p in ipairs(v.persona:GetChildren()) do
		if p:IsA("BasePart") then
			local destino = p.CFrame + salida
			p.Transparency = 0
			mover(p, destino, seco and 0 or 1.8, Enum.EasingStyle.Sine)
		end
	end
	encender(v.luzLlaves, 3, seco and 0 or 0.6)
end


-- LAS DOS RECOMPENSAS de superar una tormenta. Ni tienda ni renacimiento:
-- una luz que se ve desde lejos y una puerta que se abre.

-- El quitanieves pasa a ser vehiculo de emergencia. Es un premio que se
-- VE, que es la unica clase de premio que sirve aqui.
function ponerBaliza(parcela)
	parcela.conBaliza = true
	local q = parcela.maquina
	if not q or q.baliza then
		return
	end
	local sitio = q.chasis.CFrame
	local barra = parte({
		Name = "Baliza",
		Size = Vector3.new(5.4, 0.9, 1.4),
		Position = sitio.Position,
		Color = Color3.fromRGB(255, 96, 40),
		Material = Enum.Material.Neon,
		CanCollide = false,
		CanQuery = false,
		CastShadow = true,
	}, q.grupo)
	q.extras[#q.extras + 1] = { pieza = barra, sitio = CFrame.new(0, 8.2, 2.4) }
	q.baliza = luzDe(barra, Color3.fromRGB(255, 120, 50), 3.2, 34)
	q.colocar(CFrame.new(q.sitio) * CFrame.Angles(0, q.giro, 0))
end

-- Y se abre el ayuntamiento. Dentro no hay tienda: hay un mapa con tres
-- sitios del pueblo todavia enterrados. El gancho, y nada mas.
function abrirAyuntamiento(parcela, seco)
	local a = parcela.ayuntamiento
	if not a or a.abierto then
		return
	end
	a.abierto = true
	local bisagra = CFrame.new(parcela.cerrado.aytoPuerta.Position - Vector3.new(5, 0, 0))
	mover(a.puerta, bisagra * CFrame.Angles(0, math.rad(96), 0) * CFrame.new(5, 0, 0),
		seco and 0 or 2)
	a.recibidor.Material = Enum.Material.Neon
	a.recibidor.Color = CALIDA
	encender(a.luz, 3, seco and 0 or 2)
	encender(a.luzReloj, 2, seco and 0 or 2)
	a.reloj.Material = Enum.Material.Neon
end


-------------------------------------------------------------------
--  LAS HERRAMIENTAS COMO OBJETOS DEL MUNDO
--
--  Ninguna se compra. La sopladora esta tirada en tu garaje y el
--  quitanieves te lo deja el vecino al que acabas de desenterrar.
-------------------------------------------------------------------

local function piezasSopladora(padre, escala, nombre)
	local grupo = Instance.new("Model")
	grupo.Name = nombre

	local function trozo(nom, tam, color, material)
		local p = Instance.new("Part")
		p.Name = nom
		p.Size = tam * escala
		p.Color = color
		p.Material = material or Enum.Material.SmoothPlastic
		p.Anchored = true
		p.CanCollide = false
		p.CanQuery = false
		p.CanTouch = false
		p.Massless = true
		p.Parent = grupo
		return p
	end

	local NARANJA = Color3.fromRGB(238, 108, 40)
	local cuerpo = trozo("Cuerpo", Vector3.new(3, 2.4, 3.4), NARANJA)
	local boca = trozo("Boca", Vector3.new(4.4, 1.9, 1.5), Color3.fromRGB(52, 54, 60), Enum.Material.Metal)
	local sinfin = trozo("Sinfin", Vector3.new(3.8, 0.5, 0.5), Color3.fromRGB(180, 184, 190), Enum.Material.Metal)
	local tubo = trozo("Tubo", Vector3.new(1.2, 2.8, 1.2), NARANJA)
	local salida = trozo("Salida", Vector3.new(1.5, 0.9, 1.5), Color3.fromRGB(52, 54, 60), Enum.Material.Metal)
	local motor = trozo("Motor", Vector3.new(1.8, 1.4, 1.6), Color3.fromRGB(40, 42, 48), Enum.Material.Metal)
	local manillar = trozo("Manillar", Vector3.new(3.2, 0.35, 0.35), Color3.fromRGB(28, 28, 32))
	local ruedas = {}
	for _, dx in ipairs({ -1, 1 }) do
		local r = trozo("Rueda", Vector3.new(0.7, 1.7, 1.7), Color3.fromRGB(26, 26, 30), Enum.Material.Metal)
		r.Shape = Enum.PartType.Cylinder
		ruedas[#ruedas + 1] = { pieza = r, lado = dx }
	end

	grupo.PrimaryPart = cuerpo
	grupo.Parent = padre

	local function armar()
		local base = cuerpo.CFrame
		boca.CFrame = base * CFrame.new(0, -0.55 * escala, -2.3 * escala)
		sinfin.CFrame = base * CFrame.new(0, -0.55 * escala, -2.9 * escala)
		tubo.CFrame = base * CFrame.new(0.9 * escala, 1.9 * escala, -0.6 * escala) * CFrame.Angles(0, 0, math.rad(-32))
		salida.CFrame = tubo.CFrame * CFrame.new(0, 1.5 * escala, 0) * CFrame.Angles(0, 0, math.rad(-16))
		motor.CFrame = base * CFrame.new(0, 1.5 * escala, 1 * escala)
		manillar.CFrame = base * CFrame.new(0, 1.5 * escala, 2.2 * escala)
		for _, r in ipairs(ruedas) do
			r.pieza.CFrame = base * CFrame.new(r.lado * 1.7 * escala, -1.1 * escala, 1.1 * escala)
				* CFrame.Angles(0, 0, math.rad(90))
		end
	end

	return grupo, cuerpo, salida, armar
end

local function rotulo(padre, texto, color, alto)
	local cartel = Instance.new("BillboardGui")
	cartel.Name = "Rotulo"
	cartel.Size = UDim2.new(0, 240, 0, 52)
	cartel.StudsOffset = Vector3.new(0, alto, 0)
	cartel.AlwaysOnTop = true
	cartel.MaxDistance = 260
	cartel.Parent = padre
	local letras = Instance.new("TextLabel")
	letras.Name = "Texto"
	letras.Size = UDim2.new(1, 0, 1, 0)
	letras.BackgroundTransparency = 1
	letras.Text = texto
	letras.TextColor3 = color
	letras.Font = Enum.Font.GothamBlack
	letras.TextScaled = true
	letras.Parent = cartel
	return cartel
end

local function soltarSopladora(parcela)
	local m = parcela.casa
	if parcela.sopladoraSuelta then
		return
	end
	local grupo, cuerpo, salida, armar = piezasSopladora(parcela.carpeta, 1, "SopladoraDelGaraje")
	cuerpo.CFrame = CFrame.new(m.garajeX, 2.2, m.z + 1) * CFrame.Angles(0, math.rad(180), 0)
	armar()
	for _, p in ipairs(grupo:GetChildren()) do
		if p:IsA("BasePart") then
			p.CanQuery = true
			p.CastShadow = true
		end
	end
	rotulo(cuerpo, "SOPLADORA", Color3.fromRGB(255, 214, 138), 4.4)
	local aviso = Instance.new("ProximityPrompt")
	aviso.Name = "Coger"
	aviso.ActionText = "COGER"
	aviso.ObjectText = "SOPLADORA"
	aviso.HoldDuration = 0
	aviso.MaxActivationDistance = A.sitio.radioCogida
	aviso.RequiresLineOfSight = false
	aviso.Parent = cuerpo
	luzDe(cuerpo, Color3.fromRGB(255, 200, 120), 1.4, 22)

	parcela.sopladoraSuelta = grupo
	parcela.sopladoraCuerpo = cuerpo
	parcela.sopladoraSalida = salida
end


-------------------------------------------------------------------
--  EL QUITANIEVES
--
--  Se conduce, y es lo unico del juego que se conduce. Va ANCLADO y lo
--  mueve el servidor casilla a casilla: asi no puede volcar, ni colarse
--  dentro de una casa, ni salir disparado por un bache del terreno. Lo
--  que decide por donde puede pasar no es la fisica, es el modelo:
--
--    - nada de casas (las casillas de muro no se pisan)
--    - nada de ventisqueros (mas de capasMaximas y la cuchilla no entra)
--
--  Y limpia solo donde hay calle debajo. En el jardin no pinta nada.
-------------------------------------------------------------------

local function piezasQuitanieves(parcela)
	local grupo = Instance.new("Model")
	grupo.Name = "Quitanieves"

	local NARANJA = Color3.fromRGB(240, 132, 26)
	local piezas = {}
	local function trozo(nombre, tam, desplazado, color, material, forma)
		local p = parte({
			Name = nombre,
			Size = tam,
			Color = color,
			Material = material or Enum.Material.SmoothPlastic,
			CanCollide = true,
			CanQuery = true,
			CastShadow = true,
		}, grupo)
		if forma then
			p.Shape = forma
		end
		piezas[#piezas + 1] = { pieza = p, sitio = desplazado }
		return p
	end

	local chasis = trozo("Chasis", Vector3.new(8, 3.4, 15), CFrame.new(0, 0, 0), NARANJA, Enum.Material.Metal)
	trozo("Cuchilla", Vector3.new(30, 5.4, 1.6), CFrame.new(0, -0.6, -8.6) * CFrame.Angles(math.rad(16), 0, 0),
		Color3.fromRGB(212, 60, 48), Enum.Material.Metal)
	trozo("CuchillaFilo", Vector3.new(30, 0.8, 2.6), CFrame.new(0, -3, -8.9),
		Color3.fromRGB(188, 190, 196), Enum.Material.Metal)
	trozo("Cabina", Vector3.new(6.4, 5, 6), CFrame.new(0, 4.2, 2.4), NARANJA, Enum.Material.Metal)
	trozo("Cristal", Vector3.new(5.6, 3, 0.3), CFrame.new(0, 5, -0.6),
		Color3.fromRGB(150, 200, 226), Enum.Material.Glass)
	local baliza = trozo("Baliza", Vector3.new(1.6, 1, 1.6), CFrame.new(0, 7, 2.4),
		Color3.fromRGB(255, 150, 40), Enum.Material.Neon)
	for _, dx in ipairs({ -1, 1 }) do
		trozo("Faro", Vector3.new(1.6, 1, 0.6), CFrame.new(dx * 2.6, 0.9, -7.4),
			Color3.fromRGB(255, 246, 208), Enum.Material.Neon)
		for _, dz in ipairs({ 4.4, -3.4 }) do
			trozo("Rueda", Vector3.new(1.6, 4.2, 4.2), CFrame.new(dx * 4.4, -1.6, dz) * CFrame.Angles(0, 0, math.rad(90)),
				Color3.fromRGB(28, 28, 32), Enum.Material.Metal, Enum.PartType.Cylinder)
		end
	end

	local asiento = Instance.new("VehicleSeat")
	asiento.Name = "Asiento"
	asiento.Size = Vector3.new(4, 1, 4)
	asiento.Anchored = true
	asiento.CanCollide = true
	asiento.Color = Color3.fromRGB(48, 44, 40)
	asiento.Material = Enum.Material.Fabric
	asiento.MaxSpeed = 0
	asiento.Torque = 0
	asiento.TurnSpeed = 0
	asiento.HeadsUpDisplay = false
	asiento.Parent = grupo
	piezas[#piezas + 1] = { pieza = asiento, sitio = CFrame.new(0, 2.4, 2.4) }

	local luz = luzDe(baliza, Color3.fromRGB(255, 160, 60), 2.4, 26)
	local motor = sonidoDe(chasis, "Motor", "rbxasset://sounds/action_falling.mp3", 0, 0.8, true)
	pcall(function()
		motor:Play()
	end)

	-- El chorro de nieve que sale por delante de la cuchilla.
	local punto = Instance.new("Attachment")
	punto.Name = "Chorro"
	punto.Parent = chasis
	local e = Instance.new("ParticleEmitter")
	e.Texture = "rbxasset://textures/particles/smoke_main.dds"
	e.Color = ColorSequence.new(Color3.fromRGB(252, 254, 255))
	e.Size = NumberSequence.new({
		NumberSequenceKeypoint.new(0, 3),
		NumberSequenceKeypoint.new(1, 9),
	})
	e.Transparency = NumberSequence.new({
		NumberSequenceKeypoint.new(0, 0.05),
		NumberSequenceKeypoint.new(0.7, 0.35),
		NumberSequenceKeypoint.new(1, 1),
	})
	e.Lifetime = NumberRange.new(0.7, 1.2)
	e.Speed = NumberRange.new(30, 46)
	e.SpreadAngle = Vector2.new(60, 24)
	e.Acceleration = Vector3.new(0, -60, 0)
	e.Rate = 0
	e.Enabled = false
	e.Parent = punto

	grupo.PrimaryPart = chasis
	grupo.Parent = parcela.carpeta

	local extras = {}
	local function colocar(cf)
		for _, p in ipairs(piezas) do
			p.pieza.CFrame = cf * p.sitio
		end
		for _, p in ipairs(extras) do
			p.pieza.CFrame = cf * p.sitio
		end
	end

	return {
		grupo = grupo,
		extras = extras,
		chasis = chasis,
		asiento = asiento,
		colocar = colocar,
		luz = luz,
		motor = motor,
		chorro = e,
		giro = 0,
	}
end

-- Donde se aparca: en la calzada, a la salida de tu entrada. Es el sitio
-- al que vuelve tambien cuando se le da a RECUPERAR.
local function sitioDelQuitanieves(parcela)
	-- Pasado el muro de tu entrada: ahi la calzada esta como la dejo la
	-- maquina municipal, y por eso el quitanieves puede pisarla.
	local x, z = parcela:centro(parcela.casa.garajeCx + 16, A.sitio.czCarretera)
	return Vector3.new(x, 3.4, z)
end

function soltarQuitanieves(parcela, seco)
	if parcela.maquina then
		return
	end
	local q = piezasQuitanieves(parcela)
	q.sitio = sitioDelQuitanieves(parcela)
	-- Mirando calle abajo, hacia la plaza. En Roblox el frente de un
	-- CFrame es -Z, asi que apuntar a +X es girar -90 grados.
	q.giro = -math.pi / 2
	q.colocar(CFrame.new(q.sitio) * CFrame.Angles(0, q.giro, 0))
	rotulo(q.chasis, "QUITANIEVES", Color3.fromRGB(255, 190, 90), 7)
	parcela.maquina = q
	if parcela.conBaliza then
		ponerBaliza(parcela)
	end
	if not seco then
		pcall(function()
			q.motor.Volume = 0.12
		end)
	end
end


-------------------------------------------------------------------
--  LOS HALLAZGOS Y EL GUION
--
--  Un hallazgo salta cuando la nieve de encima baja POR DEBAJO de la
--  altura real de la cosa. La geometria manda: lo que se anuncia es
--  exactamente lo que se ve.
--
--  Y son DE LA PARCELA, no de quien cava. Quien viene a ayudar mueve
--  nieve y cobra por ella; el guion avanza para el dueno.
-------------------------------------------------------------------

local function aTodos(parcela, datos)
	for jugador, estado in pairs(estados) do
		if estado.parcela == parcela.id or estado.mia == parcela.id then
			RemotoAviso:FireClient(jugador, datos)
		end
	end
end

-- Solo a los que ESTAN pisando la parcela ahora mismo, no al dueno este
-- donde este. Para un titulo del guion vale avisar al dueno aunque ande
-- fuera (es su historia); para algo que se VE en un sitio concreto, no:
-- quien no esta delante no puede ver nada, y mandarselo seria mandarle
-- una animacion de una carretilla que no tiene a la vista.
--
-- Y se manda con pcall: entre que se recorre la lista y se manda, a
-- alguien le puede haber dado por cerrar el juego.
local function aLosDeLaParcela(parcela, datos, cerca)
	for jugador, estado in pairs(estados) do
		local suyo = estado.parcela == parcela.id
		-- Y tambien a quien este AHI DELANTE aunque el modelo diga que no
		-- pisa la parcela. No es un parche: los montones donde se vacia
		-- estan fuera del borde, asi que el que se acerca contigo a
		-- verlo deja de contar como "en tu parcela" justo en el momento
		-- en que hay algo que ver. Las parcelas van a 360 studs unas de
		-- otras: por cercania no puede colarse nadie de otra.
		if not suyo and cerca then
			local pers = jugador.Character
			local raiz = pers and pers:FindFirstChild("HumanoidRootPart")
			if raiz and (raiz.Position - cerca).Magnitude <= A.descarga.miran then
				suyo = true
			end
		end
		if suyo and jugador.Parent then
			pcall(function()
				RemotoAviso:FireClient(jugador, datos)
			end)
		end
	end
end

local REACCION = {
	puerta = abrirPuerta,
	garaje = function(parcela)
		abrirGaraje(parcela)
		task.delay(1.1, function()
			pcall(soltarSopladora, parcela)
		end)
	end,
	-- El coche saluda con los faros. Dos segundos, y a seguir cavando.
	coche = function(parcela)
		local c = parcela.calle
		for _, f in ipairs(c.faros) do
			encender(f.luz, 2.6, 0.3)
			f.pieza.Material = Enum.Material.Neon
		end
		pcall(function()
			c.pitido:Play()
		end)
		task.delay(2.4, function()
			for _, f in ipairs(c.faros) do
				f.luz.Enabled = false
				f.luz.Brightness = 0
				f.pieza.Material = Enum.Material.SmoothPlastic
			end
		end)
	end,
	parada = function(parcela)
		local p = parcela.calle.parada
		p.pieza.Material = Enum.Material.Neon
		encender(p.luz, 2.2, 1.5)
	end,
	carretera = abrirCarretera,
	vecino = function(parcela)
		rescatarVecino(parcela)
		task.delay(2.2, function()
			pcall(soltarQuitanieves, parcela)
		end)
	end,
	plaza = function(parcela)
		encender(parcela.calle.luzCartel, 2.4, 2)
		-- Y aqui empieza lo siguiente: unos segundos de calma, y despues
		-- se enciende la radio y se pone a nevar otra vez.
		quizaEmpezarTormenta()
	end,
}

local function aplicarEnSeco(parcela, mundoGuardado)
	if mundoGuardado.puerta then
		abrirPuerta(parcela, true)
	end
	if mundoGuardado.garaje then
		abrirGaraje(parcela, true)
		soltarSopladora(parcela)
	end
	if mundoGuardado.farolas then
		abrirCarretera(parcela, true)
	end
	if mundoGuardado.vecinoFuera then
		rescatarVecino(parcela, true)
	end
	if mundoGuardado.quitanieves then
		soltarQuitanieves(parcela, true)
	end
end

local function estadoDelMundo(parcela)
	local m = parcela.casa
	return {
		puerta = m.puertaAbierta == true,
		garaje = m.garajeAbierto == true,
		farolas = parcela.calle.encendida == true,
		vecinoFuera = parcela.vecino.abierta == true,
		quitanieves = parcela.maquina ~= nil,
	}
end

-- Que trozos de parcela quedan intocables para las tormentas en cuanto se
-- descubren. Las calles y la plaza NO estan aqui a proposito: son
-- justamente lo que la tormenta vuelve a tapar. Lo que si esta es todo lo
-- que costo encontrar.
function zonasProtegidas(parcela)
	local m = parcela.casa
	local v = parcela.vecino
	local c = parcela.calle
	return {
		buzon = { c.buzonCx - 1, c.buzonCz - 1, c.buzonCx + 1, c.buzonCz + 1 },
		puerta = { m.cxCentro - 2, m.cz1 + 1, m.cxCentro + 2, m.cz1 + 4 },
		garaje = { m.garajeCx - 3, m.cz1 + 1, m.garajeCx + 3, m.cz1 + 3 },
		coche = { c.cocheCx - 2, c.cocheCz - 2, c.cocheCx + 2, c.cocheCz + 2 },
		vecino = { v.cxCentro - 4, v.cz0 - 7, v.cxCentro + 4, v.cz0 - 1 },
	}
end

function protegerLoDescubierto(parcela)
	local zonas = zonasProtegidas(parcela)
	for clave, si in pairs(parcela.hallazgos) do
		local z = si and zonas[clave]
		if z then
			parcela:proteger(z[1], z[2], z[3], z[4])
		end
	end
end

local function avanzarCapitulo(parcela)
	local hechos = parcela.hallazgos
	local cumplido = {
		puerta = hechos.puerta,
		garaje = hechos.garaje,
		sopladora = parcela.sopladoraCogida,
		carretera = hechos.carretera,
		vecino = hechos.vecino,
		quitanieves = parcela.quitanievesCogido,
		plaza = hechos.plaza,
		fin = false,
	}
	local movido = false
	while parcela.capitulo < #A.capitulos do
		local cap = A.capitulos[parcela.capitulo]
		if not cumplido[cap.clave] then
			break
		end
		parcela.capitulo = parcela.capitulo + 1
		movido = true
	end
	if movido then
		local cap = A.capitulos[parcela.capitulo]
		aTodos(parcela, { tipo = "capitulo", clave = cap.clave, indice = parcela.capitulo })
	end
end

function revisarHallazgos(parcela)
	local m = parcela.casa
	local v = parcela.vecino
	local c = parcela.calle
	if not (m and v and c) then
		return
	end
	local S = A.sitio

	-- Todo lo de la casa se mide en la MISMA linea de vision: lo que hay
	-- delante de la puerta, que es desde donde mira el jugador. Asi los
	-- avisos salen en orden de altura y cada uno cuando esa pieza asoma.
	local fachada = parcela:alturaMaximaEn(m.cxCentro - 1, m.cz1 + 1, m.cxCentro + 1, m.cz1 + 3)
	-- El buzon ocupa una casilla: se mide su casilla, ni una mas.
	local buzon = parcela:alturaMaximaEn(c.buzonCx, c.buzonCz - 1, c.buzonCx, c.buzonCz + 1)
	local coche = parcela:alturaMaximaEn(c.cocheCx - 1, c.cocheCz - 1, c.cocheCx + 1, c.cocheCz + 1)
	local garaje = parcela:alturaMaximaEn(m.garajeCx - 2, m.cz1 + 1, m.garajeCx + 2, m.cz1 + 3)
	local entrada = parcela:alturaMaximaEn(m.garajeCx - 4, m.cz1 + 1, m.garajeCx + 4, S.czCarretera + 1)
	-- La parada del autobus asoma cuando la maquina limpia la calzada
	-- delante: es lo que pasa a mitad de camino a la plaza, para que
	-- abrir la calle no sean seis minutos sin nada.
	local buzonVecino = parcela:alturaMaximaEn(
		c.buzonVecinoCx - 1, c.buzonVecinoCz,
		c.buzonVecinoCx + 1, c.buzonVecinoCz + 1
	)
	local parada = parcela:alturaMaximaEn(
		A.sitio.cxParada - 2, A.sitio.czCarretera - 1,
		A.sitio.cxParada + 2, A.sitio.czCarretera + 1
	)
	local puertaVecino = parcela:alturaMaximaEn(v.cxCentro - 4, v.cz0 - 7, v.cxCentro + 4, v.cz0 - 1)

	-- La calle no se "ve": se ABRE. No basta con hacer un boquete encima
	-- del asfalto: hay que dejar pasable la entrada entera desde el
	-- garaje, y despues romper el ultimo colchon con la pala, que es lo
	-- que la descubre.
	local corredor = parcela:capasEncima(m.garajeCx - 5, m.cz1 + 1, m.garajeCx + 5, S.czCarretera - 1)
	local asfalto = parcela:capasEncima(m.garajeCx - 4, S.czCarretera - 1, m.garajeCx + 4, S.czCarretera + 1)
	local hastaElAsfalto = asfalto == 0 and corredor <= S.capasEntradaPasable

	-- Y la plaza tampoco: hay que abrir la calle ENTERA hasta alli, que es
	-- lo que hace el quitanieves y no puede hacer nada mas.
	-- Desde donde el quitanieves puede empezar: el muro de tu entrada no
	-- lo rompe la maquina, asi que pedirlo seria pedir un imposible.
	local calleALaPlaza = parcela:capasEncima(
		m.garajeCx + 16, S.czCarretera - 2,
		S.cxPlaza, S.czCarretera + 2
	)
	local enLaPlaza = parcela:capasEncima(
		S.cxPlaza - 2, S.czCarretera - 1,
		S.cxPlaza + 2, S.czCarretera + 1
	)
	local plazaAbierta = enLaPlaza == 0 and calleALaPlaza <= S.capasCalleAbierta

	local visible = {
		buzon = buzon < c.alturaBuzon,
		tejado = fachada < m.alturaTejado,
		porche = fachada < m.alturaPorche,
		ventana = fachada < m.alturaVentana,
		puerta = fachada < 0.5,
		garaje = garaje < 0.5,
		coche = coche < c.alturaCoche,
		carretera = hastaElAsfalto,
		vecino = puertaVecino < 2.2,
		buzonVecino = buzonVecino < c.alturaBuzonVecino,
		parada = parada < 0.5,
		plaza = plazaAbierta,
	}

	-- LO QUE SE DESCUBRE QUEDA PROTEGIDO PARA SIEMPRE. Encima de estas
	-- casillas no vuelve a caer nieve de tormenta, pase lo que pase. Es
	-- la garantia que hace que un evento nunca deshaga lo conseguido:
	-- puede volver a nevar en la calle, pero no sobre tu puerta.
	--
	-- Las calles y la plaza NO se protegen, y es a proposito: son
	-- justamente lo que la tormenta vuelve a tapar.
	for _, def in ipairs(A.hallazgos) do
		if visible[def.clave] and not parcela.hallazgos[def.clave] then
			parcela.hallazgos[def.clave] = true
			local zona = zonasProtegidas(parcela)[def.clave]
			if zona then
				parcela:proteger(zona[1], zona[2], zona[3], zona[4])
			end
			aTodos(parcela, { tipo = "hallazgo", clave = def.clave, nombre = def.nombre })
			local reaccion = REACCION[def.clave]
			if reaccion then
				task.spawn(function()
					pcall(reaccion, parcela)
				end)
			end
		end
	end

	-- El numero grande del HUD: cuanta nieve queda sobre lo que se busca
	-- AHORA. Es la barra de progreso de verdad del capitulo.
	local capa = A.nieve.capa
	local porCapitulo = {
		puerta = fachada,
		garaje = garaje,
		sopladora = 0,
		carretera = entrada,
		vecino = puertaVecino,
		quitanieves = 0,
		plaza = math.max(calleALaPlaza, enLaPlaza) * capa,
	}
	local cap = A.capitulos[parcela.capitulo] or A.capitulos[1]
	parcela.capasObjetivo = math.ceil((porCapitulo[cap.clave] or 0) / capa)

	avanzarCapitulo(parcela)
end


-------------------------------------------------------------------
--  QUIEN VIVE EN CADA PARCELA
--
--  Al entrar se coge una libre y esa es la tuya. Los demas pueden entrar
--  a quitarte nieve — ayudar nunca es fastidiar — pero el guion, los
--  hallazgos y las herramientas son de quien vive ahi.
-------------------------------------------------------------------

function reiniciarPiezas(parcela)
	local m = parcela.casa
	local v = parcela.vecino
	local c = parcela.calle
	local guardado = parcela.cerrado

	m.puertaAbierta = false
	m.puerta.CFrame = guardado.puerta
	m.recibidor.Material = Enum.Material.SmoothPlastic
	m.recibidor.Color = Color3.fromRGB(22, 18, 14)
	m.luzRecibidor.Enabled = false
	m.luzRecibidor.Brightness = 0
	pcall(function()
		m.sonidoCasa:Stop()
		m.sonidoCasa.Volume = 0
	end)
	m.humo.Enabled = false

	m.garajeAbierto = false
	m.puertaGaraje.Size = guardado.garajeSize
	m.puertaGaraje.Position = guardado.garajePos
	for _, r in ipairs(m.ranurasGaraje) do
		r.Transparency = 0
	end
	m.luzGaraje.Enabled = false
	m.luzGaraje.Brightness = 0

	c.encendida = false
	for _, f in ipairs(c.farolas) do
		f.pieza.Material = Enum.Material.SmoothPlastic
		f.pieza.Color = Color3.fromRGB(120, 120, 126)
		f.luz.Enabled = false
		f.luz.Brightness = 0
	end
	c.luzSenal.Enabled = false
	c.luzSenal.Brightness = 0
	c.luzCartel.Enabled = false
	c.luzCartel.Brightness = 0

	v.abierta = false
	v.llamando = false
	v.puerta.CFrame = guardado.vecinoPuerta
	v.recibidor.Material = Enum.Material.SmoothPlastic
	v.recibidor.Color = Color3.fromRGB(20, 18, 16)
	v.luzRecibidor.Enabled = false
	v.luzRecibidor.Brightness = 0
	v.humo.Enabled = false
	v.silueta.Transparency = 1
	for _, cr in ipairs(v.cristales) do
		cr.pieza.Material = Enum.Material.SmoothPlastic
		cr.pieza.Color = Color3.fromRGB(46, 48, 56)
		cr.luz.Enabled = false
		cr.luz.Brightness = 0
	end
	v.luzLlaves.Enabled = false
	v.luzLlaves.Brightness = 0
	pcall(function()
		v.sonido:Stop()
		v.sonido.Volume = 0
	end)
	-- La persona vuelve dentro y desaparece.
	for pieza, donde in pairs(parcela.cerrado.persona) do
		pieza.CFrame = donde
		pieza.Transparency = 1
	end

	-- Todo lo de la tormenta se va con la parcela: es del servidor, no del
	-- jugador, y no puede quedarse pegado al siguiente que entre.
	parcela.tormenta = nil
	parcela.conBaliza = false
	parcela.arbol.ver(false)
	parcela.camion.ver(false)
	parcela:derretirTormenta()
	local a = parcela.ayuntamiento
	a.abierto = false
	a.puerta.CFrame = parcela.cerrado.aytoPuerta
	a.recibidor.Material = Enum.Material.SmoothPlastic
	a.recibidor.Color = Color3.fromRGB(20, 20, 22)
	a.luz.Enabled = false
	a.luz.Brightness = 0
	a.luzReloj.Enabled = false
	a.luzReloj.Brightness = 0
	a.reloj.Material = Enum.Material.SmoothPlastic

	if parcela.sopladoraSuelta then
		parcela.sopladoraSuelta:Destroy()
	end
	parcela.sopladoraSuelta = nil
	parcela.sopladoraCuerpo = nil
	parcela.sopladoraCogida = false
	if parcela.maquina then
		parcela.maquina.grupo:Destroy()
	end
	parcela.maquina = nil
	parcela.quitanievesCogido = false

	for _, mon in ipairs(parcela.descargas) do
		mon.echado = 0
		mon.bola.Size = Vector3.new(12, 12, 12)
		mon.bola.Position = Vector3.new(mon.sitio.X, 2, mon.sitio.Z)
	end
	for _, bola in ipairs(parcela.montoncitos or {}) do
		bola:Destroy()
	end
	parcela.montoncitos = {}

	parcela.hallazgos = {}
	parcela.capitulo = 1
	parcela.capasObjetivo = 0
end

local function rehacerNieve(parcela, texto)
	parcela:desnevar()
	parcela:generar(parcela.perfil)
	Mundo.monticuloDelBuzon(parcela)
	local cargada = false
	if texto then
		cargada = parcela:descomprimir(texto)
		if not cargada then
			warn("[kali] la nieve guardada no encaja con este mundo: se rehace la nevada")
		end
	end
	parcela:nevar()
	parcela.tocada = false
	return cargada
end

function montarParcela(parcela, jugador, datos)
	parcela.dueno = jugador
	parcela.duenoNombre = jugador.Name
	parcela.cartelDueno.Text = jugador.Name
	parcela.salida.Enabled = true
	pcall(function()
		jugador.RespawnLocation = parcela.salida
	end)

	reiniciarPiezas(parcela)
	rehacerNieve(parcela, datos.nieve)

	for clave, si in pairs(datos.hallazgos) do
		parcela.hallazgos[clave] = si == true
	end
	local _, indice = A.capitulo(datos.capitulo)
	parcela.capitulo = indice
	-- Lo que ya estaba descubierto vuelve a quedar protegido: si no, la
	-- primera tormenta despues de cargar partida podria nevar encima.
	protegerLoDescubierto(parcela)
	parcela.sopladoraCogida = datos.herramientas.sopladora == true
	parcela.quitanievesCogido = datos.herramientas.quitanieves == true
	aplicarEnSeco(parcela, datos.mundo)
	-- Las recompensas de tormentas anteriores tambien vuelven: la baliza
	-- del quitanieves y el ayuntamiento abierto.
	if datos.recompensas.baliza then
		parcela.conBaliza = true
		ponerBaliza(parcela)
	end
	if datos.recompensas.ayuntamiento then
		abrirAyuntamiento(parcela, true)
	end
	-- La sopladora que ya se cogio no vuelve a estar tirada en el garaje.
	if parcela.sopladoraCogida and parcela.sopladoraSuelta then
		parcela.sopladoraSuelta:Destroy()
		parcela.sopladoraSuelta = nil
		parcela.sopladoraCuerpo = nil
	end
	revisarHallazgos(parcela)
end

local function liberarParcela(parcela)
	if not parcela.dueno then
		return
	end
	parcela.dueno = nil
	parcela.duenoNombre = nil
	parcela.cartelDueno.Text = "LIBRE"
	parcela.salida.Enabled = false
	reiniciarPiezas(parcela)
	rehacerNieve(parcela, nil)
end

local function parcelaLibre()
	for _, p in ipairs(parcelas) do
		if not p.dueno then
			return p
		end
	end
	return nil
end


-------------------------------------------------------------------
--  LAS HERRAMIENTAS EN LA MANO
-------------------------------------------------------------------

local PALA_REPOSO = CFrame.new(0, -0.6, -0.5) * CFrame.Angles(math.rad(20), 0, 0)
local PALA_GOLPE = CFrame.new(0, -1.1, -1.4) * CFrame.Angles(math.rad(78), 0, 0)
local SOPLA_REPOSO = CFrame.new(0.3, -2.3, -3.2) * CFrame.Angles(math.rad(-6), 0, 0)
local SOPLA_EMPUJE = CFrame.new(0.3, -2.45, -3.7) * CFrame.Angles(math.rad(-11), 0, 0)

local function manoDe(pers)
	local brazo = pers:FindFirstChild("RightHand") or pers:FindFirstChild("Right Arm")
	if brazo then
		return brazo
	end
	local humano = pers:FindFirstChildOfClass("Humanoid")
	local esR15 = humano ~= nil and humano.RigType == Enum.HumanoidRigType.R15
	return pers:WaitForChild(esR15 and "RightHand" or "Right Arm", 8)
end

local function polvoEn(padre, ancho)
	local punto = Instance.new("Attachment")
	punto.Name = "Polvo"
	punto.Parent = padre
	local e = Instance.new("ParticleEmitter")
	e.Texture = "rbxasset://textures/particles/smoke_main.dds"
	e.Color = ColorSequence.new(Color3.fromRGB(255, 255, 255))
	e.Size = NumberSequence.new(2.2)
	e.Transparency = NumberSequence.new({
		NumberSequenceKeypoint.new(0, 0.05),
		NumberSequenceKeypoint.new(1, 1),
	})
	e.Lifetime = NumberRange.new(0.4, 0.9)
	e.Speed = NumberRange.new(8, 16)
	e.SpreadAngle = Vector2.new(ancho, ancho)
	e.Acceleration = Vector3.new(0, -22, 0)
	e.Rate = 0
	e.Enabled = false
	e.Parent = punto
	return e
end

-- LO QUE LLEVAS EN LA CARRETILLA, DICHO EN UN ATRIBUTO. La carretilla la
-- dibuja el cliente (ver Cliente.client.luau): asi va suelta detras de
-- ti con su retraso, la rueda gira y se inclina al vaciar, sin que nada
-- de eso cueste red ni pueda atascarse con la fisica. El servidor solo
-- publica cuanto llevas, de cero a uno, y eso se replica solo a todo el
-- mundo: por eso se ve tambien la carretilla del que viene a ayudarte.
local function verLaCarga(jugador, estado)
	local pers = jugador and jugador.Character
	if not pers then
		return
	end
	local parte = math.clamp((estado.carga or 0) / A.jugador.capacidad, 0, 1)
	pcall(function()
		pers:SetAttribute("Carga", parte)
		pers:SetAttribute("LlevaPala", estado.herramienta == "pala" and not estado.conduciendo)
	end)
end

function darHerramienta(jugador, pers, estado)
	for _, nombre in ipairs({ "Pala", "Sopladora" }) do
		local vieja = pers:FindFirstChild(nombre)
		if vieja then
			vieja:Destroy()
		end
	end
	estado.motor = nil
	estado.emisor = nil
	estado.chorro = nil
	estado.ruido = nil
	estado.golpeSonido = nil
	estado.destello = nil
	estado.luzGolpe = nil
	verLaCarga(jugador, estado)
	-- Al volante no se lleva nada en la mano.
	if estado.conduciendo then
		return
	end
	local brazo = manoDe(pers)
	if not brazo then
		return
	end

	if estado.herramienta == "sopladora" then
		local grupo, cuerpo, salida, armar = piezasSopladora(pers, 0.72, "Sopladora")
		cuerpo.CFrame = brazo.CFrame * SOPLA_REPOSO
		armar()
		for _, p in ipairs(grupo:GetChildren()) do
			if p:IsA("BasePart") then
				p.Anchored = false
				if p ~= cuerpo then
					local u = Instance.new("WeldConstraint")
					u.Part0 = cuerpo
					u.Part1 = p
					u.Parent = p
				end
			end
		end
		-- Motor6D y no soldadura: es lo unico que se puede animar.
		local motor = Instance.new("Motor6D")
		motor.Name = "Empunadura"
		motor.Part0 = brazo
		motor.Part1 = cuerpo
		motor.C0 = SOPLA_REPOSO
		motor.Parent = brazo

		local punto = Instance.new("Attachment")
		punto.Name = "Chorro"
		punto.Parent = salida
		local e = Instance.new("ParticleEmitter")
		e.Texture = "rbxasset://textures/particles/smoke_main.dds"
		e.Color = ColorSequence.new(Color3.fromRGB(252, 254, 255))
		e.Size = NumberSequence.new({
			NumberSequenceKeypoint.new(0, 1),
			NumberSequenceKeypoint.new(1, 3.6),
		})
		e.Transparency = NumberSequence.new({
			NumberSequenceKeypoint.new(0, 0.02),
			NumberSequenceKeypoint.new(0.7, 0.3),
			NumberSequenceKeypoint.new(1, 1),
		})
		e.Lifetime = NumberRange.new(0.8, 1.3)
		e.Speed = NumberRange.new(46, 62)
		e.SpreadAngle = Vector2.new(9, 9)
		e.Acceleration = Vector3.new(0, -78, 0)
		e.EmissionDirection = Enum.NormalId.Top
		e.Rate = 0
		e.Enabled = false
		e.Parent = punto

		estado.motor = motor
		estado.chorro = e
		estado.ruido = sonidoDe(cuerpo, "Motor", "rbxasset://sounds/action_falling.mp3", 0, 1.45, true)
		pcall(function()
			estado.ruido:Play()
		end)
		grupo.Parent = pers
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
	mango.CFrame = brazo.CFrame * PALA_REPOSO
	local hoja = trozo("Hoja", Vector3.new(2.4, 0.24, 2.2), Color3.fromRGB(210, 224, 240), Enum.Material.Metal)
	hoja.CFrame = mango.CFrame * CFrame.new(0, -2.3, -0.6)
	local union = Instance.new("WeldConstraint")
	union.Part0 = mango
	union.Part1 = hoja
	union.Parent = hoja

	local motor = Instance.new("Motor6D")
	motor.Name = "Empunadura"
	motor.Part0 = brazo
	motor.Part1 = mango
	motor.C0 = PALA_REPOSO
	motor.Parent = brazo

	estado.motor = motor
	estado.emisor = polvoEn(hoja, 50)

	-- EL GOLPE SE OYE Y SE VE, y no siempre igual: el volumen y el tono
	-- suben con lo que se ha conseguido, y la cucharada completa ademas
	-- destella en dorado. Es la unica forma de que se aprenda donde poner
	-- la siguiente palada sin llenar la pantalla de numeros.
	estado.golpeSonido = sonidoDe(hoja, "Golpe", "rbxasset://sounds/action_jump_land.mp3", 0.3, 1, false)
	local puntoOro = Instance.new("Attachment")
	puntoOro.Name = "Cucharada"
	puntoOro.Parent = hoja
	local oro = Instance.new("ParticleEmitter")
	oro.Texture = "rbxasset://textures/particles/sparkles_main.dds"
	oro.Color = ColorSequence.new(Color3.fromRGB(255, 214, 122))
	oro.Size = NumberSequence.new({
		NumberSequenceKeypoint.new(0, 1.1),
		NumberSequenceKeypoint.new(1, 0),
	})
	oro.Transparency = NumberSequence.new({
		NumberSequenceKeypoint.new(0, 0.15),
		NumberSequenceKeypoint.new(1, 1),
	})
	oro.Lifetime = NumberRange.new(0.3, 0.55)
	oro.Speed = NumberRange.new(10, 20)
	oro.SpreadAngle = Vector2.new(40, 40)
	oro.Acceleration = Vector3.new(0, -30, 0)
	oro.Rate = 0
	oro.Enabled = false
	oro.Parent = puntoOro
	estado.destello = oro

	local luz = Instance.new("PointLight")
	luz.Name = "Cucharada"
	luz.Color = Color3.fromRGB(255, 206, 110)
	luz.Brightness = 2.4
	luz.Range = 12
	luz.Enabled = false
	luz.Parent = hoja
	estado.luzGolpe = luz

	grupo.Parent = pers
end

-- La pala baja de verdad y salta la nieve. Solo se llama cuando la
-- palada HA QUITADO algo: animar contra el suelo pelado es mentir.
--
-- Y cada palada dice CUANTO ha conseguido, sin numeros en pantalla: una
-- palada floja hace poco ruido y poca nieve, una buena pega mas fuerte,
-- y una completa revienta en nieve con un destello dorado. Asi se
-- aprende mirando donde conviene poner la siguiente.
--
-- La bajada es casi instantanea a proposito (cuarenta milisegundos). La
-- nieve se quita en el momento del golpe, no despues: si la hoja tardara
-- en llegar, la nieve desapareceria antes de que la tocara.
local function animarPala(estado, hechas, tope)
	if not estado.motor then
		return
	end
	local parte = math.clamp((hechas or 1) / math.max(1, tope or 1), 0, 1)
	local llena = (hechas or 0) >= (tope or 1)
	pcall(function()
		Tweens:Create(estado.motor, TweenInfo.new(0.04, Enum.EasingStyle.Quad, Enum.EasingDirection.In), {
			C0 = PALA_GOLPE,
		}):Play()
	end)
	task.delay(0.05, function()
		if estado.emisor then
			pcall(function()
				estado.emisor:Emit(6 + math.floor(parte * 26))
			end)
		end
		if estado.golpeSonido then
			pcall(function()
				estado.golpeSonido.Volume = 0.16 + parte * 0.42
				estado.golpeSonido.PlaybackSpeed = 0.82 + parte * 0.5
				estado.golpeSonido.TimePosition = 0
				estado.golpeSonido:Play()
			end)
		end
		-- La cucharada llena: destello dorado y un puñado mas de nieve.
		if llena then
			if estado.destello then
				pcall(function()
					estado.destello:Emit(14)
				end)
			end
			if estado.luzGolpe then
				pcall(function()
					estado.luzGolpe.Enabled = true
				end)
				task.delay(0.16, function()
					if estado.luzGolpe then
						pcall(function()
							estado.luzGolpe.Enabled = false
						end)
					end
				end)
			end
		end
		if estado.motor then
			pcall(function()
				Tweens:Create(estado.motor, TweenInfo.new(0.26, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), {
					C0 = PALA_REPOSO,
				}):Play()
			end)
		end
	end)
end

local function animarSopladora(estado)
	if not estado.motor then
		return
	end
	pcall(function()
		Tweens:Create(estado.motor, TweenInfo.new(0.1), { C0 = SOPLA_EMPUJE }):Play()
	end)
	if estado.chorro then
		pcall(function()
			estado.chorro:Emit(26)
		end)
	end
	task.delay(0.12, function()
		if estado.motor then
			pcall(function()
				Tweens:Create(estado.motor, TweenInfo.new(0.16), { C0 = SOPLA_REPOSO }):Play()
			end)
		end
	end)
end


-------------------------------------------------------------------
--  EXCAVAR
--
--  Las tres comparten la regla de la pendiente. Se diferencian en QUE
--  casillas alcanzan, HASTA DONDE bajan y DONDE pueden trabajar.
-------------------------------------------------------------------

local function amontonar(parcela, sitio, tamano, tope)
	-- Encima del sitio de vaciar no se amontona nada. Un monton de los
	-- que hace la sopladora no puede acabar tapando el punto de descarga:
	-- si eso pasara, la partida se quedaria sin sitio donde vaciar la
	-- carretilla y no habria forma de arreglarlo desde dentro del juego.
	for _, m in ipairs(parcela.descargas) do
		if (Vector3.new(sitio.X, 0, sitio.Z) - m.sitio).Magnitude <= A.descarga.libre then
			return
		end
	end
	parcela.montoncitos = parcela.montoncitos or {}
	for _, mon in ipairs(parcela.montoncitos) do
		if (mon.Position - sitio).Magnitude < tamano * 2.2 then
			local nuevo = math.min(tope, mon.Size.X + 0.55)
			mon.Size = Vector3.new(nuevo, nuevo, nuevo)
			mon.Position = Vector3.new(mon.Position.X, sitio.Y + nuevo * 0.18, mon.Position.Z)
			return
		end
	end
	if #parcela.montoncitos >= 120 then
		return
	end
	parcela.montoncitos[#parcela.montoncitos + 1] = parte({
		Name = "Montoncito",
		Shape = Enum.PartType.Ball,
		Size = Vector3.new(tamano, tamano, tamano),
		Position = sitio + Vector3.new(0, tamano * 0.18, 0),
		Color = NIEVE,
		Material = Enum.Material.Snow,
		CastShadow = true,
	}, parcela.carpeta)
end

-- DONDE MUERDE LA PALA: UN ABANICO POR DELANTE. Ni un circulo alrededor
-- de los pies (la nieve desaparecia sola por estar cerca) ni un disco de
-- dieciocho studs (una pala no muerde una piscina). Lo que barre una
-- pala: de "cerca" a "lejos", abriendo "angulo" a cada lado de donde
-- miras. El cliente pinta este mismo abanico con estas mismas tres
-- medidas: si la marca y el mordisco no coinciden, la marca miente.
local function enElAbanico(dx, dz, mirada, def)
	local dist2 = dx * dx + dz * dz
	if dist2 > def.lejos * def.lejos or dist2 < def.cerca * def.cerca then
		return false
	end
	local dist = math.sqrt(dist2)
	if dist < 0.001 then
		return false
	end
	-- Coseno del angulo entre "hacia donde miro" y "hacia donde esta la
	-- casilla". Con esto, lo que queda detras no entra JAMAS, ni pegado.
	local haciaDelante = (dx * mirada.X + dz * mirada.Z) / dist
	return haciaDelante >= math.cos(math.rad(def.angulo))
end

local function excavarPala(parcela, pos, def, tope, mirada)
	local cxMin, czMin = parcela:aCasilla(pos.X - def.lejos, pos.Z - def.lejos)
	local cxMax, czMax = parcela:aCasilla(pos.X + def.lejos, pos.Z + def.lejos)

	-- Se recogen las casillas del abanico y se atacan DE MAS ALTA A MAS
	-- BAJA: una cuchara mueve una cucharada, no tres casillas sueltas.
	local candidatas = {}
	local habiaNieve = false
	for cx = cxMin, cxMax do
		for cz = czMin, czMax do
			local x, z = parcela:centro(cx, cz)
			if enElAbanico(x - pos.X, z - pos.Z, mirada, def) then
				local c = parcela:casilla(cx, cz)
				if c and not c.muro and c.restante + c.tormenta > 0 then
					habiaNieve = true
					candidatas[#candidatas + 1] = { cx = cx, cz = cz, alto = c.restante + c.tormenta }
				end
			end
		end
	end
	table.sort(candidatas, function(a, b)
		return a.alto > b.alto
	end)

	local hechas = 0
	for _, casilla in ipairs(candidatas) do
		if hechas >= tope then
			break
		end
		if parcela:excavar(casilla.cx, casilla.cz, def.dejaCapas, def.dejaTormenta) then
			hechas = hechas + 1
		end
	end
	return hechas, habiaNieve, false
end

local function excavarSopladora(parcela, pos, mirada, derecha, def, tope)
	local alcance = def.fondo
	if def.ancho / 2 > alcance then
		alcance = def.ancho / 2
	end
	alcance = alcance + CELDA
	local cxMin, czMin = parcela:aCasilla(pos.X - alcance, pos.Z - alcance)
	local cxMax, czMax = parcela:aCasilla(pos.X + alcance, pos.Z + alcance)

	local candidatas = {}
	local habiaNieve = false
	local soloFondo = false
	for cx = cxMin, cxMax do
		for cz = czMin, czMax do
			local x, z = parcela:centro(cx, cz)
			local dx, dz = x - pos.X, z - pos.Z
			-- Franja RECTANGULAR delante: la boca de la maquina.
			local delante = dx * mirada.X + dz * mirada.Z
			local lado = dx * derecha.X + dz * derecha.Z
			if delante >= -CELDA and delante <= def.fondo and math.abs(lado) <= def.ancho / 2 then
				local c = parcela:casilla(cx, cz)
				if c and not c.muro and c.restante + c.tormenta > 0 then
					habiaNieve = true
					-- La maquina deja colchon en las dos nieves: en la
					-- historica y en la de tormenta. Por eso el ultimo
					-- dedo de nieve de una puerta sigue siendo de pala.
					if c.tormenta > def.dejaTormenta or (c.tormenta == 0 and c.restante > def.dejaCapas) then
						candidatas[#candidatas + 1] = { cx = cx, cz = cz, alto = c.restante + c.tormenta }
					else
						-- Queda nieve, pero es el colchon que la maquina no
						-- raspa. Eso es trabajo de pala, y hay que decirlo.
						soloFondo = true
					end
				end
			end
		end
	end
	table.sort(candidatas, function(a, b)
		return a.alto > b.alto
	end)

	local hechas = 0
	for _, casilla in ipairs(candidatas) do
		if hechas >= tope then
			break
		end
		if parcela:excavar(casilla.cx, casilla.cz, def.dejaCapas, def.dejaTormenta) then
			hechas = hechas + 1
		end
	end
	return hechas, habiaNieve, (hechas == 0 and soloFondo)
end

-- Devuelve cuantas casillas ha quitado la pasada. Cero significa que no
-- ha pasado nada, y entonces no hay ni animacion ni particulas.
local function excavarPara(jugador, estado, pos, raiz)
	estado.soloPala = false
	if pos.Y > A.jugador.alturaMaxima then
		estado.bloqueado = false
		return 0
	end
	local parcela = parcelaEn(pos.X, pos.Z)
	if not parcela then
		estado.bloqueado = false
		return 0
	end

	local def = A.herramientas[estado.herramienta] or A.herramientas.pala
	local esSopladora = estado.herramienta == "sopladora"

	-- La carretilla solo la llena la pala. La sopladora escupe la nieve a
	-- un lado, y por eso con ella no hay viajes.
	local tope = def.potencia
	if not esSopladora then
		local hueco = A.jugador.capacidad - estado.carga
		if hueco <= 0 then
			estado.bloqueado = false
			return 0
		end
		tope = math.min(tope, hueco)
	end

	-- Hacia donde miras. Lo usan las dos herramientas de mano: la
	-- sopladora para empujar y la pala para saber donde clavarla.
	local frente = raiz and raiz.CFrame.LookVector or Vector3.new(0, 0, 1)
	local mirada = Vector3.new(frente.X, 0, frente.Z)
	if mirada.Magnitude < 0.05 then
		mirada = Vector3.new(0, 0, 1)
	end
	mirada = mirada.Unit

	local hechas, habiaNieve, soloFondo
	if esSopladora then
		local derecha = Vector3.new(-mirada.Z, 0, mirada.X)
		hechas, habiaNieve, soloFondo = excavarSopladora(parcela, pos, mirada, derecha, def, tope)
		if hechas > 0 then
			local x = pos.X + derecha.X * def.desvio
			local z = pos.Z + derecha.Z * def.desvio
			local cx, cz = parcela:aCasilla(x, z)
			amontonar(parcela, Vector3.new(x, parcela:alturaEn(cx, cz), z), 5, 15)
		end
	else
		hechas, habiaNieve, soloFondo = excavarPala(parcela, pos, def, tope, mirada)
	end

	estado.soloPala = soloFondo == true
	estado.bloqueado = (hechas == 0 and habiaNieve and not estado.soloPala)
	estado.bloqueadoEn = estado.bloqueado and Vector3.new(pos.X, 0, pos.Z) or nil

	if hechas > 0 then
		parcela.tocada = true
		if esSopladora then
			estado.dinero = estado.dinero + hechas * A.dinero.porCapa
			estado.nieveTotal = estado.nieveTotal + hechas
		else
			estado.carga = estado.carga + hechas
			verLaCarga(jugador, estado)
		end
		revisarHallazgos(parcela)
	end
	return hechas
end

local function descargarPara(jugador, estado, pos)
	if estado.carga <= 0 then
		return
	end
	local parcela = parcelas[estado.parcela] or parcelas[estado.mia]
	if not parcela then
		return
	end
	local plano = Vector3.new(pos.X, 0, pos.Z)
	local elegido = nil
	for _, m in ipairs(parcela.descargas) do
		if (plano - m.sitio).Magnitude <= A.jugador.radioDescarga then
			elegido = m
			break
		end
	end
	if not elegido then
		return
	end

	local capas = estado.carga
	local ganado = capas * A.dinero.porCapa
	estado.dinero = estado.dinero + ganado
	estado.nieveTotal = estado.nieveTotal + capas
	elegido.echado = elegido.echado + capas
	estado.carga = 0
	verLaCarga(jugador, estado)

	-- El monton crece con lo que se le echa: es el marcador de verdad.
	-- Pero crece HACIA AFUERA. La cara de dentro se queda clavada a
	-- A.descarga.libre del centro del punto, mida lo que mida la bola, y
	-- ese numero es mayor que el radio en el que se puede vaciar. Asi el
	-- monton no puede taparse a si mismo el sitio por muy grande que se
	-- ponga.
	if elegido.bola then
		local D = A.descarga
		local crecido = math.clamp(
			D.tamanoMinimo + elegido.echado / D.porCapa,
			D.tamanoMinimo,
			D.tamanoMaximo
		)
		elegido.bola.Size = Vector3.new(crecido, crecido, crecido)
		local fuera = elegido.fuera or Vector3.new(-1, 0, 0)
		local centro = elegido.sitio + fuera * (D.libre + crecido / 2)
		elegido.bola.Position = Vector3.new(centro.X, crecido * 0.18, centro.Z)
	end

	-- UN SOLO AVISO, Y A TODOS LOS QUE ESTEN EN LA PARCELA. Antes iba
	-- solo a quien vaciaba: el que estaba al lado echando una mano veia
	-- crecer el monton y subir el dinero, pero no veia volcarse la
	-- carretilla, que es lo unico que explica de donde ha salido esa
	-- nieve. Va uno solo (no uno personal mas otro para el resto) para
	-- que quien vacia no vea la animacion dos veces.
	--
	-- Lleva QUIEN vacia, DONDE y CUANTA nieve: con eso el cliente sabe
	-- a que carretilla inclinar y hacia donde tirar la nieve, y quien lo
	-- recibe sabe si el "+dinero" es suyo o de otro.
	aLosDeLaParcela(parcela, {
		tipo = "descarga",
		quien = jugador,
		capas = capas,
		cantidad = ganado,
		donde = elegido.sitio,
		monton = elegido.bola and elegido.bola.Position or elegido.sitio,
	}, elegido.sitio)
end


-------------------------------------------------------------------
--  CONDUCIR EL QUITANIEVES
--
--  Va anclado y lo mueve el servidor. Antes de dar cada paso se mira si
--  la casilla de destino se puede pisar; si no, se queda donde esta. Por
--  eso no puede meterse dentro de una casa, ni hundirse en un
--  ventisquero, ni volcar: lo que manda no es la fisica, es el modelo.
-------------------------------------------------------------------

local function haciaDonde(giro)
	-- Igual que el LookVector de CFrame.Angles(0, giro, 0): en Roblox el
	-- frente de un marco es -Z. Se calcula a mano para que la maquina
	-- ande igual dentro y fuera del juego.
	return Vector3.new(-math.sin(giro), 0, -math.cos(giro))
end

local function puedePasar(punto, dir, def)
	local derecha = Vector3.new(-dir.Z, 0, dir.X)
	local puntos = {
		punto,
		punto + dir * 7,
		punto + dir * 7 + derecha * 3.5,
		punto + dir * 7 - derecha * 3.5,
	}
	for _, p in ipairs(puntos) do
		local parcela = parcelaEn(p.X, p.Z)
		if not parcela then
			return false
		end
		local cx, cz = parcela:aCasilla(p.X, p.Z)
		-- Solo calle. No es solo que no pueda LIMPIAR el jardin: es que no
		-- puede meterse en el. Un quitanieves municipal no cruza el cesped
		-- de nadie, y asi tampoco puede acabar encajado donde no debe.
		if not parcela:esCalle(cx, cz) then
			return false
		end
		if not parcela:pisable(cx, cz, def.capasMaximas) then
			return false
		end
	end
	return true
end

local function limpiarConLaCuchilla(parcela, punto, dir, def)
	local derecha = Vector3.new(-dir.Z, 0, dir.X)
	local alcance = def.ancho / 2 + CELDA
	local cxMin, czMin = parcela:aCasilla(punto.X - alcance, punto.Z - alcance)
	local cxMax, czMax = parcela:aCasilla(punto.X + alcance, punto.Z + alcance)

	local candidatas = {}
	for cx = cxMin, cxMax do
		for cz = czMin, czMax do
			local x, z = parcela:centro(cx, cz)
			local dx, dz = x - punto.X, z - punto.Z
			local delante = dx * dir.X + dz * dir.Z
			local lado = dx * derecha.X + dz * derecha.Z
			if delante >= -CELDA and delante <= def.fondo and math.abs(lado) <= def.ancho / 2 then
				local c = parcela:casilla(cx, cz)
				-- Solo calle, y solo donde la cuchilla llega. En el jardin
				-- no pinta nada, contra el muro de la entrada tampoco, y
				-- en las aceras menos: por eso hace falta la sopladora.
				local hay = c and (c.restante + c.tormenta) or 0
				if c and c.calle and not c.muro and hay > 0 and hay <= def.capasMaximas then
					candidatas[#candidatas + 1] = { cx = cx, cz = cz, alto = hay }
				end
			end
		end
	end
	table.sort(candidatas, function(a, b)
		return a.alto > b.alto
	end)

	local hechas = 0
	for _, casilla in ipairs(candidatas) do
		if hechas >= def.potencia then
			break
		end
		if parcela:excavar(casilla.cx, casilla.cz, def.dejaCapas, def.dejaTormenta) then
			hechas = hechas + 1
		end
	end
	return hechas
end

local function ticQuitanieves(parcela, dt)
	local q = parcela.maquina
	if not q then
		return
	end
	local def = A.herramientas.quitanieves
	local humano = q.asiento.Occupant
	local pers = humano and humano.Parent
	local jugador = pers and Jugadores:GetPlayerFromCharacter(pers)
	local estado = jugador and estados[jugador]

	if not humano then
		if q.chorro then
			q.chorro.Enabled = false
		end
		pcall(function()
			q.motor.Volume = 0.1
			q.motor.PlaybackSpeed = 0.8
		end)
		if q.quienConduce then
			local antiguo = estados[q.quienConduce]
			if antiguo then
				antiguo.conduciendo = false
				local suPers = q.quienConduce.Character
				if suPers then
					pcall(darHerramienta, q.quienConduce, suPers, antiguo)
				end
			end
			q.quienConduce = nil
		end
		return
	end

	if q.quienConduce ~= jugador then
		if q.quienConduce and estados[q.quienConduce] then
			estados[q.quienConduce].conduciendo = false
		end
		q.quienConduce = jugador
		if estado then
			estado.conduciendo = true
			-- Al volante no se lleva pala en la mano.
			pcall(darHerramienta, jugador, pers, estado)
			if parcela.dueno == jugador then
				estado.tiene.quitanieves = true
			end
		end
		if not parcela.quitanievesCogido then
			parcela.quitanievesCogido = true
			if jugador then
				RemotoAviso:FireClient(jugador, { tipo = "quitanieves" })
			end
			avanzarCapitulo(parcela)
		end
	end

	local acel = q.asiento.Throttle or 0
	local vira = q.asiento.Steer or 0
	q.giro = q.giro - vira * def.giro * dt
	local dir = haciaDonde(q.giro)

	if acel ~= 0 then
		local destino = q.sitio + dir * (acel * def.velocidad * dt)
		if puedePasar(destino, dir, def) then
			q.sitio = destino
			q.atascado = false
		else
			q.atascado = true
		end
	end

	-- La maquina se apoya en lo que tenga debajo, sea asfalto o nieve.
	local suya = parcelaEn(q.sitio.X, q.sitio.Z) or parcela
	local cx, cz = suya:aCasilla(q.sitio.X, q.sitio.Z)
	q.sitio = Vector3.new(q.sitio.X, math.max(suya:alturaEn(cx, cz), 0) + 3.4, q.sitio.Z)
	q.colocar(CFrame.new(q.sitio) * CFrame.Angles(0, q.giro, 0))

	pcall(function()
		q.motor.Volume = 0.1 + math.abs(acel) * 0.28
		q.motor.PlaybackSpeed = 0.8 + math.abs(acel) * 0.5
	end)

	-- La cuchilla trabaja mientras la maquina anda, no parada.
	local ahora = os.clock()
	if acel ~= 0 and (ahora - (q.ultimo or 0)) >= def.golpe then
		q.ultimo = ahora
		local hechas = limpiarConLaCuchilla(suya, q.sitio, dir, def)
		if hechas > 0 then
			suya.tocada = true
			if estado then
				estado.dinero = estado.dinero + hechas * A.dinero.porCapa
				estado.nieveTotal = estado.nieveTotal + hechas
			end
			-- Empuja la nieve a los dos lados, y ahi se queda: por eso una
			-- calle abierta se ve abierta desde el otro extremo.
			local derecha = Vector3.new(-dir.Z, 0, dir.X)
			for _, lado in ipairs({ -1, 1 }) do
				local x = q.sitio.X + derecha.X * def.desvio * lado
				local z = q.sitio.Z + derecha.Z * def.desvio * lado
				local mcx, mcz = suya:aCasilla(x, z)
				amontonar(suya, Vector3.new(x, suya:alturaEn(mcx, mcz), z), 9, 26)
			end
			if q.chorro then
				pcall(function()
					q.chorro:Emit(20)
				end)
			end
			revisarHallazgos(suya)
		end
	end
end

-- Sacarlo de donde sea y devolverlo a la calzada. No se pierde nada:
-- ni progreso, ni nieve, ni la partida.
local function recuperarQuitanieves(parcela)
	local q = parcela.maquina
	if not q then
		return false
	end
	q.sitio = sitioDelQuitanieves(parcela)
	q.giro = -math.pi / 2
	q.atascado = false
	q.colocar(CFrame.new(q.sitio) * CFrame.Angles(0, q.giro, 0))
	return true
end


-------------------------------------------------------------------
--  COGER LA SOPLADORA
--
--  Acercarse a ella es cogerla. Ni menu, ni compra, ni nada. Y es del
--  dueno de la parcela: quien viene a ayudar no se la lleva.
-------------------------------------------------------------------

local function revisarRecogida(jugador, estado, pos)
	local parcela = parcelas[estado.mia]
	if not parcela or not parcela.sopladoraCuerpo or estado.tiene.sopladora then
		return
	end
	if parcela.dueno ~= jugador then
		return
	end
	if (pos - parcela.sopladoraCuerpo.Position).Magnitude > A.sitio.radioCogida then
		return
	end

	estado.tiene.sopladora = true
	estado.herramienta = "sopladora"
	parcela.sopladoraCogida = true
	parcela.sopladoraSuelta:Destroy()
	parcela.sopladoraSuelta = nil
	parcela.sopladoraCuerpo = nil

	local pers = jugador.Character
	if pers then
		pcall(darHerramienta, jugador, pers, estado)
	end
	RemotoAviso:FireClient(jugador, { tipo = "cogida" })
	avanzarCapitulo(parcela)
end


-------------------------------------------------------------------
--  LA TORMENTA
--
--  Un evento del SERVIDOR, no del jugador: empieza cuando el primero
--  llega a la plaza y vive mientras dure. Lo que cae es nieve de
--  tormenta, en otra capa, que no se guarda y se derrite al final.
--
--  Por eso una tormenta puede volver a dar trabajo sin deshacer nada:
--  ni cierra puertas, ni quita herramientas, ni reinicia el guion.
-------------------------------------------------------------------

local cielo = {}

local function guardarCielo()
	if cielo.guardado then
		return
	end
	cielo.guardado = {
		ClockTime = Luz.ClockTime,
		Brightness = Luz.Brightness,
		FogEnd = Luz.FogEnd,
		FogStart = Luz.FogStart,
		OutdoorAmbient = Luz.OutdoorAmbient,
	}
	local aire = Luz:FindFirstChildOfClass("Atmosphere")
	if aire then
		cielo.densidad = aire.Density
		cielo.bruma = aire.Haze
	end
end

-- Que se vea venir. Nada de pantalla negra: cambia el cielo, se cierra la
-- niebla y baja la luz, pero se sigue viendo el otro lado de la calle.
local function cieloDeTormenta()
	guardarCielo()
	pcall(function()
		Tweens:Create(Luz, TweenInfo.new(A.tormenta.aviso), {
			ClockTime = 17.2,
			Brightness = 1.1,
			FogEnd = 420,
			FogStart = 60,
			OutdoorAmbient = Color3.fromRGB(120, 130, 148),
		}):Play()
	end)
	local aire = Luz:FindFirstChildOfClass("Atmosphere")
	if aire then
		pcall(function()
			Tweens:Create(aire, TweenInfo.new(A.tormenta.aviso), { Density = 0.62, Haze = 5 }):Play()
		end)
	end
end

-- Y que se note cuando pasa: el cielo vuelve, y vuelve despacio.
local function cieloNormal()
	if not cielo.guardado then
		return
	end
	pcall(function()
		Tweens:Create(Luz, TweenInfo.new(8), cielo.guardado):Play()
	end)
	local aire = Luz:FindFirstChildOfClass("Atmosphere")
	if aire and cielo.densidad then
		pcall(function()
			Tweens:Create(aire, TweenInfo.new(8), { Density = cielo.densidad, Haze = cielo.bruma }):Play()
		end)
	end
end

local function parpadearFarolas(parcela)
	local c = parcela.calle
	if not c or not c.encendida then
		return
	end
	task.spawn(function()
		for _ = 1, 4 do
			for _, f in ipairs(c.farolas) do
				f.luz.Enabled = false
			end
			task.wait(0.12)
			for _, f in ipairs(c.farolas) do
				f.luz.Enabled = true
			end
			task.wait(0.5)
		end
	end)
end

-- Cuanta gente esta trabajando esta parcela ahora mismo. Con mas gente NO
-- cae mas nieve: sale un bloqueo mas y las zonas son algo mas anchas.
local function jugadoresDe(parcela)
	local cuantos = 0
	for _, estado in pairs(estados) do
		if estado.mia == parcela.id or estado.parcela == parcela.id then
			cuantos = cuantos + 1
		end
	end
	return math.max(1, cuantos)
end

local function participan()
	local lista = {}
	for _, parcela in ipairs(parcelas) do
		if parcela.dueno and parcela.hallazgos.plaza then
			lista[#lista + 1] = parcela
		end
	end
	return lista
end

local function avisoDeTormenta(parcela, datos)
	aTodos(parcela, datos)
end

local function montarTormentaEn(parcela)
	local t = Tormenta.nueva(parcela, jugadoresDe(parcela))
	t.casillas = Tormenta.casillasDeLaOla(parcela, t)
	parcela.tormenta = t

	-- El arbol cae ahora, y no se puede quitar con nada: obliga a abrir el
	-- arcen y rodear. Es el bloqueo que no se resuelve cavando.
	if t.arbol then
		local x, z = parcela:centro(t.arbol.cx, A.sitio.czCarretera)
		parcela.arbol.colocar(CFrame.new(x, 1, z) * CFrame.Angles(0, math.rad(12), 0))
		parcela.arbol.ver(true)
		avisoDeTormenta(parcela, { tipo = "arbol" })
	end
	parpadearFarolas(parcela)
	avisoDeTormenta(parcela, { tipo = "tormentaViene" })
end

-- La nieve cae por olas, y cada ola por lotes. Nada de cubrir el mapa de
-- golpe: se tiene que ver llegar, y con varios jugadores no puede pegar
-- un tiron al servidor.
local function olaDeNieve(parcela, numeroDeOla)
	local t = parcela.tormenta
	if not t or not t.casillas then
		return
	end
	local puestas = 0
	for i, casilla in ipairs(t.casillas) do
		-- Media parcela por ola, alternando: asi cuaja a manchas, como la
		-- nieve de verdad, y no como una capa de pintura. En los
		-- ventisqueros (las zonas de los bloqueos) cae en todas las olas:
		-- son justo los sitios donde el viento amontona, y por eso son un
		-- bloqueo y no un charco de nieve mas.
		if casilla.ventisquero or (casilla.cx + casilla.cz + numeroDeOla) % 2 == 0 then
			parcela:nevarTormentaEn(casilla.cx, casilla.cz, 1, casilla.tope)
		end
		puestas = puestas + 1
		if puestas % A.tormenta.porLote == 0 then
			task.wait()
		end
		if i % 900 == 0 and not parcela.tormenta then
			return
		end
	end
end

local function premiarPorLaTormenta(parcela)
	local dueno = parcela.dueno
	local estado = dueno and estados[dueno]
	if not estado then
		return
	end
	estado.tormentas = estado.tormentas + 1
	estado.reputacion = estado.reputacion + 1

	-- La baliza: el quitanieves pasa a ser vehiculo de emergencia. Se ve
	-- desde lejos, y eso es toda la recompensa que hace falta.
	if not estado.premios.baliza then
		estado.premios.baliza = true
		RemotoAviso:FireClient(dueno, { tipo = "baliza" })
	end
	ponerBaliza(parcela)

	-- Y se abre el ayuntamiento, con el mapa de lo que queda por
	-- desenterrar. Es el gancho de la fase siguiente, y nada mas.
	if not estado.premios.ayuntamiento then
		estado.premios.ayuntamiento = true
		RemotoAviso:FireClient(dueno, { tipo = "ayuntamiento" })
	end
	abrirAyuntamiento(parcela)
	pcall(guardarJugador, dueno, "tormenta superada")
end

local function terminarTormentaEn(parcela)
	local t = parcela.tormenta
	if not t then
		return
	end
	parcela.tormenta = nil
	parcela.arbol.ver(false)
	parcela.camion.ver(false)
	avisoDeTormenta(parcela, { tipo = "tormentaFin" })
	-- Se derrite por lotes, no de golpe: la mejora del tiempo tambien se
	-- tiene que ver.
	task.spawn(function()
		while parcela:derretirTormenta(A.tormenta.derretirPorLote) > 0 do
			task.wait()
		end
	end)
end

-- El camion no aparece por arte de magia: entra por la calle, recorre lo
-- que has abierto y para en la plaza. Si hay arbol, va por el arcen.
local function ticCamion(parcela, dt)
	local t = parcela.tormenta
	if not t or not t.camion then
		return
	end
	local c = t.camion
	local destino = c.ruta[c.punto]
	if not destino then
		return
	end
	local haciaAlli = Vector3.new(destino.X - c.donde.X, 0, destino.Z - c.donde.Z)
	local cuanto = haciaAlli.Magnitude
	if cuanto < 3 then
		c.punto = c.punto + 1
		if c.punto > #c.ruta then
			-- HA LLEGADO. Esta es la celebracion del evento.
			-- Se suelta el camion ANTES de repartir premios: repartirlos
			-- guarda partida, y guardar cede el hilo. Con el camion aun
			-- puesto, el siguiente tic entraria a moverlo sin ruta.
			t.camion = nil
			avisoDeTormenta(parcela, { tipo = "camionLlega" })
			for _, f in ipairs(parcela.calle.farolas) do
				f.luz.Enabled = true
				f.luz.Brightness = 3
			end
			premiarPorLaTormenta(parcela)
			task.delay(6, function()
				pcall(terminarTormentaEn, parcela)
			end)
			return
		end
		destino = c.ruta[c.punto]
		haciaAlli = Vector3.new(destino.X - c.donde.X, 0, destino.Z - c.donde.Z)
		cuanto = haciaAlli.Magnitude
	end
	local paso = math.min(cuanto, 20 * dt)
	local dir = Vector3.new(haciaAlli.X / cuanto, 0, haciaAlli.Z / cuanto)
	c.donde = c.donde + dir * paso

	local suelo = 0
	local suya = parcelaEn(c.donde.X, c.donde.Z)
	if suya then
		local cx, cz = suya:aCasilla(c.donde.X, c.donde.Z)
		suelo = suya:alturaEn(cx, cz)
	end
	parcela.camion.colocar(
		CFrame.lookAt(
			Vector3.new(c.donde.X, math.max(suelo, 0) + 5.4, c.donde.Z),
			Vector3.new(c.donde.X + dir.X, math.max(suelo, 0) + 5.4, c.donde.Z + dir.Z)
		)
	)
end

local function ticTormentaEn(parcela, dt)
	local t = parcela.tormenta
	if not t then
		return
	end
	if t.camion then
		ticCamion(parcela, dt)
		return
	end
	if t.abierta then
		return
	end
	-- Mientras esta cuajando no se mira si hay bloqueos: si se mirara,
	-- al primer tic estaria todo "despejado" y saldria el camion antes de
	-- que cayera un copo.
	if mundo.tormenta and mundo.tormenta.fase ~= "abierta" then
		return
	end

	local cerrado = Tormenta.revisarBloqueos(parcela, t)
	if cerrado then
		t.ultimo = os.clock()
		avisoDeTormenta(parcela, {
			tipo = "bloqueoLimpio",
			nombre = cerrado.nombre,
			quedan = Tormenta.quedan(t),
		})
	end
	if Tormenta.quedan(t) > 0 then
		return
	end

	-- Ruta libre: sale el camion.
	t.abierta = true
	local ruta = Tormenta.ruta(parcela, t)
	t.camion = { ruta = ruta, punto = 2, donde = ruta[1] }
	parcela.camion.colocar(CFrame.new(ruta[1] + Vector3.new(0, 5.4, 0)))
	parcela.camion.ver(true)
	pcall(function()
		parcela.camion.motor.Volume = 0.3
		parcela.camion.motor:Play()
	end)
	avisoDeTormenta(parcela, { tipo = "camionEnCamino" })
end

local function ticTormenta(dt)
	local T = A.tormenta
	local m = mundo.tormenta
	if not m then
		-- Nadie ha llegado todavia a la plaza: no hay tormenta que llevar.
		for _, parcela in ipairs(parcelas) do
			if parcela.tormenta then
				ticTormentaEn(parcela, dt)
			end
		end
		return
	end

	local ahora = os.clock()
	if m.fase == "calma" then
		if ahora - m.desde >= T.calma then
			m.fase = "aviso"
			m.desde = ahora
			cieloDeTormenta()
			for _, parcela in ipairs(participan()) do
				montarTormentaEn(parcela)
			end
		end
	elseif m.fase == "aviso" then
		if ahora - m.desde >= T.aviso then
			m.fase = "cayendo"
			m.desde = ahora
			m.ola = 0
		end
	elseif m.fase == "cayendo" then
		if ahora - m.desde >= T.entreOlas then
			m.desde = ahora
			m.ola = m.ola + 1
			for _, parcela in ipairs(parcelas) do
				if parcela.tormenta then
					task.spawn(olaDeNieve, parcela, m.ola)
				end
			end
			if m.ola >= T.olas then
				m.fase = "abierta"
			end
		end
	end

	local quedaAlguna = false
	for _, parcela in ipairs(parcelas) do
		if parcela.tormenta then
			quedaAlguna = true
			ticTormentaEn(parcela, dt)
		end
	end
	if not quedaAlguna and m.fase == "abierta" then
		mundo.tormenta = nil
		cieloNormal()
	end
end

-- Se llama al descubrir la plaza. La tormenta es una sola para todo el
-- servidor: la arranca el primero que llega.
function quizaEmpezarTormenta()
	if mundo.tormenta then
		return
	end
	mundo.tormenta = { fase = "calma", desde = os.clock(), ola = 0, numero = (mundo.tormentas or 0) + 1 }
	mundo.tormentas = mundo.tormenta.numero
end


-------------------------------------------------------------------
--  LO QUE VE EL CLIENTE
-------------------------------------------------------------------

-- HERRAMIENTA PRESTADA. Lo que has desbloqueado tu es tuyo y va contigo;
-- pero cuando estas en la parcela de OTRO puedes usar lo que esa parcela
-- tenga desbloqueado. Sin esto, el que viene a echar una mano en plena
-- tormenta llega con una pala y nada mas, y el evento pide las tres
-- herramientas: ayudar seria imposible justo cuando mas falta hace. Al
-- salirte de esa parcela se te cae de la mano sola (lo hace ticJuego).
local function puedeUsar(estado, clave)
	if clave == "pala" then
		return true
	end
	if estado.tiene[clave] then
		return true
	end
	local aqui = parcelas[estado.parcela]
	if not aqui or aqui.id == estado.mia then
		return false
	end
	if clave == "sopladora" then
		return aqui.sopladoraCogida == true
	end
	if clave == "quitanieves" then
		return aqui.quitanievesCogido == true
	end
	return false
end

local function paqueteDe(jugador, estado)
	-- Se ensena el guion de la parcela que estas PISANDO: si estas
	-- ayudando a alguien, ves lo que le falta a el, y quien es.
	local aqui = parcelas[estado.parcela] or parcelas[estado.mia]
	local mia = parcelas[estado.mia]
	local hallazgos = {}
	if aqui then
		for clave, si in pairs(aqui.hallazgos) do
			hallazgos[clave] = si
		end
	end
	local cap = aqui and A.capitulos[aqui.capitulo] or A.capitulos[1]
	local ajena = nil
	if aqui and mia and aqui ~= mia then
		ajena = aqui.duenoNombre or "?"
	end
	-- Lo de la tormenta, si la hay: en que va y que queda por despejar.
	-- El HUD nunca ensena mas de lo que hace falta.
	local tormenta = nil
	local t = aqui and aqui.tormenta
	if t then
		local lista = {}
		for _, b in ipairs(t.bloqueos) do
			lista[#lista + 1] = {
				clave = b.clave,
				nombre = b.nombre,
				herramienta = b.herramienta,
				limpio = b.limpio == true,
			}
		end
		tormenta = {
			fase = mundo.tormenta and mundo.tormenta.fase or "abierta",
			quedan = Tormenta.quedan(t),
			bloqueos = lista,
			camion = t.camion ~= nil,
			arbol = t.arbol ~= nil,
		}
	elseif mundo.tormenta and mundo.tormenta.fase == "calma" then
		tormenta = { fase = "calma", quedan = 0, bloqueos = {} }
	end

	return {
		dinero = math.floor(estado.dinero),
		carga = estado.carga,
		capacidad = A.jugador.capacidad,
		nieveTotal = math.floor(estado.nieveTotal),
		capitulo = cap.clave,
		capasObjetivo = aqui and aqui.capasObjetivo or 0,
		herramienta = estado.herramienta,
		tiene = {
			pala = true,
			sopladora = puedeUsar(estado, "sopladora"),
			quitanieves = puedeUsar(estado, "quitanieves"),
		},
		bloqueado = estado.bloqueado == true,
		soloPala = estado.soloPala == true,
		-- Para pintar el abanico del color que toca: dorado si la ultima
		-- palada fue completa, naranja si hay que ensanchar, azul si no.
		paladaLlena = estado.paladaLlena == true,
		conduciendo = estado.conduciendo == true,
		atascado = (estado.conduciendo and aqui and aqui.maquina and aqui.maquina.atascado) == true,
		ajena = ajena,
		mia = estado.mia,
		nube = Guardado.disponible ~= false,
		hallazgos = hallazgos,
		tormenta = tormenta,
		tormentas = estado.tormentas,
		reputacion = estado.reputacion,
	}
end


-------------------------------------------------------------------
--  ENTRAR, GUARDAR Y SALIR
-------------------------------------------------------------------

local function datosDe(jugador, estado)
	local parcela = parcelas[estado.mia]
	if not parcela then
		return nil
	end
	return {
		v = A.esquema,
		dinero = math.floor(estado.dinero),
		nieveTotal = math.floor(estado.nieveTotal),
		capitulo = A.capitulos[parcela.capitulo].clave,
		hallazgos = parcela.hallazgos,
		herramientas = estado.tiene,
		mundo = estadoDelMundo(parcela),
		recompensas = estado.premios,
		tormentas = estado.tormentas,
		reputacion = estado.reputacion,
		-- La nieve entera, por tramos. Ni particulas, ni montones de
		-- adorno, ni luces: todo eso se vuelve a construir solo.
		nieve = parcela:comprimir(),
	}
end

function guardarJugador(jugador, porque)
	local estado = estados[jugador]
	if not estado or not estado.mia then
		return false
	end
	local datos = datosDe(jugador, estado)
	if not datos then
		return false
	end
	local ok, donde = Guardado.guardar(jugador, datos)
	if ok then
		estado.guardadoEn = donde
		print(("[kali] guardado (%s) de %s en %s"):format(tostring(porque), jugador.Name, donde))
	end
	return ok
end

local function alEntrar(jugador)
	local carpeta = Instance.new("Folder")
	carpeta.Name = "leaderstats"
	local monedas = Instance.new("IntValue")
	monedas.Name = "Coins"
	monedas.Parent = carpeta
	local nieve = Instance.new("IntValue")
	nieve.Name = "Snow"
	nieve.Parent = carpeta
	local tormentas = Instance.new("IntValue")
	tormentas.Name = "Storms"
	tormentas.Parent = carpeta
	carpeta.Parent = jugador

	local estado = {
		dinero = 0,
		carga = 0,
		nieveTotal = 0,
		cavando = false,
		ultimoGolpe = 0,
		herramienta = "pala",
		-- Ninguna se compra: se encuentran dentro del mundo.
		tiene = { pala = true, sopladora = false, quitanieves = false },
		-- Lo unico que se lleva uno de una tormenta, y es permanente.
		tormentas = 0,
		reputacion = 0,
		premios = {},
		mia = nil,
		parcela = nil,
	}
	estados[jugador] = estado

	local datos = Guardado.cargar(jugador)
	if not estados[jugador] then
		return -- se ha ido mientras se cargaba
	end
	estado.dinero = datos.dinero
	estado.nieveTotal = datos.nieveTotal
	estado.tiene.sopladora = datos.herramientas.sopladora == true
	estado.tiene.quitanieves = datos.herramientas.quitanieves == true
	estado.tormentas = datos.tormentas or 0
	estado.reputacion = datos.reputacion or 0
	for clave, si in pairs(datos.recompensas or {}) do
		estado.premios[clave] = si == true
	end
	if estado.tiene.sopladora then
		estado.herramienta = "sopladora"
	end

	local parcela = parcelaLibre()
	if parcela then
		estado.mia = parcela.id
		estado.parcela = parcela.id
		montarParcela(parcela, jugador, datos)
	else
		-- No queda parcela libre. No se echa a nadie: se entra de
		-- ayudante, que quitar nieve al vecino tambien es jugar.
		warn("[kali] no quedan parcelas libres: " .. jugador.Name .. " entra de ayudante")
	end

	local function alAparecer(pers)
		local humano = pers:WaitForChild("Humanoid", 8)
		if humano then
			humano.WalkSpeed = A.jugador.velocidad
		end
		local suyo = estados[jugador]
		if not suyo then
			return
		end
		suyo.conduciendo = false
		-- Aparecer DELANTE de su propia nevada, no en la del vecino.
		local mia = parcelas[suyo.mia]
		if mia and mia.salida then
			local raiz = pers:FindFirstChild("HumanoidRootPart")
			if raiz then
				raiz.CFrame = mia.salida.CFrame + Vector3.new(0, 4, 0)
			end
		end
		darHerramienta(jugador, pers, suyo)
	end
	jugador.CharacterAdded:Connect(alAparecer)
	if jugador.Character then
		task.spawn(alAparecer, jugador.Character)
	else
		pcall(function()
			jugador:LoadCharacter()
		end)
	end
end

local function alSalir(jugador)
	guardarJugador(jugador, "al salir")
	local estado = estados[jugador]
	if estado and estado.mia then
		local parcela = parcelas[estado.mia]
		if parcela and parcela.dueno == jugador then
			liberarParcela(parcela)
		end
	end
	estados[jugador] = nil
end


-------------------------------------------------------------------
--  LO QUE PIDE EL CLIENTE
-------------------------------------------------------------------

RemotoCavar.OnServerEvent:Connect(function(jugador, quiere)
	local estado = estados[jugador]
	if estado then
		estado.cavando = quiere == true
		if estado.ruido then
			estado.ruido.Volume = estado.cavando and 0.32 or 0
		end
	end
end)

RemotoHerramienta.OnServerEvent:Connect(function(jugador, clave)
	local estado = estados[jugador]
	if not estado or type(clave) ~= "string" or estado.conduciendo then
		return
	end
	-- El quitanieves no se lleva en la mano: se conduce.
	if clave == "quitanieves" or not A.herramientas[clave] or not puedeUsar(estado, clave) then
		return
	end
	if estado.herramienta == clave then
		return
	end
	estado.herramienta = clave
	local pers = jugador.Character
	if pers then
		pcall(darHerramienta, jugador, pers, estado)
	end
end)

RemotoMaquina.OnServerEvent:Connect(function(jugador, que)
	local estado = estados[jugador]
	if not estado then
		return
	end
	local parcela = parcelas[estado.parcela] or parcelas[estado.mia]
	if not parcela or not parcela.maquina then
		return
	end
	if que == "recuperar" then
		recuperarQuitanieves(parcela)
	elseif que == "bajar" then
		local pers = jugador.Character
		local humano = pers and pers:FindFirstChildOfClass("Humanoid")
		if humano then
			humano.Sit = false
		end
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
				warn("[kali] fallo en " .. nombre .. ": " .. tostring(err))
			end
		end
	end)
end

local function ticJuego()
	for jugador, estado in pairs(estados) do
		local pers = jugador.Character
		local raiz = pers and pers:FindFirstChild("HumanoidRootPart")
		if raiz then
			local pos = raiz.Position
			local def = A.herramientas[estado.herramienta] or A.herramientas.pala

			-- En que parcela estoy pisando ahora mismo: puede ser la mia o
			-- la de cualquiera al que este echando una mano.
			local aqui = parcelaEn(pos.X, pos.Z)
			estado.parcela = aqui and aqui.id or estado.mia

			-- Lo prestado se devuelve al salir. Si te vas de la parcela
			-- donde te dejaron la sopladora, vuelves a tu pala.
			if estado.herramienta ~= "pala" and not puedeUsar(estado, estado.herramienta) then
				estado.herramienta = "pala"
				def = A.herramientas.pala
				pcall(darHerramienta, jugador, pers, estado)
			end

			-- Los avisos no se quedan pegados: caducan al soltar, al
			-- moverse de sitio, o al salirse de la parcela.
			if not estado.cavando then
				estado.bloqueado = false
				estado.soloPala = false
				estado.paladaLlena = false
				estado.palada = 0
			elseif estado.bloqueado and estado.bloqueadoEn then
				if (Vector3.new(pos.X, 0, pos.Z) - estado.bloqueadoEn).Magnitude > 5 then
					estado.bloqueado = false
				end
			end
			if estado.cavando and not aqui then
				estado.bloqueado = false
				estado.soloPala = false
			end

			-- Al volante no se cava a mano.
			if estado.cavando and not estado.conduciendo
				and (os.clock() - (estado.ultimoGolpe or 0)) >= def.golpe then
				estado.ultimoGolpe = os.clock()
				-- La herramienta solo se mueve y solo salta nieve si la
				-- pasada ha QUITADO algo.
				local hechas = excavarPara(jugador, estado, pos, raiz)
				estado.palada = hechas
				estado.paladaLlena = hechas >= def.potencia
				if hechas > 0 then
					if estado.herramienta == "sopladora" then
						animarSopladora(estado)
					else
						animarPala(estado, hechas, def.potencia)
					end
				end
			end

			descargarPara(jugador, estado, pos)
			revisarRecogida(jugador, estado, pos)
		end
	end
end

local function ticEstado()
	for jugador, estado in pairs(estados) do
		RemotoEstado:FireClient(jugador, paqueteDe(jugador, estado))
		local marcador = jugador:FindFirstChild("leaderstats")
		local nieve = marcador and marcador:FindFirstChild("Snow")
		if nieve then
			nieve.Value = math.clamp(math.floor(estado.nieveTotal), 0, 2147483647)
		end
		local monedas = marcador and marcador:FindFirstChild("Coins")
		if monedas then
			monedas.Value = math.clamp(math.floor(estado.dinero), 0, 2147483647)
		end
		local tormentas = marcador and marcador:FindFirstChild("Storms")
		if tormentas then
			tormentas.Value = math.clamp(math.floor(estado.tormentas), 0, 2147483647)
		end
	end
end

local PASO_MAQUINA = 0.06
local function ticMaquinas()
	for _, parcela in ipairs(parcelas) do
		if parcela.maquina then
			ticQuitanieves(parcela, PASO_MAQUINA)
		end
	end
end

local function guardarATodos(porque)
	for jugador in pairs(estados) do
		pcall(guardarJugador, jugador, porque)
	end
end


-------------------------------------------------------------------
--  ARRANQUE
-------------------------------------------------------------------

Jugadores.CharacterAutoLoads = false
construirMundo()

-- La nieve de las cinco parcelas. Se pone antes de dejar entrar a nadie:
-- aparecer sobre una parcela a medio nevar seria aparecer flotando.
for _, parcela in ipairs(parcelas) do
	parcela:generar(parcela.perfil)
	Mundo.monticuloDelBuzon(parcela)
	parcela:nevar()
	parcela.tocada = false
end

Jugadores.PlayerAdded:Connect(function(jugador)
	task.spawn(alEntrar, jugador)
end)
Jugadores.PlayerRemoving:Connect(alSalir)
for _, jugador in ipairs(Jugadores:GetPlayers()) do
	if not estados[jugador] then
		task.spawn(alEntrar, jugador)
	end
end

-- Al cerrar el servidor se guarda todo lo que haya. Roblox da unos
-- segundos: hay que usarlos.
game:BindToClose(function()
	guardarATodos("al cerrar")
	task.wait(1)
end)

bucle("excavar", A.jugador.tic, ticJuego)
bucle("estado", 0.3, ticEstado)
bucle("maquinas", PASO_MAQUINA, ticMaquinas)
bucle("tormenta", 0.25, function()
	ticTormenta(0.25)
end)
-- Guardado periodico: si al servidor le da algo, se pierde minuto y
-- medio, no la partida.
bucle("guardado", 90, function()
	guardarATodos("cada minuto y medio")
end)

-- LA VERSION, EN VOZ ALTA Y LA PRIMERA. Con cinco carpetas de
-- prototipos por ahi, lo primero que hay que poder comprobar de un
-- vistazo es que lo que se esta ejecutando es esto y no otra cosa.
print("=====================================")
print("  " .. A.version)
print(("  esquema de guardado %d  ·  almacen %s"):format(A.esquema, Guardado.nombreTienda))
print("=====================================")
print(("[kali] %d parcelas listas, %d casillas cada una, %d capas la primera"):format(
	#parcelas, parcelas[1].ancho * parcelas[1].largo, parcelas[1].capasTotales))
