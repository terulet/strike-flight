/**
 * rigCheck.ts — banco de comprobacion de ensamblaje.
 *
 * El mandato pide validar que moto, ruedas y piloto permanecen ensamblados
 * "en suelo, salto, aterrizaje, wheelie y caida". Jugar y mirar no vale como
 * comprobacion: los estados interesantes duran dos fotogramas y no se repiten
 * igual dos veces.
 *
 * Aqui se construyen esos estados A MANO y se dibuja la moto en cada uno, al
 * mismo zoom y con marcadores de la geometria FISICA superpuestos: el eje de
 * cada rueda, su punto de contacto con el suelo, el centro de masas y el punto
 * de cadera del piloto. Si un sprite no cae encima de su marcador, el
 * ensamblaje esta mal y se ve al instante.
 *
 * Se sirve en desarrollo (`npx vite` -> /rig-check.html). No entra en la build
 * de produccion: vite solo empaqueta index.html.
 */

import { Renderer } from '../rendering/Renderer';
import { CameraPose } from '../rendering/Camera';
import {
  BikeState,
  COM_HEIGHT_ABOVE_GROUND,
  createInitialBikeState,
  wheelAnchorWorld,
  wheelVisualCenterWorld,
} from '../physics/Bike';
import { BikeConfig, SuspensionConfig } from '../config/GameConfig';
import { SpriteImages } from '../rendering/SpriteAssets';
import { rotateVec } from '../physics/MathUtils';
import { FOOTPEG_LOCAL, HANDLEBAR_GRIP_LOCAL, solveRiderRig } from '../rendering/RiderRig';

const CELL_WIDTH = 420;
const CELL_HEIGHT = 340;
const PIXELS_PER_METER = 150;

interface Pose {
  label: string;
  build: () => BikeState;
  crashed?: boolean;
  crashElapsed?: number;
}

/** Compresion de reposo de cada eje con el reparto estatico de peso. */
function sagCompression(side: 'front' | 'rear'): number {
  const params = side === 'front' ? SuspensionConfig.front : SuspensionConfig.rear;
  const staticLoad = (BikeConfig.mass * 19.2) / 2;
  return Math.min(params.maxCompression, staticLoad / params.springStrength);
}

/** Estado con la moto apoyada sobre un suelo llano en y = 0. */
function grounded(overrides: Partial<BikeState> = {}, frontComp?: number, rearComp?: number): BikeState {
  const front = frontComp ?? sagCompression('front');
  const rear = rearComp ?? sagCompression('rear');
  // Altura del centro de masas para que el suelo caiga en y = 0.
  //
  //   anclaje   = com + (0, -anchorDropFromCom)
  //   centro    = anclaje - (0, restLength - compresion)
  //   suelo     = centro.y - wheelRadius = 0
  //
  // de donde com.y = (restLength - compresion) + anchorDropFromCom + wheelRadius.
  const drop = (SuspensionConfig.front.restLength - front + SuspensionConfig.rear.restLength - rear) / 2;
  const y = drop + BikeConfig.anchorDropFromCom + BikeConfig.wheelRadius;
  const base = createInitialBikeState(0, y);
  return {
    ...base,
    ...overrides,
    front: { ...base.front, compression: front, inContact: true, groundY: 0, contactX: BikeConfig.wheelBase / 2, load: 1700, ...(overrides.front ?? {}) },
    rear: { ...base.rear, compression: rear, inContact: true, groundY: 0, contactX: -BikeConfig.wheelBase / 2, load: 1700, ...(overrides.rear ?? {}) },
    rider: { ...base.rider, ...(overrides.rider ?? {}) },
  };
}

const POSES: Pose[] = [
  {
    label: '1. PARADA EN LLANO — suspension en reposo',
    build: () => grounded(),
  },
  {
    label: '2. ACELERANDO — trasera hundida, cuerpo atras',
    build: () =>
      grounded(
        {
          angle: 0.16,
          vx: 12,
          throttleAmount: 1,
          rider: { shiftX: -0.28, shiftY: -0.05, torsoAngle: 0.24, shiftXVelocity: 0, shiftYVelocity: 0, torsoVelocity: 0 },
          rear: { compression: 0.30, inContact: true, groundY: 0, contactX: -0.675, load: 3600, compressionVelocity: 0, wheel: { spin: 1.2, spinRate: 90, slip: 3.4 } },
        },
        0.05,
        0.3,
      ),
  },
  {
    label: '3. FRENANDO — horquilla hundida, cuerpo delante',
    build: () =>
      grounded(
        {
          angle: -0.12,
          vx: 18,
          brakeAmount: 1,
          rider: { shiftX: 0.16, shiftY: -0.09, torsoAngle: -0.2, shiftXVelocity: 0, shiftYVelocity: 0, torsoVelocity: 0 },
          front: { compression: 0.34, inContact: true, groundY: 0, contactX: 0.675, load: 5200, compressionVelocity: 0, wheel: { spin: -0.6, spinRate: 20, slip: -1.2 } },
        },
        0.34,
        0.02,
      ),
  },
  {
    label: '4. EN VUELO — suspension extendida del todo',
    build: () => {
      const base = createInitialBikeState(0, 1.2);
      return {
        ...base,
        angle: 0.28,
        vx: 20,
        vy: 6,
        angularVelocity: 1.2,
        throttleAmount: 1,
        rider: { shiftX: -0.1, shiftY: 0.09, torsoAngle: 0.1, shiftXVelocity: 0, shiftYVelocity: 0, torsoVelocity: 0 },
        front: { ...base.front, compression: 0, inContact: false, groundY: -3, contactX: 0.675, wheel: { spin: 2.1, spinRate: 70, slip: 0 } },
        rear: { ...base.rear, compression: 0, inContact: false, groundY: -3, contactX: -0.675, wheel: { spin: -1.4, spinRate: 118, slip: 0 } },
      };
    },
  },
  {
    label: '5. ATERRIZANDO — las dos al tope, cuerpo absorbiendo',
    build: () =>
      grounded(
        {
          angle: 0.02,
          vx: 19,
          vy: -12,
          rider: { shiftX: -0.03, shiftY: -0.2, torsoAngle: 0.05, shiftXVelocity: 0, shiftYVelocity: 0, torsoVelocity: 0 },
        },
        SuspensionConfig.front.maxCompression,
        SuspensionConfig.rear.maxCompression,
      ),
  },
  {
    label: '6. CABALLITO — solo la trasera apoyada',
    build: () => {
      const state = grounded({ angle: 0.62, vx: 9, throttleAmount: 1 }, 0, 0.26);
      return {
        ...state,
        rider: { shiftX: -0.33, shiftY: -0.02, torsoAngle: 0.36, shiftXVelocity: 0, shiftYVelocity: 0, torsoVelocity: 0 },
        front: { ...state.front, compression: 0, inContact: false, groundY: -1.4, wheel: { spin: 0.4, spinRate: 34, slip: 0 } },
        rear: { ...state.rear, wheel: { spin: 2.4, spinRate: 96, slip: 2.1 } },
      };
    },
  },
  {
    label: '7. IMPACTO — piloto AUN montado (0.1 s tras el crash)',
    build: () => grounded({ angle: -0.62, vx: 6 }, 0.34, 0.05),
    crashed: true,
    crashElapsed: 0.1,
  },
  {
    label: '8. CAIDA — separado ya, 0.5 s tras el crash',
    build: () => grounded({ angle: -0.9, vx: 3 }, 0.2, 0.1),
    crashed: true,
    crashElapsed: 0.5,
  },
  {
    label: '9. GIRO DE RUEDA — misma pose, ruedas a media vuelta',
    build: () => {
      const state = grounded();
      return {
        ...state,
        front: { ...state.front, wheel: { spin: Math.PI / 2, spinRate: 0, slip: 0 } },
        rear: { ...state.rear, wheel: { spin: Math.PI / 2, spinRate: 0, slip: 0 } },
      };
    },
  },
];

/**
 * Misma transformacion EXACTA que `Renderer.worldToScreen`. Si no lo fuera,
 * los marcadores y los sprites no compartirian sistema de coordenadas y el
 * banco senalaria fallos de ensamblaje que no existen.
 */
function worldToCell(camera: CameraPose, wx: number, wy: number): { x: number; y: number } {
  return {
    x: CELL_WIDTH / 2 + (wx - camera.x) * camera.pixelsPerMeter,
    y: CELL_HEIGHT / 2 - (wy - camera.y) * camera.pixelsPerMeter,
  };
}

function drawMarkers(ctx: CanvasRenderingContext2D, camera: CameraPose, bike: BikeState): void {
  const groundY = 0;
  ctx.save();
  ctx.lineWidth = 1;

  // Plano de rodadura.
  const left = worldToCell(camera, bike.x - 3, groundY);
  const right = worldToCell(camera, bike.x + 3, groundY);
  ctx.strokeStyle = 'rgba(120, 255, 160, 0.55)';
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(left.x, left.y);
  ctx.lineTo(right.x, right.y);
  ctx.stroke();
  ctx.setLineDash([]);

  for (const side of ['front', 'rear'] as const) {
    const wheel = side === 'front' ? bike.front : bike.rear;
    const centre = wheelVisualCenterWorld(bike, side);
    const anchor = wheelAnchorWorld(bike, side);

    // Eje de la rueda: circulo hueco del radio fisico.
    const c = worldToCell(camera, centre.x, centre.y);
    ctx.strokeStyle = wheel.inContact ? 'rgba(255, 210, 90, 0.95)' : 'rgba(120, 190, 255, 0.95)';
    ctx.beginPath();
    ctx.arc(c.x, c.y, BikeConfig.wheelRadius * PIXELS_PER_METER, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(c.x, c.y, 3, 0, Math.PI * 2);
    ctx.stroke();

    // Eje de la horquilla, del anclaje al centro de rueda.
    const a = worldToCell(camera, anchor.x, anchor.y);
    ctx.strokeStyle = 'rgba(255, 140, 60, 0.7)';
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(c.x, c.y);
    ctx.stroke();

    // Punto de contacto: cruz sobre el suelo.
    if (wheel.inContact) {
      const contact = worldToCell(camera, centre.x, centre.y - BikeConfig.wheelRadius);
      ctx.strokeStyle = 'rgba(255, 90, 90, 0.95)';
      ctx.beginPath();
      ctx.moveTo(contact.x - 6, contact.y);
      ctx.lineTo(contact.x + 6, contact.y);
      ctx.moveTo(contact.x, contact.y - 6);
      ctx.lineTo(contact.x, contact.y + 6);
      ctx.stroke();
    }
  }

  // Centro de masas.
  const com = worldToCell(camera, bike.x, bike.y);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.beginPath();
  ctx.arc(com.x, com.y, 3, 0, Math.PI * 2);
  ctx.fill();

  // Esqueleto del piloto: cadera, hombro, codo, mano, rodilla y tobillo, mas
  // los dos agarres del chasis. Si la mano no cae sobre el puno o el pie no
  // cae sobre la estribera, la cinematica inversa esta mal enganchada.
  const rig = solveRiderRig({ x: bike.x, y: bike.y }, bike.angle, bike.rider, camera.pixelsPerMeter);
  const grip = rotateVec(HANDLEBAR_GRIP_LOCAL, bike.angle);
  const peg = rotateVec(FOOTPEG_LOCAL, bike.angle);

  const bones: Array<[{ x: number; y: number }, { x: number; y: number }]> = [
    [rig.hipWorld, rig.shoulderWorld],
    [rig.shoulderWorld, rig.arm.joint],
    [rig.arm.joint, { x: rig.arm.joint.x + Math.cos(rig.arm.midAngle) * 0.132, y: rig.arm.joint.y + Math.sin(rig.arm.midAngle) * 0.132 }],
    [rig.hipWorld, rig.leg.joint],
    [rig.leg.joint, { x: rig.leg.joint.x + Math.cos(rig.leg.midAngle) * 0.236, y: rig.leg.joint.y + Math.sin(rig.leg.midAngle) * 0.236 }],
  ];
  ctx.strokeStyle = 'rgba(120, 255, 255, 0.9)';
  ctx.lineWidth = 1.5;
  for (const [a, b] of bones) {
    const pa = worldToCell(camera, a.x, a.y);
    const pb = worldToCell(camera, b.x, b.y);
    ctx.beginPath();
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(120, 255, 255, 0.95)';
  for (const point of [rig.hipWorld, rig.shoulderWorld, rig.arm.joint, rig.leg.joint]) {
    const p = worldToCell(camera, point.x, point.y);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Agarres del chasis: cuadrados magenta.
  ctx.strokeStyle = 'rgba(255, 110, 220, 0.95)';
  for (const local of [grip, peg]) {
    const p = worldToCell(camera, bike.x + local.x, bike.y + local.y);
    ctx.strokeRect(p.x - 5, p.y - 5, 10, 10);
  }

  ctx.restore();
}

async function waitForSprites(): Promise<void> {
  const images = [
    SpriteImages.bikeBody,
    SpriteImages.wheelFront,
    SpriteImages.wheelRear,
    SpriteImages.riderTorso,
    SpriteImages.riderArmUpper,
    SpriteImages.riderArmFore,
    SpriteImages.riderThigh,
    SpriteImages.riderShin,
    SpriteImages.riderCrash,
  ];
  await Promise.all(
    images.map(
      (image) =>
        new Promise<void>((resolve) => {
          if (image.complete && image.naturalWidth > 0) resolve();
          else {
            image.addEventListener('load', () => resolve(), { once: true });
            image.addEventListener('error', () => resolve(), { once: true });
          }
        }),
    ),
  );
}

async function main(): Promise<void> {
  await waitForSprites();
  const grid = document.getElementById('grid') as HTMLDivElement;

  for (const pose of POSES) {
    const figure = document.createElement('figure');
    const canvas = document.createElement('canvas');
    canvas.width = CELL_WIDTH;
    canvas.height = CELL_HEIGHT;
    canvas.style.width = `${CELL_WIDTH}px`;
    canvas.style.height = `${CELL_HEIGHT}px`;
    const caption = document.createElement('figcaption');
    caption.textContent = pose.label;
    figure.appendChild(canvas);
    figure.appendChild(caption);
    grid.appendChild(figure);

    const bike = pose.build();
    const renderer = new Renderer(canvas);
    const camera: CameraPose = {
      x: bike.x,
      y: bike.y - COM_HEIGHT_ABOVE_GROUND * 0.35,
      pixelsPerMeter: PIXELS_PER_METER,
    };
    renderer.drawBikeOnly(camera, bike, { crashed: pose.crashed, crashElapsed: pose.crashElapsed });

    const ctx = canvas.getContext('2d');
    if (ctx) drawMarkers(ctx, camera, bike);
  }

  document.body.dataset.rigReady = 'true';
}

void main();
