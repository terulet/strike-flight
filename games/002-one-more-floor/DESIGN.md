# ONE MORE FLOOR — design notes

Decisions that were not obvious, and why they went the way they did. Written
for whoever picks this up next, including me in two weeks.

---

## 1. The control scheme

The requirement was one finger. The trap is that "one finger" usually means
"auto-run + tap to jump", which takes away the ability to *wait* — and this
game is made of timing puzzles. A player who cannot wait for the laser can
only die to it.

**What shipped:**

- **Tap = jump.** Fires on pointer *down*. Firing on release would add 60–120ms
  of latency to the game's most important verb; nothing is worth that.
- **Hold = brace.** While your finger is down, the bot brakes to a stop as soon
  as it is on the ground, and stays there until you let go. Waiting is
  therefore "keep your thumb down", which is the most natural thing a thumb
  can do.
- **Swipe ← / → = face that way.** Added late, after the boss fight proved the
  problem: with pure auto-run you can only turn around by hitting a wall. In a
  boss arena that means fleeing a slam can leave you unable to get back in
  time — a death caused by the control scheme, not by the player. Auto-run is
  still the default; this is an override you never need on floors 1–9.
- **Swipe ↓ = dive.** In the air, a fast slam that beats terminal velocity. On
  the ground, a skid stop — which is also the only way to stop *without* the
  little hop that pressing costs you, and matters under a low ceiling.

**Consequence worth knowing:** because a press always jumps, stopping while
running costs a small hop. That is the price of zero-latency jumping and it
reads as the bot planting its feet. The dive is the escape hatch when the hop
is not affordable.

### Jump shape

Fixed physics, measured (and locked by a test):

| | height | distance |
| --- | --- | --- |
| Full jump (held) | 71.7px | 75.8px |
| Shortest jump (instant release) | 38.8px | 56.0px |

**Every mandatory gap in the game is authored for the *short* jump.** Holding
is an advantage, never a requirement. This is what stops "I tapped too fast"
from being a death sentence.

---

## 2. The golden rule, made mechanical

"The player must feel the death was their fault" is not a vibe, it is a list
of properties. Each of these is enforced somewhere in code or tests:

| Rule | Where it lives |
| --- | --- |
| Nothing kills without telegraphing | every cyclic hazard has a wind-up phase; the generator floors telegraph times at a readable minimum |
| Nothing kills at spawn | 0.28s spawn safety window + a 12px clearance test |
| Nothing camps on the exit | test simulates 12s of every floor and checks the exit zone stays clear |
| Every floor is finishable | reachability graph + heuristic pilots in a headless sim |
| Collisions never bounce you off a ledge you cleared | corner correction: a horizontal hit while falling within 8px of a surface lifts you onto it |
| A late jump still works | 90ms coyote time |
| An early jump still works | 120ms input buffer |
| Your hitbox is smaller than you look | 3px inset horizontally, 2px vertically; hazards are inset too |
| A jump from a standstill is a full jump | jumping cancels braking and applies a full-speed impulse |
| Frame rate cannot change the puzzle | fixed 120Hz simulation step |

Two engine bugs and five layout faults were found by these checks during the
build; none of them were visible by playing floor 1.

---

## 3. Floors as data

A floor is a plain object: some pits, some entities, an optional hint. No
logic. Entities are looked up in a registry by `type`, so a new hazard is a
new module plus one `registerEntity()` call.

```js
{
  id: 'f21', name: 'NEW THING',
  hint: { text: 'TEACH ME', icon: 'tap' },
  pits: [{ x: 120, w: 90 }],
  entities: [
    { type: 'saw', x: 140, y: 376, r: 16,
      path: { type: 'line', to: { x: 220, y: 376 }, time: 2.2, ease: 'sine' } },
  ],
}
```

Coordinate cheatsheet (room is 360×420, y grows down):

```
floor surface   y = 402        playable x = 14 .. 346
standing player y = 372        player is 22 x 30
ceiling slab    y = -18 .. 0   hatch is cut above the exit
```

**Mirroring.** Every floor is authored left-to-right. Even-numbered floors are
mirrored at build time, so you leave floor 3 on the right and enter floor 4 on
the right. That is what makes the tower read as one continuous shaft. Mirroring
is a pure function over the definition — entity x, path endpoints, patrol
bounds, spike facing, door slots — and there is a test that mirroring twice is
the identity.

### Adding a hazard

1. New file in `src/floors/hazards/`, extend `Entity`.
2. Push AABBs into `this.solids` (standable) and shapes into `this.hazards`
   (lethal). Own them for life — never allocate in `update`.
3. Toggle `hazard.active` rather than adding and removing entries.
4. `registerEntity('yourType', (def, ctx) => new YourThing(def, ctx))`.
5. Add the import to `hazards/index.js`.
6. Give it a telegraph. Non-negotiable.

---

## 4. The mini boss

THE WARDEN is one legible cycle: it drifts toward you, locks on with a shadow
on the ground, slams, and is stuck for a moment with its core open on top.
Land on it. Three hits. Once hurt it adds a low sweep beam so that hiding in a
corner stops being free.

Three things had to change before it was fair, all found by simulation:

- **The wind-up was 0.55s** against a 92px body — exactly the time needed to
  walk out of its own width, with no margin. Now 0.72s.
- **It could corner you.** Its landing column is now clamped so a standing lane
  always remains on both sides.
- **Its crown blocked you from below**, and the arena's safe ledges did the
  same. Both are one-way platforms now: you jump up through them and land on
  top. The boss's shoulders are also harmless while it is stuck, so clipping
  the very thing you are aiming at is not a death.

Beating it is worth roughly 10 seconds of clean play. That felt right for a
floor-10 punctuation mark.

---

## 5. Difficulty and the endless climb

Floors 1–9 each teach exactly one thing and are almost entirely safe to fail.
Floor 10 is the first spectacle. Floors 11–19 recombine earlier verbs rather
than just running the same hazards faster — the design rule was "a new
sentence out of known words", not "+10% speed".

Past floor 20 the generator re-times authored layouts. It deliberately does
**not** invent geometry: a generator that places platforms eventually places
an impossible one, and one impossible floor costs you the player's trust for
good. Difficulty scales to a hard cap of 1.55×, telegraphs shrink far more
slowly than everything else and stop at a floor, and every tenth floor is a
boss so the climb keeps a shape.

---

## 6. Rendering and performance

- Fixed logical resolution of 360×780 (9:19.5), letterboxed and DPR-scaled.
  One coordinate system, every device.
- **No `shadowBlur` anywhere.** Glow is two additive passes, which is cheaper
  and more controllable. `shadowBlur` is the single easiest way to drop a
  mobile GPU to 30fps.
- Particles are preallocated typed arrays, drawn in two passes (normal and
  additive) to avoid composite-mode thrashing.
- All UI is drawn on the canvas: no DOM nodes to reflow, no layout fighting
  the safe area.
- Measured: 60fps sustained at 3× DPR with particles saturated; heap flat
  across 120 floor builds.

The room above the current one is built early and drawn behind a scrim. It
fills what would otherwise be dead screen space, makes the transition seamless,
and lets you read the next floor's rhythm before you get there.

---

## 7. Analytics seam

Nothing is sent anywhere. Every meaningful beat goes through one event bus:

```
game_start · floor_start · floor_complete · death · retry · new_record · boss_hit
```

`death` carries `{ floor, cause, floorsCleared }`, which is the payload the
first real question needs: *which floor kills people, and with what?* Adding a
provider later means subscribing to the bus — no gameplay code changes.

---

## 8. Parked deliberately

Not built, and each for a reason:

| | Why it waits |
| --- | --- |
| Game Center / leaderboards | needs a validated loop and an account story |
| Daily challenge | trivial with the seeded RNG (`seedFrom(dateInt)`), but pointless before retention exists |
| Skins, currency, IAP, ads | monetising an unproven loop teaches you nothing |
| Cloud save | local record is enough to answer "do I want to beat it" |
| Achievements, missions, seasons | retention scaffolding for a game people already replay |
| Sharing | worth building the moment deaths are funny enough to screenshot |
| Native iOS app, TestFlight | the web build is the fastest way to get it into hands |
| Backend, accounts, multiplayer | not on the path to the question being asked |

The seeded RNG, the event bus and the save manager are the three seams those
features will eventually plug into. They cost almost nothing now and would be
expensive to retrofit.

---

## 9. What to look at first when playing it

The prototype is a success only if it produces *one more go*. When you play,
the useful questions are:

1. Do you die and immediately tap RETRY, or do you put the phone down?
2. When you die, do you know why?
3. Which floor do you die on most, and is it teaching you anything?
4. Does clearing a floor feel like anything, or is it just a state change?
5. Is 20 floors long enough to reach a personal best worth beating?

If the answers are bad, the fix is the core — the controls, the pace, the
feedback — not more floors.
