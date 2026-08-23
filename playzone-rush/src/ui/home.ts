/**
 * Portada: RUSH DE HOY.
 *
 * Objetivo de esta pantalla: en tres segundos tienes que saber que jugar, con
 * quien compites y cuanto te falta para adelantar a alguien.
 */
import { dayLabel } from '../core/clock';
import { bestRevengeAgainst } from '../meta/social';
import { challengeStandings } from '../meta/ranking';
import { describeMutators } from '../game/mutators';
import { listGames, requireGame } from '../game/registry';
import { attemptsDisplay } from '../meta/attempts';
import { formatDuration, type ChallengeSpec } from '../meta/daily';
import { formatScore, rivalAhead, rivalBehind, type Leaderboard } from '../meta/ranking';
import { targetForChallenge } from '../meta/session';
import type { App } from './app';
import { button, el } from './dom';
import { promptText } from './modal';

export function renderHome(app: App): HTMLElement {
  const board = app.leaderboard();
  const screen = el('div', { class: 'screen' });

  screen.appendChild(renderTopbar(app));

  const scroller = el('div', { class: 'scroller' });
  const update = renderUpdateBanner(app);
  if (update) scroller.appendChild(update);
  scroller.appendChild(renderHero(app, board));
  const overtake = renderOvertake(app);
  if (overtake) scroller.appendChild(overtake);
  scroller.appendChild(renderSocial(app, board));
  const group = renderGroup(app);
  if (group) scroller.appendChild(group);

  scroller.appendChild(sectionTitle('RETOS DE HOY', `${app.plan.challenges.length} + SECRETO`));
  const cards = el('div', { class: 'cards' });
  for (const spec of app.plan.challenges) cards.appendChild(renderChallengeCard(app, spec));
  cards.appendChild(renderSecretCard(app));
  if (app.chaosEnabled) cards.appendChild(renderChaosCard(app));
  scroller.appendChild(cards);

  scroller.appendChild(sectionTitle('CLASIFICACION DE HOY', dayLabel(app.dayKey, app.clock.realDayKey())));
  scroller.appendChild(renderBoard(app, board));
  const pique = renderPique(app, board);
  if (pique) scroller.appendChild(pique);

  scroller.appendChild(sectionTitle('TUS MARCAS'));
  scroller.appendChild(renderRecords(app));

  scroller.appendChild(
    el('div', { class: 'footer-note' }, [
      el('span', { text: `PLAYZONE RUSH · ${app.dayKey}` }),
      el('span', { text: app.debugMode ? 'DEBUG ON' : '?debug PARA HERRAMIENTAS' }),
    ]),
  );

  screen.appendChild(scroller);
  return screen;
}

function sectionTitle(text: string, right?: string): HTMLElement {
  return el('div', { class: 'section-title' }, [
    el('span', { text }),
    right ? el('span', { text: right }) : null,
  ]);
}

function renderTopbar(app: App): HTMLElement {
  const muted = app.audio.muted;
  const muteBtn = button(muted ? '🔇' : '🔊', 'icon-btn', () => {
    const nowMuted = app.toggleMute();
    muteBtn.textContent = nowMuted ? '🔇' : '🔊';
    if (!nowMuted) app.audio.play('tap');
  });

  return el('div', { class: 'topbar' }, [
    el('div', { class: 'brand' }, [
      el('span', { class: 'brand__zone', text: 'PLAYZONE' }),
      el('span', { class: 'brand__rush', text: 'RUSH' }),
    ]),
    el('div', { class: 'topbar__spacer' }),
    renderNetStatus(app),
    app.clock.offset !== 0
      ? el('span', { class: 'chip chip--debug', text: `DIA ${app.clock.offset > 0 ? '+' : ''}${app.clock.offset}` })
      : null,
    muteBtn,
  ]);
}

/** Estado de conexion: discreto, pero suficiente para dar confianza. */
function renderNetStatus(app: App): HTMLElement | null {
  if (app.mode !== 'group') return null;
  const pending = app.sync.pendingCount;
  const status = app.netStatus;
  const label =
    pending > 0
      ? `${pending} PENDIENTE${pending > 1 ? 'S' : ''}`
      : status === 'online'
        ? 'ONLINE'
        : status === 'connecting'
          ? 'CONECTANDO'
          : status === 'syncing'
            ? 'SINCRONIZANDO'
            : status === 'error'
              ? 'SERVIDOR KO'
              : 'SIN CONEXION';
  const kind = pending > 0 ? 'syncing' : status;
  return el('div', { class: `net net--${kind}` }, [
    el('span', { class: 'net__dot' }),
    el('span', { text: label }),
  ]);
}

/** Panel del grupo: quien esta, quien ha jugado y el codigo para invitar. */
function renderGroup(app: App): HTMLElement | null {
  const snapshot = app.snapshot;
  if (app.mode !== 'group' || !snapshot) return null;
  const myId = app.sync.playerId;

  const copy = button('COPIAR', 'group__mini', async () => {
    try {
      await navigator.clipboard.writeText(snapshot.group.code);
      app.toaster.show('CODIGO COPIADO', 'good', 1600);
    } catch {
      app.toaster.show(snapshot.group.code, 'neutral', 2600);
    }
    app.audio.play('tap');
  });

  const share = button('COMPARTIR', 'group__mini', async () => {
    const nav = navigator as Navigator & {
      share?: (data: { title?: string; text?: string }) => Promise<void>;
    };
    if (typeof nav.share !== 'function') {
      await navigator.clipboard?.writeText?.(snapshot.group.code).catch(() => undefined);
      app.toaster.show('CODIGO COPIADO', 'good', 1600);
      return;
    }
    try {
      await nav.share({
        title: 'PLAYZONE RUSH',
        text: `Entra en mi grupo de PLAYZONE RUSH con el codigo ${snapshot.group.code}`,
      });
    } catch {
      /* cancelado */
    }
  });

  return el('div', { class: 'group' }, [
    el('div', { class: 'group__head' }, [
      el('div', {}, [
        el('div', { class: 'group__label', text: 'TU GRUPO' }),
        el('div', { class: 'group__code', text: snapshot.group.code }),
      ]),
      el('div', { class: 'group__actions' }, [copy, share]),
    ]),
    el(
      'div',
      { class: 'group__members' },
      snapshot.members.map((member) =>
        el(
          'div',
          {
            class: `member${member.online ? ' member--online' : ''}${
              member.id === myId ? ' member--me' : ''
            }${member.completedDaily ? ' member--done' : ''}`,
          },
          [el('span', { class: 'member__dot' }), el('span', { text: member.name })],
        ),
      ),
    ),
  ]);
}

/** Hay build nueva en el servidor. Nunca aparece a mitad de partida: solo se pinta aqui, en portada. */
function renderUpdateBanner(app: App): HTMLElement | null {
  if (!app.updateAvailable) return null;
  return el('div', { class: 'update-banner' }, [
    el('div', { class: 'update-banner__text' }, [
      el('span', { text: '⚡' }),
      el('span', { text: 'HAY UNA VERSION NUEVA' }),
    ]),
    button('ACTUALIZAR', 'btn btn--accent update-banner__btn', () => {
      app.audio.play('tap');
      app.haptics.fire('light');
      app.applyUpdate();
    }),
  ]);
}

/** "Marc te ha quitado el #1": el aviso que dispara la revancha. */
function renderOvertake(app: App): HTMLElement | null {
  const event = app.pendingOvertake;
  if (!event) return null;

  const target = revengeTargetFor(app, event.rivalId, event.rivalName);
  const spec = target ? app.challengeById(target.challengeId) : null;

  const actions: HTMLElement[] = [];
  if (spec && target) {
    app.offerRevenge(`overtake:${event.key}`, target.gap, event.rivalName, spec.gameId);
    actions.push(
      button('REVANCHA', 'btn btn--play btn--lg', () => {
        app.rematch(spec, { gap: target.gap, rival: event.rivalName });
      }),
    );
  }
  actions.push(
    button('VALE', 'btn btn--ghost', () => {
      app.pendingOvertake = null;
      app.renderHome();
    }),
  );

  return el('div', { class: 'overtake' }, [
    el('div', { class: 'overtake__title', text: `🔥 ${event.rivalName} TE HA QUITADO EL #1` }),
    el('div', {
      class: 'overtake__sub',
      text: target
        ? `+${formatScore(event.gap)} · Responde en ${spec?.title ?? ''} ${spec?.gameName ?? ''}: te faltan ${formatScore(
            target.gap,
          )}`
        : `+${formatScore(event.gap)} · Sin intentos para responder hoy.`,
    }),
    el('div', { class: 'overtake__row' }, actions),
  ]);
}

/** En que reto conviene contestar a ese rival. */
function revengeTargetFor(app: App, rivalId: string, rivalName: string) {
  const context = app.rankingContext;
  const cache = new Map<string, ReturnType<typeof challengeStandings>>();
  const standingsFor = (challengeId: string) => {
    const spec = app.challengeById(challengeId);
    if (!spec) return [];
    if (!cache.has(challengeId)) cache.set(challengeId, challengeStandings(app.plan, app.save, spec, context));
    return cache.get(challengeId) ?? [];
  };

  return bestRevengeAgainst(
    rivalId,
    app.plan.challenges.map((spec) => spec.id),
    (playerId, challengeId) =>
      standingsFor(challengeId).find((entry) => (entry.isMe ? 'me' : entry.id) === playerId)?.total ?? 0,
    (challengeId) => {
      const spec = app.challengeById(challengeId);
      return spec ? app.canPlay(spec) : false;
    },
    rivalName,
  );
}

function renderHero(app: App, board: Leaderboard): HTMLElement {
  return el('div', { class: 'hero' }, [
    el('h1', { class: 'hero__title', html: 'RUSH <em>DE HOY</em>' }),
    el('div', { class: 'hero__sub' }, [
      el('span', { class: 'chip chip--brand', text: dayLabel(app.dayKey, app.clock.realDayKey()) }),
      el('span', { class: 'chip chip--gold', text: `VAS #${board.myRank}` }),
      el('span', { text: `${app.plan.challenges.length} RETOS · 3 INTENTOS` }),
    ]),
  ]);
}

function renderSocial(app: App, board: Leaderboard): HTMLElement {
  const streak = app.streak;
  const leader = board.leader;
  const lines: HTMLElement[] = [];

  lines.push(
    el('div', { class: 'social__line' }, [
      el('span', { text: '👑' }),
      leader.isMe
        ? el('span', {}, [el('span', { class: 'em', text: 'VAS PRIMERO' }), el('span', { text: ' HOY. AGUANTA.' })])
        : el('span', {}, [
            el('span', { class: 'em', text: leader.name }),
            el('span', { text: ` MANDA HOY CON ${formatScore(leader.total)}.` }),
          ]),
    ]),
  );

  if (streak.holderName && streak.days > 0) {
    const mine = streak.holderId === 'me';
    lines.push(
      el('div', { class: 'social__line' }, [
        el('span', { text: '🔥' }),
        el('span', {}, [
          el('span', { class: 'em', text: mine ? 'LLEVAS' : `${streak.holderName} LLEVA` }),
          el('span', { text: ` ${streak.days} ${streak.days === 1 ? 'DIA' : 'DIAS'} GANANDO.` }),
        ]),
      ]),
    );
  }

  return el('div', { class: 'social' }, lines);
}

function mutatorChips(ids: string[]): HTMLElement | null {
  const defs = describeMutators(ids);
  if (defs.length === 0) return null;
  return el(
    'div',
    { class: 'mutators' },
    defs.map((def) =>
      el('span', { class: `mut mut--${def.tone}`, attrs: { title: def.description } }, [
        el('span', { text: def.icon }),
        el('span', { text: def.name }),
      ]),
    ),
  );
}

function renderChallengeCard(app: App, spec: ChallengeSpec): HTMLElement {
  const meta = gameMetaOf(app, spec);
  const left = app.attemptsLeft(spec);
  const progress = app.save.get().days[app.dayKey]?.challenges[spec.id];
  const best = progress?.bestScore ?? 0;
  // Con el contexto: en grupo el objetivo es una persona, no un bot.
  const target = targetForChallenge(app.plan, spec, app.save, app.rankingContext);

  const playBtn = button(left > 0 ? 'JUGAR' : 'SIN INTENTOS', 'btn btn--accent', () => app.startChallenge(spec), {
    disabled: left === 0,
  });

  const card = el(
    'div',
    {
      class: `card${left === 0 ? ' card--done' : ''}`,
      style: { '--accent': meta.accent },
    },
    [
      el('div', { class: 'card__head' }, [
        el('div', { class: 'card__icon', text: meta.icon }),
        el('div', { class: 'card__titles' }, [
          el('div', { class: 'card__kicker', text: spec.title }),
          el('div', { class: 'card__name' }, [
            el('span', { text: meta.name }),
            el('small', { text: meta.skill }),
          ]),
        ]),
        el('div', { class: 'card__timer num', text: formatDuration(spec.durationMs) }),
      ]),
      el('div', { class: 'card__tagline', text: meta.tagline }),
      mutatorChips(spec.mutatorIds),
      el('div', { class: 'card__foot' }, [
        el('div', { class: 'attempts' }, [
          el('div', { class: 'attempts__label', text: 'INTENTOS' }),
          el('div', {
            class: `attempts__dots${left === 0 ? ' is-empty' : ''}`,
            text: attemptsDisplay(spec.attempts - left, spec.attempts),
          }),
        ]),
        el('div', { class: 'card__best' }, [
          el('div', { class: 'card__best-label', text: best > 0 ? 'TU MEJOR' : 'A BATIR' }),
          el('div', {
            class: 'card__best-value num',
            text: best > 0 ? formatScore(best) : target ? `${formatScore(target.entry.total)} ${target.entry.name}` : '—',
          }),
        ]),
        playBtn,
      ]),
    ],
  );

  return card;
}

function renderSecretCard(app: App): HTMLElement {
  const spec = app.plan.secret;
  const status = app.secretInfo();
  const meta = gameMetaOf(app, spec);

  if (!status.unlocked) {
    const pips = el(
      'div',
      { class: 'progress-pips' },
      Array.from({ length: status.total }, (_, i) => el('div', { class: `pip${i < status.done ? ' is-on' : ''}` })),
    );
    return el('div', { class: 'card card--locked', style: { '--accent': '#ffd23f' } }, [
      el('div', { class: 'card__head' }, [
        el('div', { class: 'card__icon', text: '🔒' }),
        el('div', { class: 'card__titles' }, [
          el('div', { class: 'card__kicker', text: 'BLOQUEADO' }),
          el('div', { class: 'card__name' }, [el('span', { text: 'RETO SECRETO' })]),
        ]),
      ]),
      el('div', {
        class: 'card__locked-note',
        text:
          app.mode === 'group'
            ? `${status.done}/${status.total} JUGADORES LISTOS. Se abre cuando todos los que han entrado hoy terminen los tres retos.${
                status.missing.length > 0 ? ` Faltan: ${status.missing.join(', ')}.` : ''
              }`
            : `Se abre cuando los ${status.total} hayais jugado los tres retos de hoy. Faltan: ${
                status.missing.join(', ') || '—'
              }.`,
      }),
      pips,
    ]);
  }

  const left = app.attemptsLeft(spec);
  return el('div', { class: 'card', style: { '--accent': '#ffd23f' } }, [
    el('div', { class: 'card__head' }, [
      el('div', { class: 'card__icon', text: '🗝' }),
      el('div', { class: 'card__titles' }, [
        el('div', { class: 'card__kicker', text: 'RETO SECRETO · 1 INTENTO' }),
        el('div', { class: 'card__name' }, [el('span', { text: meta.name }), el('small', { text: 'A OSCURAS' })]),
      ]),
      el('div', { class: 'card__timer num', text: formatDuration(spec.durationMs) }),
    ]),
    el('div', { class: 'card__tagline', text: 'Un solo intento. Puntos dobles. Suma al ranking del dia.' }),
    mutatorChips(spec.mutatorIds),
    el('div', { class: 'card__foot' }, [
      el('div', { class: 'attempts' }, [
        el('div', { class: 'attempts__label', text: 'INTENTOS' }),
        el('div', {
          class: `attempts__dots${left === 0 ? ' is-empty' : ''}`,
          text: attemptsDisplay(spec.attempts - left, spec.attempts),
        }),
      ]),
      button(left > 0 ? 'JUGAR' : 'HECHO', 'btn btn--accent', () => app.startChallenge(spec), {
        disabled: left === 0,
      }),
    ]),
  ]);
}

function renderChaosCard(app: App): HTMLElement {
  const spec = app.plan.chaos;
  const meta = gameMetaOf(app, spec);
  const left = app.attemptsLeft(spec);
  const best = app.save.get().records.bestChaos;

  return el('div', { class: 'card', style: { '--accent': '#a78bfa' } }, [
    el('div', { class: 'card__head' }, [
      el('div', { class: 'card__icon', text: '☣' }),
      el('div', { class: 'card__titles' }, [
        el('div', { class: 'card__kicker', text: 'EVENTO · 1 INTENTO' }),
        el('div', { class: 'card__name' }, [el('span', { text: 'CHAOS' }), el('small', { text: meta.name })]),
      ]),
      el('div', { class: 'card__timer num', text: formatDuration(spec.durationMs) }),
    ]),
    el('div', { class: 'card__tagline', text: 'Reglas rotas, puntos x2.5 y marcador aparte. Un intento y a correr.' }),
    mutatorChips(spec.mutatorIds),
    el('div', { class: 'card__foot' }, [
      el('div', { class: 'card__best' }, [
        el('div', { class: 'card__best-label', text: 'RECORD CHAOS' }),
        el('div', { class: 'card__best-value num', text: best > 0 ? formatScore(best) : '—' }),
      ]),
      button(left > 0 ? 'ENTRAR' : 'USADO', 'btn btn--accent', () => app.startChallenge(spec), {
        disabled: left === 0,
      }),
    ]),
  ]);
}

function renderBoard(app: App, board: Leaderboard): HTMLElement {
  const leaderTotal = board.leader.total;
  const rows = board.standings.map((entry, index) => {
    const diff = entry.total - board.me.total;
    const gapText = entry.isMe
      ? index === 0
        ? 'LIDER'
        : `-${formatScore(leaderTotal - entry.total)}`
      : diff > 0
        ? `+${formatScore(diff)}`
        : `-${formatScore(Math.abs(diff))}`;

    const row = el('div', { class: `row${entry.isMe ? ' row--me' : ''}` }, [
      el('div', { class: 'row__pos num', text: String(index + 1) }),
      el('div', { class: 'row__dot', style: { background: entry.color } }),
      el('div', { class: 'row__name' }, [
        el('span', { text: entry.name }),
        entry.isMe ? el('span', { class: 'tag', text: 'TU' }) : null,
        index === 0 ? el('span', { text: '👑' }) : null,
        // Quien se la jugo lleva marca, para bien o para mal. Es media gracia
        // del sistema: que se vea en el ranking quien tuvo agallas.
        entry.apuesta === 'doblo'
          ? el('span', { class: 'tag tag--doblo', text: '🔥 DOBLO' })
          : entry.apuesta === 'cayo'
            ? el('span', { class: 'tag tag--cayo', text: '💀 CAYO' })
            : null,
        !entry.isMe && entry.played ? el('span', { class: 'tag', text: 'HA JUGADO' }) : null,
      ]),
      el('div', { class: 'row__score num', text: formatScore(entry.total) }),
      el('div', { class: 'row__gap num', text: gapText }),
    ]);

    if (entry.isMe) {
      row.addEventListener('click', () => {
        promptText({
          title: 'TU NOMBRE EN EL GRUPO',
          value: entry.name,
          maxLength: 16,
          onAccept: (value) => app.setName(value),
        });
      });
    }
    return row;
  });

  return el('div', { class: 'board' }, rows);
}

/** Records personales: la otra mitad de la motivacion, competir contra ti. */
function renderRecords(app: App): HTMLElement {
  const records = app.save.get().records;
  const streak = app.streak;
  const items: [string, string][] = [];

  for (const def of listGames()) {
    const best = records.bestByGame[def.meta.id] ?? 0;
    items.push([def.meta.name, best > 0 ? formatScore(best) : '—']);
  }
  items.push(['MEJOR DIA', records.bestDailyTotal > 0 ? formatScore(records.bestDailyTotal) : '—']);
  if (records.bestChaos > 0) items.push(['CHAOS', formatScore(records.bestChaos)]);
  items.push(['RACHA', streak.holderName ? `${streak.days}d ${streak.holderName}` : '—']);

  return el(
    'div',
    { class: 'records' },
    items.map(([label, value]) =>
      el('div', { class: 'record' }, [
        el('div', { class: 'record__value num', text: value }),
        el('div', { class: 'record__label', text: label }),
      ]),
    ),
  );
}

/** La linea que provoca "otra vez": a quien tienes al lado y con que reto. */
function renderPique(app: App, board: Leaderboard): HTMLElement | null {
  const ahead = rivalAhead(board.standings);
  const behind = rivalBehind(board.standings);

  const candidates = app.plan.challenges.filter((spec) => app.canPlay(spec));
  const best = candidates
    .map((spec) => ({ spec, target: targetForChallenge(app.plan, spec, app.save, app.rankingContext) }))
    .filter((entry) => entry.target && !entry.target.entry.isMe && entry.target.gap > 0)
    .sort((a, b) => (a.target?.gap ?? 0) - (b.target?.gap ?? 0))[0];

  if (!ahead && !behind) return null;

  const title = ahead
    ? `🔥 ${ahead.entry.name} ESTA ${formatScore(ahead.gap)} PUNTOS POR DELANTE`
    : behind
      ? `👑 ERES #1 POR ${formatScore(behind.gap)} PUNTOS`
      : '';

  const node = el('div', { class: 'result__pique result__pique--hot', style: { marginTop: '12px' } }, [
    el('div', { class: 'result__pique-title', text: title }),
    best
      ? el('div', {
          class: 'result__pique-sub',
          text: best.target
            ? `Donde mas cerca lo tienes: ${best.spec.title} · ${best.spec.gameName} — te faltan ${formatScore(
                best.target.gap,
              )} para pasar a ${best.target.entry.name}.`
            : `Tu mejor opcion: ${best.spec.title} · ${best.spec.gameName}.`,
        })
      : el('div', { class: 'result__pique-sub', text: 'Sin intentos: vuelve manana o usa el debug.' }),
    best
      ? button('REVANCHA', 'btn btn--play btn--block', () => app.startChallenge(best.spec, { quick: true }))
      : null,
  ]);
  return node;
}

/** El registro es la fuente de verdad de la ficha de cada juego. */
function gameMetaOf(_app: App, spec: ChallengeSpec) {
  return requireGame(spec.gameId).meta;
}
