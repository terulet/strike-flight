# Real hardware QA

**Nothing in this file has been run.** The build has only been exercised in headless
Chromium on Linux — 47 unit tests and 27 automated browser checks across six
viewports. That catches logic and layout. It cannot catch iOS audio unlock, real
haptics, Safari's clipboard rules, PWA installation, notch insets, or what happens
when a real phone call interrupts a hold.

This is the protocol for the person holding the phone. Print it, or keep it open in
a second tab, and fill in the tables.

---

## Before you start

1. Deploy is green (Actions → Deploy tester build).
2. Open `.../one-more-millimeter/?debug=1` once on a desktop to confirm the build
   SHA matches what you expect.
3. On each device, note the exact model and OS version — the report captures a
   truncated user-agent, but the model name is easier to read back.

## Device matrix

| # | Device | OS | Browser | Mode | Tester | Date | Result |
|---|---|---|---|---|---|---|---|
| 1 | iPhone (notch / Dynamic Island) | iOS __ | Safari | browser tab | | | |
| 2 | same iPhone | iOS __ | Safari | installed PWA | | | |
| 3 | iPhone (small, SE-class) | iOS __ | Safari | browser tab | | | |
| 4 | Android phone | Android __ | Chrome | browser tab | | | |
| 5 | same Android | Android __ | Chrome | installed PWA | | | |
| 6 | Android (other vendor) | Android __ | Chrome | browser tab | | | |

At minimum: one iPhone with a notch or Dynamic Island, one Android, and one of them
installed as a PWA.

## Checklist per device

Copy this block per device and mark each line `ok` / `FAIL: what happened`.

```
DEVICE:                                   OS:              BROWSER:
BUILD SHA (Settings -> TEST REPORT):

LOADING
[ ] URL opens, no white screen
[ ] no visible layout jump after the first second
[ ] PLAY reachable without scrolling

ONBOARDING
[ ] name prompt appears on a fresh install
[ ] keyboard opens, PLAY enables once a name is typed
[ ] name persists after a reload
[ ] the keyboard does not leave the layout broken when it closes

INPUT
[ ] hold anywhere starts the charge
[ ] release throws
[ ] the page does not scroll while holding
[ ] no accidental zoom on double tap
[ ] no text selection / magnifier on long press
[ ] a second finger does not fire a second shot
[ ] swiping from the screen edge (back gesture) does not fire a shot

PHYSICS AND FEEL
[ ] the slide looks smooth (no visible stutter)
[ ] slow motion triggers only on very close shots
[ ] a fall looks like a fall, not a teleport
[ ] the result number appears within about a second of the object stopping

RIVAL
[ ] the rival from the link appears in the top chip with the right name and score
[ ] the rival ghost line and silhouette are on the platform
[ ] beating them says BEATEN, losing says STILL LEADS with a REVENGE button

AUDIO
[ ] silent until the first touch, then audible (iOS unlock)
[ ] sliding sound tracks the object's speed
[ ] audio still works after 10 retries
[ ] audio still works after backgrounding and returning
[ ] the silent switch / volume behaves sanely (iOS)

HAPTICS   (iOS Safari has no navigator.vibrate: "not supported" is a PASS)
[ ] release buzz
[ ] fall buzz
[ ] record buzz
[ ] nothing buzzes when Vibration is off in Settings

LIFECYCLE
[ ] backgrounding mid-hold does NOT fire a shot on return
[ ] returning from background resumes without a stuck state
[ ] rotating to landscape and back keeps the game playable
[ ] locking and unlocking the phone mid-shot does not corrupt the result
[ ] an incoming call or notification banner does not break the run

SAFE AREAS
[ ] the top HUD clears the notch / Dynamic Island
[ ] the power meter clears the home indicator
[ ] nothing is cut off in landscape

STORAGE
[ ] reload keeps the name, the record and the stats
[ ] a second session appears in the report after a reload

REPORT
[ ] Settings -> TEST REPORT opens
[ ] the numbers look plausible against what you just played
[ ] COPY TEST REPORT copies (or shows the selectable fallback box)
[ ] the paste survives WhatsApp intact
[ ] COPY BUG INFO copies
[ ] CLEAR TEST DATA clears telemetry and leaves the record alone

PWA (only for the installed rows)
[ ] Add to Home Screen offers the right name and icon
[ ] launches standalone, no browser chrome
[ ] safe areas still correct standalone
[ ] works with the phone in airplane mode after one online load

UPDATES
[ ] after a new deploy, a reload picks the new build up (check the SHA)
[ ] ?nocache=1 recovers a device that is stuck on an old build
```

## Known risks to watch for specifically

| Risk | Why | What a failure looks like |
|---|---|---|
| iOS audio unlock | WebAudio needs a real gesture; the context can also be suspended on return from background | silence after backgrounding, or from the very first shot |
| iOS clipboard | Safari restricts `navigator.clipboard` outside secure/user-gesture contexts | COPY does nothing — the fallback text box should appear instead |
| `navigator.vibrate` | not implemented in iOS Safari at all | no haptics on iPhone. Expected, not a bug |
| Android back gesture | an edge swipe can be read as a pointer down/up | a shot fires when the tester meant to go back |
| Dynamic Island | `env(safe-area-inset-top)` differs from older notches | the target chip sits under the island |
| PWA start_url under a subpath | relative paths in the manifest | installed app opens a 404 |
| Low-end Android | slower GPU, more thermal throttling | frame stutter during the zoom, which would hurt the feel most where it matters |

## If something fails

1. On the device: **Settings → TEST REPORT → COPY BUG INFO**, paste it into the
   issue or the chat.
2. Note what you were doing in one sentence.
3. If it is reproducible, add `?debug=1` to the URL and screenshot the overlay — it
   carries the seed, the power, the velocity and the exact state.

The seed plus the hold time is enough to reproduce any shot exactly on any machine,
because the simulation is deterministic.
