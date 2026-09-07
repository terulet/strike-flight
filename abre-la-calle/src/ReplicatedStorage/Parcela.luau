--[[
	ABRE LA CALLE  —  la parcela

	El modelo de la nieve, y nada mas. Vive aparte a proposito: hoy hay una
	parcela, manana una por jugador, y quien excava siempre dice SOBRE QUE
	parcela lo hace. Aqui no se sabe ni quien juega.

	La regla que sostiene todo el juego esta en puedeExcavar(): una casilla
	solo se puede cavar si ninguna de sus OCHO vecinas esta mas alta. Para
	bajar hay que ensanchar, asi que la pendiente se forma sola y no existe
	el pozo vertical del que no se sale.

	Este archivo va en:  ReplicatedStorage  (ModuleScript, "Parcela")
]]

local RS = game:GetService("ReplicatedStorage")
local A = require(RS:WaitForChild("Ajustes"))

local Terreno = workspace.Terrain
local CELDA = A.nieve.celda
local CAPA = A.nieve.capa

-- La altura real de una casilla. La ultima capa no llega entera: cada
-- casilla se queda a una altura un poco distinta, y asi la superficie no
-- son terrazas planas y cuadradas sino nieve con relieve.
local function alturaDe(c)
	if c.restante <= 0 then
		return 0
	end
	return (c.restante - 1) * CAPA + CAPA * c.rugosidad
end

local Parcela = {}
Parcela.__index = Parcela

-- LAS OCHO, con diagonales. Con solo cuatro se puede bajar en diagonal y
-- abrir un pozo por la esquina, que es justo lo que la regla evita.
local VECINAS = {
	{ 1, 0 }, { -1, 0 }, { 0, 1 }, { 0, -1 },
	{ 1, 1 }, { 1, -1 }, { -1, 1 }, { -1, -1 },
}

-- Registro de parcelas por id. Hoy con una parece de sobra; el dia que
-- haya una por jugador es como se encuentra la del que esta cavando.
Parcela.registro = {}

function Parcela.nueva(id, origen)
	local p = setmetatable({
		id = id,
		origen = origen,          -- esquina (x0, 0, z0) en el mundo
		ancho = A.parcela.ancho,
		largo = A.parcela.largo,
		casillas = {},            -- [cx][cz] = { inicial, restante, muro }
		dueno = nil,              -- de quien es esta parcela (aun de nadie)
		capasTotales = 0,
		capasQuitadas = 0,
		hallazgos = {},
		carpeta = nil,
		-- Los montones donde se vacia la carretilla. Los pone quien
		-- construye el mundo: la parcela solo sabe que hay una lista.
		descargas = {},
	}, Parcela)
	Parcela.registro[id] = p
	return p
end

function Parcela:casilla(cx, cz)
	local columna = self.casillas[cx]
	return columna and columna[cz] or nil
end

-- Del mundo a la rejilla y al reves.
function Parcela:aCasilla(x, z)
	return math.floor((x - self.origen.X) / CELDA), math.floor((z - self.origen.Z) / CELDA)
end

function Parcela:centro(cx, cz)
	return self.origen.X + (cx + 0.5) * CELDA, self.origen.Z + (cz + 0.5) * CELDA
end

function Parcela:contiene(x, z)
	return x >= self.origen.X
		and x <= self.origen.X + self.ancho * CELDA
		and z >= self.origen.Z
		and z <= self.origen.Z + self.largo * CELDA
end

-- Se puede cavar una casilla mientras al bajarla no se abra un escalon de
-- mas de desnivelMaximo con ninguna de sus ocho vecinas.
--
-- La cuenta: si baja de r a r-1, hace falta que toda vecina cumpla
-- r(vecina) <= r - 1 + desnivelMaximo. Con desnivel 1 eso es "ninguna
-- vecina mas alta"; con 2 ya se permite empezar el hoyo sin haber
-- alisado medio campo antes, que era lo que hacia el juego pesadisimo.
--
-- El "minimo" es el suelo que la herramienta NO baja. La pala lo deja en
-- cero y llega hasta la tierra; la sopladora deja un colchon porque no
-- raspa el suelo, y por eso no descubre nada: eso es cosa de la pala.
function Parcela:puedeExcavar(cx, cz, minimo)
	minimo = minimo or 0
	local c = self:casilla(cx, cz)
	if not c or c.muro or c.restante <= minimo then
		return false
	end
	local tope = c.restante - 1 + A.nieve.desnivelMaximo
	for _, d in ipairs(VECINAS) do
		local v = self:casilla(cx + d[1], cz + d[2])
		if v and not v.muro and v.restante > tope then
			return false
		end
	end
	return true
end

-- Quita una capa y abre el terreno. Devuelve true si se ha quitado algo.
--
-- OJO AL TOCAR ESTO: comprobar y bajar el nivel van seguidos, sin un solo
-- task.wait en medio. Si se cediera el hilo entre las dos cosas, dos
-- jugadores cavando juntos podrian pasar los dos la comprobacion y bajar
-- la misma casilla dos veces, rompiendo la pendiente.
function Parcela:excavar(cx, cz, minimo)
	if not self:puedeExcavar(cx, cz, minimo) then
		return false
	end
	local c = self:casilla(cx, cz)
	local x, z = self:centro(cx, cz)

	local antes = alturaDe(c)
	c.restante = c.restante - 1
	local despues = alturaDe(c)

	-- Se quita justo la rebanada que sobra, ni mas ni menos: asi lo que se
	-- ve y lo que dice el modelo no se separan nunca.
	local grosor = antes - despues + 0.4
	Terreno:FillBlock(
		CFrame.new(x, (antes + despues) / 2 + 0.2, z),
		Vector3.new(CELDA + 0.3, grosor, CELDA + 0.3),
		Enum.Material.Air
	)

	-- Al llegar al suelo, una cucharada redonda: es la marca de la palada.
	if c.restante <= 0 then
		Terreno:FillBall(Vector3.new(x, 0.6, z), CELDA * 0.72, Enum.Material.Air)
	end
	self.capasQuitadas = self.capasQuitadas + 1
	return true
end

function Parcela:alturaEn(cx, cz)
	local c = self:casilla(cx, cz)
	return c and alturaDe(c) or 0
end

function Parcela:limpio()
	if self.capasTotales <= 0 then
		return 0
	end
	return self.capasQuitadas / self.capasTotales
end

-- Lo mas hondo que queda en un trozo de la parcela. Sirve para saber si
-- algo ya esta a la vista.
function Parcela:capasEncima(cx0, cz0, cx1, cz1)
	local peor = 0
	for cx = cx0, cx1 do
		for cz = cz0, cz1 do
			local c = self:casilla(cx, cz)
			if c and not c.muro and c.restante > peor then
				peor = c.restante
			end
		end
	end
	return peor
end

-- Lo mas alto que queda en un trozo, en STUDS. Los hallazgos se miden
-- asi: contra la altura de verdad de la cosa que hay debajo.
function Parcela:alturaMaximaEn(cx0, cz0, cx1, cz1)
	local peor = 0
	for cx = cx0, cx1 do
		for cz = cz0, cz1 do
			local h = self:alturaEn(cx, cz)
			if h > peor then
				peor = h
			end
		end
	end
	return peor
end

-- Cuantas casillas de un trozo estan ya en el suelo pelado.
function Parcela:peladasEn(cx0, cz0, cx1, cz1)
	local hechas, total = 0, 0
	for cx = cx0, cx1 do
		for cz = cz0, cz1 do
			local c = self:casilla(cx, cz)
			if c and not c.muro then
				total = total + 1
				if c.restante <= 0 then
					hechas = hechas + 1
				end
			end
		end
	end
	return hechas, total
end

-- Reparte la nieve y despues la alisa, para que no nazca ya con
-- desniveles imposibles. El alisado es lo que convierte el hueco de
-- salida en una rampa hasta el fondo.
function Parcela:generar(perfil)
	for cx = 0, self.ancho - 1 do
		self.casillas[cx] = {}
		for cz = 0, self.largo - 1 do
			local capas, muro = perfil(cx, cz)
			self.casillas[cx][cz] = {
				inicial = capas,
				restante = capas,
				muro = muro == true,
				-- Cuanto de la capa de arriba esta puesta: rompe el efecto
				-- baldosa sin desajustar el modelo, que sigue en enteros.
				rugosidad = 0.6 + ((cx * 7 + cz * 13) % 9) / 20,
			}
		end
	end

	-- Cuantas pasadas hacen falta: como mucho, tantas como capas tenga el
	-- sitio mas hondo. Con un numero fijo, un ventisquero mas alto de lo
	-- previsto (la calle) se quedaba a medio alisar.
	local maximo = A.nieve.desnivelMaximo
	local masHondo = 0
	for cx = 0, self.ancho - 1 do
		for cz = 0, self.largo - 1 do
			local c = self.casillas[cx][cz]
			if not c.muro and c.restante > masHondo then
				masHondo = c.restante
			end
		end
	end
	for _ = 1, masHondo + 4 do
		local cambios = 0
		for cx = 0, self.ancho - 1 do
			for cz = 0, self.largo - 1 do
				local c = self.casillas[cx][cz]
				if not c.muro then
					local masBaja = c.restante
					for _, d in ipairs(VECINAS) do
						local v = self:casilla(cx + d[1], cz + d[2])
						if v and not v.muro and v.restante < masBaja then
							masBaja = v.restante
						end
					end
					if c.restante > masBaja + maximo then
						c.restante = masBaja + maximo
						cambios = cambios + 1
					end
				end
			end
		end
		if cambios == 0 then
			break
		end
	end

	self.capasTotales = 0
	for cx = 0, self.ancho - 1 do
		for cz = 0, self.largo - 1 do
			local c = self.casillas[cx][cz]
			c.inicial = c.restante
			self.capasTotales = self.capasTotales + c.restante
		end
	end
end

-- Vuelca la nieve de la parcela al terreno.
function Parcela:nevar()
	local puestas = 0
	for cx = 0, self.ancho - 1 do
		for cz = 0, self.largo - 1 do
			local c = self.casillas[cx][cz]
			if c.restante > 0 then
				local x, z = self:centro(cx, cz)
				local alto = alturaDe(c)
				Terreno:FillBlock(
					CFrame.new(x, alto / 2, z),
					Vector3.new(CELDA, alto, CELDA),
					Enum.Material.Snow
				)
			end
			puestas = puestas + 1
			if puestas % 250 == 0 then
				task.wait()
			end
		end
	end
end



return Parcela
