--[[
	Un jugador de mentira juega LA GRAN TORMENTA de principio a fin y
	se apunta lo que cuesta cada cosa.

	Y desde esta fase tambien la TORMENTA, que tiene su propio reloj:

	    un jugador     10-12 minutos
	    dos jugadores   7-9 minutos

	Se mide con:  probar.mjs medir      (uno)
	              probar.mjs medir 2    (dos)

	El ritmo que se busca:

	    lo primero            antes de 0:30
	    la puerta de casa     minuto 4
	    la sopladora          minuto 6
	    la carretera          minuto 10-12
	    el vecino rescatado   minuto 16
	    el quitanieves        minuto 17
	    la plaza              minuto 20-22

	Y una regla de diseno que tambien se mide: cada cuatro o cinco minutos
	tiene que pasar algo VISIBLE, no solo subir un numero.
]]

local A = AJUSTES
local RS = game:GetService("ReplicatedStorage")
local remotos = RS:FindFirstChild("RemotosKali")
local RemotoEstado = remotos:FindFirstChild("Estado")
local RemotoAviso = remotos:FindFirstChild("Aviso")
local RemotoCavar = remotos:FindFirstChild("Cavar")
local RemotoHerramienta = remotos:FindFirstChild("Herramienta")

local function estadoDe(jugador)
	for i = #RemotoEstado._alCliente, 1, -1 do
		if RemotoEstado._alCliente[i].jugador == jugador then
			return RemotoEstado._alCliente[i].datos
		end
	end
	return {}
end

local jugador = nuevoJugador("Excavador")
entra(jugador)
avanzar(1.5)

local parcela = PARCELA.registro[estadoDe(jugador).mia or 1]
local m = parcela.casa
local v = parcela.vecino
local c = parcela.calle
local S = A.sitio

-- Hay que mantener pulsado, asi que se mantiene.
RemotoCavar.OnServerEvent:Fire(jugador, true)

local viajes = 0
local carril = 0
local esperandoMaquina = 0

local function minutos(segundos)
	return ("%d:%02d"):format(math.floor(segundos / 60), math.floor(segundos % 60))
end

local REGIONES = {
	puerta = { m.cxCentro - 1, m.cz1 + 1, m.cxCentro + 1, m.cz1 + 3 },
	garaje = { m.garajeCx - 2, m.cz1 + 1, m.garajeCx + 2, m.cz1 + 3 },
	carretera = { m.garajeCx - 5, m.cz1 + 1, m.garajeCx + 5, S.czCarretera + 1 },
	vecino = { v.cxCentro - 4, v.cz0 - 7, v.cxCentro + 4, v.cz0 - 1 },
}

print("")
print("── LO QUE HAY QUE MOVER")
print("")
for _, fila in ipairs({
	{ "el buzon", { c.buzonCx, c.buzonCz - 1, c.buzonCx, c.buzonCz + 1 } },
	{ "la puerta", REGIONES.puerta },
	{ "el garaje", REGIONES.garaje },
	{ "la entrada y la calle", REGIONES.carretera },
	{ "la puerta del vecino", REGIONES.vecino },
	{ "la calle hasta la plaza", { m.garajeCx + 16, S.czCarretera - 2, S.cxPlaza, S.czCarretera + 2 } },
}) do
	local r = fila[2]
	print(("  %-26s %2d capas encima"):format(fila[1], parcela:capasEncima(r[1], r[2], r[3], r[4])))
end

local hitos = {}
local vistos = {}
local function apuntar(clave, texto)
	if vistos[clave] then
		return
	end
	vistos[clave] = true
	hitos[clave] = reloj
	print(("  %8s   %-28s %d capas movidas, %d viajes"):format(
		minutos(reloj), texto, math.floor(estadoDe(jugador).nieveTotal or 0), viajes))
end

local function revisarAvisos()
	for _, envio in ipairs(RemotoAviso._alCliente) do
		local datos = envio.datos
		if datos and datos.tipo == "hallazgo" then
			apuntar(datos.clave, A.nombre(datos.nombre, "es"))
		elseif datos and datos.tipo == "cogida" then
			apuntar("sopladora", "COGE LA SOPLADORA")
		elseif datos and datos.tipo == "quitanieves" then
			apuntar("quitanieves", "SE SUBE AL QUITANIEVES")
		end
	end
end

-- Lo que se busca en cada capitulo: la casilla mas honda de lo que tapa
-- el objetivo, pero sin cruzar la parcela entera por una casilla. Hondo y
-- cerca, que es como trabaja una persona.
local function objetivoDe(capitulo)
	if capitulo == "sopladora" then
		local cuerpo = parcela.sopladoraCuerpo
		if cuerpo then
			return cuerpo.Position.X, cuerpo.Position.Z
		end
	elseif capitulo == "quitanieves" then
		local q = parcela.maquina
		if q then
			return q.sitio.X, q.sitio.Z
		end
	end
	local r = REGIONES[capitulo]
	if not r then
		return nil, nil
	end
	local pers = jugador.Character
	local raiz = pers and pers:FindFirstChild("HumanoidRootPart")
	local yo = raiz and raiz.Position or Vector3.new(0, 0, 0)
	local mejor, px, pz = nil, nil, nil
	for cx = r[1], r[3] do
		for cz = r[2], r[4] do
			local casilla = parcela:casilla(cx, cz)
			if casilla and not casilla.muro and casilla.restante > 0 then
				local x, z = parcela:centro(cx, cz)
				local nota = -casilla.restante * 14 + math.sqrt((x - yo.X) ^ 2 + (z - yo.Z) ^ 2)
				if not mejor or nota < mejor then
					mejor, px, pz = nota, x, z
				end
			end
		end
	end
	if px then
		return px, pz
	end
	return parcela:centro(math.floor((r[1] + r[3]) / 2), math.floor((r[2] + r[4]) / 2))
end

local function mejorCasilla(ox, oz, minimo)
	local pers = jugador.Character
	local raiz = pers and pers:FindFirstChild("HumanoidRootPart")
	local yo = raiz and raiz.Position or Vector3.new(0, 0, 0)
	local mejor, mx, mz = nil, nil, nil
	for cx = 0, parcela.ancho - 1 do
		for cz = 0, parcela.largo - 1 do
			if parcela:puedeExcavar(cx, cz, minimo) then
				local x, z = parcela:centro(cx, cz)
				local casilla = parcela:casilla(cx, cz)
				local alObjetivo = math.sqrt((x - ox) ^ 2 + (z - oz) ^ 2)
				local aMi = math.sqrt((x - yo.X) ^ 2 + (z - yo.Z) ^ 2)
				-- Cerca de lo que busco, cerca de mi, y por lo alto: con la
				-- regla de la pendiente lo alto es lo unico que baja.
				local nota = alObjetivo + aMi * 1.2 - casilla.restante * 4
				if not mejor or nota < mejor then
					mejor, mx, mz = nota, x, z
				end
			end
		end
	end
	return mx, mz
end

local function andarHasta(x, z)
	local pers = jugador.Character
	local raiz = pers and pers:FindFirstChild("HumanoidRootPart")
	local desde = raiz and raiz.Position or Vector3.new(0, 0, 0)
	local metros = (Vector3.new(desde.X, 0, desde.Z) - Vector3.new(x, 0, z)).Magnitude
	jugador:Mover(x, 3, z)
	avanzar(math.max(0.2, metros / A.jugador.velocidad))
end

local function montonMasCerca()
	local pers = jugador.Character
	local raiz = pers and pers:FindFirstChild("HumanoidRootPart")
	local yo = raiz and raiz.Position or Vector3.new(0, 0, 0)
	local mejor, sitio = nil, nil
	for _, mon in ipairs(parcela.descargas) do
		local d = (Vector3.new(yo.X, 0, yo.Z) - mon.sitio).Magnitude
		if not mejor or d < mejor then
			mejor, sitio = d, mon.sitio
		end
	end
	return sitio
end

-- Al volante: pasadas de ida y vuelta por la calzada, cambiando de carril
-- como hace cualquiera. La maniobra de cambiar de carril se cobra: cuatro
-- segundos, que es mas o menos lo que cuesta dar la vuelta a un trasto de
-- estos.
local function pasadaConLaMaquina()
	local q = parcela.maquina
	if not q then
		return false
	end
	local humano = jugador.Character:FindFirstChildOfClass("Humanoid")
	if q.asiento.Occupant ~= humano then
		andarHasta(q.sitio.X, q.sitio.Z + 6)
		q.asiento:Sit(humano)
		avanzar(0.5)
		return true
	end

	local xInicio = parcela.origen.X + (m.garajeCx + 15) * A.nieve.celda
	local xFinal = parcela.origen.X + (S.cxPlaza + 4) * A.nieve.celda
	local carriles = { 0, -20, 20, -10, 10 }
	local carrilZ = parcela.origen.Z + (S.czCarretera + 0.5) * A.nieve.celda
		+ carriles[(carril % #carriles) + 1]
	carril = carril + 1

	-- La maniobra: encarar el carril y ponerse al principio de la calle.
	q.giro = -math.pi / 2
	q.sitio = Vector3.new(xInicio, q.sitio.Y, carrilZ)
	q.asiento.Throttle = 0
	avanzar(4)

	-- Y la pasada de ida, y la de vuelta marcha atras.
	q.asiento.Throttle = 1
	local limite = 0
	while q.sitio.X < xFinal and limite < 400 do
		avanzar(0.3)
		limite = limite + 1
		if q.atascado then
			break
		end
	end
	q.asiento.Throttle = -1
	limite = 0
	while q.sitio.X > xInicio and limite < 400 do
		avanzar(0.3)
		limite = limite + 1
	end
	q.asiento.Throttle = 0
	return true
end

print("")
print("── UNA PARTIDA ENTERA")
print("")

local LIMITE = 60 * 60
while reloj < LIMITE do
	local est = estadoDe(jugador)
	local capitulo = est.capitulo or "puerta"
	if capitulo == "fin" then
		break
	end

	if capitulo == "plaza" then
		if not pasadaConLaMaquina() then
			break
		end
		revisarAvisos()
	elseif capitulo == "quitanieves" then
		local q = parcela.maquina
		if not q then
			-- Todavia no lo han aparcado: aparece un par de segundos
			-- despues de que salga el vecino. Se espera, no se abandona.
			if esperandoMaquina == 0 then
				esperandoMaquina = reloj
			end
			avanzar(1)
			if reloj > esperandoMaquina + 40 then
				print("  el quitanieves no aparece")
				break
			end
		else
			andarHasta(q.sitio.X, q.sitio.Z + 6)
			q.asiento:Sit(jugador.Character:FindFirstChildOfClass("Humanoid"))
			avanzar(1)
		end
		revisarAvisos()
	elseif capitulo == "sopladora" then
		local ox, oz = objetivoDe(capitulo)
		andarHasta(ox, oz)
		avanzar(0.4)
		revisarAvisos()
	else
		local ox, oz = objetivoDe(capitulo)
		if not ox then
			break
		end
		-- Lo primero que hace cualquiera al aparecer: cavar donde asoma la
		-- marca naranja que tiene delante. No es trampa: para eso esta.
		if not (est.hallazgos and est.hallazgos.buzon) then
			ox, oz = parcela:centro(c.buzonCx, c.buzonCz)
		end

		if (est.carga or 0) >= (est.capacidad or 1) then
			local sitio = montonMasCerca()
			andarHasta(sitio.X, sitio.Z)
			avanzar(0.6)
			viajes = viajes + 1
		else
			-- La sopladora quita lo gordo; la pala remata y descubre.
			local r = REGIONES[capitulo]
			local encima = r and parcela:capasEncima(r[1], r[2], r[3], r[4]) or 0
			local herramienta = "pala"
			if est.tiene and est.tiene.sopladora and encima > A.herramientas.sopladora.dejaCapas then
				herramienta = "sopladora"
			end
			if est.herramienta ~= herramienta then
				RemotoHerramienta.OnServerEvent:Fire(jugador, herramienta)
				avanzar(0.2)
			end
			local def = A.herramientas[herramienta]
			local x, z = mejorCasilla(ox, oz, def.dejaCapas)
			if not x and herramienta == "sopladora" then
				RemotoHerramienta.OnServerEvent:Fire(jugador, "pala")
				avanzar(0.2)
				def = A.herramientas.pala
				x, z = mejorCasilla(ox, oz, 0)
			end
			if not x then
				break
			end

			if herramienta == "sopladora" then
				-- Con la sopladora no se cava plantado: se EMPUJA, y se va
				-- cambiando de carril como quien siega.
				local largo = math.sqrt((ox - x) ^ 2 + (oz - z) ^ 2)
				local dx, dz = 0, 1
				if largo > 0.001 then
					dx, dz = (ox - x) / largo, (oz - z) / largo
				end
				local lado = ((carril % 5) - 2) * 12
				carril = carril + 1
				local x0 = x - dx * 26 - dz * lado
				local z0 = z - dz * 26 + dx * lado
				andarHasta(x0, z0)
				jugador:Mirar(dx, dz)
				for paso = 1, 9 do
					jugador:Mover(x0 + dx * paso * 5, 3, z0 + dz * paso * 5)
					avanzar(5 / A.jugador.velocidad + def.golpe)
				end
			else
				-- La pala muerde DELANTE, a def.alcance. Asi que no se
				-- cava plantado encima de la casilla: se llega hasta un
				-- paso antes y se mira a ella, que es lo que hace
				-- cualquiera con una pala en la mano.
				local pers = jugador.Character
				local raiz = pers and pers:FindFirstChild("HumanoidRootPart")
				local yo = raiz and raiz.Position or Vector3.new(x, 3, z - 8)
				local ax, az = x - yo.X, z - yo.Z
				local largo = math.sqrt(ax * ax + az * az)
				if largo < 0.001 then
					ax, az, largo = ox - x, oz - z, math.max(0.001, math.sqrt((ox - x) ^ 2 + (oz - z) ^ 2))
				end
				ax, az = ax / largo, az / largo
				local paso = (def.cerca + def.lejos) / 2
				andarHasta(x - ax * paso, z - az * paso)
				jugador:Mirar(ax, az)
				-- Cinco paladas y a buscar otro sitio, no siete: la cuchara
				-- apuntada vacia su circulo antes que la de antes, y
				-- quedarse ahi dandole al aire no es como juega nadie.
				avanzar(def.golpe * 5)
			end
		end
		revisarAvisos()
	end
end

revisarAvisos()

-------------------------------------------------------------------
--  Y AHORA LA TORMENTA
--
--  Se cronometra desde que la nieve ha cuajado hasta que el camion
--  llega a la plaza. Con un jugador y con dos: con dos NO cae mas
--  nieve, sale un bloqueo mas y las zonas son mas anchas.
-------------------------------------------------------------------

local equipo = { jugador }
for i = 2, (JUGADORES or 1) do
	local otro = nuevoJugador("Ayudante" .. i)
	entra(otro)
	avanzar(4)
	-- Se viene a echar una mano a la parcela del primero.
	otro:Mover(parcela.origen.X + 40, 3, parcela.origen.Z + S.czCarretera * A.nieve.celda)
	RemotoCavar.OnServerEvent:Fire(otro, true)
	equipo[#equipo + 1] = otro
end

print("")
print(("── LA TORMENTA, CON %d JUGADOR(ES)"):format(#equipo))
print("")

-- A esperar a que llegue: calma, aviso y olas.
local empezoLaEspera = reloj
while reloj < empezoLaEspera + 120 and not parcela.tormenta do
	avanzar(1)
end
if not parcela.tormenta then
	print("  la tormenta no ha llegado")
else
	while reloj < empezoLaEspera + 200 and parcela:tormentaTotal() <= 0 do
		avanzar(1)
	end
	avanzar(A.tormenta.olas * A.tormenta.entreOlas + 2)
	local t = parcela.tormenta
	local arranque = reloj
	print(("  %8s   empieza con %d bloqueos y %d capas de nieve nueva"):format(
		minutos(0), #t.bloqueos, parcela:tormentaTotal()))
	print(("             (se calculaba %s de faena)"):format(minutos(t.rato or 0)))
	for _, b in ipairs(t.bloqueos) do
		print(("             - %-28s %s"):format(A.nombre(b.nombre, "es"), b.herramienta))
	end

	-- Cada uno se ocupa de un bloqueo distinto, que es lo que hace que
	-- con dos se tarde menos sin que haya mas nieve.
	local function pendientes()
		local lista = {}
		for _, b in ipairs(t.bloqueos) do
			if not b.limpio then
				lista[#lista + 1] = b
			end
		end
		return lista
	end

	-- Andar, pero para cualquiera del equipo y desde dentro de su propio
	-- hilo: aqui NO se puede llamar a avanzar(), que es quien mueve el
	-- reloj de todos. Cada jugador espera con task.wait y el reloj corre
	-- fuera, asi que dos jugadores trabajan DE VERDAD a la vez.
	local function andarCon(quien, x, z)
		local pers = quien.Character
		local raiz = pers and pers:FindFirstChild("HumanoidRootPart")
		local desde = raiz and raiz.Position or Vector3.new(0, 0, 0)
		local metros = (Vector3.new(desde.X, 0, desde.Z) - Vector3.new(x, 0, z)).Magnitude
		quien:Mover(x, 3, z)
		task.wait(math.max(0.2, metros / A.jugador.velocidad))
	end

	local function montonCercaDe(quien)
		local pers = quien.Character
		local raiz = pers and pers:FindFirstChild("HumanoidRootPart")
		local yo = raiz and raiz.Position or Vector3.new(0, 0, 0)
		local mejor, sitio = nil, nil
		for _, mon in ipairs(parcela.descargas) do
			local d = (Vector3.new(yo.X, 0, yo.Z) - mon.sitio).Magnitude
			if not mejor or d < mejor then
				mejor, sitio = d, mon.sitio
			end
		end
		return sitio
	end

	-- La carretilla se llena, y con ella llena la pala no quita nada. Sin
	-- esto el simulador se quedaba dando golpes al aire delante de los
	-- escalones durante media hora.
	local function vaciarSiHaceFalta(quien)
		local e = estadoDe(quien)
		local tope = e.capacidad or A.jugador.capacidad
		if (e.carga or 0) < tope then
			return
		end
		local sitio = montonCercaDe(quien)
		if not sitio then
			return
		end
		andarCon(quien, sitio.X, sitio.Z)
		local espera = 0
		while (estadoDe(quien).carga or 0) > 0 and espera < 10 do
			task.wait(0.4)
			espera = espera + 0.4
		end
	end

	local function quedaEn(b)
		return parcela:capasTormentaEncima(b.zona[1], b.zona[2], b.zona[3], b.zona[4])
	end

	-- OJO: para saber si una pasada ha servido de algo NO vale mirar la
	-- casilla mas honda. La maquina limpia de punta a punta, y mientras le
	-- falte un metro por barrer la mas honda sigue siendo la misma: una
	-- pasada que ha quitado mil capas parecia no haber hecho nada, y la
	-- calle se quedaba a medias para siempre. Se cuentan TODAS.
	local function restanEn(b)
		local total = 0
		for cx = b.zona[1], b.zona[3] do
			for cz = b.zona[2], b.zona[4] do
				local c = parcela:casilla(cx, cz)
				if c then
					total = total + c.tormenta
				end
			end
		end
		return total
	end

	-- La calzada es de maquina: pasadas de punta a punta del bloqueo,
	-- cambiando de carril, hasta dejarlo limpio.
	local function turnoConLaMaquina(quien, b)
		local q = parcela.maquina
		if not q then
			return
		end
		local humano = quien.Character:FindFirstChildOfClass("Humanoid")
		if q.asiento.Occupant ~= humano then
			andarCon(quien, q.sitio.X, q.sitio.Z + 6)
			q.asiento:Sit(humano)
			task.wait(0.5)
		end
		-- Sin salirse de la parcela: fuera no hay calle, y el quitanieves
		-- solo pisa calle.
		-- Se empieza JUSTO en el bloqueo, sin margen por detras: tres
		-- casillas antes puede haber ventisquero, y ahi la maquina se
		-- planta y no llega a entrar nunca.
		local x0 = parcela.origen.X + math.max(2, b.zona[1]) * A.nieve.celda
		local x1 = parcela.origen.X + math.min(parcela.ancho - 3, b.zona[3] + 3) * A.nieve.celda
		-- Los carriles van sobre EL BLOQUEO, no siempre sobre el eje de la
		-- calle: el desvio del arbol va por el arcen, y ahi hay que pasar
		-- la maquina.
		local czMedio = (b.zona[2] + b.zona[4]) / 2
		local pasadas = 0
		while not b.limpio and pasadas < 12 do
			local antes = restanEn(b)
			q.giro = -math.pi / 2
			-- SIEMPRE POR EL EJE. La pala del quitanieves es casi tan
			-- ancha como la calzada, asi que no hay carriles que valgan:
			-- apartarse un metro del centro solo sirve para que una
			-- esquina de la maquina pise acera, y ahi no pisa. Se repite
			-- la pasada por el medio hasta dejarlo limpio.
			q.sitio = Vector3.new(x0, q.sitio.Y,
				parcela.origen.Z + (czMedio + 0.5) * A.nieve.celda)
			q.asiento.Throttle = 0
			task.wait(3)
			q.asiento.Throttle = 1
			-- Y tiene que dar tiempo a cruzarlo entero: si la pasada se
			-- corta a medias, la mitad de alla no se limpia nunca.
			local margen = math.ceil((x1 - x0) / (A.herramientas.quitanieves.velocidad * 0.3)) + 60
			local vueltas = 0
			while q.sitio.X < x1 and vueltas < margen do
				task.wait(0.3)
				vueltas = vueltas + 1
				if q.atascado then
					break
				end
			end
			q.asiento.Throttle = 0
			pasadas = pasadas + 1
			-- Si una pasada entera no ha quitado nada, no la repito doce
			-- veces: ahi hay algo que la maquina no puede.
			if restanEn(b) >= antes then
				break
			end
		end
		q.asiento:Levantar()
		task.wait(0.6)
	end

	-- Acera y escalones: a pie, con sopladora o pala.
	local function turnoAPie(quien, b, herramienta)
		local util = herramienta or b.herramienta
		local maquina = parcela.maquina
		if quien.Character and maquina and maquina.asiento.Occupant
			== quien.Character:FindFirstChildOfClass("Humanoid") then
			maquina.asiento:Levantar()
			task.wait(0.5)
		end
		-- Hasta que la herramienta sea la que toca. El servidor ignora el
		-- cambio mientras sigas al volante, y si no se comprueba se acaba
		-- rascando un escalon con la sopladora, que deja siempre una capa
		-- y no lo termina nunca.
		for _ = 1, 6 do
			if estadoDe(quien).herramienta == util then
				break
			end
			RemotoHerramienta.OnServerEvent:Fire(quien, util)
			task.wait(0.4)
		end
		local def = A.herramientas[util]
		local limpio = TORMENTA.LIMPIO[b.tipo]
		-- Se va siempre a lo mas hondo que queda del bloqueo. La pala y la
		-- sopladora barren un area entera de una pasada, asi que casi nunca
		-- hay que andar: lo siguiente mas hondo suele caer al lado.
		local golpes = 0
		while not b.limpio and golpes < 400 do
			-- Se barre POR DONDE UNO ESTA. Ir siempre a la casilla mas
			-- honda de todo el bloqueo suena bien y es malisimo: en una
			-- acera de treinta y siete casillas la mas honda salta de una
			-- punta a la otra y se pasa la tormenta andando.
			local pers = quien.Character
			local raiz = pers and pers:FindFirstChild("HumanoidRootPart")
			local yo = raiz and raiz.Position or Vector3.new(0, 0, 0)
			local mejor, mx, mz = nil, nil, nil
			for cx = b.zona[1], b.zona[3] do
				for cz = b.zona[2], b.zona[4] do
					local c = parcela:casilla(cx, cz)
					if c and c.tormenta > limpio then
						local x, z = parcela:centro(cx, cz)
						local nota = math.sqrt((x - yo.X) ^ 2 + (z - yo.Z) ^ 2) - c.tormenta * 6
						if not mejor or nota < mejor then
							mejor, mx, mz = nota, x, z
						end
					end
				end
			end
			if not mx then
				break
			end
			vaciarSiHaceFalta(quien)
			-- No se cava plantado ENCIMA mirando siempre al norte: se
			-- llega desde donde uno esta, se queda un paso antes y se mira
			-- a lo que se quiere quitar.
			local pers = quien.Character
			local raiz = pers and pers:FindFirstChild("HumanoidRootPart")
			local yo = raiz and raiz.Position or Vector3.new(mx, 3, mz - 8)
			local dx, dz = mx - yo.X, mz - yo.Z
			local largo = math.sqrt(dx * dx + dz * dz)
			if largo < 0.001 then
				dx, dz, largo = 0, 1, 1
			end
			dx, dz = dx / largo, dz / largo
			local paso = def.lejos and (def.cerca + def.lejos) / 2 or 6
			andarCon(quien, mx - dx * paso, mz - dz * paso)
			quien:Mirar(dx, dz)
			task.wait(def.golpe * 4)
			golpes = golpes + 1
		end
	end

	-- Cada uno coge UN bloqueo y no lo suelta hasta terminarlo, y nadie
	-- coge el que ya lleva otro. Eso es lo que hace que con dos se tarde
	-- menos SIN que haya mas nieve: no hay mas trabajo, hay dos manos.
	local cogidos = {}
	-- QUITANIEVES HAY UNO, y por eso lo lleva SIEMPRE el mismo. Cuando los
	-- dos se turnaban al volante se echaban el uno al otro del asiento a
	-- media pasada y la calle no se despejaba nunca: la maquina iba y
	-- venia sin quitar un copo. Uno conduce y el otro palea, que es
	-- ademas como lo hace cualquiera.
	local conductor = equipo[1]
	local function siguienteBloqueo(quien, vuelta)
		local lista = pendientes()
		if #lista == 0 then
			return nil
		end
		for i = 0, #lista - 1 do
			local b = lista[((vuelta + i) % #lista) + 1]
			local esMaquina = b.herramienta == "quitanieves"
			if esMaquina and quien ~= conductor then
				-- no es mi maquina
			elseif not cogidos[b.clave] then
				return b
			end
		end
		return nil
	end

	for numero, quien in ipairs(equipo) do
		task.spawn(function()
			-- Cada uno empieza por un bloqueo distinto de la lista.
			local vuelta = numero - 1
			while parcela.tormenta and parcela.tormenta.camion == nil do
				local b = siguienteBloqueo(quien, vuelta)
				if b then
					cogidos[b.clave] = quien
					if b.herramienta == "quitanieves" then
						turnoConLaMaquina(quien, b)
					else
						turnoAPie(quien, b)
					end
					cogidos[b.clave] = nil
					-- Si no lo he terminado, no me quedo atascado en el:
					-- paso al siguiente y ya volvere.
					if not b.limpio then
						vuelta = vuelta + 1
					end
					task.wait(0.5)
				else
					-- Si no me toca nada, no me quedo mirando: me voy a la
					-- calle a echar una mano con la pala mientras el otro
					-- pasa la maquina. Palear una calzada es lento, pero es
					-- lo que hace cualquiera antes que quedarse quieto.
					-- Antes de irse a palear una calzada, que es lo mas
					-- lento que hay, se arrima al que ya esta trabajando a
					-- pie: dos en una acera terminan antes que uno.
					local calle = nil
					for _, otro in ipairs(pendientes()) do
						if otro.herramienta ~= "quitanieves" then
							calle = otro
							break
						end
					end
					calle = calle or pendientes()[1]
					if calle then
						print(("    [ayuda] %s %-9s pala en %s"):format(
							minutos(reloj), quien.Name, calle.clave))
						turnoAPie(quien, calle,
							calle.herramienta ~= "quitanieves" and calle.herramienta or "pala")
					end
					task.wait(1)
				end
			end
		end)
	end

	local tope = reloj + 45 * 60
	while parcela.tormenta and parcela.tormenta.camion == nil and reloj < tope do
		avanzar(1)
		revisarAvisos()
	end

	local abierta = reloj - arranque
	print(("  %8s   RUTA ABIERTA"):format(minutos(abierta)))
	local esperando = reloj
	while parcela.tormenta and reloj < esperando + 120 do
		avanzar(1)
	end
	local total = reloj - arranque
	print(("  %8s   el camion llega y termina la tormenta"):format(minutos(total)))
	print("")
	local minimo = #equipo > 1 and 7 * 60 or 10 * 60
	local maximo = #equipo > 1 and 9 * 60 or 12 * 60
	if total >= minimo and total <= maximo then
		print(("  ✓ tormenta con %d: %s   (%s-%s)"):format(#equipo, minutos(total),
			minutos(minimo), minutos(maximo)))
	else
		print(("  ✗ tormenta con %d: %s   (se buscaba %s-%s)"):format(#equipo, minutos(total),
			minutos(minimo), minutos(maximo)))
	end
end

local final = estadoDe(jugador)
print("")
print(("  nieve movida en total: %d capas de %d"):format(
	math.floor(final.nieveTotal or 0), parcela.capasTotales))
print(("  viajes al monton:      %d"):format(viajes))
print(("  capitulo al terminar:  %s"):format(tostring(final.capitulo)))
print("")

print("── EL RITMO")
print("")
local objetivos = {
	{ clave = "buzon", nombre = "lo primero que aparece", min = 0, max = 30 },
	{ clave = "puerta", nombre = "la puerta de tu casa", min = 3 * 60, max = 5 * 60 },
	{ clave = "sopladora", nombre = "la sopladora en la mano", min = 5 * 60, max = 7 * 60 },
	{ clave = "carretera", nombre = "pisar la carretera", min = 10 * 60, max = 12 * 60 },
	{ clave = "vecino", nombre = "el vecino rescatado", min = 14 * 60, max = 17 * 60 },
	{ clave = "quitanieves", nombre = "el quitanieves", min = 15 * 60, max = 18 * 60 },
	{ clave = "plaza", nombre = "la plaza del pueblo", min = 20 * 60, max = 22 * 60 },
}
local fuera = 0
for _, o in ipairs(objetivos) do
	local t = hitos[o.clave]
	if not t then
		print(("  ✗ %-24s  NO LLEGA (se buscaba %s-%s)"):format(o.nombre, minutos(o.min), minutos(o.max)))
		fuera = fuera + 1
	elseif t < o.min or t > o.max then
		print(("  ✗ %-24s  %s   (se buscaba %s-%s)"):format(o.nombre, minutos(t), minutos(o.min), minutos(o.max)))
		fuera = fuera + 1
	else
		print(("  ✓ %-24s  %s   (%s-%s)"):format(o.nombre, minutos(t), minutos(o.min), minutos(o.max)))
	end
end

-- La otra regla: nada de cinco minutos sin que pase nada visible.
print("")
local orden = {}
for _, def in ipairs(A.hallazgos) do
	if hitos[def.clave] then
		orden[#orden + 1] = { t = hitos[def.clave], que = A.nombre(def.nombre, "es") }
	end
end
for _, extra in ipairs({ { "sopladora", "la sopladora" }, { "quitanieves", "el quitanieves" } }) do
	if hitos[extra[1]] then
		orden[#orden + 1] = { t = hitos[extra[1]], que = extra[2] }
	end
end
table.sort(orden, function(a, b)
	return a.t < b.t
end)
local peorHueco, dondeHueco = 0, ""
local anterior = 0
for _, paso in ipairs(orden) do
	local hueco = paso.t - anterior
	if hueco > peorHueco then
		peorHueco, dondeHueco = hueco, paso.que
	end
	anterior = paso.t
end
if peorHueco <= 5 * 60 then
	print(("  ✓ nunca se pasa de cinco minutos sin que pase algo (lo peor: %s antes de %s)"):format(
		minutos(peorHueco), dondeHueco))
else
	print(("  ✗ hay %s sin que pase nada antes de %s"):format(minutos(peorHueco), dondeHueco))
	fuera = fuera + 1
end

print("")
if fuera > 0 then
	print(("  %d cosas fuera de sitio: hay que tocar los numeros"):format(fuera))
else
	print("  la partida entera cae donde tenia que caer")
end
