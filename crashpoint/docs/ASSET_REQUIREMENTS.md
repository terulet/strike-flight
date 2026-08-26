# ASSET_REQUIREMENTS.md

CRASHPOINT — THE TOWER. Catálogo completo de assets visuales necesarios para el
CRASHPOINT VISUAL INTEGRATION PASS (sustitución de placeholders por el MEGA ZIP final).

- Ver también: `docs/asset-manifest.json` (mismo catálogo en formato máquina) y
  `docs/SCALE.md` (escala px/metro y convenciones de pivote/orientación).
- Cada asset se referencia en el código exclusivamente por su `ID` (ver
  `src/assets/AssetManifest.ts` → `AssetRegistry` → `PlaceholderRenderer`). Nunca hay
  rutas de archivo hardcodeadas fuera de esa capa.
- **Total: 43 assets.**

## Proyectiles (3)

### `projectile_impact_core_placeholder`

- **Nombre:** Impact Core
- **Función:** Proyectil pesado de impacto
- **Dimensiones recomendadas:** 64 × 64 px
- **Transparencia:** sí (PNG con alpha)
- **Orientación:** lateral
- **Pivote:** center
- **Animación:** rotación en vuelo (opcional)

### `projectile_drill_spike_placeholder`

- **Nombre:** Drill Spike
- **Función:** Proyectil perforante
- **Dimensiones recomendadas:** 64 × 32 px
- **Transparencia:** sí (PNG con alpha)
- **Orientación:** lateral
- **Pivote:** center
- **Animación:** rotación rápida en vuelo

### `projectile_pulse_orb_placeholder`

- **Nombre:** Pulse Orb
- **Función:** Proyectil de onda de choque
- **Dimensiones recomendadas:** 48 × 48 px
- **Transparencia:** sí (PNG con alpha)
- **Orientación:** lateral
- **Pivote:** center
- **Animación:** pulso/brillo continuo + flash al activarse

## Estructura (primaria y secundaria) (5)

### `structure_column_concrete_placeholder`

- **Nombre:** Columna de hormigón
- **Función:** Soporte vertical primario de la torre
- **Dimensiones recomendadas:** 100 × 400 px
- **Transparencia:** no
- **Orientación:** lateral
- **Pivote:** bottom-center
- **Estados:** intact → damaged → broken

### `structure_beam_metal_placeholder`

- **Nombre:** Viga metálica
- **Función:** Soporte horizontal / unión entre plantas
- **Dimensiones recomendadas:** 320 × 40 px
- **Transparencia:** sí (PNG con alpha)
- **Orientación:** lateral
- **Pivote:** center
- **Estados:** intact → damaged → broken

### `structure_platform_wood_placeholder`

- **Nombre:** Plataforma de madera
- **Función:** Suelo de planta, secundaria
- **Dimensiones recomendadas:** 360 × 28 px
- **Transparencia:** sí (PNG con alpha)
- **Orientación:** lateral
- **Pivote:** center
- **Estados:** intact → damaged → broken

### `structure_walkway_metal_placeholder`

- **Nombre:** Pasarela metálica
- **Función:** Conexión entre plataformas
- **Dimensiones recomendadas:** 260 × 24 px
- **Transparencia:** sí (PNG con alpha)
- **Orientación:** lateral
- **Pivote:** center
- **Estados:** intact → broken

### `structure_joint_bolt_placeholder`

- **Nombre:** Unión / bisagra
- **Función:** Punto de conexión visual entre piezas (indicador sutil de debilidad)
- **Dimensiones recomendadas:** 24 × 24 px
- **Transparencia:** sí (PNG con alpha)
- **Orientación:** lateral
- **Pivote:** center

## Props dinámicos (10)

### `projectile_launcher_placeholder`

- **Nombre:** Launcher
- **Función:** Dispositivo de lanzamiento del jugador (izquierda de pantalla)
- **Dimensiones recomendadas:** 220 × 220 px
- **Transparencia:** sí (PNG con alpha)
- **Orientación:** lateral
- **Pivote:** bottom-center
- **Estados:** idle → aiming → firing

### `prop_crate_wood_placeholder`

- **Nombre:** Caja de madera
- **Función:** Prop dinámico ligero
- **Dimensiones recomendadas:** 64 × 64 px
- **Transparencia:** sí (PNG con alpha)
- **Orientación:** lateral
- **Pivote:** center
- **Variantes:** small, large
- **Estados:** intact → broken

### `prop_barrel_metal_placeholder`

- **Nombre:** Barril metálico
- **Función:** Prop dinámico rodante
- **Dimensiones recomendadas:** 56 × 72 px
- **Transparencia:** sí (PNG con alpha)
- **Orientación:** lateral
- **Pivote:** center
- **Estados:** intact → broken

### `prop_gas_tank_placeholder`

- **Nombre:** Depósito de gas
- **Función:** Elemento reactivo explosivo
- **Dimensiones recomendadas:** 90 × 130 px
- **Transparencia:** sí (PNG con alpha)
- **Orientación:** lateral
- **Pivote:** center
- **Estados:** intact → critical → exploded

### `prop_glass_panel_placeholder`

- **Nombre:** Cristal industrial
- **Función:** Panel frágil, rotura inmediata
- **Dimensiones recomendadas:** 140 × 180 px
- **Transparencia:** sí (PNG con alpha)
- **Orientación:** lateral
- **Pivote:** center
- **Estados:** intact → shattered

### `prop_counterweight_placeholder`

- **Nombre:** Contrapeso
- **Función:** Masa suspendida por cable, libera carga al cortarse
- **Dimensiones recomendadas:** 90 × 90 px
- **Transparencia:** sí (PNG con alpha)
- **Orientación:** lateral
- **Pivote:** center

### `prop_suspended_load_placeholder`

- **Nombre:** Carga suspendida (grúa)
- **Función:** Masa pesada colgada de la grúa
- **Dimensiones recomendadas:** 120 × 120 px
- **Transparencia:** sí (PNG con alpha)
- **Orientación:** lateral
- **Pivote:** center

### `prop_generator_placeholder`

- **Nombre:** Generador
- **Función:** Maquinaria decorativa/reactiva
- **Dimensiones recomendadas:** 130 × 110 px
- **Transparencia:** sí (PNG con alpha)
- **Orientación:** lateral
- **Pivote:** bottom-center
- **Estados:** intact → broken

### `prop_pipe_placeholder`

- **Nombre:** Tubería industrial
- **Función:** Prop decorativo/dinámico
- **Dimensiones recomendadas:** 220 × 30 px
- **Transparencia:** sí (PNG con alpha)
- **Orientación:** lateral
- **Pivote:** center
- **Variantes:** straight, elbow

### `prop_truck_placeholder`

- **Nombre:** Camión industrial
- **Función:** Vehículo decorativo en la base del escenario
- **Dimensiones recomendadas:** 220 × 110 px
- **Transparencia:** sí (PNG con alpha)
- **Orientación:** lateral
- **Pivote:** bottom-center

## Entorno / decorado interactivo (6)

### `environment_crane_placeholder`

- **Nombre:** Grúa
- **Función:** Estructura de grúa que sostiene la carga suspendida
- **Dimensiones recomendadas:** 420 × 360 px
- **Transparencia:** sí (PNG con alpha)
- **Orientación:** lateral
- **Pivote:** bottom-center
- **Estados:** intact → collapsed

### `environment_cable_placeholder`

- **Nombre:** Cable
- **Función:** Conexión tensora / contrapeso / carga de grúa
- **Dimensiones recomendadas:** 12 × 200 px
- **Transparencia:** sí (PNG con alpha)
- **Orientación:** lateral
- **Pivote:** top-center
- **Notas de escala:** renderizado como segmento estirable, ver docs/SCALE.md
- **Estados:** intact → cut

### `environment_chain_placeholder`

- **Nombre:** Cadena
- **Función:** Alternativa visual al cable en soportes pesados
- **Dimensiones recomendadas:** 20 × 200 px
- **Transparencia:** sí (PNG con alpha)
- **Orientación:** lateral
- **Pivote:** top-center
- **Estados:** intact → cut

### `environment_ground_placeholder`

- **Nombre:** Suelo industrial
- **Función:** Terreno base de la instalación
- **Dimensiones recomendadas:** 1920 × 120 px
- **Transparencia:** no
- **Orientación:** lateral
- **Pivote:** top-left

### `environment_decor_pipes_placeholder`

- **Nombre:** Tuberías decorativas de fondo
- **Función:** Relleno visual no interactivo
- **Dimensiones recomendadas:** 300 × 500 px
- **Transparencia:** sí (PNG con alpha)
- **Orientación:** lateral
- **Pivote:** bottom-center

### `environment_decor_sign_placeholder`

- **Nombre:** Cartel industrial
- **Función:** Ambientación / identidad de marca del mundo
- **Dimensiones recomendadas:** 160 × 90 px
- **Transparencia:** sí (PNG con alpha)
- **Orientación:** lateral
- **Pivote:** center

## Fondos (2)

### `background_sky_industrial_placeholder`

- **Nombre:** Cielo industrial
- **Función:** Fondo lejano con parallax
- **Dimensiones recomendadas:** 1920 × 1080 px
- **Transparencia:** no
- **Orientación:** lateral
- **Pivote:** top-left

### `background_skyline_placeholder`

- **Nombre:** Skyline industrial lejano
- **Función:** Capa media de parallax
- **Dimensiones recomendadas:** 1920 × 600 px
- **Transparencia:** sí (PNG con alpha)
- **Orientación:** lateral
- **Pivote:** top-left

## Destrucción (debris) (4)

### `destruction_debris_wood_placeholder`

- **Nombre:** Fragmento de madera
- **Función:** Debris visual tras rotura
- **Dimensiones recomendadas:** 32 × 32 px
- **Transparencia:** sí (PNG con alpha)
- **Orientación:** lateral
- **Pivote:** center
- **Variantes:** 4 formas distintas

### `destruction_debris_metal_placeholder`

- **Nombre:** Fragmento metálico
- **Función:** Debris visual tras rotura
- **Dimensiones recomendadas:** 32 × 32 px
- **Transparencia:** sí (PNG con alpha)
- **Orientación:** lateral
- **Pivote:** center
- **Variantes:** 4 formas distintas

### `destruction_debris_concrete_placeholder`

- **Nombre:** Fragmento de hormigón
- **Función:** Debris visual tras rotura
- **Dimensiones recomendadas:** 32 × 32 px
- **Transparencia:** sí (PNG con alpha)
- **Orientación:** lateral
- **Pivote:** center
- **Variantes:** 4 formas distintas

### `destruction_shatter_glass_placeholder`

- **Nombre:** Esquirla de cristal
- **Función:** Debris visual de cristal
- **Dimensiones recomendadas:** 20 × 20 px
- **Transparencia:** sí (PNG con alpha)
- **Orientación:** lateral
- **Pivote:** center
- **Variantes:** 4 formas distintas

## FX (partículas) (4)

### `fx_explosion_placeholder`

- **Nombre:** Explosión
- **Función:** Sprite/partícula de explosión
- **Dimensiones recomendadas:** 256 × 256 px
- **Transparencia:** sí (PNG con alpha)
- **Orientación:** lateral
- **Pivote:** center
- **Animación:** secuencia de expansión + desvanecido

### `fx_dust_placeholder`

- **Nombre:** Polvo de impacto
- **Función:** Partícula de polvo en impactos y colapsos
- **Dimensiones recomendadas:** 48 × 48 px
- **Transparencia:** sí (PNG con alpha)
- **Orientación:** lateral
- **Pivote:** center
- **Animación:** expansión + fade

### `fx_spark_placeholder`

- **Nombre:** Chispa
- **Función:** Partícula de impacto metálico
- **Dimensiones recomendadas:** 16 × 16 px
- **Transparencia:** sí (PNG con alpha)
- **Orientación:** lateral
- **Pivote:** center

### `fx_smoke_placeholder`

- **Nombre:** Humo
- **Función:** Post-explosión / incendio visual
- **Dimensiones recomendadas:** 96 × 128 px
- **Transparencia:** sí (PNG con alpha)
- **Orientación:** lateral
- **Pivote:** bottom-center
- **Animación:** ascenso + disipación

## UI (9)

### `ui_icon_impact_core`

- **Nombre:** Icono Impact Core
- **Función:** Selector de proyectil (HUD)
- **Dimensiones recomendadas:** 96 × 96 px
- **Transparencia:** sí (PNG con alpha)
- **Orientación:** ui
- **Pivote:** center

### `ui_icon_drill_spike`

- **Nombre:** Icono Drill Spike
- **Función:** Selector de proyectil (HUD)
- **Dimensiones recomendadas:** 96 × 96 px
- **Transparencia:** sí (PNG con alpha)
- **Orientación:** ui
- **Pivote:** center

### `ui_icon_pulse_orb`

- **Nombre:** Icono Pulse Orb
- **Función:** Selector de proyectil (HUD)
- **Dimensiones recomendadas:** 96 × 96 px
- **Transparencia:** sí (PNG con alpha)
- **Orientación:** ui
- **Pivote:** center

### `ui_logo_crashpoint`

- **Nombre:** Logo CRASHPOINT
- **Función:** Pantalla de título
- **Dimensiones recomendadas:** 800 × 260 px
- **Transparencia:** sí (PNG con alpha)
- **Orientación:** ui
- **Pivote:** center

### `ui_button_demolish`

- **Nombre:** Botón DEMOLISH
- **Función:** CTA principal pantalla de título
- **Dimensiones recomendadas:** 320 × 96 px
- **Transparencia:** sí (PNG con alpha)
- **Orientación:** ui
- **Pivote:** center
- **Estados:** idle → hover → pressed

### `ui_medal_bronze`

- **Nombre:** Medalla bronce
- **Función:** Pantalla de resultado
- **Dimensiones recomendadas:** 160 × 160 px
- **Transparencia:** sí (PNG con alpha)
- **Orientación:** ui
- **Pivote:** center

### `ui_medal_silver`

- **Nombre:** Medalla plata
- **Función:** Pantalla de resultado
- **Dimensiones recomendadas:** 160 × 160 px
- **Transparencia:** sí (PNG con alpha)
- **Orientación:** ui
- **Pivote:** center

### `ui_medal_gold`

- **Nombre:** Medalla oro
- **Función:** Pantalla de resultado
- **Dimensiones recomendadas:** 160 × 160 px
- **Transparencia:** sí (PNG con alpha)
- **Orientación:** ui
- **Pivote:** center

### `ui_medal_crashpoint`

- **Nombre:** Medalla CRASHPOINT (Perfect Collapse)
- **Función:** Pantalla de resultado especial
- **Dimensiones recomendadas:** 160 × 160 px
- **Transparencia:** sí (PNG con alpha)
- **Orientación:** ui
- **Pivote:** center
- **Animación:** brillo especial
