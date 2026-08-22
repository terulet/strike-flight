# Tester build — how to run the round

Everything here is local: no backend, no accounts, no analytics service. A tester
plays from a link and pastes a report back over WhatsApp.

---

## 1. Public URL

```
https://terulet.github.io/strike-flight/one-more-millimeter/
```

The Pages root (`https://terulet.github.io/strike-flight/`) redirects to the game,
so a trimmed link still works. **Flight Strike is not published** by this workflow —
only `one-more-millimeter/` is uploaded.

## 2. One-time setup (only you can do this)

1. GitHub → the `strike-flight` repo → **Settings** → **Pages**
2. **Build and deployment → Source** → select **GitHub Actions**
3. That's it. There is no branch to pick — the workflow owns the deployment.

Then either push to `claude/playzone-008-millimeter-obowtc`, or go to **Actions →
Deploy tester build (Pages) → Run workflow**.

Notes:
- If the repo is **private**, Pages needs a paid plan. If Pages is unavailable the
  deploy step fails with a Pages API error — that is the symptom of step 2 missing.
- The first deploy also creates a `github-pages` environment. If your org requires
  environment approvals, the deploy job will wait for one.
- The workflow runs the 47 unit tests first. A red test never reaches a phone.

## 3. Challenge links

One parser handles every parameter (`src/tester/LaunchConfig.js`), and every value
is sanitised, range-checked and length-capped. Anything invalid is ignored and the
game starts normally.

| Parameter | Meaning | Example |
|---|---|---|
| `challenge` | Pins the setup. Same id = identical surface, object, launch distance, everywhere. | `challenge=whatsapp01` |
| `rival` + `score` | One real rival, in millimetres. | `rival=Marc&score=1.42` |
| `rivals` | Several at once, `Name:mm` separated by commas (max 6). | `rivals=Marc:1.42,Yoli:0.88` |
| `target` | Which of them you are hunting. Defaults to the closest one ahead. | `target=Marc` |
| `solo` | No rivals at all — the control arm of the test. | `solo=1` |
| `mode` | `quick`, `three`, `daily`, `beat`. | `mode=three` |
| `name` | Pre-fills the tester's name, skipping onboarding. | `name=Eloi` |
| `tester` | Marks the session as a tester session. Implied by `rival`/`rivals`/`solo`. | `tester=1` |
| `report` | Opens the test report straight away. | `report=1` |
| `lang` | `en` or `es`. | `lang=es` |
| `debug` | Debug overlay. | `debug=1` |
| `nocache` | Unregisters the service worker and clears caches, then loads fresh. | `nocache=1` |

### Real links

Test A — solo (control):

```
https://terulet.github.io/strike-flight/one-more-millimeter/?tester=1&solo=1&challenge=group-a
```

Test B — hunting Marc's real 1.42 mm:

```
https://terulet.github.io/strike-flight/one-more-millimeter/?tester=1&challenge=group-a&rival=Marc&score=1.42&target=Marc
```

Test C — revenge, two links from the same challenge:

```
# to Eloi
.../one-more-millimeter/?tester=1&challenge=group-a&rival=Marc&score=1.42&target=Marc
# to Marc
.../one-more-millimeter/?tester=1&challenge=group-a&rival=Eloi&score=0.84&target=Eloi
```

Three rivals at once:

```
.../one-more-millimeter/?tester=1&challenge=group-a&rivals=Marc:1.42,Yoli:0.88,Silvia:0.31&target=Yoli
```

**Keep `challenge=` the same for everyone you want to compare.** It pins the object,
the surface and the launch distance, so two testers' millimetres mean the same thing.

## 4. Rivals without regenerating links

`tester-challenges.json`, next to `index.html`:

```json
{
  "version": 1,
  "challenges": {
    "group-a": {
      "label": "GROUP A",
      "target": "Marc",
      "rivals": [
        { "name": "Marc", "scoreMm": 1.42 },
        { "name": "Yoli", "scoreMm": 0.88 }
      ]
    }
  }
}
```

Edit, commit, push: the workflow redeploys and everyone on `?challenge=group-a`
picks the new numbers up on their next load. A link always wins over this file, so
a freshly generated WhatsApp link is never overridden by a stale commit.

If the file is missing, malformed, slow or blocked, the game starts anyway with its
simulated rivals.

## 5. Precision

Scores keep full precision internally: `score=0.4388` stays `0.4388 mm`. The UI
shows adaptive decimals (`0.44`), and the ranking adds digits when two entries would
otherwise print the same number.

## 6. The test report

**Opening it**
- `?report=1` on the URL (what you use when reviewing), or
- **Settings → TEST REPORT** (what you tell a tester)

**Copying it**
- `COPY TEST REPORT` — human summary + full JSON. Clipboard API, and if the browser
  refuses (older iOS Safari), a selectable text box appears instead so the report is
  never lost.
- `SHARE` — only appears when `navigator.share` exists. Optional.
- `COPY BUG INFO` — short reproducible context: version, player, device, viewport,
  challenge, last attempt, last event, URL.
- `CLEAR TEST DATA` — wipes telemetry only, twice-tap to confirm. **It never touches
  the game save**, so nobody loses a record.

Ask the tester for the whole paste. The aggregator reads it even with chat noise
around it.

## 7. Reading the results

```bash
node tools/summarize-tester-reports.mjs reports/          # a folder of pastes
cat marc.txt | node tools/summarize-tester-reports.mjs    # one paste
```

Prints attempts/session, fall rate, retry rate per cause, and a per-player table,
split into **SOLO** and **RIVAL**. Corrupt or empty inputs are listed under DATA
PROBLEMS rather than being folded into the averages.

## 8. The flow, end to end

1. Send Marc the solo link (`?tester=1&solo=1&challenge=group-a`).
2. Marc plays. Instruction, in full: *"déjalo lo más cerca posible del borde sin que caiga"*.
3. Marc opens **Settings → TEST REPORT → COPY TEST REPORT** and pastes it to you.
4. Read his best from the paste (`BEST: 0.84 mm`).
5. Send Eloi the rival link with Marc's real number:
   `?tester=1&challenge=group-a&rival=Marc&score=0.84&target=Marc`
6. Eloi plays and pastes his report.
7. Compare `RETRY AFTER RIVAL LOSS` against `RETRY AFTER PERSONAL MISS`.
8. Send Marc a new link with Eloi's score as the target and see whether he comes back.

Step 8 is the one that matters most: a second session triggered by somebody taking
your record is worth more than a long first session.

## 9. What is stored, and where

| Key | Contents | Cap |
|---|---|---|
| `omm.save.v1` | settings, stats, records, unlocks, last 20 replays, `player {id, name, createdAt}` | small |
| `omm.telemetry.v1` | last 25 sessions: events (500/session), attempts (250/session), counters | a few hundred KB worst case |

`playerId` is a locally generated UUID. Nothing is uploaded anywhere.

**Not collected:** location, contacts, IP, email, advertising identifiers, clipboard
contents, or anything from outside the game. The report does include a truncated
user-agent string, screen size and device pixel ratio — that is what makes the QA
matrix readable, and it is listed here so it is not a surprise.

## 10. Cache and updates

The service worker is deliberately not cache-first for everything:

- **Navigations** are network-first, so a new deploy is picked up on the next load.
- **Static assets** are stale-while-revalidate: instant start, fresh next time.
- **`build-info.json` and `tester-challenges.json`** are never cached.
- The cache name carries a version (`omm-v1.1.0-tester`); activating a new worker
  deletes every older cache.
- A new worker takes control immediately and the page reloads **once** — but only
  when a controller already existed, so a first visit never reloads.
- Stuck anyway? Send them `?nocache=1`: it unregisters the worker, deletes the
  caches and loads fresh.

When you ship a new build during the round, bump `VERSION` in `sw.js`. The commit
SHA in the report tells you which build each tester actually played.

## 11. Post-test questions

Ask three. Nothing else:

1. ¿Harías otra partida mañana?
2. ¿Te picó superar a alguien?
3. ¿Qué fue lo que más te molestó?

Optional if the conversation is going well:

4. ¿Entendiste qué hacer sin que te lo explicaran?
5. ¿Qué sentiste cuando el objeto quedó muy cerca?

Do not tell them what the game is trying to do. The whole point is to find out
whether it does it on its own.
