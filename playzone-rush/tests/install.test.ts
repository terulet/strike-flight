import { describe, expect, it } from 'vitest';
import { installAdvice, installText } from '../src/core/install';

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';

describe('aviso de instalacion', () => {
  it('ya instalada: no hay nada que explicar', () => {
    expect(installAdvice(IPHONE, true)).toBeNull();
    expect(installAdvice(ANDROID, true)).toBeNull();
    expect(installText(null)).toBeNull();
  });

  it('en iOS se explica el camino, porque no hay boton', () => {
    expect(installAdvice(IPHONE, false)).toBe('ios');
    expect(installText('ios')).toContain('PANTALLA DE INICIO');
  });

  it('fuera de iOS basta con mandar al menu del navegador', () => {
    expect(installAdvice(ANDROID, false)).toBe('other');
    expect(installText('other')).toContain('INSTALAR');
  });
});
