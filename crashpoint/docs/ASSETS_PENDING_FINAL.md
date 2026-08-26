# ASSETS_PENDING_FINAL.md

Designs from `CRASHPOINT_MEGA_ASSET_PACK_v1` that are **approved art direction** but not
game-ready yet, and so were **not** integrated as sprites this pass (still rendered via the
procedural `PlaceholderRenderer`). These are exactly what the next focused art batch should cover.

## Reference-only single objects (need a clean transparent regeneration)

### `PROJ_PULSE_ORB_REF` — Pulse Orb
- **Función:** proyectil de onda de choque (proyectil #3, ya implementado en gameplay).
- **Motivo de rechazo:** `wide_clean_game_asset_promotional_layout_on_a_tran.png` es un layout
  promocional compuesto (varios objetos + fondo no limpio), no un sprite de un solo objeto.
- **Asset final necesario:** PNG transparente de un único objeto, esfera/orbe con lenguaje
  emisivo cyan/eléctrico (coherente con `STYLE_PROJECTILES_MASTER.png`).
- **Tamaño/orientación recomendada:** ver `projectile_pulse_orb_placeholder` en
  `ASSET_REQUIREMENTS.md` (48×48, lateral, pivote centro).

### `PROJ_SHOCK_CAPSULE_REF` — Shock Capsule (futuro)
- **Función:** proyectil futuro, **sin mecánica de gameplay implementada aún**.
- **Motivo de rechazo:** mismo layout compuesto que Pulse Orb.
- **Asset final necesario:** PNG transparente de un único objeto. No implementar la mecánica
  hasta que el diseño de gameplay lo pida explícitamente (regla 9/26 del prompt de integración).
- **Tamaño/orientación recomendada:** ~64×48, lateral, pivote centro.

### `PROJ_SPLIT_NODE_REF` — Split Node (futuro)
- **Función:** proyectil futuro, **sin mecánica de gameplay implementada aún**.
- **Motivo de rechazo:** mismo layout compuesto.
- **Asset final necesario:** PNG transparente de un único objeto.
- **Tamaño/orientación recomendada:** ~56×56, lateral, pivote centro.

### `REACT_GAS_TANK_01_REF` — Depósito de gas explosivo
- **Función:** ya es una entidad activa en THE TOWER (`gas_tank`, rol `reactive`, explota al romperse).
- **Motivo de rechazo:** fondo opaco (no transparente) — `transparent_background: false` en el
  manifest del pack.
- **Asset final necesario:** la misma composición con el fondo eliminado (alpha real).
- **Tamaño/orientación recomendada:** 90×70 (caja física — más baja que el arte de referencia
  1122×1402 para caber en el hueco entre plantas; ver nota de escala en `SCALE.md`), lateral,
  pivote centro, estados intact/critical/exploded.

### `REACT_EXPLOSIVE_BARREL_01_REF` — Barril explosivo
- **Función:** prop reactivo futuro — **no colocado en THE TOWER todavía** (el nivel actual solo
  tiene un elemento explosivo, el depósito de gas; un barril sería un segundo punto explosivo en
  un futuro rebalanceo).
- **Motivo de rechazo:** fondo opaco.
- **Asset final necesario:** versión transparente.
- **Tamaño/orientación recomendada:** ~60×80, lateral, pivote centro.

### `REACT_HIGH_VOLTAGE_GENERATOR_01_REF` — Generador de alto voltaje
- **Función:** ya es una entidad activa en THE TOWER (`generator`, prop decorativo/de masa).
- **Motivo de rechazo:** fondo opaco.
- **Asset final necesario:** versión transparente.
- **Tamaño/orientación recomendada:** 130×110, lateral, pivote bottom-center, estados intact/broken.

### `REACT_COUNTERWEIGHT_10T_01_REF` — Contrapeso 10T
- **Función:** ya es una entidad activa en THE TOWER (`counterweight_ball`).
- **Motivo de rechazo:** fondo opaco.
- **Asset final necesario:** versión transparente.
- **Tamaño/orientación recomendada:** 90×90, lateral, pivote centro.

### `REACT_INDUSTRIAL_MAGNET_01_REF` — Imán industrial en suspensión
- **Función:** prop reactivo futuro — **no colocado en THE TOWER todavía**.
- **Motivo de rechazo:** fondo opaco.
- **Asset final necesario:** versión transparente.
- **Tamaño/orientación recomendada:** ~110×110, lateral, pivote centro (o top-center si cuelga).

## Style sheets (dirección de arte — nunca usar la lámina completa como sprite)

Estas 6 láminas no representan un objeto único y no se integran nunca directamente; se
mantienen solo como referencia de lenguaje visual para futuras generaciones de arte:

| ID | Función |
|---|---|
| `STYLE_PROJECTILES_MASTER` | Lenguaje de proyectiles (los 5 diseños conceptuales juntos) |
| `STYLE_STRUCTURAL_KIT_MASTER` | Lenguaje del kit estructural y variaciones modulares |
| `STYLE_WEAK_POINTS_MASTER` | Lenguaje de puntos débiles y conexiones |
| `STYLE_REACTIVE_MASTER` | Lenguaje de props reactivos/peligro |
| `STYLE_INDUSTRIAL_PROPS_MASTER` | Lenguaje de props industriales (fuel, hook, crate, generador, carretilla) |
| `STYLE_HEAVY_MACHINERY_MASTER` | Lenguaje de maquinaria pesada (silo, grúa, contenedor, generador, camión) |

## Also still placeholder (not in this pack at all)

- `structure_platform_wood_placeholder` — wood floor platforms (`platform_floor1/2/3`); no
  matching production asset was included in this pack.
- `prop_suspended_load_placeholder` — the crane's wrecking-ball load (`crane_load`).
- `prop_crate_wood_placeholder`, `prop_barrel_metal_placeholder` — small dynamic props.
- `environment_crane_placeholder` — the crane mast/boom bodies (`crane_mast`, `crane_boom`)
  still render as flat-color placeholders; only the hook + cable got production art this pass.
- Launcher, ground, sky/skyline backgrounds, decor sign/pipes/truck, UI (medals, logo, icons),
  destruction debris, FX sprites — untouched by this pack, see `ASSET_REQUIREMENTS.md` for the
  full outstanding list.
