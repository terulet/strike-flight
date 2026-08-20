# ONE MORE FLOOR

A vertical, one-finger arcade prototype. You climb a tower. Every floor is one
short problem. You clear it, the camera rides up, the next one starts. It gets
harder. Eventually you die, and the only button on the screen says RETRY.

This is a **playable prototype**, not a product. It exists to answer one
question: *does this loop make you want one more go?*

---

## Run it

Requires Node 20+. There is nothing to install — no dependencies, no build step.

```bash
cd games/one-more-floor
npm start
```

Then open **http://localhost:5173/**.

On a desktop browser the play area is letterboxed to a 9:19.5 portrait phone.
To try it on a real device, open the same URL from a phone on the same network
(`http://<your-computer-ip>:5173/`) and add it to the home screen for a
fullscreen run.

`PORT=8080 npm start` if 5173 is taken.

### Tests

```bash
npm test
```

81 tests, ~0.8s, no dependencies (Node's built-in runner).

---

## Controls

One finger, four verbs. The bot runs on its own — you decide what it does.

| Input | Action |
| --- | --- |
| **Tap** | Jump. Fires on touch-down, so it is never late. Hold longer to jump higher. |
| **Hold** | Brace. Once you land you stop and stay put — this is how you wait for a laser or ride a platform. Release to run again. |
| **Swipe ← / →** | Face that way. The bot normally runs toward the exit; this overrides it. |
| **Swipe ↓** | Dive. In the air it is a fast slam; on the ground it is a skid stop. |

Keyboard (for desktop testing): `Space` / `↑` / `W` jump and hold, `↓` / `S`
dive, `←` `→` / `A` `D` turn.

---

## What is in it

**20 authored floors**, then an endless climb.

| # | Name | What it introduces |
| --- | --- | --- |
| 1 | FIRST STEPS | Tap to jump. Nothing on this floor can kill you. |
| 2 | BLADE | A sweeping saw. Teaches holding to wait. |
| 3 | FALLING FLOOR | Tiles that crumble under you. Teaches not stopping. |
| 4 | LASER GATE | Two beams on a cycle. Teaches reading a rhythm. |
| 5 | LIFTS | Two lifts over a pit. Teaches holding to ride. |
| 6 | TWO DOORS | Green lamp is the way up, red lamp is the trap. |
| 7 | SPIKES | Three clean jumps. |
| 8 | CRUSHER | Two crushers out of phase. Teaches swiping to turn. |
| 9 | RUSH | Saw, crumbling floor and a beam, back to back. |
| 10 | THE WARDEN | Mini boss. |
| 11 | BLADE RUN | An orbiting blade over a crumbling bridge. |
| 12 | GRID | A shuttle under a beam and a gate at the end. |
| 13 | HEAT | Flame vents and spikes. |
| 14 | PRESSURE | The door choice, with a crusher in the way. |
| 15 | PATROL | Drones. You land on them. |
| 16 | SKY LIFTS | Lifts under a beam that punishes over-jumping. |
| 17 | GAUNTLET | Crushers over a crumbling bridge. |
| 18 | INFERNO | Vents guard the crossing, a blade guards the air. |
| 19 | FINAL RUSH | Everything, quickly. |
| 20 | WARDEN MK II | Harder boss, tighter arena. |

**Beyond 20** the climb continues forever. Generated floors re-time authored
layouts rather than inventing geometry (an invented layout is eventually an
impossible one), the difficulty scale is capped, telegraphs never shrink below
a readable minimum, and a boss lands on every tenth floor. Layout choice is
seeded from the floor number, so floor 37 is always the same floor 37.

**Records** are stored locally (`localStorage`) and survive closing the tab.

---

## Debug tools

Press **`` ` ``** or **F1**, or open `?debug=1`, or long-press the top-left
corner on a touch device.

| Key | |
| --- | --- |
| `` ` `` / F1 | toggle the panel |
| `H` | hitboxes (solids, hazards, and the player's forgiving box) |
| `I` | invincibility |
| `N` / `P` | next / previous floor |
| `R` | restart the run |
| `[` `]` | time scale |
| `M` | mute |
| digits then `G` | jump to a floor number |

`?floor=14` starts a run on that floor.

---

## Architecture

Plain ES modules, Canvas2D, no framework, no build step, no dependencies.

```
index.html          shell: one canvas, one safe-area probe
styles.css          letterboxing and touch behaviour
tools/serve.mjs     zero-dependency static server
src/
  config.js         every tunable that affects feel
  main.js           entry point: boot the game, start the loop
  core/
    loop.js         fixed 120Hz timestep, decoupled render
    state.js        game states + the only legal transitions
    time.js         time scale and hit stop
    save.js         local record, injectable storage
    events.js       event bus (the analytics seam)
    rng.js          seeded PRNG — no Math.random in gameplay
    math.js         helpers
  input/input.js    one-finger verbs: tap, hold, swipe
  game/
    game.js         orchestration: run lifecycle, deaths, transitions
    player.js       physics, game feel, rendering
  floors/
    registry.js     entity type registry
    entity.js       base entity, solids and hazard shapes
    path.js         declarative movement paths
    floorRuntime.js a live room: shell, entities, collisions, drawing
    definitions.js  the 20 floors, as pure data
    generator.js    endless floors
    floorManager.js which floor is next and how it is oriented
    hazards/        one module per hazard type
  systems/
    viewport.js     fixed logical resolution + safe areas
    gfx.js          drawing primitives
    camera.js       tower framing, panning, shake
    collision.js    AABB resolution + corner correction
    particles.js    pooled, zero-allocation
    audio.js        procedural WebAudio cues
    ui.js           title, HUD, result — all on the canvas
    debug.js        internal tools
test/               node --test
```

**Floors are data.** Every element in a floor definition is looked up in a
registry by `type`, so adding `FloorGravity` later is a new module plus one
`registerEntity()` call — never an edit to a switch statement.

**Rooms are stacked in world space.** Ascending a floor is a camera pan, not a
scene load. Every floor is authored left-to-right and mirrored automatically
when entered from the right, so the climb zig-zags without anything being
authored twice.

**Nothing allocates per frame.** Entities own their solids and hazard shapes
for their whole life; particles live in preallocated typed arrays.

---

## The rules the content is held to

These are enforced by tests, not by good intentions:

- **The exit is always reachable.** A graph of standable surfaces, with edges
  derived from the real jump arc, is checked from spawn to exit on every floor
  up to 60.
- **Every floor can actually be finished.** Seeded heuristic pilots play each
  floor in a headless simulation until one reaches the exit.
- **Nothing lethal ever crosses the way out**, at any point in any cycle.
- **Nothing lethal starts on top of you.** Twelve pixels of clearance around
  the spawn, plus a spawn safety window.
- **Every mandatory gap fits the shortest possible jump**, so a nervous quick
  tap is never fatal.
- **Telegraphs stay readable however fast the climb gets.**
- **Floor 1 cannot kill you at all.**

---

## Known limitations

- **Untested on a real phone.** It has been verified in Chromium at six
  viewport sizes including phone shapes, and the touch input is standard
  pointer events, but nobody has held it in their hand yet. Safe-area insets
  are read and applied but have not been seen against a real notch.
- **Audio is procedural placeholder.** Correct shape, cheap character.
- **Art is placeholder.** Rectangles with a good glow.
- **No haptics, no pause menu, no settings screen** beyond mute in the debug
  panel.
- The heuristic pilots that prove floors are finishable are not good players;
  a floor they cannot finish may still be fine, and a floor they can finish
  may still be no fun. They catch impossible, not boring.

## Deliberately not built

No monetisation, ads, IAP, accounts, backend, cloud save, leaderboards, Game
Center, achievements, missions, daily challenges, skins, currency, sharing,
multiplayer, or a native iOS app. Those all come after the prototype earns
them. See `DESIGN.md` for the backlog and why each item is parked.
