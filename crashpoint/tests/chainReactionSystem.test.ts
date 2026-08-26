import { describe, it, expect } from 'vitest';
import { EventBus } from '../src/core/EventBus';
import type { GameEvents } from '../src/core/events';
import { ChainReactionSystem } from '../src/systems/ChainReactionSystem';

function makeBus() {
  return new EventBus<GameEvents>();
}

describe('ChainReactionSystem', () => {
  it('starts a chain of length 1 on the first break', () => {
    let clock = 0;
    const bus = makeBus();
    const chain = new ChainReactionSystem(bus, () => clock);

    let started = false;
    bus.on('chain_start', () => (started = true));

    bus.emit('structural_break', { pieceId: 'a', material: 'wood', causeId: 'proj_0', point: { x: 0, y: 0 } });
    expect(started).toBe(true);
    expect(chain.getCurrentChainLength()).toBe(1);
  });

  it('extends the chain when breaks happen within the time window', () => {
    let clock = 0;
    const bus = makeBus();
    const chain = new ChainReactionSystem(bus, () => clock);

    bus.emit('structural_break', { pieceId: 'a', material: 'wood', causeId: 'proj_0', point: { x: 0, y: 0 } });
    clock += 500;
    bus.emit('structural_break', { pieceId: 'b', material: 'metal', causeId: 'a', point: { x: 0, y: 0 } });
    clock += 500;
    bus.emit('explosion', { pieceId: 'c', causeId: 'b', point: { x: 0, y: 0 }, radius: 100 });

    expect(chain.getCurrentChainLength()).toBe(3);
  });

  it('closes the chain once the window expires and records the best chain', () => {
    let clock = 0;
    const bus = makeBus();
    const chain = new ChainReactionSystem(bus, () => clock);

    bus.emit('structural_break', { pieceId: 'a', material: 'wood', causeId: 'proj_0', point: { x: 0, y: 0 } });
    clock += 300;
    bus.emit('structural_break', { pieceId: 'b', material: 'wood', causeId: 'a', point: { x: 0, y: 0 } });

    let ended = false;
    let endedLength = 0;
    bus.on('chain_end', (e) => {
      ended = true;
      endedLength = e.chainLength;
    });

    clock += 5000; // well past the chain window
    chain.update(clock);

    expect(ended).toBe(true);
    expect(endedLength).toBe(2);
    expect(chain.bestChain).toBe(2);
    expect(chain.getCurrentChainLength()).toBe(0);
  });

  it('accumulates totalChainLinks across multiple closed chains', () => {
    let clock = 0;
    const bus = makeBus();
    const chain = new ChainReactionSystem(bus, () => clock);

    // First chain: 3 links (length 3 -> +2).
    bus.emit('structural_break', { pieceId: 'a', material: 'wood', causeId: 'x', point: { x: 0, y: 0 } });
    clock += 100;
    bus.emit('structural_break', { pieceId: 'b', material: 'wood', causeId: 'a', point: { x: 0, y: 0 } });
    clock += 100;
    bus.emit('structural_break', { pieceId: 'c', material: 'wood', causeId: 'b', point: { x: 0, y: 0 } });
    clock += 5000;
    chain.update(clock);

    // Second chain: length 1 -> +0.
    bus.emit('structural_break', { pieceId: 'd', material: 'wood', causeId: 'proj_1', point: { x: 0, y: 0 } });
    clock += 5000;
    chain.update(clock);

    expect(chain.totalChainLinks).toBe(2);
    expect(chain.bestChain).toBe(3);
  });

  it('resets cleanly for a new run', () => {
    let clock = 0;
    const bus = makeBus();
    const chain = new ChainReactionSystem(bus, () => clock);
    bus.emit('structural_break', { pieceId: 'a', material: 'wood', causeId: 'x', point: { x: 0, y: 0 } });
    clock += 5000;
    chain.update(clock);

    chain.reset();
    expect(chain.bestChain).toBe(0);
    expect(chain.totalChainLinks).toBe(0);
    expect(chain.getCurrentChainLength()).toBe(0);
  });
});
