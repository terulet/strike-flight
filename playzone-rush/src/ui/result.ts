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
import { button, el } from './dom';

export interface ResultHandlers {
  onRematch: () => void;
  onContinue: () => void;
}

export function renderResult(
  spec: ChallengeSpec,
  outcome: ScoreOutcome,
  result: GameResult,
  handlers: ResultHandlers,
): HTMLElement {
  const headline = headlineFor(outcome);
  const canRematch = outcome.attemptsLeft > 0;

  const stats = buildStats(result, getGame(spec.gameId)?.meta.skill === 'supervivencia');

  const inner = el('div', { class: 'result__inner' }, [
    el('div', { class: 'result__kicker', text: `${spec.title} · ${spec.gameName}` }),
    el('div', { class: 'result__score num', text: formatScore(outcome.score) }),
    el('div', { class: `result__headline result__headline--${headline.tone}`, text: headline.title }),
    renderDelta(outcome),
    outcome.ghostPassed
      ? el('div', { class: 'result__delta', text: '👻 HAS PASADO LA MARCA DEL RIVAL' })
      : null,
    renderPique(outcome),
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
    el('div', { class: 'result__actions' }, [
      button(canRematch ? 'REVANCHA' : 'SIN INTENTOS', 'btn btn--play btn--lg btn--block', handlers.onRematch, {
        disabled: !canRematch,
      }),
      button('CONTINUAR', 'btn btn--ghost btn--block', handlers.onContinue),
    ]),
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

/** El bloque que decide si vuelves a darle. */
function renderPique(outcome: ScoreOutcome): HTMLElement {
  const lines: (HTMLElement | null)[] = [];

  if (outcome.overtook.length > 0) {
    const names = joinNames(outcome.overtook.map((s) => s.name));
    lines.push(el('div', { class: 'result__pique-title', text: `HAS SUPERADO A ${names}` }));
    lines.push(el('div', { class: 'result__rank', text: `AHORA ERES #${outcome.rankAfter}` }));
  } else if (outcome.challengeTarget && !outcome.challengeTarget.entry.isMe) {
    const { entry, gap } = outcome.challengeTarget;
    lines.push(
      el('div', {
        class: 'result__pique-title',
        text: `TE HAN FALTADO ${formatScore(gap)} PUNTOS PARA SUPERAR A ${entry.name}`,
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
  if (outcome.isPersonalRecord || (outcome.isChallengeBest && outcome.previousBest > 0)) {
    app.audio.play('record');
    app.haptics.fire('success');
    return;
  }
  if (outcome.overtook.length > 0 || outcome.becameLeader) {
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
