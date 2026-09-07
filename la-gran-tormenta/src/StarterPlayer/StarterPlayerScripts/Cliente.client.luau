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

local jugador = Jugadores.LocalPlayer
local A = require(RS:WaitForChild("Ajustes"))

local remotos = RS:WaitForChild("RemotosTormenta")
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
	elseif entrada.KeyCode == Enum.KeyCode.E then
		-- Nada de espacio: el espacio salta, y cavar saltando es ridiculo.
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
	elseif entrada.KeyCode == Enum.KeyCode.E then
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
	botonCavar.Visible = not conduciendo

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

	local yaSabe = (datos.nieveTotal or 0) > 0 or carga > 0
	pistaCavar.Visible = not yaSabe and not conduciendo
	pistaCavarPie.Visible = pistaCavar.Visible

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
		warn("[tormenta] fallo al pintar: " .. tostring(err))
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
		aviso("+" .. tostring(datos.cantidad or 0), ORO)
		sonar("descarga")
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
