# Despliegue en el Mac Mini

PLAYZONE RUSH se autoaloja: un solo proceso Node sirve el frontend y la API,
Tailscale Funnel le pone HTTPS y una URL publica, y pm2 lo mantiene vivo.

Sin dominio que comprar, sin factura mensual, sin cuenta en ningun sitio.

- **URL publica**: `https://mac-mini-de-eloi.tail011c69.ts.net`
- **Proceso**: `playzone` en pm2 (junto a `fichaje`, que ya estaba)
- **Datos**: `server/data/playzone.db` (SQLite, WAL)
- **Copias**: `server/data/backups/` cada 6 h, se guardan las ultimas 28

---

## 1. Preparar la maquina (una sola vez)

El Mac Mini ya tiene Node 26, npm, git, Homebrew, pm2 y Tailscale. Lo unico
que falta es que el CLI de Tailscale este en el PATH: la app de macOS instala
el binario dentro del bundle.

```bash
sudo ln -s /Applications/Tailscale.app/Contents/MacOS/Tailscale /usr/local/bin/tailscale
tailscale status   # tiene que responder sin "command not found"
```

## 2. Traer el codigo y construir

```bash
cd ~/Developer/strike-flight
git fetch origin claude/playzone-rush-social-kg1l61
git checkout claude/playzone-rush-social-kg1l61
git pull origin claude/playzone-rush-social-kg1l61

cd playzone-rush
npm install          # completo, NO --omit=dev: vite y typescript hacen falta para construir
npm run build        # deja dist/ listo
npm test             # 219 tests; si algo falla, parar aqui
```

`npm install` completo es a proposito: el servidor en si no tiene ni una
dependencia (solo la libreria estandar de Node), pero construir el frontend
necesita vite y typescript, que estan en devDependencies.

## 3. Arrancar con pm2

```bash
cd ~/Developer/strike-flight/playzone-rush
pm2 start server/bin/start.mjs --name playzone
pm2 logs playzone --lines 30    # comprobar que arranca y dice el build
```

En el arranque tiene que aparecer algo asi:

```
PLAYZONE RUSH · escuchando en http://0.0.0.0:8787
  build         : 08d59a9
  frontend      : /Users/eloi/Developer/strike-flight/playzone-rush/dist (servido desde aqui)
  base de datos : .../server/data/playzone.db
  backups       : .../server/data/backups (cada 6 h, ultimos 28)
```

Si en `frontend` pone "no encontrado", es que falta `npm run build`.

Comprobacion local antes de exponerlo a internet:

```bash
curl -s http://127.0.0.1:8787/api/health
# {"ok":true,"day":"2026-08-18","streams":0,"buildId":"08d59a9","lastBackup":null}
```

### Que sobreviva a un reinicio

Ojo: en esta maquina pm2 ya gestiona `fichaje`. `pm2 save` guarda **la lista
entera**, asi que hay que hacerlo con los dos procesos arriba, no solo con
PLAYZONE.

```bash
pm2 startup           # imprime un comando con sudo; ejecutarlo tal cual
pm2 save              # guarda playzone Y fichaje
pm2 list              # los dos tienen que estar "online"
```

## 4. HTTPS y URL publica con Tailscale Funnel

Funnel expone un puerto local a internet con certificado valido. La primera
vez hay que habilitarlo en la consola de administracion de Tailscale (te dara
el enlace exacto si no lo esta).

```bash
tailscale funnel --bg 8787
tailscale funnel status
```

Y desde fuera de casa (datos moviles, no wifi):

```
https://mac-mini-de-eloi.tail011c69.ts.net
```

Esa URL es estable: sobrevive a reinicios y a cambios de IP del router.

> **Sobre privacidad**: Funnel hace la app accesible desde internet a quien
> tenga la URL. No esta indexada y no se anuncia en ningun sitio, pero no es
> secreta. Para una alfa de cinco personas es el equilibrio correcto; entrar
> a un grupo sigue necesitando el codigo de invitacion.

## 5. Comprobacion real con dos redes distintas

Esto no se puede simular: hay que hacerlo con dispositivos de verdad.

1. **iPhone A por wifi de casa**: abrir la URL, crear grupo, anotar el codigo.
2. **iPhone B con wifi APAGADO, solo datos moviles**: abrir la URL, entrar con
   ese codigo. Es imprescindible que el wifi este apagado de verdad — si no,
   los dos moviles salen por el mismo sitio y no se prueba nada.
3. Jugar un reto en A y mirar B **sin tocarlo**: el ranking tiene que moverse
   solo en pocos segundos (va por SSE).
4. Jugar en B hasta pasar a A: en A tiene que saltar el aviso de adelantamiento
   y el boton de REVANCHA.
5. Poner B en modo avion, jugar una partida, volver a activar la red: la marca
   tiene que subir sola y el indicador pasar de PENDIENTE a ONLINE.

## 6. Instalar en la pantalla de inicio

En cada iPhone, con Safari (Chrome en iOS no puede instalar):

1. Abrir la URL.
2. Boton de compartir → **Anadir a pantalla de inicio**.
3. Abrir desde el icono: tiene que salir a pantalla completa, sin barra de
   direcciones y con el fondo oscuro de la marca.

## 7. Actualizar a una version nueva

```bash
cd ~/Developer/strike-flight
git pull origin claude/playzone-rush-social-kg1l61
cd playzone-rush
npm install
npm run build
pm2 restart playzone
```

Los moviles se enteran solos: `index.html`, el manifest y `sw.js` se sirven
con `no-cache`, y los ficheros de `assets/` llevan hash en el nombre. En la
portada aparece **HAY UNA VERSION NUEVA · ACTUALIZAR**. Nunca interrumpe una
partida en curso.

## 8. Datos y copias de seguridad

- La base de datos es un fichero: `server/data/playzone.db`.
- Cada 6 h se hace una copia con `VACUUM INTO`, que es seguro con el servidor
  escribiendo (a diferencia de copiar el fichero a pelo). Se guardan las
  ultimas 28, o sea una semana entera.
- Cada copia es una base de datos valida por si sola: se abre con cualquier
  cliente de SQLite, sin necesitar ni WAL ni el original.
- Time Machine, si esta activo, ya cubre esa carpeta como cualquier otra.

Copia manual antes de tocar nada:

```bash
cd ~/Developer/strike-flight/playzone-rush
sqlite3 server/data/playzone.db "VACUUM INTO 'server/data/backups/manual-$(date +%Y%m%d-%H%M).db'"
```

Restaurar:

```bash
pm2 stop playzone
cd ~/Developer/strike-flight/playzone-rush/server/data
mv playzone.db playzone.db.roto
cp backups/LA-QUE-TOQUE.db playzone.db
pm2 start playzone
```

## 9. Ver como va la semana

Con la sesion iniciada en un movil del grupo, anadir `?dashboard` a la URL:

```
https://mac-mini-de-eloi.tail011c69.ts.net/?dashboard
```

Retencion D1/D3/D7, Revenge Rate, intentos usados, reto diario completado,
Organic Reopen Rate y los errores registrados. **Es solo lectura**: esa
pantalla no puede modificar ni un resultado. El panel de debug (`?debug`), que
si puede mover el dia y forzar partidas, es otro sitio distinto a proposito.

## 10. Cuando algo va mal

| Sintoma | Que mirar |
|---|---|
| La URL no responde desde fuera | `tailscale funnel status` y `pm2 list` |
| Carga pero sin datos | `curl http://127.0.0.1:8787/api/health` en el propio Mac |
| Se ve una version vieja | `pm2 logs playzone` y comprobar el `build` del arranque |
| Un movil no sincroniza | Mirar el indicador de red en la portada (PENDIENTE = cola llena, sube sola) |
| Algo revienta | `?dashboard`, seccion ERRORES; y `pm2 logs playzone --err` |

Si el proceso se cae por una excepcion no capturada, queda registrada en la
tabla de errores **antes** de salir, y pm2 lo reinicia. O sea: la caida se
puede investigar despues, no desaparece.
