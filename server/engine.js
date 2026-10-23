import { EventEmitter } from "node:events";
import { content, DESKS } from "./content.js";
import { playerCode, playerSeed } from "./crypto.js";

/** Answers ignore case, spacing and punctuation. */
export const normalize = (value) =>
  String(value ?? "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const normalizeCode = (value) =>
  String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

const ATTEMPT_LIMIT = 8;
const ATTEMPT_WINDOW_MS = 5 * 60 * 1000;
const FIRST_BLOOD_BONUS = 0.5;
const MIN_REWARD_SHARE = 0.1;

const hourNow = () => new Date().getHours();

/** Difficulty tiers, easiest first. A case may set `tier`; otherwise its
 *  points decide. */
export const TIERS = ["rookie", "agent", "detective", "fiendish"];
const tierOf = (c) =>
  TIERS.includes(c.tier)
    ? c.tier
    : c.points <= 100 ? "rookie" : c.points <= 160 ? "agent" : c.points <= 260 ? "detective" : "fiendish";

/** {from: 19, to: 6} wraps midnight; {from: 9, to: 17} doesn't. */
export const inWindow = (window, hour = hourNow()) => {
  if (!window) return true;
  const { from, to } = window;
  return from <= to ? hour >= from && hour < to : hour >= from || hour < to;
};

// "The Coffee Machine" -> "T██ C█f█ee ███hine": enough to make people wonder.
const redact = (title, seed) =>
  title
    .split("")
    .map((ch, i) => (/[a-z0-9]/i.test(ch) && (i * 7 + seed) % 3 !== 0 ? "█" : ch))
    .join("");

export function createEngine(db) {
  const bus = new EventEmitter();
  const q = (sql) => db.prepare(sql);

  const stmt = {
    solvesOf: q("SELECT case_id, desk, points, first_blood, solved_at FROM solves WHERE player_id = ?"),
    eggsOf: q("SELECT egg_id, points, found_at FROM eggs WHERE player_id = ?"),
    achOf: q("SELECT ach_id, points, earned_at FROM achievements WHERE player_id = ?"),
    progress: q("SELECT * FROM progress WHERE player_id = ? AND case_id = ?"),
    openProgress: q(
      "INSERT OR IGNORE INTO progress (player_id, case_id, opened_at) VALUES (?, ?, ?)"
    ),
    addHint: q("UPDATE progress SET hints = hints + 1 WHERE player_id = ? AND case_id = ?"),
    addWrong: q("UPDATE progress SET wrong = wrong + 1 WHERE player_id = ? AND case_id = ?"),
    recentAttempts: q(
      "SELECT COUNT(*) AS n FROM attempts WHERE player_id = ? AND case_id = ? AND at > ?"
    ),
    addAttempt: q("INSERT INTO attempts (player_id, case_id, at) VALUES (?, ?, ?)"),
    solveCount: q("SELECT COUNT(*) AS n FROM solves WHERE case_id = ?"),
    solveCounts: q("SELECT case_id, COUNT(*) AS n FROM solves GROUP BY case_id"),
    addSolve: q(
      "INSERT INTO solves (player_id, case_id, desk, points, first_blood, solved_at) VALUES (?, ?, ?, ?, ?, ?)"
    ),
    addEgg: q("INSERT INTO eggs (player_id, egg_id, points, found_at) VALUES (?, ?, ?, ?)"),
    addAch: q(
      "INSERT OR IGNORE INTO achievements (player_id, ach_id, points, earned_at) VALUES (?, ?, ?, ?)"
    ),
    addEvent: q("INSERT INTO events (kind, player_id, text, at) VALUES (?, ?, ?, ?)"),
    feed: q("SELECT id, kind, text, at FROM events ORDER BY id DESC LIMIT ?"),
    shards: q("SELECT player_id, desk, at FROM vault_shards WHERE vault_id = ?"),
    addShard: q(
      "INSERT OR IGNORE INTO vault_shards (vault_id, player_id, desk, at) VALUES (?, ?, ?, ?)"
    ),
    vaultOpened: q("SELECT opened_at FROM vaults_opened WHERE vault_id = ?"),
    openVault: q("INSERT OR IGNORE INTO vaults_opened (vault_id, opened_at) VALUES (?, ?)"),
    leaderboard: q(`
      SELECT p.id, p.name, p.desk,
        COALESCE((SELECT SUM(points) FROM solves s WHERE s.player_id = p.id), 0)
        + COALESCE((SELECT SUM(points) FROM eggs e WHERE e.player_id = p.id), 0)
        + COALESCE((SELECT SUM(points) FROM achievements a WHERE a.player_id = p.id), 0) AS score,
        (SELECT COUNT(*) FROM solves s WHERE s.player_id = p.id) AS solved,
        (SELECT COUNT(*) FROM eggs e WHERE e.player_id = p.id) AS eggs,
        (SELECT COUNT(*) FROM solves s WHERE s.player_id = p.id AND s.first_blood = 1) AS first_bloods,
        MAX(
          COALESCE((SELECT MAX(solved_at) FROM solves s WHERE s.player_id = p.id), 0),
          COALESCE((SELECT MAX(found_at) FROM eggs e WHERE e.player_id = p.id), 0)
        ) AS last_at
      FROM players p
      ORDER BY score DESC, last_at ASC, p.created_at ASC
    `),
  };

  const announce = (kind, playerId, text) => {
    const at = Date.now();
    const { lastInsertRowid } = stmt.addEvent.run(kind, playerId, text, at);
    const event = { id: Number(lastInsertRowid), kind, text, at };
    bus.emit("event", event);
    return event;
  };

  const changed = () => bus.emit("scores");

  /** A case's context: who is playing and stable per-player randomness. */
  const ctxFor = (player, caseId) => ({
    player: { id: player.id, name: player.name, desk: player.desk },
    seed: (label = "") => playerSeed(player.id, `${caseId}:${label}`),
    code: (label = "", length = 8) => playerCode(player.id, `${caseId}:${label}`, length),
    pick: (list, label = "") => list[playerSeed(player.id, `${caseId}:${label}`) % list.length],
    hour: hourNow(),
    now: new Date(),
  });

  /** Everything unlock rules and achievements look at, for one player. */
  function statsOf(player) {
    const solves = stmt.solvesOf.all(player.id);
    const solved = new Set(solves.map((s) => s.case_id));
    const letters = [];
    for (const s of solves) {
      const letter = content.cases.get(s.case_id)?.reward?.letter;
      if (letter) letters.push(letter);
    }
    return {
      solves,
      solved,
      letters,
      desks: new Set(solves.map((s) => s.desk)),
      eggs: stmt.eggsOf.all(player.id),
      achievements: new Set(stmt.achOf.all(player.id).map((a) => a.ach_id)),
    };
  }

  const vaultIsOpen = (id) => !!stmt.vaultOpened.get(id);

  function unlockState(c, stats) {
    const r = c.requires || {};
    if (r.solved && !r.solved.every((id) => stats.solved.has(id)))
      return { open: false, why: "Another case has to be closed first." };
    if (r.count && stats.solved.size < r.count)
      return { open: false, why: `Close ${r.count} cases to open this one.` };
    if (r.letters && stats.letters.length < r.letters)
      return { open: false, why: `Collect ${r.letters} letters from ARCHIE.` };
    if (r.desks && stats.desks.size < r.desks)
      return { open: false, why: `Close cases on ${r.desks} different desks.` };
    if (r.vault && !vaultIsOpen(r.vault))
      return { open: false, why: "Something has to be opened together first." };
    if (!inWindow(c.window))
      return { open: false, why: "ARCHIE only files this one during the night shift." };
    return { open: true };
  }

  const renderBody = (c, player) =>
    typeof c.body === "function" ? c.body(ctxFor(player, c.id)) : c.body;

  const hintCost = (c, used) =>
    c.hints.slice(0, used).reduce((sum, h) => sum + (h.cost || 0), 0);

  // ---- board & cases -------------------------------------------------------

  function board(player) {
    const stats = statsOf(player);
    const counts = new Map(stmt.solveCounts.all().map((r) => [r.case_id, r.n]));
    const entries = [];
    let i = 0;
    for (const c of content.cases.values()) {
      i += 1;
      const state = unlockState(c, stats);
      if (c.hidden && !state.open && !stats.solved.has(c.id)) continue;
      const solved = stats.solved.has(c.id);
      entries.push({
        id: c.id,
        desk: c.desk,
        title: state.open || solved ? c.title : redact(c.title, i),
        teaser: state.open || solved ? c.teaser || "" : "",
        points: c.points,
        tier: tierOf(c),
        status: solved ? "solved" : state.open ? "open" : "locked",
        lockedWhy: state.open ? null : state.why,
        solvedBy: counts.get(c.id) || 0,
        isNew: !!c.hidden,
        personal: !!c.personal,
        timed: !!c.window,
      });
    }
    return { desks: DESKS, tiers: TIERS, cases: entries, letters: stats.letters };
  }

  function openCase(player, id) {
    const c = content.cases.get(id);
    if (!c) return { error: "not_found" };
    const stats = statsOf(player);
    const solved = stats.solved.has(id);
    const state = unlockState(c, stats);
    if (!state.open && !solved) return { error: "locked", why: state.why };
    stmt.openProgress.run(player.id, id, Date.now());
    const p = stmt.progress.get(player.id, id);
    const solve = stats.solves.find((s) => s.case_id === id);
    return {
      id: c.id,
      desk: c.desk,
      title: c.title,
      points: c.points,
      tier: tierOf(c),
      personal: !!c.personal,
      body: renderBody(c, player),
      hints: c.hints.slice(0, p.hints).map((h) => h.text),
      hintsLeft: c.hints.length - p.hints,
      nextHintCost: c.hints[p.hints]?.cost ?? null,
      solved,
      earned: solve?.points ?? null,
      firstBlood: !!solve?.first_blood,
      reward: solved ? c.reward || null : null,
      solvedBy: stmt.solveCount.get(id).n,
    };
  }

  function takeHint(player, id) {
    const opened = openCase(player, id);
    if (opened.error) return opened;
    if (opened.solved) return { error: "solved" };
    const c = content.cases.get(id);
    const p = stmt.progress.get(player.id, id);
    if (p.hints >= c.hints.length) return { error: "no_hints" };
    stmt.addHint.run(player.id, id);
    return openCase(player, id);
  }

  function answer(player, id, raw) {
    const c = content.cases.get(id);
    if (!c) return { error: "not_found" };
    const stats = statsOf(player);
    if (stats.solved.has(id)) return { correct: true, already: true };
    const state = unlockState(c, stats);
    if (!state.open) return { error: "locked", why: state.why };

    const now = Date.now();
    stmt.openProgress.run(player.id, id, now);
    const recent = stmt.recentAttempts.get(player.id, id, now - ATTEMPT_WINDOW_MS).n;
    if (recent >= ATTEMPT_LIMIT) {
      return {
        correct: false,
        throttled: true,
        message: "ARCHIE is tired of your guesses. Come back in a few minutes.",
      };
    }
    stmt.addAttempt.run(player.id, id, now);

    const given = normalize(raw);
    if (!given) return { correct: false, message: "ARCHIE can't file an empty answer." };
    const ctx = ctxFor(player, id);
    const ok = c.check
      ? !!c.check(given, ctx, raw)
      : c.answers.some((a) => normalize(a) === given);

    if (!ok) {
      stmt.addWrong.run(player.id, id);
      const nearKey = Object.keys(c.near || {}).find((k) => normalize(k) === given);
      return {
        correct: false,
        message: nearKey ? c.near[nearKey] : wrongLine(now),
        attemptsLeft: ATTEMPT_LIMIT - recent - 1,
      };
    }

    const p = stmt.progress.get(player.id, id);
    const base = c.points;
    let points = Math.max(Math.round(base * MIN_REWARD_SHARE), base - hintCost(c, p.hints));
    const firstBlood = stmt.solveCount.get(id).n === 0;
    if (firstBlood) points += Math.round(base * FIRST_BLOOD_BONUS);
    const before = new Set(board(player).cases.filter((e) => e.status !== "locked").map((e) => e.id));
    stmt.addSolve.run(player.id, id, c.desk, points, firstBlood ? 1 : 0, now);

    announce(
      "solve",
      player.id,
      firstBlood
        ? `${player.name} closed “${c.title}” first. First blood on the ${DESKS[c.desk]} desk.`
        : `${player.name} closed a case on the ${DESKS[c.desk]} desk.`
    );

    const unlocked = board(player)
      .cases.filter((e) => e.status === "open" && !before.has(e.id))
      .map((e) => ({ id: e.id, title: e.title, desk: e.desk }));
    const earned = evaluateAchievements(player, {
      type: "solve",
      caseId: id,
      hints: p.hints,
      wrong: p.wrong,
      seconds: (now - p.opened_at) / 1000,
      hour: hourNow(),
      firstBlood,
      tier: tierOf(c),
    });
    changed();
    return {
      correct: true,
      points,
      firstBlood,
      reward: c.reward || null,
      unlocked,
      achievements: earned,
    };
  }

  const WRONG_LINES = [
    "ARCHIE checks the files. Nothing under that name.",
    "Not filed. Try again.",
    "ARCHIE stamps it REJECTED, a little too enthusiastically.",
    "That answer goes in the shredder.",
    "Wrong drawer.",
  ];
  const wrongLine = (now) => WRONG_LINES[Math.floor(now / 997) % WRONG_LINES.length];

  // ---- hidden eggs ---------------------------------------------------------

  /** The code a digital egg reveals to this player, or null if it's not findable now. */
  function eggCode(player, eggId) {
    const egg = content.eggs.get(eggId);
    if (!egg || egg.physical) return null;
    if (!inWindow(egg.window)) return null;
    return playerCode(player.id, `egg:${egg.id}`);
  }

  function discover(player, raw) {
    const code = normalizeCode(raw);
    if (code.length < 4) return { found: false, message: "That doesn't look like anything ARCHIE filed." };
    for (const egg of content.eggs.values()) {
      const expected = egg.physical
        ? normalizeCode(egg.code)
        : playerCode(player.id, `egg:${egg.id}`);
      if (code !== expected) continue;
      if (!egg.physical && !inWindow(egg.window)) {
        return { found: false, message: "That code only works when the lights are off." };
      }
      const already = statsOf(player).eggs.some((e) => e.egg_id === egg.id);
      if (already) return { found: true, already: true, egg: publicEgg(egg) };
      stmt.addEgg.run(player.id, egg.id, egg.points, Date.now());
      announce("egg", player.id, `${player.name} found something hidden: ${egg.title}.`);
      const earned = evaluateAchievements(player, { type: "egg", eggId: egg.id, hour: hourNow() });
      changed();
      return { found: true, egg: publicEgg(egg), points: egg.points, achievements: earned };
    }
    return {
      found: false,
      message: "ARCHIE doesn't recognise that code. Codes are personal: a colleague's won't work for you.",
    };
  }

  const publicEgg = (egg) => ({ id: egg.id, title: egg.title, note: egg.note || "" });

  function eggList(player) {
    const found = new Map(statsOf(player).eggs.map((e) => [e.egg_id, e]));
    return [...content.eggs.values()].map((egg) => {
      const mine = found.get(egg.id);
      return mine
        ? { id: egg.id, title: egg.title, note: egg.note || "", points: mine.points, found: true }
        : { id: egg.id, title: null, hint: egg.whisper || "", points: egg.points, found: false };
    });
  }

  // ---- vaults --------------------------------------------------------------

  /** Shard eligibility: one closed case on your own desk proves you did the work. */
  const shardEligible = (player, stats) =>
    stats.solves.some((s) => s.desk === player.desk);

  function vaults(player) {
    const stats = statsOf(player);
    return content.vaults.map((v) => {
      const shards = stmt.shards.all(v.id);
      const desks = new Set(shards.map((s) => s.desk));
      const opened = stmt.vaultOpened.get(v.id);
      const mine = shards.some((s) => s.player_id === player.id);
      return {
        id: v.id,
        title: v.title,
        body: v.body,
        needDesks: v.needDesks,
        needShards: v.needShards,
        shards: shards.length,
        desks: [...desks].map((d) => DESKS[d] || d),
        opened: opened ? opened.opened_at : null,
        contributed: mine,
        myShard: !mine && shardEligible(player, stats) ? playerCode(player.id, `vault:${v.id}`) : null,
        shardHint: shardEligible(player, stats)
          ? null
          : `Close a case on your own desk (${DESKS[player.desk]}) to receive a shard.`,
        points: v.points,
      };
    });
  }

  function submitShard(player, vaultId, raw) {
    const v = content.vaults.find((x) => x.id === vaultId);
    if (!v) return { error: "not_found" };
    if (vaultIsOpen(v.id)) return { error: "already_open" };
    const stats = statsOf(player);
    if (!shardEligible(player, stats)) return { error: "not_eligible" };
    if (normalizeCode(raw) !== playerCode(player.id, `vault:${v.id}`)) {
      return { error: "bad_shard", message: "That shard doesn't fit this lock. Shards are personal." };
    }
    stmt.addShard.run(v.id, player.id, player.desk, Date.now());
    announce("vault", player.id, `${player.name} fitted a shard into ${v.title}.`);

    const shards = stmt.shards.all(v.id);
    const desks = new Set(shards.map((s) => s.desk));
    if (desks.size >= v.needDesks && shards.length >= v.needShards) {
      stmt.openVault.run(v.id, Date.now());
      for (const s of shards) stmt.addAch.run(s.player_id, `vault:${v.id}`, v.points, Date.now());
      announce("vault-open", null, `${v.title} is open. ${shards.length} people from ${desks.size} desks did it together.`);
      bus.emit("vault", v.id);
    }
    const earned = evaluateAchievements(player, { type: "shard", vaultId: v.id, hour: hourNow() });
    changed();
    return { ok: true, achievements: earned };
  }

  // ---- achievements --------------------------------------------------------

  function evaluateAchievements(player, event) {
    const stats = statsOf(player);
    const facts = {
      ...event,
      solvedCount: stats.solved.size,
      desks: stats.desks.size,
      eggs: stats.eggs.length,
      letters: stats.letters.length,
      firstBloods: stats.solves.filter((s) => s.first_blood).length,
      solved: stats.solved,
      // How many cases of each difficulty this player has closed.
      tiers: Object.fromEntries(
        TIERS.map((t) => [
          t,
          stats.solves.filter((s) => {
            const c = content.cases.get(s.case_id);
            return c && tierOf(c) === t;
          }).length,
        ])
      ),
      shards: content.vaults.filter((v) =>
        stmt.shards.all(v.id).some((s) => s.player_id === player.id)
      ).length,
    };
    const earned = [];
    for (const a of content.achievements) {
      if (stats.achievements.has(a.id)) continue;
      let ok = false;
      try {
        ok = !!a.test(facts);
      } catch {
        ok = false;
      }
      if (!ok) continue;
      stmt.addAch.run(player.id, a.id, a.points || 0, Date.now());
      earned.push({ id: a.id, title: a.title, description: a.description, points: a.points || 0 });
      if (a.announce !== false) {
        announce("achievement", player.id, `${player.name} earned “${a.title}”.`);
      }
    }
    return earned;
  }

  function achievementList(player) {
    const mine = new Map(stmt.achOf.all(player.id).map((a) => [a.ach_id, a]));
    const list = content.achievements.map((a) => {
      const got = mine.get(a.id);
      if (!got && a.secret) return { id: a.id, title: "???", description: "A secret.", points: null, earned: false, secret: true };
      return {
        id: a.id,
        title: a.title,
        description: a.description,
        points: a.points || 0,
        earned: !!got,
        earnedAt: got?.earned_at ?? null,
      };
    });
    for (const v of content.vaults) {
      const got = mine.get(`vault:${v.id}`);
      if (got) list.push({ id: `vault:${v.id}`, title: `Opened ${v.title}`, description: "Fitted a shard into a vault that opened.", points: got.points, earned: true, earnedAt: got.earned_at });
    }
    return list;
  }

  // ---- leaderboard & profile -----------------------------------------------

  function leaderboard() {
    const rows = stmt.leaderboard.all();
    const players = rows.map((r, i) => ({
      rank: i + 1,
      name: r.name,
      desk: r.desk,
      score: r.score,
      solved: r.solved,
      eggs: r.eggs,
      firstBloods: r.first_bloods,
    }));
    const deskTotals = new Map();
    for (const r of rows) {
      const t = deskTotals.get(r.desk) || { desk: r.desk, name: DESKS[r.desk] || r.desk, total: 0, players: 0, active: 0 };
      t.total += r.score;
      t.players += 1;
      if (r.score > 0) t.active += 1;
      deskTotals.set(r.desk, t);
    }
    // Per-player average of active players, so small desks can win.
    const desks = [...deskTotals.values()]
      .map((t) => ({ ...t, average: t.active ? Math.round(t.total / t.active) : 0 }))
      .sort((a, b) => b.average - a.average || b.total - a.total);
    return { players, desks };
  }

  function profile(player) {
    const stats = statsOf(player);
    const board_ = leaderboard();
    const me = board_.players.find((p) => p.name === player.name);
    return {
      name: player.name,
      desk: player.desk,
      deskName: DESKS[player.desk],
      score: me?.score ?? 0,
      rank: me?.rank ?? null,
      of: board_.players.length,
      solved: stats.solved.size,
      eggs: stats.eggs.length,
      letters: stats.letters,
      lore: stats.solves
        .sort((a, b) => a.solved_at - b.solved_at)
        .map((s) => content.cases.get(s.case_id)?.reward?.lore)
        .filter(Boolean),
    };
  }

  const feed = (limit = 30) => stmt.feed.all(limit);

  return {
    bus,
    announce,
    board,
    openCase,
    takeHint,
    answer,
    eggCode,
    discover,
    eggList,
    vaults,
    submitShard,
    achievementList,
    leaderboard,
    profile,
    feed,
    changed,
  };
}
