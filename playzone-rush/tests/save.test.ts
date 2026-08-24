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
    expect(report.save.profile.name).toBe('ELOI');

    // Las marcas NO sobreviven, y es correcto: cualquier partida anterior a la
    // v6 es de antes del lanzamiento, jugada con cuatro juegos y otra
    // interfaz. La cadena de migraciones la sube hasta la v5 intacta y el
    // arranque limpio se la lleva ahi. Antes esta prueba comprobaba que los
    // records llegaban enteros; ahora comprueba lo contrario a proposito.
    expect(report.save.records.bestByGame).toEqual({});
    expect(report.save.streak.days).toBe(0);
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

/**
 * El arranque limpio (v5 -> v6).
 *
 * Es la unica migracion del proyecto que tira datos, asi que es la que mas
 * falta hace probar: si se pasa de destructiva, la gente pierde el nombre y
 * las preferencias y abre la version nueva sintiendose desconocida; si se
 * queda corta, arrastramos al lanzamiento las marcas de una semana jugada con
 * cuatro juegos y otra interfaz.
 */
describe('arranque limpio v5 -> v6', () => {
  const semanaDePrueba = {
    version: 5,
    profile: { name: 'ELOI', createdAt: 1700000000000 },
    prefs: { muted: true, haptics: false, reducedMotion: true },
    days: {
      '2026-08-20': { ...emptyDayRecord(), secretUnlocked: true },
      '2026-08-21': { ...emptyDayRecord(), revealVisto: true },
    },
    records: { bestByGame: { pulse: 9999, drift: 5555 }, bestDailyTotal: 20000, bestChaos: 3000 },
    streak: { holder: 'me', days: 5, lastResolvedDay: '2026-08-21' },
    account: { mode: 'group', playerId: 'p1', secret: 's1', groupCode: 'K3P9', joinedAt: 1 },
    outbox: [{ attemptId: 'a1', challengeId: 'c1', gameId: 'pulse', score: 100 }],
    snapshot: { day: '2026-08-21', members: [] },
    social: { lastTotals: { '2026-08-21': { me: 100 } }, seenOvertakes: ['x'] },
    telemetry: { events: [{ type: 'app_open', ts: 1, day: '2026-08-20' }], counters: { app_open: 9 }, sent: 1 },
  };

  it('se lleva lo del juego', () => {
    const { save } = loadSaveFrom(store(semanaDePrueba));
    expect(save.days, 'los dias jugados').toEqual({});
    expect(save.records.bestByGame, 'los records por juego').toEqual({});
    expect(save.records.bestDailyTotal).toBe(0);
    expect(save.records.bestChaos).toBe(0);
    expect(save.streak.days, 'la racha').toBe(0);
    expect(save.telemetry.events, 'la telemetria').toEqual([]);
    expect(save.telemetry.counters).toEqual({});
    expect(save.social.seenOvertakes).toEqual([]);
  });

  it('se lleva la identidad del grupo viejo', () => {
    // El grupo de la semana de prueba ya no existe en el servidor. Guardar un
    // token muerto solo produce errores de sincronizacion en bucle.
    const { save } = loadSaveFrom(store(semanaDePrueba));
    expect(save.account.mode).toBe('none');
    expect(save.account.groupCode).toBeNull();
    expect(save.account.playerId).toBeNull();
    expect(save.account.secret).toBeNull();
    expect(save.outbox, 'la cola de envios al grupo viejo').toEqual([]);
    expect(save.snapshot).toBeNull();
  });

  it('respeta el nombre y las preferencias', () => {
    // Son ajustes de la persona, no del juego. Quitarlos seria hacerle repetir
    // trabajo a alguien que ya lo hizo.
    const { save } = loadSaveFrom(store(semanaDePrueba));
    expect(save.profile.name).toBe('ELOI');
    expect(save.prefs).toEqual({ muted: true, haptics: false, reducedMotion: true });
  });

  it('deja la partida en la version nueva', () => {
    const { save, status } = loadSaveFrom(store(semanaDePrueba));
    expect(save.version).toBe(SAVE_VERSION);
    expect(status).toBe('migrated');
  });

  it('sin nombre guardado no deja el hueco vacio', () => {
    const sinNombre = { ...semanaDePrueba, profile: { name: '   ', createdAt: 0 } };
    const { save } = loadSaveFrom(store(sinNombre));
    expect(save.profile.name.trim().length).toBeGreaterThan(0);
  });

  it('no se ejecuta dos veces', () => {
    // Quien ya abrio la version nueva y jugo no puede perder lo jugado al
    // volver a abrirla.
    const primera = loadSaveFrom(store(semanaDePrueba)).save;
    primera.days['2026-08-24'] = { ...emptyDayRecord(), secretUnlocked: true };
    primera.records.bestDailyTotal = 4242;
    const segunda = loadSaveFrom(store(primera)).save;
    expect(segunda.days['2026-08-24']).toBeDefined();
    expect(segunda.records.bestDailyTotal).toBe(4242);
  });
});

function store(data: unknown) {
  const s = createMemoryStore();
  s.set(SAVE_KEY, JSON.stringify(data));
  return s;
}
