/**
 * Single source of truth for every visual asset the game references.
 * Nothing in gameplay/render code should hardcode a file path — everything goes through
 * an assetId defined here, resolved at draw time by AssetRegistry (see section 37).
 *
 * `docs/ASSET_REQUIREMENTS.md` (human-readable spec) and `docs/asset-manifest.json`
 * (machine-readable, same ids/fields) are kept manually in sync with this file.
 *
 * Since MEGA_ASSET_PACK_v1, entries carry a `status`: 'production' ids have a real transparent
 * PNG registered in main.ts (see productionFile) and render via AssetRegistry; 'reference_only'
 * ids have approved art direction but no game-ready file yet (see docs/ASSETS_PENDING_FINAL.md);
 * everything else still falls back to the procedural PlaceholderRenderer.
 */

export type AssetCategory =
  | 'projectiles'
  | 'structures'
  | 'weak_points'
  | 'breakables'
  | 'machinery'
  | 'props'
  | 'destruction'
  | 'environment'
  | 'backgrounds'
  | 'ui'
  | 'fx';

/**
 * `production` = a real transparent PNG is wired into AssetRegistry and rendered in-game.
 * `reference_only` = approved art direction exists (MEGA ASSET PACK v1) but isn't game-ready
 * (concept crop, opaque background, multi-object sheet) — still rendered via PlaceholderRenderer.
 * `placeholder` (default when omitted) = no real art yet at all.
 */
export type AssetStatus = 'placeholder' | 'production' | 'reference_only';

export interface AssetDefinition {
  id: string;
  name: string;
  category: AssetCategory;
  function: string;
  /** Recommended pixel size at 1x for the final PNG, following docs/SCALE.md (100px = 1m). */
  width: number;
  height: number;
  transparency: boolean;
  orientation: 'lateral' | 'isometric-ish' | 'top-down' | 'ui';
  pivot: 'center' | 'bottom-center' | 'top-left' | 'top-center';
  scaleNotes?: string;
  variants?: string[];
  animation?: string;
  states?: string[];
  status?: AssetStatus;
  /** Path under /assets (public/) when status is 'production'. Registered at startup in main.ts. */
  productionFile?: string;
}

export const ASSET_MANIFEST: AssetDefinition[] = [
  // --- Projectiles ---
  { id: 'projectile_impact_core_placeholder', name: 'Impact Core', category: 'projectiles', function: 'Proyectil pesado de impacto', width: 64, height: 64, transparency: true, orientation: 'lateral', pivot: 'center', animation: 'rotación en vuelo (opcional)', status: 'production', productionFile: '/assets/production/projectiles/PROJ_IMPACT_CORE_01.png' },
  { id: 'projectile_drill_spike_placeholder', name: 'Drill Spike', category: 'projectiles', function: 'Proyectil perforante', width: 64, height: 32, transparency: true, orientation: 'lateral', pivot: 'center', animation: 'rotación alineada a la velocidad', status: 'production', productionFile: '/assets/production/projectiles/PROJ_DRILL_SPIKE_01.png' },
  { id: 'projectile_pulse_orb_placeholder', name: 'Pulse Orb', category: 'projectiles', function: 'Proyectil de onda de choque', width: 48, height: 48, transparency: true, orientation: 'lateral', pivot: 'center', animation: 'pulso/brillo continuo + flash al activarse', status: 'reference_only' },
  { id: 'projectile_shock_capsule_placeholder', name: 'Shock Capsule (futuro)', category: 'projectiles', function: 'Proyectil futuro, aún sin mecánica de gameplay', width: 64, height: 48, transparency: true, orientation: 'lateral', pivot: 'center', status: 'reference_only' },
  { id: 'projectile_split_node_placeholder', name: 'Split Node (futuro)', category: 'projectiles', function: 'Proyectil futuro, aún sin mecánica de gameplay', width: 56, height: 56, transparency: true, orientation: 'lateral', pivot: 'center', status: 'reference_only' },
  { id: 'projectile_launcher_placeholder', name: 'Launcher', category: 'props', function: 'Dispositivo de lanzamiento del jugador (izquierda de pantalla)', width: 220, height: 220, transparency: true, orientation: 'lateral', pivot: 'bottom-center', states: ['idle', 'aiming', 'firing'] },

  // --- Structures: primary (load-bearing) ---
  { id: 'structure_column_concrete_placeholder', name: 'Columna de hormigón', category: 'structures', function: 'Soporte vertical primario de la torre', width: 100, height: 400, transparency: true, orientation: 'lateral', pivot: 'bottom-center', states: ['intact', 'damaged', 'broken'], status: 'production', productionFile: '/assets/production/structures/STRUCT_COLUMN_CONCRETE_01.png' },
  { id: 'structure_column_steel_placeholder', name: 'Columna de acero', category: 'structures', function: 'Soporte vertical primario de la torre (variante acero)', width: 100, height: 400, transparency: true, orientation: 'lateral', pivot: 'bottom-center', states: ['intact', 'damaged', 'broken'], status: 'production', productionFile: '/assets/production/structures/STRUCT_COLUMN_STEEL_01.png' },
  { id: 'structure_beam_metal_placeholder', name: 'Viga metálica', category: 'structures', function: 'Soporte horizontal / unión entre plantas', width: 320, height: 40, transparency: true, orientation: 'lateral', pivot: 'center', states: ['intact', 'damaged', 'broken'], status: 'production', productionFile: '/assets/production/structures/STRUCT_BEAM_STEEL_01.png' },
  { id: 'structure_brace_triangular_placeholder', name: 'Riostra triangular', category: 'structures', function: 'Refuerzo decorativo en la base de columnas / esquinas de vigas (sin cuerpo físico propio)', width: 140, height: 105, transparency: true, orientation: 'lateral', pivot: 'center', status: 'production', productionFile: '/assets/production/structures/STRUCT_BRACE_TRIANGULAR_01.png' },
  { id: 'structure_platform_wood_placeholder', name: 'Plataforma de madera', category: 'structures', function: 'Suelo de planta, secundaria', width: 360, height: 28, transparency: true, orientation: 'lateral', pivot: 'center', states: ['intact', 'damaged', 'broken'] },
  { id: 'structure_platform_walkway_placeholder', name: 'Pasarela metálica', category: 'structures', function: 'Conexión entre plataformas / voladizo', width: 260, height: 24, transparency: true, orientation: 'lateral', pivot: 'center', states: ['intact', 'broken'], status: 'production', productionFile: '/assets/production/structures/STRUCT_PLATFORM_WALKWAY_01.png' },

  // --- Weak points (visual communication of structural vulnerability, section 8) ---
  { id: 'weak_hinge_heavy_placeholder', name: 'Bisagra pesada', category: 'weak_points', function: 'Marcador decorativo de unión estructural crítica (sin cuerpo físico propio)', width: 70, height: 84, transparency: true, orientation: 'lateral', pivot: 'center', status: 'production', productionFile: '/assets/production/weak_points/WEAK_HINGE_HEAVY_01.png' },
  { id: 'weak_junction_core_placeholder', name: 'Conector de unión (4 vías)', category: 'weak_points', function: 'Marcador decorativo de nodo estructural crítico (sin cuerpo físico propio)', width: 60, height: 60, transparency: true, orientation: 'lateral', pivot: 'center', status: 'production', productionFile: '/assets/production/weak_points/WEAK_JUNCTION_CORE_01.png' },
  { id: 'weak_tension_cable_placeholder', name: 'Cable tensor', category: 'weak_points', function: 'Cable de contrapeso / carga de grúa — punto débil de baja resistencia', width: 40, height: 200, transparency: true, orientation: 'lateral', pivot: 'top-center', scaleNotes: 'arte horizontal en origen, rotado 90° en motor para uso vertical; ver docs/SCALE.md', states: ['intact', 'cut'], status: 'production', productionFile: '/assets/production/weak_points/WEAK_TENSION_CABLE_01.png' },

  // --- Breakables ---
  { id: 'break_glass_panel_placeholder', name: 'Cristal industrial reforzado', category: 'breakables', function: 'Panel frágil, rotura inmediata', width: 140, height: 100, transparency: true, orientation: 'lateral', pivot: 'center', states: ['intact (ya agrietado en el arte)', 'shattered'], status: 'production', productionFile: '/assets/production/breakables/BREAK_GLASS_PANEL_01.png' },

  // --- Machinery ---
  { id: 'mach_crane_hook_placeholder', name: 'Gancho de grúa', category: 'machinery', function: 'Gancho pesado que sostiene la carga suspendida', width: 90, height: 90, transparency: true, orientation: 'lateral', pivot: 'top-center', status: 'production', productionFile: '/assets/production/machinery/MACH_CRANE_HOOK_01.png' },

  // --- Props (dynamic) ---
  { id: 'prop_crate_wood_placeholder', name: 'Caja de madera', category: 'props', function: 'Prop dinámico ligero', width: 64, height: 64, transparency: true, orientation: 'lateral', pivot: 'center', variants: ['small', 'large'], states: ['intact', 'broken'] },
  { id: 'prop_barrel_metal_placeholder', name: 'Barril metálico', category: 'props', function: 'Prop dinámico rodante', width: 56, height: 72, transparency: true, orientation: 'lateral', pivot: 'center', states: ['intact', 'broken'] },
  { id: 'react_gas_tank_placeholder', name: 'Depósito de gas', category: 'props', function: 'Elemento reactivo explosivo', width: 90, height: 130, transparency: true, orientation: 'lateral', pivot: 'center', states: ['intact', 'critical', 'exploded'], status: 'reference_only' },
  { id: 'react_explosive_barrel_placeholder', name: 'Barril explosivo (futuro)', category: 'props', function: 'Prop reactivo futuro, aún no colocado en THE TOWER', width: 60, height: 80, transparency: true, orientation: 'lateral', pivot: 'center', status: 'reference_only' },
  { id: 'react_magnet_placeholder', name: 'Imán industrial (futuro)', category: 'props', function: 'Prop reactivo futuro, aún no colocado en THE TOWER', width: 110, height: 110, transparency: true, orientation: 'lateral', pivot: 'center', status: 'reference_only' },
  { id: 'react_counterweight_placeholder', name: 'Contrapeso 10T', category: 'props', function: 'Masa suspendida por cable, libera carga al cortarse', width: 90, height: 90, transparency: true, orientation: 'lateral', pivot: 'center', status: 'reference_only' },
  { id: 'prop_suspended_load_placeholder', name: 'Carga suspendida (grúa)', category: 'props', function: 'Masa pesada colgada de la grúa', width: 120, height: 120, transparency: true, orientation: 'lateral', pivot: 'center' },
  { id: 'react_generator_placeholder', name: 'Generador de alto voltaje', category: 'props', function: 'Maquinaria decorativa/reactiva', width: 130, height: 110, transparency: true, orientation: 'lateral', pivot: 'bottom-center', states: ['intact', 'broken'], status: 'reference_only' },
  { id: 'prop_pipe_placeholder', name: 'Tubería industrial', category: 'props', function: 'Prop decorativo/dinámico', width: 220, height: 30, transparency: true, orientation: 'lateral', pivot: 'center', variants: ['straight', 'elbow'] },
  { id: 'prop_truck_placeholder', name: 'Camión industrial', category: 'props', function: 'Vehículo decorativo en la base del escenario', width: 220, height: 110, transparency: true, orientation: 'lateral', pivot: 'bottom-center' },

  // --- Environment ---
  { id: 'environment_crane_placeholder', name: 'Grúa', category: 'environment', function: 'Estructura de grúa que sostiene la carga suspendida', width: 420, height: 360, transparency: true, orientation: 'lateral', pivot: 'bottom-center', states: ['intact', 'collapsed'] },
  { id: 'environment_chain_placeholder', name: 'Cadena', category: 'environment', function: 'Alternativa visual al cable en soportes pesados', width: 20, height: 200, transparency: true, orientation: 'lateral', pivot: 'top-center', states: ['intact', 'cut'] },
  { id: 'environment_chain_placeholder', name: 'Cadena', category: 'environment', function: 'Alternativa visual al cable en soportes pesados', width: 20, height: 200, transparency: true, orientation: 'lateral', pivot: 'top-center', states: ['intact', 'cut'] },
  { id: 'environment_ground_placeholder', name: 'Suelo industrial', category: 'environment', function: 'Terreno base de la instalación', width: 1920, height: 120, transparency: false, orientation: 'lateral', pivot: 'top-left' },
  { id: 'environment_decor_pipes_placeholder', name: 'Tuberías decorativas de fondo', category: 'environment', function: 'Relleno visual no interactivo', width: 300, height: 500, transparency: true, orientation: 'lateral', pivot: 'bottom-center' },
  { id: 'environment_decor_sign_placeholder', name: 'Cartel industrial', category: 'environment', function: 'Ambientación / identidad de marca del mundo', width: 160, height: 90, transparency: true, orientation: 'lateral', pivot: 'center' },

  // --- Backgrounds ---
  { id: 'background_sky_industrial_placeholder', name: 'Cielo industrial', category: 'backgrounds', function: 'Fondo lejano con parallax', width: 1920, height: 1080, transparency: false, orientation: 'lateral', pivot: 'top-left' },
  { id: 'background_skyline_placeholder', name: 'Skyline industrial lejano', category: 'backgrounds', function: 'Capa media de parallax', width: 1920, height: 600, transparency: true, orientation: 'lateral', pivot: 'top-left' },

  // --- Destruction ---
  { id: 'destruction_debris_wood_placeholder', name: 'Fragmento de madera', category: 'destruction', function: 'Debris visual tras rotura', width: 32, height: 32, transparency: true, orientation: 'lateral', pivot: 'center', variants: ['4 formas distintas'] },
  { id: 'destruction_debris_metal_placeholder', name: 'Fragmento metálico', category: 'destruction', function: 'Debris visual tras rotura', width: 32, height: 32, transparency: true, orientation: 'lateral', pivot: 'center', variants: ['4 formas distintas'] },
  { id: 'destruction_debris_concrete_placeholder', name: 'Fragmento de hormigón', category: 'destruction', function: 'Debris visual tras rotura', width: 32, height: 32, transparency: true, orientation: 'lateral', pivot: 'center', variants: ['4 formas distintas'] },
  { id: 'destruction_shatter_glass_placeholder', name: 'Esquirla de cristal', category: 'destruction', function: 'Debris visual de cristal', width: 20, height: 20, transparency: true, orientation: 'lateral', pivot: 'center', variants: ['4 formas distintas'] },

  // --- FX ---
  { id: 'fx_explosion_placeholder', name: 'Explosión', category: 'fx', function: 'Sprite/partícula de explosión', width: 256, height: 256, transparency: true, orientation: 'lateral', pivot: 'center', animation: 'secuencia de expansión + desvanecido' },
  { id: 'fx_dust_placeholder', name: 'Polvo de impacto', category: 'fx', function: 'Partícula de polvo en impactos y colapsos', width: 48, height: 48, transparency: true, orientation: 'lateral', pivot: 'center', animation: 'expansión + fade' },
  { id: 'fx_spark_placeholder', name: 'Chispa', category: 'fx', function: 'Partícula de impacto metálico', width: 16, height: 16, transparency: true, orientation: 'lateral', pivot: 'center' },
  { id: 'fx_smoke_placeholder', name: 'Humo', category: 'fx', function: 'Post-explosión / incendio visual', width: 96, height: 128, transparency: true, orientation: 'lateral', pivot: 'bottom-center', animation: 'ascenso + disipación' },

  // --- UI ---
  { id: 'ui_icon_impact_core', name: 'Icono Impact Core', category: 'ui', function: 'Selector de proyectil (HUD)', width: 96, height: 96, transparency: true, orientation: 'ui', pivot: 'center' },
  { id: 'ui_icon_drill_spike', name: 'Icono Drill Spike', category: 'ui', function: 'Selector de proyectil (HUD)', width: 96, height: 96, transparency: true, orientation: 'ui', pivot: 'center' },
  { id: 'ui_icon_pulse_orb', name: 'Icono Pulse Orb', category: 'ui', function: 'Selector de proyectil (HUD)', width: 96, height: 96, transparency: true, orientation: 'ui', pivot: 'center' },
  { id: 'ui_logo_crashpoint', name: 'Logo CRASHPOINT', category: 'ui', function: 'Pantalla de título', width: 800, height: 260, transparency: true, orientation: 'ui', pivot: 'center' },
  { id: 'ui_button_demolish', name: 'Botón DEMOLISH', category: 'ui', function: 'CTA principal pantalla de título', width: 320, height: 96, transparency: true, orientation: 'ui', pivot: 'center', states: ['idle', 'hover', 'pressed'] },
  { id: 'ui_medal_bronze', name: 'Medalla bronce', category: 'ui', function: 'Pantalla de resultado', width: 160, height: 160, transparency: true, orientation: 'ui', pivot: 'center' },
  { id: 'ui_medal_silver', name: 'Medalla plata', category: 'ui', function: 'Pantalla de resultado', width: 160, height: 160, transparency: true, orientation: 'ui', pivot: 'center' },
  { id: 'ui_medal_gold', name: 'Medalla oro', category: 'ui', function: 'Pantalla de resultado', width: 160, height: 160, transparency: true, orientation: 'ui', pivot: 'center' },
  { id: 'ui_medal_crashpoint', name: 'Medalla CRASHPOINT (Perfect Collapse)', category: 'ui', function: 'Pantalla de resultado especial', width: 160, height: 160, transparency: true, orientation: 'ui', pivot: 'center', animation: 'brillo especial' },
];

export function getAssetDefinition(id: string): AssetDefinition | undefined {
  return ASSET_MANIFEST.find((a) => a.id === id);
}
