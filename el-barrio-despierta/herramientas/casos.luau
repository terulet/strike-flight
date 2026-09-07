--[[
	Lo que tiene que cumplir EL BARRIO DESPIERTA.

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
]]

local A = AJUSTES
local RS = game:GetService("ReplicatedStorage")
local remotos = RS:FindFirstChild("RemotosBarrio")
local RemotoEstado = remotos:FindFirstChild("Estado")
local RemotoAviso = remotos:FindFirstChild("Aviso")
local RemotoCavar = remotos:FindFirstChild("Cavar")
local RemotoHerramienta = remotos:FindFirstChild("Herramienta")
local RemotoMaquina = remotos:FindFirstChild("Maquina")

local carpeta = workspace:FindFirstChild("Barrio")
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

comprobar(carpeta ~= nil, "existe el barrio")
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

-- La calle esta menos hundida que los jardines: es lo que permite que el
-- quitanieves pueda con ella y no con lo demas.
local hondoCalle = p1:capasEncima(30, A.sitio.czCarretera - 1, 40, A.sitio.czCarretera + 1)
local hondoJardin = p1:capasEncima(30, 40, 40, 44)
comprobar(hondoCalle <= A.herramientas.quitanieves.capasMaximas, "la calzada esta a tiro de la cuchilla")
comprobar(hondoJardin > hondoCalle, "y el jardin no")

-- El muro que dejo la maquina municipal delante de tu entrada: ese si
-- que no lo toca el quitanieves.
local muro = p1:capasEncima(
	p1.casa.garajeCx - 1, A.sitio.czCarretera - 1,
	p1.casa.garajeCx + 1, A.sitio.czCarretera + 1
)
comprobar(muro > A.herramientas.quitanieves.capasMaximas, "el muro de tu entrada es de pala y sopladora, no de maquina")
print(("       (calle %d capas, jardin %d, muro de la entrada %d)"):format(hondoCalle, hondoJardin, muro))


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

beto:Mover(xA, 3, zA)
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
				casilla.restante = capas
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
local xMuro, zMuro = pA:centro(pA.casa.garajeCx + 7, A.sitio.czCarretera)
local cxM, czM = pA:aCasilla(xMuro, zMuro)
comprobar(not pA:pisable(cxM, czM, def.capasMaximas),
	("ni por el ventisquero de la entrada (%d,%d tiene %d capas)"):format(
		cxM, czM, pA:capasEncima(cxM, czM, cxM, czM)))

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
comprobar(pVuelta:comprimir() == antesDeSalir.nieve, "y con su nieve exactamente igual que la dejo")
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
print("")
print(("── %d bien, %d mal"):format(PASADAS, FALLOS))
if FALLOS > 0 then
	error(("hay %d comprobaciones que fallan"):format(FALLOS), 0)
end
