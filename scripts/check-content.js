// Lint the content folder: run `npm run check` after adding a case.
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { content, DESKS, loadContent } from "../server/content.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
await loadContent(join(root, "content"));

const ids = new Set(content.cases.keys());
let problems = 0;
const warn = (msg) => { problems += 1; console.warn("  ✘ " + msg); };

for (const c of content.cases.values()) {
  for (const dep of c.requires?.solved || []) {
    if (!ids.has(dep)) warn(`${c.id}: requires unknown case "${dep}"`);
  }
  if (c.requires?.vault && !content.vaults.some((v) => v.id === c.requires.vault)) {
    warn(`${c.id}: requires unknown vault "${c.requires.vault}"`);
  }
  if (c.hidden && !c.requires) warn(`${c.id}: hidden but has no unlock rule, so nobody will ever see it`);
}

const letters = [...content.cases.values()].filter((c) => c.reward?.letter);
const lore = [...content.cases.values()].map((c) => c.reward?.lore).filter(Boolean);
const seen = new Set();
for (const line of lore) {
  const n = line.match(/^\[(\d+)\//)?.[1];
  if (n && seen.has(n)) warn(`story line ${n} is used twice`);
  seen.add(n);
}

console.log("\nCases per desk:");
for (const [id, name] of Object.entries(DESKS)) {
  const list = [...content.cases.values()].filter((c) => c.desk === id);
  console.log(`  ${name.padEnd(12)} ${String(list.length).padStart(2)}  ${list.map((c) => c.id).join(", ")}`);
}
console.log(`\nLetter cases: ${letters.map((c) => `${c.id}=${c.reward.letter}`).join(", ")}`);
console.log(`Story lines: ${lore.length}`);
console.log(problems ? `\n${problems} problem(s).` : "\nContent looks good.");
process.exit(problems ? 1 : 0);
