# SCALE.md — escala visual de CRASHPOINT

Referencia para fabricar los assets finales del MEGA ZIP con las proporciones correctas.

## Unidad base

- **~100 world-units ≈ 1 metro** (relación aproximada, no física estricta — ver nota abajo).
- El mundo de THE TOWER mide **1700 × 960** world-units (`WORLD_WIDTH` / `WORLD_HEIGHT` en
  `src/game/TheTower.ts`). A la escala anterior eso son ~17 × 9.6 metros: una instalación
  industrial de tamaño medio, 4 plantas.
- 1 world-unit = 1 px en los assets recomendados (los tamaños de `ASSET_REQUIREMENTS.md` están
  en píxeles a 1x, alineados 1:1 con las world-units que ocupa la pieza en el nivel).

> Nota: la física (Matter.js) no usa metros reales — usa las mismas world-units como sus
> unidades de distancia, con `density`/`gravity` ajustados a mano en `physics/materials.ts`
> hasta que el juego se *siente* bien. La conversión a "metros" de arriba es solo una guía
> mental para el equipo de arte, no una restricción del motor.

## Tamaños de referencia (world-units = px a 1x)

| Elemento | Tamaño | Notas |
|---|---|---|
| Columna primaria | 74 × 560 | el elemento más alto de la estructura |
| Viga metálica (span) | 430 × 36 | ancho variable según el tramo |
| Plataforma de madera | 430 × 24 | suelo de planta |
| Caja / barril (props) | ~48–56 px de lado | props pequeños, un jugador imaginario mediría ~140–160px si lo hubiera |
| Impact Core (proyectil) | radio 16 (Ø32) | el proyectil "estándar" de referencia |
| Drill Spike | radio 8 (Ø16) | más pequeño, perfora |
| Pulse Orb | radio 12 (Ø24) | genera onda ~170 de radio al activarse |
| Cristal industrial | 130 × 64 (colisión) | el sprite final puede ser más alto (100+), la caja física es más corta — ver nota |
| Grúa (mástil) | 46 × 650 | más alta que la torre, para que la carga cuelgue por encima del techo |
| Carga suspendida (bola de grúa) | radio 50 (Ø100) | el prop "de espectáculo" más grande del nivel |
| Suelo (ground) | ancho total del mundo × 200 de grosor | franja industrial continua |

## Pivotes

- **Piezas estructurales (vigas, columnas, plataformas, props):** pivote **center** —
  coincide con el centro físico del `Matter.Body`, así el sprite rota/se dibuja centrado en la
  posición del cuerpo sin cálculos adicionales.
- **Elementos "de pie" (grúa, camión, generador, launcher):** pivote **bottom-center**, para
  que el asset final se apoye visualmente en el suelo aunque su altura cambie respecto al
  placeholder.
- **UI:** pivote **center** salvo que se indique lo contrario.

## Por qué algunas cajas de colisión son más pequeñas que el arte recomendado

Varias piezas (`gas_tank`, `glass_panel`) tienen una caja de física más baja que el tamaño de
sprite sugerido en `ASSET_REQUIREMENTS.md`. Esto es intencional: el hueco vertical disponible
entre plantas es limitado, y una caja de colisión a tamaño completo del arte final generaba
solapamientos con la viga/plataforma de encima (ver sección 42 del prompt: la física nunca debe
depender de las dimensiones exactas del sprite). El sprite final puede sobresalir visualmente
un poco por arriba/abajo de su caja física sin que esto afecte al gameplay.

## Orientación de cámara

Vista **lateral** (side-view) fija, cámara 2D con zoom dinámico (`CameraSystem`). No hay
perspectiva ni profundidad real — el eje Z se resuelve por capas de dibujado (fondo → decor →
estructura → proyectiles → partículas → UI), no por escala.
