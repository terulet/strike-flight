# ASSET_INTEGRATION_REPORT.md — MEGA ASSET PACK v1

Visual integration pass: 12 production PNGs from `CRASHPOINT_MEGA_ASSET_PACK_v1` wired into
THE TOWER. Physics, colliders, joints, materials, damage math, score, chain-reaction logic and
level layout are **unchanged** — this pass only touched `src/assets/`, `src/render/`, and the
`assetId` fields (and 5 new decor-only entries) in `src/game/TheTower.ts`.

## Files modified / added

- `src/assets/AssetManifest.ts` — added `status`/`productionFile`, added 12 production entries,
  8 reference_only entries, 3 new categories (`weak_points`, `breakables`, `machinery`), renamed
  4 ids to match the pack's canonical `placeholder_id` naming (see "ID renames" below).
- `src/assets/registerProductionAssets.ts` (new) — loads every `status: 'production'` asset into
  `AssetRegistry` at startup.
- `src/main.ts` — awaits `registerProductionAssets()` before booting `Game` (no placeholder flash).
- `src/render/spriteFit.ts` (new) — per-asset fit/pivot/rotation rules so a real PNG can sit on a
  collider it wasn't drawn at the same aspect ratio as, without ever resizing the collider.
- `src/render/Renderer.ts` — pieces/decor/projectiles now check `AssetRegistry` first and draw the
  real sprite (with a damage-crack overlay + broken tint on top); falls back to the existing
  procedural placeholder automatically for anything not yet in production. Added an `'accent'`
  decor layer drawn after structural pieces (weak-point markers, gussets). Drill Spike now rotates
  to face its velocity heading instead of the raw (tumbling) physics angle.
- `src/assets/PlaceholderRenderer.ts` — extracted `drawDamageCracks`/`drawBrokenTint` so the same
  damage feedback works on both procedural placeholders and real sprites.
- `src/game/LevelSchema.ts` — `DecorSpec` gained `layer: 'accent'`, `rotationDeg`, `flipX`.
- `src/game/TheTower.ts` — retargeted 9 pieces' `assetId` to production/reference_only ids (see
  table below) and added 5 non-physical decor accents (2 triangular braces, 2 hinge markers, 1
  junction marker) at column bases and beam-column joints.
- `public/assets/production/**` — the 12 approved PNGs, downscaled to a max 800px edge
  (17MB → 5.9MB) for runtime; untouched originals stay in the uploaded pack.
- `docs/ASSET_REQUIREMENTS.md`, `docs/asset-manifest.json` — regenerated from the updated manifest.
- `docs/ASSETS_PENDING_FINAL.md` (new) — see below.

## ID renames (pack `placeholder_id` → engine canonical id)

The pack's `asset-manifest.json` used slightly different ids than the prototype's existing
`AssetManifest.ts`. Rather than keep a permanent translation table, the engine's ids were renamed
to match the pack's naming once — future packs should now be a pure drop-in:

| Old id | New id | Entity |
|---|---|---|
| `prop_glass_panel_placeholder` | `break_glass_panel_placeholder` | `glass_panel` |
| `structure_joint_bolt_placeholder` | `mach_crane_hook_placeholder` | `crane_hook` |
| `structure_walkway_metal_placeholder` | `structure_platform_walkway_placeholder` | `walkway_floor2` |
| `environment_cable_placeholder` | `weak_tension_cable_placeholder` | `cable_counterweight`, `crane_cable` |
| `prop_gas_tank_placeholder` | `react_gas_tank_placeholder` | `gas_tank` |
| `prop_generator_placeholder` | `react_generator_placeholder` | `generator` |
| `prop_counterweight_placeholder` | `react_counterweight_placeholder` | `counterweight_ball` |

## Scale / pivot adjustments

- **Columns** (`structure_column_concrete/steel_placeholder`): fit = match collider **height**
  (560 world-units), keep art aspect, let width overflow — the art's pedestal shape is much wider
  relative to its height than the 74-unit-wide collider. Pivot centered.
- **Beams / walkway** (`structure_beam_metal_placeholder`, `structure_platform_walkway_placeholder`):
  fit = match collider **width**, let height overflow (the art's natural thickness reads better
  than squashing rivets/text to the collider's 20–36px height). Walkway pivots at 38% down (its
  grated deck line, not the image's bounding-box center, which sits in the leg-strut area).
- **Tension cable** (`weak_tension_cable_placeholder`): the source art is a **horizontal**
  tensioner with end fittings; rotated 90° for the game's vertical cables, with the collider's
  width/height swapped before fitting (`swapAxesForFit`) so the rotated sprite fills the actual
  cable length instead of rendering as a sliver.
- **Crane hook** (`mach_crane_hook_placeholder`): fixed 70×70 world-unit size (`fit: 'fixed'`,
  contained to the art's own aspect) instead of the tiny 28px-diameter collider — the collider
  stays tiny and precise for gameplay, the visual reads as a real hook. Pivot at the top mounting
  bracket (12% down), matching `joint_crane_cable_hook`'s attach point.
- **Drill Spike**: rotation offset of −27° baked in (the art's drill tip points down-right at that
  angle in source) plus a 2.6× scale so the detailed model reads at gameplay zoom; rendered facing
  its velocity heading rather than physics spin.
- **Impact Core**: 2.2× scale over its raw 32px collider diameter — otherwise the detailed sculpt
  was unreadably small on screen.
- **Weak-point/brace decor** (`weak_hinge_heavy_placeholder`, `weak_junction_core_placeholder`,
  `structure_brace_triangular_placeholder`): no physics body; sized to their own declared decor
  box (`fit: 'stretch'`), placed at column bases and beam-column joints to sell "this looks
  important" without any on-screen text (section 8).

## Piece → asset table

| Piece / entity | assetId | Status |
|---|---|---|
| `col_left` | `structure_column_concrete_placeholder` | ✅ production |
| `col_right` | `structure_column_steel_placeholder` | ✅ production (cosmetic variant; material stays `concrete`) |
| `beam_roof`, `beam_floor1/2/3` | `structure_beam_metal_placeholder` | ✅ production |
| `walkway_floor2` | `structure_platform_walkway_placeholder` | ✅ production |
| `glass_panel` | `break_glass_panel_placeholder` | ✅ production |
| `crane_hook` | `mach_crane_hook_placeholder` | ✅ production |
| `cable_counterweight`, `crane_cable` | `weak_tension_cable_placeholder` | ✅ production (rotated 90°) |
| Impact Core projectile | `projectile_impact_core_placeholder` | ✅ production |
| Drill Spike projectile | `projectile_drill_spike_placeholder` | ✅ production |
| 5 decor accents (braces/hinges/junction) | `structure_brace_triangular_placeholder`, `weak_hinge_heavy_placeholder`, `weak_junction_core_placeholder` | ✅ production (decor-only, no physics body) |
| `platform_floor1/2/3` | `structure_platform_wood_placeholder` | ⬜ placeholder (no wood-platform art in this pack) |
| Pulse Orb projectile | `projectile_pulse_orb_placeholder` | 🟡 reference_only |
| `gas_tank` | `react_gas_tank_placeholder` | 🟡 reference_only |
| `generator` | `react_generator_placeholder` | 🟡 reference_only |
| `counterweight_ball` | `react_counterweight_placeholder` | 🟡 reference_only |
| `crane_load` | `prop_suspended_load_placeholder` | ⬜ placeholder (not in this pack) |
| Shock Capsule / Split Node | `projectile_shock_capsule_placeholder` / `projectile_split_node_placeholder` | 🟡 reference_only, **registered but not wired to any gameplay mechanic yet** (section 9 — no new mechanics added) |
| Explosive barrel / magnet | `react_explosive_barrel_placeholder` / `react_magnet_placeholder` | 🟡 reference_only, **no entity in THE TOWER yet** — catalog-only for a future level pass |

Full machine-readable table: `docs/asset-manifest.json`.

## Tests

`npm test` → **50/50 passed** (unchanged suite; no test needed a rewrite — the visual layer sits
strictly behind the existing `pieces`/`assetId` contract). Includes the strict stability tests
(`tests/stability.test.ts`): 10s idle simulation → 0% destruction, no piece breaks, no piece body
overlaps another at spawn.

`npm run build` → clean (`tsc --noEmit` + `vite build`), bundle 155.7KB JS (was 138.6KB) +
5.9MB of production PNGs served from `public/assets/production/` (resized from the pack's
original 17MB; originals untouched in the uploaded ZIPs).

## QA pass (Playwright, desktop 1280×800 + mobile 390×844)

- ✅ No black rectangles / concept-sheet backgrounds in gameplay — every production PNG has a
  verified real alpha channel (checked pixel-by-pixel at the four corners of each file before
  integration; all fully transparent).
- ✅ 10s idle stability — automated test + a fresh Playwright run of the actual page, both clean.
- ✅ Identical shots remain deterministic — physics/launch code untouched.
- ✅ Retry / no duplicate bodies — untouched (`PhysicsWorld.reset()` path not touched by this pass).
- ✅ Chain Reaction causality — untouched logic; visually confirmed a chained break (crane boom →
  cable → hook) still fires `CHAIN x…` and camera focus correctly with real sprites on screen.
- ✅ Score/medal thresholds — untouched (`ScoreSystem.ts` not modified).
- ✅ Desktop + mobile viewport both load, aim, and fire without console errors.
- ⚠️ No obvious sprite/collider mismatch **at the collider itself** (verified with the debug
  collider overlay) — art overflows the collider on purpose for columns/beams/walkway per the
  scale notes above; that overflow is visual only and doesn't change hit detection.
- ✅ Performance: 60 FPS steady in the debug overlay before and after integration on the same
  machine; bundle grew by ~6MB of images (see "Performance" above), no frame drop observed.

## Problems found (real, not cosmetic nitpicks)

1. **`weak_tension_cable_placeholder` rendered as a near-invisible sliver** before a fit-axis fix:
   the source art is horizontal, and naively fitting it to the (thin, 10-unit-wide) unrotated
   collider width produced a tiny image even after rotating it 90° for display. Fixed by adding
   `swapAxesForFit` to `spriteFit.ts` so the fit target uses the collider's long axis. Verified
   visually after the fix (screenshots in this report's before/after set).
2. **Steel column has no matching `material`** — `col_right` now *looks* like steel but its
   `material` is still `'concrete'` (toughness/fragility/color-in-fallback unchanged), per the
   "art never redefines physics" rule. This is cosmetically slightly inconsistent (a steel-looking
   column has concrete's damage stats) but intentional for this pass — flagging it as a possible
   *balance* decision for a future pass, not fixing it here.
3. **Mobile viewport shows extra empty space above/below the scene** — the camera's
   `BASE_VIEW_WIDTH` is a fixed horizontal-units constant, so a tall/narrow viewport doesn't crop
   width, it just reveals more sky/ground. Pre-existing (not caused by this pass); the scene is
   still legible at mobile size, but worth a camera pass later.

## 32. Inventario final

| Asset ID | Archivo | Integrado | Entidad/función | Estado |
|---|---|---|---|---|
| `projectile_impact_core_placeholder` | public/assets/production/projectiles/PROJ_IMPACT_CORE_01.png | sí | Proyectil pesado de impacto | PRODUCTION_INTEGRATED |
| `projectile_drill_spike_placeholder` | public/assets/production/projectiles/PROJ_DRILL_SPIKE_01.png | sí | Proyectil perforante | PRODUCTION_INTEGRATED |
| `projectile_pulse_orb_placeholder` | (sin archivo — placeholder procedural) | no | Proyectil de onda de choque | REFERENCE_ONLY |
| `projectile_shock_capsule_placeholder` | (sin archivo — placeholder procedural) | no | Proyectil futuro, aún sin mecánica de gameplay | REFERENCE_ONLY |
| `projectile_split_node_placeholder` | (sin archivo — placeholder procedural) | no | Proyectil futuro, aún sin mecánica de gameplay | REFERENCE_ONLY |
| `projectile_launcher_placeholder` | (sin archivo — placeholder procedural) | no | Dispositivo de lanzamiento del jugador (izquierda de pantalla) | PENDING |
| `structure_column_concrete_placeholder` | public/assets/production/structures/STRUCT_COLUMN_CONCRETE_01.png | sí | Soporte vertical primario de la torre | PRODUCTION_INTEGRATED |
| `structure_column_steel_placeholder` | public/assets/production/structures/STRUCT_COLUMN_STEEL_01.png | sí | Soporte vertical primario de la torre (variante acero) | PRODUCTION_INTEGRATED |
| `structure_beam_metal_placeholder` | public/assets/production/structures/STRUCT_BEAM_STEEL_01.png | sí | Soporte horizontal / unión entre plantas | PRODUCTION_INTEGRATED |
| `structure_brace_triangular_placeholder` | public/assets/production/structures/STRUCT_BRACE_TRIANGULAR_01.png | sí | Refuerzo decorativo en la base de columnas / esquinas de vigas (sin cuerpo físico propio) | PRODUCTION_INTEGRATED |
| `structure_platform_wood_placeholder` | (sin archivo — placeholder procedural) | no | Suelo de planta, secundaria | PENDING |
| `structure_platform_walkway_placeholder` | public/assets/production/structures/STRUCT_PLATFORM_WALKWAY_01.png | sí | Conexión entre plataformas / voladizo | PRODUCTION_INTEGRATED |
| `weak_hinge_heavy_placeholder` | public/assets/production/weak_points/WEAK_HINGE_HEAVY_01.png | sí | Marcador decorativo de unión estructural crítica (sin cuerpo físico propio) | PRODUCTION_INTEGRATED |
| `weak_junction_core_placeholder` | public/assets/production/weak_points/WEAK_JUNCTION_CORE_01.png | sí | Marcador decorativo de nodo estructural crítico (sin cuerpo físico propio) | PRODUCTION_INTEGRATED |
| `weak_tension_cable_placeholder` | public/assets/production/weak_points/WEAK_TENSION_CABLE_01.png | sí | Cable de contrapeso / carga de grúa — punto débil de baja resistencia | PRODUCTION_INTEGRATED |
| `break_glass_panel_placeholder` | public/assets/production/breakables/BREAK_GLASS_PANEL_01.png | sí | Panel frágil, rotura inmediata | PRODUCTION_INTEGRATED |
| `mach_crane_hook_placeholder` | public/assets/production/machinery/MACH_CRANE_HOOK_01.png | sí | Gancho pesado que sostiene la carga suspendida | PRODUCTION_INTEGRATED |
| `prop_crate_wood_placeholder` | (sin archivo — placeholder procedural) | no | Prop dinámico ligero | PENDING |
| `prop_barrel_metal_placeholder` | (sin archivo — placeholder procedural) | no | Prop dinámico rodante | PENDING |
| `react_gas_tank_placeholder` | (sin archivo — placeholder procedural) | no | Elemento reactivo explosivo | REFERENCE_ONLY |
| `react_explosive_barrel_placeholder` | (sin archivo — placeholder procedural) | no | Prop reactivo futuro, aún no colocado en THE TOWER | REFERENCE_ONLY |
| `react_magnet_placeholder` | (sin archivo — placeholder procedural) | no | Prop reactivo futuro, aún no colocado en THE TOWER | REFERENCE_ONLY |
| `react_counterweight_placeholder` | (sin archivo — placeholder procedural) | no | Masa suspendida por cable, libera carga al cortarse | REFERENCE_ONLY |
| `prop_suspended_load_placeholder` | (sin archivo — placeholder procedural) | no | Masa pesada colgada de la grúa | PENDING |
| `react_generator_placeholder` | (sin archivo — placeholder procedural) | no | Maquinaria decorativa/reactiva | REFERENCE_ONLY |
| `prop_pipe_placeholder` | (sin archivo — placeholder procedural) | no | Prop decorativo/dinámico | PENDING |
| `prop_truck_placeholder` | (sin archivo — placeholder procedural) | no | Vehículo decorativo en la base del escenario | PENDING |
| `environment_crane_placeholder` | (sin archivo — placeholder procedural) | no | Estructura de grúa que sostiene la carga suspendida | PENDING |
| `environment_chain_placeholder` | (sin archivo — placeholder procedural) | no | Alternativa visual al cable en soportes pesados | PENDING |
| `environment_chain_placeholder` | (sin archivo — placeholder procedural) | no | Alternativa visual al cable en soportes pesados | PENDING |
| `environment_ground_placeholder` | (sin archivo — placeholder procedural) | no | Terreno base de la instalación | PENDING |
| `environment_decor_pipes_placeholder` | (sin archivo — placeholder procedural) | no | Relleno visual no interactivo | PENDING |
| `environment_decor_sign_placeholder` | (sin archivo — placeholder procedural) | no | Ambientación / identidad de marca del mundo | PENDING |
| `background_sky_industrial_placeholder` | (sin archivo — placeholder procedural) | no | Fondo lejano con parallax | PENDING |
| `background_skyline_placeholder` | (sin archivo — placeholder procedural) | no | Capa media de parallax | PENDING |
| `destruction_debris_wood_placeholder` | (sin archivo — placeholder procedural) | no | Debris visual tras rotura | PENDING |
| `destruction_debris_metal_placeholder` | (sin archivo — placeholder procedural) | no | Debris visual tras rotura | PENDING |
| `destruction_debris_concrete_placeholder` | (sin archivo — placeholder procedural) | no | Debris visual tras rotura | PENDING |
| `destruction_shatter_glass_placeholder` | (sin archivo — placeholder procedural) | no | Debris visual de cristal | PENDING |
| `fx_explosion_placeholder` | (sin archivo — placeholder procedural) | no | Sprite/partícula de explosión | PENDING |
| `fx_dust_placeholder` | (sin archivo — placeholder procedural) | no | Partícula de polvo en impactos y colapsos | PENDING |
| `fx_spark_placeholder` | (sin archivo — placeholder procedural) | no | Partícula de impacto metálico | PENDING |
| `fx_smoke_placeholder` | (sin archivo — placeholder procedural) | no | Post-explosión / incendio visual | PENDING |
| `ui_icon_impact_core` | (sin archivo — placeholder procedural) | no | Selector de proyectil (HUD) | PENDING |
| `ui_icon_drill_spike` | (sin archivo — placeholder procedural) | no | Selector de proyectil (HUD) | PENDING |
| `ui_icon_pulse_orb` | (sin archivo — placeholder procedural) | no | Selector de proyectil (HUD) | PENDING |
| `ui_logo_crashpoint` | (sin archivo — placeholder procedural) | no | Pantalla de título | PENDING |
| `ui_button_demolish` | (sin archivo — placeholder procedural) | no | CTA principal pantalla de título | PENDING |
| `ui_medal_bronze` | (sin archivo — placeholder procedural) | no | Pantalla de resultado | PENDING |
| `ui_medal_silver` | (sin archivo — placeholder procedural) | no | Pantalla de resultado | PENDING |
| `ui_medal_gold` | (sin archivo — placeholder procedural) | no | Pantalla de resultado | PENDING |
| `ui_medal_crashpoint` | (sin archivo — placeholder procedural) | no | Pantalla de resultado especial | PENDING |
