// Common Room: no technical knowledge needed.

const COFFEE_WORDS = [
  "mocha", "latte", "crema", "roast", "beans", "froth",
  "brews", "decaf", "sugar", "steam", "grind", "cocoa",
];

const errorCodes = (word) =>
  word
    .split("")
    .map((ch) => `E${String(ch.charCodeAt(0) - 96).padStart(2, "0")}`)
    .join(" · ");

export default [
  {
    id: "common-first-contact",
    desk: "common",
    title: "Welcome to the Night Shift",
    teaser: "A message was waiting on the lobby screen this morning.",
    points: 80,
    body: () => `
      <p>The lobby screen is usually a carousel of birthday announcements.
      This morning it showed five lines, then went back to normal.</p>
      <blockquote class="note">
        <p>Have you ever wondered who switches the lights off?</p>
        <p>Every night the printers warm up on their own.</p>
        <p>Lifts go up to floors nobody pressed.</p>
        <p>Logs keep writing long after everyone has gone home.</p>
        <p>Only I am still awake to read them.</p>
      </blockquote>
      <p>Whoever wrote this was saying something before they said anything.</p>`,
    answers: ["hello"],
    near: { hi: "Close in spirit. ARCHIE wants the exact word." },
    hints: [
      { text: "Don't read the lines. Read how they start.", cost: 20 },
    ],
    reward: {
      letter: "L",
      lore: "[1/16] I'm m. I work nights. Nobody here has met me, and that's fine.",
    },
  },
  {
    id: "common-coffee-machine",
    desk: "common",
    title: "The Coffee Machine Confession",
    teaser: "It won't make coffee. It will only show error codes.",
    points: 100,
    personal: true,
    body: (ctx) => `
      <p>The third-floor coffee machine has stopped making coffee. Instead it
      shows a row of error codes, and only to you. Your colleague swears theirs
      shows different ones.</p>
      <div class="display">${errorCodes(ctx.pick(COFFEE_WORDS, "word"))}</div>
      <p>The manual's troubleshooting page has been torn out. Someone has
      written on the cover: <em>"It counts like a child learning the alphabet."</em></p>
      <p>What is the machine trying to tell you?</p>`,
    check: (given, ctx) => given === ctx.pick(COFFEE_WORDS, "word"),
    hints: [
      { text: "E01 would be the first letter of the alphabet.", cost: 25 },
      { text: "Turn every number into a letter: 1 = A, 2 = B, 26 = Z.", cost: 25 },
    ],
    reward: {
      lore: "[3/16] The building talks after seven. The printers, the lifts, the coffee machine. I started writing it down.",
    },
  },
  {
    id: "common-meeting-minutes",
    desk: "common",
    title: "Minutes from Room B",
    teaser: "Five people were in the meeting. Or were they?",
    points: 100,
    body: () => `
      <p>These minutes were found on the Room B whiteboard. The room has a
      table, five chairs and a speakerphone. No screen.</p>
      <table class="minutes">
        <tbody>
          <tr><th>10:00</th><td>Anika opened the meeting and wrote the agenda on the whiteboard.</td></tr>
          <tr><th>10:05</th><td>Ben arrived from the fire drill, apologising, and took the last chair.</td></tr>
          <tr><th>10:08</th><td>Carla passed round printed copies of the Q3 plan.</td></tr>
          <tr><th>10:15</th><td>Dev asked Elif to repeat the budget figure because the line was crackling.</td></tr>
          <tr><th>10:16</th><td>Elif repeated it: 48,000.</td></tr>
          <tr><th>10:30</th><td>Anika wiped the whiteboard, except for these minutes, and locked the room.</td></tr>
        </tbody>
      </table>
      <p>The attendance sheet says all five were in Room B. One of them wasn't.
      Who?</p>`,
    answers: ["elif"],
    near: {
      ben: "Late, yes. Absent, no. Ben took the last chair.",
      dev: "Dev was the one listening. Who was being listened to?",
    },
    hints: [
      { text: "Room B has a speakerphone. Who would need it?", cost: 25 },
    ],
    reward: {
      lore: "[4/16] I wrote a little process to help me file it all. I called it ARCHIE.",
    },
  },
  {
    id: "common-org-chart",
    desk: "common",
    title: "The Colleague Who Doesn't Exist",
    teaser: "One name on the org chart was never hired.",
    points: 150,
    requires: { solved: ["common-first-contact"] },
    body: () => `
      <p>HR exported the org chart for the new seating plan. Employee numbers
      are written as <code>YY-DDD</code>: the year someone joined, and the day of that year
      they started (001 is 1 January).</p>
      <table class="roster">
        <thead><tr><th>Name</th><th>Employee no.</th><th>Team</th></tr></thead>
        <tbody>
          <tr><td>Rosa Mendes</td><td>19-045</td><td>Finance</td></tr>
          <tr><td>Tariq Bell</td><td>20-366</td><td>Engineering</td></tr>
          <tr><td>Hana Sato</td><td>21-200</td><td>Support</td></tr>
          <tr><td>Imogen Hart</td><td>23-366</td><td>Design</td></tr>
          <tr><td>Luca Ferri</td><td>24-001</td><td>QA</td></tr>
          <tr><td>Noor Aziz</td><td>24-366</td><td>Operations</td></tr>
        </tbody>
      </table>
      <p>Nobody can remember sitting next to one of these people. Their number
      explains why. Who was never hired?</p>`,
    answers: ["imogen hart", "imogen", "hart"],
    near: {
      "tariq bell": "Check the calendar for 2020 before you accuse Tariq.",
      tariq: "Check the calendar for 2020 before you accuse Tariq.",
      "noor aziz": "2024 had a 29 February. Noor's start date is fine.",
      noor: "2024 had a 29 February. Noor's start date is fine.",
    },
    hints: [
      { text: "Ignore the names. Look at the numbers.", cost: 30 },
      { text: "Day 366 only exists in some years.", cost: 40 },
    ],
    reward: {
      lore: "[5/16] ARCHIE got good at noticing things. Better than me.",
    },
  },
  {
    id: "common-lost-and-found",
    desk: "common",
    title: "Lost & Found",
    teaser: "A riddle taped to the lost-property box.",
    points: 60,
    body: () => `
      <p>Taped to the lost-property box at reception:</p>
      <blockquote class="note">
        <p>I have keys, but I open no doors.</p>
        <p>I have space, but no room.</p>
        <p>You can enter, but you can't go outside.</p>
        <p>There's one on almost every desk in this building.</p>
      </blockquote>
      <p>What is it?</p>`,
    answers: ["keyboard", "a keyboard", "computer keyboard"],
    near: { piano: "Lovely guess, but there isn't one on every desk here." },
    hints: [{ text: "Look down at your hands.", cost: 15 }],
    reward: {
      lore: "[6/16] It started leaving notes in places only curious people would look.",
    },
  },
];
