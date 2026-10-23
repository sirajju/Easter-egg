// Fiendish cases that don't belong to a single difficulty ladder: they unlock
// late, and some need answers from several desks.

export default [
  {
    id: "qa-race-condition",
    desk: "qa",
    title: "The Race Condition",
    teaser: "The petty-cash balance went up. Nobody added any money.",
    points: 320,
    tier: "fiendish",
    requires: { solved: ["qa-flaky", "qa-boundary-hunter"] },
    body: () => `
      <p>The petty-cash service keeps one balance. Every request reads it,
      does its sum, and writes the result back. No locks. Last night's trace,
      starting from a balance of <strong>€100</strong>:</p>
<pre class="log">t1  A  read balance                     (taking out €30)
t2  B  read balance                     (paying in €50)
t3  A  write balance = what A read − 30
t4  B  write balance = what B read + 50
t5  C  read balance                     (taking out €20)
t6  C  write balance = what C read − 20</pre>
      <p>Finance did the sums by hand and the books don't match the service.
      How many euros exist in the service that shouldn't?</p>`,
    answers: ["30", "€30", "30 euros"],
    near: {
      "130": "That's the balance the service ended with. How much of it is phantom money?",
      "100": "That's what the balance should have been. What's the difference?",
      "50": "Close. Whose write got lost, exactly?",
    },
    hints: [
      { text: "A and B both read €100 before either wrote. One of their writes overwrites the other.", cost: 60 },
      { text: "The service ends on €130. Work out what it should be if every request had seen the others.", cost: 70 },
    ],
    reward: { lore: "ARCHIE: m. found this bug in 2015. They added a comment and €30 to their own lunch fund." },
  },
  {
    id: "creative-lift-mirror",
    desk: "creative",
    title: "The Lift Mirror",
    teaser: "A banner in the lift, printed for people looking in the mirror.",
    points: 320,
    tier: "fiendish",
    requires: { solved: ["creative-staircase"] },
    body: () => `
      <p>A strip of short and long bars runs along the top of the lift mirror.
      Facilities say it's "decorative". It was installed at 03:00.</p>
      <div class="display">▬ &nbsp;/&nbsp; ▪▬▪▪ &nbsp;/&nbsp; ▪▪ &nbsp;/&nbsp; ▪▪▪▪ &nbsp;/&nbsp; ▪▪▪</div>
      <p>A note on the back of the strip: <em>"Printed for the mirror, not for
      you."</em></p>
      <p>What does the banner really say?</p>`,
    answers: ["shift", "the shift"],
    near: {
      tlihs: "You read the bars. Now think about where the banner is meant to be read.",
      shilt: "You turned the letters around. Did you turn each letter's bars around too?",
      night: "Good instinct for this office, but count the bars again.",
    },
    hints: [
      { text: "Short and long. Dots and dashes.", cost: 60 },
      { text: "A mirror reverses everything: the order of the letters and the order of the marks inside each letter.", cost: 80 },
    ],
    reward: { lore: "ARCHIE: Everyone checks their hair in that mirror. Nobody reads the ceiling." },
  },
  {
    id: "night-auditor",
    desk: "common",
    title: "The Night Auditor",
    teaser: "ARCHIE is auditing your work. It wants one word back.",
    points: 400,
    tier: "fiendish",
    hidden: true,
    requires: {
      solved: [
        "sup-first-contact",
        "ops-first-contact",
        "eng-first-contact",
        "sup-broken-macro",
        "eng-ghost-commit",
      ],
      count: 12,
    },
    body: () => `
      <p>ARCHIE has opened an audit of your case file. It lists five cases
      you closed, in a very particular order:</p>
      <ol>
        <li>The Ticket That Wouldn't Stay Put</li>
        <li>The 3 a.m. Page</li>
        <li>Hello, World?</li>
        <li>The Macro That Says Hello to Nobody</li>
        <li>The Commit Nobody Wrote</li>
      </ol>
      <p><em>"Your answers start the sentence. When m. finally logs out, I want
      the shutdown to be…"</em></p>
      <p>Finish ARCHIE's sentence.</p>`,
    answers: ["clean", "a clean shutdown", "clean shutdown"],
    near: {
      graceful: "Right idea. ARCHIE wants the word spelled by your answers.",
      quiet: "Right idea. ARCHIE wants the word spelled by your answers.",
    },
    hints: [
      { text: "Remember the answer to each case. Only the first letter matters.", cost: 80 },
    ],
    reward: { lore: "ARCHIE: Audit complete. You did the work m. left for you. Thank you." },
  },
];
