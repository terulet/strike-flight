--[[
	ABRE LA CALLE  —  servidor

	Segunda vertical. Se entra igual que en la primera (una parcela, una
	casa enterrada, una pala) y se sale por el otro lado: con la calle
	abierta y alguien haciendo humo enfrente.

	Las tres cosas de las que cuelga todo:

	  Parcela        el estado de la nieve vive ahi dentro, con su id. Hoy
	                 hay una; manana una por jugador, y el excavador no se
	                 entera porque siempre recibe SOBRE QUE parcela actua.

	  puedeExcavar() la regla que hace imposible quedarse encerrado: al
	                 bajar una casilla no se puede abrir con sus ocho
	                 vecinas un escalon mayor que desnivelMaximo. Para
	                 bajar hay que ensanchar. No hay pozos.

	  los capitulos  el jugador nunca ve un menu. Ve el siguiente misterio.
	                 Cada capitulo termina porque HA DESENTERRADO algo, y
	                 el mundo reacciona: la puerta se abre, sale luz, el
	                 garaje se levanta, la sopladora esta ahi tirada.

	Y cavar sigue siendo una ACCION: hay que mantener pulsado.
]]

local Jugadores = game:GetService("Players")
local RS = game:GetService("ReplicatedStorage")
local Luz = game:GetService("Lighting")
local Tweens = game:GetService("TweenService")

local A = require(RS:WaitForChild("Ajustes"))
local Parcela = require(RS:WaitForChild("Parcela"))

local Terreno = workspace.Terrain
local CELDA = A.nieve.celda



-------------------------------------------------------------------
--  PIEZAS
-------------------------------------------------------------------

local NIEVE = Color3.fromRGB(246, 250, 255)
local CALIDA = Color3.fromRGB(255, 214, 138)
local PIZARRA = Color3.fromRGB(64, 70, 84)
local LADRILLO = Color3.fromRGB(152, 88, 70)
local MADERA = Color3.fromRGB(122, 82, 50)

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

local function luzDe(padre, color, brillo, alcance)
	local l = Instance.new("PointLight")
	l.Color = color
	l.Brightness = brillo
	l.Range = alcance
	l.Enabled = brillo > 0
	l.Parent = padre
	return l
end

local function sonidoDe(padre, nombre, id, volumen, tono, enBucle)
	local s = Instance.new("Sound")
	s.Name = nombre
	s.SoundId = id
	s.Volume = volumen
	s.PlaybackSpeed = tono
	s.Looped = enBucle == true
	s.RollOffMaxDistance = 120
	s.RollOffMinDistance = 8
	s.Parent = padre
	return s
end

-- El humo: sale de las chimeneas y es lo que dice "aqui vive alguien".
local function humoEn(padre, tamano)
	local punto = Instance.new("Attachment")
	punto.Name = "Humo"
	punto.Parent = padre
	local e = Instance.new("ParticleEmitter")
	e.Texture = "rbxasset://textures/particles/smoke_main.dds"
	e.Color = ColorSequence.new(Color3.fromRGB(226, 230, 238))
	e.Size = NumberSequence.new({
		NumberSequenceKeypoint.new(0, tamano * 0.4),
		NumberSequenceKeypoint.new(1, tamano * 2.4),
	})
	e.Transparency = NumberSequence.new({
		NumberSequenceKeypoint.new(0, 0.5),
		NumberSequenceKeypoint.new(0.3, 0.62),
		NumberSequenceKeypoint.new(1, 1),
	})
	e.Lifetime = NumberRange.new(3.2, 5)
	e.Rate = 9
	e.Speed = NumberRange.new(4, 7)
	e.SpreadAngle = Vector2.new(14, 14)
	e.Acceleration = Vector3.new(2.5, 1.6, 0)
	e.Enabled = false
	e.Parent = punto
	return e
end


-------------------------------------------------------------------
--  REMOTOS
-------------------------------------------------------------------

local remotos = Instance.new("Folder")
remotos.Name = "RemotosCalle"
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

-- Y con que herramienta. Solo vale pedir las que se tienen.
local RemotoHerramienta = Instance.new("RemoteEvent")
RemotoHerramienta.Name = "Herramienta"
RemotoHerramienta.Parent = remotos


-------------------------------------------------------------------
--  EL MUNDO
-------------------------------------------------------------------

local parcelas = {}
local estados = {}
local mundo = { carpeta = nil, salida = CFrame.new(0, 5, 0) }

-- Se definen mas abajo; construirParcela las necesita para dejar el HUD
-- con el numero correcto desde el primer momento.
local revisarHallazgos

local function parcelaEn(x, z)
	for _, p in ipairs(parcelas) do
		if p:contiene(x, z) then
			return p
		end
	end
	return nil
end


-- Las medidas de tu casa, en casillas y en studs. Todo lo demas se coloca
-- a partir de aqui, para que mover la casa no descuadre nada.
local function medidasCasa(parcela)
	local cxCentro = math.floor(parcela.ancho / 2)
	local czCentro = A.sitio.czCasa
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
	m.zFachada = m.z + A.casa.fondo / 2

	-- El garaje, pegado al lado -X de la casa.
	m.garajeX = m.x - A.casa.ancho / 2 - A.casa.garajeAncho / 2
	m.garajeCx = math.floor((m.garajeX - parcela.origen.X) / CELDA)
	m.gcx0 = math.floor((m.garajeX - A.casa.garajeAncho / 2 - 2 - parcela.origen.X) / CELDA)
	m.gcx1 = math.floor((m.garajeX + A.casa.garajeAncho / 2 + 2 - parcela.origen.X) / CELDA)
	m.garajeZ = m.z + (A.casa.fondo - 4) / 2

	return m
end


local function construirCasa(parcela, padre, m)
	local grupo = Instance.new("Folder")
	grupo.Name = "Casa"
	grupo.Parent = padre

	local CREMA = Color3.fromRGB(238, 224, 198)

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

	local zFachada = m.zFachada

	-- Cuerpo y zocalo.
	pieza("Cuerpo", Vector3.new(A.casa.ancho, A.casa.alto, A.casa.fondo),
		Vector3.new(m.x, A.casa.alto / 2, m.z), CREMA, Enum.Material.Concrete)
	pieza("Zocalo", Vector3.new(A.casa.ancho + 1.4, 3.2, A.casa.fondo + 1.4),
		Vector3.new(m.x, 1.6, m.z), LADRILLO, Enum.Material.Brick)
	for _, dx in ipairs({ -1, 1 }) do
		pieza("Esquina", Vector3.new(2.2, A.casa.alto, 2.2),
			Vector3.new(m.x + dx * (A.casa.ancho / 2 - 1), A.casa.alto / 2, m.z + A.casa.fondo / 2 - 1),
			Color3.fromRGB(216, 206, 190), Enum.Material.Concrete)
	end

	-- Cubierta inclinada a escalones. Cada uno con su nieve encima: a
	-- distancia lee como un tejado a dos aguas y no puede salir torcido.
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
	pieza("Caballete", Vector3.new(4, 1.4, A.casa.fondo + 6),
		Vector3.new(m.x, alturaTejado + 0.4, m.z), PIZARRA, Enum.Material.Slate)
	alturaTejado = alturaTejado + 1.1

	-- La chimenea, lo unico que asoma cuando esta todo enterrado. Es el
	-- primer "hacia alli" del juego, asi que tiene que verse desde lejos.
	local chx = m.x + A.casa.ancho / 2 - 6
	local chz = m.z - A.casa.fondo / 4
	pieza("Chimenea", Vector3.new(5, A.casa.alturaChimenea, 5),
		Vector3.new(chx, A.casa.alturaChimenea / 2, chz), LADRILLO, Enum.Material.Brick)
	local boca = pieza("ChimeneaBoca", Vector3.new(6, 1.2, 6),
		Vector3.new(chx, A.casa.alturaChimenea + 0.6, chz), PIZARRA, Enum.Material.Slate)
	pieza("ChimeneaNieve", Vector3.new(6.2, 0.6, 6.2),
		Vector3.new(chx, A.casa.alturaChimenea + 1.4, chz), NIEVE, Enum.Material.Snow, false)
	m.humo = humoEn(boca, 5)

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

	-- LA PUERTA. Con su hueco detras, que empieza a oscuras y se enciende
	-- cuando la descubres: es toda la recompensa del primer capitulo.
	pieza("MarcoPuerta", Vector3.new(A.casa.puertaAncho + 2, A.casa.puertaAlto + 1.6, 0.5),
		Vector3.new(m.x, (A.casa.puertaAlto + 1.6) / 2, zFachada + 0.1),
		Color3.fromRGB(250, 248, 244))
	local hueco = pieza("Recibidor", Vector3.new(A.casa.puertaAncho, A.casa.puertaAlto, 0.4),
		Vector3.new(m.x, A.casa.puertaAlto / 2, zFachada - 0.05),
		Color3.fromRGB(22, 18, 14), Enum.Material.SmoothPlastic, false)
	m.luzRecibidor = luzDe(hueco, CALIDA, 0, 34)
	m.recibidor = hueco
	m.sonidoCasa = sonidoDe(hueco, "Interior", "rbxasset://sounds/action_falling.mp3", 0, 0.35, true)

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
	luzDe(farol, CALIDA, 2, 18)

	-- Ventanas encendidas: la casa se ve viva segun aparece.
	local yVentana = 6.4
	local medioAlto = 3.1
	for _, dx in ipairs({ -13, 13 }) do
		pieza("Marco", Vector3.new(6.2, 6.2, 0.4), Vector3.new(m.x + dx, yVentana, zFachada + 0.1),
			Color3.fromRGB(250, 248, 244), nil, false)
		local cristal = pieza("Cristal", Vector3.new(5.2, 5.2, 0.5),
			Vector3.new(m.x + dx, yVentana, zFachada + 0.3), CALIDA, Enum.Material.Neon, false)
		luzDe(cristal, CALIDA, 1.6, 22)
		pieza("Cruz", Vector3.new(0.35, 5.2, 0.7), Vector3.new(m.x + dx, yVentana, zFachada + 0.4),
			Color3.fromRGB(250, 248, 244), nil, false)
		for _, lado in ipairs({ -1, 1 }) do
			pieza("Contraventana", Vector3.new(1.6, 6.4, 0.4),
				Vector3.new(m.x + dx + lado * 4, yVentana, zFachada + 0.15),
				Color3.fromRGB(76, 104, 132), Enum.Material.WoodPlanks, false)
		end
	end

	-- EL GARAJE. Hueco de verdad, con sus cuatro paredes: al abrir la
	-- puerta se entra dentro, y dentro hay algo.
	local gx = m.garajeX
	local gAlto = A.casa.alto - 2
	local gFondo = A.casa.fondo - 4
	local gaFrente = m.z + gFondo / 2
	pieza("GarajeSuelo", Vector3.new(A.casa.garajeAncho, 0.6, gFondo),
		Vector3.new(gx, 0.3, m.z), Color3.fromRGB(120, 122, 126), Enum.Material.Concrete)
	pieza("GarajeFondo", Vector3.new(A.casa.garajeAncho, gAlto, 1),
		Vector3.new(gx, gAlto / 2, m.z - gFondo / 2), CREMA, Enum.Material.Concrete)
	for _, dx in ipairs({ -1, 1 }) do
		pieza("GarajeLado", Vector3.new(1, gAlto, gFondo),
			Vector3.new(gx + dx * (A.casa.garajeAncho / 2), gAlto / 2, m.z), CREMA, Enum.Material.Concrete)
	end
	pieza("GarajeTecho", Vector3.new(A.casa.garajeAncho + 1, 1, gFondo),
		Vector3.new(gx, gAlto, m.z), CREMA, Enum.Material.Concrete)
	pieza("GarajeTejado", Vector3.new(A.casa.garajeAncho + 3, 1.2, A.casa.fondo - 1),
		Vector3.new(gx, gAlto + 1.1, m.z), PIZARRA, Enum.Material.Slate)
	pieza("GarajeNieve", Vector3.new(A.casa.garajeAncho + 3.4, 0.6, A.casa.fondo - 0.6),
		Vector3.new(gx, gAlto + 2, m.z), NIEVE, Enum.Material.Snow, false)
	pieza("GarajeDintel", Vector3.new(A.casa.garajeAncho + 1, gAlto - 8.4, 1),
		Vector3.new(gx, 8.4 + (gAlto - 8.4) / 2, gaFrente), CREMA, Enum.Material.Concrete)

	local puertaGaraje = pieza("GarajePuerta", Vector3.new(A.casa.garajeAncho - 1.4, 8, 0.7),
		Vector3.new(gx, 4.2, gaFrente + 0.3),
		Color3.fromRGB(206, 208, 212), Enum.Material.Metal)
	local ranuras = {}
	for i = 1, 4 do
		ranuras[#ranuras + 1] = pieza("GarajeRanura", Vector3.new(A.casa.garajeAncho - 1.4, 0.25, 0.9),
			Vector3.new(gx, 1 + i * 1.6, gaFrente + 0.5),
			Color3.fromRGB(168, 172, 178), Enum.Material.Metal, false)
	end
	local bombilla = pieza("GarajeBombilla", Vector3.new(2.4, 0.4, 2.4),
		Vector3.new(gx, gAlto - 0.9, m.z), Color3.fromRGB(255, 246, 214), Enum.Material.Neon, false)
	bombilla.Transparency = 0.4
	m.luzGaraje = luzDe(bombilla, Color3.fromRGB(255, 246, 214), 0, 26)
	m.puertaGaraje = puertaGaraje
	m.ranurasGaraje = ranuras
	m.garajeFrenteZ = gaFrente
	m.sonidoGaraje = sonidoDe(puertaGaraje, "Portazo", "rbxasset://sounds/action_get_up.mp3", 0.7, 0.5, false)

	-- Las alturas de verdad, para que los hallazgos salten cuando toca.
	m.alturaTejado = alturaTejado
	m.alturaPorche = alturaPorche + 1.5
	m.alturaVentana = yVentana + medioAlto
	m.puerta = puerta
	m.grupo = grupo
	return m
end


-- La casa de enfrente. Mira hacia ti (-Z) y empieza apagada: es el
-- gancho, no el destino. Se enciende cuando abres la carretera.
local function construirVecino(parcela, padre)
	local grupo = Instance.new("Folder")
	grupo.Name = "Vecino"
	grupo.Parent = padre

	local V = A.vecino
	local cxCentro = math.floor(parcela.ancho / 2)
	local x, z = parcela:centro(cxCentro, A.sitio.czVecino)
	local zFachada = z - V.fondo / 2
	local AZUL = Color3.fromRGB(206, 214, 226)

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

	pieza("Cuerpo", Vector3.new(V.ancho, V.alto, V.fondo), Vector3.new(x, V.alto / 2, z),
		AZUL, Enum.Material.Concrete)
	pieza("Zocalo", Vector3.new(V.ancho + 1.4, 3, V.fondo + 1.4), Vector3.new(x, 1.5, z),
		Color3.fromRGB(126, 118, 110), Enum.Material.Brick)

	for i = 0, V.pasosTejado - 1 do
		local encogido = i * (V.ancho * 0.42 / V.pasosTejado)
		local y = V.alto + 0.6 + i * V.altoPaso
		pieza("Tejado" .. i, Vector3.new(V.ancho + 5 - encogido * 2, V.altoPaso, V.fondo + 5),
			Vector3.new(x, y, z), Color3.fromRGB(78, 62, 58), Enum.Material.Slate)
		pieza("TejadoNieve" .. i, Vector3.new(V.ancho + 5.4 - encogido * 2, 0.55, V.fondo + 5.4),
			Vector3.new(x, y + V.altoPaso * 0.6, z), NIEVE, Enum.Material.Snow, false)
	end

	local chx = x - V.ancho / 2 + 5
	local chz = z + V.fondo / 4
	pieza("Chimenea", Vector3.new(4.6, V.alturaChimenea, 4.6),
		Vector3.new(chx, V.alturaChimenea / 2, chz), Color3.fromRGB(126, 100, 92), Enum.Material.Brick)
	local boca = pieza("ChimeneaBoca", Vector3.new(5.6, 1.2, 5.6),
		Vector3.new(chx, V.alturaChimenea + 0.6, chz), PIZARRA, Enum.Material.Slate)

	-- La puerta mira hacia ti.
	pieza("MarcoPuerta", Vector3.new(V.puertaAncho + 2, V.puertaAlto + 1.6, 0.5),
		Vector3.new(x, (V.puertaAlto + 1.6) / 2, zFachada - 0.1), Color3.fromRGB(244, 244, 240))
	local recibidor = pieza("Recibidor", Vector3.new(V.puertaAncho, V.puertaAlto, 0.4),
		Vector3.new(x, V.puertaAlto / 2, zFachada + 0.05), Color3.fromRGB(20, 18, 16),
		Enum.Material.SmoothPlastic, false)
	local puerta = pieza("Puerta", Vector3.new(V.puertaAncho, V.puertaAlto, 0.8),
		Vector3.new(x, V.puertaAlto / 2, zFachada - 0.4), Color3.fromRGB(126, 62, 54),
		Enum.Material.WoodPlanks)
	for i = 0, 2 do
		pieza("Escalon", Vector3.new(V.puertaAncho + 5, 0.6, 2),
			Vector3.new(x, 0.4 + i * 0.5, zFachada - 2 - i * 2),
			Color3.fromRGB(224, 220, 212), Enum.Material.Concrete)
	end

	local cristales = {}
	for _, dx in ipairs({ -11, 11 }) do
		pieza("Marco", Vector3.new(5.6, 5.6, 0.4), Vector3.new(x + dx, 6, zFachada - 0.1),
			Color3.fromRGB(244, 244, 240), nil, false)
		local cristal = pieza("Cristal", Vector3.new(4.6, 4.6, 0.5),
			Vector3.new(x + dx, 6, zFachada - 0.28), Color3.fromRGB(46, 48, 56),
			Enum.Material.SmoothPlastic, false)
		cristales[#cristales + 1] = { pieza = cristal, luz = luzDe(cristal, CALIDA, 0, 20) }
	end

	return {
		x = x,
		z = z,
		zFachada = zFachada,
		cx0 = math.floor((x - V.ancho / 2 - 2 - parcela.origen.X) / CELDA),
		cx1 = math.floor((x + V.ancho / 2 + 2 - parcela.origen.X) / CELDA),
		cz0 = math.floor((z - V.fondo / 2 - 2 - parcela.origen.Z) / CELDA),
		cz1 = math.floor((z + V.fondo / 2 + 2 - parcela.origen.Z) / CELDA),
		cxCentro = cxCentro,
		alturaPuerta = V.puertaAlto,
		puerta = puerta,
		recibidor = recibidor,
		luzRecibidor = luzDe(recibidor, CALIDA, 0, 30),
		humo = humoEn(boca, 4.4),
		cristales = cristales,
		sonido = sonidoDe(recibidor, "Vecino", "rbxasset://sounds/action_falling.mp3", 0, 0.4, true),
	}
end


-- La entrada de coches y la calle. Estan ahi desde el primer segundo,
-- solo que debajo de metro y medio de nieve. Lo que las descubre no es un
-- boton: es la pala.
local function construirCalle(parcela, padre, m)
	local grupo = Instance.new("Folder")
	grupo.Name = "Calle"
	grupo.Parent = padre

	local S = A.sitio
	local mediaEntrada = math.floor(S.anchoEntrada / 2)
	local cxE0 = m.garajeCx - mediaEntrada
	local cxE1 = m.garajeCx + mediaEntrada
	local czE0 = math.floor((m.garajeFrenteZ + 1 - parcela.origen.Z) / CELDA)
	local czCal0 = S.czCarretera - math.floor(S.anchoCarretera / 2)
	local czCal1 = S.czCarretera + math.floor(S.anchoCarretera / 2)
	local czE1 = czCal0 - 1

	local xE0 = parcela.origen.X + cxE0 * CELDA
	local xE1 = parcela.origen.X + (cxE1 + 1) * CELDA
	local zE0 = parcela.origen.Z + czE0 * CELDA
	local zE1 = parcela.origen.Z + (czE1 + 1) * CELDA
	local zC0 = parcela.origen.Z + czCal0 * CELDA
	local zC1 = parcela.origen.Z + (czCal1 + 1) * CELDA

	-- La entrada: hormigon, con sus juntas, para que se note que la has
	-- despejado tu.
	parte({
		Name = "Entrada",
		Size = Vector3.new(xE1 - xE0, 0.6, zE1 - zE0),
		Position = Vector3.new((xE0 + xE1) / 2, 0.3, (zE0 + zE1) / 2),
		Color = Color3.fromRGB(158, 158, 160),
		Material = Enum.Material.Concrete,
		CanCollide = true,
		CanQuery = true,
	}, grupo)
	local juntas = math.floor((zE1 - zE0) / 16)
	for i = 1, juntas - 1 do
		parte({
			Name = "Junta",
			Size = Vector3.new(xE1 - xE0, 0.1, 0.5),
			Position = Vector3.new((xE0 + xE1) / 2, 0.62, zE0 + i * ((zE1 - zE0) / juntas)),
			Color = Color3.fromRGB(120, 120, 124),
			Material = Enum.Material.Concrete,
		}, grupo)
	end

	-- LA CALLE. Cruza la parcela entera de lado a lado: por eso se siente
	-- que hay pueblo a los dos lados aunque todavia no lo haya.
	local anchoS = parcela.ancho * CELDA
	parte({
		Name = "Carretera",
		Size = Vector3.new(anchoS + 80, 0.6, zC1 - zC0),
		Position = Vector3.new(parcela.origen.X + anchoS / 2, 0.3, (zC0 + zC1) / 2),
		Color = Color3.fromRGB(58, 58, 62),
		Material = Enum.Material.Asphalt,
		CanCollide = true,
		CanQuery = true,
	}, grupo)
	for i = 0, 14 do
		parte({
			Name = "Linea",
			Size = Vector3.new(9, 0.1, 0.7),
			Position = Vector3.new(parcela.origen.X - 34 + i * 17, 0.62, (zC0 + zC1) / 2),
			Color = Color3.fromRGB(238, 226, 172),
			Material = Enum.Material.Concrete,
		}, grupo)
	end
	for _, zb in ipairs({ zC0, zC1 }) do
		parte({
			Name = "Bordillo",
			Size = Vector3.new(anchoS + 80, 1.1, 1.2),
			Position = Vector3.new(parcela.origen.X + anchoS / 2, 0.55, zb),
			Color = Color3.fromRGB(196, 196, 198),
			Material = Enum.Material.Concrete,
			CanCollide = true,
			CanQuery = true,
		}, grupo)
	end

	-- La senal de la calle y dos farolas. Estan enterradas: cuando la
	-- calle aparece, se encienden, y esa es la pista de que hay mas.
	local xSenal = parcela.origen.X + (cxE1 + 3) * CELDA
	parte({
		Name = "PosteSenal",
		Size = Vector3.new(0.6, 12, 0.6),
		Position = Vector3.new(xSenal, 6, zC0 - 4),
		Color = Color3.fromRGB(150, 152, 156),
		Material = Enum.Material.Metal,
		CanCollide = true,
		CanQuery = true,
	}, grupo)
	local senal = parte({
		Name = "Senal",
		Size = Vector3.new(13, 2.6, 0.3),
		Position = Vector3.new(xSenal + 5, 11.4, zC0 - 4),
		Color = Color3.fromRGB(48, 92, 148),
		Material = Enum.Material.Metal,
	}, grupo)
	local cartel = Instance.new("SurfaceGui")
	cartel.Name = "Nombre"
	cartel.Face = Enum.NormalId.Front
	cartel.AlwaysOnTop = false
	cartel.CanvasSize = Vector2.new(400, 80)
	cartel.Parent = senal
	local letras = Instance.new("TextLabel")
	letras.Size = UDim2.new(1, 0, 1, 0)
	letras.BackgroundTransparency = 1
	letras.Text = "NEVADA ST."
	letras.TextColor3 = Color3.fromRGB(255, 255, 255)
	letras.Font = Enum.Font.GothamBlack
	letras.TextScaled = true
	letras.Parent = cartel

	local farolas = {}
	for _, dz in ipairs({ -1, 1 }) do
		for _, dx in ipairs({ -1, 1 }) do
			local fx = parcela.origen.X + anchoS / 2 + dx * (anchoS / 2 - 20)
			local fz = (zC0 + zC1) / 2 + dz * ((zC1 - zC0) / 2 + 5)
			parte({
				Name = "Farola",
				Size = Vector3.new(0.8, 22, 0.8),
				Position = Vector3.new(fx, 11, fz),
				Color = Color3.fromRGB(64, 68, 74),
				Material = Enum.Material.Metal,
				CanCollide = true,
				CanQuery = true,
			}, grupo)
			local foco = parte({
				Name = "Foco",
				Size = Vector3.new(3, 0.8, 2),
				Position = Vector3.new(fx, 21.8, fz),
				Color = Color3.fromRGB(120, 120, 126),
				Material = Enum.Material.SmoothPlastic,
			}, grupo)
			farolas[#farolas + 1] = { pieza = foco, luz = luzDe(foco, Color3.fromRGB(255, 236, 190), 0, 40) }
		end
	end

	-- El buzon: lo primero que aparece, a los pocos segundos de empezar.
	-- No sirve para nada. Sirve para que la primera palada tenga premio.
	local bx, bz = parcela:centro(S.cxBuzon, S.czBuzon)
	parte({
		Name = "PosteBuzon",
		Size = Vector3.new(0.7, 6, 0.7),
		Position = Vector3.new(bx, 3, bz),
		Color = MADERA,
		Material = Enum.Material.Wood,
		CanCollide = true,
		CanQuery = true,
	}, grupo)
	parte({
		Name = "Buzon",
		Size = Vector3.new(2.2, 2, 4),
		Position = Vector3.new(bx, 7, bz),
		Color = Color3.fromRGB(178, 62, 54),
		Material = Enum.Material.Metal,
		CanCollide = true,
		CanQuery = true,
	}, grupo)
	-- LA MARCA DE NIEVE. Es lo primero que se ve al aparecer, y lo unico
	-- que asoma aparte de la chimenea: un palo con la punta naranja
	-- clavado al lado del buzon, de los que se ponen para que el
	-- quitanieves no se lleve el buzon por delante. Sin algo asi, el
	-- jugador aparece y no sabe hacia donde dar la primera palada.
	parte({
		Name = "MarcaNieve",
		Size = Vector3.new(0.35, 17, 0.35),
		Position = Vector3.new(bx + 2.4, 8.5, bz + 1.6),
		Color = Color3.fromRGB(236, 236, 240),
		Material = Enum.Material.Plastic,
		CanCollide = true,
		CanQuery = true,
	}, grupo)
	local punta = parte({
		Name = "MarcaPunta",
		Size = Vector3.new(0.9, 2.4, 0.9),
		Position = Vector3.new(bx + 2.4, 16.4, bz + 1.6),
		Color = Color3.fromRGB(255, 122, 32),
		Material = Enum.Material.Neon,
	}, grupo)
	luzDe(punta, Color3.fromRGB(255, 150, 70), 1.1, 20)

	parte({
		Name = "BuzonBandera",
		Size = Vector3.new(0.3, 1.6, 0.9),
		Position = Vector3.new(bx + 1.2, 8.2, bz - 1),
		Color = Color3.fromRGB(235, 235, 235),
		Material = Enum.Material.Metal,
	}, grupo)

	return {
		cxE0 = cxE0, cxE1 = cxE1, czE0 = czE0, czE1 = czE1,
		czCal0 = czCal0, czCal1 = czCal1,
		farolas = farolas,
		senal = senal,
		luzSenal = luzDe(senal, Color3.fromRGB(190, 220, 255), 0, 16),
		buzonCx = S.cxBuzon, buzonCz = S.czBuzon,
		alturaBuzon = 6.2,
	}
end


-- El monton donde se vacia la carretilla. Hay dos, uno junto a casa y
-- otro junto a la calle, para que el viaje nunca sea el juego.
local function montonEn(parcela, grupo, x, z)
	local bola = parte({
		Name = "Monton",
		Shape = Enum.PartType.Ball,
		Size = Vector3.new(12, 12, 12),
		Position = Vector3.new(x, 2, z),
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
	parcela.descargas[#parcela.descargas + 1] = { sitio = Vector3.new(x, 0, z), bola = bola, echado = 0 }
	return bola
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
		Size = Vector3.new(anchoS + 120, 2, largoS + 120),
		Position = Vector3.new(parcela.origen.X + anchoS / 2, -1, parcela.origen.Z + largoS / 2),
		Color = Color3.fromRGB(96, 150, 76),
		Material = Enum.Material.Grass,
		CanCollide = true,
		CanQuery = true,
	}, grupo)

	local m = medidasCasa(parcela)
	construirCasa(parcela, grupo, m)
	parcela.casa = m
	parcela.vecino = construirVecino(parcela, grupo)
	parcela.calle = construirCalle(parcela, grupo, m)

	local v = parcela.vecino
	local c = parcela.calle
	local S = A.sitio

	-- EL PERFIL DE LA NEVADA.
	--
	-- Un manto alto y plano que baja a cero en el borde de la parcela: ese
	-- borde es la rampa por la que se sube al campo.
	--
	-- OJO, que esta es la leccion mas cara del diseno: con la regla de la
	-- pendiente solo se puede cavar en lo mas alto. Si el jugador naciera
	-- en el fondo de un hoyo, TODO a su alrededor estaria bloqueado y no
	-- podria cavar nada. Naciendo arriba, en el llano, todo vale.
	--
	-- Y encima de eso, EL VENTISQUERO DE LA CALLE: la calzada esta bajo
	-- catorce capas, casi tres metros, porque tiene que sentirse como una
	-- nevada de las que salen en las noticias.
	local function dentro(cx, cz, cx0, cz0, cx1, cz1)
		return cx >= cx0 and cx <= cx1 and cz >= cz0 and cz <= cz1
	end

	parcela:generar(function(cx, cz)
		-- Debajo de un edificio no hay nieve, y ahi no se cava.
		if dentro(cx, cz, m.cx0, m.cz0, m.cx1, m.cz1) then
			return 0, true
		end
		if dentro(cx, cz, m.gcx0, m.cz0, m.gcx1, m.cz1) then
			return 0, true
		end
		if dentro(cx, cz, v.cx0, v.cz0, v.cx1, v.cz1) then
			return 0, true
		end

		local capas = A.nieve.capasMaximas

		-- Contra las fachadas se amontona.
		if dentro(cx, cz, m.gcx0 - 2, m.cz0 - 2, m.cx1 + 2, m.cz1 + 3) then
			capas = A.nieve.capasContraLaCasa
		end
		if dentro(cx, cz, v.cx0 - 2, v.cz0 - 3, v.cx1 + 2, v.cz1 + 2) then
			capas = A.nieve.capasContraLaCasa
		end

		-- Y el muro que dejo la quitanieves delante de tu garaje: es lo
		-- que convierte "abrir el garaje" en un capitulo y no en un paso.
		if dentro(cx, cz, m.gcx0 - 1, m.cz1 + 1, m.gcx1 + 1, m.cz1 + 3) then
			capas = math.max(capas, A.nieve.capasContraElGaraje)
		end
		if dentro(cx, cz, v.cx0, v.cz0 - 4, v.cx1, v.cz0 - 1) then
			capas = math.max(capas, A.nieve.capasContraElVecino)
		end

		-- El ventisquero de la calle: sube una capa por casilla hasta el
		-- centro de la calzada. Sube de uno en uno a proposito, para que
		-- el alisado no tenga que tocarlo.
		local aLaCalle = math.abs(cz - S.czCarretera)
		if aLaCalle <= 7 then
			capas = math.max(capas, S.capasCarretera - aLaCalle)
		end

		-- Y la rampa del borde, que es por donde se entra y se sale.
		local alBorde = math.min(cx, cz, parcela.ancho - 1 - cx, parcela.largo - 1 - cz)
		capas = math.max(0, math.min(capas, (alBorde - 1) * A.nieve.desnivelMaximo))

		-- El repecho de entrada: por donde se aparece la nieve esta fina,
		-- barrida por el viento. No es decoracion: la pala ataca siempre
		-- lo mas alto que tiene al lado, asi que sin este llano el monton
		-- del buzon nunca seria lo primero que se desentierra.
		if cx >= S.cxBuzon - S.anchoRepecho and math.abs(cz - S.czBuzon) <= 5 then
			capas = math.min(capas, 4)
		end
		return capas
	end)

	-- Se aparece FUERA de la parcela, en suelo firme, al lado del buzon y
	-- mirando a la chimenea.
	-- EL MONTICULO DEL BUZON. Se pone DESPUES de alisar, a proposito.
	--
	-- La regla de la pendiente esta para que nadie se quede encerrado en
	-- un pozo. Un monton no encierra a nadie: se cava de arriba abajo sin
	-- bloquearse nunca. Y tiene que ser un monton, porque la pala ataca
	-- siempre lo mas alto que tiene al lado: si el buzon estuviera en lo
	-- bajo seria lo ULTIMO que aparece, en vez de lo primero.
	for cx = c.buzonCx - 1, c.buzonCx + 1 do
		for cz = c.buzonCz - 1, c.buzonCz + 1 do
			local casilla = parcela:casilla(cx, cz)
			if casilla and not casilla.muro then
				local lejos = math.max(math.abs(cx - c.buzonCx), math.abs(cz - c.buzonCz))
				local quiero = A.sitio.capasBuzon - lejos
				if quiero > casilla.restante then
					parcela.capasTotales = parcela.capasTotales + (quiero - casilla.restante)
					casilla.restante = quiero
					casilla.inicial = quiero
				end
			end
		end
	end

	-- Se aparece en linea recta con el buzon: es lo primero que se ve
	-- asomar y lo primero que se desentierra, en los primeros segundos.
	local bx, bz = parcela:centro(c.buzonCx, c.buzonCz)
	local sx = parcela.origen.X + anchoS + 18
	local sz = bz

	-- Dos montones donde vaciar la carretilla, en el arcen de al lado:
	-- uno a la altura de tu casa y otro pasada la calle. Con uno solo, la
	-- segunda mitad de la partida era ir y volver.
	montonEn(parcela, grupo, sx + 2, m.z)
	montonEn(parcela, grupo, sx + 2, parcela.origen.Z + (S.czCarretera + 9) * CELDA)

	parcela:nevar()

	-- Deja los contadores bien puestos ANTES del primer paquete: si no, el
	-- HUD empieza diciendo un numero y al segundo salta a otro.
	parcela.hallazgos = {}
	parcela.capitulo = 1
	revisarHallazgos(parcela)

	grupo:SetAttribute("casillas", parcela.ancho * parcela.largo)
	grupo:SetAttribute("capas", parcela.capasTotales)
	return sx, sz, bx, bz
end


local function construirMundo()
	pcall(function()
		Terreno:Clear()
	end)
	for _, obj in ipairs(workspace:GetChildren()) do
		if obj.Name == "Baseplate" or obj.Name == "Juego" or obj:IsA("SpawnLocation") then
			obj:Destroy()
		end
	end

	local carpeta = Instance.new("Folder")
	carpeta.Name = "Juego"
	carpeta.Parent = workspace
	mundo.carpeta = carpeta

	local parcela = Parcela.nueva(1, Vector3.new(0, 0, 0))
	parcelas[1] = parcela
	local sx, sz, bx, bz = construirParcela(parcela)

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
	-- Mirando hacia el buzon, que esta a dos paladas, y detras la chimenea.
	sitio.CFrame = CFrame.lookAt(Vector3.new(sx, 0.5, sz), Vector3.new(bx, 0.5, bz))
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
--  EL MUNDO REACCIONA
--
--  Esto es la mitad del juego. Cavar sin que pase nada es trabajo; cavar
--  y que se abra una puerta y salga luz es otra cosa. Ninguna reaccion
--  quita el control al jugador: se abre, suena, y a seguir.
-------------------------------------------------------------------

local function encender(luz, brillo, tiempo)
	if not luz then
		return
	end
	luz.Enabled = true
	pcall(function()
		Tweens:Create(luz, TweenInfo.new(tiempo or 1.2), { Brightness = brillo }):Play()
	end)
end

local function subirSonido(sonido, volumen)
	if not sonido then
		return
	end
	pcall(function()
		sonido:Play()
		Tweens:Create(sonido, TweenInfo.new(2), { Volume = volumen }):Play()
	end)
end

-- La puerta se abre hacia dentro, girando sobre su jamba. Nada de
-- desvanecerla: gira, y por el hueco sale la luz de tu casa.
local function abrirPuerta(parcela)
	local m = parcela.casa
	if not m or m.puertaAbierta then
		return
	end
	m.puertaAbierta = true

	local p = m.puerta
	local ancho = A.casa.puertaAncho
	local bisagra = CFrame.new(p.Position - Vector3.new(ancho / 2, 0, 0))
	pcall(function()
		Tweens:Create(p, TweenInfo.new(1.4, Enum.EasingStyle.Back, Enum.EasingDirection.Out), {
			CFrame = bisagra * CFrame.Angles(0, math.rad(84), 0) * CFrame.new(ancho / 2, 0, 0),
		}):Play()
	end)

	if m.recibidor then
		pcall(function()
			Tweens:Create(m.recibidor, TweenInfo.new(1.6), {
				Color = CALIDA,
			}):Play()
		end)
		m.recibidor.Material = Enum.Material.Neon
	end
	encender(m.luzRecibidor, 3.2, 1.6)
	subirSonido(m.sonidoCasa, 0.3)

	-- Y arranca el humo: desde ahora, tu casa se ve viva desde lejos.
	if m.humo then
		m.humo.Enabled = true
	end
end

-- El garaje: la puerta se enrolla hacia arriba y dentro hay luz. Lo que
-- hay dentro se ve desde fuera, que para eso se ha cavado.
local function abrirGaraje(parcela)
	local m = parcela.casa
	if not m or m.garajeAbierto then
		return
	end
	m.garajeAbierto = true

	local p = m.puertaGaraje
	pcall(function()
		Tweens:Create(p, TweenInfo.new(2, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), {
			Size = Vector3.new(p.Size.X, 0.6, p.Size.Z),
			Position = Vector3.new(p.Position.X, 8, p.Position.Z),
		}):Play()
	end)
	for _, r in ipairs(m.ranurasGaraje or {}) do
		pcall(function()
			Tweens:Create(r, TweenInfo.new(1.2), { Transparency = 1 }):Play()
		end)
	end
	encender(m.luzGaraje, 2.6, 1)
	pcall(function()
		m.sonidoGaraje:Play()
	end)
end

-- La calle abierta enciende las farolas, la senal, y — lo importante —
-- el humo de enfrente. Ese humo es el siguiente capitulo.
local function abrirCarretera(parcela)
	local c = parcela.calle
	local v = parcela.vecino
	if not c or c.encendida then
		return
	end
	c.encendida = true
	for _, f in ipairs(c.farolas) do
		f.pieza.Material = Enum.Material.Neon
		f.pieza.Color = Color3.fromRGB(255, 240, 202)
		encender(f.luz, 2.2, 2.5)
	end
	encender(c.luzSenal, 1.2, 2)
	if v then
		if v.humo then
			v.humo.Enabled = true
		end
		for _, cr in ipairs(v.cristales) do
			cr.pieza.Material = Enum.Material.Neon
			cr.pieza.Color = Color3.fromRGB(126, 106, 78)
			encender(cr.luz, 0.9, 3)
		end
	end
end

local function abrirVecino(parcela)
	local v = parcela.vecino
	if not v or v.abierta then
		return
	end
	v.abierta = true
	local ancho = A.vecino.puertaAncho
	local bisagra = CFrame.new(v.puerta.Position - Vector3.new(ancho / 2, 0, 0))
	pcall(function()
		Tweens:Create(v.puerta, TweenInfo.new(1.6, Enum.EasingStyle.Back, Enum.EasingDirection.Out), {
			CFrame = bisagra * CFrame.Angles(0, math.rad(-84), 0) * CFrame.new(ancho / 2, 0, 0),
		}):Play()
	end)
	v.recibidor.Material = Enum.Material.Neon
	pcall(function()
		Tweens:Create(v.recibidor, TweenInfo.new(1.6), { Color = CALIDA }):Play()
	end)
	encender(v.luzRecibidor, 3, 1.6)
	for _, cr in ipairs(v.cristales) do
		cr.pieza.Color = CALIDA
		encender(cr.luz, 2, 1.5)
	end
	subirSonido(v.sonido, 0.3)
end


-------------------------------------------------------------------
--  LA SOPLADORA, COMO OBJETO DEL MUNDO
--
--  No aparece en un menu: esta dentro del garaje, tirada, y hay que ir a
--  por ella. Hasta que no la tocas no la tienes.
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

	-- Coloca todo respecto al cuerpo. Se llama otra vez cada vez que el
	-- cuerpo se mueve, asi que el modelo nunca se descoloca.
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

	-- Que se vea desde fuera del garaje, aunque sea de lejos.
	local rotulo = Instance.new("BillboardGui")
	rotulo.Name = "Cogela"
	rotulo.Size = UDim2.new(0, 220, 0, 50)
	rotulo.StudsOffset = Vector3.new(0, 4.4, 0)
	rotulo.AlwaysOnTop = true
	rotulo.MaxDistance = 200
	rotulo.Parent = cuerpo
	local texto = Instance.new("TextLabel")
	texto.Size = UDim2.new(1, 0, 1, 0)
	texto.BackgroundTransparency = 1
	texto.Text = "SOPLADORA"
	texto.TextColor3 = Color3.fromRGB(255, 214, 138)
	texto.Font = Enum.Font.GothamBlack
	texto.TextScaled = true
	texto.Name = "Texto"
	texto.Parent = rotulo

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
	parcela.sopladoraAviso = aviso
	parcela.sopladoraSalida = salida
end


-------------------------------------------------------------------
--  LOS HALLAZGOS Y EL GUION
--
--  Un hallazgo salta cuando la nieve de encima baja POR DEBAJO de la
--  altura real de la cosa. Nada de umbrales a ojo: la geometria manda,
--  asi que lo que se anuncia es exactamente lo que se ve.
-------------------------------------------------------------------

local function aTodos(parcela, datos)
	for jugador, estado in pairs(estados) do
		if estado.parcela == parcela.id then
			RemotoAviso:FireClient(jugador, datos)
		end
	end
end

local function anunciar(parcela, def)
	aTodos(parcela, { tipo = "hallazgo", clave = def.clave, nombre = def.nombre })
end

local REACCION = {
	puerta = abrirPuerta,
	garaje = function(parcela)
		abrirGaraje(parcela)
		task.delay(1.1, function()
			pcall(soltarSopladora, parcela)
		end)
	end,
	carretera = abrirCarretera,
	vecino = abrirVecino,
}

-- El guion avanza SOLO porque has desenterrado algo. No hay botones.
local function avanzarCapitulo(parcela)
	local hechos = parcela.hallazgos
	local cumplido = {
		puerta = hechos.puerta,
		garaje = hechos.garaje,
		sopladora = parcela.sopladoraCogida,
		carretera = hechos.carretera,
		vecino = hechos.vecino,
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

	-- Todo lo de la casa se mide en la MISMA linea de vision: lo que hay
	-- delante de la puerta, que es desde donde mira el jugador. Medir el
	-- tejado contra los ventisqueros de detras lo dejaba escondido hasta
	-- el final siendo lo mas alto de la casa.
	local fachada = parcela:alturaMaximaEn(m.cxCentro - 1, m.cz1 + 1, m.cxCentro + 1, m.cz1 + 3)
	-- El buzon ocupa una casilla: se mide su casilla, ni una mas. Medir
	-- de mas es anunciar cosas que todavia no se ven.
	local buzon = parcela:alturaMaximaEn(c.buzonCx, c.buzonCz - 1, c.buzonCx, c.buzonCz + 1)
	-- El garaje se da por desenterrado cuando la fila de nieve que hay
	-- pegada a la puerta se va. Pedir mas era pedir otro crater entero.
	local garaje = parcela:alturaMaximaEn(m.garajeCx - 1, m.cz1 + 1, m.garajeCx + 1, m.cz1 + 1)
	local entrada = parcela:alturaMaximaEn(m.garajeCx - 2, m.cz1 + 1, m.garajeCx + 2, A.sitio.czCarretera + 1)
	local puertaVecino = parcela:alturaMaximaEn(v.cxCentro - 2, v.cz0 - 4, v.cxCentro + 2, v.cz0 - 1)

	-- La calle no se "ve": se ABRE. No basta con hacer un boquete encima
	-- del asfalto: hay que dejar pasable la entrada entera desde el
	-- garaje, que es exactamente el trabajo de la sopladora, y despues
	-- romper el ultimo colchon con la pala, que es lo que la descubre.
	--
	-- Se pide llegar al asfalto Y dejar la entrada pasable, no impecable:
	-- pasable es lo que la sopladora deja sola, y rematar el ultimo trozo
	-- con la pala es lo que descubre la calle. Pedir la entrada entera
	-- raspada convertia el capitulo en un turno de trabajo de verdad.
	local corredor = parcela:capasEncima(
		m.garajeCx - 2, m.cz1 + 1,
		m.garajeCx + 2, A.sitio.czCarretera - 1
	)
	-- Y el hueco que hay que abrir en la calzada es de verdad: el ancho
	-- de la entrada de coches, no un agujero de una palada.
	local asfalto = parcela:capasEncima(
		m.garajeCx - 2, A.sitio.czCarretera - 1,
		m.garajeCx + 2, A.sitio.czCarretera + 1
	)
	local hastaElAsfalto = asfalto == 0 and corredor <= A.sitio.capasEntradaPasable

	local visible = {
		buzon = buzon < c.alturaBuzon,
		tejado = fachada < m.alturaTejado,
		porche = fachada < m.alturaPorche,
		ventana = fachada < m.alturaVentana,
		puerta = fachada < 0.5,
		garaje = garaje < 2.2,
		carretera = hastaElAsfalto,
		vecino = puertaVecino < 2.2,
	}

	for _, def in ipairs(A.hallazgos) do
		if visible[def.clave] and not parcela.hallazgos[def.clave] then
			parcela.hallazgos[def.clave] = true
			anunciar(parcela, def)
			local reaccion = REACCION[def.clave]
			if reaccion then
				task.spawn(function()
					pcall(reaccion, parcela)
				end)
			end
		end
	end

	-- El numero grande del HUD: cuanta nieve queda sobre lo que buscas
	-- AHORA. Es la barra de progreso de verdad del capitulo.
	local capa = A.nieve.capa
	local porCapitulo = {
		puerta = fachada,
		garaje = garaje,
		sopladora = 0,
		carretera = entrada,
		vecino = puertaVecino,
		fin = 0,
	}
	local cap = A.capitulos[parcela.capitulo] or A.capitulos[1]
	parcela.capasObjetivo = math.ceil((porCapitulo[cap.clave] or 0) / capa)
	parcela.alturaObjetivo = porCapitulo[cap.clave] or 0

	avanzarCapitulo(parcela)
end


-------------------------------------------------------------------
--  LAS DOS HERRAMIENTAS EN LA MANO
--
--  La pala se levanta y golpea. La sopladora vibra y escupe nieve a un
--  lado. No son la misma animacion mas rapida: se manejan distinto y se
--  ven distinto, que es todo el asunto.
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

local function darHerramienta(jugador, pers, estado)
	for _, nombre in ipairs({ "Pala", "Sopladora" }) do
		local vieja = pers:FindFirstChild(nombre)
		if vieja then
			vieja:Destroy()
		end
	end
	local brazo = manoDe(pers)
	if not brazo then
		return
	end
	estado.motor = nil
	estado.emisor = nil
	estado.chorro = nil
	estado.ruido = nil

	if estado.herramienta == "sopladora" then
		local grupo, cuerpo, salida, armar = piezasSopladora(pers, 0.72, "Sopladora")
		cuerpo.CFrame = brazo.CFrame * SOPLA_REPOSO
		armar()
		-- Soldar todo al cuerpo; el cuerpo va al Motor6D, que es lo unico
		-- que se puede animar.
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
		local motor = Instance.new("Motor6D")
		motor.Name = "Empunadura"
		motor.Part0 = brazo
		motor.Part1 = cuerpo
		motor.C0 = SOPLA_REPOSO
		motor.Parent = brazo

		-- EL CHORRO. Sale por el tubo, hacia arriba y hacia el lado, y cae
		-- en arco: es la firma visual de la sopladora.
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

	-- Motor6D y no soldadura: asi se puede animar el golpe moviendo C0.
	local motor = Instance.new("Motor6D")
	motor.Name = "Empunadura"
	motor.Part0 = brazo
	motor.Part1 = mango
	motor.C0 = PALA_REPOSO
	motor.Parent = brazo

	estado.motor = motor
	estado.emisor = polvoEn(hoja, 50)
	grupo.Parent = pers
end


-- La pala baja de verdad y salta la nieve. Solo se llama cuando la
-- palada HA QUITADO algo: animar contra el suelo pelado es mentir.
local function animarPala(estado)
	if not estado.motor then
		return
	end
	pcall(function()
		Tweens:Create(estado.motor, TweenInfo.new(0.12, Enum.EasingStyle.Quad, Enum.EasingDirection.In), {
			C0 = PALA_GOLPE,
		}):Play()
	end)
	task.delay(0.14, function()
		if estado.emisor then
			pcall(function()
				estado.emisor:Emit(16)
			end)
		end
		if estado.motor then
			pcall(function()
				Tweens:Create(estado.motor, TweenInfo.new(0.24, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), {
					C0 = PALA_REPOSO,
				}):Play()
			end)
		end
	end)
end

-- La sopladora no golpea: empuja y escupe. Se nota en las manos y se ve
-- salir el chorro por el lado.
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
--  Las dos herramientas comparten la regla de la pendiente. Se
--  diferencian en QUE casillas alcanzan y HASTA DONDE bajan:
--
--    pala       circulo pequeno alrededor,  baja hasta el suelo
--    sopladora  franja ancha por delante,   deja un colchon
-------------------------------------------------------------------

-- Los montones que va dejando la sopladora al lado. Son el rastro de por
-- donde has pasado, y por eso la calle abierta se ve abierta.
local function amontonar(parcela, sitio)
	parcela.montoncitos = parcela.montoncitos or {}
	for _, mon in ipairs(parcela.montoncitos) do
		if (mon.Position - sitio).Magnitude < 11 then
			local nuevo = math.min(15, mon.Size.X + 0.55)
			mon.Size = Vector3.new(nuevo, nuevo, nuevo)
			mon.Position = Vector3.new(mon.Position.X, sitio.Y + nuevo * 0.18, mon.Position.Z)
			return
		end
	end
	if #parcela.montoncitos >= 80 then
		return
	end
	local bola = parte({
		Name = "Montoncito",
		Shape = Enum.PartType.Ball,
		Size = Vector3.new(5, 5, 5),
		Position = sitio + Vector3.new(0, 0.9, 0),
		Color = NIEVE,
		Material = Enum.Material.Snow,
		CastShadow = true,
	}, parcela.carpeta)
	parcela.montoncitos[#parcela.montoncitos + 1] = bola
end


local function excavarPala(parcela, pos, def, tope)
	local radio2 = def.radio * def.radio
	local cxMin, czMin = parcela:aCasilla(pos.X - def.radio, pos.Z - def.radio)
	local cxMax, czMax = parcela:aCasilla(pos.X + def.radio, pos.Z + def.radio)

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
		if hechas >= tope then
			break
		end
		if parcela:excavar(casilla.cx, casilla.cz, def.dejaCapas) then
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
				if c and not c.muro and c.restante > 0 then
					habiaNieve = true
					if c.restante > def.dejaCapas then
						candidatas[#candidatas + 1] = { cx = cx, cz = cz, alto = c.restante }
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
		if parcela:excavar(casilla.cx, casilla.cz, def.dejaCapas) then
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
	estado.parcela = parcela.id

	local def = A.herramientas[estado.herramienta] or A.herramientas.pala
	local esSopladora = estado.herramienta == "sopladora"

	-- La carretilla solo la llena la pala. La sopladora no carga nada: lo
	-- que quita lo escupe al lado, y por eso con ella no hay viajes.
	local tope = def.potencia
	if not esSopladora then
		local hueco = A.jugador.capacidad - estado.carga
		if hueco <= 0 then
			-- Con la carretilla llena no se pala: ni animacion ni nieve
			-- saliendo, que era enganar al jugador.
			estado.bloqueado = false
			return 0
		end
		tope = math.min(tope, hueco)
	end

	local hechas, habiaNieve, soloFondo
	if esSopladora then
		local frente = raiz and raiz.CFrame.LookVector or Vector3.new(0, 0, 1)
		local mirada = Vector3.new(frente.X, 0, frente.Z)
		if mirada.Magnitude < 0.05 then
			mirada = Vector3.new(0, 0, 1)
		end
		mirada = mirada.Unit
		local derecha = Vector3.new(-mirada.Z, 0, mirada.X)
		hechas, habiaNieve, soloFondo = excavarSopladora(parcela, pos, mirada, derecha, def, tope)
		if hechas > 0 then
			local x = pos.X + derecha.X * def.desvio
			local z = pos.Z + derecha.Z * def.desvio
			local cx, cz = parcela:aCasilla(x, z)
			amontonar(parcela, Vector3.new(x, parcela:alturaEn(cx, cz), z))
		end
	else
		hechas, habiaNieve, soloFondo = excavarPala(parcela, pos, def, tope)
	end

	-- Si no se ha podido bajar nada pero queda nieve, es que hay que
	-- ensanchar. No se ignora el golpe: se dice por que no ha servido.
	estado.soloPala = soloFondo == true
	estado.bloqueado = (hechas == 0 and habiaNieve and not estado.soloPala)
	estado.bloqueadoEn = estado.bloqueado and Vector3.new(pos.X, 0, pos.Z) or nil

	if hechas > 0 then
		if esSopladora then
			-- Va directo al marcador: no pasa por la carretilla.
			estado.dinero = estado.dinero + hechas * A.dinero.porCapa
			estado.nieveTotal = estado.nieveTotal + hechas
		else
			estado.carga = estado.carga + hechas
		end
		revisarHallazgos(parcela)
	end
	return hechas
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

	-- El monton mas cercano: hay uno junto a casa y otro junto a la calle,
	-- para que el viaje nunca se coma la partida.
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

	local ganado = estado.carga * A.dinero.porCapa
	estado.dinero = estado.dinero + ganado
	estado.nieveTotal = estado.nieveTotal + estado.carga
	elegido.echado = elegido.echado + estado.carga
	estado.carga = 0

	-- El monton crece con lo que se le echa: es el marcador de verdad.
	if elegido.bola then
		local crecido = 12 + math.min(34, elegido.echado / 90)
		elegido.bola.Size = Vector3.new(crecido, crecido, crecido)
		elegido.bola.Position = Vector3.new(elegido.sitio.X, crecido * 0.18, elegido.sitio.Z)
	end

	RemotoAviso:FireClient(jugador, { tipo = "descarga", cantidad = ganado })
	local marcador = jugador:FindFirstChild("leaderstats")
	local monedas = marcador and marcador:FindFirstChild("Coins")
	if monedas then
		monedas.Value = math.clamp(math.floor(estado.dinero), 0, 2147483647)
	end
end


-- Coger la sopladora es acercarse a ella. Ni menu, ni compra, ni nada.
local function cogerSopladora(jugador, estado, parcela)
	if estado.tiene.sopladora then
		return
	end
	estado.tiene.sopladora = true
	estado.herramienta = "sopladora"
	parcela.sopladoraCogida = true

	if parcela.sopladoraSuelta then
		parcela.sopladoraSuelta:Destroy()
		parcela.sopladoraSuelta = nil
		parcela.sopladoraCuerpo = nil
	end

	local pers = jugador.Character
	if pers then
		pcall(darHerramienta, jugador, pers, estado)
	end
	RemotoAviso:FireClient(jugador, { tipo = "cogida" })
	avanzarCapitulo(parcela)
end

local function revisarRecogida(jugador, estado, pos)
	local parcela = parcelas[estado.parcela] or parcelas[1]
	if not parcela or not parcela.sopladoraCuerpo or estado.tiene.sopladora then
		return
	end
	if (pos - parcela.sopladoraCuerpo.Position).Magnitude <= A.sitio.radioCogida then
		cogerSopladora(jugador, estado, parcela)
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
	local cap = parcela and A.capitulos[parcela.capitulo] or A.capitulos[1]
	return {
		dinero = math.floor(estado.dinero),
		carga = estado.carga,
		capacidad = A.jugador.capacidad,
		nieveTotal = estado.nieveTotal,
		limpio = parcela and parcela:limpio() or 0,
		capitulo = cap.clave,
		capasObjetivo = parcela and parcela.capasObjetivo or 0,
		herramienta = estado.herramienta,
		tieneSopladora = estado.tiene.sopladora == true,
		bloqueado = estado.bloqueado == true,
		soloPala = estado.soloPala == true,
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
		cavando = false,
		ultimoGolpe = 0,
		herramienta = "pala",
		-- La sopladora no se compra: se encuentra. Hasta entonces, no
		-- existe para este jugador.
		tiene = { pala = true, sopladora = false },
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
			darHerramienta(jugador, pers, estado)
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
		if estado.ruido then
			estado.ruido.Volume = estado.cavando and 0.32 or 0
		end
	end
end)

-- Cambiar de herramienta. Solo valen las que se tienen: pedir la
-- sopladora antes de encontrarla no hace nada.
RemotoHerramienta.OnServerEvent:Connect(function(jugador, clave)
	local estado = estados[jugador]
	if not estado or type(clave) ~= "string" then
		return
	end
	if not A.herramientas[clave] or not estado.tiene[clave] then
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


-------------------------------------------------------------------
--  BUCLES
-------------------------------------------------------------------

local function bucle(nombre, cada, fn)
	task.spawn(function()
		while true do
			task.wait(cada)
			local ok, err = pcall(fn)
			if not ok then
				warn("[calle] fallo en " .. nombre .. ": " .. tostring(err))
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

			-- Los avisos no se quedan pegados: caducan al soltar, al
			-- moverse de sitio, o al salirse de la parcela.
			if not estado.cavando then
				estado.bloqueado = false
				estado.soloPala = false
			elseif estado.bloqueado and estado.bloqueadoEn then
				if (Vector3.new(pos.X, 0, pos.Z) - estado.bloqueadoEn).Magnitude > 5 then
					estado.bloqueado = false
				end
			end
			if estado.cavando and not parcelaEn(pos.X, pos.Z) then
				estado.bloqueado = false
				estado.soloPala = false
			end

			-- Solo se cava si el jugador esta pulsando, y a golpes: una
			-- pasada cada tantos segundos, no un chorro continuo.
			if estado.cavando and (os.clock() - (estado.ultimoGolpe or 0)) >= def.golpe then
				estado.ultimoGolpe = os.clock()
				-- La herramienta solo se mueve y solo salta nieve si la
				-- pasada ha QUITADO algo. Nada de animar contra el suelo.
				local hechas = excavarPara(jugador, estado, pos, raiz)
				if hechas > 0 then
					if estado.herramienta == "sopladora" then
						animarSopladora(estado)
					else
						animarPala(estado)
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
		RemotoEstado:FireClient(jugador, paqueteDe(estado))
		local marcador = jugador:FindFirstChild("leaderstats")
		local nieve = marcador and marcador:FindFirstChild("Snow")
		if nieve then
			nieve.Value = math.clamp(math.floor(estado.nieveTotal), 0, 2147483647)
		end
		local monedas = marcador and marcador:FindFirstChild("Coins")
		if monedas then
			monedas.Value = math.clamp(math.floor(estado.dinero), 0, 2147483647)
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
	("[calle] parcela lista: %d casillas, %d capas de nieve, %d capas sobre la calle"):format(
		parcelas[1].ancho * parcelas[1].largo,
		parcelas[1].capasTotales,
		parcelas[1]:capasEncima(
			parcelas[1].casa.garajeCx - 1,
			A.sitio.czCarretera - 1,
			parcelas[1].casa.garajeCx + 1,
			A.sitio.czCarretera + 1
		)
	)
)
