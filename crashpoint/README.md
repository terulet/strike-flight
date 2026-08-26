# CRASHPOINT — THE TOWER

Vertical slice de **CRASHPOINT**: física + demolición + precisión + reacciones en cadena.
Prototipo jugable de PLAYZONE con arte 100% placeholder (geometría/colores procedurales) y
arquitectura preparada para sustituir esos placeholders por el arte final (MEGA ZIP) sin tocar
el gameplay.

## Ejecutar en local

```bash
cd crashpoint
npm install
npm run dev        # http://localhost:5173 (o la IP de la máquina, --host 0.0.0.0)
```

Otros comandos:

```bash
npm run build       # typecheck + build de producción a dist/
npm run preview     # sirve el build de producción
npm test            # vitest run (suite completa)
npm run test:watch  # vitest en modo watch
npm run typecheck   # tsc --noEmit
```

Parámetros de URL útiles durante el desarrollo:

- `?debug=1` — abre el panel de debug ya activado al cargar (también se puede alternar con la
  tecla **D** en cualquier momento).

## Controles

**PC:** clic y arrastra desde el lanzador (abajo a la izquierda) para apuntar; suelta para
disparar. Selecciona el proyectil con los botones inferiores antes de disparar.

**Móvil / táctil:** igual, con gestos táctiles (touch-action está deshabilitado en el canvas
para evitar scroll/zoom accidental del navegador).

**Debug:** tecla `D` alterna el panel de debug (FPS, colliders, integridad de piezas,
disparos ilimitados, desactivar slow motion, reset de nivel).

## Estructura del proyecto

```
src/
  core/        EventBus, GameLoop (timestep fijo + timeScale), Telemetry, Persistence, types
  physics/     Wrapper de Matter.js + definición de materiales (madera/metal/hormigón/cristal/cable/explosivo)
  entities/    GameEntity (physics+visual separados), StructuralPiece, Projectile
  game/        LevelSchema + THE_TOWER (datos + builder del nivel)
  systems/     DamageSystem, ChainReactionSystem, ScoreSystem, CameraSystem, ShotSystem,
               SlowMotionSystem, ExplosionSystem, ParticleSystem, EndConditionSystem
  audio/       AudioEngine (SFX 100% procedural vía WebAudio)
  assets/      AssetManifest / AssetRegistry / PlaceholderRenderer (capa de assets, sección 37)
  render/      Renderer (Canvas2D, cámara world↔screen)
  ui/          StartScreen, HUD, ResultScreen (+ styles.css)
  debug/       DebugOverlay
  Game.ts      Orquestador — conecta todos los sistemas y gestiona el ciclo de vida de la partida
  main.ts      Punto de entrada
docs/
  ASSET_REQUIREMENTS.md   Catálogo completo de assets a fabricar (humano)
  asset-manifest.json     Mismo catálogo en formato máquina
  SCALE.md                Escala, pivotes y convenciones visuales
tests/         Suite de vitest (ver npm test)
```

Ver el prompt original / informe de entrega para el detalle de cada sistema.
