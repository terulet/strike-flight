--[[
	Lo que tiene que cumplir DESENTIERRA.

	La comprobacion que manda es la de la pendiente: pase lo que pase, dos
	casillas vecinas no pueden acabar con mas de un nivel de diferencia.
	Si eso se rompe, hay pozos de los que no se sale, y el juego se rompe
	con ellos.
]]

local A = AJUSTES
local RS = game:GetService("ReplicatedStorage")
local remotos = RS:FindFirstChild("DesenterrarRemotos")
local RemotoEstado = remotos:FindFirstChild("Estado")
local RemotoAviso = remotos:FindFirstChild("Aviso")

local carpeta = workspace:FindFirstChild("Desenterrar")

local OCHO = {
	{ 1, 0 }, { -1, 0 }, { 0, 1 }, { 0, -1 },
	{ 1, 1 }, { 1, -1 }, { -1, 1 }, { -1, -1 },
}

-- Se rehace una parcela igual que la del mundo para poder mirarla por
-- dentro: el modelo vive aparte justamente para esto.
local function parcelaDePrueba()
	local p = PARCELA.nueva(99, Vector3.new(4000, 0, 4000))
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

local casa = grupo:FindFirstChild("Casa")
comprobar(casa ~= nil, "la casa esta construida")
comprobar(casa and casa:FindFirstChild("Puerta") ~= nil, "con su puerta")
local chimenea = casa and casa:FindFirstChild("Chimenea")
comprobar(chimenea ~= nil, "y su chimenea")
comprobar(
	chimenea and chimenea.Size.Y > A.nieve.capasMaximas * A.nieve.capa,
	"que asoma por encima de la nevada: es lo unico que se ve al empezar"
)


-------------------------------------------------------------------
titulo("LA REGLA DE LA PENDIENTE AGUANTA CAVANDO")
-------------------------------------------------------------------

-- Se cava a lo bestia, a lo tonto y por todas partes, y despues se mira.
local excavadas = 0
for vuelta = 1, 40 do
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
local pozo = parcelaDePrueba()
local intentos = 0
for _ = 1, 200 do
	if pozo:excavar(10, 10) then
		intentos = intentos + 1
	end
end
comprobarIgual(intentos, 1, "insistiendo en una sola casilla solo se baja una capa: no hay pozo vertical")
comprobar(peorDesnivel(pozo) <= A.nieve.desnivelMaximo, "y la pendiente sigue entera")

-- Y en diagonal, que es por donde se colaba con cuatro vecinas.
local diagonal = parcelaDePrueba()
diagonal:excavar(10, 10)
for _ = 1, 20 do
	diagonal:excavar(11, 11)
end
comprobar(peorDesnivel(diagonal) <= A.nieve.desnivelMaximo, "tampoco por las diagonales")


-------------------------------------------------------------------
titulo("SE EXCAVA, SE CARGA Y SE DESCARGA")
-------------------------------------------------------------------

local ana = nuevoJugador("Ana")
entra(ana)
avanzar(0.5)
ana:LoadCharacter()
avanzar(0.5)

local e = estadoDe(ana)
comprobar(e ~= nil, "el cliente recibe el estado")
comprobarIgual(e.carga, 0, "empieza con la carretilla vacia")
comprobarIgual(e.capasPuerta, A.nieve.capasMaximas, "y con la puerta enterrada del todo")

-- Al lado del hueco de salida hay nieve: se cava ahi.
local parcela1 = nil
do
	local x, z = 0, 0
	-- el hueco esta al fondo de la parcela, en el centro
	-- En el llano de arriba, que es donde se puede cavar.
	x = (A.parcela.ancho / 2) * A.nieve.celda
	z = (A.parcela.largo / 2 + 6) * A.nieve.celda
	ana:Mover(x, 3, z)
	parcela1 = { x = x, z = z }
end
avanzar(1.5)
e = estadoDe(ana)
comprobar(e.carga > 0, "al andar por la nieve se excava")
comprobar(rellenosDe("Air") > 0, "y se abre el terreno de verdad")

-- Se llena y se descarga en el monton.
for _ = 1, 60 do
	local est = estadoDe(ana)
	if est and est.carga >= est.capacidad then
		break
	end
	ana:Mover(parcela1.x + math.random(-20, 20), 3, parcela1.z + math.random(-20, 20))
	avanzar(0.4)
end
e = estadoDe(ana)
comprobar(e.carga > 0, "la carretilla se llena excavando alrededor")

local monton = grupo:FindFirstChild("Monton")
comprobar(monton ~= nil, "hay monton donde descargar")
local tamAntes = monton.Size.X
ana:Mover(monton.Position.X, 3, monton.Position.Z)
avanzar(0.6)
e = estadoDe(ana)
comprobarIgual(e.carga, 0, "al llegar al monton se descarga")
comprobar(e.dinero > 0, "y paga")
comprobar(monton.Size.X > tamAntes, "y el monton crece con lo que le echas")


-------------------------------------------------------------------
titulo("NO SE PIERDE EL GOLPE")
-------------------------------------------------------------------

-- En medio de un hoyo ya nivelado no se puede bajar mas: hay que decirlo.
local hoyo = parcelaDePrueba()
hoyo:excavar(20, 20)
comprobar(not hoyo:puedeExcavar(20, 20), "en el fondo del hoyo ya no se baja")
comprobar(hoyo:puedeExcavar(21, 20), "pero al lado si: por ahi se ensancha")


-------------------------------------------------------------------
print("")
print(("── %d bien, %d mal"):format(PASADAS, FALLOS))
if FALLOS > 0 then
	error(("hay %d comprobaciones que fallan"):format(FALLOS), 0)
end
