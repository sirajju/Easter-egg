// Common Room, harder cases. Still no technical knowledge needed, just patience.

export default [
  {
    id: "common-quarter-past",
    desk: "common",
    title: "Quarter Past Three",
    teaser: "The lobby clock stopped. Its hands are almost touching.",
    points: 150,
    tier: "agent",
    requires: { solved: ["common-first-contact"] },
    body: () => `
      <p>The analogue clock in the lobby stopped at exactly <strong>3:15</strong>.
      Security says the hands are "basically on top of each other".</p>
      <p>They aren't. What's the angle between the hour hand and the minute
      hand, in degrees?</p>`,
    check: (given, ctx, raw) => /(^|[^\d])7[.,]5(\D|$)/.test(String(raw)),
    near: {
      "0": "The hour hand doesn't wait for the hour. It's been moving since 3:00.",
      "15": "Closer. How far does the hour hand move in 15 minutes?",
    },
    hints: [
      { text: "The hour hand moves 30° per hour, so 0.5° per minute.", cost: 30 },
    ],
  },
  {
    id: "common-seating-plan",
    desk: "common",
    title: "The Seating Plan",
    teaser: "Five desks in a row. Five colleagues. Five complaints.",
    points: 220,
    tier: "detective",
    requires: { solved: ["common-meeting-minutes"] },
    body: () => `
      <p>Facilities needs to seat Anya, Bram, Chidi, Dana and Emil at desks
      1 to 5, numbered left to right. Everyone has a condition:</p>
      <ol>
        <li>Bram wants an end desk.</li>
        <li>Dana must sit directly to the right of Anya.</li>
        <li>Chidi refuses to sit next to Bram.</li>
        <li>Emil sits somewhere to the left of Chidi.</li>
        <li>Emil and Dana had a falling-out: they can't be neighbours.</li>
        <li>Anya and Chidi both want odd-numbered desks.</li>
      </ol>
      <p>Only one arrangement keeps everyone happy. Who sits at desk 4?</p>`,
    answers: ["dana"],
    near: {
      anya: "Anya's desk number is odd. 4 isn't.",
      chidi: "Chidi's desk number is odd. 4 isn't.",
    },
    hints: [
      { text: "Anya is odd and Dana sits right after her, so Dana is even: desk 2 or 4.", cost: 50 },
      { text: "Try Bram at desk 1 first.", cost: 50 },
    ],
  },
  {
    id: "common-friday-nights",
    desk: "common",
    title: "Friday Nights",
    teaser: "m.'s room bookings, found in the old calendar export.",
    points: 350,
    tier: "fiendish",
    requires: { solved: ["common-org-chart"] },
    body: () => `
      <p>The calendar export lists every room m. ever booked. They're in the
      order the export spat them out, which is no order at all.</p>
<pre class="log">2026-09-19   Room B
2026-05-01   Basement
2026-03-14   Room A
2027-03-05   Basement
2026-11-25   Room C
2026-01-23   Basement
2026-06-02   Room B
2026-09-11   Basement
2026-08-06   Room A
2027-01-12   Room C</pre>
      <p>ARCHIE's comment on the export: <em>"m. only ever really worked on
      Friday nights. Everything else was a decoy. Count the days."</em></p>
      <p>What was m. trying to tell ARCHIE?</p>`,
    answers: ["wake", "wake up"],
    near: {
      waek: "Right letters. Put the dates in the order they happened.",
      kawe: "Right letters. Put the dates in the order they happened.",
    },
    hints: [
      { text: "Keep only the bookings that fall on a Friday.", cost: 60 },
      { text: "Turn each Friday's day of the month into a letter (1 = A) and read them in date order.", cost: 70 },
    ],
    reward: { lore: "ARCHIE: m. booked the basement four times. The fifth time, they didn't need to." },
  },
];
