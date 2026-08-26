import { describe, expect, it } from 'vitest';
import { classifyLanding } from '../src/gameplay/LandingClassifier';
import { LandingConfig, CrashConfig } from '../src/config/GameConfig';

describe('classifyLanding', () => {
  it('classifies a synthetic perfect landing as PERFECT', () => {
    const quality = classifyLanding({
      angleDiff: 0.01,
      verticalSpeed: 1.5,
      contactTimingGap: 0.01,
      angularVelocity: 0.2,
    });
    expect(quality).toBe('PERFECT');
  });

  it('classifies a landing with a huge angle mismatch as CRASH', () => {
    const quality = classifyLanding({
      angleDiff: CrashConfig.crashLandingAngle + 0.2,
      verticalSpeed: 2,
      contactTimingGap: 0.01,
      angularVelocity: 0.2,
    });
    expect(quality).toBe('CRASH');
  });

  it('classifies a landing with excessive impact speed as CRASH', () => {
    const quality = classifyLanding({
      angleDiff: 0.05,
      verticalSpeed: CrashConfig.crashImpactSpeed + 5,
      contactTimingGap: 0.01,
      angularVelocity: 0.1,
    });
    expect(quality).toBe('CRASH');
  });

  it('classifies a landing that is bad-but-not-crash as BAD', () => {
    const quality = classifyLanding({
      angleDiff: (LandingConfig.bad.angle + LandingConfig.rough.angle) / 2,
      verticalSpeed: (LandingConfig.bad.verticalSpeed + LandingConfig.rough.verticalSpeed) / 2,
      contactTimingGap: 0.01,
      angularVelocity: 0.1,
    });
    expect(quality).toBe('BAD');
  });

  it('classifies a clean but not-quite-perfect landing as GOOD', () => {
    const quality = classifyLanding({
      angleDiff: (LandingConfig.perfect.angle + LandingConfig.good.angle) / 2,
      verticalSpeed: 5,
      contactTimingGap: 0.08,
      angularVelocity: 0.3,
    });
    expect(quality).toBe('GOOD');
  });
});
