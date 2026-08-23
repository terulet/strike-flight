import { describe, expect, it } from 'vitest';
import {
  SAVE_BACKUP_KEY,
  SAVE_KEY,
  SAVE_VERSION,
  SaveManager,
  defaultSave,
  emptyDayRecord,
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

/**
 * normalizeDay() reconstruye el registro del dia campo a campo, asi que un
 * campo nuevo que se anada al tipo pero se olvide alli se pierde en silencio
 * en cada carga. Paso de verdad con revealVisto: el sorteo del dia se guardaba,
 * la recarga lo borraba, y el sorteo volvia a salir en cada apertura. El tipo
 * no protege de esto porque normalizeDay construye un objeto nuevo.
 */
describe('el dia sobrevive entero a la normalizacion', () => {
  it('ningun campo del registro del dia se pierde al recargar', () => {
    const dia = emptyDayRecord();
    // Se marcan todos los booleanos: si alguno se cae, vuelve a false y salta.
    const guardado: Record<string, unknown> = { ...dia };
    for (const [clave, valor] of Object.entries(guardado)) {
      if (typeof valor === 'boolean') guardado[clave] = true;
    }

    const recargado = normalizeSave({ version: SAVE_VERSION, days: { '2026-08-23': guardado } })
      .days['2026-08-23'];

    for (const clave of Object.keys(dia)) {
      expect(recargado, `falta "${clave}" tras normalizar`).toHaveProperty(clave);
    }
    for (const [clave, valor] of Object.entries(guardado)) {
      if (typeof valor === 'boolean') {
        expect(recargado?.[clave as keyof typeof recargado], `"${clave}" no sobrevive`).toBe(true);
      }
    }
  });

  it('revealVisto sobrevive, que es el caso que fallo', () => {
    const cargado = normalizeSave({
      version: SAVE_VERSION,
      days: { '2026-08-23': { ...emptyDayRecord(), revealVisto: true } },
    });
    expect(cargado.days['2026-08-23']?.revealVisto).toBe(true);
  });
});
