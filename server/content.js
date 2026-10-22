import { readdirSync, watch } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export const DESKS = {
  engineering: "Engineering",
  support: "Support",
  qa: "QA",
  ops: "Ops",
  creative: "Creative",
  common: "Common Room",
};

const state = { cases: new Map(), eggs: new Map(), achievements: [], vaults: [] };

const fresh = (file) => `${pathToFileURL(file).href}?v=${Date.now()}`;

function validateCase(c, file) {
  const problems = [];
  if (!c.id || !/^[a-z0-9-]+$/.test(c.id)) problems.push("id");
  if (!DESKS[c.desk]) problems.push(`desk "${c.desk}"`);
  if (!c.title) problems.push("title");
  if (typeof c.body !== "function" && typeof c.body !== "string") problems.push("body");
  if (!c.check && !(Array.isArray(c.answers) && c.answers.length)) problems.push("answers/check");
  if (problems.length) {
    console.warn(`[content] ${file}: skipped case ${c.id || "?"} (bad ${problems.join(", ")})`);
    return false;
  }
  return true;
}

export async function loadContent(dir) {
  const cases = new Map();
  const challengeDir = join(dir, "challenges");
  for (const name of readdirSync(challengeDir).sort()) {
    if (!name.endsWith(".js")) continue;
    try {
      const mod = await import(fresh(join(challengeDir, name)));
      for (const c of mod.default || []) {
        if (!validateCase(c, name)) continue;
        if (cases.has(c.id)) {
          console.warn(`[content] ${name}: duplicate case id ${c.id}, skipped`);
          continue;
        }
        cases.set(c.id, { points: 100, hints: [], near: {}, ...c });
      }
    } catch (err) {
      console.warn(`[content] failed to load ${name}:`, err.message);
    }
  }

  const eggsMod = await import(fresh(join(dir, "eggs.js")));
  const eggs = new Map(eggsMod.default.map((e) => [e.id, e]));
  const achMod = await import(fresh(join(dir, "achievements.js")));
  const vaultMod = await import(fresh(join(dir, "vaults.js")));

  state.cases = cases;
  state.eggs = eggs;
  state.achievements = achMod.default;
  state.vaults = vaultMod.default;
  console.log(
    `[content] ${cases.size} cases, ${eggs.size} hidden eggs, ` +
      `${state.achievements.length} achievements, ${state.vaults.length} vaults`
  );
}

/** Reload on any change under content/, debounced, so cases can be added live. */
export function watchContent(dir, onReload) {
  let timer = null;
  try {
    watch(dir, { recursive: true }, () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        try {
          await loadContent(dir);
          onReload?.();
        } catch (err) {
          console.warn("[content] reload failed:", err.message);
        }
      }, 300);
    });
  } catch (err) {
    console.warn("[content] live reload unavailable:", err.message);
  }
}

export const content = state;
