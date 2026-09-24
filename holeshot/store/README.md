# HOLESHOT — material para publicar

Todo lo que hace falta para subir el juego a un portal o a una web. Se regenera
con `npm run release` (paquetes) y `node scripts/posters.mjs` (imágenes).

## Paquetes (carpeta `release/`, se generan, no se versionan)

| Archivo | Para qué |
|---|---|
| `holeshot-crazygames.zip` | Subir a CrazyGames. Lleva el SDK v3 integrado. |
| `holeshot-web.zip` | Cualquier hosting estático (itch.io, Netlify, GitHub Pages, tu servidor). Sin anuncios. |
| `holeshot.html` | El juego entero en un solo archivo. |

## Imágenes (esta carpeta)

- `cover-1920x1080.jpg`, `cover-1280x720.jpg`: portada horizontal.
- `portrait-800x1200.jpg`: portada vertical.
- `square-800x800.jpg`: miniatura cuadrada.
- `screenshot-*.jpg`: capturas de juego a 1920×1080.
- `../public/og.jpg` (1200×630): la imagen que sale al pegar el enlace en WhatsApp, X o Discord.

Comprueba en el formulario de cada portal los tamaños exactos que pide; si
alguno no coincide, cambia la lista de `scripts/posters.mjs` y vuelve a generarlas.

## Qué cumple la versión de CrazyGames

- `gameplayStart()` al empezar o reanudar una carrera y `gameplayStop()` en
  menús, pausa y resultados.
- Anuncio **midgame** solo al salir de la pantalla de resultados (repetir,
  siguiente prueba, menú), nunca en mitad de una carrera, como mucho uno
  cada 2,5 minutos y ninguno en los primeros 2,5 minutos.
- El juego se **silencia** mientras dura cualquier anuncio y recupera el sonido al acabar.
- Anuncio **recompensado** opcional: desbloquear una decoración especial en el
  garaje (también se ganan jugando). Nunca da ventaja en carrera.
- `happytime()` en momentos grandes: holeshot, récord, oro, ganar la final,
  ganar un reto.
- Los retos a amigos usan `inviteLink` / `getInviteParam` de CrazyGames, no
  enlaces externos.
- Sin peticiones externas salvo el propio SDK: las fuentes van dentro del juego.
- Funciona con teclado y con pantalla táctil (móvil y tablet).

## Subirlo a CrazyGames (lo tienes que hacer tú: requiere tu cuenta)

1. Entra en el portal de desarrolladores de CrazyGames y crea el juego (HTML5).
2. Sube `release/holeshot-crazygames.zip`.
3. Rellena la ficha con los textos de abajo y sube las imágenes de esta carpeta.
4. Prueba la versión de previsualización que te dan y envíala a revisión.

**Importante:** el juego está solo en español. CrazyGames tiene sobre todo
público en inglés: traducir la interfaz al inglés es lo siguiente que más va a
ayudar a que funcione allí.

## Textos de la ficha

**Nombre:** HOLESHOT

**Categoría:** Driving / Racing — Bike

**Etiquetas:** motocross, dirt bike, physics, stunts, racing, daily challenge, ghost race, 2D

**Descripción corta (EN):**
Physics motocross with a brand-new track every day. Nail the gate drop, flip over the pits and race your friends' ghosts.

**Descripción (EN):**
HOLESHOT is a 2D physics motocross game. Real suspension, real wheel spin, a rider who shifts his weight — and mud that sticks to you and your goggles.
- DAILY MUD: a new track every day, the same for everyone. Set your time and share your result.
- GHOST CHALLENGES: send a link and your friends race against your actual run.
- 5 WORLD TOUR EVENTS: red canyon time trial, quarry gold plates, foggy forest tricks, a sandstorm chasing you and the night stadium final against three rivals.
- Gate drops and the holeshot, backflips and frontflips, perfect landings that pump you forward, nitro, tear-offs to clear your goggles.
- Your own rider: colours, number and name. Unlock gold, neon and carbon liveries.

**Controles (EN):** Up/W throttle · Down/S brake · Left/A lean back · Right/D lean forward · Space nitro · T tear-off · R restart · Esc pause. Touch controls on mobile.

**Descripción (ES):**
HOLESHOT es un motocross 2D de físicas: suspensión de verdad, ruedas que patinan, un piloto que mueve el peso y barro que se te pega a ti y a las gafas.
- BARRO DEL DÍA: una pista nueva cada día, la misma para todo el mundo.
- RETOS CON FANTASMA: manda un enlace y tus amigos corren contra tu vuelta real.
- 5 PRUEBAS: contrarreloj en el cañón, placas en la cantera, trucos en el bosque, huida de la tormenta y la final nocturna contra tres rivales.
- Parrilla y holeshot, mortales, recepciones perfectas con impulso, nitro y tear-offs.
- Tu piloto: colores, dorsal y nombre; decoraciones de oro, neón y carbono.
