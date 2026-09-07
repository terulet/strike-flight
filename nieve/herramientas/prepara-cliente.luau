--[[
	Deja un jugador local dentro de la partida ANTES de cargar el cliente:
	el LocalScript necesita LocalPlayer y PlayerGui nada mas arrancar,
	igual que en Roblox.
]]

JUGADOR_LOCAL = nuevoJugador("Yo")
Jugadores.LocalPlayer = JUGADOR_LOCAL

entra(JUGADOR_LOCAL)
avanzar(0.5)
JUGADOR_LOCAL:LoadCharacter()
avanzar(0.5)
