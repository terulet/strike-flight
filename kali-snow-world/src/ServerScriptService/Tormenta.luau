--[[
	LA GRAN TORMENTA  —  el evento

	La pregunta de esta fase es si apetece seguir limpiando el pueblo
	despues de haber terminado la historia. La respuesta que intenta dar
	esto: que vuelva a hacer falta el jugador SIN quitarle nada.

	Por eso la tormenta:

	  - cae en otra capa (nieve de tormenta), encima de la historica
	  - no cae encima de lo que ya se ha descubierto
	  - no cierra puertas, no quita herramientas, no reinicia el guion
	  - no se guarda: es del servidor, y se derrite al terminar

	Y por eso la mision NO se puede resolver con una sola herramienta:

	    calzada  nieve honda sobre asfalto        -> quitanieves
	    acera    caminos estrechos, fuera de ella -> sopladora
	    puerta   escalones y nieve prensada       -> pala

	Cada tormenta coge unos cuantos bloqueos de la lista, no todos, asi
	que el recorrido cambia. Y si cae el arbol, hay que rodear por el
	arcen, que es otra calle mas que abrir.

	Este archivo va en:  ServerScriptService  (ModuleScript, "Tormenta")
]]

local RS = game:GetService("ReplicatedStorage")
local A = require(RS:WaitForChild("Ajustes"))

local CELDA = A.nieve.celda

local Tormenta = {}

-- Se puede fijar para que las pruebas sepan que va a salir.
Tormenta.semilla = nil


-------------------------------------------------------------------
--  DONDE ESTA CADA BLOQUEO
--
--  Todas las zonas salen de la geometria de la parcela, para que mover
--  una casa no deje un bloqueo colgado en mitad de un jardin.
--
--  Y ninguna cae encima de lo que ya esta descubierto: eso lo garantiza
--  la parcela (las casillas protegidas), pero ademas las zonas estan
--  elegidas fuera a proposito.
-------------------------------------------------------------------

function Tormenta.zonas(parcela, ancho)
	local S = A.sitio
	local m = parcela.casa
	local v = parcela.vecino
	ancho = ancho or 0

	-- Las zonas son GRANDES a proposito: un bloqueo tiene que dar trabajo
	-- de verdad, no ser un cuadradito de tres casillas. Y con mas gente se
	-- ensanchan un poco mas, que es la unica forma honrada de que jugar
	-- acompanado dure menos sin caer mas nieve por cabeza.
	-- LO ANCHO DE UN BLOQUEO DE CALZADA NO SE TOCA. Es exactamente la
	-- calzada, ni una fila mas: fuera de ella el quitanieves no pisa (ni
	-- debe), asi que un bloqueo que se salga un solo carril no hay forma
	-- humana de despejarlo y la tormenta no termina nunca. El ancho extra
	-- por jugador se da a lo LARGO de la calle, mas abajo.
	local mitad = math.floor(S.anchoCarretera / 2)
	local czA, czB = S.czCarretera - mitad, S.czCarretera + mitad

	-- Ninguna zona toca el borde de la parcela. Es una leccion cara: el
	-- quitanieves comprueba cuatro puntos alrededor antes de moverse, y en
	-- la ultima casilla alguno cae ya fuera. Un bloqueo que llegue al
	-- borde es un bloqueo que no se puede despejar nunca.
	local MARGEN = 2
	local function dentroDeLaParcela(z)
		return {
			math.max(MARGEN, z[1]),
			math.max(MARGEN, z[2]),
			math.min(parcela.ancho - 1 - MARGEN, z[3]),
			math.min(parcela.largo - 1 - MARGEN, z[4]),
		}
	end

	local sitios = {
		-- La entrada al pueblo, por donde viene el camion.
		-- OJO: las zonas de calzada tienen que quedar FUERA del muro que la
		-- maquina municipal dejo delante de tu entrada. Ese muro es nieve
		-- historica de tres metros; el quitanieves no puede con el (ni
		-- debe), asi que un bloqueo que lo pise no se despeja nunca.
		acceso = { 2, czA, m.garajeCx - 7, czB },
		-- El tramo largo de en medio. Y OJO: las zonas de calzada NO se
		-- ensanchan con la gente que haya. Quitanieves hay uno, asi que
		-- toda la calzada la hace la misma persona una detras de otra:
		-- alargarla por venir acompanado es exactamente convertir la
		-- ayuda en un castigo. Lo que se ensancha es lo que se puede
		-- repartir, que son las aceras y las puertas.
		ruta = { m.garajeCx + 7, czA, 64, czB },
		-- El cruce, ya en la plaza.
		cruce = { S.cxPlaza - 11, czA, S.cxPlaza + 11, czB },
		-- La parada del autobus: acera, fuera de la calzada.
		-- La acera del sur, pasada tu casa. NO se estira mas hacia
		-- poniente, y no es un capricho: por ahi estan la rampa del
		-- garaje (que es calle, y por la calle no se manda a nadie con
		-- la sopladora), tu coche y tu propia puerta. Todo eso ya lo
		-- desenterraste, y encima de lo desenterrado no vuelve a nevar.
		parada = {
			math.max(S.cxParada - 39 - ancho * 2, m.cxCentro + 26), S.czAceraSur,
			S.cxParada + 39 + ancho * 2, S.czAceraSur + 1,
		},
		-- El camino que sube a casa del vecino, entre la acera y su
		-- puerta. Su puerta NO: esa esta descubierta y es intocable.
		vecino = {
			v.cxCentro - 29 - ancho * 2, S.czAceraNorte + 2,
			v.cxCentro + 29 + ancho * 2, S.czAceraNorte + 4,
		},
		-- Los escalones de tu casa, al lado del porche. No la puerta: esa
		-- esta descubierta y protegida, y ahi no vuelve a caer un copo.
		escalones = {
			m.cxCentro + 3, m.cz1 + 1,
			m.cxCentro + 25 + ancho * 2, m.cz1 + 3,
		},
		-- Y los del ayuntamiento, en la acera de enfrente de la plaza.
		ayuntamiento = {
			S.cxPlaza - 28 - ancho * 2, S.czAceraNorte,
			S.cxPlaza + 28 + ancho * 2, S.czAceraNorte + 1,
		},
	}
	for clave, z in pairs(sitios) do
		sitios[clave] = dentroDeLaParcela(z)
	end
	return sitios
end

-- El desvio se calcula alrededor del arbol, no esta en la lista fija.
function Tormenta.zonaDesvio(parcela, cxArbol, ancho)
	local S = A.sitio
	local MARGEN = 2
	return {
		math.max(MARGEN, cxArbol - 6 - (ancho or 0)),
		S.czArcenNorte,
		math.min(parcela.ancho - 1 - MARGEN, cxArbol + 6 + (ancho or 0)),
		S.czArcenNorte + 2,
	}
end

-- Cuando se da por despejado cada tipo. La sopladora deja siempre una
-- capa, asi que pedir cero es pedir pala: eso es lo que hace que las
-- puertas sigan siendo trabajo de pala aunque tengas las tres maquinas.
-- Cuanta nieve de tormenta puede quedar y que el sitio cuente por
-- despejado. En la calzada se admite una capa: un camion pasa por encima
-- de dos dedos de nieve sin enterarse, y ademas eso permite que quien no
-- lleve el quitanieves pueda echar una mano en la calle con la sopladora
-- en vez de mirar. En las puertas y los escalones, cero: ahi se pisa.
local LIMPIO = { calzada = 1, acera = 1, puerta = 0 }
Tormenta.LIMPIO = LIMPIO


-------------------------------------------------------------------
--  ELEGIR LOS BLOQUEOS
--
--  Siempre sale al menos uno de cada tipo: sin eso, una tormenta podria
--  resolverse entera con el quitanieves, y entonces las otras dos
--  herramientas sobrarian.
-------------------------------------------------------------------

local function barajar(lista, azar)
	for i = #lista, 2, -1 do
		local j = azar(i)
		lista[i], lista[j] = lista[j], lista[i]
	end
	return lista
end

-- LO QUE CUESTA UN BLOQUEO, EN SEGUNDOS. No es un adorno: es lo unico
-- que hace que una tormenta dure lo que tiene que durar. Los bloqueos no
-- valen todos lo mismo ni de lejos: la acera del ayuntamiento son dos
-- minutos de pala, y un tramo de calle el triple de grande se lo lleva el
-- quitanieves en cuarenta segundos. Elegir "cinco bloqueos" a ciegas daba
-- tormentas de siete minutos y tormentas de trece con las mismas reglas.
-- Asi que no se eligen cinco: se eligen los que quepan en el rato que
-- queremos que dure.
function Tormenta.coste(def, zona)
	if not zona then
		return 0
	end
	local celdas = (zona[3] - zona[1] + 1) * (zona[4] - zona[2] + 1)
	local hondo = def.tipo == "calzada" and A.tormenta.capasEnCalzada or A.tormenta.capasMaximas
	local capas = celdas * hondo
	local h = A.herramientas[def.herramienta]
	local porSegundo = h.potencia / h.golpe
	-- Y lo que no es cavar: andar de una casilla a otra, los viajes al
	-- monton con la carretilla llena, dar la vuelta con la maquina. Cavar
	-- es la mitad del trabajo, no todo.
	return capas / porSegundo * (A.tormenta.entorpecimiento[def.tipo] or 2)
end

function Tormenta.elegir(zonas, cuantosJugadores, azar, gastado)
	azar = azar or function(n)
		return math.random(1, n)
	end
	local T = A.tormenta
	local presupuesto = (cuantosJugadores or 1) > 1 and T.trabajoAcompanado or T.trabajoSolo
	local total = gastado or 0

	local porTipo = { calzada = {}, acera = {}, puerta = {} }
	for _, def in ipairs(A.bloqueos) do
		table.insert(porTipo[def.tipo], def)
	end

	local elegidos = {}
	local puestos = {}
	local calzadas = 0
	local function meter(def)
		elegidos[#elegidos + 1] = def
		puestos[def.clave] = true
		total = total + Tormenta.coste(def, zonas[def.clave])
		if def.tipo == "calzada" then
			calzadas = calzadas + 1
		end
	end

	-- Uno de cada tipo, siempre, cueste lo que cueste: sin esto una
	-- tormenta podria resolverse entera con el quitanieves y sobrarian
	-- las otras dos herramientas.
	for _, tipo in ipairs({ "calzada", "acera", "puerta" }) do
		local lista = barajar(table.clone(porTipo[tipo]), azar)
		if lista[1] then
			meter(lista[1])
		end
	end

	-- Y despues, mientras quede rato. Con un tope de bloqueos de CALZADA:
	-- quitanieves hay UNO, asi que todo lo que sea calle lo hace la misma
	-- persona una detras de otra, y una tormenta de cuatro calles y una
	-- acera es una tormenta en la que el segundo jugador mira.
	local resto = {}
	for _, def in ipairs(A.bloqueos) do
		if not puestos[def.clave] then
			resto[#resto + 1] = def
		end
	end
	barajar(resto, azar)
	for _, def in ipairs(resto) do
		local coste = Tormenta.coste(def, zonas[def.clave])
		local cabe = total + coste / 2 <= presupuesto
		if cabe and (def.tipo ~= "calzada" or calzadas < T.maximoDeCalzada) then
			meter(def)
		end
	end
	return elegidos, total
end


-------------------------------------------------------------------
--  MONTAR UNA TORMENTA
-------------------------------------------------------------------

function Tormenta.nueva(parcela, cuantosJugadores, azar)
	local T = A.tormenta
	azar = azar or function(n)
		return math.random(1, n)
	end

	-- Con mas gente NO cae mas nieve: se pide un bloqueo mas y las zonas
	-- son un poco mas anchas. Jugar acompanado no puede salir mas caro
	-- que jugar solo.
	local cuenta = math.min(cuantosJugadores or 1, T.maximoJugadoresQueCuentan)
	local ancho = (cuenta - 1) * T.anchoExtraPorJugador

	local zonas = Tormenta.zonas(parcela, ancho)

	-- EL ARBOL SE DECIDE ANTES QUE NADA, porque el desvio que obliga a
	-- abrir es trabajo como el de cualquier otro bloqueo y tiene que
	-- contar en el rato: si se sumara aparte, una tormenta con arbol
	-- duraria la mitad mas que una sin el y el evento no tendria una
	-- duracion, tendria una loteria.
	local quiereArbol = azar(100) <= T.probabilidadArbol * 100
	local cxArbol, zonaArbol, costeArbol = nil, nil, 0
	if quiereArbol then
		cxArbol = 35 + azar(20) - 1
		zonaArbol = Tormenta.zonaDesvio(parcela, cxArbol, ancho)
		costeArbol = Tormenta.coste(A.desvio, zonaArbol)
	end

	local elegidos, rato = Tormenta.elegir(zonas, cuenta, azar, costeArbol)

	local t = {
		parcela = parcela.id,
		fase = "calma",
		desde = 0,
		ola = 0,
		ancho = ancho,
		jugadores = cuenta,
		bloqueos = {},
		-- Lo que se calcula que va a costar, en segundos. No manda nada
		-- en la partida: sirve para poder comparar lo que se pensaba con
		-- lo que luego tarda de verdad, que es la unica forma de afinar
		-- la duracion sin ir a ciegas.
		rato = rato,
		arbol = nil,
		camion = nil,
		abierta = false,
	}

	for _, def in ipairs(elegidos) do
		local z = zonas[def.clave]
		t.bloqueos[#t.bloqueos + 1] = {
			clave = def.clave,
			tipo = def.tipo,
			herramienta = def.herramienta,
			nombre = def.nombre,
			zona = z,
			limpio = false,
		}
	end

	-- Y ahora si, donde cae el arbol. NUNCA DENTRO DE UN BLOQUEO DE
	-- CALZADA: un tramo que hay que despejar con la maquina y que ademas
	-- tiene un arbol atravesado en medio es un tramo que no se puede
	-- despejar. El quitanieves llega al tronco, se planta, y la mitad de
	-- mas alla se queda con nieve para siempre. Ademas de imposible seria
	-- incomprensible: "despeja esto" y "por aqui no se pasa" a la vez, en
	-- el mismo sitio.
	if quiereArbol then
		local sitios = {}
		for cx = 35, 54 do
			local vale = true
			for _, b in ipairs(t.bloqueos) do
				if b.tipo == "calzada" and cx >= b.zona[1] - 2 and cx <= b.zona[3] + 2 then
					vale = false
					break
				end
			end
			if vale then
				sitios[#sitios + 1] = cx
			end
		end
		if #sitios > 0 then
			-- Se prefiere el hueco mas cerca del que ya se habia pensado,
			-- para que el desvio caiga donde se conto que caeria.
			local elegido = sitios[1]
			for _, cx in ipairs(sitios) do
				if math.abs(cx - cxArbol) < math.abs(elegido - cxArbol) then
					elegido = cx
				end
			end
			local d = A.desvio
			t.arbol = { cx = elegido }
			t.bloqueos[#t.bloqueos + 1] = {
				clave = d.clave,
				tipo = d.tipo,
				herramienta = d.herramienta,
				nombre = d.nombre,
				zona = Tormenta.zonaDesvio(parcela, elegido, ancho),
				limpio = false,
			}
		end
	end

	return t
end


-------------------------------------------------------------------
--  QUE NIEVE, Y DONDE
--
--  La nieve cae por OLAS, y cada ola por lotes de casillas. Nada de
--  cubrir el mapa de golpe: se tiene que ver llegar.
--
--  Cae sobre las zonas de los bloqueos y, mas flojo, por toda la calle,
--  para que se note que esta nevando en todas partes y no solo en las
--  casillas del ejercicio.
-------------------------------------------------------------------

function Tormenta.casillasDeLaOla(parcela, t)
	local S = A.sitio
	local lista = {}
	local vistas = {}

	local function meter(cx, cz, tope, ventisquero)
		local clave = cx * 1000 + cz
		if vistas[clave] then
			return
		end
		local c = parcela:casilla(cx, cz)
		if not c or c.muro or c.protegida then
			return
		end
		vistas[clave] = true
		lista[#lista + 1] = { cx = cx, cz = cz, tope = tope, ventisquero = ventisquero }
	end

	-- Primero lo que hay que despejar: ahi cuaja del todo. Menos en la
	-- calzada, donde el tope es mas bajo para que el quitanieves quepa
	-- por debajo de su propio ventisquero.
	for _, b in ipairs(t.bloqueos) do
		local z = b.zona
		for cx = z[1], z[3] do
			for cz = z[2], z[4] do
				local tope = A.tormenta.capasMaximas
				if parcela:esCalle(cx, cz) then
					tope = A.tormenta.capasEnCalzada
				end
				meter(cx, cz, tope, true)
			end
		end
	end

	-- Y despues, mas flojo, la calle entera y las aceras: es lo que hace
	-- que parezca una tormenta y no un ejercicio con zonas marcadas.
	local flojo = math.max(1, A.tormenta.capasCalle)
	for cx = 0, parcela.ancho - 1 do
		for cz = S.czAceraSur, S.czAceraNorte + 1 do
			local c = parcela:casilla(cx, cz)
			if c and (c.calle or cz <= S.czAceraSur + 1 or cz >= S.czAceraNorte) then
				meter(cx, cz, flojo)
			end
		end
	end

	return lista
end


-------------------------------------------------------------------
--  SI ESTA DESPEJADO O NO
-------------------------------------------------------------------

function Tormenta.revisarBloqueos(parcela, t)
	local cambio = nil
	for _, b in ipairs(t.bloqueos) do
		if not b.limpio then
			local z = b.zona
			local queda = parcela:capasTormentaEncima(z[1], z[2], z[3], z[4])
			if queda <= LIMPIO[b.tipo] then
				b.limpio = true
				cambio = b
			end
		end
	end
	return cambio
end

function Tormenta.quedan(t)
	local n = 0
	for _, b in ipairs(t.bloqueos) do
		if not b.limpio then
			n = n + 1
		end
	end
	return n
end


-------------------------------------------------------------------
--  LA RUTA DEL CAMION
--
--  Recta por el centro de la calzada. Si hay arbol, se aparta al arcen
--  del norte para pasarlo y vuelve. Es la unica forma de que se vea que
--  el desvio servia para algo.
-------------------------------------------------------------------

function Tormenta.ruta(parcela, t)
	local S = A.sitio
	local zCalle = parcela.origen.Z + (S.czCarretera + 0.5) * CELDA
	local zArcen = parcela.origen.Z + (S.czArcenNorte + 1.5) * CELDA
	local xFin = parcela.origen.X + (S.cxPlaza + 0.5) * CELDA

	local puntos = { Vector3.new(parcela.origen.X - 110, 0, zCalle) }
	if t.arbol then
		local xA = parcela.origen.X + (t.arbol.cx + 0.5) * CELDA
		puntos[#puntos + 1] = Vector3.new(xA - 46, 0, zCalle)
		puntos[#puntos + 1] = Vector3.new(xA - 26, 0, zArcen)
		puntos[#puntos + 1] = Vector3.new(xA + 26, 0, zArcen)
		puntos[#puntos + 1] = Vector3.new(xA + 46, 0, zCalle)
	end
	puntos[#puntos + 1] = Vector3.new(xFin, 0, zCalle)
	return puntos
end

return Tormenta
