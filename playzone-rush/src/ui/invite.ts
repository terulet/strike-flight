/**
 * Invitar a alguien: el enlace, no el codigo suelto.
 *
 * Lo usan la portada y el onboarding, para que COPIAR y COMPARTIR hagan lo
 * mismo se pulsen donde se pulsen.
 */
import { buildInviteLink, inviteMessage, isLocalOrigin, publicOrigin } from '../meta/invite';
import type { App } from './app';

function origin(): string {
  return publicOrigin(
    location.origin,
    import.meta.env?.VITE_PUBLIC_URL as string | undefined,
  );
}

/** El enlace que abre el grupo, o null si todavia no hay codigo. */
export function inviteLink(code: string | null | undefined): string | null {
  return buildInviteLink(code, origin(), location.pathname);
}

/** True si el enlace solo funciona dentro de esta red (no sirve para invitar). */
export function inviteOnlyWorksHere(): boolean {
  return isLocalOrigin(origin());
}

/** Aviso para cuando se esta jugando en local y el enlace no saldria de casa. */
export const LOCAL_WARNING = 'Este enlace solo funciona en esta Wi-Fi.';

async function toClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Copia el enlace completo. Si no hay portapapeles, ensena que copiar. */
export async function copyInvite(app: App, code: string): Promise<void> {
  const link = inviteLink(code);
  app.audio.play('tap');
  if (!link) {
    app.toaster.show(code, 'neutral', 2600);
    return;
  }
  if (await toClipboard(link)) {
    app.toaster.show(inviteOnlyWorksHere() ? 'ENLACE COPIADO (SOLO ESTA WIFI)' : 'ENLACE COPIADO', 'good', 2000);
  } else {
    app.toaster.show(link, 'neutral', 4000);
  }
}

/**
 * Abre el menu de compartir del movil con el enlace dentro. `url` va aparte
 * del texto: es lo que hace que WhatsApp o Mensajes lo muestren como enlace
 * y no como una linea mas.
 */
export async function shareInvite(app: App, code: string): Promise<void> {
  const link = inviteLink(code);
  if (!link) {
    app.toaster.show(code, 'neutral', 2600);
    return;
  }
  const nav = navigator as Navigator & {
    share?: (data: { title?: string; text?: string; url?: string }) => Promise<void>;
  };
  if (typeof nav.share !== 'function') {
    await copyInvite(app, code);
    return;
  }
  try {
    await nav.share({ title: 'PLAYZONE RUSH', text: inviteMessage(code), url: link });
  } catch {
    /* el usuario ha cancelado el menu de compartir */
  }
}
