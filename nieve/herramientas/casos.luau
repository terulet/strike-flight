--[[
	Lo que tiene que cumplir el juego. Se ejecuta de verdad, con el
	codigo del servidor tal cual, sobre el Roblox de mentira.
]]

local A = AJUSTES
local celda = A.mundo.celda
local RS = game:GetService("ReplicatedStorage")
local remotos = RS:FindFirstChild("NieveRemotos")
local RemotoEstado = remotos:FindFirstChild("Estado")
local RemotoAviso = remotos:FindFirstChild("Aviso")
local RemotoComprar = remotos:FindFirstChild("Comprar")

local carpeta = workspace:FindFirstChild("Nieve")

local function estadoDe(jugador)
	for i = #RemotoEstado._alCliente, 1, -1 do
		local envio = RemotoEstado._alCliente[i]
		if envio.jugador == jugador then
			return envio.datos
		end
	end
	return nil
end

local function ultimoAviso(jugador)
	for i = #RemotoAviso._alCliente, 1, -1 do
		local envio = RemotoAviso._alCliente[i]
		if envio.jugador == jugador then
			return envio.datos
		end
	end
	return nil
end

-- Centro de la parcela y sitio del camion, por zona.
local function celdaDe(indice)
	return A.zonas[indice].celda or A.mundo.celda
end

local function sitios(indice)
	local x = 0
	for i = 1, indice - 1 do
		x = x + A.zonas[i].ancho * celdaDe(i) + A.mundo.separacion
	end
	local def = A.zonas[indice]
	local anchoS = def.ancho * celdaDe(indice)
	local largoS = def.largo * celdaDe(indice)
	return {
		centroX = x + anchoS / 2,
		centroZ = 0,
		ventaZ = largoS / 2 + 9,
	}
end

local S1 = sitios(1)
local S2 = sitios(2)

-- Un jugador de verdad no se queda quieto: barre la parcela en
-- serpentina, como quien corta el cesped. Sin esto no se mide nada real.
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

local function velocidadDe(jugador)
	local pers = jugador.Character
	local humano = pers and pers:FindFirstChild("Humanoid")
	return (humano and humano.WalkSpeed) or A.jugador.velocidadBase
end

local recorrido = {}

-- Barre hasta llenar la carretilla (o hasta que se acabe el tiempo).
local function barrer(jugador, indice, segundosMax)
	local velocidad = velocidadDe(jugador)
	local paso = 0.2
	local t = 0
	while t < segundosMax do
		local est = estadoDe(jugador)
		if est and est.carga >= est.capacidad then
			break
		end
		recorrido[jugador] = (recorrido[jugador] or 0) + velocidad * paso
		local x, z = serpiente(indice, recorrido[jugador], 8)
		jugador:Mover(x, 3, z)
		avanzar(paso)
		t = t + paso
	end
	return t
end

-- El viaje al camion y la vuelta: tiempo muerto, como en el juego.
local function vender(jugador, indice)
	local sitio = sitios(indice)
	jugador:Mover(sitio.centroX, 3, sitio.ventaZ)
	avanzar(4)
end

-- Trabaja hasta juntar el dinero pedido. Devuelve segundos de juego.
local function trabajar(jugador, indice, objetivo, viajesMax)
	local desde = reloj
	for _ = 1, viajesMax or 400 do
		local est = estadoDe(jugador)
		if est and est.dinero >= objetivo then
			return reloj - desde
		end
		barrer(jugador, indice, 30)
		vender(jugador, indice)
	end
	return nil
end


-------------------------------------------------------------------
titulo("EL MUNDO SE CONSTRUYE SOLO")
-------------------------------------------------------------------

comprobar(carpeta ~= nil, "existe la carpeta Nieve en workspace")

local totalEsperado = 0
for _, def in ipairs(A.zonas) do
	totalEsperado = totalEsperado + def.ancho * def.largo
end

local totalBloques = 0
for _, def in ipairs(A.zonas) do
	local grupo = carpeta:FindFirstChild(def.clave)
	local nieve = grupo and grupo:FindFirstChild("Nieve")
	if nieve then
		totalBloques = totalBloques + #nieve:GetChildren()
	end
end
comprobar(totalBloques < totalEsperado, "el decorado deja huecos sin nieve (la mesa, la piscina, los arboles)")
comprobar(
	totalBloques > totalEsperado * 0.7,
	"pero la parcela sigue siendo sobre todo nieve: " .. tostring(totalBloques) .. " de " .. tostring(totalEsperado)
)

do
	local piezas = 0
	for _, obj in ipairs(carpeta:GetDescendants()) do
		if obj:IsA("BasePart") then
			piezas = piezas + 1
		end
	end
	print(("       (el mapa son %d piezas en total)"):format(piezas))
	comprobar(piezas < 6000, "y no se dispara: menos de 6.000 piezas, que esto va en movil")
end

local puertas = carpeta:FindFirstChild("Puertas")
comprobarIgual(puertas and #puertas:GetChildren() or 0, #A.zonas - 1, "una puerta entre cada dos zonas")

local salida = carpeta:FindFirstChild("Salida")
comprobar(salida ~= nil and salida.ClassName == "SpawnLocation", "hay sitio donde aparecer")

for _, def in ipairs(A.zonas) do
	local grupo = carpeta:FindFirstChild(def.clave)
	local ruedas = 0
	if grupo then
		for _, pieza in ipairs(grupo:GetChildren()) do
			if pieza.Name == "RuedaCamion" then
				ruedas = ruedas + 1
			end
		end
	end
	comprobar(
		grupo ~= nil and grupo:FindFirstChild("Cabina") ~= nil and grupo:FindFirstChild("VolqueteSuelo") ~= nil and ruedas == 6,
		"la zona " .. def.clave .. " tiene camion con cabina, volquete y seis ruedas"
	)
end


-------------------------------------------------------------------
titulo("ENTRA UN JUGADOR NUEVO")
-------------------------------------------------------------------

local ana = nuevoJugador("Ana")
entra(ana)
avanzar(0.5)
ana:LoadCharacter()
avanzar(0.5)

local marcador = ana:FindFirstChild("leaderstats")
comprobar(marcador ~= nil, "se le pone marcador")
comprobar(marcador and marcador:FindFirstChild("Coins") ~= nil, "el marcador lleva monedas")

local pala = ana.Character and ana.Character:FindFirstChild("Pala")
comprobar(pala ~= nil, "le dan una pala")
comprobar(pala and pala:FindFirstChild("Mango") ~= nil, "con su mango")
comprobar(pala and pala:FindFirstChild("Hoja") ~= nil, "y su hoja")
local soldadura = pala and pala.Mango:FindFirstChildOfClass("WeldConstraint")
comprobar(
	soldadura ~= nil and soldadura.Part0 == ana.Character:FindFirstChild("Right Arm"),
	"soldada al brazo, que si no flota al lado del muneco"
)

local carretilla = ana.Character and ana.Character:FindFirstChild("Carretilla")
comprobar(carretilla ~= nil, "y una carretilla, que tambien se ve")
local montones = 0
if carretilla then
	for _, pieza in ipairs(carretilla:GetChildren()) do
		if string.sub(pieza.Name, 1, 6) == "Monton" then
			montones = montones + 1
		end
	end
end
comprobarIgual(montones, 6, "la carretilla tiene sus seis escalones de nieve")
comprobar(carretilla and carretilla.Monton1.Transparency == 1, "y vacia no se ve ninguno")

local humano = ana.Character:FindFirstChild("Humanoid")
comprobarIgual(humano.WalkSpeed, A.jugador.velocidadBase, "anda a la velocidad de partida")

local e = estadoDe(ana)
comprobar(e ~= nil, "el cliente recibe el estado")
local PREMIO_PRIMER_DIA = A.diario.bloques * A.zonas[1].valor
comprobarIgual(e and e.dinero, PREMIO_PRIMER_DIA, "entra con el premio del primer dia")
comprobarIgual(e and e.capacidad, A.jugador.capacidadBase, "empieza con la carretilla de partida")


-------------------------------------------------------------------
titulo("RECOGER NIEVE")
-------------------------------------------------------------------

local dineroAlEntrar = e.dinero
ana:Mover(S1.centroX, 3, S1.centroZ)
avanzar(0.6)
e = estadoDe(ana)
comprobar(e.carga > 0, "al pisar la nieve, se recoge")

barrer(ana, 1, 40)
e = estadoDe(ana)
comprobarIgual(e.carga, e.capacidad, "barriendo un rato la carretilla se llena hasta el tope")
comprobarIgual(e.dinero, dineroAlEntrar, "recoger no da dinero: hay que venderla")
comprobar(e.valor > 0, "la carga vale algo")

-- La nieve pisada desaparece de verdad.
local grupo1 = carpeta:FindFirstChild(A.zonas[1].clave)
local nieve1 = grupo1:FindFirstChild("Nieve")
local invisibles = 0
for _, bloque in ipairs(nieve1:GetChildren()) do
	if bloque.Transparency == 1 then
		invisibles = invisibles + 1
	end
end
comprobar(invisibles > 0, "los bloques recogidos se quitan de la vista")

-- Con carga encima, el monton de la carretilla tiene que verse.
comprobar(
	ana.Character.Carretilla.Monton1.Transparency == 0,
	"con la carretilla llena, el monton se ve de verdad"
)

comprobar(e.limpio > 0, "la barra de limpieza sube")


-------------------------------------------------------------------
titulo("VENDER")
-------------------------------------------------------------------

local cargaAntes = e.carga
ana:Mover(S1.centroX, 3, S1.ventaZ)
avanzar(0.5)
e = estadoDe(ana)
comprobarIgual(e.dinero, dineroAlEntrar + cargaAntes * A.zonas[1].valor, "el camion paga la carga entera")
comprobarIgual(e.carga, 0, "la carretilla se vacia")

local aviso = ultimoAviso(ana)
comprobar(aviso ~= nil and aviso.tipo == "venta", "al vender salta el aviso")

comprobarIgual(marcador:FindFirstChild("Coins").Value, e.dinero, "el marcador de Roblox cuadra")


-------------------------------------------------------------------
titulo("NO SE PUEDE COMPRAR SIN DINERO")
-------------------------------------------------------------------

-- Se gasta todo lo que tiene en palas, hasta que no llegue para la siguiente.
for _ = 1, 20 do
	local est = estadoDe(ana)
	if est.precios.pala < 0 or est.dinero < est.precios.pala then
		break
	end
	RemotoComprar.OnServerEvent:Fire(ana, "mejora", "pala")
	avanzar(0.2)
end

e = estadoDe(ana)
comprobar(e.dinero < e.precios.pala, "se queda sin dinero para la siguiente pala")

local nivelAntes = e.niveles.pala
RemotoComprar.OnServerEvent:Fire(ana, "mejora", "pala")
avanzar(0.4)
e = estadoDe(ana)
comprobarIgual(e.niveles.pala, nivelAntes, "y no se la venden")
comprobar(ultimoAviso(ana).clave == "sinDinero", "y te avisa de que falta dinero")

RemotoComprar.OnServerEvent:Fire(ana, "mejora", "cohete_de_mentira")
avanzar(0.3)
comprobar(true, "una mejora inventada no revienta el servidor")

RemotoComprar.OnServerEvent:Fire(ana, 12345)
avanzar(0.3)
comprobar(true, "una peticion con basura dentro tampoco")


-------------------------------------------------------------------
titulo("EL BUCLE COMPLETO: TRABAJAR, COBRAR, MEJORAR")
-------------------------------------------------------------------

local precioPala = estadoDe(ana).precios.pala
local nivelPala = estadoDe(ana).niveles.pala
local tardo = trabajar(ana, 1, precioPala, 40)
comprobar(tardo ~= nil, "trabajando junta el precio de la siguiente pala")
if tardo then
	print(("       (le ha costado %.0f segundos de juego)"):format(tardo))
	comprobar(tardo < 120, "y no le lleva media tarde")
end

local dineroAntes = estadoDe(ana).dinero
local largoPalaAntes = ana.Character.Pala.Mango.Size.Y
RemotoComprar.OnServerEvent:Fire(ana, "mejora", "pala")
avanzar(0.4)
e = estadoDe(ana)
comprobarIgual(e.niveles.pala, nivelPala + 1, "ahora si sube la pala")
comprobar(
	ana.Character.Pala.Mango.Size.Y > largoPalaAntes,
	"y la pala se rehace mas grande: comprarla se tiene que VER"
)
comprobarIgual(e.dinero, dineroAntes - precioPala, "y cobra el precio exacto")
comprobar(e.precios.pala > precioPala, "la siguiente pala cuesta mas")

-- La carretilla tiene que notarse en la capacidad.
local capacidadAntes = e.capacidad
local anchoCarretillaAntes = ana.Character.Carretilla.Cubeta.Size.X
trabajar(ana, 1, e.precios.carretilla, 60)
RemotoComprar.OnServerEvent:Fire(ana, "mejora", "carretilla")
avanzar(0.4)
e = estadoDe(ana)
comprobarIgual(e.capacidad, capacidadAntes + A.jugador.capacidadPorNivel, "la carretilla sube la capacidad")
comprobar(
	ana.Character.Carretilla.Cubeta.Size.X > anchoCarretillaAntes,
	"y la carretilla se rehace mas grande"
)

-- Las botas tienen que notarse al andar.
trabajar(ana, 1, e.precios.botas, 120)
RemotoComprar.OnServerEvent:Fire(ana, "mejora", "botas")
avanzar(0.4)
comprobar(humano.WalkSpeed > A.jugador.velocidadBase, "las botas hacen que ande mas rapido")


-------------------------------------------------------------------
titulo("LA PUERTA DE LA SEGUNDA ZONA")
-------------------------------------------------------------------

local puerta2 = puertas:FindFirstChild("Puerta_" .. A.zonas[2].clave)
comprobar(puerta2 ~= nil, "existe la puerta de la acera")
local prompt2 = puerta2:FindFirstChildOfClass("ProximityPrompt")
comprobar(prompt2 ~= nil, "y se abre acercandose")

-- Sin dinero no se abre.
local dineroPobre = estadoDe(ana).dinero
if dineroPobre < A.zonas[2].precio then
	prompt2.Triggered:Fire(ana)
	avanzar(0.3)
	e = estadoDe(ana)
	comprobar(not e.zonas[A.zonas[2].clave], "sin dinero la puerta no se abre")
end

-- Aunque te cueles, la nieve de dentro no es tuya.
barrer(ana, 2, 4)
e = estadoDe(ana)
comprobarIgual(e.carga, 0, "colandote en una zona cerrada no recoges nada")

local tardo2 = trabajar(ana, 1, A.zonas[2].precio, 400)
comprobar(tardo2 ~= nil, "se puede juntar el precio de la acera")
if tardo2 then
	print(("       (abrir la acera: %.0f segundos mas)"):format(tardo2))
end

prompt2.Triggered:Fire(ana)
avanzar(0.4)
e = estadoDe(ana)
comprobar(e.zonas[A.zonas[2].clave] == true, "con el dinero, la puerta se abre")

local dineroTrasAbrir = e.dinero
prompt2.Triggered:Fire(ana)
avanzar(0.3)
comprobarIgual(estadoDe(ana).dinero, dineroTrasAbrir, "abrir dos veces no cobra dos veces")

-- Y ahora la nieve de la acera si cuenta, y vale mas.
barrer(ana, 2, 6)
e = estadoDe(ana)
comprobar(e.carga > 0, "ya se recoge nieve en la acera")
comprobar(e.valor >= e.carga * A.zonas[2].valor, "y cada bloque vale mas que en la entrada")


-------------------------------------------------------------------
titulo("LA NIEVE VUELVE")
-------------------------------------------------------------------

local grupo2 = carpeta:FindFirstChild(A.zonas[2].clave)
local nieve2 = grupo2:FindFirstChild("Nieve")
local function contarQuitados()
	local n = 0
	for _, bloque in ipairs(nieve2:GetChildren()) do
		if bloque.Transparency == 1 then
			n = n + 1
		end
	end
	return n
end

local quitadosAntes = contarQuitados()
comprobar(quitadosAntes > 0, "hay huecos en la acera")
ana:Mover(S2.centroX, 3, S2.ventaZ + 40)
avanzar(A.mundo.regreso + 15)
comprobar(contarQuitados() < quitadosAntes, "pasado un rato vuelve a nevar")


-------------------------------------------------------------------
titulo("SE GUARDA LA PARTIDA")
-------------------------------------------------------------------

local dineroFinal = estadoDe(ana).dinero
local nivelFinal = estadoDe(ana).niveles.pala
sale(ana)
avanzar(0.5)

local guardado = DATOS_GUARDADOS["j_" .. tostring(ana.UserId)]
comprobar(guardado ~= nil, "al salir se guarda")
comprobarIgual(guardado and guardado.dinero, dineroFinal, "guarda el dinero exacto")
comprobarIgual(guardado and guardado.pala, nivelFinal, "guarda el nivel de la pala")
comprobar(guardado and #guardado.zonas == 2, "guarda las zonas abiertas")

-- Vuelve al dia siguiente.
local ana2 = nuevoJugador("Ana")
ana2.UserId = ana.UserId
entra(ana2)
avanzar(0.5)
ana2:LoadCharacter()
avanzar(0.5)
local vuelta = estadoDe(ana2)
comprobarIgual(vuelta.dinero, dineroFinal, "al volver tiene su dinero")
comprobarIgual(vuelta.niveles.pala, nivelFinal, "y su pala")
comprobar(vuelta.zonas[A.zonas[2].clave] == true, "y su acera abierta")
sale(ana2)
avanzar(0.3)


-------------------------------------------------------------------
titulo("SI FALLA EL GUARDADO, NO SE PISA LA PARTIDA BUENA")
-------------------------------------------------------------------

FALLA_EL_DATASTORE = true
local pepe = nuevoJugador("Pepe")
pepe.UserId = ana.UserId
entra(pepe)
avanzar(30)
pepe:LoadCharacter()
avanzar(0.5)

local suEstado = estadoDe(pepe)
comprobarIgual(suEstado.dinero, PREMIO_PRIMER_DIA, "si no se puede leer, empieza de cero esta sesion")
comprobar(suEstado.dinero ~= dineroFinal, "y desde luego no hereda la partida del otro")

FALLA_EL_DATASTORE = false
sale(pepe)
avanzar(0.5)
local sigueAhi = DATOS_GUARDADOS["j_" .. tostring(ana.UserId)]
comprobarIgual(sigueAhi and sigueAhi.dinero, dineroFinal, "pero la partida vieja sigue intacta")


-------------------------------------------------------------------
titulo("RENACER")
-------------------------------------------------------------------

local rico = nuevoJugador("Rico")
DATOS_GUARDADOS["j_" .. tostring(rico.UserId)] = {
	v = 1,
	dinero = A.renacer.precio + 1000,
	nieveTotal = 500000,
	renaceres = 0,
	pala = 12,
	carretilla = 12,
	botas = 8,
	zonas = (function()
		local todas = {}
		for i, def in ipairs(A.zonas) do
			todas[i] = def.clave
		end
		return todas
	end)(),
}
entra(rico)
avanzar(0.5)
rico:LoadCharacter()
avanzar(0.5)

local er = estadoDe(rico)
comprobarIgual(er.niveles.pala, 12, "carga las mejoras guardadas")
comprobar(er.puedeRenacer == true, "con todas las zonas abiertas ya puede renacer")

RemotoComprar.OnServerEvent:Fire(rico, "renacer")
avanzar(0.5)
er = estadoDe(rico)
comprobarIgual(er.renaceres, 1, "renace")
comprobarIgual(er.dinero, 0, "se queda sin dinero")
comprobarIgual(er.niveles.pala, 1, "y sin mejoras")
comprobarIgual(er.multiplicador, 2, "pero a partir de ahora cobra el doble")
comprobar(er.zonas[A.zonas[5].clave] ~= true, "y las zonas se cierran otra vez")

-- El doble de verdad: recoger y vender ahora paga x2.
barrer(rico, 1, 30)
local cargaRico = estadoDe(rico).carga
vender(rico, 1)
comprobarIgual(estadoDe(rico).dinero, cargaRico * A.zonas[1].valor * 2, "el x2 se nota en la caja")


-------------------------------------------------------------------
titulo("NO SE PUEDE RENACER ANTES DE TIEMPO")
-------------------------------------------------------------------

local novato = nuevoJugador("Novato")
entra(novato)
avanzar(0.5)
novato:LoadCharacter()
avanzar(0.5)
RemotoComprar.OnServerEvent:Fire(novato, "renacer")
avanzar(0.4)
comprobarIgual(estadoDe(novato).renaceres, 0, "sin las zonas abiertas no se renace")
comprobarIgual(ultimoAviso(novato).clave, "renacerFalta", "y te dice por que")


-------------------------------------------------------------------
titulo("EL MISMO JUGADOR EN DOS SERVIDORES A LA VEZ")
-------------------------------------------------------------------

local function todasLasZonas()
	local lista = {}
	for i, def in ipairs(A.zonas) do
		lista[i] = def.clave
	end
	return lista
end

local doble = nuevoJugador("Doble")
local claveDoble = "j_" .. tostring(doble.UserId)
DATOS_GUARDADOS[claveDoble] = {
	v = 1,
	dinero = 100,
	nieveTotal = 1000,
	renaceres = 1,
	ventas = 20,
	racha = 2,
	ultimoDia = 0,
	ultimoPremio = 0,
	pala = 3,
	carretilla = 2,
	botas = 1,
	zonas = { A.zonas[1].clave, A.zonas[2].clave },
	codigos = { "NIEVE" },
}
entra(doble)
avanzar(0.6)

-- Mientras este juega, el otro servidor guarda una partida mas avanzada.
DATOS_GUARDADOS[claveDoble] = {
	v = 1,
	dinero = 999999,
	nieveTotal = 5000,
	renaceres = 1,
	ventas = 90,
	racha = 4,
	ultimoDia = 0,
	ultimoPremio = 0,
	pala = 9,
	carretilla = 9,
	botas = 5,
	zonas = todasLasZonas(),
	codigos = { "GRACIAS" },
}

sale(doble)
avanzar(0.8)

local fusionado = DATOS_GUARDADOS[claveDoble]
comprobar(fusionado.nieveTotal >= 5000, "la nieve acumulada del otro servidor no se pierde")
comprobar(fusionado.ventas >= 90, "ni las ventas")
comprobar(fusionado.racha >= 4, "ni la racha")
comprobarIgual(#fusionado.zonas, #A.zonas, "las zonas que abrio el otro siguen abiertas")

local tieneAmbos = false
do
	local vistos = {}
	for _, clave in ipairs(fusionado.codigos) do
		vistos[clave] = true
	end
	tieneAmbos = vistos.NIEVE == true and vistos.GRACIAS == true
end
comprobar(tieneAmbos, "y los codigos canjeados en los dos sitios se juntan")


-------------------------------------------------------------------
titulo("PERO RENACER SI CIERRA LAS ZONAS")
-------------------------------------------------------------------

local renacido = nuevoJugador("Renacido")
local claveRenacido = "j_" .. tostring(renacido.UserId)
DATOS_GUARDADOS[claveRenacido] = {
	v = 1,
	dinero = A.renacer.precio + 5000,
	nieveTotal = 100000,
	renaceres = 0,
	ventas = 300,
	racha = 1,
	ultimoDia = 0,
	ultimoPremio = 0,
	pala = 12,
	carretilla = 12,
	botas = 8,
	zonas = todasLasZonas(),
	codigos = {},
}
entra(renacido)
avanzar(0.6)
renacido:LoadCharacter()
avanzar(0.4)

RemotoComprar.OnServerEvent:Fire(renacido, "renacer")
avanzar(0.6)
comprobarIgual(estadoDe(renacido).renaceres, 1, "renace")

-- Y ahora aparece el registro viejo, de antes de renacer, con las cinco
-- zonas abiertas. La fusion NO puede resucitarlas.
DATOS_GUARDADOS[claveRenacido] = {
	v = 1,
	dinero = 50,
	nieveTotal = 100000,
	renaceres = 0,
	ventas = 300,
	racha = 1,
	ultimoDia = 0,
	ultimoPremio = 0,
	pala = 12,
	carretilla = 12,
	botas = 8,
	zonas = todasLasZonas(),
	codigos = {},
}
sale(renacido)
avanzar(0.8)

local trasRenacer = DATOS_GUARDADOS[claveRenacido]
comprobarIgual(#trasRenacer.zonas, 1, "tras renacer solo queda la primera zona, la fusion no la deshace")
comprobarIgual(trasRenacer.renaceres, 1, "y el renacer cuenta")
comprobar(trasRenacer.nieveTotal >= 100000, "pero la nieve de toda la vida sigue ahi")


-------------------------------------------------------------------
titulo("EL PREMIO DIARIO Y SU RACHA")
-------------------------------------------------------------------

local hoy = nuevoJugador("Diaria")
entra(hoy)
avanzar(0.6)
comprobarIgual(estadoDe(hoy).dinero, PREMIO_PRIMER_DIA, "el primer dia paga premio")
comprobarIgual(ultimoAviso(hoy).racha, 1, "y dice que vas por el dia 1")
local dineroDia1 = estadoDe(hoy).dinero
sale(hoy)
avanzar(0.6)

-- Volver a entrar el mismo dia no puede pagar otra vez.
local otraVez = nuevoJugador("Diaria")
otraVez.UserId = hoy.UserId
entra(otraVez)
avanzar(0.6)
comprobarIgual(estadoDe(otraVez).dinero, dineroDia1, "entrar dos veces el mismo dia no paga dos veces")
sale(otraVez)
avanzar(0.6)

-- Manana.
TIEMPO_BASE = TIEMPO_BASE + 86400
local manana = nuevoJugador("Diaria")
manana.UserId = hoy.UserId
entra(manana)
avanzar(0.6)
comprobar(estadoDe(manana).dinero > dineroDia1, "al dia siguiente vuelve a pagar")
comprobarIgual(ultimoAviso(manana).racha, 2, "y la racha va por dos")
comprobarIgual(estadoDe(manana).dinero - dineroDia1, PREMIO_PRIMER_DIA * 2, "el dia 2 paga el doble")
sale(manana)
avanzar(0.6)

-- Y a los cuatro dias sin aparecer, la racha se cae.
TIEMPO_BASE = TIEMPO_BASE + 86400 * 4
local tarde = nuevoJugador("Diaria")
tarde.UserId = hoy.UserId
entra(tarde)
avanzar(0.6)
comprobarIgual(ultimoAviso(tarde).racha, 1, "si tardas mucho en volver, la racha empieza de cero")
sale(tarde)
avanzar(0.6)


-------------------------------------------------------------------
titulo("LOS CODIGOS")
-------------------------------------------------------------------

local canjeador = nuevoJugador("Canjeador")
entra(canjeador)
avanzar(0.6)
local antesCodigo = estadoDe(canjeador).dinero

RemotoComprar.OnServerEvent:Fire(canjeador, "codigo", "  nieve  ")
avanzar(0.4)
local premioCodigo = A.codigos[1].bloques * A.zonas[1].valor
comprobarIgual(estadoDe(canjeador).dinero, antesCodigo + premioCodigo, "el codigo paga, con espacios y en minusculas")

RemotoComprar.OnServerEvent:Fire(canjeador, "codigo", "NIEVE")
avanzar(0.4)
comprobarIgual(estadoDe(canjeador).dinero, antesCodigo + premioCodigo, "y no se puede repetir")
comprobarIgual(ultimoAviso(canjeador).clave, "codigoUsado", "te dice que ya lo usaste")

RemotoComprar.OnServerEvent:Fire(canjeador, "codigo", "REGALAME_TODO")
avanzar(0.4)
comprobarIgual(estadoDe(canjeador).dinero, antesCodigo + premioCodigo, "un codigo inventado no da nada")
comprobarIgual(ultimoAviso(canjeador).clave, "codigoMal", "y te lo dice")

RemotoComprar.OnServerEvent:Fire(canjeador, "codigo", string.rep("X", 500))
avanzar(0.4)
comprobar(true, "un codigo de 500 letras no revienta el servidor")

-- Un codigo canjeado se guarda: al volver no vale otra vez.
sale(canjeador)
avanzar(0.6)
local vuelve = nuevoJugador("Canjeador")
vuelve.UserId = canjeador.UserId
entra(vuelve)
avanzar(0.6)
local antesRepetir = estadoDe(vuelve).dinero
RemotoComprar.OnServerEvent:Fire(vuelve, "codigo", "NIEVE")
avanzar(0.4)
comprobarIgual(estadoDe(vuelve).dinero, antesRepetir, "y sigue sin valer al dia siguiente")
sale(vuelve)
avanzar(0.6)


-------------------------------------------------------------------
titulo("LA TABLA DE RECORDS")
-------------------------------------------------------------------

comprobar(RECORDS[tostring(ana.UserId)] ~= nil, "al salir, la nieve total sube a la tabla")

local poste = workspace.Nieve:FindFirstChild("Tabla")
comprobar(poste ~= nil, "hay poste de records en el mapa")
local listaRecords = poste and poste:FindFirstChild("Lista", true)
comprobar(listaRecords ~= nil, "con su lista")

avanzar(A.records.refresco + 5)
comprobar(listaRecords.Text ~= "", "y pasado el refresco, dice algo")
comprobar(string.find(listaRecords.Text, "1") ~= nil, "empezando por el puesto 1")
do
	local filas = 1
	for _ in string.gmatch(listaRecords.Text, "\n") do
		filas = filas + 1
	end
	comprobarIgual(filas, A.records.cuantos, "y siempre las diez filas, para que el cartel no baile de tamano")
end


-------------------------------------------------------------------
titulo("EL SERVIDOR SE APAGA")
-------------------------------------------------------------------

comprobar(#CIERRES > 0, "hay guardado de emergencia al apagar")
for _, fn in ipairs(CIERRES) do
	task.spawn(fn)
end
avanzar(4)
comprobar(DATOS_GUARDADOS["j_" .. tostring(rico.UserId)] ~= nil, "al apagar se guarda a los que estaban dentro")


-------------------------------------------------------------------
print("")
print(("── %d bien, %d mal"):format(PASADAS, FALLOS))
if FALLOS > 0 then
	error(("hay %d comprobaciones que fallan"):format(FALLOS), 0)
end
