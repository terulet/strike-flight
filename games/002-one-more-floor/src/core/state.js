/**
 * Explicit game states + the only legal transitions between them.
 * Keeping this as data (instead of scattered booleans) is what makes
 * "impossible state" tests meaningful.
 */

export const State = Object.freeze({
  BOOT: 'boot',
  TITLE: 'title',
  PLAYING: 'playing',
  TRANSITION: 'transition',
  DYING: 'dying',
  RESULT: 'result',
});

export const TRANSITIONS = Object.freeze({
  [State.BOOT]: [State.TITLE],
  [State.TITLE]: [State.PLAYING],
  [State.PLAYING]: [State.TRANSITION, State.DYING],
  [State.TRANSITION]: [State.PLAYING, State.DYING],
  [State.DYING]: [State.RESULT],
  [State.RESULT]: [State.PLAYING, State.TITLE],
});

export function canTransition(from, to) {
  return (TRANSITIONS[from] || []).includes(to);
}

export class StateMachine {
  constructor(initial = State.BOOT, onChange = null) {
    this.current = initial;
    this.previous = null;
    this.timeInState = 0;
    this.onChange = onChange;
  }

  is(...states) {
    return states.includes(this.current);
  }

  /** Returns true if the transition happened. Illegal moves are refused, not thrown. */
  set(next) {
    if (next === this.current) return false;
    if (!canTransition(this.current, next)) return false;
    this.previous = this.current;
    this.current = next;
    this.timeInState = 0;
    this.onChange?.(next, this.previous);
    return true;
  }

  update(dt) {
    this.timeInState += dt;
  }
}
