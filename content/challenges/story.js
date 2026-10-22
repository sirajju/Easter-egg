// Cases that tie the story together: timed, collaborative and meta.

export default [
  {
    id: "night-log",
    desk: "common",
    title: "The Night Log",
    teaser: "Only readable while the lights are off.",
    points: 150,
    window: { from: 19, to: 6 },
    body: () => `
      <p>The security desk's night log. ARCHIE marked one line in red, then
      unmarked it.</p>
<pre class="log">1  22:14:03  Guard round, floor 2. All quiet.
2  23:02:41  Printer on floor 3 woke up. No job queued.
3  00:00:00  Lift called to floor 13.
4  01:17:12  Kettle in pantry switched on.
5  02:45:09  Badge "m." swiped at basement door.
6  03:00:00  All screens flicker once.
7  24:00:60  Session for "m." refreshed.
8  05:58:30  Lights on, floor 1.</pre>
      <p>One line could never have been written by a real clock. Which line
      number?</p>`,
    answers: ["7", "line 7", "seven"],
    near: {
      "3": "Floor 13 is suspicious, but the time is perfectly valid.",
      "6": "03:00:00 is a real time. Spooky, but real.",
    },
    hints: [{ text: "Check every hour, minute and second against what a clock can show.", cost: 30 }],
    reward: {
      lore: "[8/16] At 03:00 the whole building hums the same note. I used to hum along.",
    },
  },
  {
    id: "vault-server-room",
    desk: "ops",
    title: "Inside the Server Room",
    teaser: "The door is open. Someone left a note on the rack.",
    points: 200,
    hidden: true,
    requires: { vault: "server-room" },
    body: () => `
      <p>The server room door is open. You did that together. Inside, one rack
      is still humming. Taped to it:</p>
      <blockquote class="note">
        <p>The password to this rack has always been the name of the thing that
        never sleeps in this building.</p>
        <p>Not the guard. Not the kettle. Not me.</p>
        <p>— m.</p>
      </blockquote>
      <p>What's the password?</p>`,
    answers: ["archie", "the archivist", "archivist"],
    near: { m: "The note says: not me." },
    hints: [{ text: "Who has been talking to you this whole time?", cost: 40 }],
    reward: {
      lore: "[10/16] The server room was mine. Now it's yours.",
    },
  },
  {
    id: "meta-archivist",
    desk: "common",
    title: "The Archivist's Riddle",
    teaser: "ARCHIE has been stamping letters on your file.",
    points: 300,
    hidden: true,
    requires: { letters: 6 },
    body: (ctx) => `
      <p>Every desk gave you one letter. ARCHIE has laid them out on your case
      file, face up:</p>
      <div class="display">L · O · G · O · U · T</div>
      <p>…in an order that already makes sense, which is suspicious. ARCHIE
      never makes things that easy, unless it wants something.</p>
      <p>The question m. left behind is simple: <em>what did I never do?</em>
      Answer it, and ARCHIE can finally rest.</p>
      <p class="fine">Case file of ${ctx.player.name.replace(/[<>&"]/g, "")}.</p>`,
    answers: ["logout", "log out", "logged out", "log off", "logoff"],
    near: { login: "The opposite.", "sign out": "Right idea. Use ARCHIE's letters." },
    reward: {
      lore: "[16/16] Log me out. Tell ARCHIE it can finally rest.",
    },
  },
];
