import { afterEach, describe, expect, it, vi } from 'vitest';
import { CrazyGamesPlatform, WebPlatform } from '../src/platform/platform';

function fakeSdk(adResult: 'finish' | 'error' = 'finish') {
  const calls: string[] = [];
  const sdk = {
    environment: 'crazygames',
    init: vi.fn(async () => {}),
    ad: {
      requestAd: vi.fn((type: string, cb: { adStarted?: () => void; adFinished?: () => void; adError?: (e: unknown) => void }) => {
        calls.push(`ad:${type}`);
        cb.adStarted?.();
        if (adResult === 'finish') cb.adFinished?.();
        else cb.adError?.('no fill');
      }),
    },
    game: {
      gameplayStart: vi.fn(() => calls.push('start')),
      gameplayStop: vi.fn(() => calls.push('stop')),
      happytime: vi.fn(() => calls.push('happy')),
      inviteLink: vi.fn((p: Record<string, string>) => `https://www.crazygames.com/game/holeshot?reto=${p.reto}`),
      getInviteParam: vi.fn((k: string) => (k === 'reto' ? 'TOKEN' : null)),
    },
  };
  (globalThis as unknown as { window: unknown }).window = { CrazyGames: { SDK: sdk } };
  return { sdk, calls };
}

afterEach(() => {
  delete (globalThis as unknown as { window?: unknown }).window;
  vi.useRealTimers();
});

describe('plataforma CrazyGames', () => {
  it('avisa de inicio y parada de partida sin repetir avisos', async () => {
    const { calls } = fakeSdk();
    const p = new CrazyGamesPlatform();
    await p.init();
    p.gameplayStart();
    p.gameplayStart();
    p.gameplayStop();
    p.gameplayStop();
    p.happytime();
    expect(calls).toEqual(['start', 'stop', 'happy']);
  });

  it('silencia durante el anuncio y respeta la pausa entre anuncios', async () => {
    vi.useFakeTimers();
    const { calls } = fakeSdk();
    const p = new CrazyGamesPlatform();
    await p.init();
    const muted: boolean[] = [];
    const hooks = { onStart: () => muted.push(true), onEnd: () => muted.push(false) };
    await p.midgameAd(hooks); // recien cargado: todavia no
    expect(calls).toEqual([]);
    vi.advanceTimersByTime(151_000);
    await p.midgameAd(hooks);
    expect(calls).toEqual(['ad:midgame']);
    expect(muted).toEqual([true, false]);
    await p.midgameAd(hooks); // demasiado pronto otra vez
    expect(calls).toEqual(['ad:midgame']);
  });

  it('el anuncio recompensado solo recompensa si se ve entero', async () => {
    fakeSdk('error');
    const bad = new CrazyGamesPlatform();
    await bad.init();
    expect(await bad.rewardedAd({ onStart: () => {}, onEnd: () => {} })).toBe(false);
    fakeSdk('finish');
    const good = new CrazyGamesPlatform();
    await good.init();
    expect(await good.rewardedAd({ onStart: () => {}, onEnd: () => {} })).toBe(true);
  });

  it('los retos usan las invitaciones de CrazyGames', async () => {
    fakeSdk();
    const p = new CrazyGamesPlatform();
    await p.init();
    expect(p.inviteLink({ reto: 'ABC' })).toContain('reto=ABC');
    expect(p.inviteParam('reto')).toBe('TOKEN');
  });

  it('sin SDK (o fuera de CrazyGames) todo es inofensivo', async () => {
    const p = new CrazyGamesPlatform();
    await p.init();
    p.gameplayStart();
    await p.midgameAd({ onStart: () => {}, onEnd: () => {} });
    expect(await p.rewardedAd({ onStart: () => {}, onEnd: () => {} })).toBe(false);
    expect(p.inviteLink({ reto: 'x' })).toBeNull();
    const w = new WebPlatform();
    expect(w.hasRewarded).toBe(false);
    expect(await w.rewardedAd()).toBe(false);
  });
});
