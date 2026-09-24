/** Vista previa del garaje: tu moto y tu piloto con tus colores y dorsal. */
import { RiderProfile } from '../game/progress';
import { RiderRig, drawBike, makeLivery, setStyle } from './bikeArt';

export function drawGaragePreview(canvas: HTMLCanvasElement, rider: RiderProfile, time: number): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);
  const ppm = H / 2.4;
  const groundY = H * 0.86;
  // Suelo con franja de pista.
  ctx.fillStyle = '#5a3d28';
  ctx.fillRect(0, groundY, W, H - groundY);
  ctx.fillStyle = '#7a5236';
  ctx.fillRect(0, groundY - 0.3 * ppm, W, 0.3 * ppm);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(0, groundY - 2, W, 2);
  ctx.setTransform(ppm, 0, 0, -ppm, W / 2 + 0.1 * ppm, groundY - 0.66 * ppm);
  const rig = new RiderRig();
  for (let i = 0; i < 30; i++) {
    rig.update(1 / 60, {
      x: 0, y: 0, vx: 0, vy: 0, angle: 0, omega: 0,
      rear: { comp: 0.09, compVel: 0, spin: 0, spinRate: 0, inContact: true, load: 0, slip: 0, contactX: 0, contactY: 0, mud: 0 },
      front: { comp: 0.09, compVel: 0, spin: 0, spinRate: 0, inContact: true, load: 0, slip: 0, contactX: 0, contactY: 0, mud: 0 },
      throttle: 0, brake: 0, lean: 0, nitro: false, accel: 0,
    });
  }
  setStyle({ livery: makeLivery(rider.colors, rider.number), fog: 0, fogColor: '#888888', mud: 0, mudColor: '#4a3020', seed: 1 });
  const spin = time * 0.6;
  drawBike(ctx, { rearComp: 0.09, frontComp: 0.09, rearSpin: spin, frontSpin: spin, rearSpinRate: 0, frontSpinRate: 0 }, rig.pose(), false);
  setStyle(null);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}
