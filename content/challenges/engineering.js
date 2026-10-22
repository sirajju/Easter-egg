// Engineering desk: code-shaped mysteries.

export default [
  {
    id: "eng-first-contact",
    desk: "engineering",
    title: "Hello, World?",
    teaser: "A snippet in the build logs that nobody committed.",
    points: 100,
    body: () => `
      <p>Last night's build log contained a snippet that isn't in any branch.
      It ran once, printed one word, and exited.</p>
<pre class="code"><code>const parts = ["s", "e", "p", "c", "a", "h", "l", "o"];
const word = parts
  .filter((_, i) =&gt; i % 2 === 1)
  .join("")
  .toUpperCase();

console.log(word);</code></pre>
      <p>What did it print?</p>`,
    answers: ["echo"],
    near: { spal: "Those are the even indexes. Arrays start at zero." },
    hints: [{ text: "Index 0 is \"s\". Which indexes are odd?", cost: 25 }],
    reward: {
      letter: "O",
      lore: "[7/16] I hid some of them in the day shift's tools. I wanted you to find them.",
    },
  },
  {
    id: "eng-off-by-one",
    desk: "engineering",
    title: "The Thirteenth Floor",
    teaser: "The lift controller has opinions about superstition.",
    points: 100,
    body: () => `
      <p>The lift controller's firmware was patched at 03:00. The diff has one
      function in it:</p>
<pre class="code"><code>let floors = 0;
for (let f = 1; f &lt;= 13; f++) {
  if (f === 13) continue; // this building has no 13th floor
  floors++;
}
console.log(floors * 2 - 1);</code></pre>
      <p>What does it log?</p>`,
    answers: ["23"],
    near: {
      "25": "Off by one. Which is rather the point of this case.",
      "24": "Not quite. Count the floors that survive the continue.",
    },
    hints: [{ text: "How many times does floors++ actually run?", cost: 25 }],
  },
  {
    id: "eng-regex-seance",
    desk: "engineering",
    title: "Regex Séance",
    teaser: "ARCHIE only answers to one word.",
    points: 120,
    requires: { solved: ["eng-first-contact"] },
    body: () => `
      <p>A note in the README of an archived repo: <em>"ARCHIE only answers to
      a word that matches this. It's on every desk in the building."</em></p>
<pre class="code"><code>/^(?=.{7}$)(?=.*pl)(?=.*t)s[^aeiou]*a[^aeiou]*e[^aeiou]*r$/</code></pre>
      <p>What's the word?</p>`,
    answers: ["stapler"],
    near: {
      sampler: "It almost fits, but ARCHIE also wants a t. And there isn't a sampler on every desk.",
      shatter: "It fits the shape, but not the \"pl\" lookahead. And it's not on your desk, hopefully.",
    },
    hints: [
      { text: "Seven letters, starts with s, ends with r, contains \"pl\" and a \"t\".", cost: 30 },
      { text: "The only vowels are an a and then an e.", cost: 30 },
    ],
    reward: {
      lore: "[9/16] I built a door that needs all of you. I never had a team. You do.",
    },
  },
  {
    id: "eng-ghost-commit",
    desk: "engineering",
    title: "The Commit Nobody Wrote",
    teaser: "Three commits signed 'm.', all after 03:00.",
    points: 200,
    requires: { solved: ["eng-first-contact"] },
    body: () => `
      <p>Someone ran <code>git log</code> on the oldest repo we have. Most of it is what
      you'd expect.</p>
<pre class="log">4a1f9c2  2014-03-11 17:42  priya     fix: null check on invoice export
6e69f3a  2014-03-12 03:12  m.        chore: tidy
b20d7e1  2014-03-12 10:05  daniel    feat: add CSV download
6768c01  2014-03-13 03:40  m.        chore: tidy
c9e0a44  2014-03-13 15:20  priya     test: cover CSV edge cases
7400b9e  2014-03-14 03:01  m.        chore: tidy
e13b5d0  2014-03-14 11:58  daniel    docs: changelog</pre>
      <p>m.'s commits change nothing at all: empty diffs, every time. But
      git hashes aren't usually this… readable. What was m. writing?</p>`,
    answers: ["night"],
    near: { nigh: "Almost. Don't drop the last character before the zeros." },
    hints: [
      { text: "Only look at m.'s commits, and only the first four characters of each hash.", cost: 40 },
      { text: "Read them as hexadecimal pairs: 6e is a character in ASCII.", cost: 50 },
    ],
    reward: {
      lore: "[11/16] One night I went home and forgot to log out.",
    },
  },
  {
    id: "eng-stack-trace",
    desk: "engineering",
    title: "Where ARCHIE Lives",
    teaser: "A crash report with a very strange path.",
    points: 150,
    requires: { solved: ["eng-first-contact"] },
    body: () => `
      <p>A crash report arrived from a process nobody can find on any server.</p>
<pre class="log">Error: session still open (user=m.)
    at keepAwake (/srv/archie/dGhlIGJhc2VtZW50/daemon.js:404:12)
    at Timeout._onTimeout (/srv/archie/dGhlIGJhc2VtZW50/daemon.js:17:3)
    at listOnTimeout (node:internal/timers:569:17)</pre>
      <p>Where is ARCHIE actually running from?</p>`,
    answers: ["the basement", "basement"],
    hints: [
      { text: "That folder name isn't random. It ends like a lot of encoded strings.", cost: 30 },
      { text: "Base64.", cost: 40 },
    ],
    reward: {
      lore: "[12/16] ARCHIE is still waiting for me to come back and close the session.",
    },
  },
];
