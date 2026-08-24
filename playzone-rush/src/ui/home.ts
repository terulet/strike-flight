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
import { formatScore, repartoDelPodio, rivalAhead, rivalBehind, type Leaderboard } from '../meta/ranking';
import { resumirQueFaltan } from '../meta/secret';
import { targetForChallenge } from '../meta/session';
import type { App } from './app';
import { button, el } from './dom';
import { compartirTexto } from './compartir';
import { textoInvitacion } from '../meta/compartir';
import { hayMarca, iconButton, marca } from './icons';
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

/**
 * El simbolo de la tarjeta. Si el juego todavia no tiene marca dibujada se
 * cae al caracter que trae su ficha: mejor un glifo suelto que un hueco.
 */
function marcaDeJuego(id: string, respaldo: string): HTMLElement {
  if (hayMarca(id)) return el('div', { class: 'card__icon' }, [marca(id)]);
  return el('div', { class: 'card__icon', text: respaldo });
}

function sectionTitle(text: string, right?: string): HTMLElement {
  return el('div', { class: 'section-title' }, [
    el('span', { text }),
    right ? el('span', { text: right }) : null,
  ]);
}

function renderTopbar(app: App): HTMLElement {
  const muted = app.audio.muted;
  const muteBtn = iconButton(
    muted ? 'silencio' : 'sonido',
    muted ? 'Activar sonido' : 'Silenciar',
    'icon-btn',
    () => {
      const nowMuted = app.toggleMute();
      muteBtn.setIcon(nowMuted ? 'silencio' : 'sonido', nowMuted ? 'Activar sonido' : 'Silenciar');
      muteBtn.classList.toggle('icon-btn--off', nowMuted);
      if (!nowMuted) app.audio.play('tap');
    },
  );
  muteBtn.classList.toggle('icon-btn--off', muted);

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
    // El texto de la invitacion vive en un solo sitio: aqui y en el onboarding
    // se invita igual, y antes eran dos frases distintas escritas a mano.
    const que = await compartirTexto(textoInvitacion(snapshot.group.code));
    if (que === 'copiado') app.toaster.show('INVITACION COPIADA', 'good', 2000);
  });

  // El codigo es la pieza que se ensena a otra persona, muchas veces girando el
  // movil o leyendolo en voz alta. Va grande, con las letras separadas y una
  // por una: cuatro caracteres sueltos se dictan sin equivocarse y se leen de
  // lejos. Antes era una linea pequena al lado de dos botones.
  const codigo = el(
    'div',
    { class: 'invita__codigo' },
    snapshot.group.code.split('').map((letra) => el('span', { class: 'invita__letra', text: letra })),
  );

  return el('div', { class: 'group' }, [
    el('div', { class: 'invita' }, [
      el('div', { class: 'rotulo', text: 'CODIGO DEL GRUPO' }),
      codigo,
      el('div', { class: 'invita__pista', text: 'QUIEN LO TENGA, ENTRA' }),
      el('div', { class: 'group__actions invita__acciones' }, [copy, share]),
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

  // Este es el aviso que mas trabajo emocional hace de toda la app, asi que va
  // en magenta -el color del pique- y con la distancia como cifra grande: el
  // numero es lo que se queda en la cabeza, no la frase.
  return el('div', { class: 'overtake', style: { '--emite': 'var(--magenta)' } }, [
    el('div', { class: 'overtake__cabeza' }, [
      el('div', { class: 'overtake__icono', text: '🔥' }),
      el('div', {}, [
        el('div', { class: 'overtake__title' }, [
          el('span', { class: 'overtake__quien', text: event.rivalName }),
          el('span', { text: ' TE HA QUITADO EL #1' }),
        ]),
        el('div', {
          class: 'overtake__sub',
          text: target
            ? `Responde en ${spec?.title ?? ''} · ${spec?.gameName ?? ''}`
            : 'Sin intentos para responder hoy.',
        }),
      ]),
    ]),
    target
      ? el('div', { class: 'overtake__cifra' }, [
          el('span', { class: 'overtake__cifra-num num', text: formatScore(target.gap) }),
          el('span', { class: 'rotulo', text: 'TE FALTAN' }),
        ])
      : null,
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

/**
 * El bloque de evento del dia.
 *
 * Antes esto era un titulo con tres chips debajo. El problema no era que fuese
 * feo: era que no decia lo unico que hace abrir la app, que es EN QUE PUESTO
 * VAS y CUANTO TE FALTA. Ahora el puesto es el dato grande y la distancia al de
 * arriba va al lado, porque "te faltan 148" es una frase que se puede accionar
 * y "vas #5" no.
 */
function renderHero(app: App, board: Leaderboard): HTMLElement {
  const ahead = rivalAhead(board.standings);
  const behind = rivalBehind(board.standings);
  const lider = board.myRank === 1;

  // El estado de una sola frase. Manda la distancia al de arriba; si no hay
  // nadie arriba, manda la ventaja sobre el de abajo.
  const estado = ahead
    ? el('div', { class: 'heroe__estado' }, [
        el('span', { class: 'heroe__estado-cifra num', text: `+${formatScore(ahead.gap)}` }),
        el('span', { class: 'heroe__estado-texto', text: `PARA PASAR A ${ahead.entry.name}` }),
      ])
    : behind
      ? el('div', { class: 'heroe__estado heroe__estado--oro' }, [
          el('span', { class: 'heroe__estado-cifra num', text: formatScore(behind.gap) }),
          el('span', { class: 'heroe__estado-texto', text: 'DE VENTAJA. AGUANTA.' }),
        ])
      : el('div', { class: 'heroe__estado' }, [
          el('span', { class: 'heroe__estado-texto', text: 'JUEGA EL PRIMER RETO PARA ENTRAR' }),
        ]);

  return el('div', { class: 'hero heroe' }, [
    el('div', { class: 'heroe__fila' }, [
      el('span', { class: 'chip chip--vivo', style: { '--emite': 'var(--cian)' } }, [
        el('span', { text: dayLabel(app.dayKey, app.clock.realDayKey()) }),
      ]),
      el('span', { class: 'rotulo', text: `${app.plan.challenges.length} RETOS · 3 INTENTOS` }),
    ]),
    el('h1', { class: 'hero__title', html: 'RUSH <em>DE HOY</em>' }),
    el('div', { class: 'heroe__marcador' }, [
      el('div', { class: `heroe__puesto${lider ? ' heroe__puesto--oro' : ''}` }, [
        el('div', { class: 'rotulo', text: 'VAS' }),
        el('div', { class: 'heroe__puesto-cifra num', text: `#${board.myRank}` }),
      ]),
      estado,
    ]),
  ]);
}

function renderSocial(app: App, board: Leaderboard): HTMLElement {
  const streak = app.streak;
  const leader = board.leader;
  const lines: HTMLElement[] = [];

  // Quien manda: oro, siempre. El oro solo se usa para el primer puesto, asi
  // que verlo ya dice de que va la linea antes de leerla.
  lines.push(
    banner({
      emite: 'var(--oro)',
      icono: '👑',
      quien: leader.isMe ? 'VAS PRIMERO' : leader.name,
      resto: leader.isMe ? ' HOY. AGUANTA.' : ` MANDA HOY CON ${formatScore(leader.total)}.`,
    }),
  );

  if (streak.holderName && streak.days > 0) {
    const mine = streak.holderId === 'me';
    lines.push(
      banner({
        emite: 'var(--magenta)',
        icono: '🔥',
        quien: mine ? 'LLEVAS' : `${streak.holderName} LLEVA`,
        resto: ` ${streak.days} ${streak.days === 1 ? 'DIA' : 'DIAS'} GANANDO.`,
      }),
    );
  }

  return el('div', { class: 'social' }, lines);
}

/**
 * El aviso social, en una sola pieza.
 *
 * `quien` va destacado en el color del banner y `resto` en texto normal: el ojo
 * engancha el nombre del rival antes de leer la frase entera, que es justo el
 * orden en el que esto funciona.
 */
function banner(options: {
  emite: string;
  icono: string;
  quien: string;
  resto: string;
  sub?: string;
}): HTMLElement {
  return el('div', { class: 'banner', style: { '--emite': options.emite } }, [
    el('div', { class: 'banner__icono', text: options.icono }),
    el('div', {}, [
      el('div', { class: 'banner__texto' }, [
        el('span', { class: 'banner__quien', text: options.quien }),
        el('span', { text: options.resto }),
      ]),
      options.sub ? el('div', { class: 'banner__sub', text: options.sub }) : null,
    ]),
  ]);
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

  // La tarjeta se pasa a si misma: es la que crece hasta convertirse en el
  // juego, asi que hay que medirla antes de que la portada desaparezca.
  const playBtn = button(
    left > 0 ? 'JUGAR' : 'SIN INTENTOS',
    'btn btn--accent',
    () => app.startChallenge(spec, { desde: card }),
    { disabled: left === 0 },
  );

  const card = el(
    'div',
    {
      class: `card${left === 0 ? ' card--done' : ''}`,
      style: { '--accent': meta.accent },
    },
    [
      el('div', { class: 'card__head' }, [
        marcaDeJuego(meta.id, meta.icon),
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
          el('div', {
            class: 'card__best-label',
            // Un rival con 0 no es un objetivo: "A BATIR 0 MARC" se lee como
            // un dato sin terminar. Si nadie ha marcado todavia, lo que hay
            // que decir es que el sitio esta libre.
            text: best > 0 ? 'TU MEJOR' : target && target.entry.total > 0 ? 'A BATIR' : 'NADIE HA JUGADO',
          }),
          // La cifra y el nombre en piezas distintas: juntos en un solo texto
          // el nombre heredaba el tratamiento de numero y se leia "2.750SILVIA".
          el('div', { class: 'card__best-value' }, [
            el('span', {
              class: 'num',
              text:
                best > 0
                  ? formatScore(best)
                  : target && target.entry.total > 0
                    ? formatScore(target.entry.total)
                    : 'SE EL PRIMERO',
            }),
            best === 0 && target && target.entry.total > 0
              ? el('span', { class: 'card__best-who', text: target.entry.name })
              : null,
          ]),
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
        el('div', { class: 'card__icon' }, [marca('secreto')]),
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
                status.missing.length > 0 ? ` Faltan: ${resumirQueFaltan(status.missing)}.` : ''
              }`
            : `Se abre cuando los ${status.total} hayais jugado los tres retos de hoy. Faltan: ${
                resumirQueFaltan(status.missing) || '—'
              }.`,
      }),
      pips,
    ]);
  }

  const left = app.attemptsLeft(spec);
  const card: HTMLElement = el('div', { class: 'card', style: { '--accent': '#ffd23f' } }, [
    el('div', { class: 'card__head' }, [
      el('div', { class: 'card__icon' }, [marca('llave')]),
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
  return card;
}

function renderChaosCard(app: App): HTMLElement {
  const spec = app.plan.chaos;
  const meta = gameMetaOf(app, spec);
  const left = app.attemptsLeft(spec);
  const best = app.save.get().records.bestChaos;

  const card: HTMLElement = el('div', { class: 'card', style: { '--accent': '#a78bfa' } }, [
    el('div', { class: 'card__head' }, [
      el('div', { class: 'card__icon' }, [marca('chaos')]),
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
      button(left > 0 ? 'ENTRAR' : 'USADO', 'btn btn--accent', () => app.startChallenge(spec, { desde: card }), {
        disabled: left === 0,
      }),
    ]),
  ]);
  return card;
}

/**
 * El ranking, con podio.
 *
 * Tres alturas de lectura y no una lista plana:
 *
 *   #1        tarjeta grande con corona. Es el sitio que todo el mundo mira.
 *   #2 y #3   dos modulos pequenos al lado, en una fila.
 *   #4 y mas  filas compactas, como antes.
 *
 * Mobile-first de verdad: el podio ocupa unos 190 px en total, no tres columnas
 * enormes. Si el podio se comiera la pantalla, los retos -que son el motivo de
 * abrir la app- quedarian debajo del pliegue, y eso seria cambiar claridad por
 * decoracion.
 *
 * REGLA QUE NO SE ROMPE: tu fila siempre se encuentra. Si estas fuera del podio
 * y fuera de lo que se ve, se pinta igualmente al final, separada y marcada.
 * Nadie tiene que buscarse a si mismo en su propio juego.
 */
function renderBoard(app: App, board: Leaderboard): HTMLElement {
  const leaderTotal = board.leader.total;
  const orden = board.standings;

  const diferencia = (entry: (typeof orden)[number], index: number): string => {
    const diff = entry.total - board.me.total;
    if (entry.isMe) return index === 0 ? 'LIDER' : `-${formatScore(leaderTotal - entry.total)}`;
    return diff > 0 ? `+${formatScore(diff)}` : `-${formatScore(Math.abs(diff))}`;
  };

  const editarNombre = (nodo: HTMLElement, nombre: string) => {
    nodo.addEventListener('click', () => {
      promptText({
        title: 'TU NOMBRE EN EL GRUPO',
        value: nombre,
        maxLength: 16,
        onAccept: (value) => app.setName(value),
      });
    });
  };

  const piezas: HTMLElement[] = [];

  /* ---------- #1 ---------- */
  const primero = orden[0];
  if (primero) {
    const hero = el(
      'div',
      { class: `podio__hero${primero.isMe ? ' podio__hero--yo' : ''}` },
      [
        el('div', { class: 'podio__corona', text: '👑' }),
        el('div', { class: 'podio__hero-datos' }, [
          el('div', { class: 'rotulo', text: primero.isMe ? 'MANDAS TU' : 'MANDA' }),
          el('div', { class: 'podio__hero-nombre' }, [
            el('span', { text: primero.name }),
            primero.isMe ? el('span', { class: 'tag', text: 'TU' }) : null,
            marcaApuesta(primero.apuesta),
          ]),
        ]),
        el('div', { class: 'podio__hero-puntos num', text: formatScore(primero.total) }),
      ],
    );
    if (primero.isMe) editarNombre(hero, primero.name);
    piezas.push(hero);
  }

  /* ---------- #2 y #3 ---------- */
  const secundarios = orden.slice(1, 3);
  if (secundarios.length > 0) {
    piezas.push(
      el(
        'div',
        { class: 'podio__pareja' },
        secundarios.map((entry, i) => {
          const nodo = el('div', { class: `podio__mini${entry.isMe ? ' podio__mini--yo' : ''}` }, [
            el('div', { class: 'podio__mini-cabeza' }, [
              el('span', { class: 'puesto', text: String(i + 2) }),
              el('span', { class: 'podio__mini-nombre', text: entry.name }),
            ]),
            el('div', { class: 'podio__mini-puntos num', text: formatScore(entry.total) }),
            el('div', { class: 'podio__mini-gap num', text: diferencia(entry, i + 1) }),
          ]);
          if (entry.isMe) editarNombre(nodo, entry.name);
          return nodo;
        }),
      ),
    );
  }

  /* ---------- del cuarto en adelante ---------- */
  const resto = orden.slice(3);
  if (resto.length > 0) {
    piezas.push(
      el(
        'div',
        { class: 'board board--resto' },
        resto.map((entry, i) => filaRanking(entry, i + 4, diferencia(entry, i + 3), editarNombre)),
      ),
    );
  }

  /* ---------- tu fila, pase lo que pase ---------- */
  // Si estas entre los tres primeros ya se te ve; si no, y ademas la lista es
  // larga, se repite tu fila al final para no obligarte a buscarte.
  const miIndice = orden.findIndex((e) => e.isMe);
  if (repartoDelPodio(orden.length, miIndice).repetirMiFila) {
    const yo = orden[miIndice];
    if (yo) {
      piezas.push(
        el('div', { class: 'board board--yo-fijo' }, [
          filaRanking(yo, miIndice + 1, diferencia(yo, miIndice), editarNombre),
        ]),
      );
    }
  }

  return el('div', { class: 'podio' }, piezas);
}

/** 🔥 o 💀 al lado del nombre: se ve en el ranking quien tuvo agallas. */
function marcaApuesta(apuesta: 'doblo' | 'cayo' | null | undefined): HTMLElement | null {
  if (apuesta === 'doblo') return el('span', { class: 'tag tag--doblo', text: '🔥 DOBLO' });
  if (apuesta === 'cayo') return el('span', { class: 'tag tag--cayo', text: '💀 CAYO' });
  return null;
}

/** Una fila compacta del ranking. */
function filaRanking(
  entry: Leaderboard['standings'][number],
  puesto: number,
  gapText: string,
  editarNombre: (nodo: HTMLElement, nombre: string) => void,
): HTMLElement {
  const row = el('div', { class: `row${entry.isMe ? ' row--me' : ''}` }, [
    el('div', { class: `puesto${entry.isMe ? ' puesto--yo' : ''}`, text: String(puesto) }),
    el('div', { class: 'row__dot', style: { background: entry.color } }),
    el('div', { class: 'row__name' }, [
      el('span', { text: entry.name }),
      entry.isMe ? el('span', { class: 'tag', text: 'TU' }) : null,
      marcaApuesta(entry.apuesta),
      !entry.isMe && entry.played ? el('span', { class: 'tag', text: 'HA JUGADO' }) : null,
    ]),
    el('div', { class: 'row__score num', text: formatScore(entry.total) }),
    el('div', { class: 'row__gap num', text: gapText }),
  ]);
  if (entry.isMe) editarNombre(row, entry.name);
  return row;
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
