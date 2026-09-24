/**
 * Plataforma donde corre el juego.
 *
 *  - `web`: la web publica normal. Sin anuncios; los retos van en el enlace.
 *  - `crazygames`: el portal CrazyGames (SDK v3). Avisa de cuando empieza y
 *    para la partida, pone anuncios SOLO en las pausas naturales (entre
 *    carreras, nunca en mitad de una), silencia el juego mientras dura el
 *    anuncio, ofrece anuncios recompensados opcionales para decoraciones,
 *    celebra los grandes momentos (happytime) y crea los enlaces de reto con
 *    su sistema de invitaciones.
 *
 * El resto del juego solo habla con esta interfaz.
 */

export interface AdHooks {
  /** El anuncio empieza: silenciar y pausar. */
  onStart(): void;
  /** El anuncio termina (o falla): recuperar el sonido. */
  onEnd(): void;
}

export interface Platform {
  readonly name: 'web' | 'crazygames';
  init(): Promise<void>;
  gameplayStart(): void;
  gameplayStop(): void;
  happytime(): void;
  /** Anuncio entre carreras. Se resuelve siempre (haya anuncio o no). */
  midgameAd(hooks: AdHooks): Promise<void>;
  /** true si hay anuncios recompensados en esta plataforma. */
  readonly hasRewarded: boolean;
  /** Resuelve true solo si el jugador ha visto el anuncio entero. */
  rewardedAd(hooks: AdHooks): Promise<boolean>;
  /** Enlace de reto propio de la plataforma (null = usar el de la web). */
  inviteLink(params: Record<string, string>): string | null;
  /** Parametro de un enlace de invitacion con el que se abrio el juego. */
  inviteParam(key: string): string | null;
}

export class WebPlatform implements Platform {
  readonly name = 'web' as const;
  readonly hasRewarded = false;
  async init(): Promise<void> {}
  gameplayStart(): void {}
  gameplayStop(): void {}
  happytime(): void {}
  async midgameAd(): Promise<void> {}
  async rewardedAd(): Promise<boolean> {
    return false;
  }
  inviteLink(): string | null {
    return null;
  }
  inviteParam(): string | null {
    return null;
  }
}

interface CrazySdk {
  init(): Promise<void>;
  environment: 'local' | 'crazygames' | 'disabled' | string;
  ad: {
    requestAd(type: 'midgame' | 'rewarded', callbacks: { adStarted?: () => void; adFinished?: () => void; adError?: (e: unknown) => void }): void;
  };
  game: {
    gameplayStart(): void;
    gameplayStop(): void;
    happytime(): void;
    inviteLink(params: Record<string, string>): string;
    getInviteParam(key: string): string | null;
  };
}

/** Pausa minima entre anuncios que pide el juego (CrazyGames aplica ademas su propio limite). */
const MIDGAME_GAP_MS = 150_000;

export class CrazyGamesPlatform implements Platform {
  readonly name = 'crazygames' as const;
  private sdk: CrazySdk | null = null;
  private playing = false;
  private lastAd = 0;

  get hasRewarded(): boolean {
    return !!this.sdk;
  }

  async init(): Promise<void> {
    const w = (typeof window === 'undefined' ? {} : window) as { CrazyGames?: { SDK?: CrazySdk } };
    const sdk = w.CrazyGames?.SDK;
    if (!sdk) return;
    try {
      await Promise.race([sdk.init(), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 6000))]);
      if (sdk.environment === 'crazygames' || sdk.environment === 'local') this.sdk = sdk;
    } catch {
      this.sdk = null;
    }
    // El primer anuncio no antes de un rato de juego.
    this.lastAd = Date.now();
  }

  private call(fn: (s: CrazySdk) => void): void {
    if (!this.sdk) return;
    try {
      fn(this.sdk);
    } catch {
      /* el SDK nunca debe romper el juego */
    }
  }

  gameplayStart(): void {
    if (this.playing) return;
    this.playing = true;
    this.call((s) => s.game.gameplayStart());
  }

  gameplayStop(): void {
    if (!this.playing) return;
    this.playing = false;
    this.call((s) => s.game.gameplayStop());
  }

  happytime(): void {
    this.call((s) => s.game.happytime());
  }

  private request(type: 'midgame' | 'rewarded', hooks: AdHooks): Promise<boolean> {
    return new Promise((resolve) => {
      const sdk = this.sdk;
      if (!sdk) return resolve(false);
      let started = false;
      let done = false;
      const finish = (ok: boolean): void => {
        if (done) return;
        done = true;
        if (started) hooks.onEnd();
        resolve(ok);
      };
      try {
        sdk.ad.requestAd(type, {
          adStarted: () => {
            started = true;
            hooks.onStart();
          },
          adFinished: () => finish(true),
          adError: () => finish(false),
        });
      } catch {
        finish(false);
      }
    });
  }

  async midgameAd(hooks: AdHooks): Promise<void> {
    if (!this.sdk || Date.now() - this.lastAd < MIDGAME_GAP_MS) return;
    this.lastAd = Date.now();
    await this.request('midgame', hooks);
  }

  async rewardedAd(hooks: AdHooks): Promise<boolean> {
    return this.request('rewarded', hooks);
  }

  inviteLink(params: Record<string, string>): string | null {
    if (!this.sdk) return null;
    try {
      return this.sdk.game.inviteLink(params);
    } catch {
      return null;
    }
  }

  inviteParam(key: string): string | null {
    if (!this.sdk) return null;
    try {
      return this.sdk.game.getInviteParam(key);
    } catch {
      return null;
    }
  }
}

export function createPlatform(): Platform {
  return import.meta.env.VITE_PLATFORM === 'crazygames' ? new CrazyGamesPlatform() : new WebPlatform();
}
