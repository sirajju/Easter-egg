// Creative desk: design, brand and copy.

const swatch = (name, hex) =>
  `<tr><td>${name}</td><td class="mono">${hex}</td></tr>`;

export default [
  {
    id: "creative-first-contact",
    desk: "creative",
    title: "The Brand Guide Heist",
    teaser: "Someone edited the brand palette at 03:30.",
    points: 100,
    body: () => `
      <p>The brand guide's palette page was edited overnight. Five swatches
      are exactly as they should be. One name no longer matches its colour.</p>
      <table class="roster">
        <thead><tr><th>Swatch</th><th>Hex</th></tr></thead>
        <tbody>
          ${swatch("Leaf Green", "#2E8B57")}
          ${swatch("Sky Blue", "#87CEEB")}
          ${swatch("Tomato Red", "#FF6347")}
          ${swatch("Forest Green", "#E8A33D")}
          ${swatch("Lemon", "#FFF44F")}
          ${swatch("Royal Purple", "#7851A9")}
        </tbody>
      </table>
      <p>Which swatch is lying?</p>`,
    answers: ["forest green", "forest"],
    near: {
      lemon: "#FFF44F is very much a lemon. Look for something greener that isn't.",
    },
    hints: [
      { text: "A green colour has a high middle pair (the G in RRGGBB) compared to the first pair.", cost: 25 },
    ],
    reward: {
      letter: "T",
      lore: "[15/16] I left the brand colours a little wrong on purpose. Perfect things don't get noticed.",
    },
  },
  {
    id: "creative-billboard",
    desk: "creative",
    title: "Proofread the Billboard",
    teaser: "It went to print. Everyone read it. Nobody saw it.",
    points: 80,
    requires: { solved: ["creative-first-contact"] },
    body: () => `
      <p>The approved billboard copy, as it went to the printer:</p>
      <blockquote class="note billboard">
        <p>WE NEVER<br>SLEEP SO<br>THAT YOU CAN<br>CAN REST.</p>
      </blockquote>
      <p>Three people signed it off. Which word appears twice?</p>`,
    answers: ["can"],
    near: { we: "Read every word, one at a time, out loud." },
    hints: [{ text: "Your brain skips repeated words across line breaks.", cost: 15 }],
  },
];
