// Support desk, harder cases.

export default [
  {
    id: "sup-refund-spiral",
    desk: "support",
    title: "The Refund Spiral",
    teaser: "A refund that keeps refunding itself every night.",
    points: 220,
    tier: "detective",
    requires: { solved: ["sup-timezone"] },
    body: () => `
      <p>A customer paid <strong>€200.00</strong>. A refund rule ARCHIE "tidied"
      at 03:00 now runs every night and refunds <strong>25% of whatever the
      company still holds</strong> from that order.</p>
      <p>It ran on three nights before anyone noticed.</p>
      <p>How much has the customer been refunded in total, in euros?</p>`,
    check: (given, ctx, raw) => /115[.,]6(2|25|3)\b/.test(String(raw)),
    near: {
      "150": "That's three times 25% of the original €200. The rule takes 25% of what's left each night.",
      "15000": "That's three times 25% of the original €200. The rule takes 25% of what's left each night.",
      "84.38": "That's what the company kept. How much went back?",
      "8438": "That's what the company kept. How much went back?",
    },
    hints: [
      { text: "Night one: the company holds €150. Night two: 75% of that.", cost: 40 },
      { text: "The company keeps 200 × 0.75³. The refund is the rest.", cost: 50 },
    ],
  },
  {
    id: "sup-sla-breach",
    desk: "support",
    title: "Breach Date",
    teaser: "When does a four-hour promise actually expire?",
    points: 300,
    tier: "fiendish",
    requires: { solved: ["sup-timezone", "sup-broken-macro"] },
    body: () => `
      <p>Priority-two tickets must get a first reply within <strong>4 business
      hours</strong>.</p>
      <ul>
        <li>Business hours are <strong>Monday to Friday, 09:00 to 18:00</strong>.</li>
        <li>Next Monday is a public holiday. The clock doesn't run on holidays.</li>
        <li>The ticket arrived on <strong>Friday at 17:30</strong>.</li>
      </ul>
      <p>On what day, and at what time, does the SLA breach? Answer like
      "Wednesday 10:45".</p>`,
    check: (given, ctx, raw) => {
      const r = String(raw).toLowerCase();
      return /\btue/.test(r) && /\b12[:.]30\b/.test(r);
    },
    near: {
      "monday 1230": "Monday is a holiday. The clock doesn't run.",
      "friday 2130": "Business hours end at 18:00.",
      "tuesday 1300": "You've counted the half hour on Friday as nothing. It counts.",
      "tuesday 1100": "Count the 30 minutes left on Friday.",
    },
    hints: [
      { text: "Only 30 business minutes pass on Friday.", cost: 50 },
      { text: "Monday is skipped. That leaves 3½ hours from Tuesday 09:00.", cost: 60 },
    ],
    reward: { lore: "ARCHIE: m. answered every P2 at 03:00. Nobody ever measured it." },
  },
];
