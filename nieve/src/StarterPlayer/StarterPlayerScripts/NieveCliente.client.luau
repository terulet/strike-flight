--[[
	¡QUITA TODA LA NIEVE!  —  cliente

	El HUD, el panel de mejoras y los avisos. No decide nada: pide y
	enseña lo que le manda el servidor.

	La interfaz se construye por codigo, asi que no hay que dibujar
	nada en Studio.

	Este archivo va en:  StarterPlayer > StarterPlayerScripts
	                     (LocalScript, nombre "NieveCliente")
]]

local Jugadores = game:GetService("Players")
local RS = game:GetService("ReplicatedStorage")
local Tween = game:GetService("TweenService")
local Correr = game:GetService("RunService")
local Idiomas = game:GetService("LocalizationService")
local Sonidos = game:GetService("SoundService")
local Interfaz = game:GetService("StarterGui")

local jugador = Jugadores.LocalPlayer
local A = require(RS:WaitForChild("AjustesNieve"))

local remotos = RS:WaitForChild("NieveRemotos")
local RemotoEstado = remotos:WaitForChild("Estado")
local RemotoAviso = remotos:WaitForChild("Aviso")
local RemotoComprar = remotos:WaitForChild("Comprar")


-------------------------------------------------------------------
--  IDIOMA Y NUMEROS
-------------------------------------------------------------------

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

local nombreZona = {}
for _, def in ipairs(A.zonas) do
	nombreZona[def.clave] = A.nombre(def.nombre, idioma)
end

local nombreMejora = {}
local descMejora = {}
for _, def in ipairs(A.mejoras) do
	nombreMejora[def.clave] = A.nombre(def.nombre, idioma)
	descMejora[def.clave] = A.nombre(def.desc, idioma)
end

-- El formateo de numeros vive en los ajustes: lo comparten HUD y carteles.
local formatear = A.formatear


-------------------------------------------------------------------
--  PIEZAS DE INTERFAZ
-------------------------------------------------------------------

local FONDO = Color3.fromRGB(14, 20, 32)
local ACENTO = Color3.fromRGB(120, 205, 255)
local ORO = Color3.fromRGB(255, 208, 92)
local VERDE = Color3.fromRGB(126, 232, 156)
local ROJO = Color3.fromRGB(255, 128, 128)
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

local function redondear(obj, radio)
	nuevo("UICorner", { CornerRadius = UDim.new(0, radio or 14) }, obj)
end

local function panel(props, padre)
	-- __radio es nuestro, no una propiedad de Roblox: fuera antes de crear nada.
	local radio = props.__radio or 14
	props.__radio = nil
	local marco = nuevo("Frame", props, padre)
	marco.BorderSizePixel = 0
	redondear(marco, radio)
	nuevo("UIStroke", {
		Color = BLANCO,
		Transparency = 0.86,
		Thickness = 1.5,
	}, marco)
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
	Name = "NieveHUD",
	ResetOnSpawn = false,
	ZIndexBehavior = Enum.ZIndexBehavior.Sibling,
}, jugador:WaitForChild("PlayerGui"))


-------------------------------------------------------------------
--  DINERO (arriba a la izquierda)
-------------------------------------------------------------------

local marcoDinero = panel({
	Name = "Dinero",
	Size = UDim2.new(0, 216, 0, 54),
	Position = UDim2.new(0, 14, 0, 14),
	BackgroundColor3 = FONDO,
	BackgroundTransparency = 0.12,
}, pantalla)

local moneda = nuevo("Frame", {
	Name = "Moneda",
	Size = UDim2.new(0, 26, 0, 26),
	Position = UDim2.new(0, 14, 0.5, 0),
	AnchorPoint = Vector2.new(0, 0.5),
	BackgroundColor3 = ORO,
	BorderSizePixel = 0,
}, marcoDinero)
nuevo("UICorner", { CornerRadius = UDim.new(1, 0) }, moneda)
nuevo("UIStroke", { Color = Color3.fromRGB(176, 128, 32), Thickness = 2 }, moneda)

local textoDinero = etiqueta({
	Name = "Texto",
	Size = UDim2.new(1, -56, 1, 0),
	Position = UDim2.new(0, 48, 0, 0),
	Text = "0",
	TextColor3 = ORO,
	TextXAlignment = Enum.TextXAlignment.Left,
	Font = Enum.Font.GothamBlack,
	TextSize = 26,
}, marcoDinero)

local textoMultiplicador = etiqueta({
	Name = "Multi",
	Size = UDim2.new(0, 60, 1, 0),
	Position = UDim2.new(1, -68, 0, 0),
	Text = "",
	TextColor3 = VERDE,
	TextXAlignment = Enum.TextXAlignment.Right,
	TextSize = 18,
}, marcoDinero)


-------------------------------------------------------------------
--  ZONA (arriba en medio)
-------------------------------------------------------------------

local marcoZona = panel({
	Name = "Zona",
	Size = UDim2.new(0, 300, 0, 60),
	Position = UDim2.new(0.5, 0, 0, 14),
	AnchorPoint = Vector2.new(0.5, 0),
	BackgroundColor3 = FONDO,
	BackgroundTransparency = 0.12,
}, pantalla)

local textoZona = etiqueta({
	Name = "Nombre",
	Size = UDim2.new(1, -110, 0, 26),
	Position = UDim2.new(0, 12, 0, 6),
	Text = "",
	TextSize = 19,
	TextXAlignment = Enum.TextXAlignment.Left,
	Font = Enum.Font.GothamBlack,
}, marcoZona)

-- El porcentaje fuera de la barra: encima del relleno azul no se leia.
local textoProgreso = etiqueta({
	Name = "Porcentaje",
	Size = UDim2.new(0, 96, 0, 26),
	Position = UDim2.new(1, -12, 0, 6),
	AnchorPoint = Vector2.new(1, 0),
	Text = "",
	TextSize = 15,
	TextXAlignment = Enum.TextXAlignment.Right,
	TextColor3 = ACENTO,
}, marcoZona)

local canalProgreso = nuevo("Frame", {
	Name = "Canal",
	Size = UDim2.new(1, -24, 0, 12),
	Position = UDim2.new(0, 12, 0, 36),
	BackgroundColor3 = Color3.fromRGB(40, 50, 68),
	BorderSizePixel = 0,
}, marcoZona)
redondear(canalProgreso, 6)

local barraProgreso = nuevo("Frame", {
	Name = "Relleno",
	Size = UDim2.new(0, 0, 1, 0),
	BackgroundColor3 = ACENTO,
	BorderSizePixel = 0,
}, canalProgreso)
redondear(barraProgreso, 6)


-------------------------------------------------------------------
--  LA GUIA
--
--  Un juego de estos se pierde en los primeros diez segundos. Si no
--  sabes que hacer, te vas. Asi que hay un cartel grande que dice lo
--  siguiente que toca, y NO se quita por tiempo: se quita cuando lo
--  haces.
-------------------------------------------------------------------

local marcoGuia = panel({
	Name = "Guia",
	Size = UDim2.new(0, 460, 0, 72),
	Position = UDim2.new(0.5, 0, 0, 84),
	AnchorPoint = Vector2.new(0.5, 0),
	BackgroundColor3 = Color3.fromRGB(18, 40, 62),
	BackgroundTransparency = 0.08,
	Visible = false,
}, pantalla)

local bordeGuia = nuevo("UIStroke", {
	Color = ACENTO,
	Thickness = 3,
	Transparency = 0.1,
}, marcoGuia)

local textoGuia = etiqueta({
	Name = "Titulo",
	Size = UDim2.new(1, -24, 0, 34),
	Position = UDim2.new(0, 12, 0, 10),
	Text = "",
	TextSize = 24,
	Font = Enum.Font.GothamBlack,
	TextColor3 = ACENTO,
}, marcoGuia)

local pieGuia = etiqueta({
	Name = "Pie",
	Size = UDim2.new(1, -24, 0, 22),
	Position = UDim2.new(0, 12, 0, 44),
	Text = "",
	TextSize = 16,
	Font = Enum.Font.Gotham,
	TextColor3 = Color3.fromRGB(198, 216, 238),
}, marcoGuia)

-- Late, para que se mire.
Tween:Create(
	bordeGuia,
	TweenInfo.new(0.9, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut, -1, true),
	{ Transparency = 0.75 }
):Play()


-------------------------------------------------------------------
--  CARGA (abajo en medio)
-------------------------------------------------------------------

local marcoCarga = panel({
	Name = "Carga",
	Size = UDim2.new(0, 340, 0, 50),
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
redondear(canalCarga, 10)

local barraCarga = nuevo("Frame", {
	Name = "Relleno",
	Size = UDim2.new(0, 0, 1, 0),
	BackgroundColor3 = ACENTO,
	BorderSizePixel = 0,
}, canalCarga)
redondear(barraCarga, 10)

local textoCarga = etiqueta({
	Name = "Texto",
	Size = UDim2.new(1, -16, 1, 0),
	Position = UDim2.new(0, 10, 0, 0),
	Text = "",
	TextSize = 18,
	TextXAlignment = Enum.TextXAlignment.Left,
}, canalCarga)

local textoValor = etiqueta({
	Name = "Valor",
	Size = UDim2.new(0, 120, 1, 0),
	Position = UDim2.new(1, -130, 0, 0),
	Text = "",
	TextSize = 18,
	TextColor3 = ORO,
	TextXAlignment = Enum.TextXAlignment.Right,
}, canalCarga)

local textoPista = etiqueta({
	Name = "Pista",
	Size = UDim2.new(0, 460, 0, 26),
	Position = UDim2.new(0.5, 0, 1, -80),
	AnchorPoint = Vector2.new(0.5, 1),
	Text = "",
	TextSize = 17,
	TextColor3 = Color3.fromRGB(214, 230, 250),
	TextTransparency = 0,
}, pantalla)
nuevo("UIStroke", { Color = Color3.fromRGB(0, 0, 0), Thickness = 2, Transparency = 0.35 }, textoPista)


-------------------------------------------------------------------
--  BOTONES DE LA DERECHA
-------------------------------------------------------------------

local botonMejoras = nuevo("TextButton", {
	Name = "BotonMejoras",
	Size = UDim2.new(0, 138, 0, 58),
	Position = UDim2.new(1, -16, 0.5, 44),
	AnchorPoint = Vector2.new(1, 0.5),
	BackgroundColor3 = ACENTO,
	BorderSizePixel = 0,
	Text = T("mejoras"),
	TextColor3 = Color3.fromRGB(8, 16, 28),
	Font = Enum.Font.GothamBlack,
	TextSize = 20,
	AutoButtonColor = true,
}, pantalla)
redondear(botonMejoras, 16)

local botonRenacer = nuevo("TextButton", {
	Name = "BotonRenacer",
	Size = UDim2.new(0, 138, 0, 58),
	Position = UDim2.new(1, -16, 0.5, -24),
	AnchorPoint = Vector2.new(1, 0.5),
	BackgroundColor3 = ORO,
	BorderSizePixel = 0,
	Text = T("renacer"),
	TextColor3 = Color3.fromRGB(38, 26, 4),
	Font = Enum.Font.GothamBlack,
	TextSize = 20,
	AutoButtonColor = true,
	Visible = false,
}, pantalla)
redondear(botonRenacer, 16)


-------------------------------------------------------------------
--  PANEL DE MEJORAS
-------------------------------------------------------------------

local panelMejoras = panel({
	Name = "PanelMejoras",
	Size = UDim2.new(0, 380, 0.82, 0),
	Position = UDim2.new(0.5, 0, 0.5, 0),
	AnchorPoint = Vector2.new(0.5, 0.5),
	BackgroundColor3 = FONDO,
	BackgroundTransparency = 0.05,
	Visible = false,
}, pantalla)

nuevo("UISizeConstraint", {
	MaxSize = Vector2.new(380, 520),
	MinSize = Vector2.new(300, 260),
}, panelMejoras)

etiqueta({
	Name = "Titulo",
	Size = UDim2.new(1, -70, 0, 40),
	Position = UDim2.new(0, 18, 0, 10),
	Text = T("mejoras"),
	TextXAlignment = Enum.TextXAlignment.Left,
	TextSize = 24,
	Font = Enum.Font.GothamBlack,
}, panelMejoras)

local botonCerrar = nuevo("TextButton", {
	Name = "Cerrar",
	Size = UDim2.new(0, 38, 0, 38),
	Position = UDim2.new(1, -14, 0, 12),
	AnchorPoint = Vector2.new(1, 0),
	BackgroundColor3 = Color3.fromRGB(48, 58, 78),
	BorderSizePixel = 0,
	Text = "X",
	TextColor3 = BLANCO,
	Font = Enum.Font.GothamBlack,
	TextSize = 18,
}, panelMejoras)
redondear(botonCerrar, 12)

local lista = nuevo("ScrollingFrame", {
	Name = "Lista",
	Size = UDim2.new(1, -28, 1, -70),
	Position = UDim2.new(0, 14, 0, 58),
	BackgroundTransparency = 1,
	BorderSizePixel = 0,
	CanvasSize = UDim2.new(0, 0, 0, 0),
	AutomaticCanvasSize = Enum.AutomaticSize.Y,
	ScrollingDirection = Enum.ScrollingDirection.Y,
	ScrollBarThickness = 6,
	ScrollBarImageColor3 = ACENTO,
}, panelMejoras)

nuevo("UIPadding", { PaddingRight = UDim.new(0, 10) }, lista)

nuevo("UIListLayout", {
	Padding = UDim.new(0, 10),
	SortOrder = Enum.SortOrder.LayoutOrder,
}, lista)

local filas = {}

for orden, def in ipairs(A.mejoras) do
	local fila = panel({
		Name = def.clave,
		Size = UDim2.new(1, 0, 0, 80),
		BackgroundColor3 = Color3.fromRGB(24, 32, 48),
		BackgroundTransparency = 0.1,
		LayoutOrder = orden,
		__radio = 12,
	}, lista)

	local nombre = etiqueta({
		Name = "Nombre",
		Size = UDim2.new(1, -150, 0, 24),
		Position = UDim2.new(0, 14, 0, 10),
		Text = nombreMejora[def.clave],
		TextXAlignment = Enum.TextXAlignment.Left,
		TextColor3 = def.color,
		TextSize = 18,
		Font = Enum.Font.GothamBlack,
	}, fila)

	etiqueta({
		Name = "Desc",
		Size = UDim2.new(1, -150, 0, 20),
		Position = UDim2.new(0, 14, 0, 34),
		Text = descMejora[def.clave],
		TextXAlignment = Enum.TextXAlignment.Left,
		TextColor3 = Color3.fromRGB(168, 184, 206),
		TextSize = 14,
		Font = Enum.Font.Gotham,
	}, fila)

	local nivel = etiqueta({
		Name = "Nivel",
		Size = UDim2.new(1, -150, 0, 18),
		Position = UDim2.new(0, 14, 0, 54),
		Text = "",
		TextXAlignment = Enum.TextXAlignment.Left,
		TextColor3 = Color3.fromRGB(140, 156, 180),
		TextSize = 13,
		Font = Enum.Font.Gotham,
	}, fila)

	local boton = nuevo("TextButton", {
		Name = "Comprar",
		Size = UDim2.new(0, 124, 0, 56),
		Position = UDim2.new(1, -12, 0.5, 0),
		AnchorPoint = Vector2.new(1, 0.5),
		BackgroundColor3 = VERDE,
		BorderSizePixel = 0,
		Text = "",
		TextColor3 = Color3.fromRGB(8, 24, 14),
		Font = Enum.Font.GothamBlack,
		TextSize = 17,
		AutoButtonColor = true,
	}, fila)
	redondear(boton, 12)

	boton.Activated:Connect(function()
		RemotoComprar:FireServer("mejora", def.clave)
	end)

	filas[def.clave] = { fila = fila, nombre = nombre, nivel = nivel, boton = boton, def = def }
end

local filaRenacer = panel({
	Name = "renacer",
	Size = UDim2.new(1, 0, 0, 80),
	BackgroundColor3 = Color3.fromRGB(40, 34, 14),
	BackgroundTransparency = 0.1,
	LayoutOrder = 99,
	__radio = 12,
}, lista)

etiqueta({
	Name = "Nombre",
	Size = UDim2.new(1, -150, 0, 24),
	Position = UDim2.new(0, 14, 0, 12),
	Text = T("renacer"),
	TextXAlignment = Enum.TextXAlignment.Left,
	TextColor3 = ORO,
	TextSize = 18,
	Font = Enum.Font.GothamBlack,
}, filaRenacer)

local descRenacer = etiqueta({
	Name = "Desc",
	Size = UDim2.new(1, -150, 0, 38),
	Position = UDim2.new(0, 14, 0, 34),
	Text = "",
	TextXAlignment = Enum.TextXAlignment.Left,
	TextYAlignment = Enum.TextYAlignment.Top,
	TextColor3 = Color3.fromRGB(196, 180, 140),
	TextSize = 13,
	TextWrapped = true,
	Font = Enum.Font.Gotham,
}, filaRenacer)

local botonRenacerPanel = nuevo("TextButton", {
	Name = "Comprar",
	Size = UDim2.new(0, 124, 0, 56),
	Position = UDim2.new(1, -12, 0.5, 0),
	AnchorPoint = Vector2.new(1, 0.5),
	BackgroundColor3 = ORO,
	BorderSizePixel = 0,
	Text = "",
	TextColor3 = Color3.fromRGB(38, 26, 4),
	Font = Enum.Font.GothamBlack,
	TextSize = 17,
	AutoButtonColor = true,
}, filaRenacer)
redondear(botonRenacerPanel, 12)


-------------------------------------------------------------------
--  CODIGOS
-------------------------------------------------------------------

local filaCodigo = panel({
	Name = "codigo",
	Size = UDim2.new(1, 0, 0, 88),
	BackgroundColor3 = Color3.fromRGB(18, 34, 28),
	BackgroundTransparency = 0.1,
	LayoutOrder = 100,
	__radio = 12,
}, lista)

etiqueta({
	Name = "Nombre",
	Size = UDim2.new(1, -28, 0, 22),
	Position = UDim2.new(0, 14, 0, 8),
	Text = T("codigos"),
	TextXAlignment = Enum.TextXAlignment.Left,
	TextColor3 = VERDE,
	TextSize = 17,
	Font = Enum.Font.GothamBlack,
}, filaCodigo)

local cajaCodigo = nuevo("TextBox", {
	Name = "Caja",
	Size = UDim2.new(1, -150, 0, 44),
	Position = UDim2.new(0, 14, 0, 34),
	BackgroundColor3 = Color3.fromRGB(10, 16, 26),
	BorderSizePixel = 0,
	Text = "",
	PlaceholderText = T("codigoCaja"),
	PlaceholderColor3 = Color3.fromRGB(122, 138, 160),
	ClearTextOnFocus = false,
	TextColor3 = BLANCO,
	Font = Enum.Font.GothamBold,
	TextSize = 16,
}, filaCodigo)
redondear(cajaCodigo, 10)

local botonCodigo = nuevo("TextButton", {
	Name = "Canjear",
	Size = UDim2.new(0, 124, 0, 44),
	Position = UDim2.new(1, -12, 0, 34),
	AnchorPoint = Vector2.new(1, 0),
	BackgroundColor3 = VERDE,
	BorderSizePixel = 0,
	Text = T("canjear"),
	TextColor3 = Color3.fromRGB(8, 24, 14),
	Font = Enum.Font.GothamBlack,
	TextSize = 16,
	AutoButtonColor = true,
}, filaCodigo)
redondear(botonCodigo, 12)

local function enviarCodigo()
	local texto = cajaCodigo.Text
	if texto and texto ~= "" then
		RemotoComprar:FireServer("codigo", texto)
		cajaCodigo.Text = ""
	end
end

botonCodigo.Activated:Connect(enviarCodigo)
cajaCodigo.FocusLost:Connect(function(intro)
	if intro then
		enviarCodigo()
	end
end)


local function alternarPanel(abierto)
	panelMejoras.Visible = abierto
end

botonMejoras.Activated:Connect(function()
	alternarPanel(not panelMejoras.Visible)
end)
botonCerrar.Activated:Connect(function()
	alternarPanel(false)
end)
botonRenacer.Activated:Connect(function()
	alternarPanel(true)
end)
botonRenacerPanel.Activated:Connect(function()
	RemotoComprar:FireServer("renacer")
end)


-------------------------------------------------------------------
--  AVISOS
-------------------------------------------------------------------

-- Un Sound por cada aviso, montados una vez.
local sonidos = {}
for clave, def in pairs(A.sonidos) do
	sonidos[clave] = nuevo("Sound", {
		Name = "Nieve_" .. clave,
		SoundId = def.id,
		Volume = def.volumen or 0.5,
		PlaybackSpeed = def.tono or 1,
	}, Sonidos)
end

-- Un pelin de variacion en el tono, o repetido cansa enseguida.
local function sonar(clave, variacion)
	local sonido = sonidos[clave]
	local def = A.sonidos[clave]
	if not sonido or not def then
		return
	end
	pcall(function()
		if variacion then
			sonido.PlaybackSpeed = (def.tono or 1) * (0.9 + math.random() * 0.2)
		end
		sonido:Play()
	end)
end

local function aviso(texto, color)
	if texto == nil or texto == "" then
		return
	end

	-- Si ya hay avisos en el aire, este sale un poco mas arriba: dos
	-- mensajes a la vez no pueden caer en el mismo sitio.
	local vivos = 0
	for _, hijo in ipairs(pantalla:GetChildren()) do
		if hijo.Name == "Aviso" then
			vivos = vivos + 1
		end
	end
	local desvio = math.min(vivos, 3) * 46

	local nota = etiqueta({
		Name = "Aviso",
		Size = UDim2.new(0, 320, 0, 44),
		Position = UDim2.new(0.5, 0, 0.62, -desvio),
		AnchorPoint = Vector2.new(0.5, 0.5),
		Text = texto,
		TextColor3 = color or BLANCO,
		TextSize = 30,
		Font = Enum.Font.GothamBlack,
	}, pantalla)
	nuevo("UIStroke", { Color = Color3.fromRGB(0, 0, 0), Thickness = 3, Transparency = 0.4 }, nota)

	Tween:Create(nota, TweenInfo.new(1.1, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), {
		Position = UDim2.new(0.5, 0, 0.5, -desvio),
		TextTransparency = 1,
	}):Play()
	task.delay(1.3, function()
		nota:Destroy()
	end)
end

local pistaHasta = 0
local pistasVistas = {}

local function pista(clave, segundos)
	if pistasVistas[clave] then
		return
	end
	pistasVistas[clave] = true
	textoPista.Text = T(clave)
	pistaHasta = os.clock() + (segundos or 7)
end


-------------------------------------------------------------------
--  PUERTAS Y CARTELES
-------------------------------------------------------------------

local function etiquetarCartel(gui)
	if not gui:IsA("BillboardGui") then
		return
	end
	local tipo = gui:GetAttribute("tipo")
	if tipo == "vender" then
		local texto = gui:FindFirstChild("Texto", true)
		if texto then
			texto.Text = T("vender")
		end
	elseif tipo == "records" then
		local titulo = gui:FindFirstChild("Titulo", true)
		if titulo then
			titulo.Text = T("records")
		end
	end
end

local function aplicarPuertas(zonas)
	local raiz = workspace:FindFirstChild("Nieve")
	local carpeta = raiz and raiz:FindFirstChild("Puertas")
	if not carpeta then
		return
	end
	for _, muro in ipairs(carpeta:GetChildren()) do
		local clave = muro:GetAttribute("zona")
		if clave and muro:IsA("BasePart") then
			local abierta = zonas ~= nil and zonas[clave] == true
			local precio = muro:GetAttribute("precio") or 0

			muro.CanCollide = not abierta
			muro.Transparency = abierta and 1 or 0.35

			local cartel = muro:FindFirstChild("Cartel")
			if cartel then
				cartel.Enabled = not abierta
				local texto = cartel:FindFirstChild("Texto", true)
				if texto then
					texto.Text = (nombreZona[clave] or "") .. "\n" .. T("abrir") .. "  " .. formatear(precio)
				end
			end

			local prompt = muro:FindFirstChildOfClass("ProximityPrompt")
			if prompt then
				prompt.Enabled = not abierta
				prompt.ActionText = T("abrir") .. "  " .. formatear(precio)
				prompt.ObjectText = nombreZona[clave] or ""
			end
		end
	end
end

task.spawn(function()
	local raiz = workspace:WaitForChild("Nieve", 30)
	if not raiz then
		return
	end
	-- Primero se escucha y DESPUES se repasa lo que ya hay. Al reves se
	-- pierde todo lo que llegue entre una cosa y la otra: por eso el
	-- cartel de records se quedaba en ingles y el del camion no.
	raiz.DescendantAdded:Connect(etiquetarCartel)

	local function repasar()
		for _, obj in ipairs(raiz:GetDescendants()) do
			etiquetarCartel(obj)
		end
	end

	repasar()
	task.delay(3, repasar)
end)


-------------------------------------------------------------------
--  EL HUD, AL RITMO DEL SERVIDOR
-------------------------------------------------------------------

local APAGADO = Color3.fromRGB(70, 78, 92)

local cargaAnterior = 0
local llenoAntes = false
local ultimoRaspado = 0

local function refrescar(datos)
	local dinero = datos.dinero or 0
	local multiplicador = math.floor(datos.multiplicador or 1)

	textoDinero.Text = formatear(dinero)
	textoMultiplicador.Text = (multiplicador > 1) and ("x" .. tostring(multiplicador)) or ""

	-- carga
	local capacidad = math.max(1, datos.capacidad or 1)
	local carga = datos.carga or 0
	local lleno = carga >= capacidad

	-- Suena al barrer, no mas de cinco veces por segundo.
	if carga > cargaAnterior and os.clock() - ultimoRaspado > 0.19 then
		ultimoRaspado = os.clock()
		sonar("pala", true)
	end
	if lleno and not llenoAntes then
		sonar("lleno")
	end
	cargaAnterior = carga
	llenoAntes = lleno
	local ratio = math.clamp(carga / capacidad, 0, 1)
	Tween:Create(barraCarga, TweenInfo.new(0.18), { Size = UDim2.new(ratio, 0, 1, 0) }):Play()
	barraCarga.BackgroundColor3 = lleno and ROJO or ACENTO
	textoCarga.Text = lleno and T("lleno") or ("❄ " .. formatear(carga) .. " / " .. formatear(capacidad))
	textoValor.Text = ((datos.valor or 0) > 0) and ("+" .. formatear(datos.valor)) or ""

	-- zona
	textoZona.Text = nombreZona[datos.zona] or ""
	local limpio = math.clamp(datos.limpio or 0, 0, 1)
	Tween:Create(barraProgreso, TweenInfo.new(0.25), { Size = UDim2.new(limpio, 0, 1, 0) }):Play()
	textoProgreso.Text = string.format(T("limpio"), math.floor(limpio * 100 + 0.5))

	-- mejoras
	for clave, fila in pairs(filas) do
		local nivel = (datos.niveles and datos.niveles[clave]) or 1
		local precio = (datos.precios and datos.precios[clave]) or -1
		fila.nivel.Text = string.format(T("nivel"), nivel) .. " / " .. tostring(fila.def.niveles)
		if precio < 0 then
			fila.boton.Text = T("maximo")
			fila.boton.BackgroundColor3 = APAGADO
		else
			fila.boton.Text = formatear(precio)
			fila.boton.BackgroundColor3 = (dinero >= precio) and VERDE or APAGADO
		end
	end

	-- renacer
	local puede = datos.puedeRenacer == true
	local precioRenacer = datos.precioRenacer or 0
	botonRenacer.Visible = puede
	descRenacer.Text = puede
		and string.format(T("renacerDesc"), multiplicador + 1)
		or T("renacerFalta")
	botonRenacerPanel.Text = puede and formatear(precioRenacer) or "-"
	botonRenacerPanel.BackgroundColor3 = (puede and dinero >= precioRenacer) and ORO or APAGADO

	-- puertas
	aplicarPuertas(datos.zonas)

	-- la guia: el paso siguiente sale de lo que ya ha hecho, no de un
	-- reloj. Mientras no lo haga, el cartel no se va.
	local paso = nil
	if (datos.nieveTotal or 0) == 0 then
		paso = 1
	elseif (datos.ventas or 0) == 0 then
		paso = lleno and 3 or 2
	elseif not datos.mejorada then
		paso = 4
	end

	if paso then
		marcoGuia.Visible = true
		textoGuia.Text = T("guia" .. tostring(paso))
		pieGuia.Text = T("guia" .. tostring(paso) .. "pie")
	else
		marcoGuia.Visible = false
	end

	-- pistas
	for i = 2, #A.zonas do
		local def = A.zonas[i]
		if datos.zonas and not datos.zonas[def.clave] and dinero >= def.precio then
			pista("pistaZona", 7)
			break
		end
	end
end

RemotoEstado.OnClientEvent:Connect(function(datos)
	if type(datos) ~= "table" then
		return
	end
	local ok, err = pcall(refrescar, datos)
	if not ok then
		warn("[nieve] fallo al pintar el HUD: " .. tostring(err))
	end
end)

RemotoAviso.OnClientEvent:Connect(function(datos)
	if type(datos) ~= "table" then
		return
	end
	if datos.tipo == "venta" then
		aviso(string.format(T("vendido"), formatear(datos.cantidad or 0)), ORO)
		sonar("venta")
	elseif datos.tipo == "texto" then
		aviso(T(datos.clave), ROJO)
		sonar("error")
	elseif datos.tipo == "zona" then
		aviso(nombreZona[datos.clave] or "", VERDE)
		sonar("zona")
	elseif datos.tipo == "mejora" then
		aviso(
			(nombreMejora[datos.clave] or "") .. " " .. string.format(T("nivel"), datos.nivel or 1),
			ACENTO
		)
		sonar("mejora")
	elseif datos.tipo == "diario" then
		aviso(T("diario") .. "  +" .. formatear(datos.cantidad or 0), ORO)
		sonar("premio")
		task.delay(1.4, function()
			aviso(string.format(T("diarioRacha"), datos.racha or 1), VERDE)
		end)
	elseif datos.tipo == "codigo" then
		aviso("+" .. formatear(datos.cantidad or 0), VERDE)
		sonar("premio")
	elseif datos.tipo == "renacer" then
		aviso(T("renacer") .. " x" .. tostring((datos.nivel or 0) + 1), ORO)
		sonar("zona")
	end
end)

task.spawn(function()
	while true do
		task.wait(0.3)
		if textoPista.Text ~= "" and os.clock() > pistaHasta then
			textoPista.Text = ""
		end
	end
end)


-------------------------------------------------------------------
--  QUE NIEVE
-------------------------------------------------------------------

local nube = nil

local function prepararNube()
	local camara = workspace.CurrentCamera
	if not camara then
		return
	end
	nube = nuevo("Part", {
		Name = "NieveCayendo",
		Anchored = true,
		CanCollide = false,
		CanQuery = false,
		CanTouch = false,
		Transparency = 1,
		Size = Vector3.new(70, 1, 70),
		CFrame = CFrame.new(0, 100, 0),
	}, camara)

	nuevo("ParticleEmitter", {
		Texture = "rbxasset://textures/particles/sparkles_main.dds",
		Color = ColorSequence.new(Color3.fromRGB(255, 255, 255)),
		Size = NumberSequence.new(0.42),
		Transparency = NumberSequence.new({
			NumberSequenceKeypoint.new(0, 0.25),
			NumberSequenceKeypoint.new(0.8, 0.35),
			NumberSequenceKeypoint.new(1, 1),
		}),
		Lifetime = NumberRange.new(3, 4.5),
		Rate = 70,
		Speed = NumberRange.new(2, 5),
		SpreadAngle = Vector2.new(25, 25),
		Acceleration = Vector3.new(3, -14, 1),
		EmissionDirection = Enum.NormalId.Bottom,
		LightEmission = 0.5,
		LockedToPart = false,
	}, nube)
end

prepararNube()

Correr.RenderStepped:Connect(function()
	local camara = workspace.CurrentCamera
	if not camara then
		return
	end
	if not nube or nube.Parent == nil then
		prepararNube()
		return
	end
	if nube.Parent ~= camara then
		nube.Parent = camara
	end
	nube.CFrame = CFrame.new(camara.CFrame.Position + Vector3.new(0, 32, 0))
end)
