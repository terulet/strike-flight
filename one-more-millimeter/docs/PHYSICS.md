# Physics, scoring and calibration

Everything in this document is implemented in `src/physics/` and `src/config/`.
No number below is hidden anywhere else.

## 1. Units and frame

The simulation works in SI: metres, seconds, kilograms, `g = 9.81 m/s²`.
The UI multiplies by 1000 and calls them millimetres. Travel runs along `+x`,
the platform edge is at `setup.edgeX`, the platform surface is `y = 0`.

`state.x` is the object's **geometric centre**. Its **balance point** (centre of
mass) is at `x + object.comOffset`.

## 2. Integration

```
dt        = 1/240 s   (fixed)
maxSteps  = 24 per rendered frame
maxFrame  = 0.25 s    (a longer frame is clamped, never integrated whole)
```

Per step, while sliding:

```
a = −μ_eff·g·cos(slope) − (c_surface · v)/mass + g·sin(slope) + wind/mass
μ_eff = surface.mu × object.frictionMul
```

Coulomb friction is mass independent (that is real), the viscous term is not
(heavier objects shrug off drag), so mass matters without breaking intuition.

**Stopping is solved analytically inside the step.** If the object would reverse
within `dt`, we compute `tStop = v / −a` and advance by `v·tStop + ½·a·tStop²`.
Without this, the final resting place would quantise to whatever a step boundary
happened to be — roughly 1.3e-5 m, or 0.013 mm. That is 130× our tie epsilon and
would have been the single biggest lie in the game.

Below `velocityEpsilon = 0.0006 m/s` the remaining creep (`v²/2a`, under a
micrometre) is added in one go and the object is declared at rest. It must then
stay at rest for `settleTime = 0.09 s` before the score is final (spec 85).

### Frame-rate independence

The physics accumulator consumes real time into fixed steps; the trajectory is a
pure function of the step index. `tests/physics.test.js` drives the identical shot
at 30, 60 and 120 fps plus a jittered 60 fps and asserts **bit-identical** margins
and step counts.

The only non-determinism in the whole game is the human hand: the same *hold time*
always produces the same score, and `Game.fireExact(power)` proves it.

## 3. Falling

When the balance point reaches the edge the object enters `TIPPING`: a rigid pivot
about the edge with

```
angAcc = g · lever · cos(angle) / ((w² + h²)/12 + r²)
lever  = max(comX − edgeX, minLever)
```

`minLever = 2.5 mm` exists because nothing balances on a mathematical point — an
object a nanometre past the brink still commits, and without the floor the teeter
would take literal seconds. Past `releaseAngle = 1.15 rad` (or `maxTipTime = 1.1 s`)
it lets go and free-falls for `0.85 s` with its spin, which is the window spec 88
asks for: long enough to hurt, short enough to retry.

## 4. What the number means

```
margin = edgeX − comX          (positive: still standing)
```

Reported as millimetres. See the README for why this is the balance point and not
the front face; the summary is that the failure boundary *is* the balance point, so
anything else would be measuring the wrong thing, and measuring the front face would
make "just barely overshoot" trivially better than "stop just short".

For a fall, the reported overshoot is the same shot re-simulated with the edge
removed:

```
overshoot = travel(no edge) − travelToEdge
```

Same integrator, same launch speed, no fabrication.

## 5. Calibration — the input mapping

The design curve, in `GameConfig.window`:

```
travel(p) = travelBase + W · (1 − (1−p)^γ)
margin(p) = travel(pe) − travel(p)
          = W · ((1−p)^γ − (1−pe)^γ)

W  = 0.45 m × surface.windowScale     reachable landing window
γ  = 1.6                              flattens the curve near the brink
pe ∈ [0.55, 0.82]                     the power that lands exactly on the brink
```

`solveLaunchSpeed()` bisects the **real simulation** for the speed that travels
exactly `travel(p)`, to a tolerance of 5e-8 m (0.00005 mm — five hundred times
finer than the best score anyone will ever post). A 13-point table is built per
challenge as a bisection hint; the shot the player actually takes is always solved
exactly at release (~1 ms).

Consequences:

- Every surface × object × mutator combination is playable by construction.
- Zero power always lands safely short; full power always falls. `tests/challenge.test.js`
  asserts this for 60 generated challenges.
- Surfaces stop being a balance problem and become a *feel* problem, which is what
  they should be: ice creeps for 1.5 s, rubber is done in 0.6 s.

### Why γ > 1

`dmargin/dp = −W·γ·(1−p)^(γ−1)`, so the curve flattens as power approaches the
brink: the closer you are to the edge, the more meter travel a millimetre costs.
Precision lives exactly where precision matters. Sensitivity at the brink:

```
mm per ms = W · γ · (1−pe)^(γ−1) · 1000 / chargeMs
```

which lands at 0.10 – 0.35 mm/ms across all surfaces and all `pe` (verified in
`tests/challenge.test.js` and reported by the harness).

### Why the power meter is linear in time

A curved meter shapes difficulty in a place the player cannot see. The landing
window curve does the same job in the place the player *is* looking — the platform.
Documented here because spec 52 asked for the decision, not just the result.

## 6. What the player can see

Everything that changes the physics is visible before the throw:

| Variable | How you read it |
|---|---|
| `pe` (required power) | how far back the object starts on the slab |
| surface | colour, texture, name in the HUD, sound of the slide |
| object | silhouette, name in the HUD |
| slope | the platform is drawn tilted |
| wind | streaks blowing across the screen |
| narrow | the slab is visibly thinner |

There is no hidden per-shot RNG anywhere. Two identical hold times on the same
challenge give the same result to the last significant digit.

## 7. Presentation is not physics

Slow motion, camera zoom, the loupe and the tension audio are all driven by a
*prediction* of the final margin, obtained by re-running the shot headlessly the
instant it is released. It changes what you see and hear. It never touches
`state.x`, `state.v` or the step count.
