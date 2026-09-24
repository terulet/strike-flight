# HOLESHOT — Gira Mundial del Barro

Motocross 2D de físicas hecho con Vite + TypeScript + Canvas 2D. Todo el arte es
vectorial y se dibuja en tiempo real (sin imágenes) y el sonido se sintetiza con
WebAudio (sin archivos de audio).

## Arrancar

```bash
npm install
npm run dev        # http://localhost:5173 (también escucha en la red local)
npm test           # 79 pruebas: física, barro, las 5 pruebas y 30 días de Barro del Día con el bot, rivales, fantasmas, progreso
npm run build      # typecheck + build en dist/
npm run preview    # sirve dist/ en http://localhost:4173
```

Publicar:

```bash
npm run release          # pruebas aparte: construye web + CrazyGames y deja en release/
                         #   holeshot-web.zip, holeshot-crazygames.zip y holeshot.html
node scripts/posters.mjs # regenera store/*.jpg y public/og.jpg (necesita Playwright)
```

- **Web pública**: el contenido de `dist/` (o `release/holeshot-web.zip`) va en
  cualquier hosting estático. Con `VITE_PUBLIC_URL=https://…/holeshot/` las
  tarjetas de vista previa de WhatsApp/X llevan imagen.
- **CrazyGames**: `release/holeshot-crazygames.zip` lleva su SDK v3 integrado
  (`src/platform/platform.ts`). Ficha, textos e imágenes en `store/`.
- **GitHub Actions** (`.github/workflows/holeshot.yml`): en cada push que toque
  `holeshot/` pasa las pruebas y deja los tres paquetes como artefacto.

Parámetros de URL: `?mission=N` abre directamente la prueba N (1–5);
`?daily=1` el Barro del Día; `?autoplay=1` la conduce el piloto automático.

## Controles

| Acción | Teclado | Táctil |
|---|---|---|
| Gas | ↑ / W | GAS |
| Freno | ↓ / S | FRENO |
| Cuerpo atrás (morro arriba / mortal atrás) | ← / A | ◀ |
| Cuerpo adelante (morro abajo / mortal adelante) | → / D | ▶ |
| Nitro | Espacio / Shift | N₂O |
| Tear-off (limpiar el barro de las gafas) | T | TEAR |
| Reiniciar | R | menú de pausa |
| Pausa | Esc / P | botón II |
| Sonido | M | menú de pausa |

## La gira

| # | Prueba | Mundo | Objetivo |
|---|---|---|---|
| 1 | Cañón Rojo | Arizona al atardecer | Contrarreloj |
| 2 | La Cantera | Cantera de León | Recoger 10 placas doradas (fosos con agua) |
| 3 | Bosque de Niebla | Selva Negra | Trucos: mortales, recepciones perfectas y combos |
| 4 | Tormenta de Arena | Erg Chebbi | Huir de un muro de arena que te persigue |
| 5 | Estadio Nocturno | Supercross en París | La final: ritmos, whoops, triples y el salto de fuego |

## Para jugar cada día y retar a los amigos

- **Barro del Día**: una pista nueva cada día a medianoche, generada a partir
  de la fecha, la misma para todo el mundo (como un Wordle de motocross).
  Rota entre los cinco mundos. Se valida en las pruebas automáticas.
- **Enlaces de reto**: al terminar, «COPIAR Y RETAR» copia un resumen con un
  emoji por tramo (🟩 limpio, 🔄 mortal, 🟨 recepción cruzada, 💥 caída) y un
  enlace `#reto-…` que lleva dentro tu vuelta. Quien lo abre corre la misma
  pista contra tu fantasma, ve la diferencia en directo y puede devolverte el
  reto. No hace falta servidor: todo viaja en el enlace (~2 KB).
- **Fantasma propio**: tu mejor vuelta de cada pista queda guardada y corre
  contigo.
- **Clip vertical 9:16**: «CLIP VERTICAL» monta un vídeo de tu mejor salto con
  cámara lenta y una tarjeta final con tu tiempo, listo para TikTok, Reels o
  Shorts (en el móvil se comparte directamente).
- **Garaje**: colores, dorsal y nombre; salen en tu fantasma, tu clip y tu
  portada. Decoraciones especiales (oro, neón, carbono) que se ganan jugando
  o, en CrazyGames, viendo un anuncio voluntario. Nunca dan ventaja.
- Enlace directo al reto diario: `#diario`.

## Lo que no has visto en otro juego de motos

- **Parrilla y holeshot**: la parrilla cae de verdad. Da gas en el último momento
  (medidor verde) para una salida perfecta; si lo aprietas demasiado pronto, la
  rueda patina. El primero en la primera curva gana el HOLESHOT (+500 y nitro).
- **Rivales con tu misma física** en la tormenta y en la final: van por
  carriles al fondo de la pista, se caen, reaparecen y a los que se caen se los
  traga la tormenta.
- **Barro que se queda**: los charcos resbalan y frenan; moto y piloto se van
  manchando durante la carrera.
- **Tear-offs**: el barro de tus charcos y el que escupe la rueda del rival que
  llevas delante se pega a la pantalla. Arranca una lámina (T) para limpiarla:
  solo hay cinco por carrera.
- **Cámara lenta de cine** en los saltos más grandes y **portada de revista**
  al final con la foto de tu mejor salto y titulares de tu carrera.

Cada prueba da bronce (terminar), plata u oro (en la final: 1.º oro, 2.º plata). Una medalla desbloquea la
siguiente. El progreso se guarda en `localStorage` (`holeshot:v1`).

## Cómo está hecho

- `src/physics/bike.ts` — cuerpo rígido con dos ruedas: suspensión
  muelle‑amortiguador con tope, ruedas con giro e inercia propios, tracción por
  deslizamiento real, par motor con reacción (caballitos), frenada que hunde la
  horquilla, control del cuerpo en suelo y en el aire. Paso fijo de 120 Hz con 8
  subpasos.
- `src/physics/trackBuilder.ts` — DSL de piezas (rampas, recepciones, huecos con
  foso, mesas, step‑ups, cortados, whoops, troncos, pedregales, neumáticos).
  Los obstáculos son relieve real y su dibujo se coloca sobre ese relieve.
- `src/game/race.ts` — reloj, parrilla, holeshot, checkpoints, caídas y
  reaparición, trucos, combo, nitro, placas, la tormenta y los rivales.
- `src/game/daily.ts` — generador del Barro del Día.
- `src/game/ghost.ts` — grabación y codificación de fantasmas para los enlaces.
- `src/game/rival.ts` — rivales conducidos por el piloto automático con ritmo
  propio.
- `src/game/missions.ts` — las cinco pistas, sus temas visuales y medallas.
- `src/game/racingLine.ts` — coloca las placas aéreas sobre la trazada real.
- `src/game/autopilot.ts` — piloto automático que usa solo los mandos del
  jugador (demo del menú, `?autoplay=1` y pruebas).
- `src/render/` — cámara, fondo con paralaje, terreno con estratos, moto y
  piloto articulado (IK de dos huesos con muelles), partículas y clima.
- `src/ui/` — HUD, menús, mandos de teclado y táctiles.
- `src/render/lens.ts` — barro en las gafas y tear-offs.
- `src/ui/cover.ts` — portada de revista.
- `src/ui/share.ts` y `src/ui/clip.ts` — resumen para compartir y clip vertical.
- `src/platform/platform.ts` — web o CrazyGames (anuncios, eventos de partida, invitaciones).
- `src/audio/sfx.ts` — motor monocilíndrico, golpes, público y efectos.
