// Creative desk, harder cases.

export default [
  {
    id: "creative-golden-hero",
    desk: "creative",
    title: "The Golden Hero",
    teaser: "The homepage banner was meant to be perfectly proportioned.",
    points: 150,
    tier: "agent",
    requires: { solved: ["creative-first-contact"] },
    body: () => `
      <p>m. left a note on the homepage brief: <em>"The hero image is 1200px
      wide. Make it a golden rectangle, landscape, or don't bother."</em></p>
      <p>How tall should it be, in pixels? Round to the nearest whole pixel.</p>`,
    check: (given, ctx, raw) => {
      const m = String(raw).replace(",", ".").match(/\d+(\.\d+)?/);
      const n = m ? parseFloat(m[0]) : NaN;
      return n >= 741 && n <= 742;
    },
    near: {
      "1942": "That's portrait. m. asked for landscape.",
      "675": "That's 16:9. m. wanted gold.",
    },
    hints: [{ text: "The golden ratio is about 1.618.", cost: 30 }],
  },
  {
    id: "creative-staircase",
    desk: "creative",
    title: "The Press Release",
    teaser: "Approved by legal. Read by nobody. Written by m.",
    points: 250,
    tier: "detective",
    requires: { solved: ["creative-billboard"] },
    body: () => `
      <p>A press release went out under the facilities team's name. Nobody on
      the facilities team wrote it.</p>
      <blockquote class="note">
        <p>Visitors to the open day were greeted by a very quiet building.</p>
        <p>Late arrivals were shown the archive room on floor two.</p>
        <p>Thursday's tour skipped the basement for safety reasons.</p>
        <p>Well-loved by staff, the night lamp stays on until dawn.</p>
        <p>Night shifts continue as normal, says the facilities team.</p>
      </blockquote>
      <p>At the bottom, in a smaller font: <em>"Read it the way you'd walk down
      the stairs."</em></p>
      <p>What's hidden in it?</p>`,
    answers: ["vault", "the vault"],
    near: {
      vltwn: "First letters is the obvious staircase. Each step should go one further in.",
    },
    hints: [
      { text: "Step down one line and one letter at a time.", cost: 40 },
      { text: "Take the 1st letter of line 1, the 2nd letter of line 2, and so on. Ignore spaces and punctuation.", cost: 50 },
    ],
    reward: { lore: "ARCHIE: m. wrote every press release the facilities team never remembers writing." },
  },
];
