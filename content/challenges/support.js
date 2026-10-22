// Support desk: tickets that don't add up.

const tdate = (s) => `<span class="mono">${s}</span>`;

export default [
  {
    id: "sup-first-contact",
    desk: "support",
    title: "The Ticket That Wouldn't Stay Put",
    teaser: "Ticket #0001 has been passed around all morning.",
    points: 100,
    body: () => `
      <p>Ticket <strong>#0001</strong> ("The app says goodnight when I log in")
      bounced between agents all day. Here is its assignment history.</p>
      <table class="roster">
        <thead><tr><th>From</th><th>To</th><th>Owner</th></tr></thead>
        <tbody>
          <tr><td>${tdate("09:00")}</td><td>${tdate("09:20")}</td><td>Asha</td></tr>
          <tr><td>${tdate("09:20")}</td><td>${tdate("10:05")}</td><td>Bilal</td></tr>
          <tr><td>${tdate("10:05")}</td><td>${tdate("10:15")}</td><td>Chen</td></tr>
          <tr><td>${tdate("10:15")}</td><td>${tdate("10:40")}</td><td>Asha</td></tr>
          <tr><td>${tdate("10:40")}</td><td>${tdate("11:00")}</td><td>Dmitri</td></tr>
          <tr><td>${tdate("11:00")}</td><td>${tdate("12:30")}</td><td>Chen</td></tr>
          <tr><td>${tdate("12:30")}</td><td>${tdate("12:35")}</td><td>Asha (closed)</td></tr>
        </tbody>
      </table>
      <p>The customer wants to thank whoever spent the most time on it. Who
      owned the ticket the longest in total?</p>`,
    answers: ["chen"],
    near: {
      asha: "Asha touched it most often. That's not the same as longest.",
      bilal: "Bilal had one long stint. Add up everyone's time.",
    },
    hints: [{ text: "Add up each person's minutes across all their stints.", cost: 25 }],
    reward: {
      letter: "G",
      lore: "[13/16] I'm not coming back. That's alright. I just changed shifts.",
    },
  },
  {
    id: "sup-timezone",
    desk: "support",
    title: "Delivered Tomorrow",
    teaser: "Ticket #4040: “Your app says my parcel arrived tomorrow.”",
    points: 150,
    requires: { solved: ["sup-first-contact"] },
    body: () => `
      <p><strong>Ticket #4040</strong> from a customer in Auckland, New Zealand:</p>
      <blockquote class="note"><p>Your tracking page says my parcel was delivered
      on 22 October at 23:30. I was home all evening on the 22nd and nothing
      came. It turned up the next day at lunchtime. Are you time travellers?</p></blockquote>
      <p>The courier's system logs every delivery in UTC. In late October,
      Auckland is on daylight saving time (UTC+13).</p>
      <p>On what local date did the customer actually receive the parcel?</p>`,
    check: (given, ctx, raw) => {
      const r = String(raw).toLowerCase();
      return /\b23\b/.test(r) && /(oct|\b10\b)/.test(r) && !/\b22\b/.test(r);
    },
    hints: [
      { text: "23:30 UTC plus 13 hours.", cost: 30 },
      { text: "Answer with a date, for example \"5 November\".", cost: 20 },
    ],
  },
  {
    id: "sup-broken-macro",
    desk: "support",
    title: "The Macro That Says Hello to Nobody",
    teaser: "Every customer is being greeted by a blank.",
    points: 100,
    requires: { solved: ["sup-first-contact"] },
    body: () => `
      <p>Customers are getting replies that start "Hi ," and are signed by
      nobody. The macro was last edited at 03:20.</p>
<pre class="log">Hi {{customer.first_name}},

Thanks for getting in touch about ticket {{ticket.id}}.
It's currently {{ticket.status}}.

Talk soon,
{{agnet.name}}</pre>
      <p>The help desk only knows these fields: <code>customer.first_name</code>,
      <code>ticket.id</code>, <code>ticket.status</code>, <code>agent.name</code>.</p>
      <p>Which placeholder is broken? Type it exactly as it appears in the macro.</p>`,
    answers: ["agnet.name", "{{agnet.name}}"],
    near: {
      "agent.name": "That's what it should say. What does it actually say?",
      "customer.first_name": "That one is fine. Look further down.",
    },
    hints: [{ text: "Read the signature slowly.", cost: 20 }],
  },
];
