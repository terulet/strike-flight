--[[
	Un jugador de mentira juega ABRE LA CALLE de principio a fin y se
	apunta lo que cuesta cada cosa.

	Lo que importa no es "cuanto tarda en renacer". Es esto, que es el
	ritmo que se busca:

	    lo primero          antes de 0:30
	    la puerta           entre 3:30 y 4:30
	    la sopladora        alrededor de 6:00
	    la carretera        alrededor de 9:00
	    el vecino           entre 10:00 y 12:00

	El excavador de mentira juega como jugaria una persona: va a por lo
	que le pide el capitulo, sopla lo gordo, remata con la pala y vacia la
	carretilla en el monton que le pilla mas cerca.
]]

local A = AJUSTES
local RS = game:GetService("ReplicatedStorage")
local remotos = RS:FindFirstChild("RemotosCalle")
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

local carpeta = workspace:FindFirstChild("Juego")
local grupo = carpeta:FindFirstChild("Parcela_1")
local parcela = PARCELA.registro[1]
local m = parcela.casa
local v = parcela.vecino
local c = parcela.calle

local jugador = nuevoJugador("Excavador")
entra(jugador)
avanzar(0.5)
jugador:LoadCharacter()
avanzar(0.5)

-- Hay que mantener pulsado, asi que se mantiene.
RemotoCavar.OnServerEvent:Fire(jugador, true)

local viajes = 0
local carril = 0

local function minutos(segundos)
	return ("%d:%02d"):format(math.floor(segundos / 60), math.floor(segundos % 60))
end

-- Lo que se busca en cada capitulo. Un jugador no cava "hacia la casa":
-- cava LO QUE LE TAPA lo que busca, o sea la casilla mas honda de lo que
-- el capitulo mide. Sin esto lo que se cronometra es un paseo.
local REGIONES = {
	puerta = { m.cxCentro - 1, m.cz1 + 1, m.cxCentro + 1, m.cz1 + 3 },
	garaje = { m.garajeCx - 2, m.cz1 + 1, m.garajeCx + 2, m.cz1 + 2 },
	carretera = { m.garajeCx - 2, m.cz1 + 1, m.garajeCx + 2, A.sitio.czCarretera + 1 },
	vecino = { v.cxCentro - 2, v.cz0 - 4, v.cxCentro + 2, v.cz0 - 1 },
}

local function objetivoDe(capitulo)
	if capitulo == "sopladora" then
		local cuerpo = parcela.sopladoraCuerpo
		if cuerpo then
			return cuerpo.Position.X, cuerpo.Position.Z
		end
		return m.garajeX, m.garajeFrenteZ + 8
	end
	local r = REGIONES[capitulo]
	if not r then
		return nil, nil
	end
	-- Lo mas hondo que tapa lo que busco, pero sin cruzar el solar entero
	-- por una casilla: hondo Y cerca, que es como trabaja una persona.
	local pers = jugador.Character
	local raiz = pers and pers:FindFirstChild("HumanoidRootPart")
	local yo = raiz and raiz.Position or Vector3.new(0, 0, 0)
	local mejor, px, pz = nil, nil, nil
	for cx = r[1], r[3] do
		for cz = r[2], r[4] do
			local c = parcela:casilla(cx, cz)
			if c and not c.muro and c.restante > 0 then
				local x, z = parcela:centro(cx, cz)
				local nota = -c.restante * 14 + math.sqrt((x - yo.X) ^ 2 + (z - yo.Z) ^ 2)
				if not mejor or nota < mejor then
					mejor = nota
					px, pz = x, z
				end
			end
		end
	end
	if px then
		return px, pz
	end
	return parcela:centro(math.floor((r[1] + r[3]) / 2), math.floor((r[2] + r[4]) / 2))
end

local hitos = {}
local vistos = {}
local function revisarAvisos()
	for _, envio in ipairs(RemotoAviso._alCliente) do
		local datos = envio.datos
		if datos and datos.tipo == "hallazgo" and not vistos[datos.clave] then
			vistos[datos.clave] = true
			hitos[datos.clave] = reloj
			print(("  %8s   %-26s  %d capas movidas, %d viajes"):format(
				minutos(reloj), A.nombre(datos.nombre, "es"),
				math.floor(estadoDe(jugador).nieveTotal or 0), viajes))
			-- Y cuanto queda encima de lo siguiente: si sale casi cero, es
			-- que el capitulo que viene ya estaba hecho sin querer.
			local r = REGIONES[datos.clave == "puerta" and "garaje"
				or datos.clave == "garaje" and "carretera"
				or datos.clave == "carretera" and "vecino" or "puerta"]
			if r and datos.clave ~= "buzon" then
				print(("             (a lo siguiente le quedan %d capas encima)"):format(
					parcela:capasEncima(r[1], r[2], r[3], r[4])))
			end
		end
		if datos and datos.tipo == "cogida" and not vistos.cogida then
			vistos.cogida = true
			hitos.sopladora = reloj
			print(("  %8s   %-26s  %d capas movidas, %d viajes"):format(
				minutos(reloj), "COGE LA SOPLADORA",
				math.floor(estadoDe(jugador).nieveTotal or 0), viajes))
		end
	end
end

print("")
print("── LO QUE HAY QUE MOVER")
print("")
for _, fila in ipairs({
	{ "el buzon", { c.buzonCx, c.buzonCz - 1, c.buzonCx, c.buzonCz + 1 } },
	{ "la puerta", REGIONES.puerta },
	{ "el garaje", REGIONES.garaje },
	{ "la entrada y la calle", REGIONES.carretera },
	{ "la puerta del vecino", REGIONES.vecino },
}) do
	local r = fila[2]
	print(("  %-24s %2d capas encima"):format(fila[1], parcela:capasEncima(r[1], r[2], r[3], r[4])))
end

print("")
print("── UNA PARTIDA ENTERA")
print("")

local LIMITE = 60 * 30

-- Una persona no cruza el crater de punta a punta cada tres segundos:
-- cava lo que tiene al lado, tirando hacia el objetivo. Sin esto, lo que
-- se mide es el paseo y no el juego.
local function mejorCasilla(ox, oz, minimo)
	local pers = jugador.Character
	local raiz = pers and pers:FindFirstChild("HumanoidRootPart")
	local yo = raiz and raiz.Position or Vector3.new(0, 0, 0)
	local mejor, mx, mz = nil, nil, nil
	for cx = 0, parcela.ancho - 1 do
		for cz = 0, parcela.largo - 1 do
			if parcela:puedeExcavar(cx, cz, minimo) then
				local x, z = parcela:centro(cx, cz)
				local alObjetivo = math.sqrt((x - ox) ^ 2 + (z - oz) ^ 2)
				local aMi = math.sqrt((x - yo.X) ^ 2 + (z - yo.Z) ^ 2)
				local casilla = parcela:casilla(cx, cz)
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

while reloj < LIMITE do
	local est = estadoDe(jugador)
	local capitulo = est.capitulo or "puerta"
	if capitulo == "fin" then
		break
	end

	local ox, oz = objetivoDe(capitulo)
	if not ox then
		break
	end
	-- Lo primero que hace cualquiera al aparecer: cavar donde asoma la
	-- marca naranja que tiene delante. No es trampa: para eso esta.
	if not (est.hallazgos and est.hallazgos.buzon) then
		ox, oz = parcela:centro(c.buzonCx, c.buzonCz)
	end

	if capitulo == "sopladora" then
		-- No hay nada que cavar: hay que ir a por ella.
		andarHasta(ox, oz)
		avanzar(0.4)
	elseif (est.carga or 0) >= (est.capacidad or 1) then
		local sitio = montonMasCerca()
		andarHasta(sitio.X, sitio.Z)
		avanzar(0.6)
		viajes = viajes + 1
	else
		-- Con la sopladora se quita lo gordo; la pala remata. Se elige
		-- mirando LO QUE SE BUSCA: si encima todavia hay mas nieve de la
		-- que la maquina puede tragar, maquina; si ya solo queda el
		-- colchon, pala, que es la unica que descubre.
		local r = REGIONES[capitulo]
		local encima = r and parcela:capasEncima(r[1], r[2], r[3], r[4]) or 0
		local herramienta = "pala"
		if est.tieneSopladora and encima > A.herramientas.sopladora.dejaCapas then
			herramienta = "sopladora"
		end
		if est.herramienta ~= herramienta then
			RemotoHerramienta.OnServerEvent:Fire(jugador, herramienta)
			avanzar(0.2)
		end
		local minimo = A.herramientas[herramienta].dejaCapas

		local x, z = mejorCasilla(ox, oz, minimo)
		if not x and herramienta == "sopladora" then
			RemotoHerramienta.OnServerEvent:Fire(jugador, "pala")
			avanzar(0.2)
			x, z = mejorCasilla(ox, oz, A.herramientas.pala.dejaCapas)
		end
		if not x then
			break
		end

		local def = A.herramientas[herramienta] or A.herramientas.pala
		if herramienta == "sopladora" then
			-- Con la sopladora no se cava plantado: se EMPUJA, y se va
			-- cambiando de carril como quien siega. Pasando siempre por el
			-- mismo sitio no queda nada que tragar y la maquina parece
			-- inutil, que no lo es.
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
			-- Una persona no da una palada por paso: se planta y cava un
			-- rato en el mismo sitio.
			andarHasta(x, z)
			jugador:Mirar(ox - x, oz - z)
			avanzar(def.golpe * 7)
		end
	end
	revisarAvisos()
end

revisarAvisos()
local final = estadoDe(jugador)
print("")
print(("  nieve movida en total: %d capas de %d"):format(
	math.floor(final.nieveTotal or 0), grupo:GetAttribute("capas") or 0))
print(("  viajes al monton:      %d"):format(viajes))
print(("  capitulo al terminar:  %s"):format(tostring(final.capitulo)))
print("")

-- Y ahora lo unico que importa: si el ritmo es el que se buscaba.
print("── EL RITMO")
print("")
local objetivos = {
	{ clave = "buzon", nombre = "lo primero que aparece", min = 0, max = 30 },
	{ clave = "puerta", nombre = "la puerta de tu casa", min = 3 * 60 + 30, max = 4 * 60 + 30 },
	{ clave = "sopladora", nombre = "la sopladora en la mano", min = 5 * 60, max = 7 * 60 },
	{ clave = "carretera", nombre = "pisar la carretera", min = 8 * 60, max = 10 * 60 },
	{ clave = "vecino", nombre = "el gancho del vecino", min = 10 * 60, max = 12 * 60 },
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
print("")
if fuera > 0 then
	print(("  %d de %d fuera de sitio: hay que tocar los numeros"):format(fuera, #objetivos))
else
	print("  la partida entera cae donde tenia que caer")
end
