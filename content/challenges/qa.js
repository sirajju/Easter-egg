// QA desk: find what's wrong.

export default [
  {
    id: "qa-first-contact",
    desk: "qa",
    title: "The Test Report That Lied",
    teaser: "Five test cases, five green ticks. One shouldn't be.",
    points: 100,
    body: () => `
      <p>The spec for the order form says: <em>quantity must be a whole number
      from 1 to 10. Anything else shows an error.</em></p>
      <table class="roster">
        <thead><tr><th>Case</th><th>Input</th><th>Result</th><th>Marked</th></tr></thead>
        <tbody>
          <tr><td>TC-01</td><td>0</td><td>Error shown</td><td>✔ Pass</td></tr>
          <tr><td>TC-02</td><td>1</td><td>Accepted</td><td>✔ Pass</td></tr>
          <tr><td>TC-03</td><td>10</td><td>Accepted</td><td>✔ Pass</td></tr>
          <tr><td>TC-04</td><td>11</td><td>Accepted</td><td>✔ Pass</td></tr>
          <tr><td>TC-05</td><td>-1</td><td>Error shown</td><td>✔ Pass</td></tr>
        </tbody>
      </table>
      <p>Which test case should have failed?</p>`,
    answers: ["tc-04", "tc04", "04", "4"],
    near: {
      "tc-03": "10 is inside the range. Read the spec again.",
      "tc-01": "0 is outside the range, and it was rejected. That's correct.",
    },
    hints: [{ text: "Compare each input against 1 to 10.", cost: 20 }],
    reward: {
      letter: "O",
      lore: "[14/16] If you've found this many pieces, you know ARCHIE better than I did.",
    },
  },
  {
    id: "qa-receipt",
    desk: "qa",
    title: "The Generous Discount",
    teaser: "A receipt that's very slightly too kind.",
    points: 100,
    requires: { solved: ["qa-first-contact"] },
    body: () => `
      <p>A customer forwarded their receipt, delighted. Finance is not.</p>
<pre class="log">Night Owl Mug          3 × €12.00     €36.00
Discount (10%)                         −€3.00
--------------------------------------------
Total                                  €33.00</pre>
      <p>What should the total have been, in euros?</p>`,
    answers: ["32.40", "32,40", "€32.40", "32.4"],
    near: { "33": "That's what the bug charged. What should it have charged?" },
    hints: [{ text: "10% of €36.00 is not €3.00.", cost: 25 }],
  },
  {
    id: "qa-flaky",
    desk: "qa",
    title: "The Flaky Test",
    teaser: "It only fails sometimes. Which means it never really passes.",
    points: 150,
    requires: { solved: ["qa-first-contact"] },
    body: () => `
      <p>The nightly suite runs its tests in a random order. Five runs from
      last week:</p>
<pre class="log">run 1:  login ✔   set_locale ✔   invoice_total ✘   export ✔
run 2:  invoice_total ✔   login ✔   set_locale ✔   export ✘
run 3:  set_locale ✔   export ✘   login ✔   invoice_total ✔
run 4:  login ✔   export ✔   invoice_total ✔   set_locale ✔
run 5:  export ✔   set_locale ✔   login ✘   invoice_total ✔</pre>
      <p>The failing tests are innocent. One test leaves something behind that
      breaks whatever runs next. Which one?</p>`,
    answers: ["set_locale", "setlocale", "set locale"],
    near: {
      invoice_total: "invoice_total fails once and passes three times. It's a victim.",
      export: "export is a victim too. Look at what ran just before each failure.",
    },
    hints: [{ text: "Look at the test that ran immediately before every ✘.", cost: 30 }],
  },
];
