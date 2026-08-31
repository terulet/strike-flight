import { describe, expect, it } from 'vitest';
import { GhostRecorder, ghostTimeAtX, sampleGhostAtTime } from '../src/gameplay/GhostRecorder';
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

  it('interpolates pose by time including rotation across PI', () => {
    const pose = sampleGhostAtTime([
      { t: 1, x: 10, y: 2, rotation: Math.PI - 0.1 },
      { t: 3, x: 30, y: 6, rotation: -Math.PI + 0.1 },
    ], 2)!;
    expect(pose.x).toBeCloseTo(20, 6);
    expect(pose.y).toBeCloseTo(4, 6);
    expect(Math.abs(pose.rotation)).toBeCloseTo(Math.PI, 6);
  });

  it('finds record time at player position', () => {
    const frames = [
      { t: 0, x: 0, y: 0, rotation: 0 },
      { t: 2, x: 20, y: 0, rotation: 0 },
      { t: 5, x: 50, y: 0, rotation: 0 },
    ];
    expect(ghostTimeAtX(frames, 35)).toBeCloseTo(3.5, 6);
    expect(ghostTimeAtX(frames, 55)).toBeNull();
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
