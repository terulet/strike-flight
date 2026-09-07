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
REM
REM  SOBRE LA PREGUNTA DE CONFIANZA ("Do you trust this folder?"):
REM  Claude nunca recuerda la confianza de la carpeta personal
REM  (/Users/eloi) - esta hecho asi a proposito, y por eso preguntaba
REM  cada vez. La solucion es abrir en una carpeta de proyecto, y ahi
REM  la respuesta si se guarda. Ademas, si el Mac tiene node, el script
REM  deja la carpeta marcada como de confianza antes de arrancar, asi
REM  que no llega ni a preguntar una vez.
REM ==============================================================

setlocal EnableExtensions
title Claude @ Mac Mini

REM Consola en UTF-8: sin esto los marcos y simbolos de Claude salen rotos.
chcp 65001 >nul 2>&1

REM ------------------------- CONFIGURACION -------------------------
set "MAC_USER=eloi"
set "MAC_HOST=100.98.237.124"

REM Carpeta del Mac donde se abre Claude. La crea si no existe.
REM Ponla apuntando a tu proyecto, por ejemplo:
REM   set "REMOTE_DIR=$HOME/Proyectos/strike-flight"
REM NO la dejes en $HOME a secas: ahi Claude vuelve a preguntar siempre.
set "REMOTE_DIR=$HOME/claude"

REM 1 = marcar esa carpeta como de confianza antes de abrir Claude, para
REM     que no salga el dialogo. Es exactamente lo mismo que pulsar
REM     "Yes, I trust this folder": NO desactiva los permisos, Claude te
REM     sigue pidiendo confirmacion para lo que toca fuera de lo normal.
REM     Necesita node en el Mac; si no lo hay, se salta esto sin ruido y
REM     solo tendras que responder el dialogo una vez.
set "AUTO_CONFIAR=1"

REM 1 = dejar a Claude corriendo dentro de tmux, asi si se cae el wifi
REM     o cierras la ventana el trabajo sigue vivo y al volver a entrar
REM     retomas donde estabas. Necesita tmux en el Mac: brew install tmux
set "USAR_TMUX=0"
REM -----------------------------------------------------------------

where ssh >nul 2>&1
if errorlevel 1 goto :sin_ssh

if not defined REMOTE_DIR set "REMOTE_DIR=$HOME/claude"

REM Argumentos opcionales para claude (quitamos las comillas: rompen el SSH).
set "ARGS=%*"
if defined ARGS set "ARGS=%ARGS:"=%"

set "CLAUDE_CMD=claude"
if defined ARGS set "CLAUDE_CMD=claude %ARGS%"
if "%USAR_TMUX%"=="1" set "CLAUDE_CMD=tmux new-session -A -s claude %CLAUDE_CMD%"

REM PATH tipico de una instalacion de Claude Code en macOS. El SSH no
REM interactivo no carga tu perfil, por eso lo ponemos a mano.
set "RUTA=$HOME/.local/bin:$HOME/bin:$HOME/.bun/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"

REM Anota la carpeta actual como de confianza en ~/.claude.json. Solo
REM escribe si aun no lo estaba, y si el fichero existe pero no se puede
REM leer se retira sin tocarlo: ahi vive tu sesion iniciada.
set "CONFIAR="
if "%AUTO_CONFIAR%"=="1" set "CONFIAR=command -v node >/dev/null 2>&1 && node -e 'const fs=require(`fs`);const p=(process.env.CLAUDE_CONFIG_DIR||require(`os`).homedir())+`/.claude.json`;let d=null;try{d=JSON.parse(fs.readFileSync(p,`utf8`))}catch(e){if(fs.existsSync(p))process.exit(0);d={}}if(!d.projects)d.projects={};const k=process.cwd();if(!d.projects[k])d.projects[k]={};if(d.projects[k].hasTrustDialogAccepted!==true){d.projects[k].hasTrustDialogAccepted=true;fs.writeFileSync(p+`.tmp`,JSON.stringify(d,null,2));fs.renameSync(p+`.tmp`,p)}' 2>/dev/null;"

set "REMOTO=export PATH=%RUTA%; mkdir -p %REMOTE_DIR% 2>/dev/null; cd %REMOTE_DIR% || echo AVISO: no puedo entrar en %REMOTE_DIR%, abro Claude donde caiga;"
set "REMOTO=%REMOTO% %CONFIAR% command -v claude >/dev/null 2>&1 && exec %CLAUDE_CMD% || exec ${SHELL:-/bin/zsh} -ilc '%CLAUDE_CMD%'"

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
