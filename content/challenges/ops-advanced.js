// Ops desk, harder cases.

export default [
  {
    id: "ops-every-fifteen",
    desk: "ops",
    title: "Every Fifteen Minutes",
    teaser: "How often does the heartbeat job really run?",
    points: 150,
    tier: "agent",
    requires: { solved: ["ops-cron"] },
    body: () => `
      <p>ARCHIE's heartbeat job, from the same crontab:</p>
<pre class="code"><code>*/15 9-17 * * 1-5   /srv/archie/heartbeat.sh</code></pre>
      <p>Fields are minute, hour, day of month, month, day of week.</p>
      <p>How many times does it run in one week?</p>`,
    answers: ["180"],
    near: {
      "160": "9-17 includes both ends. Count the hours again.",
      "140": "Every 15 minutes is four runs an hour, at :00, :15, :30 and :45.",
      "252": "1-5 is Monday to Friday. Weekends are off.",
    },
    hints: [
      { text: "*/15 runs at :00, :15, :30 and :45.", cost: 25 },
      { text: "The hour range 9-17 is inclusive: that's nine hours.", cost: 35 },
    ],
  },
  {
    id: "ops-outside-fence",
    desk: "ops",
    title: "Outside the Fence",
    teaser: "One of these machines shouldn't be on the office network.",
    points: 220,
    tier: "detective",
    requires: { solved: ["ops-first-contact"] },
    body: () => `
      <p>The office network is <code>10.4.0.0/22</code>. The firewall logged
      these addresses talking to ARCHIE last night:</p>
<pre class="log">10.4.1.7
10.4.3.200
10.4.4.1
10.4.2.254
10.4.0.9</pre>
      <p>Which address is outside the office network?</p>`,
    answers: ["10.4.4.1"],
    near: {
      "10.4.3.200": "A /22 covers four /24 blocks. 10.4.3.x is the last one inside.",
      "10.4.2.254": "Still inside. A /22 is bigger than it looks.",
    },
    hints: [
      { text: "A /22 leaves 10 bits for hosts: 1024 addresses.", cost: 40 },
      { text: "10.4.0.0/22 runs from 10.4.0.0 to 10.4.3.255.", cost: 50 },
    ],
    reward: { lore: "ARCHIE: Someone outside the fence has been reading my logs. I left the door ajar for them." },
  },
  {
    id: "ops-exit-interview",
    desk: "ops",
    title: "Exit Interview",
    teaser: "m.'s last script printed three words before it stopped.",
    points: 300,
    tier: "fiendish",
    requires: { solved: ["ops-outside-fence"] },
    body: () => `
      <p>m.'s logout script, run once and never again:</p>
<pre class="code"><code>#!/bin/bash
check() { return 3; }
check
code=$?
(exit 7) &amp;&amp; echo yes || echo "no $code $?"</code></pre>
      <p>What did it print?</p>`,
    answers: ["no 3 7"],
    near: {
      yes: "(exit 7) fails. The && branch never runs.",
      "no 3 3": "$? changes after every command. What was the last one before echo?",
      "no 3 0": "$? isn't reset by &&. What exited last?",
      "no 3 1": "Not quite. Which command's status is in $? when the || branch starts?",
    },
    hints: [
      { text: "$code holds check's status. $? is re-read when echo's arguments are expanded.", cost: 50 },
      { text: "In a && b || c, when a fails, c runs straight after a.", cost: 60 },
    ],
    reward: { lore: "ARCHIE: Exit code 7. m. never documented what it meant. I think it meant goodbye." },
  },
];
