--[[
	Un jugador de mentira juega solo, de principio a fin, y apunta lo que
	tarda en cada hito.

	Sirve para lo unico que de verdad hunde a un juego de este tipo: que
	a los diez minutos ya no suba nada. Aqui se ve antes de publicarlo.
]]

local A = AJUSTES
local celda = A.mundo.celda
local RS = game:GetService("ReplicatedStorage")
local remotos = RS:FindFirstChild("NieveRemotos")
local RemotoEstado = remotos:FindFirstChild("Estado")
local RemotoComprar = remotos:FindFirstChild("Comprar")

local function estadoDe(jugador)
	for i = #RemotoEstado._alCliente, 1, -1 do
		local envio = RemotoEstado._alCliente[i]
		if envio.jugador == jugador then
			return envio.datos
		end
	end
	return nil
end

local function celdaDe(indice)
	return A.zonas[indice].celda or A.mundo.celda
end

local function sitios(indice)
	local x = 0
	for i = 1, indice - 1 do
		x = x + A.zonas[i].ancho * celdaDe(i) + A.mundo.separacion
	end
	local def = A.zonas[indice]
	return {
		centroX = x + def.ancho * celdaDe(indice) / 2,
		ventaZ = def.largo * celdaDe(indice) / 2 + 9,
	}
end

local function serpiente(indice, distancia, espaciado)
	local def = A.zonas[indice]
	local sitio = sitios(indice)
	local anchoS = def.ancho * celdaDe(indice)
	local largoS = def.largo * celdaDe(indice)
	local fondo = anchoS - 4
	local filas = math.max(1, math.floor((largoS - 4) / espaciado))
	local fila = math.floor(distancia / fondo) % filas
	local avance = distancia % fondo
	if fila % 2 == 1 then
		avance = fondo - avance
	end
	return sitio.centroX - anchoS / 2 + 2 + avance, -largoS / 2 + 2 + fila * espaciado
end

local jugador = nuevoJugador("Simulado")
entra(jugador)
avanzar(0.5)
jugador:LoadCharacter()
avanzar(0.5)

local humano = jugador.Character:FindFirstChild("Humanoid")
local recorrido = 0

local function zonaActiva(estado)
	local mejor = 1
	for i, def in ipairs(A.zonas) do
		if estado.zonas[def.clave] then
			mejor = i
		end
	end
	return mejor
end

local function barrer(indice, segundosMax)
	local paso = 0.2
	local t = 0
	while t < segundosMax do
		local est = estadoDe(jugador)
		if est and est.carga >= est.capacidad then
			break
		end
		recorrido = recorrido + humano.WalkSpeed * paso
		local x, z = serpiente(indice, recorrido, math.max(6, humano.WalkSpeed * 0.5))
		jugador:Mover(x, 3, z)
		avanzar(paso)
		t = t + paso
	end
end

local function vender(indice)
	local sitio = sitios(indice)
	jugador:Mover(sitio.centroX, 3, sitio.ventaZ)
	avanzar(4)
end

local function minutos(segundos)
	return ("%3d min %02d s"):format(math.floor(segundos / 60), math.floor(segundos % 60))
end

local hitos = {}
local ganado = 0
local ganadoEnElHito = 0
local tDelHito = 0

local function apuntar(texto)
	local hueco = reloj - tDelHito
	local ritmo = hueco > 0 and (ganado - ganadoEnElHito) / hueco * 60 or 0
	hitos[#hitos + 1] = { t = reloj, texto = texto }
	print(("  %s   %-34s  (%s monedas/min en este tramo)"):format(
		minutos(reloj), texto, tostring(math.floor(ritmo))))
	ganadoEnElHito = ganado
	tDelHito = reloj
end

print("")
print("── LO QUE TARDA UN JUGADOR EN LLEGAR A CADA SITIO")
print("")

local abiertas = { entrada = true }
local topes = {}
local viajes = 0
local LIMITE = 60 * 90 -- hora y media de juego, y si no llega es que no llega

while reloj < LIMITE do
	local e = estadoDe(jugador)
	if not e then
		break
	end
	local zona = zonaActiva(e)

	local dineroAntes = e.dinero
	barrer(zona, 40)
	vender(zona)
	viajes = viajes + 1

	e = estadoDe(jugador)
	if e.dinero > dineroAntes then
		ganado = ganado + (e.dinero - dineroAntes)
	end

	-- Mejoras: se compra lo que no deja tieso (menos de un tercio de la hucha).
	for _, def in ipairs(A.mejoras) do
		local precio = e.precios[def.clave]
		if precio and precio > 0 and e.dinero >= precio * 3 then
			RemotoComprar.OnServerEvent:Fire(jugador, "mejora", def.clave)
			avanzar(0.15)
			e = estadoDe(jugador)
			if e.niveles[def.clave] >= def.niveles and not topes[def.clave] then
				topes[def.clave] = true
				apuntar(("%s al maximo (nivel %d)"):format(def.clave, def.niveles))
			end
		end
	end

	-- Zona siguiente: en cuanto llega el dinero.
	for i = 2, #A.zonas do
		local def = A.zonas[i]
		if not e.zonas[def.clave] and e.dinero >= def.precio then
			local puerta = workspace.Nieve.Puertas:FindFirstChild("Puerta_" .. def.clave)
			local prompt = puerta and puerta:FindFirstChildOfClass("ProximityPrompt")
			if prompt then
				prompt.Triggered:Fire(jugador)
				avanzar(0.2)
				e = estadoDe(jugador)
				if e.zonas[def.clave] and not abiertas[def.clave] then
					abiertas[def.clave] = true
					apuntar("se abre " .. AJUSTES.nombre(def.nombre, "es"))
				end
			end
		end
	end

	if e.puedeRenacer and e.dinero >= e.precioRenacer then
		RemotoComprar.OnServerEvent:Fire(jugador, "renacer")
		avanzar(0.3)
		apuntar("primer RENACER")
		break
	end
end

print("")
local e = estadoDe(jugador)
print(("  viajes al camion: %d"):format(viajes))
print(("  monedas ganadas:  %s"):format(tostring(math.floor(ganado))))
print("")

if #hitos == 0 then
	print("  NO LLEGA A NINGUN SITIO en hora y media: la economia esta rota")
	error("ritmo roto", 0)
end

-- Lo que de verdad importa: que no haya un paron largo entre hitos.
local anterior = 0
local peor, peorTexto = 0, ""
for _, hito in ipairs(hitos) do
	local hueco = hito.t - anterior
	if hueco > peor then
		peor = hueco
		peorTexto = hito.texto
	end
	anterior = hito.t
end
print(("  el paron mas largo sin nada nuevo: %s antes de \"%s\""):format(minutos(peor), peorTexto))
print("")
