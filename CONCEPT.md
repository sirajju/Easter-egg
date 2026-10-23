# NIGHTSHIFT — an office-wide Easter egg hunt

> Somebody on the night shift never logged out.
> Their session is still open. Their process is still running.
> It has been hiding things in our systems ever since.

This document explores the idea before (and alongside) the build. The working
game lives next to it in this folder; see `README.md` to run it.

---

## 1. The pitch in one paragraph

NIGHTSHIFT is a mystery that lives inside the office's digital world. A
forgotten maintenance process called **ARCHIE** (the Archivist) has been
quietly filing away "evidence" — odd log lines, impossible tickets, a commit
nobody wrote, a meeting that never happened. Employees join with nothing more
than a display name, pick their desk (department), and start opening case
files. Every solved case gives points, a fragment of ARCHIE's story, and
sometimes unlocks something nobody knew existed. A live leaderboard and a
"wire" feed of discoveries keep the whole office aware that someone, somewhere,
just found something.

The goal is not "a quiz with a scoreboard". It is the feeling that the
ordinary tools we use every day might be hiding something, and that a
colleague two desks away might be one step ahead.

---

## 2. Design pillars

1. **Curiosity first, points second.** Every screen should raise a question.
   Locked cases show partial titles (`T██ C█FFEE ███HINE`) so people wonder.
2. **Everyone can play.** Each department has its own desk of cases, and the
   "Common Room" desk needs no technical knowledge at all.
3. **The office is one team and many rivals.** Individual leaderboard,
   department war, and collaborative cases that *need* several departments.
4. **The answers live on the server.** The browser only ever receives the
   case text. Inspecting the frontend reveals nothing that solves a puzzle.
5. **It grows.** A new case is one file dropped into `content/challenges/`.
   No levels, no fixed count, no code change.
6. **Small doses.** Cases take 2–15 minutes. It should fit in a coffee break,
   not compete with real work.

---

## 3. The story layer (ARCHIE)

The story gives the hunt a reason to exist and gives every solve a reward
beyond points.

- **Who is ARCHIE?** A maintenance daemon written long ago by a night-shift
  sysadmin who signed their commits only as `m.`. When `m.` left, the process
  kept running, archiving "anomalies" so someone would eventually notice.
- **Lore fragments.** Every solved case returns one line of `m.`'s last
  message. The lines arrive out of order, so players compare notes in the
  kitchen to piece the story together.
- **Letter fragments.** Some cases also stamp a single letter on the player's
  case file. Collect enough and **The Archivist's Riddle** (a meta-case)
  appears; its answer is spelled by those letters.
- **ARCHIE has moods.** Wrong answers get personality, not just "incorrect":
  near-misses get a nudge ("Close. ARCHIE files that under 'almost'."), spam
  gets a sulk ("ARCHIE is tired of your guesses. Come back in a few
  minutes."), and the night-shift hours make ARCHIE chattier.

---

## 4. Desks (departments)

| Desk | Who it's for | Flavour of cases |
|---|---|---|
| **Engineering** | Developers | Fake git logs, predict-the-output snippets, regex séances, a stack trace with something encoded in it |
| **Support** | Support engineers | Impossible tickets, customers in the wrong time zone, escalation chains that loop back on themselves |
| **QA** | Testers | Mock forms with planted bugs, flaky test logs, "find the one wrong number" reports |
| **Ops** | Infra / on-call | Mock incidents and postmortems, a 3 a.m. pager timeline, a cron job that runs on a day that does not exist |
| **Creative** | Design, marketing, content | Brand-color heists, kerning crimes, copy with hidden acrostics |
| **Common Room** | Everyone, no tech needed | Riddles, the coffee machine's error codes, meeting minutes that say more than they mean, the org chart with one person who doesn't exist |

Players choose a home desk when they join. They can open **any** desk's cases;
the home desk only matters for the department war and for collaborative cases.
Cross-desk solving is rewarded with an achievement, which nudges people to
talk to colleagues in other teams.

---

## 5. Kinds of eggs

### 5.1 Case files (puzzles)
The core loop. A case has a briefing (HTML rendered on the server), an answer
box, optional hints that cost points, and an unlock rule. Answers are
normalised (case, spaces and punctuation ignored) and checked on the server.

### 5.2 Personal cases (anti-sharing)
Some cases are **generated per player**: the coffee machine shows *your*
error codes, which decode to *your* word. Shouting the answer across the room
does not help anyone else. The engine gives every case a stable per-player
seed for this.

### 5.3 Hidden eggs (discoveries)
Not every egg lives on the case board. Some are found by poking at the app
and the office itself, then reported through the **Report a discovery** box:

- a message ARCHIE leaves in the browser console;
- a strange response header on every API call;
- a path that `robots.txt` asks crawlers to stay out of;
- the Konami code;
- impatiently clicking the logo;
- a 404 page that apologises a little too much;
- something that only exists between 19:00 and 06:00 (the night shift);
- **physical eggs**: printed codes taped under a desk, inside the stationery
  cupboard, on the back of the fire-exit map. The office itself becomes part
  of the map.

Digital discovery codes are **per player** (derived from a server secret and
the player's id), so a code found by one person is useless to another. Each
person must find the hiding place themselves.

### 5.4 Collaborative cases
**The Vault** is a shared puzzle for the whole office. Every player can request
a personal "shard". The vault opens when shards from enough **different
desks** have been submitted. When it opens, everyone sees it happen live,
contributors get points, and a new case appears for all.

Other collaborative ideas the structure supports:
- *Split keys*: a case whose answer has one half on the Support desk and one
  on the Engineering desk.
- *Office-wide thresholds*: "When 20 people have solved anything on the QA
  desk, the QA lead's 'cursed spreadsheet' case unlocks."
- *Relay cases*: each solve reveals the next clue to the *next* person to open it.

### 5.5 Meta cases
Cases that unlock from progress elsewhere (letters collected, a number of
desks visited, the vault opening). They are hidden from the board until they
unlock, which is where most of the surprise comes from.

### 5.6 Timed and seasonal eggs
Cases can carry a time window (night shift only, Friday afternoon only,
the first working day of the month). Seasons let the organiser retire a set of
cases, archive the leaderboard, and start a new chapter of the story.

---

## 6. Progression and competition

- **Difficulty ladder.** Every case is **Rookie**, **Agent**, **Detective**
  or **Fiendish** (shown as a label with pips, filterable on the board).
  Each desk is a ladder: its Rookie case opens the Agent ones, those open the
  Detective ones, and the Fiendish ones sit at the top. A few Fiendish cases
  cross desks: *The Night Auditor* is spelled by answers from Support, Ops
  and Engineering, so nobody gets there alone.
- **Points** per case, scaled by difficulty (60 to 400).
- **First blood**: the first person to solve a case gets +50%. The wire
  announces it to the whole office.
- **Hints** cost points from that case's reward (never below 10%).
- **Achievements**, some visible and some secret (shown as `???` until
  earned): First Case, Night Owl, Early Bird, Desk Hopper (three desks),
  No Hints Needed, Stubborn (ten wrong guesses and then right), Speedrun
  (solved within a minute of opening), Egg Hunter (three hidden eggs),
  Vault Key, First Blood, Archivist (meta case).
- **Leaderboard** with a live individual ranking and a **department war**
  (total points per desk, normalised by number of players so small teams can
  win).
- **The wire**: a live ticker of discoveries. It mentions what happened but
  never the answer ("Priya closed a case on the QA desk — first blood").

---

## 7. Possibilities you may not have considered

- **Anti-sharing by design**, not by policing: personal variants of puzzles
  and per-player discovery codes mean that sharing answers is pointless, so
  nobody has to feel like a cheat.
- **The physical office as a game board.** Printed QR codes and short
  codes on objects connect the digital mystery to the real building and get
  people out of their chairs.
- **Etiquette guardrails.** Short cases, no notifications, no
  "streak lost" guilt. The point is to make the day lighter, not to add a
  second job.
- **Accessibility.** Puzzles that rely on colour or sound need a text
  alternative; the Common Room desk must always have something new.
- **Fairness for latecomers.** Points decay is avoided; instead, new
  cases and seasons let late joiners catch up, and the department war is
  normalised per player.
- **Recovery without accounts.** A display name is enough to start, and a
  four-word passphrase lets a player continue on another device. No email,
  no password policy.
- **An organiser console.** Broadcast "rumours" onto the wire ("Someone saw
  ARCHIE in the third-floor printer logs…"), see which cases nobody has
  solved (they need better hints), and see which ones are too easy.
- **Real-system hooks (later).** Eggs inside genuine internal tools: a
  hidden flag in the staging app, a comment in the real codebase's
  `CONTRIBUTING.md`, a support macro that returns a riddle. The game's
  `discover` endpoint already accepts codes from anywhere.
- **Chat integration (later).** A daily `/archie` riddle in Slack or Teams,
  and the wire mirrored into a channel.
- **Story chapters.** Each season answers one question about `m.` and
  opens a new one. People return because they want to know what happened.

---

## 8. Security model

The brief asks that nobody can win by opening DevTools. The design:

| Threat | Mitigation |
|---|---|
| Reading answers in the frontend | Answers, validators and hints exist only on the server (`content/`). The browser receives rendered case text only after a case unlocks. |
| Reading locked cases | Locked and hidden cases are never sent. Board entries for locked cases contain a redacted title only. |
| Sharing answers | Personal cases are generated per player; discovery codes are HMACs of the player id. |
| Brute-forcing answers | Per-player, per-case attempt limits (ARCHIE sulks for a few minutes). |
| Impersonation | Each player gets a random 256-bit token; only its SHA-256 is stored. The resume passphrase is stored as an scrypt hash. |
| Faking scores | All scoring happens server-side on solve; the client never sends points. |
| Night-shift egg outside hours | The time window is checked with the server clock. |
| Script injection via display names | Names are length- and character-restricted and always rendered as text. |

Hidden *discovery* eggs are intentionally inspection-friendly: for the
Engineering desk, poking at the app is the puzzle. They are worth fewer points
and their codes are per player, so finding them in the source still requires
doing the poking.

---

## 9. Architecture (as built)

- **Runtime**: Node.js (22.13+), zero npm dependencies. `node:http` for the
  server, `node:sqlite` for storage, Server-Sent Events for live updates.
- **Content as data**: `content/challenges/*.js` each export an array of
  cases; `content/eggs.js` lists hidden and physical eggs;
  `content/achievements.js` lists achievements. The server watches the
  folder and reloads when a file changes, so cases can be added while people
  are playing.
- **Frontend**: one static page (`public/`) in plain HTML, CSS and
  JavaScript. It talks to a small JSON API.
- **Storage**: one SQLite file in `data/`. Back it up by copying the file.

### Case file format

```js
export default [
  {
    id: "eng-ghost-commit",        // stable, never reuse
    desk: "engineering",           // engineering | support | qa | ops | creative | common
    title: "The Commit Nobody Wrote",
    teaser: "Signed 'm.' at 03:12. Nobody was in.",
    points: 150,                   // difficulty is implied by points
    requires: { solved: ["eng-first-contact"] },   // optional unlock rule
    hidden: false,                 // true = invisible until unlocked
    window: { from: 19, to: 6 },   // optional server-time window
    body: (ctx) => `<p>…</p>`,     // rendered on the server, per player
    answers: ["archie"],           // or check: (answer, ctx) => boolean
    near: { "archive": "So close ARCHIE can smell it." },
    hints: [{ text: "Read the first letters.", cost: 30 }],
    reward: { lore: "…", letter: "A" },
  },
];
```

Unlock rules can combine `solved` (all of these), `count` (any N cases
solved), `letters` (N letters collected), `vault` (the vault is open) and
`desks` (solved on N different desks).

---

## 10. Roadmap ideas

1. Seasons with archived leaderboards and a recap page ("Season 1: The
   Night Shift").
2. Organiser web console (case analytics, broadcast, ban a name).
3. Slack/Teams bridge for the wire and a daily riddle.
4. Team cases with real-time co-solving in a shared room.
5. Photo eggs: upload a photo of a physical clue; the organiser approves it.
6. A printable "evidence board" poster generated from the season's story.
