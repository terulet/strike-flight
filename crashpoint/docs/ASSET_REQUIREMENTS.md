# ASSET_REQUIREMENTS.md

CRASHPOINT — THE TOWER. Catálogo completo de assets visuales.

- Ver también: `docs/asset-manifest.json` (mismo catálogo en formato máquina),
  `docs/SCALE.md` (escala px/metro y convenciones de pivote/orientación) y
  `docs/ASSET_INTEGRATION_REPORT.md` / `docs/ASSETS_PENDING_FINAL.md` (estado de MEGA_ASSET_PACK_v1).
- Cada asset se referencia en el código exclusivamente por su `ID` (ver
  `src/assets/AssetManifest.ts` → `AssetRegistry` → `PlaceholderRenderer` / `src/render/Renderer.ts`).
  Nunca hay rutas de archivo hardcodeadas fuera de esa capa.
- **Total: 52 assets · 12 en producción (integrados) · 8 reference_only (pendientes) · 32 placeholder.**

## Proyectiles (5)

### `projectile_impact_core_placeholder` — ✅ PRODUCTION (integrado)

- **Nombre:** Impact Core
- **Función:** Proyectil pesado de impacto
- **Dimensiones recomendadas:** 64 × 64 px
- **Transparencia:** sí (PNG con alpha)
- **Orientación:** lateral
- **Pivote:** center
- **Archivo en producción:** `public/assets/production/projectiles/PROJ_IMPACT_CORE_01.png`
- **Animación:** rotación en vuelo (opcional)

### `projectile_drill_spike_placeholder` — ✅ PRODUCTION (integrado)

- **Nombre:** Drill Spike
- **Función:** Proyectil perforante
- **Dimensiones recomendadas:** 64 × 32 px
- **Transparencia:** sí (PNG con alpha)
- **Orientación:** lateral
- **Pivote:** center
- **Archivo en producción:** `public/assets/production/projectiles/PROJ_DRILL_SPIKE_01.png`
- **Animación:** rotación alineada a la velocidad

### `projectile_pulse_orb_placeholder` — 🟡 REFERENCE_ONLY (pendiente arte final)

- **Nombre:** Pulse Orb
- **Función:** Proyectil de onda de choque
- **Dimensiones recomendadas:** 48 × 48 px
- **Transparencia:** sí (PNG con alpha)
- **Orientación:** lateral
- **Pivote:** center
- **Animación:** pulso/brillo continuo + flash al activarse

### `projectile_shock_capsule_placeholder` — 🟡 REFERENCE_ONLY (pendiente arte final)

- **Nombre:** Shock Capsule (futuro)
- **Función:** Proyectil futuro, aún sin mecánica de gameplay
- **Dimensiones recomendadas:** 64 × 48 px
- **Transparencia:** sí (PNG con alpha)
- **Orientación:** lateral
- **Pivote:** center

### `projectile_split_node_placeholder` — 🟡 REFERENCE_ONLY (pendiente arte final)

- **Nombre:** Split Node (futuro)
- **Función:** Proyectil futuro, aún sin mecánica de gameplay
- **Dimensiones recomendadas:** 56 × 56 px
- **Transparencia:** sí (PNG con alpha)
- **Orientación:** lateral
- **Pivote:** center

## Estructura (primaria y secundaria) (6)

### `structure_column_concrete_placeholder` — ✅ PRODUCTION (integrado)

- **Nombre:** Columna de hormigón
- **Función:** Soporte vertical primario de la torre
- **Dimensiones recomendadas:** 100 × 400 px
- **Transparencia:** sí (PNG con alpha)
- **Orientación:** lateral
- **Pivote:** bottom-center
- **Archivo en producción:** `public/assets/production/structures/STRUCT_COLUMN_CONCRETE_01.png`
- **Estados:** intact → damaged → broken

### `structure_column_steel_placeholder` — ✅ PRODUCTION (integrado)

- **Nombre:** Columna de acero
- **Función:** Soporte vertical primario de la torre (variante acero)
- **Dimensiones recomendadas:** 100 × 400 px
- **Transparencia:** sí (PNG con alpha)
- **Orientación:** lateral
- **Pivote:** bottom-center
- **Archivo en producción:** `public/assets/production/structures/STRUCT_COLUMN_STEEL_01.png`
- **Estados:** intact → damaged → broken

### `structure_beam_metal_placeholder` — ✅ PRODUCTION (integrado)

- **Nombre:** Viga metálica
- **Función:** Soporte horizontal / unión entre plantas
- **Dimensiones recomendadas:** 320 × 40 px
- **Transparencia:** sí (PNG con alpha)
- **Orientación:** lateral
- **Pivote:** center
- **Archivo en producción:** `public/assets/production/structures/STRUCT_BEAM_STEEL_01.png`
- **Estados:** intact → damaged → broken

### `structure_brace_triangular_placeholder` — ✅ PRODUCTION (integrado)

- **Nombre:** Riostra triangular
- **Función:** Refuerzo decorativo en la base de columnas / esquinas de vigas (sin cuerpo físico propio)
- **Dimensiones recomendadas:** 140 × 105 px
- **Transparencia:** sí (PNG con alpha)
- **Orientación:** lateral
- **Pivote:** center
- **Archivo en producción:** `public/assets/production/structures/STRUCT_BRACE_TRIANGULAR_01.png`

### `structure_platform_wood_placeholder` — ⬜ placeholder

- **Nombre:** Plataforma de madera
- **Función:** Suelo de planta, secundaria
- **Dimensiones recomendadas:** 360 × 28 px
- **Transparencia:** sí (PNG con alpha)
- **Orientación:** lateral
- **Pivote:** center
- **Estados:** intact → damaged → broken

### `structure_platform_walkway_placeholder` — ✅ PRODUCTION (integrado)

- **Nombre:** Pasarela metálica
- **Función:** Conexión entre plataformas / voladizo
- **Dimensiones recomendadas:** 260 × 24 px
- **Transparencia:** sí (PNG con alpha)
- **Orientación:** lateral
- **Pivote:** center
- **Archivo en producción:** `public/assets/production/structures/STRUCT_PLATFORM_WALKWAY_01.png`
- **Estados:** intact → broken

## Puntos débiles (marcadores visuales) (3)

### `weak_hinge_heavy_placeholder` — ✅ PRODUCTION (integrado)

- **Nombre:** Bisagra pesada
- **Función:** Marcador decorativo de unión estructural crítica (sin cuerpo físico propio)
- **Dimensiones recomendadas:** 70 × 84 px
- **Transparencia:** sí (PNG con alpha)
- **Orientación:** lateral
- **Pivote:** center
- **Archivo en producción:** `public/assets/production/weak_points/WEAK_HINGE_HEAVY_01.png`

### `weak_junction_core_placeholder` — ✅ PRODUCTION (integrado)

- **Nombre:** Conector de unión (4 vías)
- **Función:** Marcador decorativo de nodo estructural crítico (sin cuerpo físico propio)
- **Dimensiones recomendadas:** 60 × 60 px
- **Transparencia:** sí (PNG con alpha)
- **Orientación:** lateral
- **Pivote:** center
- **Archivo en producción:** `public/assets/production/weak_points/WEAK_JUNCTION_CORE_01.png`

### `weak_tension_cable_placeholder` — ✅ PRODUCTION (integrado)

- **Nombre:** Cable tensor
- **Función:** Cable de contrapeso / carga de grúa — punto débil de baja resistencia
- **Dimensiones recomendadas:** 40 × 200 px
- **Transparencia:** sí (PNG con alpha)
- **Orientación:** lateral
- **Pivote:** top-center
- **Archivo en producción:** `public/assets/production/weak_points/WEAK_TENSION_CABLE_01.png`
- **Notas de escala:** arte horizontal en origen, rotado 90° en motor para uso vertical; ver docs/SCALE.md
- **Estados:** intact → cut

## Rompibles (1)

### `break_glass_panel_placeholder` — ✅ PRODUCTION (integrado)

- **Nombre:** Cristal industrial reforzado
- **Función:** Panel frágil, rotura inmediata
- **Dimensiones recomendadas:** 140 × 100 px
- **Transparencia:** sí (PNG con alpha)
- **Orientación:** lateral
- **Pivote:** center
- **Archivo en producción:** `public/assets/production/breakables/BREAK_GLASS_PANEL_01.png`
- **Estados:** intact (ya agrietado en el arte) → shattered

## Maquinaria (1)

### `mach_crane_hook_placeholder` — ✅ PRODUCTION (integrado)

- **Nombre:** Gancho de grúa
- **Función:** Gancho pesado que sostiene la carga suspendida
- **Dimensiones recomendadas:** 90 × 90 px
- **Transparencia:** sí (PNG con alpha)
- **Orientación:** lateral
- **Pivote:** top-center
- **Archivo en producción:** `public/assets/production/machinery/MACH_CRANE_HOOK_01.png`

## Props dinámicos / reactivos (11)

### `projectile_launcher_placeholder` — ⬜ placeholder

- **Nombre:** Launcher
- **Función:** Dispositivo de lanzamiento del jugador (izquierda de pantalla)
- **Dimensiones recomendadas:** 220 × 220 px
- **Transparencia:** sí (PNG con alpha)
- **Orientación:** lateral
- **Pivote:** bottom-center
- **Estados:** idle → aiming → firing

### `prop_crate_wood_placeholder` — ⬜ placeholder

- **Nombre:** Caja de madera
- **Función:** Prop dinámico ligero
- **Dimensiones recomendadas:** 64 × 64 px
- **Transparencia:** sí (PNG con alpha)
- **Orientación:** lateral
- **Pivote:** center
- **Variantes:** small, large
- **Estados:** intact → broken

### `prop_barrel_metal_placeholder` — ⬜ placeholder

- **Nombre:** Barril metálico
- **Función:** Prop dinámico rodante
- **Dimensiones recomendadas:** 56 × 72 px
- **Transparencia:** sí (PNG con alpha)
- **Orientación:** lateral
- **Pivote:** center
- **Estados:** intact → broken

### `react_gas_tank_placeholder` — 🟡 REFERENCE_ONLY (pendiente arte final)

- **Nombre:** Depósito de gas
- **Función:** Elemento reactivo explosivo
- **Dimensiones recomendadas:** 90 × 130 px
- **Transparencia:** sí (PNG con alpha)
- **Orientación:** lateral
- **Pivote:** center
- **Estados:** intact → critical → exploded

### `react_explosive_barrel_placeholder` — 🟡 REFERENCE_ONLY (pendiente arte final)

- **Nombre:** Barril explosivo (futuro)
- **Función:** Prop reactivo futuro, aún no colocado en THE TOWER
- **Dimensiones recomendadas:** 60 × 80 px
- **Transparencia:** sí (PNG con alpha)
- **Orientación:** lateral
- **Pivote:** center

### `react_magnet_placeholder` — 🟡 REFERENCE_ONLY (pendiente arte final)

- **Nombre:** Imán industrial (futuro)
- **Función:** Prop reactivo futuro, aún no colocado en THE TOWER
- **Dimensiones recomendadas:** 110 × 110 px
- **Transparencia:** sí (PNG con alpha)
- **Orientación:** lateral
- **Pivote:** center

### `react_counterweight_placeholder` — 🟡 REFERENCE_ONLY (pendiente arte final)

- **Nombre:** Contrapeso 10T
- **Función:** Masa suspendida por cable, libera carga al cortarse
- **Dimensiones recomendadas:** 90 × 90 px
- **Transparencia:** sí (PNG con alpha)
- **Orientación:** lateral
- **Pivote:** center

### `prop_suspended_load_placeholder` — ⬜ placeholder

- **Nombre:** Carga suspendida (grúa)
- **Función:** Masa pesada colgada de la grúa
- **Dimensiones recomendadas:** 120 × 120 px
- **Transparencia:** sí (PNG con alpha)
- **Orientación:** lateral
- **Pivote:** center

### `react_generator_placeholder` — 🟡 REFERENCE_ONLY (pendiente arte final)

- **Nombre:** Generador de alto voltaje
- **Función:** Maquinaria decorativa/reactiva
- **Dimensiones recomendadas:** 130 × 110 px
- **Transparencia:** sí (PNG con alpha)
- **Orientación:** lateral
- **Pivote:** bottom-center
- **Estados:** intact → broken

### `prop_pipe_placeholder` — ⬜ placeholder

- **Nombre:** Tubería industrial
- **Función:** Prop decorativo/dinámico
- **Dimensiones recomendadas:** 220 × 30 px
- **Transparencia:** sí (PNG con alpha)
- **Orientación:** lateral
- **Pivote:** center
- **Variantes:** straight, elbow

### `prop_truck_placeholder` — ⬜ placeholder

- **Nombre:** Camión industrial
- **Función:** Vehículo decorativo en la base del escenario
- **Dimensiones recomendadas:** 220 × 110 px
- **Transparencia:** sí (PNG con alpha)
- **Orientación:** lateral
- **Pivote:** bottom-center

## Entorno / decorado interactivo (6)

### `environment_crane_placeholder` — ⬜ placeholder

- **Nombre:** Grúa
- **Función:** Estructura de grúa que sostiene la carga suspendida
- **Dimensiones recomendadas:** 420 × 360 px
- **Transparencia:** sí (PNG con alpha)
- **Orientación:** lateral
- **Pivote:** bottom-center
- **Estados:** intact → collapsed

### `environment_chain_placeholder` — ⬜ placeholder

- **Nombre:** Cadena
- **Función:** Alternativa visual al cable en soportes pesados
- **Dimensiones recomendadas:** 20 × 200 px
- **Transparencia:** sí (PNG con alpha)
- **Orientación:** lateral
- **Pivote:** top-center
- **Estados:** intact → cut

### `environment_chain_placeholder` — ⬜ placeholder

- **Nombre:** Cadena
- **Función:** Alternativa visual al cable en soportes pesados
- **Dimensiones recomendadas:** 20 × 200 px
- **Transparencia:** sí (PNG con alpha)
- **Orientación:** lateral
- **Pivote:** top-center
- **Estados:** intact → cut

### `environment_ground_placeholder` — ⬜ placeholder

- **Nombre:** Suelo industrial
- **Función:** Terreno base de la instalación
- **Dimensiones recomendadas:** 1920 × 120 px
- **Transparencia:** no
- **Orientación:** lateral
- **Pivote:** top-left

### `environment_decor_pipes_placeholder` — ⬜ placeholder

- **Nombre:** Tuberías decorativas de fondo
- **Función:** Relleno visual no interactivo
- **Dimensiones recomendadas:** 300 × 500 px
- **Transparencia:** sí (PNG con alpha)
- **Orientación:** lateral
- **Pivote:** bottom-center

### `environment_decor_sign_placeholder` — ⬜ placeholder

- **Nombre:** Cartel industrial
- **Función:** Ambientación / identidad de marca del mundo
- **Dimensiones recomendadas:** 160 × 90 px
- **Transparencia:** sí (PNG con alpha)
- **Orientación:** lateral
- **Pivote:** center

## Fondos (2)

### `background_sky_industrial_placeholder` — ⬜ placeholder

- **Nombre:** Cielo industrial
- **Función:** Fondo lejano con parallax
- **Dimensiones recomendadas:** 1920 × 1080 px
- **Transparencia:** no
- **Orientación:** lateral
- **Pivote:** top-left

### `background_skyline_placeholder` — ⬜ placeholder

- **Nombre:** Skyline industrial lejano
- **Función:** Capa media de parallax
- **Dimensiones recomendadas:** 1920 × 600 px
- **Transparencia:** sí (PNG con alpha)
- **Orientación:** lateral
- **Pivote:** top-left

## Destrucción (debris) (4)

### `destruction_debris_wood_placeholder` — ⬜ placeholder

- **Nombre:** Fragmento de madera
- **Función:** Debris visual tras rotura
- **Dimensiones recomendadas:** 32 × 32 px
- **Transparencia:** sí (PNG con alpha)
- **Orientación:** lateral
- **Pivote:** center
- **Variantes:** 4 formas distintas

### `destruction_debris_metal_placeholder` — ⬜ placeholder

- **Nombre:** Fragmento metálico
- **Función:** Debris visual tras rotura
- **Dimensiones recomendadas:** 32 × 32 px
- **Transparencia:** sí (PNG con alpha)
- **Orientación:** lateral
- **Pivote:** center
- **Variantes:** 4 formas distintas

### `destruction_debris_concrete_placeholder` — ⬜ placeholder

- **Nombre:** Fragmento de hormigón
- **Función:** Debris visual tras rotura
- **Dimensiones recomendadas:** 32 × 32 px
- **Transparencia:** sí (PNG con alpha)
- **Orientación:** lateral
- **Pivote:** center
- **Variantes:** 4 formas distintas

### `destruction_shatter_glass_placeholder` — ⬜ placeholder

- **Nombre:** Esquirla de cristal
- **Función:** Debris visual de cristal
- **Dimensiones recomendadas:** 20 × 20 px
- **Transparencia:** sí (PNG con alpha)
- **Orientación:** lateral
- **Pivote:** center
- **Variantes:** 4 formas distintas

## FX (partículas) (4)

### `fx_explosion_placeholder` — ⬜ placeholder

- **Nombre:** Explosión
- **Función:** Sprite/partícula de explosión
- **Dimensiones recomendadas:** 256 × 256 px
- **Transparencia:** sí (PNG con alpha)
- **Orientación:** lateral
- **Pivote:** center
- **Animación:** secuencia de expansión + desvanecido

### `fx_dust_placeholder` — ⬜ placeholder

- **Nombre:** Polvo de impacto
- **Función:** Partícula de polvo en impactos y colapsos
- **Dimensiones recomendadas:** 48 × 48 px
- **Transparencia:** sí (PNG con alpha)
- **Orientación:** lateral
- **Pivote:** center
- **Animación:** expansión + fade

### `fx_spark_placeholder` — ⬜ placeholder

- **Nombre:** Chispa
- **Función:** Partícula de impacto metálico
- **Dimensiones recomendadas:** 16 × 16 px
- **Transparencia:** sí (PNG con alpha)
- **Orientación:** lateral
- **Pivote:** center

### `fx_smoke_placeholder` — ⬜ placeholder

- **Nombre:** Humo
- **Función:** Post-explosión / incendio visual
- **Dimensiones recomendadas:** 96 × 128 px
- **Transparencia:** sí (PNG con alpha)
- **Orientación:** lateral
- **Pivote:** bottom-center
- **Animación:** ascenso + disipación

## UI (9)

### `ui_icon_impact_core` — ⬜ placeholder

- **Nombre:** Icono Impact Core
- **Función:** Selector de proyectil (HUD)
- **Dimensiones recomendadas:** 96 × 96 px
- **Transparencia:** sí (PNG con alpha)
- **Orientación:** ui
- **Pivote:** center

### `ui_icon_drill_spike` — ⬜ placeholder

- **Nombre:** Icono Drill Spike
- **Función:** Selector de proyectil (HUD)
- **Dimensiones recomendadas:** 96 × 96 px
- **Transparencia:** sí (PNG con alpha)
- **Orientación:** ui
- **Pivote:** center

### `ui_icon_pulse_orb` — ⬜ placeholder

- **Nombre:** Icono Pulse Orb
- **Función:** Selector de proyectil (HUD)
- **Dimensiones recomendadas:** 96 × 96 px
- **Transparencia:** sí (PNG con alpha)
- **Orientación:** ui
- **Pivote:** center

### `ui_logo_crashpoint` — ⬜ placeholder

- **Nombre:** Logo CRASHPOINT
- **Función:** Pantalla de título
- **Dimensiones recomendadas:** 800 × 260 px
- **Transparencia:** sí (PNG con alpha)
- **Orientación:** ui
- **Pivote:** center

### `ui_button_demolish` — ⬜ placeholder

- **Nombre:** Botón DEMOLISH
- **Función:** CTA principal pantalla de título
- **Dimensiones recomendadas:** 320 × 96 px
- **Transparencia:** sí (PNG con alpha)
- **Orientación:** ui
- **Pivote:** center
- **Estados:** idle → hover → pressed

### `ui_medal_bronze` — ⬜ placeholder

- **Nombre:** Medalla bronce
- **Función:** Pantalla de resultado
- **Dimensiones recomendadas:** 160 × 160 px
- **Transparencia:** sí (PNG con alpha)
- **Orientación:** ui
- **Pivote:** center

### `ui_medal_silver` — ⬜ placeholder

- **Nombre:** Medalla plata
- **Función:** Pantalla de resultado
- **Dimensiones recomendadas:** 160 × 160 px
- **Transparencia:** sí (PNG con alpha)
- **Orientación:** ui
- **Pivote:** center

### `ui_medal_gold` — ⬜ placeholder

- **Nombre:** Medalla oro
- **Función:** Pantalla de resultado
- **Dimensiones recomendadas:** 160 × 160 px
- **Transparencia:** sí (PNG con alpha)
- **Orientación:** ui
- **Pivote:** center

### `ui_medal_crashpoint` — ⬜ placeholder

- **Nombre:** Medalla CRASHPOINT (Perfect Collapse)
- **Función:** Pantalla de resultado especial
- **Dimensiones recomendadas:** 160 × 160 px
- **Transparencia:** sí (PNG con alpha)
- **Orientación:** ui
- **Pivote:** center
- **Animación:** brillo especial
