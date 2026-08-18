/**
 * Portada: RUSH DE HOY.
 *
 * Objetivo de esta pantalla: en tres segundos tienes que saber que jugar, con
 * quien compites y cuanto te falta para adelantar a alguien.
 */
import { dayLabel } from '../core/clock';
import { describeMutators } from '../game/mutators';
import { requireGame } from '../game/registry';
import { attemptDots } from '../meta/attempts';
import { formatDuration, type ChallengeSpec } from '../meta/daily';
import { formatScore, rivalAhead, rivalBehind, type Leaderboard } from '../meta/ranking';
import { secretStatus } from '../meta/secret';
import { targetForChallenge } from '../meta/session';
import type { App } from './app';
import { button, el } from './dom';
import { promptText } from './modal';

export function renderHome(app: App): HTMLElement {
  const board = app.leaderboard();
  const screen = el('div', { class: 'screen' });

  screen.appendChild(renderTopbar(app));

  const scroller = el('div', { class: 'scroller' });
  scroller.appendChild(renderHero(app, board));
  scroller.appendChild(renderSocial(app, board));

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
    app.clock.offset !== 0
      ? el('span', { class: 'chip chip--debug', text: `DIA ${app.clock.offset > 0 ? '+' : ''}${app.clock.offset}` })
      : null,
    muteBtn,
  ]);
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
  const target = targetForChallenge(app.plan, spec, app.save);

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
            text: attemptDots(spec.attempts - left, spec.attempts),
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
  const status = secretStatus(app.save, app.plan);
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
        text: `Se abre cuando los ${status.total} hayais jugado los tres retos de hoy. Faltan: ${
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
          text: attemptDots(spec.attempts - left, spec.attempts),
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
          onAccept: (value) => app.setName(value),
        });
      });
    }
    return row;
  });

  return el('div', { class: 'board' }, rows);
}

/** La linea que provoca "otra vez": a quien tienes al lado y con que reto. */
function renderPique(app: App, board: Leaderboard): HTMLElement | null {
  const ahead = rivalAhead(board.standings);
  const behind = rivalBehind(board.standings);

  const candidates = app.plan.challenges.filter((spec) => app.canPlay(spec));
  const best = candidates
    .map((spec) => ({ spec, target: targetForChallenge(app.plan, spec, app.save) }))
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
          text: `Tu mejor opcion: ${best.spec.title} · ${best.spec.gameName} (${
            best.target ? `${formatScore(best.target.gap)} para pasar a ${best.target.entry.name}` : ''
          })`,
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
