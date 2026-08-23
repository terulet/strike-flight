/**
 * Pantalla de resultado. No es un "Game Over": es la pantalla del pique.
 *
 * Prioridad de lectura: puntuacion enorme -> que ha pasado -> a quien tienes
 * al lado -> REVANCHA. El boton de revancha es siempre el mas grande.
 */
import type { GameResult } from '../game/contract';
import { getGame } from '../game/registry';
import { attemptsDisplay } from '../meta/attempts';
import type { ChallengeSpec } from '../meta/daily';
import { formatScore } from '../meta/ranking';
import { headlineFor, type ScoreOutcome } from '../meta/scoring';
import type { App } from './app';
import { botonCompartir } from './compartir';
import { momentoDe } from '../meta/compartir';
import { button, el } from './dom';

export interface ResultHandlers {
  onRematch: () => void;
  onContinue: () => void;
}

export interface ResultOptions {
  /** Si el rival es una persona del grupo (cambia el tono de los mensajes). */
  group: boolean;
  myName: string;
  /** Panel de DOBLE O NADA, si el jugador aun tiene su ficha del dia. */
  apuesta?: HTMLElement | null;
  /** Como acabo la ficha del dia, si se gasto en este reto. */
  apuestaResultado?: 'doblo' | 'cayo' | null;
  /** Para avisar de que el texto se ha copiado. */
  onAviso?: (texto: string) => void;
}

export function renderResult(
  spec: ChallengeSpec,
  outcome: ScoreOutcome,
  result: GameResult,
  handlers: ResultHandlers,
  options: ResultOptions = { group: false, myName: 'TU' },
): HTMLElement {
  const headline = headlineFor(outcome);
  const canRematch = outcome.attemptsLeft > 0;
  const target = outcome.challengeTarget;
  const won = outcome.overtook.length > 0;
  // "Por poco" o "por mucho" cambia lo que se enseña: si has perdido por 2.000
  // puntos no hace falta restregarlo, basta con el comparativo.
  const gap = target && !target.entry.isMe ? target.gap : 0;
  const heavyLoss = !won && gap > 0 && (gap > 1000 || gap > outcome.score * 0.4);

  const stats = buildStats(result, getGame(spec.gameId)?.meta.skill === 'supervivencia');

  const inner = el('div', { class: 'result__inner' }, [
    el('div', { class: 'result__kicker', text: `${spec.title} · ${spec.gameName}` }),
    el('div', { class: 'result__score num', text: formatScore(outcome.score) }),
    el('div', { class: `result__headline result__headline--${headline.tone}`, text: headline.title }),
    renderDelta(outcome),
    outcome.ghostPassed
      ? el('div', { class: 'result__delta', text: '👻 HAS PASADO LA MARCA DEL RIVAL' })
      : null,
    heavyLoss && target
      ? renderComparison(outcome, target.entry.name, options.myName)
      : renderPique(outcome),
    // La apuesta va aqui: despues de ver tu marca y antes de los botones de
    // salir. Ese es el orden en el que se decide de verdad.
    options.apuesta ?? null,
    el(
      'div',
      { class: 'result__stats' },
      stats.map(([value, label]) =>
        el('div', { class: 'stat' }, [
          el('div', { class: 'stat__value num', text: value }),
          el('div', { class: 'stat__label', text: label }),
        ]),
      ),
    ),
    // Si has ganado, lo natural es continuar; si has perdido, volver a entrar.
    won
      ? el('div', { class: 'result__actions' }, [
          button('CONTINUAR', 'btn btn--play btn--lg btn--block', handlers.onContinue),
          canRematch
            ? button('OTRO INTENTO', 'btn btn--ghost btn--block', handlers.onRematch)
            : null,
        ])
      : el('div', { class: 'result__actions' }, [
          button(
            canRematch ? etiquetaReintento(outcome, heavyLoss) : 'SIN INTENTOS',
            'btn btn--play btn--lg btn--block',
            handlers.onRematch,
            { disabled: !canRematch },
          ),
          button('CONTINUAR', 'btn btn--ghost btn--block', handlers.onContinue),
        ]),
    // Compartir va DESPUES de los botones de jugar. Delante competiria con
    // REVANCHA, que es el boton que sostiene el juego; y solo aparece cuando
    // ha pasado algo que a otra persona le importa (ver momentoDe).
    momentoCompartible(spec, outcome, options),
    el('div', { class: `result__attempts${canRematch ? '' : ' result__empty'}` }, [
      el('span', { text: 'INTENTOS ' }),
      el('span', {
        class: 'dots',
        text: attemptsDisplay(spec.attempts - outcome.attemptsLeft, spec.attempts),
      }),
    ]),
  ]);

  return el('div', { class: 'result' }, [inner]);
}

/**
 * Como se llama el boton de volver a jugar.
 *
 * "REVANCHA" solo cuando hay alguien a quien alcanzar. Si ya mandas en el reto
 * la palabra no significa nada -no hay nada que vengar- y se veia raro: la
 * pantalla decia "MANDAS EN ESTE RETO" y debajo ofrecia revancha. Perder por
 * mucho tampoco es revancha: ahi lo honesto es otro intento.
 */
function etiquetaReintento(outcome: ScoreOutcome, heavyLoss: boolean): string {
  const hayAQuienAlcanzar = Boolean(outcome.challengeTarget && !outcome.challengeTarget.entry.isMe);
  if (!hayAQuienAlcanzar || heavyLoss) return 'OTRO INTENTO';
  return 'REVANCHA';
}

/** El boton de contarlo, si esta partida ha dado para contarse. */
function momentoCompartible(
  spec: ChallengeSpec,
  outcome: ScoreOutcome,
  options: ResultOptions,
): HTMLElement | null {
  const momento = momentoDe({
    yo: options.myName,
    reto: spec.title,
    juego: spec.gameName,
    puntuacion: outcome.score,
    adelantados: outcome.overtook.map((s) => s.name),
    lider: outcome.becameLeader,
    record: outcome.isPersonalRecord,
    apuesta: options.apuestaResultado ?? null,
  });
  if (!momento) return null;
  return botonCompartir(momento, (aviso) => {
    if (aviso) options.onAviso?.(aviso);
  });
}

/**
 * La distancia al rival, como imagen.
 *
 * "Te han faltado 42 puntos" es una frase; esto es la misma informacion pero
 * sentida. La barra crece hasta tu marca sobre la escala del rival, asi que 42
 * puntos de 3.000 se ven como casi lleno y 42 de 100 como medio camino. La
 * frase seria identica en los dos casos y la sensacion no lo es, y es la
 * sensacion la que hace pulsar REVANCHA.
 *
 * Al ganar la barra pasa de largo la marca del rival y se tine de magenta: el
 * mismo componente cuenta las dos historias.
 */
function renderDistancia(mio: number, rival: number, gana: boolean): HTMLElement {
  const tope = Math.max(mio, rival, 1);
  const anchoMio = Math.max(2, Math.min(100, (mio / tope) * 100));
  const anchoRival = Math.max(0, Math.min(100, (rival / tope) * 100));
  // "Por poco" tiene su propio color: el oro dice "lo tenias". Es el estado
  // que mas revanchas produce, asi que se distingue del resto.
  const cerca = !gana && rival > 0 && mio >= rival * 0.85;

  const relleno = el('div', { class: 'distancia__mio', style: { width: `${anchoMio}%` } });
  const barra = el('div', {
    class: `distancia${gana ? ' distancia--gana' : cerca ? ' distancia--cerca' : ''}`,
  }, [
    relleno,
    rival > 0 ? el('div', { class: 'distancia__rival', style: { left: `${anchoRival}%` } }) : null,
  ]);
  return barra;
}

/** El bloque "cuanto te ha faltado", con la cifra como protagonista. */
function renderBrecha(options: {
  cifra: string;
  rotulo: string;
  tono: 'gana' | 'cerca' | 'lejos';
  mio: number;
  rival: number;
}): HTMLElement {
  return el('div', { class: `brecha brecha--${options.tono}` }, [
    el('div', { class: 'brecha__cabeza' }, [
      el('div', { class: 'brecha__cifra num', text: options.cifra }),
      el('div', { class: 'brecha__rotulo', text: options.rotulo }),
    ]),
    renderDistancia(options.mio, options.rival, options.tono === 'gana'),
  ]);
}

/**
 * Estadisticas de la partida. Las genericas salen del contrato; las propias de
 * cada juego salen de result.metrics, asi que un juego nuevo puede aportar las
 * suyas sin tocar esta pantalla.
 */
const METRIC_LABELS: Record<string, string> = {
  wallsPassed: 'MUROS',
  grazes: 'ROCES',
  perfect: 'PERFECTOS',
  perfects: 'PERFECTOS',
  expired: 'APAGADOS',
  shots: 'DISPAROS',
  meanAccuracy: 'MEDIA',
};

function buildStats(result: GameResult, isSurvival: boolean): [string, string][] {
  const stats: [string, string][] = [];
  if (result.accuracy !== null) stats.push([`${Math.round(result.accuracy * 100)}%`, 'PUNTERIA']);
  if (result.bestCombo > 0) stats.push([`x${result.bestCombo}`, 'COMBO']);
  stats.push([`${(result.durationMs / 1000).toFixed(1)}s`, isSurvival ? 'AGUANTE' : 'TIEMPO']);

  for (const [key, label] of Object.entries(METRIC_LABELS)) {
    if (stats.length >= 3) break;
    const value = result.metrics[key];
    if (typeof value !== 'number' || value <= 0 || key === 'survivedMs') continue;
    stats.push([key === 'meanAccuracy' ? `${value}%` : String(value), label]);
  }
  return stats.slice(0, 3);
}

/** "MARC", "MARC Y KALI", "MARC, KALI Y 2 MAS". */
function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  if (names.length === 2) return `${names[0]} Y ${names[1]}`;
  if (names.length === 3) return `${names[0]}, ${names[1]} Y ${names[2]}`;
  return `${names[0]}, ${names[1]} Y ${names.length - 2} MAS`;
}

function renderDelta(outcome: ScoreOutcome): HTMLElement {
  if (outcome.isChallengeBest && outcome.previousBest > 0) {
    return el('div', { class: 'result__delta', text: `🔥 +${formatScore(outcome.gainVsBest)}` });
  }
  if (outcome.previousBest > 0) {
    return el('div', {
      class: 'result__delta is-down',
      text: `TU MEJOR SIGUE SIENDO ${formatScore(outcome.previousBest)}`,
    });
  }
  return el('div', { class: 'result__delta', text: 'PRIMERA MARCA DEL DIA' });
}

/**
 * Derrota clara: ni drama ni humillacion. Los dos numeros, cuanto has
 * mejorado respecto a tu intento anterior, y a seguir.
 */
function renderComparison(outcome: ScoreOutcome, rivalName: string, myName: string): HTMLElement {
  const improvement = outcome.gainVsBest;
  const rival = outcome.challengeTarget?.entry.total ?? 0;
  return el('div', { class: 'result__pique' }, [
    // La barra primero: se ve la distancia antes de leer los dos numeros.
    renderBrecha({
      cifra: formatScore(outcome.challengeTarget?.gap ?? 0),
      rotulo: `TE FALTAN PARA ${rivalName}`,
      tono: 'lejos',
      mio: outcome.score,
      rival,
    }),
    el('div', { class: 'compare' }, [
      el('div', { class: 'compare__row compare__row--rival' }, [
        el('span', { class: 'compare__name', text: rivalName }),
        el('span', { class: 'compare__score num', text: formatScore(outcome.challengeTarget?.entry.total ?? 0) }),
      ]),
      el('div', { class: 'compare__row' }, [
        el('span', { class: 'compare__name', text: myName }),
        el('span', { class: 'compare__score num', text: formatScore(outcome.score) }),
      ]),
    ]),
    el('div', {
      class: 'result__pique-sub',
      text:
        improvement > 0
          ? `MEJOR INTENTO: +${formatScore(improvement)}`
          : `TU MEJOR DE HOY: ${formatScore(outcome.previousBest)}`,
    }),
  ]);
}

/** El bloque que decide si vuelves a darle. */
function renderPique(outcome: ScoreOutcome): HTMLElement {
  const lines: (HTMLElement | null)[] = [];

  if (outcome.overtook.length > 0) {
    const names = joinNames(outcome.overtook.map((s) => s.name));
    const pasado = outcome.overtook[0];
    lines.push(el('div', { class: 'result__pique-title', text: `HAS SUPERADO A ${names}` }));
    if (pasado) {
      lines.push(
        renderBrecha({
          cifra: `+${formatScore(Math.max(0, outcome.score - pasado.total))}`,
          rotulo: `POR ENCIMA DE ${pasado.name}`,
          tono: 'gana',
          mio: outcome.score,
          rival: pasado.total,
        }),
      );
    }
    lines.push(el('div', { class: 'result__rank', text: `AHORA ERES #${outcome.rankAfter}` }));
  } else if (outcome.challengeTarget && !outcome.challengeTarget.entry.isMe) {
    const { entry, gap } = outcome.challengeTarget;
    // Este es el caso que mas revanchas produce: quedarse cerca. La cifra que
    // falta va grande y la barra ensena lo cerca que fue.
    lines.push(
      renderBrecha({
        cifra: formatScore(gap),
        rotulo: `TE FALTAN PARA ${entry.name}`,
        tono: 'cerca',
        mio: outcome.score,
        rival: entry.total,
      }),
    );
    lines.push(
      el('div', {
        class: 'result__pique-sub',
        text: `En este reto vas #${outcome.challengeRank}. En el dia vas #${outcome.rankAfter}.`,
      }),
    );
  } else {
    lines.push(el('div', { class: 'result__pique-title', text: 'MANDAS EN ESTE RETO' }));
    lines.push(el('div', { class: 'result__pique-sub', text: `En el dia vas #${outcome.rankAfter}.` }));
  }

  if (outcome.becameLeader) {
    lines.push(el('div', { class: 'result__rank', text: '👑 TE PONES PRIMERO DEL DIA' }));
  }
  if (outcome.chaos) {
    lines.push(el('div', { class: 'result__pique-sub', text: 'El evento CHAOS puntua aparte del ranking diario.' }));
  }

  return el(
    'div',
    { class: `result__pique${outcome.overtook.length > 0 || outcome.becameLeader ? ' result__pique--hot' : ''}` },
    lines,
  );
}

/** Sonido y vibracion segun lo que ha pasado. */
export function celebrate(app: App, outcome: ScoreOutcome): void {
  // Ponerse primero suena distinto a adelantar a uno cualquiera.
  if (outcome.becameLeader) {
    app.audio.play('victory');
    app.audio.play('record');
    app.haptics.fire('success');
    return;
  }
  if (outcome.isPersonalRecord || (outcome.isChallengeBest && outcome.previousBest > 0)) {
    app.audio.play('record');
    app.haptics.fire('success');
    return;
  }
  if (outcome.overtook.length > 0) {
    app.audio.play('overtake');
    app.haptics.fire('success');
    return;
  }
  if (outcome.isChallengeBest) {
    app.audio.play('victory');
    return;
  }
  app.audio.play('defeat');
}
