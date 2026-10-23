// Engineering desk, harder cases. Each unlocks from an easier one.

export default [
  {
    id: "eng-three-timers",
    desk: "engineering",
    title: "Three Timers",
    teaser: "ARCHIE set three alarms. They all rang with the same number.",
    points: 150,
    tier: "agent",
    requires: { solved: ["eng-first-contact"] },
    body: () => `
      <p>Found in an old cron helper, written in the days before <code>let</code>:</p>
<pre class="code"><code>const out = [];
for (var i = 0; i &lt; 3; i++) {
  setTimeout(() =&gt; out.push(i));
}
setTimeout(() =&gt; console.log(out.join("")));</code></pre>
      <p>What does it print?</p>`,
    answers: ["333"],
    near: {
      "012": "That's what it would print with let. With var there is only one i, and the loop finished before any timer ran.",
      "123": "Close to the intuition, far from the event loop.",
    },
    hints: [
      { text: "Timers run after the loop has completely finished.", cost: 30 },
      { text: "var gives the whole function one shared i. What is its value when the loop ends?", cost: 40 },
    ],
    reward: { lore: "ARCHIE: I have been waiting for the loop to finish since 2014." },
  },
  {
    id: "eng-sorting-hat",
    desk: "engineering",
    title: "The Sorting Hat",
    teaser: "ARCHIE sorted the floor numbers. Facilities is upset.",
    points: 150,
    tier: "agent",
    requires: { solved: ["eng-first-contact"] },
    body: () => `
      <p>Facilities asked ARCHIE to sort the floors that need new carpet:</p>
<pre class="code"><code>const floors = [10, 9, 1, 100, 25];
console.log(floors.sort().join(","));</code></pre>
      <p>The carpet arrived in the wrong order. What did ARCHIE print? Answer
      exactly as printed, commas included.</p>`,
    check: (given) => given === "110100259",
    near: {
      "1,9,10,25,100": "That's how a person sorts. JavaScript's default sort doesn't compare numbers.",
      "100,25,10,9,1": "Descending isn't the problem.",
    },
    hints: [{ text: "Without a compare function, sort() converts everything to strings first.", cost: 40 }],
  },
  {
    id: "eng-phantom-cents",
    desk: "engineering",
    title: "Phantom Cents",
    teaser: "The canteen till is out by a ghost of a cent.",
    points: 200,
    tier: "detective",
    requires: { solved: ["eng-off-by-one"] },
    body: () => `
      <p>The canteen till adds a 10-cent sugar sachet to a 20-cent napkin and
      refuses to print "0.3". Someone ran the sum by hand in the console:</p>
<pre class="code"><code>console.log(0.1 + 0.2);</code></pre>
      <p>What did the console show? Every digit counts.</p>`,
    check: (given) => given === "030000000000000004",
    near: { "0.3": "That's what the till wanted. Computers count in binary." },
    hints: [
      { text: "0.1 and 0.2 can't be stored exactly in binary floating point.", cost: 40 },
      { text: "It starts 0.3000… and has a 4 at the very end.", cost: 60 },
    ],
  },
  {
    id: "eng-xor-diary",
    desk: "engineering",
    title: "m.'s Diary",
    teaser: "One page of m.'s diary, scrambled with a one-byte key.",
    points: 250,
    tier: "detective",
    requires: { solved: ["eng-stack-trace"] },
    body: () => `
      <p>A file in the basement directory, named <code>diary.bin</code>. It's
      eight bytes long. Here they are in hex:</p>
<pre class="code"><code>04 03 1e 02 00 03 04 0c</code></pre>
      <p>A sticky note on the monitor: <em>"Locked with the only key I ever
      used: my own initial. One byte. XOR, obviously."</em></p>
      <p>What one word did m. write that night?</p>`,
    answers: ["insomnia"],
    hints: [
      { text: "m.'s initial is the letter m. In ASCII that's 0x6d.", cost: 50 },
      { text: "XOR each byte with 0x6d and read the result as ASCII: 0x04 ^ 0x6d = 0x69 = \"i\".", cost: 70 },
    ],
    reward: { lore: "ARCHIE: m. never slept on Thursdays. I logged it every week." },
  },
  {
    id: "eng-vigenere",
    desk: "engineering",
    title: "The Key Under the Mat",
    teaser: "A message encrypted with a word you've already found.",
    points: 350,
    tier: "fiendish",
    requires: { solved: ["eng-ghost-commit", "eng-xor-diary"] },
    body: () => `
      <p>The last file in the basement directory. Its first line reads
      <code>cipher: vigenere</code>, and its second:</p>
<pre class="code"><code>GPK ITFMSLGG SKF BF CTKXE BNL FNB</code></pre>
      <p>ARCHIE adds: <em>"m. reused the word from their commits. They always
      did."</em></p>
      <p>Where is the key?</p>`,
    answers: ["under the mat", "the mat", "mat", "under the doormat", "doormat"],
    near: {
      night: "That's the key to the cipher. Now use it.",
      basement: "That's which key. Where is it?",
    },
    hints: [
      { text: "The key is the word hidden in m.'s commit hashes.", cost: 60 },
      { text: "Vigenère: subtract each key letter (A=0) from each cipher letter, skipping spaces. G − N = T.", cost: 80 },
    ],
    reward: { lore: "ARCHIE: Nobody ever lifts the mat. That's why m. chose it." },
  },
];
