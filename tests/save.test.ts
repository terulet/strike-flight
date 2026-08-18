import { describe, expect, it } from 'vitest';
import {
  SAVE_BACKUP_KEY,
  SAVE_KEY,
  SAVE_VERSION,
  SaveManager,
  defaultSave,
  loadSaveFrom,
  normalizeSave,
} from '../src/core/save';
import { createMemoryStore } from '../src/core/storage';

describe('persistencia', () => {
  it('arranca limpio cuando no hay nada guardado', () => {
    const report = loadSaveFrom(createMemoryStore());
    expect(report.status).toBe('fresh');
    expect(report.save.version).toBe(SAVE_VERSION);
    expect(report.save.profile.name).toBe('ELOI');
  });

  it('rescata un JSON corrupto sin perder la sesion', () => {
    const store = createMemoryStore();
    store.set(SAVE_KEY, '{ esto no es json ');
    const report = loadSaveFrom(store);
    expect(report.status).toBe('recovered');
    expect(report.save.version).toBe(SAVE_VERSION);
    // Se archiva por si algun dia queremos mirarlo.
    expect(store.get(SAVE_BACKUP_KEY)).toContain('esto no es json');
  });

  it('rescata tambien un JSON valido pero absurdo', () => {
    const store = createMemoryStore();
    store.set(SAVE_KEY, '[1,2,3]');
    expect(loadSaveFrom(store).status).toBe('recovered');
  });

  it('migra un save antiguo (v1) al formato actual', () => {
    const store = createMemoryStore();
    store.set(
      SAVE_KEY,
      JSON.stringify({
        version: 1,
        profile: { name: 'eloi', createdAt: 123 },
        bests: { pulse: 4200, drift: 3100 },
        streakDays: 4,
        days: {},
      }),
    );
    const report = loadSaveFrom(store);
    expect(report.status).toBe('migrated');
    expect(report.fromVersion).toBe(1);
    expect(report.save.version).toBe(SAVE_VERSION);
    expect(report.save.records.bestByGame).toEqual({ pulse: 4200, drift: 3100 });
    expect(report.save.streak.days).toBe(4);
    expect(report.save.profile.name).toBe('ELOI');
  });

  it('normaliza basura y rellena lo que falta', () => {
    const save = normalizeSave({
      version: 2,
      profile: { name: 42 },
      prefs: { muted: 'si' },
      days: { 'no-es-un-dia': {}, '2026-08-18': { challenges: { c1: { bestScore: '900' } } } },
      records: { bestByGame: { pulse: 'x' } },
    });
    expect(save.profile.name).toBe('ELOI');
    expect(save.prefs.muted).toBe(false);
    expect(Object.keys(save.days)).toEqual(['2026-08-18']);
    expect(save.days['2026-08-18']?.challenges.c1?.bestScore).toBe(0);
    expect(save.records.bestByGame.pulse).toBe(0);
  });

  it('un save del futuro no borra los datos que si entiende', () => {
    const store = createMemoryStore();
    store.set(
      SAVE_KEY,
      JSON.stringify({ ...defaultSave(), version: 999, records: { bestDailyTotal: 8000 } }),
    );
    const report = loadSaveFrom(store);
    expect(report.save.records.bestDailyTotal).toBe(8000);
  });

  it('guarda, relee y resetea', () => {
    const store = createMemoryStore();
    const save = new SaveManager(store);
    save.update((data) => {
      data.profile.name = 'MARC';
    });
    expect(save.flush()).toBe(true);

    const reloaded = new SaveManager(store);
    expect(reloaded.get().profile.name).toBe('MARC');

    reloaded.reset();
    expect(new SaveManager(store).get().profile.name).toBe('ELOI');
  });

  it('sobrevive a un almacenamiento que rechaza escrituras', () => {
    const broken = {
      kind: 'local' as const,
      get: () => null,
      set: () => false,
      remove: () => undefined,
    };
    const save = new SaveManager(broken);
    save.update((data) => {
      data.profile.name = 'KALI';
    });
    expect(save.flush()).toBe(false);
    expect(save.get().profile.name).toBe('KALI');
  });
});
