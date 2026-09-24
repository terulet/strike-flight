/**
 * HOLESHOT — Gira Mundial del Barro.
 *
 * Bucle principal: fisica a paso fijo de 120 Hz, dibujo interpolado, y una
 * pequeña maquina de estados de pantallas (titulo con demo, seleccion de
 * prueba, briefing, carrera, pausa, resultados).
 *
 * Enlaces: #diario abre el Barro del Dia; #reto-<fantasma> abre la pista del
 * reto con el fantasma de quien lo envio. Parametros de URL (pruebas y
 * capturas): ?mission=N, ?daily=1, ?autoplay=1.
 */
import './style.css';
import { Sfx } from './audio/sfx';
import { Autopilot, predictLanding } from './game/autopilot';
import { dayKey, getDailyMission, isDayKey } from './game/daily';
import { GhostData, GhostPlayer, GhostRecorder, decodeGhost, encodeGhost } from './game/ghost';
import { MISSION_COUNT, Mission, getMission, medalFor } from './game/missions';
import { RiderProfile, SPECIAL_LIVERIES, isLiveryUnlocked, loadGhostToken, loadProgress, recordDaily, recordResult, sanitizeRider, saveGhostToken, saveProgress } from './game/progress';
import { AdHooks, createPlatform } from './platform/platform';
import { Race, TrickEvent } from './game/race';
import { BikeInput, cloneBike, isAirborne, stepBike } from './physics/bike';
import { drawGaragePreview } from './render/preview';
import { Scene } from './render/scene';
import { toScreen } from './render/view';
import { capturePhoto, renderCover } from './ui/cover';
import { Hud } from './ui/hud';
import { Action, Input } from './ui/input';
import { briefingHTML, garageHTML, pauseHTML, resultsHTML, selectHTML, titleHTML, fmtDate, fmtInt, fmtTime, missionName } from './ui/screens';
import { applyStatic, fmtDecimal, lang, ordinal, setLang, t as tr } from './i18n';
import { REPLAY_RATE, ReplayFrame, clipSupported, makeClip } from './ui/clip';
import { challengeLink, shareText } from './ui/share';

type Mode = 'title' | 'select' | 'garage' | 'briefing' | 'race' | 'paused' | 'results';
/** Una prueba de la gira (1..5) o el Barro del Dia de una fecha. */
type Ref = number | { daily: string };

const refKey = (r: Ref): string => (typeof r === 'number' ? `m:${r}` : `d:${r.daily}`);
const missionOf = (r: Ref): Mission => (typeof r === 'number' ? getMission(r) : getDailyMission(r.daily));

interface DownloadsNs {
  save(req: { filename: string; data: Blob | string }): Promise<unknown>;
}

const STEP = 1 / 120;
const params = new URLSearchParams(location.search);

class Game {
  private readonly canvas = document.getElementById('game') as HTMLCanvasElement;
  private readonly ctx = this.canvas.getContext('2d', { alpha: false }) as CanvasRenderingContext2D;
  private readonly screen = document.getElementById('screen') as HTMLElement;
  private readonly input = new Input(window);
  private readonly sfx = new Sfx();
  private readonly hud = new Hud();
  private readonly progress = loadProgress();
  private readonly autoplay = params.get('autoplay') === '1';
  private readonly platform = createPlatform();
  private readonly adHooks: AdHooks = {
    onStart: () => this.sfx.setMuted(true),
    onEnd: () => this.sfx.setMuted(this.progress.muted),
  };
  private racesDone = 0;
  private mode: Mode = 'title';
  private race!: Race;
  private scene!: Scene;
  private pilot: Autopilot | null = null;
  private demoMission = 1;
  /** 0 = Barro del Dia, 1..5 = pruebas de la gira. */
  private selected = 0;
  private current: Ref = 1;
  private readonly today = dayKey();
  /** Fantasma recibido por enlace de reto. */
  private challenge: GhostData | null = null;
  private recorder: GhostRecorder | null = null;
  private lastShare = '';
  private lastCover: string | null = null;
  private downloads: DownloadsNs | null = null;
  private garageDraft: RiderProfile | null = null;
  /** Repeticion de la vuelta (para el clip vertical). */
  private replay: ReplayFrame[] = [];
  private nextReplay = 0;
  private apexTime: number | null = null;
  private clip: { blob: Blob; ext: string } | null = null;
  private clipBusy = false;
  private garageTime = 0;
  private acc = 0;
  private last = 0;
  private endTimer = 0;
  private W = 0;
  private H = 0;
  private dpr = 1;
  private touch = false;
  /** Camara lenta del gran salto. */
  private slow = { pending: false, active: false, t: 0, count: 0, scale: 1 };
  private bestPredicted = 0;
  private captureArmed = false;
  private photo: HTMLCanvasElement | null = null;

  constructor() {
    this.sfx.muted = this.progress.muted;
    this.localizeDefaultName();
    applyStatic();
    this.touch = matchMedia('(pointer: coarse)').matches;
    document.body.classList.toggle('touch', this.touch);
    window.addEventListener('resize', () => this.resize());
    this.resize();
    document.querySelectorAll<HTMLElement>('[data-touch]').forEach((el) => this.input.bindTouch(el, el.dataset.touch as 'gas'));
    this.input.onAction((a) => this.onAction(a));
    const tear = document.getElementById('tTear');
    if (tear) this.input.bindTap(tear, 'tearoff');
    const unlock = (): void => this.sfx.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    document.getElementById('hPause')?.addEventListener('click', () => this.pause());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.mode === 'race') this.pause();
    });

    const w = window as unknown as { claude?: { use?: (n: string) => Promise<unknown> } };
    w.claude?.use?.('downloads').then((ns) => (this.downloads = (ns as DownloadsNs | null) ?? null)).catch(() => undefined);

    // Arranca cuando la plataforma y las fuentes estan listas (con tope de espera).
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    const fontsReady = fonts
      ? Promise.all(['400 40px "Russo One"', '800 20px "Barlow Condensed"', 'italic 900 20px "Barlow Condensed"'].map((f) => fonts.load(f))).catch(() => undefined)
      : Promise.resolve();
    const cap = new Promise((r) => setTimeout(r, 3000));
    void Promise.race([Promise.all([this.platform.init(), fontsReady]), cap]).finally(() => this.boot());
  }

  private boot(): void {
    // ?poster=1: carrera del piloto automatico con el logo encima (capturas para tiendas).
    if (params.get('poster') === '1') {
      document.body.classList.add('poster');
      const el = document.createElement('div');
      el.className = 'poster-logo';
      el.innerHTML = `<div class="logo"><span class="hole">HOLE</span><span class="shot">SHOT</span></div><div class="poster-tag">${tr('UNA PISTA NUEVA CADA DÍA · ¿ME GANAS?')}</div>`;
      document.getElementById('ui')?.appendChild(el);
    }
    const route = this.routeFromLink();
    const direct = Number(params.get('mission'));
    if (route) {
      if (this.autoplay) this.startRace(route);
      else this.openBriefing(route);
    } else if (params.get('daily') === '1') {
      if (this.autoplay) this.startRace({ daily: this.today });
      else this.openBriefing({ daily: this.today });
    } else if (direct >= 1 && direct <= MISSION_COUNT) {
      this.selected = direct;
      if (this.autoplay) this.startRace(direct);
      else this.openBriefing(direct);
    } else this.openTitle();
    requestAnimationFrame((t) => this.frame(t));
  }

  /** #diario o #reto-<fantasma> (en CrazyGames, su parametro de invitacion "reto"). */
  private routeFromLink(): Ref | null {
    let hash = '';
    try {
      hash = decodeURIComponent(location.hash.slice(1));
    } catch {
      return null;
    }
    const invite = this.platform.inviteParam('reto');
    if (invite) hash = `reto-${invite}`;
    if (hash === 'diario') return { daily: this.today };
    if (!hash.startsWith('reto-')) return null;
    const g = decodeGhost(hash.slice(5));
    if (!g) return null;
    let ref: Ref | null = null;
    if (g.track.startsWith('d:') && isDayKey(g.track.slice(2))) ref = { daily: g.track.slice(2) };
    else {
      const n = Number(g.track.slice(2));
      if (n >= 1 && n <= MISSION_COUNT) ref = n;
    }
    if (ref !== null) this.challenge = g;
    return ref;
  }

  private resize(): void {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.W = window.innerWidth;
    this.H = window.innerHeight;
    this.canvas.width = Math.round(this.W * this.dpr);
    this.canvas.height = Math.round(this.H * this.dpr);
  }

  // ---------------------------------------------------------------- carreras
  private makeRace(ref: Ref, withEvents: boolean): void {
    const m = missionOf(ref);
    const race = new Race(
      m,
      withEvents
        ? {
            onLand: (e) => this.onLand(e),
            onCrash: () => this.onCrash(),
            onRespawn: () => this.scene.onRespawn(),
            onCheckpoint: () => {
              this.hud.popup('', tr('CHECKPOINT'));
              this.sfx.checkpoint();
            },
            onPickup: (k) => {
              this.sfx.pickup(k);
              if (k === 'plate') this.hud.popup('', tr('PLACA {a}/{b}', { a: this.race.platesCollected, b: this.race.track.pickups.filter((p) => p.kind === 'plate').length }));
              else this.hud.popup('', tr('NITRO +'));
            },
            onFinish: () => {
              const r = this.race;
              this.hud.popup(r.rivals.length ? ordinal(r.position) : tr('¡META!'), r.rivals.length ? (r.position === 1 ? tr('¡GANAS LA CARRERA!') : tr('EN META')) : '');
              this.endTimer = 1.6;
            },
            onTakeoff: () => this.onTakeoff(),
            onStart: (k) => {
              if (k === 'perfect') this.hud.popup('', tr('¡SALIDA PERFECTA!'), 'perfect');
              else if (k === 'spin') this.hud.popup('', tr('DEMASIADO GAS: PATINA'), 'rough');
              else if (k === 'late') this.hud.popup('', tr('SALIDA LENTA'), 'rough');
            },
            onHoleshot: (rv) => {
              if (!rv) {
                this.hud.popup(tr('¡HOLESHOT!'), `+${fmtInt(500)} · NITRO`, 'perfect');
                this.sfx.holeshot();
                this.platform.happytime();
              } else this.hud.popup('', tr('HOLESHOT PARA #{n} {name}', { n: rv.spec.number, name: rv.spec.name }), 'rough');
            },
            onRivalCrash: (rv) => {
              this.scene.onRivalCrash(rv);
              if (Math.abs(rv.bike.x - this.race.bike.x) < 30) this.hud.popup('', tr('¡SE CAE #{n} {name}!', { n: rv.spec.number, name: rv.spec.name }));
            },
            onRivalRespawn: (rv) => this.scene.onRivalRespawn(rv),
            onRivalOut: (rv) => {
              this.scene.onRivalCrash(rv);
              this.hud.popup('', tr('LA TORMENTA SE TRAGA A #{n}', { n: rv.spec.number }), 'bad');
            },
            onFail: (reason) => {
              this.hud.popup(tr('¡FUERA!'), tr(reason).toUpperCase(), 'bad');
              this.sfx.fail();
              this.endTimer = 1.8;
            },
          }
        : {
            onLand: (e) => this.scene.onLand(e),
            onCrash: () => this.scene.onCrash(),
            onRespawn: () => this.scene.onRespawn(),
            onRivalCrash: (rv) => this.scene.onRivalCrash(rv),
            onRivalRespawn: (rv) => this.scene.onRivalRespawn(rv),
            onRivalOut: (rv) => this.scene.onRivalCrash(rv),
          },
    );
    this.race = race;
    this.scene = new Scene(race, withEvents ? this.progress.rider : undefined);
    this.scene.autoTearOff = !withEvents || this.autoplay;
    if (withEvents && !m.rivals.length) this.scene.setGhosts(this.ghostsFor(ref));
    this.recorder = withEvents ? new GhostRecorder() : null;
    this.replay = [];
    this.nextReplay = 0;
    this.apexTime = null;
    this.clip = null;
    this.slow = { pending: false, active: false, t: 0, count: 0, scale: 1 };
    this.bestPredicted = 0;
    this.captureArmed = false;
    this.photo = null;
    this.setCinema(false);
    const z = Number(params.get('zoom'));
    if (z > 0) this.scene.camera.fixedZoom = z;
    this.acc = 0;
  }

  /** Fantasmas de esta pista: el del reto recibido y tu mejor vuelta. */
  private ghostsFor(ref: Ref): Array<{ player: GhostPlayer; label: string }> {
    const key = refKey(ref);
    const list: Array<{ player: GhostPlayer; label: string }> = [];
    if (this.challenge && this.challenge.track === key) list.push({ player: new GhostPlayer(this.challenge), label: `${tr('RETO')} · ${this.challenge.name} ${fmtTime(this.challenge.time)}` });
    const own = loadGhostToken(key);
    const g = own ? decodeGhost(own) : null;
    if (g && g.track === key) list.push({ player: new GhostPlayer(g), label: tr('TU MEJOR {t}', { t: fmtTime(g.time) }) });
    return list;
  }

  private onLand(e: TrickEvent): void {
    this.scene.onLand(e);
    this.sfx.land(0.3 + e.airTime * 0.5 + (e.quality === 'ROUGH' ? 0.4 : 0));
    if (e.flips > 0) {
      const trick = e.direction === 'back' ? 'BACKFLIP' : 'FRONTFLIP';
      const name = e.flips > 1 ? tr('DOBLE {trick}', { trick }) : trick;
      this.hud.popup(name, `+${fmtInt(e.points)} ${e.quality === 'PERFECT' ? `· ${tr('PERFECTO')}` : e.quality === 'ROUGH' ? `· ${tr('CRUZADO')}` : ''}${e.combo > 1 ? ` · COMBO x${Math.min(5, e.combo + 1)}` : ''}`, e.quality === 'PERFECT' ? 'perfect' : '');
      this.sfx.trick(e.flips);
    } else if (e.quality === 'PERFECT' && e.airTime > 0.9) {
      this.hud.popup('', `${tr('PERFECTO')} +${fmtInt(e.points)} · PUMP`, 'perfect');
      this.sfx.cheer(0.3);
    } else if (e.quality === 'ROUGH' && e.airTime > 0.45) {
      this.hud.popup('', tr('RECEPCIÓN CRUZADA'), 'rough');
    }
  }

  /** Al despegar se decide si este salto merece camara lenta y portada. */
  private onTakeoff(): void {
    const fall = predictLanding(this.race);
    const air = fall.time;
    if (air > this.bestPredicted && air > 0.7) {
      this.bestPredicted = air;
      this.captureArmed = true;
    }
    if (air > 2 && this.slow.count < 3 && !this.slow.active && air >= this.bestPredicted * 0.95) this.slow.pending = true;
  }

  private setCinema(on: boolean): void {
    document.getElementById('cine')?.classList.toggle('on', on);
    document.body.classList.toggle('cine', on);
  }

  /** Gestiona la camara lenta en tiempo real y devuelve la escala de tiempo. */
  private updateSlow(dt: number): number {
    const s = this.slow;
    const r = this.race;
    if (s.pending && r.state === 'racing' && r.airborne && r.bike.vy <= 0.6) {
      s.pending = false;
      s.active = true;
      s.t = 0;
      s.count += 1;
      this.setCinema(true);
      this.sfx.slowmo();
    }
    if (s.pending && (r.state !== 'racing' || !r.airborne)) s.pending = false;
    let target = 1;
    if (s.active) {
      s.t += dt;
      const ending = s.t > 1.15 || !r.airborne || r.state !== 'racing';
      target = ending ? 1 : 0.28;
      if (ending && s.scale > 0.95) {
        s.active = false;
        this.setCinema(false);
      }
    }
    s.scale += (target - s.scale) * (1 - Math.exp(-dt * (target < s.scale ? 14 : 6)));
    this.scene.cinema = 1 - Math.min(1, (s.scale - 0.28) / 0.72);
    return s.scale;
  }

  private onCrash(): void {
    this.scene.onCrash();
    this.sfx.crash();
    this.hud.popup(tr('¡CAÍDA!'), tr('VUELVES AL CHECKPOINT'), 'bad');
  }

  // --------------------------------------------------------------- pantallas
  private setScreen(html: string): void {
    this.screen.innerHTML = html;
    this.screen.querySelectorAll<HTMLElement>('[data-act]').forEach((el) =>
      el.addEventListener('click', () => {
        this.sfx.unlock();
        this.sfx.click();
        this.onButton(el.dataset.act as string, el);
      }),
    );
  }

  private startDemo(): void {
    this.makeRace(this.demoMission, false);
    this.pilot = new Autopilot({ tricks: true });
    this.race.countdown = 0.5;
  }

  private openTitle(): void {
    this.platform.gameplayStop();
    this.mode = 'title';
    this.hud.show(false);
    this.showTouch(false);
    this.sfx.stopEngine();
    document.documentElement.style.setProperty('--accent', '#ff6a3d');
    if (!this.race || !this.pilot || this.race.mission.id !== this.demoMission) this.startDemo();
    this.setScreen(titleHTML(this.touch, this.today));
  }

  private openSelect(): void {
    this.platform.gameplayStop();
    this.mode = 'select';
    this.hud.show(false);
    this.showTouch(false);
    this.sfx.stopEngine();
    document.documentElement.style.setProperty('--accent', '#ff6a3d');
    if (!this.pilot) this.startDemo();
    this.setScreen(selectHTML(this.progress, this.selected, this.today));
    this.screen.querySelector('.card.sel')?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }

  private openGarage(): void {
    this.platform.gameplayStop();
    this.mode = 'garage';
    this.hud.show(false);
    this.showTouch(false);
    if (!this.pilot) this.startDemo();
    this.garageDraft = { ...this.progress.rider };
    this.setScreen(garageHTML(this.garageDraft, (id) => isLiveryUnlocked(this.progress, id), this.platform.hasRewarded));
    const num = document.getElementById('gNumber') as HTMLInputElement | null;
    const name = document.getElementById('gName') as HTMLInputElement | null;
    if (name) name.value = this.garageDraft.name;
    const sync = (): void => {
      if (!this.garageDraft) return;
      this.garageDraft = sanitizeRider({ ...this.garageDraft, number: num?.value ?? '', name: name?.value ?? '' });
    };
    num?.addEventListener('input', () => {
      num.value = num.value.replace(/\D/g, '').slice(0, 2);
      sync();
    });
    name?.addEventListener('input', sync);
  }

  private openBriefing(ref: Ref): void {
    this.platform.gameplayStop();
    this.mode = 'briefing';
    this.current = ref;
    this.selected = typeof ref === 'number' ? ref : 0;
    this.pilot = null;
    this.makeRace(ref, true);
    this.hud.show(false);
    this.showTouch(false);
    this.hud.setup(this.race);
    const key = refKey(ref);
    const own = loadGhostToken(key);
    const ownG = own ? decodeGhost(own) : null;
    const ch = this.challenge && this.challenge.track === key ? this.challenge : null;
    this.setScreen(
      briefingHTML(this.race.mission, this.touch, {
        challenge: ch ? { name: ch.name, number: ch.number, time: ch.time } : null,
        ownBest: ownG && ownG.track === key ? ownG.time : null,
      }),
    );
    const nameEl = this.screen.querySelector('.challenge-name');
    if (nameEl && ch) nameEl.textContent = `#${ch.number} ${ch.name}`;
  }

  private startRace(ref: Ref): void {
    this.current = ref;
    this.makeRace(ref, true);
    this.pilot = this.autoplay ? new Autopilot({ tricks: ref === 3 }) : null;
    this.mode = 'race';
    this.endTimer = 0;
    this.input.reset();
    this.hud.setup(this.race);
    this.hud.clearPopups();
    this.hud.show(true);
    this.showTouch(this.touch || this.input.touchUsed);
    this.setScreen('');
    this.platform.gameplayStart();
  }

  private pause(): void {
    if (this.mode !== 'race') return;
    this.platform.gameplayStop();
    this.mode = 'paused';
    this.sfx.stopEngine();
    this.setScreen(pauseHTML(this.sfx.muted));
  }

  private resume(): void {
    this.platform.gameplayStart();
    this.mode = 'race';
    this.input.reset();
    this.last = performance.now();
    this.setScreen('');
  }

  private showTouch(on: boolean): void {
    document.getElementById('touch')?.classList.toggle('hidden', !on);
  }

  private finish(): void {
    const r = this.race;
    const m = r.mission;
    const finished = r.state === 'finished';
    const plateTotal = r.track.pickups.filter((p) => p.kind === 'plate').length;
    const position = r.rivals.length ? r.position : undefined;
    const medal = medalFor(m, { finished, time: r.time, trickScore: r.trickScore, plates: r.platesCollected, crashes: r.crashes, position });
    this.setCinema(false);
    let cover: string | null = null;
    if (finished) {
      if (!this.photo) {
        const p = toScreen(this.scene.camera.view(this.W, this.H, this.dpr), r.bike.x, r.bike.y + 0.3);
        this.photo = capturePhoto(this.canvas, p.x, p.y, this.dpr);
      }
      try {
        cover = renderCover(this.photo, {
          missionId: m.daily ? 200 + m.daily.number : m.id,
          missionName: missionName(m),
          riderNumber: this.progress.rider.number,
          riderName: this.progress.rider.name,
          place: m.daily ? fmtDate(m.daily.key) : tr(m.place),
          accent: m.theme.accent,
          airTime: r.maxAirTime,
          flips: r.flips,
          medal,
          position: position ?? null,
          riders: r.riders,
          time: fmtTime(r.time),
          crashes: r.crashes,
          mud: this.scene.mudLevel,
          holeshot: r.holeshot === 'player',
          perfectStart: r.startKind === 'perfect',
        }).toDataURL('image/jpeg', 0.88);
      } catch {
        cover = null;
      }
    }
    const key = refKey(this.current);
    const rider = this.progress.rider;
    const prevBest = m.daily ? (this.progress.daily[m.daily.key]?.time ?? null) : (this.progress.best[m.id]?.time ?? null);
    let record = false;
    let token: string | null = null;
    let versus: { name: string; won: boolean; diff: string } | null = null;
    if (finished && this.recorder) {
      this.recorder.record(r.time + 0.2, r.bike.x, r.bike.y, r.bike.angle);
      token = encodeGhost({ track: key, time: r.time, colors: rider.colors, number: rider.number, name: rider.name, samples: this.recorder.samples });
      if (this.challenge && this.challenge.track === key) {
        const d = r.time - this.challenge.time;
        versus = { name: `#${this.challenge.number} ${this.challenge.name}`, won: d < 0, diff: `${fmtDecimal(Math.abs(d), 2)} s` };
      }
    }
    if (finished && !this.autoplay) {
      const improved = prevBest === null || r.time < prevBest;
      if (m.daily) recordDaily(this.progress, m.daily.key, r.time, medal);
      else recordResult(this.progress, m.id, { medal, time: r.time, score: r.score, plates: r.platesCollected, trickScore: r.trickScore });
      record = improved && prevBest !== null;
      if (improved && token) saveGhostToken(key, token);
      saveProgress(this.progress);
    }
    const bestTime = m.daily ? (this.progress.daily[m.daily.key]?.time ?? null) : (this.progress.best[m.id]?.time ?? null);
    let share: { text: string; canNative: boolean; canSaveCover: boolean; canClip: boolean } | null = null;
    if (finished) {
      this.lastShare = shareText({
        title: missionName(m),
        time: fmtTime(r.time),
        medal,
        crashes: r.crashes,
        flips: r.flips,
        maxAir: r.maxAirTime,
        marks: r.sectionMarks.filter((_, i) => r.track.sections[i].name !== 'SALIDA' && r.track.sections[i].name !== 'META'),
        versus,
        link: token ? (this.platform.inviteLink({ reto: token }) ?? challengeLink(token)) : null,
      });
      let topLevel = true;
      try {
        topLevel = window.top === window;
      } catch {
        topLevel = false;
      }
      share = {
        text: this.lastShare,
        canNative: topLevel && typeof navigator.share === 'function',
        canSaveCover: topLevel || !!this.downloads,
        canClip: clipSupported() && this.replay.length > REPLAY_RATE * 3,
      };
    }
    this.lastCover = cover;
    this.platform.gameplayStop();
    this.racesDone += 1;
    if (finished && (record || medal === 3 || (position === 1 && m.objective === 'final') || versus?.won)) this.platform.happytime();
    this.mode = 'results';
    this.hud.show(false);
    this.showTouch(false);
    this.sfx.stopEngine();
    if (finished) this.sfx.fanfare(medal);
    this.setScreen(
      resultsHTML({
        mission: m,
        finished,
        failReason: r.failReason,
        medal,
        time: r.time,
        bestTime,
        record,
        score: r.score,
        trickScore: r.trickScore,
        plates: r.platesCollected,
        totalPlates: plateTotal,
        crashes: r.crashes,
        flips: r.flips,
        maxAir: r.maxAirTime,
        bestCombo: r.bestCombo,
        position: position ?? null,
        riders: r.riders,
        cover,
        share,
        versus,
        hasNext: !m.daily && m.id < MISSION_COUNT,
        nextUnlocked: m.id + 1 <= this.progress.unlocked || this.autoplay,
      }),
    );
    const pre = document.getElementById('shareText');
    // En pantalla el enlace se ve recortado; al copiar va entero.
    if (pre) pre.textContent = this.lastShare.replace(/(#reto-.{10})\S+/, '$1…');
    const vs = this.screen.querySelector('.versus-name');
    if (vs && versus) vs.textContent = versus.name;
  }

  private note(text: string): void {
    const el = document.getElementById('shareNote');
    if (el) el.textContent = text;
  }

  /** Copia el resumen con el enlace de reto (dentro del gesto del clic). */
  private copyShare(): void {
    const text = this.lastShare;
    const fallback = (): void => {
      const pre = document.getElementById('shareText');
      if (pre) {
        pre.textContent = text;
        const range = document.createRange();
        range.selectNodeContents(pre);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
      this.note(tr('Selecciónalo y cópialo (Cmd/Ctrl + C).'));
    };
    try {
      navigator.clipboard.writeText(text).then(() => this.note(tr('¡Copiado! Pégalo en el chat: quien abra el enlace correrá contra tu fantasma.')), fallback);
    } catch {
      fallback();
    }
  }

  private clipName(): string {
    return `holeshot-${refKey(this.current).replace(':', '-')}.${this.clip?.ext ?? 'webm'}`;
  }

  private async buildClip(btn: HTMLElement): Promise<void> {
    if (this.clipBusy) return;
    this.clipBusy = true;
    btn.setAttribute('disabled', '');
    const m = this.race.mission;
    try {
      this.clip = await makeClip({
        mission: m,
        frames: this.replay,
        apex: this.apexTime,
        rider: this.progress.rider,
        title: missionName(m),
        time: fmtTime(this.race.time),
        onProgress: (p) => this.note(tr('Montando tu clip vertical… {n} %', { n: Math.round(p * 100) })),
      });
      this.note(tr('Clip listo ({n} MB). Súbelo con el texto de arriba como descripción.', { n: fmtDecimal(this.clip.blob.size / 1e6) }));
      btn.removeAttribute('disabled');
      btn.dataset.act = 'save-clip';
      btn.textContent = tr('GUARDAR CLIP');
      const file = new File([this.clip.blob], this.clipName(), { type: this.clip.blob.type });
      let topLevel = true;
      try {
        topLevel = window.top === window;
      } catch {
        topLevel = false;
      }
      if (topLevel && navigator.canShare?.({ files: [file] })) {
        const share = document.createElement('button');
        share.className = 'ghost-btn';
        share.textContent = tr('COMPARTIR CLIP');
        share.addEventListener('click', () => this.shareClip());
        btn.after(share);
      }
    } catch {
      this.note(tr('Este navegador no puede grabar el clip.'));
      btn.removeAttribute('disabled');
    } finally {
      this.clipBusy = false;
    }
  }

  private shareClip(): void {
    if (!this.clip) return;
    const file = new File([this.clip.blob], this.clipName(), { type: this.clip.blob.type });
    navigator.share?.({ files: [file], text: this.lastShare }).catch(() => undefined);
  }

  private async saveClip(): Promise<void> {
    if (!this.clip) return;
    const filename = this.clipName();
    if (this.downloads) {
      try {
        await this.downloads.save({ filename, data: this.clip.blob });
        this.note(tr('Clip guardado.'));
      } catch {
        this.note(tr('No se ha guardado el clip.'));
      }
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(this.clip.blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  private async saveCover(): Promise<void> {
    if (!this.lastCover) return;
    const blob = await (await fetch(this.lastCover)).blob();
    const filename = `holeshot-${tr('portada')}-${refKey(this.current).replace(':', '-')}.jpg`;
    if (this.downloads) {
      try {
        await this.downloads.save({ filename, data: blob });
        this.note(tr('Portada guardada.'));
      } catch {
        this.note(tr('No se ha guardado la portada.'));
      }
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  /** El nombre por defecto sigue al idioma mientras nadie lo haya cambiado. */
  private localizeDefaultName(): void {
    const r = this.progress.rider;
    if (r.name === 'PILOTO' || r.name === 'RIDER') r.name = lang() === 'en' ? 'RIDER' : 'PILOTO';
  }

  private switchLang(): void {
    setLang(lang() === 'es' ? 'en' : 'es');
    this.localizeDefaultName();
    applyStatic();
    if (this.mode === 'title') this.setScreen(titleHTML(this.touch, this.today));
    else if (this.mode === 'paused') {
      this.hud.relabel(this.race);
      this.setScreen(pauseHTML(this.sfx.muted));
    }
  }

  private onButton(act: string, el: HTMLElement): void {
    switch (act) {
      case 'start':
        this.openSelect();
        break;
      case 'daily':
        this.openBriefing({ daily: this.today });
        break;
      case 'garage':
        this.openGarage();
        break;
      case 'color': {
        const id = el.dataset.color;
        if (!this.garageDraft || !id) break;
        const info = document.getElementById('garageUnlock');
        const ad = document.getElementById('garageAd');
        if (!isLiveryUnlocked(this.progress, id)) {
          const l = SPECIAL_LIVERIES.find((x) => x.id === id);
          this.pendingLivery = id;
          if (info) info.textContent = `${tr(l?.name ?? '')}: ${tr(l?.how ?? '')}.`;
          ad?.classList.remove('hidden');
          break;
        }
        ad?.classList.add('hidden');
        if (info) info.textContent = '';
        this.garageDraft = sanitizeRider({ ...this.garageDraft, colors: id });
        this.screen.querySelectorAll('.swatch').forEach((sw) => sw.classList.toggle('sel', sw === el));
        break;
      }
      case 'unlock-ad':
        void this.unlockWithAd();
        break;
      case 'garage-save':
        if (this.garageDraft) {
          this.progress.rider = sanitizeRider(this.garageDraft);
          saveProgress(this.progress);
        }
        this.openTitle();
        break;
      case 'title':
        this.challenge = null;
        this.openTitle();
        break;
      case 'pick': {
        const id = Number(el.dataset.id);
        if (id === 0) this.openBriefing({ daily: this.today });
        else if (id <= this.progress.unlocked) this.openBriefing(id);
        else this.hud.popup('', tr('CONSIGUE UNA MEDALLA EN LA ANTERIOR'), 'rough');
        break;
      }
      case 'go':
        this.startRace(this.current);
        break;
      case 'select':
        this.pilot = null;
        this.afterBreak(() => this.openSelect());
        break;
      case 'resume':
        this.resume();
        break;
      case 'restart':
        this.afterBreak(() => this.startRace(this.current));
        break;
      case 'next':
        this.afterBreak(() => this.openBriefing(Math.min(MISSION_COUNT, this.race.mission.id + 1)));
        break;
      case 'lang':
        this.switchLang();
        break;
      case 'mute':
        this.toggleMute();
        if (this.mode === 'paused') this.setScreen(pauseHTML(this.sfx.muted));
        break;
      case 'copy':
        this.copyShare();
        break;
      case 'native-share':
        navigator.share?.({ text: this.lastShare }).catch(() => undefined);
        break;
      case 'save-cover':
        void this.saveCover();
        break;
      case 'clip':
        void this.buildClip(el);
        break;
      case 'save-clip':
        void this.saveClip();
        break;
      case 'share-clip':
        this.shareClip();
        break;
    }
  }

  /** Al salir de la pantalla de resultados: pausa natural, puede haber anuncio. */
  private afterBreak(next: () => void): void {
    if (this.mode !== 'results' || this.racesDone < 1) return next();
    void this.platform.midgameAd(this.adHooks).finally(next);
  }

  private pendingLivery: string | null = null;

  private async unlockWithAd(): Promise<void> {
    const id = this.pendingLivery;
    if (!id) return;
    const ok = await this.platform.rewardedAd(this.adHooks);
    if (!ok) {
      const info = document.getElementById('garageUnlock');
      if (info) info.textContent = tr('No se ha podido ver el anuncio. Inténtalo más tarde.');
      return;
    }
    if (!this.progress.liveries.includes(id)) this.progress.liveries.push(id);
    const draft = this.garageDraft ? { ...this.garageDraft, colors: id } : null;
    saveProgress(this.progress);
    this.openGarage();
    if (draft) {
      this.garageDraft = sanitizeRider(draft);
      this.screen.querySelectorAll<HTMLElement>('.swatch').forEach((sw) => sw.classList.toggle('sel', sw.dataset.color === id));
    }
  }

  private toggleMute(): void {
    this.sfx.setMuted(!this.sfx.muted);
    this.progress.muted = this.sfx.muted;
    saveProgress(this.progress);
  }

  private onAction(a: Action): void {
    this.sfx.unlock();
    if (a === 'mute') return this.toggleMute();
    switch (this.mode) {
      case 'title':
        if (a === 'confirm') this.openSelect();
        break;
      case 'select': {
        if (a === 'left' || a === 'right' || a === 'up' || a === 'down') {
          const d = a === 'left' || a === 'up' ? -1 : 1;
          this.selected = Math.max(0, Math.min(MISSION_COUNT, this.selected + d));
          this.sfx.click();
          this.setScreen(selectHTML(this.progress, this.selected, this.today));
          this.screen.querySelector('.card.sel')?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
        } else if (a === 'confirm') {
          if (this.selected === 0) this.openBriefing({ daily: this.today });
          else if (this.selected <= this.progress.unlocked) this.openBriefing(this.selected);
        } else if (a === 'back') this.openTitle();
        break;
      }
      case 'garage':
        if (a === 'back') this.openTitle();
        else if (a === 'confirm') this.onButton('garage-save', this.screen);
        break;
      case 'briefing':
        if (a === 'confirm') this.startRace(this.current);
        else if (a === 'back') this.openSelect();
        break;
      case 'race':
        if (a === 'tearoff') {
          if (this.scene.lens.tearOff()) this.sfx.tearOff();
        } else if (a === 'back' || a === 'pause') this.pause();
        else if (a === 'restart') this.startRace(this.current);
        break;
      case 'paused':
        if (a === 'back' || a === 'pause' || a === 'confirm') this.resume();
        else if (a === 'restart') this.startRace(this.current);
        break;
      case 'results':
        if (a === 'confirm') {
          const m = this.race.mission;
          if (!m.daily && this.race.state === 'finished' && m.id < MISSION_COUNT && m.id + 1 <= this.progress.unlocked) this.afterBreak(() => this.openBriefing(m.id + 1));
          else this.afterBreak(() => this.startRace(this.current));
        } else if (a === 'restart') this.afterBreak(() => this.startRace(this.current));
        else if (a === 'back') this.afterBreak(() => this.openSelect());
        break;
    }
  }

  // ------------------------------------------------------------------- bucle
  private frame(now: number): void {
    const dt = Math.min(0.1, this.last ? (now - this.last) / 1000 : 1 / 60);
    this.last = now;
    const running = this.mode === 'race' || this.mode === 'title' || this.mode === 'select' || this.mode === 'garage' || this.mode === 'results';
    const scale = this.mode === 'race' ? this.updateSlow(dt) : 1;
    const sdt = dt * scale;
    if (running) {
      this.acc += sdt;
      while (this.acc >= STEP) {
        this.tick();
        this.acc -= STEP;
      }
    }
    const alpha = running ? this.acc / STEP : 1;
    if (this.mode !== 'paused') this.scene.update(sdt);
    const view = this.scene.draw(this.ctx, this.W, this.H, this.dpr, alpha, this.mode === 'paused' ? 0 : sdt);

    if (this.mode === 'race') {
      const r = this.race;
      // Foto para la portada: en el punto mas alto del mejor salto.
      if (this.captureArmed && r.airborne && r.bike.vy <= 0.3 && r.state === 'racing') {
        this.captureArmed = false;
        const p = toScreen(view, r.bike.x, r.bike.y + 0.3);
        this.photo = capturePhoto(this.canvas, p.x, p.y, this.dpr);
        this.apexTime = r.time;
      }
      const beep = this.hud.update(r, dt, this.scene.lens, this.scene.ghostDelta());
      if (beep !== null) this.sfx.beep(beep === 0);
      const b = r.bike;
      this.sfx.engine(r.state === 'racing' || r.state === 'countdown', r.state === 'countdown' ? b.throttle * 22 : b.rear.spinRate * 0.34, b.throttle, isAirborne(b), Math.hypot(b.vx, b.vy), b.nitro, 0.55 + scale * 0.45);
      if (this.endTimer > 0) {
        this.endTimer -= dt;
        if (this.endTimer <= 0) this.finish();
      }
    }
    if (this.mode === 'garage' && this.garageDraft) {
      this.garageTime += dt;
      const c = document.getElementById('garagePreview') as HTMLCanvasElement | null;
      if (c) drawGaragePreview(c, this.garageDraft, this.garageTime);
    }
    requestAnimationFrame((t) => this.frame(t));
  }

  private tick(): void {
    const r = this.race;
    if (this.mode === 'race') {
      if (r.state === 'finished' || r.state === 'failed') return this.coast();
      const inp: BikeInput = this.pilot ? this.pilot.input(r) : this.input.read();
      r.step(STEP, inp);
      if (this.recorder && (r.state === 'racing' || r.state === 'crashed')) {
        this.recorder.record(r.time, r.bike.x, r.bike.y, r.bike.angle);
        while (r.time >= this.nextReplay) {
          this.replay.push({ t: this.nextReplay, bike: cloneBike(r.bike), stormX: r.stormX });
          this.nextReplay += 1 / REPLAY_RATE;
        }
      }
      return;
    }
    if (this.mode === 'results') return this.coast();
    // Demo del menu.
    if (r.state === 'finished' || r.state === 'failed') {
      this.demoMission = (this.demoMission % MISSION_COUNT) + 1;
      this.startDemo();
      return;
    }
    r.step(STEP, this.pilot ? this.pilot.input(r) : { throttle: 0, brake: 0, lean: 0, nitro: false });
  }

  /** Tras la meta la moto sigue rodando y frena sola. */
  private coast(): void {
    const r = this.race;
    r.stepRivals(STEP);
    if (r.state === 'failed') return;
    r.prevBike = cloneBike(r.bike);
    stepBike(r.bike, { throttle: 0, brake: 0.35, lean: 0, nitro: false }, r.track.terrain, STEP);
  }
}

new Game();
