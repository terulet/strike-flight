import { describe, expect, it } from 'vitest';
import html from '../index.html?raw';
import { SECTION_NAMES, getDailyMission } from '../src/game/daily';
import { MISSION_COUNT, getMission } from '../src/game/missions';
import { SPECIAL_LIVERIES } from '../src/game/progress';
import { EN } from '../src/i18n.en';
import { ordinal, setLang, t } from '../src/i18n';

/** Codigo fuente del juego (sin el propio diccionario). */
const SOURCES = Object.entries(import.meta.glob('../src/**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>).filter(
  ([file]) => !file.endsWith('i18n.en.ts'),
);

/** Todas las claves en español que el juego puede pasar por t(). */
function allKeys(): Set<string> {
  const keys = new Set<string>();
  const call = /\b(?:t|tr|fail)\(\s*'((?:[^'\\]|\\.)*)'/g;
  for (const [, src] of SOURCES) for (const m of src.matchAll(call)) keys.add(m[1].replace(/\\'/g, "'"));
  for (const m of html.matchAll(/data-i18n(?:-aria)?="([^"]+)"/g)) keys.add(m[1]);
  for (let id = 1; id <= MISSION_COUNT; id++) {
    const m = getMission(id);
    [m.name, m.place, m.objectiveText, m.briefing, ...m.track.sections.map((s) => s.name)].forEach((k) => keys.add(k));
  }
  const d = getDailyMission('2026-09-24');
  [d.objectiveText, d.briefing, ...SECTION_NAMES].forEach((k) => keys.add(k));
  for (const l of SPECIAL_LIVERIES) [l.name, l.how].forEach((k) => keys.add(k));
  return keys;
}

describe('traduccion al ingles', () => {
  it('no hay t() con plantillas de JS (no se podrian comprobar)', () => {
    expect(SOURCES.length).toBeGreaterThan(20);
    for (const [file, src] of SOURCES) expect(src, file).not.toMatch(/\b(?:t|tr)\(\s*`/);
  });

  it('cada texto del juego tiene su traduccion', () => {
    const missing = [...allKeys()].filter((k) => k && !(k in EN));
    expect(missing).toEqual([]);
  });

  it('las traducciones conservan las mismas variables', () => {
    const vars = (s: string): string[] => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const [es, en] of Object.entries(EN)) expect(vars(en), es).toEqual(vars(es));
  });

  it('no sobran traducciones', () => {
    const keys = allKeys();
    expect(Object.keys(EN).filter((k) => !keys.has(k))).toEqual([]);
  });

  it('t() cambia de idioma y rellena variables', () => {
    setLang('en');
    expect(t('PRUEBA {n}', { n: 3 })).toBe('EVENT 3');
    expect(ordinal(1)).toBe('1st');
    expect(ordinal(12)).toBe('12th');
    expect(ordinal(23)).toBe('23rd');
    setLang('es');
    expect(t('PRUEBA {n}', { n: 3 })).toBe('PRUEBA 3');
    expect(ordinal(2)).toBe('2º');
  });
});
