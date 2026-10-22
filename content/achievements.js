// Achievements are checked on the server after every solve, discovery and
// shard. `test` receives facts about the player and the event that just
// happened:
//   type ("solve" | "egg" | "shard"), caseId, hints, wrong, seconds, hour,
//   firstBlood, solvedCount, desks, eggs, letters, firstBloods, shards,
//   solved (a Set of case ids)
// `secret: true` shows "???" until earned.

export default [
  { id: "first-case", title: "Badge Issued", description: "Close your first case.", points: 20, test: (f) => f.solvedCount >= 1 },
  { id: "five-cases", title: "Regular", description: "Close five cases.", points: 50, test: (f) => f.solvedCount >= 5 },
  { id: "ten-cases", title: "Senior Investigator", description: "Close ten cases.", points: 100, test: (f) => f.solvedCount >= 10 },
  { id: "twenty-cases", title: "Lives Here Now", description: "Close twenty cases.", points: 200, secret: true, test: (f) => f.solvedCount >= 20 },
  { id: "desk-hopper", title: "Desk Hopper", description: "Close cases on three different desks.", points: 60, test: (f) => f.desks >= 3 },
  { id: "every-desk", title: "Knows Everyone", description: "Close a case on every desk.", points: 150, secret: true, test: (f) => f.desks >= 6 },
  { id: "clean-sheet", title: "Clean Sheet", description: "Close a case on the first try with no hints.", points: 25, test: (f) => f.type === "solve" && f.hints === 0 && f.wrong === 0 },
  { id: "speedrun", title: "Speedrun", description: "Close a case within a minute of opening it.", points: 40, test: (f) => f.type === "solve" && f.seconds <= 60 },
  { id: "stubborn", title: "Stubborn", description: "Ten wrong answers, then the right one.", points: 40, secret: true, test: (f) => f.type === "solve" && f.wrong >= 10 },
  { id: "first-blood", title: "First Blood", description: "Be the first in the office to close a case.", points: 50, test: (f) => f.firstBloods >= 1 },
  { id: "triple-blood", title: "Unstoppable", description: "First to close three different cases.", points: 100, secret: true, test: (f) => f.firstBloods >= 3 },
  { id: "night-owl", title: "Night Owl", description: "Close a case between 22:00 and 05:00.", points: 40, secret: true, test: (f) => f.type === "solve" && (f.hour >= 22 || f.hour < 5) },
  { id: "early-bird", title: "Early Bird", description: "Close a case before 08:00.", points: 30, secret: true, test: (f) => f.type === "solve" && f.hour >= 5 && f.hour < 8 },
  { id: "lunch-detective", title: "Working Lunch", description: "Close a case between 13:00 and 14:00.", points: 20, secret: true, test: (f) => f.type === "solve" && f.hour === 13 },
  { id: "egg-hunter", title: "Egg Hunter", description: "Find three hidden eggs.", points: 60, test: (f) => f.eggs >= 3 },
  { id: "egg-collector", title: "Nothing Escapes You", description: "Find seven hidden eggs.", points: 120, secret: true, test: (f) => f.eggs >= 7 },
  { id: "vault-key", title: "Key Holder", description: "Fit a shard into a vault.", points: 30, test: (f) => f.shards >= 1 },
  { id: "letters", title: "Collector", description: "Collect six letters from ARCHIE.", points: 50, test: (f) => f.letters >= 6 },
  { id: "archivist", title: "Logged Out", description: "Solve the Archivist's Riddle.", points: 200, secret: true, test: (f) => f.solved.has("meta-archivist") },
];
