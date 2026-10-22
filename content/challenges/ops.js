// Ops desk: incidents, timelines, schedules.

export default [
  {
    id: "ops-first-contact",
    desk: "ops",
    title: "The 3 a.m. Page",
    teaser: "Six alerts in eight minutes. Only one of them matters.",
    points: 100,
    body: () => `
      <p>The on-call phone woke someone up at 03:04. By the time they opened
      the laptop, the alert channel looked like this (newest first):</p>
<pre class="log">03:06  checkout       error rate 31%
03:05  api-gateway    p95 latency 4.2s
03:04  api-gateway    5xx above threshold
03:02  orders-db      replica lag 340s
03:00  orders-db      write latency high
02:58  logvault       disk 100% full</pre>
      <p>Everything downstream is a symptom. Which service fell over first?</p>`,
    answers: ["logvault"],
    near: {
      "orders-db": "orders-db is suffering, but something broke before it.",
      checkout: "checkout is the loudest alert. Loud isn't first.",
    },
    hints: [{ text: "The list is newest first. Read it from the bottom.", cost: 20 }],
    reward: {
      letter: "U",
      lore: "[2/16] The night shift is quiet, but it is never empty.",
    },
  },
  {
    id: "ops-cron",
    desk: "ops",
    title: "m.'s Cleanup Job",
    teaser: "A cron job nobody dares to delete.",
    points: 120,
    requires: { solved: ["ops-first-contact"] },
    body: () => `
      <p>There's one line in the old server's crontab with a comment:
      <em>"m. — will tidy up when I'm ready."</em></p>
<pre class="code"><code>0 3 30 2 *   /srv/archie/logout.sh --user=m.</code></pre>
      <p>Fields are minute, hour, day of month, month, day of week.</p>
      <p>When will this job next run?</p>`,
    answers: ["never", "it never runs", "never runs", "it will never run"],
    near: {
      "30 february": "Look at a calendar for 30 February.",
      "february 30": "Look at a calendar for 30 February.",
      "30 feb": "Look at a calendar for 30 February.",
    },
    hints: [{ text: "Which month is month 2, and how long is it?", cost: 25 }],
  },
  {
    id: "ops-error-budget",
    desk: "ops",
    title: "Three Nines",
    teaser: "How long is ARCHIE allowed to sleep?",
    points: 100,
    requires: { solved: ["ops-first-contact"] },
    body: () => `
      <p>ARCHIE's service-level objective is <strong>99.9% availability</strong>,
      measured over a 30-day month.</p>
      <p>How many minutes of downtime does that allow per month?</p>`,
    check: (given, ctx, raw) => /(^|[^\d])43[.,]2(\D|$)/.test(String(raw)),
    near: { "43": "Close. Keep the decimal.", "44": "Don't round. Keep the decimal." },
    hints: [{ text: "30 days × 24 hours × 60 minutes × 0.1%.", cost: 25 }],
  },
];
