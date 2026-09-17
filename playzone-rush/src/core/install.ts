/**
 * Dejarselo instalado.
 *
 * PLAYZONE RUSH no esta en ninguna tienda: se instala desde el navegador. En
 * Android el navegador lo ofrece solo, pero en iOS no hay ningun boton — si
 * nadie te lo cuenta, te quedas con una pestana de Safari y no vuelves. Quien
 * llega por un enlace de invitacion es exactamente quien necesita que se lo
 * cuenten, asi que el aviso vive en el onboarding.
 */

export type InstallAdvice = 'ios' | 'other' | null;

/**
 * Que hay que explicarle a quien esta mirando. `null` cuando la app ya se
 * abre desde la pantalla de inicio: ahi no hay nada que instalar.
 */
export function installAdvice(userAgent: string, standalone: boolean): InstallAdvice {
  if (standalone) return null;
  // El iPad moderno se declara "Macintosh"; lo delata el tener tactil.
  if (/iPhone|iPad|iPod/i.test(userAgent)) return 'ios';
  return 'other';
}

/** El texto del aviso, o null si no toca ensenar ninguno. */
export function installText(advice: InstallAdvice): string | null {
  if (advice === 'ios') {
    return 'Para tenerlo como app: COMPARTIR y luego ANADIR A PANTALLA DE INICIO.';
  }
  if (advice === 'other') {
    return 'Para tenerlo como app: menu del navegador y luego INSTALAR.';
  }
  return null;
}

/** Si la app se esta ejecutando ya instalada (pantalla completa). */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const legacy = (navigator as Navigator & { standalone?: boolean }).standalone;
  if (legacy === true) return true;
  try {
    return window.matchMedia('(display-mode: standalone)').matches;
  } catch {
    return false;
  }
}

/** El aviso que toca aqui y ahora. */
export function currentInstallText(): string | null {
  if (typeof navigator === 'undefined') return null;
  return installText(installAdvice(navigator.userAgent, isStandalone()));
}
