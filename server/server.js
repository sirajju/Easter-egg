import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, extname, join, normalize as normPath } from "node:path";
import { fileURLToPath } from "node:url";
import { openDb } from "./db.js";
import { content, DESKS, loadContent, watchContent } from "./content.js";
import { createEngine } from "./engine.js";
import {
  hashSecret,
  loadSecret,
  newId,
  newPassphrase,
  newToken,
  sha256,
  verifySecret,
} from "./crypto.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = join(ROOT, "public");
const CONTENT = join(ROOT, "content");
const DATA = process.env.NIGHTSHIFT_DATA || join(ROOT, "data");
const PORT = Number(process.env.PORT) || 4404;
const ADMIN_KEY = process.env.NIGHTSHIFT_ADMIN_KEY || "";

loadSecret(join(DATA, "secret.key"));
const db = openDb(join(DATA, "nightshift.db"));
await loadContent(CONTENT);
const engine = createEngine(db);
watchContent(CONTENT, () => broadcast("board", {}));

// ---- small helpers ----------------------------------------------------------

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".json": "application/json",
};

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "same-origin",
  "X-Frame-Options": "DENY",
};

function send(res, status, body, headers = {}) {
  const isJson = typeof body !== "string" && !Buffer.isBuffer(body);
  res.writeHead(status, {
    ...SECURITY_HEADERS,
    "Content-Type": isJson ? "application/json; charset=utf-8" : headers["Content-Type"] || "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers,
  });
  res.end(isJson ? JSON.stringify(body) : body);
}

async function readJson(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 16 * 1024) throw Object.assign(new Error("too large"), { status: 413 });
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw Object.assign(new Error("bad json"), { status: 400 });
  }
}

/** Fixed-window limiter keyed by anything (an IP, a player). */
const buckets = new Map();
function limited(key, max, windowMs) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now - b.start > windowMs) {
    buckets.set(key, { start: now, n: 1 });
    return false;
  }
  b.n += 1;
  return b.n > max;
}
setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) if (now - b.start > 15 * 60 * 1000) buckets.delete(k);
}, 60 * 1000).unref();

const ipOf = (req) =>
  (req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress || "?").trim();

const NAME_RE = /^[\p{L}\p{N}][\p{L}\p{N} ._'-]{1,22}[\p{L}\p{N}.]$/u;

const stmt = {
  byToken: db.prepare("SELECT * FROM players WHERE token_hash = ?"),
  byName: db.prepare("SELECT * FROM players WHERE name = ?"),
  insert: db.prepare(
    "INSERT INTO players (id, name, desk, token_hash, pass_hash, created_at, last_seen) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ),
  seen: db.prepare("UPDATE players SET last_seen = ? WHERE id = ?"),
  rotate: db.prepare("UPDATE players SET token_hash = ? WHERE id = ?"),
  count: db.prepare("SELECT COUNT(*) AS n FROM players"),
};

function authPlayer(req, url) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : url.searchParams.get("token");
  if (!token || token.length > 128) return null;
  const player = stmt.byToken.get(sha256(token));
  if (player) stmt.seen.run(Date.now(), player.id);
  return player || null;
}

// ---- live updates (Server-Sent Events) --------------------------------------

const clients = new Set();

function broadcast(type, data) {
  const line = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) res.write(line);
}

engine.bus.on("event", (event) => broadcast("wire", event));
engine.bus.on("vault", (id) => broadcast("vault", { id }));
let scoresTimer = null;
engine.bus.on("scores", () => {
  // Coalesce bursts (a solve that also earns achievements) into one push.
  clearTimeout(scoresTimer);
  scoresTimer = setTimeout(() => broadcast("scores", engine.leaderboard()), 250);
});
setInterval(() => {
  for (const res of clients) res.write(": keep-alive\n\n");
}, 25 * 1000).unref();

// ---- routes -----------------------------------------------------------------

async function api(req, res, url) {
  const path = url.pathname;
  const method = req.method;

  if (path === "/api/desks" && method === "GET") {
    return send(res, 200, { desks: DESKS, players: stmt.count.get().n });
  }

  if (path === "/api/join" && method === "POST") {
    if (limited(`join:${ipOf(req)}`, 10, 10 * 60 * 1000))
      return send(res, 429, { error: "Too many new case files from here. Wait a few minutes." });
    const { name: rawName, desk } = await readJson(req);
    const name = String(rawName || "").trim().replace(/\s+/g, " ");
    if (!NAME_RE.test(name))
      return send(res, 400, { error: "Use 3–24 letters, numbers, spaces, dots, dashes or apostrophes." });
    if (!DESKS[desk]) return send(res, 400, { error: "Pick a desk." });
    if (stmt.byName.get(name))
      return send(res, 409, { error: "That name is already on a case file. Continue with its passphrase, or choose another." });
    const token = newToken();
    const passphrase = newPassphrase();
    const id = newId();
    stmt.insert.run(id, name, desk, sha256(token), hashSecret(passphrase), Date.now(), Date.now());
    engine.announce("join", id, `${name} opened a case file at the ${DESKS[desk]} desk.`);
    engine.changed();
    return send(res, 201, { token, passphrase, name, desk });
  }

  if (path === "/api/resume" && method === "POST") {
    if (limited(`resume:${ipOf(req)}`, 12, 10 * 60 * 1000))
      return send(res, 429, { error: "Too many attempts. Wait a few minutes." });
    const { name, passphrase } = await readJson(req);
    const player = stmt.byName.get(String(name || "").trim());
    const phrase = String(passphrase || "").trim().toLowerCase().replace(/\s+/g, "-");
    if (!player || !verifySecret(phrase, player.pass_hash))
      return send(res, 401, { error: "That name and passphrase don't match a case file." });
    // A fresh token per device; older devices keep working until this one is used.
    const token = newToken();
    stmt.rotate.run(sha256(token), player.id);
    return send(res, 200, { token, name: player.name, desk: player.desk });
  }

  if (path === "/api/leaderboard" && method === "GET") {
    return send(res, 200, engine.leaderboard());
  }

  if (path === "/api/feed" && method === "GET") {
    return send(res, 200, { events: engine.feed(40) });
  }

  // ---- organiser ----
  if (path.startsWith("/api/admin/")) {
    const key = req.headers["x-admin-key"];
    if (!ADMIN_KEY || key !== ADMIN_KEY) return send(res, 404, { error: "not_found" });
    if (path === "/api/admin/rumor" && method === "POST") {
      const { text } = await readJson(req);
      const clean = String(text || "").trim().slice(0, 240);
      if (!clean) return send(res, 400, { error: "empty" });
      engine.announce("rumor", null, clean);
      return send(res, 200, { ok: true });
    }
    if (path === "/api/admin/overview" && method === "GET") {
      const solves = db.prepare("SELECT case_id, COUNT(*) AS n FROM solves GROUP BY case_id").all();
      const opens = db.prepare("SELECT case_id, COUNT(*) AS n, SUM(hints) AS hints, SUM(wrong) AS wrong FROM progress GROUP BY case_id").all();
      const byId = new Map(opens.map((o) => [o.case_id, o]));
      const solvedById = new Map(solves.map((s) => [s.case_id, s.n]));
      const cases = [...content.cases.values()].map((c) => ({
        id: c.id,
        title: c.title,
        desk: c.desk,
        opened: byId.get(c.id)?.n || 0,
        solved: solvedById.get(c.id) || 0,
        hints: byId.get(c.id)?.hints || 0,
        wrong: byId.get(c.id)?.wrong || 0,
      }));
      return send(res, 200, { players: stmt.count.get().n, cases });
    }
    return send(res, 404, { error: "not_found" });
  }

  // ---- everything below needs a case file ----
  const player = authPlayer(req, url);
  if (!player) return send(res, 401, { error: "no_case_file" });
  if (limited(`api:${player.id}`, 240, 60 * 1000))
    return send(res, 429, { error: "Slow down. ARCHIE is a very old process." });

  // Hidden egg: every authenticated response carries a personal signal.
  const signal = engine.eggCode(player, "header-signal");
  if (signal) res.setHeader("X-Archie-Signal", signal);

  if (path === "/api/stream" && method === "GET") {
    res.writeHead(200, {
      ...SECURITY_HEADERS,
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
    });
    res.write("retry: 4000\n\n");
    clients.add(res);
    req.on("close", () => clients.delete(res));
    return;
  }

  if (path === "/api/me" && method === "GET") return send(res, 200, engine.profile(player));
  if (path === "/api/board" && method === "GET") return send(res, 200, engine.board(player));
  if (path === "/api/achievements" && method === "GET")
    return send(res, 200, { achievements: engine.achievementList(player) });
  if (path === "/api/eggs" && method === "GET") return send(res, 200, { eggs: engine.eggList(player) });
  if (path === "/api/vaults" && method === "GET") return send(res, 200, { vaults: engine.vaults(player) });

  // ARCHIE's whisper: the console egg. Only hands out a code, never an answer.
  if (path === "/api/whisper" && method === "GET") {
    return send(res, 200, { whisper: engine.eggCode(player, "console-whisper") });
  }

  const eggMatch = path.match(/^\/api\/egg\/([a-z0-9-]+)$/);
  if (eggMatch && method === "GET") {
    const egg = content.eggs.get(eggMatch[1]);
    // Only eggs that are revealed by visiting something can be asked for here.
    if (!egg || !egg.revealedBy) return send(res, 404, { error: "not_found" });
    const code = engine.eggCode(player, egg.id);
    if (!code) return send(res, 200, { code: null, message: egg.closedMessage || "Nothing here right now." });
    return send(res, 200, { code, message: egg.revealMessage || "" });
  }

  if (path === "/api/discover" && method === "POST") {
    if (limited(`discover:${player.id}`, 15, 5 * 60 * 1000))
      return send(res, 429, { error: "ARCHIE needs a minute before checking more codes." });
    const { code } = await readJson(req);
    return send(res, 200, engine.discover(player, code));
  }

  const vaultMatch = path.match(/^\/api\/vaults\/([a-z0-9-]+)\/shard$/);
  if (vaultMatch && method === "POST") {
    const { shard } = await readJson(req);
    const result = engine.submitShard(player, vaultMatch[1], shard);
    return send(res, result.error ? 400 : 200, result);
  }

  const caseMatch = path.match(/^\/api\/cases\/([a-z0-9-]+)(\/answer|\/hint)?$/);
  if (caseMatch) {
    const [, id, action] = caseMatch;
    let result;
    if (!action && method === "GET") result = engine.openCase(player, id);
    else if (action === "/hint" && method === "POST") result = engine.takeHint(player, id);
    else if (action === "/answer" && method === "POST") {
      const { answer } = await readJson(req);
      result = engine.answer(player, id, String(answer || "").slice(0, 200));
    } else return send(res, 405, { error: "method" });
    const status =
      result.error === "not_found" ? 404 : result.error === "locked" ? 403 : result.error ? 400 : 200;
    return send(res, status, result);
  }

  return send(res, 404, { error: "not_found" });
}

async function serveFile(res, file, status = 200) {
  const body = await readFile(file);
  send(res, status, body, {
    "Content-Type": MIME[extname(file)] || "application/octet-stream",
    // Cases and scripts change during a hunt: always fetch the current ones.
    "Cache-Control": [".html", ".js", ".css"].includes(extname(file)) ? "no-cache" : "public, max-age=300",
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  try {
    if (url.pathname.startsWith("/api/")) return await api(req, res, url);
    if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, "Method not allowed");

    // The basement is only "secret" because robots.txt says so.
    if (url.pathname === "/basement" || url.pathname === "/basement/")
      return await serveFile(res, join(PUBLIC, "basement.html"));

    const rel = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
    const file = normPath(join(PUBLIC, rel));
    if (file.startsWith(PUBLIC) && existsSync(file) && !file.endsWith("\\") && extname(file)) {
      return await serveFile(res, file);
    }
    return await serveFile(res, join(PUBLIC, "404.html"), 404);
  } catch (err) {
    if (!res.headersSent) send(res, err.status || 500, { error: err.status ? err.message : "server_error" });
    if (!err.status) console.error(err);
  }
});

server.listen(PORT, () => {
  console.log(`NIGHTSHIFT is running on http://localhost:${PORT}`);
  if (!ADMIN_KEY) console.log("Organiser tools are off (set NIGHTSHIFT_ADMIN_KEY to enable).");
});
