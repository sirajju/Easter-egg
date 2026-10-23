# NIGHTSHIFT

> Somebody on the night shift never logged out.

An office-wide Easter egg hunt. Employees open a case file with just a display
name, pick their desk, and start closing cases: impossible support tickets,
commits nobody wrote, a colleague who was never hired, a coffee machine that
only speaks in error codes. Hidden eggs are tucked into the app itself and
around the physical office. A live leaderboard, a department war and a feed of
discoveries ("the wire") keep everyone aware that someone just found
something.

The idea, the story and the design choices are in [CONCEPT.md](CONCEPT.md).

## Run it

Needs Node.js 22.13 or newer. There are no dependencies to install.

```bash
npm start            # http://localhost:4404
```

Share `http://<your-machine>:4404` on the office network. Everything is stored
in `data/nightshift.db` (SQLite); back it up by copying the `data/` folder.

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `4404` | Port to listen on |
| `NIGHTSHIFT_DATA` | `./data` | Where the database and server secret live |
| `NIGHTSHIFT_SECRET` | generated into `data/secret.key` | Secret that per-player codes are derived from |
| `NIGHTSHIFT_ADMIN_KEY` | off | Turns on the organiser API |

Put it behind HTTPS (any reverse proxy) if it's reachable outside the office.

### With Docker

```bash
docker compose up -d --build        # http://localhost:4404
```

- Data (database and server secret) lives in the `nightshift-data` volume
  and survives rebuilds and restarts.
- `TZ` decides when the night shift starts. The compose file defaults to
  `Asia/Kolkata`; set `TZ=Europe/London docker compose up -d` for another
  office. The plain image defaults to UTC.
- `NIGHTSHIFT_PORT` changes the host port, `NIGHTSHIFT_ADMIN_KEY` turns on
  the organiser API.
- To edit cases without rebuilding, uncomment the `./content` mount in
  `docker-compose.yml`; the server reloads content live.

Without compose:

```bash
docker build -t nightshift .
docker run -d --name nightshift -p 4404:4404 -e TZ=Asia/Kolkata   -v nightshift-data:/data nightshift
```

Back up with `docker run --rm -v nightshift-data:/data -v "$PWD":/backup alpine
tar czf /backup/nightshift-data.tgz -C /data .`

## How it plays

- **Desks**: Engineering, Support, QA, Ops, Creative and the Common Room
  (no tech needed). Anyone can open any desk's cases; your home desk counts
  for the department war and for vault shards.
- **Cases** unlock from other cases, from letters collected, from vaults
  opening, or only during the night shift (19:00 to 06:00, server time).
  Locked cases show a redacted title. Some cases are hidden until they unlock.
- **Personal cases** are generated per player, so shouting answers across
  the room doesn't help.
- **Difficulty**: every case is Rookie, Agent, Detective or Fiendish, and
  the board can be filtered by it. Harder cases unlock from easier ones on
  the same desk; a few Fiendish cases need answers from several desks.
- **Hints** cost points. **First blood** gives +50%.
- **Hidden eggs** are reported under Discoveries. Codes found in the app are
  personal; physical codes are printed and hidden around the office.
- **Vaults** open only when people from several desks fit their shards.
- **The story**: every closed case recovers a line of m.'s last message.

## Adding cases

Drop a file into `content/challenges/` (or add to an existing one). The
server reloads content while it's running.

```js
export default [
  {
    id: "sup-refund-loop",            // stable and unique
    desk: "support",                  // engineering | support | qa | ops | creative | common
    title: "The Refund That Refunded Itself",
    teaser: "Shown on the board once unlocked.",
    points: 120,
    tier: "agent",                    // rookie | agent | detective | fiendish (else from points)
    requires: { solved: ["sup-first-contact"] }, // optional; also count, letters, desks, vault
    hidden: false,                    // true = invisible until unlocked
    window: { from: 19, to: 6 },      // optional, server hours
    body: (ctx) => `<p>Rendered on the server for ${"each player"}.</p>`,
    answers: ["the answer"],          // or check: (normalized, ctx, raw) => boolean
    near: { "almost": "A nudge for a common wrong answer." },
    hints: [{ text: "First hint.", cost: 25 }],
    reward: { lore: "[n/16] A line of the story.", letter: "X" },
  },
];
```

`ctx.pick(list)`, `ctx.seed()` and `ctx.code()` give stable per-player values
for personal cases. Run `npm run check` after editing to catch broken unlock
rules and duplicate story lines.

Hidden eggs live in `content/eggs.js`, achievements in
`content/achievements.js`, vaults in `content/vaults.js`.

**Before printing the physical eggs, change their codes** in
`content/eggs.js`: the examples in this repository are public.

## Organiser tools

With `NIGHTSHIFT_ADMIN_KEY` set:

```bash
# Post a rumour onto the wire
curl -X POST localhost:4404/api/admin/rumor -H "X-Admin-Key: $KEY" \
  -H "Content-Type: application/json" -d '{"text":"Someone saw ARCHIE in the printer logs."}'

# Which cases are opened, solved, hinted, guessed wrong
curl localhost:4404/api/admin/overview -H "X-Admin-Key: $KEY"
```

## Security

- Answers, validators, hints and locked case text exist only on the server.
  The browser gets case text after a case unlocks, and nothing else.
- Hidden-egg codes and personal-case answers are derived per player from a
  server secret, so sharing them doesn't work.
- Answer attempts are rate-limited per player and case; joins, resumes and
  discoveries are rate-limited too.
- Players hold a random 256-bit token (stored as SHA-256). The resume
  passphrase is stored as an scrypt hash.
- All scoring happens on the server.

## Tests

```bash
NIGHTSHIFT_DATA=/tmp/ns-test PORT=4405 NIGHTSHIFT_ADMIN_KEY=test npm start
NIGHTSHIFT_URL=http://localhost:4405 NIGHTSHIFT_ADMIN_KEY=test node scripts/smoke-test.js
```

The smoke test creates throwaway players, so it refuses to run against a
server that already has players. Point it at a fresh test data folder.
