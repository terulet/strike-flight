--[[
	EL BARRIO DESPIERTA  —  la parcela

	El modelo de la nieve, y nada mas. Vive aparte a proposito: ahora hay
	cinco parcelas a la vez, una por jugador, y quien excava siempre dice
	SOBRE QUE parcela lo hace. Aqui no se sabe quien juega ni quien manda.

	Tres cosas viven aqui y solo aqui:

	  puedeExcavar()  la regla que hace imposible quedarse encerrado: al
	                  bajar una casilla no se puede abrir un escalon de mas
	                  de desnivelMaximo con ninguna de sus OCHO vecinas.
	                  Para bajar hay que ensanchar.

	  excavar()       comprobar y bajar van SEGUIDOS, sin ceder el hilo.
	                  Es lo que hace que dos jugadores cavando juntos no
	                  puedan bajar la misma casilla dos veces ni romper la
	                  pendiente entre los dos.

	  comprimir()     la nieve entera en una cadena corta, por tramos. Son
	                  4.560 casillas: guardarlas una a una serian miles de
	                  claves, y en una tabla suelta ocuparia una barbaridad
	                  para lo que es.

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

Parcela.registro = {}

function Parcela.nueva(id, origen)
	local p = setmetatable({
		id = id,
		origen = origen,          -- esquina (x0, 0, z0) en el mundo
		ancho = A.parcela.ancho,
		largo = A.parcela.largo,
		casillas = {},            -- [cx][cz] = { inicial, restante, muro, calle }
		-- De quien es. Nadie mas puede cambiar su guion, pero cualquiera
		-- puede entrar a quitarle nieve: ayudar no es fastidiar.
		dueno = nil,
		duenoNombre = nil,
		capasTotales = 0,
		capasQuitadas = 0,
		hallazgos = {},
		capitulo = 1,
		carpeta = nil,
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


-------------------------------------------------------------------
--  LA REGLA
-------------------------------------------------------------------

-- Se puede cavar una casilla mientras al bajarla no se abra un escalon de
-- mas de desnivelMaximo con ninguna de sus ocho vecinas.
--
-- La cuenta: si baja de r a r-1, hace falta que toda vecina cumpla
-- r(vecina) <= r - 1 + desnivelMaximo.
--
-- El "minimo" es el suelo que la herramienta NO baja. La pala y el
-- quitanieves lo dejan en cero; la sopladora deja un colchon porque no
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
-- la misma casilla dos veces: nieve duplicada y pendiente rota.
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


-------------------------------------------------------------------
--  MIRAR LA PARCELA
-------------------------------------------------------------------

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

-- Lo mas hondo que queda en un trozo. Sirve para saber si algo ya esta a
-- la vista.
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

-- Solo calle: donde puede trabajar el quitanieves.
function Parcela:esCalle(cx, cz)
	local c = self:casilla(cx, cz)
	return c ~= nil and c.calle == true
end

-- Por donde puede pasar el quitanieves sin atascarse: nada de casas, y
-- nada de ventisqueros mas hondos de lo que traga la cuchilla.
function Parcela:pisable(cx, cz, capasMaximas)
	local c = self:casilla(cx, cz)
	if not c or c.muro then
		return false
	end
	return c.restante <= capasMaximas
end


-------------------------------------------------------------------
--  GENERAR
-------------------------------------------------------------------

-- Reparte la nieve y despues la alisa, para que no nazca ya con
-- desniveles imposibles. El alisado es lo que convierte el borde de la
-- parcela en una rampa por la que se entra y se sale.
function Parcela:generar(perfil)
	for cx = 0, self.ancho - 1 do
		self.casillas[cx] = {}
		for cz = 0, self.largo - 1 do
			local capas, muro, calle = perfil(cx, cz)
			self.casillas[cx][cz] = {
				inicial = capas,
				restante = capas,
				muro = muro == true,
				calle = calle == true,
				-- Cuanto de la capa de arriba esta puesta: rompe el efecto
				-- baldosa sin desajustar el modelo, que sigue en enteros.
				rugosidad = 0.6 + ((cx * 7 + cz * 13) % 9) / 20,
			}
		end
	end

	-- Cuantas pasadas de alisado hacen falta: como mucho, tantas como
	-- capas tenga el sitio mas hondo. Con un numero fijo, un ventisquero
	-- mas alto de lo previsto se quedaba a medio alisar.
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
	self.capasQuitadas = 0
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

-- Borra del terreno todo lo que hay sobre la parcela. Se usa al soltar
-- una parcela para el siguiente jugador.
function Parcela:desnevar()
	local anchoS = self.ancho * CELDA
	local largoS = self.largo * CELDA
	Terreno:FillBlock(
		CFrame.new(
			self.origen.X + anchoS / 2,
			A.nieve.capa * 30,
			self.origen.Z + largoS / 2
		),
		Vector3.new(anchoS + CELDA * 2, A.nieve.capa * 62, largoS + CELDA * 2),
		Enum.Material.Air
	)
end


-------------------------------------------------------------------
--  GUARDAR LA NIEVE EN POCO SITIO
--
--  Cuatro mil quinientas casillas. Una por clave serian miles de claves;
--  una tabla suelta, una lista larguisima de numeros casi todos iguales.
--  Se guarda por TRAMOS: "diez capas, cuarenta veces". La nieve recien
--  caida son cuatro o cinco tramos; una parcela muy cavada, unos cientos.
--
--  No se guardan ni los muros ni las calles: eso sale de la forma del
--  mundo, que es siempre la misma, y por eso hay una version de esquema.
-------------------------------------------------------------------

function Parcela:comprimir()
	local trozos = {}
	local valor, veces = nil, 0
	for cx = 0, self.ancho - 1 do
		for cz = 0, self.largo - 1 do
			local c = self.casillas[cx][cz]
			local r = c and c.restante or 0
			if r == valor then
				veces = veces + 1
			else
				if valor ~= nil then
					trozos[#trozos + 1] = valor .. "*" .. veces
				end
				valor, veces = r, 1
			end
		end
	end
	if valor ~= nil then
		trozos[#trozos + 1] = valor .. "*" .. veces
	end
	return ("%dx%d:%s"):format(self.ancho, self.largo, table.concat(trozos, "."))
end

-- Devuelve true si lo guardado encaja con esta parcela. Si no encaja
-- (otra version del mundo, cadena rota), se dice que no y quien llama
-- deja la nevada recien hecha: mejor volver a empezar la nieve que
-- cargar una parcela imposible.
function Parcela:descomprimir(texto)
	if type(texto) ~= "string" then
		return false
	end
	local ancho, largo, cuerpo = string.match(texto, "^(%d+)x(%d+):(.*)$")
	ancho, largo = tonumber(ancho), tonumber(largo)
	if ancho ~= self.ancho or largo ~= self.largo then
		return false
	end

	-- Primero se lee entera y se comprueba que cuadra. Solo si cuadra se
	-- toca la parcela: a medio aplicar quedaria peor que sin aplicar.
	local valores = {}
	for trozo in string.gmatch(cuerpo, "[^%.]+") do
		local v, n = string.match(trozo, "^(%d+)%*(%d+)$")
		v, n = tonumber(v), tonumber(n)
		if not v or not n or n < 1 then
			return false
		end
		for _ = 1, n do
			valores[#valores + 1] = v
		end
		if #valores > ancho * largo then
			return false
		end
	end
	if #valores ~= ancho * largo then
		return false
	end

	local i = 0
	local quitadas = 0
	for cx = 0, self.ancho - 1 do
		for cz = 0, self.largo - 1 do
			i = i + 1
			local c = self.casillas[cx][cz]
			local r = valores[i]
			-- Debajo de una casa nunca hubo nieve, pase lo que pase.
			if c.muro then
				r = 0
			end
			if r > c.inicial then
				r = c.inicial
			end
			quitadas = quitadas + (c.inicial - r)
			c.restante = r
		end
	end
	self.capasQuitadas = quitadas
	return true
end

return Parcela
