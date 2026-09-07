--[[
	Un Roblox de mentira, lo justo para poder ejecutar el juego fuera de
	Studio y comprobar que las cuentas salen.

	No pretende ser fiel: pretende ser suficiente para que el codigo del
	servidor corra tal cual, sin tocarle una linea.

	Lo importante que si imita de verdad:
	  - el reloj y task.wait(), con corrutinas, para poder adelantar el
	    tiempo a voluntad y ver correr los bucles
	  - los hijos, los atributos y las senales de los objetos
	  - que una propiedad de Roblox SIEMPRE empieza por mayuscula: si el
	    codigo asigna otra cosa, aqui salta, igual que saltaria en Studio
]]

local osReal = os
reloj = 0

-------------------------------------------------------------------
--  PLANIFICADOR
-------------------------------------------------------------------

local pendientes = {}
-- Solo los hilos que crea este planificador pueden ceder: el hilo
-- principal del interprete tambien es una corrutina, pero ahi no se cede.
local gestionadas = setmetatable({}, { __mode = "k" })

local function planificar(co, retraso)
	pendientes[#pendientes + 1] = { co = co, cuando = reloj + (retraso or 0) }
end

task = {}

function task.wait(segundos)
	if gestionadas[coroutine.running()] then
		planificar(coroutine.running(), segundos or 0)
		coroutine.yield()
	else
		reloj = reloj + (segundos or 0)
	end
	return segundos or 0
end

function task.spawn(fn, ...)
	local co = coroutine.create(fn)
	gestionadas[co] = true
	local ok, err = coroutine.resume(co, ...)
	if not ok then
		error("task.spawn reventado: " .. tostring(err), 0)
	end
	return co
end

function task.defer(fn, ...)
	return task.spawn(fn, ...)
end

function task.delay(segundos, fn, ...)
	local args = table.pack(...)
	local co = coroutine.create(function()
		task.wait(segundos)
		fn(table.unpack(args, 1, args.n))
	end)
	gestionadas[co] = true
	local ok, err = coroutine.resume(co)
	if not ok then
		error("task.delay reventado: " .. tostring(err), 0)
	end
	return co
end

-- Adelanta el reloj a saltitos, despertando lo que toque.
function avanzar(segundos, paso)
	paso = paso or 0.05
	local final = reloj + segundos
	local vueltas = 0
	while reloj < final do
		reloj = math.min(final, reloj + paso)
		vueltas = vueltas + 1
		if vueltas > 200000 then
			error("el reloj no avanza: bucle infinito?", 0)
		end
		local listos = {}
		for i = #pendientes, 1, -1 do
			if pendientes[i].cuando <= reloj then
				listos[#listos + 1] = table.remove(pendientes, i)
			end
		end
		for i = #listos, 1, -1 do
			local ok, err = coroutine.resume(listos[i].co)
			if not ok then
				error("un bucle ha reventado: " .. tostring(err), 0)
			end
		end
	end
end

-- 1 de enero de 2026. Las pruebas pueden sumarle dias para simular
-- que el jugador vuelve manana.
TIEMPO_BASE = 1767225600

os = {
	clock = function()
		return reloj
	end,
	time = function()
		return math.floor(TIEMPO_BASE + reloj)
	end,
	date = osReal.date,
}

wait = task.wait
spawn = task.spawn
delay = function(s, f)
	return task.delay(s, f)
end

function warn(...)
	local trozos = {}
	for i = 1, select("#", ...) do
		trozos[#trozos + 1] = tostring(select(i, ...))
	end
	print("[warn] " .. table.concat(trozos, " "))
end


-------------------------------------------------------------------
--  TIPOS DE ROBLOX
-------------------------------------------------------------------

local Vec3 = {}
Vec3.__index = Vec3
Vec3.__add = function(a, b)
	return Vector3.new(a.X + b.X, a.Y + b.Y, a.Z + b.Z)
end
Vec3.__sub = function(a, b)
	return Vector3.new(a.X - b.X, a.Y - b.Y, a.Z - b.Z)
end
Vec3.__mul = function(a, b)
	if type(b) == "number" then
		return Vector3.new(a.X * b, a.Y * b, a.Z * b)
	end
	return Vector3.new(a.X * b.X, a.Y * b.Y, a.Z * b.Z)
end
Vec3.__eq = function(a, b)
	return a.X == b.X and a.Y == b.Y and a.Z == b.Z
end

Vector3 = {}
function Vector3.new(x, y, z)
	local v = setmetatable({ X = x or 0, Y = y or 0, Z = z or 0 }, Vec3)
	v.Magnitude = math.sqrt(v.X * v.X + v.Y * v.Y + v.Z * v.Z)
	v.Unit = v
	return v
end

Vector2 = {}
function Vector2.new(x, y)
	return { X = x or 0, Y = y or 0 }
end

local Marco = {}
Marco.__index = Marco
Marco.__mul = function(a, _)
	return a
end

CFrame = {}
function CFrame.new(x, y, z)
	local pos
	if type(x) == "table" then
		pos = x
	else
		pos = Vector3.new(x or 0, y or 0, z or 0)
	end
	return setmetatable({ Position = pos, X = pos.X, Y = pos.Y, Z = pos.Z }, Marco)
end
function CFrame.Angles()
	return CFrame.new(0, 0, 0)
end

Color3 = {
	fromRGB = function(r, g, b)
		return { R = (r or 0) / 255, G = (g or 0) / 255, B = (b or 0) / 255 }
	end,
	new = function(r, g, b)
		return { R = r or 0, G = g or 0, B = b or 0 }
	end,
}

UDim = { new = function(e, o) return { Scale = e or 0, Offset = o or 0 } end }
UDim2 = {
	new = function(xe, xo, ye, yo)
		return { X = UDim.new(xe, xo), Y = UDim.new(ye, yo) }
	end,
	fromScale = function(x, y)
		return UDim2.new(x, 0, y, 0)
	end,
	fromOffset = function(x, y)
		return UDim2.new(0, x, 0, y)
	end,
}

ColorSequence = { new = function(c) return { c } end }
ColorSequenceKeypoint = { new = function(t, c) return { t, c } end }
NumberSequence = { new = function(n) return { n } end }
NumberSequenceKeypoint = { new = function(t, n) return { t, n } end }
NumberRange = { new = function(a, b) return { Min = a, Max = b or a } end }
TweenInfo = { new = function(...) return { ... } end }
BrickColor = { new = function(n) return { Name = n } end }

-- Enum.LoQueSea.LoQueSea siempre devuelve algo, no hace falta la lista.
local function enumMagico(nombre)
	return setmetatable({}, {
		__index = function(_, clave)
			return { Name = clave, Value = 0, EnumType = nombre }
		end,
	})
end
Enum = setmetatable({}, {
	__index = function(_, clave)
		return enumMagico(clave)
	end,
})

local semilla = 12345
Random = {
	new = function(s)
		semilla = s or 12345
		return {
			NextNumber = function(self, minimo, maximo)
				semilla = (semilla * 1103515245 + 12345) % 2147483648
				local n = semilla / 2147483648
				if minimo and maximo then
					return minimo + n * (maximo - minimo)
				end
				return n
			end,
			NextInteger = function(self, minimo, maximo)
				return math.floor(minimo + self:NextNumber() * (maximo - minimo + 1))
			end,
		}
	end,
}


-------------------------------------------------------------------
--  SENALES
-------------------------------------------------------------------

function nuevaSenal()
	local senal = { _fns = {} }
	function senal:Connect(fn)
		self._fns[#self._fns + 1] = fn
		return { Disconnect = function() end, Connected = true }
	end
	senal.connect = senal.Connect
	senal.Once = senal.Connect
	function senal:Fire(...)
		for _, fn in ipairs(self._fns) do
			fn(...)
		end
	end
	function senal:Wait()
		return nil
	end
	return senal
end


-------------------------------------------------------------------
--  INSTANCIAS
-------------------------------------------------------------------

local BASE_PARTE = {
	Part = true,
	WedgePart = true,
	SpawnLocation = true,
	MeshPart = true,
	TrussPart = true,
}

local metaInstancia = {
	__index = function(t, clave)
		if clave == "Parent" then
			return rawget(t, "_padre")
		end
		-- En Roblox, obj.Hijo busca un hijo con ese nombre. Aqui igual.
		local hijos = rawget(t, "_hijos")
		if hijos then
			for _, hijo in ipairs(hijos) do
				if rawget(hijo, "Name") == clave then
					return hijo
				end
			end
		end
		return nil
	end,
	__newindex = function(t, clave, valor)
		if type(clave) ~= "string" or not string.match(clave, "^[A-Z]") then
			error(
				("'%s' no es una propiedad de Roblox (%s): las propiedades empiezan por mayuscula")
					:format(tostring(clave), rawget(t, "ClassName") or "?"),
				2
			)
		end
		if clave == "Parent" then
			local anterior = rawget(t, "_padre")
			if anterior and rawget(anterior, "_hijos") then
				local hijos = rawget(anterior, "_hijos")
				for i, hijo in ipairs(hijos) do
					if hijo == t then
						table.remove(hijos, i)
						break
					end
				end
			end
			rawset(t, "_padre", valor)
			if valor and rawget(valor, "_hijos") then
				local hijos = rawget(valor, "_hijos")
				hijos[#hijos + 1] = t
				local senal = rawget(valor, "ChildAdded")
				if senal then
					senal:Fire(t)
				end
			end
			return
		end
		rawset(t, clave, valor)
	end,
}

local function crearInstancia(clase)
	local obj = {
		ClassName = clase,
		Name = clase,
		_padre = nil,
		_hijos = {},
		_atributos = {},
		_destruida = false,
	}

	obj.ChildAdded = nuevaSenal()
	obj.DescendantAdded = nuevaSenal()
	obj.Changed = nuevaSenal()
	obj.AncestryChanged = nuevaSenal()

	if clase == "RemoteEvent" then
		obj.OnServerEvent = nuevaSenal()
		obj.OnClientEvent = nuevaSenal()
		obj._alCliente = {}
		function obj:FireClient(jugador, ...)
			self._alCliente[#self._alCliente + 1] = { jugador = jugador, datos = ... }
			-- Si hay un cliente cargado y el envio es para el, se le entrega
			-- de verdad, para poder comprobar lo que acaba en pantalla.
			if JUGADOR_LOCAL ~= nil and jugador == JUGADOR_LOCAL then
				self.OnClientEvent:Fire(...)
			end
		end
		function obj:FireAllClients(...) end
		function obj:FireServer(...)
			self.OnServerEvent:Fire(JUGADOR_ACTUAL, ...)
		end
	elseif clase == "ProximityPrompt" then
		obj.Triggered = nuevaSenal()
		obj.PromptButtonHoldBegan = nuevaSenal()
	elseif clase == "TextButton" or clase == "ImageButton" then
		obj.Activated = nuevaSenal()
		obj.MouseButton1Click = nuevaSenal()
	elseif clase == "TextBox" then
		obj.FocusLost = nuevaSenal()
		obj.Focused = nuevaSenal()
		obj.Text = ""
	elseif clase == "Tool" then
		obj.Activated = nuevaSenal()
		obj.Equipped = nuevaSenal()
	elseif clase == "Humanoid" then
		obj.Died = nuevaSenal()
		obj.WalkSpeed = 16
		function obj:EquipTool(herramienta)
			self._equipada = herramienta
		end
	end

	function obj:GetChildren()
		local copia = {}
		for i, hijo in ipairs(rawget(self, "_hijos")) do
			copia[i] = hijo
		end
		return copia
	end

	function obj:GetDescendants()
		local todos = {}
		local function recorrer(nodo)
			for _, hijo in ipairs(rawget(nodo, "_hijos")) do
				todos[#todos + 1] = hijo
				recorrer(hijo)
			end
		end
		recorrer(self)
		return todos
	end

	function obj:FindFirstChild(nombre, recursivo)
		for _, hijo in ipairs(rawget(self, "_hijos")) do
			if hijo.Name == nombre then
				return hijo
			end
		end
		if recursivo then
			for _, hijo in ipairs(rawget(self, "_hijos")) do
				local encontrado = hijo:FindFirstChild(nombre, true)
				if encontrado then
					return encontrado
				end
			end
		end
		return nil
	end

	function obj:FindFirstChildOfClass(clase2)
		for _, hijo in ipairs(rawget(self, "_hijos")) do
			if hijo.ClassName == clase2 then
				return hijo
			end
		end
		return nil
	end

	function obj:FindFirstChildWhichIsA(clase2, recursivo)
		for _, hijo in ipairs(rawget(self, "_hijos")) do
			if hijo:IsA(clase2) then
				return hijo
			end
		end
		if recursivo then
			for _, hijo in ipairs(rawget(self, "_hijos")) do
				local encontrado = hijo:FindFirstChildWhichIsA(clase2, true)
				if encontrado then
					return encontrado
				end
			end
		end
		return nil
	end

	function obj:FindFirstChildOfClassOrNil(clase2)
		return self:FindFirstChildOfClass(clase2)
	end

	function obj:WaitForChild(nombre, _)
		return self:FindFirstChild(nombre)
	end

	function obj:IsA(clase2)
		if rawget(self, "ClassName") == clase2 then
			return true
		end
		if clase2 == "BasePart" then
			return BASE_PARTE[rawget(self, "ClassName")] == true
		end
		if clase2 == "GuiObject" then
			local c = rawget(self, "ClassName")
			return c == "Frame" or c == "TextLabel" or c == "TextButton"
		end
		return false
	end

	function obj:IsDescendantOf(otro)
		local nodo = rawget(self, "_padre")
		while nodo do
			if nodo == otro then
				return true
			end
			nodo = rawget(nodo, "_padre")
		end
		return false
	end

	function obj:Destroy()
		self.Parent = nil
		rawset(self, "_destruida", true)
	end

	function obj:Clone()
		return crearInstancia(rawget(self, "ClassName"))
	end

	function obj:SetAttribute(clave, valor)
		rawget(self, "_atributos")[clave] = valor
	end

	function obj:GetAttribute(clave)
		return rawget(self, "_atributos")[clave]
	end

	function obj:PivotTo(marco)
		rawset(self, "_pivote", marco)
		local raiz = self:FindFirstChild("HumanoidRootPart")
		if raiz and marco and marco.Position then
			raiz.Position = marco.Position
		end
	end

	function obj:GetPivot()
		return rawget(self, "_pivote") or CFrame.new(0, 0, 0)
	end

	function obj:Play() end
	function obj:Stop() end

	return setmetatable(obj, metaInstancia)
end

Instance = {
	new = function(clase, padre)
		local obj = crearInstancia(clase)
		if padre then
			obj.Parent = padre
		end
		return obj
	end,
}

function contarPor(raiz, clase)
	local total = 0
	for _, obj in ipairs(raiz:GetDescendants()) do
		if obj.ClassName == clase then
			total = total + 1
		end
	end
	return total
end


-------------------------------------------------------------------
--  SERVICIOS
-------------------------------------------------------------------

workspace = crearInstancia("Workspace")
workspace.Name = "Workspace"
workspace.CurrentCamera = crearInstancia("Camera")
-- En Roblox la camara SIEMPRE tiene CFrame; sin esto el codigo que la
-- sigue peta aqui y no alli, que es justo lo contrario de lo que quiero.
workspace.CurrentCamera.CFrame = CFrame.new(0, 20, 0)

local servicios = {}

local function servicio(nombre, clase)
	local s = crearInstancia(clase or nombre)
	s.Name = nombre
	servicios[nombre] = s
	return s
end

Jugadores = servicio("Players")
Jugadores.CharacterAutoLoads = true
Jugadores.PlayerAdded = nuevaSenal()
Jugadores.PlayerRemoving = nuevaSenal()
function Jugadores:GetPlayers()
	local lista = {}
	for _, hijo in ipairs(rawget(self, "_hijos")) do
		if hijo.ClassName == "Player" then
			lista[#lista + 1] = hijo
		end
	end
	return lista
end

Almacen = servicio("DataStoreService")
DATOS_GUARDADOS = {}
FALLA_EL_DATASTORE = false
function Almacen:GetDataStore(nombre)
	local tienda = { _nombre = nombre }
	function tienda:GetAsync(clave)
		if FALLA_EL_DATASTORE then
			error("DataStore de mentira: fallo a proposito", 0)
		end
		return DATOS_GUARDADOS[clave]
	end
	function tienda:SetAsync(clave, valor)
		if FALLA_EL_DATASTORE then
			error("DataStore de mentira: fallo a proposito", 0)
		end
		DATOS_GUARDADOS[clave] = valor
		return true
	end
	function tienda:UpdateAsync(clave, fn)
		DATOS_GUARDADOS[clave] = fn(DATOS_GUARDADOS[clave])
		return DATOS_GUARDADOS[clave]
	end
	return tienda
end

RECORDS = {}
function Almacen:GetOrderedDataStore(nombre)
	local tienda = { _nombre = nombre }
	function tienda:SetAsync(clave, valor)
		if FALLA_EL_DATASTORE then
			error("DataStore de mentira: fallo a proposito", 0)
		end
		RECORDS[clave] = valor
		return true
	end
	function tienda:GetSortedAsync(ascendente, cuantos)
		if FALLA_EL_DATASTORE then
			error("DataStore de mentira: fallo a proposito", 0)
		end
		local lista = {}
		for clave, valor in pairs(RECORDS) do
			lista[#lista + 1] = { key = clave, value = valor }
		end
		table.sort(lista, function(a, b)
			if ascendente then
				return a.value < b.value
			end
			return a.value > b.value
		end)
		while #lista > (cuantos or 10) do
			table.remove(lista)
		end
		return {
			GetCurrentPage = function()
				return lista
			end,
			IsFinished = true,
		}
	end
	return tienda
end

function Jugadores:GetNameFromUserIdAsync(id)
	for _, jugador in ipairs(self:GetPlayers()) do
		if jugador.UserId == id then
			return jugador.Name
		end
	end
	return "Jugador" .. tostring(id)
end

Mercado = servicio("MarketplaceService")
function Mercado:UserOwnsGamePassAsync()
	return false
end

servicio("Lighting")
servicio("ReplicatedStorage")
servicio("SoundService")
servicio("TweenService")
servicio("RunService")
servicio("LocalizationService").RobloxLocaleId = "es-es"
servicio("StarterGui")
servicio("Teams")

local RunService = servicios.RunService
RunService.Heartbeat = nuevaSenal()
RunService.RenderStepped = nuevaSenal()
RunService.Stepped = nuevaSenal()
function RunService:IsServer()
	return true
end
function RunService:IsClient()
	return false
end
function RunService:IsStudio()
	return true
end

local TweenService = servicios.TweenService
function TweenService:Create(objeto, _, propiedades)
	return {
		Play = function()
			for clave, valor in pairs(propiedades) do
				objeto[clave] = valor
			end
		end,
		Cancel = function() end,
	}
end

CIERRES = {}
game = {
	Workspace = workspace,
	GetService = function(_, nombre)
		if nombre == "Workspace" then
			return workspace
		end
		if not servicios[nombre] then
			servicio(nombre)
		end
		return servicios[nombre]
	end,
	BindToClose = function(_, fn)
		CIERRES[#CIERRES + 1] = fn
	end,
	GetFullName = function()
		return "game"
	end,
	PlaceId = 0,
	JobId = "prueba",
}


-------------------------------------------------------------------
--  JUGADORES DE MENTIRA
-------------------------------------------------------------------

local siguienteId = 100

function nuevoJugador(nombre)
	siguienteId = siguienteId + 1
	local jugador = crearInstancia("Player")
	jugador.Name = nombre
	jugador.UserId = siguienteId
	jugador.CharacterAdded = nuevaSenal()
	jugador.CharacterRemoving = nuevaSenal()

	local mochila = crearInstancia("Backpack")
	mochila.Name = "Backpack"
	mochila.Parent = jugador

	local interfaz = crearInstancia("PlayerGui")
	interfaz.Name = "PlayerGui"
	interfaz.Parent = jugador

	function jugador:LoadCharacter()
		local pers = crearInstancia("Model")
		pers.Name = nombre

		local raiz = crearInstancia("Part")
		raiz.Name = "HumanoidRootPart"
		raiz.Position = Vector3.new(0, 3, 0)
		raiz.Parent = pers

		local humano = crearInstancia("Humanoid")
		humano.Name = "Humanoid"
		humano.Parent = pers

		pers.Parent = workspace
		self.Character = pers
		self.CharacterAdded:Fire(pers)
		return pers
	end

	function jugador:Mover(x, y, z)
		local pers = self.Character
		if not pers then
			return
		end
		local raiz = pers:FindFirstChild("HumanoidRootPart")
		if raiz then
			raiz.Position = Vector3.new(x, y or 3, z)
		end
	end

	jugador.Parent = Jugadores
	return jugador
end

function entra(jugador)
	JUGADOR_ACTUAL = jugador
	Jugadores.PlayerAdded:Fire(jugador)
end

function sale(jugador)
	Jugadores.PlayerRemoving:Fire(jugador)
	jugador.Parent = nil
end


-------------------------------------------------------------------
--  COMPROBACIONES
-------------------------------------------------------------------

FALLOS = 0
PASADAS = 0

function comprobar(condicion, texto)
	if condicion then
		PASADAS = PASADAS + 1
		print("  ok   " .. texto)
	else
		FALLOS = FALLOS + 1
		print("  FALLA " .. texto)
	end
end

function comprobarIgual(obtenido, esperado, texto)
	comprobar(obtenido == esperado, texto .. "  (esperado " .. tostring(esperado) .. ", sale " .. tostring(obtenido) .. ")")
end

function titulo(texto)
	print("")
	print("── " .. texto)
end
