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
  wheelAnchorWorld,
  wheelVisualCenterWorld,
} from '../physics/Bike';
import { BikeConfig } from '../config/GameConfig';
import { SpriteCalibration, SpriteImages } from '../rendering/SpriteAssets';
import { rotateVec } from '../physics/MathUtils';
import { FOOTPEG_LOCAL, HANDLEBAR_GRIP_LOCAL, solveRiderRig } from '../rendering/RiderRig';
import { RIG_POSES } from './RigPoseCatalog';

const CELL_WIDTH = 420;
const CELL_HEIGHT = 340;
const PIXELS_PER_METER = 150;

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
  const rig2 = SpriteCalibration.riderRig;
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
  // Articulaciones del piloto, EXTREMOS INCLUIDOS. La mano y el tobillo son
  // los dos puntos que de verdad hay que mirar -son los que se despegaban- y
  // hasta ahora se dibujaba el hueso pero no su punta, asi que el fallo que
  // mas importaba era justo el que no tenia marcador.
  const forearm = rig2.armFore.lengthPx / rig2.pxPerMeter;
  const shin = rig2.shin.lengthPx / rig2.pxPerMeter;
  const hand = {
    x: rig.arm.joint.x + Math.cos(rig.arm.midAngle) * forearm,
    y: rig.arm.joint.y + Math.sin(rig.arm.midAngle) * forearm,
  };
  const ankle = {
    x: rig.leg.joint.x + Math.cos(rig.leg.midAngle) * shin,
    y: rig.leg.joint.y + Math.sin(rig.leg.midAngle) * shin,
  };
  ctx.fillStyle = 'rgba(120, 255, 255, 0.95)';
  for (const point of [rig.hipWorld, rig.shoulderWorld, rig.arm.joint, rig.leg.joint]) {
    const p = worldToCell(camera, point.x, point.y);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Mano y tobillo, en blanco y mas grandes: son los que tienen que caer
  // DENTRO del cuadrado de su agarre.
  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  for (const point of [hand, ankle]) {
    const p = worldToCell(camera, point.x, point.y);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  // Agarres del chasis: cuadrados magenta.
  ctx.strokeStyle = 'rgba(255, 110, 220, 0.95)';
  ctx.lineWidth = 1.5;
  for (const local of [grip, peg]) {
    const p = worldToCell(camera, bike.x + local.x, bike.y + local.y);
    ctx.strokeRect(p.x - 6, p.y - 6, 12, 12);
  }
  // Anclajes de suspension: rombos naranjas en el arranque de cada horquilla.
  ctx.strokeStyle = 'rgba(255, 170, 80, 0.95)';
  for (const side of ['front', 'rear'] as const) {
    const anchor = wheelAnchorWorld(bike, side);
    const p = worldToCell(camera, anchor.x, anchor.y);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - 5);
    ctx.lineTo(p.x + 5, p.y);
    ctx.lineTo(p.x, p.y + 5);
    ctx.lineTo(p.x - 5, p.y);
    ctx.closePath();
    ctx.stroke();
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

  for (const pose of RIG_POSES) {
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

    const bike = pose.bike;
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
