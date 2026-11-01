# Code review, November 2026

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
