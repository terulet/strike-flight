import { describe, expect, it } from 'vitest';
import { GhostRecorder } from '../src/gameplay/GhostRecorder';
import { GhostConfig } from '../src/config/GameConfig';

describe('GhostRecorder', () => {
  it('records frames with monotonically increasing timestamps', () => {
    const recorder = new GhostRecorder();
    const dt = 1 / 120;
    let t = 0;
    for (let i = 0; i < 600; i++) {
      t += dt;
      recorder.record(t, Math.sin(t), t * 2, 0.01 * t, dt);
    }

    const frames = recorder.recordedFrames;
    expect(frames.length).toBeGreaterThan(0);
    for (let i = 1; i < frames.length; i++) {
      expect(frames[i].t).toBeGreaterThan(frames[i - 1].t);
    }
  });

  it('samples at roughly the configured interval, not every single tick', () => {
    const recorder = new GhostRecorder();
    const dt = 1 / 120;
    let t = 0;
    for (let i = 0; i < 240; i++) {
      // 2 segundos de sim a 120Hz
      t += dt;
      recorder.record(t, 0, 0, 0, dt);
    }
    const expectedApprox = 2 / GhostConfig.sampleInterval;
    expect(recorder.recordedFrames.length).toBeGreaterThan(expectedApprox * 0.5);
    expect(recorder.recordedFrames.length).toBeLessThan(expectedApprox * 1.5);
  });
});
