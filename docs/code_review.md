# Code review, November 2026

Two passes: the first (below the line) merged the shared time helpers and applied Meta's style; the second read the
whole codebase for bugs and duplicate code.

## Second pass: the whole codebase

Five reviews ran side by side: A2A and agents; members, feed and venues; core, safety and infrastructure; the server,
club, match, media and voice; and one for duplicate code only. About 55 findings came back. Fixed:

- **Privacy.** Signed-in members no longer share one conversation memory (each is keyed by their own id, also on the
  voice agent). A private club's posts, media, comments and likes are its members' only; entering a private
  club's tournament needs membership; a tournament draw shows first names, to members only. Venue notes and past
  games are no longer listed under the privacy threshold, and the thresholds read the noisy counts.
- **Data safety.** A wrong data key stops the gateway instead of starting the stores empty or wiping the keyring;
  AES-GCM tags must be 16 bytes; a conversation record that won't open is never overwritten; a forgotten person's
  queued conversation write is dropped.
- **Access.** Requests passed on by the public proxy no longer count as this machine (A2A without a token, and the
  voice agent); an agent can't commit its person (post, start, cancel, mark who came) with delegation off; the
  recap test hook is the maintainer's; bad signatures no longer count against an agent; a member sees only their
  own agents' refusals.
- **A2A.** A hold can't be longer than the game agreed; a message id is answered per agent; the disclosure budget is
  per scoped asker; impossible dates are refused; a counter with no free court no longer crashes a talk; the critic's
  fairness check reads the trips; nonces are written at once.
- **Robustness.** Request bodies are capped (8 MB, 1 MB for the webhook); Python workers that fail to start or close
  their pipe no longer crash the gateway; speech and reel jobs time out; the IPv6 rate-limit key uses the real /64;
  the proxy's session cache, MCP sessions and Overpass sport names are bounded; static files stay inside the web
  folder; double bookings of a huddle and double cancels are refused; a venue's signed quote only counts for the same
  ask and never under the floor; posters are capped at 20 new pictures a day; local dates instead of UTC dates.
- **The loop.** The base branch defaults to `main`; bare file names in never.md are protected wherever they are; an
  added line starting `++` is scanned; the canary's member id doesn't change when `LOOP_SECRET` is set.

Duplicates merged in this pass: `DAY`, `LONG`, `dateOf` and `monday` into `core/time.js` (12 copies); the haversine
distance into `core/geo.js` (3); the Elo expected score into `club/skill.js` (3); SHA-256 hex into `core/crypt.js`
(3); `norm` and the sports list (2 each); and on the web, `first`, `initials`, `plural` and `cap` into
`web/src/text.js` (27 copies).

The five items left after the second pass, done since:

- **One JSON store helper.** `jsonStore(file, empty, fill)` in `core/jsonfile.js` replaces the hand-written
  `data()`/`save()` pair in 13 store modules (members, clubs, huddles, trust, taste, needs, prefs, beliefs, privacy,
  venue notes, the critic, builds, match settings). Each re-reads when its path changes and can be reset with `set()`.
  The few stores read once at start (players, the Autopilot, asks, play, memory) keep their own line.
- **One Python worker client.** `core/worker.js` serves the embedder, Prompt Guard, the goal check, speech out and
  speech in. In order or by id, with a ready line where a model loads first. A timed-out request keeps its place, so a
  late answer is never handed to the next request (the old embedder and guard queues could do that). A worker that
  can't start or dies fails only its own requests, never those of the one started after it.
- **The booking race.** `club/play.js` books one game at a time: the checks, the court's hold and the booking row
  happen with no other booking in between, even across the await on a peer gateway's confirmation.
- **Consent key files.** An id with characters a file name can't hold gets its plain part plus a hash, so `bob@clubA`
  and `bob_clubA` never share a key. Checking a signature never creates a key.
- **Mandates.** A peer's booking mandate is checked, then used only once the booking is made. A hold that lapsed
  refuses the booking and leaves the mandate usable for a retry. Check, book and use happen in one synchronous step,
  so two copies of one mandate can't both get through.

---


A short pass over `agent/` and `web/src/`: find modules and helpers that exist twice, keep one copy, and format the
code the way Meta's own JavaScript projects do.

## Style: Meta's Prettier settings

React, Jest and Metro share one Prettier setup. `.prettierrc.json` at the repository root is React's:
single quotes, no spaces inside braces, `>` of a multi-line JSX tag on the last line, trailing commas, 80 columns and
no parentheses around a single arrow argument. All 364 source and test files were formatted with it
(`npm run format` in `agent/`). Before, many lines ran past 200 characters; now none of the code does. Comments keep
their own width. Line count went from 49,432 to 132,655. That is the same code, wrapped.

## Duplicates removed

| Helper | Copies | Now |
|---|---|---|
| `DAYS` (Sun to Sat) | 10 | `agent/src/core/time.js` |
| `ymd` (a local date as YYYY-MM-DD) | 8 | `core/time.js` |
| `toMin` ("19:30" to minutes) | 7 | `core/time.js` |
| `first` (a first name) | 6 | `core/time.js` |
| `hm` (minutes to "19:30") | 3 | `core/time.js` |
| `freeAt` (free on a weekday for a stretch) | 2 (`ask.js`, `autopilot.js`) | `club/play.js` helpers, as `freeOn` |

Modules that exported one of these (`club/life.js`, `members/taste.js`, `members/calendar.js`,
`memory/memory_update.js`, `a2a/talk.js`) re-export it, so no caller changed. These stay apart on purpose:
`body/context.js`'s `ymd` is the UTC date, `agents/tiny.js`'s `DAYS` starts on Monday, and `club/life.js`'s `hm` takes
a Date.

## Left as it is, and why

- **Two people stores.** `core/store.js` keeps Messenger players and `members/members.js` keeps signed-in members.
  Merging them means migrating live data, so it waits for the move to a database (README, Limitations).
- **Four views of what a person likes.** `memory/prefs.js` (dated records), `prefs_of.js` (reads them from what is
  stored), `beliefs.js` (weekly abstractions) and `members/taste.js` (weights learned from answers). `prefs.js` already
  settles them into one answer. `taste.js`, at 897 lines, is the file most worth splitting next.
- **The same file-store pattern 29 times.** `data()` loads a JSON file once and `save()` writes it. A helper
  `store(file, empty)` in `core/jsonfile.js` could replace about 4 lines in each. That is a mechanical next step, not
  done here.

## Checks

`npm test`: 458 tests. All pass except the 2 that fail only on Windows (the video composer needs the GPU server; the
builder's write test uses POSIX paths). The web build passes.
