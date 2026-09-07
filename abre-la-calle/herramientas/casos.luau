--[[
	Lo que tiene que cumplir ABRE LA CALLE.

	Tres cosas se comprueban aqui por encima de todo, porque si alguna se
	rompe el juego se rompe con ella:

	  1. LA PENDIENTE.  Pase lo que pase, dos casillas vecinas no acaban
	     con mas desnivel del permitido. Sin esto hay pozos verticales de
	     los que no se sale.

	  2. LAS DOS HERRAMIENTAS.  La pala llega al suelo; la sopladora barre
	     ancho por delante pero deja un colchon y NO descubre nada. Si las
	     dos hicieran lo mismo, la sopladora seria una pala mas rapida y
	     sobraria.

	  3. CAVAR ES UNA ACCION.  Quieto y sin pulsar no pasa nada, con
	     ninguna de las dos.

	Y ademas: que la cadena de hallazgos salte entera y en orden, y que el
	mundo reaccione de verdad (puerta abierta, humo, garaje, sopladora).
]]

local A = AJUSTES
local RS = game:GetService("ReplicatedStorage")
local remotos = RS:FindFirstChild("RemotosCalle")
local RemotoEstado = remotos:FindFirstChild("Estado")
local RemotoAviso = remotos:FindFirstChild("Aviso")
local RemotoCavar = remotos:FindFirstChild("Cavar")
local RemotoHerramienta = remotos:FindFirstChild("Herramienta")

local carpeta = workspace:FindFirstChild("Juego")
local CELDA = A.nieve.celda

local OCHO = {
	{ 1, 0 }, { -1, 0 }, { 0, 1 }, { 0, -1 },
	{ 1, 1 }, { 1, -1 }, { -1, 1 }, { -1, -1 },
}

-- Se rehace una parcela igual que la del mundo para poder mirarla por
-- dentro: el modelo vive aparte justamente para esto.
local function parcelaDePrueba(id)
	local p = PARCELA.nueva(id or 99, Vector3.new(4000, 0, 4000))
	p:generar(function()
		return A.nieve.capasMaximas
	end)
	return p
end

local function peorDesnivel(parcela)
	local peor, dondeX, dondeZ = 0, -1, -1
	for cx = 0, parcela.ancho - 1 do
		for cz = 0, parcela.largo - 1 do
			local c = parcela:casilla(cx, cz)
			if c and not c.muro then
				for _, d in ipairs(OCHO) do
					local v = parcela:casilla(cx + d[1], cz + d[2])
					if v and not v.muro then
						local diferencia = math.abs(c.restante - v.restante)
						if diferencia > peor then
							peor, dondeX, dondeZ = diferencia, cx, cz
						end
					end
				end
			end
		end
	end
	return peor, dondeX, dondeZ
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
titulo("LA PARCELA NACE BIEN")
-------------------------------------------------------------------

comprobar(carpeta ~= nil, "existe el mundo")
local grupo = carpeta:FindFirstChild("Parcela_1")
comprobar(grupo ~= nil, "y su primera parcela")
comprobarIgual(grupo:GetAttribute("casillas"), A.parcela.ancho * A.parcela.largo, "con todas sus casillas")
comprobar((grupo:GetAttribute("capas") or 0) > 0, "y con nieve encima")
print(("       (la parcela tiene %d capas de nieve en total)"):format(grupo:GetAttribute("capas")))

local prueba = parcelaDePrueba()
local peor = peorDesnivel(prueba)
comprobar(peor <= A.nieve.desnivelMaximo, "recien generada, ninguna vecina se pasa de una capa")

comprobar(rellenosDe("Snow") > 0, "la nieve es terreno, no piezas")

local p1 = PARCELA.registro[1]
comprobar(p1 ~= nil, "la parcela del mundo se puede mirar por dentro")

-- La calle tiene que estar MAS enterrada que el resto: es lo que la hace
-- sentirse como una nevada de las que salen en las noticias.
local hondoCalle = p1:capasEncima(
	p1.casa.garajeCx - 1, A.sitio.czCarretera - 1,
	p1.casa.garajeCx + 1, A.sitio.czCarretera + 1
)
local hondoJardin = p1:capasEncima(4, 30, 8, 34)
comprobar(hondoCalle >= A.sitio.capasCarretera, "sobre la calzada hay la nevada gorda")
comprobar(hondoCalle > hondoJardin, "y la calle esta mas enterrada que el jardin")
print(("       (calle %d capas, jardin %d capas)"):format(hondoCalle, hondoJardin))


-------------------------------------------------------------------
titulo("LA REGLA DE LA PENDIENTE AGUANTA CAVANDO")
-------------------------------------------------------------------

-- Se cava a lo bestia, a lo tonto y por todas partes, y despues se mira.
local excavadas = 0
for _ = 1, 40 do
	for cx = 0, prueba.ancho - 1 do
		for cz = 0, prueba.largo - 1 do
			if prueba:excavar(cx, cz) then
				excavadas = excavadas + 1
			end
		end
	end
end
comprobar(excavadas > 0, "se puede excavar")
local peorTras = peorDesnivel(prueba)
comprobar(peorTras <= A.nieve.desnivelMaximo, "y tras miles de paladas sigue sin haber saltos de mas de una capa")

-- El caso feo: alguien insiste en la misma casilla para abrir un pozo.
local pozo = parcelaDePrueba(97)
local intentos = 0
for _ = 1, 200 do
	if pozo:excavar(10, 10) then
		intentos = intentos + 1
	end
end
comprobarIgual(
	intentos,
	A.nieve.desnivelMaximo,
	"insistiendo en una sola casilla se baja el desnivel permitido y ni una capa mas: no hay pozo vertical"
)
comprobar(peorDesnivel(pozo) <= A.nieve.desnivelMaximo, "y la pendiente sigue entera")

-- Y en diagonal, que es por donde se colaba con cuatro vecinas.
local diagonal = parcelaDePrueba(96)
diagonal:excavar(10, 10)
for _ = 1, 20 do
	diagonal:excavar(11, 11)
end
comprobar(peorDesnivel(diagonal) <= A.nieve.desnivelMaximo, "tampoco por las diagonales")


-------------------------------------------------------------------
titulo("LA PALA LLEGA AL SUELO, LA SOPLADORA NO")
--
--  Esta es LA diferencia entre las dos, y va en el modelo, no en la
--  animacion: la sopladora se para en un colchon de nieve. Por eso
--  descubrir siempre es cosa de la pala.
-------------------------------------------------------------------

local conPala = parcelaDePrueba(95)
for _ = 1, 40 do
	for cx = 0, conPala.ancho - 1 do
		for cz = 0, conPala.largo - 1 do
			conPala:excavar(cx, cz, A.herramientas.pala.dejaCapas)
		end
	end
end
local pelado = conPala:capasEncima(0, 0, conPala.ancho - 1, conPala.largo - 1)
comprobarIgual(pelado, 0, "con la pala se llega a la tierra")

local conSopladora = parcelaDePrueba(94)
for _ = 1, 40 do
	for cx = 0, conSopladora.ancho - 1 do
		for cz = 0, conSopladora.largo - 1 do
			conSopladora:excavar(cx, cz, A.herramientas.sopladora.dejaCapas)
		end
	end
end
local masBajo = A.nieve.capasMaximas
for cx = 0, conSopladora.ancho - 1 do
	for cz = 0, conSopladora.largo - 1 do
		local c = conSopladora:casilla(cx, cz)
		if c.restante < masBajo then
			masBajo = c.restante
		end
	end
end
comprobarIgual(
	masBajo,
	A.herramientas.sopladora.dejaCapas,
	"la sopladora deja siempre su colchon y NUNCA raspa el suelo"
)
comprobar(peorDesnivel(conSopladora) <= A.nieve.desnivelMaximo, "y respeta la pendiente igual que la pala")
comprobar(
	A.herramientas.sopladora.ancho > A.herramientas.pala.radio * 2,
	"a cambio barre una franja mas ancha que la cuchara de la pala"
)


-------------------------------------------------------------------
titulo("LA CASA MERECE LA PENA")
-------------------------------------------------------------------

local casaGrupo = grupo:FindFirstChild("Casa")
comprobar(casaGrupo ~= nil, "la casa esta construida")
for _, pieza in ipairs({
	"PorcheSuelo", "PorcheTejado", "GarajeSuelo", "GarajePuerta",
	"Caballete", "Corona", "Farol", "Puerta", "Recibidor", "Chimenea",
}) do
	comprobar(casaGrupo:FindFirstChild(pieza) ~= nil, "la casa tiene " .. pieza)
end

local chimenea = casaGrupo:FindFirstChild("Chimenea")
local pasos = 0
local encendidas = 0
local tejadoMasAlto = 0
for _, pieza in ipairs(casaGrupo:GetChildren()) do
	local nombre = pieza.Name
	if string.sub(nombre, 1, 11) ~= "TejadoNieve" and string.sub(nombre, 1, 6) == "Tejado" then
		pasos = pasos + 1
	end
	if string.sub(nombre, 1, 6) == "Tejado" or nombre == "Caballete" then
		local arriba = pieza.Position.Y + pieza.Size.Y / 2
		if arriba > tejadoMasAlto then
			tejadoMasAlto = arriba
		end
	end
end
for _, pieza in ipairs(casaGrupo:GetDescendants()) do
	if pieza.ClassName == "PointLight" then
		encendidas = encendidas + 1
	end
end
comprobarIgual(pasos, A.casa.pasosTejado, "y su cubierta inclinada a escalones")
comprobar(encendidas >= 3, "con luces calidas encendidas dentro")

-- Lo que asoma y lo que no al empezar: de esto depende que los hallazgos
-- no sean mentira.
local nieveGeneral = A.nieve.capasMaximas * A.nieve.capa
-- Se mide contra el ventisquero en el que esta clavada, no contra la
-- nieve de en medio del campo: si no asoma sobre SU monton, no se ve.
comprobar(
	chimenea.Size.Y > A.nieve.capasContraLaCasa * A.nieve.capa,
	"la chimenea asoma sobre el ventisquero de la casa: es el unico faro que hay"
)
comprobar(
	tejadoMasAlto < nieveGeneral,
	"y el tejado NO asoma: si asomara, su hallazgo llegaria tarde y seria mentira"
)

-- Y la calle, con su vecino enfrente.
local calleGrupo = grupo:FindFirstChild("Calle")
comprobar(calleGrupo ~= nil, "la calle esta construida debajo de la nieve")
for _, pieza in ipairs({ "Carretera", "Entrada", "Senal", "Buzon" }) do
	comprobar(calleGrupo:FindFirstChild(pieza) ~= nil, "la calle tiene " .. pieza)
end
local vecinoGrupo = grupo:FindFirstChild("Vecino")
comprobar(vecinoGrupo ~= nil, "y hay una casa enfrente")
comprobar(vecinoGrupo and vecinoGrupo:FindFirstChild("Puerta") ~= nil, "con su puerta mirando hacia ti")
comprobar(p1.vecino.zFachada < p1.vecino.z, "que es la cara que da a la calle")

-- Al empezar, ni humo ni farolas: el vecino todavia no existe para ti.
comprobar(p1.casa.humo.Enabled == false, "al empezar tu chimenea no humea: la casa esta muerta")
comprobar(p1.vecino.humo.Enabled == false, "y la de enfrente tampoco")
comprobar(p1.sopladoraCuerpo == nil, "y la sopladora todavia no existe en el mundo")


-------------------------------------------------------------------
titulo("CAVAR ES UNA ACCION, NO UN AUTOMATISMO")
-------------------------------------------------------------------

local ana = nuevoJugador("Ana")
entra(ana)
avanzar(0.5)
ana:LoadCharacter()
avanzar(0.5)

local e = estadoDe(ana)
comprobar(e ~= nil, "el cliente recibe el estado")
comprobarIgual(e.carga, 0, "empieza con la carretilla vacia")
comprobarIgual(e.capitulo, "puerta", "y con el primer capitulo puesto")
comprobarIgual(
	e.capasObjetivo,
	A.nieve.capasContraLaCasa,
	"el HUD nace con las capas REALES que hay delante de la puerta, sin saltos"
)
comprobar(e.tieneSopladora == false, "y sin sopladora: eso se encuentra, no se regala")

-- La cantera: un trozo de llano lejos de todo donde siempre se puede
-- cavar. Se usa para disparar comprobaciones sin depender de la casa.
local CANTERA_X, CANTERA_Z = 8 * CELDA + 2, 34 * CELDA + 2

ana:Mover(CANTERA_X, 3, CANTERA_Z)
-- Quieto encima de la nieve y sin pulsar: no puede pasar nada.
avanzar(2)
e = estadoDe(ana)
comprobarIgual(e.carga, 0, "quieto encima de la nieve NO se excava solo")

RemotoCavar.OnServerEvent:Fire(ana, true)
avanzar(2)
e = estadoDe(ana)
comprobar(e.carga > 0, "manteniendo pulsado si se excava")
comprobar(rellenosDe("Air") > 0, "y se abre el terreno de verdad")

RemotoCavar.OnServerEvent:Fire(ana, false)
avanzar(0.5) -- que llegue un paquete fresco: el ultimo era de antes de soltar
local alSoltar = estadoDe(ana).carga
avanzar(2)
comprobarIgual(estadoDe(ana).carga, alSoltar, "y al soltar, se para en seco")

-- Y moverse sin pulsar tampoco cava: no vale correr por encima.
for _ = 1, 8 do
	ana:Mover(CANTERA_X + math.random(-20, 20), 3, CANTERA_Z + math.random(-20, 20))
	avanzar(0.3)
end
comprobarIgual(estadoDe(ana).carga, alSoltar, "corriendo por encima de la nieve tampoco se recoge nada")

-- La carretilla: se llena cavando y se vacia en el monton mas cercano.
RemotoCavar.OnServerEvent:Fire(ana, true)
for _ = 1, 80 do
	local est = estadoDe(ana)
	if est and est.carga >= est.capacidad then
		break
	end
	ana:Mover(CANTERA_X + math.random(-24, 24), 3, CANTERA_Z + math.random(-24, 24))
	avanzar(0.4)
end
RemotoCavar.OnServerEvent:Fire(ana, false)
avanzar(0.4)
e = estadoDe(ana)
comprobar(e.carga > 0, "la carretilla se llena cavando alrededor")

comprobar(#p1.descargas >= 2, "hay mas de un monton donde vaciar: el viaje nunca es el juego")
local cerca = p1.descargas[1]
for _, mon in ipairs(p1.descargas) do
	local raiz = ana.Character:FindFirstChild("HumanoidRootPart")
	local yo = Vector3.new(raiz.Position.X, 0, raiz.Position.Z)
	if (yo - mon.sitio).Magnitude < (yo - cerca.sitio).Magnitude then
		cerca = mon
	end
end
local tamAntes = cerca.bola.Size.X
ana:Mover(cerca.sitio.X, 3, cerca.sitio.Z)
avanzar(0.6)
e = estadoDe(ana)
comprobarIgual(e.carga, 0, "al llegar al monton se vacia")
comprobar(e.dinero > 0, "y paga")
comprobar(cerca.bola.Size.X > tamAntes, "y el monton crece con lo que le echas")


-------------------------------------------------------------------
titulo("EL AVISO DE ENSANCHAR CADUCA")
-------------------------------------------------------------------

-- En medio de un hoyo ya nivelado no se puede bajar mas: hay que decirlo.
local hoyo = parcelaDePrueba(93)
for _ = 1, A.nieve.desnivelMaximo do
	hoyo:excavar(20, 20)
end
comprobar(not hoyo:puedeExcavar(20, 20), "en el fondo del hoyo ya no se baja")
comprobar(hoyo:puedeExcavar(21, 20), "pero al lado si: por ahi se ensancha")

-- Y en el juego: el aviso aparece, y se va al soltar.
local BLOQUEO_X, BLOQUEO_Z = 12 * CELDA + 2, 40 * CELDA + 2
ana:Mover(BLOQUEO_X, 3, BLOQUEO_Z)
RemotoCavar.OnServerEvent:Fire(ana, true)
local salioElAviso = false
for _ = 1, 60 do
	avanzar(0.4)
	if estadoDe(ana).bloqueado then
		salioElAviso = true
		break
	end
end
comprobar(salioElAviso, "cavando en el mismo sitio acaba saliendo el aviso de ensanchar")
RemotoCavar.OnServerEvent:Fire(ana, false)
avanzar(0.6)
comprobar(estadoDe(ana).bloqueado == false, "y al soltar, el aviso se va")

-- Tambien se va al cambiar de sitio, sin soltar.
RemotoCavar.OnServerEvent:Fire(ana, true)
local otraVez = false
for _ = 1, 60 do
	avanzar(0.4)
	if estadoDe(ana).bloqueado then
		otraVez = true
		break
	end
end
comprobar(otraVez, "vuelve a salir si se insiste")
ana:Mover(BLOQUEO_X + 40, 3, BLOQUEO_Z + 40)
avanzar(0.6)
comprobar(estadoDe(ana).bloqueado == false, "y al moverse de sitio, se va tambien")
RemotoCavar.OnServerEvent:Fire(ana, false)
avanzar(0.4)


-------------------------------------------------------------------
titulo("EL GUION ENTERO, DE PRINCIPIO A FIN")
--
--  Se baja la nieve a mano por encima de cada cosa (eso es lo que hacen
--  los minutos de juego) y despues se da UNA palada de verdad, que es lo
--  que dispara la revision. Lo que se comprueba es la cadena, no el
--  cronometro: para el cronometro esta medir.luau.
-------------------------------------------------------------------

local function pelar(cx0, cz0, cx1, cz1)
	for cx = cx0, cx1 do
		for cz = cz0, cz1 do
			local c = p1:casilla(cx, cz)
			if c and not c.muro then
				c.restante = 0
			end
		end
	end
end

local function rellenar(cx0, cz0, cx1, cz1, capas)
	for cx = cx0, cx1 do
		for cz = cz0, cz1 do
			local casilla = p1:casilla(cx, cz)
			if casilla and not casilla.muro then
				casilla.restante = capas
			end
		end
	end
end

-- La cantera se agota: cavando siempre en el mismo sitio se acaba
-- llegando al fondo del cono y ahi ya no se baja (que es justo lo que
-- prueba la seccion anterior). Aqui lo que se mide es la cadena de
-- hallazgos, asi que se vuelve a llenar y a otra cosa.
local function unaPalada()
	local ccx, ccz = p1:aCasilla(CANTERA_X, CANTERA_Z)
	rellenar(ccx - 3, ccz - 3, ccx + 3, ccz + 3, A.nieve.capasMaximas)
	ana:Mover(CANTERA_X, 3, CANTERA_Z)
	RemotoCavar.OnServerEvent:Fire(ana, true)
	avanzar(1.2)
	RemotoCavar.OnServerEvent:Fire(ana, false)
	avanzar(0.5)
end

local function hallado(clave)
	local est = estadoDe(ana)
	return est and est.hallazgos and est.hallazgos[clave] == true
end

local m = p1.casa
local v = p1.vecino
local c = p1.calle

comprobar(not hallado("buzon"), "al empezar no se ha descubierto nada")

-- Donde esta la puerta ANTES de abrirse: al girar, se mueve de verdad, y
-- entonces ya no vale de referencia.
local puertaCerradaX = m.puerta.Position.X

-- 1. EL BUZON, a los pocos segundos: la primera palada tiene premio.
pelar(c.buzonCx - 1, c.buzonCz - 1, c.buzonCx + 1, c.buzonCz + 1)
unaPalada()
comprobar(hallado("buzon"), "1. aparece el buzon")

-- 2. LA CASA: tejado, porche, ventana y por fin la puerta.
pelar(m.cxCentro - 2, m.cz1 + 1, m.cxCentro + 2, m.cz1 + 3)
unaPalada()
for _, clave in ipairs({ "tejado", "porche", "ventana", "puerta" }) do
	comprobar(hallado(clave), "2. aparece " .. clave)
end
comprobarIgual(estadoDe(ana).capitulo, "garaje", "y el guion pasa al garaje")

-- Y el mundo reacciona: la puerta SE ABRE y la casa se enciende.
comprobar(m.puertaAbierta == true, "la puerta de tu casa se abre sola al descubrirla")
comprobar(m.puerta.Parent ~= nil, "y sigue ahi: se abre, no se borra")
comprobarIgual(
	math.floor(m.puerta.CFrame.X * 10 + 0.5) / 10,
	math.floor((puertaCerradaX - A.casa.puertaAncho / 2) * 10 + 0.5) / 10,
	"girando sobre su jamba, que es donde esta la bisagra"
)
comprobar(m.humo.Enabled == true, "arranca el humo de la chimenea")
comprobar(m.luzRecibidor.Enabled == true, "y sale luz calida por el hueco")

-- 3. EL GARAJE.
pelar(m.garajeCx - 2, m.cz1 + 1, m.garajeCx + 2, m.cz1 + 2)
unaPalada()
comprobar(hallado("garaje"), "3. aparece el garaje")
comprobar(m.garajeAbierto == true, "y su puerta se enrolla hacia arriba")
comprobar(m.puertaGaraje.Size.Y < 2, "de verdad: la persiana se recoge")
avanzar(2)
comprobar(p1.sopladoraCuerpo ~= nil, "y dentro aparece una sopladora fisica")
comprobarIgual(estadoDe(ana).capitulo, "sopladora", "el guion pide ir a por ella")

-- 4. COGERLA. No hay tienda: se va y se coge.
comprobarIgual(estadoDe(ana).herramienta, "pala", "hasta cogerla se lleva la pala")
RemotoHerramienta.OnServerEvent:Fire(ana, "sopladora")
avanzar(0.5)
comprobarIgual(
	estadoDe(ana).herramienta,
	"pala",
	"y pedir la sopladora antes de encontrarla no hace nada"
)

local dondeEsta = p1.sopladoraCuerpo.Position
ana:Mover(dondeEsta.X, 3, dondeEsta.Z)
avanzar(0.8)
comprobar(estadoDe(ana).tieneSopladora == true, "4. acercarse a ella es cogerla")
comprobarIgual(estadoDe(ana).herramienta, "sopladora", "y se pone en las manos sola")
comprobar(p1.sopladoraCuerpo == nil, "ya no esta tirada en el garaje")
comprobar(#avisosDe(ana, "cogida") == 1, "y se avisa de que la tienes")
comprobarIgual(estadoDe(ana).capitulo, "carretera", "el guion pasa a abrir la calle")


-------------------------------------------------------------------
titulo("LA SOPLADORA SE MANEJA DISTINTO")
-------------------------------------------------------------------

-- Sitio limpio, lejos de todo, para mirar la franja sin ruido.
local FX, FZ = 8 * CELDA + 2, 34 * CELDA + 2
local cxF, czF = p1:aCasilla(FX, FZ)
local delanteCz = czF + 3       -- 12 studs por delante: dentro de la franja
local detrasCz = czF - 5        -- 20 studs por detras: fuera de la franja

-- Se rellena la zona a mano para partir de un llano conocido.
for cx = cxF - 8, cxF + 8 do
	for cz = czF - 8, czF + 8 do
		local casilla = p1:casilla(cx, cz)
		if casilla and not casilla.muro then
			casilla.restante = A.nieve.capasMaximas
		end
	end
end

local antesDelante = p1:casilla(cxF, delanteCz).restante
local antesDetras = p1:casilla(cxF, detrasCz).restante
local antesCarga = estadoDe(ana).carga
local antesNieve = estadoDe(ana).nieveTotal

ana:Mover(FX, 3, FZ)
ana:Mirar(0, 1) -- mirando a +Z
RemotoCavar.OnServerEvent:Fire(ana, true)
avanzar(1.2)
RemotoCavar.OnServerEvent:Fire(ana, false)
avanzar(0.5)

comprobar(
	p1:casilla(cxF, delanteCz).restante < antesDelante,
	"la sopladora se come lo que tiene DELANTE"
)
comprobarIgual(
	p1:casilla(cxF, detrasCz).restante,
	antesDetras,
	"y no toca lo que tiene detras: es una franja, no un circulo"
)
comprobarIgual(estadoDe(ana).carga, antesCarga, "no llena la carretilla: escupe la nieve al lado")
comprobar(estadoDe(ana).nieveTotal > antesNieve, "pero la nieve movida cuenta igual")
comprobar(p1.montoncitos ~= nil and #p1.montoncitos > 0, "y va dejando montones a un lado")

-- Y hasta donde llega: por mucho que insista, no raspa el suelo.
for vuelta = 1, 30 do
	ana:Mover(FX + ((vuelta % 5) - 2) * 6, 3, FZ)
	ana:Mirar(0, 1)
	RemotoCavar.OnServerEvent:Fire(ana, true)
	avanzar(0.8)
end
RemotoCavar.OnServerEvent:Fire(ana, false)
avanzar(0.5)

local masBajoEnLaFranja = A.nieve.capasMaximas
for cx = cxF - 4, cxF + 4 do
	for cz = czF, czF + 4 do
		local casilla = p1:casilla(cx, cz)
		if casilla and not casilla.muro and casilla.restante < masBajoEnLaFranja then
			masBajoEnLaFranja = casilla.restante
		end
	end
end
comprobar(
	masBajoEnLaFranja >= A.herramientas.sopladora.dejaCapas,
	"insistiendo con la sopladora nunca se llega al suelo: para eso esta la pala"
)
print(("       (lo mas hondo que deja la sopladora: %d capas)"):format(masBajoEnLaFranja))

-- La misma casilla, las dos herramientas: la sopladora ya no puede, la
-- pala si. Dicho asi de corto, esa es toda la diferencia.
for cx = cxF - 2, cxF + 2 do
	for cz = czF - 2, czF + 2 do
		local casilla = p1:casilla(cx, cz)
		if casilla and not casilla.muro then
			casilla.restante = A.herramientas.sopladora.dejaCapas
		end
	end
end
comprobar(
	not p1:puedeExcavar(cxF, czF, A.herramientas.sopladora.dejaCapas),
	"sobre el colchon, la sopladora ya no tiene nada que hacer"
)
comprobar(
	p1:puedeExcavar(cxF, czF, A.herramientas.pala.dejaCapas),
	"y en esa misma casilla la pala si puede seguir"
)

-- Se avisa de que lo que queda ya es trabajo de pala.
local avisaDePala = false
ana:Mover(FX, 3, FZ)
ana:Mirar(0, 1)
RemotoCavar.OnServerEvent:Fire(ana, true)
for _ = 1, 20 do
	avanzar(0.4)
	if estadoDe(ana).soloPala then
		avisaDePala = true
		break
	end
end
RemotoCavar.OnServerEvent:Fire(ana, false)
avanzar(0.5)
comprobar(avisaDePala, "y el HUD lo dice: lo que queda es para la pala")
comprobar(estadoDe(ana).soloPala == false, "aviso que tambien caduca al soltar")

-- Con la pala en la mano, ese mismo sitio si baja hasta la tierra.
RemotoHerramienta.OnServerEvent:Fire(ana, "pala")
avanzar(0.4)
comprobarIgual(estadoDe(ana).herramienta, "pala", "se puede volver a la pala cuando quieras")
RemotoCavar.OnServerEvent:Fire(ana, true)
avanzar(A.herramientas.pala.golpe * 8)
RemotoCavar.OnServerEvent:Fire(ana, false)
avanzar(0.5)
local hayTierra = false
for cx = cxF - 2, cxF + 2 do
	for cz = czF - 2, czF + 2 do
		local casilla = p1:casilla(cx, cz)
		if casilla and not casilla.muro and casilla.restante == 0 then
			hayTierra = true
		end
	end
end
comprobar(hayTierra, "y la pala si deja el suelo pelado donde la sopladora no podia")

-- Y sin pulsar, la sopladora tampoco hace nada.
RemotoHerramienta.OnServerEvent:Fire(ana, "sopladora")
avanzar(0.4)
local quietaAntes = estadoDe(ana).nieveTotal
for _ = 1, 10 do
	ana:Mover(FX + math.random(-20, 20), 3, FZ + math.random(-20, 20))
	avanzar(0.3)
end
comprobarIgual(
	estadoDe(ana).nieveTotal,
	quietaAntes,
	"con la sopladora tampoco se limpia solo por pasear: hay que mantener pulsado"
)


-------------------------------------------------------------------
titulo("LA CALLE, Y LO QUE HAY AL OTRO LADO")
-------------------------------------------------------------------

-- La calle se da por abierta cuando esta abierta la entrada ENTERA hasta
-- el asfalto, no cuando hay un agujero encima de la calzada.
pelar(m.garajeCx - 2, m.cz1 + 1, m.garajeCx + 2, A.sitio.czCarretera + 1)
RemotoHerramienta.OnServerEvent:Fire(ana, "pala")
avanzar(0.4)
unaPalada()
comprobar(hallado("carretera"), "5. se llega al asfalto")
comprobarIgual(estadoDe(ana).capitulo, "vecino", "y aparece el siguiente misterio")
comprobar(c.encendida == true, "se encienden las farolas de la calle")
comprobar(v.humo.Enabled == true, "y empieza a salir humo de la casa de enfrente")
comprobar(v.cristales[1].luz.Enabled == true, "con una luz floja en sus ventanas")
comprobar(v.abierta ~= true, "pero su puerta sigue cerrada: eso hay que ganarselo")

pelar(v.cxCentro - 2, v.cz0 - 4, v.cxCentro + 2, v.cz0 - 1)
unaPalada()
comprobar(hallado("vecino"), "6. aparece la entrada del vecino")
comprobar(v.abierta == true, "su puerta se abre")
comprobarIgual(estadoDe(ana).capitulo, "fin", "y ahi se cierra la primera calle")

-- El orden importa: si algo se anuncia antes de tiempo, es mentira.
local orden = {}
for _, av in ipairs(avisosDe(ana, "hallazgo")) do
	orden[#orden + 1] = av.clave
end
local esperado = { "buzon", "tejado", "porche", "ventana", "puerta", "garaje", "carretera", "vecino" }
comprobarIgual(#orden, #esperado, "se han anunciado los ocho hallazgos")
local bienOrdenado = true
for i, clave in ipairs(esperado) do
	if orden[i] ~= clave then
		bienOrdenado = false
	end
end
comprobar(bienOrdenado, "y en el orden del guion: " .. table.concat(orden, " > "))


-------------------------------------------------------------------
titulo("CADA JUGADOR TIENE LO SUYO")
-------------------------------------------------------------------

local beto = nuevoJugador("Beto")
entra(beto)
avanzar(0.5)
beto:LoadCharacter()
avanzar(0.6)
comprobar(estadoDe(beto).tieneSopladora == false, "el que acaba de entrar no tiene la sopladora de otro")
RemotoHerramienta.OnServerEvent:Fire(beto, "sopladora")
avanzar(0.4)
comprobarIgual(estadoDe(beto).herramienta, "pala", "y pedirla por el remoto no se la da")


-------------------------------------------------------------------
print("")
print(("── %d bien, %d mal"):format(PASADAS, FALLOS))
if FALLOS > 0 then
	error(("hay %d comprobaciones que fallan"):format(FALLOS), 0)
end
