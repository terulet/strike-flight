/**
 * El puente entre un momento y el telefono.
 *
 * navigator.share abre el menu del sistema (WhatsApp, Telegram, lo que tenga
 * cada uno) y es lo que hace que compartir sea un gesto y no una tarea. Donde
 * no exista -escritorio, navegadores viejos- se copia al portapapeles, que es
 * el mismo resultado con un paso mas.
 */
import type { Momento } from '../meta/compartir';
import { button } from './dom';

type NavegadorConShare = Navigator & {
  share?: (data: { title?: string; text?: string }) => Promise<void>;
};

/**
 * Manda el texto al sistema.
 *
 * @returns 'compartido' | 'copiado' | 'nada' — quien llama decide que decir.
 *          Se distingue "copiado" de "compartido" porque el aviso tiene que
 *          ser distinto: si se ha copiado, hay que decirle a la persona que
 *          ahora lo pegue en algun sitio.
 */
export async function compartirTexto(texto: string): Promise<'compartido' | 'copiado' | 'nada'> {
  const nav = navigator as NavegadorConShare;
  if (typeof nav.share === 'function') {
    try {
      await nav.share({ title: 'PLAYZONE RUSH', text: texto });
      return 'compartido';
    } catch {
      // Cancelar el menu del sistema no es un fallo: es una decision. No se
      // cae al portapapeles por detras, que seria hacer algo que no se ha
      // pedido.
      return 'nada';
    }
  }
  try {
    await navigator.clipboard.writeText(texto);
    return 'copiado';
  } catch {
    return 'nada';
  }
}

/** El boton de compartir un momento concreto. */
export function botonCompartir(momento: Momento, alTerminar: (que: string) => void): HTMLElement {
  return button(momento.boton, 'btn btn--ghost btn--block compartir', async () => {
    const que = await compartirTexto(momento.texto);
    if (que === 'copiado') alTerminar('COPIADO: PEGALO EN EL GRUPO');
    else if (que === 'compartido') alTerminar('');
  });
}
