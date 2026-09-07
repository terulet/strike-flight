--[[
	EL BARRIO DESPIERTA  —  construir el mundo

	Todo lo que se puede volver a levantar a partir de los ajustes vive
	aqui, y por eso nada de esto se guarda: casas, calles, luces, humo,
	carteles y montones. Lo unico que se guarda es lo que no se puede
	deducir — cuanta nieve queda y por donde iba el guion.

	Una parcela, de punta a punta:

	    cx 3    el buzon, con su marca de nieve asomando
	    cx 20   tu casa, mirando a +Z, con el garaje al lado
	    cz 26   la calle, cruzandola entera de este a oeste
	    cz 50   la casa del vecino, mirandote
	    cx 64   la plaza, donde termina esta version

	Este archivo va en:  ServerScriptService  (ModuleScript, "Mundo")
]]

local RS = game:GetService("ReplicatedStorage")
local A = require(RS:WaitForChild("Ajustes"))

local CELDA = A.nieve.celda

local Mundo = {}

local NIEVE = Color3.fromRGB(246, 250, 255)
local CALIDA = Color3.fromRGB(255, 214, 138)
local PIZARRA = Color3.fromRGB(64, 70, 84)
local LADRILLO = Color3.fromRGB(152, 88, 70)
local MADERA = Color3.fromRGB(122, 82, 50)
local CREMA = Color3.fromRGB(238, 224, 198)

Mundo.CALIDA = CALIDA
Mundo.NIEVE = NIEVE

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
Mundo.parte = parte

local function luzDe(padre, color, brillo, alcance)
	local l = Instance.new("PointLight")
	l.Color = color
	l.Brightness = brillo
	l.Range = alcance
	l.Enabled = brillo > 0
	l.Parent = padre
	return l
end
Mundo.luzDe = luzDe

local function sonidoDe(padre, nombre, id, volumen, tono, enBucle)
	local s = Instance.new("Sound")
	s.Name = nombre
	s.SoundId = id
	s.Volume = volumen
	s.PlaybackSpeed = tono
	s.Looped = enBucle == true
	s.RollOffMaxDistance = 140
	s.RollOffMinDistance = 8
	s.Parent = padre
	return s
end
Mundo.sonidoDe = sonidoDe

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
--  MEDIDAS
--
--  Todo sale de aqui, para que mover una casa no descuadre nada.
-------------------------------------------------------------------

function Mundo.medidasCasa(parcela)
	local mediaAncho = math.ceil(A.casa.ancho / CELDA / 2)
	local mediaFondo = math.ceil(A.casa.fondo / CELDA / 2)
	local m = {
		cxCentro = A.sitio.cxCasa,
		czCentro = A.sitio.czCasa,
		cx0 = A.sitio.cxCasa - mediaAncho,
		cx1 = A.sitio.cxCasa + mediaAncho,
		cz0 = A.sitio.czCasa - mediaFondo,
		cz1 = A.sitio.czCasa + mediaFondo,
	}
	m.x, m.z = parcela:centro(m.cxCentro, m.czCentro)
	m.zFachada = m.z + A.casa.fondo / 2

	-- El garaje, pegado al lado -X de la casa.
	m.garajeX = m.x - A.casa.ancho / 2 - A.casa.garajeAncho / 2
	m.garajeCx = math.floor((m.garajeX - parcela.origen.X) / CELDA)
	m.gcx0 = math.floor((m.garajeX - A.casa.garajeAncho / 2 - 2 - parcela.origen.X) / CELDA)
	m.gcx1 = math.floor((m.garajeX + A.casa.garajeAncho / 2 + 2 - parcela.origen.X) / CELDA)
	m.garajeFrenteZ = m.z + (A.casa.fondo - 4) / 2
	return m
end

function Mundo.medidasVecino(parcela)
	local V = A.vecino
	local v = { cxCentro = A.sitio.cxCasa, czCentro = A.sitio.czVecino }
	v.x, v.z = parcela:centro(v.cxCentro, v.czCentro)
	v.zFachada = v.z - V.fondo / 2
	v.cx0 = math.floor((v.x - V.ancho / 2 - 2 - parcela.origen.X) / CELDA)
	v.cx1 = math.floor((v.x + V.ancho / 2 + 2 - parcela.origen.X) / CELDA)
	v.cz0 = math.floor((v.z - V.fondo / 2 - 2 - parcela.origen.Z) / CELDA)
	v.cz1 = math.floor((v.z + V.fondo / 2 + 2 - parcela.origen.Z) / CELDA)
	return v
end


-------------------------------------------------------------------
--  TU CASA
-------------------------------------------------------------------

function Mundo.casa(parcela, padre, m)
	local grupo = Instance.new("Folder")
	grupo.Name = "Casa"
	grupo.Parent = padre

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

	pieza("Cuerpo", Vector3.new(A.casa.ancho, A.casa.alto, A.casa.fondo),
		Vector3.new(m.x, A.casa.alto / 2, m.z), CREMA, Enum.Material.Concrete)
	pieza("Zocalo", Vector3.new(A.casa.ancho + 1.4, 3.2, A.casa.fondo + 1.4),
		Vector3.new(m.x, 1.6, m.z), LADRILLO, Enum.Material.Brick)
	for _, dx in ipairs({ -1, 1 }) do
		pieza("Esquina", Vector3.new(2.2, A.casa.alto, 2.2),
			Vector3.new(m.x + dx * (A.casa.ancho / 2 - 1), A.casa.alto / 2, m.z + A.casa.fondo / 2 - 1),
			Color3.fromRGB(216, 206, 190), Enum.Material.Concrete)
	end

	-- Cubierta a escalones: a distancia lee como un tejado a dos aguas y
	-- no puede salir torcida, que es lo que pasa con las cunas.
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
	-- primer "hacia alli" del juego.
	local chx = m.x + A.casa.ancho / 2 - 6
	local chz = m.z - A.casa.fondo / 4
	pieza("Chimenea", Vector3.new(5, A.casa.alturaChimenea, 5),
		Vector3.new(chx, A.casa.alturaChimenea / 2, chz), LADRILLO, Enum.Material.Brick)
	local boca = pieza("ChimeneaBoca", Vector3.new(6, 1.2, 6),
		Vector3.new(chx, A.casa.alturaChimenea + 0.6, chz), PIZARRA, Enum.Material.Slate)
	pieza("ChimeneaNieve", Vector3.new(6.2, 0.6, 6.2),
		Vector3.new(chx, A.casa.alturaChimenea + 1.4, chz), NIEVE, Enum.Material.Snow, false)
	m.humo = humoEn(boca, 5)

	-- El porche.
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

	-- LA PUERTA, con su hueco detras: empieza a oscuras y se enciende
	-- cuando la descubres. Es toda la recompensa del primer capitulo.
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

	local yVentana = 6.4
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

	-- EL GARAJE, hueco de verdad: al abrir la puerta se entra dentro.
	local gx = m.garajeX
	local gAlto = A.casa.alto - 2
	local gFondo = A.casa.fondo - 4
	local gaFrente = m.garajeFrenteZ
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
		Vector3.new(gx, 4.2, gaFrente + 0.3), Color3.fromRGB(206, 208, 212), Enum.Material.Metal)
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
	m.sonidoGaraje = sonidoDe(puertaGaraje, "Portazo", "rbxasset://sounds/action_get_up.mp3", 0.7, 0.5, false)

	m.alturaTejado = alturaTejado
	m.alturaPorche = alturaPorche + 1.5
	m.alturaVentana = yVentana + 3.1
	m.puerta = puerta
	m.grupo = grupo
	return m
end


-------------------------------------------------------------------
--  LA CASA DE ENFRENTE
--
--  Empieza apagada. Cuando abres la calle se enciende un poco, sale
--  humo y alguien golpea la ventana. Ese golpe es el capitulo siguiente.
-------------------------------------------------------------------

function Mundo.vecino(parcela, padre, v)
	local grupo = Instance.new("Folder")
	grupo.Name = "Vecino"
	grupo.Parent = padre

	local V = A.vecino
	local AZUL = Color3.fromRGB(206, 214, 226)
	local x, z, zFachada = v.x, v.z, v.zFachada

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

	-- LA SILUETA. Detras del cristal de la izquierda. No dice nada: se
	-- mueve y golpea, y con eso se entiende todo sin una linea de texto.
	local silueta = pieza("Silueta", Vector3.new(2.6, 4.4, 0.4),
		Vector3.new(x - 11, 5.4, zFachada + 0.1), Color3.fromRGB(26, 24, 30),
		Enum.Material.SmoothPlastic, false)
	silueta.Transparency = 1

	-- EL VECINO. Sale por la puerta cuando la desentierras, te da las
	-- llaves y se queda en el escalon. Ni una linea de dialogo.
	local persona = Instance.new("Model")
	persona.Name = "Persona"
	local function trozo(nombre, tam, pos, color)
		local p = parte({
			Name = nombre,
			Size = tam,
			Position = pos,
			Color = color,
			Material = Enum.Material.SmoothPlastic,
			Transparency = 1,
		}, persona)
		return p
	end
	local baseY = 1.2
	local cuerpo = trozo("Torso", Vector3.new(2.6, 3, 1.4), Vector3.new(x, baseY + 3.4, zFachada + 2),
		Color3.fromRGB(178, 74, 62))
	persona.PrimaryPart = cuerpo
	trozo("Cabeza", Vector3.new(1.7, 1.7, 1.7), Vector3.new(x, baseY + 5.8, zFachada + 2),
		Color3.fromRGB(232, 194, 160))
	trozo("Gorro", Vector3.new(2, 0.9, 2), Vector3.new(x, baseY + 6.9, zFachada + 2),
		Color3.fromRGB(220, 96, 84))
	for _, dx in ipairs({ -1.8, 1.8 }) do
		trozo("Brazo", Vector3.new(0.9, 2.8, 0.9), Vector3.new(x + dx, baseY + 3.4, zFachada + 2),
			Color3.fromRGB(150, 60, 50))
	end
	for _, dx in ipairs({ -0.7, 0.7 }) do
		trozo("Pierna", Vector3.new(1, 2.4, 1), Vector3.new(x + dx, baseY + 0.7, zFachada + 2),
			Color3.fromRGB(56, 60, 74))
	end
	local llaves = trozo("Llaves", Vector3.new(1, 1, 1), Vector3.new(x + 2.6, baseY + 4.2, zFachada + 2.6),
		Color3.fromRGB(255, 214, 96))
	llaves.Material = Enum.Material.Neon
	local luzLlaves = luzDe(llaves, Color3.fromRGB(255, 214, 96), 0, 16)
	persona.Parent = grupo

	return {
		x = x,
		z = z,
		zFachada = zFachada,
		cx0 = v.cx0, cx1 = v.cx1, cz0 = v.cz0, cz1 = v.cz1,
		cxCentro = v.cxCentro,
		puerta = puerta,
		recibidor = recibidor,
		luzRecibidor = luzDe(recibidor, CALIDA, 0, 30),
		humo = humoEn(boca, 4.4),
		cristales = cristales,
		silueta = silueta,
		persona = persona,
		personaCuerpo = cuerpo,
		llaves = llaves,
		luzLlaves = luzLlaves,
		sonido = sonidoDe(recibidor, "Vecino", "rbxasset://sounds/action_falling.mp3", 0, 0.4, true),
		golpe = sonidoDe(silueta, "Golpe", "rbxasset://sounds/action_get_up.mp3", 0.8, 1.6, false),
	}
end


-------------------------------------------------------------------
--  LA CALLE, LA ENTRADA, EL BUZON Y LA PLAZA
--
--  Estan ahi desde el primer segundo, debajo de la nieve. Lo que las
--  descubre no es un boton: son las herramientas.
-------------------------------------------------------------------

function Mundo.calle(parcela, padre, m)
	local grupo = Instance.new("Folder")
	grupo.Name = "Calle"
	grupo.Parent = padre

	local S = A.sitio
	local media = math.floor(S.anchoEntrada / 2)
	local cxE0, cxE1 = m.garajeCx - media, m.garajeCx + media
	local czCal0 = S.czCarretera - math.floor(S.anchoCarretera / 2)
	local czCal1 = S.czCarretera + math.floor(S.anchoCarretera / 2)
	local czE0 = math.floor((m.garajeFrenteZ + 1 - parcela.origen.Z) / CELDA)
	local czE1 = czCal0 - 1

	local xE0 = parcela.origen.X + cxE0 * CELDA
	local xE1 = parcela.origen.X + (cxE1 + 1) * CELDA
	local zE0 = parcela.origen.Z + czE0 * CELDA
	local zE1 = parcela.origen.Z + (czE1 + 1) * CELDA
	local zC0 = parcela.origen.Z + czCal0 * CELDA
	local zC1 = parcela.origen.Z + (czCal1 + 1) * CELDA
	local anchoS = parcela.ancho * CELDA

	parte({
		Name = "Entrada",
		Size = Vector3.new(xE1 - xE0, 0.6, zE1 - zE0),
		Position = Vector3.new((xE0 + xE1) / 2, 0.3, (zE0 + zE1) / 2),
		Color = Color3.fromRGB(158, 158, 160),
		Material = Enum.Material.Concrete,
		CanCollide = true,
		CanQuery = true,
	}, grupo)

	-- LA CALLE, de punta a punta de la parcela. Es la que va a limpiar el
	-- quitanieves, y por eso llega hasta el borde por los dos lados.
	parte({
		Name = "Carretera",
		Size = Vector3.new(anchoS + 40, 0.6, zC1 - zC0),
		Position = Vector3.new(parcela.origen.X + anchoS / 2, 0.3, (zC0 + zC1) / 2),
		Color = Color3.fromRGB(58, 58, 62),
		Material = Enum.Material.Asphalt,
		CanCollide = true,
		CanQuery = true,
	}, grupo)
	for i = 0, 17 do
		parte({
			Name = "Linea",
			Size = Vector3.new(9, 0.1, 0.7),
			Position = Vector3.new(parcela.origen.X - 16 + i * 19, 0.62, (zC0 + zC1) / 2),
			Color = Color3.fromRGB(238, 226, 172),
			Material = Enum.Material.Concrete,
		}, grupo)
	end
	for _, zb in ipairs({ zC0, zC1 }) do
		parte({
			Name = "Bordillo",
			Size = Vector3.new(anchoS + 40, 1.1, 1.2),
			Position = Vector3.new(parcela.origen.X + anchoS / 2, 0.55, zb),
			Color = Color3.fromRGB(196, 196, 198),
			Material = Enum.Material.Concrete,
			CanCollide = true,
			CanQuery = true,
		}, grupo)
	end

	-- LA PLAZA: la calle se ensancha al final. Aqui termina esta version.
	local xP = parcela.origen.X + (S.cxPlaza + 0.5) * CELDA
	local zP = (zC0 + zC1) / 2
	local ladoP = (S.radioPlaza * 2 + 1) * CELDA
	parte({
		Name = "Plaza",
		Size = Vector3.new(ladoP, 0.6, ladoP),
		Position = Vector3.new(xP, 0.3, zP),
		Color = Color3.fromRGB(126, 122, 118),
		Material = Enum.Material.Cobblestone,
		CanCollide = true,
		CanQuery = true,
	}, grupo)
	parte({
		Name = "PlazaCirculo",
		Shape = Enum.PartType.Cylinder,
		Size = Vector3.new(0.5, ladoP * 0.5, ladoP * 0.5),
		Position = Vector3.new(xP, 0.65, zP),
		Color = Color3.fromRGB(150, 146, 140),
		Material = Enum.Material.Cobblestone,
		CFrame = CFrame.new(xP, 0.65, zP) * CFrame.Angles(0, 0, math.rad(90)),
	}, grupo)

	-- EL CARTEL DEL PUEBLO, medio enterrado. Es el cierre y la promesa.
	local poste = parte({
		Name = "PostePueblo",
		Size = Vector3.new(1.2, 16, 1.2),
		Position = Vector3.new(xP, 8, zP + 10),
		Color = Color3.fromRGB(96, 74, 56),
		Material = Enum.Material.Wood,
		CanCollide = true,
		CanQuery = true,
	}, grupo)
	local cartel = parte({
		Name = "CartelPueblo",
		Size = Vector3.new(22, 6, 0.5),
		Position = Vector3.new(xP, 14, zP + 10),
		Color = Color3.fromRGB(52, 84, 62),
		Material = Enum.Material.Wood,
		CanCollide = true,
		CanQuery = true,
	}, grupo)
	local rotulo = Instance.new("SurfaceGui")
	rotulo.Name = "Nombre"
	rotulo.Face = Enum.NormalId.Back
	rotulo.CanvasSize = Vector2.new(500, 140)
	rotulo.Parent = cartel
	local letras = Instance.new("TextLabel")
	letras.Size = UDim2.new(1, 0, 1, 0)
	letras.BackgroundTransparency = 1
	letras.Text = "VALNEVADA"
	letras.TextColor3 = Color3.fromRGB(255, 255, 255)
	letras.Font = Enum.Font.GothamBlack
	letras.TextScaled = true
	letras.Parent = rotulo

	-- La senal de tu calle, a la salida de tu entrada.
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
	local cartelCalle = Instance.new("SurfaceGui")
	cartelCalle.Name = "Nombre"
	cartelCalle.Face = Enum.NormalId.Front
	cartelCalle.CanvasSize = Vector2.new(400, 80)
	cartelCalle.Parent = senal
	local letrasCalle = Instance.new("TextLabel")
	letrasCalle.Size = UDim2.new(1, 0, 1, 0)
	letrasCalle.BackgroundTransparency = 1
	letrasCalle.Text = "NEVADA ST."
	letrasCalle.TextColor3 = Color3.fromRGB(255, 255, 255)
	letrasCalle.Font = Enum.Font.GothamBlack
	letrasCalle.TextScaled = true
	letrasCalle.Parent = cartelCalle

	-- Farolas a lo largo de toda la calle: se encienden de golpe cuando
	-- llegas al asfalto, y esa fila de luces es la que dice "hay pueblo".
	local farolas = {}
	for i = 0, 5 do
		local fx = parcela.origen.X + 24 + i * 52
		for _, dz in ipairs({ -1, 1 }) do
			local fz = zP + dz * ((zC1 - zC0) / 2 + 5)
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
			}, grupo)
			farolas[#farolas + 1] = { pieza = foco, luz = luzDe(foco, Color3.fromRGB(255, 236, 190), 0, 40) }
		end
	end

	-- TU COCHE, enterrado en la entrada. Aparece a mitad de abrir la
	-- calle, que si no son seis minutos seguidos de quitar nieve sin que
	-- pase nada. Y no hace falta explicarlo: es tu coche, y esta ahi.
	local cx, cz = parcela:centro(m.garajeCx, S.czCoche)
	parte({
		Name = "CocheRuedas",
		Size = Vector3.new(8.4, 2.4, 15),
		Position = Vector3.new(cx, 1.4, cz),
		Color = Color3.fromRGB(28, 28, 32),
		Material = Enum.Material.Metal,
		CanCollide = true,
		CanQuery = true,
	}, grupo)
	parte({
		Name = "Coche",
		Size = Vector3.new(8, 3, 14),
		Position = Vector3.new(cx, 3.4, cz),
		Color = Color3.fromRGB(54, 96, 152),
		Material = Enum.Material.Metal,
		CanCollide = true,
		CanQuery = true,
	}, grupo)
	parte({
		Name = "CocheTecho",
		Size = Vector3.new(7.4, 2.6, 8),
		Position = Vector3.new(cx, 6.1, cz - 1),
		Color = Color3.fromRGB(46, 82, 132),
		Material = Enum.Material.Metal,
		CanCollide = true,
		CanQuery = true,
	}, grupo)
	parte({
		Name = "CocheNieve",
		Size = Vector3.new(7.6, 0.6, 8.2),
		Position = Vector3.new(cx, 7.6, cz - 1),
		Color = NIEVE,
		Material = Enum.Material.Snow,
	}, grupo)
	local faros = {}
	for _, dx in ipairs({ -2.6, 2.6 }) do
		local faro = parte({
			Name = "CocheFaro",
			Size = Vector3.new(1.8, 1, 0.5),
			Position = Vector3.new(cx + dx, 3.6, cz + 7),
			Color = Color3.fromRGB(252, 246, 214),
			Material = Enum.Material.SmoothPlastic,
		}, grupo)
		faros[#faros + 1] = { pieza = faro, luz = luzDe(faro, Color3.fromRGB(255, 250, 220), 0, 24) }
	end

	-- EL BUZON. Lo primero que aparece, a los pocos segundos. No sirve
	-- para nada: sirve para que la primera palada tenga premio.
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

	-- La marca de nieve: el palo que asoma y dice "cava aqui". Sin algo
	-- asi, el jugador aparece y no sabe hacia donde dar la primera palada.
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

	return {
		cxE0 = cxE0, cxE1 = cxE1, czE0 = czE0, czE1 = czE1,
		czCal0 = czCal0, czCal1 = czCal1,
		farolas = farolas,
		senal = senal,
		luzSenal = luzDe(senal, Color3.fromRGB(190, 220, 255), 0, 16),
		cartel = cartel,
		luzCartel = luzDe(cartel, Color3.fromRGB(210, 240, 255), 0, 28),
		poste = poste,
		xPlaza = xP,
		zCalle = zP,
		buzonCx = S.cxBuzon, buzonCz = S.czBuzon,
		alturaBuzon = 6.2,
		cocheCx = m.garajeCx, cocheCz = S.czCoche,
		alturaCoche = 7.4,
		faros = faros,
		pitido = sonidoDe(grupo:FindFirstChild("Coche"), "Pitido",
			"rbxasset://sounds/action_get_up.mp3", 0.7, 1.9, false),
	}
end


-------------------------------------------------------------------
--  EL PUEBLO DEL FONDO
--
--  Tejados y chimeneas hasta donde llega la vista, mas alla de la plaza.
--  No se puede llegar todavia: es la promesa del juego entero.
-------------------------------------------------------------------

function Mundo.pueblo(parcela, padre)
	local grupo = Instance.new("Folder")
	grupo.Name = "PuebloDelFondo"
	grupo.Parent = padre

	local x0 = parcela.origen.X + parcela.ancho * CELDA + 90
	local z0 = parcela.origen.Z + A.sitio.czCarretera * CELDA

	for i = 0, 13 do
		local fila = i % 2
		local x = x0 + (i // 2) * 78 + fila * 26
		local z = z0 + (fila == 0 and -78 or 92) + ((i * 37) % 40)
		local alto = 12 + ((i * 13) % 7)
		parte({
			Name = "Casa",
			Size = Vector3.new(30, alto, 22),
			Position = Vector3.new(x, alto / 2, z),
			Color = Color3.fromRGB(198 - (i % 4) * 18, 196 - (i % 3) * 16, 190),
			Material = Enum.Material.Concrete,
		}, grupo)
		for paso = 0, 3 do
			parte({
				Name = "Tejado",
				Size = Vector3.new(34 - paso * 6, 1.1, 26 - paso * 4),
				Position = Vector3.new(x, alto + 0.6 + paso * 1.1, z),
				Color = Color3.fromRGB(70, 66, 74),
				Material = Enum.Material.Slate,
			}, grupo)
			parte({
				Name = "TejadoNieve",
				Size = Vector3.new(34.4 - paso * 6, 0.5, 26.4 - paso * 4),
				Position = Vector3.new(x, alto + 1.3 + paso * 1.1, z),
				Color = NIEVE,
				Material = Enum.Material.Snow,
			}, grupo)
		end
		local chx = x + 9
		local boca = parte({
			Name = "Chimenea",
			Size = Vector3.new(4, alto + 14, 4),
			Position = Vector3.new(chx, (alto + 14) / 2, z - 5),
			Color = LADRILLO,
			Material = Enum.Material.Brick,
		}, grupo)
		-- Humo lento en la mitad de las casas: el pueblo esta vivo, solo
		-- que enterrado.
		if i % 2 == 0 then
			humoEn(boca, 4).Enabled = true
		end
	end
	return grupo
end


-------------------------------------------------------------------
--  EL PERFIL DE LA NEVADA
--
--  Un manto alto que baja a cero en el borde de la parcela: ese borde es
--  la rampa por la que se entra y se sale.
--
--  OJO, que es la leccion mas cara del diseno: con la regla de la
--  pendiente solo se puede cavar en lo mas alto. Si el jugador naciera en
--  el fondo de un hoyo, TODO a su alrededor estaria bloqueado y no podria
--  cavar nada. Naciendo arriba, en el llano, todo vale.
-------------------------------------------------------------------

function Mundo.perfil(parcela, m, v)
	local S = A.sitio

	local function dentro(cx, cz, cx0, cz0, cx1, cz1)
		return cx >= cx0 and cx <= cx1 and cz >= cz0 and cz <= cz1
	end

	local czCal0 = S.czCarretera - math.floor(S.anchoCarretera / 2)
	local czCal1 = S.czCarretera + math.floor(S.anchoCarretera / 2)

	return function(cx, cz)
		-- Debajo de un edificio no hay nieve, y ahi no se cava.
		if dentro(cx, cz, m.cx0, m.cz0, m.cx1, m.cz1) then
			return 0, true, false
		end
		if dentro(cx, cz, m.gcx0, m.cz0, m.gcx1, m.cz1) then
			return 0, true, false
		end
		if dentro(cx, cz, v.cx0, v.cz0, v.cx1, v.cz1) then
			return 0, true, false
		end

		-- Donde puede trabajar el quitanieves: la calzada, la plaza y tu
		-- entrada de coches. Todo lo demas es jardin, y ahi la maquina no
		-- pinta nada.
		-- La calzada Y su arcen: es todo lo que el quitanieves puede
		-- morder, y tiene que ser mas ancho que el asfalto para que la
		-- cuchilla pueda abrir la pendiente hasta el suelo.
		local enCalzada = cz >= czCal0 - S.anchoArcen and cz <= czCal1 + S.anchoArcen
		local enPlaza = math.abs(cx - S.cxPlaza) <= S.radioPlaza
			and math.abs(cz - S.czCarretera) <= S.radioPlaza
		local enEntrada = math.abs(cx - m.garajeCx) <= math.floor(S.anchoEntrada / 2)
			and cz > m.cz1 and cz < czCal0
		local calle = enCalzada or enPlaza or enEntrada

		local capas = A.nieve.capasMaximas

		-- Por la calzada paso el quitanieves municipal hace dias: hay
		-- menos nieve que en los jardines, y por eso la maquina puede.
		if enCalzada or enPlaza then
			capas = S.capasCalzada
		end

		-- Contra las fachadas se amontona.
		if dentro(cx, cz, m.gcx0 - 2, m.cz0 - 2, m.cx1 + 2, m.cz1 + 3) then
			capas = A.nieve.capasContraLaCasa
		end
		if dentro(cx, cz, v.cx0 - 2, v.cz0 - 4, v.cx1 + 2, v.cz1 + 2) then
			capas = A.nieve.capasContraLaCasa
		end
		-- El muro que dejo la quitanieves delante de tu garaje.
		if dentro(cx, cz, m.gcx0 - 1, m.cz1 + 1, m.gcx1 + 1, m.cz1 + 3) then
			capas = math.max(capas, A.nieve.capasContraElGaraje)
		end
		if dentro(cx, cz, v.cx0 - 2, v.cz0 - 7, v.cx1 + 2, v.cz0 - 1) then
			capas = math.max(capas, A.nieve.capasContraElVecino)
		end

		-- EL VENTISQUERO DE TU ENTRADA. La maquina paso de largo y dejo
		-- un muro justo delante de tu casa: tres metros de nieve prensada.
		-- Es el capitulo de la carretera, y es tambien la razon de que el
		-- quitanieves no pueda romperlo (solo traga seis capas).
		local aLaCalle = math.abs(cz - S.czCarretera)
		local aLaEntrada = math.abs(cx - m.garajeCx)
		if aLaCalle <= 7 and aLaEntrada <= S.anchoBerma then
			local caida = math.max(aLaCalle, math.max(0, aLaEntrada - 2))
			capas = math.max(capas, S.capasCarretera - caida)
		end

		-- La rampa del borde, que es por donde se entra y se sale.
		local alBorde = math.min(cx, cz, parcela.ancho - 1 - cx, parcela.largo - 1 - cz)
		capas = math.max(0, math.min(capas, (alBorde - 1) * A.nieve.desnivelMaximo))

		-- El repecho de entrada: por donde apareces la nieve esta fina,
		-- barrida por el viento. No es adorno: la pala ataca siempre lo
		-- mas alto que tiene al lado, asi que sin este llano el monton del
		-- buzon no seria lo primero que se desentierra.
		if cx <= S.cxBuzon + S.anchoRepecho and math.abs(cz - S.czBuzon) <= 5 then
			capas = math.min(capas, 4)
		end

		return capas, false, calle
	end
end

-- El monticulo del buzon se pone DESPUES de alisar, a proposito. La regla
-- de la pendiente esta para que nadie se quede encerrado en un pozo; un
-- monton no encierra a nadie y se cava de arriba abajo sin bloquearse.
function Mundo.monticuloDelBuzon(parcela)
	local S = A.sitio
	-- El monton sube en escalones de desnivelMaximo, no de golpe. Si
	-- subiera de golpe quedaria un pilar de nieve de tres metros pegado al
	-- borde pelado: feo, y ademas romperia la unica regla que sostiene
	-- todo el juego. Asi es un monton de verdad, con su cuesta.
	local paso = A.nieve.desnivelMaximo
	local radio = math.floor((S.capasBuzon - 1) / paso)
	for cx = S.cxBuzon - radio, S.cxBuzon + radio do
		for cz = S.czBuzon - radio, S.czBuzon + radio do
			local casilla = parcela:casilla(cx, cz)
			if casilla and not casilla.muro then
				local lejos = math.max(math.abs(cx - S.cxBuzon), math.abs(cz - S.czBuzon))
				local quiero = S.capasBuzon - lejos * paso
				if quiero > casilla.restante then
					parcela.capasTotales = parcela.capasTotales + (quiero - casilla.restante)
					casilla.restante = quiero
					casilla.inicial = quiero
				end
			end
		end
	end
end

return Mundo
