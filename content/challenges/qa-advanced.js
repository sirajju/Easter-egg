// QA desk, harder cases.

const row = (...cells) => `<tr>${cells.map((c) => `<td>${c}</td>`).join("")}</tr>`;

export default [
  {
    id: "qa-illegal-transition",
    desk: "qa",
    title: "Illegal Transition",
    teaser: "One order did something orders aren't allowed to do.",
    points: 160,
    tier: "agent",
    requires: { solved: ["qa-first-contact"] },
    body: () => `
      <p>The order state machine allows only these transitions:</p>
<pre class="log">created → paid → shipped → delivered
created → cancelled
paid    → refunded</pre>
      <p>Last night's event log:</p>
<pre class="log">A17  created → paid → shipped → delivered
A18  created → cancelled
A19  created → paid → cancelled
A20  created → paid → refunded
A21  created → paid → shipped</pre>
      <p>Which order broke the rules?</p>`,
    answers: ["a19"],
    near: {
      a21: "A21 hasn't been delivered yet, but nothing it did is illegal.",
      a20: "paid → refunded is allowed.",
    },
    hints: [{ text: "Check every arrow against the allowed list.", cost: 30 }],
  },
  {
    id: "qa-boundary-hunter",
    desk: "qa",
    title: "Boundary Hunter",
    teaser: "Two bugs hiding at the edges of a password rule.",
    points: 220,
    tier: "detective",
    requires: { solved: ["qa-first-contact"] },
    body: () => `
      <p>The spec: <em>passwords must be 8 to 16 characters long, contain at
      least one digit, and contain no spaces.</em></p>
      <div class="table-wrap"><table class="roster">
        <thead><tr><th>Case</th><th>Input</th><th>Length</th><th>Result</th></tr></thead>
        <tbody>
          ${row("TC-1", "<code>abcdefg1</code>", "8", "Accepted")}
          ${row("TC-2", "<code>abcdefgh</code>", "8", "Accepted")}
          ${row("TC-3", "<code>a1</code>", "2", "Rejected")}
          ${row("TC-4", "<code>abcdefghijklmno1</code>", "16", "Accepted")}
          ${row("TC-5", "<code>abcdefghijklmnop1</code>", "17", "Accepted")}
          ${row("TC-6", "<code>abc def1</code>", "8", "Rejected")}
        </tbody>
      </table></div>
      <p>Two results are bugs. Which two test cases? Answer like "TC-1, TC-2".</p>`,
    check: (given, ctx, raw) => {
      const ids = new Set((String(raw).match(/[1-6]/g) || []).map(Number));
      return ids.size === 2 && ids.has(2) && ids.has(5);
    },
    hints: [
      { text: "One bug is about digits, the other about length.", cost: 40 },
      { text: "Count the characters in TC-4 and TC-5 against the 16 limit.", cost: 40 },
    ],
    reward: { lore: "ARCHIE: m. tested every form at 3 a.m. with the password 'insomnia1'." },
  },
];
