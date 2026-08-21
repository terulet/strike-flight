# Score validation (preparation, not implementation)

There is no backend yet, so nothing here is enforced. The point is that the client
already records enough to make a submitted score checkable later, instead of
storing `score = 0.001` and hoping.

## What is stored with every shot

`Game._saveReplay()` writes, per attempt (last 20 kept, `save.replays`):

```json
{
  "v": 1,
  "challengeId": "daily-2026-08-21",
  "physics": "1.0.0",
  "game": "1.0.0",
  "objectId": "puck",
  "surfaceId": "wood",
  "mutatorId": "none",
  "pe": 0.684312,
  "power": 0.681204,
  "holdMs": 988,
  "v0": 1.372145,
  "marginM": 0.000418322,
  "fell": false,
  "at": 1755731400000
}
```

## Why that is enough

The simulation is deterministic and depends on nothing but config plus the challenge
id. A server holding the same `src/physics` and `src/config` can:

1. Rebuild the challenge from `challengeId` alone — object, surface, mutator, `pe`,
   start position are all derived from the seed (`createChallenge`).
2. Re-solve the launch speed from `power` (`launchSpeedFor`) and compare with `v0`.
3. Re-run `simulateShot` and compare with `marginM` and `fell`.
4. Reject anything outside a tight tolerance (1e-7 m is already 1000× finer than the
   display).

That is a full replay check, not a plausibility check. The submitted number is
either reproducible or it is fabricated.

## Additional signals worth checking server side

- `holdMs` must be consistent with `power` for the build's `chargeMs`
  (`power ≈ holdMs / chargeMs`, clamped at 1).
- Physics and game versions must match a known release; a mismatch means re-simulate
  with the *client's* version or reject.
- Wall-clock gaps between attempts on the same daily (a bot posts faster than a thumb).
- Distribution checks per account: real players fall 5–15% of the time and their first
  attempt on a challenge is measurably worse than their third.

## What is deliberately not done yet

- No signing, no nonce, no server-issued challenge token. A determined attacker can
  still craft a valid replay by running the simulation themselves — which is fine,
  because the honest fix is a server-issued challenge plus rate limiting, and that
  belongs with the backend, not with a prototype.
- No obfuscation. It would buy nothing here.
