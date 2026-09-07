--[[
	Un jugador de mentira excava hacia la casa y se apunta lo que cuesta
	cada hallazgo.

	Ya no importa "41 minutos hasta renacer". Importa esto:
	  - cuanto tarda en aparecer lo primero
	  - cuanto tarda en aparecer la puerta
	  - cuanta nieve hay que mover para conseguirlo
	  - cuantos viajes al monton
]]

local A = AJUSTES
local RS = game:GetService("ReplicatedStorage")
local remotos = RS:FindFirstChild("DesenterrarRemotos")
local RemotoEstado = remotos:FindFirstChild("Estado")
local RemotoAviso = remotos:FindFirstChild("Aviso")

local CELDA = A.nieve.celda

local function estadoDe(jugador)
	for i = #RemotoEstado._alCliente, 1, -1 do
		if RemotoEstado._alCliente[i].jugador == jugador then
			return RemotoEstado._alCliente[i].datos
		end
	end
	return {}
end

local carpeta = workspace:FindFirstChild("Desenterrar")
local grupo = carpeta:FindFirstChild("Parcela_1")
local monton = grupo:FindFirstChild("Monton")
local casa = grupo:FindFirstChild("Casa")
local puerta = casa:FindFirstChild("Puerta")

local jugador = nuevoJugador("Excavador")
entra(jugador)
avanzar(0.5)
jugador:LoadCharacter()
avanzar(0.5)

-- Ahora hay que mantener pulsado para cavar.
local RemotoCavar = remotos:FindFirstChild("Cavar")
RemotoCavar.OnServerEvent:Fire(jugador, true)

local hitos = {}
local viajes = 0

local function minutos(segundos)
	return ("%3d min %02d s"):format(math.floor(segundos / 60), math.floor(segundos % 60))
end

local function apuntar(texto, nieve)
	hitos[#hitos + 1] = { t = reloj, texto = texto }
	print(("  %s   %-26s  %s capas movidas, %d viajes"):format(
		minutos(reloj), texto, tostring(math.floor(nieve)), viajes))
end

-- Se vigila lo que el servidor anuncia como descubierto.
local vistos = {}
local function revisarAvisos()
	for _, envio in ipairs(RemotoAviso._alCliente) do
		local datos = envio.datos
		if datos and datos.tipo == "hallazgo" and not vistos[datos.clave] then
			vistos[datos.clave] = true
			apuntar(A.nombre(datos.nombre, "es"), estadoDe(jugador).nieveTotal or 0)
		end
	end
end

print("")
print("── LO QUE CUESTA DESENTERRAR LA PUERTA")
print("")

-- El excavador ideal: mira el modelo, va a la casilla excavable mas
-- cercana a la puerta, y cuando se llena vuelve al monton.
local parcela = PARCELA.registro[1]
local px, pz = puerta.Position.X, puerta.Position.Z
local LIMITE = 60 * 45

-- Una persona no cruza el crater de punta a punta cada tres segundos:
-- cava lo que tiene al lado, tirando hacia la puerta. Sin esto, lo que se
-- mide es el paseo y no el juego.
local function mejorCasilla()
	local pers = jugador.Character
	local raiz = pers and pers:FindFirstChild("HumanoidRootPart")
	local yo = raiz and raiz.Position or Vector3.new(0, 0, 0)
	local mejor, mx, mz = nil, nil, nil
	for cx = 0, parcela.ancho - 1 do
		for cz = 0, parcela.largo - 1 do
			if parcela:puedeExcavar(cx, cz) then
				local x, z = parcela:centro(cx, cz)
				local aLaPuerta = math.sqrt((x - px) ^ 2 + (z - pz) ^ 2)
				local aMi = math.sqrt((x - yo.X) ^ 2 + (z - yo.Z) ^ 2)
				local nota = aLaPuerta + aMi * 2.5
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

while reloj < LIMITE do
	local est = estadoDe(jugador)
	if est.hallazgos and est.hallazgos.puerta then
		break
	end

	if (est.carga or 0) >= (est.capacidad or 1) then
		andarHasta(monton.Position.X, monton.Position.Z)
		avanzar(0.6)
		viajes = viajes + 1
	else
		local x, z = mejorCasilla()
		if not x then
			break
		end
		-- Una persona no da un paso por palada: se planta y cava un rato.
		andarHasta(x, z)
		avanzar(A.jugador.golpe * 7)
	end
	revisarAvisos()
end

revisarAvisos()
local final = estadoDe(jugador)
print("")
print(("  nieve movida en total: %s capas de %d"):format(
	tostring(math.floor(final.nieveTotal or 0)),
	grupo:GetAttribute("capas") or 0
))
print(("  viajes al monton:      %d"):format(viajes))
print(("  capas sobre la puerta: %d"):format(final.capasPuerta or -1))
print("")

if not (final.hallazgos and final.hallazgos.puerta) then
	print("  LA PUERTA NO APARECE en 45 minutos: demasiado caro para un primer capitulo")
end
