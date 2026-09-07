--[[
	DESENTIERRA  —  cliente

	Lo que ve el jugador. Lo unico que de verdad importa aqui: que en todo
	momento sepa que esta buscando, y que cuando aparezca la puerta se
	entere de que ha pasado algo.
]]

local Jugadores = game:GetService("Players")
local RS = game:GetService("ReplicatedStorage")
local Tween = game:GetService("TweenService")
local Idiomas = game:GetService("LocalizationService")
local Sonidos = game:GetService("SoundService")
local Interfaz = game:GetService("StarterGui")
local Entrada = game:GetService("UserInputService")

local jugador = Jugadores.LocalPlayer
local A = require(RS:WaitForChild("AjustesV2"))

local remotos = RS:WaitForChild("DesenterrarRemotos")
local RemotoEstado = remotos:WaitForChild("Estado")
local RemotoAviso = remotos:WaitForChild("Aviso")
local RemotoCavar = remotos:WaitForChild("Cavar")

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
	Name = "DesenterrarHUD",
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


-- El objetivo -------------------------------------------------------

local marcoObjetivo = panel({
	Name = "Objetivo",
	Size = UDim2.new(0, 480, 0, 74),
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
	Text = T("objetivo1"),
	TextSize = 23,
	Font = Enum.Font.GothamBlack,
	TextColor3 = ACENTO,
}, marcoObjetivo)

local pieObjetivo = etiqueta({
	Name = "Pie",
	Size = UDim2.new(1, -24, 0, 22),
	Position = UDim2.new(0, 12, 0, 44),
	Text = T("objetivo1pie"),
	TextSize = 15,
	Font = Enum.Font.Gotham,
	TextColor3 = Color3.fromRGB(198, 216, 238),
}, marcoObjetivo)

Tween:Create(
	bordeObjetivo,
	TweenInfo.new(1, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut, -1, true),
	{ Transparency = 0.75 }
):Play()

-- Cuanta nieve queda encima de la puerta: es la barra de progreso de
-- verdad de este capitulo.
local marcoHondo = panel({
	Name = "Profundidad",
	Size = UDim2.new(0, 300, 0, 40),
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

local cavando = false
local porRaton, porTecla, porBoton = false, false, false

local function repasarCavado()
	local quiere = porRaton or porTecla or porBoton
	if quiere == cavando then
		return
	end
	cavando = quiere
	botonCavar.BackgroundColor3 = quiere and Color3.fromRGB(255, 208, 92) or ACENTO
	botonCavar.Size = quiere and UDim2.new(0, 138, 0, 138) or UDim2.new(0, 150, 0, 150)
	RemotoCavar:FireServer(quiere)
end

Entrada.InputBegan:Connect(function(entrada, escrito)
	if escrito then
		return
	end
	if entrada.UserInputType == Enum.UserInputType.MouseButton1 then
		porRaton = true
	elseif entrada.KeyCode == Enum.KeyCode.Space or entrada.KeyCode == Enum.KeyCode.E then
		porTecla = true
	end
	repasarCavado()
end)

Entrada.InputEnded:Connect(function(entrada)
	if entrada.UserInputType == Enum.UserInputType.MouseButton1 then
		porRaton = false
	elseif entrada.KeyCode == Enum.KeyCode.Space or entrada.KeyCode == Enum.KeyCode.E then
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
}

local function sonar(clave)
	local sonido = sonidos[clave]
	if sonido then
		pcall(function()
			sonido:Play()
		end)
	end
end

-- La celebracion. Es todo el punto del capitulo: si esto no emociona,
-- no hay juego.
local function celebrar(nombre)
	local cartel = etiqueta({
		Name = "Hallazgo",
		Size = UDim2.new(0, 700, 0, 70),
		Position = UDim2.new(0.5, 0, 0.42, 0),
		AnchorPoint = Vector2.new(0.5, 0.5),
		Text = T("descubierto") .. "  " .. nombre,
		TextColor3 = ORO,
		TextSize = 46,
		Font = Enum.Font.GothamBlack,
		TextTransparency = 1,
	}, pantalla)
	nuevo("UIStroke", { Color = Color3.fromRGB(0, 0, 0), Thickness = 4, Transparency = 0.3 }, cartel)

	Tween:Create(cartel, TweenInfo.new(0.35, Enum.EasingStyle.Back, Enum.EasingDirection.Out), {
		TextTransparency = 0,
		Position = UDim2.new(0.5, 0, 0.36, 0),
	}):Play()
	task.delay(2.2, function()
		Tween:Create(cartel, TweenInfo.new(0.6), {
			TextTransparency = 1,
			Position = UDim2.new(0.5, 0, 0.28, 0),
		}):Play()
		task.delay(0.8, function()
			cartel:Destroy()
		end)
	end)
	sonar("hallazgo")
end

local function aviso(texto, color)
	local nota = etiqueta({
		Name = "Aviso",
		Size = UDim2.new(0, 300, 0, 44),
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

local function refrescar(datos)
	textoDinero.Text = tostring(datos.dinero or 0)

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

	-- La pista de "manten pulsado" solo hasta que se entera.
	local yaSabe = (datos.nieveTotal or 0) > 0 or carga > 0
	pistaCavar.Visible = not yaSabe
	pistaCavarPie.Visible = not yaSabe

	local capas = datos.capasPuerta or 0
	local hallazgos = datos.hallazgos or {}
	if hallazgos.puerta then
		textoObjetivo.Text = T("objetivoFin")
		pieObjetivo.Text = T("objetivoFinPie")
		marcoHondo.Visible = false
	else
		if hallazgos.tejado then
			textoObjetivo.Text = T("objetivo2")
			pieObjetivo.Text = T("objetivo2pie")
		else
			textoObjetivo.Text = T("objetivo1")
			pieObjetivo.Text = T("objetivo1pie")
		end
		marcoHondo.Visible = true
		if datos.bloqueado then
			textoHondo.Text = T("ensancha")
			textoHondo.TextColor3 = Color3.fromRGB(255, 196, 120)
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
		warn("[desenterrar] fallo al pintar: " .. tostring(err))
	end
end)

RemotoAviso.OnClientEvent:Connect(function(datos)
	if type(datos) ~= "table" then
		return
	end
	if datos.tipo == "hallazgo" then
		celebrar(A.nombre(datos.nombre, idioma))
	elseif datos.tipo == "descarga" then
		aviso("+" .. tostring(datos.cantidad or 0), ORO)
		sonar("descarga")
	end
end)
