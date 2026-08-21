/**
 * ShareCard — renders a shareable result card to an offscreen canvas.
 * Returns a canvas + a dataURL, so a native shell (Capacitor share sheet) or
 * navigator.share can take it without any change to the game.
 */
import { formatMm } from '../ui/format.js';
import { t } from '../ui/i18n.js';
import { drawObjectShape, rgba } from './shapes.js';

export function renderShareCard({ mm, rank, challenge, zone, playerName = 'YOU' }, size = { w: 1080, h: 1350 }) {
  const canvas = document.createElement('canvas');
  canvas.width = size.w;
  canvas.height = size.h;
  const ctx = canvas.getContext('2d');
  const { w, h } = size;

  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#05070d');
  g.addColorStop(0.5, '#0b1220');
  g.addColorStop(1, '#030407');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  const halo = ctx.createRadialGradient(w * 0.5, h * 0.44, 0, w * 0.5, h * 0.44, w * 0.7);
  halo.addColorStop(0, rgba(zone?.color || '#38e8ff', 0.22));
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, w, h);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#8b95a7';
  ctx.font = '900 34px -apple-system, system-ui, sans-serif';
  ctx.fillText(t('share.title'), w / 2, 150);

  ctx.fillStyle = '#ffffff';
  ctx.font = `900 ${Math.round(w * 0.28)}px -apple-system, system-ui, sans-serif`;
  ctx.fillText(formatMm(mm), w / 2, h * 0.5);
  ctx.fillStyle = '#8b95a7';
  ctx.font = '900 60px -apple-system, system-ui, sans-serif';
  ctx.fillText('mm', w / 2, h * 0.5 + 78);

  if (zone) {
    ctx.fillStyle = zone.color;
    ctx.font = '900 40px -apple-system, system-ui, sans-serif';
    ctx.fillText(t(`zone.${zone.id}`), w / 2, h * 0.5 - Math.round(w * 0.22));
  }

  if (rank) {
    ctx.fillStyle = '#38e8ff';
    ctx.font = '900 46px -apple-system, system-ui, sans-serif';
    ctx.fillText(t('share.rank', { rank }), w / 2, h * 0.68);
  }

  if (challenge) {
    ctx.fillStyle = '#4c5566';
    ctx.font = '800 30px -apple-system, system-ui, sans-serif';
    ctx.fillText(`${challenge.surface.name} · ${challenge.object.name} · ${challenge.id}`, w / 2, h * 0.75);
    // the object itself, drawn at a readable scale
    ctx.save();
    ctx.translate(w / 2, h * 0.83);
    const s = (w * 0.30) / challenge.object.width;
    ctx.scale(s, -s);
    drawObjectShape(ctx, challenge.object, {});
    ctx.restore();
  }

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 52px -apple-system, system-ui, sans-serif';
  ctx.fillText(t('share.beat'), w / 2, h - 90);

  return { canvas, toDataURL: () => canvas.toDataURL('image/png') };
}

/** Best-effort native share; resolves false when the platform cannot do it. */
export async function shareResult(payload) {
  try {
    const { canvas } = renderShareCard(payload);
    if (!navigator.share || !navigator.canShare) return false;
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
    if (!blob) return false;
    const file = new File([blob], 'one-more-millimeter.png', { type: 'image/png' });
    if (!navigator.canShare({ files: [file] })) return false;
    await navigator.share({ files: [file], title: t('share.title') });
    return true;
  } catch (e) {
    return false;
  }
}
