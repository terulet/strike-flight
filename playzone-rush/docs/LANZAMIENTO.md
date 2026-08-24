# Lanzamiento de la versión nueva

Cómo pasar del alfa de una semana a la versión de lanzamiento, con arranque
limpio y grupos de 25.

**Cuándo: después de medianoche (hora de Madrid).** No es una preferencia, es
un requisito — está explicado abajo.

---

## Por qué después de medianoche

Los retos del día se sortean con una **bolsa** sobre el catálogo de juegos (ver
`src/meta/rotacion.ts`): se reparte el catálogo entero antes de repetir
ninguno, en vez de barajar de cero cada día. El alfa tiene 4 juegos y la
versión nueva tiene 12, así que la combinación del día **cambia** al
desplegar.

Y las marcas se guardan por `challengeId` (`c1`, `c2`, `c3`), **no por juego**,
ni en el móvil ni en el servidor.

Desplegando a media tarde, quien ya jugó hoy tiene un 2.750 guardado en `c1`
que hizo jugando a SNAP; después del despliegue `c1` es RITMO. Su marca queda
colgada del juego equivocado y sus intentos ya están gastados. El ranking del
día se descuadra justo el día que quieres que la gente vea la versión nueva.

El día competitivo rota a medianoche en `Europe/Madrid`. Desplegar después de
esa hora deja el día anterior cerrado y el nuevo empieza ya con los 12 juegos.

---

## Antes de tocar nada: copia de seguridad

```bash
cd ~/playzone-rush/server/data
sqlite3 playzone.db "VACUUM INTO 'alfa-semana1-$(date +%Y%m%d).db'"
ls -lh alfa-semana1-*.db
```

Esa copia es la única prueba de lo que pasó la primera semana. Guárdala fuera
del Mac Mini antes de seguir.

---

## Desplegar

```bash
cd ~/playzone-rush
git fetch origin
git checkout claude/playzone-rush-viral-kg1l61
git pull

npm install          # por si acaso; no hay dependencias nuevas
npm run build        # OBLIGATORIO: el servidor sirve dist/, no las fuentes
```

> **El `build` no es opcional.** El servidor informa de su versión leyendo
> `dist/build-id.txt`. Si haces `pull` sin `build`, sigue sirviendo la build
> vieja mientras dice que es otra, y todos los móviles se quedan con un aviso
> de "hay versión nueva" que no se va nunca. Ya pasó una vez.

### Base de datos nueva

El arranque limpio también es del servidor: el grupo de la primera semana
desaparece.

```bash
pm2 stop playzone
mv server/data/playzone.db server/data/playzone-alfa-semana1.db
pm2 start playzone
```

El servidor crea la base vacía al arrancar. Comprobar:

```bash
curl -s http://127.0.0.1:8788/api/health
```

### Grupos de 25

Ya es el valor por defecto. Para cambiarlo sin tocar código:

```bash
PLAYZONE_MAX_PLAYERS=25 pm2 restart playzone --update-env
```

---

## Qué ve la gente

**No tienen que hacer nada.** Ni borrar datos del navegador, ni reinstalar.

Al abrir la app:

1. La versión nueva detecta que su partida guardada es de la semana de prueba
   y **la borra entera** (migración v5 → v6). Días jugados, récords, racha,
   telemetría, identidad de grupo, preferencias y nombre.
2. También se borra la copia de seguridad de un save roto, si la hubiera: era
   lo único que quedaba escrito en el dispositivo.
3. El service worker cambia de caché (`v3`), así que tampoco sobrevive ningún
   fichero de la versión vieja.
4. Aterrizan en la pantalla de bienvenida **como si abrieran PLAYZONE por
   primera vez**: escriben su nombre y entran al grupo nuevo con el código.

> **El movimiento reducido no se pierde de verdad.** El save vuelve a su valor
> por defecto, pero eso ya no pisa el ajuste del teléfono: quien tenga
> "reducir movimiento" activado en iOS lo sigue teniendo. Antes no era así —
> el valor guardado anulaba al del sistema— y se arregló al preparar esto.

Crea el grupo nuevo tú primero y pasa el código.

---

## Comprobación después de desplegar

```bash
# 1. La versión que se sirve es la que dice servir
curl -s http://127.0.0.1:8788/api/health | grep buildId
cat dist/build-id.txt          # tienen que coincidir

# 2. Hay 12 juegos
grep -c "registerGame(" src/games/index.ts   # cuenta tambien la linea del comentario:
                                               # el numero real esta en GAME_IDS.length

# 3. Desde fuera, con datos móviles y la Wi-Fi apagada
#    (no vale desde el propio Mac: MagicDNS resuelve por dentro)
```

Y en el móvil: abrir, comprobar que sale el **sorteo** de los retos del día,
que hay **12 juegos** en la rotación (los 7 que ya se habían probado más CAZA,
CUENTA, TORRE, TRILE y CARGA) y que el ranking tiene **podio**.

---

## Si algo va mal

Volver atrás es cambiar de rama y reconstruir:

```bash
git checkout claude/playzone-rush-social-kg1l61
npm run build
pm2 restart playzone
```

La base de datos de la semana 1 sigue en `server/data/playzone-alfa-semana1.db`.
Para recuperarla, parar pm2, renombrarla a `playzone.db` y volver a arrancar.

> **Ojo: quien ya haya abierto la versión nueva no vuelve atrás.** Su partida
> está migrada a v6 y la migración es de un solo sentido: ya no tiene nada de
> la semana de prueba, ni siquiera el nombre. Volver a la versión vieja le
> dejaría empezando de cero ahí también.
>
> Por eso el orden importa: **despliega y compruébalo tú antes de pasarle el
> código a nadie.** Mientras no abran la app, para ellos no ha pasado nada.
