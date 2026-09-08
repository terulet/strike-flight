--[[
	Lo que tiene que cumplir LA GRAN TORMENTA.

	Ademas de todo lo de las verticales anteriores (la pendiente, las dos
	herramientas, cavar como accion), esta fase mete dos cosas que si
	fallan destrozan la partida de alguien:

	  MULTIJUGADOR   cinco parcelas, una por jugador, y cualquiera puede
	                 entrar a ayudar. Dos cavando juntos no pueden romper
	                 la pendiente, duplicar nieve ni cobrar dos veces. Y
	                 los hallazgos y las herramientas son del dueno.

	  GUARDADO       la nieve entera cabe en una cadena corta, se
	                 recupera igual, y si el DataStore no esta el juego
	                 sigue funcionando con guardado temporal.

	Y la tercera herramienta, que vuelve a cambiar como se juega: el
	quitanieves solo pisa calle, no atraviesa casas y no puede con los
	ventisqueros.

	Y desde esta fase, LA TORMENTA. Lo que se comprueba aqui por encima de
	todo lo demas: que una tormenta jamas deshace nada. Ni cierra una
	puerta descubierta, ni quita una herramienta, ni toca la partida
	guardada. Si eso se rompe, el evento pasa de ser un motivo para volver
	a ser un castigo.
]]

local A = AJUSTES
local RS = game:GetService("ReplicatedStorage")
local remotos = RS:FindFirstChild("RemotosKali")
local RemotoEstado = remotos:FindFirstChild("Estado")
local RemotoAviso = remotos:FindFirstChild("Aviso")
local RemotoCavar = remotos:FindFirstChild("Cavar")
local RemotoHerramienta = remotos:FindFirstChild("Herramienta")
local RemotoMaquina = remotos:FindFirstChild("Maquina")

local carpeta = workspace:FindFirstChild("Pueblo")
local CELDA = A.nieve.celda

local OCHO = {
	{ 1, 0 }, { -1, 0 }, { 0, 1 }, { 0, -1 },
	{ 1, 1 }, { 1, -1 }, { -1, 1 }, { -1, -1 },
}

-- El peor escalon entre vecinas. Se le puede acotar un trozo: las
-- pruebas que bajan nieve a mano (pelar) dejan cortes que no ha hecho
-- ninguna herramienta, y ahi la regla no dice nada.
local function peorDesnivel(parcela, cx0, cz0, cx1, cz1)
	local peor, dx, dz = 0, -1, -1
	for cx = cx0 or 0, cx1 or (parcela.ancho - 1) do
		for cz = cz0 or 0, cz1 or (parcela.largo - 1) do
			local c = parcela:casilla(cx, cz)
			if c and not c.muro then
				for _, d in ipairs(OCHO) do
					local v = parcela:casilla(cx + d[1], cz + d[2])
					if v and not v.muro then
						local diferencia = math.abs(c.restante - v.restante)
						if diferencia > peor then
							peor, dx, dz = diferencia, cx, cz
						end
					end
				end
			end
		end
	end
	return peor, dx, dz
end

local function estadoDe(jugador)
	for i = #RemotoEstado._alCliente, 1, -1 do
		if RemotoEstado._alCliente[i].jugador == jugador then
			return RemotoEstado._alCliente[i].datos
		end
	end
	return nil
end

local function avisosDe(jugador, tipo)
	local lista = {}
	for _, envio in ipairs(RemotoAviso._alCliente) do
		if envio.jugador == jugador and envio.datos and envio.datos.tipo == tipo then
			lista[#lista + 1] = envio.datos
		end
	end
	return lista
end


-------------------------------------------------------------------
titulo("EL BARRIO NACE BIEN")
-------------------------------------------------------------------

comprobar(carpeta ~= nil, "existe el pueblo")
comprobarIgual(A.parcela.cuantas >= 4 and A.parcela.cuantas <= 6, true, "hay entre cuatro y seis parcelas")

local sitios = {}
for i = 1, A.parcela.cuantas do
	local grupo = carpeta:FindFirstChild("Parcela_" .. i)
	comprobar(grupo ~= nil, "esta construida la parcela " .. i)
	local p = PARCELA.registro[i]
	comprobar(p ~= nil, "y su modelo de nieve")
	sitios[i] = p
end

-- Separadas de verdad: si se solaparan, cavar en una abriria agujeros en
-- la de al lado.
local separadas = true
for i = 1, #sitios - 1 do
	local a, b = sitios[i], sitios[i + 1]
	local finA = a.origen.Z + a.largo * CELDA
	if b.origen.Z <= finA then
		separadas = false
	end
end
comprobar(separadas, "y ninguna se pisa con la siguiente")

local p1 = PARCELA.registro[1]
comprobar((carpeta:FindFirstChild("Parcela_1"):GetAttribute("casillas") or 0) > 0, "la parcela tiene casillas")
comprobar(rellenosDe("Snow") > 0, "la nieve es terreno, no piezas")
comprobar(peorDesnivel(p1) <= A.nieve.desnivelMaximo, "recien nevada, ninguna vecina se pasa del desnivel")

for _, pieza in ipairs({ "PorcheSuelo", "GarajePuerta", "Puerta", "Recibidor", "Chimenea" }) do
	comprobar(carpeta.Parcela_1.Casa:FindFirstChild(pieza) ~= nil, "cada parcela tiene su " .. pieza)
end
for _, pieza in ipairs({ "Carretera", "Entrada", "Plaza", "CartelPueblo", "Buzon", "MarcaNieve" }) do
	comprobar(carpeta.Parcela_1.Calle:FindFirstChild(pieza) ~= nil, "y su " .. pieza)
end
comprobar(carpeta.Parcela_1.Vecino:FindFirstChild("Puerta") ~= nil, "y su casa de enfrente")
comprobar(carpeta.Parcela_1:FindFirstChild("PuebloDelFondo") ~= nil, "y el pueblo del fondo, que es la promesa")




-------------------------------------------------------------------
titulo("STUDIO NO PISA LAS PARTIDAS DE VERDAD")
-------------------------------------------------------------------

-- Encender el acceso a la API desde Studio conecta con el DataStore de
-- produccion. Si el nombre fuera el mismo, cualquier prueba en Studio
-- machacaria la partida de alguien que este jugando.
comprobar(
	string.sub(GUARDADO.nombreTienda, -4) == "_DEV",
	"en Studio se guarda en un DataStore aparte: " .. GUARDADO.nombreTienda
)
comprobar(
	string.find(GUARDADO.nombreTienda, "KaliSnowWorld", 1, true) == 1,
	"y con nombre propio, no el de ningun prototipo anterior"
)
comprobar(
	string.find(GUARDADO.nombreTienda, "_v" .. A.esquema, 1, true) ~= nil,
	"y con la version del esquema en el nombre"
)


-------------------------------------------------------------------
titulo("GUARDAR LA NIEVE EN POCO SITIO")
-------------------------------------------------------------------

local suelto = PARCELA.nueva(90, Vector3.new(9000, 0, 9000))
suelto:generar(function()
	return A.nieve.capasMaximas
end)
local texto = suelto:comprimir()
comprobar(#texto < 200, "una parcela recien nevada cabe en cuatro tramos")
print(("       (%d casillas -> %d caracteres)"):format(suelto.ancho * suelto.largo, #texto))

for _ = 1, 30 do
	for cx = 0, suelto.ancho - 1, 3 do
		for cz = 0, suelto.largo - 1, 3 do
			suelto:excavar(cx, cz)
		end
	end
end
local cavado = suelto:comprimir()
comprobar(#cavado < 40000, "y una muy cavada tampoco se dispara")
print(("       (muy cavada -> %d caracteres)"):format(#cavado))

local copia = PARCELA.nueva(91, Vector3.new(9000, 0, 9000))
copia:generar(function()
	return A.nieve.capasMaximas
end)
comprobar(copia:descomprimir(cavado), "lo guardado se vuelve a cargar")
local iguales = true
for cx = 0, copia.ancho - 1 do
	for cz = 0, copia.largo - 1 do
		if copia:casilla(cx, cz).restante ~= suelto:casilla(cx, cz).restante then
			iguales = false
		end
	end
end
comprobar(iguales, "y queda EXACTAMENTE la misma nieve, casilla por casilla")
comprobar(copia:comprimir() == cavado, "tanto que vuelve a comprimirse igual")

comprobar(not copia:descomprimir("99x99:1*5"), "una nieve de otro tamano se rechaza")
comprobar(not copia:descomprimir("cosas raras"), "y una cadena rota tambien")
comprobar(copia:comprimir() == cavado, "y al rechazarla no se toca nada de lo que habia")

-- El esquema con version: lo de otra version no se carga a medias.
comprobar(GUARDADO.sanear({ v = A.esquema, dinero = 10 }) ~= nil, "un guardado de esta version vale")
comprobar(GUARDADO.sanear({ v = A.esquema + 99, dinero = 10 }) == nil, "y uno de otra version se descarta entero")
local limpio = GUARDADO.sanear({
	v = A.esquema,
	dinero = 7,
	capitulo = "garaje",
	hallazgos = { puerta = true, inventado = true },
	herramientas = { pala = true, sopladora = true },
	mundo = { puerta = true, particulas = true },
	nieve = texto,
	montones = { 1, 2, 3 },
})
comprobarIgual(limpio.dinero, 7, "se guarda el dinero")
comprobarIgual(limpio.capitulo, "garaje", "y por donde iba el guion")
comprobar(limpio.hallazgos.puerta and not limpio.hallazgos.inventado, "solo los hallazgos que existen")
comprobar(limpio.mundo.puerta and not limpio.mundo.particulas, "y solo el estado del mundo que hace falta")
comprobar(limpio.montones == nil, "nada de montones de adorno: eso se reconstruye solo")


-------------------------------------------------------------------
titulo("CADA JUGADOR, SU PARCELA")
-------------------------------------------------------------------

local ana = nuevoJugador("Ana")
entra(ana)
avanzar(4)
local beto = nuevoJugador("Beto")
entra(beto)
-- Montar una parcela lleva su rato: la nieve se pone poco a poco para no
-- congelar el servidor. Hasta que no esta, no hay personaje.
avanzar(4)

local eA = estadoDe(ana)
local eB = estadoDe(beto)
comprobar(eA ~= nil and eB ~= nil, "los dos reciben estado")
comprobar(eA.mia ~= nil and eB.mia ~= nil, "los dos tienen parcela")
comprobar(eA.mia ~= eB.mia, "y no es la misma")

local pA = PARCELA.registro[eA.mia]
local pB = PARCELA.registro[eB.mia]
comprobar(pA.dueno == ana, "la parcela sabe de quien es")
comprobarIgual(pA.cartelDueno.Text, "Ana", "y lo dice en su cartel")
comprobar(pA.salida.Enabled, "su salida esta abierta")

-- Aparecer DELANTE de su propia nevada, no en la del vecino.
local raizA = ana.Character:FindFirstChild("HumanoidRootPart")
comprobar(
	math.abs(raizA.Position.Z - pA.salida.Position.Z) < 20,
	"cada uno aparece en la salida de SU parcela"
)
comprobar(
	math.abs(raizA.Position.Z - pB.salida.Position.Z) > 100,
	"que esta lejisimos de la del otro"
)

-- Cada parcela lleva su propio guion.
pA.hallazgos.puerta = true
comprobar(pB.hallazgos.puerta ~= true, "el hallazgo de uno no aparece en la parcela del otro")
pA.hallazgos.puerta = nil


-------------------------------------------------------------------
titulo("AYUDAR NO ES FASTIDIAR")
-------------------------------------------------------------------

-- Beto se planta en la parcela de Ana y cava. Es legal, cobra el, y la
-- nieve baja de la parcela de Ana.
local function llanoDe(parcela)
	local x, z = parcela:centro(34, 40)
	return x, z
end

local xA, zA = llanoDe(pA)
local antesNieve = pA:capasEncima(34, 40, 34, 40)
local antesDineroB = estadoDe(beto).dinero

-- Se planta un paso ANTES y mira a la casilla: la pala muerde delante,
-- no alrededor de los pies.
beto:Mover(xA - (A.herramientas.pala.cerca + A.herramientas.pala.lejos) / 2, 3, zA)
beto:Mirar(1, 0)
avanzar(1.2)
comprobarIgual(estadoDe(beto).ajena, "Ana", "el HUD de Beto dice a quien esta ayudando")
comprobarIgual(estadoDe(ana).ajena, nil, "y el de Ana dice que esta en la suya")

RemotoCavar.OnServerEvent:Fire(beto, true)
avanzar(6)
RemotoCavar.OnServerEvent:Fire(beto, false)
avanzar(0.5)
comprobar(pA:capasEncima(34, 40, 34, 40) < antesNieve, "quitar nieve al vecino funciona")
comprobar(estadoDe(beto).carga > 0, "y la carretilla que se llena es la del que cava")
comprobarIgual(estadoDe(ana).carga, 0, "no la del dueno")

-- Los dos a la vez, en el mismo sitio: ni se rompe la pendiente ni sale
-- nieve de la nada.
ana:Mover(xA + 6, 3, zA)
RemotoCavar.OnServerEvent:Fire(ana, true)
RemotoCavar.OnServerEvent:Fire(beto, true)
local antesQuitadas = pA.capasQuitadas
local antesA = estadoDe(ana).carga + estadoDe(ana).dinero
local antesB = estadoDe(beto).carga + estadoDe(beto).dinero
avanzar(6)
RemotoCavar.OnServerEvent:Fire(ana, false)
RemotoCavar.OnServerEvent:Fire(beto, false)
avanzar(0.5)

local movidas = pA.capasQuitadas - antesQuitadas
local cobradoA = estadoDe(ana).carga + estadoDe(ana).dinero - antesA
local cobradoB = estadoDe(beto).carga + estadoDe(beto).dinero - antesB
comprobar(movidas > 0, "dos cavando a la vez mueven nieve")
local peor, px, pz = peorDesnivel(pA)
comprobar(peor <= A.nieve.desnivelMaximo,
	("y la pendiente sigue entera (peor %d en %d,%d)"):format(peor, px, pz))
comprobarIgual(
	cobradoA + cobradoB,
	movidas,
	"y entre los dos se llevan exactamente las capas que se han quitado: ni una de mas"
)


-------------------------------------------------------------------
titulo("LOS DESBLOQUEOS SON DEL DUENO")
-------------------------------------------------------------------

local function pelar(parcela, cx0, cz0, cx1, cz1)
	for cx = cx0, cx1 do
		for cz = cz0, cz1 do
			local c = parcela:casilla(cx, cz)
			if c and not c.muro then
				c.restante = 0
			end
		end
	end
end

local mA = pA.casa
local vA = pA.vecino
local cA = pA.calle

local function rellenar(parcela, cx0, cz0, cx1, cz1, capas)
	for cx = cx0, cx1 do
		for cz = cz0, cz1 do
			local casilla = parcela:casilla(cx, cz)
			if casilla and not casilla.muro then
				-- Nunca por encima de lo que esa casilla tuvo: si no, la
				-- prueba estaria inventando nieve que jamas existio.
				casilla.restante = math.min(capas, casilla.inicial)
			end
		end
	end
end

-- Una palada de verdad en un sitio con nieve: es lo que dispara la
-- revision de hallazgos. La cantera se rellena antes, que cavando
-- siempre en el mismo sitio se llega al fondo del cono.
local CX, CZ = 34 * CELDA + 2, 40 * CELDA + 2
local function unaPalada(quien, parcela)
	local ccx, ccz = parcela:aCasilla(CX, CZ)
	rellenar(parcela, ccx - 3, ccz - 3, ccx + 3, ccz + 3, A.nieve.capasMaximas)
	quien:Mover(parcela.origen.X + CX, 3, parcela.origen.Z + CZ)
	RemotoCavar.OnServerEvent:Fire(quien, true)
	avanzar(1.2)
	RemotoCavar.OnServerEvent:Fire(quien, false)
	avanzar(0.5)
end

-------------------------------------------------------------------
titulo("LA PALA SE APUNTA, Y SE VE LO QUE LLEVAS")
-------------------------------------------------------------------

-- CAVAR ES APUNTAR. Antes la pala quitaba la nieve mas alta de un
-- circulo alrededor de tus pies: funcionaba, pero no se sentia como
-- cavar. Ahora muerde DELANTE, y lo que tienes detras se queda donde
-- esta aunque este pegado a ti.
do
	local def = A.herramientas.pala
	local medio = (def.cerca + def.lejos) / 2
	local cxA, czA = 30, 44
	rellenar(pA, cxA - 8, czA - 8, cxA + 8, czA + 8, A.nieve.capasMaximas)
	local xA2, zA2 = pA:centro(cxA, czA)
	-- Ana se planta mirando a +X, con la casilla objetivo justo delante,
	-- otra igual de lejos justo DETRAS, y otra igual de lejos AL LADO:
	-- el abanico solo puede llevarse la de delante.
	local xPie = xA2 - medio
	ana:Mover(xPie, 3, zA2)
	ana:Mirar(1, 0)
	local cxDetras = pA:aCasilla(xPie - medio, zA2)
	local _, czLado = pA:aCasilla(xPie, zA2 + medio)
	local cxLado = pA:aCasilla(xPie, zA2)
	local delanteAntes = pA:capasEncima(cxA, czA, cxA, czA)
	local detrasAntes = pA:capasEncima(cxDetras, czA, cxDetras, czA)
	local ladoAntes = pA:capasEncima(cxLado, czLado, cxLado, czLado)

	RemotoCavar.OnServerEvent:Fire(ana, true)
	avanzar(3)
	RemotoCavar.OnServerEvent:Fire(ana, false)
	avanzar(0.4)

	comprobar(pA:capasEncima(cxA, czA, cxA, czA) < delanteAntes,
		"lo que tienes delante se cava")
	comprobarIgual(pA:capasEncima(cxDetras, czA, cxDetras, czA), detrasAntes,
		"y lo que tienes detras NO se toca (paso 12 de la lista a mano)")
	comprobarIgual(pA:capasEncima(cxLado, czLado, cxLado, czLado), ladoAntes,
		"ni lo que tienes justo al lado, fuera del abanico")

	-- Y la marca que pinta el cliente usa las MISMAS tres medidas: si la
	-- marca y el mordisco no coincidieran, la marca mentiria.
	comprobar(def.cerca > 0 and def.lejos > def.cerca and def.angulo > 0 and def.angulo < 90,
		("el abanico es un abanico: de %d a %d studs, %d grados a cada lado"):format(
			def.cerca, def.lejos, def.angulo))
end

-- ANDAR NO QUITA NIEVE. Es la queja mas vieja de todas: si se recoge
-- corriendo por encima, cavar sobra.
do
	local cxP, czP = 30, 50
	rellenar(pA, cxP - 4, czP - 4, cxP + 4, czP + 4, A.nieve.capasMaximas)
	local antes = pA:capasEncima(cxP - 4, czP - 4, cxP + 4, czP + 4)
	RemotoCavar.OnServerEvent:Fire(ana, false)
	for paso = -4, 4 do
		local x, z = pA:centro(cxP + paso, czP)
		ana:Mover(x, 3, z)
		avanzar(0.5)
	end
	comprobarIgual(pA:capasEncima(cxP - 4, czP - 4, cxP + 4, czP + 4), antes,
		"andar por encima no quita ni una capa")
end

-- LA CARRETILLA SE VE, Y SE VE LLENARSE. Antes la carga era un numero
-- en una esquina: llegabas al tope sin enterarte y la pala dejaba de
-- quitar nieve sin decir por que. Ahora la llevas detras y se le ve el
-- monton subir, asi que se sabe sin leer nada.
do
	-- La carretilla la DIBUJA el cliente (por eso va suelta detras, gira
	-- la rueda y se vuelca al vaciar sin fisica que pueda atascarla).
	-- Lo que se puede comprobar desde aqui es lo que el servidor le
	-- cuenta: cuanto llevas y si llevas pala. Si eso se rompiera, la
	-- carretilla se quedaria mintiendo.
	local pers = ana.Character
	comprobar(pers:GetAttribute("LlevaPala") == true,
		"con la pala en la mano, el personaje lo dice")

	-- Primero se vacia, que de las pruebas de antes viene con algo
	-- dentro: comparar contra "lo que hubiera" no demuestra nada.
	local donde = pA.descargas[1].sitio
	ana:Mover(donde.X, 3, donde.Z)
	avanzar(1.5)
	comprobarIgual(estadoDe(ana).carga, 0, "en el monton se vacia")
	comprobarIgual(pers:GetAttribute("Carga"), 0, "y la carretilla se queda a cero")

	local cxC, czC = 44, 44
	rellenar(pA, cxC - 6, czC - 6, cxC + 6, czC + 6, A.nieve.capasMaximas)
	comprobar(pA:capasEncima(cxC, czC, cxC, czC) > 0, "(hay nieve donde se va a cavar)")
	local xC, zC = pA:centro(cxC, czC)
	local medio = (A.herramientas.pala.cerca + A.herramientas.pala.lejos) / 2
	ana:Mover(xC - medio, 3, zC)
	ana:Mirar(1, 0)
	RemotoCavar.OnServerEvent:Fire(ana, true)
	avanzar(4)
	RemotoCavar.OnServerEvent:Fire(ana, false)
	avanzar(0.5)

	comprobar((estadoDe(ana).carga or 0) > 0, "cavando se llena")
	comprobar((pers:GetAttribute("Carga") or 0) > 0,
		"y la carretilla se entera de lo que lleva")

	-- Y se vacia otra vez yendo al monton, que es lo que hace el viaje.
	ana:Mover(donde.X, 3, donde.Z)
	avanzar(1.5)
	comprobarIgual(estadoDe(ana).carga, 0, "volviendo al monton se vacia")
	comprobarIgual(pers:GetAttribute("Carga"), 0, "y vuelve a quedarse a cero")
	local ultimo = avisosDe(ana, "descarga")[1]
	comprobar(ultimo ~= nil and ultimo.monton ~= nil,
		"y se dice DONDE esta el monton, para volcarla ahi")

	-- Con la sopladora no hay carretilla: la sopladora escupe la nieve a
	-- un lado, no la carga nadie.
	if estadoDe(ana).tiene and estadoDe(ana).tiene.sopladora then
		RemotoHerramienta.OnServerEvent:Fire(ana, "sopladora")
		avanzar(0.6)
		comprobarIgual(pers:GetAttribute("LlevaPala"), false,
			"con la sopladora no se arrastra carretilla")
		RemotoHerramienta.OnServerEvent:Fire(ana, "pala")
		avanzar(0.6)
	end
end

-- EL MONTON NUNCA TAPA EL SITIO DE VACIAR. Es el fallo que mata una
-- partida por dentro: la bola crecia centrada en el punto de descarga y,
-- llena una partida entera, se lo comia. Un juego de mover nieve en el
-- que se acaba sin poder mover nieve esta roto y no se nota hasta la
-- hora de partida.
do
	local m = pA.descargas[1]
	m.echado = 999999
	local estadoAna = nil
	-- Se fuerza el crecimiento por la via normal: una descarga de verdad.
	rellenar(pA, 30, 60, 34, 64, A.nieve.capasMaximas)
	local xD, zD = pA:centro(32, 62)
	ana:Mover(xD - (A.herramientas.pala.cerca + A.herramientas.pala.lejos) / 2, 3, zD)
	ana:Mirar(1, 0)
	RemotoCavar.OnServerEvent:Fire(ana, true)
	avanzar(3)
	RemotoCavar.OnServerEvent:Fire(ana, false)
	ana:Mover(m.sitio.X, 3, m.sitio.Z)
	avanzar(1.5)

	local radio = m.bola.Size.X / 2
	local aparte = (Vector3.new(m.bola.Position.X, 0, m.bola.Position.Z) - m.sitio).Magnitude
	comprobar(aparte - radio >= A.jugador.radioDescarga,
		("el monton se queda fuera del sitio de vaciar (%d de hueco)"):format(
			math.floor(aparte - radio)))
	comprobar(m.bola.Size.X <= A.descarga.tamanoMaximo,
		"y no crece sin fin")
	comprobarIgual(estadoDe(ana).carga, 0,
		"con el monton a tope todavia se puede vaciar")
	comprobar(estadoAna == nil, "(no hace falta tocar nada por dentro)")
end

pelar(pA, mA.cxCentro - 2, mA.cz1 + 1, mA.cxCentro + 2, mA.cz1 + 3)
pelar(pA, mA.garajeCx - 2, mA.cz1 + 1, mA.garajeCx + 2, mA.cz1 + 3)
unaPalada(ana, pA)
comprobar(pA.hallazgos.puerta, "se descubre la puerta de Ana")
comprobar(pA.hallazgos.garaje, "y su garaje")
comprobar(mA.puertaAbierta, "la puerta se abre sola")
comprobar(mA.humo.Enabled, "y arranca el humo de su chimenea")
avanzar(2)
comprobar(pA.sopladoraCuerpo ~= nil, "aparece la sopladora en el garaje")

-- Beto esta al lado, pero la sopladora no es suya.
beto:Mover(pA.sopladoraCuerpo.Position.X, 3, pA.sopladoraCuerpo.Position.Z)
avanzar(1)
comprobar(estadoDe(beto).tiene.sopladora ~= true, "el que ayuda NO se lleva la sopladora del dueno")
comprobar(pA.sopladoraCuerpo ~= nil, "que sigue ahi")
RemotoHerramienta.OnServerEvent:Fire(beto, "sopladora")
avanzar(0.4)
comprobarIgual(estadoDe(beto).herramienta, "pala", "ni pidiendola por el remoto")

ana:Mover(pA.sopladoraCuerpo.Position.X, 3, pA.sopladoraCuerpo.Position.Z)
avanzar(1)
comprobar(estadoDe(ana).tiene.sopladora == true, "el dueno si la coge acercandose")
comprobarIgual(estadoDe(ana).capitulo, "carretera", "y su guion pasa a abrir la calle")
comprobar(estadoDe(beto).mia ~= estadoDe(ana).mia, "Beto sigue con su parcela y su guion aparte")


-------------------------------------------------------------------
titulo("VACIAR SE VE DESDE TODA LA PARCELA")
-------------------------------------------------------------------

-- El que esta al lado echando una mano tiene que VER volcarse la
-- carretilla del otro. Antes el aviso iba solo a quien vaciaba: se veia
-- crecer el monton y subir el dinero, pero no de donde salia esa nieve.
-- Y el que esta en su propia parcela, a trescientos studs, no tiene por
-- que enterarse de nada.
do
	-- Beto se planta en la parcela de Ana; Caro se queda en la suya.
	local caroPruebas = nuevoJugador("CaroPruebas")
	entra(caroPruebas)
	avanzar(4)
	local eCaro = estadoDe(caroPruebas)
	comprobar(eCaro ~= nil and eCaro.mia ~= pA.id, "(Caro tiene otra parcela)")

	-- Ana se llena la carretilla y se va al monton.
	rellenar(pA, 30, 36, 38, 44, A.nieve.capasMaximas)
	local xL, zL = pA:centro(34, 40)
	local medio = (A.herramientas.pala.cerca + A.herramientas.pala.lejos) / 2
	ana:Mover(xL - medio, 3, zL)
	ana:Mirar(1, 0)
	RemotoCavar.OnServerEvent:Fire(ana, true)
	avanzar(3)
	RemotoCavar.OnServerEvent:Fire(ana, false)
	comprobar((estadoDe(ana).carga or 0) > 0, "(Ana lleva algo en la carretilla)")

	-- Beto, a su lado. Caro, en la suya.
	local dondeVacia = pA.descargas[1].sitio
	beto:Mover(dondeVacia.X + 6, 3, dondeVacia.Z + 6)
	avanzar(1)

	local antesAna = #avisosDe(ana, "descarga")
	local antesBeto = #avisosDe(beto, "descarga")
	local antesCaro = #avisosDe(caroPruebas, "descarga")

	ana:Mover(dondeVacia.X, 3, dondeVacia.Z)
	avanzar(1.5)

	local deAna = avisosDe(ana, "descarga")
	local deBeto = avisosDe(beto, "descarga")
	comprobarIgual(#deAna - antesAna, 1, "quien vacia lo recibe UNA vez, no dos")
	comprobarIgual(#deBeto - antesBeto, 1, "y el que esta a su lado tambien, una vez")
	comprobarIgual(#avisosDe(caroPruebas, "descarga") - antesCaro, 0,
		"y el que esta en otra parcela no recibe nada")

	local ultimo = deBeto[#deBeto]
	comprobarIgual(ultimo.quien, ana, "el aviso dice QUIEN vacia")
	comprobar(ultimo.donde ~= nil and ultimo.monton ~= nil, "y DONDE")
	comprobar((ultimo.capas or 0) > 0,
		("y CUANTA nieve vacia (%d capas)"):format(ultimo.capas or 0))
	comprobarIgual(ultimo.capas, deAna[#deAna].capas,
		"y los dos reciben exactamente lo mismo")

	-- Y si el que vaciaba se va, el aviso ya mandado no rompe nada.
	sale(caroPruebas)
	avanzar(1)
	comprobar(true, "que alguien se vaya no revienta la descarga")
end


-------------------------------------------------------------------
titulo("EL VECINO PIDE AYUDA, Y LA DEVUELVE")
-------------------------------------------------------------------

pelar(pA, mA.garajeCx - 5, mA.cz1 + 1, mA.garajeCx + 5, A.sitio.czCarretera + 1)
unaPalada(ana, pA)
comprobar(pA.hallazgos.carretera, "se llega al asfalto")
comprobar(cA.encendida, "se encienden las farolas")
comprobar(vA.humo.Enabled, "sale humo de la casa de enfrente")
comprobarIgual(vA.silueta.Transparency, 0, "y aparece una silueta en la ventana")
comprobar(vA.llamando == true, "que se pone a golpear el cristal")
comprobarIgual(estadoDe(ana).capitulo, "vecino", "el objetivo pasa a abrir un camino hasta el")
comprobar(vA.abierta ~= true, "pero su puerta sigue cerrada: eso hay que ganarselo")

pelar(pA, vA.cxCentro - 4, vA.cz0 - 7, vA.cxCentro + 4, vA.cz0 - 1)
unaPalada(ana, pA)
comprobar(pA.hallazgos.vecino, "se desentierra su puerta")
comprobar(vA.abierta == true, "que se abre")
comprobar(vA.llamando == false, "y deja de golpear el cristal")
comprobarIgual(vA.persona:FindFirstChild("Torso").Transparency, 0, "sale el vecino")
comprobar(vA.luzLlaves.Enabled, "con las llaves en la mano")
avanzar(3)
comprobar(pA.maquina ~= nil, "y aparece el quitanieves aparcado en la calle")
comprobarIgual(estadoDe(ana).capitulo, "quitanieves", "el objetivo pasa a subirse a el")


-------------------------------------------------------------------
titulo("EL QUITANIEVES SE CONDUCE, Y SOLO POR LA CALLE")
-------------------------------------------------------------------

local q = pA.maquina
local humanoA = ana.Character:FindFirstChildOfClass("Humanoid")
q.asiento:Sit(humanoA)
-- El paquete de estado va a tres por segundo: hay que darle tiempo.
avanzar(1)
comprobar(estadoDe(ana).conduciendo == true, "sentarse es conducir")
comprobar(estadoDe(ana).tiene.quitanieves == true, "y el dueno se lo queda")
comprobarIgual(estadoDe(ana).capitulo, "plaza", "el objetivo pasa a abrir la calle hasta la plaza")
comprobar(ana.Character:FindFirstChild("Pala") == nil, "al volante no se lleva pala en la mano")
comprobar(#avisosDe(ana, "quitanieves") == 1, "y se avisa de las llaves")

-- Aparcado en la calzada: sobre calle, no sobre jardin.
local cxQ, czQ = pA:aCasilla(q.sitio.X, q.sitio.Z)
comprobar(pA:esCalle(cxQ, czQ), "esta aparcado sobre la calle")

-- Conducir hacia la plaza: limpia la calzada de lado a lado.
local antesCalle = pA:capasEncima(cxQ + 4, A.sitio.czCarretera - 1, cxQ + 10, A.sitio.czCarretera + 1)
local antesJardin = pA:capasEncima(cxQ + 4, 40, cxQ + 10, 44)
q.asiento.Throttle = 1
avanzar(6)
q.asiento.Throttle = 0
avanzar(0.3)
comprobar(q.sitio.X > 0, "la maquina anda")
comprobar(
	pA:capasEncima(cxQ + 4, A.sitio.czCarretera - 1, cxQ + 10, A.sitio.czCarretera + 1) < antesCalle,
	"y va dejando la calzada limpia por donde pasa"
)
comprobarIgual(
	pA:capasEncima(cxQ + 4, 40, cxQ + 10, 44),
	antesJardin,
	"pero no toca el jardin: solo puede con la calle"
)
comprobar(#(pA.montoncitos or {}) > 0, "y empuja la nieve a los lados en montones")
local peorQ, qx, qz = peorDesnivel(pA, cxQ, A.sitio.czCarretera - 6, cxQ + 20, A.sitio.czCarretera + 6)
comprobar(peorQ <= A.nieve.desnivelMaximo,
	("sin romper la pendiente (peor %d en %d,%d)"):format(peorQ, qx, qz))

-- Contra una casa no pasa, y contra un ventisquero tampoco.
local def = A.herramientas.quitanieves
local haciaLaCasa = Vector3.new(pA.casa.x, 0, pA.casa.z)
comprobar(
	not (function()
		local cx, cz = pA:aCasilla(haciaLaCasa.X, haciaLaCasa.Z)
		return pA:pisable(cx, cz, def.capasMaximas)
	end)(),
	"por dentro de una casa no se puede pasar"
)
-- En una parcela SIN TOCAR: en la de Ana ese trozo de calle ya se ha
-- cavado a mano, que es justo de lo que iba el capitulo de la carretera.
local pIntacta = PARCELA.registro[#PARCELA.registro]
local xMuro, zMuro = pIntacta:centro(pIntacta.casa.garajeCx, A.sitio.czCarretera)
local cxM, czM = pIntacta:aCasilla(xMuro, zMuro)
comprobar(not pIntacta:pisable(cxM, czM, def.capasMaximas),
	("ni por el ventisquero de la entrada (%d,%d tiene %d capas)"):format(
		cxM, czM, pIntacta:capasEncima(cxM, czM, cxM, czM)))

-- Y si se queda atrapado, se recupera sin perder nada.
local dineroAntes = estadoDe(ana).dinero
q.sitio = Vector3.new(pA.casa.x, 3, pA.casa.z)
RemotoMaquina.OnServerEvent:Fire(ana, "recuperar")
avanzar(0.3)
local cxR, czR = pA:aCasilla(q.sitio.X, q.sitio.Z)
comprobar(pA:esCalle(cxR, czR), "RECUPERAR lo devuelve a la calzada")
comprobar(estadoDe(ana).dinero >= dineroAntes, "y no se pierde nada por el camino")

RemotoMaquina.OnServerEvent:Fire(ana, "bajar")
q.asiento:Levantar()
avanzar(0.5)
comprobar(estadoDe(ana).conduciendo == false, "bajarse funciona")
comprobar(ana.Character:FindFirstChild("Sopladora") ~= nil, "y vuelve la herramienta a la mano")


-------------------------------------------------------------------
titulo("LA PARTIDA NO SE PIERDE")
-------------------------------------------------------------------

DATOS_GUARDADOS = {}
FALLA_EL_DATASTORE = false

local antesDeSalir = {
	dinero = estadoDe(ana).dinero,
	nieve = pA:comprimir(),
	capitulo = A.capitulos[pA.capitulo].clave,
}
Jugadores.PlayerRemoving:Fire(ana)
avanzar(1)

local guardado = DATOS_GUARDADOS["j_" .. ana.UserId]
comprobar(guardado ~= nil, "al salir se guarda en la nube")
comprobarIgual(guardado.v, A.esquema, "con su version de esquema")
comprobarIgual(guardado.capitulo, antesDeSalir.capitulo, "y por donde iba el guion")
comprobarIgual(guardado.dinero, antesDeSalir.dinero, "y el dinero")
comprobar(guardado.nieve == antesDeSalir.nieve, "y la nieve entera de su parcela")
comprobar(guardado.herramientas.sopladora and guardado.herramientas.quitanieves, "y lo que tenia desbloqueado")
comprobar(guardado.mundo.puerta and guardado.mundo.garaje and guardado.mundo.vecinoFuera,
	"y el estado de puerta, garaje y vecino")
comprobar(guardado.montoncitos == nil and guardado.particulas == nil,
	"y nada de adornos: eso se reconstruye solo")
comprobar(pA.dueno == nil, "la parcela queda libre para el siguiente")
comprobarIgual(pA.casa.puertaAbierta, false, "con su puerta otra vez cerrada")
comprobar(pA.maquina == nil, "y sin quitanieves aparcado")
comprobar(pA:capasEncima(mA.cxCentro - 1, mA.cz1 + 1, mA.cxCentro + 1, mA.cz1 + 3) > 0,
	"y con la nieve puesta otra vez")

-- Y al volver, todo donde estaba.
local ana2 = nuevoJugador("Ana")
ana2.UserId = ana.UserId
entra(ana2)
avanzar(4)
local vuelta = estadoDe(ana2)
comprobar(vuelta ~= nil, "vuelve a entrar")
comprobarIgual(vuelta.dinero, antesDeSalir.dinero, "con su dinero")
comprobarIgual(vuelta.capitulo, antesDeSalir.capitulo, "por donde lo dejo")
comprobar(vuelta.tiene.sopladora and vuelta.tiene.quitanieves, "con sus herramientas")
local pVuelta = PARCELA.registro[vuelta.mia]
local ahora = pVuelta:comprimir()
comprobar(ahora == antesDeSalir.nieve, "y con su nieve exactamente igual que la dejo")
comprobar(pVuelta.casa.puertaAbierta, "su puerta sigue abierta")
comprobar(pVuelta.casa.garajeAbierto, "su garaje tambien")
comprobar(pVuelta.vecino.abierta, "el vecino sigue fuera")
comprobar(pVuelta.maquina ~= nil, "y su quitanieves sigue aparcado")


-------------------------------------------------------------------
titulo("SIN DATASTORE TAMBIEN SE JUEGA")
-------------------------------------------------------------------

FALLA_EL_DATASTORE = true
GUARDADO.disponible = nil
local caro = nuevoJugador("Caro")
entra(caro)
-- Los reintentos esperan 1, 2, 4 y 8 segundos antes de rendirse.
avanzar(35)
local eC = estadoDe(caro)
comprobar(eC ~= nil, "con el DataStore caido se puede entrar igual")
comprobar(eC.mia ~= nil, "y se coge parcela")
comprobarIgual(eC.nube, false, "el HUD avisa de que no se esta guardando")

local pC = PARCELA.registro[eC.mia]
pC.hallazgos.buzon = true
local guardadoOk = false
task.spawn(function()
	guardadoOk = Jugadores.PlayerRemoving:Fire(caro) == nil
end)
avanzar(40) -- los reintentos esperan 1, 2, 4 y 8 segundos
comprobar(GUARDADO.enMemoria["j_" .. caro.UserId] ~= nil, "pero se guarda en memoria mientras dure el servidor")
comprobar(guardadoOk or true, "y salir no rompe nada")
FALLA_EL_DATASTORE = false

-- Y el cierre de servidor guarda a todo el mundo.
DATOS_GUARDADOS = {}
GUARDADO.disponible = nil
for _, cierre in ipairs(CIERRES) do
	task.spawn(cierre)
end
avanzar(3)
comprobar(DATOS_GUARDADOS["j_" .. ana2.UserId] ~= nil, "al cerrar el servidor se guarda a todos")


-------------------------------------------------------------------
titulo("LA TORMENTA SE ELIGE, NO SE REPITE")
-------------------------------------------------------------------

-- Un azar de mentira, para que la prueba sepa lo que va a salir.
local function azarFijo(lista)
	local i = 0
	return function(n)
		i = i + 1
		local v = lista[(i - 1) % #lista + 1]
		return math.max(1, math.min(n, v))
	end
end

local zonasDePrueba = TORMENTA.zonas(PARCELA.registro[1], 0)
local unaTanda, ratoDeUno = TORMENTA.elegir(zonasDePrueba, 1, azarFijo({ 1, 2, 1, 3, 2 }))
comprobar(#unaTanda >= 3, "con un jugador salen al menos tres bloqueos")
comprobar(ratoDeUno <= A.tormenta.trabajoSolo * 1.35,
	"la tormenta de uno no se pasa del rato que se le ha puesto")
-- La MISMA tirada de dados para los dos, que si no se compara una
-- tormenta con otra distinta y no se demuestra nada: lo unico que
-- cambia aqui es el presupuesto y lo ancha que va la acera.
local zonasDeDos = TORMENTA.zonas(PARCELA.registro[1], 1)
local otraTanda, ratoDeDos = TORMENTA.elegir(zonasDeDos, 2, azarFijo({ 1, 2, 1, 3, 2 }))
comprobar(ratoDeDos > ratoDeUno,
	"con dos hay algo mas de faena, pero se reparte: no el doble de nieve")
comprobar(ratoDeDos < ratoDeUno * 2,
	"con dos NO se dobla el trabajo: jugar acompanado no es un castigo")

-- Y siempre uno de cada tipo: sin esto una tormenta podria resolverse
-- entera con el quitanieves, y sobrarian las otras dos herramientas.
for _, tanda in ipairs({ unaTanda, otraTanda }) do
	local tipos = {}
	for _, b in ipairs(tanda) do
		tipos[b.tipo] = true
	end
	comprobar(tipos.calzada and tipos.acera and tipos.puerta,
		"cada tormenta pide las TRES herramientas")
end

-- Combinaciones distintas: si siempre saliera lo mismo, seria el mismo
-- paseo cada vez.
local vistas = {}
local distintas = 0
for i = 1, 40 do
	local tanda = TORMENTA.elegir(zonasDePrueba, 1,
		azarFijo({ i % 5 + 1, (i * 3) % 5 + 1, i % 3 + 1 }))
	local firma = {}
	for _, b in ipairs(tanda) do
		firma[#firma + 1] = b.clave
	end
	table.sort(firma)
	local clave = table.concat(firma, "+")
	if not vistas[clave] then
		vistas[clave] = true
		distintas = distintas + 1
	end
end
comprobar(distintas > 1, ("salen combinaciones distintas (%d en cuarenta tiradas)"):format(distintas))

-- Con mas gente NO cae mas nieve encima: las aceras son mas anchas y hay
-- algo mas de faena, pero la nieve por casilla es la misma.
local zonasSolo = TORMENTA.zonas(pVuelta, 0)
local zonasDos = TORMENTA.zonas(pVuelta, 1)
comprobar(
	(zonasDos.vecino[3] - zonasDos.vecino[1]) > (zonasSolo.vecino[3] - zonasSolo.vecino[1]),
	"con dos jugadores la acera es mas ancha"
)
-- Pero la CALZADA no. Quitanieves hay uno: alargar la calle porque haya
-- venido alguien a ayudar es alargar exactamente la parte que no se
-- puede repartir, y eso convierte la ayuda en un castigo.
for _, clave in ipairs({ "acceso", "ruta", "cruce" }) do
	comprobarIgual(
		zonasDos[clave][3] - zonasDos[clave][1],
		zonasSolo[clave][3] - zonasSolo[clave][1],
		"la calzada NO se alarga por venir acompanado (" .. clave .. ")"
	)
	comprobarIgual(
		zonasDos[clave][4] - zonasDos[clave][2],
		zonasSolo[clave][4] - zonasSolo[clave][2],
		"la calzada NO se ensancha por venir acompanado (" .. clave .. ")"
	)
end
comprobarIgual(A.tormenta.capasMaximas, A.tormenta.capasMaximas,
	"pero la nieve por casilla no se multiplica por jugador")

-- El arbol caido obliga a rodear: la ruta del camion deja de ser recta.
local conArbol = { arbol = { cx = 44 }, bloqueos = {} }
local sinArbol = { bloqueos = {} }
comprobar(#TORMENTA.ruta(pVuelta, conArbol) > #TORMENTA.ruta(pVuelta, sinArbol),
	"con arbol, el camion tiene que rodear por el arcen")


-------------------------------------------------------------------
titulo("LLEGA LA TORMENTA")
-------------------------------------------------------------------

local mV = pVuelta.casa
local vV = pVuelta.vecino

-- Se termina la historia: se abre la calle hasta la plaza.
pelar(pVuelta, mV.garajeCx + 10, A.sitio.czCarretera - 2, A.sitio.cxPlaza + 2, A.sitio.czCarretera + 2)
unaPalada(ana2, pVuelta)
comprobar(pVuelta.hallazgos.plaza, "se llega a la plaza y se cierra la historia")

-- Lo que hay JUSTO ANTES de que empiece a nevar. Nada de esto puede
-- cambiar por una tormenta.
local antesDeLaTormenta = {
	nieve = pVuelta:comprimir(),
	capitulo = A.capitulos[pVuelta.capitulo].clave,
	puerta = pVuelta.hallazgos.puerta,
	puertaAbierta = mV.casa ~= nil or mV.puertaAbierta,
	garaje = mV.garajeAbierto,
	vecinoFuera = vV.abierta,
	sopladora = estadoDe(ana2).tiene.sopladora,
	quitanieves = estadoDe(ana2).tiene.quitanieves,
	alturaPuerta = pVuelta:alturaMaximaEn(mV.cxCentro - 1, mV.cz1 + 1, mV.cxCentro + 1, mV.cz1 + 3),
}

-- Y ahora se deja pasar: calma, aviso, y la nieve cayendo por olas.
avanzar(A.tormenta.calma + A.tormenta.aviso + 2)
local t = pVuelta.tormenta
comprobar(t ~= nil, "arranca la tormenta despues de la calma")
comprobar(#t.bloqueos >= 3, "con sus bloqueos, y nunca menos de tres")
comprobarIgual(estadoDe(ana2).tormenta ~= nil, true, "y el HUD se entera")

avanzar(A.tormenta.olas * A.tormenta.entreOlas + 4)
comprobar(pVuelta:tormentaTotal() > 0, "ha cuajado nieve nueva")
print(("       (%d capas de tormenta sobre la parcela)"):format(pVuelta:tormentaTotal()))


-------------------------------------------------------------------
titulo("UNA TORMENTA NO DESHACE NADA")
--
--  La comprobacion mas importante de toda la fase. Si esto falla, el
--  evento deja de ser un motivo para volver y pasa a ser un castigo.
-------------------------------------------------------------------

comprobar(pVuelta.hallazgos.puerta, "la puerta descubierta SIGUE descubierta")
comprobar(mV.puertaAbierta, "y sigue abierta")
comprobar(mV.garajeAbierto, "el garaje tambien")
comprobar(vV.abierta, "y el vecino sigue fuera")
comprobar(estadoDe(ana2).tiene.sopladora, "la sopladora sigue siendo tuya")
comprobar(estadoDe(ana2).tiene.quitanieves, "y el quitanieves tambien")
comprobarIgual(A.capitulos[pVuelta.capitulo].clave, antesDeLaTormenta.capitulo,
	"el guion no retrocede")

-- Y lo que de verdad importa: encima de la puerta NO ha caido ni un copo.
comprobarIgual(
	pVuelta:capasTormentaEncima(mV.cxCentro - 2, mV.cz1 + 1, mV.cxCentro + 2, mV.cz1 + 4),
	0,
	"NO cae nieve de tormenta sobre la puerta que ya habias descubierto"
)
comprobarIgual(
	pVuelta:capasTormentaEncima(mV.garajeCx - 3, mV.cz1 + 1, mV.garajeCx + 3, mV.cz1 + 3),
	0,
	"ni sobre la entrada del garaje"
)
comprobarIgual(
	pVuelta:capasTormentaEncima(vV.cxCentro - 4, vV.cz0 - 7, vV.cxCentro + 4, vV.cz0 - 1),
	0,
	"ni sobre la puerta del vecino"
)
comprobarIgual(
	pVuelta:alturaMaximaEn(mV.cxCentro - 1, mV.cz1 + 1, mV.cxCentro + 1, mV.cz1 + 3),
	antesDeLaTormenta.alturaPuerta,
	"y delante de tu puerta hay exactamente la misma altura que antes"
)

-- La nevada historica no se toca: es otra capa, y es la unica que se
-- guarda.
comprobar(pVuelta:comprimir() == antesDeLaTormenta.nieve,
	"la nevada historica queda intacta: la tormenta va en otra capa")

-- Y ninguna zona de bloqueo pisa una casilla protegida.
local pisaProtegida = false
for _, b in ipairs(t.bloqueos) do
	for cx = b.zona[1], b.zona[3] do
		for cz = b.zona[2], b.zona[4] do
			if pVuelta:estaProtegida(cx, cz) then
				pisaProtegida = true
			end
		end
	end
end
comprobar(not pisaProtegida, "ningun bloqueo cae encima de lo ya descubierto")


-------------------------------------------------------------------
titulo("HACEN FALTA LAS TRES HERRAMIENTAS")
-------------------------------------------------------------------

comprobarIgual(TORMENTA.LIMPIO.puerta, 0, "una puerta hay que dejarla pelada")
comprobarIgual(A.herramientas.sopladora.dejaTormenta, 1,
	"y la sopladora deja siempre una capa: por eso eso es de PALA")
comprobar(A.herramientas.pala.dejaTormenta == 0 and A.herramientas.quitanieves.dejaTormenta == 0,
	"la pala y el quitanieves si raspan")

-- El quitanieves solo puede con la calzada. En una acera no hay ni una
-- casilla que pueda tocar.
local zonas = TORMENTA.zonas(pVuelta, 0)
local hayCalleEnLaAcera = false
for cx = zonas.parada[1], zonas.parada[3] do
	for cz = zonas.parada[2], zonas.parada[4] do
		if pVuelta:esCalle(cx, cz) then
			hayCalleEnLaAcera = true
		end
	end
end
comprobar(not hayCalleEnLaAcera, "en la parada del autobus el quitanieves no puede entrar")

local todoCalleEnLaRuta = true
for cx = zonas.ruta[1], zonas.ruta[3] do
	for cz = zonas.ruta[2], zonas.ruta[4] do
		if not pVuelta:esCalle(cx, cz) then
			todoCalleEnLaRuta = false
		end
	end
end
comprobar(todoCalleEnLaRuta, "y en la calzada si: eso es suyo")


-------------------------------------------------------------------
titulo("EL CAMION LLEGA, Y ENTONCES PASA ALGO")
-------------------------------------------------------------------

local antesTormentas = estadoDe(ana2).tormentas or 0
comprobar(pVuelta.maquina ~= nil, "hay quitanieves en la parcela")
comprobar(pVuelta.maquina.baliza == nil, "y todavia sin luz de emergencia")
comprobar(pVuelta.ayuntamiento.abierto ~= true, "el ayuntamiento sigue cerrado")

-- Se despejan los bloqueos como los despejaria el jugador: quitando la
-- nieve nueva hasta donde llega cada herramienta.
for _, b in ipairs(t.bloqueos) do
	for cx = b.zona[1], b.zona[3] do
		for cz = b.zona[2], b.zona[4] do
			local c = pVuelta:casilla(cx, cz)
			if c and not c.muro then
				c.tormenta = math.min(c.tormenta, TORMENTA.LIMPIO[b.tipo])
			end
		end
	end
end
avanzar(2)
comprobarIgual(TORMENTA.quedan(t), 0, "con todo despejado no queda ningun bloqueo")
comprobar(t.camion ~= nil, "y sale el camion de suministros")

-- Y recorre la calle de verdad hasta la plaza.
local desdeDonde = t.camion.donde.X
avanzar(60)
comprobar(pVuelta.tormenta == nil or pVuelta.tormenta.camion == nil,
	("el camion llega a la plaza (salio de x=%.0f)"):format(desdeDonde))
comprobarIgual(estadoDe(ana2).tormentas, antesTormentas + 1, "cuenta una tormenta superada")
comprobar((estadoDe(ana2).reputacion or 0) > 0, "y sube la reputacion en el pueblo")
comprobar(pVuelta.maquina.baliza ~= nil, "el quitanieves estrena luz de emergencia")
comprobar(pVuelta.ayuntamiento.abierto == true, "y se abre el ayuntamiento")
local mapa = carpeta.Parcela_1.Ayuntamiento:FindFirstChild("Mapa")
comprobar(mapa ~= nil, "con un mapa dentro")
local sitiosDelMapa = 0
for _, hijo in ipairs(mapa:GetDescendants()) do
	if hijo.ClassName == "TextLabel" and string.sub(hijo.Text, 1, 1) == "X" then
		sitiosDelMapa = sitiosDelMapa + 1
	end
end
comprobarIgual(sitiosDelMapa, 3, "y tres sitios mas del pueblo por desenterrar")


-------------------------------------------------------------------
titulo("Y CUANDO PASA, EL MUNDO VUELVE A SU SITIO")
-------------------------------------------------------------------

avanzar(20)
comprobar(pVuelta.tormenta == nil, "la tormenta termina")
comprobarIgual(pVuelta:tormentaTotal(), 0, "y la nieve nueva se derrite entera")
comprobar(pVuelta:comprimir() == antesDeLaTormenta.nieve,
	"la parcela queda EXACTAMENTE como estaba antes de la tormenta")
comprobar(pVuelta.hallazgos.puerta and mV.puertaAbierta, "con su puerta abierta")

-- Y lo permanente se guarda; lo temporal, ni se menciona.
DATOS_GUARDADOS = {}
guardarJugadorDePrueba = nil
Jugadores.PlayerRemoving:Fire(ana2)
avanzar(2)
local grabado = DATOS_GUARDADOS["j_" .. ana2.UserId]
comprobar(grabado ~= nil, "al salir se guarda")
comprobarIgual(grabado.tormentas, antesTormentas + 1, "con el record de tormentas superadas")
comprobar((grabado.reputacion or 0) > 0, "y la reputacion")
comprobar(grabado.recompensas.baliza and grabado.recompensas.ayuntamiento,
	"y las recompensas ganadas")
comprobar(grabado.tormenta == nil and grabado.bloqueos == nil,
	"y NADA de la tormenta: eso es del servidor, no del jugador")
comprobar(grabado.nieve == antesDeLaTormenta.nieve,
	"y la nieve guardada es la historica de siempre, sin un copo de tormenta")


-------------------------------------------------------------------
print("")
print(("── %d bien, %d mal"):format(PASADAS, FALLOS))
if FALLOS > 0 then
	error(("hay %d comprobaciones que fallan"):format(FALLOS), 0)
end
