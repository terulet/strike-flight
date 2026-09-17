import { describe, expect, it } from 'vitest';
import {
  buildInviteLink,
  inviteMessage,
  isLocalOrigin,
  normalizeGroupCode,
  publicOrigin,
  readInviteCode,
} from '../src/meta/invite';

describe('codigo de grupo en el enlace', () => {
  it('acepta el codigo tal cual y en minusculas', () => {
    expect(normalizeGroupCode('RYXX')).toBe('RYXX');
    expect(normalizeGroupCode('ryxx')).toBe('RYXX');
  });

  it('tolera lo que se pega desde un mensaje', () => {
    expect(normalizeGroupCode(' ryxx ')).toBe('RYXX');
    expect(normalizeGroupCode('R-Y-X-X')).toBe('RYXX');
  });

  it('rechaza lo que el servidor no aceptaria', () => {
    expect(normalizeGroupCode('RYX')).toBeNull();
    expect(normalizeGroupCode('')).toBeNull();
    expect(normalizeGroupCode(null)).toBeNull();
    expect(normalizeGroupCode('RYXXRYXXR')).toBeNull();
    // 0, O, 1, I, S, B y Z no existen en el alfabeto: son los que se leen mal.
    expect(normalizeGroupCode('RYX0')).toBeNull();
    expect(normalizeGroupCode('BOSS')).toBeNull();
  });
});

describe('enlace de invitacion', () => {
  it('lleva el codigo dentro', () => {
    expect(buildInviteLink('RYXX', 'https://ejemplo.ts.net')).toBe(
      'https://ejemplo.ts.net/?g=RYXX',
    );
  });

  it('no duplica la barra final del origen', () => {
    expect(buildInviteLink('RYXX', 'https://ejemplo.ts.net/')).toBe(
      'https://ejemplo.ts.net/?g=RYXX',
    );
  });

  it('conserva el subdirectorio donde este servida la app', () => {
    expect(buildInviteLink('RYXX', 'https://ejemplo.ts.net', '/rush/')).toBe(
      'https://ejemplo.ts.net/rush/?g=RYXX',
    );
  });

  it('quita el index.html para que el enlace sea limpio', () => {
    expect(buildInviteLink('RYXX', 'https://ejemplo.ts.net', '/index.html')).toBe(
      'https://ejemplo.ts.net/?g=RYXX',
    );
  });

  it('sin codigo valido no hay enlace que compartir', () => {
    expect(buildInviteLink('RYX', 'https://ejemplo.ts.net')).toBeNull();
    expect(buildInviteLink(null, 'https://ejemplo.ts.net')).toBeNull();
  });

  it('se lee de vuelta el codigo que se escribio', () => {
    const link = buildInviteLink('RYXX', 'https://ejemplo.ts.net');
    expect(readInviteCode(new URL(link!).search)).toBe('RYXX');
  });
});

describe('leer la invitacion al abrir', () => {
  it('sin parametro no hay invitacion', () => {
    expect(readInviteCode('')).toBeNull();
    expect(readInviteCode('?debug')).toBeNull();
  });

  it('convive con los otros parametros', () => {
    expect(readInviteCode('?debug&g=ryxx')).toBe('RYXX');
  });

  it('un codigo inventado en la URL no pasa', () => {
    expect(readInviteCode('?g=../../etc')).toBeNull();
    expect(readInviteCode('?g=')).toBeNull();
  });
});

describe('origen desde el que se invita', () => {
  it('una direccion de casa no sirve para invitar a nadie', () => {
    expect(isLocalOrigin('http://localhost:5173')).toBe(true);
    expect(isLocalOrigin('http://127.0.0.1:5173')).toBe(true);
    expect(isLocalOrigin('http://192.168.1.42:5173')).toBe(true);
    expect(isLocalOrigin('http://10.0.0.5:8788')).toBe(true);
    expect(isLocalOrigin('http://172.16.0.9:8788')).toBe(true);
    expect(isLocalOrigin('http://mac-mini.local:8788')).toBe(true);
  });

  it('una direccion publica si', () => {
    expect(isLocalOrigin('https://ejemplo.ts.net')).toBe(false);
    expect(isLocalOrigin('https://playzone.example.com')).toBe(false);
  });

  it('172.32 ya no es privada', () => {
    expect(isLocalOrigin('http://172.32.0.1:8788')).toBe(false);
  });

  it('la build puede fijar el origen publico', () => {
    expect(publicOrigin('http://100.98.237.124:8788', 'https://ejemplo.ts.net/')).toBe(
      'https://ejemplo.ts.net',
    );
    expect(publicOrigin('https://ejemplo.ts.net', '')).toBe('https://ejemplo.ts.net');
    expect(publicOrigin('https://ejemplo.ts.net', undefined)).toBe('https://ejemplo.ts.net');
  });
});

describe('mensaje que se envia', () => {
  it('nombra el grupo y anuncia el enlace', () => {
    expect(inviteMessage('RYXX')).toContain('RYXX');
    expect(inviteMessage('RYXX')).toContain('PLAYZONE RUSH');
  });
});
