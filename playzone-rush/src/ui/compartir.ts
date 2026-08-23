/**
 * El puente entre un momento y el telefono.
 *
 * Tres caminos, en orden de calidad, y NINGUNO falla en silencio:
 *
 * 1. Compartir el FICHERO por el menu del sistema. Es el bueno: la imagen
 *    entra en el chat como imagen.
 * 2. Compartir solo el TEXTO, si el navegador comparte pero no ficheros.
 * 3. Descargar la imagen y copiar el texto, si no hay menu de compartir.
 *    Se dice claramente que ha pasado, porque una descarga silenciosa parece
 *    que no ha hecho nada.
 *
 * Cancelar el menu del sistema NO es un fallo: es una decision. En ese caso no
 * se cae al portapapeles por detras, que seria hacer algo que nadie ha pedido.
 */
import type { Momento } from '../meta/compartir';
import { nombreDeFichero, posterComoBlob, TIPO_MIME } from './poster';
import { button } from './dom';

type NavegadorConShare = Navigator & {
  share?: (data: { title?: string; text?: string; files?: File[] }) => Promise<void>;
  canShare?: (data: { files?: File[] }) => boolean;
};

export type ResultadoCompartir =
  | 'imagen'      // la imagen ha ido al menu del sistema
  | 'texto'       // solo el texto
  | 'descargada'  // guardada en el dispositivo y texto copiado
  | 'copiado'     // solo texto al portapapeles
  | 'cancelado'   // la persona ha cerrado el menu
  | 'fallo';

/** Lo que se le dice a la persona segun como haya ido. */
export const AVISOS: Record<ResultadoCompartir, string> = {
  imagen: '',
  texto: 'COMPARTIDO',
  descargada: 'IMAGEN GUARDADA Y TEXTO COPIADO',
  copiado: 'COPIADO: PEGALO EN EL GRUPO',
  cancelado: '',
  fallo: 'NO SE HA PODIDO COMPARTIR. PRUEBA OTRA VEZ.',
};

/** ¿Puede este navegador mandar una imagen por el menu del sistema? */
export function puedeCompartirFicheros(): boolean {
  const nav = navigator as NavegadorConShare;
  if (typeof nav.share !== 'function' || typeof nav.canShare !== 'function') return false;
  try {
    // Un fichero de mentira del mismo tipo: algunos navegadores dicen que si a
    // "share" y que no a ficheros, y solo se sabe preguntando por uno.
    const prueba = new File([new Blob([''], { type: TIPO_MIME })], `p.${TIPO_MIME.split('/')[1]}`, { type: TIPO_MIME });
    return nav.canShare({ files: [prueba] });
  } catch {
    return false;
  }
}

/**
 * Comparte el momento con su poster.
 *
 * El poster se dibuja AQUI y no antes: dibujar 1080x1350 cuesta unos
 * milisegundos y no tiene por que gastarlos quien no va a compartir. Al pulsar
 * el boton la partida ya ha terminado, asi que no le quita tiempo a nadie.
 */
export async function compartirMomento(momento: Momento, codigoGrupo?: string | null): Promise<ResultadoCompartir> {
  const nav = navigator as NavegadorConShare;
  let blob: Blob | null = null;
  try {
    blob = await posterComoBlob(momento, { codigoGrupo });
  } catch {
    // Sin imagen se sigue: el texto solo ya cuenta la historia.
    blob = null;
  }

  if (blob && puedeCompartirFicheros()) {
    // El tipo sale de poster.ts y no escrito a mano: el fichero se llamaba
    // .jpg, llevaba bytes JPEG y se declaraba como image/png. Las apps que
    // reciben la imagen miran ese tipo, no la extension.
    const fichero = new File([blob], nombreDeFichero(momento), { type: TIPO_MIME });
    try {
      await nav.share!({ title: 'PLAYZONE RUSH', text: momento.texto, files: [fichero] });
      return 'imagen';
    } catch (error) {
      if (esCancelacion(error)) return 'cancelado';
      // Si el menu falla con la imagen, se intenta sin ella antes de rendirse.
    }
  }

  if (typeof nav.share === 'function') {
    try {
      await nav.share({ title: 'PLAYZONE RUSH', text: momento.texto });
      return 'texto';
    } catch (error) {
      if (esCancelacion(error)) return 'cancelado';
    }
  }

  // Sin menu del sistema: se guarda la imagen y se copia el texto, y se avisa.
  const copiado = await copiar(momento.texto);
  if (blob) {
    const guardada = descargar(blob, nombreDeFichero(momento));
    if (guardada) return 'descargada';
  }
  return copiado ? 'copiado' : 'fallo';
}

/** Compartir solo texto (invitaciones). */
export async function compartirTexto(texto: string): Promise<'compartido' | 'copiado' | 'cancelado' | 'fallo'> {
  const nav = navigator as NavegadorConShare;
  if (typeof nav.share === 'function') {
    try {
      await nav.share({ title: 'PLAYZONE RUSH', text: texto });
      return 'compartido';
    } catch (error) {
      if (esCancelacion(error)) return 'cancelado';
    }
  }
  return (await copiar(texto)) ? 'copiado' : 'fallo';
}

async function copiar(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    return false;
  }
}

/** Guarda el fichero. Devuelve si se ha llegado a lanzar la descarga. */
function descargar(blob: Blob, nombre: string): boolean {
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Se suelta el objeto un momento despues: revocarlo en el acto corta la
    // descarga en algunos navegadores.
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return true;
  } catch {
    return false;
  }
}

/** Cerrar el menu del sistema lanza AbortError. No es un error nuestro. */
function esCancelacion(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

/** El boton de compartir un momento. */
export function botonCompartir(
  momento: Momento,
  opciones: { codigoGrupo?: string | null; onAviso?: (texto: string) => void },
): HTMLElement {
  const node = button(momento.boton, 'btn btn--block compartir', async () => {
    if (node.dataset.enMarcha === '1') return; // dos toques seguidos no abren dos menus
    node.dataset.enMarcha = '1';
    const original = node.textContent;
    node.textContent = 'PREPARANDO...';
    try {
      const que = await compartirMomento(momento, opciones.codigoGrupo);
      const aviso = AVISOS[que];
      if (aviso) opciones.onAviso?.(aviso);
    } finally {
      node.textContent = original;
      node.dataset.enMarcha = '0';
    }
  });
  return node;
}
