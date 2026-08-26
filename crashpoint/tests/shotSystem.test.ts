import { describe, it, expect } from 'vitest';
import { EventBus } from '../src/core/EventBus';
import type { GameEvents } from '../src/core/events';
import { ShotSystem } from '../src/systems/ShotSystem';
import { MAX_SHOTS } from '../src/systems/ScoreSystem';

describe('ShotSystem', () => {
  it('starts with 3 shots and the Impact Core selected', () => {
    const shot = new ShotSystem({ x: 0, y: 0 }, new EventBus<GameEvents>());
    expect(shot.shotsRemaining).toBe(MAX_SHOTS);
    expect(shot.selected).toBe('impact_core');
  });

  it('lets the player switch projectile before firing', () => {
    const shot = new ShotSystem({ x: 0, y: 0 }, new EventBus<GameEvents>());
    shot.selectProjectile('drill_spike');
    expect(shot.selected).toBe('drill_spike');
  });

  it('ignores a drag that is too small to count as an aim', () => {
    const shot = new ShotSystem({ x: 0, y: 0 }, new EventBus<GameEvents>());
    shot.startAim({ x: 2, y: 1 }); // well under the minimum drag distance
    const result = shot.fire();
    expect(result).toBeNull();
    expect(shot.shotsRemaining).toBe(MAX_SHOTS);
  });

  it('fires on a valid drag, decrements shots and emits shot_fired', () => {
    const bus = new EventBus<GameEvents>();
    const shot = new ShotSystem({ x: 0, y: 0 }, bus);

    let fired: any = null;
    bus.on('shot_fired', (e) => (fired = e));

    shot.startAim({ x: 150, y: -80 });
    const result = shot.fire();

    expect(result).not.toBeNull();
    expect(shot.shotsRemaining).toBe(MAX_SHOTS - 1);
    expect(fired).not.toBeNull();
    expect(fired.projectile).toBe('impact_core');
    // Velocity should point roughly toward the drag direction (positive x, negative y).
    expect(fired.velocity.x).toBeGreaterThan(0);
    expect(fired.velocity.y).toBeLessThan(0);
  });

  it('cannot fire more than MAX_SHOTS times', () => {
    const bus = new EventBus<GameEvents>();
    const shot = new ShotSystem({ x: 0, y: 0 }, bus);
    for (let i = 0; i < MAX_SHOTS; i++) {
      shot.startAim({ x: 100, y: -50 });
      expect(shot.fire()).not.toBeNull();
    }
    shot.startAim({ x: 100, y: -50 });
    expect(shot.fire()).toBeNull();
    expect(shot.shotsRemaining).toBe(0);
  });

  it('reports increasing power the further the drag goes, clamped to 1', () => {
    const shot = new ShotSystem({ x: 0, y: 0 }, new EventBus<GameEvents>());
    shot.startAim({ x: 50, y: 0 });
    const smallPower = shot.getPower();
    shot.updateAim({ x: 400, y: 0 });
    const bigPower = shot.getPower();
    expect(bigPower).toBeGreaterThan(smallPower);
    expect(bigPower).toBeLessThanOrEqual(1);
  });

  it('resets to initial state for a new run', () => {
    const shot = new ShotSystem({ x: 0, y: 0 }, new EventBus<GameEvents>());
    shot.selectProjectile('pulse_orb');
    shot.startAim({ x: 100, y: -50 });
    shot.fire();
    shot.reset();
    expect(shot.shotsRemaining).toBe(MAX_SHOTS);
    expect(shot.selected).toBe('impact_core');
    expect(shot.aiming).toBe(false);
  });
});
