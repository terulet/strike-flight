# ONE MORE MILLIMETER — PLAYZONE 008

> Stop it as close to the edge as you can. Without falling.

A hold-and-release precision game built for phones. One input, one number, one
reason to play again: somebody is 0.3 mm ahead of you.

- **Zero dependencies.** No framework, no engine, no build step, no network calls.
- **Deterministic physics.** Same input, same result, at 30, 60 or 120 fps.
- **Real measurement.** Every millimetre shown comes out of the simulation.

---

## Play

```bash
cd one-more-millimeter
npm start                 # http-server on http://localhost:4321
```

Or just open `index.html` over any static server (ES modules need `http://`,
`file://` will not load them).

| Platform | Input |
|---|---|
| Phone / tablet | Touch and hold anywhere, release to throw |
| Desktop | Click and hold, or hold **Space** |

Tap anywhere on the result panel to go again.

---

## The rule

The number is **the distance between the object's balance point and the edge**.

That is deliberate, and it is the most important decision in the game:

- It is exactly *how much further it could have gone before falling*, which is what
  a person means by "how close was that".
- It lets the object hang spectacularly over the void and still score — a puck
  reading `0.42 mm` is physically sticking 2 cm out over nothing.
- **0.000 mm is unreachable.** At zero the object tips. Perfection is not a thing
  you can hit, only a thing you can approach (spec 37).

If the balance point crosses the edge, the object tips, falls, and the attempt is
worth nothing — but the game still tells you exactly how badly you blew it:
`0.17 mm PAST THE EDGE`. That number comes from re-running the same shot on an
imaginary endless platform, so it is measured, not invented.

### Result zones

| Distance | Zone |
|---|---|
| > 25 mm | SAFE |
| 10 – 25 mm | GOOD |
| 3 – 10 mm | GREAT |
| 1 – 3 mm | INSANE |
| 0.25 – 1 mm | ELITE |
| < 0.25 mm | LEGENDARY |

The better the score, the more decimals are shown: `14.2` → `3.48` → `0.72` → `0.083`.

---

## Modes

| Mode | Attempts | Point |
|---|---|---|
| **QUICK PLAY** | endless | Beat yourself, then beat whoever is above you |
| **3 SHOTS** | 3 | Best of three. Attempt 1 teaches, attempt 3 is *FINAL SHOT* |
| **DAILY** | 3 | Everybody in the world plays the identical setup today |
| **BEAT THE SCORE** | endless | One named rival, one number, `REVENGE` |

Rivals (SILVIA, MARC, ELOI, YOLI, KALI) are simulated for now, but their scores are
deterministic per challenge, and their ghost is drawn **where they actually stopped** —
a dashed line, a translucent copy of their object, and a floating label. You are not
chasing a number in a corner of the screen, you are chasing a thing on the platform.

---

## Architecture

```
one-more-millimeter/
  index.html            single page, no build step
  manifest.webmanifest  PWA
  sw.js                 offline shell
  src/
    config/             ALL balance lives here (GameConfig, PhysicsConfig, surfaces, objects, mutators)
    core/               loop, fixed-step timing, seeded RNG, math, event bus
    physics/            Simulation.js (deterministic), calibration.js (input mapping)
    game/               Game.js (state machine), Challenge, Scoring, Rivals, Ranking
    input/              one gesture, all the mobile hazards
    render/             Renderer (Canvas2D), Camera, Particles, shapes, ShareCard
    audio/              procedural WebAudio, haptics
    ui/                 DOM screens, i18n (EN/ES), number formatting
    storage/            versioned save with migrations
    telemetry/          decoupled event log
    debug/              ?debug=1 overlay
  tests/                node --test, no runner needed
  tools/                harness.mjs, qa.mjs, screenshots.mjs, icons.mjs
  docs/                 PHYSICS.md, ANTICHEAT.md, screenshots/
```

Rendering, audio, storage and telemetry are all injected into `Game`, so none of them
can quietly become load-bearing for gameplay. The simulation imports nothing but config.

---

## Physics

Full detail in [docs/PHYSICS.md](docs/PHYSICS.md). The short version:

- Fixed timestep of **240 Hz**, decoupled from rendering, no wall-clock anywhere in the sim.
- `a = -μ·g − (c·v)/m + g·sin(slope) + wind/m`, with the final stopping fraction of a
  step solved **analytically** — the last hundredth of a millimetre is the whole game,
  it does not get to land on a step boundary.
- Tipping is a real pivot about the edge; falling is free fall with spin.
- No RNG inside the step. Ever.

### The calibration idea

A design curve says where a shot *should* stop for a given power:

```
margin(p) = W · ((1−p)^γ − (1−pe)^γ)
```

Then the game asks the **real simulation**, by bisection, which launch speed produces
exactly that resting place. So:

- the physics stays honest and untouched — only the input mapping is solved for,
- every surface × object × mutator combination is automatically playable,
- surfaces express themselves through *how* the object travels (ice creeps for a second
  and a half, rubber is over in half that) instead of through accidental difficulty,
- a challenge is just `pe`, the power that lands exactly on the brink — expressed
  physically as **how far back the object starts**, which you can see before you throw.

Difficulty lands at **0.15 – 0.36 mm of result per millisecond of hold**, so ten
milliseconds of human slop costs one and a half to three and a half millimetres.

---

## Balance

`npm run harness` simulates thousands of shots by four player models (each with a
release jitter, a first-read bias, and a greed level that decides how close to the
brink they aim), then reports the distribution.

Current numbers, mixed pool:

| Player | Falls | Median | p90 | < 10 mm | < 1 mm |
|---|---|---|---|---|---|
| NEW | 4.8% | 26.0 mm | 62 mm | 14% | 0.8% |
| LEARNING | 5.5% | 12.5 mm | 31 mm | 38% | 2.1% |
| GOOD | 8.6% | 5.7 mm | 13.5 mm | 79% | 6.4% |
| EXPERT | 14.6% | 2.3 mm | 5.9 mm | 98% | 21% |

Attempt medians inside a 3-shot run: **12.7 → 7.3 → 5.9 mm**. The third shot really is
better than the first, which is the entire psychological point of THREE SHOTS.

The harness also sweeps power in fine steps looking for cliffs — travel must be strictly
monotonic in power and free of jumps, or a loss stops feeling like the player's fault.

---

## Debug

Append `?debug=1`:

- fps, timestep, time scale, phase, step count
- position, velocity, centre of mass, margin in mm, live overhang
- friction, drag per mass, hold time, launch speed, predicted margin
- challenge seed, `pe`, sensitivity in mm/ms, surface/object/mutator
- in-world overlays: bounding box, support area, edge line, centre of mass, velocity vector

Buttons: cycle surface, cycle object, nudge the rival target, replay the last shot,
disable FX, toggle overlays, wipe the save.

Other URL parameters: `?surface=ice`, `?object=phone`, `?mode=daily`, `?lang=es`,
`?challenge=<id>`, `?pe=0.7`.

---

## Tester build

This branch carries the tester layer: a name, links that inject real rival scores,
and a copyable telemetry report. Start at **[docs/TESTER_BUILD.md](docs/TESTER_BUILD.md)**
for the public URL, the one-time Pages setup, the link syntax and how to read the
results; **[docs/REAL_MOBILE_QA.md](docs/REAL_MOBILE_QA.md)** is the checklist for
real hardware, which no automated run can substitute for.

```
?tester=1&challenge=group-a&rival=Marc&score=1.42&target=Marc   hunt a real score
?tester=1&solo=1&challenge=group-a                              control arm
?report=1                                                       open the report
?nocache=1                                                      unstick a cached build
```

## Tests and tooling

```bash
npm test           # unit tests: physics, scoring, challenges, storage, tester layer
npm run harness    # balance report
npm run qa         # browser checks driving the real build in Chromium
npm run shots      # regenerate docs/screenshots
npm run icons      # regenerate app icons
npm run summarize  # aggregate tester reports pasted back over WhatsApp
```

`tools/qa.mjs` covers the things unit tests cannot: restart stability, listener leaks,
reload persistence, corrupted saves, backgrounding mid-hold, modals, language switching
and six viewports from iPhone SE to desktop.

---

## Decisions worth knowing

1. **The score measures the balance point, not the front face.** Everything else follows
   from that (see *The rule*).
2. **The input mapping is calibrated against the simulation, not hand-tuned per surface.**
   That is why all 25 surface/object combinations are balanced without a spreadsheet.
3. **Power is linear in time; the shaping lives in the landing window.** A linear meter is
   honest and readable; a curved meter would feel like the game was moving the goalposts.
4. **The reachable window is bounded.** Zero power always lands safely short, full power
   always falls. No challenge can be unwinnable and none can be trivial.
5. **Slow motion and camera zoom are driven by a prediction of the final margin**, computed
   by re-running the shot headlessly at release. It changes what you see, never what happens.
6. **A tilted platform is drawn tilted, wind is drawn as streaks.** A mutator you cannot
   see is just unfair RNG.
7. **The daily challenge always uses the full object pool.** Unlocks are a small reward for
   practice modes, never a competitive advantage.

---

## Not built yet

- No backend. Rivals, ranking and the daily are local and simulated — the interfaces
  (`fetchRivals`, `buildBoard`, the replay record) are shaped for a server drop-in.
- Replays are recorded but not played back as ghosts.
- Share cards render to a canvas and go through `navigator.share` when the platform
  supports files; there is no image export fallback yet.
- Five surfaces, five objects, four mutators (three enabled). Deliberately small.

## Next milestone

Put it in front of testers, instrument `attempts/session` and `retry rate`, and only
then decide whether the daily needs a real backend.
