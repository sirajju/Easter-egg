// NIGHTSHIFT client. It renders what the server sends and nothing more:
// no answers, no hidden case text, no scores are computed here.

const TOKEN_KEY = "nightshift.token";
const THEME_KEY = "nightshift.theme";
const $ = (sel) => document.querySelector(sel);

const store = {
  get token() {
    try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
  },
  set token(value) {
    try {
      if (value) localStorage.setItem(TOKEN_KEY, value);
      else localStorage.removeItem(TOKEN_KEY);
    } catch { /* storage blocked: the session lasts until reload */ }
  },
};

const state = {
  me: null,
  board: null,
  filter: "all",
  desks: {},
  wireIds: new Set(),
};

// ---- tiny DOM helper: text is always text ---------------------------------

function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === "class") el.className = value;
    else if (key === "html") el.innerHTML = value; // server-authored case content only
    else if (key.startsWith("on")) el.addEventListener(key.slice(2), value);
    else if (key === "dataset") Object.assign(el.dataset, value);
    else el.setAttribute(key, value === true ? "" : value);
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

/** replaceChildren that skips null/undefined/false (they'd render as text). */
const fill = (el, ...children) =>
  el.replaceChildren(...children.flat().filter((c) => c !== null && c !== undefined && c !== false));

// ---- API ------------------------------------------------------------------

async function api(path, { method = "GET", body } = {}) {
  const headers = { Accept: "application/json" };
  if (store.token) headers.Authorization = `Bearer ${store.token}`;
  if (body) headers["Content-Type"] = "application/json";
  const res = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && store.token && !path.startsWith("/api/resume")) {
    store.token = null;
    location.hash = "";
    render();
  }
  return { ok: res.ok, status: res.status, data, headers: res.headers };
}

// ---- toasts & modal --------------------------------------------------------

function toast(title, body, ms = 6000) {
  const el = h("div", { class: "toast", role: "status" }, h("strong", {}, title), body || "");
  $("#toasts").append(el);
  setTimeout(() => el.remove(), ms);
}

function codeToast(title, message, code) {
  const body = h("span", {}, message ? `${message} ` : "", "Report this code under Discoveries: ", h("code", {}, code));
  toast(title, body, 15000);
}

function modal(content) {
  const backdrop = h("div", { class: "modal-backdrop" }, h("div", { class: "folder modal", "data-tab": "ARCHIE", role: "dialog", "aria-modal": "true" }, content));
  document.body.append(backdrop);
  const close = () => backdrop.remove();
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) close(); });
  return close;
}

// ---- night shift -----------------------------------------------------------

const isNight = () => { const hr = new Date().getHours(); return hr >= 19 || hr < 6; };

function applyTheme() {
  let pref = null;
  try { pref = localStorage.getItem(THEME_KEY); } catch { /* ignore */ }
  const root = document.documentElement;
  root.classList.toggle("night", isNight());
  if (pref) root.dataset.theme = pref;
  else if (isNight()) root.dataset.theme = "dark"; // the lights go off at 19:00
  else delete root.dataset.theme;
  $("#lamp").hidden = !isNight();
}

// ---- formatting -----------------------------------------------------------

const deskName = (id) => state.desks[id] || id;
const timeAgo = (ms) => {
  const s = Math.max(1, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const hr = Math.round(m / 60);
  if (hr < 24) return `${hr}h ago`;
  return new Date(ms).toLocaleDateString();
};

// ---- chrome ----------------------------------------------------------------

async function refreshMe() {
  const { ok, data } = await api("/api/me");
  if (!ok) return;
  state.me = data;
  $("#player-name").textContent = data.name;
  $("#player-meta").textContent = `${data.deskName} desk${data.rank ? ` · #${data.rank} of ${data.of}` : ""}`;
  $("#player-score").textContent = data.score;
}

function setChrome(signedIn) {
  $("#topbar").hidden = !signedIn;
  $("#wire").hidden = !signedIn;
  $("#footer").hidden = !signedIn;
  document.querySelector(".shell").classList.toggle("solo", !signedIn);
}

function markTab(view) {
  for (const a of document.querySelectorAll("#tabs a")) {
    if (a.dataset.view === view) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  }
}

// ---- views -----------------------------------------------------------------

const views = {};

views.join = async (main) => {
  const desksRes = await api("/api/desks");
  state.desks = desksRes.data.desks || {};
  let desk = null;
  const deskBlurbs = {
    engineering: "Code, logs, commits",
    support: "Tickets and customers",
    qa: "Find what's wrong",
    ops: "Incidents and on-call",
    creative: "Design, brand, copy",
    common: "No tech needed",
  };

  const error = h("p", { class: "error", role: "alert" });
  const nameInput = h("input", { type: "text", id: "join-name", maxlength: "24", autocomplete: "nickname", placeholder: "e.g. Priya from QA", required: true });
  const deskButtons = Object.entries(state.desks).map(([id, name]) =>
    h("button", {
      type: "button",
      class: "desk-option",
      "aria-pressed": "false",
      onclick: (e) => {
        desk = id;
        for (const b of e.currentTarget.parentElement.children) b.setAttribute("aria-pressed", "false");
        e.currentTarget.setAttribute("aria-pressed", "true");
      },
    }, h("strong", {}, name), h("span", {}, deskBlurbs[id] || ""))
  );

  const joinForm = h("form", {
    class: "stack",
    onsubmit: async (e) => {
      e.preventDefault();
      error.textContent = "";
      if (!desk) { error.textContent = "Pick the desk you sit at."; return; }
      const { ok, data } = await api("/api/join", { method: "POST", body: { name: nameInput.value, desk } });
      if (!ok) { error.textContent = data.error || "ARCHIE couldn't open a file."; return; }
      store.token = data.token;
      showPassphrase(data.passphrase);
      location.hash = "#cases";
      render();
    },
  },
    h("div", { class: "field" }, h("label", { for: "join-name" }, "Your display name"), nameInput),
    h("div", { class: "field" }, h("span", { class: "eyebrow" }, "Your desk"), h("div", { class: "desk-picker" }, deskButtons)),
    error,
    h("div", {}, h("button", { class: "btn", type: "submit" }, "Open a case file"))
  );

  const resumeError = h("p", { class: "error", role: "alert" });
  const resumeName = h("input", { type: "text", id: "resume-name", autocomplete: "nickname" });
  const resumePass = h("input", { type: "password", id: "resume-pass", autocomplete: "off", placeholder: "four-words-like-this" });
  const resumeForm = h("form", {
    class: "stack",
    hidden: true,
    onsubmit: async (e) => {
      e.preventDefault();
      const { ok, data } = await api("/api/resume", { method: "POST", body: { name: resumeName.value, passphrase: resumePass.value } });
      if (!ok) { resumeError.textContent = data.error || "No match."; return; }
      store.token = data.token;
      location.hash = "#cases";
      render();
    },
  },
    h("div", { class: "field" }, h("label", { for: "resume-name" }, "Display name"), resumeName),
    h("div", { class: "field" }, h("label", { for: "resume-pass" }, "Passphrase"), resumePass),
    resumeError,
    h("div", {}, h("button", { class: "btn", type: "submit" }, "Continue my case file"))
  );

  const toggle = h("button", {
    type: "button",
    class: "link-button",
    onclick: () => {
      const showingResume = !resumeForm.hidden;
      resumeForm.hidden = showingResume;
      joinForm.hidden = !showingResume;
      toggle.textContent = showingResume ? "I already have a case file" : "I'm new here";
    },
  }, "I already have a case file");

  const typed = h("h1", { class: "typed" });
  fill(main, 
    h("section", { class: "intro" },
      h("div", { class: "intro-copy" },
        h("span", { class: "eyebrow" }, `Case files open: ${desksRes.data.players ?? 0}`),
        typed,
        h("p", {}, "Every night, a forgotten process called ARCHIE files away things that shouldn't exist: a commit nobody wrote, a ticket that arrived tomorrow, a colleague nobody has met."),
        h("p", {}, "Open a case file with just a name. Close cases on your desk and everyone else's, find what's hidden around the office, and find out what happened to m."),
        h("p", { class: "muted" }, "The answers aren't in this page. Don't bother looking. Other things might be.")
      ),
      h("div", { class: "folder", "data-tab": "New case file" }, h("div", { class: "stack" }, joinForm, resumeForm, h("div", {}, toggle)))
    )
  );
  typeOut(typed, "Somebody on the night shift never logged out.");
  nameInput.focus();
};

function typeOut(el, text) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) { el.textContent = text; return; }
  let i = 0;
  const tick = () => {
    el.textContent = text.slice(0, ++i);
    if (i < text.length) setTimeout(tick, 38 + Math.random() * 60);
  };
  tick();
}

function showPassphrase(phrase) {
  const close = modal(h("div", { class: "stack" },
    h("h2", {}, "Keep this somewhere safe"),
    h("p", {}, "This passphrase lets you continue your case file on another device or browser. ARCHIE won't show it again."),
    h("div", { class: "passphrase" }, phrase),
    h("div", { class: "row" },
      h("button", { class: "btn", type: "button", onclick: () => { navigator.clipboard?.writeText(phrase).then(() => toast("Copied", "Passphrase copied."), () => {}); } }, "Copy"),
      h("button", { class: "btn ghost", type: "button", onclick: () => close() }, "I've written it down"))
  ));
}

views.cases = async (main) => {
  const { ok, data } = await api("/api/board");
  if (!ok) return;
  state.board = data;
  state.desks = data.desks;

  const letters = h("div", { class: "letters", title: "Letters ARCHIE has stamped on your file" },
    h("span", { class: "eyebrow" }, "Letters"),
    ...Array.from({ length: 6 }, (_, i) => {
      const got = data.letters[i];
      return h("span", { class: `letter-slot${got ? " got" : ""}` }, got || "");
    })
  );

  const deskIds = ["all", ...Object.keys(data.desks)];
  const filters = h("div", { class: "filters", role: "group", "aria-label": "Desk" },
    deskIds.map((id) =>
      h("button", {
        type: "button",
        class: "chip",
        "aria-pressed": String(state.filter === id),
        onclick: () => { state.filter = id; views.cases(main); },
      }, id === "all" ? "All desks" : data.desks[id])
    )
  );

  const list = data.cases.filter((c) => state.filter === "all" || c.desk === state.filter);
  const order = { open: 0, solved: 1, locked: 2 };
  list.sort((a, b) => order[a.status] - order[b.status]);
  const open = data.cases.filter((c) => c.status === "open").length;
  const solved = data.cases.filter((c) => c.status === "solved").length;

  fill(main, 
    h("div", { class: "view-head" },
      h("div", { class: "stack", style: "gap:.3rem" },
        h("span", { class: "eyebrow" }, `${solved} closed · ${open} open · ${data.cases.length} known`),
        h("h1", {}, "The case board")),
      letters),
    filters,
    list.length
      ? h("div", { class: "cases" }, list.map(caseCard))
      : h("p", { class: "muted" }, "Nothing filed on this desk yet. ARCHIE is still writing.")
  );
};

function caseCard(c) {
  const locked = c.status === "locked";
  return h("button", {
    type: "button",
    class: `case-card${locked ? " locked" : ""}`,
    "data-desk": deskName(c.desk),
    title: locked ? c.lockedWhy : "",
    onclick: () => {
      if (locked) { toast("Locked", c.lockedWhy); return; }
      location.hash = `#case/${c.id}`;
    },
  },
    c.status === "solved" && h("span", { class: "stamp" }, "CLOSED"),
    locked && h("span", { class: "stamp", style: "opacity:.5" }, "LOCKED"),
    h("span", { class: "case-title" }, c.title),
    h("span", { class: "case-teaser" }, locked ? c.lockedWhy : c.teaser),
    h("span", { class: "tags" },
      c.personal && h("span", { class: "tag personal" }, "Yours only"),
      c.timed && h("span", { class: "tag timed" }, "Night shift"),
      c.isNew && c.status !== "locked" && h("span", { class: "tag new" }, "Unlocked")),
    h("span", { class: "case-meta" },
      h("span", { class: "case-points" }, `${c.points} pts`),
      h("span", {}, c.solvedBy ? `closed by ${c.solvedBy}` : "nobody yet"))
  );
}

views.case = async (main, id) => {
  const { ok, status, data } = await api(`/api/cases/${encodeURIComponent(id)}`);
  if (!ok) {
    fill(main, h("div", { class: "folder", "data-tab": "Locked" },
      h("h2", {}, status === 404 ? "No such case" : "This case is still locked"),
      h("p", { class: "muted" }, data.why || "ARCHIE hasn't filed it for you yet."),
      h("a", { href: "#cases" }, "Back to the board")));
    return;
  }

  const say = h("div", { class: "archie-says", hidden: true, role: "status" });
  const input = h("input", { type: "text", id: "answer", autocomplete: "off", spellcheck: "false", placeholder: "Your answer" });
  const submit = h("button", { class: "btn", type: "submit" }, "File answer");
  const result = h("div", { class: "stack" });

  const form = h("form", {
    class: "answer-form",
    onsubmit: async (e) => {
      e.preventDefault();
      if (!input.value.trim()) return;
      submit.disabled = true;
      const res = await api(`/api/cases/${encodeURIComponent(id)}/answer`, { method: "POST", body: { answer: input.value } });
      submit.disabled = false;
      const r = res.data;
      say.hidden = false;
      if (r.correct) {
        say.className = "archie-says good";
        say.textContent = r.already ? "You already closed this one." : r.firstBlood
          ? `Correct. +${r.points} points. First in the office to crack it.`
          : `Correct. +${r.points} points.`;
        form.hidden = true;
        hintBtn.hidden = true;
        showSolved(result, r.reward, r.unlocked, true);
        for (const a of r.achievements || []) toast(`Achievement: ${a.title}`, `${a.description} +${a.points}`);
        refreshMe();
      } else {
        say.className = "archie-says bad";
        say.textContent = r.message || r.error || "Not filed.";
        input.select();
      }
    },
  }, input, submit);

  const hintsBox = h("div", { class: "hints" }, data.hints.map((t) => h("div", { class: "hint" }, t)));
  const hintBtn = h("button", {
    type: "button",
    class: "btn ghost small",
    hidden: data.solved || !data.hintsLeft,
    onclick: async () => {
      const res = await api(`/api/cases/${encodeURIComponent(id)}/hint`, { method: "POST" });
      if (!res.ok) return;
      fill(hintsBox, ...res.data.hints.map((t) => h("div", { class: "hint" }, t)));
      hintBtn.hidden = !res.data.hintsLeft;
      hintBtn.textContent = `Ask ARCHIE for a hint (−${res.data.nextHintCost} pts)`;
    },
  }, `Ask ARCHIE for a hint (−${data.nextHintCost} pts)`);

  fill(main, 
    h("p", {}, h("a", { href: "#cases" }, "← The case board")),
    h("article", { class: "folder", "data-tab": `${deskName(data.desk)} · ${data.points} pts` },
      h("div", { class: "stack" },
        h("div", { class: "case-head" },
          h("div", { class: "stack", style: "gap:.25rem" },
            h("span", { class: "eyebrow" }, data.solvedBy ? `Closed by ${data.solvedBy} so far` : "Nobody has closed this yet"),
            h("h1", {}, data.title),
            data.personal && h("span", { class: "tag personal", style: "align-self:flex-start" }, "This case is generated for you")),
          data.solved && h("span", { class: "stamp big" }, "CLOSED")),
        h("div", { class: "case-body", html: data.body }),
        data.solved ? null : form,
        say,
        hintsBox,
        h("div", {}, hintBtn),
        result
      )
    )
  );
  if (data.solved) showSolved(result, data.reward, [], false);
  else input.focus();
};

function showSolved(container, reward, unlocked, fresh) {
  fill(container, 
    fresh && h("div", {}, h("span", { class: "stamp big slam" }, "CASE CLOSED")),
    reward?.letter && h("p", {}, "ARCHIE stamps a letter on your file: ", h("strong", { class: "mono" }, reward.letter)),
    reward?.lore && h("div", { class: "lore" }, reward.lore),
    unlocked?.length
      ? h("div", { class: "stack", style: "gap:.4rem" },
          h("span", { class: "eyebrow" }, "New cases unlocked"),
          ...unlocked.map((u) => h("a", { href: `#case/${u.id}` }, `${u.title} (${deskName(u.desk)})`)))
      : null
  );
}

views.board = async (main) => {
  const { data } = await api("/api/leaderboard");
  renderBoard(main, data);
};

function renderBoard(main, data) {
  const myName = state.me?.name;
  const max = Math.max(1, ...data.desks.map((d) => d.average));
  fill(main, 
    h("div", { class: "view-head" }, h("div", { class: "stack", style: "gap:.3rem" },
      h("span", { class: "eyebrow" }, "Updates live"),
      h("h1", {}, "Leaderboard"))),
    h("div", { class: "board-grid" },
      h("section", { class: "folder", "data-tab": "Investigators" },
        h("div", { class: "table-wrap" },
          h("table", { class: "ranking" },
            h("thead", {}, h("tr", {},
              h("th", {}, "#"), h("th", {}, "Name"), h("th", {}, "Desk"),
              h("th", { class: "num" }, "Cases"), h("th", { class: "num" }, "Eggs"), h("th", { class: "num" }, "Score"))),
            h("tbody", {}, data.players.length
              ? data.players.map((p) => h("tr", { class: p.name === myName ? "me" : "" },
                  h("td", {}, h("span", { class: `rank-badge rank-${p.rank}` }, p.rank)),
                  h("td", {}, p.name, p.firstBloods ? h("span", { class: "muted", title: "First bloods" }, ` ✦${p.firstBloods}`) : ""),
                  h("td", { class: "muted" }, deskName(p.desk)),
                  h("td", { class: "num" }, p.solved),
                  h("td", { class: "num" }, p.eggs),
                  h("td", { class: "num" }, p.score)))
              : h("tr", {}, h("td", { colspan: "6", class: "muted" }, "Nobody yet. Be first."))))
        )),
      h("section", { class: "folder", "data-tab": "Desk war" },
        h("div", { class: "stack" },
          h("p", { class: "muted", style: "margin:0;font-size:.85rem" }, "Average points per active player, so small desks can win."),
          h("div", { class: "desk-war" }, data.desks.map((d) =>
            h("div", { class: "bar-row" },
              h("span", {}, d.name),
              h("span", { class: "bar" }, h("span", { style: `width:${Math.round((d.average / max) * 100)}%` })),
              h("span", { class: "bar-value" }, d.average)))))
      )
    )
  );
}

views.discoveries = async (main) => {
  const { data } = await api("/api/eggs");
  const msg = h("div", { class: "archie-says", hidden: true, role: "status" });
  const input = h("input", { type: "text", id: "discovery", autocomplete: "off", spellcheck: "false", placeholder: "e.g. 7KQ2-MPXA" });
  const form = h("form", {
    class: "answer-form",
    onsubmit: async (e) => {
      e.preventDefault();
      const res = await api("/api/discover", { method: "POST", body: { code: input.value } });
      const r = res.data;
      msg.hidden = false;
      if (r.found) {
        msg.className = "archie-says good";
        msg.textContent = r.already ? `You already reported "${r.egg.title}".` : `Found: ${r.egg.title}. +${r.points} points. ${r.egg.note}`;
        for (const a of r.achievements || []) toast(`Achievement: ${a.title}`, `${a.description} +${a.points}`);
        input.value = "";
        refreshMe();
        setTimeout(() => views.discoveries(main), 2500);
      } else {
        msg.className = "archie-says bad";
        msg.textContent = r.message || r.error || "Nothing.";
      }
    },
  }, input, h("button", { class: "btn", type: "submit" }, "Report"));

  const found = data.eggs.filter((e) => e.found).length;
  fill(main, 
    h("div", { class: "view-head" }, h("div", { class: "stack", style: "gap:.3rem" },
      h("span", { class: "eyebrow" }, `${found} of ${data.eggs.length} found`),
      h("h1", {}, "Discoveries"))),
    h("section", { class: "folder", "data-tab": "Report a discovery" },
      h("div", { class: "stack" },
        h("p", { style: "margin:0" }, "Found a strange code somewhere? In this app, on a printout, taped under a desk? File it here. Codes in the app are personal: a colleague's won't work for you."),
        form, msg)),
    h("section", { style: "margin-top:2rem" },
      h("div", { class: "grid" }, data.eggs.map((egg) =>
        egg.found
          ? h("div", { class: "tile earned" }, h("span", { class: "tile-title" }, egg.title), h("span", { class: "muted" }, egg.note), h("span", { class: "tile-points" }, `+${egg.points}`))
          : h("div", { class: "tile dim" }, h("span", { class: "tile-title" }, "Unfound"), h("span", { class: "muted" }, egg.hint), h("span", { class: "tile-points" }, `${egg.points} pts`))
      )))
  );
};

views.vault = async (main) => {
  const { data } = await api("/api/vaults");
  fill(main, 
    h("div", { class: "view-head" }, h("div", { class: "stack", style: "gap:.3rem" },
      h("span", { class: "eyebrow" }, "Collaborative"),
      h("h1", {}, "Vaults"))),
    ...data.vaults.map((v) => {
      const holes = Math.max(v.needShards, v.shards);
      return h("section", { class: "folder", "data-tab": v.opened ? "Open" : `${v.shards} of ${v.needShards} shards` },
        h("div", { class: "stack" },
          h("h2", {}, v.title),
          h("p", { style: "margin:0" }, v.body),
          h("div", { class: "vault-progress", "aria-label": `${v.shards} shards fitted` },
            Array.from({ length: holes }, (_, i) => h("span", { class: `keyhole${i < v.shards ? " filled" : ""}` }))),
          h("p", { class: "muted", style: "margin:0" },
            `Needs ${v.needShards} people from ${v.needDesks} different desks. Desks in so far: ${v.desks.length ? v.desks.join(", ") : "none"}.`),
          v.opened
            ? h("p", { class: "archie-says good" }, `Opened ${timeAgo(v.opened)}. A new case has appeared on the board.`)
            : v.contributed
              ? h("p", { class: "archie-says good" }, "Your shard is in. Now find people from other desks.")
              : v.myShard
                ? h("div", { class: "row" },
                    h("span", { class: "shard" }, v.myShard),
                    h("button", { class: "btn", type: "button", onclick: async () => {
                      const res = await api(`/api/vaults/${v.id}/shard`, { method: "POST", body: { shard: v.myShard } });
                      if (!res.ok) toast("The shard didn't fit", res.data.message || res.data.error);
                      for (const a of res.data.achievements || []) toast(`Achievement: ${a.title}`, `${a.description} +${a.points}`);
                      refreshMe();
                      views.vault(main);
                    } }, "Fit my shard"))
                : h("p", { class: "muted" }, v.shardHint),
          h("span", { class: "tile-points" }, `${v.points} pts each when it opens`))
      );
    })
  );
};

views.achievements = async (main) => {
  const { data } = await api("/api/achievements");
  const earned = data.achievements.filter((a) => a.earned).length;
  fill(main, 
    h("div", { class: "view-head" }, h("div", { class: "stack", style: "gap:.3rem" },
      h("span", { class: "eyebrow" }, `${earned} of ${data.achievements.length}`),
      h("h1", {}, "Achievements"))),
    h("div", { class: "grid" }, data.achievements.map((a) =>
      h("div", { class: `tile${a.earned ? " earned" : " dim"}` },
        h("span", { class: "tile-title" }, a.title),
        h("span", { class: "muted" }, a.description),
        h("span", { class: "tile-points" }, a.earned ? `+${a.points} · ${new Date(a.earnedAt).toLocaleDateString()}` : a.points ? `${a.points} pts` : "?"))))
  );
};

views.story = async (main) => {
  await refreshMe();
  const lines = state.me?.lore || [];
  const byNum = new Map();
  let total = 16;
  for (const line of lines) {
    const m = line.match(/^\[(\d+)\/(\d+)\]\s*(.*)$/);
    if (m) { byNum.set(Number(m[1]), m[3]); total = Number(m[2]); }
  }
  fill(main, 
    h("div", { class: "view-head" }, h("div", { class: "stack", style: "gap:.3rem" },
      h("span", { class: "eyebrow" }, `${byNum.size} of ${total} pieces`),
      h("h1", {}, "m.'s last message"))),
    h("section", { class: "folder", "data-tab": "Recovered from the archive" },
      h("p", { class: "muted", style: "margin-top:0" }, "Each closed case recovers one line. Your colleagues have different pieces."),
      Array.from({ length: total }, (_, i) => {
        const text = byNum.get(i + 1);
        return text
          ? h("div", { class: "story-line" }, `${i + 1}. ${text}`)
          : h("div", { class: "story-line missing" }, `${i + 1}. ${"░".repeat(18 + ((i * 7) % 20))}`);
      }))
  );
};

// ---- router ----------------------------------------------------------------

async function render() {
  const main = $("#main");
  if (!store.token) {
    setChrome(false);
    await views.join(main);
    return;
  }
  setChrome(true);
  if (!state.me) await refreshMe();
  if (!store.token) return; // token was rejected
  connectStream();
  loadWire();

  const [view, arg] = (location.hash.slice(1) || "cases").split("/");
  markTab(view === "case" ? "cases" : view);
  const fn = views[view] && view !== "join" ? views[view] : views.cases;
  await fn(main, arg && decodeURIComponent(arg));
  // Move focus to the new view, unless the view already focused a field.
  if (!main.contains(document.activeElement)) main.focus({ preventScroll: true });
}

window.addEventListener("hashchange", render);

// ---- the wire (live) -------------------------------------------------------

function wireItem(ev, fresh) {
  return h("li", { class: `${ev.kind}${fresh ? " fresh" : ""}` }, h("span", { class: "wire-time", "data-at": ev.at }, timeAgo(ev.at)), ev.text);
}

async function loadWire() {
  if (state.wireLoaded) return;
  state.wireLoaded = true;
  const { data } = await api("/api/feed");
  const list = $("#wire-list");
  fill(list, ...(data.events || []).map((ev) => { state.wireIds.add(ev.id); return wireItem(ev, false); }));
}

setInterval(() => {
  for (const t of document.querySelectorAll(".wire-time")) t.textContent = timeAgo(Number(t.dataset.at));
}, 30000);

let stream = null;
function connectStream() {
  if (stream || !store.token || !("EventSource" in window)) return;
  stream = new EventSource(`/api/stream?token=${encodeURIComponent(store.token)}`);
  stream.addEventListener("wire", (e) => {
    const ev = JSON.parse(e.data);
    if (state.wireIds.has(ev.id)) return;
    state.wireIds.add(ev.id);
    const list = $("#wire-list");
    list.prepend(wireItem(ev, true));
    while (list.children.length > 60) list.lastChild.remove();
    if (ev.kind === "vault-open" || ev.kind === "rumor") toast(ev.kind === "rumor" ? "A rumour" : "Something opened", ev.text);
  });
  stream.addEventListener("scores", (e) => {
    refreshMe();
    if ((location.hash.slice(1) || "cases") === "board") renderBoard($("#main"), JSON.parse(e.data));
  });
  stream.addEventListener("board", () => { if ((location.hash.slice(1) || "cases") === "cases") views.cases($("#main")); });
  stream.addEventListener("vault", () => { const v = location.hash.slice(1) || "cases"; if (v === "vault" || v === "cases") render(); });
}

// ---- hidden things ---------------------------------------------------------

async function revealEgg(id, title) {
  const { ok, data } = await api(`/api/egg/${id}`);
  if (!ok) return;
  if (data.code) codeToast(title, data.message, data.code);
  else if (data.message) toast(title, data.message);
}

// The console whisper.
async function whisper() {
  console.log(
    "%c ARCHIE %c\nYou opened the console. Most people never do.\nThe answers aren't in here. They never leave the server.\nBut I can tell you a secret, since you asked politely.",
    "background:#b3362b;color:#fff;font:bold 14px monospace;padding:2px 6px",
    "font:13px monospace"
  );
  const { data } = await api("/api/whisper");
  if (data?.whisper) {
    console.log(`%cReport this under Discoveries: ${data.whisper}`, "font:bold 13px monospace;color:#2c5784");
  }
}

// Konami.
const KONAMI = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
let konamiAt = 0;
window.addEventListener("keydown", (e) => {
  if (!store.token) return;
  konamiAt = e.key === KONAMI[konamiAt] ? konamiAt + 1 : e.key === KONAMI[0] ? 1 : 0;
  if (konamiAt === KONAMI.length) {
    konamiAt = 0;
    revealEgg("konami", "Thirty lives");
  }
});

// Impatience with the logo.
let logoClicks = [];
$("#brand").addEventListener("click", () => {
  const now = Date.now();
  logoClicks = logoClicks.filter((t) => now - t < 3000).concat(now);
  const brand = $("#brand");
  brand.classList.remove("shake");
  void brand.offsetWidth;
  brand.classList.add("shake");
  if (logoClicks.length >= 7) {
    logoClicks = [];
    revealEgg("impatient-logo", "Impatience");
  } else if (logoClicks.length === 1) {
    location.hash = "#cases";
  }
});

// The lamp only exists at night; the server decides whether it means anything.
$("#lamp").addEventListener("click", () => revealEgg("night-shift", "Lights off"));

// The fine print: selecting it is the only way to see it.
let finePrintDone = false;
document.addEventListener("selectionchange", () => {
  if (finePrintDone || !store.token) return;
  const sel = document.getSelection();
  if (sel && !sel.isCollapsed && $("#fine-print") && sel.containsNode($("#fine-print"), true)) {
    finePrintDone = true;
    revealEgg("fine-print", "The fine print");
  }
});

$("#sign-out").addEventListener("click", () => {
  const close = modal(h("div", { class: "stack" },
    h("h2", {}, "Leave the building?"),
    h("p", {}, "You'll need your display name and passphrase to come back on this device."),
    h("div", { class: "row" },
      h("button", { class: "btn", type: "button", onclick: () => { store.token = null; state.me = null; stream?.close(); stream = null; state.wireLoaded = false; close(); location.hash = ""; render(); } }, "Leave"),
      h("button", { class: "btn ghost", type: "button", onclick: () => close() }, "Stay"))
  ));
});

// ---- boot ------------------------------------------------------------------

applyTheme();
setInterval(applyTheme, 60 * 1000);
render().then(() => { if (store.token) whisper(); });
