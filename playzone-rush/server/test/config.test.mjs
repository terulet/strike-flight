/**
 * GAME_LIMITS es la lista de juegos que el servidor ACEPTA. Sin entrada ahi,
 * submitScore() rechaza con 400 "unknown_game" -en silencio, porque el
 * cliente reintenta desde un outbox y la partida no se rompe visiblemente-.
 *
 * Paso de verdad: RITMO, TRAZO y FRENO se anadieron al catalogo sin tocar
 * esta lista, y despues CAZA, CUENTA, TORRE, TRILE y CARGA igual. Los ocho
 * jugaban perfectamente en solitario y nunca llegaban al ranking del grupo.
 * Nadie lo vio hasta que un test se puso a mandar una puntuacion de verdad.
 *
 * Este test compara GAME_LIMITS contra el registro REAL de juegos del
 * cliente (src/games/index.ts), no contra una lista escrita a mano aqui: una
 * tercera lista solo trasladaria el mismo riesgo de desincronizarse.
 */
import { describe, expect, it } from 'vitest';
import { GAME_LIMITS } from '../src/config.mjs';
import { GAME_IDS } from '../../src/games/index.ts';

describe('GAME_LIMITS', () => {
  it('tiene una entrada para cada juego del catalogo real, ni uno menos', () => {
    const faltan = GAME_IDS.filter((id) => !(id in GAME_LIMITS));
    expect(faltan, `juegos sin GAME_LIMITS: ${faltan.join(', ')}`).toEqual([]);
  });

  it('no le sobra ninguna entrada de un juego que ya no existe', () => {
    // Lo contrario tambien es una desincronizacion: un juego retirado que
    // sigue aceptando puntuaciones no rompe nada visible, pero es la senal de
    // que esta lista se ha dejado de tocar en algun sitio del proceso.
    const sobran = Object.keys(GAME_LIMITS).filter((id) => !GAME_IDS.includes(id));
    expect(sobran, `en GAME_LIMITS y ya no en el catalogo: ${sobran.join(', ')}`).toEqual([]);
  });

  it('cada limite es plausible: hueco real entre duracion minima y maxima, techo de puntos positivo', () => {
    for (const [id, limits] of Object.entries(GAME_LIMITS)) {
      expect(limits.maxScore, id).toBeGreaterThan(0);
      expect(limits.minDurationMs, id).toBeGreaterThan(0);
      expect(limits.maxDurationMs, id).toBeGreaterThan(limits.minDurationMs);
    }
  });
});
