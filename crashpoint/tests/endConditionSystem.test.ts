import { describe, it, expect } from 'vitest';
import { EndConditionSystem } from '../src/systems/EndConditionSystem';

describe('EndConditionSystem', () => {
  it('never finishes before a shot has been fired', () => {
    const end = new EndConditionSystem();
    expect(end.update(1000, 0, 3, 0)).toBe(false);
  });

  it('never finishes while shots remain or a projectile is still active', () => {
    const end = new EndConditionSystem();
    end.notifyShotFired(0);
    expect(end.update(500, 0, 1, 0)).toBe(false);
    expect(end.update(500, 0, 0, 1)).toBe(false);
  });

  it('finishes once the physics has stayed below the stability threshold long enough', () => {
    const end = new EndConditionSystem();
    end.notifyShotFired(0);
    expect(end.update(100, 0.1, 0, 0)).toBe(false); // settled, but not long enough yet
    expect(end.update(900, 0.1, 0, 0)).toBe(true); // settled for >= 700ms
  });

  it('resets the settle timer if the world speeds back up', () => {
    const end = new EndConditionSystem();
    end.notifyShotFired(0);
    expect(end.update(100, 0.1, 0, 0)).toBe(false);
    expect(end.update(300, 5, 0, 0)).toBe(false); // something moving again
    expect(end.update(500, 0.1, 0, 0)).toBe(false); // settle timer restarted
  });

  it('force-finishes on the safety timeout even if the world never fully sleeps', () => {
    const end = new EndConditionSystem();
    end.notifyShotFired(0);
    expect(end.update(11000, 3, 0, 0)).toBe(false);
    expect(end.update(12500, 3, 0, 0)).toBe(true);
  });
});
