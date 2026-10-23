// End-to-end check against a running server:
//   NIGHTSHIFT_URL=http://localhost:4404 node scripts/smoke-test.js
// Creates throwaway players, so point it at a test data folder, not the real game.

const BASE = process.env.NIGHTSHIFT_URL;
if (!BASE) {
  console.error("Set NIGHTSHIFT_URL to a test server, e.g. http://localhost:4405");
  process.exit(2);
}
const ADMIN = process.env.NIGHTSHIFT_ADMIN_KEY || "";
const run = Date.now().toString(36).slice(-5);
let failures = 0;

// Never pollute a real game: refuse a server that already has players.
const existing = await fetch(`${BASE}/api/desks`).then((r) => r.json()).catch(() => null);
if (existing?.players > 0 && process.env.SMOKE_ALLOW_EXISTING !== "1") {
  console.error(
    `${BASE} already has ${existing.players} player(s). This test creates throwaway players, so run it ` +
      "against an empty test server (fresh NIGHTSHIFT_DATA), or set SMOKE_ALLOW_EXISTING=1."
  );
  process.exit(2);
}

const ok = (cond, label) => {
  console.log(`${cond ? "  ✔" : "  ✘"} ${label}`);
  if (!cond) failures += 1;
};

async function call(path, { token, method = "GET", body, headers = {} } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = text;
  try { data = JSON.parse(text); } catch { /* html */ }
  return { status: res.status, data, headers: res.headers, text };
}

const join = async (name, desk) => {
  const r = await call("/api/join", { method: "POST", body: { name, desk } });
  return { ...r.data, status: r.status };
};
const answer = (token, id, value) =>
  call(`/api/cases/${id}/answer`, { token, method: "POST", body: { answer: value } }).then((r) => r.data);

const decodeCoffee = (html) =>
  [...html.matchAll(/E(\d{2})/g)].map((m) => String.fromCharCode(96 + Number(m[1]))).join("");

console.log("Joining");
const a = await join(`Ada ${run}`, "engineering");
ok(a.status === 201 && a.token && a.passphrase, "a player can join with a display name");
const dup = await join(`ada ${run}`, "qa");
ok(dup.status === 409, "names are unique, case-insensitively");
const bad = await join("<script>", "qa");
ok(bad.status === 400, "names with markup are refused");
const b = await join(`Bo ${run}`, "support");

console.log("Secrets stay on the server");
const board = await call("/api/board", { token: a.token });
const boardText = JSON.stringify(board.data);
ok(!/"answers"|"check"|"hints"|logvault|stapler/i.test(boardText), "the board carries no answers or hints");
ok(!board.data.cases.some((c) => c.id === "meta-archivist"), "hidden meta case isn't listed before it unlocks");
const locked = board.data.cases.find((c) => c.status === "locked");
ok(locked && /█/.test(locked.title), "locked cases show a redacted title");
const lockedOpen = await call(`/api/cases/${locked.id}`, { token: a.token });
ok(lockedOpen.status === 403 && !lockedOpen.data.body, "a locked case's text isn't served");
const openCase = await call("/api/cases/ops-first-contact", { token: a.token });
ok(openCase.status === 200 && !/"answers"/.test(openCase.text), "an open case serves text but no answers");
const noAuth = await call("/api/board");
ok(noAuth.status === 401, "the API needs a case file");

console.log("Answering");
let r = await answer(a.token, "ops-first-contact", "checkout");
ok(r.correct === false && /loudest/.test(r.message), "near-misses get a specific reply");
r = await answer(a.token, "ops-first-contact", "LogVault!");
ok(r.correct && r.firstBlood && r.points === 150, "answers ignore case/punctuation; first blood adds 50%");
ok(r.reward?.letter === "U" && /\[2\/16\]/.test(r.reward.lore), "a solve returns a letter and a story line");
ok(r.unlocked.length >= 1, "solving unlocks follow-up cases");
ok(r.achievements.some((x) => x.id === "first-case"), "achievements are awarded on the server");
r = await answer(b.token, "ops-first-contact", "logvault");
ok(r.correct && !r.firstBlood && r.points === 100, "second solver gets normal points");

console.log("Hints cost points");
const hinted = await call("/api/cases/common-lost-and-found/hint", { token: b.token, method: "POST" });
ok(hinted.data.hints?.length === 1, "a hint is revealed on request");
r = await answer(b.token, "common-lost-and-found", "keyboard");
ok(r.correct && r.points === 60 + 30 - 15, "hint cost comes off the reward (first blood included)");

console.log("Personal cases");
const coffeeA = await call("/api/cases/common-coffee-machine", { token: a.token });
const coffeeB = await call("/api/cases/common-coffee-machine", { token: b.token });
const wordA = decodeCoffee(coffeeA.data.body);
const wordB = decodeCoffee(coffeeB.data.body);
r = await answer(a.token, "common-coffee-machine", wordA);
ok(r.correct, `player A's own codes decode to their answer (${wordA})`);
if (wordA !== wordB) {
  r = await answer(b.token, "common-coffee-machine", wordA);
  ok(!r.correct, "player A's answer doesn't work for player B");
} else {
  console.log("  · both players drew the same word this run; skipping the cross-check");
}

console.log("Brute force is throttled");
const c = await join(`Cy ${run}`, "qa");
let throttled = false;
for (let i = 0; i < 9; i += 1) {
  r = await answer(c.token, "qa-first-contact", `guess${i}`);
  if (r.throttled) throttled = true;
}
ok(throttled, "ARCHIE sulks after 8 guesses in 5 minutes");

console.log("Hidden eggs");
const signal = board.headers.get("x-archie-signal");
ok(!!signal, "authenticated responses carry a personal signal header");
let d = await call("/api/discover", { token: b.token, method: "POST", body: { code: signal } });
ok(d.data.found === false, "another player's code doesn't work");
d = await call("/api/discover", { token: a.token, method: "POST", body: { code: signal } });
ok(d.data.found && d.data.points === 50, "the header egg can be reported");
const w = await call("/api/whisper", { token: a.token });
d = await call("/api/discover", { token: a.token, method: "POST", body: { code: w.data.whisper } });
ok(d.data.found, "the console whisper can be reported");
const bsm = await call("/api/egg/basement", { token: a.token });
d = await call("/api/discover", { token: a.token, method: "POST", body: { code: bsm.data.code } });
ok(d.data.found, "the basement egg can be reported");
ok(d.data.achievements?.some((x) => x.id === "egg-hunter"), "three eggs earn Egg Hunter");
d = await call("/api/discover", { token: a.token, method: "POST", body: { code: "kettle nocT 42" } });
ok(d.data.found, "physical codes work however they're typed");
const night = await call("/api/egg/night-shift", { token: a.token });
const hour = new Date().getHours();
ok((hour >= 19 || hour < 6) === !!night.data.code, "the night-shift egg follows the server clock");
const notEgg = await call("/api/egg/header-signal", { token: a.token });
ok(notEgg.status === 404, "eggs that aren't revealed by a visit can't be fetched directly");

console.log("Pages");
const robots = await call("/robots.txt");
ok(/Disallow: \/basement/.test(robots.text), "robots.txt points at the basement");
const basementPage = await call("/basement");
ok(basementPage.status === 200 && /B1/.test(basementPage.text), "the basement page exists");
const lost = await call("/no/such/page");
ok(lost.status === 404 && /lost-page/.test(lost.text), "unknown pages get the 404 egg page");
const escape = await call("/../server/crypto.js");
ok(escape.status === 404 && !/hmac/i.test(escape.text), "server files can't be fetched");
const contentFile = await call("/content/challenges/ops.js");
ok(contentFile.status === 404 && !/logvault/.test(contentFile.text), "case files can't be fetched");

console.log("The vault needs several desks");
const crew = [
  [a, "eng-first-contact", "echo"],
  [b, "sup-first-contact", "chen"],
];
for (const [name, desk, id, ans] of [
  [`Di ${run}`, "qa", "qa-first-contact", "tc-04"],
  [`Ed ${run}`, "ops", "ops-first-contact", "logvault"],
  [`Fi ${run}`, "creative", "creative-first-contact", "forest green"],
]) {
  const p = await join(name, desk);
  crew.push([p, id, ans]);
}
for (const [p, id, ans] of crew) await answer(p.token, id, ans);
let vault;
for (const [p] of crew) {
  const v = (await call("/api/vaults", { token: p.token })).data.vaults[0];
  if (!v.myShard) { ok(false, "an eligible player gets a shard"); continue; }
  const s = await call(`/api/vaults/${v.id}/shard`, { token: p.token, method: "POST", body: { shard: v.myShard } });
  vault = s.data;
}
const vaultState = (await call("/api/vaults", { token: a.token })).data.vaults[0];
ok(!!vaultState.opened, "the vault opens with five shards from different desks");
const afterVault = await call("/api/board", { token: a.token });
ok(afterVault.data.cases.some((x) => x.id === "vault-server-room" && x.status === "open"), "the vault unlocks a hidden case for everyone");

console.log("Difficulty ladder");
const g = await join(`Gil ${run}`, "engineering");
let gb = (await call("/api/board", { token: g.token })).data;
ok(gb.cases.every((x) => ["rookie", "agent", "detective", "fiendish"].includes(x.tier)), "every case on the board has a difficulty");
ok(gb.cases.find((x) => x.id === "eng-xor-diary")?.status === "locked", "a Detective case starts locked");
ok(!gb.cases.some((x) => x.id === "night-auditor"), "the hidden cross-desk Fiendish case isn't listed yet");
for (const [id, ans] of [
  ["eng-first-contact", "echo"],
  ["eng-stack-trace", "the basement"],
  ["eng-ghost-commit", "night"],
  ["eng-xor-diary", "insomnia"],
]) {
  r = await answer(g.token, id, ans);
  ok(r.correct, `${id} closes with its answer`);
}
const vig = await call("/api/cases/eng-vigenere", { token: g.token });
ok(vig.status === 200 && vig.data.tier === "fiendish", "the Fiendish case opens once its chain is closed");
r = await answer(g.token, "eng-vigenere", "Under the mat");
ok(r.correct && r.achievements.some((x) => x.id === "fiendish-one"), "closing a Fiendish case earns Devil in the Details");

console.log("Realtime");
{
  // Listen as one player while another closes a case.
  const listener = await join(`Hal ${run}`, "ops");
  const solver = await join(`Ivy ${run}`, "creative");
  const ctrl = new AbortController();
  const seen = { case: null, wire: null, scores: null };
  const res = await fetch(`${BASE}/api/stream?token=${listener.token}`, { signal: ctrl.signal });
  const reader = res.body.getReader();
  const done = (async () => {
    let buf = "";
    try {
      for (;;) {
        const { value, done: end } = await reader.read();
        if (end) break;
        buf += new TextDecoder().decode(value);
        for (const block of buf.split("\n\n").slice(0, -1)) {
          const type = block.match(/^event: (\w+)/m)?.[1];
          const data = block.match(/^data: (.*)$/m)?.[1];
          if (type && data && type in seen && !seen[type]) seen[type] = JSON.parse(data);
        }
        buf = buf.slice(buf.lastIndexOf("\n\n") + 2);
        if (seen.case && seen.wire && seen.scores) break;
      }
    } catch { /* aborted */ }
  })();
  await new Promise((r) => setTimeout(r, 200));
  await answer(solver.token, "creative-first-contact", "forest green");
  await Promise.race([done, new Promise((r) => setTimeout(r, 3000))]);
  ctrl.abort();
  ok(seen.case?.id === "creative-first-contact" && seen.case.solvedBy >= 1, "closing a case is pushed to other players live");
  ok(seen.case && !("title" in seen.case), "the live case event doesn't carry the title");
  ok(seen.wire && !/Brand Guide/i.test(seen.wire.text), "the wire describes the case without naming it");
  ok(Array.isArray(seen.scores?.players), "the leaderboard is pushed live");
}

console.log("Leaderboard and wire");
const lb = await call("/api/leaderboard");
ok(lb.data.players.length >= 6 && lb.data.players[0].score >= lb.data.players[1].score, "the leaderboard is ranked by score");
ok(lb.data.desks.length >= 3, "the desk war has entries");
const feed = await call("/api/feed");
ok(feed.data.events.some((e) => /first/i.test(e.text)), "the wire announces first blood");
ok(!feed.data.events.some((e) => /logvault|keyboard|chen/i.test(e.text)), "the wire never contains answers");

if (ADMIN) {
  const rumor = await call("/api/admin/rumor", { method: "POST", body: { text: "Someone saw ARCHIE in the printer logs." }, headers: { "X-Admin-Key": ADMIN } });
  ok(rumor.status === 200, "organisers can post a rumour");
  const overview = await call("/api/admin/overview", { headers: { "X-Admin-Key": ADMIN } });
  ok(overview.data.cases?.length > 0, "organisers can see case stats");
}
const noAdmin = await call("/api/admin/overview");
ok(noAdmin.status === 404, "organiser routes are invisible without the key");

console.log("Resume on another device");
const resumed = await call("/api/resume", { method: "POST", body: { name: `Ada ${run}`, passphrase: a.passphrase } });
ok(resumed.status === 200 && resumed.data.token, "name + passphrase gives a new token");
const wrongPass = await call("/api/resume", { method: "POST", body: { name: `Ada ${run}`, passphrase: "nope-nope-nope-nope" } });
ok(wrongPass.status === 401, "a wrong passphrase is refused");

console.log(failures ? `\n${failures} check(s) failed.` : "\nAll checks passed.");
process.exit(failures ? 1 : 0);
