--[[
	El cliente, ejecutado de verdad: se construye el HUD entero, recibe
	los paquetes del servidor y se comprueba lo que acaba viendose en
	pantalla. Es la mitad del juego que no se puede probar de otra forma
	sin abrir Studio.
]]

local A = AJUSTES
local RS = game:GetService("ReplicatedStorage")
local remotos = RS:FindFirstChild("NieveRemotos")
local RemotoAviso = remotos:FindFirstChild("Aviso")
local RemotoComprar = remotos:FindFirstChild("Comprar")

local yo = JUGADOR_LOCAL
local pantalla = yo.PlayerGui:FindFirstChild("NieveHUD")

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

local RemotoEstado = remotos:FindFirstChild("Estado")

local function estadoDelJugador()
	for i = #RemotoEstado._alCliente, 1, -1 do
		if RemotoEstado._alCliente[i].jugador == yo then
			return RemotoEstado._alCliente[i].datos
		end
	end
	return {}
end

local recorrido = 0

local function barrer(indice, segundosMax)
	local def = A.zonas[indice]
	local sitio = sitios(indice)
	local anchoS = def.ancho * celdaDe(indice)
	local largoS = def.largo * celdaDe(indice)
	local humano = yo.Character:FindFirstChild("Humanoid")
	local t = 0
	while t < segundosMax do
		recorrido = recorrido + humano.WalkSpeed * 0.2
		local fondo = anchoS - 4
		local filas = math.max(1, math.floor((largoS - 4) / 8))
		local fila = math.floor(recorrido / fondo) % filas
		local avance = recorrido % fondo
		if fila % 2 == 1 then
			avance = fondo - avance
		end
		yo:Mover(sitio.centroX - anchoS / 2 + 2 + avance, 3, -largoS / 2 + 2 + fila * 8)
		avanzar(0.2)
		t = t + 0.2
	end
end


-------------------------------------------------------------------
titulo("EL HUD SE CONSTRUYE")
-------------------------------------------------------------------

comprobar(pantalla ~= nil, "existe la pantalla del juego")
comprobar(pantalla:FindFirstChild("Dinero") ~= nil, "hay panel de dinero")
comprobar(pantalla.Dinero:FindFirstChild("Moneda") ~= nil, "con su moneda dibujada, no un emoji")
comprobar(pantalla:FindFirstChild("Zona") ~= nil, "hay panel de zona")
comprobar(pantalla:FindFirstChild("Carga") ~= nil, "hay barra de carga")
comprobar(pantalla:FindFirstChild("BotonMejoras") ~= nil, "hay boton de mejoras")
comprobar(pantalla:FindFirstChild("PanelMejoras") ~= nil, "hay panel de mejoras")

local panelMejoras = pantalla.PanelMejoras
comprobarIgual(panelMejoras.Visible, false, "el panel empieza cerrado")
comprobarIgual(pantalla.BotonRenacer.Visible, false, "el boton de renacer empieza escondido")

local lista = panelMejoras:FindFirstChild("Lista")
comprobar(lista ~= nil and lista.ClassName == "ScrollingFrame", "la lista de mejoras hace scroll")
for _, def in ipairs(A.mejoras) do
	comprobar(lista:FindFirstChild(def.clave) ~= nil, "hay fila para " .. def.clave)
end
comprobar(lista:FindFirstChild("renacer") ~= nil, "hay fila de renacer")
comprobar(lista:FindFirstChild("codigo") ~= nil, "hay fila de codigos")


-------------------------------------------------------------------
titulo("EL HUD SE ENTERA DE LO QUE PASA")
-------------------------------------------------------------------

avanzar(1)

titulo("LA GUIA, PASO A PASO")
local guia = pantalla:FindFirstChild("Guia")
comprobar(guia ~= nil, "hay cartel de guia")
comprobarIgual(guia.Visible, true, "y al entrar esta puesto")
comprobarIgual(guia.Titulo.Text, A.texto("es", "guia1"), "lo primero: anda por encima de la nieve")

-- Poco rato: lo justo para recoger algo sin llenarla del todo (se llena
-- en unos tres segundos, que es justo lo que se quiere al principio).
barrer(1, 1.4)
comprobarIgual(guia.Titulo.Text, A.texto("es", "guia2"), "en cuanto recoge algo, cambia a llenar la carretilla")

barrer(1, 40)
comprobarIgual(guia.Titulo.Text, A.texto("es", "guia3"), "con la carretilla llena, manda al camion")

local sitio1 = sitios(1)
yo:Mover(sitio1.centroX, 3, sitio1.ventaZ)
avanzar(0.6)
comprobarIgual(guia.Titulo.Text, A.texto("es", "guia4"), "ya vendida, toca comprar la primera mejora")

RemotoComprar:FireServer("mejora", "pala")
avanzar(0.5)
comprobarIgual(guia.Visible, false, "y comprada, la guia se quita y no vuelve")


titulo("EL HUD SE ENTERA DE LO QUE PASA")
local textoDinero = pantalla.Dinero.Texto
comprobar(textoDinero.Text ~= "", "el dinero se pinta")
comprobarIgual(textoDinero.Text, A.formatear(estadoDelJugador().dinero), "y solo el numero: sin emojis que la fuente no tiene")
comprobar(pantalla.Zona.Nombre.Text == A.nombre(A.zonas[1].nombre, "es"), "sale el nombre de la zona en espanol")
comprobar(string.find(pantalla.Zona.Porcentaje.Text, "limpio") ~= nil, "sale el porcentaje de limpieza, fuera de la barra")

barrer(1, 6)
local canal = pantalla.Carga.Canal
comprobar(canal.Relleno.Size.X.Scale > 0, "la barra de carga se llena al recoger")
comprobar(string.find(canal.Texto.Text, "/") ~= nil or canal.Texto.Text ~= "", "la carga sale en numeros")

barrer(1, 30)
avanzar(0.5)
comprobarIgual(canal.Texto.Text, A.texto("es", "lleno"), "cuando esta llena, lo dice")

local sitio = sitios(1)
yo:Mover(sitio.centroX, 3, sitio.ventaZ)
avanzar(0.5)
comprobar(pantalla:FindFirstChild("Aviso") ~= nil, "al vender aparece el aviso volante")
comprobar(textoDinero.Text ~= "0", "y el dinero ya no es cero")


-------------------------------------------------------------------
titulo("SUENA")
-------------------------------------------------------------------

local Sonidos = game:GetService("SoundService")

for clave, def in pairs(A.sonidos) do
	local sonido = Sonidos:FindFirstChild("Nieve_" .. clave)
	comprobar(sonido ~= nil, "hay sonido de " .. clave)
	if sonido then
		comprobarIgual(sonido.SoundId, def.id, "y apunta a " .. def.id)
		comprobar(
			string.sub(def.id, 1, 11) == "rbxasset://",
			"que viene dentro del cliente: no depende de ningun id de la biblioteca"
		)
	end
end

comprobar((Sonidos.Nieve_pala._veces or 0) > 0, "la pala ha raspado al recoger")
comprobar((Sonidos.Nieve_lleno._veces or 0) > 0, "y ha avisado al llenarse la carretilla")
comprobar((Sonidos.Nieve_venta._veces or 0) > 0, "y ha sonado la caja al vender")


-------------------------------------------------------------------
titulo("EL PANEL DE MEJORAS")
-------------------------------------------------------------------

pantalla.BotonMejoras.Activated:Fire()
comprobarIgual(panelMejoras.Visible, true, "el boton lo abre")

local filaPala = lista.pala
comprobar(filaPala.Comprar.Text ~= "", "el boton de comprar dice el precio")
comprobar(string.find(filaPala.Nivel.Text, "Nv") ~= nil, "y el nivel en que vas")

panelMejoras.Cerrar.Activated:Fire()
comprobarIgual(panelMejoras.Visible, false, "la X lo cierra")


-------------------------------------------------------------------
titulo("LOS CODIGOS")
-------------------------------------------------------------------

local caja = lista.codigo.Caja
caja.Text = "  nieve  "
lista.codigo.Canjear.Activated:Fire()
avanzar(0.4)
comprobarIgual(caja.Text, "", "al canjear se vacia la caja")

local marcador = yo:FindFirstChild("leaderstats")
comprobar(marcador.Coins.Value > 0, "el codigo NIEVE (con espacios y en minusculas) da dinero")

local dineroTrasCodigo = marcador.Coins.Value
caja.Text = "NIEVE"
lista.codigo.Canjear.Activated:Fire()
avanzar(0.4)
comprobarIgual(marcador.Coins.Value, dineroTrasCodigo, "el mismo codigo no se puede usar dos veces")

caja.Text = "LOQUESEA"
lista.codigo.Canjear.Activated:Fire()
avanzar(0.4)
comprobarIgual(marcador.Coins.Value, dineroTrasCodigo, "un codigo inventado no da nada")


-------------------------------------------------------------------
titulo("LOS CARTELES DEL MUNDO, EN SU IDIOMA")
-------------------------------------------------------------------

local puertas = workspace.Nieve.Puertas
local puerta2 = puertas:FindFirstChild("Puerta_" .. A.zonas[2].clave)
local cartelPuerta = puerta2:FindFirstChild("Cartel")
-- El texto cuelga del marco, no del cartel: hay que buscarlo hacia dentro.
local textoPuerta = cartelPuerta:FindFirstChild("Texto", true)
comprobar(
	textoPuerta ~= nil and string.find(textoPuerta.Text, A.nombre(A.zonas[2].nombre, "es")) ~= nil,
	"la puerta dice el nombre de la zona en espanol"
)
comprobar(string.find(textoPuerta.Text, A.texto("es", "abrir")) ~= nil, "y lo que cuesta abrirla")
comprobarIgual(puerta2.CanCollide, true, "la puerta cerrada no deja pasar")

local tabla = workspace.Nieve:FindFirstChild("Tabla")
comprobar(tabla ~= nil, "hay poste de records")
local tituloTabla = tabla:FindFirstChild("Titulo", true)
comprobarIgual(tituloTabla and tituloTabla.Text, A.texto("es", "records"), "y su titulo en espanol")

local listaTabla = tabla:FindFirstChild("Lista", true)
comprobar(listaTabla ~= nil and listaTabla.Text ~= "", "y la tabla dice algo, aunque no haya nadie todavia")
do
	local filas = 1
	for _ in string.gmatch(listaTabla.Text, "\n") do
		filas = filas + 1
	end
	comprobarIgual(filas, A.records.cuantos, "la tabla siempre tiene sus diez filas, llenas o con raya")
end


-------------------------------------------------------------------
titulo("UN CARTEL QUE LLEGA TARDE")
-------------------------------------------------------------------

-- Los carteles del mundo no llegan todos a la vez. El que aparece cuando
-- el cliente ya esta en marcha tiene que traducirse igual: asi es como el
-- de records se quedaba en ingles mientras el del camion salia bien.
do
	local poste = Instance.new("Part")
	poste.Name = "PosteTarde"
	poste.Parent = workspace.Nieve

	local gui = Instance.new("BillboardGui")
	gui.Name = "Cartel"
	local marco = Instance.new("Frame")
	marco.Parent = gui
	local texto = Instance.new("TextLabel")
	texto.Name = "Texto"
	texto.Text = "SELL"
	texto.Parent = marco
	gui:SetAttribute("tipo", "vender")
	gui.Parent = poste

	avanzar(0.3)
	comprobarIgual(texto.Text, A.texto("es", "vender"), "un cartel que llega tarde tambien se traduce")
end


-------------------------------------------------------------------
titulo("EL PREMIO DIARIO EN PANTALLA")
-------------------------------------------------------------------

local function ultimoAvisoEnPantalla()
	local encontrado = nil
	for _, hijo in ipairs(pantalla:GetChildren()) do
		if hijo.Name == "Aviso" then
			encontrado = hijo
		end
	end
	return encontrado
end

avanzar(2) -- que se vayan los avisos de antes
comprobarIgual(ultimoAvisoEnPantalla(), nil, "los avisos se borran solos al rato")

RemotoAviso.OnClientEvent:Fire({ tipo = "diario", cantidad = 12345, racha = 3 })
local nota = ultimoAvisoEnPantalla()
comprobar(nota ~= nil and string.find(nota.Text, A.texto("es", "diario")) ~= nil, "el premio diario sale en pantalla")
comprobar(string.find(nota.Text, "12.3K") ~= nil, "con el numero acortado, no 12345")

avanzar(2)
local racha = ultimoAvisoEnPantalla()
comprobar(racha ~= nil and string.find(racha.Text, "3") ~= nil, "y despues sale el dia de racha")


-------------------------------------------------------------------
titulo("QUE NIEVE")
-------------------------------------------------------------------

local Correr = game:GetService("RunService")
Correr.RenderStepped:Fire(0.016)
Correr.RenderStepped:Fire(0.016)
local nube = workspace.CurrentCamera:FindFirstChild("NieveCayendo")
comprobar(nube ~= nil, "hay nieve cayendo pegada a la camara")
comprobar(nube:FindFirstChildOfClass("ParticleEmitter") ~= nil, "con sus copos")


-------------------------------------------------------------------
print("")
print(("── %d bien, %d mal"):format(PASADAS, FALLOS))
if FALLOS > 0 then
	error(("hay %d comprobaciones que fallan"):format(FALLOS), 0)
end
