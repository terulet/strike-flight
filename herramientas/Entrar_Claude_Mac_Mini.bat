@echo off
REM ==============================================================
REM  Entrar_Claude_Mac_Mini.bat
REM
REM  Igual que Entrar_Mac_Mini.bat, pero sin escala: conecta por SSH
REM  al Mac Mini y lanza Claude Code directamente. Al salir de Claude
REM  se cierra la sesion y la ventana.
REM
REM  Uso:
REM    Entrar_Claude_Mac_Mini.bat                 -> abre Claude
REM    Entrar_Claude_Mac_Mini.bat --continue      -> retoma la ultima sesion
REM    Entrar_Claude_Mac_Mini.bat --resume        -> elige que sesion retomar
REM    Entrar_Claude_Mac_Mini.bat "revisa el jefe 5"
REM ==============================================================

setlocal EnableExtensions
title Claude @ Mac Mini

REM Consola en UTF-8: sin esto los marcos y simbolos de Claude salen rotos.
chcp 65001 >nul 2>&1

REM ------------------------- CONFIGURACION -------------------------
set "MAC_USER=eloi"
set "MAC_HOST=100.98.237.124"

REM Carpeta del proyecto en el Mac donde quieres abrir Claude.
REM Dejalo vacio para entrar en tu HOME. Ejemplo:
REM   set "REMOTE_DIR=~/Proyectos/strike-flight"
set "REMOTE_DIR="

REM 1 = dejar a Claude corriendo dentro de tmux, asi si se cae el wifi
REM     o cierras la ventana el trabajo sigue vivo y al volver a entrar
REM     retomas donde estabas. Necesita tmux en el Mac: brew install tmux
set "USAR_TMUX=0"
REM -----------------------------------------------------------------

where ssh >nul 2>&1
if errorlevel 1 goto :sin_ssh

REM Argumentos opcionales para claude (quitamos las comillas: rompen el SSH).
set "ARGS=%*"
if defined ARGS set "ARGS=%ARGS:"=%"

set "CLAUDE_CMD=claude"
if defined ARGS set "CLAUDE_CMD=claude %ARGS%"
if "%USAR_TMUX%"=="1" set "CLAUDE_CMD=tmux new-session -A -s claude %CLAUDE_CMD%"

REM PATH tipico de una instalacion de Claude Code en macOS. El SSH no
REM interactivo no carga tu perfil, por eso lo ponemos a mano.
set "RUTA=$HOME/.local/bin:$HOME/bin:$HOME/.bun/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"

set "REMOTO=export PATH=%RUTA%;"
if defined REMOTE_DIR set "REMOTO=%REMOTO% cd %REMOTE_DIR% || echo AVISO: no encuentro %REMOTE_DIR%, abro Claude en el HOME;"
set "REMOTO=%REMOTO% command -v claude >/dev/null 2>&1 && exec %CLAUDE_CMD% || exec ${SHELL:-/bin/zsh} -ilc '%CLAUDE_CMD%'"

echo Conectando a %MAC_USER%@%MAC_HOST% y abriendo Claude...
echo.

REM -t fuerza terminal (Claude es interactivo) y los ServerAlive evitan
REM que la sesion se corte mientras Claude piensa un buen rato.
ssh -t -o ConnectTimeout=10 -o ServerAliveInterval=30 -o ServerAliveCountMax=6 %MAC_USER%@%MAC_HOST% "%REMOTO%"

if errorlevel 1 goto :fallo
exit /b 0

:fallo
echo.
echo [!] La sesion ha terminado con error.
echo     Repasa:
echo       - Que el Mac Mini este encendido y accesible ^(%MAC_HOST%^).
echo       - Que Claude este instalado en el Mac: npm i -g @anthropic-ai/claude-code
echo       - Si claude esta en otra ruta, anadela arriba en la variable RUTA.
echo.
pause
exit /b 1

:sin_ssh
echo.
echo [!] No encuentro ssh.exe en este Windows.
echo     Instalalo desde: Configuracion ^> Aplicaciones ^> Caracteristicas opcionales
echo     ^> Anadir caracteristica ^> Cliente OpenSSH.
echo.
pause
exit /b 1
