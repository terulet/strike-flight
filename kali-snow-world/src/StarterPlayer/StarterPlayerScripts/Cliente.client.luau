--[[
	LA GRAN TORMENTA  —  cliente

	Lo unico que de verdad importa aqui: que en todo momento el jugador
	sepa QUE esta buscando, y que cuando aparezca algo se entere de que ha
	pasado algo. El guion lo lleva el servidor; esto solo lo canta.

	Y una cosa mas, ahora que se juega acompanado: que se vea de un
	vistazo si estas en tu parcela o echandole una mano a alguien.
]]

local Jugadores = game:GetService("Players")
local RS = game:GetService("ReplicatedStorage")
local Tween = game:GetService("TweenService")
local Idiomas = game:GetService("LocalizationService")
local Sonidos = game:GetService("SoundService")
local Interfaz = game:GetService("StarterGui")
local Entrada = game:GetService("UserInputService")
local Correr = game:GetService("RunService")

local jugador = Jugadores.LocalPlayer
local A = require(RS:WaitForChild("Ajustes"))

local remotos = RS:WaitForChild("RemotosKali")
local RemotoEstado = remotos:WaitForChild("Estado")
local RemotoAviso = remotos:WaitForChild("Aviso")
local RemotoCavar = remotos:WaitForChild("Cavar")
local RemotoHerramienta = remotos:WaitForChild("Herramienta")
local RemotoMaquina = remotos:WaitForChild("Maquina")

local idioma = A.idiomaFijo
if not idioma then
	local codigo = ""
	pcall(function()
		codigo = Idiomas.RobloxLocaleId or ""
	end)
	idioma = (string.sub(string.lower(codigo), 1, 2) == "es") and "es" or "en"
end

local function T(clave)
	return A.texto(idioma, clave)
end

local FONDO = Color3.fromRGB(14, 20, 32)
local ACENTO = Color3.fromRGB(120, 205, 255)
local NARANJA = Color3.fromRGB(255, 158, 76)
local ORO = Color3.fromRGB(255, 208, 92)
local BLANCO = Color3.fromRGB(255, 255, 255)

local function nuevo(clase, props, padre)
	local obj = Instance.new(clase)
	for clave, valor in pairs(props) do
		obj[clave] = valor
	end
	if padre then
		obj.Parent = padre
	end
	return obj
end

local function panel(props, padre)
	local marco = nuevo("Frame", props, padre)
	marco.BorderSizePixel = 0
	nuevo("UICorner", { CornerRadius = UDim.new(0, 14) }, marco)
	nuevo("UIStroke", { Color = BLANCO, Transparency = 0.86, Thickness = 1.5 }, marco)
	return marco
end

local function etiqueta(props, padre)
	props.BackgroundTransparency = props.BackgroundTransparency or 1
	props.TextColor3 = props.TextColor3 or BLANCO
	props.Font = props.Font or Enum.Font.GothamBold
	props.BorderSizePixel = 0
	return nuevo("TextLabel", props, padre)
end

task.spawn(function()
	for _ = 1, 10 do
		local ok = pcall(function()
			Interfaz:SetCoreGuiEnabled(Enum.CoreGuiType.Backpack, false)
		end)
		if ok then
			return
		end
		task.wait(0.5)
	end
end)

local pantalla = nuevo("ScreenGui", {
	Name = "HUDTormenta",
	ResetOnSpawn = false,
	ZIndexBehavior = Enum.ZIndexBehavior.Sibling,
}, jugador:WaitForChild("PlayerGui"))


-- Dinero -----------------------------------------------------------

local marcoDinero = panel({
	Name = "Dinero",
	Size = UDim2.new(0, 200, 0, 52),
	Position = UDim2.new(0, 14, 0, 14),
	BackgroundColor3 = FONDO,
	BackgroundTransparency = 0.12,
}, pantalla)

local moneda = nuevo("Frame", {
	Name = "Moneda",
	Size = UDim2.new(0, 24, 0, 24),
	Position = UDim2.new(0, 14, 0.5, 0),
	AnchorPoint = Vector2.new(0, 0.5),
	BackgroundColor3 = ORO,
	BorderSizePixel = 0,
}, marcoDinero)
nuevo("UICorner", { CornerRadius = UDim.new(1, 0) }, moneda)

local textoDinero = etiqueta({
	Name = "Texto",
	Size = UDim2.new(1, -54, 1, 0),
	Position = UDim2.new(0, 46, 0, 0),
	Text = "0",
	TextColor3 = ORO,
	TextXAlignment = Enum.TextXAlignment.Left,
	Font = Enum.Font.GothamBlack,
	TextSize = 24,
}, marcoDinero)

-- De quien es la parcela que estoy pisando, y si se esta guardando.
local textoParcela = etiqueta({
	Name = "Parcela",
	Size = UDim2.new(0, 320, 0, 20),
	Position = UDim2.new(0, 16, 0, 70),
	Text = "",
	TextSize = 15,
	TextXAlignment = Enum.TextXAlignment.Left,
	Font = Enum.Font.GothamBold,
	TextColor3 = Color3.fromRGB(170, 220, 255),
}, pantalla)

local textoNube = etiqueta({
	Name = "Nube",
	Size = UDim2.new(0, 420, 0, 18),
	Position = UDim2.new(0, 16, 0, 90),
	Text = "",
	TextSize = 13,
	TextXAlignment = Enum.TextXAlignment.Left,
	Font = Enum.Font.Gotham,
	TextColor3 = Color3.fromRGB(255, 170, 120),
}, pantalla)


-- El capitulo -------------------------------------------------------

local marcoObjetivo = panel({
	Name = "Objetivo",
	Size = UDim2.new(0, 560, 0, 74),
	Position = UDim2.new(0.5, 0, 0, 16),
	AnchorPoint = Vector2.new(0.5, 0),
	BackgroundColor3 = Color3.fromRGB(18, 40, 62),
	BackgroundTransparency = 0.08,
}, pantalla)

local bordeObjetivo = nuevo("UIStroke", { Color = ACENTO, Thickness = 3, Transparency = 0.15 }, marcoObjetivo)

local textoObjetivo = etiqueta({
	Name = "Titulo",
	Size = UDim2.new(1, -24, 0, 32),
	Position = UDim2.new(0, 12, 0, 10),
	Text = A.nombre(A.capitulos[1].titulo, idioma),
	TextSize = 23,
	Font = Enum.Font.GothamBlack,
	TextColor3 = ACENTO,
}, marcoObjetivo)

local pieObjetivo = etiqueta({
	Name = "Pie",
	Size = UDim2.new(1, -24, 0, 22),
	Position = UDim2.new(0, 12, 0, 44),
	Text = A.nombre(A.capitulos[1].pie, idioma),
	TextSize = 15,
	Font = Enum.Font.Gotham,
	TextColor3 = Color3.fromRGB(198, 216, 238),
}, marcoObjetivo)

Tween:Create(
	bordeObjetivo,
	TweenInfo.new(1, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut, -1, true),
	{ Transparency = 0.75 }
):Play()

local marcoHondo = panel({
	Name = "Profundidad",
	Size = UDim2.new(0, 340, 0, 40),
	Position = UDim2.new(0.5, 0, 0, 100),
	AnchorPoint = Vector2.new(0.5, 0),
	BackgroundColor3 = FONDO,
	BackgroundTransparency = 0.2,
}, pantalla)

local textoHondo = etiqueta({
	Name = "Texto",
	Size = UDim2.new(1, -16, 1, 0),
	Position = UDim2.new(0, 8, 0, 0),
	Text = "",
	TextSize = 16,
	TextColor3 = Color3.fromRGB(206, 224, 246),
}, marcoHondo)


-- La carga ----------------------------------------------------------

local marcoCarga = panel({
	Name = "Carga",
	Size = UDim2.new(0, 340, 0, 48),
	Position = UDim2.new(0.5, 0, 1, -22),
	AnchorPoint = Vector2.new(0.5, 1),
	BackgroundColor3 = FONDO,
	BackgroundTransparency = 0.12,
}, pantalla)

local canalCarga = nuevo("Frame", {
	Name = "Canal",
	Size = UDim2.new(1, -16, 1, -16),
	Position = UDim2.new(0, 8, 0, 8),
	BackgroundColor3 = Color3.fromRGB(34, 44, 60),
	BorderSizePixel = 0,
}, marcoCarga)
nuevo("UICorner", { CornerRadius = UDim.new(0, 10) }, canalCarga)

local barraCarga = nuevo("Frame", {
	Name = "Relleno",
	Size = UDim2.new(0, 0, 1, 0),
	BackgroundColor3 = ACENTO,
	BorderSizePixel = 0,
}, canalCarga)
nuevo("UICorner", { CornerRadius = UDim.new(0, 10) }, barraCarga)

local textoCarga = etiqueta({
	Name = "Texto",
	Size = UDim2.new(1, -16, 1, 0),
	Position = UDim2.new(0, 10, 0, 0),
	Text = "",
	TextSize = 17,
	TextXAlignment = Enum.TextXAlignment.Left,
}, canalCarga)


-- Las herramientas --------------------------------------------------
--
-- No aparecen hasta que hay mas de una. Ensenar un boton muerto solo
-- confunde. El quitanieves no se elige aqui: se conduce.

local marcoUtiles = nuevo("Frame", {
	Name = "Utiles",
	Size = UDim2.new(0, 300, 0, 44),
	Position = UDim2.new(0.5, 0, 1, -80),
	AnchorPoint = Vector2.new(0.5, 1),
	BackgroundTransparency = 1,
	Visible = false,
}, pantalla)

local botonesUtil = {}
local function botonUtil(clave, x, color)
	local b = nuevo("TextButton", {
		Name = clave,
		Size = UDim2.new(0, 146, 0, 44),
		Position = UDim2.new(0, x, 0, 0),
		BackgroundColor3 = FONDO,
		BackgroundTransparency = 0.15,
		BorderSizePixel = 0,
		Text = A.nombre(A.herramientas[clave].nombre, idioma),
		TextColor3 = color,
		Font = Enum.Font.GothamBlack,
		TextSize = 17,
		AutoButtonColor = false,
	}, marcoUtiles)
	nuevo("UICorner", { CornerRadius = UDim.new(0, 12) }, b)
	local borde = nuevo("UIStroke", { Color = color, Thickness = 2, Transparency = 0.7 }, b)
	b.MouseButton1Click:Connect(function()
		RemotoHerramienta:FireServer(clave)
	end)
	botonesUtil[clave] = { boton = b, borde = borde, color = color }
	return b
end

botonUtil("pala", 0, ACENTO)
botonUtil("sopladora", 154, NARANJA)

etiqueta({
	Name = "PistaCambio",
	Size = UDim2.new(1, 0, 0, 18),
	Position = UDim2.new(0, 0, 0, -20),
	Text = T("cambiar"),
	TextSize = 14,
	Font = Enum.Font.Gotham,
	TextColor3 = Color3.fromRGB(198, 216, 238),
}, marcoUtiles)


-- Cavar: hay que MANTENER PULSADO. Quieto no pasa nada.
----------------------------------------------------------------------

local botonCavar = nuevo("TextButton", {
	Name = "Cavar",
	Size = UDim2.new(0, 150, 0, 150),
	Position = UDim2.new(1, -24, 1, -120),
	AnchorPoint = Vector2.new(1, 1),
	BackgroundColor3 = ACENTO,
	BorderSizePixel = 0,
	Text = T("cavar"),
	TextColor3 = Color3.fromRGB(8, 16, 28),
	Font = Enum.Font.GothamBlack,
	TextSize = 30,
	AutoButtonColor = false,
}, pantalla)
nuevo("UICorner", { CornerRadius = UDim.new(1, 0) }, botonCavar)
nuevo("UIStroke", { Color = BLANCO, Thickness = 3, Transparency = 0.4 }, botonCavar)

local pistaCavar = etiqueta({
	Name = "Pista",
	Size = UDim2.new(0, 460, 0, 26),
	Position = UDim2.new(0.5, 0, 1, -84),
	AnchorPoint = Vector2.new(0.5, 1),
	Text = T("manten"),
	TextSize = 19,
	Font = Enum.Font.GothamBlack,
	TextColor3 = Color3.fromRGB(255, 226, 150),
}, pantalla)
nuevo("UIStroke", { Color = Color3.fromRGB(0, 0, 0), Thickness = 2, Transparency = 0.4 }, pistaCavar)

local pistaCavarPie = etiqueta({
	Name = "PistaPie",
	Size = UDim2.new(0, 460, 0, 20),
	Position = UDim2.new(0.5, 0, 1, -62),
	AnchorPoint = Vector2.new(0.5, 1),
	Text = T("mantenPie"),
	TextSize = 15,
	Font = Enum.Font.Gotham,
	TextColor3 = Color3.fromRGB(206, 224, 246),
}, pantalla)

-- EL GATILLO, para mando. Un boton redondo de ciento cincuenta pixeles
-- en una tele con un mando en la mano no lo pulsa nadie: lo que hace
-- falta ahi es saber QUE gatillo.
local pistaGatillo = etiqueta({
	Name = "Gatillo",
	Size = UDim2.new(0, 66, 0, 66),
	Position = UDim2.new(1, -40, 1, -140),
	AnchorPoint = Vector2.new(1, 1),
	Text = T("gatillo"),
	TextSize = 28,
	Font = Enum.Font.GothamBlack,
	TextColor3 = Color3.fromRGB(8, 16, 28),
	BackgroundColor3 = Color3.fromRGB(206, 224, 246),
	BackgroundTransparency = 0.05,
}, pantalla)
nuevo("UICorner", { CornerRadius = UDim.new(0, 16) }, pistaGatillo)
nuevo("UIStroke", { Color = BLANCO, Thickness = 2, Transparency = 0.35 }, pistaGatillo)
pistaGatillo.Visible = false


-- El volante ---------------------------------------------------------
--
-- Solo cuando se esta conduciendo. Dos botones: bajarse y sacar la
-- maquina de donde se haya metido.

local marcoVolante = nuevo("Frame", {
	Name = "Volante",
	Size = UDim2.new(0, 320, 0, 96),
	Position = UDim2.new(0.5, 0, 1, -20),
	AnchorPoint = Vector2.new(0.5, 1),
	BackgroundTransparency = 1,
	Visible = false,
}, pantalla)

local pistaConduce = etiqueta({
	Name = "Pista",
	Size = UDim2.new(1, 0, 0, 24),
	Position = UDim2.new(0, 0, 0, 0),
	Text = T("conduce"),
	TextSize = 17,
	Font = Enum.Font.GothamBold,
	TextColor3 = Color3.fromRGB(255, 226, 150),
}, marcoVolante)

local function botonMaquina(nombre, texto, x, color)
	local b = nuevo("TextButton", {
		Name = nombre,
		Size = UDim2.new(0, 150, 0, 48),
		Position = UDim2.new(0, x, 0, 34),
		BackgroundColor3 = color,
		BorderSizePixel = 0,
		Text = texto,
		TextColor3 = Color3.fromRGB(8, 16, 28),
		Font = Enum.Font.GothamBlack,
		TextSize = 19,
		AutoButtonColor = false,
	}, marcoVolante)
	nuevo("UICorner", { CornerRadius = UDim.new(0, 12) }, b)
	b.MouseButton1Click:Connect(function()
		RemotoMaquina:FireServer(nombre)
	end)
	return b
end

botonMaquina("recuperar", T("recuperar"), 0, Color3.fromRGB(255, 190, 90))
botonMaquina("bajar", T("bajar"), 168, Color3.fromRGB(180, 200, 220))


-- La tormenta ---------------------------------------------------------
--
-- Mientras nieva, esto es lo que manda en el HUD: que queda por despejar
-- y con que. Cada bloqueo dice su herramienta, porque el quitanieves no
-- puede con todo y hay que saberlo de un vistazo.

local marcoTormenta = panel({
	Name = "Tormenta",
	Size = UDim2.new(0, 300, 0, 210),
	Position = UDim2.new(1, -20, 0.5, 0),
	AnchorPoint = Vector2.new(1, 0.5),
	BackgroundColor3 = Color3.fromRGB(20, 26, 44),
	BackgroundTransparency = 0.1,
	Visible = false,
}, pantalla)
nuevo("UIStroke", { Color = Color3.fromRGB(140, 180, 255), Thickness = 2, Transparency = 0.3 }, marcoTormenta)

local tituloTormenta = etiqueta({
	Name = "Titulo",
	Size = UDim2.new(1, -20, 0, 26),
	Position = UDim2.new(0, 10, 0, 10),
	Text = T("rutaTitulo"),
	TextSize = 15,
	Font = Enum.Font.GothamBlack,
	TextColor3 = Color3.fromRGB(160, 200, 255),
	TextWrapped = true,
}, marcoTormenta)

local pieTormenta = etiqueta({
	Name = "Pie",
	Size = UDim2.new(1, -20, 0, 18),
	Position = UDim2.new(0, 10, 0, 40),
	Text = T("rutaPie"),
	TextSize = 13,
	Font = Enum.Font.Gotham,
	TextColor3 = Color3.fromRGB(190, 206, 226),
}, marcoTormenta)

local filasBloqueo = {}
for i = 1, 5 do
	filasBloqueo[i] = etiqueta({
		Name = "Bloqueo" .. i,
		Size = UDim2.new(1, -20, 0, 26),
		Position = UDim2.new(0, 12, 0, 62 + (i - 1) * 28),
		Text = "",
		TextSize = 14,
		TextXAlignment = Enum.TextXAlignment.Left,
		Font = Enum.Font.GothamBold,
		Visible = false,
	}, marcoTormenta)
end

-- Nieve cayendo, viento y sonido de fuera. Intensa pero se ve el otro
-- lado de la calle: si no se ve, no se juega.
local nevando = nil
local viento = nuevo("Sound", {
	Name = "Viento",
	SoundId = "rbxasset://sounds/action_falling.mp3",
	Volume = 0,
	PlaybackSpeed = 0.45,
	Looped = true,
}, Sonidos)

local function ponerNevada(si)
	local camara = workspace.CurrentCamera
	if si and not nevando then
		local ancla = Instance.new("Part")
		ancla.Name = "NevadaTormenta"
		ancla.Size = Vector3.new(1, 1, 1)
		ancla.Transparency = 1
		ancla.Anchored = true
		ancla.CanCollide = false
		ancla.CanQuery = false
		ancla.CanTouch = false
		ancla.Parent = camara
		local punto = Instance.new("Attachment")
		punto.Parent = ancla
		local copos = Instance.new("ParticleEmitter")
		copos.Texture = "rbxasset://textures/particles/smoke_main.dds"
		copos.Color = ColorSequence.new(Color3.fromRGB(255, 255, 255))
		copos.Size = NumberSequence.new(0.9)
		copos.Transparency = NumberSequence.new({
			NumberSequenceKeypoint.new(0, 0.25),
			NumberSequenceKeypoint.new(1, 0.6),
		})
		copos.Lifetime = NumberRange.new(2.4, 3.6)
		copos.Rate = 260
		copos.Speed = NumberRange.new(16, 30)
		copos.SpreadAngle = Vector2.new(50, 50)
		copos.Acceleration = Vector3.new(-14, -26, 0)
		copos.EmissionDirection = Enum.NormalId.Bottom
		copos.Parent = punto
		nevando = { ancla = ancla, copos = copos }
		pcall(function()
			viento:Play()
			Tween:Create(viento, TweenInfo.new(4), { Volume = 0.35 }):Play()
		end)
		-- Rafagas: el viento no sopla igual todo el rato.
		task.spawn(function()
			while nevando do
				local fuerte = 200 + math.random(0, 320)
				copos.Rate = fuerte
				copos.Acceleration = Vector3.new(-8 - math.random(0, 22), -26, math.random(-8, 8))
				pcall(function()
					viento.Volume = 0.2 + fuerte / 1600
				end)
				task.wait(2 + math.random() * 3)
			end
		end)
	elseif not si and nevando then
		nevando.copos.Enabled = false
		local irse = nevando.ancla
		nevando = nil
		pcall(function()
			Tween:Create(viento, TweenInfo.new(5), { Volume = 0 }):Play()
		end)
		task.delay(5, function()
			irse:Destroy()
			pcall(function()
				viento:Stop()
			end)
		end)
	end
end

-- Cerca de una casa el ruido de fuera baja: da sensacion de refugio.
task.spawn(function()
	while true do
		task.wait(0.6)
		if nevando then
			local pers = jugador.Character
			local raiz = pers and pers:FindFirstChild("HumanoidRootPart")
			local cerca = false
			if raiz then
				for _, casa in ipairs(workspace:GetDescendants()) do
					if casa.Name == "Recibidor" and (casa.Position - raiz.Position).Magnitude < 26 then
						cerca = true
						break
					end
				end
			end
			pcall(function()
				viento.Volume = cerca and 0.08 or math.max(viento.Volume, 0.28)
			end)
		end
	end
end)


local cavando = false
local porRaton, porTecla, porBoton = false, false, false
local colorBoton = ACENTO
local tengoSopladora = false
local herramientaActual = "pala"
local conduciendo = false
local bloqueadoAhora = false
local paladaLlenaAhora = false

-------------------------------------------------------------------
--  EL ABANICO, LAS HUELLAS Y LA CARRETILLA
--
--  Los tres son de mentira: no quitan nieve, no la ponen y no le dicen
--  nada al servidor. Estan aqui, en el cliente, porque son MIRAR y no
--  jugar: no cuestan red, no se replican, no pueden atascarse con la
--  fisica, y si se cayeran no cambiaria ni una regla de la partida.
-------------------------------------------------------------------

local rayoAlSuelo = RaycastParams.new()
rayoAlSuelo.FilterType = Enum.RaycastFilterType.Exclude
rayoAlSuelo.IgnoreWater = true

local adornos = Instance.new("Folder")
adornos.Name = "AdornosDeNieve"
-- Al Workspace, no a la camara: lo que crea el cliente en el Workspace
-- es suyo y no se replica a nadie, pero la camara se la puede llevar por
-- delante un respawn y con ella las huellas y la marca de la pala.
adornos.Parent = workspace

local function excluir()
	local fuera = { adornos }
	for _, otro in ipairs(Jugadores:GetPlayers()) do
		if otro.Character then
			fuera[#fuera + 1] = otro.Character
		end
	end
	rayoAlSuelo.FilterDescendantsInstances = fuera
end

local function sueloBajo(x, z)
	return workspace:Raycast(Vector3.new(x, 260, z), Vector3.new(0, -520, 0), rayoAlSuelo)
end

local function trocito(nombre, tam, color, material)
	local p = Instance.new("Part")
	p.Name = nombre
	p.Size = tam
	p.Color = color
	p.Material = material or Enum.Material.Neon
	p.Anchored = true
	p.CanCollide = false
	p.CanQuery = false
	p.CanTouch = false
	p.CastShadow = false
	p.Transparency = 1
	p.Parent = adornos
	return p
end


-------------------------------------------------------------------
--  EL ABANICO DE LA PALA
--
--  Solo el contorno, casi transparente, pegado a la nieve, y con la
--  forma EXACTA que muerde el servidor: mismas tres medidas (cerca,
--  lejos, angulo). Una marca que no coincide con lo que se quita es
--  peor que no poner marca.
-------------------------------------------------------------------

local PALA = A.herramientas.pala
local AZUL = Color3.fromRGB(140, 200, 255)
local ORO_MARCA = Color3.fromRGB(255, 206, 110)
local NARANJA_MARCA = Color3.fromRGB(255, 150, 70)

local TRAMOS = 9
local abanico = {}
for i = 1, TRAMOS * 2 + 2 do
	abanico[i] = trocito("Abanico", Vector3.new(0.18, 0.06, 1), AZUL)
end

local function puntoDelAbanico(origen, mirada, radio, grados)
	local rad = math.rad(grados)
	local cos, sen = math.cos(rad), math.sin(rad)
	-- Girar "mirada" grados sobre el eje Y.
	local dx = mirada.X * cos - mirada.Z * sen
	local dz = mirada.X * sen + mirada.Z * cos
	local x, z = origen.X + dx * radio, origen.Z + dz * radio
	local golpe = sueloBajo(x, z)
	return golpe and Vector3.new(x, golpe.Position.Y + 0.07, z) or nil, golpe
end

local function tenderTrozo(parte, a, b, color)
	if not a or not b then
		parte.Transparency = 1
		return
	end
	local largo = (b - a).Magnitude
	if largo < 0.05 then
		parte.Transparency = 1
		return
	end
	parte.Size = Vector3.new(0.18, 0.06, largo)
	parte.CFrame = CFrame.lookAt((a + b) / 2, b)
	parte.Color = color
	-- Casi transparente: es una marca, no una plataforma.
	parte.Transparency = 0.55
end

local function esconderAbanico()
	for _, p in ipairs(abanico) do
		p.Transparency = 1
	end
end

local function pintarAbanico(raiz, color)
	local frente = raiz.CFrame.LookVector
	local mirada = Vector3.new(frente.X, 0, frente.Z)
	if mirada.Magnitude < 0.05 then
		esconderAbanico()
		return false
	end
	mirada = mirada.Unit
	local origen = raiz.Position

	-- El arco de fuera, tramo a tramo, cada punto a la altura de la
	-- nieve que tiene debajo: asi el contorno se pega al bulto en vez de
	-- flotar por encima.
	local fuera, dentro = {}, {}
	local hayNieve = false
	for i = 0, TRAMOS do
		local g = -PALA.angulo + (2 * PALA.angulo) * (i / TRAMOS)
		local pf, golpeF = puntoDelAbanico(origen, mirada, PALA.lejos, g)
		local pd = puntoDelAbanico(origen, mirada, PALA.cerca, g)
		fuera[i], dentro[i] = pf, pd
		if golpeF and golpeF.Material == Enum.Material.Snow then
			hayNieve = true
		end
	end
	if not hayNieve then
		esconderAbanico()
		return false
	end

	local n = 0
	for i = 1, TRAMOS do
		n = n + 1
		tenderTrozo(abanico[n], fuera[i - 1], fuera[i], color)
	end
	for i = 1, TRAMOS do
		n = n + 1
		tenderTrozo(abanico[n], dentro[i - 1], dentro[i], color)
	end
	n = n + 1
	tenderTrozo(abanico[n], dentro[0], fuera[0], color)
	n = n + 1
	tenderTrozo(abanico[n], dentro[TRAMOS], fuera[TRAMOS], color)
	return true
end


-------------------------------------------------------------------
--  LAS HUELLAS
--
--  Alternando pie, giradas hacia donde andas, un poco hundidas y de un
--  gris azulado: una sombra en la nieve, no una tabla encima. Cada uno
--  tiene su tanda y se recicla, asi que hay un tope por cabeza y no se
--  llena el mundo por mucho que se ande.
-------------------------------------------------------------------

local pisadas = {}

local function tandaDe(pers)
	if pisadas[pers] then
		return pisadas[pers]
	end
	local t = { partes = {}, siguiente = 1, pie = 1, ultimo = nil }
	for i = 1, A.huellas.porJugador do
		local h = trocito("Huella", Vector3.new(A.huellas.ancho, 0.28, A.huellas.largo),
			Color3.fromRGB(150, 168, 190), Enum.Material.SmoothPlastic)
		t.partes[i] = { parte = h, puesta = -1000 }
	end
	pisadas[pers] = t
	return t
end

local function pisar(pers)
	local raiz = pers:FindFirstChild("HumanoidRootPart")
	if not raiz then
		return
	end
	local humano = pers:FindFirstChildOfClass("Humanoid")
	if not humano or humano.MoveDirection.Magnitude < 0.1 or humano.Sit then
		return
	end
	local t = tandaDe(pers)
	local aqui = Vector3.new(raiz.Position.X, 0, raiz.Position.Z)
	if t.ultimo and (aqui - t.ultimo).Magnitude < A.huellas.cada then
		return
	end
	t.ultimo = aqui

	-- Hacia donde ANDA, no hacia donde mira: se anda de lado y de
	-- espaldas, y una huella girada al reves canta muchisimo.
	local anda = humano.MoveDirection
	local dir = Vector3.new(anda.X, 0, anda.Z)
	if dir.Magnitude < 0.05 then
		dir = raiz.CFrame.LookVector
		dir = Vector3.new(dir.X, 0, dir.Z)
	end
	if dir.Magnitude < 0.05 then
		return
	end
	dir = dir.Unit
	local lado = Vector3.new(-dir.Z, 0, dir.X)
	t.pie = -t.pie
	local centro = raiz.Position + lado * (A.huellas.separacion * t.pie)

	local golpe = sueloBajo(centro.X, centro.Z)
	-- Solo se marca la NIEVE. En el asfalto y en la hierba no queda
	-- huella, y eso hace la mitad del trabajo: se ve de un vistazo por
	-- donde hay nieve todavia y por donde ya has pasado.
	if not golpe or golpe.Material ~= Enum.Material.Snow then
		return
	end

	local h = t.partes[t.siguiente]
	t.siguiente = t.siguiente % #t.partes + 1
	h.puesta = os.clock()
	-- Hundida: el cuerpo de la huella se mete por debajo de la superficie
	-- y solo asoma el borde. Por eso no parece una tabla puesta encima.
	h.parte.CFrame = CFrame.lookAt(
		Vector3.new(centro.X, golpe.Position.Y - A.huellas.hundida, centro.Z),
		Vector3.new(centro.X, golpe.Position.Y - A.huellas.hundida, centro.Z) + dir
	)
	h.parte.Transparency = 0.35
end


-------------------------------------------------------------------
--  LA CARRETILLA
--
--  Con forma de carretilla y no de caja: caja abierta, dos asas, rueda
--  delante y dos patas detras. Va SUELTA a tu espalda, alcanzandote con
--  un poco de retraso, y la rueda gira con lo que andas. Nada de esto
--  es fisica: es una posicion que se calcula, asi que no hay forma de
--  que se atasque, ni de que empuje a nadie, ni de que vuelque sola.
-------------------------------------------------------------------

local C = A.carretilla
local carretillas = {}

local function nuevaCarretilla(pers)
	local grupo = Instance.new("Model")
	grupo.Name = "Carretilla"
	local piezas = {}
	local function pieza(nombre, tam, color, material, forma)
		local p = Instance.new("Part")
		p.Name = nombre
		p.Size = tam
		p.Color = color
		p.Material = material or Enum.Material.Metal
		if forma then
			p.Shape = forma
		end
		p.Anchored = true
		p.CanCollide = false
		p.CanQuery = false
		p.CanTouch = false
		p.Parent = grupo
		piezas[#piezas + 1] = p
		return p
	end

	local rojo = Color3.fromRGB(196, 88, 52)
	local metal = Color3.fromRGB(150, 152, 158)
	local c = {}
	-- La caja: suelo y tres paredes, abierta por delante. Una caja
	-- cerrada es un cajon; una carretilla se reconoce por el hueco.
	c.suelo = pieza("Suelo", Vector3.new(C.cajaAncho, 0.18, C.cajaLargo), rojo)
	c.izq = pieza("Izquierda", Vector3.new(0.16, C.cajaAlto, C.cajaLargo), rojo)
	c.der = pieza("Derecha", Vector3.new(0.16, C.cajaAlto, C.cajaLargo), rojo)
	c.tras = pieza("Trasera", Vector3.new(C.cajaAncho, C.cajaAlto, 0.16), rojo)
	c.rueda = pieza("Rueda", Vector3.new(0.34, C.ruedaRadio * 2, C.ruedaRadio * 2),
		Color3.fromRGB(38, 38, 42), Enum.Material.SmoothPlastic, Enum.PartType.Cylinder)
	c.horquilla = pieza("Horquilla", Vector3.new(0.16, 0.16, 1.5), metal)
	c.asaIzq = pieza("AsaIzquierda", Vector3.new(0.14, 0.14, 2.6), metal)
	c.asaDer = pieza("AsaDerecha", Vector3.new(0.14, 0.14, 2.6), metal)
	c.punoIzq = pieza("PunoIzquierda", Vector3.new(0.2, 0.2, 0.6), Color3.fromRGB(120, 84, 52), Enum.Material.Wood)
	c.punoDer = pieza("PunoDerecha", Vector3.new(0.2, 0.2, 0.6), Color3.fromRGB(120, 84, 52), Enum.Material.Wood)
	c.pataIzq = pieza("PataIzquierda", Vector3.new(0.14, 0.9, 0.14), metal)
	c.pataDer = pieza("PataDerecha", Vector3.new(0.14, 0.9, 0.14), metal)

	-- La nieve de dentro: varias bolas de tamanos distintos, que un
	-- bloque liso no parece nieve echada a paladas.
	c.nieve = {}
	local sitios = {
		{ -0.55, -0.7, 1.0 }, { 0.5, -0.3, 0.95 }, { 0, 0.55, 1.15 },
		{ -0.35, 0.5, 0.85 }, { 0.45, 0.75, 0.8 },
	}
	for i, d in ipairs(sitios) do
		local b = pieza("Nieve" .. i, Vector3.new(1, 1, 1),
			Color3.fromRGB(247, 251, 255), Enum.Material.Snow, Enum.PartType.Ball)
		c.nieve[i] = { parte = b, dx = d[1], dz = d[2], escala = d[3] }
	end
	-- Y lo que rebosa por los bordes cuando ya no cabe mas.
	c.rebose = {}
	for i = 1, 3 do
		local b = pieza("Rebose" .. i, Vector3.new(0.7, 0.7, 0.7),
			Color3.fromRGB(247, 251, 255), Enum.Material.Snow, Enum.PartType.Ball)
		b.Transparency = 1
		c.rebose[i] = b
	end

	c.grupo = grupo
	c.piezas = piezas
	c.marco = nil
	c.giroRueda = 0
	c.vuelco = 0
	c.vuelcoObjetivo = 0
	grupo.Parent = adornos
	return c
end

local function colocarCarretilla(c, marco, carga)
	-- El armazon, colgado del marco que se mueve.
	local caja = marco * CFrame.new(0, 0, 0) * CFrame.Angles(math.rad(-c.vuelco), 0, 0)
	c.suelo.CFrame = caja * CFrame.new(0, -C.cajaAlto / 2, 0)
	c.izq.CFrame = caja * CFrame.new(-C.cajaAncho / 2, 0, 0)
	c.der.CFrame = caja * CFrame.new(C.cajaAncho / 2, 0, 0)
	c.tras.CFrame = caja * CFrame.new(0, 0, C.cajaLargo / 2)
	c.horquilla.CFrame = caja * CFrame.new(0, -C.cajaAlto / 2 - 0.25, -C.cajaLargo / 2 + 0.2)
	c.rueda.CFrame = caja
		* CFrame.new(0, -C.cajaAlto / 2 - 0.55, -C.cajaLargo / 2 - 0.35)
		* CFrame.Angles(0, 0, c.giroRueda)
	c.asaIzq.CFrame = caja * CFrame.new(-C.cajaAncho / 2 + 0.2, 0.1, C.cajaLargo / 2 + 1.1)
	c.asaDer.CFrame = caja * CFrame.new(C.cajaAncho / 2 - 0.2, 0.1, C.cajaLargo / 2 + 1.1)
	c.punoIzq.CFrame = caja * CFrame.new(-C.cajaAncho / 2 + 0.2, 0.1, C.cajaLargo / 2 + 2.2)
	c.punoDer.CFrame = caja * CFrame.new(C.cajaAncho / 2 - 0.2, 0.1, C.cajaLargo / 2 + 2.2)
	c.pataIzq.CFrame = caja * CFrame.new(-C.cajaAncho / 2 + 0.3, -C.cajaAlto / 2 - 0.5, C.cajaLargo / 2 - 0.2)
	c.pataDer.CFrame = caja * CFrame.new(C.cajaAncho / 2 - 0.3, -C.cajaAlto / 2 - 0.5, C.cajaLargo / 2 - 0.2)

	local alto = C.montonMinimo + (C.montonMaximo - C.montonMinimo) * carga
	for _, b in ipairs(c.nieve) do
		local tam = alto * b.escala
		b.parte.Size = Vector3.new(tam, tam, tam)
		b.parte.CFrame = caja * CFrame.new(b.dx, -C.cajaAlto / 2 + tam * 0.35, b.dz)
		b.parte.Transparency = carga > 0.02 and 0 or 1
	end
	-- Casi llena: se le cae por los bordes.
	local rebosa = carga >= C.rebosaDesde
	for i, b in ipairs(c.rebose) do
		b.Transparency = rebosa and 0.1 or 1
		if rebosa then
			local lado = (i == 1 and -1) or (i == 2 and 1) or 0
			b.CFrame = caja * CFrame.new(
				lado * (C.cajaAncho / 2 + 0.1),
				C.cajaAlto / 2 - 0.35,
				(i == 3) and -C.cajaLargo / 2 + 0.3 or (i - 1.5) * 0.8
			)
		end
	end
end

local function esconderCarretilla(c)
	for _, p in ipairs(c.piezas) do
		p.Transparency = 1
	end
end

local function mostrarCarretilla(c)
	for _, p in ipairs(c.piezas) do
		if not string.find(p.Name, "Nieve") and not string.find(p.Name, "Rebose") then
			p.Transparency = 0
		end
	end
end

local function repasarCarretilla(pers, dt)
	local raiz = pers:FindFirstChild("HumanoidRootPart")
	if not raiz then
		return
	end
	local c = carretillas[pers]
	if not c then
		c = nuevaCarretilla(pers)
		carretillas[pers] = c
	end
	if pers:GetAttribute("LlevaPala") == false then
		esconderCarretilla(c)
		c.marco = nil
		return
	end
	mostrarCarretilla(c)

	local destino = raiz.CFrame * CFrame.new(C.lado, -C.alto, C.atras)
	if not c.marco then
		c.marco = destino
	else
		-- Alcanza su sitio con retraso, no va pegada: por eso al arrancar
		-- se queda un poco atras y al girar se tuerce. Es lo que la hace
		-- parecer que pesa y que va detras de ti, no encima de ti.
		local paso = math.clamp(dt * C.seguimiento, 0, 1)
		c.marco = c.marco:Lerp(destino, paso)
		-- La rueda gira con lo que se ha andado de verdad.
		local avance = (c.marco.Position - (c.ultimoSitio or c.marco.Position)).Magnitude
		c.giroRueda = c.giroRueda + avance / C.ruedaRadio
	end
	c.ultimoSitio = c.marco.Position

	-- El vuelco, cuando se vacia.
	if c.vuelco ~= c.vuelcoObjetivo then
		local paso = math.clamp(dt / (c.vuelcoObjetivo > c.vuelco and C.vuelca or C.vuelve), 0, 1)
		c.vuelco = c.vuelco + (c.vuelcoObjetivo - c.vuelco) * math.min(1, paso * 3)
		if math.abs(c.vuelcoObjetivo - c.vuelco) < 0.4 then
			c.vuelco = c.vuelcoObjetivo
		end
	end

	colocarCarretilla(c, c.marco, pers:GetAttribute("Carga") or 0)
end

-- VACIAR: se inclina, suelta la nieve en varias masas, aguanta un
-- momento y se endereza. El momento de aguante es lo que hace que
-- vaciar se sienta como haber terminado algo.
local function volcarCarretilla(pers, monton)
	local c = carretillas[pers]
	if not c then
		return
	end
	c.vuelcoObjetivo = C.inclinacion
	local desde = c.marco and c.marco.Position or nil
	task.delay(C.vuelca, function()
		-- Si se ha ido a media animacion, su carretilla ya no existe:
		-- ni nieve que soltar ni nada que enderezar.
		if carretillas[pers] ~= c or not c.grupo.Parent then
			return
		end
		if desde and monton then
			for i = 1, 4 do
				local bola = trocito("NieveQueCae", Vector3.new(1.4, 1.4, 1.4),
					Color3.fromRGB(247, 251, 255), Enum.Material.Snow)
				bola.Shape = Enum.PartType.Ball
				bola.Transparency = 0
				local salida = desde + Vector3.new((i - 2.5) * 0.7, 0.4, 0)
				local caida = Vector3.new(monton.X, monton.Y + 1.5, monton.Z)
					+ Vector3.new((i - 2.5) * 1.1, 0, (i % 2) * 1.2)
				local t0 = os.clock()
				local hilo
				hilo = Correr.Heartbeat:Connect(function()
					if not bola.Parent then
						hilo:Disconnect()
						return
					end
					local p = math.clamp((os.clock() - t0) / 0.42, 0, 1)
					bola.CFrame = CFrame.new(salida:Lerp(caida, p) + Vector3.new(0, 3 * p * (1 - p), 0))
					bola.Transparency = p > 0.75 and (p - 0.75) * 4 or 0
					if p >= 1 then
						hilo:Disconnect()
						bola:Destroy()
					end
				end)
			end
		end
		task.wait(C.posa)
		c.vuelcoObjetivo = 0
	end)
end


local siguienteRepaso = 0

-- Un solo bucle para todo lo de mirar. La carretilla y el vuelco van a
-- cada fotograma (si no, no serian suaves); el abanico y las pisadas van
-- a ritmo corto, que pintar una marca no necesita sesenta veces por
-- segundo y en un movil se nota.
Correr.RenderStepped:Connect(function(dt)
	local ahora = os.clock()

	for pers, c in pairs(carretillas) do
		if not pers.Parent then
			c.grupo:Destroy()
			carretillas[pers] = nil
		end
	end
	for _, otro in ipairs(Jugadores:GetPlayers()) do
		if otro.Character then
			repasarCarretilla(otro.Character, dt)
		end
	end

	-- Las huellas se borran solas, tengan lo que tengan encima.
	for pers, t in pairs(pisadas) do
		if not pers.Parent then
			for _, h in ipairs(t.partes) do
				h.parte:Destroy()
			end
			pisadas[pers] = nil
		else
			for _, h in ipairs(t.partes) do
				if h.parte.Transparency < 1 then
					local edad = ahora - h.puesta
					if edad >= A.huellas.vida then
						h.parte.Transparency = 1
					else
						h.parte.Transparency = 0.35 + 0.65 * (edad / A.huellas.vida)
					end
				end
			end
		end
	end

	if ahora < siguienteRepaso then
		return
	end
	siguienteRepaso = ahora + 0.1
	excluir()

	-- EL ABANICO. Solo con la pala en la mano, solo si hay nieve delante
	-- y solo mientras apuntas o cavas: el resto del tiempo estorba.
	local pers = jugador.Character
	local raiz = pers and pers:FindFirstChild("HumanoidRootPart")
	if raiz and herramientaActual == "pala" and not conduciendo then
		local color = AZUL
		if bloqueadoAhora then
			-- Naranja: hay nieve, pero por la regla de la pendiente hay
			-- que ensanchar antes de seguir bajando.
			color = NARANJA_MARCA
		elseif paladaLlenaAhora then
			-- Dorado: la ultima palada se llevo una cucharada completa.
			color = ORO_MARCA
		end
		pintarAbanico(raiz, color)
	else
		esconderAbanico()
	end

	-- Y las pisadas de todo el que ande cerca, no solo las tuyas: ver por
	-- donde ha pasado el que te esta ayudando es la mitad de la gracia de
	-- jugar acompanado.
	local yo = raiz and raiz.Position
	for _, otro in ipairs(Jugadores:GetPlayers()) do
		local suyo = otro.Character
		local suRaiz = suyo and suyo:FindFirstChild("HumanoidRootPart")
		if suRaiz and (not yo or (suRaiz.Position - yo).Magnitude < 220) then
			pisar(suyo)
		end
	end
end)


-------------------------------------------------------------------
--  CON QUE SE ESTA JUGANDO
--
--  El boton redondo gigante es de movil. En un PC estorba y encima
--  esconde el pueblo; con un mando en la mano no lo pulsa nadie. Asi
--  que se mira con QUE se acaba de jugar y se ensena lo que
--  corresponde, y se cambia en cuanto el jugador cambia de trasto.
-------------------------------------------------------------------

local mando = "teclado"
local pistaHasta = 0

local function queEstoyUsando()
	local ultimo = Entrada:GetLastInputType()
	if ultimo == Enum.UserInputType.Touch then
		return "tactil"
	end
	if string.sub(ultimo.Name, 1, 7) == "Gamepad" then
		return "mando"
	end
	return "teclado"
end

local function ponerPistas()
	local antes = mando
	mando = queEstoyUsando()
	if mando ~= antes then
		-- Al cambiar de trasto, la pista vuelve a salir unos segundos:
		-- los mandos no son los mismos y lo que valia antes ya no vale.
		pistaHasta = os.clock() + 6
	end

	botonCavar.Visible = mando == "tactil" and not conduciendo
	pistaGatillo.Visible = mando == "mando" and not conduciendo
	pistaCavar.Text = mando == "mando" and T("mantenMando") or T("mantenPC")
	-- Con mando no se ensenan teclas: no tiene ninguna.
	pistaCavarPie.Visible = false
end

Entrada.LastInputTypeChanged:Connect(ponerPistas)

local function repasarCavado()
	local quiere = (porRaton or porTecla or porBoton) and not conduciendo
	if quiere == cavando then
		return
	end
	cavando = quiere
	botonCavar.BackgroundColor3 = quiere and ORO or colorBoton
	botonCavar.Size = quiere and UDim2.new(0, 138, 0, 138) or UDim2.new(0, 150, 0, 150)
	RemotoCavar:FireServer(quiere)
end

local function cambiarUtil()
	if not tengoSopladora or conduciendo then
		return
	end
	RemotoHerramienta:FireServer(herramientaActual == "pala" and "sopladora" or "pala")
end

Entrada.InputBegan:Connect(function(entrada, escrito)
	if escrito then
		return
	end
	if entrada.UserInputType == Enum.UserInputType.MouseButton1 then
		porRaton = true
	elseif entrada.KeyCode == Enum.KeyCode.E
		or entrada.KeyCode == Enum.KeyCode.ButtonR2 then
		-- Nada de espacio: el espacio salta, y cavar saltando es ridiculo.
		-- El gatillo derecho del mando hace lo mismo que la E.
		porTecla = true
	elseif entrada.KeyCode == Enum.KeyCode.Q then
		cambiarUtil()
		return
	end
	repasarCavado()
end)

Entrada.InputEnded:Connect(function(entrada)
	if entrada.UserInputType == Enum.UserInputType.MouseButton1 then
		porRaton = false
	elseif entrada.KeyCode == Enum.KeyCode.E
		or entrada.KeyCode == Enum.KeyCode.ButtonR2 then
		porTecla = false
	end
	repasarCavado()
end)

botonCavar.MouseButton1Down:Connect(function()
	porBoton = true
	repasarCavado()
end)
botonCavar.MouseButton1Up:Connect(function()
	porBoton = false
	repasarCavado()
end)
botonCavar.MouseLeave:Connect(function()
	porBoton = false
	repasarCavado()
end)


-- Sonido y avisos ---------------------------------------------------

local sonidos = {
	pala = nuevo("Sound", {
		Name = "Pala",
		SoundId = "rbxasset://sounds/action_footsteps_plastic.mp3",
		Volume = 0.35,
		PlaybackSpeed = 0.5,
	}, Sonidos),
	descarga = nuevo("Sound", {
		Name = "Descarga",
		SoundId = "rbxasset://sounds/impact_water.mp3",
		Volume = 0.6,
		PlaybackSpeed = 0.85,
	}, Sonidos),
	hallazgo = nuevo("Sound", {
		Name = "Hallazgo",
		SoundId = "rbxasset://sounds/action_jump_land.mp3",
		Volume = 0.8,
		PlaybackSpeed = 0.6,
	}, Sonidos),
	capitulo = nuevo("Sound", {
		Name = "Capitulo",
		SoundId = "rbxasset://sounds/action_jump.mp3",
		Volume = 0.7,
		PlaybackSpeed = 1.25,
	}, Sonidos),
}

local function sonar(clave)
	local sonido = sonidos[clave]
	if sonido then
		pcall(function()
			sonido:Play()
		end)
	end
end

-- La celebracion. Corta a proposito: ni corta el control ni para el
-- juego. Aparece, se lee de un vistazo y se va.
local function celebrar(nombre, color, arriba)
	local cartel = etiqueta({
		Name = "Hallazgo",
		Size = UDim2.new(0, 800, 0, 70),
		Position = UDim2.new(0.5, 0, arriba and 0.3 or 0.42, 0),
		AnchorPoint = Vector2.new(0.5, 0.5),
		Text = nombre,
		TextColor3 = color or ORO,
		TextSize = 44,
		Font = Enum.Font.GothamBlack,
		TextTransparency = 1,
	}, pantalla)
	nuevo("UIStroke", { Color = Color3.fromRGB(0, 0, 0), Thickness = 4, Transparency = 0.3 }, cartel)

	Tween:Create(cartel, TweenInfo.new(0.35, Enum.EasingStyle.Back, Enum.EasingDirection.Out), {
		TextTransparency = 0,
		Position = UDim2.new(0.5, 0, arriba and 0.25 or 0.36, 0),
	}):Play()
	task.delay(2.2, function()
		Tween:Create(cartel, TweenInfo.new(0.6), {
			TextTransparency = 1,
			Position = UDim2.new(0.5, 0, arriba and 0.19 or 0.28, 0),
		}):Play()
		task.delay(0.8, function()
			cartel:Destroy()
		end)
	end)
end

local function aviso(texto, color)
	local nota = etiqueta({
		Name = "Aviso",
		Size = UDim2.new(0, 480, 0, 44),
		Position = UDim2.new(0.5, 0, 0.62, 0),
		AnchorPoint = Vector2.new(0.5, 0.5),
		Text = texto,
		TextColor3 = color or BLANCO,
		TextSize = 30,
		Font = Enum.Font.GothamBlack,
	}, pantalla)
	Tween:Create(nota, TweenInfo.new(1.1), {
		Position = UDim2.new(0.5, 0, 0.52, 0),
		TextTransparency = 1,
	}):Play()
	task.delay(1.3, function()
		nota:Destroy()
	end)
end


-- El HUD, al ritmo del servidor -------------------------------------

local cargaAnterior = 0
local ultimoRaspado = 0
local capituloAnterior = nil

local function pintarUtiles(datos)
	local tiene = datos.tiene or {}
	tengoSopladora = tiene.sopladora == true
	herramientaActual = datos.herramienta or "pala"
	conduciendo = datos.conduciendo == true

	marcoUtiles.Visible = tengoSopladora and not conduciendo
	marcoVolante.Visible = conduciendo
	-- Quien decide si se ve el boton es ponerPistas(), segun con que se
	-- este jugando: aqui solo se apaga al subirse a la maquina.
	if conduciendo then
		botonCavar.Visible = false
		pistaGatillo.Visible = false
	end

	for clave, b in pairs(botonesUtil) do
		local puesta = clave == herramientaActual
		b.boton.BackgroundTransparency = puesta and 0 or 0.55
		b.borde.Transparency = puesta and 0 or 0.75
		b.boton.TextColor3 = puesta and b.color or Color3.fromRGB(150, 164, 186)
	end

	colorBoton = herramientaActual == "sopladora" and NARANJA or ACENTO
	if not cavando then
		botonCavar.BackgroundColor3 = colorBoton
	end
	botonCavar.Text = herramientaActual == "sopladora" and T("soplar") or T("cavar")

	-- Ni la sopladora ni el quitanieves llenan la carretilla: escupen la
	-- nieve a un lado. Con ellos, la barra de carga sobra.
	marcoCarga.Visible = herramientaActual ~= "sopladora" and not conduciendo

	if conduciendo then
		pistaConduce.Text = datos.atascado and T("atascado") or T("conduce")
		pistaConduce.TextColor3 = datos.atascado and Color3.fromRGB(255, 150, 120)
			or Color3.fromRGB(255, 226, 150)
	end
end

local function refrescar(datos)
	textoDinero.Text = tostring(datos.dinero or 0)
	pintarUtiles(datos)
	-- De que color se pinta el abanico de la pala.
	bloqueadoAhora = datos.bloqueado == true
	paladaLlenaAhora = datos.paladaLlena == true

	if datos.ajena then
		textoParcela.Text = string.format(T("ajena"), tostring(datos.ajena))
		textoParcela.TextColor3 = Color3.fromRGB(255, 206, 140)
	else
		textoParcela.Text = T("tuParcela")
		textoParcela.TextColor3 = Color3.fromRGB(170, 220, 255)
	end
	textoNube.Text = datos.nube and "" or T("sinGuardado")

	-- LA TORMENTA. Mientras cae, el HUD de la tormenta manda sobre el del
	-- guion: lo que importa ahora es que queda por despejar.
	local t = datos.tormenta
	ponerNevada(t ~= nil and t.fase ~= "calma")
	marcoTormenta.Visible = t ~= nil and t.fase ~= "calma"
	if t and t.fase ~= "calma" then
		if t.camion then
			tituloTormenta.Text = T("camionEnCamino")
			pieTormenta.Text = ""
		else
			tituloTormenta.Text = T("rutaTitulo")
			pieTormenta.Text = t.quedan == 1 and T("bloqueoUltimo")
				or string.format(T("bloqueosQuedan"), t.quedan)
		end
		for i, fila in ipairs(filasBloqueo) do
			local b = t.bloqueos[i]
			fila.Visible = b ~= nil
			if b then
				local util = A.herramientas[b.herramienta]
				local comoSeLlama = util and A.nombre(util.nombre, idioma) or ""
				if b.limpio then
					fila.Text = "OK   " .. A.nombre(b.nombre, idioma)
					fila.TextColor3 = Color3.fromRGB(150, 240, 170)
				else
					fila.Text = "-    " .. A.nombre(b.nombre, idioma) .. "  (" .. comoSeLlama .. ")"
					fila.TextColor3 = util and util.clave == "quitanieves" and Color3.fromRGB(255, 190, 90)
						or util and util.clave == "sopladora" and NARANJA
						or ACENTO
				end
			end
		end
	end

	local capacidad = math.max(1, datos.capacidad or 1)
	local carga = datos.carga or 0
	local lleno = carga >= capacidad
	Tween:Create(barraCarga, TweenInfo.new(0.18), {
		Size = UDim2.new(math.clamp(carga / capacidad, 0, 1), 0, 1, 0),
	}):Play()
	barraCarga.BackgroundColor3 = lleno and Color3.fromRGB(255, 128, 128) or ACENTO
	textoCarga.Text = lleno and T("lleno") or (T("carga") .. "  " .. tostring(carga) .. " / " .. tostring(capacidad))

	if carga > cargaAnterior and os.clock() - ultimoRaspado > 0.15 then
		ultimoRaspado = os.clock()
		sonar("pala")
	end
	cargaAnterior = carga

	-- La pista dura unos segundos y se va. Y no vuelve una vez has
	-- cavado: si ya has cavado, ya lo sabes.
	local yaSabe = (datos.nieveTotal or 0) > 0 or carga > 0
	if pistaHasta == 0 then
		pistaHasta = os.clock() + 8
	end
	ponerPistas()
	pistaCavar.Visible = mando ~= "tactil"
		and not yaSabe
		and not conduciendo
		and os.clock() < pistaHasta

	local cap = A.capitulo(datos.capitulo or "puerta")
	textoObjetivo.Text = A.nombre(cap.titulo, idioma)
	pieObjetivo.Text = A.nombre(cap.pie, idioma)
	if (datos.tormentas or 0) > 0 then
		pieObjetivo.Text = pieObjetivo.Text
			.. "    ·    " .. T("tormentasSuperadas") .. " " .. tostring(datos.tormentas)
	end
	-- Solo se celebra el capitulo de TU parcela: si no, ayudar a alguien
	-- te llenaria la pantalla de titulos que no son tuyos.
	if capituloAnterior and capituloAnterior ~= cap.clave and not datos.ajena then
		celebrar(A.nombre(cap.titulo, idioma), ACENTO, true)
		sonar("capitulo")
	end
	if not datos.ajena then
		capituloAnterior = cap.clave
	end

	local esperando = cap.clave == "sopladora"
	local alVolante = cap.clave == "quitanieves"
	marcoHondo.Visible = cap.clave ~= "fin"

	if datos.bloqueado then
		textoHondo.Text = T("ensancha")
		textoHondo.TextColor3 = Color3.fromRGB(255, 196, 120)
	elseif datos.soloPala then
		textoHondo.Text = T("soloPala")
		textoHondo.TextColor3 = NARANJA
	elseif esperando then
		textoHondo.Text = T("cogela")
		textoHondo.TextColor3 = NARANJA
	elseif alVolante then
		textoHondo.Text = T("alQuitanieves")
		textoHondo.TextColor3 = NARANJA
	else
		local capas = datos.capasObjetivo or 0
		if capas <= 0 then
			textoHondo.Text = T("despejado")
			textoHondo.TextColor3 = Color3.fromRGB(150, 240, 170)
		else
			textoHondo.Text = string.format(T("profundidad"), capas)
			textoHondo.TextColor3 = Color3.fromRGB(206, 224, 246)
		end
	end
end

RemotoEstado.OnClientEvent:Connect(function(datos)
	if type(datos) ~= "table" then
		return
	end
	local ok, err = pcall(refrescar, datos)
	if not ok then
		warn("[kali] fallo al pintar: " .. tostring(err))
	end
end)

RemotoAviso.OnClientEvent:Connect(function(datos)
	if type(datos) ~= "table" then
		return
	end
	if datos.tipo == "hallazgo" then
		celebrar(T("descubierto") .. "  " .. A.nombre(datos.nombre, idioma), ORO, false)
		sonar("hallazgo")
	elseif datos.tipo == "descarga" then
		-- El "+dinero" y el sonido son de quien vacia: el dinero es suyo.
		if datos.quien == jugador then
			aviso("+" .. tostring(datos.cantidad or 0), ORO)
			sonar("descarga")
		end
		-- La carretilla se vuelca a la vista de TODOS los que esten en la
		-- parcela, la del que vacia: se inclina, suelta la nieve en
		-- varias masas sobre el monton, aguanta un momento y se
		-- endereza. Ese momento de aguante es lo que hace que vaciar se
		-- sienta como haber terminado algo y no como que un numero se
		-- ponga a cero, y verselo hacer al otro es lo que explica de
		-- donde ha salido esa nieve.
		--
		-- Puede llegar cuando el que vaciaba ya se ha ido: entonces no
		-- hay personaje al que inclinar y no pasa nada.
		local suyo = datos.quien and datos.quien.Character
		if suyo then
			volcarCarretilla(suyo, datos.monton)
		end
	elseif datos.tipo == "cogida" then
		aviso(T("cogida"), NARANJA)
		sonar("capitulo")
	elseif datos.tipo == "quitanieves" then
		aviso(T("llaves"), ORO)
		sonar("capitulo")
	elseif datos.tipo == "tormentaViene" then
		celebrar(T("tormentaViene"), Color3.fromRGB(160, 200, 255), true)
		aviso(T("tormentaVienePie"), Color3.fromRGB(190, 216, 255))
		sonar("capitulo")
	elseif datos.tipo == "arbol" then
		celebrar(T("arbolCaido"), Color3.fromRGB(255, 170, 120), false)
		aviso(T("arbolPie"), Color3.fromRGB(255, 200, 160))
		sonar("hallazgo")
	elseif datos.tipo == "bloqueoLimpio" then
		aviso(T("despejado1") .. "  " .. A.nombre(datos.nombre, idioma), Color3.fromRGB(150, 240, 170))
		sonar("hallazgo")
	elseif datos.tipo == "camionEnCamino" then
		celebrar(T("camionEnCamino"), ORO, true)
		sonar("capitulo")
	elseif datos.tipo == "camionLlega" then
		celebrar(T("camionLlega"), ORO, false)
		sonar("hallazgo")
	elseif datos.tipo == "tormentaFin" then
		celebrar(T("tormentaFin"), Color3.fromRGB(180, 230, 255), true)
		sonar("capitulo")
	elseif datos.tipo == "baliza" then
		aviso(T("balizaNueva"), Color3.fromRGB(255, 150, 80))
		sonar("capitulo")
	elseif datos.tipo == "ayuntamiento" then
		celebrar(T("ayuntamiento"), ORO, false)
		sonar("hallazgo")
	end
end)
